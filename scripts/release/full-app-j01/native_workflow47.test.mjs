import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { parseDocument } from 'yaml';

const liveSource62 = readFileSync(new URL('../../../.github/workflows/campaign47-native-runtime.yml', import.meta.url), 'utf8');
const liveSource07 = liveSource62.startsWith('# C07 diagnostic62;') ? execFileSync('git',['show','39ce16cdcadca2cbde1ba64ae7dea0f9c99de280:.github/workflows/campaign47-native-runtime.yml'],{encoding:'utf8'}) : liveSource62;
const liveSource06 = liveSource07.startsWith('# C07 fresh60-62;') ? execFileSync('git', ['show', '2e1a7135ac0142c6e6741a97734aabd5201cb250:.github/workflows/campaign47-native-runtime.yml'], { encoding: 'utf8' }) : liveSource07;
const currentSource = (liveSource06.startsWith('# C06 ordinary54-56;') || liveSource06.startsWith('# C06 recovery56-58;') || liveSource06.startsWith('# C06 observation58;') || liveSource06.startsWith('# C06 observation59;')) ? execFileSync('git', ['show', '8f68281fd13d32bf9163a1e23f4a21114e7dc66b:.github/workflows/campaign47-native-runtime.yml'], { encoding: 'utf8' }) : liveSource06;
function source105() {
  const value = execFileSync('git', ['show', '50cdfb2e40412746a5e38776fafc475946a4db6a:.github/workflows/campaign47-native-runtime.yml'], { encoding: 'utf8' });
  assert.equal(createHash('sha256').update(value).digest('hex'), 'dcfa9701cefcd5cc693d1e56113acf40e06dea94936d02a25699b2b7232d66d4');
  return value;
}
// All seven historical callback bodies remain exact and validate the real105 ordinary workflow.
const source = currentSource.includes('--onboarding-denial53') ? source105() : currentSource;
const scope = "github.repository == 'TasfiqJ/onSkin' && github.event.repository.private == false && github.event.pull_request.head.repo.full_name == 'TasfiqJ/onSkin' && github.event.pull_request.head.ref == 'stage/m1-native-runtime47'";
const expression = value => '${{ ' + value + ' }}';
const probeOnly = source.includes('--stage build --simulator-probe');
const dependencies = { build: [], normal: ['build'], internal: ['build', 'normal'] };


function validateTarget53(text) {
  const parse = value => {
    const doc = parseDocument(value, { strict: true, uniqueKeys: true, merge: false });
    assert.deepEqual(doc.errors, []); assert.deepEqual(doc.warnings, []);
    return doc.toJS({ maxAliasCount: 0 });
  };
  const historical = source105(); validate(historical);
  const expected = parse(historical);
  expected.jobs['native-build'].if = scope + ' && github.event.pull_request.number == 48 && github.event.pull_request.commits == 107 && github.run_attempt == 1';
  for (const role of ['normal', 'internal']) expected.jobs['native-' + role].if = scope + ' && false';
  const steps = expected.jobs['native-build'].steps;
  const ordinary = steps[2];
  const targeted = { name: 'Execute targeted onboarding denial53', env: ordinary.env,
    run: 'python3 -I -B scripts/release/full-app-j01/storage_trace47.py --output "$RUNNER_TEMP/c47-evidence" --onboarding-denial53' };
  steps.splice(2, 1, targeted, { ...ordinary, if: false });
  assert.deepEqual(parse(text), expected);
}

