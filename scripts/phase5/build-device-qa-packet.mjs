#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import {
  command,
  evidenceFlagEnabled,
  gitStatusExcludingGeneratedEvidence,
  normalizeNamedSignoff,
  placeholderEnvValue,
} from '../phase9/lib.mjs';
import {
  isReleasePlatformRequired,
  launchContractSnapshot,
  loadLaunchContract,
  platformRequirementStatus,
} from '../launch/contract.mjs';

const strict = process.argv.includes('--strict');
const root = process.cwd();
const launchContract = loadLaunchContract(root);
const androidReleaseRequired = isReleasePlatformRequired('android', launchContract);
const packetOutDir = process.env.PHASE5_QA_PACKET_OUT_DIR ?? 'docs/phase-5/generated';
const outDir = resolve(root, packetOutDir);
const packetOutputPaths = [
  `${packetOutDir}/device-qa-packet.json`,
  `${packetOutDir}/device-qa-packet.md`,
].map((path) => path.replace(/\\/g, '/'));

const requiredFiles = [
  'package.json',
  'docs/hugeToDo/launch-contract.json',
  'scripts/launch/contract.mjs',
  'apps/mobile/app.base.json',
  'apps/mobile/app.config.js',
  'apps/mobile/eas.json',
  'apps/mobile/package.json',
  'apps/mobile/src/app/_layout.tsx',
  'apps/mobile/src/app/(tabs)/progress.tsx',
  'apps/mobile/src/app/(tabs)/shelf.tsx',
  'apps/mobile/src/app/(tabs)/you.tsx',
  'apps/mobile/src/app/onboarding/products.tsx',
  'apps/mobile/src/app/shelf/[id].tsx',
  'apps/mobile/src/app/shelf/_layout.tsx',
  'apps/mobile/src/app/shelf/opened.tsx',
  'apps/mobile/src/app/shelf/replenish.tsx',
  'apps/mobile/src/app/shelf/scan.tsx',
  'apps/mobile/src/app/shelf/search.tsx',
  'apps/mobile/src/app/shelf/ocr.tsx',
  'apps/mobile/src/app/progress/capture.tsx',
  'apps/mobile/src/app/progress/review.tsx',
  'apps/mobile/src/app/progress/[id].tsx',
  'apps/mobile/src/features/catalog/client.ts',
  'apps/mobile/src/features/catalog/client.test.ts',
  'apps/mobile/src/features/intelligence/pao.ts',
  'apps/mobile/src/features/intelligence/pao.test.ts',
  'apps/mobile/src/features/native/camera/barcode.ts',
  'apps/mobile/src/features/notifications/BehaviouralTriggers.tsx',
  'apps/mobile/src/features/notifications/claimsafety.test.ts',
  'apps/mobile/src/features/notifications/copy.ts',
  'apps/mobile/src/features/notifications/store.ts',
  'apps/mobile/src/features/notifications/store.test.ts',
  'apps/mobile/src/features/notifications/replenishmentOptInMigration.test.ts',
  'apps/mobile/src/features/photos/analyzePhotoLighting.ts',
  'apps/mobile/src/features/photos/CaptureAnalysisProvider.native.tsx',
  'apps/mobile/src/features/photos/CaptureAnalysisProvider.tsx',
  'apps/mobile/src/features/photos/captureAnalysis.ts',
  'apps/mobile/src/features/photos/consent.ts',
  'apps/mobile/src/features/photos/encryptedStorage.ts',
  'apps/mobile/src/features/photos/PhotoTimelineLockGate.tsx',
  'apps/mobile/src/features/photos/PhotoStorageGate.tsx',
  'apps/mobile/src/features/photos/store.ts',
  'apps/mobile/src/features/photos/usePhotos.ts',
  'apps/mobile/src/features/photos/useCaptureAnalysis.ts',
  'apps/mobile/src/features/photos/useDetectedFaces.native.ts',
  'apps/mobile/src/features/photos/useDetectedFaces.ts',
  'apps/mobile/src/features/recommendations/replenishment.ts',
  'apps/mobile/src/features/recommendations/replenishment.test.ts',
  'apps/mobile/src/features/shelf/IntakeContext.tsx',
  'apps/mobile/src/features/shelf/LocalDateField.tsx',
  'apps/mobile/src/features/shelf/freshness.ts',
  'apps/mobile/src/features/shelf/freshness.test.ts',
  'apps/mobile/src/features/shelf/freshnessMigration.test.ts',
  'apps/mobile/src/features/shelf/mutations.ts',
  'apps/mobile/src/features/shelf/paoProvenance.ts',
  'apps/mobile/src/features/shelf/paoProvenance.test.ts',
  'apps/mobile/src/features/shelf/shelfRoutes.test.ts',
  'apps/mobile/src/features/shelf/store.ts',
  'apps/mobile/src/features/shelf/store.test.ts',
  'apps/mobile/src/features/shelf/useShelf.ts',
  'apps/mobile/src/features/shelf/useShelf.test.ts',
  'packages/types/src/database.types.ts',
  'supabase/migrations/20260710000036_photo_quality_provenance.sql',
  'supabase/migrations/20260711000038_shelf_freshness_invariants.sql',
  'supabase/migrations/20260711000039_replenishment_alert_opt_in.sql',
  'apps/mobile/src/features/notifications/deliver.ts',
  'apps/mobile/src/lib/iap/revenuecat.ts',
  'apps/mobile/src/lib/applock/AppLockProvider.tsx',
  'apps/mobile/src/lib/applock/authenticate.ts',
  'scripts/phase5/build-device-qa-packet.mjs',
  'scripts/phase5/check-native-config.mjs',
  'scripts/phase5/check-performance-evidence.mjs',
  'scripts/phase5/device-qa-packet-smoke.mjs',
  'scripts/phase5/performance-evidence-contract.mjs',
  'scripts/phase5/performance-evidence-smoke.mjs',
  'scripts/e2e/human-e2e-manifest.mjs',
  'scripts/phase9/lib.mjs',
  'scripts/phase9/live-supabase-adversarial.mjs',
  'scripts/phase9/rls-adversarial.mjs',
  'docs/DEVICE_SUPPORT_POLICY.md',
  'docs/HUMAN_SIMULATED_E2E_TESTING.md',
  'docs/E2E_TESTING_CHECKLIST.md',
  'docs/USER_FLOW_TREE.md',
  'docs/e2e/generated/human-e2e-manifest.json',
  'docs/e2e/generated/human-e2e-manifest.md',
  'docs/phase-5/native-build-runbook.md',
  'docs/phase-5/device-qa-checklist.md',
  'docs/phase-5/performance-evidence-runbook.md',
  'docs/phase-5/performance-evidence.template.json',
  'docs/phase-5/phase-5-exit-review.md',
];

