import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  REVIEWED_ADVISORIES,
  validateLiveReviewData,
  validateNpmAudit,
  validateOsvScan,
} from './security-advisory-exceptions.mjs';

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const POLICY = JSON.parse(
  readFileSync(resolve(ROOT, 'docs/phase-9/security-advisory-exceptions.json'), 'utf8'),
);
const TODAY = '2026-10-03';

function fixture() {
  const lock = {
    packages: {
      'node_modules/braces': { version: '3.0.3' },
      'node_modules/node-forge': { version: '1.4.0' },
      'node_modules/@expo/cli': { version: '57.0.27' },
    },
  };
  const report = {
    metadata: { vulnerabilities: { high: 3, critical: 0 } },
    vulnerabilities: {
      braces: {
        severity: 'high',
        nodes: ['node_modules/braces'],
        via: [
          {
            name: 'braces',
            severity: 'high',
            url: 'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm',
          },
        ],
      },
      'node-forge': {
        severity: 'high',
        nodes: ['node_modules/node-forge'],
        via: [
          {
            name: 'node-forge',
            severity: 'high',
            url: 'https://github.com/advisories/GHSA-86w9-cpqp-85rv',
          },
        ],
      },
      '@expo/cli': {
        severity: 'high',
        nodes: ['node_modules/@expo/cli'],
        via: ['node-forge'],
      },
    },
  };
  const osv = {
    results: [
      {
        source: { path: 'package-lock.json', type: 'lockfile' },
        packages: REVIEWED_ADVISORIES.map((entry) => ({
          package: { name: entry.package, version: entry.version, ecosystem: 'npm' },
          vulnerabilities: [{ id: entry.advisory }],
        })),
      },
    ],
  };
  return { lock, report, osv, policy: structuredClone(POLICY), today: TODAY };
}

test('accepts only the reviewed npm and OSV findings, including inherited npm findings', () => {
  const { lock, report, osv, policy, today } = fixture();
  assert.deepEqual(validateNpmAudit({ report, lock, policy, today, scannerExitCode: 1 }), []);
  assert.deepEqual(validateOsvScan({ report: osv, lock, policy, today }), []);
});

test('rejects any new High advisory and any unreviewed OSV finding', () => {
  const { lock, report, osv, policy, today } = fixture();
  report.vulnerabilities.braces.via.push({
    name: 'braces',
    severity: 'high',
    url: 'https://github.com/advisories/GHSA-aaaa-bbbb-cccc',
  });
  assert.match(
    validateNpmAudit({ report, lock, policy, today, scannerExitCode: 1 }).join('\n'),
    /unreviewed high\/critical npm advisory/u,
  );
  osv.results[0].packages[0].vulnerabilities.push({ id: 'GHSA-aaaa-bbbb-cccc' });
  assert.match(validateOsvScan({ report: osv, lock, policy, today }).join('\n'), /unreviewed OSV/u);
});

test('resolves an inherited npm advisory through a dependency cycle', () => {
  const { lock, report, policy, today } = fixture();
  lock.packages['node_modules/metro'] = { version: '0.84.5' };
  lock.packages['node_modules/metro-config'] = { version: '0.84.5' };
  report.vulnerabilities.metro = {
    severity: 'high',
    nodes: ['node_modules/metro'],
    via: ['metro-config'],
  };
  report.vulnerabilities['metro-config'] = {
    severity: 'high',
    nodes: ['node_modules/metro-config'],
    via: ['metro', 'braces'],
  };
  report.metadata.vulnerabilities.high = 5;
  assert.deepEqual(validateNpmAudit({ report, lock, policy, today, scannerExitCode: 1 }), []);
});

test('rejects changed package versions, removed scanner evidence, and scanner errors', () => {
  const { lock, report, osv, policy, today } = fixture();
  lock.packages['node_modules/node-forge'].version = '1.4.1';
  assert.match(
    validateNpmAudit({ report, lock, policy, today, scannerExitCode: 1 }).join('\n'),
    /installed version or package path changed/u,
  );
  assert.match(
    validateOsvScan({ report: osv, lock, policy, today }).join('\n'),
    /installed version/u,
  );
  assert.match(
    validateNpmAudit({ report: null, lock, policy, today, scannerExitCode: 2 }).join('\n'),
    /missing vulnerability metadata/u,
  );
  assert.match(
    validateNpmAudit({ report, lock, policy, today, scannerExitCode: 2 }).join('\n'),
    /exit code is inconsistent/u,
  );
  assert.match(validateOsvScan({ report: {}, lock, policy, today }).join('\n'), /missing results/u);
});

test('fails closed when an approved advisory disappears from either scanner report', () => {
  const { lock, report, osv, policy, today } = fixture();
  delete report.vulnerabilities.braces;
  report.metadata.vulnerabilities.high = 2;
  assert.match(
    validateNpmAudit({ report, lock, policy, today, scannerExitCode: 1 }).join('\n'),
    /reviewed npm advisory is missing/u,
  );
  osv.results[0].packages.shift();
  assert.match(
    validateOsvScan({ report: osv, lock, policy, today }).join('\n'),
    /reviewed OSV advisory is missing/u,
  );
});

