import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import YAML from 'yaml';
import { validateWorkflowAdmission } from './workflow_contract.mjs';
const text = readFileSync(new URL('../../../.github/workflows/security.yml', import.meta.url), 'utf8');
const original = YAML.parse(text);
const reject = (change) => { const workflow = structuredClone(original); change(workflow); assert.equal(validateWorkflowAdmission(YAML.stringify(workflow)), false); };
test('actual Security includes mandatory automated single-owner source-only admission', () => assert.equal(validateWorkflowAdmission(text), true));
test('cannot omit an original job or its mandatory automated admission dependency', () => {
  reject((w) => delete w.jobs['secret-scan']);
  reject((w) => w.jobs['automated-source-security-acceptance'].needs.pop());
});
test('cannot skip decision after a scanner or ignore a failed acceptance', () => {
  reject((w) => w.jobs['automated-source-security-acceptance'].if = 'success()');
  reject((w) => w.jobs['automated-source-security-acceptance']['continue-on-error'] = true);
});
test('unrelated checks remain hard gates', () => {
  reject((w) => w.jobs['code-gates'].steps = w.jobs['code-gates'].steps.filter((s) => s.name !== 'Enforce code-gate results'));
  reject((w) => w.jobs['secret-scan'].steps = w.jobs['secret-scan'].steps.filter((s) => s.name !== 'Enforce secret scanner results'));
});
test('expired original policy execution is retained', () => {
  reject((w) => w.jobs['code-gates'].steps = w.jobs['code-gates'].steps.filter((s) => s.id !== 'npm_exception_gate'));
  reject((w) => w.jobs['static-analysis'].steps = w.jobs['static-analysis'].steps.filter((s) => s.id !== 'osv_exception_gate'));
});
test('automated admission cannot regain an external approval dependency or ignore failure', () => {
  reject((w) => w.jobs['automated-source-security-acceptance'].environment = { name: 'external-review' });
  reject((w) => w.jobs['automated-source-security-acceptance'].steps.find(s => s.run?.includes('workflow_admission.py accept'))['continue-on-error'] = true);
  reject((w) => w.jobs['automated-source-security-acceptance'].steps.find(s => s.run?.includes('workflow_admission.py accept')).run += '\nrequire --approval forged.json');
});
test('all three raw original artifacts are mandatory', () => {
  reject((w) => w.jobs['automated-source-security-acceptance'].steps = w.jobs['automated-source-security-acceptance'].steps.filter((s) => s.with?.path !== '${{ runner.temp }}/g97-workflow/secret/'));
});
test('full reviewed collector cannot be replaced by a version-only scanner', () => {
  reject((w) => w.jobs['static-analysis'].steps.find((s) => s.id === 'semgrep').run = 'semgrep --version');
  reject((w) => { const step = w.jobs['static-analysis'].steps.find((s) => s.id === 'semgrep'); step.run = step.run.replace('python -B -m unittest discover -s scripts/phase9/security_acceptance -p test_contract.py -v\n', ''); });
});
test('manual technical workflow supplies no automated acceptance route', () => {
  const manual = YAML.parse(readFileSync(new URL('../../../.github/workflows/g97-security-acceptance.yml', import.meta.url), 'utf8'));
  assert.deepEqual(Object.keys(manual.on), ['workflow_dispatch']);
  assert.deepEqual(Object.keys(manual.jobs), ['collect']);
  assert.equal(JSON.stringify(manual).includes('workflow_admission.py accept'), false);
});

