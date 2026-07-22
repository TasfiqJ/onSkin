import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

import {
  assertDisabledControl,
  assertInteractiveControl,
  captureStep,
  classifyBrowserFailures,
  clickByText,
  connectToPage,
  enabledControlExpression,
  establishLocalHealthConsent,
  evaluate,
  fillByLabel,
  findAvailablePort,
  findBrowserPath,
  listEvidenceArtifacts,
  navigate,
  readSourceGitSha,
  safeArtifactId,
  sanitizeCat04DiagnosticText,
  scrollControlIntoView,
  scrollTextIntoView,
  startBrowser,
  startExpoServer,
  stopProcessBestEffort,
  waitForCondition,
  waitForNetworkIdle,
  waitForPath,
  waitForText,
  writeJson,
} from './cat04-catalog-recovery-audit.mjs';

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

export const CAT07_EVIDENCE_RELATIVE_DIR =
  'test-results/human-e2e/2026-07-22/cat07-shelf-freshness-current';
const CAT07_EVIDENCE_DIRECTORY = path.resolve(repoRoot, CAT07_EVIDENCE_RELATIVE_DIR);
export const CAT07_EVIDENCE_SCHEMA_VERSION = 1;
const CAT07_GIT_SHA = /^[0-9a-f]{40}$/u;

export const CAT07_REQUIRED_VIEWPORTS = Object.freeze([
  Object.freeze({ id: 'iphone-375x667', width: 375, height: 667 }),
  Object.freeze({ id: 'iphone-390x844', width: 390, height: 844 }),
  Object.freeze({ id: 'iphone-430x932', width: 430, height: 932 }),
]);

