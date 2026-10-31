import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { readCandidateScope34 } from './candidate-scope34.mjs';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const workspace = mkdtempSync(join(tmpdir(), 'candidate34-'));
const fixture = join(workspace, 'complete-clone');
execFileSync('git', ['clone', '--quiet', '--no-hardlinks', '--no-checkout', root, fixture]);
execFileSync('git', ['-c', 'core.autocrlf=false', 'checkout', '--quiet', '--detach', 'HEAD'], { cwd: fixture });
after(() => {
  assert.equal(dirname(workspace), resolve(tmpdir()));
  assert.ok(basename(workspace).startsWith('candidate34-'));
  rmSync(workspace, { recursive: true, force: true });
});
const dir = 'docs/release/full-app-j01/';
const required = [
  ...Array.from({ length: 20 }, (_, i) => `F${String(i + 1).padStart(2, '0')}`).filter((id) => id !== 'F18'),
  ...Array.from({ length: 12 }, (_, i) => `V2-C${String(i + 1).padStart(2, '0')}`),
  ...Array.from({ length: 6 }, (_, i) => `P${String(i + 1).padStart(2, '0')}`), 'J01',
];
const deferred = ['F18', ...Array.from({ length: 26 }, (_, i) => `J${String(i + 2).padStart(2, '0')}`)];

test('planning and verification enumerate exact obligations without admitting availability', () => {
  for (const mode of ['planning', 'verification']) {
    const value = readCandidateScope34(root, mode);
    assert.equal(value.valid, true);
    assert.equal(value.schemaVersion, 2);
    assert.equal(value.mode, mode);
    assert.deepEqual(value.requiredIds, required);
    assert.deepEqual(value.deferredIds, deferred);
    assert.equal(value.obligations.length, 65);
    assert.equal(value.unadmittedGates.length, 18);
    for (const row of value.obligations) {
      assert.equal(row.complete, false);
      assert.equal(row.ownerAdmitted, false);
      assert.equal(row.positiveOutputEnabled, false);
      assert.equal(row.action, deferred.includes(row.id) ? 'DEFERRED_NOT_AUTHORIZED' :
        mode === 'planning' ? 'PLAN_REQUIRED_OBLIGATION' : 'VERIFY_REQUIRED_OBLIGATION');
      assert.deepEqual(Object.keys(row).sort(), ['action', 'complete', 'gates', 'id', 'ownerAdmitted', 'positiveOutputEnabled']);
    }
    assert.equal(value.provenance.assessedHead, 'cbbb5a83bd29d2833399c214f5b6c6dd14873d24');
    assert.equal(value.provenance.integrationBase, '4ca36e915608460a1ed97d7fff94a3ece61296ab');
    assert.equal(value.provenance.assessmentRenewed, false);
    assert.equal(value.acceptanceGranted, false);
    assert.equal(value.release, 'NO_GO');
    assert.equal(value.externalReady, false);
    assert.equal(value.candidateReady, false);
    assert.ok(value.provenance.checkedCurrentSourceRefs.length > 77);
  }
});

test('returned projection is deeply immutable', () => {
  const value = readCandidateScope34(root, 'planning');
  assert.throws(() => value.requiredIds.push('J05'), TypeError);
  assert.throws(() => { value.obligations[0].complete = true; }, TypeError);
  assert.throws(() => value.obligations[0].gates.push('APPROVED'), TypeError);
  assert.throws(() => { value.provenance.documentPins[0].sha256 = 'fake'; }, TypeError);
});

test('missing, runtime, admission, aliased and non-string modes refuse', () => {
  for (const mode of [undefined, null, '', 'runtime', 'release', 'approve', 'Planning', 'verify', {}, true])
    assert.throws(() => readCandidateScope34(root, mode), /R34_READ_MODE/);
});

