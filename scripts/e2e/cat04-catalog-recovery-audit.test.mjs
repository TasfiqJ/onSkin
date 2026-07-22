import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  CAT04_AUDIT_LIMITATIONS,
  CAT04_BROWSER_DEBUG_READY_TIMEOUT_MS,
  CAT04_FIXTURE_GROUPS,
  CAT04_REQUIRED_VIEWPORTS,
  CAT04_SCENARIO_MATRIX,
  assertCat04SourceProvenance,
  cat04ServerEnvironment,
  classifyBrowserFailures,
  collectCat04UntrackedSourcePaths,
  isExcludedFromInteractionTree,
  listEvidenceArtifacts,
  listCat04NonIgnoredUntrackedRepoFiles,
  measureControlGeometry,
  readSourceGitSha,
  safeArtifactId,
  sanitizeCat04DiagnosticText,
  validateCat04AuditConfiguration,
} from './cat04-catalog-recovery-audit.mjs';

const runnerPath = fileURLToPath(new URL('./cat04-catalog-recovery-audit.mjs', import.meta.url));
const packagePath = fileURLToPath(new URL('../../package.json', import.meta.url));
const source = readFileSync(runnerPath, 'utf8');
const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));

function fakeElement({
  rect,
  parentElement = null,
  overflowX = 'visible',
  overflowY = 'visible',
  clientLeft = 0,
  clientTop = 0,
  clientWidth = rect.width,
  clientHeight = rect.height,
  excluded = false,
}) {
  return {
    clientHeight,
    clientLeft,
    clientTop,
    clientWidth,
    closest: () => (excluded ? {} : null),
    getBoundingClientRect: () => rect,
    parentElement,
    testStyle: {
      display: 'block',
      opacity: '1',
      overflowX,
      overflowY,
      visibility: 'visible',
    },
  };
}

const fakeStyle = (node) => node.testStyle;

test('CAT04 audit matrix covers every deterministic lane at all required web viewports', () => {
  const configuration = validateCat04AuditConfiguration();

  assert.deepEqual(
    CAT04_REQUIRED_VIEWPORTS.map(({ width, height }) => `${width}x${height}`),
    ['375x667', '390x844', '430x932'],
  );
  assert.deepEqual(
    new Set(CAT04_SCENARIO_MATRIX.map(({ id }) => id)),
    new Set([
      'search-matched',
      'search-no-match',
      'search-offline',
      'search-wrong-match-recovery',
      'scan-matched',
      'scan-no-match',
      'scan-offline',
      'scan-error',
      'scan-wrong-match-recovery',
      'scan-camera-denied-settings-failure',
      'ocr-camera-denied-settings-failure',
      'ocr-capture-failure',
      'no-match-missing-barcode',
      'catalog-recovery-malformed',
      'manual-barcode-validation',
    ]),
  );
  assert.equal(configuration.scenarioCount, 15);
  assert.equal(configuration.viewportCount, 3);
  assert.equal(configuration.executionCount, 45);
  assert.equal(CAT04_FIXTURE_GROUPS.length, 6);
  assert.equal(
    CAT04_SCENARIO_MATRIX.every(({ groupId }) =>
      CAT04_FIXTURE_GROUPS.some(({ id }) => id === groupId),
    ),
    true,
  );
  const executorCases = new Set(
    Array.from(source.matchAll(/case '([^']+)':/g), (match) => match[1]),
  );
  assert.equal(
    CAT04_SCENARIO_MATRIX.every(({ id }) => executorCases.has(id)),
    true,
  );
});

