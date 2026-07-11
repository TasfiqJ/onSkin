# Generated Phase 7 Core Loop QA Packet

Generated at: 2026-07-11T16:30:29.889Z
Git SHA: 937f4f2fe3c909444dad13858c1a3aab1955895c
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
| apps/mobile/src/app/share/conflict/[ruleId].tsx | present | 7109 | aed44f72580bc57b155e47884b45b5b4b0b13e1857b5b3790cf63c551c141bca |
| apps/mobile/src/app/conflict/[ruleId].tsx | present | 32099 | 78935418c38160af5eef9b06d8afa19f8fc5e56306a18e059056b510f9f9f542 |
| apps/mobile/src/features/commerce/WhereToBuy.tsx | present | 8380 | 236b8c3c89b38d689ee02f83f18b90638a0ada5b4659edc8235df803d6b30293 |
| scripts/phase7/build-core-loop-qa-packet.mjs | present | 10106 | da822eed555597b12a87b79610d43ef16ad6eeb2907922b320977ceaeb6024f0 |
| scripts/phase7/check-core-loop.mjs | present | 16219 | 4b9e0fd84780938106dbc1e639787d5e82b584bb40a8042eac57c18effa789d5 |
| scripts/phase7/check-core-loop-smoke.mjs | present | 10280 | da234b040e9f1405bfeb54760846066dbdcd99754a7106be94e1a90b95d969bb |
| scripts/e2e/human-e2e-manifest.mjs | present | 37824 | 54ee792f158a7521ac0fe5ce7bfb029477e6c6a305f117ec18016e2d944cf53f |
| scripts/phase9/lib.mjs | present | 14020 | af0b4c651325a3fbb33eb94147744cb23253fa439066861e3ef1b64cbae7a083 |
| docs/HUMAN_SIMULATED_E2E_TESTING.md | present | 10167 | d7d616fcbe9078b55c0d4b3bf5e88ae19570fa533aee8edc599cf1956c7c9149 |
| docs/E2E_TESTING_CHECKLIST.md | present | 3556 | 014a9213d104d0a5bac7f1752cd94e938d3d5461d0ec5cffbf92e31678f96f7e |
| docs/USER_FLOW_TREE.md | present | 354167 | 0d62f1c5e06593f9ce362d5e58348f40dd275c796fc3f492d96a78abe0234105 |
| docs/e2e/generated/human-e2e-manifest.json | present | 32929 | 441db8a376173c44c661c7cde2e1711177f028be5f6349eeec7b581d53c4f319 |
| docs/e2e/generated/human-e2e-manifest.md | present | 10627 | 90bcb7daf5c686d158ab7669ae64fb628e8ce16236b57b4c7a6ec553c91c69ab |
| docs/phase-5/generated/device-qa-packet.json | present | 16918 | 820866b44a79acf275136f3ac4101051adf0fd45c72c1d95dc839a3c6774ab9f |
| docs/phase-5/generated/device-qa-packet.md | present | 15600 | c6c860b8e31e5bf078d9dbfb67f6cb946dbad0dcfce6dd1bbe10f3c4705c8e3e |
| docs/phase-6/generated/payments-qa-packet.json | present | 10523 | 6583e284146707e31911e2828496f56a6075070a46b2d089a0e119dffc545d9e |
| docs/phase-6/generated/payments-qa-packet.md | present | 7862 | 51878f70b6bf5cde3b1a9f32b48377707de8ec1058d2f2488764453e5b90495b |
| docs/phase-7/surface-inventory.md | present | 7793 | 50c0f72fb317e36588a30559cd254dcb3b7ebaa7c73b8b4ba4dfb9ea35350fd6 |
| docs/phase-7/launch-claim-matrix.md | present | 4322 | 7027d6d21f2cc7c3bb6944f003f9aeac6a09efea8dc2785280f6a3da44bb6b6b |
| docs/phase-7/beta-evidence-dashboard.md | present | 4725 | f57bd8b15489b66c4dbee486f3e15190eb2e4752420308dfb71883372348cdd1 |
| docs/phase-7/core-loop-qa-checklist.md | present | 60424 | 95fb90e8616b9ae4fe53f2706e85004b643461562a8a796f3e34bc16756d7570 |
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

- none
