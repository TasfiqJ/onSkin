# Generated Phase 7 Core Loop QA Packet

Generated at: 2026-07-04T07:32:58.043Z

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
| apps/mobile/src/lib/launch/phase7.ts | present | 4145 | 01ae9a9f2ccd610118709fb4d46f6347a8a8806e06c355d31c894f2f193fb0b3 |
| apps/mobile/src/components/launch/DeferredSurface.tsx | present | 1530 | afa27876271501fcdbf9a672100f6e04cf8e752fbd368d23db36ef4084271eef |
| apps/mobile/src/app/(tabs)/today.tsx | present | 18953 | 5cb8617fb8cea9eb3807d3cf68434aa8af5a8d5b7e1bd33202b037ce31784da1 |
| apps/mobile/src/app/(tabs)/progress.tsx | present | 19987 | f27413da73d46cb004f2060fb7570276d7489f0ddc91a250fa52d9d6e6acc1f8 |
| apps/mobile/src/app/(tabs)/you.tsx | present | 17646 | f53f0a272ca7ab5e4af017224f78e94c43bf13f8dedba90f4b29370ccbbb1dc5 |
| apps/mobile/src/app/share/conflict/[ruleId].tsx | present | 2892 | 93eb42c4c007b226b0b856b3fa49ab1f28716676a758fa6366dc53cfe2966642 |
| apps/mobile/src/app/conflict/[ruleId].tsx | present | 18181 | 4e6986a005bd707492a01034398579456274320e883f0cbb648e2409944b0cc1 |
| apps/mobile/src/features/commerce/WhereToBuy.tsx | present | 6272 | 7cb5f34e34ea7c1ca5427ffb2fa88d13298080fed74435efb2f8022f68d2b726 |
| docs/phase-7/surface-inventory.md | present | 4829 | 318cbc94312fc850313a887930b4292b30004d0892b62c8caee2315a1909a3a3 |
| docs/phase-7/launch-claim-matrix.md | present | 3069 | 52d9d1f1f368fab32c4664f6e04b8c360aef035f2550d88de2722937286a4597 |
| docs/phase-7/beta-evidence-dashboard.md | present | 2688 | c9338462e2570a4b8da10341d2d94e2f0dabf8591e3c1176849f8a8d874f3da8 |
| docs/phase-7/core-loop-qa-checklist.md | present | 3036 | 1892307113c2723102bd6597ac13ca659ec81d8eaabce311a003c995c841c6df |
| docs/phase-7/phase-7-exit-review.md | present | 2339 | f738d222d1a6f9921ea8456276e8e5352858a7363ec2bda8be55103a5471380a |

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
