import { execFileSync, spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

import {
  classifyBrowserFailures,
  interactionTreeText,
  isExcludedFromInteractionTree,
  measureControlGeometry,
  readSourceGitSha,
  safeArtifactId,
} from './cat04-catalog-recovery-audit.mjs';

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const isWindows = process.platform === 'win32';

export const CAT05_EVIDENCE_RELATIVE_DIR =
  'test-results/human-e2e/2026-07-22/cat05-native-ocr-web-ui-current';
const CAT05_EVIDENCE_DIRECTORY = path.resolve(repoRoot, CAT05_EVIDENCE_RELATIVE_DIR);
export const CAT05_EVIDENCE_SCHEMA_VERSION = 2;

const CAT05_GIT_SHA = /^[0-9a-f]{40}$/;
const CAT05_ACTIVE_CHILDREN = new Set();
const CAT05_MAX_EXPO_LOG_BYTES = 256 * 1024;
const CAT05_MAX_RAW_EXPO_LOG_BYTES = 512 * 1024;
const CAT05_MAX_CDP_EVENT_COUNT = 20_000;
const CAT05_MAX_CDP_EVENT_BYTES = 16 * 1024 * 1024;
const CAT05_MAX_CDP_MESSAGE_BYTES = 8 * 1024 * 1024;
const CAT05_MAX_RETAINED_BROWSER_EVENTS = 5_000;
const CAT05_MAX_BROWSER_EVENT_EVIDENCE_BYTES = 4 * 1024 * 1024;
const CAT05_MAX_DIAGNOSTIC_ARTIFACT_BYTES = 8 * 1024 * 1024;
const CAT05_MAX_DIAGNOSTIC_STRING_BYTES = 128 * 1024;
export const CAT05_BROWSER_DEBUG_READY_TIMEOUT_MS = 120_000;
const CAT05_LOG_TRUNCATION_MARKER = '\n[CAT05 log truncated after sanitization]\n';
const CAT05_RAW_LOG_TRUNCATION_MARKER =
  '\n[CAT05 raw Expo log collection truncated before sanitization]\n';

const CAT05_PRIVACY_SOURCE_PATHS = Object.freeze({
  labelOcrRoute: 'apps/mobile/src/app/shelf/ocr.tsx',
  progressCaptureRoute: 'apps/mobile/src/app/progress/capture.tsx',
  progressPrivacyHelper: 'apps/mobile/src/features/photos/progressCapturePrivacy.ts',
  progressReviewRoute: 'apps/mobile/src/app/progress/review.tsx',
});

export const CAT05_REQUIRED_VIEWPORTS = Object.freeze([
  Object.freeze({ id: 'iphone-375x667', width: 375, height: 667 }),
  Object.freeze({ id: 'iphone-390x844', width: 390, height: 844 }),
  Object.freeze({ id: 'iphone-430x932', width: 430, height: 932 }),
]);

export const CAT05_FIXTURE_TRANSCRIPT = 'Aqua, Glycerin, Niacinamide, 水, Ниацинамид';
export const CAT05_MANUAL_UNICODE_TEXT = 'Aqua, 水, Glycérine, Пользователь';
export const CAT05_EDIT_FENCE_TEXT = 'Aqua, 水, user-kept edit 🧴';

export const CAT05_AUDIT_LIMITATIONS = Object.freeze([
  'This is deterministic Expo-web UI-state evidence produced by a development-only fixture.',
  'It does not execute Apple Vision, the Swift bridge, a camera, a real label image, or an iOS binary.',
  'Its raw-photo cache and cleanup checks are source assertions only; they do not prove runtime deletion, cache behavior, or privacy on a native device.',
  'It is not physical-iPhone, iOS Simulator, native accessibility, OCR accuracy, OCR latency, runtime cleanup, native privacy, zero-network, archive, App Review, or release evidence.',
  'Its local-only browser-request assertion covers this synthetic web run only and must not be used as a native photo or transcript privacy claim.',
]);

export const CAT05_FIXTURE_GROUPS = Object.freeze([
  Object.freeze({
    id: 'recognized',
    env: Object.freeze({ EXPO_PUBLIC_E2E_SHELF_OCR_RESULT: 'recognized' }),
  }),
  Object.freeze({
    id: 'no-text',
    env: Object.freeze({ EXPO_PUBLIC_E2E_SHELF_OCR_RESULT: 'no_text' }),
  }),
  Object.freeze({
    id: 'timed-out',
    env: Object.freeze({ EXPO_PUBLIC_E2E_SHELF_OCR_RESULT: 'timed_out' }),
  }),
  Object.freeze({
    id: 'failed',
    env: Object.freeze({ EXPO_PUBLIC_E2E_SHELF_OCR_RESULT: 'failed' }),
  }),
]);

export const CAT05_SCENARIO_MATRIX = Object.freeze([
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
  Object.freeze({ fixture: 'no_text', groupId: 'no-text', id: 'no-text-manual-recovery' }),
  Object.freeze({
    fixture: 'timed_out',
    groupId: 'timed-out',
    id: 'timeout-manual-recovery',
  }),
  Object.freeze({ fixture: 'failed', groupId: 'failed', id: 'failure-manual-recovery' }),
]);

const CAT05_DECLARED_OUTPUT_PATTERNS = Object.freeze([
  /^\.tmp(?:\/|$)/,
  new RegExp(`^${CAT05_EVIDENCE_RELATIVE_DIR.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:/|$)`),
]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function comparePaths(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function windowsPathVariants(value) {
  const normalized = String(value)
    .replace(/^[/\\]{2}\?[/\\]/u, '')
    .replace(/\\/gu, '/')
    .replace(/\/+$/u, '');
  const driveMatch = /^([a-z]):\/(.*)$/iu.exec(normalized);
  const variants = new Set([normalized, normalized.replaceAll('/', '\\')]);
  if (driveMatch) {
    const [, drive, remainder] = driveMatch;
    variants.add(`/${drive.toLowerCase()}/${remainder}`);
    variants.add(`/${drive.toUpperCase()}/${remainder}`);
    variants.add(`\\\\?\\${drive}:\\${remainder.replaceAll('/', '\\')}`);
    variants.add(`//?/${drive}:/${remainder}`);
  }
  return [...variants].filter(Boolean).sort((left, right) => right.length - left.length);
}

function replacePathLiteral(value, search, replacement) {
  if (!search) return value;
  const candidate = String(search).replace(/[\\/]+$/u, '');
  if (!candidate) return value;
  const windowsLike = /^(?:[a-z]:[\\/]|[/\\]{2})/iu.test(candidate);
  const variants = windowsLike
    ? windowsPathVariants(candidate)
    : [candidate, candidate.replaceAll('\\', '/')];
  let replaced = value;
  for (const variant of variants) {
    replaced = replaced.replace(
      new RegExp(escapeRegExp(variant), windowsLike ? 'giu' : 'gu'),
      replacement,
    );
  }
  return replaced;
}

function isCat05LoopbackHostname(hostname) {
  return ['localhost', '127.0.0.1', '[::1]'].includes(String(hostname).toLowerCase());
}

function sanitizeCat05LocalUrl(candidate) {
  const authority = candidate.port ? `${candidate.hostname}:${candidate.port}` : candidate.hostname;
  const query = candidate.search ? '?redacted-query' : '';
  return `${candidate.protocol}//${authority}${candidate.pathname}${query}`;
}

export function sanitizeCat05EvidenceUrl(value) {
  if (typeof value !== 'string' || value.length === 0) return value;
  let candidate;
  try {
    candidate = new URL(value);
  } catch {
    return '<redacted-malformed-url>';
  }
  if (['http:', 'https:', 'ws:', 'wss:'].includes(candidate.protocol)) {
    return isCat05LoopbackHostname(candidate.hostname)
      ? sanitizeCat05LocalUrl(candidate)
      : '<external-network-url>';
  }
  if (
    ['assets-library:', 'blob:', 'content:', 'data:', 'file:', 'filesystem:', 'ph:'].includes(
      candidate.protocol,
    )
  ) {
    return `<redacted-${candidate.protocol.slice(0, -1)}-uri>`;
  }
  return '<redacted-non-network-uri>';
}

function truncateCat05Utf8(value, maxBytes) {
  assert(
    Number.isSafeInteger(maxBytes) && maxBytes >= 0,
    'CAT05 diagnostic maxBytes must be a non-negative safe integer.',
  );
  const encoded = Buffer.from(value, 'utf8');
  if (encoded.length <= maxBytes) return value;
  const markerBytes = Buffer.byteLength(CAT05_LOG_TRUNCATION_MARKER);
  if (maxBytes <= markerBytes) {
    return Buffer.from(CAT05_LOG_TRUNCATION_MARKER, 'utf8')
      .subarray(0, maxBytes)
      .toString('utf8')
      .replace(/\uFFFD$/u, '');
  }
  const prefixBytes = Math.max(0, maxBytes - markerBytes);
  let prefix = encoded.subarray(0, prefixBytes).toString('utf8');
  if (prefix.endsWith('\uFFFD')) prefix = prefix.slice(0, -1);
  return `${prefix}${CAT05_LOG_TRUNCATION_MARKER}`;
}

export function sanitizeCat05DiagnosticText(
  value,
  {
    homePaths = [process.env.USERPROFILE, process.env.HOME],
    maxBytes = CAT05_MAX_EXPO_LOG_BYTES,
    repoRootPath = repoRoot,
    temporaryDirectory = tmpdir(),
  } = {},
) {
  let sanitized = String(value ?? '')
    .replace(/\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)/gu, '')
    .replace(/\u001b[P^_][\s\S]*?\u001b\\/gu, '')
    .replace(/\u001b\[[0-?]*[ -/]*[@-~]/gu, '')
    .replace(/\r\n?/gu, '\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/gu, '');
  const pathReplacements = [
    [repoRootPath, '<repo-root>'],
    ...homePaths.map((homePath) => [homePath, '<user-home>']),
    [temporaryDirectory, '<temp-directory>'],
  ]
    .filter(([candidate]) => typeof candidate === 'string' && candidate.length > 0)
    .sort(([left], [right]) => right.length - left.length);
  for (const [candidate, replacement] of pathReplacements) {
    sanitized = replacePathLiteral(sanitized, candidate, replacement);
  }
  sanitized = sanitized.replace(
    /(?<![a-z0-9])(?:[a-z]:[\\/](?:[^\\/\s"'<>|:*?\r\n]+[\\/])*[^\\/\s"'<>|:*?\r\n]*|\\\\[^\\/\s"'<>|:*?\r\n]+[\\/][^"'<>|:*?\r\n\s]+)(?![a-z0-9])/giu,
    '<redacted-absolute-path>',
  );
  sanitized = sanitized.replace(/(?:https?|wss?):\/\/[^\s<>"')\]}]+/giu, (candidate) =>
    sanitizeCat05EvidenceUrl(candidate),
  );
  sanitized = sanitized.replace(
    /\b(?:assets-library|blob|content|data|file|filesystem|ph):[^\s<>"')\]}]*/giu,
    (candidate) => sanitizeCat05EvidenceUrl(candidate),
  );
  sanitized = sanitized.replace(
    /\b(?:authorization\s*[:=]\s*)?bearer\s+[a-z0-9._~+/=-]{8,}/giu,
    '<redacted-bearer-token>',
  );
  sanitized = sanitized.replace(
    /(\bauthorization\b["']?\s*[:=]\s*)(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\r\n]+)/giu,
    '$1<redacted-credential>',
  );
  sanitized = sanitized.replace(
    /((?:^|[\s,{;])["']?(?:[a-z0-9][a-z0-9.-]*(?:_[a-z0-9.-]+)*_token|token|password|passcode|secret|(?:x[-_])?api[-_]?key|apikey)["']?\s*[:=]\s*)(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\r\n]+)/gimu,
    '$1<redacted-credential>',
  );
  sanitized = sanitized.replace(
    /([?&](?:access[_-]?token|api[_-]?key|apikey|auth|authorization|password|secret|token)=)[^&\s]+/giu,
    '$1<redacted>',
  );
  sanitized = sanitized.replace(
    /(?<![a-z0-9+/_-])[a-z0-9+/_-]{160,}={0,2}(?![a-z0-9+/_=-])/giu,
    '<redacted-long-base64>',
  );
  sanitized = sanitized.replace(/[\t ]+(?=\n|$)/gu, '');
  return truncateCat05Utf8(sanitized, maxBytes);
}

export function createCat05ExpoLogCapture(maxRawBytes = CAT05_MAX_RAW_EXPO_LOG_BYTES) {
  assert(
    Number.isSafeInteger(maxRawBytes) && maxRawBytes >= 0,
    'CAT05 Expo log maxRawBytes must be a non-negative safe integer.',
  );
  return { capturedBytes: 0, chunks: [], droppedBytes: 0, maxRawBytes, totalBytes: 0 };
}

export function appendCat05ExpoLogCapture(capture, chunk) {
  const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), 'utf8');
  capture.totalBytes += buffer.length;
  const remaining = Math.max(0, capture.maxRawBytes - capture.capturedBytes);
  if (remaining > 0) {
    const retained = buffer.subarray(0, remaining);
    capture.chunks.push(retained);
    capture.capturedBytes += retained.length;
  }
  capture.droppedBytes += Math.max(0, buffer.length - remaining);
  return capture;
}

export function sanitizeCat05ExpoFixtureLog(evidenceDir, groupId, capture = null) {
  const logPath = path.join(evidenceDir, `expo-${safeArtifactId(groupId)}.log`);
  assert(existsSync(logPath), `Missing CAT05 Expo log for fixture ${groupId}.`);
  let raw = capture
    ? Buffer.concat(capture.chunks, capture.capturedBytes).toString('utf8')
    : readFileSync(logPath, 'utf8');
  if (capture?.droppedBytes > 0) {
    const lastCompleteLine = raw.lastIndexOf('\n');
    raw = lastCompleteLine >= 0 ? raw.slice(0, lastCompleteLine + 1) : '';
  }
  const truncationNotice = capture?.droppedBytes > 0 ? CAT05_RAW_LOG_TRUNCATION_MARKER : '';
  const sanitized = sanitizeCat05DiagnosticText(`${raw}${truncationNotice}`);
  writeFileSync(logPath, sanitized);
  return sanitized;
}

export function sanitizeCat05DiagnosticValue(value, depth = 0) {
  if (typeof value === 'string') {
    return sanitizeCat05DiagnosticText(value, { maxBytes: 2_000 });
  }
  if (value === null || ['boolean', 'number'].includes(typeof value)) return value;
  if (depth >= 5) return '<diagnostic-depth-limit>';
  if (Array.isArray(value)) {
    const retained = value
      .slice(0, 50)
      .map((item) => sanitizeCat05DiagnosticValue(item, depth + 1));
    if (value.length > retained.length) {
      retained.push(`<diagnostic-array-truncated:${value.length - retained.length}>`);
    }
    return retained;
  }
  if (typeof value !== 'object') return String(value);
  const retainedEntries = Object.entries(value).filter(([key]) => {
    const exactSensitiveKey =
      /^(?:body|cookies?|data|headers?|postData|preview|requestHeaders|responseHeaders|value)$/iu.test(
        key,
      );
    const credentialKey = /(?:authorization|credential|passcode|password|secret|token)/iu.test(key);
    return !exactSensitiveKey && !credentialKey;
  });
  const sanitized = Object.fromEntries(
    retainedEntries
      .slice(0, 50)
      .map(([key, item]) => [
        sanitizeCat05DiagnosticText(key, { maxBytes: 128 }),
        sanitizeCat05DiagnosticValue(item, depth + 1),
      ]),
  );
  if (retainedEntries.length > 50) {
    sanitized.cat05TruncatedFieldCount = retainedEntries.length - 50;
  }
  return sanitized;
}

function sanitizeCat05DiagnosticError(error) {
  return sanitizeCat05DiagnosticText(error instanceof Error ? error.message : String(error), {
    maxBytes: 2_000,
  });
}

function sanitizeCat05BrowserFailures(failures) {
  assert(Array.isArray(failures), 'CAT05 browser failures must be an array.');
  assert(failures.length <= 100, 'CAT05 browser failure evidence exceeded 100 records.');
  return failures.map((failure) => sanitizeCat05DiagnosticValue(failure));
}

function normalizeRepoPath(value) {
  const normalized = path.posix.normalize(String(value).replace(/\\/g, '/').replace(/^\.\//, ''));
  return normalized === '.' ? '' : normalized;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function requiredEnvironmentValue(environment, name) {
  const raw = String(environment[name] ?? '');
  const value = raw.trim();
  assert(value.length > 0, `${name} is required for CAT05 evidence binding.`);
  assert(raw === value, `${name} must not contain leading or trailing whitespace.`);
  return value;
}

export function resolveCat05AuditBinding({
  actualSourceGitSha = readSourceGitSha(repoRoot),
  environment = process.env,
  runId = randomUUID(),
} = {}) {
  const expectedSourceGitSha = requiredEnvironmentValue(
    environment,
    'CAT05_EXPECTED_SOURCE_GIT_SHA',
  );
  const candidateBuildProfile = requiredEnvironmentValue(environment, 'PHASE5_IOS_BUILD_PROFILE');

  assert(
    CAT05_GIT_SHA.test(expectedSourceGitSha),
    'CAT05_EXPECTED_SOURCE_GIT_SHA must be the exact lowercase 40-character candidate commit.',
  );
  assert(
    CAT05_GIT_SHA.test(String(actualSourceGitSha ?? '')),
    'CAT05 could not resolve an exact lowercase 40-character source commit.',
  );
  assert(
    actualSourceGitSha === expectedSourceGitSha,
    `CAT05 source commit mismatch: expected ${expectedSourceGitSha}, checked out ${actualSourceGitSha}.`,
  );
  assert(
    candidateBuildProfile === 'staging',
    'PHASE5_IOS_BUILD_PROFILE must be staging for the CAT05 source candidate.',
  );
  assert(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(runId),
    'CAT05 runId must be a UUID v4.',
  );

  const fixtureConfiguration = CAT05_FIXTURE_GROUPS.map((group) => {
    const environmentEntries = Object.entries(cat05ServerEnvironment(group, {})).sort(
      ([left], [right]) => comparePaths(left, right),
    );
    return { environment: Object.fromEntries(environmentEntries), fixtureGroup: group.id };
  });
  const fixtureConfigurationSha256 = sha256(JSON.stringify(fixtureConfiguration));
  const scenarioMatrixSha256 = sha256(JSON.stringify(CAT05_SCENARIO_MATRIX));
  const viewportMatrixSha256 = sha256(JSON.stringify(CAT05_REQUIRED_VIEWPORTS));
  const webFixtureBuildId = sha256(
    JSON.stringify({
      evidenceSchemaVersion: CAT05_EVIDENCE_SCHEMA_VERSION,
      fixtureConfigurationSha256,
      scenarioMatrixSha256,
      sourceGitSha: actualSourceGitSha,
      viewportMatrixSha256,
    }),
  );

  return Object.freeze({
    candidateNativeBuild: Object.freeze({
      archiveSha256: null,
      easIosBuildId: null,
      executedByThisAudit: false,
      profile: candidateBuildProfile,
      proofStatus: 'not_applicable_to_expo_web_ui_audit',
    }),
    evidenceSchemaVersion: CAT05_EVIDENCE_SCHEMA_VERSION,
    expectedSourceGitSha,
    fixtureConfigurationSha256,
    runId,
    scenarioMatrixSha256,
    sourceGitSha: actualSourceGitSha,
    viewportMatrixSha256,
    webFixtureBuild: Object.freeze({
      buildId: webFixtureBuildId,
      profile: 'development-only-deterministic-expo-web',
    }),
  });
}

export function assertCat05SourceBinding({
  actualSourceGitSha = readSourceGitSha(repoRoot),
  dirtyPaths = listCat05DirtyRepoPaths(),
  expectedSourceGitSha,
} = {}) {
  assertCat05SourceProvenance({ dirtyPaths });
  assert(
    CAT05_GIT_SHA.test(String(expectedSourceGitSha ?? '')),
    'CAT05 source binding requires an exact expected source commit.',
  );
  assert(
    actualSourceGitSha === expectedSourceGitSha,
    `CAT05 source changed during evidence capture: expected ${expectedSourceGitSha}, observed ${actualSourceGitSha ?? 'unavailable'}.`,
  );
  return actualSourceGitSha;
}

export function assertCat05LocalTarget(value, { expectedPort, pathPrefix = '/' } = {}) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('CAT05 refuses a malformed browser target URL.');
  }
  assert(parsed.protocol === 'http:', 'CAT05 browser targets must use local HTTP.');
  assert(parsed.hostname === 'localhost', 'CAT05 browser targets must use localhost exactly.');
  assert(
    !parsed.username && !parsed.password,
    'CAT05 browser targets must not contain credentials.',
  );
  assert(/^\d+$/.test(parsed.port), 'CAT05 browser targets must include an explicit port.');
  if (expectedPort !== undefined) {
    assert(
      parsed.port === String(expectedPort),
      'CAT05 browser target port does not match the bound server.',
    );
  }
  assert(
    parsed.pathname.startsWith(pathPrefix),
    `CAT05 browser target must remain under ${pathPrefix}.`,
  );
  return parsed;
}

function assertCat05DebugTarget(value, expectedPort) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('CAT05 refuses a malformed CDP target URL.');
  }
  assert(parsed.protocol === 'ws:', 'CAT05 CDP targets must use local ws.');
  assert(
    parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost',
    'CAT05 CDP targets must remain on loopback.',
  );
  assert(!parsed.username && !parsed.password, 'CAT05 CDP targets must not contain credentials.');
  assert(parsed.port === String(expectedPort), 'CAT05 CDP target port does not match the browser.');
  return parsed;
}

function assertCat05LoopbackHttpTarget(value, expectedPort) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('CAT05 refuses a malformed loopback endpoint.');
  }
  assert(parsed.protocol === 'http:', 'CAT05 loopback endpoints must use HTTP.');
  assert(
    parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost',
    'CAT05 endpoints must remain on loopback.',
  );
  assert(!parsed.username && !parsed.password, 'CAT05 endpoints must not contain credentials.');
  assert(parsed.port === String(expectedPort), 'CAT05 endpoint port does not match its process.');
  return parsed;
}

function assertCat05PageTarget(value, baseUrl, pathPrefix = '/') {
  const base = assertCat05LocalTarget(baseUrl);
  const target = assertCat05LocalTarget(value, {
    expectedPort: Number(base.port),
    pathPrefix,
  });
  assert(target.origin === base.origin, 'CAT05 page escaped the bound local origin.');
  return target;
}

function readCat05PrivacySources(sourceByPath) {
  return Object.fromEntries(
    Object.values(CAT05_PRIVACY_SOURCE_PATHS).map((repoPath) => [
      repoPath,
      sourceByPath?.[repoPath] ?? readFileSync(path.join(repoRoot, repoPath), 'utf8'),
    ]),
  );
}

export function assertCat05PrivacySourceContract({ sourceByPath } = {}) {
  const sources = readCat05PrivacySources(sourceByPath);
  const checks = [
    {
      id: 'label-preview-hidden-during-cleanup-and-cache-disabled',
      path: CAT05_PRIVACY_SOURCE_PATHS.labelOcrRoute,
      pattern:
        /capturedUri\s*&&\s*!photoCleanupBusy\s*\?\s*\(\s*<Image[\s\S]{0,300}?cachePolicy="none"/u,
    },
    {
      id: 'label-route-removal-cancels-recognition-before-photo-cleanup',
      path: CAT05_PRIVACY_SOURCE_PATHS.labelOcrRoute,
      pattern:
        /const prepareProtectedRouteRemoval\s*=\s*async[\s\S]{0,2200}?await captureDrainRef\.current[\s\S]{0,500}?cancelAndDrainRecognition\('navigation'\)[\s\S]{0,500}?cleanupLabelPhoto\('cancel'\)[\s\S]{0,1600}?usePreventRemove\(shouldPreventRouteRemoval[\s\S]{0,250}?prepareProtectedRouteRemoval/u,
    },
    {
      id: 'progress-capture-accepts-only-trusted-camera-cache-uri',
      path: CAT05_PRIVACY_SOURCE_PATHS.progressCaptureRoute,
      pattern:
        /rawCaptureUri\s*=\s*trustedExpoCameraCaptureUri\(shot\.uri,\s*FileSystem\.cacheDirectory\)[\s\S]{0,200}?UNTRUSTED_PROGRESS_CAPTURE_URI/u,
    },
    {
      id: 'progress-review-preview-cache-disabled',
      path: CAT05_PRIVACY_SOURCE_PATHS.progressReviewRoute,
      pattern:
        /<Image[\s\S]{0,220}?source=\{\{ uri: capturedUri \}\}[\s\S]{0,220}?cachePolicy="none"/u,
    },
    {
      id: 'progress-review-route-removal-awaits-discard',
      path: CAT05_PRIVACY_SOURCE_PATHS.progressReviewRoute,
      pattern:
        /await lifecycle\.discard\(\)[\s\S]{0,900}?usePreventRemove\(source !== null && !routeRemovalReady/u,
    },
    {
      id: 'progress-helper-restricts-and-deletes-owned-cache-source',
      path: CAT05_PRIVACY_SOURCE_PATHS.progressPrivacyHelper,
      pattern:
        /if \(!value\.startsWith\(cameraDirectory\)\) return null;[\s\S]{0,1800}?deleteAsync\(source\.uri, \{ idempotent: true \}\)/u,
    },
  ];

  for (const check of checks) {
    assert(
      check.pattern.test(sources[check.path]),
      `CAT05 privacy source assertion failed: ${check.id} (${check.path}).`,
    );
  }

  return Object.freeze({
    assertionIds: Object.freeze(checks.map(({ id }) => id)),
    files: Object.freeze(
      Object.entries(sources)
        .map(([repoPath, sourceText]) =>
          Object.freeze({
            bytes: Buffer.byteLength(sourceText),
            path: repoPath,
            sha256: sha256(sourceText),
          }),
        )
        .sort((left, right) => comparePaths(left.path, right.path)),
    ),
    nativeDeviceProof: false,
    proofKind: 'source-assertions-only',
  });
}

export function validateCat05AuditConfiguration() {
  const expectedViewportIds = ['iphone-375x667', 'iphone-390x844', 'iphone-430x932'];
  const expectedScenarioIds = [
    'edit-fence-suggestion-adoption',
    'failure-manual-recovery',
    'no-text-manual-recovery',
    'recognized-review-retake-continue',
    'timeout-manual-recovery',
  ];
  const viewportIds = CAT05_REQUIRED_VIEWPORTS.map(({ id }) => id).sort();
  const scenarioIds = CAT05_SCENARIO_MATRIX.map(({ id }) => id).sort();
  const groupIds = new Set(CAT05_FIXTURE_GROUPS.map(({ id }) => id));

  assert(
    JSON.stringify(viewportIds) === JSON.stringify(expectedViewportIds.sort()),
    'CAT05 audit viewports do not match the supported Expo-web matrix.',
  );
  assert(
    JSON.stringify(scenarioIds) === JSON.stringify(expectedScenarioIds.sort()),
    'CAT05 audit scenarios do not cover the declared deterministic UI lanes.',
  );
  assert(new Set(viewportIds).size === viewportIds.length, 'CAT05 viewport IDs must be unique.');
  assert(new Set(scenarioIds).size === scenarioIds.length, 'CAT05 scenario IDs must be unique.');
  assert(groupIds.size === CAT05_FIXTURE_GROUPS.length, 'CAT05 fixture-group IDs must be unique.');
  for (const scenario of CAT05_SCENARIO_MATRIX) {
    assert(groupIds.has(scenario.groupId), `Unknown CAT05 fixture group: ${scenario.groupId}`);
  }
  for (const group of CAT05_FIXTURE_GROUPS) {
    assert(
      CAT05_SCENARIO_MATRIX.some(({ groupId }) => groupId === group.id),
      `CAT05 fixture group has no scenario: ${group.id}`,
    );
  }
  return {
    executionCount: CAT05_REQUIRED_VIEWPORTS.length * CAT05_SCENARIO_MATRIX.length,
    fixtureGroupCount: CAT05_FIXTURE_GROUPS.length,
    scenarioCount: CAT05_SCENARIO_MATRIX.length,
    viewportCount: CAT05_REQUIRED_VIEWPORTS.length,
  };
}

function gitNullList(args, root = repoRoot) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
    .split('\0')
    .filter(Boolean)
    .map(normalizeRepoPath);
}

export function listCat05DirtyRepoPaths(root = repoRoot) {
  try {
    return [
      ...new Set([
        ...gitNullList(['diff', '--name-only', '-z', 'HEAD', '--'], root),
        ...gitNullList(['ls-files', '--others', '--exclude-standard', '-z'], root),
      ]),
    ].sort(comparePaths);
  } catch (error) {
    throw new Error(
      `Unable to inspect CAT05 source provenance: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export function assertCat05EvidenceDirectory(value) {
  const resolved = path.resolve(value);
  if (resolved !== CAT05_EVIDENCE_DIRECTORY) {
    throw new Error(`Refusing CAT05 evidence writes outside ${CAT05_EVIDENCE_RELATIVE_DIR}.`);
  }
  const relative = path.relative(repoRoot, resolved);
  let current = repoRoot;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    if (existsSync(current) && lstatSync(current).isSymbolicLink()) {
      throw new Error('Refusing CAT05 evidence writes through a symbolic link or junction.');
    }
  }
  return resolved;
}

export function collectCat05UndeclaredDirtyPaths(dirtyPaths) {
  return [...new Set(dirtyPaths.map(normalizeRepoPath).filter(Boolean))]
    .filter((repoPath) => !CAT05_DECLARED_OUTPUT_PATTERNS.some((pattern) => pattern.test(repoPath)))
    .sort(comparePaths);
}

export function assertCat05SourceProvenance({ dirtyPaths = listCat05DirtyRepoPaths() } = {}) {
  const undeclared = collectCat05UndeclaredDirtyPaths(dirtyPaths);
  if (undeclared.length > 0) {
    throw new Error(
      `Refusing to generate CAT05 web evidence from uncommitted source. Commit the source candidate first; dirty paths: ${undeclared.join(', ')}`,
    );
  }
  return undeclared;
}

export function cat05ServerEnvironment(group, inheritedEnvironment = process.env) {
  const environment = { ...inheritedEnvironment };
  for (const key of Object.keys(environment)) {
    const credentialNamed =
      /(?:TOKEN|SECRET|PASSWORD|PASSCODE|API[_-]?KEY|AUTHORIZATION|COOKIE|PRIVATE[_-]?KEY|DSN)(?:_|$)/iu.test(
        key,
      );
    if (key.startsWith('EXPO_PUBLIC_') || credentialNamed) delete environment[key];
  }
  return {
    ...environment,
    BROWSER: 'none',
    CI: '1',
    EXPO_NO_DOTENV: '1',
    EXPO_PUBLIC_APP_ENV: 'development',
    EXPO_PUBLIC_E2E_APP_LOCK_ENABLED: 'false',
    EXPO_PUBLIC_E2E_LOCAL_RESET: '1',
    EXPO_PUBLIC_NATIVE_CAMERA_ENABLED: 'true',
    EXPO_PUBLIC_NATIVE_OCR_ENABLED: 'true',
    EXPO_PUBLIC_PHASE7_CLOUD_ASK_ENABLED: 'false',
    EXPO_PUBLIC_PHASE7_COMMERCE_ENABLED: 'false',
    EXPO_PUBLIC_POSTHOG_KEY: '',
    EXPO_PUBLIC_REVENUECAT_ANDROID_KEY: '',
    EXPO_PUBLIC_REVENUECAT_IOS_KEY: '',
    EXPO_PUBLIC_REVENUECAT_TEST_STORE_KEY: '',
    EXPO_PUBLIC_SENTRY_DSN: '',
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '__BLOCKED_PLACEHOLDER__',
    EXPO_PUBLIC_SUPABASE_URL: 'https://blocked-supabase-url.invalid',
    ...group.env,
  };
}

function hostPortAvailable(host, port) {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.listen(port, host, () => server.close(() => resolve(true)));
  });
}

async function portAvailable(port) {
  return (await hostPortAvailable('127.0.0.1', port)) && (await hostPortAvailable('::1', port));
}

async function findAvailablePort(preferred) {
  for (let offset = 0; offset <= 100; offset += 1) {
    const candidate = preferred + offset;
    if (await portAvailable(candidate)) return candidate;
  }
  throw new Error(`No open localhost port from ${preferred} through ${preferred + 100}.`);
}

function findBrowserPath() {
  const candidates = [
    process.env.CHROME_PATH,
    process.env.BROWSER_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/microsoft-edge',
  ].filter(Boolean);
  const candidate = candidates.find((item) => existsSync(item));
  if (!candidate) throw new Error('Chrome or Edge was not found. Set CHROME_PATH or BROWSER_PATH.');
  return candidate;
}

async function waitForUrl(url, timeoutMs = 120_000, signal) {
  assertCat05LocalTarget(url);
  const startedAt = Date.now();
  let lastError = null;
  while (Date.now() - startedAt < timeoutMs) {
    assertCat05AuditActive(signal);
    try {
      const response = await fetch(url, { redirect: 'manual', signal });
      if (response.status >= 200 && response.status < 400) return;
    } catch (error) {
      lastError = error;
    }
    await delay(500);
  }
  throw new Error(`Timed out waiting for ${url}: ${lastError?.message ?? 'no response'}`);
}

async function readJson(url, expectedPort, timeoutMs = 30_000, signal, { method = 'GET' } = {}) {
  assertCat05LoopbackHttpTarget(url, expectedPort);
  const startedAt = Date.now();
  let lastError = null;
  while (Date.now() - startedAt < timeoutMs) {
    assertCat05AuditActive(signal);
    try {
      const response = await fetch(url, { method, signal });
      if (response.ok) return await response.json();
    } catch (error) {
      lastError = error;
    }
    await delay(250);
  }
  throw new Error(`Timed out reading ${url}: ${lastError?.message ?? 'no response'}`);
}

function startExpoServer({ appPort, evidenceDir, group }) {
  const command = isWindows ? (process.env.ComSpec ?? 'cmd.exe') : 'npm';
  const args = isWindows
    ? [
        '/d',
        '/s',
        '/c',
        `npm --workspace apps/mobile run web -- --clear --port ${appPort} --host localhost`,
      ]
    : [
        '--workspace',
        'apps/mobile',
        'run',
        'web',
        '--',
        '--clear',
        '--port',
        String(appPort),
        '--host',
        'localhost',
      ];
  const logPath = path.join(evidenceDir, `expo-${safeArtifactId(group.id)}.log`);
  writeFileSync(logPath, '');
  const logCapture = createCat05ExpoLogCapture();
  const child = spawn(command, args, {
    cwd: repoRoot,
    env: cat05ServerEnvironment(group),
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  child.cat05ExpoLogCapture = logCapture;
  const append = (chunk) => appendCat05ExpoLogCapture(logCapture, chunk);
  child.stdout.on('data', append);
  child.stderr.on('data', append);
  return trackCat05Child(child);
}

function startBrowser({ browserPath, debugPort, userDataDir }) {
  const child = spawn(
    browserPath,
    [
      '--headless=old',
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${userDataDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-networking',
      '--disable-component-update',
      '--disable-extensions',
      '--disable-gpu',
      '--disable-sync',
      '--hide-scrollbars',
      'about:blank',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true },
  );
  child.cat05BrowserLogCapture = createCat05ExpoLogCapture();
  const append = (chunk) => appendCat05ExpoLogCapture(child.cat05BrowserLogCapture, chunk);
  child.stdout.on('data', append);
  child.stderr.on('data', append);
  return trackCat05Child(child);
}

function writeCat05BrowserFailureLog(evidenceDir, groupId, capture = null) {
  if (!capture?.chunks?.length && !capture?.droppedBytes) return null;
  const raw = Buffer.concat(capture.chunks).toString('utf8');
  const truncationNotice =
    capture.droppedBytes > 0
      ? `${CAT05_RAW_LOG_TRUNCATION_MARKER}Dropped raw browser log bytes: ${capture.droppedBytes}\n`
      : '';
  const logPath = path.join(evidenceDir, `browser-${safeArtifactId(groupId)}-failure.log`);
  writeFileSync(logPath, sanitizeCat05DiagnosticText(`${raw}${truncationNotice}`));
  return logPath;
}

export function trackCat05Child(child) {
  CAT05_ACTIVE_CHILDREN.add(child);
  const release = () => CAT05_ACTIVE_CHILDREN.delete(child);
  child.once('exit', release);
  child.once('error', release);
  return child;
}

export function cat05ActiveChildCount() {
  return CAT05_ACTIVE_CHILDREN.size;
}

function cat05ChildRunning(child) {
  return Boolean(child?.pid && child.exitCode === null && child.signalCode === null);
}

async function stopProcess(child) {
  if (!child?.pid) {
    if (child) CAT05_ACTIVE_CHILDREN.delete(child);
    return;
  }
  const detach = () => {
    child.stdout?.removeAllListeners('data');
    child.stderr?.removeAllListeners('data');
    child.stdout?.destroy?.();
    child.stderr?.destroy?.();
    child.stdin?.destroy?.();
    child.unref?.();
  };
  if (!cat05ChildRunning(child)) {
    detach();
    CAT05_ACTIVE_CHILDREN.delete(child);
    return;
  }
  const waitForExit = (timeoutMs) =>
    Promise.race([
      new Promise((resolve) => child.once('exit', () => resolve(true))),
      delay(timeoutMs, undefined, { ref: false }).then(() => false),
    ]);
  if (!isWindows) {
    child.kill('SIGTERM');
    await waitForExit(750);
    if (cat05ChildRunning(child)) child.kill('SIGKILL');
    await waitForExit(750);
    detach();
    CAT05_ACTIVE_CHILDREN.delete(child);
    return;
  }
  await Promise.race([
    new Promise((resolve) => {
      const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      });
      killer.once('exit', resolve);
      killer.once('error', resolve);
    }),
    delay(4_000, undefined, { ref: false }),
  ]);
  if (cat05ChildRunning(child)) child.kill('SIGKILL');
  await waitForExit(1_000);
  detach();
  CAT05_ACTIVE_CHILDREN.delete(child);
}

async function stopProcessBestEffort(child) {
  if (!child) return;
  try {
    await Promise.race([stopProcess(child), delay(7_000, undefined, { ref: false })]);
  } catch {
    // A final tracked-process sweep decides whether cleanup actually succeeded.
  }
  if (!cat05ChildRunning(child)) CAT05_ACTIVE_CHILDREN.delete(child);
}

export async function removeCat05BrowserUserDataDirBestEffort(
  userDataDir,
  { attempts = isWindows ? 8 : 2, retryDelayMs = isWindows ? 250 : 25 } = {},
) {
  if (!userDataDir) return { removed: true };
  const resolved = path.resolve(userDataDir);
  const temporaryRoot = path.resolve(tmpdir());
  const prefix = `${temporaryRoot}${path.sep}`;
  assert(
    resolved.startsWith(prefix) && path.basename(resolved).startsWith('cat05-browser-'),
    'CAT05 refuses to remove an untrusted browser user-data directory.',
  );
  let lastError = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      rmSync(resolved, { force: true, maxRetries: 2, recursive: true, retryDelay: retryDelayMs });
      return { removed: !existsSync(resolved) };
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) await delay(retryDelayMs, undefined, { ref: false });
    }
  }
  return { error: sanitizeCat05DiagnosticError(lastError), removed: !existsSync(resolved) };
}

export async function stopActiveCat05Processes() {
  const children = [...CAT05_ACTIVE_CHILDREN];
  await Promise.allSettled(children.map(stopProcessBestEffort));
  const alive = children.filter(cat05ChildRunning);
  for (const child of children) {
    if (!alive.includes(child)) CAT05_ACTIVE_CHILDREN.delete(child);
  }
  assert(
    alive.length === 0,
    `CAT05 could not stop ${alive.length} tracked child process(es): ${alive.map(({ pid }) => pid).join(', ')}.`,
  );
}

class CdpClient {
  constructor(wsUrl) {
    this.closed = false;
    this.eventBytes = 0;
    this.evidenceBudgetError = null;
    this.events = [];
    this.inflight = new Set();
    this.nextId = 1;
    this.pending = new Map();
    this.ws = new WebSocket(wsUrl);
    this.ready = new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('CDP websocket did not open within 20000ms.')),
        20_000,
      );
      this.ws.addEventListener(
        'open',
        () => {
          clearTimeout(timeout);
          resolve();
        },
        { once: true },
      );
      this.ws.addEventListener(
        'error',
        () => {
          clearTimeout(timeout);
          reject(new Error('CDP websocket failed before opening.'));
        },
        { once: true },
      );
      this.ws.addEventListener(
        'close',
        () => {
          clearTimeout(timeout);
          reject(new Error('CDP websocket closed before opening.'));
        },
        { once: true },
      );
    });
    this.ws.addEventListener('message', (event) => this.handleMessage(event));
    this.ws.addEventListener('close', () => {
      this.closed = true;
      this.rejectPending(new Error('CDP websocket closed before the command completed.'));
    });
    this.ws.addEventListener('error', () => {
      this.rejectPending(new Error('CDP websocket failed before the command completed.'));
    });
  }

  handleMessage(event) {
    const wireMessage = event.data.toString();
    const message = JSON.parse(wireMessage);
    if (message.id && this.pending.has(message.id)) {
      const { reject, resolve, timeout } = this.pending.get(message.id);
      this.pending.delete(message.id);
      clearTimeout(timeout);
      if (message.error) reject(new Error(`${message.error.message}: ${message.error.data ?? ''}`));
      else resolve(message.result ?? {});
      return;
    }
    if (!message.method) return;
    if (message.method === 'Network.requestWillBeSent') {
      this.inflight.add(message.params.requestId);
    }
    if (['Network.loadingFinished', 'Network.loadingFailed'].includes(message.method)) {
      this.inflight.delete(message.params.requestId);
    }
    const messageBytes = Buffer.byteLength(wireMessage, 'utf8');
    if (
      messageBytes > CAT05_MAX_CDP_MESSAGE_BYTES ||
      this.events.length >= CAT05_MAX_CDP_EVENT_COUNT ||
      this.eventBytes + messageBytes > CAT05_MAX_CDP_EVENT_BYTES
    ) {
      this.evidenceBudgetError ??= new Error(
        `CAT05 CDP event budget exceeded (${this.events.length} retained events, ${this.eventBytes} retained bytes, ${messageBytes} next-event bytes).`,
      );
      return;
    }
    this.eventBytes += messageBytes;
    this.events.push({ ...message, observedAt: new Date().toISOString() });
  }

  assertEvidenceBudget() {
    if (this.evidenceBudgetError) throw this.evidenceBudgetError;
  }

  rejectPending(error) {
    for (const { reject, timeout } of this.pending.values()) {
      clearTimeout(timeout);
      reject(error);
    }
    this.pending.clear();
  }

  async send(method, params = {}, timeoutMs = 20_000) {
    await this.ready;
    if (this.closed || this.ws.readyState !== 1) {
      throw new Error(`CDP websocket is not open for ${method}.`);
    }
    const id = this.nextId;
    this.nextId += 1;
    return await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (!this.pending.has(id)) return;
        this.pending.delete(id);
        reject(new Error(`CDP command ${method} timed out after ${timeoutMs}ms.`));
      }, timeoutMs);
      this.pending.set(id, { reject, resolve, timeout });
      try {
        this.ws.send(JSON.stringify({ id, method, params }));
      } catch (error) {
        this.pending.delete(id);
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  close() {
    this.closed = true;
    this.ws.close();
  }
}

async function connectToPage(debugPort, baseUrl, signal) {
  const targetUrl = String(assertCat05PageTarget(baseUrl, baseUrl));
  const createdTarget = await readJson(
    `http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(targetUrl)}`,
    debugPort,
    30_000,
    signal,
    { method: 'PUT' },
  );
  const target =
    createdTarget?.type === 'page' && createdTarget?.webSocketDebuggerUrl
      ? createdTarget
      : null;
  if (!target) throw new Error('No debuggable browser page was found.');
  assertCat05PageTarget(target.url, baseUrl);
  assertCat05DebugTarget(target.webSocketDebuggerUrl, debugPort);
  const client = new CdpClient(target.webSocketDebuggerUrl);
  await client.ready;
  return client;
}

async function evaluate(client, expression, awaitPromise = false) {
  const result = await client.send('Runtime.evaluate', {
    awaitPromise,
    expression,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(
      result.exceptionDetails.exception?.description ??
        result.exceptionDetails.text ??
        'Runtime.evaluate failed',
    );
  }
  return result.result?.value;
}

async function waitForCondition(client, expression, timeoutMs, label) {
  const startedAt = Date.now();
  let lastError = null;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      if (await evaluate(client, expression)) return;
    } catch (error) {
      if (client.closed) throw error;
      lastError = error;
    }
    await delay(150);
  }
  throw new Error(`Timed out waiting for ${label}: ${lastError?.message ?? 'condition false'}`);
}

async function waitForText(client, text, timeoutMs = 30_000) {
  await waitForCondition(
    client,
    `(() => {
      const isExcludedFromInteractionTree = ${isExcludedFromInteractionTree.toString()};
      const interactionTreeText = ${interactionTreeText.toString()};
      return interactionTreeText(document.body, (node) => getComputedStyle(node)).replace(/\\s+/g, ' ').includes(${JSON.stringify(text)});
    })()`,
    timeoutMs,
    `text ${JSON.stringify(text)}`,
  );
}

async function waitForPath(client, prefix, timeoutMs = 30_000) {
  await waitForCondition(
    client,
    `window.location.pathname.startsWith(${JSON.stringify(prefix)})`,
    timeoutMs,
    `path ${prefix}`,
  );
}

async function waitForNetworkIdle(client, timeoutMs = 60_000) {
  const startedAt = Date.now();
  let quietSince = null;
  while (Date.now() - startedAt < timeoutMs) {
    assert(!client.closed, 'CDP websocket closed while waiting for network idle.');
    if (client.inflight.size === 0) {
      quietSince ??= Date.now();
      if (Date.now() - quietSince >= 400) return;
    } else {
      quietSince = null;
    }
    await delay(100);
  }
  throw new Error(`Network did not become idle; ${client.inflight.size} request(s) remain.`);
}

export function prepareCat05Navigation(client) {
  assert(
    client?.inflight && typeof client.inflight.clear === 'function',
    'CAT05 navigation requires request lifecycle tracking.',
  );
  // A top-level navigation cancels the previous document's request epoch. CDP
  // can omit terminal events for those canceled development-server requests,
  // so carrying them forward would make an otherwise settled page look busy.
  client.inflight.clear();
}

async function setViewport(client, viewport) {
  await client.send('Emulation.setDeviceMetricsOverride', {
    deviceScaleFactor: 1,
    height: viewport.height,
    mobile: true,
    screenHeight: viewport.height,
    screenWidth: viewport.width,
    width: viewport.width,
  });
  await client.send('Emulation.setTouchEmulationEnabled', { enabled: true });
}

function controlExpression(label, exact, scroll) {
  return `(() => {
    const wanted = ${JSON.stringify(label)};
    const exact = ${JSON.stringify(exact)};
    const normalize = (value) => String(value ?? '').replace(/\\s+/g, ' ').trim();
    const matches = (value) => exact ? value === wanted : value.includes(wanted);
    const isExcludedFromInteractionTree = ${isExcludedFromInteractionTree.toString()};
    const candidates = Array.from(document.querySelectorAll('button,[role="button"],a,label'))
      .filter((node) => !isExcludedFromInteractionTree(node));
    const target = candidates.find((node) => [
      node.getAttribute('aria-label'),
      node.getAttribute('accessibilitylabel'),
      node.textContent,
      node.getAttribute('title'),
    ].map(normalize).filter(Boolean).some(matches));
    if (!target) return null;
    if (${JSON.stringify(scroll)}) target.scrollIntoView({ block: 'center', inline: 'center' });
    const rect = target.getBoundingClientRect();
    const style = getComputedStyle(target);
    return {
      ariaDisabled: target.getAttribute('aria-disabled'),
      disabled: Boolean(target.disabled),
      height: rect.height,
      visible: rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden',
      width: rect.width,
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  })()`;
}

async function clickByText(client, label, { exact = true, timeoutMs = 30_000 } = {}) {
  const startedAt = Date.now();
  let target = null;
  while (Date.now() - startedAt < timeoutMs) {
    target = await evaluate(client, controlExpression(label, exact, true));
    if (target?.visible && !target.disabled && target.ariaDisabled !== 'true') break;
    await delay(150);
  }
  assert(target?.visible, `Could not find visible control ${JSON.stringify(label)}.`);
  assert(!target.disabled && target.ariaDisabled !== 'true', `${label} is disabled.`);
  assert(
    target.width >= 44 && target.height >= 44,
    `${label} is smaller than 44 by 44 CSS pixels.`,
  );
  await client.send('Input.dispatchTouchEvent', {
    touchPoints: [{ force: 1, id: 1, radiusX: 2, radiusY: 2, x: target.x, y: target.y }],
    type: 'touchStart',
  });
  await client.send('Input.dispatchTouchEvent', { touchPoints: [], type: 'touchEnd' });
  await delay(150);
}

function fillExpression(label, value) {
  return `(() => {
    const wanted = ${JSON.stringify(label)};
    const value = ${JSON.stringify(value)};
    const normalize = (next) => String(next ?? '').replace(/\\s+/g, ' ').trim();
    const isExcludedFromInteractionTree = ${isExcludedFromInteractionTree.toString()};
    const target = Array.from(document.querySelectorAll('input,textarea'))
      .filter((node) => !isExcludedFromInteractionTree(node))
      .find((node) => [
        node.getAttribute('aria-label'),
        node.getAttribute('accessibilitylabel'),
        node.getAttribute('placeholder'),
      ].map(normalize).includes(wanted));
    if (!target) return null;
    target.scrollIntoView({ block: 'center', inline: 'nearest' });
    target.focus();
    const prototype = target instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    if (setter) setter.call(target, value);
    else target.value = value;
    target.dispatchEvent(new InputEvent('input', { bubbles: true, data: value, inputType: 'insertText' }));
    target.dispatchEvent(new Event('change', { bubbles: true }));
    return { value: target.value };
  })()`;
}

async function fillByLabel(client, label, value) {
  const result = await evaluate(client, fillExpression(label, value));
  assert(result, `Could not find input ${JSON.stringify(label)}.`);
  assert(result.value === value, `${label} did not receive its deterministic value.`);
  await delay(100);
}

async function waitForInputValue(client, label, value, timeoutMs = 10_000) {
  await waitForCondition(
    client,
    `(() => Array.from(document.querySelectorAll('input,textarea')).some((node) => {
      const candidate = node.getAttribute('aria-label') || node.getAttribute('accessibilitylabel') || node.getAttribute('placeholder');
      return candidate === ${JSON.stringify(label)} && node.value === ${JSON.stringify(value)};
    }))()`,
    timeoutMs,
    `${label} value ${JSON.stringify(value)}`,
  );
}

function enabledControlExpression(label) {
  return `(() => {
    const wanted = ${JSON.stringify(label)};
    const normalize = (value) => String(value ?? '').replace(/\\s+/g, ' ').trim();
    return Array.from(document.querySelectorAll('button,[role="button"]')).some((node) => {
      const values = [node.getAttribute('aria-label'), node.textContent].map(normalize).filter(Boolean);
      return values.includes(wanted) && !node.disabled && node.getAttribute('aria-disabled') !== 'true';
    });
  })()`;
}

function auditExpression() {
  return `(() => {
    const normalize = (value) => String(value ?? '').replace(/\\s+/g, ' ').trim();
    const doc = document.documentElement;
    const body = document.body;
    const overflowX = Math.max(0, doc.scrollWidth - innerWidth, body.scrollWidth - innerWidth);
    const isExcludedFromInteractionTree = ${isExcludedFromInteractionTree.toString()};
    const interactionTreeText = ${interactionTreeText.toString()};
    const measureControlGeometry = ${measureControlGeometry.toString()};
    const controls = [];
    const issues = [];
    for (const node of document.querySelectorAll('button,[role="button"],[role="radio"],[role="checkbox"],[role="switch"],input,textarea,select')) {
      const geometry = measureControlGeometry(
        node,
        { height: innerHeight, width: innerWidth },
        (candidate) => getComputedStyle(candidate),
      );
      if (!geometry) continue;
      const { exposedHeight, exposedLeft, exposedTop, exposedWidth, fullyExposed, rect, scrollClipped, unsafeClipped } = geometry;
      const label = normalize(node.getAttribute('aria-label') || node.getAttribute('accessibilitylabel') || node.textContent || node.getAttribute('placeholder'));
      const disabled = Boolean(node.disabled) || node.getAttribute('aria-disabled') === 'true';
      const center = {
        x: Math.max(0, Math.min(innerWidth - 1, exposedLeft + exposedWidth / 2)),
        y: Math.max(0, Math.min(innerHeight - 1, exposedTop + exposedHeight / 2)),
      };
      const hit = document.elementFromPoint(center.x, center.y);
      const hitOk = !hit || node === hit || node.contains(hit) || hit.contains(node);
      const control = {
        ariaDescription: node.getAttribute('aria-description'),
        ariaDescribedBy: node.getAttribute('aria-describedby'),
        disabled,
        fullyExposed,
        height: Number(rect.height.toFixed(2)),
        hitOk,
        label,
        role: node.getAttribute('role') || node.tagName.toLowerCase(),
        scrollClipped,
        unsafeClipped,
        width: Number(rect.width.toFixed(2)),
        x: Number(rect.left.toFixed(2)),
        y: Number(rect.top.toFixed(2)),
      };
      controls.push(control);
      const horizontallyViewportClipped = rect.left < -1 || rect.right > innerWidth + 1;
      if (!label) issues.push({ control, type: 'missingAccessibleName' });
      if (horizontallyViewportClipped || unsafeClipped) issues.push({ control, type: 'clippedVisibleControl' });
      if (horizontallyViewportClipped) issues.push({ control, type: 'horizontalControlClipping' });
      if (!fullyExposed) continue;
      if (!disabled && (rect.width < 44 || rect.height < 44)) issues.push({ control, type: 'sub44VisibleControl' });
      if (!disabled && !hitOk) issues.push({ control, type: 'blockedCenterHitTest' });
    }
    if (overflowX > 1) issues.push({ overflowX, type: 'horizontalOverflow' });
    return {
      alerts: Array.from(document.querySelectorAll('[role="alert"]'))
        .filter((node) => !isExcludedFromInteractionTree(node))
        .map((node) => normalize(node.textContent)),
      bodyText: normalize(interactionTreeText(body, (node) => getComputedStyle(node))).slice(0, 12_000),
      controls,
      inputs: Array.from(document.querySelectorAll('input,textarea'))
        .filter((node) => !isExcludedFromInteractionTree(node))
        .map((node) => ({
          ariaDescription: node.getAttribute('aria-description'),
          ariaDescribedBy: node.getAttribute('aria-describedby'),
          label: normalize(node.getAttribute('aria-label') || node.getAttribute('accessibilitylabel') || node.getAttribute('placeholder')),
          value: node.value,
        })),
      issues,
      liveRegions: Array.from(document.querySelectorAll('[aria-live]')).map((node) => ({
        live: node.getAttribute('aria-live'),
        role: node.getAttribute('role'),
        text: normalize(node.textContent),
      })),
      overflowX,
      title: document.title,
      url: location.href,
      viewport: { height: innerHeight, width: innerWidth },
    };
  })()`;
}

function assertSnapshotClean(snapshot, label) {
  assert(snapshot.viewport.width > 0 && snapshot.viewport.height > 0, `${label} has no viewport.`);
  assert(snapshot.overflowX <= 1, `${label} has ${snapshot.overflowX}px horizontal overflow.`);
  assert(
    snapshot.issues.length === 0,
    `${label} has ${snapshot.issues.length} interaction issue(s).`,
  );
}

function assertInteractiveControl(snapshot, label) {
  const control = snapshot.controls.find((candidate) => candidate.label.includes(label));
  assert(control, `${snapshot.url} does not expose an interactive ${label} control.`);
  assert(!control.disabled, `${label} is disabled at ${snapshot.url}.`);
  assert(control.width >= 44 && control.height >= 44, `${label} is below the 44pt web proxy.`);
  assert(
    control.hitOk || control.scrollClipped,
    `${label} is not center-hit-testable or scroll-reachable.`,
  );
}

function inputValue(snapshot, label) {
  return snapshot.inputs.find((input) => input.label === label)?.value ?? null;
}

async function navigate(client, baseUrl, viewport, scenarioId) {
  const boundBase = assertCat05LocalTarget(baseUrl);
  await setViewport(client, viewport);
  const url = new URL('/shelf/ocr', baseUrl);
  url.searchParams.set('cat05Audit', `${scenarioId}-${viewport.id}-${Date.now()}`);
  assertCat05PageTarget(url, boundBase);
  prepareCat05Navigation(client);
  await client.send('Page.navigate', { url: url.toString() });
  await waitForPath(client, '/shelf/ocr');
  await waitForText(client, 'Read the label');
  await waitForNetworkIdle(client);
}

export async function navigateToCat05OcrConsentProbe(
  client,
  { baseUrl, groupId, timeoutMs = 60_000 } = {},
) {
  const probeUrl = new URL('/shelf/ocr', baseUrl);
  probeUrl.searchParams.set('cat05ConsentProbe', `${groupId}-${Date.now()}`);
  assertCat05PageTarget(probeUrl, baseUrl, '/shelf/ocr');
  prepareCat05Navigation(client);
  await client.send('Page.navigate', { url: probeUrl.toString() });
  await waitForCondition(
    client,
    `window.location.pathname === '/shelf/ocr' && document.body?.innerText.includes('Read the label')`,
    timeoutMs,
    'label-review route after explicit local consent',
  );
  return probeUrl.toString();
}

function writeJson(evidenceDir, name, value) {
  writeFileSync(path.join(evidenceDir, name), `${JSON.stringify(value, null, 2)}\n`);
}

function cat05ArtifactBinding(binding, { artifactName, fixtureGroup, scenarioId, viewport }) {
  return {
    ...binding,
    artifactName,
    fixtureGroup,
    scenarioId: scenarioId ?? null,
    viewport: viewport ? { height: viewport.height, id: viewport.id, width: viewport.width } : null,
  };
}

function pngBuffer(encoded, artifactName) {
  assert(typeof encoded === 'string' && encoded.length > 0, `${artifactName} has no PNG data.`);
  const buffer = Buffer.from(encoded, 'base64');
  assert(buffer.length >= 100, `${artifactName} PNG is implausibly small.`);
  assert(
    buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    `${artifactName} does not have a PNG signature.`,
  );
  return buffer;
}

async function captureStep(client, evidenceDir, artifactName, context) {
  await delay(150);
  const snapshot = await evaluate(client, auditExpression());
  assertSnapshotClean(snapshot, artifactName);
  assertCat05PageTarget(snapshot.url, context.baseUrl);
  assert(
    snapshot.viewport.width === context.viewport.width &&
      snapshot.viewport.height === context.viewport.height,
    `${artifactName} viewport does not match ${context.viewport.id}.`,
  );
  const evidenceBinding = cat05ArtifactBinding(context.binding, {
    artifactName,
    fixtureGroup: context.fixtureGroup,
    scenarioId: context.scenarioId,
    viewport: context.viewport,
  });
  writeJson(evidenceDir, `${artifactName}.json`, {
    ...snapshot,
    evidenceBinding,
    url: sanitizeCat05EvidenceUrl(snapshot.url),
  });
  const screenshot = await client.send('Page.captureScreenshot', {
    captureBeyondViewport: false,
    format: 'png',
  });
  writeFileSync(
    path.join(evidenceDir, `${artifactName}.png`),
    pngBuffer(screenshot.data, artifactName),
  );
  return snapshot;
}

async function captureFailure(client, evidenceDir, artifactPrefix, context) {
  const artifacts = [];
  try {
    const snapshot = await evaluate(client, auditExpression());
    assertCat05PageTarget(snapshot.url, context.baseUrl);
    const snapshotName = `${artifactPrefix}-failure.json`;
    writeJson(evidenceDir, snapshotName, {
      ...snapshot,
      evidenceBinding: cat05ArtifactBinding(context.binding, {
        artifactName: `${artifactPrefix}-failure`,
        fixtureGroup: context.fixtureGroup,
        scenarioId: context.scenarioId,
        viewport: context.viewport,
      }),
      url: sanitizeCat05EvidenceUrl(snapshot.url),
    });
    artifacts.push(snapshotName);
  } catch {
    // Preserve the original failure if the page itself is no longer inspectable.
  }
  try {
    const currentUrl = await evaluate(client, 'location.href');
    assertCat05PageTarget(currentUrl, context.baseUrl);
    const screenshot = await client.send('Page.captureScreenshot', {
      captureBeyondViewport: false,
      format: 'png',
    });
    const screenshotName = `${artifactPrefix}-failure.png`;
    writeFileSync(
      path.join(evidenceDir, screenshotName),
      pngBuffer(screenshot.data, `${artifactPrefix}-failure`),
    );
    artifacts.push(screenshotName);
  } catch {
    // Preserve the original failure if Chrome cannot capture the page.
  }
  return artifacts;
}

async function establishLocalHealthConsent({ binding, client, baseUrl, evidenceDir, groupId }) {
  const viewport = CAT05_REQUIRED_VIEWPORTS[1];
  const artifactPrefix = safeArtifactId(`bootstrap-${groupId}-${viewport.id}`);
  const eventStart = client.events.length;
  const result = {
    artifactPrefix,
    browserFailures: [],
    completedAt: null,
    evidenceBinding: cat05ArtifactBinding(binding, {
      artifactName: `${artifactPrefix}-result`,
      fixtureGroup: groupId,
      scenarioId: null,
      viewport,
    }),
    error: null,
    fixtureGroup: groupId,
    kind: 'consent-bootstrap',
    nativeDeviceProof: false,
    startedAt: new Date().toISOString(),
    surface: 'expo-web',
    verdict: 'fail',
    viewport,
  };

  try {
    await setViewport(client, viewport);
    const resetUrl = new URL('/', baseUrl);
    resetUrl.searchParams.set('e2eReset', 'local');
    resetUrl.searchParams.set('cat05Bootstrap', `${groupId}-${Date.now()}`);
    assertCat05PageTarget(resetUrl, baseUrl);
    prepareCat05Navigation(client);
    await client.send('Page.navigate', { url: resetUrl.toString() });
    await waitForText(client, 'Begin', 60_000);
    await clickByText(client, 'Begin');
    await waitForPath(client, '/onboarding/age');
    await fillByLabel(client, 'Day of birth', '01');
    await fillByLabel(client, 'Month of birth', '01');
    await fillByLabel(client, 'Year of birth', '1990');
    await waitForCondition(
      client,
      enabledControlExpression('Continue'),
      10_000,
      'enabled Continue',
    );
    await clickByText(client, 'Continue');
    await waitForPath(client, '/onboarding/consent');
    await clickByText(client, 'I agree. Continue');
    await waitForPath(client, '/onboarding/goals');
    await waitForText(client, 'What brings you here?');

    await navigateToCat05OcrConsentProbe(client, { baseUrl, groupId });
    await waitForNetworkIdle(client);
    await captureStep(client, evidenceDir, `${artifactPrefix}-ocr-ready`, {
      baseUrl,
      binding,
      fixtureGroup: groupId,
      scenarioId: null,
      viewport,
    });
    client.assertEvidenceBudget();
    result.browserFailures = sanitizeCat05BrowserFailures(
      classifyCat05BrowserFailures(client.events.slice(eventStart), baseUrl),
    );
    assert(
      result.browserFailures.length === 0,
      `Consent bootstrap emitted ${result.browserFailures.length} browser failure(s).`,
    );
    const endUrl = await evaluate(client, 'location.href');
    assertCat05PageTarget(endUrl, baseUrl);
    result.endUrl = sanitizeCat05EvidenceUrl(endUrl);
    result.verdict = 'pass';
  } catch (error) {
    result.error = sanitizeCat05DiagnosticError(error);
    result.browserFailures = sanitizeCat05BrowserFailures(
      classifyCat05BrowserFailures(client.events.slice(eventStart), baseUrl),
    );
    result.failureArtifacts = await captureFailure(client, evidenceDir, artifactPrefix, {
      baseUrl,
      binding,
      fixtureGroup: groupId,
      scenarioId: null,
      viewport,
    });
  } finally {
    result.completedAt = new Date().toISOString();
    writeJson(evidenceDir, `${artifactPrefix}-result.json`, result);
  }
  return result;
}

async function startFixtureRecognition(client) {
  await waitForText(client, 'Capture label');
  await clickByText(client, 'Capture label');
  await waitForText(client, 'Reading the ingredient label', 10_000);
}

async function verifyManualHandoff(client, viewport, expectedText) {
  await clickByText(client, 'Looks right. Continue');
  await waitForPath(client, '/shelf/manual');
  await waitForText(client, 'Add by hand');
  if (viewport.height >= 700) {
    await waitForInputValue(client, 'Ingredients', expectedText);
  }
}

async function executeScenario({
  artifactPrefix,
  baseUrl,
  binding,
  client,
  evidenceDir,
  scenario,
  viewport,
}) {
  const capture = (artifactName) =>
    captureStep(client, evidenceDir, artifactName, {
      baseUrl,
      binding,
      fixtureGroup: scenario.groupId,
      scenarioId: scenario.id,
      viewport,
    });
  switch (scenario.id) {
    case 'recognized-review-retake-continue': {
      await startFixtureRecognition(client);
      await waitForInputValue(client, 'Ingredient label text', CAT05_FIXTURE_TRANSCRIPT);
      await waitForText(client, 'Text is ready to check.');
      await waitForText(client, 'Check 2 unclear lines');
      await waitForText(client, 'The scan may be incomplete.');
      const ready = await capture(`${artifactPrefix}-recognized-ready`);
      assert(
        inputValue(ready, 'Ingredient label text') === CAT05_FIXTURE_TRANSCRIPT,
        'Recognized Unicode transcript was not preserved exactly.',
      );
      assert(
        ready.bodyText.includes('Development-only deterministic OCR state.') &&
          ready.bodyText.includes('does not exercise Apple Vision or a device photo'),
        'Recognized fixture review lost its explicit non-native scope boundary.',
      );
      assert(!ready.bodyText.includes('% accurate'), 'OCR UI must not claim percentage accuracy.');
      assert(
        ready.bodyText.includes('Retake label photo'),
        'Recognized review does not expose a Retake label photo action.',
      );
      assertInteractiveControl(ready, 'Looks right. Continue');
      // clickByText scrolls the secondary action into view, verifies its 44pt
      // target, and taps it. A compact viewport cannot display both this action
      // and the sticky primary CTA simultaneously, but both must be reachable.
      await clickByText(client, 'Retake label photo');
      await waitForText(client, 'Capture label');
      const retake = await capture(`${artifactPrefix}-retake-ready`);
      assertInteractiveControl(retake, 'Capture label');
      await startFixtureRecognition(client);
      await waitForInputValue(client, 'Ingredient label text', CAT05_FIXTURE_TRANSCRIPT);
      await verifyManualHandoff(client, viewport, CAT05_FIXTURE_TRANSCRIPT);
      await capture(`${artifactPrefix}-manual-handoff`);
      return;
    }
    case 'edit-fence-suggestion-adoption': {
      await startFixtureRecognition(client);
      await fillByLabel(client, 'Ingredient label text', CAT05_EDIT_FENCE_TEXT);
      await waitForText(client, 'Recognized text is ready. Your edits were kept.');
      await waitForInputValue(client, 'Ingredient label text', CAT05_EDIT_FENCE_TEXT);
      const kept = await capture(`${artifactPrefix}-edit-kept`);
      assertInteractiveControl(kept, 'Use recognized text');
      assert(
        inputValue(kept, 'Ingredient label text') === CAT05_EDIT_FENCE_TEXT,
        'Late recognition overwrote a user edit.',
      );
      await clickByText(client, 'Use recognized text');
      await waitForInputValue(client, 'Ingredient label text', CAT05_FIXTURE_TRANSCRIPT);
      const adopted = await capture(`${artifactPrefix}-suggestion-adopted`);
      assert(
        !adopted.controls.some(({ label }) => label.includes('Use recognized text')),
        'Suggestion action remained after explicit adoption.',
      );
      await verifyManualHandoff(client, viewport, CAT05_FIXTURE_TRANSCRIPT);
      await capture(`${artifactPrefix}-manual-handoff`);
      return;
    }
    case 'no-text-manual-recovery': {
      await startFixtureRecognition(client);
      await waitForText(client, 'No readable text found');
      const noText = await capture(`${artifactPrefix}-no-text`);
      assert(
        noText.alerts.some((value) => value.includes('No readable text found')),
        'No-text state is not an alert.',
      );
      assertInteractiveControl(noText, 'Retake label photo');
      await fillByLabel(client, 'Ingredient label text', CAT05_MANUAL_UNICODE_TEXT);
      await verifyManualHandoff(client, viewport, CAT05_MANUAL_UNICODE_TEXT);
      await capture(`${artifactPrefix}-manual-handoff`);
      return;
    }
    case 'timeout-manual-recovery': {
      await startFixtureRecognition(client);
      await waitForText(client, 'Label reading took too long');
      const timedOut = await capture(`${artifactPrefix}-timed-out`);
      assert(
        timedOut.alerts.some((value) => value.includes('Label reading took too long')),
        'Timeout state is not an alert.',
      );
      assertInteractiveControl(timedOut, 'Retake label photo');
      await fillByLabel(client, 'Ingredient label text', CAT05_MANUAL_UNICODE_TEXT);
      await verifyManualHandoff(client, viewport, CAT05_MANUAL_UNICODE_TEXT);
      await capture(`${artifactPrefix}-manual-handoff`);
      return;
    }
    case 'failure-manual-recovery': {
      await startFixtureRecognition(client);
      await waitForText(client, 'The label wasn’t read');
      const failed = await capture(`${artifactPrefix}-failed`);
      assert(
        failed.alerts.some((value) => value.includes('label wasn’t read')),
        'Failure state is not an alert.',
      );
      assertInteractiveControl(failed, 'Retake label photo');
      await fillByLabel(client, 'Ingredient label text', CAT05_MANUAL_UNICODE_TEXT);
      await verifyManualHandoff(client, viewport, CAT05_MANUAL_UNICODE_TEXT);
      await capture(`${artifactPrefix}-manual-handoff`);
      return;
    }
    default:
      throw new Error(`Unknown CAT05 scenario: ${scenario.id}`);
  }
}

async function runScenario(context) {
  const { baseUrl, binding, client, evidenceDir, scenario, viewport } = context;
  const artifactPrefix = safeArtifactId(`${scenario.id}-${viewport.id}`);
  const eventStart = client.events.length;
  const result = {
    artifactPrefix,
    browserFailures: [],
    completedAt: null,
    evidenceBinding: cat05ArtifactBinding(binding, {
      artifactName: `${artifactPrefix}-result`,
      fixtureGroup: scenario.groupId,
      scenarioId: scenario.id,
      viewport,
    }),
    error: null,
    fixture: scenario.fixture,
    fixtureGroup: scenario.groupId,
    kind: 'scenario',
    nativeDeviceProof: false,
    scenarioId: scenario.id,
    startedAt: new Date().toISOString(),
    surface: 'expo-web-deterministic-ui-fixture',
    verdict: 'fail',
    viewport,
  };

  try {
    await navigate(client, baseUrl, viewport, scenario.id);
    const initial = await captureStep(client, evidenceDir, `${artifactPrefix}-initial`, {
      baseUrl,
      binding,
      fixtureGroup: scenario.groupId,
      scenarioId: scenario.id,
      viewport,
    });
    assertInteractiveControl(initial, 'Back');
    assertInteractiveControl(initial, 'Capture label');
    assert(
      initial.bodyText.includes('Development-only deterministic OCR state.') &&
        initial.bodyText.includes('does not exercise Apple Vision or a device photo'),
      'Fixture-enabled route lost its explicit non-native scope boundary.',
    );
    await executeScenario({ ...context, artifactPrefix });
    client.assertEvidenceBudget();
    result.browserFailures = sanitizeCat05BrowserFailures(
      classifyCat05BrowserFailures(client.events.slice(eventStart), baseUrl),
    );
    assert(
      result.browserFailures.length === 0,
      `${scenario.id} emitted ${result.browserFailures.length} browser failure(s).`,
    );
    const endUrl = await evaluate(client, 'location.href');
    assertCat05PageTarget(endUrl, baseUrl);
    result.endUrl = sanitizeCat05EvidenceUrl(endUrl);
    result.verdict = 'pass';
  } catch (error) {
    result.error = sanitizeCat05DiagnosticError(error);
    result.browserFailures = sanitizeCat05BrowserFailures(
      classifyCat05BrowserFailures(client.events.slice(eventStart), baseUrl),
    );
    result.failureArtifacts = await captureFailure(client, evidenceDir, artifactPrefix, {
      baseUrl,
      binding,
      fixtureGroup: scenario.groupId,
      scenarioId: scenario.id,
      viewport,
    });
  } finally {
    result.completedAt = new Date().toISOString();
    writeJson(evidenceDir, `${artifactPrefix}-result.json`, result);
  }
  return result;
}

export function classifyCat05BrowserFailures(events, baseUrl) {
  const base = assertCat05LocalTarget(baseUrl);
  const failures = classifyBrowserFailures(events, [baseUrl]);
  for (const event of events) {
    const targets = [];
    if (event.method === 'Network.requestWillBeSent') {
      targets.push({ role: 'request', url: event.params?.request?.url });
      if (event.params?.documentURL) {
        targets.push({ role: 'document', url: event.params.documentURL });
      }
    } else if (event.method === 'Network.responseReceived') {
      targets.push({ role: 'response', url: event.params?.response?.url });
    } else if (event.method === 'Network.webSocketCreated') {
      targets.push({ role: 'websocket', url: event.params?.url });
    }
    for (const { role, url } of targets) {
      if (!url) continue;
      let candidate;
      try {
        candidate = new URL(url);
      } catch {
        failures.push({ method: event.method, role, type: 'malformed-network-target' });
        continue;
      }
      const trustedProtocol =
        role === 'websocket' ? candidate.protocol === 'ws:' : candidate.protocol === 'http:';
      if (
        !trustedProtocol ||
        candidate.hostname !== 'localhost' ||
        candidate.port !== base.port ||
        candidate.username ||
        candidate.password
      ) {
        failures.push({
          method: event.method,
          role,
          type: 'untrusted-network-target',
          url: sanitizeCat05EvidenceUrl(url),
        });
      }
    }
  }
  return failures;
}

export function sanitizeBrowserEvents(events) {
  const retained = [];
  let retainedBytes = 0;
  const retain = (event) => {
    assert(
      retained.length < CAT05_MAX_RETAINED_BROWSER_EVENTS,
      `CAT05 browser-event evidence exceeded ${CAT05_MAX_RETAINED_BROWSER_EVENTS} retained events.`,
    );
    const eventBytes = Buffer.byteLength(JSON.stringify(event), 'utf8');
    assert(
      eventBytes <= CAT05_MAX_CDP_MESSAGE_BYTES,
      `CAT05 sanitized browser event exceeded ${CAT05_MAX_CDP_MESSAGE_BYTES} bytes.`,
    );
    assert(
      retainedBytes + eventBytes <= CAT05_MAX_BROWSER_EVENT_EVIDENCE_BYTES,
      `CAT05 browser-event evidence exceeded ${CAT05_MAX_BROWSER_EVENT_EVIDENCE_BYTES} bytes.`,
    );
    retainedBytes += eventBytes;
    retained.push(event);
  };
  for (const event of events) {
    const { method, observedAt, params = {} } = event;
    if (method === 'Network.requestWillBeSent') {
      retain({
        documentURL: sanitizeCat05EvidenceUrl(params.documentURL),
        method,
        observedAt,
        requestId: sanitizeCat05DiagnosticText(params.requestId, { maxBytes: 256 }),
        requestMethod: sanitizeCat05DiagnosticText(params.request?.method, { maxBytes: 32 }),
        type: sanitizeCat05DiagnosticText(params.type, { maxBytes: 64 }),
        url: sanitizeCat05EvidenceUrl(params.request?.url),
      });
    } else if (method === 'Network.responseReceived') {
      retain({
        method,
        mimeType: sanitizeCat05DiagnosticText(params.response?.mimeType, { maxBytes: 128 }),
        observedAt,
        requestId: sanitizeCat05DiagnosticText(params.requestId, { maxBytes: 256 }),
        status: params.response?.status,
        type: sanitizeCat05DiagnosticText(params.type, { maxBytes: 64 }),
        url: sanitizeCat05EvidenceUrl(params.response?.url),
      });
    } else if (method === 'Network.loadingFailed') {
      if (
        params.canceled === true &&
        params.type === 'Document' &&
        params.errorText === 'net::ERR_ABORTED'
      ) {
        continue;
      }
      retain({
        canceled: params.canceled,
        errorText: sanitizeCat05DiagnosticText(params.errorText, { maxBytes: 1_000 }),
        method,
        observedAt,
        requestId: sanitizeCat05DiagnosticText(params.requestId, { maxBytes: 256 }),
        type: sanitizeCat05DiagnosticText(params.type, { maxBytes: 64 }),
      });
    } else if (method === 'Runtime.consoleAPICalled') {
      retain({
        method,
        observedAt,
        text: sanitizeCat05DiagnosticText(
          (params.args ?? [])
            .map((argument) => argument.value ?? argument.description ?? '')
            .join(' '),
          { maxBytes: 2_000 },
        ),
        type: sanitizeCat05DiagnosticText(params.type, { maxBytes: 64 }),
      });
    } else if (
      [
        'Inspector.targetCrashed',
        'Log.entryAdded',
        'Network.webSocketCreated',
        'Network.webSocketFrameError',
        'Page.crashed',
        'Page.javascriptDialogOpening',
        'Runtime.exceptionThrown',
      ].includes(method)
    ) {
      retain({ method, observedAt, params: sanitizeCat05DiagnosticValue(params) });
    }
  }
  return retained;
}

export function buildCat05BrowserEventEvidence(events) {
  const sanitizedEvents = sanitizeBrowserEvents(events);
  return {
    events: sanitizedEvents,
    retention: {
      ignoredEventCount: events.length - sanitizedEvents.length,
      inputEventCount: events.length,
      limits: {
        maxRetainedBytes: CAT05_MAX_BROWSER_EVENT_EVIDENCE_BYTES,
        maxRetainedEvents: CAT05_MAX_RETAINED_BROWSER_EVENTS,
      },
      retainedEventCount: sanitizedEvents.length,
      sanitizedBytes: Buffer.byteLength(JSON.stringify(sanitizedEvents), 'utf8'),
      truncated: false,
    },
  };
}

export function listCat05EvidenceArtifacts(evidenceDir) {
  const artifacts = [];
  const visit = (directory, relativeDirectory = '') => {
    const entries = readdirSync(directory, { withFileTypes: true }).sort((left, right) =>
      comparePaths(left.name, right.name),
    );
    for (const entry of entries) {
      const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolutePath, relativePath);
      else if (entry.isFile() && relativePath !== 'summary.json') artifacts.push(relativePath);
      else if (relativePath !== 'summary.json') {
        throw new Error(`CAT05 evidence contains a non-regular artifact: ${relativePath}.`);
      }
    }
  };
  visit(evidenceDir);
  return artifacts.sort(comparePaths);
}

function artifactPair(prefix) {
  return [`${prefix}.json`, `${prefix}.png`];
}

export function expectedCat05PassArtifacts() {
  const artifacts = ['report.md', 'scope.json'];
  for (const group of CAT05_FIXTURE_GROUPS) {
    const groupId = safeArtifactId(group.id);
    const bootstrapPrefix = safeArtifactId(
      `bootstrap-${group.id}-${CAT05_REQUIRED_VIEWPORTS[1].id}`,
    );
    artifacts.push(
      `browser-events-${groupId}.json`,
      `expo-${groupId}.log`,
      ...artifactPair(`${bootstrapPrefix}-ocr-ready`),
      `${bootstrapPrefix}-result.json`,
    );
  }
  for (const scenario of CAT05_SCENARIO_MATRIX) {
    for (const viewport of CAT05_REQUIRED_VIEWPORTS) {
      const prefix = safeArtifactId(`${scenario.id}-${viewport.id}`);
      artifacts.push(...artifactPair(`${prefix}-initial`), `${prefix}-result.json`);
      if (scenario.id === 'recognized-review-retake-continue') {
        artifacts.push(
          ...artifactPair(`${prefix}-recognized-ready`),
          ...artifactPair(`${prefix}-retake-ready`),
          ...artifactPair(`${prefix}-manual-handoff`),
        );
      } else if (scenario.id === 'edit-fence-suggestion-adoption') {
        artifacts.push(
          ...artifactPair(`${prefix}-edit-kept`),
          ...artifactPair(`${prefix}-suggestion-adopted`),
          ...artifactPair(`${prefix}-manual-handoff`),
        );
      } else {
        const stateSuffix = {
          'failure-manual-recovery': 'failed',
          'no-text-manual-recovery': 'no-text',
          'timeout-manual-recovery': 'timed-out',
        }[scenario.id];
        assert(stateSuffix, `Missing CAT05 artifact contract for ${scenario.id}.`);
        artifacts.push(
          ...artifactPair(`${prefix}-${stateSuffix}`),
          ...artifactPair(`${prefix}-manual-handoff`),
        );
      }
    }
  }
  return [...new Set(artifacts)].sort(comparePaths);
}

export function assertCat05PassArtifactSet(actualArtifacts) {
  const expectedArtifacts = expectedCat05PassArtifacts();
  const actual = [...actualArtifacts].sort(comparePaths);
  const missing = expectedArtifacts.filter((artifact) => !actual.includes(artifact));
  const unexpected = actual.filter((artifact) => !expectedArtifacts.includes(artifact));
  assert(
    missing.length === 0 && unexpected.length === 0,
    `CAT05 PASS artifact set mismatch; missing: ${missing.join(', ') || 'none'}; unexpected: ${unexpected.join(', ') || 'none'}.`,
  );
  return expectedArtifacts;
}

export function pruneCat05TransientFailureArtifacts(evidenceDir, actualArtifacts) {
  const absoluteEvidenceDir = path.resolve(evidenceDir);
  const expectedArtifacts = new Set(expectedCat05PassArtifacts());
  let removed = 0;
  for (const artifact of actualArtifacts) {
    if (expectedArtifacts.has(artifact) || !/-failure\.(?:json|png)$/u.test(artifact)) continue;
    const absolutePath = path.resolve(absoluteEvidenceDir, artifact);
    assert(
      absolutePath.startsWith(`${absoluteEvidenceDir}${path.sep}`),
      `CAT05 transient artifact escaped the evidence directory: ${artifact}.`,
    );
    rmSync(absolutePath, { force: true });
    removed += 1;
  }
  return removed;
}

export function buildCat05ArtifactManifest(evidenceDir, artifacts) {
  const absoluteEvidenceDir = path.resolve(evidenceDir);
  return artifacts.map((artifact) => {
    const absolutePath = path.resolve(absoluteEvidenceDir, artifact);
    assert(
      absolutePath.startsWith(`${absoluteEvidenceDir}${path.sep}`),
      `CAT05 artifact escaped the evidence directory: ${artifact}.`,
    );
    const stats = lstatSync(absolutePath);
    assert(
      stats.isFile() && !stats.isSymbolicLink(),
      `CAT05 artifact is not regular: ${artifact}.`,
    );
    const contents = readFileSync(absolutePath);
    return {
      bytes: statSync(absolutePath).size,
      path: artifact,
      sha256: sha256(contents),
    };
  });
}

function expectedCat05BindingMetadata(artifact) {
  const artifactName = artifact.replace(/\.json$/u, '');
  if (artifact === 'scope.json') return { artifactName: null };
  for (const scenario of CAT05_SCENARIO_MATRIX) {
    for (const viewport of CAT05_REQUIRED_VIEWPORTS) {
      const prefix = `${safeArtifactId(`${scenario.id}-${viewport.id}`)}-`;
      if (!artifactName.startsWith(prefix)) continue;
      return {
        artifactName,
        fixtureGroup: scenario.groupId,
        scenarioId: scenario.id,
        viewport: { height: viewport.height, id: viewport.id, width: viewport.width },
      };
    }
  }
  for (const group of CAT05_FIXTURE_GROUPS) {
    const bootstrapPrefix = `${safeArtifactId(
      `bootstrap-${group.id}-${CAT05_REQUIRED_VIEWPORTS[1].id}`,
    )}-`;
    if (artifactName.startsWith(bootstrapPrefix)) {
      const viewport = CAT05_REQUIRED_VIEWPORTS[1];
      return {
        artifactName,
        fixtureGroup: group.id,
        scenarioId: null,
        viewport: { height: viewport.height, id: viewport.id, width: viewport.width },
      };
    }
    if (artifactName === `browser-events-${safeArtifactId(group.id)}`) {
      return {
        artifactName,
        fixtureGroup: group.id,
        scenarioId: null,
        viewport: null,
      };
    }
  }
  throw new Error(`CAT05 has no binding contract for ${artifact}.`);
}

export function assertCat05ArtifactBindings(evidenceDir, artifacts, binding) {
  for (const artifact of artifacts.filter((candidate) => candidate.endsWith('.json'))) {
    let contents;
    try {
      contents = JSON.parse(readFileSync(path.join(evidenceDir, artifact), 'utf8'));
    } catch (error) {
      throw new Error(
        `CAT05 artifact is not valid bound JSON (${artifact}): ${error instanceof Error ? error.message : String(error)}.`,
      );
    }
    const actual = contents?.evidenceBinding;
    assert(actual && typeof actual === 'object', `CAT05 artifact has no binding: ${artifact}.`);
    for (const [key, expectedValue] of Object.entries(binding)) {
      assert(
        JSON.stringify(actual[key]) === JSON.stringify(expectedValue),
        `CAT05 artifact binding mismatch for ${artifact} (${key}).`,
      );
    }
    const expectedMetadata = expectedCat05BindingMetadata(artifact);
    if (expectedMetadata.artifactName === null) continue;
    for (const [key, expectedValue] of Object.entries(expectedMetadata)) {
      assert(
        JSON.stringify(actual[key]) === JSON.stringify(expectedValue),
        `CAT05 artifact binding mismatch for ${artifact} (${key}).`,
      );
    }
  }
  return true;
}

function assertCat05DiagnosticValueHygiene(value, label, seen = new WeakSet()) {
  if (typeof value === 'string') {
    const valueBytes = Buffer.byteLength(value, 'utf8');
    assert(
      valueBytes <= CAT05_MAX_DIAGNOSTIC_STRING_BYTES,
      `CAT05 diagnostic string exceeds ${CAT05_MAX_DIAGNOSTIC_STRING_BYTES} bytes (${label}).`,
    );
    const sanitized = sanitizeCat05DiagnosticText(value, {
      maxBytes: CAT05_MAX_DIAGNOSTIC_STRING_BYTES,
    });
    assert(sanitized === value, `CAT05 diagnostic hygiene violation (${label}).`);
    return;
  }
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      assertCat05DiagnosticValueHygiene(value[index], `${label}[${index}]`, seen);
    }
    return;
  }
  for (const [key, item] of Object.entries(value)) {
    assertCat05DiagnosticValueHygiene(key, `${label}.<key>`, seen);
    assertCat05DiagnosticValueHygiene(item, `${label}.${key}`, seen);
  }
}

export function assertCat05DiagnosticPacketHygiene(evidenceDir, artifacts, summary = null) {
  for (const artifact of artifacts) {
    if (artifact.endsWith('.png')) continue;
    const artifactPath = path.join(evidenceDir, artifact);
    const artifactBytes = statSync(artifactPath).size;
    const byteLimit = artifact.endsWith('.log')
      ? CAT05_MAX_EXPO_LOG_BYTES
      : CAT05_MAX_DIAGNOSTIC_ARTIFACT_BYTES;
    assert(
      artifactBytes <= byteLimit,
      `CAT05 diagnostic artifact exceeds ${byteLimit} bytes (${artifact}).`,
    );
    const contents = readFileSync(artifactPath, 'utf8');
    if (artifact.endsWith('.json')) {
      assertCat05DiagnosticValueHygiene(JSON.parse(contents), artifact);
    } else {
      assertCat05DiagnosticValueHygiene(contents, artifact);
    }
  }
  if (summary) assertCat05DiagnosticValueHygiene(summary, 'summary');
  return true;
}

function clearPreviousEvidence(evidenceDir) {
  const safeEvidenceDir = assertCat05EvidenceDirectory(evidenceDir);
  if (existsSync(safeEvidenceDir)) rmSync(safeEvidenceDir, { force: true, recursive: true });
  mkdirSync(safeEvidenceDir, { recursive: true });
}

function writeScope(evidenceDir, binding, privacySourceContract) {
  writeJson(evidenceDir, 'scope.json', {
    candidateNativeBuild: binding.candidateNativeBuild,
    evidenceKind: 'deterministic_expo_web_ocr_review_ui_state',
    evidenceSchemaVersion: binding.evidenceSchemaVersion,
    fixtureConfigurationSha256: binding.fixtureConfigurationSha256,
    nativeDeviceProof: false,
    proves: [
      'The Expo-web route renders and permits user interaction with the declared deterministic OCR review states.',
      'The route preserves a user edit against a late deterministic fixture result and requires explicit suggestion adoption.',
      'The route preserves the fixture Unicode transcript through the editable review and supported manual handoff surface.',
      'The supported web viewports pass the scripted control-name, 44px proxy, center-hit, clipping, and horizontal-overflow checks.',
      'The synthetic browser run emitted no disallowed console/page/network/dialog failure under the local-only fixture environment.',
      'The source candidate contains the declared no-cache preview, trusted-cache-URI, guarded-navigation, and awaited-cleanup assertions; this is source proof only.',
    ],
    doesNotProve: CAT05_AUDIT_LIMITATIONS.slice(1),
    evidenceBinding: binding,
    fixtureEnvironmentVariable: 'EXPO_PUBLIC_E2E_SHELF_OCR_RESULT',
    fixtureTranscript: CAT05_FIXTURE_TRANSCRIPT,
    privacySourceContract,
    runId: binding.runId,
    scenarioMatrix: CAT05_SCENARIO_MATRIX,
    scenarioMatrixSha256: binding.scenarioMatrixSha256,
    sourceGitSha: binding.sourceGitSha,
    surface: 'Expo web / headless Chromium / development-only deterministic fixture',
    viewportMatrix: CAT05_REQUIRED_VIEWPORTS,
    viewportMatrixSha256: binding.viewportMatrixSha256,
    webFixtureBuild: binding.webFixtureBuild,
  });
}

function writeReport(evidenceDir, summary) {
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
    ...CAT05_AUDIT_LIMITATIONS.map((limitation) => `- ${limitation}`),
    '',
    '## Run',
    '',
    `- Run ID: \`${summary.runId}\``,
    `- Source Git SHA: \`${summary.sourceGitSha}\``,
    `- Web fixture build ID: \`${summary.webFixtureBuild.buildId}\``,
    `- Web fixture profile: \`${summary.webFixtureBuild.profile}\``,
    `- Candidate source profile: \`${summary.candidateNativeBuild.profile}\``,
    `- Native EAS build ID: not applicable (this audit does not execute an iOS binary)`,
    `- Started: ${summary.startedAt}`,
    `- Completed: ${summary.completedAt}`,
    `- Surface: ${summary.surface}`,
    `- Browser: ${sanitizeCat05DiagnosticText(path.basename(summary.browserPath ?? 'unavailable'), { maxBytes: 256 })}`,
    `- Consent bootstraps: ${summary.passedBootstrapCount}/${summary.expectedBootstrapCount}`,
    `- Scenario executions: ${summary.passedExecutionCount}/${summary.expectedExecutionCount}`,
    `- Browser failures: ${summary.browserFailureCount}`,
    `- Native device proof: false`,
    '',
    '## Scenario Matrix',
    '',
    '| Scenario | Viewport | Result | Error |',
    '| --- | --- | --- | --- |',
    ...summary.results
      .filter(({ kind }) => kind === 'scenario')
      .map((result) => {
        const safeError = sanitizeCat05DiagnosticText(result.error ?? '', { maxBytes: 500 })
          .replace(/\s+/gu, ' ')
          .replace(/\|/g, '\\|');
        return `| ${result.scenarioId} | ${result.viewport.width}x${result.viewport.height} | ${result.verdict} | ${safeError} |`;
      }),
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
  writeFileSync(path.join(evidenceDir, 'report.md'), `${lines.join('\n')}\n`);
}

function recordGroupFailure(summary, group, error, binding) {
  const message = sanitizeCat05DiagnosticError(error);
  for (const scenario of CAT05_SCENARIO_MATRIX.filter(({ groupId }) => groupId === group.id)) {
    for (const viewport of CAT05_REQUIRED_VIEWPORTS) {
      summary.results.push({
        artifactPrefix: safeArtifactId(`${scenario.id}-${viewport.id}`),
        browserFailures: [],
        completedAt: new Date().toISOString(),
        evidenceBinding: cat05ArtifactBinding(binding, {
          artifactName: `${safeArtifactId(`${scenario.id}-${viewport.id}`)}-result`,
          fixtureGroup: group.id,
          scenarioId: scenario.id,
          viewport,
        }),
        error: `Fixture group ${group.id} failed before scenario execution: ${message}`,
        fixture: scenario.fixture,
        fixtureGroup: group.id,
        kind: 'scenario',
        nativeDeviceProof: false,
        scenarioId: scenario.id,
        startedAt: new Date().toISOString(),
        surface: 'expo-web-deterministic-ui-fixture',
        verdict: 'fail',
        viewport,
      });
    }
  }
}

function assertCat05AuditActive(signal) {
  assert(!signal?.aborted, 'CAT05 audit was aborted; refusing further evidence capture.');
}

export async function withAuditTimeout(operation, timeoutMs, label, onTimeout = async () => {}) {
  let timeout = null;
  const settledOperation = Promise.resolve(operation).then(
    (value) => ({ status: 'fulfilled', value }),
    (reason) => ({ reason, status: 'rejected' }),
  );
  const timeoutPromise = new Promise((resolve) => {
    timeout = setTimeout(() => {
      const error = new Error(`${label} timed out after ${timeoutMs}ms.`);
      error.code = 'CAT05_OPERATION_TIMEOUT';
      const cleanup = Promise.resolve().then(onTimeout);
      resolve({ cleanup, error, status: 'timed_out' });
    }, timeoutMs);
  });
  try {
    const first = await Promise.race([settledOperation, timeoutPromise]);
    if (first.status === 'fulfilled') return first.value;
    if (first.status === 'rejected') throw first.reason;

    try {
      await first.cleanup;
    } catch (cleanupError) {
      first.error.cause = cleanupError;
    }
    // Never return from a timeout while the losing audit can still spawn or write.
    await settledOperation;
    throw first.error;
  } finally {
    clearTimeout(timeout);
  }
}

function assertCat05ProcessRunning(child, label) {
  assert(cat05ChildRunning(child), `${label} exited during CAT05 evidence capture.`);
}

export async function runCat05NativeOcrUiAudit({
  evidenceDir = path.join(repoRoot, CAT05_EVIDENCE_RELATIVE_DIR),
  environment = process.env,
  signal,
} = {}) {
  evidenceDir = assertCat05EvidenceDirectory(evidenceDir);
  // Clear before every trust check so a refused run cannot leave a stale PASS packet behind.
  clearPreviousEvidence(evidenceDir);
  assertCat05AuditActive(signal);
  const configuration = validateCat05AuditConfiguration();
  const binding = resolveCat05AuditBinding({ environment });
  assertCat05SourceBinding({ expectedSourceGitSha: binding.sourceGitSha });
  const privacySourceContract = assertCat05PrivacySourceContract();
  writeScope(evidenceDir, binding, privacySourceContract);

  const summary = {
    artifactCount: 0,
    artifactManifest: [],
    artifacts: [],
    browserFailureCount: 0,
    browserPath: null,
    candidateNativeBuild: binding.candidateNativeBuild,
    completedAt: null,
    evidenceBinding: binding,
    evidenceSchemaVersion: binding.evidenceSchemaVersion,
    expectedBootstrapCount: CAT05_FIXTURE_GROUPS.length,
    expectedExecutionCount: configuration.executionCount,
    fixtureGroups: CAT05_FIXTURE_GROUPS.map(({ id }) => id),
    groupBrowserAudits: [],
    limitations: CAT05_AUDIT_LIMITATIONS,
    nativeDeviceProof: false,
    passedBootstrapCount: 0,
    passedExecutionCount: 0,
    privacySourceContract,
    results: [],
    runId: binding.runId,
    scenarioMatrix: CAT05_SCENARIO_MATRIX,
    sourceGitSha: binding.sourceGitSha,
    startedAt: new Date().toISOString(),
    surface: 'Expo web / deterministic development-only OCR review fixture',
    verdict: 'fail',
    viewports: CAT05_REQUIRED_VIEWPORTS,
    webFixtureBuild: binding.webFixtureBuild,
  };

  let browserExecutablePath = null;
  try {
    browserExecutablePath = findBrowserPath();
    summary.browserPath = path.basename(browserExecutablePath);
    for (let groupIndex = 0; groupIndex < CAT05_FIXTURE_GROUPS.length; groupIndex += 1) {
      assertCat05AuditActive(signal);
      assertCat05SourceBinding({ expectedSourceGitSha: binding.sourceGitSha });
      const group = CAT05_FIXTURE_GROUPS[groupIndex];
      let browser = null;
      let client = null;
      let expo = null;
      let userDataDir = null;
      try {
        const appPort = await findAvailablePort(8620 + groupIndex * 20);
        const debugPort = await findAvailablePort(9620 + groupIndex * 20);
        const baseUrl = `http://localhost:${appPort}`;
        assertCat05LocalTarget(baseUrl, { expectedPort: appPort });
        userDataDir = mkdtempSync(
          path.join(tmpdir(), `cat05-browser-${safeArtifactId(group.id)}-`),
        );
        expo = startExpoServer({ appPort, evidenceDir, group });
        await waitForUrl(baseUrl, 180_000, signal);
        assertCat05ProcessRunning(expo, `Expo fixture ${group.id}`);
        browser = startBrowser({ browserPath: browserExecutablePath, debugPort, userDataDir });
        await readJson(
          `http://127.0.0.1:${debugPort}/json/version`,
          debugPort,
          CAT05_BROWSER_DEBUG_READY_TIMEOUT_MS,
          signal,
        );
        assertCat05ProcessRunning(browser, `Browser fixture ${group.id}`);
        client = await connectToPage(debugPort, baseUrl, signal);
        await client.send('Page.enable');
        await client.send('Runtime.enable');
        await client.send('Log.enable');
        await client.send('Network.enable');

        const bootstrap = await establishLocalHealthConsent({
          baseUrl,
          binding,
          client,
          evidenceDir,
          groupId: group.id,
        });
        summary.results.push(bootstrap);
        if (bootstrap.verdict !== 'pass') {
          throw new Error(
            `Explicit-consent bootstrap failed for fixture ${group.id}: ${bootstrap.error}`,
          );
        }

        for (const scenario of CAT05_SCENARIO_MATRIX.filter(
          ({ groupId }) => groupId === group.id,
        )) {
          for (const viewport of CAT05_REQUIRED_VIEWPORTS) {
            assertCat05AuditActive(signal);
            assertCat05SourceBinding({ expectedSourceGitSha: binding.sourceGitSha });
            summary.results.push(
              await runScenario({ baseUrl, binding, client, evidenceDir, scenario, viewport }),
            );
            assertCat05SourceBinding({ expectedSourceGitSha: binding.sourceGitSha });
          }
        }
        await waitForNetworkIdle(client);
        await delay(300);
        assertCat05ProcessRunning(expo, `Expo fixture ${group.id}`);
        assertCat05ProcessRunning(browser, `Browser fixture ${group.id}`);
        client.assertEvidenceBudget();
        const groupBrowserFailures = sanitizeCat05BrowserFailures(
          classifyCat05BrowserFailures(client.events, baseUrl),
        );
        summary.groupBrowserAudits.push({
          browserFailures: groupBrowserFailures,
          evidenceBinding: cat05ArtifactBinding(binding, {
            artifactName: `browser-events-${safeArtifactId(group.id)}`,
            fixtureGroup: group.id,
            scenarioId: null,
            viewport: null,
          }),
          fixtureGroup: group.id,
        });
        assert(
          groupBrowserFailures.length === 0,
          `Fixture group ${group.id} emitted ${groupBrowserFailures.length} browser failure(s).`,
        );
        writeJson(evidenceDir, `browser-events-${safeArtifactId(group.id)}.json`, {
          evidenceBinding: cat05ArtifactBinding(binding, {
            artifactName: `browser-events-${safeArtifactId(group.id)}`,
            fixtureGroup: group.id,
            scenarioId: null,
            viewport: null,
          }),
          ...buildCat05BrowserEventEvidence(client.events),
        });
      } catch (error) {
        writeCat05BrowserFailureLog(evidenceDir, group.id, browser?.cat05BrowserLogCapture);
        const alreadyRecorded = summary.results.some(
          (result) => result.fixtureGroup === group.id && result.kind === 'scenario',
        );
        if (!alreadyRecorded) recordGroupFailure(summary, group, error, binding);
        summary.fatalError ??= sanitizeCat05DiagnosticError(error);
      } finally {
        client?.close();
        await stopProcessBestEffort(browser);
        await stopProcessBestEffort(expo);
        sanitizeCat05ExpoFixtureLog(evidenceDir, group.id, expo?.cat05ExpoLogCapture);
        await removeCat05BrowserUserDataDirBestEffort(userDataDir);
      }
    }
  } catch (error) {
    summary.fatalError = sanitizeCat05DiagnosticError(error);
  }

  try {
    await stopActiveCat05Processes();
    assertCat05AuditActive(signal);
    assertCat05SourceBinding({ expectedSourceGitSha: binding.sourceGitSha });
  } catch (error) {
    summary.fatalError ??= sanitizeCat05DiagnosticError(error);
  }

  const bootstrapResults = summary.results.filter(({ kind }) => kind === 'consent-bootstrap');
  const scenarioResults = summary.results.filter(({ kind }) => kind === 'scenario');
  summary.completedAt = new Date().toISOString();
  summary.passedBootstrapCount = bootstrapResults.filter(
    ({ verdict }) => verdict === 'pass',
  ).length;
  summary.passedExecutionCount = scenarioResults.filter(({ verdict }) => verdict === 'pass').length;
  summary.browserFailureCount =
    summary.results.reduce((count, result) => count + (result.browserFailures?.length ?? 0), 0) +
    summary.groupBrowserAudits.reduce(
      (count, result) => count + (result.browserFailures?.length ?? 0),
      0,
    );
  summary.verdict =
    summary.passedBootstrapCount === summary.expectedBootstrapCount &&
    summary.passedExecutionCount === summary.expectedExecutionCount &&
    summary.browserFailureCount === 0 &&
    !summary.fatalError
      ? 'pass'
      : 'fail';
  writeReport(evidenceDir, summary);
  summary.artifacts = listCat05EvidenceArtifacts(evidenceDir);
  if (summary.verdict === 'pass') {
    try {
      pruneCat05TransientFailureArtifacts(evidenceDir, summary.artifacts);
      summary.artifacts = listCat05EvidenceArtifacts(evidenceDir);
      assertCat05PassArtifactSet(summary.artifacts);
      assertCat05ArtifactBindings(evidenceDir, summary.artifacts, binding);
      assertCat05DiagnosticPacketHygiene(evidenceDir, summary.artifacts, summary);
    } catch (error) {
      summary.fatalError = sanitizeCat05DiagnosticError(error);
      summary.verdict = 'fail';
      writeReport(evidenceDir, summary);
      summary.artifacts = listCat05EvidenceArtifacts(evidenceDir);
    }
  }
  summary.artifactCount = summary.artifacts.length;
  summary.artifactManifest = buildCat05ArtifactManifest(evidenceDir, summary.artifacts);
  summary.screenshots = summary.artifacts.filter((artifact) => artifact.endsWith('.png'));
  writeJson(evidenceDir, 'summary.json', summary);

  if (summary.verdict !== 'pass') {
    throw new Error(
      `CAT05 deterministic web UI audit failed: ${summary.passedExecutionCount}/${summary.expectedExecutionCount} scenarios and ${summary.passedBootstrapCount}/${summary.expectedBootstrapCount} bootstraps passed. See ${path.relative(repoRoot, evidenceDir)}.`,
    );
  }
  return summary;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(scriptPath)) {
  const controller = new AbortController();
  withAuditTimeout(
    runCat05NativeOcrUiAudit({ signal: controller.signal }),
    20 * 60_000,
    'CAT05 web UI audit',
    async () => {
      controller.abort();
      await stopActiveCat05Processes();
    },
  ).then(
    (summary) => {
      process.stdout.write(
        `PASS CAT05 deterministic Expo-web OCR review UI audit: ${summary.passedExecutionCount}/${summary.expectedExecutionCount} scenario executions; nativeDeviceProof=false.\n`,
      );
    },
    (error) => {
      process.stderr.write(
        `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
      );
      process.exitCode = 1;
    },
  );
}
