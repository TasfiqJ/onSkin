import { describe, expect, it } from 'vitest';

import {
  decodeServerDataExport,
  SERVER_DATA_EXPORT_ARRAY_SOURCES,
  SERVER_DATA_EXPORT_COVERAGE,
} from './serverDataExportContract';

const OWNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER_OWNER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const CHECKSUM = `sha256:${'0'.repeat(64)}`;
const ACTIVE_CONSENT_HASH = '7957a2811fff0e8cefc6f7180b751ec45688fe99421978eedae05b96c2f251fd';
const CONSISTENCY = {
  model: 'independent_count_guarded_reads',
  guarantees: [
    'Every database source is read in deterministic unique-key order using bounded pages.',
    'A database source is returned only when its exact count before pagination, exported row count, and exact count after pagination are equal.',
    'Storage pagination advances by the rows actually returned and probes every short-page boundary, so a service-side page cap cannot silently skip objects.',
    'The owner-prefixed photo-storage inventory is returned only when two complete, deterministically ordered listings have identical counts and checksums.',
    'Every returned source has a count and a SHA-256 checksum over canonical JSON.',
  ],
  limitations: [
    'Supabase PostgREST and Storage reads in this Edge Function do not share a database transaction or cross-source snapshot.',
    'Rows updated while a source is paginated can contain values from different instants even when the source count is stable.',
    'A concurrent delete and insert that preserve a source count can evade the count guard; duplicate ordering keys and unstable storage inventories still fail closed.',
    'Rows committed after a source finishes, or storage objects committed after the verified inventory, are not part of this export.',
  ],
};
const PAGINATION = {
  database_page_size: 500,
  storage_page_size: 500,
  max_concurrency: 4,
  max_rows_per_database_source: 50_000,
  max_storage_objects: 25_000,
};

const DERIVED_CHECKSUM_FIELDS: Readonly<Record<string, readonly string[]>> = {
  photo_download_urls: ['id', 'path'],
  photo_download_url_omissions: ['id', 'path', 'reason'],
};

function databaseManifest(source: string, count = 0): Record<string, unknown> {
  return {
    kind: 'database_table',
    scope: (SERVER_DATA_EXPORT_COVERAGE.caller_rls_tables as readonly string[]).includes(source)
      ? 'caller_rls'
      : (SERVER_DATA_EXPORT_COVERAGE.caller_rpc_owner_exports as readonly string[]).includes(source)
        ? 'caller_rpc_owner'
        : 'service_role_filtered',
    order_by: ['id'],
    count,
    count_before: count,
    count_after: count,
    page_requests: 1,
    checksum: CHECKSUM,
    checksum_algorithm: 'sha256-canonical-json-v1',
    complete: true,
  };
}

function completeBundle(): Record<string, unknown> {
  const arrays = Object.fromEntries(SERVER_DATA_EXPORT_ARRAY_SOURCES.map((source) => [source, []]));
  const manifests = Object.fromEntries(
    SERVER_DATA_EXPORT_ARRAY_SOURCES.map((source) => [
      source,
      source === 'photo_storage_objects'
        ? {
            kind: 'storage_inventory',
            scope: 'service_role_owner_prefix',
            order_by: ['path'],
            count: 0,
            verification_passes: 2,
            page_requests: 2,
            checksum: CHECKSUM,
            checksum_algorithm: 'sha256-canonical-json-v1',
            complete: true,
          }
        : (SERVER_DATA_EXPORT_COVERAGE.derived_sources as readonly string[]).includes(source)
          ? {
              kind: 'derived',
              count: 0,
              checksum: CHECKSUM,
              checksum_algorithm: 'sha256-canonical-json-v1',
              checksum_fields: DERIVED_CHECKSUM_FIELDS[source],
              complete: true,
              ...(source === 'photo_download_urls'
                ? {
                    note: 'Signed URL tokens are volatile and excluded from the checksum; identity fields are checksummed.',
                  }
                : {}),
            }
          : databaseManifest(source),
    ]),
  );
  return {
    export_schema_version: 4,
    exported_at: '2026-07-26T16:00:00.000Z',
    user_id: OWNER,
    manifest: {
      manifest_schema_version: 1,
      complete: true,
      consistency: CONSISTENCY,
      pagination: PAGINATION,
      sources: {
        ...manifests,
        health_consent_lifecycle: {
          kind: 'derived',
          count: 1,
          checksum: CHECKSUM,
          checksum_algorithm: 'sha256-canonical-json-v1',
          checksum_fields: [
            'state',
            'processing_epoch',
            'operation_state',
            'result_code',
            'consent_version',
            'consent_text_hash',
            'server_verified_at',
          ],
          complete: true,
          note: 'Sanitized lifecycle',
        },
      },
    },
    local_only_photo_note: 'Local note',
    server_photo_object_note: 'Server note',
    health_consent_lifecycle: {
      state: 'active',
      processing_epoch: 1,
      operation_state: null,
      result_code: null,
      consent_version: 'draft-v1-2026-07-10',
      consent_text_hash: ACTIVE_CONSENT_HASH,
      server_verified_at: '2026-07-26T16:00:00.000Z',
    },
    export_coverage: SERVER_DATA_EXPORT_COVERAGE,
    exclusion_register: [],
    ...arrays,
  };
}

