# Maintenance Dashboards And Incident Runbook

Status: locally implemented; live operational wiring remains `blocked-external`.

## Purpose

This runbook turns the optimization plan's maintenance surfaces into one
content-free, version-controlled contract. It does not claim that a dashboard,
owner rotation, threshold, vendor project, signed build, or production alert
exists until its evidence is attached.

The machine-readable source is
`docs/optimization/maintenance-dashboard-contract.json`. Every live dashboard
must progress through these states:

1. `definition-only`: metrics and privacy schema exist in source control.
2. `live-rehearsal`: real source/link, named primary and backup, cadence,
   filters, and pre-approved thresholds are attached in a non-production
   environment.
3. `launch-ready`: source validation and an incident exercise pass, the last
   review time is recorded, and the decision owner signs off.

The committed contract remains `definition-only`. Its `ownerRole` values are
routing roles, not invented named owners.

## Privacy Contract

Only aggregates and the allowlisted release/build/platform/device/route/error
dimensions may enter these dashboards. Never store user/account identifiers,
contact details, search or barcode input, product or ingredient content, photo
references/bytes, routine or health-profile content, tokens, receipts, or raw
provider payloads.

Local diagnostics are not silently uploaded. Any future aggregate transport
requires a separate reviewed schema and privacy decision.

## Dashboard Index

| ID                    | Maintenance decision                                | Required external wiring                                    |
| --------------------- | --------------------------------------------------- | ----------------------------------------------------------- |
| `release_health`      | halt/continue rollout; native vs JS recovery        | Sentry/App Store source, links, owners, cadence, thresholds |
| `artifact_governance` | accept/reject bundle, signed size, and device gates | CI/signed artifact/device sources and approved budgets      |
| `data_rights`         | contain deletion/export/withdrawal failures         | Supabase/support aggregate source and privacy owner         |
| `payment_entitlement` | contain restore/webhook/projection failures         | RevenueCat/store/Supabase sources and revenue owner         |
| `backend_maintenance` | run/repair retention, Edge, and query maintenance   | Supabase source, scheduled-job evidence, backend owner      |

## Incident Entry

For P0/P1:

1. Assign incident commander and scribe from the approved on-call roster.
2. Record incident ID, severity, environment, release, build, source SHA,
   runtime fingerprint, and content-free error enum.
3. Freeze rollout/marketing expansion.
4. Preserve immutable build/update/function/migration identifiers.
5. Select the matching dashboard and confirm its source is current.
6. Notify privacy, revenue, clinical/claims, or store roles when the issue class
   requires them.

If the dashboard is not `launch-ready`, treat recovery confirmation as blocked;
do not downgrade the incident because a signal is missing.

## Rollback Decision

An EAS Update rollback is eligible only when all are true:

- the defect and repair are JS/assets only;
- current and target runtime fingerprints are exact matches;
- no plugin, entitlement, permission, privacy manifest, export declaration,
  WidgetKit/ActivityKit, or native dependency changed;
- the rollback target was previously reviewed;
- the production channel/update IDs are retained.

Otherwise halt expansion and use the binary/store hotfix path. Server, payment,
and privacy incidents use their explicit feature/function/provider containment
paths; a client OTA must not disguise a server or native rollback.

## Dashboard-Specific Containment

### Release health

- Halt the affected ring.
- Check build adoption and crash/error enums without event content.
- Apply the runtime-fingerprint decision above.
- Re-run startup, privacy, payment, data-rights, owner-isolation, and affected
  flow smoke on the recovery artifact.

### Artifact and performance

- Reject unexplained budget regressions.
- Reproduce the export/signed-artifact/device packet from the exact SHA.
- Do not move thresholds after seeing the result.

### Data rights

- Stop affected deletion/export/withdrawal entry points only when the reviewed
  fail-closed/support path remains reachable.
- Preserve operation receipts and aggregate state; never copy private payloads
  into the incident record.
- Notify the privacy/legal role and follow the jurisdiction-specific plan.

### Payment and entitlement

- Freeze paywall expansion or affected purchase entry points.
- Preserve store/RevenueCat event IDs only in their approved restricted system,
  not this dashboard contract.
- Reconcile entitlement projection and restore on the provider-approved path.

### Backend maintenance

- Stop or bound the affected job/function.
- Use dry-run and batch limits before replay.
- Confirm index-supported predicates, backlog convergence, and zero unowned
  critical slow queries before closure.

## Closure

P0/P1 closes only when the affected source and an independent recovery signal
are current, the smoke matrix passes, rollout decision is recorded, support
communication is ready, and a written review owns follow-up changes.

The local OPT-212 exercise intentionally finishes as
`complete-with-live-monitoring-blocker`: it proves the decision mechanics and
correctly refuses OTA for a native/runtime-incompatible crash, but it cannot
confirm recovery without live sources and named responders.

Run locally:

```text
node scripts/optimization/maintenance-incident-exercise.mjs --json
node scripts/optimization/maintenance-incident-exercise-smoke.mjs
```
