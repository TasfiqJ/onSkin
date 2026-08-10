# Phase 5 Device QA Checklist

Record device model, OS version, build profile, build ID, tester, date, pass/fail, and notes for every row.

Use `docs/DEVICE_SUPPORT_POLICY.md` and the active launch contract as the
support floor. V1 release QA is iPhone-only on iOS 17.0+, with 375 x 667 as the
launch-blocking Expo web-compatible compact-iPhone floor. iPad and Android are
outside the release contract. Their source configuration may stay healthy, but
their results cannot replace required physical-iPhone evidence. Smaller browser
stress viewports are not launch blockers unless reproduced on a supported
iPhone or required by App Review or accessibility.

| Surface           | Required Checks                                                                                                                                                                                                             | Status                                                                  |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Install           | Fresh install, update, reinstall, dev/staging side by side                                                                                                                                                                  | Blocked until EAS builds                                                |
| Camera permission | Undetermined/grant, retryable denial/retry, permanent denial/Settings, iOS prompt inactive/foreground re-query, focus/background/interruption, mount-ready failure, fresh-generation retry on all three camera routes       | Shared source candidate; schema-v1 signed-archive/two-iPhone QA blocked |
| Barcode           | EAN-13, UPC-A, UPC-E, EAN-8, invalid checksum, duplicate, glare, low light                                                                                                                                                  | Blocked until physical devices                                          |
| Catalog lookup    | Match, no match, external candidate, offline/error fallback                                                                                                                                                                 | Blocked until Supabase staging + devices                                |
| Shelf freshness   | Exact opened/unopened date keyboard, label-confirmed PAO, printed expiry precedence, relaunch persistence, new-UUID re-add without inherited package expiry, finished archive, explicit replenishment opt-in and delivery   | Local web gate implemented; native/staging QA pending                   |
| Label capture     | Capture real label photo, editable text, low-confidence token visible, mount/capture failure recovery, late-result suppression, managed/Camera/image-cache cleanup, manual floor                                            | CAT-05/CAT-06 source candidate; physical-device artifacts blocked       |
| OCR engine        | Apple Vision revision 3 on clear, curved, tiny, multilingual, and glare-heavy labels; editable/confidence-aware transcript; cancellation, managed-photo/image-cache cleanup, zero-network, VoiceOver, and 200% Dynamic Type | Source candidate; artifact-bound physical-iPhone QA blocked             |
| Progress photos   | Consent before OS prompt; first capture, navigation drain, gate replacement, raw-file cleanup failure/retry, retake, review handoff, timeline/compare, encrypted save failure recovery                                      | CAT-06 source candidate; exact-build physical-device artifact blocked   |
| Photo storage     | Settings/locked Progress show device-only with no backup switch; stale enablement clears; local save sends no photo image/metadata                                                                                          | Local gate implemented; native network inspection pending               |
| Progress app lock | Cold/direct tab, capture, review, and detail entries; app-wide then timeline prompt order; one foreground unlock; background relock; assistive-tech focus                                                                   | Local route gate implemented; native auth QA pending                    |
| Progress storage  | Force encrypted metadata read failure on tab/capture/review/detail; no false empty/missing state or writes; persistent retry; restored-key success; screen reader                                                           | Local web gate implemented; native fault QA pending                     |
| Capture quality   | Real one/no/multiple-face results; analyzer error/timeout; framing/pose; dark/bright/uneven light; threshold/provenance migration; no network/template retention                                                            | Blocked until fresh native builds + physical devices                    |
| Encryption        | Plaintext temp deleted, encrypted file survives restart, key missing handled, delete removes ciphertext                                                                                                                     | Blocked until physical devices                                          |
| Notifications     | Soft ask, OS prompt, AM/PM, capture nudge, quiet hours, denied recovery                                                                                                                                                     | Blocked until physical devices                                          |
| Exact alarm       | Not applicable to the iOS-only release; keep Android exact-alarm permissions absent in source                                                                                                                               | Not applicable                                                          |
| Share             | Conflict card share and photo share open OS sheet; cancel handled                                                                                                                                                           | Blocked until physical devices                                          |
| RevenueCat        | SDK configure, fetch offerings, Test Store purchase, restore user action                                                                                                                                                    | Blocked until RC keys + native build                                    |
| Observability     | Sentry native crash captured, PostHog payload audit clean                                                                                                                                                                   | Blocked until native build                                              |
| Performance       | Predeclared p95 thresholds; repeated raw startup, intake, barcode, native OCR recognition, routine, capture-analysis, encrypted-photo load/memory samples on supported iPhones                                              | Blocked until physical measurements                                     |
| Accessibility     | VoiceOver labels/values/focus order, 200% Dynamic Type, 44-point targets, Reduce Motion, non-color state, and reachable close/capture/retake/save/settings/manual fallback across all three camera routes                   | Source contracts exist; schema-v1 two-iPhone report blocked             |
| Widget archive    | Signed `.appex`; exact app/extension IDs and App Group; extension `PrivacyInfo.xcprivacy`; expected capabilities only; final reviewed dependency versions                                                                   | Target/config source candidate implemented; uncompiled and unsigned     |
| Widget families   | Small, medium, accessory inline, and accessory rectangular rendering; fail-generic/locked-state privacy; final Today deep link from warm, cold, and killed app                                                              | Implemented source candidate; physical-iPhone behavior unverified       |
| Widget actions    | Concurrent/repeated taps; canonical idempotent completion; unknown/stale/expired token; app killed/relaunched; corrupt bytes; expiry, sign-out, account switch, and consent-withdrawal deletion/redaction                   | Native outbox/CAS source candidate implemented; publication flag false  |
| Live Activity     | Start/update/stale/complete/end; killed app, device restart, lock-screen redaction, disablement and consent-withdrawal cleanup                                                                                              | Deterministic lifecycle source candidate implemented; start flag false  |

