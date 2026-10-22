# M1-03 / QUALITY-RECOVERY-02 R1

PARTIAL SAFE SOURCE PATCHES — SUBMITTED_REVIEW_REQUIRED. Admission NONE. Whole M1-03 is not accepted.

The four authorized SDK57 patches are installed and proven against real official npm artifacts. The ten upstream widget inputs are byte-identical to the reviewed originals; all eleven existing native payloads and all installer guards/descriptors remain unchanged. All four mapped native lock entries and ten installed source pins match their original witnesses. Only the three whole-lock digest fields were rebound. Strict canonical privacy audit is green at `source_candidate` / `archive_required`.

Full SDK compatibility remains BLOCKED: the live installed Expo checker additionally requires `expo-notifications ~57.0.24`, while this grant permits only the four named patches. Notifications remains 57.0.23. Expo check exits1; independently pinned Expo Doctor1.21.5 is20/21, exit1. No exclusion, override, broad install, or fifth dependency edit was made.

Functional implementation `3966b4cf6e68b6ef23fb1d23c720b797bd997998` / tree `8bf043037b8cd30c6346c6933d7b3c4fb83c3ccd`. Measured source `dcfb51b107019f31f2be96d099e424991c8fbb34` / tree `5169c4895bb6e17ec26b4f04d7ee7881328c87fd`. Later commits are checkpoint/root-handoff evidence only; `completion-report.json` uses the live stage delivery ref. The clean canonical worklist repair is retained separately from the first dirty diagnostic generation.

[RESULTS](RESULTS.md), [BLOCKERS](BLOCKERS.md), [strict report](completion-report.json), [independent blob checksums](SHA256SUMS.json), and [hash-only Security owner packet](evidence/security-owner-discrepancy.json) preserve all real outcomes. Precommit diagnostics are explicitly labeled; exact measured executions use `final-*` receipts. Raw local technical-test exits and sanitized logs are bound by SHA256. Full source/scanner secrets, credentials and patient data are absent.

Measured-head CI: Quality39801428343 FAILURE (source Expo compatibility and canonical ECR quota); Security39801427756 FAILURE; iOS39801427684 workflow SUCCESS source-only. The iOS jobs-list snapshot still reported in-progress; that inconsistency is retained rather than inferring a completed job. Final delivery CI must be queried at the later pushed head and never borrowed from this source observation.

Reproduce from this branch with npm11.20.0, Node24.19.0, Python3.12.3: fresh `npm ci --no-audit --no-fund`; `npm test -- --force`; `npm run typecheck -- --force`; `npm run lint -- --force`; original widget/extension/privacy/store scripts; original secret and Security unittest discovery; full `python3 -B -m unittest discover -s scripts/brain -p 'test_*.py' -v`; `npm run phase4:source-worklist:check`; and `python3 -B scripts/brain/brain.py --profile M1-03 report docs/brain/checkpoints/M1-03/QUALITY-RECOVERY-02/completion-report.json`. Exact argv, working directory, source SHA/tree and process exits are in receipts. Doctor's official tarball/SRI and executable hash are pinned in evidence.

PR9 stays draft/open/unmerged. Main remains `bbc28dc3d1f945191a81be56945b8bda7bb6ef73`. Source GO, main promotion and hosted replay remain false. No clinical/provider/release/device/signing work or M2 was authorized. Incremental spend $0. Context MODERATE; no observed compaction. Stop for independent Brain review.
