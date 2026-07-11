# Generated Phase 7 Core Loop QA Packet

Generated at: 2026-07-11T17:30:14.994Z
Git SHA: 2e59932f348ae3ad9e826932c240ab6325f31c82
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
| Photos | baseline capture renders locally; app lock gates timeline; settings and Progress show device-only storage with no backup control or automatic upload | `PHASE7_PHOTOS_PRIVACY_QA_PASS` | BLOCKED |
| Reminders | permission, quiet hours, Android 13+ permission, timezone/DST behavior verified | `PHASE7_REMINDERS_QA_PASS` | BLOCKED |
| Payments | RevenueCat purchase, restore, cancellation, expiration, refund, and webhook lifecycle verified | `PHASE7_PAYMENTS_LIFECYCLE_QA_PASS` | BLOCKED |
| Privacy controls | export, account deletion, health-data withdrawal, app lock, support links verified | `PHASE7_PRIVACY_CONTROLS_QA_PASS` | BLOCKED |
| Share card | exact owned reviewed conflict only; no fallback; no sensitive analytics payload | `PHASE7_SHARE_CARD_QA_PASS` | BLOCKED |
| Deferred surfaces | commerce/community posting/trend/cloud Ask/widgets/share hidden unless gates enabled | `PHASE7_DEFERRED_SURFACES_QA_PASS` | BLOCKED |
| Analytics | activation, retention, payment, privacy, support, and deferred-surface events visible | `PHASE7_ANALYTICS_QA_PASS` | BLOCKED |

## Files

