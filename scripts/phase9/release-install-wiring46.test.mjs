import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { auditVerificationWiring } from './verification-wiring-contract.mjs';
import { patchExpoCollectionBounds46 } from '../release/full-app-j01/patch-expo-collection-bounds46.mjs';

const root = resolve(import.meta.dirname, '../..');
const sourcePath = 'scripts/phase9/release-smoke.mjs';
const source = readFileSync(resolve(root, sourcePath), 'utf8');
const packageRaw = readFileSync(resolve(root, 'package.json'));
const packageJson = JSON.parse(packageRaw);
const workflowText = readFileSync(resolve(root, '.github/workflows/quality.yml'), 'utf8').replace(/\r\n/gu, '\n');
const patchPath = 'scripts/release/full-app-j01/patch-expo-collection-bounds46.mjs';
const nativeInstall = 'node scripts/postinstall.mjs';
const securityInstall = `node ${patchPath}`;
const hooks = {
  postinstall: `${nativeInstall} && ${securityInstall}`,
  'postinstall:check': `${nativeInstall} --check && ${securityInstall} --check`,
};
const hash = (raw) => createHash('sha256').update(raw).digest('hex');

// Exercise the real exported auditor with the actual release-smoke contract
// declarations. Do not execute the broad live/packet-writing release sweep.
const mapLiteral = source.match(/const iosPrivacyVerifierDefinitions = (\{[\s\S]*?\n\});/u)?.[1];
const hookLiteral = source.match(/packageJson\.scripts\?\.postinstall ===\s*('(?:[^'\\]|\\.)*')/u)?.[1];
assert.ok(mapLiteral && hookLiteral, 'Actual release-smoke declarations required.');
const verifierDefinitions = JSON.parse(JSON.stringify(vm.runInNewContext(`(${mapLiteral})`)));
const expectedPostinstall = vm.runInNewContext(hookLiteral);
function audit(pkg = packageJson, workflow = workflowText) {
  const wiring = auditVerificationWiring({ packageJson: pkg, workflowText: workflow, verifierDefinitions });
  const postinstallValid = pkg.scripts.postinstall === expectedPostinstall;
  return { valid: postinstallValid && wiring.status === 'pass', postinstallValid, wiring };
}

test('release smoke changes only the two exact current hook literals from the preserved predecessor', () => {
  const original = execFileSync('git', ['--no-replace-objects', 'show',
    `deafce53190f8437867a4c969cb85b0ec8e183d5:${sourcePath}`], { cwd: root });
  let expected = original.toString('utf8');
  for (const [before, after] of [
    [`'postinstall:check': '${nativeInstall} --check',`, `'postinstall:check': '${hooks['postinstall:check']}',`],
    [`packageJson.scripts?.postinstall === '${nativeInstall}',`, `packageJson.scripts?.postinstall === '${hooks.postinstall}',`],
  ]) {
    assert.equal(expected.split(before).length, 2);
    expected = expected.replace(before, after);
  }
  assert.deepEqual(Buffer.from(source), Buffer.from(expected));
});

test('actual package and current Quality pass both actual release hook predicates', () => {
  assert.equal(packageJson.scripts.postinstall, hooks.postinstall);
  assert.equal(packageJson.scripts['postinstall:check'], hooks['postinstall:check']);
  assert.equal(expectedPostinstall, hooks.postinstall);
  assert.equal(verifierDefinitions['postinstall:check'], hooks['postinstall:check']);
  const result = audit();
  assert.equal(result.valid, true);
  assert.deepEqual(result.wiring.errors, []);
});

for (const script of ['postinstall', 'postinstall:check']) {
  const native = `${nativeInstall}${script.endsWith(':check') ? ' --check' : ''}`;
  const security = `${securityInstall}${script.endsWith(':check') ? ' --check' : ''}`;
  for (const [name, replacement] of [
    ['omitted security patch', native],
    ['omitted native patches', security],
    ['reversed patch order', `${security} && ${native}`],
    ['duplicate patch', `${native} && ${security} && ${security}`],
    ['unreviewed command', `${hooks[script]} && node unreviewed.mjs`],
    ['ignored failure', `${hooks[script]} || true`],
    ['echoed command', `echo "${hooks[script]}"`],
    ['missing hook', undefined],
  ]) test(`${script} refuses ${name}`, () => {
    const changed = structuredClone(packageJson);
    changed.scripts[script] = replacement;
    const result = audit(changed);
    assert.equal(result.valid, false);
    // Prove the intended predicate failed, not an unrelated current fixture.
    if (script === 'postinstall') {
      assert.equal(result.postinstallValid, false);
      assert.equal(result.wiring.status, 'pass');
    } else {
      assert.equal(result.postinstallValid, true);
      assert.deepEqual(result.wiring.errors, ['postinstall:check does not have the exact reviewed command definition.']);
    }
  });
}

test('the canonical native candidate binds actual package and security patch bytes without admission', () => {
  const descriptor = JSON.parse(readFileSync(resolve(root, 'docs/phase-9/ios-sdk-lock-succession46.v1.json')));
  assert.equal(descriptor.status, 'NATIVE_LOCK_SUCCESSOR_SOURCE_CANDIDATE_REVIEW_REQUIRED');
  assert.equal(descriptor.sourceBinding.independentAdmission, false);
  assert.equal(descriptor.claims.nativeAccepted, false);
  assert.equal(descriptor.claims.archiveInspected, false);
  assert.ok(Object.values(descriptor.admissions).every((value) => value === false));
  assert.equal(descriptor.release, 'NO_GO');
  assert.deepEqual(descriptor.rootPackage, { path: 'package.json', bytes: packageRaw.length, sha256: hash(packageRaw) });
  const entries = descriptor.currentSourceInputs.filter((row) => row.path === patchPath);
  assert.equal(entries.length, 1);
  const patchRaw = readFileSync(resolve(root, patchPath));
  assert.deepEqual(entries[0], { path: patchPath, bytes: patchRaw.length, sha256: hash(patchRaw) });
});

test('actual normally installed Expo copies satisfy the non-writing security patch check', () => {
  const result = patchExpoCollectionBounds46({ root, check: true });
  const lock = JSON.parse(readFileSync(resolve(root, 'package-lock.json')));
  const copies = Object.keys(lock.packages).filter((path) => path.endsWith('node_modules/@expo/cli'));
  assert.ok(copies.length > 0);
  assert.deepEqual(result, { status: 'checked', files: copies.length * 2,
    upstreamAdvisoryCleared: false, acceptanceGranted: false });
});

test('actual Quality cannot omit or condition the current native install checks', () => {
  for (const [before, after] of [
    ['          npm run postinstall:check\n', ''],
    ['      - name: Verify installed iOS native sources\n',
      '      - name: Verify installed iOS native sources\n        if: false\n'],
    ['          npm run postinstall:check\n', '          npm run postinstall:check || true\n'],
  ]) {
    assert.equal(workflowText.split(before).length, 2);
    assert.equal(audit(packageJson, workflowText.replace(before, after)).valid, false);
  }
});
