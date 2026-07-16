import { parseDocument } from 'yaml';

const SCRIPT_NAME = /^[a-z0-9][a-z0-9:-]*$/;
const SAFE_PARENT_COMMAND = /^(?:npm run [a-z0-9][a-z0-9:-]*|npm test)$/;
const DEFAULT_WORKFLOW_JOB = 'checks';
const DEFAULT_WORKFLOW_STEP = 'Verify installed iOS privacy sources';

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function sameKeys(value, expected) {
  if (!isRecord(value)) return false;
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function parseParentCommandChain(command) {
  if (typeof command !== 'string' || command.length === 0 || command.length > 100_000) {
    return null;
  }
  if (/[\r\n]/u.test(command) || command !== command.trim()) return null;

  const segments = command.split(/\s+&&\s+/u);
  if (
    segments.length === 0 ||
    segments.some((segment) => segment !== segment.trim() || !SAFE_PARENT_COMMAND.test(segment))
  ) {
    return null;
  }
  return segments;
}

function exactWorkflowCommands(command) {
  if (typeof command !== 'string' || command.length === 0 || command.length > 100_000) return null;
  let normalized = command.replace(/\r\n/gu, '\n');
  if (normalized.endsWith('\n')) normalized = normalized.slice(0, -1);
  if (normalized.length === 0 || normalized.endsWith('\n')) return null;
  const lines = normalized.split('\n');
  if (lines.some((line) => !/^npm run [a-z0-9][a-z0-9:-]*$/u.test(line))) return null;
  return lines;
}

function parseWorkflow(workflowText) {
  if (typeof workflowText !== 'string' || workflowText.length === 0) {
    throw new TypeError('Workflow YAML must be a non-empty string.');
  }
  if (workflowText.length > 1_000_000) {
    throw new RangeError('Workflow YAML exceeds the reviewed one-megabyte bound.');
  }

  const document = parseDocument(workflowText, {
    merge: false,
    strict: true,
    uniqueKeys: true,
  });
  if (document.errors.length > 0) {
    throw new Error(`Workflow YAML is invalid: ${document.errors[0].message}`);
  }
  if (document.warnings.length > 0) {
    throw new Error(`Workflow YAML is ambiguous: ${document.warnings[0].message}`);
  }

  const workflow = document.toJS({ maxAliasCount: 0 });
  if (!isRecord(workflow) || !isRecord(workflow.jobs)) {
    throw new Error('Workflow YAML must contain a jobs mapping.');
  }
  return workflow;
}

function validateVerifierDefinitions(verifierDefinitions) {
  if (!isRecord(verifierDefinitions)) {
    throw new TypeError('verifierDefinitions must be an object.');
  }
  const entries = Object.entries(verifierDefinitions);
  if (
    entries.length === 0 ||
    entries.some(
      ([script, command]) =>
        !SCRIPT_NAME.test(script) ||
        typeof command !== 'string' ||
        command.length === 0 ||
        command.length > 10_000 ||
        command !== command.trim() ||
        /[\r\n]/u.test(command),
    )
  ) {
    throw new TypeError(
      'verifierDefinitions must map npm script names to exact single-line commands.',
    );
  }
  return entries;
}

function validateParentScripts(parentScripts) {
  if (
    !Array.isArray(parentScripts) ||
    parentScripts.length === 0 ||
    parentScripts.some((script) => typeof script !== 'string' || !SCRIPT_NAME.test(script)) ||
    new Set(parentScripts).size !== parentScripts.length
  ) {
    throw new TypeError('parentScripts must be a non-empty unique list of npm script names.');
  }
}

function auditWorkflowStep({ workflow, verifierScripts, workflowJob, workflowStep }, errors) {
  const triggers = workflow.on;
  const pullRequestTriggerValid =
    triggers?.pull_request === null ||
    (isRecord(triggers?.pull_request) && Object.keys(triggers.pull_request).length === 0);
  const workflowDispatchTriggerValid =
    triggers?.workflow_dispatch === null ||
    (isRecord(triggers?.workflow_dispatch) && Object.keys(triggers.workflow_dispatch).length === 0);
  const pushTrigger = triggers?.push;
  const pushTriggerValid =
    isRecord(pushTrigger) &&
    sameKeys(pushTrigger, ['branches']) &&
    Array.isArray(pushTrigger.branches) &&
    pushTrigger.branches.length === 1 &&
    pushTrigger.branches[0] === 'main';
  if (
    !isRecord(triggers) ||
    !sameKeys(triggers, ['pull_request', 'push', 'workflow_dispatch']) ||
    !pullRequestTriggerValid ||
    !pushTriggerValid ||
    !workflowDispatchTriggerValid
  ) {
    errors.push(
      'Workflow triggers must be exactly pull_request, unfiltered push to main, and workflow_dispatch.',
    );
  }
  if (
    !isRecord(workflow.env) ||
    !sameKeys(workflow.env, ['CI', 'EXPO_NO_TELEMETRY']) ||
    workflow.env.CI !== 'true' ||
    workflow.env.EXPO_NO_TELEMETRY !== '1'
  ) {
    errors.push('Workflow environment must contain only the reviewed CI and telemetry values.');
  }
  if (Object.hasOwn(workflow, 'defaults')) {
    errors.push('Workflow-level run defaults are forbidden for the audited privacy step.');
  }

  const job = workflow.jobs[workflowJob];
  if (!isRecord(job)) {
    errors.push(`Workflow job ${workflowJob} is missing.`);
    return;
  }
  for (const forbidden of [
    'if',
    'continue-on-error',
    'defaults',
    'container',
    'needs',
    'strategy',
    'env',
  ]) {
    if (Object.hasOwn(job, forbidden)) {
      errors.push(`Workflow job ${workflowJob} must not define ${forbidden}.`);
    }
  }
  if (job['runs-on'] !== 'ubuntu-latest' || !Array.isArray(job.steps)) {
    errors.push(`Workflow job ${workflowJob} must run on ubuntu-latest and contain steps.`);
    return;
  }

  const candidates = job.steps.filter((step) => isRecord(step) && step.name === workflowStep);
  if (candidates.length !== 1) {
    errors.push(`Workflow job ${workflowJob} must contain exactly one ${workflowStep} step.`);
    return;
  }
  const step = candidates[0];
  if (!sameKeys(step, ['name', 'run'])) {
    errors.push(
      `${workflowStep} must contain exactly name and run (no condition, custom shell, environment, or continue-on-error).`,
    );
    return;
  }
  const commands = exactWorkflowCommands(step.run);
  const expected = verifierScripts.map((script) => `npm run ${script}`);
  if (
    !commands ||
    commands.length !== expected.length ||
    commands.some((command, index) => command !== expected[index])
  ) {
    errors.push(
      `${workflowStep} must execute only the exact audited verifier commands, once each and in order.`,
    );
  }
}

export function auditVerificationWiring({
  packageJson,
  workflowText,
  verifierDefinitions,
  parentScripts = ['phase9:verify', 'launch:verify'],
  workflowJob = DEFAULT_WORKFLOW_JOB,
  workflowStep = DEFAULT_WORKFLOW_STEP,
}) {
  if (!isRecord(packageJson) || !isRecord(packageJson.scripts)) {
    throw new TypeError('packageJson.scripts must be an object.');
  }
  const verifierEntries = validateVerifierDefinitions(verifierDefinitions);
  const verifierScripts = verifierEntries.map(([script]) => script);
  validateParentScripts(parentScripts);
  if (typeof workflowJob !== 'string' || !SCRIPT_NAME.test(workflowJob)) {
    throw new TypeError('workflowJob must be a safe workflow job identifier.');
  }
  if (
    typeof workflowStep !== 'string' ||
    workflowStep.length === 0 ||
    workflowStep.length > 200 ||
    workflowStep !== workflowStep.trim() ||
    /[\r\n]/u.test(workflowStep)
  ) {
    throw new TypeError('workflowStep must be a bounded single-line step name.');
  }

  const errors = [];
  let workflow = null;
  try {
    workflow = parseWorkflow(workflowText);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  for (const [verifier, expectedDefinition] of verifierEntries) {
    if (packageJson.scripts[verifier] !== expectedDefinition) {
      errors.push(`${verifier} does not have the exact reviewed command definition.`);
    }
  }

  for (const parent of parentScripts) {
    const commands = parseParentCommandChain(packageJson.scripts[parent]);
    if (!commands) {
      errors.push(`${parent} is not a fail-closed npm command chain.`);
      continue;
    }
    for (const verifier of verifierScripts) {
      const expected = `npm run ${verifier}`;
      if (commands.filter((command) => command === expected).length !== 1) {
        errors.push(`${parent} must execute the exact command once: ${expected}`);
      }
    }
  }

  if (workflow) {
    auditWorkflowStep({ workflow, verifierScripts, workflowJob, workflowStep }, errors);
  }

  return deepFreeze({
    status: errors.length === 0 ? 'pass' : 'invalid',
    verifierScripts,
    parentScripts: [...parentScripts],
    workflowJob,
    workflowStep,
    errors,
  });
}
