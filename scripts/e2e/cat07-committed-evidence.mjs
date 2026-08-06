import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, parse, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

import {
  inspectCanonicalEvidenceJson,
  collectEvidenceTextArtifactHygieneFailures,
  readBoundedRegularFile,
  sanitizeEvidenceDiagnosticForDisplay,
} from './evidence-diagnostic-hygiene.mjs';
import { renderHumanE2eManifestMarkdown } from './human-e2e-manifest-render.mjs';

export const CAT07_COMMITTED_SUMMARY_PATH =
  'test-results/human-e2e/2026-08-06/cat07-shelf-freshness-current/summary.json';
export const CAT07_COMMITTED_MANIFEST_JSON_PATH = 'docs/e2e/generated/human-e2e-manifest.json';
export const CAT07_COMMITTED_MANIFEST_MD_PATH = 'docs/e2e/generated/human-e2e-manifest.md';
export const CAT07_COMMITTED_INPUT_PATHS = Object.freeze([
  CAT07_COMMITTED_SUMMARY_PATH,
  CAT07_COMMITTED_MANIFEST_JSON_PATH,
  CAT07_COMMITTED_MANIFEST_MD_PATH,
]);

const CAT07_GATE_ID = 'cat07-shelf-freshness-supported-phone';
const CAT07_GATE_TITLE = 'CAT07 Shelf freshness and replacement provenance lifecycle';
const CAT07_RUN_ID = /^cat07-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const FULL_GIT_SHA = /^[0-9a-f]{40}$/u;
const CAT07_MAX_COMMITTED_INPUT_BYTES = 8 * 1024 * 1024;
export const CAT07_FULL_VALIDATOR_TIMEOUT_MS = 120_000;
export const CAT07_FULL_VALIDATOR_MAX_BUFFER = 2 * 1024 * 1024;
const REQUIRED_VIEWPORTS = Object.freeze([
  Object.freeze({ id: 'iphone-375x667', width: 375, height: 667 }),
  Object.freeze({ id: 'iphone-390x844', width: 390, height: 844 }),
  Object.freeze({ id: 'iphone-430x932', width: 430, height: 932 }),
]);