function mutate(path, change) {
  const target = join(fixture, path);
  const original = readFileSync(target);
  try {
    const replacement = change(original);
    writeFileSync(target, replacement);
    assert.throws(() => readCandidateScope34(fixture, 'verification'), /R(?:34|33)_/);
  } finally {
    writeFileSync(target, original);
  }
  assert.deepEqual(readFileSync(target), original);
  assert.equal(readCandidateScope34(fixture, 'verification').valid, true);
}
const jsonMutation = (fn) => (raw) => { const value = JSON.parse(raw); fn(value); return JSON.stringify(value); };
const attacks = [
  ['malformed JSON', 'contract.v2.json', () => '{'],
  ['duplicate JSON key', 'contract.v2.json', (raw) => raw.toString().replace('{', '{"schema_version":2,')],
  ['extra JSON key', 'contract.v2.json', jsonMutation((x) => { x.fake = true; })],
  ['legacy contract swap', 'contract.v2.json', () => readFileSync(join(fixture, 'docs/hugeToDo/launch-contract.json'))],
  ['missing required identity', 'contract.v2.json', jsonMutation((x) => x.required_c.pop())],
  ['duplicate required identity', 'contract.v2.json', jsonMutation((x) => { x.required_f[1] = x.required_f[0]; })],
  ['J01 positive report', 'contract.v2.json', jsonMutation((x) => { x.j01.claims.positive_report = true; })],
  ['F18 enabling', 'contract.v2.json', jsonMutation((x) => x.required_f.push('F18'))],
  ['J05 enabling', 'contract.v2.json', jsonMutation((x) => x.korean_candidates.push('J05'))],
  ['false readiness', 'contract.v2.json', jsonMutation((x) => { x.candidateReady = true; })],
  ['missing mandatory row', 'matrix.v2.json', jsonMutation((x) => x.rows.pop())],
  ['duplicate row', 'matrix.v2.json', jsonMutation((x) => { x.rows[1] = x.rows[0]; })],
  ['alias confusion', 'matrix.v2.json', jsonMutation((x) => { x.rows[0].aliases[0] = 'F02'; })],
  ['fake completion', 'matrix.v2.json', jsonMutation((x) => { x.rows[0].complete = true; })],
  ['fake owner', 'matrix.v2.json', jsonMutation((x) => { x.rows[0].owner_admitted = true; })],
  ['positive output', 'matrix.v2.json', jsonMutation((x) => { x.rows[0].positive_output_enabled = true; })],
  ['wrong source hash', 'matrix.v2.json', jsonMutation((x) => { x.rows[0].source_refs[0].sha256 = '0'.repeat(64); })],
  ['changed history', 'matrix.v2.json', jsonMutation((x) => { x.history.task_records[0].original_status = 'FORGED_ACCEPTANCE'; })],
  ['stale interval', 'precedence.v2.json', jsonMutation((x) => { x.evaluated_source = '0'.repeat(40); })],
  ['fake gate approval', 'owner-ledger33.v1.json', jsonMutation((x) => { x.gates[0].admitted = true; })],
  ['fake paid admission', 'owner-ledger33.v1.json', jsonMutation((x) => { x.qualified_admissions.PAID = true; })],
];
for (const [label, path, change] of attacks)
  test(`${label}: refuse, restore exact bytes, pass`, () => mutate(dir + path, change));

test('changed actual F09 source refuses even when all five candidate documents match', () =>
  mutate('apps/mobile/src/features/photos/manualCompare20.ts', (raw) => Buffer.concat([raw, Buffer.from('\n// hostile source mutation\n')])));
test('changed historical validator refuses before it can execute', () =>
  mutate('scripts/launch/full-app-contract33.mjs', () => 'throw new Error("MUST_NOT_EXECUTE");'));
test('staged executable mode refuses and index restoration passes', () => {
  const path = dir + 'contract.v2.json';
  try {
    execFileSync('git', ['update-index', '--chmod=+x', '--', path], { cwd: fixture });
    assert.throws(() => readCandidateScope34(fixture, 'planning'), /R34_PINNED_INDEX/);
  } finally {
    execFileSync('git', ['update-index', '--chmod=-x', '--', path], { cwd: fixture });
  }
  assert.equal(readCandidateScope34(fixture, 'planning').valid, true);
});
test('CLI is explicit, structural exit0 and external readiness exit2 with NO_GO', () => {
  for (const [args, status] of [[['--mode', 'verification'], 0], [['--mode', 'planning', '--external-readiness'], 2],
    [[], 1], [['--mode', 'runtime'], 1], [['--mode', 'planning', '--mode', 'verification'], 1], [['--approve'], 1]]) {
    const result = spawnSync(process.execPath, ['scripts/launch/candidate-scope34.mjs', ...args], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, status, result.stdout + result.stderr);
    const value = JSON.parse(result.stdout);
    assert.equal(value.release, 'NO_GO');
    assert.equal(value.acceptanceGranted, false);
  }
});
