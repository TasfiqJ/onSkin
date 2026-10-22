# Provider + independent observations at 49a39b7f5b194d5c356a21c690e3f1bdb09edfa1

| Workflow | Run | Status at audit snapshot | Limits |
|---|---|---|---|
| Quality | 39598570423 | **PENDING overall**; repository job119217197054 PASS, PG15/PG17 jobs119217197177/119217197133 PASS, Expo exports119219796749/119219796931 PASS, canonical DB job119217196867 IN_PROGRESS | Do not claim final Quality PASS until canonical job finishes. |
| Security | 39598570047 | **FAILURE** | Secret job119216946629 original 12 tests PASS; Gitleaks red current findings exit2; TruffleHog verified-only exit0; static119216946701 SOURCE_INVENTORY_DRIFT / OSV; code119216946101 red; acceptance119218460472 red; live119216949319 skipped. |
| iOS launch contract | 39598570370 | **SUCCESS, source-only** | Not native device, compiled archive, TestFlight or launch permission. |

PR9 base main `bbc28dc3d1f945191a81be56945b8bda7bb6ef73`, head `49a39b7f5b194d5c356a21c690e3f1bdb09edfa1`, synthetic merge checkout can differ by SHA despite an identical source tree. Refresh all final-head statuses and head/merge Git identities in the next review; never borrow a pass from older head. The current source SNAPSHOT and pending CI are time-scoped, not immutable worldwide states.
