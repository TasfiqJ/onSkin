# Shelf scanner terminal-session human-simulated E2E

Date: 2026-07-25
Surface: Expo web `/shelf/scan`
Fixture: `EXPO_PUBLIC_E2E_SHELF_SCAN_RESULT=no_match`, barcode `012345678905`

## Acceptance result

Pass for the web-compatible terminal and recovery behavior.

- Terminal copy and exactly one `Scan again` action remained present 2.8 seconds after load, beyond the former 1.8-second duplicate window.
- The action measured 49.94 px high at both requested supported-phone viewports.
- Clicking it removed the terminal result and recovery action, restored the idle surface, and retained the same route.
- Terminal states hide the idle-only scanner guidance; the first-pass 390 x 844 overlap was fixed and reverified.
- Both viewports had equal document/client width and no horizontal overflow.
- OCR, catalog search, manual entry, and no-match reporting remained reachable.
- The denser matched fixture passed at both viewports: Add this, Wrong, Scan again, and all three fallback controls were completely in the viewport and center-hit-testable.
- The matched result exposed a concise `Catalog match: RoutineKind Fixture Mineral SPF 50. Scanner paused.` alert label, remained stable for 2.8 seconds, and reset in place.
- No scanner-route browser error occurred. Recorded warnings are the expected missing local Supabase configuration and Expo notification-listener limitation on web.

The in-app browser reported 376 x 668 after the 375 x 667 override and 390 x 845 after the 390 x 844 override; this one-pixel browser-host adjustment is recorded in `metrics.json`.

## Artifacts

- `terminal-375x667.png`
- `reset-375x667.png`
- `terminal-390x844.png`
- `reset-390x844.png`
- `metrics.json`
- `browser-logs.json`
- `matched-terminal-375x667.png`
- `matched-terminal-390x844.png`
- `matched-reset-390x844.png`
- `matched-metrics.json`
- `matched-browser-logs.json`

## Native limitation

Web fixtures do not prove physical camera callback count, torch lifecycle, focus/background interruption, or native presentation. Those remain signed supported-iOS acceptance work and are not inferred from this pass.
