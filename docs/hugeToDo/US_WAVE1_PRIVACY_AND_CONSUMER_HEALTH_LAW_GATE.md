# US Wave 1 Privacy and Consumer-Health Law Gate

**Product:** OnSkin

**Decision scope:** public launch in the 50 United States and District of Columbia only

**Law-status cutoff:** July 12, 2026

**Packet prepared:** July 13, 2026

**Decision owner:** founder, with qualified US privacy/consumer-protection counsel

**Repository evidence owner:** engineering and operations
**Current launch decision:** **BLOCKED**

> **Important:** This is an engineering and launch-risk decision packet, not legal
> advice, a legal opinion, or a guarantee of compliance, App Store approval, or
> commercial success. Statutes, rules, injunctions, guidance, enforcement positions,
> and facts change. Qualified counsel must validate the product's actual data flows,
> corporate facts, contracts, claims, and launch date immediately before release.

## 1. Executive decision

OnSkin must not ship its current all-features iOS launch contract merely because it
is small, local-first, age-gated, or distributed through Apple. Those facts reduce
risk but do not eliminate it.

The controlling launch posture is:

| Question                                                                             | Decision as of cutoff                                                                                                    |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Is the legal research packet complete enough to set engineering gates?               | **In progress for planning** until the classifications below are resolved and counsel validates them                     |
| Is OnSkin legally cleared for a US public launch?                                    | **No; blocked**                                                                                                          |
| Is Apple approval assured?                                                           | **No; it cannot be assured**                                                                                             |
| Can ordinary startup-size exemptions be relied on?                                   | **No**                                                                                                                   |
| Can App Store territory selection alone control legal scope?                         | **No**                                                                                                                   |
| Can the team silently omit a required high-risk feature?                             | **No; amend the launch contract or complete its gates**                                                                  |
| Can photos be sent to a server for analysis?                                         | **No under the current product contract**                                                                                |
| Can health data be used for advertising or third-party targeting?                    | **No**                                                                                                                   |
| Can users under 18 use the Wave 1 product?                                           | **Undecided and blocked:** the repository currently implements 16+; this packet proposes 18+ as a conservative migration |
| Can subscriptions launch before the reverse-trial and cancellation flow is reviewed? | **No**                                                                                                                   |
| Can community launch without notice-and-removal and moderation operations?           | **No**                                                                                                                   |

### Why launch is blocked

1. OnSkin processes or can infer consumer health data: skin concerns, pregnancy or
   reproductive status, sensitivities, routines, adherence, product reactions,
   progress, and related recommendations.
2. Washington's My Health My Data Act, Nevada's consumer-health law, and
   Connecticut's health/sensitive-data provisions can apply without the ordinary
   revenue or consumer-count thresholds founders often expect.
3. California's CMIA may deem qualifying consumer-health software a provider of
   health care for that statute, and OnSkin's pregnancy/TTC and condition-management
   facts require a written classification.
4. Colorado's biometric amendments apply to covered biometric processing without
   ordinary volume thresholds; transient face bounds require written classification.
5. For Texas, the district court's universal preliminary injunctions were stayed
   pending appeal. The App Store Accountability Act is effective; the selected age
   contract must also be reconciled with Texas SCOPE before community or minor
   access.
6. The FTC Health Breach Notification Rule can cover a non-HIPAA health app and
   treats unauthorized disclosure—not only a hostile database intrusion—as a
   potential breach.
7. The all-features contract includes cloud Ask, recommendations, commerce,
   subscriptions, community, sharing, analytics, notifications, and administration.
   Each adds a separate consent, disclosure, security, claims, or operational gate.
8. Current repository packets record unresolved policy, vendor-contract, rights,
   deletion, incident-response, analytics, claims, and professional-review evidence.
9. The repository's authoritative age baseline and code are currently 16+, while
   this packet recommends a proposed 18+ Wave 1 migration. Neither threshold may be
   represented as final until founder/counsel selection and full implementation
   reconciliation are complete.

### Status semantics used here

- **Complete:** the stated artifact exists, was tested or reviewed, and has durable
  evidence.
- **In progress:** work exists but its acceptance evidence is incomplete.
- **Blocked:** a required prerequisite is absent or failed.
- **External pending:** a third party, professional, vendor, regulator, or account
  owner must act.
- **Not started:** no reliable implementation evidence exists.

Research marked in progress is not launch clearance. Counsel review is
**external pending**; code and operational evidence are **blocked** until the gates
below pass.

## 2. Scope, method, and assumptions

### 2.1 Launch perimeter

Wave 1 means the 50 states plus the District of Columbia. Puerto Rico, Guam, the US
Virgin Islands, American Samoa, the Northern Mariana Islands, all non-US
storefronts, and all non-US marketing are out of scope. The app, website, support
flows, public links, purchase links, TestFlight groups, and backend access controls
must consistently enforce that perimeter.

Storefront selection is only one signal. Residence, physical presence when data is
collected, marketing, billing, IP-derived location, public links, travel, and state
statutory definitions may create a connection to a jurisdiction. Counsel must
approve the actual perimeter controls.

### 2.2 Facts assumed for this decision

This packet relies on the repository's current product contract, except where an
explicit proposed migration is identified:

- the current source-of-truth documents and runtime set a 16+ minimum;
- this packet recommends 18+ for Wave 1 as a conservative proposed migration, but
  18+ is not an adopted or implemented fact;
- photos are encrypted and device-local by default;
- no automatic photo or photo-metadata upload occurs;
- any face-bound calculation is transient and does not create a persistent face
  template or identifier;
- health and routine data are local-first, with narrowly approved synchronization;
- OnSkin does not diagnose, treat, cure, prevent, or claim to measure disease;
- no “skin age,” “AI skin score,” percentage-improvement, or equivalent medical or
  objective-performance claim is made;
- no sale of health data, targeted advertising based on health data, or data-broker
  disclosure occurs;
- recommendation ranking is not secretly driven by affiliate commission;
- optional cloud features are fail-closed until separate approval and consent;
- production vendors remain candidates until contracts, configuration, and
  data-flow evidence are approved.

Observed age evidence is explicit: apps/mobile/src/features/onboarding/ageGate.ts
sets MINIMUM_AGE to 16, while docs/01-auth-onboarding.md and
docs/11-community-layer.md describe a hard 16+ baseline. The 18+ position in this
packet is therefore a proposal, not an observation.

If any fact changes, this decision must be reopened before the change is enabled.

### 2.3 Research standard

The legal-status conclusions use primary official sources only: enacted statutory
text, eCFR or US Code, official regulator guidance, official court records, and
official legislative status pages. Secondary summaries were not used as authority.
The practical screen is deliberately conservative and is not a substitute for a
state-by-state counsel memorandum.

The Connecticut screen uses the current 2026 statutory supplement, and Iowa uses
the 2026 Code. At the cutoff, Florida and Indiana's official online codifications
available for the cited chapters were still labeled 2025. Final 2026 codification
was not assumed.

The Florida Senate citation-query URL preserves its filters. Reproduced on July
13, 2026 using records current through the July 12 cutoff, the fields **Session =
2026; Chamber = Senate and House; Current Bill Version only; Citation = 501;
Citation Type = FL Statutes** returned 33 bills. The enacted results reviewed were
CS/CS/CS/SB 290 (chapter 2026-3), CS/CS/HB 1069 (chapter 2026-114), CS/SB 1074
(chapter 2026-68), CS/SB 7014 (chapter 2026-153), and SB 7026 (chapter 2026-52).
Exact citation queries run separately for ss. 501.701 through 501.722 returned no
bill for ss. 501.701 through 501.721 and only companion HB 7017 and SB 7026 for s.
501.722. Only SB 7026 was enacted; its enrolled section 12 makes a conforming
trade-secret change within the public-records exemption, not a substantive change
to OnSkin's controller or consumer duties.

Indiana's official **2026 Table of Citations Affected** was also reproduced and
visually checked on July 13, 2026 using records current through the cutoff. Its
Title 24 entries on pages 73-74 jump from IC 24-14 to IC 24-16 and contain no IC
24-15 provision; the table therefore identified no enacted 2026 act affecting IC
24-15. These source screens are not a release-date legal update. Counsel must still
reconcile every enacted regular- or special-session 2026 law, correction, later
publication, and operative codification against Florida chapter 501 part V and
Indiana IC 24-15 immediately before release.

## 3. The national minimum baseline

The least fragile implementation is one strict US baseline, not 51 subtly different
experiences. State-specific disclosures or appeals may be added, but the product
must not weaken these controls for a state thought to be exempt.

1. **Reconcile the age contract.** The repository currently implements 16+; the
   proposed conservative Wave 1 migration is 18+. Launch remains blocked until the
   founder and counsel select the exact threshold and source-of-truth docs, code,
   policies, App Store rating, community rules, tests, and archived release build
   all enforce the same value. If 16+ is retained, every applicable minor/teen
   consent, data, purchase, safety, parental, and platform duty must be implemented
   before access. Retain only the minimum proof needed to enforce the selected
   threshold. Actual knowledge of a child or minor cannot be ignored.
2. **No sale or targeted advertising.** Do not sell personal data; do not use health,
   pregnancy, concern, routine, photo, Ask, or community data for targeted or
   cross-context behavioral advertising; do not disclose it to data brokers.
3. **No precise location.** Request no location permission, create no health-related
   geofence, and do not retain or infer precise location. Minimize and mask network
   IP data at every vendor that permits it.
4. **Data minimization.** Collect each field only for a named user-requested
   function. A possible future feature is not a present collection purpose.
5. **Unbundled consent.** Health collection, health sharing, cloud Ask,
   user-initiated photo sharing, community publication, and any materially different
   secondary use require separate, plain-language, voluntary choices.
6. **Local photo boundary.** Photos remain encrypted on the device. No background
   upload, cloud backup, analytics attachment, crash screenshot, embedding, face
   template, model training, or server-side analysis is allowed.
7. **Rights everywhere.** Provide authenticated access, correction, portable export,
   deletion, consent withdrawal, and appeal/intake paths nationally, plus processor
   propagation and auditable completion.
8. **Purpose-bound processors.** Every processor receives only allowlisted data under
   a written agreement covering instructions, confidentiality, security,
   subprocessors, deletion/return, assistance, audit evidence, and incidents.
9. **Security by evidence.** Encryption, tenant isolation, least privilege, admin
   MFA, audit logging, secure development, vendor review, backup restoration, and an
   exercised incident plan are launch requirements.
10. **Strict negative-option UX.** State the price, billing period, trial or reverse-
    trial conversion, renewal, cancellation, and material terms before consent.
    Obtain affirmative consent, provide a retainable acknowledgment, restore
    purchases, and make cancellation/manage-subscription access direct.
11. **Truthful, substantiated claims.** No express or implied health, safety,
    performance, endorsement, or comparative claim may exceed reviewed evidence.
12. **No dark patterns.** Privacy, consent, age, trial, purchase, deletion, and
    cancellation decisions must be symmetrical, understandable, and free of
    obstruction.

This baseline is a product decision. It does not establish that every law requires
every item, and it does not establish compliance by itself.

## 4. Legal status ledger at the cutoff

| Authority or development                                                             | Status on July 12, 2026                                                                         | Launch treatment                                                                                       |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| FTC Act § 5                                                                          | Effective                                                                                       | Applies to unfair or deceptive privacy, security, UX, claims, and disclosures                          |
| FTC Health Breach Notification Rule, amended rule                                    | Effective; amendments applicable since July 29, 2024                                            | Presume in scope until counsel documents otherwise                                                     |
| Amended COPPA Rule                                                                   | Effective; principal compliance date April 22, 2026                                             | Reconciled selected-age gate plus actual-knowledge response required                                   |
| ROSCA                                                                                | Effective                                                                                       | Applies to online negative-option transactions within scope                                            |
| FTC 2024 amended “click-to-cancel” rule                                              | **Vacated in July 2025**                                                                        | Do not cite it as operative law; retain strict UX because ROSCA, FTC Act, Apple, and state laws remain |
| TAKE IT DOWN Act platform notice/removal duties                                      | Effective May 19, 2026                                                                          | Community gate if OnSkin is a covered platform                                                         |
| Washington My Health My Data Act                                                     | Effective; general March 31, 2024, small-business June 30, 2024                                 | Treat as applicable                                                                                    |
| Nevada SB 370 consumer-health law                                                    | Effective March 31, 2024                                                                        | Treat as applicable                                                                                    |
| Connecticut consumer-health provisions                                               | Effective July 1, 2023                                                                          | Treat as applicable                                                                                    |
| Connecticut expanded sensitive-data coverage                                         | Effective July 1, 2026                                                                          | Treat as applicable regardless ordinary size threshold                                                 |
| California CMIA, including Civil Code §§ 56.05–56.06                                 | Effective; mobile/consumer-health software can be deemed a provider under the statute           | **Launch-blocking classification:** apply CMIA controls if counsel finds coverage                      |
| Colorado HB 24-1130 biometric amendments                                             | Effective July 1, 2025                                                                          | Any-amount biometric coverage defeats ordinary volume-threshold reliance for that processing           |
| Texas SCOPE Act                                                                      | Effective September 1, 2024                                                                     | Counsel must classify Skin Notes and the selected age model before peer posting                        |
| Texas SB 2420 App Store Accountability Act                                           | Effective January 1, 2026; universal preliminary injunctions stayed pending appeal June 4, 2026 | Treat as potentially operative; counsel determines release-date scope and required developer controls  |
| 20 enacted state comprehensive privacy laws listed below                             | Effective                                                                                       | Screen every state; apply national baseline                                                            |
| Louisiana comprehensive privacy law                                                  | Enacted; future effective date January 1, 2027                                                  | Build now; counsel recheck before date                                                                 |
| Vermont comprehensive privacy law                                                    | Enacted; future effective date January 1, 2028                                                  | Build now; counsel recheck before date                                                                 |
| Vermont Age-Appropriate Design Code                                                  | Enacted; future effective date January 1, 2027                                                  | Selected age model and design still require counsel review                                             |
| California Age-Appropriate Design Code                                               | Partly enjoined/litigated; March 2026 Ninth Circuit decision altered injunction scope           | Do not describe the entire law as either fully effective or void; counsel tracks litigation            |
| California SB 976 implementing regulations                                           | Proposed as of May 2026 source reviewed                                                         | Do not treat proposal text as final                                                                    |
| New York S.9269                                                                      | Passed both houses June 2026; not enacted at cutoff                                             | Pending/nonoperative monitoring only; do not implement or describe as current law                      |
| Federal SECURE Data Act, Alaska HB 367, Massachusetts S.2619, Illinois omnibus bills | Proposals/pending at cutoff                                                                     | Monitor; do not present as enacted                                                                     |
| Maine LD 1088 and LD 1822                                                            | Dead/not enacted at cutoff                                                                      | Do not present as law                                                                                  |

