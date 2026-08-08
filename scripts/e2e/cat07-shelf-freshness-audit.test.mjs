import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  rmdirSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { createServer } from 'node:net';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

import { PNG } from 'pngjs';

import {
  CAT07_AUDIT_LIMITATIONS,
  CAT07_EVIDENCE_RELATIVE_DIR,
  CAT07_LOOPBACK_ATTESTATION_SCHEMA_VERSION,
  CAT07_MAX_CDP_FRAME_BYTES,
  CAT07_REQUIRED_VIEWPORTS,
  CAT07_RUN_ID,
  CAT07_VERIFIED_OUTCOMES,
  assertCat07SourceProvenance,
  assertCat07FinalSourceProvenance,
  assertCat07SourceSafetyContract,
  buildCat07AttestedServerNodeArgs,
  buildCat07BrowserEnvironment,
  buildCat07ChildEnvironment,
  buildCat07RuntimeDriftFingerprint,
  buildCat07ScrubbedNodeArgs,
  Cat07CdpClient,
  clearPreviousEvidence,
  classifyCat07ProjectedBrowserFailures,
  collectCat07UndeclaredDirtyPaths,
  collectCat07RuntimeDrift,
  createCat07SourceMutationMonitor,
  finalizeCat07ExpoLog,
  cat07BrowserMarker,
  cat07BrowserArguments,
  findCat07GitExecutable,
  findCat07TrustedBrowserExecutable,
  projectCat07CdpEvent,
  parseCat07CdpFrame,
  parseCat07DevToolsActivePort,
  parseCat07GitTree,
  parseCat07LoopbackListenerAttestation,
  prepareCat07CssInteropRuntimeCache,
  readCat07BoundedJsonResponse,
  recordCat07Fatal,
  runCat07IsolatedNpmInstall,
  startCat07ImmutableExpoServer,
  validateCat07EvidenceDirectory,
  validateCat07AuditConfiguration,
  validateCat07DebuggerWebSocketUrl,
  validateCat07ScreenshotArtifact,
  verifyCat07ExtractedGitTree,
  waitForCat07LoopbackListenerAttestation,
  writeCat07EvidenceArtifact,
} from './cat07-shelf-freshness-audit.mjs';
import {
  CAT07_FULL_VALIDATOR_MAX_BUFFER,
  CAT07_FULL_VALIDATOR_TIMEOUT_MS,
  formatCat07FullEvidenceFailure,
  validateCat07FullEvidenceContract,
} from './cat07-committed-evidence.mjs';
import { applyCat07CaptureMarkerToRgba, decodeStrictCat07Png } from './cat07-png-contract.mjs';
import {
  canonicalEvidenceJsonBytes,
  collectEvidenceDiagnosticValueFailures,
  collectEvidenceTextArtifactHygieneFailures,
  inspectCanonicalEvidenceJson,
  readBoundedRegularFile,
  sanitizeEvidenceDiagnosticForDisplay,
} from './evidence-diagnostic-hygiene.mjs';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const runnerPath = fileURLToPath(new URL('./cat07-shelf-freshness-audit.mjs', import.meta.url));
const humanManifestPath = fileURLToPath(new URL('./human-e2e-manifest.mjs', import.meta.url));
const cat04RunnerPath = fileURLToPath(
  new URL('./cat04-catalog-recovery-audit.mjs', import.meta.url),
);
const packagePath = path.join(repoRoot, 'package.json');
const runnerSource = readFileSync(runnerPath, 'utf8');
const cat04RunnerSource = readFileSync(cat04RunnerPath, 'utf8');
const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));

test('CAT07 audit covers every supported iPhone-class Expo-web viewport', () => {
  const configuration = validateCat07AuditConfiguration();
  assert.deepEqual(
    CAT07_REQUIRED_VIEWPORTS.map(({ width, height }) => `${width}x${height}`),
    ['375x667', '390x844', '430x932'],
  );
  assert.equal(configuration.viewportCount, 3);
  assert.equal(configuration.executionCount, 3);
  assert.equal(CAT07_VERIFIED_OUTCOMES.length, 10);
  assert.equal(CAT07_AUDIT_LIMITATIONS.length >= 4, true);
  assert.equal(
    CAT07_AUDIT_LIMITATIONS.every((limitation) => typeof limitation === 'string'),
    true,
  );
  assert.match(CAT07_EVIDENCE_RELATIVE_DIR, /2026-08-08\/cat07-shelf-freshness-current$/u);
});

test('CAT07 run markers bind one canonical run, viewport, and reviewed step', () => {
  const runId = 'cat07-11111111-1111-4111-8111-111111111111';
  assert.match(runId, CAT07_RUN_ID);
  assert.equal(
    cat07BrowserMarker(runId, 'iphone-375x667', 'bootstrap'),
    'cat07:cat07-11111111-1111-4111-8111-111111111111:iphone-375x667:bootstrap',
  );
  assert.throws(() => cat07BrowserMarker('not-a-run', 'iphone-375x667', 'bootstrap'), /runId/u);
  assert.throws(() => cat07BrowserMarker(runId, 'unknown', 'bootstrap'), /viewport/u);
  assert.throws(() => cat07BrowserMarker(runId, 'iphone-375x667', 'unknown'), /step/u);
});

test('CAT07 source contract rejects missing fail-closed freshness boundaries', () => {
  const valid = {
    catalogClient:
      `const PRODUCT_SPECIFIC_PAO_SOURCES = new Set(); ` +
      `if (productSpecific.length !== 1) return { months: null, source: 'unknown' }; expiryDate: null;`,
    detailRoute:
      'Older data is not tied to this exact package and is not used for freshness reminders.',
    freshness:
      `const PAO_SOURCES = new Set(['category_default']); ` +
      `candidatePaoSource === 'category_default'; ` +
      `if (computed.source === 'unknown') return 'unknown';`,
    openedRoute: `const canSave = mode != null; if (mode === 'unopened') return; 'Choose the state that matches this package';`,
    replenishRoute:
      'New unit is unopened. No PAO clock; add a printed date from the pack later. No urgency is added.',
    shelfRoute: `i.badge.kind === 'countdown' || i.badge.kind === 'expired'; 'Nothing needs replacing right now';`,
    store: `const replacementId = operationId; expiryDate: null; legacyUnverifiedExpiryDate: null; replacesProductId: prev.id;`,
  };

  assert.equal(assertCat07SourceSafetyContract(valid), true);
  for (const key of Object.keys(valid)) {
    assert.throws(
      () => assertCat07SourceSafetyContract({ ...valid, [key]: '' }),
      /CAT07/u,
      `Missing ${key} contract should fail.`,
    );
  }
});

test('current CAT07 source satisfies its exact static safety contract', () => {
  assert.equal(assertCat07SourceSafetyContract(), true);
});

test('CAT07 provenance permits only its evidence folder and scratch output', () => {
  const status = (...fields) => `${fields.join('\0')}\0`;
  const allowed = status(
    ' M test-results/human-e2e/2026-08-08/cat07-shelf-freshness-current/summary.json',
    '?? test-results/human-e2e/2026-08-08/cat07-shelf-freshness-current/new.png',
    '?? .tmp/cat07/browser-profile/file',
  );
  assert.deepEqual(collectCat07UndeclaredDirtyPaths(allowed), []);
  assert.deepEqual(
    collectCat07UndeclaredDirtyPaths(
      status(
        ' M test-results/human-e2e/2026-08-08/cat07-shelf-freshness-current/summary.json',
        '?? .tmp/cat07/browser-profile/file',
        ' M apps/mobile/src/features/shelf/store.ts',
        '?? scripts/e2e/uncommitted-runner.mjs',
      ),
    ),
    ['apps/mobile/src/features/shelf/store.ts', 'scripts/e2e/uncommitted-runner.mjs'],
  );

  const evidencePrefix = CAT07_EVIDENCE_RELATIVE_DIR;
  assert.deepEqual(
    collectCat07UndeclaredDirtyPaths(
      status(
        `R  ${evidencePrefix}/renamed-into-evidence.png`,
        'apps/mobile/src/hidden-source.ts',
        'R  apps/mobile/src/renamed-out-of-evidence.ts',
        `${evidencePrefix}/old-evidence.json`,
        `C  ${evidencePrefix}/copied-into-evidence.json`,
        'scripts/e2e/copied-source.mjs',
      ),
    ),
    [
      'apps/mobile/src/hidden-source.ts',
      'apps/mobile/src/renamed-out-of-evidence.ts',
      'scripts/e2e/copied-source.mjs',
    ],
  );
  assert.deepEqual(
    collectCat07UndeclaredDirtyPaths(
      status(
        `R  ${evidencePrefix}/new-name.png`,
        `${evidencePrefix}/old-name.png`,
        `C  ${evidencePrefix}/copy.json`,
        `${evidencePrefix}/source.json`,
      ),
    ),
    [],
  );

  const unusualPath = 'apps/mobile/src/tab\tline\n"quoted-looking".ts';
  assert.deepEqual(collectCat07UndeclaredDirtyPaths(status(`?? ${unusualPath}`)), [unusualPath]);
  assert.throws(() => collectCat07UndeclaredDirtyPaths('?? unterminated.ts'), /NUL-terminated/u);
  assert.throws(
    () => collectCat07UndeclaredDirtyPaths(status(`R  ${evidencePrefix}/missing-source.png`)),
    /truncated rename\/copy/u,
  );
  assert.throws(() => collectCat07UndeclaredDirtyPaths(status('M')), /malformed porcelain/u);
});

