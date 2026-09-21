#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { cpSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, '..', '..');
const releaseSmokePath = resolve(scriptDir, 'release-smoke.mjs');

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

const finalContactEnv = {
  EXPO_PUBLIC_PRIVACY_URL: 'https://layerwell.app/privacy',
  EXPO_PUBLIC_TERMS_URL: 'https://layerwell.app/terms',
  EXPO_PUBLIC_SUPPORT_URL: 'https://layerwell.app/support',
  EXPO_PUBLIC_ACCOUNT_DELETION_URL: 'https://layerwell.app/account-deletion',
  EXPO_PUBLIC_DATA_EXPORT_URL: 'https://layerwell.app/data-export',
  EXPO_PUBLIC_CONSUMER_HEALTH_PRIVACY_URL: 'https://layerwell.app/consumer-health-privacy',
  EXPO_PUBLIC_FINAL_BRAND_DOMAIN: 'layerwell.app',
  EXPO_PUBLIC_MARKETING_URL: 'https://layerwell.app',
  EXPO_PUBLIC_SUPPORT_EMAIL: 'support@layerwell.app',
  EXPO_PUBLIC_APP_STORE_URL: 'https://apps.apple.com/app/id123456789',
  EXPO_PUBLIC_PLAY_STORE_URL: 'https://play.google.com/store/apps/details?id=com.layerwell.app',
};

const validPhase7ShareEvidence = {
  PHASE7_BRAND_READY: ' TRUE ',
  PHASE7_CLINICAL_REVIEW_PASS: 'true',
  PHASE7_DEVICE_QA_PASS: ' True ',
  PHASE7_SIGNED_OFF_BY: ' Tas Mohammed ',
};

const validPosthogEnv = {
  EXPO_PUBLIC_POSTHOG_KEY: 'phc_livevalue',
  EXPO_PUBLIC_POSTHOG_HOST: 'https://eu.i.posthog.com',
  POSTHOG_PERSONAL_API_KEY: 'phx_livevalue',
  POSTHOG_PROJECT_ID: '12345',
  POSTHOG_API_HOST: 'https://eu.posthog.com',
};

function run(extraEnv) {
  return spawnSync(process.execPath, [releaseSmokePath], {
    cwd: root,
    encoding: 'utf8',
    env: { ...processBaseEnv, ...finalContactEnv, ...extraEnv },
  });
}

