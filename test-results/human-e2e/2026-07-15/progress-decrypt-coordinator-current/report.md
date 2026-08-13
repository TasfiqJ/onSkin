# Progress Sensitive-Image Demand E2E Report

Date: 2026-07-15 (America/Toronto)
Branch: `optimization`
Checkpoint parent: `b519fde776172c518fe1e16f8c880b54fb9e4bf8`
Result: PASS for the Expo-web interaction contract; native privacy and performance gates remain open

## Surface And Fixture

- Surface: Expo web in the Codex in-app browser
- Route: `http://localhost:8285/progress`
- Viewport: 390 x 845 CSS pixels (390 x 844 supported-phone cap requested)
- Fixture: Pro entitlement plus three deterministic populated Progress photos
- Launch command: `EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro EXPO_PUBLIC_E2E_PROGRESS_PHOTOS=populated npm --workspace apps/mobile run web -- --port 8285 --host localhost --clear`

The deterministic web fixture is intentionally not an encrypted native-photo fixture. This pass proves route behavior, viewability demand, teardown, selection retention, and layout. It does not prove native decrypt cost, native decoded-memory release, or filesystem privacy.

## Human-Simulated Flow

1. Opened populated Progress in Compare mode and confirmed three local photos, Side-by-side, the comparison slider, and Apr 1 / Jun 24 selectors.
2. Opened the first-photo picker. All underlying comparison images immediately changed to `your photo` placeholders while the picker tiles remained available, proving the obscured comparison subtree had no active image demand.
3. Selected May 12 as the first comparison photo and confirmed the active pair became May 12 / Jun 24.
4. Switched to Today and returned through the Progress tab. The May 12 / Jun 24 opaque selection survived while the image-bearing Progress subtree remounted.
5. Switched to Timeline and confirmed the June, May, and April virtualized rows plus the named time-lapse control.
6. Opened `Quiet photo time-lapse`. Every underlying timeline image changed to a placeholder while the modal's current frame remained active, proving hidden rows were paused below the overlay.
7. Closed the time-lapse and confirmed the Timeline surface resumed.

## Layout, Accessibility, And Runtime Checks

- Document width was 390 CSS pixels in a 390-pixel viewport: zero horizontal overflow.
- Eleven visible button/tab/link controls were measured; none had a width or height below 44 CSS pixels.
- No JavaScript dialog remained open.
- No browser console error was recorded.
- Expected local-development warnings only: placeholder Supabase URL/key and Expo notifications' documented web-listener limitation.

## Artifacts

- `01-compare-start.png` - populated comparison start
- `02-picker-pauses-compare.png` - picker open with comparison images released underneath
- `03-compare-may-selected.png` - May 12 selected as the first photo
- `04-selection-survives-blur.png` - May 12 / Jun 24 retained after Today -> Progress
- `05-timeline-viewability.png` - virtualized timeline at the supported-phone viewport
- `06-timelapse-pauses-timeline.png` - time-lapse modal with timeline images released underneath

## Automated Gates At Capture Time

| Gate | Result |
| --- | --- |
| Sensitive photo/coordinator focused suite | PASS, 7 files / 54 tests |
| Full repository/mobile test suite | PASS, 306 files / 3,830 tests |
| Mobile TypeScript | PASS |
| Root/mobile TypeScript | PASS |
| Root/mobile ESLint | PASS, zero warnings |
| `git diff --check` | PASS |

## Acceptance Boundary

No new UI bug was found, so no E2E bug report was created. This pass satisfies the web-compatible branch of the human-simulated checklist. It cannot close PERF-P0-003, PERF-P0-004, OPT-103, or OPT-104 by itself. Those gates still require encrypted v1/v2 native fixtures, app-lock/background/account-switch/delete sequences, filesystem inspection, decoded-memory and frame traces, 50/100-photo stress data, and approved physical devices.
