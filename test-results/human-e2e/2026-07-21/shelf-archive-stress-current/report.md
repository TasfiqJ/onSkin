# Shelf And Archive Collection Stress E2E

Date: 2026-07-21 (America/Toronto)

Surface: Expo web through headless system Chrome/Edge at 390 x 844

Result: Pass

## Flow

- Traversed all 100 deterministic mixed-height Shelf rows from top to the unique final row with no blank intermediate viewport.
- Switched All → Actives → Expiring → All, traversed the exact 34 active and 40 expiring subsets, and restored the independent filter offsets.
- Activated the visible `View archive (100)` action, traversed all 100 finished/discarded rows to the unique final row, then used Back and restored the prior Shelf boundary.
- Horizontal overflow: 0 px. JavaScript dialogs: 0. Unexpected warn/error logs: 0.

## Mounted Row Bounds

| Collection | Unique rows seen | Mounted row range | Bottom visible rows |
| --- | ---: | ---: | ---: |
| All Shelf | 100 | 30-100 | 4 |
| Actives | 34 | 34-34 | 4 |
| Expiring | 40 | 38-40 | 3 |
| Archive | 100 | 30-100 | 9 |

The raw content-free Profiler counters, scroll geometry, expected development logs, and exact offset values are in `metrics.json`. Screenshots `01` through `05` cover Shelf top/bottom, Archive top/bottom, and restored Shelf after Back.

## Evidence Boundary

The deterministic fixture is development-web-only, capped at 250 rows, and overlays only after the real Shelf availability query succeeds. It contains no account, product, barcode, ingredient, health, storage, or provider data. This run proves collection traversal, filter subset completeness, offset restoration, blank-viewport behavior, and responsive layout on Expo web. It does not set or validate native `initialNumToRender`, batch, window, clipping, frame, memory, Dynamic Type, or VoiceOver parameters; those remain supported-iOS device gates.
