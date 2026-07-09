# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-09
- Codex task: Verify current support-floor layout follow-up changes before committing.
- App surface: Expo web through the Codex in-app browser.
- Build/start command: `npm --workspace apps/mobile run web -- --port 8255`
- Browser/device/simulator/OS: Codex in-app browser, 320 x 480 and 390 x 844 viewport overrides.
- Feature or PR tested: `/community`, `/settings/privacy`, `/settings/notifications`, and `/shelf/manual`.
- Overall verdict: Pass

## Tool Inventory

- Expo CLI: Used through `npm --workspace apps/mobile run web -- --port 8255`.
- iOS Simulator: Not used.
- Android emulator: Not used.
- Expo web: Used.
- Playwright: Used through the in-app browser runtime.
- Playwright MCP: Not used as a standalone harness.
- Codex Computer Use: Not used.

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| Skin Notes community hub | 320 x 480 and 390 x 844 support-floor/modern viewports | Pass | `floor-320x480-community.png`, `modern-390x844-community.png`, matching JSON files | No visible clipped controls, sub-44 controls, blocked center hits, or horizontal overflow. |
| Settings privacy direct entry | `/settings/privacy` redirect into `/you?section=privacy` | Pass | `floor-320x480-settings-privacy.png`, `modern-390x844-settings-privacy.png`, matching JSON files | Direct entry resolves to the You privacy section with complete visible controls. |
| Notification settings | 320 x 480 and 390 x 844 support-floor/modern viewports | Pass | `floor-320x480-settings-notifications.png`, `modern-390x844-settings-notifications.png`, matching JSON files | Promotional section spacing keeps visible controls complete. |
| Shelf manual add | 320 x 480 and 390 x 844 support-floor/modern viewports | Pass | `floor-320x480-shelf-manual.png`, `modern-390x844-shelf-manual.png`, matching JSON files | Ingredients stays below the first viewport on compact phones instead of peeking under the fixed Continue footer. |

## Bugs Found

None in this follow-up pass.

## Tests Added or Updated

- `apps/mobile/src/features/community/communityRoutes.test.ts`
- `apps/mobile/src/features/settings/settingsRoutes.test.ts`
- `apps/mobile/src/features/shelf/shelfRoutes.test.ts`

The tests lock the route-local spacing thresholds used by the verified support-floor layouts.

## Commands Run

```bash
npm --workspace apps/mobile run test -- communityRoutes settingsRoutes shelfRoutes
npm --workspace apps/mobile run web -- --port 8255
```

## Remaining Risk

- Untested flows: Native iOS/Android safe-area, Dynamic Type, keyboard, screen-reader traversal, native camera behavior, and live notification scheduling.
- Missing fixtures: Native simulator/device fixtures for privacy/settings and manual shelf form keyboard pressure.
- Flaky areas: Browser DOM snapshot API was unavailable in this in-app browser session, so evidence uses screenshots plus bounded read-only DOM geometry.
- Manual follow-up needed: Native device QA before clearing the relevant launch gates.
