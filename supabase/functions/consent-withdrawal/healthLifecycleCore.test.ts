import {
  HEALTH_CONSENT_COPY_VERSION,
  HEALTH_CONSENT_DECLINE_HASH,
  HEALTH_CONSENT_GRANT_HASH,
  HEALTH_CONSENT_TYPE,
  HEALTH_CONSENT_WITHDRAWAL_HASH,
  HEALTH_STORAGE_MAX_BATCHES_PER_REQUEST,
  type HealthLifecycleDependencies,
  type HealthLifecycleRequest,
  parseHealthLifecycleRequest,
  parsePreparedHealthWithdrawalRow,
  runHealthLifecycle,
} from './healthLifecycleCore.ts';
import {
  HEALTH_DATA_CONSENT,
  HEALTH_DATA_WITHDRAWAL,
} from '../../../apps/mobile/src/features/onboarding/consentCopy.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals(actual: unknown, expected: unknown, message: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}: ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`);
  }
}

const USER_ID = '00000000-0000-4000-8000-000000000001';
const OPERATION_ID = '00000000-0000-4000-8000-000000000002';
const KEY = 'b'.repeat(64);

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function statusRow(
  state: 'unconsented' | 'active' | 'withdrawing' | 'withdrawn' = 'withdrawing',
  epoch = 3,
  overrides: Record<string, unknown> = {},
) {
  return [
    {
      user_id: USER_ID,
      state,
      epoch,
      operation_id: state === 'active' || state === 'unconsented' ? null : OPERATION_ID,
      operation_state:
        state === 'withdrawn' ? 'completed' : state === 'withdrawing' ? 'running' : null,
      result_code: state === 'withdrawn' ? 'HEALTH_WITHDRAWAL_COMPLETED' : null,
      server_verified_at: '2026-07-15T12:00:00.000Z',
      consent_version: state === 'active' ? HEALTH_CONSENT_COPY_VERSION : null,
      consent_text_hash: state === 'active' ? HEALTH_CONSENT_GRANT_HASH : null,
      ...overrides,
    },
  ];
}

function dependencies(overrides: Partial<HealthLifecycleDependencies> = {}) {
  const calls: string[] = [];
  const deps: HealthLifecycleDependencies = {
    authenticatedUserId: USER_ID,
    begin: async () => {
      calls.push('begin');
      return { data: statusRow(), error: null };
    },
    readStatus: async () => {
      calls.push('status');
      return { data: statusRow(), error: null };
    },
    prepare: async () => {
      calls.push('prepare');
      return {
        data: [
          {
            operation_state: 'running',
            result_code: 'DATABASE_AND_PROCESSORS_RECONCILED',
            pending_storage_objects: 0,
          },
        ],
        error: null,
      };
    },
    listStorage: async () => {
      calls.push('list');
      return { data: [], error: null };
    },
    removeStorage: async () => {
      calls.push('remove');
      return { error: null };
    },
    complete: async () => {
      calls.push('complete');
      return { data: statusRow('withdrawn'), error: null };
    },
    reconsent: async () => {
      calls.push('reconsent');
      return { data: statusRow('active', 4), error: null };
    },
    decline: async () => {
      calls.push('decline');
      return {
        data: statusRow('unconsented', 0, {
          result_code: 'HEALTH_CONSENT_DECLINED',
        }),
        error: null,
      };
    },
    ...overrides,
  };
  return { calls, deps };
}

Deno.test('Edge disclosure contracts stay byte-for-byte aligned with mobile copy', async () => {
  assertEquals(
    HEALTH_CONSENT_COPY_VERSION,
    HEALTH_DATA_CONSENT.version,
    'grant disclosure version drift',
  );
  assertEquals(
    HEALTH_CONSENT_GRANT_HASH,
    await sha256Hex(HEALTH_DATA_CONSENT.fullText),
    'grant disclosure hash drift',
  );
  assertEquals(
    HEALTH_CONSENT_DECLINE_HASH,
    await sha256Hex(HEALTH_DATA_CONSENT.declineText),
    'decline disclosure hash drift',
  );
  assertEquals(
    HEALTH_CONSENT_WITHDRAWAL_HASH,
    await sha256Hex(HEALTH_DATA_WITHDRAWAL.fullText),
    'withdrawal disclosure hash drift',
  );
});

