#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, '..', '..');

function readJson(relativePath) {
  return JSON.parse(readFileSync(resolve(repositoryRoot, relativePath), 'utf8'));
}

function readText(relativePath) {
  return readFileSync(resolve(repositoryRoot, relativePath), 'utf8');
}

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function hasOwn(value, key) {
  return value !== null && typeof value === 'object' && Object.hasOwn(value, key);
}

export function readStoreOnlyReleaseInputs() {
  return {
    app: readJson('apps/mobile/app.base.json').expo,
    eas: readJson('apps/mobile/eas.json'),
    rootPackage: readJson('package.json'),
    mobilePackage: readJson('apps/mobile/package.json'),
    maintenanceContract: readJson('docs/optimization/maintenance-dashboard-contract.json'),
    policyText: readText('docs/UPDATE_DELIVERY_POLICY.md'),
    architectureText: readText('docs/ARCHITECTURE.md'),
    dynamicAppConfigSource: readText('apps/mobile/app.config.js'),
  };
}

export function auditStoreOnlyResolvedApp(app, variant) {
  const updates = app?.updates;
  requireCondition(
    updates?.enabled === false,
    `Resolved ${variant} config updates.enabled must be false.`,
  );
  requireCondition(
    updates?.checkAutomatically === 'NEVER',
    `Resolved ${variant} config updates.checkAutomatically must be NEVER.`,
  );
  requireCondition(!hasOwn(updates, 'url'), `Resolved ${variant} config must omit updates.url.`);
}

export function auditStoreOnlyRelease(inputs) {
  const {
    app,
    eas,
    rootPackage,
    mobilePackage,
    maintenanceContract,
    policyText,
    architectureText,
    dynamicAppConfigSource,
  } = inputs;
  auditStoreOnlyResolvedApp(app, 'base');
  requireCondition(
    app?.runtimeVersion?.policy === 'fingerprint',
    'runtimeVersion.policy must remain fingerprint for artifact compatibility.',
  );

  const directDependencies = {
    ...(rootPackage?.dependencies ?? {}),
    ...(rootPackage?.devDependencies ?? {}),
    ...(rootPackage?.optionalDependencies ?? {}),
    ...(mobilePackage?.dependencies ?? {}),
    ...(mobilePackage?.devDependencies ?? {}),
    ...(mobilePackage?.optionalDependencies ?? {}),
  };
  requireCondition(
    !hasOwn(directDependencies, 'expo-updates'),
    'Store-only workspace must not directly depend on expo-updates.',
  );
  requireCondition(
    !/(?:\bexpo\s*\.\s*)?\bupdates\s*(?:=|:)/.test(dynamicAppConfigSource),
    'Dynamic app config must not mutate the reviewed base updates policy.',
  );
  requireCondition(
    !hasOwn(eas, 'update'),
    'Store-only EAS config must omit a top-level update policy.',
  );

  const profiles = eas?.build ?? {};
  for (const requiredProfile of ['development', 'staging', 'production']) {
    requireCondition(
      hasOwn(profiles, requiredProfile),
      `Missing EAS build profile: ${requiredProfile}.`,
    );
  }
  for (const [profileName, profile] of Object.entries(profiles)) {
    requireCondition(
      !hasOwn(profile, 'channel'),
      `Store-only EAS profile ${profileName} must omit channel.`,
    );
  }
  requireCondition(
    profiles.production?.distribution === 'store',
    'Production EAS profile must retain store distribution.',
  );

  requireCondition(
    maintenanceContract?.releasePolicy?.clientDelivery === 'store-build-only' &&
      maintenanceContract?.releasePolicy?.easUpdateEnabled === false,
    'Maintenance contract must enforce store-only client delivery.',
  );
  requireCondition(
    /Status:\s*accepted launch policy/i.test(policyText) &&
      /store-bundled client releases only/i.test(policyText),
    'Accepted update-delivery policy must declare store-bundled releases.',
  );
  requireCondition(
    /A-014[^\n]*Ship Client Changes Only In Store-Bundled Binaries/i.test(architectureText),
    'Architecture must record the accepted store-bundled delivery decision.',
  );

  return {
    status: 'pass',
    clientDelivery: 'store-build-only',
    easUpdateEnabled: false,
    updatesUrlConfigured: false,
    directExpoUpdatesDependency: false,
    easProfilesAudited: Object.keys(profiles).sort(),
    runtimeVersionPolicy: app.runtimeVersion.policy,
  };
}

function run(argv) {
  if (argv.some((argument) => argument !== '--json')) {
    throw new Error('Usage: node scripts/optimization/store-only-release-audit.mjs [--json]');
  }
  const result = auditStoreOnlyRelease(readStoreOnlyReleaseInputs());
  process.stdout.write(
    argv.includes('--json')
      ? `${JSON.stringify(result, null, 2)}\n`
      : 'PASS store-only update-delivery policy is enforced\n',
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
