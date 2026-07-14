import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LOCAL_PRIVATE_DATA_KEYS } from './localPrivateDataKeys';
import {
  buildMobileDataExportBundle,
  collectLocalDeviceExportData,
  LOCAL_DEVICE_EXPORT_STORAGE_KEYS,
} from './localDeviceExport';

const mocks = vi.hoisted(() => ({
  decryptPhotoNote: vi.fn(),
  getPrivateItems: vi.fn(),
}));

vi.mock('@/features/photos/encryptedStorage', () => ({
  decryptPhotoNote: mocks.decryptPhotoNote,
  isPhotoEncryptionReadError: (error: unknown) =>
    error instanceof Error &&
    [
      'PHOTO_CONTENT_KEY_MISSING',
      'PHOTO_CONTENT_KEY_INVALID',
      'PHOTO_CONTENT_KEY_STORAGE_UNAVAILABLE',
      'PHOTO_DECRYPTION_FAILED',
    ].includes(error.message),
}));

vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItems: mocks.getPrivateItems,
}));

describe('local device data export', () => {
  beforeEach(() => {
    mocks.decryptPhotoNote.mockReset();
    mocks.getPrivateItems.mockReset();
    mocks.decryptPhotoNote.mockResolvedValue(null);
    mocks.getPrivateItems.mockResolvedValue(new Map());
  });

  it('accounts for every encrypted local private-data key exactly once', () => {
    expect([...LOCAL_DEVICE_EXPORT_STORAGE_KEYS].sort()).toEqual(
      [...LOCAL_PRIVATE_DATA_KEYS].sort(),
    );
    expect(new Set(LOCAL_DEVICE_EXPORT_STORAGE_KEYS).size).toBe(
      LOCAL_DEVICE_EXPORT_STORAGE_KEYS.length,
    );
  });

  it('exports device-authoritative records while redacting media paths and ciphertext', async () => {
    const stored = new Map<string, string>([
      [
        'onskin.skinprofile.v1',
        JSON.stringify({ result: { dspt: 'OSPT' }, goals: ['acne'], completedAt: '2026-07-10' }),
      ],
      [
        'onskin.shelf.v1',
        JSON.stringify([
          {
            id: 'shelf-1',
            name: 'Retinol 0.3%',
            thumbnailPath: 'file:///private/shelf-1.jpg',
            nested: {
              LocalUri: 'file:///private/other.jpg',
              preview: 'cached at ph://library/private-photo',
              safe: true,
            },
          },
        ]),
      ],
      ['onskin.completions.v1', JSON.stringify({ '2026-07-09': ['PM:shelf-1'] })],
      ['onskin.conflict.overrides', JSON.stringify(['rule-1:acid+retinoid'])],
      [
        'onskin.cycle.v1',
        JSON.stringify({ schemaVersion: 1, variant: 'gentle', customCycle: null }),
      ],
      [
        'routinekind.cycle.v2',
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
        'routinekind.routineOrder.v1',
        JSON.stringify({ schemaVersion: 1, am: ['shelf-1'], pm: ['shelf-1'] }),
      ],
      [
        'onskin.photos.v1',
        JSON.stringify([
          {
            id: 'photo-1',
            series: 'front',
            takenLocalDate: '2026-07-09',
            notes: null,
            notesCiphertext: 'encrypted-note',
            localUri: 'file:///private/photo-1.onskinphoto',
            encryptedLocalUri: 'file:///private/photo-1.onskinphoto',
            thumbnailLocalUri: 'file:///private/photo-1-thumb.jpg',
            storagePath: 'user-1/photo-1.jpg',
            keyId: 'photo-content-key-v1',
          },
          'invalid-row',
        ]),
      ],
    ]);
    mocks.getPrivateItems.mockImplementation(
      async (keys: readonly string[]) => new Map(keys.map((key) => [key, stored.get(key) ?? null])),
    );
    mocks.decryptPhotoNote.mockResolvedValue('Less redness today');

    const result = await collectLocalDeviceExportData('2026-07-10T12:00:00.000Z');

    expect(result.sections.profile_and_preferences.skin_profile).toEqual(
      expect.objectContaining({ goals: ['acne'] }),
    );
    expect(result.sections.shelf_and_routine.completion_history).toEqual({
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
    expect(result.sections.shelf_and_routine.conflict_overrides).toEqual({
      schemaVersion: 1,
      choices: {
        'rule-1:acid+retinoid': {
          choice: 'use_together',
          ruleId: 'rule-1',
          ruleVersion: 1,
          productIds: ['acid', 'retinoid'],
        },
      },
    });
    expect(result.sections.shelf_and_routine.shelf_products).toEqual([
      {
        id: 'shelf-1',
        name: 'Retinol 0.3%',
        nested: { preview: '[redacted_local_path]', safe: true },
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
    expect(serialized).not.toContain('ph://');
    expect(serialized).not.toContain('notesCiphertext');
    expect(serialized).not.toContain('storagePath');
    expect(serialized).not.toContain('thumbnailPath');
    expect(serialized).not.toContain('photo-content-key-v1');
  });

  it('marks an undecryptable photo note without exporting its ciphertext', async () => {
    mocks.getPrivateItems.mockImplementation(
      async (keys: readonly string[]) =>
        new Map(
          keys.map((key) => [
            key,
            key === 'onskin.photos.v1'
              ? JSON.stringify([{ id: 'photo-1', notesCiphertext: 'invalid-envelope' }])
              : null,
          ]),
        ),
    );

    mocks.decryptPhotoNote.mockRejectedValueOnce(new Error('PHOTO_CONTENT_KEY_MISSING'));

    const result = await collectLocalDeviceExportData('2026-07-10T12:00:00.000Z');

    expect(result.sections.progress.photo_records?.records[0]).toEqual({
      id: 'photo-1',
      notes: null,
      notesExportStatus: 'unavailable',
    });
    expect(JSON.stringify(result)).not.toContain('invalid-envelope');
  });

  it('propagates non-encryption photo-note failures instead of hiding a boundary error', async () => {
    mocks.getPrivateItems.mockImplementation(
      async (keys: readonly string[]) =>
        new Map(
          keys.map((key) => [
            key,
            key === 'onskin.photos.v1'
              ? JSON.stringify([{ id: 'photo-1', notesCiphertext: 'encrypted-note' }])
              : null,
          ]),
        ),
    );
    mocks.decryptPhotoNote.mockRejectedValueOnce(new Error('ACCOUNT_GENERATION_CHANGED'));

    await expect(collectLocalDeviceExportData()).rejects.toThrow('ACCOUNT_GENERATION_CHANGED');
  });

  it('exports settled V2 photo items and refuses pending journal state', async () => {
    const settled = JSON.stringify({
      version: 2,
      items: [{ id: 'photo-v2', takenLocalDate: '2026-07-09', notes: null }],
      mutation: null,
      retainedItems: [],
    });
    mocks.getPrivateItems.mockImplementation(
      async (keys: readonly string[]) =>
        new Map(keys.map((key) => [key, key === 'onskin.photos.v1' ? settled : null])),
    );

    await expect(collectLocalDeviceExportData()).resolves.toMatchObject({
      sections: {
        progress: {
          photo_records: { records: [{ id: 'photo-v2' }] },
        },
      },
    });

    const pending = JSON.stringify({
      version: 2,
      items: [{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }],
      mutation: {
        kind: 'add',
        operationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        phase: 'prepared',
      },
      retainedItems: [],
    });
    mocks.getPrivateItems.mockImplementation(
      async (keys: readonly string[]) =>
        new Map(keys.map((key) => [key, key === 'onskin.photos.v1' ? pending : null])),
    );

    await expect(collectLocalDeviceExportData()).rejects.toThrow(
      'PHOTO_MUTATION_RECOVERY_REQUIRED',
    );
  });

  it('preserves an unsupported future conflict-choice schema with an explicit export status', async () => {
    const future = { schemaVersion: 2, choices: { future: true } };
    mocks.getPrivateItems.mockImplementation(
      async (keys: readonly string[]) =>
        new Map(
          keys.map((key) => [
            key,
            key === 'onskin.conflict.overrides' ? JSON.stringify(future) : null,
          ]),
        ),
    );

    const result = await collectLocalDeviceExportData('2026-07-10T12:00:00.000Z');
    expect(result.sections.shelf_and_routine.conflict_overrides).toEqual({
      export_status: 'unrecognized_conflict_choice_schema',
      stored_value: future,
    });
  });

  it('fails rather than silently omitting an unreadable private record', async () => {
    mocks.getPrivateItems.mockRejectedValueOnce(new Error('secure storage unavailable'));

    await expect(collectLocalDeviceExportData()).rejects.toThrow('secure storage unavailable');
  });

  it('rejects malformed structured records without echoing raw local paths', async () => {
    const malformed = '{"items":[{"localUri":"file:///private/shelf-photo.jpg"}]';
    mocks.getPrivateItems.mockImplementation(
      async (keys: readonly string[]) =>
        new Map(keys.map((key) => [key, key === 'onskin.shelf.v1' ? malformed : null])),
    );

    let failure: unknown;
    try {
      await collectLocalDeviceExportData();
    } catch (error) {
      failure = error;
    }

    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toBe('LOCAL_DEVICE_EXPORT_RECORD_INVALID:onskin.shelf.v1');
    expect((failure as Error).message).not.toContain('file:///');
    expect((failure as Error).message).not.toContain('shelf-photo.jpg');
  });

  it('wraps server and local scopes in a versioned, explicit bundle', async () => {
    const localDeviceData = await collectLocalDeviceExportData('2026-07-10T12:00:00.000Z');

    expect(
      buildMobileDataExportBundle({
        exportedAt: '2026-07-10T12:01:00.000Z',
        serverAccountDataStatus: 'included',
        serverAccountData: { user_id: 'user-1', export_schema_version: 2 },
        localDeviceData,
      }),
    ).toEqual(
      expect.objectContaining({
        mobile_export_schema_version: 1,
        exported_at: '2026-07-10T12:01:00.000Z',
        server_account_data_status: 'included',
        server_account_data: { user_id: 'user-1', export_schema_version: 2 },
        local_device_data: localDeviceData,
      }),
    );
  });
});