function manifestSources(bundle: Record<string, unknown>): Record<string, Record<string, unknown>> {
  return (bundle.manifest as { sources: Record<string, Record<string, unknown>> }).sources;
}

function replaceRows(
  bundle: Record<string, unknown>,
  source: string,
  rows: readonly Record<string, unknown>[],
): void {
  bundle[source] = rows;
  const manifest = manifestSources(bundle)[source]!;
  manifest.count = rows.length;
  if (manifest.kind === 'database_table') {
    manifest.count_before = rows.length;
    manifest.count_after = rows.length;
  }
}

describe('schema-v4 server data export decoder', () => {
  it('accepts only the exact full source and manifest coverage', () => {
    const bundle = completeBundle();
    expect(decodeServerDataExport(bundle, OWNER)).toBe(bundle);

    const missing = completeBundle();
    delete missing.notification_log;
    expect(() => decodeServerDataExport(missing, OWNER)).toThrow('DATA_EXPORT_RESPONSE_INVALID');

    const unknown = { ...completeBundle(), invented_source: [] };
    expect(() => decodeServerDataExport(unknown, OWNER)).toThrow('DATA_EXPORT_RESPONSE_INVALID');

    const missingManifest = completeBundle();
    delete manifestSources(missingManifest).profiles;
    expect(() => decodeServerDataExport(missingManifest, OWNER)).toThrow(
      'DATA_EXPORT_RESPONSE_INVALID',
    );
  });

  it('rejects malformed and cross-owner health-sync rows', () => {
    const malformed = completeBundle();
    malformed.shelf_sync_receipts = ['not-a-row'];
    manifestSources(malformed).shelf_sync_receipts = databaseManifest('shelf_sync_receipts', 1);
    expect(() => decodeServerDataExport(malformed, OWNER)).toThrow('DATA_EXPORT_RESPONSE_INVALID');

    const crossing = completeBundle();
    crossing.shelf_sync_receipts = [
      {
        operation_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        user_id: OTHER_OWNER,
        state: 'accepted',
        result_code: null,
        created_at: '2026-07-26T16:00:00.000Z',
        finalized_at: '2026-07-26T16:00:00.000Z',
      },
    ];
    manifestSources(crossing).shelf_sync_receipts = databaseManifest('shelf_sync_receipts', 1);
    expect(() => decodeServerDataExport(crossing, OWNER)).toThrow('DATA_EXPORT_RESPONSE_INVALID');
  });

  it('accepts only type-safe, state-coherent health-sync receipt values', () => {
    const valid = completeBundle();
    replaceRows(valid, 'shelf_product_identities', [
      {
        id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        user_id: OWNER,
        created_at: '2026-07-26T16:00:00.000Z',
        deleted_effective_at: null,
        deleted_received_at: null,
      },
    ]);
    replaceRows(valid, 'shelf_sync_receipts', [
      {
        operation_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        user_id: OWNER,
        state: 'accepted',
        result_code: null,
        created_at: '2026-07-26T16:00:00.000Z',
        finalized_at: '2026-07-26T16:00:01.000Z',
      },
    ]);
    replaceRows(valid, 'routine_completion_sync_receipts', [
      {
        event_id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        user_id: OWNER,
        state: 'terminal',
        result_code: 'COMPLETION_REQUEST_INVALID',
        created_at: '2026-07-26T16:00:00.000Z',
        finalized_at: '2026-07-26T16:00:01.000Z',
      },
    ]);
    expect(decodeServerDataExport(valid, OWNER)).toBe(valid);

    const invalidRows: [string, Record<string, unknown>][] = [
      [
        'shelf_product_identities',
        {
          id: 'not-a-uuid',
          user_id: OWNER,
          created_at: '2026-07-26T16:00:00.000Z',
          deleted_effective_at: null,
          deleted_received_at: null,
        },
      ],
      [
        'shelf_product_identities',
        {
          id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
          user_id: OWNER,
          created_at: '2026-07-26T16:00:00.000Z',
          deleted_effective_at: '2026-07-26T16:00:01.000Z',
          deleted_received_at: null,
        },
      ],
      [
        'shelf_sync_receipts',
        {
          operation_id: 'x',
          user_id: OWNER,
          state: 'accepted',
          result_code: null,
          created_at: '2026-07-26T16:00:00.000Z',
          finalized_at: '2026-07-26T16:00:01.000Z',
        },
      ],
      [
        'shelf_sync_receipts',
        {
          operation_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
          user_id: OWNER,
          state: { accepted: true },
          result_code: null,
          created_at: '2026-07-26T16:00:00.000Z',
          finalized_at: '2026-07-26T16:00:01.000Z',
        },
      ],
      [
        'shelf_sync_receipts',
        {
          operation_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
          user_id: OWNER,
          state: 'pending',
          result_code: null,
          created_at: '2026-07-26T16:00:00.000Z',
          finalized_at: [],
        },
      ],
      [
        'routine_completion_sync_receipts',
        {
          event_id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
          user_id: OWNER,
          state: 'terminal',
          result_code: 'SHELF_PRODUCT_ID_INVALID',
          created_at: '2026-07-26T16:00:00.000Z',
          finalized_at: '2026-07-26T16:00:01.000Z',
        },
      ],
    ];
    for (const [source, row] of invalidRows) {
      const bundle = completeBundle();
      replaceRows(bundle, source, [row]);
      expect(
        () => decodeServerDataExport(bundle, OWNER),
        `${source}:${JSON.stringify(row)}`,
      ).toThrow('DATA_EXPORT_RESPONSE_INVALID');
    }
  });

  it('rejects lifecycle snapshots that violate sanitized conditional fields or consent hash', () => {
    const invalidSnapshots: Record<string, unknown>[] = [
      {
        ...(completeBundle().health_consent_lifecycle as Record<string, unknown>),
        processing_epoch: 0,
      },
      {
        ...(completeBundle().health_consent_lifecycle as Record<string, unknown>),
        operation_state: { state: 'running' },
      },
      {
        ...(completeBundle().health_consent_lifecycle as Record<string, unknown>),
        consent_text_hash: '0'.repeat(64),
      },
      {
        ...(completeBundle().health_consent_lifecycle as Record<string, unknown>),
        state: 'withdrawn',
        operation_state: 'completed',
        result_code: 'HEALTH_WITHDRAWAL_COMPLETED',
      },
      {
        ...(completeBundle().health_consent_lifecycle as Record<string, unknown>),
        server_verified_at: ['2026-07-26T16:00:00.000Z'],
      },
    ];
    for (const snapshot of invalidSnapshots) {
      const bundle = completeBundle();
      bundle.health_consent_lifecycle = snapshot;
      expect(() => decodeServerDataExport(bundle, OWNER)).toThrow('DATA_EXPORT_RESPONSE_INVALID');
    }
  });

  it('rejects count disagreement and wrong manifest scope', () => {
    const countMismatch = completeBundle();
    manifestSources(countMismatch).profiles = databaseManifest('profiles', 1);
    expect(() => decodeServerDataExport(countMismatch, OWNER)).toThrow(
      'DATA_EXPORT_RESPONSE_INVALID',
    );

    const scopeMismatch = completeBundle();
    manifestSources(scopeMismatch).profiles = {
      ...databaseManifest('profiles'),
      scope: 'service_role_filtered',
    };
    expect(() => decodeServerDataExport(scopeMismatch, OWNER)).toThrow(
      'DATA_EXPORT_RESPONSE_INVALID',
    );
  });

  it('rejects broken owner joins and foreign photo paths', () => {
    const brokenRoutine = completeBundle();
    brokenRoutine.routine_steps = [
      { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', routine_id: 'missing' },
    ];
    manifestSources(brokenRoutine).routine_steps = databaseManifest('routine_steps', 1);
    expect(() => decodeServerDataExport(brokenRoutine, OWNER)).toThrow(
      'DATA_EXPORT_RESPONSE_INVALID',
    );

    const foreignPath = completeBundle();
    foreignPath.photo_storage_objects = [{ path: `${OTHER_OWNER}/e1/photo.jpg` }];
    manifestSources(foreignPath).photo_storage_objects = {
      ...manifestSources(foreignPath).photo_storage_objects,
      count: 1,
    };
    expect(() => decodeServerDataExport(foreignPath, OWNER)).toThrow(
      'DATA_EXPORT_RESPONSE_INVALID',
    );

    const foreignUrl = completeBundle();
    replaceRows(foreignUrl, 'photo_download_urls', [
      {
        id: null,
        path: `${OTHER_OWNER}/e1/photo.jpg`,
        url: 'https://example.invalid/photo',
        expires_in_seconds: 60,
      },
    ]);
    expect(() => decodeServerDataExport(foreignUrl, OWNER)).toThrow('DATA_EXPORT_RESPONSE_INVALID');

    const foreignOmission = completeBundle();
    replaceRows(foreignOmission, 'photo_download_url_omissions', [
      {
        id: null,
        path: `${OTHER_OWNER}/e1/photo.jpg`,
        reason: 'STORAGE_OBJECT_NOT_LISTED',
      },
    ]);
    expect(() => decodeServerDataExport(foreignOmission, OWNER)).toThrow(
      'DATA_EXPORT_RESPONSE_INVALID',
    );

    const leakedInvalidPath = completeBundle();
    replaceRows(leakedInvalidPath, 'photo_download_url_omissions', [
      {
        id: null,
        path: `${OTHER_OWNER}/e1/photo.jpg`,
        reason: 'INVALID_STORAGE_PATH',
      },
    ]);
    expect(() => decodeServerDataExport(leakedInvalidPath, OWNER)).toThrow(
      'DATA_EXPORT_RESPONSE_INVALID',
    );
  });

  it('rejects inexact consistency, pagination, and derived checksum manifests', () => {
    const extraConsistencyKey = completeBundle();
    (
      extraConsistencyKey.manifest as {
        consistency: Record<string, unknown>;
      }
    ).consistency.snapshot = 'invented';
    expect(() => decodeServerDataExport(extraConsistencyKey, OWNER)).toThrow(
      'DATA_EXPORT_RESPONSE_INVALID',
    );

    for (const invalidPageSize of [0, 99, 1001, '500']) {
      const bundle = completeBundle();
      (
        bundle.manifest as {
          pagination: Record<string, unknown>;
        }
      ).pagination.database_page_size = invalidPageSize;
      expect(() => decodeServerDataExport(bundle, OWNER)).toThrow('DATA_EXPORT_RESPONSE_INVALID');
    }

    const missingPaginationKey = completeBundle();
    delete (
      missingPaginationKey.manifest as {
        pagination: Record<string, unknown>;
      }
    ).pagination.max_concurrency;
    expect(() => decodeServerDataExport(missingPaginationKey, OWNER)).toThrow(
      'DATA_EXPORT_RESPONSE_INVALID',
    );

    for (const [source, fields] of [
      ['photo_download_urls', ['path', 'id']],
      ['photo_download_url_omissions', ['id', 'path']],
      ['health_consent_lifecycle', ['state']],
    ] as const) {
      const bundle = completeBundle();
      manifestSources(bundle)[source]!.checksum_fields = fields;
      expect(() => decodeServerDataExport(bundle, OWNER), source).toThrow(
        'DATA_EXPORT_RESPONSE_INVALID',
      );
    }
  });
});
