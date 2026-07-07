# Generated Phase 7 Core Loop QA Packet

Generated at: 2026-07-07T23:27:56.700Z

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
| apps/mobile/src/lib/launch/phase7.ts | present | 4930 | 70d4d223b9ffddfa750ffeebabff17739b4606035308aade52bf4fb438c46822 |
| apps/mobile/src/lib/launch/phase7.test.ts | present | 7117 | ffc5ad7730766e6ba9aa6f7ac7de5ad088d292aaa44172084524e9d1afb65c68 |
| apps/mobile/src/components/launch/DeferredSurface.tsx | present | 2028 | 235a3fcdab2164c06c8677417a2ab5756779e0a53d1dd8b0d7485e6eba619f87 |
| apps/mobile/src/app/(tabs)/today.tsx | present | 23758 | 7bd8818436e71dbc43a9563fa8b70111942f21361f802ed6fdb49b2cfe2cf94f |
| apps/mobile/src/app/(tabs)/progress.tsx | present | 20944 | 3a3401efab9805ab97c8c9061ad8c7dd6dff653667ff26644b1588d6c5a305c7 |
| apps/mobile/src/app/(tabs)/you.tsx | present | 24490 | b8cd5f3aaf3a41f1d611addd929607d77226da389de3ff6bbd4c687715891eb8 |
| apps/mobile/src/app/share/conflict/[ruleId].tsx | present | 4710 | 096fa24edb685bb08d08a4868fedef42a0b3b208e375335d8d96a094717a7cf7 |
| apps/mobile/src/app/conflict/[ruleId].tsx | present | 23984 | f6f49dc7fca334174efd23bbcfc0107a9195c82a65d5e87b3ca5c3b91e66d1d2 |
| apps/mobile/src/features/commerce/WhereToBuy.tsx | present | 7811 | 36f4fd40476fa553dde281bbbd42a560b5c4fe35a86483837bee23e9092ebe3c |
| docs/phase-7/surface-inventory.md | present | 7793 | ae733b1a87a8cf785ee9fc0fb0bfabf5b2ad6515c064320d89d6c4a58dd956ae |
| docs/phase-7/launch-claim-matrix.md | present | 3069 | 52d9d1f1f368fab32c4664f6e04b8c360aef035f2550d88de2722937286a4597 |
| docs/phase-7/beta-evidence-dashboard.md | present | 4164 | 1bb706d9cdab272dc302acf7c8e70141ffa16675f5e4d6ea3edad118575588ab |
| docs/phase-7/core-loop-qa-checklist.md | present | 29852 | ecf89c483880b81aa503712e6ef746e89e8cc17f1b5b2f434ff8815bf7a3ae71 |
| docs/phase-7/phase-7-exit-review.md | present | 2670 | a18a08606b4c7130fe149594d126de66739af77ea5728d95ec82a5cf5f7896c5 |

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
