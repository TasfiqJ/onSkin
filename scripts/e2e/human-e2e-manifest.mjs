#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

import { PNG } from 'pngjs';

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

const ignoredUntrackedRuntimeOutputPatterns = [/^\.tmp(?:\/|$)/];

function ignoredGeneratedOutputPath(path) {
  const normalized = normalizeRepoPath(path);
  return ignoredGeneratedOutputPatterns.some((pattern) => pattern.test(normalized));
}

function ignoredUntrackedRuntimeOutputPath(path) {
  const normalized = normalizeRepoPath(path);
  return ignoredUntrackedRuntimeOutputPatterns.some((pattern) => pattern.test(normalized));
}

function collectDisallowedUntrackedRepoFiles(
  paths,
  { allowedExactPaths = [], allowedPrefixes = [] } = {},
) {
  const exact = new Set([...allowedExactPaths].map(normalizeRepoPath));
  const prefixes = [...allowedPrefixes].map(normalizeRepoPath);
  return [...new Set(paths.map(normalizeRepoPath).filter(Boolean))]
    .filter(
      (path) =>
        !exact.has(path) &&
        !prefixes.some((prefix) => path.startsWith(prefix)) &&
        !ignoredGeneratedOutputPath(path) &&
        !ignoredUntrackedRuntimeOutputPath(path),
    )
    .sort();
}

function exists(path) {
  return existsSync(abs(path));
}

function readJson(path) {
  return JSON.parse(readFileSync(abs(path), 'utf8'));
}

const JPEG_SOF_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

function parseJpegDimensions(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 11 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw new Error('invalid JPEG start marker');
  }
  let offset = 2;
  while (offset + 3 < bytes.length) {
    if (bytes[offset] !== 0xff) throw new Error('invalid JPEG marker boundary');
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.length) break;
    const marker = bytes[offset];
    offset += 1;
    if (marker === 0x00 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) continue;
    if (offset + 2 > bytes.length) throw new Error('truncated JPEG segment');
    const length = bytes.readUInt16BE(offset);
    if (length < 2 || offset + length > bytes.length)
      throw new Error('invalid JPEG segment length');
    if (JPEG_SOF_MARKERS.has(marker)) {
      if (length < 7) throw new Error('truncated JPEG frame header');
      const height = bytes.readUInt16BE(offset + 3);
      const width = bytes.readUInt16BE(offset + 5);
      if (width < 1 || height < 1) throw new Error('invalid JPEG dimensions');
      return { width, height };
    }
    if (marker === 0xda || marker === 0xd9) break;
    offset += length;
  }
  throw new Error('JPEG frame dimensions not found');
}

function readJpegDimensions(path) {
  return parseJpegDimensions(readFileSync(abs(path)));
}

function normalizeEvidenceRelativePath(path) {
  if (typeof path !== 'string') return null;
  const normalized = normalizeRepoPath(path.trim());
  const segments = normalized.split('/');
  if (
    normalized.length === 0 ||
    normalized.startsWith('/') ||
    /^[A-Za-z]:\//.test(normalized) ||
    segments.some((segment) => segment.length === 0 || segment === '.' || segment === '..')
  ) {
    return null;
  }
  return normalized;
}

function collectEvidenceProvenanceFailures({
  folder,
  evidence,
  requiredFiles = [],
  summaryArtifacts,
  trackedRepoFiles,
  fileExists = exists,
  validateRequiredFiles = true,
  validateSummaryArtifacts = false,
}) {
  const failures = [];

  if (validateRequiredFiles) {
    for (const requiredFile of requiredFiles) {
      const normalized = normalizeEvidenceRelativePath(requiredFile);
      if (!normalized) {
        failures.push(`required evidence file uses an unsafe path: ${String(requiredFile)}`);
        continue;
      }
      const requiredPath = `${folder}/${normalized}`;
      if (!fileExists(requiredPath)) {
        failures.push(`missing required evidence file ${normalized}`);
      } else if (!trackedRepoFiles.has(normalizeRepoPath(requiredPath))) {
        failures.push(`required evidence file is not Git-tracked: ${normalized}`);
      }
    }
  }

  if (!validateSummaryArtifacts) return failures;
  if (!Array.isArray(summaryArtifacts)) {
    failures.push('summary.artifacts must be an array');
    return failures;
  }

  const declaredArtifacts = new Set();
  for (const artifact of summaryArtifacts) {
    const normalized = normalizeEvidenceRelativePath(artifact);
    if (!normalized) {
      failures.push(`summary.artifacts contains an unsafe path: ${String(artifact)}`);
      continue;
    }
    if (declaredArtifacts.has(normalized)) {
      failures.push(`summary.artifacts contains a duplicate path: ${normalized}`);
      continue;
    }
    declaredArtifacts.add(normalized);

    const artifactPath = `${folder}/${normalized}`;
    if (!fileExists(artifactPath)) {
      failures.push(`missing summary artifact ${normalized}`);
    } else if (!trackedRepoFiles.has(normalizeRepoPath(artifactPath))) {
      failures.push(`summary artifact is not Git-tracked: ${normalized}`);
    }
  }

  const normalizedEvidence = normalizeEvidenceRelativePath(evidence);
  for (const requiredFile of requiredFiles) {
    const normalized = normalizeEvidenceRelativePath(requiredFile);
    if (!normalized || normalized === normalizedEvidence) continue;
    if (!declaredArtifacts.has(normalized)) {
      failures.push(`summary.artifacts is missing required evidence file ${normalized}`);
    }
  }

  return failures;
}

function collectRequiredTextFailures({ label, text, requiredText = [] }) {
  const failures = [];
  for (const requiredFragment of requiredText) {
    if (typeof requiredFragment !== 'string' || requiredFragment.length === 0) {
      failures.push(`${label} contains an invalid required text fragment`);
    } else if (!text.includes(requiredFragment)) {
      failures.push(`${label} is missing required text: ${requiredFragment}`);
    }
  }
  return failures;
}

function hasExactObjectKeys(value, expectedKeys) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

const CAT04_CATALOG_VIEWPORTS = Object.freeze([
  Object.freeze({ id: 'iphone-375x667', width: 375, height: 667 }),
  Object.freeze({ id: 'iphone-390x844', width: 390, height: 844 }),
  Object.freeze({ id: 'iphone-430x932', width: 430, height: 932 }),
]);

const CAT04_CATALOG_FIXTURE_GROUPS = Object.freeze([
  'matched',
  'no-match',
  'offline',
  'scan-error',
  'camera-recovery',
  'ocr-capture-failure',
]);

const CAT04_CATALOG_SCENARIOS = Object.freeze([
  Object.freeze({
    id: 'search-matched',
    fixture: 'matched',
    groupId: 'matched',
    route: '/shelf/search',
  }),
  Object.freeze({
    id: 'scan-matched',
    fixture: 'matched',
    groupId: 'matched',
    route: '/shelf/scan',
  }),
  Object.freeze({
    id: 'scan-wrong-match-recovery',
    fixture: 'matched_wrong_match_recovery',
    groupId: 'matched',
    route: '/shelf/scan',
  }),
  Object.freeze({
    id: 'search-no-match',
    fixture: 'no_match',
    groupId: 'no-match',
    route: '/shelf/search',
  }),
  Object.freeze({
    id: 'scan-no-match',
    fixture: 'no_match',
    groupId: 'no-match',
    route: '/shelf/scan',
  }),
  Object.freeze({
    id: 'search-wrong-match-recovery',
    fixture: 'wrong_match',
    groupId: 'scan-error',
    route: '/shelf/search',
  }),
  Object.freeze({
    id: 'search-offline',
    fixture: 'offline',
    groupId: 'offline',
    route: '/shelf/search',
  }),
  Object.freeze({
    id: 'scan-offline',
    fixture: 'offline',
    groupId: 'offline',
    route: '/shelf/scan',
  }),
  Object.freeze({
    id: 'scan-error',
    fixture: 'error',
    groupId: 'scan-error',
    route: '/shelf/scan',
  }),
  Object.freeze({
    id: 'scan-camera-denied-settings-failure',
    fixture: 'denied_no_retry',
    groupId: 'camera-recovery',
    route: '/shelf/scan',
  }),
  Object.freeze({
    id: 'ocr-camera-denied-settings-failure',
    fixture: 'denied_no_retry',
    groupId: 'camera-recovery',
    route: '/shelf/ocr',
  }),
  Object.freeze({
    id: 'ocr-capture-failure',
    fixture: 'capture_failure_once',
    groupId: 'ocr-capture-failure',
    route: '/shelf/ocr',
  }),
  Object.freeze({
    id: 'no-match-missing-barcode',
    fixture: 'missing_barcode',
    groupId: 'ocr-capture-failure',
    route: '/shelf/no-match',
  }),
  Object.freeze({
    id: 'catalog-recovery-malformed',
    fixture: 'malformed_params',
    groupId: 'ocr-capture-failure',
    route: '/shelf/catalog-recovery',
  }),
  Object.freeze({
    id: 'manual-barcode-validation',
    fixture: 'manual_barcode_validation',
    groupId: 'ocr-capture-failure',
    route: '/shelf/manual',
  }),
]);

function cat04ViewportKey(viewport) {
  if (!hasExactObjectKeys(viewport, ['id', 'width', 'height'])) return null;
  const expected = CAT04_CATALOG_VIEWPORTS.find(({ id }) => id === viewport.id);
  if (!expected || viewport.width !== expected.width || viewport.height !== expected.height) {
    return null;
  }
  return expected.id;
}

const CAT05_NATIVE_OCR_EVIDENCE_DATE = '2026-07-18';
const CAT05_NATIVE_OCR_SCHEMA_VERSION = 2;
const CAT05_NATIVE_OCR_ARTIFACT_COUNT = 139;
const CAT05_NATIVE_OCR_SCREENSHOT_COUNT = 55;
const CAT05_NATIVE_OCR_MAX_EXPO_LOG_BYTES = 256 * 1024;
const CAT05_NATIVE_OCR_MAX_DIAGNOSTIC_ARTIFACT_BYTES = 8 * 1024 * 1024;
const CAT05_NATIVE_OCR_MAX_DIAGNOSTIC_STRING_BYTES = 128 * 1024;
const CAT05_NATIVE_OCR_MAX_SCREENSHOT_BYTES = 16 * 1024 * 1024;
const CAT05_NATIVE_OCR_MAX_RETAINED_BROWSER_EVENTS = 5_000;
const CAT05_NATIVE_OCR_MAX_BROWSER_EVENT_BYTES = 4 * 1024 * 1024;
const CAT05_NATIVE_OCR_VIEWPORTS = Object.freeze([
  Object.freeze({ id: 'iphone-375x667', width: 375, height: 667 }),
  Object.freeze({ id: 'iphone-390x844', width: 390, height: 844 }),
  Object.freeze({ id: 'iphone-430x932', width: 430, height: 932 }),
]);
const CAT05_NATIVE_OCR_FIXTURE_GROUPS = Object.freeze([
  'recognized',
  'no-text',
  'timed-out',
  'failed',
]);
const CAT05_NATIVE_OCR_SCENARIOS = Object.freeze([
  Object.freeze({
    fixture: 'recognized',
    groupId: 'recognized',
    id: 'recognized-review-retake-continue',
  }),
  Object.freeze({
    fixture: 'recognized',
    groupId: 'recognized',
    id: 'edit-fence-suggestion-adoption',
  }),
  Object.freeze({
    fixture: 'no_text',
    groupId: 'no-text',
    id: 'no-text-manual-recovery',
  }),
  Object.freeze({
    fixture: 'timed_out',
    groupId: 'timed-out',
    id: 'timeout-manual-recovery',
  }),
  Object.freeze({ fixture: 'failed', groupId: 'failed', id: 'failure-manual-recovery' }),
]);
const CAT05_NATIVE_OCR_CANDIDATE_BUILD = Object.freeze({
  archiveSha256: null,
  easIosBuildId: null,
  executedByThisAudit: false,
  profile: 'staging',
  proofStatus: 'not_applicable_to_expo_web_ui_audit',
});
const CAT05_NATIVE_OCR_LIMITATIONS = Object.freeze([
  'This is deterministic Expo-web UI-state evidence produced by a development-only fixture.',
  'It does not execute Apple Vision, the Swift bridge, a camera, a real label image, or an iOS binary.',
  'Its raw-photo cache and cleanup checks are source assertions only; they do not prove runtime deletion, cache behavior, or privacy on a native device.',
  'It is not physical-iPhone, iOS Simulator, native accessibility, OCR accuracy, OCR latency, runtime cleanup, native privacy, zero-network, archive, App Review, or release evidence.',
  'Its local-only browser-request assertion covers this synthetic web run only and must not be used as a native photo or transcript privacy claim.',
]);
const CAT05_NATIVE_OCR_PROVES = Object.freeze([
  'The Expo-web route renders and permits user interaction with the declared deterministic OCR review states.',
  'The route preserves a user edit against a late deterministic fixture result and requires explicit suggestion adoption.',
  'The route preserves the fixture Unicode transcript through the editable review and supported manual handoff surface.',
  'The supported web viewports pass the scripted control-name, 44px proxy, center-hit, clipping, and horizontal-overflow checks.',
  'The synthetic browser run emitted no disallowed console/page/network/dialog failure under the local-only fixture environment.',
  'The source candidate contains the declared no-cache preview, trusted-cache-URI, guarded-navigation, and awaited-cleanup assertions; this is source proof only.',
]);
const CAT05_NATIVE_OCR_PRIVACY_ASSERTIONS = Object.freeze([
  'label-preview-hidden-during-cleanup-and-cache-disabled',
  'label-route-removal-cancels-recognition-before-photo-cleanup',
  'progress-capture-accepts-only-trusted-camera-cache-uri',
  'progress-review-preview-cache-disabled',
  'progress-review-route-removal-awaits-discard',
  'progress-helper-restricts-and-deletes-owned-cache-source',
]);
const CAT05_NATIVE_OCR_PRIVACY_FILES = Object.freeze([
  'apps/mobile/src/app/progress/capture.tsx',
  'apps/mobile/src/app/progress/review.tsx',
  'apps/mobile/src/app/shelf/ocr.tsx',
  'apps/mobile/src/features/photos/progressCapturePrivacy.ts',
]);
const CAT05_DOCUMENTATION_ONLY_ROOT_PATHS = new Set([
  'BLOCKERS.md',
  'LAUNCH_READINESS.md',
  'PROGRESS.md',
]);

function cat05DocumentationOnlyPath(path) {
  const normalized = normalizeRepoPath(path);
  return normalized.startsWith('docs/') || CAT05_DOCUMENTATION_ONLY_ROOT_PATHS.has(normalized);
}
const CAT05_NATIVE_OCR_SUMMARY_KEYS = Object.freeze([
  'artifactCount',
  'artifactManifest',
  'artifacts',
  'browserFailureCount',
  'browserPath',
  'candidateNativeBuild',
  'completedAt',
  'evidenceBinding',
  'evidenceSchemaVersion',
  'expectedBootstrapCount',
  'expectedExecutionCount',
  'fixtureGroups',
  'groupBrowserAudits',
  'limitations',
  'nativeDeviceProof',
  'passedBootstrapCount',
  'passedExecutionCount',
  'privacySourceContract',
  'results',
  'runId',
  'scenarioMatrix',
  'screenshots',
  'sourceGitSha',
  'startedAt',
  'surface',
  'verdict',
  'viewports',
  'webFixtureBuild',
]);
const CAT05_NATIVE_OCR_BINDING_KEYS = Object.freeze([
  'candidateNativeBuild',
  'evidenceSchemaVersion',
  'expectedSourceGitSha',
  'fixtureConfigurationSha256',
  'runId',
  'scenarioMatrixSha256',
  'sourceGitSha',
  'viewportMatrixSha256',
  'webFixtureBuild',
]);
const CAT05_NATIVE_OCR_ARTIFACT_BINDING_KEYS = Object.freeze([
  ...CAT05_NATIVE_OCR_BINDING_KEYS,
  'artifactName',
  'fixtureGroup',
  'scenarioId',
  'viewport',
]);

function cat05Sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function cat05Sha256Json(value) {
  return cat05Sha256(JSON.stringify(value));
}

function cat05ViewportKey(viewport) {
  if (!hasExactObjectKeys(viewport, ['id', 'width', 'height'])) return null;
  const expected = CAT05_NATIVE_OCR_VIEWPORTS.find(({ id }) => id === viewport.id);
  if (!expected || viewport.width !== expected.width || viewport.height !== expected.height) {
    return null;
  }
  return expected.id;
}

function cat05ArtifactPair(prefix) {
  return [`${prefix}.json`, `${prefix}.png`];
}

function expectedCat05NativeOcrArtifacts() {
  const artifacts = ['report.md', 'scope.json'];
  const bootstrapViewport = CAT05_NATIVE_OCR_VIEWPORTS[1];
  for (const fixtureGroup of CAT05_NATIVE_OCR_FIXTURE_GROUPS) {
    const prefix = `bootstrap-${fixtureGroup}-${bootstrapViewport.id}`;
    artifacts.push(
      `browser-events-${fixtureGroup}.json`,
      `expo-${fixtureGroup}.log`,
      ...cat05ArtifactPair(`${prefix}-ocr-ready`),
      `${prefix}-result.json`,
    );
  }
  for (const scenario of CAT05_NATIVE_OCR_SCENARIOS) {
    for (const viewport of CAT05_NATIVE_OCR_VIEWPORTS) {
      const prefix = `${scenario.id}-${viewport.id}`;
      artifacts.push(...cat05ArtifactPair(`${prefix}-initial`), `${prefix}-result.json`);
      if (scenario.id === 'recognized-review-retake-continue') {
        artifacts.push(
          ...cat05ArtifactPair(`${prefix}-recognized-ready`),
          ...cat05ArtifactPair(`${prefix}-retake-ready`),
          ...cat05ArtifactPair(`${prefix}-manual-handoff`),
        );
      } else if (scenario.id === 'edit-fence-suggestion-adoption') {
        artifacts.push(
          ...cat05ArtifactPair(`${prefix}-edit-kept`),
          ...cat05ArtifactPair(`${prefix}-suggestion-adopted`),
          ...cat05ArtifactPair(`${prefix}-manual-handoff`),
        );
      } else {
        const stateSuffix = {
          'failure-manual-recovery': 'failed',
          'no-text-manual-recovery': 'no-text',
          'timeout-manual-recovery': 'timed-out',
        }[scenario.id];
        artifacts.push(
          ...cat05ArtifactPair(`${prefix}-${stateSuffix}`),
          ...cat05ArtifactPair(`${prefix}-manual-handoff`),
        );
      }
    }
  }
  return [...new Set(artifacts)].sort();
}

function expectedCat05ArtifactBindingMetadata(artifact) {
  if (artifact === 'scope.json') return null;
  const artifactName = artifact.replace(/\.json$/u, '');
  for (const scenario of CAT05_NATIVE_OCR_SCENARIOS) {
    for (const viewport of CAT05_NATIVE_OCR_VIEWPORTS) {
      if (!artifactName.startsWith(`${scenario.id}-${viewport.id}-`)) continue;
      return {
        artifactName,
        fixtureGroup: scenario.groupId,
        scenarioId: scenario.id,
        viewport: { height: viewport.height, id: viewport.id, width: viewport.width },
      };
    }
  }
  const bootstrapViewport = CAT05_NATIVE_OCR_VIEWPORTS[1];
  for (const fixtureGroup of CAT05_NATIVE_OCR_FIXTURE_GROUPS) {
    if (artifactName.startsWith(`bootstrap-${fixtureGroup}-${bootstrapViewport.id}-`)) {
      return {
        artifactName,
        fixtureGroup,
        scenarioId: null,
        viewport: {
          height: bootstrapViewport.height,
          id: bootstrapViewport.id,
          width: bootstrapViewport.width,
        },
      };
    }
    if (artifactName === `browser-events-${fixtureGroup}`) {
      return { artifactName, fixtureGroup, scenarioId: null, viewport: null };
    }
  }
  return undefined;
}

