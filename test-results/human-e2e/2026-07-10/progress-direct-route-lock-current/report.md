# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-10
- Codex task: close direct-route Progress app-lock bypass
- App surface: Expo web development build
- Build/start command: `npm --workspace apps/mobile run web -- --port 8155` and `--port 8156`
- Browser/device/simulator/OS: Google Chrome 150.0.7871.101, Playwright 1.61.1, Windows; 360 x 640 and 390 x 844
- Feature or PR tested: shared photo-timeline lock for Progress tab, capture, review, and detail
- Overall verdict: Pass

## Tool Inventory

- Expo CLI: available and used
- iOS Simulator: not available in this Windows run
- Android emulator: not used; physical/native prompt behavior remains Tas QA
- Expo web: used
- Playwright: bundled runtime 1.61.1 used against system Chrome
- Codex Computer Use: not needed

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| Cold direct entry | Progress tab locked | Pass | `progress-tab-*.png/json` | One 52 px Unlock; no timeline metadata |
| Cold direct entry | Capture locked | Pass | `capture-*.png/json` | Camera/consent content did not mount visibly |
| Cold direct entry | Review with captured URI locked | Pass | `review-*.png/json` | Captured review image/copy stayed hidden |
| Cold direct entry | Populated photo detail locked | Pass | `detail-*.png/json` | Date, note, and actions stayed hidden |
| Active session | One unlock across Progress, detail, capture | Pass | `session-*-modern-390x844.png/json` | No repeated timeline gate during route navigation |
| App state | Background then foreground | Pass | `session-background-relocked-modern-390x844.png/json` | Timeline data hidden after relock |

## Bugs Found

| ID | Severity | Reproduction | Expected | Actual | Evidence |
| -- | -------- | ------------ | -------- | ------ | -------- |
| `progress-direct-route-app-lock-bypass` | Critical | After app-wide unlock, open capture/review/detail directly | Every sensitive Progress route requires timeline unlock | Prior gate existed only inside the Progress tab | `docs/e2e-bug-reports/2026-07-10-progress-direct-route-app-lock-bypass.md` |

## Tests Added Or Updated

- `src/features/photos/progressRoutes.test.ts`: every sensitive route wraps content in the shared gate.
- `src/lib/applock/authenticate.test.ts`: shared timeline state, startup shield, and one-session E2E auth sequence.
- `src/lib/applock/store.test.ts`: encrypted preference read failure propagates so the provider fails closed.

## Commands Run

```text
npm --workspace apps/mobile test -- --run src/lib/applock/store.test.ts src/lib/applock/authenticate.test.ts src/lib/applock/privacyState.test.ts src/features/photos/progressRoutes.test.ts src/features/photos/claimsafety.test.ts
npm --workspace apps/mobile run typecheck
npm --workspace apps/mobile run lint
node run-locked.mjs
E2E_BASE_URL=http://127.0.0.1:8156 node run-session.mjs
```

## Remaining Risk

- Real LocalAuthentication prompt ordering and app background behavior require physical iOS and Android staging builds.
- VoiceOver/TalkBack focus restoration after unlock is not proven by Expo web.
- Expo web proves route mounting/visibility, geometry, and state transitions, not native biometric security.
