# Maximum React Native Optimization Plan

Date: 2026-07-12
Status: proposed engineering source document; not proof of completion
Implementation ledger: `docs/optimization/IMPLEMENTATION_STATUS.md` (the task-register statuses below are the original audit snapshot)
Scope: RoutineKind mobile app, Supabase backend, native build pipeline, release evidence, and production operations
Primary objective: maximize the practical performance, reliability, privacy, and native quality ceiling of the existing Expo React Native architecture on supported iOS and Android phones

## 0. Executive Verdict

The app should remain Expo React Native. A whole-app Swift rewrite would discard Android, duplicate product logic in Kotlin, slow iteration, and create more correctness and privacy risk than it removes. The current architecture can support a serious subscription business.

The current implementation is not yet maximally optimized and cannot honestly be described as performance-proven. The repository correctly marks performance `needs-device-verification`. The main gap is not a weak framework. It is a set of concentrated systems problems:

1. Full-resolution encrypted photos move through base64, JavaScript, hexadecimal ciphertext, JSON, full data URIs, and non-virtualized UI.
2. Sensitive images do not explicitly override `expo-image`'s documented disk-cache default.
3. Startup is a serial font, auth, account-isolation, app-lock, and full-private-storage verification chain.
4. The native export includes substantially more font assets and JavaScript than the app intentionally uses.
5. Growing user collections are rendered with `ScrollView`; there are no virtualized lists in the mobile source.
6. Several local stores still use non-atomic read/modify/write flows and destructive or fail-empty corruption handling.
7. The offline synchronization layer is incomplete and does not provide one transactional, owner-bound outbox.
8. Query lifecycle, focus, connectivity, and subscription reconciliation are not designed as one coherent mobile policy.
9. Production performance telemetry is intentionally absent because Sentry tracing is prohibited by the current privacy audit; a reviewed privacy-safe alternative is required.
10. Physical-device performance, memory, thermal, battery, backup, and accessibility evidence is still missing.

The correct end state is approximately 98-99% React Native/TypeScript. One narrow Expo native module may be justified for streaming binary photo encryption/decryption, protected file handling, and in-memory image decoding. That is not a Swift/Kotlin rewrite; it is the normal way a high-quality React Native app handles a measured native hot path.

## 1. Audit Basis And Snapshot

This plan was produced from a read-only audit of:

- the complete active strategy and launch documentation;
- 1,198 repository files visible during the audit;
- 341 non-test mobile TypeScript/TSX files and approximately 51,000 production source lines;
- 197 mobile test files and approximately 26,700 test lines;
- 76 route screens and 14 route layouts;
- 19 non-test Supabase Edge Function TypeScript files;
- 39 SQL migrations;
- root/native app configuration, Metro, Babel, NativeWind, EAS, Turbo, and CI configuration;
- current local storage, authentication, subscription, analytics, notifications, catalog, camera, and photo implementations;
- a fresh Expo native export for both iOS and Android;
- the current dirty worktree, including in-progress photo transaction, app-lock single-flight, and auth-storage hardening work.

Audit Git base: `fc5d512f7e0ccbab8d3b5a2beb4268dd8a24595f` on `main`.

The worktree changed during the audit. Existing uncommitted changes belong to the user and were not overwritten. Findings labeled **in progress** exist in that dirty worktree but are not considered complete until independently reviewed and verified.

### 1.1 Current mobile surface inventory

| Item                                                  |  Current observation |
| ----------------------------------------------------- | -------------------: |
| Route screens                                         |                   76 |
| Route layouts                                         |                   14 |
| Route/layout TSX lines                                | approximately 22,800 |
| Routes using `ScrollView`                             |                   49 |
| Files referencing `ScrollView` across mobile UI       |                   57 |
| `FlatList` / `SectionList` / `VirtualizedList` usage  |                    0 |
| Route files over 500 lines                            |                   11 |
| Mobile test files                                     |                  197 |
| Tests based partly on source-file string contracts    |             53 files |
| Current required physical-device performance evidence |              missing |

Large components are not automatically slow, but broad route state changes can rerender large trees, make profiler results harder to interpret, and increase regression risk. Component extraction must be driven by measured render boundaries rather than aesthetics alone.

### 1.2 Measured native export inventory

Commands used:

```bash
npx expo export --platform ios
npx expo export --platform android
npx expo export --platform android --dump-sourcemap
```

These were production-style Hermes exports using the current default development app variant, not signed App Store or Play Store artifacts. They are suitable for finding bundle composition problems, not for declaring final download or installed size.

| Measurement                                 |                              iOS |                          Android |
| ------------------------------------------- | -------------------------------: | -------------------------------: |
| Metro modules bundled                       |                            2,769 |                            2,855 |
| Hermes bytecode without external source map |             approximately 9.9 MB |            approximately 10.0 MB |
| Hermes bytecode with external source map    |                      not sampled |             approximately 8.3 MB |
| Exported assets                             |             approximately 3.2 MB |             approximately 4.1 MB |
| Exported font-family files                  | 34 files / approximately 3.17 MB | 34 files / approximately 3.17 MB |
| Additional Android Material Symbols font    |                              n/a |            approximately 0.93 MB |

The app intentionally uses eight font files totaling approximately 0.66 MB, but importing named fonts from each family root causes all 34 weights/styles to be discovered by Metro. This is a confirmed, measurable packaging problem.

The Android source-map analysis also found these large contributors by source content. Source characters do not equal final bytecode one-for-one, but they identify high-value bundle investigations:

| Contributor                             | Approximate source contribution | Observation                                                         |
| --------------------------------------- | ------------------------------: | ------------------------------------------------------------------- |
| RevenueCat hybrid mappings              |                         0.73 MB | Required for subscriptions, but unusually large and must be tracked |
| React Native renderer + Fabric renderer |                0.72 MB combined | Framework cost; verify only expected renderer posture ships         |
| Sentry core group                       |                         0.75 MB | Required crash reporting code                                       |
| Sentry replay module                    |                         0.30 MB | Present despite session replay being disabled                       |
| Expo Router                             |      1.15 MB across 362 modules | Route/runtime cost; full route graph is packaged                    |
| Reanimated                              |      0.85 MB across 286 modules | Used principally by the comparison slider                           |
| App routes                              |          0.78 MB source content | Product breadth is visible in bundle size                           |
| App features                            |          0.70 MB source content | Deterministic engines and gated surfaces are packaged               |
| Supabase auth                           |                         0.39 MB | React Native export resolves the supported CommonJS build           |
| PostHog core                            |                         0.30 MB | Analytics is lazy at runtime but still exists in bytecode           |

Do not remove required SDKs merely to make a bundle chart smaller. Establish a canonical signed-release size gate, then investigate supported modular imports, SDK upgrades, feature exclusion, and dependency alternatives with real behavior tests.

### 1.3 Current strengths to preserve

- Expo SDK 56, React Native 0.85, React 19, Hermes, Expo Router, and React Compiler are a sound base.
- React Compiler is enabled. Blanket manual memoization would add complexity without guaranteed benefit.
- Gesture Handler and Reanimated keep comparison-slider gesture updates off the JavaScript thread.
- Camera routes mount camera views only when focused.
- Progress lighting analysis already downsamples to a 64 px sample and deletes it.
- Face analysis is post-capture, on-device, and configured without unused contours, landmarks, classifications, or tracking.
- TanStack Query deduplicates identical query requests.
- PostHog and RevenueCat runtime initialization are already dynamically imported.
- Catalog search is submitted explicitly rather than called on every keystroke.
- The account boundary, private-KV gate, photo lock, and export lease demonstrate strong fail-closed intent.
- The dirty worktree adds photo mutation serialization, staged writes, quarantine/recovery, non-destructive photo metadata errors, stronger auth ciphertext preservation, and biometric single-flight protection.
- Android backup is disabled.
- Human-simulated web evidence is extensive, and the deterministic engine test suite is unusually broad.

These foundations should be optimized, not replaced.

## 2. What “Maximized” Means

“Maximized” is not a one-time refactor and it is not a claim that every function is memoized. It means the following remain true for every release:

### 2.1 Runtime outcomes

- Cold start, warm start, route navigation, taps, typing, scrolling, camera, barcode, routine generation, photo analysis, and subscription gates pass predeclared p95 thresholds.
- Critical gestures and animations meet the target device's frame deadline without repeatable jank.
- Memory reaches a stable plateau under realistic long sessions and returns toward baseline after sensitive/heavy routes are left.
- No supported device crashes, receives an OS memory termination, or produces an Android ANR during the acceptance matrix.
- Offline-first actions complete locally without waiting for the network.
- Network reconciliation never blocks the tap-critical path unless correctness requires it.
- Battery, thermal, network, disk, and secure-storage usage remain bounded.

### 2.2 Product outcomes

- A user can add three real products and reach the first useful insight without lag or dead ends.
- Today opens quickly and a completion responds immediately.
- Progress remains private while scrolling smoothly with a mature photo history.
- Pro users do not wait on redundant offering/server calls to enter already-authorized features.
- A slow backend never makes the local product feel broken.
- Premium polish includes correct status bars, keyboard behavior, motion preferences, screen readers, safe areas, and native back behavior.

### 2.3 Engineering outcomes

- Performance budgets are versioned and checked before release.
- Every regression is attributable to a route, dependency, query, storage operation, or native module.
- Every high-growth collection has a scale plan.
- Every persisted record has a schema, codec, migration, corruption policy, export policy, cleanup policy, and owner-bound concurrency contract.
- Performance fixes preserve privacy, safety rules, account isolation, and release gates.
- No performance claim is closed with Expo Go, development mode, one sample, or browser-only evidence.

## 3. Non-Negotiable Guardrails

Optimization must not weaken the following accepted decisions:

1. Photos remain device-only by default.
2. Missing, malformed, unavailable, or wrong encryption keys never trigger automatic key rotation or ciphertext deletion.
3. Account changes block the next account until prior-owner operations and cleanup drain.
4. Safety, pregnancy, routine, and conflict guidance remain deterministic and review-gated.
5. Recommendation ranking remains independent from commerce.
6. Owner-scoped RLS remains enabled.
7. Sensitive photo, health, product, free-text, route parameter, and identity data never enters logs or telemetry.
8. Sentry performance tracing remains disabled under the current Phase 9 privacy contract. Enabling it requires an explicit privacy/security decision and audit update.
9. iOS 17+ and Android 10/API 29+ remain the install floor unless the device-support policy changes.
10. Performance thresholds must be declared before the official evidence is collected.
11. Any photo storage-format, key-accessibility, backup, native-processing, or local-database architecture change requires the Master Plan Update process plus privacy/security review.

## 4. P0 Optimization And Quality Gates

These items block any claim that the app is maximally optimized.

### PERF-P0-001 — Establish a canonical performance baseline

Current state: the repository has a strong evidence schema and validator, but no completed physical-device artifact and no filled thresholds.

Required work:

- Name the threshold owner and independent signoff owner.
- Define every existing `maxP95` and rationale before official measurement.
- Add internal sub-stage metrics for startup, storage, images, renders, network, and memory.
- Define one canonical release build command and artifact identity.
- Collect at least five raw samples per existing metric/platform.
- Record p50, p95, maximum, errors, crashes, OS kills, device/OS/build/source SHA, dataset, network condition, and test method.
- Retain raw Instruments/Perfetto/Android Studio exports, not only entered summaries.

Done when:

- `phase5:performance-evidence:strict` passes against a real artifact;
- all values are derived from raw samples;
- thresholds predate evidence;
- zero crashes and OS terminations are recorded;
- a named owner signs the beta decision.

### PERF-P0-002 — Replace the current full-resolution photo path

Current state:

- the camera output retains unrestricted dimensions;
- image bytes are read as base64;
- metadata stripping decodes and re-encodes in JavaScript;
- XChaCha20-Poly1305 encrypts the base64 text;
- ciphertext is hex encoded and placed inside JSON;
- persisted bytes are approximately `2.67 × original JPEG size` before JSON overhead;
- display recreates a full data URI on the JavaScript heap;
- every mounted `PhotoImage` can start this work independently.

Required v2 design:

- Define `photo-v2` as a versioned binary envelope with a fixed magic value, version, rendition, MIME, pixel dimensions, nonce, and raw authenticated ciphertext.
- Bind logical photo ID, rendition, schema version, owner/storage namespace, MIME, and dimensions as AEAD associated data.
- Validate file magic and decoded format; do not infer MIME only from a path suffix.
- Natively normalize orientation and strip metadata.
- Generate at least these logical renditions:
  - thumbnail for timeline/pickers/reference ghost;
  - bounded display image for compare/detail/time-lapse;
  - optional original only if a reviewed product requirement justifies it.
- Choose pixel dimensions and compression from rendered-size/device-density evidence, not arbitrary maximum-camera output.
- Encrypt file-to-file off the JavaScript thread.
- Keep the source until all encrypted renditions authenticate and metadata commits.
- Delete source and temporary files only after commit.
- Preserve a read-only v1 path and write new captures only as v2.
- Journal migration and crash recovery without storing raw identity or image data.
- Add disk-space preflight and storage-full recovery.

Preferred implementation:

- a narrow Expo Modules API implementation shared behind one TypeScript interface;
- Swift implementation for protected file transforms on iOS;
- Kotlin implementation for protected file transforms on Android;
- no product rules, UI, navigation, analytics, or business state in native code.

Done when:

- photo storage no longer moves production-sized images through JS base64/hex;
- v2 encrypted size is close to encoded source size plus authenticated-envelope overhead;
- v1 data migrates without loss;
- capture, display, share, delete, account change, crash, and storage-full matrices pass;
- performance and privacy evidence passes on physical devices.

### PERF-P0-003 — Make sensitive image caching explicit

Current state: `PhotoImage` explicitly uses `cachePolicy="none"` and zero transition for every photo source. Encrypted display remains fail-closed until a retry-safe once-per-process native disk-cache scrub succeeds, covering possible residue from older builds. Physical SDWebImage/Coil/cache-directory inspection and startup-cost evidence remain outstanding.

Required work:

- Set an explicit sensitive-image cache policy; default recommendation is memory-only for unlocked in-process display, or `none` if memory behavior cannot be bounded.
- Never allow a decrypted sensitive rendition into a general disk cache.
- Use a dedicated byte-bounded, owner-generation-bound cache only if required for smoothness.
- Key cached entries by opaque owner generation, photo ID, and rendition; never by raw path in telemetry.
- Clear memory caches on app lock, photo lock, background/inactive, account change, sign-out, deletion, and memory warning.
- Prove that `expo-image`, SDWebImage, Coil, platform temp directories, share cache, and thumbnails contain no recoverable plaintext after relaunch/lock/account change.
- Disable crossfade transitions in dense lists or under Reduce Motion because transitions can temporarily retain two decoded bitmaps.

Done when:

- filesystem inspection finds no plaintext photo cache;
- memory purge behavior is demonstrated;
- the privacy audit and storage inventory reflect actual behavior.

### PERF-P0-004 — Add encrypted thumbnails and virtualize Progress

Required work:

- Populate `thumbnailLocalUri`; it is currently always `null` for new photos.
- Replace the Progress timeline `ScrollView` with `SectionList`.
- Replace the comparison picker with a horizontal `FlatList`.
- Render thumbnails only for cells and pickers.
- Add a central decrypt scheduler with visible-cell priority, request deduplication, cancellation, and a profiled concurrency cap.
- Use a byte-bounded LRU; clear it at all privacy boundaries.
- Add stable `recyclingKey` values to image cells.
- Prefetch only the next/previous time-lapse or comparison frame.
- Release data when Progress loses focus; do not let an inactive tab retain a mature timeline of data URIs.
- Retain a lightweight mode/selection state separately from decrypted content.

Engineering stress datasets:

- 0, 1, 2, 10, 50, 100, and 250 photos;
- malformed/missing/tampered rendition;
- low disk space;
- app background during decrypt;
- account switch during decrypt;
- repeated timeline/compare/picker/detail/time-lapse/tab-switch loop.

### PERF-P0-005 — Make all private stores atomic and non-destructive

Confirmed issue: `privateKV.updatePrivateItem` provides an atomic same-key primitive, but Shelf, completions, ramp, routine order, notification logs, recommendations, milestones, reactions, and the completion queue often perform a separate read followed by a full snapshot write. Per-key serialization inside `setPrivateItem` cannot protect a read completed before the lock.

Required work:

- Give every record a top-level schema version.
- Define strict parse/normalize/encode functions that do not perform I/O.
- Perform the complete read/transform/write inside `updatePrivateItem` or a transactional local database.
- Distinguish missing, unavailable, malformed, unsupported-future, tampered, and valid-empty states.
- Preserve original bytes for every unavailable/malformed/unsupported state.
- Never translate unreadable into empty.
- Never delete malformed data without an explicit authenticated recovery action.
- Add atomic migration journals and compare-and-swap semantics.
- Add no-op detection so repeated completion taps or identical preference saves do zero writes.
- Add 100-way concurrent mutation tests per high-value store.
- Add a registry test requiring schema, codec, export, cleanup, reset, and recovery policies for every private key.

The dirty photo-store changes move Photos toward this contract and should be used as a reviewed pattern, not copied blindly.

### PERF-P0-006 — Bind every server write to the account generation

Current root account isolation is strong, but shelf mirrors, consent writes, scan logs, photo server deletion, notification mirrors, and offline flushes do not all use the same account-generation lease.

Every account-scoped operation must:

1. Capture the expected owner before accepting data.
2. Run under the account-generation lease.
3. Use the lease abort signal where supported.
4. Assert owner/generation before request, before local post-write publication, and after response.
5. Drain during account isolation.
6. Refuse to discover “who is current” after receiving a payload produced for a previous owner.
7. Be idempotent under retry.

Required delayed tests:

- account A shelf add/edit/delete/replenish versus A-to-B;
- consent grant/withdraw versus sign-out;
- barcode/scan log versus token refresh/account change;
- completion flush versus account change;
- photo delete versus account change;
- notification/server-log mirror versus account change;
- same-user token refresh, which must not cancel valid work.

### PERF-P0-007 — Build a real transactional offline outbox

Current state:

- Shelf mutations, conflict choices, and authenticated notification/recommendation preference writes atomically commit their complete encrypted local snapshot plus an owner-bound outbox intent through crash-recoverable private-KV transactions. Conflict choices additionally snapshot both referenced Shelf products in the same three-key transaction so their server dependency cannot be omitted. Immediate notification delivery first reserves a bounded encrypted cap-ledger event, then atomically marks that exact event delivered and appends its authenticated content-free outbox operation only after the OS accepts it. Shelf-scan intake appends an immutable payload-bound event. Signed-out conflict/recommendation choices and notification deliveries remain local-only.
- One account-generation-fenced, awaitable single-flight worker leases bounded batches and runs after mutation, foreground, and connectivity recovery with persisted jitter/backoff, safe failure classes, and poison-row isolation. Direct callers share the same promise, coalesced result counts cover every pass, and terminal wake requests cannot be lost.
- Durable row ownership and state-stream IDs derive from the hashed account owner rather than process-local generation. The version-5 envelope keeps revision high-water marks owner-scoped, preserves version-1 through version-4 data during migration, canonicalizes UUID identities, and prevents two owners with the same entity UUID from interfering.
- Entity-scoped leasing, status, retry, and settlement isolate all six domains. Shelf products lease before conflict projections, and a conflict remains ineligible while either referenced product has pending Shelf work, including backoff or leased work. Obsolete dead state snapshots are pruned or ignored, older leased snapshots are fenced at settlement when a newer same-owner revision exists, and deleting a dependency discards its impossible projection while retaining the revision fence. Immutable notification-delivery and Shelf-scan events use unique IDs, revision one, and never coalesce.
- The authenticated batched RPCs provide ordered Shelf revision application, operation-idempotent notification/recommendation preference application, replay-safe notification-delivery/Shelf-scan insertion, and rule/product-validated conflict projection. They isolate per-row validation, derive ownership from authentication, retain exact replay receipts, and revoke the replaced direct authenticated table mutations.
- Shelf (including conflict projections), Notification Settings/Timing, and Recommendation Preferences distinguish saved-local, syncing, and needs-attention states without blocking local use. Status reads, manual dead-row retry, and delivery diagnostics remain current-owner-only and content-free; immutable telemetry does not add a misleading user-visible sync state.
- Completion history remains intentionally outside this contract until authoritative server routine/step UUID mapping exists. Onboarding and consent publication still require a safe terminal-reconciliation design before adoption. Hosted RPC replay/RLS/concurrency, physical-device process-kill/offline/reconnect/duplicate-worker proof, cross-device conflict revision policy, and long-lived revision-cap evidence remain open.

Required outbox fields:

- operation ID;
- owner hash/account generation;
- entity type and stable entity ID;
- operation kind;
- schema version;
- sanitized encrypted payload;
- client revision/idempotency key;
- enqueue time;
- attempt count;
- next attempt time;
- safe error class;
- tombstone state for deletion.

Required behavior:

- Local data mutation and outbox append commit atomically.
- A single-flight worker runs after mutation, connectivity recovery, and foreground.
- Backoff uses exponential delay plus jitter.
- Permanent and transient failures are classified.
- Independent poison records do not block unrelated operations.
- Server writes use batched idempotent RPC/upsert contracts.
- Account cleanup drains active work and then removes only the correct owner's outbox.
- UI distinguishes saved locally, syncing, and needs-attention states without blocking bathroom/offline use.

### PERF-P0-008 — Prove protected storage and cleanup on both platforms

Required work:

- Move durable photos to an application-support location with explicit backup exclusion.
- Set reviewed iOS file-protection attributes.
- Set reviewed this-device-only Keychain accessibility for content keys while preserving required foreground access.
- Verify Android backup exclusion, Keystore invalidation, restore, reinstall, and storage-pressure behavior.
- Move each new capture immediately into a protected staging directory.
- Pass opaque capture session IDs through navigation instead of raw filesystem paths.
- Scavenge abandoned capture, share, and export plaintext on safe startup/foreground.
- Journal operations without private content.
- Add process-kill tests after every file and metadata step.
- Inspect a real iOS device backup and Android backup/restore attempt.

Done when the literal storage/privacy claims are proven, not inferred from sandbox location.

### PERF-P0-009 — Optimize startup without weakening gates

Current secure startup sequence:

```text
JS font load
  -> Supabase session restore
  -> account ownership/isolation
  -> app-lock preference read
  -> full app-owned private-KV enumeration/decrypt
  -> route tree
  -> onboarding/returning-user decision
```

Required work:

- Instrument each stage with a monotonic clock.
- Embed only required fonts and remove the runtime font gate.
- Keep the splash until one coherent secure-bootstrap UI can take over.
- Add font failure fallback.
- Split lightweight photo/account-boundary barriers from heavy crypto/file modules imported by `AuthProvider`.
- Load Apple/Google provider modules on provider action rather than root evaluation.
- Move backup cleanup, notification business logic, offering preload, behavioral derivation, and offline sync after first usable interaction unless a privacy gate requires earlier work.
- Consolidate independent checks into one bootstrap coordinator.
- Parallelize only tasks proven independent of owner publication.
- Cache private/photo content keys in memory only for the active unlocked account generation; clear after leases drain on lock/background/account boundary.
- Avoid unconditional SecureStore reads and marker writes for every record/image.
- Make private-storage foreground verification shield the mounted tree rather than remounting navigation, if a reviewed vault state machine can preserve the fail-closed contract.
- Evaluate a crash-safe encrypted manifest or transactional encrypted database before reducing the current exhaustive scan.

Required startup states:

- fresh install;
- returning onboarded user;
- 200 Shelf rows, long completion history, and 50-photo metadata set;
- app lock off/on;
- photo lock off/on;
- signed out with retained owner marker;
- same-user refresh;
- A-to-B cleanup;
- missing/malformed/unavailable keys;
- offline;
- low-storage/low-memory device.

Current local private-vault verification checkpoint (2026-07-21): the exhaustive startup gate still enumerates and authenticates every app-owned private-KV record before route admission, but it no longer routes that verification through the ordinary batch reader that materializes a `Map` of every decrypted plaintext value. A dedicated generation-bound verifier classifies the complete encrypted snapshot first, reads the existing content key once without creating key material, authenticates each current envelope one at a time without UTF-8 string conversion, and immediately discards the decrypted bytes. Malformed/future-envelope precedence, exact failed-read fencing, ciphertext preservation, foreign-key exclusion, and account-boundary invalidation remain unchanged. A 49-record stress case with 32 KiB plaintext values proves one content-key read, zero writes, unchanged ciphertext, and a void-only audit result; later-record corruption and delayed owner-A key reads remain fail closed. This reduces simultaneous decrypted-data retention without weakening or replacing the exhaustive scan, changing startup authorization, or adopting the unapproved manifest/database/shield architecture. Native peak-heap, protected-storage interruption, and signed-device startup distributions remain open. See `docs/optimization/evidence/2026-07-21_private-vault-verify-only-decrypt.md`.

Current lightweight photo-boundary checkpoint (2026-07-25): `AuthProvider` and its static `localAccountIsolation` dependency now import a dedicated coordinator whose only runtime dependency is the existing account-generation module. The complete singleton state machine moved together: nested boundary depth/generation, pure-read invalidators, mutation drain, destructive-operation tail, and account-generation leases. `encryptedStorage.ts` imports the same coordinator and re-exports its public compatibility API, so cleanup ordering and photo callers are unchanged. A recursive static-import contract rejects every `AuthProvider` path to the heavy crypto/filesystem module, while adversarial tests prove old-generation mutations still reject after a boundary reopens, queued destructive owner-A work never starts, and both import paths share one singleton. Focused 7-file / 100-test, type-check, zero-warning lint, and production iOS export proof pass. This is dependency-graph proof, not a native latency claim; repeated signed-device startup distributions remain open. See `docs/optimization/evidence/2026-07-25_lightweight-photo-account-boundary.md`.

### PERF-P0-010 — Remove the font asset explosion

Confirmed issue: root imports from the three font package indexes cause Metro to export every family weight/style.

Required work:

- Import each used face from its direct subpath, not the family root.
- Prefer native embedding through the existing `expo-font` config plugin.
- Include only:
  - Instrument Serif 400 regular and italic;
  - Hanken Grotesk 400, 500, 600, and 700;
  - IBM Plex Mono 400 and 500.
- Remove `useFonts` as a root mount gate after embedding is verified.
- Verify font internal names match every NativeWind token on both platforms.
- Verify missing glyphs, localization, Bold Text, Dynamic Type, and offline launch.
- Record before/after asset and signed binary size.
- Investigate the Android-only 0.93 MB Material Symbols inclusion through Expo Router/@expo/ui; do not hack node_modules or unsupported resolver internals.

Expected direct asset reduction from the current export is approximately 2.5 MB before platform packaging, subject to signed-artifact confirmation.

## 5. React Rendering And UI Workstream

### 5.1 Virtualize only collections that can grow

Convert now:

| Surface              | Current                                | Target                   |
| -------------------- | -------------------------------------- | ------------------------ |
| Progress timeline    | `ScrollView` + nested month/photo maps | `SectionList`            |
| Progress pair picker | horizontal `ScrollView`                | horizontal `FlatList`    |
| Shelf main list      | `ScrollView` + product map             | `FlatList`               |
| Shelf archive        | `ScrollView` + unbounded archive map   | `FlatList`               |
| Ask conversation     | `ScrollView` + message map             | keyboard-safe `FlatList` |

Revisit when data becomes server-backed or materially larger:

- recommendations grouped results;
- community notes/feed;
- commerce stacks;
- cycle night editor;
- routine reorder.

Keep ordinary `ScrollView` for bounded forms, policies, paywalls, settings, consent, and short detail pages. Virtualization adds focus, keyboard, measurement, and accessibility complexity and should not be used decoratively.

For each virtualized list:

- use stable domain IDs;
- extract a row component with narrow props;
- keep callbacks stable only where profiler data proves row rerenders;
- put static content in `ListHeaderComponent`/`ListFooterComponent`;
- implement empty/loading/error states through list props;
- measure `initialNumToRender`, `maxToRenderPerBatch`, `windowSize`, and clipping on the oldest-supported devices;
- use `getItemLayout` only for truly fixed-height rows;
- verify VoiceOver/TalkBack order and focus restoration;
- record blank-cell, recycling, and keyboard behavior.

Current local Shelf/archive checkpoint (2026-07-21): both growing collections retain `FlatList`, stable domain keys, memoized narrow rows, and list-owned header/footer boundaries. A development-web-only deterministic fixture is capped at 250 rows per collection and overlays only after the real Shelf availability query succeeds. Content-free Profiler counters and stable native IDs support exact traversal without retaining row content. A 390 x 844 Expo-web run traversed all 100 Shelf rows, exact 34-row Actives and 40-row Expiring subsets, and all 100 Archive rows without a blank sampled viewport; filter anchors and the semantic final-row boundary after Archive Back restored with zero horizontal overflow, dialogs, or unexpected logs. The run found and fixed stale outgoing-filter scroll callbacks and variable-height bottom-offset clamping without adding `getItemLayout`, filter remounts, or unmeasured window/clipping parameters. Signed supported-iOS frame, memory, focus/background, Dynamic Type, VoiceOver, and oldest-device tuning remain required before OPT-105 can be verified. See `docs/optimization/evidence/2026-07-21_shelf-archive-collection-stress.md`.

Current local Ask checkpoint (2026-07-21 audit): the keyboard-safe `FlatList` uses stable IDs, memoized rows, a latest 16-message presentation window, exact measured web prepend anchors, and native `maintainVisibleContentPosition`. The 202-message mixed-height web run traversed all 12 older-page boundaries, reached the oldest row with no blank viewport, retained exactly one prior anchor per boundary, mounted roughly 16 message rows at the oldest boundary, caused zero history commits or row renders while typing, and reset to the latest 16 messages after submission. Keeping the ephemeral logical transcript in route memory is an explicit source-retention tradeoff, not a measured recycler defect; persistent transcript paging would require retention, consent, purge, export, and account-deletion policy. No storage rewrite or bidirectional eviction behavior is authorized by this optimization plan without native evidence of a source-memory failure. Signed supported-iOS frame, memory, keyboard, focus/background, Dynamic Type, VoiceOver, and oldest-device proof remain required before OPT-105 can be verified. See `docs/optimization/evidence/2026-07-18_ask-history-prepend-anchor-checkpoint.md` and `docs/optimization/evidence/2026-07-21_final-decision-free-slice-audit.md`.

### 5.2 Build route-level view models

Current routes often compose hooks that recursively subscribe to the same domain queries. React Query deduplicates fetching but not observers, object construction, derivation, or React commits.

Priority routes:

- Today: plan, progress, cycle, ramp, shelf, recommendations, entitlement, and behavioral triggers;
- Ask: shelf, plan, recommendations, profile, messages, entitlement;
- Shelf detail: shelf, plan, cycle, replacements;
- Routine plan: plan and cycle;
- Progress: entitlement, photo store, lock, storage gate, trend.

Required pattern:

- one route view-model hook reads each domain snapshot once;
- deterministic plan/scheduler/recommendation output is memoized at the domain boundary;
- child components receive stable primitive/small-object props;
- narrow consumers use TanStack Query `select` with structural sharing;
- mutation results update the exact cache immediately instead of invalidating and rereading every encrypted store;
- no single giant context is introduced.

Profiler acceptance:

- one Today check-off does not rerender static headers, paywall copy, or recommendation sections;
- changing a Shelf filter rerenders only chips/list rows;
- typing in a composer does not rerender an entire history;
- routine generation runs only when actual inputs change;
- background notification preparation is absent from first-interaction commits.

Current local Routine Plan checkpoint (2026-07-25): the routine layout now owns one local-date boundary and one Shelf observer, passes that exact Shelf result through the fail-closed availability boundary, and exposes both to one route view model. Plan reuses the owner-leased profile inside Shelf and mounts routine order, ramp, and cycle config exactly once. The static routine-data graph falls from 9 QueryObservers and 3 local-date subscriptions to 4 and 1; the unchanged Pro gate makes the complete visible graph 11 to 6 observers. Retry ownership remains exact for Shelf, routine order, ramp/cycle config, and Start Today. Focused tests, independent re-audit, and supported-phone Expo-web Back/Start-to-Today/scroll/overflow checks pass. Signed supported-iOS QueryObserver, commit/flamegraph, interaction, date-rollover, accessibility, latency, and memory evidence remains required before OPT-114 can advance. See `docs/optimization/evidence/2026-07-25_routine-plan-route-view-model.md`.

### 5.3 Isolate text-input hot paths