function hasExactObjectKeys(value, expectedKeys) {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

const CAT07_APP_ENVIRONMENT_COMMON_KEYS = [
  'BROWSER',
  'CI',
  'EXPO_NO_DOTENV',
  'EXPO_NO_TELEMETRY',
  'EXPO_OFFLINE',
  'EXPO_PUBLIC_APP_ENV',
  'EXPO_PUBLIC_E2E_APP_LOCK_ENABLED',
  'EXPO_PUBLIC_E2E_LOCAL_RESET',
  'EXPO_PUBLIC_E2E_SHELF_SCAN_BARCODE',
  'EXPO_PUBLIC_NATIVE_CAMERA_ENABLED',
  'EXPO_PUBLIC_NATIVE_OCR_ENABLED',
  'EXPO_PUBLIC_POSTHOG_KEY',
  'EXPO_PUBLIC_REVENUECAT_ANDROID_KEY',
  'EXPO_PUBLIC_REVENUECAT_IOS_KEY',
  'EXPO_PUBLIC_REVENUECAT_TEST_STORE_KEY',
  'EXPO_PUBLIC_SENTRY_DSN',
  'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'EXPO_PUBLIC_SUPABASE_URL',
  'FORCE_COLOR',
  'NODE_ENV',
  'NO_COLOR',
  'NO_PROXY',
];
const CAT07_APP_ENVIRONMENT_KEY_SETS = [
  [
    ...CAT07_APP_ENVIRONMENT_COMMON_KEYS,
    'APPDATA',
    'LOCALAPPDATA',
    'PATHEXT',
    'Path',
    'SystemRoot',
    'TEMP',
    'TMP',
    'USERPROFILE',
    'WINDIR',
  ].sort(),
  [...CAT07_APP_ENVIRONMENT_COMMON_KEYS, 'HOME', 'PATH', 'TEMP', 'TMP', 'TMPDIR'].sort(),
];

function cat07CommittedExpectedBrowserArguments() {
  return [
    '--headless',
    '--remote-debugging-port=0',
    '--user-data-dir=<fresh-profile>',
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

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function cat07CommittedGitBinding(filePath) {
  const before = lstatSync(filePath, { bigint: true });
  if (!before.isFile() || before.isSymbolicLink()) {
    throw new Error('CAT07 committed validator Git must be a canonical regular executable');
  }
  const canonical = realpathSync.native(filePath);
  if (
    process.platform === 'win32'
      ? canonical.toLowerCase() !== filePath.toLowerCase()
      : canonical !== filePath
  ) {
    throw new Error('CAT07 committed validator Git must not cross a reparse boundary');
  }
  const bytes = readBoundedRegularFile(filePath, { maxBytes: 256 * 1024 * 1024 });
  const after = lstatSync(filePath, { bigint: true });
  const identity = (stats) =>
    [stats.dev, stats.ino, stats.size, stats.mtimeNs, stats.ctimeNs].map(String).join(':');
  if (identity(before) !== identity(after)) {
    throw new Error('CAT07 committed validator Git changed while it was hashed');
  }
  return { bytes: bytes.length, filePath, identity: identity(after), sha256: sha256(bytes) };
}

function assertCat07CommittedGitStable(context) {
  if (!isDeepStrictEqual(cat07CommittedGitBinding(context.gitExecutable), context.gitBinding)) {
    throw new Error('CAT07 committed validator Git identity or bytes changed');
  }
}

function cat07CommittedToolContext(root) {
  const resolvedRoot = resolve(root);
  let gitCandidates;
  let systemRoot = null;
  if (process.platform === 'win32') {
    const driveRoot = parse(resolve(process.execPath)).root;
    systemRoot = join(driveRoot, 'Windows');
    gitCandidates = [
      join(driveRoot, 'Program Files', 'Git', 'cmd', 'git.exe'),
      join(driveRoot, 'Program Files', 'Git', 'bin', 'git.exe'),
      join(driveRoot, 'Program Files (x86)', 'Git', 'cmd', 'git.exe'),
    ];
  } else {
    gitCandidates = [
      '/usr/bin/git',
      '/usr/local/bin/git',
      '/opt/homebrew/bin/git',
      '/opt/local/bin/git',
    ];
  }
  const gitExecutable = gitCandidates
    .map((candidate) => resolve(candidate))
    .find((candidate) => {
      const stats = lstatSync(candidate, { throwIfNoEntry: false });
      if (!stats?.isFile() || stats.isSymbolicLink()) return false;
      const canonical = realpathSync.native(candidate);
      return process.platform === 'win32'
        ? canonical.toLowerCase() === candidate.toLowerCase()
        : canonical === candidate;
    });
  if (!gitExecutable) throw new Error('CAT07 committed validator could not locate Git');
  const environment = {
    GIT_ATTR_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null',
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_OPTIONAL_LOCKS: '0',
    GIT_TERMINAL_PROMPT: '0',
    HOME: resolvedRoot,
    LC_ALL: 'C',
    TEMP: resolve(tmpdir()),
    TMP: resolve(tmpdir()),
  };
  if (process.platform === 'win32') {
    Object.assign(environment, {
      APPDATA: resolvedRoot,
      LOCALAPPDATA: resolvedRoot,
      PATHEXT: '.COM;.EXE;.BAT;.CMD',
      Path: [dirname(process.execPath), dirname(gitExecutable), join(systemRoot, 'System32')].join(
        delimiter,
      ),
      SystemRoot: systemRoot,
      USERPROFILE: resolvedRoot,
      WINDIR: systemRoot,
    });
  } else {
    environment.PATH = [dirname(process.execPath), dirname(gitExecutable), '/usr/bin', '/bin'].join(
      delimiter,
    );
    environment.TMPDIR = resolve(tmpdir());
  }
  return { environment, gitBinding: cat07CommittedGitBinding(gitExecutable), gitExecutable };
}

function readHeadSha(root, context = cat07CommittedToolContext(root)) {
  assertCat07CommittedGitStable(context);
  const sha = execFileSync(
    context.gitExecutable,
    ['-c', `safe.directory=${resolve(root)}`, 'rev-parse', 'HEAD'],
    {
      cwd: root,
      encoding: 'utf8',
      env: context.environment,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      timeout: 30_000,
      maxBuffer: 256 * 1024,
    },
  ).trim();
  assertCat07CommittedGitStable(context);
  if (!FULL_GIT_SHA.test(sha)) throw new Error('HEAD is not a full lowercase Git SHA');
  return sha;
}

function headBytes(root, repoPath, headSha, context = cat07CommittedToolContext(root)) {
  assertCat07CommittedGitStable(context);
  const bytes = execFileSync(
    context.gitExecutable,
    ['-c', `safe.directory=${resolve(root)}`, 'show', `${headSha}:${repoPath}`],
    {
      cwd: root,
      encoding: 'buffer',
      env: context.environment,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      timeout: 30_000,
      maxBuffer: CAT07_MAX_COMMITTED_INPUT_BYTES,
    },
  );
  assertCat07CommittedGitStable(context);
  return bytes;
}

function commitIsAncestor(root, sha, headSha, context = cat07CommittedToolContext(root)) {
  if (!FULL_GIT_SHA.test(sha)) return false;
  assertCat07CommittedGitStable(context);
  try {
    const safeDirectoryArgs = ['-c', `safe.directory=${resolve(root)}`];
    execFileSync(
      context.gitExecutable,
      [...safeDirectoryArgs, 'cat-file', '-e', `${sha}^{commit}`],
      {
        cwd: root,
        env: context.environment,
        stdio: 'ignore',
        windowsHide: true,
        timeout: 30_000,
      },
    );
    execFileSync(
      context.gitExecutable,
      [...safeDirectoryArgs, 'merge-base', '--is-ancestor', sha, headSha],
      {
        cwd: root,
        env: context.environment,
        stdio: 'ignore',
        windowsHide: true,
        timeout: 30_000,
      },
    );
    assertCat07CommittedGitStable(context);
    return true;
  } catch {
    try {
      assertCat07CommittedGitStable(context);
    } catch (stabilityError) {
      throw stabilityError;
    }
    return false;
  }
}

function parseCommittedJson(bytes, repoPath, errors) {
  const inspection = inspectCanonicalEvidenceJson(`${repoPath} in HEAD`, bytes, {
    allowLocalhostUrlQuery: true,
  });
  errors.push(...inspection.failures);
  return inspection.value;
}

function validInterval(value) {
  const startedAt = Date.parse(String(value?.startedAt ?? ''));
  const completedAt = Date.parse(String(value?.completedAt ?? ''));
  return Number.isFinite(startedAt) && Number.isFinite(completedAt) && completedAt >= startedAt
    ? { completedAt, startedAt }
    : null;
}

function collectSummaryFailures(summary, root, headSha, context) {
  const errors = [];
  if (summary?.schemaVersion !== 2) errors.push('committed CAT07 summary schemaVersion must be 2');
  if (summary?.verdict !== 'pass') errors.push('committed CAT07 summary verdict must be pass');
  if (summary?.surface !== 'expo-web' || summary?.nativeDeviceProof !== false) {
    errors.push('committed CAT07 summary must retain expo-web and nativeDeviceProof false');
  }
  if (!CAT07_RUN_ID.test(String(summary?.runId ?? ''))) {
    errors.push('committed CAT07 summary runId is missing or malformed');
  }
  if (!FULL_GIT_SHA.test(String(summary?.sourceGitSha ?? ''))) {
    errors.push('committed CAT07 summary sourceGitSha must be a full lowercase SHA');
  } else if (!commitIsAncestor(root, summary.sourceGitSha, headSha, context)) {
    errors.push('committed CAT07 summary sourceGitSha must be an ancestor of HEAD');
  }
  if (!isDeepStrictEqual(summary?.requiredViewports, REQUIRED_VIEWPORTS)) {
    errors.push('committed CAT07 summary requiredViewports do not match the reviewed matrix');
  }
  if (summary?.expectedBootstrapCount !== 3 || summary?.expectedExecutionCount !== 3) {
    errors.push('committed CAT07 summary must require exactly three bootstraps and scenarios');
  }
  if (!Array.isArray(summary?.artifacts) || summary.artifacts.length !== 99) {
    errors.push('committed CAT07 summary must declare exactly 99 artifacts');
  }
  if (!Array.isArray(summary?.screenshots) || summary.screenshots.length !== 45) {
    errors.push('committed CAT07 summary must declare exactly 45 screenshots');
  }
  const runtime = summary?.runtimeProvenance;
  if (
    !hasExactObjectKeys(runtime, [
      'browserLaunch',
      'childEnvironment',
      'environmentBootstrap',
      'installMode',
      'packageLock',
      'runtimeTree',
      'schemaVersion',
      'sourceTree',
      'tools',
    ]) ||
    runtime?.schemaVersion !== 1 ||
    runtime?.installMode !== 'isolated-npm-ci-offline-ignore-scripts-then-repo-postinstall'
  ) {
    errors.push('committed CAT07 runtimeProvenance does not use the reviewed offline schema');
  } else {
    if (
      !hasExactObjectKeys(runtime.browserLaunch, ['args', 'schemaVersion']) ||
      runtime.browserLaunch.schemaVersion !== 1 ||
      !isDeepStrictEqual(runtime.browserLaunch.args, cat07CommittedExpectedBrowserArguments())
    ) {
      errors.push('committed CAT07 browser launch posture is invalid');
    }
    if (
      !hasExactObjectKeys(runtime.environmentBootstrap, ['bytes', 'schemaVersion', 'sha256']) ||
      runtime.environmentBootstrap.schemaVersion !== 1 ||
      !Number.isSafeInteger(runtime.environmentBootstrap.bytes) ||
      runtime.environmentBootstrap.bytes <= 0 ||
      !/^[0-9a-f]{64}$/u.test(String(runtime.environmentBootstrap.sha256 ?? ''))
    ) {
      errors.push('committed CAT07 environment bootstrap binding is invalid');
    }
    if (
      !hasExactObjectKeys(runtime.childEnvironment, ['keys', 'schemaVersion']) ||
      runtime.childEnvironment.schemaVersion !== 1 ||
      !CAT07_APP_ENVIRONMENT_KEY_SETS.some((keys) =>
        isDeepStrictEqual(runtime.childEnvironment.keys, keys),
      )
    ) {
      errors.push('committed CAT07 runtime child environment is not the exact allowlist');
    }
    if (
      !hasExactObjectKeys(runtime.packageLock, ['bytes', 'sha256']) ||
      !Number.isSafeInteger(runtime.packageLock.bytes) ||
      runtime.packageLock.bytes <= 0 ||
      !/^[0-9a-f]{64}$/u.test(String(runtime.packageLock.sha256 ?? ''))
    ) {
      errors.push('committed CAT07 runtime package-lock binding is invalid');
    } else if (FULL_GIT_SHA.test(String(summary?.sourceGitSha ?? ''))) {
      try {
        const packageLock = headBytes(root, 'package-lock.json', summary.sourceGitSha, context);
        if (
          runtime.packageLock.bytes !== packageLock.length ||
          runtime.packageLock.sha256 !== sha256(packageLock)
        ) {
          errors.push('committed CAT07 runtime package-lock does not match sourceGitSha');
        }
      } catch {
        errors.push('committed CAT07 source package-lock could not be inspected');
      }
    }
    for (const [name, tree, expectedKeys] of [
      ['source', runtime.sourceTree, ['bytes', 'entryCount', 'fileCount', 'sha256']],
      [
        'installed runtime',
        runtime.runtimeTree,
        [
          'bytes',
          'directoryCount',
          'entryCount',
          'fileCount',
          'linkCount',
          'rootCount',
          'roots',
          'sha256',
        ],
      ],
    ]) {
      if (
        !hasExactObjectKeys(tree, expectedKeys) ||
        !Number.isSafeInteger(tree?.bytes) ||
        tree.bytes <= 0 ||
        !Number.isSafeInteger(tree?.entryCount) ||
        tree.entryCount <= 0 ||
        !Number.isSafeInteger(tree?.fileCount) ||
        tree.fileCount <= 0 ||
        !/^[0-9a-f]{64}$/u.test(String(tree?.sha256 ?? ''))
      ) {
        errors.push(`committed CAT07 ${name} tree binding is invalid`);
      }
    }
    if (runtime.sourceTree?.fileCount !== runtime.sourceTree?.entryCount) {
      errors.push('committed CAT07 source tree counts are inconsistent');
    }
    if (
      runtime.runtimeTree?.entryCount !==
      runtime.runtimeTree?.directoryCount +
        runtime.runtimeTree?.fileCount +
        runtime.runtimeTree?.linkCount
    ) {
      errors.push('committed CAT07 installed runtime tree counts are inconsistent');
    }
    if (
      !Number.isSafeInteger(runtime.runtimeTree?.rootCount) ||
      runtime.runtimeTree.rootCount <= 0 ||
      !Array.isArray(runtime.runtimeTree?.roots) ||
      runtime.runtimeTree.roots.length !== runtime.runtimeTree.rootCount
    ) {
      errors.push('committed CAT07 runtime root inventory is invalid');
    }
    if (!hasExactObjectKeys(runtime.tools, ['browser', 'expoCli', 'git', 'node', 'npmCli'])) {
      errors.push('committed CAT07 runtime tool binding is incomplete');
    } else {
      for (const record of Object.values(runtime.tools)) {
        if (
          !hasExactObjectKeys(record, ['basename', 'bytes', 'sha256', 'version']) ||
          typeof record.basename !== 'string' ||
          record.basename.length === 0 ||
          !Number.isSafeInteger(record.bytes) ||
          record.bytes <= 0 ||
          !/^[0-9a-f]{64}$/u.test(String(record.sha256 ?? '')) ||
          typeof record.version !== 'string' ||
          record.version.length === 0 ||
          record.version === 'version-not-recorded'
        ) {
          errors.push('committed CAT07 runtime tool binding is invalid');
          break;
        }
      }
    }
  }

  const summaryInterval = validInterval(summary);
  if (!summaryInterval) errors.push('committed CAT07 summary timestamps are invalid');
  const bootstraps = Array.isArray(summary?.bootstrapResults) ? summary.bootstrapResults : [];
  const scenarios = Array.isArray(summary?.scenarios) ? summary.scenarios : [];
  if (bootstraps.length !== 3 || scenarios.length !== 3) {
    errors.push('committed CAT07 summary must contain exactly three bootstraps and scenarios');
    return errors;
  }

  let previousCompletedAt = summaryInterval?.startedAt ?? Number.NEGATIVE_INFINITY;
  for (let index = 0; index < REQUIRED_VIEWPORTS.length; index += 1) {
    for (const [kind, result] of [
      ['bootstrap', bootstraps[index]],
      ['scenario', scenarios[index]],
    ]) {
      const expectedViewport = REQUIRED_VIEWPORTS[index];
      if (!isDeepStrictEqual(result?.viewport, expectedViewport)) {
        errors.push(`committed CAT07 ${kind} ${index + 1} has the wrong viewport/order`);
      }
      if (
        result?.runId !== summary.runId ||
        result?.verdict !== 'pass' ||
        result?.error != null ||
        result?.surface !== 'expo-web' ||
        result?.nativeDeviceProof !== false ||
        !Array.isArray(result?.browserFailures) ||
        result.browserFailures.length !== 0
      ) {
        errors.push(`committed CAT07 ${kind} ${expectedViewport.id} is not a clean bound pass`);
      }
      const interval = validInterval(result);
      if (
        !interval ||
        interval.startedAt < previousCompletedAt ||
        (summaryInterval && interval.completedAt > summaryInterval.completedAt)
      ) {
        errors.push(`committed CAT07 ${kind} ${expectedViewport.id} has an invalid run interval`);
      } else {
        previousCompletedAt = interval.completedAt;
      }
    }
  }
  return errors;
}

function collectManifestFailures(manifest, summarySha256, root, headSha, context) {
  const errors = [];
  if (manifest?.status !== 'pass') errors.push('committed human-E2E manifest status must be pass');
  if (!commitIsAncestor(root, String(manifest?.gitSha ?? ''), headSha, context)) {
    errors.push('committed human-E2E manifest gitSha must be an ancestor of HEAD');
  }
  const matches = Array.isArray(manifest?.gateResults)
    ? manifest.gateResults.filter((gate) => gate?.id === CAT07_GATE_ID)
    : [];
  if (matches.length !== 1) {
    errors.push(`committed human-E2E manifest must contain exactly one ${CAT07_GATE_ID} gate`);
    return errors;
  }
  const gate = matches[0];
  const exact = {
    evidence: 'summary.json',
    failureCount: 0,
    folder: CAT07_COMMITTED_SUMMARY_PATH.replace(/\/summary\.json$/u, ''),
    kind: 'cat07-shelf-freshness',
    required: true,
    status: 'pass',
    supportClass: 'supported-phone',
    title: CAT07_GATE_TITLE,
    verdict: 'pass',
  };
  for (const [field, expected] of Object.entries(exact)) {
    if (gate?.[field] !== expected) {
      errors.push(`committed CAT07 manifest gate ${field} does not match the reviewed pass`);
    }
  }
  if (
    gate?.folderExists !== true ||
    gate?.evidenceExists !== true ||
    gate?.evidenceTracked !== true ||
    !Array.isArray(gate?.requirementFailures) ||
    gate.requirementFailures.length !== 0
  ) {
    errors.push(
      'committed CAT07 manifest gate does not prove present, tracked, failure-free evidence',
    );
  }
  if (gate?.evidenceSha256 !== summarySha256) {
    errors.push('committed CAT07 manifest gate summary hash does not match HEAD');
  }
  return errors;
}

export function validateCat07CommittedEvidence(
  root = process.cwd(),
  { expectedHeadSha = null } = {},
) {
  const resolvedRoot = resolve(root);
  const errors = [];
  const records = {};
  const committedBytes = new Map();
  let headSha;
  let context;
  try {
    context = cat07CommittedToolContext(resolvedRoot);
    headSha = readHeadSha(resolvedRoot, context);
    if (expectedHeadSha !== null && !FULL_GIT_SHA.test(expectedHeadSha)) {
      throw new Error('expected HEAD is not a full lowercase Git SHA');
    }
    if (expectedHeadSha !== null && headSha !== expectedHeadSha) {
      throw new Error('HEAD does not match the expected pinned CAT07 commit');
    }
  } catch {
    return {
      errors: ['CAT07 committed evidence cannot resolve one stable HEAD commit'],
      headSha: null,
      manifestSha256: null,
      markdownSha256: null,
      status: 'blocked',
      summarySha256: null,
    };
  }
  for (const repoPath of CAT07_COMMITTED_INPUT_PATHS) {
    let committed;
    try {
      committed = headBytes(resolvedRoot, repoPath, headSha, context);
    } catch {
      errors.push(`${repoPath} must exist in HEAD`);
      continue;
    }

    let working;
    try {
      working = readBoundedRegularFile(resolve(resolvedRoot, repoPath), {
        containmentRoot: resolvedRoot,
        maxBytes: CAT07_MAX_COMMITTED_INPUT_BYTES,
      });
    } catch {
      errors.push(`${repoPath} must exist in the working tree`);
      continue;
    }

    records[repoPath] = {
      bytes: committed.length,
      sha256: sha256(committed),
      workingTreeMatchesHead: committed.equals(working),
    };
    committedBytes.set(repoPath, committed);
    if (!committed.equals(working)) {
      errors.push(`${repoPath} working bytes do not match HEAD`);
    }
  }

  const summaryRecord = records[CAT07_COMMITTED_SUMMARY_PATH];
  const manifestRecord = records[CAT07_COMMITTED_MANIFEST_JSON_PATH];
  let summary = null;
  let manifest = null;
  if (summaryRecord) {
    summary = parseCommittedJson(
      committedBytes.get(CAT07_COMMITTED_SUMMARY_PATH),
      CAT07_COMMITTED_SUMMARY_PATH,
      errors,
    );
  }
  if (manifestRecord) {
    manifest = parseCommittedJson(
      committedBytes.get(CAT07_COMMITTED_MANIFEST_JSON_PATH),
      CAT07_COMMITTED_MANIFEST_JSON_PATH,
      errors,
    );
  }
  if (summary) errors.push(...collectSummaryFailures(summary, resolvedRoot, headSha, context));
  if (manifest && summaryRecord) {
    errors.push(
      ...collectManifestFailures(manifest, summaryRecord.sha256, resolvedRoot, headSha, context),
    );
  }
  const markdownBytes = committedBytes.get(CAT07_COMMITTED_MANIFEST_MD_PATH);
  if (manifest && markdownBytes) {
    errors.push(
      ...collectEvidenceTextArtifactHygieneFailures(
        `${CAT07_COMMITTED_MANIFEST_MD_PATH} in HEAD`,
        markdownBytes,
        { maxBytes: CAT07_MAX_COMMITTED_INPUT_BYTES },
      ),
    );
    const expectedMarkdownBytes = Buffer.from(renderHumanE2eManifestMarkdown(manifest), 'utf8');
    if (!expectedMarkdownBytes.equals(markdownBytes)) {
      errors.push(
        'committed human-E2E Markdown must exactly match the canonical rendering of its JSON',
      );
    }
  }

  try {
    if (readHeadSha(resolvedRoot, context) !== headSha) {
      errors.push('HEAD changed while CAT07 committed evidence was being validated');
    }
  } catch {
    errors.push('HEAD could not be rechecked after CAT07 committed evidence validation');
  }
  for (const [repoPath, committed] of committedBytes) {
    try {
      if (
        !committed.equals(
          readBoundedRegularFile(resolve(resolvedRoot, repoPath), {
            containmentRoot: resolvedRoot,
            maxBytes: CAT07_MAX_COMMITTED_INPUT_BYTES,
          }),
        )
      ) {
        errors.push(`${repoPath} working bytes changed during CAT07 committed evidence validation`);
      }
    } catch {
      errors.push(`${repoPath} could not be rechecked in the working tree`);
    }
  }

  return {
    errors: [...new Set(errors)],
    headSha,
    manifestSha256: manifestRecord?.sha256 ?? null,
    markdownSha256: records[CAT07_COMMITTED_MANIFEST_MD_PATH]?.sha256 ?? null,
    status: errors.length === 0 ? 'pass' : 'blocked',
    summarySha256: summaryRecord?.sha256 ?? null,
  };
}

export function validateCat07FullEvidenceContract(
  root = process.cwd(),
  { execute = execFileSync, expectedHeadSha = null } = {},
) {
  const resolvedRoot = resolve(root);
  let headSha = null;
  try {
    const context = cat07CommittedToolContext(resolvedRoot);
    headSha = readHeadSha(resolvedRoot, context);
    if (expectedHeadSha !== null && !FULL_GIT_SHA.test(expectedHeadSha)) {
      throw new Error('expected HEAD is not a full lowercase Git SHA');
    }
    if (expectedHeadSha !== null && headSha !== expectedHeadSha) {
      throw new Error('HEAD does not match the expected pinned CAT07 commit');
    }
    const output = execute(
      process.execPath,
      [
        resolve(resolvedRoot, 'scripts/e2e/human-e2e-manifest.mjs'),
        '--cat07-committed-check',
        `--expected-head-sha=${headSha}`,
      ],
      {
        cwd: resolvedRoot,
        encoding: 'utf8',
        env: context.environment,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
        timeout: CAT07_FULL_VALIDATOR_TIMEOUT_MS,
        maxBuffer: CAT07_FULL_VALIDATOR_MAX_BUFFER,
      },
    );
    if (String(output).trim() !== `PASS committed CAT07 full evidence contract ${headSha}`) {
      return {
        errors: ['full CAT07 manifest validator did not emit its reviewed PASS marker'],
        headSha,
        status: 'blocked',
      };
    }
    if (readHeadSha(resolvedRoot, context) !== headSha) {
      return {
        errors: ['HEAD changed while the full CAT07 evidence contract was being validated'],
        headSha,
        status: 'blocked',
      };
    }
    return { errors: [], headSha, status: 'pass' };
  } catch (error) {
    return {
      errors: [formatCat07FullEvidenceFailure(error)],
      headSha,
      status: 'blocked',
    };
  }
}

export function formatCat07FullEvidenceFailure(error) {
  const diagnostic = sanitizeEvidenceDiagnosticForDisplay(error?.stderr ?? '', {
    maxBytes: 2_000,
    maxLines: 20,
  });
  return diagnostic
    ? `full CAT07 manifest validator failed: ${diagnostic}`
    : 'full CAT07 manifest validator failed without diagnostics';
}
