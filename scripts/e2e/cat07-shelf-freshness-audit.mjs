import { execFileSync, spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  readlinkSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  rmdirSync,
  watch,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

import {
  assertDisabledControl,
  assertInteractiveControl,
  assertSnapshotClean,
  auditExpression,
  cat04ServerEnvironment,
  clickByText,
  enabledControlExpression,
  evaluate,
  fillByLabel,
  findAvailablePort,
  listEvidenceArtifacts,
  navigate,
  safeArtifactId,
  sanitizeCat04DiagnosticText,
  scrollControlIntoView,
  scrollTextIntoView,
  setViewport,
  stopProcessBestEffort,
  waitForCondition,
  waitForNetworkIdle,
  waitForPath,
  waitForText,
} from './cat04-catalog-recovery-audit.mjs';
import {
  assertCat07CaptureMarker,
  buildCat07CaptureMarkerRgba,
  decodeStrictCat07Png,
  CAT07_CAPTURE_MARKER_SIZE,
} from './cat07-png-contract.mjs';
import {
  canonicalEvidenceJsonBytes,
  collectEvidenceDiagnosticValueFailures,
  collectEvidenceTextArtifactHygieneFailures,
  inspectCanonicalEvidenceJson,
  readBoundedRegularFile,
  sanitizeEvidenceDiagnosticForDisplay,
} from './evidence-diagnostic-hygiene.mjs';

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

export const CAT07_EVIDENCE_RELATIVE_DIR =
  'test-results/human-e2e/2026-08-06/cat07-shelf-freshness-current';
const CAT07_EVIDENCE_DIRECTORY = path.resolve(repoRoot, CAT07_EVIDENCE_RELATIVE_DIR);
export const CAT07_EVIDENCE_SCHEMA_VERSION = 2;
const CAT07_GIT_SHA = /^[0-9a-f]{40}$/u;
export const CAT07_RUN_ID =
  /^cat07-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const CAT07_MAX_DIAGNOSTIC_ARTIFACT_BYTES = 8 * 1024 * 1024;
const CAT07_MAX_RUNTIME_FILE_BYTES = 256 * 1024 * 1024;
const CAT07_MAX_RUNTIME_TREE_BYTES = 3 * 1024 * 1024 * 1024;
const CAT07_MAX_RUNTIME_TREE_ENTRIES = 200_000;
const CAT07_MAX_SOURCE_FILE_BYTES = 32 * 1024 * 1024;
const CAT07_MAX_SOURCE_TREE_BYTES = 512 * 1024 * 1024;
const CAT07_MAX_SOURCE_TREE_ENTRIES = 20_000;
export const CAT07_RUNTIME_PROVENANCE_SCHEMA_VERSION = 1;
export const CAT07_CHILD_ENVIRONMENT_SCHEMA_VERSION = 1;
export const CAT07_ENVIRONMENT_BOOTSTRAP_SCHEMA_VERSION = 1;
export const CAT07_BROWSER_LAUNCH_SCHEMA_VERSION = 1;
const CAT07_MAX_EXPO_LOG_BYTES = 256 * 1024;
const CAT07_MAX_DIAGNOSTIC_STRING_BYTES = 128 * 1024;
export const CAT07_MAX_INPUT_CDP_FRAMES = 20_000;
export const CAT07_MAX_INPUT_CDP_BYTES = 16 * 1024 * 1024;
export const CAT07_MAX_INPUT_BROWSER_EVENTS = CAT07_MAX_INPUT_CDP_FRAMES;
export const CAT07_MAX_INPUT_BROWSER_EVENT_BYTES = CAT07_MAX_INPUT_CDP_BYTES;
export const CAT07_MAX_CDP_FRAME_BYTES = 4 * 1024 * 1024;
export const CAT07_MAX_RETAINED_BROWSER_EVENTS = 5_000;
export const CAT07_MAX_BROWSER_EVENT_BYTES = 4 * 1024 * 1024;
export const CAT07_BROWSER_EVIDENCE_SCHEMA_VERSION = 2;

export const CAT07_REQUIRED_VIEWPORTS = Object.freeze([
  Object.freeze({ id: 'iphone-375x667', width: 375, height: 667 }),
  Object.freeze({ id: 'iphone-390x844', width: 390, height: 844 }),
  Object.freeze({ id: 'iphone-430x932', width: 430, height: 932 }),
]);
const CAT07_CAPTURE_STEP_IDS = Object.freeze([
  '01-manual',
  '02-opening-required',
  '03-future-opened-date-blocked',
  '04-label-pao-ready',
  '05-shelf-countdown',
  '06-label-pao-detail',
  '07-package-date-recorded',
  '08-replacement-choices',
  '09-future-replacement-date-blocked',
  '10-unopened-replacement-shelf',
  '11-unopened-replacement-detail',
  '12-unknown-excluded-from-expiring',
  '13-archive-history',
  '14-archived-provenance',
]);
export const CAT07_CAPTURE_BINDING_SCHEMA_VERSION = 1;
export const CAT07_CAPTURE_ARTIFACT_ORDER = Object.freeze(
  CAT07_REQUIRED_VIEWPORTS.flatMap((viewport) => [
    `bootstrap-cat07-freshness-${viewport.id}-catalog-ready.png`,
    ...CAT07_CAPTURE_STEP_IDS.map((step) => `freshness-lifecycle-${viewport.id}-${step}.png`),
  ]),
);
const CAT07_SCREENSHOT_DIMENSIONS = new Map();
for (const viewport of CAT07_REQUIRED_VIEWPORTS) {
  const dimensions = Object.freeze({
    height: viewport.height,
    viewportId: viewport.id,
    width: viewport.width,
  });
  const bootstrapPrefix = `bootstrap-cat07-freshness-${viewport.id}`;
  const scenarioPrefix = `freshness-lifecycle-${viewport.id}`;
  CAT07_SCREENSHOT_DIMENSIONS.set(`${bootstrapPrefix}-catalog-ready.png`, dimensions);
  CAT07_SCREENSHOT_DIMENSIONS.set(`${bootstrapPrefix}-failure.png`, dimensions);
  CAT07_SCREENSHOT_DIMENSIONS.set(`${scenarioPrefix}-failure.png`, dimensions);
  for (const step of CAT07_CAPTURE_STEP_IDS) {
    CAT07_SCREENSHOT_DIMENSIONS.set(`${scenarioPrefix}-${step}.png`, dimensions);
  }
}

export const CAT07_AUDIT_LIMITATIONS = Object.freeze([
  'This is deterministic Expo-web UI-state evidence produced by development-only local fixtures.',
  'It proves neither native encrypted storage nor an iOS binary, physical-iPhone relaunch, notifications, VoiceOver, Dynamic Type, Reduce Motion, hosted RLS, live catalog truth, or migration execution.',
  'It does not approve category estimates; category_default remains unavailable and non-actionable.',
  'It does not provide cosmetic-chemistry, privacy, security, legal, App Review, production, market, or revenue approval.',
  'The evidence run verifies committed Git blobs, performs a clean offline lockfile install, and hashes the installed dependency tree, but it is not a reproducible-build or operating-system attestation and still trusts the recorded host tool executables and their installations.',
]);

export const CAT07_VERIFIED_OUTCOMES = Object.freeze([
  'Manual Shelf intake requires an explicit opening state before save.',
  'A future opened date is rejected and cannot enable save.',
  'A user-confirmed label PAO remains source-labelled and drives freshness only after opening.',
  'A package date is user-recorded from the exact package and can become the earlier winning freshness candidate.',
  'Replacement exposes today, exact-past-date, and unopened choices without assuming an opening state.',
  'A future replacement date is rejected.',
  'Replacement archives the prior package, creates a distinct active identity, preserves PAO provenance, and clears package-specific dates.',
  'The new unopened package has no PAO clock and stays out of the Expiring filter.',
  'The archived package retains its recorded opening, label PAO, and printed-package provenance.',
  'Every captured supported viewport has no horizontal overflow, visible sub-44 control, clipped visible control, or blocked center hit target.',
]);

const CAT07_FIXTURE_GROUP = Object.freeze({
  env: Object.freeze({
    EXPO_PUBLIC_NATIVE_CAMERA_ENABLED: 'false',
    EXPO_PUBLIC_NATIVE_OCR_ENABLED: 'false',
  }),
  id: 'cat07-freshness',
});

const CAT07_DECLARED_OUTPUT_PATTERNS = Object.freeze([
  /^\.tmp(?:\/|$)/u,
  new RegExp(`^${CAT07_EVIDENCE_RELATIVE_DIR.replace(/[.*+?^\${}()|[\]\\]/g, '\\$&')}(?:/|$)`, 'u'),
]);

const CAT07_SOURCE_PATHS = Object.freeze({
  catalogClient: 'apps/mobile/src/features/catalog/client.ts',
  detailRoute: 'apps/mobile/src/app/shelf/[id].tsx',
  freshness: 'apps/mobile/src/features/shelf/freshness.ts',
  openedRoute: 'apps/mobile/src/app/shelf/opened.tsx',
  replenishRoute: 'apps/mobile/src/app/shelf/replenish.tsx',
  shelfRoute: 'apps/mobile/src/app/(tabs)/shelf.tsx',
  store: 'apps/mobile/src/features/shelf/store.ts',
});
const CAT07_EXPO_ENV_PATH = 'apps/mobile/expo-env.d.ts';
const CAT07_OPTIONAL_GENERATED_SOURCE_FILES = new Map([
  [
    CAT07_EXPO_ENV_PATH,
    Buffer.from(
      '/// <reference types="expo/types" />\n\n' +
        '// NOTE: This file should not be edited and should be in your git ignore',
      'utf8',
    ),
  ],
]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function writeCat07Json(evidenceDir, name, value) {
  writeCat07EvidenceArtifact(evidenceDir, name, canonicalEvidenceJsonBytes(value));
}

export function validateCat07ScreenshotArtifact(artifact, bytes, { runId = null } = {}) {
  const expected = CAT07_SCREENSHOT_DIMENSIONS.get(artifact);
  assert(expected, `CAT07 screenshot is outside the governed capture inventory: ${artifact}`);
  const decoded = decodeStrictCat07Png(bytes);
  assert(
    decoded.width === expected.width && decoded.height === expected.height,
    `CAT07 screenshot ${artifact} dimensions must be ${expected.width} x ${expected.height}, received ${decoded.width} x ${decoded.height}`,
  );
  assert(CAT07_RUN_ID.test(String(runId ?? '')), 'CAT07 screenshot requires its canonical runId.');
  assertCat07CaptureMarker(decoded, {
    artifact,
    runId,
    viewportId: expected.viewportId,
  });
  return decoded;
}

export function cat07BrowserMarker(runId, viewportId, step) {
  assert(CAT07_RUN_ID.test(runId), 'CAT07 marker requires a canonical runId.');
  assert(
    CAT07_REQUIRED_VIEWPORTS.some(({ id }) => id === viewportId),
    'CAT07 marker requires a reviewed viewport.',
  );
  assert(
    ['bootstrap', 'consent-probe', 'manual', 'persisted-shelf'].includes(step),
    'CAT07 marker requires a reviewed step.',
  );
  return `cat07:${runId}:${viewportId}:${step}`;
}

function normalizeRepoPath(value) {
  return String(value).replace(/\\/gu, '/').replace(/^\.\//u, '');
}

function comparePaths(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

export function collectCat07UndeclaredDirtyPaths(statusOutput) {
  const text = Buffer.isBuffer(statusOutput)
    ? statusOutput.toString('utf8')
    : String(statusOutput ?? '');
  if (text.length === 0) return [];
  assert(text.endsWith('\0'), 'CAT07 Git status must be NUL-terminated porcelain v1 output.');

  const fields = text.split('\0');
  fields.pop();
  const paths = [];
  for (let index = 0; index < fields.length; index += 1) {
    const record = fields[index];
    assert(
      record.length >= 4 && record[2] === ' ' && /^[ MADRCU?!]{2}$/u.test(record.slice(0, 2)),
      'CAT07 Git status contains a malformed porcelain v1 record.',
    );
    const status = record.slice(0, 2);
    const destinationOrPath = record.slice(3);
    assert(destinationOrPath.length > 0, 'CAT07 Git status contains an empty path.');
    paths.push(destinationOrPath);

    if (/[RC]/u.test(status)) {
      index += 1;
      const sourcePath = fields[index];
      assert(
        typeof sourcePath === 'string' && sourcePath.length > 0,
        'CAT07 Git status contains a truncated rename/copy record.',
      );
      paths.push(sourcePath);
    }
  }

  return [...new Set(paths.map(normalizeRepoPath))]
    .filter(Boolean)
    .filter(
      (candidate) => !CAT07_DECLARED_OUTPUT_PATTERNS.some((pattern) => pattern.test(candidate)),
    )
    .sort(comparePaths);
}

export function assertCat07SourceProvenance({
  expectedSourceGitSha = process.env.CAT07_EXPECTED_SOURCE_GIT_SHA?.trim().toLowerCase() ?? null,
  gitEnvironment = null,
  gitExecutable = null,
  statusText,
} = {}) {
  const selectedGitExecutable = gitExecutable ?? findCat07GitExecutable();
  const selectedGitEnvironment = gitEnvironment ?? cat07GitEnvironment(selectedGitExecutable);
  const gitBinding = cat07ExecutableBinding(selectedGitExecutable);
  const sourceGitSha = execFileSync(
    selectedGitExecutable,
    ['-c', `safe.directory=${path.resolve(repoRoot)}`, 'rev-parse', 'HEAD'],
    {
      cwd: repoRoot,
      encoding: 'utf8',
      env: selectedGitEnvironment,
      maxBuffer: 256 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 30_000,
      windowsHide: true,
    },
  ).trim();
  assert(CAT07_GIT_SHA.test(sourceGitSha), 'CAT07 could not resolve one full lowercase HEAD SHA.');
  const rawStatus =
    statusText ??
    execFileSync(
      selectedGitExecutable,
      [
        '-c',
        `safe.directory=${path.resolve(repoRoot)}`,
        'status',
        '--porcelain=v1',
        '-z',
        '--untracked-files=all',
      ],
      {
        cwd: repoRoot,
        encoding: 'utf8',
        env: selectedGitEnvironment,
        maxBuffer: 16 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 30_000,
        windowsHide: true,
      },
    );
  const undeclared = collectCat07UndeclaredDirtyPaths(rawStatus);
  assertCat07ExecutableBindingStable(gitBinding);
  assert(
    undeclared.length === 0,
    `CAT07 evidence requires committed source; undeclared dirty paths: ${undeclared.join(', ')}`,
  );
  if (expectedSourceGitSha) {
    assert(
      CAT07_GIT_SHA.test(expectedSourceGitSha),
      'CAT07_EXPECTED_SOURCE_GIT_SHA must be a lowercase full 40-character Git SHA.',
    );
    assert(
      expectedSourceGitSha === sourceGitSha,
      `CAT07 expected source ${expectedSourceGitSha}, but HEAD is ${sourceGitSha}.`,
    );
  }
  return sourceGitSha;
}

export function assertCat07FinalSourceProvenance(sourceGitSha, options = {}) {
  const finalSourceGitSha = assertCat07SourceProvenance({
    ...options,
    expectedSourceGitSha: sourceGitSha,
  });
  assert(
    finalSourceGitSha === sourceGitSha,
    'CAT07 source provenance changed during the evidence run.',
  );
  return finalSourceGitSha;
}

function readSource(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

export function assertCat07SourceSafetyContract(
  sourceByPath = Object.fromEntries(
    Object.entries(CAT07_SOURCE_PATHS).map(([key, relativePath]) => [
      key,
      readSource(relativePath),
    ]),
  ),
) {
  const { catalogClient, detailRoute, freshness, openedRoute, replenishRoute, shelfRoute, store } =
    sourceByPath;
  assert(
    /PAO_SOURCES[^\n]+['"]category_default['"]/u.test(freshness) &&
      /candidatePaoSource === ['"]category_default['"]/u.test(freshness) &&
      /if \(computed\.source === ['"]unknown['"]\) return ['"]unknown['"]/u.test(freshness),
    'CAT07 freshness must retain reserved estimate vocabulary while failing unsupported evidence closed.',
  );
  assert(
    /PRODUCT_SPECIFIC_PAO_SOURCES/u.test(catalogClient) &&
      /productSpecific\.length !== 1/u.test(catalogClient) &&
      /return \{ months: null, source: ['"]unknown['"] \}/u.test(catalogClient) &&
      /expiryDate: null/u.test(catalogClient),
    'CAT07 catalog intake must keep category-only freshness unavailable.',
  );
  assert(
    /mode != null/u.test(openedRoute) &&
      /mode === ['"]unopened['"]/u.test(openedRoute) &&
      /Choose the state that matches this package/u.test(openedRoute),
    'CAT07 intake must require an explicit package opening state.',
  );
  assert(
    /const replacementId = operationId/u.test(store) &&
      /expiryDate:\s*null/u.test(store) &&
      /legacyUnverifiedExpiryDate:\s*null/u.test(store) &&
      /replacesProductId:\s*prev\.id/u.test(store),
    'CAT07 replacement must create a distinct operation identity and clear package dates.',
  );
  assert(
    /New unit is unopened/u.test(replenishRoute) &&
      /No PAO clock; add a printed date from the pack later/u.test(replenishRoute) &&
      /No urgency is added/u.test(replenishRoute),
    'CAT07 replacement UI must preserve explicit unopened and claim-safe no-urgency copy.',
  );
  assert(
    /not tied to this exact package/u.test(detailRoute) &&
      /not used for freshness\s+reminders/u.test(detailRoute),
    'CAT07 detail must quarantine ambiguous historical catalog-linked dates.',
  );
  assert(
    /i\.badge\.kind === ['"]countdown['"] \|\| i\.badge\.kind === ['"]expired['"]/u.test(
      shelfRoute,
    ) && /Nothing needs replacing right now/u.test(shelfRoute),
    'CAT07 Expiring filter must exclude unknown and reserved estimate states.',
  );
  return true;
}

export function validateCat07AuditConfiguration() {
  assert(
    JSON.stringify(CAT07_REQUIRED_VIEWPORTS.map(({ width, height }) => `${width}x${height}`)) ===
      JSON.stringify(['375x667', '390x844', '430x932']),
    'CAT07 must cover the full supported Expo-web viewport matrix.',
  );
  assert(
    new Set(CAT07_REQUIRED_VIEWPORTS.map(({ id }) => id)).size === CAT07_REQUIRED_VIEWPORTS.length,
    'CAT07 viewport IDs must be unique.',
  );
  assert(CAT07_VERIFIED_OUTCOMES.length === 10, 'CAT07 outcome contract is incomplete.');
  assert(CAT07_AUDIT_LIMITATIONS.length >= 4, 'CAT07 evidence limitations are incomplete.');
  return {
    executionCount: CAT07_REQUIRED_VIEWPORTS.length,
    viewportCount: CAT07_REQUIRED_VIEWPORTS.length,
  };
}

function localDatePlusDays(days) {
  const now = new Date();
  const candidate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
  const year = String(candidate.getFullYear()).padStart(4, '0');
  const month = String(candidate.getMonth() + 1).padStart(2, '0');
  const day = String(candidate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function cat07BoundedIdentifier(value, maxLength = 256) {
  return typeof value === 'string' &&
    value.length > 0 &&
    value.length <= maxLength &&
    /^[A-Za-z0-9._:-]+$/u.test(value)
    ? value
    : null;
}

function cat07PlainRecord(value) {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) return null;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null ? value : null;
}

function isReviewedCat07NavigationMarker(key, value, runId) {
  if (typeof value !== 'string') return false;
  const prefix = `cat07:${runId}:`;
  if (!value.startsWith(prefix) || value.length > 160) return false;
  const remainder = value.slice(prefix.length);
  const separator = remainder.lastIndexOf(':');
  if (separator <= 0) return false;
  const viewportId = remainder.slice(0, separator);
  const step = remainder.slice(separator + 1);
  if (!CAT07_REQUIRED_VIEWPORTS.some(({ id }) => id === viewportId)) return false;
  if (key === 'cat04Bootstrap') return step === 'bootstrap';
  if (key === 'cat04ConsentProbe') return step === 'consent-probe';
  if (key === 'cat04Audit') return ['manual', 'persisted-shelf'].includes(step);
  return false;
}

function hasCanonicalUniqueSearch(parsed) {
  const pairs = [...parsed.searchParams];
  const keys = pairs.map(([key]) => key);
  return (
    new Set(keys).size === keys.length &&
    parsed.search === (pairs.length > 0 ? `?${new URLSearchParams(pairs).toString()}` : '')
  );
}

function isReviewedCat07NetworkSearch(parsed, runId) {
  if (parsed.search.length === 0) return true;
  if (!hasCanonicalUniqueSearch(parsed)) return false;
  const pairs = [...parsed.searchParams];
  const keys = pairs.map(([key]) => key);
  const value = (key) => parsed.searchParams.get(key);

  if (
    pairs.length === 2 &&
    keys[0] === 'e2eReset' &&
    value('e2eReset') === 'local' &&
    keys[1] === 'cat04Bootstrap' &&
    isReviewedCat07NavigationMarker('cat04Bootstrap', value('cat04Bootstrap'), runId)
  ) {
    return true;
  }
  if (
    pairs.length === 1 &&
    ['cat04Audit', 'cat04ConsentProbe'].includes(keys[0]) &&
    isReviewedCat07NavigationMarker(keys[0], value(keys[0]), runId)
  ) {
    return true;
  }
  if (
    pairs.length === 1 &&
    ((parsed.pathname === '/shelf/opened' && keys[0] === 'intakeId') ||
      (parsed.pathname === '/shelf/replenish' && keys[0] === 'id')) &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(pairs[0][1])
  ) {
    return true;
  }
  if (/\.bundle$|\.map$/u.test(parsed.pathname)) {
    const reviewedOrder = [
      'platform',
      'dev',
      'hot',
      'lazy',
      'inlineSourceMap',
      'minify',
      'transform.engine',
      'transform.bytecode',
      'transform.asyncRoutes',
      'transform.preserveEnvVars',
      'transform.routerRoot',
      'transform.reactCompiler',
      'resolver.environment',
      'transform.environment',
      'serializer.splitChunks',
      'serializer.usedExports',
      'transform.optimize',
      'serializer.output',
      'serializer.map',
      'unstable_transformProfile',
      'modulesOnly',
      'runModule',
      'transform.liveBindings',
    ];
    if (
      keys.length < 3 ||
      keys[0] !== 'platform' ||
      keys[1] !== 'dev' ||
      keys[2] !== 'hot' ||
      keys.some(
        (key, index) =>
          !reviewedOrder.includes(key) ||
          (index > 0 && reviewedOrder.indexOf(key) <= reviewedOrder.indexOf(keys[index - 1])),
      )
    ) {
      return false;
    }
    const reviewedValues = {
      dev: ['true'],
      hot: ['false'],
      inlineSourceMap: ['true'],
      lazy: ['true'],
      minify: ['true'],
      modulesOnly: ['false', 'true'],
      platform: ['web'],
      'resolver.environment': ['client'],
      runModule: ['false', 'true'],
      'serializer.map': ['true'],
      'serializer.output': ['static'],
      'serializer.splitChunks': ['true'],
      'serializer.usedExports': ['true'],
      'transform.asyncRoutes': ['true'],
      'transform.bytecode': ['1'],
      'transform.engine': ['hermes'],
      'transform.environment': ['client'],
      'transform.liveBindings': ['false'],
      'transform.optimize': ['true'],
      'transform.preserveEnvVars': ['true'],
      'transform.reactCompiler': ['true'],
      'transform.routerRoot': ['app'],
      unstable_transformProfile: ['hermes-stable'],
    };
    return pairs.every(([key, item]) => reviewedValues[key]?.includes(item));
  }
  if (parsed.pathname === '/hot') {
    return (
      pairs.length === 2 &&
      keys[0] === 'bundleEntry' &&
      /^[A-Za-z0-9_./@-]{1,256}$/u.test(value('bundleEntry')) &&
      keys[1] === 'platform' &&
      value('platform') === 'web'
    );
  }
  if (parsed.pathname.startsWith('/assets/')) {
    return (
      pairs.length <= 2 &&
      pairs.every(
        ([key, item]) =>
          (key === 'platform' && item === 'web') ||
          (key === 'hash' && /^[0-9a-f]{16,128}$/u.test(item)),
      )
    );
  }
  return false;
}

function normalizeCat07LocalUrl(value, allowedOrigin, runId, { navigation = false } = {}) {
  if (typeof value !== 'string') return { url: null, urlPolicyViolation: true };
  try {
    const parsed = new URL(value);
    const allowed = new URL(allowedOrigin);
    const isHttp =
      parsed.protocol === 'http:' &&
      parsed.hostname === 'localhost' &&
      parsed.origin === allowed.origin;
    const isWebSocket =
      parsed.protocol === 'ws:' && parsed.hostname === 'localhost' && parsed.port === allowed.port;
    if (!isHttp && !isWebSocket) return { url: null, urlPolicyViolation: true };

    let urlPolicyViolation = Boolean(parsed.username || parsed.password || parsed.hash);
    parsed.username = '';
    parsed.password = '';
    parsed.hash = '';
    const hadSearch = parsed.search.length > 0;
    const reviewedSearch = new URLSearchParams();
    if (navigation && isHttp) {
      const seenKeys = new Set();
      for (const [key, item] of parsed.searchParams) {
        if (seenKeys.has(key)) urlPolicyViolation = true;
        seenKeys.add(key);
        if (key === 'e2eReset' && item === 'local') {
          reviewedSearch.append(key, item);
        } else if (isReviewedCat07NavigationMarker(key, item, runId)) {
          reviewedSearch.append(key, item);
        } else if (
          ((parsed.pathname === '/shelf/opened' && key === 'intakeId') ||
            (parsed.pathname === '/shelf/replenish' && key === 'id')) &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(item)
        ) {
          reviewedSearch.append(key, item);
        } else {
          urlPolicyViolation = true;
        }
      }
      const reviewedKeys = [...reviewedSearch.keys()];
      const isBootstrap =
        reviewedKeys.length === 2 &&
        reviewedKeys[0] === 'e2eReset' &&
        reviewedKeys[1] === 'cat04Bootstrap';
      const isSingleMarker =
        reviewedKeys.length === 1 && ['cat04Audit', 'cat04ConsentProbe'].includes(reviewedKeys[0]);
      const isSingleRouteIdentifier =
        reviewedKeys.length === 1 &&
        ((parsed.pathname === '/shelf/opened' && reviewedKeys[0] === 'intakeId') ||
          (parsed.pathname === '/shelf/replenish' && reviewedKeys[0] === 'id'));
      if (hadSearch && !isBootstrap && !isSingleMarker && !isSingleRouteIdentifier) {
        urlPolicyViolation = true;
      }
      if (parsed.search.slice(1) !== reviewedSearch.toString()) urlPolicyViolation = true;
    } else if (hadSearch && !isReviewedCat07NetworkSearch(parsed, runId)) {
      urlPolicyViolation = true;
    }
    parsed.search = '';
    if ([...reviewedSearch].length > 0) parsed.search = reviewedSearch.toString();
    else if (hadSearch) parsed.search = '?redacted-query';
    return { url: parsed.toString(), urlPolicyViolation };
  } catch {
    return { url: null, urlPolicyViolation: true };
  }
}

function cat07NetworkErrorCode(value) {
  if (value === 'net::ERR_ABORTED') return 'net::ERR_ABORTED';
  if (value === 'Error in connection establishment: net::ERR_CONNECTION_REFUSED') {
    return 'net::ERR_CONNECTION_REFUSED';
  }
  return 'other';
}

export function projectCat07CdpEvent(
  message,
  { allowedOrigin, observedAt, requestUrls = new Map(), runId },
) {
  const method = typeof message?.method === 'string' ? message.method : null;
  const params = cat07PlainRecord(message?.params) ?? {};
  const base = { method, observedAt };
  const requestId = cat07BoundedIdentifier(params.requestId);
  if (!method) return null;

  if (method === 'Network.requestWillBeSent') {
    const request = cat07PlainRecord(params.request);
    const normalized = normalizeCat07LocalUrl(request?.url, allowedOrigin, runId);
    if (requestId && normalized.url) requestUrls.set(requestId, normalized);
    return {
      ...base,
      requestId,
      requestMethod:
        typeof request?.method === 'string' && /^[A-Z]{1,16}$/u.test(request.method)
          ? request.method
          : null,
      type: cat07BoundedIdentifier(params.type, 64),
      url: normalized.url,
      urlPolicyViolation: normalized.urlPolicyViolation,
    };
  }
  if (method === 'Network.responseReceived') {
    const response = cat07PlainRecord(params.response);
    const normalized = normalizeCat07LocalUrl(response?.url, allowedOrigin, runId);
    return {
      ...base,
      requestId,
      status:
        Number.isFinite(response?.status) && Number.isInteger(response.status)
          ? response.status
          : null,
      type: cat07BoundedIdentifier(params.type, 64),
      url: normalized.url,
      urlPolicyViolation: normalized.urlPolicyViolation,
    };
  }
  if (method === 'Network.loadingFailed') {
    const prior = requestId ? requestUrls.get(requestId) : null;
    return {
      ...base,
      canceled: params.canceled === true,
      errorCode: cat07NetworkErrorCode(params.errorText),
      requestId,
      type: cat07BoundedIdentifier(params.type, 64),
      url: prior?.url ?? null,
      urlPolicyViolation: prior?.urlPolicyViolation ?? false,
    };
  }
  if (method === 'Network.webSocketCreated') {
    const normalized = normalizeCat07LocalUrl(params.url, allowedOrigin, runId);
    if (requestId && normalized.url) requestUrls.set(requestId, normalized);
    return {
      ...base,
      requestId,
      url: normalized.url,
      urlPolicyViolation: normalized.urlPolicyViolation,
    };
  }
  if (method === 'Network.webSocketFrameError') {
    const prior = requestId ? requestUrls.get(requestId) : null;
    return {
      ...base,
      errorCode: cat07NetworkErrorCode(params.errorMessage),
      requestId,
      url: prior?.url ?? null,
      urlPolicyViolation: prior?.urlPolicyViolation ?? false,
    };
  }
  if (
    method === 'Page.frameStartedNavigating' ||
    method === 'Page.frameNavigated' ||
    method === 'Page.navigatedWithinDocument'
  ) {
    const frame = cat07PlainRecord(params.frame);
    const rawUrl = method === 'Page.frameNavigated' ? frame?.url : params.url;
    const normalized = normalizeCat07LocalUrl(rawUrl, allowedOrigin, runId, { navigation: true });
    return {
      ...base,
      requestId: cat07BoundedIdentifier(params.loaderId),
      url: normalized.url,
      urlPolicyViolation: normalized.urlPolicyViolation,
    };
  }
  if (method === 'Runtime.executionContextCreated') return base;
  if (method === 'Runtime.consoleAPICalled') {
    return {
      ...base,
      level: cat07BoundedIdentifier(params.type, 32),
    };
  }
  if (method === 'Log.entryAdded') {
    const entry = cat07PlainRecord(params.entry);
    const level = cat07BoundedIdentifier(entry?.level, 32);
    const rawText = typeof entry?.text === 'string' ? entry.text : '';
    const hmrConnectionRefused =
      level === 'error' &&
      /^WebSocket connection to 'ws:\/\/localhost:\d+\/hot(?:\?[^']*)?' failed: Error in connection establishment: net::ERR_CONNECTION_REFUSED$/u.test(
        rawText,
      );
    return {
      ...base,
      failureClass: hmrConnectionRefused
        ? 'hmr-connection-refused'
        : level === 'error'
          ? 'error'
          : null,
      level,
    };
  }
  if (method === 'Runtime.exceptionThrown') return { ...base, failureClass: 'page-exception' };
  if (method === 'Page.javascriptDialogOpening') {
    return { ...base, failureClass: 'unexpected-page-dialog' };
  }
  if (method === 'Inspector.targetCrashed' || method === 'Page.crashed') {
    return { ...base, failureClass: 'page-crash' };
  }
  return null;
}

export function classifyCat07ProjectedBrowserFailures(events) {
  const failures = [];
  const requestUrls = new Map();
  const navigationUrls = new Map();
  for (const event of events) {
    if (event.urlPolicyViolation === true) {
      failures.push({ method: event.method, type: 'unreviewed-url-components' });
    }
    if (event.method === 'Network.requestWillBeSent') {
      if (!event.requestId || !event.url || !event.requestMethod || !event.type) {
        failures.push({ method: event.method, type: 'invalid-or-remote-network-request' });
      } else {
        requestUrls.set(event.requestId, event.url);
      }
    } else if (event.method === 'Network.responseReceived') {
      if (!event.requestId || !event.url || !event.type) {
        failures.push({ method: event.method, type: 'invalid-or-remote-network-response' });
      } else if (
        requestUrls.has(event.requestId) &&
        requestUrls.get(event.requestId) !== event.url
      ) {
        failures.push({ method: event.method, type: 'network-request-response-url-mismatch' });
      }
      if (!Number.isInteger(event.status)) {
        failures.push({ method: event.method, type: 'invalid-http-response-status' });
      } else if (event.status < 100 || event.status >= 400) {
        failures.push({ method: event.method, type: 'http-error-response' });
      }
    } else if (
      event.method === 'Page.frameStartedNavigating' ||
      event.method === 'Page.frameNavigated' ||
      event.method === 'Page.navigatedWithinDocument'
    ) {
      if (!event.url) failures.push({ method: event.method, type: 'invalid-or-remote-navigation' });
      if (event.requestId && event.url) navigationUrls.set(event.requestId, event.url);
    } else if (event.method === 'Network.webSocketCreated') {
      let parsed = null;
      try {
        parsed = new URL(event.url);
      } catch {
        // Reported below without retaining an untrusted URL.
      }
      if (!parsed || !['/hot', '/message'].includes(parsed.pathname)) {
        failures.push({ method: event.method, type: 'unexpected-websocket-endpoint' });
      }
    } else if (event.method === 'Network.webSocketFrameError') {
      let parsed = null;
      try {
        parsed = new URL(event.url);
      } catch {
        // Reported below.
      }
      if (
        event.errorCode !== 'net::ERR_CONNECTION_REFUSED' ||
        !parsed ||
        parsed.pathname !== '/hot'
      ) {
        failures.push({ method: event.method, type: 'websocket-frame-error' });
      }
    } else if (event.method === 'Network.loadingFailed') {
      const navigationUrl = navigationUrls.get(event.requestId) ?? null;
      if (
        event.canceled !== true ||
        event.errorCode !== 'net::ERR_ABORTED' ||
        event.type !== 'Document' ||
        !navigationUrl
      ) {
        failures.push({ method: event.method, type: 'network-loading-failed' });
      }
    } else if (
      event.method === 'Runtime.consoleAPICalled' &&
      ['assert', 'error'].includes(event.level)
    ) {
      failures.push({ method: event.method, type: 'console-error' });
    } else if (event.method === 'Log.entryAdded') {
      if (event.failureClass === 'error') {
        failures.push({ method: event.method, type: 'browser-log-error' });
      }
    } else if (event.failureClass) {
      failures.push({ method: event.method, type: event.failureClass });
    }
  }
  return failures;
}

export function parseCat07CdpFrame(
  data,
  { maxBytes = CAT07_MAX_CDP_FRAME_BYTES, parse = JSON.parse } = {},
) {
  let frameBytes;
  let serialized;
  if (typeof data === 'string') {
    frameBytes = Buffer.byteLength(data, 'utf8');
    if (frameBytes > maxBytes) throw new Error('CAT07 CDP frame exceeds its pre-parse byte limit.');
    serialized = data;
  } else if (Buffer.isBuffer(data)) {
    frameBytes = data.length;
    if (frameBytes > maxBytes) throw new Error('CAT07 CDP frame exceeds its pre-parse byte limit.');
    serialized = data.toString('utf8');
  } else if (data instanceof ArrayBuffer) {
    frameBytes = data.byteLength;
    if (frameBytes > maxBytes) throw new Error('CAT07 CDP frame exceeds its pre-parse byte limit.');
    serialized = Buffer.from(data).toString('utf8');
  } else if (ArrayBuffer.isView(data)) {
    frameBytes = data.byteLength;
    if (frameBytes > maxBytes) throw new Error('CAT07 CDP frame exceeds its pre-parse byte limit.');
    serialized = Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString('utf8');
  } else {
    throw new Error('CAT07 CDP frame has an unsupported binary representation.');
  }

  let message;
  try {
    message = parse(serialized);
  } catch {
    throw new Error('CAT07 CDP frame is not valid JSON.');
  }
  if (!message || typeof message !== 'object' || Array.isArray(message)) {
    throw new Error('CAT07 CDP frame is not one JSON object.');
  }
  return { frameBytes, message };
}

export function createCat07SourceMutationMonitor({ rootPath = repoRoot } = {}) {
  let mutationObserved = false;
  const allowed = (relativePath) => {
    const normalized = normalizeRepoPath(relativePath);
    return (
      normalized === '.git' ||
      normalized.startsWith('.git/') ||
      normalized === '.tmp' ||
      normalized.startsWith('.tmp/') ||
      normalized === '.expo' ||
      normalized.startsWith('.expo/') ||
      normalized === 'apps/mobile/.expo' ||
      normalized.startsWith('apps/mobile/.expo/') ||
      normalized === CAT07_EXPO_ENV_PATH ||
      normalized === CAT07_EVIDENCE_RELATIVE_DIR ||
      normalized.startsWith(`${CAT07_EVIDENCE_RELATIVE_DIR}/`)
    );
  };
  const watcher = watch(rootPath, { recursive: true }, (_eventType, filename) => {
    if (filename == null || !allowed(filename)) mutationObserved = true;
  });
  watcher.on('error', () => {
    mutationObserved = true;
  });
  return {
    assertClean() {
      assert(
        !mutationObserved,
        'CAT07 detected a transient or persistent source-tree mutation while the app was served.',
      );
      return true;
    },
    close() {
      watcher.close();
    },
  };
}

export class Cat07CdpClient {
  constructor(
    wsUrl,
    { allowedOrigin, runId, sourceMonitor, webSocketFactory = (url) => new WebSocket(url) },
  ) {
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
    this.inflight = new Set();
    this.allowedOrigin = allowedOrigin;
    this.runId = runId;
    this.sourceMonitor = sourceMonitor;
    this.requestUrls = new Map();
    this.inputFrameCount = 0;
    this.inputFrameBytes = 0;
    this.ignoredFrameCount = 0;
    this.responseFrameCount = 0;
    this.sanitizedBytes = 2;
    this.eventStreamFailure = null;
    this.ws = webSocketFactory(wsUrl);
    this.ready = new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('CAT07 CDP websocket did not open within 20000ms.')),
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
          reject(new Error('CAT07 CDP websocket failed before opening.'));
        },
        { once: true },
      );
      this.ws.addEventListener(
        'close',
        () => {
          clearTimeout(timeout);
          reject(new Error('CAT07 CDP websocket closed before opening.'));
        },
        { once: true },
      );
    });
    this.ws.addEventListener('message', (event) => this.handleMessage(event));
    this.ws.addEventListener('close', () => {
      this.rejectPending(new Error('CAT07 CDP websocket closed before the command completed.'));
    });
    this.ws.addEventListener('error', () => {
      this.rejectPending(new Error('CAT07 CDP websocket failed before the command completed.'));
    });
  }

  rejectPending(error) {
    for (const { reject, timeout } of this.pending.values()) {
      clearTimeout(timeout);
      reject(error);
    }
    this.pending.clear();
  }

  failEventStream(message) {
    if (!this.eventStreamFailure) this.eventStreamFailure = message;
    this.rejectPending(new Error(this.eventStreamFailure));
    try {
      this.ws.close();
    } catch {
      // The stable event-stream failure remains authoritative.
    }
  }

  handleMessage(event) {
    let parsedFrame;
    try {
      parsedFrame = parseCat07CdpFrame(event.data);
    } catch (error) {
      this.failEventStream(error instanceof Error ? error.message : 'CAT07 CDP frame failed.');
      return;
    }
    try {
      const { frameBytes, message } = parsedFrame;
      const hasId = Object.prototype.hasOwnProperty.call(message, 'id');
      const hasMethod = Object.prototype.hasOwnProperty.call(message, 'method');
      if (hasId && (!Number.isSafeInteger(message.id) || message.id < 1)) {
        throw new Error('invalid response id');
      }
      if (hasMethod && typeof message.method !== 'string') throw new Error('invalid method');
      if (hasMethod && !cat07PlainRecord(message.params)) throw new Error('invalid params');
      if (hasId && hasMethod) throw new Error('ambiguous frame');

      this.inputFrameCount += 1;
      this.inputFrameBytes += frameBytes;
      if (
        this.inputFrameCount > CAT07_MAX_INPUT_CDP_FRAMES ||
        this.inputFrameBytes > CAT07_MAX_INPUT_CDP_BYTES
      ) {
        this.failEventStream('CAT07 aggregate CDP frame limits were exceeded.');
        return;
      }
      if (hasId && this.pending.has(message.id)) {
        this.responseFrameCount += 1;
        const { reject, resolve, timeout } = this.pending.get(message.id);
        this.pending.delete(message.id);
        clearTimeout(timeout);
        if (message.error) reject(new Error('CAT07 CDP command failed.'));
        else resolve(cat07PlainRecord(message.result) ?? {});
        return;
      }
      if (!hasMethod) {
        this.ignoredFrameCount += 1;
        return;
      }
      const observedAt = new Date().toISOString();
      const requestId = cat07BoundedIdentifier(message.params.requestId);
      if (message.method === 'Network.requestWillBeSent' && requestId) {
        this.inflight.add(requestId);
      }
      if (
        ['Network.loadingFinished', 'Network.loadingFailed'].includes(message.method) &&
        requestId
      ) {
        this.inflight.delete(requestId);
      }
      const projected = projectCat07CdpEvent(message, {
        allowedOrigin: this.allowedOrigin,
        observedAt,
        requestUrls: this.requestUrls,
        runId: this.runId,
      });
      if (!projected) {
        this.ignoredFrameCount += 1;
        return;
      }
      const projectedBytes = Buffer.byteLength(JSON.stringify(projected), 'utf8');
      if (
        this.events.length + 1 > CAT07_MAX_RETAINED_BROWSER_EVENTS ||
        this.sanitizedBytes + projectedBytes + (this.events.length > 0 ? 1 : 0) >
          CAT07_MAX_BROWSER_EVENT_BYTES
      ) {
        this.failEventStream('CAT07 projected CDP event limits were exceeded.');
        return;
      }
      this.sanitizedBytes += projectedBytes + (this.events.length > 0 ? 1 : 0);
      this.events.push(projected);
    } catch {
      this.failEventStream('CAT07 CDP frame has an invalid reviewed shape.');
    }
  }

  assertHealthy() {
    this.sourceMonitor?.assertClean();
    assert(!this.eventStreamFailure, this.eventStreamFailure ?? 'CAT07 CDP event stream failed.');
  }

  evidence(sourceGitSha) {
    return {
      evidenceBinding: {
        runId: this.runId,
        sourceGitSha,
      },
      events: this.events,
      retention: {
        ignoredFrameCount: this.ignoredFrameCount,
        inputFrameBytes: this.inputFrameBytes,
        inputFrameCount: this.inputFrameCount,
        limits: {
          maxFrameBytes: CAT07_MAX_CDP_FRAME_BYTES,
          maxInputBytes: CAT07_MAX_INPUT_CDP_BYTES,
          maxInputFrames: CAT07_MAX_INPUT_CDP_FRAMES,
          maxRetainedBytes: CAT07_MAX_BROWSER_EVENT_BYTES,
          maxRetainedEvents: CAT07_MAX_RETAINED_BROWSER_EVENTS,
        },
        retainedEventCount: this.events.length,
        responseFrameCount: this.responseFrameCount,
        sanitizedBytes: this.sanitizedBytes,
        truncated: false,
      },
      schemaVersion: CAT07_BROWSER_EVIDENCE_SCHEMA_VERSION,
    };
  }

  async send(method, params = {}, timeoutMs = 20_000) {
    await this.ready;
    this.assertHealthy();
    if (this.ws.readyState !== 1) {
      throw new Error(`CAT07 CDP websocket is not open for ${method}.`);
    }
    const id = this.nextId;
    this.nextId += 1;
    return await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (!this.pending.has(id)) return;
        this.pending.delete(id);
        reject(new Error(`CAT07 CDP command ${method} timed out after ${timeoutMs}ms.`));
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
    this.ws.close();
  }
}

export async function readCat07BoundedJsonResponse(response, { maxBytes = 64 * 1024 } = {}) {
  assert(Number.isSafeInteger(maxBytes) && maxBytes > 0, 'CAT07 JSON response limit is invalid.');
  const declaredLength = response.headers?.get?.('content-length');
  let declaredBytes = null;
  if (declaredLength != null) {
    assert(/^\d+$/u.test(declaredLength), 'CAT07 debug response has an invalid Content-Length.');
    declaredBytes = Number(declaredLength);
    assert(
      Number.isSafeInteger(declaredBytes) && declaredBytes <= maxBytes,
      'CAT07 debug response exceeds its byte ceiling.',
    );
  }
  const reader = response.body?.getReader?.();
  assert(reader, 'CAT07 debug response does not expose a bounded byte stream.');
  const chunks = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      assert(value instanceof Uint8Array, 'CAT07 debug response yielded invalid bytes.');
      totalBytes += value.byteLength;
      assert(
        Number.isSafeInteger(totalBytes) && totalBytes <= maxBytes,
        'CAT07 debug response exceeds its byte ceiling.',
      );
      chunks.push(Buffer.from(value));
    }
  } catch (error) {
    try {
      await reader.cancel();
    } catch {
      // Preserve the stable bounded-read failure.
    }
    throw error;
  }
  assert(
    declaredBytes == null || declaredBytes === totalBytes,
    'CAT07 debug response Content-Length does not match the received bytes.',
  );
  assert(totalBytes > 0, 'CAT07 debug response is empty.');
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, totalBytes));
  } catch {
    throw new Error('CAT07 debug response is not valid UTF-8.');
  }
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error('CAT07 debug response is not valid JSON.');
  }
  const target = cat07PlainRecord(value);
  assert(target, 'CAT07 debug response must be one JSON object.');
  const allowedKeys = new Set([
    'attached',
    'browserContextId',
    'canAccessOpener',
    'description',
    'devtoolsFrontendUrl',
    'faviconUrl',
    'id',
    'openerFrameId',
    'openerId',
    'parentFrameId',
    'subtype',
    'title',
    'type',
    'url',
    'webSocketDebuggerUrl',
  ]);
  assert(
    Object.keys(target).length <= allowedKeys.size &&
      Object.keys(target).every((key) => allowedKeys.has(key)),
    'CAT07 debug response contains an unreviewed target field.',
  );
  for (const [key, item] of Object.entries(target)) {
    assert(
      (typeof item === 'string' && Buffer.byteLength(item, 'utf8') <= 8_192) ||
        (['attached', 'canAccessOpener'].includes(key) && typeof item === 'boolean'),
      'CAT07 debug response contains an invalid target field.',
    );
  }
  assert(
    cat07BoundedIdentifier(target.id) &&
      target.type === 'page' &&
      target.url === 'about:blank' &&
      typeof target.webSocketDebuggerUrl === 'string',
    'CAT07 debug target must have the exact reviewed identity shape.',
  );
  return target;
}

