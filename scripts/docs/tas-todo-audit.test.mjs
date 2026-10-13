import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';

const sourceRoot = process.env.TAS_TODO_TEST_SOURCE_ROOT ?? process.cwd();
const paths = ['scripts/docs/tas-todo-audit.mjs', 'scripts/launch/contract.mjs', 'docs/FOR_TAS_TO_DO.md',
  'docs/MASTER_PLAN.md', 'docs/hugeToDo/launch-contract.json', 'docs/hugeToDo/IOS_LEAN_V1_EXECUTION_PLAN.md',
  'docs/hugeToDo/IOS_ALL_FEATURES_CODEX_EXECUTION_PLAN.md', 'docs/hugeToDo/LEAN_V1_SCOPE_UPDATE_2026-09-27.md'];
const registerPath = 'docs/FOR_TAS_TO_DO.md';
const planPath = 'docs/hugeToDo/IOS_LEAN_V1_EXECUTION_PLAN.md';
const oldPlanPath = 'docs/hugeToDo/IOS_ALL_FEATURES_CODEX_EXECUTION_PLAN.md';
const contractPath = 'docs/hugeToDo/launch-contract.json';
const jsonPath = 'docs/generated/tas-todo-audit.json';
const mdPath = 'docs/generated/tas-todo-audit.md';
const ids = [...Array.from({ length: 8 }, (_, i) => `H-${String(i + 1).padStart(2, '0')}`), 'V-01', 'V-02'];
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'onskin-founder-audit-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const path of paths) { const target = join(root, path); mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, readFileSync(join(sourceRoot, path))); }
  return root;
}
function run(root, flags = ['--strict'], extraEnv = {}) {
  const env = { ...process.env }; delete env.TAS_TODO_AUDIT_JSON; delete env.TAS_TODO_AUDIT_MD;
  return spawnSync(process.execPath, ['scripts/docs/tas-todo-audit.mjs', ...flags], { cwd: root, encoding: 'utf8', env: { ...env, ...extraEnv }, timeout: 10_000 });
}
function text(root, path) { return readFileSync(join(root, path), 'utf8'); }
function change(root, path, transform) { const before = text(root, path), after = transform(before); assert.notEqual(after, before, 'mutation must change its input'); writeFileSync(join(root, path), after); }
function contract(root, transform) { change(root, contractPath, (s) => { const value = JSON.parse(s); transform(value); return JSON.stringify(value); }); }
function rejected(t, mutate, sentinel = null) {
  const root = fixture(t); mutate(root);
  for (const flags of [['--strict'], ['--strict', '--check'], []]) {
    const result = run(root, flags); assert.equal(result.status, 1, result.stdout + result.stderr);
    if (sentinel) { assert.ok(!(result.stdout + result.stderr).includes(sentinel)); if (!flags.includes('--check')) assert.ok(!text(root, jsonPath).includes(sentinel)); }
  }
}

test('current lean charter produces exactly eight human and two vendor responsibilities, fourteen legacy obligations and no approvals', (t) => {
  const root = fixture(t), result = run(root); assert.equal(result.status, 0, result.stdout + result.stderr);
  const audit = JSON.parse(text(root, jsonPath));
  assert.equal(audit.status, 'pass'); assert.equal(audit.launchContract.programId, 'ios-lean-v1-2026');
  assert.equal(audit.launchContract.effectiveDate, '2026-09-27');
  assert.deepEqual(audit.requiredHumanIds, ids.slice(0, 8)); assert.deepEqual(audit.requiredVendorIds, ids.slice(8));
  assert.equal(audit.legacyObligations.length, 14); assert.equal(audit.externalEvidenceStatus, 'pending'); assert.equal(audit.releaseAuthorized, false);
  assert.ok(audit.legacyObligations.every((r) => r.evidenceStatus === 'outstanding' && r.id.startsWith('legacy:2026-07-12:')));
  const oldReview = audit.legacyObligations.find((r) => r.id.endsWith(':H-07'));
  assert.deepEqual(oldReview.currentTargets, ['lean:2026-09-27:H-02', 'lean:2026-09-27:H-03']);
  assert.ok(audit.legacyObligations.find((r) => r.id.endsWith(':H-12')).currentTargets.includes('lean:2026-09-27:H-07'));
  for (const [path, identity] of Object.entries(audit.sourceIdentities)) assert.equal(identity.sha256, createHash('sha256').update(readFileSync(join(root, path))).digest('hex'));
});

test('strict generation is byte deterministic and canonical check never writes', (t) => {
  const root = fixture(t); assert.equal(run(root).status, 0);
  const before = [text(root, jsonPath), text(root, mdPath), text(root, registerPath)];
  for (let i = 0; i < 3; i++) { assert.equal(run(root).status, 0); assert.equal(run(root, ['--strict', '--check']).status, 0); assert.deepEqual([text(root, jsonPath), text(root, mdPath), text(root, registerPath)], before); }
});