Required changes:

- Move Ask composer state to a leaf component; virtualize/memoize messages.
- Move Progress note editor state below the full detail image shell.
- Move catalog search input state away from result cards.
- Use `useDeferredValue` or a short local debounce for noncritical OCR ingredient parsing while leaving raw input immediate.
- Move You-screen feedback/mutation state into section components.
- Prevent large form rerenders from changing camera or image subtrees.
- Test fast typing with long INCI input and 100 Ask turns.

Current local Progress-note checkpoint (2026-07-21): the single-photo editor remains below the full image shell and now owns a bounded single-flight save coordinator. Blur, end-editing, and an explicit dirty-state action share one idempotent path; concurrent requests coalesce to the newest explicitly requested draft, failure retains exact text and exposes accessible retry, and success advances the persisted baseline only after the exact store mutation resolves. Focused coordinator/store/owner-boundary tests cover unchanged input, same-draft event deduplication, coalescing, pre-write failure, commit-response loss, encrypted reload, retry convergence, late unmounted publication, and account replacement. A supported-phone Expo-web run through the real photo-metadata encryption/write/read path using the exact development-only web content-key harness retained the exact draft after deterministic failure, retried successfully, and restored the exact note after a fresh direct load. Native production-Hermes keystroke commits, frame/memory traces, keyboard/IME, VoiceOver, SecureStore, and process-kill proof remain required before OPT-115 can be verified. See `docs/optimization/evidence/2026-07-21_progress-note-persistence-recovery.md`.

### 5.4 Inactive-route lifecycle

Required changes:

- Measure and set an explicit tab freeze/detach policy.
- Stop query-driven renders in inactive tabs when safe.
- Tear down/release Progress's image-bearing subtree on blur while preserving minimal UI state.
- Clear decrypted caches on stronger privacy boundaries, not only blur.
- Keep camera focus gating.
- Verify no lifecycle hook relies on an inactive tab remaining rendered.
- Ensure background notification work lives outside visual tab trees.

### 5.5 Animation and gesture policy

- Keep interaction-critical gestures on the UI thread.
- Retain Reanimated for the compare wipe unless a measured alternative materially reduces bundle/startup cost without losing smoothness.
- Add accessible increment/decrement actions and value text to the compare control.
- Default to an accessible side-by-side presentation for screen-reader/Reduce Motion contexts, or make wipe fully operable.
- Stop dense image crossfades in lists.
- Honor Reduce Motion in onboarding analysis and every future continuous animation.
- Remove or justify the artificial 2.6-second onboarding “analysis” delay; never make real completion wait for theater.
- Avoid JavaScript-frame timers for high-frequency animation.
- Pause time-lapse on background, lock, interruption, and route blur; this is partly implemented and must remain.

### 5.6 Responsive and component architecture

- Extract shared viewport classifications rather than duplicating dozens of subtly different height/width branches.
- Keep support-floor distinctions separate from stress-only viewports.
- Centralize sheet safe-area, backdrop, focus, escape/back, and pending-write behavior.
- Extract large route sections only where profiler or ownership boundaries justify it.
- Move static style constants out of render when allocation traces show value.
- Do not replace NativeWind wholesale without a measured comparison; it provides product speed and consistency, but its runtime/bundle contribution should remain in the size report.
- Replace the most brittle source-string-only contracts with rendered component behavior tests over time.

## 6. Query, Cache, And Local Data Workstream

### 6.1 Mobile-aware TanStack Query policy

Previous global policy was a one-minute stale time and two retries. Required redesign:

- Bridge `focusManager` to React Native `AppState`.
- Add `onlineManager` only after selecting and inspecting a connectivity source.
- Define per-domain stale, retry, network, focus, and garbage-collection policies.
- Never retry deterministic schema, key, or privacy-gate failures.
- Avoid synchronized foreground refetch storms.
- Include owner/account generation in sensitive query keys even though global clearing remains mandatory.
- Include local date in date-sensitive Shelf/progress/cycle keys or centrally invalidate at local midnight/foreground.
- Keep sensitive queries unpersisted.
- Use short explicit photo-query `gcTime` and purge on lock/account change.
- Pass TanStack cancellation signals through supported network operations.

Current local query-policy checkpoint (2026-07-25): TanStack queries now deny
outer retries by default and keep rejected errors stable across mount, focus,
and reconnect until an owning recovery action explicitly refetches. Successful
stale snapshots still retain lifecycle refresh. Encrypted/local queries run
while offline and suppress automatic recovery; date-sensitive photo, Progress,
and cycle queries refresh only healthy current-day state. Queries already
wrapped by the bounded request policy cannot multiply its attempt budget, while
successful offline/typed fallbacks can heal after reconnect. Profile refresh
distinguishes a retryable server fallback from a deterministic unreadable local
record without changing the public profile payload. Onboarding still
revalidates even a fresh successful cache on mount but never remount-retries an
error. Real `QueryObserver` tests prove one deterministic execution, no hidden
remount/focus/reconnect rerun, one explicit manual recovery, exact inner request
attempts, and healthy fallback reconnect refresh. The focused matrix passes 15
files / 200 tests. A one-shot encrypted-photo failure at 390 x 844 remained
behind the truthful Progress availability alert until one Retry restored the
10-photo fixture with zero overflow, dialogs, or unexpected errors. Native
airplane/VPN/captive-portal, AppState, process-restart, and signed-device
evidence remains open. See
`docs/optimization/evidence/2026-07-25_query-retry-classification.md`.

Current local photo-query cache checkpoint (2026-07-21): photo query results now set query-scoped `gcTime: 0` because each derived result retains complete `PhotoRecord` values, including notes and local/encrypted/thumbnail URIs. Real TanStack `QueryObserver` tests prove data remains while any observer exists, disappears after the last observer, a non-cancellable late storage completion leaves no residue after settling, and a later mutation cannot recreate an unobserved query. A content-free development counter contains one integer only; a 390 x 844 Expo-web run switched Progress to Today and back twice, observed exact query execution counts `1 -> 2 -> 3`, and recovered all 10 deterministic Timeline actions after each reread with zero storage errors, overflow, dialogs, or unexpected logs. Global account/lock clearing remains mandatory, and native SecureStore/filesystem/process-kill/memory evidence remains open. See `docs/optimization/evidence/2026-07-21_progress-sensitive-query-cache-eviction.md`.

### 6.2 Fast local entitlement, reviewed reconciliation

Current `useEntitlement` waits for local storage and then the server mirror before returning; every `ProGate` also starts an offering query.

Required design:

- Define a verified local-entitlement fast path with an explicit freshness policy.
- Render already-authorized content from valid local proof if the subscription trust model permits it.
- Reconcile RevenueCat/server state in the background and fail closed only when proof is absent/expired/invalid.
- Share one entitlement coordinator between `AuthProvider`, `useEntitlement`, RevenueCat listeners, server mirror, and local cache.
- Do not fetch offerings for active Pro gates.
- Preload offerings after value or immediately before a likely paywall, not at secure bootstrap.
- Preserve refund, grace, expiration, restore, and account-boundary correctness.

### 6.3 Remove redundant reads and invalidations

- `useProgress` should read the local completion log once, derive all local summaries once, and run independent server requests in parallel.
- Today should update completion caches immediately after durable local commit, then schedule reconciliation.
- Photo mutations should place returned metadata into cache rather than forcing a complete store/decrypt/reconciliation read.
- Shelf mutations should update cached shelf/engine output through one deterministic reducer.
- Group dependent invalidations and avoid waiting for slow derived/server queries on the tap path.
- Count SecureStore, AsyncStorage, filesystem, crypto, and query operations per critical action and make these counts part of engineering evidence.

### 6.4 Decide the long-term structured local store

Private KV remains suitable for small preferences and compact versioned records. It is a poor long-term fit for unbounded Shelf archive, completion history, photo metadata, and outbox rows because each change rewrites an encrypted JSON snapshot.

Evaluate an encrypted transactional database for structured high-growth data:

- candidate technology must support the selected Expo/RN version and custom development builds;
- SQLCipher or equivalent encryption must be reviewed rather than assumed;
- keys remain device-only and fail closed;
- photos remain files, not database blobs;
- migration is journaled, owner-bound, crash-safe, and reversible during rollout;
- database open/integrity checks can eventually replace expensive all-record foreground scans only after a reviewed architecture decision.

Suggested logical indexes:

- Shelf: status, updated revision, expiry inputs;
- completions: unique `(local_date, step_key)`;
- ramps: product ID;
- photos: `(series, taken_at)` plus reference flag;
- outbox: `(owner_hash, next_attempt_at, entity_type)`;
- operation/recovery journal: state and creation time.

This is a proposal requiring a Master Plan Update, not an instruction to add a dependency immediately.

## 7. Startup, Bundle, Dependency, And Release Workstream

### 7.1 Define the startup phases instead of tracking one opaque number

Instrument the following boundaries with a monotonic clock and content-free labels:

1. process start to first JavaScript execution;
2. JavaScript start to first root render;
3. font decision complete;
4. authentication hydration complete;
5. account-generation decision complete;
6. vault availability decision complete;
7. app-lock decision complete;
8. navigation ready;
9. first meaningful route content visible;
10. first interaction accepted;
11. first critical data ready;
12. startup reconciliation complete.

Capture cold, warm, and resumed launches separately. A cold launch after install is not comparable to a process-alive resume. Each measurement must record:

- build channel and commit;
- platform, OS, model, storage capacity, and free storage;
- release or development build;
- thermal state when available;
- network type and offline status;
- authenticated, signed-out, locked, and vault-failure state;
- local dataset class: empty, median, or stress;
- whether the sample was excluded and why.

Do not send raw private state, route parameters, product names, photo identifiers, search strings, or user identifiers with timing events.

### 7.2 Make startup gates concurrent where correctness permits

The current gates are logically valid, but the implementation should be reviewed as a dependency graph rather than a serial checklist.

- Load the minimal font set and hydrate the auth session concurrently.
- Derive the account generation once the session is known.
- Resolve vault availability and app lock in parallel only if neither branch can expose private content.
- Keep a native or static privacy cover visible until both gates authorize display.
- Delay notification reconciliation, product-catalog warming, analytics flushing, and noncritical migrations until after the first usable frame.
- Avoid remounting the entire navigation tree when a mounted privacy shield can safely cover it.
- Deduplicate foreground events so one app-state transition cannot launch overlapping vault scans, entitlement refreshes, behavioral-trigger checks, and sync passes.
- Put a hard deadline on noncritical startup tasks; failure must degrade the optional subsystem, not hold the first screen forever.

Before changing the gate sequence, add truth-table tests for signed-out, signed-in, missing key, invalid key, corrupt private record, app locked, biometric cancelled, account switched, and background-to-active transitions.

### 7.3 Font asset correction

The audit export included 34 Google-font files totaling about 3.17 MB even though the app intentionally loads eight font files totaling about 0.66 MB.

Required work:

- replace package-root font imports that cause Metro to see every family asset with documented direct file or subpath imports;
- prefer Expo font embedding when it removes JavaScript-time loading without changing typography;
- make each weight used by the design system explicit;
- remove unused weights and verify no synthetic bold/italic appears;
- produce screenshots for every text style on both platforms after the change;
- measure time-to-first-meaningful-content and native artifact size before and after;
- add a CI asset manifest check so unused family assets cannot silently return.

The exported Android bundle also contained an approximately 0.93 MB Material Symbols font through the router/UI dependency graph. Determine which supported dependency or router feature owns it, whether it ships in the final AAB, and whether upstream configuration can remove it. Do not patch `node_modules`.

### 7.4 JavaScript bundle governance

The audit produced approximately 9.9 MB iOS and 10 MB Android Hermes bytecode exports, with 2,769 and 2,855 modules respectively. These are baselines, not pass/fail numbers.

Add a reproducible release-export job that reports:

- Hermes bytecode by platform;
- compressed and uncompressed JavaScript;
- source-map size kept outside the shipped artifact;
- asset count and bytes by extension;
- largest 50 modules or source groups;
- native IPA/APK/AAB download and installed sizes;
- per-ABI Android size;
- changes against the merge base and the last production tag.

Set initial budgets only after two clean release builds. A reasonable first gate is “no unexplained regression greater than 3% or 250 KB, whichever is larger,” followed by calibrated hard ceilings.

Audit the following measured groups before replacing them:

- Expo Router, roughly 1.15 MB of mapped source;
- Reanimated, roughly 0.85 MB, principally justified by the comparison gesture;
- RevenueCat hybrid mappings, roughly 0.73 MB;
- React Native renderer/Fabric, roughly 0.72 MB;
- Sentry including Replay/Feedback code even though replay is disabled;
- Supabase Auth and PostHog.

Optimization rules:

- use supported modular imports when the package documents them;
- confirm tree-shaking in the actual Metro/Hermes output;
- do not remove a reliability SDK solely because its source map is large;
- do not dynamically import critical privacy or auth code;
- record the user-visible or operational feature that justifies each large dependency;
- require a size and runtime impact note for every new native dependency.

Current local source-group checkpoint (2026-07-25): release-export schema v2 now requires complete external Metro maps and reports the largest 50 privacy-safe dependency/workspace groups by exact UTF-8 `sourcesContent` bytes. It validates VLQ mapping structure and requires every attributed source to be referenced. Lockfile allowlisting and fixed fallback groups prevent raw source paths, roots, usernames, hosts, query hashes, contents, or fingerprints from entering JSON/Markdown artifacts; malformed, incomplete, unrelated, indexed, oversized, and content-free maps fail closed. Fresh current-head exports attribute all 2,846 iOS and 2,936 Android source occurrences with zero unattributed sources. The iOS report measures 8,910,488 Hermes bytes and 14,293,595 mapped source-content bytes across 124 groups; Android measures 9,109,508 Hermes bytes and 14,554,357 mapped source-content bytes across 128 groups. The report is investigation evidence, not a bytecode-size equivalence or an approved budget. Signed native artifact sizes, historical deltas, two-release baselines, budget owners, and signoff remain open. See `docs/optimization/evidence/2026-07-25_source-map-group-attribution.md`.

### 7.5 Native artifact and update strategy

The repository documents over-the-air rollback behavior but does not currently include and configure `expo-updates`. Choose one coherent policy:

- add and fully configure EAS Update with runtime-version compatibility, signed update policy, channels, staged rollout, rollback drill, and recovery behavior; or
- remove OTA claims and use store releases only.

If EAS Update is approved:

- pin runtime versions to native compatibility;
- never ship database/key-format migrations that make rollback unsafe without a forward/backward compatibility window;
- use staged rings before full rollout;
- verify an offline launch with a bad or missing update;
- define who can publish, promote, and roll back;
- retain an audit log of release hashes;
- add a quarterly rollback exercise.

For store artifacts:

- inspect iOS app thinning, symbols, privacy manifests, required-reason APIs, and embedded frameworks;
- verify Android R8/minification/resource shrinking in the signed release artifact;
- verify AAB ABI/density splits and Play-delivered size;
- verify native libraries support Android 16 KB page-size requirements;
- archive dSYMs, ProGuard/R8 mappings, Hermes source maps, and exact build metadata for every production release.

Current local release-transport checkpoint (2026-07-18): the final app-owned Expo config plugin preserves development localhost allowances but forces staging and production to disable every iOS arbitrary-load escape hatch, remove ATS exception domains, and set Android `usesCleartextTraffic=false`. Pure policy tests and complete Expo plugin-chain introspection pass. Signed `Info.plist`/merged-manifest inspection and physical release traffic evidence remain required before verification; see `docs/optimization/evidence/2026-07-18_release-transport-security-checkpoint.md`.

### 7.6 Dependency lifecycle

Maintain a dependency register containing owner, purpose, native-code status, privacy impact, binary impact, startup impact, update cadence, and exit plan. Run:

- Expo dependency validation on every dependency PR;
- Expo Doctor on the release branch;
- production-only vulnerability audit;
- license and abandoned-package review;
- native privacy-manifest review;
- upgrade rehearsals on a dedicated branch before SDK migrations;
- a quarterly “can this dependency be removed?” review.

The current audit passed Expo dependency validation, Expo Doctor 21/21 with only a Sentry build-environment warning, and production dependency vulnerability audit with zero known vulnerabilities. Preserve those results as automated evidence rather than relying on a one-time run.

