import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { validateSupportedPhoneGates } from './device-support-policy-source-contract.mjs';

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const auditSource = readFileSync('scripts/docs/device-support-policy-audit.mjs', 'utf8');
const qualityWorkflow = readFileSync('.github/workflows/quality.yml', 'utf8');

function commands(scriptName) {
  return String(packageJson.scripts?.[scriptName] ?? '').split(' && ');
}

test('pre-S source contract checks policy without writing or claiming release evidence', (t) => {
  const outputDirectory = mkdtempSync(join(tmpdir(), 'layerwell-device-support-source-'));
  const outJson = join(outputDirectory, 'device-support-policy-audit.json');
  const outMd = join(outputDirectory, 'device-support-policy-audit.md');
  t.after(() => rmSync(outputDirectory, { recursive: true, force: true }));
  const manifestPath = 'docs/e2e/generated/human-e2e-manifest.json';
  const manifestBefore = readFileSync(manifestPath);

  const result = spawnSync(
    process.execPath,
    ['scripts/docs/device-support-policy-audit.mjs', '--strict', '--source-integration'],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: {
        ...process.env,
        DEVICE_SUPPORT_POLICY_AUDIT_JSON: outJson,
        DEVICE_SUPPORT_POLICY_AUDIT_MD: outMd,
      },
    },
  );

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /release evidence was not assessed/u);
  assert.equal(existsSync(outJson), false);
  assert.equal(existsSync(outMd), false);
  assert.deepEqual(readFileSync(manifestPath), manifestBefore);
});

test('source checks keep exact required gates while release checks require passing evidence', () => {
  const ids = ['iphone-375-667-200-text-pressure', 'modern-390-200-text-pressure'];
  const gates = ids.map((id) => ({
    id,
    required: true,
    supportClass: 'supported-phone',
    status: 'fail',
  }));
  assert.deepEqual(validateSupportedPhoneGates(gates, ids, false).blockers, []);
  assert.equal(validateSupportedPhoneGates(gates, ids, true).blockers.length, ids.length);
  assert.match(
    validateSupportedPhoneGates(
      [{ ...gates[0], required: false }, gates[1]],
      ids,
      false,
    ).blockers.join('\n'),
    /must be required/u,
  );
  assert.match(
    validateSupportedPhoneGates(
      [{ ...gates[0], supportClass: 'resilience' }, gates[1]],
      ids,
      false,
    ).blockers.join('\n'),
    /classified as supported-phone/u,
  );
  assert.match(
    validateSupportedPhoneGates([gates[0]], ids, false).blockers.join('\n'),
    /exactly one/u,
  );
  assert.match(
    validateSupportedPhoneGates([...gates, gates[0]], ids, false).blockers.join('\n'),
    /exactly one/u,
  );
  assert.match(
    validateSupportedPhoneGates(
      [{ ...gates[0], status: 'invented' }, gates[1]],
      ids,
      false,
    ).blockers.join('\n'),
    /honest pass or fail/u,
  );
});

test('ordinary Quality runs the source contract and preserves the post-F release gate', () => {
  assert.match(qualityWorkflow, /npm run docs:device-support-policy-audit:source/u);
  assert.match(qualityWorkflow, /npm run docs:device-support-policy-audit:test/u);
  assert.doesNotMatch(qualityWorkflow, /npm run docs:device-support-policy-audit:check/u);
  assert.match(
    packageJson.scripts['docs:device-support-policy-audit:source'],
    /--source-integration/u,
  );
  assert.match(packageJson.scripts['docs:device-support-policy-audit:check'], /--strict --check/u);
});

test('pre-S launch uses the device source contract and post-F owns committed replay', () => {
  const launch = commands('launch:verify');
  const postF = commands('release:governed-packets:check');

  assert.equal(
    launch.filter((command) => command === 'npm run docs:device-support-policy-audit:test').length,
    1,
  );
  assert.equal(
    launch.filter((command) => command === 'npm run docs:device-support-policy-audit:check').length,
    0,
  );
  assert.equal(
    postF.filter((command) => command === 'npm run docs:device-support-policy-audit:check').length,
    1,
  );
  assert.equal(
    postF.indexOf('npm run e2e:human:manifest:check') <
      postF.indexOf('npm run docs:device-support-policy-audit:check'),
    true,
  );
});

test('pre-S launch keeps evidence contracts but never invokes the four live validators', () => {
  const launch = commands('launch:verify');
  for (const evidenceKind of [
    'native-ocr-evidence',
    'camera-lifecycle-evidence',
    'performance-evidence',
    'widget-lifecycle-evidence',
  ]) {
    assert.equal(launch.includes(`npm run phase5:${evidenceKind}`), false, evidenceKind);
    assert.equal(launch.includes(`npm run phase5:${evidenceKind}:smoke`), true, evidenceKind);
    assert.equal(
      launch.includes(`npm run phase5:${evidenceKind}:template:check`),
      true,
      evidenceKind,
    );
  }
  assert.equal(launch.includes('npm run cat05:native-ocr-source-contract:test'), true);
  assert.equal(launch.includes('npm run docs:performance-readiness-audit:check'), true);
});

test('device audit self-enforces the disjoint lifecycle', () => {
  assert.match(auditSource, /docs:device-support-policy-audit:test/);
  assert.match(auditSource, /launch:verify must not require the post-E device-support/);
  assert.match(
    auditSource,
    /release:governed-packets:check must run the post-E device-support committed check exactly once/,
  );
});