test('fixture groups force local deterministic data and avoid inherited live catalog settings', () => {
  const groupEnv = Object.fromEntries(CAT04_FIXTURE_GROUPS.map(({ id, env }) => [id, env]));

  assert.equal(groupEnv.matched.EXPO_PUBLIC_E2E_CATALOG_SEARCH_RESULT, 'matched');
  assert.equal(groupEnv.matched.EXPO_PUBLIC_E2E_SHELF_SCAN_RESULT, 'matched');
  assert.equal(groupEnv['no-match'].EXPO_PUBLIC_E2E_CATALOG_SEARCH_RESULT, 'no_match');
  assert.equal(groupEnv['no-match'].EXPO_PUBLIC_E2E_SHELF_SCAN_RESULT, 'no_match');
  assert.equal(groupEnv.offline.EXPO_PUBLIC_E2E_SHELF_SCAN_RESULT, 'offline');
  assert.equal(groupEnv['scan-error'].EXPO_PUBLIC_E2E_SHELF_SCAN_RESULT, 'error');
  assert.equal(groupEnv['scan-error'].EXPO_PUBLIC_E2E_CATALOG_SEARCH_RESULT, 'wrong_match');
  assert.equal(
    groupEnv['camera-recovery'].EXPO_PUBLIC_E2E_SHELF_CAMERA_PERMISSION,
    'denied_no_retry',
  );
  assert.equal(groupEnv['camera-recovery'].EXPO_PUBLIC_E2E_APP_SETTINGS_FAILURE, '1');
  assert.equal(groupEnv['ocr-capture-failure'].EXPO_PUBLIC_E2E_SHELF_OCR_CAPTURE_FAILURE, 'once');
  assert.equal('EXPO_PUBLIC_E2E_SHELF_OCR_CAPTURE_FAILURE' in groupEnv['camera-recovery'], false);
  assert.equal('EXPO_PUBLIC_E2E_SHELF_CAMERA_PERMISSION' in groupEnv['ocr-capture-failure'], false);

  const environment = cat04ServerEnvironment(
    CAT04_FIXTURE_GROUPS.find(({ id }) => id === 'offline'),
    {
      PATH: 'preserved',
      EXPO_PUBLIC_E2E_ACCOUNT_ISOLATION: 'inherited-danger',
      EXPO_PUBLIC_E2E_PRIVATE_STORAGE_FAILURE: 'unavailable',
      EXPO_PUBLIC_E2E_SHELF_SCAN_RESULT: 'inherited-danger',
      EXPO_PUBLIC_POSTHOG_KEY: 'inherited-live-key',
      EXPO_PUBLIC_SENTRY_DSN: 'https://inherited-live-dsn.example',
      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'inherited-live-key',
      EXPO_PUBLIC_SUPABASE_URL: 'https://inherited-live-project.supabase.co',
    },
  );
  assert.equal(environment.PATH, 'preserved');
  assert.equal('EXPO_PUBLIC_E2E_ACCOUNT_ISOLATION' in environment, false);
  assert.equal('EXPO_PUBLIC_E2E_PRIVATE_STORAGE_FAILURE' in environment, false);
  assert.equal(environment.EXPO_PUBLIC_E2E_SHELF_SCAN_RESULT, 'offline');
  assert.equal(environment.EXPO_PUBLIC_E2E_SHELF_SCAN_BARCODE, '012345678905');
  assert.equal(environment.EXPO_NO_DOTENV, '1');
  assert.equal(environment.EXPO_PUBLIC_POSTHOG_KEY, '');
  assert.equal(environment.EXPO_PUBLIC_SENTRY_DSN, '');
  assert.equal(environment.EXPO_PUBLIC_SUPABASE_URL, 'https://blocked-supabase-url.invalid');
  assert.equal(environment.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, '__BLOCKED_PLACEHOLDER__');
});