## CAT-06 Camera Lifecycle Source-Candidate Gate

CAT-06 is `in_progress`, not device-certified. Shelf Scan, Shelf OCR, and
Progress Capture share a foreground/focus, fresh-permission, camera-ready,
keyed-remount, and operation-lease boundary. When the iOS permission prompt
drives AppState to `inactive`, the OS prompt may finish normally, but that
explicit request result is invalidated; the camera stays closed until the
fresh foreground query becomes authoritative. Progress saves dedicated photo
consent before requesting camera access and keeps raw-photo cleanup ownership
outside entitlement, app-lock, storage, and content gates.

The retained CAT-04 and CAT-05 Expo-web packets predate this source and are
stale until regenerated. Their `nativeDeviceProof=false` boundary remains: web
evidence cannot prove a permission sheet, Settings round trip, CameraView,
native callback ordering, interruption, filesystem/cache cleanup, observed
traffic, VoiceOver, or a signed archive.

Source assertions that may be recorded without changing the table rows to
Pass:

- [x] All three camera routes use the shared lifecycle and camera-operation
      leases.
- [x] Preview admission requires current focus/foreground/business gate,
      freshly verified permission, and camera-ready state.
- [x] Permanent denial, permission-query/request failure, Settings-open
      failure, mount failure, capture failure, and fresh-generation retry have
      stable recovery paths.
- [x] Progress route ownership drains shutter/navigation and retains failed
      exact raw-file cleanup for retry outside replacing gates.
- [x] Base and dynamic config require one exact derived camera purpose string
      in both iOS configuration locations and reject drift.
- [x] The schema-v1 validator rejects Boolean-only clearance and binds source,
      build, archive, final plist, devices, scenarios, reports, and signoffs.
- [ ] Accept one clean committed source checkpoint and regenerate the stale
      CAT-04/CAT-05 deterministic web packets against it.
