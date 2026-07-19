# CAT-06 Camera Lifecycle Source Checkpoint

- Date: 2026-07-18
- Status: `in_progress` source candidate / launch-blocked
- Release scope: iPhone on iOS 17+
- Blocking dependencies: `CAT-05` and `H-08`
- Native acceptance artifact: not supplied

## Decision

The three camera routes now share one source lifecycle for permission,
foreground/focus admission, preview generation, camera-ready state, mount
failure, retry, and in-flight native-operation invalidation:

- `/shelf/scan` for barcode frames;
- `/shelf/ocr` for one user-initiated ingredient-label still; and
- `/progress/capture` for one user-initiated Progress still.

This is a source candidate, not CAT-06 completion. No exact signed archive has
been inspected, and no supported physical iPhone has executed the governed
matrix. The current source and deterministic Expo-web fixtures cannot prove the
iOS permission sheet, Settings return, CameraView mounting/interruption,
`takePictureAsync`, native cache behavior, filesystem cleanup, observed network
traffic, VoiceOver, Dynamic Type, or App Review behavior.

The current CAT-04 and CAT-05 deterministic web packets predate these camera
source changes. They remain useful historical UI evidence, but their exact-
source bindings are stale until both packets are regenerated against the
accepted CAT-06 source commit. Neither old nor regenerated web evidence can
replace the signed-archive and two-physical-iPhone gate.

Nothing in this checkpoint predicts or guarantees Apple acceptance, legal
compliance, product-market fit, revenue, or behavior outside the exact source
and future evidence scope.

## Source Boundary

### Shared permission and preview lifecycle

`useCameraAccessLifecycle` is the single camera-admission boundary used by all
three routes. The source candidate:

1. admits permission or camera work only when the native camera is available,
   the route is focused, the app is active, and the route-specific business
   gate is open;
2. treats permission as unverified after background/inactive transitions and
   requires a fresh query before preview remount;
3. lets the OS permission prompt finish normally but invalidates the explicit
   request result when iOS reports `inactive`, keeps the camera closed, and
   makes the later fresh foreground query authoritative;
4. keeps the preview unmounted before verified grant and whenever focus,
   foreground, consent, review, or cleanup gates close;
5. requires `onCameraReady` before a barcode or still-photo operation;
6. surfaces stable permission-query/request, permanent-denial/Settings, mount,
   and capture recovery without displaying native error detail;
7. replaces a failed preview with a fresh keyed camera generation on retry;
   and
8. issues generation-bound camera-operation leases so queued callbacks cannot
   mutate state or navigate after focus, foreground, permission, retry, gate,
   or unmount invalidation.

### Route-specific controls

- **Shelf Scan:** acquires the camera-operation lease before parsing or acting
  on a queued barcode callback. Local checksum/normalization and duplicate
  suppression remain intact; lookup failure keeps Search, label, and manual
  recovery reachable.
- **Shelf OCR:** unmounts the preview while review owns the captured label,
  requires camera-ready before capture, retains manual ingredient entry in
  every permission/mount/capture state, and keeps late-result cleanup behind
  the existing managed-label-photo lifecycle.
- **Progress Capture:** dedicated local-photo consent is saved before the OS
  camera request. A route-level raw-capture owner lives outside entitlement,
  app-lock, photo-storage, and capture-content gates. It blocks route removal
  while a shutter or exact raw-photo cleanup is pending, drains navigation via
  `usePreventRemove`, retains a failed deletion for explicit idempotent retry,
  and transfers ownership to review only at the deliberate handoff. The
  extracted `progressCaptureRouteBoundary.ts` coordinator and its focused unit
  contract keep that ownership independent from replacing React children.

Progress still-photo output is not described as saved merely because
`takePictureAsync` returned. The native cache child remains disposable until
the review route adopts it, encrypted local persistence succeeds, or cleanup
removes it. Gate replacement cannot hide the retained cleanup recovery.

## Camera Purpose String

The base iOS `NSCameraUsageDescription` and the `expo-camera`
`cameraPermission` plugin value now use one exact source template:

```text
Allow $(PRODUCT_NAME) to use the camera to scan product barcodes, capture ingredient labels, and take guided progress photos. Barcode frames are processed on your device; label and progress photos remain local.
```

Dynamic config expands the resolved display name into both generated values.
The legacy camera-purpose environment keys are validation-only compatibility
inputs: they must be blank or byte-for-byte equal to the derived value.
Alternate wording, surrounding whitespace, control characters, unresolved
Xcode/build variables, and malformed display names fail configuration. Every
EAS profile must leave the legacy values unset or blank.

This source equality check is not archive proof. The future evidence packet
must extract the final `Info.plist` from the same signed archive installed for
device QA and prove the exact resolved string, occurrence count, bundle/build
identity, archive digest, and absence of unresolved build variables.

## Artifact-Bound Acceptance Contract

