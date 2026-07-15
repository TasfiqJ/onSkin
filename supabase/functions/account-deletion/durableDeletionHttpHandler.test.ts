import {
  createDurableDeletionHttpHandler,
  type DurableDeletionHttpDependencies,
} from './durableDeletionHttpHandler.ts';
import { DurableDeletionDatabaseError } from './durableDeletionDatabaseGateway.ts';
import type { AccountDeletionWorkerReport } from './durableDeletionWorker.ts';

const IDEMPOTENCY = '01'.repeat(32);
const CAPABILITY = '23'.repeat(32);
const SECRET = '45'.repeat(32);
const USER_ID = '22222222-2222-4222-8222-222222222222';
const SESSION_ID = '33333333-3333-4333-8333-333333333333';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function report(): AccountDeletionWorkerReport {
  return {
    claimsProcessed: 2,
    executorFailures: 0,
    finalized: 1,
    finalizationFailures: 0,
    maintenanceFailed: false,
    deadlineReached: false,
  };
}

function harness() {
  const calls: string[] = [];
  const scheduled: Promise<void>[] = [];
  const dependencies: DurableDeletionHttpDependencies = {
    workerSecret: SECRET,
    maxBodyBytes: 16_384,
    authenticate(token) {
      calls.push(`auth:${token}`);
      return Promise.resolve({
        id: USER_ID,
        sessionId: SESSION_ID,
        appleLinked: true,
        appleSubject: 'apple-subject',
      });
    },
    consumeIntakeRateLimit(userId, sessionId) {
      calls.push(`intake-rate:${userId}:${sessionId}`);
      return Promise.resolve(true);
    },
    consumeStatusRateLimit(capability) {
      calls.push(`status-rate:${capability}`);
      return Promise.resolve(true);
    },
    barrierState(userId, sessionId) {
      calls.push(`barrier:${userId}:${sessionId}`);
      return Promise.resolve('clear');
    },
    reservePublicationLease(userId, sessionId, capability) {
      calls.push(`publication-reserve:${userId}:${sessionId}:${capability}`);
      return Promise.resolve('reserved');
    },
    activatePublicationLease(userId, sessionId, capability) {
      calls.push(`publication-activate:${userId}:${sessionId}:${capability}`);
      return Promise.resolve('active');
    },
    renewPublicationLease(userId, sessionId, capability) {
      calls.push(`publication-renew:${userId}:${sessionId}:${capability}`);
      return Promise.resolve('active');
    },
    releasePublicationLease(capability) {
      calls.push(`publication-release:${capability}`);
      return Promise.resolve('released');
    },
    begin(user, request) {
      calls.push(`begin:${user.id}:${user.sessionId}:${request.idempotencyKey}`);
      return Promise.resolve({
        operationId: '11111111-1111-4111-8111-111111111111',
        operationState: 'pending',
        created: true,
      });
    },
    status(capability) {
      calls.push(`status:${capability}`);
      return Promise.resolve({
        kind: 'operation',
        operationState: 'running',
        phase: 'provider_verifying',
        nextPollAfterSeconds: 30,
      });
    },
    runWorker() {
      calls.push('work');
      return Promise.resolve(report());
    },
    accelerate(operationId, userId) {
      calls.push(`accelerate:${operationId}:${userId}`);
      return Promise.resolve();
    },
    schedule(work) {
      calls.push('schedule');
      scheduled.push(work);
    },
  };
  return { calls, dependencies, scheduled };
}

