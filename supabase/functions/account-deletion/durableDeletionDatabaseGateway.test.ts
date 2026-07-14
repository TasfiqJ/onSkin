import {
  type DeletionRpcClient,
  type DeletionRpcResult,
  DurableDeletionDatabaseError,
  DurableDeletionDatabaseGateway,
} from './durableDeletionDatabaseGateway.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const OPERATION_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';
const SESSION_ID = '33333333-3333-4333-8333-333333333333';
const TOKEN = 'ab'.repeat(32);
const NOW = '2026-07-13T12:00:00.000Z';
const LATER = '2026-07-14T12:00:00.000Z';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

class QueueClient implements DeletionRpcClient {
  readonly calls: Array<{ name: string; args: Record<string, unknown> }> = [];

  constructor(private readonly results: DeletionRpcResult[]) {}

  rpc(name: string, args: Record<string, unknown>): Promise<DeletionRpcResult> {
    this.calls.push({ name, args });
    const result = this.results.shift();
    if (result === undefined) throw new Error('missing fake RPC result');
    return Promise.resolve(result);
  }
}

function ok(data: unknown): DeletionRpcResult {
  return { data, error: null };
}

Deno.test('database gateway accepts the installed Supabase PostgREST RPC envelope', async () => {
  let requests = 0;
  const installedClient = createClient('https://contract-test.supabase.co', 'contract-test-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (_input, init) => {
        requests += 1;
        assert(
          (init as { method?: string } | undefined)?.method === 'POST',
          'Supabase RPC uses POST',
        );
        return Promise.resolve(
          new Response(JSON.stringify('clear'), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        );
      },
    },
  });
  const gateway = new DurableDeletionDatabaseGateway(
    installedClient as unknown as DeletionRpcClient,
  );
  assert(
    (await gateway.barrierState(USER_ID, SESSION_ID)) === 'clear',
    'installed six-field success envelope is normalized',
  );
  assert(requests === 1, 'one real client RPC envelope exercised');
});

Deno.test('database gateway maps begin and validates opaque status rows', async () => {
  const statusRow = {
    operation_id: OPERATION_ID,
    operation_state: 'running',
    operation_expires_at: LATER,
    next_step_name: 'apple_revoke',
    next_step_status: 'pending',
    attempt_count: 0,
    next_attempt_at: NOW,
    lease_expires_at: null,
    receipt_expires_at: null,
    apple_manual_revocation_required: null,
  };
  const client = new QueueClient([
    ok([
      {
        operation_id: OPERATION_ID,
        operation_state: 'pending',
        operation_expires_at: LATER,
        created: true,
      },
    ]),
    ok([statusRow]),
    ok('active'),
  ]);
  const gateway = new DurableDeletionDatabaseGateway(client);
  const began = await gateway.begin({
    userId: USER_ID,
    sessionId: SESSION_ID,
    idempotencyKey: '01'.repeat(32),
    capability: '23'.repeat(32),
    operationExpiresAt: LATER,
    appleEncryptedPayload: '\\x00',
    revenueCatEncryptedPayload: null,
    postHogEncryptedPayload: '\\x01',
  });
  assert(began.created && began.operationId === OPERATION_ID, 'begin mapped');
  assert((await gateway.status('23'.repeat(32))) === statusRow, 'status mapped');
  assert((await gateway.barrierState(USER_ID, SESSION_ID)) === 'active', 'opaque barrier mapped');
  assert(client.calls[0]?.name === 'begin_account_deletion', 'begin RPC');
  assert(
    client.calls[0]?.args.p_session_id === SESSION_ID &&
      client.calls[0]?.args.p_apple_encrypted_credential === '\\x00',
    'begin carries the live session and canonical bytea',
  );
  assert(
    client.calls[2]?.args.p_user_id === USER_ID &&
      client.calls[2]?.args.p_session_id === SESSION_ID &&
      Object.keys(client.calls[2].args).length === 2,
    'preflight carries only the exact user/session binding',
  );
});

Deno.test('database gateway preserves only the exact session-rejection SQLSTATE', async () => {
  for (const [error, expected] of [
    [
      { code: '28000', message: 'ACCOUNT_DELETION_SESSION_REJECTED', details: null, hint: null },
      'DELETION_DATABASE_SESSION_REJECTED',
    ],
    [
      { code: 'P0001', message: 'ACCOUNT_DELETION_SESSION_REJECTED', details: null, hint: null },
      'DELETION_DATABASE_UNAVAILABLE',
    ],
    [
      { code: '28000', message: 'private database detail', details: null, hint: null },
      'DELETION_DATABASE_UNAVAILABLE',
    ],
  ] as const) {
    const gateway = new DurableDeletionDatabaseGateway(
      new QueueClient([{ data: null, error }]),
    );
    let code = 'none';
    try {
      await gateway.barrierState(USER_ID, SESSION_ID);
    } catch (caught) {
      code = caught instanceof DurableDeletionDatabaseError ? caught.code : 'unexpected';
    }
    assert(code === expected, 'only exact 28000 session rejection is classified');
  }
});

