#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, '..', '..');
const phase10ReadinessPath = resolve(root, 'scripts/phase10/beta-readiness.mjs');
const phase10PacketPath = resolve(root, 'scripts/phase10/build-beta-packet.mjs');
const phase11ReadinessPath = resolve(root, 'scripts/phase11/launch-readiness.mjs');
const phase11PacketPath = resolve(root, 'scripts/phase11/build-launch-packet.mjs');

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

const publicContactEnv = {
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

const phase10EvidenceEnv = {
  PHASE10_PHASE9_BETA_CANDIDATE_PASS: 'true',
  PHASE10_BETA_IDENTITY_PASS: 'true',
  PHASE10_TESTFLIGHT_READY: 'true',
  PHASE10_PLAY_CLOSED_TEST_READY: 'true',
  PHASE10_PLAY_12_TESTERS_14_DAYS_SCHEDULED: 'true',
  PHASE10_RECRUITING_PASS: 'true',
  PHASE10_BETA_TERMS_PASS: 'true',
  PHASE10_DASHBOARDS_PASS: 'true',
  PHASE10_SUPPORT_DESK_PASS: 'true',
  PHASE10_PRIVACY_PAYLOAD_PASS: 'true',
  PHASE10_PAYMENT_QA_PASS: 'true',
  PHASE10_CATALOG_BETA_PASS: 'true',
  PHASE10_RETENTION_REPORT_PASS: 'true',
  PHASE10_PUBLIC_LAUNCH_DECISION: 'go',
  PHASE10_SIGNED_OFF_BY: 'Tas Mohammed',
};

const phase11EvidenceEnv = {
  PHASE11_PHASE10_EXIT_PASS: 'true',
  PHASE11_PHASE9_RC_SIGNOFF_PASS: 'true',
  PHASE11_STORE_APPROVAL_PASS: 'true',
  PHASE11_PRODUCTION_ENV_PASS: 'true',
  PHASE11_REVENUECAT_PROD_PASS: 'true',
  PHASE11_MONITORING_PASS: 'true',
  PHASE11_SUPPORT_READY: 'true',
  PHASE11_INCIDENT_ROLLBACK_PASS: 'true',
  PHASE11_RING0_PASS: 'true',
  PHASE11_RING1_72H_REPORT_PASS: 'true',
  PHASE11_ASO_REVIEW_PASS: 'true',
  PHASE11_CREATOR_DISCLOSURE_PASS: 'true',
  PHASE11_REVENUE_RECON_PASS: 'true',
  PHASE11_WEEK1_DECISION_PASS: 'true',
  PHASE11_SIGNED_OFF_BY: 'Tas Mohammed',
};

function run(scriptPath, extraEnv) {
  return spawnSync(process.execPath, [scriptPath], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...processBaseEnv,
      ...publicContactEnv,
      ...phase10EvidenceEnv,
      ...phase11EvidenceEnv,
      ...extraEnv,
    },
  });
}

