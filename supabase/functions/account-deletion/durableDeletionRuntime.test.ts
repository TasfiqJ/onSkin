import {
  deletionPayloadEnvelopeFromByteaRpc,
  loadDeletionPayloadKeyFromEnv,
  openDeletionPayload,
} from './durableDeletionCrypto.ts';
import { decodeAppleDeletionPayload } from './durableDeletionPayloads.ts';
import {
  createDurableDeletionRuntime,
  type DurableDeletionRuntimeClient,
  DurableDeletionRuntimeError,
} from './durableDeletionRuntime.ts';

const USER_ID = '22222222-2222-4222-8222-222222222222';
const OPERATION_ID = '11111111-1111-4111-8111-111111111111';
const IDEMPOTENCY = '01'.repeat(32);
const CAPABILITY = '23'.repeat(32);
const NOW = Date.parse('2026-07-13T12:00:00.000Z');

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function environment(): Record<string, string> {
  return {
    ACCOUNT_DELETION_PAYLOAD_KEY_HEX: '10'.repeat(32),
    ACCOUNT_DELETION_RECEIPT_HMAC_KEY_HEX: '20'.repeat(32),
    ACCOUNT_DELETION_RECEIPT_HMAC_KEY_VERSION: '1',
    ACCOUNT_DELETION_WORKER_SECRET: '30'.repeat(32),
    REVENUECAT_PROJECT_ID: 'proj_test',
    REVENUECAT_V2_SECRET_API_KEY: 'sk_test',
    REVENUECAT_IDENTITY_TOMBSTONE_HMAC_KEYS: `1=${'40'.repeat(32)}`,
    REVENUECAT_IDENTITY_TOMBSTONE_HMAC_CURRENT_VERSION: '1',
    APP_ENV: 'development',
    EXPO_PUBLIC_APP_ENV: 'development',
  };
}

class FakeClient implements DurableDeletionRuntimeClient {
  readonly calls: Array<{ name: string; args: Record<string, unknown> }> = [];

  auth: DurableDeletionRuntimeClient['auth'] = {
    getUser: (_token: string) =>
      Promise.resolve({
        data: {
          user: {
            id: USER_ID,
            app_metadata: { providers: ['apple'] },
            identities: [
              {
                id: 'apple-subject',
                provider: 'apple',
                identity_data: { sub: 'apple-subject' },
              },
            ],
          },
        },
        error: null,
      }),
    admin: {
      deleteUser: (_userId: string, _soft: false) => Promise.resolve({ data: {}, error: null }),
      getUserById: (_userId: string) =>
        Promise.resolve({
          data: null,
          error: { code: 'user_not_found', status: 404 },
        }),
    },
  };

  storage = {
    from: (_bucket: 'photos') => ({
      remove: (_paths: string[]) => Promise.resolve({ data: [], error: null }),
    }),
  };

  rpc(name: string, args: Record<string, unknown>): Promise<{ data: unknown; error: unknown }> {
    this.calls.push({ name, args });
    switch (name) {
      case 'consume_edge_rate_limit':
        return Promise.resolve({ data: true, error: null });
      case 'begin_account_deletion':
        return Promise.resolve({
          data: [
            {
              operation_id: OPERATION_ID,
              operation_state: 'pending',
              operation_expires_at: args.p_operation_expires_at,
              created: true,
            },
          ],
          error: null,
        });
      case 'get_account_deletion_status':
        return Promise.resolve({ data: [], error: null });
      case 'get_account_deletion_barrier_state':
        return Promise.resolve({ data: 'clear', error: null });
      case 'claim_next_account_deletion_step':
      case 'list_account_deletions_ready_to_finalize':
        return Promise.resolve({ data: [], error: null });
      case 'purge_expired_account_deletion_artifacts':
        return Promise.resolve({
          data: [
            {
              receipts_deleted: 0,
              operations_deleted: 0,
              encrypted_credentials_redacted: 0,
              active_accounts_retained: 0,
              operator_audits_deleted: 0,
            },
          ],
          error: null,
        });
      case 'purge_expired_edge_rate_limits':
      case 'purge_expired_revenuecat_identity_tombstones':
        return Promise.resolve({ data: 0, error: null });
      default:
        return Promise.reject(new Error(`unexpected RPC:${name}`));
    }
  }
}

