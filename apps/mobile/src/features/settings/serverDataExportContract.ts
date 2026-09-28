export const SERVER_DATA_EXPORT_SCHEMA_VERSION = 4 as const;

const CALLER_RLS_SOURCES = [
  'profiles',
  'skin_profiles',
  'user_products',
  'routines',
  'routine_steps',
  'routine_completions',
  'routine_conflicts',
  'active_ramp',
  'cycles',
  'cycle_nights',
  'streak_freezes',
  'notification_preferences',
  'notification_log',
  'consents',
  'photos',
  'entitlements',
  'recommendation_preferences',
  'recommendations',
  'catalog_lookup_events',
  'commerce_click_events',
  'community_blocks',
  'community_questions',
  'community_reactions',
  'community_reports',
  'photo_trend',
  'ask_sessions',
  'ask_turn_audit',
  'ask_safety_audit',
] as const;

const CALLER_RPC_SOURCES = [
  'catalog_corrections',
  'shelf_product_identities',
  'shelf_sync_receipts',
  'routine_completion_sync_receipts',
] as const;

const SERVICE_ROLE_SOURCES = [
  'subscriptions_events',
  'reverse_trial_grants',
  'order_attributions',
] as const;

const ARRAY_DERIVED_SOURCES = [
  'photo_storage_objects',
  'photo_download_urls',
  'photo_download_url_omissions',
] as const;

const ALL_ARRAY_SOURCES = [
  ...CALLER_RLS_SOURCES,
  ...CALLER_RPC_SOURCES,
  ...SERVICE_ROLE_SOURCES,
  ...ARRAY_DERIVED_SOURCES,
] as const;

const ALL_MANIFEST_SOURCES = [...ALL_ARRAY_SOURCES, 'health_consent_lifecycle'] as const;

export const SERVER_DATA_EXPORT_ARRAY_SOURCES = ALL_ARRAY_SOURCES;
export const SERVER_DATA_EXPORT_MANIFEST_SOURCES = ALL_MANIFEST_SOURCES;
export const SERVER_DATA_EXPORT_COVERAGE = Object.freeze({
  caller_rls_tables: CALLER_RLS_SOURCES,
  caller_rpc_owner_exports: CALLER_RPC_SOURCES,
  service_role_filtered_exports: SERVICE_ROLE_SOURCES,
  storage_sources: ['photo_storage_objects'] as const,
  derived_sources: [
    'photo_download_urls',
    'photo_download_url_omissions',
    'health_consent_lifecycle',
  ] as const,
});

const HEALTH_SYNC_ROW_KEYS = Object.freeze({
  shelf_product_identities: [
    'id',
    'user_id',
    'created_at',
    'deleted_effective_at',
    'deleted_received_at',
  ],
  shelf_sync_receipts: [
    'operation_id',
    'user_id',
    'state',
    'result_code',
    'created_at',
    'finalized_at',
  ],
  routine_completion_sync_receipts: [
    'event_id',
    'user_id',
    'state',
    'result_code',
    'created_at',
    'finalized_at',
  ],
} satisfies Record<string, readonly string[]>);

const CATALOG_CORRECTION_ROW_KEYS = [
  'id',
  'user_id',
  'product_id',
  'barcode',
  'correction_type',
  'status',
  'description',
  'proposed_payload',
  'client_context',
  'source_id',
  'created_at',
  'updated_at',
] as const;

const SUBSCRIPTION_EVENT_ROW_KEYS = [
  'id',
  'rc_event_id',
  'event_type',
  'received_at',
  'environment',
  'store',
  'product_id',
  'provider_event_at',
] as const;

const ORDER_ATTRIBUTION_ROW_KEYS = [
  'id',
  'click_token',
  'external_order_id',
  'order_amount_cents',
  'currency',
  'status',
  'transaction_date',
  'record_updated_at',
  'created_at',
] as const;

