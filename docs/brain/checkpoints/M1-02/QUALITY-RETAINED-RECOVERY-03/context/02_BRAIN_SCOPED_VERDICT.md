# Independent Brain audit — scoped acceptance, not main promotion

Brain reviewed PR11's M1X-RETAINED-USER-JOURNEYS02 iteration between the prior handoff and final head:

- Seven new changed source/test/document paths (three production files, three new test files, USER_FLOW_TREE.md), all authorized; evidence-only tail changed only this new checkpoint and root handoff.
- Independently verified complete Git lineage, regular Git blob identities and SHA-256 pre/post witnesses, 417 committed evidence-file hashes, and untouched protected source.
- In a separate clean source worktree, 12/12 new tests passed at `40f04d...`.
- In a separate `21ceb8c...` anchored baseline worktree with only the new tests overlaid, all 12 failed (including the additional two adverse tests, rather than importing Codex's earlier 10-failure staged count).
- Independent retained seven-family test run: 1,780/1,780 PASS across 145 files at measured source.
- Independent forced typecheck: exit 0, zero cache. Independent forced lint: exit 0, zero cache.
- Codex recorded 6,090 forced repository tests and actual synthetic Expo web UI at 375x667/390x844 plus cross-owner 390x844; Brain verified committed receipts/evidence bytes, but did not independently rerun the whole 6,090 or live browser flows.

**Decision:** `ACCEPTED_SCOPED_CLIENT_SOURCE_ONLY`. No full M1-03 acceptance, no main merge approval, no Security/DB/native/device/clinical/release/paid admission. Leave prior accepted client fixes untouched unless a demonstrated regression needs a narrower compatible repair.
