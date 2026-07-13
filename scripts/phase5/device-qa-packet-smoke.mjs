#!/usr/bin/env node
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, '..', '..');
const packetPath = resolve(scriptDir, 'build-device-qa-packet.mjs');

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

const validEvidence = {
  PHASE5_IOS_BUILD_ID: '9f7b48e1-7a52-4efb-9d93-3e93a2bf13e5',
  PHASE5_ANDROID_BUILD_ID:
    'https://expo.dev/accounts/routinekind/projects/mobile/builds/7a4d74ae-2acd-4af5-931f-b768565bcd64',
  PHASE5_IOS_DEVICE: 'iPhone 15 Pro / iOS 18.5',
  PHASE5_ANDROID_DEVICE: 'Pixel 8 / Android 15',
  PHASE5_QA_SIGNOFF: 'true',
  PHASE5_SIGNED_OFF_BY: 'Tas Mohammed',
  PHASE5_DEVICE_QA_PASS: 'true',
  PHASE5_INSTALL_QA_PASS: 'true',
  PHASE5_CAMERA_PERMISSION_QA_PASS: 'true',
  PHASE5_BARCODE_QA_PASS: 'true',
  PHASE5_LABEL_CAPTURE_QA_PASS: 'true',
  PHASE5_PROGRESS_PHOTO_QA_PASS: 'true',
  PHASE5_ENCRYPTED_PHOTO_STORAGE_QA_PASS: 'true',
  PHASE5_NOTIFICATION_QA_PASS: 'true',
  PHASE5_SHARE_SHEET_QA_PASS: 'true',
  PHASE5_REVENUECAT_NATIVE_QA_PASS: 'true',
  PHASE5_SENTRY_NATIVE_QA_PASS: 'true',
  PHASE5_SUPABASE_CATALOG_NATIVE_QA_PASS: 'true',
  PHASE5_ACCESSIBILITY_QA_PASS: 'true',
  PHASE5_NATIVE_OCR_QA_PASS: 'false',
};

function run(extraEnv) {
  const outDir = mkdtempSync(join(tmpdir(), 'routinekind-phase5-qa-'));
  const result = spawnSync(process.execPath, [packetPath, '--strict'], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...processBaseEnv,
      ...validEvidence,
      ...extraEnv,
      PHASE5_QA_PACKET_OUT_DIR: outDir,
    },
  });
  result.outDir = outDir;
  return result;
}

function runWithDirtyWorktree(extraEnv) {
  const markerPath = join(root, `.phase5-smoke-dirty-${process.pid}.tmp`);
  writeFileSync(markerPath, 'temporary Phase 5 dirty-worktree smoke marker\n');
  try {
    return run(extraEnv);
  } finally {
    rmSync(markerPath, { force: true });
  }
}