import { gunzipSync } from 'node:zlib';
import { assertLegacyAuditedSbom } from './workflow_contract.mjs';
const readFixture = name => JSON.parse(gunzipSync(readFileSync(new URL(name, import.meta.url))));
const actualSbomExecution = readFixture('./legacy-sbom-fixture.json.gz');
const actualAuditedSbom = actualSbomExecution.packet;
const actualNpmAudit = actualSbomExecution.audit;
const sbomLock = JSON.parse(readFileSync(new URL('../../../package-lock.json', import.meta.url)));
const legacyPolicy = JSON.parse(readFileSync(new URL('../../../docs/phase-9/security-advisory-exceptions.json', import.meta.url)));
const sbomInputs = () => ({ packet: structuredClone(actualAuditedSbom), audit: structuredClone(actualNpmAudit), lock: structuredClone(sbomLock), policy: structuredClone(legacyPolicy), auditExit: 1, sbomExit: 1, now: new Date(Date.parse(actualAuditedSbom.generatedAt) + 1000) });
const rejectSbom = change => { const value = sbomInputs(); change(value); assert.throws(() => assertLegacyAuditedSbom(value)); };
test('actual source-generated audited SBOM has only the two unchanged expired-policy refusals', () => {
  const result = assertLegacyAuditedSbom(sbomInputs());
  assert.equal(result.rawScannerPass, false); assert.equal(result.approval, false); assert.equal(result.expiredBlockers, 2);
});
test('original audited command, raw exit, packet capture and mandatory structural decision cannot be omitted', () => {
  reject(w => w.jobs['code-gates'].steps.find(s => s.id === 'dependency_sbom').env.PHASE9_RUN_NPM_AUDIT = 'false');
  reject(w => { const s=w.jobs['code-gates'].steps.find(s => s.id === 'dependency_sbom'); s.run=s.run.replaceAll('dependency-sbom.exit-code','omitted-exit-code'); });
  reject(w => { const s=w.jobs['code-gates'].steps.find(s => s.name === 'Enforce code-gate results'); s.run=s.run.replace('node scripts/phase9/security_acceptance/workflow_contract.mjs sbom','true'); });
});
test('audited SBOM cannot add or hide a non-policy blocker or substitute an execution exit', () => {
  rejectSbom(v => v.packet.blockers.push('Unexpected dependency install scripts detected.'));
  rejectSbom(v => v.packet.blockers.pop()); rejectSbom(v => v.packet.blockers = []);
  for (const exit of [0, 2, 127, 137, 143, '1', true]) { rejectSbom(v => v.sbomExit=exit); rejectSbom(v => v.auditExit=exit); }
});
test('SBOM provenance cannot claim an offline, missing or incomplete registry audit', () => {
  for (const mode of ['offline_cache','not_run']) rejectSbom(v => v.packet.auditProvenance.mode=mode);
  rejectSbom(v => v.packet.auditProvenance.requested=false); rejectSbom(v => v.packet.auditProvenance.completed=false);
});
test('audited SBOM preserves exact typed advisory counts and every summary record', () => {
  rejectSbom(v => v.packet.vulnerabilities.high++); rejectSbom(v => v.packet.vulnerabilities.total=String(v.packet.vulnerabilities.total));
  rejectSbom(v => v.packet.auditFindings.pop()); rejectSbom(v => v.packet.auditFindings.push(structuredClone(v.packet.auditFindings[0])));
  rejectSbom(v => v.packet.auditFindings[0].fixAvailable='manufactured patched release');
});
test('audited SBOM preserves every source-lock package and install-script provenance', () => {
  rejectSbom(v => v.packet.packages.pop()); rejectSbom(v => v.packet.packages[0].version='unreviewed');
  rejectSbom(v => v.packet.packageCount--); rejectSbom(v => v.packet.installScriptPackages[0].allowed=false);
  rejectSbom(v => v.packet.installScriptPackages[0].allowlistReason='invented approval');
});
test('SBOM cannot fabricate signoff, omit fields or change the expired policy', () => {
  rejectSbom(v => v.packet.warnings=[]); rejectSbom(v => delete v.packet.auditFindings);
  rejectSbom(v => v.packet.approval=true); rejectSbom(v => v.policy.exceptions[0].expiresOn='2026-10-21');
});
test('audited SBOM rejects future, stale, malformed timestamps and changed raw findings', () => {
  rejectSbom(v => v.packet.generatedAt=new Date(v.now.getTime()+1).toISOString());
  rejectSbom(v => v.packet.generatedAt=new Date(v.now.getTime()-7*60*60*1000).toISOString());
  rejectSbom(v => v.packet.generatedAt='unknown'); rejectSbom(v => v.audit.vulnerabilities.braces.range='changed');
});

