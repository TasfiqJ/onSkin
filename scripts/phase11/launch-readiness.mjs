#!/usr/bin/env node
import {
  block,
  blockPublicEnvSecrets,
  evidenceFlagEnabled,
  envFile,
  envSnapshot,
  exists,
  has,
  normalizeLaunchDecision,
  normalizeNamedSignoff,
  phase11RequiredDocs,
  phase11SourceFiles,
  printResult,
  productionDomain,
  productionSupportEmail,
  productionUrl,
  read,
  requiredPhase11EvidenceKeys,
  warn,
} from './lib.mjs';

const errors = [];
const warnings = [];
const env = envSnapshot();
const exampleEnv = envFile('.env.example');

const publicLaunchPacketRequiredSourceFiles = [
  'package.json',
  'turbo.json',
  '.env.example',
  'scripts/phase9/lib.mjs',
  'scripts/phase9/evidence-normalization-smoke.mjs',
  'scripts/phase10/lib.mjs',
  'scripts/phase10/beta-readiness.mjs',
  'scripts/phase10/beta-analytics-audit.mjs',
  'scripts/phase10/build-support-handoff-packet.mjs',
  'scripts/phase10/build-beta-packet.mjs',
  'scripts/phase10-11/public-contact-smoke.mjs',
  'scripts/phase11/lib.mjs',
  'scripts/phase11/launch-readiness.mjs',
  'scripts/phase11/launch-ring-gates.mjs',
  'scripts/phase11/build-launch-packet.mjs',
  'apps/mobile/eas.json',
  'apps/mobile/app.config.js',
  'apps/mobile/src/lib/env.ts',
  'apps/mobile/src/lib/iap/revenuecat.ts',
  'docs/phase-9/generated/release-engineering-qa-packet.json',
  'docs/phase-9/generated/release-engineering-qa-packet.md',
  'docs/phase-10/generated/support-handoff-packet.json',
  'docs/phase-10/generated/support-handoff-packet.md',
  'docs/phase-10/generated/closed-beta-packet.json',
  'docs/phase-10/generated/closed-beta-packet.md',
  ...phase11RequiredDocs(),
];

for (const file of phase11RequiredDocs()) block(errors, exists(file), `${file} is missing.`);

for (const key of [...requiredPhase11EvidenceKeys(), 'PHASE11_SIGNED_OFF_BY']) {
  block(
    errors,
    Object.prototype.hasOwnProperty.call(exampleEnv, key),
    `.env.example is missing ${key}.`,
  );
}
blockPublicEnvSecrets(errors, env, exampleEnv);

const packageJson = JSON.parse(read('package.json'));
for (const script of [
  'phase10:evidence-normalization-smoke',
  'phase10:beta-readiness',
  'phase10:beta-analytics-audit',
  'phase10:support-handoff',
  'phase10:beta-packet',
  'phase11:launch-readiness',
  'phase11:ring-gates',
  'phase11:launch-packet',
  'phase11:verify',
  'docs:generated-packet-status-audit:strict',
]) {
  block(errors, Boolean(packageJson.scripts?.[script]), `package.json is missing ${script}.`);
}
block(
  errors,
  /phase10:evidence-normalization-smoke && npm run phase10:beta-readiness && npm run phase10:beta-analytics-audit && npm run phase10:support-handoff && npm run phase10:beta-packet && npm run phase11:launch-readiness && npm run phase11:ring-gates && npm run phase11:launch-packet && npm run docs:generated-packet-status-audit:strict && npm run typecheck/.test(
    packageJson.scripts?.['phase11:verify'] ?? '',
  ),
  'phase11:verify must rerun Phase 10 readiness, analytics, support handoff, and beta packet gates before Phase 11 readiness and the strict generated-packet status audit.',
);

const publicLaunchPacketSourceFiles = new Set(phase11SourceFiles());
for (const file of publicLaunchPacketRequiredSourceFiles) {
  block(errors, exists(file), `${file} is missing from public launch packet source inputs.`);
  block(
    errors,
    publicLaunchPacketSourceFiles.has(file),
    `Phase 11 public launch packet must hash ${file}.`,
  );
}

const launchPacketBuilder = read('scripts/phase11/build-launch-packet.mjs');
block(
  errors,
  launchPacketBuilder.includes('const sourceFiles = phase11SourceFiles();') &&
    launchPacketBuilder.includes(
      'sourceHashes: Object.fromEntries(sourceFiles.filter(exists).map((file) => [file, hash(file)]))',
    ),
  'Phase 11 public launch packet must hash phase11SourceFiles() inputs.',
);
block(
  errors,
  /function gitStatusExcludingGeneratedPacket\(\)/.test(launchPacketBuilder) &&
    /public-launch-packet\.json/.test(launchPacketBuilder) &&
    /public-launch-packet\.md/.test(launchPacketBuilder) &&
    /gitStatus = gitStatusExcludingGeneratedPacket\(\)/.test(launchPacketBuilder),
  'Phase 11 public launch packet must ignore only its own generated outputs when recording Git status.',
);
block(
  errors,
  /Public launch packet generated with a dirty Git worktree/.test(launchPacketBuilder) &&
    /Git status: \$\{packet\.gitStatus \? 'DIRTY' : 'clean'\}/.test(launchPacketBuilder),
  'Phase 11 public launch packet must warn on dirty worktrees and expose Git status in Markdown.',
);

