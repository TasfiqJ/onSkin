import assert from 'node:assert/strict';
import test from 'node:test';

import { auditVerificationWiring } from './verification-wiring-contract.mjs';

const verifierDefinitions = Object.freeze({
  'phase9:privacy:check': 'node scripts/privacy.mjs --check',
  'phase9:privacy:test': 'node --test scripts/privacy.test.mjs',
});
const verifiers = Object.keys(verifierDefinitions);

function packageFixture(overrides = {}) {
  return {
    scripts: {
      'phase9:privacy:check': verifierDefinitions['phase9:privacy:check'],
      'phase9:privacy:test': verifierDefinitions['phase9:privacy:test'],
      'phase9:verify':
        'npm run start && npm run phase9:privacy:check && npm run phase9:privacy:test',
      'launch:verify': 'npm run phase9:privacy:check && npm run phase9:privacy:test && npm test',
      ...overrides,
    },
  };
}

function workflowFixture({
  run = verifiers.map((script) => `npm run ${script}`).join('\n'),
  rootExtra = '',
  jobExtra = '',
  stepExtra = '',
  duplicateStep = '',
  runsOn = 'ubuntu-latest',
} = {}) {
  return `name: Quality
on:
  pull_request:
  push:
    branches:
      - main
  workflow_dispatch:
env:
  CI: 'true'
  EXPO_NO_TELEMETRY: '1'
${rootExtra}jobs:
  checks:
    runs-on: ${runsOn}
${jobExtra}    steps:
      - name: Verify installed iOS native sources
${stepExtra}        run: |
${run
  .split('\n')
  .map((line) => `          ${line}`)
  .join('\n')}
${duplicateStep}`;
}

function audit({ packageJson = packageFixture(), workflowText = workflowFixture(), ...rest } = {}) {
  return auditVerificationWiring({
    packageJson,
    workflowText,
    verifierDefinitions,
    ...rest,
  });
}

test('accepts exact definitions, fail-closed parent chains, and one unconditional CI step', () => {
  const result = audit();
  assert.equal(result.status, 'pass');
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.verifierScripts, verifiers);
  assert.throws(() => result.errors.push('mutate'), TypeError);
});

test('rejects verifier definitions that can short-circuit or substitute the reviewed command', () => {
  for (const replacement of [
    'exit 0',
    'exit 0 && node scripts/privacy.mjs --check',
    'node scripts/privacy.mjs --check || true',
    'echo "node scripts/privacy.mjs --check"',
    'node scripts/privacy.mjs --check:extra',
  ]) {
    const result = audit({
      packageJson: packageFixture({ 'phase9:privacy:check': replacement }),
    });
    assert.equal(result.status, 'invalid');
    assert.match(result.errors.join('\n'), /exact reviewed command definition/u);
  }
});

test('rejects parent scripts with control flow, unsafe commands, whitespace tricks, or duplicates', () => {
  const validTail = 'npm run phase9:privacy:check && npm run phase9:privacy:test';
  for (const replacement of [
    `exit 0\n${validTail}`,
    `exit 0 && ${validTail}`,
    `${validTail} || true`,
    `${validTail}; exit 0`,
    `${validTail} | tee output.txt`,
    ` ${validTail}`,
    `${validTail} `,
    `${validTail} && npm run phase9:privacy:check`,
  ]) {
    const result = audit({ packageJson: packageFixture({ 'launch:verify': replacement }) });
    assert.equal(result.status, 'invalid');
    assert.match(result.errors.join('\n'), /launch:verify/u);
  }
});

test('rejects any command before, after, between, or out of order in the audited CI step', () => {
  for (const run of [
    `exit 0\n${verifiers.map((script) => `npm run ${script}`).join('\n')}`,
    `${verifiers.map((script) => `npm run ${script}`).join('\n')}\ntrue`,
    'npm run phase9:privacy:test\nnpm run phase9:privacy:check',
    'npm run phase9:privacy:check\nnpm run phase9:privacy:check\nnpm run phase9:privacy:test',
    '# npm run phase9:privacy:check\nnpm run phase9:privacy:test',
    'npm run phase9:privacy:check\n\nnpm run phase9:privacy:test',
    'npm run phase9:privacy:check && npm run phase9:privacy:test',
  ]) {
    const result = audit({ workflowText: workflowFixture({ run }) });
    assert.equal(result.status, 'invalid');
    assert.match(result.errors.join('\n'), /only the exact audited verifier commands/u);
  }
});

