// Source-only obligations. This module never supplies runtime feature availability.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT34 = resolve(fileURLToPath(new URL('../..', import.meta.url)));
export const BASE34 = '4ca36e915608460a1ed97d7fff94a3ece61296ab';
const TREE34 = '49945b4e453b4fc30ceb175f330c8b4b924afe31';
const PLAN34 = 'fe0782e37b8eb74b1f097ae8b2def6cde4a478b8';
const PLAN_PATH = 'docs/brain/task-specs/M1X-34/SCOPE_PLAN.md';
const PLAN_SHA = '3254681ec8e36887d7f6948890836de7f01e8f2058ea52e6ada5a475b7261535';
const D = 'docs/release/full-app-j01/';
const VERIFIER = 'scripts/launch/full-app-contract33.mjs';
const VERIFIER_SHA = '9bcc7fc1ce631f861faaea2857252a9c7cfc6639a00f742a5b71503e6744e5a0';
const PINS = Object.freeze({
  'contract.v2.json': '0578cb851f28aa26c289793fad76edd862d4222073e0fcc5c3b5210849026495',
  'matrix.v2.json': '1daafaa86df15dc14af8250a395ab86a7534f2d2a7738c0c0ce1555c1a91a7f0',
  'precedence.v2.json': 'd386e395fc42c716f85121e977393b185d2c75344bdd63c4a4b44a896c4efa39',
  'roadmap.v2.json': 'd057d0a2b6b3f6bb07150cf5a751ae922f186466a12bcd61edba824f0bee5017',
  'owner-ledger33.v1.json': 'a9390584684fbfef3c4988993be54c12bcfa7211ed2d4dffaa4ef9a2cc8cb420',
});
const need = (value, code) => { if (!value) throw new Error(code); };
const digest = (raw) => createHash('sha256').update(raw).digest('hex');
const blob = (raw) => createHash('sha1').update(`blob ${raw.length}\0`).update(raw).digest('hex');
function immutable(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(immutable); Object.freeze(value); }
  return value;
}
function regular(root, path) {
  let target = resolve(root);
  need(lstatSync(target).isDirectory() && !lstatSync(target).isSymbolicLink(), 'R34_ROOT_REGULAR');
  for (const part of path.split('/').slice(0, -1)) {
    target = join(target, part); const stat = lstatSync(target);
    need(stat.isDirectory() && !stat.isSymbolicLink(), 'R34_SOURCE_LINK');
  }
  target = join(target, path.split('/').at(-1)); const before = lstatSync(target);
  need(before.isFile() && !before.isSymbolicLink() && before.nlink === 1 && before.size <= 2 * 1024 * 1024, 'R34_SOURCE_REGULAR');
  const raw = readFileSync(target); const after = lstatSync(target);
  need([before.dev, before.ino, before.size, before.mtimeMs, before.ctimeMs].join(':') ===
    [after.dev, after.ino, after.size, after.mtimeMs, after.ctimeMs].join(':'), 'R34_SOURCE_CHANGED');
  return raw;
}
function git(root, ...args) {
  need(!Object.keys(process.env).some((k) => /^GIT_(?:DIR|WORK_TREE|INDEX_FILE|OBJECT_DIRECTORY|ALTERNATE_OBJECT_DIRECTORIES|REPLACE_REF_BASE|NAMESPACE|CONFIG.*|EXEC_PATH|SHALLOW_FILE|GRAFT_FILE)$/u.test(k)), 'R34_GIT_ENV');
  return execFileSync('git', ['--no-replace-objects', '-c', 'core.hooksPath=', '-c', 'core.fsmonitor=false', ...args],
    { cwd: root, maxBuffer: 16 * 1024 * 1024, windowsHide: true });
}

