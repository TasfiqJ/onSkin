import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { parseDocument } from 'yaml';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const helper = fileURLToPath(new URL('./mounted_journey46.mjs', import.meta.url));
const helperCommand = 'node scripts/release/full-app-j01/mounted_journey46.mjs';
const includes = ['src/features/today/OptionalChangePanel41.test.tsx',
  'src/features/routine/PlanHistoryPanel45.test.tsx'];

function workflow() {
  const document = parseDocument(readFileSync(join(root, '.github/workflows/quality.yml'), 'utf8'),
    { merge: false, strict: true, uniqueKeys: true });
  assert.deepEqual(document.errors, []);
  assert.deepEqual(document.warnings, []);
  return document.toJS({ maxAliasCount: 0 });
}

test('Quality directly executes the mounted helper and restored current controls without bypasses', () => {
  const job = workflow().jobs.checks;
  assert.equal(job.if, undefined);
  assert.equal(job['continue-on-error'], undefined);
  const candidates = job.steps.filter((step) => typeof step.run === 'string' &&
    step.run.split('\n').some((line) => line.trim() === helperCommand));
  assert.equal(candidates.length, 1);
  const step = candidates[0];
  assert.deepEqual(Object.keys(step).sort(), ['name', 'run']);
  const commands = step.run.trim().split('\n').map((line) => line.trim());
  assert.equal(commands[0], 'set -euo pipefail');
  for (const command of commands) {
    assert.match(command, /^(?:set -euo pipefail|(?:python3|node|npm) [^;&|<>]+)$/u);
  }
  for (const command of [helperCommand,
    'node --test scripts/release/full-app-j01/mounted_journey46.test.mjs',
    'node --test scripts/e2e/formula-driver-coverage46.test.mjs',
    'node --test scripts/phase2/catalog-operator-cat08-cleanup40.test.mjs',
    'node scripts/phase2/catalog-operator-cat08-cleanup40.test.mjs --behavioral',
    'node scripts/docs/source-packet-supersession09.test.mjs',
  ]) assert.equal(commands.filter((line) => line === command).length, 1, command);
});

test('current native and store inspection retain the original unconditional nine-command step', () => {
  const candidates = workflow().jobs.checks.steps.filter((step) =>
    step.name === 'Verify installed iOS native sources');
  assert.equal(candidates.length, 1);
  assert.deepEqual(Object.keys(candidates[0]).sort(), ['name', 'run']);
  assert.deepEqual(candidates[0].run.trim().split('\n').map((line) => line.trim()), [
    'npm run postinstall:check',
    'npm run phase5:expo-widgets-lifecycle:test',
    'npm run phase9:view-shot-privacy:test',
    'npm run phase9:ios-privacy-source-audit:test',
    'npm run phase9:ios-privacy-source-audit:check',
    'npm run phase9:ios-archive-privacy-evidence:test',
    'npm run phase9:release-candidate-git-contract:test',
    'npm run phase9:verification-wiring:test',
    'npm run phase9:store-build-inspect:check',
  ]);
});

// The actual helper process executes a synthetic child CLI boundary here.
// Its separate unmodified invocation executes the real two files / 33 mounted
// cases. These tooling controls do not substitute for those app assertions.
function runFixture({ childExit = 0, throwAfterRead = false, missingChild = false } = {}) {
  const parent = realpathSync(tmpdir());
  const scratch = realpathSync(mkdtempSync(join(parent, 'c46-mounted-helper-')));
  const fixture = join(scratch, 'source'), temporary = join(scratch, 'temporary');
  mkdirSync(join(fixture, 'node_modules/vitest'), { recursive: true });
  mkdirSync(temporary);
  try {
    if (!missingChild) {
      writeFileSync(join(fixture, 'node_modules/vitest/vitest.mjs'), `
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const argv = process.argv.slice(2);
const configPath = argv[argv.indexOf('--config') + 1];
const config = (await import(pathToFileURL(configPath))).default;
writeFileSync('observed.json', JSON.stringify({ argv, configPath, config }));
${throwAfterRead ? "throw new Error('synthetic child execution failed');" : `process.exitCode = ${childExit};`}
`, 'utf8');
    }
    const result = spawnSync(process.execPath, [helper], { cwd: fixture, encoding: 'utf8',
      env: { ...process.env, TMPDIR: temporary, TEMP: temporary, TMP: temporary },
      timeout: 10000, maxBuffer: 1024 * 1024, windowsHide: true });
    assert.equal(result.error, undefined);
    assert.equal(result.signal, null);
    assert.equal(result.status, missingChild || throwAfterRead ? 1 : childExit);
    if (!missingChild) {
      const observed = JSON.parse(readFileSync(join(fixture, 'observed.json'), 'utf8'));
      assert.deepEqual(observed.argv, ['run', '--config', observed.configPath,
        '--passWithNoTests=false', '--reporter=verbose']);
      assert.deepEqual(observed.config, { root: resolve(fixture, 'apps/mobile'),
        resolve: { alias: { '@': resolve(fixture, 'apps/mobile/src') } },
        test: { environment: 'node', include: includes } });
      assert.equal(dirname(dirname(observed.configPath)), temporary);
      assert.match(basename(dirname(observed.configPath)), /^optional-change41-vitest-/u);
      assert.equal(existsSync(observed.configPath), false);
      assert.equal(existsSync(dirname(observed.configPath)), false);
    }
    assert.deepEqual(readdirSync(temporary), []);
    return result;
  } finally {
    assert.equal(dirname(scratch), parent);
    assert.match(basename(scratch), /^c46-mounted-helper-/u);
    rmSync(scratch, { recursive: true, force: true });
  }
}

test('mounted helper passes the exact two-test configuration and removes its temporary config', () => {
  runFixture();
});
test('mounted helper propagates a nonzero child exit and cleans up', () => {
  runFixture({ childExit: 7 });
});
test('mounted helper refuses a throwing child and still cleans up', () => {
  assert.match(runFixture({ throwAfterRead: true }).stderr, /synthetic child execution failed/u);
});
test('mounted helper refuses a missing child CLI and still cleans up', () => {
  assert.match(runFixture({ missingChild: true }).stderr, /MODULE_NOT_FOUND/u);
});
