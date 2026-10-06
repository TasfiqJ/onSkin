# iOS Privacy Source Audit

Status: `archive_required`

This is a deterministic installed-source and package-lock audit. It does not prove
release-archive inclusion, binary signatures, a merged privacy report, App Store
privacy labels, legal clearance, App Review acceptance, or commercial outcomes.

Scope is limited to installed non-linked npm registry native candidates discovered
from reviewed root signals, mappings, or malformed metadata. First-party
app/extension sources, linked workspaces, generated prebuild, CocoaPods/SPM
resolution, and the release archive require separate verification.

## Input bindings

- Baseline: `docs/phase-9/apple-ios-privacy-baseline.json` - `fe04db2c5ce694c4f0269f9056aec49dd528e8421b54079a4fc2b97254c90921`
- Mapping: `docs/phase-9/ios-sdk-package-mapping.json` - `33a2e944d9f7e1b32e20f4e982599ac9b2da02d3b4d940c69c4574182f9feb44`
- Package lock: `package-lock.json` - `a4a89bb99349378db0926a3c257d9e8e0bb6760e7d1a41985d22d5756d8322ad`

## Summary

- Native packages: 63
- Privacy manifests: 15 (15 source-valid; 0 source-invalid)
- Manifest bindings requiring archive verification: 15
- Podspecs: 140
- XCFramework source candidates: 16
- Framework source candidates: 0
- Static-library/dylib source candidates: 0
- Exact Apple-list intersections: 10

## Native package ledger