test('historical Google statement is preserved only as superseded history while current Google entry stays deferred', (t) => {
  const root = fixture(t), register = text(root, registerPath);
  assert.match(register, /Google entry, Android release, remote push and optional growth surfaces are deferred/);
  const historical = register.split('## Historical Obligation Mapping')[1];
  assert.match(historical, /Historical authentication note:.*Google OAuth for iPhone remains in scope/);
  assert.match(historical, /That statement is superseded for public V1/);
  assert.equal(register.split('Google OAuth for iPhone remains in scope').length, 2);
  assert.equal(run(root).status, 0);
});

test('separate supported output directories work without changing committed paths', (t) => {
  const root = fixture(t); const result = run(root, ['--strict'], { TAS_TODO_AUDIT_JSON: 'one/audit.json', TAS_TODO_AUDIT_MD: 'two/audit.md' });
  assert.equal(result.status, 0, result.stderr); assert.equal(JSON.parse(text(root, 'one/audit.json')).status, 'pass');
});

for (const id of ids) {
  test(`missing current ${id} fails closed`, (t) => rejected(t, (r) => change(r, registerPath, (s) => s.split('\n').filter((line) => !line.startsWith(`| ${id} |`)).join('\n'))));
  test(`duplicated current ${id} fails closed`, (t) => rejected(t, (r) => change(r, registerPath, (s) => { const row = s.split('\n').find((line) => line.startsWith(`| ${id} |`)); assert.ok(row); return s.replace(row, row + '\n' + row); })));
  test(`substituted current ${id} fails closed`, (t) => rejected(t, (r) => change(r, registerPath, (s) => s.replace(`| ${id} |`, '| H-99 |'))));
}

