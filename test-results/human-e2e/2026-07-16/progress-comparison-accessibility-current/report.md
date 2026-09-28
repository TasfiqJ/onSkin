# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-16
- Codex task: `OPT-203` comparison accessibility actions and non-gesture presentation
- App surface: Expo web in the Codex in-app browser
- Build/start command: `EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro EXPO_PUBLIC_E2E_PROGRESS_PHOTOS=populated EXPO_PUBLIC_E2E_APP_LOCK_ENABLED=disabled npm --workspace apps/mobile run web -- --port 8291 --host localhost --clear`
- Browser/device/simulator/OS: in-app browser, Windows host, 1281 x 720 rendered viewport
- Feature tested: populated Progress comparison
- Overall verdict: Pass for the implemented web-compatible semantics and interaction path; native VoiceOver/TalkBack verification remains open

The browser runtime available to this task did not expose device emulation, so
this is an actual Expo-web semantic/interaction pass at desktop width rather
than new supported-phone or physical-iPhone evidence. Existing supported-phone
Progress layout evidence remains applicable because the visual layout contract
did not change, but it does not substitute for the open native screen-reader
pass.

## Tool Inventory

- Expo CLI: available and used
- iOS Simulator: not available in this Windows task
- Android emulator: not used; Android is outside the current release contract
- Expo web: available and used
- Codex in-app browser: available and used
- External services: none; local Supabase placeholders only
- Destructive actions: none

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| Open populated Progress | Happy path | Pass | `draggable-comparison.jpg`; `accessibility-snapshot.txt` | Compare rendered with local fixture data and no diagnostic/score claim. |
| Inspect comparison divider | Accessibility semantics | Pass after fixes | `accessibility-snapshot.txt`; `geometry.json` | One date-aware slider exposed min 0, max 100, now 52, and `52 percent of the before photo visible`. |
| Use Side-by-side | Non-gesture alternative | Pass | `side-by-side-comparison.jpg`; `accessibility-snapshot.txt` | The named button removed the slider, rendered both selected photos, and changed its name to `Use draggable comparison`. |
| Change first photo | Existing comparison branch | Pass | `accessibility-snapshot.txt` | The named first-photo dialog opened; choosing May 12 closed it and updated the date control. |
| Measure semantic target | Accessibility geometry | Pass after fix | `geometry.json` | Final semantic slider target measured about 46 x 46 px and the page had zero horizontal overflow. |

## Bugs Found And Fixed

- `docs/e2e-bug-reports/2026-07-16-progress-comparison-accessibility-semantics.md`
  records two related defects found in this run: Reanimated's web wrapper did
  not publish the range value attributes, and the first stable inner semantic
  view occupied only about 46 x 24 px. Explicit ARIA range aliases plus a
  full-size inner target corrected both without changing the gesture surface.

## Tests Added Or Updated

- `src/features/photos/compareAccessibility.test.ts`: deterministic 10% steps,
  clamping, invalid-value fallback, and non-judgmental spoken text.
- `src/features/photos/progressRoutes.test.ts`: adjustable range semantics,
  actions, full-size semantic target, and named non-gesture presentation.

## Commands Run

```text
npm.cmd --workspace @layerwell/mobile test -- --run \
  src/features/photos/compareAccessibility.test.ts \
  src/features/photos/progressRoutes.test.ts
2 files / 25 tests PASS

npm.cmd run typecheck
2 workspaces PASS

npm.cmd run lint
2 workspaces PASS, zero warnings

npm.cmd test
317 files / 3,928 tests PASS
```

## Remaining Risk

- Native VoiceOver increment/decrement action invocation and focus announcements
  still require a supported physical iPhone or iOS Simulator with assistive
  technology; Expo web cannot prove them.
- Native TalkBack remains useful non-release resilience evidence if Android
  scope returns, but Android is not part of the accepted V1 launch contract.
- The browser backend could not emulate the 375 x 667 support-floor viewport in
  this run. Existing populated Progress supported-phone evidence remains, but a
  future native screen-reader pass should also recheck the full 46 pt target.
