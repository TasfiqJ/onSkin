# Completion report contract

Keep a readable README.md and ACCEPTANCE_CLOSEOUT.md in docs/brain/checkpoints/M1-02/, and a typed completion-report.json using a minimally extended, tested existing report profile. Markdown is the human entrypoint; JSON is needed for strict machine evidence checks. Do not create a second unguarded approval mechanism.

Required: task M1-02, branch, original accepted base/head/tree, all commits and changed files; decisions/deviations; exact commands/working directory/runtime/exit/counts/skips; measured commit/tree for each execution; raw sanitized output hashes and inventory; actual CI workflow/run/head/event/checkout/status/conclusion; all matrix rows and remaining limitations; rollback; honest context/compaction; actual push/remote result. Origin categories SOURCE_REPORTED, INDEPENDENTLY_OBSERVED, INDEPENDENTLY_REPRODUCED, DECIDED, UNKNOWN remain distinct. Codex execution is Codex-reported, not Brain-reproduced.

Keep source, integration, web surface, physical device, live provider, qualified review, research/clinical, commercial and release separate. Not-run/blocked/skipped/pending cannot be PASS. A passing local JSON validator establishes consistency, not provider authenticity, Brain acceptance or qualified review.

An evidence-only delivery descendant may contain only declared checkpoint artifacts/handoff/state allowed by the issued contract. A later runtime/config/test change requires a new measurement and relevant reruns. Keep historical report bytes/identities; don't re-label them as current. Hash exact committed bytes, including line endings. No report hashes itself.

Use compact new evidence. Reference preserved historical artifacts by exact commit/path/hash; do not duplicate thousands of screenshots or copied harnesses. Every claimed new test must still retain sufficient original safe output and relevant state/failure capture. Never omit failure evidence to shrink the packet.
