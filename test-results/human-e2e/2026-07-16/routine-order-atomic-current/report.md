# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-16 (America/Toronto)
- Codex task: Maximum React Native optimization plan, PERF-P0-005 / OPT-007 routine-order atomic phase patch
- App surface: Expo web, supported-phone responsive implementation surface
- Build/start command: PowerShell `$env:EXPO_PUBLIC_E2E_ENTITLEMENT='store_pro'`, then `npm --workspace @layerwell/mobile run web -- --port 8290 --host localhost --clear`
- Browser/device/simulator/OS: Codex in-app browser on Windows, explicit 390 x 844 phone viewport (reported CSS viewport 390 x 845)
- Feature tested: populated `/routine/reorder` save, route exit, direct reload, and independent AM/PM persistence
- Overall verdict: Pass

## Test State

- Local-only development entitlement fixture: `store_pro`
- Local fixture products added through the visible manual Shelf flow:
  - `E2E Cream Cleanser`
  - `E2E Ceramide Moisturizer`
- External services: none; Supabase remained on the documented local placeholder configuration.
- Destructive external actions: none.

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| --- | --- | --- | --- | --- |
| Open routine editor | Populated private Shelf state | Pass | `browser-audit.json` | Rendered the real `Routine order` editor, not the example path. |
| Edit Morning | Move cleanser from step 1 to step 2 | Pass | Browser DOM observations; `phase-state.json` | Morning draft changed while Evening was inspected and deliberately left canonical. |
| Save | Await encrypted save and leave route | Pass | Browser interaction; Today DOM observation | Save returned to `/today`; the Morning routine immediately rendered moisturizer then cleanser. |
| Relaunch-compatible read | Directly reopen `/routine/reorder` | Pass | `phase-state.json` | Morning reloaded as moisturizer step 1, cleanser step 2. |
| Independent phase | Inspect Evening after reload | Pass | `phase-state.json` | Evening remained cleanser step 1, moisturizer step 2; the untouched phase was not overwritten. |
| Responsive/accessibility | Supported phone geometry and roles | Pass | `browser-audit.json` | 390 px client/scroll width, zero horizontal overflow, exposed controls 48-56 px tall, phase tabs retained selected state, zero dialogs. |
| Browser diagnostics | Warning/error and JS-dialog inspection | Pass | `browser-warn-error-logs.json`; `browser-audit.json` | Captured browser warning/error buffer was empty and no JavaScript dialog was present. The Expo terminal emitted only the expected local Supabase-placeholder and web-notification warnings. |

## Bugs Found

None during the post-change pass.

The in-app browser screenshot backend returned blank PNG buffers during this run. Those invalid captures were removed during evidence QA and are not cited as proof. The retained evidence is the structured browser UI/geometry audit, exact post-reload phase state, warning/error log, command transcripts, and automated test results.

## Tests Added Or Updated

- `apps/mobile/src/features/routine/orderStore.test.ts`
  - preserves the latest AM and PM values across 100 simultaneous phase patches;
  - rejects malformed write patches before invoking private storage;
  - proves semantically identical current patches produce zero persisted writes;
  - preserves exact prior bytes on rejected input.
- `apps/mobile/src/features/routine/orderRoutes.test.ts`
  - keeps the route save ordering contract aligned with phase-patch persistence.

## Commands Run

```text
npm --workspace @layerwell/mobile test -- --run src/features/routine/orderStore.test.ts src/features/routine/orderRoutes.test.ts src/features/routine/usePlan.test.ts src/lib/storage/privateKV.test.ts
# PASS: 4 files / 92 tests

npm run typecheck
# PASS: 2 workspaces

npm run lint
# PASS: 2 workspaces, zero warnings

npm test
# PASS: 316 files / 3,895 tests

npm run e2e:human:manifest:check
# EXPECTED EXISTING FAIL: the committed generated manifest predates a broad
# set of already-committed source/evidence changes. The user-owned dirty
# generated manifest outputs were preserved and not regenerated in this slice.
```

## Remaining Risk

- Expo web proves the route contract and local encrypted-store behavior visible to this compatible surface; it does not approve native Keychain/Keystore interruption or process-death behavior.
- The 100-writer automated case composes the routine store with the already-tested private-KV serializer. A physical-device deliberately hung-write matrix remains required by PERF-P0-005.
- The broader transactional outbox and generic Shelf operation-identity work remain tracked separately.
- The repository-wide human-E2E manifest remains stale across many earlier committed changes; this slice does not claim that launch-wide manifest gate.
