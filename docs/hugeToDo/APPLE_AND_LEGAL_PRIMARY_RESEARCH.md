# Apple And Legal Primary-Source Launch Research

Research date: 2026-07-26
Status: Working compliance matrix; not legal advice or professional clearance

## Decision Boundary

No engineer, checklist, or counsel can guarantee App Store approval or universal
legal compliance. Apple decides review outcomes, laws depend on launch country,
business facts, data flows, claims, users, and contracts, and qualified counsel
must make the retained legal decisions. The engineering rule is therefore:

1. use current primary sources to design the strictest reasonable baseline;
2. bind every external decision to exact source/data-flow/copy hashes;
3. fail closed when a review, consent, operator, live-service, or evidence gate
   is missing; and
4. re-check sources immediately before TestFlight external review and App Store
   submission.

The founder must approve launch countries before policies, tax, pricing,
reviewer scope, and store availability can be final.

## Current Apple Baseline

| Area                    | Current primary-source requirement                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Layerwell release gate                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Toolchain               | Since 2026-04-28, App Store Connect uploads must use Xcode 26+ and the iOS 26 SDK+.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | EAS build log and binary inspection must prove the actual toolchain; config text is insufficient.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Review access           | Review needs a working backend, demo account or full demo mode, detailed notes for non-obvious/IAP features, and any needed sample resources.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Non-expiring reviewer account; staging/production dependencies live; exact routes for all 20 features; sample barcode/content where needed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| UGC/community           | Guideline 1.2 requires filtering objectionable material, reporting with timely response, blocking abusive users, and published contact information. Creator content is treated as UGC.                                                                                                                                                                                                                                                                                                                                                                                                                                           | No community launch without posting filter, report, block, contact, removal/appeal path, audit log, and real staffed SLA.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Accounts                | Apps supporting account creation must let every user initiate full account deletion in-app; deactivation alone is insufficient. UGC associated with the account is expected to be deleted unless retention law applies.                                                                                                                                                                                                                                                                                                                                                                                                          | Anonymous accounts included; easy-to-find in-app deletion; local/server/vendor/UGC deletion; retention explanation; completion state and retry.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Sign in with Apple      | Apps using qualifying third-party primary login must provide the equivalent privacy-preserving option described by Guideline 4.8. Use `/auth/revoke` when a valid refresh token, access token, or authorization code is available. TN3194 says the account deletion request must still be fulfilled when none is available; delete app-held account data, direct the user to Apple's manual credential-management steps, and respond to the later credential-revoked notification. New private-relay addresses transition to `private.icloud.com` while legacy `privaterelay.appleid.com` addresses remain supported.            | Apple and Google same-user upgrade matrix; server-held token flow; explicit `APPLE_SIWA_CLIENT_ID` equal to the native bundle identifier for this native flow; automatic `/auth/revoke` attempt when credentials exist; only exact successful provider responses report `revoked`; stable sanitized failure logging and truthful manual-revocation outcome/instruction otherwise; credential-revoked notification handling; no user-ID switch; validators, allowlists, suppression/bounce processors, and routing accept and test both relay domains.                                                                                                                                                                                                                                                                                                     |
| Privacy                 | App Store Connect requires a privacy-policy URL and complete app-level disclosure of app and third-party data practices. Developers remain responsible for SDK behavior.                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Observe real release traffic, reconcile App Privacy answers with data inventory/consents/vendors, publish choices URL, and repeat after every SDK/data-flow change.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Privacy manifests/SDKs  | App and applicable SDK manifests must be valid; required-reason APIs need approved reasons; listed third-party SDKs require manifests/signatures. Invalid manifests can block submission.                                                                                                                                                                                                                                                                                                                                                                                                                                        | Generate Xcode privacy report, inventory SDK versions/signatures/manifests/domains/required-reason APIs, fix every warning, and hash the report to the RC.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Health/medical          | Apple treats health/medical data as especially sensitive and scrutinizes inaccurate health behavior and medical claims. App information may require a regulated-medical-device declaration for relevant categories/ratings/regions.                                                                                                                                                                                                                                                                                                                                                                                              | Keep cosmetic/general-wellness intended use; no diagnosis/treatment/cure/prevention, skin score/age/percentage claims; obtain signed regulatory posture and truthful device declaration.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Subscriptions           | Auto-renewable subscriptions must provide ongoing value, last at least seven days, and be available across the user’s devices. Restore/manage behavior and truthful terms are required. A first subscription is submitted with an app version and needs a review screenshot.                                                                                                                                                                                                                                                                                                                                                     | One group, monthly/annual products, localized live price, restore/manage/refund handoff, lifecycle/webhook reconciliation, review screenshot, ongoing-value inventory, no fake entitlement.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Age rating              | The current questionnaire is mandatory; UGC/social/medical capabilities and controls affect the result, and a EULA minimum above Apple’s calculated rating requires an override. Beginning September 2026, submissions must answer the new social-media-capability question.                                                                                                                                                                                                                                                                                                                                                     | Counsel-approved truthful answers for community, social-media capability, health/medical information, AI interaction, unrestricted web access, controls, and declared 16+ community floor, all matched to the exact submitted build.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Age assurance           | Apple's current Declared Age Range guidance says developers remain responsible for their age restrictions. Apps with obligations in regulated regions must request the system age category, use the returned lower bound for gates, handle availability/decline and declaration method without inferring an exact age, test sandbox child/teen/adult and revocation states, and process `RESCIND_CONSENT` server notifications. Full current regulatory support requires building with Xcode 26.2+ and the iOS 26.2+ SDK. Texas implementation resumed on 2026-06-04; Apple also identifies Utah and Louisiana 2026 obligations. | A first-party iOS source module and Boolean `com.apple.developer.declared-age-range` entitlement now exist, but the adapter is literally `launch_blocked`; the self-entered DOB gate remains a privacy-minimized draft, not territorial compliance. Compile/sign and inspect the exact archive, test every Apple sandbox range/declaration/decline/revocation state, check regulatory eligibility before protected providers mount, bind only the minimum necessary account/device decision without storing DOB, fail closed on required unavailable/declined/ambiguous states, and implement authenticated immediate consent-rescission handling before enabling the adapter. Counsel must decide exact country/state rules, non-iOS/older-iOS fallbacks, PermissionKit, significant changes, thresholds, parental consent, retention, and availability. |
| EU App Store fields     | EU distribution requires a DSA trader-status decision and public identity/contact details for traders.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Founder/counsel decision; identity evidence must match seller, domain, policies, support, and store record.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Widgets/Live Activities | Apple directs developers to redact sensitive always-visible content and use an App Group for shared app/extension data. Live Activities cannot directly access network/location and Guideline 4.5.3 prohibits using them for spam, phishing, or unsolicited messages.                                                                                                                                                                                                                                                                                                                                                            | Locked-state redaction, generic copy, App Group allowlist, no photo/health answers in shared container, deterministic stale/end behavior, explicit spam/phishing/unsolicited-message refusal tests, physical-device QA.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Completeness/honesty    | Apple rejects misleading, unfinished, scam-like, or nonfunctional behavior and holds the developer responsible for integrated SDKs.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Every required feature enabled and production-real in the selected build; no fixture, preview price, fake aggregate, simulated trend, inert target, or inaccessible reviewer path.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