test('CAT07 evidence cleanup is exact-path, reparse-safe, and removes nested stale artifacts', (t) => {
  const fixtureRoot = mkdtempSync(path.join(tmpdir(), 'cat07-evidence-safety-'));
  t.after(() => rmSync(fixtureRoot, { force: true, recursive: true }));
  const repo = path.join(fixtureRoot, 'repo');
  const expected = path.join(repo, ...CAT07_EVIDENCE_RELATIVE_DIR.split('/'));
  const options = { expectedEvidenceDir: expected, repoRootPath: repo };
  mkdirSync(expected, { recursive: true });

  for (const unsafe of [
    repo,
    path.dirname(expected),
    path.join(path.dirname(expected), 'cat07-sibling'),
    `${expected}${path.sep}..${path.sep}cat07-traversal`,
    path.join(repo, '..', 'outside-repo'),
  ]) {
    assert.throws(
      () => validateCat07EvidenceDirectory(unsafe, options),
      /must be exactly/u,
      `Unsafe CAT07 evidence path should be rejected: ${unsafe}`,
    );
  }

  const outsideSentinel = path.join(repo, 'do-not-delete.txt');
  const nestedStale = path.join(expected, 'stale', 'nested', 'artifact.bin');
  writeFileSync(outsideSentinel, 'sentinel');
  mkdirSync(path.dirname(nestedStale), { recursive: true });
  writeFileSync(nestedStale, 'stale');
  writeFileSync(path.join(expected, 'unexpected-extension.dat'), 'stale');
  assert.equal(clearPreviousEvidence(expected, options), expected);
  assert.deepEqual(readdirSync(expected), []);
  assert.equal(readFileSync(outsideSentinel, 'utf8'), 'sentinel');

  const childTarget = path.join(repo, 'child-link-target');
  const childSentinel = path.join(childTarget, 'sentinel.txt');
  mkdirSync(childTarget, { recursive: true });
  writeFileSync(childSentinel, 'child sentinel');
  writeFileSync(path.join(expected, 'must-survive-rejected-cleanup.json'), 'stale');
  symlinkSync(
    childTarget,
    path.join(expected, 'nested-link'),
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  assert.throws(() => clearPreviousEvidence(expected, options), /nested symlink or junction/u);
  assert.equal(existsSync(path.join(expected, 'must-survive-rejected-cleanup.json')), true);
  assert.equal(readFileSync(childSentinel, 'utf8'), 'child sentinel');

  const directLinkRepo = path.join(fixtureRoot, 'direct-link-repo');
  const directLinkExpected = path.join(directLinkRepo, ...CAT07_EVIDENCE_RELATIVE_DIR.split('/'));
  const directLinkTarget = path.join(fixtureRoot, 'direct-link-target');
  mkdirSync(path.dirname(directLinkExpected), { recursive: true });
  mkdirSync(directLinkTarget, { recursive: true });
  writeFileSync(path.join(directLinkTarget, 'sentinel.txt'), 'direct sentinel');
  symlinkSync(
    directLinkTarget,
    directLinkExpected,
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  assert.throws(
    () =>
      clearPreviousEvidence(directLinkExpected, {
        expectedEvidenceDir: directLinkExpected,
        repoRootPath: directLinkRepo,
      }),
    /symlink or junction/u,
  );
  assert.equal(
    readFileSync(path.join(directLinkTarget, 'sentinel.txt'), 'utf8'),
    'direct sentinel',
  );

  const parentLinkRepo = path.join(fixtureRoot, 'parent-link-repo');
  const parentLinkTarget = path.join(fixtureRoot, 'parent-link-target');
  const parentLink = path.join(parentLinkRepo, 'test-results');
  const parentLinkExpected = path.join(
    parentLink,
    ...CAT07_EVIDENCE_RELATIVE_DIR.split('/').slice(1),
  );
  mkdirSync(parentLinkRepo, { recursive: true });
  mkdirSync(parentLinkTarget, { recursive: true });
  writeFileSync(path.join(parentLinkTarget, 'sentinel.txt'), 'parent sentinel');
  symlinkSync(parentLinkTarget, parentLink, process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(
    () =>
      validateCat07EvidenceDirectory(parentLinkExpected, {
        expectedEvidenceDir: parentLinkExpected,
        repoRootPath: parentLinkRepo,
      }),
    /symlink or junction/u,
  );
  assert.equal(
    readFileSync(path.join(parentLinkTarget, 'sentinel.txt'), 'utf8'),
    'parent sentinel',
  );
});

test('CAT07 evidence cleanup and atomic writes reject a root swap race', (t) => {
  const fixtureRoot = mkdtempSync(path.join(tmpdir(), 'cat07-evidence-race-'));
  t.after(() => rmSync(fixtureRoot, { force: true, recursive: true }));
  const repo = path.join(fixtureRoot, 'repo');
  const evidence = path.join(repo, ...CAT07_EVIDENCE_RELATIVE_DIR.split('/'));
  const heldEvidence = path.join(path.dirname(evidence), 'held-evidence');
  const outside = path.join(fixtureRoot, 'outside');
  const options = { expectedEvidenceDir: evidence, repoRootPath: repo };
  mkdirSync(evidence, { recursive: true });
  mkdirSync(outside, { recursive: true });
  writeFileSync(path.join(outside, 'sentinel.txt'), 'outside sentinel');
  const installSwap = () => {
    renameSync(evidence, heldEvidence);
    symlinkSync(outside, evidence, process.platform === 'win32' ? 'junction' : 'dir');
  };
  const restore = () => {
    rmdirSync(evidence);
    renameSync(heldEvidence, evidence);
  };

  writeFileSync(path.join(evidence, 'stale.json'), '{}');
  let cleanupSwapRan = false;
  assert.throws(
    () =>
      clearPreviousEvidence(evidence, {
        ...options,
        beforeRemove() {
          if (cleanupSwapRan) return;
          cleanupSwapRan = true;
          installSwap();
        },
      }),
    /governed directory root identity changed/u,
  );
  restore();
  assert.equal(readFileSync(path.join(outside, 'sentinel.txt'), 'utf8'), 'outside sentinel');
  assert.equal(existsSync(path.join(outside, 'stale.json')), false);

  clearPreviousEvidence(evidence, options);
  assert.throws(
    () =>
      writeCat07EvidenceArtifact(evidence, 'summary.json', '{}\n', {
        beforeCommit: installSwap,
      }),
    /governed directory root identity changed/u,
  );
  restore();
  assert.equal(readFileSync(path.join(outside, 'sentinel.txt'), 'utf8'), 'outside sentinel');
  assert.equal(existsSync(path.join(outside, 'summary.json')), false);
  clearPreviousEvidence(evidence, options);
});

test('CAT07 provenance binds a requested full SHA to HEAD', () => {
  const actual = assertCat07SourceProvenance({ statusText: '' });
  assert.match(actual, /^[0-9a-f]{40}$/u);
  assert.equal(
    assertCat07SourceProvenance({
      expectedSourceGitSha: actual,
      statusText: '',
    }),
    actual,
  );
  assert.throws(
    () =>
      assertCat07SourceProvenance({
        expectedSourceGitSha: '0'.repeat(40),
        statusText: '',
      }),
    /expected source/u,
  );
  assert.throws(
    () =>
      assertCat07SourceProvenance({
        expectedSourceGitSha: 'not-a-sha',
        statusText: '',
      }),
    /40-character Git SHA/u,
  );
});

test('CAT07 final provenance recheck rejects mid-run source or HEAD drift', () => {
  const sourceGitSha = assertCat07SourceProvenance({ statusText: '' });
  assert.equal(assertCat07FinalSourceProvenance(sourceGitSha, { statusText: '' }), sourceGitSha);
  assert.throws(
    () =>
      assertCat07FinalSourceProvenance(sourceGitSha, {
        statusText: ' M apps/mobile/src/features/shelf/store.ts\0',
      }),
    /committed source/u,
  );
  assert.match(runnerSource, /assertCat07FinalSourceProvenance\(sourceGitSha\)/u);
  assert.ok(
    runnerSource.indexOf('assertCat07FinalSourceProvenance(sourceGitSha)') >
      runnerSource.indexOf('await stopProcessBestEffort(server)'),
  );
});

test('CAT07 runner drives the full truthful replacement lifecycle', () => {
  for (const required of [
    "clickByText(client, 'Serum')",
    "fillByLabel(client, 'Exact opened date', localDatePlusDays(1))",
    "waitForText(client, 'Enter a real date no later than today')",
    "clickByText(client, '12 mo')",
    "fillByLabel(client, 'Exact package date', localDatePlusDays(7))",
    "'I opened a new unit today'",
    "'New unit was opened earlier'",
    "'New unit is unopened'",
    "assertDisabledControl(futureReplacement, 'Save replacement with this date')",
    "clickByText(client, 'New unit was opened earlier', { exact: false })",
    "clickByText(client, 'New unit is unopened', { exact: false })",
    'This reminder comes from the package date recorded on your Shelf.',
    "replacementDetail.bodyText.includes('Opened not opened yet')",
    "replacementDetail.bodyText.includes('Recorded package date not entered')",
    'originalDetailPath !== replacementDetailPath',
    "clickByText(client, 'Expiring')",
    "waitForText(client, 'Nothing needs replacing right now.')",
    'archivedDetailPath === originalDetailPath',
  ]) {
    assert.ok(runnerSource.includes(required), `Missing CAT07 interaction: ${required}`);
  }
  assert.match(runnerSource, /ready\.bodyText\.includes\('from label'\)/u);
  assert.doesNotMatch(runnerSource, /recorded from product label/u);
  assert.match(runnerSource, /nativeDeviceProof:\s*false/gu);
  assert.doesNotMatch(runnerSource, /nativeDeviceProof:\s*true/gu);
});

test('CAT07 audit inherits the stable local-only browser and consent harness', () => {
  for (const exportedHelper of [
    'export function startBrowser',
    'export async function connectToPage',
    'export async function establishLocalHealthConsent',
    'export async function captureStep',
    'export async function navigate',
  ]) {
    assert.match(cat04RunnerSource, new RegExp(exportedHelper.replaceAll(' ', '\\s+'), 'u'));
  }
  assert.match(cat04RunnerSource, /--headless=old/u);
  assert.match(cat04RunnerSource, /--disable-gpu-sandbox/u);
  assert.match(cat04RunnerSource, /--in-process-gpu/u);
  assert.doesNotMatch(cat04RunnerSource, /--headless=new/u);
  assert.match(cat04RunnerSource, /\/json\/new\?\$\{encodeURIComponent\(targetUrl\)\}/u);
  assert.match(cat04RunnerSource, /method: 'PUT'/u);
  assert.match(runnerSource, /connectToInstrumentedCat07Page\(debugPort, baseUrl,/u);
  assert.doesNotMatch(runnerSource, /connectToPage\(debugPort, baseUrl\)/u);
  assert.match(runnerSource, /encodeURIComponent\('about:blank'\)/u);
  const networkEnable = runnerSource.indexOf("await client.send('Network.enable')");
  const firstAppNavigation = runnerSource.indexOf(
    "await client.send('Page.navigate', { url: appUrl.toString() })",
  );
  assert.ok(networkEnable >= 0 && firstAppNavigation > networkEnable);
  assert.match(runnerSource, /cat07BrowserMarker\(runId, viewport\.id, 'bootstrap'\)/u);
  assert.match(runnerSource, /cat07BrowserMarker\(runId, viewport\.id, 'consent-probe'\)/u);
  assert.match(runnerSource, /cat07BrowserMarker\(runId, viewport\.id, 'manual'\)/u);
  assert.match(runnerSource, /cat07BrowserMarker\(runId, viewport\.id, 'persisted-shelf'\)/u);
  assert.match(runnerSource, /classifyCat07ProjectedBrowserFailures/u);
  assert.match(runnerSource, /assertPacketHygiene\(evidenceDir, summary\.artifacts, summary\)/u);
  assert.match(runnerSource, /createCat07ImmutableSourceSnapshot\(sourceGitSha\)/u);
  assert.match(runnerSource, /findAvailablePort\(9222\)/u);
  assert.doesNotMatch(runnerSource, /findAvailablePort\(0\)/u);
  assert.match(runnerSource, /snapshotRoot: immutableSource\.root/u);
  assert.match(runnerSource, /'cat-file', '--batch'/u);
  assert.doesNotMatch(runnerSource, /'archive'|execFileSync\('tar'/u);
  assert.match(runnerSource, /expoCliPath,[\s\S]*'start',[\s\S]*'--web'/u);
  assert.match(cat04RunnerSource, /EXPO_PUBLIC_SUPABASE_URL/u);
  const browserArgs = cat07BrowserArguments({ debugPort: 9820, userDataDir: '<fresh-profile>' });
  assert.ok(browserArgs.includes('--headless'));
  assert.ok(browserArgs.includes('--remote-debugging-port=9820'));
  assert.equal(browserArgs.includes('--remote-debugging-port=0'), false);
  assert.ok(browserArgs.includes('--proxy-server=127.0.0.1:9'));
  assert.ok(browserArgs.includes('--proxy-bypass-list=localhost;127.0.0.1'));
  assert.equal(
    browserArgs.some((argument) => argument === '--headless=old'),
    false,
  );
  assert.equal(
    browserArgs.some((argument) => argument.includes('direct://')),
    false,
  );
});

test('CAT07 trusted Git and browser discovery ignore poisoned host executable selectors', (t) => {
  const fixtureRoot = mkdtempSync(path.join(tmpdir(), 'cat07-poisoned-tools-'));
  t.after(() => rmSync(fixtureRoot, { force: true, recursive: true }));
  const fakeGit = path.join(fixtureRoot, process.platform === 'win32' ? 'git.exe' : 'git');
  const fakeBrowser = path.join(
    fixtureRoot,
    process.platform === 'win32' ? 'chrome.exe' : 'google-chrome',
  );
  writeFileSync(fakeGit, 'hostile git shim');
  writeFileSync(fakeBrowser, 'hostile browser shim');
  const previous = {
    BROWSER_PATH: process.env.BROWSER_PATH,
    CHROME_PATH: process.env.CHROME_PATH,
    Path: process.env.Path,
    PATH: process.env.PATH,
  };
  process.env.BROWSER_PATH = fakeBrowser;
  process.env.CHROME_PATH = fakeBrowser;
  process.env.Path = `${fixtureRoot}${path.delimiter}${previous.Path ?? ''}`;
  process.env.PATH = `${fixtureRoot}${path.delimiter}${previous.PATH ?? ''}`;
  try {
    assert.notEqual(path.resolve(findCat07GitExecutable()), path.resolve(fakeGit));
    if (process.platform === 'win32') {
      assert.notEqual(path.resolve(findCat07TrustedBrowserExecutable()), path.resolve(fakeBrowser));
    }
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
  assert.doesNotMatch(runnerSource, /where\.exe|CHROME_PATH|BROWSER_PATH/u);
});

test('CAT07 child-validator diagnostics are bounded and cannot leak host paths or credentials', () => {
  const pat = `sbp_${'a'.repeat(40)}`;
  const opaque = `sb_secret_${'s'.repeat(22)}_${'z'.repeat(8)}`;
  const npmLiteral = `npm_${'n'.repeat(36)}`;
  const githubLiteral = `ghp_${'g'.repeat(36)}`;
  const githubFineGrainedLiteral = `github_pat_${'f'.repeat(82)}`;
  const npmToken = 'npm-secret-value-1234567890';
  const diagnostic = formatCat07FullEvidenceFailure({
    stderr:
      `test-results/human-e2e/summary.json http://localhost:8720/shelf?cat04Audit=ok\n` +
      `C:\\Users\\reviewer\\Desktop\\onSkin\\secret.txt /home/reviewer/secret.txt\n` +
      `/etc/private.conf /opt/private /Volumes/private\n` +
      `postgresql://reviewer:database-password@db.example.com:5432/app ` +
      `PGPASSWORD=legacy-password SERVICE_ROLE_KEY=legacy-service-key ` +
      `Authorization: Basic ${'b'.repeat(32)} NPM_TOKEN=${npmToken} ${pat} ${opaque}\n` +
      `${npmLiteral} ${githubLiteral} ${githubFineGrainedLiteral}\n` +
      `Cookie: session_id=cookie-secret Set-Cookie: session=server-cookie ` +
      `AWS_ACCESS_KEY_ID=AKIAABCDEFGHIJKLMNOP AWS_SECRET_ACCESS_KEY=aws-secret ` +
      `STRIPE_SECRET_KEY=sk_live_1234567890abcdefghijklmnop\n` +
      `/Applications/Secret.app /Library/Secret /System/Secret\n` +
      `http://localhost:8720/failure?access_token=localhost-secret ` +
      `https://reviewer:web-password@example.com/failure` +
      `\r\u001b]0;forged-title\u0007`,
  });

  assert.match(diagnostic, /full CAT07 manifest validator failed/u);
  assert.match(diagnostic, /test-results\/human-e2e\/summary\.json/u);
  assert.match(diagnostic, /http:\/\/localhost:8720\/shelf\?redacted-query/u);
  assert.match(diagnostic, /<redacted-credential-url>/u);
  assert.doesNotMatch(
    diagnostic,
    /C:\\Users|\/home\/reviewer|\/etc\/|\/opt\/|\/Volumes\/|\/Applications\/|\/Library\/|\/System\//u,
  );
  assert.doesNotMatch(
    diagnostic,
    /Authorization: Basic|npm-secret|npm_|ghp_|github_pat_|sbp_|sb_secret_|database-password|legacy-password|legacy-service-key|localhost-secret|web-password|cookie-secret|server-cookie|AKIAABCDEFGHIJKLMNOP|aws-secret|sk_live_/u,
  );
  assert.doesNotMatch(diagnostic, /[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/u);
  assert.ok(Buffer.byteLength(diagnostic, 'utf8') <= 2_050);
});

test('CAT07 evidence hygiene bounds recursive nodes and never echoes invalid JSON secrets', () => {
  const nodeFailures = collectEvidenceDiagnosticValueFailures(
    'fixture.json',
    { first: [1, 2, 3], second: 'value' },
    { maxNodes: 3 },
  );
  assert.ok(nodeFailures.some((failure) => failure.includes('diagnostic nodes or entries')));

  const invalidSecret = 'invalid-json-secret-that-must-not-echo';
  const inspection = inspectCanonicalEvidenceJson(
    'fixture.json',
    Buffer.from(`{"token":"${invalidSecret}"`, 'utf8'),
  );
  assert.deepEqual(inspection.failures, ['fixture.json is not valid JSON']);
  assert.doesNotMatch(inspection.failures.join('\n'), new RegExp(invalidSecret, 'u'));

  const deepInspection = inspectCanonicalEvidenceJson(
    'deep.json',
    Buffer.from(`${'['.repeat(2_000)}0${']'.repeat(2_000)}`, 'utf8'),
  );
  assert.ok(
    deepInspection.failures.some((failure) => failure.includes('diagnostic nesting depth')),
  );

  const credentialFieldFailures = collectEvidenceDiagnosticValueFailures('fixture.json', {
    nested: {
      accessKeyId: 'AKIAABCDEFGHIJKLMNOP',
      cookie: 'cookie-value',
      databaseUrl: 'legacy-database-value',
      pgpassword: 'legacy-pg-password',
      secretKey: 'secret-key-value',
      serviceRoleKey: 'legacy-service-role-key',
      sessionId: 'session-value',
    },
  });
  assert.ok(
    credentialFieldFailures.filter((failure) =>
      failure.includes('unredacted credential field value'),
    ).length >= 7,
  );
  const standaloneTokenFailures = collectEvidenceDiagnosticValueFailures('fixture.json', {
    log: `npm_${'n'.repeat(36)} ghp_${'g'.repeat(36)} github_pat_${'f'.repeat(82)}`,
  });
  assert.ok(
    standaloneTokenFailures.some((failure) =>
      failure.includes('package or source-control credential literal'),
    ),
  );
});

test('CAT07 sanitizer removes credential families from raw and recursively encoded local URLs', () => {
  const secrets = [
    `sk_live_${'a'.repeat(24)}`,
    'AKIAABCDEFGHIJKLMNOP',
    'xoxb-123456789012-123456789012-abcdefghijklmnopqrstuvwx',
    `sbp_${'a'.repeat(40)}`,
    `npm_${'n'.repeat(36)}`,
    `ghp_${'g'.repeat(36)}`,
    `eyJ${'a'.repeat(12)}.${'b'.repeat(12)}.${'c'.repeat(12)}`,
    '-----BEGIN PRIVATE KEY-----',
  ];
  for (const secret of secrets) {
    for (const encoded of [
      secret,
      encodeURIComponent(secret),
      encodeURIComponent(encodeURIComponent(secret)),
    ]) {
      const literal = `http://localhost:8720/path/${encoded}`;
      const sanitized = sanitizeEvidenceDiagnosticForDisplay(literal);
      assert.match(sanitized, /<redacted-(?:credential-url|private-key)>/u);
      assert.doesNotMatch(sanitized, /sk_live_|AKIA|xoxb-|sbp_|npm_|ghp_|eyJ|PRIVATE KEY/u);
    }
  }

  const attackerMarker = '\u{e000}CAT07URL0\u{e001}';
  const sanitized = sanitizeEvidenceDiagnosticForDisplay(
    `${attackerMarker} http://localhost:8720/safe?ordinary=value`,
  );
  assert.ok(sanitized.includes(attackerMarker));
  assert.ok(sanitized.includes('http://localhost:8720/safe?redacted-query'));
  for (const hostPath of [
    '/Users/jasim/private.txt',
    '/C:/Users/jasim/private.txt',
    '/home/jasim/private.txt',
    '/.claude/worktrees/private/file.txt',
  ]) {
    for (const encoded of [
      hostPath,
      encodeURIComponent(hostPath),
      encodeURIComponent(encodeURIComponent(hostPath)),
    ]) {
      const result = sanitizeEvidenceDiagnosticForDisplay(`http://localhost:8720${encoded}`);
      assert.equal(result, '<redacted-sensitive-url>');
      assert.doesNotMatch(result, /jasim|Users|\.claude|worktrees/u);
    }
  }
});

test('CAT07 app environment is a minimal positive allowlist and never inherits host secrets', (t) => {
  const fixtureRoot = mkdtempSync(path.join(tmpdir(), 'cat07-child-env-'));
  t.after(() => rmSync(fixtureRoot, { force: true, recursive: true }));
  const runtimePaths = {
    appData: path.join(fixtureRoot, 'app-data'),
    cache: path.join(fixtureRoot, 'cache'),
    home: path.join(fixtureRoot, 'home'),
    npmGlobalConfig: path.join(fixtureRoot, 'global-npmrc'),
    npmUserConfig: path.join(fixtureRoot, 'user-npmrc'),
    temp: path.join(fixtureRoot, 'temp'),
  };
  for (const directory of [
    runtimePaths.appData,
    runtimePaths.cache,
    runtimePaths.home,
    runtimePaths.temp,
  ]) {
    mkdirSync(directory, { recursive: true });
  }
  const sentinel = 'cat07-host-secret-that-must-not-cross';
  const childEnvironment = buildCat07ChildEnvironment({
    hostEnvironment: {
      ...process.env,
      AWS_SECRET_ACCESS_KEY: sentinel,
      NODE_OPTIONS: `--require=${sentinel}`,
      NODE_PATH: sentinel,
      NPM_TOKEN: sentinel,
      npm_config_userconfig: sentinel,
    },
    runtimePaths,
  });
  for (const forbidden of [
    'AWS_SECRET_ACCESS_KEY',
    'NODE_OPTIONS',
    'NODE_PATH',
    'NPM_TOKEN',
    'npm_config_userconfig',
  ]) {
    assert.equal(forbidden in childEnvironment, false);
  }
  assert.equal(childEnvironment.EXPO_UNSTABLE_HEADLESS, '1');
  const browserHostEnvironment =
    process.platform === 'win32'
      ? {
          APPDATA: path.join(fixtureRoot, 'host-app-data'),
          LOCALAPPDATA: path.join(fixtureRoot, 'host-local-app-data'),
          USERPROFILE: path.join(fixtureRoot, 'host-profile'),
        }
      : {};
  for (const directory of Object.values(browserHostEnvironment)) {
    mkdirSync(directory, { recursive: true });
  }
  const browserEnvironment = buildCat07BrowserEnvironment({
    childEnvironment,
    hostEnvironment: browserHostEnvironment,
  });
  for (const forbidden of [
    'AWS_SECRET_ACCESS_KEY',
    'NODE_OPTIONS',
    'NODE_PATH',
    'NPM_TOKEN',
    'npm_config_userconfig',
  ]) {
    assert.equal(forbidden in browserEnvironment, false);
  }
  if (process.platform === 'win32') {
    assert.equal(browserEnvironment.APPDATA, path.resolve(browserHostEnvironment.APPDATA));
    assert.equal(browserEnvironment.LOCALAPPDATA, path.resolve(browserHostEnvironment.LOCALAPPDATA));
    assert.equal(browserEnvironment.USERPROFILE, path.resolve(browserHostEnvironment.USERPROFILE));
  }
  const probePath = path.join(fixtureRoot, 'environment-probe.mjs');
  writeFileSync(probePath, 'process.stdout.write(JSON.stringify(process.env));\n');
  const child = spawnSync(
    process.execPath,
    buildCat07ScrubbedNodeArgs(probePath, [], childEnvironment),
    { encoding: 'utf8', env: childEnvironment, windowsHide: true },
  );
  assert.equal(child.status, 0);
  assert.doesNotMatch(child.stdout, new RegExp(sentinel, 'u'));
  assert.deepEqual(
    Object.keys(JSON.parse(child.stdout)).sort(),
    Object.keys(childEnvironment).sort(),
  );
});

test('CAT07 Expo launch attests its own exact loopback listener over inherited IPC', async (t) => {
  const fixtureRoot = mkdtempSync(path.join(tmpdir(), 'cat07-listener-attestation-'));
  t.after(() => rmSync(fixtureRoot, { force: true, recursive: true }));
  const snapshotRoot = path.join(fixtureRoot, 'source');
  const evidenceDir = path.join(fixtureRoot, 'evidence');
  const runtimeRoot = path.join(fixtureRoot, 'runtime');
  mkdirSync(path.join(snapshotRoot, 'apps', 'mobile'), { recursive: true });
  mkdirSync(evidenceDir);
  const runtimePaths = {
    appData: path.join(runtimeRoot, 'app-data'),
    home: path.join(runtimeRoot, 'home'),
    temp: path.join(runtimeRoot, 'temp'),
  };
  for (const directory of Object.values(runtimePaths)) mkdirSync(directory, { recursive: true });
  const childEnvironment = buildCat07ChildEnvironment({
    hostEnvironment:
      process.platform === 'win32'
        ? { SystemRoot: path.join(path.parse(process.execPath).root, 'Windows') }
        : {},
    runtimePaths,
  });

  const reservation = createServer();
  const port = await new Promise((resolve, reject) => {
    reservation.once('error', reject);
    reservation.listen(0, 'localhost', () => resolve(reservation.address().port));
  });
  await new Promise((resolve, reject) =>
    reservation.close((error) => (error ? reject(error) : resolve())),
  );

  const expoCliPath = path.join(snapshotRoot, 'expo-cli.mjs');
  writeFileSync(
    expoCliPath,
    [
       "import { createServer } from 'node:http';",
       "const portIndex = process.argv.indexOf('--port');",
       'const port = Number(process.argv[portIndex + 1]);',
       "process.send?.({ kind: 'expo-framework-message', value: 'ignored' });",
       "createServer((_request, response) => response.end('ok')).listen(port, 'localhost');",
      '',
    ].join('\n'),
  );
  const child = startCat07ImmutableExpoServer({
    appPort: port,
    childEnvironment,
    evidenceDir,
    expoCliPath,
    snapshotRoot,
  });
  t.after(() => {
    if (!child.killed) child.kill();
  });

  const attestation = await waitForCat07LoopbackListenerAttestation({
    child,
    port,
    timeoutMs: 10_000,
  });
  assert.equal(attestation.pid, child.pid);
  assert.equal(attestation.port, port);
  assert.ok(['127.0.0.1', '::1'].includes(attestation.address));
  child.kill();
  await new Promise((resolve) => child.once('exit', resolve));

  assert.throws(
    () => buildCat07AttestedServerNodeArgs(expoCliPath, [], {}, 0),
    /port is invalid/u,
  );
});

test('CAT07 runtime drift diagnostics are bounded to safe relative dependency paths', (t) => {
  const fixtureRoot = mkdtempSync(path.join(tmpdir(), 'cat07-runtime-drift-'));
  t.after(() => rmSync(fixtureRoot, { force: true, recursive: true }));
  const packageRoot = path.join(fixtureRoot, 'node_modules', 'fixture-package');
  mkdirSync(packageRoot, { recursive: true });
  writeFileSync(path.join(packageRoot, 'changed.txt'), 'before');
  writeFileSync(path.join(packageRoot, 'removed.txt'), 'remove me');
  const before = buildCat07RuntimeDriftFingerprint(fixtureRoot, ['node_modules']);

  writeFileSync(path.join(packageRoot, 'changed.txt'), 'after with a different size');
  rmSync(path.join(packageRoot, 'removed.txt'));
  writeFileSync(path.join(packageRoot, 'created.txt'), 'new');
  const after = buildCat07RuntimeDriftFingerprint(fixtureRoot, ['node_modules']);
  const drift = collectCat07RuntimeDrift(before, after, { limit: 20 });

  assert.ok(drift.includes('changed node_modules/fixture-package/changed.txt'));
  assert.ok(drift.includes('created node_modules/fixture-package/created.txt'));
  assert.ok(drift.includes('removed node_modules/fixture-package/removed.txt'));
  assert.equal(collectCat07RuntimeDrift(before, after, { limit: 1 }).length, 1);
  assert.equal(drift.some((entry) => entry.includes(fixtureRoot)), false);
});

test('CAT07 pre-initializes and binds only the exact CSS interop runtime cache', (t) => {
  const fixtureRoot = mkdtempSync(path.join(tmpdir(), 'cat07-css-interop-cache-'));
  t.after(() => rmSync(fixtureRoot, { force: true, recursive: true }));
  const packageRoot = path.join(fixtureRoot, 'node_modules', 'react-native-css-interop');
  const cacheRoot = path.join(packageRoot, '.cache');
  const expectedFiles = ['android.js', 'ios.js', 'ios.map', 'macos.js', 'native.js', 'windows.js'];
  mkdirSync(packageRoot, { recursive: true });

  assert.equal(
    prepareCat07CssInteropRuntimeCache(fixtureRoot),
    'node_modules/react-native-css-interop/.cache',
  );
  assert.deepEqual(readdirSync(cacheRoot).sort(), expectedFiles);
  for (const filename of expectedFiles) {
    assert.equal(readFileSync(path.join(cacheRoot, filename)).length, 0);
  }
  assert.equal(
    prepareCat07CssInteropRuntimeCache(fixtureRoot),
    'node_modules/react-native-css-interop/.cache',
  );

  writeFileSync(path.join(cacheRoot, 'unexpected.js'), 'undeclared');
  assert.throws(
    () => prepareCat07CssInteropRuntimeCache(fixtureRoot),
    /undeclared runtime file/u,
  );
});

test('CAT07 isolated npm install is offline, lockfile-bound, scrubbed, and has no fallback', (t) => {
  const fixtureRoot = mkdtempSync(path.join(tmpdir(), 'cat07-offline-install-'));
  t.after(() => rmSync(fixtureRoot, { force: true, recursive: true }));
  const cacheContainmentRoot = path.join(fixtureRoot, 'governed-cache-root');
  const cacheRoot = path.join(cacheContainmentRoot, 'npm-cache');
  mkdirSync(cacheContainmentRoot);
  const invocations = [];
  runCat07IsolatedNpmInstall({
    cacheContainmentRoot,
    cacheRoot,
    execute(command, args, options) {
      invocations.push({ args, command, options });
      return Buffer.alloc(0);
    },
    npmCliPath: path.join(fixtureRoot, 'npm-cli.js'),
    snapshotRoot: fixtureRoot,
  });
  assert.equal(invocations.length, 2);
  assert.equal(invocations[0].command, process.execPath);
  assert.ok(invocations[0].args.includes('ci'));
  assert.ok(invocations[0].args.includes('--ignore-scripts'));
  assert.ok(invocations[0].args.includes('--offline'));
  assert.ok(invocations[0].args.includes('--registry=https://registry.npmjs.org/'));
  assert.equal('NPM_TOKEN' in invocations[0].options.env, false);
  assert.equal('NODE_OPTIONS' in invocations[0].options.env, false);

  const cacheMiss = 'remote-registry-secret-must-not-echo';
  const failureSnapshot = path.join(fixtureRoot, 'failure-snapshot');
  mkdirSync(failureSnapshot);
  assert.throws(
    () =>
      runCat07IsolatedNpmInstall({
        cacheContainmentRoot,
        cacheRoot,
        execute() {
          throw new Error(cacheMiss);
        },
        npmCliPath: path.join(fixtureRoot, 'npm-cli.js'),
        snapshotRoot: failureSnapshot,
      }),
    (error) =>
      /warm the governed cache explicitly/u.test(error.message) &&
      !error.message.includes(cacheMiss),
  );

  rmSync(cacheRoot, { force: true, recursive: true });
  const outsideCache = path.join(fixtureRoot, 'outside-cache');
  mkdirSync(outsideCache);
  symlinkSync(outsideCache, cacheRoot, process.platform === 'win32' ? 'junction' : 'dir');
  const junctionSnapshot = path.join(fixtureRoot, 'junction-snapshot');
  mkdirSync(junctionSnapshot);
  assert.throws(
    () =>
      runCat07IsolatedNpmInstall({
        cacheContainmentRoot,
        cacheRoot,
        execute() {
          throw new Error('must not execute through a cache junction');
        },
        npmCliPath: path.join(fixtureRoot, 'npm-cli.js'),
        snapshotRoot: junctionSnapshot,
      }),
    /symlink or junction|canonical paths escape|real directories/u,
  );
});

test('CAT07 runtime setup rejects tool drift and preplanted runtime reparse boundaries', (t) => {
  const fixtureRoot = mkdtempSync(path.join(tmpdir(), 'cat07-runtime-adversarial-'));
  t.after(() => rmSync(fixtureRoot, { force: true, recursive: true }));
  const cacheContainmentRoot = path.join(fixtureRoot, 'cache-containment');
  const cacheRoot = path.join(cacheContainmentRoot, 'cache');
  mkdirSync(cacheContainmentRoot);

  const driftSnapshot = path.join(fixtureRoot, 'drift-snapshot');
  const npmCliPath = path.join(driftSnapshot, 'npm-cli.js');
  mkdirSync(path.join(driftSnapshot, 'scripts'), { recursive: true });
  writeFileSync(npmCliPath, 'export {};\n');
  writeFileSync(path.join(driftSnapshot, 'scripts', 'postinstall.mjs'), 'export {};\n');
  let invocationCount = 0;
  assert.throws(
    () =>
      runCat07IsolatedNpmInstall({
        cacheContainmentRoot,
        cacheRoot,
        enforceToolBindings: true,
        execute() {
          invocationCount += 1;
          writeFileSync(npmCliPath, 'mutated during execution\n');
          return Buffer.alloc(0);
        },
        npmCliPath,
        snapshotRoot: driftSnapshot,
      }),
    /isolated offline npm ci failed/u,
  );
  assert.equal(invocationCount, 1);

  const junctionSnapshot = path.join(fixtureRoot, 'runtime-junction-snapshot');
  const outsideRuntime = path.join(fixtureRoot, 'outside-runtime');
  mkdirSync(path.join(junctionSnapshot, '.tmp'), { recursive: true });
  mkdirSync(outsideRuntime);
  writeFileSync(path.join(outsideRuntime, 'sentinel.txt'), 'outside sentinel');
  symlinkSync(
    outsideRuntime,
    path.join(junctionSnapshot, '.tmp', 'cat07-runtime'),
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  let executed = false;
  assert.throws(
    () =>
      runCat07IsolatedNpmInstall({
        cacheContainmentRoot,
        cacheRoot,
        execute() {
          executed = true;
        },
        npmCliPath,
        snapshotRoot: junctionSnapshot,
      }),
    /symlink or junction|canonical paths escape|real directories/u,
  );
  assert.equal(executed, false);
  assert.equal(readFileSync(path.join(outsideRuntime, 'sentinel.txt'), 'utf8'), 'outside sentinel');

  const linkedConfigSnapshot = path.join(fixtureRoot, 'linked-config-snapshot');
  const linkedRuntimeRoot = path.join(linkedConfigSnapshot, '.tmp', 'cat07-runtime');
  const outsideConfig = path.join(fixtureRoot, 'outside-npmrc');
  mkdirSync(linkedRuntimeRoot, { recursive: true });
  writeFileSync(outsideConfig, 'outside config sentinel');
  let linkedConfigCreated = false;
  try {
    symlinkSync(outsideConfig, path.join(linkedRuntimeRoot, 'empty-global-npmrc'), 'file');
    linkedConfigCreated = true;
  } catch (error) {
    if (error?.code !== 'EPERM') throw error;
  }
  if (linkedConfigCreated) {
    assert.throws(
      () =>
        runCat07IsolatedNpmInstall({
          cacheContainmentRoot,
          cacheRoot,
          execute() {
            executed = true;
          },
          npmCliPath,
          snapshotRoot: linkedConfigSnapshot,
        }),
      /EEXIST|file already exists/u,
    );
    assert.equal(readFileSync(outsideConfig, 'utf8'), 'outside config sentinel');
  }
});

test('CAT07 Git tree parser and verifier reject unsafe modes, paths, collisions, and byte drift', (t) => {
  const fixtureRoot = mkdtempSync(path.join(tmpdir(), 'cat07-git-tree-'));
  t.after(() => rmSync(fixtureRoot, { force: true, recursive: true }));
  const blobOid = (bytes) =>
    createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  const alpha = Buffer.from('alpha\n');
  const beta = Buffer.from('beta\n');
  const alphaOid = blobOid(alpha);
  const betaOid = blobOid(beta);
  const inventory = Buffer.from(
    `100644 blob ${alphaOid}\tapp/alpha.txt\0` + `100755 blob ${betaOid}\tscripts/beta.sh\0`,
    'utf8',
  );
  const entries = parseCat07GitTree(inventory);
  mkdirSync(path.join(fixtureRoot, 'app'), { recursive: true });
  mkdirSync(path.join(fixtureRoot, 'scripts'), { recursive: true });
  writeFileSync(path.join(fixtureRoot, 'app', 'alpha.txt'), alpha);
  writeFileSync(path.join(fixtureRoot, 'scripts', 'beta.sh'), beta);
  const manifest = verifyCat07ExtractedGitTree(fixtureRoot, entries);
  assert.equal(manifest.fileCount, 2);
  assert.equal(manifest.bytes, alpha.length + beta.length);

  writeFileSync(path.join(fixtureRoot, 'app', 'alpha.txt'), 'corrupt\n');
  assert.throws(() => verifyCat07ExtractedGitTree(fixtureRoot, entries), /bytes do not match/u);
  writeFileSync(path.join(fixtureRoot, 'app', 'alpha.txt'), alpha);
  writeFileSync(path.join(fixtureRoot, 'extra.txt'), 'extra');
  assert.throws(
    () => verifyCat07ExtractedGitTree(fixtureRoot, entries),
    (error) =>
      /inventory/u.test(error.message) &&
      error.message.includes('unexpected extra.txt') &&
      !error.message.includes(fixtureRoot),
  );
  rmSync(path.join(fixtureRoot, 'extra.txt'));
  const generatedPath = path.join(fixtureRoot, 'app', 'generated.d.ts');
  const generatedBytes = Buffer.from('exact generated bytes');
  writeFileSync(generatedPath, generatedBytes);
  assert.equal(
    verifyCat07ExtractedGitTree(fixtureRoot, entries, {
      allowedGeneratedFiles: new Map([['app/generated.d.ts', generatedBytes]]),
    }).fileCount,
    2,
  );
  writeFileSync(generatedPath, 'tampered generated bytes');
  assert.throws(
    () =>
      verifyCat07ExtractedGitTree(fixtureRoot, entries, {
        allowedGeneratedFiles: new Map([['app/generated.d.ts', generatedBytes]]),
      }),
    /reviewed generated source bytes do not match/u,
  );
  rmSync(generatedPath);

  assert.throws(
    () => parseCat07GitTree(Buffer.from(`120000 blob ${alphaOid}\tlink\0`, 'utf8')),
    /symlink, gitlink, tree, or unsupported mode/u,
  );
  assert.throws(
    () => parseCat07GitTree(Buffer.from(`160000 commit ${alphaOid}\tsubmodule\0`, 'utf8')),
    /symlink, gitlink, tree, or unsupported mode/u,
  );
  for (const unsafePath of ['../escape', 'C:/ads', 'folder\\escape', 'AUX.txt', 'trail.']) {
    assert.throws(
      () => parseCat07GitTree(Buffer.from(`100644 blob ${alphaOid}\t${unsafePath}\0`, 'utf8')),
      /unsafe/u,
    );
  }
  assert.throws(
    () =>
      parseCat07GitTree(
        Buffer.from(
          `100644 blob ${alphaOid}\tCase.txt\0` + `100644 blob ${betaOid}\tcase.txt\0`,
          'utf8',
        ),
      ),
    /collision/u,
  );
});

test('CAT07 runner rejects screenshots outside their exact governed viewport dimensions', () => {
  const tampered = PNG.sync.write({
    data: Buffer.alloc(4),
    height: 1,
    width: 1,
  });
  assert.throws(
    () =>
      validateCat07ScreenshotArtifact('freshness-lifecycle-iphone-375x667-01-manual.png', tampered),
    /dimensions must be 375 x 667/u,
  );
  assert.throws(
    () => validateCat07ScreenshotArtifact('forged-375x667.png', tampered),
    /outside the governed capture inventory/u,
  );
});

test('CAT07 screenshots bind exact pixels to the run, viewport, and step', () => {
  const runId = 'cat07-11111111-1111-4111-8111-111111111111';
  const viewport = CAT07_REQUIRED_VIEWPORTS[0];
  const artifact = 'freshness-lifecycle-iphone-375x667-01-manual.png';
  const pixels = Buffer.alloc(viewport.width * viewport.height * 4, 255);
  applyCat07CaptureMarkerToRgba(
    pixels,
    viewport.width,
    viewport.height,
    runId,
    viewport.id,
    artifact,
  );
  const png = PNG.sync.write({ data: pixels, height: viewport.height, width: viewport.width });
  assert.equal(validateCat07ScreenshotArtifact(artifact, png, { runId }).width, viewport.width);
  assert.throws(
    () =>
      validateCat07ScreenshotArtifact(
        'freshness-lifecycle-iphone-375x667-02-opening-required.png',
        png,
        { runId },
      ),
    /capture marker does not match/u,
  );
  assert.throws(
    () => validateCat07ScreenshotArtifact(artifact, png, { runId: runId.replace(/1/u, '2') }),
    /capture marker does not match/u,
  );
});

test('CAT07 PNG decoder rejects interlace before decode and bounds decoded allocation', () => {
  const crc32 = (bytes) => {
    let crc = 0xffffffff;
    for (const byte of bytes) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit += 1) {
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
      }
    }
    return (crc ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const typeBytes = Buffer.from(type, 'ascii');
    const result = Buffer.alloc(12 + data.length);
    result.writeUInt32BE(data.length, 0);
    typeBytes.copy(result, 4);
    data.copy(result, 8);
    result.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 8 + data.length);
    return result;
  };
  const png = PNG.sync.write({ data: Buffer.from([1, 2, 3, 255]), height: 1, width: 1 });
  const ihdr = Buffer.from(png.subarray(16, 29));
  ihdr[12] = 1;
  const interlaced = Buffer.concat([png.subarray(0, 8), chunk('IHDR', ihdr), png.subarray(33)]);
  assert.throws(() => decodeStrictCat07Png(interlaced), /no interlace/u);

  const oversizedHeader = Buffer.from(ihdr);
  oversizedHeader.writeUInt32BE(4_096, 0);
  oversizedHeader.writeUInt32BE(4_096, 4);
  oversizedHeader[12] = 0;
  const allocationBomb = Buffer.concat([
    png.subarray(0, 8),
    chunk('IHDR', oversizedHeader),
    png.subarray(33),
  ]);
  assert.throws(() => decodeStrictCat07Png(allocationBomb), /decoded pixels exceed/u);
});

test('CAT07 CDP projection cannot retain raw headers, cookies, post data, or remote URLs', () => {
  const runId = 'cat07-11111111-1111-4111-8111-111111111111';
  const rawSecret = 'raw-cookie-and-post-secret';
  const requestUrls = new Map();
  const projected = projectCat07CdpEvent(
    {
      method: 'Network.requestWillBeSent',
      params: {
        initiator: { stack: { description: rawSecret } },
        request: {
          headers: { Cookie: `session=${rawSecret}` },
          method: 'POST',
          postData: rawSecret,
          url: `http://localhost:8720/shelf?session_id=${rawSecret}`,
        },
        requestId: 'request-1',
        type: 'Fetch',
      },
    },
    {
      allowedOrigin: 'http://localhost:8720',
      observedAt: '2026-07-22T00:00:00.000Z',
      requestUrls,
      runId,
    },
  );
  assert.deepEqual(Object.keys(projected).sort(), [
    'method',
    'observedAt',
    'requestId',
    'requestMethod',
    'type',
    'url',
    'urlPolicyViolation',
  ]);
  assert.equal(projected.url, 'http://localhost:8720/shelf?redacted-query');
  assert.equal(projected.urlPolicyViolation, true);
  assert.doesNotMatch(JSON.stringify(projected), new RegExp(rawSecret, 'u'));

  const remote = projectCat07CdpEvent(
    {
      method: 'Network.requestWillBeSent',
      params: {
        request: { method: 'GET', url: `https://example.com/${rawSecret}` },
        requestId: 'request-2',
        type: 'Fetch',
      },
    },
    {
      allowedOrigin: 'http://localhost:8720',
      observedAt: '2026-07-22T00:00:01.000Z',
      requestUrls,
      runId,
    },
  );
  assert.equal(remote.url, null);
  assert.equal(remote.urlPolicyViolation, true);
  assert.doesNotMatch(JSON.stringify(remote), new RegExp(rawSecret, 'u'));
  assert.ok(
    classifyCat07ProjectedBrowserFailures([remote]).some(
      ({ type }) => type === 'invalid-or-remote-network-request',
    ),
  );
});

test('CAT07 network projection accepts only canonical reviewed Expo query shapes', () => {
  const runId = 'cat07-11111111-1111-4111-8111-111111111111';
  const project = (url) =>
    projectCat07CdpEvent(
      {
        method: 'Network.requestWillBeSent',
        params: { request: { method: 'GET', url }, requestId: 'bundle-1', type: 'Script' },
      },
      {
        allowedOrigin: 'http://localhost:8720',
        observedAt: '2026-07-22T00:00:00.000Z',
        requestUrls: new Map(),
        runId,
      },
    );
  const reviewed = project(
    'http://localhost:8720/.expo/.virtual-metro-entry.bundle?platform=web&dev=true&hot=false&lazy=true&transform.engine=hermes&transform.routerRoot=app&unstable_transformProfile=hermes-stable',
  );
  assert.equal(reviewed.urlPolicyViolation, false);
  assert.equal(
    reviewed.url,
    'http://localhost:8720/.expo/.virtual-metro-entry.bundle?redacted-query',
  );
  for (const url of [
    'http://localhost:8720/.expo/.virtual-metro-entry.bundle?platform=web&dev=true&hot=false&unknown=1',
    'http://localhost:8720/.expo/.virtual-metro-entry.bundle?platform=web&platform=web&dev=true&hot=false',
    'http://localhost:8720/.expo/.virtual-metro-entry.bundle?dev=true&platform=web&hot=false',
    'http://localhost:8720/.expo/.virtual-metro-entry.bundle?platform=ios&dev=true&hot=false',
    'http://localhost:8720/ordinary?safe=value',
  ]) {
    const event = project(url);
    assert.equal(event.urlPolicyViolation, true);
  }
});

test('CAT07 navigation projection fails closed on extra, duplicate, encoded, fragment, and valueless query fields', () => {
  const runId = 'cat07-11111111-1111-4111-8111-111111111111';
  const marker = cat07BrowserMarker(runId, 'iphone-375x667', 'manual');
  const project = (url) =>
    projectCat07CdpEvent(
      { method: 'Page.navigatedWithinDocument', params: { url } },
      {
        allowedOrigin: 'http://localhost:8720',
        observedAt: '2026-07-22T00:00:00.000Z',
        runId,
      },
    );
  const reviewed = project(
    `http://localhost:8720/shelf/manual?cat04Audit=${encodeURIComponent(marker)}`,
  );
  assert.equal(reviewed.urlPolicyViolation, false);
  for (const url of [
    `http://localhost:8720/shelf/manual?cat04Audit=${encodeURIComponent(marker)}&extra=1`,
    `http://localhost:8720/shelf/manual?cat04Audit=${encodeURIComponent(marker)}&cat04Audit=${encodeURIComponent(marker)}`,
    `http://localhost:8720/shelf/manual?%63at04Audit=${encodeURIComponent(marker)}`,
    `http://localhost:8720/shelf/manual?cat04Audit=${encodeURIComponent(marker)}#fragment`,
    'http://localhost:8720/shelf/manual?cat04Audit',
  ]) {
    const event = project(url);
    assert.equal(event.urlPolicyViolation, true);
    assert.ok(
      classifyCat07ProjectedBrowserFailures([event]).some(
        ({ type }) => type === 'unreviewed-url-components',
      ),
    );
  }
});

test('CAT07 CDP client converts every malformed post-parse shape into one non-echoing stream failure', () => {
  class FakeWebSocket {
    constructor() {
      this.listeners = new Map();
      this.readyState = 1;
    }
    addEventListener(name, listener) {
      const listeners = this.listeners.get(name) ?? [];
      listeners.push(listener);
      this.listeners.set(name, listeners);
    }
    emit(name, event = {}) {
      for (const listener of this.listeners.get(name) ?? []) listener(event);
    }
    close() {
      this.readyState = 3;
    }
    send() {}
  }
  const socket = new FakeWebSocket();
  const client = new Cat07CdpClient('ws://localhost:9820/devtools/page/test', {
    allowedOrigin: 'http://localhost:8720',
    runId: 'cat07-11111111-1111-4111-8111-111111111111',
    sourceMonitor: null,
    webSocketFactory: () => socket,
  });
  socket.emit('open');
  const sentinel = 'malformed-shape-secret-must-not-echo';
  client.handleMessage({
    data: JSON.stringify({ method: 'Network.requestWillBeSent', params: null, sentinel }),
  });
  assert.equal(client.eventStreamFailure, 'CAT07 CDP frame has an invalid reviewed shape.');
  assert.doesNotMatch(client.eventStreamFailure, new RegExp(sentinel, 'u'));
  assert.throws(() => client.assertHealthy(), /invalid reviewed shape/u);
});

test('CAT07 debug target JSON is streamed under a hard byte ceiling and exact shape', async () => {
  const target = {
    id: 'target-1',
    type: 'page',
    url: 'about:blank',
    webSocketDebuggerUrl: 'ws://127.0.0.1:9820/devtools/page/target-1',
  };
  const bytes = Buffer.from(JSON.stringify(target), 'utf8');
  const response = new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(bytes.subarray(0, 7));
        controller.enqueue(bytes.subarray(7));
        controller.close();
      },
    }),
    { headers: { 'content-length': String(bytes.length) } },
  );
  assert.deepEqual(await readCat07BoundedJsonResponse(response, { maxBytes: 1_024 }), target);

  for (const declaredOffset of [-1, 1]) {
    const mismatchedLength = new Response(bytes, {
      headers: { 'content-length': String(bytes.length + declaredOffset) },
    });
    await assert.rejects(
      readCat07BoundedJsonResponse(mismatchedLength, { maxBytes: 1_024 }),
      /Content-Length does not match/u,
    );
  }

  const oversized = new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(Buffer.alloc(700));
        controller.enqueue(Buffer.alloc(700));
        controller.close();
      },
    }),
  );
  await assert.rejects(
    readCat07BoundedJsonResponse(oversized, { maxBytes: 1_024 }),
    /byte ceiling/u,
  );
  const extraField = new Response(JSON.stringify({ ...target, hostile: 'field' }));
  await assert.rejects(readCat07BoundedJsonResponse(extraField), /unreviewed target field/u);
});