Deno.test(
  'database gateway binds publication leases to exact user and Auth session RPCs',
  async () => {
    const client = new QueueClient([
      ok([{ status: 'reserved' }]),
      ok([{ status: 'active' }]),
      ok([{ status: 'active' }]),
      ok([{ status: 'released' }]),
    ]);
    const gateway = new DurableDeletionDatabaseGateway(client);
    const input = { userId: USER_ID, sessionId: SESSION_ID, capability: TOKEN };
    assert((await gateway.reservePublicationLease(input)) === 'reserved', 'reserve mapped');
    assert((await gateway.activatePublicationLease(input)) === 'active', 'activate mapped');
    assert((await gateway.renewPublicationLease(input)) === 'active', 'renew mapped');
    assert((await gateway.releasePublicationLease(TOKEN)) === 'released', 'release mapped');
    assert(
      client.calls.map((call) => call.name).join(',') ===
        'reserve_account_publication_lease,activate_account_publication_lease,renew_account_publication_lease,release_account_publication_lease',
      'narrow service RPC names',
    );
    for (const call of client.calls.slice(0, 3)) {
      assert(
        call.args.p_user_id === USER_ID &&
          call.args.p_session_id === SESSION_ID &&
          call.args.p_capability === TOKEN &&
          Object.keys(call.args).length === 3,
        'authenticated publication RPC receives only exact binding arguments',
      );
    }
    const releaseCall = client.calls[3];
    assert(releaseCall !== undefined, 'release call recorded');
    assert(
      releaseCall.args.p_capability === TOKEN && Object.keys(releaseCall.args).length === 1,
      'release remains capability-only',
    );
  },
);

Deno.test('database gateway accepts only bounded publication lease statuses', async () => {
  for (const status of ['blocked', 'session_rejected', 'lease_rejected'] as const) {
    const gateway = new DurableDeletionDatabaseGateway(
      new QueueClient([ok([{ status }]), ok([{ status }]), ok([{ status }])]),
    );
    const input = { userId: USER_ID, sessionId: SESSION_ID, capability: TOKEN };
    assert((await gateway.reservePublicationLease(input)) === status, 'reserve rejection mapped');
    assert((await gateway.activatePublicationLease(input)) === status, 'activate rejection mapped');
    assert((await gateway.renewPublicationLease(input)) === status, 'renew rejection mapped');
  }

  for (const malformed of [
    [],
    [{ status: 'reserved' }, { status: 'reserved' }],
    [{ status: 'unknown' }],
    [{ status: 'reserved', extra: true }],
  ]) {
    const gateway = new DurableDeletionDatabaseGateway(new QueueClient([ok(malformed)]));
    let code = '';
    try {
      await gateway.reservePublicationLease({
        userId: USER_ID,
        sessionId: SESSION_ID,
        capability: TOKEN,
      });
    } catch (error) {
      code = error instanceof DurableDeletionDatabaseError ? error.code : 'unexpected';
    }
    assert(code === 'DELETION_DATABASE_RESPONSE_INVALID', 'malformed reserve row fails closed');
  }

  for (const malformedRelease of [
    [],
    [{ status: 'blocked' }],
    [{ status: 'session_rejected' }],
    [{ status: 'lease_rejected' }],
    [{ status: 'released', extra: true }],
  ]) {
    const gateway = new DurableDeletionDatabaseGateway(new QueueClient([ok(malformedRelease)]));
    let code = '';
    try {
      await gateway.releasePublicationLease(TOKEN);
    } catch (error) {
      code = error instanceof DurableDeletionDatabaseError ? error.code : 'unexpected';
    }
    assert(code === 'DELETION_DATABASE_RESPONSE_INVALID', 'release accepts exact released only');
  }
});

