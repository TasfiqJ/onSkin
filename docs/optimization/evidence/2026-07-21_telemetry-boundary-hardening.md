# Telemetry Boundary Hardening Checkpoint

Date: 2026-07-21

Scope: local PostHog/Sentry privacy, schema, source-ownership, and exact-release recovery gates. This checkpoint does not claim live provider, dashboard, signed-build, or physical-device evidence.

## Implemented

- Every registered analytics event has an exact per-event schema and at least one valid production emission.
- Runtime capture rejects unknown keys, no-property payloads, malformed values, impossible discriminant pairs, and event-specific invalid counts without falling back to a bare event.
- Ingredient parse status/count, barcode match/result, shipped Ask kinds, routine source, support source/dimensions, paywall, screen, share, and streak payload relationships are fail-closed.
- The AST source audit rejects dynamic or suppressed event payloads, unsafe nonliteral enum/undefined types, malformed/overlapping shape tables, mutable or unguarded prepared payloads, tracker/vendor escapes, and fake capture decoys.
- Sentry initializes with one exact privacy configuration. The wrapper passes only sanitizer outputs to the SDK and strips raw messages, functions, modules, paths, contexts, requests, breadcrumbs, transactions, and arbitrary user/tag/extra data.
- Captured error stacks retain only fixed generated-bundle path/line/column tokens when supplied as own data properties. Event frames retain no function or module names. Revoked arrays and hostile descriptors fail closed.
- Recovery verification validates release, dist, event IDs, binary UUID inventory, Hermes debug ID, time bounds, and fetch implementation before contacting Sentry. A successful provider result returns the exact binary UUID and Hermes debug-ID inventory, which the release-artifact contract compares with direct artifact inspection.

## Automated Evidence

- Mobile TypeScript check: passed.
- Focused telemetry and affected contract tests: 11 files, 135 tests passed.
- Analytics source-audit smoke: one positive matrix and 36 negative fixtures passed.
- Sentry source-audit smoke: one positive and 14 negative fixtures passed.
- Sentry recovery smoke: one positive and 25 negative cases passed.
- Release-artifact contract smoke: one positive and 24 negative cases passed.
- Phase 9 privacy payload code gate: passed; live payload evidence warning remains.
- Root TypeScript check: two workspaces passed.
- Targeted lint for all affected mobile TypeScript/TSX files: passed with zero warnings.
- Full repository test run: 4,108 of 4,112 tests passed. The four remaining failures are isolated to pre-existing dirty-worktree expiry-provenance changes (`behaviouralSnapshot.test.ts` and three `useShelf.test.ts` assertions); telemetry, observability, Ask, settings, paywall, onboarding, and growth tests pass.

## External Evidence Still Required

- Live PostHog and Sentry payload samples from the exact release candidate.
- Distinct live JavaScript and native Sentry recovery events for the inspected signed build.
- Provider dashboard links, ownership, retention, and release-health signoff.
- Signed artifact and physical-device performance/privacy evidence required elsewhere in the optimization plan.
