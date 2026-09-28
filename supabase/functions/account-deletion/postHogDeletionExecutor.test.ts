import type { AccountDeletionClaim } from './durableDeletionWorker.ts';
import {
  createPostHogDeletionExecutor,
  POSTHOG_DELETION_NOT_REQUIRED_RESULT_CODE,
  type PostHogDeletionExecutorConfiguration,
  PostHogDeletionExecutorError,
  type PostHogDeletionNetwork,
  type PostHogDeletionNetworkResponse,
  type PostHogDeletionRecordOutcome,
} from './postHogDeletionExecutor.ts';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const OPERATION_ID = '22222222-2222-4222-8222-222222222222';
const PERSON_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PERSON_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const CLAIM_TOKEN = 'ab'.repeat(32);
const CAPTURE_SHUTDOWN = '2026-07-13T11:50:00.000Z';
const RECORDING_AUDIT = '2026-07-13T11:55:00.000Z';
const DISPATCH_TIME = '2026-07-13T12:00:00.000Z';
const SECRET = 'phx_secret_that_must_not_escape';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertDeepEqual(actual: unknown, expected: unknown): void {
  const left = JSON.stringify(actual);
  const right = JSON.stringify(expected);
  if (left !== right) throw new Error(`${left} !== ${right}`);
}

function response(status: number, body: unknown): PostHogDeletionNetworkResponse {
  return {
    status,
    body,
    responseBytes: new TextEncoder().encode(JSON.stringify(body)).byteLength,
  };
}

type NetworkHandler = (request: {
  url: string;
  init: RequestInit;
}) => PostHogDeletionNetworkResponse | Promise<PostHogDeletionNetworkResponse>;

class FakeNetwork implements PostHogDeletionNetwork {
  readonly calls: Array<{ url: string; method: string }> = [];
  readonly trace: string[];
  handlers: NetworkHandler[] = [];

  constructor(trace: string[] = []) {
    this.trace = trace;
  }

  sendJson(request: { url: string; init: RequestInit }): Promise<PostHogDeletionNetworkResponse> {
    const method = String(request.init.method);
    this.calls.push({ url: request.url, method });
    this.trace.push(
      request.url.includes('/bulk_delete/')
        ? 'network:bulk_delete'
        : request.url.includes('/deletion_status/')
          ? 'network:status'
          : 'network:lookup',
    );
    const handler = this.handlers.shift();
    if (handler === undefined) return Promise.reject(new Error('network down'));
    try {
      return Promise.resolve(handler(request));
    } catch (error) {
      return Promise.reject(error);
    }
  }
}

type RecordedStep = {
  outcome: PostHogDeletionRecordOutcome;
  resultCode: string;
  retryAt: string | null;
};

class FakeRpc {
  readonly trace: string[];
  readonly records: RecordedStep[] = [];
  markCount = 0;
  failMark = false;
  failRecord = false;
  requestStartedAt = DISPATCH_TIME;

  constructor(trace: string[] = []) {
    this.trace = trace;
  }

  markRequestStarted(): Promise<{ requestStartedAt: string }> {
    this.markCount += 1;
    this.trace.push('rpc:request_started');
    if (this.failMark) return Promise.reject(new Error(`private:${USER_ID}`));
    return Promise.resolve({ requestStartedAt: this.requestStartedAt });
  }

  recordStep(input: {
    outcome: PostHogDeletionRecordOutcome;
    resultCode: string;
    retryAt: string | null;
  }): Promise<void> {
    this.trace.push(`rpc:record:${input.outcome}:${input.resultCode}`);
    if (this.failRecord) return Promise.reject(new Error(`private:${SECRET}`));
    this.records.push({
      outcome: input.outcome,
      resultCode: input.resultCode,
      retryAt: input.retryAt,
    });
    return Promise.resolve();
  }
}

class MemoryStateStore {
  readonly trace: string[];
  bytes: Uint8Array | null = null;
  saveCount = 0;
  failSaveNumber: number | null = null;

  constructor(trace: string[] = []) {
    this.trace = trace;
  }

  load(): Promise<Uint8Array | null> {
    this.trace.push('state:load');
    return Promise.resolve(this.bytes === null ? null : new Uint8Array(this.bytes));
  }

  save(input: { plaintext: Uint8Array }): Promise<void> {
    this.saveCount += 1;
    this.trace.push(`state:save:${this.saveCount}`);
    if (this.failSaveNumber === this.saveCount) {
      return Promise.reject(new Error(`private:${PERSON_A}`));
    }
    this.bytes = new Uint8Array(input.plaintext);
    return Promise.resolve();
  }

