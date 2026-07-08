# Phase 5 Native Build Runbook

Phase 5 moves OnSkin from Expo preview behavior to installable native builds. The product is not beta-ready until the generated device QA packet has real iOS and Android build IDs, physical-device names, and named signoff.

## Build Profiles

- `development`: internal dev client, `APP_VARIANT=development`, native camera enabled, native OCR disabled.
- `staging`: internal beta candidate, `APP_VARIANT=staging`, native camera enabled, native OCR disabled until ML Kit/Vision is added and verified.
- `production`: production channel only after brand/legal clearance and store credentials are complete.

## Required Commands

Run locally before EAS:

```bash
npm run phase5:verify
```

Create native builds after EAS credentials are configured:

```bash
cd apps/mobile
eas build --profile development --platform ios
eas build --profile development --platform android
eas build --profile staging --platform ios
eas build --profile staging --platform android
```

Generate the evidence packet after installing on devices:

```bash
PHASE5_IOS_BUILD_ID=... \
PHASE5_ANDROID_BUILD_ID=... \
PHASE5_IOS_DEVICE="iPhone 15 Pro / iOS 18.5" \
PHASE5_ANDROID_DEVICE="Pixel 8 / Android 15" \
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

- Barcode scan cannot be marketed until physical iOS and Android scans pass.
- OCR cannot be marketed while `EXPO_PUBLIC_NATIVE_OCR_ENABLED=false`.
- Guided photo capture can be marketed as camera capture only after encrypted save/restart/delete passes on devices.
- Reminders remain "gentle" and inexact; no exact-alarm permission is requested.
- Widgets and Live Activities remain post-launch scope.
