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
PHASE5_IOS_DEVICE="iPhone model / iOS version" \
PHASE5_ANDROID_DEVICE="Android model / OS version" \
PHASE5_QA_SIGNOFF=true \
PHASE5_SIGNED_OFF_BY="name" \
npm run phase5:qa-packet:strict
```

## Native Runtime Policy

`app.base.json` uses `runtimeVersion.policy=fingerprint` and is consumed by `app.config.js`. Any native dependency, plugin, permission, or app config change must ship through a new native binary, not only OTA.

## Launch Gates

- Barcode scan cannot be marketed until physical iOS and Android scans pass.
- OCR cannot be marketed while `EXPO_PUBLIC_NATIVE_OCR_ENABLED=false`.
- Guided photo capture can be marketed as camera capture only after encrypted save/restart/delete passes on devices.
- Reminders remain "gentle" and inexact; no exact-alarm permission is requested.
- Widgets and Live Activities remain post-launch scope.
