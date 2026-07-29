#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, '..', '..');
const checkPath = resolve(scriptDir, 'check-growth-store-readiness.mjs');
const packetPath = resolve(scriptDir, 'build-growth-store-qa-packet.mjs');
const core07aContractPath = resolve(
  root,
  'scripts/core07/share-admission-source-contract.test.mjs',
);

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
  EXPO_PUBLIC_MARKETING_URL: 'https://routinekind.app',
  EXPO_PUBLIC_SUPPORT_EMAIL: 'support@routinekind.app',
  EXPO_PUBLIC_APP_STORE_URL: 'https://apps.apple.com/app/id123456789',
  EXPO_PUBLIC_PLAY_STORE_URL: 'https://play.google.com/store/apps/details?id=com.routinekind.app',
};

const validEvidence = {
  PHASE8_BRAND_SOURCE_OF_TRUTH_PASS: ' TRUE ',
  PHASE8_DOMAIN_DNS_PASS: 'true',
  PHASE8_IOS_UNIVERSAL_LINKS_PASS: 'True',
  PHASE8_ANDROID_APP_LINKS_PASS: ' true ',
  PHASE8_SHARE_CARD_DEVICE_QA_PASS: 'TRUE',
  PHASE8_ATTRIBUTION_PRIVACY_PASS: 'true',
  PHASE8_APP_STORE_PACKET_PASS: ' True ',
  PHASE8_PLAY_STORE_PACKET_PASS: 'true',
  PHASE8_CREATOR_COMPLIANCE_PASS: ' TRUE ',
  PHASE8_SUPPORT_RESPONSE_PASS: 'true',
  PHASE8_LAUNCH_DASHBOARD_READY: 'True',
  PHASE8_DRY_RUN_PASS: ' true ',
  PHASE8_SIGNED_OFF_BY: ' Tas Mohammed ',
  APPLE_TEAM_ID: 'abcde12345',
  ANDROID_CERT_SHA256_FINGERPRINTS:
    'aa:bb:cc:dd:ee:ff:00:11:22:33:44:55:66:77:88:99:aa:bb:cc:dd:ee:ff:00:11:22:33:44:55:66:77:88:99',
};

const core07aPacketBlockers = [
  'CORE-07A share publication is not admitted; no runtime flag, final domain, reviewedBy field, or QA flag can authorize export.',
  'CORE-07A public links are not admitted; the repository has no production token service or reviewed retention, revocation, deletion, and abuse contract.',
];

function hasCore07aPacketBlockers(packet) {
  return (
    packet?.status === 'blocked' &&
    core07aPacketBlockers.every((blocker) => packet.blockers.includes(blocker))
  );
}

