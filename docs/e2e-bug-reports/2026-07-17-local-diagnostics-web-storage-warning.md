# E2E Bug Report: Local diagnostics reads an unsupported web storage getter

- Severity: Low
- Surface: Expo web
- Environment: Development, 390x844 viewport
- Feature: Content-free local diagnostics
- Date: 2026-07-17
Tester: Codex human-simulated route audit

## Reproduction Steps

1. Start Expo web in development mode.
2. Open `/settings/diagnostics`.
3. Inspect browser warnings while the diagnostics snapshot loads.

## Expected Result

The diagnostics screen loads without browser warnings and reports storage free space as unavailable on unsupported platforms.

## Actual Result

The screen rendered, but `expo-file-system` emitted `expo-file-system is not supported on web` when its `availableDiskSpace` getter was accessed.

## Evidence

- Pre-fix screenshot: `test-results/human-e2e/2026-07-17/local-diagnostics-healthy-current/settings-diagnostics.png`
- Strict route audit: one disallowed browser warning, `expo-file-system is not supported on web`; no geometry issue was found.

## Frequency

- Always

## Scope

- Affected route/screen: `/settings/diagnostics` on Expo web
- Affected account or fixture: Development diagnostics fixture; account independent
- External service involved: None
- Destructive action involved: None

## Suspected Cause

The runtime adapter accessed `Paths.availableDiskSpace` on web. Expo exposes the property there, but its getter emits an unsupported-platform warning.

## Minimal Fix Recommendation

Check `Platform.OS` before accessing the native getter and return the existing non-finite fallback input on web. The snapshot sanitizer then emits the allowlisted `unavailable` enum without serializing platform error content.

## Verification Flow After Fix

1. Re-run the same `/settings/diagnostics` audit at 390x844.
2. Confirm the route renders and the browser-log gate passes.
3. Confirm storage free space displays `unavailable` and no raw warning or error is shown.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-17/local-diagnostics-healthy-current/settings-diagnostics-post-fix-viewport.png`
- Same-surface result: the 390x844 route rendered with `Free-space class: unavailable`, no horizontal overflow, and no `expo-file-system is not supported on web` warning.
- Interaction result: Refresh updated the capture timestamp, Back returned to `/you`, and the You-screen entry returned to `/settings/diagnostics`.

## Remaining Risk

- Untested branches: Native iOS free-space getter still requires simulator/device verification.
- Missing fixtures: None for the web regression.
- Follow-up needed: Native iOS human verification before launch sign-off.
