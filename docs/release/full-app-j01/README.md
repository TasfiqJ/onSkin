# Full app + J01 release08 proposal

Status: **SUBMITTED_REVIEW_REQUIRED**. Product decision: complete non-Korean app plus J01 Visible Pores. This is a source-governance proposal awaiting independent Brain acceptance, not accepted repository release authority, a shipped feature, main promotion or a release GO. Incremental spend USD0; no release date.

`contract.v1.json` is the finite proposed public scope; `matrix.v1.json` has one row per 20F/12C/6P/27J identity (65 total), with exactly38 required rows. `precedence.v1.json` explicitly preserves the byte-stable Sep27 technical guards. Legacy runtime/CI consumers are **NOT_DONE**, so their old `active` field is a legacy technical value, not a second proposed product scope. No application imports these files or activates a feature from them.

`roadmap.v1.json` is a gated DAG, not new task issuance. `history-crosswalk.v1.json` retains47 original task and51 ADR identities/statuses with packet and live provenance. Historical packet snapshots are byte-identical to their exact live source snapshots; both are hash-bound. `schema.v1.json` validates the machine bundle; the standalone checker also enforces semantic safety and immutable Git guards.

Run from the repository root, Python3.9+ standard library only:

```sh
python -B scripts/release/full-app-j01/check.py
python -B scripts/release/full-app-j01/test_contract.py
```

Exit0 means internally consistent governance with **release=NO_GO**. The checker cannot issue an approval. Negative fixtures derive from the authentic bundle in a temporary directory; they are not independent-checkout/source-worklist proof. No new CI wiring is claimed. See [migration and overlaps](migration.md), [J01 protocol](j01-feasibility.md), [owner packets](owner-packets.md), [priority ADR](ADR-RELEASE08-001.md) and [roadmap](roadmap.md).