Deno.test('database gateway binds repeated RevenueCat absence to the live claim', async () => {
  const client = new QueueClient([
    ok([{ confirmed: false, observation_count: 1 }]),
    ok([{ reset: true }]),
  ]);
  const gateway = new DurableDeletionDatabaseGateway(client);
  const claim = {
    operationId: OPERATION_ID,
    userId: USER_ID,
    stepName: 'revenuecat_delete' as const,
    claimMode: 'reconcile' as const,
    claimToken: TOKEN,
  };
  assert(
    !(await gateway.recordRevenueCatAbsenceObservation(claim)).confirmed,
    'first DB-clock observation remains nonterminal',
  );
  assert((await gateway.resetRevenueCatAbsenceObservations(claim)).reset, 'reset mapped');
  assert(
    client.calls.map((call) => call.name).join(',') ===
      'record_account_deletion_revenuecat_absence_observation,reset_account_deletion_revenuecat_absence_observations',
    'claim-bound observation RPC names',
  );
  for (const call of client.calls) {
    assert(
      call.args.p_operation_id === OPERATION_ID &&
        call.args.p_step_name === 'revenuecat_delete' &&
        call.args.p_claim_token === TOKEN &&
        Object.keys(call.args).length === 3,
      'observation RPC receives only claim CAS identity',
    );
  }

  for (const malformed of [
    [{ confirmed: true, observation_count: 1 }],
    [{ confirmed: false, observation_count: 2 }],
    [{ confirmed: false, observation_count: 0 }],
    [{ confirmed: true, observation_count: 2, extra: true }],
  ]) {
    const invalid = new DurableDeletionDatabaseGateway(new QueueClient([ok(malformed)]));
    let code = '';
    try {
      await invalid.recordRevenueCatAbsenceObservation(claim);
    } catch (error) {
      code = error instanceof DurableDeletionDatabaseError ? error.code : 'unexpected';
    }
    assert(code === 'DELETION_DATABASE_RESPONSE_INVALID', 'malformed absence row fails closed');
  }
});

Deno.test('database gateway enforces claim and CAS response contracts', async () => {
  const claimRow = {
    operation_id: OPERATION_ID,
    user_id: USER_ID,
    operation_state: 'running',
    step_name: 'apple_revoke',
    step_status: 'leased',
    claim_mode: 'dispatch',
    claim_token: TOKEN,
    attempt_count: 1,
    request_started_at: null,
    lease_expires_at: LATER,
    encrypted_payload: '\\x00',
  };
  const client = new QueueClient([
    ok([claimRow]),
    ok([
      {
        claimed: true,
        operation_state: 'running',
        step_name: 'apple_revoke',
        step_status: 'leased',
        claim_mode: 'dispatch',
        claim_token: TOKEN,
        attempt_count: 1,
        request_started_at: null,
        lease_expires_at: LATER,
        encrypted_payload: '\\x00',
      },
    ]),
    ok([
      {
        step_status: 'request_started',
        claim_mode: 'dispatch',
        request_started_at: NOW,
        lease_expires_at: LATER,
      },
    ]),
    ok([
      {
        step_status: 'request_started',
        claim_mode: 'dispatch',
        request_started_at: NOW,
        lease_expires_at: LATER,
        encrypted_payload_octets: 2,
        encrypted_payload_digest: TOKEN,
        payload_updated_at: NOW,
      },
    ]),
    ok([
      {
        operation_state: 'running',
        step_status: 'succeeded',
        next_attempt_at: null,
      },
    ]),
  ]);
  const gateway = new DurableDeletionDatabaseGateway(client);
  const claim = await gateway.claimNext('dispatch', 120);
  assert(claim?.claimToken === TOKEN, 'claim mapped');
  const targeted = await gateway.claimOperation(OPERATION_ID, USER_ID, 'dispatch', 120);
  assert(
    targeted?.operationId === OPERATION_ID && targeted.userId === USER_ID,
    'targeted claim maps only the committed operation',
  );
  assert((await gateway.markRequestStarted(claim!)) === NOW, 'start CAS mapped');
  await gateway.updatePayload(claim!, '\\x0001');
  await gateway.record({
    operationId: OPERATION_ID,
    stepName: 'apple_revoke',
    claimToken: TOKEN,
    outcome: 'succeeded',
    resultCode: 'APPLE_REVOKED',
    retryAt: null,
  });
  assert(
    client.calls.map((call) => call.name).join(',') ===
      'claim_next_account_deletion_step,claim_account_deletion_step,mark_account_deletion_step_request_started,update_account_deletion_step_payload,record_account_deletion_step',
    'CAS RPC sequence',
  );
});

