#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { placeholderEnvValue } from '../phase9/lib.mjs';

const strict = process.argv.includes('--strict');
const root = process.cwd();
const outDir = resolve(root, process.env.PHASE5_QA_PACKET_OUT_DIR ?? 'docs/phase-5/generated');

const requiredFiles = [
  'apps/mobile/app.base.json',
  'apps/mobile/app.config.js',
  'apps/mobile/eas.json',
  'apps/mobile/package.json',
  'apps/mobile/src/app/shelf/scan.tsx',
  'apps/mobile/src/app/shelf/ocr.tsx',
  'apps/mobile/src/app/progress/capture.tsx',
  'apps/mobile/src/app/progress/review.tsx',
  'apps/mobile/src/features/native/camera/barcode.ts',
  'apps/mobile/src/features/photos/encryptedStorage.ts',
  'apps/mobile/src/features/photos/store.ts',
  'apps/mobile/src/features/notifications/deliver.ts',
  'apps/mobile/src/lib/iap/revenuecat.ts',
  'docs/phase-5/native-build-runbook.md',
  'docs/phase-5/device-qa-checklist.md',
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
  ['Photos', 'first capture, retake, reference ghost, low light, no face, delete'],
  ['Encryption', 'restart, key present, key missing simulation, delete, share/export'],
  ['Reminders', 'AM/PM, quiet hours, timezone, reboot, app killed, battery saver, Focus mode'],
  ['Share', 'native share sheet, cancel path, long names, no sharing available'],
  ['RevenueCat', 'configure, fetch offerings, Test Store purchase, restore from user action'],
  ['Offline', 'manual add, timeline view, no-match fallback, queued metadata'],
  ['Observability', 'native crash captured, no sensitive event payloads'],
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

function looksLikeEasBuildEvidence(value) {
  const trimmed = String(value ?? '').trim();
  if (
    placeholderEnvValue(trimmed) ||
    /\b(local|simulator|emulator|test|fake|mock)\b/i.test(trimmed)
  ) {
    return false;
  }
  const easBuildId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const easBuildUrl =
    /^https:\/\/expo\.dev\/accounts\/[^/\s]+\/projects\/[^/\s]+\/builds\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}(?:[?#].*)?$/i;
  return easBuildId.test(trimmed) || easBuildUrl.test(trimmed);
}

function looksLikePhysicalIosDevice(value) {
  const trimmed = String(value ?? '').trim();
  if (placeholderEnvValue(trimmed) || /\b(simulator|emulator|model\s*\/\s*ios)\b/i.test(trimmed)) {
    return false;
  }
  return (
    /\biP(?:hone|ad|od)\b/i.test(trimmed) &&
    /\b(?:iOS|iPadOS)\s+\d{1,2}(?:\.\d+){0,2}\b/i.test(trimmed)
  );
}

function looksLikePhysicalAndroidDevice(value) {
  const trimmed = String(value ?? '').trim();
  if (placeholderEnvValue(trimmed) || /\b(simulator|emulator|model\s*\/\s*os)\b/i.test(trimmed)) {
    return false;
  }
  return /\bAndroid(?:\s+OS)?\s+\d{1,2}(?:\.\d+){0,2}\b/i.test(trimmed);
}

function looksLikeNamedSignoff(value) {
  const trimmed = String(value ?? '').trim();
  if (placeholderEnvValue(trimmed)) return false;
  if (/^(?:name|tester|qa|reviewer|signoff|signed off|tbd|n\/a)$/i.test(trimmed)) return false;
  return /[a-z]/i.test(trimmed) && trimmed.length >= 3;
}

const buildEvidence = {
  iosBuildId: envValue('PHASE5_IOS_BUILD_ID'),
  androidBuildId: envValue('PHASE5_ANDROID_BUILD_ID'),
  iosDevice: envValue('PHASE5_IOS_DEVICE'),
  androidDevice: envValue('PHASE5_ANDROID_DEVICE'),
  qaSignedOff: process.env.PHASE5_QA_SIGNOFF === 'true',
  signedOffBy: envValue('PHASE5_SIGNED_OFF_BY'),
};

const files = requiredFiles.map(hashFile);
const blockers = [];
if (!buildEvidence.iosBuildId) blockers.push('Missing PHASE5_IOS_BUILD_ID.');
else if (!looksLikeEasBuildEvidence(buildEvidence.iosBuildId)) {
  blockers.push('PHASE5_IOS_BUILD_ID must be a real EAS build UUID or expo.dev build URL.');
}
if (!buildEvidence.androidBuildId) blockers.push('Missing PHASE5_ANDROID_BUILD_ID.');
else if (!looksLikeEasBuildEvidence(buildEvidence.androidBuildId)) {
  blockers.push('PHASE5_ANDROID_BUILD_ID must be a real EAS build UUID or expo.dev build URL.');
}
if (!buildEvidence.iosDevice) blockers.push('Missing PHASE5_IOS_DEVICE.');
else if (!looksLikePhysicalIosDevice(buildEvidence.iosDevice)) {
  blockers.push('PHASE5_IOS_DEVICE must name a physical iPhone/iPad model and iOS/iPadOS version.');
}
if (!buildEvidence.androidDevice) blockers.push('Missing PHASE5_ANDROID_DEVICE.');
else if (!looksLikePhysicalAndroidDevice(buildEvidence.androidDevice)) {
  blockers.push('PHASE5_ANDROID_DEVICE must name a physical Android model and Android OS version.');
}
if (!buildEvidence.qaSignedOff) blockers.push('Missing PHASE5_QA_SIGNOFF=true.');
if (!buildEvidence.signedOffBy) blockers.push('Missing PHASE5_SIGNED_OFF_BY.');
else if (!looksLikeNamedSignoff(buildEvidence.signedOffBy)) {
  blockers.push('PHASE5_SIGNED_OFF_BY must name a real tester/reviewer, not a placeholder.');
}
for (const file of files) if (!file.exists) blockers.push(`Missing ${file.path}.`);

const packet = {
  generatedAt: new Date().toISOString(),
  purpose: 'Phase 5 native device QA packet for installable iOS/Android builds.',
  buildEvidence,
  scenarios: scenarios.map(([surface, scenario]) => ({ surface, scenario })),
  files,
  blockers,
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
const mdPath = join(outDir, 'device-qa-packet.md');
writeFileSync(
  mdPath,
  [
    '# Generated Phase 5 Device QA Packet',
    '',
    `Generated at: ${packet.generatedAt}`,
    '',
    'This file is generated by `npm run phase5:qa-packet`. Strict completion',
    'requires real EAS build IDs, physical devices, and a named QA signoff.',
    '',
    '## Build Evidence',
    '',
    `- iOS build ID: ${buildEvidence.iosBuildId || 'BLOCKED'}`,
    `- Android build ID: ${buildEvidence.androidBuildId || 'BLOCKED'}`,
    `- iOS device: ${buildEvidence.iosDevice || 'BLOCKED'}`,
    `- Android device: ${buildEvidence.androidDevice || 'BLOCKED'}`,
    `- QA signoff: ${buildEvidence.qaSignedOff ? 'yes' : 'BLOCKED'}`,
    `- Signed off by: ${buildEvidence.signedOffBy || 'BLOCKED'}`,
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
