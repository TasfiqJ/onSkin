# Phase 5 Exit Review

## Current Status

Implementation baseline is in progress-ready state, not device-certified state.

Completed in repo:

- Native camera dependency and config plugin added.
- Native support floor accepted and guarded: iPhone on iOS 17.0+ via
  `docs/DEVICE_SUPPORT_POLICY.md`, `app.base.json`, and
  `phase5:check-native-config`. iPad and Android are outside the active release
  contract. Android compile/target SDK remain pinned to API 36 as source-health
  posture only.
  The launch-blocking web-compatible layout floor is now 360 x 640; 320-wide
  browser evidence is retained as stress/resilience coverage.
- Runtime version policy added.
- Android camera and notification permissions remain narrowly declared for
  source health, without creating an Android release claim.
- Exact-alarm permissions intentionally absent.
- Shelf barcode scanner uses live camera, local checksum validation, duplicate suppression, and Phase 4 catalog lookup.
- Ingredient label path captures a real label image and requires editable user-confirmed text.
- Progress capture uses the front camera, sends the real still and dimensions
  to review, and saves encrypted local photo files. Review now performs
  on-device post-capture ML Kit face framing/pose analysis plus a temporary
  64 px local luminance/balance sample. Timer-generated readiness and quality
  scores were removed; no-face, multiple-face, timeout, and unavailable states
  fail closed, and low/unavailable quality never blocks Save. Measured records
  carry local provenance; legacy timer scores are excluded from reference and
  detail labels. Local photo save performs no automatic Supabase image or
  metadata insert, and current Settings/locked Progress expose device-only
  storage with no backup setter or switch. An additive
  database migration clears pre-provenance server values and rejects future
  quality/pose metadata without `post_capture_measurement` provenance.
- Opt-in app lock now delays app-tree mount until its encrypted preference
  resolves, fails closed when that preference is unreadable, and gives the
  Progress tab plus direct capture, review, and detail entries one shared
  foreground-only timeline unlock. Expo web direct-route/session evidence is
  complete; native LocalAuthentication ordering, background relock, and
  VoiceOver/TalkBack focus remain physical-device blockers.
- Data-bearing Progress routes now require a successful encrypted metadata read
  after entitlement and lock checks. Persistent read failure keeps tab,
  capture, review, and detail content plus mutations unmounted behind shared
  retry recovery instead of rendering false empty/missing states. Supported
  Expo web evidence is complete; native Keychain/Keystore fault injection and
  assistive-technology recovery remain physical-device blockers.
- Photo timeline/detail/compare render through encrypted-aware image loading.
- Photo deletion removes local encrypted files.
- Phase 5 config check and device QA packet generator added.
- CAT-06 now has one source lifecycle across Shelf Scan, Shelf OCR, and Progress
  Capture. It closes preview admission on unavailable/unfocused/inactive/
  business-gated or unverified-permission state, waits for camera-ready,
  replaces a failed preview with a fresh keyed generation, and invalidates
  queued callbacks through camera-operation leases. When the iOS permission
  prompt drives AppState `inactive`, its explicit request result is invalidated
  and a fresh foreground permission query becomes authoritative. Progress saves
  photo consent before the OS request and keeps exact raw-photo cleanup ownership
  outside entitlement, app-lock, storage, and content gates until cleanup or
  atomic review handoff.
- Native config now derives one exact camera purpose string from the resolved
  display name into both `NSCameraUsageDescription` and the `expo-camera`
  plugin. Alternate environment wording, malformed display names, control
  characters, unresolved build variables, and profile overrides fail closed.
  Only extraction from the future signed archive can prove the final value.
- A schema-v1 CAT-06 evidence contract replaces the legacy permission Boolean.
  It binds exact source hashes, staging/production EAS build, signed archive and
  final plist, two supported physical iPhones, three routes, nine scenario
  suites per route/device (54 runs), unique hash-verified proofs, install
  receipts, network/privacy/cleanup/accessibility reports, and three named
  signoffs. The template/smoke/packet wiring validates shape and provenance; no
  completed artifact has been supplied.
- IOS-02 has a production-disabled iOS extension target foundation with one
  variant-derived WidgetKit/App Group target, exact reviewed Expo dependency
  locks, a closed privacy-minimized timeline/action contract, encrypted
  capability mapping, fail-generic privacy-sensitive views, and main plus
  extension-target `PrivacyInfo.xcprivacy` declarations for App Group
  UserDefaults reason `1C8F.1`. Ordinary builds omit the target and production
  config rejects its QA-only opt-in.
- IOS-02 now also has a reviewed, hash-pinned patch for the exact installed
  `expo-widgets` 57.0.8 native sources. RoutineKind uses a bounded SQLite App
  Group store as its sole timeline/action authority and keeps UserDefaults for
  presentation/layout only. The native candidate provides rotating
  authority-nonce CAS, opaque owner generations, action-outbox persistence
  before `AppIntent.perform()` returns, two-entry current/future-stale
  timelines, all-or-redact reconciliation, a durable `privacy-closing-v1`
  sentinel plus synchronous closed-admission receipt before the queued purge, a
  closed authority tombstone, finite custom Live Activity stale dates, and
  owner-filtered activity recovery/end. The receipt proves admission closure,
  not completed ActivityKit dismissal.
  The app-side host is mounted in a stable lifecycle slot and serializes owner
  activation/release with expiry, withdrawal, sign-out, deletion, and account
  transition cleanup. Exact source hashes are checked after install and in CI.
  Interactive publication and RoutineKind Live Activity start remain signed
  configuration `false`; no Windows check proves Swift compilation or runtime.