const HEALTH_LIFECYCLE_KEYS = [
  'state',
  'processing_epoch',
  'operation_state',
  'result_code',
  'consent_version',
  'consent_text_hash',
  'server_verified_at',
] as const;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const UTC_TIMESTAMP_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(?:Z|\+00:00)$/u;
const HASH_PATTERN = /^[a-f0-9]{64}$/u;
const RESULT_CODE_PATTERN = /^[A-Z0-9_]{1,64}$/u;
const SAFE_STORAGE_PATH_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;

const SHELF_SYNC_TERMINAL_CODES = new Set([
  'SHELF_PRODUCT_ID_INVALID',
  'SHELF_PRODUCT_PAYLOAD_INVALID',
  'SHELF_PRODUCT_PROVENANCE_INVALID',
  'SHELF_PRODUCT_OWNERSHIP_CONFLICT',
]);
const COMPLETION_SYNC_TERMINAL_CODES = new Set([
  'COMPLETION_REQUEST_INVALID',
  'COMPLETION_EVENT_CONFLICT',
  'COMPLETION_IDENTITY_CONFLICT',
  'COMPLETION_AFTER_PRODUCT_DELETION',
]);
const HEALTH_OPERATION_STATES = new Set([
  'pending',
  'running',
  'storage_pending',
  'action_required',
  'completed',
]);
const ACTIVE_HEALTH_CONSENT_RECEIPTS = new Map([
  ['draft-v1-2026-07-10', '7957a2811fff0e8cefc6f7180b751ec45688fe99421978eedae05b96c2f251fd'],
]);

const EXPORT_CONSISTENCY = Object.freeze({
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
});

const DERIVED_CHECKSUM_FIELDS = Object.freeze({
  photo_download_urls: ['id', 'path'],
  photo_download_url_omissions: ['id', 'path', 'reason'],
  health_consent_lifecycle: HEALTH_LIFECYCLE_KEYS,
} satisfies Record<string, readonly string[]>);

const OWNER_FIELD_BY_SOURCE: Readonly<Record<string, string>> = Object.freeze({
  profiles: 'id',
  skin_profiles: 'user_id',
  user_products: 'user_id',
  routines: 'user_id',
  routine_completions: 'user_id',
  routine_conflicts: 'user_id',
  active_ramp: 'user_id',
  cycles: 'user_id',
  streak_freezes: 'user_id',
  notification_preferences: 'user_id',
  notification_log: 'user_id',
  consents: 'user_id',
  photos: 'user_id',
  entitlements: 'user_id',
  recommendation_preferences: 'user_id',
  recommendations: 'user_id',
  catalog_lookup_events: 'user_id',
  commerce_click_events: 'user_id',
  community_blocks: 'user_id',
  community_questions: 'user_id',
  community_reactions: 'user_id',
  community_reports: 'reporter_id',
  photo_trend: 'user_id',
  ask_sessions: 'user_id',
  ask_safety_audit: 'user_id',
  catalog_corrections: 'user_id',
  shelf_product_identities: 'user_id',
  shelf_sync_receipts: 'user_id',
  routine_completion_sync_receipts: 'user_id',
  reverse_trial_grants: 'user_id',
});

