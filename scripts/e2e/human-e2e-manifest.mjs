#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const root = process.cwd();
const args = new Set(process.argv.slice(2));
const dateArg = process.argv.find((arg) => arg.startsWith('--date='));
const strict = args.has('--strict');
const check = args.has('--check');

function abs(path) {
  return resolve(root, path);
}

function rel(path) {
  return normalizeRepoPath(relative(root, path));
}

function normalizeRepoPath(path) {
  return String(path).replace(/\\/g, '/').replace(/^\.\//, '');
}

const ignoredGeneratedOutputPatterns = [
  /^docs\/generated\/(?:source-packet-audit|tas-todo-audit|readiness-status-audit|device-support-policy-audit|performance-readiness-audit|generated-packet-status-audit)\.(?:json|md)$/,
  /^docs\/phase-(?:3|4|5|6|7|8|9|10|11)\/generated\/.+\.(?:json|md)$/,
];

function ignoredGeneratedOutputPath(path) {
  const normalized = normalizeRepoPath(path);
  return ignoredGeneratedOutputPatterns.some((pattern) => pattern.test(normalized));
}

function exists(path) {
  return existsSync(abs(path));
}

function readJson(path) {
  return JSON.parse(readFileSync(abs(path), 'utf8'));
}

function hashFile(path) {
  return createHash('sha256')
    .update(readFileSync(abs(path)))
    .digest('hex');
}

function command(name, commandArgs) {
  try {
    return execFileSync(name, commandArgs, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

function commandRequired(name, commandArgs) {
  return execFileSync(name, commandArgs, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function listGitTrackedRepoFiles() {
  return new Set(
    execFileSync('git', ['ls-files', '-z'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
      .split('\0')
      .filter(Boolean)
      .map(normalizeRepoPath),
  );
}

function gateEvidencePath(gate) {
  return `${gate.folder}/${gate.evidence}`;
}

function textPressureLaunchFloorGate(date) {
  return {
    id: 'support-floor-360-640-200-text-pressure',
    title: '360 x 640 launch-floor 200% text-pressure route sweep',
    kind: 'summary-status',
    required: true,
    supportClass: 'launch-blocking',
    folder: `test-results/human-e2e/${date}/text-pressure-200-supported-360-640-postfix`,
    evidence: 'summary.json',
    expected:
      '49 Expo web direct-entry routes have zero launch-floor text-pressure geometry/log failures.',
  };
}

function textPressureLegacyFloorGate(date, scale, suffix, titleScale = `${scale}%`) {
  return {
    id: `legacy-320-480-${scale}-text-pressure`,
    title: `320 x 480 stress ${titleScale} text-pressure route sweep`,
    kind: 'summary-status',
    required: false,
    supportClass: 'resilience',
    folder: `test-results/human-e2e/${date}/text-pressure-${scale}-support-floor-480-${suffix}`,
    evidence: 'summary.json',
    expected:
      '49 Expo web direct-entry routes have zero legacy 320-wide stress geometry/log failures.',
  };
}

function legacySupportFloorGate(date) {
  return {
    id: 'short-phone-480-route-rerun',
    title: '320 x 480 stress route rerun',
    kind: 'failures',
    required: false,
    supportClass: 'resilience',
    folder: `test-results/human-e2e/${date}/current-main-short-phone-480-rerun`,
    evidence: 'failures.json',
    expected: '49 Expo web direct-entry routes have zero legacy 320-wide geometry/log failures.',
  };
}

function supportFloorGateForDate(date) {
  return textPressureLaunchFloorGate(date);
}

function requiredGateEvidenceFiles(date) {
  return [
    gateEvidencePath(supportFloorGateForDate(date)),
    `test-results/human-e2e/${date}/text-pressure-200-android-360-740-postfix/summary.json`,
    `test-results/human-e2e/${date}/text-pressure-200-iphone-375-667-full-postfix3-clear/summary.json`,
    `test-results/human-e2e/${date}/text-pressure-200-iphone-375-812-postfix/summary.json`,
    `test-results/human-e2e/${date}/text-pressure-200-modern-390-postfix-7/summary.json`,
    `test-results/human-e2e/${date}/text-pressure-200-android-412-640-current/summary.json`,
    `test-results/human-e2e/${date}/text-pressure-200-android-412-915-postfix2/summary.json`,
    `test-results/human-e2e/${date}/text-pressure-200-boundary-414-896-postfix3/summary.json`,
    `test-results/human-e2e/${date}/text-pressure-200-android-430-640-postfix3/summary.json`,
    `test-results/human-e2e/${date}/text-pressure-200-modern-430-postfix-5/summary.json`,
    `test-results/human-e2e/${date}/text-pressure-200-skipped-routes-360-640-current/summary.json`,
    `test-results/human-e2e/${date}/text-pressure-200-skipped-routes-375-667-postfix3/summary.json`,
    `test-results/human-e2e/${date}/text-pressure-200-skipped-routes-390-844-postfix/summary.json`,
    `test-results/human-e2e/${date}/text-pressure-200-skipped-routes-412-640-postfix/summary.json`,
    `test-results/human-e2e/${date}/text-pressure-200-skipped-routes-430-640-current/summary.json`,
    `test-results/human-e2e/${date}/text-pressure-200-skipped-routes-430-932-postfix/summary.json`,
  ];
}

function latestEvidenceDate() {
  const base = abs('test-results/human-e2e');
  if (!existsSync(base)) return null;
  const dates = readdirSync(base, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  return (
    [...dates]
      .reverse()
      .find((date) =>
        requiredGateEvidenceFiles(date).every((evidencePath) => exists(evidencePath)),
      ) ?? null
  );
}

function latestEvidenceDateForFolder(folder, evidence = 'summary.json') {
  const base = abs('test-results/human-e2e');
  if (!existsSync(base)) return null;
  return (
    readdirSync(base, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(entry.name))
      .map((entry) => entry.name)
      .sort()
      .reverse()
      .find((date) => exists(`test-results/human-e2e/${date}/${folder}/${evidence}`)) ?? null
  );
}

function walkEvidence(path, trackedRepoFiles) {
  const target = abs(path);
  const result = { files: 0, bytes: 0 };
  if (!existsSync(target)) return result;
  const stack = [target];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const next = join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(next);
      } else if (entry.name === 'expo-web.log') {
        continue;
      } else if (!trackedRepoFiles.has(rel(next))) {
        continue;
      } else {
        result.files += 1;
        result.bytes += statSync(next).size;
      }
    }
  }
  return result;
}

function parseFailureCount(path) {
  const data = readJson(path);
  if (Array.isArray(data)) return data.length;
  if (typeof data?.failedRouteCount === 'number') return data.failedRouteCount;
  if (Array.isArray(data?.failedRoutes)) return data.failedRoutes.length;
  throw new Error(`${path} does not expose failedRouteCount or failedRoutes.`);
}

function markdownTable(headers, rows) {
  const allRows = [headers, ...rows];
  const widths = headers.map((_, index) =>
    Math.max(...allRows.map((row) => String(row[index] ?? '').length), 3),
  );
  const render = (row) =>
    `| ${row.map((cell, index) => String(cell ?? '').padEnd(widths[index])).join(' | ')} |`;
  return [
    render(headers),
    render(widths.map((width) => '-'.repeat(width))),
    ...rows.map(render),
  ].join('\n');
}

const evidenceDate =
  dateArg?.slice('--date='.length) || process.env.E2E_MANIFEST_DATE || latestEvidenceDate();
if (!evidenceDate) {
  console.error('FAIL No complete baseline human-E2E evidence date found.');
  process.exit(1);
}

const timelapseEvidenceDate = latestEvidenceDateForFolder('progress-timelapse-current');
if (!timelapseEvidenceDate) {
  console.error('FAIL Missing supported-phone Progress time-lapse evidence.');
  process.exit(1);
}
const captureAnalysisEvidenceDate = latestEvidenceDateForFolder(
  'progress-capture-analysis-current',
);
if (!captureAnalysisEvidenceDate) {
  console.error('FAIL Missing supported-phone Progress capture-analysis evidence.');
  process.exit(1);
}
const deviceOnlyBackupEvidenceDate = latestEvidenceDateForFolder(
  'progress-device-only-backup-current',
);
if (!deviceOnlyBackupEvidenceDate) {
  console.error('FAIL Missing device-only Progress photo storage evidence.');
  process.exit(1);
}
const progressDirectRouteLockEvidenceDate = latestEvidenceDateForFolder(
  'progress-direct-route-lock-current',
);
if (!progressDirectRouteLockEvidenceDate) {
  console.error('FAIL Missing direct-route Progress app-lock evidence.');
  process.exit(1);
}
const progressStorageRecoveryEvidenceDate = latestEvidenceDateForFolder(
  'progress-storage-recovery-current',
);
if (!progressStorageRecoveryEvidenceDate) {
  console.error('FAIL Missing encrypted Progress storage recovery evidence.');
  process.exit(1);
}
const privateEnvelopeCorruptionEvidenceDate = latestEvidenceDateForFolder(
  'private-envelope-corruption-current',
);
if (!privateEnvelopeCorruptionEvidenceDate) {
  console.error('FAIL Missing private-envelope corruption and app-lock recovery evidence.');
  process.exit(1);
}
const pregnancySafetyStatusEvidenceDate = latestEvidenceDateForFolder(
  'pregnancy-safety-status-current',
);
if (!pregnancySafetyStatusEvidenceDate) {
  console.error('FAIL Missing pregnancy-safety status consistency evidence.');
  process.exit(1);
}
const multiActivePlanTodayEvidenceDate = latestEvidenceDateForFolder(
  'multi-active-plan-today-current',
);
if (!multiActivePlanTodayEvidenceDate) {
  console.error('FAIL Missing canonical multi-active Plan/Today evidence.');
  process.exit(1);
}
const routineOrderPersistenceEvidenceDate = latestEvidenceDateForFolder(
  'routine-order-persistence-current',
);
if (!routineOrderPersistenceEvidenceDate) {
  console.error('FAIL Missing persistent AM/PM routine-order evidence.');
  process.exit(1);
}
const conflictChoiceScheduleEvidenceDate = latestEvidenceDateForFolder(
  'conflict-choice-schedule-current',
);
if (!conflictChoiceScheduleEvidenceDate) {
  console.error('FAIL Missing exact-pair conflict-choice schedule evidence.');
  process.exit(1);
}
const cycleDisruptionReconciliationEvidenceDate = latestEvidenceDateForFolder(
  'cycle-disruption-reconciliation-current',
);
if (!cycleDisruptionReconciliationEvidenceDate) {
  console.error('FAIL Missing cycle disruption and reconciliation evidence.');
  process.exit(1);
}
const cycleCustomizationEvidenceDate = latestEvidenceDateForFolder('cycle-customization-current');
if (!cycleCustomizationEvidenceDate) {
  console.error('FAIL Missing authored-cycle customization and reconciliation evidence.');
  process.exit(1);
}
const dataExportDisclosureEvidenceDate = latestEvidenceDateForFolder(
  'data-export-local-photo-disclosure-current',
);
if (!dataExportDisclosureEvidenceDate) {
  console.error('FAIL Missing account-export local-photo disclosure evidence.');
  process.exit(1);
}
const combinedDataExportEvidenceDate = latestEvidenceDateForFolder(
  'data-export-combined-device-current',
);
if (!combinedDataExportEvidenceDate) {
  console.error('FAIL Missing combined account/current-device export evidence.');
  process.exit(1);
}
const accountGenerationExportEvidenceDate = latestEvidenceDateForFolder(
  'data-export-account-generation-current',
);
if (!accountGenerationExportEvidenceDate) {
  console.error('FAIL Missing account-generation export-isolation evidence.');
  process.exit(1);
}
const accountUpgradeEvidenceDate = latestEvidenceDateForFolder(
  'onboarding-account-upgrade-current',
);
if (!accountUpgradeEvidenceDate) {
  console.error('FAIL Missing identity-preserving account-upgrade UI evidence.');
  process.exit(1);
}
const accountIsolationEvidenceDate = latestEvidenceDateForFolder(
  'onboarding-account-isolation-current',
);
if (!accountIsolationEvidenceDate) {
  console.error('FAIL Missing account-transition private-data isolation evidence.');
  process.exit(1);
}
const shelfFreshnessProvenanceEvidenceDate = latestEvidenceDateForFolder(
  'shelf-freshness-provenance-current',
);
if (!shelfFreshnessProvenanceEvidenceDate) {
  console.error('FAIL Missing Shelf freshness and replacement provenance evidence.');
  process.exit(1);
}
const latestManifestEvidenceDate = [
  evidenceDate,
  timelapseEvidenceDate,
  captureAnalysisEvidenceDate,
  deviceOnlyBackupEvidenceDate,
  progressDirectRouteLockEvidenceDate,
  progressStorageRecoveryEvidenceDate,
  privateEnvelopeCorruptionEvidenceDate,
  pregnancySafetyStatusEvidenceDate,
  multiActivePlanTodayEvidenceDate,
  routineOrderPersistenceEvidenceDate,
  conflictChoiceScheduleEvidenceDate,
  cycleDisruptionReconciliationEvidenceDate,
  cycleCustomizationEvidenceDate,
  dataExportDisclosureEvidenceDate,
  combinedDataExportEvidenceDate,
  accountGenerationExportEvidenceDate,
  accountUpgradeEvidenceDate,
  accountIsolationEvidenceDate,
  shelfFreshnessProvenanceEvidenceDate,
]
  .sort()
  .at(-1);

const gates = [
  supportFloorGateForDate(evidenceDate),
  {
    id: 'android-360-740-200-text-pressure',
    title: '360 x 740 supported Android-class 200% text-pressure route sweep',
    kind: 'summary-status',
    required: true,
    supportClass: 'supported-phone',
    folder: `test-results/human-e2e/${evidenceDate}/text-pressure-200-android-360-740-postfix`,
    evidence: 'summary.json',
    expected: '49 Expo web direct-entry routes have zero Android 360-class failures.',
  },
  {
    id: 'iphone-375-667-200-text-pressure',
    title: '375 x 667 compact iPhone-class 200% text-pressure route sweep',
    kind: 'summary-status',
    required: true,
    supportClass: 'supported-phone',
    folder: `test-results/human-e2e/${evidenceDate}/text-pressure-200-iphone-375-667-full-postfix3-clear`,
    evidence: 'summary.json',
    expected:
      '49 Expo web direct-entry routes have zero compact iPhone-class 200% text-pressure failures.',
  },
  {
    id: 'iphone-375-200-text-pressure',
    title: '375 x 812 supported iPhone-class 200% text-pressure route sweep',
    kind: 'summary-status',
    required: true,
    supportClass: 'supported-phone',
    folder: `test-results/human-e2e/${evidenceDate}/text-pressure-200-iphone-375-812-postfix`,
    evidence: 'summary.json',
    expected: '49 Expo web direct-entry routes have zero iPhone-class 200% text-pressure failures.',
  },
  {
    id: 'modern-390-200-text-pressure',
    title: '390 x 844 supported-phone 200% text-pressure route sweep',
    kind: 'summary-status',
    required: true,
    supportClass: 'supported-phone',
    folder: `test-results/human-e2e/${evidenceDate}/text-pressure-200-modern-390-postfix-7`,
    evidence: 'summary.json',
    expected: '49 Expo web direct-entry routes have zero modern-phone 200% text-pressure failures.',
  },
  {
    id: 'android-412-640-200-text-pressure',
    title: '412 x 640 supported Android-class 200% text-pressure route sweep',
    kind: 'summary-status',
    required: true,
    supportClass: 'supported-phone',
    folder: `test-results/human-e2e/${evidenceDate}/text-pressure-200-android-412-640-current`,
    evidence: 'summary.json',
    expected:
      '49 Expo web direct-entry routes have zero wide support-floor 200% text-pressure failures.',
  },
  {
    id: 'android-412-200-text-pressure',
    title: '412 x 915 supported Android-class 200% text-pressure route sweep',
    kind: 'summary-status',
    required: true,
    supportClass: 'supported-phone',
    folder: `test-results/human-e2e/${evidenceDate}/text-pressure-200-android-412-915-postfix2`,
    evidence: 'summary.json',
    expected:
      '49 Expo web direct-entry routes have zero Android-class 200% text-pressure failures.',
  },
  {
    id: 'boundary-414-896-200-text-pressure',
    title: '414 x 896 boundary-phone 200% text-pressure route sweep',
    kind: 'summary-status',
    required: true,
    supportClass: 'supported-phone',
    folder: `test-results/human-e2e/${evidenceDate}/text-pressure-200-boundary-414-896-postfix3`,
    evidence: 'summary.json',
    expected:
      '49 Expo web direct-entry routes have zero boundary-phone 200% text-pressure failures.',
  },
  {
    id: 'android-430-640-200-text-pressure',
    title: '430 x 640 supported Android-class 200% text-pressure route sweep',
    kind: 'summary-status',
    required: true,
    supportClass: 'supported-phone',
    folder: `test-results/human-e2e/${evidenceDate}/text-pressure-200-android-430-640-postfix3`,
    evidence: 'summary.json',
    expected:
      '49 Expo web direct-entry routes have zero wide support-floor 200% text-pressure failures.',
  },
  {
    id: 'modern-430-200-text-pressure',
    title: '430 x 932 supported-phone 200% text-pressure route sweep',
    kind: 'summary-status',
    required: true,
    supportClass: 'supported-phone',
    folder: `test-results/human-e2e/${evidenceDate}/text-pressure-200-modern-430-postfix-5`,
    evidence: 'summary.json',
    expected: '49 Expo web direct-entry routes have zero tall-phone 200% text-pressure failures.',
  },
  {
    id: 'skipped-routes-360-640-200-text-pressure',
    title: '360 x 640 skipped/direct-entry 200% text-pressure route sweep',
    kind: 'summary-status',
    required: true,
    supportClass: 'supported-phone',
    folder: `test-results/human-e2e/${evidenceDate}/text-pressure-200-skipped-routes-360-640-current`,
    evidence: 'summary.json',
    expected:
      '21 onboarding, paywall, recovery, conflict, share, shelf, and progress routes have zero launch-floor failures.',
  },
  {
    id: 'skipped-routes-375-667-200-text-pressure',
    title: '375 x 667 skipped/direct-entry 200% text-pressure route sweep',
    kind: 'summary-status',
    required: true,
    supportClass: 'supported-phone',
    folder: `test-results/human-e2e/${evidenceDate}/text-pressure-200-skipped-routes-375-667-postfix3`,
    evidence: 'summary.json',
    expected:
      '21 onboarding, paywall, recovery, conflict, share, shelf, and progress routes have zero compact iPhone failures.',
  },
  {
    id: 'skipped-routes-390-844-200-text-pressure',
    title: '390 x 844 skipped/direct-entry 200% text-pressure route sweep',
    kind: 'summary-status',
    required: true,
    supportClass: 'supported-phone',
    folder: `test-results/human-e2e/${evidenceDate}/text-pressure-200-skipped-routes-390-844-postfix`,
    evidence: 'summary.json',
    expected:
      '21 onboarding, paywall, recovery, conflict, share, shelf, and progress routes have zero modern-phone failures.',
  },
  {
    id: 'skipped-routes-412-640-200-text-pressure',
    title: '412 x 640 skipped/direct-entry 200% text-pressure route sweep',
    kind: 'summary-status',
    required: true,
    supportClass: 'supported-phone',
    folder: `test-results/human-e2e/${evidenceDate}/text-pressure-200-skipped-routes-412-640-postfix`,
    evidence: 'summary.json',
    expected:
      '21 onboarding, paywall, recovery, conflict, share, shelf, and progress routes have zero wide support-floor failures.',
  },
  {
    id: 'skipped-routes-430-640-200-text-pressure',
    title: '430 x 640 skipped/direct-entry 200% text-pressure route sweep',
    kind: 'summary-status',
    required: true,
    supportClass: 'supported-phone',
    folder: `test-results/human-e2e/${evidenceDate}/text-pressure-200-skipped-routes-430-640-current`,
    evidence: 'summary.json',
    expected:
      '21 onboarding, paywall, recovery, conflict, share, shelf, and progress routes have zero wide support-floor failures.',
  },
  {
    id: 'skipped-routes-430-932-200-text-pressure',
    title: '430 x 932 skipped/direct-entry 200% text-pressure route sweep',
    kind: 'summary-status',
    required: true,
    supportClass: 'supported-phone',
    folder: `test-results/human-e2e/${evidenceDate}/text-pressure-200-skipped-routes-430-932-postfix`,
    evidence: 'summary.json',
    expected:
      '21 onboarding, paywall, recovery, conflict, share, shelf, and progress routes have zero tall-phone failures.',
  },
  {
    id: 'modern-390-170-text-pressure',
    title: '390 x 844 supported-phone 170% text-pressure route sweep',
    kind: 'summary-status',
    required: false,
    supportClass: 'supported-phone',
    folder: `test-results/human-e2e/${evidenceDate}/text-pressure-170-modern-390-postfix-6`,
    evidence: 'summary.json',
    expected: '49 Expo web direct-entry routes have zero modern-phone text-pressure failures.',
  },
  {
    id: 'modern-430-170-text-pressure',
    title: '430 x 932 supported-phone 170% text-pressure route sweep',
    kind: 'summary-status',
    required: false,
    supportClass: 'supported-phone',
    folder: `test-results/human-e2e/${evidenceDate}/text-pressure-170-modern-430-postfix-3`,
    evidence: 'summary.json',
    expected: '49 Expo web direct-entry routes have zero tall-phone text-pressure failures.',
  },
  {
    ...textPressureLegacyFloorGate(evidenceDate, 200, 'postfix-12'),
  },
  {
    ...textPressureLegacyFloorGate(evidenceDate, 170, 'postfix-16'),
  },
  {
    ...legacySupportFloorGate(evidenceDate),
  },
  {
    id: 'short-phone-430-final-clearance',
    title: '320 x 430 resilience route clearance',
    kind: 'failures',
    required: false,
    supportClass: 'resilience',
    folder: `test-results/human-e2e/${evidenceDate}/current-main-short-phone-430-final-clearance-sweep`,
    evidence: 'failures.json',
    expected: '49 Expo web direct-entry routes have zero ultra-short geometry failures.',
  },
  {
    id: 'split-short-390-clearance',
    title: '320 x 390 split-short stress clearance',
    kind: 'failures',
    required: false,
    supportClass: 'resilience',
    folder: `test-results/human-e2e/${evidenceDate}/current-main-split-short-phone-390-sweep-postfix`,
    evidence: 'failures.json',
    expected: '49 Expo web direct-entry routes have zero split-short failures.',
  },
  {
    id: 'first-session-430-activation',
    title: '320 x 430 first-session activation stress pass',
    kind: 'summary-verdict',
    required: false,
    supportClass: 'resilience',
    folder: `test-results/human-e2e/${evidenceDate}/onboarding-first-session-430-current`,
    evidence: 'summary.json',
    expected: 'Fresh onboarding to shelf intake, routine plan, and Today check-off passes.',
  },
  {
    id: 'account-upgrade-supported-phone',
    title: '360 x 640 account-upgrade error and recovery pass',
    kind: 'summary-verdict',
    required: true,
    supportClass: 'supported-phone',
    folder: `test-results/human-e2e/${accountUpgradeEvidenceDate}/onboarding-account-upgrade-current`,
    evidence: 'summary.json',
    expected:
      'Invalid email code recovers, valid fixture code reaches paywall, and first-session activation completes.',
  },
  {
    id: 'account-isolation-supported-phone',
    title: '360 x 640 account-transition isolation and cleanup recovery pass',
    kind: 'summary-verdict',
    required: true,
    supportClass: 'supported-phone',
    folder: `test-results/human-e2e/${accountIsolationEvidenceDate}/onboarding-account-isolation-current`,
    evidence: 'summary.json',
    expected:
      'Cleanup failure stays gated, retry succeeds, and signed-out Shelf/Today expose no account A data.',
  },
  {
    id: 'progress-timelapse-supported-phone',
    title: '390 x 844 local Progress time-lapse and reduced-motion pass',
    kind: 'summary-status',
    required: true,
    supportClass: 'supported-phone',
    folder: `test-results/human-e2e/${timelapseEvidenceDate}/progress-timelapse-current`,
    evidence: 'summary.json',
    expected:
      'Real bitmap frames, finite playback, controls, close recovery, and reduced-motion manual review pass.',
  },
  {
    id: 'progress-capture-analysis-supported-phone',
    title: 'Progress quality states and support-floor save recovery',
    kind: 'summary-status',
    required: true,
    supportClass: 'supported-phone',
    folder: `test-results/human-e2e/${captureAnalysisEvidenceDate}/progress-capture-analysis-current`,
    evidence: 'summary.json',
    expected:
      '390 x 844 quality states stay explicit and operable; 360 x 640 save failure stays inline and recoverable.',
  },
  {
    id: 'progress-device-only-backup-supported-phone',
    title: 'Device-only Progress photo storage',
    kind: 'summary-status',
    required: true,
    supportClass: 'supported-phone',
    folder: `test-results/human-e2e/${deviceOnlyBackupEvidenceDate}/progress-device-only-backup-current`,
    evidence: 'summary.json',
    expected:
      'Settings and locked Progress show device-only storage with no backup switch, dialogs, backup analytics, or photo-backend traffic.',
  },
  {
    id: 'progress-direct-route-lock-supported-phone',
    title: 'Progress direct-route app-lock coverage',
    kind: 'summary-status',
    required: true,
    supportClass: 'supported-phone',
    folder: `test-results/human-e2e/${progressDirectRouteLockEvidenceDate}/progress-direct-route-lock-current`,
    evidence: 'summary.json',
    expected:
      'Progress tab, capture, review, and detail direct entries stay locked at 360 x 640 and 390 x 844; one active-session unlock persists until background relock.',
  },
  {
    id: 'progress-storage-recovery-supported-phone',
    title: 'Progress encrypted-storage recovery',
    kind: 'summary-status',
    required: true,
    supportClass: 'supported-phone',
    folder: `test-results/human-e2e/${progressStorageRecoveryEvidenceDate}/progress-storage-recovery-current`,
    evidence: 'summary.json',
    expected:
      'Progress tab, capture, review, and detail block false empty/missing states during encrypted read failure; persistent retry and one-shot recovery pass at supported phone sizes.',
  },
  {
    id: 'private-envelope-corruption-supported-phone',
    title: 'Private envelope corruption and app-lock recovery',
    kind: 'summary-status',
    required: true,
    supportClass: 'supported-phone',
    folder: `test-results/human-e2e/${privateEnvelopeCorruptionEvidenceDate}/private-envelope-corruption-current`,
    evidence: 'summary.json',
    expected:
      'Malformed private envelopes block and remain byte-identical through retry; restored data and authenticated app-lock reset recover the requested route.',
  },
  {
    id: 'pregnancy-safety-status-supported-phone',
    title: 'Pregnancy-safety status and routine exclusion consistency',
    kind: 'summary-status',
    required: true,
    supportClass: 'supported-phone',
    folder: `test-results/human-e2e/${pregnancySafetyStatusEvidenceDate}/pregnancy-safety-status-current`,
    evidence: 'summary.json',
    expected:
      'All four encrypted status choices keep Plan and Today consistent; profile/consent write retries, legacy-consent regrant, missing-profile caution, prefer-not reload, and explicit-none restoration pass at 360 x 640 and 390 x 844.',
  },
  {
    id: 'multi-active-plan-today-supported-phone',
    title: 'Canonical multi-active Plan and Today consistency',
    kind: 'summary-status',
    required: true,
    supportClass: 'supported-phone',
    folder: `test-results/human-e2e/${multiActivePlanTodayEvidenceDate}/multi-active-plan-today-current`,
    evidence: 'summary.json',
    expected:
      'Every supported cycle product, BP AM placement, explicit undefined-cadence withholding, one-active PM projection, completion reload, and supported-phone geometry pass from one canonical schedule.',
  },
  {
    id: 'routine-order-persistence-supported-phone',
    title: 'Persistent Morning and Evening routine order',
    kind: 'summary-status',
    required: true,
    supportClass: 'supported-phone',
    folder: `test-results/human-e2e/${routineOrderPersistenceEvidenceDate}/routine-order-persistence-current`,
    evidence: 'summary.json',
    expected:
      'Stable product-ID AM/PM edits survive reopen, reload, Cancel, recompute, Today projection, one failed save, and retry without changing safety/cycle authority.',
  },
  {
    id: 'conflict-choice-schedule-supported-phone',
    title: 'Exact-pair conflict choice and reviewed-schedule consistency',
    kind: 'summary-status',
    required: true,
    supportClass: 'supported-phone',
    folder: `test-results/human-e2e/${conflictChoiceScheduleEvidenceDate}/conflict-choice-schedule-current`,
    evidence: 'summary.json',
    expected:
      'Two same-rule pairs keep independent current-version choices, suppress only resolved prompts, preserve one-active schedule authority, recover from one failed encrypted write, and pass supported-phone geometry/keyboard checks.',
  },
  {
    id: 'cycle-disruption-reconciliation-supported-phone',
    title: 'Cycle disruption persistence and deterministic reconciliation',
    kind: 'summary-status',
    required: true,
    supportClass: 'supported-phone',
    folder: `test-results/human-e2e/${cycleDisruptionReconciliationEvidenceDate}/cycle-disruption-reconciliation-current`,
    evidence: 'summary.json',
    expected:
      'Pause, resume, recovery, variant, Start Today, and irritation flows persist before success, recover from failed private writes, reconcile one canonical projection, and remain reachable at 360 x 640 and 390 x 844.',
  },
  {
    id: 'authored-cycle-customization-supported-phone',
    title: 'Authored cycle customization and deterministic reconciliation',
    kind: 'summary-status',
    required: true,
    supportClass: 'supported-phone',
    folder: `test-results/human-e2e/${cycleCustomizationEvidenceDate}/cycle-customization-current`,
    evidence: 'summary.json',
    requiredSchemaVersion: 1,
    requiredViewports: ['360 x 640', '390 x 844'],
    requiredVerified: [
      'Auto-to-Custom initialization',
      'non-mutating Cancel',
      'browser Back prevention',
      'stable product identity',
      'retained cadence-excess intent',
      'closed cadence-review gate',
      'Settings, Week, Why Tonight, Plan, and Today agreement',
      'zero horizontal overflow',
    ],
    expected:
      'Custom Save/Cancel, stable authored identity, retained intent, failed-write and pending-Back recovery, closed review-gate behavior, exact reconciliation provenance, and Settings/Week/Why Tonight/Plan/Today agreement pass at 360 x 640 and 390 x 844.',
  },
  {
    id: 'shelf-freshness-provenance-supported-phone',
    title: 'Shelf freshness and replacement provenance lifecycle',
    kind: 'summary-status',
    required: true,
    supportClass: 'supported-phone',
    folder: `test-results/human-e2e/${shelfFreshnessProvenanceEvidenceDate}/shelf-freshness-provenance-current`,
    evidence: 'summary.json',
    requiredSchemaVersion: 1,
    requiredStatus: 'pass',
    requiredFailedRouteCount: 0,
    requiredViewports: ['360 x 640', '390 x 844'],
    requiredVerified: [
      'Onboarding freshness capture',
      'unopened units keep openedAt null',
      'impossible and future dates',
      'explicit open-jar label confirmation',
      'winning expiry source',
      'reload preserves',
      'new UUID without inheriting printed expiry',
      'replenishment alerts remain off until explicit Settings opt-in',
      'zero horizontal overflow',
    ],
    expected:
      'Onboarding freshness intake, honest opened/PAO/expiry provenance, reload, replacement identity/history, explicit replenishment opt-in, and supported-phone geometry pass.',
  },
  {
    id: 'data-export-local-photo-disclosure-supported-phone',
    title: 'Account export local-photo scope disclosure',
    kind: 'summary-status',
    required: true,
    supportClass: 'supported-phone',
    folder: `test-results/human-e2e/${dataExportDisclosureEvidenceDate}/data-export-local-photo-disclosure-current`,
    evidence: 'summary.json',
    expected:
      'Settings discloses the device-only Progress-photo exclusion before export and preserves it through inline failure recovery.',
  },
  {
    id: 'data-export-combined-device-supported-phone',
    title: 'Combined account and current-device export',
    kind: 'summary-status',
    required: true,
    supportClass: 'supported-phone',
    folder: `test-results/human-e2e/${combinedDataExportEvidenceDate}/data-export-combined-device-current`,
    evidence: 'summary.json',
    expected:
      'Settings names the account/current-device scope and Progress media exclusion; backend-free recovery keeps zero dialogs, overflow, unexpected logs, analytics, or Edge requests.',
  },
  {
    id: 'data-export-account-generation-supported-phone',
    title: 'Account-generation-bound combined export',
    kind: 'summary-status',
    required: true,
    supportClass: 'supported-phone',
    folder: `test-results/human-e2e/${accountGenerationExportEvidenceDate}/data-export-account-generation-current`,
    evidence: 'summary.json',
    requiredSchemaVersion: 1,
    requiredViewports: ['360 x 640', '390 x 844'],
    requiredVerified: [
      'one cancellable account-generation lease',
      'sign-out during a delayed export',
      'configured server user_id',
      'account boundary aborts the Edge request',
      'post-write invalidation deletes',
      'nested boundaries',
      '360 x 640',
      '390 x 844',
    ],
    expected:
      'One account generation owns authenticated capture, local snapshot, Edge response, plaintext cache, share, and deletion; sign-out/A-to-B aborts and drains stale work before the next account can publish.',
  },
];

const warnings = [
  'This manifest verifies committed local Expo web evidence only; it does not replace physical iOS/Android device QA.',
  'Supported-phone 200% text-pressure gates listed in this manifest are launch-required local Expo web evidence; 320 x 568, 320 x 480, 320 x 430, 320 x 390, 320 x 370, and 320 x 360 remain resilience stress evidence unless tied to a supported physical device.',
  'Native keyboard events, Dynamic Type, VoiceOver/TalkBack, camera hardware, notification delivery, StoreKit/Play Billing, RevenueCat, and live Supabase remain separate release gates.',
];
const blockers = [];
let trackedRepoFiles;
try {
  trackedRepoFiles = listGitTrackedRepoFiles();
} catch (error) {
  console.error(
    `FAIL Could not enumerate Git-tracked evidence files: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
  process.exit(1);
}
const gateResults = gates.map((gate) => {
  const evidencePath = `${gate.folder}/${gate.evidence}`;
  const folderExists = exists(gate.folder);
  const evidenceExists = exists(evidencePath);
  const evidenceTracked = trackedRepoFiles.has(normalizeRepoPath(evidencePath));
  const footprint = walkEvidence(gate.folder, trackedRepoFiles);
  let status = 'blocked';
  let detail = 'Missing evidence folder or file.';
  let failureCount = null;
  let verdict = null;
  const requirementFailures = [];

  if (!gate.required && (!folderExists || !evidenceExists)) {
    status = 'skipped';
    detail = `Optional ${gate.supportClass} evidence not present for this date.`;
  } else if (gate.required && evidenceExists && !evidenceTracked) {
    detail = 'Required evidence file is not Git-tracked.';
  } else if (folderExists && evidenceExists) {
    try {
      if (gate.kind === 'failures') {
        failureCount = parseFailureCount(evidencePath);
        status = failureCount === 0 ? 'pass' : 'fail';
        detail = `${failureCount} failure${failureCount === 1 ? '' : 's'} recorded.`;
      } else if (gate.kind === 'summary-verdict') {
        const summary = readJson(evidencePath);
        verdict = String(summary.verdict ?? '')
          .trim()
          .toLowerCase();
        status = verdict === 'pass' ? 'pass' : 'fail';
        detail = `summary verdict: ${verdict || 'missing'}.`;
      } else if (gate.kind === 'summary-status') {
        const summary = readJson(evidencePath);
        verdict = String(summary.status ?? summary.verdict ?? '')
          .trim()
          .toLowerCase();
        if (typeof summary?.failedRouteCount === 'number') {
          failureCount = summary.failedRouteCount;
        } else if (Array.isArray(summary?.failedRoutes)) {
          failureCount = summary.failedRoutes.length;
        }
        if (
          typeof gate.requiredSchemaVersion === 'number' &&
          summary?.schemaVersion !== gate.requiredSchemaVersion
        ) {
          requirementFailures.push(
            `schemaVersion must be ${gate.requiredSchemaVersion}, received ${String(summary?.schemaVersion ?? 'missing')}`,
          );
        }
        if (
          typeof gate.requiredStatus === 'string' &&
          String(summary?.status ?? '')
            .trim()
            .toLowerCase() !== gate.requiredStatus
        ) {
          requirementFailures.push(
            `status must be ${gate.requiredStatus}, received ${String(summary?.status ?? 'missing')}`,
          );
        }
        if (
          typeof gate.requiredFailedRouteCount === 'number' &&
          summary?.failedRouteCount !== gate.requiredFailedRouteCount
        ) {
          requirementFailures.push(
            `failedRouteCount must be ${gate.requiredFailedRouteCount}, received ${String(summary?.failedRouteCount ?? 'missing')}`,
          );
        }
        const summaryViewports = Array.isArray(summary?.viewports)
          ? summary.viewports.map((value) => String(value))
          : [];
        for (const viewport of gate.requiredViewports ?? []) {
          if (!summaryViewports.includes(viewport)) {
            requirementFailures.push(`missing required viewport ${viewport}`);
          }
        }
        const verified = Array.isArray(summary?.verified)
          ? summary.verified.map((value) => String(value))
          : [];
        for (const needle of gate.requiredVerified ?? []) {
          if (!verified.some((value) => value.includes(needle))) {
            requirementFailures.push(`missing verified coverage: ${needle}`);
          }
        }
        status =
          verdict === 'pass' &&
          (failureCount == null || failureCount === 0) &&
          requirementFailures.length === 0
            ? 'pass'
            : 'fail';
        detail =
          failureCount == null
            ? `summary status: ${verdict || 'missing'}.`
            : `summary status: ${verdict || 'missing'}; ${failureCount} failed route${
                failureCount === 1 ? '' : 's'
              }.`;
        if (requirementFailures.length > 0) {
          detail = `${detail} ${requirementFailures.join('; ')}.`;
        }
      }
    } catch (error) {
      status = 'fail';
      detail = error instanceof Error ? error.message : String(error);
    }
  }

  if (gate.required && status !== 'pass') blockers.push(`${gate.title}: ${detail}`);

  return {
    ...gate,
    status,
    detail,
    failureCount,
    verdict,
    ...(gate.requiredSchemaVersion != null ||
    gate.requiredStatus != null ||
    gate.requiredFailedRouteCount != null ||
    gate.requiredViewports ||
    gate.requiredVerified
      ? { requirementFailures }
      : {}),
    folderExists,
    evidenceExists,
    evidenceTracked,
    fileCount: footprint.files,
    bytes: footprint.bytes,
    evidenceSha256: evidenceExists && evidenceTracked ? hashFile(evidencePath) : null,
  };
});

const packet = {
  generatedAt: new Date().toISOString(),
  gitSha: command('git', ['rev-parse', 'HEAD']),
  evidenceDate: latestManifestEvidenceDate,
  baselineEvidenceDate: evidenceDate,
  status: blockers.length === 0 ? 'pass' : 'blocked',
  purpose: 'Durable local human-simulated E2E manifest for Expo web-compatible launch gates.',
  gateResults,
  warnings,
  blockers,
};

const outDir = abs(process.env.E2E_MANIFEST_OUT_DIR ?? 'docs/e2e/generated');
mkdirSync(outDir, { recursive: true });
const jsonPath = join(outDir, 'human-e2e-manifest.json');
const mdPath = join(outDir, 'human-e2e-manifest.md');

const gateRows = gateResults.map((gate) => [
  gate.title,
  gate.supportClass,
  gate.status,
  gate.detail,
  gate.fileCount,
  rel(abs(gate.folder)),
]);

const markdown = [
  '# Human E2E Manifest',
  '',
  `Generated: ${packet.generatedAt}`,
  `Git SHA: ${packet.gitSha || 'unknown'}`,
  `Evidence date: ${packet.evidenceDate}`,
  `Baseline suite date: ${packet.baselineEvidenceDate}`,
  `Status: ${packet.status}`,
  '',
  'This generated packet is created by `npm run e2e:human:manifest`. It turns',
  'the committed Expo web-compatible human-simulated E2E evidence into a',
  'repeatable local gate without adding a Playwright, Detox, Maestro, or Appium',
  'dependency to the repo.',
  '',
  '## Gates',
  '',
  markdownTable(['Gate', 'Class', 'Status', 'Detail', 'Files', 'Folder'], gateRows),
  '',
  '## Warnings',
  '',
  ...warnings.map((warning) => `- ${warning}`),
  '',
  '## Blockers',
  '',
  ...(blockers.length > 0 ? blockers.map((blocker) => `- ${blocker}`) : ['- None.']),
  '',
].join('\n');

function comparablePacket(value) {
  if (!value || typeof value !== 'object') return value;
  const { generatedAt: _generatedAt, gitSha: _gitSha, ...rest } = value;
  return rest;
}

function comparableMarkdown(value) {
  return value
    .replace(/^Generated: .+$/m, 'Generated: <ignored>')
    .replace(/^Git SHA: .+$/m, 'Git SHA: <ignored>');
}

if (check) {
  if (!existsSync(jsonPath)) {
    console.error(`FAIL Missing ${rel(jsonPath)}. Run npm run e2e:human:manifest.`);
    process.exit(1);
  }
  if (!existsSync(mdPath)) {
    console.error(`FAIL Missing ${rel(mdPath)}. Run npm run e2e:human:manifest.`);
    process.exit(1);
  }

  let existingPacket;
  try {
    existingPacket = JSON.parse(readFileSync(jsonPath, 'utf8'));
  } catch (error) {
    console.error(
      `FAIL Could not parse ${rel(jsonPath)}: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }

  const expected = JSON.stringify(comparablePacket(packet), null, 2);
  const actual = JSON.stringify(comparablePacket(existingPacket), null, 2);
  if (actual !== expected) {
    console.error(
      `FAIL ${rel(jsonPath)} is stale or does not match current evidence. Run npm run e2e:human:manifest.`,
    );
    process.exit(1);
  }

  const recordedSha = String(existingPacket.gitSha ?? '').trim();
  if (!/^[a-f0-9]{40}$/i.test(recordedSha)) {
    console.error(`FAIL ${rel(jsonPath)} does not record a full source Git SHA.`);
    process.exit(1);
  }

  const allowedGeneratedPaths = new Set([rel(jsonPath), rel(mdPath)]);
  let changedSinceRecorded = [];
  try {
    changedSinceRecorded = commandRequired('git', ['diff', '--name-only', `${recordedSha}..HEAD`])
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  } catch (error) {
    console.error(
      `FAIL Could not compare ${recordedSha} to HEAD: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    process.exit(1);
  }

  const disallowedCommittedChanges = changedSinceRecorded.filter(
    (path) =>
      !allowedGeneratedPaths.has(normalizeRepoPath(path)) && !ignoredGeneratedOutputPath(path),
  );
  if (disallowedCommittedChanges.length > 0) {
    console.error(
      `FAIL ${rel(jsonPath)} was generated before later committed source/evidence changes: ${disallowedCommittedChanges.join(', ')}. Run npm run e2e:human:manifest after those changes and commit the generated outputs separately.`,
    );
    process.exit(1);
  }

  const dirtyGeneratedOrTracked = command('git', ['status', '--short', '--untracked-files=no'])
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .filter((line) => {
      const statusPath = normalizeRepoPath(line.replace(/^[ MADRCU?!]{1,2}\s+/, ''));
      return !allowedGeneratedPaths.has(statusPath) && !ignoredGeneratedOutputPath(statusPath);
    });
  if (dirtyGeneratedOrTracked.length > 0) {
    console.error(
      `FAIL tracked files outside the generated manifest are dirty: ${dirtyGeneratedOrTracked.join(', ')}.`,
    );
    process.exit(1);
  }

  const expectedMarkdown = comparableMarkdown(markdown);
  const actualMarkdown = comparableMarkdown(readFileSync(mdPath, 'utf8'));
  if (actualMarkdown !== expectedMarkdown) {
    console.error(
      `FAIL ${rel(mdPath)} is stale or does not match current evidence. Run npm run e2e:human:manifest.`,
    );
    process.exit(1);
  }

  console.log('Human E2E manifest is current.');
} else {
  writeFileSync(jsonPath, `${JSON.stringify(packet, null, 2)}\n`);
  writeFileSync(mdPath, markdown);

  console.log(`Wrote ${rel(jsonPath)}`);
  console.log(`Wrote ${rel(mdPath)}`);
}

if (blockers.length > 0) {
  for (const blocker of blockers) console.error(`FAIL ${blocker}`);
  process.exit(1);
}

if (strict && warnings.length > 0) {
  for (const warning of warnings) console.warn(`WARN ${warning}`);
}

console.log('Human E2E manifest passed local evidence gates.');