export function validateCat07DebuggerWebSocketUrl(target, debugPort) {
  assert(
    cat07PlainRecord(target) &&
      cat07BoundedIdentifier(target.id) &&
      typeof target.webSocketDebuggerUrl === 'string' &&
      Number.isSafeInteger(debugPort) &&
      debugPort > 0 &&
      debugPort <= 65_535,
    'CAT07 debug websocket target binding is invalid.',
  );
  let websocket;
  try {
    websocket = new URL(target.webSocketDebuggerUrl);
  } catch {
    throw new Error('CAT07 debug websocket URL is invalid.');
  }
  assert(
    websocket.protocol === 'ws:' &&
      ['127.0.0.1', 'localhost'].includes(websocket.hostname) &&
      websocket.port === String(debugPort) &&
      websocket.username.length === 0 &&
      websocket.password.length === 0 &&
      websocket.search.length === 0 &&
      websocket.hash.length === 0 &&
      websocket.pathname === `/devtools/page/${target.id}`,
    'CAT07 debug websocket must bind the exact credential-free local target.',
  );
  return websocket;
}

export async function connectToInstrumentedCat07Page(
  debugPort,
  baseUrl,
  { runId, sourceMonitor } = {},
) {
  const appUrl = new URL(baseUrl);
  assert(
    appUrl.protocol === 'http:' &&
      appUrl.hostname === 'localhost' &&
      appUrl.port.length > 0 &&
      appUrl.username.length === 0 &&
      appUrl.password.length === 0,
    'CAT07 app target must be credential-free localhost HTTP with an explicit port.',
  );
  const targetEndpoint = `http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent('about:blank')}`;
  const deadline = Date.now() + 20_000;
  let target = null;
  let lastError = null;
  while (Date.now() < deadline && target == null) {
    try {
      const response = await fetch(targetEndpoint, {
        method: 'PUT',
        signal: AbortSignal.timeout(2_000),
      });
      if (!response.ok) throw new Error(`debug endpoint returned ${response.status}`);
      target = await readCat07BoundedJsonResponse(response);
    } catch (error) {
      lastError = error;
      await delay(100);
    }
  }
  assert(
    target != null,
    `CAT07 could not create an about:blank debug target: ${lastError instanceof Error ? lastError.message : String(lastError ?? 'timeout')}.`,
  );
  const websocket = validateCat07DebuggerWebSocketUrl(target, debugPort);

  assert(CAT07_RUN_ID.test(String(runId ?? '')), 'CAT07 CDP client requires its canonical runId.');
  const client = new Cat07CdpClient(websocket.toString(), {
    allowedOrigin: appUrl.origin,
    runId,
    sourceMonitor,
  });
  await client.ready;
  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('Log.enable');
  await client.send('Network.enable');
  await client.send('Page.setLifecycleEventsEnabled', { enabled: true });
  await client.send('Page.bringToFront');
  client.ignoredFrameCount += client.events.length;
  client.events.length = 0;
  client.sanitizedBytes = 2;
  client.inflight.clear();
  await client.send('Page.navigate', { url: appUrl.toString() });
  return client;
}