function request(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('https://example.test/account-deletion', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

async function responseBody(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

Deno.test('durable deletion begin authenticates, commits 202, and accelerates work', async () => {
  const h = harness();
  const handler = createDurableDeletionHttpHandler(h.dependencies);
  const response = await handler(
    request(
      {
        action: 'begin',
        idempotencyKey: IDEMPOTENCY,
        statusCapability: CAPABILITY,
        appleAuthorizationCode: 'fresh-code',
      },
      { authorization: 'Bearer user-jwt' },
    ),
  );
  assert(response.status === 202, 'asynchronous intake');
  assert(
    response.headers.get('cache-control') === 'no-store, max-age=0' &&
      response.headers.get('pragma') === 'no-cache' &&
      response.headers.get('referrer-policy') === 'no-referrer' &&
      response.headers.get('x-content-type-options') === 'nosniff',
    'sensitive deletion responses must not be cached or content-sniffed',
  );
  assert((await responseBody(response)).status === 'accepted', 'opaque response');
  assert(
    h.calls
      .join(',')
      .startsWith(
        `auth:user-jwt,intake-rate:${USER_ID}:${SESSION_ID},begin:${USER_ID}:${SESSION_ID}:${IDEMPOTENCY},accelerate:11111111-1111-4111-8111-111111111111:${USER_ID},schedule`,
      ),
    'barrier before accelerator',
  );
  await Promise.all(h.scheduled);
});

Deno.test(
  'idempotent begin retries share the owner quota and never fan out acceleration',
  async () => {
    const h = harness();
    h.dependencies.begin = (user, request) => {
      h.calls.push(`begin:${user.id}:${user.sessionId}:${request.idempotencyKey}`);
      return Promise.resolve({
        operationId: '11111111-1111-4111-8111-111111111111',
        operationState: 'running',
        created: false,
      });
    };
    const response = await createDurableDeletionHttpHandler(h.dependencies)(
      request(
        {
          action: 'begin',
          idempotencyKey: '67'.repeat(32),
          statusCapability: '89'.repeat(32),
        },
        { authorization: 'Bearer user-jwt' },
      ),
    );
    assert(response.status === 202, 'idempotent retry remains accepted');
    assert(
      h.calls.join(',') ===
        `auth:user-jwt,intake-rate:${USER_ID}:${SESSION_ID},begin:${USER_ID}:${SESSION_ID}:${'67'.repeat(32)}`,
      'caller tokens must not select quota buckets or global accelerators',
    );
    assert(h.scheduled.length === 0, 'existing operation is never accelerated');
  },
);

Deno.test('capability-only status maps pending, completed, invalid, and expired', async () => {
  for (const [lookup, status, publicStatus] of [
    [
      {
        kind: 'operation',
        operationState: 'running',
        phase: 'provider_verifying',
        nextPollAfterSeconds: 30,
      },
      202,
      'pending',
    ],
    [{ kind: 'receipt', receiptState: 'completed' }, 200, 'completed'],
    [{ kind: 'not_found' }, 404, 'invalid'],
    [{ kind: 'expired' }, 410, 'expired'],
  ] as const) {
    const h = harness();
    h.dependencies.status = (capability) => {
      h.calls.push(`status:${capability}`);
      return Promise.resolve(lookup);
    };
    const response = await createDurableDeletionHttpHandler(h.dependencies)(
      request({ action: 'status', capability: CAPABILITY }),
    );
    assert(response.status === status, 'mapped HTTP status');
    assert((await responseBody(response)).status === publicStatus, 'mapped body');
    assert(!h.calls.some((call) => call.startsWith('auth:')), 'no JWT needed');
    assert(
      h.calls.join(',') ===
        (lookup.kind === 'operation' || lookup.kind === 'receipt'
          ? `status:${CAPABILITY},status-rate:${CAPABILITY}`
          : `status:${CAPABILITY}`),
      'invalid and expired capabilities must not amplify writes',
    );
  }
});

Deno.test(
  'authenticated preflight atomically attests the owner for every barrier state',
  async () => {
    for (const state of ['clear', 'active'] as const) {
      const h = harness();
      h.dependencies.barrierState = (userId, sessionId) => {
        h.calls.push(`barrier:${userId}:${sessionId}`);
        return Promise.resolve(state);
      };
      const response = await createDurableDeletionHttpHandler(h.dependencies)(
        request({ action: 'preflight' }, { authorization: 'Bearer user-jwt' }),
      );
      assert(response.status === 200, 'preflight accepted');
      const body = await responseBody(response);
      assert(
        Object.keys(body).length === 2 && body.status === state && body.ownerSubject === USER_ID,
        'preflight discloses only state plus the authenticated-owner attestation',
      );
      assert(
        h.calls.join(',') === `auth:user-jwt,barrier:${USER_ID}:${SESSION_ID}`,
        'verified owner selects the service-only lookup',
      );
    }
  },
);

Deno.test('preflight rejects missing and stale bearer sessions before database work', async () => {
  const h = harness();
  h.dependencies.authenticate = (token) => {
    h.calls.push(`auth:${token}`);
    return Promise.resolve(null);
  };
  const handler = createDurableDeletionHttpHandler(h.dependencies);

  const missing = await handler(request({ action: 'preflight' }));
  assert(missing.status === 401, 'bearer required');
  const missingBody = await responseBody(missing);
  assert(
    Object.keys(missingBody).length === 1 &&
      missingBody.error === 'ACCOUNT_DELETION_SESSION_REJECTED',
    'missing preflight bearer returns only the stable lane-specific code',
  );
  const stale = await handler(
    request({ action: 'preflight' }, { authorization: 'Bearer stale-jwt' }),
  );
  assert(stale.status === 401, 'stale JWT rejected');
  const body = await responseBody(stale);
  assert(
    Object.keys(body).length === 1 && body.error === 'ACCOUNT_DELETION_SESSION_REJECTED',
    'authoritative rejection returns only the stable public code',
  );
  assert(!h.calls.some((call) => call.startsWith('barrier:')), 'no stale-owner lookup');
});

Deno.test(
  'database-revoked sessions cannot preflight, consume intake quota, or begin',
  async () => {
    for (const action of ['preflight', 'begin'] as const) {
      const h = harness();
      if (action === 'preflight') {
        h.dependencies.barrierState = () =>
          Promise.reject(new DurableDeletionDatabaseError('DELETION_DATABASE_SESSION_REJECTED'));
      } else {
        h.dependencies.consumeIntakeRateLimit = () =>
          Promise.reject(new DurableDeletionDatabaseError('DELETION_DATABASE_SESSION_REJECTED'));
      }
      const response = await createDurableDeletionHttpHandler(h.dependencies)(
        request(
          action === 'preflight'
            ? { action }
            : {
                action,
                idempotencyKey: IDEMPOTENCY,
                statusCapability: CAPABILITY,
              },
          { authorization: 'Bearer signed-out-jwt' },
        ),
      );
      assert(response.status === 401, 'database session rejection remains authoritative');
      assert(
        (await responseBody(response)).error === 'ACCOUNT_DELETION_SESSION_REJECTED',
        'stale session exposes only the stable rejection code',
      );
      assert(!h.calls.some((call) => call.startsWith('begin:')), 'stale session cannot begin');
      assert(
        action !== 'preflight' || !h.calls.some((call) => call.startsWith('intake-rate:')),
        'preflight rejection cannot consume intake quota',
      );
    }
  },
);

Deno.test('preflight validates the authenticated subject before every barrier lookup', async () => {
  const h = harness();
  h.dependencies.authenticate = () =>
    Promise.resolve({
      id: 'not-a-uuid',
      sessionId: SESSION_ID,
      appleLinked: false,
      appleSubject: null,
    });
  h.dependencies.barrierState = (userId, sessionId) => {
    h.calls.push(`barrier:${userId}:${sessionId}`);
    return Promise.resolve('clear');
  };

  const response = await createDurableDeletionHttpHandler(h.dependencies)(
    request({ action: 'preflight' }, { authorization: 'Bearer candidate-jwt' }),
  );

  assert(response.status === 401, 'malformed owner attestation must be rejected');
  const body = await responseBody(response);
  assert(
    Object.keys(body).length === 1 && body.error === 'ACCOUNT_DELETION_SESSION_REJECTED',
    'malformed authenticated subject exposes only the stable rejection code',
  );
  assert(
    !h.calls.some((call) => call.startsWith('barrier:')),
    'invalid subject cannot reach lookup',
  );
});

Deno.test(
  'preflight maps Auth dependency failure to bounded retryable unavailability',
  async () => {
    const h = harness();
    h.dependencies.authenticate = () =>
      Promise.reject(new Error(`private transport failure for ${USER_ID}`));
    const response = await createDurableDeletionHttpHandler(h.dependencies)(
      request({ action: 'preflight' }, { authorization: 'Bearer candidate-jwt' }),
    );

    assert(response.status === 503, 'Auth dependency failure remains retryable');
    const body = await responseBody(response);
    assert(
      Object.keys(body).length === 1 && body.error === 'ACCOUNT_DELETION_UNAVAILABLE',
      'Auth failure exposes only the identifier-free stable public code',
    );
    assert(!h.calls.some((call) => call.startsWith('barrier:')), 'no unauthenticated owner lookup');
  },
);

Deno.test(
  'publication reserve, activate, and renew require the verified Auth session binding',
  async () => {
    for (const [action, publicStatus, callPrefix] of [
      ['publication_reserve', 'reserved', 'publication-reserve'],
      ['publication_activate', 'active', 'publication-activate'],
      ['publication_renew', 'active', 'publication-renew'],
    ] as const) {
      const h = harness();
      const response = await createDurableDeletionHttpHandler(h.dependencies)(
        request({ action, capability: CAPABILITY }, { authorization: 'Bearer verified-jwt' }),
      );
      const body = await responseBody(response);
      assert(response.status === 200, `${action} accepted`);
      assert(
        Object.keys(body).length === 1 && body.status === publicStatus,
        `${action} returns only its exact success status`,
      );
      assert(
        h.calls.join(',') ===
          `auth:verified-jwt,${callPrefix}:${USER_ID}:${SESSION_ID}:${CAPABILITY}`,
        `${action} passes the verified user and session binding`,
      );
    }
  },
);

Deno.test('publication release is capability-only and accepts only exact released', async () => {
  const success = harness();
  const released = await createDurableDeletionHttpHandler(success.dependencies)(
    request(
      { action: 'publication_release', capability: CAPABILITY },
      { authorization: 'Bearer stale-or-deleted-user-jwt' },
    ),
  );
  const releasedBody = await responseBody(released);
  assert(released.status === 200, 'release survives Auth hard deletion');
  assert(
    Object.keys(releasedBody).length === 1 && releasedBody.status === 'released',
    'release response is exact',
  );
  assert(
    success.calls.join(',') === `publication-release:${CAPABILITY}`,
    'release never authenticates the stale bearer',
  );

  for (const malformedStatus of [
    'blocked',
    'session_rejected',
    'lease_rejected',
    'active',
    'reserved',
  ] as const) {
    const h = harness();
    h.dependencies.releasePublicationLease = () => Promise.resolve(malformedStatus);
    const response = await createDurableDeletionHttpHandler(h.dependencies)(
      request({ action: 'publication_release', capability: CAPABILITY }),
    );
    assert(response.status === 503, 'non-released release status is malformed');
    assert(
      (await responseBody(response)).error === 'ACCOUNT_PUBLICATION_UNAVAILABLE',
      'malformed release exposes only bounded unavailability',
    );
  }
});

Deno.test('publication lease outcomes map to exact bounded responses', async () => {
  for (const [rpcStatus, httpStatus, errorCode] of [
    ['blocked', 409, 'ACCOUNT_DELETION_ACTIVE'],
    ['session_rejected', 401, 'ACCOUNT_PUBLICATION_SESSION_REJECTED'],
    ['lease_rejected', 409, 'ACCOUNT_PUBLICATION_LEASE_REJECTED'],
  ] as const) {
    const h = harness();
    h.dependencies.reservePublicationLease = () => Promise.resolve(rpcStatus);
    const response = await createDurableDeletionHttpHandler(h.dependencies)(
      request(
        { action: 'publication_reserve', capability: CAPABILITY },
        { authorization: 'Bearer verified-jwt' },
      ),
    );
    const body = await responseBody(response);
    assert(response.status === httpStatus, `${rpcStatus} HTTP mapping`);
    assert(
      Object.keys(body).length === 1 && body.error === errorCode,
      `${rpcStatus} public mapping is exact`,
    );
  }
});

Deno.test('publication authentication and dependency failures fail closed by lane', async () => {
  const missing = harness();
  const missingResponse = await createDurableDeletionHttpHandler(missing.dependencies)(
    request({ action: 'publication_reserve', capability: CAPABILITY }),
  );
  assert(missingResponse.status === 401, 'publication reserve needs bearer');
  assert(
    (await responseBody(missingResponse)).error === 'ACCOUNT_PUBLICATION_SESSION_REJECTED',
    'missing bearer has lane-specific rejection',
  );

  const stale = harness();
  stale.dependencies.authenticate = () => Promise.resolve(null);
  const staleResponse = await createDurableDeletionHttpHandler(stale.dependencies)(
    request(
      { action: 'publication_renew', capability: CAPABILITY },
      { authorization: 'Bearer stale-jwt' },
    ),
  );
  assert(staleResponse.status === 401, 'stale JWT rejected');
  assert(
    (await responseBody(staleResponse)).error === 'ACCOUNT_PUBLICATION_SESSION_REJECTED',
    'stale JWT has lane-specific rejection',
  );
  assert(
    !stale.calls.some((call) => call.startsWith('publication-renew:')),
    'stale session never reaches RPC',
  );

  const malformedSession = harness();
  malformedSession.dependencies.authenticate = () =>
    Promise.resolve({
      id: USER_ID,
      sessionId: 'not-a-session-id',
      appleLinked: false,
      appleSubject: null,
    });
  const malformedResponse = await createDurableDeletionHttpHandler(malformedSession.dependencies)(
    request(
      { action: 'publication_activate', capability: CAPABILITY },
      { authorization: 'Bearer malformed-session-jwt' },
    ),
  );
  assert(malformedResponse.status === 401, 'malformed session binding rejected');
  assert(
    (await responseBody(malformedResponse)).error === 'ACCOUNT_PUBLICATION_SESSION_REJECTED',
    'malformed session binding has lane-specific rejection',
  );

  for (const dependency of ['authentication', 'database'] as const) {
    const h = harness();
    if (dependency === 'authentication') {
      h.dependencies.authenticate = () => Promise.reject(new Error('private Auth transport'));
    } else {
      h.dependencies.reservePublicationLease = () =>
        Promise.reject(new Error('private database transport'));
    }
    const response = await createDurableDeletionHttpHandler(h.dependencies)(
      request(
        { action: 'publication_reserve', capability: CAPABILITY },
        { authorization: 'Bearer candidate-jwt' },
      ),
    );
    assert(response.status === 503, `${dependency} failure remains retryable`);
    assert(
      (await responseBody(response)).error === 'ACCOUNT_PUBLICATION_UNAVAILABLE',
      `${dependency} failure uses publication-lane unavailability`,
    );
  }
});

Deno.test('worker lane requires the dedicated constant-time header', async () => {
  for (const [supplied, expected] of [
    [undefined, 401],
    [`${SECRET}0`, 401],
    [SECRET, 200],
  ] as const) {
    const h = harness();
    const response = await createDurableDeletionHttpHandler(h.dependencies)(
      request(
        { action: 'work' },
        supplied === undefined ? {} : { 'x-account-deletion-worker-secret': supplied },
      ),
    );
    assert(response.status === expected, 'worker authorization');
  }
});

Deno.test(
  'HTTP boundary rejects malformed, oversized, unauthenticated, and rate-limited input',
  async () => {
    const h = harness();
    const handler = createDurableDeletionHttpHandler(h.dependencies);
    const malformed = await handler(request({ action: 'status', capability: 'bad' }));
    assert(malformed.status === 400, 'strict body');

    const unauthenticated = await handler(
      request({
        action: 'begin',
        idempotencyKey: IDEMPOTENCY,
        statusCapability: CAPABILITY,
      }),
    );
    assert(unauthenticated.status === 401, 'JWT required for intake');

    h.dependencies.consumeStatusRateLimit = () => Promise.resolve(false);
    const limited = await handler(request({ action: 'status', capability: CAPABILITY }));
    assert(limited.status === 429, 'status capability rate limited');

    const oversized = new Request('https://example.test', {
      method: 'POST',
      headers: { 'content-length': '70000' },
      body: '{}',
    });
    assert((await handler(oversized)).status === 413, 'length rejected early');
  },
);

Deno.test('dependency failures expose only one stable public code', async () => {
  for (const failed of ['begin', 'preflight', 'status', 'work'] as const) {
    const h = harness();
    if (failed === 'begin') {
      h.dependencies.begin = () => Promise.reject(new Error('private'));
    }
    if (failed === 'status') {
      h.dependencies.status = () => Promise.reject(new Error('private'));
    }
    if (failed === 'preflight') {
      h.dependencies.barrierState = () => Promise.reject(new Error('private'));
    }
    if (failed === 'work') {
      h.dependencies.runWorker = () => Promise.reject(new Error('private'));
    }
    const body =
      failed === 'begin'
        ? {
            action: 'begin',
            idempotencyKey: IDEMPOTENCY,
            statusCapability: CAPABILITY,
          }
        : failed === 'preflight'
          ? { action: 'preflight' }
          : failed === 'status'
            ? { action: 'status', capability: CAPABILITY }
            : { action: 'work' };
    const headers: Record<string, string> =
      failed === 'begin' || failed === 'preflight'
        ? { authorization: 'Bearer jwt' }
        : failed === 'work'
          ? { 'x-account-deletion-worker-secret': SECRET }
          : {};
    const response = await createDurableDeletionHttpHandler(h.dependencies)(request(body, headers));
    assert(response.status === 503, 'contained dependency error');
    assert(
      (await responseBody(response)).error === 'ACCOUNT_DELETION_UNAVAILABLE',
      'stable public code',
    );
  }
});
