# Product Requirements

> Active scope (2026-09-27): iOS lean V1 supersedes earlier all-features launch requirements. Required feature IDs: 1, 2, 3, 5, 6, 7, 8, 9, 10, 11. See `docs/hugeToDo/IOS_LEAN_V1_EXECUTION_PLAN.md` and `docs/hugeToDo/launch-contract.json`. Manual Shelf/local ingredient parsing, reviewed guidance, routine/cycle, Today, private Progress, local reminders and standard subscriptions remain required. Catalog/search/barcode, custom grants/reverse trial/win-back, recommendations, Ask, public sharing, commerce, community, trends, widgets and growth experiments are post-launch and must stay closed. Existing Apple/email account functionality and all current privacy, payment, persistence, accessibility and owner-isolation safeguards are preserved. Historical sections below do not add deferred features back to the V1 launch gate.


## Product Goals

1. [Decision] Help users use the skincare products they already own in the right order, on the right nights.
2. [Decision] Make the app trustworthy enough to support a paid subscription.
3. [Decision] Launch the full indexed product on iOS; every risky feature stays
   fail-closed until it is reviewed and production-real, but it may not be
   removed from the release scope to bypass its gate.
4. [Decision] Reach a path toward 10,000-14,000 active subscribers, the practical base for about $30k/month after fees and operating drag.

## Personas

### Persona 1: Maya, Overloaded Active User

- Role: skincare enthusiast
- Context: owns retinol, vitamin C, exfoliating acid, moisturizer, SPF
- Pain points: irritation, uncertainty, inconsistent routine
- Current workflow: TikTok, Reddit, Google, ingredient scanners
- Buying motivation: wants a clear plan using products already bought
- Objections: "Why trust this over Reddit?"
- Success outcome: adds shelf, sees conflict, follows AM/PM routine for 2+ weeks

### Persona 2: Lina, Sensitive-Skin Beginner

- Role: routine beginner
- Context: bought several recommended products but reacts easily
- Pain points: fear of mixing products, too much advice
- Current workflow: avoids actives or over-researches
- Buying motivation: calm guidance and private progress
- Objections: privacy, medical-sounding claims
- Success outcome: simple routine, fewer product changes, private tracking

### Persona 3: Tessa, Creator/Power User

- Role: skincare creator or hobbyist
- Context: builds routines and shares product opinions
- Pain points: wants shareable, credible routine artifacts
- Current workflow: screenshots, notes app, affiliate links
- Buying motivation: exportable conflict/routine cards
- Objections: does not want boring generic guidance
- Success outcome: shares cards, drives installs, keeps Pro

### Persona 4: Esthetician Future Buyer

- Role: service provider
- Context: helps clients organize home routines
- Pain points: clients forget instructions and overuse products
- Current workflow: PDF/notes/text messages
- Buying motivation: client routine adherence and product inventory
- Objections: compliance, client privacy, cost
- Success outcome: creates client routine and exports plan

## User Journeys

### First-Time Visitor

1. Sees rebranded promise.
2. Understands this is shelf/routine/progress, not a generic scanner.
3. Starts onboarding.

Acceptance:

- No medical, AI score, or unsafe claims.
- Privacy promise visible but not overexplained.

### New User Onboarding

1. Age gate.
2. Health-data consent.
3. Goals and skin profile.
4. Product add prompt.
5. Add 3+ products by manual, search, barcode, or OCR.
6. Receive first insight.
7. See routine.

Acceptance:

- User can skip unavailable scan paths and add manually.
- No dead end if catalog lookup fails.
- Consent is unbundled.

### First Successful Outcome

Definition:

- User receives at least one of:
  - conflict insight
  - sequencing insight
  - routine gap
  - expiry/PAO issue
  - simple AM/PM plan from owned products

Acceptance:

- Insight appears within first session for users with 3+ products.
- Copy is calm and evidence-aware.

### Returning User Workflow

1. Open Today.
2. Complete AM or PM steps.
3. See tonight's cycling/recovery guidance.
4. Add photo or review progress optionally.

Acceptance:

- Check-off persists.
- Recovery/missed days are not punitive.

### Power User Workflow

1. Add or edit many products.
2. Inspect conflicts.
3. Override or accept schedule.
4. Share reviewed conflict card.

Acceptance:

- Overrides persist.
- Share card does not expose private shelf details beyond chosen conflict.

### Admin/Operator Workflow

1. Review catalog reports.
2. Review safety/copy/rule changes.
3. Attach reviewer metadata.
4. Monitor crashes, support, conversion, catalog misses.

Acceptance:

- No unreviewed rules become production-visible.
- Evidence packets tie to exact build/version.

### Upgrade/Payment Workflow

1. User hits value.
2. Sees Pro offer.
3. Starts reverse trial or store trial.
4. Purchases annual/monthly.
5. Entitlement syncs locally and server-side.

Acceptance:

- Restore works.
- Cancellation copy is honest.
- Pricing is localized from store/RevenueCat.

### Cancellation/Churn Workflow

1. User opens subscription settings or expires.
2. Sees honest plan state.
3. Can manage subscription via store.
4. Data remains exportable/deletable.

Acceptance:

- No dark patterns.
- Free tier preserves user data.

## iOS All-Features Release Scope

[Decision] The release includes all 20 features in `docs/FEATURE_INDEX.md` and
all Phase 7/8 surfaces in `docs/hugeToDo/launch-contract.json`. Android release
evidence is not required. Every included feature must be production-real; a
stub, fixture, preview, inert target, simulated response, or hidden route does
not satisfy scope.

The shelf -> insight -> routine -> Today loop remains the primary positioning
and activation path. Commerce, community, Ask, trend, native widgets, creator,
sharing, and growth surfaces support that promise and must not displace it.

## Prohibited Public Claims And Behaviors

- AI skin score.
- Skin age.
- Diagnosis/treatment/cure/prevention.
- Cloud photo analysis.
- Commission-influenced ranking.
- Unreviewed Ask/recommendations.

## Acceptance Rules

- [Decision] Every public value claim must map to production-real behavior.
- [Decision] Every launch-required feature must pass its applicable code,
  staging, physical-iPhone, professional-review, production, and store gates.
- [Decision] Every clinical/cosmetic-chemistry claim must be reviewed or hidden.
- [Decision] Every UI-facing feature needs human-simulated E2E evidence.
- [Decision] Every health/photo/commerce/AI sharing path must have explicit consent and policy coverage.