Primary Apple sources:

- [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Upcoming submission requirements](https://developer.apple.com/news/upcoming-requirements/)
- [Offering account deletion in your app](https://developer.apple.com/support/offering-account-deletion-in-your-app)
- [TN3194: account deletion and Sign in with Apple token revocation](https://developer.apple.com/documentation/technotes/tn3194-handling-account-deletions-and-revoking-tokens-for-sign-in-with-apple)
- [Private Email Relay domain update](https://developer.apple.com/news/?id=sus6t6ab)
- [Manage App Privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/)
- [Privacy manifest files](https://developer.apple.com/documentation/bundleresources/privacy-manifest-files)
- [Third-party SDK requirements](https://developer.apple.com/support/third-party-SDK-requirements/)
- [App information, DSA, and regulated-medical-device fields](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information)
- [Current age rating process](https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating)
- [Age rating values and definitions](https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions)
- [September 2026 social-media age-rating requirement](https://developer.apple.com/news/?id=tlur8uvi)
- [June 2026 App Review Guideline updates](https://developer.apple.com/news/?id=a233fmpw)
- [Declared Age Range API](https://developer.apple.com/documentation/declaredagerange/requesting-people-share-their-age-range-with-your-app)
- [Declared Age Range entitlement](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.developer.declared-age-range)
- [Testing age assurance in Sandbox](https://developer.apple.com/documentation/storekit/testing-age-assurance-in-sandbox)
- [Apple age assurance developer Q&A](https://developer.apple.com/support/age-assurance)
- [Texas age-requirements update effective June 4, 2026](https://developer.apple.com/news/?id=sg176nne)
- [Utah and Louisiana age-requirements update](https://developer.apple.com/news/?id=f5zj08ey)
- [Submitting a first subscription](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-in-app-purchase)
- [Subscription review screenshots/API workflow](https://developer.apple.com/documentation/appstoreconnectapi/submitting-subscriptions-and-subscription-groups-for-app-review)
- [WidgetKit privacy and App Group strategy](https://developer.apple.com/documentation/WidgetKit/Developing-a-WidgetKit-strategy)

## Legal Baseline By Jurisdiction

### Canada

Assume PIPEDA applies to Canadian commercial activity unless counsel confirms a
substantially similar provincial law controls a specific transaction. Health,
pregnancy, photos, face/pose signals, Ask questions, and inferred concerns are
sensitive: use express, separate, understandable consent; collect only for
specific legitimate purposes; make non-integral sharing optional; provide
access/correction/deletion/export; limit retention; secure data; and maintain a
breach program. Under PIPEDA, report and notify breaches creating a real risk of
significant harm and keep required breach records.

For Québec users, the private-sector Act requires a privacy impact assessment
for projects acquiring/developing/overhauling systems involving personal
information, express consent for sensitive disclosure, purpose-specific clear
consent presented separately, and an assessment plus contract before transfers
outside Québec. Section 4.1 also prohibits collecting personal information from
a minor under 14 without parental/tutor consent unless the collection is
clearly for the minor's benefit. The app’s global 16+ self-declaration is
therefore a privacy-minimized draft, not counsel approval of every minors
scenario. Cloud Ask, analytics, commerce, community, support, and vendors must
be covered before Québec availability.

Primary sources:

- [PIPEDA overview and ten principles](https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/)
- [PIPEDA meaningful consent](https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/p_principle/principles/p_consent/)
- [PIPEDA breach reporting form/threshold](https://www.priv.gc.ca/media/4844/pipeda_pb_form_e.pdf)
- [Québec private-sector privacy Act](https://www.legisquebec.gouv.qc.ca/en/showdoc/cs/P-39.1)
- [Québec system privacy-impact assessment, section 3.3](https://www.legisquebec.gouv.qc.ca/en/version/cs/p-39.1?code=se%3A3_3)
- [Québec minors collection rule, section 4.1](https://www.legisquebec.gouv.qc.ca/en/version/cs/P-39.1?code=se%3A4_1&history=20231125)

Open Canadian decision: confirm whether CASL applies to promotional push/email
flows and implement proof of consent, sender identification, and unsubscribe
deadlines before any promotional delivery.

### United States

The FTC Act applies to most consumer app developers: privacy/security promises,
local-only claims, independence claims, clinical/benefit claims, AI claims,
cancellation, endorsements, and paid links must be truthful and substantiated.
Treat unauthorized health-data disclosure as both an incident and potential
breach. The amended Health Breach Notification Rule expressly reaches many
non-HIPAA health apps; counsel must determine whether Layerwell’s multi-source
profile is a covered personal health record and document the notification plan.

COPPA applies to child-directed services and general-audience services with
actual knowledge that they collect personal information from children under 13. The FTC's February 2026 age-verification policy statement is conditional:
age-verification data must be purpose-limited, promptly deleted, protected,
accurate enough for the method, and covered by clear notice and qualified
third-party safeguards. It does not approve this app's threshold, territories,
or fallback. Texas app-marketplace/developer age requirements resumed in June
2026, and Apple identifies Utah and Louisiana 2026 requirements; counsel must
map the current laws, litigation, account cohorts, feature changes, parental
consent, revocation, and older-device/non-Apple behavior before distribution.

Washington’s My Health My Data Act has a broad consumer-health-data scope and
requires a dedicated policy, consent before collection/sharing beyond what is
necessary to provide the requested service, separate signed authorization for
sale, consumer rights, processor contracts consistent with the policy, and
other controls. Layerwell should prohibit health-data sale and avoid sensitive-data
advertising entirely rather than build a sale-authorization path.

California CCPA/CPRA applicability depends on statutory thresholds and business
facts. If applicable, it adds notice, know, delete, correct, opt-out of
sale/sharing, limit-sensitive-use, non-discrimination, request handling, and
GPC obligations. Health and inferences are sensitive personal information.
The safest architecture avoids sale/cross-context behavioral advertising for
all users even before threshold applicability.

The 2025 California companion-chatbot law becomes operational in stages and has
a fact-specific definition/exclusions. Ask is deliberately non-anthropomorphic
and source-analysis oriented, but counsel must not assume an exclusion. Provide
clear AI disclosure, crisis escalation, minor protections, and no relationship/
persona mechanics regardless.

The FDA line is intended use and function specific. General-wellness education
and routine organization should avoid disease diagnosis/treatment/cure/
prevention. Camera/trend/Ask functions must not assess lesions, disease risk, or
provide patient-specific treatment. A disclaimer cannot cure contradictory
product behavior or marketing.

Affiliate/creator disclosures must be clear and conspicuous beside the link;
the FTC says “affiliate link” or a bare buy button may be inadequate, while a
plain “paid link” beside the link can disclose the relationship. Endorsers may
not make claims the marketer could not substantiate.

Primary sources:

- [FTC mobile health app legal tool](https://www.ftc.gov/business-guidance/resources/mobile-health-apps-interactive-tool)
- [FTC children's privacy and amended COPPA materials](https://www.ftc.gov/business-guidance/privacy-security/childrens-privacy)
- [FTC 2026 conditional age-verification policy statement](https://www.ftc.gov/news-events/news/press-releases/2026/02/ftc-issues-coppa-policy-statement-incentivize-use-age-verification-technologies-protect-children)
- [FTC Health Breach Notification Rule](https://www.ftc.gov/legal-library/browse/rules/health-breach-notification-rule)
- [FTC HBNR business basics](https://www.ftc.gov/business-guidance/resources/health-breach-notification-rule-basics-business)
- [Washington My Health My Data Act, chapter 19.373 RCW](https://app.leg.wa.gov/RCW/default.aspx?cite=19.373&full=true)
- [California CCPA/CPRA rights and thresholds](https://oag.ca.gov/privacy/ccpa)
- [California SB 243 enacted text](https://leginfo.legislature.ca.gov/faces/billTextClient.xhtml?bill_id=202520260SB243)
- [FDA mobile/device software policy](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/policy-device-software-functions-and-mobile-medical-applications)
- [FDA examples of regulated device software](https://www.fda.gov/medical-devices/device-software-functions-including-mobile-medical-applications/examples-device-software-functions-fda-regulates)
- [FTC endorsement and paid-link guidance](https://www.ftc.gov/business-guidance/resources/ftcs-endorsement-guides-what-people-are-asking)

### European Union / EEA

If EU/EEA availability is approved, treat skin profile, pregnancy status,
health-adjacent questions, and resulting inferences as Article 9 health data and
use explicit, purpose-specific consent unless counsel documents another valid
basis. Complete GDPR controller/processor mapping, Articles 13/14 notices,
rights, retention, security, processor contracts, transfer mechanism, records
of processing, breach response, and a DPIA for the high-risk combination of
health data, photos/face signals, AI, profiling, community, and vendors.

The DSA can apply to the community hosting/platform layer. Build a non-account-
gated illegal-content notice channel, acknowledgement/final decision, clear
statements of reasons, internal complaint/appeal, contact point, terms/rules,
moderation transparency data, and privacy-safe audit records. Confirm the small/
micro-enterprise exceptions and remaining duties with EU counsel.

The EU AI Act applies extraterritorially where output is used in the Union.
Article 50 requires people to be informed when interacting directly with an AI
system unless obvious. Preserve explicit AI disclosure, system/version records,
instructions/limitations, evaluation, human escalation, and generated-output
handling. Counsel must classify Ask/trend and map the staged application dates.

Primary sources:

- [GDPR, including Articles 9, 22, 25, 28, 30, 32, 33, and 35](https://eur-lex.europa.eu/eli/reg/2016/679/2016-05-04/eng)
- [Digital Services Act](https://eur-lex.europa.eu/eli/reg/2022/2065/oj/eng)
- [European Commission DSA user rights](https://digital-strategy.ec.europa.eu/en/factpages/user-rights-under-digital-services-act)
- [EU AI Act](https://eur-lex.europa.eu/eli/reg/2024/1689/oj?locale=en)

### United Kingdom And Other Countries

Do not infer UK, Australia, or other-country compliance from the EU/Canada/US
matrix. Each added storefront needs a country addendum covering privacy,
consumer subscriptions/auto-renewal, health/medical-device positioning,
marketing/endorsements, minors, UGC, AI, tax/trader identity, and breach notice.

## Cross-Feature Engineering Rules

- Keep photos local-only and encrypted by default; never send photo bytes or
  face/pose/light signals to analytics, Sentry, AI, commerce, or community.
- Give health, trend, cloud Ask, community, commerce, creator/measurement, and
  promotional notification purposes separate default-off choices.
- No health/photo data in advertising, session replay, cross-context behavioral
  ads, recommendation commission inputs, lock-screen detail, public links, or
  UGC unless a separately approved product requirement exists.
- Provide one complete rights orchestrator across device, Supabase, RevenueCat,
  AI vendor, analytics, crash reporting, commerce, support, and UGC.
- Keep recommendation ranking auditable and commission-independent.
- Log moderation/payment/rights/admin decisions without logging user health
  answers, prompts, photos, raw auth IDs, tokens, or private content.
- Make consent withdrawal cancel queued/in-flight work and stop future vendor
  processing; record only non-secret decision evidence.
- Do not ship automated personalized health decisions that create legal or
  similarly significant effects.
- Keep minors out of community/cloud AI until counsel approves the age model;
  a declared age gate is not identity verification.

## Decisions Required Before Public Country Availability

1. Legal seller structure and final countries/storefronts.
2. Final non-medical intended-use/claims vocabulary and App Store categories.
3. Privacy controller, privacy contact/officer, EU/UK representative if needed,
   DSA trader status, and processor/transfer posture.
4. Community age, EULA, DSA applicability, moderation/appeal model, staffing,
   copyright/takedown, crisis, and law-enforcement process.
5. AI provider, retention/training terms, transfer region, safety-audit window,
   AI Act and companion-chatbot classification, and incident thresholds.
6. Catalog/content/image/creator rights and ODbL/CosIng obligations.
7. Subscription price/trial/countries, cancellation disclosures, taxes, and
   finance/refund responsibility.
8. Affiliate/creator agreements, exact disclosure, attribution consent, and
   prohibited claims.
9. Breach regimes, notification owners, insurer/law-enforcement/counsel contacts,
   and retained incident templates.

Every decision must be reviewed against the final observed data-flow inventory,
public copy, and exact release-candidate hashes. This research packet prepares
review; it does not clear any Phase 3 item.