const scenarios = [
  ['Install', 'fresh install, update, reinstall, side-by-side dev/staging variants'],
  [
    'Permissions',
    'camera granted/denied, notification granted/denied/swiped away, biometric unavailable',
  ],
  ['Barcode', 'EAN-13, UPC-A, UPC-E, EAN-8, low light, glare, invalid checksum, duplicate read'],
  ['Label capture', 'clear INCI label, curved tube, tiny text, glare, manual correction'],
  [
    'Shelf freshness',
    'onboarding-origin exact-date entry, impossible/future-date rejection, explicit open-jar label confirmation, winning expiry source, reload, re-add, and replenishment-alert opt-in',
  ],
  [
    'Photos',
    'first capture, retake, reference ghost, measured framing/light, device-only storage/no backup control, no/multiple faces, analyzer unavailable, delete',
  ],
  [
    'Encryption and app lock',
    'restart, key present/missing simulation, direct Progress routes, prompt ordering, background relock, delete, share/export',
  ],
  ['Reminders', 'AM/PM, quiet hours, timezone, reboot, app killed, battery saver, Focus mode'],
  ['Share', 'native share sheet, cancel path, long names, no sharing available'],
  ['RevenueCat', 'configure, fetch offerings, Test Store purchase, restore from user action'],
  ['Offline', 'manual add, timeline view, no-match fallback, queued metadata'],
  ['Observability', 'native crash captured, no sensitive event payloads'],
  [
    'Performance',
    'predeclared thresholds plus supported-device startup, intake, barcode, routine, and encrypted-photo load/memory evidence',
  ],
];

