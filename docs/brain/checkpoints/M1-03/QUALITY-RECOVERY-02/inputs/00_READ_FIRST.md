# onSkin V2 — M1-03 / QUALITY-RECOVERY-02

**New exact source-only authorization `M103-QUALITY-RECOVERY02-SOURCE-EDIT-01`. Admission NONE.**

**CORRECTED REISSUANCE R1 (2026-10-22): THIS PACKET SUPERSEDES THE INVALID QR02 PACKET.** The first QR02 packet (external manifest SHA-256 `034673ce0cb92da4ed30e8cd6a9c937489f2dfccc8cd9021ad092f13b215c7ca`) failed one protected preimage check: `scripts/phase9/security_acceptance/source-manifest.json` had an issued SHA-256 `3142f0f5c74bc42fc4e1b2e2cb03de8142075a885199b22ecd7035118185b69d` rather than the verified committed SHA-256 `3142f0f5c74bc42fc4e1b2b2cb03de8142075a885199b22ecd7035118185b69d` (same correct Git blob `a774abbf05448ff9a283f2214c13c2c231fc964b`). Independent checks at unchanged stage `b74c0efa23828bcdaa3fbe49e43177dcc69331b9` / tree `675e93e9b1636d169d45cc532a4a1f7daf2509cb` found all 11 writable preimages and the other seven protected preimages correct. No repository edit or push occurred under the invalid packet. The source authorization ID, branch, exact base, allowed edits, protected gates, and stop rules are UNCHANGED. **Discard the prior QR02 ZIP and prompt. Do not combine their files or permissions with this replacement.** The new manifest SHA-256 must be supplied separately in the new exact prompt.


1. **Independently verify** this extracted folder with `python -B verify_context.py --expected-manifest-sha256 <EXTERNAL_64_HEX_FROM_PROMPT>`. A digest copied from inside the ZIP does not authorize anything.
2. Read `01_BRAIN_AUDIT.md`, `02_TASK.md`, `03_SOURCE_EDIT_AUTHORIZATION.md`, `04_UPSTREAM_WIDGET_EQUIVALENCE.md`, `05_PRIVACY_MAPPING_RULES.md`, `06_REPRODUCERS.md`, `07_TEST_AND_ACCEPTANCE.md`, `08_PROTECTED_GATES.md`, `09_DELIVERY_PROTOCOL.md`, and `10_STOP_RULES.md`. JSON files are strict machine-readable companions.
3. Verify live repository branch and main, PR #9 status, exact base SHA/tree, Git worktree cleanliness and `SOURCE_EDIT_AUTHORIZATION.json` preimages **before any source edit**. A moving stage head invalidates this issuance.
4. Install **this one** packet byte-for-byte in `docs/brain/checkpoints/M1-03/QUALITY-RECOVERY-02/inputs/` and the independent Brain review under `docs/brain/reviews/M1-03/QR01-REVIEW01/`. Prior intervals/reviews remain immutable.
5. Work exclusively on existing `stage/m1-retained-safety`, normally push safe work on that branch, stop for independent Brain review. Never merge PR9 or authorize `main`.

No JANUS patient files, raw secrets, found-credential validation, cloud clinical activity, paid services or credentials are in this packet. This is a limited **source/dependency/provenance repair**; not a Security/DB approval.
