import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  PHASE7_EVIDENCE_KEYS,
  validatePhase7EvidenceInventory,
} from './core-loop-qa-packet-contract.mjs';
import { PHOTO05A_TREND_AUTHORITY_SOURCE_PATHS } from '../photo05/trend-admission-source-contract.mjs';

function validEvidence() {
  return Object.fromEntries(
    PHASE7_EVIDENCE_KEYS.map((key) => [key, key === 'signedOffBy' ? 'Release Owner' : true]),
  );
}

const CORE07A_PACKET_SOURCE_PATHS = Object.freeze([
  'docs/hugeToDo/CORE-07-SHARE-ADMISSION-SOURCE-CHECKPOINT-2026-07-29.md',
  'scripts/core02/clinical-rule-source-contract.test.mjs',
  'scripts/core07/share-admission-source-contract.mjs',
  'scripts/core07/share-admission-source-contract.test.mjs',
  'apps/mobile/src/features/growth/shareAdmission.ts',
  'apps/mobile/src/features/growth/shareAdmission.test.ts',
  'apps/mobile/src/features/growth/publicLinkAdmission.ts',
  'apps/mobile/src/features/growth/publicLinkAdmission.test.ts',
  'apps/mobile/src/features/growth/shareProjection.ts',
  'apps/mobile/src/features/growth/shareProjection.test.ts',
  'apps/mobile/src/features/growth/ConflictCard.tsx',
  'apps/mobile/src/features/growth/shareCard.ts',
  'apps/mobile/src/features/growth/shareCard.test.ts',
  'apps/mobile/src/features/growth/shareLinks.ts',
  'apps/mobile/src/features/growth/shareLinks.test.ts',
  'apps/mobile/src/features/growth/shareLandingRoute.test.ts',
  'apps/mobile/src/features/growth/cardCopy.ts',
  'apps/mobile/src/features/growth/cardCopy.test.ts',
  'apps/mobile/src/features/intelligence/conflictIdentity.ts',
  'apps/mobile/src/features/intelligence/conflictRoutes.test.ts',
  'apps/mobile/src/app/share/conflict/[ruleId].tsx',
  'apps/mobile/src/app/conflict/[ruleId].tsx',
  'apps/mobile/src/app/s/[shareId].tsx',
  'apps/mobile/src/lib/launch/phase7.ts',
  'apps/mobile/src/lib/launch/phase7.test.ts',
  'apps/mobile/src/lib/launch/phase8.ts',
  'apps/mobile/src/lib/launch/phase8.test.ts',
  'apps/mobile/src/lib/env.ts',
  'apps/mobile/src/lib/env.test.ts',
  'docs/phase-8/public-site/share.html',
]);

function assertSourceBlockIncludes(sourceBlock, path, label) {
  assert.match(
    sourceBlock,
    new RegExp(`['"]${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`, 'u'),
    `${path} must be included in ${label}`,
  );
}

test('Phase 7 evidence inventory requires the exact canonical key set', () => {
  assert.equal(validatePhase7EvidenceInventory(validEvidence()).status, 'pass');
  const reduced = validEvidence();
  delete reduced.deviceQaPass;
  assert.equal(validatePhase7EvidenceInventory(reduced).status, 'blocked');
  assert.equal(
    validatePhase7EvidenceInventory({ ...validEvidence(), forgedEvidence: true }).status,
    'blocked',
  );
  assert.equal(
    validatePhase7EvidenceInventory({ ...validEvidence(), deviceQaPass: false }).status,
    'blocked',
  );
});

