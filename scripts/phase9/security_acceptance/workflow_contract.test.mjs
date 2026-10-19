import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import YAML from 'yaml';
import { validateWorkflowAdmission } from './workflow_contract.mjs';
const text = readFileSync(new URL('../../../.github/workflows/security.yml', import.meta.url), 'utf8');
const original = YAML.parse(text);
const reject = (change) => { const workflow = structuredClone(original); change(workflow); assert.equal(validateWorkflowAdmission(YAML.stringify(workflow)), false); };
test('actual Security includes mandatory exact-source owner admission', () => assert.equal(validateWorkflowAdmission(text), true));
test('cannot omit an original job or its independent admission dependency', () => {
  reject((w) => delete w.jobs['secret-scan']);
  reject((w) => w.jobs['independent-source-security-acceptance'].needs.pop());
});
test('cannot skip decision after a scanner or ignore a failed acceptance', () => {
  reject((w) => w.jobs['prepare-source-security-decision'].if = 'success()');
  reject((w) => w.jobs['independent-source-security-acceptance']['continue-on-error'] = true);
});
test('unrelated checks remain hard gates', () => {
  reject((w) => w.jobs['code-gates'].steps = w.jobs['code-gates'].steps.filter((s) => s.name !== 'Enforce code-gate results'));
  reject((w) => w.jobs['secret-scan'].steps = w.jobs['secret-scan'].steps.filter((s) => s.name !== 'Enforce secret scanner results'));
});
test('expired original policy execution is retained', () => {
  reject((w) => w.jobs['code-gates'].steps = w.jobs['code-gates'].steps.filter((s) => s.id !== 'npm_exception_gate'));
  reject((w) => w.jobs['static-analysis'].steps = w.jobs['static-analysis'].steps.filter((s) => s.id !== 'osv_exception_gate'));
});
test('owner trust cannot move to an unprotected or permissive job', () => {
  reject((w) => delete w.jobs['independent-source-security-acceptance'].environment);
  reject((w) => w.jobs['independent-source-security-acceptance'].environment.deployment = true);
  reject((w) => w.jobs['independent-source-security-acceptance'].steps.at(-1)['continue-on-error'] = true);
  reject((w) => delete w.jobs['independent-source-security-acceptance'].steps.at(-1).env.G97_TRUSTED_OWNER_PUBLIC_KEY);
});
test('all three raw original artifacts are mandatory', () => {
  reject((w) => w.jobs['prepare-source-security-decision'].steps = w.jobs['prepare-source-security-decision'].steps.filter((s) => s.with?.path !== '${{ runner.temp }}/g97-workflow/secret/'));
});
test('full reviewed collector cannot be replaced by a version-only scanner', () => {
  reject((w) => w.jobs['static-analysis'].steps.find((s) => s.id === 'semgrep').run = 'semgrep --version');
  reject((w) => { const step = w.jobs['static-analysis'].steps.find((s) => s.id === 'semgrep'); step.run = step.run.replace('python -B -m unittest discover -s scripts/phase9/security_acceptance -p test_contract.py -v\n', ''); });
});
test('manual technical workflow supplies no owner acceptance route', () => {
  const manual = YAML.parse(readFileSync(new URL('../../../.github/workflows/g97-security-acceptance.yml', import.meta.url), 'utf8'));
  assert.deepEqual(Object.keys(manual.on), ['workflow_dispatch']);
  assert.deepEqual(Object.keys(manual.jobs), ['collect']);
  assert.equal(JSON.stringify(manual).includes('workflow_admission.py accept'), false);
});