Deno.test('health lifecycle validator accepts only exact action-specific bodies', () => {
  const withdraw = parseHealthLifecycleRequest({
    action: 'withdraw',
    consentType: HEALTH_CONSENT_TYPE,
    expectedProcessingEpoch: 3,
    idempotencyKey: KEY,
    version: HEALTH_CONSENT_COPY_VERSION,
    consentTextHash: HEALTH_CONSENT_WITHDRAWAL_HASH,
  });
  assert(withdraw?.action === 'withdraw', 'expected exact withdrawal body to pass');

  const decline = parseHealthLifecycleRequest({
    action: 'decline',
    consentType: HEALTH_CONSENT_TYPE,
    expectedProcessingEpoch: 0,
    version: HEALTH_CONSENT_COPY_VERSION,
    consentTextHash: HEALTH_CONSENT_DECLINE_HASH,
  });
  assert(decline?.action === 'decline', 'expected exact initial decline body to pass');

  const reconsent = parseHealthLifecycleRequest({
    action: 'reconsent',
    consentType: HEALTH_CONSENT_TYPE,
    expectedProcessingEpoch: 3,
    version: HEALTH_CONSENT_COPY_VERSION,
    consentTextHash: HEALTH_CONSENT_GRANT_HASH,
  });
  assert(reconsent?.action === 'reconsent', 'expected exact reconsent body to pass');
  assertEquals(
    parseHealthLifecycleRequest({
      action: 'status',
      consentType: HEALTH_CONSENT_TYPE,
    }),
    { action: 'status', consentType: HEALTH_CONSENT_TYPE },
    'expected exact status body',
  );
});

Deno.test(
  'health lifecycle validator rejects owner, session, path, case, and shape injection',
  () => {
    const rejected = [
      { action: 'status', consentType: HEALTH_CONSENT_TYPE, userId: USER_ID },
      {
        action: 'retry',
        consentType: HEALTH_CONSENT_TYPE,
        sessionId: OPERATION_ID,
      },
      {
        action: 'withdraw',
        consentType: HEALTH_CONSENT_TYPE,
        expectedProcessingEpoch: 3,
        idempotencyKey: KEY.toUpperCase(),
        version: HEALTH_CONSENT_COPY_VERSION,
        consentTextHash: HEALTH_CONSENT_WITHDRAWAL_HASH,
      },
      {
        action: 'withdraw',
        consentType: HEALTH_CONSENT_TYPE,
        expectedProcessingEpoch: 3,
        idempotencyKey: KEY,
        version: ` ${HEALTH_CONSENT_COPY_VERSION} `,
        consentTextHash: HEALTH_CONSENT_WITHDRAWAL_HASH,
      },
      {
        action: 'withdraw',
        consentType: HEALTH_CONSENT_TYPE,
        expectedProcessingEpoch: 0,
        idempotencyKey: KEY,
        version: HEALTH_CONSENT_COPY_VERSION,
        consentTextHash: HEALTH_CONSENT_WITHDRAWAL_HASH,
      },
      {
        action: 'decline',
        consentType: HEALTH_CONSENT_TYPE,
        expectedProcessingEpoch: 1,
        version: HEALTH_CONSENT_COPY_VERSION,
        consentTextHash: HEALTH_CONSENT_DECLINE_HASH,
      },
      {
        action: 'withdraw',
        consentType: HEALTH_CONSENT_TYPE,
        idempotencyKey: KEY,
        version: HEALTH_CONSENT_COPY_VERSION,
        consentTextHash: HEALTH_CONSENT_WITHDRAWAL_HASH,
      },
      {
        action: 'reconsent',
        consentType: HEALTH_CONSENT_TYPE,
        expectedProcessingEpoch: -1,
        version: HEALTH_CONSENT_COPY_VERSION,
        consentTextHash: HEALTH_CONSENT_GRANT_HASH,
      },
      {
        action: 'withdraw',
        consentType: HEALTH_CONSENT_TYPE,
        expectedProcessingEpoch: 3,
        idempotencyKey: KEY,
        version: HEALTH_CONSENT_COPY_VERSION,
        consentTextHash: HEALTH_CONSENT_GRANT_HASH,
      },
      {
        action: 'decline',
        consentType: HEALTH_CONSENT_TYPE,
        expectedProcessingEpoch: 0,
        version: HEALTH_CONSENT_COPY_VERSION,
        consentTextHash: HEALTH_CONSENT_WITHDRAWAL_HASH,
      },
      {
        action: 'reconsent',
        consentType: HEALTH_CONSENT_TYPE,
        expectedProcessingEpoch: 3,
        version: 'future-copy',
        consentTextHash: HEALTH_CONSENT_GRANT_HASH,
      },
      {
        action: 'withdraw',
        consentType: HEALTH_CONSENT_TYPE,
        storagePath: `${USER_ID}/x`,
      },
    ];
    for (const value of rejected) {
      assert(
        parseHealthLifecycleRequest(value) === null,
        `expected rejection: ${JSON.stringify(value)}`,
      );
    }
  },
);