test('Phase 7 source hashes bind the complete CORE-06 admission boundary', () => {
  const builderSource = readFileSync(
    new URL('./build-core-loop-qa-packet.mjs', import.meta.url),
    'utf8',
  );
  const requiredFilesBlock = /const requiredFiles = \[([\s\S]*?)\n\];/u.exec(builderSource)?.[1];
  assert.ok(requiredFilesBlock, 'requiredFiles source block must remain statically auditable');

  for (const path of [
    'docs/hugeToDo/CORE-06-RECOMMENDATION-ADMISSION-SOURCE-CHECKPOINT-2026-07-26.md',
    'docs/09-personalized-recommendations.md',
    'scripts/core06/recommendation-admission-source-contract.test.mjs',
    'scripts/phase9/recommendation-zero-admission-smoke.mjs',
    'apps/mobile/src/app/recommendations/[id].tsx',
    'apps/mobile/src/app/recommendations/index.tsx',
    'apps/mobile/src/app/recommendations/preferences.tsx',
    'apps/mobile/src/features/commerce/WhereToBuy.tsx',
    'apps/mobile/src/features/commerce/commerceRoutes.test.ts',
    'apps/mobile/src/features/onboarding/serverSkinProfile.ts',
    'apps/mobile/src/features/onboarding/serverSkinProfile.test.ts',
    'apps/mobile/src/features/recommendations/admission.ts',
    'apps/mobile/src/features/recommendations/admission.test.ts',
    'apps/mobile/src/features/recommendations/RecommendationsTeaser.tsx',
    'apps/mobile/src/features/recommendations/RecommendationsTeaser.test.ts',
    'apps/mobile/src/features/recommendations/catalog.ts',
    'apps/mobile/src/features/recommendations/fit.ts',
    'apps/mobile/src/features/recommendations/fit.test.ts',
    'apps/mobile/src/features/recommendations/fragrance.ts',
    'apps/mobile/src/features/recommendations/goalAdmission.ts',
    'apps/mobile/src/features/recommendations/goalAdmission.test.ts',
    'apps/mobile/src/features/recommendations/goalProvenance.ts',
    'apps/mobile/src/features/recommendations/loading.ts',
    'apps/mobile/src/features/recommendations/preferences.ts',
    'apps/mobile/src/features/recommendations/recommendationRoutes.test.ts',
    'apps/mobile/src/features/recommendations/store.ts',
    'apps/mobile/src/features/recommendations/store.test.ts',
    'apps/mobile/src/features/recommendations/useRecommendations.ts',
    'apps/mobile/src/features/recommendations/useRecommendations.test.ts',
    'apps/mobile/src/features/scheduler/profile.ts',
    'apps/mobile/src/features/scheduler/profile.test.ts',
    'apps/mobile/src/lib/consent/healthDataWriteAdmissionContracts.test.ts',
    'apps/mobile/src/lib/consent/healthProcessingEpoch.ts',
    'apps/mobile/src/lib/legal/phase3LaunchGates.test.ts',
    'packages/types/src/database.types.ts',
    'supabase/migrations/20260726000071_recommendation_zero_admission.sql',
    'supabase/tests/database/recommendation_zero_admission.test.sql',
    'supabase/tests/upgrade/recommendation_zero_admission_0071_upgrade.test.sql',
  ]) {
    assert.match(
      requiredFilesBlock,
      new RegExp(`['"]${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`, 'u'),
      `${path} must be included in Phase 7 source hashes`,
    );
  }
});

test('Phase 7 source hashes and blockers bind the complete CORE-07A zero-share boundary', () => {
  const builderSource = readFileSync(
    new URL('./build-core-loop-qa-packet.mjs', import.meta.url),
    'utf8',
  );
  const requiredFilesBlock = /const requiredFiles = \[([\s\S]*?)\n\];/u.exec(builderSource)?.[1];
  assert.ok(requiredFilesBlock, 'requiredFiles source block must remain statically auditable');

  for (const path of CORE07A_PACKET_SOURCE_PATHS) {
    assertSourceBlockIncludes(requiredFilesBlock, path, 'Phase 7 source hashes');
  }

  assert.match(
    builderSource,
    /launchContract\.conflictShareAdmission\.sharePublicationAdmitted !== true/u,
  );
  assert.match(
    builderSource,
    /launchContract\.conflictShareAdmission\.publicLinksAdmitted !== true/u,
  );
  assert.match(builderSource, /literal zero share and public-link admission/u);
});