- [ ] Compile and inspect the exact signed staging or production archive.
- [ ] Complete all nine scenario suites for all three routes on both required
      physical iPhones: 54 runs with unique hash-verified proofs.
- [ ] Pass `phase5:camera-lifecycle-evidence:strict` and
      `phase5:qa-packet:strict` against the same source/build/archive.

Follow `docs/phase-5/camera-lifecycle-evidence-runbook.md`. A template with
nulls is a blocked work order, never evidence.

## IOS-02 Source-Candidate Gate

The 2026-07-16 implementation is a **source candidate, not native QA
evidence**. The exact-pinned `expo-widgets` `57.0.8` source overlay now
contains the native App Group SQLite owner/snapshot/outbox lifecycle, POSIX
locking plus immediate transactions, App Intent durable append-before-return,
compare-and-swap reconciliation, a raw parse-independent privacy lane that
durably verifies `privacy-closing-v1` and returns a closed-admission receipt
before its queued purge, and `LayerwellEvening` deterministic
stale/recovery/end paths. The app contains the generation-bound
bridge/coordinator/host and canonical reconciliation ordering.

Customer publication remains closed:

- `ROUTINE_WIDGET_INTERACTIVE_PUBLICATION_ENABLED === false`.
- `phase7Capabilities.nativeWidgets === false`.
- `IOS_WIDGET_EXTENSION_BUILD_ENABLED` defaults to `false`; ordinary builds
  omit `expo-widgets` and the extension privacy-manifest plugin.
- Production config rejects `IOS_WIDGET_EXTENSION_BUILD_ENABLED=true`.
- Ordinary config removes `NSSupportsLiveActivities`; the customer Live
  Activity start path is not available.
- `/routine/widgets` remains the explicit unavailable recovery route on Expo
  web and in ordinary app builds.

These source assertions may be marked complete without changing the table
rows to Pass:

- [x] Four launch-family layouts exist in source:
      `systemSmall`, `systemMedium`, `accessoryInline`, and
      `accessoryRectangular`.
- [x] Opaque owner authority, bounded props, durable native outbox, native CAS
      commit, durable `privacy-closing-v1` pre-close plus closed-admission
      receipt, unconditional queued purge, and deterministic Activity stale/end
      paths exist in source.
- [x] Customer/native publication and Activity advertisement remain
      fail-closed behind non-production exact-boolean build gates and literal
      capability flags.
- [ ] Compile the exact source candidate with the supported Xcode/Swift SDK on
      macOS.
- [ ] Produce and inspect the signed `.xcarchive`, `.app`, and `.appex`
      bound to final identifiers, Team ID, App Group, entitlements, deployment
      target, and extension `PrivacyInfo.xcprivacy`.
- [ ] Execute every scenario below on the oldest-supported and current
      physical-iPhone classes using that exact signed build.

### Required IOS-02 physical-iPhone execution — all open

- [ ] Render `systemSmall`, `systemMedium`, `accessoryInline`, and
      `accessoryRectangular` in current, partial, complete, stale, generic,
      locked, light, and dark states.
- [ ] Open every widget and Live Activity deep link with the app warm, cold,
      killed, signed out, App-Locked, authority-resolving, and post-reboot;
      verify authentication/privacy gates precede Today.
- [ ] Press distinct actions concurrently and repeat the same action before and
      after reload; kill between native append and app reconciliation; prove
      durable retention and exactly-once canonical completion.
- [ ] Invoke unknown, stale-boundary, expired, acknowledged, old-snapshot,
      foreign-owner, and invalid-authority actions; prove zero canonical
      completion and generic/redacted convergence.
- [ ] Inject truncated, malformed, future-schema, oversized, and corrupt
      timeline/outbox/props/bridge/SQLite state; prove no crash or private
      render and prove cleanup succeeds without parsing the bad payload.