  parsed(): Record<string, unknown> {
    assert(this.bytes !== null, 'state must exist');
    return JSON.parse(new TextDecoder().decode(this.bytes)) as Record<string, unknown>;
  }
}

class MutableClock {
  value = Date.parse(DISPATCH_TIME);
  nowMs(): number {
    return this.value;
  }
  set(iso: string): void {
    this.value = Date.parse(iso);
  }
}

function configuration(
  overrides: Partial<PostHogDeletionExecutorConfiguration> = {},
): PostHogDeletionExecutorConfiguration {
  return {
    appEnvironment: 'production',
    publicAppEnvironment: undefined,
    mobileKey: 'phc_mobile_project_key',
    host: 'https://eu.posthog.com',
    projectId: '12345',
    personalApiKey: SECRET,
    captureShutdownAt: CAPTURE_SHUTDOWN,
    minimumAbsenceIntervalSeconds: 60,
    maxNetworkRequestsPerInvocation: 3,
    noRecordingsEvidence: {
      recordingsCollected: false,
      durable: true,
      evidence: 'production_capture_disabled_and_storage_audited',
      verifiedAt: RECORDING_AUDIT,
    },
    ...overrides,
  };
}

function claim(
  mode: 'dispatch' | 'reconcile',
  hasPayload = mode === 'reconcile',
): AccountDeletionClaim {
  return {
    operationId: OPERATION_ID,
    userId: USER_ID,
    operationState: 'running',
    stepName: 'posthog_delete',
    stepStatus: 'leased',
    claimMode: mode,
    claimToken: CLAIM_TOKEN,
    attemptCount: 1,
    requestStartedAt: mode === 'reconcile' ? DISPATCH_TIME : null,
    leaseExpiresAt: '2026-07-13T13:00:00.000Z',
    encryptedPayload: hasPayload ? '\\x01' : null,
  };
}

function harness(
  overrides: Partial<{
    config: PostHogDeletionExecutorConfiguration;
    network: FakeNetwork;
    rpc: FakeRpc;
    store: MemoryStateStore;
    clock: MutableClock;
  }> = {},
) {
  const trace: string[] = [];
  const network = overrides.network ?? new FakeNetwork(trace);
  const rpc = overrides.rpc ?? new FakeRpc(trace);
  const store = overrides.store ?? new MemoryStateStore(trace);
  const clock = overrides.clock ?? new MutableClock();
  const config = overrides.config ?? configuration();
  const executor = createPostHogDeletionExecutor({
    configuration: config,
    rpc,
    network,
    encryptedStateStore: store,
    clock,
  });
  return { executor, network, rpc, store, clock, trace, config };
}

function lookupFound(...personUuids: string[]): NetworkHandler {
  return (request) => {
    const body = JSON.parse(String(request.init.body)) as {
      distinct_ids: string[];
    };
    const results: Record<string, { uuid: string }> = {};
    personUuids.forEach((uuid, index) => {
      results[body.distinct_ids[index]] = { uuid };
    });
    return response(200, { results });
  };
}

const lookupAbsent: NetworkHandler = () => response(200, { results: {} });

function bulkQueued(targetCount: number): NetworkHandler {
  return () =>
    response(202, {
      persons_found: targetCount,
      persons_deleted: targetCount,
      events_queued_for_deletion: true,
      recordings_queued_for_deletion: false,
      deletion_errors: [],
    });
}

function statusCompleted(personUuid: string): NetworkHandler {
  return () =>
    response(200, {
      count: 1,
      next: null,
      previous: null,
      results: [
        {
          person_uuid: personUuid,
          created_at: '2026-07-13T12:00:01.000001Z',
          status: 'completed',
          delete_verified_at: '2026-07-13T12:00:02+00:00',
        },
      ],
    });
}

const statusPending =
  (personUuid: string): NetworkHandler =>
  () =>
    response(200, {
      count: 1,
      next: null,
      previous: null,
      results: [
        {
          person_uuid: personUuid,
          created_at: '2026-07-13T12:00:01.000Z',
          status: 'pending',
          delete_verified_at: null,
        },
      ],
    });

const statusMissing: NetworkHandler = () =>
  response(200, { count: 0, next: null, previous: null, results: [] });

async function dispatchTargets(targetUuids: string[], options: { maxRequests?: number } = {}) {
  const h = harness({
    config: configuration({
      maxNetworkRequestsPerInvocation: options.maxRequests ?? 3,
    }),
  });
  h.network.handlers.push(lookupFound(...targetUuids), bulkQueued(targetUuids.length));
  await h.executor(claim('dispatch', false), {
    deadlineAtMs: Date.parse('2026-07-13T13:00:00.000Z'),
  });
  return h;
}

