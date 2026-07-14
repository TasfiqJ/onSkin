import {
  createRevenueCatV2DeletionExecutor,
  decodeRevenueCatV2ExecutorState,
  deriveRevenueCatV2ClaimBinding,
  deriveRevenueCatV2CredentialBinding,
  encodeRevenueCatV2ExecutorState,
  REVENUECAT_V2_EXECUTOR_MAX_PLAINTEXT_BYTES,
  REVENUECAT_V2_MAX_NETWORK_TIMEOUT_MS,
  REVENUECAT_V2_MAX_RECONCILIATION_CONCURRENCY,
  RevenueCatV2DeletionExecutorError,
  type RevenueCatV2DeletionExecutorOptions,
  type RevenueCatV2ExecutorState,
  type RevenueCatV2HttpRequest,
  type RevenueCatV2IdentityBarrierSnapshot,
  type RevenueCatV2NetworkResponse,
  type RevenueCatV2StepOutcome,
} from './revenueCatV2DeletionExecutor.ts';
import {
  AccountDeletionWorkerCapacityError,
  type AccountDeletionClaim,
} from './durableDeletionWorker.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertDeepEqual(actual: unknown, expected: unknown, message: string): void {
  const left = JSON.stringify(actual);
  const right = JSON.stringify(expected);
  if (left !== right) throw new Error(message + ': ' + left + ' !== ' + right);
}

async function assertRejectsStable(
  operation: () => Promise<unknown>,
  code: RevenueCatV2DeletionExecutorError['code'],
): Promise<void> {
  try {
    await operation();
  } catch (error) {
    assert(error instanceof RevenueCatV2DeletionExecutorError, 'expected stable executor error');
    assert(error.code === code, 'unexpected stable code');
    assert(error.message === code, 'error must contain only its stable code');
    return;
  }
  throw new Error('expected ' + code);
}

const USER_ID = '00000000-0000-4000-8000-000000000001';
const OPERATION_ID = '10000000-0000-4000-8000-000000000001';
const PROJECT_ID = 'proj1ab2c3d4';
const CUSTOMER_ID = 'customer_primary_1';
const ALIAS_A = '$RCAnonymousID:alias-a';
const ALIAS_B = 'legacy_alias_b';
const SECRET = 'revenuecat-v2-secret-that-must-never-escape';
const NOW = Date.parse('2026-07-13T12:05:00.000Z');
const NOW_ISO = '2026-07-13T12:05:00.000Z';
const DATABASE_NOW = '2026-07-13T12:05:00.000000+00:00';
const FIRST_SEEN = Date.parse('2026-07-13T10:00:00.000Z');
const LAST_SEEN = Date.parse('2026-07-13T11:30:00.000Z');
const PROJECT_CREATED = Date.parse('2025-01-01T00:00:00.000Z');
const ALIAS_A_CREATED = Date.parse('2026-07-13T10:30:00.000Z');
const ALIAS_B_CREATED = Date.parse('2026-07-13T11:00:00.000Z');
const DELETED_AT = Date.parse('2026-07-13T12:05:01.000Z');

function customerBody() {
  return {
    object: 'customer',
    id: CUSTOMER_ID,
    project_id: PROJECT_ID,
    first_seen_at: FIRST_SEEN,
    last_seen_at: LAST_SEEN,
    last_seen_app_version: null,
    last_seen_country: 'CA',
    last_seen_platform: 'ios',
    last_seen_platform_version: '18.5',
    active_entitlements: {
      object: 'list',
      items: [],
      next_page: null,
      url: '/v2/projects/' + PROJECT_ID + '/customers/' + CUSTOMER_ID + '/active_entitlements',
    },
    experiment: null,
  };
}

function providerError(
  type:
    | 'resource_missing'
    | 'rate_limit_error'
    | 'resource_locked_error'
    | 'server_error'
    | 'authentication_error'
    | 'authorization_error',
  retryable: boolean,
  backoffMs = 1_000,
) {
  return {
    object: 'error',
    type,
    message: 'Provider response',
    retryable,
    doc_url: 'https://errors.rev.cat/' + type.replaceAll('_', '-'),
    ...(retryable ? { backoff_ms: backoffMs } : {}),
  };
}

function projectsBody(options: {
  projects: Array<{ id: string; createdAt: number }>;
  nextStartingAfter: string | null;
}) {
  return {
    object: 'list',
    items: options.projects.map((project) => ({
      object: 'project',
      id: project.id,
      name: 'Project ' + project.id,
      created_at: project.createdAt,
      icon_url: null,
      icon_url_large: null,
    })),
    next_page:
      options.nextStartingAfter === null
        ? null
        : '/v2/projects?starting_after=' + encodeURIComponent(options.nextStartingAfter),
    url: '/v2/projects',
  };
}

function aliasPath(): string {
  return '/v2/projects/' + PROJECT_ID + '/customers/' + CUSTOMER_ID + '/aliases';
}

function aliasPageBody(options: {
  aliases: Array<{ id: string; createdAt: number }>;
  nextStartingAfter: string | null;
}) {
  return {
    object: 'list',
    items: options.aliases.map((alias) => ({
      object: 'customer.alias',
      id: alias.id,
      created_at: alias.createdAt,
    })),
    next_page:
      options.nextStartingAfter === null
        ? null
        : aliasPath() + '?starting_after=' + encodeURIComponent(options.nextStartingAfter),
    url: aliasPath(),
  };
}

function dispatchClaim(hasPayload = false): AccountDeletionClaim {
  return {
    operationId: OPERATION_ID,
    userId: USER_ID,
    operationState: 'running',
    stepName: 'revenuecat_delete',
    stepStatus: 'leased',
    claimMode: 'dispatch',
    claimToken: 'cd'.repeat(32),
    attemptCount: 1,
    requestStartedAt: null,
    leaseExpiresAt: '2026-07-13T12:15:00.000Z',
    encryptedPayload: hasPayload ? 'encrypted-state' : null,
  };
}

function reconcileClaim(): AccountDeletionClaim {
  return {
    ...dispatchClaim(true),
    claimMode: 'reconcile',
    requestStartedAt: DATABASE_NOW,
  };
}

function nextDispatchClaim(): AccountDeletionClaim {
  return {
    ...dispatchClaim(true),
    claimToken: 'ef'.repeat(32),
    attemptCount: 2,
  };
}

function nextReconcileClaim(): AccountDeletionClaim {
  return {
    ...reconcileClaim(),
    claimToken: 'ef'.repeat(32),
    attemptCount: 2,
  };
}

function dispatchClaimForAttempt(attempt: number): AccountDeletionClaim {
  const tokenByte = attempt.toString(16).padStart(2, '0');
  return {
    ...dispatchClaim(attempt > 1),
    claimToken: tokenByte.repeat(32),
    attemptCount: attempt,
  };
}

type PersistFault = (state: RevenueCatV2ExecutorState, call: number) => 'before' | 'after' | null;

type Harness = {
  options: RevenueCatV2DeletionExecutorOptions;
  payload: Uint8Array | null;
  persisted: RevenueCatV2ExecutorState[];
  outcomes: RevenueCatV2StepOutcome[];
  barriers: RevenueCatV2IdentityBarrierSnapshot[];
  calls: Array<{ method: string; url: string }>;
  events: string[];
  persistFault: PersistFault | null;
  failRecord: boolean;
  failBarrier: boolean;
  failPermit: boolean;
  failReset: boolean;
  markCalls: number;
  absenceCalls: number;
  absenceObservationCount: 0 | 1 | 2;
  absenceConfirmations: boolean[];
  resetAbsenceCalls: number;
};