function invalid(): never {
  throw new Error('DATA_EXPORT_RESPONSE_INVALID');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

function isSafeCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isBoundedInteger(value: unknown, minimum: number, maximum: number): value is number {
  return (
    typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum && value <= maximum
  );
}

function isSha256(value: unknown): value is string {
  return typeof value === 'string' && /^sha256:[a-f0-9]{64}$/u.test(value);
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function isUtcTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = UTC_TIMESTAMP_PATTERN.exec(value);
  if (!match) return false;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return false;
  const date = new Date(parsed);
  return (
    date.getUTCFullYear() === Number(match[1]) &&
    date.getUTCMonth() + 1 === Number(match[2]) &&
    date.getUTCDate() === Number(match[3]) &&
    date.getUTCHours() === Number(match[4]) &&
    date.getUTCMinutes() === Number(match[5]) &&
    date.getUTCSeconds() === Number(match[6])
  );
}

function isOwnedPhotoPath(value: unknown, userId: string): value is string {
  if (typeof value !== 'string') return false;
  const segments = value.split('/');
  if (segments.length < 2 || segments[0] !== userId) return false;
  return segments.every(
    (segment) => SAFE_STORAGE_PATH_SEGMENT.test(segment) && segment !== '.' && segment !== '..',
  );
}

function exactStringArray(value: unknown, expected: readonly string[]): boolean {
  return (
    Array.isArray(value) &&
    value.length === expected.length &&
    value.every((entry, index) => entry === expected[index])
  );
}

function validateManifestSource(source: string, value: unknown, expectedCount: number): void {
  if (!isRecord(value) || value.complete !== true || value.count !== expectedCount) invalid();
  if (
    !isSafeCount(value.count) ||
    !isSha256(value.checksum) ||
    value.checksum_algorithm !== 'sha256-canonical-json-v1'
  ) {
    invalid();
  }

  if (source === 'photo_storage_objects') {
    if (
      !hasExactKeys(value, [
        'kind',
        'scope',
        'order_by',
        'count',
        'verification_passes',
        'page_requests',
        'checksum',
        'checksum_algorithm',
        'complete',
      ]) ||
      value.kind !== 'storage_inventory' ||
      value.scope !== 'service_role_owner_prefix' ||
      !exactStringArray(value.order_by, ['path']) ||
      value.verification_passes !== 2 ||
      !isSafeCount(value.page_requests)
    ) {
      invalid();
    }
    return;
  }

  if (
    source === 'photo_download_urls' ||
    source === 'photo_download_url_omissions' ||
    source === 'health_consent_lifecycle'
  ) {
    const expectedChecksumFields = DERIVED_CHECKSUM_FIELDS[source];
    const requiresNote = source === 'photo_download_urls' || source === 'health_consent_lifecycle';
    const expectedKeys = [
      'kind',
      'count',
      'checksum',
      'checksum_algorithm',
      'checksum_fields',
      'complete',
      ...(requiresNote ? ['note'] : []),
    ];
    if (
      !hasExactKeys(value, expectedKeys) ||
      value.kind !== 'derived' ||
      !exactStringArray(value.checksum_fields, expectedChecksumFields) ||
      (requiresNote && (typeof value.note !== 'string' || value.note.length === 0))
    ) {
      invalid();
    }
    return;
  }

  const expectedScope = (CALLER_RLS_SOURCES as readonly string[]).includes(source)
    ? 'caller_rls'
    : (CALLER_RPC_SOURCES as readonly string[]).includes(source)
      ? 'caller_rpc_owner'
      : 'service_role_filtered';
  if (
    !hasOnlyKeys(value, [
      'kind',
      'scope',
      'order_by',
      'count',
      'count_before',
      'count_after',
      'page_requests',
      'checksum',
      'checksum_algorithm',
      'complete',
      'note',
    ]) ||
    value.kind !== 'database_table' ||
    value.scope !== expectedScope ||
    !Array.isArray(value.order_by) ||
    value.order_by.length === 0 ||
    !value.order_by.every((field) => typeof field === 'string' && field.length > 0) ||
    value.count_before !== expectedCount ||
    value.count_after !== expectedCount ||
    !isSafeCount(value.page_requests) ||
    (Object.hasOwn(value, 'note') && typeof value.note !== 'string')
  ) {
    invalid();
  }
}

function validateExactRows(
  rows: readonly Record<string, unknown>[],
  keys: readonly string[],
): void {
  if (rows.some((row) => !hasExactKeys(row, keys))) invalid();
}

function requireOwnerRows(
  source: string,
  rows: readonly Record<string, unknown>[],
  userId: string,
): void {
  const ownerField = OWNER_FIELD_BY_SOURCE[source];
  if (ownerField && rows.some((row) => row[ownerField] !== userId)) invalid();
}

function stringIds(rows: readonly Record<string, unknown>[], field: string): Set<string> {
  const ids = new Set<string>();
  for (const row of rows) {
    if (typeof row[field] !== 'string' || row[field].length === 0) invalid();
    ids.add(row[field] as string);
  }
  return ids;
}

function requireForeignKeys(
  rows: readonly Record<string, unknown>[],
  field: string,
  owners: ReadonlySet<string>,
): void {
  if (rows.some((row) => typeof row[field] !== 'string' || !owners.has(row[field] as string))) {
    invalid();
  }
}

function validateHealthLifecycle(value: unknown): asserts value is Record<string, unknown> {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, HEALTH_LIFECYCLE_KEYS) ||
    (value.state !== 'unconsented' &&
      value.state !== 'active' &&
      value.state !== 'withdrawing' &&
      value.state !== 'withdrawn') ||
    !isSafeCount(value.processing_epoch) ||
    !isUtcTimestamp(value.server_verified_at) ||
    !(
      value.operation_state === null ||
      (typeof value.operation_state === 'string' &&
        HEALTH_OPERATION_STATES.has(value.operation_state))
    ) ||
    !(
      value.result_code === null ||
      (typeof value.result_code === 'string' && RESULT_CODE_PATTERN.test(value.result_code))
    ) ||
    !(
      value.consent_version === null ||
      (typeof value.consent_version === 'string' &&
        value.consent_version === value.consent_version.trim() &&
        value.consent_version.length >= 1 &&
        value.consent_version.length <= 120)
    ) ||
    !(value.consent_text_hash === null || typeof value.consent_text_hash === 'string') ||
    (typeof value.consent_text_hash === 'string' && !HASH_PATTERN.test(value.consent_text_hash)) ||
    (value.consent_version === null) !== (value.consent_text_hash === null)
  ) {
    invalid();
  }

  const state = value.state;
  const epoch = value.processing_epoch as number;
  const operationState = value.operation_state;
  const resultCode = value.result_code;
  const consentVersion = value.consent_version;
  const consentTextHash = value.consent_text_hash;
  if (
    (state === 'unconsented' && epoch !== 0) ||
    (state !== 'unconsented' && epoch < 1) ||
    ((state === 'active' || state === 'unconsented') && operationState !== null) ||
    (state === 'active' && resultCode !== null) ||
    (state === 'unconsented' && resultCode !== null && resultCode !== 'HEALTH_CONSENT_DECLINED') ||
    (state === 'withdrawing' && (operationState === null || operationState === 'completed')) ||
    (state === 'withdrawn' &&
      (operationState !== 'completed' || resultCode !== 'HEALTH_WITHDRAWAL_COMPLETED')) ||
    (state === 'active' &&
      (typeof consentVersion !== 'string' ||
        ACTIVE_HEALTH_CONSENT_RECEIPTS.get(consentVersion) !== consentTextHash)) ||
    (state !== 'active' && (consentVersion !== null || consentTextHash !== null))
  ) {
    invalid();
  }
}

