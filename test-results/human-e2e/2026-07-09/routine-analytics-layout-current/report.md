# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-09
- Codex task: Routine analytics contract plus supported-floor compact layout verification
- App surface: Expo web through Codex in-app browser
- Build/start command: `npm --workspace apps/mobile run web -- --port 8255`
- Browser/device/simulator/OS: Codex in-app browser, explicit viewport override
- Feature or PR tested: routine activation analytics, device support floor, direct-entry compact layouts
- Overall verdict: Pass

## Tool Inventory

- Expo CLI: running on port 8255
- iOS Simulator: not used
- Android emulator: not used
- Expo web: used
- Playwright: used through the in-app browser wrapper
- Playwright MCP: not used separately
- Codex Computer Use: not used
- Other: Node REPL browser control

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| Today | 390 x 844 modern phone | Pass | `23-combined-final-today-390x844.jpg` / JSON | No overflow, clipped controls, blocked centers, or unexpected logs. |
| Today | 320 x 480 support floor | Pass | `24-combined-final-today-320x480-floor.jpg` / JSON | Launch-floor viewport from `docs/DEVICE_SUPPORT_POLICY.md`. |
| Settings Privacy | 390 x 844 direct entry | Pass after fix | `25-combined-final-settings-privacy-390x844.jpg` / JSON | Initial policy-row peek fixed. |
| Settings Privacy | 320 x 480 support floor | Pass after fix | `26-combined-final-settings-privacy-320x480-floor.jpg` / JSON | Initial marketing-switch clipping fixed. |
| Recommendation Preferences | 390 x 844 | Pass | `27-combined-final-recommendations-preferences-390x844.jpg` / JSON | Toggle/chip layout stayed complete. |
| Shelf Scan | 320 x 480 support floor | Pass | `28-combined-final-shelf-scan-320x480-floor.jpg` / JSON | Camera-unavailable fallback stayed clear. |
| Shelf No Match | 320 x 480 support floor | Pass | `29-combined-final-shelf-no-match-320x480-floor.jpg` / JSON | Recovery rows stayed complete. |
| Routine Plan | 390 x 844 | Pass | `30-combined-final-routine-plan-390x844.jpg` / JSON | No user-facing geometry issues. |
| Skin Notes Community | 390 x 844 modern phone | Pass after fix | `31-combined-final-community-390x844.jpg` / JSON | Initial sunscreen-row partial target fixed. |
| Skin Notes Community | 320 x 480 support floor | Pass after fix | `32-combined-final-community-320x480-floor.jpg` / JSON | Initial sensitive-skin card bottom clipping fixed. |

## Bugs Found

| ID | Severity | Reproduction | Expected | Actual | Evidence |
| -- | -------- | ------------ | -------- | ------ | -------- |
| 2026-07-09-settings-privacy-support-floor-direct-entry | Medium | Open `/settings/privacy` at 390 x 844 and 320 x 480 | Direct-entry privacy controls complete and clear of the floating tab bar | 390 x 844 policy row peeked under the tab bar; 320 x 480 marketing switch clipped above the viewport | `03-settings-privacy-390x844.json`, `04-settings-privacy-320x480-floor.json` |

## Tests Added or Updated

- Test file: none for this UI-only route geometry fix.
- What it covers: human-simulated route geometry and screenshots.
- Why this should be automated: a future durable Expo web/Playwright route-audit harness should enforce the support-floor route set.

## Commands Run

```bash
npm run phase5:check-native-config
```

## Remaining Risk

- Untested flows: native iOS/Android Dynamic Type, VoiceOver/TalkBack, keyboard state, camera hardware, and safe-area combinations.
- Missing fixtures: physical iOS 17+ and Android 10+ devices.
- Flaky areas: browser dev logs include stale logs from older ports unless filtered to the current origin.
- Manual follow-up needed: Phase 5 native device QA remains required before public launch readiness.
