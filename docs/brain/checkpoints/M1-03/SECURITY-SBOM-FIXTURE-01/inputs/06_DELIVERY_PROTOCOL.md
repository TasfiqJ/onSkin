# Stage-only delivery, independent Brain acceptance

Write under `docs/brain/checkpoints/M1-03/SECURITY-SBOM-FIXTURE-01/`: `README.md`, `RESULTS.md`, `BLOCKERS.md`, `completion-report.json`, `SHA256SUMS.json` or equivalent exact object manifest, sanitized `evidence/**`, and an immutable copy of every issued input under `inputs/**`. The checkpoint must document positive/negative tests and honest original provider failures; leave prior `POSTMERGE-GATE-TRIAGE-01` files untouched. Update root `ONSKIN_BRAIN_HANDOFF.txt` with current status, code/measured source SHA/tree, final stage SHA/tree from live ref, draft PR URL (if created), exact CI status, and limitations. Commit and push via normal non-force Git operation to existing stage only. No rebase/reset/cherry-pick into main, no release or M2.

The external manifest digest, exact preimages and postimage are admission prerequisites for Codex execution—not evidence of original Security approval. Use the packet's own source-bound diff verifier/receipts; if it conflicts with any existing frozen validator, record BLOCKED instead of editing protected files. The first future task likely concerns the authentic original provider advisory/coverage gap and separately the ECR custodian; neither is permitted by this issuance.

STOP with `SUBMITTED_REVIEW_REQUIRED` and await Brain audit. Founder returns to Brain with `Codex is done`.
