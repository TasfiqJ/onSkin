import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parseDocument } from 'yaml';

const source = readFileSync(new URL('../../../.github/workflows/campaign47-native-runtime.yml', import.meta.url), 'utf8');

function validate(text) {
  const doc = parseDocument(text, { strict: true, uniqueKeys: true, merge: false });
  assert.deepEqual(doc.errors, []);
  assert.deepEqual(doc.warnings, []);
  const w = doc.toJS({ maxAliasCount: 0 });
  assert.deepEqual(w.on, { pull_request: { branches: ['stage/m1-app-completion46'] } });
  assert.deepEqual(w.permissions, { contents: 'read' });
  assert.deepEqual(w.concurrency, { group: 'campaign47-native-runtime', 'cancel-in-progress': false });
  assert.equal(w.env.APP_VARIANT, 'staging');
  assert.equal(w.env.EXPO_PUBLIC_APP_ENV, 'staging');
  assert.equal(w.env.IOS_WIDGET_EXTENSION_BUILD_ENABLED, 'false');
  assert.deepEqual(Object.keys(w.jobs), ['native-runtime']);
  const job = w.jobs['native-runtime'];
  assert.equal(job['runs-on'], 'macos-26-intel');
  assert.equal(job['timeout-minutes'], 90);
  assert.equal(job.if, "github.repository == 'TasfiqJ/onSkin' && github.event.repository.private == false && github.event.pull_request.head.repo.full_name == 'TasfiqJ/onSkin' && github.event.pull_request.head.ref == 'stage/m1-native-runtime47'");
  assert.equal(job.steps.length, 5);
  assert.deepEqual(job.steps.filter(s => s.uses).map(s => s.uses), [
    'actions/checkout@9f698171ed81b15d1823a05fc7211befd50c8ae0',
    'actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e',
    'actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02',
  ]);
  const checkout = job.steps[0];
  assert.deepEqual(checkout.with, { ref: '${{ github.event.pull_request.head.sha }}', 'fetch-depth': 0, 'persist-credentials': false });
  assert.equal(job.steps[1].with['node-version'], '22.22.2');
  assert.equal(job.steps[1].with['package-manager-cache'], false);
  assert.deepEqual(job.steps[2].env, { C47_EXPECTED_HEAD: '${{ github.event.pull_request.head.sha }}', C47_UI_PHASE: 'normal-staging' });
  assert.match(job.steps[2].run, /^python3 -I -B scripts\/release\/full-app-j01\/native_runtime47\.py --output "\$RUNNER_TEMP\/c47-evidence"$/);
  const budget = job.steps[3];
  assert.equal(budget.id, 'evidence-budget');
  assert.equal(budget.if, 'always()');
  assert.match(budget.run, /0 < total <= 500 \* 1024 \* 1024/);
  assert.match(budget.run, /EVIDENCE_LINK_OR_SPECIAL_FILE/);
  const upload = job.steps[4];
  assert.equal(upload.if, "always() && steps.evidence-budget.outcome == 'success'");
  assert.equal(upload.with['retention-days'], 3);
  assert.equal(upload.with['if-no-files-found'], 'error');
  assert.match(upload.with.path, /^\$\{\{ runner.temp \}\}\/c47-evidence$/);
  for (const s of job.steps) {
    if (s.uses) assert.match(s.uses, /^[^@\s]+@[0-9a-f]{40}$/);
    assert.equal(Object.hasOwn(s, 'continue-on-error'), false);
  }
  assert.doesNotMatch(text, /pull_request_target|secrets\.|CODE_SIGNING_ALLOWED=YES|eas (?:build|submit)|\n\s+cache:/);
}

test('C47 hosted execution stays exact-source, unsigned, finite and single-job', () => validate(source));
test('C47 rejects privilege, source substitution, paid runner and ignored failures', () => {
  for (const [before, after] of [
    ['contents: read', 'contents: write'],
    ['macos-26-intel', 'macos-26-large'],
    ['macos-26-intel', 'macos-26-xlarge'],
    ['macos-26-intel', 'macos-26'],
    ['timeout-minutes: 90', 'timeout-minutes: 0'],
    ['cancel-in-progress: false', 'cancel-in-progress: true'],
    ["head.ref == 'stage/m1-native-runtime47'", "head.ref != ''"],
    ['persist-credentials: false', 'persist-credentials: true'],
    ['github.event.repository.private == false', 'github.event.repository.private == true'],
    ['package-manager-cache: false', 'package-manager-cache: true'],
    ['${{ github.event.pull_request.head.sha }}', '${{ github.sha }}'],
    ['retention-days: 3', 'retention-days: 90'],
    ['if-no-files-found: error', 'if-no-files-found: warn'],
  ]) {
    assert.ok(source.includes(before));
    assert.throws(() => validate(source.replaceAll(before, after)), before);
  }
});