Current local dependency checkpoint (2026-07-25): a fresh Expo Doctor run found 13 packages below Expo SDK 56's supported compatibility set. The mobile manifest and lockfile now use Expo's exact expected ranges for Expo 56.0.17, Router 56.2.16, React Native Screens 4.26, and the ten affected Expo modules. `expo install --check` and Expo Doctor pass, iOS and web production exports complete with all 83 web routes retained, root/mobile type-check and zero-warning lint pass, and the focused native/config matrix passes 7 files / 59 tests. The lock refresh also advances `js-yaml`, `postcss`, and `shell-quote` to fixed compatible versions, leaving the production audit at zero high/critical and 14 moderate Expo/config-plugin toolchain findings whose advertised fixes require incompatible SDK downgrades. Those findings remain explicit rather than suppressed. See `docs/optimization/evidence/2026-07-25_expo-sdk56-dependency-alignment.md`.

## 8. Photo, Camera, Encryption, And Private Storage Workstream

### 8.1 Target photo architecture

The photo path is the largest combined performance and privacy risk. The target design is:

```text
native camera file
  -> protected native staging file
  -> metadata-stripped bounded-size image
  -> native/streaming authenticated encryption
  -> atomic encrypted original
  -> encrypted thumbnail(s)
  -> versioned metadata transaction
  -> staging journal committed
```

Display should be:

```text
encrypted thumbnail
  -> bounded decrypt queue
  -> memory-only decoded image
  -> virtualized visible cell
  -> release on unmount/lock/background/memory pressure
```

Full-resolution decryption should happen only for an explicit detail, comparison, or export action.

### 8.2 Remove base64 and hexadecimal amplification

The current path can hold camera base64, decoded image bytes, re-encoded image bytes, ciphertext, hexadecimal text, JSON text, and a data URI during one operation. Persistent ciphertext encoded as hex is roughly twice the encrypted byte count; base64 adds roughly one third; multiple immutable JavaScript strings increase transient memory further.

Implement or evaluate a narrow native module that can:

- read from a file descriptor or file URL;
- strip EXIF/GPS metadata without a JavaScript base64 round-trip;
- resize and recompress to a declared maximum pixel dimension;
- generate deterministic display and grid thumbnails;
- encrypt/decrypt in bounded chunks;
- authenticate a versioned header with associated data;
- write to a protected temporary file in the destination directory;
- atomically rename after authentication and fsync-equivalent durability;
- report content-free progress and typed failures;
- cancel when a component unmounts, account generation changes, or the app locks.

This is a focused native optimization, not a Swift rewrite. It requires an architecture decision, a key-format migration plan, and equivalent iOS/Android implementations or a proven cross-platform library.

### 8.3 Capture policy

Define and test:

- maximum long-edge pixels for stored originals;
- JPEG/HEIF choice by platform and compatibility requirements;
- quality target based on lesion/skin-detail review rather than arbitrary compression;
- camera orientation and mirrored-selfie behavior;
- color-space normalization;
- metadata whitelist; GPS and device identifiers must not survive;
- maximum input file size and low-storage behavior;
- one capture in flight at a time;
- retake and cancellation cleanup;
- interruption behavior for phone calls, permission changes, and process death;
- flash/torch behavior and low-light quality guidance;
- camera permission denial, limited permission, and settings-return states.

Do not lower clinical-looking image quality to win a benchmark. Use representative images and a reviewed visual acceptance set.

### 8.4 Thumbnail tiers and display cache

Store encrypted thumbnails separately from the original. Suggested tiers, to be validated:

- grid: 256–384 px long edge;
- timeline/detail preview: 720–1,080 px;
- original: bounded capture dimension.

Every tier must inherit the same owner binding, encryption, purge, backup, and recovery guarantees.

The in-memory display layer should provide:

- request deduplication keyed by owner generation, photo version, and size tier;
- a small concurrency limit, initially one or two decrypts;
- cancellation for off-screen items;
- an LRU bounded by decoded-byte estimate, not item count;
- explicit eviction on lock, background, account switch, delete, memory warning, and vault unavailability;
- no plaintext filename that can leak product or user data;
- a placeholder that preserves layout and prevents scroll jumps;
- typed unavailable/corrupt states that never appear as ordinary empty content.

Explicitly set the `expo-image` cache policy for sensitive sources. Its default includes disk caching; a private data URI must never be assumed memory-only. Prove behavior with filesystem inspection and device tests. If the library cannot provide a sufficient guarantee, use a reviewed native view or short-lived protected file strategy and document the residual risk.

### 8.5 Virtualize all growing photo surfaces

Replace eager photo maps inside `ScrollView` on:

- Progress timeline;
- series/reference selection;
- comparison pair picker;
- any future gallery or attachment chooser.

Use a measured virtualized list implementation compatible with the current Expo/RN architecture. Configure:

- stable IDs and memoized rows;
- predictable estimated/item dimensions where possible;
- conservative initial render count;
- window size based on real device memory and scroll traces;
- clipping only after proving it does not blank images;
- viewability-driven thumbnail requests;
- prefetch limited to the next small visible window;
- no full-resolution decrypt while flinging;
- route blur cleanup.

Stress evidence must include at least 50 encrypted photos, rapid flings, repeated open/close, comparison selection, delete during scroll, background/foreground, and low-memory pressure.

### 8.6 Crash-safe mutation protocol

Each add/update/delete operation needs a journaled state machine. A photo add can use:

1. `captured`;
2. `sanitized`;
3. `original_encrypted`;
4. `thumbnails_encrypted`;
5. `metadata_committing`;
6. `committed`;
7. cleanup.

Delete can use quarantine or tombstones so a crash cannot leave metadata pointing to a missing file or silently resurrect an item. On startup, reconciliation should:

- inspect the small operation journal first;
- resume or roll back incomplete operations;
- quarantine unknown encrypted files;
- never delete unreadable bytes merely because the key is unavailable;
- distinguish filesystem unavailable, key unavailable, authentication failed, schema unsupported, and truly absent;
- perform a full directory audit on explicit maintenance or schema migration, not on every photo-store read.

Recent uncommitted work in the repository appears to add serialized photo mutations, atomic staging, quarantine/restore, and fail-closed envelope checks. Treat it as promising but unverified until focused concurrency, crash-interruption, corruption, and device tests pass.

### 8.7 Plaintext lifecycle

Inventory every place plaintext can exist:

- camera output;
- image-manipulation input/output;
- share/export staging;
- decoded in-memory bitmap;
- JavaScript string or ArrayBuffer;
- library disk cache;
- OS thumbnail/indexing;
- crash dump or debug log;
- clipboard or share extension;
- test fixture.

For each, declare owner, protection class, lifetime, cleanup trigger, startup scavenger, backup behavior, and verification method.

Required behaviors:

- use a protected staging directory excluded from cloud/device backup;
- write a journal before creating share/export plaintext;
- scavenge expired staging files at safe startup and after share completion;
- use randomized non-descriptive names;
- never log URI, base64, ciphertext, key material, or photo metadata;
- clear clipboard only if the app ever writes private data there;
- warn that once shared to another app, the destination controls the copy;
- ensure screenshots/app switcher are covered on sensitive routes according to product policy.

### 8.8 Key management and envelope v2

Preserve device-only keys. Verify rather than assume:

- iOS Keychain accessibility is this-device-only and unavailable at the wrong lock state;
- Android Keystore keys are non-exportable and not restored from backup;
- Android backup/data-extraction rules exclude all private stores and encrypted payloads as required;
- iOS files have the intended data-protection class and backup exclusion;
- uninstall/reinstall produces an intentional unrecoverable-local-data state;
- device migration behavior matches product copy.

Version 2 envelopes should bind authenticated associated data to:

- logical storage key;
- schema version;
- owner/account generation;
- record or photo ID;
- payload type.

This prevents valid ciphertext from being moved to the wrong logical slot undetected.

Cache key handles only for the shortest safe unlocked session. Avoid repeated SecureStore/Keychain reads per image while ensuring eviction on lock, background, account switch, biometric failure, and memory warning. Never “repair” a missing key by overwriting ciphertext.

### 8.9 Store-by-store migration

Audit every private store and assign one outcome:

- bounded preference: keep in versioned encrypted KV;
- growing structured history: migrate to an encrypted transactional store;
- durable sync work: migrate to the transactional outbox;
- binary: encrypted file plus metadata row;
- disposable cache: explicitly purgeable and rebuildable.

For every store:

- replace separate load/modify/set with one atomic transform;
- add a per-key mutex or database transaction;
- retain previous bytes until the new write is durable;
- return typed `available`, `unavailable`, `corrupt`, `unsupported_version`, and `absent` states;
- never map unreadable to an empty array/object;
- preserve quarantined bytes for recovery/support;
- include migration fixtures from every prior schema;
- bind the owner generation;
- limit record and collection size;
- prove two simultaneous writes cannot lose data.

Priority stores include Shelf, completion log, ramp state, use order, routine notes, reminders/notifications, recommendation results, community preferences, milestones, photo metadata, consent, and pending synchronization work.

## 9. Feature-Level Performance And Quality Plan

### 9.1 Today and routine execution

Today is the primary daily loop and should have the strictest interaction budget.

- Build one route view model from Shelf, ramp, completion, entitlement, and date inputs.
- Compute the local date boundary once and invalidate at midnight/time-zone change.
- Update completion state immediately after the durable local transaction.
- Move mirror/sync work to the owner-bound outbox.
- Avoid refetching the whole completion log after each step.
- Precompute stable step keys and preserve completion semantics through routine edits.
- Memoize step rows and animate only the changed row.
- Ensure rapid double taps are idempotent.
- Exercise DST, manual clock change, midnight while backgrounded, and travel across time zones.
- Keep the free core routine usable offline.
- Measure first content, toggle acknowledgement, row commits per tap, storage operations, and dropped frames.

Acceptance targets must include the last routine item, empty routine, long labels, large accessibility text, Reduce Motion, screen reader, and app lock during a completion write.

### 9.2 Shelf, archive, expiry, and routine building

- Virtualize active and archived collections once the dataset can grow.
- Separate database/storage identity from product display identity.
- Use a single deterministic reducer for add, archive, restore, replace, reorder, and delete.
- Avoid recomputing the entire routine engine for presentation-only changes.
- Index or partition archived state in the chosen local store.
- Treat expiry as a date/state derivation, not a timer per row.
- Batch mirror operations through the outbox.
- Prevent an account switch from applying a delayed shelf response.
- Bound search/filter work and defer it while typing.
- Preserve scroll position across detail navigation and mutation.
- Test hundreds of archived items even if normal users have fewer.

### 9.3 Product catalog, scanner, and OCR

- Debounce user search and cancel superseded requests.
- Enforce input length and normalized character limits on client and server.
- Cache stable catalog results with versioned keys and bounded persistence.
- Canonicalize GTIN aliases and leading-zero variants.
- Stop repeated barcode network requests when a terminal result is already visible.
- Add cooldowns for continuous scanner frames.
- Prefer on-device iOS Vision and bundled Android ML Kit for OCR so image bytes do not cross the JavaScript bridge as base64.
- Gate OCR work to focused routes and cancel on blur.
- Make manual entry always available.
- Measure scan-to-result, OCR duration, false-retry loops, CPU/thermal impact, and memory.

Camera/scanner screens already use focus gating; preserve that strength while adding lifecycle and interruption tests.

Current local scanner checkpoint (2026-07-25): Shelf barcode scanning now uses one persistent session reducer and a synchronous admission ref. Exactly one frame can enter an idle session; lookup plus invalid, matched, no-match, offline, and error states pause `CameraView`, its frame handler, reticle, and torch until a named 48 pt+ `Scan again` action clears the duplicate identity and deliberately re-arms. Accepted reads emit the documented selection haptic, and lookup/results expose concise polite-alert labels that state scanning is paused. Monotonic attempt IDs and controller identity prevent delayed completion or cancellation from an older scan of the same barcode from publishing into a newer session. Focused type-check, lint, and 3-file / 56-test coverage pass. Expo-web no-match and matched terminal fixtures at 375 x 667 and 390 x 844 retained the result past the former duplicate window, reset in place, kept every action complete and center-hit-testable, and exposed zero horizontal overflow; the first visual pass found and fixed idle guidance overlapping the terminal sheet. Signed supported-iOS physical-camera request-count, torch, interruption, VoiceOver/Dynamic Type, frame, thermal, and memory evidence remains required. See `docs/optimization/evidence/2026-07-25_shelf-scanner-terminal-session.md`.

### 9.4 Progress and comparison

- Load timeline metadata and thumbnails before originals.
- Paginate or window history from the storage layer, not only the view.
- Decrypt only visible thumbnails.
- Release comparison originals when leaving the comparison route.
- Cache one active pair in memory only if the declared byte ceiling allows it.
- Keep the Reanimated comparison gesture on the UI thread.
- Add adjustable accessibility actions and a non-gesture alternative.
- Avoid layout changes during image decode.
- Separate camera capture state from timeline state so a camera interruption cannot rerender the full history.
- Test 50, 100, and an engineering stress dataset above the supported minimum.

### 9.5 Ask/search interaction

- Keep the text input in a small leaf component.
- Defer parsing/highlighting and cancel outdated requests.
- Virtualize unbounded result/history sections.
- Render server results from a normalized, versioned model.
- Provide deterministic offline, timeout, empty, and retry states.
- Never block typing on analytics, catalog logging, or entitlement refresh.
- Measure keystroke commit time, query count, response latency, and result-render commits.

### 9.6 Onboarding and paywall

- Remove artificial minimum waits unless a reviewed product requirement justifies them.
- Respect Reduce Motion for the analyzing pulse and every transition.
- Preload only the next likely asset; do not initialize the entire paid stack.
- Keep entitlement fast-path local and verified; reconcile in the background.
- Do not fetch a subscription offering inside `ProGate` for a user already known to be active.
- Centralize purchase/restore state so two screens cannot launch competing requests.
- Make restore, network failure, pending transaction, grace period, revoked entitlement, and account switch explicit.
- Measure launch-to-onboarding, onboarding completion, paywall-ready time, purchase acknowledgement, and post-purchase unlock.

### 9.7 You, settings, export, and deletion

- Lazy-load expensive diagnostic/export views.
- Avoid binding the whole settings route to unrelated private stores.
- Make toggles optimistic only when rollback is clear and local commit is durable.
- Generate large exports with pagination and bounded concurrency.
- Show progress and cancellation for export/deletion without exposing record content.
- Keep app lock and privacy controls immediately responsive.
- Verify large text, VoiceOver/TalkBack order, destructive confirmation, and process interruption.

### 9.8 Navigation, theme, and inactive screens

- Decide whether the launch product truly supports dark mode. The config permits automatic interface style while the root status bar is forced dark.
- If full dark mode is not launch-ready, explicitly force light and document the choice.
- If supported, create semantic color tokens, per-route system-bar handling, screenshots, contrast tests, and native modal/sheet validation.
- Introduce an explicit inactive-tab policy: preserve cheap navigation state, pause subscriptions, cancel requests, release decoded images/camera, and freeze or unmount expensive subtrees where safe.
- Re-enable Android predictive back only after every critical route and destructive flow passes device E2E.
- Split oversized routes by ownership and render boundaries proven by the profiler, not by arbitrary line count.

Eleven route files exceed 500 lines. Size alone is not a performance defect, but it is a signal that state ownership, testability, and rerender boundaries deserve focused review.

## 10. Backend, Network, Database, And Synchronization Workstream

### 10.1 Client network contract

Create one request policy layer for authenticated calls:

- capture the account ID and generation at request creation;
- attach an abort signal;
- set an endpoint-specific deadline;
- distinguish offline, timeout, cancellation, authentication, rate limit, server, validation, and unknown failures;
- retry only idempotent/transient requests;
- use exponential backoff with full jitter and a maximum attempt count;
- honor `Retry-After`;
- suppress retries after owner change or route cancellation;
- reject oversized responses;
- record content-free duration, status class, attempt count, and endpoint name;
- never place tokens, product strings, barcodes, search terms, or private content in logs.

Wire TanStack Query to React Native focus and connectivity managers. A foreground or network event should schedule one deduplicated reconciliation pass, not refetch every query simultaneously.

### 10.2 Transactional, ordered synchronization

Replace fire-and-forget Supabase mirrors and disconnected queues with one durable encrypted outbox.

Minimum outbox row:

