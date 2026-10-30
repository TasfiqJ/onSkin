# Campaign29 — Brain review artifacts

**PARTIAL_DIAGNOSIS / SUBMITTED_REVIEW_REQUIRED / NO_GO. All gates remain closed.**

This parentless branch hosts review copies only. The implementation remains fixed
at `71dde4eed92edd20ff0e9611da42086d6e0f2b89` / tree `f9e5f995d37a7dc058b07271e6b98f79cf698951` in [draft PR33](https://github.com/TasfiqJ/onSkin/pull/33).
This publication commit is not a new implementation or evidence tail. No merge,
tag, product release, main promotion, or source change accompanies this upload.

- [Original return ZIP](onSkin_Campaign29_Windows_Reader_Integrity_Return_2026-10-30.zip) — exact 2,757,782 bytes.
- [Full facts and completed delivery](FULL_FACTS.md) — complete original report
  followed by the later actual delivery proof; the original report prefix is intact.
- [Byte-exact engineering report](FINAL_REPORT.md).
- [Complete delivery proof JSON](DELIVERY_PROOF.json) and [final facts JSON](FINAL_FACTS.json).
- [External anchors](ANCHORS.json) and [SHA256 checksums](SHA256SUMS.txt).
- [Immutable checkpoint](checkpoint/) including its original payload ZIP.
- [Minimal PR32-required source/history bundle](source/).

The exact ZIP already contains all 100 return members and 395 sealed payload
members. The convenience copies on this branch are not an extracted verifier root.
Verify the archive explicitly, using externally supplied anchors:

```text
python -I -B verification/verify_return29.py --archive onSkin_Campaign29_Windows_Reader_Integrity_Return_2026-10-30.zip --expected-manifest-sha256 ad5de8c1599431a524815865d9f79e8d3cb83a1da5060d881526d88626d57d01 --expected-verifier-sha256 d0e620621c837f46a1e79e94e7eb4b226ab386bb24f07663edf663388fe650a2
```

That command checks archive integrity only; its sourceChecks are NOT_RUN. Complete
source checks require a separate full repository at the pinned source HEAD/tree.
Both supplier full-clone and assembled-return source proofs are in the report and
delivery proof. They are not independent Brain execution or source acceptance.

The consumed-byte defect is fixed within the observed stability model. The exact
suppressed historical Windows reader exceptions remain UNKNOWN / OPEN_REQUIRED /
NOT_REPRODUCED. Original Security remains red; private findings were not opened.
No universal TOCTOU, physical iPhone/VoiceOver, database, provider, clinical/legal,
Apple, or public-release acceptance is claimed. Independent Brain review is required.

The checksum ledger excludes itself; the pinned publication commit authenticates it.