function cat05ExpectedScreenshotDimensions(artifact) {
  for (const viewport of CAT05_NATIVE_OCR_VIEWPORTS) {
    if (artifact.includes(`-${viewport.id}-`)) {
      return { height: viewport.height, width: viewport.width };
    }
  }
  return null;
}

function parsePngDimensions(bytes) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!Buffer.isBuffer(bytes) || bytes.length < 45 || !bytes.subarray(0, 8).equals(signature)) {
    throw new Error('invalid PNG signature or complete chunk stream');
  }
  if (bytes.length > CAT05_NATIVE_OCR_MAX_SCREENSHOT_BYTES) {
    throw new Error(`PNG exceeds ${CAT05_NATIVE_OCR_MAX_SCREENSHOT_BYTES} bytes`);
  }

  let offset = signature.length;
  let chunkIndex = 0;
  let sawHeader = false;
  let sawImageData = false;
  let sawEnd = false;
  let headerDimensions = null;
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) throw new Error('truncated PNG chunk header');
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString('ascii');
    const nextOffset = offset + 12 + length;
    if (!/^[A-Za-z]{4}$/.test(type) || nextOffset > bytes.length) {
      throw new Error('invalid or truncated PNG chunk');
    }
    if (type === 'IHDR') {
      if (chunkIndex !== 0 || sawHeader || length !== 13) {
        throw new Error('PNG must contain one leading 13-byte IHDR chunk');
      }
      const width = bytes.readUInt32BE(offset + 8);
      const height = bytes.readUInt32BE(offset + 12);
      if (width < 1 || height < 1 || width > 4096 || height > 4096) {
        throw new Error('invalid or unsafe PNG dimensions');
      }
      headerDimensions = { height, width };
      sawHeader = true;
    } else if (type === 'IDAT') {
      if (!sawHeader || sawEnd) throw new Error('PNG IDAT appears outside the image stream');
      sawImageData = true;
    } else if (type === 'IEND') {
      if (!sawHeader || !sawImageData || sawEnd || length !== 0 || nextOffset !== bytes.length) {
        throw new Error('PNG must end with one terminal zero-byte IEND chunk');
      }
      sawEnd = true;
    }
    offset = nextOffset;
    chunkIndex += 1;
  }
  if (!sawHeader || !sawImageData || !sawEnd || !headerDimensions) {
    throw new Error('PNG is missing IHDR, IDAT, or IEND');
  }

  let decoded;
  try {
    decoded = PNG.sync.read(bytes, { checkCRC: true });
  } catch (error) {
    throw new Error(
      `PNG decode or CRC validation failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (
    decoded.width !== headerDimensions.width ||
    decoded.height !== headerDimensions.height ||
    !decoded.data ||
    decoded.data.length !== decoded.width * decoded.height * 4
  ) {
    throw new Error('decoded PNG pixels do not match the declared IHDR dimensions');
  }
  return headerDimensions;
}

function cat05DiagnosticPolicyFailures(label, value) {
  const failures = [];
  const text = String(value ?? '');
  const normalizedPathText = text.replaceAll('\\\\', '\\');
  if (
    /(?:^|[\s"'(])(?:[A-Za-z]:[\\/]|\\\\[^\\\s]+[\\/][^\\\s]+|\/(?:Users|home|private|root|tmp|workspace)\/)/iu.test(
      normalizedPathText,
    ) ||
    /[\\/]AppData[\\/]Local[\\/]Temp[\\/]/iu.test(normalizedPathText) ||
    /\/var\/folders\//iu.test(normalizedPathText) ||
    /\.claude[\\/]worktrees[\\/]/iu.test(normalizedPathText)
  ) {
    failures.push(`${label} contains a user-profile, temporary, or worktree absolute path`);
  }
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(text)) {
    failures.push(`${label} contains a disallowed control character`);
  }
  if (/\b(?:assets-library|blob|content|data|file|filesystem|ph):[^\s<>"')\]}]*/iu.test(text)) {
    failures.push(`${label} contains a sensitive URI literal`);
  }
  const urlLiterals = text.match(/\b(?:https?|wss?):\/\/[^\s<>"')\]}]+/giu) ?? [];
  for (const literal of urlLiterals) {
    let parsed;
    try {
      parsed = new URL(literal);
    } catch {
      failures.push(`${label} contains a malformed network URL literal`);
      continue;
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'ws:') {
      failures.push(`${label} contains a disallowed ${parsed.protocol} URL literal`);
      continue;
    }
    if (parsed.hostname !== 'localhost') {
      failures.push(`${label} contains a non-localhost network URL literal`);
      continue;
    }
    if (parsed.username || parsed.password) {
      failures.push(`${label} contains credentials in a localhost URL literal`);
    }
    if (parsed.hash) {
      failures.push(`${label} contains an unredacted URL fragment`);
    }
    if (parsed.search && parsed.search !== '?redacted-query') {
      failures.push(`${label} contains an unredacted URL query value`);
    }
  }
  if (
    /\b(?:authorization\s*[:=]\s*)?(?:basic|bearer|digest)\s+(?!<redacted(?:-[a-z0-9]+)*>)[^\s"',;}{]{4,}/iu.test(
      text,
    )
  ) {
    failures.push(`${label} contains an HTTP authorization credential literal`);
  }
  if (
    /\b(?:(?:[a-z0-9]+[_-])*token|(?:x[_-]?)?api[_-]?key|apikey|authorization|(?:[a-z0-9]+[_-])*secret|passcode|password)\b["']?\s*[:=]\s*["']?(?!<redacted(?:-[a-z0-9]+)*>|null\b|false\b|true\b)[^"'\s,}\]]{4,}/iu.test(
      text,
    )
  ) {
    failures.push(`${label} contains an unredacted credential or token value`);
  }
  if (/(?<![a-z0-9+/_-])[a-z0-9+/_-]{160,}={0,2}(?![a-z0-9+/_=-])/iu.test(text)) {
    failures.push(`${label} contains a long base64-like payload`);
  }
  return [...new Set(failures)];
}

function cat05DiagnosticValueFailures(label, value, seen = new WeakSet(), depth = 0) {
  const failures = [];
  if (typeof value === 'string') {
    if (Buffer.byteLength(value, 'utf8') > CAT05_NATIVE_OCR_MAX_DIAGNOSTIC_STRING_BYTES) {
      failures.push(
        `${label} exceeds ${CAT05_NATIVE_OCR_MAX_DIAGNOSTIC_STRING_BYTES} diagnostic string bytes`,
      );
    }
    failures.push(...cat05DiagnosticPolicyFailures(label, value));
    return failures;
  }
  if (!value || typeof value !== 'object') return failures;
  if (seen.has(value)) return failures;
  if (depth > 20) return [`${label} exceeds the reviewed diagnostic nesting depth`];
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      failures.push(...cat05DiagnosticValueFailures(`${label}[${index}]`, item, seen, depth + 1));
    });
    return failures;
  }
  for (const [key, item] of Object.entries(value)) {
    failures.push(...cat05DiagnosticValueFailures(`${label}.<key>`, key, seen, depth + 1));
    failures.push(...cat05DiagnosticValueFailures(`${label}.${key}`, item, seen, depth + 1));
  }
  return failures;
}

function cat05TextArtifactHygieneFailures(label, bytes, maxBytes) {
  if (!Buffer.isBuffer(bytes)) return [`${label} is not available as bytes`];
  const failures = [];
  if (bytes.length > maxBytes) failures.push(`${label} exceeds ${maxBytes} reviewed bytes`);
  const text = bytes.toString('utf8');
  if (!Buffer.from(text, 'utf8').equals(bytes)) {
    failures.push(`${label} is not canonical UTF-8 text`);
  }
  failures.push(...cat05DiagnosticPolicyFailures(label, text));
  return failures;
}

const CAT05_BROWSER_EVENT_KEYS = Object.freeze({
  'Log.entryAdded': ['method', 'observedAt', 'params'],
  'Network.requestWillBeSent': [
    'documentURL',
    'method',
    'observedAt',
    'requestId',
    'requestMethod',
    'type',
    'url',
  ],
  'Network.responseReceived': [
    'method',
    'mimeType',
    'observedAt',
    'requestId',
    'status',
    'type',
    'url',
  ],
  'Network.webSocketCreated': ['method', 'observedAt', 'params'],
  'Runtime.consoleAPICalled': ['method', 'observedAt', 'text', 'type'],
});

const CAT05_REJECTED_BROWSER_EVENT_KEYS = Object.freeze({
  'Inspector.targetCrashed': ['method', 'observedAt', 'params'],
  'Network.loadingFailed': ['canceled', 'errorText', 'method', 'observedAt', 'requestId', 'type'],
  'Network.webSocketFrameError': ['method', 'observedAt', 'params'],
  'Page.crashed': ['method', 'observedAt', 'params'],
  'Page.javascriptDialogOpening': ['method', 'observedAt', 'params'],
  'Runtime.exceptionThrown': ['method', 'observedAt', 'params'],
});

function parseCat05ReviewedLocalUrl(label, value, expectedProtocol) {
  try {
    const parsed = new URL(String(value ?? ''));
    if (
      parsed.protocol !== expectedProtocol ||
      parsed.hostname !== 'localhost' ||
      !/^\d+$/.test(parsed.port) ||
      parsed.username ||
      parsed.password ||
      parsed.hash ||
      (parsed.search && parsed.search !== '?redacted-query')
    ) {
      return { failure: `${label} must be a sanitized localhost ${expectedProtocol} URL` };
    }
    return { parsed };
  } catch {
    return { failure: `${label} must be a valid sanitized localhost URL` };
  }
}

function collectCat05BrowserEventFailures(artifact, contents) {
  const failures = [];
  if (
    !hasExactObjectKeys(contents, ['evidenceBinding', 'events', 'retention']) ||
    !Array.isArray(contents?.events)
  ) {
    return [`${artifact} must use the exact bound browser-event and retention schema`];
  }

  const { events, retention } = contents;
  if (
    !hasExactObjectKeys(retention, [
      'ignoredEventCount',
      'inputEventCount',
      'limits',
      'retainedEventCount',
      'sanitizedBytes',
      'truncated',
    ]) ||
    !hasExactObjectKeys(retention?.limits, ['maxRetainedBytes', 'maxRetainedEvents'])
  ) {
    failures.push(`${artifact} retention must use the exact reviewed schema`);
  } else {
    for (const key of [
      'ignoredEventCount',
      'inputEventCount',
      'retainedEventCount',
      'sanitizedBytes',
    ]) {
      if (!Number.isSafeInteger(retention[key]) || retention[key] < 0) {
        failures.push(`${artifact} retention.${key} must be a non-negative safe integer`);
      }
    }
    if (
      retention.limits.maxRetainedBytes !== CAT05_NATIVE_OCR_MAX_BROWSER_EVENT_BYTES ||
      retention.limits.maxRetainedEvents !== CAT05_NATIVE_OCR_MAX_RETAINED_BROWSER_EVENTS
    ) {
      failures.push(`${artifact} retention limits do not match the reviewed runner limits`);
    }
    if (
      retention.retainedEventCount !== events.length ||
      retention.inputEventCount !== retention.retainedEventCount + retention.ignoredEventCount
    ) {
      failures.push(`${artifact} retention event counts are inconsistent`);
    }
    const serializedBytes = Buffer.byteLength(JSON.stringify(events), 'utf8');
    if (
      retention.sanitizedBytes !== serializedBytes ||
      serializedBytes > CAT05_NATIVE_OCR_MAX_BROWSER_EVENT_BYTES ||
      events.length > CAT05_NATIVE_OCR_MAX_RETAINED_BROWSER_EVENTS
    ) {
      failures.push(`${artifact} retention byte or event limits are inconsistent`);
    }
    if (retention.truncated !== false) {
      failures.push(`${artifact} retention.truncated must be false`);
    }
  }

  const requestIds = [];
  const responseIds = [];
  const httpOrigins = new Set();
  const websocketPorts = new Set();
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    const label = `${artifact} event ${index + 1}`;
    const expectedKeys =
      CAT05_BROWSER_EVENT_KEYS[event?.method] ?? CAT05_REJECTED_BROWSER_EVENT_KEYS[event?.method];
    if (!expectedKeys) {
      failures.push(`${label} has an unreviewed method: ${String(event?.method ?? 'missing')}`);
      continue;
    }
    if (!hasExactObjectKeys(event, expectedKeys)) {
      failures.push(`${label} does not use the exact ${event.method} schema`);
    }
    if (!Number.isFinite(Date.parse(String(event?.observedAt ?? '')))) {
      failures.push(`${label} must contain a valid observedAt timestamp`);
    }
    if (Object.hasOwn(CAT05_REJECTED_BROWSER_EVENT_KEYS, event.method)) {
      failures.push(`${label} contains disallowed browser failure method ${event.method}`);
      continue;
    }

    if (event.method === 'Network.requestWillBeSent') {
      if (
        typeof event.requestId !== 'string' ||
        event.requestId.length === 0 ||
        event.requestId.length > 256 ||
        typeof event.requestMethod !== 'string' ||
        !/^[A-Z]+$/.test(event.requestMethod) ||
        typeof event.type !== 'string' ||
        event.type.length === 0
      ) {
        failures.push(`${label} has invalid request identity metadata`);
      }
      requestIds.push(event.requestId);
      for (const [field, value] of [
        ['documentURL', event.documentURL],
        ['url', event.url],
      ]) {
        const parsed = parseCat05ReviewedLocalUrl(`${label}.${field}`, value, 'http:');
        if (parsed.failure) failures.push(parsed.failure);
        else httpOrigins.add(parsed.parsed.origin);
      }
    } else if (event.method === 'Network.responseReceived') {
      if (
        typeof event.requestId !== 'string' ||
        event.requestId.length === 0 ||
        event.requestId.length > 256 ||
        typeof event.mimeType !== 'string' ||
        event.mimeType.length === 0 ||
        typeof event.type !== 'string' ||
        event.type.length === 0 ||
        !Number.isFinite(event.status) ||
        event.status < 100 ||
        event.status >= 400
      ) {
        failures.push(`${label} has invalid response identity metadata`);
      }
      responseIds.push(event.requestId);
      const parsed = parseCat05ReviewedLocalUrl(`${label}.url`, event.url, 'http:');
      if (parsed.failure) failures.push(parsed.failure);
      else httpOrigins.add(parsed.parsed.origin);
    } else if (event.method === 'Network.webSocketCreated') {
      if (!event.params || typeof event.params !== 'object' || Array.isArray(event.params)) {
        failures.push(`${label}.params must be a sanitized object`);
      } else {
        const parsed = parseCat05ReviewedLocalUrl(`${label}.params.url`, event.params.url, 'ws:');
        if (parsed.failure) failures.push(parsed.failure);
        else websocketPorts.add(parsed.parsed.port);
      }
    } else if (event.method === 'Runtime.consoleAPICalled') {
      if (
        typeof event.text !== 'string' ||
        typeof event.type !== 'string' ||
        event.type.length === 0
      ) {
        failures.push(`${label} must contain bounded console text and type strings`);
      }
      if (['assert', 'error'].includes(String(event.type).toLowerCase())) {
        failures.push(`${label} contains an error-class browser console event`);
      }
    } else if (event.method === 'Log.entryAdded') {
      if (!event.params || typeof event.params !== 'object' || Array.isArray(event.params)) {
        failures.push(`${label}.params must be a sanitized object`);
      }
      if (String(event.params?.entry?.level ?? '').toLowerCase() === 'error') {
        failures.push(`${label} contains an error-level browser log`);
      }
    }
  }

  if (requestIds.length === 0 || responseIds.length === 0) {
    failures.push(`${artifact} must contain nonzero localhost request and response coverage`);
  }
  if (
    requestIds.length !== responseIds.length ||
    !isDeepStrictEqual([...new Set(requestIds)].sort(), [...new Set(responseIds)].sort())
  ) {
    failures.push(`${artifact} request and response IDs are not coherent`);
  }
  if (httpOrigins.size !== 1) {
    failures.push(`${artifact} must bind all HTTP traffic to one localhost origin`);
  } else if ([...websocketPorts].some((port) => port !== new URL([...httpOrigins][0]).port)) {
    failures.push(`${artifact} WebSocket traffic does not match the localhost HTTP port`);
  }

  return failures;
}

function buildExpectedCat05NativeOcrReport(summary) {
  const lines = [
    '# CAT05 Native OCR Review UI — Human-Simulated Expo-Web Audit',
    '',
    '## Scope Boundary',
    '',
    summary.verdict === 'pass'
      ? '**PASS — deterministic Expo-web OCR review UI-state evidence only.**'
      : '**FAIL — deterministic Expo-web OCR review UI-state audit.**',
    '',
    'This report is deliberately not native Vision, device, camera, label-image, OCR accuracy, runtime privacy, archive, App Review, or release evidence. Its cache/cleanup findings are source assertions only. A pass must never be used to enable or clear the native OCR launch gate.',
    '',
    ...CAT05_NATIVE_OCR_LIMITATIONS.map((limitation) => `- ${limitation}`),
    '',
    '## Run',
    '',
    `- Run ID: \`${summary.runId}\``,
    `- Source Git SHA: \`${summary.sourceGitSha}\``,
    `- Web fixture build ID: \`${summary.webFixtureBuild.buildId}\``,
    `- Web fixture profile: \`${summary.webFixtureBuild.profile}\``,
    `- Candidate source profile: \`${summary.candidateNativeBuild.profile}\``,
    '- Native EAS build ID: not applicable (this audit does not execute an iOS binary)',
    `- Started: ${summary.startedAt}`,
    `- Completed: ${summary.completedAt}`,
    `- Surface: ${summary.surface}`,
    `- Browser: ${summary.browserPath ?? 'unavailable'}`,
    `- Consent bootstraps: ${summary.passedBootstrapCount}/${summary.expectedBootstrapCount}`,
    `- Scenario executions: ${summary.passedExecutionCount}/${summary.expectedExecutionCount}`,
    `- Browser failures: ${summary.browserFailureCount}`,
    '- Native device proof: false',
    '',
    '## Scenario Matrix',
    '',
    '| Scenario | Viewport | Result | Error |',
    '| --- | --- | --- | --- |',
    ...summary.results
      .filter(({ kind }) => kind === 'scenario')
      .map(
        (result) =>
          `| ${result.scenarioId} | ${result.viewport.width}x${result.viewport.height} | ${result.verdict} | ${String(result.error ?? '').replace(/\|/g, '\\|')} |`,
      ),
    '',
    '## Human-Simulated Actions',
    '',
    '- Completed the real local age gate and explicit health-data consent UI for every fixture server.',
    '- Tapped Capture label, observed the reading state, reviewed the resulting state, typed and corrected text, adopted a recognized suggestion explicitly, retook, continued, and followed the manual fallback.',
    '- Exercised recognized, no-text, timeout, and failure branches at 375 x 667, 390 x 844, and 430 x 932.',
    '- Inspected accessible names, alert/live-region semantics, touch-target geometry, center hit tests, clipping, horizontal overflow, browser console/page errors, dialogs, and remote requests.',
    '',
    '## Remaining Native Gates',
    '',
    '- Compile and sign the Swift/Expo module on the release macOS/Xcode toolchain.',
    '- Exercise clear, curved, tiny, multilingual, and glare-heavy real labels on the required physical-iPhone matrix.',
    '- Prove native cancellation, timeout, edit-fence, retake, background/foreground, memory, cleanup, and process-death behavior.',
    '- Complete VoiceOver, Dynamic Type, traffic inspection, privacy/App Privacy reconciliation, performance thresholds, corpus rights, professional review, archive inspection, and exact-build evidence.',
    '',
    '## Command',
    '',
    '```text',
    'node scripts/e2e/cat05-native-ocr-ui-audit.mjs',
    '```',
  ];
  return `${lines.join('\n')}\n`;
}

