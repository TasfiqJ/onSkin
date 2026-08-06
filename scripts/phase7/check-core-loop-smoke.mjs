#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CAT07_COMMITTED_MANIFEST_JSON_PATH,
  CAT07_COMMITTED_MANIFEST_MD_PATH,
  CAT07_COMMITTED_SUMMARY_PATH,
  validateCat07CommittedEvidence,
} from '../e2e/cat07-committed-evidence.mjs';
import {
  buildCat07ChildEnvironment,
  cat07BrowserArguments,
} from '../e2e/cat07-shelf-freshness-audit.mjs';
import { canonicalEvidenceJsonBytes } from '../e2e/evidence-diagnostic-hygiene.mjs';
import { renderHumanE2eManifestMarkdown } from '../e2e/human-e2e-manifest-render.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, '..', '..');
const checkPath = resolve(scriptDir, 'check-core-loop.mjs');
const packetPath = resolve(scriptDir, 'build-core-loop-qa-packet.mjs');
const humanE2eManifestPath = resolve(root, 'scripts/e2e/human-e2e-manifest.mjs');
const core07aContractPath = resolve(
  root,
  'scripts/core07/share-admission-source-contract.test.mjs',
);
const photo05aContractPath = resolve(
  root,
  'scripts/photo05/trend-admission-source-contract.test.mjs',
);
const com01aContractPath = resolve(
  root,
  'scripts/com01/commerce-admission-source-contract.test.mjs',
);
const cat07ShelfFreshnessSummaryPath = CAT07_COMMITTED_SUMMARY_PATH;

const passthroughKeys = [
  'ComSpec',
  'HOME',
  'Path',
  'PATH',
  'PATHEXT',
  'SystemRoot',
  'TEMP',
  'TMP',
  'USERPROFILE',
  'WINDIR',
];

const processBaseEnv = Object.fromEntries(
  passthroughKeys
    .map((key) => [key, process.env[key]])
    .filter(([, value]) => typeof value === 'string' && value.length > 0),
);

const validPublicIdentity = {
  EXPO_PUBLIC_FINAL_BRAND_DOMAIN: 'routinekind.app',
  EXPO_PUBLIC_PRIVACY_URL: 'https://routinekind.app/privacy',
  EXPO_PUBLIC_TERMS_URL: 'https://routinekind.app/terms',
  EXPO_PUBLIC_SUPPORT_URL: 'https://routinekind.app/support',
  EXPO_PUBLIC_ACCOUNT_DELETION_URL: 'https://routinekind.app/account-deletion',
  EXPO_PUBLIC_DATA_EXPORT_URL: 'https://routinekind.app/data-export',
  EXPO_PUBLIC_CONSUMER_HEALTH_PRIVACY_URL: 'https://routinekind.app/consumer-health-privacy',
};

const validEvidence = {
  PHASE7_BRAND_READY: ' TRUE ',
  PHASE7_SUPABASE_RLS_PASS: 'true',
  PHASE7_CLINICAL_REVIEW_PASS: 'True',
  PHASE7_CATALOG_BETA_IMPORT_PASS: ' true ',
  PHASE7_DEVICE_QA_PASS: 'TRUE',
  PHASE7_REVENUECAT_QA_PASS: 'true',
  PHASE7_PRIVACY_EXPORT_DELETE_PASS: ' True ',
  PHASE7_BETA_DASHBOARD_READY: 'true',
  PHASE7_ONBOARDING_CONSENT_QA_PASS: 'true',
  PHASE7_SHELF_INTAKE_QA_PASS: 'true',
  PHASE7_REVIEWED_GUIDANCE_QA_PASS: 'true',
  PHASE7_ROUTINE_BUILDER_QA_PASS: 'true',
  PHASE7_TODAY_CHECKOFF_QA_PASS: 'true',
  PHASE7_PHOTOS_PRIVACY_QA_PASS: 'true',
  PHASE7_REMINDERS_QA_PASS: 'true',
  PHASE7_PAYMENTS_LIFECYCLE_QA_PASS: 'true',
  PHASE7_PRIVACY_CONTROLS_QA_PASS: 'true',
  PHASE7_SHARE_CARD_QA_PASS: 'true',
  PHASE7_DEFERRED_SURFACES_QA_PASS: 'true',
  PHASE7_ANALYTICS_QA_PASS: 'true',
  PHASE7_SIGNED_OFF_BY: ' Tas Mohammed ',
};

