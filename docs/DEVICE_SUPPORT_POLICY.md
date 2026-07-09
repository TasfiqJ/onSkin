# Device Support Policy

Date: 2026-07-09
Status: accepted launch policy

This policy separates the device/runtime contract from stress-only viewport
audits. The app can still be resilient below the floor, but release readiness
does not block on browser-only sizes that are smaller than the supported native
phone envelope.

## Native Install Floor

| Platform | Launch floor         | Repo enforcement                                          |
| -------- | -------------------- | --------------------------------------------------------- |
| iOS      | iOS 17.0+            | `apps/mobile/app.base.json` `ios.deploymentTarget`        |
| Android  | Android 10 / API 29+ | `expo-build-properties` `android.minSdkVersion`; compile/target pinned to API 36 |
| Tablet   | Out of V1 scope      | `ios.supportsTablet=false`; Android tablet QA is deferred |

Build and store submission targets still follow current platform policy. Expo
SDK 56 builds with Android compile/target SDK 36 and supports iOS 16.4+ by
default; this app intentionally raises the iOS deployment floor to 17.0. Apple
requires current App Store uploads to be built with Xcode 26 and the iOS 26 SDK
or later. Google Play target-API policy is separate from `minSdkVersion`; this
app pins compile/target SDK to API 36 while keeping the install floor at Android
10 / API 29. Do not lower target/compile SDKs to widen support.

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
- https://developer.android.com/google/play/requirements/target-sdk
- https://developer.android.com/develop/ui/views/layout/responsive-adaptive-design-with-views

## Layout Support Floor

Launch-blocking native phone QA must cover:

- iOS 17+ physical iPhone, 375 pt width or wider, including at least one latest
  supported iOS build and one oldest-supported iOS 17-class build when hardware
  is available.
- Android 10+ physical Android phone, 360 dp smallest width or wider, with at
  least 640 dp usable height in portrait.
- Current flagship-class iOS and Android devices for camera, photos,
  notifications, safe areas, billing, and share-sheet behavior.

Launch-blocking Expo web-compatible responsive QA must cover:

- 360 x 640 logical viewport for the shortest supported Android phone envelope.
- 360 x 740 Android-class compact phone viewport.
- 375 x 667 compact iPhone-class viewport when text-pressure or safe-area
  changes touch first-run, paywall, shelf, settings, or progress routes.
- 390 x 844 and 430 x 932 modern phone viewports for common iOS/Android
  density and safe-area expectations.

Do not add Android store/device-catalog screen exclusions without Play Console
Reach and devices evidence. The 360 x 640 rule is a V1 QA and support floor, not
a claim that smaller installable Android devices are impossible.

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

- Google Play Console Reach and devices data shows meaningful paid-user demand
  below Android 10/API 29 or below the 360 x 640 layout floor.
- Closed beta or support evidence shows real users on unsupported device classes.
- Expo, React Native, Apple, or Google raises minimum OS/toolchain requirements.
- The product intentionally adds tablet, foldable, landscape, or split-screen
  launch claims.
