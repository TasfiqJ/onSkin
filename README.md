# Campaign23 independent review artifacts

Implementation, verification and delivery are complete and submitted for independent Brain review. Source acceptance remains **SUBMITTED_REVIEW_REQUIRED**; **G97 FAIL / NO_GO**. Required dependency findings, custody gaps and Security/database failures remain open.

## Review files

- [Return ZIP](onSkin_Campaign23_Security_Integration_Return_2026-10-28.zip): 120 outer files, including the minimal source delta requiring pinned PR26 and the 260-file checkpoint payload.
- [Complete report](COMPLETE_REPORT.md): implementation, test results, all 14 final CI job outcomes, exact source identities and the completed external delivery annex.
- [External anchors and delivery proofs](ANCHORS_AND_DELIVERY.json): manifest/ZIP/verifier/bootstrap hashes, the full outer inventory and actual download/verification proof.
- [SHA256SUMS](SHA256SUMS): hashes of the three delivery files and this README; the checksum file excludes its own hash.

## Source checkout for verification

[Draft PR27](https://github.com/TasfiqJ/onSkin/pull/27) contains the sealed implementation on `stage/m1-security-integration23`.

- Exact source head: `5976394fd39f41550bde8107b9cc27c758b7ce14`
- Exact source tree: `63a896fad61d85a51b0d1e9a23020ba02d169c9e`
- Required PR26 base: `34fac69f3ba527724ecdf2d1cef69f27372756ad`

This separate artifacts-only branch stores the delivery files. Check out the exact source head above when running source verification. The artifacts commit is independent of the sealed source history and adds no source/evidence tail to PR27.

Both independent full source clones passed current/mutated/restored 0/1/0, semantic no-admission and unchanged strict Phase4. The actual downloaded ZIP matched its external hash, passed artifact corruption/restoration 0/1/0 and full Git verification in both clones. No merge, deployment or release acceptance is authorized. USD0.
