# Stage branch and one-writer protocol

Fetch remote refs and inspect exact `origin/main`, `origin/stage/m1-retained-safety`, current checkout, ancestry and dirty files before editing. Reuse only the stage branch, preserving current owner checkout and all other worktrees. Main and PR #8 are read-only, PR #9 stays draft/unmerged. Never push or merge `main`, force-push, reset shared history, overwrite dirty founder work or spawn a second writer. A nonmerging draft PR already exists for CI.

**Every session end:** commit and push all *safe authorized* work plus root `ONSKIN_BRAIN_HANDOFF.txt`, including PARTIAL/BLOCKED/CI red; push before stopping on HIGH context. Keep tracked README/strict report/evidence in `docs/brain/checkpoints/M1-03/SECURITY-HARDEN-01/`. Handoff must include base, measured snapshot, exact delivery head, tests/CI, files, blockers, safe resume, honest context health. If push fails, report PUSH_BLOCKED without forcing. The founder will only report “Codex is done.”
