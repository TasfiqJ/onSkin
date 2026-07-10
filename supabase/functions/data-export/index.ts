// GDPR Art. 20 / state privacy data-portability export. The bundle is scoped to
// the caller's JWT and fails closed if any required launch data class cannot be
// exported.
// Deploy with JWT verification enabled: `supabase functions deploy data-export`
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { bearerAuthorizationHeader } from '../_shared/auth.ts';
import { photoPathBelongsToUser } from '../_shared/storagePath.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const publishableKey =
  Deno.env.get('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY') ??
  Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ??
  Deno.env.get('SUPABASE_ANON_KEY')!;
const serviceKey =
  Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const dataExportRateLimitMax = intEnv('DATA_EXPORT_RATE_LIMIT_MAX', 5, 1, 100);
const dataExportRateLimitWindowSeconds = intEnv(
  'DATA_EXPORT_RATE_LIMIT_WINDOW_SECONDS',
  3600,
  60,
  86400,
);
const dataExportPhotoUrlTtlSeconds = intEnv('DATA_EXPORT_PHOTO_URL_TTL_SECONDS', 3600, 60, 3600);
const dataExportFileName = exportFileName();
let rateLimitHmacKey: CryptoKey | null = null;

type TableFilter = { column: string; value: string } | null;
type ExportTable = {
  table: string;
  filter: TableFilter;
  scope: 'caller_rls' | 'service_role_filtered';
  note?: string;
};
type EdgeSupabaseClient = any;

export const CALLER_RLS_EXPORT_TABLES: ExportTable[] = [
  { table: 'profiles', filter: { column: 'id', value: 'USER_ID' }, scope: 'caller_rls' },
  { table: 'skin_profiles', filter: { column: 'user_id', value: 'USER_ID' }, scope: 'caller_rls' },
  { table: 'user_products', filter: { column: 'user_id', value: 'USER_ID' }, scope: 'caller_rls' },
  { table: 'routines', filter: { column: 'user_id', value: 'USER_ID' }, scope: 'caller_rls' },
  { table: 'routine_steps', filter: null, scope: 'caller_rls', note: 'Owned through routines.' },
  {
    table: 'routine_completions',
    filter: { column: 'user_id', value: 'USER_ID' },
    scope: 'caller_rls',
  },
  {
    table: 'routine_conflicts',
    filter: { column: 'user_id', value: 'USER_ID' },
    scope: 'caller_rls',
  },
  { table: 'active_ramp', filter: { column: 'user_id', value: 'USER_ID' }, scope: 'caller_rls' },
  { table: 'shelf_scans', filter: { column: 'user_id', value: 'USER_ID' }, scope: 'caller_rls' },
  { table: 'cycles', filter: { column: 'user_id', value: 'USER_ID' }, scope: 'caller_rls' },
  { table: 'cycle_nights', filter: null, scope: 'caller_rls', note: 'Owned through cycles.' },
  { table: 'streak_freezes', filter: { column: 'user_id', value: 'USER_ID' }, scope: 'caller_rls' },
  {
    table: 'notification_preferences',
    filter: { column: 'user_id', value: 'USER_ID' },
    scope: 'caller_rls',
  },
  {
    table: 'notification_log',
    filter: { column: 'user_id', value: 'USER_ID' },
    scope: 'caller_rls',
  },
  { table: 'consents', filter: { column: 'user_id', value: 'USER_ID' }, scope: 'caller_rls' },
  { table: 'photos', filter: { column: 'user_id', value: 'USER_ID' }, scope: 'caller_rls' },
  { table: 'entitlements', filter: { column: 'user_id', value: 'USER_ID' }, scope: 'caller_rls' },
  {
    table: 'reverse_trial_grants',
    filter: { column: 'user_id', value: 'USER_ID' },
    scope: 'caller_rls',
  },
  {
    table: 'recommendation_preferences',
    filter: { column: 'user_id', value: 'USER_ID' },
    scope: 'caller_rls',
  },
  {
    table: 'recommendations',
    filter: { column: 'user_id', value: 'USER_ID' },
    scope: 'caller_rls',
  },
  {
    table: 'catalog_corrections',
    filter: { column: 'user_id', value: 'USER_ID' },
    scope: 'caller_rls',
  },
  {
    table: 'catalog_lookup_events',
    filter: { column: 'user_id', value: 'USER_ID' },
    scope: 'caller_rls',
  },
  {
    table: 'commerce_click_events',
    filter: { column: 'user_id', value: 'USER_ID' },
    scope: 'caller_rls',
  },
  {
    table: 'community_blocks',
    filter: { column: 'user_id', value: 'USER_ID' },
    scope: 'caller_rls',
  },
  {
    table: 'community_questions',
    filter: { column: 'user_id', value: 'USER_ID' },
    scope: 'caller_rls',
  },
  {
    table: 'community_reactions',
    filter: { column: 'user_id', value: 'USER_ID' },
    scope: 'caller_rls',
  },
  {
    table: 'community_reports',
    filter: { column: 'reporter_id', value: 'USER_ID' },
    scope: 'caller_rls',
  },
  { table: 'photo_trend', filter: { column: 'user_id', value: 'USER_ID' }, scope: 'caller_rls' },
  { table: 'ask_sessions', filter: { column: 'user_id', value: 'USER_ID' }, scope: 'caller_rls' },
  {
    table: 'ask_turn_audit',
    filter: null,
    scope: 'caller_rls',
    note: 'Owned through ask_sessions.',
  },
  {
    table: 'ask_safety_audit',
    filter: { column: 'user_id', value: 'USER_ID' },
    scope: 'caller_rls',
  },
];