function comparableAbsolutePath(value) {
  const resolved = path.resolve(value);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function assertNoExistingReparseBoundary(absolutePath, diagnosticRoot) {
  const parsed = path.parse(absolutePath);
  const segments = absolutePath.slice(parsed.root.length).split(path.sep).filter(Boolean);
  let current = parsed.root;
  for (const segment of segments) {
    current = path.join(current, segment);
    const stats = lstatSync(current, { throwIfNoEntry: false });
    if (!stats) continue;
    assert(
      !stats.isSymbolicLink(),
      `CAT07 evidence path crosses a symlink or junction: ${normalizeRepoPath(path.relative(diagnosticRoot, current)) || '.'}`,
    );
    assert(
      stats.isDirectory(),
      `CAT07 evidence path crosses a non-directory boundary: ${normalizeRepoPath(path.relative(diagnosticRoot, current)) || '.'}`,
    );
  }
}

export function validateCat07EvidenceDirectory(
  evidenceDir,
  { expectedEvidenceDir = CAT07_EVIDENCE_DIRECTORY, repoRootPath = repoRoot } = {},
) {
  const resolvedRoot = path.resolve(repoRootPath);
  const resolvedExpected = path.resolve(expectedEvidenceDir);
  const resolvedCandidate = path.resolve(evidenceDir);
  const relativeExpected = path.relative(resolvedRoot, resolvedExpected);
  assert(
    relativeExpected.length > 0 &&
      !relativeExpected.startsWith(`..${path.sep}`) &&
      relativeExpected !== '..' &&
      !path.isAbsolute(relativeExpected),
    'CAT07 governed evidence directory must be a strict descendant of the repository root.',
  );
  assert(
    comparableAbsolutePath(resolvedCandidate) === comparableAbsolutePath(resolvedExpected),
    `CAT07 evidence directory must be exactly ${normalizeRepoPath(relativeExpected)}.`,
  );
  assertNoExistingReparseBoundary(resolvedExpected, resolvedRoot);
  if (existsSync(resolvedExpected)) {
    const canonicalExpected = realpathSync.native(resolvedExpected);
    assert(
      comparableAbsolutePath(canonicalExpected) === comparableAbsolutePath(resolvedExpected),
      'CAT07 evidence directory canonical path does not match its governed path.',
    );
  }
  return resolvedExpected;
}

const cat07EvidenceWriteGuards = new Map();

function cat07FilesystemIdentity(stats, { includeMutableMetadata = false } = {}) {
  const identity = {
    dev: String(stats.dev),
    ino: String(stats.ino),
  };
  if (includeMutableMetadata) {
    Object.assign(identity, {
      ctimeMs: String(stats.ctimeMs),
      mode: String(stats.mode),
      mtimeMs: String(stats.mtimeMs),
      size: String(stats.size),
    });
  }
  return identity;
}

function cat07CreateDirectoryGuard(rootPath, containmentRoot) {
  const root = path.resolve(rootPath);
  const containment = path.resolve(containmentRoot);
  const relativeRoot = path.relative(containment, root);
  assert(
    relativeRoot.length > 0 &&
      relativeRoot !== '..' &&
      !relativeRoot.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relativeRoot),
    'CAT07 governed directory must be a strict descendant of its containment root.',
  );
  assertNoExistingReparseBoundary(root, containment);
  const containmentStats = lstatSync(containment);
  const rootStats = lstatSync(root);
  assert(
    containmentStats.isDirectory() &&
      !containmentStats.isSymbolicLink() &&
      rootStats.isDirectory() &&
      !rootStats.isSymbolicLink(),
    'CAT07 governed directory roots must be real directories.',
  );
  const containmentRealPath = realpathSync.native(containment);
  const rootRealPath = realpathSync.native(root);
  const realRelative = path.relative(containmentRealPath, rootRealPath);
  assert(
    comparableAbsolutePath(containmentRealPath) === comparableAbsolutePath(containment) &&
      comparableAbsolutePath(rootRealPath) === comparableAbsolutePath(root) &&
      realRelative.length > 0 &&
      realRelative !== '..' &&
      !realRelative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(realRelative),
    'CAT07 governed directory canonical paths escape or cross a reparse boundary.',
  );
  return {
    containment,
    containmentIdentity: cat07FilesystemIdentity(containmentStats),
    root,
    rootIdentity: cat07FilesystemIdentity(rootStats),
  };
}

function cat07EnsureGovernedDirectory(rootPath, containmentRoot) {
  const root = path.resolve(rootPath);
  const containment = path.resolve(containmentRoot);
  const containmentStats = lstatSync(containment);
  assert(
    containmentStats.isDirectory() &&
      !containmentStats.isSymbolicLink() &&
      comparableAbsolutePath(realpathSync.native(containment)) ===
        comparableAbsolutePath(containment),
    'CAT07 governed directory containment is not a canonical real directory.',
  );
  const relative = path.relative(containment, root);
  assert(
    relative.length > 0 &&
      relative !== '..' &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative),
    'CAT07 governed directory creation must remain below its containment root.',
  );
  assertNoExistingReparseBoundary(root, containment);
  mkdirSync(root, { recursive: true });
  return cat07CreateDirectoryGuard(root, containment);
}

function assertCat07DirectoryGuardStable(guard, { rootMayBeMissing = false } = {}) {
  const containmentStats = lstatSync(guard.containment, { throwIfNoEntry: false });
  assert(
    containmentStats?.isDirectory() &&
      !containmentStats.isSymbolicLink() &&
      canonicalEvidenceJsonBytes(cat07FilesystemIdentity(containmentStats)).equals(
        canonicalEvidenceJsonBytes(guard.containmentIdentity),
      ) &&
      comparableAbsolutePath(realpathSync.native(guard.containment)) ===
        comparableAbsolutePath(guard.containment),
    'CAT07 governed containment root identity changed.',
  );
  const rootStats = lstatSync(guard.root, { throwIfNoEntry: false });
  if (!rootStats && rootMayBeMissing) return true;
  assert(
    rootStats?.isDirectory() &&
      !rootStats.isSymbolicLink() &&
      canonicalEvidenceJsonBytes(cat07FilesystemIdentity(rootStats)).equals(
        canonicalEvidenceJsonBytes(guard.rootIdentity),
      ) &&
      comparableAbsolutePath(realpathSync.native(guard.root)) ===
        comparableAbsolutePath(guard.root),
    'CAT07 governed directory root identity changed.',
  );
  return true;
}

function cat07AssertStableEntry(entryPath, expectedIdentity, guard, expectedKind) {
  assertCat07DirectoryGuardStable(guard);
  const stats = lstatSync(entryPath, { throwIfNoEntry: false });
  const kindMatches =
    expectedKind === 'directory'
      ? stats?.isDirectory() && !stats.isSymbolicLink()
      : expectedKind === 'link'
        ? stats?.isSymbolicLink()
        : stats?.isFile() && !stats.isSymbolicLink();
  assert(
    kindMatches &&
      canonicalEvidenceJsonBytes(
        cat07FilesystemIdentity(stats, { includeMutableMetadata: expectedKind !== 'directory' }),
      ).equals(canonicalEvidenceJsonBytes(expectedIdentity)),
    'CAT07 governed filesystem entry changed during an operation.',
  );
  if (expectedKind !== 'link') {
    const canonical = realpathSync.native(entryPath);
    const relative = path.relative(guard.root, canonical);
    assert(
      comparableAbsolutePath(canonical) === comparableAbsolutePath(path.resolve(entryPath)) &&
        relative.length > 0 &&
        relative !== '..' &&
        !relative.startsWith(`..${path.sep}`) &&
        !path.isAbsolute(relative),
      'CAT07 governed filesystem entry crossed its root boundary.',
    );
  }
  return stats;
}

function cat07ClearGuardedDirectory(guard, { allowLinks = false, beforeRemove = null } = {}) {
  const operations = [];
  const scan = (directory) => {
    assertCat07DirectoryGuardStable(guard);
    const entries = readdirSync(directory, { withFileTypes: true }).sort((left, right) =>
      comparePaths(left.name, right.name),
    );
    for (const entry of entries) {
      assert(
        entry.name !== '.' && entry.name !== '..' && !entry.name.includes(path.sep),
        'CAT07 governed cleanup received an invalid entry name.',
      );
      const entryPath = path.join(directory, entry.name);
      const stats = lstatSync(entryPath);
      const identity = cat07FilesystemIdentity(stats, {
        includeMutableMetadata: !stats.isDirectory() || stats.isSymbolicLink(),
      });
      if (stats.isSymbolicLink()) {
        assert(allowLinks, 'CAT07 refuses to clear a nested symlink or junction.');
        operations.push({ entryPath, expectedKind: 'link', identity });
      } else if (stats.isDirectory()) {
        scan(entryPath);
        operations.push({ entryPath, expectedKind: 'directory', identity });
      } else {
        assert(stats.isFile(), 'CAT07 refuses to clear a non-regular filesystem entry.');
        operations.push({ entryPath, expectedKind: 'file', identity });
      }
    }
  };
  scan(guard.root);
  for (const operation of operations) {
    if (typeof beforeRemove === 'function') {
      beforeRemove({ entryPath: operation.entryPath, guard });
    }
    cat07AssertStableEntry(operation.entryPath, operation.identity, guard, operation.expectedKind);
    if (operation.expectedKind === 'directory') rmdirSync(operation.entryPath);
    else rmSync(operation.entryPath, { force: false, recursive: false });
    assertCat07DirectoryGuardStable(guard);
  }
  assert(readdirSync(guard.root).length === 0, 'CAT07 governed cleanup was incomplete.');
}

function cat07RemoveGuardedDirectory(guard, options = {}) {
  cat07ClearGuardedDirectory(guard, options);
  assertCat07DirectoryGuardStable(guard);
  rmdirSync(guard.root);
  assertCat07DirectoryGuardStable(guard, { rootMayBeMissing: true });
}

function cat07EvidenceWriteGuard(evidenceDir) {
  const resolved = path.resolve(evidenceDir);
  const key = comparableAbsolutePath(resolved);
  const existing = cat07EvidenceWriteGuards.get(key);
  if (existing) {
    assertCat07DirectoryGuardStable(existing);
    return existing;
  }
  const guard = cat07CreateDirectoryGuard(resolved, path.dirname(resolved));
  cat07EvidenceWriteGuards.set(key, guard);
  return guard;
}

