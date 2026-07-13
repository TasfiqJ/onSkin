# Device Support Policy

Date: 2026-07-12
Status: accepted launch policy

This policy separates the device/runtime contract from stress-only viewport
audits. The app can still be resilient below the floor, but release readiness
does not block on browser-only sizes that are smaller than the supported native
phone envelope.

## Native Install Floor

| Platform | Launch floor     | Repo enforcement                                   |
| -------- | ---------------- | -------------------------------------------------- |
| iPhone   | iOS 17.0+        | `apps/mobile/app.base.json` `ios.deploymentTarget` |
| iPad     | Not supported    | `ios.supportsTablet=false`                         |
| Android  | Not this release | `docs/hugeToDo/launch-contract.json`               |

Build and App Store submission targets still follow current Apple policy. Expo
SDK 56 supports iOS 16.4+ by default; this app intentionally raises the iOS
deployment floor to 17.0. Apple requires current App Store uploads to be built
with Xcode 26 and the iOS 26 SDK or later. Android source configuration may
remain healthy, but it is not release evidence and no Play Console or Android
device claim is required for this launch.

Repo guard:

```bash
npm run docs:device-support-policy-audit:check
```

`npm run launch:verify` also runs this guard and `phase5:check-native-config`
so OS support, build-target posture, and viewport gate classification are
checked together.

References:

- https://docs.expo.dev/versions/latest/
- https://docs.expo.dev/versions/latest/sdk/build-properties/
- https://developer.apple.com/news/upcoming-requirements/

## Layout Support Floor

Launch-blocking native phone QA must cover:

- iOS 17+ physical iPhone, 375 pt width or wider, including at least one latest
  supported iOS build and one oldest-supported iOS 17-class build when hardware
  is available.
- A current flagship-class iPhone for camera, OCR, photos, notifications, safe
  areas, subscriptions, widgets, Live Activities, links, and share-sheet behavior.

Launch-blocking Expo web-compatible responsive QA must cover:

- 375 x 667 compact iPhone-class viewport for every launch-blocking UI flow.
- 390 x 844 and 430 x 932 modern iPhone-class viewports for common density and
  safe-area expectations.
- 360 x 640 and 360 x 740 remain useful resilience viewports, but are not
  release blockers unless the same failure reproduces on a supported iPhone or
  is required by App Review/accessibility.

Do not describe an Expo-web viewport as physical-iPhone evidence.

## Stress-Only Viewports

The following are resilience audits, not the V1 customer support floor:

- 320 x 568, 320 x 480, 320 x 430, 320 x 390, 320 x 370, and 320 x 360 browser
  viewports.
- Browser text-pressure sweeps beyond the supported floor when they cannot be
  tied to a supported physical device, native Dynamic Type setting, keyboard
  state, or store-review requirement.
- Split-screen, freeform, browser chrome, or desktop emulation states that
  reduce usable portrait height below 640 px/dp.
- Sub-360 dp/px width.

Failures below the floor should be recorded and fixed when cheap or when they
protect a critical flow, but they are not launch blockers unless the same issue
reproduces on a supported native device, the 360 x 640 web floor, or an app
review/accessibility requirement.

## Accessibility Rule

The support floor does not weaken accessibility. On supported devices and
supported text settings, visible controls must remain readable, 44 pt/px or
larger where applicable, and center-hit-testable. Lower-priority controls may
move below the first viewport, but visible partial targets are treated as bugs
inside the support floor.

## Revisit Triggers

Revisit this policy when:

- The founder adds Android or iPad to the release contract.
- Closed beta or support evidence shows meaningful demand on unsupported Apple
  device classes.
- Expo, React Native, or Apple raises minimum OS/toolchain requirements.
- The product intentionally adds tablet, foldable, landscape, or split-screen
  launch claims.
