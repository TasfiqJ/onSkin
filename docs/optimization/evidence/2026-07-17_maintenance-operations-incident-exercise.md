# OPT-212 Maintenance Operations Incident Exercise

Date: 2026-07-17 (America/Toronto)

Parent SHA: `e72da9a06b01590e5a32ab5c7685ee7c4497dbdf`

Status: `implemented`; the version-controlled contract, runbook, and local
incident exercise pass, while live operational wiring remains external.

## Outcome

The repository now has one machine-readable, content-free maintenance dashboard
contract and one executable incident-decision path. The contract covers five
domains and 15 aggregate metric definitions:

1. release health;
2. artifact and performance governance;
3. privacy and data-rights operations;
4. payment and entitlement maintenance;
5. backend maintenance and retention.

Every dashboard remains `blocked-external`. Live URLs, named primary/backup
owners, refresh cadence, source-validation evidence, and production thresholds
are intentionally null or absent. The contract requires those fields before a
dashboard may move from `definition-only` to live rehearsal or launch readiness.
No threshold was derived after viewing a result.

## Privacy And Safety Contract

The contract allows only environment, release, build, platform, OS class,
device-memory class, route enum, and error enum dimensions. It explicitly
forbids user/account identifiers, contact details, search/barcode/product/
ingredient content, photo references or bytes, routine/health content, tokens,
receipts, and raw provider payloads.

The executable validator fails closed on forbidden scenario keys, duplicate
dashboard/metric IDs, claimed live wiring, unapproved production thresholds,
unknown signals, malformed synthetic artifact identity, and unreviewed rollback
targets.

## Incident Exercise

The deterministic `OPT212-DRILL-001` scenario is a synthetic P1 native crash in
staging. It contains no customer or product content.

| Decision                                    | Result                                            |
| ------------------------------------------- | ------------------------------------------------- |
| Freeze rollout                              | yes                                               |
| Compare current/target runtime fingerprints | yes                                               |
| Rollback target previously reviewed         | yes                                               |
| EAS Update eligible                         | no; accepted release policy is store-only         |
| Selected path                               | halt expansion and use binary/store hotfix        |
| Local exercise                              | pass                                              |
| Incident closure                            | withheld pending independent live recovery signal |

The smoke matrix also proves:

- a reviewed JS-only defect with an exact runtime-fingerprint match still
  selects `binary_halt_hotfix` under the accepted store-only policy;
- a privacy incident selects `privacy_containment_and_review`, not a client
  rollback;
- a content-bearing `email` field is rejected.

The runbook adds the same explicit server, payment, privacy, artifact, and
backend containment boundaries, plus closure criteria and the store-binary
recovery gate required by the accepted update-delivery policy. This corrects
the earlier theoretical EAS Update branch, which was not a configured release
capability.

## Honest Acceptance Boundary

The plan requires an incident exercise. The local, content-free decision
exercise passes and is regression-tested. OPT-212 is still `implemented`, not
`verified`, because a real dashboard and incident cannot be closed here without:

- named primary and backup responders;
- validated live data sources and dashboard URLs;
- pre-approved production thresholds and refresh cadence;
- staging/production function, migration, or binary rollback identifiers;
- an independent live recovery signal.

The exercise correctly ends as `complete-with-live-monitoring-blocker` instead
of inventing those facts.

## Files

- `docs/optimization/maintenance-dashboard-contract.json`
- `docs/optimization/MAINTENANCE_OPERATIONS_RUNBOOK.md`
- `docs/optimization/maintenance-incident-exercise.json`
- `scripts/optimization/maintenance-incident-exercise.mjs`
- `scripts/optimization/maintenance-incident-exercise-smoke.mjs`
- `test-results/optimization/2026-07-17/opt212/exercise-result.json`
- `test-results/optimization/2026-07-17/opt212/contract-audit.json`

## Verification

- `node scripts/optimization/maintenance-incident-exercise.mjs --json` — PASS.
- `node scripts/optimization/maintenance-incident-exercise-smoke.mjs` — PASS
  for store-only native and compatible-JS recovery, privacy, policy drift, and
  forbidden-content scenarios.
- Focused maintenance exercise — 1 file / 1 test PASS.
- Full root tests — 327 files / 3,963 tests PASS.
- Root typecheck — 2 workspaces PASS.
- Root lint — 2 workspaces PASS with zero warnings.