Deno.test(
  'runtime authenticates intake, encrypts Apple evidence, and runs empty maintenance',
  async () => {
    const client = new FakeClient();
    const env = environment();
    const runtime = await createDurableDeletionRuntime({
      client,
      readEnvironment: (name) => env[name],
      now: () => NOW,
      schedule: () => undefined,
    });
    assert(runtime.workerSecret === env.ACCOUNT_DELETION_WORKER_SECRET, 'worker secret');
    const user = await runtime.authenticate('jwt');
    assert(
      user?.id === USER_ID && user.appleLinked && user.appleSubject === 'apple-subject',
      'verified Apple user and subject',
    );
    assert(await runtime.consumeIntakeRateLimit(USER_ID), 'intake rate');
    assert(await runtime.consumeIntakeRateLimit(USER_ID), 'intake retry rate');
    assert((await runtime.barrierState(USER_ID)) === 'clear', 'session preflight');
    const intakeCalls = client.calls.filter(
      (call) =>
        call.name === 'consume_edge_rate_limit' && call.args.p_scope === 'account-deletion-intake',
    );
    assert(intakeCalls.length === 2, 'both owner attempts are counted');
    assert(
      intakeCalls[0].args.p_key_hash === intakeCalls[1].args.p_key_hash &&
        typeof intakeCalls[0].args.p_key_hash === 'string' &&
        /^[a-f0-9]{64}$/.test(intakeCalls[0].args.p_key_hash),
      'caller-minted idempotency keys cannot select intake buckets',
    );
    const barrierCall = client.calls.find(
      (call) => call.name === 'get_account_deletion_barrier_state',
    );
    assert(barrierCall?.args.p_user_id === USER_ID, 'preflight uses only the verified Auth owner');
    const began = await runtime.begin(user!, {
      action: 'begin',
      idempotencyKey: IDEMPOTENCY,
      statusCapability: CAPABILITY,
      appleAuthorizationCode: 'one-time-code',
    });
    assert(
      began.operationState === 'pending' && began.created && began.operationId === OPERATION_ID,
      'durable operation',
    );
    const beginCall = client.calls.find((call) => call.name === 'begin_account_deletion');
    assert(beginCall !== undefined, 'begin RPC called');
    const encrypted = beginCall.args.p_apple_encrypted_credential;
    assert(typeof encrypted === 'string' && encrypted.startsWith('\\x'), 'bytea envelope');
    assert(!encrypted.includes('one-time-code'), 'code never plaintext in database call');
    assert(beginCall.args.p_revenuecat_encrypted_reconciliation === null, 'RC starts empty');
    assert(beginCall.args.p_posthog_encrypted_reconciliation === null, 'PostHog starts empty');

    const key = await loadDeletionPayloadKeyFromEnv((name) => env[name]);
    const plaintext = await openDeletionPayload({
      key,
      userId: USER_ID,
      stepName: 'apple_revoke',
      serializedEnvelope: deletionPayloadEnvelopeFromByteaRpc('apple_revoke', encrypted),
    });
    try {
      const payload = decodeAppleDeletionPayload(plaintext);
      assert(
        payload.phase === 'authorization_code' && payload.expectedAppleSubject === 'apple-subject',
        'recoverable Apple phase is bound to the authenticated subject',
      );
    } finally {
      plaintext.fill(0);
    }

    assert((await runtime.status(CAPABILITY)).kind === 'not_found', 'opaque miss');
    const report = await runtime.runWorker();
    assert(report.claimsProcessed === 0, 'no fake work');
    assert(
      client.calls.some((call) => call.name === 'purge_expired_revenuecat_identity_tombstones'),
      'tombstone maintenance included',
    );
  },
);

Deno.test(
  'runtime distinguishes authoritative bearer rejection from Auth dependency failure',
  async () => {
    const client = new FakeClient();
    const env = environment();
    const runtime = await createDurableDeletionRuntime({
      client,
      readEnvironment: (name) => env[name],
      now: () => NOW,
      schedule: () => undefined,
    });

    for (const error of [
      { name: 'AuthSessionMissingError', status: 400 },
      { name: 'AuthApiError', status: 401 },
      { name: 'AuthApiError', status: 404, code: 'user_not_found' },
    ]) {
      client.auth.getUser = () => Promise.resolve({ data: { user: null }, error });
      assert(
        (await runtime.authenticate('rejected-jwt')) === null,
        'authoritative Auth rejection must remain an unauthenticated result',
      );
    }

    for (const error of [
      { name: 'AuthRetryableFetchError', status: 503 },
      { name: 'AuthApiError', status: 429, code: 'over_request_rate_limit' },
    ]) {
      client.auth.getUser = () => Promise.resolve({ data: { user: null }, error });
      let code = '';
      try {
        await runtime.authenticate('candidate-jwt');
      } catch (caught) {
        code = caught instanceof DurableDeletionRuntimeError ? caught.code : 'unexpected';
      }
      assert(
        code === 'DELETION_AUTHENTICATION_UNAVAILABLE',
        'retryable returned Auth errors must remain unavailable',
      );
    }

    client.auth.getUser = () => Promise.reject(new Error('private transport failure'));
    let thrownCode = '';
    try {
      await runtime.authenticate('candidate-jwt');
    } catch (caught) {
      thrownCode = caught instanceof DurableDeletionRuntimeError ? caught.code : 'unexpected';
    }
    assert(
      thrownCode === 'DELETION_AUTHENTICATION_UNAVAILABLE',
      'thrown Auth transport failures must remain unavailable',
    );

    client.auth.getUser = () => Promise.resolve({ data: { user: null }, error: null });
    let malformedCode = '';
    try {
      await runtime.authenticate('candidate-jwt');
    } catch (caught) {
      malformedCode = caught instanceof DurableDeletionRuntimeError ? caught.code : 'unexpected';
    }
    assert(
      malformedCode === 'DELETION_AUTHENTICATION_UNAVAILABLE',
      'malformed successful Auth responses must not become bearer rejection',
    );
  },
);

