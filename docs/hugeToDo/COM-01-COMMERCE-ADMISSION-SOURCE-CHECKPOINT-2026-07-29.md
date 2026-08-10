# COM-01A Commerce Admission Source Checkpoint

Date: 2026-07-29
Status: `in_progress` source checkpoint; launch-blocked

## Decision

COM-01A establishes **literal zero admission** for commerce. The current source
admits no affiliate rail, creator stack, retailer option, paid-link disclosure,
commerce consent grant, click attribution, order attribution, partner poll,
external retailer navigation, or commerce analytics. This is a source checkpoint
only. COM-01 through COM-07 remain launch-blocked.

An environment flag, final-looking domain, development build, fixture, seeded
row, existing consent record, opaque token, provider credential, or direct URL
cannot create commerce authority. Current mobile entry points and direct
`/commerce/*` routes render only a shared unavailable recovery surface. The You,
recommendation, and Shelf/replenishment surfaces expose no commerce entry point,
catalog read, consent prompt, paid-link row, or “similar options” commerce
handoff. Catalog/link resolvers return no options, creator-stack selectors return
no stacks, and positive consent or click attempts refuse before storage, session,
network, analytics, URL, or native-link work.

The server-side order-report function is equally inert: it does not read partner
credentials, initialize a database client, call a provider, read an order report,
or write an attribution. Database API roles cannot read commerce catalog or stack
rows or insert click events. Write guards reject commerce click publication while
admission is closed.

Only refusal and data-rights behavior survives the boundary. A user may withdraw
or decline legacy commerce/data-sharing state, delete owner-scoped legacy click
records, and complete account deletion or export handling already required by the
privacy architecture. Cleanup is not admission and cannot publish a link, stack,
click, order, or analytic event.

## Why the boundary is zero