function output(result) {
  return `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
}

function run(extraEnv) {
  return spawnSync(process.execPath, [checkPath], {
    cwd: root,
    encoding: 'utf8',
    env: { ...processBaseEnv, ...extraEnv },
  });
}

function runCore07aContract() {
  return spawnSync(process.execPath, ['--test', core07aContractPath], {
    cwd: root,
    encoding: 'utf8',
    env: processBaseEnv,
  });
}

function runPacket(extraEnv) {
  const outDir = mkdtempSync(join(tmpdir(), 'routinekind-phase8-packet-'));
  try {
    const result = spawnSync(process.execPath, [packetPath], {
      cwd: root,
      encoding: 'utf8',
      env: { ...processBaseEnv, PHASE8_PACKET_OUT_DIR: outDir, ...extraEnv },
    });
    const packet = JSON.parse(readFileSync(resolve(outDir, 'growth-store-qa-packet.json'), 'utf8'));
    return { ...result, packet };
  } finally {
    rmSync(outDir, { force: true, recursive: true });
  }
}

function runPacketWithDirtyWorktree(extraEnv) {
  const markerPath = join(root, `.phase8-smoke-dirty-${process.pid}.tmp`);
  writeFileSync(markerPath, 'temporary Phase 8 dirty-worktree smoke marker\n');
  try {
    return runPacket(extraEnv);
  } finally {
    rmSync(markerPath, { force: true });
  }
}

const cases = [
  {
    name: 'CORE-07A share admission remains literal-closed and side-effect free',
    result: runCore07aContract(),
    expect(result) {
      return result.status === 0;
    },
  },
  {
    name: 'Phase 8 accepts production public identity from process env',
    result: run(validPublicIdentity),
    expect(result) {
      const text = output(result);
      return (
        result.status === 0 &&
        !/Missing final brand domain/.test(text) &&
        !/Missing production marketing URL/.test(text) &&
        !/Missing production support email/.test(text) &&
        !/Missing App Store URL/.test(text) &&
        !/Missing Play Store URL/.test(text)
      );
    },
  },
  {
    name: 'Phase 8 rejects reserved final domains',
    result: run({
      ...validPublicIdentity,
      EXPO_PUBLIC_FINAL_BRAND_DOMAIN: 'routinekind.local',
    }),
    expect(result) {
      return result.status === 0 && /Missing final brand domain/.test(output(result));
    },
  },
  {
    name: 'Phase 8 rejects placeholder support emails',
    result: run({
      ...validPublicIdentity,
      EXPO_PUBLIC_SUPPORT_EMAIL: 'support@example.com',
    }),
    expect(result) {
      return result.status === 0 && /Missing production support email/.test(output(result));
    },
  },
  {
    name: 'Phase 8 rejects credentialed store URLs',
    result: run({
      ...validPublicIdentity,
      EXPO_PUBLIC_APP_STORE_URL: 'https://user:pass@apps.apple.com/app/id123456789',
    }),
    expect(result) {
      return result.status === 0 && /Missing App Store URL/.test(output(result));
    },
  },
  {
    name: 'Phase 8 accepts normalized external evidence and named signoff',
    result: run({ ...validPublicIdentity, ...validEvidence }),
    expect(result) {
      const text = output(result);
      return (
        result.status === 0 &&
        !/Missing external Phase 8 evidence: PHASE8_[A-Z0-9_]+=true/.test(text) &&
        !/Missing external Phase 8 evidence: PHASE8_SIGNED_OFF_BY/.test(text) &&
        !/Missing Apple Team ID evidence for AASA/.test(text) &&
        !/Missing Android release certificate fingerprint evidence/.test(text)
      );
    },
  },
  {
    name: 'Phase 8 rejects non-true external evidence flags',
    result: run({
      ...validPublicIdentity,
      ...validEvidence,
      PHASE8_DRY_RUN_PASS: 'done',
    }),
    expect(result) {
      return (
        result.status === 0 &&
        /Missing external Phase 8 evidence: PHASE8_DRY_RUN_PASS=true/.test(output(result))
      );
    },
  },
  {
    name: 'Phase 8 rejects placeholder signoffs',
    result: run({
      ...validPublicIdentity,
      ...validEvidence,
      PHASE8_SIGNED_OFF_BY: 'Tester Name',
    }),
    expect(result) {
      return (
        result.status === 0 &&
        /Missing external Phase 8 evidence: PHASE8_SIGNED_OFF_BY/.test(output(result))
      );
    },
  },
  {
    name: 'Phase 8 rejects placeholder Apple Team IDs',
    result: run({
      ...validPublicIdentity,
      ...validEvidence,
      APPLE_TEAM_ID: 'XXXXXXXXXX',
    }),
    expect(result) {
      return result.status === 0 && /Missing Apple Team ID evidence for AASA/.test(output(result));
    },
  },
  {
    name: 'Phase 8 marks Android store and link evidence not applicable',
    result: run({
      ...validPublicIdentity,
      ...validEvidence,
      EXPO_PUBLIC_PLAY_STORE_URL: '',
      PHASE8_ANDROID_APP_LINKS_PASS: '',
      PHASE8_PLAY_STORE_PACKET_PASS: '',
      ANDROID_CERT_SHA256_FINGERPRINTS: 'AA:BB',
    }),
    expect(result) {
      return (
        result.status === 0 &&
        /Android App Links, Play Store packet, URL, and certificate evidence: excluded by launch contract/.test(
          output(result),
        ) &&
        !/Missing Android release certificate fingerprint evidence/.test(output(result))
      );
    },
  },
  {
    name: 'Phase 8 packet writes normalized evidence and signoff',
    result: runPacket({ ...validPublicIdentity, ...validEvidence }),
    expect(result) {
      return (
        result.status === 1 &&
        hasCore07aPacketBlockers(result.packet) &&
        result.packet.evidence.brandSourceOfTruth === true &&
        result.packet.evidence.appleTeamId === true &&
        result.packet.evidence.androidAppLinks === null &&
        result.packet.evidence.playStorePacket === null &&
        result.packet.evidence.androidCertificateFingerprints === null &&
        result.packet.platformStatus.android === 'not_applicable' &&
        result.packet.evidence.signedOffBy === 'Tas Mohammed' &&
        /^[0-9a-f]{40}$/i.test(result.packet.gitSha) &&
        typeof result.packet.gitStatus === 'string' &&
        Boolean(result.packet.sourceHashes['.env.example']) &&
        Boolean(result.packet.sourceHashes['docs/hugeToDo/launch-contract.json']) &&
        Boolean(result.packet.sourceHashes['scripts/launch/contract.mjs']) &&
        Boolean(result.packet.sourceHashes['scripts/phase8/build-growth-store-qa-packet.mjs']) &&
        Boolean(result.packet.sourceHashes['scripts/phase8/check-growth-store-readiness.mjs']) &&
        Boolean(result.packet.sourceHashes['scripts/phase8/check-growth-store-smoke.mjs']) &&
        Boolean(result.packet.sourceHashes['docs/phase-8/store-metadata-source-of-truth.md']) &&
        Boolean(result.packet.sourceHashes['docs/phase-8/support-review-response-playbook.md']) &&
        Boolean(result.packet.sourceHashes['docs/phase-8/public-site/index.html']) &&
        Boolean(result.packet.sourceHashes['docs/HUMAN_SIMULATED_E2E_TESTING.md']) &&
        Boolean(result.packet.sourceHashes['docs/E2E_TESTING_CHECKLIST.md']) &&
        Boolean(result.packet.sourceHashes['docs/USER_FLOW_TREE.md']) &&
        Boolean(result.packet.sourceHashes['docs/e2e/generated/human-e2e-manifest.json']) &&
        Boolean(result.packet.sourceHashes['docs/e2e/generated/human-e2e-manifest.md']) &&
        Boolean(result.packet.sourceHashes['docs/phase-5/generated/device-qa-packet.json']) &&
        Boolean(result.packet.sourceHashes['docs/phase-5/generated/device-qa-packet.md']) &&
        Boolean(result.packet.sourceHashes['docs/phase-6/generated/payments-qa-packet.json']) &&
        Boolean(result.packet.sourceHashes['docs/phase-6/generated/payments-qa-packet.md']) &&
        Boolean(result.packet.sourceHashes['docs/phase-7/generated/core-loop-qa-packet.json']) &&
        Boolean(result.packet.sourceHashes['docs/phase-7/generated/core-loop-qa-packet.md']) &&
        Boolean(
          result.packet.sourceHashes[
            'docs/phase-8/public-site/.well-known/apple-app-site-association.template.json'
          ],
        ) &&
        Boolean(
          result.packet.sourceHashes[
            'docs/phase-8/public-site/.well-known/assetlinks.template.json'
          ],
        ) &&
        !result.packet.warnings.some((warning) => /signedOffBy/.test(warning))
      );
    },
  },
  {
    name: 'Phase 8 packet warns when generated from a dirty worktree',
    result: runPacketWithDirtyWorktree({ ...validPublicIdentity, ...validEvidence }),
    expect(result) {
      return (
        result.status === 1 &&
        hasCore07aPacketBlockers(result.packet) &&
        result.packet.gitStatus.includes(`.phase8-smoke-dirty-${process.pid}.tmp`) &&
        result.packet.warnings.includes(
          'Phase 8 QA packet generated with a dirty Git worktree; do not use it as final growth/store evidence.',
        )
      );
    },
  },
  {
    name: 'Phase 8 packet strips placeholder evidence',
    result: runPacket({
      ...validPublicIdentity,
      ...validEvidence,
      PHASE8_SIGNED_OFF_BY: 'tester@example.com',
      APPLE_TEAM_ID: 'TEAMID1234',
      ANDROID_CERT_SHA256_FINGERPRINTS:
        '00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00',
    }),
    expect(result) {
      return (
        result.status === 1 &&
        hasCore07aPacketBlockers(result.packet) &&
        result.packet.evidence.signedOffBy === '' &&
        result.packet.evidence.appleTeamId === false &&
        result.packet.evidence.androidCertificateFingerprints === null &&
        result.packet.warnings.includes('External evidence missing: signedOffBy.') &&
        result.packet.warnings.includes('External evidence missing: appleTeamId.') &&
        !result.packet.warnings.includes(
          'External evidence missing: androidCertificateFingerprints.',
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
