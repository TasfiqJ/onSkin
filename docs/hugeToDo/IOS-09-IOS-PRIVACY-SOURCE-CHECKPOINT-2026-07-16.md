# IOS-09 iOS Privacy Source Checkpoint

Reviewed: 2026-07-16

Status: `in_progress` (`archive_required` installed-source result)

## Decision

The repository now has a fail-closed, deterministic installed-source privacy
gate for the iOS npm dependency graph and an exact-hash repair for one invalid
third-party privacy manifest. This is useful pre-archive evidence, but it does
not close IOS-09 or STORE-04.

The current result proves only that the audited installed npm source set is
internally valid under the pinned Apple baseline and repository mapping. It is
not proof of production-archive contents, App Privacy answers, legal
compliance, App Review acceptance, or revenue. No Apple, legal, or commercial
outcome is guaranteed by this checkpoint.

## Current Apple Requirements Used

The 2026-07-16 review used these official Apple sources:

- [TN3181: Debugging invalid privacy manifest errors](https://developer.apple.com/documentation/technotes/tn3181-debugging-invalid-privacy-manifest)
  for the privacy-manifest structure and invalid-empty-key rule;
- [Describing use of required reason API](https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api)
  for bundle-local required-reason declarations and truthful reason selection;
- [Third-party SDK requirements](https://developer.apple.com/support/third-party-SDK-requirements/)
  for Apple's named SDK manifest and signature scope; and
- [Upcoming submission requirements](https://developer.apple.com/news/upcoming-requirements/?id=02032026a)
  for the requirement, effective 2026-04-28, that uploads use Xcode 26 or later
  and the iOS 26 SDK or later.

The Apple facts are pinned in
`docs/phase-9/apple-ios-privacy-baseline.json`. Repository package-to-SDK
relationships remain explicitly labeled as source inferences in
`docs/phase-9/ios-sdk-package-mapping.json`; they are not represented as Apple
statements or archive observations.

## `react-native-view-shot` Manifest Repair

Installed `react-native-view-shot` 5.1.0 supplied
`ios/PrivacyInfo.xcprivacy` with an empty `NSPrivacyAccessedAPITypes` array.
Apple's TN3181 guidance treats that form as invalid and says an unused key
should be removed. The 2026-07-16 upstream review found that the latest
published 5.1.1 package still contained the same invalid form, so upgrading
alone did not fix the release risk.

The repository repair is deliberately narrow:

- reviewed original SHA-256:
  `74b0cd72fc23c1ef302f22ee2753f61817cdc5af0ff7a7f2d0632b524fb8acea`;
- accepted repaired SHA-256:
  `7a411ba0c8b0c43834b84b23b3959aa98df450c52db9e0a4efb4ba1b2786f0c9`;
- the patch removes only the invalid empty key and accepts only the exact
  reviewed package identity, lock binding, original bytes, or already-repaired
  bytes; version, integrity, path, symlink, or content drift fails closed;
- root `postinstall` performs the deterministic repair after dependency
  installation; and
- the mobile `eas-build-post-install` hook runs the read-only exact-hash check
  after EAS install/prebuild/Pods lifecycle work so a missing or overwritten
  repair stops the build.

The repair validates installed source. The final archive must still prove that
the intended manifest was copied into the correct bundle and that no build
step, Pod resolution, or binary packaging changed the effective result.

## Deterministic Installed-Source Result

`npm run phase9:ios-privacy-source-audit:check` records this result:

| Measure                                                 |             Result |
| ------------------------------------------------------- | -----------------: |
| Overall status                                          | `archive_required` |
| Native npm packages                                     |                 63 |
| Privacy manifests                                       |                 14 |
| Source-valid manifests                                  |                 14 |
| Source-invalid manifests                                |                  0 |
| Manifest source bindings requiring archive verification |                 14 |
| Podspecs                                                |                139 |
| XCFramework source candidates                           |                 16 |
| Standalone framework source candidates                  |                  0 |
| Standalone `.a`/`.dylib` source candidates              |                  0 |
| Exact Apple SDK-list intersections                      |                 10 |
| Errors                                                  |                  0 |
| Warnings                                                |                 15 |

All 14 manifest resource bindings remain `archive_required`. A Ruby podspec
token is a source candidate, not evaluated CocoaPods output and not proof that
the resulting bundle or archive contains the file. The ten Apple-list
intersections likewise identify source candidates for GoogleSignIn, Hermes,
and SDWebImage; they do not prove resolved SDK versions, archive inclusion, or
Apple-required signatures.

## Evidence Bindings

The checked result binds these inputs:

- Apple baseline SHA-256:
  `fe04db2c5ce694c4f0269f9056aec49dd528e8421b54079a4fc2b97254c90921`;
- repository mapping SHA-256:
  `4071fc20df9224447ce1a1f978b9441e223a4907e45e41408c04228abddc9f8b`;
- `package-lock.json` SHA-256:
  `55762337b9b049e7efe536a004dbbd855d7f672d8ba1f145fa4bb5b2409770d1`;
- generated JSON report SHA-256:
  `5c8af950830d0ab57cf451295f13e4d24f31e82afc3de0e38608f7bc782f5390`;
  and
- generated Markdown report SHA-256:
  `3ad0c5c619bbe94b6406e21b4f4bdc28a64fae208b09aa42dbbeeda4a0a5e384`.

The machine and human-readable ledgers are
`docs/phase-9/generated/ios-privacy-source-audit.json` and
`docs/phase-9/generated/ios-privacy-source-audit.md`.

## Scope Boundary

The audit covers installed, non-linked npm registry native candidates found by
reviewed root signals, explicit mappings, or malformed installed metadata in
the current lockfile. It validates package identity/integrity, bounded native
source discovery, strict privacy-manifest semantics, podspec source tokens,
candidate native artifact names, and the pinned Apple-list intersections. It
does not claim to scan every installed JavaScript-only registry package.

It excludes first-party app and extension source, linked workspaces, generated
Expo prebuild output, evaluated CocoaPods resolution, Swift Package Manager
resolution, and the release archive. First-party sources have separate config
and extension validators. Generated native output and the immutable production
archive remain separate IOS-09 release gates.

Accordingly:

- `source_valid` is not archive inclusion or a merged privacy report;
- source SDK matches are not signature validation;
- source manifests do not establish observed network or storage behavior;
- this report cannot determine App Privacy labels, linkage, tracking, sharing,
  retention, or legal bases;
- a boolean review flag cannot substitute for exact evidence; and
- this checkpoint is not legal advice, Apple approval, App Review acceptance,
  or revenue proof.

## Exact Remaining Archive And Release Evidence

IOS-09 and STORE-04 remain `in_progress` until the frozen release candidate has
all of the following, cross-bound to one immutable source revision and build:

1. the exact production `.xcarchive` and its build identity and cryptographic
   hash;
2. the exact resolved `Podfile.lock` and any applicable SPM resolution record;
3. the archive's merged privacy report plus a complete per-bundle privacy
   manifest ledger;
4. an exact required-reason API usage/declaration report for every executable
   and dynamic library;
5. resolved third-party SDK identities and Apple-required signature evidence;
6. entitlements, signing identities, provisioning, symbols/dSYMs, binary
   metadata, and every App Store processing warning or error;
7. observed release-candidate network traffic and local/remote storage,
   reconciled field-by-field to App Privacy categories, purposes, linkage,
   tracking, sharing, and retention answers; and
8. named privacy/legal and supported physical-device signoffs tied to the
   exact evidence and final policy/privacy-choice URLs.

Only the exact archive and observed runtime evidence can close the binary side
of IOS-09. Only the reconciled final data-flow record, published URLs, and
qualified review can close STORE-04. Apple alone controls App Review.
