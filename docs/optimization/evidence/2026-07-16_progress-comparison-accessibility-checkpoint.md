# Progress Comparison Accessibility Checkpoint

Date: 2026-07-16

Branch: `optimization`

Checkpoint parent: `f04fc6e0ad00b529c616d0203544770d44376e1c`

Item: `OPT-203`

## Invariant

The Progress comparison wipe must be operable without a drag gesture. Its
adjustable control must expose the selected dates, a bounded position, a calm
non-judgmental spoken value, deterministic increment/decrement actions, and a
full practical focus target. Side-by-side must remain a named non-gesture
presentation. No accessibility text may grade or judge the user's skin.

## Baseline Finding

The comparison already used a Reanimated pan gesture, a visual 46 pt handle,
and a side-by-side toggle. The handle exposed only an adjustable role and a
generic drag label: it had no value, action list, bounded screen-reader step, or
date context. The side-by-side button relied on visible text instead of naming
the state transition. Human-simulated Expo-web inspection then found that
Reanimated dropped range-value attributes and that the first stable inner
semantic view occupied only half the visual target height.

## Implementation

- Added pure comparison accessibility policy with a 52% default, deterministic
  10% steps, integer clamping from 0 to 100, invalid-value fallback, and calm
  spoken copy.
- The visual/animated handle remains outside React state during the pan. Gesture
  completion publishes only the final bounded percentage for assistive state.
- A stable full-size inner view owns the adjustable role, date-aware label,
  hint, native increment/decrement actions, `accessibilityValue`, and Expo-web
  ARIA range aliases.
- The side-by-side control now names both transitions and explicitly describes
  itself as the non-gesture presentation.
- No photo source, selection identity, navigation, analytics, privacy, score,
  or ordinary drag behavior changed.

## Deterministic Evidence

```text
npm.cmd --workspace @onskin/mobile test -- --run \
  src/features/photos/compareAccessibility.test.ts \
  src/features/photos/progressRoutes.test.ts
2 files / 25 tests PASS

npm.cmd run typecheck
2 workspaces PASS

npm.cmd run lint
2 workspaces PASS, zero warnings

npm.cmd test
317 files / 3,928 tests PASS
```

The tests prove deterministic action steps, bounds, malformed numeric fallback,
non-judgmental value text, stable semantic ownership, full handle sizing,
explicit actions/range aliases, and the named non-gesture route control.

## Human-Simulated E2E

Actual Expo web at `/progress` with the populated local fixture passed:

- one date-aware slider with min 0, max 100, now 52, and
  `52 percent of the before photo visible`;
- a final semantic target of about 46 x 46 px;
- named Side-by-side activation, slider removal, both selected photos, and a
  named return to draggable comparison;
- the named first-photo picker and Apr 1 to May 12 selection update;
- zero horizontal overflow at the available 1281 x 720 viewport; and
- no JavaScript dialog.

Evidence:
`test-results/human-e2e/2026-07-16/progress-comparison-accessibility-current/`.
The run also records and closes the two web semantic defects it found. The
browser runtime did not expose device emulation, so this is not new
supported-phone or physical-iPhone evidence.

## Result And Remaining Verification

`OPT-203` is implemented locally: comparison gestures have deterministic
accessibility actions and a named non-gesture alternative. It is not verified
for release because native VoiceOver action dispatch/focus announcements remain
open on supported iOS hardware or Simulator. TalkBack is useful resilience work
if Android returns to scope, but Android is not part of the accepted V1 launch
contract.

## Rollback Trigger

Rollback or repair if the slider loses its date-aware label/range/actions,
assistive adjustment escapes 0-100 or changes by a non-deterministic step, the
semantic target drops below the visual handle, Side-by-side requires a gesture,
or spoken copy introduces a skin judgment or score.
