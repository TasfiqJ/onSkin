import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  CAT05_AUDIT_LIMITATIONS,
  CAT05_EDIT_FENCE_TEXT,
  CAT05_EVIDENCE_SCHEMA_VERSION,
  CAT05_EVIDENCE_RELATIVE_DIR,
  CAT05_FIXTURE_GROUPS,
  CAT05_FIXTURE_TRANSCRIPT,
  CAT05_MANUAL_UNICODE_TEXT,
  CAT05_REQUIRED_VIEWPORTS,
  CAT05_SCENARIO_MATRIX,
  assertCat05ArtifactBindings,
  assertCat05LocalTarget,
  assertCat05PassArtifactSet,
  assertCat05PrivacySourceContract,
  assertCat05SourceBinding,
  assertCat05EvidenceDirectory,
  assertCat05SourceProvenance,
  buildCat05ArtifactManifest,
  cat05ActiveChildCount,
  cat05ServerEnvironment,
  classifyCat05BrowserFailures,
  collectCat05UndeclaredDirtyPaths,
  expectedCat05PassArtifacts,
  listCat05EvidenceArtifacts,
  navigateToCat05OcrConsentProbe,
  prepareCat05Navigation,
  resolveCat05AuditBinding,
  sanitizeBrowserEvents,
  stopActiveCat05Processes,
  trackCat05Child,
  validateCat05AuditConfiguration,
  withAuditTimeout,
} from './cat05-native-ocr-ui-audit.mjs';

const runnerPath = fileURLToPath(new URL('./cat05-native-ocr-ui-audit.mjs', import.meta.url));
const routePath = fileURLToPath(
  new URL('../../apps/mobile/src/app/shelf/ocr.tsx', import.meta.url),
);
const source = readFileSync(runnerPath, 'utf8');
const routeSource = readFileSync(routePath, 'utf8');
const expectedSourceGitSha = 'a'.repeat(40);
const fixedRunId = '123e4567-e89b-42d3-a456-426614174000';

test('CAT05 deterministic UI matrix covers every state at all supported web viewports', () => {
  const configuration = validateCat05AuditConfiguration();

  assert.deepEqual(
    CAT05_REQUIRED_VIEWPORTS.map(({ width, height }) => `${width}x${height}`),
    ['375x667', '390x844', '430x932'],
  );
  assert.deepEqual(
    new Set(CAT05_SCENARIO_MATRIX.map(({ id }) => id)),
    new Set([
      'recognized-review-retake-continue',
      'edit-fence-suggestion-adoption',
      'no-text-manual-recovery',
      'timeout-manual-recovery',
      'failure-manual-recovery',
    ]),
  );
  assert.equal(configuration.viewportCount, 3);
  assert.equal(configuration.scenarioCount, 5);
  assert.equal(configuration.fixtureGroupCount, 4);
  assert.equal(configuration.executionCount, 15);
});

test('evidence binding pins the exact source candidate and deterministic web build without fabricating native proof', () => {
  const binding = resolveCat05AuditBinding({
    actualSourceGitSha: expectedSourceGitSha,
    environment: {
      CAT05_EXPECTED_SOURCE_GIT_SHA: expectedSourceGitSha,
      PHASE5_IOS_BUILD_ID: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      PHASE5_IOS_BUILD_PROFILE: 'staging',
    },
    runId: fixedRunId,
  });

  assert.equal(binding.evidenceSchemaVersion, CAT05_EVIDENCE_SCHEMA_VERSION);
  assert.equal(binding.runId, fixedRunId);
  assert.equal(binding.sourceGitSha, expectedSourceGitSha);
  assert.equal(binding.expectedSourceGitSha, expectedSourceGitSha);
  assert.match(binding.fixtureConfigurationSha256, /^[0-9a-f]{64}$/);
  assert.match(binding.scenarioMatrixSha256, /^[0-9a-f]{64}$/);
  assert.match(binding.viewportMatrixSha256, /^[0-9a-f]{64}$/);
  assert.match(binding.webFixtureBuild.buildId, /^[0-9a-f]{64}$/);
  assert.equal(binding.webFixtureBuild.profile, 'development-only-deterministic-expo-web');
  assert.deepEqual(binding.candidateNativeBuild, {
    archiveSha256: null,
    easIosBuildId: null,
    executedByThisAudit: false,
    profile: 'staging',
    proofStatus: 'not_applicable_to_expo_web_ui_audit',
  });
  assert.doesNotMatch(JSON.stringify(binding), /aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee/);
});