Deno.test(
  'provider-free environment records one honest durable success after request_started',
  async () => {
    const h = harness({
      config: configuration({
        appEnvironment: 'development',
        publicAppEnvironment: undefined,
        mobileKey: undefined,
        host: undefined,
        projectId: undefined,
        personalApiKey: undefined,
        captureShutdownAt: undefined,
        noRecordingsEvidence: undefined,
      }),
    });
    await h.executor(claim('dispatch', false), {
      deadlineAtMs: Date.parse('2026-07-13T13:00:00.000Z'),
    });
    assert(h.network.calls.length === 0, 'no provider call when provider-free');
    assert(h.rpc.markCount === 1, 'success must follow request_started');
    assertDeepEqual(h.rpc.records, [
      {
        outcome: 'succeeded',
        resultCode: POSTHOG_DELETION_NOT_REQUIRED_RESULT_CODE,
        retryAt: null,
      },
    ]);
    assertDeepEqual(h.store.parsed(), {
      version: 1,
      mode: 'not_required',
      attestedAt: DISPATCH_TIME,
      configurationAttestation: {
        contract: 'exact_provider_free_development_v1',
        digestAlgorithm: 'SHA-256',
        digestHex: '230a19024823190c31c277d0ac02616d92e762ef9795c2f82d5f15d3bd29ff4e',
      },
    });
    assert(
      h.trace.indexOf('state:save:1') < h.trace.indexOf('rpc:request_started'),
      'not-required attestation must commit before success marker',
    );
  },
);

Deno.test(
  'not-required crash after marker resumes from durable attestation without provider access',
  async () => {
    const config = configuration({
      appEnvironment: 'development',
      publicAppEnvironment: undefined,
      mobileKey: undefined,
      host: undefined,
      projectId: undefined,
      personalApiKey: undefined,
      captureShutdownAt: undefined,
      noRecordingsEvidence: undefined,
    });
    const h = harness({ config });
    h.rpc.failRecord = true;
    try {
      await h.executor(claim('dispatch', false), {
        deadlineAtMs: Date.parse('2026-07-13T13:00:00.000Z'),
      });
      throw new Error('expected crash');
    } catch (error) {
      assert(
        error instanceof PostHogDeletionExecutorError &&
          error.code === 'POSTHOG_EXECUTOR_DEPENDENCY_FAILED',
        'dependency error must be stable and redacted',
      );
    }
    h.rpc.failRecord = false;
    await h.executor(claim('reconcile', true), {
      deadlineAtMs: Date.parse('2026-07-13T13:00:00.000Z'),
    });
    assert(h.network.calls.length === 0, 'resume never touches PostHog');
    assert(
      h.rpc.records.at(-1)?.resultCode === POSTHOG_DELETION_NOT_REQUIRED_RESULT_CODE,
      'stable result',
    );
    assert(h.rpc.markCount === 2, 'both terminal attempts are marked');
  },
);

Deno.test(
  'not-required attestation cannot survive environment or PostHog configuration repair',
  async () => {
    for (const mutate of [
      (config: PostHogDeletionExecutorConfiguration) => {
        config.appEnvironment = 'production';
        config.publicAppEnvironment = 'production';
        config.mobileKey = 'phc_repaired_mobile_key';
        config.host = 'https://eu.posthog.com';
        config.projectId = '67890';
        config.personalApiKey = 'phx_repaired_personal_key';
        config.captureShutdownAt = CAPTURE_SHUTDOWN;
        config.noRecordingsEvidence = {
          recordingsCollected: false,
          durable: true,
          evidence: 'production_capture_disabled_and_storage_audited',
          verifiedAt: RECORDING_AUDIT,
        };
      },
      (config: PostHogDeletionExecutorConfiguration) => {
        config.mobileKey = 'phc_later_configured';
      },
      (config: PostHogDeletionExecutorConfiguration) => {
        config.maxNetworkRequestsPerInvocation += 1;
      },
    ]) {
      const config = configuration({
        appEnvironment: 'development',
        publicAppEnvironment: undefined,
        mobileKey: undefined,
        host: undefined,
        projectId: undefined,
        personalApiKey: undefined,
        captureShutdownAt: undefined,
        noRecordingsEvidence: undefined,
      });
      const h = harness({ config });
      await h.executor(claim('dispatch', false), {
        deadlineAtMs: Date.parse('2026-07-13T13:00:00.000Z'),
      });
      mutate(config);
      await h.executor(claim('reconcile', true), {
        deadlineAtMs: Date.parse('2026-07-13T13:00:00.000Z'),
      });
      assertDeepEqual(h.rpc.records.at(-1), {
        outcome: 'action_required',
        resultCode: 'POSTHOG_STATUS_UNATTESTED',
        retryAt: null,
      });
      assert(h.rpc.markCount === 1, 'stale state cannot gain a second marker');
      assert(h.network.calls.length === 0, 'stale state cannot touch PostHog');
    }
  },
);