Deno.test('status is read-only and never touches service cleanup or Storage', async () => {
  const { calls, deps } = dependencies();
  const result = await runHealthLifecycle(
    { action: 'status', consentType: HEALTH_CONSENT_TYPE },
    deps,
  );
  assertEquals(result.status, 200, 'status should succeed');
  assertEquals(calls, ['status'], 'status must be read-only');
});

Deno.test('prepare receipts require exact state, result, and pending-count consistency', () => {
  assert(
    parsePreparedHealthWithdrawalRow([
      {
        operation_state: 'running',
        result_code: 'DATABASE_AND_PROCESSORS_RECONCILED',
        pending_storage_objects: 0,
      },
    ])?.operation_state === 'running',
    'valid reconciled receipt should pass',
  );
  for (const invalid of [
    {
      operation_state: 'pending',
      result_code: 'DATABASE_AND_PROCESSORS_RECONCILED',
      pending_storage_objects: 0,
    },
    {
      operation_state: 'storage_pending',
      result_code: 'DATABASE_AND_PROCESSORS_RECONCILED',
      pending_storage_objects: 0,
    },
    {
      operation_state: 'running',
      result_code: 'PHOTO_STORAGE_DELETION_PENDING',
      pending_storage_objects: 1,
    },
    {
      operation_state: 'action_required',
      result_code: 'CALLER_INVENTED_CODE',
      pending_storage_objects: 1,
    },
  ]) {
    assert(
      parsePreparedHealthWithdrawalRow([invalid]) === null,
      `invalid prepare receipt passed: ${JSON.stringify(invalid)}`,
    );
  }
});

Deno.test('action-required prepare is refreshed before authoritative publication', async () => {
  const { calls, deps } = dependencies({
    readStatus: async () => {
      calls.push('status');
      return {
        data: statusRow('withdrawing', 3, {
          operation_state: 'action_required',
          result_code: 'UNSAFE_PHOTO_STORAGE_OWNERSHIP',
        }),
        error: null,
      };
    },
    prepare: async () => {
      calls.push('prepare');
      return {
        data: [
          {
            operation_state: 'action_required',
            result_code: 'UNSAFE_PHOTO_STORAGE_OWNERSHIP',
            pending_storage_objects: 1,
          },
        ],
        error: null,
      };
    },
  });
  const result = await runHealthLifecycle(
    { action: 'retry', consentType: HEALTH_CONSENT_TYPE },
    deps,
  );
  assertEquals(result.status, 409, 'durable operator lane should be a conflict');
  assertEquals(calls, ['status', 'prepare', 'status'], 'operator status must be refreshed');
  assertEquals(result.body.operation_state, 'action_required', 'published status must be current');
});

Deno.test('active status fails closed on stale or missing authoritative consent copy', async () => {
  for (const staleRow of [
    {
      ...statusRow('active', 3)[0],
      consent_text_hash: 'f'.repeat(64),
    },
    {
      ...statusRow('active', 3)[0],
      consent_version: null,
      consent_text_hash: null,
    },
  ]) {
    const result = await runHealthLifecycle(
      { action: 'status', consentType: HEALTH_CONSENT_TYPE },
      dependencies({
        readStatus: async () => ({ data: [staleRow], error: null }),
      }).deps,
    );
    assertEquals(result.status, 503, 'stale active copy must never be published as usable');
  }
});

