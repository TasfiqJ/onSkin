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

Every iOS profile explicitly uses Expo's full reviewed image name
`macos-tahoe-26.4-xcode-26.4`. Expo's 2026-07-08 infrastructure inventory maps
that image to macOS 26.4.1, Xcode 26.4 build 17E202, Node 22.22.2, CocoaPods
1.16.2, and Fastlane 2.233.1. Xcode 26.4 satisfies Apple's upload floor in
force since April 28, 2026. Expo documents a full image name as a consistent
environment with possible minor updates, not a cryptographic image digest.
Retain the EAS build ID and build-log section that names the resolved image and
tool versions for every candidate. Stop building if the resolved environment
differs from the reviewed configuration or Apple's then-current floor.

The EAS CLI is pinned to the current reviewed `21.0.1`, and
`cli.requireCommit=true` requires committed input before upload. Retain the EAS
build UUID, exact Git commit metadata, CLI version, and full build log; the
archive evidence index requires the EAS Git SHA to equal the build-source SHA.
Production uses local app-version source with `autoIncrement=false`. Manually
advance and review `CATALOG_RELEASE_IOS_BUILD_NUMBER` before freezing the build
commit; dynamic app config embeds that exact value. The finished archive and
App Store record must still be inspected and cross-bound to the same build
number rather than trusting configuration alone.

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

- `development`: internal dev client, `APP_VARIANT=development`, native camera enabled, native OCR disabled by default until an evidence build is intentionally selected.
- `staging`: internal evidence candidate, `APP_VARIANT=staging`, native camera enabled, and native OCR enabled so the Apple Vision candidate can be compiled and subjected to the artifact-bound physical-device gate. This is not a release clearance or device-proof signal.
- `production`: production channel only after brand/legal clearance and store credentials are complete; native OCR remains disabled until its exact artifact-bound evidence gate is complete.

All three profiles use `macos-tahoe-26.4-xcode-26.4` for build/test parity.
Production builds must not silently fall back to a different profile or
toolchain.

## Credential-Free Simulator Compile Gate

`.github/workflows/ios-simulator-compile.yml` runs on pull requests and `main`
pushes only when the mobile app, workspace packages, lockfiles, native patch
inputs, launch config, or the gate itself changes. Manual dispatch remains
available for maintenance diagnosis. Concurrency cancellation and a 50-minute
job timeout bound macOS consumption.

The gate uses the official `macos-26` runner and the reviewed Xcode 26.4
path, installs JavaScript dependencies from `package-lock.json`, generates a
clean staging iOS project from the lockfile-installed Expo SDK 56 template,
installs CocoaPods, verifies `NativeLabelOcr` autolinking, and runs a Release
build for the generic iOS Simulator destination. Code signing is explicitly
disabled. The final check requires one linked Mach-O `.app` Simulator product
without assuming the rolling runner's host architecture. The workflow has
read-only repository permission, does not persist checkout credentials,
references actions by full commit SHA, uses no secrets, uploads no app
artifact, and invokes neither EAS nor App Store submission tooling.

A passing run proves that the generated staging project and its native OCR pod
compiled and linked for an iOS **Simulator** under that resolved runner. It
does not produce or inspect an iPhoneOS archive, exercise Apple Vision with a
camera, validate signing/entitlements, establish physical-device performance
or cleanup evidence, prove App Review acceptance, or clear any legal/release
gate. The artifact-bound physical-iPhone and signed-archive requirements below
remain mandatory. The workflow logs must be retained through GitHub's normal
run retention when used as supporting compile evidence; they are not a
substitute for the governed native evidence packet.

The workflow definition is fail-closed by
`npm run phase5:ios-simulator-compile-workflow:test`, which is also wired into
the ordinary Quality, Phase 5, and launch verification chains. The contract
pins path scope, toolchain, action SHAs, timeout, unsigned Simulator settings,
native-pod linkage checks, Bash 3 compatibility, and the absence of
credentials, archive, artifact-upload, EAS, and submission behavior.

Do not configure this path-filtered workflow itself as an unconditional
required pull-request check: GitHub documents that a workflow skipped by path
filtering can leave a required check pending and block an unrelated pull
request. The ordinary Quality workflow still validates this gate's definition
on every pull request. If governance later requires the native compile result
before matching pull requests merge, review branch protection and replace this
cost-saving trigger design with an always-triggered, fail-closed path dispatcher
before marking the check required. GitHub also limits path-filter evaluation to
the first 300 changed files, so unusually broad pull requests require a manual
dispatch or a deliberately redesigned dispatcher; do not treat a missing run
as a pass.