const mutations = [
  ['forged human approval', (r) => change(r, registerPath, (s) => s.replace('| Pending external evidence |', '| Approved |'))],
  ['forged Apple approval', (r) => change(r, registerPath, (s) => s.replace('| V-01 | Apple | Pending external evidence |', '| V-01 | Apple | Approved |'))],
  ['false release authorization', (r) => change(r, registerPath, (s) => s + '\nRelease approved; all blockers closed.\n')],
  ['misclassified professional row', (r) => change(r, registerPath, (s) => s.replace('## External Professional And Staffed-Operation Touchpoints', '## Founder Approved Reviews'))],
  ['same-number legacy substitution', (r) => change(r, registerPath, (s) => s.replace('lean:2026-09-27:H-03', 'lean:2026-09-27:H-07'))],
  ['historical obligation missing', (r) => change(r, registerPath, (s) => s.split('\n').filter((line) => !line.startsWith('| legacy:2026-07-12:H-10 |')).join('\n'))],
  ['historical obligation falsely completed', (r) => change(r, registerPath, (s) => s.replace('Outstanding; no approval supplied', 'Completed; approved'))],
  ['legacy disposition erased', (r) => change(r, registerPath, (s) => s.replace('carried-forward; deferred; outstanding', 'historical'))],
  ['independent Security waiver', (r) => change(r, registerPath, (s) => s.replace('Independent Security review remains OPEN', 'Independent Security review is waived'))],
  ['deferred catalog resurrection', (r) => change(r, registerPath, (s) => s + '\nProduction catalog and AI are required before V1.\n')],
  ['Google current-entry resurrection', (r) => change(r, registerPath, (s) => s.replace('Google entry, Android release, remote push and optional growth surfaces are deferred', 'Google entry is a required V1 launch dependency'))],
  ['Google historical qualification erased', (r) => change(r, registerPath, (s) => s.replace('That statement is superseded for public V1', 'That statement is active for public V1'))],
  ['old beta requirement resurrection', (r) => change(r, registerPath, (s) => s.replace('50–100-user mandatory beta and D14/D30 launch delay are deferred', '50–100-user mandatory beta and D14/D30 launch delay are required'))],
  ['register effective date wrong', (r) => change(r, registerPath, (s) => s.replace('Date: 2026-09-27', 'Date: 2026-07-12'))],
  ['required safety text missing', (r) => change(r, registerPath, (s) => s.replace('Never send passwords', 'Send passwords'))],
  ['malformed contract JSON', (r) => change(r, contractPath, () => '{not json')],
  ['substituted program', (r) => contract(r, (c) => { c.programId = 'ios-all-features-2026'; })],
  ['impossible contract date', (r) => contract(r, (c) => { c.effectiveDate = '2026-02-30'; })],
  ['contract date source drift', (r) => contract(r, (c) => { c.effectiveDate = '2026-09-28'; })],
  ['feature inclusion drift', (r) => contract(r, (c) => { c.requiredFeatures[0].id = 4; })],
  ['deferred feature erased', (r) => contract(r, (c) => { c.deferredFeatures.pop(); })],
  ['Android release admission', (r) => contract(r, (c) => { c.release.androidRelease = true; })],
  ['privacy admission weakened', (r) => contract(r, (c) => { c.safetyConstraints.photosLocalOnlyByDefault = false; })],
  ['current plan missing ID', (r) => change(r, planPath, (s) => s.split('\n').filter((line) => !line.startsWith('| H-03 |')).join('\n'))],
  ['current plan duplicate ID', (r) => change(r, planPath, (s) => { const row = s.split('\n').find((line) => line.startsWith('| H-03 |')); return s.replace(row, row + '\n' + row); })],
  ['current plan renamed ID', (r) => change(r, planPath, (s) => s.replace('| H-03 |', '| H-09 |'))],
  ['current plan swapped semantics', (r) => change(r, planPath, (s) => s.replace('Qualified reviewers', 'Founder alone'))],
  ['current plan substituted acceptance', (r) => change(r, planPath, (s) => s.replace('Two dated authorizations exist', 'No authorization is needed'))],
  ['current plan date drift', (r) => change(r, planPath, (s) => s.replace('Date: 2026-09-27', 'Date: 2026-09-28'))],
  ['current plan duplicate date', (r) => change(r, planPath, (s) => s + '\nDate: 2026-09-27\n')],
  ['current plan feature resurrection', (r) => change(r, planPath, (s) => s.replace('`F-03`, `F-05`', '`F-03`, `F-04`, `F-05`'))],
  ['historical date rewritten', (r) => change(r, oldPlanPath, (s) => s.replace('Date: 2026-07-12', 'Date: 2026-09-27'))],
  ['historical action erased', (r) => change(r, oldPlanPath, (s) => s.replace('Provide banking/tax information', 'Skip banking/tax information'))],
  ['Master Plan supersession drift', (r) => change(r, 'docs/MASTER_PLAN.md', (s) => s.replace('Active scope (2026-09-27)', 'Active scope (2026-09-28)'))],
  ['scope-update date drift', (r) => change(r, 'docs/hugeToDo/LEAN_V1_SCOPE_UPDATE_2026-09-27.md', (s) => s.replace('Scope Update — 2026-09-27', 'Scope Update — 2026-09-28'))],
  ['scope-update feature drift', (r) => change(r, 'docs/hugeToDo/LEAN_V1_SCOPE_UPDATE_2026-09-27.md', (s) => s.replace('`F-03` — Shelf', '`F-04` — Shelf'))],
];
for (const [name, mutate] of mutations) test(`${name} fails closed`, (t) => rejected(t, mutate));
for (const payload of ['npm run phase2:db-local-verify', 'docker pull postgres', 'supabase db push', 'psql --host live', 'git push origin main', 'PHASE9_RELEASE_AUTHORIZED=true', 'curl https://example.invalid', 'powershell Invoke-Command']) {
  test(`founder terminal/task dump ${payload.split(' ')[0]} is rejected`, (t) => rejected(t, (r) => change(r, registerPath, (s) => s + `\nFounder must execute: ${payload}\n`)));
}
for (const sentinel of ['sk_live_SYNTHETIC_SENTINEL_NEVER_REAL', 'ghp_SYNTHETIC_SENTINEL_NEVER_REAL', 'password=SYNTHETIC_SENTINEL_NEVER_REAL', '-----BEGIN PRIVATE KEY-----']) {
  test(`secret sentinel ${sentinel.split('_')[0]} is rejected without diagnostic leakage`, (t) => rejected(t, (r) => change(r, registerPath, (s) => s + '\n' + sentinel + '\n'), sentinel));
}
for (const path of [registerPath, planPath, oldPlanPath, contractPath]) test(`missing source ${path} fails closed`, (t) => rejected(t, (r) => rmSync(join(r, path))));
for (const path of [jsonPath, mdPath]) {
  for (const mode of ['missing', 'stale', 'malformed']) test(`${path} ${mode} fails canonical check without writing`, (t) => {
    const root = fixture(t); assert.equal(run(root).status, 0);
    if (mode === 'missing') rmSync(join(root, path)); else writeFileSync(join(root, path), mode === 'malformed' ? '{bad' : text(root, path) + 'tampered\n');
    const before = mode === 'missing' ? null : text(root, path);
    assert.equal(run(root, ['--strict', '--check']).status, 1);
    if (before !== null) assert.equal(text(root, path), before);
  });
}
