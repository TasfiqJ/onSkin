# Finite acceptance matrix — engineering scope only

| ID | Required evidence | What must NOT be inferred |
|---|---|---|
| Q1 | Exact fixed PR9/stage base, tree, preimage SHA256 & Git blob verified, old source check disjoint | Prior allowances or dirty workspace = permission |
| Q2 | Minimal compatible Expo SDK57 patch and regenerated deterministic npm lock; official Expo dependency compatibility PASS | A guessed version, disabled check or newer major = compatible |
| Q3 | `npm ci` in fresh isolation, forced 6,067+ root tests, typecheck/lint, SDK source contract and Expo Doctor source checks PASS; no cached test substitutions | Unit tests = hosted/native/physical device readiness |
| Q4 | Prior complete 71-case governance negatives retained, genuine platform skips only; old SC03 fixed interval, new refusal tests for falsified authority and out-of-scope source | Synthetic acceptance or refusal test removal |
| Q5 | Root worklist and exact strict source/report receipts valid; all declared artifacts committed, SHA256 verified against actual Git blob; preserve original failed runs | A file in the working tree = committed evidence |
| Q6 | Original final-code CI Quality, Security, iOS observed with exact run/job SHA/tree/status; Expo failure genuinely repaired or explicit source BLOCKED; ECR quota separately reflected | Old code green or iOS source contract = Quality/security release green |
| Q7 | Immutable checkpoint/root handoff, clean worktree, normal safe push on stage; one writer, no main merge; all protected boundaries unchanged | Scoped engineering fix = M1-03/M2/DB/Security source admission |

If Q1–Q5 source-side conditions pass but ECR external quota or original Security remain red, the correctly scoped outcome is **QUALITY_SOURCE_REPAIR_READY_EXTERNAL_GATES_BLOCKED**, not an all-green claim. If dependency versions cannot be legitimately resolved or a required change is outside the allowlist, use **PARTIAL_SAFE_BLOCKED** and preserve existing work.
