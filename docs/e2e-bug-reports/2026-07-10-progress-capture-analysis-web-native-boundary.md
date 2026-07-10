# Progress Capture Analysis Web Native Boundary

- Date: 2026-07-10
- Surface: Expo web `/progress/review`
- Severity: P1 launch-gate regression
- Status: fixed and reverified

## Reproduction

1. Add the Expo ML Kit face-detection module and import its provider directly from the review route.
2. Start Expo web and open `/progress/review`.
3. Observe the route fail before rendering.

Observed error: `Cannot find native module 'RNMLKitFaceDetection'`.

## Root Cause

The dependency publishes web-specific implementation files, but its compiled package index resolves an explicit JavaScript module path that loads the native module before Metro can select the nested web shim. A direct route import therefore violated the app's web/native boundary.

## Fix

- Added repo-owned platform adapters for the provider and face-detection hook.
- Native resolution imports and initializes ML Kit.
- Web and unsupported resolution return an explicit unavailable result and never import the native package.
- Kept captured-image lighting and review UI behavior independently fail-closed.
- Added source contracts that reject a direct dependency import from the cross-platform route/orchestrator.

## Verification

Expo web bundles and renders matched, adjustment, no-face, and unavailable review states at 390 x 844. The rerun has zero disallowed browser logs, no native-module error, no dialogs, zero horizontal overflow, enabled 48-56 px Close/Retake/Save controls, safe Retake/Close recovery, and no PostHog/Sentry requests. Evidence is in `test-results/human-e2e/2026-07-10/progress-capture-analysis-current/`.

The same evidence set verifies a real web persistence rejection at 360 x 640:
review stays open, `Photo not saved` is inline, and Retake/Save remain 56 px and
center-hit-testable after user-like scroll.

Native autolinking resolves `RNMLKitFaceDetection` and `expo-image-manipulator` on both Android and iOS. Physical-device analysis and calibration remain Phase 5 QA.