Deno.test('malformed, stale, and future not-required attestations fail closed', async () => {
  const providerFree = configuration({
    appEnvironment: 'development',
    publicAppEnvironment: undefined,
    mobileKey: undefined,
    host: undefined,
    projectId: undefined,
    personalApiKey: undefined,
    captureShutdownAt: undefined,
    noRecordingsEvidence: undefined,
  });
  const seed = harness({ config: providerFree });
  await seed.executor(claim('dispatch', false), {
    deadlineAtMs: Date.parse('2026-07-13T13:00:00.000Z'),
  });
  const canonical = seed.store.parsed();
  const malformedStates = [
    {
      ...canonical,
      configurationAttestation: {
        contract: 'exact_provider_free_development_v1',
        digestAlgorithm: 'SHA-256',
        digestHex: 'not-a-sha256-digest',
      },
    },
    {
      version: 1,
      mode: 'not_required',
      attestedAt: DISPATCH_TIME,
    },
  ];
  for (const state of malformedStates) {
    const store = new MemoryStateStore();
    store.bytes = new TextEncoder().encode(JSON.stringify(state));
    const h = harness({ config: providerFree, store });
    await h.executor(claim('reconcile', true), {
      deadlineAtMs: Date.parse('2026-07-13T13:00:00.000Z'),
    });
    assertDeepEqual(h.rpc.records, [
      {
        outcome: 'action_required',
        resultCode: 'POSTHOG_STATUS_UNATTESTED',
        retryAt: null,
      },
    ]);
    assert(h.rpc.markCount === 0, 'malformed state cannot be terminal');
  }

  for (const state of [
    {
      ...canonical,
      configurationAttestation: {
        contract: 'exact_provider_free_development_v1',
        digestAlgorithm: 'SHA-256',
        digestHex: '0'.repeat(64),
      },
    },
    { ...canonical, attestedAt: '2026-07-13T12:00:01.000Z' },
  ]) {
    const store = new MemoryStateStore();
    store.bytes = new TextEncoder().encode(JSON.stringify(state));
    const h = harness({ config: providerFree, store });
    await h.executor(claim('reconcile', true), {
      deadlineAtMs: Date.parse('2026-07-13T13:00:00.000Z'),
    });
    assertDeepEqual(h.rpc.records, [
      {
        outcome: 'action_required',
        resultCode: 'POSTHOG_STATUS_UNATTESTED',
        retryAt: null,
      },
    ]);
    assert(h.rpc.markCount === 0, 'stale state cannot be terminal');
  }
});

Deno.test(
  'production and any configured signal fail closed when provider credentials are incomplete',
  async () => {
    for (const config of [
      configuration({ personalApiKey: undefined }),
      configuration({ appEnvironment: 'development', projectId: undefined }),
      configuration({ host: undefined }),
      configuration({
        appEnvironment: undefined,
        publicAppEnvironment: undefined,
        mobileKey: undefined,
        host: undefined,
        projectId: undefined,
        personalApiKey: undefined,
        captureShutdownAt: undefined,
        noRecordingsEvidence: undefined,
      }),
    ]) {
      const h = harness({ config });
      await h.executor(claim('dispatch', false), {
        deadlineAtMs: Date.parse('2026-07-13T13:00:00.000Z'),
      });
      assertDeepEqual(h.rpc.records, [
        {
          outcome: 'action_required',
          resultCode: 'POSTHOG_DELETE_CONFIGURATION_REQUIRED',
          retryAt: null,
        },
      ]);
      assert(h.rpc.markCount === 0, 'configuration failure is pre-dispatch');
      assert(h.network.calls.length === 0, 'no request with partial credentials');
    }
  },
);

Deno.test(
  'required no-target lookup persists the empty set but never overclaims event erasure',
  async () => {
    const h = harness();
    h.network.handlers.push(lookupAbsent);
    await h.executor(claim('dispatch', false), {
      deadlineAtMs: Date.parse('2026-07-13T13:00:00.000Z'),
    });
    const state = h.store.parsed();
    const targetSet = state.targetSetEvidence as { personUuids: string[] };
    assertDeepEqual(targetSet.personUuids, []);
    assertDeepEqual(h.rpc.records, [
      {
        outcome: 'action_required',
        resultCode: 'POSTHOG_LOOKUP_UNATTESTED',
        retryAt: null,
      },
    ]);
    assert(h.rpc.markCount === 0, 'no mutation marker without a target');
    assert(
      h.network.calls.every((call) => !call.url.includes('bulk_delete')),
      'no empty bulk mutation',
    );
  },
);

