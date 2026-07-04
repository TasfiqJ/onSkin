// Exact barcode lookup. Bulk import must use export files; this function only
// supports one scan-time lookup at a time.
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
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function normalizeBarcode(value: string | null | undefined): string | null {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 14 ? digits : null;
}

async function requestBarcode(req: Request): Promise<string | null> {
  if (req.method === 'GET') {
    return normalizeBarcode(new URL(req.url).searchParams.get('barcode'));
  }
  const body = await req.json().catch(() => ({}));
  return normalizeBarcode(body.barcode);
}

async function fetchOpenBeautyFacts(barcode: string) {
  if (Deno.env.get('OBF_API_ENABLED') !== 'true') return null;
  const userAgent = Deno.env.get('OBF_USER_AGENT') ?? '';
  if (!/^[^/\s]+\/[^\s]+\s+\([^)@]+@[^)@]+\.[^)]+\)$/.test(userAgent)) return null;

  const fields = 'code,product_name,brands,ingredients_text,categories_tags,last_modified_t';
  const res = await fetch(`https://world.openbeautyfacts.org/api/v2/product/${barcode}.json?fields=${fields}`, {
    headers: { 'User-Agent': userAgent },
  });
  if (!res.ok) return null;
  const body = await res.json();
  if (body.status !== 1 || !body.product) return null;
  const product = body.product;
  return {
    id: null,
    barcode,
    name: product.product_name ?? 'Unknown product',
    brand: product.brands ?? null,
    category: null,
    source: 'open_beauty_facts',
    sourceRef: barcode,
    sourceUrl: `https://world.openbeautyfacts.org/product/${barcode}`,
    sourceSnapshotDate:
      typeof product.last_modified_t === 'number'
        ? new Date(product.last_modified_t * 1000).toISOString().slice(0, 10)
        : null,
    qualityGrade: 'unverified',
    reviewStatus: 'unreviewed',
    ingredientParseStatus: product.ingredients_text ? 'not_parsed' : 'failed',
    ingredientParseConfidence: 0,
    defaultPaoMonths: null,
    rawIngredientsText: product.ingredients_text ?? null,
    external: true,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authHeader = req.headers.get('Authorization') ?? '';
  const caller = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData } = await caller.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return json({ error: 'unauthorized' }, 401);

  const barcode = await requestBarcode(req);
  if (!barcode) return json({ error: 'invalid_barcode' }, 400);

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: barcodeRow, error: barcodeError } = await admin
    .from('product_barcodes')
    .select('barcode, product_id, confidence')
    .eq('barcode', barcode)
    .maybeSingle();
  if (barcodeError) return json({ error: 'lookup_failed' }, 500);

  if (barcodeRow?.product_id) {
    const { data: product, error: productError } = await admin
      .from('products')
      .select(
        'id, name, brand, category, default_pao_months, source, source_ref, source_url, source_snapshot_date, quality_grade, review_status, data_quality_score, ingredient_parse_status, ingredient_parse_confidence, catalog_sources:source_id(display_name, source_key, attribution_text, attribution_url)',
      )
      .eq('id', barcodeRow.product_id)
      .maybeSingle();
    if (productError) return json({ error: 'lookup_failed' }, 500);
    if (product) {
      await caller.from('catalog_lookup_events').insert({
        user_id: userId,
        lookup_type: 'barcode',
        barcode,
        result: 'matched',
        matched_product_id: product.id,
        source_key: product.source,
        quality_grade: product.quality_grade,
      });
      return json({ result: 'matched', product: { ...product, barcode } });
    }
  }

  const external = await fetchOpenBeautyFacts(barcode);
  await caller.from('catalog_lookup_events').insert({
    user_id: userId,
    lookup_type: 'barcode',
    barcode,
    result: external ? 'ambiguous' : 'no_match',
    source_key: external ? 'open_beauty_facts' : null,
    quality_grade: external ? 'unverified' : null,
  });

  if (external) return json({ result: 'external_candidate', product: external });
  return json({ result: 'no_match', manualFallback: true });
});