- operation UUID;
- owner/account generation;
- entity type and stable entity ID;
- operation type;
- local revision and idempotency key;
- encrypted payload or deterministic payload reference;
- dependency/group ID;
- creation time;
- next-attempt time;
- attempt count;
- last typed failure;
- lease owner and lease expiry;
- terminal/dead-letter state.

Worker behavior:

1. acquire a bounded lease for the current owner;
2. select ready rows in stable order;
3. batch compatible operations;
4. submit with idempotency keys;
5. verify the owner generation before applying results;
6. atomically mark success or schedule backoff;
7. stop on lock, sign-out, owner switch, or app background according to policy;
8. surface non-sensitive dead-letter health to diagnostics.

Coalesce superseded state mirrors while never coalescing immutable history events incorrectly. Completion uniqueness must be enforced on both client and server. Test delayed account-A responses after signing into account B.

### 10.3 Catalog query and indexing

The catalog function currently uses leading-wildcard `ILIKE` queries while the database owns a full-text GIN index. That index does not accelerate the current predicate.

Choose and prove one search design:

- PostgreSQL full-text query matching the existing indexed vector; or
- normalized fields with `pg_trgm` GIN indexes for controlled fuzzy/substring search; or
- a deliberately scoped combination with ranked fallback.

Required proof:

- `EXPLAIN (ANALYZE, BUFFERS)` for exact barcode, common name, brand, prefix, misspelling, and no-result queries;
- realistic row counts and data distribution;
- p50/p95/p99 latency under concurrency;
- bounded result count and stable ranking;
- input normalization and query complexity limits;
- index size, write cost, vacuum/analyze health, and cache-warm/cold results.

The exact barcode path is indexed and should remain a separate fast path.

### 10.4 Catalog Edge Function round trips

A catalog request currently may perform auth lookup, rate-limit RPC, catalog query, and awaited logging. Reduce response-critical work:

- authenticate once;
- keep the rate-limit decision close to the query;
- return catalog results without waiting for noncritical analytics/logging;
- use a platform-supported background task, durable database log, or sampled asynchronous metric;
- cache public/stable results with an explicit freshness/version policy;
- add request cancellation and upstream timeouts;
- cap external barcode payload sizes and redirects;
- retain the existing external fetch timeout/response-size protections.

Do not make audit/security events best-effort if they are required for abuse control. Classify logs before moving them.

### 10.5 Catalog ingestion

The current OBF importer loads an entire source in memory and creates a fixture manifest; it is not a production ingestion system.

Build a restartable ingestion pipeline:

- stream source data;
- normalize GTIN, brand, product name, categories, and source revision;
- validate required fields and reject malformed/oversized values;
- write staged batches with COPY or an appropriate bulk path;
- deduplicate/upsert by canonical product identity;
- record source version, checksum, row counts, rejects, timings, and importer version;
- promote a complete staged version atomically;
- support restart from checkpoints;
- run analyze/index maintenance after promotion;
- retain rollback metadata;
- never expose a partial import as the active catalog.

Load-test search after ingestion, not only on fixtures.

### 10.6 Data export correctness and performance

The export function serially performs roughly 30 unpaginated `select('*')` operations. PostgREST defaults can cap results at 1,000 rows, silently making an export incomplete.

Required replacement:

- define the exact export schema and manifest;
- paginate every unbounded table or use a reviewed server-side streaming/RPC path;
- use a consistent snapshot or document consistency semantics;
- run independent safe reads with bounded concurrency;
- paginate storage objects and signed URL generation;
- record per-table counts and checksums in the manifest;
- detect truncation and fail the export rather than call it complete;
- stream/assemble large output without retaining all rows in one Edge Function heap;
- encrypt/protect the downloadable archive according to product policy;
- give links a short expiry and one owner;
- delete generated archives on schedule;
- add datasets above 1,000 rows per relevant table and interruption tests.

Current local Edge-memory checkpoint (2026-07-21): the existing 8 MiB mobile server-response ceiling now has a matching request-scoped Edge assembly budget. Every accepted database row, verified storage path/prefix, signed URL, storage-object row, and omission consumes one shared UTF-8 byte/item budget with a fixed retained-object allowance; default aggregate limits are 8 MiB and 100,000 items, not the former theoretical sum of every per-source row cap. Source failures release their own claim, bounded workers stop scheduling and drain in-flight work before rejection, avoidable source/attribution/photo arrays were removed, and the final response is compact-serialized once, measured exactly in UTF-8, capped at 8 MiB, and returned with `Content-Length`. Fourteen Deno tests include 34 concurrent sources at the exact byte boundary, one-byte-over rejection, multibyte response accounting, oversized private-row redaction, storage double-pass accounting, item-overhead rejection, and worker-drain behavior. This bounds current fail-closed assembly; it does not make exports above 8 MiB complete. Durable encrypted archive/streaming, resume, cross-source snapshot, hosted heap, interruption, and expiry proof remain open. See `docs/optimization/evidence/2026-07-21_data-export-memory-bound.md`.

Current local mobile-writer checkpoint (2026-07-21): the combined mobile bundle no longer becomes an additional artifact-sized pretty-JSON string before file output. A JSON-safe serializer preserves exact `JSON.stringify(value, null, 2)` bytes while retaining at most a 64 KiB UTF-16 fragment and emitting at most 192 KiB of UTF-8 per write through one Expo SDK 56 `FileHandle`. It yields and revalidates the account generation between chunks; create/open/write/close failures stay content-free; account invalidation outranks close failure; and journal state remains `reserved` until the handle closes successfully. Partial `reserved` files are unshareable, cleaned by the caller, and scavenged after a simulated relaunch. The focused matrix passes 6 files / 101 tests, repository type-check and zero-warning lint pass, and a supported-phone Expo-web interaction preserves the disclosure and sanitized native-unavailable failure branch. This removes the mobile serialization duplicate without changing the schema or claiming native peak-heap/share-sheet proof. See `docs/optimization/evidence/2026-07-21_mobile-export-incremental-writer.md`.

Current local data-rights source-gate checkpoint (2026-07-25): the Phase 9 verifier no longer requires the removed whole-bundle `JSON.stringify` plus `writeAsStringAsync` path. It now fail-closes unless reservation precedes bundle construction, the actions layer contains no whole-string/file write, one exclusive write-only `FileHandle` streams fixed-bound encoded chunks, the handle closes before success, and journal promotion follows writer completion. The data-rights and privacy-payload code gates pass, and the focused export matrix remains 6 files / 101 tests. See `docs/optimization/evidence/2026-07-25_incremental-export-source-gate.md`.

### 10.7 Account deletion state machine

Storage deletion that repeatedly fetches “page N” while deleting prior pages can skip objects because the collection shrinks.

Implement deletion as an idempotent state machine:

1. request recorded and account frozen as required;
2. external subscription/customer actions recorded;
3. storage objects enumerated with a stable cursor or repeatedly from the first page;
4. each object batch deleted and checkpointed;
5. database tables deleted in dependency order or one transactional RPC;
6. auth identity removed last;
7. completion receipt recorded without private content.

Every step must be safe to retry. Add failure injection after each step, datasets with multiple storage pages, concurrent upload prevention, and a support-visible state that reveals status without exposing data.

### 10.8 RevenueCat webhook and entitlement mirror

Current risk areas include non-atomic check-then-insert idempotency, multiple database round trips, and no explicit provider-event ordering protection.

Move processing into a transactional RPC or equivalent:

- authenticate the provider signature/secret before body processing;
- give the external webhook an explicit deployment config such as `verify_jwt=false` while preserving provider authentication;
- normalize provider event ID, original transaction/customer identifiers, product, effective time, and received time;
- insert the event once with a unique provider-event constraint;
- compare provider event ordering/version before changing the entitlement projection;
- update the entitlement mirror and event log atomically;
- ignore stale events without losing the audit record;
- handle aliases and user reassignment deterministically;
- return success for already-processed events;
- retain a replay/dead-letter procedure.

Reverse-trial creation must not trigger a global expired-entitlement update on every grant. Move expiry maintenance to an indexed scheduled job or targeted row operation.

Client rules:

- verified local entitlement is the fast render path;
- server/provider reconciliation is deduplicated;
- paywall/offering fetch occurs only when needed;
- restore/purchase operations are single-flight;
- owner-generation checks prevent cross-account unlock;
- grace, billing issue, pending, revoked, and offline states are explicitly tested.

### 10.9 Edge deployment completeness

Create one source-of-truth deployment manifest that includes every function, its JWT setting, secrets, timeout/memory expectations, and public/authenticated status. The current staging wrapper omits newer functions.

CI and release should:

- diff the source function directories against the manifest;
- reject missing function config;
- deploy to staging from the exact commit;
- run authenticated and unauthenticated smoke tests;
- verify webhook endpoints with provider-style authentication;
- run migration compatibility checks first;
- promote the immutable artifact/config to production;
- record function versions and secret version identifiers.

No external endpoint should rely on a dashboard-only JWT exception that is absent from source control.

### 10.10 Rate limiting and abuse protection

- Align cleanup predicates and indexes. Current cleanup filters `window_start` while the available index targets `updated_at`.
- Choose a fixed, sliding, token-bucket, or leaky-bucket policy per endpoint.
- Key limits by the minimum privacy-preserving identity needed.
- Prevent unbounded cardinality from arbitrary inputs.
- return standard rate-limit status and retry metadata;
- expire buckets with a scheduled, indexed job;
- load-test hot keys and many unique keys;
- monitor reject ratio and table growth;
- protect external catalog spend independently from ordinary search.

### 10.11 Retention, maintenance, and scheduled work

Several records are documented as auto-purged, but scheduled retention jobs are not present.

Add version-controlled scheduled jobs for:

- expired export archives and signed-link metadata;
- rate-limit buckets;
- old webhook raw/audit records according to policy;
- completed/dead outbox rows;
- old entitlement events if policy permits;
- temporary catalog import staging;
- abandoned deletion operations;
- diagnostic aggregates;
- any server-side scan/log records with a declared retention period.

Each job needs an index-supported predicate, batch limit, execution deadline, idempotency, alert, and dry-run/report mode. Retention claims in privacy copy must map to an actual job and evidence.

### 10.12 Database health and scale testing

For critical tables, document:

- expected rows per user and global growth;
- primary/foreign/unique keys;
- row-level-security predicate and supporting index;
- common read/write query plans;
- retention;
- vacuum/analyze expectations;
- maximum row/payload size;
- hot-row or contention risks.

Add staging tests for:

- migration from the oldest supported schema;
- clean migration replay from zero;
- rollback/forward-fix procedure;
- RLS isolation for two users and anonymous access;
- connection-pool exhaustion;
- catalog and entitlement load;
- webhook bursts, duplicates, and reordering;
- large export/deletion;
- index bloat and slow-query capture;
- recovery from a partially applied operational job.

Track database p50/p95/p99 duration, error rate, pool saturation, CPU, memory, storage, cache hit rate, table/index growth, dead tuples, and replication/backup health.

## 11. SDK, Notifications, Analytics, And Diagnostics

### 11.1 Notification architecture

The root notification import pulls delivery/business logic, entitlement, and Supabase into startup. Split:

- a minimal notification handler and Android channel definition safe for root import;
- permission and token registration;
- local schedule calculation;
- behavioral/business trigger evaluation;
- server registration/reconciliation.

`BehavioralTriggers` currently mounts Shelf, ramp, and Progress hooks continuously even when preferences disable the feature. Replace it with:

- a lightweight preference check first;
- one batched local snapshot only when enabled and a relevant lifecycle event occurs;
- one deduplicated evaluation;
- local-first scheduling;
- one optional owner-bound server reconciliation;
- a cooldown so repeated background events cannot issue overlapping work.

Test permission states, exact/inexact scheduling constraints, time-zone/DST changes, reboot, app update, revoked entitlement, account switch, Android channel changes, and notification tap routing. Never include private product/routine data in notification content unless explicitly approved.

Current local permission checkpoint (2026-07-25): complete Expo permission responses are normalized fail-closed, including iOS provisional/ephemeral authorization and typed content-free bridge/malformed failures. Fixed AM/PM/capture reconciliation reads live permission before its signature fast path, cancels only exact owned IDs on revocation, and restores from durable intent. The shared foreground query refetches even while fresh; terminal denial or unavailable access also cancels the global trial ID. Every granted owner generation performs one deferred, owner-fenced entitlement audit, so cold restart, marker loss, and absent/unreadable notification preferences cannot strand active-trial restoration. Unreadable, stale, or invalid entitlement evidence is never treated as absence, and reconciliation retains bounded retry. Behavioural delivery performs no UUID/cap-ledger/native/outbox side effect without delivery permission. Settings preserves preference and active-trial intent and uses the existing TanStack focus lifecycle for explicit Allow, Retry, and Open Settings recovery with stale-completion suppression, one accessible failure alert (including unchanged OS requests), and no automatic prompt. Focused type/lint/test gates and deterministic 390 x 844 plus 320 x 568 Expo-web recovery flows pass; signed iOS/Android scheduling, Settings return, reboot/update, DST/time-zone, banner/tap, and screen-reader proof remain external. See `docs/optimization/evidence/2026-07-25_notification-permission-recovery.md`.

### 11.2 Sentry and crash diagnosis

Current production configuration has tracing disabled, removes stack/transaction information, and still appears to bundle Replay/Feedback source groups. This preserves privacy but sharply limits diagnosis.

Choose a reviewed production diagnostics design:

- crash reporting with symbolicated stacks scrubbed of content;
- no session replay;
- no screenshots or view hierarchy containing private data;
- allowlisted tags only: release, build, platform, OS class, device-memory class, route enum, error enum;
- denylisted event fields and before-send tests;
- native dSYM/R8 mapping/Hermes source-map upload;
- release-health and crash-free-session dashboards;
- content-free startup/operation breadcrumbs if permitted.

If transaction/performance sampling remains prohibited by the privacy decision, use local Instruments/Perfetto for raw traces and a separate internal aggregate metrics path with a reviewed schema. Do not silently enable Sentry tracing. If unused Replay/Feedback code can be excluded through supported imports/configuration, measure the artifact reduction.

### 11.3 PostHog lifecycle

Current local telemetry-boundary checkpoint (2026-07-21): PostHog now uses one exact per-event runtime/type schema with correlated payload branches, event-specific count floors, fail-closed no-property handling, and complete production-call coverage. Sentry now preserves only generated-bundle crash coordinates plus exact recovery identifiers while rejecting unsafe event fields, hostile/revoked containers, SDK acquisition/capture bypasses, and malformed recovery inputs before provider access. The code gates and isolated bypass matrices pass; live exact-release payload samples and provider/dashboard evidence remain external requirements. See `docs/optimization/evidence/2026-07-21_telemetry-boundary-hardening.md`.

Current local PostHog queue checkpoint (2026-07-21): the custom persistence boundary expires event rows older than seven days, rejects timestamps beyond five minutes of future clock skew, retains only the newest 256 FIFO rows, rejects persisted envelopes over 1 MiB, and prohibits the separate logs queue. Retained rows must match the exact application event/property schema or the narrow internal identify shape, including SDK-generated UUIDv7 or the app's pseudonymous hash and bounded SDK metadata; raw account UUIDv4, device name, manufacturer, locale, timezone, permissive metadata text, and unknown metadata are excluded. Prohibited legacy super-property, feature-flag, survey, replay, and remote-config caches are removed during preload and persistence. Corrupt, unknown-version, and oversized event storage is replaced with an empty opted-out envelope before SDK preload, which disables capture until an explicit opt-in. Every later SDK persistence write passes through the same sanitizer. The live SDK queue is revalidated immediately before every periodic, threshold, lifecycle, manual, or shutdown flush, so a long-running offline process cannot send expired or schema-invalid rows. Runtime transport is fixed to 20-event flushes, 50-event batches, a 30-second interval, one retry after one second, and an eight-second request timeout; application lifecycle event capture remains disabled. Focused tests cover expiry/cap/schema/identity boundaries, legacy-cache cleanup, malformed and oversized storage, live pre-flush expiry, ordered preload sanitation, concurrent writes, and deletion freeze compatibility. Provider-side retention, live exact-release payloads, signed-device lifecycle behavior, and dashboard evidence remain external. See `docs/optimization/evidence/2026-07-21_posthog-persisted-queue-retention.md`.

Preserve lazy initialization and disabled session replay. Add:

- a strict event allowlist and typed property schema;
- no search text, barcode, product name, photo state, routine content, or raw identifiers;
- account reset/alias behavior tests;
- opt-out/consent behavior if applicable;
- bounded queue and retry/backoff;
- flush on safe background/termination opportunities;
- offline queue expiry;
- release/build context;
- sampling for high-frequency performance counters;
- CI tests for forbidden property names.

Analytics must never sit on the interaction-critical path.

### 11.4 Local diagnostics screen

Provide an internal/development diagnostics surface that can show content-free:

- release/build/runtime version;
- account generation hash prefix or “none”;
- vault/lock availability enum;
- outbox ready/in-flight/dead counts;
- last sync result enum and time;
- photo operation-journal counts;
- storage free-space class;
- query cache counts;
- notification permission/schedule health;
- catalog endpoint health;
- recent timing aggregates;
- symbol/config upload status from build metadata.

Do not expose keys, tokens, complete user IDs, filenames, record values, search strings, or photo identifiers. Gate the screen from production users unless product/support explicitly approves it.

## 12. iOS Optimization And Release Checklist

### 12.1 Supported-device matrix

Use the documented iOS 17+ policy and test at minimum:

- oldest supported small/low-memory device class;
- current common non-Pro device;
- current high-end device;
- smallest supported screen;
- largest Dynamic Type accessibility sizes;
- current and oldest supported iOS versions;
- low storage, Low Power Mode, poor network, offline, and thermal pressure.

Simulators are useful for functional breadth but cannot approve memory, startup, energy, camera, Keychain, file protection, or scroll performance.

### 12.2 Instruments evidence

Capture release-build traces for:

- Time Profiler: cold start, Today toggle, Shelf mutation, photo capture, timeline fling, comparison, catalog search, paywall;
- Allocations/VM Tracker: photo capture/decrypt, 50-photo timeline, repeated navigation, account switch;
- Leaks: repeated open/close loops and camera cancellation;
- Core Animation: long-list fling, sheet transitions, compare gesture;
- Energy Log: background/foreground, scanner, OCR, notification evaluation;
- Network: redundant requests, cancellation, request waterfalls;
- File Activity: plaintext staging and cleanup;
- os_signpost or equivalent content-free boundaries for critical operations.

Store trace templates, run instructions, screenshots/summaries, build hash, and device metadata in the evidence packet. Raw traces containing private values must not be committed.

### 12.3 iOS memory and lifecycle

- Handle memory warnings by clearing decoded photo caches and optional query data.
- Release camera/OCR sessions on route blur and background.
- Verify inactive tabs do not retain full-resolution images.
- Bound autorelease/native decode spikes in the proposed photo module.
- Test repeated background/foreground, lock/unlock, incoming interruption, permission changes, and process eviction.
- Verify the app switcher privacy cover before private views are snapshotted.
- Measure peak and steady resident memory on the lowest supported device.

### 12.4 iOS storage, Keychain, and backup

- Inspect entitlements and Keychain accessibility flags in the signed artifact.
- Use a this-device-only accessibility class matching lock requirements.
- Verify protected files are unavailable at the intended device-lock phase.
- mark private/staging files excluded from backup where policy requires;
- confirm no plaintext in Documents, Library/Caches, tmp beyond the declared staging window, Photos, shared containers, or image caches;
- test reinstall, device backup/restore, and missing-key behavior;
- inspect crash logs for content leakage;
- verify share/export cleanup after force-quit.

### 12.5 iOS responsiveness and polish

- Keep main-thread work below the frame budget; move crypto/image work off it.
- Verify 60 Hz and 120 Hz devices.
- Use native haptics sparingly and consistently.
- Ensure every sheet respects safe areas, keyboard, VoiceOver focus, and interactive dismissal policy.
- Verify status bar appearance per route.
- Audit Dynamic Type without truncating safety/privacy copy.
- Use reduced motion/cross-fade alternatives.
- Add MetricKit only if its aggregate payload and privacy posture are approved.

### 12.6 iOS distribution

- archive a signed Release build;
- inspect IPA and app-thinning report;
- validate privacy manifests and required-reason APIs for every SDK;
- upload and verify dSYMs/Hermes source maps;
- run TestFlight install/update/rollback flows;
- test clean install, upgrade from last production, offline first launch, and migration interruption;
- confirm App Store privacy answers match actual SDK/network/storage behavior.

Current exact-release recovery checkpoint (2026-07-18): Phase 9 now has a fail-closed content-free artifact contract for one clean SHA and iOS EAS build. A macOS release host must validate Apple distribution trust, signed bundle/profile/entitlement identity for the root app and extensions, every shipped Mach-O UUID, canonical dSYM DWARF coverage, the exact external Hermes debug ID, and absence of shipped source maps. A claimed packet must also retrieve distinct live Sentry JavaScript/native events and verify exact source-map and Mach-O debug-file recovery before strict QA can pass. No signed artifact or live recovery result was fabricated; see `docs/optimization/evidence/2026-07-18_exact-release-artifact-recovery-contract.md`.

## 13. Android Optimization And Release Checklist

### 13.1 Supported-device matrix

Use the documented API 29+ policy and cover:

- API 29 low-memory/older performance class;
- a common midrange physical phone;
- a current flagship;
- compact and large screens;
- OEM diversity where practical;
- 60/90/120 Hz;
- gesture and three-button navigation;
- low storage, Data Saver, Battery Saver, offline, poor network, and thermal throttling.

Emulators cannot approve camera, Keystore, low-RAM behavior, energy, OEM lifecycle, or real scroll performance.

### 13.2 Perfetto and Android Studio evidence

Capture signed release traces for the same critical flows as iOS using:

- Perfetto/System Trace for main, render, JS, native worker, binder, I/O, and frame timelines;
- CPU profiler for crypto/image/OCR/catalog hotspots;
- Memory profiler and heap dumps for decoded image retention;
- Network inspector or content-free endpoint metrics;
- Energy/battery tools where supported;
- `dumpsys gfxinfo` or frame metrics for repeatable scroll comparisons.

Record build, device, OS, thermal state, dataset, run command, and summarized outcome.

### 13.3 Macrobenchmark and Baseline Profiles

If the Expo/custom-native build permits a maintainable harness:

- add Android Macrobenchmark for cold/warm startup and critical scroll;
- generate a Baseline Profile covering launch, Today, Shelf, Progress, and paywall navigation;
- include profile installation in release builds;
- verify profile rules survive R8 and package changes;
- compare startup/frame metrics with and without the profile;
- regenerate when navigation or critical classes materially change.

Do not add a brittle native test project without an owner and CI device strategy. If automation is deferred, document the manual Perfetto gate.

### 13.4 Android memory and lifecycle

- respond to memory-trim callbacks by clearing decoded/private caches;
- release camera and OCR analyzers on pause/stop;
- keep background services/work minimal;
- test “Don’t keep activities,” process death, task removal, and OEM background restriction;
- verify no duplicate startup/sync pass after activity recreation;
- exercise low-memory kills during photo staging and outbox work;
- prove recovery journals restore a consistent state.

### 13.5 Keystore, backup, and files

- keep `android:allowBackup=false` and verify generated manifest/data-extraction rules;
- inspect the signed merged manifest, not only app configuration;
- verify Keystore aliases cannot migrate across reinstall/backup;
- keep private/staging files in app-internal storage;
- prove no MediaStore/gallery indexing of private captures;
- inspect cache and app-specific external storage;
- test clear-data, uninstall/reinstall, device restore, lock-screen state, and invalidated keys;
- verify recent uncommitted backup-hardening work with a native artifact.

### 13.6 Android rendering, navigation, and packaging

- validate Fabric/Reanimated interactions on API 29 and high-refresh devices;
- re-enable predictive back only after route-by-route E2E and visual review;
- handle edge-to-edge insets and system bar contrast on every screen;
- verify keyboard resize/pan behavior for forms and Ask;
- inspect signed AAB for R8, resource shrinking, duplicate resources, ABIs, native debug symbols, and per-device download size;
- verify all native libraries for 16 KB page-size compatibility;
- upload native symbols and R8/Hermes mappings;
- monitor Android Vitals for crash, ANR, excessive wakeups, startup, and slow/frozen frames.

### 13.7 Android notifications and exact work

- define channel IDs, importance, sound/vibration, and migration policy;
- handle Android 13+ notification permission;
- avoid exact alarms unless the feature and policy require them;
- test reboot, time-zone change, app force stop, battery optimization, and OEM scheduling;
- avoid waking the process to recompute disabled behavioral triggers;
- verify tap intents, duplicate taps, cold-start routing, and account/lock gates.

## 14. Accessibility, Perceived Performance, And Premium Quality

Optimization is not only benchmark speed. A premium app feels immediate, stable, calm, understandable, and trustworthy across ability, device, and network conditions.

### 14.1 Accessibility correctness

For every route:

- support VoiceOver and TalkBack with logical order and concise labels;
- group compound cards intentionally;
- expose role, state, value, hint, and disabled/busy state;
- provide accessible actions for swipe/drag/compare gestures;
- provide a non-gesture alternative;
- maintain a minimum 44 pt iOS / 48 dp Android practical touch target;
- never rely only on color;
- verify semantic color contrast;
- support large accessibility text without clipped critical copy or controls;
- handle screen-reader focus after navigation, modal open/close, mutation, error, and loading completion;
- announce asynchronous outcomes without excessive chatter;
- respect Reduce Motion and platform animation scales;
- preserve keyboard navigation on Expo web only where the flow is officially supported.

Automated linting cannot approve accessibility. Add human device passes with both screen readers and large text.

### 14.2 Perceived performance rules

- Acknowledge safe taps immediately with state, haptic, or visual feedback.
- Never use a spinner where stable content/skeleton or an inline pending state is clearer.
- Preserve layout dimensions while images or data load.
- Keep stale verified data visible during background refresh where privacy and correctness allow.
- Use typed offline and unavailable states instead of indefinite loading.
- Make retries explicit and idempotent.
- Avoid artificial waits.
- Do not animate large layout trees on the JavaScript thread.
- Prefer progressive disclosure over mounting every settings/diagnostic section.
- Preserve list scroll position and input focus.
- Prevent double navigation and duplicate submissions.

### 14.3 Visual and interaction consistency

Create or complete a token-driven system for:

- type scale and supported font weights;
- semantic colors and contrast;
- spacing;
- radii;
- shadows/elevation;
- animation duration/easing/reduced alternatives;
- haptic categories;
- icon sizes and optical alignment;
- loading, empty, offline, error, locked, unavailable, and destructive states;
- cards, list rows, fields, buttons, banners, sheets, dialogs, and image placeholders.

Premium quality requires removing one-off behavior, not adding more animation. Verify the smallest phone, large text, long localized strings, keyboard, dark/light decision, and both platform conventions.

### 14.4 Localization and formatting readiness

Even if launch is English-only:

- centralize user-facing strings;
- avoid concatenated sentence fragments;
- use locale-aware dates, times, quantities, and currencies;
- define the product’s local-day semantics;
- test long pseudo-localized strings;
- avoid fixed-width text containers;
- keep server/API enums separate from display strings;
- plan bidirectional layout for reusable components;
- keep notification copy versioned and localizable.

## 15. Testing, Profiling, CI, And Production Operations

### 15.1 Test pyramid required for this app

The current suite is substantial but centered on Node/pure logic and includes many source-file string contracts. Fifty-three of 197 test files use source-content contracts. Keep useful architecture contracts, but do not mistake them for user behavior.

Required layers:

1. pure unit tests for engines, schemas, reducers, keying, backoff, and date logic;
2. rendered React Native component tests for accessibility and interaction states;
3. integration tests using real store adapters with controlled crypto/filesystem/network boundaries;
4. concurrency and interruption tests;
5. Edge Function and database integration tests;
6. human-simulated E2E on the actual app surface;
7. physical-device performance profiling;
8. production canary and monitoring.

### 15.2 High-value component tests

Add rendered tests for:

- Today completion row pending/success/rollback;
- Shelf row archive/restore and long text;
- Progress thumbnail unavailable/corrupt/loading states;
- comparison accessibility controls;
- Ask typing and superseded result handling;
- ProGate active/offline/revoked/pending states;
- app-lock focus and biometric cancellation;
- vault unavailable shield;
- onboarding Reduce Motion;
- notification preference disabled path;
- account switch while a request is in flight.

Assert accessible roles/names/states and user-visible outcomes, not implementation details.

### 15.3 Concurrency, failure, and property tests

Add deterministic tests for:

- two simultaneous private-store writes;
- photo add/add, add/delete, delete/delete, and read/delete races;
- crash/failure injection at every journal phase;
- missing/invalid key with ciphertext preserved;
- delayed owner-A request after owner-B login;
- outbox lease expiry and duplicate worker;
- duplicated/reordered RevenueCat events;
- export tables above 1,000 rows;
- deletion with more than one storage page;
- clock/DST/time-zone changes;
- malformed/corrupt/unsupported-version envelopes;
- random operation sequences against model invariants;
- storage-full and quota failures;
- network flapping and retry storms.

Property/model invariants should include:

- no completion is duplicated;
- no committed photo metadata points to an absent file;
- no committed encrypted file is ownerless;
- unreadable is never silently converted to empty;
- outbox success is idempotent;
- stale owners cannot mutate current state;
- account deletion eventually reaches complete or a retryable explicit state.

### 15.4 Human-simulated E2E

Follow `docs/HUMAN_SIMULATED_E2E_TESTING.md`, `docs/USER_FLOW_TREE.md`, and `docs/E2E_TESTING_CHECKLIST.md`.

Critical launch journeys:

- install -> onboarding -> first routine -> first completion;
- sign in -> restore local/server state -> Today;
- add/search/scan product -> Shelf -> routine;
- photo permission -> capture -> Progress -> compare -> delete;
- subscribe -> unlock -> restart -> offline verified entitlement -> restore;
- enable lock -> background -> biometric success/cancel/failure;
- offline mutation -> relaunch -> reconnect -> sync;
- account A -> delayed work -> sign out -> account B;
- data export and account deletion;
- notification permission/schedule/tap;
- vault missing/corrupt/unsupported states.

For each journey capture starting state, exact actions, expected result, actual result, build/device metadata, and evidence. If a bug is found, use the repository bug-report template and repeat the same flow after the smallest correct fix.

### 15.5 Performance test datasets

Create deterministic, non-sensitive fixtures:

- empty new user;
- median active user;
- stress Shelf: hundreds of active/archive rows;
- stress completions: at least one year;
- stress photos: 50 minimum supported, 100, and engineering ceiling;
- large outbox with mixed retry states;
- export with more than 1,000 rows in each unbounded table;
- deletion with multiple storage pages;
- realistic catalog scale and query distribution;
- long text and maximum note sizes.

Document seed version and checksum. Device evidence must never use a real user’s private content.

### 15.6 Normal CI pipeline

The repository currently has a security-oriented workflow but needs a normal quality and release pipeline.

Every pull request:

- install from lockfile;
- Expo dependency check and Expo Doctor;
- repository/mobile typecheck;
- lint with zero new warnings;
- unit/component/integration tests;
- docs/source-of-truth audits where applicable;
- Supabase migration reset/upgrade and policy lint;
- Edge Function typecheck/tests;
- production Expo exports for iOS/Android;
- bundle/asset budget diff;
- forbidden analytics/log fields scan;
- generated config/manifest diff;
- dependency/license/vulnerability checks.

Release candidate:

- signed iOS/Android artifacts;
- native config inspection;
- symbol/source-map upload verification;
- upgrade from previous production;
- physical-device E2E matrix;
- Instruments/Perfetto evidence;
- backend load/query-plan suite;
- OTA rollback drill if enabled;
- TestFlight/Play internal-track smoke;
- privacy manifest and store declaration review.

Nightly or scheduled:

- stress/concurrency suite;
- full migration replay;
- catalog ingestion/search load;
- webhook burst/reorder tests;
- export/deletion large-data tests;
- dependency drift/security audit;
- retention dry-run;
- performance trend build on stable devices if infrastructure exists.

### 15.7 Performance change protocol

Every optimization PR should state:

- problem and measured baseline;
- hypothesis;
- exact supported devices and dataset;
- change;
- before/after samples and distribution;
- memory/battery/binary tradeoff;
- privacy/correctness risks;
- regression tests;
- rollback trigger.

Reject “it feels faster” and simulator-only approval. Also reject micro-optimizations without evidence when a higher-severity correctness or memory issue remains.

### 15.8 Production rollout

