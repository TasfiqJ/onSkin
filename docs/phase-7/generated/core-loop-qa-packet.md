# Generated Phase 7 Core Loop QA Packet

Generated at: 2026-07-08T18:53:00.898Z
Git SHA: 48afa938fa9b40cee2b50e2189daa7bf3e2d7910
Git status: clean

Strict completion requires real brand/legal clearance, Supabase RLS evidence, clinical review, catalog import evidence, device QA, RevenueCat QA, privacy/export/delete QA, analytics dashboard readiness, and a named owner.

## Evidence

- Brand ready: BLOCKED
- Supabase RLS pass: BLOCKED
- Clinical review pass: BLOCKED
- Catalog beta import pass: BLOCKED
- Device QA pass: BLOCKED
- RevenueCat QA pass: BLOCKED
- Privacy/export/delete pass: BLOCKED
- Beta dashboard ready: BLOCKED
- Signed off by: BLOCKED

## Scenario Evidence

- Onboarding (PHASE7_ONBOARDING_CONSENT_QA_PASS): BLOCKED
- Shelf intake (PHASE7_SHELF_INTAKE_QA_PASS): BLOCKED
- Reviewed guidance (PHASE7_REVIEWED_GUIDANCE_QA_PASS): BLOCKED
- Routine builder (PHASE7_ROUTINE_BUILDER_QA_PASS): BLOCKED
- Today check-off (PHASE7_TODAY_CHECKOFF_QA_PASS): BLOCKED
- Photos (PHASE7_PHOTOS_PRIVACY_QA_PASS): BLOCKED
- Reminders (PHASE7_REMINDERS_QA_PASS): BLOCKED
- Payments (PHASE7_PAYMENTS_LIFECYCLE_QA_PASS): BLOCKED
- Privacy controls (PHASE7_PRIVACY_CONTROLS_QA_PASS): BLOCKED
- Share card (PHASE7_SHARE_CARD_QA_PASS): BLOCKED
- Deferred surfaces (PHASE7_DEFERRED_SURFACES_QA_PASS): BLOCKED
- Analytics (PHASE7_ANALYTICS_QA_PASS): BLOCKED

## Scenarios

| Surface | Required scenario set | Evidence flag | Status |
| --- | --- | --- | --- |
| Onboarding | final age/account/consent copy, policy links, and consent ledger verified | `PHASE7_ONBOARDING_CONSENT_QA_PASS` | BLOCKED |
| Shelf intake | add 3 real owned products via manual/search/scan-or-OCR fallback; source/confidence visible | `PHASE7_SHELF_INTAKE_QA_PASS` | BLOCKED |
| Reviewed guidance | reviewed conflict shows evidence and sequence guidance; unreviewed conflict stays hidden | `PHASE7_REVIEWED_GUIDANCE_QA_PASS` | BLOCKED |
| Routine builder | AM/PM routine persists across restart, offline, timezone rollover | `PHASE7_ROUTINE_BUILDER_QA_PASS` | BLOCKED |
| Today check-off | offline/online check-off is idempotent and append-only | `PHASE7_TODAY_CHECKOFF_QA_PASS` | BLOCKED |
| Photos | baseline capture renders locally; app lock gates timeline; cloud backup remains off by default | `PHASE7_PHOTOS_PRIVACY_QA_PASS` | BLOCKED |
| Reminders | permission, quiet hours, Android 13+ permission, timezone/DST behavior verified | `PHASE7_REMINDERS_QA_PASS` | BLOCKED |
| Payments | RevenueCat purchase, restore, cancellation, expiration, refund, and webhook lifecycle verified | `PHASE7_PAYMENTS_LIFECYCLE_QA_PASS` | BLOCKED |
| Privacy controls | export, account deletion, health-data withdrawal, app lock, support links verified | `PHASE7_PRIVACY_CONTROLS_QA_PASS` | BLOCKED |
| Share card | exact owned reviewed conflict only; no fallback; no sensitive analytics payload | `PHASE7_SHARE_CARD_QA_PASS` | BLOCKED |
| Deferred surfaces | commerce/community posting/trend/cloud Ask/widgets/share hidden unless gates enabled | `PHASE7_DEFERRED_SURFACES_QA_PASS` | BLOCKED |
| Analytics | activation, retention, payment, privacy, support, and deferred-surface events visible | `PHASE7_ANALYTICS_QA_PASS` | BLOCKED |

## Files

