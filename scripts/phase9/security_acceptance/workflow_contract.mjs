import YAML from 'yaml';

const originals = ['code-gates', 'secret-scan', 'static-analysis'];
const automated = 'automated-source-security-acceptance';
const sameSet = (a, b) => Array.isArray(a) && a.length === b.length && [...a].sort().join() === [...b].sort().join();
const command = (job, text) => job?.steps?.some((step) => typeof step.run === 'string' && step.run.includes(text));
const finalCommand = (job, text) => job?.steps?.some((step) => step.if === 'always()' && typeof step.run === 'string' && step.run.includes(text) && !step['continue-on-error']);

// Structural smoke contract for the same-workflow route. The Python admission
// adapter independently validates the actual reports, process exits, exact source and run bindings.
export function validateWorkflowAdmission(text) {
  try {
    const workflow = YAML.parse(text);
    const jobs = workflow.jobs;
    if (workflow.name !== 'Security' || workflow.permissions?.contents !== 'read' || !originals.every((name) => jobs[name])) return false;
    for (const [name, checks] of [
      ['code-gates', ['G97_PHASE9_VERIFY_OUTCOME']],
      ['secret-scan', ['G97_TRUFFLEHOG_OUTCOME']],
      ['static-analysis', ['G97_SEMGREP_OUTCOME']],
    ]) {
      if (jobs[name]['continue-on-error'] || !checks.every((check) => finalCommand(jobs[name], `test "\${${check}}" = "success"`))) return false;
    }
    const codeJob = jobs['code-gates'];
    const sbom = codeJob.steps.find((step) => step.id === 'dependency_sbom');
    if (sbom?.['continue-on-error'] !== true || sbom.env?.PHASE9_RUN_NPM_AUDIT !== 'true' ||
        !['npm run phase9:dependency-sbom', 'sbom_exit=$?', 'dependency-sbom.exit-code', 'dependency-inventory.json', 'dependency-sbom-audit.json', 'dependency-sbom-audit.exit-code', 'exit "$sbom_exit"'].every((text) => sbom.run?.includes(text)) ||
        !finalCommand(codeJob, 'test "${G97_DEPENDENCY_SBOM_OUTCOME}" = "failure"') ||
        !finalCommand(codeJob, 'node scripts/phase9/security_acceptance/workflow_contract.mjs sbom')) return false;
    const osv = jobs['static-analysis'].steps.find((step) => step.id === 'osv');
    if (osv?.uses || osv?.['continue-on-error'] !== true ||
        !['"$RUNNER_TEMP/g97-tools/scanners/osv" scan source --format=json --output=docs/phase-9/generated/ci-scanner-evidence/osv-scan.json --recursive .', 'osv_exit=$?', 'osv-scan.exit-code', 'exit "$osv_exit"'].every((text) => osv.run?.includes(text))) return false;
    for (const [name, id, run] of [
      ['code-gates', 'npm_exception_gate', 'security-advisory-exceptions.mjs npm'],
      ['static-analysis', 'osv_exception_gate', 'security-advisory-exceptions.mjs osv'],
    ]) {
      if (!jobs[name].steps.some((step) => step.id === id && step['continue-on-error'] === true && step.run?.includes(run))) return false;
      const capture = jobs[name].steps.find((step) => step.id === id);
      const prefix = id.replace('_exception_gate', '-exception-gate');
      if (!['.stdout', '.stderr', '.exit-code'].every((suffix) => capture.run.includes(prefix + suffix)) || !capture.run.includes('exit "$gate_exit"')) return false;
    }
    const leak = jobs['secret-scan'].steps.find((step) => step.id === 'gitleaks');
    if (leak?.env?.GITLEAKS_VERSION !== '8.24.3' || leak.env.GITLEAKS_ENABLE_COMMENTS !== 'false' || !command(jobs['secret-scan'], 'gitleaks-results.sarif') || !finalCommand(jobs['secret-scan'], 'python3 -B scripts/phase9/security_acceptance/workflow_admission.py gitleaks-tool')) return false;
    const staticJob = jobs['static-analysis'];
    if (staticJob['runs-on'] !== 'ubuntu-24.04' || !command(staticJob, 'bootstrap_tools.py') || !command(staticJob, 'collect.py') || !command(staticJob, 'contract.py check') || !command(staticJob, 'python -B -m unittest discover -s scripts/phase9/security_acceptance -p test_contract.py -v')) return false;
    if (!command(staticJob, '--output "$RUNNER_TEMP/g97-evidence"') || !command(staticJob, '--evidence "$RUNNER_TEMP/g97-evidence"') ||
        !finalCommand(staticJob, 'test ! -e docs/phase-9/generated/ci-scanner-evidence/g97-evidence') ||
        !finalCommand(staticJob, 'cp -R -- "$RUNNER_TEMP/g97-evidence" docs/phase-9/generated/ci-scanner-evidence/g97-evidence')) return false;
    for (const name of [automated]) {
      if (jobs[name]?.['runs-on'] !== 'ubuntu-24.04' || jobs[name]['continue-on-error'] || !jobs[name].steps?.length || jobs[name].steps.some((step) => step['continue-on-error'])) return false;
      for (const category of ['code', 'secret', 'static']) {
        if (!jobs[name].steps.some((step) => step.uses?.startsWith('actions/download-artifact@') && step.with?.path === '${{ runner.temp }}/g97-workflow/' + category + '/')) return false;
      }
    }
    const acceptance = jobs[automated];
    if (acceptance.if !== 'always()' || !sameSet(acceptance.needs, originals) || acceptance.environment) return false;
    const step = acceptance.steps.find((item) => item.run?.includes('workflow_admission.py accept'));
    if (!step || step.env?.G97_ORIGINAL_JOBS !== '${{ toJSON(needs) }}') return false;
    if (!['--original-jobs', '--workflow-evidence', '--evidence', '--commit', '--run-id'].every((arg) => step.run.includes(arg))) return false;
    const route = JSON.stringify(acceptance);
    if (['--approval', 'G97_TRUSTED_OWNER_PUBLIC_KEY', 'G97_OWNER_RECEIPT'].some((value) => route.includes(value))) return false;
    return !jobs['independent-source-security-acceptance'] && !jobs['prepare-source-security-decision'];
  } catch {
    return false;
  }
}

