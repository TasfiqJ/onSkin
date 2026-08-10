# E2E Bug Report: Encrypted Progress Failure Looked Empty

## Summary

- Severity: Critical
- Surface: Progress tab, capture, review, and photo detail
- Status: Fixed and verified on Expo web; native secure-storage fault injection remains device QA
- Date found: 2026-07-10

## Environment

- App surface: Expo React Native / Expo web development build
- Browser/device: Google Chrome 150 via bundled Playwright 1.61.1
- Viewports: 360 x 640 and 390 x 844
- Fixtures: store Pro entitlement, populated Progress timeline, deterministic encrypted-storage read failure

## Reproduction

1. Arrange for the encrypted Progress metadata read to reject after entitlement and any configured biometric lock have passed.
2. Open `/progress`, `/progress/capture`, `/progress/review?capturedUri=[local-uri]`, or `/progress/[existing-id]`.
3. Observe the route after the query settles.

## Expected

The route must distinguish unreadable encrypted storage from an empty timeline or a missing photo. Sensitive route content and photo mutations must remain unmounted, existing encrypted data must remain unchanged, and the user must receive a retryable private-storage recovery state.

## Actual Before Fix

Each consumer destructured only `data` from `usePhotos`. A rejected query therefore became `undefined` at the route boundary:

- Progress calculated `count = 0` and rendered the first-photo state.
- Detail rendered the deleted-or-missing photo recovery.
- Review calculated a false first-photo baseline and mounted Save around unreadable history.
- Capture mounted camera/consent content without a readable reference timeline.

The store itself preserved ciphertext, but the UI presented false state and could invite a mutation while the authoritative encrypted record was unavailable.

## Root Cause

The encrypted store correctly propagated key/read failures through TanStack Query, but no shared route boundary consumed `isPending`, `isError`, or `refetch`. The four routes independently treated absent query data as valid empty data.

## Fix

- Added `PhotoStorageGate` with paper/night treatments, loading privacy state, stable alert copy, a 56 px real-query retry, persistent-failure feedback, and a 48 px minimum direct-route escape.
- Nested the gate inside `PhotoTimelineLockGate` on the Progress tab, capture, review, and detail, so storage is not queried before biometric unlock and route content is not mounted before a successful read.
- Added development-only persistent and one-shot failure fixtures guarded by `__DEV__` and an explicit environment variable.
- Added route contracts proving gate order, retry behavior, target sizing, and raw-error-safe copy.

## Post-Fix Verification

- Persistent failure: 8/8 route/viewport combinations passed at 360 x 640 and 390 x 844.
- All four routes hid first-photo, populated timeline, camera/consent, captured review, note, quality, and missing-photo markers.
- Retry remained 56 px after a repeated failure; direct exits were at least 50 px; horizontal overflow was zero.
- The detail exit reached the Progress tab recovery with floating navigation available.
- A one-shot failure on direct captured-photo review retried the real query and revealed `Save to my phone` only after success.
- Dialogs, page errors, unexpected browser errors, raw fixture text, analytics requests, and photo-backend requests were all zero.
- Evidence: `test-results/human-e2e/2026-07-10/progress-storage-recovery-current/`.

## Remaining Risk

Expo web cannot prove iOS Keychain, Android Keystore, or native SecureStore fault behavior. Physical staging builds must force key unavailability after encrypted records exist, verify envelopes and `.layerwellphoto` files remain byte-identical, restore key access, retry successfully, and verify VoiceOver/TalkBack announcement and focus.
