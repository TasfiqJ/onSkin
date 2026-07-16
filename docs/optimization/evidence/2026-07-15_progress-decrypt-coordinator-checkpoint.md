# Progress Sensitive-Image Demand Checkpoint

Date: 2026-07-15 (America/Toronto)
Branch: `optimization`
Checkpoint parent SHA: `b519fde776172c518fe1e16f8c880b54fb9e4bf8`
Evidence class: source review, focused tests, repository gates, and Expo-web human-simulated E2E

This checkpoint covers the decision-independent part of PERF-P0-003, PERF-P0-004, OPT-103, OPT-104, and the Progress slice of OPT-114. It adds an owner-generation-bound decrypt-demand coordinator, visible-cell demand, overlay teardown, and lightweight selection retention without inventing the unapproved photo-v2 envelope or rendition parameters.

## Local Implementation Result

- `SensitiveImageDecryptCoordinator<TResult>` admits only a production cap of one or two operations; the current photo-v1 adapter uses one because JSON, hex, base64, and data-URI conversion amplify memory in JavaScript.
- Requests are keyed by owner generation plus opaque photo/rendition identity. Same-identity in-flight work is deduplicated, priorities are deterministic (`interactive`, `visible`, `adjacent`), queued work is cancelable before native I/O, and detached running results cannot publish.
- Owner generation is checked before admission and again after decrypt. A purge rejects every consumer, detaches queued/running results, and retains no resolved data URI.
- A resolved LRU is deliberately absent. V1 cannot provide a trustworthy decoded-byte cost, so a nominal item-count or encoded-byte cache would violate the plan's byte-bounded requirement. An approved v2 native-handle path may add a ref-counted, byte-budgeted cache later.
- `PhotoImage` fails closed for encrypted sources without an opaque photo ID, uses `cachePolicy="none"`, disables transitions, supplies stable opaque `recyclingKey` values, and unmounts the state/native image subtree when demand or privacy authority closes.
- A photo mounting while AppState is inactive cannot admit decrypt work. Background/inactive, memory warning, app/photo lock, explicit purge, account isolation, and successful deletion synchronously purge mounted data URIs and coordinator publication, then clear Expo Image's decoded-memory cache. Foreground recovery waits for the latest clear to settle before reloading only still-mounted demand.
- Startup begins a retry-safe native `Image.clearDiskCache()` scrub for possible residue created before the explicit no-cache policy. Encrypted display remains fail-closed until that scrub succeeds; web is a no-op. The scrub runs once per process after success, and a false/rejected attempt remains retryable.
- Successful deletion navigates after synchronous publication/coordinator teardown instead of awaiting the potentially unbounded native memory-cache clear.
- Progress Timeline and the comparison picker gate photo demand with `SectionList`/`FlatList` viewability. Picker and time-lapse overlays pause the image subtrees beneath them. Timeline/picker cells prefer `thumbnailLocalUri` but safely fall back to the current v1 original.
- Compare mode and opaque photo IDs live above the focus-gated private subtree. They survive tab blur without retaining picker state or decrypted image state.
- Timeline helpers are generic over `PhotoMeta`, preserving richer `PhotoRecord` fields such as `thumbnailLocalUri` through series, grouping, comparison, reference, and milestone derivation.

## Focused And Human Evidence

| Evidence | Result |
| --- | --- |
| Coordinator, `PhotoImage`, lifecycle, disk-cache migration, policy, Progress-route, and timeline tests | PASS, 7 files / 54 tests |
| Full repository/mobile tests | PASS, 306 files / 3,830 tests |
| Root/mobile TypeScript | PASS |
| Root/mobile ESLint | PASS, zero warnings |
| Expo-web Progress flow | PASS at 390 x 845 CSS pixels |
| Layout probe | 0 px horizontal overflow; 0 visible controls below 44 x 44 |
| Browser runtime | No errors; only expected local Supabase and Expo-web notification warnings |

Raw reviewed artifacts and the step log are in `test-results/human-e2e/2026-07-15/progress-decrypt-coordinator-current/`.

The live pass proved that the comparison pair releases its images under the picker, May 12 / Jun 24 selection survives Today -> Progress, only virtualized Timeline demand is active, and Timeline images release under the time-lapse modal. The web fixture does not exercise encrypted native bytes, so this is behavioral evidence rather than a decrypt-time, memory, cache-directory, or frame-time claim.

## Status Interpretation

- PERF-P0-003, OPT-001, and OPT-002 remain `implemented`, not `verified`: the local policy/lifecycle path is complete, but physical SDWebImage/Coil/temp-directory and decoded-memory proof remains.
- PERF-P0-004 remains `investigating`: virtualization, viewability, scheduler, cancellation, recycling identity, overlay pause, and focus teardown are present; encrypted thumbnails, a v2-native result/cache path, and required stress traces are not.
- OPT-103 advances from `not-started` to `investigating`: bounded concurrency, in-flight deduplication, priority, cancellation, purge, and owner fencing are implemented, while a byte-bounded resolved cache and native concurrency/memory traces remain pending v2.
- OPT-104 remains `investigating`: Timeline/picker virtualization and viewability demand are implemented, but cells still fall back to full-size v1 images and no 50/100-photo native scroll trace exists.
- OPT-114 remains `investigating`: the lightweight Progress selection/focus contract has behavioral evidence, not a native flamegraph or QueryObserver trace.

## Decision And Verification Boundary

OPT-101 and OPT-102 remain gated by unapproved OPT-DEC-001 (photo-v2/native envelope) and OPT-DEC-009 (dimensions, format, quality, and thumbnail tiers). This slice does not alter storage format, generate thumbnails, choose rendition dimensions, add a persistent plaintext cache, or rewrite unchanged `notesCiphertext` during migration.

The legacy-residue mitigation now clears Expo Image's global native disk cache once per process before encrypted display and retries false/rejected attempts. This is deliberately broader than a per-photo cache because expo-image exposes only a global clear. Physical startup/cache-directory proof and the cold-start/network-image tradeoff remain open; a durable one-time install marker must not replace the per-process scrub until rollback/downgrade behavior is proven safe.

Next actions:

1. Approve OPT-DEC-001 and OPT-DEC-009, then implement authenticated, atomic original/thumbnail v2 renditions with AAD binding owner namespace, photo ID, rendition, MIME, dimensions, and format version.
2. Replace v1 data-URI results with ref-counted native handles and profile a decoded-byte-bounded cache before enabling any resolved retention.
3. Run 0/1/2/10/50/100/250-photo encrypted fixtures and repeated compare/picker/detail/time-lapse/tab/background/account-switch/delete loops.
4. Capture native filesystem, decoded-memory, decrypt-concurrency, frame-time, and relaunch evidence on approved physical devices.