test('evidence binding fails closed on missing, malformed, or mismatched candidate context', () => {
  const validEnvironment = {
    CAT05_EXPECTED_SOURCE_GIT_SHA: expectedSourceGitSha,
    PHASE5_IOS_BUILD_PROFILE: 'staging',
  };
  const resolve = (environment, actualSourceGitSha = expectedSourceGitSha) =>
    resolveCat05AuditBinding({ actualSourceGitSha, environment, runId: fixedRunId });

  assert.throws(() => resolve({ PHASE5_IOS_BUILD_PROFILE: 'staging' }), /CAT05_EXPECTED/);
  assert.throws(
    () => resolve({ CAT05_EXPECTED_SOURCE_GIT_SHA: expectedSourceGitSha }),
    /PHASE5_IOS_BUILD_PROFILE/,
  );
  assert.throws(
    () => resolve({ ...validEnvironment, CAT05_EXPECTED_SOURCE_GIT_SHA: 'A'.repeat(40) }),
    /exact lowercase/,
  );
  assert.throws(() => resolve(validEnvironment, 'b'.repeat(40)), /source commit mismatch/);
  assert.throws(
    () => resolve({ ...validEnvironment, PHASE5_IOS_BUILD_PROFILE: 'production' }),
    /must be staging/,
  );
  assert.throws(
    () => resolve({ ...validEnvironment, PHASE5_IOS_BUILD_PROFILE: ' staging' }),
    /whitespace/,
  );
  assert.throws(
    () =>
      resolveCat05AuditBinding({
        actualSourceGitSha: expectedSourceGitSha,
        environment: validEnvironment,
        runId: 'reused-or-malformed',
      }),
    /UUID v4/,
  );
});

test('fixture groups are isolated, allowlisted, local, and fail closed around live services', () => {
  const groupEnvironment = Object.fromEntries(
    CAT05_FIXTURE_GROUPS.map((group) => [
      group.id,
      cat05ServerEnvironment(group, {
        PATH: 'preserved',
        EXPO_PUBLIC_E2E_SHELF_OCR_RESULT: 'inherited-danger',
        EXPO_PUBLIC_NATIVE_UNREVIEWED_FLAG: 'inherited-danger',
        EXPO_PUBLIC_POSTHOG_KEY: 'inherited-live-key',
        EXPO_PUBLIC_RANDOM_FEATURE: 'inherited-danger',
        EXPO_PUBLIC_SENTRY_DSN: 'https://inherited-live.example',
        EXPO_PUBLIC_SUPABASE_URL: 'https://inherited-live.supabase.co',
        EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'inherited-live-key',
      }),
    ]),
  );

  assert.equal(groupEnvironment.recognized.EXPO_PUBLIC_E2E_SHELF_OCR_RESULT, 'recognized');
  assert.equal(groupEnvironment['no-text'].EXPO_PUBLIC_E2E_SHELF_OCR_RESULT, 'no_text');
  assert.equal(groupEnvironment['timed-out'].EXPO_PUBLIC_E2E_SHELF_OCR_RESULT, 'timed_out');
  assert.equal(groupEnvironment.failed.EXPO_PUBLIC_E2E_SHELF_OCR_RESULT, 'failed');
  for (const environment of Object.values(groupEnvironment)) {
    assert.equal(environment.PATH, 'preserved');
    assert.equal(environment.EXPO_NO_DOTENV, '1');
    assert.equal(environment.EXPO_PUBLIC_NATIVE_OCR_ENABLED, 'true');
    assert.equal(environment.EXPO_PUBLIC_POSTHOG_KEY, '');
    assert.equal(environment.EXPO_PUBLIC_SENTRY_DSN, '');
    assert.equal(environment.EXPO_PUBLIC_SUPABASE_URL, 'https://blocked-supabase-url.invalid');
    assert.equal(environment.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, '__BLOCKED_PLACEHOLDER__');
    assert.equal(environment.EXPO_PUBLIC_NATIVE_UNREVIEWED_FLAG, undefined);
    assert.equal(environment.EXPO_PUBLIC_RANDOM_FEATURE, undefined);
  }
});