test('Phase 7 and Phase 9 packets bind the complete PHOTO-05A zero-Trend boundary', () => {
  const phase7Source = readFileSync(
    new URL('./build-core-loop-qa-packet.mjs', import.meta.url),
    'utf8',
  );
  const phase7Checker = readFileSync(new URL('./check-core-loop.mjs', import.meta.url), 'utf8');
  const phase7Smoke = readFileSync(
    new URL('./check-core-loop-smoke.mjs', import.meta.url),
    'utf8',
  );
  const phase9Source = readFileSync(
    new URL('../phase9/build-release-qa-packet.mjs', import.meta.url),
    'utf8',
  );
  const phase9Smoke = readFileSync(new URL('../phase9/release-smoke.mjs', import.meta.url), 'utf8');

  assert.ok(PHOTO05A_TREND_AUTHORITY_SOURCE_PATHS.length >= 35);
  for (const source of [phase7Source, phase9Source]) {
    assert.match(source, /PHOTO05A_TREND_AUTHORITY_SOURCE_PATHS/u);
    assert.match(source, /trendInsightAdmission\.trendInsightAdmitted/u);
    assert.match(source, /PHOTO-05A Trend insights remain literal-zero-admission/u);
  }
  for (const source of [phase7Checker, phase9Smoke]) {
    assert.match(source, /auditPhoto05aTrendAdmission/u);
    assert.match(source, /PHOTO05A_TREND_AUTHORITY_SOURCE_PATHS/u);
  }
  assert.match(
    phase7Smoke,
    /scripts\/photo05\/trend-admission-source-contract\.test\.mjs/u,
  );
});

test('Phase 3, Phase 8, and Phase 9 packets bind the complete CORE-07A boundary', () => {
  const phase3Source = readFileSync(
    new URL('../phase3/build-review-packet.mjs', import.meta.url),
    'utf8',
  );
  const phase8Source = readFileSync(
    new URL('../phase8/build-growth-store-qa-packet.mjs', import.meta.url),
    'utf8',
  );
  const phase9Source = readFileSync(
    new URL('../phase9/build-release-qa-packet.mjs', import.meta.url),
    'utf8',
  );
  const phase3Core07Block =
    /const core07ConflictShareReviewSources = Object\.freeze\(\[([\s\S]*?)\n\]\);/u.exec(
      phase3Source,
    )?.[1];
  const phase8SourceBlock = /const sourceFiles = \[([\s\S]*?)\n\];/u.exec(phase8Source)?.[1];
  const phase9SourceBlock = /const sourceFiles = \[([\s\S]*?)\n\];/u.exec(phase9Source)?.[1];
  assert.ok(phase3Core07Block, 'Phase 3 CORE-07A source block must be statically auditable');
  assert.ok(phase8SourceBlock, 'Phase 8 sourceFiles block must be statically auditable');
  assert.ok(phase9SourceBlock, 'Phase 9 sourceFiles block must be statically auditable');

  for (const path of CORE07A_PACKET_SOURCE_PATHS) {
    assertSourceBlockIncludes(phase3Core07Block, path, 'Phase 3 CORE-07A review sources');
    assertSourceBlockIncludes(phase8SourceBlock, path, 'Phase 8 source hashes');
    assertSourceBlockIncludes(phase9SourceBlock, path, 'Phase 9 source hashes');
  }

  for (const packetRole of [
    'legalRegulatory',
    'clinical',
    'cosmeticChemistry',
    'ipFto',
    'privacyPlatform',
  ]) {
    const roleBlock = new RegExp(
      `${packetRole}: \\[([\\s\\S]*?)(?=\\n  [A-Za-z]+: \\[|\\n\\};)`,
      'u',
    ).exec(phase3Source)?.[1];
    assert.match(
      roleBlock ?? '',
      /\.\.\.core07ConflictShareReviewSources/u,
      `Phase 3 ${packetRole} review packet must bind CORE-07A`,
    );
  }

  for (const source of [phase8Source, phase9Source]) {
    assert.match(source, /conflictShareAdmission\.sharePublicationAdmitted === true/u);
    assert.match(source, /conflictShareAdmission\.publicLinksAdmitted === true/u);
  }
});
