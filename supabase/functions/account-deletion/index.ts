// In-app account deletion (Apple Guideline 5.1.1(v), Google equivalent, docs/01 §4).
// Runs on Supabase Edge (Deno) with the service-role key. The caller's JWT proves
// they are deleting THEIR OWN account.
// Deploy: `supabase functions deploy account-deletion`  (verify_jwt = true)
//
// Order (docs/01 §4):
//   1. revoke the Sign in with Apple token (TN3194) — BLOCKED: B-APPLE
//   2. delete the auth.users row (cascades to all public.* via FK ON DELETE CASCADE)
//   3. EXPLICITLY delete the user's Storage objects (cascade is NOT automatic)
//   4. call RevenueCat subscriber-deletion — BLOCKED: B-REVENUECAT
//   5. call PostHog person-deletion — BLOCKED: B-POSTHOG
import { createClient } from 'jsr:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

async function revokeAppleToken(_userId: string): Promise<void> {
  // BLOCKED: B-APPLE — build the client secret JWT from APPLE_SIWA_PRIVATE_KEY
  // (.p8) + APPLE_TEAM_ID + APPLE_SIWA_KEY_ID + APPLE_SIWA_SERVICE_ID, fetch the
  // user's Apple refresh token, then POST https://appleid.apple.com/auth/revoke.
  // Reviewers test sign-in -> delete -> sign-in again; intact data = rejection.
}

async function deleteRevenueCatSubscriber(_userId: string): Promise<void> {
  // BLOCKED: B-REVENUECAT — DELETE /subscribers/{app_user_id} with the secret API key.
}

async function deletePostHogPerson(_userId: string): Promise<void> {
  // BLOCKED: B-POSTHOG — DELETE person via POSTHOG_PERSONAL_API_KEY.
}

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization') ?? '';
  const supabase = createClient(supabaseUrl, serviceKey);

  // Identify the caller from their JWT.
  const { data: userData, error: userErr } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', ''),
  );
  const userId = userData.user?.id;
  if (userErr || !userId) return new Response('unauthorized', { status: 401 });

  // 1. Apple token revocation (must happen before the user row is gone).
  await revokeAppleToken(userId);

  // 3. Storage: remove the user's photo folder explicitly (no auto-cascade).
  const { data: objects } = await supabase.storage.from('photos').list(userId);
  if (objects && objects.length > 0) {
    await supabase.storage.from('photos').remove(objects.map((o) => `${userId}/${o.name}`));
  }

  // 4 + 5. External providers.
  await deleteRevenueCatSubscriber(userId);
  await deletePostHogPerson(userId);

  // 2. Delete the auth user — cascades to every public.* table via FK.
  const { error: delErr } = await supabase.auth.admin.deleteUser(userId);
  if (delErr) return new Response(JSON.stringify({ error: delErr.message }), { status: 500 });

  return new Response(JSON.stringify({ deleted: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