function combinedOutput(result) {
  return `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
}

function runPacket(scriptPath, extraEnv, packetFileName, outDirEnvName) {
  const outDir = mkdtempSync(join(tmpdir(), 'layerwell-phase10-11-packet-'));
  const result = run(scriptPath, {
    ...extraEnv,
    [outDirEnvName]: outDir,
  });
  const packetPath = join(outDir, packetFileName);
  const packet = existsSync(packetPath) ? JSON.parse(readFileSync(packetPath, 'utf8')) : null;
  return { result, packet };
}

function hasNoFinalContactWarning(result, wording) {
  return result.status === 0 && !combinedOutput(result).includes(wording);
}

const cases = [
  {
    name: 'Phase 10 accepts production contact values without final identity warnings',
    result: run(phase10ReadinessPath, {}),
    expect(result) {
      return hasNoFinalContactWarning(result, 'final beta identity/policy value');
    },
  },
  {
    name: 'Phase 10 excludes Google Play beta evidence through the launch contract',
    packetCase: runPacket(
      phase10PacketPath,
      {
        PHASE10_PLAY_CLOSED_TEST_READY: '',
        PHASE10_PLAY_12_TESTERS_14_DAYS_SCHEDULED: '',
      },
      'closed-beta-packet.json',
      'PHASE10_PACKET_OUT_DIR',
    ),
    expectPacket({ result, packet }) {
      const text = combinedOutput(result);
      return (
        result.status === 0 &&
        packet?.platformStatus?.android === 'not_applicable' &&
        packet?.notApplicableEvidence?.PHASE10_PLAY_CLOSED_TEST_READY === 'not_applicable' &&
        packet?.notApplicableEvidence?.PHASE10_PLAY_12_TESTERS_14_DAYS_SCHEDULED ===
          'not_applicable' &&
        !text.includes('External closed beta evidence missing: PHASE10_PLAY')
      );
    },
  },
  {
    name: 'Phase 10 rejects reserved final brand domains',
    result: run(phase10ReadinessPath, {
      EXPO_PUBLIC_FINAL_BRAND_DOMAIN: 'layerwell.local',
    }),
    expect(result) {
      return (
        result.status === 0 &&
        combinedOutput(result).includes(
          'Missing or non-production final beta identity/policy value: EXPO_PUBLIC_FINAL_BRAND_DOMAIN.',
        )
      );
    },
  },
  {
    name: 'Phase 10 rejects credential-bearing policy URLs',
    result: run(phase10ReadinessPath, {
      EXPO_PUBLIC_PRIVACY_URL: 'https://user:pass@layerwell.app/privacy',
    }),
    expect(result) {
      return (
        result.status === 0 &&
        combinedOutput(result).includes(
          'Missing or non-production final beta identity/policy value: EXPO_PUBLIC_PRIVACY_URL.',
        )
      );
    },
  },
  {
    name: 'Phase 10 rejects local support email domains',
    result: run(phase10ReadinessPath, {
      EXPO_PUBLIC_SUPPORT_EMAIL: 'support@localhost',
    }),
    expect(result) {
      return (
        result.status === 0 &&
        combinedOutput(result).includes(
          'Missing or non-production final beta identity/policy value: EXPO_PUBLIC_SUPPORT_EMAIL.',
        )
      );
    },
  },
  {
    name: 'Phase 10 accepts trimmed evidence flags, launch decisions, and signoffs',
    result: run(phase10ReadinessPath, {
      PHASE10_PAYMENT_QA_PASS: ' TRUE ',
      PHASE10_PUBLIC_LAUNCH_DECISION: ' LIMITED ',
      PHASE10_SIGNED_OFF_BY: ' Tas Mohammed ',
    }),
    expect(result) {
      const text = combinedOutput(result);
      return (
        result.status === 0 &&
        !text.includes('Missing Phase 10 evidence: PHASE10_PAYMENT_QA_PASS=true.') &&
        !text.includes(
          'Missing Phase 10 public launch decision: PHASE10_PUBLIC_LAUNCH_DECISION=go or limited.',
        ) &&
        !text.includes('Missing Phase 10 named signoff: PHASE10_SIGNED_OFF_BY.')
      );
    },
  },
  {
    name: 'Phase 10 rejects non-true evidence flags',
    result: run(phase10ReadinessPath, {
      PHASE10_PAYMENT_QA_PASS: 'yes',
    }),
    expect(result) {
      return (
        result.status === 0 &&
        combinedOutput(result).includes('Missing Phase 10 evidence: PHASE10_PAYMENT_QA_PASS=true.')
      );
    },
  },
  {
    name: 'Phase 10 rejects generic signoff names',
    result: run(phase10ReadinessPath, {
      PHASE10_SIGNED_OFF_BY: 'Tester Name',
    }),
    expect(result) {
      return (
        result.status === 0 &&
        combinedOutput(result).includes('Missing Phase 10 named signoff: PHASE10_SIGNED_OFF_BY.')
      );
    },
  },
  {
    name: 'Phase 10 packet normalizes evidence and launch signoff values',
    packetCase: runPacket(
      phase10PacketPath,
      {
        PHASE10_PAYMENT_QA_PASS: ' TRUE ',
        PHASE10_PUBLIC_LAUNCH_DECISION: ' LIMITED ',
        PHASE10_SIGNED_OFF_BY: ' Tas Mohammed ',
      },
      'closed-beta-packet.json',
      'PHASE10_PACKET_OUT_DIR',
    ),
    expectPacket({ result, packet }) {
      return (
        result.status === 0 &&
        packet?.evidence?.PHASE10_PAYMENT_QA_PASS === true &&
        packet?.publicLaunchDecision === 'limited' &&
        packet?.signedOffBy === 'Tas Mohammed'
      );
    },
  },
  {
    name: 'Phase 10 packet strips placeholder signoffs from generated evidence',
    packetCase: runPacket(
      phase10PacketPath,
      { PHASE10_SIGNED_OFF_BY: 'Tester Name' },
      'closed-beta-packet.json',
      'PHASE10_PACKET_OUT_DIR',
    ),
    expectPacket({ result, packet }) {
      return result.status === 0 && packet?.signedOffBy === '';
    },
  },
  {
    name: 'Phase 11 accepts production contact values without final public warnings',
    result: run(phase11ReadinessPath, {}),
    expect(result) {
      return hasNoFinalContactWarning(result, 'final public launch value');
    },
  },
  {
    name: 'Phase 11 excludes Play Store URL through the launch contract',
    packetCase: runPacket(
      phase11PacketPath,
      { EXPO_PUBLIC_PLAY_STORE_URL: '' },
      'public-launch-packet.json',
      'PHASE11_PACKET_OUT_DIR',
    ),
    expectPacket({ result, packet }) {
      return (
        result.status === 0 &&
        packet?.platformStatus?.android === 'not_applicable' &&
        packet?.launchIdentity?.playStoreUrl === null
      );
    },
  },
  {
    name: 'Phase 11 rejects plaintext store URLs',
    result: run(phase11ReadinessPath, {
      EXPO_PUBLIC_APP_STORE_URL: 'http://apps.apple.com/app/id123456789',
    }),
    expect(result) {
      return (
        result.status === 0 &&
        combinedOutput(result).includes(
          'Missing or non-production final public launch value: EXPO_PUBLIC_APP_STORE_URL.',
        )
      );
    },
  },
  {
    name: 'Phase 11 rejects placeholder support email domains',
    result: run(phase11ReadinessPath, {
      EXPO_PUBLIC_SUPPORT_EMAIL: 'support@example.com',
    }),
    expect(result) {
      return (
        result.status === 0 &&
        combinedOutput(result).includes(
          'Missing or non-production final public launch value: EXPO_PUBLIC_SUPPORT_EMAIL.',
        )
      );
    },
  },
  {
    name: 'Phase 11 accepts trimmed evidence flags and signoffs',
    result: run(phase11ReadinessPath, {
      PHASE11_MONITORING_PASS: ' TRUE ',
      PHASE11_SIGNED_OFF_BY: ' Tas Mohammed ',
    }),
    expect(result) {
      const text = combinedOutput(result);
      return (
        result.status === 0 &&
        !text.includes('Missing Phase 11 evidence: PHASE11_MONITORING_PASS=true.') &&
        !text.includes('Missing Phase 11 named signoff: PHASE11_SIGNED_OFF_BY.')
      );
    },
  },
  {
    name: 'Phase 11 rejects non-true evidence flags',
    result: run(phase11ReadinessPath, {
      PHASE11_MONITORING_PASS: 'yes',
    }),
    expect(result) {
      return (
        result.status === 0 &&
        combinedOutput(result).includes('Missing Phase 11 evidence: PHASE11_MONITORING_PASS=true.')
      );
    },
  },
  {
    name: 'Phase 11 rejects placeholder signoffs',
    result: run(phase11ReadinessPath, {
      PHASE11_SIGNED_OFF_BY: 'TBD',
    }),
    expect(result) {
      return (
        result.status === 0 &&
        combinedOutput(result).includes('Missing Phase 11 named signoff: PHASE11_SIGNED_OFF_BY.')
      );
    },
  },
  {
    name: 'Phase 11 packet normalizes evidence and signoff values',
    packetCase: runPacket(
      phase11PacketPath,
      {
        PHASE11_MONITORING_PASS: ' TRUE ',
        PHASE11_SIGNED_OFF_BY: ' Tas Mohammed ',
      },
      'public-launch-packet.json',
      'PHASE11_PACKET_OUT_DIR',
    ),
    expectPacket({ result, packet }) {
      return (
        result.status === 0 &&
        packet?.evidence?.PHASE11_MONITORING_PASS === true &&
        packet?.signedOffBy === 'Tas Mohammed'
      );
    },
  },
  {
    name: 'Phase 11 packet strips placeholder signoffs from generated evidence',
    packetCase: runPacket(
      phase11PacketPath,
      { PHASE11_SIGNED_OFF_BY: 'TBD' },
      'public-launch-packet.json',
      'PHASE11_PACKET_OUT_DIR',
    ),
    expectPacket({ result, packet }) {
      return result.status === 0 && packet?.signedOffBy === '';
    },
  },
];

let failed = false;
for (const testCase of cases) {
  const passed = testCase.packetCase
    ? testCase.expectPacket(testCase.packetCase)
    : testCase.expect(testCase.result);
  if (passed) {
    console.log(`OK ${testCase.name}`);
    continue;
  }

  failed = true;
  console.error(`FAIL ${testCase.name}`);
  const output = combinedOutput(testCase.packetCase?.result ?? testCase.result).trim();
  if (output) console.error(output);
  if (testCase.packetCase?.packet)
    console.error(JSON.stringify(testCase.packetCase.packet, null, 2));
}

if (failed) process.exit(1);
