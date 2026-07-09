# Generated Phase 7 Core Loop QA Packet

Generated at: 2026-07-09T18:28:08.443Z
Git SHA: 03fb31af74c81f76fab88391b2d8c7b8a040f68e
Git status: DIRTY

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
| package.json | present | 14807 | 31b25f729ad716330f4120b1a2ad67f2ce7c01f0cd8608ce9b38e1030698c4aa |
| apps/mobile/src/lib/launch/phase7.ts | present | 5290 | 4369c73351a58fd6cad9c5d94917185fadb7e67bf219aa9f85814dea5055e663 |
| apps/mobile/src/lib/launch/phase7.test.ts | present | 7951 | d8f1f40b721e0424f4781b7f5769d6610648c3b1dfac45a9ee0bf42e273f1815 |
| apps/mobile/src/components/launch/DeferredSurface.tsx | present | 2028 | 235a3fcdab2164c06c8677417a2ab5756779e0a53d1dd8b0d7485e6eba619f87 |
| apps/mobile/src/app/(tabs)/today.tsx | present | 27883 | a216d3f78511fedfa7af67773a9957a49458f4abdb5b1687c21a61784ae18584 |
| apps/mobile/src/app/(tabs)/progress.tsx | present | 25194 | db75034f851c2238d6d8de011bc42a938bea2d0eb11d57d9b4449e64bbd2a652 |
| apps/mobile/src/app/(tabs)/you.tsx | present | 38561 | 47d58f9c906361dd4190dd58cf8684cdc11ff2eeb8ac02ff0b7e75714e9ea579 |
| apps/mobile/src/app/share/conflict/[ruleId].tsx | present | 5773 | 2d3372b7a4d726109665bbe067ac38bf4866f5a4daf3a539c52a322e860dd240 |
| apps/mobile/src/app/conflict/[ruleId].tsx | present | 24992 | a579f53bfb9147654d214090dff5705c6102f16d57d145b4220a08e9910b5c17 |
| apps/mobile/src/features/commerce/WhereToBuy.tsx | present | 8380 | 236b8c3c89b38d689ee02f83f18b90638a0ada5b4659edc8235df803d6b30293 |
| scripts/phase7/build-core-loop-qa-packet.mjs | present | 10052 | 1dae83cb3b21bda64a75e3a90f64b13253072d256b521f885516bbb02b906407 |
| scripts/phase7/check-core-loop.mjs | present | 16278 | 770178f78f6ba6bbe6702940c9eec9f9059c394a13900b874da09fcb2116a72d |
| scripts/phase7/check-core-loop-smoke.mjs | present | 10280 | da234b040e9f1405bfeb54760846066dbdcd99754a7106be94e1a90b95d969bb |
| scripts/e2e/human-e2e-manifest.mjs | present | 18644 | 3b78970de07f5dad6adaeaddc58dab5a8bc7f4780647144890e604ffdfd0de1e |
| scripts/phase9/lib.mjs | present | 13541 | 54b07f029b0b690a4ad8f4c05e524201a52a952c44e62ba9582d270764a141d7 |
| docs/HUMAN_SIMULATED_E2E_TESTING.md | present | 9982 | 2828721ebc99a2de1e4ba722516bfacd4ed8c2537603c8756cc383c49d5889a5 |
| docs/E2E_TESTING_CHECKLIST.md | present | 3556 | 014a9213d104d0a5bac7f1752cd94e938d3d5461d0ec5cffbf92e31678f96f7e |
| docs/USER_FLOW_TREE.md | present | 293157 | 56963ec469d4a6fae6568c17130c91e2d3fe12308b579c34e5f64b6c88eb39be |
| docs/e2e/generated/human-e2e-manifest.json | present | 11616 | 392688b9c78aa9e03700a13660e20102a0ec04fcae680fed8ac2aa2ad559007b |
| docs/e2e/generated/human-e2e-manifest.md | present | 4958 | 21f595397ff9970dbc09c3f8c85e2574e370f6461c5bdc126ee18ec90fdd91f1 |
| docs/phase-5/generated/device-qa-packet.json | present | 22883 | 9c8d30652e8287cbaa2cdcfaad36d0f4e4bafba643276808e48117295ee37ef2 |
| docs/phase-5/generated/device-qa-packet.md | present | 10016 | f18432b07a60171b96fd2bd9ed89b29175aeb061c71d9ca8015bbc8f66334963 |
| docs/phase-6/generated/payments-qa-packet.json | present | 22136 | 8bad079b0c9c394cdd526bdd42d1acd26d44a2c3c991d12c0e5e5cd300c574b9 |
| docs/phase-6/generated/payments-qa-packet.md | present | 7961 | 66dd748e5b465ab633ec4a15c682bee677f6f20a227ed3b27022c619c45c9106 |
| docs/phase-7/surface-inventory.md | present | 7793 | a4b7493dc8ae05e53a214867993ddfd57ce5a3cada59157f253762cb6714e593 |
| docs/phase-7/launch-claim-matrix.md | present | 4282 | c9e79636f0da8a3138eb438f09a172cd873fb7465ad5f6a17030941fe63e8174 |
| docs/phase-7/beta-evidence-dashboard.md | present | 4705 | 5388ca6479bdd3bf247c172b724e14b53be9bc1e0bb590f91ee546f150d2fe50 |
| docs/phase-7/core-loop-qa-checklist.md | present | 60287 | 43800c02917db3a42017375c4ec026a868fee17f988478c3f2e5f2da25d14dca |
| docs/phase-7/phase-7-exit-review.md | present | 3509 | 033edec9712f3e4bb2529ca8f6b27b91953503664d326774113fdec9ec7748d4 |

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

- Phase 7 core-loop QA packet generated with a dirty Git worktree; do not use it as final core-loop evidence.
