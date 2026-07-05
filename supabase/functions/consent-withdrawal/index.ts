// Granular consent withdrawal for privacy-rights flows. Deploy with JWT
// verification enabled: `supabase functions deploy consent-withdrawal`.
//
// The caller's JWT proves whose data can be touched. The service role is used
// only after that proof to append the revocation ledger row and perform the
// promised cleanup for prior cloud/shared data.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { contentLengthTooLarge, readLimitedJson, userEdgeBodyMaxBytes } from '../_shared/body.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const maxBodyBytes = userEdgeBodyMaxBytes();

type ConsentWithdrawalType =
  | 'photo_cloud_backup'
  | 'photo_trend_insights'
  | 'ask_onskin'
  | 'community_participation'
  | 'data_sharing'
  | 'marketing';
type WithdrawalBody = {
  consentType: ConsentWithdrawalType;
  version: string;
  consentTextHash: string;
};
type EdgeSupabaseClient = any;

const allowedConsentTypes = new Set<ConsentWithdrawalType>([
  'photo_cloud_backup',
  'photo_trend_insights',
  'ask_onskin',
  'community_participation',
  'data_sharing',
  'marketing',
]);
const allowedBodyKeys = new Set(['consentType', 'version', 'consentTextHash']);

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

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateBody(value: unknown): WithdrawalBody | null {
  if (!isObject(value)) return null;
  if (Object.keys(value).some((key) => !allowedBodyKeys.has(key))) return null;

  const consentType = value.consentType;
  const version = value.version;
  const consentTextHash = value.consentTextHash;
  if (typeof consentType !== 'string' || !allowedConsentTypes.has(consentType as ConsentWithdrawalType)) return null;
  if (typeof version !== 'string' || version.trim().length === 0 || version.length > 120) return null;
  if (typeof consentTextHash !== 'string' || !/^[a-f0-9]{64}$/i.test(consentTextHash)) return null;

  return {
    consentType: consentType as ConsentWithdrawalType,
    version,
    consentTextHash: consentTextHash.toLowerCase(),
  };
}

function photoPathBelongsToUser(userId: string, storagePath: string): boolean {
  const [prefix, fileName, ...rest] = storagePath.split('/');
  return prefix === userId && Boolean(fileName) && rest.every((part) => part.length > 0);
}

function rowCount(data: unknown): number {
  return Array.isArray(data) ? data.length : 0;
}

async function deleteUserRows(
  supabase: EdgeSupabaseClient,
  table: string,
  column: string,
  userId: string,
): Promise<number> {
  const { data, error } = await supabase.from(table).delete().eq(column, userId).select('id');
  if (error) throw new Error('CONSENT_WITHDRAWAL_CLEANUP_FAILED');
  return rowCount(data);
}

async function insertRevocation(
  supabase: EdgeSupabaseClient,
  userId: string,
  body: WithdrawalBody,
): Promise<void> {
  const { error } = await supabase.from('consents').insert({
    user_id: userId,
    consent_type: body.consentType,
    granted: false,
    version: body.version,
    consent_text_hash: body.consentTextHash,
    revoked_at: new Date().toISOString(),
  });
  if (error) throw new Error('CONSENT_WITHDRAWAL_LEDGER_FAILED');
}

async function withdrawPhotoCloudBackup(supabase: EdgeSupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from('photos')
    .select('id, storage_path')
    .eq('user_id', userId)
    .eq('local_only', false);
  if (error) throw new Error('CONSENT_WITHDRAWAL_CLEANUP_FAILED');

  const rows = (data ?? []) as Array<{ id?: string; storage_path?: string | null }>;
  const ownedPaths = [
    ...new Set(
      rows
        .map((row) => row.storage_path)
        .filter((path): path is string => typeof path === 'string' && photoPathBelongsToUser(userId, path)),
    ),
  ];

  if (ownedPaths.length > 0) {
    const { error: removeError } = await supabase.storage.from('photos').remove(ownedPaths);
    if (removeError) throw new Error('CONSENT_WITHDRAWAL_CLEANUP_FAILED');
  }

  const { data: relocalized, error: updateError } = await supabase
    .from('photos')
    .update({ local_only: true, storage_path: null })
    .eq('user_id', userId)
    .eq('local_only', false)
    .select('id');
  if (updateError) throw new Error('CONSENT_WITHDRAWAL_CLEANUP_FAILED');

  return {
    photo_rows_relocalized: rowCount(relocalized),
    storage_objects_removed: ownedPaths.length,
    skipped_storage_paths: rows.length - ownedPaths.length,
  };
}

