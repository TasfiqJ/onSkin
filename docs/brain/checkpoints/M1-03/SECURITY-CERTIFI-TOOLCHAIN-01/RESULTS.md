# Technical results

Official target wheel: 136,464 bytes, SHA256 `42d35340cc5b9ba78e818ddbff0c5b1c2b779de448a340fd1b989f5fa8670e1b`; 12 ZIP members, CRC and RECORD hashes verified; METADATA name/version/Python >=3.7 verified. Independently fetched [PyPI](https://pypi.org/project/certifi/2026.10.19/) and official OSV records [PYSEC](https://api.osv.dev/v1/vulns/PYSEC-2026-4320), [GHSA](https://api.osv.dev/v1/vulns/GHSA-6q48-6c7w-9gw2) identify 2026.10.19 as fixed for the one issue represented by PYSEC-2026-4320 / GHSA-6q48-6c7w-9gw2. This is no full advisory clearance. The CA bundle changed from 117 to 120 unique certificate DER hashes, with three additions and zero removals; content hashes are in the upstream receipt.

Fresh `git clone --no-hardlinks --no-local` used only the designated checkout as source. Native Ubuntu 24.04.5 / glibc 2.39, Python 3.12.3, pip 24.0 in an isolated venv, Node 24.19.0 and verified npm 11.20.0 were used. Python, dpkg and pip wheel identities are recorded. System Python was never changed.

Unchanged original bootstrap installed all 66 distributions with `--require-hashes --only-binary=:all: --no-deps --no-compile`. Original package tree `dabde8c684374b57d6f9b3093dff0fa020169d9d9a99d266ad810e1504b2774f` and assembled tree `8d4ccb867b988c64d6bf77d6c2921c9a32f01fb980e761374c525103a85a154a` matched exactly. Candidate repeated the same installer and function in the same environment.

Derived requirements hash `9af06b943d8cc19750ddc2f6d3831c096f540fb68965b62b2e760706a1db465f`; original package tree `f739ad265e973b29098d5bd640f2a01e25de016596d5761b5b8b030d58507cb9`; assembled package tree `5ad98b88c9391d205d83b224498022013b89ae5b27fe307983319912e0fe1ffd`. Both compared installations contain 2,834 file records. All 16 changed records are certifi source or predecessor/successor dist-info. Every noncertifi file, scanner binary, npm implementation, custom core, archive and preserved upstream member is identical. Full wheel origins, package versions, paths and hashes are retained.

| Execution | Raw exit | Interpretation |
| --- | ---: | --- |
| scratch-source-stage | 0 | PASS |
| scratch-source-commit | 0 | PASS |
| fresh-npm-ci | 0 | PASS |
| original-security70 | 0 | PASS |
| original-secret12 | 0 | PASS |
| original-expiry-exception8 | 0 | PASS |
| ordinary-governance103 | 0 | PASS |
| original-source-inventory-refusal | 1 | EXPECTED REJECTION |
| forced-root6067 | 0 | PASS |
| forced-typecheck | 0 | PASS |
| forced-lint | 0 | PASS |
| mobile-expo-compatibility | 0 | PASS |
| ios-source-privacy-check | 0 | PASS |
| ios-source-privacy-tests | 0 | PASS |
| ios-archive-privacy-fixtures | 0 | PASS |
| canonical-phase4-worklist-check | 0 | PASS |

Original Security 70, secret 12, exception/expiry 8, ordinary governance 103, forced root 6,067, forced typecheck/lint, Expo compatibility, unchanged iOS source privacy and archive fixtures, and canonical strict Phase4 worklist check ran against the measured clean tree. Governance has two original Windows-only skips on Linux; neither is called a pass. Turbo counts and cache bypass evidence are in raw transcripts. Four candidate-specific tamper/stale-tree/extra-package/forged-expiry checks plus real expired-proposal refusal are recorded separately. No real SAST source scan ran after original inventory refused.

Two own wrapper mistakes are retained in `evidence/auxiliary-attempts.json`: npm parent-prefix comparison instead of the original contract root, and comparison of version diagnostic text containing distinct absolute paths. The original bootstrap never failed. The scratch pair was restored before the second fresh candidate proof. An unsupported optional core `--version` returned 2; one corrected `-version` probe returned 0 for each exact core. These failures were not silently relabeled PASS. No original assertion, hash check or policy was weakened; each cause used at most two bounded approaches.

The original strict Brain reporter has no issuance adapter for this new disjoint scope; its actual rejection is captured separately, without altering governance source or granting acceptance. A separate exact-scope/hash verifier checks this technical packet, while original admission remains closed.

Final local checks: original input verifier PASS; exact technical scope PASS; original strict report raw exit 1, `REJECTED: Wrong M1 branch`; original strict live governance raw exit 1, `Wrong GF01 branch`. These original refusals remain blockers. New-checkpoint-only Gitleaks disclosure scan returned exit 0 with an empty result; no repository/history secret clearance follows.

Optional full-evidence Git whitespace check returned raw exit 2 for byte-preserved checkpoint CRLF/log whitespace. Its bounded receipt and full raw transcript SHA are retained; this is not called PASS. The two-file technical source diff separately returned exit 0. Issued members/raw receipts remain exact.
