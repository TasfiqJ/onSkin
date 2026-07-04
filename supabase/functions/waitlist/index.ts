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

const allowedAttributionKeys = new Set([
  'source',
  'medium',
  'campaign',
  'content',
  'term',
  'creative_variant',
  'landing_variant',
  'platform',
  'store',
  'share_id',
]);

const sensitive =
  /(barcode|ingredient|ocr|raw_text|note|localuri|local_uri|file|path|photo|image|receipt|product_id|product_name|conflict_text|pregnan|condition|diagnos|skin|goal|profile|free_text|message|body|phone|address|name|user_id|app_user_id|age|birth|zip|postal|retinoid|retinol|aha|bha|benzoyl|hydroquinone|niacinamide|vitamin_c|sunscreen|peptide)/i;

function safeText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 120 || /\s/.test(trimmed)) return null;
  if (sensitive.test(trimmed)) return null;
  return trimmed;
}

function sanitizeAttribution(input: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!allowedAttributionKeys.has(key) || sensitive.test(key)) continue;
    const safe = safeText(value);
    if (safe) out[key] = safe;
  }
  return out;
}

async function body(req: Request): Promise<Record<string, unknown>> {
  const contentType = req.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) return await req.json();
  const form = await req.formData();
  return Object.fromEntries(form.entries());
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405, headers: cors });

  let parsed: Record<string, unknown>;
  try {
    parsed = await body(req);
  } catch {
    return new Response('bad request', { status: 400, headers: cors });
  }

  const email = typeof parsed.email === 'string' ? parsed.email.trim().toLowerCase() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return new Response('invalid email', { status: 400, headers: cors });
  }

  const source = safeText(parsed.source) ?? 'waitlist';
  const attribution = sanitizeAttribution(parsed);
  const { error } = await supabase
    .from('waitlist_signups')
    .upsert({ email, source, attribution }, { onConflict: 'email' });

  if (error) return new Response('insert failed', { status: 500, headers: cors });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
});