test('CAT07 debugger websocket binds the exact credential-free target identity', () => {
  const target = {
    id: 'target-1',
    webSocketDebuggerUrl: 'ws://127.0.0.1:9820/devtools/page/target-1',
  };
  assert.equal(
    validateCat07DebuggerWebSocketUrl(target, 9820).toString(),
    target.webSocketDebuggerUrl,
  );
  for (const webSocketDebuggerUrl of [
    'ws://user:password@127.0.0.1:9820/devtools/page/target-1',
    'ws://127.0.0.1:9820/devtools/page/target-1?secret=value',
    'ws://127.0.0.1:9820/devtools/page/target-1#fragment',
    'ws://127.0.0.1:9820/devtools/page/target-1/extra',
    'ws://127.0.0.1:9820/devtools/page/different-target',
    'ws://127.0.0.1:9821/devtools/page/target-1',
    'wss://127.0.0.1:9820/devtools/page/target-1',
  ]) {
    assert.throws(
      () => validateCat07DebuggerWebSocketUrl({ ...target, webSocketDebuggerUrl }, 9820),
      /exact credential-free local target/u,
    );
  }
  const hostile = 'not-a-url-with-secret-token';
  assert.throws(
    () => validateCat07DebuggerWebSocketUrl({ ...target, webSocketDebuggerUrl: hostile }, 9820),
    (error) => !error.message.includes(hostile) && /URL is invalid/u.test(error.message),
  );
});