export const SERVICE_ROLE_FILTERED_EXPORTS = [
  'subscriptions_events',
  'obf_contribution_queue',
  'order_attributions_by_click_token',
] as const;

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
      ...headers,
    },
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

function applyFilter(query: any, filter: TableFilter, userId: string) {
  if (!filter) return query;
  return query.eq(filter.column, filter.value === 'USER_ID' ? userId : filter.value);
}

async function selectRows(
  client: EdgeSupabaseClient,
  table: string,
  filter: TableFilter,
  userId: string,
): Promise<unknown[]> {
  const { data, error } = await applyFilter(client.from(table).select('*'), filter, userId);
  if (error) throw new Error(`EXPORT_TABLE_FAILED:${table}:${error.message}`);
  return data ?? [];
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
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);

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

  const rateLimitError = await enforceRateLimit(admin, userId);
  if (rateLimitError) return rateLimitError;

  try {
    const bundle: Record<string, unknown> = {
      export_schema_version: 2,
      exported_at: new Date().toISOString(),
      user_id: userId,
      local_only_photo_note:
        'Progress photo files and thumbnails are not included in this account export. In the current build they stay encrypted on the device unless the user explicitly shares one from Progress; cloud backup is unavailable.',
      export_coverage: {
        caller_rls_tables: CALLER_RLS_EXPORT_TABLES.map((item) => item.table),
        service_role_filtered_exports: SERVICE_ROLE_FILTERED_EXPORTS,
      },
      exclusion_register: [
        {
          data_class: 'local_device_files',
          reason:
            'Progress photo files and thumbnails, shelf thumbnails, OS share-cache files, and SecureStore keys remain on the device and are excluded. Any server-side photo metadata rows are exported separately in photos.',
        },
        {
          data_class: 'internal_commission_calculation',
          reason:
            'order_attributions export includes rows linked by the user click token but omits commission_cents as internal business accounting.',
        },
      ],
    };

    for (const item of CALLER_RLS_EXPORT_TABLES) {
      bundle[item.table] = await selectRows(supabase, item.table, item.filter, userId);
    }

    const { data: subscriptionEvents, error: subscriptionEventsError } = await admin
      .from('subscriptions_events')
      .select('*')
      .or(
        `user_id.eq.${userId},resolved_user_id.eq.${userId},app_user_id.eq.${userId},original_app_user_id.eq.${userId}`,
      );
    if (subscriptionEventsError) {
      throw new Error(
        `EXPORT_TABLE_FAILED:subscriptions_events:${subscriptionEventsError.message}`,
      );
    }
    bundle.subscriptions_events = subscriptionEvents ?? [];

    const { data: obfQueue, error: obfQueueError } = await admin
      .from('obf_contribution_queue')
      .select('*')
      .eq('user_id', userId);
    if (obfQueueError)
      throw new Error(`EXPORT_TABLE_FAILED:obf_contribution_queue:${obfQueueError.message}`);
    bundle.obf_contribution_queue = obfQueue ?? [];

    const clickTokens = (
      (bundle.commerce_click_events as Array<{ click_token?: string | null }> | undefined) ?? []
    )
      .map((row) => row.click_token)
      .filter((token): token is string => Boolean(token));
    if (clickTokens.length > 0) {
      const { data: orderAttributions, error: orderAttributionsError } = await admin
        .from('order_attributions')
        .select(
          'id, click_token, external_order_id, order_amount_cents, currency, status, transaction_date, record_updated_at, created_at',
        )
        .in('click_token', clickTokens);
      if (orderAttributionsError) {
        throw new Error(`EXPORT_TABLE_FAILED:order_attributions:${orderAttributionsError.message}`);
      }
      bundle.order_attributions = orderAttributions ?? [];
    } else {
      bundle.order_attributions = [];
    }

    const cloudPhotos = (
      (bundle.photos as
        | Array<{ id?: string; storage_path?: string | null; local_only?: boolean }>
        | undefined) ?? []
    ).filter((photo) => !photo.local_only && photo.storage_path);
    const photoUrls: { id: string | null; url: string | null }[] = [];
    const photoUrlOmissions: { id: string | null; reason: string }[] = [];
    for (const photo of cloudPhotos) {
      if (!photoPathBelongsToUser(userId, photo.storage_path as string)) {
        photoUrlOmissions.push({ id: photo.id ?? null, reason: 'INVALID_STORAGE_PATH' });
        continue;
      }
      const { data: signed, error } = await admin.storage
        .from('photos')
        .createSignedUrl(photo.storage_path as string, dataExportPhotoUrlTtlSeconds);
      if (error) throw new Error(`EXPORT_PHOTO_URL_FAILED:${error.message}`);
      photoUrls.push({ id: photo.id ?? null, url: signed?.signedUrl ?? null });
    }
    bundle.photo_download_urls = photoUrls;
    bundle.photo_download_url_omissions = photoUrlOmissions;

    return json(bundle, 200, {
      'Content-Disposition': `attachment; filename="${dataExportFileName}"`,
    });
  } catch (error) {
    console.error('[data-export]', 'DATA_EXPORT_FAILED');
    return json({ error: 'DATA_EXPORT_FAILED' }, 500);
  }
});