Deno.test(
  'runtime rejects missing mandatory deletion configuration with a stable code',
  async () => {
    const env = environment();
    delete env.REVENUECAT_PROJECT_ID;
    let code = '';
    try {
      await createDurableDeletionRuntime({
        client: new FakeClient(),
        readEnvironment: (name) => env[name],
        now: () => NOW,
        schedule: () => undefined,
      });
    } catch (error) {
      code = error instanceof DurableDeletionRuntimeError ? error.code : 'unexpected';
    }
    assert(code === 'DELETION_RUNTIME_CONFIGURATION_INVALID', 'fail closed');
  },
);

Deno.test('runtime requires one valid, non-conflicting application environment', async () => {
  for (const mutate of [
    (env: Record<string, string>) => delete env.APP_ENV,
    (env: Record<string, string>) => {
      env.APP_ENV = 'preview';
    },
    (env: Record<string, string>) => {
      env.APP_ENV = 'production';
      env.EXPO_PUBLIC_APP_ENV = 'staging';
    },
    (env: Record<string, string>) => {
      env.EXPO_PUBLIC_APP_ENV = '';
    },
  ]) {
    const env = environment();
    mutate(env);
    let code = '';
    try {
      await createDurableDeletionRuntime({
        client: new FakeClient(),
        readEnvironment: (name) => env[name],
        now: () => NOW,
        schedule: () => undefined,
      });
    } catch (error) {
      code = error instanceof DurableDeletionRuntimeError ? error.code : 'unexpected';
    }
    assert(
      code === 'DELETION_RUNTIME_CONFIGURATION_INVALID',
      'invalid APP_ENV must fail before an operation can persist not-required state',
    );
  }
});

Deno.test('runtime never accepts a legacy RevenueCat key for V2 deletion', async () => {
  const env = environment();
  delete env.REVENUECAT_V2_SECRET_API_KEY;
  env.REVENUECAT_SECRET_API_KEY = 'legacy-v1-key';
  let code = '';
  try {
    await createDurableDeletionRuntime({
      client: new FakeClient(),
      readEnvironment: (name) => env[name],
      now: () => NOW,
      schedule: () => undefined,
    });
  } catch (error) {
    code = error instanceof DurableDeletionRuntimeError ? error.code : 'unexpected';
  }
  assert(code === 'DELETION_RUNTIME_CONFIGURATION_INVALID', 'V2 key required');
});

Deno.test('conflicting Apple subjects force the truthful manual fallback', async () => {
  const client = new FakeClient();
  client.auth.getUser = () =>
    Promise.resolve({
      data: {
        user: {
          id: USER_ID,
          app_metadata: { providers: ['apple'] },
          identities: [
            {
              id: 'apple-subject-a',
              provider: 'apple',
              identity_data: { sub: 'apple-subject-b' },
            },
          ],
        },
      },
      error: null,
    });
  const env = environment();
  const runtime = await createDurableDeletionRuntime({
    client,
    readEnvironment: (name) => env[name],
    now: () => NOW,
    schedule: () => undefined,
  });
  const user = await runtime.authenticate('jwt');
  assert(
    user?.appleLinked === true && user.appleSubject === null,
    'conflicting subjects are never selected',
  );
  await runtime.begin(user!, {
    action: 'begin',
    idempotencyKey: IDEMPOTENCY,
    statusCapability: CAPABILITY,
    appleAuthorizationCode: 'must-not-be-exchanged',
  });
  const beginCall = client.calls.find((call) => call.name === 'begin_account_deletion');
  const encrypted = beginCall?.args.p_apple_encrypted_credential;
  assert(typeof encrypted === 'string', 'encrypted Apple state');
  const key = await loadDeletionPayloadKeyFromEnv((name) => env[name]);
  const plaintext = await openDeletionPayload({
    key,
    userId: USER_ID,
    stepName: 'apple_revoke',
    serializedEnvelope: deletionPayloadEnvelopeFromByteaRpc('apple_revoke', encrypted),
  });
  try {
    assert(
      decodeAppleDeletionPayload(plaintext).phase === 'manual',
      'unbound authorization code is discarded',
    );
  } finally {
    plaintext.fill(0);
  }
});