function makeHarness(
  responder?: (
    request: RevenueCatV2HttpRequest,
    harness: Harness,
  ) => RevenueCatV2NetworkResponse | Promise<RevenueCatV2NetworkResponse>,
  overrides: Partial<
    Pick<
      RevenueCatV2DeletionExecutorOptions,
      'maxRequests' | 'retryDelayMs' | 'deadlineReserveMs' | 'secretApiKey'
    >
  > = {},
): Harness {
  let persistCalls = 0;
  const harness = {
    payload: null,
    persisted: [],
    outcomes: [],
    barriers: [],
    calls: [],
    events: [],
    persistFault: null,
    failRecord: false,
    failBarrier: false,
    failPermit: false,
    failReset: false,
    markCalls: 0,
    absenceCalls: 0,
    absenceObservationCount: 0,
    absenceConfirmations: [],
    resetAbsenceCalls: 0,
  } as unknown as Harness;
  const defaultResponder = (
    request: RevenueCatV2HttpRequest,
    current: Harness,
  ): Promise<RevenueCatV2NetworkResponse> => {
    const method = String(request.init.method);
    const deleteSeen = current.calls.some((call) => call.method === 'DELETE');
    if (method === 'GET' && request.url.endsWith('/v2/projects')) {
      return Promise.resolve({
        status: 200,
        body: projectsBody({
          projects: [{ id: PROJECT_ID, createdAt: PROJECT_CREATED }],
          nextStartingAfter: null,
        }),
      });
    }
    if (method === 'DELETE') {
      return Promise.resolve({
        status: 200,
        body: { object: 'customer', id: CUSTOMER_ID, deleted_at: DELETED_AT },
      });
    }
    if (deleteSeen) {
      return Promise.resolve({
        status: 404,
        body: providerError('resource_missing', false),
      });
    }
    if (method === 'GET' && request.url.endsWith('/aliases')) {
      return Promise.resolve({
        status: 200,
        body: aliasPageBody({
          aliases: [
            { id: ALIAS_A, createdAt: ALIAS_A_CREATED },
            { id: ALIAS_B, createdAt: ALIAS_B_CREATED },
          ],
          nextStartingAfter: null,
        }),
      });
    }
    return Promise.resolve({ status: 200, body: customerBody() });
  };
  harness.options = {
    projectId: PROJECT_ID,
    secretApiKey: overrides.secretApiKey ?? SECRET,
    gateway: {
      establishIdentityBarrier(_claim, snapshot) {
        harness.events.push('barrier');
        if (harness.failBarrier) {
          return Promise.reject(new Error('private barrier failure'));
        }
        harness.barriers.push(structuredClone(snapshot));
        return Promise.resolve({
          established: true,
          tombstoneVersion: 1,
          identityCount: new Set([
            snapshot.lookupCustomerId,
            ...(snapshot.canonicalCustomerId === null ? [] : [snapshot.canonicalCustomerId]),
            ...snapshot.aliases,
          ]).size,
        });
      },
      markRequestStarted() {
        harness.events.push('request_started');
        harness.markCalls += 1;
        return Promise.resolve({ requestStartedAt: DATABASE_NOW });
      },
      recordAbsenceObservation() {
        harness.events.push('absence_observation');
        harness.absenceCalls += 1;
        const forced = harness.absenceConfirmations.shift();
        if (forced === true) harness.absenceObservationCount = 2;
        else if (forced === false && harness.absenceObservationCount === 0) {
          harness.absenceObservationCount = 1;
        } else if (forced === undefined && harness.absenceObservationCount < 2) {
          harness.absenceObservationCount += 1;
        }
        const confirmed = forced ?? harness.absenceObservationCount === 2;
        return Promise.resolve({
          confirmed,
          observationCount: confirmed ? (2 as const) : (1 as const),
        });
      },
      recordOutcome(_claim, outcome) {
        harness.events.push('outcome:' + outcome.kind);
        if (harness.failRecord) {
          return Promise.reject(new Error('private record failure'));
        }
        harness.outcomes.push(structuredClone(outcome));
        return Promise.resolve();
      },
      resetAbsenceObservations() {
        harness.events.push('absence_reset');
        harness.resetAbsenceCalls += 1;
        if (harness.failReset) {
          return Promise.reject(new Error('private reset failure'));
        }
        harness.absenceObservationCount = 0;
        return Promise.resolve({ reset: true as const });
      },
    },
    network: {
      reserveMutation() {
        harness.events.push('provider_permit');
        if (harness.failPermit) {
          return Promise.reject(
            new AccountDeletionWorkerCapacityError(
              'DELETION_WORKER_PROVIDER_CAPACITY_EXHAUSTED',
            ),
          );
        }
        return Promise.resolve();
      },
      async execute(request) {
        const method = String(request.init.method);
        harness.calls.push({ method, url: request.url });
        harness.events.push('network:' + method);
        return await (responder ?? defaultResponder)(request, harness);
      },
    },
    stateStore: {
      load() {
        return Promise.resolve(harness.payload === null ? null : harness.payload.slice());
      },
      persist(_claim, plaintext) {
        persistCalls += 1;
        const state = decodeRevenueCatV2ExecutorState(plaintext);
        const fault = harness.persistFault?.(state, persistCalls) ?? null;
        if (fault === 'before') {
          return Promise.reject(new Error('private persist failure'));
        }
        harness.payload = plaintext.slice();
        harness.persisted.push(structuredClone(state));
        harness.events.push('persist:' + state.phase);
        return fault === 'after'
          ? Promise.reject(new Error('private persist failure'))
          : Promise.resolve();
      },
    },
    clock: { nowMs: () => NOW },
    maxRequests: overrides.maxRequests ?? 70,
    retryDelayMs: overrides.retryDelayMs ?? 60_000,
    deadlineReserveMs: overrides.deadlineReserveMs ?? 100,
  };
  return harness;
}

async function run(
  harness: Harness,
  claim: AccountDeletionClaim,
  deadlineAtMs = NOW + 60_000,
): Promise<void> {
  const executor = createRevenueCatV2DeletionExecutor(harness.options);
  await executor(claim, { deadlineAtMs });
}

function payloadState(harness: Harness): RevenueCatV2ExecutorState {
  assert(harness.payload !== null, 'expected persisted payload');
  return decodeRevenueCatV2ExecutorState(harness.payload);
}

async function dispatchToReconciliation(status: 200 | 202 | 404 = 200): Promise<Harness> {
  const harness = makeHarness((request, current) => {
    const method = String(request.init.method);
    if (method === 'DELETE') {
      return status === 404
        ? { status, body: providerError('resource_missing', false) }
        : {
            status,
            body: { object: 'customer', id: CUSTOMER_ID, deleted_at: DELETED_AT },
          };
    }
    const deleteSeen = current.calls.some((call) => call.method === 'DELETE');
    if (deleteSeen) {
      return { status: 404, body: providerError('resource_missing', false) };
    }
    if (request.url.endsWith('/v2/projects')) {
      return {
        status: 200,
        body: projectsBody({
          projects: [{ id: PROJECT_ID, createdAt: PROJECT_CREATED }],
          nextStartingAfter: null,
        }),
      };
    }
    if (request.url.endsWith('/aliases')) {
      return {
        status: 200,
        body: aliasPageBody({
          aliases: [
            { id: ALIAS_A, createdAt: ALIAS_A_CREATED },
            { id: ALIAS_B, createdAt: ALIAS_B_CREATED },
          ],
          nextStartingAfter: null,
        }),
      };
    }
    return { status: 200, body: customerBody() };
  });
  await run(harness, dispatchClaim());
  return harness;
}

Deno.test('credential binding is deterministic, domain-separated, and key-derived', async () => {
  const first = await deriveRevenueCatV2CredentialBinding(SECRET);
  const repeated = await deriveRevenueCatV2CredentialBinding(SECRET);
  const rotated = await deriveRevenueCatV2CredentialBinding(SECRET + '-rotated');
  assert(/^[a-f0-9]{64}$/.test(first), 'binding must be canonical SHA-256 hex');
  assert(first === repeated, 'the same key must retain resumable evidence');
  assert(first !== rotated, 'a rotated key must not merge prior observations');
  assert(!first.includes(SECRET), 'binding must not disclose the key');
  const claimBinding = await deriveRevenueCatV2ClaimBinding(dispatchClaim().claimToken);
  const repeatedClaimBinding = await deriveRevenueCatV2ClaimBinding(dispatchClaim().claimToken);
  const nextClaimBinding = await deriveRevenueCatV2ClaimBinding(nextDispatchClaim().claimToken);
  assert(claimBinding === repeatedClaimBinding, 'one claim retains one observation binding');
  assert(claimBinding !== nextClaimBinding, 'a later claim starts a fresh observation round');
  assert(claimBinding !== first, 'claim and credential fingerprints are domain-separated');
  assert(!claimBinding.includes(dispatchClaim().claimToken), 'claim binding never stores bearer');
});

Deno.test(
  'state codec is canonical, exact-key, versioned, bounded, and rejects forgery',
  async () => {
    const harness = await dispatchToReconciliation();
    const state = payloadState(harness);
    const encoded = encodeRevenueCatV2ExecutorState(state);
    assert(
      encoded.byteLength <= REVENUECAT_V2_EXECUTOR_MAX_PLAINTEXT_BYTES,
      'state must fit the encrypted plaintext ceiling',
    );
    assertDeepEqual(
      decodeRevenueCatV2ExecutorState(encoded),
      state,
      'canonical state must round-trip exactly',
    );
    const text = new TextDecoder().decode(encoded);
    assert(!text.includes(dispatchClaim().claimToken), 'state must never persist the raw claim');
    for (const forged of [
      text + ' ',
      JSON.stringify({ ...JSON.parse(text), extra: true }),
      JSON.stringify({ ...JSON.parse(text), version: 1 }),
      JSON.stringify({ ...JSON.parse(text), credentialBinding: SECRET }),
    ]) {
      await assertRejectsStable(
        () => Promise.resolve(decodeRevenueCatV2ExecutorState(new TextEncoder().encode(forged))),
        'REVENUECAT_V2_EXECUTOR_STATE_INVALID',
      );
    }
    await assertRejectsStable(
      () =>
        Promise.resolve(
          decodeRevenueCatV2ExecutorState(
            new Uint8Array(REVENUECAT_V2_EXECUTOR_MAX_PLAINTEXT_BYTES + 1),
          ),
        ),
      'REVENUECAT_V2_EXECUTOR_STATE_INVALID',
    );
  },
);