test('rejects expanded, expired, and weakened exception records', () => {
  const { lock, report, policy, today } = fixture();
  policy.exceptions.push({ ...policy.exceptions[0], advisory: 'GHSA-aaaa-bbbb-cccc' });
  assert.match(
    validateNpmAudit({ report, lock, policy, today, scannerExitCode: 1 }).join('\n'),
    /exactly the two reviewed entries|identity is not reviewed/u,
  );
  policy.exceptions.pop();
  policy.exceptions[0].scope = 'production runtime';
  assert.match(
    validateNpmAudit({ report, lock, policy, today, scannerExitCode: 1 }).join('\n'),
    /tooling\/dev scope is missing/u,
  );
  policy.exceptions[0].scope = POLICY.exceptions[0].scope;
  assert.match(
    validateNpmAudit({ report, lock, policy, today: '2026-10-18', scannerExitCode: 1 }).join('\n'),
    /review is expired/u,
  );
});

test('fails when upstream lists a newer release or a patched advisory range', () => {
  const registry = {
    braces: { versions: { '3.0.3': {} } },
    'node-forge': { versions: { '1.4.0': {} } },
  };
  const advisories = Object.fromEntries(
    REVIEWED_ADVISORIES.map((entry) => [
      entry.advisory,
      {
        id: entry.advisory,
        affected: [
          {
            package: { name: entry.package, ecosystem: 'npm' },
            ranges: [{ events: [{ introduced: '0' }, { last_affected: entry.version }] }],
          },
        ],
      },
    ]),
  );
  assert.deepEqual(validateLiveReviewData({ registry, advisories }), []);
  registry.braces.versions['3.0.4'] = {};
  assert.match(validateLiveReviewData({ registry, advisories }).join('\n'), /newer release/u);
  delete registry.braces.versions['3.0.4'];
  advisories['GHSA-86w9-cpqp-85rv'].affected[0].ranges[0].events.push({ fixed: '1.4.1' });
  assert.match(validateLiveReviewData({ registry, advisories }).join('\n'), /patched release/u);
});

test('retains the real Vite high aggregate with two moderate primary children', () => {
  const value = fixture();
  // Original preserved npm output, including every primary field and child.
  const original = JSON.parse(readFileSync(resolve(ROOT,
    'docs/brain/checkpoints/M1-03/evidence/original-code/npm-audit-high.json'), 'utf8'));
  value.report.vulnerabilities.vite = structuredClone(original.vulnerabilities.vite);
  value.lock.packages['node_modules/vite'] = { version: '8.1.3' };
  value.report.metadata.vulnerabilities.high++;
  const check = () => validateNpmAudit({ ...value, scannerExitCode: 1 });
  const errors = check();
  assert.equal(errors.filter(e => /unreviewed moderate npm advisory: vite@8.1.3/u.test(e)).length, 2);
  assert.equal(errors.filter(e => /unreviewed high\/critical npm advisory: vite@8.1.3/u.test(e)).length, 1);
  assert.equal(errors.some(e => /malformed/u.test(e)), false);
  for (const child of original.vulnerabilities.vite.via) {
    assert.ok(errors.some(e => e.includes(child.url.split('/').at(-1)) && e.includes(`severity: ${child.severity}`)));
  }
  value.report.vulnerabilities.vite.via.push(structuredClone(original.vulnerabilities.vite.via[0]));
  assert.deepEqual(check(), errors); // Deduplicate identity+severity without dropping distinct children.
  assert.ok(validateNpmAudit({ ...value, scannerExitCode: 2 }).some(e => /exit code is inconsistent/u.test(e)));
  assert.equal(validateNpmAudit({ ...value, today: '2026-10-21', scannerExitCode: 1 })
    .filter(e => /review is expired/u.test(e)).length, 2);
  for (const change of [
    v => delete v.report.vulnerabilities.vite.via,
    v => v.report.vulnerabilities.vite.via.push('missing-root'),
    v => v.report.vulnerabilities.vite.via[0].severity = 'unknown',
    v => delete v.report.vulnerabilities.vite.via[0].severity,
    v => v.report.vulnerabilities.vite.via[0].name = 'other-package',
    v => v.report.vulnerabilities.vite.nodes = ['node_modules/braces'],
    v => v.report.vulnerabilities.vite.severity = 'unknown',
  ]) {
    const bad = structuredClone(value); change(bad);
    assert.ok(validateNpmAudit({ ...bad, scannerExitCode: 1 }).some(e => /malformed|unbound/u.test(e)));
  }
  value.report.vulnerabilities.vite.via[0].severity = 'critical';
  assert.ok(check().some(e => /unreviewed high\/critical.*severity: critical/u.test(e)));
});