function validate(text) {
  if (text.includes('--onboarding-denial53')) return validateTarget53(text);
  const origin05 = text.includes('scripts/release/full-app-j01/storage_trace47.py --output');
  const ordinary05 = text.includes('--stage build --ordinary-release05');
  const localSource05 = text.includes('--local-source05');
  const resume25 = text.includes('--stage normal --resume25');
  const resume36 = text.includes('--stage normal --resume36');
  const probeOnly = text.includes('--stage build --simulator-probe');
  const traceOnly = text.includes('--stage build --consent-trace04');
  const retainedOnly = text.includes('--stage build --consent-runtime27');
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
  const source04 = Object.hasOwn(w.jobs, 'native-source');
  const dependencies = source04 ? { source: [], build: ['source'], normal: ['source', 'build'], internal: ['source', 'build', 'normal'] }
    : { build: [], normal: ['build'], internal: ['build', 'normal'] };
  if (source04) assert.equal(resume25 || probeOnly || traceOnly || retainedOnly || localSource05, false);
  if (localSource05) {
    assert.equal(ordinary05, true);
    assert.equal((text.match(/--local-source05/gu) ?? []).length, 3);
    assert.equal(resume25 || resume36 || probeOnly || traceOnly || retainedOnly || origin05, false);
  }
  if (ordinary05 && !source04) assert.equal(localSource05, true);
  assert.deepEqual(Object.keys(w.jobs), Object.keys(dependencies).map(role => 'native-' + role));
  for (const [role, parents] of Object.entries(dependencies)) {
    const job = w.jobs['native-' + role];
    assert.equal(job.name, 'C47 ' + role);
    assert.deepEqual(job.needs, (origin05 && role === 'build') || ((resume25 || resume36) && role === 'normal') ? undefined : parents.length ? parents.map(parent => 'native-' + parent) : undefined);
    const retainedBuild = retainedOnly && role === 'build';
    assert.deepEqual(job.permissions, parents.length || retainedBuild ? { contents: 'read', actions: 'read' } : undefined);
    assert.equal(job['runs-on'], 'macos-26-intel');
    assert.equal(job['timeout-minutes'], 90);
    assert.equal(job.if, scope + ((origin05 ? role !== 'build' : (resume25 || resume36) ? role !== 'normal' : (probeOnly || traceOnly || retainedOnly) && role !== 'build') ? ' && false' : ''));
    assert.equal(job.steps.length, retainedBuild ? 4 : 5);
    assert.deepEqual(job.outputs, {
      artifact_id: expression('steps.upload.outputs.artifact-id'),
      artifact_digest: expression('steps.upload.outputs.artifact-digest'),
      payload_bytes: expression('steps.evidence-budget.outputs.payload_bytes'),
      run_id: expression('github.run_id'), run_attempt: expression('github.run_attempt'),
    });
    assert.deepEqual(job.steps.filter(s => s.uses).map(s => s.uses), [
      'actions/checkout@9f698171ed81b15d1823a05fc7211befd50c8ae0',
      ...(retainedBuild ? [] : ['actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e']),
      'actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02',
    ]);
    assert.deepEqual(job.steps[0].with, { ref: expression('github.event.pull_request.head.sha'), 'fetch-depth': 0, 'persist-credentials': false });
    if (!retainedBuild) assert.deepEqual(job.steps[1].with, { 'node-version': '22.22.2', 'package-manager-cache': false });
    const execute = job.steps[retainedBuild ? 1 : 2];
    const env = { C47_EXPECTED_HEAD: expression('github.event.pull_request.head.sha'), C47_UI_PHASE: 'normal-staging' };
    if ((parents.length || retainedBuild) && !(origin05 && role === 'build')) env.C47_ARTIFACT_READ_TOKEN = expression('github.token');
    for (const parent of origin05 && role === 'build' ? [] : (resume25 || resume36) && role === 'normal' ? [] : parents) {
      for (const [key, output] of [['ARTIFACT_ID', 'artifact_id'], ['ARTIFACT_DIGEST', 'artifact_digest'], ['RUN_ID', 'run_id'], ['RUN_ATTEMPT', 'run_attempt'], ['PAYLOAD_BYTES', 'payload_bytes']]) {
        env['C47_' + parent.toUpperCase() + '_' + key] = expression("needs['native-" + parent + "'].outputs." + output);
      }
    }
    assert.deepEqual(execute.env, env);
    assert.equal(execute.run, origin05 && role === 'build' ? 'python3 -I -B scripts/release/full-app-j01/storage_trace47.py --output \"$RUNNER_TEMP/c47-evidence\"' : 'python3 -I -B scripts/release/full-app-j01/native_runtime47.py --stage ' + role + (ordinary05 && role === 'build' ? ' --ordinary-release05' : resume36 && role === 'normal' ? ' --resume36' : resume25 && role === 'normal' ? ' --resume25' : probeOnly && role === 'build' ? ' --simulator-probe' : traceOnly && role === 'build' ? ' --consent-trace04' : retainedBuild ? ' --consent-runtime27' : '') + ' --output "$RUNNER_TEMP/c47-evidence"' + (localSource05 ? ' --local-source05' : ''));
    const budget = job.steps[retainedBuild ? 2 : 3];
    assert.equal(budget.id, 'evidence-budget');
    assert.equal(budget.if, 'always()');
    assert.match(budget.run, /total \+ reserved <= 500 \* 1024 \* 1024/);
    assert.match(budget.run, /EVIDENCE_LINK_OR_SPECIAL_FILE/);
    assert.match(budget.run, /upstream_payload_bytes/);
    assert.match(budget.run, /GITHUB_OUTPUT/);
    const upload = job.steps[retainedBuild ? 3 : 4];
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

test('C47 hosted stages stay exact-source, Simulator-local, finite and sequential on one Mac', () => validate(source));
test('C47 isolated tooling probe cannot start either application consumer', () => {
  if (probeOnly) {
    assert.equal((source.match(/&& false/gu) ?? []).length, 2);
    assert.throws(() => validate(source.replace(' && false', '')));
    assert.throws(() => validate(source.replace(' --simulator-probe', '')));
  } else {
    assert.doesNotMatch(source, /--simulator-probe/);
    if (source.includes('storage_trace47.py')) {
      assert.equal((source.match(/&& false/gu) ?? []).length, 3);
      assert.throws(() => validate(source.replace(' && false', '')));
      assert.throws(() => validate(source.replace('storage_trace47.py', 'native_runtime47.py --stage build')));
    } else if (source.includes('--resume36')) {
      assert.equal((source.match(/&& false/gu) ?? []).length, 3);
      assert.throws(() => validate(source.replace(' && false', '')));
      assert.throws(() => validate(source.replace(' --resume36', '')));
    } else if (source.includes('--resume25')) {
      assert.equal((source.match(/&& false/gu) ?? []).length, 2);
      assert.throws(() => validate(source.replace(' && false', '')));
    } else if (source.includes('--consent-runtime27')) {
      assert.equal((source.match(/&& false/gu) ?? []).length, 2);
      assert.throws(() => validate(source.replace(' && false', '')));
      assert.throws(() => validate(source.replace(' --consent-runtime27', '')));
    } else if (source.includes('--consent-trace04')) {
      assert.equal((source.match(/&& false/gu) ?? []).length, 2);
      assert.throws(() => validate(source.replace(' && false', '')));
      assert.throws(() => validate(source.replace(' --consent-trace04', '')));
    } else assert.doesNotMatch(source, /&& false/);
  }
});
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
    ...(source.includes('storage_trace47.py') ? [
      [' && false', ''], ['storage_trace47.py', 'native_runtime47.py'],
      ['needs: [native-source, native-build]', 'needs: [native-build]'],
    ] : source.includes('--resume36') ? [
      [' && false', ''], [' --resume36', ''],
      ['needs: [native-source]', 'needs: []'],
      ['needs: [native-source, native-build, native-normal]', 'needs: [native-build, native-normal]'],
    ] : source.includes('  native-source:') ? [
      ['needs: [native-source]', 'needs: []'],
      ['needs: [native-source, native-build]', 'needs: [native-build]'],
      ['needs: [native-source, native-build, native-normal]', 'needs: [native-build, native-normal]'],
    ] : [
      ...(source.includes('--resume25') ? [[' && false', '']] : [['needs: [native-build]', 'needs: []']]),
      ['needs: [native-build, native-normal]', 'needs: [native-build]'],
    ]),
    ['actions: read', 'actions: write'], ['steps.upload.outputs.artifact-digest', 'steps.upload.outputs.artifact-id'],
    ["needs['native-build'].outputs.artifact_digest", "github.sha"],
    ['--stage normal', '--stage build'], ['upstream_payload_bytes', 'ignored_upstream_bytes'],
    ['compression-level: 0', 'compression-level: 9'],
  ]) {
    assert.ok(source.includes(before));
    assert.throws(() => validate(source.replaceAll(before, after)), before);
  }
});

