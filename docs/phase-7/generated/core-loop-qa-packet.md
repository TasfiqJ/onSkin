# Generated Phase 7 Core Loop QA Packet

Generated at: 2026-07-08T08:44:18.819Z

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
| Today check-off | offline/online check-off is idempotent and undoable |
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
| package.json | present | 10935 | c8ebb02c4dd1e0031017d04803d50617975b9023f60f4a37b33daf01150f9f19 |
| apps/mobile/src/lib/launch/phase7.ts | present | 4930 | 70d4d223b9ffddfa750ffeebabff17739b4606035308aade52bf4fb438c46822 |
| apps/mobile/src/lib/launch/phase7.test.ts | present | 7117 | ffc5ad7730766e6ba9aa6f7ac7de5ad088d292aaa44172084524e9d1afb65c68 |
| apps/mobile/src/components/launch/DeferredSurface.tsx | present | 2028 | 235a3fcdab2164c06c8677417a2ab5756779e0a53d1dd8b0d7485e6eba619f87 |
| apps/mobile/src/app/(tabs)/today.tsx | present | 26536 | f9292c22a4a130c32710dbfafc4664d07e2fe2c7e38eac044a1ece8072a5a0df |
| apps/mobile/src/app/(tabs)/progress.tsx | present | 21448 | 82b0eccb5a1bc8ad5bbdd7cb6de9a7a26b0406148f876a280b32468883f2ebcc |
| apps/mobile/src/app/(tabs)/you.tsx | present | 26897 | 5cd4c2b18874b1de7f1da4dde1d8a9944b8e9d948797b04f21ce86b0dfd34db6 |
| apps/mobile/src/app/share/conflict/[ruleId].tsx | present | 4710 | 096fa24edb685bb08d08a4868fedef42a0b3b208e375335d8d96a094717a7cf7 |
| apps/mobile/src/app/conflict/[ruleId].tsx | present | 24700 | 61d0ca03d82d58b972df8bb0f6dd4a5a480f7db6eef75be8f45bbf9abc53038a |
| apps/mobile/src/features/commerce/WhereToBuy.tsx | present | 8380 | 236b8c3c89b38d689ee02f83f18b90638a0ada5b4659edc8235df803d6b30293 |
| scripts/phase7/build-core-loop-qa-packet.mjs | present | 6651 | 0b37ca988802fd3ff21bd031c36f87348f569e5f181e4599339de644bc5d7aef |
| scripts/phase7/check-core-loop.mjs | present | 12093 | b7447a14bb15dc30489c98f535552351ea6d081b60594db632fea150b165548a |
| scripts/phase7/check-core-loop-smoke.mjs | present | 6955 | 667899b5151eb18987a87e13c6d42589a1711f038414f94798eaba70e77ccb14 |
| scripts/phase9/lib.mjs | present | 9767 | d2eeb648cca2cc61457e9796d6f1074081effb8847b2ec37544c3e7df3ce3752 |
| docs/phase-7/surface-inventory.md | present | 7793 | ae733b1a87a8cf785ee9fc0fb0bfabf5b2ad6515c064320d89d6c4a58dd956ae |
| docs/phase-7/launch-claim-matrix.md | present | 3069 | 52d9d1f1f368fab32c4664f6e04b8c360aef035f2550d88de2722937286a4597 |
| docs/phase-7/beta-evidence-dashboard.md | present | 4164 | 1bb706d9cdab272dc302acf7c8e70141ffa16675f5e4d6ea3edad118575588ab |
| docs/phase-7/core-loop-qa-checklist.md | present | 56746 | dd2438f05eae911ca6bd60394ae10752cd13d70017b16cd48f2317b948fb7a80 |
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
