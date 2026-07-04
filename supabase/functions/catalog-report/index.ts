// User correction reports. Users can report wrong/missing product data without
// writing global catalog tables.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const publishableKey =
  Deno.env.get('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY') ??
  Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ??
  Deno.env.get('SUPABASE_ANON_KEY')!;
const serviceKey = Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const correctionTypes = new Set([
  'wrong_match',
  'missing_product',
  'ingredient_issue',
  'duplicate',
  'source_issue',
  'expiry_issue',
  'category_issue',
]);

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

function normalizeBarcode(value: unknown): string | null {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 14 ? digits : null;
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
  const correctionType = String(body.correctionType ?? '');
  if (!correctionTypes.has(correctionType)) return json({ error: 'invalid_correction_type' }, 400);

  const { data: correction, error } = await caller
    .from('catalog_corrections')
    .insert({
      user_id: userId,
      product_id: typeof body.productId === 'string' ? body.productId : null,
      barcode: normalizeBarcode(body.barcode),
      correction_type: correctionType,
      description: typeof body.description === 'string' ? body.description.slice(0, 1000) : null,
      proposed_payload: body.proposedPayload && typeof body.proposedPayload === 'object' ? body.proposedPayload : {},
      client_context: body.clientContext && typeof body.clientContext === 'object' ? body.clientContext : {},
    })
    .select('id, status, created_at')
    .single();
  if (error) return json({ error: 'report_failed' }, 500);

  if (Deno.env.get('OBF_CONTRIBUTION_ENABLED') === 'true' && correctionType === 'missing_product') {
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await admin.from('obf_contribution_queue').insert({
      correction_id: correction.id,
      user_id: userId,
      barcode: normalizeBarcode(body.barcode),
      payload: body.proposedPayload && typeof body.proposedPayload === 'object' ? body.proposedPayload : {},
      status: 'held',
      hold_reason: 'awaiting_source_review_and_moderation',
    });
  }

  return json({ result: 'reported', correction });
});