| Package                                        | Version | Status           | Manifests | Podspecs | XCFrameworks | Frameworks | Binary files |
| ---------------------------------------------- | ------- | ---------------- | --------- | -------- | ------------ | ---------- | ------------ |
| @expo/dom-webview                              | 57.0.1  | archive_required | 0         | 1        | 0            | 0          | 0            |
| @expo/expo-modules-macros-plugin               | 0.6.1   | archive_required | 0         | 0        | 0            | 0          | 0            |
| @expo/log-box                                  | 57.0.4  | archive_required | 0         | 1        | 0            | 0          | 0            |
| @expo/ui                                       | 57.0.22 | archive_required | 0         | 1        | 0            | 0          | 0            |
| @infinitered/react-native-mlkit-core           | 5.0.0   | archive_required | 0         | 1        | 0            | 0          | 0            |
| @infinitered/react-native-mlkit-face-detection | 5.0.0   | archive_required | 0         | 1        | 0            | 0          | 0            |
| @react-native-async-storage/async-storage      | 2.2.0   | archive_required | 1         | 1        | 0            | 0          | 0            |
| @react-native-google-signin/google-signin      | 16.1.2  | archive_required | 0         | 2        | 0            | 0          | 0            |
| @react-native-masked-view/masked-view          | 0.3.2   | archive_required | 0         | 1        | 0            | 0          | 0            |
| @sentry/react-native                           | 7.11.0  | archive_required | 0         | 1        | 0            | 0          | 0            |
| @tanstack/query-core                           | 5.101.0 | archive_required | 0         | 0        | 0            | 0          | 0            |
| @tanstack/react-query                          | 5.101.0 | archive_required | 0         | 0        | 0            | 0          | 0            |
| asap                                           | 2.0.6   | archive_required | 0         | 0        | 0            | 0          | 0            |
| cross-fetch                                    | 3.2.0   | archive_required | 0         | 0        | 0            | 0          | 0            |
| expo                                           | 57.0.27 | archive_required | 0         | 1        | 0            | 0          | 0            |
| expo-apple-authentication                      | 57.0.2  | archive_required | 0         | 1        | 0            | 0          | 0            |
| expo-application                               | 57.0.3  | archive_required | 1         | 1        | 0            | 0          | 0            |
| expo-asset                                     | 57.0.19 | archive_required | 0         | 1        | 0            | 0          | 0            |
| expo-camera                                    | 57.0.6  | archive_required | 0         | 2        | 2            | 0          | 0            |
| expo-constants                                 | 57.0.21 | archive_required | 1         | 1        | 0            | 0          | 0            |
| expo-crypto                                    | 57.0.3  | archive_required | 0         | 1        | 0            | 0          | 0            |
| expo-dev-client                                | 57.0.19 | archive_required | 0         | 1        | 0            | 0          | 0            |
| expo-dev-launcher                              | 57.0.20 | archive_required | 0         | 1        | 0            | 0          | 0            |
| expo-dev-menu                                  | 57.0.18 | archive_required | 0         | 1        | 0            | 0          | 0            |
| expo-dev-menu-interface                        | 57.0.0  | archive_required | 0         | 1        | 0            | 0          | 0            |
| expo-device                                    | 57.0.2  | archive_required | 1         | 1        | 0            | 0          | 0            |
| expo-file-system                               | 57.0.7  | archive_required | 1         | 1        | 0            | 0          | 0            |
| expo-font                                      | 57.0.4  | archive_required | 0         | 1        | 0            | 0          | 0            |
| expo-glass-effect                              | 57.0.4  | archive_required | 0         | 1        | 0            | 0          | 0            |
| expo-haptics                                   | 57.0.3  | archive_required | 0         | 1        | 0            | 0          | 0            |
| expo-image                                     | 57.0.5  | archive_required | 0         | 1        | 10           | 0          | 0            |
| expo-image-manipulator                         | 57.0.21 | archive_required | 0         | 1        | 4            | 0          | 0            |
| expo-json-utils                                | 57.0.2  | archive_required | 0         | 1        | 0            | 0          | 0            |
| expo-keep-awake                                | 57.0.2  | archive_required | 0         | 1        | 0            | 0          | 0            |
| expo-linking                                   | 57.0.12 | archive_required | 0         | 1        | 0            | 0          | 0            |
| expo-local-authentication                      | 57.0.3  | archive_required | 0         | 1        | 0            | 0          | 0            |
| expo-localization                              | 57.0.2  | archive_required | 1         | 1        | 0            | 0          | 0            |
| expo-manifests                                 | 57.0.2  | archive_required | 0         | 1        | 0            | 0          | 0            |
| expo-modules-core                              | 57.0.21 | archive_required | 0         | 3        | 0            | 0          | 0            |
| expo-modules-jsi                               | 57.1.1  | archive_required | 0         | 1        | 0            | 0          | 0            |
| expo-network                                   | 57.0.2  | archive_required | 0         | 1        | 0            | 0          | 0            |
| expo-notifications                             | 57.0.22 | archive_required | 1         | 1        | 0            | 0          | 0            |
| expo-router                                    | 57.0.25 | archive_required | 0         | 1        | 0            | 0          | 0            |
| expo-secure-store                              | 57.0.4  | archive_required | 0         | 1        | 0            | 0          | 0            |
| expo-sharing                                   | 57.0.22 | archive_required | 0         | 1        | 0            | 0          | 0            |
| expo-splash-screen                             | 57.0.9  | archive_required | 0         | 1        | 0            | 0          | 0            |
| expo-store-review                              | 57.0.3  | archive_required | 0         | 1        | 0            | 0          | 0            |
| expo-symbols                                   | 57.0.3  | archive_required | 0         | 1        | 0            | 0          | 0            |
| expo-system-ui                                 | 57.0.4  | archive_required | 1         | 1        | 0            | 0          | 0            |
| expo-updates-interface                         | 57.0.2  | archive_required | 0         | 1        | 0            | 0          | 0            |
| expo-web-browser                               | 57.0.3  | archive_required | 0         | 1        | 0            | 0          | 0            |
| expo-widgets                                   | 57.0.9  | archive_required | 0         | 1        | 0            | 0          | 0            |
| nanoid                                         | 3.3.18  | archive_required | 0         | 0        | 0            | 0          | 0            |
| react-freeze                                   | 1.0.4   | archive_required | 0         | 0        | 0            | 0          | 0            |
| react-native                                   | 0.86.3  | archive_required | 6         | 81       | 0            | 0          | 0            |
| react-native-gesture-handler                   | 2.32.0  | archive_required | 0         | 1        | 0            | 0          | 0            |
| react-native-get-random-values                 | 1.11.0  | archive_required | 0         | 1        | 0            | 0          | 0            |
| react-native-purchases                         | 10.4.1  | archive_required | 0         | 1        | 0            | 0          | 0            |
| react-native-reanimated                        | 4.5.1   | archive_required | 0         | 1        | 0            | 0          | 0            |
| react-native-safe-area-context                 | 5.7.0   | archive_required | 0         | 1        | 0            | 0          | 0            |
| react-native-screens                           | 4.26.2  | archive_required | 0         | 1        | 0            | 0          | 0            |
| react-native-view-shot                         | 5.1.0   | archive_required | 1         | 1        | 0            | 0          | 0            |
| react-native-worklets                          | 0.10.1  | archive_required | 0         | 1        | 0            | 0          | 0            |

## Privacy manifest ledger

