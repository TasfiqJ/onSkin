# Reduce Motion Coverage Checkpoint

Date: 2026-07-16

Branch: `optimization`

Checkpoint parent: `f71e166d1aeb712bf1233a08f62b6fe7a2513a7b`

Item: `OPT-204`

## Invariant

When the platform Reduce Motion preference is enabled or cannot yet be read,
OnSkin must not start continuous animation, automatic photo playback, animated
programmatic scrolling, or slide/fade presentation. Durable work must never wait
for decorative theater. Direct user manipulation and deliberate manual stepping
remain available, with a non-gesture alternative where a gesture is used.

## Baseline Finding

The app had a local Reduce Motion listener only in the photo time-lapse. The
onboarding analyzer always pulsed and delayed the reveal by 2.6 seconds. Five
route stacks, four modal presentations, and six programmatic scroll calls used
unconditional motion. The duplicated time-lapse listener also began from an
optimistic motion-enabled default while the asynchronous platform preference was
still unresolved.

## Implementation

- Added one shared platform-preference hook and pure policy. Unknown or failed
  preference reads conservatively reduce motion; only an explicit platform
  `false` permits timed motion.
- Added a development-only `EXPO_PUBLIC_E2E_REDUCE_MOTION` fixture without
  changing production configuration behavior.
- Removed the artificial 2.6-second onboarding wait. Durable profile save now
  routes immediately, independently of pulse rendering.
- Made the onboarding pulse static until motion is explicitly permitted.
- Suppressed time-lapse autoplay under Reduce Motion while preserving named
  Previous and Next controls and the existing non-animated modal.
- Routed five stack transitions, four modal presentations, and six
  programmatic-scroll owners through the shared preference.
- Added an executable repository inventory that rejects unconditional timed
  navigation, modal, stack, scroll, and onboarding-pulse behavior.

## Safe Exceptions

- The Progress comparison wipe follows direct user input; it has deterministic
  accessibility actions and a named Side-by-side alternative.
- `requestAnimationFrame` uses in the audited source schedule layout/focus work,
  not time-based visual animation.
- Network/storage deadlines and retry delays enforce correctness; they are not
  decorative waits.
- Sensitive-photo and OCR image transitions remain exactly zero, and the
  time-lapse modal remains `animationType="none"`.

## Deterministic Evidence

```text
npm.cmd --workspace @onskin/mobile test -- --run \
  src/lib/accessibility/useReduceMotionPreference.test.ts \
  src/lib/accessibility/reduceMotionInventory.test.ts \
  src/features/onboarding/onboardingRoutes.test.ts \
  src/features/photos/progressRoutes.test.ts \
  src/features/photos/timelapse.test.ts \
  src/features/community/communityRoutes.test.ts \
  src/features/settings/settingsRoutes.test.ts \
  src/features/shelf/shelfRoutes.test.ts
8 files / 123 tests PASS

npm.cmd --workspace @onskin/mobile run typecheck
PASS

npm.cmd --workspace @onskin/mobile run lint
PASS, zero warnings

npm.cmd test
319 files / 3,936 tests PASS

npm.cmd run typecheck
2 workspaces PASS

npm.cmd run lint
2 workspaces PASS, zero warnings
```

The inventory covers every current production TypeScript/TSX motion owner and
proves there is no unconditional animated scroll, slide/fade modal, slide/fade
stack transition, 2.6-second onboarding reveal wait, or ungated continuous
animation.

## Human-Simulated E2E

Actual Expo web at `/progress` with the populated fixture and the development
Reduce Motion fixture passed:

- Timeline opened the named `Quiet photo time-lapse` dialog on Apr 1 / `1 of 3`;
- it remained on that exact frame after 2,200 ms, beyond the normal 1,800 ms
  frame interval;
- the dialog announced the reduced-motion state and exposed zero Play/Pause
  controls;
- deliberate Next moved to May 12 / `2 of 3`;
- the named first-photo picker opened and updated the comparison date; and
- the named Side-by-side presentation remained usable with no JavaScript dialog.

Evidence:
`test-results/human-e2e/2026-07-16/reduce-motion-current/`.
The available browser was 1281 x 720 and did not expose device emulation, so
this is not new supported-phone or physical-iPhone evidence.

## Result And Remaining Verification

`OPT-204` is implemented locally. It is not release-verified because the plan's
required device-setting pass remains open on supported iOS hardware or
Simulator, including a real OS preference change while the app is running,
VoiceOver focus behavior, modal/stack transitions, and system animation-scale
interaction. Android resilience evidence remains outside the accepted iOS-only
V1 launch contract unless product scope changes.

## Rollback Trigger

Rollback or repair if unknown preference state starts motion, Reduce Motion
permits autoplay/pulse/animated scroll/slide/fade presentation, onboarding waits
for decorative timing, preference changes duplicate durable work, or manual and
non-gesture review paths become unavailable.
