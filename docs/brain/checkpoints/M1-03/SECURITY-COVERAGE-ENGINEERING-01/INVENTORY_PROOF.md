# Complete source and target accounting

| Relation | Issued 455e359 | Measured df171207 |
|---|---:|---:|
| Unchanged, including two binding documents | 11,832 | 11,832 |
| Changed frozen paths | 90 | 90 |
| Added | 8,895 | 8,913 |
| Missing | 0 | 0 |
| Complete denominator | 20,817 | 20,835 |

Issued additions: 8,747 checkpoint/review artifacts, 94 other docs, 42 tool/CI, 11 app/package and one other. Implementation adds 13 exact context inputs and five utility/test/documentation files. No existing source path changes in the measured implementation. The later handoff and evidence tail are separate.

| Original classifier | Issued | Measured |
|---|---:|---:|
| required | 14,210 | 14,228 |
| auxiliary | 1,451 | 1,451 |
| excluded | 5,095 | 5,095 |
| REFUSED | 61 | 61 |
| Sum | 20,817 | 20,835 |

The 61 refusals are **60 unreviewed compressed sources and one oversize required input**. [refusals.json](evidence/inventory-measured/refusals.json) preserves every name, blob, size, SHA256, frozen identity where present and reason. Every checkpoint remains counted; exclusions come from the unchanged exact-byte original classifier. Every row has accepted=false.

[summary.json](evidence/inventory-measured/summary.json) binds 41 inventory shards, at most 512 rows each, and four sidecar/summary files. Each inventory row is also its target-disposition row. Required + auxiliary gives **15,679 prospective targets**; all 20,835 paths appear exactly once across required/auxiliary/excluded/REFUSED. Verification rebuilds all bytes from Git and refuses source-hash tampering even after its shard digest is re-signed.

Frozen coverage has 9,206 targets (7,755 required + 1,451 auxiliary), 2,716 exclusions and **26 exact SQL tests**. [sql-targets.json](evidence/inventory-measured/sql-targets.json) preserves all 26 current/frozen identities; each remains required. [historical-obligations.json](evidence/inventory-measured/historical-obligations.json) binds **189 historical failed targets and 368 fixpoint events** to current blobs; every obligation stays OPEN with fresh result null. Historical timing profiles are not current coverage.

Old blob/size witnesses come from authentic frozen-manifest commit `bbc28dc3d1f945191a81be56945b8bda7bb6ef73`, checked against every frozen SHA256. The two binding documents are separately identified at the issued commit. Current object headers, regular modes, blob SHA1, size/SHA256 and working bytes are checked. Tracked, ignored and nonignored untracked sets are distinguished; measured clean clones have zero ignored/untracked paths. Links, reparse points, hardlinks, unsafe names, changed index, untracked tail and changed bytes refuse.

Final clean runs at `df17120787162afd9c73a77e120418115fc0ed19` / `c16053107b1dbedacd9920a2244c8bc33f9d846d` agree byte-for-byte: [final-determinism.json](evidence/final-determinism.json). [issued-projection-proof.json](evidence/issued-projection-proof.json) additionally compares every issued row to its exact Git tree entry and the separately measured row. Initial issued output predates additive presentation fields; it is not misattributed to the committed final tool version.

Candidate source shards reconstruct 20,833 old-schema rows plus the two original binding-document exemptions. `candidate/descriptor.json` records the exact pretty-JSON SHA256 and byte count (4,034,057 bytes, below 4 MiB). Candidate target shards include every refusal. Original schema has no REFUSED representation; scanCoverageManifest preview stays null and no valid policy patch is asserted. The proposed sourceManifest hash alone grants nothing.

The original proposal and manifest are already exempted from direct self-hashing; we do **not** claim an inherent original proposal cycle. A mutable checkpoint copy has no exemption. Updating it to describe its own latest bytes creates the concrete cycle in [custody-cycle-proof.json](candidate/custody-cycle-proof.json) and the adverse test. Evidence additions also change the live denominator. Proposed future solution: independently owner-pin an immutable measured commit/tree and review artifact, then bind every append-only evidence delta in a separate exact commit-bound custody manifest. Require equality for both, preserve every historical path and refuse unknown deltas. No such protected policy is installed here.
