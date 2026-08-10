# App Store, Medical, and Legal Gap Audit — 2026-07-26

## Status and limits

- **Release verdict:** no-go for App Store submission and public U.S. launch on
  the current evidence.
- **Scope:** provisional U.S.-only iOS launch. Canada/Quebec remains a closed
  later-market gate.
- **Method:** source review against the active launch packet and the official
  primary sources listed below.
- **Not a legal opinion:** this audit identifies launch controls and questions
  for qualified counsel, independent clinical/chemistry reviewers, Apple, and
  other applicable authorities. It does not guarantee compliance, safety,
  approval, or revenue.
- **Evidence rule:** local source and fixture tests cannot replace the exact
  signed archive, hosted services, observed production-like traffic, physical
  iPhone evidence, executed contracts, professional signoffs, or Apple-issued
  decisions.

The no-go result is driven by absent external and exact-release evidence, not a
conclusion that the architecture is incapable of launch.

## Hard App Store gates

| Priority                                             | Current gap                                                                                                                                                 | Release control                                                                                                                                                                                                                                       |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0                                                   | No verified final Apple Developer/App Store Connect app, production-like backend, or RevenueCat environment                                                 | Establish the final legal seller, App ID, App Store record, backend, IAP configuration, and role/access evidence. Keep submission closed until the exact release candidate and all required features work through the reviewer path.                  |
| P0                                                   | No Xcode 26/iOS 26 SDK signed archive, supported physical-iPhone matrix, merged privacy report, required-SDK signature audit, or exact-binary network trace | Build the exact release candidate with the then-current Apple submission toolchain. Inspect every bundle, entitlement, SDK, privacy manifest, signature, data store, and observed endpoint.                                                           |
| P0                                                   | Privacy, Terms, support, consumer-health, deletion, and export URLs remain placeholders or otherwise unverified                                             | Publish final HTTPS documents without login, bind their exact bytes to review, and reconcile App Privacy answers to the exact archive, vendor inventory, runtime configuration, storage, retention, and observed traffic.                             |
| P0                                                   | No active App Review demo account or Apple-preapproved fully featured demo mode, and no deterministic all-feature review script                              | Create a production-like reviewer identity with non-sensitive sample data, or obtain Apple's prior approval for a fully featured built-in demo mode. Exercise onboarding, empty/error states, every required feature, subscription restore/manage, export, withdrawal, deletion, and account recovery. Layerwell's preferred non-expiring reviewer account is an internal reliability control, not an Apple-stated requirement. |
| P0                                                   | Sign in with Apple, Google sign-in, same-user linking, token lifecycle, revocation, and complete deletion remain source candidates or unverified live flows | Deploy final identifiers and prove cancellation, stale/revoked credentials, relaunch, provider linkage, vendor deletion, Apple-token revocation, and subscription-safe account deletion on supported devices.                                         |
| P0                                                   | StoreKit/RevenueCat products, localized pricing, restoration, subscription disclosures, and lifecycle reconciliation are not live                           | Configure the final subscription group and products. Prove purchase, interruption, billing retry, cancellation, expiry, refund, restore, reinstall, cross-device access, and account transitions.                                                     |
| P0 if UGC is exposed                                 | Production filtering, reporting, blocking, published contact information, trained moderation, escalation, appeal, and audit evidence are absent             | Keep peer posting fail-closed until the complete Guideline 1.2 control and staffing model works end to end. Preserve the current no-images/no-DMs constraint unless separately reviewed.                                                              |
| P0 if medical-adjacent content/functions are exposed | Exact production conflict rules, Ask behavior, trend methodology, measurements, recommendations, claims, and medical positioning lack independent review    | Development builds may fail closed, but a submitted build must either complete the reviewed feature or remove/hide its prompts, upsells, placeholder cards, routes, metadata, and screenshots. Obtain exact-hash clinical, chemistry/pharmacy, regulatory-claims, privacy, and device-classification decisions. Disclose remaining non-obvious functionality in Review Notes. Do not diagnose, assign disease risk, recommend treatment, or imply validated measurement. |

2026-07-29 PHOTO-05A now makes the Trend portion of that fail-closed posture
literal: it admits no engine, simulated result, positive consent, or content
analytics and leaves only truthful route recovery plus legacy privacy cleanup.
That source checkpoint reduces the current misleading-measurement surface; it
does not close PHOTO-05/06/07, `B-AI-ONDEVICE`, `B-AI-FAIRNESS`,
`B-AI-LEGAL`, exact-claim review, archive/local-only proof, physical-device
evidence, or App Review.

If Apple treats any retained surface as a medical app, the exact release must
include the Guideline 1.4.1 reminder to check with a doctor before medical
decisions. Any health-measurement or accuracy claim must disclose supporting
data and methodology and must be validated; this methodology requirement is
not generalized here to every cosmetic statement. The release owner must also
complete the exact regional regulated-medical-device declaration decision. For
an app in Health & Fitness or Medical, or one answered as containing frequent
Medical or Treatment Information, a `Yes` declaration requires the applicable
regional owner/operator number, instructions-for-use URL, indications for use,
and safety information. A source-code posture string is not classification
evidence.