| Path                                                                             | Status       | SHA-256                                                          |
| -------------------------------------------------------------------------------- | ------------ | ---------------------------------------------------------------- |
| node_modules/@react-native-async-storage/async-storage/ios/PrivacyInfo.xcprivacy | source_valid | 0b1287d0e686cf867d38d97cca5dc694b3029f27c4fe4270dd4bd2fd5458a2f0 |
| node_modules/expo-application/ios/PrivacyInfo.xcprivacy                          | source_valid | b48763ffd29cbad815125ae56e1073273e418ae086103fc7dff7efbec1675aaa |
| node_modules/expo-constants/ios/PrivacyInfo.xcprivacy                            | source_valid | 2b2d8edb71d51c5b1f1ace4cdb28a94baf22fdde9bbf2e2bfc17d187ff7b5f47 |
| node_modules/expo-device/ios/PrivacyInfo.xcprivacy                               | source_valid | d898a8356dc87b7cd2b17921d68a4636d424067b3a75c83b7935fd797719c9cb |
| node_modules/expo-file-system/ios/PrivacyInfo.xcprivacy                          | source_valid | 33b0e074f273f588a64ba5632909c6a8cf1f16db8e4cd84c6978bd222dfd65bd |
| node_modules/expo-localization/ios/PrivacyInfo.xcprivacy                         | source_valid | 2b2d8edb71d51c5b1f1ace4cdb28a94baf22fdde9bbf2e2bfc17d187ff7b5f47 |
| node_modules/expo-notifications/ios/PrivacyInfo.xcprivacy                        | source_valid | 2b2d8edb71d51c5b1f1ace4cdb28a94baf22fdde9bbf2e2bfc17d187ff7b5f47 |
| node_modules/expo-system-ui/ios/PrivacyInfo.xcprivacy                            | source_valid | 2b2d8edb71d51c5b1f1ace4cdb28a94baf22fdde9bbf2e2bfc17d187ff7b5f47 |
| node_modules/react-native-view-shot/ios/PrivacyInfo.xcprivacy                    | source_valid | 7a411ba0c8b0c43834b84b23b3959aa98df450c52db9e0a4efb4ba1b2786f0c9 |
| node_modules/react-native/React/Resources/PrivacyInfo.xcprivacy                  | source_valid | 7c08969e459621a6ecec043ccdb9012651f185811945f75517c623dae2e11627 |
| node_modules/react-native/ReactCommon/cxxreact/PrivacyInfo.xcprivacy             | source_valid | 0587d155c56a6f4f0647ebc6b6a0bd026615cd610ee8f209a9786b79a96ad335 |
| node_modules/react-native/ReactCommon/react/timing/PrivacyInfo.xcprivacy         | source_valid | 23ddfa062a6d4392e65882d151fdececbd29904a227ad8918c0144ebc777ee61 |
| node_modules/react-native/third-party-podspecs/RCT-Folly/PrivacyInfo.xcprivacy   | source_valid | 0587d155c56a6f4f0647ebc6b6a0bd026615cd610ee8f209a9786b79a96ad335 |
| node_modules/react-native/third-party-podspecs/boost/PrivacyInfo.xcprivacy       | source_valid | d3559c988dff940d4f758f37a0ba1863208304e33ab0b97c0e3dd5d3762f5f1d |
| node_modules/react-native/third-party-podspecs/glog/PrivacyInfo.xcprivacy        | source_valid | 0587d155c56a6f4f0647ebc6b6a0bd026615cd610ee8f209a9786b79a96ad335 |

## Exact Apple-list intersections

| Apple SDK    | Package                                   | Match basis                    | Status           | Evidence                                                                                         |
| ------------ | ----------------------------------------- | ------------------------------ | ---------------- | ------------------------------------------------------------------------------------------------ |
| GoogleSignIn | @react-native-google-signin/google-signin | direct_source_candidate        | archive_required | node_modules/@react-native-google-signin/google-signin/RNGoogleSignin.podspec                    |
| GoogleSignIn | @react-native-google-signin/google-signin | source_text_podspec_dependency | archive_required | node_modules/@react-native-google-signin/google-signin/RNGoogleSignin.podspec                    |
| GoogleSignIn | @react-native-google-signin/google-signin | source_text_podspec_dependency | archive_required | node_modules/@react-native-google-signin/google-signin/expo/ios/ExpoAdapterGoogleSignIn.podspec  |
| SDWebImage   | expo-image                                | direct_source_candidate        | archive_required | node_modules/expo-image/ios/ExpoImage.podspec                                                    |
| SDWebImage   | expo-image                                | exact_xcframework_basename     | archive_required | node_modules/expo-image/prebuilds/spm-deps/SDWebImage/debug/SDWebImage.xcframework               |
| SDWebImage   | expo-image                                | exact_xcframework_basename     | archive_required | node_modules/expo-image/prebuilds/spm-deps/SDWebImage/release/SDWebImage.xcframework             |
| SDWebImage   | expo-image                                | source_text_podspec_dependency | archive_required | node_modules/expo-image/ios/ExpoImage.podspec                                                    |
| SDWebImage   | expo-image-manipulator                    | exact_xcframework_basename     | archive_required | node_modules/expo-image-manipulator/prebuilds/spm-deps/SDWebImage/debug/SDWebImage.xcframework   |
| SDWebImage   | expo-image-manipulator                    | exact_xcframework_basename     | archive_required | node_modules/expo-image-manipulator/prebuilds/spm-deps/SDWebImage/release/SDWebImage.xcframework |
| hermes       | react-native                              | source_candidate               | archive_required | node_modules/hermes-compiler/package.json                                                        |

