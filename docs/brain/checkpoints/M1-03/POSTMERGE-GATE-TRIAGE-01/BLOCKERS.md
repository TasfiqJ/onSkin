# Original blockers

| Original gate | Observed outcome | Causal classification / required action |
| --- | --- | --- |
| Security 39833311172 code | FAILURE | Raw phase9_verify fails DB06_SOURCE_CONTRACT_REVIEW_REQUIRED (six source-bound test failures), despite continue-on-error step conclusions. Audited SBOM, npm high audit and exception gate each exit 1. The real SBOM also has two unreviewed moderate advisories. Protected review remains required. |
| Security static | FAILURE | Original 70-test technical suite fails before collect.py runs; no current Semgrep raw report or complete technical receipt exists in the artifact. OSV raw exit is 1, independently of the suite failure. A candidate fixture pass does not create SAST coverage. |
| Security secrets | FAILURE | Original raw Gitleaks history/current exits 2 with 4,349/1,120 findings; check rejects SECRET_CURRENT_SOURCE_FINDINGS_UNREVIEWED. TruffleHog history/current exits 0, verified counts 0. Zero verified TruffleHog findings does not dispose of Gitleaks findings. Counts and location hashes only are delivered. |
| Source-only admission | FAILURE | The downloaded exact-source decision is REJECTED / PROPOSAL_EXPIRED_OR_CHANGED. Original expiry 2026-10-21T00:00:00Z remains fixed. No renewal or automatic rebinding. |
| Quality 39833311194 canonical DB | FAILURE | Original pinned ECR acquisition fails Data limit exceeded before startup; no legitimate immutable image/container proof. |
| Quality repository / PG15 / PG17 / Expo exports | SUCCESS, separate axes | Original job metadata confirms these successes; they cannot substitute for canonical DB or Security. |
| iOS 39833311278 | OBSERVED SUCCESS, source-only | Live original run metadata re-read at the issued SHA; not rerun here. No native/device/signing/TestFlight/release admission. |

Frozen reviewed source manifest: 11,920 listed rows plus proposal/manifest special files. Current source has 19,971 regular Git files: 89 changed listed files, 0 missing, 8,049 extra. Of extras, 7,933 are docs/brain; all path-class counts are in scanner-discrepancies.json. These are real review discrepancies, not permission to regenerate protected pins.

Frozen coverage: 9,206 targets (7,755 required, 1,451 auxiliary), 2,716 exclusions, 26 explicit SQL targets. Retained historical Semgrep fixture: exit 0, zero results, 12 diagnostics, one fixpoint timeout and 9,188 scanned paths, missing 18 target identities. It stays incomplete. Current-source classification is 13,365 required, 1,451 auxiliary JPEGs, 5,005 excluded PNGs, 84 excluded JPEGs and 6 reviewed gzip artifacts; 60 unreviewed gzip artifacts and one oversized required docs/brain input block the present policy. These counts classify source bytes; they do not assert a fresh scan. No automatic exclusion/rebinding was performed.

Original npm artifact retains GHSA-86w9-cpqp-85rv and GHSA-vfj7-8cjw-p6xm plus GHSA-qxg6-89mg-rqv8 and GHSA-xp26-3454-mjgp. Original OSV additionally reports GHSA-6q48-6c7w-9gw2, GHSA-84m7-p3x7-pcfv, GHSA-xcq7-p3pf-p88h and PYSEC-2026-4320, covering seven reported package entries. These are attributed scanner observations requiring review/remediation; no dismissal, severity downgrade, waiver or refreshed expiry is asserted.

Security source GO=false, database GO=false, main promotion=false, release=false, M2=false. Accepted tasks remain only M0-01/M0-02/M1-01/M1-02. Costs $0.
