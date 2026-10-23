# Delivery

Normally commit safe dependency + mapping work to existing `stage/m1-gate-recovery` with one or more normal commits. Then bind the clean measured source SHA/tree, run the canonical worklist producer and checkpoint publisher. Push the same stage branch only; PR #10 stays draft/open/unmerged; `main` is read-only. Do not rebase/reset/force-push, merge, enable auto-merge or mark PR ready.

Create new files only under `docs/brain/checkpoints/M1-03/SECURITY-VITEST-PATCH-01/`, including a byte-for-byte copy of this verified input, `README.md`, `RESULTS.md`, `BLOCKERS.md`, strict `completion-report.json`, checksum manifest and sanitized exact-head CI/test receipts. `ONSKIN_BRAIN_HANDOFF.txt` must truthfully summarize the actual final task. All artifacts must be committed normal Git blobs, with measured source separated from evidence-only tail; do not self-hash a future commit.

Stop for independent Brain acceptance. Return exact pushed stage SHA/tree, implementation SHA/tree, manifest/lock delta, tests, real advisories and failed gates, Quality/Security/iOS CI statuses, $0 and context health. User relays only `Codex is done`.
