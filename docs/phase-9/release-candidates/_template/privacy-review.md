# Privacy Review

| Data class         | Apple App Privacy | Export                      | Deletion                                    | Third party               | Evidence |
| ------------------ | ----------------- | --------------------------- | ------------------------------------------- | ------------------------- | -------- |
| Account/profile    | TBD               | TBD                         | TBD                                         | Supabase                  | TBD      |
| Skin/routine/shelf | TBD               | TBD                         | TBD                                         | Supabase/PostHog buckets  | TBD      |
| Photos             | TBD               | TBD                         | TBD                                         | Supabase storage if cloud | TBD      |
| Analytics          | TBD               | Registry/samples            | PostHog deletion                            | PostHog                   | TBD      |
| Crash diagnostics  | TBD               | Payload samples             | Retention/deletion reviewed                 | Sentry                    | TBD      |
| Purchases          | TBD               | Subscription summary/events | RevenueCat deletion, store billing separate | App Store/RevenueCat      | TBD      |

## iOS source evidence

- Source audit JSON path: `docs/phase-9/generated/ios-privacy-source-audit.json`
- Source audit JSON SHA-256: TBD
- Source audit Markdown path: `docs/phase-9/generated/ios-privacy-source-audit.md`
- Source audit Markdown SHA-256: TBD
- Source audit status (must be `archive_required`, never represented as archive proof): TBD
- Source audit error count (must be `0`): TBD
- Reviewed Apple-baseline SHA-256: TBD
- Package-lock SHA-256: TBD
- Reviewer/date: TBD

## Exact iOS archive evidence

- Completed archive-evidence contract path and SHA-256: TBD
- Immutable `.xcarchive.zip` or IPA regular-file path, bounded ZIP structural,
  CRC/DEFLATE, safe-path/collision, single-app-layout, property-list identity,
  and structured provisioning-profile field matching, byte size, and SHA-256:
  TBD
- App version/build number/bundle identifier/team identifier: TBD
- EAS build ID, exact EAS Git commit, EAS CLI version, and retained build-log
  SHA-256: TBD
- Resolved full EAS image name, Xcode version/build, iOS SDK, Node, and
  CocoaPods, macOS, and Fastlane versions: TBD
- Archive `Podfile.lock` or equivalent resolved-native dependency record and SHA-256: TBD
- Archive privacy-manifest ledger and SHA-256: TBD
- Xcode-generated aggregate privacy report PDF and SHA-256: TBD
- Required-reason API scan/report and SHA-256: TBD
- Framework/XCFramework/static-library/dylib ledger and SHA-256: TBD
- Listed SDK signature verification output and SHA-256: TBD
- Entitlements and code-signing verification output and SHA-256: TBD
- Symbols/dSYM and App Store binary-processing warnings evidence: TBD
- Observed network/storage behavior reconciliation and SHA-256: TBD
- App Privacy answers export/screenshot packet and SHA-256: TBD
- Named privacy reviewer/date/decision: TBD
- Named release owner/date/decision: TBD

Start from `ios-archive-privacy-evidence.json`. It is a hash-bound evidence
index, not a machine interpretation of every opaque report. The template is intentionally
invalid: replace every placeholder value, set the four attestations and
`archive.immutable` to `true` only after the exact files are frozen, and retain
distinct named privacy and release-approval metadata plus the underlying review
records. Replace each JSON decision placeholder with exact lowercase `approve`
only after that review has actually occurred. A raw `.xcarchive` is a directory
and is not accepted by the hash-bound contract; export a `.xcarchive.zip` or
use the exact IPA. Raw files under the RC `evidence/` directory are Git-ignored;
retain them in the approved immutable evidence store and mount the exact bytes
at their recorded paths while validating the committed hash index.

Use those same reviewer identities and UTC calendar dates in `signoff.md`: the
JSON privacy review must match the Security/privacy row, and the JSON release
review must match the Release manager row and `PHASE9_SIGNED_OFF_BY`.

Do not substitute a `PrivacyInfo.xcprivacy` file for the aggregate report.
Apple defines [`PrivacyInfo.xcprivacy`](https://developer.apple.com/documentation/bundleresources/privacy-manifest-files)
as an individual app or SDK privacy manifest; Xcode Organizer's
[**Generate Privacy Report**](https://developer.apple.com/videos/play/wwdc2023/10060/?time=200)
action produces the aggregate PDF used to reconcile App Privacy answers.

The EAS build metadata/log must state the same Git commit as the build-source
SHA. `cli.requireCommit=true` prevents an ordinary dirty-index upload. The
recorded EAS commit and exact log hash contribute to the release binding, but a
reviewer must still confirm what each log value means. The manifest must repeat
the same EAS build UUID, iOS version/build, bundle identifier, and production
channel. `store-review-packet.md` must repeat that identity plus the archive,
processing/symbols, and App Privacy answer hashes. The App Store Connect build
ID and processing status still require explicit human reconciliation to that
same build; the index does not machine-interpret them.

The retained EAS metadata/log file must contain the literal build UUID, source
SHA, CLI version, full image name, macOS version, Xcode version/build, iOS SDK,
Node, CocoaPods, and Fastlane values recorded in the JSON. The validator checks
literal presence, not the semantic role of each token. Missing values fail even
when the file hash itself matches; qualified review remains mandatory.

Archive-index success does not cryptographically verify the app code signature,
trust the provisioning-profile CMS signature, or validate
DER-Encoded-Profile. Retain and review the separate entitlements/code-signing
output; do not convert structural profile parsing into an Apple trust claim.

`PHASE9_IOS_PRIVACY_REPORT_PASS=true` is reviewer metadata only. It cannot
replace any source artifact above, exact archive inspection, App Privacy
answers, legal review, or App Review.