export function readCandidateScope34(root, mode) {
  need(['planning', 'verification'].includes(mode), 'R34_READ_MODE');
  root = resolve(root);
  need(git(root, 'rev-parse', '--is-shallow-repository').toString().trim() === 'false', 'R34_COMPLETE_REPOSITORY');
  need(git(root, 'rev-parse', BASE34 + '^{tree}').toString().trim() === TREE34, 'R34_INTEGRATION_BASE');
  git(root, 'merge-base', '--is-ancestor', PLAN34, 'HEAD');
  const plan = regular(root, PLAN_PATH);
  need(digest(plan) === PLAN_SHA && digest(git(root, 'show', PLAN34 + ':' + PLAN_PATH)) === PLAN_SHA, 'R34_IMMUTABLE_PLAN');
  const grant = new Set([...plan.toString().matchAll(/^\d+\. `([^`]+)`$/gmu)].map((x) => x[1]));
  need(grant.size === 22, 'R34_FINITE_GRANT');
  const delta = git(root, 'diff', '--raw', '--no-abbrev', '--no-renames', BASE34, 'HEAD').toString().trim();
  for (const line of delta ? delta.split('\n') : []) {
    const [header, path] = line.split('\t');
    need(grant.has(path) && /^:(?:000000|100644) 100644 [0-9a-f]{40} [0-9a-f]{40} [AM]$/u.test(header), 'R34_SOURCE_INTERVAL');
  }
  const documentPins = [];
  const documents = {};
  // Authenticate both the exact program and its inputs before executing original33.
  for (const [path, sha256] of [[VERIFIER, VERIFIER_SHA], ...Object.entries(PINS).map(([n, h]) => [D + n, h])]) {
    const raw = regular(root, path);
    need(digest(raw) === sha256, 'R34_PINNED_BYTES');
    const oid = blob(raw);
    need(git(root, 'ls-tree', BASE34, '--', path).toString() === `100644 blob ${oid}\t${path}\n`, 'R34_PINNED_TREE');
    need(git(root, 'ls-files', '--stage', '--', path).toString() === `100644 ${oid} 0\t${path}\n`, 'R34_PINNED_INDEX');
    documentPins.push({ path, mode: '100644', blob: oid, sha256 });
    if (path !== VERIFIER) documents[path.slice(D.length)] = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw));
  }
  let verified;
  try {
    verified = JSON.parse(execFileSync(process.execPath, [join(root, VERIFIER)],
      { cwd: root, maxBuffer: 4 * 1024 * 1024, windowsHide: true }).toString());
  } catch { throw new Error('R34_CURRENT_SOURCE_REFUSAL'); }
  need(verified.valid === true && verified.requiredRows === 38 && verified.deferredRows === 27 &&
    verified.unadmittedGates.length === 18 && verified.acceptanceGranted === false &&
    verified.externalReady === false && verified.candidateReady === false && verified.release === 'NO_GO', 'R34_NON_ADMITTING_VALIDATION');
  const contract = documents['contract.v2.json']; const matrix = documents['matrix.v2.json'];
  const precedence = documents['precedence.v2.json'];
  const requiredIds = [...contract.required_f, ...contract.required_c, ...contract.required_p, ...contract.korean_candidates];
  const deferredIds = [...contract.deferred_f, ...contract.deferred_j];
  const refs = new Map([...matrix.rows.flatMap((r) => r.source_refs), matrix.history.source_ref,
    ...matrix.history.snapshot_refs].map((ref) => [ref.path, ref]));
  // Original33 verifies current bytes. Also require their unchanged regular index identities.
  const index = new Map(git(root, 'ls-files', '--stage', '-z').toString().split('\0').filter(Boolean).map((line) => {
    const [header, path] = line.split('\t'); return [path, header];
  }));
  for (const ref of refs.values()) need(index.get(ref.path) === `${ref.mode} ${ref.blob} 0`, 'R34_CURRENT_SOURCE_INDEX');
  return immutable({
    valid: true, schemaVersion: 2, scope: 'full-app-j01-v2', mode, contract: contract.contract_id,
    requiredRows: 38, deferredRows: 27, totalRows: 65, requiredIds, deferredIds,
    obligations: matrix.rows.map((row) => ({ id: row.id,
      action: deferredIds.includes(row.id) ? 'DEFERRED_NOT_AUTHORIZED' :
        mode === 'planning' ? 'PLAN_REQUIRED_OBLIGATION' : 'VERIFY_REQUIRED_OBLIGATION',
      gates: [...row.gates], complete: false, positiveOutputEnabled: false, ownerAdmitted: false })),
    unadmittedGates: [...verified.unadmittedGates],
    provenance: { assessedHead: contract.source_base, assessedTree: contract.source_base_tree,
      integrationBase: BASE34, integrationTree: TREE34, readerPlan: PLAN34, assessmentRenewed: false,
      sourceValidity: precedence.source_validity.kind, documentPins,
      checkedCurrentSourceRefs: [...refs.values()].map((ref) => ({ ...ref })),
      historicalAnchors: precedence.source_anchors.map((ref) => ({ ...ref })) },
    externalReady: false, candidateReady: false, acceptanceGranted: false, release: 'NO_GO',
  });
}

export function runCandidateScope34(args = process.argv.slice(2), root = ROOT34) {
  need((args.length === 2 || args.length === 3) && args[0] === '--mode' &&
    ['planning', 'verification'].includes(args[1]) && (args.length === 2 || args[2] === '--external-readiness'), 'R34_CLI_ARGUMENTS');
  console.log(JSON.stringify(readCandidateScope34(root, args[1])));
  return args.includes('--external-readiness') ? 2 : 0;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = runCandidateScope34(); }
  catch (error) {
    console.log(JSON.stringify({ valid: false, error: /^R34_[A-Z_]+$/u.test(error.message) ? error.message : 'R34_READ_INCOMPLETE',
      acceptanceGranted: false, release: 'NO_GO' }));
    process.exitCode = 1;
  }
}