test('CAT07 binds ephemeral DevTools and listener metadata to exact reviewed shapes', () => {
  assert.deepEqual(
    parseCat07DevToolsActivePort(
      Buffer.from('54321\n/devtools/browser/11111111-1111-4111-8111-111111111111\n'),
    ),
    {
      browserPath: '/devtools/browser/11111111-1111-4111-8111-111111111111',
      port: 54321,
    },
  );
  for (const hostile of [
    '0\n/devtools/browser/id\n',
    '65536\n/devtools/browser/id\n',
    '54321\n/devtools/page/id\n',
    '54321\n/devtools/browser/id\nextra\n',
    '54321\nhttp://remote.example/devtools/browser/id\n',
  ]) {
    assert.throws(() => parseCat07DevToolsActivePort(Buffer.from(hostile)), /DevToolsActivePort/u);
  }
  const attestation = {
    address: '::1',
    family: 'IPv6',
    kind: 'cat07-loopback-listener',
    pid: 4321,
    port: 54321,
    schemaVersion: CAT07_LOOPBACK_ATTESTATION_SCHEMA_VERSION,
  };
  assert.deepEqual(
    parseCat07LoopbackListenerAttestation(attestation, {
      expectedPid: 4321,
      expectedPort: 54321,
    }),
    attestation,
  );
  assert.throws(
    () =>
      parseCat07LoopbackListenerAttestation(
        { ...attestation, address: '0.0.0.0', family: 'IPv4' },
        { expectedPid: 4321, expectedPort: 54321 },
      ),
    /escaped the loopback/u,
  );
  assert.throws(
    () =>
      parseCat07LoopbackListenerAttestation(
        { ...attestation, pid: 4322 },
        { expectedPid: 4321, expectedPort: 54321 },
      ),
    /not owned by the launched child/u,
  );
});