Deno.test(
  'dispatch persists exact targets and cutoff before the immediately adjacent mutation marker',
  async () => {
    const trace: string[] = [];
    const h = harness({
      network: new FakeNetwork(trace),
      rpc: new FakeRpc(trace),
      store: new MemoryStateStore(trace),
    });
    h.network.handlers.push(lookupFound(PERSON_B, PERSON_A), bulkQueued(2));
    await h.executor(claim('dispatch', false), {
      deadlineAtMs: Date.parse('2026-07-13T13:00:00.000Z'),
    });
    assertDeepEqual(h.rpc.records, [
      {
        outcome: 'ambiguous',
        resultCode: 'POSTHOG_DELETE_QUEUED',
        retryAt: null,
      },
    ]);
    const marker = trace.indexOf('rpc:request_started');
    assert(marker > 0, 'marker exists');
    assert(trace[marker - 1] === 'state:save:2', 'cutoff is last durable write');
    assert(trace[marker + 1] === 'network:bulk_delete', 'bulk call is immediate');
    const state = h.store.parsed();
    assertDeepEqual((state.targetSetEvidence as { personUuids: string[] }).personUuids, [
      PERSON_A,
      PERSON_B,
    ]);
    assertDeepEqual(state.dispatchEvidence, {
      kind: 'queued',
      resultCode: 'POSTHOG_DELETE_QUEUED',
      requestStartedAt: DISPATCH_TIME,
      observedAt: DISPATCH_TIME,
    });
  },
);

Deno.test(
  'post-marker transport and rate-limit outcomes become durable ambiguity, never redispatch',
  async () => {
    for (const secondHandler of [
      (() => {
        throw new Error(`transport:${SECRET}`);
      }) as NetworkHandler,
      (() => response(429, { detail: 'rate limited' })) as NetworkHandler,
    ]) {
      const h = harness();
      h.network.handlers.push(lookupFound(PERSON_A), secondHandler);
      await h.executor(claim('dispatch', false), {
        deadlineAtMs: Date.parse('2026-07-13T13:00:00.000Z'),
      });
      assertDeepEqual(h.rpc.records, [
        {
          outcome: 'ambiguous',
          resultCode: 'POSTHOG_DELETE_DISPATCH_AMBIGUOUS',
          retryAt: null,
        },
      ]);
      assertDeepEqual(h.store.parsed().dispatchEvidence, {
        kind: 'ambiguous',
        resultCode: 'POSTHOG_DELETE_DISPATCH_AMBIGUOUS',
        requestStartedAt: DISPATCH_TIME,
        observedAt: DISPATCH_TIME,
      });

      h.clock.set('2026-07-13T12:05:00.000Z');
      h.network.handlers.push(lookupAbsent, statusPending(PERSON_A));
      await h.executor(claim('reconcile', true), {
        deadlineAtMs: Date.parse('2026-07-13T13:00:00.000Z'),
      });
      assert(
        h.network.calls.filter((call) => call.url.includes('bulk_delete')).length === 1,
        'reconciliation cannot repeat the mutation',
      );
    }
  },
);

Deno.test(
  'crash after queued state persistence resumes read-only and preserves evidence',
  async () => {
    const h = harness();
    h.network.handlers.push(lookupFound(PERSON_A), bulkQueued(1));
    h.rpc.failRecord = true;
    try {
      await h.executor(claim('dispatch', false), {
        deadlineAtMs: Date.parse('2026-07-13T13:00:00.000Z'),
      });
      throw new Error('expected record crash');
    } catch (error) {
      assert(error instanceof PostHogDeletionExecutorError, 'stable crash error');
      assert(!error.message.includes(PERSON_A), 'no provider ID in error');
      assert(!error.message.includes(SECRET), 'no secret in error');
    }
    assert(
      (h.store.parsed().dispatchEvidence as { kind: string }).kind === 'queued',
      'queued evidence committed before RPC record',
    );
    h.rpc.failRecord = false;
    h.clock.set('2026-07-13T12:05:00.000Z');
    h.network.handlers.push(lookupAbsent, statusCompleted(PERSON_A));
    await h.executor(claim('reconcile', true), {
      deadlineAtMs: Date.parse('2026-07-13T13:00:00.000Z'),
    });
    assert(
      h.network.calls.filter((call) => call.url.includes('bulk_delete')).length === 1,
      'resume never repeats bulk delete',
    );
  },
);

