# CAT-05 Native OCR Source Checkpoint

- Date: 2026-07-18
- Status: `source candidate / launch-blocked`
- Release scope: iOS 17+
- Runtime exposure: staging internal candidate only

## Decision

The repository now contains an iOS-native ingredient-label recognition source
candidate built on Apple Vision. The EAS `staging` profile enables the candidate
for controlled internal evidence collection. The `development` and
`production` profiles keep `EXPO_PUBLIC_NATIVE_OCR_ENABLED=false`.

This checkpoint does **not** clear CAT-05. It does not prove that the Swift
source compiles, that the module is linked into a signed archive, that any
physical iPhone can run it, that label images or transcripts stay off the
network in the exact build, or that accuracy, latency, cleanup, VoiceOver, or
Dynamic Type meet the declared gates. It is not Apple approval, legal advice,
legal clearance, a product-quality conclusion, or a revenue forecast.

## User And Product Boundary

CAT-05 assists an editable manual ingredient entry. It is not a scanner verdict
and it does not add a product automatically. The user must be able to compare
the transcript with the package, correct it, continue with manual text, retake,
or leave. Vision confidence is treated only as an engine-ranking signal; the UI
must not present it as a calibrated probability or a percent-accuracy claim.

The candidate preserves the primary product positioning: a private skincare
shelf and routine system. OCR is an intake aid, not a diagnosis, safety
assessment, product-quality claim, or recommendation.

## Architecture

1. `expo-camera` captures one user-initiated still image after the camera
   permission and visible camera surface.
2. The label-photo lifecycle moves the temporary camera result to one
   app-managed cache child named
   `catalog-label-photo-temp-<canonical-uuid>.jpg` before recognition.
3. The local Expo module accepts only a canonical request UUID and the managed
   file URI. Native validation requires a regular, readable, non-symlink JPEG
   that is a direct child of the current app cache, then applies byte, dimension,
   pixel-count, decode, observation, candidate, and response-size limits.
4. Apple Vision runs `VNRecognizeTextRequestRevision3` at `.accurate`, enables
   automatic language detection, disables language correction for ingredient
   spelling fidelity, and retains at most two ranked candidates per
   observation. The module declares on-device operation and makes no network
   call.
5. The TypeScript trust boundary rejects unknown keys, wrong request IDs,
   malformed geometry, non-finite confidence, unsafe Unicode/control content,
   oversized output, invalid status/output combinations, and message-only
   timeout claims. Only the stable native timeout code maps to a timeout.
6. The coordinator admits one active request, binds every result to its request
   and attempt, enforces a 12-second application timeout, drains cancellation,
   and ignores stale or late work.
7. Transcript assembly normalizes text to NFC, bounds output on Unicode-scalar
   and UTF-8 boundaries, groups observations by geometry, and selects left-to-
   right or right-to-left row order from strong script letters. Arabic-Indic
   digits alone do not force RTL ordering.
8. The review state uses an edit fence: a late result cannot replace user-edited
   text. A recognized alternative becomes an explicit `Use recognized text`
   action. Ambiguous/review/truncated cues remain visible without color-only or
   percent-accuracy meaning.
9. Back, navigation removal, Retake, and Continue coordinate capture drain, OCR
   cancellation/drain, and idempotent photo deletion before the route action is
   redispatched. Unmount also requests cleanup.
10. App startup runs a bounded scavenger for app-managed label photos and an
    app-boot snapshot of canonical Expo Camera `Caches/Camera/<UUID>.jpg`
    direct children. Both repository shutters - Shelf label capture and
    Progress capture - await the shared startup drain before
    `takePictureAsync`. Snapshot acquisition may therefore retry after a failed
    filesystem read only while both shutters remain gated and before the first
    successful listing. That first successful snapshot is immutable; later
    retries process only its remaining boot names and never relist post-boot
    captures. The label preview sets Expo Image `cachePolicy="none"`.

Relevant source:

- `apps/mobile/modules/native-label-ocr/ios/NativeLabelOcrModule.swift`
- `apps/mobile/src/features/native/ocr/`
- `apps/mobile/src/features/native/camera/labelPhotoLifecycle.ts`
- `apps/mobile/src/features/native/camera/labelPhotoStartup.ts`
- `apps/mobile/src/app/shelf/ocr.tsx`
- `apps/mobile/src/app/shelf/scan.tsx`
- `apps/mobile/src/app/progress/capture.tsx`
- `apps/mobile/eas.json`