const requiredQaEvidenceFlags = [
  ['PHASE5_DEVICE_QA_PASS', 'overall native-device QA matrix'],
  ['PHASE5_INSTALL_QA_PASS', 'fresh install, update, reinstall, and dev/staging variants'],
  [
    'PHASE5_CAMERA_PERMISSION_QA_PASS',
    'native camera permission denial, retry, and settings recovery',
  ],
  ['PHASE5_BARCODE_QA_PASS', 'physical-device barcode scan and checksum matrix'],
  ['PHASE5_LABEL_CAPTURE_QA_PASS', 'real label capture, editable text, and manual fallback'],
  ['PHASE5_PROGRESS_PHOTO_QA_PASS', 'progress still capture, retake, review, and recovery'],
  [
    'PHASE5_ENCRYPTED_PHOTO_STORAGE_QA_PASS',
    'encrypted photo save, restart, key-missing recovery, and delete',
  ],
  ['PHASE5_NOTIFICATION_QA_PASS', 'iOS reminder delivery and permission behavior'],
  ['PHASE5_SHARE_SHEET_QA_PASS', 'native share sheet success, cancel, and unavailable states'],
  [
    'PHASE5_REVENUECAT_NATIVE_QA_PASS',
    'RevenueCat native configure, offering, purchase, and restore smoke',
  ],
  ['PHASE5_SENTRY_NATIVE_QA_PASS', 'Sentry native crash/source-map smoke'],
  [
    'PHASE5_SUPABASE_CATALOG_NATIVE_QA_PASS',
    'native Supabase catalog lookup and no-match/error fallback',
  ],
  ['PHASE5_ACCESSIBILITY_QA_PASS', 'VoiceOver labels, traversal, and 44 pt controls'],
];

const optionalQaEvidenceFlags = [
  ['PHASE5_NATIVE_OCR_QA_PASS', 'native OCR real-label text recognition'],
];

