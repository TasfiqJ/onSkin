import {
  type DeletionRpcClient,
  type DeletionRpcResult,
  DurableDeletionDatabaseError,
  DurableDeletionDatabaseGateway,
} from './durableDeletionDatabaseGateway.ts';

const OPERATION_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';
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
    idempotencyKey: '01'.repeat(32),
    capability: '23'.repeat(32),
    operationExpiresAt: LATER,
    appleEncryptedPayload: '\\x00',
    revenueCatEncryptedPayload: null,
    postHogEncryptedPayload: '\\x01',
  });
  assert(began.created && began.operationId === OPERATION_ID, 'begin mapped');
  assert((await gateway.status('23'.repeat(32))) === statusRow, 'status mapped');
  assert((await gateway.barrierState(USER_ID)) === 'active', 'opaque barrier mapped');
  assert(client.calls[0]?.name === 'begin_account_deletion', 'begin RPC');
  assert(
    client.calls[0]?.args.p_apple_encrypted_credential === '\\x00',
    'bytea passed canonically',
  );
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
          receipts_deleted: 1,
          operations_deleted: 0,
          encrypted_credentials_redacted: 0,
          active_accounts_retained: 1,
          operator_audits_deleted: 0,
        },
      ]),
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
    await gateway.purgeExpiredArtifacts(100);
    assert(
      await gateway.consumeRateLimit({
        scope: 'account-deletion-intake',
        keyHash: TOKEN,
        limit: 3,
        windowSeconds: 60,
        ownerUserId: USER_ID,
      }),
      'rate decision',
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
      await malformedBarrier.barrierState(USER_ID);
    } catch (error) {
      barrierCode = error instanceof DurableDeletionDatabaseError ? error.code : 'unexpected';
    }
    assert(
      barrierCode === 'DELETION_DATABASE_RESPONSE_INVALID',
      'barrier response cannot disclose operation details',
    );
  },
);