export function writeCat07EvidenceArtifact(
  evidenceDir,
  name,
  contents,
  { beforeCommit = null, encoding = null } = {},
) {
  assert(
    typeof name === 'string' &&
      name === path.basename(name) &&
      name === name.normalize('NFC') &&
      Buffer.byteLength(name, 'utf8') <= 255 &&
      /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(name) &&
      !/[. ]$/u.test(name),
    'CAT07 evidence artifact name is outside the governed flat inventory.',
  );
  const bytes = Buffer.isBuffer(contents)
    ? Buffer.from(contents)
    : Buffer.from(String(contents), encoding ?? 'utf8');
  assert(
    bytes.length <= CAT07_MAX_DIAGNOSTIC_ARTIFACT_BYTES * 2,
    'CAT07 evidence artifact exceeds its write byte ceiling.',
  );
  const guard = cat07EvidenceWriteGuard(evidenceDir);
  const destination = path.join(guard.root, name);
  const existing = lstatSync(destination, { throwIfNoEntry: false });
  assert(
    !existing || (existing.isFile() && !existing.isSymbolicLink()),
    'CAT07 evidence destination is not a regular file.',
  );
  const temporaryPath = path.join(guard.root, `.${name}.tmp-${randomUUID()}`);
  assertCat07DirectoryGuardStable(guard);
  writeFileSync(temporaryPath, bytes, { flag: 'wx' });
  const temporaryStats = lstatSync(temporaryPath);
  const temporaryIdentity = cat07FilesystemIdentity(temporaryStats, {
    includeMutableMetadata: true,
  });
  cat07AssertStableEntry(temporaryPath, temporaryIdentity, guard, 'file');
  if (typeof beforeCommit === 'function') beforeCommit({ destination, guard, temporaryPath });
  assertCat07DirectoryGuardStable(guard);
  if (existing) {
    cat07AssertStableEntry(
      destination,
      cat07FilesystemIdentity(existing, { includeMutableMetadata: true }),
      guard,
      'file',
    );
  }
  renameSync(temporaryPath, destination);
  assertCat07DirectoryGuardStable(guard);
  const committed = readBoundedRegularFile(destination, {
    containmentRoot: guard.root,
    maxBytes: Math.max(1, bytes.length),
  });
  assert(committed.equals(bytes), 'CAT07 evidence artifact bytes changed during publication.');
  assertCat07DirectoryGuardStable(guard);
  return destination;
}

export function clearPreviousEvidence(evidenceDir, options = {}) {
  const { beforeRemove = null, ...directoryOptions } = options;
  const governedEvidenceDir = validateCat07EvidenceDirectory(evidenceDir, directoryOptions);
  mkdirSync(governedEvidenceDir, { recursive: true });
  validateCat07EvidenceDirectory(governedEvidenceDir, directoryOptions);
  const guard = cat07CreateDirectoryGuard(governedEvidenceDir, path.dirname(governedEvidenceDir));
  cat07ClearGuardedDirectory(guard, { beforeRemove });
  cat07EvidenceWriteGuards.set(comparableAbsolutePath(governedEvidenceDir), guard);
  return governedEvidenceDir;
}

function assertCat07ScratchDescendant(candidate) {
  const scratchRoot = path.resolve(repoRoot, '.tmp');
  const resolved = path.resolve(candidate);
  const relativePath = path.relative(scratchRoot, resolved);
  assert(
    relativePath.length > 0 &&
      relativePath !== '..' &&
      !relativePath.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relativePath),
    'CAT07 immutable source snapshot must remain inside the repository scratch root.',
  );
  return resolved;
}

function cat07RuntimePaths(
  snapshotRoot,
  { cacheRoot = path.resolve(repoRoot, '.tmp', 'cat07-npm-cache') } = {},
) {
  const scratchRoot = path.join(snapshotRoot, '.tmp', 'cat07-runtime');
  return {
    appData: path.join(scratchRoot, 'app-data'),
    cache: path.resolve(cacheRoot),
    home: path.join(scratchRoot, 'home'),
    npmGlobalConfig: path.join(scratchRoot, 'empty-global-npmrc'),
    npmUserConfig: path.join(scratchRoot, 'empty-user-npmrc'),
    scratchRoot,
    temp: path.join(scratchRoot, 'temp'),
  };
}

function prepareCat07RuntimePaths(
  snapshotRoot,
  {
    cacheContainmentRoot = path.resolve(repoRoot, '.tmp'),
    cacheRoot = path.resolve(repoRoot, '.tmp', 'cat07-npm-cache'),
  } = {},
) {
  const paths = cat07RuntimePaths(snapshotRoot, { cacheRoot });
  const snapshotGuard = cat07CreateDirectoryGuard(
    path.resolve(snapshotRoot),
    path.dirname(path.resolve(snapshotRoot)),
  );
  const runtimeScratchGuard = cat07EnsureGovernedDirectory(paths.scratchRoot, snapshotGuard.root);
  const resolvedCacheContainment = path.resolve(cacheContainmentRoot);
  const cacheContainmentGuard = cat07CreateDirectoryGuard(
    resolvedCacheContainment,
    path.dirname(resolvedCacheContainment),
  );
  const cacheGuard = cat07EnsureGovernedDirectory(paths.cache, cacheContainmentGuard.root);
  const runtimeDirectoryGuards = [paths.appData, paths.home, paths.temp].map((directory) =>
    cat07EnsureGovernedDirectory(directory, runtimeScratchGuard.root),
  );
  assertCat07DirectoryGuardStable(snapshotGuard);
  assertCat07DirectoryGuardStable(runtimeScratchGuard);
  assertCat07DirectoryGuardStable(cacheContainmentGuard);
  assertCat07DirectoryGuardStable(cacheGuard);
  for (const configPath of [paths.npmGlobalConfig, paths.npmUserConfig]) {
    writeFileSync(configPath, Buffer.alloc(0), { flag: 'wx' });
    const written = readBoundedRegularFile(configPath, {
      containmentRoot: runtimeScratchGuard.root,
      maxBytes: 1,
    });
    assert(written.length === 0, 'CAT07 isolated npm config file must remain empty.');
  }
  return {
    ...paths,
    cacheContainmentGuard,
    cacheGuard,
    runtimeDirectoryGuards,
    runtimeScratchGuard,
    snapshotGuard,
  };
}

function assertCat07RuntimePathGuardsStable(runtimePaths) {
  for (const guard of [
    runtimePaths.snapshotGuard,
    runtimePaths.runtimeScratchGuard,
    ...runtimePaths.runtimeDirectoryGuards,
    runtimePaths.cacheContainmentGuard,
    runtimePaths.cacheGuard,
  ]) {
    assertCat07DirectoryGuardStable(guard);
  }
  for (const configPath of [runtimePaths.npmGlobalConfig, runtimePaths.npmUserConfig]) {
    const contents = readBoundedRegularFile(configPath, {
      containmentRoot: runtimePaths.runtimeScratchGuard.root,
      maxBytes: 1,
    });
    assert(contents.length === 0, 'CAT07 isolated npm config file changed.');
  }
}

const CAT07_SCRUBBED_NODE_BOOTSTRAP = [
  "import { pathToFileURL } from 'node:url';",
  'const allowed = new Set(JSON.parse(process.argv[1]));',
  'const target = process.argv[2];',
  'const targetArgs = process.argv.slice(3);',
  'for (const key of Object.keys(process.env)) if (!allowed.has(key)) delete process.env[key];',
  'process.argv = [process.execPath, target, ...targetArgs];',
  'await import(pathToFileURL(target).href);',
].join('\n');

export function buildCat07ScrubbedNodeArgs(target, targetArgs, environment) {
  assert(path.isAbsolute(target), 'CAT07 scrubbed Node target must be absolute.');
  assert(Array.isArray(targetArgs), 'CAT07 scrubbed Node target arguments must be an array.');
  return [
    '--input-type=module',
    '--eval',
    CAT07_SCRUBBED_NODE_BOOTSTRAP,
    JSON.stringify(Object.keys(environment).sort(comparePaths)),
    target,
    ...targetArgs,
  ];
}

function cat07EnvironmentBootstrapRecord() {
  const bytes = Buffer.from(CAT07_SCRUBBED_NODE_BOOTSTRAP, 'utf8');
  return {
    bytes: bytes.length,
    schemaVersion: CAT07_ENVIRONMENT_BOOTSTRAP_SCHEMA_VERSION,
    sha256: sha256(bytes),
  };
}

export function buildCat07ChildEnvironment({
  fixtureGroup = CAT07_FIXTURE_GROUP,
  hostEnvironment = process.env,
  nodeExecutable = process.execPath,
  platform = process.platform,
  purpose = 'app',
  runtimePaths,
} = {}) {
  assert(
    runtimePaths && typeof runtimePaths === 'object',
    'CAT07 controlled runtime paths are required.',
  );
  assert(['app', 'install'].includes(purpose), 'CAT07 child environment purpose is invalid.');
  const executableDirectory = path.dirname(path.resolve(nodeExecutable));
  const fixedPathEntries = [executableDirectory];
  const environment = {
    ...cat04ServerEnvironment(fixtureGroup, {}),
    EXPO_NO_TELEMETRY: '1',
    EXPO_OFFLINE: '1',
    EXPO_UNSTABLE_HEADLESS: '1',
    FORCE_COLOR: '0',
    NODE_ENV: 'development',
    NO_COLOR: '1',
    NO_PROXY: 'localhost,127.0.0.1',
  };
  if (purpose === 'install') {
    Object.assign(environment, {
      npm_config_audit: 'false',
      npm_config_cache: runtimePaths.cache,
      npm_config_fund: 'false',
      npm_config_globalconfig: runtimePaths.npmGlobalConfig,
      npm_config_offline: 'true',
      npm_config_registry: 'https://registry.npmjs.org/',
      npm_config_update_notifier: 'false',
      npm_config_userconfig: runtimePaths.npmUserConfig,
    });
  }
  if (platform === 'win32') {
    const configuredSystemRoot = hostEnvironment.SystemRoot ?? hostEnvironment.WINDIR;
    assert(
      typeof configuredSystemRoot === 'string' && configuredSystemRoot.length > 0,
      'CAT07 requires one explicit Windows system root.',
    );
    const systemRoot = path.resolve(configuredSystemRoot);
    assert(path.isAbsolute(systemRoot), 'CAT07 requires one absolute Windows system root.');
    fixedPathEntries.push(path.join(systemRoot, 'System32'));
    Object.assign(environment, {
      APPDATA: runtimePaths.appData,
      LOCALAPPDATA: runtimePaths.appData,
      PATHEXT: '.COM;.EXE;.BAT;.CMD',
      Path: [...new Set(fixedPathEntries)].join(path.delimiter),
      SystemRoot: systemRoot,
      TEMP: runtimePaths.temp,
      TMP: runtimePaths.temp,
      USERPROFILE: runtimePaths.home,
      WINDIR: systemRoot,
    });
  } else {
    fixedPathEntries.push('/usr/local/bin', '/usr/bin', '/bin');
    Object.assign(environment, {
      HOME: runtimePaths.home,
      PATH: [...new Set(fixedPathEntries)].join(path.delimiter),
      TEMP: runtimePaths.temp,
      TMP: runtimePaths.temp,
      TMPDIR: runtimePaths.temp,
    });
  }
  return Object.fromEntries(
    Object.entries(environment).sort(([left], [right]) => comparePaths(left, right)),
  );
}

