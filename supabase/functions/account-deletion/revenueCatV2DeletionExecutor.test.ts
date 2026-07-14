import {
  createRevenueCatV2DeletionExecutor,
  decodeRevenueCatV2ExecutorState,
  deriveRevenueCatV2CredentialBinding,
  encodeRevenueCatV2ExecutorState,
  REVENUECAT_V2_EXECUTOR_MAX_PLAINTEXT_BYTES,
  RevenueCatV2DeletionExecutorError,
  type RevenueCatV2DeletionExecutorOptions,
  type RevenueCatV2ExecutorState,
  type RevenueCatV2HttpRequest,
  type RevenueCatV2IdentityBarrierSnapshot,
  type RevenueCatV2NetworkResponse,
  type RevenueCatV2StepOutcome,
} from './revenueCatV2DeletionExecutor.ts';
import type { AccountDeletionClaim } from './durableDeletionWorker.ts';

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
) {
  return {
    object: 'error',
    type,
    message: 'Provider response',
    retryable,
    doc_url: 'https://errors.rev.cat/' + type.replaceAll('_', '-'),
    ...(retryable ? { backoff_ms: 1_000 } : {}),
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
  markCalls: number;
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
    markCalls: 0,
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
      recordOutcome(_claim, outcome) {
        harness.events.push('outcome:' + outcome.kind);
        if (harness.failRecord) {
          return Promise.reject(new Error('private record failure'));
        }
        harness.outcomes.push(structuredClone(outcome));
        return Promise.resolve();
      },
    },
    network: {
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
    maxRequests: overrides.maxRequests ?? 20,
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
    for (const forged of [
      text + ' ',
      JSON.stringify({ ...JSON.parse(text), extra: true }),
      JSON.stringify({ ...JSON.parse(text), version: 2 }),
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

Deno.test('already-absent evidence survives a crash before terminal CAS', async () => {
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
  harness.failRecord = true;
  try {
    await run(harness, dispatchClaim());
    throw new Error('expected terminal CAS crash');
  } catch (error) {
    assert(!(error instanceof RevenueCatV2DeletionExecutorError), 'expected gateway crash');
  }
  assert(
    payloadState(harness).phase === 'already_absent',
    'exact proof must be durable before terminal CAS',
  );
  harness.failRecord = false;
  const callsBeforeResume = harness.calls.length;
  await run(harness, dispatchClaim(true));
  assert(
    harness.calls.length === callsBeforeResume,
    'resume must not repeat provider reads after durable exact proof',
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

Deno.test('partial reconciliation observations persist and resume missing targets', async () => {
  const harness = await dispatchToReconciliation();
  let reconciliationWrites = 0;
  harness.persistFault = (state) => {
    if (state.phase !== 'reconciling') return null;
    const observed = state.customerObservations.filter((entry) => entry !== null).length;
    if (observed > 0) reconciliationWrites += 1;
    return observed === 2 ? 'before' : null;
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
    partial.customerObservations.filter((entry) => entry !== null).length === 1,
    'only successfully persisted observation may survive',
  );
  assert(reconciliationWrites >= 2, 'fault must occur on a later observation');
  harness.persistFault = null;
  const firstTargetUrl = harness.calls[callsBefore].url;
  const callsBeforeResume = harness.calls.length;
  await run(harness, reconcileClaim());
  assert(
    harness.calls.slice(callsBeforeResume).every((call) => call.url !== firstTargetUrl),
    'resume must retain and skip already-persisted target evidence',
  );
  assert(
    harness.outcomes.at(-1)?.resultCode === 'REVENUECAT_V2_DELETION_VERIFIED',
    'remaining exact absences must complete',
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
});

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

Deno.test('terminal success requires exact GET absence for full identity family', async () => {
  const harness = await dispatchToReconciliation();
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
