# Stage protocol and stopping conditions

Branch `stage/m1-gate-recovery` was created by Brain at `d9912f4c8b30358593569c5b9b4e84773c6f463e`; it has no prior work. Reconfirm live stage and main heads equal the issued SHA before making any changes. Only this branch is writable and only these paths may change:

- Existing `ONSKIN_BRAIN_HANDOFF.txt` (truthful concise index only).
- New paths strictly inside `docs/brain/checkpoints/M1-03/POSTMERGE-GATE-TRIAGE-01/**` for this exact input and report/evidence.

All other existing paths are read-only, including `AGENTS.md`, `.github/**`, `supabase/**`, `scripts/phase9/security_acceptance/**`, the original G97 proposal/manifest/expiry/exception rules, `scripts/phase2/**`, package manifests/lock, previous Brain accepted records, app implementation, protected native payloads, clinical, all original tests and history. Never change `main`, `stage/m1-retained-safety`, PR #9, or frozen reviews. No force push, rebase, stash/reset over others, branch repointing or new writer. Scratch-only candidates may mutate a separate disposable clone but cannot be merged/applied to this stage.

Write a report with `status=PARTIAL_DIAGNOSTIC` or `BLOCKED`, `admission=NONE`, accepted tasks only M0-01/M0-02/M1-01/M1-02, source Security GO false, database GO false, main promotion false, release false, M2 false, spend 0. Source tests that fail must remain visibly red. Bind all checkpoint artifacts to hashes of real regular Git blobs, except self-referential report/manifest. Record measured source versus evidence-only tail.

Normally commit and push safe checkpoint + root handoff to `stage/m1-gate-recovery`. Observe exact final head and its actual CI if triggered; pending stays pending. Stop. Founder relays `Codex is done` and the safe summary, not a permission to continue implementing protected fixes.

Stop immediately on wrong branch/head/tree, missing or mismatched protected preimage, credentials/patient data, need to alter original Security/DB/workflow gates, paid action, history fabrication, evidence substitution or new repo writer. If a genuine source correction requires a protected edit, include candidate patch but **do not apply** it.