function validateHealthSyncRows(
  source: keyof typeof HEALTH_SYNC_ROW_KEYS,
  rows: readonly Record<string, unknown>[],
  expectedUserId: string,
): void {
  validateExactRows(rows, HEALTH_SYNC_ROW_KEYS[source]);
  for (const row of rows) {
    const idField =
      source === 'shelf_product_identities'
        ? 'id'
        : source === 'shelf_sync_receipts'
          ? 'operation_id'
          : 'event_id';
    if (
      !isUuid(row[idField]) ||
      !isUuid(row.user_id) ||
      row.user_id !== expectedUserId ||
      !isUtcTimestamp(row.created_at)
    ) {
      invalid();
    }

    if (source === 'shelf_product_identities') {
      const effective = row.deleted_effective_at;
      const received = row.deleted_received_at;
      if (
        (effective === null) !== (received === null) ||
        !(effective === null || isUtcTimestamp(effective)) ||
        !(received === null || isUtcTimestamp(received))
      ) {
        invalid();
      }
      continue;
    }

    const state = row.state;
    const resultCode = row.result_code;
    const finalizedAt = row.finalized_at;
    const allowedTerminalCodes =
      source === 'shelf_sync_receipts' ? SHELF_SYNC_TERMINAL_CODES : COMPLETION_SYNC_TERMINAL_CODES;
    if (
      (state !== 'pending' && state !== 'accepted' && state !== 'terminal') ||
      (state === 'pending' && (resultCode !== null || finalizedAt !== null)) ||
      (state === 'accepted' && (resultCode !== null || !isUtcTimestamp(finalizedAt))) ||
      (state === 'terminal' &&
        (typeof resultCode !== 'string' ||
          !allowedTerminalCodes.has(resultCode) ||
          !isUtcTimestamp(finalizedAt)))
    ) {
      invalid();
    }
  }
}