Deno.test(
  'same-key project visibility plus exact customer 404 succeeds without DELETE',
  async () => {
    const harness = makeHarness((request) => {
      if (request.url.endsWith('/v2/projects')) {
        return Promise.resolve({
          status: 200,
          body: projectsBody({
            projects: [{ id: PROJECT_ID, createdAt: PROJECT_CREATED }],
            nextStartingAfter: null,
          }),
        });
      }
      return Promise.resolve({
        status: 404,
        body: providerError('resource_missing', false),
      });
    });
    harness.absenceObservationCount = 1;
    await run(harness, dispatchClaim());
    assertDeepEqual(
      harness.outcomes,
      [
        {
          kind: 'succeeded',
          resultCode: 'REVENUECAT_V2_ALREADY_ABSENT_VERIFIED',
        },
      ],
      'only persisted project visibility plus exact absence may complete',
    );
    assert(harness.markCalls === 0, 'non-mutating success must not mark request_started');
    assert(harness.absenceCalls === 1, 'terminal state requires the database absence gate');
    assert(
      harness.calls.every((call) => call.method === 'GET'),
      'already-absent proof must remain read-only',
    );
    assertDeepEqual(
      harness.barriers[0],
      {
        version: 1,
        projectId: PROJECT_ID,
        lookupCustomerId: USER_ID,
        canonicalCustomerId: null,
        aliases: [],
      },
      'the UUID tombstone barrier must precede terminal state',
    );
    const serializedOutcome = JSON.stringify(harness.outcomes);
    assert(!serializedOutcome.includes(USER_ID), 'outcome must omit user ID');
    assert(!serializedOutcome.includes(SECRET), 'outcome must omit API secret');
  },
);

Deno.test('already-absent completion requires two fresh provider rounds', async () => {
  const harness = makeHarness((request) => {
    if (request.url.endsWith('/v2/projects')) {
      return Promise.resolve({
        status: 200,
        body: projectsBody({
          projects: [{ id: PROJECT_ID, createdAt: PROJECT_CREATED }],
          nextStartingAfter: null,
        }),
      });
    }
    return Promise.resolve({
      status: 404,
      body: providerError('resource_missing', false),
    });
  });
  harness.absenceConfirmations.push(false, true);

  await run(harness, dispatchClaim());
  assertDeepEqual(
    harness.outcomes.at(-1),
    {
      kind: 'retryable',
      resultCode: 'REVENUECAT_V2_QUIESCENCE_PENDING',
      retryAt: '2026-07-13T12:06:00.000Z',
    },
    'first full absence round must remain nonterminal',
  );
  assert(payloadState(harness).phase === 'preflight', 'second round must start from fresh reads');
  const firstRoundCalls = harness.calls.length;

  await run(harness, dispatchClaim(true));
  assert(
    harness.calls.length === firstRoundCalls * 2,
    'second round must repeat every provider read',
  );
  assert(harness.absenceCalls === 2, 'both complete rounds must reach the database clock gate');
  assert(
    harness.outcomes.at(-1)?.resultCode === 'REVENUECAT_V2_ALREADY_ABSENT_VERIFIED',
    'only the confirmed second round may complete',
  );
  assert(
    harness.calls.every((call) => call.method === 'GET'),
    'absence proof stays read-only',
  );
});

Deno.test('already-absent terminal CAS crash forces an extra fresh provider round', async () => {
  const harness = makeHarness((request) => {
    if (request.url.endsWith('/v2/projects')) {
      return Promise.resolve({
        status: 200,
        body: projectsBody({
          projects: [{ id: PROJECT_ID, createdAt: PROJECT_CREATED }],
          nextStartingAfter: null,
        }),
      });
    }
    return Promise.resolve({
      status: 404,
      body: providerError('resource_missing', false),
    });
  });
  harness.absenceObservationCount = 1;
  harness.failRecord = true;
  try {
    await run(harness, dispatchClaim());
    throw new Error('expected terminal CAS crash');
  } catch (error) {
    assert(!(error instanceof RevenueCatV2DeletionExecutorError), 'expected gateway crash');
  }
  assert(
    payloadState(harness).phase === 'preflight',
    'consumed evidence must not remain replayable after the DB observation',
  );
  harness.failRecord = false;
  const callsBeforeResume = harness.calls.length;
  await run(harness, dispatchClaim(true));
  assert(
    harness.calls.length === callsBeforeResume * 2,
    'resume must repeat provider reads when terminal CAS was not durable',
  );
  assert(
    harness.outcomes.at(-1)?.resultCode === 'REVENUECAT_V2_ALREADY_ABSENT_VERIFIED',
    'resume must use the same attester',
  );
});

Deno.test('project and alias pagination resume from every persisted cursor', async () => {
  const otherProject = 'proj_other_1';
  const harness = makeHarness(
    (request) => {
      const url = new URL(request.url);
      if (url.pathname === '/v2/projects') {
        const cursor = url.searchParams.get('starting_after');
        return Promise.resolve(
          cursor === null
            ? {
                status: 200,
                body: projectsBody({
                  projects: [{ id: otherProject, createdAt: PROJECT_CREATED }],
                  nextStartingAfter: otherProject,
                }),
              }
            : {
                status: 200,
                body: projectsBody({
                  projects: [{ id: PROJECT_ID, createdAt: PROJECT_CREATED }],
                  nextStartingAfter: null,
                }),
              },
        );
      }
      if (String(request.init.method) === 'DELETE') {
        return Promise.resolve({
          status: 202,
          body: { object: 'customer', id: CUSTOMER_ID, deleted_at: DELETED_AT },
        });
      }
      if (url.pathname.endsWith('/aliases')) {
        const cursor = url.searchParams.get('starting_after');
        return Promise.resolve(
          cursor === null
            ? {
                status: 200,
                body: aliasPageBody({
                  aliases: [{ id: ALIAS_A, createdAt: ALIAS_A_CREATED }],
                  nextStartingAfter: ALIAS_A,
                }),
              }
            : {
                status: 200,
                body: aliasPageBody({
                  aliases: [{ id: ALIAS_B, createdAt: ALIAS_B_CREATED }],
                  nextStartingAfter: null,
                }),
              },
        );
      }
      return Promise.resolve({ status: 200, body: customerBody() });
    },
    { maxRequests: 1 },
  );

  for (let attempt = 0; attempt < 5; attempt += 1) {
    await run(harness, dispatchClaim(attempt > 0));
  }
  const state = payloadState(harness);
  assert(state.phase === 'ready', 'bounded invocations must reach durable ready state');
  assert(state.preflightEvidence.aliasPageCount === 2, 'both pages must survive resume');
  assertDeepEqual(
    state.preflightEvidence.aliases.map((alias) => alias.id),
    [ALIAS_A, ALIAS_B],
    'resume must not lose or duplicate aliases',
  );
  await run(harness, dispatchClaim(true));
  assert(
    payloadState(harness).phase === 'reconciling',
    'a later invocation may dispatch only from persisted ready state',
  );
  const projectCalls = harness.calls.filter(
    (call) => new URL(call.url).pathname === '/v2/projects',
  );
  assert(projectCalls.length === 2, 'validated project cursor must resume exactly');
  const aliasCalls = harness.calls.filter((call) =>
    new URL(call.url).pathname.endsWith('/aliases'),
  );
  assert(aliasCalls.length === 2, 'validated alias cursor must resume exactly');
});

Deno.test('found-customer pagination progresses across more than twenty distinct claims', async () => {
  const projectPages = 25;
  const harness = makeHarness(
    (request) => {
      const method = String(request.init.method);
      const url = new URL(request.url);
      if (url.pathname === '/v2/projects') {
        const cursor = url.searchParams.get('starting_after');
        const page = cursor === null ? 0 : Number(cursor.slice('page-project-'.length)) + 1;
        const id = page === projectPages - 1 ? PROJECT_ID : `page-project-${page}`;
        return {
          status: 200,
          body: projectsBody({
            projects: [{ id, createdAt: PROJECT_CREATED }],
            nextStartingAfter: page === projectPages - 1 ? null : id,
          }),
        };
      }
      if (method === 'DELETE') {
        return {
          status: 200,
          body: { object: 'customer', id: CUSTOMER_ID, deleted_at: DELETED_AT },
        };
      }
      if (url.pathname.endsWith('/aliases')) {
        return { status: 200, body: aliasPageBody({ aliases: [], nextStartingAfter: null }) };
      }
      return { status: 200, body: customerBody() };
    },
    { maxRequests: 1 },
  );

  for (let attempt = 1; attempt <= projectPages + 3; attempt += 1) {
    await run(harness, dispatchClaimForAttempt(attempt));
  }
  assert(payloadState(harness).phase === 'reconciling', 'pagination must eventually dispatch');
  assert(
    harness.calls.filter((call) => new URL(call.url).pathname === '/v2/projects').length ===
      projectPages,
    'each project page is fetched exactly once despite claim rotation',
  );
  assert(
    harness.calls.filter((call) => call.method === 'DELETE').length === 1,
    'completed found-customer evidence dispatches only once',
  );
});

