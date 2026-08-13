# Progress 100-Photo Stress E2E

Date: 2026-07-18 (America/Toronto)

Implementation SHA: `a53cfeca994e242b7e45fd43279909b1d59f2041`

Surface: Expo web development build at a 390 x 844 supported-phone viewport.

Fixture: `EXPO_PUBLIC_E2E_PROGRESS_PHOTOS=100` with the local Pro entitlement fixture. Every row uses deterministic, non-user metadata and one shared tiny generated image.

## Action script and result

1. Open `/progress` and verify `99 weeks · 100 photos · all on this phone`.
2. Switch to Timeline and scroll like a user from the newest row through the oldest row.
3. Confirm the oldest row is unique, visible, and surrounded by real rows with no blank viewport.
4. Return to Compare, open the first-photo picker, and horizontally traverse to its oldest boundary.
5. Select Aug 7 and confirm the modal closes and the comparison updates from Jul 31 to Aug 7.

Result: pass for web-compatible list recycling, oldest-boundary reachability, picker selection, no-score presentation, and phone-width geometry. Mounted timeline rows stayed between 34 and 51 out of 100 while traversing; six images were mounted at the settled oldest boundary. The picker peaked at 22 mounted cards and settled at 15 cards/3 images at the oldest boundary. Both boundaries had zero blank viewports and zero document-level horizontal overflow.

## Artifacts

- `metrics.json`: sanitized cardinality, recycling, geometry, and selection results.
- `oldest-photo.jpg`: settled oldest timeline boundary.
- `comparison-picker-oldest.jpg`: settled oldest picker boundary.
- `comparison-updated.jpg`: comparison after selecting Aug 7.

This is development-mode web evidence. It does not prove encrypted-photo I/O, native frame pacing, decoded memory, OS-kill behavior, signed-build thresholds, or physical-device accessibility.
