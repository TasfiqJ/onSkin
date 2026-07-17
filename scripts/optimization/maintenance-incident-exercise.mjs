#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, '..', '..');
const contractPath = resolve(
  repositoryRoot,
  'docs/optimization/maintenance-dashboard-contract.json',
);
const scenarioPath = resolve(
  repositoryRoot,
  'docs/optimization/maintenance-incident-exercise.json',
);
const SHA_RE = /^[a-f0-9]{40}$/;
const ISSUE_CLASSES = new Set([
  'js_bug',
  'native_crash',
  'server_failure',
  'payment_failure',
  'privacy_failure',
]);
const SIGNAL_STATES = new Set(['healthy', 'warning', 'critical', 'unavailable']);

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value;
}

function requireString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value;
}

function findForbiddenKey(value, forbidden, path = '$') {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const match = findForbiddenKey(value[index], forbidden, `${path}[${index}]`);
      if (match) return match;
    }
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  for (const [key, child] of Object.entries(value)) {
    if (forbidden.has(key)) return `${path}.${key}`;
    const match = findForbiddenKey(child, forbidden, `${path}.${key}`);
    if (match) return match;
  }
  return null;
}

export function readExerciseInputs() {
  return {
    contract: JSON.parse(readFileSync(contractPath, 'utf8')),
    scenario: JSON.parse(readFileSync(scenarioPath, 'utf8')),
  };
}

export function validateDashboardContract(input) {
  const contract = requireObject(input, 'contract');
  if (contract.schemaVersion !== 1) throw new Error('contract.schemaVersion must be 1.');
  if (contract.status !== 'definition-only') {
    throw new Error('Unreviewed contract must remain definition-only.');
  }
  const privacy = requireObject(contract.privacy, 'contract.privacy');
  if (privacy.contentFree !== true) throw new Error('Dashboard contract must be content-free.');
  if (!Array.isArray(privacy.forbiddenFields) || privacy.forbiddenFields.length === 0) {
    throw new Error('Dashboard contract needs a forbidden-field list.');
  }
  if (!Array.isArray(contract.dashboards) || contract.dashboards.length < 5) {
    throw new Error('Dashboard contract must define all five maintenance domains.');
  }

  const dashboardIds = new Set();
  const metricIds = new Set();
  for (const dashboardValue of contract.dashboards) {
    const dashboard = requireObject(dashboardValue, 'dashboard');
    const dashboardId = requireString(dashboard.id, 'dashboard.id');
    if (dashboardIds.has(dashboardId)) throw new Error(`Duplicate dashboard: ${dashboardId}.`);
    dashboardIds.add(dashboardId);
    if (dashboard.status !== 'blocked-external') {
      throw new Error(`${dashboardId} must remain blocked-external until live evidence exists.`);
    }
    requireString(dashboard.ownerRole, `${dashboardId}.ownerRole`);
    if (dashboard.liveUrl !== null || dashboard.refreshCadenceMinutes !== null) {
      throw new Error(`${dashboardId} cannot claim live wiring.`);
    }
    if (!Array.isArray(dashboard.filters) || !Array.isArray(dashboard.metrics)) {
      throw new Error(`${dashboardId} needs filters and metrics.`);
    }
    for (const metricValue of dashboard.metrics) {
      const metric = requireObject(metricValue, `${dashboardId}.metric`);
      const metricId = requireString(metric.id, `${dashboardId}.metric.id`);
      if (metricIds.has(metricId)) throw new Error(`Duplicate metric: ${metricId}.`);
      metricIds.add(metricId);
      if (metric.productionThreshold !== null) {
        throw new Error(`${metricId} cannot claim an unapproved production threshold.`);
      }
    }
  }
  return { dashboardIds, metricIds, forbiddenFields: new Set(privacy.forbiddenFields) };
}

