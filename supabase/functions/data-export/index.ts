// GDPR Art. 20 / state privacy data-portability export. The bundle is scoped to
// the caller's JWT and fails closed if any required launch data class cannot be
// exported.
// Deploy with JWT verification enabled: `supabase functions deploy data-export`
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { stagingTrafficFreezeResponse } from '../_shared/stagingTrafficFreeze.ts';
import { type AccountAccessSnapshot, preflightAccountAccess } from '../_shared/accountAccess.ts';
import { bearerAuthorizationHeader } from '../_shared/auth.ts';
import { contentLengthTooLarge, readLimitedJson, userEdgeBodyMaxBytes } from '../_shared/body.ts';
import { photoPathBelongsToUser } from '../_shared/storagePath.ts';
import { readSupabasePublishableKey } from '../_shared/supabasePublishableKey.ts';
import { readSupabaseSecretKey } from '../_shared/supabaseSecretKey.ts';
import {
  type HealthLifecycleExportSnapshot,
  healthLifecycleExportSnapshot,
  parseHealthLifecycleRow,
} from '../consent-withdrawal/healthLifecycleCore.ts';
import {
  boundedMap,
  checksumRows,
  derivedManifest,
  EXPORT_CONSISTENCY,
  type ExportSourceManifest,
  healthLifecycleExportDecision,
  listStoragePathsVerified,
  type PaginatedRows,
  paginateRows,
} from './exportCore.ts';
import {
  buildDirectExportPlans,
  CALLER_RLS_EXPORT_TABLES,
  type ExportTable,
  SERVICE_ROLE_FILTERED_EXPORTS,
  SUBSCRIPTION_EVENT_EXPORT_COLUMNS,
  subscriptionEventOwnerFilter,
} from './exportRegistry.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const publishableKey = readSupabasePublishableKey();
const serviceKey = readSupabaseSecretKey();
const dataExportRateLimitMax = intEnv('DATA_EXPORT_RATE_LIMIT_MAX', 5, 1, 100);
const dataExportRateLimitWindowSeconds = intEnv(
  'DATA_EXPORT_RATE_LIMIT_WINDOW_SECONDS',
  3600,
  60,
  86400,
);
const dataExportPhotoUrlTtlSeconds = intEnv('DATA_EXPORT_PHOTO_URL_TTL_SECONDS', 60, 30, 60);
const dataExportPageSize = intEnv('DATA_EXPORT_PAGE_SIZE', 500, 100, 1000);
const dataExportMaxRowsPerSource = intEnv('DATA_EXPORT_MAX_ROWS_PER_SOURCE', 50_000, 1000, 250_000);
const dataExportStoragePageSize = intEnv('DATA_EXPORT_STORAGE_PAGE_SIZE', 500, 100, 1000);
const dataExportMaxStorageObjects = intEnv(
  'DATA_EXPORT_MAX_STORAGE_OBJECTS',
  25_000,
  1000,
  100_000,
);
const dataExportConcurrency = intEnv('DATA_EXPORT_CONCURRENCY', 4, 1, 8);
const dataExportFilterBatchSize = intEnv('DATA_EXPORT_FILTER_BATCH_SIZE', 50, 10, 100);
const dataExportBodyMaxBytes = userEdgeBodyMaxBytes();
const dataExportFileName = exportFileName();
let rateLimitHmacKey: CryptoKey | null = null;

// No generated database type is committed for Edge Functions, so the dynamic
// table registry cannot be expressed through Supabase's schema generics here.
// deno-lint-ignore no-explicit-any
type EdgeSupabaseClient = any;
// deno-lint-ignore no-explicit-any
type ExportQuery = any;

class ExportHealthLifecycleUnavailableError extends Error {
  constructor() {
    super('EXPORT_HEALTH_LIFECYCLE_UNAVAILABLE');
    this.name = 'ExportHealthLifecycleUnavailableError';
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body, null, 2), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': typeof body === 'string' ? 'text/plain' : 'application/json',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...headers,
    },
  });
}

async function requireSameAccountAccess(
  caller: Parameters<typeof preflightAccountAccess>[0],
  userId: string,
  snapshot: AccountAccessSnapshot,
): Promise<Response | null> {
  const result = await preflightAccountAccess(caller, userId, snapshot);
  return result.ok ? null : json({ error: result.error }, result.status);
}

