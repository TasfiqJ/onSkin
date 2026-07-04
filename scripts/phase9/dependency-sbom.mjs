#!/usr/bin/env node
import { block, command, envSnapshot, exists, markdownList, printResult, read, warn, write } from './lib.mjs';

const errors = [];
const warnings = [];
const env = envSnapshot();

block(errors, exists('package-lock.json'), 'package-lock.json is missing.');

const lock = exists('package-lock.json') ? JSON.parse(read('package-lock.json')) : { packages: {} };
const packages = Object.entries(lock.packages ?? {})
  .filter(([name]) => name)
  .map(([name, meta]) => ({
    path: name,
    name: name.replace(/^node_modules\//, '').replace(/^apps\/mobile\/node_modules\//, ''),
    version: meta.version ?? null,
    license: meta.license ?? null,
    resolved: meta.resolved ?? null,
  }))
  .sort((a, b) => a.path.localeCompare(b.path));

let audit = null;
if (env.PHASE9_RUN_NPM_AUDIT === 'true') {
  try {
    audit = JSON.parse(command('npm', ['audit', '--json'], { stdio: ['ignore', 'pipe', 'pipe'] }));
  } catch (error) {
    const stdout = error?.stdout?.toString?.() ?? '';
    try {
      audit = JSON.parse(stdout);
    } catch {
      block(errors, false, `npm audit failed without parseable JSON: ${error instanceof Error ? error.message : String(error)}.`);
    }
  }
} else {
  warn(warnings, false, 'npm audit was not run; set PHASE9_RUN_NPM_AUDIT=true in release CI.');
}

const vulnerabilities = audit?.metadata?.vulnerabilities ?? null;
if (vulnerabilities) {
  block(errors, (vulnerabilities.high ?? 0) === 0, `npm audit found ${vulnerabilities.high} high vulnerabilities.`);
  block(errors, (vulnerabilities.critical ?? 0) === 0, `npm audit found ${vulnerabilities.critical} critical vulnerabilities.`);
}

warn(warnings, env.PHASE9_DEPENDENCY_AUDIT_PASS === 'true', 'Missing dependency/SBOM signoff: PHASE9_DEPENDENCY_AUDIT_PASS=true.');

const packet = {
  generatedAt: new Date().toISOString(),
  packageManager: lock.packageManager ?? null,
  lockfileVersion: lock.lockfileVersion ?? null,
  packageCount: packages.length,
  vulnerabilities,
  packages,
  blockers: errors,
  warnings,
};

write('docs/phase-9/generated/dependency-inventory.json', `${JSON.stringify(packet, null, 2)}\n`);
write(
  'docs/phase-9/generated/dependency-inventory.md',
  [
    '# Phase 9 Dependency Inventory',
    '',
    `Generated: ${packet.generatedAt}`,
    `Package count: ${packages.length}`,
    `Lockfile version: ${packet.lockfileVersion ?? 'unknown'}`,
    '',
    '## Vulnerabilities',
    '',
    vulnerabilities ? `\`${JSON.stringify(vulnerabilities)}\`` : '- npm audit not run in this invocation.',
    '',
    '## Blockers',
    '',
    ...markdownList(errors),
    '',
    '## Warnings',
    '',
    ...markdownList(warnings),
    '',
    '## Packages',
    '',
    ...packages.map((pkg) => `- \`${pkg.name}\` ${pkg.version ?? 'unknown'}`),
    '',
  ].join('\n'),
);

printResult('Phase 9 dependency SBOM', errors, warnings);
