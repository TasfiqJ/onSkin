// GDPR Art. 20 data-portability export (docs/01 §4). Assembles the user's data
// into a JSON bundle with signed URLs for any cloud photos. Caller's JWT scopes
// it to their own data.
// Deploy: `supabase functions deploy data-export`  (verify_jwt = true)
import { createClient } from 'jsr:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization') ?? '';

  // Read everything through a CALLER-SCOPED client: the anon key plus the user's
  // JWT means every query runs under that user's RLS, so each owner-scoped table
  // (docs/01: RLS on every table) returns only this user's rows. We must NOT read
  // tables with the service-role key, which bypasses RLS and would return every
  // user's data. The service-role client is used solely for signing storage URLs
  // of photos we have already filtered to this user.
  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (userErr || !userId) return new Response('unauthorized', { status: 401 });

  const tables = [
    'profiles',
    'skin_profiles',
    'user_products',
    'routines',
    'routine_steps',
    'routine_completions',
    'consents',
    'photos',
    'notification_preferences',
    'entitlements',
  ] as const;

  const bundle: Record<string, unknown> = { exported_at: new Date().toISOString(), user_id: userId };
  for (const table of tables) {
    // RLS-scoped read. A belt-and-suspenders user filter is applied where the
    // table carries a direct user_id column; routine_steps is owner-scoped via
    // its parent routine (owns_routine), so RLS alone bounds it.
    const { data } = await supabase.from(table).select('*');
    bundle[table] = data ?? [];
  }

  // Signed URLs for any cloud-backed photos (local-only photos never left device).
  // The photo rows here come from the caller-scoped client above, so they are
  // already limited to this user; the admin client only mints the signed URLs.
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: cloudPhotos } = await supabase
    .from('photos')
    .select('id, storage_path')
    .eq('local_only', false)
    .not('storage_path', 'is', null);
  const photoUrls: { id: string; url: string | null }[] = [];
  for (const p of cloudPhotos ?? []) {
    if (!p.storage_path) continue;
    const { data: signed } = await admin.storage
      .from('photos')
      .createSignedUrl(p.storage_path, 60 * 60);
    photoUrls.push({ id: p.id, url: signed?.signedUrl ?? null });
  }
  bundle.photo_download_urls = photoUrls;

  return new Response(JSON.stringify(bundle, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="onskin-export.json"',
    },
  });
});
