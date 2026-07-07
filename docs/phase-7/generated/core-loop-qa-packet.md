# Generated Phase 7 Core Loop QA Packet

Generated at: 2026-07-07T01:46:55.310Z

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

| Surface           | Required scenario set                                                                          |
| ----------------- | ---------------------------------------------------------------------------------------------- |
| Onboarding        | final age/account/consent copy, policy links, and consent ledger verified                      |
| Shelf intake      | add 3 real owned products via manual/search/scan-or-OCR fallback; source/confidence visible    |
| Reviewed guidance | reviewed conflict shows evidence and sequence guidance; unreviewed conflict stays hidden       |
| Routine builder   | AM/PM routine persists across restart, offline, timezone rollover                              |
| Today check-off   | offline/online check-off is idempotent and undoable                                            |
| Photos            | baseline capture renders locally; app lock gates timeline; cloud backup remains off by default |
| Reminders         | permission, quiet hours, Android 13+ permission, timezone/DST behavior verified                |
| Payments          | RevenueCat purchase, restore, cancellation, expiration, refund, and webhook lifecycle verified |
| Privacy controls  | export, account deletion, health-data withdrawal, app lock, support links verified             |
| Share card        | exact owned reviewed conflict only; no fallback; no sensitive analytics payload                |
| Deferred surfaces | commerce/community posting/trend/cloud Ask/widgets/share hidden unless gates enabled           |
| Analytics         | activation, retention, payment, privacy, support, and deferred-surface events visible          |

## Files

| Path                                                  | Status  | Bytes | SHA-256                                                          |
| ----------------------------------------------------- | ------- | ----- | ---------------------------------------------------------------- |
| apps/mobile/src/lib/launch/phase7.ts                  | present | 4843  | 95ce1ebeaee6e103015528bb190b82bd4c1ce2defb2163815484fa0fdf4aafd7 |
| apps/mobile/src/lib/launch/phase7.test.ts             | present | 6238  | 72e76ea593d1fb753544313ee4a3cef8ebfd66441c59a04550928e4b7c70402a |
| apps/mobile/src/components/launch/DeferredSurface.tsx | present | 1968  | c40d077116101ea43a532306a91e731a3b123fe72cd0300574c84aba71ec74c1 |
| apps/mobile/src/app/(tabs)/today.tsx                  | present | 23166 | defaa349d78302d55ba238003deb3e0de96955822344aff6c9269cc95404f83f |
| apps/mobile/src/app/(tabs)/progress.tsx               | present | 20591 | 3075e77c30545b3c9adc40f8427d4b31456b77342e3c6a4bceb0d0d805715748 |
| apps/mobile/src/app/(tabs)/you.tsx                    | present | 22032 | 9a03a5e4092c5c0e136be524f48c43fb3b46e200469886361e8e71ae50df71d1 |
| apps/mobile/src/app/share/conflict/[ruleId].tsx       | present | 4636  | 8876a0cf56ea71c145786a7f1f4a7ad86105f80057ae3cb8b62eb729114ff8bb |
| apps/mobile/src/app/conflict/[ruleId].tsx             | present | 21906 | e925404c8d566d0f516b724a4d70d8dc7370a29f19aca936daca27e7b369b7ac |
| apps/mobile/src/features/commerce/WhereToBuy.tsx      | present | 7673  | 5b1f5216efc5ec76c6554dda4b8cf253fb47d51ac7910eb4e8dca131627ab0dc |
| docs/phase-7/surface-inventory.md                     | present | 7793  | ae733b1a87a8cf785ee9fc0fb0bfabf5b2ad6515c064320d89d6c4a58dd956ae |
| docs/phase-7/launch-claim-matrix.md                   | present | 3069  | 52d9d1f1f368fab32c4664f6e04b8c360aef035f2550d88de2722937286a4597 |
| docs/phase-7/beta-evidence-dashboard.md               | present | 4152  | 36b614fcdb943ba9126ada582298a7a9d7f524e0ea85444d9e163086c14d4297 |
| docs/phase-7/core-loop-qa-checklist.md                | present | 3426  | 2a69c08f6650713b9a64480c4ef3fd6383df0f7d402b2df89f88fa823a15fba6 |
| docs/phase-7/phase-7-exit-review.md                   | present | 2670  | a18a08606b4c7130fe149594d126de66739af77ea5728d95ec82a5cf5f7896c5 |

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
