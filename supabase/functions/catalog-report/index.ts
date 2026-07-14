// User correction reports. Users can report wrong/missing product data without
// writing global catalog tables.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { bearerAuthorizationHeader } from '../_shared/auth.ts';
import { contentLengthTooLarge, readLimitedJson, userEdgeBodyMaxBytes } from '../_shared/body.ts';
import { readSupabasePublishableKey } from '../_shared/supabasePublishableKey.ts';
import { readSupabaseSecretKey } from '../_shared/supabaseSecretKey.ts';
import {
  allowedContextKeys,
  allowedPayloadKeys,
  allowedTopLevelKeys,
  correctionTypes,
  isPlainObject,
  normalizeBarcode,
  safeString,
  sanitizeObject,
  validateAllowedKeys,
} from './privacy.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const publishableKey = readSupabasePublishableKey();
const serviceKey = readSupabaseSecretKey();
const maxBodyBytes = userEdgeBodyMaxBytes();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function assertAllowedKeys(
  input: Record<string, unknown>,
  allowed: Set<string>,
  code: string,
): Response | null {
  return validateAllowedKeys(input, allowed) ? null : json({ error: code }, 400);
}

async function requestBody(req: Request): Promise<Record<string, unknown> | Response> {
  const body = await readLimitedJson(req, maxBodyBytes, json, { error: 'bad_json' });
  if (body instanceof Response) return body;
  if (!isPlainObject(body)) return json({ error: 'bad_json' }, 400);
  return assertAllowedKeys(body, allowedTopLevelKeys, 'unexpected_field') ?? body;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (contentLengthTooLarge(req, maxBodyBytes)) return json({ error: 'payload_too_large' }, 413);

  const authHeader = bearerAuthorizationHeader(req);
  if (!authHeader) return json({ error: 'unauthorized' }, 401);
  const caller = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData } = await caller.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return json({ error: 'unauthorized' }, 401);

  const parsed = await requestBody(req);
  if (parsed instanceof Response) return parsed;
  const body = parsed;
  const correctionType = String(body.correctionType ?? '');
  if (!correctionTypes.has(correctionType)) return json({ error: 'invalid_correction_type' }, 400);
  const productId =
    typeof body.productId === 'string' && UUID_RE.test(body.productId) ? body.productId : null;
  const description = safeString(body.description, 500);
  const proposedPayload = sanitizeObject(
    body.proposedPayload,
    allowedPayloadKeys,
    'invalid_proposed_payload',
  );
  if (proposedPayload.errorCode) return json({ error: proposedPayload.errorCode }, 400);
  const clientContext = sanitizeObject(
    body.clientContext,
    allowedContextKeys,
    'invalid_client_context',
  );
  if (clientContext.errorCode) return json({ error: clientContext.errorCode }, 400);

  const { data: correction, error } = await caller
    .from('catalog_corrections')
    .insert({
      user_id: userId,
      product_id: productId,
      barcode: normalizeBarcode(body.barcode),
      correction_type: correctionType,
      description,
      proposed_payload: proposedPayload.value,
      client_context: clientContext.value,
    })
    .select('id, status, created_at')
    .single();
  if (error) return json({ error: 'report_failed' }, 500);

  if (Deno.env.get('OBF_CONTRIBUTION_ENABLED') === 'true' && correctionType === 'missing_product') {
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: enqueueError } = await admin.rpc('enqueue_obf_contribution_for_correction', {
      p_correction_id: correction.id,
    });
    if (enqueueError) console.error('[catalog-report]', 'obf_contribution_enqueue_failed');
  }

  return json({ result: 'reported', correction });
});
