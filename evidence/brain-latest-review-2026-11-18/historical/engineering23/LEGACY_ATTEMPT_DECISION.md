# Engineering23 legacy optional-draft decision

The original collection schemaVersion 1 and original per-record hash representation remain readable without migration, inferred proof, or default fields. Additive private collection schemaVersion 3 permits both original and individually upgraded records. Version 2 remains unsupported, preserving the existing unsupported-version regression assertions. The purpose-bound storage key remains layerwell.optionalChangeDrafts.v1.

| Legacy condition | Decision |
| --- | --- |
| Existing event, all original facts/identity/target/revision and exact old sourceProof match | Recognize the exact event. Save/refresh retain the original record. Canonical readback may retire it without another append. |
| Existing event and facts match, but original proof cannot establish predecessor equality | Return distinct PROOF_UNVERIFIABLE. Preserve the original draft, prohibit append and automatic retirement. Exact-CAS explicit discard remains available and does not alter history. |
| Existing event with different factual content or identity, or changed/missing target | Retain the existing conflict/target refusal. Do not retarget or infer proof. |
| No existing event, unattempted, exact current source | Explicit Save of unchanged fields or explicit Refresh may add the predecessor proof derived from that same canonical source. A proof-only upgrade preserves factual fields, event/target identity and target hash, draft revision and timestamps. The changed content hash/full-object CAS rejects older callbacks. |
| No existing event, attempted legacy record | Save/retry cannot upgrade it. Require explicit Refresh with a fresh canonical read, preserve original facts/event/target identity, clear attempted for renewed review, and advance the ordinary draft revision. Require another explicit review and confirmation before a newly persisted attempted record can append. |
| No existing event and source changed | Preserve the draft. Require explicit Refresh and exact target revalidation, updating the source revision/proofs through the existing refresh semantics, then renewed review/confirmation. |

Only a selected eligible record changes on explicit Save/Refresh. Other legacy records retain their original facts, identity, revision, timestamps, absent proof field and original content hash. Actual source refresh or resetting an attempted state continues to advance the normal draft revision; the additive proof-only upgrade does not.

Both new proofs are captured from the same validated owner-bound source: sourceProof hashes the full raw outer bytes for CAS; eventPredecessorProof hashes v5 completionBytes, or the original raw completion source for other supported envelopes. Before append the exact accepted attempted draft and both proofs are checked in the original admitted transaction. Exact canonical event predecessor equality is required at readback and again before retirement. No historical reconstruction, migration or source-proof inference from IDs/text/current events occurs.
