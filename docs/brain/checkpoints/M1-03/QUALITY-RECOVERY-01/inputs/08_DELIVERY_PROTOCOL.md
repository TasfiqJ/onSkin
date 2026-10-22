# Stage handoff and immutable evidence

**Repository:** `TasfiqJ/onSkin`. **Branch:** `stage/m1-retained-safety` only; keep PR9 draft/open/unmerged, no M0/PR8/main mutations. **Issued stage HEAD:** `6c9c280669ccce07cab0b57f7b2118ec7bbd3a35`, tree `43ab1a4a7597c8572850b98fdc420080ec834b07`. If this identity changed before work, stop and request new Brain issuance through founder, do not automatically rebase or combine allowances.

- Install this ZIP's Markdown-first issued context under `docs/brain/checkpoints/M1-03/QUALITY-RECOVERY-01/inputs/` byte-identically (excluding only the external prompt file not in ZIP). Install independent `01_BRAIN_AUDIT.md` in an immutable `docs/brain/reviews/M1-03/SC03-REVIEW01/`, together with source authority and external digest proof. No overwrite to older checkpoints/reviews, no mutable acceptance ledger edits.
- Preserve source baseline and raw adverse runs in the checkpoint; use Markdown summary plus minimum strict `completion-report.json`, SHA256-bind test logs/evidence as committed regular Git blobs. If new strict profile disagrees, do not write false PASS; correct only within finite new auth or leave partial.
- At meaningful milestones and ALWAYS session end, safely commit and push stage work, including blocked/partial, preserving intact history; no rebase/reset/force push. Keep a clean working tree when reporting. Stage branch name, measured code SHA/tree, evidence tail and ultimate pushed HEAD/tree, PR9/draft and actual Quality/Security/iOS CI run/job statuses must be explicit. Never substitute earlier green SHA.
- Root `ONSKIN_BRAIN_HANDOFF.txt` should list actual changed dependency versions, test counts and environments, any owner-only ECR/Security/DB blockers, working context health and truthful admission: `protected_source_go=false; main_promotion_authorized=false; spend0; accepted_tasks=M0-01/M0-02/M1-01/M1-02`.
- Context MODERATE/HIGH, compaction, machine faults: checkpoint safely, push only stage, STOP for Brain; no new parallel writer or unbounded retry.

When finished, founder returns `Codex is done` for independent Brain review. Engineer must NOT self-merge or self-accept.
