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
  phase10RequiredDocs,
  phase10SourceFiles,
  printResult,
  productionDomain,
  productionSupportEmail,
  productionUrl,
  read,
  requiredPhase10EvidenceKeys,
  warn,
} from './lib.mjs';

const errors = [];
const warnings = [];
const env = envSnapshot();
const exampleEnv = envFile('.env.example');

const closedBetaPacketRequiredSourceFiles = [
  'package.json',
  'turbo.json',
  '.env.example',
  'scripts/phase9/lib.mjs',
  'scripts/phase9/evidence-normalization-smoke.mjs',
  'scripts/phase10-11/public-contact-smoke.mjs',
  'scripts/phase10/lib.mjs',
  'scripts/phase10/beta-readiness.mjs',
  'scripts/phase10/beta-analytics-audit.mjs',
  'scripts/phase10/build-beta-packet.mjs',
  'apps/mobile/eas.json',
  'apps/mobile/app.config.js',
  'apps/mobile/src/lib/analytics/eventRegistry.ts',
  'apps/mobile/src/lib/analytics/track.ts',
  'apps/mobile/src/lib/observability/scrub.ts',
  'docs/phase-9/generated/release-engineering-qa-packet.json',
  'docs/phase-9/generated/release-engineering-qa-packet.md',
  ...phase10RequiredDocs(),
];

for (const file of phase10RequiredDocs()) block(errors, exists(file), `${file} is missing.`);

for (const key of [
  ...requiredPhase10EvidenceKeys(),
  'PHASE10_PUBLIC_LAUNCH_DECISION',
  'PHASE10_SIGNED_OFF_BY',
]) {
  block(
    errors,
    Object.prototype.hasOwnProperty.call(exampleEnv, key),
    `.env.example is missing ${key}.`,
  );
}
blockPublicEnvSecrets(errors, env, exampleEnv);

const packageJson = JSON.parse(read('package.json'));
for (const script of [
  'phase10:beta-readiness',
  'phase10:beta-analytics-audit',
  'phase10:beta-packet',
  'phase10:verify',
]) {
  block(errors, Boolean(packageJson.scripts?.[script]), `package.json is missing ${script}.`);
}

const closedBetaPacketSourceFiles = new Set(phase10SourceFiles());
for (const file of closedBetaPacketRequiredSourceFiles) {
  block(errors, exists(file), `${file} is missing from closed beta packet source inputs.`);
  block(
    errors,
    closedBetaPacketSourceFiles.has(file),
    `Phase 10 closed beta packet must hash ${file}.`,
  );
}

const betaPacketBuilder = read('scripts/phase10/build-beta-packet.mjs');
const betaAnalyticsAudit = read('scripts/phase10/beta-analytics-audit.mjs');
block(
  errors,
  betaPacketBuilder.includes('const sourceFiles = phase10SourceFiles();') &&
    betaPacketBuilder.includes(
      'sourceHashes: Object.fromEntries(sourceFiles.filter(exists).map((file) => [file, hash(file)]))',
    ),
  'Phase 10 closed beta packet must hash phase10SourceFiles() inputs.',
);
block(
  errors,
  /function gitStatusExcludingGeneratedPacket\(\)/.test(betaPacketBuilder) &&
    /closed-beta-packet\.json/.test(betaPacketBuilder) &&
    /closed-beta-packet\.md/.test(betaPacketBuilder) &&
    /gitStatus = gitStatusExcludingGeneratedPacket\(\)/.test(betaPacketBuilder),
  'Phase 10 closed beta packet must ignore only its own generated outputs when recording Git status.',
);
block(
  errors,
  /Closed beta packet generated with a dirty Git worktree/.test(betaPacketBuilder) &&
    /Git status: \$\{packet\.gitStatus \? 'DIRTY' : 'clean'\}/.test(betaPacketBuilder),
  'Phase 10 closed beta packet must warn on dirty worktrees and expose Git status in Markdown.',
);
block(
  errors,
  betaAnalyticsAudit.includes('REQUIRED_PHASE_H_EVENTS') &&
    betaAnalyticsAudit.includes('Phase H beta event contract'),
  'Phase 10 beta analytics audit must pin the required Phase H event contract.',
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
  has('docs/phase-10/beta-source-of-truth.md', /50-100 (total )?real target users/i),
  'Phase 10 source of truth must require 50-100 real target users.',
);
block(
  errors,
  has('docs/phase-10/beta-source-of-truth.md', /20,?005 active annual subscribers/i),
  'Phase 10 source of truth must keep seven-figure math visible.',
);
block(
  errors,
  has('docs/phase-10/tester-brief.md', /not medical advice/i),
  'Tester brief must include no-medical-advice boundary.',
);
block(
  errors,
  has('docs/phase-10/tester-brief.md', /deletion/i) &&
    has('docs/phase-10/tester-brief.md', /data export/i),
  'Tester brief must explain deletion/export controls.',
);
block(
  errors,
  has('docs/phase-10/testflight-packet.md', /90 days/i),
  'TestFlight packet must track beta build expiry.',
);
block(
  errors,
  has('docs/phase-10/testflight-packet.md', /sandbox/i),
  'TestFlight packet must explain sandbox purchase limits.',
);
block(
  errors,
  has('docs/phase-10/google-closed-testing-packet.md', /12 opted-in testers/i),
  'Google packet must include the 12 opted-in tester requirement.',
);
block(
  errors,
  has('docs/phase-10/google-closed-testing-packet.md', /14 continuous days/i),
  'Google packet must include the 14 continuous day requirement.',
);
block(
  errors,
  has('docs/phase-10/support-operations.md', /unexpected charge/i),
  'Support operations must classify unexpected charges as high severity.',
);
block(
  errors,
  has('docs/phase-10/public-launch-decision-memo.md', /go, limited launch, hold, or no-go/i),
  'Public launch decision memo must force a go/limited/hold/no-go decision.',
);
block(
  errors,
  exists('apps/mobile/src/lib/analytics/eventRegistry.ts'),
  'Analytics event registry is missing.',
);
block(errors, exists('apps/mobile/src/lib/analytics/track.ts'), 'Analytics tracker is missing.');

if (exists('docs/phase-9/generated/release-engineering-qa-packet.json')) {
  try {
    const phase9Packet = JSON.parse(
      read('docs/phase-9/generated/release-engineering-qa-packet.json'),
    );
    warn(
      warnings,
      phase9Packet.status === 'ready',
      `Phase 9 generated packet status is ${phase9Packet.status}; closed beta remains externally blocked.`,
    );
  } catch {
    warn(warnings, false, 'Phase 9 generated packet could not be parsed.');
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
]) {
  warn(
    warnings,
    validate(env[key]),
    `Missing or non-production final beta identity/policy value: ${key}.`,
  );
}

for (const key of requiredPhase10EvidenceKeys()) {
  warn(warnings, evidenceFlagEnabled(env[key]), `Missing Phase 10 evidence: ${key}=true.`);
}

warn(
  warnings,
  Boolean(normalizeLaunchDecision(env.PHASE10_PUBLIC_LAUNCH_DECISION)),
  'Missing Phase 10 public launch decision: PHASE10_PUBLIC_LAUNCH_DECISION=go or limited.',
);
warn(
  warnings,
  Boolean(normalizeNamedSignoff(env.PHASE10_SIGNED_OFF_BY)),
  'Missing Phase 10 named signoff: PHASE10_SIGNED_OFF_BY.',
);

printResult('Phase 10 beta readiness', errors, warnings);