test('CAT07 Expo log never writes raw child output and terminates promptly on overflow', (t) => {
  const fixtureRoot = mkdtempSync(path.join(tmpdir(), 'cat07-expo-log-'));
  t.after(() => rmSync(fixtureRoot, { force: true, recursive: true }));
  const evidenceDir = path.join(fixtureRoot, 'evidence');
  const snapshotRoot = path.join(fixtureRoot, 'source');
  mkdirSync(evidenceDir, { recursive: true });
  mkdirSync(path.join(snapshotRoot, 'apps', 'mobile'), { recursive: true });
  const expoCliPath = path.join(snapshotRoot, 'node_modules', 'expo', 'bin', 'cli');
  mkdirSync(path.dirname(expoCliPath), { recursive: true });
  writeFileSync(expoCliPath, '#!/usr/bin/env node\n');
  const children = [];
  const launch = () => {
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.killedByAudit = false;
    child.kill = () => {
      child.killedByAudit = true;
      return true;
    };
    children.push(child);
    return child;
  };
  const server = startCat07ImmutableExpoServer({
    appPort: 8720,
    childEnvironment: {},
    evidenceDir,
    expoCliPath,
    launch,
    snapshotRoot,
  });
  const sentinel = `sk_live_${'s'.repeat(24)}`;
  server.stdout.write(sentinel.slice(0, 10));
  server.stderr.write(sentinel.slice(10));
  const logPath = path.join(evidenceDir, 'expo-cat07-freshness.log');
  assert.doesNotMatch(readFileSync(logPath, 'utf8'), /sk_live_/u);
  finalizeCat07ExpoLog(evidenceDir, server);
  assert.doesNotMatch(readFileSync(logPath, 'utf8'), /sk_live_|ssssssss/u);

  const overflowing = startCat07ImmutableExpoServer({
    appPort: 8721,
    childEnvironment: {},
    evidenceDir,
    expoCliPath,
    launch,
    snapshotRoot,
  });
  overflowing.stdout.write(Buffer.alloc(300 * 1024, 65));
  assert.equal(overflowing.cat07LogState.overflow, true);
  assert.equal(overflowing.killedByAudit, true);
  finalizeCat07ExpoLog(evidenceDir, overflowing);
  assert.equal(
    readFileSync(logPath, 'utf8'),
    'CAT07 Expo child log exceeded its reviewed byte ceiling; raw output was discarded.\n',
  );

  const launchFailure = startCat07ImmutableExpoServer({
    appPort: 8722,
    childEnvironment: {},
    evidenceDir,
    expoCliPath,
    launch,
    snapshotRoot,
  });
  launchFailure.emit('error', new Error('host-secret-that-must-not-echo'));
  assert.equal(launchFailure.cat07LogState.launchFailure, true);
  assert.equal(launchFailure.cat07LogState.rawChunks.length, 0);
  launchFailure.emit('exit', 1, null);
  assert.equal(launchFailure.cat07LogState.exited, true);
  assert.equal(launchFailure.cat07LogState.exitCode, 1);

  writeFileSync(expoCliPath, '#!/usr/bin/env node\n');
  assert.throws(
    () =>
      startCat07ImmutableExpoServer({
        appPort: 8723,
        childEnvironment: {},
        evidenceDir,
        expoCliPath,
        launch() {
          const child = launch();
          writeFileSync(expoCliPath, 'mutated after pre-bind\n');
          return child;
        },
        snapshotRoot,
      }),
    /trusted tool identity or bytes changed/u,
  );
});