Deno.test('one claim can verify the maximum encoded RevenueCat identity family', async () => {
  const aliases = Array.from({ length: 64 }, (_value, index) => ({
    id: `legacy_alias_${index.toString().padStart(2, '0')}`,
    createdAt: ALIAS_A_CREATED + index,
  }));
  const harness = makeHarness(
    (request, current) => {
      const method = String(request.init.method);
      const url = new URL(request.url);
      if (url.pathname === '/v2/projects') {
        return {
          status: 200,
          body: projectsBody({
            projects: [{ id: PROJECT_ID, createdAt: PROJECT_CREATED }],
            nextStartingAfter: null,
          }),
        };
      }
      if (method === 'DELETE') {
        return {
          status: 200,
          body: { object: 'customer', id: CUSTOMER_ID, deleted_at: DELETED_AT },
        };
      }
      if (current.calls.some((call) => call.method === 'DELETE')) {
        return { status: 404, body: providerError('resource_missing', false) };
      }
      if (url.pathname.endsWith('/aliases')) {
        const cursor = url.searchParams.get('starting_after');
        const start = cursor === null ? 0 : aliases.findIndex((alias) => alias.id === cursor) + 1;
        const page = aliases.slice(start, start + 20);
        const hasMore = start + page.length < aliases.length;
        return {
          status: 200,
          body: aliasPageBody({
            aliases: page,
            nextStartingAfter: hasMore ? page.at(-1)!.id : null,
          }),
        };
      }
      return { status: 200, body: customerBody() };
    },
    { maxRequests: 70 },
  );

  await run(harness, dispatchClaim());
  const dispatched = payloadState(harness);
  assert(dispatched.phase === 'reconciling', 'maximum family reaches reconciliation');
  assert(
    dispatched.preflightEvidence.aliases.length === 64,
    'all accepted aliases remain in the durable family',
  );
  let simulatedNow = NOW;
  let flushScheduled = false;
  const pendingResponses: Array<(response: RevenueCatV2NetworkResponse) => void> = [];
  harness.options.clock = { nowMs: () => simulatedNow };
  harness.options.network.execute = (request) => {
    const method = String(request.init.method);
    harness.calls.push({ method, url: request.url });
    harness.events.push('network:' + method);
    return new Promise((resolve) => {
      pendingResponses.push(resolve);
      if (flushScheduled) return;
      flushScheduled = true;
      queueMicrotask(() => {
        const currentBatch = pendingResponses.splice(0);
        simulatedNow += REVENUECAT_V2_MAX_NETWORK_TIMEOUT_MS;
        flushScheduled = false;
        for (const complete of currentBatch) {
          complete({ status: 404, body: providerError('resource_missing', false) });
        }
      });
    });
  };
  harness.absenceObservationCount = 1;
  const callsBeforeRound = harness.calls.length;
  await run(harness, nextReconcileClaim(), NOW + 90_000);
  const roundCalls = harness.calls.slice(callsBeforeRound);
  assert(roundCalls.length === 67, '66 customer identities plus aliases endpoint fit one claim');
  assert(roundCalls.every((call) => call.method === 'GET'), 'maximum round is read-only');
  assert(
    simulatedNow - NOW === 60_000,
    'fourteen-wide batches complete 67 reads at the maximum allowed latency inside the claim',
  );
  assert(
    REVENUECAT_V2_MAX_RECONCILIATION_CONCURRENCY === 14,
    'the tested concurrency is the runtime executor bound',
  );
  assert(
    harness.outcomes.at(-1)?.resultCode === 'REVENUECAT_V2_DELETION_VERIFIED',
    'maximum bounded family can reach the second absence observation',
  );
});

Deno.test('a response that reaches the worker deadline cannot record DB absence', async () => {
  const harness = await dispatchToReconciliation();
  harness.absenceObservationCount = 1;
  const deadlineAtMs = NOW + 1_000;
  let simulatedNow = NOW;
  harness.options.clock = { nowMs: () => simulatedNow };
  harness.options.network.execute = (request) => {
    const method = String(request.init.method);
    harness.calls.push({ method, url: request.url });
    harness.events.push('network:' + method);
    if (request.url.endsWith('/aliases')) simulatedNow = deadlineAtMs;
    return Promise.resolve({
      status: 404,
      body: providerError('resource_missing', false),
    });
  };
  await run(harness, reconcileClaim(), deadlineAtMs);
  assert(harness.absenceCalls === 0, 'deadline-crossing round never reaches DB observation RPC');
  assert(harness.absenceObservationCount === 1, 'earlier DB round remains unchanged');
  const state = payloadState(harness);
  assert(state.phase === 'reconciling', 'deadline exhaustion remains reconciliation-only');
  assert(state.providerProbeInFlight, 'write-ahead marker preserves conservative recovery');
  assert(
    !harness.outcomes.some(
      (outcome) => outcome.resultCode === 'REVENUECAT_V2_DELETION_VERIFIED',
    ),
    'deadline-crossing evidence cannot complete deletion',
  );
});

Deno.test(
  '200, 202, and 404 acknowledgements persist before reconciliation transition',
  async () => {
    const expectations = [
      [200, 'REVENUECAT_V2_DELETE_ACKNOWLEDGED', DELETED_AT],
      [202, 'REVENUECAT_V2_DELETE_QUEUED', DELETED_AT],
      [404, 'REVENUECAT_V2_DELETE_ABSENT_RECONCILE', null],
    ] as const;
    for (const [status, resultCode, deletedAt] of expectations) {
      const harness = await dispatchToReconciliation(status);
      const state = payloadState(harness);
      assert(state.phase === 'reconciling', String(status) + ' must be nonterminal');
      assertDeepEqual(
        state.dispatchEvidence,
        {
          persisted: true,
          requestStartedAt: NOW_ISO,
          resultCode,
          deletedAt,
        },
        String(status) + ' acknowledgement must be exact and durable',
      );
      assertDeepEqual(
        harness.outcomes,
        [{ kind: 'ambiguous', resultCode }],
        'database transition must select reconciliation-only',
      );
      const barrierIndex = harness.events.indexOf('barrier');
      const startedIndex = harness.events.indexOf('request_started');
      const deleteIndex = harness.events.indexOf('network:DELETE');
      const evidenceIndex = harness.events.lastIndexOf('persist:reconciling');
      const outcomeIndex = harness.events.indexOf('outcome:ambiguous');
      assert(
        barrierIndex < startedIndex &&
          startedIndex + 1 === deleteIndex &&
          deleteIndex < evidenceIndex &&
          evidenceIndex < outcomeIndex,
        'barrier, request-start, DELETE, evidence, and transition order is strict',
      );
    }
  },
);

Deno.test(
  'post-send transport ambiguity persists evidence and never redispatches DELETE',
  async () => {
    let throwDelete = true;
    const harness = makeHarness((request, current) => {
      const method = String(request.init.method);
      if (method === 'DELETE' && throwDelete) {
        throwDelete = false;
        return Promise.reject(new Error('private ' + USER_ID + ' ' + SECRET));
      }
      if (current.calls.some((call) => call.method === 'DELETE')) {
        return Promise.resolve({
          status: 404,
          body: providerError('resource_missing', false),
        });
      }
      if (request.url.endsWith('/v2/projects')) {
        return Promise.resolve({
          status: 200,
          body: projectsBody({
            projects: [{ id: PROJECT_ID, createdAt: PROJECT_CREATED }],
            nextStartingAfter: null,
          }),
        });
      }
      if (request.url.endsWith('/aliases')) {
        return Promise.resolve({
          status: 200,
          body: aliasPageBody({ aliases: [], nextStartingAfter: null }),
        });
      }
      return Promise.resolve({ status: 200, body: customerBody() });
    });
    harness.absenceObservationCount = 1;
    await run(harness, dispatchClaim());
    const ambiguous = payloadState(harness);
    assert(ambiguous.phase === 'reconciling', 'transport failure must persist ambiguity');
    assert(
      ambiguous.dispatchEvidence.resultCode === 'REVENUECAT_V2_DISPATCH_AMBIGUOUS',
      'post-send failure must be reconciliation-only',
    );
    const callsBeforeResume = harness.calls.length;
    await run(harness, reconcileClaim());
    assert(
      harness.calls.filter((call) => call.method === 'DELETE').length === 1,
      'reconciliation must never blindly redispatch DELETE',
    );
    assert(
      harness.calls.slice(callsBeforeResume).every((call) => call.method === 'GET'),
      'all post-ambiguity provider requests must be GET',
    );
    assert(
      harness.outcomes.at(-1)?.resultCode === 'REVENUECAT_V2_DELETION_VERIFIED',
      'full read-only absence must terminate',
    );
    assert(!JSON.stringify(harness.outcomes).includes(USER_ID), 'results omit IDs');
    assert(!JSON.stringify(harness.outcomes).includes(SECRET), 'results omit secrets');
  },
);

