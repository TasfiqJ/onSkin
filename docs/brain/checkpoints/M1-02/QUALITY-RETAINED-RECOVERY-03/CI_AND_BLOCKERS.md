# CI diagnosis and remaining custody

`anchor-ci-diagnosis.json` contains freshly retrieved head-bound workflow states
and exact relevant error lines for starting head 704d3df5e. It excludes unrelated
full CI log contents and does not collect secret values.

- Quality 40048160616: FAILURE. Repository job 120734493735 passed preceding
  checks then refused the two stale generated worklists, exit 1. The clean,
  complete local reproduction matches that cause. Sparse missing-input errors
  are additionally preserved and explicitly separated.
- Canonical database job 120734493583: FAILURE before the required image starts:
  `H01_SQL_PROBE_FAILED: exit-nonzero`, `Data limit exceeded`. This is an
  independent registry/canonical-image custody problem, not worklist drift.
  The registry/image custodian must restore original authorized acquisition
  before the original canonical job can succeed. No alternate image, workflow
  edit, paid retry, credentials experiment or local SQL substitute was used.
- Security 40048160572: FAILURE. No Security gate is relaxed by this candidate.
- iOS launch contract 40048160574: SUCCESS, source-only. No native/device/build
  signing or release admission follows.

Fresh runs for the final pushed evidence head must be read separately after
delivery. The measured source's local green checks are not full Quality closure.
Final-head workflow statuses, including pending/skipped states, are returned in
the delivery/PR11 observation without inventing a future self-hash here.

Open custody remains as supplied: M1-03 BLOCKED_EXTERNAL_CUSTODY/NOT_ACCEPTED;
original G97 FAIL/NO_GO; 61 source refusals, 26 SQL obligations, 189 failed targets
and 368 historical events; exact OWASP byte custody unresolved. These counts are
attributed to the verified packet/prior Brain record, not newly rerun totals.
Original owner proposal expired 2026-10-21T00:00:00Z and stays unchanged.
Only the designated source/Security/DB custodians and independent Brain can
close their respective gates; the founder is not asked for technical decisions.

M2-01, DB06/DB08/R2B, hosted replay, clinical/J05, paid/provider, native/device,
signing/TestFlight and release remain NOT_AUTHORIZED. Main is still the supplied
d9912f4c8b30358593569c5b9b4e84773c6f463e base. PR10/stage/m1-gate-recovery is
read-only at cd2bd51997f283c0b446bf2124f427f482550fa8. The stage-only push has no
merge/auto-merge instruction. New source is SUBMITTED_REVIEW_REQUIRED; broad
delivery remains PARTIAL_BLOCKED. Incremental spend USD 0.
