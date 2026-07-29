import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  PHASE7_EVIDENCE_KEYS,
  validatePhase7EvidenceInventory,
} from './core-loop-qa-packet-contract.mjs';

function validEvidence() {
  return Object.fromEntries(
    PHASE7_EVIDENCE_KEYS.map((key) => [key, key === 'signedOffBy' ? 'Release Owner' : true]),
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