function findCat07NpmCli(nodeExecutable = process.execPath) {
  const executableDirectory = path.dirname(path.resolve(nodeExecutable));
  const candidates = [
    path.join(executableDirectory, 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    path.resolve(executableDirectory, '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  ];
  for (const candidate of candidates) {
    const stats = lstatSync(candidate, { throwIfNoEntry: false });
    if (stats?.isFile() && !stats.isSymbolicLink()) return candidate;
  }
  throw new Error('CAT07 could not locate the npm CLI beside the trusted Node executable.');
}

function cat07CanonicalRegularExecutable(filePath) {
  if (typeof filePath !== 'string' || !path.isAbsolute(filePath)) return null;
  const resolved = path.resolve(filePath);
  const stats = lstatSync(resolved, { throwIfNoEntry: false });
  if (!stats?.isFile() || stats.isSymbolicLink()) return null;
  const canonical = realpathSync.native(resolved);
  return comparableAbsolutePath(canonical) === comparableAbsolutePath(resolved) ? canonical : null;
}

function cat07ExecutableBinding(filePath) {
  const resolvedFilePath = cat07CanonicalRegularExecutable(filePath);
  assert(resolvedFilePath, 'CAT07 trusted tool must be one canonical regular executable.');
  const before = lstatSync(resolvedFilePath, { bigint: true });
  const bytes = readBoundedRegularFile(resolvedFilePath, {
    maxBytes: CAT07_MAX_RUNTIME_FILE_BYTES,
  });
  const after = lstatSync(resolvedFilePath, { bigint: true });
  const identity = (stats) => ({
    ctimeNs: stats.ctimeNs.toString(),
    dev: stats.dev.toString(),
    ino: stats.ino.toString(),
    mtimeNs: stats.mtimeNs.toString(),
    size: stats.size.toString(),
  });
  assert(
    canonicalEvidenceJsonBytes(identity(before)).equals(
      canonicalEvidenceJsonBytes(identity(after)),
    ) &&
      comparableAbsolutePath(realpathSync.native(resolvedFilePath)) ===
        comparableAbsolutePath(resolvedFilePath),
    'CAT07 trusted tool identity changed while it was hashed.',
  );
  return {
    basename: path.basename(resolvedFilePath),
    bytes: bytes.length,
    filePath: resolvedFilePath,
    identity: identity(after),
    sha256: sha256(bytes),
  };
}

function assertCat07ExecutableBindingStable(binding) {
  const current = cat07ExecutableBinding(binding.filePath);
  assert(
    canonicalEvidenceJsonBytes(current).equals(canonicalEvidenceJsonBytes(binding)),
    'CAT07 trusted tool identity or bytes changed during a governed operation.',
  );
  return current;
}

function cat07ToolRecordFromBinding(binding, version) {
  return {
    basename: binding.basename,
    bytes: binding.bytes,
    sha256: binding.sha256,
    version,
  };
}

export function findCat07GitExecutable({
  nodeExecutable = process.execPath,
  platform = process.platform,
} = {}) {
  let candidates;
  if (platform === 'win32') {
    const driveRoot = path.parse(path.resolve(nodeExecutable)).root;
    candidates = [
      path.join(driveRoot, 'Program Files', 'Git', 'cmd', 'git.exe'),
      path.join(driveRoot, 'Program Files', 'Git', 'bin', 'git.exe'),
      path.join(driveRoot, 'Program Files (x86)', 'Git', 'cmd', 'git.exe'),
    ];
  } else {
    candidates = [
      '/usr/bin/git',
      '/usr/local/bin/git',
      '/opt/homebrew/bin/git',
      '/opt/local/bin/git',
    ];
  }
  for (const candidate of candidates) {
    const trusted = cat07CanonicalRegularExecutable(candidate);
    if (trusted) return trusted;
  }
  throw new Error('CAT07 could not locate Git in a fixed trusted installation root.');
}

export function findCat07TrustedBrowserExecutable({
  nodeExecutable = process.execPath,
  platform = process.platform,
} = {}) {
  let candidates;
  if (platform === 'win32') {
    const driveRoot = path.parse(path.resolve(nodeExecutable)).root;
    candidates = [
      path.join(driveRoot, 'Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(driveRoot, 'Program Files (x86)', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    ];
  } else if (platform === 'darwin') {
    candidates = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ];
  } else {
    candidates = [
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/opt/google/chrome/chrome',
    ];
  }
  for (const candidate of candidates) {
    const trusted = cat07CanonicalRegularExecutable(candidate);
    if (trusted) return trusted;
  }
  throw new Error(
    'CAT07 could not locate Chrome or Chromium in a fixed trusted installation root.',
  );
}

export function cat07GitEnvironment(
  gitExecutable,
  { nodeExecutable = process.execPath, platform = process.platform } = {},
) {
  const environment = {
    GIT_ATTR_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: platform === 'win32' ? 'NUL' : '/dev/null',
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_OPTIONAL_LOCKS: '0',
    GIT_TERMINAL_PROMPT: '0',
    HOME: repoRoot,
    LC_ALL: 'C',
    TEMP: path.resolve(tmpdir()),
    TMP: path.resolve(tmpdir()),
  };
  if (platform === 'win32') {
    const systemRoot = path.join(path.parse(path.resolve(nodeExecutable)).root, 'Windows');
    Object.assign(environment, {
      APPDATA: repoRoot,
      LOCALAPPDATA: repoRoot,
      PATHEXT: '.COM;.EXE;.BAT;.CMD',
      Path: [path.dirname(gitExecutable), path.join(systemRoot, 'System32')].join(path.delimiter),
      SystemRoot: systemRoot,
      USERPROFILE: repoRoot,
      WINDIR: systemRoot,
    });
  } else {
    environment.PATH = [path.dirname(gitExecutable), '/usr/bin', '/bin'].join(path.delimiter);
    environment.TMPDIR = path.resolve(tmpdir());
  }
  return Object.fromEntries(
    Object.entries(environment).sort(([left], [right]) => comparePaths(left, right)),
  );
}

export function createCat07TrustedGitContext() {
  const gitExecutable = findCat07GitExecutable();
  const binding = cat07ExecutableBinding(gitExecutable);
  return {
    assertStable() {
      assertCat07ExecutableBindingStable(binding);
      return true;
    },
    environment: cat07GitEnvironment(gitExecutable),
    gitExecutable,
  };
}

function assertCat07SafeGitTreePath(candidate, seenNodes) {
  assert(typeof candidate === 'string' && candidate.length > 0, 'CAT07 Git tree path is empty.');
  assert(candidate === candidate.normalize('NFC'), 'CAT07 Git tree path is not canonical Unicode.');
  assert(
    Buffer.byteLength(candidate, 'utf8') <= 4_096 &&
      !candidate.startsWith('/') &&
      !candidate.startsWith('\\') &&
      !/^[A-Za-z]:/u.test(candidate) &&
      !candidate.includes('\\') &&
      !/[\u0000-\u001f\u007f-\u009f:]/u.test(candidate),
    'CAT07 Git tree path contains unsafe platform syntax.',
  );
  const segments = candidate.split('/');
  assert(
    segments.every(
      (segment) =>
        segment.length > 0 &&
        Buffer.byteLength(segment, 'utf8') <= 255 &&
        segment !== '.' &&
        segment !== '..' &&
        !/[. ]$/u.test(segment) &&
        segment.toLowerCase() !== '.git' &&
        !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/iu.test(segment),
    ),
    'CAT07 Git tree path is unsafe on a supported filesystem.',
  );
  for (let index = 0; index < segments.length; index += 1) {
    const node = segments.slice(0, index + 1).join('/');
    const folded = node.toLowerCase();
    const kind = index === segments.length - 1 ? 'file' : 'directory';
    const prior = seenNodes.get(folded);
    assert(
      !prior || (prior.path === node && prior.kind === kind),
      'CAT07 Git tree has a case-fold or file/directory path collision.',
    );
    seenNodes.set(folded, { kind, path: node });
  }
}

export function parseCat07GitTree(rawTree) {
  assert(Buffer.isBuffer(rawTree), 'CAT07 Git tree inventory must be bytes.');
  assert(rawTree.length > 0 && rawTree.at(-1) === 0, 'CAT07 Git tree inventory is truncated.');
  const entries = [];
  const seenNodes = new Map();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let offset = 0;
  while (offset < rawTree.length) {
    const terminator = rawTree.indexOf(0, offset);
    assert(terminator >= offset, 'CAT07 Git tree inventory is malformed.');
    const record = rawTree.subarray(offset, terminator);
    const tab = record.indexOf(9);
    assert(tab > 0 && tab < record.length - 1, 'CAT07 Git tree record is malformed.');
    const metadata = record.subarray(0, tab).toString('ascii');
    const match = /^(100644|100755) blob ([0-9a-f]{40})$/u.exec(metadata);
    assert(match, 'CAT07 Git tree contains a symlink, gitlink, tree, or unsupported mode.');
    let repoPath;
    try {
      repoPath = decoder.decode(record.subarray(tab + 1));
    } catch {
      throw new Error('CAT07 Git tree path is not valid UTF-8.');
    }
    assertCat07SafeGitTreePath(repoPath, seenNodes);
    entries.push({ mode: match[1], oid: match[2], path: repoPath });
    assert(
      entries.length <= CAT07_MAX_SOURCE_TREE_ENTRIES,
      'CAT07 Git tree exceeds its reviewed entry ceiling.',
    );
    offset = terminator + 1;
  }
  return entries.sort((left, right) => comparePaths(left.path, right.path));
}

function parseCat07BatchCheck(raw, expectedOids) {
  assert(Buffer.isBuffer(raw), 'CAT07 Git object inventory must be bytes.');
  const lines = raw.toString('ascii').split('\n');
  if (lines.at(-1) === '') lines.pop();
  assert(lines.length === expectedOids.length, 'CAT07 Git object inventory is incomplete.');
  const sizes = new Map();
  let totalBytes = 0;
  for (let index = 0; index < lines.length; index += 1) {
    const match = /^([0-9a-f]{40}) blob ([0-9]+)$/u.exec(lines[index]);
    assert(match && match[1] === expectedOids[index], 'CAT07 Git object inventory is malformed.');
    const size = Number(match[2]);
    assert(
      Number.isSafeInteger(size) && size >= 0 && size <= CAT07_MAX_SOURCE_FILE_BYTES,
      'CAT07 Git blob exceeds its reviewed per-file ceiling.',
    );
    totalBytes += size;
    assert(
      Number.isSafeInteger(totalBytes) && totalBytes <= CAT07_MAX_SOURCE_TREE_BYTES,
      'CAT07 Git tree exceeds its reviewed aggregate byte ceiling.',
    );
    sizes.set(match[1], size);
  }
  return { sizes, totalBytes };
}

function parseCat07BatchContents(raw, expectedOids, expectedSizes) {
  assert(Buffer.isBuffer(raw), 'CAT07 Git object contents must be bytes.');
  const contents = new Map();
  let offset = 0;
  for (const expectedOid of expectedOids) {
    const newline = raw.indexOf(10, offset);
    assert(newline > offset, 'CAT07 Git object response is truncated.');
    const header = raw.subarray(offset, newline).toString('ascii');
    const match = /^([0-9a-f]{40}) blob ([0-9]+)$/u.exec(header);
    assert(
      match && match[1] === expectedOid && Number(match[2]) === expectedSizes.get(expectedOid),
      'CAT07 Git object response does not match its reviewed inventory.',
    );
    const end = newline + 1 + Number(match[2]);
    assert(end < raw.length && raw[end] === 10, 'CAT07 Git object response is truncated.');
    const bytes = raw.subarray(newline + 1, end);
    const actualOid = createHash('sha1')
      .update(`blob ${bytes.length}\0`, 'utf8')
      .update(bytes)
      .digest('hex');
    assert(actualOid === expectedOid, 'CAT07 Git object bytes do not match their blob ID.');
    contents.set(expectedOid, Buffer.from(bytes));
    offset = end + 1;
  }
  assert(offset === raw.length, 'CAT07 Git object response contains unreviewed trailing bytes.');
  return contents;
}

function cat07SourceTreeManifest(entries, sizes) {
  const digest = createHash('sha256');
  let bytes = 0;
  for (const entry of entries) {
    const size = sizes.get(entry.oid);
    assert(Number.isSafeInteger(size), 'CAT07 Git tree entry is missing its blob size.');
    bytes += size;
    digest.update(`${entry.mode}\0${entry.path}\0${entry.oid}\0${size}\0`, 'utf8');
  }
  return {
    bytes,
    entryCount: entries.length,
    fileCount: entries.length,
    sha256: digest.digest('hex'),
  };
}

export function verifyCat07ExtractedGitTree(
  snapshotRoot,
  entries,
  { allowedExtraRoots = [], allowedGeneratedFiles = new Map() } = {},
) {
  const root = path.resolve(snapshotRoot);
  const rootStats = lstatSync(root);
  assert(rootStats.isDirectory() && !rootStats.isSymbolicLink(), 'CAT07 snapshot root is unsafe.');
  const rootRealPath = realpathSync(root);
  const expectedFiles = new Map(entries.map((entry) => [entry.path, entry]));
  const expectedDirectories = new Set();
  for (const entry of entries) {
    const segments = entry.path.split('/');
    for (let index = 1; index < segments.length; index += 1) {
      expectedDirectories.add(segments.slice(0, index).join('/'));
    }
  }
  const reviewedExtraRoots = new Set(allowedExtraRoots.map(normalizeRepoPath));
  for (const extraRoot of reviewedExtraRoots) {
    assertCat07SafeGitTreePath(`${extraRoot}/__cat07_reviewed_extra__`, new Map());
    assert(
      !entries.some(
        ({ path: repoPath }) => repoPath === extraRoot || repoPath.startsWith(`${extraRoot}/`),
      ),
      'CAT07 runtime exclusion overlaps committed source.',
    );
  }
  const reviewedGeneratedFiles = new Map();
  for (const [repoPath, expectedBytes] of allowedGeneratedFiles) {
    const normalized = normalizeRepoPath(repoPath);
    assertCat07SafeGitTreePath(normalized, new Map());
    assert(Buffer.isBuffer(expectedBytes), 'CAT07 reviewed generated source must bind bytes.');
    assert(
      !expectedFiles.has(normalized) &&
        ![...reviewedExtraRoots].some(
          (extraRoot) => normalized === extraRoot || normalized.startsWith(`${extraRoot}/`),
        ),
      'CAT07 reviewed generated source overlaps committed source or runtime roots.',
    );
    reviewedGeneratedFiles.set(normalized, expectedBytes);
  }
  const actualFiles = new Set();
  const actualDirectories = new Set();
  const visit = (directory, relativeDirectory = '') => {
    const directoryRealPath = realpathSync(directory);
    const contained = path.relative(rootRealPath, directoryRealPath);
    assert(
      relativeDirectory.length === 0 ||
        (contained.length > 0 &&
          contained !== '..' &&
          !contained.startsWith(`..${path.sep}`) &&
          !path.isAbsolute(contained)),
      'CAT07 snapshot directory escapes its containment root.',
    );
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((left, right) =>
      comparePaths(left.name, right.name),
    )) {
      const absolute = path.join(directory, entry.name);
      const relative = normalizeRepoPath(path.join(relativeDirectory, entry.name));
      const stats = lstatSync(absolute);
      if (reviewedExtraRoots.has(relative)) {
        const extraRealPath = realpathSync(absolute);
        const extraContained = path.relative(rootRealPath, extraRealPath);
        assert(
          stats.isDirectory() &&
            !stats.isSymbolicLink() &&
            extraContained.length > 0 &&
            extraContained !== '..' &&
            !extraContained.startsWith(`..${path.sep}`) &&
            !path.isAbsolute(extraContained),
          'CAT07 reviewed runtime or scratch root is an unsafe reparse boundary.',
        );
        continue;
      }
      if (reviewedGeneratedFiles.has(relative)) {
        assert(
          stats.isFile() && !stats.isSymbolicLink(),
          'CAT07 reviewed generated source is not one regular file.',
        );
        const actualBytes = readBoundedRegularFile(absolute, {
          containmentRoot: root,
          maxBytes: CAT07_MAX_SOURCE_FILE_BYTES,
        });
        assert(
          actualBytes.equals(reviewedGeneratedFiles.get(relative)),
          `CAT07 reviewed generated source bytes do not match: ${relative}.`,
        );
        continue;
      }
      assert(!stats.isSymbolicLink(), 'CAT07 snapshot contains a symlink or junction boundary.');
      if (stats.isDirectory()) {
        actualDirectories.add(relative);
        visit(absolute, relative);
      } else if (stats.isFile()) {
        actualFiles.add(relative);
      } else {
        throw new Error('CAT07 snapshot contains an unsupported filesystem entry.');
      }
    }
  };
  visit(root);
  if (
    actualFiles.size !== expectedFiles.size ||
    [...actualFiles].some((repoPath) => !expectedFiles.has(repoPath))
  ) {
    const details = [
      ...[...actualFiles]
        .filter((repoPath) => !expectedFiles.has(repoPath))
        .sort(comparePaths)
        .map((repoPath) => `unexpected ${repoPath}`),
      ...[...expectedFiles.keys()]
        .filter((repoPath) => !actualFiles.has(repoPath))
        .sort(comparePaths)
        .map((repoPath) => `missing ${repoPath}`),
    ].slice(0, 8);
    throw new Error(
      `CAT07 snapshot file inventory does not exactly match the bound Git tree${
        details.length > 0 ? `: ${details.join(', ')}` : ''
      }.`,
    );
  }
  if (
    actualDirectories.size !== expectedDirectories.size ||
    [...actualDirectories].some((repoPath) => !expectedDirectories.has(repoPath))
  ) {
    const details = [
      ...[...actualDirectories]
        .filter((repoPath) => !expectedDirectories.has(repoPath))
        .sort(comparePaths)
        .map((repoPath) => `unexpected ${repoPath}`),
      ...[...expectedDirectories]
        .filter((repoPath) => !actualDirectories.has(repoPath))
        .sort(comparePaths)
        .map((repoPath) => `missing ${repoPath}`),
    ].slice(0, 8);
    throw new Error(
      `CAT07 snapshot directory inventory does not exactly match the bound Git tree${
        details.length > 0 ? `: ${details.join(', ')}` : ''
      }.`,
    );
  }
  const sizes = new Map();
  let totalBytes = 0;
  for (const [repoPath, expected] of [...expectedFiles.entries()].sort(([left], [right]) =>
    comparePaths(left, right),
  )) {
    const bytes = readBoundedRegularFile(path.join(root, ...repoPath.split('/')), {
      containmentRoot: root,
      maxBytes: CAT07_MAX_SOURCE_FILE_BYTES,
    });
    totalBytes += bytes.length;
    assert(
      Number.isSafeInteger(totalBytes) && totalBytes <= CAT07_MAX_SOURCE_TREE_BYTES,
      'CAT07 extracted source exceeds its reviewed aggregate byte ceiling.',
    );
    const actualOid = createHash('sha1')
      .update(`blob ${bytes.length}\0`, 'utf8')
      .update(bytes)
      .digest('hex');
    assert(
      actualOid === expected.oid,
      'CAT07 extracted source bytes do not match the bound Git tree.',
    );
    sizes.set(expected.oid, bytes.length);
  }
  return cat07SourceTreeManifest(entries, sizes);
}

export function extractCat07GitTree(
  sourceGitSha,
  snapshotRoot,
  {
    execute = execFileSync,
    gitExecutable = findCat07GitExecutable(),
    gitEnvironment = cat07GitEnvironment(gitExecutable),
  } = {},
) {
  assert(CAT07_GIT_SHA.test(sourceGitSha), 'CAT07 extraction requires a full source Git SHA.');
  const gitBinding = cat07ExecutableBinding(gitExecutable);
  const git = (...args) =>
    execute(gitExecutable, ['-c', `safe.directory=${path.resolve(repoRoot)}`, ...args], {
      cwd: repoRoot,
      encoding: 'buffer',
      env: gitEnvironment,
      maxBuffer: CAT07_MAX_SOURCE_TREE_BYTES + 16 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 120_000,
      windowsHide: true,
    });
  const objectFormat = git('rev-parse', '--show-object-format').toString('ascii').trim();
  assert(objectFormat === 'sha1', 'CAT07 source extraction requires a SHA-1 Git repository.');
  const entries = parseCat07GitTree(git('ls-tree', '-r', '-z', '--full-tree', sourceGitSha));
  const entriesByOid = new Map();
  for (const entry of entries) {
    const paths = entriesByOid.get(entry.oid) ?? [];
    paths.push(entry);
    entriesByOid.set(entry.oid, paths);
  }
  const oids = [...entriesByOid.keys()];
  const batchCheck = execute(
    gitExecutable,
    ['-c', `safe.directory=${path.resolve(repoRoot)}`, 'cat-file', '--batch-check'],
    {
      cwd: repoRoot,
      encoding: 'buffer',
      env: gitEnvironment,
      input: Buffer.from(`${oids.join('\n')}\n`, 'ascii'),
      maxBuffer: oids.length * 96 + 1024,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 120_000,
      windowsHide: true,
    },
  );
  const { sizes } = parseCat07BatchCheck(batchCheck, oids);
  const expandedSourceBytes = entries.reduce((sum, entry) => sum + sizes.get(entry.oid), 0);
  assert(
    Number.isSafeInteger(expandedSourceBytes) && expandedSourceBytes <= CAT07_MAX_SOURCE_TREE_BYTES,
    'CAT07 expanded Git tree exceeds its reviewed aggregate byte ceiling.',
  );
  const groups = [];
  let group = [];
  let groupBytes = 0;
  for (const oid of oids) {
    const size = sizes.get(oid);
    if (group.length > 0 && groupBytes + size > 64 * 1024 * 1024) {
      groups.push(group);
      group = [];
      groupBytes = 0;
    }
    group.push(oid);
    groupBytes += size;
  }
  if (group.length > 0) groups.push(group);
  for (const objectGroup of groups) {
    const rawContents = execute(
      gitExecutable,
      ['-c', `safe.directory=${path.resolve(repoRoot)}`, 'cat-file', '--batch'],
      {
        cwd: repoRoot,
        encoding: 'buffer',
        env: gitEnvironment,
        input: Buffer.from(`${objectGroup.join('\n')}\n`, 'ascii'),
        maxBuffer:
          objectGroup.reduce((sum, oid) => sum + sizes.get(oid), 0) +
          objectGroup.length * 96 +
          1024,
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 120_000,
        windowsHide: true,
      },
    );
    const contents = parseCat07BatchContents(rawContents, objectGroup, sizes);
    for (const [oid, bytes] of contents) {
      for (const entry of entriesByOid.get(oid)) {
        const destination = path.join(snapshotRoot, ...entry.path.split('/'));
        mkdirSync(path.dirname(destination), { recursive: true });
        writeFileSync(destination, bytes, {
          flag: 'wx',
          mode: entry.mode === '100755' ? 0o755 : 0o644,
        });
        if (entry.mode === '100755' && process.platform !== 'win32') chmodSync(destination, 0o755);
      }
    }
  }
  const manifest = verifyCat07ExtractedGitTree(snapshotRoot, entries);
  assert(
    canonicalEvidenceJsonBytes(manifest).equals(
      canonicalEvidenceJsonBytes(cat07SourceTreeManifest(entries, sizes)),
    ),
    'CAT07 extracted tree manifest does not match its Git object inventory.',
  );
  assertCat07ExecutableBindingStable(gitBinding);
  return { entries, gitBinding, gitEnvironment, gitExecutable, manifest };
}

export function buildCat07RuntimeTreeManifest(
  runtimeRoot,
  { containmentRoot = path.dirname(runtimeRoot) } = {},
) {
  const resolvedRuntimeRoot = path.resolve(runtimeRoot);
  const resolvedContainmentRoot = path.resolve(containmentRoot);
  const resolvedContainmentRealPath = realpathSync(resolvedContainmentRoot);
  const relativeRoot = path.relative(resolvedContainmentRoot, resolvedRuntimeRoot);
  assert(
    relativeRoot.length > 0 &&
      relativeRoot !== '..' &&
      !relativeRoot.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relativeRoot),
    'CAT07 runtime dependency tree must be contained by the immutable source snapshot.',
  );
  const rootStats = lstatSync(resolvedRuntimeRoot);
  assert(
    rootStats.isDirectory() && !rootStats.isSymbolicLink(),
    'CAT07 runtime dependency root must be a real directory, not a junction or symlink.',
  );
  const digest = createHash('sha256');
  let bytes = 0;
  let directoryCount = 0;
  let fileCount = 0;
  let linkCount = 0;
  let entryCount = 0;
  const visit = (directory, relativeDirectory = '') => {
    const entries = readdirSync(directory, { withFileTypes: true }).sort((left, right) =>
      comparePaths(left.name, right.name),
    );
    for (const entry of entries) {
      entryCount += 1;
      assert(
        entryCount <= CAT07_MAX_RUNTIME_TREE_ENTRIES,
        'CAT07 runtime dependency tree exceeds its reviewed entry ceiling.',
      );
      const absolute = path.join(directory, entry.name);
      const relative = normalizeRepoPath(path.join(relativeDirectory, entry.name));
      const stats = lstatSync(absolute);
      if (stats.isSymbolicLink()) {
        const target = path.resolve(path.dirname(absolute), readlinkSync(absolute));
        const contained = path.relative(resolvedContainmentRoot, target);
        const realTarget = realpathSync(absolute);
        const realContained = path.relative(resolvedContainmentRealPath, realTarget);
        assert(
          contained.length > 0 &&
            contained !== '..' &&
            !contained.startsWith(`..${path.sep}`) &&
            !path.isAbsolute(contained) &&
            realContained.length > 0 &&
            realContained !== '..' &&
            !realContained.startsWith(`..${path.sep}`) &&
            !path.isAbsolute(realContained),
          'CAT07 runtime dependency link escapes the immutable source snapshot.',
        );
        linkCount += 1;
        digest.update(`L\0${relative}\0${normalizeRepoPath(contained)}\0`, 'utf8');
      } else if (stats.isDirectory()) {
        directoryCount += 1;
        digest.update(`D\0${relative}\0`, 'utf8');
        visit(absolute, relative);
      } else if (stats.isFile()) {
        const contents = readBoundedRegularFile(absolute, {
          containmentRoot: resolvedContainmentRoot,
          maxBytes: CAT07_MAX_RUNTIME_FILE_BYTES,
        });
        bytes += contents.length;
        assert(
          Number.isSafeInteger(bytes) && bytes <= CAT07_MAX_RUNTIME_TREE_BYTES,
          'CAT07 runtime dependency tree exceeds its reviewed byte ceiling.',
        );
        fileCount += 1;
        digest.update(`F\0${relative}\0${contents.length}\0`, 'utf8');
        digest.update(contents);
        digest.update('\0', 'utf8');
      } else {
        throw new Error('CAT07 runtime dependency tree contains an unsupported filesystem entry.');
      }
    }
  };
  visit(resolvedRuntimeRoot);
  return {
    bytes,
    directoryCount,
    entryCount,
    fileCount,
    linkCount,
    sha256: digest.digest('hex'),
  };
}

export function cat07RuntimeRootPathsFromPackageLock(packageLock) {
  const packages = cat07PlainRecord(packageLock?.packages);
  assert(packages, 'CAT07 package-lock must contain one packages inventory.');
  const roots = new Set(['node_modules']);
  for (const packagePath of Object.keys(packages)) {
    const normalized = normalizeRepoPath(packagePath);
    const marker = normalized.indexOf('node_modules/');
    if (marker < 0) continue;
    const runtimeRoot = `${normalized.slice(0, marker)}node_modules`;
    assertCat07SafeGitTreePath(`${runtimeRoot}/__cat07_runtime__`, new Map());
    roots.add(runtimeRoot);
  }
  return [...roots].sort(comparePaths);
}

export function buildCat07CombinedRuntimeManifest(snapshotRoot, runtimeRootPaths) {
  assert(
    Array.isArray(runtimeRootPaths) && runtimeRootPaths.length > 0,
    'CAT07 runtime root inventory is empty.',
  );
  const roots = runtimeRootPaths.map((repoPath) => ({
    path: repoPath,
    ...buildCat07RuntimeTreeManifest(path.join(snapshotRoot, ...repoPath.split('/')), {
      containmentRoot: snapshotRoot,
    }),
  }));
  const combined = {
    bytes: roots.reduce((sum, root) => sum + root.bytes, 0),
    directoryCount: roots.reduce((sum, root) => sum + root.directoryCount, 0),
    entryCount: roots.reduce((sum, root) => sum + root.entryCount, 0),
    fileCount: roots.reduce((sum, root) => sum + root.fileCount, 0),
    linkCount: roots.reduce((sum, root) => sum + root.linkCount, 0),
    rootCount: roots.length,
    roots,
  };
  return {
    ...combined,
    sha256: sha256(canonicalEvidenceJsonBytes(combined)),
  };
}

export function buildCat07RuntimeDriftFingerprint(snapshotRoot, runtimeRootPaths) {
  const fingerprint = new Map();
  for (const repoPath of runtimeRootPaths) {
    const runtimeRoot = path.join(snapshotRoot, ...repoPath.split('/'));
    const visit = (directory, relativeDirectory = '') => {
      const entries = readdirSync(directory, { withFileTypes: true }).sort((left, right) =>
        comparePaths(left.name, right.name),
      );
      for (const entry of entries) {
        const absolute = path.join(directory, entry.name);
        const relative = normalizeRepoPath(path.join(repoPath, relativeDirectory, entry.name));
        const stats = lstatSync(absolute, { bigint: true });
        if (stats.isSymbolicLink()) {
          fingerprint.set(relative, `link:${normalizeRepoPath(readlinkSync(absolute))}`);
        } else if (stats.isDirectory()) {
          fingerprint.set(relative, `directory:${stats.mtimeNs}:${stats.ctimeNs}`);
          visit(absolute, normalizeRepoPath(path.join(relativeDirectory, entry.name)));
        } else if (stats.isFile()) {
          fingerprint.set(
            relative,
            `file:${stats.size}:${stats.mtimeNs}:${stats.ctimeNs}`,
          );
        }
      }
    };
    visit(runtimeRoot);
  }
  return fingerprint;
}

export function collectCat07RuntimeDrift(before, after, { limit = 8 } = {}) {
  const results = [];
  const paths = [...new Set([...before.keys(), ...after.keys()])].sort(comparePaths);
  for (const repoPath of paths) {
    const beforeValue = before.get(repoPath);
    const afterValue = after.get(repoPath);
    if (beforeValue === afterValue) continue;
    const state = beforeValue == null ? 'created' : afterValue == null ? 'removed' : 'changed';
    results.push(`${state} ${repoPath}`);
    if (results.length >= limit) break;
  }
  return results;
}

export function runCat07IsolatedNpmInstall({
  cacheContainmentRoot = path.resolve(repoRoot, '.tmp'),
  cacheRoot = path.resolve(repoRoot, '.tmp', 'cat07-npm-cache'),
  cacheOnly = false,
  execute = execFileSync,
  enforceToolBindings = execute === execFileSync,
  nodeExecutable = process.execPath,
  npmCliPath = findCat07NpmCli(nodeExecutable),
  online = false,
  snapshotRoot,
} = {}) {
  const runtimePaths = prepareCat07RuntimePaths(snapshotRoot, {
    cacheContainmentRoot,
    cacheRoot,
  });
  const childEnvironment = buildCat07ChildEnvironment({
    nodeExecutable,
    purpose: 'install',
    runtimePaths,
  });
  const toolBindings = enforceToolBindings
    ? {
        node: cat07ExecutableBinding(nodeExecutable),
        npmCli: cat07ExecutableBinding(npmCliPath),
      }
    : {};
  if (online) {
    childEnvironment.EXPO_OFFLINE = '0';
    childEnvironment.npm_config_offline = 'false';
  }
  const args = [
    npmCliPath,
    'ci',
    '--ignore-scripts',
    online ? '--prefer-online' : '--offline',
    '--no-audit',
    '--fund=false',
    '--registry=https://registry.npmjs.org/',
    `--cache=${runtimePaths.cache}`,
    `--userconfig=${runtimePaths.npmUserConfig}`,
    `--globalconfig=${runtimePaths.npmGlobalConfig}`,
    '--loglevel=error',
  ];
  try {
    assertCat07RuntimePathGuardsStable(runtimePaths);
    for (const binding of Object.values(toolBindings)) assertCat07ExecutableBindingStable(binding);
    execute(
      nodeExecutable,
      buildCat07ScrubbedNodeArgs(npmCliPath, args.slice(1), childEnvironment),
      {
        cwd: snapshotRoot,
        env: childEnvironment,
        maxBuffer: 2 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 15 * 60_000,
        windowsHide: true,
      },
    );
    for (const binding of Object.values(toolBindings)) assertCat07ExecutableBindingStable(binding);
    if (!cacheOnly) {
      const postinstallPath = path.join(snapshotRoot, 'scripts', 'postinstall.mjs');
      if (enforceToolBindings) {
        toolBindings.postinstall = cat07ExecutableBinding(postinstallPath);
        assertCat07ExecutableBindingStable(toolBindings.node);
        assertCat07ExecutableBindingStable(toolBindings.postinstall);
      }
      execute(nodeExecutable, buildCat07ScrubbedNodeArgs(postinstallPath, [], childEnvironment), {
        cwd: snapshotRoot,
        env: childEnvironment,
        maxBuffer: 2 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 120_000,
        windowsHide: true,
      });
      if (enforceToolBindings) {
        assertCat07ExecutableBindingStable(toolBindings.node);
        assertCat07ExecutableBindingStable(toolBindings.postinstall);
      }
    }
    assertCat07RuntimePathGuardsStable(runtimePaths);
  } catch {
    throw new Error(
      online
        ? 'CAT07 governed npm cache warm failed without retaining external diagnostics.'
        : 'CAT07 isolated offline npm ci failed; warm the governed cache explicitly before evidence capture.',
    );
  }
  return {
    childEnvironment: buildCat07ChildEnvironment({ nodeExecutable, runtimePaths }),
    installEnvironment: childEnvironment,
    npmCliPath,
    runtimePaths,
    toolBindings,
  };
}

export function createCat07ImmutableSourceSnapshot(
  sourceGitSha,
  { cacheOnly = false, online = false } = {},
) {
  assert(CAT07_GIT_SHA.test(sourceGitSha), 'CAT07 snapshot requires a full source Git SHA.');
  const scratchRoot = path.resolve(repoRoot, '.tmp');
  const scratchGuard = cat07EnsureGovernedDirectory(scratchRoot, repoRoot);
  assertCat07DirectoryGuardStable(scratchGuard);
  const container = assertCat07ScratchDescendant(
    mkdtempSync(path.join(scratchRoot, 'cat07-immutable-source-')),
  );
  assertCat07DirectoryGuardStable(scratchGuard);
  const containerGuard = cat07CreateDirectoryGuard(container, scratchRoot);
  const snapshotRoot = path.join(container, 'source');
  mkdirSync(snapshotRoot);
  assertCat07DirectoryGuardStable(containerGuard);
  try {
    const extracted = extractCat07GitTree(sourceGitSha, snapshotRoot);
    const snapshotPackageLock = readBoundedRegularFile(
      path.join(snapshotRoot, 'package-lock.json'),
      {
        containmentRoot: snapshotRoot,
        maxBytes: CAT07_MAX_DIAGNOSTIC_ARTIFACT_BYTES,
      },
    );
    const parsedPackageLock = JSON.parse(snapshotPackageLock.toString('utf8'));
    const runtimeRootPaths = cat07RuntimeRootPathsFromPackageLock(parsedPackageLock);
    const installation = runCat07IsolatedNpmInstall({ cacheOnly, online, snapshotRoot });
    const sourceExtraRoots = ['.expo', '.tmp', 'apps/mobile/.expo', ...runtimeRootPaths];
    const installedSourceTree = verifyCat07ExtractedGitTree(snapshotRoot, extracted.entries, {
      allowedExtraRoots: sourceExtraRoots,
      allowedGeneratedFiles: CAT07_OPTIONAL_GENERATED_SOURCE_FILES,
    });
    assert(
      canonicalEvidenceJsonBytes(installedSourceTree).equals(
        canonicalEvidenceJsonBytes(extracted.manifest),
      ),
      'CAT07 committed source bytes changed during isolated runtime installation.',
    );
    if (cacheOnly) {
      return {
        root: snapshotRoot,
        sourceGitSha,
        cleanup() {
          assertCat07ScratchDescendant(container);
          cat07RemoveGuardedDirectory(containerGuard, { allowLinks: true });
        },
      };
    }
    const expoCliPath = path.join(snapshotRoot, 'node_modules', 'expo', 'bin', 'cli');
    const expoPackage = JSON.parse(
      readBoundedRegularFile(path.join(snapshotRoot, 'node_modules', 'expo', 'package.json'), {
        containmentRoot: snapshotRoot,
        maxBytes: CAT07_MAX_DIAGNOSTIC_ARTIFACT_BYTES,
      }).toString('utf8'),
    );
    const npmVersion = execFileSync(
      process.execPath,
      buildCat07ScrubbedNodeArgs(
        installation.npmCliPath,
        ['--version'],
        installation.childEnvironment,
      ),
      {
        cwd: snapshotRoot,
        encoding: 'utf8',
        env: installation.childEnvironment,
        maxBuffer: 64 * 1024,
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 30_000,
        windowsHide: true,
      },
    ).trim();
    const runtimeTree = buildCat07CombinedRuntimeManifest(snapshotRoot, runtimeRootPaths);
    const runtimeDriftFingerprint = buildCat07RuntimeDriftFingerprint(
      snapshotRoot,
      runtimeRootPaths,
    );
    const toolBindings = {
      expoCli: cat07ExecutableBinding(expoCliPath),
      git: extracted.gitBinding,
      node: installation.toolBindings.node ?? cat07ExecutableBinding(process.execPath),
      npmCli: installation.toolBindings.npmCli ?? cat07ExecutableBinding(installation.npmCliPath),
    };
    const postinstallBinding = installation.toolBindings.postinstall ?? null;
    const gitVersion = execFileSync(extracted.gitExecutable, ['--version'], {
      cwd: repoRoot,
      encoding: 'utf8',
      env: extracted.gitEnvironment,
      maxBuffer: 64 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 30_000,
      windowsHide: true,
    }).trim();
    assertCat07ExecutableBindingStable(toolBindings.git);
    const runtimeProvenance = {
      childEnvironment: {
        keys: Object.keys(installation.childEnvironment).sort(comparePaths),
        schemaVersion: CAT07_CHILD_ENVIRONMENT_SCHEMA_VERSION,
      },
      environmentBootstrap: cat07EnvironmentBootstrapRecord(),
      installMode: 'isolated-npm-ci-offline-ignore-scripts-then-repo-postinstall',
      packageLock: {
        bytes: snapshotPackageLock.length,
        sha256: sha256(snapshotPackageLock),
      },
      sourceTree: extracted.manifest,
      runtimeTree,
      schemaVersion: CAT07_RUNTIME_PROVENANCE_SCHEMA_VERSION,
      tools: {
        expoCli: cat07ToolRecordFromBinding(
          toolBindings.expoCli,
          String(expoPackage.version ?? ''),
        ),
        git: cat07ToolRecordFromBinding(toolBindings.git, gitVersion),
        node: cat07ToolRecordFromBinding(toolBindings.node, process.version),
        npmCli: cat07ToolRecordFromBinding(toolBindings.npmCli, npmVersion),
      },
    };
    return {
      bindBrowserTool(browserPath, version, beforeLaunchBinding) {
        const chromiumBasenames = new Set([
          'chrome',
          'chrome.exe',
          'chromium',
          'chromium-browser',
          'google chrome',
          'google-chrome',
          'google-chrome-stable',
        ]);
        assert(
          typeof version === 'string' &&
            /^(?:Chrome|HeadlessChrome)\/[0-9]+(?:\.[0-9]+){1,4}$/u.test(version) &&
            chromiumBasenames.has(String(beforeLaunchBinding?.basename ?? '').toLowerCase()),
          'CAT07 browser product/version is not a reviewed Chromium identifier.',
        );
        assert(
          beforeLaunchBinding?.filePath === cat07CanonicalRegularExecutable(browserPath),
          'CAT07 browser executable is not the pre-launch trusted binding.',
        );
        assertCat07ExecutableBindingStable(beforeLaunchBinding);
        toolBindings.browser = beforeLaunchBinding;
        runtimeProvenance.tools.browser = cat07ToolRecordFromBinding(beforeLaunchBinding, version);
        return runtimeProvenance.tools.browser;
      },
      assertRuntimeStable() {
        const afterSource = verifyCat07ExtractedGitTree(snapshotRoot, extracted.entries, {
          allowedExtraRoots: sourceExtraRoots,
          allowedGeneratedFiles: CAT07_OPTIONAL_GENERATED_SOURCE_FILES,
        });
        const after = buildCat07CombinedRuntimeManifest(snapshotRoot, runtimeRootPaths);
        assert(
          canonicalEvidenceJsonBytes(afterSource).equals(
            canonicalEvidenceJsonBytes(extracted.manifest),
          ),
          'CAT07 committed source bytes changed while the app was served.',
        );
        if (!canonicalEvidenceJsonBytes(after).equals(canonicalEvidenceJsonBytes(runtimeTree))) {
          const runtimeDrift = collectCat07RuntimeDrift(
            runtimeDriftFingerprint,
            buildCat07RuntimeDriftFingerprint(snapshotRoot, runtimeRootPaths),
          );
          throw new Error(
            `CAT07 runtime dependency bytes changed while the app was served${
              runtimeDrift.length > 0 ? `: ${runtimeDrift.join(', ')}` : ''
            }.`,
          );
        }
        for (const [name, binding] of Object.entries(toolBindings)) {
          const expectedTool = runtimeProvenance.tools[name];
          assert(expectedTool, 'CAT07 runtime tool binding is incomplete.');
          const actualBinding = assertCat07ExecutableBindingStable(binding);
          const actualTool = cat07ToolRecordFromBinding(actualBinding, expectedTool.version);
          assert(
            canonicalEvidenceJsonBytes(actualTool).equals(canonicalEvidenceJsonBytes(expectedTool)),
            'CAT07 host or runtime tool bytes changed while the evidence was produced.',
          );
        }
        if (postinstallBinding) assertCat07ExecutableBindingStable(postinstallBinding);
        return true;
      },
      childEnvironment: installation.childEnvironment,
      expoCliBinding: toolBindings.expoCli,
      expoCliPath,
      nodeBinding: toolBindings.node,
      root: snapshotRoot,
      runtimeProvenance,
      sourceGitSha,
      cleanup() {
        assertCat07ScratchDescendant(container);
        cat07RemoveGuardedDirectory(containerGuard, { allowLinks: true });
      },
    };
  } catch (error) {
    try {
      assertCat07ScratchDescendant(container);
      cat07RemoveGuardedDirectory(containerGuard, { allowLinks: true });
    } catch {
      // Preserve the original deterministic setup failure.
    }
    throw error;
  }
}

export function startCat07ImmutableExpoServer({
  appPort,
  childEnvironment,
  evidenceDir,
  expoCliBinding = null,
  expoCliPath,
  launch = spawn,
  nodeExecutable = process.execPath,
  nodeBinding = null,
  snapshotRoot,
}) {
  const boundNode = nodeBinding ?? cat07ExecutableBinding(nodeExecutable);
  const boundExpoCli = expoCliBinding ?? cat07ExecutableBinding(expoCliPath);
  assertCat07ExecutableBindingStable(boundNode);
  assertCat07ExecutableBindingStable(boundExpoCli);
  assert(
    path.isAbsolute(expoCliPath) &&
      path.relative(snapshotRoot, expoCliPath) !== '..' &&
      !path.relative(snapshotRoot, expoCliPath).startsWith(`..${path.sep}`),
    'CAT07 Expo CLI must be inside the immutable source snapshot.',
  );
  const expoArgs = ['start', '--web', '--clear', '--port', String(appPort), '--host', 'localhost'];
  const args = buildCat07ScrubbedNodeArgs(expoCliPath, expoArgs, childEnvironment);
  const logPath = path.join(evidenceDir, `expo-${safeArtifactId(CAT07_FIXTURE_GROUP.id)}.log`);
  writeCat07EvidenceArtifact(
    evidenceDir,
    path.basename(logPath),
    'CAT07 Expo log capture is active; raw child output is held in memory.\n',
  );
  const child = launch(nodeExecutable, args, {
    cwd: path.join(snapshotRoot, 'apps', 'mobile'),
    env: childEnvironment,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  assertCat07ExecutableBindingStable(boundNode);
  assertCat07ExecutableBindingStable(boundExpoCli);
  const logState = {
    exitCode: null,
    exited: false,
    finalized: false,
    inputBytes: 0,
    launchFailure: false,
    overflow: false,
    rawChunks: [],
    signal: null,
  };
  Object.defineProperty(child, 'cat07LogState', { value: logState });
  child.on('error', () => {
    logState.launchFailure = true;
    logState.rawChunks.length = 0;
  });
  child.on('exit', (exitCode, signal) => {
    logState.exitCode = exitCode;
    logState.exited = true;
    logState.signal = signal;
  });
  const append = (chunk) => {
    if (logState.overflow || logState.finalized) return;
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    logState.inputBytes = Math.min(Number.MAX_SAFE_INTEGER, logState.inputBytes + bytes.length);
    if (logState.inputBytes > CAT07_MAX_EXPO_LOG_BYTES) {
      logState.overflow = true;
      logState.rawChunks.length = 0;
      try {
        child.kill();
      } catch {
        // The stable overflow failure remains authoritative.
      }
      return;
    }
    logState.rawChunks.push(Buffer.from(bytes));
  };
  child.stdout.on('data', append);
  child.stderr.on('data', append);
  return child;
}

export function finalizeCat07ExpoLog(evidenceDir, child) {
  const logPath = path.join(evidenceDir, `expo-${safeArtifactId(CAT07_FIXTURE_GROUP.id)}.log`);
  const state = child?.cat07LogState;
  let contents = 'CAT07 Expo log was unavailable.\n';
  if (state) {
    state.finalized = true;
    if (state.overflow) {
      contents =
        'CAT07 Expo child log exceeded its reviewed byte ceiling; raw output was discarded.\n';
    } else {
      const raw = Buffer.concat(state.rawChunks, state.inputBytes);
      state.rawChunks.length = 0;
      const sanitized = sanitizeEvidenceDiagnosticForDisplay(
        sanitizeCat04DiagnosticText(raw.toString('utf8')),
        { maxBytes: CAT07_MAX_EXPO_LOG_BYTES - 1, maxLines: 10_000 },
      );
      contents = sanitized.length > 0 ? `${sanitized}\n` : '';
    }
  }
  writeCat07EvidenceArtifact(evidenceDir, path.basename(logPath), contents);
  return logPath;
}

export function cat07BrowserArguments({ userDataDir }) {
  return [
    '--headless',
    '--remote-debugging-port=0',
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-client-side-phishing-detection',
    '--disable-component-update',
    '--disable-default-apps',
    '--disable-domain-reliability',
    '--disable-extensions',
    '--disable-gpu-sandbox',
    '--disable-sync',
    '--hide-scrollbars',
    '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1',
    '--in-process-gpu',
    '--proxy-server=127.0.0.1:9',
    '--proxy-bypass-list=localhost;127.0.0.1',
    '--safebrowsing-disable-auto-update',
    'about:blank',
  ];
}

export function parseCat07DevToolsActivePort(bytes) {
  assert(
    Buffer.isBuffer(bytes) && bytes.length > 0 && bytes.length <= 1_024,
    'CAT07 DevToolsActivePort bytes are invalid.',
  );
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Error('CAT07 DevToolsActivePort is not valid UTF-8.');
  }
  const match = /^([1-9][0-9]{0,4})\r?\n(\/devtools\/browser\/[A-Za-z0-9._:-]{1,256})\r?\n?$/u.exec(
    text,
  );
  assert(match, 'CAT07 DevToolsActivePort does not use the exact reviewed shape.');
  const port = Number(match[1]);
  assert(Number.isSafeInteger(port) && port <= 65_535, 'CAT07 DevToolsActivePort port is invalid.');
  return { browserPath: match[2], port };
}

export function parseCat07WindowsTcpListeners(output, port) {
  assert(
    Number.isSafeInteger(port) && port > 0 && port <= 65_535,
    'CAT07 listener port is invalid.',
  );
  assert(
    typeof output === 'string' && Buffer.byteLength(output, 'utf8') <= 2 * 1024 * 1024,
    'CAT07 listener inventory exceeds its byte ceiling.',
  );
  const listeners = [];
  for (const line of output.split(/\r?\n/u)) {
    const fields = line.trim().split(/\s+/u);
    if (fields.length !== 5 || fields[0].toUpperCase() !== 'TCP' || fields[3] !== 'LISTENING') {
      continue;
    }
    const portMatch = /:(\d{1,5})$/u.exec(fields[1]);
    if (!portMatch || Number(portMatch[1]) !== port) continue;
    const address = fields[1].slice(0, -(portMatch[1].length + 1)).toLowerCase();
    assert(
      address === '127.0.0.1' || address === '[::1]' || address === '::1',
      'CAT07 listener escaped the loopback interface.',
    );
    const pid = Number(fields[4]);
    assert(Number.isSafeInteger(pid) && pid > 0, 'CAT07 listener PID is invalid.');
    listeners.push({ address, pid });
  }
  assert(listeners.length > 0, 'CAT07 could not bind the reviewed loopback listener.');
  return listeners;
}

export function assertCat07ListenerOwnedByChild({
  child,
  execute = execFileSync,
  platform = process.platform,
  port,
}) {
  assert(
    Number.isSafeInteger(child?.pid) && child.pid > 0,
    'CAT07 listener owner process is unavailable.',
  );
  let ownerPids;
  if (platform === 'win32') {
    const systemRoot = path.join(path.parse(path.resolve(process.execPath)).root, 'Windows');
    const netstatPath = path.join(systemRoot, 'System32', 'netstat.exe');
    const binding = cat07ExecutableBinding(netstatPath);
    const output = execute(netstatPath, ['-ano', '-p', 'tcp'], {
      encoding: 'utf8',
      env: {
        PATH: path.join(systemRoot, 'System32'),
        SystemRoot: systemRoot,
        TEMP: path.resolve(tmpdir()),
        TMP: path.resolve(tmpdir()),
        WINDIR: systemRoot,
      },
      maxBuffer: 2 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 30_000,
      windowsHide: true,
    });
    assertCat07ExecutableBindingStable(binding);
    ownerPids = parseCat07WindowsTcpListeners(output, port).map(({ pid }) => pid);
  } else {
    const lsofPath = ['/usr/sbin/lsof', '/usr/bin/lsof']
      .map((candidate) => cat07CanonicalRegularExecutable(candidate))
      .find(Boolean);
    assert(lsofPath, 'CAT07 requires a fixed trusted lsof executable to bind its listener PID.');
    const binding = cat07ExecutableBinding(lsofPath);
    const output = execute(lsofPath, ['-nP', '-a', `-iTCP:${port}`, '-sTCP:LISTEN', '-Fp'], {
      encoding: 'utf8',
      env: { LANG: 'C', LC_ALL: 'C', PATH: path.dirname(lsofPath) },
      maxBuffer: 256 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 30_000,
    });
    assertCat07ExecutableBindingStable(binding);
    ownerPids = output
      .split(/\r?\n/u)
      .filter((line) => /^p[1-9][0-9]*$/u.test(line))
      .map((line) => Number(line.slice(1)));
    assert(ownerPids.length > 0, 'CAT07 could not bind the reviewed loopback listener.');
  }
  assert(
    ownerPids.every((pid) => pid === child.pid),
    'CAT07 listener is not owned exclusively by its launched child process.',
  );
  return true;
}

export async function waitForCat07DevToolsActivePort({
  browser,
  profileGuard,
  timeoutMs = 20_000,
  userDataDir,
}) {
  assert(
    profileGuard?.root === path.resolve(userDataDir),
    'CAT07 browser profile guard is invalid.',
  );
  const activePortPath = path.join(profileGuard.root, 'DevToolsActivePort');
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    assertCat07DirectoryGuardStable(profileGuard);
    assert(!browser?.cat07LaunchState?.launchFailure, 'CAT07 browser child failed to launch.');
    assert(!browser?.cat07LaunchState?.exited, 'CAT07 browser child exited before CDP binding.');
    try {
      const bytes = readBoundedRegularFile(activePortPath, {
        containmentRoot: profileGuard.root,
        maxBytes: 1_024,
      });
      const binding = parseCat07DevToolsActivePort(bytes);
      assertCat07DirectoryGuardStable(profileGuard);
      return binding;
    } catch (error) {
      lastError = error;
      await delay(50);
    }
  }
  throw new Error(
    `CAT07 browser did not publish a valid guarded DevToolsActivePort: ${
      lastError instanceof Error ? lastError.message : 'timeout'
    }`,
  );
}

export function startCat07Browser({
  browserPath,
  environment,
  executableBinding = null,
  launch = spawn,
  userDataDir,
}) {
  const binding = executableBinding ?? cat07ExecutableBinding(browserPath);
  assert(
    binding.filePath === cat07CanonicalRegularExecutable(browserPath),
    'CAT07 browser launch path changed.',
  );
  assertCat07ExecutableBindingStable(binding);
  const args = cat07BrowserArguments({ userDataDir });
  const child = launch(browserPath, args, {
    env: environment,
    stdio: 'ignore',
    windowsHide: true,
  });
  Object.defineProperty(child, 'cat07LaunchState', {
    value: { args, exitCode: null, exited: false, launchFailure: false, signal: null },
  });
  child.on('error', () => {
    child.cat07LaunchState.launchFailure = true;
  });
  child.on('exit', (exitCode, signal) => {
    child.cat07LaunchState.exitCode = exitCode;
    child.cat07LaunchState.exited = true;
    child.cat07LaunchState.signal = signal;
  });
  return child;
}

function writeReport(evidenceDir, summary) {
  const bootstrapRows = summary.bootstrapResults.map(
    (result) =>
      `| ${result.viewport.width}x${result.viewport.height} | ${result.verdict} | ${result.error ?? ''} |`,
  );
  const rows = summary.scenarios.map(
    (result) =>
      `| ${result.viewport.width}x${result.viewport.height} | ${result.verdict} | ${result.error ?? ''} |`,
  );
  const lines = [
    '# CAT07 Shelf Freshness Expo-Web Audit',
    '',
    `- Verdict: ${summary.verdict}`,
    '- Surface: Expo web deterministic local-development fixture',
    '- Native-device proof: No',
    `- Source Git SHA: ${summary.sourceGitSha}`,
    `- Run ID: ${summary.runId}`,
    `- Package-lock SHA-256: ${summary.runtimeProvenance?.packageLock?.sha256 ?? 'unavailable'}`,
    `- Installed runtime tree SHA-256: ${summary.runtimeProvenance?.runtimeTree?.sha256 ?? 'unavailable'}`,
    ...summary.limitations.map((limitation) => `- Limitation: ${limitation}`),
    '',
    '## Explicit-consent bootstrap',
    '',
    '| Viewport | Verdict | Error |',
    '| --- | --- | --- |',
    ...bootstrapRows,
    '',
    '## Freshness and replacement lifecycle',
    '',
    '| Viewport | Verdict | Error |',
    '| --- | --- | --- |',
    ...rows,
    '',
    '## Verified local UI outcomes',
    '',
    ...summary.verifiedOutcomes.map((outcome) => `- ${outcome}`),
    '',
    'Machine-readable result: `summary.json`',
    '',
  ];
  writeCat07EvidenceArtifact(evidenceDir, 'report.md', `${lines.join('\n')}\n`);
}

function buildCat07ArtifactManifest(evidenceDir, artifacts) {
  return artifacts.map((artifact) => {
    const bytes = readBoundedRegularFile(path.join(evidenceDir, artifact), {
      containmentRoot: evidenceDir,
      maxBytes: artifact.endsWith('.png')
        ? CAT07_MAX_DIAGNOSTIC_ARTIFACT_BYTES * 2
        : CAT07_MAX_DIAGNOSTIC_ARTIFACT_BYTES,
    });
    return { bytes: bytes.length, path: artifact, sha256: sha256(bytes) };
  });
}

async function installCat07CaptureMarker(client, { artifact, runId, viewport }) {
  const markerBase64 = buildCat07CaptureMarkerRgba(runId, viewport.id, artifact).toString('base64');
  const installed = await evaluate(
    client,
    `(() => {
      const markerId = '__onskin_cat07_capture_binding__';
      document.getElementById(markerId)?.remove();
      const canvas = document.createElement('canvas');
      canvas.id = markerId;
      canvas.width = ${CAT07_CAPTURE_MARKER_SIZE};
      canvas.height = ${CAT07_CAPTURE_MARKER_SIZE};
      canvas.setAttribute('aria-hidden', 'true');
      Object.assign(canvas.style, {
        bottom: '0',
        height: '${CAT07_CAPTURE_MARKER_SIZE}px',
        imageRendering: 'pixelated',
        pointerEvents: 'none',
        position: 'fixed',
        right: '0',
        width: '${CAT07_CAPTURE_MARKER_SIZE}px',
        zIndex: '2147483647',
      });
      const binary = atob(${JSON.stringify(markerBase64)});
      const pixels = new Uint8ClampedArray(binary.length);
      for (let index = 0; index < binary.length; index += 1) pixels[index] = binary.charCodeAt(index);
      const context = canvas.getContext('2d', { alpha: false });
      if (!context) return false;
      context.putImageData(new ImageData(pixels, canvas.width, canvas.height), 0, 0);
      document.documentElement.appendChild(canvas);
      return canvas.getBoundingClientRect().width === ${CAT07_CAPTURE_MARKER_SIZE} &&
        canvas.getBoundingClientRect().height === ${CAT07_CAPTURE_MARKER_SIZE};
    })()`,
  );
  assert(installed === true, 'CAT07 could not install its capture-only pixel binding.');
}

async function removeCat07CaptureMarker(client) {
  try {
    await evaluate(
      client,
      `(() => {
        document.getElementById('__onskin_cat07_capture_binding__')?.remove();
        return true;
      })()`,
    );
  } catch {
    // The surrounding capture/navigation failure remains authoritative.
  }
}

async function captureStep(client, evidenceDir, artifactName, { captureState, runId, viewport }) {
  const artifact = `${artifactName}.png`;
  assert(captureState && typeof captureState === 'object', 'CAT07 capture state is unavailable.');
  const captureOrdinal = captureState.nextOrdinal;
  assert(
    CAT07_CAPTURE_ARTIFACT_ORDER[captureOrdinal - 1] === artifact,
    `CAT07 capture chronology expected ${CAT07_CAPTURE_ARTIFACT_ORDER[captureOrdinal - 1] ?? 'no further artifact'}, received ${artifact}.`,
  );
  await installCat07CaptureMarker(client, { artifact, runId, viewport });
  try {
    await delay(250);
    const snapshot = await evaluate(client, auditExpression());
    assertSnapshotClean(snapshot, artifactName);
    const screenshot = await client.send('Page.captureScreenshot', {
      captureBeyondViewport: false,
      format: 'png',
    });
    writeCat07EvidenceArtifact(evidenceDir, artifact, screenshot.data, { encoding: 'base64' });
    const screenshotBytes = readBoundedRegularFile(path.join(evidenceDir, artifact), {
      containmentRoot: evidenceDir,
      maxBytes: CAT07_MAX_DIAGNOSTIC_ARTIFACT_BYTES * 2,
    });
    validateCat07ScreenshotArtifact(artifact, screenshotBytes, { runId });
    const browserEventCursor = client.events.length;
    const capturedAt = new Date().toISOString();
    const boundSnapshot = {
      ...snapshot,
      captureBinding: {
        artifact,
        browserEventCursor,
        capturedAt,
        captureOrdinal,
        runId,
        schemaVersion: CAT07_CAPTURE_BINDING_SCHEMA_VERSION,
        screenshotBytes: screenshotBytes.length,
        screenshotSha256: sha256(screenshotBytes),
        sourceGitSha: captureState.sourceGitSha,
        viewportId: viewport.id,
      },
    };
    writeCat07Json(evidenceDir, `${artifactName}.json`, boundSnapshot);
    captureState.nextOrdinal += 1;
    return boundSnapshot;
  } finally {
    await removeCat07CaptureMarker(client);
  }
}

async function captureFailure(client, evidenceDir, artifactPrefix, { runId, viewport }) {
  if (!client) return [];
  const name = `${artifactPrefix}-failure.png`;
  try {
    await installCat07CaptureMarker(client, { artifact: name, runId, viewport });
    const screenshot = await client.send('Page.captureScreenshot', {
      captureBeyondViewport: false,
      format: 'png',
    });
    writeCat07EvidenceArtifact(evidenceDir, name, screenshot.data, { encoding: 'base64' });
    validateCat07ScreenshotArtifact(
      name,
      readBoundedRegularFile(path.join(evidenceDir, name), {
        containmentRoot: evidenceDir,
        maxBytes: CAT07_MAX_DIAGNOSTIC_ARTIFACT_BYTES * 2,
      }),
      { runId },
    );
    return [name];
  } catch {
    return [];
  } finally {
    await removeCat07CaptureMarker(client);
  }
}

async function establishCat07LocalHealthConsent({
  client,
  baseUrl,
  captureState,
  evidenceDir,
  runId,
  viewport,
}) {
  const artifactPrefix = safeArtifactId(`bootstrap-${CAT07_FIXTURE_GROUP.id}-${viewport.id}`);
  const eventStart = client.events.length;
  const result = {
    artifactPrefix,
    browserFailures: [],
    completedAt: null,
    endUrl: null,
    error: null,
    fixtureGroup: CAT07_FIXTURE_GROUP.id,
    nativeDeviceProof: false,
    runId,
    startedAt: new Date().toISOString(),
    surface: 'expo-web',
    verdict: 'fail',
    viewport,
  };

  try {
    await setViewport(client, viewport);
    const resetUrl = new URL('/', baseUrl);
    resetUrl.searchParams.set('e2eReset', 'local');
    resetUrl.searchParams.set(
      'cat04Bootstrap',
      cat07BrowserMarker(runId, viewport.id, 'bootstrap'),
    );
    await client.send('Page.navigate', { url: resetUrl.toString() });
    await waitForText(client, 'Begin', 60_000);
    await clickByText(client, 'Begin');
    await waitForPath(client, '/onboarding/age');
    await waitForText(client, 'First, your');
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
    await waitForText(client, 'Before the quiz');
    await clickByText(client, 'I agree. Continue');
    await waitForPath(client, '/onboarding/goals');
    await waitForText(client, 'What brings you here?');

    const probeDeadline = Date.now() + 30_000;
    let catalogReady = false;
    while (Date.now() < probeDeadline && !catalogReady) {
      const probeUrl = new URL('/shelf/search', baseUrl);
      probeUrl.searchParams.set(
        'cat04ConsentProbe',
        cat07BrowserMarker(runId, viewport.id, 'consent-probe'),
      );
      await client.send('Page.navigate', { url: probeUrl.toString() });
      await delay(1_000);
      catalogReady = await evaluate(
        client,
        `window.location.pathname === '/shelf/search' && document.body?.innerText.includes('Search catalog')`,
      );
    }
    assert(catalogReady, 'Explicit local consent did not release the CAT07 catalog route.');
    await waitForNetworkIdle(client, 10_000);
    await captureStep(client, evidenceDir, `${artifactPrefix}-catalog-ready`, {
      captureState,
      runId,
      viewport,
    });
    result.browserFailures = classifyCat07ProjectedBrowserFailures(client.events.slice(eventStart));
    assert(
      result.browserFailures.length === 0,
      `CAT07 consent bootstrap emitted ${result.browserFailures.length} browser failure(s).`,
    );
    result.endUrl = await evaluate(client, 'location.href');
    result.verdict = 'pass';
  } catch (error) {
    result.error =
      sanitizeEvidenceDiagnosticForDisplay(
        error instanceof Error ? error.message : String(error),
      ) || 'CAT07 consent bootstrap failed without safe diagnostics.';
    result.browserFailures = classifyCat07ProjectedBrowserFailures(client.events.slice(eventStart));
    result.failureArtifacts = await captureFailure(client, evidenceDir, artifactPrefix, {
      runId,
      viewport,
    });
  } finally {
    result.completedAt = new Date().toISOString();
    writeCat07Json(evidenceDir, `${artifactPrefix}-result.json`, result);
  }

  return result;
}

async function addFreshnessProduct({
  client,
  baseUrl,
  captureState,
  evidenceDir,
  viewport,
  artifactPrefix,
  runId,
}) {
  const productName = `CAT07 Label PAO ${viewport.width}`;
  await navigate(client, baseUrl, '/shelf/manual', viewport, `${artifactPrefix}-manual`, {
    cat04Audit: cat07BrowserMarker(runId, viewport.id, 'manual'),
  });
  await waitForText(client, 'Add by hand');
  await fillByLabel(client, 'Product name', productName);
  await fillByLabel(client, 'Brand', 'Evidence Lab');
  await clickByText(client, 'Category');
  await waitForText(client, 'Product category');
  await clickByText(client, 'Serum');
  await scrollControlIntoView(client, 'Continue');
  const manual = await captureStep(client, evidenceDir, `${artifactPrefix}-01-manual`, {
    captureState,
    runId,
    viewport,
  });
  assertInteractiveControl(manual, 'Continue');
  await clickByText(client, 'Continue');

  await waitForPath(client, '/shelf/opened');
  await waitForText(client, 'When did you open it?');
  await scrollControlIntoView(client, 'Add to shelf');
  const openingRequired = await captureStep(
    client,
    evidenceDir,
    `${artifactPrefix}-02-opening-required`,
    { captureState, runId, viewport },
  );
  assertDisabledControl(openingRequired, 'Add to shelf');

  await scrollControlIntoView(client, 'Pick a date');
  await clickByText(client, 'Pick a date');
  await fillByLabel(client, 'Exact opened date', localDatePlusDays(1));
  await waitForText(client, 'Enter a real date no later than today');
  await scrollControlIntoView(client, 'Add to shelf');
  const futureDate = await captureStep(
    client,
    evidenceDir,
    `${artifactPrefix}-03-future-opened-date-blocked`,
    { captureState, runId, viewport },
  );
  assertDisabledControl(futureDate, 'Add to shelf');

  const openedAt = localDatePlusDays(-330);
  await fillByLabel(client, 'Exact opened date', openedAt);
  await scrollControlIntoView(client, 'Edit period after opening');
  await clickByText(client, 'Edit period after opening');
  await waitForText(client, 'Choose the months printed beside the open-jar symbol.');
  await scrollControlIntoView(client, '12 mo');
  await clickByText(client, '12 mo');
  await waitForText(client, 'PAO: 12 months after opening');
  await waitForCondition(
    client,
    enabledControlExpression('Add to shelf'),
    10_000,
    'enabled CAT07 Shelf save after explicit opening state',
  );
  await scrollControlIntoView(client, 'Add to shelf');
  const ready = await captureStep(client, evidenceDir, `${artifactPrefix}-04-label-pao-ready`, {
    captureState,
    runId,
    viewport,
  });
  assertInteractiveControl(ready, 'Add to shelf');
  assert(
    ready.bodyText.includes('PAO: 12 months after opening') &&
      ready.bodyText.includes('from label'),
    'CAT07 intake did not identify the user-confirmed label PAO.',
  );
  await clickByText(client, 'Add to shelf');
  await waitForCondition(
    client,
    `window.location.pathname === '/shelf'`,
    30_000,
    'CAT07 Shelf after product save',
  );
  await waitForText(client, productName);
  const shelf = await captureStep(client, evidenceDir, `${artifactPrefix}-05-shelf-countdown`, {
    captureState,
    runId,
    viewport,
  });
  assert(shelf.bodyText.includes(productName), 'CAT07 saved product did not appear on Shelf.');
  return { openedAt, productName };
}

async function openProductDetail(client, productName) {
  await scrollControlIntoView(client, productName, { exact: false });
  await clickByText(client, productName, { exact: false });
  await waitForCondition(
    client,
    `window.location.pathname.startsWith('/shelf/') &&
      !['/shelf/manual', '/shelf/opened', '/shelf/archive', '/shelf/replenish'].includes(window.location.pathname)`,
    30_000,
    'CAT07 product detail',
  );
  await waitForText(client, productName);
}

async function runFreshnessScenario({
  client,
  baseUrl,
  captureState,
  evidenceDir,
  runId,
  viewport,
}) {
  const artifactPrefix = safeArtifactId(`freshness-lifecycle-${viewport.id}`);
  const eventStart = client.events.length;
  const result = {
    artifactPrefix,
    browserFailures: [],
    completedAt: null,
    distinctReplacementIdentity: false,
    error: null,
    nativeDeviceProof: false,
    runId,
    scenarioId: 'freshness-replacement-lifecycle',
    startedAt: new Date().toISOString(),
    surface: 'expo-web',
    verdict: 'fail',
    viewport,
  };

  try {
    const { productName } = await addFreshnessProduct({
      artifactPrefix,
      baseUrl,
      captureState,
      client,
      evidenceDir,
      runId,
      viewport,
    });
    await openProductDetail(client, productName);
    const originalDetailPath = await evaluate(client, 'window.location.pathname');
    await scrollControlIntoView(client, 'Edit period after opening');
    const initialDetail = await captureStep(
      client,
      evidenceDir,
      `${artifactPrefix}-06-label-pao-detail`,
      { captureState, runId, viewport },
    );
    assert(
      initialDetail.bodyText.includes('PAO 12 months') &&
        initialDetail.bodyText.includes('from label'),
      'CAT07 detail lost label PAO provenance.',
    );
    assert(
      initialDetail.bodyText.includes('Date unknown'),
      'CAT07 detail fabricated a package date before user entry.',
    );

    await scrollControlIntoView(client, 'Set date printed on this package');
    await clickByText(client, 'Set date printed on this package');
    await fillByLabel(client, 'Exact package date', localDatePlusDays(7));
    await scrollControlIntoView(client, 'Save package date');
    await clickByText(client, 'Save package date');
    await waitForText(client, 'recorded as printed');
    await scrollControlIntoView(client, 'Set date printed on this package');
    const printedDetail = await captureStep(
      client,
      evidenceDir,
      `${artifactPrefix}-07-package-date-recorded`,
      { captureState, runId, viewport },
    );
    assert(
      printedDetail.bodyText.includes('recorded as printed'),
      'CAT07 detail did not bind the exact-package date to user entry.',
    );

    await scrollControlIntoView(client, 'Replace');
    await clickByText(client, 'Replace');
    await waitForPath(client, '/shelf/replenish');
    await waitForText(client, 'New unit is unopened');
    await scrollTextIntoView(client, 'New unit was opened earlier');
    const choices = await captureStep(
      client,
      evidenceDir,
      `${artifactPrefix}-08-replacement-choices`,
      { captureState, runId, viewport },
    );
    for (const choice of [
      'I opened a new unit today',
      'New unit was opened earlier',
      'New unit is unopened',
    ]) {
      assert(choices.bodyText.includes(choice), `CAT07 replacement did not expose ${choice}.`);
    }
    assert(
      choices.bodyText.includes(
        'This reminder comes from the package date recorded on your Shelf.',
      ),
      'CAT07 replacement lost its exact-package reminder provenance.',
    );

    await scrollControlIntoView(client, 'New unit was opened earlier', { exact: false });
    await clickByText(client, 'New unit was opened earlier', { exact: false });
    await fillByLabel(client, 'Exact opened date', localDatePlusDays(1));
    await waitForText(client, 'Enter a real date no later than today');
    await scrollControlIntoView(client, 'Save replacement with this date');
    const futureReplacement = await captureStep(
      client,
      evidenceDir,
      `${artifactPrefix}-09-future-replacement-date-blocked`,
      { captureState, runId, viewport },
    );
    assertDisabledControl(futureReplacement, 'Save replacement with this date');

    await scrollControlIntoView(client, 'New unit is unopened', { exact: false });
    await clickByText(client, 'New unit is unopened', { exact: false });
    await waitForCondition(
      client,
      `window.location.pathname === '/shelf'`,
      30_000,
      'CAT07 Shelf after unopened replacement',
    );
    await waitForText(client, productName);
    const replacementShelf = await captureStep(
      client,
      evidenceDir,
      `${artifactPrefix}-10-unopened-replacement-shelf`,
      { captureState, runId, viewport },
    );
    assert(
      replacementShelf.bodyText.includes(productName),
      'CAT07 unopened replacement is missing from Shelf.',
    );

    await openProductDetail(client, productName);
    const replacementDetailPath = await evaluate(client, 'window.location.pathname');
    result.distinctReplacementIdentity = originalDetailPath !== replacementDetailPath;
    assert(
      result.distinctReplacementIdentity,
      'CAT07 replacement reused the archived package route identity.',
    );
    await scrollControlIntoView(client, 'Set date printed on this package');
    const replacementDetail = await captureStep(
      client,
      evidenceDir,
      `${artifactPrefix}-11-unopened-replacement-detail`,
      { captureState, runId, viewport },
    );
    assert(
      replacementDetail.bodyText.includes('Opened not opened yet') &&
        replacementDetail.bodyText.includes('PAO 12 months') &&
        replacementDetail.bodyText.includes('from label') &&
        replacementDetail.bodyText.includes('Recorded package date not entered') &&
        replacementDetail.bodyText.includes('Date unknown'),
      'CAT07 unopened replacement did not preserve PAO while clearing the PAO clock and package date.',
    );

    await navigate(client, baseUrl, '/shelf', viewport, `${artifactPrefix}-persisted-shelf`, {
      cat04Audit: cat07BrowserMarker(runId, viewport.id, 'persisted-shelf'),
    });
    await waitForText(client, productName);
    await clickByText(client, 'Expiring');
    await waitForText(client, 'Nothing needs replacing right now.');
    const expiring = await captureStep(
      client,
      evidenceDir,
      `${artifactPrefix}-12-unknown-excluded-from-expiring`,
      { captureState, runId, viewport },
    );
    assert(
      !expiring.bodyText.includes(productName),
      'CAT07 Expiring filter treated the unopened unknown-date package as actionable.',
    );

    await scrollControlIntoView(client, 'View archive', { exact: false });
    await clickByText(client, 'View archive', { exact: false });
    await waitForPath(client, '/shelf/archive');
    await waitForText(client, productName);
    const archive = await captureStep(client, evidenceDir, `${artifactPrefix}-13-archive-history`, {
      captureState,
      runId,
      viewport,
    });
    assert(
      archive.bodyText.includes(productName) && archive.bodyText.includes('finished'),
      'CAT07 archive did not retain the previous package.',
    );

    await openProductDetail(client, productName);
    const archivedDetailPath = await evaluate(client, 'window.location.pathname');
    assert(
      archivedDetailPath === originalDetailPath && archivedDetailPath !== replacementDetailPath,
      'CAT07 archive/detail identities do not prove a distinct replacement lineage.',
    );
    await scrollControlIntoView(client, 'Set date printed on this package');
    const archivedDetail = await captureStep(
      client,
      evidenceDir,
      `${artifactPrefix}-14-archived-provenance`,
      { captureState, runId, viewport },
    );
    assert(
      archivedDetail.bodyText.includes('PAO 12 months') &&
        archivedDetail.bodyText.includes('from label') &&
        archivedDetail.bodyText.includes('recorded as printed'),
      'CAT07 archived package lost its opening/PAO/printed-date provenance.',
    );

    await waitForNetworkIdle(client, 10_000);
    result.browserFailures = classifyCat07ProjectedBrowserFailures(client.events.slice(eventStart));
    assert(
      result.browserFailures.length === 0,
      `CAT07 emitted ${result.browserFailures.length} browser failure(s).`,
    );
    result.endUrl = await evaluate(client, 'window.location.href');
    result.productName = productName;
    result.verdict = 'pass';
  } catch (error) {
    result.error =
      sanitizeEvidenceDiagnosticForDisplay(
        error instanceof Error ? error.message : String(error),
      ) || 'CAT07 lifecycle failed without safe diagnostics.';
    result.browserFailures = classifyCat07ProjectedBrowserFailures(client.events.slice(eventStart));
    result.failureArtifacts = await captureFailure(client, evidenceDir, artifactPrefix, {
      runId,
      viewport,
    });
  } finally {
    result.completedAt = new Date().toISOString();
    writeCat07Json(evidenceDir, `${artifactPrefix}-result.json`, result);
  }
  return result;
}

function assertPacketHygiene(evidenceDir, artifacts, summary) {
  for (const artifact of artifacts) {
    const bytes = readBoundedRegularFile(path.join(evidenceDir, artifact), {
      containmentRoot: evidenceDir,
      maxBytes: artifact.endsWith('.png')
        ? CAT07_MAX_DIAGNOSTIC_ARTIFACT_BYTES * 2
        : CAT07_MAX_DIAGNOSTIC_ARTIFACT_BYTES,
    });
    let failures = [];
    if (artifact.endsWith('.json')) {
      failures = inspectCanonicalEvidenceJson(artifact, bytes, {
        allowLocalhostUrlQuery: true,
        maxBytes: CAT07_MAX_DIAGNOSTIC_ARTIFACT_BYTES,
        maxStringBytes: CAT07_MAX_DIAGNOSTIC_STRING_BYTES,
      }).failures;
    } else if (/\.(?:log|md)$/iu.test(artifact)) {
      failures = collectEvidenceTextArtifactHygieneFailures(artifact, bytes, {
        allowLocalhostUrlQuery: true,
        maxBytes: artifact.endsWith('.log')
          ? CAT07_MAX_EXPO_LOG_BYTES
          : CAT07_MAX_DIAGNOSTIC_ARTIFACT_BYTES,
      });
    } else if (artifact.endsWith('.png')) {
      try {
        validateCat07ScreenshotArtifact(artifact, bytes, { runId: summary.runId });
      } catch (error) {
        failures.push(error instanceof Error ? error.message : String(error));
      }
    }
    assert(failures.length === 0, `CAT07 artifact hygiene failed for ${artifact}: ${failures[0]}`);
  }

  const summaryFailures = collectEvidenceDiagnosticValueFailures('summary.json', summary, {
    allowLocalhostUrlQuery: true,
    maxStringBytes: CAT07_MAX_DIAGNOSTIC_STRING_BYTES,
  });
  const canonicalSummary = inspectCanonicalEvidenceJson(
    'summary.json',
    canonicalEvidenceJsonBytes(summary),
    {
      allowLocalhostUrlQuery: true,
      maxBytes: CAT07_MAX_DIAGNOSTIC_ARTIFACT_BYTES,
      maxStringBytes: CAT07_MAX_DIAGNOSTIC_STRING_BYTES,
    },
  );
  summaryFailures.push(...canonicalSummary.failures);
  assert(
    summaryFailures.length === 0,
    `CAT07 artifact hygiene failed for summary.json: ${summaryFailures[0]}`,
  );
}

export async function runCat07ShelfFreshnessAudit({
  evidenceDir = process.env.CAT07_E2E_EVIDENCE_DIR
    ? path.resolve(repoRoot, process.env.CAT07_E2E_EVIDENCE_DIR)
    : CAT07_EVIDENCE_DIRECTORY,
  requestedAppPort = Number(process.env.CAT07_E2E_PORT ?? 8720),
} = {}) {
  evidenceDir = validateCat07EvidenceDirectory(evidenceDir);
  const configuration = validateCat07AuditConfiguration();
  assertCat07SourceSafetyContract();
  const sourceGitSha = assertCat07SourceProvenance();
  const runId = `cat07-${randomUUID()}`;
  const captureState = { nextOrdinal: 1, sourceGitSha };
  clearPreviousEvidence(evidenceDir);
  const summary = {
    artifacts: [],
    artifactManifest: [],
    bootstrapResults: [],
    completedAt: null,
    expectedBootstrapCount: CAT07_REQUIRED_VIEWPORTS.length,
    expectedExecutionCount: configuration.executionCount,
    limitations: CAT07_AUDIT_LIMITATIONS,
    nativeDeviceProof: false,
    requiredViewports: CAT07_REQUIRED_VIEWPORTS,
    runId,
    runtimeProvenance: null,
    scenarios: [],
    schemaVersion: CAT07_EVIDENCE_SCHEMA_VERSION,
    sourceGitSha,
    startedAt: new Date().toISOString(),
    surface: 'expo-web',
    verdict: 'fail',
    verifiedOutcomes: CAT07_VERIFIED_OUTCOMES,
  };

  let userDataDir = null;
  let server = null;
  let browser = null;
  let client = null;
  let immutableSource = null;
  let sourceMonitor = null;
  let browserExecutableBinding = null;
  let userDataGuard = null;
  try {
    const appPort = await findAvailablePort(requestedAppPort);
    const baseUrl = `http://localhost:${appPort}`;
    const browserPath = findCat07TrustedBrowserExecutable();
    browserExecutableBinding = cat07ExecutableBinding(browserPath);
    const systemTempRoot = path.resolve(tmpdir());
    const systemTempGuard = cat07CreateDirectoryGuard(systemTempRoot, path.dirname(systemTempRoot));
    assertCat07DirectoryGuardStable(systemTempGuard);
    userDataDir = mkdtempSync(path.join(systemTempRoot, 'cat07-shelf-freshness-'));
    assertCat07DirectoryGuardStable(systemTempGuard);
    userDataGuard = cat07CreateDirectoryGuard(userDataDir, systemTempRoot);
    immutableSource = createCat07ImmutableSourceSnapshot(sourceGitSha);
    immutableSource.runtimeProvenance.browserLaunch = {
      args: cat07BrowserArguments({ userDataDir: '<fresh-profile>' }).map((argument) =>
        argument.startsWith('--user-data-dir=') ? '--user-data-dir=<fresh-profile>' : argument,
      ),
      schemaVersion: CAT07_BROWSER_LAUNCH_SCHEMA_VERSION,
    };
    summary.runtimeProvenance = immutableSource.runtimeProvenance;
    sourceMonitor = createCat07SourceMutationMonitor({ rootPath: immutableSource.root });
    server = startCat07ImmutableExpoServer({
      appPort,
      childEnvironment: immutableSource.childEnvironment,
      evidenceDir,
      expoCliBinding: immutableSource.expoCliBinding,
      expoCliPath: immutableSource.expoCliPath,
      nodeBinding: immutableSource.nodeBinding,
      snapshotRoot: immutableSource.root,
    });
    const startedAt = Date.now();
    let serverReady = false;
    while (Date.now() - startedAt < 120_000 && !serverReady) {
      assert(!server.cat07LogState.launchFailure, 'CAT07 Expo child failed to launch.');
      assert(!server.cat07LogState.exited, 'CAT07 Expo child exited before server binding.');
      assert(
        !server.cat07LogState.overflow,
        'CAT07 Expo child log exceeded its reviewed byte ceiling.',
      );
      try {
        const response = await fetch(baseUrl, { redirect: 'manual' });
        serverReady = response.status < 500;
      } catch {
        await delay(500);
      }
    }
    assert(serverReady, `CAT07 Expo server did not become ready at ${baseUrl}.`);
    assert(!server.cat07LogState.exited, 'CAT07 Expo child exited after server readiness.');
    assertCat07ListenerOwnedByChild({ child: server, port: appPort });
    browser = startCat07Browser({
      browserPath,
      environment: immutableSource.childEnvironment,
      executableBinding: browserExecutableBinding,
      userDataDir,
    });
    const devToolsBinding = await waitForCat07DevToolsActivePort({
      browser,
      profileGuard: userDataGuard,
      userDataDir,
    });
    const debugPort = devToolsBinding.port;
    assertCat07ListenerOwnedByChild({ child: browser, port: debugPort });
    client = await connectToInstrumentedCat07Page(debugPort, baseUrl, {
      runId,
      sourceMonitor,
    });
    const browserVersion = await client.send('Browser.getVersion');
    immutableSource.bindBrowserTool(browserPath, browserVersion.product, browserExecutableBinding);
    await waitForCondition(
      client,
      'document.readyState === "complete"',
      60_000,
      'initial CAT07 app',
    );
    await waitForNetworkIdle(client, 10_000);

    for (const viewport of CAT07_REQUIRED_VIEWPORTS) {
      const bootstrap = await establishCat07LocalHealthConsent({
        baseUrl,
        captureState,
        client,
        evidenceDir,
        runId,
        viewport,
      });
      summary.bootstrapResults.push(bootstrap);
      assert(
        bootstrap.verdict === 'pass',
        bootstrap.error ?? `CAT07 consent bootstrap failed at ${viewport.id}.`,
      );
      const scenario = await runFreshnessScenario({
        baseUrl,
        captureState,
        client,
        evidenceDir,
        runId,
        viewport,
      });
      summary.scenarios.push(scenario);
      assert(
        scenario.verdict === 'pass',
        scenario.error ?? `CAT07 freshness lifecycle failed at ${viewport.id}.`,
      );
    }
    await waitForNetworkIdle(client, 10_000);
    assert(
      captureState.nextOrdinal === CAT07_CAPTURE_ARTIFACT_ORDER.length + 1,
      'CAT07 did not complete its exact screenshot capture chronology.',
    );
    client.assertHealthy();
    const browserFailures = classifyCat07ProjectedBrowserFailures(client.events);
    assert(
      browserFailures.length === 0,
      `CAT07 full run emitted ${browserFailures.length} browser failure(s).`,
    );
  } catch (error) {
    summary.fatalError =
      sanitizeEvidenceDiagnosticForDisplay(
        error instanceof Error ? error.message : String(error),
      ) || 'CAT07 audit failed without safe diagnostics.';
  } finally {
    if (client) {
      try {
        client.assertHealthy();
      } catch {
        summary.fatalError = 'CAT07 source or browser-event integrity changed during the run.';
      }
      writeCat07Json(
        evidenceDir,
        'browser-events-cat07-freshness.json',
        client.evidence(sourceGitSha),
      );
      client.close();
    }
    const browserExitedBeforeStop = browser?.cat07LaunchState?.exited === true;
    const serverExitedBeforeStop = server?.cat07LogState?.exited === true;
    await stopProcessBestEffort(browser);
    await stopProcessBestEffort(server);
    if (server) {
      try {
        finalizeCat07ExpoLog(evidenceDir, server);
      } catch {
        summary.fatalError = 'CAT07 Expo child log finalization failed.';
      }
    }
    if (server?.cat07LogState?.launchFailure) {
      summary.fatalError = 'CAT07 Expo child failed to launch.';
    }
    if (serverExitedBeforeStop) {
      summary.fatalError = 'CAT07 Expo child exited before evidence finalization.';
    }
    if (browser?.cat07LaunchState?.launchFailure) {
      summary.fatalError = 'CAT07 browser child failed to launch.';
    }
    if (browserExitedBeforeStop) {
      summary.fatalError = 'CAT07 browser child exited before evidence finalization.';
    }
    if (server?.cat07LogState?.overflow) {
      summary.fatalError = 'CAT07 Expo child log exceeded its reviewed byte ceiling.';
    }
    if (sourceMonitor) {
      try {
        sourceMonitor.assertClean();
      } catch {
        summary.fatalError = 'CAT07 immutable served source changed during the evidence run.';
      } finally {
        sourceMonitor.close();
      }
    }
    if (immutableSource) {
      try {
        immutableSource.assertRuntimeStable();
      } catch (error) {
        summary.fatalError =
          sanitizeEvidenceDiagnosticForDisplay(
            error instanceof Error ? error.message : String(error),
          ) || 'CAT07 immutable source or runtime bytes changed during the run.';
      }
      try {
        immutableSource.cleanup();
      } catch {
        summary.fatalError = 'CAT07 immutable source snapshot cleanup failed.';
      }
    }
    if (userDataDir) {
      try {
        assert(userDataGuard, 'CAT07 browser profile cleanup binding is unavailable.');
        cat07RemoveGuardedDirectory(userDataGuard, { allowLinks: true });
      } catch (error) {
        writeCat07Json(evidenceDir, 'cleanup-warning.json', {
          message: sanitizeCat04DiagnosticText(
            error instanceof Error ? error.message : String(error),
          ),
        });
      }
    }
  }

  try {
    assertCat07FinalSourceProvenance(sourceGitSha);
  } catch {
    summary.fatalError = 'CAT07 source provenance changed during the evidence run.';
  }

  summary.completedAt = new Date().toISOString();
  summary.verdict =
    !summary.fatalError &&
    summary.bootstrapResults.length === summary.expectedBootstrapCount &&
    summary.bootstrapResults.every(({ verdict }) => verdict === 'pass') &&
    summary.scenarios.length === summary.expectedExecutionCount &&
    summary.scenarios.every(({ verdict }) => verdict === 'pass')
      ? 'pass'
      : 'fail';
  writeReport(evidenceDir, summary);
  summary.artifacts = listEvidenceArtifacts(evidenceDir);
  summary.artifactManifest = buildCat07ArtifactManifest(evidenceDir, summary.artifacts);
  summary.screenshots = summary.artifacts.filter((artifact) => artifact.endsWith('.png'));
  assertPacketHygiene(evidenceDir, summary.artifacts, summary);
  writeCat07Json(evidenceDir, 'summary.json', summary);
  if (summary.verdict !== 'pass') process.exitCode = 1;
  return summary;
}

export function warmCat07RuntimeCache() {
  const sourceGitSha = assertCat07SourceProvenance();
  const immutableSource = createCat07ImmutableSourceSnapshot(sourceGitSha, {
    cacheOnly: true,
    online: true,
  });
  try {
    return { sourceGitSha };
  } finally {
    immutableSource.cleanup();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(scriptPath)) {
  if (process.argv.slice(2).includes('--warm-runtime-cache')) {
    warmCat07RuntimeCache();
    process.stdout.write('CAT07 governed npm cache warm completed.\n');
  } else {
    await runCat07ShelfFreshnessAudit();
  }
}