Deno.test(
  'database gateway validates maintenance, Storage, finalization, and rate RPCs',
  async () => {
    const client = new QueueClient([
      ok([{ operation_id: OPERATION_ID, user_id: USER_ID }]),
      ok([
        {
          completed: true,
          completed_at: NOW,
          expires_at: LATER,
          apple_manual_revocation_required: false,
        },
      ]),
      ok([{ object_name: `${USER_ID}/photo.jpg` }]),
      ok('1'),
      ok([
        {
          leases_closed: 1,
          operations_drained: 1,
          leases_purged: 1,
        },
      ]),
      ok([{ deferred: true, next_attempt_at: LATER }]),
      ok([
        {
          receipts_deleted: 1,
          operations_deleted: 0,
          encrypted_credentials_redacted: 0,
          active_accounts_retained: 1,
          operator_audits_deleted: 0,
        },
      ]),
      ok(true),
      ok(true),
    ]);
    const gateway = new DurableDeletionDatabaseGateway(client);
    assert((await gateway.listReadyToFinalize(10)).length === 1, 'ready row');
    await gateway.finalize({
      operationId: OPERATION_ID,
      subjectHmac: TOKEN,
      subjectHmacKeyVersion: 1,
      receiptExpiresAt: LATER,
    });
    assert(
      (await gateway.listPhotoObjects(USER_ID, null, 100))[0] === `${USER_ID}/photo.jpg`,
      'safe Storage worklist',
    );
    assert((await gateway.countPhotoObjects(USER_ID)) === 1, 'exact count');
    await gateway.reapExpiredPublicationLeases(100);
    await gateway.deferRevenueCatProviderCapacity(
      {
        operationId: OPERATION_ID,
        userId: USER_ID,
        operationState: 'running',
        stepName: 'revenuecat_delete',
        stepStatus: 'leased',
        claimMode: 'dispatch',
        claimToken: TOKEN,
        attemptCount: 1,
        requestStartedAt: null,
        leaseExpiresAt: LATER,
        encryptedPayload: null,
      },
      LATER,
    );
    const deferCall = client.calls.at(-1);
    assert(
      deferCall?.name === 'defer_account_deletion_revenuecat_provider_capacity' &&
        deferCall.args.p_claim_token === TOKEN &&
        deferCall.args.p_retry_at === LATER,
      'capacity deferral remains exact-claim CAS-bound',
    );
    await gateway.purgeExpiredArtifacts(100);
    assert(
      await gateway.consumeRateLimit({
        scope: 'account-deletion-intake',
        keyHash: TOKEN,
        limit: 3,
        windowSeconds: 60,
        ownerUserId: USER_ID,
        sessionId: SESSION_ID,
      }),
      'rate decision',
    );
    const rateCall = client.calls.at(-1);
    assert(
      rateCall?.args.p_owner_user_id === USER_ID &&
        rateCall.args.p_session_id === SESSION_ID &&
        Object.keys(rateCall.args).length === 6,
      'destructive intake rate limit carries the exact live-session binding',
    );
    assert(
      await gateway.consumeRevenueCatProviderBudget(TOKEN, 'customer-information'),
      'provider budget decision',
    );
    const providerBudgetCall = client.calls.at(-1);
    assert(
      providerBudgetCall?.name === 'consume_revenuecat_account_deletion_budget' &&
        providerBudgetCall.args.p_key_hash === TOKEN &&
        providerBudgetCall.args.p_domain === 'customer-information' &&
        Object.keys(providerBudgetCall.args).length === 2,
      'provider budget RPC is fixed-scope and keyed without raw credentials',
    );
  },
);

Deno.test(
  'database gateway contains transport details and rejects malformed boundaries',
  async () => {
    const transportClient: DeletionRpcClient = {
      rpc: () => Promise.reject(new Error('private database detail')),
    };
    const transportGateway = new DurableDeletionDatabaseGateway(transportClient);
    let transportCode = '';
    try {
      await transportGateway.status(TOKEN);
    } catch (error) {
      transportCode = error instanceof DurableDeletionDatabaseError ? error.code : 'unexpected';
    }
    assert(transportCode === 'DELETION_DATABASE_UNAVAILABLE', 'contained error');

    const invalidStatus = new DurableDeletionDatabaseGateway(
      new QueueClient([ok([{ unexpected: true }])]),
    );
    let invalidCode = '';
    try {
      await invalidStatus.status(TOKEN);
    } catch (error) {
      invalidCode = error instanceof DurableDeletionDatabaseError ? error.code : 'unexpected';
    }
    assert(invalidCode === 'DELETION_DATABASE_RESPONSE_INVALID', 'status fails closed');

    let called = false;
    const noCall = new DurableDeletionDatabaseGateway({
      rpc: () => {
        called = true;
        return Promise.resolve(ok(null));
      },
    });
    let inputCode = '';
    try {
      await noCall.consumeRateLimit({
        scope: 'INVALID SCOPE',
        keyHash: TOKEN,
        limit: 1,
        windowSeconds: 60,
      });
    } catch (error) {
      inputCode = error instanceof DurableDeletionDatabaseError ? error.code : 'unexpected';
    }
    assert(inputCode === 'DELETION_DATABASE_INPUT_INVALID', 'input rejected');
    assert(!called, 'invalid input never reaches database');

    const malformedBarrier = new DurableDeletionDatabaseGateway(
      new QueueClient([ok({ state: 'active', operation_id: OPERATION_ID })]),
    );
    let barrierCode = '';
    try {
      await malformedBarrier.barrierState(USER_ID, SESSION_ID);
    } catch (error) {
      barrierCode = error instanceof DurableDeletionDatabaseError ? error.code : 'unexpected';
    }
    assert(
      barrierCode === 'DELETION_DATABASE_RESPONSE_INVALID',
      'barrier response cannot disclose operation details',
    );
  },
);
