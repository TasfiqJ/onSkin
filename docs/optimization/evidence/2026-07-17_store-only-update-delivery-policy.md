# OPT-121 Store-Only Update Delivery Policy

Date: 2026-07-17 (America/Toronto)

Parent SHA: `6fbd8f8ea806b85d0ae2ffd46910921f4d5fbe54`

Status: `verified` for the plan's accepted documentation-correction path.

## Outcome

RoutineKind V1 now has one explicit, executable release policy: client
JavaScript, assets, and native/configuration changes ship only in reviewed
store binaries. EAS Build and Submit remain available. EAS Update is not an
installed, configured, advertised, or incident-recovery capability.

Repository enforcement now proves:

- `updates.enabled` is `false` and `checkAutomatically` is `NEVER`;
- the resolved Expo config omits `updates.url`;
- the mobile package has no direct `expo-updates` dependency;
- development, staging, and production EAS build profiles omit `channel`;
- production retains `distribution: store`;
- the fingerprint runtime policy is an artifact/migration identity only;
- Phase 9, Phase 11, security, compliance, architecture, and maintenance
  sources no longer claim an active OTA path;
- native and same-runtime JavaScript incident exercises both select the
  reviewed binary/store hotfix path.

## Decision And Recovery Boundary

`docs/UPDATE_DELIVERY_POLICY.md`, `docs/ARCHITECTURE.md` A-014, and
`docs/DECISIONS.md` accept this launch posture. A client incident freezes store
expansion and uses a reviewed hotfix binary. Matching server, provider, privacy,
or feature-flag containment remains available when it addresses the actual
fault domain.

Future EAS Update adoption is not prohibited, but it requires a new governed
decision plus the policy's seven reactivation gates: compatible dependency and
project configuration, explicit channel/branch ownership, runtime and migration
rules, signed-update/trust review, staged rollout, rollback/forward-fix drills,
prior-runtime tests, live monitoring, and named incident ownership.

## Expo Documentation Cross-Check

Expo's current documentation describes installing `expo-updates` and running
EAS Update configuration before publishing updates. Its debugging guide expects
a direct package, an `updates.url`, and a runtime version in a configured app.
The app-config reference states that `updates.enabled=false` loads only the code
and assets embedded in the binary. The repository now matches that disabled,
store-bundled state:

- [EAS Update introduction](https://docs.expo.dev/eas-update/introduction/)
- [Debugging EAS Update](https://docs.expo.dev/eas-update/debug/)
- [Expo app configuration: updates](https://docs.expo.dev/versions/v57.0.0/config/app/)

## Verification

- Node syntax checks for the new audit, maintenance exercise, and updated Phase
  9/11 gates: PASS.
- `node scripts/optimization/store-only-release-audit.mjs --json`: PASS for all
  three profiles, disabled updates, absent URL/direct dependency/channel,
  maintenance policy, decision source, and architecture source.
- `node scripts/optimization/store-only-release-audit-smoke.mjs`: PASS; enabled
  updates, an update URL, direct dependency, EAS channel, and maintenance-policy
  drift each fail closed.
- `node scripts/optimization/maintenance-incident-exercise-smoke.mjs`: PASS;
  native and compatible-JS client incidents use binary recovery, privacy uses
  containment, and unreviewed policy drift is rejected.
- Resolved development Expo config: PASS with updates disabled, automatic check
  `NEVER`, no update URL, and fingerprint runtime policy.
- Focused mobile verification: 2 files / 2 tests PASS.
- Full root tests: 329 files / 3,967 tests PASS.
- Root typecheck: 2 workspaces PASS.
- Root lint: 2 workspaces PASS with zero warnings.

This item changes configuration, release controls, tests, and documentation; it
does not change a user-visible route. Human-simulated UI E2E is therefore not an
applicable proof for OPT-121. Signed candidate inspection remains a Phase 9/11
release gate rather than a prerequisite for the plan's explicit documentation-
correction acceptance path.

## Files

- `apps/mobile/app.base.json`
- `apps/mobile/eas.json`
- `docs/UPDATE_DELIVERY_POLICY.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `scripts/optimization/store-only-release-audit.mjs`
- `scripts/optimization/store-only-release-audit-smoke.mjs`
- `scripts/phase9/store-build-inspect.mjs`
- `scripts/phase9/release-smoke.mjs`
- `scripts/phase11/launch-readiness.mjs`
- `apps/mobile/src/lib/storeOnlyReleasePolicy.test.ts`
