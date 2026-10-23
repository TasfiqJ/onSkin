**Evidence delivery for independent Brain review. Stage technical changes: zero; Security NO GO.**

Measured source/test snapshot: `05dc51d6c945d31c66b921ae99dee603de464cdc`, tree `fc579c91528aa285f28f6364d7f4da8ee2aafd3b`. Original and patched-family scanner trees are measured in isolated no-hardlink Linux clones. Every dependency-aware candidate resolver exits 1, so both protected technical source files remain unchanged.

| Check | Actual exit | Measured count |
| --- | ---: | --- |
| docker-checks/expiry8 | 0 | 8 |
| docker-checks/governance103 | 0 | 103 |
| docker-checks/ios-source-check | 0 | See receipt |
| docker-checks/ios-source-tests | 0 | 77 |
| docker-checks/mobile-expo | 0 | See receipt |
| docker-checks/npm-ci | 0 | See receipt |
| docker-checks/npm-initial | 1 | See receipt |
| docker-checks/npm-installed | 1 | See receipt |
| docker-checks/npm-lock | 1 | See receipt |
| docker-checks/npm-tool | 0 | See receipt |
| docker-checks/root-lint | 126 | See receipt |
| docker-checks/root-test | 126 | See receipt |
| docker-checks/root-typecheck | 126 | See receipt |
| docker-checks/secret12 | 0 | 12 |
| docker-checks/security70 | 0 | 70 |
| docker-checks/strict-original-report | 1 | See receipt |
| docker-checks/worklist-check | 0 | See receipt |
| docker-forced-rerun/root-lint | 126 | See receipt |
| docker-forced-rerun/root-test | 126 | See receipt |
| docker-forced-rerun/root-typecheck | 126 | See receipt |
| docker-overlay-checks/npm-ci | 0 | See receipt |
| docker-overlay-checks/root-lint | 0 | See receipt |
| docker-overlay-checks/root-test | 0 | 24 + 6043 |
| docker-overlay-checks/root-typecheck | 0 | See receipt |
| docker-reviewed-final/npm-ci | 0 | See receipt |
| docker-reviewed-final/root-lint | 0 | See receipt |
| docker-reviewed-final/root-test | 0 | 24 + 6043 |
| docker-reviewed-final/root-typecheck | 0 | See receipt |
| local-checks/mobile-expo-correct-workspace | 0 | See receipt |
| local-checks/scope-adverse | 0 | 8 |
| local-checks/strict-gf01-report | 1 | See receipt |

Raw nonzero exits stay nonzero. Original tmpfs root commands returned126 before execution because of noexec; a rejected remount did not fix it. Final docker-reviewed-final checks use a fresh no-hardlink executable clone, fresh npm ci and original forced commands. Turbo child npm was11.17.0 in the first overlay run; the final run places byte-verified11.20.0 on child PATH and repeats the checks. Strict report/profile refusals do not admit this task. Mobile Expo passes in its correct workspace. Worklist check passes on clean measured Linux source; an earlier dirty Windows invocation refused and is not substituted for that check.

Measured engineering progress: 13 changed/new family wheels independently verified; original upstream/assembled identities reproduced; three candidate trees and family-only file deltas measured; 20,407 base paths classified; all 189 historical failed targets and 368 fixpoint locations bound to current blobs; original provider current/history secret artifacts safely partitioned; one real installed npm candidate rejected because its vulnerability remains.

Actual vulnerability reduction on stage is **zero**. Official advisory controls detect both old vulnerable Python versions and return no advisory for the proposed fixed versions, but incompatible dependency metadata prevents applying that candidate. No original SAST or provider source Security GO is claimed.

Latest committed CI observations are in `evidence/delivery-ci.json` when present; otherwise `evidence/baseline-ci.json` is explicitly the issuance base. Read the final delivery SHA from GitHub after the final push. Prior/head or PR merge-tree observations are never borrowed as final-head success.

Only the new checkpoint and factual root handoff may change. Preserve main, PR draft/open/unmerged, all source preimages, expired policy/owner pins and the accepted-task set. Spend $0. STOP for independent Brain review.
