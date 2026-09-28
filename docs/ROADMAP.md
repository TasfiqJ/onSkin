# Roadmap

> Active scope (2026-09-27): iOS lean V1 supersedes earlier all-features launch requirements. Required feature IDs: 1, 2, 3, 5, 6, 7, 8, 9, 10, 11. See `docs/hugeToDo/IOS_LEAN_V1_EXECUTION_PLAN.md` and `docs/hugeToDo/launch-contract.json`. Manual Shelf/local ingredient parsing, reviewed guidance, routine/cycle, Today, private Progress, local reminders and standard subscriptions remain required. Catalog/search/barcode, custom grants/reverse trial/win-back, recommendations, Ask, public sharing, commerce, community, trends, widgets and growth experiments are post-launch and must stay closed. Existing Apple/email account functionality and all current privacy, payment, persistence, accessibility and owner-isolation safeguards are preserved. Historical sections below do not add deferred features back to the V1 launch gate.


This roadmap executes the iOS-only, all-features contract. Every feature in
`docs/FEATURE_INDEX.md` is required before public launch; phases describe
dependency order, not permission to defer an indexed feature.

## Phase 0: Brand And Strategy Reset

Goal: remove the biggest avoidable launch risk.

Features:

- name shortlist
- trademark/domain/social research
- brand decision memo
- public identity migration plan

Done criteria:

- final name is both founder-approved and covered by qualified trademark
  counsel's written clearance decision for the approved countries and actual
  goods/services
- bundle/package/scheme/domain and public handle variants are authenticated,
  reserved under authorized accounts, and evidenced
- no production account is created under conflicted identity

Risks:

- name decision stalls
- social/domain unavailable

## Phase 1: Trust And Launch Gates

Goal: make core guidance legally and clinically credible.

Features:

- clinical/cosmetic reviewer workflow
- reviewed conflict/routine copy
- final privacy, terms, consumer health privacy, support, deletion/export URLs
- data source license posture

Done criteria:

- reviewed rules have reviewer metadata
- legal/privacy copy finalized
- copy audit passes strict mode

Risks:

- reviewer changes invalidate existing copy
- legal review slows launch

## Phase 2: Core Product Loop

Goal: make shelf -> insight -> routine -> check-off excellent.

Features:

- shelf add friction pass
- manual add polish
- product detail clarity
- first useful insight surface
- AM/PM routine generation
- Today check-off persistence

Done criteria:

- beta user can add 3 products in under 5 minutes
- first useful insight visible
- check-off persists after relaunch
- human-simulated E2E evidence attached

Risks:

- catalog misses make product feel broken
- routine feels generic

## Phase 3: Payments, Analytics, Backend

Goal: make revenue and measurement real.

Features:

- live Supabase staging
- RevenueCat sandbox
- entitlement mirror
- PostHog funnel
- Sentry release health
- reverse trial

Done criteria:

- purchase/restore/refund/expiry matrix passes
- first-insight to paywall funnel tracked
- RLS smoke tests pass

Risks:

- store product setup delayed by brand
- entitlement edge cases

### COM-01A: Commerce Literal-Zero Source Checkpoint

COM-01A currently enforces **literal zero admission**. Commerce authority,
affiliate/retailer rail availability, publication authority, reviewed catalog
and Stacks, positive commerce-consent grant, provider/order polling, catalog or
attribution reads, click/order recording, external purchase navigation, and
commerce analytics are unconditionally false or inert. Refusal, withdrawal,
cleanup, and deletion may remain. This is a source checkpoint only: COM-01
through COM-07 are incomplete and launch-blocked, and older positive commerce
or demo text is a future requirement only.

Before a positive successor:

- execute and review provider terms and exact rail/publication authority;
- approve exact first- and third-party data flows, recipients, contracts, App
  Privacy answers, and the ATT determination;
- admit only reviewed catalog and Stacks while proving commission-independent
  product, retailer, Stack, and recommendation ranking;
- put clear, conspicuous affiliate/native-ad disclosure next to each commercial
  action and substantiate product, ranking, and health-related claims;
- complete FTC Health Breach Notification Rule, Washington and Nevada
  consumer-health privacy, and applicable California reviews, including any
  distinct sharing consent or sale authorization;
- prove live attribution/order reconciliation, withdrawal/deletion, abuse and
  security controls, and exact archive/network/accessibility/performance/
  supported-iPhone behavior.