Deno.test('crash after request_started but before dispatch evidence resumes GET-only', async () => {
  const harness = makeHarness();
  harness.persistFault = (state) => (state.phase === 'reconciling' ? 'before' : null);
  try {
    await run(harness, dispatchClaim());
    throw new Error('expected simulated crash');
  } catch (error) {
    assert(!(error instanceof RevenueCatV2DeletionExecutorError), 'expected adapter crash');
  }
  assert(payloadState(harness).phase === 'ready', 'ready preflight must survive');
  assert(harness.markCalls === 1, 'request_started was durably committed');
  harness.persistFault = null;
  const callsBeforeResume = harness.calls.length;
  await run(harness, reconcileClaim());
  assert(
    harness.calls.slice(callsBeforeResume).every((call) => call.method === 'GET'),
    'missing dispatch evidence must synthesize ambiguity and use GET only',
  );
  assert(
    harness.calls.filter((call) => call.method === 'DELETE').length === 1,
    'DELETE must remain single-dispatch',
  );
});

Deno.test('crash after dispatch evidence persistence resumes without mutation', async () => {
  const harness = makeHarness();
  harness.failRecord = true;
  try {
    await run(harness, dispatchClaim());
    throw new Error('expected simulated transition crash');
  } catch (error) {
    assert(!(error instanceof RevenueCatV2DeletionExecutorError), 'expected gateway crash');
  }
  assert(
    payloadState(harness).phase === 'reconciling',
    'dispatch evidence must survive transition crash',
  );
  harness.failRecord = false;
  const callsBeforeResume = harness.calls.length;
  await run(harness, reconcileClaim());
  assert(
    harness.calls.slice(callsBeforeResume).every((call) => call.method === 'GET'),
    'persisted dispatch evidence must resume reconciliation only',
  );
});

Deno.test('an interrupted reconciliation probe resets and repeats the full round', async () => {
  const harness = await dispatchToReconciliation();
  harness.absenceObservationCount = 1;
  let reconciliationWrites = 0;
  harness.persistFault = (state) => {
    if (state.phase !== 'reconciling') return null;
    const observed = state.customerObservations.filter((entry) => entry !== null).length;
    if (observed > 0) reconciliationWrites += 1;
    return observed === 4 &&
        state.aliasesObservation !== null &&
        !state.providerProbeInFlight
      ? 'before'
      : null;
  };
  const callsBefore = harness.calls.length;
  try {
    await run(harness, reconcileClaim());
    throw new Error('expected partial persistence crash');
  } catch (error) {
    assert(!(error instanceof RevenueCatV2DeletionExecutorError), 'expected state-store crash');
  }
  const partial = payloadState(harness);
  assert(partial.phase === 'reconciling', 'partial state remains reconciling');
  assert(
    partial.customerObservations.filter((entry) => entry !== null).length === 4 &&
      partial.providerProbeInFlight,
    'completed batch plus write-ahead alias probe survive',
  );
  assert(reconciliationWrites >= 2, 'fault must occur on a later observation');
  harness.persistFault = null;
  const firstTargetUrl = harness.calls[callsBefore].url;
  const callsBeforeResume = harness.calls.length;
  await run(harness, reconcileClaim());
  assert(
    harness.calls.slice(callsBeforeResume).some((call) => call.url === firstTargetUrl),
    'uncertain in-flight probe must reset and repeat the complete family',
  );
  assertDeepEqual(
    harness.outcomes.at(-1),
    {
      kind: 'retryable',
      resultCode: 'REVENUECAT_V2_QUIESCENCE_PENDING',
      retryAt: '2026-07-13T12:06:00.000Z',
    },
    'the repeated round starts a fresh database quorum',
  );
});

Deno.test('a later reconciliation claim discards every partial target observation', async () => {
  const harness = await dispatchToReconciliation();
  let reconciliationWrites = 0;
  harness.persistFault = (state) => {
    if (state.phase !== 'reconciling') return null;
    const observed = state.customerObservations.filter((entry) => entry !== null).length;
    if (observed > 0) reconciliationWrites += 1;
    return observed === 4 &&
        state.aliasesObservation === null &&
        !state.providerProbeInFlight
      ? 'after'
      : null;
  };
  const callsBeforeFirstRound = harness.calls.length;
  try {
    await run(harness, reconcileClaim());
    throw new Error('expected partial persistence crash');
  } catch (error) {
    assert(!(error instanceof RevenueCatV2DeletionExecutorError), 'expected state-store crash');
  }
  assert(reconciliationWrites >= 1, 'first claim must persist one complete customer batch');
  const firstTargetUrl = harness.calls[callsBeforeFirstRound]?.url;
  assert(typeof firstTargetUrl === 'string', 'first target request must be recorded');

  harness.persistFault = null;
  let firstTargetReappeared = false;
  harness.options.network.execute = (request) => {
    const method = String(request.init.method);
    harness.calls.push({ method, url: request.url });
    if (request.url === firstTargetUrl) {
      firstTargetReappeared = true;
      return Promise.resolve({ status: 200, body: customerBody() });
    }
    return Promise.resolve({
      status: 404,
      body: providerError('resource_missing', false),
    });
  };
  const callsBeforeNextClaim = harness.calls.length;
  await run(harness, nextReconcileClaim());
  assert(firstTargetReappeared, 'new claim must re-read the first persisted target');
  assert(
    harness.calls.slice(callsBeforeNextClaim).some((call) => call.url === firstTargetUrl),
    'old claim evidence cannot skip a target in the new round',
  );
  assert(
    harness.outcomes.at(-1)?.resultCode === 'REVENUECAT_V2_CUSTOMER_STILL_PRESENT',
    'reappearance must prevent terminal absence',
  );
  assert(
    !harness.outcomes.some((outcome) => outcome.resultCode === 'REVENUECAT_V2_DELETION_VERIFIED'),
    'mixed-claim evidence must never complete deletion',
  );
});

Deno.test('a persisted already-absent 404 is re-read under a later claim', async () => {
  let providerPresent = false;
  const harness = makeHarness((request) => {
    if (request.url.endsWith('/v2/projects')) {
      return {
        status: 200,
        body: projectsBody({
          projects: [{ id: PROJECT_ID, createdAt: PROJECT_CREATED }],
          nextStartingAfter: null,
        }),
      };
    }
    if (providerPresent) return { status: 200, body: customerBody() };
    return { status: 404, body: providerError('resource_missing', false) };
  });
  harness.persistFault = (state) => (state.phase === 'already_absent' ? 'after' : null);
  try {
    await run(harness, dispatchClaim());
    throw new Error('expected crash after persisted absence');
  } catch (error) {
    assert(!(error instanceof RevenueCatV2DeletionExecutorError), 'expected state-store crash');
  }
  assert(payloadState(harness).phase === 'already_absent', 'old 404 must be persisted');
  assert(harness.absenceCalls === 0, 'crash happens before database observation');

  providerPresent = true;
  harness.persistFault = null;
  harness.options.maxRequests = 1;
  const callsBefore = harness.calls.length;
  await run(harness, nextDispatchClaim());
  const nextCalls = harness.calls.slice(callsBefore);
  assert(nextCalls.length === 1 && nextCalls[0].method === 'GET', 'new claim re-reads customer');
  assert(!nextCalls[0].url.endsWith('/v2/projects'), 'completed project visibility is retained');
  assert(harness.absenceCalls === 0, 'old 404 cannot become a fresh database observation');
  assert(
    !harness.outcomes.some(
      (outcome) => outcome.resultCode === 'REVENUECAT_V2_ALREADY_ABSENT_VERIFIED',
    ),
    'reappeared customer blocks already-absent completion',
  );
});