function hashFile(path) {
  const abs = resolve(root, path);
  if (!existsSync(abs)) return { path, exists: false };
  const bytes = readFileSync(abs);
  return {
    path,
    exists: true,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
}

function markdownTable(headers, tableRows) {
  const rows = [headers, ...tableRows];
  const widths = headers.map((_, index) =>
    Math.max(...rows.map((row) => String(row[index] ?? '').length), 3),
  );
  const formatRow = (row) =>
    `| ${row.map((cell, index) => String(cell ?? '').padEnd(widths[index])).join(' | ')} |`;
  const separator = widths.map((width) => '-'.repeat(width));
  return [formatRow(headers), formatRow(separator), ...tableRows.map(formatRow)].join('\n');
}

function envValue(name) {
  return String(process.env[name] ?? '').trim();
}

function readJson(path) {
  return JSON.parse(readFileSync(resolve(root, path), 'utf8'));
}

function gitStatusExcludingGeneratedPacket() {
  return gitStatusExcludingGeneratedEvidence(packetOutputPaths);
}

function looksLikeEasBuildEvidence(value) {
  const trimmed = String(value ?? '').trim();
  if (placeholderEnvValue(trimmed) || /\b(local|simulator|emulator|fake|mock)\b/i.test(trimmed)) {
    return false;
  }
  const easBuildId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const easBuildUrl =
    /^https:\/\/expo\.dev\/accounts\/[^/\s]+\/projects\/[^/\s]+\/builds\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}(?:[?#].*)?$/i;
  return easBuildId.test(trimmed) || easBuildUrl.test(trimmed);
}

function looksLikePhysicalIosDevice(value) {
  const trimmed = String(value ?? '').trim();
  if (
    placeholderEnvValue(trimmed) ||
    /\b(simulator|emulator)\b/i.test(trimmed) ||
    /\bmodel\s*\//i.test(trimmed)
  ) {
    return false;
  }
  return (
    /\biP(?:hone|ad|od)\s+(?!\/|(?:iOS|iPadOS)\b)\S+/i.test(trimmed) &&
    /\b(?:iOS|iPadOS)\s+\d{1,2}(?:\.\d+){0,2}\b/i.test(trimmed)
  );
}

function looksLikePhysicalAndroidDevice(value) {
  const trimmed = String(value ?? '').trim();
  if (
    placeholderEnvValue(trimmed) ||
    /\b(simulator|emulator)\b/i.test(trimmed) ||
    /\bmodel\s*\//i.test(trimmed) ||
    /^(?:android|phone|device)(?:\s+(?:model|phone|device))?\s*(?:\/|$)/i.test(trimmed)
  ) {
    return false;
  }
  return /\bAndroid(?:\s+OS)?\s+\d{1,2}(?:\.\d+){0,2}\b/i.test(trimmed);
}

const rawSignedOffBy = envValue('PHASE5_SIGNED_OFF_BY');
const normalizedSignedOffBy = normalizeNamedSignoff(rawSignedOffBy) ?? '';
const eas = readJson('apps/mobile/eas.json');
const nativeOcrEnabled =
  evidenceFlagEnabled(process.env.EXPO_PUBLIC_NATIVE_OCR_ENABLED) ||
  Object.values(eas.build ?? {}).some((profile) =>
    evidenceFlagEnabled(profile?.env?.EXPO_PUBLIC_NATIVE_OCR_ENABLED),
  );

const buildEvidence = {
  iosBuildId: envValue('PHASE5_IOS_BUILD_ID'),
  androidBuildId: androidReleaseRequired ? envValue('PHASE5_ANDROID_BUILD_ID') : null,
  iosDevice: envValue('PHASE5_IOS_DEVICE'),
  androidDevice: androidReleaseRequired ? envValue('PHASE5_ANDROID_DEVICE') : null,
  platformStatus: {
    ios: platformRequirementStatus('ios', launchContract),
    android: platformRequirementStatus('android', launchContract),
  },
  qaSignedOff: evidenceFlagEnabled(process.env.PHASE5_QA_SIGNOFF),
  signedOffBy: normalizedSignedOffBy,
};

const qaEvidence = Object.fromEntries(
  requiredQaEvidenceFlags.map(([key, label]) => [
    key,
    { label, required: true, passed: evidenceFlagEnabled(process.env[key]) },
  ]),
);
for (const [key, label] of optionalQaEvidenceFlags) {
  qaEvidence[key] = {
    label,
    required: key === 'PHASE5_NATIVE_OCR_QA_PASS' ? nativeOcrEnabled : false,
    passed: evidenceFlagEnabled(process.env[key]),
  };
}

const files = requiredFiles.map(hashFile);
const blockers = [];
const warnings = [];
let gitSha = 'unknown';
let gitStatus = 'unknown';
try {
  gitSha = command('git', ['rev-parse', 'HEAD']).trim();
  gitStatus = gitStatusExcludingGeneratedPacket();
} catch {
  warnings.push('Git SHA/status could not be captured.');
}
if (gitStatus.length > 0) {
  warnings.push(
    'Phase 5 device QA packet generated with a dirty Git worktree; do not use it as final native-device evidence.',
  );
}
if (!buildEvidence.iosBuildId) blockers.push('Missing PHASE5_IOS_BUILD_ID.');
else if (!looksLikeEasBuildEvidence(buildEvidence.iosBuildId)) {
  blockers.push('PHASE5_IOS_BUILD_ID must be a real EAS build UUID or expo.dev build URL.');
}
if (androidReleaseRequired) {
  if (!buildEvidence.androidBuildId) blockers.push('Missing PHASE5_ANDROID_BUILD_ID.');
  else if (!looksLikeEasBuildEvidence(buildEvidence.androidBuildId)) {
    blockers.push('PHASE5_ANDROID_BUILD_ID must be a real EAS build UUID or expo.dev build URL.');
  }
}
if (!buildEvidence.iosDevice) blockers.push('Missing PHASE5_IOS_DEVICE.');
else if (!looksLikePhysicalIosDevice(buildEvidence.iosDevice)) {
  blockers.push('PHASE5_IOS_DEVICE must name a physical iPhone/iPad model and iOS/iPadOS version.');
}
if (androidReleaseRequired) {
  if (!buildEvidence.androidDevice) blockers.push('Missing PHASE5_ANDROID_DEVICE.');
  else if (!looksLikePhysicalAndroidDevice(buildEvidence.androidDevice)) {
    blockers.push(
      'PHASE5_ANDROID_DEVICE must name a physical Android model and Android OS version.',
    );
  }
}
if (!buildEvidence.qaSignedOff) blockers.push('Missing PHASE5_QA_SIGNOFF=true.');
if (!rawSignedOffBy) blockers.push('Missing PHASE5_SIGNED_OFF_BY.');
else if (!buildEvidence.signedOffBy) {
  blockers.push('PHASE5_SIGNED_OFF_BY must name a real tester/reviewer, not a placeholder.');
}
for (const [key, evidence] of Object.entries(qaEvidence)) {
  if (evidence.required && !evidence.passed) {
    blockers.push(`Missing ${key}=true (${evidence.label}).`);
  }
}
for (const file of files) if (!file.exists) blockers.push(`Missing ${file.path}.`);

const packet = {
  generatedAt: new Date().toISOString(),
  purpose: 'Phase 5 native device QA packet for contract-required release platforms.',
  launchContract: launchContractSnapshot(launchContract),
  gitSha,
  gitStatus,
  buildEvidence,
  qaEvidence,
  nativeOcr: {
    enabledInAnyBuild: nativeOcrEnabled,
    qaRequired: nativeOcrEnabled,
  },
  scenarios: scenarios.map(([surface, scenario]) => ({ surface, scenario })),
  files,
  blockers,
  warnings,
};

mkdirSync(outDir, { recursive: true });
const jsonPath = join(outDir, 'device-qa-packet.json');
writeFileSync(jsonPath, `${JSON.stringify(packet, null, 2)}\n`);

const fileRows = files.map((file) =>
  file.exists
    ? [file.path, 'present', String(file.bytes), file.sha256]
    : [file.path, 'missing', '', ''],
);
const scenarioRows = scenarios.map(([surface, scenario]) => [surface, scenario]);
const evidenceRows = Object.entries(qaEvidence).map(([key, evidence]) => [
  key,
  evidence.required ? 'required' : 'not required',
  evidence.passed ? 'PASS' : 'BLOCKED',
  evidence.label,
]);
const mdPath = join(outDir, 'device-qa-packet.md');
writeFileSync(
  mdPath,
  [
    '# Generated Phase 5 Device QA Packet',
    '',
    `Generated at: ${packet.generatedAt}`,
    `Git SHA: ${packet.gitSha}`,
    `Git status: ${packet.gitStatus ? 'DIRTY' : 'clean'}`,
    '',
    'This file is generated by `npm run phase5:qa-packet`. Strict completion',
    'requires real EAS build IDs and physical devices for every contract-required platform, plus a named QA signoff.',
    '',
    '## Build Evidence',
    '',
    `- iOS build ID: ${buildEvidence.iosBuildId || 'BLOCKED'}`,
    `- Android build ID: ${buildEvidence.androidBuildId || 'NOT APPLICABLE'}`,
    `- iOS device: ${buildEvidence.iosDevice || 'BLOCKED'}`,
    `- Android device: ${buildEvidence.androidDevice || 'NOT APPLICABLE'}`,
    `- QA signoff: ${buildEvidence.qaSignedOff ? 'yes' : 'BLOCKED'}`,
    `- Signed off by: ${buildEvidence.signedOffBy || 'BLOCKED'}`,
    `- Native OCR QA required: ${packet.nativeOcr.qaRequired ? 'yes' : 'no'}`,
    '',
    '## QA Evidence',
    '',
    markdownTable(['Key', 'Requirement', 'Status', 'Evidence scope'], evidenceRows),
    '',
    '## Scenarios',
    '',
    markdownTable(['Surface', 'Required scenario set'], scenarioRows),
    '',
    '## Files',
    '',
    markdownTable(['Path', 'Status', 'Bytes', 'SHA-256'], fileRows),
    '',
    '## Blockers',
    '',
    blockers.length > 0 ? blockers.map((blocker) => `- ${blocker}`).join('\n') : '- none',
    '',
    '## Warnings',
    '',
    warnings.length > 0 ? warnings.map((warning) => `- ${warning}`).join('\n') : '- none',
    '',
  ].join('\n'),
);

console.log(`Wrote ${relative(root, jsonPath).replaceAll('\\', '/')}`);
console.log(`Wrote ${relative(root, mdPath).replaceAll('\\', '/')}`);

if (strict && blockers.length > 0) {
  for (const blocker of blockers) console.error(`FAIL ${blocker}`);
  console.error(
    `\nPhase 5 strict QA packet has ${blockers.length} blocker${blockers.length === 1 ? '' : 's'}.`,
  );
  process.exit(1);
}
