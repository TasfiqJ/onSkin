/**
 * Typed access to EXPO_PUBLIC_* env vars (inlined into the bundle at build time).
 * Real values come from `.env`. See `.env.example` and BLOCKERS.md. Missing
 * values fall back to a clearly-marked placeholder + a dev warning so the app
 * boots and the wiring is visible, rather than crashing.
 */

const PLACEHOLDER = '__BLOCKED_PLACEHOLDER__';

function readEnv(name: string, value: string | undefined, blockerId: string): string {
  if (value && value.length > 0) return value;
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.warn(`[env] ${name} is not set. Using placeholder. BLOCKED: ${blockerId}`);
  }
  return PLACEHOLDER;
}

export const env = {
  appEnvironment: process.env.EXPO_PUBLIC_APP_ENV ?? 'development',
  privacyUrl: process.env.EXPO_PUBLIC_PRIVACY_URL ?? '',
  termsUrl: process.env.EXPO_PUBLIC_TERMS_URL ?? '',
  supportUrl: process.env.EXPO_PUBLIC_SUPPORT_URL ?? '',
  accountDeletionUrl: process.env.EXPO_PUBLIC_ACCOUNT_DELETION_URL ?? '',
  dataExportUrl: process.env.EXPO_PUBLIC_DATA_EXPORT_URL ?? '',
  consumerHealthPrivacyUrl: process.env.EXPO_PUBLIC_CONSUMER_HEALTH_PRIVACY_URL ?? '',
  finalBrandDomain: process.env.EXPO_PUBLIC_FINAL_BRAND_DOMAIN ?? '',
  appStoreUrl: process.env.EXPO_PUBLIC_APP_STORE_URL ?? '',
  playStoreUrl: process.env.EXPO_PUBLIC_PLAY_STORE_URL ?? '',
  marketingUrl: process.env.EXPO_PUBLIC_MARKETING_URL ?? '',
  supportEmail: process.env.EXPO_PUBLIC_SUPPORT_EMAIL ?? '',
  cameraStack: process.env.EXPO_PUBLIC_CAMERA_STACK ?? 'expo-camera',
  nativeCameraEnabled: process.env.EXPO_PUBLIC_NATIVE_CAMERA_ENABLED !== 'false',
  nativeOcrEnabled: process.env.EXPO_PUBLIC_NATIVE_OCR_ENABLED === 'true',
  phase7CommerceEnabled: process.env.EXPO_PUBLIC_PHASE7_COMMERCE_ENABLED === 'true',
  phase7CommunityPostingEnabled: process.env.EXPO_PUBLIC_PHASE7_COMMUNITY_POSTING_ENABLED === 'true',
  phase7TrendEnabled: process.env.EXPO_PUBLIC_PHASE7_TREND_ENABLED === 'true',
  phase7CloudAskEnabled: process.env.EXPO_PUBLIC_PHASE7_CLOUD_ASK_ENABLED === 'true',
  phase7WidgetsEnabled: process.env.EXPO_PUBLIC_PHASE7_WIDGETS_ENABLED === 'true',
  phase7ShareCardEnabled: process.env.EXPO_PUBLIC_PHASE7_SHARE_CARD_ENABLED === 'true',
  phase7ReviewedConflictSharingEnabled:
    process.env.EXPO_PUBLIC_PHASE7_REVIEWED_CONFLICT_SHARING_ENABLED === 'true',
  phase7GoalActiveRecommendationsEnabled:
    process.env.EXPO_PUBLIC_PHASE7_GOAL_ACTIVE_RECOMMENDATIONS_ENABLED === 'true',
  phase8PublicLinksEnabled: process.env.EXPO_PUBLIC_PHASE8_PUBLIC_LINKS_ENABLED === 'true',
  phase8ReviewPromptEnabled: process.env.EXPO_PUBLIC_PHASE8_REVIEW_PROMPT_ENABLED === 'true',
  phase8CreatorLinksEnabled: process.env.EXPO_PUBLIC_PHASE8_CREATOR_LINKS_ENABLED === 'true',
  phase8PaidMeasurementEnabled: process.env.EXPO_PUBLIC_PHASE8_PAID_MEASUREMENT_ENABLED === 'true',
  // BLOCKED: B-SUPABASE
  supabaseUrl: readEnv(
    'EXPO_PUBLIC_SUPABASE_URL',
    process.env.EXPO_PUBLIC_SUPABASE_URL,
    'B-SUPABASE',
  ),
  supabasePublishableKey: readEnv(
    'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    'B-SUPABASE',
  ),
  // BLOCKED: B-GOOGLE
  googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '',
  googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
  googleIosUrlScheme: process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME ?? '',
  // BLOCKED: B-TURNSTILE
  turnstileSiteKey: process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY ?? '',
  // BLOCKED: B-REVENUECAT
  revenueCatTestStoreKey: process.env.EXPO_PUBLIC_REVENUECAT_TEST_STORE_KEY ?? '',
  revenueCatIosKey: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '',
  revenueCatAndroidKey: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? '',
  revenueCatEntitlementId: process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID ?? 'pro',
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
export const isSupabaseConfigured =
  !isPlaceholder(env.supabaseUrl) && !isPlaceholder(env.supabasePublishableKey);