- use internal -> small canary -> staged percentage -> full rollout;
- compare crash-free sessions, ANR, startup, slow/frozen frames, API failures, outbox health, purchase/entitlement errors, and photo failure enums;
- stop rollout on predeclared thresholds;
- keep exact rollback/forward-fix ownership;
- ensure database/key migrations remain compatible with rollback;
- conduct a post-release review and add escaped defects to the regression suite.

## 16. Metric Registry And Initial Release Gates

Final numerical thresholds must be predeclared in the official performance evidence and approved using representative release builds. The values below are starting targets, not retroactive claims of compliance.

### 16.1 App-level metrics

| Metric                                 |                               Suggested initial gate | Dataset/state                   | Evidence                                  |
| -------------------------------------- | ---------------------------------------------------: | ------------------------------- | ----------------------------------------- |
| Crash-free sessions                    |                                             >= 99.9% | staged production               | Sentry/store console                      |
| Android user-perceived ANR             |                                 < 0.47%, goal < 0.2% | staged production               | Android Vitals                            |
| Cold start to first meaningful content |                           p50 <= 1.5 s, p95 <= 2.5 s | signed build, median local data | Instruments/Macrobenchmark/manual markers |
| Warm start                             |                                         p95 <= 1.0 s | process alive                   | device traces                             |
| Resume from background                 |              p95 <= 500 ms to safe interactive state | unlocked/locked separately      | device traces                             |
| Tap acknowledgement                    |                                        p95 <= 100 ms | Today/Shelf/common controls     | profiler + video                          |
| Today durable completion               |                                  p95 <= 250 ms local | median/stress completion log    | operation marker                          |
| Slow frames during critical scroll     |                                                 < 5% | stress list                     | Core Animation/FrameMetrics               |
| Frozen frames                          |                                 0 in acceptance runs | stress list                     | platform tooling                          |
| JS/main-thread long tasks              |                   no unexplained > 50 ms on tap path | critical flows                  | traces                                    |
| Peak memory                            | no warning/kill and within calibrated device ceiling | 50/100 photos                   | VM/memory profiler                        |
| Background CPU/network                 |                   zero when related feature disabled | 10-minute observation           | energy/network trace                      |
| Local corruption/data loss             |                                                 zero | failure-injection suite         | automated + recovery logs                 |

### 16.2 Photo metrics

| Metric                           |                       Suggested initial gate | Notes                          |
| -------------------------------- | -------------------------------------------: | ------------------------------ |
| Capture tap to review-ready      |                                 p95 <= 1.5 s | representative lighting/image  |
| Review confirm to durable commit |                                 p95 <= 2.0 s | encrypted original + thumbnail |
| Grid thumbnail first display     |           p95 <= 250 ms warm, <= 600 ms cold | visible item                   |
| Timeline scroll                  | no frozen frames, calibrated slow-frame gate | 50-photo minimum               |
| Concurrent decrypts              |                               <= 2 initially | tune with evidence             |
| Decoded image cache              |        explicit byte ceiling by device class | evict on lifecycle             |
| Plaintext staging residue        |                  zero after cleanup/relaunch | filesystem inspection          |
| Photo operation recovery         |       100% deterministic or typed quarantine | injected failures              |
| Private image disk-cache residue |                                         zero | inspect both platforms         |

### 16.3 Network/backend metrics

| Metric                |                                 Suggested initial gate | Notes                         |
| --------------------- | -----------------------------------------------------: | ----------------------------- |
| Catalog exact barcode |   p95 <= 300 ms server, <= 1.0 s user-perceived online | warm/cold DB separated        |
| Catalog text search   |                                   p95 <= 500 ms server | realistic catalog/concurrency |
| Edge error rate       |                            < 0.5%, excluding valid 4xx | per endpoint                  |
| Request timeout       |                    endpoint specific, generally 5–10 s | explicit cancellation         |
| Outbox convergence    |                     p95 <= 30 s after stable reconnect | no poison blocking            |
| Webhook projection    |                               p95 <= 10 s from receipt | duplicates/reorder safe       |
| Export correctness    |                         100% manifest counts/checksums | >1,000-row fixtures           |
| Account deletion      |                       100% eventual complete/retryable | multi-page storage            |
| Slow SQL              | zero unowned critical queries above approved threshold | query dashboard               |
| Retention backlog     |         zero beyond one job interval plus alert window | scheduled jobs                |

### 16.4 Artifact metrics

Track iOS and Android separately:

- Hermes bytecode size;
- compressed JS and asset bytes;
- font asset count/bytes;
- signed download and installed size;
- native framework/library size;
- per-ABI size;
- source map/symbol availability;
- dependency count;
- startup native/JS module count.

Start with a regression budget, then set absolute ceilings from actual signed artifacts. The measured export already gives a baseline: roughly 9.9 MB iOS/10 MB Android Hermes bytecode and 3.20/4.11 MB of exported assets before signed-artifact packaging.

### 16.5 Measurement rules

- Use at least five official physical-device samples per platform/configuration, matching the current testing strategy; use more for noisy latency metrics.
- Report median, p95 where sample size permits, range, and failures.
- Use the same build, fixture, device state, and action script for before/after comparison.
- Warmups must be declared.
- Never discard slow runs without a recorded exclusion reason.
- Test the lowest supported performance class.
- Separate offline, poor-network, and healthy-network scenarios.
- Preserve content-free raw evidence or summarized screenshots according to privacy policy.

## 17. Prioritized Execution Roadmap

### Phase 0 — Freeze claims and build the baseline

Target: one to two weeks.

- Confirm product/device/support scope.
- Merge or separately validate the current dirty storage/security hardening.
- Establish signed release builds and stable fixtures.
- Capture current startup, memory, scroll, photo, binary, API, and database evidence.
- Add operation markers and content-free logging.
- Create normal CI.
- Declare gates and owners.

Exit:

- reproducible benchmark procedure;
- no unresolved ambiguity about build/config/dataset;
- every P0 has an owner and test;
- current failures/warnings triaged rather than hidden.

### Phase 1 — Privacy and data-integrity blockers

Target: two to four weeks.

- Explicit private image cache policy and proof.
- Plaintext staging journal/scavenger.
- Atomic private-store updates and non-destructive errors.
- Account-generation leases on all async work.
- Transactional encrypted outbox.
- Photo mutation journal and recovery tests.
- Native storage/backup/Keychain/Keystore proof.
- Export pagination and deletion paging correction.
- Webhook atomic idempotency/order.

Exit:

- no known path from unavailable/corrupt to silent empty;
- no demonstrated lost update or cross-account late write;
- private plaintext/cache evidence clean;
- export/deletion correctness stress tests green.

### Phase 2 — Photo and list architecture

Target: three to six weeks, potentially parallel with Phase 1 after design approval.

- Approve photo envelope/native-module plan.
- Bounded image dimensions and native/streaming crypto path.
- Encrypted thumbnails.
- Deduplicated bounded memory cache.
- Virtualized Progress/pickers and growing Shelf/Ask lists.
- Route-blur/background/memory-pressure cleanup.
- 50/100-photo physical-device profiles.

Exit:

- no full-resolution eager timeline path;
- no base64/hex amplification on the target path;
- no memory warning/kill in stress acceptance;
- scroll and photo metrics meet declared gates.

### Phase 3 — Startup, bundle, and interaction speed

Target: two to four weeks.

- Startup dependency graph and mounted privacy shield where approved.
- Minimal font embedding/import correction.
- Lazy noncritical notification/analytics/business work.
- Mobile-aware query focus/connectivity.
- Entitlement fast path and coordinator.
- Route view models/input isolation/cache updates.
- Bundle and artifact budgets.

Exit:

- startup/tap gates green on lowest supported classes;
- font asset regression removed;
- disabled features perform no background work;
- no unexplained bundle regression.

### Phase 4 — Backend scale and operational maturity

Target: three to six weeks.

- Indexed catalog query and production ingestion pipeline.
- Edge deployment manifest.
- Rate-limit index/cleanup correction.
- retention schedules;
- query/load dashboards;
- export/deletion state machines;
- entitlement maintenance and webhook replay;
- API deadlines/cancellation/cache policy.

Exit:

- critical query plans and load tests approved;
- all functions deploy declaratively;
- retention runs are observable;
- operational recovery drills pass.

### Phase 5 — Native polish and release proof

Target: two to four weeks.

- iOS Instruments and Android Perfetto complete matrix.
- Android Baseline Profile/Macrobenchmark if maintainable.
- accessibility and premium-state pass;
- predictive back/theme decision;
- signed artifact/privacy manifest/16 KB verification;
- upgrade/rollback/canary rehearsal;
- performance evidence packet and launch-readiness update.

Exit:

- official evidence meets predeclared thresholds;
- no open P0/P1 launch blockers;
- store declarations match reality;
- rollback and incident owners are named.

## 18. Detailed Task Register

The following register is intended to prevent small-but-important work from disappearing. Status is `Not started` unless the repository already has unverified work in progress.

### 18.1 P0 — correctness, privacy, and launch safety

| ID      | Task                                                                 | Status                                                                                                                                                                                                 | Proof required                                |
| ------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| OPT-001 | Explicitly disable disk caching for sensitive image sources          | Implemented locally; physical-device filesystem proof pending                                                                                                                                          | device filesystem inspection                  |
| OPT-002 | Clear decoded/private image memory on lock/background/account switch | Implemented locally; native decoded-memory proof pending                                                                                                                                               | lifecycle test + memory trace                 |
| OPT-003 | Journal and scavenge plaintext capture/share/export staging          | Implemented locally; native force-quit/filesystem proof pending                                                                                                                                        | force-quit/relaunch test                      |
| OPT-004 | Preserve ciphertext on missing/invalid key across every store        | Implemented locally; signed-device key-loss/restore proof pending                                                                                                                                      | corruption/key-loss matrix                    |
| OPT-005 | Serialize and journal photo mutations                                | Implemented locally; native process-kill recovery proof pending                                                                                                                                        | race/failure injection                        |
| OPT-006 | Remove ordinary-read photo metadata rewrite                          | Verified locally                                                                                                                                                                                       | read-only regression test                     |
| OPT-007 | Make private-store read/modify/write atomic                          | Implemented locally; device proof pending                                                                                                                                                              | simultaneous writer tests                     |
| OPT-008 | Return typed unavailable/corrupt/unsupported states                  | Implemented locally; native fault-path proof pending                                                                                                                                                   | store-by-store tests                          |
| OPT-009 | Bind async writes to owner/account generation                        | Implemented locally; physical account-switch proof pending                                                                                                                                             | delayed A-to-B tests                          |
| OPT-010 | Create encrypted transactional outbox                                | In progress; core + Shelf + conflict choices + Shelf scans + notification prefs/delivery + recommendation prefs                                                                                        | offline/reconnect/duplicate worker            |
| OPT-011 | Verify iOS Keychain/file protection/backup exclusion                 | Partial local hardening; durable-file backup exclusion and signed proof pending                                                                                                                        | signed-device artifact/test                   |
| OPT-012 | Verify Android Keystore/backup/data extraction                       | Implemented locally; signed manifest/resource and physical proof pending                                                                                                                               | merged manifest + device test                 |
| OPT-013 | Paginate/verify complete data exports                                | Implemented locally with bounded fail-closed Edge assembly and bounded incremental mobile file output; >8 MiB streaming/archive, snapshot/resume, hosted coverage, and native heap/share proof pending | >1,000-row count/checksum + byte-bound stress |
| OPT-014 | Fix storage deletion pagination and make deletion resumable          | Core resumable deletion implemented locally; hosted failure proof pending                                                                                                                              | multi-page failure injection                  |
| OPT-015 | Make RevenueCat event insert/projection atomic and ordered           | Implemented locally; staging replay/alert proof pending                                                                                                                                                | duplicate/reorder suite                       |
| OPT-016 | Declaratively configure every Edge Function                          | Implemented locally; hosted smoke/resource proof pending                                                                                                                                               | manifest/source diff + smoke                  |
| OPT-017 | Add scheduled retention matching privacy claims                      | Blocked externally on approved retention policy and operations ownership                                                                                                                               | job run and backlog alert                     |
| OPT-018 | Establish signed physical-device performance baseline                | Blocked on execution evidence                                                                                                                                                                          | iOS/Android packet                            |

### 18.2 P1 — major speed, memory, and scale

| ID      | Task                                                        | Proof required                     |
| ------- | ----------------------------------------------------------- | ---------------------------------- |
| OPT-101 | Approve and implement photo v2 streaming/native path        | memory/time/privacy comparison     |
| OPT-102 | Generate encrypted thumbnail tiers                          | integrity + visual acceptance      |
| OPT-103 | Add bounded deduplicated decrypt/cache coordinator          | concurrency/memory traces          |
| OPT-104 | Virtualize Progress timeline and photo pickers              | 50/100-photo scroll traces         |
| OPT-105 | Virtualize growing Shelf/archive/Ask collections            | stress list evidence               |
| OPT-106 | Replace package-root font imports/embed minimal fonts       | export/artifact diff + screenshots |
| OPT-107 | Instrument and parallelize safe startup gates               | startup phase distribution         |
| OPT-108 | Split minimal notification root handler from business logic | startup/module diff                |
| OPT-109 | Lazy-disable behavioral triggers when preference is off     | zero background work trace         |
| OPT-110 | Add RN focus/online managers to TanStack Query              | lifecycle/query-count tests        |
| OPT-111 | Owner-namespace query keys and midnight invalidation        | account/date tests                 |
| OPT-112 | Consolidate useProgress reads/server requests               | query/storage count                |
| OPT-113 | Add entitlement coordinator/local fast path                 | unlock/startup evidence            |
| OPT-114 | Build route view models for Today, Progress, Shelf, Ask     | commit/flamegraph comparison       |
| OPT-115 | Isolate Ask/OCR/search/note text inputs                     | keystroke profiler                 |
| OPT-116 | Replace catalog `ILIKE` plan with indexed search            | EXPLAIN/load results               |
| OPT-117 | Build streaming restartable catalog importer                | full-scale staging rehearsal       |
| OPT-118 | Add request deadlines/cancellation/retry taxonomy           | network failure matrix             |
| OPT-119 | Align rate-limit cleanup predicate/index                    | plan + scheduled cleanup           |
| OPT-120 | Add bundle/native-artifact budgets                          | CI pass/fail fixture               |
| OPT-121 | Decide/configure EAS Update or remove OTA claims            | rollback drill or doc correction   |

### 18.3 P2 — polish and ongoing efficiency

| ID      | Task                                                          | Proof required                    |
| ------- | ------------------------------------------------------------- | --------------------------------- |
| OPT-201 | Route-level system bar and theme decision                     | screenshots/device pass           |
| OPT-202 | Predictive back enablement after E2E                          | API/device matrix                 |
| OPT-203 | Accessibility actions for comparison and gestures             | VoiceOver/TalkBack test           |
| OPT-204 | Complete Reduce Motion coverage                               | device setting pass               |
| OPT-205 | Tokenize loading/error/offline/unavailable states             | visual regression review          |
| OPT-206 | Add pseudo-localization/long-string testing                   | screenshot matrix                 |
| OPT-207 | Add Android Baseline Profile if maintainable                  | macrobenchmark comparison         |
| OPT-208 | Add content-free local diagnostics                            | security review + failure drill   |
| OPT-209 | Review supported modular imports for Sentry/RevenueCat/router | actual artifact diff              |
| OPT-210 | Optimize source icon/assets                                   | signed artifact/visual comparison |
| OPT-211 | Split oversized routes at measured ownership boundaries       | profiler/test improvement         |
| OPT-212 | Add maintenance dashboards/runbooks                           | incident exercise                 |

## 19. Definition Of Done For “Maximized”

The app may be described as maximized for the approved React Native architecture only when all of the following are true:

- all P0 items are complete with evidence;
- no open release-blocking P1 item remains;
- signed iOS and Android builds meet predeclared device thresholds;
- the 50-encrypted-photo minimum passes without crash, OS kill, plaintext residue, or unacceptable frame/memory behavior;
- lowest supported device classes pass critical flows;
- private data fails closed without destructive empty-state conversion;
- two simultaneous writes cannot lose a user action;
- delayed old-account work cannot mutate the new account;
- offline work converges idempotently;
- catalog search uses a proven index at realistic scale;
- webhook events are atomic, idempotent, and ordering-safe;
- export is complete above platform row limits;
- deletion is resumable and complete across multiple pages;
- privacy retention claims are enforced by jobs;
- every deployed function is declarative and smoke-tested;
- crash symbols/source maps/mappings are recoverable for the exact release;
- accessibility, Reduce Motion, large text, and critical error states pass human review;
- update/rollback behavior is rehearsed;
- performance evidence is linked from launch readiness and approved according to repository governance.