test('CAT07 bounded reader rejects non-regular and oversized evidence before parsing', (t) => {
  const fixtureRoot = mkdtempSync(path.join(tmpdir(), 'cat07-bounded-read-'));
  t.after(() => rmSync(fixtureRoot, { force: true, recursive: true }));
  const file = path.join(fixtureRoot, 'evidence.json');
  writeFileSync(file, '{"ok":true}\n');
  assert.equal(
    readBoundedRegularFile(file, { containmentRoot: fixtureRoot, maxBytes: 32 }).toString('utf8'),
    '{"ok":true}\n',
  );
  assert.throws(() => readBoundedRegularFile(file, { maxBytes: 4 }), /exceeds 4/u);
  assert.throws(() => readBoundedRegularFile(fixtureRoot, { maxBytes: 32 }), /regular file/u);

  const link = path.join(fixtureRoot, 'linked.json');
  try {
    symlinkSync(file, link, 'file');
    assert.throws(() => readBoundedRegularFile(link, { maxBytes: 32 }), /regular file/u);
  } catch (error) {
    if (error?.code !== 'EPERM') throw error;
  }

  const outsideRoot = mkdtempSync(path.join(tmpdir(), 'cat07-bounded-outside-'));
  t.after(() => rmSync(outsideRoot, { force: true, recursive: true }));
  writeFileSync(path.join(outsideRoot, 'identical.json'), '{"ok":true}\n');
  const parentLink = path.join(fixtureRoot, 'parent-link');
  try {
    symlinkSync(outsideRoot, parentLink, process.platform === 'win32' ? 'junction' : 'dir');
    assert.throws(
      () =>
        readBoundedRegularFile(path.join(parentLink, 'identical.json'), {
          containmentRoot: fixtureRoot,
          maxBytes: 32,
        }),
      /symbolic-link|containment/u,
    );
  } catch (error) {
    if (error?.code !== 'EPERM') throw error;
  }
});

