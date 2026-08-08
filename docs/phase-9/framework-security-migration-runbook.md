# Framework Security Migration Runbook

## Purpose and Current Boundary

This runbook governs remediation of dependency advisories rooted in the Expo
and React Native framework stack. It is not a license to suppress an audit or
to replace the current stack with the version proposed by an automated fixer.

As of the dependency inventory generated on 2026-08-08, compatible patch-level
maintenance reduced the registry audit from 20 to 15 high findings and left no
critical finding. The remaining high findings have an `npm audit` remediation
that would downgrade the app from Expo SDK 56 / React Native 0.85 to an older,
unsupported Expo SDK 53 / React Native 0.72 chain. That is not a security fix
for this product and must not be applied.

Do not run any of the following as a release remediation:

- `npm audit fix`
- `npm audit fix --force`
- `npm install` of the audit-suggested Expo 53 or React Native 0.72 packages
- an override that changes React Native, Expo, or a reviewed native package
  outside its supported SDK mapping

## Supported Direction

Expo documents that SDK 56 maps to React Native 0.85 and SDK 57 maps to React
Native 0.86. Its upgrade guide requires SDK upgrades one release at a time,
then dependency alignment with `expo install --fix`, `expo-doctor`, and the
target SDK release notes. The first framework remediation target is therefore
SDK 56 to stable SDK 57, never a downgrade or an Expo prerelease.

Primary sources:

- [Expo SDK version mapping](https://docs.expo.dev/versions/latest/)
- [Expo SDK upgrade guide](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/)
- [Expo native-project upgrade helper](https://docs.expo.dev/bare/upgrade/)
- [Expo EAS build infrastructure](https://docs.expo.dev/build-reference/infrastructure/)

The launch device floor remains iOS 17.0+ as defined in
[`docs/DEVICE_SUPPORT_POLICY.md`](../DEVICE_SUPPORT_POLICY.md). Do not lower it
because Expo SDK 57 supports older iOS versions.

## Pre-Migration Admission

Before modifying framework versions, create a governed migration branch from a
clean main commit and retain these inputs:

1. The generated registry-backed dependency inventory for that exact source
   commit.
2. The complete `npm audit --omit=dev --json` artifact, including the advisory
   URLs and dependency paths.
3. Current passing outputs for `npm run typecheck`, `npm run lint`, `npm test`,
   `npm run postinstall:check`, `npm run phase5:ios-extension-contract:smoke`,
   and `npm run phase9:view-shot-privacy:check`.
4. The exact source and patched hashes for both reviewed native dependencies:
   `expo-widgets` and `react-native-view-shot`.
5. The current EAS image, Xcode, build-number, and runtime-version policy from
   [`docs/phase-5/native-build-runbook.md`](../phase-5/native-build-runbook.md).

Do not treat a JavaScript-only test run as permission to change a native
dependency. `runtimeVersion.policy=fingerprint` means this migration requires a
new native binary and cannot ship as an OTA-only update.

## SDK 56 to 57 Procedure

1. Read the SDK 57 release notes and the 56-to-57 native upgrade-helper diff.
   Record every affected native config, plugin, entitlement, privacy manifest,
   deployment target, and build-image change before editing code.
2. Update `expo` to stable SDK 57, then run the Expo-recommended dependency
   alignment command and `expo-doctor`. Resolve every mismatch from the
   supported SDK 57 package set; do not use `--force`, legacy peer dependency
   mode, or an unsupported React Native version.
3. Reconcile generated or managed native projects according to the official
   upgrade helper. Preserve the iOS-only launch contract, App Group boundary,
   required-reason API declarations, and privacy manifests. Diff the result
   against the exact SDK 56 source and retain the reviewable patch.
4. Re-evaluate every native dependency that crosses the framework boundary,
   including RevenueCat, Sentry, Google Sign-In, ML Kit, Reanimated, Screens,
   View Shot, Worklets, and the widget implementation. Confirm its target
   version is supported by the selected Expo SDK and React Native version.
5. Rebuild both exact-native patch contracts as described below. A package
   version range, a lockfile rewrite, or a passing JavaScript test cannot stand
   in for this review.
6. Run all source checks in the Pre-Migration Admission list plus the Expo
   compatibility and doctor checks. Regenerate the dependency SBOM with a live
   registry audit and do not sign it off while high or critical advisories
   remain.

## Native Patch Re-Review

`expo-widgets` is currently an exact reviewed package, not a normal semver
range. A new SDK version may move it, alter its iOS files, or relocate its
installation path. For each target package release:

1. Fetch the exact registry artifact and record its version, resolved URL,
   integrity, license, and original source hashes.
2. Diff each reviewed native input against the currently patched source.
   Reapply only the minimal required OnSkin lifecycle and privacy changes.
3. Replace every expected original and patched hash in the patcher and its
   tests. Preserve fail-closed rejection of changed version, lockfile URL,
   integrity, duplicate installation, symlink, or source bytes.
4. Re-run `npm run postinstall:check`,
   `npm run phase5:expo-widgets-lifecycle:test`,
   `npm run phase5:ios-extension-contract:smoke`, and
   `npm run phase9:view-shot-privacy:test`.
5. Require a fresh macOS/Xcode archive and physical-iPhone evidence before
   enabling or marketing widget and Live Activity behavior.

## Required Evidence Before Release Use

An SDK migration is complete for release purposes only when all of the
following bind to the same source commit and native build:

- Expo compatibility and doctor reports contain no unresolved mismatch.
- The registry-backed audit has zero unapproved high or critical findings.
- `npm run phase9:dependency-sbom:strict` passes with named release-owner
  review of the exact candidate artifacts.
- The iOS Simulator compile workflow passes for the upgraded lockfile.
- A signed EAS staging archive passes the Phase 5 and Phase 9 archive/privacy
  inspections.
- The required physical-iPhone matrix, accessibility checks, camera/OCR/widget
  lifecycle evidence, and named signoffs are freshly collected for that archive.
- The App Store metadata, privacy answers, export review, and reviewer access
  are rechecked against the upgraded binary before submission.

Until then, the framework advisory set is an open release blocker. Source tests
and a clean installation are useful migration evidence, but they do not prove
App Store acceptance, legal compliance, security clearance, or device runtime
behavior.
