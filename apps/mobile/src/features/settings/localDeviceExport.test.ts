import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AGE_POLICY_RECEIPT_KEY, AGE_POLICY_SHA256 } from '@/features/onboarding/ageGate';
import { ONBOARDING_QUIZ, scoreQuiz, type QuizAnswers } from '@/features/onboarding/quiz';

import {
  LOCAL_PRIVATE_DATA_KEYS,
  LOCAL_PRIVATE_SECURE_CONTROL_KEYS,
  LOCAL_PRIVATE_SECURE_CONTROL_KEY_PREFIXES,
} from './localPrivateDataKeys';
import {
  buildMobileDataExportBundle,
  collectLocalDeviceExportData,
  LOCAL_DEVICE_EXPORT_EXCLUDED_STORAGE_KEYS,
  LOCAL_DEVICE_EXPORT_STORAGE_KEYS,
} from './localDeviceExport';

const mocks = vi.hoisted(() => ({
  decryptPhotoNoteForPurposeLimitedExport: vi.fn(),
  getPrivateItemsForPurposeLimitedExport: vi.fn(),
  purgeExpiredCatalogLookupQueueForPurposeLimitedExport: vi.fn(),
}));

const CURRENT_PROFILE_RESULT = scoreQuiz(
  Object.fromEntries(
    ONBOARDING_QUIZ.map((question) => [
      question.id,
      question.multiSelect === true ? [question.options[0]!.id] : question.options[0]!.id,
    ]),
  ) as QuizAnswers,
);

vi.mock('@/features/photos/encryptedStorage', () => ({
  decryptPhotoNoteForPurposeLimitedExport: mocks.decryptPhotoNoteForPurposeLimitedExport,
}));

vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItemsForPurposeLimitedExport: mocks.getPrivateItemsForPurposeLimitedExport,
}));

vi.mock('@/lib/offline/catalogLookupQueue', () => ({
  purgeExpiredCatalogLookupQueueForPurposeLimitedExport:
    mocks.purgeExpiredCatalogLookupQueueForPurposeLimitedExport,
}));

