// Local catalog search only. Do not proxy Open Beauty Facts search-as-you-type.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const publishableKey =
  Deno.env.get('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY') ??
  Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ??
  Deno.env.get('SUPABASE_ANON_KEY')!;
const serviceKey = Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function cleanQuery(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const authHeader = req.headers.get('Authorization') ?? '';
  const caller = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData } = await caller.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return json({ error: 'unauthorized' }, 401);

  const body = await req.json().catch(() => ({}));
  const query = cleanQuery(body.query);
  const limit = Math.min(Math.max(Number(body.limit ?? 10), 1), 20);
  if (query.length < 2) return json({ result: 'too_short', products: [] });

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const escaped = query.replace(/[%_,()]/g, ' ');

  const { data, error } = await admin
    .from('products')
    .select(
      'id, barcode, name, brand, category, default_pao_months, source, source_ref, source_url, source_snapshot_date, quality_grade, review_status, data_quality_score, ingredient_parse_status, ingredient_parse_confidence',
    )
    .or(`name.ilike.%${escaped}%,brand.ilike.%${escaped}%`)
    .neq('status', 'blocked')
    .order('data_quality_score', { ascending: false })
    .limit(limit);
  if (error) return json({ error: 'search_failed' }, 500);

  await caller.from('catalog_lookup_events').insert({
    user_id: userId,
    lookup_type: 'search',
    query,
    result: data?.length ? 'matched' : 'no_match',
    matched_product_id: data?.[0]?.id ?? null,
    source_key: data?.[0]?.source ?? null,
    quality_grade: data?.[0]?.quality_grade ?? null,
  });

  return json({ result: data?.length ? 'matched' : 'no_match', products: data ?? [] });
});
