# Exact allowed change

Read `SOURCE_EDIT_AUTHORIZATION.json` and `PREIMAGE_WITNESSES.json` as strict input. Base `eaa47d7a1882dc395100bd0a958550a8beef406b`, tree `7abcf80b45c88bad08f8411405c744c55d727093`. Main `d9912f4c8b30358593569c5b9b4e84773c6f463e`; PR #10 must remain DRAFT. Compute all preimages from `git show`, object IDs, SHA256 and working bytes. Recompute the source-preimage fingerprint given in `TASK_STATE.json` using canonical sorted JSON and compare independently. Wrong checkout or any mismatch -> STOP.

**Implementation only after eligibility proof:**

- `scripts/phase9/security_acceptance/semgrep-requirements-linux-py312.txt`: replace exactly the reviewed certifi line with the official 2026.10.19 version/hash. No other line, whitespace, version or hash changes.
- `scripts/phase9/security_acceptance/proposal.json`: set only `semgrepBuild.requirementsSha256`, `semgrepBuild.originalPackageTree`, `semgrepPackageTree` using independently witnessed and exact reproducible tool artifacts from the SAME isolated OS/Python/pip conditions. Preserve every other byte/value semantically (ideally stable formatting), especially `notAfter`, existing signatures/owner pins, `sourceManifest`, rules, engine archive/core, scanner commands and exception identities. No renewal of an expired proposal.
- `.gitattributes`: optionally append only immutable marker for new checkpoint input bytes, with old bytes preserved.
- `docs/phase-4/generated/source-worklist.{json,md}`: only if rebuilt with existing canonical producer from clean source; strict check.
- Root `ONSKIN_BRAIN_HANDOFF.txt`: truthful task summary only. New files only `docs/brain/checkpoints/M1-03/SECURITY-CERTIFI-TOOLCHAIN-01/**`.

If you cannot prove old tool tree exactly, or new package tree change touches ANY noncertifi distributions, do **not** edit requirements/proposal on stage. Publish a hash-only blocked candidate under the new checkpoint and stop. No staged partial source edits allowed; preserve both protected source files intact as a pair.
