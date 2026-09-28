#!/usr/bin/env node

import { lstatSync, readFileSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  assertCurrentSourceContract,
  assertEvidenceSafe,
  buildSourceInventory,
  canonicalJson,
  sha256,
} from './staging-deployment-evidence-lib.mjs';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..', '..');
const PROJECT_REF = /^[a-z0-9]{20}$/u;
const GIT_SHA = /^[0-9a-f]{40}$/u;
const ARTIFACTS = Object.freeze({
  trafficProviderFreeze: 'traffic-provider-freeze.json',
  accountDeletion: 'account-deletion.json',
  publicationFence: 'publication-fence.json',
  entitlementAuthority: 'entitlement-authority.json',
  healthConsent: 'health-consent.json',
  appleAuth: 'apple-auth.json',
});

function fail(code) {
  throw new Error(code);
}

function artifactHash(evidenceDirectory, file) {
  if (!evidenceDirectory) return null;
  const root = resolve(evidenceDirectory);
  const path = join(root, file);
  const metadata = lstatSync(path, { throwIfNoEntry: false });
  if (
    !metadata?.isFile() ||
    metadata.isSymbolicLink() ||
    statSync(path).size > 1024 * 1024 ||
    dirname(resolve(path)) !== root
  ) {
    fail('DB06_PREPARATION_ARTIFACT_INVALID');
  }
  return sha256(readFileSync(path));
}

export function buildCutoverPreparation({
  repoRoot,
  projectRef,
  sourceGitCommit,
  evidenceDirectory,
}) {
  if (!PROJECT_REF.test(String(projectRef)) || !GIT_SHA.test(String(sourceGitCommit))) {
    fail('DB06_PREPARATION_INPUT_INVALID');
  }
  const sourceInventory = buildSourceInventory(repoRoot);
  assertCurrentSourceContract(sourceInventory);
  const migrationIds = sourceInventory.migrations.map(({ id }) => id);
  const hashes = Object.fromEntries(
    Object.entries(ARTIFACTS).map(([key, file]) => [
      key,
      { file, sha256: artifactHash(evidenceDirectory, file) },
    ]),
  );
  const summary = {
    schemaVersion: 1,
    environment: 'staging',
    sourceGitCommit,
    projectRefLast4: projectRef.slice(-4),
    projectRefFingerprint: sha256(`db06-project-ref-v1\0${projectRef}`),
    projectRefFingerprintAlgorithm: 'sha256(utf8("db06-project-ref-v1\\0" + fullProjectRef))',
    migrationCount: migrationIds.length,
    migrationIds,
    migrationPlanSha256: sha256(canonicalJson(migrationIds)),
    migrationPlanSha256Algorithm: 'sha256(utf8(canonical-json(ordered-migration-id-array)))',
    expectedArtifactReferences: hashes,
    rawProjectRefRetained: false,
  };
  assertEvidenceSafe(summary, projectRef);
  return summary;
}

function git(args) {
  const result = spawnSync('git', args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
    timeout: 60_000,
    maxBuffer: 1024 * 1024,
  });
  if (result.status !== 0 || result.error) fail('DB06_PREPARATION_GIT_FAILED');
  return result.stdout.trim();
}

function parseCliArgs(argv) {
  if (argv.length === 0) return {};
  if (argv.length === 2 && argv[0] === '--evidence-dir' && argv[1]) {
    return { evidenceDirectory: resolve(argv[1]) };
  }
  fail('DB06_PREPARATION_ARGUMENTS_INVALID');
}

function main() {
  const { evidenceDirectory } = parseCliArgs(process.argv.slice(2));
  const projectRef = process.env.SUPABASE_PROJECT_REF?.trim() ?? '';
  if (!PROJECT_REF.test(projectRef)) fail('DB06_PREPARATION_PROJECT_REF_REQUIRED');
  git(['fetch', 'origin', 'main', '--quiet']);
  const sourceGitCommit = git(['rev-parse', 'HEAD']);
  const originMain = git(['rev-parse', 'origin/main']);
  const branch = git(['branch', '--show-current']);
  const status = git(['status', '--porcelain=v1', '--untracked-files=all']);
  if (branch !== 'main' || sourceGitCommit !== originMain || status) {
    fail('DB06_PREPARATION_REQUIRES_CLEAN_ORIGIN_MAIN');
  }
  const summary = buildCutoverPreparation({
    repoRoot: REPO_ROOT,
    projectRef,
    sourceGitCommit,
    evidenceDirectory,
  });
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${String(error?.message ?? 'DB06_PREPARATION_FAILED')}\n`);
    process.exitCode = 1;
  }
}
