# Campaign26 review return

**SUBMITTED_REVIEW_REQUIRED / NO_GO.** This artifacts branch is a review return. Actual source is [draft PR30](https://github.com/TasfiqJ/onSkin/pull/30), head8c02a02afd7f2e9775dcc512c800d4f71f733234, treeff0f76d11fa7775e27732f54ce7fdfbd51c8c676. No merge, source acceptance or release promotion.

- [Download the single ZIP (11,324,492 bytes)](https://raw.githubusercontent.com/TasfiqJ/onSkin/91e641cbf5d6ec73015445905e4027480ae4caf7/onSkin_Campaign26_First_Value_Recovery_And_CI_Return_2026-10-29.zip)
- [Complete external report](FINAL_REPORT_EXTERNAL26.md)
- [External anchors](EXTERNAL_ANCHORS26.json) and [actual publication/download receipt](PUBLICATION_RECEIPT26.json)
- [Standalone verifier](https://raw.githubusercontent.com/TasfiqJ/onSkin/91e641cbf5d6ec73015445905e4027480ae4caf7/verify_return26.py) and [outer manifest](https://raw.githubusercontent.com/TasfiqJ/onSkin/91e641cbf5d6ec73015445905e4027480ae4caf7/manifest.json)

ZIP SHA256:9f6c775c24ee4f6f5ac6da5a9422bd629ec624fa05ccbcf93e84b7cf644d9c7a

Outer manifest SHA256:b7a6c2ffb8f4aad827dc147ee16388b3a60760bdfb79a16077f32ffa733e5004

Verifier SHA256:2b24bf81d7d3dac652cc3cdee3ebed74f5ef9fcf3830ff1240c1da50cab17fc1

The immutable ZIP has145 exact outer members and269 checkpoint payload members. Its actual one-byte corruption/refusal/restoration control completed0/1/0; first refusalZIP_READ_INVALID. Source and checkpoint bytes are unchanged after the single source evidence tail; this external annex records later facts without rewriting the ZIP or introducing circular hashes.

Two fresh independent source clones executed full source/checkpoint and unchanged strict Phase4 before and after actual protected-source0/1/0; each completed a checkpoint-copy artifact0/1/0 and restored clean. Independent fresh HTTP retrieval authenticated all three published file hashes before running the downloaded verifier: VERIFIED145/269, artifact-only. A separate actual downloaded ZIP passed full Git raw-source/checkpoint verification, the exact70-object delta requiring PR29, and all changed-path/mode/blob/hash history. That outer invocation did not repeat source tests; actual source executions are independently recorded in the two clone receipts.

Final Quality6 and launch jobs passed, including canonical credential-free database reset/tests/lint/drift, PG15/17 and both unsigned Expo exports. Linux historical replay passed; Windows historical replay remains OPEN_REQUIRED after two exactR26_REPLAY_CHANGED first refusals. Both current-source checks passed. Actual public Security readiness remains false/nonzero, and all qualified gates remain closed. Original core05 and the stronger post-dispatch cancellation proposal remain open/unapplied.

Authenticate downloaded verifier bytes before execution:

```text
python -I -B verify_return26.py --archive onSkin_Campaign26_First_Value_Recovery_And_CI_Return_2026-10-29.zip --expected-manifest-sha256 b7a6c2ffb8f4aad827dc147ee16388b3a60760bdfb79a16077f32ffa733e5004 --expected-verifier-sha256 2b24bf81d7d3dac652cc3cdee3ebed74f5ef9fcf3830ff1240c1da50cab17fc1
```

With a complete exact final-source checkout, append --git-root, --expected-head and --expected-tree for full Git/source-byte/bundle/history semantics; append --execute-source-checks to run source governance and unchanged strict Phase4. The ZIP includes the exact source-only reproduction commands and all input qualifications. Verification never grants source, Security or release acceptance.
