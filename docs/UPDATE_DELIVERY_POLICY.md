# Update Delivery Policy

Date: 2026-07-17
Status: accepted launch policy

RoutineKind V1 uses store-bundled client releases only. EAS Build and EAS
Submit remain supported build/distribution tools, but EAS Update is not an
active delivery or rollback path.

This policy and `docs/DECISIONS.md` supersede older architecture, Phase 9,
Phase 11, template, checklist, or generated text that describes an OTA channel
or EAS Update rollback as currently available. Conditional/historical EAS
instructions do not authorize publication.

## Enforced Repository State

- `expo-updates` is not a direct dependency.
- Expo config sets `updates.enabled=false` and
  `updates.checkAutomatically=NEVER`.
- No `updates.url` is configured.
- EAS build profiles contain no update `channel` field.
- `runtimeVersion.policy=fingerprint` remains as a content-free artifact and
  migration-compatibility identity. It is not proof that OTA delivery works.

## Current Recovery Paths

| Incident class                             | Client recovery path                                                                                                                                    |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| JavaScript, asset, or native client defect | halt release/marketing expansion, use an applicable server-side kill switch when reviewed, build and test a new binary, then submit an App Store hotfix |
| Server or database defect                  | contain through the reviewed function, flag, job, or migration recovery path while supported binaries remain compatible                                 |
| Payment or entitlement defect              | freeze affected purchase entry points and use the reviewed RevenueCat/store/backend recovery path                                                       |
| Privacy or data-rights defect              | contain the affected surface, preserve operation evidence, and follow privacy/legal incident review before client release resumes                       |

No incident may select `eas update`, `eas update:rollback`, republish, branch
remapping, or an OTA console action under the current policy.

## Reactivation Gate

EAS Update may be reconsidered only through a new accepted product,
architecture, privacy, and release decision that does all of the following:

1. Installs an Expo-SDK-compatible direct `expo-updates` dependency and records
   dependency/license/security review.
2. Configures a real reviewed project update URL and isolated build-to-channel
   mapping without committing credentials.
3. Defines publisher permissions, code signing, update authenticity, branch
   ownership, and emergency access with named primary and backup owners.
4. Proves runtime selection, launch behavior, asset integrity, migration and
   rollback compatibility, privacy boundaries, and supported-binary policy.
5. Uses a signed staging binary to rehearse publish, adoption, failed update,
   rollback/republish, embedded fallback, and forward-fix paths while retaining
   exact build, update, branch, channel, runtime, source, and signer identities.
6. Adds live adoption/failure monitoring, pre-approved halt thresholds, support
   communication, and an independent recovery signal.
7. Reconciles every architecture, operations, compliance, release, and App
   Review document before enabling the client or adding build channels.

Until every gate passes, a faster client fix means a reviewed App Store binary
hotfix, not an OTA claim.

## Local Audit

Run:

```text
node scripts/optimization/store-only-release-audit.mjs
```

This audit is content-free and read-only. It verifies the repository contract;
it does not substitute for signed-build, App Store, owner, or live incident
evidence.

IOS-11 source and retained-drill verification are separate by design. Run
`node scripts/phase9/ios11-release-containment-contract.mjs --source-check` for
the repository boundary. A completed staging drill must copy the Phase 9
template, retain the underlying content-free receipts, and pass
`--evidence <path> --expected-source-sha <S>` in the governed release-candidate
chain. The source check always reports `ios11Complete: false`; it cannot be used
as hosted or signed-binary evidence.
