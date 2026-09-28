# PHOTO-02 app-lock source checkpoint — 2026-09-26

## Status

This is a bounded **source checkpoint**, not PHOTO-02 completion or release
evidence. The formal execution status remains unchanged. PHOTO-02 remains open
behind PHOTO-01 and still needs current signed-build, supported-iPhone,
biometric/passcode, interruption, app-switcher snapshot, accessibility, and
human-simulated E2E proof.

## Closed source surface

The app-wide lock owns the app-content mount boundary. It reads the encrypted
preference before mounting children, treats unavailable, corrupt, and future
preference results as enabled and locked, and exposes only non-destructive retry
for key loss, decryption failure, and transient storage failure. A malformed or
unsupported preference offers an explicit device-authenticated reset that
removes only that setting. Readiness, authentication, reset/write, and state
publication remain fenced to the initiating account and interaction lifecycle.
Both enabling and disabling the preference require successful device
authentication before the strict stored-value mutation; cancellation or
unavailable authentication changes neither storage nor published lock state.

After app unlock, the private-data availability gate completes a successful
encrypted read before Offline Sync, navigation, queries, mutations, or other
data-bearing app content mounts. Failure stays on shared non-destructive
recovery and cannot fall through to an empty/default surface. Foreground return
rechecks availability while hiding content and restores the requested route
before revealing it.

Progress timeline, capture, review, and single-photo detail all compose the
same provider-owned, foreground-scoped photo unlock inside their entitlement
gate and outside their encrypted photo-read gate. The app-wide unlock therefore
finishes before the Progress prompt, and the Progress prompt finishes before
photo content reads or mutations mount. Background or invalid interaction
transitions revoke the session. The no-score explainer remains outside the
second lock because it contains no photo data.

## Automated evidence

- Aggregate TypeScript-AST/component/control-flow contract, with adversarial
  mutations for additive pre-gate routes/children, corrupt/future early unlock,
  unauthenticated disable/unlock, pre-authentication reset, stale native
  success, and a photo hook moved above the timeline gate:
  `npm run photo02:source-contract:test`
- Focused mobile behavior/contracts:
  `npm --workspace apps/mobile exec vitest run src/lib/applock/authenticate.test.ts src/lib/applock/store.test.ts src/lib/applock/preferenceDecision.test.ts src/lib/applock/accountOperations.test.ts src/lib/applock/interactionLifecycle.test.ts src/lib/applock/privacyState.test.ts src/features/photos/progressRoutes.test.ts src/features/photos/progressCapturePrivacy.test.ts`
- Mobile typecheck, lint, and the full mobile suite remain integration gates.

## Gates that source cannot close

- Signed iOS archive behavior on supported physical iPhones.
- Face ID, Touch ID, and device-passcode fallback, including cancellation,
  lockout, enrollment change, unavailable hardware, and interrupted prompts.
- Cold/direct Progress entries plus background, foreground, account switch,
  force-stop, relaunch, and the ten-second foreground-return timeout.
- App-switcher snapshot inspection proving sensitive content is obscured.
- Real Keychain missing-key, invalid-key, corrupt-envelope, storage-unavailable,
  authenticated-setting-reset, and byte-preservation fault injection.
- VoiceOver focus/announcement order, Dynamic Type, Reduce Motion, Switch
  Control, and supported-phone layout evidence.
- Current human-simulated E2E evidence bound to the exact source and build.
