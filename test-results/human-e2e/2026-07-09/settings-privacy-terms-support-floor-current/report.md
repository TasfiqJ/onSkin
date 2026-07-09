# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-09
- Codex task: Settings Privacy policy-row support-floor verification
- App surface: Expo web in Codex in-app browser
- Build/start command: `npm --workspace apps/mobile run web -- --port 8264`
- Browser/device/simulator/OS: in-app browser, 320 x 480 support floor and 390 x 844 modern phone viewports
- Feature tested: `/settings/privacy` direct entry and Terms policy-row recovery
- Overall verdict: Pass

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| Settings Privacy direct entry | 320 x 480 support floor | Pass | `320x480-terms-visible.png`, `geometry-summary.json` | Route resolved to `/you?section=privacy`; Terms was a single 232 x 55 px button, complete above the floating tab bar, with center hit-test passing. |
| Settings Privacy Terms link | Unavailable policy URL | Pass | `320x480-after-terms-click.png`, `geometry-summary.json` | Tapping Terms kept the route in-app, rendered `Link unavailable`, opened no dialog, and kept horizontal overflow at zero. |
| Settings Privacy direct entry | 390 x 844 modern phone | Pass | `390x844-initial.png`, `geometry-summary.json` | Visible privacy controls were complete and hit-testable above the floating tab bar. |

## Bugs Found

None.

## Tests Added or Updated

- `apps/mobile/src/features/settings/settingsRoutes.test.ts`: guards the Terms direct-entry policy spacer.

## Commands Run

```bash
npm --workspace apps/mobile run test -- src/features/settings/settingsRoutes.test.ts
npm --workspace apps/mobile run web -- --port 8264
```

## Remaining Risk

- Native iOS/Android safe-area, screen-reader, and real external policy-link handoff remain device/release QA.