- [ ] Inspect all widget/Activity regions while the device and App Lock are
      locked; prove screenshots, VoiceOver, logs, and shared bytes expose no
      product, step, condition, adherence, account, user ID/hash, owner
      generation, or token.
- [ ] Separately exercise health-lease expiry, sign-out, A→B/B→A account
      switches, server-confirmed deletion, health-consent withdrawal, foreign
      state, and unclaimed state; prove durable `privacy-closing-v1` creation
      and a closed-admission receipt precede authority rotation,
      snapshot/outbox and private-registry purge, WidgetKit reload, immediate
      Activity end, no cross-account frame, and safe retry after forced cleanup
      failure. Separately measure ActivityKit dismissal because the receipt
      proves admission closure only.
- [ ] Start/update/stale/complete/end `LayerwellEvening`; kill the app at
      each phase and reboot with active/stale/malformed/completed instances;
      prove deterministic stale time, recovery, generic final content, and no
      duplicate or orphaned Activity.
- [ ] Traverse and activate every exposed control with VoiceOver and audit all
      supported Dynamic Type/accessibility sizes across the four families and
      every Live Activity region; record labels, order, values, hints,
      contrast, clipping, and hidden-text announcements.
- [ ] Re-run the ordinary production/config and Expo-web
      `/routine/widgets` honesty checks after the signed QA build; prove QA
      enablement cannot leak into a customer build.

## Device Matrix

Minimum before beta:

- Current iPhone on current public iOS.
- Oldest-supported iOS 17-class iPhone available to the team.
- A supported compact iPhone at or near the 375 pt width floor.
- A current flagship-class iPhone for camera, progress-photo, notification,
  subscription, WidgetKit, ActivityKit, deep-link, and share-sheet behavior.

iPad and Android testing is optional resilience work until the founder changes
the launch contract. It must be stored separately and cannot block or satisfy
this iOS release gate.

## Evidence Required For Strict Exit

- Generated `docs/phase-5/generated/device-qa-packet.md` with `Git status:
clean`, current source hashes, real EAS build evidence, physical-device
  labels, current human-E2E manifest hashes, and named signoff.
- `PHASE5_IOS_BUILD_ID=<real EAS UUID or expo.dev build URL>`
- `PHASE5_IOS_BUILD_PROFILE=staging|production` for strict release QA. The
  `development` profile remains dev-client-only and cannot satisfy CAT-06.
- `npm run cat05:native-ocr-source-contract:test` passes before the EAS build;
  it proves the reviewed local module inventory and static Apple Vision
  contract, not Swift compilation or physical-device behavior.
