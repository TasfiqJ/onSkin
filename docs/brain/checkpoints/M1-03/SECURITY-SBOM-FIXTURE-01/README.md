# SECURITY-SBOM-FIXTURE-01

Protected technical unit-fixture correction only. Authorization `M103-SECURITY-SBOM-FIXTURE01-SOURCE-EDIT-01` is disjoint from all prior grants. Admission remains NONE; real Security admission is CLOSED.

The supplied ZIP was extracted and its verifier was run first with the external manifest SHA256 `0b080328e308f3533afeb9b3764fd4f2d07f48a1ab5d5674e6fc08413a1cb50b`. All 25 stage preimages were checked by exact working bytes, Git blob, size and SHA256 before mutation, then rechecked immediately before the patch. Live stage/main refs matched the issuance; the checkout was clean and no competing writer was observed.

The exact committed patch was applied without reconstruction. The only functional source change is `scripts/phase9/security_acceptance/test_contract.py`. Its 49,880-byte postimage has SHA256 `661cfc2615689e3e64ee96d343e7e0bd76eeb6e8276c1483d04733248cd193f8` and Git blob `e5c9a7cd575c35be768120ac8bdc146a0f50283d`. All original 70 test bodies and all code outside `ContractTests.workflow_fixture` are preserved. The unchanged production producer builds the current-lock synthetic inventory and must still exit 1 under the unchanged expired policy. The immutable historical audit is replayed only in the unit fixture.

Measured source commit: `efc75bf119904f983e40380067f682d111da52dd`; tree: `85568597205ccb6ee5a94fe16db063f78abbc70f`. The code commit changes one file. Subsequent checkpoint and handoff commits are evidence only. Tests ran in a separate fresh no-hardlink Linux clone on Node 22.21.0 / Python 3.12.3 after an authentic fresh `npm ci`.

See [RESULTS.md](RESULTS.md), [BLOCKERS.md](BLOCKERS.md), [completion-report.json](completion-report.json), and the exact regular-object manifest [SHA256SUMS.json](SHA256SUMS.json). Every issued input is preserved under `inputs/`. Raw validation command outputs and raw exits are under `evidence/`; these are technical test transcripts, never scanner receipts. New adversarial data is disposable.

Draft PR: https://github.com/TasfiqJ/onSkin/pull/10. Main remains read-only at `d9912f4c8b30358593569c5b9b4e84773c6f463e`. No ready/merge/auto-merge, source Security GO, expiry renewal, hosted replay, image pull, credentials, spending, M2, signing or release is authorized. Independent Brain acceptance is required.
