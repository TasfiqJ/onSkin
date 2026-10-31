import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { lstatSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

export const BASE33 = 'cbbb5a83bd29d2833399c214f5b6c6dd14873d24';
export const TREE33 = '0745ad5f5595724a9b26de64324065dc3e53d2ea';
export const PLAN33 = '4e9c20e7502e51750ac85a1227f7151c7334e2bb';
export const AUTHORITY33 = 'BRAIN-M1X-MASTERV2-FULLAPP-J01-SCOPE-CUTOVER33-CANDIDATE-01';
export const ROOT33 = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const D = 'docs/release/full-app-j01/';
const F = Array.from({ length: 20 }, (_, i) => `F${String(i + 1).padStart(2, '0')}`);
const C = Array.from({ length: 12 }, (_, i) => `V2-C${String(i + 1).padStart(2, '0')}`);
const P = Array.from({ length: 6 }, (_, i) => `P${String(i + 1).padStart(2, '0')}`);
const J = Array.from({ length: 27 }, (_, i) => `J${String(i + 1).padStart(2, '0')}`);
export const REQUIRED33 = Object.freeze([...F.filter((i) => i !== 'F18'), ...C, ...P, 'J01']);
export const DEFERRED33 = Object.freeze(['F18', ...J.slice(1)]);
const FILES = ['contract.v2.json', 'matrix.v2.json', 'precedence.v2.json', 'roadmap.v2.json', 'owner-ledger33.v1.json'];
const PINS = {
  'contract.v1.json': '017635909e410d567879be077909bbccc049960f500b52a648a2af2dc1427996',
  'matrix.v1.json': '3b3fd0bba1c668358326658f8a4dedeab7239ba8d0221dc01f415f506c080fe3',
  'precedence.v1.json': '330804dfc5d3e83c5f7da83aeb53a003b3d68c2cecc8935afc9edd1cbc7a5ec8',
  'roadmap.v1.json': '35ea2bdb913ec62127765108c0e4484a2b9e78914b7f073a20040f8fc3a4d0da',
  'history-crosswalk.v1.json': '2a4018895dc74fda87b265df22ff9aee2468a8ab49de41f39186bc42614563f3',
  'historical/roadmap_47.json': '7b6c4772e891babd310b40c421d036c91a51b340b5485448e7aa99d1b499fb39',
  'historical/adr_registry_51.json': '2f910cf0cd0c473474141ff81bb7d639f2fba8bc10dc306b52243d5e52b215c1',
};
const FALSE_FIELDS = ['acceptanceGranted', 'candidateReady', 'productReady', 'providerReady', 'paidReady', 'professionalReady', 'j01Qualified'];
const DB_ACCEPTANCE = 'DB06/DB08/R2B qualified owner exact-environment admission remains absent; hosted canonical technical success is separate evidence';

function need(ok, code) { if (!ok) throw new Error(code); }
function same(value, expected, code) { need(isDeepStrictEqual(value, expected), code); }
function keys(value, expected, code) {
  need(value && typeof value === 'object' && !Array.isArray(value), code);
  same(Object.keys(value).sort(), [...expected].sort(), code);
}
function text(value, code) { need(typeof value === 'string' && value.trim().length > 0, code); }
const sha256 = (raw) => createHash('sha256').update(raw).digest('hex');
const blob = (raw) => createHash('sha1').update(`blob ${raw.length}\0`).update(raw).digest('hex');

// JSON.parse alone discards duplicate keys. This bounded parser refuses them,
// non-finite numbers, trailing data and excessive nesting before validation.
export function parseStrict33(raw) {
  need(typeof raw === 'string' && Buffer.byteLength(raw) <= 2 * 1024 * 1024, 'R33_JSON_SIZE');
  let at = 0;
  const ws = () => { while (/[\t\n\r ]/u.test(raw[at] ?? '') && at < raw.length) at++; };
  function value(depth = 0) {
    need(depth < 64, 'R33_JSON_DEPTH'); ws();
    if (raw[at] === '"') {
      const token = /^"(?:[^"\\\u0000-\u001f]|\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4}))*"/u.exec(raw.slice(at));
      need(token, 'R33_JSON_STRING'); at += token[0].length; return JSON.parse(token[0]);
    }
    if (raw[at] === '{' || raw[at] === '[') {
      const object = raw[at++] === '{'; const result = object ? {} : []; const seen = new Set();
      const close = object ? '}' : ']'; ws();
      if (raw[at] === close) { at++; return result; }
      while (at < raw.length) {
        if (object) {
          need(raw[at] === '"', 'R33_JSON_KEY'); const key = value(depth + 1); ws();
          need(!seen.has(key) && !['__proto__', 'constructor', 'prototype'].includes(key), 'R33_JSON_DUPLICATE');
          seen.add(key); need(raw[at++] === ':', 'R33_JSON_COLON'); result[key] = value(depth + 1);
        } else result.push(value(depth + 1));
        ws(); if (raw[at] === close) { at++; return result; }
        need(raw[at++] === ',', 'R33_JSON_SEPARATOR'); ws();
      }
      need(false, 'R33_JSON_TRUNCATED');
    }
    const token = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/u.exec(raw.slice(at));
    need(token, 'R33_JSON_VALUE'); at += token[0].length; const result = JSON.parse(token[0]);
    need(typeof result !== 'number' || Number.isFinite(result), 'R33_JSON_NONFINITE'); return result;
  }
  const result = value(); ws(); need(at === raw.length, 'R33_JSON_TRAILING'); return result;
}