“All tests pass” alone is not sufficient. “Works in Expo Go,” “looks smooth on a simulator,” or “uses native components” are not performance evidence.

## 20. Changes That Should Not Be Made

- Do not rewrite the entire app in Swift.
- Do not create separate Swift and Kotlin product implementations.
- Do not adopt a new state library, list library, database, image library, or native module without measuring the current bottleneck and reviewing privacy/migration/maintenance cost.
- Do not weaken app lock, account isolation, encryption, consent, or photo privacy to improve startup.
- Do not enable Sentry tracing, replay, screenshots, or broad analytics without privacy approval.
- Do not persist decrypted photos for convenience.
- Do not add blanket `useMemo`, `useCallback`, `React.memo`, or lazy imports without profiler proof.
- Do not reduce image quality or supported-device scope to make a benchmark pass without a product decision.
- Do not patch `node_modules`.
- Do not optimize development-mode timings.
- Do not ship a local database migration without rollback/account/key tests.
- Do not mark performance complete from unit tests or simulator runs.
- Do not build speculative architecture that bypasses the free core loop or current source-of-truth requirements.

## 21. Required Architecture And Product Decisions

The following need explicit approval before implementation:

1. Photo envelope v2 and narrow native photo/crypto module.
2. Encrypted transactional database for growing structured local data.
3. Transactional encrypted outbox schema and conflict policy.
4. Mounted privacy shield versus current full verification/remount startup behavior.
5. Production performance telemetry within the Phase 9 privacy constraints.
6. EAS Update adoption and rollback-compatible migration policy.
7. Full dark-mode support versus explicit light-only launch.
8. Android Baseline Profile/native benchmark harness ownership.
9. Minimum photo dimensions/format/quality and thumbnail tiers.
10. Absolute app binary, memory, startup, and backend latency gates after baseline.

Each approved decision must update the Master Plan/architecture/decision sources before or with implementation, as required by repository governance.

## 22. Recommended First Pull Requests

Keep the first changes small and independently verifiable:

1. **Measurement and CI:** add reproducible production export statistics, font-asset manifest, Expo Doctor/dependency checks, and content-free operation markers.
2. **Sensitive cache safety:** set explicit private image cache policy, add lifecycle clearing, and prove filesystem behavior.
3. **Font imports:** remove unused font-family assets and compare signed artifacts/screenshots.
4. **Export/deletion correctness:** paginate exports, fix storage deletion paging, and add large-data tests.
5. **Webhook transaction:** atomic idempotency/order RPC, deployment config, and replay tests.
6. **Storage semantics:** typed private-store failures plus atomic update primitive, migrated one store at a time.
7. **Progress thumbnails/virtualization design:** architecture decision and a vertically sliced implementation behind a migration-safe path.
8. **Outbox foundation:** reviewed schema, owner-generation lease, one entity type, reconnect tests, then expand.

This sequence removes immediate privacy/correctness risk, establishes proof, and creates the infrastructure needed to optimize the expensive photo and synchronization systems without a destabilizing rewrite.

## 23. Audit Limitations And Revalidation

This document is an engineering audit and execution plan, not proof that the recommendations have been implemented.

- The repository was actively changing during the audit. Existing worktree changes were preserved.
- Current uncommitted storage/app-lock/photo changes were inspected as work in progress, not accepted as complete.
- Native device traces, signed artifact inspection, backend production-scale plans, and production dashboards were not available as completed evidence.
- One audit snapshot reported repository lint with one warning and tests with eight failures while concurrent changes were present. That is not a clean-baseline verdict and must be rerun on the intended commit.
- Expo dependency validation passed, Expo Doctor passed 21/21 with a Sentry environment warning, production dependency audit reported zero known vulnerabilities, and the inspected native/config/Edge/Supabase/type checks passed at that snapshot.
- Bundle numbers came from local Expo production exports and must be repeated in CI and on signed artifacts.

Re-run this audit after the P0 phase, after the photo architecture change, before release candidate approval, and whenever Expo SDK, React Native, storage encryption, RevenueCat, Supabase, routing, or supported device policy changes materially.

## 24. Code Hotspot And Ownership Map

This map ties the plan to the current repository. Paths are relative to the repository root; line numbers are intentionally omitted because the worktree is active.

### 24.1 Bootstrap, navigation, and lifecycle

| Area                    | Primary files                                                                                              | Why they matter                                                |
| ----------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Root bootstrap          | `apps/mobile/src/app/_layout.tsx`                                                                          | font gate, providers, status bar, root imports, startup order  |
| Tab lifecycle           | `apps/mobile/src/app/(tabs)/_layout.tsx`                                                                   | inactive-route retention and back/tab behavior                 |
| Authentication boundary | `apps/mobile/src/lib/auth/AuthProvider.tsx`                                                                | session hydration, account generation, provider evaluation     |
| Private-data gate       | `apps/mobile/src/lib/storage/PrivateDataAvailabilityGate.tsx`                                              | full-record verification, fail-closed shield/remount           |
| App lock                | `apps/mobile/src/lib/applock/AppLockProvider.tsx`, `authenticate.ts`, `singleFlight.ts`, `privacyState.ts` | biometric lifecycle and privacy cover                          |
| Photo lock              | `apps/mobile/src/features/photos/PhotoStorageGate.tsx`, `PhotoTimelineLockGate.tsx`                        | photo availability and route privacy                           |
| Query lifecycle         | `apps/mobile/src/lib/query/queryClient.ts`                                                                 | stale/retry defaults, missing mobile focus/connectivity policy |
| App configuration       | `apps/mobile/app.config.js`, `apps/mobile/eas.json`                                                        | native flags, backup, build/update/release posture             |

### 24.2 Photo and camera pipeline

| Area                   | Primary files                                                                                                       | Required focus                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Binary/encryption path | `apps/mobile/src/features/photos/encryptedStorage.ts`                                                               | base64/hex amplification, atomic file envelope v2       |
| Metadata transaction   | `apps/mobile/src/features/photos/store.ts`, `metadata.ts`                                                           | serialization, journal, typed failure, v1/v2 migration  |
| React data hook        | `apps/mobile/src/features/photos/usePhotos.ts`                                                                      | cache updates, cancellation, owner binding              |
| Display                | `apps/mobile/src/features/photos/PhotoImage.tsx`                                                                    | explicit cache policy, dedup, bounded decode            |
| Timeline               | `apps/mobile/src/app/(tabs)/progress.tsx`, `timeline.ts`                                                            | virtualization and thumbnail-first reads                |
| Capture/review         | `apps/mobile/src/app/progress/capture.tsx`, `review.tsx`, `apps/mobile/src/app/photos/capture.tsx`, `review.tsx`    | protected staging, interruption, opaque navigation IDs  |
| Detail                 | `apps/mobile/src/app/progress/[id].tsx`, `apps/mobile/src/app/photos/[id].tsx`                                      | full rendition lifecycle and delete/share behavior      |
| Comparison             | `apps/mobile/src/features/photos/CompareSlider.tsx`                                                                 | UI-thread gesture, decoded pair memory, accessibility   |
| Time-lapse             | `apps/mobile/src/features/photos/PhotoTimelapse.tsx`, `timelapse.ts`                                                | frame prefetch and release                              |
| Share                  | `apps/mobile/src/features/photos/sharePhoto.ts`                                                                     | plaintext journal, short lifetime, cleanup              |
| Lighting/face analysis | `analyzePhotoLighting.ts`, `captureAnalysis.ts`, `CaptureAnalysisProvider.native.tsx`, `useDetectedFaces.native.ts` | preserve downsampling/on-device focus; cancel lifecycle |
| Native camera/barcode  | `apps/mobile/src/features/native/camera/barcode.ts`                                                                 | terminal-state cooldown and frame gating                |

### 24.3 Local private data and synchronization

| Area                      | Primary files                                                                   | Required focus                                             |
| ------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Private KV                | `apps/mobile/src/lib/storage/privateKV.ts`, `privateKVContentKey.ts`            | atomic transforms, typed availability, key lifecycle, AAD  |
| Auth session storage      | `apps/mobile/src/lib/supabase/largeSecureStore.ts`, `largeSecureStoreCrypto.ts` | non-destructive key failure, per-key concurrency/migration |
| Shelf state               | `apps/mobile/src/features/shelf/store.ts`, `mutations.ts`, `useShelf.ts`        | atomic reducer, owner lease, outbox                        |
| Completion state          | `apps/mobile/src/features/today/completionsStore.ts`, `cycleCompletion.ts`      | idempotency, local-day keys, atomic outbox append          |
| Existing completion queue | `apps/mobile/src/lib/offline/completionQueue.ts`, `completionQueue.pure.ts`     | replace/absorb into centralized outbox                     |
| Notification stores       | `apps/mobile/src/features/notifications/store.ts`, `sentStore.ts`               | versioned atomic writes and bounded history                |
| Consent                   | `apps/mobile/src/lib/consent/consent.ts`, `withdrawal.ts`                       | owner-bound server work and durable local state            |
| Scan log                  | `apps/mobile/src/features/shelf/scanLog.ts`                                     | bounded storage and owner-bound mirror                     |
| Entitlement local state   | `apps/mobile/src/features/subscription/store.ts`                                | verified snapshot/version/owner semantics                  |

### 24.4 Critical routes and render boundaries

| Surface         | Primary files                                                               | Audit focus                                        |
| --------------- | --------------------------------------------------------------------------- | -------------------------------------------------- |
| Today           | `apps/mobile/src/app/(tabs)/today.tsx` and routine feature hooks            | route view model, completion tap path              |
| Shelf           | `apps/mobile/src/app/(tabs)/shelf.tsx`, `app/shelf/[id].tsx`, `archive.tsx` | virtualized lists, derived engine work             |
| Search/scan/OCR | `app/shelf/search.tsx`, `scan.tsx`, `ocr.tsx`, `manual.tsx`                 | input isolation, cancellation, native OCR          |
| Ask             | `apps/mobile/src/app/ask/index.tsx` and `app/ask/*`                         | typing hot path, results/history virtualization    |
| Progress        | `apps/mobile/src/app/(tabs)/progress.tsx` and `app/progress/*`              | image memory, list lifecycle                       |
| Onboarding      | `apps/mobile/src/app/onboarding/*`                                          | artificial waits, animation, first-use startup     |
| Paywall         | `apps/mobile/src/app/onboarding/paywall.tsx`, `app/paywall/*`               | offering lifecycle, restore/purchase coordination  |
| Settings        | `apps/mobile/src/app/settings/*`                                            | lazy diagnostics/export/deletion and accessibility |

### 24.5 Query, subscriptions, notifications, and observability

| Area                | Primary files                                                      | Audit focus                                                |
| ------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------- |
| Progress query      | `apps/mobile/src/features/routine/useProgress.ts`                  | duplicate local reads and sequential server calls          |
| Entitlement query   | `apps/mobile/src/features/subscription/useEntitlement.ts`          | local fast path and background reconciliation              |
| Pro gate            | `apps/mobile/src/features/subscription/ProGate.tsx`                | avoid offering fetch for already-active users              |
| Offering            | `apps/mobile/src/features/subscription/useSubscriptionOffering.ts` | one coordinator and request deduplication                  |
| Behavioral triggers | `apps/mobile/src/features/notifications/BehaviouralTriggers.tsx`   | unnecessary mounted hooks/background work                  |
| Delivery root       | `apps/mobile/src/features/notifications/deliver.ts`                | split minimal handler from business/server imports         |
| Sentry              | `apps/mobile/src/lib/observability/sentry.ts`                      | privacy-safe symbolicated diagnosis and bundle composition |
| PostHog             | analytics modules referenced by feature analytics files            | typed allowlist, lifecycle flush, never critical path      |
| Fonts               | `apps/mobile/src/theme/fonts.ts`                                   | direct imports/native embedding and eight-face manifest    |

### 24.6 Catalog and server

| Area                 | Primary files                                                                                                                           | Audit focus                                            |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Client contract      | `apps/mobile/src/features/catalog/client.ts`                                                                                            | deadlines, cancellation, error taxonomy, caching       |
| Normalization/parser | `normalization.ts`, `ingredientParser.ts`, `quality.ts`                                                                                 | preserve deterministic/tested behavior                 |
| OBF helper           | `apps/mobile/src/features/catalog/obf.ts`                                                                                               | fixture logic, not production importer                 |
| Import script        | `scripts/phase4/import-obf-snapshot.mjs`                                                                                                | replace with streaming, restartable ingestion          |
| Catalog search       | `supabase/functions/catalog-search/index.ts`                                                                                            | indexed query, round trips, nonblocking logging        |
| Barcode lookup       | `supabase/functions/catalog-lookup/index.ts`                                                                                            | preserve exact indexed path, external safeguards       |
| Export               | `supabase/functions/data-export/index.ts`                                                                                               | pagination, snapshot, bounded concurrency, manifest    |
| Account deletion     | `supabase/functions/account-deletion/index.ts`, `photoStorageCleanup.ts`                                                                | stable storage pagination and idempotent state machine |
| RevenueCat webhook   | `supabase/functions/revenuecat-webhook/index.ts`                                                                                        | atomic idempotency, ordering, deployment auth          |
| Subscription grants  | `supabase/functions/subscription-grants/index.ts`                                                                                       | remove global expiry update from grant path            |
| Catalog schema/index | `supabase/migrations/20260612000003_catalog.sql`, `20260614000026_phase4_catalog.sql`                                                   | match search predicates to indexes                     |
| Entitlements         | `20260612000009_entitlements.sql`, `20260613000020_subscription_extensions.sql`, `20260707000035_phase6_reverse_trial_atomic_grant.sql` | event/projection transaction and expiry maintenance    |
| Rate limits          | `supabase/migrations/20260705000029_phase9_edge_rate_limits.sql`                                                                        | cleanup predicate/index alignment                      |

### 24.7 Evidence and governance

| Area                   | Primary files                                                                                              | Use                                |
| ---------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Master scope           | `docs/MASTER_PLAN.md`, `PRODUCT_REQUIREMENTS.md`, `ARCHITECTURE.md`, `DECISIONS.md`                        | approve scope/architecture changes |
| Performance            | `docs/phase-5/performance-evidence-runbook.md` and generated evidence artifacts                            | threshold-first device proof       |
| Device policy          | `docs/DEVICE_SUPPORT_POLICY.md`                                                                            | test matrix floor                  |
| Testing                | `docs/TESTING_STRATEGY.md`, `HUMAN_SIMULATED_E2E_TESTING.md`, `E2E_TESTING_CHECKLIST.md`                   | acceptance workflow                |
| Launch                 | `docs/ROADMAP.md`, `docs/phase-8/launch-dry-run-checklist.md`, `docs/phase-11/support-launch-readiness.md` | status and launch gates            |
| Architecture proposals | `docs/MASTER_PLAN_UPDATE_PATCH.md`, `docs/DECISIONS.md`                                                    | required decision path             |

## 25. Framework Decision Record

| Option                                        | iOS quality ceiling                                    | Android coverage                                 | Delivery risk                                                        | Recommendation                   |
| --------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------ | -------------------------------------------------------------------- | -------------------------------- |
| Keep Expo React Native and optimize           | High; native modules available for measured hot paths  | Full shared product                              | Lowest                                                               | **Choose this**                  |
| Rewrite all in Swift                          | High iOS ceiling                                       | None; still requires a separate Android app      | Extreme product and correctness duplication                          | Reject                           |
| Separate Swift + Kotlin rewrites              | High platform ceiling                                  | Full only after two implementations              | Extreme schedule, feature drift, testing, privacy, and staffing cost | Reject                           |
| Keep RN UI but add narrow photo native module | High where the measured binary/image bottleneck exists | Symmetric Swift/Kotlin adapter behind one TS API | Moderate and contained                                               | **Likely target after approval** |

React Native is not permission to ignore native engineering. A premium outcome still requires signed-device profiling, native lifecycle/storage knowledge, disciplined JS rendering, backend scale work, platform accessibility, and release operations. The framework should remain shared; the few proven hot paths should cross into native code behind small, testable interfaces.
