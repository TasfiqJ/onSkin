# Progress Sensitive Query Cache Eviction Checkpoint

Date: 2026-07-21 (America/Toronto)

Branch: `optimization`

Evidence class: real TanStack Query lifecycle tests and supported-phone Expo-web human-simulated E2E

Status: Inactive full-photo query retention is locally closed. PERF-P0-004 and OPT-115 remain `investigating` because encrypted thumbnails/native handles, production-Hermes memory/frame traces, native keyboard/accessibility, SecureStore/filesystem, process-kill, and signed-device lifecycle proof remain open.

## Baseline And Risk

`usePhotosFromBoundary` returns derived data that still contains every complete `PhotoRecord`. That includes private notes plus `localUri`, `encryptedLocalUri`, `thumbnailLocalUri`, storage paths, and encryption metadata. The query inherited the repository default inactive lifetime, so releasing the final Progress observer could leave those full records in memory for five minutes even though durable encrypted storage is the source of truth.

## Implementation

- `photoQueryOptions` owns the exact photo-query policy and sets `gcTime: 0` only for this sensitive result. Global query defaults and non-photo caches are unchanged.
- Multiple active observers still share and retain one query. TanStack removes it as soon as the last observer leaves and the fetch is idle.
- The local store read does not consume TanStack's transport cancellation signal, so an in-flight final read is allowed to settle under the existing account-generation owner lease; the zero GC schedule then removes the now-unobserved result immediately.
- Mutation publication continues to enumerate only already-owned caches. If the final observer caused eviction, a later durable mutation has no query key to update and cannot recreate private data.
- Account change, sign-out, deletion, App Lock, and photo-timeline lock retain their stronger cancellation, clear, and decoded-image purge behavior.
- `photoQueryCacheDiagnostics.ts` exposes one development-only integer execution count. It accepts no query key, date, series, photo, note, URI, owner, path, storage value, duration, error, or provider field.

## Verification

| Check | Result |
| --- | --- |
| Cache/storage/route focused matrix | Pass, 4 files / 49 tests |
| Mobile TypeScript | Pass |
| Targeted zero-warning ESLint | Pass |
| Repository TypeScript | Pass, 2/2 workspaces |
| Repository lint | Pass, 2/2 workspaces with zero warnings |
| Repository tests | 348 files / 4,158 tests pass; the same 2 files / 4 assertions fail in unrelated dirty notification and Shelf metadata work |
| Harness syntax | Pass |
| Shared-observer cache retention | Pass until the final unsubscribe |
| Last-observer eviction | Pass; query state becomes absent |
| Late non-cancellable completion | Pass; settled result leaves no cache residue |
| Unobserved mutation | Pass; zero `setQueryData` calls and no query recreation |
| Expo-web viewport | 390 x 844 |
| Human tab cycles | Progress -> Today -> Progress, repeated twice |
| Query executions | Exact `1 -> 2 -> 3`, one per Progress mount |
| Restored Timeline actions | 10/10 after each return |
| Storage-unavailable states | 0 |
| Horizontal overflow | 0 px |
| JavaScript dialogs | 0 |
| Unexpected browser warnings/errors | 0 |

Raw screenshots, one-integer metrics, browser/Expo logs, and the run report are in `test-results/human-e2e/2026-07-21/progress-query-cache-eviction-current/`.

## Privacy And Scope

The E2E fixture contains deterministic non-user dates, opaque IDs, and a shared tiny unencrypted development image. The retained packet contains no real photo, note, account identifier, credential, key, encrypted storage value, URI/path inventory, query key, or provider payload.

This closes the decision-free inactive TanStack query-retention gap. It does not prove native encrypted-storage latency, filesystem residue, process-kill behavior, decoded-memory ceilings, frame pacing, Dynamic Type, VoiceOver/TalkBack, or signed-release performance.
