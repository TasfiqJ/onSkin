#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, '..', '..');
const checkPath = resolve(scriptDir, 'check-core-loop.mjs');
const packetPath = resolve(scriptDir, 'build-core-loop-qa-packet.mjs');

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

const validPublicIdentity = {
  EXPO_PUBLIC_FINAL_BRAND_DOMAIN: 'routinekind.app',
  EXPO_PUBLIC_PRIVACY_URL: 'https://routinekind.app/privacy',
  EXPO_PUBLIC_TERMS_URL: 'https://routinekind.app/terms',
  EXPO_PUBLIC_SUPPORT_URL: 'https://routinekind.app/support',
  EXPO_PUBLIC_ACCOUNT_DELETION_URL: 'https://routinekind.app/account-deletion',
  EXPO_PUBLIC_DATA_EXPORT_URL: 'https://routinekind.app/data-export',
  EXPO_PUBLIC_CONSUMER_HEALTH_PRIVACY_URL: 'https://routinekind.app/consumer-health-privacy',
};

const validEvidence = {
  PHASE7_BRAND_READY: ' TRUE ',
  PHASE7_SUPABASE_RLS_PASS: 'true',
  PHASE7_CLINICAL_REVIEW_PASS: 'True',
  PHASE7_CATALOG_BETA_IMPORT_PASS: ' true ',
  PHASE7_DEVICE_QA_PASS: 'TRUE',
  PHASE7_REVENUECAT_QA_PASS: 'true',
  PHASE7_PRIVACY_EXPORT_DELETE_PASS: ' True ',
  PHASE7_BETA_DASHBOARD_READY: 'true',
  PHASE7_ONBOARDING_CONSENT_QA_PASS: 'true',
  PHASE7_SHELF_INTAKE_QA_PASS: 'true',
  PHASE7_REVIEWED_GUIDANCE_QA_PASS: 'true',
  PHASE7_ROUTINE_BUILDER_QA_PASS: 'true',
  PHASE7_TODAY_CHECKOFF_QA_PASS: 'true',
  PHASE7_PHOTOS_PRIVACY_QA_PASS: 'true',
  PHASE7_REMINDERS_QA_PASS: 'true',
  PHASE7_PAYMENTS_LIFECYCLE_QA_PASS: 'true',
  PHASE7_PRIVACY_CONTROLS_QA_PASS: 'true',
  PHASE7_SHARE_CARD_QA_PASS: 'true',
  PHASE7_DEFERRED_SURFACES_QA_PASS: 'true',
  PHASE7_ANALYTICS_QA_PASS: 'true',
  PHASE7_SIGNED_OFF_BY: ' Tas Mohammed ',
};

