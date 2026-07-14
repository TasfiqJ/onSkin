# Phase 9 Incident Response Plan

## Severity

- P0: confirmed data exposure, auth/RLS bypass, deletion/export systemic failure, payment entitlement systemic failure, or harmful clinical/claim issue.
- P1: crash/payment/delete/export issue affecting a meaningful user segment, unresolved store rejection, or sensitive payload leak to third party tooling.
- P2: isolated supportable defect without privacy/payment/security impact.

## First Hour

1. Assign incident commander and scribe.
2. Preserve build ID, SHA, env, Supabase project, RevenueCat project, Sentry issue, PostHog event names, and affected user IDs.
3. Stop rollout/marketing if halt criteria are met.
4. Disable risky feature flags or web entry points if containment is available.
5. Notify privacy/legal owner for data, deletion, export, or health-adjacent issues.

## Durable Account-Deletion Incidents

Treat a sustained Cron gap, repeated worker 401/503, expired leases without
recovery, growing oldest-runnable age, false terminal receipt, barrier bypass,
provider mutation without attestation, or Auth deletion before final local
attestation as P0/P1 according to blast radius. Follow
`docs/phase-9/account-deletion-operations-runbook.md` and preserve only
redacted operation IDs, stable result/error codes, counts, timestamps, deployed
SHA, Cron job/run metadata, and provider request IDs approved for support use.
Never collect capabilities, claim/idempotency tokens, payload/receipt/worker
keys, Vault decrypted secrets, provider credentials, Apple codes/tokens, or
encrypted payload plaintext in tickets, screenshots, logs, or chat.

For containment, stop only the canonical Cron job when continued dispatch
could worsen harm, keep the lifecycle tables/barriers/receipts/tombstones
intact, and leave intake fail-closed or temporarily unavailable. Do not restore
the synchronous deletion implementation, delete lifecycle rows, remove write
barriers, reuse an old function with migrations `0048`-`0052`, or blindly
redispatch an ambiguous RevenueCat/PostHog/Apple mutation. Diagnose and roll
forward; resume the job only after a reviewed `action: work` canary and queue
reconciliation. A stopped scheduler is itself an incident until continuity is
restored or every queued operation has an owned recovery plan.

## Support Macros

- Deletion/export escalation: collect app version, platform, account email/provider, approximate request time, the user-visible phase/error code, and support consent to inspect account state. Do not ask for a deletion status capability, Apple authorization code/token, skin photos, or screenshots containing products/medical context.
- Payment escalation: collect platform, store account region if volunteered, RevenueCat app user ID, product, restore attempt time, and store receipt state if supplied through store-approved path.
- Store review escalation: collect reviewer notes, build ID, rejection code, affected metadata, and policy owner.

## Post-Incident

Every P0/P1 gets a written review covering timeline, root cause, blast radius, data classes, customer impact, remediation, tests added, policy/store updates, and whether launch/rollout remains halted.
