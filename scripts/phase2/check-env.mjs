#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isReleasePlatformRequired, loadLaunchContract } from '../launch/contract.mjs';
import {
  normalizeProductionUrl,
  placeholderEnvValue,
  productionHostname,
  productionUrl,
} from '../phase9/lib.mjs';

const strict = process.argv.includes('--strict');
const root = process.cwd();
const launchContract = loadLaunchContract(resolve(import.meta.dirname, '../..'));
const androidReleaseRequired = isReleasePlatformRequired('android', launchContract);

function parseDotEnv(content) {
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    let value = rawValue.trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

for (const candidate of [resolve(root, '.env'), resolve(root, 'apps/mobile/.env')]) {
  if (existsSync(candidate)) parseDotEnv(readFileSync(candidate, 'utf8'));
}

const groups = [
  {
    name: 'App identity and brand clearance',
    required: ['APP_VARIANT', 'EXPO_PUBLIC_APP_ENV', 'BRAND_LEGAL_CLEARANCE'],
  },
  {
    name: 'Store listing URLs',
    required: [
      'EXPO_PUBLIC_PRIVACY_URL',
      'EXPO_PUBLIC_TERMS_URL',
      'EXPO_PUBLIC_SUPPORT_URL',
      'EXPO_PUBLIC_ACCOUNT_DELETION_URL',
      'EXPO_PUBLIC_DATA_EXPORT_URL',
      'EXPO_PUBLIC_CONSUMER_HEALTH_PRIVACY_URL',
    ],
  },
  {
    name: 'Supabase client and deploy',
    required: [
      'SUPABASE_PROJECT_REF',
      'EXPO_PUBLIC_SUPABASE_URL',
      'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    ],
  },
  {
    name: 'Supabase server secrets',
    required: [
      'SUPABASE_SECRET_KEY',
      'USER_EDGE_BODY_MAX_BYTES',
      'EDGE_EXTERNAL_FETCH_TIMEOUT_MS',
      'EDGE_EXTERNAL_RESPONSE_MAX_BYTES',
    ],
  },
  {
    name: 'RevenueCat',
    required: [
      'EXPO_PUBLIC_REVENUECAT_IOS_KEY',
      ...(androidReleaseRequired ? ['EXPO_PUBLIC_REVENUECAT_ANDROID_KEY'] : []),
      'EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID',
      'EXPO_PUBLIC_REVENUECAT_ANNUAL_PRODUCT_ID',
      'EXPO_PUBLIC_REVENUECAT_MONTHLY_PRODUCT_ID',
      'REVENUECAT_WEBHOOK_AUTH',
    ],
  },
  {
    name: 'RevenueCat customer deletion',
    anyOf: ['REVENUECAT_SECRET_API_KEY', 'REVENUECAT_REST_API_KEY'],
  },
  {
    name: 'Google Sign-In',
    required: [
      'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID',
      'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID',
      'EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME',
    ],
  },
  {
    name: 'Apple Sign-In server secrets',
    required: [
      'APPLE_TEAM_ID',
      'APPLE_SIWA_CLIENT_ID',
      'APPLE_SIWA_SERVICE_ID',
      'APPLE_SIWA_KEY_ID',
      'APPLE_SIWA_PRIVATE_KEY',
    ],
  },
  {
    name: 'PostHog',
    required: [
      'EXPO_PUBLIC_POSTHOG_KEY',
      'EXPO_PUBLIC_POSTHOG_HOST',
      'POSTHOG_PERSONAL_API_KEY',
      'POSTHOG_PROJECT_ID',
      'POSTHOG_API_HOST',
    ],
  },
  {
    name: 'Sentry',
    required: ['EXPO_PUBLIC_SENTRY_DSN', 'SENTRY_AUTH_TOKEN', 'SENTRY_ORG', 'SENTRY_PROJECT'],
  },
  {
    name: 'Turnstile',
    required: [
      'EXPO_PUBLIC_TURNSTILE_SITE_KEY',
      'TURNSTILE_SECRET_KEY',
      'PUBLIC_FORMS_RATE_LIMIT_MAX',
      'PUBLIC_FORMS_RATE_LIMIT_WINDOW_SECONDS',
      'PUBLIC_FORMS_MAX_BYTES',
    ],
  },
];

const forbiddenPublicName = /(SECRET|PRIVATE|SERVICE_ROLE|WEBHOOK|PERSONAL|AUTH_TOKEN)/i;
const forbiddenPublicValue =
  /(sb_secret_|service_role|whsec_|sk_(?:live|test|prod|secret)|sntrys_|phx_|-----BEGIN|PRIVATE KEY)/i;
const policyUrlKeys = [
  'EXPO_PUBLIC_PRIVACY_URL',
  'EXPO_PUBLIC_TERMS_URL',
  'EXPO_PUBLIC_SUPPORT_URL',
  'EXPO_PUBLIC_ACCOUNT_DELETION_URL',
  'EXPO_PUBLIC_DATA_EXPORT_URL',
  'EXPO_PUBLIC_CONSUMER_HEALTH_PRIVACY_URL',
];
const POSTHOG_MOBILE_INGEST_HOST = 'https://eu.i.posthog.com';
const POSTHOG_SERVER_API_HOST = 'https://eu.posthog.com';

function valueFor(name) {
  return process.env[name]?.trim() ?? '';
}

function normalizedAppStage(name) {
  return valueFor(name).toLowerCase();
}

function isUsable(name) {
  const value = valueFor(name);
  if (name === 'BRAND_LEGAL_CLEARANCE' && value.toLowerCase() === 'pending') return true;
  return value.length > 0 && !placeholderEnvValue(value);
}

function isAnyUsable(names) {
  return names.some(isUsable);
}

function isIntegerInRange(name, min, max) {
  const parsed = Number(valueFor(name));
  return Number.isInteger(parsed) && parsed >= min && parsed <= max;
}

const errors = [];
const warnings = [];

for (const group of groups) {
  const missing = (group.required ?? []).filter((name) => !isUsable(name));
  if (missing.length > 0)
    errors.push(`${group.name}: missing or placeholder values: ${missing.join(', ')}`);
  if (group.anyOf && !isAnyUsable(group.anyOf)) {
    errors.push(
      `${group.name}: missing or placeholder value; configure one of: ${group.anyOf.join(', ')}`,
    );
  }
}

for (const key of policyUrlKeys) {
  if (valueFor(key) && !productionUrl(valueFor(key))) {
    errors.push(`${key} must be a real production HTTPS URL.`);
  }
}

const supabaseUrl = valueFor('EXPO_PUBLIC_SUPABASE_URL');
if (supabaseUrl) {
  const normalizedSupabaseUrl = normalizeProductionUrl(supabaseUrl);
  if (!normalizedSupabaseUrl) {
    errors.push('EXPO_PUBLIC_SUPABASE_URL must be a real production HTTPS URL.');
  } else {
    const hostname = new URL(normalizedSupabaseUrl).hostname;
    if (!productionHostname(hostname) || !hostname.endsWith('.supabase.co')) {
      errors.push('EXPO_PUBLIC_SUPABASE_URL must point to a production Supabase project host.');
    }
  }
}

const posthogHost = valueFor('EXPO_PUBLIC_POSTHOG_HOST');
if (posthogHost && !productionUrl(posthogHost)) {
  errors.push('EXPO_PUBLIC_POSTHOG_HOST must be a real production HTTPS URL.');
}
if (posthogHost && posthogHost !== POSTHOG_MOBILE_INGEST_HOST) {
  errors.push(`EXPO_PUBLIC_POSTHOG_HOST must equal ${POSTHOG_MOBILE_INGEST_HOST}.`);
}

const posthogApiHost = valueFor('POSTHOG_API_HOST');
if (posthogApiHost && posthogApiHost !== POSTHOG_SERVER_API_HOST) {
  errors.push(`POSTHOG_API_HOST must equal ${POSTHOG_SERVER_API_HOST}.`);
}

const sentryDsn = valueFor('EXPO_PUBLIC_SENTRY_DSN');
if (sentryDsn) {
  let parsedSentryDsn;
  try {
    parsedSentryDsn = new URL(sentryDsn);
  } catch {
    parsedSentryDsn = null;
  }
  if (
    !parsedSentryDsn ||
    parsedSentryDsn.protocol !== 'https:' ||
    !productionHostname(parsedSentryDsn.hostname) ||
    Boolean(parsedSentryDsn.password)
  ) {
    errors.push('EXPO_PUBLIC_SENTRY_DSN must be a real production HTTPS Sentry DSN.');
  }
}

const appVariant = normalizedAppStage('APP_VARIANT');
if (appVariant && !['development', 'staging', 'production'].includes(appVariant)) {
  errors.push(
    `APP_VARIANT must be development, staging, or production; got ${valueFor('APP_VARIANT')}`,
  );
}

const appEnv = normalizedAppStage('EXPO_PUBLIC_APP_ENV');
if (appEnv && !['development', 'staging', 'production'].includes(appEnv)) {
  errors.push(
    `EXPO_PUBLIC_APP_ENV must be development, staging, or production; got ${valueFor(
      'EXPO_PUBLIC_APP_ENV',
    )}`,
  );
}

const finalIdentityEnv = [
  {
    label: 'APP_DISPLAY_NAME or EXPO_PUBLIC_APP_DISPLAY_NAME',
    names: ['APP_DISPLAY_NAME', 'EXPO_PUBLIC_APP_DISPLAY_NAME'],
  },
  { label: 'APP_SLUG', names: ['APP_SLUG'] },
  {
    label: 'APP_SCHEME or EXPO_PUBLIC_APP_SCHEME',
    names: ['APP_SCHEME', 'EXPO_PUBLIC_APP_SCHEME'],
  },
  { label: 'APP_IOS_BUNDLE_IDENTIFIER', names: ['APP_IOS_BUNDLE_IDENTIFIER'] },
  ...(androidReleaseRequired
    ? [{ label: 'APP_ANDROID_PACKAGE', names: ['APP_ANDROID_PACKAGE'] }]
    : []),
];
const needsFinalNativeIdentity = [appVariant, appEnv].some((value) =>
  ['staging', 'production'].includes(value),
);
if (needsFinalNativeIdentity) {
  const missingFinalIdentity = finalIdentityEnv
    .filter(({ names }) => !isAnyUsable(names))
    .map(({ label }) => label);
  if (missingFinalIdentity.length > 0) {
    errors.push(
      `Staging/production identity: missing final native identity values: ${missingFinalIdentity.join(
        ', ',
      )}`,
    );
  }
}

const appleSiwaClientId = valueFor('APPLE_SIWA_CLIENT_ID');
const iosBundleIdentifier = valueFor('APP_IOS_BUNDLE_IDENTIFIER');
if (appleSiwaClientId && iosBundleIdentifier && appleSiwaClientId !== iosBundleIdentifier) {
  errors.push('APPLE_SIWA_CLIENT_ID must exactly match APP_IOS_BUNDLE_IDENTIFIER.');
}

const publicSecretKeys = Object.keys(process.env)
  .filter((name) => name.startsWith('EXPO_PUBLIC_'))
  .filter((name) => forbiddenPublicName.test(name));
if (publicSecretKeys.length > 0) {
  errors.push(`Secret-looking keys must not use EXPO_PUBLIC_: ${publicSecretKeys.join(', ')}`);
}
const publicSecretValues = Object.keys(process.env)
  .filter((name) => name.startsWith('EXPO_PUBLIC_'))
  .filter((name) => forbiddenPublicValue.test(valueFor(name)));
if (publicSecretValues.length > 0) {
  errors.push(`Secret-looking values must not use EXPO_PUBLIC_: ${publicSecretValues.join(', ')}`);
}

const displayName =
  valueFor('APP_DISPLAY_NAME') || valueFor('EXPO_PUBLIC_APP_DISPLAY_NAME') || 'RoutineKind';
if (
  (appVariant === 'production' || appEnv === 'production') &&
  /onskin/i.test(displayName) &&
  valueFor('BRAND_LEGAL_CLEARANCE') !== 'cleared'
) {
  errors.push('Production identity still uses OnSkin without BRAND_LEGAL_CLEARANCE=cleared.');
}

if (
  [appVariant, appEnv].some((value) => ['staging', 'production'].includes(value)) &&
  valueFor('BRAND_LEGAL_CLEARANCE') !== 'cleared'
) {
  errors.push('Staging/production infrastructure requires BRAND_LEGAL_CLEARANCE=cleared.');
}

if (
  [appVariant, appEnv].includes('production') &&
  valueFor('PHASE3_RELEASE_CLEARANCE') !== 'cleared'
) {
  errors.push(
    'Production infrastructure requires PHASE3_RELEASE_CLEARANCE=cleared after the signed Phase 3 review packet, detached item signoffs, and strict copy audit are complete.',
  );
}

if (valueFor('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY').startsWith('eyJ')) {
  warnings.push(
    'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY looks like a legacy anon JWT; use Supabase publishable keys.',
  );
}

if (valueFor('SUPABASE_SECRET_KEY').startsWith('eyJ')) {
  warnings.push(
    'SUPABASE_SECRET_KEY looks like a legacy service_role JWT; prefer Supabase secret keys.',
  );
}

if (!isIntegerInRange('USER_EDGE_BODY_MAX_BYTES', 1024, 65536)) {
  errors.push('USER_EDGE_BODY_MAX_BYTES must be an integer from 1024 to 65536.');
}

if (!isIntegerInRange('EDGE_EXTERNAL_FETCH_TIMEOUT_MS', 1000, 30000)) {
  errors.push('EDGE_EXTERNAL_FETCH_TIMEOUT_MS must be an integer from 1000 to 30000.');
}

if (!isIntegerInRange('EDGE_EXTERNAL_RESPONSE_MAX_BYTES', 1024, 1048576)) {
  errors.push('EDGE_EXTERNAL_RESPONSE_MAX_BYTES must be an integer from 1024 to 1048576.');
}

if (!isIntegerInRange('PUBLIC_FORMS_RATE_LIMIT_MAX', 1, 1000)) {
  errors.push('PUBLIC_FORMS_RATE_LIMIT_MAX must be an integer from 1 to 1000.');
}

if (!isIntegerInRange('PUBLIC_FORMS_RATE_LIMIT_WINDOW_SECONDS', 60, 86400)) {
  errors.push('PUBLIC_FORMS_RATE_LIMIT_WINDOW_SECONDS must be an integer from 60 to 86400.');
}

if (!isIntegerInRange('PUBLIC_FORMS_MAX_BYTES', 1024, 65536)) {
  errors.push('PUBLIC_FORMS_MAX_BYTES must be an integer from 1024 to 65536.');
}

for (const group of groups) {
  const required = group.required ?? group.anyOf;
  const expectedCount = group.required ? required.length : 1;
  const readyCount = group.required
    ? required.filter(isUsable).length
    : Number(isAnyUsable(required));
  console.log(
    `${readyCount === expectedCount ? 'OK ' : 'MISS'} ${group.name}: ${readyCount}/${expectedCount}`,
  );
}

for (const warning of warnings) console.warn(`WARN ${warning}`);
for (const error of errors) console.error(`FAIL ${error}`);
if (!androidReleaseRequired) {
  console.log('N/A Android release configuration and evidence: excluded by launch contract.');
}

if (errors.length > 0 && strict) process.exit(1);
if (errors.length > 0) {
  console.error(
    `\nPhase 2 env is incomplete (${errors.length} blocker${errors.length === 1 ? '' : 's'}). Run with --strict in CI.`,
  );
} else {
  console.log('\nPhase 2 env contract is complete.');
}