test('ambient public feature flags cannot alter the deterministic fixture configuration hash', () => {
  const baseEnvironment = {
    CAT05_EXPECTED_SOURCE_GIT_SHA: expectedSourceGitSha,
    PHASE5_IOS_BUILD_PROFILE: 'staging',
  };
  const clean = resolveCat05AuditBinding({
    actualSourceGitSha: expectedSourceGitSha,
    environment: baseEnvironment,
    runId: fixedRunId,
  });
  const hostile = resolveCat05AuditBinding({
    actualSourceGitSha: expectedSourceGitSha,
    environment: {
      ...baseEnvironment,
      EXPO_PUBLIC_NATIVE_OCR_ENABLED: 'false',
      EXPO_PUBLIC_UNREVIEWED_FEATURE: 'enabled',
    },
    runId: fixedRunId,
  });

  assert.equal(hostile.fixtureConfigurationSha256, clean.fixtureConfigurationSha256);
  assert.equal(hostile.webFixtureBuild.buildId, clean.webFixtureBuild.buildId);
});

test('the route and runner share the exact development-only fixture contract', () => {
  assert.match(routeSource, /EXPO_PUBLIC_E2E_SHELF_OCR_RESULT/);
  assert.match(routeSource, /Platform\.OS !== 'web'/);
  assert.match(routeSource, /typeof __DEV__ === 'undefined' \|\| !__DEV__/);
  for (const fixture of ['recognized', 'no_text', 'timed_out', 'failed']) {
    assert.match(routeSource, new RegExp(`'${fixture}'`));
  }
  assert.match(routeSource, /Development-only deterministic OCR state\./);
  assert.match(routeSource, /It does not exercise Apple Vision or a device photo\./);
  assert.match(routeSource, /setTimeout\(\(\) =>/);
  assert.match(routeSource, /applyLabelOcrRecognition/);
  assert.match(routeSource, /adoptLabelOcrSuggestion/);
  assert.match(routeSource, /Retake label photo/);
});

test('source-only privacy assertions pin no-cache previews, trusted raw captures, and guarded cleanup', () => {
  const contract = assertCat05PrivacySourceContract();

  assert.equal(contract.proofKind, 'source-assertions-only');
  assert.equal(contract.nativeDeviceProof, false);
  assert.equal(contract.assertionIds.length, 6);
  assert.equal(contract.files.length, 4);
  for (const file of contract.files) {
    assert.ok(file.bytes > 100);
    assert.match(file.sha256, /^[0-9a-f]{64}$/);
  }

  assert.throws(
    () =>
      assertCat05PrivacySourceContract({
        sourceByPath: {
          'apps/mobile/src/app/shelf/ocr.tsx': routeSource.replace(
            'cachePolicy="none"',
            'cachePolicy="memory"',
          ),
        },
      }),
    /label-preview-hidden-during-cleanup-and-cache-disabled/,
  );
});

test('browser and page targets are pinned to explicit local HTTP origin and port', () => {
  assert.equal(
    assertCat05LocalTarget('http://localhost:8620/shelf/ocr', {
      expectedPort: 8620,
      pathPrefix: '/shelf/ocr',
    }).origin,
    'http://localhost:8620',
  );
  for (const candidate of [
    'https://localhost:8620/shelf/ocr',
    'http://127.0.0.1:8620/shelf/ocr',
    'http://localhost.evil.example:8620/shelf/ocr',
    'http://user:password@localhost:8620/shelf/ocr',
    'http://localhost/shelf/ocr',
  ]) {
    assert.throws(() => assertCat05LocalTarget(candidate, { expectedPort: 8620 }), /CAT05/);
  }
  assert.throws(
    () => assertCat05LocalTarget('http://localhost:8621/shelf/ocr', { expectedPort: 8620 }),
    /port/,
  );
});

test('cold consent probe navigates once and discards only the prior request epoch', async () => {
  const calls = [];
  const client = {
    closed: false,
    inflight: new Set(['request-from-previous-document']),
    async send(method, params) {
      calls.push({ method, params });
      if (method === 'Runtime.evaluate') return { result: { value: true } };
      return {};
    },
  };

  const url = await navigateToCat05OcrConsentProbe(client, {
    baseUrl: 'http://localhost:8620',
    groupId: 'recognized',
    timeoutMs: 100,
  });

  assert.equal(client.inflight.size, 0);
  assert.equal(calls.filter(({ method }) => method === 'Page.navigate').length, 1);
  assert.equal(calls.filter(({ method }) => method === 'Runtime.evaluate').length, 1);
  assert.match(url, /^http:\/\/localhost:8620\/shelf\/ocr\?cat05ConsentProbe=recognized-\d+$/);
  assert.doesNotMatch(
    source.slice(
      source.indexOf('export async function navigateToCat05OcrConsentProbe'),
      source.indexOf('async function establishLocalHealthConsent'),
    ),
    /while\s*\([^)]*\)[\s\S]*Page\.navigate/,
  );
  assert.match(source, /async function waitForNetworkIdle\(client, timeoutMs = 60_000\)/);
});

