// GDPR Art. 20 / state privacy data-portability export. The bundle is scoped to
// the caller's JWT and fails closed if any required launch data class cannot be
// exported.
// Deploy with JWT verification enabled: `supabase functions deploy data-export`
import { createClient } from 'jsr:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const publishableKey =
  Deno.env.get('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY') ??
  Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ??
  Deno.env.get('SUPABASE_ANON_KEY')!;
const serviceKey = Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

type TableFilter = { column: string; value: string } | null;
type ExportTable = {
  table: string;
  filter: TableFilter;
  scope: 'caller_rls' | 'service_role_filtered';
  note?: string;
};

export const CALLER_RLS_EXPORT_TABLES: ExportTable[] = [
  { table: 'profiles', filter: { column: 'id', value: 'USER_ID' }, scope: 'caller_rls' },
  { table: 'skin_profiles', filter: { column: 'user_id', value: 'USER_ID' }, scope: 'caller_rls' },
  { table: 'user_products', filter: { column: 'user_id', value: 'USER_ID' }, scope: 'caller_rls' },
  { table: 'routines', filter: { column: 'user_id', value: 'USER_ID' }, scope: 'caller_rls' },
  { table: 'routine_steps', filter: null, scope: 'caller_rls', note: 'Owned through routines.' },
  { table: 'routine_completions', filter: { column: 'user_id', value: 'USER_ID' }, scope: 'caller_rls' },
  { table: 'routine_conflicts', filter: { column: 'user_id', value: 'USER_ID' }, scope: 'caller_rls' },
  { table: 'active_ramp', filter: { column: 'user_id', value: 'USER_ID' }, scope: 'caller_rls' },
  { table: 'shelf_scans', filter: { column: 'user_id', value: 'USER_ID' }, scope: 'caller_rls' },
  { table: 'cycles', filter: { column: 'user_id', value: 'USER_ID' }, scope: 'caller_rls' },
  { table: 'cycle_nights', filter: null, scope: 'caller_rls', note: 'Owned through cycles.' },
  { table: 'streak_freezes', filter: { column: 'user_id', value: 'USER_ID' }, scope: 'caller_rls' },
  { table: 'notification_preferences', filter: { column: 'user_id', value: 'USER_ID' }, scope: 'caller_rls' },
  { table: 'notification_log', filter: { column: 'user_id', value: 'USER_ID' }, scope: 'caller_rls' },
  { table: 'consents', filter: { column: 'user_id', value: 'USER_ID' }, scope: 'caller_rls' },
  { table: 'photos', filter: { column: 'user_id', value: 'USER_ID' }, scope: 'caller_rls' },
  { table: 'entitlements', filter: { column: 'user_id', value: 'USER_ID' }, scope: 'caller_rls' },
  { table: 'reverse_trial_grants', filter: { column: 'user_id', value: 'USER_ID' }, scope: 'caller_rls' },
  { table: 'recommendation_preferences', filter: { column: 'user_id', value: 'USER_ID' }, scope: 'caller_rls' },
  { table: 'recommendations', filter: { column: 'user_id', value: 'USER_ID' }, scope: 'caller_rls' },
  { table: 'catalog_corrections', filter: { column: 'user_id', value: 'USER_ID' }, scope: 'caller_rls' },
  { table: 'catalog_lookup_events', filter: { column: 'user_id', value: 'USER_ID' }, scope: 'caller_rls' },
  { table: 'commerce_click_events', filter: { column: 'user_id', value: 'USER_ID' }, scope: 'caller_rls' },
  { table: 'community_blocks', filter: { column: 'user_id', value: 'USER_ID' }, scope: 'caller_rls' },
  { table: 'community_questions', filter: { column: 'user_id', value: 'USER_ID' }, scope: 'caller_rls' },
  { table: 'community_reactions', filter: { column: 'user_id', value: 'USER_ID' }, scope: 'caller_rls' },
  { table: 'community_reports', filter: { column: 'reporter_id', value: 'USER_ID' }, scope: 'caller_rls' },
  { table: 'photo_trend', filter: { column: 'user_id', value: 'USER_ID' }, scope: 'caller_rls' },
  { table: 'ask_sessions', filter: { column: 'user_id', value: 'USER_ID' }, scope: 'caller_rls' },
  { table: 'ask_turn_audit', filter: null, scope: 'caller_rls', note: 'Owned through ask_sessions.' },
  { table: 'ask_safety_audit', filter: { column: 'user_id', value: 'USER_ID' }, scope: 'caller_rls' },
];