test('CAT07 CDP frames are bounded before decoding or parsing', () => {
  let parseCalled = false;
  assert.throws(
    () =>
      parseCat07CdpFrame(Buffer.alloc(CAT07_MAX_CDP_FRAME_BYTES + 1), {
        parse() {
          parseCalled = true;
          return {};
        },
      }),
    /pre-parse byte limit/u,
  );
  assert.equal(parseCalled, false);
  assert.deepEqual(parseCat07CdpFrame('{"id":1}'), {
    frameBytes: 8,
    message: { id: 1 },
  });
});

test('CAT07 canonical JSON recursively sorts keys and Markdown hygiene distinguishes separators', () => {
  const canonical = canonicalEvidenceJsonBytes({ z: { y: 2, a: 1 }, a: [{ d: 4, b: 3 }] });
  assert.equal(
    canonical.toString('utf8'),
    '{\n  "a": [\n    {\n      "b": 3,\n      "d": 4\n    }\n  ],\n  "z": {\n    "a": 1,\n    "y": 2\n  }\n}\n',
  );
  assert.equal(
    collectEvidenceTextArtifactHygieneFailures(
      'safe.md',
      Buffer.from(`${'-'.repeat(200)}\n`, 'utf8'),
    ).some((failure) => failure.includes('long base64-like payload')),
    false,
  );
  assert.equal(
    collectEvidenceTextArtifactHygieneFailures(
      'unsafe.md',
      Buffer.from(`${'A'.repeat(200)}\n`, 'utf8'),
    ).some((failure) => failure.includes('long base64-like payload')),
    true,
  );
});

