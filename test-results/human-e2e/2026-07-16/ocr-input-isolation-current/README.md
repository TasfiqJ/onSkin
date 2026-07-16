# OCR Input-Isolation Human E2E

Date: 2026-07-16 (America/Toronto)
Plan item: OPT-115
Surface: Expo web development build in the Codex in-app browser

## Outcome

The forced label-capture failure entered the real `/shelf/ocr` review surface. A 3,852-character synthetic draft was allowed to settle, then 128 characters were entered through 128 individual key actions. Raw input remained immediate while the route, memoized capture panel, and parsed preview did no work during the burst. After 300 ms of quiescence, one preview parse and one preview render occurred.

The settled draft contained 96 parsed actives. The UI rendered 64 active rows and exposed the bounded-preview summary. Twenty final ASCII code units were then entered, a 4,001st code unit was attempted and rejected, and Continue was activated while the preview still reported pending. `/shelf/manual` received the exact expected canonical token list, including the final `Hydroquinone Exact` marker.

## Checks

| Check | Result |
| --- | --- |
| Forced label-capture failure and manual recovery | Pass |
| 128 individual key actions | Pass |
| Route render delta during typing | 0 |
| Capture-panel render delta during typing | 0 |
| Preview parse/render delta during typing | 0 / 0 |
| Preview parse/render delta after 300 ms | +1 / +1 |
| Visible active preview rows | 64 of 96 |
| 4,001st code unit | Rejected |
| Submit while preview pending | Pass |
| Canonical manual carryover | Exact 3,938-character SHA-256 match |
| 390 x 844-class horizontal overflow / textarea-footer overlap | 0 px / 0 px |
| 375 x 667-class minimum visible control | 47.998 px |
| Compact partial or blocked controls | 0 / 0 |
| JavaScript dialog / browser errors / unexpected warnings | 0 / 0 / 0 |

The browser driver needed 2,141 ms to issue 128 separate key actions. That driver duration is not app input latency. The development React Profiler recorded about 0.480 ms mean editor commit duration during those actions; this is not a production-Hermes latency claim.

## Deterministic Fixture

The raw draft joined 96 `Retinol Stress NNN` tokens and 100 `Synthetic Inci NNN` tokens using one-based, three-digit indices and `, ` separators, then added a 60-character token containing only `1`. The first 3,852 code units were the settled prefix and the remaining 128 were entered individually. The final marker was `, Hydroquinone Exact`.

The 60-digit token normalizes to empty and is intentionally omitted from the parsed result. Canonical joining also removes one now-redundant `, ` separator, which explains the exact 62-code-unit reduction from the 4,000-code-unit raw draft to the 3,938-code-unit canonical result. The full machine-readable recipe and hashes are in `metrics.json`; the template run inventory is in `report.md`.

## E2E-Found Bug

The first measurement showed an editor-owned `useMemo` calculation replaying one preview parse during a raw-only render before the debounce expired. Parsing was moved into the memoized preview leaf, which did not render during raw typing. The exact reproduction then passed with zero preview parses during all 128 key actions and one parse after quiescence. See `docs/e2e-bug-reports/2026-07-16-ocr-preview-parse-replayed-during-raw-typing.md`.

## Artifacts

- `metrics.json`: content-free render/parse counters, input hashes, bounds, exact-carryover result, geometry, and claim boundary.
- `01-capture-failure-review-390x844.png`: forced capture-failure recovery and empty review.
- `02-long-draft-preview-390x844.png`: bounded long draft and parsed preview.
- `03-exact-canonical-manual-carryover-390x844.png`: manual destination after pending exact submit.
- `04-compact-review-375x667.png`: compact supported-phone review geometry.

## Scope Boundary

This is a scoped Expo-web hot-path and layout pass, not full checklist acceptance. It does not prove production Hermes latency, native keyboard/IME behavior, screen-reader behavior, native safe areas, camera lifecycle, OCR recognition accuracy, or physical-device frames, CPU, thermal impact, and memory. Refresh/relaunch, Back/retry draft preservation, cleanup-failure retry, permission denial, and real native capture were not rerun in this slice; their existing flow-tree evidence remains separate.