export const SERVICE_ROLE_FILTERED_EXPORTS = [
  'subscriptions_events',
  'obf_contribution_queue',
  'order_attributions_by_click_token',
] as const;

function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body, null, 2), {
    status,
    headers: {
      'Content-Type': typeof body === 'string' ? 'text/plain' : 'application/json',
      ...headers,
    },
  });
}

function applyFilter(query: any, filter: TableFilter, userId: string) {
  if (!filter) return query;
  return query.eq(filter.column, filter.value === 'USER_ID' ? userId : filter.value);
}

async function selectRows(
  client: ReturnType<typeof createClient>,
  table: string,
  filter: TableFilter,
  userId: string,
): Promise<unknown[]> {
  const { data, error } = await applyFilter(client.from(table).select('*'), filter, userId);
  if (error) throw new Error(`EXPORT_TABLE_FAILED:${table}:${error.message}`);
  return data ?? [];
}

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization') ?? '';

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

  try {
    const bundle: Record<string, unknown> = {
      export_schema_version: 2,
      exported_at: new Date().toISOString(),
      user_id: userId,
      local_only_photo_note:
        'Photos marked local_only=true and photo thumbnails stored only on this device are not present in Supabase and cannot be downloaded from the cloud export.',
      export_coverage: {
        caller_rls_tables: CALLER_RLS_EXPORT_TABLES.map((item) => item.table),
        service_role_filtered_exports: SERVICE_ROLE_FILTERED_EXPORTS,
      },
      exclusion_register: [
        {
          data_class: 'local_device_files',
          reason: 'The cloud backend never receives local-only progress photos, shelf thumbnails, OS share-cache files, or SecureStore keys.',
        },
        {
          data_class: 'internal_commission_calculation',
          reason: 'order_attributions export includes rows linked by the user click token but omits commission_cents as internal business accounting.',
        },
      ],
    };

    for (const item of CALLER_RLS_EXPORT_TABLES) {
      bundle[item.table] = await selectRows(supabase, item.table, item.filter, userId);
    }

    const { data: subscriptionEvents, error: subscriptionEventsError } = await admin
      .from('subscriptions_events')
      .select('*')
      .or(`user_id.eq.${userId},resolved_user_id.eq.${userId},app_user_id.eq.${userId},original_app_user_id.eq.${userId}`);
    if (subscriptionEventsError) {
      throw new Error(`EXPORT_TABLE_FAILED:subscriptions_events:${subscriptionEventsError.message}`);
    }
    bundle.subscriptions_events = subscriptionEvents ?? [];

    const { data: obfQueue, error: obfQueueError } = await admin
      .from('obf_contribution_queue')
      .select('*')
      .eq('user_id', userId);
    if (obfQueueError) throw new Error(`EXPORT_TABLE_FAILED:obf_contribution_queue:${obfQueueError.message}`);
    bundle.obf_contribution_queue = obfQueue ?? [];

    const clickTokens = ((bundle.commerce_click_events as Array<{ click_token?: string | null }> | undefined) ?? [])
      .map((row) => row.click_token)
      .filter((token): token is string => Boolean(token));
    if (clickTokens.length > 0) {
      const { data: orderAttributions, error: orderAttributionsError } = await admin
        .from('order_attributions')
        .select('id, click_token, external_order_id, order_amount_cents, currency, status, transaction_date, record_updated_at, created_at')
        .in('click_token', clickTokens);
      if (orderAttributionsError) {
        throw new Error(`EXPORT_TABLE_FAILED:order_attributions:${orderAttributionsError.message}`);
      }
      bundle.order_attributions = orderAttributions ?? [];
    } else {
      bundle.order_attributions = [];
    }

    const cloudPhotos = ((bundle.photos as Array<{ id?: string; storage_path?: string | null; local_only?: boolean }> | undefined) ?? [])
      .filter((photo) => !photo.local_only && photo.storage_path);
    const photoUrls: { id: string | null; url: string | null }[] = [];
    for (const photo of cloudPhotos) {
      const { data: signed, error } = await admin.storage
        .from('photos')
        .createSignedUrl(photo.storage_path as string, 60 * 60);
      if (error) throw new Error(`EXPORT_PHOTO_URL_FAILED:${error.message}`);
      photoUrls.push({ id: photo.id ?? null, url: signed?.signedUrl ?? null });
    }
    bundle.photo_download_urls = photoUrls;

    return json(bundle, 200, {
      'Content-Disposition': 'attachment; filename="onskin-export.json"',
    });
  } catch (error) {
    console.error('[data-export]', error);
    return json({ error: 'DATA_EXPORT_FAILED' }, 500);
  }
});
