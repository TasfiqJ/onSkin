# iOS All-Features Execution Baseline

This packet implements `BASE-01`, `BASE-03`, `BASE-04`, `BASE-05`,
`BASE-06`, and `GOV-09` without treating the inventory or status files as proof
that a product feature is launch-ready.

## Machine-readable records

- `feature-inventory.json` maps every discovered Expo route, launch feature
  flag, direct native dependency, local/Postgres data store, Supabase Edge
  Function, vendor integration, and current generated packet/audit surface to
  one or more `F-01` through `F-20` feature IDs and an authoritative readiness
  label. It separately includes every required Phase 7/8 surface.
- `task-graph.json` contains every work-item ID parsed from
  `IOS_ALL_FEATURES_CODEX_EXECUTION_PLAN.md`, its prerequisites, acceptance
  condition, and next action.
- `execution-status.json` contains the same exact plan ID set and does not
  collapse founder, reviewer, Apple, or vendor gates into Codex completion.
- `credential-inventory.json` names approved storage locations and contains no
  credential values.
- `evidence-governance.json` defines one record format and the redaction,
  retention, rollback, and incident rules for all later evidence.
- `worktree-boundary.json` preserves every dirty path observed at delegation
  and records ownership coordination for overlapping files.

The plan currently contains **202** work-item IDs. The earlier 188-item audit
excluded the 12 founder/reviewer items and two vendor-controlled items; these
are still plan work items and must remain represented as external dependencies.

## Maintenance and validation

Run:

```bash
node scripts/launch/build-execution-baseline.mjs
npm run launch:execution-baseline:smoke
npm run launch:execution-baseline:check
```

The build command mechanically refreshes the repository-derived inventory and
graph. It initializes status only when the status file is absent; the explicit
`--reset-status` option is required to discard recorded progress. Review every
generated diff before accepting it. The validator fails when:

- a plan work item is missing or duplicated;
- a feature or gated surface is missing;
- a newly discovered route, flag, native dependency, data store, Edge Function,
  vendor call, or generated packet is not in the canonical inventory;
- an item lacks a feature/readiness mapping or points to a missing source;
- a task lacks prerequisites or a next action;
- the credential file contains a value-shaped field or lacks a storage class;
- evidence, worktree, rollback, retention, redaction, or incident conventions
  are incomplete.

Repository scans are intentionally strict. A new top-level surface that cannot
be classified throws during validation instead of silently inheriting a feature
ID. Update the classifier and review the generated inventory as part of the
feature change.

## Status semantics

`complete` means only that the named work item and its retained evidence exist.
It does not mean a related feature is production-real. External actions remain
`external_pending`; unfinished Codex work remains `not_started`, `in_progress`,
or `blocked` with an exact dependency. Update status only alongside evidence.

No credential, professional decision, physical-device result, vendor approval,
Apple approval, or staffed-operations claim may be inferred or fabricated.
