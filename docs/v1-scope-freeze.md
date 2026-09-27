# Superseded V1 Scope Freeze

> Active scope (2026-09-27): iOS lean V1 supersedes earlier all-features launch requirements. Required feature IDs: 1, 2, 3, 5, 6, 7, 8, 9, 10, 11. See `docs/hugeToDo/IOS_LEAN_V1_EXECUTION_PLAN.md` and `docs/hugeToDo/launch-contract.json`. Manual Shelf/local ingredient parsing, reviewed guidance, routine/cycle, Today, private Progress, local reminders and standard subscriptions remain required. Catalog/search/barcode, custom grants/reverse trial/win-back, recommendations, Ask, public sharing, commerce, community, trends, widgets and growth experiments are post-launch and must stay closed. Existing Apple/email account functionality and all current privacy, payment, persistence, accessibility and owner-isolation safeguards are preserved. Historical sections below do not add deferred features back to the V1 launch gate.


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