| Path | Status | Bytes | SHA-256 |
| --- | --- | --- | --- |
| package.json | present | 18313 | 5714a4b7bd35cffa77b9951ebfcad3b090cc707a89bf0e0f6001ae7ad49c81b3 |
| apps/mobile/src/lib/launch/phase7.ts | present | 5290 | 4369c73351a58fd6cad9c5d94917185fadb7e67bf219aa9f85814dea5055e663 |
| apps/mobile/src/lib/launch/phase7.test.ts | present | 7951 | d8f1f40b721e0424f4781b7f5769d6610648c3b1dfac45a9ee0bf42e273f1815 |
| apps/mobile/src/components/launch/DeferredSurface.tsx | present | 2028 | 235a3fcdab2164c06c8677417a2ab5756779e0a53d1dd8b0d7485e6eba619f87 |
| apps/mobile/src/app/(tabs)/today.tsx | present | 32816 | c1f1d270ed129521e39147d536b2d98da36945bab0a1f6d169473bd78884c501 |
| apps/mobile/src/app/(tabs)/progress.tsx | present | 20519 | d009aa555a3230ad67a41dfdc2cbeb184b9684757b97085346fe5362e57c7125 |
| apps/mobile/src/app/(tabs)/you.tsx | present | 37119 | b13fdc0f555048e214cda72affba45497b2d340b0e60a0ab4ae020a2ccc54c24 |
| apps/mobile/src/app/cycle/settings.tsx | present | 27252 | 0ecdd558bf0120bd4a3906899313ae9aefe7ad3452c761c742b428099fea4c4f |
| apps/mobile/src/app/cycle/week.tsx | present | 13901 | 264a6d9fa2ce28abbb132d61b80739da5eb196990ef47867e1e6c3444e93b868 |
| apps/mobile/src/app/cycle/why-tonight.tsx | present | 8646 | 758245963dc29153bcb362353c3f375249b4fb0cde6ff60f5df2826875d444f2 |
| apps/mobile/src/app/routine/plan.tsx | present | 19392 | e0aa50b301550896c7fd6c963ccd0fa23aa9282927d00e5ed2e917a3ace8c006 |
| apps/mobile/src/app/share/conflict/[ruleId].tsx | present | 7123 | 0bd46e014ebcb0e3f2affaacfda83b2685137028564bca5a717fa7ac81f038db |
| apps/mobile/src/app/conflict/[ruleId].tsx | present | 32130 | f7dcd9e72e5d7209686a12708eea38498ce4d4d39b57f497bc37b127c834f6b8 |
| apps/mobile/src/features/commerce/WhereToBuy.tsx | present | 8380 | 236b8c3c89b38d689ee02f83f18b90638a0ada5b4659edc8235df803d6b30293 |
| apps/mobile/src/features/scheduler/cadence.ts | present | 1364 | f7164eef26e124c398c3f79e3088c7500c2e35adc41f02ac47abdf675bab3b21 |
| apps/mobile/src/features/scheduler/customCycle.ts | present | 13146 | 3e6fc08ddf8813933f5e07216fc04c411d7683a44f3761b33b82132f95ee9cda |
| apps/mobile/src/features/scheduler/customCycle.test.ts | present | 9291 | 9cec61bc36016b5c2acc6afeaff48b37cae861271141203520574ea3399f8e14 |
| apps/mobile/src/features/scheduler/cycleStore.ts | present | 16143 | 79bbc5f714baac7229a381aa4dd99eff542b4d357eba10ec6dc2a515f31e56bc |
| apps/mobile/src/features/scheduler/cycleStore.test.ts | present | 14902 | 77a6eebec64f7afbefa60f6ad04878b075c7f74e105ce409a8b1d52b7713fa06 |
| apps/mobile/src/features/scheduler/cycleWeekRoute.test.ts | present | 15514 | f9842811b150aa91c76201cedac3dd7ec6a31e52f04ae80540e1fdc42904cb46 |
| apps/mobile/src/features/scheduler/orchestrate.ts | present | 12566 | cc78a6d95295d2dd3cf2db03e00401fcd01bf3142ca0a329e25d5e2e2e884a37 |
| apps/mobile/src/features/scheduler/orchestrate.test.ts | present | 19231 | da53077967a8907cc35ac85b032fc1dba1537cc9b92d99b180b3ffb7a4e388b2 |
| apps/mobile/src/features/scheduler/useCycle.ts | present | 9317 | 4e69bfb5c48f94701e888144161597b2f27ff7880d19426e8b418e896df32a23 |
| apps/mobile/src/features/today/cycleCompletion.ts | present | 606 | 98332563cb28e0978440e3ef1c800eb67421adec0d29b8f164efa69d3c43c271 |
| apps/mobile/src/features/today/cycleCompletion.test.ts | present | 2082 | 455515f4c61045684d8e7a89501db67b90463eac203743659517940c2ea7788a |
| scripts/phase7/build-core-loop-qa-packet.mjs | present | 10903 | da6aaa4c5aeda636a3e822ba7afdcd0db4771d2f37f044ba5a4547e341c49f48 |
| scripts/phase7/check-core-loop.mjs | present | 17337 | d49a76cb07a11d2d158d893e302bc538ac269acbf3687672f905d88d838db51d |
| scripts/phase7/check-core-loop-smoke.mjs | present | 10994 | 3a9f398c342a03addc9e1dace1bd005cc911f7f5c18dae7b741b5f58408a4d71 |
| scripts/e2e/human-e2e-manifest.mjs | present | 41906 | 5028a1552134333ece0ced9314f40ccc34ab3b45a67d25af9bc04894d76bddb0 |
| scripts/phase9/lib.mjs | present | 14020 | af0b4c651325a3fbb33eb94147744cb23253fa439066861e3ef1b64cbae7a083 |
| docs/HUMAN_SIMULATED_E2E_TESTING.md | present | 10167 | d7d616fcbe9078b55c0d4b3bf5e88ae19570fa533aee8edc599cf1956c7c9149 |
| docs/E2E_TESTING_CHECKLIST.md | present | 3556 | 014a9213d104d0a5bac7f1752cd94e938d3d5461d0ec5cffbf92e31678f96f7e |
| docs/USER_FLOW_TREE.md | present | 355650 | ef2dd4927ee2d66d93dc8e32d17dd1bebef7ee53c79bda7a974952139a383670 |
| docs/e2e/generated/human-e2e-manifest.json | present | 35785 | 586149b9474041ab7483a5d420208155e88a3641d1cf4fb85d876f69388ed09f |
| docs/e2e/generated/human-e2e-manifest.md | present | 11095 | 9fe47ff657697aa041c7abb01e51a73f7bafb8bc040978177414c3d0f180e1af |
| docs/phase-5/generated/device-qa-packet.json | present | 16918 | 64d6fd7d4c5e5a723090caec368f77e78e98aec3d2df499dbb3aa2b5405618f8 |
| docs/phase-5/generated/device-qa-packet.md | present | 15600 | fd59a00f3bdab3c96cc7ee1d02d84b5409e290b243b4e691e3ddf595d6599760 |
| docs/phase-6/generated/payments-qa-packet.json | present | 10523 | 6fb6bc788a247cd927b75addd2f8529337ce6155d15ba45c269b4ff7b5e7811a |
| docs/phase-6/generated/payments-qa-packet.md | present | 7862 | 37bcd4cf45dccdbc332bbfc99f91c09a4ae0ce43c97dfae816fde854891f0d39 |
| docs/phase-7/surface-inventory.md | present | 7793 | 50c0f72fb317e36588a30559cd254dcb3b7ebaa7c73b8b4ba4dfb9ea35350fd6 |
| docs/phase-7/launch-claim-matrix.md | present | 4322 | 7027d6d21f2cc7c3bb6944f003f9aeac6a09efea8dc2785280f6a3da44bb6b6b |
| docs/phase-7/beta-evidence-dashboard.md | present | 4725 | f57bd8b15489b66c4dbee486f3e15190eb2e4752420308dfb71883372348cdd1 |
| docs/phase-7/core-loop-qa-checklist.md | present | 62571 | 4bcb13d247ba00a741d943cc606554d2f588338cac428932ed5fba6b2f1805f1 |
| docs/phase-7/phase-7-exit-review.md | present | 4261 | af747174347a16ab1bcfcaba8a35b26c95b26708912f4cb56e0bf5c3862ce7cb |

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
