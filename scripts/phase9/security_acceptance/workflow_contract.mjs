import YAML from 'yaml';

const originals = ['code-gates', 'secret-scan', 'static-analysis'];
const prepare = 'prepare-source-security-decision';
const owner = 'independent-source-security-acceptance';
const sameSet = (a, b) => Array.isArray(a) && a.length === b.length && [...a].sort().join() === [...b].sort().join();
const command = (job, text) => job?.steps?.some((step) => typeof step.run === 'string' && step.run.includes(text));
const finalCommand = (job, text) => job?.steps?.some((step) => step.if === 'always()' && typeof step.run === 'string' && step.run.includes(text) && !step['continue-on-error']);

// Structural smoke contract for the same-workflow route. The Python admission
// adapter independently validates the actual reports, process exits and signature.
export function validateWorkflowAdmission(text) {
  try {
    const workflow = YAML.parse(text);
    const jobs = workflow.jobs;
    if (workflow.name !== 'Security' || workflow.permissions?.contents !== 'read' || !originals.every((name) => jobs[name])) return false;
    for (const [name, checks] of [
      ['code-gates', ['G97_PHASE9_VERIFY_OUTCOME', 'G97_DEPENDENCY_SBOM_OUTCOME']],
      ['secret-scan', ['G97_TRUFFLEHOG_OUTCOME']],
      ['static-analysis', ['G97_SEMGREP_OUTCOME']],
    ]) {
      if (jobs[name]['continue-on-error'] || !checks.every((check) => finalCommand(jobs[name], `test "\${${check}}" = "success"`))) return false;
    }
    for (const [name, id, run] of [
      ['code-gates', 'npm_exception_gate', 'security-advisory-exceptions.mjs npm'],
      ['static-analysis', 'osv_exception_gate', 'security-advisory-exceptions.mjs osv'],
    ]) {
      if (!jobs[name].steps.some((step) => step.id === id && step['continue-on-error'] === true && step.run?.includes(run))) return false;
    }
    const leak = jobs['secret-scan'].steps.find((step) => step.id === 'gitleaks');
    if (leak?.env?.GITLEAKS_VERSION !== '8.24.3' || leak.env.GITLEAKS_ENABLE_COMMENTS !== 'false' || !command(jobs['secret-scan'], 'gitleaks-results.sarif')) return false;
    const staticJob = jobs['static-analysis'];
    if (staticJob['runs-on'] !== 'ubuntu-24.04' || !command(staticJob, 'bootstrap_tools.py') || !command(staticJob, 'collect.py') || !command(staticJob, 'contract.py check') || !command(staticJob, 'python -B -m unittest discover -s scripts/phase9/security_acceptance -p test_contract.py -v')) return false;
    for (const name of [prepare, owner]) {
      if (jobs[name]?.['runs-on'] !== 'ubuntu-24.04' || jobs[name]['continue-on-error'] || !jobs[name].steps?.length || jobs[name].steps.some((step) => step['continue-on-error'])) return false;
      for (const category of ['code', 'secret', 'static']) {
        if (!jobs[name].steps.some((step) => step.uses?.startsWith('actions/download-artifact@') && step.with?.path === '${{ runner.temp }}/g97-workflow/' + category + '/')) return false;
      }
    }
    const decision = jobs[prepare], acceptance = jobs[owner];
    if (decision.if !== 'always()' || !sameSet(decision.needs, originals) || decision.environment || !command(decision, 'workflow_admission.py check')) return false;
    if (acceptance.if !== "always() && needs.prepare-source-security-decision.result == 'success'" || !sameSet(acceptance.needs, [...originals, prepare]) || !acceptance.environment || typeof acceptance.environment !== 'object' || !sameSet(Object.keys(acceptance.environment), ['name', 'deployment']) || acceptance.environment.name !== 'g97-source-security-acceptance' || acceptance.environment.deployment !== false) return false;
    const step = acceptance.steps.find((item) => item.run?.includes('workflow_admission.py accept'));
    if (!step || step.env?.G97_TRUSTED_OWNER_PUBLIC_KEY !== '${{ secrets.G97_TRUSTED_OWNER_PUBLIC_KEY }}' || step.env?.G97_OWNER_RECEIPT !== '${{ secrets.G97_OWNER_RECEIPT }}') return false;
    if (!['--approval', '--original-jobs', '--workflow-evidence', '--evidence', '--commit', '--run-id'].every((arg) => step.run.includes(arg))) return false;
    return !JSON.stringify(decision).includes('G97_TRUSTED_OWNER_PUBLIC_KEY');
  } catch {
    return false;
  }
}