test('navigation request reset fails closed without lifecycle tracking', () => {
  assert.throws(() => prepareCat05Navigation({}), /request lifecycle tracking/);
});

test('group browser classification blocks console, page, process-surface, and untrusted network failures', () => {
  const failures = classifyCat05BrowserFailures(
    [
      {
        method: 'Runtime.consoleAPICalled',
        params: { args: [{ value: 'console exploded' }], type: 'error' },
      },
      { method: 'Runtime.exceptionThrown', params: { exceptionDetails: { text: 'uncaught' } } },
      { method: 'Log.entryAdded', params: { entry: { level: 'error', text: 'browser error' } } },
      { method: 'Page.crashed', params: {} },
      {
        method: 'Network.requestWillBeSent',
        params: { request: { url: 'https://localhost:8620/not-the-bound-http-server' } },
      },
      {
        method: 'Network.requestWillBeSent',
        params: { request: { url: 'https://analytics.example/collect' } },
      },
    ],
    'http://localhost:8620',
  );
  const types = new Set(failures.map(({ type }) => type));
  for (const type of [
    'console-error',
    'page-exception',
    'browser-log-error',
    'page-crash',
    'untrusted-network-target',
    'unexpected-remote-request',
  ]) {
    assert.ok(types.has(type), `Missing CAT05 browser failure type ${type}.`);
  }

  assert.deepEqual(
    classifyCat05BrowserFailures(
      [
        {
          method: 'Network.requestWillBeSent',
          params: { request: { url: 'http://localhost:8620/index.bundle?platform=web' } },
        },
        {
          method: 'Network.webSocketCreated',
          params: { url: 'ws://localhost:8620/message' },
        },
      ],
      'http://localhost:8620',
    ),
    [],
  );
});

test('deterministic transcripts are NFC Unicode and cover late-user-edit preservation', () => {
  for (const value of [
    CAT05_FIXTURE_TRANSCRIPT,
    CAT05_MANUAL_UNICODE_TEXT,
    CAT05_EDIT_FENCE_TEXT,
  ]) {
    assert.equal(value, value.normalize('NFC'));
    assert.doesNotMatch(value, /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u);
  }
  assert.match(CAT05_FIXTURE_TRANSCRIPT, /\u6c34/u);
  assert.match(CAT05_FIXTURE_TRANSCRIPT, /\p{Script=Cyrillic}/u);
  assert.match(CAT05_EDIT_FENCE_TEXT, /user-kept edit/);
  assert.ok(routeSource.includes(`text: '${CAT05_FIXTURE_TRANSCRIPT}'`));
});

test('audit labels its narrow proof boundary in code, scope JSON, report, and result records', () => {
  assert.equal(CAT05_AUDIT_LIMITATIONS.length, 5);
  assert.ok(CAT05_AUDIT_LIMITATIONS.every((limitation) => limitation.length > 20));
  assert.match(CAT05_AUDIT_LIMITATIONS.join(' '), /does not execute Apple Vision/i);
  assert.match(CAT05_AUDIT_LIMITATIONS.join(' '), /not physical-iPhone/i);
  assert.match(CAT05_AUDIT_LIMITATIONS.join(' '), /not.*OCR accuracy/i);
  assert.match(CAT05_AUDIT_LIMITATIONS.join(' '), /source assertions only/i);
  assert.match(CAT05_AUDIT_LIMITATIONS.join(' '), /must not be used as a native.*privacy claim/i);
  assert.match(source, /nativeDeviceProof: false/g);
  assert.match(source, /deterministic Expo-web OCR review UI-state evidence only/);
  assert.match(source, /must never be used to enable or clear the native OCR launch gate/);
  assert.match(source, /doesNotProve: CAT05_AUDIT_LIMITATIONS\.slice\(1\)/);
  assert.match(source, /sourceGitSha/);
  assert.match(source, /proofKind: 'source-assertions-only'/);
  assert.match(source, /easIosBuildId: null/);
});

