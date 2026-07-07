#!/usr/bin/env node
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const checkEnvPath = resolve(scriptDir, 'check-env.mjs');

const passthroughKeys = [
  'ComSpec',
  'HOME',
  'Path',
  'PATH',
  'PATHEXT',
  'SystemRoot',
  'TEMP',
  'TMP',
  'USERPROFILE',
  'WINDIR',
];

const processBaseEnv = Object.fromEntries(
  passthroughKeys
    .map((key) => [key, process.env[key]])
    .filter(([, value]) => typeof value === 'string' && value.length > 0),
);

const completeEnv = {
  APP_VARIANT: 'staging',
  EXPO_PUBLIC_APP_ENV: 'staging',
  BRAND_LEGAL_CLEARANCE: 'cleared',
  EXPO_PUBLIC_PRIVACY_URL: 'https://routinekind.app/privacy',
  EXPO_PUBLIC_TERMS_URL: 'https://routinekind.app/terms',
  EXPO_PUBLIC_SUPPORT_URL: 'https://routinekind.app/support',
  EXPO_PUBLIC_ACCOUNT_DELETION_URL: 'https://routinekind.app/account-deletion',
  EXPO_PUBLIC_DATA_EXPORT_URL: 'https://routinekind.app/data-export',
  EXPO_PUBLIC_CONSUMER_HEALTH_PRIVACY_URL: 'https://routinekind.app/consumer-health-privacy',
  SUPABASE_PROJECT_REF: 'routinekind-staging',
  EXPO_PUBLIC_SUPABASE_URL: 'https://routinekind.supabase.co',
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_livevalue',
  SUPABASE_SECRET_KEY: 'sb_secret_livevalue',
  USER_EDGE_BODY_MAX_BYTES: '16384',
  EDGE_EXTERNAL_FETCH_TIMEOUT_MS: '5000',
  EDGE_EXTERNAL_RESPONSE_MAX_BYTES: '262144',
  EXPO_PUBLIC_REVENUECAT_IOS_KEY: 'appl_livevalue',
  EXPO_PUBLIC_REVENUECAT_ANDROID_KEY: 'goog_livevalue',
  EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID: 'pro',
  EXPO_PUBLIC_REVENUECAT_ANNUAL_PRODUCT_ID: 'routinekind.pro.annual',
  EXPO_PUBLIC_REVENUECAT_MONTHLY_PRODUCT_ID: 'routinekind.pro.monthly',
  EXPO_PUBLIC_REVENUECAT_REVERSE_TRIAL_PRODUCT_ID: 'routinekind.pro.reverse_trial',
  REVENUECAT_WEBHOOK_AUTH: 'revenuecat-webhook-auth',
  EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: 'routinekind-ios.apps.googleusercontent.com',
  EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: 'routinekind-web.apps.googleusercontent.com',
  EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME: 'com.googleusercontent.apps.routinekind',
  APPLE_TEAM_ID: 'TEAMID1234',
  APPLE_SIWA_SERVICE_ID: 'com.routinekind.app.signin',
  APPLE_SIWA_KEY_ID: 'KEYID12345',
  APPLE_SIWA_PRIVATE_KEY: 'apple-siwa-key',
  EXPO_PUBLIC_POSTHOG_KEY: 'phc_livevalue',
  EXPO_PUBLIC_POSTHOG_HOST: 'https://us.i.posthog.com',
  POSTHOG_PERSONAL_API_KEY: 'phx_livevalue',
  EXPO_PUBLIC_SENTRY_DSN: 'https://abc@o123.ingest.sentry.io/123',
  SENTRY_AUTH_TOKEN: 'sntrys_livevalue',
  SENTRY_ORG: 'routinekind',
  SENTRY_PROJECT: 'routinekind',
  EXPO_PUBLIC_TURNSTILE_SITE_KEY: '0x4sitekey',
  TURNSTILE_SECRET_KEY: '0x4secretkey',
  PUBLIC_FORMS_RATE_LIMIT_MAX: '20',
  PUBLIC_FORMS_RATE_LIMIT_WINDOW_SECONDS: '900',
  PUBLIC_FORMS_MAX_BYTES: '8192',
  EXPO_PUBLIC_APP_DISPLAY_NAME: 'RoutineKind',
  APP_SLUG: 'routinekind',
  EXPO_PUBLIC_APP_SCHEME: 'routinekind',
  APP_IOS_BUNDLE_IDENTIFIER: 'com.routinekind.app',
  APP_ANDROID_PACKAGE: 'com.routinekind.app',
};

const finalIdentityKeys = [
  'APP_DISPLAY_NAME',
  'EXPO_PUBLIC_APP_DISPLAY_NAME',
  'APP_SLUG',
  'APP_SCHEME',
  'EXPO_PUBLIC_APP_SCHEME',
  'APP_IOS_BUNDLE_IDENTIFIER',
  'APP_ANDROID_PACKAGE',
];

function withoutKeys(env, keys) {
  const next = { ...env };
  for (const key of keys) delete next[key];
  return next;
}

function runCheck(extraEnv) {
  const cwd = mkdtempSync(join(tmpdir(), 'routinekind-phase2-check-env-'));
  try {
    return spawnSync(process.execPath, [checkEnvPath, '--strict'], {
      cwd,
      encoding: 'utf8',
      env: { ...processBaseEnv, ...extraEnv },
    });
  } finally {
    rmSync(cwd, { force: true, recursive: true });
  }
}

const cases = [
  {
    name: 'staging strict env passes when final native identity is explicit',
    result: runCheck(completeEnv),
    expect(result) {
      return result.status === 0 && /Phase 2 env contract is complete/.test(result.stdout);
    },
  },
  {
    name: 'staging strict env fails without final native identity',
    result: runCheck(withoutKeys(completeEnv, finalIdentityKeys)),
    expect(result) {
      return (
        result.status === 1 &&
        /Staging\/production identity: missing final native identity values/.test(result.stderr) &&
        /APP_IOS_BUNDLE_IDENTIFIER/.test(result.stderr) &&
        /APP_ANDROID_PACKAGE/.test(result.stderr)
      );
    },
  },
  {
    name: 'staging strict env normalizes case and whitespace before identity checks',
    result: runCheck(
      withoutKeys(
        {
          ...completeEnv,
          APP_VARIANT: ' Staging ',
          EXPO_PUBLIC_APP_ENV: ' STAGING ',
        },
        finalIdentityKeys,
      ),
    ),
    expect(result) {
      return (
        result.status === 1 &&
        /Staging\/production identity: missing final native identity values/.test(result.stderr) &&
        /APP_IOS_BUNDLE_IDENTIFIER/.test(result.stderr) &&
        /APP_ANDROID_PACKAGE/.test(result.stderr)
      );
    },
  },
  {
    name: 'development strict env does not require final native identity',
    result: runCheck({
      ...withoutKeys(completeEnv, finalIdentityKeys),
      APP_VARIANT: 'development',
      EXPO_PUBLIC_APP_ENV: 'development',
      BRAND_LEGAL_CLEARANCE: 'pending',
    }),
    expect(result) {
      return result.status === 0 && /Phase 2 env contract is complete/.test(result.stdout);
    },
  },
];

let failed = false;
for (const testCase of cases) {
  if (testCase.expect(testCase.result)) {
    console.log(`OK ${testCase.name}`);
    continue;
  }

  failed = true;
  console.error(`FAIL ${testCase.name}`);
  if (testCase.result.stdout) console.error(testCase.result.stdout.trim());
  if (testCase.result.stderr) console.error(testCase.result.stderr.trim());
}

if (failed) process.exit(1);