`docs/phase-5/camera-lifecycle-evidence-runbook.md` and the schema-v1
validator replace the legacy camera-permission Boolean. A final artifact must
bind:

- the exact committed source SHA and hashes of the camera/config/privacy inputs;
- the exact staging or production EAS build, resolved release toolchain, build
  log, signed archive, executable, signing identity, and final `Info.plist`;
- two distinct supported physical iPhones: an actual iOS 17.x supported-floor
  class and a current flagship-class phone on the then-current public iOS;
- all three routes and nine governed scenario suites per phone: permission,
  Settings, lifecycle, mount, camera operation, offline, interruption,
  accessibility, and privacy;
- 54 device-route-scenario runs at the two-phone floor, each with a unique
  hash-verified proof;
- canonical build/archive, device, network/privacy, cleanup, accessibility,
  and scenario-index reports; and
- named QA, privacy/security, and accessibility signoffs, with QA and
  privacy/security independently signed.

The contract checks barcode-frame non-retention, label-image/transcript and
Progress-photo non-upload, sensitive-log absence, managed/Expo Camera/image
cache cleanup, Progress raw-file cleanup and retry, offline encrypted local
save, VoiceOver, 200% Dynamic Type, 44-point targets, and source-lineage drift.
`PHASE5_CAMERA_PERMISSION_QA_PASS` is ignored and cannot clear CAT-06.

## Verification Boundary

The source-candidate verification lane includes these commands; the exact
aggregate counts belong in the commit handoff after the integrated tree stops
changing:

```bash
npm --workspace apps/mobile run typecheck
npm --workspace apps/mobile run lint
npm --workspace apps/mobile run test -- \
  src/features/native/camera/useCameraAccessLifecycle.test.ts \
  src/features/shelf/shelfRoutes.test.ts \
  src/features/photos/progressRoutes.test.ts \
  src/features/photos/progressCapturePrivacy.test.ts \
  src/features/photos/progressCaptureRouteBoundary.test.ts \
  src/features/navigation/sheetRouteContracts.test.ts \
  src/lib/appConfig.test.ts
npm run cat05:native-ocr-source-contract:test
npm run phase5:camera-lifecycle-evidence:smoke
npm run phase5:camera-lifecycle-evidence:template:check
npm run phase5:check-native-config
npm run launch:contract:verify
```

These are source, static-contract, and artifact-validator checks. Passing them
does not establish that a future evidence attachment is truthful, that native
code compiles or links, or that the physical-device matrix passes.

## Current Open Gates

1. Accept and commit a green integrated source checkpoint, then regenerate the
   CAT-04 and CAT-05 deterministic web packets against that source. Record them
   only as web UI evidence with `nativeDeviceProof=false`.
2. Compile the exact native candidate with the reviewed release Xcode/SDK
   toolchain and inspect the signed archive plus final purpose string.
3. Install that same candidate on both required physical iPhones and complete
   all 54 governed runs, including the iOS permission-prompt `inactive`
   transition, denial/Settings recovery, interruptions, foreground remount,
   mount/capture failure, offline behavior, gate replacement, and cleanup retry.
4. Attach the hash-verified reports and three named signoffs, then pass
   `phase5:camera-lifecycle-evidence:strict` and
   `phase5:qa-packet:strict` against the same build.
5. Reconcile observed traffic/storage and the extracted archive with App
   Privacy, policy/consumer-health disclosures, data-rights behavior, incident
   handling, and qualified privacy/security/legal review.
6. Keep CAT-06 `in_progress` until the artifact passes. CAT-05 remains an
   upstream dependency, and H-08 remains the unavoidable physical-iPhone gate.

## Primary Sources

- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/): Guideline 2.5.14 requires explicit consent and a clear visual and/or audible indication when recording user activity; Guideline 5.1.1 governs clear privacy disclosure, consent, minimization, permission choices, and data handling. These are review inputs, not an approval prediction.
- [Apple Human Interface Guidelines: Privacy](https://developer.apple.com/design/human-interface-guidelines/privacy): request access in context and explain the purpose clearly and specifically.
- [Apple `NSCameraUsageDescription`](https://developer.apple.com/documentation/bundleresources/information-property-list/nscamerausagedescription): the final app must declare why it accesses the camera.
- [Expo Camera, SDK 56](https://docs.expo.dev/versions/v56.0.0/sdk/camera/): only one preview should be active, an unfocused preview should be unmounted, iOS has an `active` control, `takePictureAsync` must wait for camera-ready, and captured native URIs start in temporary app cache.
- [React Native `AppState`](https://reactnative.dev/docs/appstate): iOS can enter `inactive` during foreground transitions and interruptions such as system permission prompts.

## Release Rule

CAT-06 remains `in_progress` and launch-blocked. Deterministic web UI evidence
must be current and is still not native evidence. Only the exact signed-archive,
two-physical-iPhone artifact plus the remaining privacy/security/legal and
release gates can support a later completion decision; no checklist can
guarantee App Review or commercial success.
