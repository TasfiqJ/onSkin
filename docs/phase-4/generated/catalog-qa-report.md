# Catalog QA Report

Generated: 2026-07-13T05:09:10.802Z

Git SHA: 8535dae51ec2191dbd7e0b8a13a1141ccd060f00

Git status: DIRTY

Dirty paths:

```
M BLOCKERS.md
 M LAUNCH_READINESS.md
 M PROGRESS.md
 M apps/mobile/src/lib/auth/accountGeneration.ts
 M apps/mobile/src/lib/query/queryClient.ts
 M docs/hugeToDo/README.md
 M docs/hugeToDo/execution-status.json
 M docs/optimization/IMPLEMENTATION_STATUS.md
 M docs/phase-3/app-review-notes.md
 M scripts/docs/readiness-status-audit.mjs
 M scripts/phase9/edge-function-manifest-smoke.mjs
?? apps/mobile/src/lib/query/queryDateBoundary.ts
?? apps/mobile/src/lib/query/queryDateBoundaryCore.ts
?? apps/mobile/src/lib/query/queryKeys.ts
?? deno.lock
?? docs/hugeToDo/ACCOUNTS_AND_VENDOR_DECISION_PACKET.md
?? docs/hugeToDo/APPLE_REVIEW_FEATURE_ACCEPTANCE_MATRIX.md
?? docs/hugeToDo/FOUNDER_ENROLLMENT_AND_EXTERNAL_GATES_PACKET.md
?? docs/hugeToDo/PAY-01-pricing-and-unit-economics-recommendation-2026-07-13.md
```

Accepted products: 2

Rejected records: 1

Blockers: none

Warnings: Catalog QA report generated with a dirty Git worktree; do not use it as final catalog-source evidence.

Local fixture QA clear: no

Launch clear: no

Launch clear reason: No. This report only validates the local fixture/export output; launch clearance still requires final source identity, ODbL/CosIng legal review, curated batch QA, beta coverage, and reviewer signoff.

## Input Artifact

| Path | Status | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| docs/phase-4/generated/obf-fixture-import.json | present | 1727 | 64878725d78ee24857c55d4e639af00e756069227381abe18fbd59b1af76e585 |

## Source Hashes

| Path | Status | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| package.json | present | 20214 | 379620a811c9a415ffbf8f98ededcff42b7017efc391bc7fa741e8f4ade63d68 |
| docs/hugeToDo/launch-contract.json | present | 2935 | 43bea3c862d7e36c7e8d744b87bcf21f65d721500e71e1f1cfa7492fbb14ee4b |
| scripts/launch/contract.mjs | present | 6676 | 6a3ced1c0e7e54ef7db31e848aeeebd3617a77db02c3b51c98d6ee3789a9007d |
| scripts/phase4/catalog-qa-report.mjs | present | 6961 | 86168235bfe785f680fdbdca89d6640fe2674627a1afdaf27669b0b24d750596 |
| scripts/phase4/build-source-worklist.mjs | present | 19918 | ac896b3cbeeaeb36781c5fc7d6e20c87223e30961f52900e9bbb2e2c6fa7d086 |
| scripts/phase4/beta-coverage-report.mjs | present | 22245 | 708cc87185f72ee9356f73f75ec79c2543744647dae761aa347f55a81c86e4b7 |
| scripts/phase4/beta-coverage-report-smoke.mjs | present | 8339 | 74be5ca44d86da117f80a514ad283212d05a08549cdafb3e2ed6824e6a118105 |
| scripts/phase4/import-obf-snapshot.mjs | present | 4856 | bf5721fac6d5b11e0ca0c99b2b883330af6eb22c66763ed316ebe98b229597bf |
| scripts/phase4/import-cosing-dictionary.mjs | present | 4085 | ca08b1f6a8986c00f9850b6f87ec5de5250a7ad217f28c382674016f3bf0244b |
| scripts/phase4/import-fixture-smoke.mjs | present | 4147 | 8eb18919bddce0af559d49b9290caec377db7ef831ce13e596029d22f51aab5d |
| scripts/phase4/check-source-env.mjs | present | 3481 | dfb219e5ad682a53d99ce03e72cb1e35762c9c92d0081f179f9c8c73118b8e91 |
| scripts/phase4/check-source-env-smoke.mjs | present | 3992 | ae38709e83827c30bfbc2c52b4d4165a0ada5bc1ab36f9cc2a37cdc986f40149 |
| scripts/phase4/catalog-qa-report-smoke.mjs | present | 5504 | 43e8b217e0a8276e0299f2477ddb3b4ab9536521d745514be2a48e68e7bf97a1 |
| supabase/functions/catalog-report/index.ts | present | 4653 | bff289eeca7657c0fa0e65ec686c07903dfa08a36c7a7691150cd28417d4aa36 |
| supabase/functions/catalog-report/privacy.ts | present | 3504 | 9dee03b20211d5b3fcb2e05ad4be85a00112dd00f03fc6e5c834969381f0e44e |
| supabase/functions/catalog-report/privacy.test.ts | present | 4009 | db9b6d1c812679297295c5afb6c8d0226c99f94b8aedefff620111d4fa9d7bac |
| supabase/functions/deno.lock | present | 2282 | 0f8de63ed60182b56865cfa47c666866b631ed4681c79345ec31a720565d1a3a |
| scripts/phase9/lib.mjs | present | 14689 | 6248cbe57cb3a77b3ba8fc36c3a78d4ab18ca363b275c4dbf7735dc3e3f91675 |
| docs/FOR_TAS_TO_DO.md | present | 11191 | a02a5647d2491966a701743128fbacab0dc57bf72f0067b305be98ffd469d56c |
| docs/phase-4/beta-coverage-report.md | present | 2125 | d657465c6bdf76f6084fd361cee5bb96c3ad5f92fecf99f93fc9d1cba8f3999d |
| docs/phase-4/catalog-source-memo-cosing.md | present | 2021 | 49e53a77408706bf3511f991b4050b888cb7f17e6f7d559bd69b4de6808cb534 |
| docs/phase-4/catalog-source-memo-open-beauty-facts.md | present | 2334 | 441e03ded2314f7a9efc2f11e3b7d0daa97256de17e6c654423124c1c4a4670f |
| docs/phase-4/generated/source-worklist.json | present | 47647 | 008595ff9d02084ec0b69a58743ef0cc248350abf6f4529d1d31b085cd02d1b9 |
| docs/phase-4/generated/source-worklist.md | present | 29024 | a864f3eb73e7fedf555d70a7724b88503e3a5af423f3a135aa38895167450ee7 |
| docs/phase-4/odbl-compliance-memo.md | present | 2019 | 0fe9bc07e3c4d34129ac8f8f2ba410a64e6caa0d77a3b7994198e0b4d9e18e69 |
| docs/phase-4/phase-4-exit-review.md | present | 2235 | 1d6760669e7c416ff4cca57995660d67c7b7225fc0f5a40edb88421596f0b5a3 |