Deno.test(
  'crash after marker but before an attested response resumes from prepared state without mutation',
  async () => {
    const h = harness();
    h.network.handlers.push(lookupFound(PERSON_A), () => {
      throw new Error('connection reset');
    });
    h.store.failSaveNumber = 3;
    try {
      await h.executor(claim('dispatch', false), {
        deadlineAtMs: Date.parse('2026-07-13T13:00:00.000Z'),
      });
      throw new Error('expected state crash');
    } catch (error) {
      assert(
        error instanceof PostHogDeletionExecutorError &&
          error.code === 'POSTHOG_EXECUTOR_DEPENDENCY_FAILED',
        'state failure is redacted',
      );
    }
    assert(h.store.parsed().dispatchEvidence === null, 'prepared snapshot survives');
    h.store.failSaveNumber = null;
    h.clock.set('2026-07-13T12:05:00.000Z');
    h.network.handlers.push(lookupAbsent, statusPending(PERSON_A));
    await h.executor(claim('reconcile', true), {
      deadlineAtMs: Date.parse('2026-07-13T13:00:00.000Z'),
    });
    assert(
      h.network.calls.filter((call) => call.url.includes('bulk_delete')).length === 1,
      'only the original uncertain mutation exists',
    );
    assert(
      (h.store.parsed().dispatchEvidence as { kind: string }).kind === 'ambiguous',
      'reconcile derives durable ambiguity from request_started',
    );
  },
);

Deno.test(
  'partial statuses and absence observations survive bounded invocations to terminal success',
  async () => {
    const h = await dispatchTargets([PERSON_A, PERSON_B], { maxRequests: 2 });
    h.clock.set('2026-07-13T12:05:00.000Z');
    h.network.handlers.push(lookupAbsent, statusCompleted(PERSON_A));
    await h.executor(claim('reconcile', true), {
      deadlineAtMs: Date.parse('2026-07-13T13:00:00.000Z'),
    });
    let state = h.store.parsed();
    assert(
      (state.eventStatusObservations as unknown[]).length === 1,
      'first completed target persists',
    );
    assert((state.absenceObservations as unknown[]).length === 1, 'first absence persists');
    assert(
      h.rpc.records.at(-1)?.resultCode === 'POSTHOG_STATUS_PENDING',
      'bounded resume requested',
    );

    h.clock.set('2026-07-13T12:06:00.000Z');
    h.network.handlers.push(lookupAbsent, statusCompleted(PERSON_B));
    await h.executor(claim('reconcile', true), {
      deadlineAtMs: Date.parse('2026-07-13T13:00:00.000Z'),
    });
    state = h.store.parsed();
    assert((state.eventStatusObservations as unknown[]).length === 2, 'both statuses persist');
    assert((state.absenceObservations as unknown[]).length === 2, 'two absences persist');
    assertDeepEqual(h.rpc.records.at(-1), {
      outcome: 'succeeded',
      resultCode: 'POSTHOG_DELETION_VERIFIED',
      retryAt: null,
    });
    assert(h.rpc.markCount >= 3, 'terminal success follows reconcile marker');
    const reconcileCalls = h.network.calls.slice(2);
    assert(
      reconcileCalls.every(
        (call) =>
          call.url.includes('batch_by_distinct_ids') || call.url.includes('deletion_status'),
      ),
      'reconcile network is lookup/status only',
    );
    assert(
      reconcileCalls
        .filter((call) => call.method !== 'GET')
        .every((call) => call.url.includes('batch_by_distinct_ids')),
      'the only reconcile POST is the read-only batch lookup',
    );
  },
);

Deno.test('quiescence requires two absences at or beyond the configured interval', async () => {
  const h = await dispatchTargets([PERSON_A]);
  h.clock.set('2026-07-13T12:05:00.000Z');
  h.network.handlers.push(lookupAbsent, statusCompleted(PERSON_A));
  await h.executor(claim('reconcile', true), {
    deadlineAtMs: Date.parse('2026-07-13T13:00:00.000Z'),
  });
  assert(h.rpc.records.at(-1)?.resultCode === 'POSTHOG_QUIESCENCE_PENDING', 'one is insufficient');

  h.clock.set('2026-07-13T12:05:59.000Z');
  h.network.handlers.push(lookupAbsent);
  await h.executor(claim('reconcile', true), {
    deadlineAtMs: Date.parse('2026-07-13T13:00:00.000Z'),
  });
  assert(
    (h.store.parsed().absenceObservations as unknown[]).length === 1,
    'too-close observation is not persisted',
  );
  assert(h.rpc.records.at(-1)?.resultCode === 'POSTHOG_QUIESCENCE_PENDING', 'still pending');

  h.clock.set('2026-07-13T12:06:00.000Z');
  h.network.handlers.push(lookupAbsent);
  await h.executor(claim('reconcile', true), {
    deadlineAtMs: Date.parse('2026-07-13T13:00:00.000Z'),
  });
  assert(
    h.rpc.records.at(-1)?.resultCode === 'POSTHOG_DELETION_VERIFIED',
    'exact interval succeeds',
  );
});