Primary references: [Expo Continuous Native Generation](https://docs.expo.dev/workflow/continuous-native-generation/),
[Expo local module setup](https://docs.expo.dev/modules/get-started/),
[Expo SDK version/toolchain table](https://docs.expo.dev/versions/latest/),
[GitHub-hosted runners](https://docs.github.com/en/actions/reference/runners/github-hosted-runners),
[GitHub macOS 26 image inventory](https://github.com/actions/runner-images/blob/main/images/macos/macos-26-Readme.md),
[GitHub workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax),
[GitHub workflow-trigger filtering behavior](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow),
[Apple's Xcode command-line tool reference](https://developer.apple.com/documentation/xcode/xcode-command-line-tool-reference),
and [Apple's Simulator/device limitations](https://developer.apple.com/documentation/xcode/running-your-app-on-simulated-or-physical-devices).

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
PHASE5_IOS_BUILD_PROFILE=staging \
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
PHASE5_NATIVE_OCR_EVIDENCE_PATH=docs/phase-5/evidence/native-ocr/<candidate>/evidence.json \
PHASE5_SIGNED_OFF_BY="Tas Mohammed" \
npm run phase5:qa-packet:strict
```

Retain the EAS UUID/Git SHA/log proving CLI 21.0.1, the resolved full image
name, macOS 26.4.1, Xcode 26.4 build 17E202, iOS 26.4 SDK, Node 22.22.2,
CocoaPods 1.16.2, and Fastlane 2.233.1 alongside the generated packet. Re-check
Expo's supported-image inventory, CLI reference, and Apple's current upload
requirement immediately before every App Store candidate.

Official references: [EAS Build infrastructure](https://docs.expo.dev/build-reference/infrastructure/),
[selecting a base image](https://docs.expo.dev/build/eas-json/#selecting-a-base-image),
the [EAS CLI reference](https://docs.expo.dev/eas/cli/),
[build configuration](https://docs.expo.dev/build-reference/build-configuration/),
and the [Expo SDK 56 changelog](https://expo.dev/changelog/sdk-56).

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
Each remaining granular `PHASE5_*_PASS` flag is also trimmed and
case-normalized, but only `true` passes. Native OCR is the exception:
`PHASE5_NATIVE_OCR_QA_PASS` is ignored because it is forgeable. When OCR is
enabled, `PHASE5_NATIVE_OCR_EVIDENCE_PATH` and `PHASE5_IOS_BUILD_PROFILE` must
bind the schema-v2 evidence described in
`docs/phase-5/native-ocr-evidence-runbook.md` to the exact EAS source ancestor,
build/profile/archive, unchanged runtime hashes, physical-device corpus,
calculated metrics, accessibility, managed-photo and Expo
Camera/Image/SDWebImage cache cleanup, zero-network capture, provenance, and
named signoffs. Otherwise OCR remains hidden from launch claims.

## Native Runtime Policy

`app.base.json` uses `runtimeVersion.policy=fingerprint` and is consumed by `app.config.js`. Any native dependency, plugin, permission, or app config change must ship through a new native binary, not only OTA.

## RoutineKind Widget Lifecycle Candidate

IOS-02 patches only the exact lockfile-installed `expo-widgets` 56.0.23 native
sources. Root postinstall applies both reviewed native patches, and
`npm run postinstall:check` plus
`npm run phase5:expo-widgets-lifecycle:test` must pass before any EAS upload.
Do not accept a changed package version, source hash, missing patch file, or
unverified installed output.

The RoutineKind candidate treats the bounded SQLite App Group database as the
sole timeline/action authority. App Group UserDefaults is layout/presentation
storage, not an interaction transaction. The native flow uses rotating
authority-nonce compare-and-swap, persists its outbox before AppIntent returns,
binds actions to opaque owner and snapshot generations, publishes a current and
future-stale entry, and redacts on non-exact reconciliation. Privacy reduction
durably verifies the `privacy-closing-v1` sentinel and returns a synchronous
closed-admission receipt before queued full cleanup leaves a closed authority
tombstone. The mounted app host serializes activation and release with privacy
cleanup. Only the custom RoutineKind Activity path receives the finite
stale/recovery/end policy; this does not change every generic Expo activity.
The closed receipt proves admission denial, not completed ActivityKit dismissal.

The checked-in publication and Live Activity start switches are deliberately
signed `false`. Windows source and model tests do not compile Swift or prove
CocoaPods linkage, App Group/signing entitlements, `.appex` embedding, runtime
locking, ActivityKit recovery, App Review, or legal clearance. First produce
and inspect a reviewed macOS/Xcode archive with the switches disabled. After
the final cleared identity and deep-link allowlist exist, make a separately
audited enabling change, rebuild, cross-bind the exact source/archive/identity,
and execute the Critical physical-iPhone branches in `docs/USER_FLOW_TREE.md`.

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
- Widgets and Live Activities are launch-required; do not call any build a
  release candidate until the exact patched target compiles, the enabled signed
  archive passes inspection, and all required physical-iPhone evidence exists.

Primary toolchain references:

- https://docs.expo.dev/build-reference/infrastructure/
- https://docs.expo.dev/eas/json/
- https://developer.apple.com/news/?id=ueeok6yw