- A structured performance-evidence template, strict validator, and smoke suite
  now require predeclared thresholds, supported physical-device/build proof,
  repeated raw supported-iPhone measurements including native OCR recognition
  and post-capture analysis,
  encrypted-photo load/memory evidence, validator-calculated nearest-rank
  p50/p95/max, and calculated pass/fail instead of trust-only booleans or
  hand-entered summaries.
- The generated QA packet now requires granular physical-device evidence flags
  for install, barcode, label capture, progress photos, encrypted photo storage,
  notifications, share sheet, RevenueCat, Sentry, Supabase catalog calls, and
  accessibility. Camera permission/lifecycle is artifact-only; its legacy
  Boolean is ignored. Conditional native OCR no
  longer accepts a Boolean: its separate schema-v2 artifact binds the EAS
  source ancestor, exact build/profile/archive, unchanged runtime hashes, two
  distinct physical iPhones, a 25-label five-class corpus, 50 device-label
  runs, an explicit two-label RTL floor, calculated unordered and
  ordered-sequence accuracy plus latency targets, accessibility,
  cancellation/temp-photo cleanup including Expo Camera/Image/SDWebImage
  disk-cache absence,
  zero-network capture, corpus rights/provenance, seven exact proof files, and
  named QA/privacy signoffs.
  Adversarial smoke coverage rejects source drift, nonlinear/merge histories,
  unledgered or post-evidence raw files, near-miss generated paths, dirty state,
  Boolean-only clearance, path traversal/symlinks, duplicate/missing runs,
  post-hoc/failed thresholds, impossible token-count/edit-distance arithmetic,
  privacy/cleanup/accessibility failures, evidence tampering, placeholders, and
  dirty state outside validated evidence.
- Widget flags cannot clear the packet by themselves. A separate strict
  schema-v3 lifecycle artifact binds the exact build-source commit `S` through
  the governed evidence ledger, exact EAS build,
  final app/extension/App Group/Team IDs, physical iPhone and named signoff to
  three typed raw signed ZIPs, four canonical parsed entitlement/privacy
  reports, four canonical scenario reports, and typed scenario proofs. Every
  report repeats the source/build/identity/raw-hash binding, device reports
  repeat the physical-device tuple, and duplicate paths or bytes are rejected.
- The generated QA packet hashes the human-simulated E2E rules, user-flow tree,
  manifest generator, and generated manifest so native QA reviewers can see
  which local UI evidence contract the build was checked against.

Still blocked before beta:

- EAS iOS builds with real build IDs and retained resolved-image/Xcode/SDK logs.
- Physical-device installs and matrix results.
- Exact-build CAT-06 evidence remains absent. The retained CAT-04 and CAT-05
  deterministic Expo-web packets predate the shared camera lifecycle and are
  stale until regenerated; both remain `nativeDeviceProof=false`. CAT-06 cannot
  close until the same signed archive passes final purpose-string inspection
  and all 54 governed two-iPhone runs for permission/Settings, AppState/focus,
  mount/readiness, route-specific operations, offline, interruption,
  accessibility, and privacy/cleanup.
- Exact-build physical-iPhone OCR evidence remains absent. The Apple Vision
  source candidate cannot become a launch claim until
  `phase5:native-ocr-evidence:strict`, `phase5:performance-evidence:strict`, and
  the conditional device packet pass against the same signed build.
- Physical-device validation and calibration of the post-capture face/pose and
  lighting heuristics, including diverse presentation/lighting conditions,
  analyzer failure, no network/template retention, and encrypted-save failure.
- Real-time preview face/lighting guidance remains unimplemented; launch copy
  must describe the implemented post-capture check unless a separately tested
  frame-processing pipeline replaces it.
- RevenueCat Test Store/sandbox native smoke.
- Sentry native crash/source-map smoke.
- Notification timing matrix on supported iPhones and iOS versions.
- macOS/Xcode compilation of the exact hash-pinned RoutineKind native lifecycle
  candidate. Local Windows source, installer, contract, and state-machine tests
  cannot establish Swift compilation, linker behavior, extension-process
  locking, signing, or ActivityKit/WidgetKit runtime correctness.
- Final cleared identifiers/deep links and a controlled signed-config change
  enabling RoutineKind publication/start only after disabled-archive inspection.
  The generic Expo activity paths are not covered by the finite RoutineKind
  lifecycle and must not be represented as covered.
- macOS archive inspection proving the extension privacy manifest is inside the
  signed `.appex`, followed by physical-iPhone widget families, locked-state
  privacy, interaction, deep-link, process-death, accessibility, and withdrawal
  QA using the final cleared app identity.
- Passing `phase5:performance-evidence:strict` artifact with owner-defined
  pre-measurement thresholds and real supported-device raw measurements.
- Brand/legal clearance for production identifiers.

## Seven-Figure Product Gate

Phase 5 supports the paid app thesis only if it makes the core loop trustworthy on real phones: scan/search product, add shelf item, capture progress, receive reminders, and share safely. The highest-risk revenue blockers are not visual polish; they are barcode match reliability, photo privacy proof, reminder reliability, and purchase SDK readiness.

Do not advance launch copy from "beta/internal" to customer-facing claims until
the generated QA packet has no blockers and every required granular evidence
flag is backed by physical-device evidence.