async function withdrawAskOnSkin(supabase: EdgeSupabaseClient, userId: string) {
  return {
    ask_safety_audit_deleted: await deleteUserRows(supabase, 'ask_safety_audit', 'user_id', userId),
  };
}

async function withdrawTrendInsights(supabase: EdgeSupabaseClient, userId: string) {
  return {
    photo_trend_deleted: await deleteUserRows(supabase, 'photo_trend', 'user_id', userId),
  };
}

async function withdrawCommunityParticipation(supabase: EdgeSupabaseClient, userId: string) {
  const reportsDeleted = await deleteUserRows(supabase, 'community_reports', 'reporter_id', userId);
  const reactionsDeleted = await deleteUserRows(supabase, 'community_reactions', 'user_id', userId);
  const questionsDeleted = await deleteUserRows(supabase, 'community_questions', 'user_id', userId);
  const blocksDeleted = await deleteUserRows(supabase, 'community_blocks', 'user_id', userId);
  return {
    community_reports_deleted: reportsDeleted,
    community_reactions_deleted: reactionsDeleted,
    community_questions_deleted: questionsDeleted,
    community_blocks_deleted: blocksDeleted,
  };
}

async function withdrawDataSharing(supabase: EdgeSupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from('commerce_click_events')
    .select('click_token')
    .eq('user_id', userId);
  if (error) throw new Error('CONSENT_WITHDRAWAL_CLEANUP_FAILED');

  const clickTokens = [
    ...new Set(
      ((data ?? []) as Array<{ click_token?: string | null }>)
        .map((row) => row.click_token)
        .filter((token): token is string => Boolean(token)),
    ),
  ];

  let orderAttributionsDetached = 0;
  if (clickTokens.length > 0) {
    const { data: detached, error: detachError } = await supabase
      .from('order_attributions')
      .update({ click_token: null })
      .in('click_token', clickTokens)
      .select('id');
    if (detachError) throw new Error('CONSENT_WITHDRAWAL_CLEANUP_FAILED');
    orderAttributionsDetached = rowCount(detached);
  }

  return {
    order_attributions_detached: orderAttributionsDetached,
    commerce_click_events_deleted: await deleteUserRows(supabase, 'commerce_click_events', 'user_id', userId),
  };
}

async function runCleanup(supabase: EdgeSupabaseClient, userId: string, consentType: ConsentWithdrawalType) {
  switch (consentType) {
    case 'photo_cloud_backup':
      return withdrawPhotoCloudBackup(supabase, userId);
    case 'ask_onskin':
      return withdrawAskOnSkin(supabase, userId);
    case 'photo_trend_insights':
      return withdrawTrendInsights(supabase, userId);
    case 'community_participation':
      return withdrawCommunityParticipation(supabase, userId);
    case 'data_sharing':
      return withdrawDataSharing(supabase, userId);
    case 'marketing':
      return { marketing_withdrawal_recorded: true };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
  if (contentLengthTooLarge(req, maxBodyBytes)) return json({ error: 'payload_too_large' }, 413);

  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  const userId = userData.user?.id;
  if (userErr || !userId) return json({ error: 'UNAUTHORIZED' }, 401);

  const parsed = await readLimitedJson(req, maxBodyBytes, json, { error: 'BAD_JSON' });
  if (parsed instanceof Response) return parsed;

  const body = validateBody(parsed);
  if (!body) return json({ error: 'INVALID_BODY' }, 400);

  try {
    await insertRevocation(supabase, userId, body);
    const cleanup = await runCleanup(supabase, userId, body.consentType);
    return json({ withdrawn: true, consent_type: body.consentType, cleanup });
  } catch {
    console.error('[consent-withdrawal]', 'CONSENT_WITHDRAWAL_FAILED');
    return json({ withdrawn: false, error: 'CONSENT_WITHDRAWAL_FAILED' }, 500);
  }
});