test('C47 preserves authenticated historical workflows and admits only the current diagnostic Mac', () => {
  validate(execFileSync('git', ['show', '445472ce057b90f08b5a51d5a49167c757d34b79:.github/workflows/campaign47-native-runtime.yml'], { encoding: 'utf8' }));
  validate(execFileSync('git', ['show', '3ef74bd61a69ca76702421cddcb7bda1912cb120:.github/workflows/campaign47-native-runtime.yml'], { encoding: 'utf8' }));
  const diagnostic = execFileSync('git', ['show', '93f314459299dbca8ec8511d744280e6bcad66c3:.github/workflows/campaign47-native-runtime.yml'], { encoding: 'utf8' });
  validate(diagnostic);
  const w = parseDocument(diagnostic).toJS();
  validate(execFileSync('git', ['show', 'f21831f5731be928c8e323c509fb62b3d12a654e:.github/workflows/campaign47-native-runtime.yml'], { encoding: 'utf8' }));
  assert.deepEqual(Object.entries(w.jobs).filter(([, job]) => !job.if.endsWith(' && false')).map(([name]) => name), ['native-build']);
  assert.equal(w.jobs['native-build'].needs, undefined);
  assert.match(w.jobs['native-build'].steps[1].run, /--stage build --consent-runtime27 /);
  assert.deepEqual(w.jobs['native-build'].permissions, { contents: 'read', actions: 'read' });
  assert.deepEqual(w.jobs['native-build'].steps[1].env, {
    C47_EXPECTED_HEAD: expression('github.event.pull_request.head.sha'), C47_UI_PHASE: 'normal-staging',
    C47_ARTIFACT_READ_TOKEN: expression('github.token'),
  });
  assert.throws(() => validate(diagnostic.replace('      actions: read\n', '')));
  assert.throws(() => validate(diagnostic.replace(expression('github.token'), expression('github.actor'))));
});