test('audit executes user-like edit, suggestion, retake, fallback, and continue actions', () => {
  assert.match(source, /clickByText\(client, 'Capture label'\)/);
  assert.match(source, /fillByLabel\(client, 'Ingredient label text', CAT05_EDIT_FENCE_TEXT\)/);
  assert.match(source, /Recognized text is ready\. Your edits were kept\./);
  assert.match(source, /clickByText\(client, 'Use recognized text'\)/);
  assert.match(source, /clickByText\(client, 'Retake label photo'\)/);
  assert.match(source, /clickByText\(client, 'Looks right\. Continue'\)/);
  assert.match(source, /waitForPath\(client, '\/shelf\/manual'\)/);
  assert.match(source, /No readable text found/);
  assert.match(source, /Label reading took too long/);
  assert.match(source, /The label wasn’t read/);
  assert.match(source, /Check 2 unclear lines/);
  assert.match(source, /The scan may be incomplete\./);
});

test('audit evaluates accessibility, geometry, horizontal overflow, logs, dialogs, and requests', () => {
  assert.match(source, /missingAccessibleName/);
  assert.match(source, /sub44VisibleControl/);
  assert.match(source, /blockedCenterHitTest/);
  assert.match(source, /horizontalOverflow/);
  assert.match(source, /liveRegions/);
  assert.match(source, /classifyBrowserFailures/);
  assert.match(source, /Runtime\.consoleAPICalled/);
  assert.match(source, /Network\.requestWillBeSent/);
  assert.match(source, /Page\.javascriptDialogOpening/);
  assert.match(source, /Page\.captureScreenshot/);
});

test('browser-event evidence is bounded while preserving privacy-relevant request and error facts', () => {
  const sanitized = sanitizeBrowserEvents([
    {
      method: 'Network.requestWillBeSent',
      observedAt: '2026-07-18T00:00:00.000Z',
      params: {
        documentURL: 'http://localhost:8620/shelf/ocr',
        request: {
          headers: { Authorization: 'must-not-be-copied' },
          method: 'GET',
          postData: 'must-not-be-copied',
          url: 'http://localhost:8620/bundle.js',
        },
        requestId: 'request-1',
        type: 'Script',
      },
    },
    {
      method: 'Runtime.consoleAPICalled',
      observedAt: '2026-07-18T00:00:01.000Z',
      params: { args: [{ value: 'fixture warning' }], type: 'warning' },
    },
    { method: 'Network.loadingFinished', params: { requestId: 'request-1' } },
  ]);

  assert.deepEqual(sanitized, [
    {
      documentURL: 'http://localhost:8620/shelf/ocr',
      method: 'Network.requestWillBeSent',
      observedAt: '2026-07-18T00:00:00.000Z',
      requestId: 'request-1',
      requestMethod: 'GET',
      type: 'Script',
      url: 'http://localhost:8620/bundle.js',
    },
    {
      method: 'Runtime.consoleAPICalled',
      observedAt: '2026-07-18T00:00:01.000Z',
      text: 'fixture warning',
      type: 'warning',
    },
  ]);
  assert.doesNotMatch(JSON.stringify(sanitized), /Authorization|postData|must-not-be-copied/);
});