Deno.test('nonactive status rejects leaked consent-copy metadata', async () => {
  const invalid = {
    ...statusRow('withdrawing', 3)[0],
    consent_version: HEALTH_CONSENT_COPY_VERSION,
    consent_text_hash: HEALTH_CONSENT_WITHDRAWAL_HASH,
  };
  const result = await runHealthLifecycle(
    { action: 'status', consentType: HEALTH_CONSENT_TYPE },
    dependencies({ readStatus: async () => ({ data: [invalid], error: null }) }).deps,
  );
  assertEquals(result.status, 503, 'nonactive copy metadata must fail closed');
});

Deno.test('caller lifecycle rows are subject- and epoch-attested before publication', async () => {
  const foreignUser = '00000000-0000-4000-8000-000000000099';
  const status = await runHealthLifecycle(
    { action: 'status', consentType: HEALTH_CONSENT_TYPE },
    dependencies({ authenticatedUserId: foreignUser }).deps,
  );
  assertEquals(status.status, 503, 'foreign status row must fail closed');
  assert(!JSON.stringify(status.body).includes(USER_ID), 'foreign owner must not be published');

  const wrongEpoch = await runHealthLifecycle(
    {
      action: 'withdraw',
      consentType: HEALTH_CONSENT_TYPE,
      expectedProcessingEpoch: 2,
      idempotencyKey: KEY,
      version: HEALTH_CONSENT_COPY_VERSION,
      consentTextHash: HEALTH_CONSENT_WITHDRAWAL_HASH,
    },
    dependencies().deps,
  );
  assertEquals(wrongEpoch.status, 503, 'wrong-epoch begin attestation must fail closed');
});

Deno.test(
  'withdraw orders barrier, database cleanup, Storage absence, and completion',
  async () => {
    const { calls, deps } = dependencies();
    const request: HealthLifecycleRequest = {
      action: 'withdraw',
      consentType: HEALTH_CONSENT_TYPE,
      expectedProcessingEpoch: 3,
      idempotencyKey: KEY,
      version: HEALTH_CONSENT_COPY_VERSION,
      consentTextHash: HEALTH_CONSENT_WITHDRAWAL_HASH,
    };
    const result = await runHealthLifecycle(request, deps);
    assertEquals(result.status, 200, 'withdraw should complete');
    assertEquals(calls, ['begin', 'prepare', 'list', 'complete'], 'withdraw call order');
    assert(result.body.withdrawn === true, 'terminal result must be truthful');
  },
);

Deno.test('retry resumes an existing operation without appending another revocation', async () => {
  const { calls, deps } = dependencies();
  const result = await runHealthLifecycle(
    { action: 'retry', consentType: HEALTH_CONSENT_TYPE },
    deps,
  );
  assertEquals(result.status, 200, 'retry should complete');
  assertEquals(calls, ['status', 'prepare', 'list', 'complete'], 'retry must not begin');
});

Deno.test('already-withdrawn retry is idempotent and performs no cleanup', async () => {
  const { calls, deps } = dependencies({
    readStatus: async () => {
      calls.push('status');
      return { data: statusRow('withdrawn'), error: null };
    },
  });
  const result = await runHealthLifecycle(
    { action: 'retry', consentType: HEALTH_CONSENT_TYPE },
    deps,
  );
  assertEquals(result.status, 200, 'terminal retry should succeed');
  assertEquals(calls, ['status'], 'terminal retry must remain read-only');
});

Deno.test('owned Storage batches are removed before exact-zero completion', async () => {
  let listCount = 0;
  const path = `${USER_ID}/e3/progress.enc`;
  const { calls, deps } = dependencies({
    listStorage: async () => {
      calls.push('list');
      listCount += 1;
      return {
        data: listCount === 1 ? [{ storage_path: path }] : [],
        error: null,
      };
    },
    removeStorage: async (paths) => {
      calls.push(`remove:${paths.join(',')}`);
      return { error: null };
    },
  });
  const result = await runHealthLifecycle(
    { action: 'retry', consentType: HEALTH_CONSENT_TYPE },
    deps,
  );
  assertEquals(result.status, 200, 'owned Storage drain should complete');
  assertEquals(
    calls,
    ['status', 'prepare', 'list', `remove:${path}`, 'list', 'complete'],
    'Storage must be re-attested after removal',
  );
});

