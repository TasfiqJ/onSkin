import { createClient } from 'jsr:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const allowedEvents = new Set([
  'landing_viewed',
  'store_click',
  'install',
  'onboarding_started',
  'first_product_added',
  'first_reviewed_insight_viewed',
  'trial_started',
  'paid_started',
]);

const allowedKeys = new Set([
  'event',
  'source',
  'medium',
  'campaign',
  'content',
  'term',
  'creative_variant',
  'landing_variant',
  'platform',
  'app_version',
  'build_number',
  'store',
  'share_id',
]);

const sensitive =
  /(barcode|ingredient|ocr|raw_text|note|localuri|local_uri|file|path|photo|image|receipt|product_id|product_name|conflict_text|pregnan|condition|diagnos|skin|goal|profile|free_text|message|body|email|phone|address|name|user_id|app_user_id|age|birth|zip|postal|retinoid|retinol|aha|bha|benzoyl|hydroquinone|niacinamide|vitamin_c|sunscreen|peptide)/i;

function safeValue(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 120 || trimmed.includes('@') || /\s/.test(trimmed)) return null;
  if (sensitive.test(trimmed)) return null;
  return trimmed;
}

function sanitize(input: Record<string, unknown>): Record<string, string> | null {
  const event = safeValue(input.event);
  if (!event || !allowedEvents.has(event)) return null;
  const out: Record<string, string> = { event };
  for (const [key, value] of Object.entries(input)) {
    if (key === 'event') continue;
    if (!allowedKeys.has(key) || sensitive.test(key)) continue;
    const safe = safeValue(value);
    if (safe) out[key] = safe;
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405, headers: cors });

  let parsed: Record<string, unknown>;
  try {
    parsed = await req.json();
  } catch {
    return new Response('bad json', { status: 400, headers: cors });
  }

  const payload = sanitize(parsed);
  if (!payload) return new Response('invalid event', { status: 400, headers: cors });

  const { error } = await supabase.from('growth_events').insert(payload);
  if (error) return new Response('insert failed', { status: 500, headers: cors });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
});
