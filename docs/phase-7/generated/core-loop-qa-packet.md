# Generated Phase 7 Core Loop QA Packet

Generated at: 2026-07-09T00:03:00.135Z
Git SHA: 54506c8b1f65173165b3ca7d3b0f5073c8bbad11
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
| package.json | present | 12955 | 4107d6b3929824056bfe0ad7dbe69cb7908b974794003936e013dd4ba5f31475 |
| apps/mobile/src/lib/launch/phase7.ts | present | 5290 | 4369c73351a58fd6cad9c5d94917185fadb7e67bf219aa9f85814dea5055e663 |
| apps/mobile/src/lib/launch/phase7.test.ts | present | 7951 | d8f1f40b721e0424f4781b7f5769d6610648c3b1dfac45a9ee0bf42e273f1815 |
| apps/mobile/src/components/launch/DeferredSurface.tsx | present | 2028 | 235a3fcdab2164c06c8677417a2ab5756779e0a53d1dd8b0d7485e6eba619f87 |
| apps/mobile/src/app/(tabs)/today.tsx | present | 27361 | cb2c74598a3555608d103545b05c231f3f489fee5085df3112bceb1577422263 |
| apps/mobile/src/app/(tabs)/progress.tsx | present | 25194 | db75034f851c2238d6d8de011bc42a938bea2d0eb11d57d9b4449e64bbd2a652 |
| apps/mobile/src/app/(tabs)/you.tsx | present | 33182 | 7d1e90f257aa92b11844c67eb97cb1fc12ca148473446a65fbf3baf2722aec8d |
| apps/mobile/src/app/share/conflict/[ruleId].tsx | present | 5773 | 2d3372b7a4d726109665bbe067ac38bf4866f5a4daf3a539c52a322e860dd240 |
| apps/mobile/src/app/conflict/[ruleId].tsx | present | 24700 | 61d0ca03d82d58b972df8bb0f6dd4a5a480f7db6eef75be8f45bbf9abc53038a |
| apps/mobile/src/features/commerce/WhereToBuy.tsx | present | 8380 | 236b8c3c89b38d689ee02f83f18b90638a0ada5b4659edc8235df803d6b30293 |
| scripts/phase7/build-core-loop-qa-packet.mjs | present | 10271 | 51d7ab3a8ab4f8f7af0405684562774cc2020461c73c507cd5b6516ccd49c206 |
| scripts/phase7/check-core-loop.mjs | present | 14514 | 2ab330cd53a968052cd3ec1e558c4563a9119c8ea2f5cd1f551e14047fbddd83 |
| scripts/phase7/check-core-loop-smoke.mjs | present | 10280 | da234b040e9f1405bfeb54760846066dbdcd99754a7106be94e1a90b95d969bb |
| scripts/e2e/human-e2e-manifest.mjs | present | 12250 | 5e1e790ab41492349ae604582d6bcfe93b1c31190bb2df6065908cab59184b7b |
| scripts/phase9/lib.mjs | present | 9767 | d2eeb648cca2cc61457e9796d6f1074081effb8847b2ec37544c3e7df3ce3752 |
| docs/HUMAN_SIMULATED_E2E_TESTING.md | present | 9642 | e323d2a1826f9dceef1aaa3b91a6d04aa6c662f159af876a1fb6d7b232101f29 |
| docs/E2E_TESTING_CHECKLIST.md | present | 3387 | ca541bd7fdd87e0853e707f845a144a53c71d50c55adebfb17feccedd956c812 |
| docs/USER_FLOW_TREE.md | present | 211779 | 615cc87c27dbcb621b82074e37c0f06cc1834e4fff47c65bed6565dd4ef92edf |
| docs/e2e/generated/human-e2e-manifest.json | present | 3293 | 619223fe5cfece6e1fc7d9ca59f27f46e01cedd0c23afb06cfb97e513380d495 |
| docs/e2e/generated/human-e2e-manifest.md | present | 1774 | 9df317fbf00f856a71bfeb630ba2ae474458ed9a7fe565f242db9c32cd53ef6e |
| docs/phase-5/generated/device-qa-packet.json | present | 11354 | afaf48f1a3ac39425ce619709bef38b5d951d3bf09826cb002b58950fbd21993 |
| docs/phase-5/generated/device-qa-packet.md | present | 9874 | c1b9fed54a8d8c25a4edabda0e7364640ed71986753c11fb30f006d84e9d2d64 |
| docs/phase-6/generated/payments-qa-packet.json | present | 10792 | a9afabd8b28aa159b62167ce08669bb0bcb12544997033cfeabc152af46aa19b |
| docs/phase-6/generated/payments-qa-packet.md | present | 7958 | 173691da23d175d2f1d6c458068c2829d89dc008001a81b41752264a712e1a44 |
| docs/phase-7/surface-inventory.md | present | 7793 | a4b7493dc8ae05e53a214867993ddfd57ce5a3cada59157f253762cb6714e593 |
| docs/phase-7/launch-claim-matrix.md | present | 4282 | c9e79636f0da8a3138eb438f09a172cd873fb7465ad5f6a17030941fe63e8174 |
| docs/phase-7/beta-evidence-dashboard.md | present | 4416 | 21255a254436a75a2765a262ad03a044a29f28ea2adae15a4b833d00871a373e |
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