function collectCat04CatalogRecoveryFailures({
  folder,
  summary,
  trackedRepoFiles,
  sourceGitState,
  fileExists = exists,
  readJsonFile = readJson,
  readTextFile = (path) => readFileSync(abs(path), 'utf8'),
}) {
  const failures = [];
  const checkedFiles = new Set();
  const requiredArtifacts = new Set(['report.md']);
  const folderPrefix = `${normalizeRepoPath(folder).replace(/\/$/, '')}/`;
  const trackedFolderFiles = [...trackedRepoFiles]
    .filter((path) => normalizeRepoPath(path).startsWith(folderPrefix))
    .map((path) => normalizeRepoPath(path).slice(folderPrefix.length));

  const requireTrackedFile = (relativePath, label = relativePath) => {
    const normalized = normalizeEvidenceRelativePath(relativePath);
    if (!normalized || normalized !== relativePath) {
      failures.push(`${label} uses an unsafe evidence path`);
      return false;
    }
    requiredArtifacts.add(normalized);
    if (checkedFiles.has(normalized)) {
      return (
        fileExists(`${folder}/${normalized}`) &&
        trackedRepoFiles.has(normalizeRepoPath(`${folder}/${normalized}`))
      );
    }
    checkedFiles.add(normalized);
    const repoPath = normalizeRepoPath(`${folder}/${normalized}`);
    if (!fileExists(repoPath)) {
      failures.push(`missing CAT04 evidence file ${normalized}`);
      return false;
    }
    if (!trackedRepoFiles.has(repoPath)) {
      failures.push(`CAT04 evidence file is not Git-tracked: ${normalized}`);
      return false;
    }
    return true;
  };

  if (summary?.schemaVersion !== 1) {
    failures.push(
      `schemaVersion must be 1, received ${String(summary?.schemaVersion ?? 'missing')}`,
    );
  }
  if (summary?.surface !== 'expo-web') {
    failures.push(`surface must be expo-web, received ${String(summary?.surface ?? 'missing')}`);
  }
  if (summary?.nativeDeviceProof !== false) {
    failures.push('nativeDeviceProof must be false for this Expo-web compatibility gate');
  }
  if (summary?.verdict !== 'pass') {
    failures.push(
      `summary verdict must be pass, received ${String(summary?.verdict ?? 'missing')}`,
    );
  }
  if (!isDeepStrictEqual(summary?.requiredViewports, CAT04_CATALOG_VIEWPORTS)) {
    failures.push('requiredViewports must be exactly 375x667, 390x844, and 430x932');
  }
  if (!isDeepStrictEqual(summary?.fixtureGroups, CAT04_CATALOG_FIXTURE_GROUPS)) {
    failures.push('fixtureGroups must match the six reviewed CAT04 fixture groups');
  }
  if (!isDeepStrictEqual(summary?.scenarioDefinitions, CAT04_CATALOG_SCENARIOS)) {
    failures.push('scenarioDefinitions must match the 15 reviewed CAT04 recovery scenarios');
  }

  const expectedScenarioCount = CAT04_CATALOG_SCENARIOS.length * CAT04_CATALOG_VIEWPORTS.length;
  const expectedBootstrapCount =
    CAT04_CATALOG_FIXTURE_GROUPS.length * CAT04_CATALOG_VIEWPORTS.length;
  if (summary?.expectedExecutionCount !== expectedScenarioCount) {
    failures.push(
      `expectedExecutionCount must be ${expectedScenarioCount}, received ${String(summary?.expectedExecutionCount ?? 'missing')}`,
    );
  }
  if (summary?.expectedBootstrapCount !== expectedBootstrapCount) {
    failures.push(
      `expectedBootstrapCount must be ${expectedBootstrapCount}, received ${String(summary?.expectedBootstrapCount ?? 'missing')}`,
    );
  }

  const expectedScenarioById = new Map(
    CAT04_CATALOG_SCENARIOS.map((scenario) => [scenario.id, scenario]),
  );
  const scenarioKeys = new Set();
  const bootstrapKeys = new Set();
  const expectedPrefixes = [];

  const validateResult = ({ result, expectedPrefix, resultFile, context }) => {
    expectedPrefixes.push(expectedPrefix);
    if (result?.artifactPrefix !== expectedPrefix) {
      failures.push(
        `${context} artifactPrefix must be ${expectedPrefix}, received ${String(result?.artifactPrefix ?? 'missing')}`,
      );
    }
    if (result?.surface !== 'expo-web' || result?.nativeDeviceProof !== false) {
      failures.push(`${context} must retain Expo-web surface and nativeDeviceProof false`);
    }
    if (result?.verdict !== 'pass' || result?.error != null || result?.timedOut === true) {
      failures.push(`${context} must have a clean pass verdict`);
    }
    if (!Array.isArray(result?.browserFailures) || result.browserFailures.length !== 0) {
      failures.push(`${context} browserFailures must be an empty array`);
    }
    if (requireTrackedFile(resultFile, `${context} result`)) {
      try {
        const persisted = readJsonFile(`${folder}/${resultFile}`);
        if (!isDeepStrictEqual(persisted, result)) {
          failures.push(`${resultFile} does not match its summary record`);
        }
      } catch (error) {
        failures.push(
          `${resultFile} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  };

  if (!Array.isArray(summary?.scenarios) || summary.scenarios.length !== expectedScenarioCount) {
    failures.push(`scenarios must contain exactly ${expectedScenarioCount} executions`);
  } else {
    for (const result of summary.scenarios) {
      const definition = expectedScenarioById.get(result?.scenarioId);
      const viewportId = cat04ViewportKey(result?.viewport);
      const key = `${String(result?.scenarioId)}::${String(viewportId)}`;
      if (!definition || !viewportId) {
        failures.push(`scenario result has an unknown scenario or viewport: ${key}`);
        continue;
      }
      if (scenarioKeys.has(key)) failures.push(`duplicate scenario execution ${key}`);
      scenarioKeys.add(key);
      if (
        result.fixture !== definition.fixture ||
        result.fixtureGroup !== definition.groupId ||
        result.route !== definition.route
      ) {
        failures.push(`${key} does not match its reviewed fixture, group, and route`);
      }
      const prefix = `${definition.id}-${viewportId}`;
      validateResult({
        result,
        expectedPrefix: prefix,
        resultFile: `${prefix}-result.json`,
        context: `scenario ${key}`,
      });
    }
  }
  for (const scenario of CAT04_CATALOG_SCENARIOS) {
    for (const viewport of CAT04_CATALOG_VIEWPORTS) {
      const key = `${scenario.id}::${viewport.id}`;
      if (!scenarioKeys.has(key)) failures.push(`missing scenario execution ${key}`);
    }
  }

  if (
    !Array.isArray(summary?.bootstrapResults) ||
    summary.bootstrapResults.length !== expectedBootstrapCount
  ) {
    failures.push(`bootstrapResults must contain exactly ${expectedBootstrapCount} executions`);
  } else {
    for (const result of summary.bootstrapResults) {
      const viewportId = cat04ViewportKey(result?.viewport);
      const fixtureGroup = String(result?.fixtureGroup ?? '');
      const key = `${fixtureGroup}::${String(viewportId)}`;
      if (!CAT04_CATALOG_FIXTURE_GROUPS.includes(fixtureGroup) || !viewportId) {
        failures.push(`bootstrap result has an unknown fixture group or viewport: ${key}`);
        continue;
      }
      if (bootstrapKeys.has(key)) failures.push(`duplicate consent bootstrap ${key}`);
      bootstrapKeys.add(key);
      const prefix = `bootstrap-${fixtureGroup}-${viewportId}`;
      validateResult({
        result,
        expectedPrefix: prefix,
        resultFile: `${prefix}-result.json`,
        context: `bootstrap ${key}`,
      });
    }
  }
  for (const fixtureGroup of CAT04_CATALOG_FIXTURE_GROUPS) {
    for (const viewport of CAT04_CATALOG_VIEWPORTS) {
      const key = `${fixtureGroup}::${viewport.id}`;
      if (!bootstrapKeys.has(key)) failures.push(`missing consent bootstrap ${key}`);
    }
  }

  const screenshots = Array.isArray(summary?.screenshots) ? summary.screenshots : [];
  if (!Array.isArray(summary?.screenshots) || screenshots.length === 0) {
    failures.push('screenshots must be a non-empty array');
  }
  const screenshotSet = new Set();
  for (const screenshot of screenshots) {
    const normalized = normalizeEvidenceRelativePath(screenshot);
    if (
      !normalized ||
      normalized !== screenshot ||
      screenshot.includes('/') ||
      !screenshot.endsWith('.png')
    ) {
      failures.push(`screenshots contains an unsafe or non-PNG path: ${String(screenshot)}`);
      continue;
    }
    if (screenshotSet.has(screenshot)) {
      failures.push(`screenshots contains a duplicate path: ${screenshot}`);
      continue;
    }
    screenshotSet.add(screenshot);
    requireTrackedFile(screenshot, `screenshot ${screenshot}`);
    requireTrackedFile(`${screenshot.slice(0, -4)}.json`, `snapshot for ${screenshot}`);
  }
  const trackedPngs = trackedFolderFiles.filter((path) => path.endsWith('.png')).sort();
  if (!isDeepStrictEqual([...screenshotSet].sort(), trackedPngs)) {
    failures.push('screenshots must enumerate every Git-tracked CAT04 PNG exactly once');
  }
  for (const prefix of expectedPrefixes) {
    if (![...screenshotSet].some((screenshot) => screenshot.startsWith(`${prefix}-`))) {
      failures.push(`${prefix} has no screenshot provenance`);
    }
  }

  if (requireTrackedFile('report.md', 'CAT04 report')) {
    try {
      const report = readTextFile(`${folder}/report.md`);
      for (const fragment of [
        '# CAT04 Catalog Recovery Expo-Web Audit',
        '- Verdict: pass',
        '- Surface: Expo web deterministic development fixtures',
        '- Native-device proof: No',
        `- Source Git SHA: ${String(summary?.sourceGitSha ?? '')}`,
        'Machine-readable result: `summary.json`',
      ]) {
        if (!report.includes(fragment))
          failures.push(`report.md is missing required text: ${fragment}`);
      }
      for (const fixtureGroup of CAT04_CATALOG_FIXTURE_GROUPS) {
        for (const viewport of CAT04_CATALOG_VIEWPORTS) {
          const row = `| ${fixtureGroup} | ${viewport.width}x${viewport.height} | pass |`;
          if (!report.includes(row)) failures.push(`report.md is missing bootstrap row: ${row}`);
        }
      }
      for (const scenario of CAT04_CATALOG_SCENARIOS) {
        for (const viewport of CAT04_CATALOG_VIEWPORTS) {
          const row = `| ${scenario.id} | ${viewport.width}x${viewport.height} | pass |`;
          if (!report.includes(row)) failures.push(`report.md is missing scenario row: ${row}`);
        }
      }
    } catch (error) {
      failures.push(
        `report.md could not be read: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  const sourceGitSha = String(summary?.sourceGitSha ?? '');
  if (!/^[a-f0-9]{40}$/.test(sourceGitSha)) {
    failures.push('sourceGitSha must be a lowercase full 40-character Git SHA');
  } else if (!sourceGitState) {
    failures.push('sourceGitSha consistency state is unavailable');
  } else {
    if (sourceGitState.sourceGitSha !== sourceGitSha) {
      failures.push('sourceGitSha consistency state does not match summary.sourceGitSha');
    }
    if (sourceGitState.commitExists !== true) {
      failures.push('sourceGitSha does not identify a local Git commit');
    }
    if (sourceGitState.isAncestorOfHead !== true) {
      failures.push('sourceGitSha must be an ancestor of the manifest HEAD');
    }
    if (sourceGitState.runnerMatchesSource !== true) {
      failures.push('CAT04 runner source does not match the recorded sourceGitSha');
    }
    const allowedGeneratedPaths = new Set([
      'docs/e2e/generated/human-e2e-manifest.json',
      'docs/e2e/generated/human-e2e-manifest.md',
    ]);
    const sourceChangeAllowed = (path) => {
      const normalized = normalizeRepoPath(path);
      return (
        normalized.startsWith(folderPrefix) ||
        allowedGeneratedPaths.has(normalized) ||
        ignoredGeneratedOutputPath(normalized)
      );
    };
    const laterSourceChanges = (sourceGitState.changedRepoFilesSinceSource ?? []).filter(
      (path) => !sourceChangeAllowed(path),
    );
    if (laterSourceChanges.length > 0) {
      failures.push(`sourceGitSha predates later source changes: ${laterSourceChanges.join(', ')}`);
    }
    const dirtySourceChanges = (sourceGitState.dirtyTrackedRepoFiles ?? []).filter(
      (path) => !sourceChangeAllowed(path),
    );
    if (dirtySourceChanges.length > 0) {
      failures.push(
        `tracked source files changed after the recorded sourceGitSha: ${dirtySourceChanges.join(', ')}`,
      );
    }
    const untrackedSourceChanges = collectDisallowedUntrackedRepoFiles(
      sourceGitState.untrackedRepoFiles ?? [],
      {
        allowedExactPaths: allowedGeneratedPaths,
        allowedPrefixes: [folderPrefix],
      },
    );
    if (untrackedSourceChanges.length > 0) {
      failures.push(
        `nonignored untracked source is not bound to sourceGitSha: ${untrackedSourceChanges.join(', ')}`,
      );
    }
  }

  if (!Array.isArray(summary?.artifacts)) {
    failures.push('artifacts must be a deterministic evidence-relative array');
  } else {
    const artifacts = new Set();
    for (const artifact of summary.artifacts) {
      const normalized = normalizeEvidenceRelativePath(artifact);
      if (!normalized || normalized !== artifact) {
        failures.push(`artifacts contains an unsafe path: ${String(artifact)}`);
        continue;
      }
      if (artifacts.has(normalized)) {
        failures.push(`artifacts contains a duplicate path: ${normalized}`);
        continue;
      }
      artifacts.add(normalized);
      requireTrackedFile(normalized, `artifact ${normalized}`);
    }
    if (!isDeepStrictEqual(summary.artifacts, [...summary.artifacts].sort())) {
      failures.push('artifacts must use deterministic lexical ordering');
    }
    for (const requiredArtifact of requiredArtifacts) {
      if (!artifacts.has(requiredArtifact)) {
        failures.push(`artifacts is missing required CAT04 evidence ${requiredArtifact}`);
      }
    }
    const expectedTrackedArtifacts = trackedFolderFiles
      .filter((trackedFile) => trackedFile !== 'summary.json')
      .sort();
    if (!isDeepStrictEqual([...artifacts].sort(), expectedTrackedArtifacts)) {
      failures.push(
        'artifacts must enumerate every Git-tracked CAT04 evidence file except summary.json exactly once',
      );
    }
  }

  return failures;
}

function collectCat05NativeOcrReviewFailures({
  folder,
  summary,
  trackedRepoFiles,
  sourceGitState,
  fileExists = exists,
  readJsonFile = readJson,
  readTextFile = (path) => readFileSync(abs(path), 'utf8'),
  readBytesFile = (path) => readFileSync(abs(path)),
}) {
  const failures = [];
  const checkedFiles = new Set();
  const bytesByArtifact = new Map();
  const folderPrefix = `${normalizeRepoPath(folder).replace(/\/$/, '')}/`;
  const expectedArtifacts = expectedCat05NativeOcrArtifacts();
  const expectedScreenshots = expectedArtifacts.filter((artifact) => artifact.endsWith('.png'));
  const trackedFolderFiles = [...trackedRepoFiles]
    .filter((path) => normalizeRepoPath(path).startsWith(folderPrefix))
    .map((path) => normalizeRepoPath(path).slice(folderPrefix.length))
    .sort();

  const requireTrackedFile = (relativePath, label = relativePath) => {
    const normalized = normalizeEvidenceRelativePath(relativePath);
    if (!normalized || normalized !== relativePath) {
      failures.push(`${label} uses an unsafe evidence path`);
      return false;
    }
    if (checkedFiles.has(normalized)) {
      return (
        fileExists(`${folder}/${normalized}`) &&
        trackedRepoFiles.has(normalizeRepoPath(`${folder}/${normalized}`))
      );
    }
    checkedFiles.add(normalized);
    const repoPath = normalizeRepoPath(`${folder}/${normalized}`);
    if (!fileExists(repoPath)) {
      failures.push(`missing CAT05 evidence file ${normalized}`);
      return false;
    }
    if (!trackedRepoFiles.has(repoPath)) {
      failures.push(`CAT05 evidence file is not Git-tracked: ${normalized}`);
      return false;
    }
    return true;
  };

  const artifactBytes = (artifact) => {
    if (bytesByArtifact.has(artifact)) return bytesByArtifact.get(artifact);
    try {
      const raw = readBytesFile(`${folder}/${artifact}`);
      const bytes = Buffer.isBuffer(raw) ? raw : Buffer.from(String(raw));
      bytesByArtifact.set(artifact, bytes);
      return bytes;
    } catch (error) {
      failures.push(
        `${artifact} could not be read as bytes: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  };

  if (expectedArtifacts.length !== CAT05_NATIVE_OCR_ARTIFACT_COUNT) {
    failures.push('internal CAT05 artifact contract does not contain exactly 139 artifacts');
  }
  if (expectedScreenshots.length !== CAT05_NATIVE_OCR_SCREENSHOT_COUNT) {
    failures.push('internal CAT05 artifact contract does not contain exactly 55 PNGs');
  }
  if (!hasExactObjectKeys(summary, CAT05_NATIVE_OCR_SUMMARY_KEYS)) {
    failures.push('summary.json must use the exact reviewed CAT05 PASS schema');
  }
  if (summary?.evidenceSchemaVersion !== CAT05_NATIVE_OCR_SCHEMA_VERSION) {
    failures.push(
      `evidenceSchemaVersion must be ${CAT05_NATIVE_OCR_SCHEMA_VERSION}, received ${String(summary?.evidenceSchemaVersion ?? 'missing')}`,
    );
  }
  if (summary?.surface !== 'Expo web / deterministic development-only OCR review fixture') {
    failures.push('summary surface must remain the deterministic Expo-web OCR review fixture');
  }
  if (summary?.verdict !== 'pass') {
    failures.push(
      `summary verdict must be pass, received ${String(summary?.verdict ?? 'missing')}`,
    );
  }
  if (summary?.nativeDeviceProof !== false) {
    failures.push('nativeDeviceProof must be false for the CAT05 Expo-web compatibility gate');
  }
  if (!isDeepStrictEqual(summary?.candidateNativeBuild, CAT05_NATIVE_OCR_CANDIDATE_BUILD)) {
    failures.push(
      'candidateNativeBuild must be the exact staging source candidate with no native proof',
    );
  }
  if (!isDeepStrictEqual(summary?.viewports, CAT05_NATIVE_OCR_VIEWPORTS)) {
    failures.push('viewports must be exactly 375x667, 390x844, and 430x932');
  }
  if (!isDeepStrictEqual(summary?.fixtureGroups, CAT05_NATIVE_OCR_FIXTURE_GROUPS)) {
    failures.push('fixtureGroups must match the four reviewed CAT05 fixture groups');
  }
  if (!isDeepStrictEqual(summary?.scenarioMatrix, CAT05_NATIVE_OCR_SCENARIOS)) {
    failures.push('scenarioMatrix must match the five reviewed CAT05 scenarios');
  }
  if (!isDeepStrictEqual(summary?.limitations, CAT05_NATIVE_OCR_LIMITATIONS)) {
    failures.push('limitations must retain the exact native-proof boundary');
  }
  if (
    summary?.expectedExecutionCount !== 15 ||
    summary?.passedExecutionCount !== 15 ||
    summary?.expectedBootstrapCount !== 4 ||
    summary?.passedBootstrapCount !== 4
  ) {
    failures.push('CAT05 must record exactly 15/15 scenario results and 4/4 consent bootstraps');
  }
  if (summary?.browserFailureCount !== 0) {
    failures.push('browserFailureCount must be zero');
  }
  if (typeof summary?.browserPath !== 'string' || summary.browserPath.trim().length === 0) {
    failures.push('browserPath must identify the browser used for the evidence run');
  } else if (
    summary.browserPath !== summary.browserPath.trim() ||
    summary.browserPath.length > 256 ||
    /[\\/]/u.test(summary.browserPath) ||
    summary.browserPath === '.' ||
    summary.browserPath === '..'
  ) {
    failures.push('browserPath must be a bounded browser executable basename, not a host path');
  }
  failures.push(...cat05DiagnosticValueFailures('summary.json', summary));
  const summaryBytes = artifactBytes('summary.json');
  if (summaryBytes) {
    failures.push(
      ...cat05TextArtifactHygieneFailures(
        'summary.json',
        summaryBytes,
        CAT05_NATIVE_OCR_MAX_DIAGNOSTIC_ARTIFACT_BYTES,
      ),
    );
  }
  const startedAt = Date.parse(String(summary?.startedAt ?? ''));
  const completedAt = Date.parse(String(summary?.completedAt ?? ''));
  if (!Number.isFinite(startedAt) || !Number.isFinite(completedAt) || completedAt < startedAt) {
    failures.push('summary timestamps must be valid and complete in chronological order');
  }

  const sourceGitSha = String(summary?.sourceGitSha ?? '');
  const binding = summary?.evidenceBinding;
  const fixtureConfigurationSha256 = String(binding?.fixtureConfigurationSha256 ?? '');
  const scenarioMatrixSha256 = cat05Sha256Json(CAT05_NATIVE_OCR_SCENARIOS);
  const viewportMatrixSha256 = cat05Sha256Json(CAT05_NATIVE_OCR_VIEWPORTS);
  const webFixtureBuild = {
    buildId: cat05Sha256Json({
      evidenceSchemaVersion: CAT05_NATIVE_OCR_SCHEMA_VERSION,
      fixtureConfigurationSha256,
      scenarioMatrixSha256,
      sourceGitSha,
      viewportMatrixSha256,
    }),
    profile: 'development-only-deterministic-expo-web',
  };
  const expectedBinding = {
    candidateNativeBuild: CAT05_NATIVE_OCR_CANDIDATE_BUILD,
    evidenceSchemaVersion: CAT05_NATIVE_OCR_SCHEMA_VERSION,
    expectedSourceGitSha: sourceGitSha,
    fixtureConfigurationSha256,
    runId: String(summary?.runId ?? ''),
    scenarioMatrixSha256,
    sourceGitSha,
    viewportMatrixSha256,
    webFixtureBuild,
  };

  if (!hasExactObjectKeys(binding, CAT05_NATIVE_OCR_BINDING_KEYS)) {
    failures.push('summary evidenceBinding must use the exact CAT05 binding schema');
  }
  if (!/^[a-f0-9]{40}$/.test(sourceGitSha)) {
    failures.push('sourceGitSha must be a lowercase full 40-character Git SHA');
  }
  if (!/^[a-f0-9]{64}$/.test(fixtureConfigurationSha256)) {
    failures.push('fixtureConfigurationSha256 must be a lowercase SHA-256 digest');
  }
  if (
    !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
      expectedBinding.runId,
    )
  ) {
    failures.push('runId must be a lowercase UUID v4');
  }
  if (!isDeepStrictEqual(binding, expectedBinding)) {
    failures.push(
      'summary evidenceBinding does not match the reviewed source/matrix/build binding',
    );
  }
  if (
    summary?.runId !== expectedBinding.runId ||
    summary?.sourceGitSha !== expectedBinding.sourceGitSha ||
    !isDeepStrictEqual(summary?.webFixtureBuild, webFixtureBuild)
  ) {
    failures.push('summary duplicate run/source/web-build fields do not match evidenceBinding');
  }

  const validateArtifactBinding = (actual, artifact, metadata) => {
    const label = `${artifact} evidenceBinding`;
    if (!hasExactObjectKeys(actual, CAT05_NATIVE_OCR_ARTIFACT_BINDING_KEYS)) {
      failures.push(`${label} must use the exact bound-artifact schema`);
      return;
    }
    if (!isDeepStrictEqual(actual, { ...expectedBinding, ...metadata })) {
      failures.push(`${label} does not match the summary run and artifact identity`);
    }
  };

  const privacySourceContract = summary?.privacySourceContract;
  if (
    !hasExactObjectKeys(privacySourceContract, [
      'assertionIds',
      'files',
      'nativeDeviceProof',
      'proofKind',
    ]) ||
    privacySourceContract?.nativeDeviceProof !== false ||
    privacySourceContract?.proofKind !== 'source-assertions-only' ||
    !isDeepStrictEqual(privacySourceContract?.assertionIds, CAT05_NATIVE_OCR_PRIVACY_ASSERTIONS)
  ) {
    failures.push('privacySourceContract must retain the exact source-assertion-only schema');
  }
  if (
    !Array.isArray(privacySourceContract?.files) ||
    privacySourceContract.files.length !== CAT05_NATIVE_OCR_PRIVACY_FILES.length
  ) {
    failures.push('privacySourceContract must bind the four reviewed privacy source files');
  } else {
    privacySourceContract.files.forEach((file, index) => {
      if (
        !hasExactObjectKeys(file, ['bytes', 'path', 'sha256']) ||
        file.path !== CAT05_NATIVE_OCR_PRIVACY_FILES[index] ||
        !Number.isSafeInteger(file.bytes) ||
        file.bytes < 1 ||
        !/^[a-f0-9]{64}$/.test(String(file.sha256 ?? ''))
      ) {
        failures.push(`privacySourceContract file ${index + 1} is not exactly bound`);
      }
    });
  }
  const recordedPrivacyFiles = sourceGitState?.privacySourceFiles;
  if (
    !Array.isArray(recordedPrivacyFiles) ||
    recordedPrivacyFiles.length !== CAT05_NATIVE_OCR_PRIVACY_FILES.length
  ) {
    failures.push('recorded CAT05 privacy source hashes are unavailable');
  } else {
    const expectedPrivacyFiles = [];
    recordedPrivacyFiles.forEach((record, index) => {
      const expectedPath = CAT05_NATIVE_OCR_PRIVACY_FILES[index];
      if (
        !hasExactObjectKeys(record, ['bytes', 'currentBytes', 'currentSha256', 'path', 'sha256']) ||
        record.path !== expectedPath ||
        !Number.isSafeInteger(record.bytes) ||
        record.bytes < 1 ||
        !/^[a-f0-9]{64}$/.test(String(record.sha256 ?? ''))
      ) {
        failures.push(`recorded CAT05 privacy source file ${index + 1} is unavailable or invalid`);
        return;
      }
      expectedPrivacyFiles.push({ bytes: record.bytes, path: record.path, sha256: record.sha256 });
      if (record.currentBytes !== record.bytes || record.currentSha256 !== record.sha256) {
        failures.push(
          `current CAT05 privacy source does not match ${sourceGitSha}: ${record.path}`,
        );
      }
    });
    if (
      expectedPrivacyFiles.length === CAT05_NATIVE_OCR_PRIVACY_FILES.length &&
      !isDeepStrictEqual(privacySourceContract?.files, expectedPrivacyFiles)
    ) {
      failures.push(
        'privacySourceContract byte/hash records do not match the recorded sourceGitSha',
      );
    }
  }

  const expectedScenarioById = new Map(
    CAT05_NATIVE_OCR_SCENARIOS.map((scenario) => [scenario.id, scenario]),
  );
  const scenarioKeys = new Set();
  const bootstrapGroups = new Set();
  if (!Array.isArray(summary?.results) || summary.results.length !== 19) {
    failures.push('results must contain exactly 15 scenarios and 4 consent bootstraps');
  } else {
    for (const result of summary.results) {
      const resultKind = result?.kind;
      let expectedPrefix;
      let resultFile;
      let expectedMetadata;
      if (resultKind === 'scenario') {
        const definition = expectedScenarioById.get(result?.scenarioId);
        const viewportId = cat05ViewportKey(result?.viewport);
        const key = `${String(result?.scenarioId)}::${String(viewportId)}`;
        if (!definition || !viewportId) {
          failures.push(`scenario result has an unknown scenario or viewport: ${key}`);
          continue;
        }
        if (scenarioKeys.has(key)) failures.push(`duplicate CAT05 scenario execution ${key}`);
        scenarioKeys.add(key);
        if (result.fixture !== definition.fixture || result.fixtureGroup !== definition.groupId) {
          failures.push(`${key} does not match its reviewed fixture and group`);
        }
        expectedPrefix = `${definition.id}-${viewportId}`;
        resultFile = `${expectedPrefix}-result.json`;
        expectedMetadata = expectedCat05ArtifactBindingMetadata(resultFile);
      } else if (resultKind === 'consent-bootstrap') {
        const fixtureGroup = String(result?.fixtureGroup ?? '');
        if (!CAT05_NATIVE_OCR_FIXTURE_GROUPS.includes(fixtureGroup)) {
          failures.push(`bootstrap result has an unknown fixture group: ${fixtureGroup}`);
          continue;
        }
        if (!isDeepStrictEqual(result?.viewport, CAT05_NATIVE_OCR_VIEWPORTS[1])) {
          failures.push(`bootstrap ${fixtureGroup} must use the exact 390x844 viewport`);
        }
        if (bootstrapGroups.has(fixtureGroup)) {
          failures.push(`duplicate CAT05 consent bootstrap ${fixtureGroup}`);
        }
        bootstrapGroups.add(fixtureGroup);
        expectedPrefix = `bootstrap-${fixtureGroup}-${CAT05_NATIVE_OCR_VIEWPORTS[1].id}`;
        resultFile = `${expectedPrefix}-result.json`;
        expectedMetadata = expectedCat05ArtifactBindingMetadata(resultFile);
      } else {
        failures.push(`result has an unknown kind: ${String(resultKind ?? 'missing')}`);
        continue;
      }

      if (result?.artifactPrefix !== expectedPrefix) {
        failures.push(`${resultKind} ${expectedPrefix} has an incorrect artifactPrefix`);
      }
      if (
        result?.nativeDeviceProof !== false ||
        result?.verdict !== 'pass' ||
        result?.error !== null ||
        !Array.isArray(result?.browserFailures) ||
        result.browserFailures.length !== 0
      ) {
        failures.push(`${resultKind} ${expectedPrefix} must retain a clean non-native pass`);
      }
      const expectedSurface =
        resultKind === 'scenario' ? 'expo-web-deterministic-ui-fixture' : 'expo-web';
      if (result?.surface !== expectedSurface) {
        failures.push(`${resultKind} ${expectedPrefix} has an incorrect surface`);
      }
      validateArtifactBinding(result?.evidenceBinding, resultFile, expectedMetadata);
      try {
        const endUrl = new URL(String(result?.endUrl ?? ''));
        if (
          endUrl.protocol !== 'http:' ||
          endUrl.hostname !== 'localhost' ||
          !/^\d+$/.test(endUrl.port) ||
          endUrl.username ||
          endUrl.password
        ) {
          failures.push(`${resultKind} ${expectedPrefix} endUrl must remain local HTTP`);
        }
      } catch {
        failures.push(`${resultKind} ${expectedPrefix} endUrl is not a valid local URL`);
      }
      if (requireTrackedFile(resultFile, `${resultKind} ${expectedPrefix} result`)) {
        try {
          if (!isDeepStrictEqual(readJsonFile(`${folder}/${resultFile}`), result)) {
            failures.push(`${resultFile} does not match its summary record`);
          }
        } catch (error) {
          failures.push(
            `${resultFile} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    }
  }
  for (const scenario of CAT05_NATIVE_OCR_SCENARIOS) {
    for (const viewport of CAT05_NATIVE_OCR_VIEWPORTS) {
      const key = `${scenario.id}::${viewport.id}`;
      if (!scenarioKeys.has(key)) failures.push(`missing CAT05 scenario execution ${key}`);
    }
  }
  for (const fixtureGroup of CAT05_NATIVE_OCR_FIXTURE_GROUPS) {
    if (!bootstrapGroups.has(fixtureGroup)) {
      failures.push(`missing CAT05 consent bootstrap ${fixtureGroup}`);
    }
  }

  if (
    !Array.isArray(summary?.groupBrowserAudits) ||
    summary.groupBrowserAudits.length !== CAT05_NATIVE_OCR_FIXTURE_GROUPS.length
  ) {
    failures.push('groupBrowserAudits must contain exactly four fixture-group audits');
  } else {
    const auditedGroups = new Set();
    for (const audit of summary.groupBrowserAudits) {
      const fixtureGroup = String(audit?.fixtureGroup ?? '');
      if (!CAT05_NATIVE_OCR_FIXTURE_GROUPS.includes(fixtureGroup)) {
        failures.push(`groupBrowserAudits contains an unknown fixture group: ${fixtureGroup}`);
        continue;
      }
      if (auditedGroups.has(fixtureGroup)) {
        failures.push(`groupBrowserAudits contains duplicate fixture group ${fixtureGroup}`);
      }
      auditedGroups.add(fixtureGroup);
      if (!Array.isArray(audit.browserFailures) || audit.browserFailures.length !== 0) {
        failures.push(`groupBrowserAudits ${fixtureGroup} must contain zero browser failures`);
      }
      const artifact = `browser-events-${fixtureGroup}.json`;
      validateArtifactBinding(
        audit.evidenceBinding,
        artifact,
        expectedCat05ArtifactBindingMetadata(artifact),
      );
    }
  }

  requireTrackedFile('summary.json', 'CAT05 summary');
  for (const artifact of expectedArtifacts) requireTrackedFile(artifact, `artifact ${artifact}`);
  if (!isDeepStrictEqual(trackedFolderFiles, ['summary.json', ...expectedArtifacts].sort())) {
    failures.push(
      'Git-tracked CAT05 evidence must contain summary.json plus the exact 139 non-summary artifacts',
    );
  }
  if (
    summary?.artifactCount !== CAT05_NATIVE_OCR_ARTIFACT_COUNT ||
    !isDeepStrictEqual(summary?.artifacts, expectedArtifacts)
  ) {
    failures.push(
      'artifacts must enumerate the exact 139 CAT05 non-summary files in lexical order',
    );
  }
  if (
    !Array.isArray(summary?.screenshots) ||
    summary.screenshots.length !== CAT05_NATIVE_OCR_SCREENSHOT_COUNT ||
    !isDeepStrictEqual(summary.screenshots, expectedScreenshots)
  ) {
    failures.push('screenshots must enumerate the exact 55 CAT05 PNG artifacts in lexical order');
  }
  if (
    !Array.isArray(summary?.artifactManifest) ||
    summary.artifactManifest.length !== CAT05_NATIVE_OCR_ARTIFACT_COUNT
  ) {
    failures.push('artifactManifest must contain exactly 139 byte/hash records');
  } else {
    summary.artifactManifest.forEach((manifestEntry, index) => {
      const artifact = expectedArtifacts[index];
      if (
        !hasExactObjectKeys(manifestEntry, ['bytes', 'path', 'sha256']) ||
        manifestEntry.path !== artifact ||
        !Number.isSafeInteger(manifestEntry.bytes) ||
        manifestEntry.bytes < 1 ||
        !/^[a-f0-9]{64}$/.test(String(manifestEntry.sha256 ?? ''))
      ) {
        failures.push(`artifactManifest entry ${index + 1} is not exactly bound to ${artifact}`);
        return;
      }
      const bytes = artifactBytes(artifact);
      if (
        bytes &&
        (manifestEntry.bytes !== bytes.length || manifestEntry.sha256 !== cat05Sha256(bytes))
      ) {
        failures.push(`artifactManifest hash/byte mismatch for ${artifact}`);
      }
    });
  }

  for (const artifact of expectedArtifacts) {
    if (artifact.endsWith('.png')) {
      const bytes = artifactBytes(artifact);
      const expectedDimensions = cat05ExpectedScreenshotDimensions(artifact);
      try {
        const actualDimensions = parsePngDimensions(bytes);
        if (!isDeepStrictEqual(actualDimensions, expectedDimensions)) {
          failures.push(
            `${artifact} dimensions must be ${expectedDimensions.width} x ${expectedDimensions.height}`,
          );
        }
      } catch (error) {
        failures.push(
          `${artifact} is not a readable CAT05 PNG: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      continue;
    }
    const bytes = artifactBytes(artifact);
    if (bytes) {
      failures.push(
        ...cat05TextArtifactHygieneFailures(
          artifact,
          bytes,
          artifact.endsWith('.log')
            ? CAT05_NATIVE_OCR_MAX_EXPO_LOG_BYTES
            : CAT05_NATIVE_OCR_MAX_DIAGNOSTIC_ARTIFACT_BYTES,
        ),
      );
    }
    if (!artifact.endsWith('.json')) continue;
    let contents;
    try {
      contents = readJsonFile(`${folder}/${artifact}`);
    } catch (error) {
      failures.push(
        `${artifact} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
      );
      continue;
    }
    failures.push(...cat05DiagnosticValueFailures(artifact, contents));
    if (artifact === 'scope.json') continue;
    const metadata = expectedCat05ArtifactBindingMetadata(artifact);
    if (metadata === undefined) {
      failures.push(`${artifact} has no reviewed CAT05 artifact-binding identity`);
    } else {
      validateArtifactBinding(contents?.evidenceBinding, artifact, metadata);
    }
    if (artifact.startsWith('browser-events-')) {
      failures.push(...collectCat05BrowserEventFailures(artifact, contents));
    }
  }

  if (requireTrackedFile('scope.json', 'CAT05 scope')) {
    try {
      const scope = readJsonFile(`${folder}/scope.json`);
      const expectedScope = {
        candidateNativeBuild: CAT05_NATIVE_OCR_CANDIDATE_BUILD,
        evidenceKind: 'deterministic_expo_web_ocr_review_ui_state',
        evidenceSchemaVersion: CAT05_NATIVE_OCR_SCHEMA_VERSION,
        fixtureConfigurationSha256,
        nativeDeviceProof: false,
        proves: CAT05_NATIVE_OCR_PROVES,
        doesNotProve: CAT05_NATIVE_OCR_LIMITATIONS.slice(1),
        evidenceBinding: expectedBinding,
        fixtureEnvironmentVariable: 'EXPO_PUBLIC_E2E_SHELF_OCR_RESULT',
        fixtureTranscript: 'Aqua, Glycerin, Niacinamide, 水, Ниацинамид',
        privacySourceContract,
        runId: expectedBinding.runId,
        scenarioMatrix: CAT05_NATIVE_OCR_SCENARIOS,
        scenarioMatrixSha256,
        sourceGitSha,
        surface: 'Expo web / headless Chromium / development-only deterministic fixture',
        viewportMatrix: CAT05_NATIVE_OCR_VIEWPORTS,
        viewportMatrixSha256,
        webFixtureBuild,
      };
      if (!isDeepStrictEqual(scope, expectedScope)) {
        failures.push('scope.json does not match the exact CAT05 source/build/proof boundary');
      }
    } catch (error) {
      failures.push(
        `scope.json is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  if (requireTrackedFile('report.md', 'CAT05 report')) {
    try {
      if (readTextFile(`${folder}/report.md`) !== buildExpectedCat05NativeOcrReport(summary)) {
        failures.push('report.md does not match the exact CAT05 PASS report contract');
      }
    } catch (error) {
      failures.push(
        `report.md could not be read: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  if (!sourceGitState) {
    failures.push('sourceGitSha consistency state is unavailable');
  } else {
    if (sourceGitState.sourceGitSha !== sourceGitSha) {
      failures.push('sourceGitSha consistency state does not match summary.sourceGitSha');
    }
    if (sourceGitState.commitExists !== true) {
      failures.push('sourceGitSha does not identify a local Git commit');
    }
    if (sourceGitState.isAncestorOfHead !== true) {
      failures.push('sourceGitSha must be an ancestor of the manifest HEAD');
    }
    if (sourceGitState.runnerMatchesSource !== true) {
      failures.push('CAT05 runner source does not match the recorded sourceGitSha');
    }
    const allowedGeneratedPaths = new Set([
      'docs/e2e/generated/human-e2e-manifest.json',
      'docs/e2e/generated/human-e2e-manifest.md',
    ]);
    const sourceChangeAllowed = (path) => {
      const normalized = normalizeRepoPath(path);
      return (
        normalized.startsWith(folderPrefix) ||
        cat05DocumentationOnlyPath(normalized) ||
        allowedGeneratedPaths.has(normalized) ||
        ignoredGeneratedOutputPath(normalized)
      );
    };
    const laterSourceChanges = (sourceGitState.changedRepoFilesSinceSource ?? []).filter(
      (path) => !sourceChangeAllowed(path),
    );
    if (laterSourceChanges.length > 0) {
      failures.push(`sourceGitSha predates later source changes: ${laterSourceChanges.join(', ')}`);
    }
    const dirtySourceChanges = (sourceGitState.dirtyTrackedRepoFiles ?? []).filter(
      (path) => !sourceChangeAllowed(path),
    );
    if (dirtySourceChanges.length > 0) {
      failures.push(
        `tracked source files changed after the recorded sourceGitSha: ${dirtySourceChanges.join(', ')}`,
      );
    }
    const untrackedSourceChanges = collectDisallowedUntrackedRepoFiles(
      sourceGitState.untrackedRepoFiles ?? [],
      {
        allowedExactPaths: allowedGeneratedPaths,
        allowedPrefixes: [folderPrefix, 'docs/'],
      },
    );
    if (untrackedSourceChanges.length > 0) {
      failures.push(
        `nonignored untracked source is not bound to sourceGitSha: ${untrackedSourceChanges.join(', ')}`,
      );
    }
  }

  return failures;
}

function collectAccountDeletionRecoveryObservationFailures(observations) {
  const failures = [];
  const topLevelKeys = [
    'schemaVersion',
    'surface',
    'capture',
    'browserErrorCount',
    'expectedWarningClasses',
    'liveCredentialsUsed',
    'externalLinksOpened',
    'destructiveRequestsPermittedByFixture',
    'states',
    'limitations',
  ];
  if (!hasExactObjectKeys(observations, topLevelKeys)) {
    return ['observations.json must use the exact reviewed top-level schema'];
  }
  if (
    observations.schemaVersion !== 1 ||
    !hasExactObjectKeys(observations.capture, ['format', 'width', 'height']) ||
    observations.capture.format !== 'jpeg' ||
    observations.capture.width !== 1279 ||
    observations.capture.height !== 720
  ) {
    failures.push('observations.json capture contract must be schema 1 JPEG 1279 x 720');
  }
  if (observations.browserErrorCount !== 0) {
    failures.push('observations.json browserErrorCount must be zero');
  }
  if (
    observations.liveCredentialsUsed !== false ||
    observations.externalLinksOpened !== false ||
    observations.destructiveRequestsPermittedByFixture !== false
  ) {
    failures.push('observations.json fixture safety flags must remain exact false values');
  }
  const expectedWarnings = [
    'placeholder_supabase_configuration',
    'expo_notifications_web_unsupported',
  ];
  if (JSON.stringify(observations.expectedWarningClasses) !== JSON.stringify(expectedWarnings)) {
    failures.push('observations.json expected warning classes changed');
  }
  const expectedStates = [
    {
      id: 'pending',
      fixture: 'pending_then_completed_manual',
      actions: ['launch'],
      alertCount: 1,
      buttons: ['Check status now'],
      screenshot: '01-pending-1279x720.jpg',
    },
    {
      id: 'apple_manual',
      fixture: 'pending_then_completed_manual',
      actions: ['launch', 'click:Check status now'],
      alertCount: 1,
      buttons: ['Open Apple instructions', 'Continue'],
      screenshot: '02-apple-manual-1279x720.jpg',
    },
    {
      id: 'signed_out',
      fixture: 'pending_then_completed_manual',
      actions: ['launch', 'click:Check status now', 'click:Continue'],
      alertCount: 0,
      buttons: ['Begin', 'I already have an account'],
      screenshot: '03-signed-out-landing-1279x720.jpg',
    },
    {
      id: 'invalid_retryable',
      fixture: 'invalid',
      actions: ['launch', 'click:Check status now', 'click:Retry deletion request'],
      alertCount: 1,
      buttons: ['Check status now', 'Retry deletion request', 'Open support'],
      screenshot: '04-invalid-receipt-1279x720.jpg',
    },
    {
      id: 'expired',
      fixture: 'expired',
      actions: ['launch', 'click:Check status now'],
      alertCount: 1,
      buttons: ['Check status now', 'Open support'],
      screenshot: '05-expired-receipt-1279x720.jpg',
    },
    {
      id: 'ownerless_support_only',
      fixture: 'invalid_support_only',
      actions: ['launch', 'click:Check status now'],
      alertCount: 1,
      buttons: ['Check status now', 'Open support'],
      screenshot: '06-ownerless-support-only-1279x720.jpg',
    },
  ];
  if (!Array.isArray(observations.states) || observations.states.length !== expectedStates.length) {
    failures.push('observations.json must contain exactly six reviewed states');
  } else {
    for (let index = 0; index < expectedStates.length; index += 1) {
      const actual = observations.states[index];
      const expected = expectedStates[index];
      if (
        !hasExactObjectKeys(actual, [
          'id',
          'fixture',
          'actions',
          'alertCount',
          'dialogCount',
          'buttons',
          'screenshot',
        ]) ||
        actual.id !== expected.id ||
        actual.fixture !== expected.fixture ||
        JSON.stringify(actual.actions) !== JSON.stringify(expected.actions) ||
        actual.alertCount !== expected.alertCount ||
        actual.dialogCount !== 0 ||
        JSON.stringify(actual.buttons) !== JSON.stringify(expected.buttons) ||
        actual.screenshot !== expected.screenshot
      ) {
        failures.push(`observations.json state ${index + 1} does not match the reviewed trace`);
      }
    }
  }
  if (!Array.isArray(observations.limitations) || observations.limitations.length < 3) {
    failures.push('observations.json must retain explicit evidence limitations');
  }
  return failures;
}

function runEvidenceProvenanceSmoke() {
  const folder = 'test-results/human-e2e/2099-01-01/trend-route-group-gate-current';
  const evidence = 'summary.json';
  const requiredFiles = [
    evidence,
    'report.md',
    'pre-fix-route-evidence.json',
    'pre-fix-optin-canonicalized-to-fairness.png',
    'post-fix-route-evidence.json',
    'post-fix-trend-optin.png',
    'post-fix-trend-fairness.png',
  ];
  const artifacts = requiredFiles.slice(1);
  const repoPaths = requiredFiles.map((file) => `${folder}/${file}`);
  const existing = new Set(repoPaths);
  const tracked = new Set(repoPaths);
  const validate = (overrides = {}) =>
    collectEvidenceProvenanceFailures({
      folder,
      evidence,
      requiredFiles,
      summaryArtifacts: artifacts,
      trackedRepoFiles: tracked,
      fileExists: (path) => existing.has(path),
      ...overrides,
      validateSummaryArtifacts: true,
    });
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
  };

  assert(validate().length === 0, 'complete tracked Trend evidence should pass provenance');

  const missingReport = validate({
    fileExists: (path) => existing.has(path) && !path.endsWith('/report.md'),
  });
  assert(
    missingReport.includes('missing required evidence file report.md') &&
      missingReport.includes('missing summary artifact report.md'),
    'missing files must fail both the gate requirement and summary artifact provenance',
  );

  const untrackedFairness = validate({
    trackedRepoFiles: new Set(
      repoPaths.filter((path) => !path.endsWith('/post-fix-trend-fairness.png')),
    ),
  });
  assert(
    untrackedFairness.includes(
      'required evidence file is not Git-tracked: post-fix-trend-fairness.png',
    ) &&
      untrackedFairness.includes(
        'summary artifact is not Git-tracked: post-fix-trend-fairness.png',
      ),
    'untracked files must fail both the gate requirement and summary artifact provenance',
  );

  const incompleteSummary = validate({ summaryArtifacts: artifacts.slice(1) });
  assert(
    incompleteSummary.includes('summary.artifacts is missing required evidence file report.md'),
    'summary.artifacts must enumerate every required auxiliary artifact',
  );

  const unsafeSummary = validate({ summaryArtifacts: [...artifacts, '../outside.png'] });
  assert(
    unsafeSummary.includes('summary.artifacts contains an unsafe path: ../outside.png'),
    'summary.artifacts must not escape the evidence folder',
  );

  const reportText = [
    'App surface: Expo web development fixtures',
    'native iPhone evidence remains required',
  ].join('\n');
  assert(
    collectRequiredTextFailures({
      label: 'report.md',
      text: reportText,
      requiredText: ['Expo web development fixtures', 'native iPhone evidence remains required'],
    }).length === 0,
    'complete report text should pass required-text provenance',
  );
  assert(
    collectRequiredTextFailures({
      label: 'report.md',
      text: reportText,
      requiredText: ['physical iPhone provider proof'],
    }).includes('report.md is missing required text: physical iPhone provider proof'),
    'missing report claims must fail required-text provenance',
  );

  assert(
    isDeepStrictEqual(
      collectDisallowedUntrackedRepoFiles([
        '.tmp/browser-profile/runtime.json',
        'apps/mobile/src/app/untracked-route.tsx',
        'docs/generated/readiness-status-audit.json',
      ]),
      ['apps/mobile/src/app/untracked-route.tsx'],
    ),
    'manifest provenance must reject untracked source while allowing only declared outputs',
  );

  const jpegHeader = Buffer.from([
    0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x02, 0xd0, 0x04, 0xff, 0x03, 0x01, 0x11, 0x00, 0x02,
    0x11, 0x00, 0x03, 0x11, 0x00,
  ]);
  assert(
    JSON.stringify(parseJpegDimensions(jpegHeader)) ===
      JSON.stringify({ width: 1279, height: 720 }),
    'JPEG evidence dimensions must be parsed from the committed bytes',
  );
  let invalidJpegRejected = false;
  try {
    parseJpegDimensions(Buffer.from('not-a-jpeg'));
  } catch {
    invalidJpegRejected = true;
  }
  assert(invalidJpegRejected, 'non-JPEG evidence must fail dimension parsing');
}

function runCat04CatalogRecoveryContractSmoke() {
  const folder = 'test-results/human-e2e/2099-01-01/cat04-catalog-recovery-current';
  const timestamp = '2099-01-01T00:00:00.000Z';
  const files = new Map();
  const screenshots = [];
  const scenarios = [];
  const bootstrapResults = [];
  const reportLines = [
    '# CAT04 Catalog Recovery Expo-Web Audit',
    '- Verdict: pass',
    '- Surface: Expo web deterministic development fixtures',
    '- Native-device proof: No',
    `- Source Git SHA: ${'a'.repeat(40)}`,
    'Machine-readable result: `summary.json`',
  ];

  const persistResult = (prefix, result) => {
    files.set(`${prefix}-result.json`, result);
    const screenshot = `${prefix}-proof.png`;
    screenshots.push(screenshot);
    files.set(screenshot, '<png>');
    files.set(`${prefix}-proof.json`, { url: 'http://localhost/proof' });
  };

  for (const fixtureGroup of CAT04_CATALOG_FIXTURE_GROUPS) {
    for (const viewport of CAT04_CATALOG_VIEWPORTS) {
      const prefix = `bootstrap-${fixtureGroup}-${viewport.id}`;
      const result = {
        artifactPrefix: prefix,
        browserFailures: [],
        completedAt: timestamp,
        endUrl: 'http://localhost/shelf/search',
        error: null,
        fixtureGroup,
        nativeDeviceProof: false,
        startedAt: timestamp,
        surface: 'expo-web',
        verdict: 'pass',
        viewport: { ...viewport },
      };
      bootstrapResults.push(result);
      persistResult(prefix, result);
      reportLines.push(`| ${fixtureGroup} | ${viewport.width}x${viewport.height} | pass |  |`);
    }
  }

  for (const scenario of CAT04_CATALOG_SCENARIOS) {
    for (const viewport of CAT04_CATALOG_VIEWPORTS) {
      const prefix = `${scenario.id}-${viewport.id}`;
      const result = {
        artifactPrefix: prefix,
        browserFailures: [],
        completedAt: timestamp,
        endUrl: `http://localhost${scenario.route}`,
        error: null,
        fixture: scenario.fixture,
        fixtureGroup: scenario.groupId,
        nativeDeviceProof: false,
        route: scenario.route,
        scenarioId: scenario.id,
        startedAt: timestamp,
        surface: 'expo-web',
        verdict: 'pass',
        viewport: { ...viewport },
      };
      scenarios.push(result);
      persistResult(prefix, result);
      reportLines.push(`| ${scenario.id} | ${viewport.width}x${viewport.height} | pass |  |`);
    }
  }

  files.set('report.md', reportLines.join('\n'));
  const summary = {
    artifacts: [...files.keys()].sort(),
    bootstrapResults,
    completedAt: timestamp,
    expectedBootstrapCount: 18,
    expectedExecutionCount: 45,
    fixtureGroups: [...CAT04_CATALOG_FIXTURE_GROUPS],
    limitations: ['Expo web only.'],
    nativeDeviceProof: false,
    requiredViewports: CAT04_CATALOG_VIEWPORTS.map((viewport) => ({ ...viewport })),
    scenarioDefinitions: CAT04_CATALOG_SCENARIOS.map((scenario) => ({ ...scenario })),
    scenarios,
    schemaVersion: 1,
    screenshots: [...screenshots].sort(),
    sourceGitSha: 'a'.repeat(40),
    startedAt: timestamp,
    surface: 'expo-web',
    verdict: 'pass',
  };
  files.set('summary.json', summary);
  const trackedRepoFiles = new Set([...files.keys()].map((file) => `${folder}/${file}`));
  const sourceGitState = {
    changedRepoFilesSinceSource: [],
    commitExists: true,
    dirtyTrackedRepoFiles: [],
    isAncestorOfHead: true,
    runnerMatchesSource: true,
    sourceGitSha: summary.sourceGitSha,
    untrackedRepoFiles: [],
  };
  const validate = (candidate = summary, overrides = {}) =>
    collectCat04CatalogRecoveryFailures({
      folder,
      summary: candidate,
      sourceGitState,
      trackedRepoFiles,
      fileExists: (path) => files.has(path.slice(`${folder}/`.length)),
      readJsonFile: (path) => files.get(path.slice(`${folder}/`.length)),
      readTextFile: (path) => files.get(path.slice(`${folder}/`.length)),
      ...overrides,
    });
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
  };

  assert(validate().length === 0, 'complete tracked CAT04 evidence should pass');

  const browserFailure = structuredClone(summary);
  browserFailure.scenarios[0].browserFailures = [{ kind: 'console-error' }];
  assert(
    validate(browserFailure).some((failure) =>
      failure.includes('browserFailures must be an empty array'),
    ),
    'scenario browser failures must fail the CAT04 contract',
  );

  const duplicateScenario = structuredClone(summary);
  duplicateScenario.scenarios[1] = duplicateScenario.scenarios[0];
  const duplicateFailures = validate(duplicateScenario);
  assert(
    duplicateFailures.some((failure) => failure.includes('duplicate scenario execution')) &&
      duplicateFailures.some((failure) => failure.includes('missing scenario execution')),
    'duplicate scenario/viewport pairs must fail exact matrix coverage',
  );

  const missingArtifact = structuredClone(summary);
  missingArtifact.artifacts = missingArtifact.artifacts.filter(
    (artifact) => artifact !== 'report.md',
  );
  assert(
    validate(missingArtifact).some((failure) =>
      failure.includes('artifacts is missing required CAT04 evidence report.md'),
    ),
    'optional artifacts provenance must cover the CAT04 report when present',
  );

  const untrackedScreenshot = screenshots[0];
  const reducedTracked = new Set(trackedRepoFiles);
  reducedTracked.delete(`${folder}/${untrackedScreenshot}`);
  assert(
    validate(summary, { trackedRepoFiles: reducedTracked }).some((failure) =>
      failure.includes(`CAT04 evidence file is not Git-tracked: ${untrackedScreenshot}`),
    ),
    'untracked CAT04 screenshots must fail provenance',
  );

  const invalidSourceSha = { ...summary, sourceGitSha: 'short' };
  assert(
    validate(invalidSourceSha).includes(
      'sourceGitSha must be a lowercase full 40-character Git SHA',
    ),
    'sourceGitSha must be mandatory and validated',
  );

  assert(
    validate(summary, {
      sourceGitState: {
        ...sourceGitState,
        changedRepoFilesSinceSource: ['apps/mobile/src/app/(tabs)/shelf.tsx'],
      },
    }).some((failure) => failure.includes('sourceGitSha predates later source changes')),
    'later production changes must invalidate the recorded source SHA',
  );
  assert(
    validate(summary, {
      sourceGitState: {
        ...sourceGitState,
        changedRepoFilesSinceSource: [`${folder}/report.md`],
      },
    }).length === 0,
    'the evidence commit itself may descend from the recorded source SHA',
  );
  assert(
    validate(summary, {
      sourceGitState: {
        ...sourceGitState,
        untrackedRepoFiles: ['apps/mobile/src/app/shelf/untracked-route.tsx'],
      },
    }).some((failure) => failure.includes('nonignored untracked source is not bound')),
    'untracked app source must invalidate source-bound CAT04 evidence',
  );
  assert(
    validate(summary, {
      sourceGitState: {
        ...sourceGitState,
        untrackedRepoFiles: [
          `${folder}/rerun-screenshot.png`,
          '.tmp/cat04-browser-profile/runtime.json',
          'docs/generated/readiness-status-audit.json',
        ],
      },
    }).length === 0,
    'only declared CAT04 evidence, generated packets, and runtime scratch may remain untracked',
  );
  assert(
    validate(summary, {
      sourceGitState: { ...sourceGitState, runnerMatchesSource: false },
    }).includes('CAT04 runner source does not match the recorded sourceGitSha'),
    'runner drift must invalidate source-bound CAT04 evidence',
  );

  const missingArtifacts = { ...summary };
  delete missingArtifacts.artifacts;
  assert(
    validate(missingArtifacts).includes(
      'artifacts must be a deterministic evidence-relative array',
    ),
    'artifacts provenance must be mandatory',
  );
}

function runCat05NativeOcrReviewContractSmoke() {
  const folder = 'test-results/human-e2e/2099-01-01/cat05-native-ocr-web-ui-current';
  const timestamp = '2099-01-01T00:00:00.000Z';
  const sourceGitSha = 'a'.repeat(40);
  const runId = '00000000-0000-4000-8000-000000000001';
  const fixtureConfigurationSha256 = 'b'.repeat(64);
  const scenarioMatrixSha256 = cat05Sha256Json(CAT05_NATIVE_OCR_SCENARIOS);
  const viewportMatrixSha256 = cat05Sha256Json(CAT05_NATIVE_OCR_VIEWPORTS);
  const webFixtureBuild = {
    buildId: cat05Sha256Json({
      evidenceSchemaVersion: CAT05_NATIVE_OCR_SCHEMA_VERSION,
      fixtureConfigurationSha256,
      scenarioMatrixSha256,
      sourceGitSha,
      viewportMatrixSha256,
    }),
    profile: 'development-only-deterministic-expo-web',
  };
  const binding = {
    candidateNativeBuild: { ...CAT05_NATIVE_OCR_CANDIDATE_BUILD },
    evidenceSchemaVersion: CAT05_NATIVE_OCR_SCHEMA_VERSION,
    expectedSourceGitSha: sourceGitSha,
    fixtureConfigurationSha256,
    runId,
    scenarioMatrixSha256,
    sourceGitSha,
    viewportMatrixSha256,
    webFixtureBuild,
  };
  const privacySourceContract = {
    assertionIds: [...CAT05_NATIVE_OCR_PRIVACY_ASSERTIONS],
    files: CAT05_NATIVE_OCR_PRIVACY_FILES.map((path, index) => ({
      bytes: index + 1,
      path,
      sha256: String(index + 1).repeat(64),
    })),
    nativeDeviceProof: false,
    proofKind: 'source-assertions-only',
  };
  const artifactBinding = (artifact) => ({
    ...binding,
    ...expectedCat05ArtifactBindingMetadata(artifact),
  });
  const results = [];
  const groupBrowserAudits = [];
  const resultByFile = new Map();
  const bootstrapViewport = CAT05_NATIVE_OCR_VIEWPORTS[1];

  for (const fixtureGroup of CAT05_NATIVE_OCR_FIXTURE_GROUPS) {
    const prefix = `bootstrap-${fixtureGroup}-${bootstrapViewport.id}`;
    const resultFile = `${prefix}-result.json`;
    const result = {
      artifactPrefix: prefix,
      browserFailures: [],
      completedAt: timestamp,
      evidenceBinding: artifactBinding(resultFile),
      error: null,
      fixtureGroup,
      nativeDeviceProof: false,
      startedAt: timestamp,
      surface: 'expo-web',
      verdict: 'pass',
      viewport: { ...bootstrapViewport },
      endUrl: 'http://localhost:8620/shelf/ocr',
      kind: 'consent-bootstrap',
    };
    results.push(result);
    resultByFile.set(resultFile, result);
    groupBrowserAudits.push({
      browserFailures: [],
      evidenceBinding: artifactBinding(`browser-events-${fixtureGroup}.json`),
      fixtureGroup,
    });
    for (const scenario of CAT05_NATIVE_OCR_SCENARIOS.filter(
      ({ groupId }) => groupId === fixtureGroup,
    )) {
      for (const viewport of CAT05_NATIVE_OCR_VIEWPORTS) {
        const scenarioPrefix = `${scenario.id}-${viewport.id}`;
        const scenarioResultFile = `${scenarioPrefix}-result.json`;
        const scenarioResult = {
          artifactPrefix: scenarioPrefix,
          browserFailures: [],
          completedAt: timestamp,
          evidenceBinding: artifactBinding(scenarioResultFile),
          error: null,
          fixture: scenario.fixture,
          fixtureGroup,
          kind: 'scenario',
          nativeDeviceProof: false,
          scenarioId: scenario.id,
          startedAt: timestamp,
          surface: 'expo-web-deterministic-ui-fixture',
          verdict: 'pass',
          viewport: { ...viewport },
          endUrl: 'http://localhost:8620/shelf/manual',
        };
        results.push(scenarioResult);
        resultByFile.set(scenarioResultFile, scenarioResult);
      }
    }
  }

  const artifacts = expectedCat05NativeOcrArtifacts();
  const summary = {
    artifactCount: CAT05_NATIVE_OCR_ARTIFACT_COUNT,
    artifactManifest: [],
    artifacts,
    browserFailureCount: 0,
    browserPath: 'chrome.exe',
    candidateNativeBuild: { ...CAT05_NATIVE_OCR_CANDIDATE_BUILD },
    completedAt: timestamp,
    evidenceBinding: binding,
    evidenceSchemaVersion: CAT05_NATIVE_OCR_SCHEMA_VERSION,
    expectedBootstrapCount: 4,
    expectedExecutionCount: 15,
    fixtureGroups: [...CAT05_NATIVE_OCR_FIXTURE_GROUPS],
    groupBrowserAudits,
    limitations: [...CAT05_NATIVE_OCR_LIMITATIONS],
    nativeDeviceProof: false,
    passedBootstrapCount: 4,
    passedExecutionCount: 15,
    privacySourceContract,
    results,
    runId,
    scenarioMatrix: CAT05_NATIVE_OCR_SCENARIOS.map((scenario) => ({ ...scenario })),
    sourceGitSha,
    startedAt: timestamp,
    surface: 'Expo web / deterministic development-only OCR review fixture',
    verdict: 'pass',
    viewports: CAT05_NATIVE_OCR_VIEWPORTS.map((viewport) => ({ ...viewport })),
    webFixtureBuild,
    screenshots: artifacts.filter((artifact) => artifact.endsWith('.png')),
  };
  const scope = {
    candidateNativeBuild: { ...CAT05_NATIVE_OCR_CANDIDATE_BUILD },
    evidenceKind: 'deterministic_expo_web_ocr_review_ui_state',
    evidenceSchemaVersion: CAT05_NATIVE_OCR_SCHEMA_VERSION,
    fixtureConfigurationSha256,
    nativeDeviceProof: false,
    proves: [...CAT05_NATIVE_OCR_PROVES],
    doesNotProve: CAT05_NATIVE_OCR_LIMITATIONS.slice(1),
    evidenceBinding: binding,
    fixtureEnvironmentVariable: 'EXPO_PUBLIC_E2E_SHELF_OCR_RESULT',
    fixtureTranscript: 'Aqua, Glycerin, Niacinamide, 水, Ниацинамид',
    privacySourceContract,
    runId,
    scenarioMatrix: CAT05_NATIVE_OCR_SCENARIOS.map((scenario) => ({ ...scenario })),
    scenarioMatrixSha256,
    sourceGitSha,
    surface: 'Expo web / headless Chromium / development-only deterministic fixture',
    viewportMatrix: CAT05_NATIVE_OCR_VIEWPORTS.map((viewport) => ({ ...viewport })),
    viewportMatrixSha256,
    webFixtureBuild,
  };
  const files = new Map();
  const writeJsonFixture = (name, value) => {
    files.set(name, Buffer.from(`${JSON.stringify(value, null, 2)}\n`));
  };
  const pngFixtures = new Map();
  const pngFixture = ({ height, width }) => {
    const key = `${width}x${height}`;
    if (pngFixtures.has(key)) return pngFixtures.get(key);
    const bytes = PNG.sync.write({
      data: Buffer.alloc(width * height * 4, 255),
      height,
      width,
    });
    pngFixtures.set(key, bytes);
    return bytes;
  };

  for (const artifact of artifacts) {
    if (artifact === 'report.md' || artifact === 'scope.json') continue;
    if (artifact.endsWith('.png')) {
      files.set(artifact, pngFixture(cat05ExpectedScreenshotDimensions(artifact)));
    } else if (artifact.endsWith('.log')) {
      files.set(artifact, Buffer.from('Expo fixture ready at http://localhost:8620\n'));
    } else if (resultByFile.has(artifact)) {
      writeJsonFixture(artifact, resultByFile.get(artifact));
    } else if (artifact.startsWith('browser-events-')) {
      const browserEvents = [
        {
          documentURL: 'http://localhost:8620/shelf/ocr',
          method: 'Network.requestWillBeSent',
          observedAt: timestamp,
          requestId: 'request-1',
          requestMethod: 'GET',
          type: 'Document',
          url: 'http://localhost:8620/shelf/ocr',
        },
        {
          method: 'Network.responseReceived',
          mimeType: 'text/html',
          observedAt: timestamp,
          requestId: 'request-1',
          status: 200,
          type: 'Document',
          url: 'http://localhost:8620/shelf/ocr',
        },
        {
          method: 'Network.webSocketCreated',
          observedAt: timestamp,
          params: { requestId: 'socket-1', url: 'ws://localhost:8620/hot' },
        },
      ];
      writeJsonFixture(artifact, {
        evidenceBinding: artifactBinding(artifact),
        events: browserEvents,
        retention: {
          ignoredEventCount: 1,
          inputEventCount: browserEvents.length + 1,
          limits: {
            maxRetainedBytes: CAT05_NATIVE_OCR_MAX_BROWSER_EVENT_BYTES,
            maxRetainedEvents: CAT05_NATIVE_OCR_MAX_RETAINED_BROWSER_EVENTS,
          },
          retainedEventCount: browserEvents.length,
          sanitizedBytes: Buffer.byteLength(JSON.stringify(browserEvents), 'utf8'),
          truncated: false,
        },
      });
    } else {
      const metadata = expectedCat05ArtifactBindingMetadata(artifact);
      writeJsonFixture(artifact, {
        issues: [],
        url: 'http://localhost:8620/shelf/ocr',
        viewport: metadata.viewport
          ? { height: metadata.viewport.height, width: metadata.viewport.width }
          : null,
        evidenceBinding: artifactBinding(artifact),
      });
    }
  }
  writeJsonFixture('scope.json', scope);
  files.set('report.md', Buffer.from(buildExpectedCat05NativeOcrReport(summary)));
  summary.artifactManifest = artifacts.map((artifact) => ({
    bytes: files.get(artifact).length,
    path: artifact,
    sha256: cat05Sha256(files.get(artifact)),
  }));
  writeJsonFixture('summary.json', summary);

  const sourceGitState = {
    changedRepoFilesSinceSource: [],
    commitExists: true,
    dirtyTrackedRepoFiles: [],
    isAncestorOfHead: true,
    privacySourceFiles: privacySourceContract.files.map((file) => ({
      ...file,
      currentBytes: file.bytes,
      currentSha256: file.sha256,
    })),
    runnerMatchesSource: true,
    sourceGitSha,
    untrackedRepoFiles: [],
  };
  const trackedRepoFiles = new Set([...files.keys()].map((file) => `${folder}/${file}`));
  const validate = (candidate = summary, overrides = {}) => {
    const fixtureFiles = overrides.files ?? files;
    const tracked = overrides.trackedRepoFiles ?? trackedRepoFiles;
    return collectCat05NativeOcrReviewFailures({
      folder,
      summary: candidate,
      sourceGitState: overrides.sourceGitState ?? sourceGitState,
      trackedRepoFiles: tracked,
      fileExists: (path) => fixtureFiles.has(path.slice(`${folder}/`.length)),
      readBytesFile: (path) => fixtureFiles.get(path.slice(`${folder}/`.length)),
      readJsonFile: (path) =>
        JSON.parse(fixtureFiles.get(path.slice(`${folder}/`.length)).toString('utf8')),
      readTextFile: (path) => fixtureFiles.get(path.slice(`${folder}/`.length)).toString('utf8'),
    });
  };
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
  };

  const completeFailures = validate();
  assert(
    completeFailures.length === 0,
    `complete tracked CAT05 evidence should pass: ${completeFailures.join('; ')}`,
  );

  const forgedPrivacyContract = structuredClone(summary);
  forgedPrivacyContract.privacySourceContract.files[0].sha256 = '0'.repeat(64);
  assert(
    validate(forgedPrivacyContract).some((failure) =>
      failure.includes('do not match the recorded sourceGitSha'),
    ),
    'privacy source hashes must be recomputed from the recorded source commit',
  );
  const changedCurrentPrivacyState = structuredClone(sourceGitState);
  changedCurrentPrivacyState.privacySourceFiles[0].currentSha256 = '0'.repeat(64);
  assert(
    validate(summary, { sourceGitState: changedCurrentPrivacyState }).some((failure) =>
      failure.includes('current CAT05 privacy source does not match'),
    ),
    'current privacy source bytes must still match the recorded source commit',
  );

  const hostPathSummary = structuredClone(summary);
  hostPathSummary.browserPath = 'C:\\Users\\person\\AppData\\chrome.exe';
  assert(
    validate(hostPathSummary).some(
      (failure) =>
        failure.includes('browser executable basename') ||
        failure.includes('contains a user-profile'),
    ),
    'summary browser identity must not expose a host path',
  );

  const nativeClaim = structuredClone(summary);
  nativeClaim.nativeDeviceProof = true;
  assert(
    validate(nativeClaim).includes(
      'nativeDeviceProof must be false for the CAT05 Expo-web compatibility gate',
    ),
    'CAT05 Expo-web evidence must never claim native-device proof',
  );

  const changedManifest = structuredClone(summary);
  changedManifest.artifactManifest[0].sha256 = '0'.repeat(64);
  assert(
    validate(changedManifest).some((failure) => failure.includes('hash/byte mismatch')),
    'artifact bytes and hashes must be verified against committed evidence',
  );

  const changedBindingFiles = new Map(files);
  const snapshotArtifact = artifacts.find(
    (artifact) => artifact.endsWith('-initial.json') && !artifact.startsWith('bootstrap-'),
  );
  const changedSnapshot = JSON.parse(changedBindingFiles.get(snapshotArtifact).toString('utf8'));
  changedSnapshot.evidenceBinding.runId = '00000000-0000-4000-8000-000000000002';
  changedBindingFiles.set(snapshotArtifact, Buffer.from(`${JSON.stringify(changedSnapshot)}\n`));
  assert(
    validate(summary, { files: changedBindingFiles }).some((failure) =>
      failure.includes(`${snapshotArtifact} evidenceBinding does not match`),
    ),
    'every JSON artifact must remain bound to the exact CAT05 run',
  );

  const externalNetworkFiles = new Map(files);
  const browserArtifact = 'browser-events-recognized.json';
  const externalBrowserEvents = JSON.parse(externalNetworkFiles.get(browserArtifact).toString());
  externalBrowserEvents.events[0].url = 'https://api.example.com/private-label';
  externalNetworkFiles.set(
    browserArtifact,
    Buffer.from(`${JSON.stringify(externalBrowserEvents)}\n`),
  );
  assert(
    validate(summary, { files: externalNetworkFiles }).some((failure) =>
      failure.includes('contains a disallowed https: URL literal'),
    ),
    'external HTTPS literals must fail CAT05 browser-event evidence',
  );

  const inconsistentRetentionFiles = new Map(files);
  const inconsistentRetention = JSON.parse(
    inconsistentRetentionFiles.get(browserArtifact).toString(),
  );
  inconsistentRetention.retention.retainedEventCount = 0;
  inconsistentRetentionFiles.set(
    browserArtifact,
    Buffer.from(`${JSON.stringify(inconsistentRetention)}\n`),
  );
  assert(
    validate(summary, { files: inconsistentRetentionFiles }).some((failure) =>
      failure.includes('retention event counts are inconsistent'),
    ),
    'browser-event retention counts must be recomputed from stored events',
  );

  const browserFailureFiles = new Map(files);
  const browserFailureEvidence = JSON.parse(browserFailureFiles.get(browserArtifact).toString());
  browserFailureEvidence.events.push({
    canceled: false,
    errorText: 'net::ERR_FAILED',
    method: 'Network.loadingFailed',
    observedAt: timestamp,
    requestId: 'request-1',
    type: 'Document',
  });
  browserFailureEvidence.retention.inputEventCount += 1;
  browserFailureEvidence.retention.retainedEventCount += 1;
  browserFailureEvidence.retention.sanitizedBytes = Buffer.byteLength(
    JSON.stringify(browserFailureEvidence.events),
    'utf8',
  );
  browserFailureFiles.set(
    browserArtifact,
    Buffer.from(`${JSON.stringify(browserFailureEvidence)}\n`),
  );
  assert(
    validate(summary, { files: browserFailureFiles }).some((failure) =>
      failure.includes('disallowed browser failure method Network.loadingFailed'),
    ),
    'stored browser failures must invalidate a zero-failure summary',
  );

  const emptyNetworkFiles = new Map(files);
  const emptyNetworkEvidence = JSON.parse(emptyNetworkFiles.get(browserArtifact).toString());
  emptyNetworkEvidence.events = [];
  emptyNetworkEvidence.retention = {
    ignoredEventCount: 0,
    inputEventCount: 0,
    limits: {
      maxRetainedBytes: CAT05_NATIVE_OCR_MAX_BROWSER_EVENT_BYTES,
      maxRetainedEvents: CAT05_NATIVE_OCR_MAX_RETAINED_BROWSER_EVENTS,
    },
    retainedEventCount: 0,
    sanitizedBytes: 2,
    truncated: false,
  };
  emptyNetworkFiles.set(browserArtifact, Buffer.from(`${JSON.stringify(emptyNetworkEvidence)}\n`));
  assert(
    validate(summary, { files: emptyNetworkFiles }).some((failure) =>
      failure.includes('nonzero localhost request and response coverage'),
    ),
    'an empty retained browser trace must not prove local network behavior',
  );

  const leakedPathFiles = new Map(files);
  leakedPathFiles.set(
    'expo-recognized.log',
    Buffer.from('C:\\Users\\person\\Desktop\\onSkin\\private.log\n'),
  );
  assert(
    validate(summary, { files: leakedPathFiles }).some((failure) =>
      failure.includes('contains a user-profile'),
    ),
    'user-profile paths must fail CAT05 diagnostic evidence',
  );

  const sensitiveSnapshotFiles = new Map(files);
  const sensitiveSnapshot = JSON.parse(sensitiveSnapshotFiles.get(snapshotArtifact).toString());
  sensitiveSnapshot.privatePhoto = 'data:image/jpeg;base64,raw-photo-bytes';
  sensitiveSnapshotFiles.set(
    snapshotArtifact,
    Buffer.from(`${JSON.stringify(sensitiveSnapshot)}\n`),
  );
  assert(
    validate(summary, { files: sensitiveSnapshotFiles }).some((failure) =>
      failure.includes('contains a sensitive URI literal'),
    ),
    'every JSON snapshot must reject sensitive photo URI schemes',
  );

  const credentialLogFiles = new Map(files);
  credentialLogFiles.set(
    'expo-recognized.log',
    Buffer.from('NPM_TOKEN=must-not-survive Authorization: Basic dXNlcjpwYXNz\n'),
  );
  const credentialFailures = validate(summary, { files: credentialLogFiles });
  assert(
    credentialFailures.some(
      (failure) =>
        failure.includes('authorization credential') ||
        failure.includes('credential or token value'),
    ),
    'environment tokens and HTTP authorization credentials must be rejected',
  );

  const queryLeakFiles = new Map(files);
  const queryLeak = JSON.parse(queryLeakFiles.get(snapshotArtifact).toString());
  queryLeak.url = 'http://localhost:8620/shelf/ocr?token=must-not-survive';
  queryLeakFiles.set(snapshotArtifact, Buffer.from(`${JSON.stringify(queryLeak)}\n`));
  assert(
    validate(summary, { files: queryLeakFiles }).some((failure) =>
      failure.includes('unredacted URL query value'),
    ),
    'localhost URLs must not retain query values',
  );

  const payloadLeakFiles = new Map(files);
  payloadLeakFiles.set('expo-recognized.log', Buffer.from(`${'A'.repeat(200)}\n`));
  assert(
    validate(summary, { files: payloadLeakFiles }).some((failure) =>
      failure.includes('long base64-like payload'),
    ),
    'long base64-like payloads must not survive in textual evidence',
  );

  const oversizedLogFiles = new Map(files);
  oversizedLogFiles.set(
    'expo-recognized.log',
    Buffer.alloc(CAT05_NATIVE_OCR_MAX_EXPO_LOG_BYTES + 1, 120),
  );
  assert(
    validate(summary, { files: oversizedLogFiles }).some((failure) =>
      failure.includes(`exceeds ${CAT05_NATIVE_OCR_MAX_EXPO_LOG_BYTES} reviewed bytes`),
    ),
    'oversized diagnostic logs must fail the evidence contract',
  );

  const controlCharacterFiles = new Map(files);
  const controlCharacterSnapshot = JSON.parse(
    controlCharacterFiles.get(snapshotArtifact).toString(),
  );
  controlCharacterSnapshot.note = '\u0001';
  controlCharacterFiles.set(
    snapshotArtifact,
    Buffer.from(`${JSON.stringify(controlCharacterSnapshot)}\n`),
  );
  assert(
    validate(summary, { files: controlCharacterFiles }).some((failure) =>
      failure.includes('disallowed control character'),
    ),
    'control characters inside parsed JSON strings must fail diagnostic hygiene',
  );

  const corruptPngFiles = new Map(files);
  const corruptPngArtifact = summary.screenshots[0];
  corruptPngFiles.set(corruptPngArtifact, corruptPngFiles.get(corruptPngArtifact).subarray(0, 24));
  assert(
    validate(summary, { files: corruptPngFiles }).some((failure) =>
      failure.includes('is not a readable CAT05 PNG'),
    ),
    'truncated header-only PNG evidence must fail complete decode validation',
  );

  const duplicateScenario = structuredClone(summary);
  const scenarioIndexes = duplicateScenario.results
    .map((result, index) => (result.kind === 'scenario' ? index : null))
    .filter((index) => index !== null);
  duplicateScenario.results[scenarioIndexes[1]] = duplicateScenario.results[scenarioIndexes[0]];
  const duplicateFailures = validate(duplicateScenario);
  assert(
    duplicateFailures.some((failure) => failure.includes('duplicate CAT05 scenario')) &&
      duplicateFailures.some((failure) => failure.includes('missing CAT05 scenario')),
    'CAT05 scenario coverage must be exact and duplicate-free',
  );

  const reducedTracked = new Set(trackedRepoFiles);
  reducedTracked.delete(`${folder}/${summary.screenshots[0]}`);
  assert(
    validate(summary, { trackedRepoFiles: reducedTracked }).some((failure) =>
      failure.includes('CAT05 evidence file is not Git-tracked'),
    ),
    'all CAT05 artifacts must be Git-tracked',
  );

  assert(
    validate(summary, {
      sourceGitState: { ...sourceGitState, runnerMatchesSource: false },
    }).includes('CAT05 runner source does not match the recorded sourceGitSha'),
    'CAT05 runner drift must invalidate source-bound evidence',
  );
  assert(
    validate(summary, {
      sourceGitState: {
        ...sourceGitState,
        untrackedRepoFiles: ['apps/mobile/src/app/shelf/untracked-ocr.tsx'],
      },
    }).some((failure) => failure.includes('nonignored untracked source is not bound')),
    'untracked app source must invalidate CAT05 evidence',
  );

  assert(
    validate(summary, {
      sourceGitState: {
        ...sourceGitState,
        changedRepoFilesSinceSource: ['docs/hugeToDo/CAT-05-closeout.md'],
        dirtyTrackedRepoFiles: ['BLOCKERS.md', 'LAUNCH_READINESS.md', 'PROGRESS.md'],
        untrackedRepoFiles: ['docs/e2e/cat05-review-notes.md'],
      },
    }).length === 0,
    'documentation-only CAT05 closeout changes must not stale runtime evidence',
  );
  assert(
    validate(summary, {
      sourceGitState: {
        ...sourceGitState,
        changedRepoFilesSinceSource: ['scripts/docs/readiness-status-audit.mjs'],
      },
    }).some((failure) => failure.includes('sourceGitSha predates later source changes')),
    'script changes must still invalidate CAT05 source-bound evidence',
  );
}

if (args.has('--provenance-smoke')) {
  try {
    runEvidenceProvenanceSmoke();
    console.log('PASS Human-E2E evidence provenance smoke');
    process.exit(0);
  } catch (error) {
    console.error(
      `FAIL Human-E2E evidence provenance smoke: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    process.exit(1);
  }
}

if (args.has('--cat04-contract-smoke')) {
  try {
    runCat04CatalogRecoveryContractSmoke();
    console.log('PASS CAT04 catalog-recovery evidence contract smoke');
    process.exit(0);
  } catch (error) {
    console.error(
      `FAIL CAT04 catalog-recovery evidence contract smoke: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    process.exit(1);
  }
}

if (args.has('--cat05-contract-smoke')) {
  try {
    runCat05NativeOcrReviewContractSmoke();
    console.log('PASS CAT05 native-OCR review evidence contract smoke');
    process.exit(0);
  } catch (error) {
    console.error(
      `FAIL CAT05 native-OCR review evidence contract smoke: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    process.exit(1);
  }
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

function commandLines(name, commandArgs) {
  return commandRequired(name, commandArgs)
    .split(/\r?\n/)
    .map((line) => normalizeRepoPath(line.trim()))
    .filter(Boolean);
}

function inspectCat04SourceGitState(sourceGitSha) {
  const state = {
    changedRepoFilesSinceSource: [],
    commitExists: false,
    dirtyTrackedRepoFiles: [],
    isAncestorOfHead: false,
    runnerMatchesSource: false,
    sourceGitSha,
    untrackedRepoFiles: [],
  };
  if (!/^[a-f0-9]{40}$/.test(sourceGitSha)) return state;

  try {
    commandRequired('git', ['cat-file', '-e', `${sourceGitSha}^{commit}`]);
    state.commitExists = true;
  } catch {
    return state;
  }

  try {
    commandRequired('git', ['merge-base', '--is-ancestor', sourceGitSha, 'HEAD']);
    state.isAncestorOfHead = true;
  } catch {
    state.isAncestorOfHead = false;
  }

  const runnerPath = 'scripts/e2e/cat04-catalog-recovery-audit.mjs';
  try {
    commandRequired('git', ['cat-file', '-e', `${sourceGitSha}:${runnerPath}`]);
    execFileSync('git', ['diff', '--quiet', sourceGitSha, '--', runnerPath], {
      cwd: root,
      stdio: 'ignore',
    });
    state.runnerMatchesSource = true;
  } catch {
    state.runnerMatchesSource = false;
  }

  try {
    state.changedRepoFilesSinceSource = commandLines('git', [
      'diff',
      '--name-only',
      `${sourceGitSha}..HEAD`,
    ]);
  } catch {
    state.changedRepoFilesSinceSource = ['<unable-to-compare-source-sha>'];
  }

  try {
    state.dirtyTrackedRepoFiles = [
      ...commandLines('git', ['diff', '--name-only']),
      ...commandLines('git', ['diff', '--cached', '--name-only']),
    ].filter((path, index, paths) => paths.indexOf(path) === index);
  } catch {
    state.dirtyTrackedRepoFiles = ['<unable-to-enumerate-dirty-files>'];
  }

  try {
    state.untrackedRepoFiles = listGitUntrackedRepoFiles();
  } catch {
    state.untrackedRepoFiles = ['<unable-to-enumerate-untracked-files>'];
  }

  return state;
}

function inspectCat05SourceGitState(sourceGitSha) {
  const state = {
    changedRepoFilesSinceSource: [],
    commitExists: false,
    dirtyTrackedRepoFiles: [],
    isAncestorOfHead: false,
    privacySourceFiles: [],
    runnerMatchesSource: false,
    sourceGitSha,
    untrackedRepoFiles: [],
  };
  if (!/^[a-f0-9]{40}$/.test(sourceGitSha)) return state;

  try {
    commandRequired('git', ['cat-file', '-e', `${sourceGitSha}^{commit}`]);
    state.commitExists = true;
  } catch {
    return state;
  }

  try {
    commandRequired('git', ['merge-base', '--is-ancestor', sourceGitSha, 'HEAD']);
    state.isAncestorOfHead = true;
  } catch {
    state.isAncestorOfHead = false;
  }

  try {
    state.privacySourceFiles = CAT05_NATIVE_OCR_PRIVACY_FILES.map((repoPath) => {
      const committedBytes = execFileSync('git', ['show', `${sourceGitSha}:${repoPath}`], {
        cwd: root,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      const currentBytes = readFileSync(abs(repoPath));
      return {
        bytes: committedBytes.length,
        currentBytes: currentBytes.length,
        currentSha256: cat05Sha256(currentBytes),
        path: repoPath,
        sha256: cat05Sha256(committedBytes),
      };
    });
  } catch {
    state.privacySourceFiles = [];
  }

  const runnerPath = 'scripts/e2e/cat05-native-ocr-ui-audit.mjs';
  try {
    commandRequired('git', ['cat-file', '-e', `${sourceGitSha}:${runnerPath}`]);
    execFileSync('git', ['diff', '--quiet', sourceGitSha, '--', runnerPath], {
      cwd: root,
      stdio: 'ignore',
    });
    state.runnerMatchesSource = true;
  } catch {
    state.runnerMatchesSource = false;
  }

  try {
    state.changedRepoFilesSinceSource = commandLines('git', [
      'diff',
      '--name-only',
      `${sourceGitSha}..HEAD`,
    ]);
  } catch {
    state.changedRepoFilesSinceSource = ['<unable-to-compare-source-sha>'];
  }

  try {
    state.dirtyTrackedRepoFiles = [
      ...commandLines('git', ['diff', '--name-only']),
      ...commandLines('git', ['diff', '--cached', '--name-only']),
    ].filter((path, index, paths) => paths.indexOf(path) === index);
  } catch {
    state.dirtyTrackedRepoFiles = ['<unable-to-enumerate-dirty-files>'];
  }

  try {
    state.untrackedRepoFiles = listGitUntrackedRepoFiles();
  } catch {
    state.untrackedRepoFiles = ['<unable-to-enumerate-untracked-files>'];
  }

  return state;
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

function listGitUntrackedRepoFiles() {
  return execFileSync('git', ['ls-files', '--others', '--exclude-standard', '-z'], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
    .split('\0')
    .filter(Boolean)
    .map(normalizeRepoPath);
}

function gateEvidencePath(gate) {
  return `${gate.folder}/${gate.evidence}`;
}

function textPressureRetainedNarrowGate(date) {
  return {
    id: 'support-floor-360-640-200-text-pressure',
    title: '360 x 640 retained narrow-phone 200% text-pressure route sweep',
    kind: 'summary-status',
    required: false,
    supportClass: 'resilience',
    folder: `test-results/human-e2e/${date}/text-pressure-200-supported-360-640-postfix`,
    evidence: 'summary.json',
    expected:
      '49 Expo web direct-entry routes have zero retained narrow-phone text-pressure geometry/log failures.',
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
  return textPressureRetainedNarrowGate(date);
}

function requiredGateEvidenceFiles(date) {
  return [
    `test-results/human-e2e/${date}/text-pressure-200-iphone-375-667-full-postfix3-clear/summary.json`,
    `test-results/human-e2e/${date}/text-pressure-200-iphone-375-812-postfix/summary.json`,
    `test-results/human-e2e/${date}/text-pressure-200-modern-390-postfix-7/summary.json`,
    `test-results/human-e2e/${date}/text-pressure-200-boundary-414-896-postfix3/summary.json`,
    `test-results/human-e2e/${date}/text-pressure-200-modern-430-postfix-5/summary.json`,
    `test-results/human-e2e/${date}/text-pressure-200-skipped-routes-375-667-postfix3/summary.json`,
    `test-results/human-e2e/${date}/text-pressure-200-skipped-routes-390-844-postfix/summary.json`,
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
const requiredSurfaceHonestyEvidenceDate = latestEvidenceDateForFolder(
  'required-surface-honesty-rerun',
  'route-evidence.json',
);
if (!requiredSurfaceHonestyEvidenceDate) {
  console.error('FAIL Missing required-surface honesty route evidence.');
  process.exit(1);
}
const trendRouteGroupGateEvidenceDate = latestEvidenceDateForFolder(
  'trend-route-group-gate-current',
);
if (!trendRouteGroupGateEvidenceDate) {
  console.error('FAIL Missing Trend route-group privacy and recovery evidence.');
  process.exit(1);
}
const accountDeletionRecoveryEvidenceDate = latestEvidenceDateForFolder(
  'account-deletion-durable-recovery-current',
  'report.md',
);
if (!accountDeletionRecoveryEvidenceDate) {
  console.error('FAIL Missing durable account-deletion recovery evidence.');
  process.exit(1);
}
const healthConsentWithdrawalEvidenceDate = latestEvidenceDateForFolder(
  'health-consent-withdrawal-current',
);
if (!healthConsentWithdrawalEvidenceDate) {
  console.error('FAIL Missing health-consent withdrawal and reconsent evidence.');
  process.exit(1);
}
const cat04CatalogRecoveryEvidenceDate = latestEvidenceDateForFolder(
  'cat04-catalog-recovery-current',
);
if (!cat04CatalogRecoveryEvidenceDate) {
  console.error('FAIL Missing CAT04 catalog-recovery Expo-web evidence.');
  process.exit(1);
}
const cat05NativeOcrReviewEvidenceDate = CAT05_NATIVE_OCR_EVIDENCE_DATE;
if (
  !exists(
    `test-results/human-e2e/${cat05NativeOcrReviewEvidenceDate}/cat05-native-ocr-web-ui-current/summary.json`,
  )
) {
  console.error('FAIL Missing 2026-07-18 CAT05 native-OCR review Expo-web evidence.');
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
  requiredSurfaceHonestyEvidenceDate,
  trendRouteGroupGateEvidenceDate,
  accountDeletionRecoveryEvidenceDate,
  healthConsentWithdrawalEvidenceDate,
  cat04CatalogRecoveryEvidenceDate,
  cat05NativeOcrReviewEvidenceDate,
]
  .sort()
  .at(-1);

const gates = [
  supportFloorGateForDate(evidenceDate),
  {
    id: 'android-360-740-200-text-pressure',
    title: '360 x 740 retained Android-class 200% text-pressure route sweep',
    kind: 'summary-status',
    required: false,
    supportClass: 'resilience',
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
    title: '412 x 640 retained Android-class 200% text-pressure route sweep',
    kind: 'summary-status',
    required: false,
    supportClass: 'resilience',
    folder: `test-results/human-e2e/${evidenceDate}/text-pressure-200-android-412-640-current`,
    evidence: 'summary.json',
    expected:
      '49 Expo web direct-entry routes have zero wide support-floor 200% text-pressure failures.',
  },
  {
    id: 'android-412-200-text-pressure',
    title: '412 x 915 retained Android-class 200% text-pressure route sweep',
    kind: 'summary-status',
    required: false,
    supportClass: 'resilience',
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
    title: '430 x 640 retained Android-class 200% text-pressure route sweep',
    kind: 'summary-status',
    required: false,
    supportClass: 'resilience',
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
    required: false,
    supportClass: 'resilience',
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
    required: false,
    supportClass: 'resilience',
    folder: `test-results/human-e2e/${evidenceDate}/text-pressure-200-skipped-routes-412-640-postfix`,
    evidence: 'summary.json',
    expected:
      '21 onboarding, paywall, recovery, conflict, share, shelf, and progress routes have zero wide support-floor failures.',
  },
  {
    id: 'skipped-routes-430-640-200-text-pressure',
    title: '430 x 640 skipped/direct-entry 200% text-pressure route sweep',
    kind: 'summary-status',
    required: false,
    supportClass: 'resilience',
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
    title: '360 x 640 resilience account-upgrade error and recovery pass',
    kind: 'summary-verdict',
    required: true,
    supportClass: 'resilience',
    folder: `test-results/human-e2e/${accountUpgradeEvidenceDate}/onboarding-account-upgrade-current`,
    evidence: 'summary.json',
    expected:
      'Invalid email code recovers, valid fixture code reaches paywall, and first-session activation completes.',
  },
  {
    id: 'account-isolation-supported-phone',
    title: '360 x 640 resilience account-transition isolation and cleanup recovery pass',
    kind: 'summary-verdict',
    required: true,
    supportClass: 'resilience',
    folder: `test-results/human-e2e/${accountIsolationEvidenceDate}/onboarding-account-isolation-current`,
    evidence: 'summary.json',
    expected:
      'Cleanup failure stays gated, retry succeeds, and signed-out Shelf/Today expose no account A data.',
  },
  {
    id: 'account-deletion-durable-recovery-expo-web-stress',
    title: 'Account-deletion recovery Expo-web compatibility pass',
    kind: 'report-contract',
    required: true,
    supportClass: 'resilience',
    folder: `test-results/human-e2e/${accountDeletionRecoveryEvidenceDate}/account-deletion-durable-recovery-current`,
    evidence: 'report.md',
    requiredFiles: [
      '01-pending-1279x720.jpg',
      '02-apple-manual-1279x720.jpg',
      '03-signed-out-landing-1279x720.jpg',
      '04-invalid-receipt-1279x720.jpg',
      '05-expired-receipt-1279x720.jpg',
      '06-ownerless-support-only-1279x720.jpg',
      'observations.json',
    ],
    requiredJpegDimensions: {
      '01-pending-1279x720.jpg': { width: 1279, height: 720 },
      '02-apple-manual-1279x720.jpg': { width: 1279, height: 720 },
      '03-signed-out-landing-1279x720.jpg': { width: 1279, height: 720 },
      '04-invalid-receipt-1279x720.jpg': { width: 1279, height: 720 },
      '05-expired-receipt-1279x720.jpg': { width: 1279, height: 720 },
      '06-ownerless-support-only-1279x720.jpg': { width: 1279, height: 720 },
    },
    observations: 'observations.json',
    requiredReportText: [
      `Run window: ${accountDeletionRecoveryEvidenceDate} to 2026-07-14 (America/Toronto)`,
      'App surface: actual Expo web app with credential-free development fixtures; native iPhone evidence remains required',
      'Browser/device: Codex in-app Chromium browser on Windows; saved JPEG capture surface 1279 x 720',
      'Overall verdict: Expo-web compatibility pass with the source-level publication-fence gap and native/hosted/provider gates still explicitly blocking launch',
      'No live Supabase URL, user session, provider credential, status capability, or destructive operation was used.',
      '`01-pending-1279x720.jpg`',
      '`02-apple-manual-1279x720.jpg`',
      '`03-signed-out-landing-1279x720.jpg`',
      '`04-invalid-receipt-1279x720.jpg`',
      '`05-expired-receipt-1279x720.jpg`',
      '`06-ownerless-support-only-1279x720.jpg`',
      '`observations.json`',
      'Browser error count was zero.',
      'This run does not claim a compact-phone viewport pass.',
      'Repeat the recovery branches on a supported physical iPhone',
      'This credential-free Expo-web pass is not evidence of hosted-provider completion, legal approval, Apple approval, or revenue readiness.',
    ],
    expected:
      'Credential-free Expo web fixtures cover pending, manual-Apple, signed-out continuation, retryable invalid, expired, and ownerless support-only recovery; compact-phone, native-iPhone, hosted Supabase, and live-provider proof remain launch gates.',
  },
  {
    id: 'health-consent-withdrawal-expo-web-compatibility',
    title: 'Health-consent withdrawal and fresh-reconsent Expo-web compatibility pass',
    kind: 'summary-status',
    required: true,
    supportClass: 'resilience',
    folder: `test-results/human-e2e/${healthConsentWithdrawalEvidenceDate}/health-consent-withdrawal-current`,
    evidence: 'summary.json',
    requiredFiles: [
      'report.md',
      'results.json',
      '13-goals-stable-postfix-390x844.png',
      '15-privacy-active-postfix-390x844.png',
      '16-withdrawal-confirm-postfix-390x844.png',
      '17-withdrawn-paused-postfix-390x844.png',
      '18-withdrawn-reload-postfix-390x844.png',
      '19-fresh-consent-postfix-390x844.png',
      '20-reconsent-goals-stable-postfix-390x844.png',
      '21-consent-360x640-postfix.png',
      '22-reconsent-goals-reload-postfix-390x844.png',
      '23-fresh-grant-goals-final-390x844.png',
      '24-fresh-grant-goals-reload-final-390x844.png',
    ],
    validateSummaryArtifacts: true,
    requiredSchemaVersion: 1,
    requiredStatus: 'pass',
    requiredFailedRouteCount: 0,
    requiredViewports: ['390 x 844', '360 x 640'],
    requiredVerified: [
      'current consent before goals',
      'direct goals entry recovers to consent',
      'fresh grant stays on /onboarding/goals through 6.5 seconds and reload',
      'confirm reaches the paused shell',
      'paused state survives reload',
      'fresh-consent refusal remains paused',
      'fresh reconsent stays on /onboarding/goals through 6.5 seconds and reload',
      'compact 360 x 640 consent controls',
    ],
    expected:
      'Credential-free Expo web proves consent-before-goals, decline/direct-route denial, non-destructive withdrawal, durable paused state, and stable fresh reconsent; hosted, native-iPhone, accessibility, and legal-review gates remain open.',
  },
  {
    id: 'cat04-catalog-recovery-supported-phone',
    title: 'CAT04 catalog search, scan, report, and recovery Expo-web pass',
    kind: 'cat04-catalog-recovery',
    required: true,
    supportClass: 'supported-phone',
    folder: `test-results/human-e2e/${cat04CatalogRecoveryEvidenceDate}/cat04-catalog-recovery-current`,
    evidence: 'summary.json',
    requiredFiles: ['report.md'],
    expected:
      'Fifteen deterministic catalog search, barcode, permission, reporting, manual-entry, offline, and recovery scenarios plus six consent bootstraps pass exactly once at 375 x 667, 390 x 844, and 430 x 932 with tracked result and screenshot provenance; native camera, physical-iPhone, restart-to-ready, staging, accessibility, legal, and App Store gates remain separate.',
  },
  {
    id: 'cat05-native-ocr-review-supported-phone',
    title: 'CAT05 native OCR review Expo-web pass',
    kind: 'cat05-native-ocr-review',
    required: true,
    supportClass: 'supported-phone',
    folder: `test-results/human-e2e/${cat05NativeOcrReviewEvidenceDate}/cat05-native-ocr-web-ui-current`,
    evidence: 'summary.json',
    requiredFiles: ['report.md', 'scope.json'],
    expected:
      'This dated, source-bound checkpoint records five deterministic OCR review and manual-recovery scenarios exactly once at 375 x 667, 390 x 844, and 430 x 932, with four clean consent bootstraps and exact source/build/artifact provenance; later runtime changes require new evidence, and Apple Vision, camera, native privacy, physical-iPhone, accessibility, legal, and App Store gates remain separate.',
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
    id: 'required-surface-honesty-supported-phone',
    title: 'Required-surface honest direct-entry and recovery pass',
    kind: 'required-surface-honesty',
    required: true,
    supportClass: 'supported-phone',
    folder: `test-results/human-e2e/${requiredSurfaceHonestyEvidenceDate}/required-surface-honesty-rerun`,
    evidence: 'route-evidence.json',
    requiredFiles: [
      'browser-warn-error-logs.json',
      'widgets-route.png',
      'trend-optin-route.png',
      'trend-fairness-route.png',
      'community-ask-route.png',
      'community-people-like-you-route.png',
    ],
    expected:
      'Widgets, Trend opt-in/fairness, and Community ask/aggregate direct entries remain exact, expose no fake controls or data, state their unavailable-beta posture, and provide working recovery actions at the compact iPhone viewport.',
  },
  {
    id: 'trend-route-group-gate-supported-phone',
    title: 'Trend navigator privacy and exact-route recovery',
    kind: 'summary-status',
    required: true,
    supportClass: 'supported-phone',
    folder: `test-results/human-e2e/${trendRouteGroupGateEvidenceDate}/trend-route-group-gate-current`,
    evidence: 'summary.json',
    requiredFiles: [
      'summary.json',
      'report.md',
      'pre-fix-route-evidence.json',
      'pre-fix-optin-canonicalized-to-fairness.png',
      'post-fix-route-evidence.json',
      'post-fix-trend-optin.png',
      'post-fix-trend-fairness.png',
    ],
    validateSummaryArtifacts: true,
    requiredSchemaVersion: 1,
    requiredStatus: 'pass',
    requiredFailedRouteCount: 0,
    requiredViewports: ['375 x 667'],
    requiredVerified: [
      'exact /trend/optin direct-entry and refresh identity',
      'exact /trend/fairness direct-entry and refresh identity',
      'disabled child scene withheld',
      'Monk-band hook withheld',
      'Back to Progress recovery',
      'zero unexpected browser warn or error logs',
    ],
    expected:
      'The hard-disabled Trend navigator preserves both direct URLs through refresh, withholds child data access, exposes no consent control, and returns safely to Progress at the compact iPhone viewport.',
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
  'This manifest verifies committed local Expo web evidence only; it does not replace physical-iPhone and iOS build QA.',
  'Supported-phone 200% text-pressure gates listed in this manifest are launch-required local Expo web evidence. Android-class, 360-wide, and sub-667-height folder names are retained resilience baselines, not Android release evidence; 320-wide browser sizes also remain resilience stress evidence unless tied to a supported physical iPhone.',
  'Native keyboard events, Dynamic Type, VoiceOver, camera hardware, notification delivery, StoreKit, RevenueCat, and live Supabase remain separate iOS release gates.',
  'The account-deletion recovery gate uses credential-free Expo web development fixtures on a desktop capture surface; it does not prove compact-phone layout, Keychain persistence, native lifecycle behavior, hosted Supabase, live-provider deletion, physical-iPhone accessibility, or App Store acceptance.',
  'The health-consent withdrawal gate uses credential-free Expo web and placeholder Supabase configuration; it does not prove hosted cleanup, Storage deletion, worker scheduling, physical-iPhone lifecycle or accessibility behavior, professional legal approval, or App Store acceptance.',
  'The CAT04 catalog-recovery gate uses deterministic Expo web fixtures; it does not prove native camera hardware or permission sheets, a restart-to-ready offline worker cycle, hosted catalog/reporting behavior, physical-iPhone accessibility, professional legal approval, or App Store acceptance.',
  'The CAT05 native-OCR review gate is a dated, source-bound checkpoint using deterministic Expo web fixtures and source assertions; it must be regenerated after later runtime changes and does not execute Apple Vision, a camera, an iOS binary, native cleanup/privacy behavior, physical-iPhone accessibility, professional legal approval, or App Store acceptance.',
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
      requirementFailures.push(
        ...collectEvidenceProvenanceFailures({
          folder: gate.folder,
          evidence: gate.evidence,
          requiredFiles: gate.requiredFiles,
          trackedRepoFiles,
        }),
      );
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
        requirementFailures.push(
          ...collectEvidenceProvenanceFailures({
            folder: gate.folder,
            evidence: gate.evidence,
            requiredFiles: gate.requiredFiles,
            summaryArtifacts: summary?.artifacts,
            trackedRepoFiles,
            validateRequiredFiles: false,
            validateSummaryArtifacts: gate.validateSummaryArtifacts === true,
          }),
        );
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
      } else if (gate.kind === 'cat04-catalog-recovery') {
        const summary = readJson(evidencePath);
        requirementFailures.push(
          ...collectCat04CatalogRecoveryFailures({
            folder: gate.folder,
            summary,
            sourceGitState: inspectCat04SourceGitState(String(summary?.sourceGitSha ?? '')),
            trackedRepoFiles,
          }),
        );
        failureCount = requirementFailures.length;
        verdict = failureCount === 0 ? 'pass' : 'fail';
        status = verdict;
        detail =
          failureCount === 0
            ? '45 scenario executions and 18 explicit-consent bootstraps passed exactly once across the three supported Expo-web phone viewports with clean browser logs and tracked result, report, snapshot, and screenshot provenance.'
            : `${failureCount} CAT04 evidence-contract failure${failureCount === 1 ? '' : 's'}: ${requirementFailures.join('; ')}.`;
      } else if (gate.kind === 'cat05-native-ocr-review') {
        const summary = readJson(evidencePath);
        requirementFailures.push(
          ...collectCat05NativeOcrReviewFailures({
            folder: gate.folder,
            summary,
            sourceGitState: inspectCat05SourceGitState(String(summary?.sourceGitSha ?? '')),
            trackedRepoFiles,
          }),
        );
        failureCount = requirementFailures.length;
        verdict = failureCount === 0 ? 'pass' : 'fail';
        status = verdict;
        detail =
          failureCount === 0
            ? 'This dated source-bound checkpoint has 15 scenario executions and 4 consent bootstraps exactly once across the three supported Expo-web phone viewports with zero browser failures and exact tracked source/build/result/report/scope/snapshot/screenshot byte provenance; nativeDeviceProof remains false and later runtime changes require a new run.'
            : `${failureCount} CAT05 evidence-contract failure${failureCount === 1 ? '' : 's'}: ${requirementFailures.join('; ')}.`;
      } else if (gate.kind === 'report-contract') {
        const report = readFileSync(abs(evidencePath), 'utf8');
        requirementFailures.push(
          ...collectRequiredTextFailures({
            label: gate.evidence,
            text: report,
            requiredText: gate.requiredReportText,
          }),
        );
        for (const [file, expectedDimensions] of Object.entries(
          gate.requiredJpegDimensions ?? {},
        )) {
          try {
            const actualDimensions = readJpegDimensions(`${gate.folder}/${file}`);
            if (
              actualDimensions.width !== expectedDimensions.width ||
              actualDimensions.height !== expectedDimensions.height
            ) {
              requirementFailures.push(
                `${file} dimensions must be ${expectedDimensions.width} x ${expectedDimensions.height}, received ${actualDimensions.width} x ${actualDimensions.height}`,
              );
            }
          } catch (error) {
            requirementFailures.push(
              `${file} is not a readable reviewed JPEG: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }
        if (typeof gate.observations === 'string') {
          try {
            requirementFailures.push(
              ...collectAccountDeletionRecoveryObservationFailures(
                readJson(`${gate.folder}/${gate.observations}`),
              ),
            );
          } catch {
            requirementFailures.push(`${gate.observations} is not valid JSON`);
          }
        }
        failureCount = requirementFailures.length;
        verdict = failureCount === 0 ? 'pass' : 'fail';
        status = verdict;
        detail =
          failureCount === 0
            ? '6 credential-free Expo web recovery states passed on the recorded desktop capture surface; compact-phone, native-iPhone, hosted-service, and provider proof remain open.'
            : `${failureCount} report-contract failure${failureCount === 1 ? '' : 's'}: ${requirementFailures.join('; ')}.`;
      } else if (gate.kind === 'required-surface-honesty') {
        const summary = readJson(evidencePath);
        const expectedRoutes = {
          widget: {
            path: '/routine/widgets',
            copy: [
              'Widgets are not in this beta',
              'No native home-screen widget or live activity target ships in this release.',
              'This route does not offer a preview, OS control, or paid widget upgrade.',
            ],
          },
          trendOptIn: {
            path: '/trend/optin',
            inputs: 0,
            copy: [
              'Photo trend insights are not in this beta',
              'No validated trend engine ships in this release.',
              'No Trend consent is requested.',
            ],
          },
          trendFairness: {
            path: '/trend/fairness',
            inputs: 0,
            copy: [
              'Photo trend insights are not in this beta',
              'No validated trend engine ships in this release.',
              'No Trend consent is requested.',
            ],
          },
          communityAsk: {
            path: '/community/ask',
            inputs: 0,
            copy: [
              'Community posting is not in this beta',
              'no question-submission service or reviewed peer-aggregate dataset.',
              'No consent or question is collected',
            ],
          },
          communityAggregates: {
            path: '/community/people-like-you',
            copy: [
              'Community posting is not in this beta',
              'no question-submission service or reviewed peer-aggregate dataset.',
              'No consent or question is collected',
            ],
          },
        };
        const pathFromUrl = (value) => {
          try {
            return new URL(String(value)).pathname;
          } catch {
            return null;
          }
        };

        if (summary.evidenceDate !== requiredSurfaceHonestyEvidenceDate) {
          requirementFailures.push(
            `evidenceDate must be ${requiredSurfaceHonestyEvidenceDate}, received ${String(summary.evidenceDate ?? 'missing')}`,
          );
        }
        if (
          summary?.viewportRequested?.width !== 375 ||
          summary?.viewportRequested?.height !== 667
        ) {
          requirementFailures.push('requested viewport must be 375 x 667');
        }

        for (const [routeId, expectation] of Object.entries(expectedRoutes)) {
          const route = summary?.routes?.[routeId];
          const geometry = route?.geometry;
          if (!route || !geometry) {
            requirementFailures.push(`${routeId} route evidence is missing`);
            continue;
          }
          if (pathFromUrl(route.url) !== expectation.path) {
            requirementFailures.push(`${routeId} URL must remain ${expectation.path}`);
          }
          if (pathFromUrl(geometry.href) !== expectation.path) {
            requirementFailures.push(`${routeId} geometry href must remain ${expectation.path}`);
          }
          if (typeof expectation.inputs === 'number' && geometry.inputs !== expectation.inputs) {
            requirementFailures.push(`${routeId} must expose ${expectation.inputs} inputs`);
          }
          const viewportWidth = Number(
            geometry?.viewport?.width ?? summary?.viewportObserved?.width,
          );
          if (!Number.isFinite(viewportWidth) || geometry.scrollWidth > viewportWidth) {
            requirementFailures.push(`${routeId} has horizontal overflow`);
          }
          const controls = Array.isArray(geometry.controls) ? geometry.controls : [];
          if (
            controls.length === 0 ||
            controls.some((control) => !Number.isFinite(control?.height) || control.height < 44)
          ) {
            requirementFailures.push(`${routeId} recovery controls must be at least 44 px tall`);
          }
          for (const needle of expectation.copy) {
            if (!String(geometry.text ?? '').includes(needle)) {
              requirementFailures.push(`${routeId} is missing honest copy: ${needle}`);
            }
          }
        }

        const recoveryExpectations = {
          trendBackToProgress: '/progress',
          communityBackToSkinNotes: '/community',
          widgetsBackToToday: '/paywall/reoffer',
        };
        for (const [recoveryId, expectedPath] of Object.entries(recoveryExpectations)) {
          const recovery = summary?.recoveryActions?.[recoveryId];
          if (recovery?.controlCount !== 1 || pathFromUrl(recovery?.resultUrl) !== expectedPath) {
            requirementFailures.push(
              `${recoveryId} must use one control and recover to ${expectedPath}`,
            );
          }
        }

        const browserLogPath = `${gate.folder}/browser-warn-error-logs.json`;
        if (exists(browserLogPath)) {
          const browserLogs = readJson(browserLogPath);
          if (!Array.isArray(browserLogs)) {
            requirementFailures.push('browser warn/error log evidence must be an array');
          } else if (browserLogs.some((entry) => String(entry?.level).toLowerCase() === 'error')) {
            requirementFailures.push('browser evidence contains error-level logs');
          }
        }

        failureCount = requirementFailures.length;
        verdict = failureCount === 0 ? 'pass' : 'fail';
        status = verdict;
        detail =
          failureCount === 0
            ? '5 exact direct-entry routes and 3 recovery actions passed without fake inputs, overflow, undersized controls, or browser errors.'
            : `${failureCount} required-surface evidence failure${failureCount === 1 ? '' : 's'}: ${requirementFailures.join('; ')}.`;
      }
      if (
        requirementFailures.length > 0 &&
        gate.kind !== 'summary-status' &&
        gate.kind !== 'cat04-catalog-recovery' &&
        gate.kind !== 'cat05-native-ocr-review' &&
        gate.kind !== 'report-contract' &&
        gate.kind !== 'required-surface-honesty'
      ) {
        status = 'fail';
        detail = `${detail} ${requirementFailures.join('; ')}.`;
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
    gate.requiredVerified ||
    gate.requiredReportText ||
    gate.kind === 'cat04-catalog-recovery' ||
    gate.kind === 'cat05-native-ocr-review'
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

  let untrackedSourceFiles;
  try {
    untrackedSourceFiles = collectDisallowedUntrackedRepoFiles(listGitUntrackedRepoFiles(), {
      allowedExactPaths: allowedGeneratedPaths,
    });
  } catch (error) {
    console.error(
      `FAIL Could not enumerate nonignored untracked source files: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    process.exit(1);
  }
  if (untrackedSourceFiles.length > 0) {
    console.error(
      `FAIL nonignored untracked source files are outside the declared generated/evidence/runtime outputs: ${untrackedSourceFiles.join(', ')}.`,
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