function output(result) {
  return `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
}

const cases = [
  {
    name: 'strict Phase 5 QA packet accepts real-looking EAS and device evidence',
    result: run({}),
    expect(result) {
      const text = output(result);
      return result.status === 0 && /device-qa-packet\.json/.test(text) && !/^FAIL /m.test(text);
    },
  },
  {
    name: 'strict Phase 5 QA packet rejects missing granular evidence flags',
    result: run({ PHASE5_BARCODE_QA_PASS: 'yes' }),
    expect(result) {
      return (
        result.status === 1 &&
        /Missing PHASE5_BARCODE_QA_PASS=true \(physical-device barcode scan and checksum matrix\)/.test(
          output(result),
        )
      );
    },
  },
  {
    name: 'strict Phase 5 QA packet requires native OCR evidence only when OCR is enabled',
    result: run({ EXPO_PUBLIC_NATIVE_OCR_ENABLED: 'true', PHASE5_NATIVE_OCR_QA_PASS: 'false' }),
    expect(result) {
      return (
        result.status === 1 &&
        /Missing PHASE5_NATIVE_OCR_QA_PASS=true \(native OCR real-label text recognition\)/.test(
          output(result),
        )
      );
    },
  },
  {
    name: 'strict Phase 5 QA packet accepts native OCR evidence when OCR is enabled',
    result: run({ EXPO_PUBLIC_NATIVE_OCR_ENABLED: 'true', PHASE5_NATIVE_OCR_QA_PASS: ' TRUE ' }),
    expect(result) {
      return result.status === 0 && !/^FAIL /m.test(output(result));
    },
  },
  {
    name: 'strict Phase 5 QA packet rejects placeholder iOS build evidence',
    result: run({ PHASE5_IOS_BUILD_ID: 'pending-ios-build' }),
    expect(result) {
      return (
        result.status === 1 &&
        /PHASE5_IOS_BUILD_ID must be a real EAS build UUID or expo\.dev build URL/.test(
          output(result),
        )
      );
    },
  },
  {
    name: 'strict Phase 5 QA packet rejects generic iOS device labels',
    result: run({ PHASE5_IOS_DEVICE: 'iPhone model / iOS version' }),
    expect(result) {
      return (
        result.status === 1 &&
        /PHASE5_IOS_DEVICE must name a physical iPhone model and iOS version/.test(output(result))
      );
    },
  },
  {
    name: 'strict Phase 5 QA packet rejects iOS labels without a physical model',
    result: run({ PHASE5_IOS_DEVICE: 'iPhone / iOS 18.5' }),
    expect(result) {
      return (
        result.status === 1 &&
        /PHASE5_IOS_DEVICE must name a physical iPhone model and iOS version/.test(output(result))
      );
    },
  },
  {
    name: 'strict Phase 5 QA packet rejects iPad evidence outside the iPhone-only contract',
    result: run({ PHASE5_IOS_DEVICE: 'iPad Pro / iPadOS 26.0' }),
    expect(result) {
      return (
        result.status === 1 && /iPad is outside the active release contract/.test(output(result))
      );
    },
  },
  {
    name: 'strict Phase 5 QA packet marks Android build and device evidence not applicable',
    result: run({ PHASE5_ANDROID_BUILD_ID: '', PHASE5_ANDROID_DEVICE: '' }),
    expect(result) {
      if (result.status !== 0) return false;
      const packet = JSON.parse(readFileSync(join(result.outDir, 'device-qa-packet.json'), 'utf8'));
      return (
        packet.buildEvidence.platformStatus.ios === 'required' &&
        packet.buildEvidence.platformStatus.android === 'not_applicable' &&
        packet.buildEvidence.androidBuildId === null &&
        packet.buildEvidence.androidDevice === null
      );
    },
  },
  {
    name: 'strict Phase 5 QA packet rejects placeholder signoff names',
    result: run({ PHASE5_SIGNED_OFF_BY: 'name' }),
    expect(result) {
      return (
        result.status === 1 &&
        /PHASE5_SIGNED_OFF_BY must name a real tester\/reviewer, not a placeholder/.test(
          output(result),
        )
      );
    },
  },
  {
    name: 'strict Phase 5 QA packet rejects generic tester-name signoffs',
    result: run({ PHASE5_SIGNED_OFF_BY: 'Tester Name' }),
    expect(result) {
      return (
        result.status === 1 &&
        /PHASE5_SIGNED_OFF_BY must name a real tester\/reviewer, not a placeholder/.test(
          output(result),
        )
      );
    },
  },
  {
    name: 'strict Phase 5 QA packet accepts case-insensitive signoff truth',
    result: run({ PHASE5_QA_SIGNOFF: ' TRUE ' }),
    expect(result) {
      const text = output(result);
      return result.status === 0 && /device-qa-packet\.json/.test(text) && !/^FAIL /m.test(text);
    },
  },
  {
    name: 'strict Phase 5 QA packet normalizes named signoff output',
    result: run({ PHASE5_SIGNED_OFF_BY: ' Tas Mohammed ' }),
    expect(result) {
      if (result.status !== 0) return false;
      const packet = JSON.parse(readFileSync(join(result.outDir, 'device-qa-packet.json'), 'utf8'));
      return (
        packet.buildEvidence.signedOffBy === 'Tas Mohammed' &&
        /^[0-9a-f]{40}$/i.test(packet.gitSha) &&
        typeof packet.gitStatus === 'string' &&
        Array.isArray(packet.warnings) &&
        packet.files.some((file) => file.path === 'scripts/phase5/build-device-qa-packet.mjs') &&
        packet.files.some((file) => file.path === 'scripts/phase5/check-native-config.mjs') &&
        packet.files.some(
          (file) => file.path === 'scripts/phase5/check-performance-evidence.mjs',
        ) &&
        packet.files.some((file) => file.path === 'scripts/phase5/device-qa-packet-smoke.mjs') &&
        packet.files.some(
          (file) => file.path === 'scripts/phase5/performance-evidence-contract.mjs',
        ) &&
        packet.files.some(
          (file) => file.path === 'scripts/phase5/performance-evidence-smoke.mjs',
        ) &&
        packet.files.some((file) => file.path === 'docs/hugeToDo/launch-contract.json') &&
        packet.files.some((file) => file.path === 'scripts/launch/contract.mjs') &&
        packet.files.some((file) => file.path === 'scripts/e2e/human-e2e-manifest.mjs') &&
        packet.files.some(
          (file) => file.path === 'apps/mobile/plugins/withPrivateStorageProtection.js',
        ) &&
        packet.files.some(
          (file) => file.path === 'apps/mobile/plugins/android/private_data_backup_rules.xml',
        ) &&
        packet.files.some(
          (file) => file.path === 'apps/mobile/plugins/android/private_data_extraction_rules.xml',
        ) &&
        packet.files.some(
          (file) => file.path === 'apps/mobile/src/lib/nativeDataProtectionIntrospection.test.ts',
        ) &&
        packet.files.some(
          (file) => file.path === 'apps/mobile/src/lib/storage/privateSecureStore.ts',
        ) &&
        packet.files.some((file) => file.path === 'apps/mobile/src/app/_layout.tsx') &&
        packet.files.some((file) => file.path === 'apps/mobile/src/app/(tabs)/progress.tsx') &&
        packet.files.some((file) => file.path === 'apps/mobile/src/app/(tabs)/shelf.tsx') &&
        packet.files.some((file) => file.path === 'apps/mobile/src/app/(tabs)/you.tsx') &&
        packet.files.some((file) => file.path === 'apps/mobile/src/features/shelf/freshness.ts') &&
        packet.files.some(
          (file) =>
            file.path === 'supabase/migrations/20260711000038_shelf_freshness_invariants.sql',
        ) &&
        packet.files.some(
          (file) =>
            file.path === 'supabase/migrations/20260711000039_replenishment_alert_opt_in.sql',
        ) &&
        packet.files.some((file) => file.path === 'apps/mobile/src/features/photos/consent.ts') &&
        packet.files.some((file) => file.path === 'docs/HUMAN_SIMULATED_E2E_TESTING.md') &&
        packet.files.some((file) => file.path === 'docs/E2E_TESTING_CHECKLIST.md') &&
        packet.files.some((file) => file.path === 'docs/USER_FLOW_TREE.md') &&
        packet.files.some((file) => file.path === 'docs/phase-5/performance-evidence-runbook.md') &&
        packet.files.some(
          (file) => file.path === 'docs/phase-5/performance-evidence.template.json',
        ) &&
        packet.files.some((file) => file.path === 'docs/e2e/generated/human-e2e-manifest.json') &&
        packet.files.some((file) => file.path === 'docs/e2e/generated/human-e2e-manifest.md')
      );
    },
  },
  {
    name: 'strict Phase 5 QA packet warns when generated from a dirty worktree',
    result: runWithDirtyWorktree({}),
    expect(result) {
      if (result.status !== 0) return false;
      const packet = JSON.parse(readFileSync(join(result.outDir, 'device-qa-packet.json'), 'utf8'));
      return (
        packet.gitStatus.includes(`.phase5-smoke-dirty-${process.pid}.tmp`) &&
        packet.warnings.includes(
          'Phase 5 device QA packet generated with a dirty Git worktree; do not use it as final native-device evidence.',
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
