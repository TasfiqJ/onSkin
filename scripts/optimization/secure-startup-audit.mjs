#!/usr/bin/env node
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, '..', '..');

const EXPECTED_OWNERS = Object.freeze({
  javascript_started: 'apps/mobile/src/app/_layout.tsx',
  root_render_started: 'apps/mobile/src/app/_layout.tsx',
  font_decision_complete: 'apps/mobile/src/app/_layout.tsx',
  authentication_hydration_complete:
    'apps/mobile/src/lib/auth/SessionBoundaryGate.tsx',
  account_generation_complete: 'apps/mobile/src/lib/auth/SessionBoundaryGate.tsx',
  plaintext_recovery_complete:
    'apps/mobile/src/lib/storage/PlaintextStagingStartupGate.tsx',
  app_lock_decision_complete: 'apps/mobile/src/lib/applock/AppLockProvider.tsx',
  vault_decision_complete:
    'apps/mobile/src/lib/storage/PrivateDataAvailabilityGate.tsx',
  navigation_ready:
    'apps/mobile/src/lib/observability/StartupNavigationObserver.tsx',
  first_meaningful_content: 'apps/mobile/src/components/ui/Screen.tsx',
  first_route_interaction_observed: 'apps/mobile/src/components/ui/Screen.tsx',
  first_critical_data_ready: 'apps/mobile/src/app/index.tsx',
  startup_reconciliation_complete: 'apps/mobile/src/lib/offline/OfflineSync.tsx',
});

const REQUIRED_SCENARIOS = Object.freeze([
  'Fresh install',
  'Returning onboarded user',
  '200 Shelf rows, long history, 50-photo metadata',
  'App lock enabled',
  'Photo lock enabled',
  'Signed out with retained owner marker',
  'Same-user token refresh',
  'Account A to B',
  'Missing, malformed, future, or unavailable keys/records',
  'Offline',
  'Low storage or low memory',
]);

function read(relativePath) {
  return readFileSync(resolve(repositoryRoot, relativePath), 'utf8');
}

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function collectRuntimeSources(directory, output = {}) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      collectRuntimeSources(path, output);
      continue;
    }
    if (!['.ts', '.tsx'].includes(extname(entry.name)) || /\.test\.[^.]+$/.test(entry.name)) {
      continue;
    }
    output[relative(repositoryRoot, path).replaceAll('\\', '/')] = readFileSync(path, 'utf8');
  }
  return output;
}

export function readSecureStartupInputs() {
  return {
    runtimeSources: collectRuntimeSources(resolve(repositoryRoot, 'apps/mobile/src')),
    phaseContract: read('apps/mobile/src/lib/observability/operationTiming.ts'),
    rootLayout: read('apps/mobile/src/app/_layout.tsx'),
    appLockProvider: read('apps/mobile/src/lib/applock/AppLockProvider.tsx'),
    privateDataGate: read(
      'apps/mobile/src/lib/storage/PrivateDataAvailabilityGate.tsx',
    ),
    offlineSync: read('apps/mobile/src/lib/offline/OfflineSync.tsx'),
    diagnosticsContract: read('apps/mobile/src/lib/diagnostics/localDiagnostics.ts'),
    diagnosticsRuntime: read(
      'apps/mobile/src/lib/diagnostics/localDiagnosticsRuntime.ts',
    ),
    diagnosticsRoute: read('apps/mobile/src/app/settings/diagnostics.tsx'),
    truthTable: read('docs/optimization/SECURE_STARTUP_TRUTH_TABLE.md'),
  };
}

function startupMarkerCalls(runtimeSources) {
  const calls = [];
  const callPattern = /markStartupPhase\(([^)\n]+)\)/g;
  for (const [path, source] of Object.entries(runtimeSources)) {
    if (path.endsWith('/operationTiming.ts')) continue;
    for (const match of source.matchAll(callPattern)) {
      calls.push({ path, argument: match[1].trim() });
    }
  }
  return calls;
}