test('each fresh fixture profile passes the real age, explicit-consent, and activation gates', () => {
  assert.equal(CAT04_BROWSER_DEBUG_READY_TIMEOUT_MS, 120_000);
  assert.match(source, /--headless=old/);
  assert.match(source, /--disable-gpu-sandbox/);
  assert.match(source, /--in-process-gpu/);
  assert.doesNotMatch(source, /--headless=new/);
  assert.doesNotMatch(source, /--disable-gpu',/);
  assert.match(source, /new URL\('\/', baseUrl\)/);
  assert.match(source, /resetUrl\.searchParams\.set\('e2eReset', 'local'\)/);
  assert.match(source, /clickByText\(client, 'Begin'\)/);
  assert.match(source, /fillByLabel\(client, 'Day of birth', '01'\)/);
  assert.match(source, /fillByLabel\(client, 'Month of birth', '01'\)/);
  assert.match(source, /fillByLabel\(client, 'Year of birth', '1990'\)/);
  assert.match(source, /clickByText\(client, 'I agree\. Continue'\)/);
  assert.match(source, /waitForPath\(client, '\/onboarding\/goals'\)/);
  assert.match(source, /cat04ConsentProbe/);
  assert.match(source, /summary\.bootstrapResults\.push\(bootstrap\)/);
  assert.match(source, /bootstrap\.verdict === 'pass'/);
  assert.match(
    source,
    /expectedBootstrapCount: CAT04_FIXTURE_GROUPS\.length \* CAT04_REQUIRED_VIEWPORTS\.length/,
  );
});

test('extended recovery lanes exercise wrong matches, retry dedupe, guards, and barcode normalization', () => {
  const scenarios = Object.fromEntries(
    CAT04_SCENARIO_MATRIX.map((scenario) => [scenario.id, scenario]),
  );
  assert.equal(scenarios['search-wrong-match-recovery'].fixture, 'wrong_match');
  assert.equal(scenarios['scan-wrong-match-recovery'].groupId, 'matched');
  assert.equal(scenarios['no-match-missing-barcode'].route, '/shelf/no-match');
  assert.equal(scenarios['catalog-recovery-malformed'].route, '/shelf/catalog-recovery');
  assert.equal(scenarios['manual-barcode-validation'].route, '/shelf/manual');
  assert.match(source, /case 'search-wrong-match-recovery'/);
  assert.match(source, /Wrong Catalog Serum/);
  assert.match(source, /case 'scan-wrong-match-recovery'/);
  assert.match(source, /clickByText\(client, 'Report wrong match'\)/);
  assert.match(source, /Retry saved on this device/);
  assert.match(source, /already saved for retry/);
  assert.match(source, /case 'no-match-missing-barcode'/);
  assert.match(source, /case 'catalog-recovery-malformed'/);
  assert.match(source, /Match unavailable/);
  assert.match(source, /case 'manual-barcode-validation'/);
  assert.match(source, /lot 036000291452/);
  assert.match(source, /036000\/291452/);
  assert.match(source, /042526/);
  assert.match(source, /036000291453/);
  assert.match(source, /0 36000-29145 2/);
  assert.match(source, /barcode 036000291452/);
  assert.match(source, /enabled Add to shelf after explicit opening state/);
  assert.equal((source.match(/assertDisabledControl\([^\n]+, 'Continue'\)/g) ?? []).length, 4);
});

test('offline fixture permits its bounded unresolved lookup without hiding other network hangs', () => {
  assert.match(source, /networkIdleMaxInflightForFixtureGroup\(fixtureGroup\)/);
  assert.match(source, /fixtureGroup === 'offline'\) return 5/);
  assert.match(source, /fixtureGroup === 'camera-recovery'\) return 3/);
  assert.match(source, /fixtureGroup === 'ocr-capture-failure'\) return 1/);
  assert.match(source, /networkIdleMaxInflightForScenario\(scenario\)/);
  assert.match(source, /fixtureGroup === 'camera-recovery' \? 30_000 : 10_000/);
  assert.match(source, /allowed \$\{maxInflight\}/);
  assert.ok(
    (source.match(/maxInflight: networkIdleMaxInflightForScenario\(scenario\)/g) ?? []).length >=
      7,
    'All bounded camera/OCR navigation lanes should pass their network-idle allowance.',
  );
});

