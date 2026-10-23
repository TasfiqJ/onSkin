# 06 — exact local checkout and continuation authority

## The failure and the independent remedy

The earlier package passed its external manifest verification. Codex then correctly stopped with `INVALID_ISSUANCE_PREIMAGE_MISMATCH` / `STALE_LOCAL_CHECKOUT`: the local folder `C:\Users\jasim\Documents\ChatGPT\MasterV2Code\postmerge-gate-triage01-stage` was at `d2ce5e95cd24edb2ab4d833dee945bdbc59da9fe`, tree `604976823a08700009f8129273f3d0c3d7e34104`. It did not have the required `4f6a2d2c` Git object. That folder was clean and is preserved unchanged.

Brain independently created a **separate** no-hardlink checkout at:

`C:\Users\jasim\Documents\ChatGPT\MasterV2Code\onSkin_M103_COVERAGE_TRIAGE01_EXACT_4f6a2d2`

and verified:
- branch `stage/m1-gate-recovery` and exact HEAD `4f6a2d2c84a06ba9b794967fb76a5f9b6fc994fe`;
- exact tree `791580347993487bd3920727ee7b0e31668eed4e`;
- `git status --porcelain=v1` empty;
- full 20 required committed Git blobs and working source bytes identical, witness-set fingerprint `4954012441f89c16902e8de3a55ef75403034bfaa23da413cacb614d3a79113c`;
- `.git/objects/info/alternates` absent and remote `https://github.com/TasfiqJ/onSkin.git`;
- GitHub stage at the same commit, main `d9912f4c8b30358593569c5b9b4e84773c6f463e`, PR #10 draft/open/unmerged.

Creation was a clone into a **new** folder, independent remote fetch and a fast-forward *inside that new clone*. No source files, original local worktrees, GitHub refs, protected policies, Security gates or original task scopes were changed.

## Non-optional preflight for Codex

1. Use **only** the above `NEW_CHECKOUT` as the source repository. Never run `git reset`, `git rebase`, force push, checkout an older source or overwrite the OLD_CHECKOUT. Do not fall back to any automatically selected remembered workspace.
2. Independently `git -C <new checkout> rev-parse HEAD`, `HEAD^{tree}`, `branch --show-current`, `status --porcelain=v1`, and `remote get-url origin`. Verify the exact SHA, tree, branch, empty dirty status and official GitHub origin. Verify GitHub stage, main and PR #10 remotely. If *any* mismatch: STOP, no new scope and no alternate checkout guesses.
3. Re-read `PREIMAGE_WITNESSES.json` and verify ALL 20 exact original bytes, Git blob object IDs and SHA-256 against the fresh worktree and issued Git commit. Independently compute the same fingerprint, do not trust a local report or preflight assertion.
4. Once that preflight passes, resume ONLY the originally issued read-only Security/source-coverage diagnosis from `02_TASK.md`. Stage edits remain limited to truthful `ONSKIN_BRAIN_HANDOFF.txt` and new `docs/brain/checkpoints/M1-03/SECURITY-SOURCE-COVERAGE-TRIAGE-01/**` files. DO NOT edit original protected source, scanner, policy, fixtures, manifests, expiry, packages/lock, workflows, database, M2 or main.
5. Retain original false gates and cost $0. Evidence produced at the new stage evidence-tail SHA must be labeled separately from the measured source SHA and actual GitHub workflow conclusions.

## What is NOT being reauthorized

No original Security source GO, owner/credential authority, registry login, ECR pull, SAST denominator waiver, scanner skipping, hosted DB replay, protected release, M2/clinical or source promotion. The previous stop was valid; it is not an engineering regression and does not authorize edits under an obsolete issuance.
