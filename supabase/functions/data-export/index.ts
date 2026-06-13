// GDPR Art. 20 data-portability export (docs/01 §4). Assembles the user's data
// into a JSON bundle with signed URLs for any cloud photos. Caller's JWT scopes
// it to their own data.
// Deploy: `supabase functions deploy data-export`  (verify_jwt = true)
import { createClient } from 'jsr:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization') ?? '';
  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: userData, error: userErr } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', ''),
  );
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
    const { data } = await supabase.from(table).select('*');
    bundle[table] = data ?? [];
  }

  // Signed URLs for any cloud-backed photos (local-only photos never left device).
  const { data: cloudPhotos } = await supabase
    .from('photos')
    .select('id, storage_path')
    .eq('local_only', false)
    .not('storage_path', 'is', null);
  const photoUrls: { id: string; url: string | null }[] = [];
  for (const p of cloudPhotos ?? []) {
    if (!p.storage_path) continue;
    const { data: signed } = await supabase.storage
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
