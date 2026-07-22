import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';

function git(root, args) {
  return execFileSync('git', ['-c', `safe.directory=${root}`, ...args], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function writeRepoFile(root, repoPath, contents) {
  const absolute = join(root, ...repoPath.split('/'));
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, contents);
}

test('an exact packet-output exclusion still reports another dirty governed output', async (t) => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'onskin-exact-status-exclusion-'));
  t.after(() => rmSync(fixtureRoot, { recursive: true, force: true }));
  git(fixtureRoot, ['init', '--quiet']);
  git(fixtureRoot, ['config', 'user.name', 'Git Status Test']);
  git(fixtureRoot, ['config', 'user.email', 'git-status@example.invalid']);
  writeRepoFile(fixtureRoot, 'README.md', '# fixture\n');
  git(fixtureRoot, ['add', '--', 'README.md']);
  git(fixtureRoot, ['commit', '--quiet', '-m', 'base']);

  const ownOutputs = [
    'docs/phase-10/generated/support-handoff-packet.json',
    'docs/phase-10/generated/support-handoff-packet.md',
  ];
  const otherGovernedOutputs = [
    'docs/phase-11/generated/public-launch-packet.json',
    'docs/phase-11/generated/public-launch-packet.md',
  ];
  for (const repoPath of ownOutputs) writeRepoFile(fixtureRoot, repoPath, 'own output\n');
  for (const repoPath of otherGovernedOutputs) {
    writeRepoFile(fixtureRoot, repoPath, 'other governed output\n');
  }

  const originalCwd = process.cwd();
  process.chdir(fixtureRoot);
  try {
    const moduleUrl = new URL(`./lib.mjs?fixture=${Date.now()}`, import.meta.url);
    const { gitStatusExcludingPaths } = await import(moduleUrl.href);
    const status = gitStatusExcludingPaths(ownOutputs);
    for (const repoPath of ownOutputs) assert.doesNotMatch(status, new RegExp(repoPath));
    for (const repoPath of otherGovernedOutputs) assert.match(status, new RegExp(repoPath));
  } finally {
    process.chdir(originalCwd);
  }
});