function output(result) {
  return `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
}

function packetMatchesCat07HeadBinding(packet, repositoryRoot = root) {
  const expected = validateCat07CommittedEvidence(repositoryRoot);
  const resultMatches = JSON.stringify(packet.cat07CommittedEvidence) === JSON.stringify(expected);
  const exactHeadBinding =
    packet.cat07CommittedEvidence?.headSha === packet.gitSha &&
    packet.cat07FullEvidenceContract?.headSha === packet.gitSha;
  const blockersMatch = expected.errors.every((error) =>
    packet.blockers.includes(`CAT07 committed evidence: ${error}.`),
  );
  if (!resultMatches || !blockersMatch || !exactHeadBinding) {
    console.error(
      `CAT07 HEAD-binding mismatch: ${JSON.stringify({ blockersMatch, exactHeadBinding, expected, packet: packet.cat07CommittedEvidence })}`,
    );
  }
  return resultMatches && blockersMatch && exactHeadBinding;
}

function run(extraEnv, args = []) {
  return spawnSync(process.execPath, [checkPath, ...args], {
    cwd: root,
    encoding: 'utf8',
    env: { ...processBaseEnv, ...extraEnv },
  });
}

function runCore07aContract() {
  return spawnSync(process.execPath, ['--test', core07aContractPath], {
    cwd: root,
    encoding: 'utf8',
    env: processBaseEnv,
  });
}

function runPhoto05aContract() {
  return spawnSync(process.execPath, ['--test', photo05aContractPath], {
    cwd: root,
    encoding: 'utf8',
    env: processBaseEnv,
  });
}

function runCom01aContract() {
  return spawnSync(process.execPath, ['--test', com01aContractPath], {
    cwd: root,
    encoding: 'utf8',
    env: processBaseEnv,
  });
}

function runHumanE2eProvenanceSmoke() {
  return spawnSync(process.execPath, [humanE2eManifestPath, '--provenance-smoke'], {
    cwd: root,
    encoding: 'utf8',
    env: processBaseEnv,
  });
}

function runHumanE2eCat07ContractSmoke() {
  return spawnSync(process.execPath, [humanE2eManifestPath, '--cat07-contract-smoke'], {
    cwd: root,
    encoding: 'utf8',
    env: processBaseEnv,
  });
}

function runHumanE2eGovernedChainSmoke() {
  return spawnSync(process.execPath, [humanE2eManifestPath, '--governed-chain-smoke'], {
    cwd: root,
    encoding: 'utf8',
    env: processBaseEnv,
  });
}

let packetFixtureCounter = 0;
let packetFixtureRepositoryParent = null;
let packetFixtureRepositoryRoot = null;

function gitFixtureBuffer(cwd, args) {
  const result = spawnSync('git', args, {
    cwd,
    env: processBaseEnv,
  });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${output(result)}`);
  }
  return Buffer.from(result.stdout ?? Buffer.alloc(0));
}

function parseNulTerminatedPaths(bytes, label) {
  if (bytes.length === 0) return [];
  if (bytes.at(-1) !== 0) throw new Error(`${label} is not NUL terminated`);
  return bytes.subarray(0, -1).toString('utf8').split('\0');
}

function packetSmokeRepositoryRoot() {
  if (packetFixtureRepositoryRoot) return packetFixtureRepositoryRoot;
  packetFixtureRepositoryParent = mkdtempSync(join(tmpdir(), 'routinekind-phase7-packet-smoke-'));
  packetFixtureRepositoryRoot = resolve(packetFixtureRepositoryParent, 'repo');
  gitFixture(packetFixtureRepositoryParent, [
    'clone',
    '--quiet',
    '--shared',
    root,
    packetFixtureRepositoryRoot,
  ]);
  gitFixture(packetFixtureRepositoryRoot, ['config', 'user.email', 'phase7-smoke@example.invalid']);
  gitFixture(packetFixtureRepositoryRoot, ['config', 'user.name', 'Phase 7 Smoke']);

  const changedPaths = [
    ...new Set([
      ...parseNulTerminatedPaths(
        gitFixtureBuffer(root, ['diff', '--name-only', '-z', 'HEAD']),
        'tracked Phase 7 packet-smoke path inventory',
      ),
      ...parseNulTerminatedPaths(
        gitFixtureBuffer(root, ['ls-files', '--others', '--exclude-standard', '-z']),
        'untracked Phase 7 packet-smoke path inventory',
      ),
    ]),
  ];
  const excludedPaths = new Set([
    'deno.lock',
    'docs/phase-9/generated/dependency-inventory.json',
    'docs/phase-9/generated/dependency-inventory.md',
  ]);
  for (const repoPath of changedPaths) {
    if (excludedPaths.has(repoPath)) continue;
    const sourcePath = resolve(root, ...repoPath.split('/'));
    const fixturePath = resolve(packetFixtureRepositoryRoot, ...repoPath.split('/'));
    if (!existsSync(sourcePath)) {
      rmSync(fixturePath, { force: true, recursive: true });
      continue;
    }
    const sourceStats = lstatSync(sourcePath);
    if (!sourceStats.isFile() || sourceStats.isSymbolicLink()) {
      throw new Error(`Phase 7 packet-smoke source path is not a regular file: ${repoPath}`);
    }
    mkdirSync(dirname(fixturePath), { recursive: true });
    writeFileSync(fixturePath, readFileSync(sourcePath));
  }
  gitFixture(packetFixtureRepositoryRoot, ['add', '-A']);
  gitFixture(packetFixtureRepositoryRoot, [
    '-c',
    'commit.gpgsign=false',
    'commit',
    '--quiet',
    '-m',
    'current Phase 7 packet smoke source',
  ]);
  return packetFixtureRepositoryRoot;
}