Deno.test('a present family member resets observation round and schedules retry', async () => {
  const harness = await dispatchToReconciliation();
  let customerGets = 0;
  harness.options.network.execute = (request) => {
    harness.calls.push({
      method: String(request.init.method),
      url: request.url,
    });
    if (request.url.endsWith('/aliases')) {
      return Promise.resolve({
        status: 404,
        body: providerError('resource_missing', false),
      });
    }
    customerGets += 1;
    return Promise.resolve(
      customerGets === 1
        ? { status: 200, body: customerBody() }
        : { status: 404, body: providerError('resource_missing', false) },
    );
  };
  await run(harness, reconcileClaim());
  assertDeepEqual(
    harness.outcomes.at(-1),
    {
      kind: 'retryable',
      resultCode: 'REVENUECAT_V2_CUSTOMER_STILL_PRESENT',
      retryAt: '2026-07-13T12:06:00.000Z',
    },
    'presence must be nonterminal and delayed',
  );
  const reset = payloadState(harness);
  assert(reset.phase === 'reconciling', 'round remains reconciliation-only');
  assert(
    reset.customerObservations.every((entry) => entry === null) &&
      reset.aliasesObservation === null,
    'next claim must perform a fresh full observation round',
  );
  assert(harness.resetAbsenceCalls === 1, 'provider presence clears DB absence evidence');
});

Deno.test(
  'a provider reappearance keeps the database reset durable across failures and claim rotation',
  async () => {
    const harness = await dispatchToReconciliation();
    harness.absenceObservationCount = 1;
    let providerPresent = true;
    harness.options.network.execute = (request) => {
      harness.calls.push({ method: String(request.init.method), url: request.url });
      if (providerPresent && !request.url.endsWith('/aliases')) {
        providerPresent = false;
        return Promise.resolve({ status: 200, body: customerBody() });
      }
      return Promise.resolve({
        status: 404,
        body: providerError('resource_missing', false),
      });
    };

    harness.failReset = true;
    try {
      await run(harness, reconcileClaim());
      throw new Error('expected database reset failure');
    } catch (error) {
      assert(!(error instanceof RevenueCatV2DeletionExecutorError), 'expected gateway failure');
    }
    const persistedPresence = payloadState(harness);
    assert(persistedPresence.phase === 'reconciling', 'presence remains reconciliation-only');
    assert(
      persistedPresence.presenceResetRequired,
      'provider presence must durably require a database reset',
    );
    assert(harness.absenceObservationCount === 1, 'failed reset retains prior DB observation');

    const rotatedClaim = nextReconcileClaim();
    const callsBeforeRotatedReset = harness.calls.length;
    try {
      await run(harness, rotatedClaim);
      throw new Error('expected rotated-claim reset failure');
    } catch (error) {
      assert(!(error instanceof RevenueCatV2DeletionExecutorError), 'expected gateway failure');
    }
    assert(
      harness.calls.length === callsBeforeRotatedReset,
      'a later claim must reset old DB evidence before reading the provider',
    );

    harness.failReset = false;
    harness.persistFault = (state) =>
      state.phase === 'reconciling' &&
        !state.presenceResetRequired &&
        state.customerObservations.every((entry) => entry === null) &&
        state.aliasesObservation === null
        ? 'before'
        : null;
    try {
      await run(harness, rotatedClaim);
      throw new Error('expected crash after database reset');
    } catch (error) {
      assert(!(error instanceof RevenueCatV2DeletionExecutorError), 'expected state-store crash');
    }
    assert(
      Number(harness.absenceObservationCount) === 0,
      'successful reset clears prior DB observation',
    );
    const afterResetCrash = payloadState(harness);
    assert(afterResetCrash.phase === 'reconciling', 'crash remains reconciliation-only');
    assert(
      afterResetCrash.presenceResetRequired,
      'reset is replayed when clearing the durable flag did not persist',
    );

    harness.persistFault = null;
    await run(harness, rotatedClaim);
    assert(harness.resetAbsenceCalls === 4, 'idempotent reset is replayed through both failures');
    assert(harness.absenceObservationCount === 1, 'fresh absence round starts again at one');
    assertDeepEqual(
      harness.outcomes.at(-1),
      {
        kind: 'retryable',
        resultCode: 'REVENUECAT_V2_QUIESCENCE_PENDING',
        retryAt: '2026-07-13T12:06:00.000Z',
      },
      'one post-reset round cannot complete deletion',
    );
    assert(
      !harness.outcomes.some(
        (outcome) => outcome.resultCode === 'REVENUECAT_V2_DELETION_VERIFIED',
      ),
      'pre-reset and post-reset absence evidence must never combine',
    );
  },
);

Deno.test(
  'an already-absent round is reset before deleting a reappeared customer',
  async () => {
    let providerPresent = false;
    const harness = makeHarness((request) => {
      const method = String(request.init.method);
      if (request.url.endsWith('/v2/projects')) {
        return {
          status: 200,
          body: projectsBody({
            projects: [{ id: PROJECT_ID, createdAt: PROJECT_CREATED }],
            nextStartingAfter: null,
          }),
        };
      }
      if (method === 'DELETE') {
        providerPresent = false;
        return {
          status: 200,
          body: { object: 'customer', id: CUSTOMER_ID, deleted_at: DELETED_AT },
        };
      }
      if (!providerPresent) {
        return { status: 404, body: providerError('resource_missing', false) };
      }
      if (request.url.endsWith('/aliases')) {
        return {
          status: 200,
          body: aliasPageBody({ aliases: [], nextStartingAfter: null }),
        };
      }
      return { status: 200, body: customerBody() };
    });

    await run(harness, dispatchClaim());
    assert(harness.absenceObservationCount === 1, 'initial absence records round one');
    const afterInitialAbsence = payloadState(harness);
    assert(afterInitialAbsence.phase === 'preflight', 'next absence round starts preflight');
    assert(
      afterInitialAbsence.priorAbsenceObservation,
      'state remembers that a database absence may have been recorded',
    );

    providerPresent = true;
    harness.failReset = true;
    try {
      await run(harness, nextDispatchClaim());
      throw new Error('expected reset-before-delete failure');
    } catch (error) {
      assert(!(error instanceof RevenueCatV2DeletionExecutorError), 'expected gateway failure');
    }
    assert(
      harness.calls.every((call) => call.method !== 'DELETE'),
      'reappeared customer cannot be deleted before the database reset',
    );
    const foundBeforeReset = payloadState(harness);
    assert(foundBeforeReset.phase === 'preflight', 'found evidence remains resumable');
    assert(foundBeforeReset.customerSnapshot?.kind === 'found', 'reappearance is persisted');
    assert(foundBeforeReset.priorAbsenceObservation, 'failed reset remains durably required');

    harness.failReset = false;
    await run(harness, nextDispatchClaim());
    assert(
      Number(harness.absenceObservationCount) === 0,
      'successful reset clears the old round',
    );
    assert(
      harness.calls.filter((call) => call.method === 'DELETE').length === 1,
      'DELETE is dispatched once only after reset persistence',
    );

    await run(harness, reconcileClaim());
    assert(harness.absenceObservationCount === 1, 'first post-delete absence is nonterminal');
    assertDeepEqual(
      harness.outcomes.at(-1),
      {
        kind: 'retryable',
        resultCode: 'REVENUECAT_V2_QUIESCENCE_PENDING',
        retryAt: '2026-07-13T12:06:00.000Z',
      },
      'old and post-delete absence rounds cannot combine',
    );

    await run(harness, nextReconcileClaim());
    assert(
      Number(harness.absenceObservationCount) === 2,
      'second fresh round reaches quorum',
    );
    assertDeepEqual(
      harness.outcomes.at(-1),
      { kind: 'succeeded', resultCode: 'REVENUECAT_V2_DELETION_VERIFIED' },
      'only two post-reset rounds complete deletion',
    );
  },
);

Deno.test(
  'a crash before persisting a preflight reappearance resets before the next probe',
  async () => {
    let providerPresent = false;
    const harness = makeHarness((request) => {
      if (request.url.endsWith('/v2/projects')) {
        return {
          status: 200,
          body: projectsBody({
            projects: [{ id: PROJECT_ID, createdAt: PROJECT_CREATED }],
            nextStartingAfter: null,
          }),
        };
      }
      return providerPresent
        ? { status: 200, body: customerBody() }
        : { status: 404, body: providerError('resource_missing', false) };
    });
    await run(harness, dispatchClaim());
    assert(harness.absenceObservationCount === 1, 'first absence reaches the database');

    providerPresent = true;
    harness.persistFault = (state) =>
      state.phase === 'preflight' &&
        state.customerSnapshot?.kind === 'found' &&
        !state.providerProbeInFlight
        ? 'before'
        : null;
    try {
      await run(harness, nextDispatchClaim());
      throw new Error('expected response-persistence crash');
    } catch (error) {
      assert(!(error instanceof RevenueCatV2DeletionExecutorError), 'expected state-store crash');
    }
    const uncertain = payloadState(harness);
    assert(uncertain.phase === 'preflight', 'uncertain response remains preflight');
    assert(uncertain.providerProbeInFlight, 'write-ahead probe marker survives the crash');
    assert(uncertain.customerSnapshot === null, 'uncommitted presence is not treated as evidence');

    providerPresent = false;
    harness.persistFault = null;
    const eventsBeforeRetry = harness.events.length;
    await run(harness, nextDispatchClaim());
    const retryEvents = harness.events.slice(eventsBeforeRetry);
    assert(
      retryEvents.indexOf('absence_reset') >= 0 &&
        retryEvents.indexOf('absence_reset') < retryEvents.indexOf('network:GET'),
      'database reset must precede the next provider read',
    );
    assert(harness.absenceObservationCount === 1, 'new 404 begins a fresh database round');
    assert(
      harness.outcomes.at(-1)?.resultCode === 'REVENUECAT_V2_QUIESCENCE_PENDING',
      'the pre-crash round cannot combine with the later 404',
    );
    assert(
      harness.calls.every((call) => call.method !== 'DELETE'),
      'lost presence response cannot lead to mutation or false completion',
    );
  },
);

