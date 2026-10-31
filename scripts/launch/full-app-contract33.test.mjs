import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { BASE33, TREE33, REQUIRED33, loadBundle33, parseStrict33, ROOT33, validateBundle33 } from './full-app-contract33.mjs';

const original = loadBundle33();
const contract = (b) => b['contract.v2.json'];
const matrix = (b) => b['matrix.v2.json'];
const row = (b, id) => matrix(b).rows.find((r) => r.id === id);
const mutations = [
  ['false public GO', (b) => { contract(b).release_status = 'GO'; }],
  ['false accepted contract', (b) => { contract(b).proposal_status = 'ACCEPTED'; }],
  ['J05 Korean candidate', (b) => { contract(b).korean_candidates = ['J05']; }],
  ['second Korean candidate', (b) => { contract(b).korean_candidates.push('J05'); }],
  ['enabled deferred J05', (b) => { row(b, 'J05').positive_output_enabled = true; }],
  ['enabled deferred F18', (b) => { row(b, 'F18').positive_output_enabled = true; }],
  ['F18 required instead of F09', (b) => { contract(b).required_f[8] = 'F18'; }],
  ['dropped professional contract', (b) => { contract(b).required_p.pop(); }],
  ['dropped consumer contract', (b) => { contract(b).required_c.pop(); }],
  ['duplicate alias', (b) => { row(b, 'F03').aliases.push('onboarding_consent'); }],
  ['swapped source SHA256', (b) => { row(b, 'F09').source_refs[0].sha256 = '0'.repeat(64); }],
  ['swapped source Git blob', (b) => { row(b, 'F09').source_refs[0].blob = '0'.repeat(40); }],
  ['stale source commit', (b) => { row(b, 'F09').source_refs[0].source_commit = '0'.repeat(40); }],
  ['source traversal', (b) => { row(b, 'F09').source_refs[0].path = '../outside'; }],
  ['dropped reviewer gate', (b) => { row(b, 'F05').gates = row(b, 'F05').gates.filter((g) => g !== 'CLINICAL'); }],
  ['fake professional result', (b) => { row(b, 'P01').complete = true; }],
  ['fake professional provider test', (b) => { row(b, 'P02').evidence_axes.provider = 'PASS'; }],
  ['source test promoted to qualification', (b) => { row(b, 'F09').evidence_axes.qualified_review = 'PASS'; }],
  ['complete fallback J01', (b) => { row(b, 'J01').complete = true; }],
  ['fake J01 skin score', (b) => { contract(b).j01.claims.skin_score = true; }],
  ['fake pore count', (b) => { contract(b).j01.claims.count = true; }],
  ['fake J01 score field', (b) => { contract(b).j01.score = 83; }],
  ['J01 G4 omitted', (b) => { contract(b).j01.change_requires = ['G1', 'G2', 'G3', 'G5']; }],
  ['invented J01 dossier', (b) => { contract(b).j01.authenticated_research = ['invented']; }],
  ['unsafe reverse grant', (b) => { contract(b).offer.unsafe_custom_reverse_grant = true; }],
  ['F09 manual compare omitted', (b) => { contract(b).diary.manual_comparison = false; }],
  ['F09 replaced by automated trend', (b) => { contract(b).diary.automated_trend = true; }],
  ['F09 timeline source omitted', (b) => { row(b, 'F09').source_refs = row(b, 'F09').source_refs.filter((x) => !x.path.endsWith('/timeline.ts')); }],
  ['invented complete V2 ledger', (b) => { row(b, 'V2-C03').source_maturity = 'EXTERNALLY_ADMITTED'; }],
  ['historical task omitted', (b) => { matrix(b).history.task_records.pop(); }],
  ['historical ADR status forged', (b) => { matrix(b).history.adr_records[0].original_status = 'ACCEPTED'; }],
  ['history promoted to new acceptance', (b) => { matrix(b).history.new_acceptance = true; }],
  ['fake test owner evidence', (b) => { matrix(b).receipts[0].qualified_acceptance = true; }],
  ['forged test log hash', (b) => { matrix(b).receipts[0].log_sha256 = '0'.repeat(64); }],
  ['wrong authentic preflight log substituted for all tests', (b) => { matrix(b).receipts[0].log_sha256 = 'a78a5386841eda7e5f0f87a0851618c8c0c3f175101ce76edb406a6057aeafbf'; }],
  ['stale test source', (b) => { matrix(b).receipts[0].head = '0'.repeat(40); }],
  ['fake zero-test proof', (b) => { row(b, 'F09').evidence_receipts[0].test_count = 0; }],
  ['missing test source', (b) => { row(b, 'F09').evidence_receipts[0].test_path = 'apps/mobile/src/missing.test.ts'; }],
  ['expired source precedence', (b) => { b['precedence.v2.json'].evaluated_source = '50f25abeafaa6127e105e2a9d825e6d15dc1dcdb'; }],
  ['expired precedence status', (b) => { b['precedence.v2.json'].source_validity.status = 'EXPIRED'; }],
  ['renewed protected Security expiry', (b) => { b['precedence.v2.json'].source_validity.security_expiry_unchanged = '2030-01-01T00:00:00Z'; }],
  ['fake completed cutover', (b) => { b['precedence.v2.json'].cutover.full_cutover_complete = true; }],
  ['fake runtime migration', (b) => { b['precedence.v2.json'].cutover.runtime_consumers_migrated = true; }],
  ['omitted protected consumer', (b) => { b['precedence.v2.json'].cutover.consumers.shift(); }],
  ['invented grant for protected runtime consumer', (b) => { b['precedence.v2.json'].cutover.consumers[0].in_finite_grant = true; }],
  ['replaced required source anchor by unrelated authentic source', (b) => { b['precedence.v2.json'].source_anchors[0] = structuredClone(row(b, 'F01').source_refs[0]); }],
  ['deferred roadmap task', (b) => { b['roadmap.v2.json'].tasks[0].obligation = 'F18'; }],
  ['duplicate implementation credit', (b) => { b['roadmap.v2.json'].nodes[0].owns.push('F09'); }],
  ['source plan authorizes M2', (b) => { b['roadmap.v2.json'].tasks[0].implementation_authorized = true; }],
  ['weakened M1-03 dependency', (b) => { b['roadmap.v2.json'].protected_dependencies['M2-01'] = []; }],
  ['invented next-tranche implementation grant', (b) => { b['roadmap.v2.json'].next_engineering_tranche.implementation_authorized = true; }],
  ['owner gate missing', (b) => { b['owner-ledger33.v1.json'].gates.pop(); }],
  ['DB mechanics promoted to admission', (b) => { b['owner-ledger33.v1.json'].qualified_admissions.DB06 = true; }],
  ['owner-shaped unknown provider readiness', (b) => { b['owner-ledger33.v1.json'].providerReady = true; }],
  ['extra provider readiness inside technical observation', (b) => { b['owner-ledger33.v1.json'].technical_observations[0].providerReady = true; }],
  ['fabricated technical run identity', (b) => { b['owner-ledger33.v1.json'].technical_observations[0].run_id = 1; }],
  ['original Security failure replaced by technical success', (b) => { b['owner-ledger33.v1.json'].technical_observations[1].status = 'SUCCESS'; }],
];
for (const key of ['acceptanceGranted', 'candidateReady', 'productReady', 'providerReady', 'paidReady', 'professionalReady', 'j01Qualified'])
  mutations.push([`fabricated ${key}`, (b) => { contract(b)[key] = true; }]);