test('browser failure classification ignores only local Expo dev HMR refusal noise', () => {
  assert.deepEqual(
    classifyBrowserFailures(
      [
        {
          method: 'Network.webSocketCreated',
          params: { requestId: 'hmr', url: 'ws://localhost:8560/hot' },
        },
        {
          method: 'Network.webSocketFrameError',
          params: {
            errorMessage: 'Error in connection establishment: net::ERR_CONNECTION_REFUSED',
            requestId: 'hmr',
          },
        },
        {
          method: 'Log.entryAdded',
          params: {
            entry: {
              level: 'error',
              text: "WebSocket connection to 'ws://localhost:8560/hot' failed: Error in connection establishment: net::ERR_CONNECTION_REFUSED",
            },
          },
        },
      ],
      ['http://localhost:8320'],
    ),
    [],
  );
  assert.equal(
    classifyBrowserFailures(
      [
        {
          method: 'Log.entryAdded',
          params: { entry: { level: 'error', text: 'Real app error' } },
        },
      ],
      ['http://localhost:8320'],
    ).length,
    1,
  );
});

test('report lanes prove disclosure and explicit confirmation before transport', () => {
  assert.match(source, /waitForText\(client, 'Confirm catalog report'\)/);
  assert.match(source, /waitForInputValue\(client, 'Product name for report', SEARCH_QUERY\)/);
  assert.match(
    source,
    /fillByLabel\(client, 'Product name for report', 'Confirmed missing product'\)/,
  );
  assert.match(source, /includes\('RoutineKind account ID'\)/);
  assert.match(source, /includes\('included in your RoutineKind data export'\)/);
  assert.match(source, /includes\('Nothing is sent to Open Beauty Facts'\)/);
  assert.equal((source.match(/clickByText\(client, 'Send report'\)/g) ?? []).length, 3);
});

test('runner records the honest queued-recovery limitation instead of faking a ready cycle', () => {
  const limitation = CAT04_AUDIT_LIMITATIONS.find((value) => value.includes('lookupBarcode'));
  assert.ok(limitation);
  assert.match(limitation, /requires a real staging catalog/);
  assert.match(limitation, /deliberately not faked/);
});

test('interaction audit includes non-button controls used by opened-date recovery', () => {
  assert.match(source, /\[role="radio"\]/);
  assert.match(source, /\[role="checkbox"\]/);
  assert.match(source, /\[role="switch"\]/);
  assert.match(source, /scrollControlIntoView\(client, 'Just opened it'\)/);
  assert.match(source, /clickByText\(client, 'Add it by hand', \{ exact: false \}\)/);
  assert.match(source, /scrollControlIntoView\(client, 'Add it by hand', \{ exact: false \}\)/);
  assert.match(source, /isExcludedFromInteractionTree/);
  assert.match(source, /measureControlGeometry/);
  assert.match(source, /interactionTreeText/);
  assert.match(source, /unsafeClipped/);
  assert.match(source, /scrollClipped/);
  assert.match(source, /if \(!fullyExposed\) continue/);
  assert.match(source, /type: 'clippedVisibleControl'/);
});

test('interaction geometry distinguishes safe scroll edges from unsafe clipping', () => {
  const scrollAncestor = fakeElement({
    rect: { bottom: 617, height: 517, left: 0, right: 375, top: 100, width: 375 },
    overflowY: 'auto',
  });
  const partialScrollControl = fakeElement({
    parentElement: scrollAncestor,
    rect: { bottom: 692, height: 94, left: 24, right: 351, top: 598, width: 327 },
  });
  const scrolled = measureControlGeometry(
    partialScrollControl,
    { height: 667, width: 375 },
    fakeStyle,
  );

  assert.equal(scrolled.fullyExposed, false);
  assert.equal(scrolled.scrollClipped, true);
  assert.equal(scrolled.unsafeClipped, false);
  assert.equal(scrolled.exposedHeight, 19);

  const hiddenAncestor = fakeElement({
    rect: { bottom: 617, height: 517, left: 0, right: 375, top: 100, width: 375 },
    overflowY: 'hidden',
  });
  const truncatedControl = fakeElement({
    parentElement: hiddenAncestor,
    rect: { bottom: 692, height: 94, left: 24, right: 351, top: 598, width: 327 },
  });
  const truncated = measureControlGeometry(
    truncatedControl,
    { height: 667, width: 375 },
    fakeStyle,
  );

  assert.equal(truncated.fullyExposed, false);
  assert.equal(truncated.scrollClipped, false);
  assert.equal(truncated.unsafeClipped, true);
});