async function readExportHealthLifecycle(
  client: EdgeSupabaseClient,
  userId: string,
): Promise<HealthLifecycleExportSnapshot> {
  const { data, error } = await client.rpc('get_health_data_consent_status');
  const row = error ? null : parseHealthLifecycleRow(data);
  if (!row || row.user_id !== userId) {
    throw new ExportHealthLifecycleUnavailableError();
  }
  return healthLifecycleExportSnapshot(row);
}

function healthLifecycleRetryResponse(
  decision: Exclude<ReturnType<typeof healthLifecycleExportDecision>, { allowed: true }>,
): Response {
  return json({ error: decision.error, retryable: true }, 409, {
    'Retry-After': String(decision.retryAfterSeconds),
  });
}

function intEnv(name: string, fallback: number, min: number, max: number): number {
  const value = Number(Deno.env.get(name));
  if (!Number.isInteger(value) || value < min || value > max) return fallback;
  return value;
}

function exportFileSlug(): string {
  const displayName =
    Deno.env.get('EXPO_PUBLIC_APP_DISPLAY_NAME') ??
    Deno.env.get('APP_DISPLAY_NAME') ??
    'RoutineKind';
  const slug = displayName
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return slug || 'routinekind';
}

function exportFileName(): string {
  return `${exportFileSlug()}-export.json`;
}

function applyFilter(
  query: ExportQuery,
  filter: { column: string; value: string } | null,
): ExportQuery {
  if (!filter) return query;
  return query.eq(filter.column, filter.value);
}

type QueryDecorator = (query: ExportQuery) => ExportQuery;

async function selectExactCount(
  client: EdgeSupabaseClient,
  table: string,
  decorate: QueryDecorator,
): Promise<number | null> {
  const { count, error } = await decorate(
    client.from(table).select('*', { count: 'exact', head: true }),
  );
  if (error) {
    throw new Error(`EXPORT_TABLE_FAILED:${table}:COUNT:${error.message}`);
  }
  return count;
}

async function selectPage(
  client: EdgeSupabaseClient,
  table: string,
  selectColumns: string,
  orderBy: readonly string[],
  decorate: QueryDecorator,
  offset: number,
  limit: number,
): Promise<Record<string, unknown>[]> {
  let query = decorate(client.from(table).select(selectColumns));
  for (const column of orderBy) {
    query = query.order(column, { ascending: true });
  }
  const { data, error } = await query.range(offset, offset + limit - 1);
  if (error) {
    throw new Error(`EXPORT_TABLE_FAILED:${table}:PAGE:${error.message}`);
  }
  if (!Array.isArray(data)) {
    throw new Error(`EXPORT_TABLE_FAILED:${table}:PAGE:INVALID_DATA`);
  }
  return data as Record<string, unknown>[];
}

function paginateQuery(options: {
  client: EdgeSupabaseClient;
  table: string;
  scope: ExportTable['scope'];
  orderBy: readonly string[];
  decorate: QueryDecorator;
  selectColumns?: string;
  note?: string;
}): Promise<PaginatedRows> {
  return paginateRows({
    source: options.table,
    scope: options.scope,
    orderBy: options.orderBy,
    pageSize: dataExportPageSize,
    maxRows: dataExportMaxRowsPerSource,
    note: options.note,
    fetchCount: () => selectExactCount(options.client, options.table, options.decorate),
    fetchPage: (offset, limit) =>
      selectPage(
        options.client,
        options.table,
        options.selectColumns ?? '*',
        options.orderBy,
        options.decorate,
        offset,
        limit,
      ),
  });
}

