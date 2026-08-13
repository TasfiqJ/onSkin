# Reduce Motion Human-Simulated E2E

Date: 2026-07-16

Surface: actual Expo web at `http://localhost:8292/progress`

Fixture:

- `EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro`
- `EXPO_PUBLIC_E2E_PROGRESS_PHOTOS=populated`
- `EXPO_PUBLIC_E2E_APP_LOCK_ENABLED=disabled`
- `EXPO_PUBLIC_E2E_REDUCE_MOTION=enabled`

Viewport: 1281 x 720 (the available in-app browser did not expose device emulation)

## User-like sequence

1. Confirmed the populated Progress Compare surface was visible.
2. Activated Timeline and opened `Quiet photo time-lapse`.
3. Confirmed the first frame remained `Apr 1, 2026` / `1 of 3` after 2,200 ms,
   longer than the normal 1,800 ms frame interval.
4. Confirmed the dialog announced `Reduced motion is on` and exposed no
   Play/Pause time-lapse control.
5. Activated Next photo and confirmed the frame changed to `May 12, 2026` /
   `2 of 3`, proving deliberate frame-by-frame review remained available.
6. Closed the player, returned to Compare, opened the named first-photo picker,
   and selected May 12.
7. Activated the named Side-by-side presentation and confirmed the divider was
   removed while both date controls remained available.

## Result

PASS for the available Expo-web surface. The player did not auto-play under the
development-only reduced-motion fixture, manual controls worked, the dynamic
date-picker presentation remained functional, Side-by-side remained available,
and no JavaScript dialog opened.

This is interaction and semantic evidence for Expo web. It is not a physical
iOS Reduce Motion, VoiceOver, or platform animation-scale pass.