## Data And Privacy Inventory

| Data                                   | Source-candidate handling                                                                                                                                              | Off-device recipient                                               |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Label photo                            | Temporary app cache only; deleted on normal exits and covered by bounded startup recovery                                                                              | None designed                                                      |
| Recognized transcript and alternatives | Native/JavaScript memory, editable local handoff into manual ingredient entry                                                                                          | None designed                                                      |
| Confidence and geometry                | Transient local review construction only                                                                                                                               | None designed                                                      |
| Recognition analytics                  | Recognition result enum, coarse latency bucket, `on_device: true`; after explicit Continue, the separate parser event uses source/result/count/native-enabled metadata | None currently; PostHog only after separate approval/configuration |
| Errors and accessibility announcements | Generic status only; no transcript, URI, confidence, ingredient, or raw native error                                                                                   | Existing scrubbed diagnostics boundary only                        |

The current direct mobile analytics transport is disabled. The allowlisted
recognition-completion event is `label_recognition_completed` with only
`{ result, latency_bucket, on_device: true }`. Allowed results are
`recognized`, `no_text`, `timed_out`, `failed`, and `cancelled`; timing is
coarsened into predefined buckets. Photo bytes, paths, request IDs, transcript,
ingredient content, candidates, confidence, exact timing, product identity, and
failure detail are prohibited at that boundary. After the user explicitly
continues, the existing `ingredient_parse_completed` event separately permits
`source: label_capture`, parser result, bounded token count, and whether native
OCR was enabled; it still excludes the transcript and ingredient identities.
Both derived analytics flows require final category/purpose/linkage and
consumer-health review.

Apple says data processed only on device and never sent to a server is not
"collected" for App Privacy answers, while any derived data sent off device must
be considered separately. That supports treating the local image/transcript and
the two minimized derived analytics events as distinct flows. It does not decide the final
App Privacy category, purpose, linkage, tracking, retention, or policy answers;
those must be reconciled against the exact signed binary, third-party SDK
behavior, observed traffic, production configuration, final identity, and
qualified privacy/legal review.

## Security Properties In Source

- The native reader does not accept arbitrary files, remote URLs, nested cache
  paths, symbolic links, non-JPEG media, empty files, or oversized images.
- Native and JavaScript decoders share bounded contract constants and reject
  invalid or extra output rather than attempting permissive recovery.
- Request identity, single-job admission, cancellation, timeout, and stale-
  result checks constrain concurrency and late-result races.
- The editable transcript is bounded to 32 KiB; native observations,
  candidates, candidate bytes, response bytes, file bytes, dimensions, and
  pixels are independently bounded.
- Candidate text is NFC-normalized; unsafe controls, invalid scalars, Unicode
  noncharacters, and unsafe formatting controls are rejected.
- Label contents and file references are excluded from analytics and generic
  screen-reader announcements.
- The preview explicitly opts out of Expo Image caching. Normal and startup
  cleanup source covers both managed files and the pre-managed Expo Camera
  cache window. Both camera shutters await that startup drain. A failed initial
  listing may retry only while every shutter remains gated and before the first
  successful listing; that first successful listing freezes the boot set
  permanently.

These are source controls, not forensic proof. The exact signed build still
needs filesystem/digest inspection of the managed cache, Expo Camera cache, and
Expo Image/SDWebImage cache locations after Continue, Retake, Leave, failure,
and cold relaunch. It also needs a physical-device traffic capture covering the
full test window.

## Accessibility And Recovery

- Running, ready, no-text, timeout, failure, and unavailable states have generic
  announcements that never read the ingredient transcript or confidence.
- iOS status announcements use the queued React Native API so they do not
  intentionally interrupt existing VoiceOver speech; Android uses polite live
  regions where applicable.
- The text field remains editable, labels uncertainty in words, and supplies a
  manual fallback for every result state.
- Retake and Continue remain named actions; camera denial offers permission or
  Settings recovery without removing manual entry.
- The deterministic web runner checks a 44 px proxy, accessible names,
  alert/live-region semantics, clipping, center hit tests, and horizontal
  overflow at 375 x 667, 390 x 844, and 430 x 932.

