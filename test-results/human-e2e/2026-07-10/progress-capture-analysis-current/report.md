# Progress Capture Analysis Human E2E

- Date: 2026-07-10
- Surface: Expo web development build
- Viewports: 390 x 844 state matrix; 360 x 640 supported-floor save recovery
- Fixture gate: `EXPO_PUBLIC_E2E_PROGRESS_CAPTURE_ANALYSIS=enabled` with development-only matched, adjust, no-face, and unavailable states
- Result: PASS

Verified four explicit post-capture review states, state-appropriate quality-note tones, a real 48 x 64 bitmap, 44 px or larger Close/Retake/Save controls, enabled Save in every quality state, clean center hit-tests, zero horizontal overflow, no dialogs, safe Retake and Close recovery, no native ML Kit import on web, no disallowed browser logs, and no PostHog/Sentry traffic. At the 360 x 640 support floor, a real web persistence rejection stayed on review, rendered inline `Photo not saved` recovery, and kept Retake/Save reachable and center-hit-testable after user-like scroll. This verifies review UI and web failure recovery only; real ML Kit face bounds, luminance sampling, native encryption success/failure, device calibration, VoiceOver/TalkBack, and camera performance remain native physical-device gates.

The first bundle attempt exposed a cross-platform integration failure where the dependency's compiled index loaded `RNMLKitFaceDetection` on web despite its nested web shims. Repo-owned platform adapters fixed the boundary, and the complete evidence set was regenerated from fresh page loads after the fix. See `docs/e2e-bug-reports/2026-07-10-progress-capture-analysis-web-native-boundary.md`.
