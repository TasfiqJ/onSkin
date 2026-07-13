# Phase 5 Native Build Runbook

Phase 5 moves RoutineKind from Expo preview behavior to installable native
builds. The active launch contract is iOS-only. The product is not beta-ready
until the generated device QA packet has a real iOS build ID, physical-iPhone
details, and named signoff. Android source health remains useful but is neither
required launch evidence nor a public release claim.

The native support floor is defined in `docs/DEVICE_SUPPORT_POLICY.md`: iPhone
on iOS 17.0+, with 375 x 667 as the launch-blocking Expo web-compatible
compact-iPhone layout floor. Builds may target newer SDKs as required by Apple
and Expo, but the minimum install floor must not be lowered without updating
the policy, config guard, and QA matrix together.
Current Android source configuration intentionally pins compile/target SDK to
API 36 while keeping min SDK at API 29. This is maintenance posture only; it
does not add Android to the release contract.

Every iOS profile explicitly uses the Expo `sdk-56` build-image alias. Expo's
current infrastructure maps that alias to Xcode 26.4 and the iOS 26 SDK, which
satisfies Apple's upload floor in force since April 28, 2026. The alias is a
selection rule, not evidence: retain the EAS build-log section that names the
resolved image, Xcode version, and SDK for every candidate. Stop building if
Expo remaps the alias below Apple's then-current floor or if the resolved
toolchain differs from the reviewed configuration.

The Progress review pipeline includes native ML Kit face detection and Expo
image manipulation. Any build created before those dependencies were added is
not valid capture-analysis evidence. Create a fresh binary; do not deliver the
change as an OTA-only update. The repo-owned platform adapter intentionally
keeps Expo web from loading ML Kit, while native autolinking must resolve
`RNMLKitFaceDetection` and `expo-image-manipulator` on both platforms.
Deploy the additive photo-quality provenance migration to staging before any
future server-side photo metadata work. The database must clear old synthetic
quality fields and reject quality/pose values without
`post_capture_measurement` provenance. Current V1 must show device-only photo
storage, expose no backup switch, clear stale enablement, and make no automatic
photo image or metadata request during local save.

## Build Profiles

- `development`: internal dev client, `APP_VARIANT=development`, native camera enabled, native OCR disabled.
- `staging`: internal beta candidate, `APP_VARIANT=staging`, native camera enabled, native OCR disabled until ML Kit/Vision is added and verified.
- `production`: production channel only after brand/legal clearance and store credentials are complete.

All three profiles use the `sdk-56` iOS image alias. Production builds must not
silently fall back to a different profile or toolchain.

## Required Commands

Run locally before EAS:

```bash
npm run phase5:verify
```

Create native builds after EAS credentials are configured:

```bash
cd apps/mobile
eas build --profile development --platform ios
eas build --profile staging --platform ios
```

Android build commands are intentionally omitted while Android is outside the
active release contract.

Generate the evidence packet after installing on devices:

```bash
PHASE5_IOS_BUILD_ID=... \
PHASE5_IOS_DEVICE="iPhone 15 Pro / iOS 26" \
PHASE5_QA_SIGNOFF=true \
PHASE5_DEVICE_QA_PASS=true \
PHASE5_INSTALL_QA_PASS=true \
PHASE5_CAMERA_PERMISSION_QA_PASS=true \
PHASE5_BARCODE_QA_PASS=true \
PHASE5_LABEL_CAPTURE_QA_PASS=true \
PHASE5_PROGRESS_PHOTO_QA_PASS=true \
PHASE5_ENCRYPTED_PHOTO_STORAGE_QA_PASS=true \
PHASE5_NOTIFICATION_QA_PASS=true \
PHASE5_SHARE_SHEET_QA_PASS=true \
PHASE5_REVENUECAT_NATIVE_QA_PASS=true \
PHASE5_SENTRY_NATIVE_QA_PASS=true \
PHASE5_SUPABASE_CATALOG_NATIVE_QA_PASS=true \
PHASE5_ACCESSIBILITY_QA_PASS=true \
PHASE5_SIGNED_OFF_BY="Tas Mohammed" \
npm run phase5:qa-packet:strict
```

Retain the EAS log proving the resolved `sdk-56` image, Xcode 26.4 or later,
and iOS 26 SDK or later alongside the generated packet. Re-check Apple's
current upload requirement immediately before every App Store candidate.

Record the supported-device performance baseline separately. Generate the
blocked schema before testing, set owner-approved p95 thresholds before the
first run, then validate the completed artifact:

```bash
npm run phase5:performance-evidence:template
PHASE5_PERFORMANCE_EVIDENCE_PATH=/path/to/performance-evidence.json \
npm run phase5:performance-evidence:strict
```

See `docs/phase-5/performance-evidence-runbook.md`. A passing device QA packet
does not waive this baseline, and a typed performance signoff cannot override a
calculated threshold failure.

The generated packet must show the source Git SHA and `Git status: clean`.
Treat `Git status: DIRTY` as investigation evidence only, not final native QA
signoff. The packet hashes the native app config, device QA scripts, native
runtime files, RevenueCat integration, shared evidence helpers, human-simulated
E2E rules/tree/manifest, and Phase 5 runbook/checklist/exit docs so reviewers
can tie device results to the exact source, UI evidence contract, and gates
that produced them.

`PHASE5_QA_SIGNOFF` is trimmed and case-normalized, but only `true` passes.
`PHASE5_SIGNED_OFF_BY` must be a real tester/reviewer name; placeholders and
generic tester labels are rejected.
Each granular `PHASE5_*_PASS` flag is also trimmed and case-normalized, but only
`true` passes. `PHASE5_NATIVE_OCR_QA_PASS=true` is required only when native OCR
is enabled in the build; otherwise OCR remains hidden from launch claims.

## Native Runtime Policy

`app.base.json` uses `runtimeVersion.policy=fingerprint` and is consumed by `app.config.js`. Any native dependency, plugin, permission, or app config change must ship through a new native binary, not only OTA.

## Launch Gates

- Barcode scan cannot be marketed until the physical-iPhone scan matrix passes.
- OCR cannot be marketed while `EXPO_PUBLIC_NATIVE_OCR_ENABLED=false`.
- Guided photo capture can be marketed as camera capture only after encrypted save/restart/delete passes on devices.
- Post-capture framing/light guidance cannot be described as calibrated until
  real captured-file analysis passes the one/no/multiple-face, pose, lighting,
  timeout, privacy, performance, and diverse-condition physical-device matrix.
  Do not describe the current camera overlay as real-time face or lighting
  guidance; measurement occurs after capture.
- Reminders remain "gentle" and inexact; no exact-alarm permission is requested.
- Widgets and Live Activities are launch-required; do not build the release
  candidate until real WidgetKit/ActivityKit targets and device evidence exist.

Primary toolchain references:

- https://docs.expo.dev/build-reference/infrastructure/
- https://docs.expo.dev/eas/json/
- https://developer.apple.com/news/?id=ueeok6yw
