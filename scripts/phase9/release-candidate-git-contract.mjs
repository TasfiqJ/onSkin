import { execFileSync } from 'node:child_process';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';

const GIT_SHA = /^[0-9a-f]{40}$/;
const RELEASE_CANDIDATE_DIR = /^docs\/phase-9\/release-candidates\/rc-[a-z0-9]+(?:-[a-z0-9]+)*$/;

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function isolatedGitEnvironment() {
  const environment = { ...process.env };
  for (const key of Object.keys(environment)) {
    if (/^GIT_/iu.test(key)) delete environment[key];
  }
  return environment;
}

function git(root, args) {
  return execFileSync(
    'git',
    [
      '-C',
      root,
      '-c',
      `safe.directory=${root}`,
      '-c',
      'core.fsmonitor=false',
      '-c',
      'core.untrackedCache=false',
      ...args,
    ],
    {
      cwd: root,
      encoding: 'utf8',
      env: isolatedGitEnvironment(),
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
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

function parseNulRecords(value) {
  if (value === '') return [];
  if (!value.endsWith('\0')) throw new Error('Git did not return a NUL-terminated record set.');
  const records = value.slice(0, -1).split('\0');
  if (records.some((record) => record.length === 0)) {
    throw new Error('Git returned an empty record in a NUL-delimited record set.');
  }
  return records;
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
    return normalizedText(readFileSync(absolutePath, 'utf8')) === headText;
  } catch {
    return false;
  }
}

export function auditReleaseCandidateGitContract({
  root: rootPath,
  sourceGitSha,
  releaseCandidateDir,
  requiredTrackedFiles,
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
    requiredTrackedFiles.some((path) => !safeTrackedPath(path, releaseCandidateDir))
  ) {
    throw new TypeError('requiredTrackedFiles must be a unique list inside the selected RC.');
  }

  const errors = [];
  let headGitSha = null;
  let directEvidenceCommit = false;
  let evidenceOnlyCommit = false;
  let cleanWorktree = false;
  let normalIndexState = false;

  try {
    if (!isExactGitWorktreeRoot(root)) {
      throw new Error('The supplied root is not the exact Git worktree root.');
    }
    git(root, ['cat-file', '-e', `${sourceGitSha}^{commit}`]);
    const headParents = git(root, ['rev-list', '--parents', '-n', '1', 'HEAD'])
      .trim()
      .split(/\s+/u);
    headGitSha = headParents[0] ?? null;
    directEvidenceCommit =
      headParents.length === 2 &&
      headParents[0] !== sourceGitSha &&
      headParents[1] === sourceGitSha;

    if (directEvidenceCommit) {
      const changedPaths = parseNulRecords(
        git(root, [
          'diff',
          '--no-renames',
          '--no-ext-diff',
          '--no-textconv',
          '--name-only',
          '-z',
          `${sourceGitSha}..HEAD`,
          '--',
        ]),
      );
      evidenceOnlyCommit =
        changedPaths.length > 0 &&
        changedPaths.every((path) => safeTrackedPath(path, releaseCandidateDir));
    }
    cleanWorktree =
      git(root, ['status', '--porcelain=v1', '-z', '--untracked-files=all']).length === 0;
    const indexEntries = parseNulRecords(git(root, ['ls-files', '-v', '-z']));
    normalIndexState =
      indexEntries.length > 0 && indexEntries.every((entry) => /^H .+/su.test(entry));
  } catch {
    // The typed result below remains fail-closed.
  }

  if (!directEvidenceCommit) {
    errors.push(
      'HEAD must be one non-merge evidence commit whose direct parent is the build-source SHA.',
    );
  }
  if (!evidenceOnlyCommit) {
    errors.push('The direct evidence commit may change only the selected RC folder.');
  }
  if (!cleanWorktree) {
    errors.push('Release-candidate validation requires a clean Git worktree.');
  }
  if (!normalIndexState) {
    errors.push(
      'Release-candidate validation forbids skip-worktree, assume-unchanged, sparse, or other non-normal index entries.',
    );
  }

  const trackedFiles = {};
  for (const path of requiredTrackedFiles) {
    const valid = isExactTrackedHeadTextFile(root, path, releaseCandidateDir);
    trackedFiles[path] = valid;
    if (!valid) {
      errors.push(`${path} must be a normal, single-link tracked file whose content matches HEAD.`);
    }
  }

  return deepFreeze({
    schemaVersion: 1,
    kind: 'release_candidate_git_contract_audit',
    status: errors.length === 0 ? 'pass' : 'invalid',
    sourceGitSha,
    headGitSha,
    releaseCandidateDir,
    directEvidenceCommit,
    evidenceOnlyCommit,
    cleanWorktree,
    normalIndexState,
    trackedFiles,
    errors,
  });
}