test('Quality retains its real online failure while independent checks and exports execute', () => {
  const doc = parseDocument(readFileSync(new URL('../../../.github/workflows/quality.yml', import.meta.url), 'utf8'));
  assert.deepEqual(doc.errors, []);
  const quality = doc.toJS({ maxAliasCount: 0 });
  const checks = quality.jobs.checks.steps;
  const online = checks.findIndex(step => step.name === 'Check Expo dependency compatibility');
  assert.ok(online > 0);
  assert.equal(checks[online].run, 'npx expo install --check');
  assert.equal(checks[online].if, undefined);
  assert.equal(checks.find(step => step.name === 'Install from lockfile').id, 'install');
  for (const step of checks.slice(online + 1)) {
    assert.equal(step.if, expression("!cancelled() && steps.install.outcome == 'success'"));
  }
  for (const step of checks) assert.equal(Object.hasOwn(step, 'continue-on-error'), false);
  assert.equal(quality.jobs['expo-export'].needs, 'checks');
  assert.equal(quality.jobs['expo-export'].if, expression('!cancelled()'));
  assert.equal(Object.hasOwn(quality.jobs.checks, 'continue-on-error'), false);
});

test('C05 current ordinary producer is a new uninstrumented Release and cannot use a diagnostic or historical resume', () => {
  const ordinary = text => {
    validate(text);
    assert.equal((text.match(/--ordinary-release05/gu) ?? []).length, 1);
    assert.match(text, /native_runtime47.py --stage build --ordinary-release05 --output/);
    assert.doesNotMatch(text, /storage_trace47.py --output|--resume25|--resume36|--simulator-probe|--consent-trace04|--consent-runtime27|&& false/);
  };
  ordinary(source);
  for (const [before, after] of [
    [' --ordinary-release05', ''], ['--stage build --ordinary-release05', '--stage normal --ordinary-release05'],
    ['native_runtime47.py --stage build --ordinary-release05', 'storage_trace47.py'],
    ['--stage build --ordinary-release05', '--stage build --consent-trace04'],
    ...(source.includes('--local-source05') ? [
      [' --local-source05', ''], ['needs: [native-build]', 'needs: []'],
    ] : [['needs: [native-source]', 'needs: []']]),
  ]) {
    assert.ok(source.includes(before));
    assert.throws(() => ordinary(source.replace(before, after)));
  }
});


