# Superseded V1 Scope Freeze

Original date: 2026-07-04
Superseded: 2026-07-12
Status: Superseded; retained only as a compatibility path for existing links

The former smaller cross-platform V1 cutoff is no longer the active launch
scope. The accepted founder directive now requires an iOS-only, all-features
release.

Authoritative replacements:

- `docs/hugeToDo/2026-07-12-ios-all-features-master-plan-update.md`
- `docs/hugeToDo/IOS_ALL_FEATURES_CODEX_EXECUTION_PLAN.md`
- `docs/hugeToDo/launch-contract.json`
- `docs/FEATURE_INDEX.md`

## Current Scope Rule

Every feature ID 1-20 and every required Phase 7/8 surface must be
production-real and enabled in the approved iOS build. No feature can satisfy
scope through a hidden route, environment flag, fixture, preview, simulated
provider response, or inert native target.

Risky features remain fail-closed until their applicable legal/privacy,
clinical/cosmetic, IP, security, live-service, physical-iPhone, operational,
production, and store gates pass. A kill switch remains required for incident
response after the enabled feature has passed its complete launch gate.

Android source code may remain healthy, but Android credentials, builds, device
evidence, Play records, payments, links, performance, beta, and release approval
are not requirements for this release. Google Sign-In remains in scope because
it is an iPhone authentication feature.

The original scope-freeze content remains recoverable from repository history;
it must not be used as a current instruction to defer an indexed feature.