for (const gate of original['contract.v2.json'].gates)
  mutations.push([`false owner admission ${gate.id}`, (b) => { contract(b).gates.find((g) => g.id === gate.id).admitted = true; }]);
for (const id of REQUIRED33)
  mutations.push([`dropped required row ${id}`, (b) => { matrix(b).rows = matrix(b).rows.filter((r) => r.id !== id); }]);

test('current PR35 ledger is structurally valid and every qualified axis stays closed', () => {
  const result = validateBundle33(original);
  assert.equal(result.valid, true); assert.equal(result.sourceHead, BASE33); assert.equal(result.sourceTree, TREE33);
  assert.equal(result.requiredRows, 38); assert.equal(result.deferredRows, 27);
  assert.deepEqual(result.unacceptedRequiredIds, REQUIRED33);
  assert.equal(result.testedSourcePortionIds.length, 18); assert.equal(result.unadmittedGates.length, 18);
  assert.equal(result.externalReady, false); assert.equal(result.acceptanceGranted, false); assert.equal(result.release, 'NO_GO');
});
for (const [name, mutate] of mutations) {
  test(`refuses ${name}`, () => {
    const value = structuredClone(original); mutate(value);
    assert.throws(() => validateBundle33(value), /R33_/u);
  });
}
test('strict JSON rejects duplicates including escaped aliases, nonfinite, trailing and deep input', () => {
  for (const raw of ['{"a":false,"a":true}', '{"a":0,"\\u0061":1}', '{"a":NaN}', '{"a":1e999}',
    '{}true', '{"a":1,}', '[1,]', '['.repeat(65) + '0' + ']'.repeat(65)])
    assert.throws(() => parseStrict33(raw), /R33_/u);
  assert.deepEqual(parseStrict33('{"a":[false,null,-2.5e2,"ok"]}'), { a: [false, null, -250, 'ok'] });
});
test('the bounded consumer preserves default Lean V1 and exposes explicit versioned structural/readiness modes', () => {
  function run(args) {
    return spawnSync(process.execPath, ['scripts/launch/check-contract.mjs', ...args], { cwd: ROOT33, encoding: 'utf8', windowsHide: true });
  }
  const legacy = run([]); assert.equal(legacy.status, 0);
  assert.match(legacy.stdout, /Mode: lean-v1\r?\nRequired features: 10\r?\nDeferred features: 10/u);
  const structural = run(['--scope', 'full-app-j01-v2']); assert.equal(structural.status, 0);
  assert.equal(JSON.parse(structural.stdout).release, 'NO_GO');
  const external = run(['--scope', 'full-app-j01-v2', '--external-readiness']); assert.equal(external.status, 2);
  assert.equal(JSON.parse(external.stdout).externalReady, false);
  for (const args of [['--scope', 'lean-v1'], ['--scope'], ['--scope=full-app-j01-v2'], ['--external-readiness'],
    ['--scope', 'full-app-j01-v2', '--pretend-go']]) assert.notEqual(run(args).status, 0);
});