test('C05 final53 is one-shot107/a1 diagnostic only; original three ordinary job bodies remain disabled', () => {
  assert.equal(currentSource.includes('--onboarding-denial53'), true);
  validate(currentSource);
  const active = parseDocument(currentSource).toJS().jobs;
  assert.equal(Object.keys(active).length, 3);
  assert.equal(active['native-build'].steps[2].name, 'Execute targeted onboarding denial53');
  assert.equal(active['native-build'].steps[3].if, false);
  assert.equal(active['native-normal'].if, scope + ' && false');
  assert.equal(active['native-internal'].if, scope + ' && false');
  for (const [before, after] of [
    [' --onboarding-denial53', ''], ['commits == 107', 'commits == 105'],
    ['github.run_attempt == 1', 'github.run_attempt == 2'],
    [' && github.event.pull_request.number == 48', ''], [' && false', ''],
    ['        if: false', '        if: true'],
    ['storage_trace47.py --output', 'native_runtime47.py --output'],
    ['timeout-minutes: 90', 'timeout-minutes: 180'],
    ['C47_UI_PHASE: normal-staging', 'C47_UI_PHASE: internal-supported-owner'],
  ]) {
    assert.ok(currentSource.includes(before));
    assert.throws(() => validate(currentSource.replace(before, after)), before);
  }
});

// Historical eight callbacks above remain unchanged and exercise their original workflows.
test('C06 exact113 witness and finite115 fresh-host recovery preserve whole ordinary/internal pipeline', () => {
  const parse = text => { const d = parseDocument(text, { strict: true, uniqueKeys: true, merge: false }); assert.deepEqual(d.errors, []); assert.deepEqual(d.warnings, []); return d.toJS({ maxAliasCount: 0 }); };
  const original113 = execFileSync('git', ['show', 'd2f91bd13fc5257b3101fe3642c40ea650165574:.github/workflows/campaign47-native-runtime.yml'], { encoding: 'utf8' });
  for (const [actual, count, header] of [[original113, 113, '# C06 ordinary54-56; exact PR48/113/a1; six total new Mac starts54-59 maximum.\n'], [execFileSync('git', ['show', '9269c1d2e7dc87bcb8c6578503e84f71e53fc638:.github/workflows/campaign47-native-runtime.yml'], { encoding: 'utf8' }), 115, '# C06 recovery56-58; exact PR48/115/a1; single fresh-host recovery after native55 event-injection timeout.\n']]) {
    assert.ok(actual.startsWith(header));
    const expected = parse(source105());
    for (const job of Object.values(expected.jobs)) job.if = scope + ' && github.event.pull_request.number == 48 && github.event.pull_request.commits == ' + count + ' && github.run_attempt == 1';
    const check = text => assert.deepEqual(parse(text), expected);
    check(actual);
    for (const [a,b] of [['commits == ' + count,'commits == 111'],['github.run_attempt == 1','github.run_attempt == 2'],[' && github.event.pull_request.number == 48',''],['macos-26-intel','macos-26-large'],['timeout-minutes: 90','timeout-minutes: 180'],['contents: read','contents: write'],['needs: [native-build, native-normal]','needs: [native-build]'],['needs: [native-build]','needs: []'],[' --ordinary-release05',''],[' --local-source05',''],['--stage normal','--stage internal'],['compression-level: 0','compression-level: 9'],['500 * 1024 * 1024','999 * 1024 * 1024']]) { assert.ok(actual.includes(a)); assert.throws(() => check(actual.replaceAll(a,b)),a); }
  }
});

