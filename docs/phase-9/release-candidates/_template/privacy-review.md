# Privacy Review

| Data class         | Store label/Data safety | Export                      | Deletion                                    | Third party               | Evidence |
| ------------------ | ----------------------- | --------------------------- | ------------------------------------------- | ------------------------- | -------- |
| Account/profile    | TBD                     | TBD                         | TBD                                         | Supabase                  | TBD      |
| Skin/routine/shelf | TBD                     | TBD                         | TBD                                         | Supabase/PostHog buckets  | TBD      |
| Photos             | TBD                     | TBD                         | TBD                                         | Supabase storage if cloud | TBD      |
| Analytics          | TBD                     | Registry/samples            | PostHog deletion                            | PostHog                   | TBD      |
| Crash diagnostics  | TBD                     | Payload samples             | Retention/deletion reviewed                 | Sentry                    | TBD      |
| Purchases          | TBD                     | Subscription summary/events | RevenueCat deletion, store billing separate | Stores/RevenueCat         | TBD      |

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

- Immutable `.xcarchive` or IPA path and SHA-256: TBD
- App version/build number/bundle identifier/team identifier: TBD
- Xcode version and iOS SDK version: TBD
- Archive `Podfile.lock` or equivalent resolved-native dependency record and SHA-256: TBD
- Archive privacy-manifest ledger and SHA-256: TBD
- Xcode merged privacy report and SHA-256: TBD
- Required-reason API scan/report and SHA-256: TBD
- Framework/XCFramework/static-library/dylib ledger and SHA-256: TBD
- Listed SDK signature verification output and SHA-256: TBD
- Entitlements and code-signing verification output and SHA-256: TBD
- Symbols/dSYM and App Store binary-processing warnings evidence: TBD
- Observed network/storage behavior reconciliation and SHA-256: TBD
- App Privacy answers export/screenshot packet and SHA-256: TBD
- Named privacy reviewer/date/decision: TBD
- Named release owner/date/decision: TBD

`PHASE9_IOS_PRIVACY_REPORT_PASS=true` is reviewer metadata only. It cannot
replace any source artifact above, exact archive inspection, App Privacy
answers, legal review, or App Review.
