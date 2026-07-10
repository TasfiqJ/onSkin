# Generated Phase 7 Core Loop QA Packet

Generated at: 2026-07-10T08:55:13.217Z
Git SHA: 1eadd75779d048bb300c1073ed74fce6a298a15b
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
| package.json | present | 18099 | 5967b643a1c61a763bebcd45d215e5286c001a1fc1c663c3be17589af3dffe40 |
| apps/mobile/src/lib/launch/phase7.ts | present | 5290 | 4369c73351a58fd6cad9c5d94917185fadb7e67bf219aa9f85814dea5055e663 |
| apps/mobile/src/lib/launch/phase7.test.ts | present | 7951 | d8f1f40b721e0424f4781b7f5769d6610648c3b1dfac45a9ee0bf42e273f1815 |
| apps/mobile/src/components/launch/DeferredSurface.tsx | present | 2028 | 235a3fcdab2164c06c8677417a2ab5756779e0a53d1dd8b0d7485e6eba619f87 |
| apps/mobile/src/app/(tabs)/today.tsx | present | 27951 | b10bdc8f6f1111f338204360a5922f7631e0cfa58a237a464163b3f42dffd765 |
| apps/mobile/src/app/(tabs)/progress.tsx | present | 24390 | 9a10433844920d13397d28f7cc755a8c7cf94e3bc36eddbdb7e55efcf075b437 |
| apps/mobile/src/app/(tabs)/you.tsx | present | 36961 | 2c5afcc4d8b33a561dfca93ca6f577ff64f731f782f81a606fb5a73aec9102d2 |
| apps/mobile/src/app/share/conflict/[ruleId].tsx | present | 5773 | 2d3372b7a4d726109665bbe067ac38bf4866f5a4daf3a539c52a322e860dd240 |
| apps/mobile/src/app/conflict/[ruleId].tsx | present | 24992 | a579f53bfb9147654d214090dff5705c6102f16d57d145b4220a08e9910b5c17 |
| apps/mobile/src/features/commerce/WhereToBuy.tsx | present | 8380 | 236b8c3c89b38d689ee02f83f18b90638a0ada5b4659edc8235df803d6b30293 |
| scripts/phase7/build-core-loop-qa-packet.mjs | present | 10106 | da822eed555597b12a87b79610d43ef16ad6eeb2907922b320977ceaeb6024f0 |
| scripts/phase7/check-core-loop.mjs | present | 16219 | 4b9e0fd84780938106dbc1e639787d5e82b584bb40a8042eac57c18effa789d5 |
| scripts/phase7/check-core-loop-smoke.mjs | present | 10280 | da234b040e9f1405bfeb54760846066dbdcd99754a7106be94e1a90b95d969bb |
| scripts/e2e/human-e2e-manifest.mjs | present | 29454 | 14166e843aa3f8f4381accc5e5ab314af43603a912a0b866558c6d5d6097afee |
| scripts/phase9/lib.mjs | present | 14020 | af0b4c651325a3fbb33eb94147744cb23253fa439066861e3ef1b64cbae7a083 |
| docs/HUMAN_SIMULATED_E2E_TESTING.md | present | 10167 | d7d616fcbe9078b55c0d4b3bf5e88ae19570fa533aee8edc599cf1956c7c9149 |
| docs/E2E_TESTING_CHECKLIST.md | present | 3556 | 014a9213d104d0a5bac7f1752cd94e938d3d5461d0ec5cffbf92e31678f96f7e |
| docs/USER_FLOW_TREE.md | present | 318855 | 6e0bb6efd87a7034f036d9babcb3dceb4fa2b41b3f498a4689c0f7e1bcd6c15a |
| docs/e2e/generated/human-e2e-manifest.json | present | 24247 | dbdca165e7ee4df35aae3e29a4bded3498dbd5e381b915ccabf8d27b0a5cce09 |
| docs/e2e/generated/human-e2e-manifest.md | present | 8287 | 9568d64eb9e485d3d720bfd28d102ca8d1de4af1488cf38b98f9f82696459cb0 |
| docs/phase-5/generated/device-qa-packet.json | present | 15626 | e37a7b340238caf5f9e3f15eb4aa0bfdb4bc49f215abd4ebb6b7a39a14106f41 |
| docs/phase-5/generated/device-qa-packet.md | present | 14518 | 24145a1ea3e82a5f41bc56fdc7dbd64faa97e6357aaca38d9b3eeb97bfb7ddbc |
| docs/phase-6/generated/payments-qa-packet.json | present | 10522 | 0358156ba337e69ae33cfc41c006525f1998dadde518912bdca1f3fb9d9f50a6 |
| docs/phase-6/generated/payments-qa-packet.md | present | 7861 | 1e1ae31e1ab76341bf1e664b811948e318d9da349db60b85d5b9222857df8ac8 |
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
