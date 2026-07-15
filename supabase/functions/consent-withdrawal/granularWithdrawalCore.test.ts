// Promise-shaped dependency mocks intentionally use async callbacks to model
// provider/RPC boundaries without introducing unrelated scheduling machinery.
// deno-lint-ignore-file require-await
import {
  type AskOnSkinCleanupDependencies,
  assertBaseHealthGrantCopyEnvironment,
  CONSENT_GRANT_COPY_PRODUCTION_ERROR,
  CURRENT_GRANULAR_WITHDRAWAL_COPY_CONTRACT,
  type DataSharingCleanupDependencies,
  GRANULAR_DB_MAX_ROWS_PER_SCOPE,
  GRANULAR_PHOTO_MAX_ROWS,
  GRANULAR_PHOTO_STORAGE_BATCH_SIZE,
  GranularActionRequiredError,
  type GranularPhotoCaptureCleanupDependencies,
  type GranularPhotoCloudCleanupDependencies,
  GranularPhotoCloudCleanupError,
  type GranularWithdrawalDependencies,
  type GranularWithdrawalRequest,
  parseGranularWithdrawalRequest,
  runAskOnSkinCleanup,
  runDataSharingCleanup,
  runGranularPhotoCaptureCleanup,
  runGranularPhotoCloudCleanup,
  runGranularWithdrawalLifecycle,
} from './granularWithdrawalCore.ts';
import {
  DependentPhotoCleanupRequiresWorkerError,
  runAuthenticatedHealthDependentCleanup,
} from './dependentCleanupRuntime.ts';
import { HEALTH_CONSENT_DISCLOSURE_CONTRACTS } from './healthConsentContract.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function assertCleanupRejects(
  operation: () => Promise<unknown>,
): Promise<void> {
  try {
    await operation();
  } catch (error) {
    assert(
      error instanceof GranularPhotoCloudCleanupError,
      'expected redacted cleanup error',
    );
    return;
  }
  throw new Error('expected cleanup rejection');
}

async function assertActionRequired(
  operation: () => Promise<unknown>,
): Promise<void> {
  try {
    await operation();
  } catch (error) {
    assert(
      error instanceof GranularActionRequiredError,
      'expected action-required error',
    );
    return;
  }
  throw new Error('expected action-required rejection');
}

const USER_ID = '00000000-0000-4000-8000-000000000001';
const USER_B_ID = '00000000-0000-4000-8000-000000000002';
const OPERATION_ID = '10000000-0000-4000-8000-000000000001';
const IDEMPOTENCY_KEY = 'a'.repeat(64);

