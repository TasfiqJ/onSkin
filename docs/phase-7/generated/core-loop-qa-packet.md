# Generated Phase 7 Core Loop QA Packet

Generated at: 2026-07-08T17:27:19.839Z

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

## Scenarios

| Surface | Required scenario set |
| --- | --- |
| Onboarding | final age/account/consent copy, policy links, and consent ledger verified |
| Shelf intake | add 3 real owned products via manual/search/scan-or-OCR fallback; source/confidence visible |
| Reviewed guidance | reviewed conflict shows evidence and sequence guidance; unreviewed conflict stays hidden |
| Routine builder | AM/PM routine persists across restart, offline, timezone rollover |
| Today check-off | offline/online check-off is idempotent and append-only |
| Photos | baseline capture renders locally; app lock gates timeline; cloud backup remains off by default |
| Reminders | permission, quiet hours, Android 13+ permission, timezone/DST behavior verified |
| Payments | RevenueCat purchase, restore, cancellation, expiration, refund, and webhook lifecycle verified |
| Privacy controls | export, account deletion, health-data withdrawal, app lock, support links verified |
| Share card | exact owned reviewed conflict only; no fallback; no sensitive analytics payload |
| Deferred surfaces | commerce/community posting/trend/cloud Ask/widgets/share hidden unless gates enabled |
| Analytics | activation, retention, payment, privacy, support, and deferred-surface events visible |

## Files

| Path | Status | Bytes | SHA-256 |
| --- | --- | --- | --- |
| package.json | present | 11324 | 1eeae3e44ae91079c226bd7a7e9713aebc0fa812f7d4209077be63f1b54324f6 |
| apps/mobile/src/lib/launch/phase7.ts | present | 5290 | 4369c73351a58fd6cad9c5d94917185fadb7e67bf219aa9f85814dea5055e663 |
| apps/mobile/src/lib/launch/phase7.test.ts | present | 7951 | d8f1f40b721e0424f4781b7f5769d6610648c3b1dfac45a9ee0bf42e273f1815 |
| apps/mobile/src/components/launch/DeferredSurface.tsx | present | 2028 | 235a3fcdab2164c06c8677417a2ab5756779e0a53d1dd8b0d7485e6eba619f87 |
| apps/mobile/src/app/(tabs)/today.tsx | present | 27361 | cb2c74598a3555608d103545b05c231f3f489fee5085df3112bceb1577422263 |
| apps/mobile/src/app/(tabs)/progress.tsx | present | 25194 | db75034f851c2238d6d8de011bc42a938bea2d0eb11d57d9b4449e64bbd2a652 |
| apps/mobile/src/app/(tabs)/you.tsx | present | 32161 | a006ea9b8260d2d578bf02b73f14a5c63d238ea930c322e81e4256a63b4d355e |
| apps/mobile/src/app/share/conflict/[ruleId].tsx | present | 5773 | 2d3372b7a4d726109665bbe067ac38bf4866f5a4daf3a539c52a322e860dd240 |
| apps/mobile/src/app/conflict/[ruleId].tsx | present | 24700 | 61d0ca03d82d58b972df8bb0f6dd4a5a480f7db6eef75be8f45bbf9abc53038a |
| apps/mobile/src/features/commerce/WhereToBuy.tsx | present | 8380 | 236b8c3c89b38d689ee02f83f18b90638a0ada5b4659edc8235df803d6b30293 |
| scripts/phase7/build-core-loop-qa-packet.mjs | present | 6654 | df22bbe9b970a2567c719d4305fea12964647411ebbd0bbade7f363c93dd0b48 |
| scripts/phase7/check-core-loop.mjs | present | 12382 | aaf2f41ef1826afab4dca88f79d2f70d84f6135b6791cdf4b3c6ccb8a19514cf |
| scripts/phase7/check-core-loop-smoke.mjs | present | 6955 | 667899b5151eb18987a87e13c6d42589a1711f038414f94798eaba70e77ccb14 |
| scripts/phase9/lib.mjs | present | 9767 | d2eeb648cca2cc61457e9796d6f1074081effb8847b2ec37544c3e7df3ce3752 |
| docs/phase-7/surface-inventory.md | present | 7793 | a4b7493dc8ae05e53a214867993ddfd57ce5a3cada59157f253762cb6714e593 |
| docs/phase-7/launch-claim-matrix.md | present | 4282 | c9e79636f0da8a3138eb438f09a172cd873fb7465ad5f6a17030941fe63e8174 |
| docs/phase-7/beta-evidence-dashboard.md | present | 4416 | 21255a254436a75a2765a262ad03a044a29f28ea2adae15a4b833d00871a373e |
| docs/phase-7/core-loop-qa-checklist.md | present | 59069 | 72d4a2ca908b7d626c2de415bb8cd02840e6dc88a4981983f11879e38fa0bcde |
| docs/phase-7/phase-7-exit-review.md | present | 2844 | 9d2195e36d9696484386f9d1abf5d59cd4853eda3ea36136c89a313a86b44fc0 |

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