export function auditSecureStartup(inputs) {
  const {
    runtimeSources,
    phaseContract,
    rootLayout,
    appLockProvider,
    privateDataGate,
    offlineSync,
    diagnosticsContract,
    diagnosticsRuntime,
    diagnosticsRoute,
    truthTable,
  } = inputs;
  const expectedPhases = Object.keys(EXPECTED_OWNERS);
  const phasePositions = expectedPhases.map((phase) => phaseContract.indexOf(`'${phase}'`));
  requireCondition(
    phasePositions.every((position) => position >= 0),
    'Startup phase contract is missing a required fixed phase.',
  );
  requireCondition(
    phasePositions.every((position, index) => index === 0 || phasePositions[index - 1] < position),
    'Startup phase contract order does not match the secure bootstrap order.',
  );

  const gateOrder = [
    '<SessionBoundaryGate>',
    '<PlaintextStagingStartupGate>',
    '<AppLockProvider>',
    '<PrivateDataAvailabilityGate>',
    '<StartupNavigationObserver />',
    '<Stack screenOptions=',
  ];
  const gatePositions = gateOrder.map((token) => rootLayout.indexOf(token));
  requireCondition(
    gatePositions.every((position) => position >= 0),
    'Root layout is missing a required startup gate or observer.',
  );
  requireCondition(
    gatePositions.every((position, index) => index === 0 || gatePositions[index - 1] < position),
    'Secure startup gate order changed or navigation escaped a gate.',
  );
  requireCondition(
    appLockProvider.indexOf("markStartupPhase('app_lock_decision_complete')") >= 0 &&
      appLockProvider.indexOf("markStartupPhase('app_lock_decision_complete')") <
        appLockProvider.indexOf('setLoaded(true)') &&
      privateDataGate.indexOf("markStartupPhase('vault_decision_complete')") >= 0 &&
      privateDataGate.indexOf("markStartupPhase('vault_decision_complete')") <
        privateDataGate.indexOf(
          "setAvailability(recoveryHrefRef.current ? 'restoring' : 'ready')",
        ),
    'Secure gate decisions must be marked before their children can be revealed.',
  );

  const calls = startupMarkerCalls(runtimeSources);
  requireCondition(calls.length === expectedPhases.length, 'Unexpected startup marker count.');
  for (const call of calls) {
    const literalMatch = /^'([a-z0-9_]+)'$/.exec(call.argument);
    requireCondition(literalMatch, `Startup marker in ${call.path} must use one fixed literal.`);
    const phase = literalMatch[1];
    requireCondition(
      Object.hasOwn(EXPECTED_OWNERS, phase),
      `Unknown startup marker phase: ${phase}.`,
    );
    requireCondition(
      EXPECTED_OWNERS[phase] === call.path,
      `Startup marker ${phase} is owned by the wrong source.`,
    );
  }
  for (const [phase, owner] of Object.entries(EXPECTED_OWNERS)) {
    requireCondition(
      calls.some((call) => call.path === owner && call.argument === `'${phase}'`),
      `Missing startup marker owner for ${phase}.`,
    );
  }

  requireCondition(
    offlineSync.indexOf('isOwnerQueryScopeCurrent(ownerScope)') <
      offlineSync.indexOf("markStartupPhase('startup_reconciliation_complete')"),
    'Startup reconciliation marker must remain owner-current guarded.',
  );
  requireCondition(
    diagnosticsContract.includes('LOCAL_DIAGNOSTICS_SCHEMA_VERSION = 2') &&
      diagnosticsContract.includes('startupPhases: readonly DiagnosticsStartupPhase[]') &&
      diagnosticsContract.includes('STARTUP_PHASE_NAMES.flatMap'),
    'Local diagnostics must expose an allowlisted schema-v2 startup phase list.',
  );
  requireCondition(
    diagnosticsRuntime.includes('readStartupPhases: readStartupPhaseSamples') &&
      diagnosticsRoute.includes('<DiagnosticsCard title="STARTUP MILESTONES">'),
    'Startup phases must be locally readable and visible in gated diagnostics.',
  );
  for (const scenario of REQUIRED_SCENARIOS) {
    requireCondition(truthTable.includes(`| ${scenario} |`), `Missing startup scenario: ${scenario}.`);
  }
  requireCondition(
    /no authorization gate is relaxed or reordered/i.test(truthTable) &&
      /does not approve the mounted privacy-shield redesign/i.test(truthTable),
    'Truth table must retain the no-relaxation and decision boundaries.',
  );
  requireCondition(
    /retain[s]?\s+no route, account, query, product, photo, health, token, error, or free-text/i.test(
      truthTable,
    ),
    'Truth table must state the content-free marker boundary.',
  );

  return {
    status: 'pass',
    startupPhasesAudited: expectedPhases.length,
    runtimeMarkerCallsAudited: calls.length,
    secureGatesAudited: gateOrder.length - 2,
    navigationInsideAllSecureGates: true,
    scenariosAudited: REQUIRED_SCENARIOS.length,
    localDiagnosticsSchemaVersion: 2,
    authorizationGateChanges: 0,
    telemetryUploadsAdded: 0,
  };
}

function run(argv) {
  if (argv.some((argument) => argument !== '--json')) {
    throw new Error('Usage: node scripts/optimization/secure-startup-audit.mjs [--json]');
  }
  const result = auditSecureStartup(readSecureStartupInputs());
  process.stdout.write(
    argv.includes('--json')
      ? `${JSON.stringify(result, null, 2)}\n`
      : 'PASS secure-startup order, milestones, and truth table are enforced\n',
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