function output(result) {
  return `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
}

const missingCat07EvidenceBlocker =
  'FAIL test-results/human-e2e/2026-08-08/cat07-shelf-freshness-current/summary.json is missing.';

function contactChecksHaveNoUnexpectedBlockers(result) {
  const text = output(result);
  const blockers = text.split(/\r?\n/u).filter((line) => line.startsWith('FAIL '));
  if (result.status === 0) return blockers.length === 0;
  return (
    result.status === 1 &&
    blockers.length === 1 &&
    blockers[0] === missingCat07EvidenceBlocker &&
    text.includes('Phase 9 release smoke has 1 blocker.')
  );
}

function runWithTemplateReleaseCandidate(extraEnv = {}) {
  const rcName = `rc-smoke-template-${process.pid}`;
  const rcRelativeDir = `docs/phase-9/release-candidates/${rcName}`;
  const rcDir = resolve(root, rcRelativeDir);
  rmSync(rcDir, { recursive: true, force: true });
  cpSync(resolve(root, 'docs/phase-9/release-candidates/_template'), rcDir, {
    recursive: true,
  });
  try {
    return run({
      PHASE9_FINAL_IDENTITY_PASS: 'true',
      PHASE9_RELEASE_CANDIDATE_DIR: rcRelativeDir,
      ...extraEnv,
    });
  } finally {
    rmSync(rcDir, { recursive: true, force: true });
  }
}

const cases = [
  {
    name: 'Phase 9 accepts production final contacts without final-value warnings',
    result: run({}),
    expect(result) {
      return (
        contactChecksHaveNoUnexpectedBlockers(result) &&
        !output(result).includes('Missing or non-production final value')
      );
    },
  },
  {
    name: 'Phase 9 requires an explicit Apple revocation client ID',
    result: run({ APPLE_SIWA_CLIENT_ID: '' }),
    expect(result) {
      return (
        result.status === 1 &&
        output(result).includes(
          'APPLE_SIWA_CLIENT_ID must be explicitly configured for Apple credential revocation.',
        )
      );
    },
  },
  {
    name: 'Phase 9 requires the Apple revocation client ID to match the iOS bundle',
    result: run({
      APP_IOS_BUNDLE_IDENTIFIER: 'com.layerwell.app',
      APPLE_SIWA_CLIENT_ID: 'com.layerwell.other',
    }),
    expect(result) {
      return (
        result.status === 1 &&
        output(result).includes(
          'APPLE_SIWA_CLIENT_ID must exactly match APP_IOS_BUNDLE_IDENTIFIER.',
        )
      );
    },
  },
  {
    name: 'Phase 9 accepts the exact paired EU PostHog configuration',
    result: run(validPosthogEnv),
    expect(result) {
      const text = output(result);
      return (
        contactChecksHaveNoUnexpectedBlockers(result) &&
        !text.includes('is required when EXPO_PUBLIC_POSTHOG_KEY enables PostHog') &&
        !text.includes('must equal https://eu.i.posthog.com when PostHog is enabled') &&
        !text.includes('must equal https://eu.posthog.com when PostHog is enabled')
      );
    },
  },
  {
    name: 'Phase 9 requires PostHog server deletion credentials when mobile analytics is enabled',
    result: run({
      ...validPosthogEnv,
      POSTHOG_PROJECT_ID: '',
      POSTHOG_PERSONAL_API_KEY: '',
    }),
    expect(result) {
      const text = output(result);
      return (
        result.status === 1 &&
        text.includes(
          'POSTHOG_PROJECT_ID is required when EXPO_PUBLIC_POSTHOG_KEY enables PostHog.',
        ) &&
        text.includes(
          'POSTHOG_PERSONAL_API_KEY is required when EXPO_PUBLIC_POSTHOG_KEY enables PostHog.',
        )
      );
    },
  },
  {
    name: 'Phase 9 rejects a mismatched PostHog mobile ingest region',
    result: run({
      ...validPosthogEnv,
      EXPO_PUBLIC_POSTHOG_HOST: 'https://us.i.posthog.com',
    }),
    expect(result) {
      return (
        result.status === 1 &&
        output(result).includes(
          'EXPO_PUBLIC_POSTHOG_HOST must equal https://eu.i.posthog.com when PostHog is enabled.',
        )
      );
    },
  },
  {
    name: 'Phase 9 rejects a mismatched PostHog server API region',
    result: run({
      ...validPosthogEnv,
      POSTHOG_API_HOST: 'https://us.posthog.com',
    }),
    expect(result) {
      return (
        result.status === 1 &&
        output(result).includes(
          'POSTHOG_API_HOST must equal https://eu.posthog.com when PostHog is enabled.',
        )
      );
    },
  },
  {
    name: 'Phase 9 marks Android and Play release evidence not applicable',
    result: run({ EXPO_PUBLIC_PLAY_STORE_URL: '' }),
    expect(result) {
      const text = output(result);
      return (
        contactChecksHaveNoUnexpectedBlockers(result) &&
        text.includes(
          'Android build, Play testing, Play packet, and Play Store URL evidence: excluded by launch contract.',
        ) &&
        !text.includes('EXPO_PUBLIC_PLAY_STORE_URL') &&
        !text.includes('PHASE9_ANDROID_CLOSED_TEST_PASS') &&
        !text.includes('PHASE9_PLAY_PACKET_PASS')
      );
    },
  },
  {
    name: 'Phase 9 rejects credential-bearing final policy URLs',
    result: run({ EXPO_PUBLIC_PRIVACY_URL: 'https://user:pass@layerwell.app/privacy' }),
    expect(result) {
      return (
        contactChecksHaveNoUnexpectedBlockers(result) &&
        output(result).includes(
          'Missing or non-production final value for EXPO_PUBLIC_PRIVACY_URL.',
        )
      );
    },
  },
  {
    name: 'Phase 9 rejects reserved final domains',
    result: run({ EXPO_PUBLIC_FINAL_BRAND_DOMAIN: 'layerwell.local' }),
    expect(result) {
      return (
        contactChecksHaveNoUnexpectedBlockers(result) &&
        output(result).includes(
          'Missing or non-production final value for EXPO_PUBLIC_FINAL_BRAND_DOMAIN.',
        )
      );
    },
  },
  {
    name: 'Phase 9 rejects placeholder support email domains',
    result: run({ EXPO_PUBLIC_SUPPORT_EMAIL: 'support@example.com' }),
    expect(result) {
      return (
        contactChecksHaveNoUnexpectedBlockers(result) &&
        output(result).includes(
          'Missing or non-production final value for EXPO_PUBLIC_SUPPORT_EMAIL.',
        )
      );
    },
  },
  {
    name: 'Phase 9 blocks production deferred surfaces before final domain readiness',
    result: run({
      EXPO_PUBLIC_APP_ENV: 'production',
      EXPO_PUBLIC_FINAL_BRAND_DOMAIN: 'layerwell.local',
      EXPO_PUBLIC_PHASE7_SHARE_CARD_ENABLED: 'true',
    }),
    expect(result) {
      return (
        result.status === 1 &&
        output(result).includes(
          'Production Share cards cannot be enabled before EXPO_PUBLIC_FINAL_BRAND_DOMAIN is final.',
        )
      );
    },
  },
  {
    name: 'Phase 9 accepts normalized Phase 7 production surface evidence',
    result: run({
      ...validPhase7ShareEvidence,
      EXPO_PUBLIC_APP_ENV: 'production',
      EXPO_PUBLIC_PHASE7_SHARE_CARD_ENABLED: ' TRUE ',
    }),
    expect(result) {
      const text = output(result);
      return (
        contactChecksHaveNoUnexpectedBlockers(result) &&
        !text.includes('Production Share cards requires PHASE7_BRAND_READY=true.') &&
        !text.includes('Production Share cards requires PHASE7_CLINICAL_REVIEW_PASS=true.') &&
        !text.includes('Production Share cards requires PHASE7_DEVICE_QA_PASS=true.') &&
        !text.includes('Production Share cards requires PHASE7_SIGNED_OFF_BY.')
      );
    },
  },
  {
    name: 'Phase 9 blocks placeholder Phase 7 production surface signoffs',
    result: run({
      ...validPhase7ShareEvidence,
      EXPO_PUBLIC_APP_ENV: 'production',
      EXPO_PUBLIC_PHASE7_SHARE_CARD_ENABLED: 'true',
      PHASE7_SIGNED_OFF_BY: 'Tester Name',
    }),
    expect(result) {
      return (
        result.status === 1 &&
        output(result).includes('Production Share cards requires PHASE7_SIGNED_OFF_BY.')
      );
    },
  },
  {
    name: 'Phase 9 blocks uncustomized release-candidate template files',
    result: runWithTemplateReleaseCandidate(),
    expect(result) {
      const text = output(result);
      return (
        result.status === 1 &&
        text.includes(
          'docs/phase-9/release-candidates/rc-smoke-template-' +
            process.pid +
            '/manual-qa-matrix.md must not contain unresolved placeholders when Phase 9 evidence is claimed.',
        ) &&
        text.includes(
          'docs/phase-9/release-candidates/rc-smoke-template-' +
            process.pid +
            '/rollout-plan.md must not contain unresolved placeholders when Phase 9 evidence is claimed.',
        ) &&
        text.includes(
          'docs/phase-9/release-candidates/rc-smoke-template-' +
            process.pid +
            '/incident-plan.md must be customized from the RC template when Phase 9 evidence is claimed.',
        )
      );
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
  const text = output(testCase.result).trim();
  if (text) console.error(text);
}

if (failed) process.exit(1);
