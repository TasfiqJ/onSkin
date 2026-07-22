# Data Export Memory-Bound Checkpoint

Date: 2026-07-21 (America/Toronto)

Branch: `optimization`

Evidence class: deterministic Deno boundary/stress tests, Edge source checks, and Phase 9 data-rights code gates

Status: Current Edge export assembly is bounded and fails closed. OPT-013 remains `implemented` rather than verified because complete exports above 8 MiB still need an approved durable archive/streaming design plus hosted and native evidence.

## Baseline And Risk

The exporter had per-source row caps but no request-wide byte or item cap. Thirty-four database sources could retain roughly 1.7 million rows under the default 50,000-row source ceiling, or roughly 8.5 million at the allowed environment maximum. Bounded request concurrency limited active reads, not retained results. Complete source arrays, order identities, both storage inventories, derived URL/object arrays, checksum material, the final bundle, and a pretty-printed JSON response could coexist in one Edge isolate even though the mobile request policy already rejected server export results above 8 MiB.

## Implementation

- One request-scoped `ExportMemoryBudget` is shared by every database pagination task plus storage traversal and derived photo rows.
- Each retained value reserves its canonical UTF-8 bytes, one JSON delimiter byte, and a fixed 128-byte item allowance. The default limits are 8 MiB and 100,000 items; configuration may lower them but cannot raise retained bytes or final response bytes above the established 8 MiB mobile contract.
- A source that fails releases its own byte/item claim. The bounded worker pool stops scheduling after the first failure and waits for already-started work before the handler returns.
- Both storage verification inventories are budgeted simultaneously; the discarded first pass is released only after count/checksum equality succeeds. Folder traversal now also has a bounded prefix count.
- Signed URLs, storage-object rows, and URL omissions use the same budget. Errors contain only a stable source/code shape and never row, photo, note, path, URL, owner, or credential content.
- The handler no longer retains an extra all-source result array, intermediate click-token map/filter arrays, attribution result arrays, or a filtered cloud-photo array.
- Success is compact-serialized once, measured as UTF-8, rejected above 8 MiB, and returned with the exact `Content-Length`. Capacity rejection returns the fixed `DATA_EXPORT_TOO_LARGE` code with HTTP 413.
- The manifest records the retained byte/item limits, fixed item allowance, and exact response ceiling.

## Verification

| Check | Result |
| --- | --- |
| Export-core Deno matrix | Pass, 14/14 tests |
| Existing >1,000-row database case | Pass, 1,205 rows |
| Existing >1,000-object storage case | Pass, 1,205 objects across two verified listings |
| Aggregate source stress | Pass, 34 sources x 25 rows at the exact shared boundary |
| One-byte-over aggregate stress | Fails closed with `MEMORY_BUDGET_EXCEEDED` |
| UTF-8 final response boundary | Exact pass and one-byte-over rejection, including multibyte text |
| Oversized private row | Rejected; zero retained byte/items after rollback; no private content in the error |
| Storage double-pass accounting | Peak includes both passes; only verified returned inventory remains claimed |
| Aggregate tiny-item ceiling | Rejects the next item without retaining it |
| Failed worker lifecycle | Stops new tasks and drains an in-flight sibling before rejection |
| Edge Deno check | Pass |
| Export core/test Deno lint | Pass; the handler retains the repository's existing inline-`jsr:` lint warning |
| Phase 9 data-rights code gate | Pass; live staging warning remains expected without credentials |
| Repository TypeScript | Pass, 2/2 workspaces |
| Repository lint | Pass, 2/2 workspaces with zero warnings |
| Repository tests | 348 files / 4,158 tests pass; the same 2 files / 4 assertions fail in unrelated dirty notification and Shelf metadata work |

This is an Edge/server implementation change with no UI copy, layout, route, or interaction change, so no new app-surface E2E was needed. Existing Settings export recovery evidence remains applicable.

## Privacy And Remaining Scope

All stress fixtures use synthetic IDs and strings. Budget snapshots expose integers only. Capacity errors and logs contain stable codes only; no export row, source payload, local path, signed URL, raw error, or account identifier is emitted.

The 8 MiB boundary matches the current mobile request contract and prevents unbounded current-process assembly. It intentionally does not claim that a larger export succeeds. Complete larger exports require a reviewed durable archive or multipart protocol, encryption/key policy, owner-only storage, expiry/deletion ownership, resume semantics, cross-source snapshot design, and hosted near-limit/over-limit/interruption/heap evidence. Mobile still eagerly parses the bounded server response and builds its local-device wrapper in memory; native file-stream and memory proof remain open.
