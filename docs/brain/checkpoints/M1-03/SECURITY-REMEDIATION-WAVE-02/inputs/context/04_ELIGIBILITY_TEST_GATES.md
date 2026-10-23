# Immutable eligibility gate for conditional source edit

**Must all pass before stage source edit:**

1. Exact head, tree, clean one-writer checkout and all 27 Git blob/SHA/size/working-byte preimages. Independently recompute the external SHA256 of the source preimage set, not just a read from the packet.
2. Obtain only authentic non-yanked official wheels, verify full contents, package METADATA and installed file identities. Old reviewed original Semgrep wheel/core/engine/rules and full original/assembled package trees reproduce *exactly*. Store raw failure exits.
3. Candidate patch changes only 4 Semgrep 1.181.0 `Requires-Dist` old constraints (and only strictly necessary additional matching constraints if proven), with exact hash/bytes, reversible delta and independent source reference. All installed dist-info files other than METADATA remain unchanged; explicit provenance shows modified package as CUSTOM, not official.
4. Full new wheel-only install verifies pinned hashes; full dependency-aware pip install dry-run is green *and* `pip check` and import/smoke integration are green under same Python ABI/glibc. Version coherence and all optional Semgrep extras relevant to project verified. No irrelevant package/engine/rule drift.
5. Original complete 70 Security technical contracts, 12 original secret fixtures, 8 expiry/adverse tests and new patch negative fixtures pass without deleted/changed old assertions. Original expired policy and unreviewed real findings MUST still refuse. If the original protected unit source check needs a new test helper, you may add only independent new tests, not weaken existing methods.
6. Source tests from isolated fresh npm ci: forced 6,067 root tests and typecheck/lint with zero cached, full ordinary governance 103 including only two legitimate Windows skips, mobile Expo SDK compatibility, strict iOS source privacy and original Phase4 worklist + strict report. For large tests, execute after a source change; read-only diagnostic-only mode can report them NOT_RUN if already authenticated same-source receipts.

**Any failure:** no stage technical patch. Publish safe source-bound evidence and next proposal. Candidate-only under checkpoint is allowed with clear status. Original static/coverage/source admission stays red regardless of green local technical tests. Zero spend, no owner review renewal.