test('C06 exact117 observation58 has one bounded job and exact authenticated reuse56 profile', () => {
  const observationSource117 = execFileSync('git', ['show', '801a77a93c027c7f3be7941b103b92b88eaa53b1:.github/workflows/campaign47-native-runtime.yml'], { encoding: 'utf8' });
  const parse = text => { const d = parseDocument(text, { strict: true, uniqueKeys: true, merge: false }); assert.deepEqual(d.errors, []); assert.deepEqual(d.warnings, []); return d.toJS({ maxAliasCount: 0 }); };
  const expected = parse(execFileSync('git', ['show', '9269c1d2e7dc87bcb8c6578503e84f71e53fc638:.github/workflows/campaign47-native-runtime.yml'], { encoding: 'utf8' }));
  const job = expected.jobs['native-normal'];
  delete job.needs;
  expected.jobs = { 'native-normal': job };
  job.if = scope + ' && github.event.pull_request.number == 48 && github.event.pull_request.commits == 117 && github.run_attempt == 1';
  const execute = job.steps[2];
  for (const key of Object.keys(execute.env)) if (key.startsWith('C47_BUILD_')) delete execute.env[key];
  execute.run = execute.run.replace(' --local-source05', ' --reuse56-observe06');
  const check = text => assert.deepEqual(parse(text), expected);
  assert.ok(observationSource117.startsWith('# C06 observation58; exact PR48/117/a1;'));
  check(observationSource117);
  for (const [a,b] of [['commits == 117','commits == 115'],['github.run_attempt == 1','github.run_attempt == 2'],[' && github.event.pull_request.number == 48',''],['macos-26-intel','macos-26-large'],['timeout-minutes: 90','timeout-minutes: 180'],['contents: read','contents: write'],['cancel-in-progress: false','cancel-in-progress: true'],['--reuse56-observe06','--resume36'],['--stage normal','--stage internal'],['retention-days: 3','retention-days: 30'],['compression-level: 0','compression-level: 9'],['500 * 1024 * 1024','999 * 1024 * 1024']]) { assert.ok(observationSource117.includes(a)); assert.throws(() => check(observationSource117.replaceAll(a,b)),a); }
});
test('C06 exact119 live-log observation58 has one bounded job and exact authenticated reuse56 profile', () => {
  const observationSource119 = execFileSync('git', ['show', 'f0866fdf7422186e05833303c86a180f906b180e:.github/workflows/campaign47-native-runtime.yml'], { encoding: 'utf8' });
  const parse = text => { const d = parseDocument(text, { strict: true, uniqueKeys: true, merge: false }); assert.deepEqual(d.errors, []); assert.deepEqual(d.warnings, []); return d.toJS({ maxAliasCount: 0 }); };
  const expected = parse(execFileSync('git', ['show', '9269c1d2e7dc87bcb8c6578503e84f71e53fc638:.github/workflows/campaign47-native-runtime.yml'], { encoding: 'utf8' }));
  const job = expected.jobs['native-normal'];
  delete job.needs;
  expected.jobs = { 'native-normal': job };
  job.if = scope + ' && github.event.pull_request.number == 48 && github.event.pull_request.commits == 119 && github.run_attempt == 1';
  const execute = job.steps[2];
  for (const key of Object.keys(execute.env)) if (key.startsWith('C47_BUILD_')) delete execute.env[key];
  execute.run = execute.run.replace(' --local-source05', ' --reuse56-observe06');
  const check = text => assert.deepEqual(parse(text), expected);
  assert.ok(observationSource119.startsWith('# C06 observation58; exact PR48/119/a1;'));
  check(observationSource119);
  for (const [a,b] of [['commits == 119','commits == 115'],['github.run_attempt == 1','github.run_attempt == 2'],[' && github.event.pull_request.number == 48',''],['macos-26-intel','macos-26-large'],['timeout-minutes: 90','timeout-minutes: 180'],['contents: read','contents: write'],['cancel-in-progress: false','cancel-in-progress: true'],['--reuse56-observe06','--resume36'],['--stage normal','--stage internal'],['retention-days: 3','retention-days: 30'],['compression-level: 0','compression-level: 9'],['500 * 1024 * 1024','999 * 1024 * 1024']]) { assert.ok(observationSource119.includes(a)); assert.throws(() => check(observationSource119.replaceAll(a,b)),a); }
});
test('C06 exact121 resolved-input observation58 has one bounded job and exact authenticated reuse56 profile', () => {
  const observationSource121 = execFileSync('git', ['show', '6a63e87f8966723a4776f4b3b5cda016de84ee71:.github/workflows/campaign47-native-runtime.yml'], { encoding: 'utf8' });
  const parse = text => { const d = parseDocument(text, { strict: true, uniqueKeys: true, merge: false }); assert.deepEqual(d.errors, []); assert.deepEqual(d.warnings, []); return d.toJS({ maxAliasCount: 0 }); };
  const expected = parse(execFileSync('git', ['show', '9269c1d2e7dc87bcb8c6578503e84f71e53fc638:.github/workflows/campaign47-native-runtime.yml'], { encoding: 'utf8' }));
  const job = expected.jobs['native-normal'];
  delete job.needs;
  expected.jobs = { 'native-normal': job };
  job.if = scope + ' && github.event.pull_request.number == 48 && github.event.pull_request.commits == 121 && github.run_attempt == 1';
  const execute = job.steps[2];
  for (const key of Object.keys(execute.env)) if (key.startsWith('C47_BUILD_')) delete execute.env[key];
  execute.run = execute.run.replace(' --local-source05', ' --reuse56-observe06');
  const check = text => assert.deepEqual(parse(text), expected);
  assert.ok(observationSource121.startsWith('# C06 observation58; exact PR48/121/a1;'));
  check(observationSource121);
  for (const [a,b] of [['commits == 121','commits == 115'],['github.run_attempt == 1','github.run_attempt == 2'],[' && github.event.pull_request.number == 48',''],['macos-26-intel','macos-26-large'],['timeout-minutes: 90','timeout-minutes: 180'],['contents: read','contents: write'],['cancel-in-progress: false','cancel-in-progress: true'],['--reuse56-observe06','--resume36'],['--stage normal','--stage internal'],['retention-days: 3','retention-days: 30'],['compression-level: 0','compression-level: 9'],['500 * 1024 * 1024','999 * 1024 * 1024']]) { assert.ok(observationSource121.includes(a)); assert.throws(() => check(observationSource121.replaceAll(a,b)),a); }
});
test('C06 exact123 canonical-fixture observation59 has one bounded job and exact authenticated reuse56 profile', () => {
  const parse = text => { const d = parseDocument(text, { strict: true, uniqueKeys: true, merge: false }); assert.deepEqual(d.errors, []); assert.deepEqual(d.warnings, []); return d.toJS({ maxAliasCount: 0 }); };
  const expected = parse(execFileSync('git', ['show', '9269c1d2e7dc87bcb8c6578503e84f71e53fc638:.github/workflows/campaign47-native-runtime.yml'], { encoding: 'utf8' }));
  const job = expected.jobs['native-normal'];
  delete job.needs;
  expected.jobs = { 'native-normal': job };
  job.if = scope + ' && github.event.pull_request.number == 48 && github.event.pull_request.commits == 123 && github.run_attempt == 1';
  const execute = job.steps[2];
  for (const key of Object.keys(execute.env)) if (key.startsWith('C47_BUILD_')) delete execute.env[key];
  execute.run = execute.run.replace(' --local-source05', ' --reuse56-observe06');
  const check = text => assert.deepEqual(parse(text), expected);
  assert.ok(liveSource06.startsWith('# C06 observation59; exact PR48/123/a1;'));
  check(liveSource06);
  for (const [a,b] of [['commits == 123','commits == 115'],['github.run_attempt == 1','github.run_attempt == 2'],[' && github.event.pull_request.number == 48',''],['macos-26-intel','macos-26-large'],['timeout-minutes: 90','timeout-minutes: 180'],['contents: read','contents: write'],['cancel-in-progress: false','cancel-in-progress: true'],['--reuse56-observe06','--resume36'],['--stage normal','--stage internal'],['retention-days: 3','retention-days: 30'],['compression-level: 0','compression-level: 9'],['500 * 1024 * 1024','999 * 1024 * 1024']]) { assert.ok(liveSource06.includes(a)); assert.throws(() => check(liveSource06.replaceAll(a,b)),a); }
});