The status ledger must be refreshed immediately before submission, beta expansion,
and production release.

## 5. Federal gate

### 5.1 FTC Act: privacy, security, product claims, and dark patterns

[15 U.S.C. § 45](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title15-section45&num=0&edition=prelim)
prohibits unfair or deceptive acts or practices. For OnSkin, that makes the product,
privacy policy, App Store disclosures, onboarding, consent copy, SDK behavior,
support promises, claims, paywall, deletion flow, and actual backend behavior one
testable system. A statement such as “photos never leave your device” is unsafe if
crash reporting, backup, support upload, or a later feature can transmit them.

The FTC's
[health-products claims guidance](https://www.ftc.gov/business-guidance/resources/health-products-compliance-guidance)
requires truthful, nonmisleading, adequately substantiated health-related claims.
OnSkin therefore needs a claims register containing the exact copy, intended and
reasonably implied meaning, audience, evidence, reviewer, channel, and expiry/review
date. A cosmetic disclaimer does not cure a diagnostic or treatment impression.

The FTC's
[Start with Security guidance](https://www.ftc.gov/business-guidance/resources/start-security-guide-business)
supports minimization, sensible access, secure storage and transmission, vendor
oversight, testing, secure disposal, and an incident plan. BetterHelp and GoodRx
enforcement show why health data must not flow to advertising platforms or pixels:

- [BetterHelp final order](https://www.ftc.gov/news-events/news/press-releases/2023/07/ftc-gives-final-approval-order-banning-betterhelp-sharing-sensitive-health-data-advertising)
- [GoodRx enforcement](https://www.ftc.gov/news-events/news/press-releases/2023/02/ftc-enforcement-action-bar-goodrx-sharing-consumers-sensitive-health-info-advertising)

**Gate:** a release build must prove that privacy statements match observed network,
storage, logging, notification, analytics, support, and deletion behavior.

### 5.2 Health Breach Notification Rule

The current
[16 CFR Part 318](https://www.ecfr.gov/current/title-16/part-318)
expressly covers qualifying non-HIPAA vendors of personal health records, related
entities, and service providers. “Health care services or supplies” includes apps
that track health conditions, symptoms, bodily functions, medications, and other
health-related tools. A breach includes unauthorized acquisition caused by an
unauthorized disclosure. The FTC's
[mobile-health interactive tool](https://www.ftc.gov/business-guidance/resources/mobile-health-apps-interactive-tool)
and
[HBNR business guidance](https://www.ftc.gov/business-guidance/resources/health-breach-notification-rule-basics-business)
must be applied to the final architecture.

OnSkin combines user-supplied or inferred skin/health information with data from
more than one source, including product/catalog, account, subscription, routine, and
possibly cloud-service inputs. Counsel must decide the precise classification, but
engineering must presume HBNR coverage.

Required readiness includes:

- written identification of OnSkin and applicable vendors as vendor, related
  entity, or third-party service provider;
- contracts naming an incident-notice recipient and requiring immediate notice and
  affected-customer detail;
- monitoring for unauthorized disclosure, SDK leakage, misdirected exports, support
  access, tenant failures, and credential compromise—not only database theft;
- a discovery/escalation rule based on when any employee, officer, or agent knew or
  reasonably should have known;
- an HBNR decision worksheet and the
  [FTC submission path](https://www.ftc.gov/business-guidance/health-breach-form);
- individual, FTC, media, substitute-notice, and law-enforcement-delay playbooks;
- evidence sufficient to prove timing and any delay.

Notices generally must be sent without unreasonable delay and no later than 60
calendar days after discovery. Incidents involving 500 or more individuals require
FTC notice contemporaneously with individual notice; smaller breaches may be
logged and submitted annually no later than 60 days after year end. State deadlines
can be shorter, so **60 days is not the internal response target**.

**Gate:** security counsel approves the classification and an exercised
HBNR-plus-state incident matrix; production vendors accept incident terms.

### 5.3 COPPA and minors

The FTC's
[COPPA Rule](https://www.ftc.gov/legal-library/browse/rules/childrens-online-privacy-protection-rule-coppa)
and
[official FAQ](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions)
apply to child-directed online services and operators with actual knowledge that
they collect personal information from a child under 13. The amended rule was
published April 22, 2025, with the principal compliance date April 22, 2026.

Wave 1 is not designed for children. The repository currently selects 16+, while
this packet proposes migration to 18+ because health, photos, community, commerce,
and subscriptions create broader teen-law risk. That proposal is neither adopted
nor implemented. Launch is blocked until founder/counsel select the exact threshold
and every source of truth and release surface agrees. Retaining 16+ requires a
complete teen-law implementation; choosing 18+ does not permit willful blindness or
erase duties triggered by actual knowledge.

**Gate:**

- a neutral age screen occurs before risky collection;
- users below the selected launch threshold cannot create accounts or reach health,
  cloud, community, or purchase flows;
- the service does not use child-oriented marketing, creative, keywords, or
  influencer campaigns;
- reports or support messages showing an underage account trigger prompt
  restriction, evidence-preserving review, and deletion/escalation under a written
  procedure;
- age-gate telemetry contains no unnecessary full birth date;
- any age-assurance vendor or new flow receives a new privacy, bias, security, and
  counsel review.
- Texas app-store age/consent signals and Texas SCOPE duties are handled as specified
  in Section 7.2; the app's self-declared age is not treated as a substitute.

### 5.4 ROSCA, subscriptions, and negative options

[15 U.S.C. § 8403](https://uscode.house.gov/view.xhtml?req=%28title%3A15+section%3A8403+edition%3Aprelim%29)
requires clear and conspicuous disclosure of material terms before billing
information is obtained, express informed consent, and a simple mechanism to stop
recurring charges for covered online negative-option transactions. The FTC's 2024
amended negative-option rule was vacated in 2025; the FTC's
[2026 official ANPR](https://www.ftc.gov/system/files/ftc_gov/pdf/p064202negativeoptionruleanprm.pdf)
records that procedural status. ROSCA, FTC Act authority, state law, and Apple rules
remain.

**Gate:** the final RevenueCat/App Store product configuration, paywall, reverse
trial, acknowledgment, renewal communication, entitlement logic, restore,
manage-subscription link, cancellation explanation, refund/support handling, and
account-deletion warning must be jointly reviewed from screenshots and sandbox
receipts. Account deletion must not falsely say it cancels an Apple subscription.

### 5.5 Endorsements, affiliates, and rankings

The FTC's
[Endorsement Guides update](https://www.ftc.gov/news-events/news/press-releases/2023/06/federal-trade-commission-announces-updated-advertising-guides-combat-deceptive-reviews-endorsements)
and
[staff FAQ](https://www.ftc.gov/business-guidance/resources/ftcs-endorsement-guides-what-people-are-asking)
require material connections to be disclosed clearly and conspicuously. Commerce
links must show an adjacent disclosure such as “OnSkin may earn a commission,” not
only a footer or policy link. Recommendation ranking must be generated independently
of commission, and the ranking inputs must be auditable.

### 5.6 Community and the TAKE IT DOWN Act

The FTC's
[official compliance guidance](https://www.ftc.gov/business-guidance/resources/complying-take-it-down-act)
states that covered platforms had to establish the Act's notice-and-removal process
by May 19, 2026. A valid request can require removal of nonconsensual intimate visual
depictions and known identical copies within 48 hours.

OnSkin prohibits public before/after imagery, but prohibition does not replace an
operational process if the community feature makes OnSkin a covered platform.
Counsel must also assess the
[DMCA safe-harbor conditions in 17 U.S.C. § 512](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title17-section512&num=0&edition=prelim)
and
[47 U.S.C. § 230](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title47-section230&num=0&edition=prelim)
without treating either as blanket immunity.

**Gate:** public notice and a publicly accessible intake requiring no OnSkin
account; collection and validation of the statutory signature, attestation, contact,
and request information; rapid preservation and review; 48-hour removal capability;
known-copy handling; reporter/subject communications; moderator coverage;
escalation; appeals where appropriate; audit evidence; and
law-enforcement/emergency procedures.

## 6. Consumer-health law gate

### 6.1 Why OnSkin data is consumer health data

The relevant statutes define health data more broadly than medical records.
Information can qualify when it identifies or is linkable to a consumer and
indicates, relates to, or is used to infer a health condition, bodily function,
treatment/intervention, reproductive status, medication/product use, or precise
location connected with health services.

OnSkin's strongest risk signals are:

- pregnancy, trying-to-conceive, and breastfeeding flags;
- skin concerns, sensitivities, allergies/reactions, and contraindications;
- product use, open dates, routine steps, cycle/ramp schedules, completion and
  adherence;
- conflict rules and personalized recommendations;
- progress photos and any derived measurement;
- free-text Ask prompts and support/community content;
- inferences drawn from any combination of those fields.

Calling the app “cosmetic,” “wellness,” or “not medical” does not control statutory
classification.

### 6.2 Washington My Health My Data Act

The operative
[RCW chapter 19.373](https://app.leg.wa.gov/RCW/default.aspx?cite=19.373&full=true)
covers Washington consumers and consumer health data collected in Washington. Its
definitions include collection through access, retention, derivation, inference,
and processing. The principal duties were effective March 31, 2024, and the
small-business date was June 30, 2024.

The final product must satisfy, as applicable:

- a separate consumer-health privacy policy linked prominently on the homepage and
  available in the app;
- categories collected and purposes, sources, categories shared, categories of
  recipients/third parties, and how rights are exercised;
- prior consent to collection unless necessary to provide the user-requested
  product or service;
- consent to sharing that is separate and distinct from collection consent;
- a separate signed authorization for any sale—OnSkin instead prohibits sale;
- access, withdrawal, and deletion rights, including data at processors and other
  third parties;
- response within 45 days, with only the statutory extension and notice;
- backup deletion no later than the statutory six-month allowance;
- access controls and security appropriate to volume and nature;
- processor instructions and a binding contract;
- no geofence around an entity providing in-person health-care services.

Violations are enforceable under Washington's Consumer Protection Act. Counsel must
assess public and private enforcement exposure; this packet does not claim a flat
per-violation damages amount.

The related
[Washington biometric-identifiers law](https://app.leg.wa.gov/RCW/default.aspx?cite=19.375&full=true)
is separately screened in Section 8.

### 6.3 Nevada SB 370

The current
[NRS chapter 603A](https://www.leg.state.nv.us/NRS/NRS-603A.html)
and
[enrolled SB 370](https://archive.leg.state.nv.us/Session/82nd2023/Bills/SB/SB370_EN.pdf)
cover Nevada residents and consumer health data collected in Nevada. The law has
been effective since March 31, 2024.

The launch implementation must provide, as applicable:

- a consumer-health privacy policy with collection, purpose, source, sharing, and
  rights disclosures;
- affirmative, voluntary consent before collection, with the service-requested
  exception analyzed narrowly;
- separate consent before sharing;
- written authorization for sale—OnSkin prohibits sale;
- access, confirmation, review, correction, deletion, withdrawal, and appeal/intake
  operations;
- security and processor contracts;
- no qualifying health-related geofence within 1,750 feet.

Nevada assigns enforcement to the Attorney General and treats violations as a
deceptive trade practice; SB 370 does not create a private right of action.

### 6.4 Connecticut

Connecticut's
[official Data Privacy Act portal](https://portal.ct.gov/AG/Sections/Privacy/The-Connecticut-Data-Privacy-Act)
and
[current 2026 codified chapter](https://www.cga.ct.gov/2026/sup/chap_743jj.htm)
contain consumer-health provisions, including a controller category that is not
conditioned on the ordinary revenue or consumer-volume thresholds. The law also
requires consent for sensitive-data processing, data-protection assessments for
specified high-risk processing, processor contracts, confidentiality, consumer
rights, and a health-related geofence restriction.

The Connecticut Attorney General's
[2026 business guidance](https://portal.ct.gov/-/media/ag/press_releases/2026/cdpa-business.pdf?hash=112BB88A1ADEBDEEF4C7E3AC5D426A1C&rev=7c686fc401434d0d8ac900a9e57989f9)
states that, beginning July 1, 2026, any business processing sensitive data outside
specified payment processing is subject to the Act. OnSkin therefore must not rely
on an ordinary startup-size exemption.

### 6.5 California Confidentiality of Medical Information Act

California's current
[Civil Code §§ 56.05–56.06](https://leginfo.legislature.ca.gov/faces/codes_displayText.xhtml?chapter=1.&division=1.&lawCode=CIV&part=2.6.)
create a launch-blocking classification question independent of the CCPA threshold.
Section 56.06 can deem a business a “provider of health care” for CMIA purposes when
its software or mobile app is designed to maintain medical information so an
individual can manage that information or a medical condition. Section 56.05's
current medical-information definition expressly includes qualifying reproductive
or sexual-health application information, including pregnancy, plans to conceive,
and inferences about pregnancy status.

OnSkin collects pregnancy/TTC/breastfeeding status and uses health profile,
reaction, routine, conflict, recommendation, and Ask information to organize or
guide user decisions. A cosmetic or non-diagnostic label does not itself decide
whether those facts satisfy § 56.06. The California Attorney General's
[healthcare-AI advisory](https://oag.ca.gov/system/files/attachments/press-docs/Final%20Legal%20Advisory%20-%20Application%20of%20Existing%20CA%20Laws%20to%20Artificial%20Intelligence%20in%20Healthcare.pdf)
states that California medical privacy laws can reach businesses offering consumer
software for management of medical information or conditions and emphasizes
confidentiality, access, authorization, and limits on improper use.

The
[People v. Glow final judgment](https://oag.ca.gov/sites/default/files/People%20v.%20Glow%20-%20Final%20Judgment%20and%20Permanent%20Injunction%20-%2007374856.pdf)
is an enforcement signal involving a reproductive-health app. It was a stipulated
judgment without trial, adjudication, admission, or general precedential effect; its
app-specific terms are not automatically OnSkin's legal duties. It nevertheless
shows the Attorney General using CMIA, unfair-competition, authorization,
confidentiality, security, purpose-change, and privacy-by-design theories against a
consumer app.

**Launch gate:** California health/privacy counsel must issue a written,
version-specific decision on whether OnSkin or any feature is within § 56.06 and
which data is “medical information.” If coverage exists, counsel must map and
approve every applicable CMIA authorization, confidentiality, access, disclosure,
purpose-change, reproductive-health segregation/location, contractor, security,
incident, retention, and remedy requirement. Engineering must then prove the
controls in code, vendor behavior, release traffic, rights output, and incident
exercises. Until that decision and evidence exist, California launch is blocked.

**Refusal condition:** do not use or disclose California medical information for a
new purpose, cloud AI, recommendation, commerce, analytics, support, or another
vendor based only on a general privacy policy or terms acceptance.

### 6.6 Strictest-common-denominator health implementation

| Control             | Required OnSkin decision                                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Health data map     | Enumerate direct, inferred, derived, transient, logged, and processor-held data by field and event                             |
| Collection basis    | Document “necessary to provide requested service” narrowly; otherwise obtain affirmative consent                               |
| Sharing             | Separate consent tied to named categories and recipients; optional processors remain off until consent                         |
| Sale                | Prohibited technically, contractually, and by policy                                                                           |
| Advertising         | No health-data advertising, tracking pixels, ad identifiers, or health-derived audiences                                       |
| Policy              | A consumer-health policy in app and on the public site, distinct and consistent with the general policy                        |
| Withdrawal          | Stop new collection/sharing and queued optional processing immediately; preserve only counsel-approved legal/security evidence |
| Rights              | Access, correction where applicable, portable export, deletion, withdrawal, and appeal/intake                                  |
| Downstream deletion | Propagate to every processor and third party; record acknowledgment and retries                                                |
| Backup deletion     | Complete within the Washington outer limit of six months and disclose the process accurately                                   |
| Security            | Restrict workforce access; encrypt; log privileged access; test tenant isolation and exports                                   |
| Processor contract  | Instructions, purpose, duration, data types, confidentiality, security, subprocessor, rights, deletion, audit, incident terms  |
| Geofencing          | No location permission or health-related geofence; minimize vendor IP handling                                                 |
| Change control      | New purpose, field, inference, model, vendor, region, or public surface reopens review                                         |

## 7. Practical 50-state and DC applicability screen

This is a routing screen, not a dispositive coverage opinion. “No effective
omnibus” means no generally applicable comprehensive consumer-privacy statute was
identified as effective at the cutoff; it does **not** mean no privacy law applies.
Every row remains subject to federal law, breach-notification law, unfair/deceptive
practices law, subscription rules, and sector-specific rules.

| Jurisdiction         | Comprehensive privacy status at cutoff                                                                     | Practical OnSkin gate or overlay                                                                                   |
| -------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Alabama              | No effective omnibus identified                                                                            | National baseline; breach, consumer-protection, subscription screen                                                |
| Alaska               | No effective omnibus; HB 367 pending                                                                       | Do not treat proposal as law; national baseline and monitoring                                                     |
| Arizona              | No effective omnibus identified                                                                            | National baseline; breach, consumer-protection, subscription screen                                                |
| Arkansas             | No effective omnibus identified                                                                            | National baseline; breach, consumer-protection, subscription screen                                                |
| California           | CCPA effective; CPRA amendments operative January 1, 2023                                                  | **CMIA classification regardless CCPA threshold**; ARL, breach/private-action, minors, GPC, litigated AADC overlay |
| Colorado             | CPA effective July 1, 2023; HB 24-1130 biometric amendments effective July 1, 2025                         | Any-amount biometric coverage; face-bound classification, policy, retention, incident, consent, and rights gate    |
| Connecticut          | CTDPA effective July 1, 2023; sensitive-data expansion effective July 1, 2026                              | **Treat as covered now**; consumer-health and sensitive data remove ordinary startup-threshold reliance            |
| Delaware             | Delaware Personal Data Privacy Act effective January 1, 2025                                               | Low volume threshold; monitor 35,000/10,000-plus-sale tests; national baseline                                     |
| District of Columbia | No effective omnibus identified                                                                            | National baseline; breach, consumer-protection, subscription screen                                                |
| Florida              | Digital Bill of Rights effective July 1, 2024                                                              | Narrow high-revenue/specified-business scope; monitor facts, but do not weaken baseline                            |
| Georgia              | No effective omnibus identified                                                                            | National baseline; breach, consumer-protection, subscription screen                                                |
| Hawaii               | No effective omnibus identified                                                                            | National baseline; breach, consumer-protection, subscription screen                                                |
| Idaho                | No effective omnibus identified                                                                            | National baseline; breach, consumer-protection, subscription screen                                                |
| Illinois             | No effective omnibus; bills pending                                                                        | **BIPA biometric gate**, breach, subscription, consumer-protection; do not treat pending omnibus bills as enacted  |
| Indiana              | Indiana Consumer Data Protection Act effective January 1, 2026                                             | Threshold monitoring; sensitive consent, assessments, processor contracts, rights                                  |
| Iowa                 | Iowa Consumer Data Protection Act effective January 1, 2025                                                | Threshold monitoring; use stricter national sensitive-data consent baseline                                        |
| Kansas               | No effective omnibus identified                                                                            | National baseline; breach, consumer-protection, subscription screen                                                |
| Kentucky             | Kentucky Consumer Data Protection Act effective January 1, 2026                                            | Threshold monitoring; sensitive consent, assessments, processor contracts, rights                                  |
| Louisiana            | Comprehensive privacy law enacted; effective January 1, 2027                                               | Future law: build now, obtain refreshed counsel analysis before effective date                                     |
| Maine                | No effective omnibus; reviewed 2025/2026 bills not enacted                                                 | Do not cite dead proposals; national baseline                                                                      |
| Maryland             | Maryland Online Data Privacy Act effective October 1, 2025                                                 | Low threshold and strict minimization/sensitive-data duties; monitor 35,000/10,000-plus-sale tests                 |
| Massachusetts        | No effective omnibus; S.2619 not enacted at cutoff                                                         | **201 CMR 17.00/WISP security gate** plus breach, subscription, consumer protection                                |
| Michigan             | No effective omnibus identified                                                                            | National baseline; breach, consumer-protection, subscription screen                                                |
| Minnesota            | Minnesota Consumer Data Privacy Act effective July 31, 2025                                                | Threshold monitoring; rights, sensitive consent, assessments, processor and profiling controls                     |
| Mississippi          | No effective omnibus identified                                                                            | National baseline; breach, consumer-protection, subscription screen                                                |
| Missouri             | No effective omnibus identified                                                                            | National baseline; breach, consumer-protection, subscription screen                                                |
| Montana              | Montana Consumer Data Privacy Act effective October 1, 2024; threshold amendment effective October 1, 2025 | Monitor reduced 25,000-consumer threshold and sale test; national baseline                                         |
| Nebraska             | Nebraska Data Privacy Act effective January 1, 2025                                                        | Broad business scope with small-business exception; sensitive-data-sale consent still screened                     |
| Nevada               | No general omnibus equivalent; existing online privacy law plus SB 370                                     | **Treat consumer-health law as covered**; health policy, consent, rights, processor, geofence gates                |
| New Hampshire        | New Hampshire privacy law effective January 1, 2025                                                        | Low threshold; monitor 35,000/10,000-plus-sale tests; national baseline                                            |
| New Jersey           | New Jersey Data Privacy Act effective January 15, 2025                                                     | Threshold monitoring; sensitive consent, rights, processor, assessment, opt-out controls                           |
| New Mexico           | No effective omnibus identified                                                                            | National baseline; breach, consumer-protection, subscription screen                                                |
| New York             | No effective omnibus; S.9269 passed both houses but was not enacted at cutoff                              | **S.9269 is pending/nonoperative only**; SHIELD, geofence, breach, subscription, consumer-protection screen        |
| North Carolina       | No effective omnibus identified                                                                            | National baseline; breach, consumer-protection, subscription screen                                                |
| North Dakota         | No effective omnibus identified                                                                            | National baseline; breach, consumer-protection, subscription screen                                                |
| Ohio                 | No effective omnibus identified                                                                            | National baseline; breach, consumer-protection, subscription screen                                                |
| Oklahoma             | No effective omnibus identified                                                                            | National baseline; breach, consumer-protection, subscription screen                                                |
| Oregon               | Oregon Consumer Privacy Act effective July 1, 2024                                                         | Threshold monitoring; sensitive consent, rights, assessments, processor and authorized-agent controls              |
| Pennsylvania         | No effective omnibus identified                                                                            | National baseline; breach, consumer-protection, subscription screen                                                |
| Rhode Island         | Data Transparency and Privacy Protection Act effective January 1, 2026                                     | Low threshold and website-policy provisions; counsel validates coverage and disclosures                            |
| South Carolina       | No effective omnibus identified                                                                            | National baseline; breach, consumer-protection, subscription screen                                                |
| South Dakota         | No effective omnibus identified                                                                            | National baseline; breach, consumer-protection, subscription screen                                                |
| Tennessee            | Tennessee Information Protection Act effective July 1, 2025                                                | Threshold monitoring; sensitive consent, assessment, processor, rights, and security program                       |
| Texas                | TDPSA effective July 1, 2024; SCOPE effective September 1, 2024; SB 2420 effective January 1, 2026         | CUBI gate; SB 2420 injunction stay/release-scope gate; SCOPE Skin Notes/minor classification                       |
| Utah                 | Utah Consumer Privacy Act effective December 31, 2023                                                      | Revenue-plus-volume threshold monitoring; use stricter national consent/rights baseline                            |
| Vermont              | Comprehensive privacy law effective January 1, 2028; AADC effective January 1, 2027                        | Future laws: consumer-health provisions have no volume threshold; build now and refresh selected-age design review |
| Virginia             | Virginia Consumer Data Protection Act effective January 1, 2023                                            | Threshold monitoring; sensitive consent, assessments, processor contracts, rights                                  |
| Washington           | No comprehensive omnibus equivalent; MHMDA effective                                                       | **Treat health law as covered**; also biometric, breach, subscription, and CPA exposure                            |
| West Virginia        | No effective omnibus identified                                                                            | National baseline; breach, consumer-protection, subscription screen                                                |
| Wisconsin            | No effective omnibus identified                                                                            | National baseline; breach, consumer-protection, subscription screen                                                |
| Wyoming              | No effective omnibus identified                                                                            | National baseline; breach, consumer-protection, subscription screen                                                |

### 7.1 Coverage-monitoring fields

Operations must calculate and preserve monthly, rolling-calendar-year, and
prior-calendar-year values as statutes require:

- consumers and households whose personal data is controlled or processed, by
  state;
- consumers whose data is sold, shared, or used for targeted advertising—the
  product decision is zero, and monitoring must prove it;
- revenue and percentage derived from sale/sharing;
- global and statutory gross-revenue values;
- nonprofit or small-business status and any disqualifying activity;
- sensitive-data processing by state, including transient and inferred data;
- whether processing occurs while a consumer is physically in Washington or
  Nevada;
- public-site and public-link visitors separately from registered users.

Crossing a threshold is not the trigger to start building. The national baseline is
the launch implementation; threshold monitoring is an additional legal-control
record.

### 7.2 Texas app-store and community/minor overlays

#### SB 2420 — App Store Accountability Act

The
[enrolled SB 2420](https://capitol.texas.gov/tlodocs/89R/billtext/html/SB02420F.HTM)
and
[official legislative history](https://capitol.texas.gov/billlookup/History.aspx?Bill=SB2420&LegSess=89R)
establish an effective date of January 1, 2026. The law assigns software
application developers duties that include:

- assign the app and each in-app purchase an age rating using the statutory age
  categories and provide the rating plus the content/elements producing it to each
  app store;
- notify each app store before a significant terms/privacy change, including a
  change to data categories, age rating/content, monetization, or material
  functionality/user experience;
- implement a system using store-provided current age-category and minor-consent
  information;
- use that store signal only for age restrictions/protections, legal compliance,
  and safety features/defaults;
- delete the store-provided personal data when the statutory verification is
  complete and not share or disclose it.

The district court issued universal preliminary injunctions, but the
[Fifth Circuit's published June 4, 2026 order](https://www.ca5.uscourts.gov/opinions/pub/26/26-50001-CV0.pdf)
granted Texas a stay of those injunctions pending appeal. That order did not finally
resolve the merits. The safe launch status is: **effective; injunction litigation
ongoing; universal injunctions stayed pending appeal; counsel must determine the
operative scope on the release date.**

**Gate:** do not assume Apple will perform OnSkin's developer duties. Counsel and
Apple operations must approve the rating, rating rationale, each in-app purchase,
store signal interface, fallback when no signal is available, purpose isolation,
immediate post-verification deletion, logging minimization, and pre-change
notification workflow. The selected OnSkin age threshold may be stricter than a
store category, but it may not misuse or retain the store signal.

#### Texas SCOPE

The Texas Attorney General's
[official SCOPE guidance](https://www.texasattorneygeneral.gov/consumer-protection/file-consumer-complaint/consumer-privacy-rights/securing-children-online-through-parental-empowerment)
states that the Act has been effective since September 1, 2024 and primarily
addresses services with public or semi-public profiles and user content visible to
others. Skin Notes has no ordinary public profile and uses narrow,
human-pre-moderated posting, but those product choices do not establish an
exemption.

**Gate:** Texas/minors counsel must classify every Skin Notes phase before peer
posting and map any operative registration-of-age, agreement, parental-tool,
minor-data minimization/use/sharing, purchase, geolocation, targeted-advertising,
safety, duty-of-care, and algorithmic obligations. If the repo retains 16+, this
classification is directly launch-critical. If it migrates to 18+, bypass and
actual-knowledge handling still require verification. Peer posting remains off
until the written classification and resulting controls pass.

## 8. Biometric and face-imagery gate

### 8.1 Colorado HB 24-1130

Colorado's
[HB 24-1130 status page](https://www.leg.colorado.gov/bills/hb24-1130)
and
[signed act](https://leg.colorado.gov/sites/default/files/2024a_1130_signed.pdf)
show an effective date of July 1, 2025. The amendments extend Colorado Privacy Act
coverage to a controller that controls or processes **any amount** of biometric
identifiers or biometric data, for that processing, even if ordinary CPA volume
thresholds are not met.

The act defines a biometric identifier to include a facial map, facial geometry, or
facial template capable of processing for unique identification. Photographs and
data generated from photographs are excluded from “biometric data” unless used for
identification, but that exclusion does not let engineering self-classify a
face-bound or facial-map result.

If the final implementation controls or processes a covered biometric identifier or
data, the act can require:

- a written biometric policy with a retention schedule, biometric-incident protocol,
  consumer notification process, and deletion guidelines;
- deletion by the earliest statutory trigger, including satisfaction of the initial
  purpose, 24 months after the last interaction, or the annual-review/45-day path
  specified by the act;
- clear notice of collection, specific purpose, retention length, and processor
  disclosure; consent where required;
- no sale, lease, or trade and only permitted disclosure;
- industry-standard protection, consumer rights, and processor incident protocols.

**Gate:** Colorado/privacy counsel must classify the exact transient bounds, APIs,
types, memory lifetime, logs, and test fixtures. If covered, the written policy,
retention/deletion timer, annual review, consumer notice/consent, access/correction,
processor terms, and § 6-1-716 incident/notification path must exist and be tested.
Immediate volatile deletion remains OnSkin's product rule even if a longer
statutory outer limit could be available.

### 8.2 Illinois BIPA

The current
[Illinois Biometric Information Privacy Act](https://www.ilga.gov/Legislation/ILCS/Articles?ActID=3004&ChapterID=57)
regulates collection, capture, purchase, receipt, possession, disclosure, retention,
and destruction of biometric identifiers and biometric information. It includes
scans of face geometry while excluding photographs themselves from the definition
of “biometric identifier.” A derived measurement or template can still change the
analysis. BIPA provides a private right of action.

If BIPA applies, material duties include a publicly available written retention and
destruction policy, written notice of collection/storage and specific purpose and
term, a written release before collection, restrictions on profit and disclosure,
reasonable security, and timely destruction. A 2024 amendment limits accrual for
repeated collection or disclosure using the same method, but it did not eliminate
the duties or private action.

### 8.3 Texas and Washington

[Texas Business & Commerce Code chapter 503](https://statutes.capitol.texas.gov/?artSec=503.001&chapter=BC.503&code=BC&tab=1)
regulates capture of biometric identifiers for a commercial purpose and imposes
notice/consent, disclosure, care, and destruction restrictions.
[Washington RCW chapter 19.375](https://app.leg.wa.gov/RCW/default.aspx?cite=19.375&full=true)
regulates enrollment of biometric identifiers in a database for a commercial
purpose and includes notice/consent, use, disclosure, security, and retention
controls.

### 8.4 OnSkin decision

Transient face bounds used only in volatile device memory to help align a local
photo may be outside one or more biometric definitions, including where data
generated from a photograph is not used or intended for identification, but the
team may not make that legal conclusion itself.

The permitted implementation is:

- use platform-local face/subject bounds only when necessary for the user-requested
  local photo experience;
- never use identity recognition, authentication by face, uniqueness matching, or
  comparison across users or images;
- never create or persist face geometry, an embedding, landmark vector, template,
  signature, or inferred identity;
- never send the photo or derived bounds to OnSkin, analytics, crash, support, AI,
  moderation, or any other server;
- clear all bounds from memory when the operation or screen ends;
- strip metadata before an explicit user-directed share and show exactly what will
  leave the device;
- include a static and runtime test that fails if a photo, local URI, base64 image,
  face result, or image metadata reaches a network/logging boundary.

**Refusal condition:** no persistent biometric derivation, face recognition,
cloud-face analysis, cross-photo comparison, identity matching, or vendor biometric
SDK may be built or enabled until specialist counsel issues a written
Colorado/Illinois/Texas/Washington and other-state determination, every required
policy, retention, incident protocol, and consent is implemented, contracts are
approved, and human-simulated evidence passes. The current launch contract should
instead be amended if such processing becomes essential.

## 9. Automatic renewal, reverse trial, and cancellation gate

California's current
[Business and Professions Code § 17602](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=BPC&sectionNum=17602)
was materially amended for offers entered into, amended, or extended on or after
July 1, 2025. As applicable, it requires clear and conspicuous offer terms near the
consent request, affirmative consent, a retainable acknowledgment, cancellation
that is available through required channels and is not obstructive, and notices
for specified trial, renewal, and fee-change events. The
[California Attorney General alert](https://oag.ca.gov/node/608083)
is an official implementation signal.

State automatic-renewal and negative-option requirements differ on timing,
acknowledgments, reminders, cancellation channels, fee changes, free trials,
material changes, and enforcement. App Store billing does not erase the app's own
marketing and disclosure obligations.

### Required national subscription UX

Before the purchase sheet:

- show the exact product, current price, billing period, whether it auto-renews,
  trial or reverse-trial duration, post-trial price, when charging begins, and how
  to cancel;
- state material eligibility and feature limitations;
- keep terms visually proximate to the affirmative purchase control;
- do not use a free, continue, or start label that conceals an immediate or future
  paid commitment;
- separate privacy/marketing choices from purchase consent;
- preserve the versioned paywall and terms shown, product identifier, locale,
  timestamp, app version, and resulting transaction identifier without storing
  unnecessary payment data.

After purchase:

- provide a durable acknowledgment and Apple's receipt/transaction handling;
- expose Restore Purchases and Manage Subscription from the paywall, account, and
  relevant entitlement state;
- explain that Apple controls billing and provide a direct system management path;
- send only counsel-approved notices and do not imply OnSkin can cancel a
  subscription that Apple controls;
- ensure entitlement loss, billing retry, grace period, refund, upgrade,
  downgrade, restore, device change, and account deletion are truthful.

For account deletion:

- delete the OnSkin account and covered data through the in-app flow;
- clearly warn, before confirmation and again in the completion record, that
  deleting an account does not itself cancel an Apple subscription;
- provide the direct Apple subscription-management route;
- never make account deletion conditional on contacting support.

### Reverse-trial rule

A reverse trial that unlocks paid features and later restricts access is a
high-confusion pattern even if Apple does not charge during the unlocked interval.
It must not imply a free trial that silently becomes paid, misstate current
entitlement, or manufacture urgency.

**Gate:** consumer-protection counsel approves the named product, price architecture,
screen sequence, screenshots, strings, acknowledgment, notification schedule, and
all sandbox outcomes. Engineering proves parity across small/large devices,
VoiceOver, Dynamic Type, offline/retry states, and every entitlement edge case.

## 10. Security, breach, retention, and deletion gate

### 10.1 Reasonable security is a launch feature

The strict baseline must include:

- a current data-flow diagram and field/event inventory covering device, API,
  database, logs, notifications, support, analytics, crash, build, and backups;
- encryption in transit and at rest, plus documented local photo encryption and
  key lifecycle;
- per-user ownership and row-level authorization tested against cross-account
  access, export, update, and deletion;
- least-privilege service roles, production admin RBAC, phishing-resistant MFA,
  just-in-time access where feasible, and audited privileged actions;
- separate development, staging, and production environments with no production
  data copied into lower environments;
- secret management, key rotation, dependency scanning, static analysis, secure
  review, rate limits, abuse protection, and a vulnerability intake;
- encrypted, access-controlled backups with restoration and deletion tests;
- logging that records security facts without health content, Ask text, photos,
  tokens, credentials, or full request/response bodies;
- release provenance, dependency inventory, rollback/kill switches, and a tested
  incident command process;
- an independent penetration test scoped to mobile, API, Supabase authorization,
  public links, admin tooling, account recovery, export, and deletion.

The
[New York SHIELD Act guidance](https://ag.ny.gov/resources/organizations/data-breach-reporting/shield-act)
and
[Massachusetts 201 CMR 17.00](https://www.mass.gov/regulations/201-CMR-1700-standards-for-the-protection-of-personal-information-of-ma-residents)
reinforce administrative, technical, physical, service-provider, access,
encryption, disposal, and written security-program expectations even where an
omnibus threshold is not met.

### 10.2 Incident and notification matrix

All 50 states and DC have breach-notification regimes, with different covered-data
definitions, harm/risk tests, regulator and consumer recipients, timing, content,
credit-reporting thresholds, and law-enforcement procedures. HBNR is an additional
track, not a substitute.

The incident process must:

1. open a timestamped incident on the first signal;
2. contain without destroying evidence;
3. identify affected systems, people, states, data elements, encryption status,
   unauthorized acquisition/disclosure, vendors, and discovery date;
4. notify security/privacy counsel and the designated HBNR official immediately;
5. run HBNR, each state, contract, Apple, insurer, and law-enforcement analyses in
   parallel, including CMIA if classified and Colorado's biometric policy,
   processor-notice, and § 6-1-716 path for any biometric incident;
6. meet the shortest applicable deadline, not default to HBNR's 60-day outer limit;
7. preserve decision evidence and approved communications;
8. complete root-cause, remediation, affected-data deletion/rotation, and
   post-incident testing.

Vendor contracts should require notice to OnSkin without undue delay and target
24 hours from discovery, with continuing updates, affected-data detail,
preservation, cooperation, and no unauthorized public statement. That contractual
target is not a claim that every statute uses 24 hours.

Examples of state-specific timing and regulator operations include the
[Texas Attorney General breach portal](https://www.texasattorneygeneral.gov/consumer-protection/data-breach-reporting)
and California's
[Civil Code breach provisions](https://www.leginfo.legislature.ca.gov/faces/codes_displayText.xhtml?division=3.&chapter=1.&part=4.&lawCode=CIV&title=1.81.5).
Counsel must produce the operative 51-jurisdiction matrix; engineering must not
derive notice duties from these examples alone.

### 10.3 Retention schedule

No production launch may use “retain as long as necessary” as the only operational
rule. A field-level schedule must name the purpose, system of record, trigger,
active-system target, backup target, processor target, legal/security exception,
owner, and verification method.

Minimum decisions:

| Data class                                       | Required retention decision                                                                                                                                                                                                          |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Photos and metadata                              | Device-local only; user deletion removes ciphertext, thumbnails, keys/references, and derived transient state; if Colorado biometric law applies, immediate volatile deletion plus its written schedule/annual review must be proved |
| Health profile and consent-governed content      | Retain only while required for the requested service and valid consent; withdrawal stops optional future processing immediately; CMIA schedule/segregation controls apply if counsel classifies coverage                             |
| Texas app-store age/consent signal               | Use only for statutory age/safety verification and delete on completion of that verification; no analytics, profile enrichment, or general age-history reuse                                                                         |
| Shelf, routines, cycles, adherence, and trends   | User-controlled lifecycle; delete with account/rights request unless a narrowly documented exception applies                                                                                                                         |
| Ask inputs and outputs                           | Default to no provider training; define whether history is local or cloud; short, named operational retention only after counsel/vendor approval                                                                                     |
| Community content                                | Named lifecycle plus user deletion/moderation rules; preserve only when a documented safety/legal basis requires it                                                                                                                  |
| Subscription records                             | Minimum transaction/entitlement evidence needed for service, accounting, fraud, tax, and disputes under counsel/accountant schedule                                                                                                  |
| Analytics and crash data                         | Short, configured period; prohibited health/content fields never enter the system; anonymous/aggregate claims must be technically justified                                                                                          |
| Consent, rights, security, and incident evidence | Separated, access-restricted proof retained for a counsel-defined limitations/compliance period; do not retain underlying content merely as “proof”                                                                                  |
| Backups                                          | Deletion propagation and expiry documented; consumer-health deletion completed no later than Washington's six-month backup allowance                                                                                                 |
| Vendor copies                                    | Same or shorter approved schedule; deletion/return and written acknowledgment contractually required                                                                                                                                 |

Exact day counts, other than a binding statutory outer limit, are deliberately not
invented here. Counsel and operations must approve a schedule the systems can
actually enforce, then the public policies must state it accurately.

### 10.4 Rights and account deletion

The rights service must support:

- intake in app and on the public website;
- authentication proportionate to the request without forcing a person to create a
  new account;
- agent/authorized-agent handling where required;
- confirmation, access, correction, portable export, deletion, consent withdrawal,
  opt-out, and appeal;
- a 45-day operational response target nationally, with only a lawfully permitted
  extension and timely notice;
- processor and third-party propagation, retries, acknowledgments, and exceptions;
- accessibility, identity-mismatch, lost-account, deceased-user, abuse, and
  duplicate-request procedures;
- a response log that proves dates and disposition without retaining unnecessary
  health data;
- in-app account deletion meeting Apple's requirements.

Deletion must remove or irreversibly deidentify data in every active system,
invalidate public/share links, revoke sessions and access tokens, stop queued jobs,
propagate downstream, and place backup records on a verified expiry path.
“Deidentified” is not a label: counsel and engineering must document the technical
and contractual controls that prevent reidentification.

## 11. Exact OnSkin data and feature risk map

| Feature or data path                  | Principal data/risk                                                      | Mandatory launch control                                                                                                          |
| ------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Account, Sign in with Apple, sessions | Identifier, relay email, tokens, device/account link; account mix-up     | Data minimization, token security, owner namespace, recovery policy, in-app deletion, Apple token revocation                      |
| Age gate and onboarding               | Current repo 16+; proposed 18+ migration; store age/consent signal       | Founder/counsel select threshold; reconcile all sources/build; reject below it; SB 2420 purpose-limit/delete store signal         |
| Health profile                        | Pregnancy/TTC/breastfeeding, sensitivities, reactions, concerns          | Sensitive/consumer-health plus California CMIA classification; explicit purpose consent; confidentiality, withdrawal, deletion    |
| Shelf/manual intake                   | Product names, barcodes, open dates, use can infer condition/treatment   | Minimize; local-first; no advertising use; catalog source/provenance; deletion/export                                             |
| Barcode and OCR                       | Camera/image/text may capture unintended surroundings or identifiers     | On-device/ephemeral processing; discard frames; no gallery upload; clear permission and fallback                                  |
| Catalog/search                        | Queries and selected products can reveal health concerns                 | Avoid raw query analytics; purpose-bound provider; source quality and claims review                                               |
| Conflict engine                       | Health inference and safety recommendation                               | Reviewed deterministic rules/provenance; no diagnosis; uncertainty and escalation copy; safety QA                                 |
| Routine builder                       | Product/condition pattern and schedule                                   | Local-first; explicit sync boundary; access/export/deletion; no ad targeting                                                      |
| Today/adherence                       | Sensitive behavioral history and inferred condition                      | No streak shame/dark patterns; local-first; minimal notifications; no sensitive lock-screen text by default                       |
| Cycle/ramp scheduler                  | Reaction/tolerance inference, bodily/health routine                      | Reviewed safety logic; no treatment claim; user control; change-log and tests                                                     |
| Progress photos                       | Face/skin imagery, metadata, biometric and intimate-image risk           | Encrypted device-local; Colorado/IL/TX/WA biometric classification; transient bounds; no embeddings/cloud/logging; explicit share |
| Reminders                             | Timing and lock-screen text can reveal condition or product use          | Generic default text; opt-in OS permission; preview controls; cancel on withdrawal/deletion                                       |
| Subscriptions                         | Purchase history, receipt, negative option, entitlement                  | Clear terms/consent; Apple billing; receipt minimization; restore/manage; deletion warning; state counsel review                  |
| Reverse trial                         | Confusion/manipulation risk even without immediate charge                | Truthful entitlement and timing; no concealed conversion; separately counsel-approved UX                                          |
| Recommendations                       | Sensitive inference, medical-condition management, claim, affiliate bias | California CMIA/AI classification; consent/necessity analysis; evidence; explain ranking; commission-independent scoring          |
| Ask cloud                             | Free text may include diagnoses, medications, images, minors, crises     | Default off; CMIA/health-AI gate; separate consent; no image/training; redaction, safety, retention/deletion, provider contract   |
| Share conflict cards                  | Health inference may be exposed through public link or share sheet       | Explicit user action; preview; minimal content; revocable/expiring link if hosted; no trackers                                    |
| Commerce/replenishment                | Product/health interest, purchase intent, affiliate disclosure           | No sensitive targeting; adjacent commission disclosure; independent ranking; minimal click telemetry                              |
| Community/Skin Notes                  | Public health/UGC, harassment, minors, illegal or intimate content       | Selected age gate; Texas SCOPE classification; no before/after; public no-account TIDA intake; moderation/report/block            |
| Trend insights                        | Sensitive health inference, risk of objective efficacy claim             | On-device where possible; transparent methodology; no percentage-improvement or diagnostic claim; consent/assessment              |
| Widgets/Live Activities               | Sensitive content outside app and on lock screen                         | Generic privacy-safe default; explicit configuration; redact while locked; revoke on sign-out/withdrawal                          |
| Analytics and experiments             | SDK identifiers/events can disclose health use                           | Consent where required; allowlist only; no autocapture/replay/ad ID/content; IP masking; event-schema CI tests                    |
| Crash/performance                     | Screenshots, view trees, requests, logs may contain health/photo data    | PII/content scrubbing; screenshots/view hierarchy/request bodies off; sampled allowlist; verified release traffic                 |
| Admin/support                         | Insider access, exports, impersonation, free-text disclosures            | Least privilege/MFA/audit; no silent impersonation; approved support upload; redaction; retention and escalation                  |
| Public/creator links                  | Unauthenticated access, tracking, search indexing, accidental disclosure | No health/person identifiers; no trackers based on sensitive use; expiry/revocation; robots/cache review                          |
| Growth/referrals                      | Contacts, attribution, health-linked audience risk                       | No address-book upload; no sensitive audience/retargeting; consent and anti-spam review                                           |

### 11.1 Prohibited claims and uses

The following remain prohibited unless the product contract is formally amended and
specialist review establishes a lawful, substantiated path:

- diagnosis, treatment, cure, mitigation, prevention, or medical-device claims;
- AI skin scores, “skin age,” disease probability, or percentage improvement;
- a claim that pregnancy, allergy, conflict, or ingredient guidance is complete or
  medically authoritative;
- cloud photo diagnosis or analysis;
- public before/after photo feeds;
- sale, brokerage, targeted advertising, or model training using health/photo data;
- commission-driven recommendation ranking;
- undisclosed sponsored, affiliate, creator, or testimonial relationships;
- “HIPAA compliant,” “legally compliant,” “anonymous,” “secure,”
  “Apple approved,” or “doctor approved” without precise, current, reviewed proof.

## 12. Engineering launch gates

Every control below requires code, automated tests, release-build observation, and
durable evidence. A design or TODO is not acceptance.

### USW1-ENG-01 — Authoritative data inventory

- Generate a versioned schema of every collected, derived, inferred, logged,
  cached, synchronized, exported, notified, and processor-shared field/event.
- Include transients such as OCR frames, face bounds, IP addresses, push tokens,
  deep links, clipboard/share artifacts, and failed requests.
- Map source, purpose, legal/consent basis for counsel, destination, region,
  retention, deletion, and feature owner.
- Diff the inventory in CI when schema, SDK, permissions, or network hosts change.

**Pass evidence:** repository inventory plus release-build network/storage trace
signed by engineering and reviewed by privacy owner.

### USW1-ENG-02 — Consent ledger and enforcement

- Separate health collection, health sharing, Ask, optional cloud processing,
  user-directed sharing/publication, analytics where required, and marketing.
- Record policy/notice version and hash, categories, purpose, recipient categories,
  locale, app version, timestamp, choice, and withdrawal.
- No prechecked choice, bundled terms consent, coerced optional consent, or
  consent-wall for a function that does not need the data.
- Enforce current consent at UI, mutation, queue, edge function, job, export, and
  processor boundary.
- Withdrawal immediately stops new optional collection/sharing and cancels queued
  jobs, then begins deletion propagation.

**Pass evidence:** positive, refusal, partial-consent, stale-version, offline,
reinstall, cross-device, withdrawal-race, and processor-failure tests.

### USW1-ENG-03 — Analytics and crash allowlist

- PostHog, Sentry, or replacements are disabled until approved configuration and
  consent state load.
- Disable autocapture, session replay, screenshots, view hierarchy, failed-request
  bodies, ad identifiers, sensitive URL/query parameters, and unrestricted custom
  properties.
- Forbid pregnancy/status, concern, product/routine detail, adherence, Ask/community
  text, photos/URIs/base64, health result, email, full user ID, and precise location.
- Use a centrally typed event allowlist with runtime dropping/redaction and CI tests.
- Mask/minimize IP and use only counsel/vendor-approved region and retention.

**Pass evidence:** static scan plus proxy capture of every target flow in a signed
release build, including error paths.

### USW1-ENG-04 — Photo and biometric network denial

- Encrypted local vault, account namespace, key lifecycle, app-lock behavior, and
  thumbnail/cache cleanup.
- A single explicit user share/export path with preview and metadata stripping.
- No network-capable component accepts the photo type or local URI.
- Bounds/landmarks remain volatile, non-identifying, and are cleared.
- Tests fail builds on image multipart, base64, URI, metadata, screenshot, log, or
  SDK attachment.

**Pass evidence:** device tests, proxy capture, filesystem/cache inspection,
account-switch/reinstall/backup tests, Colorado policy/retention/incident evidence if
applicable, and counsel's Colorado/Illinois/Texas/Washington classification.

### USW1-ENG-05 — Rights, export, and deletion orchestrator

- In-app and web intake with identity verification and no forced new account.
- Machine-readable and human-readable export covering all entitled data and sources.
- Atomic account lock/revocation, job cancellation, active deletion, downstream
  propagation, public-link invalidation, and backup expiry.
- Per-processor receipts, retries, dead-letter escalation, exception reason, and
  completion record.
- National 45-day timer, permitted-extension workflow, and appeal/intake.
- Apple subscription warning and direct manage-subscription route remain separate
  from account deletion.

**Pass evidence:** seeded full-account end-to-end deletion/export, processor-failure
recovery, backup expiry simulation, owner-isolation test, and operations exercise.

### USW1-ENG-06 — Tenant isolation and privileged access

- Row-level policies and server authorization for every user-owned table/object;
  client-supplied owner IDs are never trusted.
- Cross-account create/read/update/delete/export tests, stale token tests, public
  link enumeration tests, and service-role boundary tests.
- Admin MFA/RBAC, reason/ticket, time-bound elevation, audit, and no unlogged
  impersonation.

**Pass evidence:** automated policy tests, independent penetration report, and
remediated findings.

### USW1-ENG-07 — Age and minor controls

- Record the founder/counsel decision between the current 16+ contract and proposed
  18+ migration; amend every authoritative doc, constant, policy, rating, community
  rule, test, API guard, and reviewer artifact to the exact same threshold.
- Reject users below that selected threshold before account and sensitive
  processing.
- Do not persist full birth date absent approved necessity.
- Prevent bypass through deep links, restore, offline state, public posting,
  invite/referral, or API calls.
- Provide a restricted/deletion path when actual knowledge arises.
- Consume a Texas SB 2420 store-provided age category and consent signal only through
  a separately typed, purpose-limited verification component; delete the supplied
  personal data when verification completes and forbid analytics/profile reuse.
- Assign and substantiate the app and in-app-purchase ratings and block a material
  change until the required app-store notice workflow completes.

**Pass evidence:** source-of-truth diff and archived binary inspection; boundary-age,
store-signal/purpose/deletion, rating, material-change, locale/time-zone,
accessibility, offline, API, deep-link, and actual-knowledge operations tests.

### USW1-ENG-08 — Location prohibition

- No iOS location usage description, location permission, location SDK, or stored
  precise coordinate.
- No health-related geofence logic.
- Inventory network-IP handling at CDN, auth, API, analytics, crash, AI, and support;
  mask and shorten it where technically available.

**Pass evidence:** native permission/config scan, release traffic, vendor
configuration screenshots/export, and geofence code scan.

### USW1-ENG-09 — Paywall and entitlement correctness

- Server/store-authoritative entitlement, idempotent webhooks, replay protection,
  environment separation, and receipt/transaction minimization.
- Clear pre-purchase material terms and affirmative purchase control.
- Restore and manage-subscription available without obstruction.
- Correct grace, retry, refund, revoke, family/account, sign-out, reinstall,
  offline, and account-deletion states.

**Pass evidence:** Apple sandbox matrix, screenshots, accessibility test,
transaction logs, and consumer-protection review.

### USW1-ENG-10 — Community safety and legal operations

- Posting is restricted to the selected, reconciled launch threshold and has no
  public before/after imagery.
- Report, block, moderation, appeal, preservation, takedown, and emergency paths.
- Public TAKE IT DOWN intake requires no OnSkin account and validates the statutory
  signature, attestation, contact, and request information; a 48-hour operational
  timer applies to valid requests if covered, with known-identical-copy
  discovery/removal.
- Skin Notes stays off until Texas SCOPE counsel classifies each phase and required
  age, minor-data, parental, safety, purchase, advertising, geolocation, and
  algorithmic controls pass.
- Public content deletion and link/cache invalidation.
- Moderator tools expose only necessary content and audit every action.

**Pass evidence:** seeded abuse/takedown exercises, moderator coverage record,
public policy links, counsel classification, and human-simulated E2E.

### USW1-ENG-11 — Commerce and claim provenance

- Adjacent commission disclosure on every relevant link and recommendation surface.
- Recommendation score excludes compensation and records inputs/version.
- No sensitive-data retargeting, pixels, or affiliate sub-IDs that encode health.
- Every safety, efficacy, compatibility, comparative, testimonial, and ingredient
  claim maps to approved evidence and expiry.

**Pass evidence:** UI/network crawl, ranking determinism test, claims register, and
marketing/legal signoff.

### USW1-ENG-12 — Vendor kill switches

- Every optional vendor path defaults off until contract, configuration, consent,
  and production review pass.
- Kill switches operate server-side and client-side without requiring an App Store
  update.
- Failure is private and safe: no fallback to an unapproved vendor or local sensitive
  logging.
- Provider/model changes reopen review.

**Pass evidence:** production-like disabled/enabled/failure drills and network-host
allowlist tests.

### USW1-ENG-13 — Apple privacy and platform alignment

- Build privacy labels from observed release-build data, including every third-party
  SDK and linked website.
- Keep the privacy policy URL public, stable, accurate, and available in app.
- Complete privacy manifests and required-reason API declarations from final
  binaries.
- In-app account deletion, Sign in with Apple token revocation, purchase disclosure,
  restore, and health-data restrictions work in the submitted build.
- Reconcile the Texas SB 2420 app/in-app-purchase rating, content rationale,
  store-provided age/consent signal, purpose limitation, deletion, and
  significant-change notice workflow with App Store Connect and the archived build.

**Pass evidence:** archived build inspection, App Store Connect export/screenshots,
policy version, and Apple acceptance matrix.

### USW1-ENG-14 — Security and incident readiness

- Complete the controls in Section 10, remediate high/critical findings, and accept
  residual risks explicitly.
- Alert on tenant violations, unusual exports/admin access, credential abuse,
  unexpected sensitive events, and vendor incidents.
- Preserve minimum necessary forensic evidence without silently expanding content
  logging.
- Exercise California CMIA response if classified and Colorado biometric
  consumer/processor incident and notification paths if applicable.

**Pass evidence:** pen test, dependency/SAST results, backup restore, incident
tabletop, alert drill, and signed residual-risk register.

### USW1-ENG-15 — California CMIA implementation

- Maintain a field/feature classification showing what is and is not CMIA medical
  information and why, tied to counsel's § 56.06 decision.
- If covered, enforce approved confidentiality, authorization, purpose-change,
  access, disclosure, segregation/location, contractor, retention, and incident
  rules at device, API, queue, admin, export, analytics, AI, and vendor boundaries.
- Fail closed for any feature or data flow not included in the written decision.

**Pass evidence:** counsel-approved data map, authorization and purpose-change
tests, release-build network/storage trace, rights output, vendor evidence, and
CMIA incident exercise.

## 13. Operations launch gates

### USW1-OPS-01 — Public policies and notices

Counsel-approved, mutually consistent, public, accessible versions of:

- general privacy policy;
- consumer-health data privacy policy;
- CMIA notices/authorizations and California reproductive-health handling if
  counsel classifies coverage;
- terms of use;
- subscription/automatic-renewal terms and acknowledgment;
- community guidelines, moderation/reporting, and appeals;
- TAKE IT DOWN notice/removal process if covered;
- copyright/DMCA process and registered agent if safe harbor is relied on;
- affiliate/sponsorship disclosure;
- rights-request, appeal, and authorized-agent instructions;
- support, security, and vulnerability-reporting contact routes.

The exact legal entity name, postal address, monitored email, effective date,
categories, purposes, sources, recipients, retention, rights, and change process
must match production.

### USW1-OPS-02 — Privacy request operation

- named privacy owner and trained backup;
- daily monitored intake, authentication decision tree, 45-day timer, escalation,
  appeal, extension, agent, and denial templates;
- live vendor contact map and processor deletion instructions;
- monthly sampled export/deletion quality review;
- accessible support for users unable to use the self-service path;
- request metrics that contain no unnecessary request content.

### USW1-OPS-03 — Written information-security program

- executive owner, risk assessment, asset/vendor inventory, safeguards, training,
  access review, secure development, change management, vulnerability management,
  backup/recovery, incident response, and annual review;
- workforce confidentiality and role-based access;
- vendor due diligence and contract review before access;
- documented remediation and residual-risk acceptance.

### USW1-OPS-04 — Incident response

- 24/7 escalation contact, outside privacy/security counsel, insurer, forensics, PR,
  and vendor contacts;
- current HBNR and 51-jurisdiction breach decision matrix;
- California CMIA and Colorado biometric incident/notification branches if
  applicable;
- approved evidence-preservation and notification templates;
- tabletop scenarios for SDK health disclosure, cross-tenant export, stolen admin
  token, public-link leak, lost encrypted backup, vendor breach, and support error;
- post-incident review and control tracking.

### USW1-OPS-05 — Vendor governance

No vendor receives production credentials or data before:

- legal entity, service, data, purpose, region, transfer, subprocessors, and
  retention are recorded;
- security evidence and privacy terms are approved;
- a DPA and service terms bind processing to instructions and prohibit sale,
  advertising, independent use, and model training as applicable;
- rights assistance, deletion/return, audit evidence, incident timing, government
  request, subprocessor notice/objection, and exit are addressed;
- configuration is exported/screenshotted and independently verified;
- an owner and kill switch exist.

This applies to Supabase, RevenueCat, Apple, CDN/email, PostHog, Sentry, bot
protection, AI, link attribution, commerce/affiliate, support, moderation, and any
contractor tool. A candidate-vendor decision packet is not an executed contract.

### USW1-OPS-06 — Claims, catalog, and recommendation governance

- qualified claims reviewer and escalation clinician/toxicology/pharmacology
  resource appropriate to the claim;
- exact-copy claims register with evidence, source quality, version, owner, expiry,
  surfaces, and prohibited implications;
- catalog provenance, corrections, recall/safety update, and user-report process;
- no automatic promotion of user/community claims into product guidance;
- versioned recommendation/conflict rules and urgent correction/kill switch.

### USW1-OPS-07 — Community coverage

- trained moderators with defined hours and escalation coverage;
- selected age threshold reconciled across policy and operations, plus a written
  Texas SCOPE classification for each enabled Skin Notes phase;
- prohibited-content taxonomy, report priorities, response targets, evidence
  handling, appeals, repeat-offender controls, and transparency metrics;
- emergency, self-harm, child-safety, illegal-content, intimate-image, harassment,
  doxxing, fraud, product-harm, and copyright playbooks;
- no promise of always-on or medical monitoring unless actually staffed.

### USW1-OPS-08 — Threshold, law, and change monitoring

- monthly state/user/revenue/sale metrics from Section 7;
- quarterly legal-change review and mandatory review 30 days before any future
  effective date;
- immediate review for new vendor, data field, inference, permission, model,
  region, marketing channel, public surface, pricing, or jurisdiction;
- Texas SB 2420 pre-change routing before any material data-category, rating/content,
  monetization, terms/privacy, functionality, or user-experience change;
- 2026-session/codification reconciliation for every state source that was not yet
  published as a final 2026 code at the research cutoff;
- dated source register and counsel update before App Store submission and public
  launch.

## 14. Required external professional gates

These items are **external pending** and cannot be self-certified by engineering:

1. US privacy/consumer-health counsel confirms entity facts, product classification,
   WA/NV/CT coverage, California CMIA, 50-state omnibus screen, consent, rights,
   policies, processor contracts, retention, geolocation, security, and breach
   matrix.
2. Biometric/privacy counsel classifies transient face bounds under Colorado,
   Illinois, Texas, Washington, and other applicable law and approves the exact
   implementation or requires their removal.
3. Consumer-protection/subscription counsel reviews the full paywall, reverse trial,
   renewals, notices, cancellation/manage-subscription, deletion warning, and
   marketing across applicable states.
4. Product/advertising counsel reviews claims, substantiation, testimonials,
   creators, affiliate disclosure, ranking, and commerce.
5. UGC/platform counsel classifies community duties under TAKE IT DOWN, DMCA,
   Section 230, Texas SCOPE, state law, and law-enforcement/emergency processes.
6. Security/privacy counsel approves HBNR classification, the 51-jurisdiction
   incident matrix, insurer coordination, and exercised playbook.
7. Qualified tax/accounting advice validates subscription records and retention
   required for tax, refunds, chargebacks, and accounting.
8. Apple/App Store operational review validates the final binary, metadata, privacy
   labels, subscription configuration, account deletion, Sign in with Apple, export
   compliance, Texas SB 2420 rating/signal/change controls, and reviewer notes. This
   cannot guarantee approval.
9. Founder and minors/privacy counsel select 16+ or the proposed 18+ migration and
   approve proof that every source-of-truth document, code path, policy, store
   artifact, community rule, and release test uses that exact threshold.

Each approval must identify the reviewer, credentials/role, exact artifact and
version, assumptions, jurisdictions, exceptions, open questions, date, and renewal
trigger. “Looks good,” a generic template, or an undated email is not acceptance.

## 15. Absolute refusal and no-go conditions

The release owner must refuse production launch, staged enablement, or reviewer
submission if any condition below is true:

1. A required all-features contract item lacks its code, operations, vendor, or
   professional gate, unless the authorized owner formally amends the launch
   contract and disclosures.
2. Policies, App Store privacy answers, consent text, or marketing differ from
   observed production behavior.
3. Any photo, photo metadata, face bound, embedding, screenshot, or local photo URI
   can reach a network, log, analytics, crash, support, AI, or backup path outside
   the explicit approved user-share flow.
4. Health data can be sold, used for targeted advertising, sent through ad pixels,
   supplied to a data broker, or used for provider model training.
5. Analytics or crash tooling can capture sensitive content, unrestricted
   properties, autocapture, replay, screenshots, view hierarchy, or request bodies.
6. Health collection/sharing consent is bundled, prechecked, coerced, stale,
   inaccurate, or unenforced at a backend/queue/vendor boundary.
7. Withdrawal, export, correction, deletion, appeal, or downstream propagation is
   missing, misleading, untested, or cannot meet the approved schedule.
8. Cross-account access, stale-token access, public-link enumeration, or
   unauthorized privileged access remains possible.
9. An unapproved vendor, contract, subprocessor, region, retention, or production
   credential remains.
10. The age threshold remains inconsistent: the current repo is 16+, the proposed
    migration is 18+, or any source-of-truth document, code path, policy, rating,
    community rule, API, test, or archived build disagrees with the selected value.
11. The Texas SB 2420 rating/rationale, store age/consent signal, purpose limitation,
    post-verification deletion, or significant-change notice path is unclassified,
    missing, or untested for the operative release-date scope.
12. Community lacks Texas SCOPE classification, trained coverage, reporting/blocking,
    public no-account TIDA intake and validation, urgent removal, or illegal/safety
    escalation.
13. California CMIA coverage remains unclassified or any required authorization,
    confidentiality, access, disclosure, purpose-change, segregation, security,
    retention, incident, or contractor control is missing.
14. Colorado/Illinois/Texas/Washington biometric classification remains open, or a
    required Colorado written policy, retention/deletion, consent, processor, rights,
    or incident control is missing.
15. A precise-location permission, health geofence, biometric template,
    recognition, persistent face derivation, or cloud-photo analysis exists.
16. The subscription price, period, renewal, trial/reverse-trial, cancellation, or
    entitlement is unclear or fails any tested state.
17. A diagnostic, treatment, prevention, objective efficacy, “skin age,” AI score,
    or percentage-improvement claim appears.
18. Commission influences ranking or a material connection is not clearly disclosed
    at the decision point.
19. HBNR/state/CMIA/biometric incident response, WISP, penetration test, backup
    restore, and incident tabletop evidence are missing or have unresolved
    high/critical issues.
20. Counsel has not refreshed this packet for the actual launch date and facts.
21. Anyone asks the team to claim guaranteed legality, HIPAA status, anonymity,
    security, Apple acceptance, or medical authority without qualified written
    support.

Schedule pressure, sunk cost, beta feedback, revenue targets, or a prior App Store
approval do not override a refusal condition.

## 16. Launch acceptance register

Every `USW1-*` identifier below is a **packet-local evidence label**, not one of
the authoritative plan's 202 work-item IDs. Do not add or copy it into
`execution-status.json`. Attach the evidence to the mapped canonical work items;
their statuses and dependencies remain authoritative. A packet-local state is a
legal-workstream signal only and cannot complete a canonical task.

| Packet-local ID   | Required acceptance evidence                                                                                          | Canonical plan mapping         | Owner                       | State now        |
| ----------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------ | --------------------------- | ---------------- |
| USW1-LAW-01       | Dated counsel coverage memo for federal, 50 states/DC, CMIA, health, biometric, minors, subscription, UGC             | H-07, REV-02, REV-03           | Founder/counsel             | External pending |
| USW1-LAW-02       | Final counsel-approved privacy, health, terms, subscription, community, affiliate, rights notices                     | REV-02, REV-03, UGC-01, COM-02 | Founder/counsel             | External pending |
| USW1-LAW-03       | HBNR classification and 51-jurisdiction breach matrix                                                                 | REV-03, OPS-05, OPS-06         | Security/privacy counsel    | External pending |
| USW1-DATA-01      | Field/event/vendor data inventory reconciled to release traffic and storage                                           | REV-03, QA-06, ACCT-16         | Engineering/privacy         | Blocked          |
| USW1-DATA-02      | Approved field-level retention and deletion schedule                                                                  | REV-03, OPS-04, ACCT-16        | Privacy/counsel/engineering | Blocked          |
| USW1-CONSENT-01   | Unbundled versioned consent ledger and fail-closed enforcement tests                                                  | REV-03, OPS-04, QA-06          | Engineering                 | Blocked          |
| USW1-RIGHTS-01    | Export/correct/delete/withdraw/appeal orchestration and processor receipts                                            | OPS-04, DB-10                  | Engineering/operations      | Blocked          |
| USW1-PHOTO-01     | Local-photo network denial, encryption, lifecycle, share, and account-boundary evidence                               | PHOTO-01–PHOTO-07, QA-06       | Engineering/security        | Blocked          |
| USW1-CA-CMIA-01   | Written § 56.06/data classification plus implemented CMIA control evidence if covered                                 | H-07, REV-03                   | California counsel/product  | External pending |
| USW1-BIO-01       | Written Colorado/Illinois/Texas/Washington classification plus Colorado policy/retention/incident evidence if covered | H-07, PHOTO-03, REV-03         | Biometric counsel/security  | External pending |
| USW1-ANALYTICS-01 | Allowlist, consent, region, retention, redaction, and release proxy evidence                                          | OPS-01, OPS-02, QA-06          | Engineering/privacy         | Blocked          |
| USW1-SEC-01       | WISP, threat model, security controls, alerting, access review, pen test remediation                                  | OPS-03, OPS-07, QA-07          | Security                    | Blocked          |
| USW1-IR-01        | HBNR/state/vendor incident tabletop and contact readiness                                                             | OPS-05, OPS-06, DB-11          | Security/operations/counsel | Blocked          |
| USW1-VENDOR-01    | Executed agreements and verified configurations for every production processor                                        | ACCT-16, V-02, REV-03          | Founder/privacy/security    | External pending |
| USW1-PAY-01       | Final pricing/reverse-trial legal review and Apple sandbox lifecycle matrix                                           | PAY-01, PAY-04–PAY-07, REV-02  | Product/counsel/engineering | Blocked          |
| USW1-CLAIMS-01    | Exact-copy substantiation and provenance register                                                                     | REV-02, REV-04, REV-05         | Product/qualified reviewers | Blocked          |
| USW1-COMMERCE-01  | Affiliate disclosure, ranking independence, and no-sensitive-tracking evidence                                        | COM-02, COM-05, COM-07         | Product/legal/engineering   | Blocked          |
| USW1-UGC-01       | Community moderation, public no-account TIDA/DMCA classification, takedown drill, escalation coverage                 | UGC-01, UGC-03–UGC-05          | Trust & Safety/counsel      | Blocked          |
| USW1-TX-SCOPE-01  | Written Skin Notes SCOPE classification and resulting minor/community controls                                        | H-07, UGC-01, UGC-05           | Texas counsel/product       | External pending |
| USW1-TX-APP-01    | SB 2420 release-scope opinion plus rating, store-signal, purpose/deletion, and change-notice evidence                 | H-07, STORE-03, STORE-04       | Texas counsel/release       | External pending |
| USW1-MINOR-01     | Founder/counsel selects 16+ or proposed 18+; every source/build matches; bypass and actual-knowledge tests            | H-07, UGC-01, STORE-03         | Product/engineering/counsel | Blocked          |
| USW1-APPLE-01     | Final binary privacy-manifest/label/account-deletion/subscription/SB 2420 acceptance matrix                           | IOS-09, STORE-03, STORE-04     | Release/privacy             | Blocked          |
| USW1-E2E-01       | Human-simulated critical-flow evidence on supported real app surfaces                                                 | QA-03, QA-04                   | QA/release                  | Blocked          |
| USW1-GO-01        | Founder signs go/no-go only after all prerequisites are complete and current                                          | H-12, STORE-08, STORE-10       | Founder                     | Blocked          |

### Final release decision rule

US Wave 1 may move from **blocked** to a release candidate only when every applicable
acceptance row is complete with durable evidence, every external opinion matches the
actual release candidate, all refusal conditions are false, and the authoritative
launch contract/readiness system agrees. Any later material change returns the
affected gates to blocked.

## 17. Apple is a separate, nonlegal acceptance layer

Apple review does not establish compliance with law, and legal review does not
establish Apple acceptance. The release must pass both independent layers.

The current
[App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
require accurate metadata and functionality; clear subscription terms; a privacy
policy in App Store Connect and in the app; consent, minimization, security, and
respect for permission settings; in-app account deletion when account creation is
supported; and special care for health/medical data and claims. The final reviewer
notes must explain, without overclaiming:

- OnSkin is a cosmetic skincare organization and education tool, not a diagnostic
  or treatment service;
- pregnancy, sensitivity, conflict, and recommendation copy is bounded and directs
  appropriate questions to a qualified professional;
- progress photos are encrypted and device-local, with no server or AI analysis;
- optional cloud Ask uses no photos, is separately consented, and is fail-closed;
- the exact selected age threshold—16+ or the proposed migration to 18+—matches the
  final binary, policies, community access, and App Store age rating;
- how reviewers can reach and test every required feature and subscription state;
- how account deletion, Apple token revocation, export, restore purchases, and
  manage subscription work;
- why requested permissions are necessary and the manual fallback where relevant;
- how community reporting, blocking, moderation, and deletion work.

Apple's
[App privacy details instructions](https://developer.apple.com/app-store/app-privacy-details/)
require declarations to include data collected by third-party partners. Labels must
be generated from verified production flows, not copied from vendor marketing or a
design document. OnSkin must separately complete applicable SDK privacy manifests
and required-reason API declarations.

Apple's
[account-deletion technical note](https://developer.apple.com/documentation/technotes/tn3194-handling-account-deletions-and-revoking-tokens-for-sign-in-with-apple)
must be applied to Sign in with Apple and account deletion. Apple controls
subscription billing, so deleting an OnSkin account and managing an Apple
subscription remain truthful, distinct actions.

Apple's
[health and fitness developer page](https://developer.apple.com/health-fitness/)
and the App Review Guidelines reinforce that sensitive health/fitness/medical data
must not become advertising, marketing, or unrelated data-mining material.

Texas SB 2420 is a separate state-law layer over app-store operations. OnSkin must
not infer that Apple's platform controls automatically discharge the developer's
rating, content-rationale, store age/consent signal, purpose-limitation,
post-verification deletion, or significant-change notice duties. Conversely, the
app must not invent or retain an Apple age signal that Apple does not provide.
Release engineering and counsel must document the actual supported interface and a
lawful fail-closed path for the release date.

**Apple refusal condition:** do not submit a binary whose privacy labels, manifests,
review notes, screenshots, policy URLs, test account, entitlements, permissions, or
feature flags do not describe the exact archived build and production
configuration, or whose Texas rating/change-control artifacts are incomplete. A
prior build's approval is not evidence for a changed build.

## 18. Primary official source register

All sources below were checked for this planning packet as of the stated cutoff.
The source register is evidence of research, not an opinion that every provision is
quoted or that no other law applies.

### 18.1 Federal statutes, regulations, and regulators

- [FTC Act, 15 U.S.C. § 45](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title15-section45&num=0&edition=prelim)
- [ROSCA, 15 U.S.C. § 8403](https://uscode.house.gov/view.xhtml?req=%28title%3A15+section%3A8403+edition%3Aprelim%29)
- [Health Breach Notification Rule, 16 CFR Part 318](https://www.ecfr.gov/current/title-16/part-318)
- [FTC HBNR final-rule announcement](https://www.ftc.gov/news-events/news/press-releases/2024/04/ftc-finalizes-changes-health-breach-notification-rule)
- [FTC HBNR basics](https://www.ftc.gov/business-guidance/resources/health-breach-notification-rule-basics-business)
- [FTC HBNR compliance guidance](https://www.ftc.gov/business-guidance/resources/complying-ftcs-health-breach-notification-rule-0)
- [FTC mobile-health interactive tool](https://www.ftc.gov/business-guidance/resources/mobile-health-apps-interactive-tool)
- [FTC mobile-health app best practices](https://www.ftc.gov/business-guidance/resources/mobile-health-app-developers-ftc-best-practices)
- [FTC health-products compliance guidance](https://www.ftc.gov/business-guidance/resources/health-products-compliance-guidance)
- [FTC Start with Security](https://www.ftc.gov/business-guidance/resources/start-security-guide-business)
- [FTC GoodRx enforcement](https://www.ftc.gov/news-events/news/press-releases/2023/02/ftc-enforcement-action-bar-goodrx-sharing-consumers-sensitive-health-info-advertising)
- [FTC BetterHelp final order](https://www.ftc.gov/news-events/news/press-releases/2023/07/ftc-gives-final-approval-order-banning-betterhelp-sharing-sensitive-health-data-advertising)
- [FTC COPPA Rule page](https://www.ftc.gov/legal-library/browse/rules/childrens-online-privacy-protection-rule-coppa)
- [2025 amended COPPA Rule publication](https://www.govinfo.gov/content/pkg/FR-2025-04-22/pdf/2025-05904.pdf)
- [FTC COPPA FAQ](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions)
- [FTC 2026 COPPA age-assurance policy statement](https://www.ftc.gov/news-events/news/press-releases/2026/02/ftc-issues-coppa-policy-statement-incentivize-use-age-verification-technologies-protect-children)
- [FTC 2026 negative-option ANPR recording vacatur](https://www.ftc.gov/system/files/ftc_gov/pdf/p064202negativeoptionruleanprm.pdf)
- [FTC current Negative Option Rule page](https://www.ftc.gov/legal-library/browse/rules/negative-option-rule)
- [FTC Endorsement Guides update](https://www.ftc.gov/news-events/news/press-releases/2023/06/federal-trade-commission-announces-updated-advertising-guides-combat-deceptive-reviews-endorsements)
- [FTC endorsement FAQ](https://www.ftc.gov/business-guidance/resources/ftcs-endorsement-guides-what-people-are-asking)
- [FTC TAKE IT DOWN Act guidance](https://www.ftc.gov/business-guidance/resources/complying-take-it-down-act)
- [TAKE IT DOWN Act codification, 47 U.S.C. § 223a](https://uscode.house.gov/view.xhtml?edition=prelim&num=0&req=granuleid%3AUSC-prelim-title47-section223a)
- [DMCA safe-harbor statute, 17 U.S.C. § 512](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title17-section512&num=0&edition=prelim)
- [47 U.S.C. § 230](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title47-section230&num=0&edition=prelim)

### 18.2 Consumer-health, biometric, security, breach, and renewal sources

- [Washington My Health My Data Act, RCW chapter 19.373](https://app.leg.wa.gov/RCW/default.aspx?cite=19.373&full=true)
- [Washington biometric-identifiers law, RCW chapter 19.375](https://app.leg.wa.gov/RCW/default.aspx?cite=19.375&full=true)
- [Nevada NRS chapter 603A](https://www.leg.state.nv.us/NRS/NRS-603A.html)
- [Nevada SB 370 enrolled text](https://archive.leg.state.nv.us/Session/82nd2023/Bills/SB/SB370_EN.pdf)
- [Connecticut 2026 Data Privacy and Security codification](https://www.cga.ct.gov/2026/sup/chap_743jj.htm)
- [Connecticut Attorney General privacy portal](https://portal.ct.gov/AG/Sections/Privacy/The-Connecticut-Data-Privacy-Act)
- [Connecticut Attorney General July 1, 2026 business guidance](https://portal.ct.gov/-/media/ag/press_releases/2026/cdpa-business.pdf?hash=112BB88A1ADEBDEEF4C7E3AC5D426A1C&rev=7c686fc401434d0d8ac900a9e57989f9)
- [California CMIA, Civil Code §§ 56.05–56.06](https://leginfo.legislature.ca.gov/faces/codes_displayText.xhtml?chapter=1.&division=1.&lawCode=CIV&part=2.6.)
- [California Attorney General healthcare-AI legal advisory](https://oag.ca.gov/system/files/attachments/press-docs/Final%20Legal%20Advisory%20-%20Application%20of%20Existing%20CA%20Laws%20to%20Artificial%20Intelligence%20in%20Healthcare.pdf)
- [People v. Glow final judgment and permanent injunction](https://oag.ca.gov/sites/default/files/People%20v.%20Glow%20-%20Final%20Judgment%20and%20Permanent%20Injunction%20-%2007374856.pdf)
- [Colorado HB 24-1130 official status](https://www.leg.colorado.gov/bills/hb24-1130)
- [Colorado HB 24-1130 signed act](https://leg.colorado.gov/sites/default/files/2024a_1130_signed.pdf)
- [Illinois BIPA](https://www.ilga.gov/Legislation/ILCS/Articles?ActID=3004&ChapterID=57)
- [Texas Capture or Use of Biometric Identifier law](https://statutes.capitol.texas.gov/?artSec=503.001&chapter=BC.503&code=BC&tab=1)
- [Texas SB 2420 enrolled App Store Accountability Act](https://capitol.texas.gov/tlodocs/89R/billtext/html/SB02420F.HTM)
- [Texas SB 2420 official legislative history](https://capitol.texas.gov/billlookup/History.aspx?Bill=SB2420&LegSess=89R)
- [Fifth Circuit June 4, 2026 SB 2420 stay order](https://www.ca5.uscourts.gov/opinions/pub/26/26-50001-CV0.pdf)
- [Texas Attorney General SCOPE guidance](https://www.texasattorneygeneral.gov/consumer-protection/file-consumer-complaint/consumer-privacy-rights/securing-children-online-through-parental-empowerment)
- [California Automatic Renewal Law, BPC § 17602](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=BPC&sectionNum=17602)
- [California Attorney General automatic-renewal alert](https://oag.ca.gov/node/608083)
- [New York Attorney General SHIELD Act guidance](https://ag.ny.gov/resources/organizations/data-breach-reporting/shield-act)
- [New York General Business Law § 394-g, health-care-facility geofencing](https://www.nysenate.gov/legislation/laws/GBS/394-G)
- [Massachusetts 201 CMR 17.00](https://www.mass.gov/regulations/201-CMR-1700-standards-for-the-protection-of-personal-information-of-ma-residents)
- [Texas Attorney General breach reporting](https://www.texasattorneygeneral.gov/consumer-protection/data-breach-reporting)
- [California Civil Code personal-information/breach provisions](https://www.leginfo.legislature.ca.gov/faces/codes_displayText.xhtml?division=3.&chapter=1.&part=4.&lawCode=CIV&title=1.81.5)

### 18.3 Effective state comprehensive privacy laws

- [California CCPA/CPRA statutory text](https://leginfo.legislature.ca.gov/faces/codes_displayText.xhtml?division=3.&chapter=20.&part=4.&lawCode=CIV&title=1.81.5)
  and
  [California Privacy Protection Agency 2026 regulation update](https://cppa.ca.gov/regulations/ccpa_updates.html)
- [Colorado Attorney General CPA portal](https://coag.gov/resources/colorado-privacy-act/)
- [Connecticut statute and Attorney General portal](https://portal.ct.gov/AG/Sections/Privacy/The-Connecticut-Data-Privacy-Act)
- [Delaware Department of Justice privacy FAQ](https://attorneygeneral.delaware.gov/fraud/personal-data-privacy-portal/frequently-asked-questions/)
- [Florida Digital Bill of Rights, official 2025 codification—the latest published codification at the cutoff](https://www.flsenate.gov/Laws/Statutes/2025/Chapter501/PART_V)
  - [Florida Senate preserved 2026 chapter 501 citation query—both chambers, current versions; reproduced July 13, 2026: 33 bills and five enacted results](https://www.flsenate.gov/Session/Bills/2026?chamber=both&searchOnlyCurrentVersion=True&isIncludeAmendments=False&isFirstReference=False&citation=501&citationType=FL%20Statutes&pageNumber=1)
  - Enacted results reviewed:
    [SB 290 / chapter 2026-3](https://www.flsenate.gov/Session/Bill/2026/290),
    [HB 1069 / chapter 2026-114](https://www.flsenate.gov/Session/Bill/2026/1069),
    [SB 1074 / chapter 2026-68](https://www.flsenate.gov/Session/Bill/2026/1074),
    [SB 7014 / chapter 2026-153](https://www.flsenate.gov/Session/Bill/2026/7014),
    and
    [SB 7026 / chapter 2026-52](https://www.flsenate.gov/Session/Bill/2026/7026)
  - [SB 7026 enrolled text, including the section 12 amendment to s. 501.722](https://www.flsenate.gov/Session/Bill/2026/7026/BillText/er/HTML)
- [Iowa 2026 Code chapter 715D](https://www.legis.iowa.gov/law/iowaCode/sections?codeChapter=715D&year=2026)
- [Indiana Code title 24, article 15, official 2025 codification—the latest published codification at the cutoff](https://iga.in.gov/laws/2025/ic/titles/24#24-15)
  - [Indiana official 2026 Table of Citations Affected—Title 24 at pages 73-74; reproduced July 13, 2026: no IC 24-15 entry](https://iga.in.gov/publications/session_reference_doc/2026citelist.pdf)
  - [Indiana official 2026 enrolled acts](https://iga.in.gov/publications/session_reference_doc/2026-Enrolled-Acts.pdf)
  - [Indiana official 2026 session bill portal for the mandatory release-date recheck](https://iga.in.gov/legislative/2026/bills/)
- [Kentucky Revised Statutes chapter 367](https://apps.legislature.ky.gov/law/statutes/chapter.aspx?id=39113)
- [Maryland Attorney General data-privacy portal](https://oag.maryland.gov/resources-info/Pages/data-privacy.aspx)
- [Minnesota Attorney General MCDPA portal](https://www.ag.state.mn.us/Data-Privacy/Consumer/)
- [Montana Department of Justice privacy portal](https://dojmt.gov/office-of-consumer-protection/montana-consumer-data-privacy/)
- [Nebraska Data Privacy Act starting at § 87-1101](https://nebraskalegislature.gov/laws/statutes.php?statute=87-1101)
- [New Hampshire RSA chapter 507-H](https://gc.nh.gov/rsa/html/LII/507-H/507-H-mrg.htm)
- [New Jersey P.L. 2023, c. 266](https://pub.njleg.state.nj.us/Bills/2022/PL23/266_.PDF)
- [Oregon official consumer-privacy resources](https://dfr.oregon.gov/financial/protect/pages/consumer-privacy-resources.aspx)
- [Rhode Island title 6, chapter 48.1](https://webserver.rilegislature.gov/Statutes/TITLE6/6-48.1/INDEX.htm)
- [Tennessee SB 73/Information Protection Act status and text](https://wapp.capitol.tn.gov/apps/BillInfo/Default?BillNumber=SB0073&GA=113)
- [Texas Attorney General TDPSA portal](https://www.texasattorneygeneral.gov/consumer-protection/file-consumer-complaint/consumer-privacy-rights/texas-data-privacy-and-security-act)
- [Utah Attorney General UCPA portal](https://attorneygeneral.utah.gov/utah-consumer-protection-act-a-new-law-to-protect-online-privacy/)
- [Virginia Code chapter 53](https://law.lis.virginia.gov/vacodefull/title59.1/chapter53/)

### 18.4 Enacted future laws and nonoperative developments

- [Louisiana SB 386/Act 502 official status and text](https://legis.la.gov/legis/BillInfo.aspx?i=250945)
- [Vermont Act 145 as enacted](https://legislature.vermont.gov/Documents/2026/Docs/ACTS/ACT145/ACT145%20As%20Enacted.pdf)
- [Vermont Age-Appropriate Design Code, 9 V.S.A. chapter 62](https://legislature.vermont.gov/statutes/fullchapter/09/062)
- [Ninth Circuit March 2026 California AADC record](https://www.govinfo.gov/app/details/USCOURTS-ca9-25-2366/USCOURTS-ca9-25-2366-0)
- [California DOJ proposed SB 976 regulations announcement](https://oag.ca.gov/news/press-releases/california-department-justice-releases-proposed-protecting-our-kids-social-media)
- [US House committee materials for proposed federal SECURE Data Act](https://docs.house.gov/Committee/Calendar/ByEvent.aspx?EventId=119345)
- [Alaska HB 367 official status](https://www.akleg.gov/basis/Bill/Detail/34?Root=hb367)
- [Massachusetts S.2619 official status](https://malegislature.gov/Bills/194/S2619)
- [Illinois HB 5221 official status](https://www.ilga.gov/Legislation/BillStatus?DocNum=5221&DocTypeID=HB&GAID=18&LegId=166894&Print=1&SessionID=114)
- [Maine LD 1088 official status](https://www.mainelegislature.org/LawMakerWeb/summary.asp?ID=280097491)
- [Maine LD 1822 official status](https://www.mainelegislature.org/LawMakerWeb/summary.asp?ID=280098884)
- [New York S.9269 official status—passed both houses, not enacted at cutoff](https://www.nysenate.gov/legislation/bills/2025/S9269)

### 18.5 Apple primary sources

- [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [App privacy details](https://developer.apple.com/app-store/app-privacy-details/)
- [TN3194: account deletion and Sign in with Apple token revocation](https://developer.apple.com/documentation/technotes/tn3194-handling-account-deletions-and-revoking-tokens-for-sign-in-with-apple)
- [Apple health and fitness developer guidance](https://developer.apple.com/health-fitness/)

## 19. Open questions counsel must resolve from actual facts

1. What is the exact operating/legal entity, principal place of business, corporate
   structure, revenue, funding, insurance, and state nexus?
2. Which data combinations make OnSkin a vendor of personal health records, PHR
   related entity, or another HBNR-covered actor, and which vendors are third-party
   service providers?
3. Which WA, NV, CT, California CMIA, and other state exemptions or
   entity/data-level exclusions, if any, actually apply? No HIPAA exemption is
   assumed.
4. Is any catalog, recommendation, conflict, trend, notification, or Ask processing
   “necessary to provide” a specifically requested service, and where is separate
   consent required?
5. Does the final transient face-bound implementation collect or possess a biometric
   identifier or biometric data under Colorado, Illinois, Texas, Washington, or
   another state, and which written policy, retention, rights, and incident controls
   follow?
6. What exact active, log, consent, transaction, support, community, security,
   incident, and backup retention periods are defensible and technically achievable?
7. Which comprehensive-law thresholds and exemptions apply at launch, and how will
   entity-wide affiliates/revenue/data counts be calculated?
8. Which automatic-renewal notices and cancellation channels apply to the final
   Apple products and marketing, including reverse trial?
9. Is OnSkin a covered platform under TAKE IT DOWN, and what DMCA registration,
   designated agent, repeat-infringer, preservation, and transparency process is
   required?
10. What health, cosmetic, safety, ingredient, comparative, testimonial, and
    recommendation claims are substantiated for each exact audience and placement?
11. Which public links, support tools, vendors, contractors, or marketing systems
    fall outside the assumed no-sale/no-targeted-advertising/no-health-disclosure
    posture?
12. Which state breach definitions and deadlines apply to each modeled incident,
    including an unauthorized disclosure where data was encrypted in transit?
13. Does Civil Code § 56.06 deem OnSkin or any feature a CMIA provider, which fields
    are medical information, and what authorization, confidentiality, access,
    disclosure, purpose-change, segregation, contractor, retention, and incident
    duties follow?
14. Will the founder/counsel retain the repository's current 16+ threshold or adopt
    the proposed conservative 18+ migration, and what exact source/build evidence
    proves the decision?
15. What provisions of Texas SB 2420 are operative on the release date, what
    age/consent interface does Apple actually provide, and how will OnSkin prove
    rating, purpose limitation, deletion, and pre-change notice?
16. Does any Skin Notes phase fall within Texas SCOPE, and what age registration,
    parental, minor-data, purchase, safety, geolocation, advertising, or algorithmic
    controls result?
17. Has New York S.9269 been delivered, signed, vetoed, amended, or otherwise changed
    after the cutoff? Until enacted and effective, it remains monitoring only.

Until answered in signed, version-specific work product and reflected in the
release candidate, these questions remain launch blockers—not post-launch cleanup.