process.on('exit', () => {
  if (packetFixtureRepositoryParent) {
    rmSync(packetFixtureRepositoryParent, { force: true, recursive: true });
  }
});

function runPacket(extraEnv, args = []) {
  const repositoryRoot = packetSmokeRepositoryRoot();
  packetFixtureCounter += 1;
  const fixtureId = `phase7-${process.pid}-${packetFixtureCounter}`;
  const outDirRelative = `.tmp/phase7-packet-fixtures/${fixtureId}`;
  const outDir = resolve(repositoryRoot, ...outDirRelative.split('/'));
  try {
    const result = spawnSync(process.execPath, [packetPath, ...args, '--test-fixture-output'], {
      cwd: repositoryRoot,
      encoding: 'utf8',
      env: {
        ...processBaseEnv,
        ...extraEnv,
        NODE_ENV: 'test',
        PHASE7_PACKET_OUT_DIR: outDirRelative,
      },
    });
    const packetJsonPath = resolve(outDir, 'core-loop-qa-packet.json');
    const packet = existsSync(packetJsonPath)
      ? JSON.parse(readFileSync(packetJsonPath, 'utf8'))
      : null;
    return { ...result, packet };
  } finally {
    rmSync(outDir, { force: true, recursive: true });
  }
}

function runRejectedPacketOutput(outDir, args = [], extraEnv = {}) {
  return spawnSync(process.execPath, [packetPath, ...args], {
    cwd: root,
    encoding: 'utf8',
    env: { ...processBaseEnv, ...extraEnv, PHASE7_PACKET_OUT_DIR: outDir },
  });
}

function runPacketWithDirtyWorktree(extraEnv, args = []) {
  const markerPath = join(packetSmokeRepositoryRoot(), `.phase7-smoke-dirty-${process.pid}.tmp`);
  writeFileSync(markerPath, 'temporary Phase 7 dirty-worktree smoke marker\n');
  try {
    return runPacket(extraEnv, args);
  } finally {
    rmSync(markerPath, { force: true });
  }
}

function runPacketWithDirtyUpstreamEvidence(extraEnv) {
  const upstreamGeneratedEvidencePath = resolve(
    packetSmokeRepositoryRoot(),
    'docs/e2e/generated/human-e2e-manifest.json',
  );
  const original = readFileSync(upstreamGeneratedEvidencePath);
  writeFileSync(
    upstreamGeneratedEvidencePath,
    Buffer.concat([
      original,
      Buffer.from(`\nphase7-upstream-evidence-dirty-smoke-${process.pid}\n`, 'utf8'),
    ]),
  );
  try {
    return runPacket(extraEnv);
  } finally {
    writeFileSync(upstreamGeneratedEvidencePath, original);
  }
}