Deno.test('person reappearance clears quiescence and reconciliation never mutates it', async () => {
  const h = await dispatchTargets([PERSON_A]);
  h.clock.set('2026-07-13T12:05:00.000Z');
  h.network.handlers.push(lookupAbsent, statusCompleted(PERSON_A));
  await h.executor(claim('reconcile', true), {
    deadlineAtMs: Date.parse('2026-07-13T13:00:00.000Z'),
  });
  h.clock.set('2026-07-13T12:06:00.000Z');
  h.network.handlers.push(lookupFound(PERSON_A));
  await h.executor(claim('reconcile', true), {
    deadlineAtMs: Date.parse('2026-07-13T13:00:00.000Z'),
  });
  assert(h.rpc.records.at(-1)?.resultCode === 'POSTHOG_PERSON_REAPPEARED', 'reappearance blocks');
  assertDeepEqual(h.store.parsed().absenceObservations, []);
  assert(
    h.network.calls.filter((call) => call.url.includes('bulk_delete')).length === 1,
    'reappearance is never blindly deleted',
  );

  h.clock.set('2026-07-13T12:07:00.000Z');
  h.network.handlers.push(lookupAbsent);
  await h.executor(claim('reconcile', true), {
    deadlineAtMs: Date.parse('2026-07-13T13:00:00.000Z'),
  });
  assert(h.rpc.records.at(-1)?.resultCode === 'POSTHOG_QUIESCENCE_PENDING', 'fresh first absence');
  h.clock.set('2026-07-13T12:08:00.000Z');
  h.network.handlers.push(lookupAbsent);
  await h.executor(claim('reconcile', true), {
    deadlineAtMs: Date.parse('2026-07-13T13:00:00.000Z'),
  });
  assert(h.rpc.records.at(-1)?.resultCode === 'POSTHOG_DELETION_VERIFIED', 'fresh pair succeeds');
});

Deno.test(
  'missing status remains ambiguous and malformed status becomes action-required',
  async () => {
    for (const [handler, expected] of [
      [
        statusMissing,
        {
          outcome: 'ambiguous',
          resultCode: 'POSTHOG_STATUS_UNATTESTED',
        },
      ],
      [
        (() => response(200, { count: 'one', results: [] })) as NetworkHandler,
        {
          outcome: 'action_required',
          resultCode: 'POSTHOG_STATUS_UNATTESTED',
        },
      ],
    ] as const) {
      const h = await dispatchTargets([PERSON_A]);
      h.clock.set('2026-07-13T12:05:00.000Z');
      h.network.handlers.push(lookupAbsent, handler);
      await h.executor(claim('reconcile', true), {
        deadlineAtMs: Date.parse('2026-07-13T13:00:00.000Z'),
      });
      assert(h.rpc.records.at(-1)?.outcome === expected.outcome, 'safe outcome');
      assert(h.rpc.records.at(-1)?.resultCode === expected.resultCode, 'stable code');
      assert(
        h.network.calls.filter((call) => call.url.includes('bulk_delete')).length === 1,
        'no redispatch on uncertain status',
      );
    }
  },
);

Deno.test('recording attestation is explicit, durable, current, and fail-closed', async () => {
  for (const noRecordingsEvidence of [
    undefined,
    {
      recordingsCollected: true,
      durable: true as const,
      evidence: 'production_capture_disabled_and_storage_audited' as const,
      verifiedAt: RECORDING_AUDIT,
    },
    {
      recordingsCollected: false,
      durable: true as const,
      evidence: 'production_capture_disabled_and_storage_audited' as const,
      verifiedAt: '2026-07-13T11:49:59.000Z',
    },
  ]) {
    const h = harness({ config: configuration({ noRecordingsEvidence }) });
    await h.executor(claim('dispatch', false), {
      deadlineAtMs: Date.parse('2026-07-13T13:00:00.000Z'),
    });
    assertDeepEqual(h.rpc.records, [
      {
        outcome: 'action_required',
        resultCode: 'POSTHOG_RECORDING_VERIFICATION_REQUIRED',
        retryAt: null,
      },
    ]);
    assert(h.network.calls.length === 0, 'unattested recording posture never mutates');
  }
});