No local web or unit test proves VoiceOver focus/order, non-stealing native
announcements, the iOS permission sheet, native keyboard behavior, 200% Dynamic
Type, switch control, or real-device touch geometry. Both declared physical
iPhones must pass the accessibility report in the exact-build evidence packet.

## Deterministic Web UI Matrix

The CAT-05 web runner defines five scenarios over three supported iPhone-class
viewports: 15 scenario executions and four consent bootstraps across four fixture
groups.

| Scenario                            | Required deterministic UI behavior                                                                                                                                      |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Recognized review, Retake, Continue | Unicode transcript remains exact; unclear and truncated cues appear; no percent-accuracy claim; Retake returns to capture; Continue hands reviewed text to manual entry |
| Edit fence and suggestion adoption  | Typing during recognition is preserved; late OCR appears as a suggestion; only explicit adoption replaces the edit                                                      |
| No readable text                    | Alert state, Retake, editable Unicode manual text, and manual handoff remain available                                                                                  |
| Timeout                             | Stable timeout alert, Retake, editable Unicode manual text, and manual handoff remain available                                                                         |
| Failure                             | Stable generic failure alert, Retake, editable Unicode manual text, and manual handoff remain available                                                                 |

The runner uses `EXPO_PUBLIC_E2E_SHELF_OCR_RESULT` in a development-only Expo
web process. Its result must record `nativeDeviceProof=false`. It does not load
Vision, the Swift module, a camera, an iOS binary, or a real label image. It
cannot prove native privacy, cleanup, cancellation, process death, accuracy,
latency, accessibility, archive linkage, App Review behavior, or release
readiness. A governed run must be bound to the committed source checkpoint; an
uncommitted or stale fixture run is not evidence.

## Evidence Contract And Predeclared Floor

The schema-v2 native OCR evidence contract intentionally rejects Boolean-only
clearance. A candidate must bind the exact 40-character source commit, runtime
file hashes, EAS build UUID/profile, bundle/build identity, and inspected
archive hash. It requires:

- two distinct physical iPhone models on iOS 17+;
- at least five independently identified labels in each of `clear`, `curved`,
  `tiny`, `multilingual`, and `glare_heavy`;
- at least 25 governed labels and 50 device-label runs at the two-device floor;
- at least two Arabic, Persian, Hebrew, or Urdu multilingual items with explicit
  RTL reading-order review;
- predeclared token recall, insertion-rate, ordered-sequence, latency, and
  12-second timeout thresholds calculated from raw runs;
- exact-source build log and signed-archive inspection;
- physical-device raw run and network capture;
- VoiceOver/Dynamic Type report;
- managed-photo, Expo Camera, Expo Image/SDWebImage cleanup report; and
- corpus provenance/rights report without third-party label photos or OCR text
  committed to Git.

The separate schema-v4 performance evidence must measure
`native_ocr_recognition_ms` against the same source/build. The web UI matrix,
source contracts, and evidence-template validator do not satisfy either
physical-device contract.

## Local Verification At This Checkpoint

| Check                                          | Recorded local result                           | Limit                                                     |
| ---------------------------------------------- | ----------------------------------------------- | --------------------------------------------------------- |
| Mobile TypeScript check                        | Passed                                          | Does not compile Swift or link an iOS archive             |
| Focused native OCR/camera/Shelf/Progress tests | Passed: 14 files / 169 tests                    | Unit/source behavior only, not device behavior            |
| CAT-05 native source plus web-runner contracts | Passed: 39/39                                   | Static/deterministic contract only                        |
| Native evidence contract and smoke suites      | Passed: 38/38                                   | Validates artifact shape, not truth of future attachments |
| Full mobile baseline                           | Passed: 299 files / 3,486 tests                 | Required before the source commit is accepted             |
| Deterministic Expo-web UI run                  | Pending against the committed source checkpoint | Must remain `nativeDeviceProof=false`                     |
| Xcode/Swift/archive build                      | Workflow contract passed 2/2; macOS run pending | Unsigned Simulator compile only; signed archive blocks    |
| Physical-iPhone matrix                         | Not run                                         | Launch-blocking                                           |

## Current Blockers

1. Compile the exact Expo module with the release macOS/Xcode toolchain and
   inspect its generated native project, dependency linkage, privacy manifest,
   entitlements, and signed archive.
2. Install the exact internal staging build on the supported-floor and current
   physical iPhone classes; cover permission, capture, interruption,
   background/foreground, cancellation, process death, and relaunch.
