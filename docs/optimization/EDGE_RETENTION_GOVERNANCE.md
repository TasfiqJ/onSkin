# Edge Deployment And Retention Governance

Status: declarative Edge deployment implemented locally; scheduled retention blocked on policy and operations decisions

Date: 2026-07-12

## Safe Local Work Completed

- `supabase/functions/manifest.json` inventories every deployable function directory, JWT behavior, caller class, public status, required/conditional secrets, and a source-controlled 60-second/256-MiB governance budget.
- `supabase/config.toml` declares every function entrypoint and JWT setting. The resource values in the manifest are review budgets, not a claim that Supabase currently enforces per-function limits from this file.
- `scripts/phase2/deploy-supabase-staging.ps1` validates and deploys the complete manifest rather than maintaining a second hand-written function list.
- The manifest checker rejects missing/extra function directories, missing or mismatched Supabase config, invalid auth/resource metadata, and environment variables referenced by function code but absent from the manifest.
- `20260712000040_edge_rate_limit_cleanup_index.sql` adds the `window_start` index used by the existing opportunistic `edge_rate_limits` cleanup predicate. It deliberately does not install a schedule or change the predicate's existing duration.

No live service was changed, no schedule was installed, and no retention claim is marked verified by this slice.

## Why OPT-017 Cannot Be Completed Safely Yet

The current sources explicitly withhold the decisions needed for destructive scheduled work:

- `docs/phase-3/data-inventory.md` is `not legal-cleared` and labels its retention section `Retention Commitments To Confirm With Counsel`.
- `docs/phase-3/privacy-security-review-log.md` says no privacy or security content is cleared.
- `docs/hugeToDo/evidence-governance.json` says country-specific durations remain an external legal decision before production launch and forbids inventing deletion dates for legal/incident records.
- `ask_safety_audit.expires_at` has an indexed purge key, but the authoritative Ask sources define only a `short` safety-audit window. They do not define who sets the expiry, the approved duration, legal-hold behavior, or the production scheduler.
- The repository does not currently contain export-archive, encrypted-outbox, deletion-operation, temporary-import-staging, or general diagnostic-aggregate stores matching several plan examples. Creating cleanup jobs for nonexistent stores would fabricate infrastructure rather than enforce a real claim.

## Retention Inventory And Required Decisions

| Data set                                                                                 | Current source evidence                                                                                       | Safe state now                                                                                | Decision required before a scheduled delete                                                                                          |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `edge_rate_limits`                                                                       | Opportunistic delete uses `window_start` and a caller-window-derived threshold; the matching index now exists | Keep existing behavior; observe table growth in staging                                       | Approved global schedule, maximum bucket age, batch/deadline, backlog threshold, and operator/alert owner                            |
| `ask_safety_audit`                                                                       | `expires_at` and `ask_safety_audit_expiry_idx` exist; Ask is launch-blocked                                   | Consent withdrawal/account deletion remain the only active deletion paths                     | Counsel-approved audit-window duration, expiry writer, hold/appeal exception, encryption/access-log review, and launch authorization |
| `subscriptions_events` / entitlement history                                             | Raw/sanitized webhook audit supports billing correctness                                                      | Do not delete                                                                                 | Finance/legal retention, dispute/refund needs, provider reconciliation window, and legal hold                                        |
| Catalog lookup/report records                                                            | Operational and correction provenance; no approved duration                                                   | Do not delete                                                                                 | Product-quality/audit needs, privacy minimization period, and whether aggregation replaces row retention                             |
| Community, trend, and consent records                                                    | Consent withdrawal/account deletion behavior is documented; surfaces remain gated                             | Preserve current owner deletion/cascade behavior                                              | Counsel-approved exceptions, moderation/legal-hold rules, and processor deletion scope                                               |
| Sentry/PostHog/provider records                                                          | Processor inventory requires configuration/review                                                             | Use provider deletion paths already required by account deletion; do not claim periodic purge | Contracted provider retention, region, deletion SLA, evidence, and named owner                                                       |
| Export archives, outbox rows, deletion operations, import staging, diagnostic aggregates | No matching durable store is currently present                                                                | No job                                                                                        | Implement the store first with an approved lifecycle and indexed terminal/expiry field                                               |

## Activation Runbook After Approval

1. Record launch countries, controller/legal owner, approved periods, deletion triggers, legal holds, processor obligations, and the exact policy/copy version in authoritative privacy documents.
2. Produce a claim-to-store map. Every claimed automatic deletion must identify the table/object prefix, indexed predicate, exception, and evidence owner.
3. Add one forward-only migration per bounded cleanup family. Each cleanup function must support report-only mode, a fixed batch limit, a transaction/statement deadline, deterministic ordering, idempotent retries, restricted execution grants, and a content-free result count.
4. Select and document the scheduler (`pg_cron` or an authenticated external scheduler) and its secret/role ownership. Do not use an unauthenticated function or a dashboard-only JWT exception.
5. Run staging report-only mode first. Capture query plans proving the predicate uses its intended index, oldest/newest timestamps, backlog counts, run duration, and zero cross-scope deletion.
6. Predeclare backlog age/count and failure thresholds, alert destination, on-call owner, retry policy, and a pause/disable procedure.
7. Enable small delete batches in staging, test duplicate/overlapping invocations and deadline interruption, then reconcile counts against the report-only snapshot.
8. Obtain privacy/security approval for the exact migration, schedule, policy mapping, and evidence. Production activation remains a separate authorized operation.

## Acceptance Evidence Still Required

- Staging migration replay and `EXPLAIN (ANALYZE, BUFFERS)` for each cleanup predicate.
- Report-only and deletion runs with bounded backlog evidence.
- Duplicate-run, timeout, partial-failure, and alert-delivery tests.
- Approved privacy-copy-to-job mapping.
- Live schedule identity, secret version identifier, function/database version, and named operator signoff.

Until those conditions are met, OPT-017 remains externally governance-blocked and OPT-119 remains partial: its predicate/index alignment is implemented, but scheduled cleanup and load/table-growth evidence are not.