function photoId(index: number): string {
  return `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
}

function harness(
  overrides: Partial<GranularPhotoCloudCleanupDependencies> = {},
) {
  const calls: string[] = [];
  let inventoryPass = 0;
  const dependencies: GranularPhotoCloudCleanupDependencies = {
    countPhotoRows: async () => {
      calls.push('count');
      return { count: 1, error: null };
    },
    listPhotoRows: async (limit) => {
      calls.push(`rows:${limit}`);
      return {
        data: [{ id: photoId(1), storage_path: `${USER_ID}/photo.enc` }],
        error: null,
      };
    },
    listVerifiedStoragePaths: async () => {
      calls.push('storage');
      inventoryPass += 1;
      return inventoryPass === 1 ? [`${USER_ID}/photo.enc`] : [];
    },
    removeStorage: async (paths) => {
      calls.push(`remove:${paths.length}`);
      return { error: null };
    },
    relocalizePhotoRows: async () => {
      calls.push('relocalize');
      return { data: [{ id: photoId(1) }], error: null };
    },
    ...overrides,
  };
  return { calls, dependencies };
}

Deno.test('granular photo cleanup deletes verified Storage before clearing metadata', async () => {
  const { calls, dependencies } = harness();
  const result = await runGranularPhotoCloudCleanup(USER_ID, dependencies);
  assert(
    JSON.stringify(calls) ===
      JSON.stringify([
        'count',
        `rows:${GRANULAR_PHOTO_MAX_ROWS + 1}`,
        'storage',
        'remove:1',
        'storage',
        'relocalize',
        'storage',
      ]),
    `unexpected cleanup order: ${JSON.stringify(calls)}`,
  );
  assert(result.photo_rows_relocalized === 1, 'expected one relocalized row');
  assert(result.storage_objects_removed === 1, 'expected one removed object');
  assert(
    result.skipped_storage_paths === 0,
    'successful cleanup may skip no path',
  );
});

Deno.test('capture cleanup removes remote Storage before metadata and disclaims device cleanup', async () => {
  const path = `${USER_ID}/legacy-capture.enc`;
  let storagePaths = [path];
  const calls: string[] = [];
  const dependencies: GranularPhotoCaptureCleanupDependencies = {
    countPhotoRows: async () => {
      calls.push('count');
      return { count: 1, error: null };
    },
    listPhotoRows: async () => {
      calls.push('rows');
      return {
        data: [{ id: photoId(1), storage_path: path }],
        error: null,
      };
    },
    listVerifiedStoragePaths: async () => {
      calls.push('storage');
      return [...storagePaths];
    },
    removeStorage: async () => {
      calls.push('remove-storage');
      storagePaths = [];
      return { error: null };
    },
    deletePhotoRows: async (ids) => {
      calls.push(`delete-rows:${ids.join(',')}`);
      return { data: [{ id: photoId(1) }], error: null };
    },
  };

  const result = await runGranularPhotoCaptureCleanup(USER_ID, dependencies);
  assert(
    JSON.stringify(calls) ===
      JSON.stringify([
        'count',
        'rows',
        'storage',
        'remove-storage',
        'storage',
        `delete-rows:${photoId(1)}`,
        'storage',
      ]),
    `unsafe capture cleanup order: ${JSON.stringify(calls)}`,
  );
  assert(
    result.remote_photo_rows_deleted === 1,
    'remote metadata must be deleted',
  );
  assert(
    result.local_device_cleanup_claimed === false,
    'Edge may never claim it deleted on-device photos',
  );
});

Deno.test('granular photo cleanup rejects a foreign or malformed row before deletion', async () => {
  let removed = false;
  const { dependencies } = harness({
    listPhotoRows: async () => ({
      data: [
        {
          id: photoId(1),
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
  await assertCleanupRejects(() =>
    runGranularPhotoCloudCleanup(USER_ID, dependencies)
  );
  assert(
    !removed,
    'foreign-path attestation failure must issue no Storage delete',
  );
});

Deno.test('granular photo cleanup enforces row and Storage delete batch bounds', async () => {
  const tooMany = Array.from(
    { length: GRANULAR_PHOTO_MAX_ROWS + 1 },
    (_, index) => ({
      id: photoId(index + 1),
      storage_path: null,
    }),
  );
  await assertActionRequired(() =>
    runGranularPhotoCloudCleanup(
      USER_ID,
      harness({
        countPhotoRows: async () => ({ count: tooMany.length, error: null }),
        listPhotoRows: async () => ({ data: tooMany, error: null }),
      }).dependencies,
    )
  );

  const paths = Array.from(
    { length: GRANULAR_PHOTO_STORAGE_BATCH_SIZE * 2 + 1 },
    (_, index) => `${USER_ID}/photo-${index}.enc`,
  );
  let pass = 0;
  const batchSizes: number[] = [];
  const { dependencies } = harness({
    countPhotoRows: async () => ({ count: 0, error: null }),
    listPhotoRows: async () => ({ data: [], error: null }),
    listVerifiedStoragePaths: async () => (pass++ === 0 ? paths : []),
    removeStorage: async (batch) => {
      batchSizes.push(batch.length);
      return { error: null };
    },
    relocalizePhotoRows: async () => ({ data: [], error: null }),
  });
  await runGranularPhotoCloudCleanup(USER_ID, dependencies);
  assert(
    JSON.stringify(batchSizes) === JSON.stringify([100, 100, 1]),
    `unexpected Storage batches: ${JSON.stringify(batchSizes)}`,
  );
});

Deno.test(
  'granular photo cleanup never clears metadata without verified zero Storage',
  async () => {
    let relocalized = false;
    const path = `${USER_ID}/photo.enc`;
    const { dependencies } = harness({
      listVerifiedStoragePaths: async () => [path],
      relocalizePhotoRows: async () => {
        relocalized = true;
        return { data: [{ id: photoId(1) }], error: null };
      },
    });
    await assertCleanupRejects(() =>
      runGranularPhotoCloudCleanup(USER_ID, dependencies)
    );
    assert(
      !relocalized,
      'metadata must remain recoverable when Storage absence is not proven',
    );
  },
);

function request(
  consentType: GranularWithdrawalRequest['consentType'] = 'ask_onskin',
): GranularWithdrawalRequest {
  const contract = CURRENT_GRANULAR_WITHDRAWAL_COPY_CONTRACT[consentType];
  return {
    consentType,
    version: contract.version,
    consentTextHash: contract.hash,
    idempotencyKey: IDEMPOTENCY_KEY,
    expectedProcessingEpoch: 7,
    expectedConsentGeneration: 3,
  };
}

function rpcRow(
  withdrawal: GranularWithdrawalRequest,
  state: 'withdrawing' | 'withdrawn',
  userId = USER_ID,
  operationId = OPERATION_ID,
) {
  return {
    operation_id: operationId,
    user_id: userId,
    consent_type: withdrawal.consentType,
    state,
    processing_epoch: withdrawal.expectedProcessingEpoch,
    consent_generation: withdrawal.expectedConsentGeneration + 1,
  };
}

function askCleanupResult(morePending = false) {
  return {
    ask_safety_audit_deleted: 1,
    ask_turn_audit_deleted: 2,
    ask_sessions_deleted: 1,
    more_pending: morePending,
  };
}

function communityCleanupResult() {
  return {
    community_reports_deleted: 0,
    community_reactions_deleted: 0,
    community_questions_deleted: 1,
    community_blocks_deleted: 0,
  };
}

Deno.test('granular withdrawal copy registry hashes every exact canonical text', async () => {
  for (
    const [consentType, contract] of Object.entries(
      CURRENT_GRANULAR_WITHDRAWAL_COPY_CONTRACT,
    )
  ) {
    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(contract.text),
    );
    const hash = Array.from(
      new Uint8Array(digest),
      (byte) => byte.toString(16).padStart(2, '0'),
    ).join('');
    assert(
      hash === contract.hash,
      `${consentType}: canonical copy hash drifted`,
    );
  }
});

Deno.test('draft copy blocks new production grants but not withdrawal completion', async () => {
  assert(
    HEALTH_CONSENT_DISCLOSURE_CONTRACTS.every(
      (contract) => contract.reviewStatus === 'draft_blocked',
    ) &&
      Object.values(CURRENT_GRANULAR_WITHDRAWAL_COPY_CONTRACT).every(
        (contract) => contract.reviewStatus === 'draft_blocked',
      ),
    'base and dependent contracts need explicit review status',
  );
  assertBaseHealthGrantCopyEnvironment('development');
  assertBaseHealthGrantCopyEnvironment('staging');
  let grantBlocked = false;
  try {
    assertBaseHealthGrantCopyEnvironment('production');
  } catch (error) {
    assert(
      error instanceof Error &&
        error.message === CONSENT_GRANT_COPY_PRODUCTION_ERROR,
      'production interlock must expose only the stable release-gate code',
    );
    grantBlocked = true;
  }
  assert(grantBlocked, 'draft legal copy must block a new production grant');

  const withdrawal = request('photo_trend_insights');
  const result = await runGranularWithdrawalLifecycle(withdrawal, {
    authenticatedUserId: USER_ID,
    begin: async () => ({
      data: [rpcRow(withdrawal, 'withdrawing')],
      error: null,
    }),
    cleanup: async () => ({ photo_trend_deleted: 1 }),
    complete: async () => ({
      data: [rpcRow(withdrawal, 'withdrawn')],
      error: null,
    }),
  });
  assert(
    result.status === 200 && result.body.withdrawn === true,
    'draft next-copy status may not strand an existing withdrawal',
  );
});

Deno.test('granular request parser requires exact keys, strong idempotency, and exact copy pair', () => {
  const valid = request('data_sharing');
  assert(
    parseGranularWithdrawalRequest(valid)?.consentType === 'data_sharing',
    'valid request',
  );
  assert(
    parseGranularWithdrawalRequest({ ...valid, extra: true }) === null,
    'extra key',
  );
  assert(
    parseGranularWithdrawalRequest({
      ...valid,
      idempotencyKey: 'A'.repeat(64),
    }) === null,
    'uppercase idempotency',
  );
  assert(
    parseGranularWithdrawalRequest({
      ...valid,
      idempotencyKey: 'a'.repeat(63),
    }) === null,
    'weak idempotency',
  );
  assert(
    parseGranularWithdrawalRequest({
      ...valid,
      version: CURRENT_GRANULAR_WITHDRAWAL_COPY_CONTRACT.ask_onskin.version,
      consentTextHash:
        CURRENT_GRANULAR_WITHDRAWAL_COPY_CONTRACT.ask_onskin.hash,
    }) === null,
    'cross-purpose copy',
  );
  assert(
    parseGranularWithdrawalRequest({ ...valid, expectedProcessingEpoch: 0 }) ===
      null,
    'inactive base epoch',
  );
  assert(
    parseGranularWithdrawalRequest({
      ...valid,
      expectedConsentGeneration: -1,
    }) === null,
    'negative dependent generation',
  );
  assert(
    parseGranularWithdrawalRequest({ ...valid, consentType: 'marketing' }) ===
      null,
    'marketing is not health-dependent',
  );
});

Deno.test('granular lifecycle publishes begin barrier before cleanup and completes last', async () => {
  const withdrawal = request();
  const calls: string[] = [];
  const dependencies: GranularWithdrawalDependencies = {
    authenticatedUserId: USER_ID,
    begin: async () => {
      calls.push('begin');
      return { data: [rpcRow(withdrawal, 'withdrawing')], error: null };
    },
    cleanup: async (operation) => {
      calls.push(`cleanup:${operation.operationId}`);
      return askCleanupResult();
    },
    complete: async (operationId) => {
      calls.push(`complete:${operationId}`);
      return { data: [rpcRow(withdrawal, 'withdrawn')], error: null };
    },
  };
  const result = await runGranularWithdrawalLifecycle(withdrawal, dependencies);
  assert(
    result.status === 200 && result.body.withdrawn === true,
    'expected terminal success',
  );
  assert(
    JSON.stringify(calls) ===
      JSON.stringify([
        'begin',
        `cleanup:${OPERATION_ID}`,
        `complete:${OPERATION_ID}`,
      ]),
    `unexpected lifecycle order: ${JSON.stringify(calls)}`,
  );
});

Deno.test('cleanup failure remains pending and never invokes completion', async () => {
  const withdrawal = request('photo_trend_insights');
  let completed = false;
  const result = await runGranularWithdrawalLifecycle(withdrawal, {
    authenticatedUserId: USER_ID,
    begin: async () => ({
      data: [rpcRow(withdrawal, 'withdrawing')],
      error: null,
    }),
    cleanup: async () => {
      throw new Error('provider detail must be redacted');
    },
    complete: async () => {
      completed = true;
      return { data: [], error: null };
    },
  });
  assert(result.status === 202, 'cleanup failure must be retryable pending');
  assert(
    result.body.withdrawn === false && result.body.pending === true,
    'must not claim success',
  );
  assert(
    result.body.error === 'CONSENT_WITHDRAWAL_RETRY_REQUIRED',
    'stable redacted error',
  );
  assert(!completed, 'completion must not run after failed cleanup');
});

Deno.test('cleanup must exactly match its purpose and have no pending batch before completion', async () => {
  const withdrawal = request('ask_onskin');
  for (const cleanup of [{ photo_trend_deleted: 1 }, askCleanupResult(true)]) {
    let completed = false;
    const result = await runGranularWithdrawalLifecycle(withdrawal, {
      authenticatedUserId: USER_ID,
      begin: async () => ({
        data: [rpcRow(withdrawal, 'withdrawing')],
        error: null,
      }),
      cleanup: async () => cleanup,
      complete: async () => {
        completed = true;
        return { data: [], error: null };
      },
    });
    assert(
      result.status === 202 && result.body.stage === 'cleanup',
      'malformed or incomplete cleanup must remain retryable',
    );
    assert(!completed, 'unattested cleanup may not reach database completion');
  }
});

Deno.test('lost begin response is ambiguous pending and safe to retry with the same key', async () => {
  const withdrawal = request('ask_onskin');
  let cleaned = false;
  const result = await runGranularWithdrawalLifecycle(withdrawal, {
    authenticatedUserId: USER_ID,
    begin: async () => {
      throw new Error('response lost after possible commit');
    },
    cleanup: async () => {
      cleaned = true;
      return {};
    },
    complete: async () => ({ data: [], error: null }),
  });
  assert(
    result.status === 202,
    'ambiguous begin must be a retryable pending result',
  );
  assert(
    result.body.pending === true && result.body.retry_required === true,
    'must retry same key',
  );
  assert(
    result.body.state_unknown === true &&
      result.body.error === 'CONSENT_WITHDRAWAL_BEGIN_OUTCOME_UNKNOWN',
    'transport interruption must preserve the unknown-outcome distinction',
  );
  assert(result.body.stage === 'begin', 'ambiguous stage must be explicit');
  assert(!cleaned, 'cleanup cannot run without the exact begin attestation');
});

Deno.test('definite begin RPC rejection is not reported as a pending withdrawal', async () => {
  const withdrawal = request('ask_onskin');
  let cleaned = false;
  const result = await runGranularWithdrawalLifecycle(withdrawal, {
    authenticatedUserId: USER_ID,
    begin: async () => ({
      data: null,
      error: { code: '55000', message: 'sensitive database detail' },
    }),
    cleanup: async () => {
      cleaned = true;
      return {};
    },
    complete: async () => ({ data: [], error: null }),
  });
  assert(
    result.status === 409,
    'definite begin rejection should be a conflict',
  );
  assert(
    result.body.pending === false && result.body.state_unknown === false,
    'a rolled-back/rejected begin must not claim server-side pending state',
  );
  assert(
    result.body.error === 'CONSENT_WITHDRAWAL_BEGIN_REJECTED' &&
      !JSON.stringify(result.body).includes('sensitive database detail'),
    'begin rejection must be stable and redacted',
  );
  assert(!cleaned, 'cleanup cannot run after a rejected barrier');
});

Deno.test('supabase-normalized begin transport error remains state-unknown', async () => {
  const withdrawal = request('ask_onskin');
  const result = await runGranularWithdrawalLifecycle(withdrawal, {
    authenticatedUserId: USER_ID,
    begin: async () => ({
      data: null,
      error: {
        code: '',
        message: 'TypeError: Failed to fetch',
        details: 'sensitive transport stack',
        hint: '',
      },
    }),
    cleanup: async () => ({}),
    complete: async () => ({ data: [], error: null }),
  });
  assert(
    result.status === 202 &&
      result.body.pending === true &&
      result.body.state_unknown === true,
    'normalized fetch failure must retry the same idempotency key',
  );
  assert(
    result.body.error === 'CONSENT_WITHDRAWAL_BEGIN_OUTCOME_UNKNOWN' &&
      !JSON.stringify(result.body).includes('sensitive transport stack'),
    'ambiguous transport response must be stable and redacted',
  );
});

Deno.test('caller provider overflow stays truthfully withdrawing until worker transition', async () => {
  const withdrawal = request('photo_cloud_backup');
  let completed = false;
  const result = await runGranularWithdrawalLifecycle(withdrawal, {
    authenticatedUserId: USER_ID,
    begin: async () => ({
      data: [rpcRow(withdrawal, 'withdrawing')],
      error: null,
    }),
    cleanup: async () => {
      throw new GranularActionRequiredError();
    },
    complete: async () => {
      completed = true;
      return { data: [], error: null };
    },
  });
  assert(
    result.status === 202,
    'caller lane must preserve the database pending state',
  );
  assert(
    result.body.pending === true && result.body.retry_required === true,
    'scheduled recovery remains required',
  );
  assert(
    result.body.state === 'withdrawing' &&
      !Object.hasOwn(result.body, 'action_required'),
    'an ephemeral Edge observation may not claim durable operator state',
  );
  assert(!completed, 'completion cannot run after bounded cleanup refusal');
});

Deno.test('every Storage traversal ceiling becomes stable action-required', async () => {
  for (
    const reason of [
      'OBJECT_LIMIT_EXCEEDED',
      'PATH_DEPTH_LIMIT_EXCEEDED',
      'PREFIX_LIMIT_EXCEEDED',
      'PAGE_REQUEST_LIMIT_EXCEEDED',
    ]
  ) {
    await assertActionRequired(() =>
      runGranularPhotoCloudCleanup(
        USER_ID,
        harness({
          listVerifiedStoragePaths: async () => {
            throw new Error(
              `EXPORT_SOURCE_INCOMPLETE:photo_storage_objects:${reason}`,
            );
          },
        }).dependencies,
      )
    );
  }
});

Deno.test('lost success response replay reuses terminal operation without cleanup', async () => {
  const withdrawal = request('community_participation');
  let state: 'withdrawing' | 'withdrawn' = 'withdrawing';
  let cleanupCount = 0;
  let completionCount = 0;
  const dependencies: GranularWithdrawalDependencies = {
    authenticatedUserId: USER_ID,
    begin: async () => ({ data: [rpcRow(withdrawal, state)], error: null }),
    cleanup: async () => {
      cleanupCount += 1;
      return communityCleanupResult();
    },
    complete: async () => {
      completionCount += 1;
      state = 'withdrawn';
      return { data: [rpcRow(withdrawal, state)], error: null };
    },
  };

  const lostResponse = await runGranularWithdrawalLifecycle(
    withdrawal,
    dependencies,
  );
  assert(
    lostResponse.body.withdrawn === true,
    'first operation should reach terminal state',
  );
  const replay = await runGranularWithdrawalLifecycle(withdrawal, dependencies);
  assert(
    replay.status === 200 && replay.body.replayed === true,
    'retry should replay terminal row',
  );
  assert(cleanupCount === 1, 'terminal replay must not repeat cleanup');
  assert(completionCount === 1, 'terminal replay must not repeat completion');
});

Deno.test('authenticated photo cleanup never trusts a canonical prefix over foreign owner metadata', async () => {
  const conflictingObject = {
    name: `${USER_ID}/e7/foreign-owned.enc`,
    owner_id: USER_B_ID,
  };
  assert(
    conflictingObject.name.startsWith(`${USER_ID}/`) &&
      conflictingObject.owner_id !== USER_ID,
    'test must model the conflicting ownership evidence',
  );

  let clientTouched = false;
  const admin = new Proxy({}, {
    get() {
      clientTouched = true;
      throw new Error('authenticated caller touched Storage');
    },
  });
  for (const consentType of ['photo_capture', 'photo_cloud_backup'] as const) {
    try {
      await runAuthenticatedHealthDependentCleanup(admin, {
        operationId: OPERATION_ID,
        userId: USER_ID,
        consentType,
        state: 'withdrawing',
        processingEpoch: 7,
        consentGeneration: 4,
      });
    } catch (error) {
      assert(
        error instanceof DependentPhotoCleanupRequiresWorkerError,
        'photo cleanup must be reserved for the DB-attested worker',
      );
      continue;
    }
    throw new Error('expected authenticated photo cleanup deferral');
  }
  assert(
    !clientTouched,
    'authenticated photo withdrawal must not list or remove Storage',
  );
});

Deno.test('authenticated non-photo cleanup remains immediate', async () => {
  let selected = false;
  const builder = {
    select() {
      selected = true;
      return builder;
    },
    eq() {
      return builder;
    },
    order() {
      return builder;
    },
    limit() {
      return { data: [], error: null };
    },
  };
  const cleanup = await runAuthenticatedHealthDependentCleanup(
    {
      from(table: string) {
        assert(table === 'photo_trend', 'unexpected non-photo cleanup table');
        return builder;
      },
    },
    {
      operationId: OPERATION_ID,
      userId: USER_ID,
      consentType: 'photo_trend_insights',
      state: 'withdrawing',
      processingEpoch: 7,
      consentGeneration: 4,
    },
  );
  assert(selected, 'non-photo caller cleanup must still execute immediately');
  assert(
    cleanup.photo_trend_deleted === 0,
    'non-photo cleanup attestation must be preserved',
  );
});

Deno.test('terminal photo replay bypasses caller cleanup and returns exact success', async () => {
  const withdrawal = request('photo_capture');
  let clientTouched = false;
  let completionCalled = false;
  const admin = new Proxy({}, {
    get() {
      clientTouched = true;
      throw new Error('terminal replay touched provider');
    },
  });
  const result = await runGranularWithdrawalLifecycle(withdrawal, {
    authenticatedUserId: USER_ID,
    begin: async () => ({
      data: [rpcRow(withdrawal, 'withdrawn')],
      error: null,
    }),
    cleanup: (operation) =>
      runAuthenticatedHealthDependentCleanup(admin, operation),
    complete: async () => {
      completionCalled = true;
      return { data: [], error: null };
    },
  });
  assert(
    result.status === 200 && result.body.withdrawn === true &&
      result.body.replayed === true && result.body.pending === false,
    'terminal replay must return exact authoritative success',
  );
  assert(
    !clientTouched && !completionCalled,
    'terminal replay must issue no cleanup or completion calls',
  );
});

Deno.test('A to B begin attestation mismatch issues no cleanup and returns no operation id', async () => {
  const withdrawal = request('data_sharing');
  let cleaned = false;
  const result = await runGranularWithdrawalLifecycle(withdrawal, {
    authenticatedUserId: USER_ID,
    begin: async () => ({
      data: [rpcRow(withdrawal, 'withdrawing', USER_B_ID)],
      error: null,
    }),
    cleanup: async () => {
      cleaned = true;
      return {};
    },
    complete: async () => ({ data: [], error: null }),
  });
  assert(result.status === 502, 'cross-owner attestation must fail closed');
  assert(!cleaned, 'cross-owner row must issue no cleanup');
  assert(
    !('operation_id' in result.body),
    'foreign operation id must not be disclosed',
  );
});

Deno.test('completion residue or provider failure remains withdrawing and retry-required', async () => {
  const withdrawal = request('ask_onskin');
  const result = await runGranularWithdrawalLifecycle(withdrawal, {
    authenticatedUserId: USER_ID,
    begin: async () => ({
      data: [rpcRow(withdrawal, 'withdrawing')],
      error: null,
    }),
    cleanup: async () => askCleanupResult(),
    complete: async () => ({ data: null, error: { code: 'RESIDUE_REMAINS' } }),
  });
  assert(result.status === 202, 'zero-attestation failure must stay pending');
  assert(result.body.state === 'withdrawing', 'state must remain withdrawing');
  assert(
    result.body.withdrawn === false,
    'must not claim withdrawn before zero attestation',
  );
  assert(result.body.stage === 'completion', 'retry stage should be stable');
});

Deno.test('Edge granular path has no direct consent-ledger insert', async () => {
  const source = await Deno.readTextFile(
    new URL('./index.ts', import.meta.url),
  );
  assert(
    !source.includes("from('consents')"),
    'Edge must use the atomic begin RPC, not consents',
  );
  assert(
    source.indexOf("caller.rpc('begin_health_dependent_consent_withdrawal'") <
      source.indexOf(
        'runAuthenticatedHealthDependentCleanup(admin, operation)',
      ),
    'source contract must declare begin before cleanup',
  );
  assert(
    source.includes('runAuthenticatedHealthDependentCleanup') &&
      !source.includes('runHealthDependentCleanup(admin, operation)'),
    'authenticated dependent photo cleanup must not bypass the worker lease',
  );
});

Deno.test('Edge adapters mirror the exact Ask and photo residual contract', async () => {
  const source = await Deno.readTextFile(
    new URL('./dependentCleanupRuntime.ts', import.meta.url),
  );
  assert(
    source.match(/local_only\.eq\.false,storage_path\.not\.is\.null/g)
      ?.length ===
      2,
    'cloud withdrawal must include legacy local-only rows with remote paths',
  );
  const captureCase = source.slice(
    source.indexOf("case 'photo_capture'"),
    source.indexOf("case 'photo_cloud_backup'"),
  );
  assert(
    captureCase.includes('withdrawPhotoCapture') &&
      captureCase.includes('withdrawTrendInsights'),
    'capture withdrawal must aggregate remote photo and trend cleanup',
  );
  const askCleanup = source.slice(
    source.indexOf('async function withdrawAskOnSkin'),
    source.indexOf('async function withdrawTrendInsights'),
  );
  assert(
    askCleanup.indexOf("'ask_safety_audit'") <
      askCleanup.indexOf('runAskOnSkinCleanup'),
    'Ask safety children must be bounded before turn/session cleanup',
  );
  const edgeSource = await Deno.readTextFile(
    new URL('./index.ts', import.meta.url),
  );
  assert(
    edgeSource.includes("healthRequest?.action === 'reconsent'") &&
      edgeSource.includes(
        'assertBaseHealthGrantCopyEnvironment(appEnvironment)',
      ) &&
      edgeSource.indexOf(
          'assertBaseHealthGrantCopyEnvironment(appEnvironment)',
        ) >
        edgeSource.indexOf('Deno.serve'),
    'copy review may gate new reconsent only, never module startup or withdrawal',
  );
  const workerSource = await Deno.readTextFile(
    new URL('../health-consent-worker/index.ts', import.meta.url),
  );
  assert(
    !edgeSource.includes(
      'mark_health_dependent_consent_withdrawal_action_required',
    ) &&
      workerSource.includes(
        'mark_health_dependent_consent_withdrawal_action_required',
      ) &&
      workerSource.includes('list_health_dependent_consent_storage_work') &&
      workerSource.includes('runHealthDependentCleanup(admin, operation)') &&
      !workerSource.includes('assertBaseHealthGrantCopyEnvironment'),
    'only the leased scheduled lane may delete photo Storage or publish durable action-required state',
  );
});

Deno.test('photo provider interruption resumes from verified Storage absence', async () => {
  const path = `${USER_ID}/photo.enc`;
  let storagePaths = [path];
  let relocalized = false;
  let firstRemove = true;
  const dependencies: GranularPhotoCloudCleanupDependencies = {
    countPhotoRows: async () => ({ count: 1, error: null }),
    listPhotoRows: async () => ({
      data: [{ id: photoId(1), storage_path: path }],
      error: null,
    }),
    listVerifiedStoragePaths: async () => [...storagePaths],
    removeStorage: async () => {
      storagePaths = [];
      if (firstRemove) {
        firstRemove = false;
        throw new Error('provider response interrupted after delete');
      }
      return { error: null };
    },
    relocalizePhotoRows: async () => {
      relocalized = true;
      return { data: [{ id: photoId(1) }], error: null };
    },
  };

  await assertCleanupRejects(() =>
    runGranularPhotoCloudCleanup(USER_ID, dependencies)
  );
  assert(!relocalized, 'interrupted provider response must not clear metadata');
  const resumed = await runGranularPhotoCloudCleanup(USER_ID, dependencies);
  assert(
    resumed.storage_objects_removed === 0,
    'retry should observe provider deletion',
  );
  assert(
    resumed.photo_rows_relocalized === 1 && relocalized,
    'retry should finish metadata',
  );
  assert(
    storagePaths.length === 0,
    'terminal photo cleanup requires verified zero Storage',
  );
});

Deno.test('Ask cleanup deletes turns before sessions and verifies every child stage', async () => {
  const sessionId = photoId(101);
  const turnId = photoId(102);
  const calls: string[] = [];
  let turnListCount = 0;
  const dependencies: AskOnSkinCleanupDependencies = {
    listSessionRows: async () => {
      calls.push('list-sessions');
      return { data: [{ id: sessionId }], error: null };
    },
    listTurnRows: async () => {
      calls.push('list-turns');
      turnListCount += 1;
      return {
        data: turnListCount === 1
          ? [{ id: turnId, session_id: sessionId }]
          : [],
        error: null,
      };
    },
    findSafetyRowsForTurns: async () => {
      calls.push('verify-no-safety');
      return { data: [], error: null };
    },
    deleteTurnRows: async () => {
      calls.push('delete-turns');
      return {
        data: [{ id: turnId, session_id: sessionId }],
        error: null,
      };
    },
    findTurnRows: async () => {
      calls.push('verify-turns');
      return { data: [], error: null };
    },
    deleteSessionRows: async () => {
      calls.push('delete-sessions');
      return { data: [{ id: sessionId }], error: null };
    },
    findSessionRows: async () => {
      calls.push('verify-sessions');
      return { data: [], error: null };
    },
  };
  const result = await runAskOnSkinCleanup(dependencies);
  assert(
    JSON.stringify(calls) ===
      JSON.stringify([
        'list-sessions',
        'list-turns',
        'verify-no-safety',
        'delete-turns',
        'verify-turns',
        'list-turns',
        'delete-sessions',
        'verify-sessions',
      ]),
    `unsafe Ask cleanup order: ${JSON.stringify(calls)}`,
  );
  assert(
    result.ask_turn_audit_deleted === 1 &&
      result.ask_sessions_deleted === 1 &&
      !result.more_pending,
    'Ask graph should reach a verified empty state',
  );
});

Deno.test('Ask cleanup escalates a residual safety child without cascading foreign data', async () => {
  const sessionId = photoId(151);
  const turnId = photoId(152);
  let turnDeleted = false;
  await assertActionRequired(() =>
    runAskOnSkinCleanup({
      listSessionRows: async () => ({
        data: [{ id: sessionId }],
        error: null,
      }),
      listTurnRows: async () => ({
        data: [{ id: turnId, session_id: sessionId }],
        error: null,
      }),
      findSafetyRowsForTurns: async () => ({
        data: [{ id: photoId(153) }],
        error: null,
      }),
      deleteTurnRows: async () => {
        turnDeleted = true;
        return { data: [], error: null };
      },
      findTurnRows: async () => ({ data: [], error: null }),
      deleteSessionRows: async () => ({ data: [], error: null }),
      findSessionRows: async () => ({ data: [], error: null }),
    })
  );
  assert(!turnDeleted, 'foreign/inconsistent safety child must never cascade');
});

Deno.test('Ask cleanup bounds one turn batch and preserves parent sessions for retry', async () => {
  const sessionId = photoId(201);
  const turns = Array.from(
    { length: GRANULAR_DB_MAX_ROWS_PER_SCOPE + 1 },
    (_, index) => ({
      id: photoId(1_000 + index),
      session_id: sessionId,
    }),
  );
  let sessionsDeleted = false;
  const result = await runAskOnSkinCleanup({
    listSessionRows: async () => ({
      data: [{ id: sessionId }],
      error: null,
    }),
    listTurnRows: async () => ({ data: turns, error: null }),
    findSafetyRowsForTurns: async () => ({ data: [], error: null }),
    deleteTurnRows: async (ids) => ({
      data: ids.map((id) => ({ id, session_id: sessionId })),
      error: null,
    }),
    findTurnRows: async () => ({ data: [], error: null }),
    deleteSessionRows: async () => {
      sessionsDeleted = true;
      return { data: [{ id: sessionId }], error: null };
    },
    findSessionRows: async () => ({ data: [], error: null }),
  });
  assert(
    result.ask_turn_audit_deleted === GRANULAR_DB_MAX_ROWS_PER_SCOPE,
    'one invocation must honor the turn-delete bound',
  );
  assert(result.more_pending, 'the remaining turn must be resumed later');
  assert(!sessionsDeleted, 'a parent with turn residue must be preserved');
});

Deno.test('data-sharing cleanup detaches and verifies attribution before deleting click row', async () => {
  const clickId = photoId(21);
  const attributionId = photoId(22);
  const calls: string[] = [];
  const dependencies: DataSharingCleanupDependencies = {
    listClickRows: async () => {
      calls.push('list-clicks');
      return {
        data: [{ id: clickId, click_token: 'opaque-click-token-1234' }],
        error: null,
      };
    },
    listAttributionRows: async () => {
      calls.push('list-attributions');
      return { data: [{ id: attributionId }], error: null };
    },
    detachAttributions: async () => {
      calls.push('detach-attributions');
      return { data: [{ id: attributionId }], error: null };
    },
    findAttributions: async () => {
      calls.push('verify-attributions');
      return { data: [], error: null };
    },
    deleteClickRows: async () => {
      calls.push('delete-clicks');
      return { data: [{ id: clickId }], error: null };
    },
    findClickRows: async () => {
      calls.push('verify-clicks');
      return { data: [], error: null };
    },
  };
  const result = await runDataSharingCleanup(dependencies);
  assert(
    JSON.stringify(calls) ===
      JSON.stringify([
        'list-clicks',
        'list-attributions',
        'detach-attributions',
        'verify-attributions',
        'delete-clicks',
        'verify-clicks',
      ]),
    `unsafe data-sharing order: ${JSON.stringify(calls)}`,
  );
  assert(
    result.order_attributions_detached === 1,
    'expected detached attribution',
  );
  assert(result.commerce_click_events_deleted === 1, 'expected deleted click');
});

Deno.test('data-sharing attribution race preserves click row for retry and DB completion', async () => {
  const clickId = photoId(31);
  const attributionId = photoId(32);
  let clickDeleted = false;
  const result = await runDataSharingCleanup({
    listClickRows: async () => ({
      data: [{ id: clickId, click_token: 'opaque-click-token-5678' }],
      error: null,
    }),
    listAttributionRows: async () => ({
      data: [{ id: attributionId }],
      error: null,
    }),
    detachAttributions: async () => ({
      data: [{ id: attributionId }],
      error: null,
    }),
    findAttributions: async () => ({
      data: [{ id: photoId(33) }],
      error: null,
    }),
    deleteClickRows: async () => {
      clickDeleted = true;
      return { data: [{ id: clickId }], error: null };
    },
    findClickRows: async () => ({ data: [], error: null }),
  });
  assert(
    !clickDeleted,
    'click evidence must survive until all attribution links are detached',
  );
  assert(result.more_pending, 'race residue must require retry');
  assert(
    result.commerce_click_events_deleted === 0,
    'race may not report click deletion',
  );
});
