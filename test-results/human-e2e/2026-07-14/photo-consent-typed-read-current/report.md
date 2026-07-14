# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-14
- Codex task: Harden the Progress photo-capture consent proof into an exact version/hash typed read gate.
- App surface: Expo web route/state/layout proxy; native camera permission and protected-storage behavior remain native QA.
- Build/start command: `npm --workspace apps/mobile run start -- --web --port <port>` with the fixture variables listed below.
- Browser/device/simulator/OS: Codex in-app browser on Windows; supported 375 x 667 and 390 x 844 phone viewports plus a 320 x 568 stress viewport.
- Feature tested: `/progress/capture` and legacy `/photos/capture` photo-consent read, bounded loading, re-consent, save, retry, refresh, and recovery paths.
- Overall verdict: Pass with native-device follow-up.

## Setup And Fixtures

All runs used `EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro` and `EXPO_PUBLIC_E2E_APP_LOCK_ENABLED=disabled`. The following dev-only fixtures were exercised on fresh Expo origins; production builds ignore them:

- `EXPO_PUBLIC_E2E_PHOTO_CONSENT_READ_FAILURE=always`
- `EXPO_PUBLIC_E2E_PHOTO_CONSENT_READ_FAILURE=once`
- `EXPO_PUBLIC_E2E_PHOTO_CONSENT_READ_FAILURE=hang`
- `EXPO_PUBLIC_E2E_PHOTO_CONSENT_STATE=stale_version`
- `EXPO_PUBLIC_E2E_PHOTO_CONSENT_STATE=wrong_hash`
- `EXPO_PUBLIC_E2E_PHOTO_CONSENT_STATE=legacy_true`
- `EXPO_PUBLIC_E2E_PHOTO_CONSENT_STATE=malformed`
- `EXPO_PUBLIC_E2E_PHOTO_CONSENT_STATE=future`
- `EXPO_PUBLIC_E2E_PHOTO_CONSENT_FAILURE=uncertain_once`

No live Supabase, RevenueCat, Sentry, camera, or destructive account action was used.

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| Photo consent | persistent unreadable proof | Pass | `persistent-recovery-375x667.png`, `persistent-recovery-320x568.png`, `summary.json` | Retry remained blocked, refresh remained fail-closed, camera/permission/consent CTAs were absent, and Retry/Back were 56/48 px with clear center hit tests and no horizontal overflow. |
| Photo consent | one-shot read failure | Pass | `one-shot-current-recovery-375x667.png`, `summary.json` | Retry revealed genuine absence, grant reached the normal web permission gate, and refresh plus Retry recovered the stored exact-current proof without rewriting it. |
| Photo consent | stale version and wrong hash | Pass | `stale-version-reconsent-375x667.png`, `summary.json` | Both states displayed the explicit re-consent notice; a new choice was required before the permission path opened. |
| Photo consent | legacy Boolean proof | Pass after fix | `legacy-reconsent-fixed-320x568.png`, `summary.json` | Legacy true required re-consent. The optional prep reminder is now omitted on compact re-consent so both actions fit fully. |
| Photo consent | malformed and future proof | Pass | `future-recovery-390x844.png`, `summary.json` | Both states rendered retry-only recovery, including through the legacy route redirect; no ordinary consent or camera surface appeared. |
| Photo consent | hung proof read | Pass | `hung-read-loading-375x667.png`, `hung-read-timeout-recovery-375x667.png`, `steps.json` | The named progress state explained that the camera stayed closed, exposed a 48 px Back action, and transitioned to retry/back recovery 10,025 ms after the consent-loading state appeared. |
| Photo consent | write committed, confirmation lost | Pass | `write-uncertain-320x568.png`, `steps.json` | The fixture performed the real local proof write and then simulated a lost response plus unreadable readback. Distinct `Photo choice not confirmed` recovery kept the camera closed; Retry read the committed exact-current proof and reached the normal permission gate directly, without asking for consent again. |
| Navigation | legacy alias and recovery exit | Pass | `summary.json` | `/photos/capture` redirected to `/progress/capture`; `Back to Progress` explicitly replaced to `/progress` even with unrelated history. |

## Bug Found And Fixed

| ID | Severity | Reproduction | Expected | Actual | Evidence |
| -- | -------- | ------------ | -------- | ------ | -------- |
| `2026-07-14-photo-consent-compact-reconsent-clipping` | Medium | Open compact 320 x 568 legacy re-consent. | Both actions fit and remain fully usable. | The 48 px `Not now` action extended 13 px below the viewport. | `docs/e2e-bug-reports/2026-07-14-photo-consent-compact-reconsent-clipping.md` |

The smallest fix hides the optional prep reminder only for compact re-consent. The exact same fixture/viewport was rerun: the 52 px Grant action ended at 484 px and the 48 px `Not now` action ended at 536 px inside the 569 px measured viewport; both center hit tests passed.

## Automated Coverage

- `apps/mobile/src/features/photos/consent.test.ts`: strict codec, typed precedence, current-copy hashing, account boundaries, commit-response loss, state-change races, concurrency, and every route fixture.
- `apps/mobile/src/features/photos/applyCaptureConsent.test.ts`: save-before-permission, fail-closed behavior, detached native prompt, cross-instance prompt dedupe, never-settling prompt, and route source contract.
- `apps/mobile/src/features/photos/progressRoutes.test.ts`: source contract for the exact-current render boundary, loading/recovery accessibility, bounded-timeout wiring, stale publication invalidation, and explicit recovery navigation. The executable timeout transition is proven by the browser flow above.
- Consent-copy and private-data-registry tests cover exact display/hash composition, truthful v3 copy, typed domain reads, and legacy codec declaration.

## Browser Logs And Dialogs

- Raw action/URL/accessible-tree/geometry assertions for all recorded cases are in `steps.json`. Raw browser logs cover persistent read failure, committed-write/lost-confirmation, and hung-read timeout in `browser-logs.json` and `persistent-browser-logs.json`. Raw dialog checks cover the two updated committed-write and hung-read cases in `dialogs.json`; their fixture, route, viewport, and network-capture scope is in `environment.json`.
- No JavaScript dialog opened in either updated case captured by `dialogs.json`.
- The three cases captured in the raw browser-log artifacts contain zero error-level entries.
- Expected development warnings remained: placeholder Supabase configuration, web notification-listener support, and multiple placeholder GoTrue client instances.
- No raw fixture string appeared in visible UI.
- Network traffic was not captured in this run, so no network-absence claim is made.

## Remaining Risk

- Expo web proves route ordering, visible copy, navigation, accessibility names, and responsive layout only.
- A route timeout suppresses late publication but cannot cancel the underlying native storage call. Repeated same-owner retries against a truly never-settling provider can retain pending operations until storage resolves or an account boundary aborts them.
- A truly never-settling native permission request retains the automatic cross-remount dedupe until it settles or the process restarts. The visible permission gate remains available for deliberate manual recovery; adding a timer must not create duplicate OS prompts.
- Physical iOS 17+ QA must still prove real Keychain/protected-storage behavior, camera permission ordering, OS prompt behavior across account switch/backgrounding, VoiceOver/Dynamic Type, camera preview/capture, and byte preservation after process kill.
- Native durable E2E harness selection remains an open repo question.
