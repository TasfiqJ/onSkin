# Phase 11 Incident And Rollback Drill

Status: BLOCKED until drill evidence is attached.

## Rollback Tools

| Issue type                         | Preferred action                                                             |
| ---------------------------------- | ---------------------------------------------------------------------------- |
| JS-only non-critical bug           | EAS Update fix or `eas update:rollback` if update-caused                     |
| Native crash or store binary issue | halt expansion, submit hotfix binary, consider store halt where available    |
| Server-side issue                  | feature flag, Supabase function rollback, database migration rollback plan   |
| Payment issue                      | disable paywall entry points, RevenueCat config rollback, support escalation |
| Privacy/data issue                 | halt expansion, disable affected flow, legal/privacy owner review            |
| Harmful claim or store copy issue  | remove copy, update store/support/creator materials, hold campaign           |

## Drill Steps

1. Choose a simulated P1 release issue.
2. Open incident bridge.
3. Identify owner and backup.
4. Freeze launch expansion.
5. Decide rollback path: EAS Update rollback, feature flag, server rollback, store halt, binary hotfix.
6. Draft user/support communication.
7. Execute in staging or dry-run mode.
8. Record timestamps and decision owner.
9. Close incident only after monitoring confirms recovery.

## Required Evidence

- incident ID
- issue scenario
- owners present
- rollback command or console path
- communication draft
- recovery metric
- postmortem notes

## Launch Blockers

- no owner reachable
- no production channel rollback path
- no support macro for incident
- no monitoring signal to confirm recovery
- no decision rule for halt vs continue