export const CAT07_AUDIT_LIMITATIONS = Object.freeze([
  'This is deterministic Expo-web UI-state evidence produced by development-only local fixtures.',
  'It proves neither native encrypted storage nor an iOS binary, physical-iPhone relaunch, notifications, VoiceOver, Dynamic Type, Reduce Motion, hosted RLS, live catalog truth, or migration execution.',
  'It does not approve category estimates; category_default remains unavailable and non-actionable.',
  'It does not provide cosmetic-chemistry, privacy, security, legal, App Review, production, market, or revenue approval.',
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

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function normalizeRepoPath(value) {
  return String(value).replace(/\\/gu, '/').replace(/^\.\//u, '');
}

function comparePaths(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function parseStatusPath(line) {
  const payload = line.slice(3).trim();
  const renameIndex = payload.lastIndexOf(' -> ');
  const candidate = renameIndex >= 0 ? payload.slice(renameIndex + 4) : payload;
  return normalizeRepoPath(candidate.replace(/^"|"$/gu, ''));
}

export function collectCat07UndeclaredDirtyPaths(statusLines) {
  return statusLines
    .map((line) => parseStatusPath(line))
    .filter(Boolean)
    .filter(
      (candidate) => !CAT07_DECLARED_OUTPUT_PATTERNS.some((pattern) => pattern.test(candidate)),
    )
    .sort(comparePaths);
}

export function assertCat07SourceProvenance({
  expectedSourceGitSha = process.env.CAT07_EXPECTED_SOURCE_GIT_SHA?.trim().toLowerCase() ?? null,
  statusText,
} = {}) {
  const sourceGitSha = readSourceGitSha(repoRoot);
  const rawStatus =
    statusText ??
    execFileSync('git', ['status', '--porcelain=v1', '--untracked-files=all'], {
      cwd: repoRoot,
      encoding: 'utf8',
      windowsHide: true,
    });
  const undeclared = collectCat07UndeclaredDirtyPaths(
    rawStatus.split(/\r?\n/u).filter((line) => line.length >= 4),
  );
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

function clearPreviousEvidence(evidenceDir) {
  mkdirSync(evidenceDir, { recursive: true });
  for (const entry of readdirSync(evidenceDir, { withFileTypes: true })) {
    if (!entry.isFile() || !/\.(?:json|log|md|png)$/iu.test(entry.name)) continue;
    rmSync(path.join(evidenceDir, entry.name), { force: true });
  }
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
  writeFileSync(path.join(evidenceDir, 'report.md'), `${lines.join('\n')}\n`);
}

async function captureFailure(client, evidenceDir, artifactPrefix) {
  if (!client) return [];
  try {
    const screenshot = await client.send('Page.captureScreenshot', {
      captureBeyondViewport: false,
      format: 'png',
    });
    const name = `${artifactPrefix}-failure.png`;
    writeFileSync(path.join(evidenceDir, name), screenshot.data, 'base64');
    return [name];
  } catch {
    return [];
  }
}

async function addFreshnessProduct({ client, baseUrl, evidenceDir, viewport, artifactPrefix }) {
  const productName = `CAT07 Label PAO ${viewport.width}`;
  await navigate(client, baseUrl, '/shelf/manual', viewport, `${artifactPrefix}-manual`);
  await waitForText(client, 'Add by hand');
  await fillByLabel(client, 'Product name', productName);
  await fillByLabel(client, 'Brand', 'Evidence Lab');
  await clickByText(client, 'Category');
  await waitForText(client, 'Product category');
  await clickByText(client, 'Treatment');
  await scrollControlIntoView(client, 'Continue');
  const manual = await captureStep(client, evidenceDir, `${artifactPrefix}-01-manual`);
  assertInteractiveControl(manual, 'Continue');
  await clickByText(client, 'Continue');

  await waitForPath(client, '/shelf/opened');
  await waitForText(client, 'When did you open it?');
  await scrollControlIntoView(client, 'Add to shelf');
  const openingRequired = await captureStep(
    client,
    evidenceDir,
    `${artifactPrefix}-02-opening-required`,
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
  const ready = await captureStep(client, evidenceDir, `${artifactPrefix}-04-label-pao-ready`);
  assertInteractiveControl(ready, 'Add to shelf');
  assert(
    ready.bodyText.includes('recorded from product label'),
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
  const shelf = await captureStep(client, evidenceDir, `${artifactPrefix}-05-shelf-countdown`);
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

async function runFreshnessScenario({ client, baseUrl, evidenceDir, viewport }) {
  const artifactPrefix = safeArtifactId(`freshness-lifecycle-${viewport.id}`);
  const eventStart = client.events.length;
  const result = {
    artifactPrefix,
    browserFailures: [],
    completedAt: null,
    distinctReplacementIdentity: false,
    error: null,
    nativeDeviceProof: false,
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
      client,
      evidenceDir,
      viewport,
    });
    await openProductDetail(client, productName);
    const originalDetailPath = await evaluate(client, 'window.location.pathname');
    await scrollControlIntoView(client, 'Edit period after opening');
    const initialDetail = await captureStep(
      client,
      evidenceDir,
      `${artifactPrefix}-06-label-pao-detail`,
    );
    assert(
      initialDetail.bodyText.includes('PAO 12 months') &&
        initialDetail.bodyText.includes('recorded from product label'),
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
    );
    for (const choice of [
      'I opened a new unit today',
      'New unit was opened earlier',
      'New unit is unopened',
    ]) {
      assert(choices.bodyText.includes(choice), `CAT07 replacement did not expose ${choice}.`);
    }
    assert(
      choices.bodyText.includes('No urgency is added.'),
      'CAT07 replacement lost its claim-safe no-urgency boundary.',
    );

    await clickByText(client, 'New unit was opened earlier');
    await fillByLabel(client, 'Exact opened date', localDatePlusDays(1));
    await waitForText(client, 'Enter a real date no later than today');
    await scrollControlIntoView(client, 'Save replacement with this date');
    const futureReplacement = await captureStep(
      client,
      evidenceDir,
      `${artifactPrefix}-09-future-replacement-date-blocked`,
    );
    assertDisabledControl(futureReplacement, 'Save replacement with this date');

    await scrollControlIntoView(client, 'New unit is unopened');
    await clickByText(client, 'New unit is unopened');
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
    );
    assert(
      replacementDetail.bodyText.includes('Not opened') &&
        replacementDetail.bodyText.includes('PAO 12 months') &&
        replacementDetail.bodyText.includes('recorded from product label') &&
        replacementDetail.bodyText.includes('Date unknown'),
      'CAT07 unopened replacement did not preserve PAO while clearing the PAO clock and package date.',
    );

    await navigate(client, baseUrl, '/shelf', viewport, `${artifactPrefix}-persisted-shelf`);
    await waitForText(client, productName);
    await clickByText(client, 'Expiring');
    await waitForText(client, 'Nothing needs replacing right now.');
    const expiring = await captureStep(
      client,
      evidenceDir,
      `${artifactPrefix}-12-unknown-excluded-from-expiring`,
    );
    assert(
      !expiring.bodyText.includes(productName),
      'CAT07 Expiring filter treated the unopened unknown-date package as actionable.',
    );

    await scrollControlIntoView(client, 'View archive', { exact: false });
    await clickByText(client, 'View archive', { exact: false });
    await waitForPath(client, '/shelf/archive');
    await waitForText(client, productName);
    const archive = await captureStep(client, evidenceDir, `${artifactPrefix}-13-archive-history`);
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
    );
    assert(
      archivedDetail.bodyText.includes('PAO 12 months') &&
        archivedDetail.bodyText.includes('recorded from product label') &&
        archivedDetail.bodyText.includes('recorded as printed'),
      'CAT07 archived package lost its opening/PAO/printed-date provenance.',
    );

    await waitForNetworkIdle(client, 10_000);
    result.browserFailures = classifyBrowserFailures(client.events.slice(eventStart), [baseUrl]);
    assert(
      result.browserFailures.length === 0,
      `CAT07 emitted ${result.browserFailures.length} browser failure(s).`,
    );
    result.endUrl = await evaluate(client, 'window.location.href');
    result.productName = productName;
    result.verdict = 'pass';
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    result.browserFailures = classifyBrowserFailures(client.events.slice(eventStart), [baseUrl]);
    result.failureArtifacts = await captureFailure(client, evidenceDir, artifactPrefix);
  } finally {
    result.completedAt = new Date().toISOString();
    writeJson(evidenceDir, `${artifactPrefix}-result.json`, result);
  }
  return result;
}

function sanitizeExpoLog(evidenceDir) {
  const logPath = path.join(evidenceDir, `expo-${safeArtifactId(CAT07_FIXTURE_GROUP.id)}.log`);
  if (!existsSync(logPath)) return;
  writeFileSync(logPath, sanitizeCat04DiagnosticText(readFileSync(logPath, 'utf8')));
}

function assertPacketHygiene(evidenceDir, artifacts) {
  for (const artifact of artifacts) {
    if (!/\.(?:json|log|md)$/iu.test(artifact)) continue;
    const text = readFileSync(path.join(evidenceDir, artifact), 'utf8');
    assert(
      !/[A-Za-z]:[\\/](?:Users|Documents and Settings)[\\/]/u.test(text),
      `CAT07 artifact leaks an absolute user path: ${artifact}`,
    );
    assert(
      !/BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY|Bearer\s+[A-Za-z0-9._~+/=-]{8,}/iu.test(text),
      `CAT07 artifact contains credential-shaped content: ${artifact}`,
    );
  }
}

export async function runCat07ShelfFreshnessAudit({
  evidenceDir = process.env.CAT07_E2E_EVIDENCE_DIR
    ? path.resolve(repoRoot, process.env.CAT07_E2E_EVIDENCE_DIR)
    : CAT07_EVIDENCE_DIRECTORY,
  requestedAppPort = Number(process.env.CAT07_E2E_PORT ?? 8720),
  requestedDebugPort = Number(process.env.CAT07_E2E_DEBUG_PORT ?? 9820),
} = {}) {
  const configuration = validateCat07AuditConfiguration();
  assertCat07SourceSafetyContract();
  const sourceGitSha = assertCat07SourceProvenance();
  clearPreviousEvidence(evidenceDir);
  const summary = {
    artifacts: [],
    bootstrapResults: [],
    completedAt: null,
    expectedBootstrapCount: CAT07_REQUIRED_VIEWPORTS.length,
    expectedExecutionCount: configuration.executionCount,
    limitations: CAT07_AUDIT_LIMITATIONS,
    nativeDeviceProof: false,
    requiredViewports: CAT07_REQUIRED_VIEWPORTS,
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
  try {
    const appPort = await findAvailablePort(requestedAppPort);
    const debugPort = await findAvailablePort(requestedDebugPort);
    const baseUrl = `http://localhost:${appPort}`;
    const browserPath = findBrowserPath();
    userDataDir = mkdtempSync(path.join(tmpdir(), 'cat07-shelf-freshness-'));
    server = startExpoServer({
      appPort,
      evidenceDir,
      group: CAT07_FIXTURE_GROUP,
    });
    const startedAt = Date.now();
    let serverReady = false;
    while (Date.now() - startedAt < 120_000 && !serverReady) {
      try {
        const response = await fetch(baseUrl, { redirect: 'manual' });
        serverReady = response.status < 500;
      } catch {
        await delay(500);
      }
    }
    assert(serverReady, `CAT07 Expo server did not become ready at ${baseUrl}.`);
    browser = startBrowser({ browserPath, debugPort, userDataDir });
    client = await connectToPage(debugPort, baseUrl);
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('Log.enable');
    await client.send('Network.enable');
    await client.send('Page.setLifecycleEventsEnabled', { enabled: true });
    await client.send('Page.bringToFront');

    for (const viewport of CAT07_REQUIRED_VIEWPORTS) {
      const bootstrap = await establishLocalHealthConsent({
        baseUrl,
        client,
        evidenceDir,
        groupId: CAT07_FIXTURE_GROUP.id,
        viewport,
      });
      summary.bootstrapResults.push(bootstrap);
      assert(
        bootstrap.verdict === 'pass',
        bootstrap.error ?? `CAT07 consent bootstrap failed at ${viewport.id}.`,
      );
      const scenario = await runFreshnessScenario({
        baseUrl,
        client,
        evidenceDir,
        viewport,
      });
      summary.scenarios.push(scenario);
      assert(
        scenario.verdict === 'pass',
        scenario.error ?? `CAT07 freshness lifecycle failed at ${viewport.id}.`,
      );
    }
  } catch (error) {
    summary.fatalError = error instanceof Error ? error.message : String(error);
  } finally {
    if (client) {
      writeJson(evidenceDir, 'browser-events-cat07-freshness.json', client.events);
      client.close();
    }
    await stopProcessBestEffort(browser);
    await stopProcessBestEffort(server);
    if (userDataDir) {
      try {
        rmSync(userDataDir, { force: true, recursive: true });
      } catch (error) {
        writeJson(evidenceDir, 'cleanup-warning.json', {
          message: sanitizeCat04DiagnosticText(
            error instanceof Error ? error.message : String(error),
          ),
        });
      }
    }
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
  sanitizeExpoLog(evidenceDir);
  writeReport(evidenceDir, summary);
  summary.artifacts = listEvidenceArtifacts(evidenceDir);
  summary.screenshots = summary.artifacts.filter((artifact) => artifact.endsWith('.png'));
  assertPacketHygiene(evidenceDir, summary.artifacts);
  writeJson(evidenceDir, 'summary.json', summary);
  if (summary.verdict !== 'pass') process.exitCode = 1;
  return summary;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(scriptPath)) {
  await runCat07ShelfFreshnessAudit();
}