Deno.test(
  'a crash before persisting reconciliation presence resets before a later absence round',
  async () => {
    const harness = await dispatchToReconciliation();
    harness.absenceObservationCount = 1;
    let providerPresent = true;
    harness.options.network.execute = (request) => {
      const method = String(request.init.method);
      harness.calls.push({ method, url: request.url });
      harness.events.push('network:' + method);
      if (providerPresent) {
        providerPresent = false;
        return Promise.resolve({ status: 200, body: customerBody() });
      }
      return Promise.resolve({
        status: 404,
        body: providerError('resource_missing', false),
      });
    };
    harness.persistFault = (state) =>
      state.phase === 'reconciling' &&
        !state.providerProbeInFlight &&
        state.customerObservations.some((entry) => entry?.kind === 'present')
        ? 'before'
        : null;
    try {
      await run(harness, reconcileClaim());
      throw new Error('expected response-persistence crash');
    } catch (error) {
      assert(!(error instanceof RevenueCatV2DeletionExecutorError), 'expected state-store crash');
    }
    const uncertain = payloadState(harness);
    assert(uncertain.phase === 'reconciling', 'uncertain response remains reconciling');
    assert(uncertain.providerProbeInFlight, 'write-ahead probe marker survives the crash');
    assert(!uncertain.presenceResetRequired, 'uncommitted response is not forged as evidence');

    harness.persistFault = null;
    const eventsBeforeRetry = harness.events.length;
    await run(harness, nextReconcileClaim());
    const retryEvents = harness.events.slice(eventsBeforeRetry);
    assert(
      retryEvents.indexOf('absence_reset') >= 0 &&
        retryEvents.indexOf('absence_reset') < retryEvents.indexOf('network:GET'),
      'database reset must precede the next reconciliation read',
    );
    assert(harness.absenceObservationCount === 1, 'later absence begins a fresh DB round');
    assert(
      harness.outcomes.at(-1)?.resultCode === 'REVENUECAT_V2_QUIESCENCE_PENDING',
      'lost presence response cannot combine old and new absence evidence',
    );
  },
);

Deno.test('deadline and request budget stop provider calls and schedule safe retries', async () => {
  const deadlineHarness = makeHarness();
  await run(deadlineHarness, dispatchClaim(), NOW + 100);
  assert(deadlineHarness.calls.length === 0, 'deadline reserve prevents network');
  assertDeepEqual(
    deadlineHarness.outcomes,
    [
      {
        kind: 'retryable',
        resultCode: 'REVENUECAT_V2_PROJECT_ATTESTATION_RETRY',
        retryAt: '2026-07-13T12:06:00.000Z',
      },
    ],
    'deadline exhaustion releases safe dispatch lease',
  );

  const budgetHarness = makeHarness(undefined, { maxRequests: 1 });
  await run(budgetHarness, dispatchClaim());
  assert(budgetHarness.calls.length === 1, 'per-claim request cap is exact');
  assert(
    budgetHarness.outcomes.at(-1)?.kind === 'retryable',
    'bounded preflight must schedule resume',
  );
});

Deno.test('provider Retry-After and backoff_ms extend retry scheduling', async () => {
  for (const [status, type, bodyDelayMs, headerDelayMs] of [
    [429, 'rate_limit_error', 300_000, 120_000],
    [423, 'resource_locked_error', 180_000, null],
    [503, 'server_error', 90_000, 600_000],
  ] as const) {
    const harness = makeHarness(() =>
      Promise.resolve({
        status,
        body: providerError(type, true, bodyDelayMs),
        retryAfterMs: headerDelayMs,
      }),
    );
    await run(harness, dispatchClaim());
    const expectedDelay = Math.max(60_000, bodyDelayMs, headerDelayMs ?? 0);
    assertDeepEqual(
      harness.outcomes.at(-1),
      {
        kind: 'retryable',
        resultCode: 'REVENUECAT_V2_PROJECT_ATTESTATION_RETRY',
        retryAt: new Date(NOW + expectedDelay).toISOString(),
      },
      `${status} honors the longest attested provider delay`,
    );
  }

  const malformed = makeHarness(() =>
    Promise.resolve({
      status: 429,
      body: { ...providerError('rate_limit_error', true), backoff_ms: 'private-invalid' },
      retryAfterMs: null,
    }),
  );
  await run(malformed, dispatchClaim());
  assert(
    malformed.outcomes.at(-1)?.kind === 'action_required',
    'malformed provider backoff cannot steer scheduling',
  );
});

Deno.test('concurrent reconciliation honors the longest provider backoff', async () => {
  const harness = await dispatchToReconciliation();
  let requestIndex = 0;
  const responses: RevenueCatV2NetworkResponse[] = [
    {
      status: 429,
      body: providerError('rate_limit_error', true, 90_000),
      retryAfterMs: 120_000,
    },
    {
      status: 423,
      body: providerError('resource_locked_error', true, 600_000),
      retryAfterMs: null,
    },
    {
      status: 503,
      body: providerError('server_error', true, 300_000),
      retryAfterMs: 180_000,
    },
    { status: 404, body: providerError('resource_missing', false), retryAfterMs: null },
  ];
  harness.options.network.execute = (request) => {
    const method = String(request.init.method);
    harness.calls.push({ method, url: request.url });
    harness.events.push('network:' + method);
    const response = responses[requestIndex];
    requestIndex += 1;
    if (response === undefined) throw new Error('unexpected extra provider request');
    return Promise.resolve(response);
  };
  await run(harness, reconcileClaim());
  assertDeepEqual(
    harness.outcomes.at(-1),
    {
      kind: 'retryable',
      resultCode: 'REVENUECAT_V2_RECONCILIATION_RETRY',
      retryAt: new Date(NOW + 600_000).toISOString(),
    },
    'batch scheduling uses the maximum attested delay, independent of target order',
  );
  assert(requestIndex === 4, 'the complete parallel batch settles before scheduling retry');
});

Deno.test(
  'credential drift, malformed evidence, and forged payload become action_required',
  async () => {
    const base = await dispatchToReconciliation();
    const drift = makeHarness(undefined, { secretApiKey: SECRET + '-rotated' });
    drift.payload = base.payload!.slice();
    await run(drift, dispatchClaim(true));
    assertDeepEqual(
      drift.outcomes,
      [
        {
          kind: 'action_required',
          resultCode: 'REVENUECAT_V2_CONFIGURATION_REQUIRED',
        },
      ],
      'credential drift must not merge evidence across keys',
    );
    assert(drift.calls.length === 0, 'credential drift stops before provider');

    const malformed = makeHarness(() =>
      Promise.resolve({
        status: 200,
        body: { object: 'list', items: [], next_page: null, url: '/wrong' },
      }),
    );
    await run(malformed, dispatchClaim());
    assertDeepEqual(
      malformed.outcomes,
      [
        {
          kind: 'action_required',
          resultCode: 'REVENUECAT_V2_PROJECT_ATTESTATION_UNRESOLVED',
        },
      ],
      'unattested provider shape must fail closed',
    );

    const forged = makeHarness();
    forged.payload = new TextEncoder().encode(
      JSON.stringify({ version: 1, phase: 'ready', secret: SECRET }),
    );
    await run(forged, dispatchClaim(true));
    assertDeepEqual(
      forged.outcomes,
      [
        {
          kind: 'action_required',
          resultCode: 'REVENUECAT_V2_PREFLIGHT_UNATTESTED',
        },
      ],
      'forged encrypted plaintext requires operator action',
    );
    assert(!JSON.stringify(forged.outcomes).includes(SECRET), 'forgery must not echo secrets');

    const replay = makeHarness();
    replay.payload = base.payload!.slice();
    const replayClaim = {
      ...dispatchClaim(true),
      operationId: '20000000-0000-4000-8000-000000000002',
    };
    await run(replay, replayClaim);
    assertDeepEqual(
      replay.outcomes,
      [
        {
          kind: 'action_required',
          resultCode: 'REVENUECAT_V2_CONFIGURATION_REQUIRED',
        },
      ],
      'authenticated plaintext is also bound to the exact operation',
    );
    assert(replay.calls.length === 0, 'cross-operation replay stops before provider');
  },
);