- `PHASE5_IOS_DEVICE=<physical iPhone model and iOS version>`
- `PHASE5_QA_SIGNOFF=true`
- `PHASE5_SIGNED_OFF_BY=<real tester/reviewer name>`
- `PHASE5_WIDGET_LIFECYCLE_EVIDENCE_PATH=<repo-relative schema-v3 JSON under docs/phase-5/evidence/widget-lifecycle/>`; it must bind the build-source commit `S`, exact EAS build, final app/extension/App Group/Team IDs, physical iPhone, and named signoff. The gate requires ZIP-magic `.xcarchive.zip`, `.app.zip`, and `.appex.zip` inputs; canonical parsed entitlement and target privacy-manifest reports; four canonical scenario reports; and at least one typed, hash-verified PNG/JPEG/MP4/text proof per scenario. Every report repeats the exact source/build/identity/raw-artifact hashes, device reports repeat the physical-device tuple, and every path and SHA-256 must be unique.
- `PHASE5_NATIVE_OCR_EVIDENCE_PATH=<repo-relative schema-v2 JSON under docs/phase-5/evidence/native-ocr/>` whenever native OCR is enabled. It must bind the EAS source ancestor, exact build/profile/archive, unchanged runtime source hashes including app-boot orphan cleanup, two distinct physical iPhones, at least five labels in every required class (including at least two RTL multilingual labels), every device-label run, reconciled unordered and ordered-sequence accuracy plus latency against predeclared targets, accessibility, managed-photo and Expo Camera/Image/SDWebImage cache cleanup, zero-network, corpus rights/provenance, and seven hash-verified proof attachments. `PHASE5_NATIVE_OCR_QA_PASS` is ignored.
- `PHASE5_CAMERA_LIFECYCLE_EVIDENCE_PATH=<repo-relative schema-v1 JSON under docs/phase-5/evidence/camera-lifecycle/>` is mandatory. It must bind the exact EAS source ancestor, build/profile/signed archive, final resolved `NSCameraUsageDescription`, archive/signing identity, fresh-install receipts, one physical iPhone on iOS 17.x, one reviewed iPhone 17 Pro/Pro Max on iOS 26.5.2, and all 54 non-overlapping two-device route-scenario runs across permission, Settings, AppState/focus, one-preview mount/readiness, camera-operation failure/retry, offline, interruption, accessibility, and privacy/cleanup. Evidence and signoff expire after seven days or a newer public iOS release. Every run has exactly one JSON proof wrapper with the scenario-specific canonical raw-source array, unique digest/reference, accountable-person review, and explicit sensitive-content classification. Canonical realpath containment rejects symlink/junction, ADS, oversized, and raced reads. `PHASE5_CAMERA_PERMISSION_QA_PASS` is ignored.
- Set `PHASE9_RELEASE_CANDIDATE_DIR` to the selected non-template RC and run every strict Phase 5 evidence checker from a clean governed history. `E` must be the single non-merge child of `S`; its diff is exactly the RC ledger plus all ledger entries. Widget, OCR, camera, and performance JSON/attachments must exactly equal their respective role entries and remain byte-identical. Every later commit must be linear and change only centralized exact generated-output paths, including Phase 7 and the final readiness pair. Source/config drift, extra or mutated raw evidence, missing/unledgered artifacts, near-miss paths, merges, and dirty state fail closed.
- `PHASE5_DEVICE_QA_PASS=true`
- `PHASE5_INSTALL_QA_PASS=true`
- `PHASE5_CAMERA_LIFECYCLE_EVIDENCE_PATH=<completed CAT-06 evidence JSON>` plus a passing `npm run phase5:camera-lifecycle-evidence:strict`; follow `docs/phase-5/camera-lifecycle-evidence-runbook.md`. `PHASE5_CAMERA_PERMISSION_QA_PASS` is legacy and ignored.
- `PHASE5_BARCODE_QA_PASS=true`
- `PHASE5_LABEL_CAPTURE_QA_PASS=true`
- `PHASE5_PROGRESS_PHOTO_QA_PASS=true`
- `PHASE5_ENCRYPTED_PHOTO_STORAGE_QA_PASS=true`
- `PHASE5_NOTIFICATION_QA_PASS=true`
- `PHASE5_SHARE_SHEET_QA_PASS=true`
- `PHASE5_REVENUECAT_NATIVE_QA_PASS=true`
- `PHASE5_SENTRY_NATIVE_QA_PASS=true`
- `PHASE5_SUPABASE_CATALOG_NATIVE_QA_PASS=true`
- `PHASE5_ACCESSIBILITY_QA_PASS=true`
- `PHASE5_WIDGET_ARCHIVE_QA_PASS=true`
- `PHASE5_WIDGET_DEVICE_QA_PASS=true`
- `PHASE5_WIDGET_INTERACTION_PRIVACY_QA_PASS=true`
- `PHASE5_LIVE_ACTIVITY_QA_PASS=true`
- `PHASE5_PERFORMANCE_EVIDENCE_PATH=<canonical repo-relative JSON under docs/phase-5/evidence/performance/>` plus a passing
  `npm run phase5:performance-evidence:summarize` and
  `npm run phase5:performance-evidence:strict`; follow
  `docs/phase-5/performance-evidence-runbook.md` and retain every raw sample.
