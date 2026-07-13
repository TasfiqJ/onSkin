# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-13
- Codex task: OPT-118 request deadlines, cancellation, and retry taxonomy
- App surface: Expo web
- Build/start command: `EXPO_PUBLIC_E2E_CATALOG_SEARCH_RESULT=no_match EXPO_PUBLIC_E2E_CATALOG_SEARCH_DELAY_MS=1500 npm --workspace apps/mobile run web -- --port 8255`
- Browser/device/simulator/OS: Codex in-app browser on Windows, 390 x 844 viewport override (reported CSS viewport 390 x 845)
- Feature tested: Catalog no-match search, pending-request route cancellation, and recovery
- Overall verdict: Pass for Expo web-compatible behavior

## Tool Inventory

- Expo CLI: Available; local Metro web build completed
- iOS Simulator: Not available on this Windows host
- Android emulator: Not used
- Expo web: Available at `http://localhost:8255`
- Codex in-app browser: Used
- External services: Supabase intentionally unconfigured; dev-only local catalog fixtures used
- Destructive actions: None

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| Catalog search | No match | Pass | `catalog-no-match-happy.png` | Visible no-match copy, Report missing product, and Add by hand; zero horizontal overflow; controls were 48-55.99 px tall. |
| Catalog search | Leave during delayed request | Pass | `catalog-search-after-cancel.png`, `browser-observations.json` | DOM snapshot confirmed Search disabled while pending; Back navigated to `/shelf`; waiting beyond the 1.5 s fixture delay did not publish stale results or navigate back. |
| Catalog search | Re-enter after cancellation | Pass | `catalog-search-recovery.png` | A fresh direct entry completed normally, Search re-enabled, no-match state returned, and horizontal overflow remained zero. |

## Bugs Found

None in the exercised Expo web flow.

## Tests Added Or Updated

- `src/lib/network/requestPolicy.test.ts`: typed failure matrix, deadlines, retry limits, jitter, `Retry-After`, response bounds, cancellation, and owner-generation aborts.
- `src/lib/network/edgeFunctions.test.ts`: complete Edge endpoint policy inventory plus idempotent/non-idempotent invocation behavior.
- `src/features/catalog/client.test.ts`: delayed dev search aborts without publishing or tracking a result.
- Existing Shelf route contracts were rerun.

## Browser Observations

- Happy-path URL: `/shelf/search?e2eQuery=ceramide`
- Cancellation destination after waiting beyond the delayed response: `/shelf`
- Recovery URL: `/shelf/search?e2eQuery=recovery`
- Horizontal overflow: 0 px on happy and recovery states
- Expected environment warnings only: placeholder Supabase URL/key and Expo notification-listener web limitation
- Unexpected browser errors: none

## Remaining Risk

- Expo web proves route cancellation and state recovery, not native camera interruption.
- Barcode lookup cancellation on iOS/Android camera blur still requires simulator/device evidence.
- Live timeout, rate-limit, and `Retry-After` behavior requires a controlled backend/network failure matrix.
- Native Dynamic Type, VoiceOver/TalkBack, and physical-device network transitions remain external QA gates.
