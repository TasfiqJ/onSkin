#!/usr/bin/env node
import {
  block,
  command,
  envSnapshot,
  evidenceFlagEnabled,
  exists,
  markdownList,
  printResult,
  read,
  write,
} from './lib.mjs';
import {
  dependencyAuditEvidenceWarnings,
  resolveDependencyAuditProvenance,
} from './dependency-sbom-contract.mjs';
import { validateNpmAudit } from './security-advisory-exceptions.mjs';

const errors = [];
const warnings = [];
const env = envSnapshot();
const npmAuditRequested = env.PHASE9_RUN_NPM_AUDIT === 'true';
const npmAuditOffline = String(process.env.npm_config_offline ?? '').toLowerCase() === 'true';

block(errors, exists('package-lock.json'), 'package-lock.json is missing.');

const lock = exists('package-lock.json') ? JSON.parse(read('package-lock.json')) : { packages: {} };
const packageNameFromPath = (path) =>
  path.replace(/^node_modules\//, '').replace(/^apps\/mobile\/node_modules\//, '');
const packages = Object.entries(lock.packages ?? {})
  .filter(([name]) => name)
  .map(([name, meta]) => ({
    path: name,
    name: packageNameFromPath(name),
    version: meta.version ?? null,
    license: meta.license ?? null,
    resolved: meta.resolved ?? null,
  }))
  .sort((a, b) => a.path.localeCompare(b.path));

let audit = null;
let auditExitCode = null;
if (npmAuditRequested) {
  try {
    const npmExecPath = process.env.npm_execpath;
    const auditJson = npmExecPath
      ? command(process.execPath, [npmExecPath, 'audit', '--json'], {
          stdio: ['ignore', 'pipe', 'pipe'],
        })
      : command('npm', ['audit', '--json'], { stdio: ['ignore', 'pipe', 'pipe'] });
    audit = JSON.parse(auditJson);
    auditExitCode = 0;
  } catch (error) {
    const stdout = error?.stdout?.toString?.() ?? '';
    try {
      audit = JSON.parse(stdout);
      auditExitCode = error?.status;
    } catch {
      block(
        errors,
        false,
        `npm audit failed without parseable JSON: ${error instanceof Error ? error.message : String(error)}.`,
      );
    }
  }
}

const vulnerabilities = audit?.metadata?.vulnerabilities ?? null;
const auditProvenance = resolveDependencyAuditProvenance({
  requested: npmAuditRequested,
  offline: npmAuditRequested && npmAuditOffline,
  completed: vulnerabilities !== null,
});
if (vulnerabilities) {
  errors.push(
    ...validateNpmAudit({
      report: audit,
      lock,
      policy: JSON.parse(read('docs/phase-9/security-advisory-exceptions.json')),
      scannerExitCode: auditExitCode,
      today: new Date().toISOString().slice(0, 10),
    }),
  );
}

const installScriptAllowlist = new Map(
  [
    [
      '@sentry/cli@2.58.4',
      'Sentry native CLI binary installer used by @sentry/react-native tooling.',
    ],
    [
      'fsevents@2.3.3',
      'Optional Darwin file-watcher native package; not installed on non-Darwin CI runners.',
    ],
    ['unrs-resolver@1.12.2', 'ESLint resolver native binding installer used by lint tooling.'],
  ].map(([key, reason]) => [key, reason]),
);

const installScriptPackages = Object.entries(lock.packages ?? {})
  .filter(([path, meta]) => path && meta?.hasInstallScript)
  .map(([path, meta]) => {
    const name = packageNameFromPath(path);
    const version = meta.version ?? 'unknown';
    const key = `${name}@${version}`;
    return {
      path,
      name,
      version,
      key,
      dev: Boolean(meta.dev),
      optional: Boolean(meta.optional),
      license: meta.license ?? null,
      allowed: installScriptAllowlist.has(key),
      allowlistReason: installScriptAllowlist.get(key) ?? null,
    };
  })
  .sort((a, b) => a.key.localeCompare(b.key));
const unexpectedInstallScripts = installScriptPackages.filter((pkg) => !pkg.allowed);
block(
  errors,
  unexpectedInstallScripts.length === 0,
  `Unexpected dependency install scripts detected: ${unexpectedInstallScripts.map((pkg) => pkg.key).join(', ')}.`,
);

const cleanText = (value) =>
  String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();

const summarizeVia = (via) =>
  (via ?? [])
    .map((item) => {
      if (typeof item === 'string') {
        return item;
      }
      const title = cleanText(item.title || item.name || item.dependency || item.source);
      const range = item.range ? `(${item.range})` : '';
      return cleanText(`${title} ${range}`);
    })
    .filter(Boolean);

const summarizeFix = (fixAvailable) => {
  if (fixAvailable === true) {
    return 'available';
  }
  if (!fixAvailable) {
    return 'none';
  }
  const major = fixAvailable.isSemVerMajor ? 'breaking' : 'non-breaking';
  return cleanText(`${fixAvailable.name}@${fixAvailable.version} (${major})`);
};

const auditFindings = Object.values(audit?.vulnerabilities ?? {})
  .map((finding) => ({
    name: finding.name,
    severity: finding.severity,
    isDirect: Boolean(finding.isDirect),
    range: finding.range ?? null,
    via: summarizeVia(finding.via),
    effects: finding.effects ?? [],
    nodes: finding.nodes ?? [],
    fixAvailable: summarizeFix(finding.fixAvailable),
  }))
  .sort((a, b) => `${a.severity}:${a.name}`.localeCompare(`${b.severity}:${b.name}`));

const markdownCell = (value) => {
  const text = Array.isArray(value) ? value.join(', ') : String(value ?? '');
  return text.replace(/\|/g, '\\|') || '-';
};

warnings.push(
  ...dependencyAuditEvidenceWarnings({
    provenance: auditProvenance,
    signedOff: evidenceFlagEnabled(env.PHASE9_DEPENDENCY_AUDIT_PASS),
  }),
);

const packet = {
  generatedAt: new Date().toISOString(),
  auditProvenance,
  packageManager: lock.packageManager ?? null,
  lockfileVersion: lock.lockfileVersion ?? null,
  packageCount: packages.length,
  vulnerabilities,
  auditFindings,
  installScriptPackages,
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
    `Audit mode: ${packet.auditProvenance.mode}`,
    `Audit completed: ${packet.auditProvenance.completed ? 'yes' : 'no'}`,
    `Package count: ${packages.length}`,
    `Lockfile version: ${packet.lockfileVersion ?? 'unknown'}`,
    '',
    '## Vulnerabilities',
    '',
    vulnerabilities
      ? `\`${JSON.stringify(vulnerabilities)}\``
      : '- npm audit not run in this invocation.',
    '',
    '## Audit Findings',
    '',
    auditFindings.length
      ? '| Package | Severity | Direct | Via | Fix available | Nodes |\n| --- | --- | --- | --- | --- | --- |\n' +
        auditFindings
          .map(
            (finding) =>
              `| \`${markdownCell(finding.name)}\` | ${markdownCell(finding.severity)} | ${finding.isDirect ? 'yes' : 'no'} | ${markdownCell(finding.via)} | ${markdownCell(finding.fixAvailable)} | ${markdownCell(finding.nodes)} |`,
          )
          .join('\n')
      : '- No npm audit findings recorded.',
    '',
    '## Install Scripts',
    '',
    installScriptPackages.length
      ? '| Package | Dev | Optional | Allowed | Reason | Path |\n| --- | --- | --- | --- | --- | --- |\n' +
        installScriptPackages
          .map(
            (pkg) =>
              `| \`${markdownCell(pkg.key)}\` | ${pkg.dev ? 'yes' : 'no'} | ${pkg.optional ? 'yes' : 'no'} | ${pkg.allowed ? 'yes' : 'no'} | ${markdownCell(pkg.allowlistReason)} | ${markdownCell(pkg.path)} |`,
          )
          .join('\n')
      : '- No dependency install scripts recorded in the lockfile.',
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