3. Complete the governed 25-label/50-run corpus matrix, including curved, tiny,
   multilingual/RTL, and glare-heavy labels, under rights and ground-truth
   controls.
4. Pass predeclared accuracy, insertion, ordered-sequence, latency, timeout, and
   memory gates without removing failed/no-text/timeout runs.
5. Prove zero label-image/transcript network disclosure and no sensitive logs
   over the full physical-device window.
6. Prove managed, Expo Camera, and Expo Image/SDWebImage cache cleanup by path,
   digest, recognizable signature, cold relaunch, and bounded retry.
7. Complete VoiceOver editing/announcements, 200% Dynamic Type, focus order,
   non-color uncertainty, target geometry, and manual-fallback testing.
8. Reconcile the exact binary and observed behavior with App Privacy, policy,
   retention/deletion, consumer-health, processor, and breach obligations; get
   named qualified privacy/security/legal review.
9. Keep production disabled until every gate above passes. Enabling staging is
   permission to collect evidence only, not permission to submit or market OCR.

## Primary-Source Research

- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/): sections 2.1 and 2.3 require a complete, accurately described submission; section 2.5.14 requires explicit consent and a clear visual and/or audible indication when the camera or other user input is recorded; section 5.1 governs privacy and data handling. These are review inputs, not an approval prediction.
- [Apple App Privacy Details](https://developer.apple.com/app-store/app-privacy-details/): on-device-only processing is not "collected" for the label, but derived data sent off device must be considered separately and answers must remain accurate and current.
- [Apple Vision - Recognizing Text in Images](https://developer.apple.com/documentation/vision/recognizing-text-in-images): Vision documents on-device text processing, accurate/fast paths, multilingual behavior, and revision-dependent language support.
- [Apple `VNRecognizeTextRequest`](https://developer.apple.com/documentation/vision/vnrecognizetextrequest): documents revision 3, recognition level, automatic language detection, language correction, and candidate observations.
- [Expo Camera](https://docs.expo.dev/versions/latest/sdk/camera/): `takePictureAsync` saves a temporary native image in the app cache and returns a local URI.
- [Expo Image](https://docs.expo.dev/versions/latest/sdk/image/): its default cache policy is disk; `cachePolicy="none"` means the image is not cached.
- [React Navigation `usePreventRemove`](https://reactnavigation.org/docs/use-prevent-remove/): covers navigation-state removal such as back, swipe, pop, or reset and permits redispatch after cleanup; it does not cover app exit or every parent-unmount case.
- [React Native `AccessibilityInfo`](https://reactnative.dev/docs/accessibilityinfo): iOS announcements can be queued behind existing speech with `announceForAccessibilityWithOptions(..., { queue: true })`.
- [FTC Health Breach Notification Rule guidance](https://www.ftc.gov/business-guidance/resources/complying-ftcs-health-breach-notification-rule-0): the July 2024 amendments expressly address many health apps and unauthorized disclosures, so scope and incident obligations require counsel review.
- [Washington My Health My Data Act, chapter 19.373 RCW](https://app.leg.wa.gov/RCW/default.aspx?cite=19.373&full=true): uses a broad consumer-health-data definition and includes privacy-policy, consent, sharing, security, rights, and deletion duties; exact applicability remains a legal question.
- [California Civil Code section 1798.140](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1798.140.): personal information collected and analyzed concerning health is sensitive personal information; scope and obligations require counsel review.
- [Office of the Privacy Commissioner of Canada mobile-app guidance](https://www.priv.gc.ca/en/privacy-topics/technology/mobile-and-digital-devices/mobile-apps/gd_app_201210/): emphasizes accountable data-flow mapping, meaningful notice, limiting collection, appropriate safeguards, and retention/deletion discipline.
- [Commission d'acces a l'information du Quebec - Law 25 changes](https://www.cai.gouv.qc.ca/protection-renseignements-personnels/sujets-et-domaines-dinteret/principaux-changements-loi-25): describes privacy-impact assessment and highest-privacy-by-default duties for covered organizations; Quebec applicability and the final assessment require qualified review.

## Release Rule

CAT-05 remains `launch-blocked`. Only a completed, provenance-valid evidence
packet for the exact signed candidate, the separate performance contract,
current full repository checks, and named professional review can support a
later decision to enable production. Even those inputs do not guarantee Apple
acceptance or legal compliance.