function validatePhotoRows(
  rowsBySource: Readonly<Record<string, readonly Record<string, unknown>[]>>,
  userId: string,
): void {
  for (const row of rowsBySource.photo_storage_objects!) {
    if (!isOwnedPhotoPath(row.path, userId)) invalid();
  }
  for (const row of rowsBySource.photo_download_urls!) {
    if (
      !(row.id === null || isUuid(row.id)) ||
      !isOwnedPhotoPath(row.path, userId) ||
      typeof row.url !== 'string' ||
      row.url.length === 0 ||
      !isBoundedInteger(row.expires_in_seconds, 30, 60)
    ) {
      invalid();
    }
  }
  for (const row of rowsBySource.photo_download_url_omissions!) {
    if (
      !(row.id === null || isUuid(row.id)) ||
      (row.reason !== 'INVALID_STORAGE_PATH' && row.reason !== 'STORAGE_OBJECT_NOT_LISTED') ||
      (row.reason === 'INVALID_STORAGE_PATH' && row.path !== null) ||
      (row.reason === 'STORAGE_OBJECT_NOT_LISTED' && !isOwnedPhotoPath(row.path, userId))
    ) {
      invalid();
    }
  }
}

function validateManifestEnvelope(value: Record<string, unknown>): void {
  const consistency = value.consistency;
  const pagination = value.pagination;
  if (
    !isRecord(consistency) ||
    !hasExactKeys(consistency, ['model', 'guarantees', 'limitations']) ||
    consistency.model !== EXPORT_CONSISTENCY.model ||
    !exactStringArray(consistency.guarantees, EXPORT_CONSISTENCY.guarantees) ||
    !exactStringArray(consistency.limitations, EXPORT_CONSISTENCY.limitations) ||
    !isRecord(pagination) ||
    !hasExactKeys(pagination, [
      'database_page_size',
      'storage_page_size',
      'max_concurrency',
      'max_rows_per_database_source',
      'max_storage_objects',
    ]) ||
    !isBoundedInteger(pagination.database_page_size, 100, 1000) ||
    !isBoundedInteger(pagination.storage_page_size, 100, 1000) ||
    !isBoundedInteger(pagination.max_concurrency, 1, 8) ||
    !isBoundedInteger(pagination.max_rows_per_database_source, 1000, 250_000) ||
    !isBoundedInteger(pagination.max_storage_objects, 1000, 100_000)
  ) {
    invalid();
  }
}

function validateCoverage(value: unknown): void {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      'caller_rls_tables',
      'caller_rpc_owner_exports',
      'service_role_filtered_exports',
      'storage_sources',
      'derived_sources',
    ]) ||
    !exactStringArray(value.caller_rls_tables, SERVER_DATA_EXPORT_COVERAGE.caller_rls_tables) ||
    !exactStringArray(
      value.caller_rpc_owner_exports,
      SERVER_DATA_EXPORT_COVERAGE.caller_rpc_owner_exports,
    ) ||
    !exactStringArray(
      value.service_role_filtered_exports,
      SERVER_DATA_EXPORT_COVERAGE.service_role_filtered_exports,
    ) ||
    !exactStringArray(value.storage_sources, SERVER_DATA_EXPORT_COVERAGE.storage_sources) ||
    !exactStringArray(value.derived_sources, SERVER_DATA_EXPORT_COVERAGE.derived_sources)
  ) {
    invalid();
  }
}