test('rejects conditional, non-failing, custom-shell, environment, and duplicate audited steps', () => {
  const stepExtras = [
    '        if: always()\n',
    '        continue-on-error: true\n',
    '        shell: bash {0}\n',
    '        working-directory: scripts\n',
    '        env:\n          PATH: /tmp\n',
  ];
  for (const stepExtra of stepExtras) {
    const result = audit({ workflowText: workflowFixture({ stepExtra }) });
    assert.equal(result.status, 'invalid');
    assert.match(result.errors.join('\n'), /exactly name and run/u);
  }

  const duplicateStep = `      - name: Verify installed iOS native sources
        run: |
          npm run phase9:privacy:check
          npm run phase9:privacy:test
`;
  const duplicate = audit({ workflowText: workflowFixture({ duplicateStep }) });
  assert.equal(duplicate.status, 'invalid');
  assert.match(duplicate.errors.join('\n'), /exactly one/u);
});

test('rejects workflow and job controls that can make the audited step non-mandatory', () => {
  const cases = [
    workflowFixture({ rootExtra: 'defaults:\n  run:\n    shell: bash {0}\n' }),
    workflowFixture({ jobExtra: '    if: false\n' }),
    workflowFixture({ jobExtra: '    continue-on-error: true\n' }),
    workflowFixture({ jobExtra: '    defaults:\n      run:\n        shell: bash {0}\n' }),
    workflowFixture({ jobExtra: '    container: node:22\n' }),
    workflowFixture({ jobExtra: '    needs: setup\n' }),
    workflowFixture({ jobExtra: '    strategy:\n      matrix:\n        include: []\n' }),
    workflowFixture({ jobExtra: '    env:\n      NODE_OPTIONS: --require ./bypass.cjs\n' }),
    workflowFixture({ runsOn: 'self-hosted' }),
  ];
  for (const workflowText of cases) {
    const result = audit({ workflowText });
    assert.equal(result.status, 'invalid');
  }
});

test('rejects filtered or incomplete triggers and unreviewed root environment', () => {
  const valid = workflowFixture();
  for (const workflowText of [
    valid.replace('  pull_request:\n', ''),
    valid.replace('      - main\n', '      - feature\n'),
    valid.replace(
      '    branches:\n      - main\n',
      '    branches:\n      - main\n    paths:\n      - docs/**\n',
    ),
    valid.replace(
      "  EXPO_NO_TELEMETRY: '1'\n",
      "  EXPO_NO_TELEMETRY: '1'\n  NODE_OPTIONS: bypass\n",
    ),
  ]) {
    const result = audit({ workflowText });
    assert.equal(result.status, 'invalid');
  }
});

test('fails closed on duplicate YAML keys, aliases, oversized input, and missing jobs', () => {
  const invalidWorkflows = [
    'jobs:\n  checks:\n    runs-on: ubuntu-latest\n    runs-on: macos-15\n    steps: []\n',
    'jobs:\n  template: &template\n    runs-on: ubuntu-latest\n    steps: []\n  checks: *template\n',
    'name: no-jobs\n',
    'x'.repeat(1_000_001),
  ];
  for (const workflowText of invalidWorkflows) {
    const result = audit({ workflowText });
    assert.equal(result.status, 'invalid');
    assert.ok(result.errors.length >= 1);
  }
});

test('rejects malformed definitions, parent names, job identifiers, and step names', () => {
  const invalidCalls = [
    { verifierDefinitions: {} },
    { verifierDefinitions: { 'bad script': 'node test.mjs' } },
    { verifierDefinitions: { ok: 'node a.mjs\nnode b.mjs' } },
    { parentScripts: [] },
    { parentScripts: ['same', 'same'] },
    { parentScripts: ['bad script'] },
    { workflowJob: 'bad job' },
    { workflowStep: ' bad' },
    { workflowStep: 'bad\nstep' },
  ];
  for (const overrides of invalidCalls) {
    assert.throws(
      () =>
        auditVerificationWiring({
          packageJson: packageFixture(),
          workflowText: workflowFixture(),
          verifierDefinitions,
          ...overrides,
        }),
      TypeError,
    );
  }
});
