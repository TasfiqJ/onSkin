import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parseDocument } from 'yaml';

const source = readFileSync(new URL('../../../.github/workflows/campaign47-native-runtime.yml', import.meta.url), 'utf8');
const scope = "github.repository == 'TasfiqJ/onSkin' && github.event.repository.private == false && github.event.pull_request.head.repo.full_name == 'TasfiqJ/onSkin' && github.event.pull_request.head.ref == 'stage/m1-native-runtime47'";
const expression = value => '${{ ' + value + ' }}';
const dependencies = { build: [], normal: ['build'], internal: ['build', 'normal'] };

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
  assert.deepEqual(Object.keys(w.jobs), ['native-build', 'native-normal', 'native-internal']);
  for (const [role, parents] of Object.entries(dependencies)) {
    const job = w.jobs['native-' + role];
    assert.equal(job.name, 'C47 ' + role);
    assert.deepEqual(job.needs, parents.length ? parents.map(parent => 'native-' + parent) : undefined);
    assert.deepEqual(job.permissions, parents.length ? { contents: 'read', actions: 'read' } : undefined);
    assert.equal(job['runs-on'], 'macos-26-intel');
    assert.equal(job['timeout-minutes'], 90);
    assert.equal(job.if, scope);
    assert.equal(job.steps.length, 5);
    assert.deepEqual(job.outputs, {
      artifact_id: expression('steps.upload.outputs.artifact-id'),
      artifact_digest: expression('steps.upload.outputs.artifact-digest'),
      payload_bytes: expression('steps.evidence-budget.outputs.payload_bytes'),
      run_id: expression('github.run_id'), run_attempt: expression('github.run_attempt'),
    });
    assert.deepEqual(job.steps.filter(s => s.uses).map(s => s.uses), [
      'actions/checkout@9f698171ed81b15d1823a05fc7211befd50c8ae0',
      'actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e',
      'actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02',
    ]);
    assert.deepEqual(job.steps[0].with, { ref: expression('github.event.pull_request.head.sha'), 'fetch-depth': 0, 'persist-credentials': false });
    assert.deepEqual(job.steps[1].with, { 'node-version': '22.22.2', 'package-manager-cache': false });
    const env = { C47_EXPECTED_HEAD: expression('github.event.pull_request.head.sha'), C47_UI_PHASE: 'normal-staging' };
    if (parents.length) env.C47_ARTIFACT_READ_TOKEN = expression('github.token');
    for (const parent of parents) {
      for (const [key, output] of [['ARTIFACT_ID', 'artifact_id'], ['ARTIFACT_DIGEST', 'artifact_digest'], ['RUN_ID', 'run_id'], ['RUN_ATTEMPT', 'run_attempt'], ['PAYLOAD_BYTES', 'payload_bytes']]) {
        env['C47_' + parent.toUpperCase() + '_' + key] = expression("needs['native-" + parent + "'].outputs." + output);
      }
    }
    assert.deepEqual(job.steps[2].env, env);
    assert.equal(job.steps[2].run, 'python3 -I -B scripts/release/full-app-j01/native_runtime47.py --stage ' + role + ' --output "$RUNNER_TEMP/c47-evidence"');
    const budget = job.steps[3];
    assert.equal(budget.id, 'evidence-budget');
    assert.equal(budget.if, 'always()');
    assert.match(budget.run, /total \+ reserved <= 500 \* 1024 \* 1024/);
    assert.match(budget.run, /EVIDENCE_LINK_OR_SPECIAL_FILE/);
    assert.match(budget.run, /upstream_payload_bytes/);
    assert.match(budget.run, /GITHUB_OUTPUT/);
    const upload = job.steps[4];
    assert.equal(upload.id, 'upload');
    assert.equal(upload.if, "always() && steps.evidence-budget.outcome == 'success'");
    assert.equal(upload.with['retention-days'], 3);
    assert.equal(upload.with['if-no-files-found'], 'error');
    assert.equal(upload.with['compression-level'], 0);
    assert.equal(upload.with.path, expression('runner.temp') + '/c47-evidence');
    assert.equal(upload.with.name, 'campaign47-native-' + role + '-' + expression('github.event.pull_request.head.sha') + '-' + expression('github.run_id') + '-' + expression('github.run_attempt'));
    for (const step of job.steps) {
      if (step.uses) assert.match(step.uses, /^[^@\s]+@[0-9a-f]{40}$/);
      assert.equal(Object.hasOwn(step, 'continue-on-error'), false);
    }
  }
  assert.doesNotMatch(text, /pull_request_target|secrets\.|CODE_SIGNING_ALLOWED=YES|eas (?:build|submit)|\n\s+cache:/);
}

test('C47 hosted stages stay exact-source, unsigned, finite and sequential on one Mac', () => validate(source));
test('C47 rejects privilege, source substitution, paid runner and ignored failures', () => {
  for (const [before, after] of [
    ['contents: read', 'contents: write'], ['macos-26-intel', 'macos-26-large'],
    ['macos-26-intel', 'macos-26-xlarge'], ['macos-26-intel', 'macos-26'],
    ['timeout-minutes: 90', 'timeout-minutes: 0'], ['cancel-in-progress: false', 'cancel-in-progress: true'],
    ["head.ref == 'stage/m1-native-runtime47'", "head.ref != ''"], ['persist-credentials: false', 'persist-credentials: true'],
    ['github.event.repository.private == false', 'github.event.repository.private == true'],
    ['package-manager-cache: false', 'package-manager-cache: true'],
    ['${{ github.event.pull_request.head.sha }}', '${{ github.sha }}'],
    ['retention-days: 3', 'retention-days: 90'], ['if-no-files-found: error', 'if-no-files-found: warn'],
  ]) {
    assert.ok(source.includes(before));
    assert.throws(() => validate(source.replaceAll(before, after)), before);
  }
});
test('C47 refuses parallel stages, missing wire digest or authority outside the producing jobs', () => {
  for (const [before, after] of [
    ['needs: [native-build]', 'needs: []'], ['needs: [native-build, native-normal]', 'needs: [native-build]'],
    ['actions: read', 'actions: write'], ['steps.upload.outputs.artifact-digest', 'steps.upload.outputs.artifact-id'],
    ["needs['native-build'].outputs.artifact_digest", "github.sha"],
    ['--stage normal', '--stage build'], ['upstream_payload_bytes', 'ignored_upstream_bytes'],
    ['compression-level: 0', 'compression-level: 9'],
  ]) {
    assert.ok(source.includes(before));
    assert.throws(() => validate(source.replaceAll(before, after)), before);
  }
});