test('source provenance refuses uncommitted source but permits declared runtime and evidence output', () => {
  assert.deepEqual(
    collectCat05UndeclaredDirtyPaths([
      '.tmp/cat05-browser/profile.json',
      `${CAT05_EVIDENCE_RELATIVE_DIR}/summary.json`,
    ]),
    [],
  );
  assert.deepEqual(
    collectCat05UndeclaredDirtyPaths([
      `${CAT05_EVIDENCE_RELATIVE_DIR}/summary.json`,
      '.tmp/../apps/mobile/src/app/shelf/ocr.tsx',
      '.tmpish/not-scratch.txt',
      'apps/mobile/src/app/shelf/ocr.tsx',
      'scripts/e2e/cat05-native-ocr-ui-audit.mjs',
    ]),
    [
      '.tmpish/not-scratch.txt',
      'apps/mobile/src/app/shelf/ocr.tsx',
      'scripts/e2e/cat05-native-ocr-ui-audit.mjs',
    ],
  );
  assert.deepEqual(
    assertCat05SourceProvenance({
      dirtyPaths: [
        '.tmp/cat05-browser/profile.json',
        `${CAT05_EVIDENCE_RELATIVE_DIR}/summary.json`,
      ],
    }),
    [],
  );
  assert.throws(
    () => assertCat05SourceProvenance({ dirtyPaths: ['apps/mobile/src/app/shelf/ocr.tsx'] }),
    /Refusing to generate CAT05 web evidence from uncommitted source/,
  );
  assert.equal(
    assertCat05SourceBinding({
      actualSourceGitSha: expectedSourceGitSha,
      dirtyPaths: ['.tmp/allowed-scratch.txt'],
      expectedSourceGitSha,
    }),
    expectedSourceGitSha,
  );
  assert.throws(
    () =>
      assertCat05SourceBinding({
        actualSourceGitSha: 'b'.repeat(40),
        dirtyPaths: [],
        expectedSourceGitSha,
      }),
    /source changed during evidence capture/,
  );
});

test('evidence cleanup is pinned to the declared workspace directory', () => {
  assert.match(
    assertCat05EvidenceDirectory(CAT05_EVIDENCE_RELATIVE_DIR).replaceAll('\\', '/'),
    new RegExp(`${CAT05_EVIDENCE_RELATIVE_DIR.replaceAll('/', '\\/')}$`),
  );
  assert.throws(
    () => assertCat05EvidenceDirectory(path.join(tmpdir(), 'cat05-untrusted-output')),
    /Refusing CAT05 evidence writes outside/,
  );
});

test('evidence inventory is deterministic and excludes the self-referential summary', (t) => {
  const evidenceDir = mkdtempSync(path.join(tmpdir(), 'cat05-evidence-inventory-'));
  t.after(() => rmSync(evidenceDir, { force: true, recursive: true }));
  mkdirSync(path.join(evidenceDir, 'nested'));
  writeFileSync(path.join(evidenceDir, 'summary.json'), '{}\n');
  writeFileSync(path.join(evidenceDir, 'scope.json'), '{}\n');
  writeFileSync(path.join(evidenceDir, 'report.md'), '# report\n');
  writeFileSync(path.join(evidenceDir, 'nested', 'step.json'), '{}\n');
  writeFileSync(path.join(evidenceDir, 'step.png'), 'png');

  assert.deepEqual(listCat05EvidenceArtifacts(evidenceDir), [
    'nested/step.json',
    'report.md',
    'scope.json',
    'step.png',
  ]);
});

test('PASS evidence requires the exact scenario/viewport artifact set and hashes every artifact', (t) => {
  const expected = expectedCat05PassArtifacts();
  assert.equal(expected.length, 139);
  assert.equal(expected.filter((artifact) => artifact.endsWith('.png')).length, 55);
  assert.ok(
    expected.includes('recognized-review-retake-continue-iphone-375x667-recognized-ready.png'),
  );
  assert.ok(expected.includes('failure-manual-recovery-iphone-430x932-manual-handoff.json'));
  assert.deepEqual(assertCat05PassArtifactSet(expected), expected);
  assert.throws(() => assertCat05PassArtifactSet(expected.slice(1)), /missing:/);
  assert.throws(() => assertCat05PassArtifactSet([...expected, 'stale-pass.png']), /unexpected:/);

  const evidenceDir = mkdtempSync(path.join(tmpdir(), 'cat05-evidence-manifest-'));
  t.after(() => rmSync(evidenceDir, { force: true, recursive: true }));
  writeFileSync(path.join(evidenceDir, 'result.json'), '{"runId":"fresh"}\n');
  const manifest = buildCat05ArtifactManifest(evidenceDir, ['result.json']);
  assert.equal(manifest.length, 1);
  assert.equal(manifest[0].path, 'result.json');
  assert.equal(manifest[0].bytes, 18);
  assert.match(manifest[0].sha256, /^[0-9a-f]{64}$/);
  assert.throws(
    () => buildCat05ArtifactManifest(evidenceDir, ['../outside.json']),
    /escaped the evidence directory/,
  );

  const binding = resolveCat05AuditBinding({
    actualSourceGitSha: expectedSourceGitSha,
    environment: {
      CAT05_EXPECTED_SOURCE_GIT_SHA: expectedSourceGitSha,
      PHASE5_IOS_BUILD_PROFILE: 'staging',
    },
    runId: fixedRunId,
  });
  const boundArtifact = 'recognized-review-retake-continue-iphone-375x667-result.json';
  const evidenceBinding = {
    ...binding,
    artifactName: boundArtifact.replace(/\.json$/, ''),
    fixtureGroup: 'recognized',
    scenarioId: 'recognized-review-retake-continue',
    viewport: { height: 667, id: 'iphone-375x667', width: 375 },
  };
  writeFileSync(path.join(evidenceDir, boundArtifact), `${JSON.stringify({ evidenceBinding })}\n`);
  assert.equal(assertCat05ArtifactBindings(evidenceDir, [boundArtifact], binding), true);
  writeFileSync(
    path.join(evidenceDir, boundArtifact),
    `${JSON.stringify({ evidenceBinding: { ...evidenceBinding, runId: 'stale-run' } })}\n`,
  );
  assert.throws(
    () => assertCat05ArtifactBindings(evidenceDir, [boundArtifact], binding),
    /binding mismatch.*runId/,
  );
});