Apple’s current rules create a higher-order restriction that minimization alone
does not solve. [App Review Guideline 5.1.2(vi)](https://developer.apple.com/app-store/review/guidelines/)
bars data gathered from depth and/or facial-mapping tools, including the listed
Camera and Photo APIs, from marketing, advertising, or use-based data mining.
Layerwell’s face/skin-photo context therefore must be treated as disqualified from
commerce selection, targeting, attribution, or optimization unless Apple and
qualified counsel accept an exact, independently sourced future architecture.
Turning a photo-derived result into a category and then sending only an opaque
token does not change the upstream marketing use. Consent, ATT permission, hashing,
pseudonymization, or removing raw photo bytes does not cure a prohibited purpose.

[Guideline 2.5.18](https://developer.apple.com/app-store/review/guidelines/)
also bars targeted or behavioral display advertising based on sensitive data such
as health or medical data. Whether a retailer row, creator stack, or affiliate
recommendation is contextual shopping, an endorsement, native advertising, or
display advertising is not resolved by calling it “where to buy.” The release
gate must classify the exact surface, payload, ranking inputs, and net impression.
[Guideline 3.1.3(e)](https://developer.apple.com/app-store/review/guidelines/)
allows non-IAP payment methods for physical goods consumed outside the app; it
does not authorize advertising, tracking, or photo/health-data reuse.

Apple’s [App Privacy Details](https://developer.apple.com/app-store/app-privacy-details/)
require accurate disclosure of data such as product interaction, purchase
history, advertising data, identifiers, purposes, linkage, and tracking,
including collection that occurs only after an optional opt-in. Apple’s
[privacy and ATT guidance](https://developer.apple.com/app-store/user-privacy-and-data-use/)
requires ATT when app data or identifiers are used to track a person across
other companies’ apps or websites for ad targeting or measurement. ATT is an
additional gate, not permission to violate Guideline 5.1.2(vi) or 2.5.18.

The FTC requires a material affiliate relationship to be disclosed clearly and
conspicuously close to the recommendation or link; its
[Endorsement Guides Q&A](https://www.ftc.gov/business-guidance/resources/ftcs-endorsement-guides-what-people-are-asking)
warns that “affiliate link” or a purchase CTA alone may not communicate the
relationship. The FTC’s
[Native Advertising guide](https://www.ftc.gov/business-guidance/resources/native-advertising-guide-businesses)
requires promotional content to be readily identifiable as advertising and its
necessary disclosures clear and prominent. Any skincare benefit, safety, or
suitability claim must also meet the FTC’s
[Health Products Compliance Guidance](https://www.ftc.gov/business-guidance/resources/health-products-compliance-guidance)
standard for truthful, nonmisleading claims supported by competent and reliable
scientific evidence. A disclosure cannot fix an unsubstantiated claim or a
misleading overall impression.

The FTC’s
[Health Breach Notification Rule guidance](https://www.ftc.gov/business-guidance/resources/complying-ftcs-health-breach-notification-rule-0)
explains that covered non-HIPAA health apps may have notification duties when
unsecured identifiable health information is acquired without authorization,
including through an unauthorized disclosure rather than only a security
intrusion. Scope, encryption, incident response, vendor contracts, and notice
duties require an exact-system legal determination before any commerce recipient
is added.

Washington’s [My Health My Data Act, RCW 19.373](https://app.leg.wa.gov/RCW/default.aspx?cite=19.373&full=true)
defines consumer health data broadly enough to include inferred or derived health
information and requires a health-data privacy policy, purpose limitation,
consumer rights, and separate and distinct consent before sharing. A sale requires
a separate signed authorization. Nevada
[NRS 603A.400–603A.550](https://www.leg.state.nv.us/nrs/nrs-603a.html#NRS603ASec400)
similarly governs consumer health-data collection, sharing, policy disclosures,
security, processors, deletion, and written authorization for sale. Whether
affiliate consideration, an attribution token, or a retailer correlation is a
sale, share, or other regulated disclosure must be decided for the exact rail and
market; the app must not infer a favorable classification.

If the business meets the applicable thresholds or otherwise falls within the
statute, California’s CCPA/CPRA treats product consideration and purchasing
history, app or advertisement interactions, identifiers, inferences, and analyzed
health information as regulated personal or sensitive personal information.
See the official
[Civil Code § 1798.140 definitions](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1798.140.)
and the rights concerning
[sale or sharing opt-out](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=1798.120.&lawCode=CIV),
[sensitive-information use limits](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=1798.121.&lawCode=CIV),
and [deletion](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=1798.105.&lawCode=CIV).
Applicability, notices, contracts, consumer requests, opt-out/limit signals, and
service-provider/contractor restrictions must be mapped to the exact commerce
design before admission.

## Positive-admission gates

A future successor remains closed until all of the following exist and are bound
to the exact release candidate:

1. A qualified legal/App Review classification of each retailer row, stack,
   disclosure, attribution event, order report, and measurement purpose under
   Apple 2.5.18, 3.1.3(e), 5.1.2(vi), App Privacy, ATT, FTC rules, the HBNR, RCW
   19.373, NRS 603A.400–.550, and applicable CCPA/CPRA requirements.
2. A rule, enforced in source and backend authority, that no photo, face signal,
   Trend result, health profile, concern, condition, pregnancy status, inferred
   health attribute, or health-derived category can select, target, rank,
   personalize, measure, or attribute commerce.
3. An approved first-party rail and account whose written provider contract
   supports the intended links, attribution, order correlation, retention,
   deletion, opt-out, security, incident, support, and audit behavior.
4. A source-cleared, current, correction-capable catalog and a separately
   authorized, exact-version, independently reviewed creator-stack publication
   corpus. Development fixtures and reviewer-name strings are not authority.
5. Exact legal/privacy/clinical copy approval for every disclosure, claim,
   consent, refusal, withdrawal, support, and failure state, with clear and
   conspicuous link-level advertising/material-connection disclosure.
6. Separate, purpose-specific consent and withdrawal only where legally
   sufficient; ATT where tracking applies; accurate policies, App Privacy
   answers, data inventory, processor contracts, retention schedule, consumer
   rights, and breach-response operations. Consent cannot override a prohibited
   use.
7. Server-held credentials, strict retailer allowlisting, safe external handoff,
   idempotent and bounded order polling, broken-link monitoring, reconciliation,
   fraud handling, support, and kill switches, with no commission field readable
   by or imported into recommendation detection/ranking.
8. Hosted RLS/privilege, two-user isolation, deletion/export/withdrawal, network,
   security, accessibility, compact/Dynamic Type, interruption, offline/failure,
   supported physical-iPhone, signed-archive, staging, production, and App Review
   evidence for the exact committed build.
9. Named legal, privacy/security, clinical/cosmetic-chemistry, App Review,
   operations, and release reviewers sign the exact evidence packet with no open
   P0/P1 or unresolved classification.

## Human-simulated Expo-web evidence

The 2026-07-29 human-simulated E2E run is summarized at
`test-results/human-e2e/2026-07-29/com01a-zero-commerce-current/`. The run was
observed against the current source at 360 x 640, 390 x 844, and 430 x 932.

At every viewport, direct navigation to each of these exact URLs retained that
URL until user interaction:

- `/commerce/stacks`
- `/commerce/transparency`
- `/commerce/consent`
- `/commerce/stack/sensitive-skin-starter-set`

Each direct route rendered exactly one `Back to You` recovery control. Stack,
transparency, consent-allow, paid-link, retailer, price, commission,
external-link, and other positive commerce copy was absent. Activating
`Back to You` replaced the current route with `/you`; it did not add a positive
commerce route to the usable back path.

The same observed three-viewport run found that You exposed neither commerce nor
Trend, and that Shelf/replenishment exposed no commerce, retailer, consent, or
similar-options CTA. Browser console inspection during the run found zero
errors and zero warnings.

The initial route pass found a route-group layout canonicalization defect: the
commerce layout was trying to own unavailable rendering instead of remaining
transparent to its leaf routes. Replacing the layout body with a transparent
Expo Router `Slot` fixed the issue. The post-fix rerun passed all four exact
direct URLs, the single-control invariant, and `/you` replacement at all three
viewports.

The ignored folder retains representative screenshots plus a self-reported
README/summary, not a raw browser trace, console log, URL/interaction log,
network log, or complete route-by-viewport screenshot matrix. Therefore the
full matrix and zero-console observations above are local observations, not
independently replayable release evidence. The packet retained no network
capture, so it does not independently prove zero requests; the source and
automated contracts carry that assertion. It
does not prove native iOS routing, safe areas, VoiceOver, Dynamic Type,
physical-iPhone behavior, provider or hosted behavior, signed-archive identity,
legal or privacy compliance, App Review acceptance, launch clearance,
product-market fit, seven-figure revenue, or any revenue.

## Historical material

The positive commerce UI, consent, development stack, paid-link, retailer,
opaque-token, order-poll, and 2026-07-06 through 2026-07-08 browser evidence in
older docs are historical/stale. They may inform a future design review, but they
do not describe current behavior and cannot satisfy COM-01 through COM-07.

## Non-claim

COM-01A does not complete commerce and does not prove Apple acceptance, legal or
privacy compliance, claim substantiation, provider approval, commercial
viability, product-market fit, seven-figure revenue, or any revenue. Only Apple,
applicable authorities, qualified reviewers, providers, and real market evidence
can decide those outcomes.
