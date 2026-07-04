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

## Support Macros

- Deletion/export escalation: collect app version, platform, account email/provider, request time, and support consent to inspect account state. Do not ask for skin photos or screenshots containing products/medical context.
- Payment escalation: collect platform, store account region if volunteered, RevenueCat app user ID, product, restore attempt time, and store receipt state if supplied through store-approved path.
- Store review escalation: collect reviewer notes, build ID, rejection code, affected metadata, and policy owner.

## Post-Incident

Every P0/P1 gets a written review covering timeline, root cause, blast radius, data classes, customer impact, remediation, tests added, policy/store updates, and whether launch/rollout remains halted.
