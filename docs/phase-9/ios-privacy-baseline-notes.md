# iOS Privacy Baseline Notes

Reviewed: 2026-07-16

Status: source baseline and repository mapping only; not legal advice, App
Review approval, a release signoff, or proof about the contents of an iOS
archive.

## Apple facts

Apple's current [Upcoming Requirements](https://developer.apple.com/news/upcoming-requirements/)
page says that, since April 28, 2026, App Store Connect uploads must be built
with Xcode 26 or later and use the iOS 26 SDK or later. Apple's
[required-reason API documentation](https://developer.apple.com/documentation/bundleresources/app-privacy-configuration/nsprivacyaccessedapitypes/nsprivacyaccessedapitype)
publishes five categories and the allowed reason IDs captured verbatim in
`apple-ios-privacy-baseline.json`. Apple's
[required-reason overview](https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api)
also says each executable or dynamic library that uses a required-reason API
must report it from the bundle that contains that code, and that a declared
reason must accurately match actual use.

Apple's [Third-party SDK requirements](https://developer.apple.com/support/third-party-SDK-requirements/)
page publishes the 86 case-sensitive names preserved in page order in the
baseline. Apple says any version and SDKs that repackage a listed SDK are in
scope, and requires signatures when listed SDKs are used as binary
dependencies. The baseline deliberately contains no repository aliases.

The two SDK-list digests use UTF-8 names separated by LF and terminated by one
LF. `publishedOrderSha256` hashes Apple page order. `sortedSha256` hashes a
copy sorted by ascending Unicode code point; because Apple's page is
case-insensitively alphabetized, the two canonical orders are intentionally
not identical.

## Repository inferences

`ios-sdk-package-mapping.json` records three source candidates:

- `@react-native-google-signin/google-signin` 16.1.2 has a pinned podspec that
  directly depends on the `GoogleSignIn` Pod.
- `react-native` 0.85.3 carries the pinned Hermes engine podspec and version
  files, and pins `hermes-compiler` 250829098.0.10. The npm compiler package is
  not itself archive-presence evidence.
- `expo-image` 56.0.11 has a pinned podspec that directly depends on
  `SDWebImage` and a source package-manager config that names the same product.

Those are repository-source observations, not Apple facts. The checkout has
no committed `apps/mobile/ios/Podfile.lock`, release archive, merged privacy
report/manifest ledger, or framework/XCFramework ledger. Their hashes are
therefore explicitly `null`, never guessed. Every mapping remains
`archiveRequired: true`; source, npm-integrity, manifest, podspec, and candidate
artifact-name evidence must never be presented as proof that a listed SDK,
privacy manifest, or signature is present in the release archive.

Before release review, inventory the exact immutable `.xcarchive`, hash its
Podfile.lock (or other native-resolution record), every privacy manifest and
merged privacy report, and every framework/XCFramework/static-library/dylib
ledger. Reconcile those archive observations against the current Apple pages
again; a source match cannot close that gate.

## Deterministic installed-source audit

`npm run phase9:ios-privacy-source-audit:check` binds the reviewed Apple
baseline, repository mapping, package lock, installed package identities,
privacy-manifest XML semantics, podspec source tokens, and bounded native
binary candidates into deterministic JSON and Markdown ledgers. Its strict XML
gate runs before `@expo/plist` so parser recovery and duplicate dictionary keys
cannot silently produce a valid result. Apple collected-data types, purposes,
required-reason categories/reasons, and tracking domains are allowlisted.

The audit deliberately returns `archive_required` even when installed source is
valid. Ruby podspec resource assignments are source-reference candidates, not
proof that evaluated CocoaPods output or an App Store archive contains a
manifest. The installed-source scope also excludes linked workspaces,
first-party app/extension sources, generated prebuild output, resolved
CocoaPods/SPM contents, and the release archive; those require their existing
first-party config gates and exact production-archive evidence.
