/**
 * Typed access to EXPO_PUBLIC_* env vars (inlined into the bundle at build time).
 * Real values come from `.env`. See `.env.example` and BLOCKERS.md. Missing
 * values fall back to a clearly-marked placeholder + a dev warning so the app
 * boots and the wiring is visible, rather than crashing.
 */

const PLACEHOLDER = '__BLOCKED_PLACEHOLDER__';

function readEnv(name: string, value: string | undefined, blockerId: string): string {
  if (value && value.length > 0) return value;
  if (__DEV__) {
    console.warn(`[env] ${name} is not set. Using placeholder. BLOCKED: ${blockerId}`);
  }
  return PLACEHOLDER;
}

export const env = {
  // BLOCKED: B-SUPABASE
  supabaseUrl: readEnv('EXPO_PUBLIC_SUPABASE_URL', process.env.EXPO_PUBLIC_SUPABASE_URL, 'B-SUPABASE'),
  supabasePublishableKey: readEnv(
    'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    'B-SUPABASE',
  ),
  // BLOCKED: B-GOOGLE
  googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '',
  googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
  // BLOCKED: B-TURNSTILE
  turnstileSiteKey: process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY ?? '',
  // BLOCKED: B-REVENUECAT
  revenueCatIosKey: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '',
  revenueCatAndroidKey: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? '',
  // BLOCKED: B-POSTHOG
  posthogKey: process.env.EXPO_PUBLIC_POSTHOG_KEY ?? '',
  posthogHost: process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
  // BLOCKED: B-SENTRY
  sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN ?? '',
} as const;

/** True when a value is the BLOCKED placeholder (e.g. Supabase not configured). */
export function isPlaceholder(value: string): boolean {
  return value === PLACEHOLDER;
}

/** Whether Supabase is actually configured (vs. running on placeholders). */
export const isSupabaseConfigured = !isPlaceholder(env.supabaseUrl) && !isPlaceholder(env.supabasePublishableKey);
