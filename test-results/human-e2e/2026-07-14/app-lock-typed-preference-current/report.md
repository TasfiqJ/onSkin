# App Lock Typed Preference Human-Simulated E2E

Date: 2026-07-14 (America/Toronto)

Surface: Expo web, `/shelf`, local development build

Result: PASS for the web-compatible recovery, mounting, geometry, refresh, relaunch, and cancellation branches. Native LocalAuthentication and secure-store interruption remain physical-device release gates.

## Scenarios

### Persistent read failure

- Fixture: `EXPO_PUBLIC_E2E_APP_LOCK_READ_FAILURE=always` on port 8420.
- Cold open exposed only `RoutineKind`, the non-destructive explanation, and one `Try again` button. Route content and an authenticated-reset action were absent.
- Two user retries retained the blocked state and showed `It is still unavailable. Your app-lock setting remains unchanged.`
- Refresh and a newly opened browser tab both returned to the same blocked state.
- At requested 375 x 667, the browser reported 376 x 668. The button measured 319.75 x 48.36 CSS pixels, document `scrollWidth` equalled `clientWidth`, two hidden-content trees blocked pointer access, and no JavaScript dialog appeared.

### One-shot failure over disabled/absent state

- Fixture: `EXPO_PUBLIC_E2E_APP_LOCK_READ_FAILURE=once` with no enabled fixture on port 8421.
- Cold open showed the same retry-only recovery.
- Clicking the single exact `Try again` control mounted the requested `/shelf` route and its real empty state.
- `Try again`, `Unlock`, and dialogs were absent after recovery; document width did not overflow.

### One-shot failure over enabled state

- Fixture: `EXPO_PUBLIC_E2E_APP_LOCK_READ_FAILURE=once`, `EXPO_PUBLIC_E2E_APP_LOCK_ENABLED=enabled`, and `EXPO_PUBLIC_E2E_APP_LOCK_AUTH=not_authenticated` on port 8422.
- Cold open showed retry-only recovery. Clicking `Try again` applied the actual enabled preference and entered the ordinary `Locked. Unlock to continue` overlay.
- The automatic cancelled fixture settled without a prompt loop. One explicit user click on `Unlock` remained fail-closed on the same route with exactly one `Unlock` control and no dialog.
- At requested 375 x 667, the browser reported 376 x 668. The control measured 319.75 x 48.36 CSS pixels and `scrollWidth` equalled `clientWidth`.

## Observed logs and limits

- Expected local placeholder warnings appeared for unavailable Supabase configuration, web push-token listening, and multiple development GoTrue clients.
- No raw private preference, storage failure reason, credential, or user data was recorded.
- Screenshots and semantic DOM snapshots were captured during the interactive Codex task; this report retains the exact durable observations used for acceptance.
- Physical iOS/Android proof is still required for native PIN/passcode fallback, biometric cancellation/lockout, account switching while a sheet is open, real background timing, screen-reader focus, and Keychain/Keystore interruption.