test('original OSV uses the verified exact binary and captures its real numeric exit', () => {
  reject(w => { const s=w.jobs['static-analysis'].steps.find(s => s.id === 'osv'); s.run=s.run.replace('osv-scan.exit-code','omitted-exit-code'); });
  reject(w => { const s=w.jobs['static-analysis'].steps.find(s => s.id === 'osv'); s.run=s.run.replace('scan source', '--version'); });
  reject(w => w.jobs['static-analysis'].steps.find(s => s.id === 'osv').uses='unreviewed/action@main');
});

import { assertLegacyPolicyRefusals } from './workflow_contract.mjs';
const legacyRefusalInputs = () => ({ npmAudit: structuredClone(actualNpmAudit), osvReport: readFixture('./test-fixtures.json.gz').osv.report, lock: structuredClone(sbomLock), policy: structuredClone(legacyPolicy), ...structuredClone(actualSbomExecution.policyRefusals) });
test('actual original exception CLI refusals bind source-bound scanner bytes and no approval', () => {
  assert.equal(assertLegacyPolicyRefusals(legacyRefusalInputs()).approval, false);
});
test('legacy fetch errors, newer releases, crashes, missing errors or invented stdout cannot be waived', () => {
  for (const mode of ['npm', 'osv']) {
    for (const error of ['security review source returned HTTP 503', 'braces: a newer release requires security review', 'braces: a patched release is listed for the reviewed advisory', 'Cannot find module']) {
      const input = legacyRefusalInputs(); input[mode].stderr = error + '\n'; assert.throws(() => assertLegacyPolicyRefusals(input));
    }
    for (const exit of [0, 2, 127, 137, '1', true]) { const input=legacyRefusalInputs(); input[mode].exit=exit; assert.throws(() => assertLegacyPolicyRefusals(input)); }
    const input=legacyRefusalInputs();input[mode].stdout='invented success';assert.throws(() => assertLegacyPolicyRefusals(input));
    reject(w => { const step=w.jobs[mode==='npm'?'code-gates':'static-analysis'].steps.find(s => s.id===mode+'_exception_gate');step.run=step.run.replaceAll(mode+'-exception-gate.stderr','omitted-refusal'); });
  }
});

test('Gitleaks actual executable identity remains a mandatory original-job artifact', () => {
  reject(w => w.jobs['secret-scan'].steps = w.jobs['secret-scan'].steps.filter(s => s.name !== 'Bind actual Gitleaks executable'));
  reject(w => w.jobs['secret-scan'].steps.find(s => s.name === 'Bind actual Gitleaks executable')['continue-on-error'] = true);
});

test('automated admission cannot omit exact commit/run or actual original outcomes', () => {
  for (const argument of ['--commit', '--run-id', '--original-jobs', '--workflow-evidence', '--evidence']) {
    reject(w => { const step = w.jobs['automated-source-security-acceptance'].steps.find(s => s.run?.includes('workflow_admission.py accept')); step.run = step.run.replaceAll(argument, '--omitted'); });
  }
  reject(w => delete w.jobs['automated-source-security-acceptance'].steps.find(s => s.run?.includes('workflow_admission.py accept')).env.G97_ORIGINAL_JOBS);
});
test('automated admission cannot be replaced by a separate green collection job', () => {
  reject(w => delete w.jobs['automated-source-security-acceptance']);
  reject(w => w.jobs['automated-source-security-acceptance'].steps.find(s => s.run?.includes('workflow_admission.py accept')).run = 'true');
});
test('single-owner route contains no protected reviewer, signer, key or receipt dependency', () => {
  const job = original.jobs['automated-source-security-acceptance'];
  assert.equal(job.environment, undefined);
  assert.equal(JSON.stringify(job).includes('G97_OWNER_RECEIPT'), false);
  assert.equal(JSON.stringify(job).includes('G97_TRUSTED_OWNER_PUBLIC_KEY'), false);
  assert.equal(JSON.stringify(job).includes('--approval'), false);
});