test('interaction geometry uses padding-box clips and rejects excluded routes', () => {
  const borderedClip = fakeElement({
    clientHeight: 400,
    clientLeft: 4,
    clientTop: 4,
    clientWidth: 367,
    overflowY: 'hidden',
    rect: { bottom: 520, height: 420, left: 0, right: 375, top: 100, width: 375 },
  });
  const edgeControl = fakeElement({
    parentElement: borderedClip,
    rect: { bottom: 520, height: 20, left: 24, right: 351, top: 500, width: 327 },
  });
  const geometry = measureControlGeometry(edgeControl, { height: 667, width: 375 }, fakeStyle);

  assert.equal(geometry.exposedHeight, 4);
  assert.equal(geometry.unsafeClipped, true);

  const collapsedClip = fakeElement({
    clientHeight: 0,
    overflowY: 'hidden',
    rect: { bottom: 520, height: 420, left: 0, right: 375, top: 100, width: 375 },
  });
  const collapsedControl = fakeElement({
    parentElement: collapsedClip,
    rect: { bottom: 200, height: 48, left: 24, right: 351, top: 152, width: 327 },
  });
  assert.equal(
    measureControlGeometry(collapsedControl, { height: 667, width: 375 }, fakeStyle),
    null,
  );

  const excluded = fakeElement({
    excluded: true,
    rect: { bottom: 48, height: 48, left: 0, right: 48, top: 0, width: 48 },
  });
  assert.equal(isExcludedFromInteractionTree(excluded), true);
  assert.equal(measureControlGeometry(excluded, { height: 667, width: 375 }, fakeStyle), null);
});