export function decodeServerDataExport(
  data: unknown,
  expectedUserId: string,
): Record<string, unknown> {
  let parsed = data;
  if (typeof data === 'string') {
    try {
      parsed = JSON.parse(data) as unknown;
    } catch {
      invalid();
    }
  }
  if (!isRecord(parsed) || parsed.user_id !== expectedUserId) invalid();

  const expectedTopLevelKeys = [
    'export_schema_version',
    'exported_at',
    'user_id',
    'manifest',
    'local_only_photo_note',
    'server_photo_object_note',
    'health_consent_lifecycle',
    'export_coverage',
    'exclusion_register',
    ...ALL_ARRAY_SOURCES,
  ] as const;
  if (
    !hasExactKeys(parsed, expectedTopLevelKeys) ||
    parsed.export_schema_version !== SERVER_DATA_EXPORT_SCHEMA_VERSION ||
    !isUtcTimestamp(parsed.exported_at) ||
    typeof parsed.local_only_photo_note !== 'string' ||
    typeof parsed.server_photo_object_note !== 'string' ||
    !Array.isArray(parsed.exclusion_register) ||
    parsed.exclusion_register.some(
      (entry) =>
        !isRecord(entry) ||
        !hasExactKeys(entry, ['data_class', 'reason']) ||
        typeof entry.data_class !== 'string' ||
        typeof entry.reason !== 'string',
    )
  ) {
    invalid();
  }

  validateHealthLifecycle(parsed.health_consent_lifecycle);
  validateCoverage(parsed.export_coverage);

  const rowsBySource: Record<string, Record<string, unknown>[]> = {};
  for (const source of ALL_ARRAY_SOURCES) {
    const rows = parsed[source];
    if (!Array.isArray(rows) || rows.some((row) => !isRecord(row))) invalid();
    rowsBySource[source] = rows as Record<string, unknown>[];
    requireOwnerRows(source, rowsBySource[source], expectedUserId);
  }

  validateExactRows(rowsBySource.catalog_corrections!, CATALOG_CORRECTION_ROW_KEYS);
  for (const source of Object.keys(HEALTH_SYNC_ROW_KEYS) as (keyof typeof HEALTH_SYNC_ROW_KEYS)[]) {
    validateHealthSyncRows(source, rowsBySource[source]!, expectedUserId);
  }
  validateExactRows(rowsBySource.subscriptions_events!, SUBSCRIPTION_EVENT_ROW_KEYS);
  validateExactRows(rowsBySource.order_attributions!, ORDER_ATTRIBUTION_ROW_KEYS);
  validateExactRows(rowsBySource.photo_storage_objects!, ['path']);
  validateExactRows(rowsBySource.photo_download_urls!, ['id', 'path', 'url', 'expires_in_seconds']);
  validateExactRows(rowsBySource.photo_download_url_omissions!, ['id', 'path', 'reason']);
  validatePhotoRows(rowsBySource, expectedUserId);

  const routineIds = stringIds(rowsBySource.routines!, 'id');
  requireForeignKeys(rowsBySource.routine_steps!, 'routine_id', routineIds);
  const cycleIds = stringIds(rowsBySource.cycles!, 'id');
  requireForeignKeys(rowsBySource.cycle_nights!, 'cycle_id', cycleIds);
  const askSessionIds = stringIds(rowsBySource.ask_sessions!, 'id');
  requireForeignKeys(rowsBySource.ask_turn_audit!, 'session_id', askSessionIds);
  const clickTokens = stringIds(rowsBySource.commerce_click_events!, 'click_token');
  requireForeignKeys(rowsBySource.order_attributions!, 'click_token', clickTokens);
  const manifest = parsed.manifest;
  if (
    !isRecord(manifest) ||
    !hasExactKeys(manifest, [
      'manifest_schema_version',
      'complete',
      'consistency',
      'pagination',
      'sources',
    ]) ||
    manifest.manifest_schema_version !== 1 ||
    manifest.complete !== true ||
    !isRecord(manifest.sources) ||
    !hasExactKeys(manifest.sources, ALL_MANIFEST_SOURCES)
  ) {
    invalid();
  }
  validateManifestEnvelope(manifest);
  for (const source of ALL_ARRAY_SOURCES) {
    validateManifestSource(source, manifest.sources[source], rowsBySource[source]!.length);
  }
  validateManifestSource('health_consent_lifecycle', manifest.sources.health_consent_lifecycle, 1);

  return parsed;
}
