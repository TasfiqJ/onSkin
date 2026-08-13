# Progress And Shelf Route-Ownership Checkpoint

Date: 2026-07-15 (America/Toronto)
Branch: `optimization`
Implementation SHAs: `bb3e01f8daf540092817085872d1e4e4dd418ab2`, `7ce66e36ef0a2c53880d5805205cfc3991f46946`
Evidence class: `command`, source-level observer inventory, code review, and Expo-web `e2e`

This sanitized checkpoint covers the Progress and Shelf slices of OPT-104, OPT-105, and OPT-114. It records route ownership, focus teardown, list virtualization, encrypted-storage recovery, mutation publication, automated gates, and human-simulated Expo-web behavior. It does not claim a native QueryObserver capture, React flamegraph, frame-time improvement, memory reduction, encrypted-thumbnail pipeline, decrypt-scheduler result, or physical-device verification.

## Progress Result

- The Progress tab owns one local-date identity and one photo query. Trend receives that exact photo result instead of mounting another photo observer.
- Capture, Review, and photo detail now use one narrow `ProgressPhotoRouteSource` below entitlement and photo-lock gates. Each direct route falls from two photo observers and two date subscriptions to one of each.
- Review's `usePreventRemove` and plaintext cleanup owner remain outside every conditional entitlement, lock, storage, and analysis gate.
- An unfocused `ProGate` now mounts only `useIsFocused`; entitlement, offering, action, owner, layout, state, and effect hooks exist only in the focused child. A retained inactive route therefore owns none of that query/mutation graph.
- `PhotoStorageBoundary` does not trust cached success. It accepts the active cold or stale same-mount fetch only after it settles, forces one validation read for fresh cached data, and never mounts private route content before entry validation succeeds. Cold, stale-cache, cached-fresh, remount-failure, same-mount-publication, retry, and later-background-fetch cases are covered.
- Failed photo mutations neither invalidate nor reread encrypted storage. Successful add, reference, remove, and note mutations return the exact durable store snapshot and synchronously derive every existing current-owner local-day/series cache. Stale owners and malformed/non-photo keys receive no publication.
- The timeline uses `SectionList`; the comparison picker uses horizontal `FlatList`; route blur unmounts the image-bearing subtree while retaining only the selected Compare/Timeline mode.

The blur claim is deliberately narrow. Production query data contains encrypted file URIs plus decrypted metadata/notes, not decrypted image bytes; TanStack's normal cache lifetime can retain that data after the final observer unmounts. Decoded `PhotoImage` state is unmounted and the shared decoded-image cache is cleared at stronger privacy boundaries. A separate cache-retention decision and native memory trace remain required before claiming zero private JavaScript state after blur.

## Shelf Result

- The loaded Shelf collection and archive use `FlatList` with stable product IDs and narrow memoized rows.
- Filter state and per-filter scroll offsets live above the focus-gated query subtree. Returning from detail/archive or another tab retains the selected filter and its position without keeping the private Shelf observer mounted.
- Static title, insight, footer, and product-card shells are isolated from filter-only rerenders.
- The Shelf layout owns one injected route source. Product detail reuses that exact snapshot; Plan/Ramp/Cycle guidance mounts only for an active product. Archived and missing products mount none of those three observer families.
- Invalidated Shelf data is masked as pending/non-success until the strict read completes, so stale embedded profile/conflict guidance cannot render during refresh. Normal route remounts reuse the verified cache without another encrypted read.

## Commands And Results

| Command or review                                                   | Result                                             |
| ------------------------------------------------------------------- | -------------------------------------------------- |
| Progress storage/source/mutation/ProGate focused matrix             | Pass, 6 files / 114 tests                          |
| `npm --workspace apps/mobile run test`                              | Pass, 304 files / 3,814 tests                      |
| `npm test`                                                          | Pass, 304 files / 3,814 tests                      |
| `npm --workspace apps/mobile run typecheck` and `npm run typecheck` | Pass                                               |
| `npm --workspace apps/mobile run lint` and `npm run lint`           | Pass, zero warnings                                |
| `git diff --check` and staged-scope audit                           | Pass; unrelated dirty-worktree files excluded      |
| Progress direct-source/privacy review                               | No P0; cached-entry P1 and four P2 findings closed |
| Shelf adversarial re-review                                         | No remaining P0-P2 finding                         |

## Human-Simulated Expo-Web Evidence

Host: Windows development workspace
Surface: Codex in-app Browser against Expo web development builds
Viewport: 390 x 844 supported-phone class
Fixtures: three deterministic silhouette Progress photos; two deterministic Shelf products; Pro entitlement
Raw screenshots/DOM/terminal output: retained in the Codex task transcript, not committed as native evidence

Happy-path actions and observations:

1. Opened populated Progress, switched from Compare to Timeline, scrolled the virtualized month list, and opened the April 1 photo.
2. Verified detail rendered the deterministic photo, quality/date/reference metadata, note editor, share, and delete controls; Back returned to Timeline rather than resetting mode.
3. Switched to Shelf, selected Actives, opened active product detail, returned, marked the second product finished, opened archive, and opened archived detail.
4. Verified Actives remained selected, the archive count updated, active detail rendered routine guidance, and archived detail mounted no Routine role/guidance.

Fail-closed Progress recovery actions and observations:

1. Started a separate Expo web build with `EXPO_PUBLIC_E2E_PROGRESS_STORAGE_FAILURE=unavailable_once`, the populated photo fixture, and Pro entitlement.
2. Opened `/progress` and confirmed the only route content was the named `Private storage` alert, `Your timeline could not open`, and one `Try again` button. No photo, empty-timeline, missing-photo, camera, note, or action content mounted.
3. Activated Retry and reached the exact three-photo comparison surface in place.
4. Opened Timeline, photo detail, returned with Timeline retained, and opened capture at the exact photo-consent gate.
5. Captured 390 x 844 recovery, recovered timeline, and direct-detail screenshots. The terminal contained only the allowed placeholder Supabase and unsupported Expo-web notification warnings; no hook-order, route-source, or storage-recovery error appeared.

No new bug was discovered during the final human-simulated pass. The cached-entry privacy defect was found by source audit, fixed before acceptance, and rechecked through unit cases plus the one-shot live recovery flow.

## Verification Boundary And Next Action

OPT-104, OPT-105, and OPT-114 remain `investigating` because the plan requires representative stress data and native measurement. Next:

1. Generate encrypted thumbnail tiers and decide the photo-v2 migration path before adding a bounded, owner-generation-aware decrypt scheduler and byte-limited cache.
2. Capture 0/1/2/10/50/100/250-photo and representative Shelf/archive scroll traces in production-style Hermes builds.
3. Record predeclared QueryObserver counts, React commits/flamegraphs, interaction latency, dropped frames, JS/native memory, and route-blur/background behavior on the approved device scope.
4. Decide and test the metadata/note query-cache retention policy separately from decoded image teardown.

Rollback this checkpoint if cached private content can mount before a fresh entry proof, Review cleanup ownership is unmounted, a failed mutation causes a reread, a committed mutation publishes to the wrong owner/day/series, inactive routes retain query graphs, list virtualization breaks accessibility/navigation, or native profiling shows a material regression.
