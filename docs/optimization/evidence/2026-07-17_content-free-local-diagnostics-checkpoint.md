# Content-Free Local Diagnostics Checkpoint

Date: 2026-07-17

Branch: `optimization`

Checkpoint parent: `b140786bf1bf18f6f2abedad07c24ea5824ef8f2`

Item: `OPT-208`

## Invariant

Local diagnostics must remain a development tool, not a new telemetry or data-export surface. It may expose only a fixed, versioned allowlist of build metadata, broad health enums, bounded counts, coarse storage state, timestamps, and aggregates. It must never render, serialize, upload, or log keys, tokens, complete account identifiers, filenames/paths, record values, search text, raw query keys, photo identifiers, operation identifiers, or source errors.

## Implementation

- Added a direct `/settings/diagnostics` route and development-only Help entry on You.
- Gated both surfaces on `__DEV__` plus the exact `development` or `staging` app environment. A non-development bundle redirects direct route entry to You.
- Added fixed schema v1 with domain-specific version sanitizers, exact enum allowlists, non-negative bounded counts, bounded timing values, exact ISO timestamps, coarse free-space classes, and an eight-hex SHA-256 account-generation prefix or safe absence/unavailability.
- Added isolated adapters for build/symbol state, vault and App Lock state, the explicitly labeled legacy completion queue, in-memory last-sync outcome, photo mutation-journal count, native free-space class input, TanStack Query counts, notification permission/schedule health, catalog gateway reachability, and bounded operation-timing aggregates.
- Kept the gateway probe unauthenticated and payload-free. It sends only `HEAD` to the configured function endpoint with a 2.5-second abort.
- Bounded every diagnostics source to three seconds. A thrown or never-settling dependency becomes only its field's fixed fallback; late work cannot publish into an obsolete refresh.
- Added latest-request and unmount fences. Refresh replaces one snapshot rather than accumulating history.
- Added a development-only all-source failure fixture for the required real-surface drill.
- Added content-free sync status and aggregate readers without changing the existing completion-flush API or exposing raw operation samples.
- Added count-only photo-journal and notification-schedule health readers; neither returns record content, identifiers, schedule contents, paths, or errors.

## Security Review

The implemented data flow is local UI only. There is no share, copy, export, persistence, analytics, logging, or upload action in the diagnostics route.

The review checked these boundaries:

1. **Activation:** production bundles fail the `__DEV__` gate even if an environment value is misconfigured. Development-compiled production environments also fail closed.
2. **Identifiers:** the only account correlation value is a generation-bound SHA-256 digest truncated to eight lowercase hex characters. The complete user ID and generation never cross the adapter.
3. **Strings:** release, build, and runtime values use separate strict patterns and a 64-character ceiling. Arbitrary source strings become `unknown`.
4. **Storage:** exact bytes become only `critical`, `low`, `ample`, or `unavailable`. Web does not access Expo's unsupported native getter.
5. **Queries and records:** only query counts and the photo journal's 0/1 pending count cross their adapters. Query keys, cached data, photo metadata, paths, and operation IDs do not.
6. **Errors:** source exceptions are caught without reading or serializing their messages. The fixed failure fixture's raw error is absent from the rendered snapshot.
7. **Network:** catalog health sends no auth header, account value, product value, barcode, search text, or request body.
8. **Failure containment:** thrown and never-settling sources resolve to fixed fallbacks; a source cannot block the complete snapshot indefinitely.

The residual eight-hex prefix is intentionally diagnostic correlation, not an authentication value, durable identifier, or cross-generation account ID. Its availability remains restricted to development/staging builds.

## Deterministic Evidence

```text
npm.cmd --workspace apps/mobile test -- \
  src/lib/diagnostics/localDiagnostics.test.ts \
  src/lib/observability/operationTiming.test.ts \
  src/lib/offline/completionQueue.test.ts \
  src/features/notifications/deliver.test.ts
4 files / 72 tests PASS

npm.cmd test
324 files / 3,960 tests PASS

npm.cmd run typecheck
2 workspaces PASS

npm.cmd run lint
2 workspaces PASS, zero warnings
```

The focused suite proves the exact access policy, allowlisted healthy snapshot, arbitrary-private-value sanitization, all-source exception fallback, never-settling-source timeout, broad storage classes, bounded timing aggregates, content-free sync status, and notification schedule health behavior.

## Human-Simulated E2E And Failure Drill

Actual Expo web exercised three bundle states:

- A development build at configured 390 x 844 rendered the complete healthy snapshot. Refresh updated the capture timestamp, Back navigated to `/you`, the You entry navigated back to diagnostics, and there was no horizontal overflow or diagnostics-source warning/error.
- A development build at configured 375 x 667 forced every diagnostics dependency to throw. The route remained usable, rendered only fixed safe fallbacks, refreshed without crashing, and did not expose the deliberate raw error.
- A `--no-dev --minify` build at configured 390 x 844 redirected direct `/settings/diagnostics` entry to `/you`; neither the diagnostics content nor the You entry was present.

Evidence:

- `test-results/human-e2e/2026-07-17/local-diagnostics-healthy-current/`
- `test-results/human-e2e/2026-07-17/local-diagnostics-failure-drill-current/`
- `test-results/human-e2e/2026-07-17/local-diagnostics-production-gate-current/`
- `docs/e2e-bug-reports/2026-07-17-local-diagnostics-web-storage-warning.md`

The first healthy route audit found Expo's web-only unsupported free-space getter warning. The runtime adapter now checks the platform before accessing that getter, and the same-surface rerun passed without it.

## Result And Remaining Verification

`OPT-208` is implemented locally with the plan-required security review and failure drill. Release verification remains open for supported-iOS device evidence of native free space, build/runtime metadata, notification schedule comparison, vault/App Lock state, safe areas, VoiceOver order, and interrupted protected-storage reads. No native result is inferred from Expo web.

## Rollback Trigger

Rollback or repair if the route or link appears in a production bundle; a schema field accepts arbitrary strings or unbounded values; raw identifiers, keys, query keys, records, paths, errors, or network payloads cross an adapter; a source can block the screen indefinitely; refresh publishes an obsolete result; the gateway probe adds authentication or user/product data; or diagnostics become remotely persisted, uploaded, copied, shared, or logged without a new privacy review.
