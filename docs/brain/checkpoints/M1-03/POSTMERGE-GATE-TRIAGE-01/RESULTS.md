# Results

All commands ran against measured source d9912f4c8b30358593569c5b9b4e84773c6f463e in the disposable clone. Candidate tests add only the one proposed test_contract.py diff; exact postimage and patch hashes are in evidence/status.json. Commands, raw exits, durations and SHA256s are in evidence/command-results.json. Logs use stdout + literal STDERR delimiter + stderr, as recorded by the reproducible drivers. Nonzero original exits remain failures.

| Check | Raw exit | Seconds |
| --- | ---: | ---: |
| original-sbom-wrapper | `1` | 0.2 |
| underlying-assertion | `1` | 0.11 |
| original-targeted | `1` | 0.45 |
| original-70 | `1` | 152.48 |
| original-secret-12 | `0` | 6.81 |
| original-workflow-structure | `0` | 0.08 |
| candidate-targeted | `0` | 0.62 |
| candidate-adverse | `0` | 1.78 |
| candidate-70 | `0` | 158.1 |
| canonical-image-source-contract | `0` | 9.42 |
| candidate-reverse-apply | `0` | 0.01 |
| candidate-reversal-clean | `0` | 0.43 |
| reversed-original-targeted | `1` | 0.44 |
| candidate-fresh-apply-check | `0` | 0.01 |
| local-database-source-contract | `0` | 0.28 |

Original 70: 23 failure events, 2 errors; candidate 70: all pass. Original secret fixtures: 12 pass. Canonical-image source tests: 150 pass, with Docker calls mocked by the existing tests; local DB source contract passes. These are not container acquisition, database replay or provider acceptance.

The five selected candidate adverse methods exercise inventory/blocker/count/provenance/signoff/age tampering, non-1 execution exits, unknown npm/OSV advisories, component and dependency-edge omission, and proposal/scope expiry. All original 70 cases remain present. The positive remains technical-only. Red -> green -> red is reproduced by the targeted original, candidate and reversed-original runs.

Original workflow structure check returns valid=true, approval=false. This validates structure only. Original provider artifacts and job steps are separate evidence: continue-on-error steps may show successful conclusions while their raw outcomes remain failure. The code artifact records phase9_verify=failure; its DB06 source-contract failures are preserved.

NOT_RUN: root 6,067-test suite, app/mobile typecheck and lint, new full scanner collection, npm install/audit, hosted replay, image pull, native/device/release work. No app/runtime source changed. The disposable clone copied existing local node_modules for test imports; YAML 2.9.0 matches the lock. Node v24.19.0 and Python 3.12.3 were used locally; the original Security Node 22 CI was not replayed. No exact-install scanner receipt is claimed.

An auxiliary Windows console inspection exited 1 on cp1252 Unicode output; its UTF-8 reread succeeded and no source test was affected. The unavailable default Ubuntu distro was bypassed using the existing onskin-r6-verification distro, without modifying either environment.

Delivery whitespace check: the default check flagged preserved CRLF checkpoint receipts (exit 2). With core.whitespace=cr-at-eol, three whitespace lines remain in the unchanged original-70 raw transcript, so the complete raw check stays exit 2. Prose, scripts, patch and JSON checks pass (exit 0). Raw transcript/input bytes and hashes are preserved under the existing checkpoint -text rule. See evidence/delivery-validation.json.