Deno.test('canonical pre-epoch Storage is drainable for legacy account cleanup', async () => {
  let listCount = 0;
  const path = `${USER_ID}/legacy-progress.enc`;
  const { calls, deps } = dependencies({
    listStorage: async () => {
      calls.push('list');
      listCount += 1;
      return {
        data: listCount === 1 ? [{ storage_path: path }] : [],
        error: null,
      };
    },
    removeStorage: async (paths) => {
      calls.push(`remove:${paths.join(',')}`);
      return { error: null };
    },
  });
  const result = await runHealthLifecycle(
    { action: 'retry', consentType: HEALTH_CONSENT_TYPE },
    deps,
  );
  assertEquals(result.status, 200, 'canonical legacy Storage should complete');
  assertEquals(
    calls,
    ['status', 'prepare', 'list', `remove:${path}`, 'list', 'complete'],
    'legacy Storage must still be re-attested after removal',
  );
});

Deno.test('cross-owner or malformed Storage attestation fails before removal', async () => {
  let removed = false;
  const { deps } = dependencies({
    listStorage: async () => ({
      data: [
        {
          storage_path: '00000000-0000-4000-8000-000000000099/stolen.enc',
        },
      ],
      error: null,
    }),
    removeStorage: async () => {
      removed = true;
      return { error: null };
    },
  });
  const result = await runHealthLifecycle(
    { action: 'retry', consentType: HEALTH_CONSENT_TYPE },
    deps,
  );
  assertEquals(result.status, 409, 'unsafe Storage batch should be rejected');
  assert(!removed, 'unsafe Storage batch must issue zero removals');
});

Deno.test('Storage attestation rejects another health-processing epoch', async () => {
  let removed = false;
  const { deps } = dependencies({
    listStorage: async () => ({
      data: [{ storage_path: `${USER_ID}/e2/stale.enc` }],
      error: null,
    }),
    removeStorage: async () => {
      removed = true;
      return { error: null };
    },
  });
  const result = await runHealthLifecycle(
    { action: 'retry', consentType: HEALTH_CONSENT_TYPE },
    deps,
  );
  assertEquals(result.status, 409, 'cross-epoch Storage work should be rejected');
  assert(!removed, 'cross-epoch Storage work must issue zero removals');
});

Deno.test('Storage failure stays frozen and retryable without claiming withdrawal', async () => {
  const path = `${USER_ID}/e3/progress.enc`;
  const { deps } = dependencies({
    listStorage: async () => ({ data: [{ storage_path: path }], error: null }),
    removeStorage: async () => ({
      error: new Error('provider body must not escape'),
    }),
  });
  const result = await runHealthLifecycle(
    { action: 'retry', consentType: HEALTH_CONSENT_TYPE },
    deps,
  );
  assertEquals(result.status, 202, 'Storage error should be retryable');
  assert(result.body.withdrawn === false, 'Storage error must not claim withdrawal');
  assert(
    !JSON.stringify(result.body).includes('provider body'),
    'provider details must be redacted',
  );
});

Deno.test('bounded Storage work yields 202 instead of running without limit', async () => {
  const path = `${USER_ID}/e3/progress.enc`;
  let removals = 0;
  const { deps } = dependencies({
    listStorage: async () => ({ data: [{ storage_path: path }], error: null }),
    removeStorage: async () => {
      removals += 1;
      return { error: null };
    },
  });
  const result = await runHealthLifecycle(
    { action: 'retry', consentType: HEALTH_CONSENT_TYPE },
    deps,
  );
  assertEquals(result.status, 202, 'bounded work should remain retryable');
  assertEquals(removals, HEALTH_STORAGE_MAX_BATCHES_PER_REQUEST, 'batch bound');
});

Deno.test(
  'reconsent is isolated from cleanup and returns only authoritative active state',
  async () => {
    const { calls, deps } = dependencies();
    const result = await runHealthLifecycle(
      {
        action: 'reconsent',
        consentType: HEALTH_CONSENT_TYPE,
        expectedProcessingEpoch: 3,
        version: HEALTH_CONSENT_COPY_VERSION,
        consentTextHash: HEALTH_CONSENT_GRANT_HASH,
      },
      deps,
    );
    assertEquals(result.status, 200, 'reconsent should succeed');
    assertEquals(calls, ['reconsent'], 'reconsent must not clean or touch Storage');
    assert(result.body.reconsented === true, 'active response required');
  },
);

