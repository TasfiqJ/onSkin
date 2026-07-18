# Recommendation Preferences Outbox Status E2E — 2026-07-18

## Surface

- App: actual Expo web development builds
- Browser: Codex in-app browser
- Requested viewport: 390 x 844
- Observed viewport: 390 x 845
- Route: `/recommendations/preferences`
- Fixtures: saved-local, syncing, and needs-attention recommendation outbox states

## Results

- `Saved locally` rendered as one polite live status with no alert or progress bar.
- Tapping `Vegan` changed `aria-selected` from `false` to `true`; it remained `true` after a full reload.
- `Syncing recommendation choices` rendered as one named progress bar and one polite live status.
- `Recommendation sync needs attention` rendered as one alert and one enabled 308.37 x 55.99 px `Try sync again` button. Activating it produced no JavaScript dialog.
- Every fully visible Back/value control measured 48 px high. No visible control was below 44 px or failed its center hit test.
- Every post-fix fixture had zero horizontal overflow and zero partial controls.

The fixture retry interaction proves presentation and control behavior only. Actual current-owner dead-row retry is exercised through the runtime outbox test in `apps/mobile/src/lib/offline/outbox.test.ts`.

## Bug Found And Fixed

The initial syncing fixture exposed the top 4 px of the 48 px budget controls at the viewport bottom (`top=841.82`, `bottom=889.82`). The status leaf now reserves an additional bottom margin, placing those controls wholly below the fold. The post-fix rerun reports zero partial controls. See `docs/e2e-bug-reports/2026-07-18-recommendation-sync-status-partial-controls.md`.

## Evidence

- `saved-local-postfix-390x844.png`
- `preference-edited-postfix-390x844.png`
- `preference-after-reload-postfix-390x844.png`
- `syncing-390x844.png` (pre-fix bug)
- `syncing-postfix-390x844.png`
- `needs-attention-390x844.png`
- `needs-attention-after-retry-390x844.png`
- `metrics.json`
- `browser-warnings.md`

## Evidence Boundary

This run proves supported-phone web presentation, accessibility naming, touch geometry, local edit/reload persistence, and retry-control interaction. It does not prove signed-native process-kill recovery, protected-storage interruption, physical account switching, offline/reconnect behavior, concurrent native workers, or hosted RPC replay/RLS.