Deno.test('identity barrier retries before request_started after a crash', async () => {
  const harness = makeHarness();
  harness.failBarrier = true;
  try {
    await run(harness, dispatchClaim());
    throw new Error('expected barrier crash');
  } catch (error) {
    assert(!(error instanceof RevenueCatV2DeletionExecutorError), 'expected adapter failure');
  }
  assert(payloadState(harness).phase === 'ready', 'snapshot precedes barrier');
  assert(harness.markCalls === 0, 'failed barrier prevents request_started');
  assert(
    harness.calls.every((call) => call.method !== 'DELETE'),
    'failed barrier prevents mutation',
  );
  harness.failBarrier = false;
  await run(harness, dispatchClaim(true));
  assert(Number(harness.markCalls) === 1, 'resume establishes barrier then marks once');
  assertDeepEqual(
    harness.barriers[0].aliases,
    [ALIAS_A, ALIAS_B],
    'raw alias family is transiently available to guarded scrub',
  );
  assert(
    harness.outcomes.at(-1)?.resultCode === 'REVENUECAT_V2_DELETE_ACKNOWLEDGED',
    'resume transitions only after durable dispatch evidence',
  );
});

Deno.test('provider capacity is reserved before request_started and DELETE', async () => {
  const harness = makeHarness();
  harness.failPermit = true;
  try {
    await run(harness, dispatchClaim());
    throw new Error('expected provider capacity deferral');
  } catch (error) {
    assert(error instanceof AccountDeletionWorkerCapacityError, 'capacity signal must propagate');
  }
  assert(payloadState(harness).phase === 'ready', 'preflight remains safely dispatchable');
  assert(harness.markCalls === 0, 'capacity denial occurs before request_started');
  assert(
    harness.calls.every((call) => call.method !== 'DELETE'),
    'capacity denial sends no mutation',
  );

  harness.failPermit = false;
  await run(harness, dispatchClaim(true));
  assert(Number(harness.markCalls) === 1, 'later capacity permits durable request start');
  assert(
    harness.calls.filter((call) => call.method === 'DELETE').length === 1,
    'later dispatch sends the mutation exactly once',
  );
});

Deno.test('DELETE backoff delays read-only reconciliation without redispatch', async () => {
  const harness = makeHarness((request) => {
    const method = String(request.init.method);
    if (request.url.endsWith('/v2/projects')) {
      return {
        status: 200,
        body: projectsBody({
          projects: [{ id: PROJECT_ID, createdAt: PROJECT_CREATED }],
          nextStartingAfter: null,
        }),
      };
    }
    if (method === 'DELETE') {
      return {
        status: 429,
        body: providerError('rate_limit_error', true, 300_000),
        retryAfterMs: 120_000,
      };
    }
    if (request.url.endsWith('/aliases')) {
      return {
        status: 200,
        body: aliasPageBody({ aliases: [], nextStartingAfter: null }),
      };
    }
    return { status: 200, body: customerBody() };
  });
  await run(harness, dispatchClaim());
  assertDeepEqual(
    harness.outcomes.at(-1),
    {
      kind: 'ambiguous',
      resultCode: 'REVENUECAT_V2_DISPATCH_AMBIGUOUS',
      retryAt: new Date(NOW + 300_000).toISOString(),
    },
    'started mutation honors provider delay in the GET-only lane',
  );
  assert(payloadState(harness).phase === 'reconciling', 'backoff never permits redispatch');
  assert(
    harness.calls.filter((call) => call.method === 'DELETE').length === 1,
    'rate-limited mutation remains single-dispatch',
  );
});

Deno.test('terminal success requires exact GET absence for full identity family', async () => {
  const harness = await dispatchToReconciliation();
  harness.absenceObservationCount = 1;
  const callsBefore = harness.calls.length;
  await run(harness, reconcileClaim());
  const reconciliationCalls = harness.calls.slice(callsBefore);
  assert(reconciliationCalls.length === 5, 'four identities plus aliases read');
  assert(
    reconciliationCalls.every((call) => call.method === 'GET'),
    'terminal proof must be read-only',
  );
  for (const identity of [USER_ID, CUSTOMER_ID, ALIAS_A, ALIAS_B]) {
    assert(
      reconciliationCalls.some((call) => call.url.includes(encodeURIComponent(identity))),
      'missing exact identity-family absence probe',
    );
  }
  assertDeepEqual(
    harness.outcomes.at(-1),
    { kind: 'succeeded', resultCode: 'REVENUECAT_V2_DELETION_VERIFIED' },
    'only terminal core attestation completes mutation path',
  );
  const durableResults = JSON.stringify(harness.outcomes);
  for (const sensitive of [USER_ID, CUSTOMER_ID, ALIAS_A, ALIAS_B, SECRET]) {
    assert(!durableResults.includes(sensitive), 'durable result leaked sensitive identity');
  }
});

Deno.test(
  'reconciliation completion repeats the full identity family after quiescence',
  async () => {
    const harness = await dispatchToReconciliation();
    harness.absenceConfirmations.push(false, true);
    const callsBefore = harness.calls.length;

    await run(harness, reconcileClaim());
    assertDeepEqual(
      harness.outcomes.at(-1),
      {
        kind: 'retryable',
        resultCode: 'REVENUECAT_V2_QUIESCENCE_PENDING',
        retryAt: '2026-07-13T12:06:00.000Z',
      },
      'first full family absence remains nonterminal',
    );
    const firstRoundCalls = harness.calls.length - callsBefore;
    assert(firstRoundCalls === 5, 'first round covers all identities and aliases');

    await run(harness, reconcileClaim());
    assert(
      harness.calls.length - callsBefore === firstRoundCalls * 2,
      'second round must repeat the complete family',
    );
    assert(harness.absenceCalls === 2, 'two complete rounds must be DB-attested');
    assert(
      harness.outcomes.at(-1)?.resultCode === 'REVENUECAT_V2_DELETION_VERIFIED',
      'confirmed second round completes',
    );
  },
);

Deno.test(
  'configuration failures after request_started are action_required without redispatch',
  async () => {
    const harness = makeHarness((request) => {
      if (String(request.init.method) === 'DELETE') {
        return Promise.resolve({
          status: 401,
          body: providerError('authentication_error', false),
        });
      }
      if (request.url.endsWith('/v2/projects')) {
        return Promise.resolve({
          status: 200,
          body: projectsBody({
            projects: [{ id: PROJECT_ID, createdAt: PROJECT_CREATED }],
            nextStartingAfter: null,
          }),
        });
      }
      if (request.url.endsWith('/aliases')) {
        return Promise.resolve({
          status: 200,
          body: aliasPageBody({ aliases: [], nextStartingAfter: null }),
        });
      }
      return Promise.resolve({ status: 200, body: customerBody() });
    });
    await run(harness, dispatchClaim());
    assertDeepEqual(
      harness.outcomes,
      [
        {
          kind: 'action_required',
          resultCode: 'REVENUECAT_V2_CONFIGURATION_REQUIRED',
        },
      ],
      'exact credential rejection requires internal repair',
    );
    assert(harness.markCalls === 1, 'request-start boundary remains durable');
    assert(
      harness.calls.filter((call) => call.method === 'DELETE').length === 1,
      'configuration failure never loops DELETE',
    );
  },
);

Deno.test(
  'malformed network envelope after request_started becomes durable ambiguity',
  async () => {
    const harness = makeHarness((request) => {
      if (String(request.init.method) === 'DELETE') {
        return Promise.resolve({ status: 0, body: null } as unknown as RevenueCatV2NetworkResponse);
      }
      if (request.url.endsWith('/v2/projects')) {
        return Promise.resolve({
          status: 200,
          body: projectsBody({
            projects: [{ id: PROJECT_ID, createdAt: PROJECT_CREATED }],
            nextStartingAfter: null,
          }),
        });
      }
      if (request.url.endsWith('/aliases')) {
        return Promise.resolve({
          status: 200,
          body: aliasPageBody({ aliases: [], nextStartingAfter: null }),
        });
      }
      return Promise.resolve({ status: 200, body: customerBody() });
    });
    await run(harness, dispatchClaim());
    const state = payloadState(harness);
    assert(state.phase === 'reconciling', 'invalid envelope is nonterminal');
    assert(
      state.dispatchEvidence.resultCode === 'REVENUECAT_V2_DISPATCH_AMBIGUOUS',
      'anything malformed after request-start must reconcile',
    );
    assertDeepEqual(
      harness.outcomes.at(-1),
      {
        kind: 'ambiguous',
        resultCode: 'REVENUECAT_V2_DISPATCH_AMBIGUOUS',
      },
      'ambiguous evidence must persist before lane transition',
    );
  },
);