export function exerciseIncident(contractInput, scenarioInput) {
  const contractIndex = validateDashboardContract(contractInput);
  const scenario = requireObject(scenarioInput, 'scenario');
  if (scenario.schemaVersion !== 1 || scenario.exerciseOnly !== true) {
    throw new Error('Scenario must be a version-1 exercise fixture.');
  }
  const forbiddenPath = findForbiddenKey(scenario, contractIndex.forbiddenFields);
  if (forbiddenPath) throw new Error(`Scenario contains forbidden field at ${forbiddenPath}.`);

  const incidentId = requireString(scenario.incidentId, 'scenario.incidentId');
  if (scenario.severity !== 'P0' && scenario.severity !== 'P1') {
    throw new Error('Exercise severity must be P0 or P1.');
  }
  const issueClass = requireString(scenario.issueClass, 'scenario.issueClass');
  if (!ISSUE_CLASSES.has(issueClass)) throw new Error('Unknown issue class.');
  const dashboardId = requireString(scenario.dashboardId, 'scenario.dashboardId');
  if (!contractIndex.dashboardIds.has(dashboardId)) throw new Error('Unknown dashboard ID.');
  if (!Array.isArray(scenario.signals) || scenario.signals.length === 0) {
    throw new Error('Exercise needs at least one content-free signal.');
  }
  for (const signalValue of scenario.signals) {
    const signal = requireObject(signalValue, 'scenario.signal');
    if (!contractIndex.metricIds.has(signal.metricId)) throw new Error('Unknown metric ID.');
    if (!SIGNAL_STATES.has(signal.state)) throw new Error('Unknown signal state.');
    if (!Number.isInteger(signal.sampleCount) || signal.sampleCount < 1) {
      throw new Error('Signal sampleCount must be a positive integer.');
    }
  }

  const current = requireObject(scenario.currentArtifact, 'scenario.currentArtifact');
  const target = requireObject(scenario.rollbackTarget, 'scenario.rollbackTarget');
  if (!SHA_RE.test(current.sourceSha) || !SHA_RE.test(target.sourceSha)) {
    throw new Error('Exercise artifacts need synthetic 40-character SHAs.');
  }
  if (target.reviewed !== true) throw new Error('Rollback target must be previously reviewed.');
  const sameRuntime = current.runtimeFingerprint === target.runtimeFingerprint;
  const jsOnly = issueClass === 'js_bug' && current.changeClass === 'js';
  const otaAllowed = jsOnly && sameRuntime;
  const rollbackPath =
    issueClass === 'server_failure'
      ? 'server_function_or_flag_rollback'
      : issueClass === 'payment_failure'
        ? 'payment_provider_containment'
        : issueClass === 'privacy_failure'
          ? 'privacy_containment_and_review'
          : otaAllowed
            ? 'eas_update_rollback'
            : 'binary_halt_hotfix';
  const decision = {
    freezeRollout: true,
    otaAllowed,
    rollbackPath,
    exerciseClosure: 'complete-with-live-monitoring-blocker',
  };
  const expected = requireObject(scenario.expectedDecision, 'scenario.expectedDecision');
  for (const [key, value] of Object.entries(decision)) {
    if (expected[key] !== value) throw new Error(`Decision mismatch for ${key}.`);
  }

  return {
    schemaVersion: 1,
    incidentId,
    exerciseOnly: true,
    status: 'pass',
    dashboardContractStatus: contractInput.status,
    decision,
    checks: {
      contentFreeScenario: true,
      rolloutFrozen: true,
      runtimeFingerprintCompared: true,
      rollbackTargetReviewed: true,
      otaRejectedWhenIneligible: !otaAllowed,
      expectedDecisionMatched: true,
      liveRecoverySignalAvailable: false,
    },
    timeline: [
      { offsetMinutes: 0, action: 'declare-and-freeze' },
      { offsetMinutes: 5, action: 'classify-and-preserve-artifact-identity' },
      { offsetMinutes: 10, action: 'select-compatible-rollback-path' },
      { offsetMinutes: 15, action: 'prepare-smoke-and-communication' },
      { offsetMinutes: 20, action: 'retain-live-monitoring-blocker' },
    ],
    unresolvedExternal: [
      'named primary and backup responders',
      'live dashboard URLs and validated sources',
      'pre-approved production thresholds and cadence',
      'staging or production rollback identifiers',
      'independent live recovery signal',
    ],
  };
}

function run(argv) {
  if (argv.some((argument) => argument !== '--json')) {
    throw new Error('Usage: node scripts/optimization/maintenance-incident-exercise.mjs [--json]');
  }
  const { contract, scenario } = readExerciseInputs();
  const result = exerciseIncident(contract, scenario);
  process.stdout.write(
    argv.includes('--json')
      ? `${JSON.stringify(result, null, 2)}\n`
      : `${result.incidentId}: ${result.status} (${result.decision.rollbackPath})\n`,
  );
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    run(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
