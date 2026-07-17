# OPT-211 Measured Route Ownership Checkpoint

Date: 2026-07-17 (America/Toronto)

Parent SHA: `f3de3ea12223820abac8114d51a929e1ef74a4ea`

Status: `verified` for the plan's exact profiler/test-improvement proof.

## Outcome

Seven oversized routes already contain React component, memoization, focus, or
profiler boundaries that were introduced at measured state/render ownership
edges. This checkpoint consolidates those scattered results, adds a deterministic
regression audit, and verifies the plan item without pretending that file length
alone requires extraction.

Here, a route “split” means a real React ownership/render boundary. Moving the
same component into another file would not change commits, observers, frames,
or memory, so filesystem-only extraction is not counted as optimization.

## Measured Boundaries

| Route          | Preserved boundary                                          | Measured/test result                                                                              |
| -------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Today          | memoized header/check rows plus route view-model content    | Query observers fell by 8/17; local-date subscriptions fell by 8/9                                |
| Progress tab   | memoized timeline rows, photo-content owner, route boundary | One route-owned date/photo source; focus-gated image/list ownership and route tests pass          |
| Shelf tab      | memoized cards/header, focused query subtree                | `FlatList` stable rows; static shells isolated from filter-only rerenders                         |
| Ask            | sibling composer, memoized rows, profiled history           | During 158-character typing, history commits stayed 6 -> 6 and row renders 16 -> 16               |
| Catalog search | memoized composer/cards, profiled results                   | Across 80 key actions, result-region commits and card renders both changed by 0                   |
| OCR review     | memoized capture/editor/preview, profiled editor            | Across 128 key actions, route/capture/preview deltas were 0; one parse/render followed quiescence |
| You            | memoized static/mutation section owners                     | Every measured mutation gesture produced 0 renders in unrelated protected owners                  |

The proof is retained in the existing checkpoints:

- `2026-07-15_today-route-view-model-checkpoint.md`
- `2026-07-15_progress-shelf-route-ownership-checkpoint.md`
- `2026-07-15_ask-100-turn-keystroke-checkpoint.md`
- `2026-07-16_catalog-search-input-isolation-checkpoint.md`
- `2026-07-16_ocr-input-isolation-checkpoint.md`
- `2026-07-16_you-mutation-isolation-checkpoint.md`

## Regression Contract

`scripts/optimization/route-ownership-audit.mjs` inventories every route,
reports routes over 500 lines, and checks the exact seven route/evidence pairs.
It fails if a measured component/profiler boundary or its proof marker
disappears. The mobile test suite invokes the audit and verifies the measured
route set.

Current inventory:

- 93 route source files;
- 17 routes over 500 lines;
- 7 routes with measured ownership splits;
- 10 oversized routes without qualifying measurements.

The ten unmeasured routes are deliberately reported and left unchanged. The
optimization plan says size alone is not a performance defect and requires
profiler or ownership evidence before extraction. Future work should add a
route only after a measured commit/observer/memory/input boundary identifies a
problem; it must not turn this audit into a maximum-line-count rule.

## Proof Boundary

The table-required `profiler/test improvement` exists and OPT-211 is therefore
verified. This does not upgrade the broader native-performance claims in
OPT-105, OPT-114, or OPT-115: representative production-Hermes frame, memory,
keyboard, accessibility, and physical-device evidence remains governed by
those separate rows.

No new route extraction was made in this checkpoint because the measured
boundaries already exist and pass. The new audit prevents regression while
avoiding a zero-runtime-value code shuffle.

## Verification

- `node scripts/optimization/route-ownership-audit.mjs --json` — PASS; 7/7
  measured routes and all evidence markers present.
- Focused route-ownership audit — 1 file / 1 test PASS.
- Full root tests — 326 files / 3,962 tests PASS.
- Root typecheck — 2 workspaces PASS.
- Root lint — 2 workspaces PASS with zero warnings.
- Compact evidence:
  `test-results/optimization/2026-07-17/opt211/route-ownership-audit.json` and
  `test-results/optimization/2026-07-17/opt211/report.md`.
