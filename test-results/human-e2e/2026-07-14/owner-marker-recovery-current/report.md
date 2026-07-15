# Owner-marker recovery human-simulated E2E

- Date: 2026-07-14
- Surface: Expo web in the in-app browser
- Fixture: `EXPO_PUBLIC_E2E_ACCOUNT_ISOLATION=owner_marker_future`
- App URL: `http://localhost:8098`
- Viewports exercised: 390 x 844 and compact 375 x 667 (browser-reported layout viewport 376 x 668)

## Preconditions

1. The ordinary signed-out app surface was visible before enabling the recovery fixture.
2. The fixture seeded an unsupported `v2:` owner-control marker and a private sentinel record before account-isolation preparation ran.
3. The recovery gate was then loaded from a fresh app session.

## User flow and result

1. Confirmed the neutral recovery alert was visible and app content remained locked.
2. Confirmed a single **Try again** control was present.
3. Confirmed the fixture proof reported that the unknown owner bytes and representative private sentinel were unchanged and that cleanup had not started.
4. Clicked **Try again** as a user.
5. On the captured revision, confirmed the gate remained locked after retry and the preservation proof remained visible. That display alone did not independently establish a post-retry read; the later implementation now clears the proof, shows a checking state, and re-reads it, but still needs recapture.
6. Repeated the visual check at the compact viewport. There was no horizontal or vertical document overflow. The retry target was fully inside the viewport and measured approximately 320 x 56 CSS pixels.

## Evidence

- `03-compact-375x667-recovery.png` — compact recovery gate after the fail-closed retry, including the preservation proof.
- Operator-observed DOM/accessibility inspection before and after retry confirmed the recovery copy, alert role, preservation proof, and exactly one retry button. A separate raw DOM snapshot was not retained.
- Operator-observed browser console error count: 0. Expo emitted only the expected development fixture/session-boundary diagnostics; a separate console export was not retained.

## Acceptance and residual coverage

The captured web-compatible recovery branch demonstrated that the private app surface never appeared and retry was operable. Before retry, the fixture proof reported that the unknown control marker and representative private sentinel were intact and that the cleanup marker was absent. After retry, the captured revision established only that the gate remained locked and operable; it did not independently reread the post-retry bytes.

This retained artifact is a compact visual plus operator transcript, not a full trace bundle. The proof-state implementation was subsequently changed to clear and re-read its dev-only sentinel after retry; that exact revision still needs a repeat surface capture before the UI branch is marked fully closed.

Malformed-marker, alternate signed-in owner, signed-out, native iOS, and native Android branches remain separate coverage items. This run does not claim those personas or physical-device coverage.
