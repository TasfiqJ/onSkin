# Independent Brain audit — QR03 completion and narrowly scoped remaining defect

Reviewed exact delivered stage `dbcfce9770850d4655221bd3d4c3b5799553aed2` (tree `93d9a5789c1ce443cf0bcd86696fff044ff2fd64`) after preceding source measurement `8f79f90da1b4ecb1f721ea55c93998173ed910ef`.

**Decision:** QR03 PARTIAL_ACCEPTED only for the Expo notifications patch, deterministic two-entry lock delta and conditional three-field iOS mapping rebind. Whole M1-03 NOT accepted. Original source Security RED. No `main` promotion.

Independent source audit: 145 changed paths within QR03 scope, 61 evidence/handoff-only tail; 142/142 committed report artifacts and 143/143 manifest regular Git blobs match, and 10/10 writable plus 13/13 protected preimages matched. Fresh no-hardlink clone, npm ci 1,032, forced root 6,067, typecheck/lint zero-cache, mobile Expo compatibility, widget and strict source privacy checks, original secret12 pass. Local historical governance **ordinary discovery** fails with QR02 fixture error/negative subtests; the alternate frozen-endpoint diagnostic is not a substitute.

Verified final SHA-specific GitHub runs: Quality `39815179883` failed overall but repository source job `119951746155` **succeeded**, iOS & Android Expo exports and PG15/17 rehearsal jobs succeeded. Canonical DB job `119951746554` failed `Error response from daemon: error from registry: Data limit exceeded`. Security `39815179834` failed, iOS launch contract `39815180069` passed source-only. Do not substitute any test green for Security/DB authority.

**Technical regression:** Original `test_m103_quality_recovery02_profile.py` setUp currently copies `brain.ROOT/.gitattributes` and the *current* `scripts/brain/m103_profile.py` into a synthetic QR02 predecessor fixture at a frozen interval, although the live source now contains QR03 markers. Correct default historical validators reject that mismatch. The QR03 test fixture uses the same current-source copying pattern, and should be future-proofed at its exact frozen endpoint before another source issuance. No prior immutable Brain review, active marker or Security record may change.

**Authorized response:** one M1-03 / GOVERNANCE-FIXTURE-01 task, limited to fixture historical source selection and new disjoint governance enforcement. Preserve all original `test_*` assertions, adversarial negatives, source binding and false-GO refusals. No new production feature, scanner, external provider access or spend.