// Candidate-only validation of the original audited SBOM refusal. This grants no approval.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateNpmAudit, validateOsvScan, REVIEWED_ADVISORIES } from '../security-advisory-exceptions.mjs';
import { dependencyAuditEvidenceWarnings } from '../dependency-sbom-contract.mjs';

const auditedInstallScripts = new Map([
  ['@sentry/cli@2.58.4', 'Sentry native CLI binary installer used by @sentry/react-native tooling.'],
  ['fsevents@2.3.3', 'Optional Darwin file-watcher native package; not installed on non-Darwin CI runners.'],
  ['unrs-resolver@1.12.2', 'ESLint resolver native binding installer used by lint tooling.'],
]);
const summaryText = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const packageName = path => path.replace(/^node_modules\//, '').replace(/^apps\/mobile\/node_modules\//, '');

export function assertLegacyAuditedSbom({ packet, audit, lock, policy, auditExit, sbomExit, now = new Date() }) {
  assert.equal(auditExit, 1); assert.equal(sbomExit, 1);
  assert.deepEqual(Object.keys(packet).sort(), ['generatedAt', 'auditProvenance', 'packageManager', 'lockfileVersion', 'packageCount', 'vulnerabilities', 'auditFindings', 'installScriptPackages', 'packages', 'blockers', 'warnings'].sort());
  const generated = new Date(packet.generatedAt);
  assert.equal(generated.toISOString(), packet.generatedAt);
  assert.ok(generated <= now && now - generated <= 6 * 60 * 60 * 1000);
  const provenance = { requested: true, mode: 'registry', completed: true };
  assert.deepEqual(packet.auditProvenance, provenance);
  assert.ok(policy.exceptions.every(entry => entry.expiresOn === '2026-10-17'));
  const blockers = validateNpmAudit({ report: audit, lock, policy, scannerExitCode: auditExit, today: now.toISOString().slice(0, 10) });
  assert.deepEqual([...blockers].sort(), REVIEWED_ADVISORIES.map(entry => `${entry.package}: review is expired or dates are invalid`).sort());
  assert.deepEqual(packet.blockers, blockers);
  const counts = { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 };
  for (const finding of Object.values(audit.vulnerabilities)) {
    assert.ok(Object.hasOwn(counts, finding.severity) && finding.severity !== 'total');
    counts[finding.severity]++; counts.total++;
  }
  assert.deepEqual(audit.metadata.vulnerabilities, counts);
  assert.deepEqual(packet.vulnerabilities, counts);
  assert.deepEqual(packet.warnings, [...dependencyAuditEvidenceWarnings({ provenance, signedOff: false })]);
  const entries = Object.entries(lock.packages).filter(([path]) => path);
  const packages = entries.map(([path, meta]) => ({ path, name: packageName(path), version: meta.version ?? null, license: meta.license ?? null, resolved: meta.resolved ?? null })).sort((a,b) => a.path.localeCompare(b.path));
  assert.deepEqual(packet.packages, packages);
  assert.equal(packet.packageCount, packages.length);
  assert.equal(packet.lockfileVersion, lock.lockfileVersion ?? null);
  assert.equal(packet.packageManager, lock.packageManager ?? null);
  const scripts = entries.filter(([,meta]) => meta?.hasInstallScript).map(([path,meta]) => {
    const name = packageName(path), version = meta.version ?? 'unknown', key = `${name}@${version}`;
    return { path, name, version, key, dev: Boolean(meta.dev), optional: Boolean(meta.optional), license: meta.license ?? null, allowed: auditedInstallScripts.has(key), allowlistReason: auditedInstallScripts.get(key) ?? null };
  }).sort((a,b) => a.key.localeCompare(b.key));
  assert.ok(scripts.every(item => item.allowed));
  assert.deepEqual(packet.installScriptPackages, scripts);
  const findings = Object.values(audit.vulnerabilities).map(finding => ({
    name: finding.name, severity: finding.severity, isDirect: Boolean(finding.isDirect), range: finding.range ?? null,
    via: (finding.via ?? []).map(item => typeof item === 'string' ? item : summaryText(`${summaryText(item.title || item.name || item.dependency || item.source)} ${item.range ? `(${item.range})` : ''}`)).filter(Boolean),
    effects: finding.effects ?? [], nodes: finding.nodes ?? [],
    fixAvailable: finding.fixAvailable === true ? 'available' : !finding.fixAvailable ? 'none' : summaryText(`${finding.fixAvailable.name}@${finding.fixAvailable.version} (${finding.fixAvailable.isSemVerMajor ? 'breaking' : 'non-breaking'})`),
  })).sort((a,b) => `${a.severity}:${a.name}`.localeCompare(`${b.severity}:${b.name}`));
  assert.deepEqual(packet.auditFindings, findings);
  return { status: 'EXACT_EXPIRED_SBOM_POLICY_REFUSAL_BOUND', auditRecords: counts.total, expiredBlockers: blockers.length, rawExit: sbomExit, rawScannerPass: false, approval: false };
}

export function assertLegacyPolicyRefusals({ npmAudit, osvReport, lock, policy, npm, osv, now = new Date() }) {
  const today = now.toISOString().slice(0, 10);
  const npmErrors = validateNpmAudit({ report: npmAudit, lock, policy, scannerExitCode: 1, today });
  assert.deepEqual([...npmErrors].sort(), REVIEWED_ADVISORIES.map(entry => `${entry.package}: review is expired or dates are invalid`).sort());
  const osvErrors = validateOsvScan({ report: osvReport, lock, policy, today });
  assert.ok(osvErrors.length >= REVIEWED_ADVISORIES.length);
  for (const [actual, errors] of [[npm, npmErrors], [osv, osvErrors]]) {
    assert.deepEqual(Object.keys(actual).sort(), ['exit', 'stderr', 'stdout']);
    assert.equal(actual.exit, 1); assert.equal(actual.stdout, '');
    assert.equal(actual.stderr, errors.join('\n') + '\n');
  }
  return { status: 'EXACT_LEGACY_POLICY_REFUSALS_BOUND', approval: false, rawScannerPass: false };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    assert.ok(['sbom', 'policies'].includes(process.argv[2])); assert.ok([3, 4].includes(process.argv.length));
    const root = fileURLToPath(new URL('../../../', import.meta.url));
    const load = path => JSON.parse(readFileSync(resolve(root,path), 'utf8'));
    const directory = process.argv[3] ? resolve(process.argv[3]) + '/' : 'docs/phase-9/generated/ci-scanner-evidence/';
    const policyBytes = readFileSync(resolve(root,'docs/phase-9/security-advisory-exceptions.json'));
    assert.equal(createHash('sha256').update(policyBytes).digest('hex'), '938344d88765e8c77e5d9bb0b32401f22b503f2aa18394c05aa98d87390f154d');
    if (process.argv[2] === 'policies') {
      assert.equal(process.argv.length, 4);
      const group = mode => {
        const prefix = directory + (mode === 'npm' ? 'code/' : 'static/') + mode + '-exception-gate';
        const exitText = readFileSync(prefix + '.exit-code', 'utf8').trim(); assert.equal(exitText, '1');
        return { exit: 1, stdout: readFileSync(prefix + '.stdout', 'utf8'), stderr: readFileSync(prefix + '.stderr', 'utf8') };
      };
      const result = assertLegacyPolicyRefusals({ npmAudit: load(directory + 'code/npm-audit-high.json'), osvReport: load(directory + 'static/osv-scan.json'), lock: load('package-lock.json'), policy: JSON.parse(policyBytes), npm: group('npm'), osv: group('osv') });
      console.log(JSON.stringify(result));
    } else {
    const exit = name => { const value = readFileSync(resolve(root,directory+name), 'utf8').trim(); assert.equal(value, '1'); return 1; };
    const result = assertLegacyAuditedSbom({ packet: load(directory+'dependency-inventory.json'), audit: load(directory+'dependency-sbom-audit.json'), lock: load('package-lock.json'), policy: JSON.parse(policyBytes), auditExit: exit('dependency-sbom-audit.exit-code'), sbomExit: exit('dependency-sbom.exit-code') });
    console.log(JSON.stringify(result));
    }
  } catch { console.log(JSON.stringify({ status: 'REJECTED', code: process.argv[2] === 'policies' ? 'WORKFLOW_LEGACY_POLICY_REFUSAL_DRIFT' : 'WORKFLOW_SBOM_UNRELATED_FAILURE_OR_DRIFT', approval: false })); process.exitCode = 1; }
}