Deno.test('an explicit consent retry may return the already-active epoch', async () => {
  const { calls, deps } = dependencies();
  deps.reconsent = async () => {
    calls.push('reconsent');
    return { data: statusRow('active', 3), error: null };
  };
  const result = await runHealthLifecycle(
    {
      action: 'reconsent',
      consentType: HEALTH_CONSENT_TYPE,
      expectedProcessingEpoch: 3,
      version: HEALTH_CONSENT_COPY_VERSION,
      consentTextHash: HEALTH_CONSENT_GRANT_HASH,
    },
    deps,
  );
  assertEquals(result.status, 200, 'already-active consent should be idempotent');
  assertEquals(calls, ['reconsent'], 'idempotent consent must not run cleanup');
});

Deno.test('initial decline is append-only and leaves health processing unconsented', async () => {
  const { calls, deps } = dependencies();
  const result = await runHealthLifecycle(
    {
      action: 'decline',
      consentType: HEALTH_CONSENT_TYPE,
      expectedProcessingEpoch: 0,
      version: HEALTH_CONSENT_COPY_VERSION,
      consentTextHash: HEALTH_CONSENT_DECLINE_HASH,
    },
    deps,
  );
  assertEquals(result.status, 200, 'initial decline should succeed');
  assertEquals(calls, ['decline'], 'decline must not start cleanup or touch Storage');
  assert(result.body.declined === true, 'unconsented response required');
  assertEquals(
    result.body.result_code,
    'HEALTH_CONSENT_DECLINED',
    'the authoritative refusal receipt must be accepted and published',
  );
});

Deno.test('premature reconsent fails closed with a stable redacted response', async () => {
  const { deps } = dependencies({
    reconsent: async () => ({
      data: null,
      error: new Error('raw database detail'),
    }),
  });
  const result = await runHealthLifecycle(
    {
      action: 'reconsent',
      consentType: HEALTH_CONSENT_TYPE,
      expectedProcessingEpoch: 3,
      version: HEALTH_CONSENT_COPY_VERSION,
      consentTextHash: HEALTH_CONSENT_GRANT_HASH,
    },
    deps,
  );
  assertEquals(result.status, 409, 'premature reconsent should conflict');
  assert(
    !JSON.stringify(result.body).includes('raw database'),
    'database details must be redacted',
  );
});

Deno.test('owner cleanup leases are issued only by the JWT-verified service lane', async () => {
  const edgeSource = await Deno.readTextFile(new URL('./index.ts', import.meta.url));
  const migrationSource = await Deno.readTextFile(
    new URL(
      '../../migrations/20260715000054_health_consent_withdrawal_lifecycle.sql',
      import.meta.url,
    ),
  );
  const verifiedUserIndex = edgeSource.indexOf('verifiedAuthSessionClaimsFromJwt(token, userId)');
  const claimIndex = edgeSource.indexOf("'claim_health_consent_withdrawal_for_owner'");
  assert(verifiedUserIndex >= 0 && claimIndex > verifiedUserIndex, 'JWT/session proof must precede claim');
  assert(
    /admin\.rpc\(\s*['"]claim_health_consent_withdrawal_for_owner['"]/.test(edgeSource) &&
      !/caller\.rpc\(\s*['"]claim_health_consent_withdrawal_for_owner['"]/.test(edgeSource),
    'the claim RPC must use only the service client',
  );
  assert(
    /p_user_id:\s*userId[\s\S]*p_operation_id:\s*operationId[\s\S]*p_claim_token:\s*claimToken/.test(
      edgeSource.slice(claimIndex, claimIndex + 500),
    ),
    'the service claim must bind explicit user, operation, and server-generated token',
  );
  assert(
    /claim_health_consent_withdrawal_for_owner\(\s*p_user_id uuid,\s*p_operation_id uuid,\s*p_claim_token text/.test(
      migrationSource,
    ) &&
      /revoke all on function public\.claim_health_consent_withdrawal_for_owner\(uuid, uuid, text\)\s+from public, anon, authenticated/.test(
        migrationSource,
      ) &&
      /grant execute on function public\.claim_health_consent_withdrawal_for_owner\(uuid, uuid, text\)\s+to service_role/.test(
        migrationSource,
      ),
    'database claim capability must be service-only with an explicit owner binding',
  );
});
