# Quality worklist recovery and retained reliability 03

**PARTIAL_BLOCKED. Client candidate SUBMITTED_REVIEW_REQUIRED. Independent Brain review required.**

Authorization: `M1X-QUALITY-WORKLIST-AND-RETAINED03-CANDIDATE-01`.
Existing draft PR [11](https://github.com/TasfiqJ/onSkin/pull/11),
`stage/m1-retained-resilience`, remains open and unmerged against main.

Verified starting anchor: `704d3df5e01cd55023d9c08518ce2df8512e72ca`, tree
`b81d14b6749b6e685baffc33f4cdc1907ea67baa`.
Measured source, including authentic worklist outputs:
`4d8ef8a029375512ddb29df402f4b77ca557be39`, tree
`3e17c9b79b6603a4584cab0c200f4d9211951c58`.
The descendant checkpoint/handoff commit contains evidence only. Its actual
identity and final-head CI are read after push and reported in PR11 and delivery;
no future self-hash is asserted here.

- [Results and exact reproductions](RESULTS.md)
- [Commands, counts, exits and failed attempts](TEST_MATRIX.md)
- [Synthetic browser evidence and limits](UI_REPORT.md)
- [CI diagnosis and open custody](CI_AND_BLOCKERS.md)
- [Seven source paths: Git blobs, SHA-256, sizes and protected objects](source-scope.json)
- [Four measured commits and path lists](source-commits.json)
- [20,951 baseline file SHA-256 comparisons](final-working-byte-comparison.json)
- [Structured completion report](completion-report.json)
- [Evidence/handoff byte and Git-blob manifest](evidence-manifest.json)

The unchanged original worklist producer now passes with all authentic inputs.
Disposable input tampering still refuses. Two real retained failures are repaired:
late preference reads after saved scheduling refusal, and offline local photo
query/capture dispatch. Eleven new checks pass; the identical overlay has eight
expected failures and three safeguards passing on original production source.
Eight retained families pass 2,029 tests; forced root tests pass 6,101 tests.
Clean-source forced typecheck/lint and strict worklist pass.

Actual synthetic Expo web passes at 375x667 and 390x844; A-to-B recovery passes at
390x844 with zero observed content leaks. Paid diary gates stay closed. Positive
photo dispatch is source/controlled-storage evidence, not paid/native evidence.

Original Security remains FAIL/NO_GO and M1-03 remains
BLOCKED_EXTERNAL_CUSTODY/NOT_ACCEPTED. The separate canonical registry/SQL gate
has no success evidence here. No main promotion, M2, DB, clinical, device,
provider or release approval. Incremental spend USD 0.

From the repository root after commit:
`python -B docs/brain/checkpoints/M1-02/QUALITY-RETAINED-RECOVERY-03/verify_checkpoint.py`

The evidence manifest excludes itself to avoid self-reference. Raw receipts are
preserved byte-for-byte under existing M1-02 Git attributes, including nonzero
exits, warnings and whitespace. No policy or test gate was weakened.