function gitFixture(cwd, args) {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: processBaseEnv,
  });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${output(result)}`);
  }
  return String(result.stdout ?? '').trim();
}

function runCommittedCat07BindingSmoke() {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'routinekind-phase7-cat07-binding-'));
  try {
    gitFixture(fixtureRoot, ['init', '--quiet']);
    gitFixture(fixtureRoot, ['config', 'user.email', 'phase7-smoke@example.invalid']);
    gitFixture(fixtureRoot, ['config', 'user.name', 'Phase 7 Smoke']);
    writeFileSync(resolve(fixtureRoot, 'source.txt'), 'CAT07 source fixture\n');
    const packageLockBytes = Buffer.from(
      '{"name":"cat07-fixture","lockfileVersion":3,"packages":{}}\n',
      'utf8',
    );
    writeFileSync(resolve(fixtureRoot, 'package-lock.json'), packageLockBytes);
    gitFixture(fixtureRoot, ['add', '-A']);
    gitFixture(fixtureRoot, ['commit', '--quiet', '-m', 'CAT07 source fixture']);
    const sourceGitSha = gitFixture(fixtureRoot, ['rev-parse', 'HEAD']);
    const runId = 'cat07-11111111-1111-4111-8111-111111111111';
    const viewports = [
      { id: 'iphone-375x667', width: 375, height: 667 },
      { id: 'iphone-390x844', width: 390, height: 844 },
      { id: 'iphone-430x932', width: 430, height: 932 },
    ];
    const atSecond = (seconds) =>
      new Date(Date.parse('2026-08-06T00:00:00.000Z') + seconds * 1_000).toISOString();
    const summary = {
      artifacts: Array.from({ length: 99 }, (_, index) => `artifact-${index}`),
      bootstrapResults: viewports.map((viewport, index) => ({
        browserFailures: [],
        completedAt: atSecond(index * 20 + 5),
        error: null,
        nativeDeviceProof: false,
        runId,
        startedAt: atSecond(index * 20 + 1),
        surface: 'expo-web',
        verdict: 'pass',
        viewport,
      })),
      completedAt: atSecond(65),
      expectedBootstrapCount: 3,
      expectedExecutionCount: 3,
      nativeDeviceProof: false,
      requiredViewports: viewports,
      runId,
      scenarios: viewports.map((viewport, index) => ({
        browserFailures: [],
        completedAt: atSecond(index * 20 + 19),
        error: null,
        nativeDeviceProof: false,
        runId,
        startedAt: atSecond(index * 20 + 6),
        surface: 'expo-web',
        verdict: 'pass',
        viewport,
      })),
      schemaVersion: 2,
      screenshots: Array.from({ length: 45 }, (_, index) => `screenshot-${index}.png`),
      sourceGitSha,
      startedAt: atSecond(0),
      surface: 'expo-web',
      verdict: 'pass',
    };
    const runtimePaths = Object.fromEntries(
      ['appData', 'cache', 'home', 'npmGlobalConfig', 'npmUserConfig', 'temp'].map((name) => [
        name,
        resolve(fixtureRoot, '.tmp', name),
      ]),
    );
    const childEnvironmentKeys = Object.keys(
      buildCat07ChildEnvironment({
        hostEnvironment: process.env,
        platform: process.platform,
        runtimePaths,
      }),
    ).sort();
    summary.runtimeProvenance = {
      browserLaunch: {
        args: cat07BrowserArguments({ userDataDir: '<fresh-profile>' }),
        schemaVersion: 1,
      },
      childEnvironment: { keys: childEnvironmentKeys, schemaVersion: 1 },
      environmentBootstrap: { bytes: 1, schemaVersion: 1, sha256: '1'.repeat(64) },
      installMode: 'isolated-npm-ci-offline-ignore-scripts-then-repo-postinstall',
      packageLock: {
        bytes: packageLockBytes.length,
        sha256: createHash('sha256').update(packageLockBytes).digest('hex'),
      },
      runtimeTree: {
        bytes: 1,
        directoryCount: 1,
        entryCount: 2,
        fileCount: 1,
        linkCount: 0,
        rootCount: 1,
        roots: [
          {
            bytes: 1,
            directoryCount: 1,
            entryCount: 2,
            fileCount: 1,
            linkCount: 0,
            path: 'node_modules',
            sha256: '2'.repeat(64),
          },
        ],
        sha256: '3'.repeat(64),
      },
      schemaVersion: 1,
      sourceTree: { bytes: 1, entryCount: 1, fileCount: 1, sha256: '4'.repeat(64) },
      tools: Object.fromEntries(
        ['browser', 'expoCli', 'git', 'node', 'npmCli'].map((name, index) => [
          name,
          {
            basename: `${name}.fixture`,
            bytes: index + 1,
            sha256: String(index + 5).repeat(64),
            version: 'fixture-version',
          },
        ]),
      ),
    };
    const summaryPath = resolve(fixtureRoot, CAT07_COMMITTED_SUMMARY_PATH);
    const manifestPath = resolve(fixtureRoot, CAT07_COMMITTED_MANIFEST_JSON_PATH);
    const markdownPath = resolve(fixtureRoot, CAT07_COMMITTED_MANIFEST_MD_PATH);
    mkdirSync(dirname(summaryPath), { recursive: true });
    mkdirSync(dirname(manifestPath), { recursive: true });
    const writeBinding = (candidate) => {
      const summaryBytes = canonicalEvidenceJsonBytes(candidate);
      writeFileSync(summaryPath, summaryBytes);
      const manifest = {
        baselineEvidenceDate: '2026-08-06',
        blockers: [],
        evidenceDate: '2026-08-06',
        gateResults: [
          {
            detail: 'Synthetic committed CAT07 binding fixture.',
            evidence: 'summary.json',
            evidenceExists: true,
            evidenceSha256: createHash('sha256').update(summaryBytes).digest('hex'),
            evidenceTracked: true,
            failureCount: 0,
            fileCount: 100,
            folder: CAT07_COMMITTED_SUMMARY_PATH.replace(/\/summary\.json$/u, ''),
            folderExists: true,
            id: 'cat07-shelf-freshness-supported-phone',
            kind: 'cat07-shelf-freshness',
            required: true,
            requirementFailures: [],
            status: 'pass',
            supportClass: 'supported-phone',
            title: 'CAT07 Shelf freshness and replacement provenance lifecycle',
            verdict: 'pass',
          },
        ],
        generatedAt: '2026-08-06T00:02:00.000Z',
        gitSha: sourceGitSha,
        purpose: 'Synthetic CAT07 committed binding fixture.',
        status: 'pass',
        warnings: [],
      };
      writeFileSync(manifestPath, canonicalEvidenceJsonBytes(manifest));
      writeFileSync(markdownPath, renderHumanE2eManifestMarkdown(manifest));
    };
    writeBinding(summary);
    gitFixture(fixtureRoot, ['add', '-A']);
    gitFixture(fixtureRoot, ['commit', '--quiet', '-m', 'Valid CAT07 binding fixture']);
    const valid = validateCat07CommittedEvidence(fixtureRoot);
    if (valid.status !== 'pass' || valid.errors.length !== 0) {
      throw new Error(`valid committed CAT07 fixture failed: ${valid.errors.join('; ')}`);
    }
    const boundHeadSha = gitFixture(fixtureRoot, ['rev-parse', 'HEAD']);
    if (valid.headSha !== boundHeadSha) {
      throw new Error('valid committed CAT07 fixture did not report its exact HEAD binding');
    }
    const wrongHead = validateCat07CommittedEvidence(fixtureRoot, {
      expectedHeadSha: sourceGitSha,
    });
    if (wrongHead.status !== 'blocked') {
      throw new Error('committed CAT07 fixture accepted a stale expected HEAD');
    }

    writeFileSync(markdownPath, '# Stale CAT07 fixture\nCookie: session_id=must-not-pass\n');
    gitFixture(fixtureRoot, ['add', '-A']);
    gitFixture(fixtureRoot, ['commit', '--quiet', '-m', 'Stale CAT07 Markdown fixture']);
    const staleMarkdown = validateCat07CommittedEvidence(fixtureRoot);
    if (
      !staleMarkdown.errors.some(
        (error) =>
          error.includes('canonical rendering') || error.includes('cookie or session value'),
      )
    ) {
      throw new Error('arbitrary committed CAT07 Markdown was accepted');
    }
    writeBinding(summary);
    gitFixture(fixtureRoot, ['add', '-A']);
    gitFixture(fixtureRoot, ['commit', '--quiet', '-m', 'Restore CAT07 Markdown binding']);
    const restored = validateCat07CommittedEvidence(fixtureRoot);
    if (restored.status !== 'pass') {
      throw new Error(`restored CAT07 fixture failed: ${restored.errors.join('; ')}`);
    }

    writeFileSync(summaryPath, canonicalEvidenceJsonBytes({ ...summary, verdict: 'fail' }));
    const mismatch = validateCat07CommittedEvidence(fixtureRoot);
    if (!mismatch.errors.some((error) => error.includes('working bytes do not match HEAD'))) {
      throw new Error('CAT07 working/HEAD byte mismatch was accepted');
    }

    writeBinding({ ...summary, verdict: 'fail' });
    gitFixture(fixtureRoot, ['add', '-A']);
    gitFixture(fixtureRoot, ['commit', '--quiet', '-m', 'Malformed CAT07 binding fixture']);
    const malformed = validateCat07CommittedEvidence(fixtureRoot);
    if (!malformed.errors.includes('committed CAT07 summary verdict must be pass')) {
      throw new Error('malformed committed CAT07 summary was accepted');
    }
    return { status: 0, stderr: '', stdout: 'PASS committed CAT07 binding smoke' };
  } catch (error) {
    return {
      status: 1,
      stderr: error instanceof Error ? (error.stack ?? error.message) : String(error),
      stdout: '',
    };
  } finally {
    rmSync(fixtureRoot, { force: true, recursive: true });
  }
}

const cases = [
  {
    name: 'COM-01A commerce admission remains literal-closed and side-effect free',
    result: runCom01aContract(),
    expect(result) {
      return result.status === 0;
    },
  },
  {
    name: 'PHOTO-05A Trend admission remains literal-closed and side-effect free',
    result: runPhoto05aContract(),
    expect(result) {
      return result.status === 0;
    },
  },
  {
    name: 'CORE-07A share admission remains literal-closed and side-effect free',
    result: runCore07aContract(),
    expect(result) {
      return result.status === 0;
    },
  },
  {
    name: 'Phase 7 packet rejects caller-selected normal output directories',
    result: runRejectedPacketOutput('docs/phase-7/caller-selected'),
    expect(result) {
      return (
        result.status !== 0 &&
        /PHASE7_PACKET_OUT_DIR is reserved for an explicit repo-local Phase 7 test fixture/.test(
          output(result),
        )
      );
    },
  },
  {
    name: 'Phase 7 packet rejects traversal even in explicit test-fixture mode',
    result: runRejectedPacketOutput('../outside-phase7', ['--test-fixture-output'], {
      NODE_ENV: 'test',
    }),
    expect(result) {
      return (
        result.status !== 0 &&
        /PHASE7_PACKET_OUT_DIR is reserved for an explicit repo-local Phase 7 test fixture/.test(
          output(result),
        )
      );
    },
  },
  {
    name: 'Committed CAT07 binding rejects working-tree drift and malformed HEAD semantics',
    result: runCommittedCat07BindingSmoke(),
    expect(result) {
      return result.status === 0 && /PASS committed CAT07 binding smoke/.test(output(result));
    },
  },
  {
    name: 'Human-E2E provenance rejects missing, untracked, incomplete, and unsafe artifacts',
    result: runHumanE2eProvenanceSmoke(),
    expect(result) {
      return result.status === 0 && /PASS Human-E2E evidence provenance smoke/.test(output(result));
    },
  },
  {
    name: 'Human-E2E CAT07 contract rejects incomplete or unbound Shelf evidence',
    result: runHumanE2eCat07ContractSmoke(),
    expect(result) {
      return (
        result.status === 0 &&
        /PASS CAT07 shelf-freshness evidence contract smoke/.test(output(result))
      );
    },
  },
  {
    name: 'Governed chain accepts S to E to every required R unit to F and rejects unledgered, mutated, and near-miss evidence',
    result: runHumanE2eGovernedChainSmoke(),
    expect(result) {
      return (
        result.status === 0 &&
        /PASS Human-E2E governed evidence-chain consumer smoke/.test(output(result))
      );
    },
  },
  {
    name: 'Phase 7 accepts production public identity from process env',
    result: run(validPublicIdentity),
    expect(result) {
      const text = output(result);
      return (
        result.status === 0 &&
        !/Missing final brand domain: EXPO_PUBLIC_FINAL_BRAND_DOMAIN/.test(text) &&
        !/EXPO_PUBLIC_(?:PRIVACY|TERMS|SUPPORT|ACCOUNT_DELETION|DATA_EXPORT|CONSUMER_HEALTH_PRIVACY)_URL must be a real production URL/.test(
          text,
        )
      );
    },
  },
  {
    name: 'Phase 7 rejects reserved final brand domains',
    result: run({
      ...validPublicIdentity,
      EXPO_PUBLIC_FINAL_BRAND_DOMAIN: 'https://routinekind.localhost',
    }),
    expect(result) {
      return (
        result.status === 0 &&
        /Missing final brand domain: EXPO_PUBLIC_FINAL_BRAND_DOMAIN/.test(output(result))
      );
    },
  },
  {
    name: 'Phase 7 rejects credentialed policy URLs',
    result: run({
      ...validPublicIdentity,
      EXPO_PUBLIC_SUPPORT_URL: 'https://user:pass@routinekind.app/support',
    }),
    expect(result) {
      return (
        result.status === 0 &&
        /EXPO_PUBLIC_SUPPORT_URL must be a real production URL/.test(output(result))
      );
    },
  },
  {
    name: 'Phase 7 rejects plaintext consumer health policy URLs',
    result: run({
      ...validPublicIdentity,
      EXPO_PUBLIC_CONSUMER_HEALTH_PRIVACY_URL: 'http://routinekind.app/consumer-health-privacy',
    }),
    expect(result) {
      return (
        result.status === 0 &&
        /EXPO_PUBLIC_CONSUMER_HEALTH_PRIVACY_URL must be a real production URL/.test(output(result))
      );
    },
  },
  {
    name: 'Phase 7 accepts normalized external evidence and named signoff',
    result: run({ ...validPublicIdentity, ...validEvidence }),
    expect(result) {
      const text = output(result);
      return (
        result.status === 0 &&
        !/Missing external Phase 7 evidence: PHASE7_[A-Z0-9_]+=true/.test(text) &&
        !/Missing external Phase 7 evidence: PHASE7_SIGNED_OFF_BY/.test(text)
      );
    },
  },
  {
    name: 'Phase 7 rejects non-true external evidence flags',
    result: run({
      ...validPublicIdentity,
      ...validEvidence,
      PHASE7_DEVICE_QA_PASS: 'yes',
    }),
    expect(result) {
      return (
        result.status === 0 &&
        /Missing external Phase 7 evidence: PHASE7_DEVICE_QA_PASS=true/.test(output(result))
      );
    },
  },
  {
    name: 'Phase 7 rejects placeholder signoffs',
    result: run({
      ...validPublicIdentity,
      ...validEvidence,
      PHASE7_SIGNED_OFF_BY: 'Tester Name',
    }),
    expect(result) {
      return (
        result.status === 0 &&
        /Missing external Phase 7 evidence: PHASE7_SIGNED_OFF_BY/.test(output(result))
      );
    },
  },
  {
    name: 'Phase 7 packet writes normalized evidence and signoff',
    result: runPacket({ ...validPublicIdentity, ...validEvidence }),
    expect(result) {
      if (result.packet === null) return false;
      const requiredPacketPaths = [
        'scripts/phase7/build-core-loop-qa-packet.mjs',
        'scripts/phase7/check-core-loop.mjs',
        'scripts/phase7/check-core-loop-smoke.mjs',
        'scripts/e2e/human-e2e-manifest.mjs',
        'scripts/e2e/human-e2e-manifest-render.mjs',
        'scripts/e2e/evidence-diagnostic-hygiene.mjs',
        'scripts/e2e/cat07-png-contract.mjs',
        'scripts/e2e/cat07-committed-evidence.mjs',
        'scripts/e2e/cat07-shelf-freshness-audit.mjs',
        'scripts/e2e/cat07-shelf-freshness-audit.test.mjs',
        'scripts/phase2/local-supabase-contract.mjs',
        'scripts/phase9/release-qa-integrity.mjs',
        'scripts/launch/governed-evidence-chain.mjs',
        'scripts/launch/governed-evidence-chain.test.mjs',
        'scripts/phase9/build-evidence-chain-ledger.mjs',
        'scripts/phase9/build-evidence-chain-ledger.test.mjs',
        'scripts/phase9/cat07-truthful-freshness-postgres-rehearsal.sql',
        'scripts/phase9/catalog-import-0061-upgrade-postgres-rehearsal.sql',
        'scripts/phase9/catalog-curation-0062-upgrade-postgres-rehearsal.sql',
        'supabase/migrations/20260718000060_cat07_truthful_freshness.sql',
        'supabase/migrations/20260722000061_catalog_import_benzoyl_review_override.sql',
        'supabase/migrations/20260722000062_catalog_curation_statement_guard.sql',
        'supabase/tests/database/catalog_import_lifecycle.test.sql',
        'supabase/tests/database/catalog_launch_curation.test.sql',
        'supabase/tests/database/catalog_serving_gate.test.sql',
        'supabase/tests/database/cat07_truthful_freshness.test.sql',
        'docs/hugeToDo/CAT-07-SHELF-FRESHNESS-SOURCE-CHECKPOINT-2026-07-19.md',
        'test-results/human-e2e/2026-08-06/cat07-shelf-freshness-current/summary.json',
        'apps/mobile/src/app/cycle/settings.tsx',
        'apps/mobile/src/app/cycle/week.tsx',
        'apps/mobile/src/app/cycle/why-tonight.tsx',
        'apps/mobile/src/app/routine/plan.tsx',
        'apps/mobile/src/app/trend/_layout.tsx',
        'apps/mobile/src/app/trend/fairness.tsx',
        'apps/mobile/src/app/trend/optin.tsx',
        'apps/mobile/src/features/routine/activationAnalytics.ts',
        'apps/mobile/src/features/routine/activationAnalytics.test.ts',
        'apps/mobile/src/features/today/completionsStore.ts',
        'apps/mobile/src/features/today/completionsStore.test.ts',
        'apps/mobile/src/features/today/cycleCompletion.ts',
        'apps/mobile/src/features/today/cycleCompletion.test.ts',
        'apps/mobile/src/features/today/routineProjection.ts',
        'apps/mobile/src/features/today/routineProjection.test.ts',
        'apps/mobile/src/features/today/todayRoute.test.ts',
        'apps/mobile/src/features/trend/copy.ts',
        'apps/mobile/src/features/trend/fairnessPrivacyGate.test.ts',
        'apps/mobile/src/features/trend/trendRoutes.test.ts',
        'apps/mobile/src/features/trend/useTrend.ts',
        'apps/mobile/src/features/scheduler/customCycle.ts',
        'apps/mobile/src/features/scheduler/cycleStore.ts',
        'docs/HUMAN_SIMULATED_E2E_TESTING.md',
        'docs/E2E_TESTING_CHECKLIST.md',
        'docs/USER_FLOW_TREE.md',
        'docs/e2e/generated/human-e2e-manifest.json',
        'docs/e2e/generated/human-e2e-manifest.md',
        'docs/phase-5/generated/device-qa-packet.json',
        'docs/phase-5/generated/device-qa-packet.md',
        'docs/phase-6/generated/payments-qa-packet.json',
        'docs/phase-6/generated/payments-qa-packet.md',
      ];
      const missingPacketPaths = requiredPacketPaths.filter(
        (path) => !result.packet.files.some((file) => file.path === path),
      );
      const invalidCat07Hashes = requiredPacketPaths
        .filter(
          (path) =>
            path.startsWith('scripts/e2e/cat07-') ||
            path.includes('cat07_truthful_freshness') ||
            path.includes('catalog-import-0061-upgrade-postgres-rehearsal') ||
            path.includes('catalog-curation-0062-upgrade-postgres-rehearsal') ||
            path.includes('20260722000061_catalog_import_benzoyl_review_override') ||
            path.includes('20260722000062_catalog_curation_statement_guard') ||
            path.endsWith('catalog_import_lifecycle.test.sql') ||
            path.endsWith('catalog_launch_curation.test.sql') ||
            path.endsWith('catalog_serving_gate.test.sql') ||
            path.includes('CAT-07-SHELF-FRESHNESS'),
        )
        .filter(
          (path) =>
            !result.packet.files.some(
              (file) => file.path === path && /^[0-9a-f]{64}$/i.test(file.sha256 ?? ''),
            ),
        );
      const cat07SummaryFile = result.packet.files.find(
        (file) => file.path === cat07ShelfFreshnessSummaryPath,
      );
      const cat07SummaryBinding =
        cat07SummaryFile?.exists === true
          ? /^[0-9a-f]{64}$/i.test(cat07SummaryFile.sha256 ?? '') &&
            result.packet.cat07CommittedEvidence.summarySha256 === cat07SummaryFile.sha256
          : cat07SummaryFile?.exists === false &&
            result.packet.cat07CommittedEvidence.status === 'blocked' &&
            result.packet.cat07CommittedEvidence.summarySha256 === null &&
            result.packet.blockers.includes(
              `CAT07 committed evidence: ${cat07ShelfFreshnessSummaryPath} must exist in HEAD.`,
            );
      const checks = {
        status: result.status === 0,
        normalizedEvidence:
          result.packet.evidence.brandReady === true &&
          result.packet.evidence.clinicalReviewPass === true &&
          result.packet.evidence.onboardingConsentQaPass === true &&
          result.packet.evidence.analyticsQaPass === true,
        normalizedSignoff: result.packet.evidence.signedOffBy === 'Tas Mohammed',
        gitSha: /^[0-9a-f]{40}$/i.test(result.packet.gitSha),
        gitStatus: typeof result.packet.gitStatus === 'string',
        governedEvidenceChain:
          ['pass', 'blocked'].includes(result.packet.governedEvidenceChain?.status) &&
          typeof result.packet.governedEvidenceChain?.sourcePacketCodeBoundToSourceCommit ===
            'boolean' &&
          Array.isArray(result.packet.governedEvidenceChain?.errors) &&
          result.packet.governedEvidenceChain.errors.every((error) =>
            result.packet.blockers.includes(`Governed evidence chain: ${error}.`),
          ),
        cat07HeadBinding: packetMatchesCat07HeadBinding(result.packet, packetSmokeRepositoryRoot()),
        cat07DiagnosticsAreRepoRelative: !result.packet.blockers
          .filter((blocker) => blocker.startsWith('CAT07'))
          .some((blocker) =>
            /(?:[A-Za-z]:[\\/]|[\\/]Users[\\/]|[\\/]AppData[\\/]|\.claude[\\/]worktrees[\\/])/u.test(
              blocker,
            ),
          ),
        requiredPacketPaths: missingPacketPaths.length === 0,
        cat07Hashes: invalidCat07Hashes.length === 0,
        cat07SummaryBinding,
        scenarios: result.packet.scenarios.every((scenario) => scenario.evidencePass === true),
        signoffBlocker: !result.packet.blockers.some((blocker) =>
          /PHASE7_SIGNED_OFF_BY/.test(blocker),
        ),
      };
      const failedChecks = Object.entries(checks)
        .filter(([, passed]) => !passed)
        .map(([name]) => name);
      if (failedChecks.length > 0) {
        console.error(
          `Phase 7 normalized packet predicate failures: ${failedChecks.join(', ')}; missing paths: ${missingPacketPaths.join(', ') || 'none'}; invalid CAT07 hashes: ${invalidCat07Hashes.join(', ') || 'none'}`,
        );
      }
      return failedChecks.length === 0;
    },
  },
  {
    name: 'Phase 7 packet warns when generated from a dirty worktree',
    result: runPacketWithDirtyWorktree({ ...validPublicIdentity, ...validEvidence }),
    expect(result) {
      if (result.packet === null) return false;
      return (
        result.status === 0 &&
        result.packet.gitStatus.includes(`.phase7-smoke-dirty-${process.pid}.tmp`) &&
        result.packet.warnings.includes(
          'Phase 7 core-loop QA packet generated with a dirty Git worktree; do not use it as final core-loop evidence.',
        )
      );
    },
  },
  {
    name: 'Strict Phase 7 packet blocks a dirty worktree',
    result: runPacketWithDirtyWorktree({ ...validPublicIdentity, ...validEvidence }, ['--strict']),
    expect(result) {
      if (result.packet === null) return false;
      return (
        result.status === 1 &&
        result.packet.gitStatus.includes(`.phase7-smoke-dirty-${process.pid}.tmp`) &&
        result.packet.blockers.includes(
          'Phase 7 core-loop QA packet generated with a dirty Git worktree; do not use it as final core-loop evidence.',
        )
      );
    },
  },
  {
    name: 'Phase 7 packet reports dirty upstream generated evidence instead of trusting it',
    result: runPacketWithDirtyUpstreamEvidence({ ...validPublicIdentity, ...validEvidence }),
    expect(result) {
      if (result.packet === null) return false;
      return (
        result.status === 0 &&
        result.packet.gitStatus.includes('docs/e2e/generated/human-e2e-manifest.json') &&
        result.packet.blockers.includes(
          'Phase 7 source snapshot: docs/e2e/generated/human-e2e-manifest.json working bytes do not match pinned HEAD.',
        )
      );
    },
  },
  {
    name: 'Phase 7 packet strips placeholder signoffs',
    result: runPacket({
      ...validPublicIdentity,
      ...validEvidence,
      PHASE7_SIGNED_OFF_BY: 'tester@example.com',
    }),
    expect(result) {
      if (result.packet === null) return false;
      return (
        result.status === 0 &&
        result.packet.evidence.signedOffBy === '' &&
        result.packet.blockers.includes('Missing PHASE7_SIGNED_OFF_BY.')
      );
    },
  },
  {
    name: 'Phase 7 packet blocks non-true evidence flags',
    result: runPacket({
      ...validPublicIdentity,
      ...validEvidence,
      PHASE7_TODAY_CHECKOFF_QA_PASS: 'complete',
    }),
    expect(result) {
      if (result.packet === null) return false;
      return (
        result.status === 0 &&
        result.packet.evidence.todayCheckoffQaPass === false &&
        result.packet.scenarios.some(
          (scenario) =>
            scenario.envKey === 'PHASE7_TODAY_CHECKOFF_QA_PASS' && scenario.evidencePass === false,
        ) &&
        result.packet.blockers.includes('Missing todayCheckoffQaPass evidence.')
      );
    },
  },
];

let failed = false;
for (const testCase of cases) {
  if (testCase.expect(testCase.result)) {
    console.log(`OK ${testCase.name}`);
    continue;
  }

  failed = true;
  console.error(`FAIL ${testCase.name}`);
  const text = output(testCase.result).trim();
  if (text) console.error(text);
}

if (failed) process.exit(1);