function regular(root, path) {
  need(typeof path === 'string' && /^[A-Za-z0-9_.@/()[\] -]+$/u.test(path) &&
    !path.startsWith('/') && path.split('/').every((p) => p && p !== '.' && p !== '..' && p === p.trim() && !p.endsWith('.')), 'R33_SOURCE_PATH');
  let target = resolve(root); const rootStat = lstatSync(target);
  need(rootStat.isDirectory() && !rootStat.isSymbolicLink(), 'R33_SOURCE_LINK');
  const parts = path.split('/');
  for (const part of parts.slice(0, -1)) {
    target = join(target, part); const info = lstatSync(target);
    need(info.isDirectory() && !info.isSymbolicLink(), 'R33_SOURCE_LINK');
  }
  target = join(target, parts.at(-1)); const before = lstatSync(target);
  need(before.isFile() && !before.isSymbolicLink() && before.nlink === 1 && before.size <= 2 * 1024 * 1024, 'R33_SOURCE_REGULAR');
  const raw = readFileSync(target); const after = lstatSync(target);
  same([before.dev, before.ino, before.size, before.mtimeMs, before.ctimeMs],
    [after.dev, after.ino, after.size, after.mtimeMs, after.ctimeMs], 'R33_SOURCE_CHANGED');
  return raw;
}
function git(root, ...args) {
  need(!Object.keys(process.env).some((k) => /^GIT_(?:DIR|WORK_TREE|INDEX_FILE|OBJECT_DIRECTORY|ALTERNATE_OBJECT_DIRECTORIES|REPLACE_REF_BASE|NAMESPACE|CONFIG.*|EXEC_PATH|SHALLOW_FILE|GRAFT_FILE)$/u.test(k)), 'R33_GIT_ENV');
  return execFileSync('git', ['--no-replace-objects', '-c', 'core.hooksPath=', '-c', 'core.fsmonitor=false', ...args],
    { cwd: root, maxBuffer: 16 * 1024 * 1024, windowsHide: true });
}
export function loadBundle33(root = ROOT33) {
  const decoder = new TextDecoder('utf-8', { fatal: true });
  return Object.fromEntries(FILES.map((name) => [name, parseStrict33(decoder.decode(regular(root, D + name)))]));
}

