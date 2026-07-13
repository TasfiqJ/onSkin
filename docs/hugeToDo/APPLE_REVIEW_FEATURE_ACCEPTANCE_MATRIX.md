# Apple Review Feature Acceptance Matrix

Research date: 2026-07-13

Status: engineering/reviewer preparation; not an Apple approval prediction,
legal opinion, clinical clearance, or substitute for testing the submitted
binary.

Apple alone decides App Review. This matrix turns current published review
requirements into refusal conditions and evidence gates for the exact
iOS-only, iPhone-only, US-only, 20-feature launch contract. Re-check the
[App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
and [submission requirements](https://developer.apple.com/news/upcoming-requirements/)
against the release candidate on the day of submission.

## Global gates for every feature

- The uploaded binary uses Xcode 26+ and the iOS 26 SDK+ under Apple's current
  upload requirement.
- App Store availability uses **Specific Countries or Regions: United States
  only**, does not opt into future countries automatically, and remains closed
  everywhere else until the country gates and founder authorization pass.
  [Apple documents the country/region availability control](https://developer.apple.com/help/app-store-connect/manage-your-apps-availability/manage-availability-for-your-app-on-the-app-store/).
- The binary and store record remain iPhone-only with `supportsTablet=false`.
  iPad support is not claimed. Until separately tested and authorized, opt out
  of compatibility distribution on
  [Apple silicon Macs](https://developer.apple.com/help/app-store-connect/manage-your-apps-availability/manage-availability-of-iphone-and-ipad-apps-on-macs-with-apple-silicon)
  and
  [Apple Vision Pro](https://developer.apple.com/help/app-store-connect/manage-your-apps-availability/manage-availability-of-iphone-and-ipad-apps-on-apple-vision-pro/),
  whose compatible-app availability can otherwise be enabled independently of
  the iPhone build target.
- Every metadata statement, screenshot, review note, price, feature, and
  limitation matches the selected build. No fixture, preview, simulated result,
  fake aggregate, or inert native target is represented as functional.
- The reviewer account does not expire and can reach all gated features with
  live dependencies and supplied sample resources.
- Privacy policy, App Privacy answers, privacy manifests, SDK signatures,
  required-reason APIs, observed network behavior, and in-app consent choices
  agree.
- Account creation includes easy in-app deletion for anonymous and upgraded
  accounts, including local, server, vendor, UGC, and Sign in with Apple token
  handling.
- Google primary login is paired with the qualifying privacy-preserving Apple
  login path required by Guideline 4.8.
- The app remains general wellness/cosmetic guidance: no diagnosis, treatment,
  cure, prevention, lesion assessment, skin age, score, or percentage
  improvement.
- Paid features provide ongoing value, use live localized StoreKit prices, and
  include restore/manage/cancellation/refund handoffs and truthful terms.

## Feature-by-feature matrix

| ID  | Feature                                       | Main Apple review risks                                                                                                     | Required implementation/evidence before submission                                                                                                                                                          | Hard refusal condition                                                                                                                                  |
| --- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Rebrand and identity migration                | Guideline 2.3 accuracy; 5.2 IP/trademark; seller/support inconsistency                                                      | Counsel-cleared final mark; exact seller/domain/support/bundle/App Group/store metadata registry; final icon/splash/share watermark; strict brand audit and physical build inspection                       | Provisional name, uncleared mark, mismatched seller/domain, legacy public identity, or placeholder artwork                                              |
| 2   | Onboarding, age gate, and consent             | 1.4 health safety; 5.1 privacy; 4.8 login; account deletion                                                                 | Truthful age model; separate current consents; decline path; privacy links; anonymous-to-Apple/Google same-user tests; in-app deletion/revocation; no pre-consent health collection                         | Quiz/health data collected without valid consent, signup trap, false age assurance, missing Apple login, or deletion dead end                           |
| 3   | Manual/search/barcode/native OCR Shelf intake | 2.1 completeness; 2.5 hardware/API behavior; 5.1 photo/data minimization; content provenance                                | Native camera/OCR target in submitted build; permission denial/retry; local processing disclosure; no captured label/photo leakage; source/provenance UI; physical iPhone tests                             | Web-only/inert OCR, invented scan result, silent upload, permission dead end, or inaccessible reviewer sample                                           |
| 4   | Production catalog                            | 2.1 completeness; 5.2 content/database rights; 1.4 unsafe ingredient claims                                                 | Licensed/approved source register; production import/checksum/rollback; correction path; attribution; freshness/quality metrics; reviewer-visible real products                                             | Fixture/thin fake catalog presented as production, unlicensed content, fabricated ingredients, or no correction path                                    |
| 5   | Reviewed conflict engine                      | 1.4 physical harm/medical accuracy; 2.3 claims honesty                                                                      | Versioned rules/citations; dermatologist and cosmetic-chemist signoff on exact hashes; contested/uncertain language; pregnancy/irritation escalation; no medical outcome claim                              | Unreviewed rules, deterministic medical advice, hidden uncertainty, or unsafe override/default                                                          |
| 6   | Routine builder                               | 1.4 safety; 2.1 functionality; 4.2 durable utility                                                                          | Reviewed placement rules; provenance/explanations; save/reload/offline/account-boundary tests; safe empty/corrupt states                                                                                    | Routine can silently lose/cross accounts, places known conflicts unsafely, or is only demo content                                                      |
| 7   | Today check-off/adherence                     | 4.2 functionality; 1.4 behavior framing; privacy                                                                            | Atomic idempotent completion; offline/reconnect proof; forgiving/non-coercive streak copy; accurate widget/app reconciliation                                                                               | Lost/duplicated completion, guilt/manipulative copy, false streak, or check-off only works in fixture mode                                              |
| 8   | Skin cycling/ramp scheduler                   | 1.4 safety; 2.1 completeness                                                                                                | Reviewed recovery/pause/ramp rules; timezone/DST/relaunch tests; one canonical projection across Plan/Today/Week; failure recovery                                                                          | Unsafe back-to-back actives, contradictory screens, impossible schedule, or failed write shown as success                                               |
| 9   | Private photo progress                        | 5.1 sensitive data; 1.4 medical claims; SDK responsibility                                                                  | Local-only default; encryption/key-loss behavior; no analytics/AI/vendor photo bytes; app/timeline lock; cache/memory cleanup; export/delete disclosure; physical file/cache inspection                     | Undisclosed cloud upload, unencrypted/plaintext residue, cross-account photo, faceprint/score claim, or deletion/export deception                       |
| 10  | Reminders                                     | 4.5 notification rules; 5.1 lock-screen privacy; user control                                                               | Soft ask before OS permission; utility/behavioral/promotional controls; frequency caps; generic lock-screen copy; timezone/DST/device delivery proof                                                        | Promotional notifications without consent, sensitive lock-screen detail, spam cadence, or nonfunctional controls                                        |
| 11  | RevenueCat paywall/entitlements               | 3.1.1/3.1.2 IAP/subscriptions; 2.3 live price accuracy                                                                      | One subscription group; Ready-to-Submit monthly/annual products; live StoreKit price; review screenshot; restore/manage; atomic webhook and account identity reconciliation; sandbox lifecycle matrix       | Fake/unavailable product, hardcoded price, missing restore, paid digital access outside IAP, or entitlement mismatch                                    |
| 12  | Reverse trial                                 | 2.3 offer honesty; 3.1.2 subscription clarity; 5.1 account state                                                            | Clearly app-granted/no-card; one-time atomic grant; server authority; expiry/reinstall/account-switch/deletion proof; never described as Apple's free trial                                                 | Local env flag or fake store product grants access, repeatable abuse, card/store implication, or silent conversion claim                                |
| 13  | Recommendations                               | 1.4 claim safety; 3.2 commerce integrity; 5.1 profiling/consent                                                             | Reviewed eligibility/exclusions; explainability; separate preference consent; commission-independent ranking; paid-link disclosure; no health data to ad/affiliate systems                                  | Commission changes safety ranking, unreviewed treatment claim, undisclosed paid link, or sensitive behavioral advertising                               |
| 14  | Ask advisor production cloud path             | 1.4 safety; 2.1 real service; 5.1 disclosure/minimization; AI transparency                                                  | Authenticated server gateway; approved provider/DPA/region/retention; explicit AI/cloud disclosure and consent; retrieval-only reviewed corpus; refusal/escalation; eval/red-team/latency/outage/cost proof | Client API key, provider training/retention conflict, diagnosis/treatment response, fake cloud answer, no crisis/refusal path, or unstated AI           |
| 15  | Shareable reviewed conflict cards             | 2.3 accuracy; 5.2 content rights; 1.2 public/UGC handling where applicable                                                  | Share only reviewed deterministic finding; safe copy/citation/version; user confirmation; no photo/health profile; revocable/expiring links where public; abuse/contact path                                | Fabricated conflict, personal health/photo leakage, misleading medical graphic, broken link, or unlicensed artwork                                      |
| 16  | Commerce/replenishment                        | 3.1 distinction between physical goods/affiliate links and digital features; 2.3 price/availability; endorsement disclosure | Approved provider; allowlisted HTTPS links; near-link paid disclosure; no commission-driven ranking; attribution consent; return/support handoff; live price/stock caveat                                   | External purchase unlocks digital Pro, hidden affiliate relationship, unsafe merchant URL, invented availability/price, or health-data ad targeting     |
| 17  | Community and Skin Notes                      | Guideline 1.2 UGC/creator content; 1.4 health claims; 5.1 privacy                                                           | Real filtering, report, block, contact, removal, appeal, audit, copyright/takedown, crisis and law-enforcement flows; staffed SLA; age/country model; expert-note review                                    | Posting without all 1.2 controls and real operators, invented peer aggregate, unsafe treatment advice, or inaccessible support contact                  |
| 18  | Trend insights                                | 1.4 medical/inaccurate measurement; 5.1 photo consent; 2.3 result honesty                                                   | Validated, bounded engine; separate default-off consent; no score/age/percentage; image-quality/insufficient-data refusal; cohort/fairness/skin-tone validation; professional signoff                       | Simulated/random trend, visual disease inference, unvalidated change claim, silent legacy enrollment, or percent/score marketing                        |
| 19  | Widgets and Live Activities                   | 2.1 native completeness; WidgetKit platform rules; 5.1 always-visible privacy                                               | Real extension targets; App Group allowlist; locked-state redaction; no photos/health answers in shared container; deterministic stale/end/deep-link/check-off behavior; physical iPhone matrix             | Inert preview, extension absent from binary, sensitive lock-screen content, unsafe shared storage, or paid widget claim without working target          |
| 20  | Admin/operator review tooling                 | 1.2 moderation effectiveness; 5.1 access/security; 2.1 reviewer completeness                                                | Separate authenticated admin surface; least privilege/MFA; immutable privacy-safe audit; moderation/appeal/support queues; no health/photo logging; incident/access review                                  | Client-shipped admin secret, ordinary user privilege escalation, unstaffed queues, no audit/appeal, or reviewers cannot exercise required operator flow |

## Store-record gates

Before selecting the build for review, retain:

1. Exact production build ID, source SHA, EAS build ID, Xcode/SDK versions, and
   binary privacy report.
2. A reviewer script for all 20 features, including products/barcodes, accounts,
   subscription sandbox state, community report/block, Ask refusal, widgets,
   deletion, restore, and every unavailable/error branch.
3. Current App Privacy answers derived from observed release traffic, including
   every SDK/vendor.
4. Age-rating answers covering health/medical information, UGC/social,
   user-generated AI interaction, web access, and controls.
5. A DSA trader-status declaration matched to distribution. Apple's
   [DSA trader guidance](https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements/)
   says an app distributed only outside the EU is not acting as a trader on the
   EU App Store; record that US-only/no-EU basis and keep every EU territory
   closed. Reopen the legal and store gate before any EU distribution.
6. A truthful
   [regulated-medical-device declaration](https://developer.apple.com/help/app-store-connect/manage-app-information/declare-regulated-medical-device-status)
   matched to retained US regulatory advice and the exact product behavior.
   Apple requires the declaration for relevant Health & Fitness/Medical apps in
   the US even when the answer is No; engineering cannot self-certify the legal
   classification.
7. Subscription group/product metadata, localized prices, tax category,
   review screenshot, availability, and first-submission attachment.
8. Signed clinical/cosmetic-chemistry, privacy/legal, trademark/IP, and security
   decisions tied to the exact rule/copy/data-flow hashes.

## Rejection-response rule

Do not argue that a checklist proves compliance. Preserve Apple's exact message,
the submitted build/metadata state, reviewer path, timestamps, and supporting
logs; reproduce the issue; fix the smallest underlying behavior or truthful
metadata mismatch; update the relevant evidence; and resubmit only after the
same full path passes. Never enable a fixture or hidden reviewer-only behavior
that is unavailable to ordinary users.