test('browser control is bounded and turns setup failures into machine-readable failures', () => {
  assert.match(source, /CDP command \$\{method\} timed out after \$\{timeoutMs\}ms/);
  assert.match(source, /rejectPending\(new Error\('CDP websocket closed/);
  assert.match(source, /withAuditTimeout\(/);
  assert.match(source, /CAT04_OPERATION_TIMEOUT/);
  assert.match(source, /recordFixtureGroupFailure\(summary, group/);
  assert.match(source, /summary\.fatalError =/);
  assert.match(source, /--clear --port/);
});

test('browser-event policy fails closed on console, page, HTTP, remote, and network errors', () => {
  const baseUrl = 'http://localhost:8460';
  const failures = classifyBrowserFailures(
    [
      {
        method: 'Runtime.consoleAPICalled',
        params: { args: [{ value: 'bad console' }], type: 'error' },
      },
      {
        method: 'Runtime.exceptionThrown',
        params: { exceptionDetails: { text: 'uncaught' } },
      },
      { method: 'Log.entryAdded', params: { entry: { level: 'error', text: 'browser log' } } },
      {
        method: 'Network.requestWillBeSent',
        params: { request: { url: 'https://unexpected.example/catalog' }, requestId: 'remote' },
      },
      {
        method: 'Network.responseReceived',
        params: { response: { status: 503, url: `${baseUrl}/bundle.js` } },
      },
      {
        method: 'Network.requestWillBeSent',
        params: { request: { url: `${baseUrl}/asset.png` }, requestId: 'failed' },
      },
      {
        method: 'Network.loadingFailed',
        params: { canceled: false, errorText: 'net::ERR_FAILED', requestId: 'failed' },
      },
      {
        method: 'Network.webSocketCreated',
        params: { requestId: 'remote-ws', url: 'wss://unexpected.example/live' },
      },
      {
        method: 'Network.webSocketCreated',
        params: { requestId: 'local-ws', url: 'ws://localhost:8460/hmr' },
      },
      {
        method: 'Network.webSocketFrameError',
        params: { errorMessage: 'frame failed', requestId: 'local-ws' },
      },
      { method: 'Page.javascriptDialogOpening', params: { message: 'unexpected' } },
      { method: 'Inspector.targetCrashed', params: {} },
    ],
    [baseUrl],
  );

  assert.deepEqual(
    new Set(failures.map(({ type }) => type)),
    new Set([
      'console-error',
      'page-exception',
      'browser-log-error',
      'unexpected-remote-request',
      'http-error-response',
      'network-loading-failed',
      'unexpected-remote-websocket',
      'websocket-frame-error',
      'unexpected-page-dialog',
      'page-crash',
    ]),
  );
});

test('intentional canceled local requests and console warnings are not mislabeled as failures', () => {
  const baseUrl = 'http://localhost:8460';
  assert.deepEqual(
    classifyBrowserFailures(
      [
        {
          method: 'Runtime.consoleAPICalled',
          params: { args: [{ value: 'development warning' }], type: 'warning' },
        },
        {
          method: 'Network.requestWillBeSent',
          params: { request: { url: `${baseUrl}/bundle.js` }, requestId: 'local' },
        },
        {
          method: 'Network.loadingFailed',
          params: { canceled: true, errorText: 'net::ERR_ABORTED', requestId: 'local' },
        },
      ],
      [baseUrl],
    ),
    [],
  );
});

test('runner emits machine-readable evidence and explicitly withholds native-device proof', () => {
  assert.match(source, /Page\.captureScreenshot/);
  assert.match(source, /writeJson\(evidenceDir, 'summary\.json', summary\)/);
  assert.match(source, /writeReport\(evidenceDir, summary\)/);
  assert.match(source, /browser-events-/);
  assert.match(source, /nativeDeviceProof: false/);
  assert.match(
    source,
    /It does not prove native camera hardware, OS permission sheets, or physical-iPhone behavior/,
  );
  assert.match(source, /sourceGitSha: readSourceGitSha\(\)/);
  assert.match(source, /summary\.artifacts = listEvidenceArtifacts\(evidenceDir\)/);
  assert.match(source, /summary\.screenshots = summary\.artifacts\.filter/);
  assert.match(source, /sanitizeCat04ExpoLogs\(evidenceDir\)/);
  const reportWrite = source.lastIndexOf('writeReport(evidenceDir, summary);');
  const artifactInventory = source.lastIndexOf(
    'summary.artifacts = listEvidenceArtifacts(evidenceDir);',
  );
  const summaryWrite = source.lastIndexOf("writeJson(evidenceDir, 'summary.json', summary);");
  assert.ok(
    reportWrite >= 0 && reportWrite < artifactInventory && artifactInventory < summaryWrite,
  );
  assert.match(source, /Explicit-consent bootstrap/);
  assert.equal(safeArtifactId(' Search / No Match @ 390x844 '), 'search-no-match-390x844');
});

test('diagnostic log sanitizer redacts host paths before artifact inventory', () => {
  const sanitized = sanitizeCat04DiagnosticText(
    'Starting project at C:\\Users\\person\\Desktop\\onSkin\\.claude\\worktrees\\ios-privacy-source\\apps\\mobile\n',
  );

  assert.doesNotMatch(sanitized, /C:\\Users|\.claude\\worktrees/u);
  assert.match(sanitized, /<redacted-absolute-path>|<user-home>|<repo-root>/u);
});

test('runner binds evidence to full source SHA and inventories every completed artifact deterministically', (t) => {
  assert.match(readSourceGitSha(), /^[a-f0-9]{40}$/);

  const evidenceDir = mkdtempSync(path.join(tmpdir(), 'cat04-artifacts-'));
  t.after(() => rmSync(evidenceDir, { force: true, recursive: true }));
  mkdirSync(path.join(evidenceDir, 'nested'));
  writeFileSync(path.join(evidenceDir, 'summary.json'), '{}\n');
  writeFileSync(path.join(evidenceDir, 'report.md'), '# report\n');
  writeFileSync(path.join(evidenceDir, 'expo-matched.log'), 'ready\n');
  writeFileSync(path.join(evidenceDir, 'browser-events-matched.json'), '[]\n');
  writeFileSync(path.join(evidenceDir, 'nested', 'route-result.json'), '{}\n');
  writeFileSync(path.join(evidenceDir, 'route.png'), 'png');

  assert.deepEqual(listEvidenceArtifacts(evidenceDir), [
    'browser-events-matched.json',
    'expo-matched.log',
    'nested/route-result.json',
    'report.md',
    'route.png',
  ]);
});

test('runner rejects nonignored untracked source before mutating evidence', (t) => {
  const fixtureRoot = mkdtempSync(path.join(tmpdir(), 'cat04-untracked-provenance-'));
  t.after(() => rmSync(fixtureRoot, { force: true, recursive: true }));
  execFileSync('git', ['init', '--quiet'], { cwd: fixtureRoot, stdio: 'ignore' });
  writeFileSync(path.join(fixtureRoot, '.gitignore'), 'test-results/\n');
  execFileSync('git', ['add', '.gitignore'], { cwd: fixtureRoot, stdio: 'ignore' });

  mkdirSync(path.join(fixtureRoot, 'apps', 'mobile', 'src'), { recursive: true });
  writeFileSync(
    path.join(fixtureRoot, 'apps', 'mobile', 'src', 'untracked-route.tsx'),
    'export {};\n',
  );
  mkdirSync(path.join(fixtureRoot, '.tmp', 'cat04-browser-profile'), { recursive: true });
  writeFileSync(path.join(fixtureRoot, '.tmp', 'cat04-browser-profile', 'runtime.json'), '{}\n');
  mkdirSync(path.join(fixtureRoot, 'test-results', 'human-e2e'), { recursive: true });
  writeFileSync(path.join(fixtureRoot, 'test-results', 'human-e2e', 'ignored.json'), '{}\n');

  const untracked = listCat04NonIgnoredUntrackedRepoFiles(fixtureRoot).sort();
  assert.deepEqual(untracked, [
    '.tmp/cat04-browser-profile/runtime.json',
    'apps/mobile/src/untracked-route.tsx',
  ]);
  assert.deepEqual(collectCat04UntrackedSourcePaths(untracked), [
    'apps/mobile/src/untracked-route.tsx',
  ]);
  assert.throws(
    () => assertCat04SourceProvenance({ root: fixtureRoot, untrackedRepoFiles: untracked }),
    /Refusing to generate CAT04 evidence.*apps\/mobile\/src\/untracked-route\.tsx/,
  );

  assert.deepEqual(
    assertCat04SourceProvenance({
      root: fixtureRoot,
      untrackedRepoFiles: [
        '.tmp/cat04-browser-profile/runtime.json',
        'docs/generated/readiness-status-audit.json',
        'docs/phase-4/generated/catalog-qa-report.json',
        'test-results/human-e2e/2026-07-18/cat04-catalog-recovery-current/summary.json',
      ],
    }),
    [],
  );

  const provenanceGuard = source.lastIndexOf('assertCat04SourceProvenance();');
  const evidenceMutation = source.lastIndexOf('clearPreviousEvidence(evidenceDir);');
  assert.ok(provenanceGuard >= 0 && provenanceGuard < evidenceMutation);
});

test('package commands wire the audit and its no-server contract suite', () => {
  assert.equal(
    packageJson.scripts['e2e:cat04-catalog-recovery'],
    'node scripts/e2e/cat04-catalog-recovery-audit.mjs',
  );
  assert.equal(
    packageJson.scripts['e2e:cat04-catalog-recovery:test'],
    'node --test scripts/e2e/cat04-catalog-recovery-audit.test.mjs',
  );
});
