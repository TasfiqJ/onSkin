# Retained user journeys and recovery 02

**SUBMITTED_REVIEW_REQUIRED. Independent Brain review required.**

Authorization: `M1X-RETAINED-USER-JOURNEYS02-CLIENT-01`.
Continue draft PR [#11](https://github.com/TasfiqJ/onSkin/pull/11) on
`stage/m1-retained-resilience`; no main promotion or source acceptance.

Verified input anchor: `21ceb8c9562070f0af067f5ce803265bb527cdf0`, tree
`c3111c5365f4aed248f7672e559f800ffa1e978c`.
Measured source: `40f04d017079b201f8f1b2e93a0de1be722aeedc`, tree
`1fbbf93009417f7868879c79ff2daae2f7f8f5d8`.
Three implementation commits change three production files, add three test files,
and add three missing branches to USER_FLOW_TREE. Later checkpoint and root
handoff commits contain evidence only; their actual hashes are reported after
creation and are not predicted here.

- [Results, reproductions and limitations](RESULTS.md)
- [Commands and adverse attempts](TEST_MATRIX.md)
- [Synthetic browser report](UI_REPORT.md)
- [Exact source blobs and SHA-256](source-scope.json)
- [Commits and file lists](source-commits.json)
- [Unchanged protected objects](protected-objects.json)
- [Structured completion report](completion-report.json)
- [Raw command receipts](receipts/)
- [Screenshots, UI snapshots and action traces](ui/)

Baseline: 1,768 retained tests pass. Ten expected pre-repair failures reproduce
across the three new test files; the final files contain 12 passing cases.
Final retained run: 1,780/1,780 across 145 files. Forced root tests:
6,090/6,090 (6,066 mobile + 24 console); forced typecheck and lint pass with
zero cached tasks. Actual Expo web journeys pass at 375x667 and 390x844;
the actual synthetic cross-owner journey passes at 390x844.

Packet: all 10 members verified; manifest SHA-256
`f680c7a3bcac6489fba284498edfdfbcf26cae71db3a6a1fb966e5cf6b0f4184`.
Integrity grants no Security admission. Original expired G97 remains FAIL /
NO_GO. M1-03 remains BLOCKED_EXTERNAL_CUSTODY / NOT_ACCEPTED;
M2-01 remains NOT_AUTHORIZED. Native, hosted, paid/provider, clinical and
release proof remain unavailable or excluded. Spend $0; no dependency installs,
configuration changes, cleanup of old files/worktrees, production/native build or deployment.

Run `python -B docs/brain/checkpoints/M1-02/RETAINED-USER-JOURNEYS-02/verify_checkpoint.py`
from the repository root to verify the bounded evidence manifest and source scope.