test('CAT07 source monitor records a transient edit even after bytes are restored', async (t) => {
  const fixtureRoot = mkdtempSync(path.join(tmpdir(), 'cat07-transient-source-'));
  t.after(() => rmSync(fixtureRoot, { force: true, recursive: true }));
  const source = path.join(fixtureRoot, 'source.ts');
  writeFileSync(source, 'stable\n');
  const monitor = createCat07SourceMutationMonitor({ rootPath: fixtureRoot });
  t.after(() => monitor.close());
  writeFileSync(source, 'transient\n');
  writeFileSync(source, 'stable\n');
  await delay(100);
  assert.throws(() => monitor.assertClean(), /transient or persistent source-tree mutation/u);
});

test('CAT07 source monitor permits reviewed generated runtime paths and Windows watcher aliases', async (t) => {
  const fixtureRoot = mkdtempSync(path.join(tmpdir(), 'cat07-expo-env-source-'));
  t.after(() => rmSync(fixtureRoot, { force: true, recursive: true }));
  const mobileRoot = path.join(fixtureRoot, 'apps', 'mobile');
  const cssInteropCacheRoot = path.join(
    fixtureRoot,
    'node_modules',
    'react-native-css-interop',
    '.cache',
  );
  mkdirSync(mobileRoot, { recursive: true });
  mkdirSync(cssInteropCacheRoot, { recursive: true });
  const expoEnvironmentPath = path.join(mobileRoot, 'expo-env.d.ts');
  const androidCachePath = path.join(cssInteropCacheRoot, 'android.js');
  // The runner creates these reviewed runtime outputs before installing the
  // source monitor. Updating an existing allowed file must remain permitted.
  writeFileSync(expoEnvironmentPath, 'initial reviewed generated runtime bytes');
  writeFileSync(androidCachePath, Buffer.alloc(0));
  await delay(100);
  const monitor = createCat07SourceMutationMonitor({ rootPath: fixtureRoot });
  t.after(() => monitor.close());
  writeFileSync(expoEnvironmentPath, 'reviewed later by exact byte contract');
  writeFileSync(androidCachePath, Buffer.alloc(0));
  await delay(100);
  assert.equal(monitor.assertClean(), true);
});

test('CAT07 source monitor rejects undeclared CSS interop cache entries', async (t) => {
  const fixtureRoot = mkdtempSync(path.join(tmpdir(), 'cat07-css-interop-source-'));
  t.after(() => rmSync(fixtureRoot, { force: true, recursive: true }));
  const cacheRoot = path.join(
    fixtureRoot,
    'node_modules',
    'react-native-css-interop',
    '.cache',
  );
  mkdirSync(cacheRoot, { recursive: true });
  const monitor = createCat07SourceMutationMonitor({ rootPath: fixtureRoot });
  t.after(() => monitor.close());
  writeFileSync(path.join(cacheRoot, 'unexpected.js'), Buffer.alloc(0));
  await delay(100);
  assert.throws(() => monitor.assertClean(), /transient or persistent source-tree mutation/u);
});

test('CAT07 fatal reporting preserves the first sanitized failure', () => {
  const summary = {};
  assert.equal(recordCat07Fatal(summary, new Error('first failure')), 'first failure');
  assert.equal(recordCat07Fatal(summary, new Error('second failure')), 'first failure');
  assert.equal(summary.fatalError, 'first failure');

  const sanitizedSummary = {};
  const secret = 'https://user:password@example.test/private';
  const diagnostic = recordCat07Fatal(sanitizedSummary, new Error(secret));
  assert.doesNotMatch(diagnostic, /password|example\.test|private/u);
});

test('CAT07 full validator child has a hard timeout and output ceiling', () => {
  let observedOptions = null;
  const result = validateCat07FullEvidenceContract(repoRoot, {
    execute(_command, _args, options) {
      observedOptions = options;
      const error = new Error('synthetic timeout');
      error.stderr = 'bounded synthetic timeout';
      throw error;
    },
  });
  assert.equal(result.status, 'blocked');
  assert.equal(observedOptions.timeout, CAT07_FULL_VALIDATOR_TIMEOUT_MS);
  assert.equal(observedOptions.maxBuffer, CAT07_FULL_VALIDATOR_MAX_BUFFER);
});

test('CAT07 full validator binds its child and PASS marker to one exact HEAD', () => {
  let observedArgs = null;
  const result = validateCat07FullEvidenceContract(repoRoot, {
    execute(_command, args) {
      observedArgs = args;
      const expectedHead = args
        .find((argument) => argument.startsWith('--expected-head-sha='))
        .slice('--expected-head-sha='.length);
      return `PASS committed CAT07 full evidence contract ${expectedHead}\n`;
    },
  });
  assert.equal(result.status, 'pass');
  assert.match(result.headSha, /^[a-f0-9]{40}$/u);
  assert.ok(observedArgs.includes(`--expected-head-sha=${result.headSha}`));

  let executed = false;
  const mismatch = validateCat07FullEvidenceContract(repoRoot, {
    expectedHeadSha: '0'.repeat(40),
    execute() {
      executed = true;
      return '';
    },
  });
  assert.equal(mismatch.status, 'blocked');
  assert.equal(executed, false);
});

test('CAT07 direct committed check ignores poisoned PATH and Git redirection controls', (t) => {
  const fixtureRoot = mkdtempSync(path.join(tmpdir(), 'cat07-human-git-poison-'));
  t.after(() => rmSync(fixtureRoot, { force: true, recursive: true }));
  const fakeGit = path.join(fixtureRoot, process.platform === 'win32' ? 'git.cmd' : 'git');
  const fakeHead = '0'.repeat(40);
  writeFileSync(
    fakeGit,
    process.platform === 'win32'
      ? `@echo ${fakeHead}\r\n`
      : `#!/bin/sh\nprintf '%s\\n' '${fakeHead}'\n`,
  );
  if (process.platform !== 'win32') chmodSync(fakeGit, 0o755);
  const decoyGitDir = path.join(fixtureRoot, 'decoy-git-dir');
  mkdirSync(decoyGitDir);
  const environment = {
    ...process.env,
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: 'core.bare',
    GIT_CONFIG_VALUE_0: 'true',
    GIT_DIR: decoyGitDir,
    GIT_OBJECT_DIRECTORY: decoyGitDir,
    GIT_WORK_TREE: fixtureRoot,
    Path: fixtureRoot,
    PATH: fixtureRoot,
  };
  const child = spawnSync(
    process.execPath,
    [humanManifestPath, '--cat07-committed-check', `--expected-head-sha=${fakeHead}`],
    {
      cwd: repoRoot,
      encoding: 'utf8',
      env: environment,
      maxBuffer: 2 * 1024 * 1024,
      timeout: 30_000,
      windowsHide: true,
    },
  );
  assert.equal(child.status, 1);
  assert.match(child.stderr, /HEAD does not match its expected pinned SHA/u);
  assert.doesNotMatch(child.stdout + child.stderr, /core\.bare|decoy-git-dir/u);
});

test('package scripts expose CAT07 audit and its contract suite', () => {
  assert.equal(packageJson.devDependencies.pngjs, '3.4.0');
  assert.equal(
    packageJson.scripts['e2e:cat07-shelf-freshness'],
    'node scripts/e2e/cat07-shelf-freshness-audit.mjs',
  );
  assert.equal(
    packageJson.scripts['e2e:cat07-shelf-freshness:test'],
    'node --test scripts/e2e/cat07-shelf-freshness-audit.test.mjs',
  );
});
