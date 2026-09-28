/**
 * Typed access to EXPO_PUBLIC_* env vars (inlined into the bundle at build time).
 * Real values come from `.env`. See `.env.example` and BLOCKERS.md. Missing
 * values fall back to a clearly-marked placeholder + a dev warning so the app
 * boots and the wiring is visible, rather than crashing.
 */

import { resolveIosWinBackEnabled } from '@/features/subscription/winBackCommercialState';

const PLACEHOLDER = '__BLOCKED_PLACEHOLDER__';
const SUPABASE_URL_PLACEHOLDER = 'https://blocked-supabase-url.invalid';
const SUPABASE_EXAMPLE_URL = 'https://YOUR-PROJECT-ref.supabase.co';
const SUPABASE_EXAMPLE_KEY = 'sb_publishable_xxxxxxxxxxxxxxxxxxxx';
const APP_ENVIRONMENTS = new Set(['development', 'staging', 'production']);
const REVENUECAT_DEFAULT_PRODUCT_IDS = {
  annual: 'layerwell_pro_annual_dev',
  monthly: 'layerwell_pro_monthly_dev',
} as const;

export type AppEnvironment = 'development' | 'staging' | 'production';

function isDevRuntime(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__;
}

function readEnv(name: string, value: string | undefined, blockerId: string): string {
  const candidate = value?.trim();
  if (candidate && !isKnownPlaceholder(candidate)) return candidate;
  if (isDevRuntime()) {
    console.warn(`[env] ${name} is not set. Using placeholder. BLOCKED: ${blockerId}`);
  }
  return PLACEHOLDER;
}

function readAppEnvironment(value: string | undefined): AppEnvironment {
  const candidate = value?.trim().toLowerCase();
  if (candidate && APP_ENVIRONMENTS.has(candidate)) {
    // A non-development JavaScript bundle must never regain local-only
    // behavior because a public build variable was mislabeled development.
    if (candidate === 'development' && !isDevRuntime()) return 'production';
    return candidate as AppEnvironment;
  }
  return isDevRuntime() ? 'development' : 'production';
}

const APP_ENVIRONMENT = readAppEnvironment(process.env.EXPO_PUBLIC_APP_ENV);

function readCustomProGrantEnabled(value: string | undefined): boolean {
  // The no-card full-Pro grant is not part of the iOS release candidate. It is
  // available only as an explicitly requested development fixture while the
  // separate Apple-policy/anti-abuse exception remains unresolved.
  return APP_ENVIRONMENT === 'development' && isDevRuntime() && readBooleanEnv(value);
}

function readBooleanEnv(
  value: string | undefined,
  {
    defaultValue = false,
    invalidValue = false,
  }: { defaultValue?: boolean; invalidValue?: boolean } = {},
): boolean {
  const candidate = value?.trim().toLowerCase();
  if (!candidate) return defaultValue;
  if (candidate === 'true') return true;
  if (candidate === 'false') return false;
  return invalidValue;
}

function isKnownPlaceholder(value: string): boolean {
  return (
    value === PLACEHOLDER ||
    value === SUPABASE_URL_PLACEHOLDER ||
    value === SUPABASE_EXAMPLE_URL ||
    value === SUPABASE_EXAMPLE_KEY
  );
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function readSupabaseUrlEnv(name: string, value: string | undefined, blockerId: string): string {
  const candidate = value?.trim();
  if (candidate && !isKnownPlaceholder(candidate) && isHttpUrl(candidate)) return candidate;
  if (isDevRuntime()) {
    console.warn(
      `[env] ${name} is not a valid Supabase URL. Using placeholder. BLOCKED: ${blockerId}`,
    );
  }
  return SUPABASE_URL_PLACEHOLDER;
}

export const env = {
  appEnvironment: APP_ENVIRONMENT,
  customProGrantEnabled: readCustomProGrantEnabled(
    process.env.EXPO_PUBLIC_CUSTOM_PRO_GRANT_ENABLED,
  ),
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
  nativeCameraEnabled: readBooleanEnv(process.env.EXPO_PUBLIC_NATIVE_CAMERA_ENABLED, {
    defaultValue: true,
    invalidValue: false,
  }),
  nativeOcrEnabled: readBooleanEnv(process.env.EXPO_PUBLIC_NATIVE_OCR_ENABLED),
  phase7CommunityPostingEnabled: readBooleanEnv(
    process.env.EXPO_PUBLIC_PHASE7_COMMUNITY_POSTING_ENABLED,
  ),
  phase7TrendEnabled: readBooleanEnv(process.env.EXPO_PUBLIC_PHASE7_TREND_ENABLED),
  phase7CloudAskEnabled: readBooleanEnv(process.env.EXPO_PUBLIC_PHASE7_CLOUD_ASK_ENABLED),
  phase7WidgetsEnabled: readBooleanEnv(process.env.EXPO_PUBLIC_PHASE7_WIDGETS_ENABLED),
  phase7ShareCardEnabled: readBooleanEnv(process.env.EXPO_PUBLIC_PHASE7_SHARE_CARD_ENABLED),
  phase7ReviewedConflictSharingEnabled: readBooleanEnv(
    process.env.EXPO_PUBLIC_PHASE7_REVIEWED_CONFLICT_SHARING_ENABLED,
  ),
  phase7GoalActiveRecommendationsEnabled: readBooleanEnv(
    process.env.EXPO_PUBLIC_PHASE7_GOAL_ACTIVE_RECOMMENDATIONS_ENABLED,
  ),
  phase8PublicLinksEnabled: readBooleanEnv(process.env.EXPO_PUBLIC_PHASE8_PUBLIC_LINKS_ENABLED),
  phase8ReviewPromptEnabled: readBooleanEnv(process.env.EXPO_PUBLIC_PHASE8_REVIEW_PROMPT_ENABLED),
  phase8CreatorLinksEnabled: readBooleanEnv(process.env.EXPO_PUBLIC_PHASE8_CREATOR_LINKS_ENABLED),
  phase8PaidMeasurementEnabled: readBooleanEnv(
    process.env.EXPO_PUBLIC_PHASE8_PAID_MEASUREMENT_ENABLED,
  ),
  // BLOCKED: B-SUPABASE
  supabaseUrl: readSupabaseUrlEnv(
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
  iosWinBackEnabled: resolveIosWinBackEnabled(
    readBooleanEnv(process.env.EXPO_PUBLIC_IOS_WIN_BACK_ENABLED),
  ),
  revenueCatAnnualProductId:
    process.env.EXPO_PUBLIC_REVENUECAT_ANNUAL_PRODUCT_ID?.trim() ||
    REVENUECAT_DEFAULT_PRODUCT_IDS.annual,
  revenueCatMonthlyProductId:
    process.env.EXPO_PUBLIC_REVENUECAT_MONTHLY_PRODUCT_ID?.trim() ||
    REVENUECAT_DEFAULT_PRODUCT_IDS.monthly,
  // BLOCKED: B-POSTHOG
  posthogKey: process.env.EXPO_PUBLIC_POSTHOG_KEY ?? '',
  posthogHost: process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com',
  // BLOCKED: B-SENTRY
  sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN ?? '',
} as const;

/** True when a value is the BLOCKED placeholder (e.g. Supabase not configured). */
export function isPlaceholder(value: string): boolean {
  return isKnownPlaceholder(value);
}

/** Whether Supabase is actually configured (vs. running on placeholders). */
export const isSupabaseConfigured =
  !isPlaceholder(env.supabaseUrl) && !isPlaceholder(env.supabasePublishableKey);