test('audit timeout awaits cleanup and losing-operation quiescence before rejecting', async () => {
  let cleanupCompleted = false;
  let operationSettled = false;
  const operation = new Promise((resolve) => {
    setTimeout(() => {
      operationSettled = true;
      resolve('late result that must never win');
    }, 30);
  });
  await assert.rejects(
    withAuditTimeout(operation, 10, 'contract audit', async () => {
      await Promise.resolve();
      cleanupCompleted = true;
    }),
    (error) =>
      error.code === 'CAT05_OPERATION_TIMEOUT' && /contract audit timed out/.test(error.message),
  );
  assert.equal(cleanupCompleted, true);
  assert.equal(operationSettled, true);
});

test('audit timeout stops tracked children and awaits the child-dependent operation', async (t) => {
  const child = trackCat05Child(
    spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
      stdio: 'ignore',
      windowsHide: true,
    }),
  );
  t.after(async () => {
    await stopActiveCat05Processes().catch(() => undefined);
  });
  const operation = new Promise((resolve) => {
    child.once('exit', () => {
      setTimeout(() => resolve('child-dependent operation settled'), 5);
    });
  });
  assert.equal(cat05ActiveChildCount(), 1);

  await assert.rejects(
    withAuditTimeout(operation, 20, 'tracked-child audit', stopActiveCat05Processes),
    (error) => error.code === 'CAT05_OPERATION_TIMEOUT',
  );
  assert.equal(cat05ActiveChildCount(), 0);
  assert.ok(child.exitCode !== null || child.signalCode !== null);
});

test('runner parses and the audit entry point is bounded', () => {
  execFileSync(process.execPath, ['--check', runnerPath], { stdio: 'pipe' });
  const entrySource = source.slice(
    source.indexOf('export async function runCat05NativeOcrUiAudit'),
  );
  assert.match(source, /CAT05_OPERATION_TIMEOUT/);
  assert.match(source, /20 \* 60_000/);
  assert.ok(
    entrySource.indexOf('clearPreviousEvidence(evidenceDir);') <
      entrySource.indexOf('resolveCat05AuditBinding({ environment })'),
    'Evidence must be cleared before candidate trust checks so a refused run cannot leave stale PASS.',
  );
  assert.match(source, /CAT05_ACTIVE_CHILDREN/);
  assert.match(source, /controller\.abort\(\)/);
  assert.match(source, /stopActiveCat05Processes\(\)/);
  assert.match(source, /assertCat05SourceBinding/g);
  assert.match(source, /groupBrowserAudits/);
  assert.match(source, /summary\.passedExecutionCount === summary\.expectedExecutionCount/);
  assert.match(source, /summary\.passedBootstrapCount === summary\.expectedBootstrapCount/);
  assert.match(source, /summary\.browserFailureCount === 0/);
  assert.match(source, /assertCat05PassArtifactSet\(summary\.artifacts\)/);
  assert.match(source, /assertCat05ArtifactBindings\(evidenceDir, summary\.artifacts, binding\)/);
  assert.match(source, /summary\.artifactManifest = buildCat05ArtifactManifest/);
  assert.match(source, /writeJson\(evidenceDir, 'summary\.json', summary\)/);
});
