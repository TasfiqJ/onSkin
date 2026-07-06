#!/usr/bin/env node
import {
  block,
  blockPublicEnvSecrets,
  envFile,
  envSnapshot,
  exists,
  has,
  phase11RequiredDocs,
  printResult,
  read,
  requiredPhase11EvidenceKeys,
  warn,
} from './lib.mjs';

const errors = [];
const warnings = [];
const env = envSnapshot();
const exampleEnv = envFile('.env.example');

for (const file of phase11RequiredDocs()) block(errors, exists(file), `${file} is missing.`);

for (const key of [...requiredPhase11EvidenceKeys(), 'PHASE11_SIGNED_OFF_BY']) {
  block(errors, Object.prototype.hasOwnProperty.call(exampleEnv, key), `.env.example is missing ${key}.`);
}
blockPublicEnvSecrets(errors, env, exampleEnv);

const packageJson = JSON.parse(read('package.json'));
for (const script of ['phase11:launch-readiness', 'phase11:ring-gates', 'phase11:launch-packet', 'phase11:verify']) {
  block(errors, Boolean(packageJson.scripts?.[script]), `package.json is missing ${script}.`);
}

block(errors, exists('docs/phase-10/generated/closed-beta-packet.json'), 'Phase 10 generated closed beta packet is missing.');
block(errors, exists('docs/phase-9/generated/release-engineering-qa-packet.json'), 'Phase 9 generated release QA packet is missing.');
block(errors, has('apps/mobile/eas.json', /"production"/) && has('apps/mobile/eas.json', /"channel":\s*"production"/), 'eas.json must define production channel.');
block(errors, has('docs/phase-11/store-release-plan.md', /manual release/i), 'Store release plan must require Apple manual release control.');
block(errors, has('docs/phase-11/store-release-plan.md', /first production release/i), 'Store release plan must document first production release constraints.');
block(errors, has('docs/phase-11/store-release-plan.md', /rollout percentage/i), 'Store release plan must document that first Google release has no rollout percentage.');
block(errors, has('docs/phase-11/store-release-plan.md', /selected countries/i), 'Store release plan must use selected countries as first-release control.');
block(errors, has('docs/phase-11/production-environment-check.md', /APP_VARIANT=production/), 'Production environment check must require production app variant.');
block(errors, has('docs/phase-11/revenuecat-production-verification.md', /Do not treat TestFlight sandbox purchases as revenue/i), 'RevenueCat verification must block sandbox revenue inflation.');
block(errors, has('docs/phase-11/monitoring-dashboards.md', /Release health/i), 'Monitoring dashboards must include release health.');
block(errors, has('docs/phase-11/support-launch-readiness.md', /restore\/entitlement/i), 'Support launch readiness must include restore/entitlement category.');
block(errors, has('docs/phase-11/incident-rollback-drill.md', /eas update:rollback/i), 'Incident drill must include EAS Update rollback path.');
block(errors, has('docs/phase-11/revenue-finance-reconciliation.md', /Seven-Figure Model Inputs/i), 'Revenue reconciliation must include seven-figure model inputs.');

if (exists('docs/phase-10/generated/closed-beta-packet.json')) {
  try {
    const phase10Packet = JSON.parse(read('docs/phase-10/generated/closed-beta-packet.json'));
    warn(warnings, phase10Packet.status === 'ready', `Phase 10 generated packet status is ${phase10Packet.status}; public launch remains externally blocked.`);
    warn(warnings, ['go', 'limited'].includes(String(phase10Packet.publicLaunchDecision ?? '').toLowerCase()), 'Phase 10 packet does not contain a go or limited launch decision.');
  } catch {
    warn(warnings, false, 'Phase 10 generated packet could not be parsed.');
  }
}

const placeholder = (value) => !value || /example\.com|YOUR-PROJECT|xxxxxxxx|XXXXXXXX|\.\.\.|pending/i.test(String(value));
for (const key of [
  'EXPO_PUBLIC_PRIVACY_URL',
  'EXPO_PUBLIC_TERMS_URL',
  'EXPO_PUBLIC_SUPPORT_URL',
  'EXPO_PUBLIC_ACCOUNT_DELETION_URL',
  'EXPO_PUBLIC_DATA_EXPORT_URL',
  'EXPO_PUBLIC_CONSUMER_HEALTH_PRIVACY_URL',
  'EXPO_PUBLIC_FINAL_BRAND_DOMAIN',
  'EXPO_PUBLIC_MARKETING_URL',
  'EXPO_PUBLIC_SUPPORT_EMAIL',
  'EXPO_PUBLIC_APP_STORE_URL',
  'EXPO_PUBLIC_PLAY_STORE_URL',
]) {
  warn(warnings, !placeholder(env[key]), `Missing final public launch value: ${key}.`);
}

for (const key of requiredPhase11EvidenceKeys()) {
  warn(warnings, env[key] === 'true', `Missing Phase 11 evidence: ${key}=true.`);
}
warn(warnings, Boolean(env.PHASE11_SIGNED_OFF_BY), 'Missing Phase 11 named signoff: PHASE11_SIGNED_OFF_BY.');

printResult('Phase 11 launch readiness', errors, warnings);
