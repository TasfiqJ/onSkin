# Phase 11 Incident And Rollback Drill

Status: BLOCKED until drill evidence is attached.

The accepted `docs/UPDATE_DELIVERY_POLICY.md` permits store-bundled client
releases only. EAS Update channels and OTA rollback are unavailable.

## Rollback Tools

| Issue type                         | Preferred action                                                                                   |
| ---------------------------------- | -------------------------------------------------------------------------------------------------- |
| JavaScript or asset bug            | halt expansion, contain with a reviewed flag if safe, then submit a tested App Store binary hotfix |
| Native crash or store binary issue | halt expansion, submit hotfix binary, consider store halt where available                          |
| Server-side issue                  | feature flag, Supabase function rollback, database migration rollback plan                         |
| Payment issue                      | disable paywall entry points, RevenueCat config rollback, support escalation                       |
| Privacy/data issue                 | halt expansion, disable affected flow, legal/privacy owner review                                  |
| Harmful claim or store copy issue  | remove copy, update store/support/creator materials, hold campaign                                 |

## Drill Steps

1. Choose a simulated P1 release issue.
2. Open incident bridge.
3. Identify owner and backup.
4. Freeze launch expansion.
5. Decide the permitted recovery path: reviewed feature flag or provider
   containment, server-side recovery, store release halt, or tested binary
   hotfix. Do not select an EAS Update or OTA rollback.
6. For a client hotfix, bind the affected and replacement source SHAs, EAS
   build IDs, native build numbers, runtime fingerprints, privacy and signing
   artifacts, and supported-binary compatibility. Re-run the affected
   physical-device and App Store review gates before submission.
7. Draft user/support communication.
8. Execute in staging or dry-run mode.
9. Re-run privacy, payment, deletion/export, owner-isolation, and affected-flow
   smoke against the rollback result.
10. Record timestamps and decision owner.
11. Close incident only after monitoring confirms recovery.

## Required Evidence

- incident ID
- issue scenario
- owners present
- permitted recovery command or console path
- affected and hotfix source SHAs, build IDs, native build numbers, and runtime fingerprints
- proof that the server-side recovery target or replacement binary was reviewed
- communication draft
- recovery metric
- postmortem notes

## Launch Blockers

- no owner reachable
- no tested App Store hotfix and store-release halt path
- no support macro for incident
- no monitoring signal to confirm recovery
- no decision rule for halt vs continue
- an attempted OTA repair for any client defect under the accepted store-only policy
