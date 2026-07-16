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
- IOS-02 has a production-disabled iOS extension source scaffold with one
  variant-derived WidgetKit/App Group target, exact reviewed Expo dependency
  locks, a closed privacy-minimized timeline/action contract, encrypted
  capability mapping, fail-generic privacy-sensitive views, and main plus
  extension-target `PrivacyInfo.xcprivacy` declarations for App Group
  UserDefaults reason `1C8F.1`. Ordinary builds omit the target and production
  config rejects its QA-only opt-in.
- IOS-02 now also has an injected, unmounted reconciliation core with strict
  bounded timeline decoding, cross-entry token deduplication,
  resolve-all-before-write validation, canonical idempotent completion, exact
  acknowledgement before synchronous replacement, serialized callers, and
  account-generation invalidation. Its runtime gate requires iOS, an exact
  extension-build boolean, and a non-production environment. Interactive
  publication remains a literal hard `false`.
- A structured performance-evidence template, strict validator, and smoke suite
  now require predeclared thresholds, supported physical-device/build proof,
  repeated raw supported-iPhone measurements including post-capture analysis,
  encrypted-photo load/memory evidence, validator-calculated nearest-rank
  p50/p95/max, and calculated pass/fail instead of trust-only booleans or
  hand-entered summaries.
- The generated QA packet now requires granular physical-device evidence flags
  for install, camera permission recovery, barcode, label capture, progress
  photos, encrypted photo storage, notifications, share sheet, RevenueCat,
  Sentry, Supabase catalog calls, accessibility, and conditional native OCR.
- Widget flags cannot clear the packet by themselves. A separate strict
  schema-v2 lifecycle artifact binds current source HEAD, exact EAS build,
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
- On-device OCR module selection and QA if OCR is a launch claim.
- Physical-device validation and calibration of the post-capture face/pose and
  lighting heuristics, including diverse presentation/lighting conditions,
  analyzer failure, no network/template retention, and encrypted-save failure.
- Real-time preview face/lighting guidance remains unimplemented; launch copy
  must describe the implemented post-capture check unless a separately tested
  frame-processing pipeline replaces it.
- RevenueCat Test Store/sandbox native smoke.
- Sentry native crash/source-map smoke.
- Notification timing matrix on supported iPhones and iOS versions.
- Native WidgetKit/ActivityKit host registration and lifecycle integration.
  The tested pure controller is not mounted and cannot by itself make the
  extension and app processes atomic. A native append-only App Group action
  outbox or equivalent native compare-and-swap protocol must precede
  interactive publication. An unconditional deletion/redaction lane must prune
  corrupt or historical App Group bytes on expiry, withdrawal, sign-out, and
  account transition. Stock `expo-widgets` uses `staleDate: nil`, so production
  Live Activity start stays prohibited until a deterministic killed-app
  stale/end path replaces it and is proven.
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