Deno.test('request cap and deadline stop new side effects and permit safe resume', async () => {
  const h = harness({
    config: configuration({ maxNetworkRequestsPerInvocation: 1 }),
  });
  h.network.handlers.push(lookupFound(PERSON_A));
  await h.executor(claim('dispatch', false), {
    deadlineAtMs: Date.parse('2026-07-13T13:00:00.000Z'),
  });
  assert(h.rpc.markCount === 0, 'cap stops before mutation marker');
  assert(h.rpc.records.at(-1)?.resultCode === 'POSTHOG_DELETE_RETRY', 'safe retry');
  assert(h.store.parsed().dispatchEvidence === null, 'prepared state persisted');

  h.network.handlers.push(bulkQueued(1));
  await h.executor(claim('dispatch', true), {
    deadlineAtMs: Date.parse('2026-07-13T13:00:00.000Z'),
  });
  assert(Number(h.rpc.markCount) === 1, 'resume dispatches once');
  assert(
    h.network.calls.filter((call) => call.url.includes('bulk_delete')).length === 1,
    'one mutation',
  );

  const expired = harness();
  await expired.executor(claim('dispatch', false), {
    deadlineAtMs: Date.parse(DISPATCH_TIME),
  });
  assert(expired.network.calls.length === 0, 'deadline prevents network');
  assert(expired.rpc.markCount === 0, 'deadline prevents request marker');
  assert(
    expired.rpc.records.at(-1)?.resultCode === 'POSTHOG_LOOKUP_RETRY',
    'lease released safely',
  );
});

Deno.test(
  'noncanonical, malformed, and oversized encrypted plaintext fails closed without disclosure',
  async () => {
    for (const bytes of [
      new TextEncoder().encode(
        '{ "version":1,"mode":"not_required","attestedAt":"2026-07-13T12:00:00.000Z"}',
      ),
      new TextEncoder().encode(
        '{"version":2,"mode":"not_required","attestedAt":"2026-07-13T12:00:00.000Z"}',
      ),
      new Uint8Array(30_000).fill(65),
    ]) {
      const store = new MemoryStateStore();
      store.bytes = bytes;
      const h = harness({ store });
      await h.executor(claim('reconcile', true), {
        deadlineAtMs: Date.parse('2026-07-13T13:00:00.000Z'),
      });
      assertDeepEqual(h.rpc.records, [
        {
          outcome: 'action_required',
          resultCode: 'POSTHOG_STATUS_UNATTESTED',
          retryAt: null,
        },
      ]);
      const publicResult = JSON.stringify(h.rpc.records);
      assert(!publicResult.includes(USER_ID), 'result omits account ID');
      assert(!publicResult.includes(PERSON_A), 'result omits provider ID');
      assert(!publicResult.includes(SECRET), 'result omits secret');
    }
  },
);

Deno.test('invalid claim and dependency errors expose stable codes only', async () => {
  const h = harness();
  try {
    await h.executor(
      { ...claim('dispatch'), userId: PERSON_A.toUpperCase() },
      {
        deadlineAtMs: Date.parse('2026-07-13T13:00:00.000Z'),
      },
    );
    throw new Error('expected invalid claim');
  } catch (error) {
    assert(
      error instanceof PostHogDeletionExecutorError &&
        error.code === 'POSTHOG_EXECUTOR_INPUT_INVALID',
      'invalid claim is stable',
    );
    assert(!error.message.includes(USER_ID), 'no ID in error');
  }

  const crashing = harness({
    config: configuration({
      appEnvironment: 'development',
      publicAppEnvironment: undefined,
      mobileKey: undefined,
      host: undefined,
      projectId: undefined,
      personalApiKey: undefined,
      captureShutdownAt: undefined,
      noRecordingsEvidence: undefined,
    }),
  });
  crashing.store.failSaveNumber = 1;
  try {
    await crashing.executor(claim('dispatch', false), {
      deadlineAtMs: Date.parse('2026-07-13T13:00:00.000Z'),
    });
    throw new Error('expected dependency error');
  } catch (error) {
    assert(
      error instanceof PostHogDeletionExecutorError &&
        error.code === 'POSTHOG_EXECUTOR_DEPENDENCY_FAILED',
      'save failure is generic',
    );
    assert(!error.message.includes(PERSON_A), 'no provider ID in error');
    assert(!error.message.includes(SECRET), 'no secret in error');
  }
  assert(crashing.rpc.markCount === 0, 'state must persist before marker');
  assert(crashing.rpc.records.length === 0, 'no false result after state crash');
});