test('C07 exact128 fresh build60 ordinary61 observed and internal62 retain full authenticated DAG', () => {
  const parse = text => { const d = parseDocument(text, { strict:true, uniqueKeys:true, merge:false }); assert.deepEqual(d.errors, []); assert.deepEqual(d.warnings, []); return d.toJS({maxAliasCount:0}); };
  const expected = parse(execFileSync('git',['show','9269c1d2e7dc87bcb8c6578503e84f71e53fc638:.github/workflows/campaign47-native-runtime.yml'],{encoding:'utf8'}));
  for (const job of Object.values(expected.jobs)) job.if = job.if.replace('commits == 115','commits == 128');
  expected.jobs['native-normal'].steps[2].run += ' --stall-observe07';
  const check = text => assert.deepEqual(parse(text),expected);
  assert.ok(liveSource07.startsWith('# C07 fresh60-62; exact PR48/128/a1;')); check(liveSource07);
  for (const [a,b] of [['commits == 128','commits == 125'],['github.run_attempt == 1','github.run_attempt == 2'],[' && github.event.pull_request.number == 48',''],['macos-26-intel','macos-26-large'],['timeout-minutes: 90','timeout-minutes: 180'],['contents: read','contents: write'],['needs: [native-build, native-normal]','needs: [native-build]'],['needs: [native-build]','needs: []'],[' --ordinary-release05',''],[' --local-source05',''],[' --stall-observe07',''],['compression-level: 0','compression-level: 9'],['500 * 1024 * 1024','999 * 1024 * 1024']]) { assert.ok(liveSource07.includes(a)); assert.throws(()=>check(liveSource07.replaceAll(a,b)),a); }
});