Apple states that apps requiring sensitive user information or operating in
highly regulated fields should be submitted by a legal entity rather than an
individual developer. The unresolved seller/entity decision is therefore a
material enrollment and review risk, although this audit does not treat it as an
automatic rejection in isolation.

## U.S. legal launch gates

### P0 — Consumer-health privacy operations

The source includes substantial fail-closed work, but production evidence is
absent for final health-consent text, separate sharing/sale authority where
applicable, withdrawal, processor/third-party propagation, deletion, retention,
backup treatment, and rights execution. The active U.S. Wave 1 gate
conservatively requires Washington My Health My Data controls, including:

- a dedicated consumer-health privacy policy;
- affirmative collection consent;
- separate sharing consent when sharing is in scope;
- sale authorization if any sale were ever proposed;
- access, withdrawal, and deletion behavior;
- processor and third-party propagation; and
- the Act's backup-deletion timeline.

No analytics, advertising, affiliate, AI, catalog, support, or community
recipient may receive consumer-health data merely because a general consent or
vendor contract exists.

The release contract also excludes analytics from conflict-only detail and
sharing routes, including generically named or property-free events. Apple
classifies taps and other in-app interactions as
[Product Interaction](https://developer.apple.com/app-store/app-privacy-details/)
data, makes the developer responsible for analytics SDK compliance, and treats
health and medical data as especially sensitive under
[App Review Guidelines 5.1](https://developer.apple.com/app-store/review/guidelines/#privacy).
It is a conservative product/privacy inference—not a categorical legal
classification—that a conflict-route event can reveal health-adjacent shelf
state through its context alone. Layerwell therefore measures the generic
first-value and routine funnel instead; a future change requires exact-release
privacy/legal review, disclosure reconciliation, consent authority, and a
non-inferential event design.

The exact-release App Privacy inventory must separately map pregnancy and
childbirth information as `Sensitive Info`, user-provided health or medical
data as `Health`, Photos/Videos, Product Interaction, identifiers, purchases,
and every third-party partner's collection, purposes, linkage, and tracking.
Data processed only on the device is not Apple `collected`; every raw or
derived value transmitted off-device must be evaluated separately against the
actual recipient and retention path.

### P0 — Health breach response

The FTC Health Breach Notification Rule classification, vendor incident
contacts, evidence retention, notice templates, responsible people, and
exercises remain incomplete. The production incident process must classify and
retain enough facts to meet applicable notice duties without copying sensitive
payloads into logs or tickets.

### P0 — State-law and entity classification

Qualified U.S. counsel must classify the final entity, users, functions, data
flows, vendors, photos/biometrics, minors posture, subscriptions, community,
consumer-health data, and marketing. CCPA/CPRA applicability depends on the
statutory facts and thresholds; it is not automatic. HIPAA status depends on the
entity and whether the app acts for a covered entity or business associate; the
consumer-app label does not resolve it.

### P1 — Claims, ranking, endorsements, and subscriptions

- Express and implied health/cosmetic claims need the required level of
  substantiation and exact-copy review.
- Rankings must be safety/quality driven and independently auditable.
- Material affiliate or paid relationships require clear and conspicuous
  disclosure without health-data targeting.
- Recurring-price presentation, consent/assent evidence, restoration, and
  cancellation require exact-state legal and App Review validation.
- Do not rely on the vacated 2024 FTC negative-option rule as the governing
  federal baseline; counsel must apply the current statutes, rules, orders, and
  state requirements to the release date.

## Canada and Quebec

Canada is not a current App Store blocker only if Canadian availability,
marketing, and collection are genuinely disabled and the entity/operations do
not independently create Canadian obligations. Before Canadian launch:

- classify PIPEDA and applicable provincial coverage;
- appoint accountable privacy ownership;
- establish meaningful express consent for sensitive health/photo/Ask
  processing;
- prove vendor accountability, rights, withdrawal, breach reporting, and
  recordkeeping;
- complete Quebec governance, privacy-impact assessment, cross-border transfer,
  incident-register, privacy-high-default, language, and consent controls;
- implement CASL controls before promotional email/SMS/push; and
- obtain a function-specific Health Canada software-as-a-medical-device
  assessment.

A wellness disclaimer does not cure diagnostic, treatment, mitigation,
measurement, image-analysis, or medical-recommendation functionality.

## Source-of-truth corrections applied

The older `docs/00-architecture.md` and `docs/legal-readiness.md` previously made
categorical statements that CCPA/CPRA applied, HIPAA almost certainly did not,
and a cosmetic posture plus disclaimer meant no medical-device approval was
needed. Those statements have been corrected:

- CCPA/CPRA depends on statutory scope and thresholds.
- HIPAA depends on the entity, relationships, and covered-entity/business-
  associate facts.
- FDA and Health Canada classification depends on intended use, claims, and
  actual functions, not disclaimers alone.
- A legacy `reviewed_by` marker cannot publish clinical content.
- Zero-admission paywall/reveal copy no longer claims dermatologist review,
  evidence-graded conflict checks, or paid access to unavailable interaction,
  sequencing, ramp, or skin-cycling guidance. A source contract blocks those
  phrases from returning before exact capability and review evidence exists.
- The active U.S.-only iOS launch packet and exact-hash review gates supersede
  the historical research documents.

## Ordered remediation

1. Preserve the literal fail-closed gates for clinical content, UGC, AI/trend,
   payments, vendors, and unavailable services.
2. Resolve the seller/entity and final identity through the active founder and
   trademark gates.
3. Complete the exact U.S. intended-use, claims, data-flow, processor,
   privacy/consumer-health, medical-device, subscription, and UGC legal packet.
4. Obtain independent exact-hash clinical and cosmetic-chemistry/pharmacy
   reviews plus separate regulatory-claims/jurisdiction clearance.
5. Deploy isolated production-like services and final auth/payment/vendor
   configuration.
6. Produce the exact signed Xcode archive and reconcile binary inspection,
   privacy manifests, SDK signatures, App Privacy, storage, and traffic.
7. Run the supported physical-iPhone, accessibility, subscription, account,
   deletion/withdrawal, offline/relaunch, and all-feature reviewer matrices.
8. Freeze the release evidence, obtain the authorized submission decision, and
   submit only that exact build. Treat Apple's response as the acceptance
   evidence; do not predict it.

## Primary official sources

### Apple

- [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
  — completeness, metadata, subscriptions, UGC, medical scrutiny, Sign in with
  Apple, privacy, and account deletion.
- [Upcoming submission requirements](https://developer.apple.com/news/upcoming-requirements/)
  — current toolchain and SDK submission dates.
- [Third-party SDK requirements](https://developer.apple.com/support/third-party-SDK-requirements/)
  — required SDK privacy manifests and signatures.
- [Manage App Privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/)
  — App Store Connect privacy disclosures.
- [App Privacy Details](https://developer.apple.com/app-store/app-privacy-details/)
  — data-type definitions, collection boundary, purposes, linkage, tracking,
  and third-party-partner responsibility.
- [Offering account deletion in your app](https://developer.apple.com/support/offering-account-deletion-in-your-app/)
  — deletion expectations for account-creation apps.
- [Declare regulated medical device status](https://developer.apple.com/help/app-store-connect/manage-app-information/declare-regulated-medical-device-status)
  — App Store Connect declaration.

### United States

- [Washington My Health My Data Act, RCW 19.373](https://app.leg.wa.gov/RCW/default.aspx?cite=19.373&full=true)
- [FTC Health Breach Notification Rule](https://www.ftc.gov/legal-library/browse/rules/health-breach-notification-rule)
- [FTC HBNR business guidance](https://www.ftc.gov/business-guidance/resources/complying-ftcs-health-breach-notification-rule-0)
- [California Attorney General CCPA overview](https://oag.ca.gov/privacy/ccpa)
- [FTC Health Products Compliance Guidance](https://www.ftc.gov/business-guidance/resources/health-products-compliance-guidance)
- [FTC Endorsement Guides FAQ](https://www.ftc.gov/business-guidance/resources/ftcs-endorsement-guides-what-people-are-asking)
- [Restore Online Shoppers' Confidence Act](https://www.ftc.gov/legal-library/browse/statutes/restore-online-shoppers-confidence-act)
- [HHS health-app/HIPAA guidance](https://www.hhs.gov/hipaa/for-professionals/special-topics/health-apps/index.html)
- [FDA January 2026 final General Wellness guidance](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/general-wellness-policy-low-risk-devices)
- [FDA September 2022 final Device Software and Mobile Medical Applications guidance](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/policy-device-software-functions-and-mobile-medical-applications)

The general-wellness exclusion is function-specific and limited to functions
that maintain or encourage a healthy lifestyle and are unrelated to diagnosis,
cure, mitigation, prevention, or treatment. FDA oversight and enforcement-
discretion analysis is also function- and risk-specific. Qualified counsel must
classify the exact release; neither a disclaimer nor a
`non_diagnostic_non_therapeutic` source label completes that analysis.

### Canada

- [Office of the Privacy Commissioner — meaningful consent](https://www.priv.gc.ca/en/privacy-topics/business-privacy/collecting-personal-information/consent/gl_omc_201805/)
- [Office of the Privacy Commissioner — breach guidance](https://www.priv.gc.ca/en/privacy-topics/business-privacy/breaches-and-safeguards/privacy-breaches-at-your-business/gd_pb_201810/)
- [Quebec Private Sector Privacy Act](https://www.legisquebec.gouv.qc.ca/en/document/cs/P-39.1)
- [CRTC CASL guidance](https://crtc.gc.ca/eng/internet/anti/reg.htm)
- [Health Canada software-as-a-medical-device guidance](https://www.canada.ca/en/health-canada/services/drugs-health-products/medical-devices/application-information/guidance-documents/software-medical-device-guidance-document.html)