export function validateBundle33(bundle, root = ROOT33) {
  keys(bundle, FILES, 'R33_BUNDLE_FILES');
  const pinned = Object.fromEntries(Object.entries(PINS).map(([name, digest]) => {
    const raw = regular(root, D + name); need(sha256(raw) === digest, 'R33_HISTORICAL_BYTES');
    return [name, parseStrict33(raw.toString('utf8'))];
  }));
  need(git(root, 'rev-parse', BASE33 + '^{tree}').toString().trim() === TREE33, 'R33_BASE_TREE');
  const tree = new Map(git(root, 'ls-tree', '-rz', '--full-tree', BASE33).toString('utf8').split('\0').filter(Boolean).map((line) => {
    const [header, path] = line.split('\t'); return [path, header.split(' ')];
  }));
  const checked = new Map();
  function witness(ref, allowCurrentChange = false) {
    keys(ref, ['path', 'source_commit', 'blob', 'mode', 'sha256'], 'R33_SOURCE_REF_SCHEMA');
    need(ref.source_commit === BASE33 && ref.mode === '100644' && /^[0-9a-f]{40}$/u.test(ref.blob) && /^[0-9a-f]{64}$/u.test(ref.sha256), 'R33_SOURCE_REF');
    same(tree.get(ref.path), [ref.mode, 'blob', ref.blob], 'R33_SOURCE_BLOB');
    const cacheKey = `${allowCurrentChange}:${ref.path}`;
    if (!checked.has(cacheKey)) checked.set(cacheKey, allowCurrentChange ? git(root, 'show', BASE33 + ':' + ref.path) : regular(root, ref.path));
    const raw = checked.get(cacheKey);
    need(blob(raw) === ref.blob && sha256(raw) === ref.sha256, 'R33_SOURCE_HASH');
  }

  const [c, m, p, dag, owner] = FILES.map((n) => bundle[n]);
  const c0 = pinned['contract.v1.json']; const m0 = pinned['matrix.v1.json'];
  const p0 = pinned['precedence.v1.json']; const dag0 = pinned['roadmap.v1.json']; const hist = pinned['history-crosswalk.v1.json'];
  const gates = structuredClone(c0.gates);
  for (const g of gates) {
    if (g.id === 'DB') { g.status = 'NOT_ACCEPTED'; g.acceptance = DB_ACCEPTANCE; }
    if (['G1', 'G4'].includes(g.id)) g.status = 'NOT_ACCEPTED';
  }
  const expected = { ...structuredClone(c0), schema_version: 2, contract_id: 'onskin-full-app-j01-campaign33-v2',
    proposal_status: 'SOURCE_CANDIDATE_REVIEW_REQUIRED', authorization: AUTHORITY33, source_base: BASE33, source_base_tree: TREE33,
    gates, acceptanceGranted: false, release_status: 'NO_GO', candidateReady: false, productReady: false,
    providerReady: false, paidReady: false, professionalReady: false, j01Qualified: false,
    plan_commit: PLAN33, source_scope: 'CURRENT_PR35_SOURCE_OBLIGATIONS_ONLY_NOT_RUNTIME_ADMISSION' };
  Object.assign(expected.diary, { encrypted: true, capture: true, timeline: true, notes: true, deletion: true });
  same(c, expected, 'R33_CONTRACT_SCOPE_OR_ADMISSION');
  same([...c.required_f, ...c.required_c, ...c.required_p, ...c.korean_candidates], REQUIRED33, 'R33_REQUIRED_IDS');
  same([...c.deferred_f, ...c.deferred_j], DEFERRED33, 'R33_DEFERRED_IDS');

  keys(m, ['schema_version', 'observed_source', 'observed_tree', 'row_count', 'required_count', 'deferred_count', 'rows', 'receipts', 'history', 'acceptanceGranted', 'release'], 'R33_MATRIX_SCHEMA');
  need(m.schema_version === 2 && m.observed_source === BASE33 && m.observed_tree === TREE33 && m.row_count === 65 && m.required_count === 38 && m.deferred_count === 27 && m.acceptanceGranted === false && m.release === 'NO_GO', 'R33_MATRIX_COUNTS');
  same(m.rows.map((r) => r.id), [...F, ...C, ...P, ...J], 'R33_MATRIX_BIJECTION');
  need(m.receipts.length === 1, 'R33_RECEIPT_INVENTORY');
  const receipt = m.receipts[0];
  keys(receipt, ['id', 'head', 'tree', 'command', 'status', 'exit_code', 'started_at', 'log_sha256', 'log_bytes', 'mobile_test_files', 'mobile_tests', 'operator_test_files', 'operator_tests', 'turbo_cache_hits', 'node', 'npm', 'qualified_acceptance', 'provenance'], 'R33_RECEIPT_SCHEMA');
  // The immutable plan independently records this supplier log hash. The raw
  // log is in the return packet; neither it nor these fields is owner evidence.
  const plan = regular(root, 'docs/brain/task-specs/M1X-33/SCOPE_PLAN.md');
  const receiptLine = /^\| baseline-mobile-operator-all \| 0 \| 0 \| `([0-9a-f]{64})` \|$/mu.exec(plan.toString());
  need(sha256(plan) === 'd7b3675e1d6b81fca233eed8099157ccf9f31a8855b27305fdd6c2b65a5855ce' && receiptLine && receipt.log_sha256 === receiptLine[1], 'R33_RECEIPT_PLAN_ANCHOR');
  const granted = new Set([...plan.toString().matchAll(/^\d+\. `([^`]+)`$/gmu)].map((x) => x[1]));
  need(granted.size === 33, 'R33_PLAN_GRANT');
  need(receipt.id === 'PR35-ALL-TESTS' && receipt.head === BASE33 && receipt.tree === TREE33 && receipt.status === 'PASS_SOURCE_ONLY' && receipt.exit_code === 0 &&
    receipt.mobile_test_files === 499 && receipt.mobile_tests === 6478 && receipt.operator_test_files === 7 && receipt.operator_tests === 24 && receipt.turbo_cache_hits === 0 &&
    receipt.node === '22.21.0' && receipt.npm === '11.20.0' && receipt.qualified_acceptance === false &&
    receipt.provenance === 'SUPPLIER_EXECUTED_CURRENT_PR35_NOT_INDEPENDENT_BRAIN_OR_OWNER' &&
    /^[0-9a-f]{64}$/u.test(receipt.log_sha256) && Number.isSafeInteger(receipt.log_bytes) && receipt.log_bytes > 0 &&
    Number.isFinite(Date.parse(receipt.started_at)), 'R33_RECEIPT_PROVENANCE');
  same(receipt.command, ['npm', 'test', '--', '--force'], 'R33_RECEIPT_COMMAND');
  const aliasOwners = new Map([...F, ...C, ...P, ...J].map((id) => [id, id]));
  for (const [index, r] of m.rows.entries()) {
    const old = m0.rows[index]; const i = r.id;
    keys(r, [...Object.keys(old), 'historical_source_maturity', 'aliases', 'verified_portion', 'next_engineering_action', 'implementation_credit', 'owner_admitted'], 'R33_ROW_SCHEMA');
    for (const key of ['id', 'name', 'kind', 'legacy_ids', 'disposition', 'status', 'related_ids', 'acceptance_behavior', 'gates', 'owner_roles']) same(r[key], old[key], 'R33_ROW_IDENTITY_OR_GATE');
    same(r.aliases, old.legacy_ids.filter((a) => a !== i), 'R33_ALIASES');
    for (const alias of r.aliases) { need(!aliasOwners.has(alias), 'R33_DUPLICATE_ALIAS'); aliasOwners.set(alias, i); }
    need(r.complete === false && r.positive_output_enabled === false && r.owner_admitted === false, 'R33_NO_ROW_COMPLETION');
    same(r.historical_source_maturity, old.source_maturity, 'R33_HISTORICAL_MATURITY');
    const tested = F.includes(i) && !['F01', 'F18'].includes(i);
    same(r.source_maturity, i === 'J01' ? 'UNKNOWN' : tested ? 'SOURCE_TESTED_UNQUALIFIED' : 'SOURCE_CANDIDATE', 'R33_MATURITY_EVIDENCE');
    same(r.evidence_axes, { source: r.source_maturity, integration: tested ? 'PASS_SOURCE_ONLY' : 'NOT_RUN', device: 'NOT_RUN', qualified_review: 'NOT_RUN', provider: 'NOT_RUN', professional: 'NOT_RUN', rights: 'NOT_ACCEPTED', public_release: 'NOT_AUTHORIZED' }, 'R33_EXTERNAL_AXES');
    need(r.implementation_credit === 'REUSE_SHARED_WORKSTREAM_NOT_AN_ADDITIONAL_FEATURE_IMPLEMENTATION' && r.delivery_node === old.delivery_node.replace('R08-', 'R33-'), 'R33_OVERLAP_CREDIT');
    text(r.verified_portion, 'R33_PORTION'); text(r.next_engineering_action, 'R33_GAP');
    need(Array.isArray(r.gaps) && r.gaps.length >= 2 && r.gaps[0] === r.next_engineering_action, 'R33_GAPS');
    need(Array.isArray(r.source_refs) && r.source_refs.length > 0 && new Set(r.source_refs.map((x) => x.path)).size === r.source_refs.length, 'R33_ROW_SOURCE_INVENTORY');
    for (const ref of old.source_refs) need(r.source_refs.some((x) => x.path === ref.path), 'R33_DROPPED_SOURCE');
    r.source_refs.forEach((x) => witness(x));
    need(Array.isArray(r.evidence_receipts) && (tested ? r.evidence_receipts.length > 0 : r.evidence_receipts.length === 0), 'R33_ROW_TEST_EVIDENCE');
    const testPaths = new Set();
    for (const e of r.evidence_receipts) {
      keys(e, ['receipt_id', 'test_path', 'test_count', 'log_line', 'status', 'proves'], 'R33_TEST_RECEIPT_SCHEMA');
      need(e.receipt_id === receipt.id && e.status === 'PASS_SOURCE_ONLY' && Number.isSafeInteger(e.test_count) && e.test_count > 0 && !testPaths.has(e.test_path), 'R33_TEST_RECEIPT');
      testPaths.add(e.test_path);
      need(r.source_refs.some((x) => x.path === e.test_path) && /\.test\.tsx?$/u.test(e.test_path), 'R33_TEST_SOURCE');
      const relative = e.test_path.replace(/^apps\/(?:mobile|catalog-operator-console)\//u, '');
      need(typeof e.log_line === 'string' && e.log_line.includes(`✓ ${relative} (${e.test_count} test`) && e.proves === 'Only the synthetic/source behavior in this exact test file; not full row acceptance', 'R33_TEST_LOG_LINE');
    }
    if (i.startsWith('J')) same(r.historical_registry, old.historical_registry, 'R33_J_REGISTRY');
  }
  const f09 = m.rows.find((r) => r.id === 'F09');
  for (const name of ['encryptedStorage', 'manualCompare20', 'timeline', 'photoNoteSaveCoordinator', 'photoDeleteJournal'])
    need(f09.source_refs.some((x) => x.path === `apps/mobile/src/features/photos/${name}.ts`), 'R33_F09_MANUAL_HISTORY');
  keys(m.history, ['source_ref', 'task_records', 'adr_records', 'snapshot_refs', 'original_anchor', 'new_acceptance'], 'R33_HISTORY_SCHEMA');
  need(m.history.new_acceptance === false && m.history.original_anchor === hist.packet_manifest_anchor && m.history.source_ref.path === D + 'history-crosswalk.v1.json', 'R33_HISTORY_AUTHORITY');
  witness(m.history.source_ref);
  for (const [key, oldKey, count] of [['task_records', 'task_rows', 47], ['adr_records', 'adr_rows', 51]]) {
    const fields = ['id', 'original_status', 'packet_record_sha256', 'live_record_sha256', 'disposition'];
    same(m.history[key], hist[oldKey].map((r) => Object.fromEntries(fields.map((k) => [k, r[k]]))), 'R33_HISTORY_RECORDS');
    need(m.history[key].length === count, 'R33_HISTORY_COUNTS');
  }
  same(m.history.snapshot_refs.map((x) => x.path), [D + 'historical/roadmap_47.json', D + 'historical/adr_registry_51.json'], 'R33_HISTORY_SNAPSHOTS');
  m.history.snapshot_refs.forEach((x) => witness(x));

  keys(p, ['schema_version', 'status', 'product_contract', 'evaluated_source', 'evaluated_tree', 'plan_commit', 'source_validity', 'order', 'supersedes_product_scope', 'preserves', 'activation', 'legacy_technical_guard', 'cutover', 'source_anchors', 'acceptanceGranted', 'release'], 'R33_PRECEDENCE_SCHEMA');
  need(p.schema_version === 2 && p.status === 'SOURCE_CANDIDATE_REVIEW_REQUIRED' && p.product_contract === 'contract.v2.json' && p.evaluated_source === BASE33 && p.evaluated_tree === TREE33 && p.plan_commit === PLAN33 && p.acceptanceGranted === false && p.release === 'NO_GO', 'R33_EXPIRED_SOURCE_PRECEDENCE');
  same(p.source_validity, { kind: 'EXACT_PINNED_SOURCE_INTERVAL', status: 'CURRENT_FOR_PINNED_BASE_ONLY', expires_on: 'PARENT_DRIFT_OR_UNGRANTED_SUCCESSOR', security_expiry_unchanged: '2026-10-21T00:00:00Z' }, 'R33_PRECEDENCE_EXPIRY');
  for (const k of ['order', 'supersedes_product_scope', 'preserves', 'legacy_technical_guard']) same(p[k], p0[k], 'R33_PRECEDENCE_BOUNDARY');
  need(p.activation === 'NONE; VERSIONED_PRODUCT_SCOPE_IS_NOT_A_RUNTIME_FEATURE_FLAG', 'R33_NO_ACTIVATION');
  const cut = p.cutover;
  keys(cut, ['status', 'remaining', 'ci_wired', 'runtime_consumers_migrated', 'full_cutover_complete', 'adopted_consumers', 'selector', 'historical_consumer_count', 'orientation_claimed_count', 'consumers', 'unapplied_paths', 'next_decision'], 'R33_CUTOVER_SCHEMA');
  need(cut.status === 'PARTIAL_CONSUMER_CUTOVER' && cut.remaining === 'CUTOVER_OPEN_REQUIRED' && cut.ci_wired === true && cut.runtime_consumers_migrated === false && cut.full_cutover_complete === false && cut.selector === '--scope full-app-j01-v2' && cut.historical_consumer_count === 37 && cut.orientation_claimed_count === 40, 'R33_NO_FAKE_CUTOVER');
  same(cut.adopted_consumers, ['scripts/launch/check-contract.mjs', '.github/workflows/quality.yml'], 'R33_ADOPTED_CONSUMERS');
  same(cut.consumers.map((x) => x.historical_ref), p0.cutover.consumers, 'R33_HISTORICAL_CONSUMERS');
  same(cut.unapplied_paths, cut.consumers.map((x) => x.path), 'R33_OMITTED_CONSUMERS');
  for (const x of cut.consumers) {
    keys(x, ['path', 'historical_ref', 'exists_at_pr35', 'mode', 'blob', 'classification', 'in_finite_grant', 'migrated', 'decision', 'reason'], 'R33_CONSUMER_SCHEMA');
    need(x.historical_ref.endsWith(':' + x.path) && x.exists_at_pr35 === true && x.migrated === false && x.decision === 'RETAIN_LEGACY_TECHNICAL_GUARD' && x.in_finite_grant === granted.has(x.path), 'R33_CONSUMER_STATE');
    same(tree.get(x.path), [x.mode, 'blob', x.blob], 'R33_CONSUMER_IDENTITY'); text(x.reason, 'R33_CONSUMER_REASON');
    need(['PROTECTED_CUSTODY_REFERENCE_NOT_OPENED', 'TEST_OR_HISTORICAL_READER', 'RUNTIME_OR_TOOLING_READER', 'PROVENANCE_INVENTORY_REFERENCE'].includes(x.classification), 'R33_CONSUMER_CLASS');
  }
  same(p.source_anchors.map((x) => x.path), [D + 'contract.v1.json', D + 'matrix.v1.json', D + 'precedence.v1.json', D + 'roadmap.v1.json',
    D + 'history-crosswalk.v1.json', 'docs/hugeToDo/launch-contract.json', 'scripts/launch/contract.mjs',
    'scripts/launch/check-contract.mjs', 'scripts/launch/contract-smoke.mjs', 'scripts/release/full-app-j01/check.py',
    'scripts/release/full-app-j01/main_integration32.py', '.github/workflows/quality.yml'], 'R33_ANCHOR_INVENTORY');
  p.source_anchors.forEach((x) => witness(x, true));
  need(regular(root, '.github/workflows/quality.yml').toString().includes('main_integration33.py') && regular(root, 'scripts/launch/check-contract.mjs').toString().includes('full-app-j01-v2'), 'R33_CI_SELECTOR_WIRING');

  keys(dag, ['schema_version', 'status', 'observed_source', 'nodes', 'tasks', 'protected_dependencies', 'j05_measurement_enabled', 'removed_priority_predecessor', 'j01_change_requires', 'public_date', 'acceptanceGranted', 'release', 'next_engineering_tranche'], 'R33_ROADMAP_SCHEMA');
  need(dag.schema_version === 2 && dag.status === 'ACTIONABLE_PLAN_NOT_IMPLEMENTATION_ISSUANCE' && dag.observed_source === BASE33 && dag.j05_measurement_enabled === false && dag.removed_priority_predecessor === 'M3-02' && dag.j01_change_requires === 'G4' && dag.public_date === null && dag.acceptanceGranted === false && dag.release === 'NO_GO', 'R33_ROADMAP_AUTHORITY');
  const nodes = dag0.nodes.map((n) => ({ ...n, historical_node: n.id, id: n.id.replace('R08-', 'R33-'), depends_on: n.depends_on.map((x) => x.replace('R08-', 'R33-')), status: 'PLANNED_NOT_AUTHORIZED', source_preparation: 'DESIGN_AND_GAP_PACKET_ONLY' }));
  same(dag.nodes, nodes, 'R33_ROADMAP_DEPENDENCIES'); same(dag.protected_dependencies, dag0.protected_dependencies, 'R33_M103_M2');
  same(dag.nodes.flatMap((n) => n.owns).sort(), [...REQUIRED33].sort(), 'R33_DOUBLE_COUNTED_IMPLEMENTATION');
  same(dag.tasks.map((t) => t.obligation), REQUIRED33, 'R33_TASK_BIJECTION');
  for (const t of dag.tasks) {
    keys(t, ['id', 'obligation', 'workstream', 'action', 'dependencies', 'gates', 'owner_roles', 'acceptance', 'evidence_needed', 'status', 'implementation_authorized'], 'R33_TASK_SCHEMA');
    const r = m.rows.find((x) => x.id === t.obligation); const node = nodes.find((n) => n.id === r.delivery_node);
    need(t.id === 'BUILD-' + r.id && t.workstream === node.id && t.action === r.next_engineering_action && t.acceptance === r.acceptance_behavior && t.status === 'OPEN_REQUIRED' && t.implementation_authorized === false, 'R33_TASK_NOT_ADMISSION');
    same(t.dependencies, node.depends_on, 'R33_TASK_DEPENDENCY'); same(t.gates, r.gates, 'R33_TASK_GATES'); same(t.owner_roles, r.owner_roles, 'R33_TASK_OWNERS');
    need(Array.isArray(t.evidence_needed) && t.evidence_needed.length === 3 && t.evidence_needed.every((x) => typeof x === 'string' && x.length > 0), 'R33_TASK_EVIDENCE');
  }
  const next = dag.next_engineering_tranche;
  keys(next, ['id', 'status', 'order', 'first_paths', 'parallel_documentary_work'], 'R33_NEXT_GRANT_SCHEMA');
  need(next.id === 'PROTECTED_SCOPE_READER_ADOPTION_NEXT' && next.status === 'UNAPPLIED_REQUIRES_INDEPENDENT_BRAIN_GRANT' &&
    Array.isArray(next.order) && next.order.length === 4 && next.order.every((x) => typeof x === 'string' && x.length > 0), 'R33_NEXT_GRANT');
  same(next.first_paths, ['apps/mobile/app.config.js', 'scripts/launch/contract.mjs', 'scripts/launch/execution-baseline.mjs',
    'scripts/brain/brain.py', 'scripts/launch/governed-evidence-chain.mjs'], 'R33_NEXT_GRANT_PATHS');
  text(next.parallel_documentary_work, 'R33_NEXT_DOCUMENTARY_WORK');
  keys(owner, ['schema_version', 'authority', 'observed_source', 'observed_tree', 'gates', 'qualified_admissions', 'technical_observations', 'gate_evidence_policy', 'acceptanceGranted', 'release'], 'R33_OWNER_SCHEMA');
  need(owner.schema_version === 1 && owner.authority === AUTHORITY33 && owner.observed_source === BASE33 && owner.observed_tree === TREE33 && owner.acceptanceGranted === false && owner.release === 'NO_GO', 'R33_OWNER_AUTHORITY');
  same(owner.gates, gates, 'R33_18_GATES_CLOSED');
  same(owner.qualified_admissions, Object.fromEntries(['DB06', 'DB08', 'R2B', 'M103', 'M2', 'NATIVE', 'J01', 'CLINICAL', 'PROVIDER', 'PAID', 'APPLE', 'PUBLIC', 'G97'].map((k) => [k, false])), 'R33_OWNER_NO_ADMISSION');
  same(owner.technical_observations, [{ kind: 'LIVE_GITHUB_JOB_METADATA', head: BASE33, run_id: 41177675611,
    status: 'SUCCESS_6_OF_6', meaning: 'Credential-free canonical DB and PG15/17 technical rehearsal only', owner_admission: false },
  { kind: 'LIVE_GITHUB_RUN_METADATA', head: BASE33, run_id: 41177675604, status: 'FAILURE',
    meaning: 'Original Security remains failed; private findings not opened', owner_admission: false }], 'R33_TECHNICAL_NOT_OWNER_EVIDENCE');
  text(owner.gate_evidence_policy, 'R33_OWNER_EVIDENCE_POLICY');
  for (const k of FALSE_FIELDS) need(c[k] === false, 'R33_NO_READINESS');
  return { valid: true, contract: c.contract_id, sourceHead: BASE33, sourceTree: TREE33,
    requiredRows: 38, deferredRows: 27, unacceptedRequiredIds: [...REQUIRED33],
    testedSourcePortionIds: m.rows.filter((r) => r.source_maturity === 'SOURCE_TESTED_UNQUALIFIED').map((r) => r.id),
    unadmittedGates: gates.map((g) => g.id), externalReady: false, candidateReady: false,
    cutover: cut.status, remaining: cut.remaining, acceptanceGranted: false, release: 'NO_GO' };
}

export function runContract33(args = process.argv.slice(2), root = ROOT33) {
  need(args.every((a) => ['--json', '--external-readiness'].includes(a)) && new Set(args).size === args.length, 'R33_CLI_ARGUMENTS');
  const result = validateBundle33(loadBundle33(root), root);
  console.log(JSON.stringify(result));
  return args.includes('--external-readiness') ? 2 : 0;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = runContract33(); }
  catch (error) { console.log(JSON.stringify({ valid: false, error: /^R33_[A-Z_]+$/u.test(error.message) ? error.message : 'R33_EXECUTION_INCOMPLETE', acceptanceGranted: false, release: 'NO_GO' })); process.exitCode = 1; }
}
