# Phase 9 Rollout And Rollback Plan

## Freeze Rules

Once an RC is under QA, do not add SDKs, permissions, migrations, store claims, catalog imports, or unrelated refactors without release manager approval.

## Rollout

1. Build production-profile iOS and Android artifacts from the frozen SHA.
2. Install internal TestFlight and Play internal/closed builds.
3. Run smoke, data rights, payments, RLS, Edge auth, observability, accessibility, and device QA.
4. Promote only after no P0/P1 issues remain.
5. Monitor the first 24, 48, and 72 hours before scaling paid growth.

## Halt Criteria

Stop rollout or marketing if deletion/export fails, restore/purchase fails, entitlement mirrors drift, sensitive data appears in logs/analytics/crash reports, RLS/Edge auth fails, crash-free metrics drop below the packet threshold, store review flags privacy/health/subscription claims, or support volume is dominated by billing/deletion/privacy confusion.

## Recovery Paths

- OTA rollback: JavaScript/content-only regressions within the same runtimeVersion.
- New binary: native/plugin/permission/runtimeVersion/config changes.
- Server flag disable: risky backend or feature-gated surfaces.
- RevenueCat pause: stop processing webhook grants only with finance/engineering approval and a reconciliation plan.
- Store halt: Apple phased release pause or Google staged rollout halt for updates.

Every RC packet must name the release manager, hotfix owner, support owner, privacy owner, and the people allowed to publish EAS Update or store builds.