describe('local device data export', () => {
  const expectedUserId = 'user-1';
  const controller = new AbortController();
  const accountLease = {
    generation: 0,
    signal: controller.signal,
    assertCurrent: vi.fn(),
  };

  beforeEach(() => {
    accountLease.assertCurrent.mockReset();
    mocks.decryptPhotoNoteForPurposeLimitedExport.mockReset();
    mocks.getPrivateItemsForPurposeLimitedExport.mockReset();
    mocks.purgeExpiredCatalogLookupQueueForPurposeLimitedExport.mockReset();
    mocks.decryptPhotoNoteForPurposeLimitedExport.mockResolvedValue(null);
    mocks.getPrivateItemsForPurposeLimitedExport.mockResolvedValue(new Map());
    mocks.purgeExpiredCatalogLookupQueueForPurposeLimitedExport.mockResolvedValue({
      expired: 0,
      remaining: 0,
      nextRetryAt: null,
      nextExpiryAt: null,
    });
  });

  it('accounts for every encrypted local private-data key exactly once', () => {
    const accountedKeys = [
      ...LOCAL_DEVICE_EXPORT_STORAGE_KEYS,
      ...LOCAL_DEVICE_EXPORT_EXCLUDED_STORAGE_KEYS,
    ];
    expect(accountedKeys.sort()).toEqual([...LOCAL_PRIVATE_DATA_KEYS].sort());
    expect(new Set(accountedKeys).size).toBe(accountedKeys.length);
    expect(LOCAL_DEVICE_EXPORT_STORAGE_KEYS).not.toContain('layerwell.widgetActionMap.v1');
    expect(LOCAL_DEVICE_EXPORT_STORAGE_KEYS).not.toContain('layerwell.widgetActionMap.v2');
    expect(LOCAL_DEVICE_EXPORT_STORAGE_KEYS).not.toContain('layerwell.widgetOwnerAuthority.v1');
  });

  it('never reads or exports durable privacy-request recovery capabilities', async () => {
    await collectLocalDeviceExportData(accountLease, expectedUserId, '2026-07-10T12:00:00.000Z');

    const requested = mocks.getPrivateItemsForPurposeLimitedExport.mock
      .calls[0]?.[0] as readonly string[];
    for (const key of LOCAL_PRIVATE_SECURE_CONTROL_KEYS) {
      expect(requested).not.toContain(key);
    }
    for (const prefix of LOCAL_PRIVATE_SECURE_CONTROL_KEY_PREFIXES) {
      expect(requested.some((key) => key.startsWith(prefix))).toBe(false);
    }
  });

  it('physically purges catalog TTL bytes before reading the export snapshot', async () => {
    const order: string[] = [];
    mocks.purgeExpiredCatalogLookupQueueForPurposeLimitedExport.mockImplementationOnce(async () => {
      order.push('purge');
      return { expired: 1, remaining: 0, nextRetryAt: null, nextExpiryAt: null };
    });
    mocks.getPrivateItemsForPurposeLimitedExport.mockImplementationOnce(async () => {
      order.push('read');
      return new Map();
    });

    await collectLocalDeviceExportData(accountLease, expectedUserId, '2026-07-10T12:00:00.000Z');

    expect(order).toEqual(['purge', 'read']);
    expect(mocks.purgeExpiredCatalogLookupQueueForPurposeLimitedExport).toHaveBeenCalledWith(
      accountLease,
      expectedUserId,
      new Date('2026-07-10T12:00:00.000Z'),
    );
  });

  it('exports device-authoritative records while redacting media paths and ciphertext', async () => {
    const stored = new Map<string, string>([
      [
        AGE_POLICY_RECEIPT_KEY,
        JSON.stringify({
          receipt_version: 1,
          policy_sha256: AGE_POLICY_SHA256,
          eligible: true,
        }),
      ],
      [
        'layerwell.skinprofile.v1',
        JSON.stringify({
          version: 2,
          profile: {
            result: CURRENT_PROFILE_RESULT,
            goals: ['clear_skin'],
            completedAt: '2026-07-10T12:00:00.000Z',
          },
        }),
      ],
      [
        'layerwell.shelf.v1',
        JSON.stringify([
          {
            id: 'shelf-1',
            name: 'Retinol 0.3%',
            thumbnailPath: 'file:///private/shelf-1.jpg',
            nested: { localUri: 'file:///private/other.jpg', safe: true },
          },
        ]),
      ],
      ['layerwell.completions.v1', JSON.stringify({ '2026-07-09': ['PM:shelf-1'] })],
      ['layerwell.conflict.overrides', JSON.stringify(['rule-1:acid+retinoid'])],
      [
        'layerwell.cycle.v1',
        JSON.stringify({ schemaVersion: 1, variant: 'gentle', customCycle: null }),
      ],
      [
        'layerwell.cycle.v2',
        JSON.stringify({
          schemaVersion: 1,
          variant: 'custom',
          customCycle: {
            schemaVersion: 1,
            lengthNights: 2,
            nights: [{ productId: 'shelf-1' }, { productId: null }],
          },
        }),
      ],
      [
        'layerwell.routineOrder.v1',
        JSON.stringify({ schemaVersion: 1, am: ['shelf-1'], pm: ['shelf-1'] }),
      ],
      [
        'layerwell.healthDataLifecycle.v1',
        JSON.stringify({
          schemaVersion: 3,
          ownerUserId: 'user-1',
          state: 'withdrawing',
          processingEpoch: 2,
          operationId: 'operation-1',
          idempotencyKey: 'secret-idempotency-key',
          localCleanupComplete: true,
          activationRoutePending: false,
          verificationReason: null,
          verificationResumeState: null,
          serverVerifiedAt: '2026-07-10T11:59:00.000Z',
          updatedAt: '2026-07-10T12:00:00.000Z',
        }),
      ],
      [
        'layerwell.catalog.lookupQueue.v1',
        JSON.stringify({
          version: 1,
          items: [
            {
              ownerUserId: 'user-1',
              barcode: '036000291452',
              shelfProductId: null,
              state: 'pending',
              enqueuedAt: '2026-07-10T11:00:00.000Z',
              expiresAt: '2026-07-17T11:00:00.000Z',
              attemptCount: 0,
              nextAttemptAt: '2026-07-10T11:00:00.000Z',
              lastAttemptAt: null,
              candidate: null,
            },
          ],
        }),
      ],
      [
        'layerwell.photos.v1',
        JSON.stringify([
          {
            id: 'photo-1',
            series: 'front',
            takenLocalDate: '2026-07-09',
            notes: null,
            notesCiphertext: 'encrypted-note',
            localUri: 'file:///private/photo-1.layerwellphoto',
            encryptedLocalUri: 'file:///private/photo-1.layerwellphoto',
            thumbnailLocalUri: 'file:///private/photo-1-thumb.jpg',
            storagePath: 'user-1/photo-1.jpg',
            keyId: 'photo-content-key-v1',
          },
          'invalid-row',
        ]),
      ],
    ]);
    mocks.getPrivateItemsForPurposeLimitedExport.mockImplementation(
      async (keys: readonly string[]) => new Map(keys.map((key) => [key, stored.get(key) ?? null])),
    );
    mocks.decryptPhotoNoteForPurposeLimitedExport.mockResolvedValue('Less redness today');

    const result = await collectLocalDeviceExportData(
      accountLease,
      expectedUserId,
      '2026-07-10T12:00:00.000Z',
    );

    expect(result.sections.profile_and_preferences.skin_profile).toEqual(
      expect.objectContaining({
        version: 2,
        profile: expect.objectContaining({
          result: expect.objectContaining({
            axesBasisPoints: CURRENT_PROFILE_RESULT.axesBasisPoints,
            provenance: CURRENT_PROFILE_RESULT.provenance,
          }),
          goals: ['clear_skin'],
        }),
      }),
    );
    expect(result.sections.account_and_privacy.age_policy_receipt).toEqual({
      receipt_version: 1,
      policy_sha256: AGE_POLICY_SHA256,
      eligible: true,
    });
    expect(result.schema_version).toBe(2);
    expect(result.sections.shelf_and_routine.completion_and_sync_state).toEqual({
      '2026-07-09': ['PM:shelf-1'],
    });
    expect(result.sections.shelf_and_routine.routine_order_overrides).toEqual({
      schemaVersion: 1,
      am: ['shelf-1'],
      pm: ['shelf-1'],
    });
    expect(result.sections.shelf_and_routine.cycle_configuration).toMatchObject({
      schemaVersion: 1,
      variant: 'custom',
      customCycle: {
        schemaVersion: 1,
        lengthNights: 2,
      },
    });
    expect(result.sections.shelf_and_routine.legacy_cycle_configuration).toMatchObject({
      variant: 'gentle',
    });
    expect(result.sections.account_and_privacy.health_data_lifecycle).toMatchObject({
      state: 'withdrawing',
      processingEpoch: 2,
      localCleanupComplete: true,
    });
    expect(result.sections.account_and_privacy.health_data_lifecycle).not.toHaveProperty(
      'ownerUserId',
    );
    expect(result.sections.shelf_and_routine.pending_catalog_lookups).toEqual({
      version: 1,
      items: [
        {
          barcode: '036000291452',
          shelfProductId: null,
          state: 'pending',
          enqueuedAt: '2026-07-10T11:00:00.000Z',
          expiresAt: '2026-07-17T11:00:00.000Z',
          attemptCount: 0,
          nextAttemptAt: '2026-07-10T11:00:00.000Z',
          lastAttemptAt: null,
          candidate: null,
        },
      ],
    });
    expect(result.sections.shelf_and_routine.conflict_overrides).toEqual({
      schemaVersion: 1,
      choices: {
        'rule-1:acid+retinoid': {
          choice: 'use_together',
          ruleId: 'rule-1',
          ruleVersion: 1,
          productIds: ['acid', 'retinoid'],
          corpusSha256: null,
          ruleContentSha256: null,
        },
      },
    });
    expect(result.sections.shelf_and_routine.shelf_and_sync_state).toEqual([
      {
        id: 'shelf-1',
        name: 'Retinol 0.3%',
        nested: { safe: true },
      },
    ]);
    expect(result.sections.progress.photo_records).toEqual({
      records: [
        {
          id: 'photo-1',
          series: 'front',
          takenLocalDate: '2026-07-09',
          notes: 'Less redness today',
          notesExportStatus: 'included',
        },
      ],
      omitted_invalid_record_count: 1,
      photo_files_included: false,
      thumbnails_included: false,
    });

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('file:///');
    expect(serialized).not.toContain('notesCiphertext');
    expect(serialized).not.toContain('storagePath');
    expect(serialized).not.toContain('thumbnailPath');
    expect(serialized).not.toContain('photo-content-key-v1');
    expect(serialized).not.toContain('secret-idempotency-key');
    expect(serialized).not.toContain('q_oil');
    expect(serialized).not.toContain('answerHash');
  });

  it('marks an undecryptable photo note without exporting its ciphertext', async () => {
    mocks.getPrivateItemsForPurposeLimitedExport.mockImplementation(
      async (keys: readonly string[]) =>
        new Map(
          keys.map((key) => [
            key,
            key === 'layerwell.photos.v1'
              ? JSON.stringify([{ id: 'photo-1', notesCiphertext: 'invalid-envelope' }])
              : null,
          ]),
        ),
    );

    const result = await collectLocalDeviceExportData(
      accountLease,
      expectedUserId,
      '2026-07-10T12:00:00.000Z',
    );

    expect(result.sections.progress.photo_records?.records[0]).toEqual({
      id: 'photo-1',
      notes: null,
      notesExportStatus: 'unavailable',
    });
    expect(JSON.stringify(result)).not.toContain('invalid-envelope');
  });

  it('exports representative v3 pending and terminal completion and Shelf sync evidence', async () => {
    const productA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const productB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const routineId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const stepA = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    const stepB = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    const pendingEvent = '11111111-1111-4111-8111-111111111111';
    const terminalEvent = '22222222-2222-4222-8222-222222222222';
    const pendingMirror = {
      operationId: '33333333-3333-4333-8333-333333333333',
      enqueuedAt: '2026-07-10T11:00:00.000Z',
      kind: 'delete',
      productId: productA,
    };
    const terminalMirror = {
      operationId: '44444444-4444-4444-8444-444444444444',
      enqueuedAt: '2026-07-10T10:00:00.000Z',
      kind: 'delete',
      productId: productB,
    };
    const completionState = {
      version: 3,
      days: {
        '2026-07-09': [`AM:${productA}`],
        '2026-07-10': [`AM:${productB}`],
        '2026-07-08': ['AM:legacy-shelf-product'],
      },
      completedDays: [],
      sync: {
        routineIds: { AM: routineId, PM: null },
        stepIds: {
          [`AM:${productA}`]: { id: stepA, stepOrder: 1 },
          [`AM:${productB}`]: { id: stepB, stepOrder: 2 },
        },
        journal: [
          {
            eventId: pendingEvent,
            kind: 'step',
            routineId,
            routineType: 'AM',
            stepId: stepA,
            userProductId: productA,
            stepOrder: 1,
            completedAt: '2026-07-09T12:00:00.000Z',
            completedDate: '2026-07-09',
            timezone: 'Canada/Eastern',
          },
          {
            eventId: terminalEvent,
            kind: 'step',
            routineId,
            routineType: 'AM',
            stepId: stepB,
            userProductId: productB,
            stepOrder: 2,
            completedAt: '2026-07-10T12:00:00.000Z',
            completedDate: '2026-07-10',
            timezone: 'America/Toronto',
          },
        ],
        outbox: [pendingEvent],
        terminal: [{ eventId: terminalEvent, code: 'COMPLETION_EVENT_CONFLICT' }],
        unsynced: [
          {
            eventId: '55555555-5555-4555-8555-555555555555',
            stepKey: 'AM:legacy-shelf-product',
            routineType: 'AM',
            stepOrder: 3,
            completedAt: '2026-07-08T12:00:00.000Z',
            completedDate: '2026-07-08',
            completionDayInserted: false,
            reason: 'COMPLETION_PRODUCT_IDENTITY_REPAIR_REQUIRED',
          },
        ],
      },
    };
    const shelfState = {
      version: 3,
      products: [],
      mirrorOutbox: [pendingMirror],
      terminal: [
        {
          operation: terminalMirror,
          code: 'SHELF_PRODUCT_OWNERSHIP_CONFLICT',
        },
      ],
      mirrorIncompatibilities: [],
    };
    mocks.getPrivateItemsForPurposeLimitedExport.mockImplementation(
      async (keys: readonly string[]) =>
        new Map(
          keys.map((key) => [
            key,
            key === 'layerwell.completions.v1'
              ? JSON.stringify(completionState)
              : key === 'layerwell.shelf.v1'
                ? JSON.stringify(shelfState)
                : null,
          ]),
        ),
    );

    const result = await collectLocalDeviceExportData(
      accountLease,
      expectedUserId,
      '2026-07-10T12:00:00.000Z',
    );
    expect(result.schema_version).toBe(2);
    expect(result.sections.shelf_and_routine.completion_and_sync_state).toEqual(completionState);
    expect(result.sections.shelf_and_routine.shelf_and_sync_state).toEqual(shelfState);
    expect(result.sections.shelf_and_routine).not.toHaveProperty('completion_history');
    expect(result.sections.shelf_and_routine).not.toHaveProperty('shelf_products');
  });

  it('preserves an unsupported future conflict-choice schema with an explicit export status', async () => {
    const future = { schemaVersion: 2, choices: { future: true } };
    mocks.getPrivateItemsForPurposeLimitedExport.mockImplementation(
      async (keys: readonly string[]) =>
        new Map(
          keys.map((key) => [
            key,
            key === 'layerwell.conflict.overrides' ? JSON.stringify(future) : null,
          ]),
        ),
    );

    const result = await collectLocalDeviceExportData(
      accountLease,
      expectedUserId,
      '2026-07-10T12:00:00.000Z',
    );
    expect(result.sections.shelf_and_routine.conflict_overrides).toEqual({
      export_status: 'unrecognized_conflict_choice_schema',
      stored_value: future,
    });
  });

  it('fails rather than silently omitting an unreadable private record', async () => {
    mocks.getPrivateItemsForPurposeLimitedExport.mockRejectedValueOnce(
      new Error('secure storage unavailable'),
    );

    await expect(collectLocalDeviceExportData(accountLease, expectedUserId)).rejects.toThrow(
      'secure storage unavailable',
    );
  });

  it('wraps server and local scopes in a versioned, explicit bundle', async () => {
    const localDeviceData = await collectLocalDeviceExportData(
      accountLease,
      expectedUserId,
      '2026-07-10T12:00:00.000Z',
    );

    expect(
      buildMobileDataExportBundle({
        exportedAt: '2026-07-10T12:01:00.000Z',
        serverAccountDataStatus: 'included',
        serverAccountData: { user_id: 'user-1', export_schema_version: 4 },
        localDeviceData,
      }),
    ).toEqual(
      expect.objectContaining({
        mobile_export_schema_version: 2,
        exported_at: '2026-07-10T12:01:00.000Z',
        server_account_data_status: 'included',
        server_account_data: { user_id: 'user-1', export_schema_version: 4 },
        local_device_data: localDeviceData,
      }),
    );
  });
});