test('C07 exact130 single diagnostic62 preserves old128 DAG and requires fresh current initial-consent origin', () => {
  const parse = text => {const d=parseDocument(text,{strict:true,uniqueKeys:true,merge:false});assert.deepEqual(d.errors,[]);assert.deepEqual(d.warnings,[]);return d.toJS({maxAliasCount:0});};
  const old=execFileSync('git',['show','39ce16cdcadca2cbde1ba64ae7dea0f9c99de280:.github/workflows/campaign47-native-runtime.yml'],{encoding:'utf8'});
  const expected=parse(old);expected.jobs={'native-build':expected.jobs['native-build']};
  const job=expected.jobs['native-build'];job.if=job.if.replace('commits == 128','commits == 130');
  job.steps[2].run='python3 -I -B scripts/release/full-app-j01/storage_trace47.py --output "$RUNNER_TEMP/c47-evidence" --onboarding-denial62';
  const check=text=>assert.deepEqual(parse(text),expected);assert.ok(liveSource62.startsWith('# C07 diagnostic62; exact PR48/130/a1;'));check(liveSource62);
  for(const[a,b]of[['commits == 130','commits == 128'],['github.run_attempt == 1','github.run_attempt == 2'],[' && github.event.pull_request.number == 48',''],['macos-26-intel','macos-26-large'],['timeout-minutes: 90','timeout-minutes: 180'],['contents: read','contents: write'],['cancel-in-progress: false','cancel-in-progress: true'],['--onboarding-denial62','--onboarding-denial53'],['retention-days: 3','retention-days: 30'],['compression-level: 0','compression-level: 9'],['500 * 1024 * 1024','999 * 1024 * 1024']]){assert.ok(liveSource62.includes(a));assert.throws(()=>check(liveSource62.replaceAll(a,b)),a);}
});