block(
  errors,
  exists('docs/phase-10/generated/closed-beta-packet.json'),
  'Phase 10 generated closed beta packet is missing.',
);
block(
  errors,
  exists('docs/phase-10/generated/closed-beta-packet.md'),
  'Phase 10 generated closed beta packet Markdown is missing.',
);
block(
  errors,
  exists('docs/phase-9/generated/release-engineering-qa-packet.json'),
  'Phase 9 generated release QA packet is missing.',
);
block(
  errors,
  exists('docs/phase-9/generated/release-engineering-qa-packet.md'),
  'Phase 9 generated release QA packet Markdown is missing.',
);
block(
  errors,
  has('apps/mobile/eas.json', /"production"/) &&
    has('apps/mobile/eas.json', /"channel":\s*"production"/),
  'eas.json must define production channel.',
);
block(
  errors,
  has('docs/phase-11/store-release-plan.md', /manual release/i),
  'Store release plan must require Apple manual release control.',
);
block(
  errors,
  has('docs/phase-11/store-release-plan.md', /first production release/i),
  'Store release plan must document first production release constraints.',
);
block(
  errors,
  has('docs/phase-11/store-release-plan.md', /rollout percentage/i),
  'Store release plan must document that first Google release has no rollout percentage.',
);
block(
  errors,
  has('docs/phase-11/store-release-plan.md', /selected countries/i),
  'Store release plan must use selected countries as first-release control.',
);
block(
  errors,
  has('docs/phase-11/production-environment-check.md', /APP_VARIANT=production/),
  'Production environment check must require production app variant.',
);
block(
  errors,
  has(
    'docs/phase-11/revenuecat-production-verification.md',
    /Do not treat TestFlight sandbox purchases as revenue/i,
  ),
  'RevenueCat verification must block sandbox revenue inflation.',
);
block(
  errors,
  has('docs/phase-11/monitoring-dashboards.md', /Release health/i),
  'Monitoring dashboards must include release health.',
);
block(
  errors,
  has('docs/phase-11/support-launch-readiness.md', /restore\/entitlement/i),
  'Support launch readiness must include restore/entitlement category.',
);
block(
  errors,
  has('docs/phase-11/incident-rollback-drill.md', /eas update:rollback/i),
  'Incident drill must include EAS Update rollback path.',
);
block(
  errors,
  has('docs/phase-11/revenue-finance-reconciliation.md', /Seven-Figure Model Inputs/i),
  'Revenue reconciliation must include seven-figure model inputs.',
);

if (exists('docs/phase-10/generated/closed-beta-packet.json')) {
  try {
    const phase10Packet = JSON.parse(read('docs/phase-10/generated/closed-beta-packet.json'));
    warn(
      warnings,
      phase10Packet.status === 'ready',
      `Phase 10 generated packet status is ${phase10Packet.status}; public launch remains externally blocked.`,
    );
    warn(
      warnings,
      Boolean(normalizeLaunchDecision(phase10Packet.publicLaunchDecision)),
      'Phase 10 packet does not contain a go or limited launch decision.',
    );
  } catch {
    warn(warnings, false, 'Phase 10 generated packet could not be parsed.');
  }
}

for (const [key, validate] of [
  ['EXPO_PUBLIC_PRIVACY_URL', productionUrl],
  ['EXPO_PUBLIC_TERMS_URL', productionUrl],
  ['EXPO_PUBLIC_SUPPORT_URL', productionUrl],
  ['EXPO_PUBLIC_ACCOUNT_DELETION_URL', productionUrl],
  ['EXPO_PUBLIC_DATA_EXPORT_URL', productionUrl],
  ['EXPO_PUBLIC_CONSUMER_HEALTH_PRIVACY_URL', productionUrl],
  ['EXPO_PUBLIC_FINAL_BRAND_DOMAIN', productionDomain],
  ['EXPO_PUBLIC_MARKETING_URL', productionUrl],
  ['EXPO_PUBLIC_SUPPORT_EMAIL', productionSupportEmail],
  ['EXPO_PUBLIC_APP_STORE_URL', productionUrl],
  ['EXPO_PUBLIC_PLAY_STORE_URL', productionUrl],
]) {
  warn(
    warnings,
    validate(env[key]),
    `Missing or non-production final public launch value: ${key}.`,
  );
}

for (const key of requiredPhase11EvidenceKeys()) {
  warn(warnings, evidenceFlagEnabled(env[key]), `Missing Phase 11 evidence: ${key}=true.`);
}
warn(
  warnings,
  Boolean(normalizeNamedSignoff(env.PHASE11_SIGNED_OFF_BY)),
  'Missing Phase 11 named signoff: PHASE11_SIGNED_OFF_BY.',
);

printResult('Phase 11 launch readiness', errors, warnings);