[Apple App Review Guideline 5.1.2(vi)](https://developer.apple.com/app-store/review/guidelines/)
bars data gathered from depth/facial-mapping tools, including Camera and Photo
APIs, from marketing, advertising, or use-based mining. Photo-derived product,
retailer, Stack, replenishment, paid-link, or attribution behavior therefore
remains excluded unless qualified counsel and Apple review the exact release;
consent or an opaque token does not cure prohibited upstream use. Section
2.5.18 separately bars health-data-based targeted or behavioral display ads.
Primary implementation-review inputs include the
[FTC affiliate guidance](https://www.ftc.gov/business-guidance/resources/ftcs-endorsement-guides-what-people-are-asking),
[FTC native-ad guidance](https://www.ftc.gov/business-guidance/resources/native-advertising-guide-businesses),
[FTC HBNR guidance](https://www.ftc.gov/business-guidance/resources/complying-ftcs-health-breach-notification-rule-0),
[Washington RCW 19.373](https://app.leg.wa.gov/RCW/default.aspx?cite=19.373&full=true),
[Nevada NRS 603A](https://www.leg.state.nv.us/nrs/nrs-603a.html), and
[applicable California law](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1798.140.).
Passing these gates cannot guarantee App Store acceptance, legal compliance,
safety, product-market fit, or revenue.

## Phase 4: Closed Beta

Goal: prove the production-real all-features iOS candidate before public scale.

Features:

- beta onboarding
- feedback capture
- catalog miss reporting
- churn interviews
- support workflow
- staging-only Apple Vision OCR source candidate, exact-build native evidence,
  and catalog coverage
- photos and Trend: PHOTO-05A currently proves only literal zero admission;
  build the real on-device result issuer, then complete predeclared
  diverse-condition calibration/fairness and exact consent/data-lifecycle,
  archive, network, accessibility, performance, and supported-iPhone evidence
- cloud Ask safety and cost
- COM-01A literal-zero commerce remains the current state; complete COM-01
  through COM-07 and the reviewed rail/publication-authority gates before
  commerce or creator handoff can become a positive beta flow
- community posting, moderation, and expert workflow
- widgets, Live Activities, notifications, links, and sharing
- admin/operator queues and launch dashboards

Done criteria:

- 50-100 users
- D7/D14 data
- catalog miss/wrong-match report
- willingness-to-pay signal
- CAT-05 passes its exact signed-build two-iPhone, 25-label/50-run accuracy,
  RTL, zero-network, cleanup, accessibility, and performance contracts before
  production OCR is enabled
- PHOTO-05/06/07 pass against one exact signed archive: no simulated result or
  environment override, validated within-person measurement and abstention
  behavior, separate current consent, signed fairness/legal/privacy review,
  zero image/feature-vector egress, and supported-iPhone evidence
- commerce passes the positive-successor gates above against one exact signed
  archive with no photo/health-derived marketing path, hidden activation input,
  ranking influence, remote side effect before consent/authority, or unmatched
  click/order attribution

Risks:

- weak first insight
- low product-add completion
- trust objections
- source-only or deterministic web OCR evidence is mistaken for native privacy,
  accuracy, accessibility, or release proof
- a deterministic Trend classifier, Apple Vision/vImage primitive, source
  refusal test, or historical enabled fixture is mistaken for a validated
  skin-change engine, fairness proof, legal clearance, or Apple acceptance
- COM-01A source refusal, a consent screen, opaque token, affiliate disclosure,
  environment flag, credential, or demo catalog is mistaken for a reviewed
  rail, publication authority, lawful data flow, Apple acceptance, or revenue

## Phase 5: Public Launch

Goal: controlled store launch with honest claims.

Features:

- ASO page
- store screenshots
- review prompt
- support pages
- release candidate evidence packet

Done criteria:

- App Store metadata reviewed
- privacy labels match behavior
- physical-iPhone QA attached
- launch ring gates passed

Risks:

- store rejection
- support overload
- competitor confusion

## Phase 6: Growth To $30k/Month

Goal: reach 10,000+ active subscribers over time.

Features:

- optimize the launch share-card loop
- creator seeding
- ASO iteration
- content/SEO
- pricing tests
- retention experiments

Done criteria:

- repeatable acquisition channel found
- paid conversion and retention support scaling
- churn reasons are understood

Risks:

- paid UA uneconomic
- creator content does not convert
- retention too weak