function output(result) {
  return `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
}

function run(extraEnv, args = []) {
  return spawnSync(process.execPath, [checkPath, ...args], {
    cwd: root,
    encoding: 'utf8',
    env: { ...processBaseEnv, ...extraEnv },
  });
}

function runPacket(extraEnv) {
  const outDir = mkdtempSync(join(tmpdir(), 'routinekind-phase7-packet-'));
  try {
    const result = spawnSync(process.execPath, [packetPath], {
      cwd: root,
      encoding: 'utf8',
      env: { ...processBaseEnv, PHASE7_PACKET_OUT_DIR: outDir, ...extraEnv },
    });
    const packet = JSON.parse(readFileSync(resolve(outDir, 'core-loop-qa-packet.json'), 'utf8'));
    return { ...result, packet };
  } finally {
    rmSync(outDir, { force: true, recursive: true });
  }
}

function runPacketWithDirtyWorktree(extraEnv) {
  const markerPath = join(root, `.phase7-smoke-dirty-${process.pid}.tmp`);
  writeFileSync(markerPath, 'temporary Phase 7 dirty-worktree smoke marker\n');
  try {
    return runPacket(extraEnv);
  } finally {
    rmSync(markerPath, { force: true });
  }
}

const cases = [
  {
    name: 'Phase 7 accepts production public identity from process env',
    result: run(validPublicIdentity),
    expect(result) {
      const text = output(result);
      return (
        result.status === 0 &&
        !/Missing final brand domain: EXPO_PUBLIC_FINAL_BRAND_DOMAIN/.test(text) &&
        !/EXPO_PUBLIC_(?:PRIVACY|TERMS|SUPPORT|ACCOUNT_DELETION|DATA_EXPORT|CONSUMER_HEALTH_PRIVACY)_URL must be a real production URL/.test(
          text,
        )
      );
    },
  },
  {
    name: 'Phase 7 rejects reserved final brand domains',
    result: run({
      ...validPublicIdentity,
      EXPO_PUBLIC_FINAL_BRAND_DOMAIN: 'https://routinekind.localhost',
    }),
    expect(result) {
      return (
        result.status === 0 &&
        /Missing final brand domain: EXPO_PUBLIC_FINAL_BRAND_DOMAIN/.test(output(result))
      );
    },
  },
  {
    name: 'Phase 7 rejects credentialed policy URLs',
    result: run({
      ...validPublicIdentity,
      EXPO_PUBLIC_SUPPORT_URL: 'https://user:pass@routinekind.app/support',
    }),
    expect(result) {
      return (
        result.status === 0 &&
        /EXPO_PUBLIC_SUPPORT_URL must be a real production URL/.test(output(result))
      );
    },
  },
  {
    name: 'Phase 7 rejects plaintext consumer health policy URLs',
    result: run({
      ...validPublicIdentity,
      EXPO_PUBLIC_CONSUMER_HEALTH_PRIVACY_URL: 'http://routinekind.app/consumer-health-privacy',
    }),
    expect(result) {
      return (
        result.status === 0 &&
        /EXPO_PUBLIC_CONSUMER_HEALTH_PRIVACY_URL must be a real production URL/.test(output(result))
      );
    },
  },
  {
    name: 'Phase 7 accepts normalized external evidence and named signoff',
    result: run({ ...validPublicIdentity, ...validEvidence }),
    expect(result) {
      const text = output(result);
      return (
        result.status === 0 &&
        !/Missing external Phase 7 evidence: PHASE7_[A-Z0-9_]+=true/.test(text) &&
        !/Missing external Phase 7 evidence: PHASE7_SIGNED_OFF_BY/.test(text)
      );
    },
  },
  {
    name: 'Phase 7 rejects non-true external evidence flags',
    result: run({
      ...validPublicIdentity,
      ...validEvidence,
      PHASE7_DEVICE_QA_PASS: 'yes',
    }),
    expect(result) {
      return (
        result.status === 0 &&
        /Missing external Phase 7 evidence: PHASE7_DEVICE_QA_PASS=true/.test(output(result))
      );
    },
  },
  {
    name: 'Phase 7 rejects placeholder signoffs',
    result: run({
      ...validPublicIdentity,
      ...validEvidence,
      PHASE7_SIGNED_OFF_BY: 'Tester Name',
    }),
    expect(result) {
      return (
        result.status === 0 &&
        /Missing external Phase 7 evidence: PHASE7_SIGNED_OFF_BY/.test(output(result))
      );
    },
  },
  {
    name: 'Phase 7 packet writes normalized evidence and signoff',
    result: runPacket({ ...validPublicIdentity, ...validEvidence }),
    expect(result) {
      return (
        result.status === 0 &&
        result.packet.evidence.brandReady === true &&
        result.packet.evidence.clinicalReviewPass === true &&
        result.packet.evidence.onboardingConsentQaPass === true &&
        result.packet.evidence.analyticsQaPass === true &&
        result.packet.evidence.signedOffBy === 'Tas Mohammed' &&
        /^[0-9a-f]{40}$/i.test(result.packet.gitSha) &&
        typeof result.packet.gitStatus === 'string' &&
        result.packet.files.some(
          (file) => file.path === 'scripts/phase7/build-core-loop-qa-packet.mjs',
        ) &&
        result.packet.files.some((file) => file.path === 'scripts/phase7/check-core-loop.mjs') &&
        result.packet.files.some(
          (file) => file.path === 'scripts/phase7/check-core-loop-smoke.mjs',
        ) &&
        result.packet.files.some((file) => file.path === 'scripts/e2e/human-e2e-manifest.mjs') &&
        result.packet.files.some(
          (file) => file.path === 'apps/mobile/src/app/cycle/settings.tsx',
        ) &&
        result.packet.files.some((file) => file.path === 'apps/mobile/src/app/cycle/week.tsx') &&
        result.packet.files.some(
          (file) => file.path === 'apps/mobile/src/app/cycle/why-tonight.tsx',
        ) &&
        result.packet.files.some((file) => file.path === 'apps/mobile/src/app/routine/plan.tsx') &&
        result.packet.files.some(
          (file) => file.path === 'apps/mobile/src/features/scheduler/customCycle.ts',
        ) &&
        result.packet.files.some(
          (file) => file.path === 'apps/mobile/src/features/scheduler/cycleStore.ts',
        ) &&
        result.packet.files.some((file) => file.path === 'docs/HUMAN_SIMULATED_E2E_TESTING.md') &&
        result.packet.files.some((file) => file.path === 'docs/E2E_TESTING_CHECKLIST.md') &&
        result.packet.files.some((file) => file.path === 'docs/USER_FLOW_TREE.md') &&
        result.packet.files.some(
          (file) => file.path === 'docs/e2e/generated/human-e2e-manifest.json',
        ) &&
        result.packet.files.some(
          (file) => file.path === 'docs/e2e/generated/human-e2e-manifest.md',
        ) &&
        result.packet.files.some(
          (file) => file.path === 'docs/phase-5/generated/device-qa-packet.json',
        ) &&
        result.packet.files.some(
          (file) => file.path === 'docs/phase-5/generated/device-qa-packet.md',
        ) &&
        result.packet.files.some(
          (file) => file.path === 'docs/phase-6/generated/payments-qa-packet.json',
        ) &&
        result.packet.files.some(
          (file) => file.path === 'docs/phase-6/generated/payments-qa-packet.md',
        ) &&
        result.packet.scenarios.every((scenario) => scenario.evidencePass === true) &&
        !result.packet.blockers.some((blocker) => /PHASE7_SIGNED_OFF_BY/.test(blocker))
      );
    },
  },
  {
    name: 'Phase 7 packet warns when generated from a dirty worktree',
    result: runPacketWithDirtyWorktree({ ...validPublicIdentity, ...validEvidence }),
    expect(result) {
      return (
        result.status === 0 &&
        result.packet.gitStatus.includes(`.phase7-smoke-dirty-${process.pid}.tmp`) &&
        result.packet.warnings.includes(
          'Phase 7 core-loop QA packet generated with a dirty Git worktree; do not use it as final core-loop evidence.',
        )
      );
    },
  },
  {
    name: 'Phase 7 packet strips placeholder signoffs',
    result: runPacket({
      ...validPublicIdentity,
      ...validEvidence,
      PHASE7_SIGNED_OFF_BY: 'tester@example.com',
    }),
    expect(result) {
      return (
        result.status === 0 &&
        result.packet.evidence.signedOffBy === '' &&
        result.packet.blockers.includes('Missing PHASE7_SIGNED_OFF_BY.')
      );
    },
  },
  {
    name: 'Phase 7 packet blocks non-true evidence flags',
    result: runPacket({
      ...validPublicIdentity,
      ...validEvidence,
      PHASE7_TODAY_CHECKOFF_QA_PASS: 'complete',
    }),
    expect(result) {
      return (
        result.status === 0 &&
        result.packet.evidence.todayCheckoffQaPass === false &&
        result.packet.scenarios.some(
          (scenario) =>
            scenario.envKey === 'PHASE7_TODAY_CHECKOFF_QA_PASS' && scenario.evidencePass === false,
        ) &&
        result.packet.blockers.includes('Missing todayCheckoffQaPass evidence.')
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