function chunks<T>(values: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

function compareIds(left: Record<string, unknown>, right: Record<string, unknown>): number {
  const leftId = String(left.id);
  const rightId = String(right.id);
  return leftId < rightId ? -1 : leftId > rightId ? 1 : 0;
}

async function hmacSha256Hex(value: string): Promise<string> {
  const encoder = new TextEncoder();
  rateLimitHmacKey ??= await crypto.subtle.importKey(
    'raw',
    encoder.encode(serviceKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', rateLimitHmacKey, encoder.encode(value));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  );
}

async function enforceRateLimit(
  admin: EdgeSupabaseClient,
  userId: string,
): Promise<Response | null> {
  const keyHash = await hmacSha256Hex(`data-export|${userId}`);
  const { data, error } = await admin.rpc('consume_edge_rate_limit', {
    p_scope: 'data-export',
    p_key_hash: keyHash,
    p_limit: dataExportRateLimitMax,
    p_window_seconds: dataExportRateLimitWindowSeconds,
    p_owner_user_id: userId,
  });

  if (error) {
    console.warn('DATA_EXPORT_RATE_LIMIT_FAILED');
    return json({ error: 'RATE_LIMIT_UNAVAILABLE' }, 503);
  }
  if (data !== true) {
    return json({ error: 'RATE_LIMITED' }, 429, {
      'Retry-After': String(dataExportRateLimitWindowSeconds),
    });
  }
  return null;
}

Deno.serve(async (req) => {
  const frozen = stagingTrafficFreezeResponse();
  if (frozen) return frozen;
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
  if (contentLengthTooLarge(req, dataExportBodyMaxBytes)) {
    return json({ error: 'payload_too_large' }, 413);
  }

  const authHeader = bearerAuthorizationHeader(req);
  if (!authHeader) return json('unauthorized', 401);

  const supabase = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (userErr || !userId) return json('unauthorized', 401);

  const initialAccountAccess = await preflightAccountAccess(supabase, userId);
  if (!initialAccountAccess.ok) {
    return json({ error: initialAccountAccess.error }, initialAccountAccess.status);
  }

  const requestBody = await readLimitedJson(req, dataExportBodyMaxBytes, json, {
    error: 'BAD_JSON',
  });
  if (requestBody instanceof Response) return requestBody;
  if (requestBody === null || typeof requestBody !== 'object' || Array.isArray(requestBody)) {
    return json({ error: 'INVALID_BODY' }, 400);
  }

  let initialHealthLifecycle: HealthLifecycleExportSnapshot;
  try {
    initialHealthLifecycle = await readExportHealthLifecycle(supabase, userId);
  } catch {
    return json({ error: 'HEALTH_DATA_LIFECYCLE_UNAVAILABLE' }, 503);
  }
  const initialHealthDecision = healthLifecycleExportDecision(
    initialHealthLifecycle,
    initialHealthLifecycle,
  );
  if (!initialHealthDecision.allowed) {
    return healthLifecycleRetryResponse(initialHealthDecision);
  }

  const rateLimitError = await enforceRateLimit(admin, userId);
  if (rateLimitError) return rateLimitError;

  const sourceAccountError = await requireSameAccountAccess(
    supabase,
    userId,
    initialAccountAccess.snapshot,
  );
  if (sourceAccountError) return sourceAccountError;

  try {
    const sourcePayloads: Record<string, Record<string, unknown>[]> = {};
    const sourceManifest: Record<string, ExportSourceManifest> = {};

    const directPlans = buildDirectExportPlans(userId);
    const sourceTasks: Array<() => Promise<{ source: string; result: PaginatedRows }>> =
      directPlans.map((item) => async () => ({
        source: item.table,
        result: await paginateQuery({
          client: item.clientKind === 'caller' ? supabase : admin,
          table: item.table,
          scope: item.scope,
          orderBy: item.orderBy,
          decorate: (query) => applyFilter(query, item.filter),
          selectColumns: item.selectColumns,
          note: item.note,
        }),
      }));

    sourceTasks.push(async () => ({
      source: 'subscriptions_events',
      result: await paginateQuery({
        client: admin,
        table: 'subscriptions_events',
        scope: 'service_role_filtered',
        orderBy: ['id'],
        selectColumns: SUBSCRIPTION_EVENT_EXPORT_COLUMNS.join(', '),
        decorate: (query) => query.or(subscriptionEventOwnerFilter(userId)),
        note: 'Matched to every retained owner identifier; owner identifiers and internal processing fields are excluded from the exported row.',
      }),
    }));

    const sourceResults = await boundedMap(sourceTasks, dataExportConcurrency, (task) => task());
    for (const { source, result } of sourceResults) {
      if (Object.hasOwn(sourcePayloads, source)) {
        throw new Error(`EXPORT_SOURCE_DUPLICATE:${source}`);
      }
      sourcePayloads[source] = result.rows;
      sourceManifest[source] = result.manifest;
    }

    const attributionAccountError = await requireSameAccountAccess(
      supabase,
      userId,
      initialAccountAccess.snapshot,
    );
    if (attributionAccountError) return attributionAccountError;

    const clickTokens = [
      ...new Set(
        (sourcePayloads.commerce_click_events ?? [])
          .map((row) => row.click_token)
          .filter((token): token is string => typeof token === 'string' && token.length > 0),
      ),
    ].sort();
    const attributionBatches = chunks(clickTokens, dataExportFilterBatchSize);
    const attributionBatchResults = await boundedMap(
      attributionBatches,
      dataExportConcurrency,
      (tokenBatch) =>
        paginateQuery({
          client: admin,
          table: 'order_attributions',
          scope: 'service_role_filtered',
          orderBy: ['id'],
          selectColumns:
            'id, click_token, external_order_id, order_amount_cents, currency, status, transaction_date, record_updated_at, created_at',
          decorate: (query) => query.in('click_token', tokenBatch),
          note: 'Matched only through click tokens present in the exported commerce_click_events rows.',
        }),
    );
    const orderAttributions = attributionBatchResults
      .flatMap((result) => result.rows)
      .sort(compareIds);
    if (orderAttributions.length > dataExportMaxRowsPerSource) {
      throw new Error('EXPORT_SOURCE_INCOMPLETE:order_attributions:ROW_LIMIT_EXCEEDED');
    }
    if (new Set(orderAttributions.map((row) => String(row.id))).size !== orderAttributions.length) {
      throw new Error('EXPORT_SOURCE_INCOMPLETE:order_attributions:DUPLICATE_ORDER_KEY');
    }
    sourcePayloads.order_attributions = orderAttributions;
    sourceManifest.order_attributions = {
      kind: 'database_table',
      scope: 'service_role_filtered',
      order_by: ['id'],
      count: orderAttributions.length,
      count_before: attributionBatchResults.reduce(
        (total, result) => total + result.manifest.count_before,
        0,
      ),
      count_after: attributionBatchResults.reduce(
        (total, result) => total + result.manifest.count_after,
        0,
      ),
      page_requests: attributionBatchResults.reduce(
        (total, result) => total + result.manifest.page_requests,
        0,
      ),
      checksum: await checksumRows(orderAttributions),
      checksum_algorithm: 'sha256-canonical-json-v1',
      complete: true,
      note: 'Matched only through bounded click-token batches from exported commerce_click_events; commission_cents is excluded as internal accounting.',
    };

    const storageAccountError = await requireSameAccountAccess(
      supabase,
      userId,
      initialAccountAccess.snapshot,
    );
    if (storageAccountError) return storageAccountError;

    const photoBucket = admin.storage.from('photos');
    const storageInventory = await listStoragePathsVerified({
      userId,
      bucket: photoBucket,
      pageSize: dataExportStoragePageSize,
      maxObjects: dataExportMaxStorageObjects,
    });
    const storagePathSet = new Set(storageInventory.paths);
    const cloudPhotos = (sourcePayloads.photos ?? []).filter(
      (photo) => photo.local_only !== true && typeof photo.storage_path === 'string',
    );
    const photoIdsByPath = new Map<string, string[]>();
    const photoUrlOmissions: Array<{ id: string | null; path: string | null; reason: string }> = [];
    for (const photo of cloudPhotos) {
      const id = typeof photo.id === 'string' ? photo.id : null;
      const path = photo.storage_path as string;
      if (!photoPathBelongsToUser(userId, path)) {
        photoUrlOmissions.push({
          id,
          path: null,
          reason: 'INVALID_STORAGE_PATH',
        });
        continue;
      }
      if (!storagePathSet.has(path)) {
        photoUrlOmissions.push({
          id,
          path,
          reason: 'STORAGE_OBJECT_NOT_LISTED',
        });
        continue;
      }
      const ids = photoIdsByPath.get(path) ?? [];
      if (id) ids.push(id);
      photoIdsByPath.set(path, ids);
    }
    for (const ids of photoIdsByPath.values()) ids.sort();

    const signingAccountError = await requireSameAccountAccess(
      supabase,
      userId,
      initialAccountAccess.snapshot,
    );
    if (signingAccountError) return signingAccountError;

    const photoUrls = await boundedMap(
      storageInventory.paths,
      dataExportConcurrency,
      async (path) => {
        const { data: signed, error } = await photoBucket.createSignedUrl(
          path,
          dataExportPhotoUrlTtlSeconds,
        );
        if (error || !signed?.signedUrl) {
          throw new Error('EXPORT_PHOTO_URL_FAILED');
        }
        return {
          id: photoIdsByPath.get(path)?.[0] ?? null,
          path,
          url: signed.signedUrl,
          expires_in_seconds: dataExportPhotoUrlTtlSeconds,
        };
      },
    );
    const photoStorageObjects = storageInventory.paths.map((path) => ({
      path,
    }));
    sourcePayloads.photo_storage_objects = photoStorageObjects;
    sourcePayloads.photo_download_urls = photoUrls;
    sourcePayloads.photo_download_url_omissions = photoUrlOmissions;
    sourceManifest.photo_storage_objects = storageInventory.manifest;
    sourceManifest.photo_download_urls = await derivedManifest({
      rows: photoUrls,
      checksumRows: photoUrls.map(({ id, path }) => ({ id, path })),
      checksumFields: ['id', 'path'],
      note: 'Signed URL tokens are volatile and excluded from the checksum; identity fields are checksummed.',
    });
    sourceManifest.photo_download_url_omissions = await derivedManifest({
      rows: photoUrlOmissions,
      checksumFields: ['id', 'path', 'reason'],
    });

    const finalHealthLifecycle = await readExportHealthLifecycle(supabase, userId);
    const healthDecision = healthLifecycleExportDecision(
      initialHealthLifecycle,
      finalHealthLifecycle,
    );
    if (!healthDecision.allowed) {
      return healthLifecycleRetryResponse(healthDecision);
    }
    const responseAccountError = await requireSameAccountAccess(
      supabase,
      userId,
      initialAccountAccess.snapshot,
    );
    if (responseAccountError) return responseAccountError;
    sourceManifest.health_consent_lifecycle = await derivedManifest({
      rows: [healthDecision.snapshot],
      checksumFields: [
        'state',
        'processing_epoch',
        'operation_state',
        'result_code',
        'consent_version',
        'consent_text_hash',
        'server_verified_at',
      ],
      note: 'Sanitized owner-derived health-purpose lifecycle status; internal operation identifiers, claim tokens, and lease state are excluded.',
    });

    const exportedAt = new Date().toISOString();
    const bundle: Record<string, unknown> = {
      export_schema_version: 3,
      exported_at: exportedAt,
      user_id: userId,
      manifest: {
        manifest_schema_version: 1,
        complete: true,
        consistency: EXPORT_CONSISTENCY,
        pagination: {
          database_page_size: dataExportPageSize,
          storage_page_size: dataExportStoragePageSize,
          max_concurrency: dataExportConcurrency,
          max_rows_per_database_source: dataExportMaxRowsPerSource,
          max_storage_objects: dataExportMaxStorageObjects,
        },
        sources: sourceManifest,
      },
      local_only_photo_note:
        'Progress photo files and thumbnails are not included in this account export. In the current build they stay encrypted on the device unless the user explicitly shares one from Progress; cloud backup is unavailable.',
      server_photo_object_note:
        'Any owner-prefixed server photo objects that already exist are inventoried and receive short-lived download URLs.',
      health_consent_lifecycle: healthDecision.snapshot,
      export_coverage: {
        caller_rls_tables: CALLER_RLS_EXPORT_TABLES.map((item) => item.table),
        service_role_filtered_exports: SERVICE_ROLE_FILTERED_EXPORTS,
        storage_sources: ['photo_storage_objects'],
        derived_sources: [
          'photo_download_urls',
          'photo_download_url_omissions',
          'health_consent_lifecycle',
        ],
      },
      exclusion_register: [
        {
          data_class: 'local_device_files',
          reason:
            'Progress photo files and thumbnails, shelf thumbnails, OS share-cache files, SecureStore keys, and auth credentials remain on the device and are excluded. Any server-side photo metadata rows are exported separately in photos. Owner-prefixed server photo objects, if present, are inventoried separately.',
        },
        {
          data_class: 'internal_commission_calculation',
          reason:
            'order_attributions rows linked by an exported user click token omit commission_cents as internal business accounting.',
        },
      ],
      ...sourcePayloads,
    };

    const deliveryAccountError = await requireSameAccountAccess(
      supabase,
      userId,
      initialAccountAccess.snapshot,
    );
    if (deliveryAccountError) return deliveryAccountError;

    return json(bundle, 200, {
      'Content-Disposition': `attachment; filename="${dataExportFileName}"`,
    });
  } catch (_error) {
    if (_error instanceof ExportHealthLifecycleUnavailableError) {
      return json({ error: 'HEALTH_DATA_LIFECYCLE_UNAVAILABLE' }, 503);
    }
    console.error('[data-export]', 'DATA_EXPORT_FAILED');
    return json({ error: 'DATA_EXPORT_FAILED' }, 500);
  }
});
