import { lstatSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';

import { auditGovernedEvidenceChain } from '../launch/governed-evidence-chain.mjs';
import {
  PHASE9_RELEASE_INPUT_MAX_BYTES,
  readStableRootBoundWorkingFile,
  runTrustedGit,
} from './release-qa-integrity.mjs';

const GIT_SHA = /^[0-9a-f]{40}$/;
const RELEASE_CANDIDATE_DIR = /^docs\/phase-9\/release-candidates\/rc-[a-z0-9]+(?:-[a-z0-9]+)*$/;

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function git(root, args) {
  return runTrustedGit(root, args, { encoding: 'utf8' });
}

function canonicalRealPath(path) {
  const real = realpathSync(path);
  return process.platform === 'win32' ? real.toLowerCase() : real;
}

function isExactGitWorktreeRoot(root) {
  try {
    const topLevel = git(root, ['rev-parse', '--show-toplevel']).trim();
    return canonicalRealPath(topLevel) === canonicalRealPath(root);
  } catch {
    return false;
  }
}

function normalizedText(value) {
  return value.replace(/\r\n/gu, '\n');
}

function safeTrackedPath(path, releaseCandidateDir) {
  return (
    typeof path === 'string' &&
    path.startsWith(`${releaseCandidateDir}/`) &&
    path.length > releaseCandidateDir.length + 1 &&
    !/[\\\0]/u.test(path) &&
    !path.split('/').some((segment) => segment === '' || segment === '.' || segment === '..')
  );
}

export function isExactTrackedHeadTextFile(rootPath, path, releaseCandidateDir) {
  const root = resolve(rootPath);
  if (!safeTrackedPath(path, releaseCandidateDir)) return false;
  try {
    if (!isExactGitWorktreeRoot(root)) return false;
    const absolutePath = resolve(root, ...path.split('/'));
    const realRoot = realpathSync(root);
    const realFile = realpathSync(absolutePath);
    const relativeRealPath = relative(realRoot, realFile);
    if (
      relativeRealPath === '' ||
      relativeRealPath === '..' ||
      relativeRealPath.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) ||
      isAbsolute(relativeRealPath)
    ) {
      return false;
    }
    const stat = lstatSync(absolutePath, { bigint: true });
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1n) return false;

    const stage = git(root, ['ls-files', '--stage', '--', path]).trim();
    const match = /^100644 ([0-9a-f]{40,64}) 0\t(.+)$/u.exec(stage);
    if (!match || match[2] !== path) return false;
    if (git(root, ['ls-files', '-v', '--', path]).trim() !== `H ${path}`) return false;
    if (git(root, ['rev-parse', `HEAD:${path}`]).trim() !== match[1]) return false;
    git(root, ['diff', '--no-ext-diff', '--no-textconv', '--quiet', 'HEAD', '--', path]);
    const headText = normalizedText(git(root, ['show', `HEAD:${path}`]));
    const working = readStableRootBoundWorkingFile(root, path, {
      maxBytes: PHASE9_RELEASE_INPUT_MAX_BYTES,
    });
    return working.kind === 'file' && normalizedText(working.bytes.toString('utf8')) === headText;
  } catch {
    return false;
  }
}

export function auditReleaseCandidateGitContract({
  root: rootPath,
  sourceGitSha,
  releaseCandidateDir,
  requiredTrackedFiles,
  onPhase = null,
}) {
  const root = resolve(rootPath);
  if (!GIT_SHA.test(sourceGitSha)) {
    throw new TypeError('sourceGitSha must be a lowercase 40-character Git SHA.');
  }
  if (!RELEASE_CANDIDATE_DIR.test(releaseCandidateDir)) {
    throw new TypeError('releaseCandidateDir must be one strict non-template RC directory.');
  }
  if (
    !Array.isArray(requiredTrackedFiles) ||
    requiredTrackedFiles.length === 0 ||
    new Set(requiredTrackedFiles).size !== requiredTrackedFiles.length ||
    new Set(requiredTrackedFiles.map((path) => path.normalize('NFC').toLowerCase())).size !==
      requiredTrackedFiles.length ||
    requiredTrackedFiles.some((path) => !safeTrackedPath(path, releaseCandidateDir))
  ) {
    throw new TypeError('requiredTrackedFiles must be a unique list inside the selected RC.');
  }
  if (onPhase !== null && typeof onPhase !== 'function') {
    throw new TypeError('onPhase must be null or a function.');
  }

  const errors = [];
  const chain = auditGovernedEvidenceChain({
    root,
    sourceGitSha,
    releaseCandidateDir,
    onPhase,
  });
  if (chain.status !== 'pass') {
    errors.push(...chain.errors.map((error) => `Governed evidence chain is invalid: ${error}`));
  }
  const ledgerEntries = new Map((chain.ledger?.entries ?? []).map((entry) => [entry.path, entry]));

  const trackedFiles = {};
  const ledgerBoundFiles = {};
  for (const path of requiredTrackedFiles) {
    // The canonical ledger deliberately cannot hash itself. Its exact S..E
    // placement, tree mode, bytes-at-HEAD, and post-E immutability are instead
    // proven by auditGovernedEvidenceChain; every other RC file must be an
    // explicit release-candidate ledger entry.
    const ledgerBound =
      path === chain.ledgerPath || ledgerEntries.get(path)?.role === 'release-candidate';
    ledgerBoundFiles[path] = ledgerBound;
    if (!ledgerBound) {
      errors.push(
        `${path} must be the governed ledger itself or a release-candidate entry in that ledger.`,
      );
    }
    const valid = ledgerBound && isExactTrackedHeadTextFile(root, path, releaseCandidateDir);
    trackedFiles[path] = valid;
    if (!valid) {
      errors.push(`${path} must be a normal, single-link tracked file whose content matches HEAD.`);
    }
  }

  return deepFreeze({
    schemaVersion: 2,
    kind: 'release_candidate_git_contract_audit',
    status: errors.length === 0 ? 'pass' : 'invalid',
    sourceGitSha,
    headGitSha: chain.headGitSha,
    evidenceCommitSha: chain.evidenceCommitSha,
    releaseCandidateDir,
    directEvidenceCommit: chain.directEvidenceCommit,
    evidenceOnlyCommit: chain.evidenceOnlyCommit,
    cleanWorktree: chain.cleanWorktree,
    normalIndexState: chain.normalIndexState,
    ledgerBoundFiles,
    trackedFiles,
    chain,
    errors,
  });
}