## Errors

- none

## Warnings

- ARCHIVE_REQUIRED: A source-only audit cannot prove release-archive inclusion, binary signatures, merged privacy report, privacy labels, or App Store acceptance.
- MANIFEST_BINDING_ARCHIVE_REQUIRED - node_modules/@react-native-async-storage/async-storage/ios/PrivacyInfo.xcprivacy: No exact podspec or XCFramework source-container binding was proven; archive inspection is required.
- MANIFEST_BINDING_ARCHIVE_REQUIRED - node_modules/expo-application/ios/PrivacyInfo.xcprivacy: No exact podspec or XCFramework source-container binding was proven; archive inspection is required.
- MANIFEST_BINDING_ARCHIVE_REQUIRED - node_modules/expo-constants/ios/PrivacyInfo.xcprivacy: No exact podspec or XCFramework source-container binding was proven; archive inspection is required.
- MANIFEST_BINDING_ARCHIVE_REQUIRED - node_modules/expo-device/ios/PrivacyInfo.xcprivacy: No exact podspec or XCFramework source-container binding was proven; archive inspection is required.
- MANIFEST_BINDING_ARCHIVE_REQUIRED - node_modules/expo-file-system/ios/PrivacyInfo.xcprivacy: No exact podspec or XCFramework source-container binding was proven; archive inspection is required.
- MANIFEST_BINDING_ARCHIVE_REQUIRED - node_modules/expo-localization/ios/PrivacyInfo.xcprivacy: No exact podspec or XCFramework source-container binding was proven; archive inspection is required.
- MANIFEST_BINDING_ARCHIVE_REQUIRED - node_modules/expo-notifications/ios/PrivacyInfo.xcprivacy: No exact podspec or XCFramework source-container binding was proven; archive inspection is required.
- MANIFEST_BINDING_ARCHIVE_REQUIRED - node_modules/expo-system-ui/ios/PrivacyInfo.xcprivacy: No exact podspec or XCFramework source-container binding was proven; archive inspection is required.
- MANIFEST_BINDING_ARCHIVE_REQUIRED - node_modules/react-native-view-shot/ios/PrivacyInfo.xcprivacy: No exact podspec or XCFramework source-container binding was proven; archive inspection is required.
- MANIFEST_BINDING_ARCHIVE_REQUIRED - node_modules/react-native/React/Resources/PrivacyInfo.xcprivacy: No exact podspec or XCFramework source-container binding was proven; archive inspection is required.
- MANIFEST_BINDING_ARCHIVE_REQUIRED - node_modules/react-native/ReactCommon/cxxreact/PrivacyInfo.xcprivacy: No exact podspec or XCFramework source-container binding was proven; archive inspection is required.
- MANIFEST_BINDING_ARCHIVE_REQUIRED - node_modules/react-native/ReactCommon/react/timing/PrivacyInfo.xcprivacy: No exact podspec or XCFramework source-container binding was proven; archive inspection is required.
- MANIFEST_BINDING_ARCHIVE_REQUIRED - node_modules/react-native/third-party-podspecs/RCT-Folly/PrivacyInfo.xcprivacy: No exact podspec or XCFramework source-container binding was proven; archive inspection is required.
- MANIFEST_BINDING_ARCHIVE_REQUIRED - node_modules/react-native/third-party-podspecs/boost/PrivacyInfo.xcprivacy: No exact podspec or XCFramework source-container binding was proven; archive inspection is required.
- MANIFEST_BINDING_ARCHIVE_REQUIRED - node_modules/react-native/third-party-podspecs/glog/PrivacyInfo.xcprivacy: No exact podspec or XCFramework source-container binding was proven; archive inspection is required.
