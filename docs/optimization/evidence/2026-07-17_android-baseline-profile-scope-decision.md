# Android Baseline Profile Scope Decision

Date: 2026-07-17

Branch: `optimization`

Checkpoint parent: `3d01a10d173aba21d9997865b2f0f522a965a863`

Item: `OPT-207`

## Decision

`OPT-207` is `not-applicable` to the active release. Do not add an Android
Macrobenchmark or Baseline Profile harness while the product is iOS-only, the
native Android project would be generated rather than version-owned, and no
Android benchmark owner or CI device strategy exists.

This is the plan's conditional path, not a claim that an unmeasured profile is
effective. Section 13.3 permits the harness only when the Expo/custom-native
build can own it maintainably and explicitly rejects a brittle native test
project without an owner and CI device strategy.

## Authoritative Inputs

- `docs/DECISIONS.md` records the accepted iOS-only, all-features launch and
  makes Android release evidence not applicable.
- `docs/DEVICE_SUPPORT_POLICY.md` lists Android as "Not this release" and says
  no Play Console or Android device claim is required for launch.
- `docs/hugeToDo/launch-contract.json` contains only `ios` in
  `release.platforms` and sets `androidRelease` to `false`.
- `apps/mobile/eas.json` defines only iOS build images and no Android benchmark
  or release profile.
- The repository contains no `apps/mobile/android` native project.
  `apps/mobile/.gitignore` intentionally ignores `/android`, matching Expo
  Continuous Native Generation rather than a version-owned Gradle project.
- The workflow tree has no Macrobenchmark, emulator, managed device, Baseline
  Profile generation, or profile-installation job. The existing Android export
  analysis is platform-neutral artifact health evidence, not a native benchmark
  harness.

## Audit Evidence

```text
Test-Path apps/mobile/android
False

git check-ignore -v apps/mobile/android
apps/mobile/.gitignore:43:/android apps/mobile/android

repository source inventory
No build.gradle, settings.gradle, Macrobenchmark, Baseline Profile, Android
emulator, or managed-device benchmark owner exists. Only generated-native
plugin assets and platform-neutral Expo export analysis are present.
```

No macrobenchmark comparison was run or invented because there is no active
Android release artifact or maintainable harness to compare. Adding Profile
Installer configuration to a transient prebuild directory would not survive a
clean generation and would violate the plan's ownership requirement.

## Reactivation Gate

Reopen `OPT-DEC-008` and `OPT-207` before any Android public release only after
all of the following are recorded in authoritative sources:

1. Android is added to the launch contract and device-support policy.
2. A platform owner accepts regeneration and failure triage.
3. The native integration is committed or reproduced by a tested Expo config
   plugin that survives clean prebuild and package changes.
4. Signed benchmark and non-profile variants use the same production code,
   fixtures, R8 rules, and package identity.
5. CI managed-device and representative physical-device strategies exist.
6. Cold/warm startup and critical-scroll comparisons cover launch, Today,
   Shelf, Progress, and paywall navigation.

Until those conditions hold, shared Android configuration, exports, security
rules, and platform-neutral correctness tests remain healthy-work scope, while
Android-native release performance claims remain out of scope.

## Rollback Trigger

This decision becomes stale immediately if Android enters
`release.platforms`, `androidRelease` becomes true, a committed/reproducible
native benchmark harness appears, or an authoritative owner/device strategy is
approved. In that event, change `OPT-207` back to `investigating` before relying
on Android performance claims.