| Path | Status | Bytes | SHA-256 |
| --- | --- | --- | --- |
| package.json | present | 11407 | 68de59211e7bd4051bbba65042722123f6f8e20e1f27f4eb40bc9d363a0ad2cd |
| apps/mobile/src/lib/launch/phase7.ts | present | 5290 | 4369c73351a58fd6cad9c5d94917185fadb7e67bf219aa9f85814dea5055e663 |
| apps/mobile/src/lib/launch/phase7.test.ts | present | 7951 | d8f1f40b721e0424f4781b7f5769d6610648c3b1dfac45a9ee0bf42e273f1815 |
| apps/mobile/src/components/launch/DeferredSurface.tsx | present | 2028 | 235a3fcdab2164c06c8677417a2ab5756779e0a53d1dd8b0d7485e6eba619f87 |
| apps/mobile/src/app/(tabs)/today.tsx | present | 27361 | cb2c74598a3555608d103545b05c231f3f489fee5085df3112bceb1577422263 |
| apps/mobile/src/app/(tabs)/progress.tsx | present | 25194 | db75034f851c2238d6d8de011bc42a938bea2d0eb11d57d9b4449e64bbd2a652 |
| apps/mobile/src/app/(tabs)/you.tsx | present | 32161 | a006ea9b8260d2d578bf02b73f14a5c63d238ea930c322e81e4256a63b4d355e |
| apps/mobile/src/app/share/conflict/[ruleId].tsx | present | 5773 | 2d3372b7a4d726109665bbe067ac38bf4866f5a4daf3a539c52a322e860dd240 |
| apps/mobile/src/app/conflict/[ruleId].tsx | present | 24700 | 61d0ca03d82d58b972df8bb0f6dd4a5a480f7db6eef75be8f45bbf9abc53038a |
| apps/mobile/src/features/commerce/WhereToBuy.tsx | present | 8380 | 236b8c3c89b38d689ee02f83f18b90638a0ada5b4659edc8235df803d6b30293 |
| scripts/phase7/build-core-loop-qa-packet.mjs | present | 9809 | e1ea6e596d962c67af726fb6a8cac773c3499d54bb0a95f7a0f9682acf459b31 |
| scripts/phase7/check-core-loop.mjs | present | 14089 | d55d32b8762d00ab70c09a695e3eb8476e50ab15bda4f50a17f69ff747ce9133 |
| scripts/phase7/check-core-loop-smoke.mjs | present | 9106 | 757a489d6ad9b572859c244da99c1bc6261537842a410e13abad7bbd60bcf4b2 |
| scripts/phase9/lib.mjs | present | 9767 | d2eeb648cca2cc61457e9796d6f1074081effb8847b2ec37544c3e7df3ce3752 |
| docs/phase-7/surface-inventory.md | present | 7793 | a4b7493dc8ae05e53a214867993ddfd57ce5a3cada59157f253762cb6714e593 |
| docs/phase-7/launch-claim-matrix.md | present | 4282 | c9e79636f0da8a3138eb438f09a172cd873fb7465ad5f6a17030941fe63e8174 |
| docs/phase-7/beta-evidence-dashboard.md | present | 4416 | 21255a254436a75a2765a262ad03a044a29f28ea2adae15a4b833d00871a373e |
| docs/phase-7/core-loop-qa-checklist.md | present | 60173 | e9febe41e458fc2b3ef02093d3a7e27dd221d788892d75c09e4cdb04f16de344 |
| docs/phase-7/phase-7-exit-review.md | present | 3218 | 2b4f7601bd8165061ac3e8cb2e4c05726a865218dd1dd50867458dbdddfbed82 |

## Blockers

- Missing brandReady evidence.
- Missing supabaseRlsPass evidence.
- Missing clinicalReviewPass evidence.
- Missing catalogBetaImportPass evidence.
- Missing deviceQaPass evidence.
- Missing revenueCatQaPass evidence.
- Missing privacyExportDeletePass evidence.
- Missing betaDashboardReady evidence.
- Missing PHASE7_SIGNED_OFF_BY.
- Missing onboardingConsentQaPass evidence.
- Missing shelfIntakeQaPass evidence.
- Missing reviewedGuidanceQaPass evidence.
- Missing routineBuilderQaPass evidence.
- Missing todayCheckoffQaPass evidence.
- Missing photosPrivacyQaPass evidence.
- Missing remindersQaPass evidence.
- Missing paymentsLifecycleQaPass evidence.
- Missing privacyControlsQaPass evidence.
- Missing shareCardQaPass evidence.
- Missing deferredSurfacesQaPass evidence.
- Missing analyticsQaPass evidence.

## Warnings

- none
