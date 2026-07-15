# Master Plan

## 0. Evidence Labels

- `[Researched]`: supported by external source listed in this document.
- `[Confirmed]`: verified from the existing repo or current app code/docs.
- `[Assumption]`: reasonable operating assumption, not yet validated by users.
- `[Decision]`: recommended direction.
- `[Decision under uncertainty]`: recommended now, with validation required.
- `[Needs Research]`: more external research required.
- `[Open Question]`: unanswered blocker.

## 1. Executive Summary

### Final Project Name Recommendation

[Decision] Rebrand before launch. Use `RoutineKind` as the working name until trademark/domain/social clearance is complete.

[Confirmed] The current code and docs use `OnSkin`, `onskin`, `onskin://`, and `com.onskin.app`. Existing public competitors use the exact `OnSkin` name in the same skincare/cosmetic scanner category.

[Researched] The public OnSkin listing describes a beauty product scanner with over 8M users and a 2M product database. Source: [OnSkin App Store](https://apps.apple.com/kz/app/onskin-beauty-product-scanner/id1630768985), [OnSkin website](https://onskin.com/).

### One-Sentence Product Description

[Decision] A private skincare shelf and routine app that helps users use products they already own in the right order, on the right nights, with reviewed conflict guidance and private progress tracking.

### Full Product Description

The app is a mobile skincare operating system built around three personal objects:

1. The user's shelf.
2. The user's routine.
3. The user's progress.

Users add products by barcode, OCR/search, or manual entry. The app turns those products into an AM/PM routine, flags reviewed ingredient and timing conflicts, supports skin-cycling and check-off, reminds users calmly, and lets them compare private progress photos without scores, diagnosis, or fear-based claims.

### Primary Target User

[Assumption] Skincare users who own 5+ products and are unsure how to combine actives such as retinoids, AHAs/BHAs, vitamin C, benzoyl peroxide, peptides, niacinamide, moisturizers, and SPF.

### Buyer Persona

[Assumption] Same person as the user for the consumer subscription. Later buyer options: estheticians, med-spas, dermatology support staff, or skincare creators using the app as a client routine planner.

### Main Pain Solved

[Decision] "I bought skincare products, but I do not know what to use together, what to separate, what to use tonight, or whether I am staying consistent."

### Main Value Proposition

[Decision] Use what you already own better before buying more.

### MVP Promise

[Decision] Add 3-5 products, get at least one useful shelf/routine insight, and follow tonight's routine in under one minute.

### Long-Term Vision

[Decision] A trusted private skincare command center: shelf, routines, reviewed guidance, private progress, optional expert-backed content, and eventually professional/client workflows.

## 2. Category Definition

### Product Category

[Researched] The product sits in the intersection of:

- skincare routine tracker
- cosmetic ingredient/product scanner
- personal care inventory
- subscription wellness app
- consumer health-adjacent privacy product

[Decision] Position as "skincare shelf and routine tracker," not "AI beauty scanner."

### Adjacent Categories

- AI skin analysis apps: Thea, Nolla Skin, Skin Bliss.
- Ingredient scanners: OnSkin, Yuka, Think Dirty, INCI Beauty, EWG Skin Deep.
- Routine builders: SkinSort, HadaBuddy, Skin Bliss.
- Commerce/deal apps: Thea, affiliate beauty tools.
- Medical skincare/telehealth: Nolla Skin and prescription acne/rosacea services.

### Product Type

[Decision] Improved workflow plus data product. It is not primarily an AI product or marketplace.

The defensible workflow is:

```text
owned products -> shelf intelligence -> reviewed conflicts -> routine plan -> daily check-off -> private progress -> subscription retention
```

## 3. Gold Idea Brief

### 3.1 Clean Project Summary

**Project name ideas**

- [Decision] RoutineKind
- [Needs Research] ShelfWise
- [Needs Research] LayerWise
- [Needs Research] RoutineCabinet
- [Needs Research] SkinCycle Journal

**One-sentence description**

[Decision] A private skincare shelf and routine app that checks the products users already own, flags reviewed timing conflicts, and turns them into a calm AM/PM plan.

**Plain-English explanation**

People buy skincare products faster than they learn how to use them. This app helps them organize their shelf, avoid obvious timing mistakes, keep routines simple, and track their own progress privately.

**What the product does**

- Adds products to a personal shelf.
- Parses product categories and ingredient tags where available.
- Flags reviewed conflicts, synergies, expiry/PAO, and routine gaps.
- Builds AM/PM and skin-cycling routines.
- Supports daily check-off, reminders, streak/adherence, and private photo timeline.
- Offers paid Pro features after a user sees value.

**What the product does not do**

- Does not diagnose skin conditions.
- Does not prescribe treatment.
- Does not provide AI skin scores, skin age, or guaranteed improvement.
- Does not use product commissions to rank recommendations.
- Does not expose peer community posting without moderation.
- Does not market unreviewed clinical claims.

### 3.2 Target User

| Item             | Answer                                                               |
| ---------------- | -------------------------------------------------------------------- |
| Primary user     | [Assumption] Product-overloaded skincare user with 5+ products       |
| Buyer            | [Assumption] Same person for consumer Pro                            |
| Secondary users  | [Assumption] creators, estheticians, sensitive-skin users, beginners |
| Skill level      | Beginner to intermediate                                             |
| Environment      | Bathroom, bedroom, store aisle, mobile-first                         |
| Painful workflow | TikTok/Reddit/Google/product labels/ingredient apps/manual guessing  |

### 3.3 Problem Definition

| Question              | Answer                                                                                                                                  |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Exact problem         | [Decision] Users do not know how to use owned skincare products together consistently and safely.                                       |
| Why it matters        | [Assumption] Wrong timing and overuse cause irritation, waste, and inconsistent behavior.                                               |
| Current solutions     | [Researched] OnSkin, Yuka, Think Dirty, SkinSort, HadaBuddy, Skin Bliss, Thea, Nolla Skin, Reddit, TikTok, Google.                      |
| Why painful           | Existing tools often score or scan products but do not always convert owned products into a daily plan.                                 |
| Cost of doing nothing | More unused products, avoidable irritation, continued confusion, subscription churn.                                                    |
| Trigger events        | Retinol purchase, acid irritation, new product haul, pregnancy/sensitivity concern, expiry concern, TikTok trend, dermatologist advice. |

### 3.4 Product Value

**Main value proposition**

[Decision] Use what you already own, in the right order, on the right nights.

**Secondary value propositions**

- Private progress without AI scores.
- Calm habit loop.
- PAO/expiry and replenishment.
- Evidence-graded, resolution-first conflict guidance.
- Independent recommendations.

**Outcome promised**

[Decision] Less guessing, fewer obvious timing mistakes, simpler routines, better consistency.

**What makes a user say "I need this now"**

[Decision] The app finds a real conflict or routine issue in the user's own shelf and immediately shows what to do tonight.

### 3.5 SaaS Quality Check

| Check                                 | Assessment                                                                  |
| ------------------------------------- | --------------------------------------------------------------------------- |
| Painkiller, vitamin, mission-critical | [Decision] Painkiller for overloaded active users; vitamin for casual users |
| Usage frequency                       | [Assumption] Daily if Today check-off works                                 |
| Product type                          | Consumer subscription first; possible B2B later                             |
| Category                              | Workflow + personal data product                                            |
| Worth paying for                      | Reviewed guidance, habit loop, private progress, saved product waste        |

### 3.6 Strongest Product Version

| Version              | Recommendation                                                                                |
| -------------------- | --------------------------------------------------------------------------------------------- |
| Best narrow version  | [Decision] Private shelf-to-routine app for people with too many skincare actives             |
| Best broad version   | [Assumption] Personal skincare operating system                                               |
| Best premium version | [Assumption] Expert-reviewed routines plus professional export                                |
| Best MVP version     | [Decision] Rebranded app with shelf, reviewed conflicts, routine, Today, progress, RevenueCat |
| Avoid                | [Decision] Generic AI scanner, broad beauty marketplace, fear-based hazard score              |

### 3.7 Core Assumptions

| Assumption                                  | Why it matters                          | How to validate                         | Risk   |
| ------------------------------------------- | --------------------------------------- | --------------------------------------- | ------ |
| Users add 3-5 real products                 | The shelf is the input to all value     | Closed beta funnel                      | High   |
| First useful insight happens in one session | Drives activation and paywall readiness | Time-to-first-insight                   | High   |
| Users trust the guidance                    | Core trust/revenue requirement          | Interviews, signoff, complaint tracking | High   |
| Catalog coverage is usable                  | Scanner magic depends on match rate     | Scan/search miss rate                   | High   |
| Users return for routine check-off          | Retention drives subscription           | D7/D14/D30 cohorts                      | High   |
| $49.99/year is acceptable                   | Revenue target depends on ARPU          | Pricing test                            | High   |
| Rebrand does not weaken demand              | Avoids legal and ASO risk               | Landing page tests                      | Medium |
| Conflict card shares spread                 | Needed for low-CAC growth               | Share-to-install metrics                | Medium |

### 3.8 Validation Plan

**10 customer interview questions**

1. How many skincare products do you use weekly?
2. Which products are you unsure how to combine?
3. What has irritated your skin recently?
4. How do you decide AM vs PM order today?
5. Which skincare apps or sites have you tried?
6. What did those tools fail to answer?
7. Would you add your full shelf if it took five minutes?
8. What proof would make you trust conflict guidance?
9. Would you pay $49.99/year after seeing a useful routine insight?
10. What would make you cancel after week one?

**Landing page test**

Test three headlines:

- "Add your skincare shelf. Get a routine that knows what not to mix."
- "Use what you already own, in the right order."
- "Your private skincare routine, built from your shelf."

**Smoke test**

Ask users to submit 5 products. Manually return a conflict card and AM/PM plan. Ask them to pay for early access or join a paid beta.

**Willingness-to-pay test**

Test $29.99, $49.99, and $59.99 annual. Use actual checkout or paid-beta deposit when possible, not survey-only intent.

**First 20 users plan**

- Recruit users with 5+ skincare products.
- Observe onboarding live.
- Require product add in first session.
- Track first insight, first routine, first check-off, day-7 return.
- Interview churned users within 48 hours.

### 3.9 Initial Monetization Options

| Option          | Recommendation                                                                       |
| --------------- | ------------------------------------------------------------------------------------ |
| Free tier       | Quiz, shelf preview, limited conflict check                                          |
| Paid tier       | Full routine, full conflict checks, progress, reminders, Ask depth                   |
| Usage-based     | Avoid for consumer V1                                                                |
| Team/enterprise | Later: esthetician/client routine planner                                            |
| Best hypothesis | [Decision] $49.99/year annual-first, $8.99-$9.99 monthly anchor, 7-day reverse trial |

### 3.10 Go / Narrow / Pivot / Stop

[Decision] Narrow first, but do not delete the full product. Keep advanced surfaces behind flags and launch gates.

## 4. Research Dossier

### 4.1 Target User Research

| Topic              | Findings                                                                                                                                                                                                                   |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User profile       | [Assumption] 18-40, skincare-interested, owns multiple products, mobile-first                                                                                                                                              |
| Buyer              | [Assumption] Same user for subscription; professional buyer later                                                                                                                                                          |
| Online spaces      | [Assumption] TikTok/#SkinTok, Instagram, Reddit skincare communities, YouTube, Google search, app stores                                                                                                                   |
| Searches           | [Assumption] "can I use retinol with vitamin C", "retinol and AHA", "skincare routine order", "ingredient checker", "skin cycling"                                                                                         |
| Pain signals       | [Researched] Competitor reviews and listings emphasize product scanning, ingredient breakdowns, routine planning, face scanning, and conflict detection.                                                                   |
| Willingness to pay | [Researched] HadaBuddy lists Pro at $3.99/month or $29.99/year; Think Dirty premium has been reported at $59.99/year by TechRadar; RevenueCat reports subscription apps are unforgiving and conversion varies by category. |
| Evidence quality   | Medium. Competitor signals are strong; direct target-user interview evidence is missing.                                                                                                                                   |

Sources: [HadaBuddy](https://www.hadabuddy.com/), [HadaBuddy FAQ](https://www.hadabuddy.com/faq), [Think Dirty App Store](https://apps.apple.com/us/app/think-dirty-shop-clean/id687176839), [TechRadar Think Dirty review](https://www.techradar.com/computing/websites-apps/thinkdirty), [RevenueCat 2026](https://www.revenuecat.com/state-of-subscription-apps/).

### 4.2 Competitor And Alternative Research

| Name               | Source                                                                                                                                                            | What it does                                                                                 | Pricing public?                   | Strengths                                                 | Weaknesses / gaps                                                                  | Risk              |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------- | ----------------- |
| OnSkin             | [App Store](https://apps.apple.com/kz/app/onskin-beauty-product-scanner/id1630768985), [site](https://onskin.com/)                                                | Cosmetic scanner, ingredient safety, product database                                        | IAP visible; exact pricing varies | Exact name, scanner SEO, claimed 8M users and 2M products | Scanner/safety-score positioning, not obviously a private routine operating system | Critical          |
| HadaBuddy          | [site](https://www.hadabuddy.com/), [FAQ](https://www.hadabuddy.com/faq)                                                                                          | Scans shelf, builds 7-day AM/PM routine, AI advisor, conflict detection                      | $3.99/mo or $29.99/yr Pro         | Closest direct workflow competitor                        | AI framing, lower price anchors market, unclear review rigor from public pages     | Critical          |
| Thea               | [App Store](https://apps.apple.com/us/app/thea-1-beauty-app/id6523434295)                                                                                         | AI beauty expert, face scan, routine analysis, product/deal finding                          | IAP                               | Strong AI/beauty/deal positioning                         | More shopping/AI, less privacy-first shelf habit                                   | High              |
| Nolla Skin         | [App Store](https://apps.apple.com/us/app/nolla-skin/id6741805934), [site](https://www.nollahealth.com/)                                                          | Clinician-backed medical skincare, treatment and medication                                  | Needs research                    | Medical care credibility                                  | Different category; higher regulatory burden                                       | Medium            |
| SkinSort           | [site](https://skinsort.com/), [routine creator](https://skinsort.com/routine), [App Store](https://apps.apple.com/us/app/skinsort-skincare-scanner/id6478040418) | Ingredient checker, product matching, comparisons, routine creator, incompatibility warnings | IAP                               | Strong SEO/product database/routine tools                 | More comparison/discovery than private daily operating system                      | High              |
| Skin Bliss         | [site](https://www.getskinbliss.com/), [App Store](https://apps.apple.com/us/app/skin-bliss-skincare-routines/id1385561364)                                       | AI face scan, routines, ingredient checks, tracking                                          | Freemium/IAP                      | Claims 3M+ users, broad feature set                       | Broad AI operating-system claim, possible complexity                               | High              |
| Yuka               | [site](https://yuka.io/en/), [Google Play](https://play.google.com/store/apps/details?id=io.yuka.android&hl=en_US)                                                | Food and cosmetic scanner with health impact rating                                          | Freemium/subscription             | Massive scan behavior proof, independence brand           | Product score, not routine habit                                                   | High for scanning |
| Think Dirty        | [site](https://www.thinkdirtyapp.com/), [App Store](https://apps.apple.com/us/app/think-dirty-shop-clean/id687176839)                                             | Barcode scanner, ingredient ratings, cleaner alternatives                                    | Free + premium                    | Clean beauty brand awareness, shopping angle              | Rating/scanner focus, trust criticism risk common to hazard apps                   | Medium            |
| Manual alternative | Reddit, TikTok, Google, notes app                                                                                                                                 | User self-researches products/routines                                                       | Free                              | Flexible, social proof                                    | Slow, inconsistent, hard to trust                                                  | High              |

### 4.3 Differentiation Map

| Capability                               | This Product Target | OnSkin                           | HadaBuddy | SkinSort          | Skin Bliss   | Yuka/Think Dirty    |
| ---------------------------------------- | ------------------- | -------------------------------- | --------- | ----------------- | ------------ | ------------------- |
| Barcode/product scan                     | Yes                 | Yes                              | Yes       | Yes               | Yes          | Yes                 |
| Manual shelf as core object              | Yes                 | Some                             | Yes       | Some              | Some         | Lists/saves         |
| Reviewed conflict rules                  | Yes, required       | Unknown                          | Unknown   | Unknown           | Unknown      | Mostly rating logic |
| Routine generated from owned products    | Yes                 | Some                             | Yes       | Yes               | Yes          | No                  |
| Daily Today check-off                    | Yes                 | Unknown                          | Yes       | Some              | Yes          | No                  |
| Skin cycling                             | Yes                 | Unknown                          | Unknown   | Unknown           | Unknown      | No                  |
| Private photo progress, no score         | Yes                 | Competitor may use face analysis | Unknown   | Limited           | AI face scan | No                  |
| No AI score / no face upload positioning | Yes                 | No                               | No        | Mixed             | No           | Mixed               |
| PAO/expiry cabinet                       | Yes                 | Unknown                          | Unknown   | Weak/unknown      | Unknown      | Weak/unknown        |
| Commerce independence                    | Yes                 | Unknown                          | Unknown   | Product discovery | Product recs | Varies              |

**Positioning gap**

[Decision] Own "private shelf-to-routine system," not "scan and score."

**Best wedge**

[Decision] A shareable, reviewed Shelf Conflict Card plus the daily routine that resolves it.

### 4.4 Technical Feasibility Research

| Area            | Finding                                                                                                                                                                                                                                                                                                                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Product data    | [Researched] Open Beauty Facts is a volunteer cosmetic product database with 100,000+ products from 170 countries, under Open Food Facts ecosystem. ODbL obligations apply. Source: [Open Beauty Facts GitHub](https://github.com/openfoodfacts/openbeautyfacts), [ODbL license](https://wiki.openfoodfacts.org/ODBL_License).                                                              |
| Ingredient data | [Researched] CosIng is an official European Commission cosmetic ingredient database, but has informative purpose and no legal value. Source: [European Commission CosIng](https://single-market-economy.ec.europa.eu/sectors/cosmetics/cosmetic-ingredient-database_en).                                                                                                                    |
| Subscriptions   | [Researched] RevenueCat benchmark dataset covers 115,000+ apps, $16B+ revenue, and reports D35 download-to-paid as a core metric. Source: [RevenueCat 2026](https://www.revenuecat.com/state-of-subscription-apps/).                                                                                                                                                                        |
| Payments fee    | [Researched] Apple Small Business Program offers 15% commission for eligible developers up to $1M proceeds. Source: [Apple](https://developer.apple.com/app-store/small-business-program/). Google Play has 15% or less service fee programs for most eligible developers. Source: [Google Play service fees](https://support.google.com/googleplay/android-developer/answer/112622?hl=en). |
| Health privacy  | [Researched] Washington MHMDA protects consumer health data outside HIPAA and requires consent and consumer health privacy policy obligations. Source: [WA Attorney General](https://www.atg.wa.gov/protecting-washingtonians-personal-health-data-and-privacy), [RCW 19.373](https://app.leg.wa.gov/RCW/default.aspx?cite=19.373&full=true).                                               |
| App review      | [Researched] Apple subscriptions require compliance with App Store subscription guidelines and no misleading marketing. Source: [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/).                                                                                                                                                                    |

### 4.5 Best Tech Direction - No Tech Stack Limit

[Decision under uncertainty] Keep the current Expo/Supabase/RevenueCat stack unless beta proves native camera performance, backend scale, or compliance requirements force a change.

| Option                            | Product Fit | MVP Speed | Maintainability | Security | Scalability | Cost |  DX | Ecosystem | Hiring | Lock-in | Verdict                             |
| --------------------------------- | ----------: | --------: | --------------: | -------: | ----------: | ---: | --: | --------: | -----: | ------: | ----------------------------------- |
| Expo RN + Supabase + RevenueCat   |           5 |         5 |               4 |        4 |           4 |    4 |   5 |         5 |      5 |       3 | Recommended                         |
| Native iOS/Android + Postgres API |           5 |         2 |               3 |        5 |           5 |    3 |   2 |         5 |      3 |       4 | Too slow solo                       |
| Flutter + Supabase                |           4 |         4 |               4 |        4 |           4 |    4 |   4 |         4 |      3 |       3 | Viable alternative                  |
| Firebase + RN                     |           3 |         5 |               3 |        3 |           4 |    3 |   4 |         5 |      5 |       2 | Weak for relational product graph   |
| Web-first PWA                     |           2 |         4 |               4 |        3 |           4 |    5 |   4 |         4 |      5 |       4 | Bad for native camera/subscriptions |

**Recommended stack**

- Frontend: Expo React Native, TypeScript, Expo Router.
- Backend: Supabase Postgres, RLS, Edge Functions.
- Product catalog imports: Node scripts, DuckDB optional for large Open Beauty Facts exports.
- Payments: RevenueCat.
- Analytics: PostHog with privacy scrubbing.
- Errors: Sentry.
- Local data: SecureStore/private local storage, encrypted files for photos.
- AI: deterministic local advisor first; cloud AI later only behind consent and safety gates.

**What to avoid**

- Black-box AI for conflict/safety decisions.
- Scraping proprietary ingredient sites.
- Cloud photo analysis in V1.
- Commerce ranking tied to commission.
- Native dependencies that make Expo builds unstable without clear value.

### 4.6 Monetization Research

| Topic              | Finding                                                                                                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Competitor pricing | [Researched] HadaBuddy Pro is publicly listed at $3.99/month or $29.99/year. Think Dirty premium has been reported at $59.99/year. App Store competitors show IAP ranges. |
| Likely model       | [Decision] Annual-first subscription                                                                                                                                      |
| Free tier          | [Decision] Useful but limited shelf/routine preview                                                                                                                       |
| Trial              | [Decision] 7-day reverse trial, then annual carded trial tests as needed                                                                                                  |
| Upgrade triggers   | First useful conflict, full routine unlock, unlimited checks, photo timeline, reminders                                                                                   |
| Pricing risk       | HadaBuddy anchors low at $29.99/year; premium pricing must prove trust and retention                                                                                      |

### 4.7 Legal, Privacy, And Trust Risks

| Risk                 | Impact                         | Requirement                                              |
| -------------------- | ------------------------------ | -------------------------------------------------------- |
| Name conflict        | Store/legal/customer confusion | Rebrand or counsel clearance                             |
| Consumer health data | Regulatory/privacy risk        | Consumer health privacy policy, consent, deletion/export |
| Face/photos          | Sensitive trust surface        | Local-only default, no score, no faceprint               |
| Medical claims       | App review/legal risk          | Cosmetic language, clinical review, disclaimers          |
| Unreviewed rules     | Safety/trust risk              | Reviewer metadata before production exposure             |
| Catalog licensing    | ODbL/source obligations        | Attribution, source memos, contribution posture          |
| Commerce             | Trust/privacy risk             | Separate consent, disclosure, independence               |
| Community            | UGC moderation risk            | Human moderation before posting                          |

### 4.8 MVP Reality Check

[Decision] User wants full product, so the operational plan is "full product in repo, gated launch in market."

**Must be production-real before paid public launch**

- Rebrand.
- Reviewed conflict/routine/safety copy.
- Live Supabase.
- Live RevenueCat.
- Useful catalog/manual fallback.
- Native camera/device QA.
- Final legal/privacy policies.
- Closed beta proof.

**Can exist but stay hidden/flagged**

- Cloud Ask.
- Trend analysis.
- Peer community posting.
- Affiliate commerce.
- Advanced recommendations.
- Widgets/live activities.

**Simplest sellable version**

Shelf + reviewed conflict card + AM/PM routine + Today + private progress + annual Pro.

### 4.9 Research-Based Recommendation

[Decision] Narrow further in positioning, not necessarily in code. Keep full product architecture, but make public launch about shelf/routine/progress only.

## 5. Revenue Goal: $30k/Month Plan

### Subscriber Math

[Decision] Plan around 10,000-14,000 active subscribers, not the optimistic minimum.

| Scenario                        |                                                           Formula | Subscribers Needed |
| ------------------------------- | ----------------------------------------------------------------: | -----------------: |
| $30k/month gross at $49.99/year |                                                   360,000 / 49.99 |        about 7,202 |
| After 15% store fee             |                                         360,000 / (49.99 \* 0.85) |        about 8,473 |
| After 30% store fee             |                                         360,000 / (49.99 \* 0.70) |       about 10,288 |
| Safer operating target          | includes refunds, taxes, discounts, churn, failed payments, tools |      10,000-14,000 |

### Funnel Targets

[Decision under uncertainty] Use these as planning targets until real beta data replaces them.

| Metric                           |                                  Target |
| -------------------------------- | --------------------------------------: |
| Product add completion           | 60%+ of onboarded users add 3+ products |
| First useful insight             |                   40%+ in first session |
| First check-off                  |                  35%+ in first 24 hours |
| D7 return                        |                                 25-35%+ |
| D30 retained active              |                                 10-15%+ |
| Trial/paywall start              |          5-10%+ depending paywall model |
| Download-to-paid                 |          2.5% median target; 5%+ strong |
| Refund/cancel reason "confusing" |             below 10% of churned payers |

Sources: [RevenueCat 2026](https://www.revenuecat.com/state-of-subscription-apps/) defines D35 download-to-paid, trial-to-paid, retention, RPI, and reports North America D35 conversion median 2.6% with top quartile above 5.6%.

### Path To 10,000 Subscribers

| Stage         | Goal                                                                   |
| ------------- | ---------------------------------------------------------------------- |
| Closed beta   | 50-100 users; prove first insight and D7 behavior                      |
| Early launch  | 300-1,000 payers; validate price and churn                             |
| Growth fit    | 2,000-4,000 payers; scale creator/ASO/content                          |
| Revenue scale | 10,000+ active payers; optimize retention, referrals, creator channels |

## 6. Product Scope

### Full Product Scope

[Decision] The public release is iOS-only and includes every feature in
`docs/FEATURE_INDEX.md` plus every required surface in
`docs/hugeToDo/launch-contract.json`. The primary shelf -> insight -> routine ->
Today loop remains the positioning core, but no indexed feature may be deferred
or hidden to satisfy launch.

### Launch-Core

- Rebrand.
- Onboarding and health/privacy consent.
- Shelf add: manual, search, barcode when ready.
- Reviewed conflict checks.
- Routine builder and Today check-off.
- Private photo timeline.
- Reminders.
- Paywall/RevenueCat.
- Basic analytics and support.

### Required High-Risk Surfaces

- Recommendations.
- Shareable conflict cards.
- Ask advisor.
- Commerce.
- Trend insights.
- Community/Skin Notes.

These surfaces remain fail-closed until their full implementation, review,
live-service, physical-iPhone, operational, and production gates pass. The gate
controls exposure during development and incidents; it does not remove the
surface from release scope.

### Prohibited Claims And Behaviors

- AI diagnosis.
- Skin score/skin age.
- Medical treatment claims.
- Commission-biased ranking.
- Cloud photo analysis.

## 7. Grouped Feature Notes

The authoritative 20-feature numbering and launch inclusion status is in
`docs/FEATURE_INDEX.md`. The grouped notes below predate that normalized index
and remain useful only for product detail.

Feature 1: Rebrand And Identity Migration

- Feature summary: Replace public `OnSkin` identity with cleared brand.
- User problem solved: Avoid confusion with incumbent app.
- Business reason: Prevent legal, ASO, support, and store-review risk.
- Priority: Must-have.
- MVP inclusion: Yes.
- Complexity: Medium.
- Dependencies: Counsel/founder name decision.
- Main user story: As a user, I can identify the app clearly and not confuse it with another scanner.
- UX surfaces needed: app name, icon, splash, store copy, policy URLs, share watermark.
- Data needed: final name, domain, bundle ID, package ID, scheme.
- Backend/API needs: project names and URLs.
- Frontend/UI needs: copy/branding replacement.
- Security/privacy concerns: policy links must match final legal entity.
- Analytics events: brand migration QA only.
- Acceptance criteria: no public `OnSkin` references in launch assets.
- Edge cases: internal package names may remain temporarily if not user-facing.
- Codex implementation notes: search for `OnSkin`, `onskin`, `com.onskin.app`.
- Open questions: final cleared mark.

Feature 2: Shelf Intake

- Feature summary: Add owned products by barcode, search, OCR, or manual.
- Priority: Must-have.
- MVP inclusion: Yes.
- Complexity: High.
- Dependencies: catalog, camera, local store.
- Acceptance criteria: user can add 3 products without dead end.
- Open questions: launch catalog source and match-rate target.

Feature 3: Reviewed Conflict Engine

- Feature summary: Detect and explain conflicts/synergies from owned products.
- Priority: Must-have.
- MVP inclusion: Yes.
- Complexity: High.
- Dependencies: reviewer signoff, rules, tags.
- Acceptance criteria: production exposes only reviewed rules.
- Open questions: reviewer availability and signoff format.

Feature 4: Routine Builder

- Feature summary: Convert shelf and profile into AM/PM routine.
- Priority: Must-have.
- MVP inclusion: Yes.
- Complexity: High.
- Dependencies: shelf, rules, profile.
- Acceptance criteria: generated plan is explainable and editable.

Feature 5: Today Check-Off

- Feature summary: Daily AM/PM routine completion loop.
- Priority: Must-have.
- MVP inclusion: Yes.
- Complexity: Medium.
- Dependencies: routine plan, local persistence.
- Acceptance criteria: check-off persists after navigation/relaunch.

Feature 6: Photo Progress

- Feature summary: Private photo timeline and comparison.
- Priority: Should-have.
- MVP inclusion: Yes if device QA passes.
- Complexity: High.
- Dependencies: camera, encrypted local storage, app lock.
- Acceptance criteria: no cloud upload by default; no score claims.

Feature 7: Paywall And Entitlements

- Feature summary: RevenueCat annual-first Pro with reverse trial.
- Priority: Must-have.
- MVP inclusion: Yes.
- Complexity: High.
- Dependencies: final brand, store products, RevenueCat, policies.
- Acceptance criteria: purchase/restore/refund/expiry work in sandbox.

Feature 8: Recommendations

- Feature summary: Goal/profile/shelf-aware recommendations.
- Priority: Should-have.
- iOS launch inclusion: Required after catalog and professional review.
- Complexity: High.
- Dependencies: catalog quality, commerce independence.

Feature 9: Ask Advisor

- Feature summary: Reviewed deterministic local guidance plus a production
  cloud path with grounded citations, safety controls, consent, and cost limits.
- Priority: Launch-required.
- iOS launch inclusion: Required.
- Complexity: Medium to High.
- Dependencies: reviewed corpus, guardrails, consent.

Feature 10: Shareable Conflict Card

- Feature summary: Watermarked share card for reviewed conflicts.
- Priority: Should-have.
- MVP inclusion: Yes after reviewed rules.
- Complexity: Medium.
- Dependencies: conflict engine, deep links, final brand.

Feature 11: Commerce

- Feature summary: Where-to-buy and replenishment links.
- Priority: Launch-required.
- iOS launch inclusion: Required after rail, legal/privacy, ranking-isolation,
  disclosure, reconciliation, and device gates pass.
- Complexity: High.
- Dependencies: consent, FTC disclosure, partner, attribution.

Feature 12: Community/Skin Notes

- Feature summary: Reviewed expert notes plus production community posting,
  reporting, blocking, moderation, appeals, and support.
- Priority: Launch-required.
- iOS launch inclusion: Required.
- Complexity: High.
- Dependencies: moderation, reviewer network, legal.

Feature 13: Trend Insights

- Feature summary: Descriptive within-person progress notes.
- Priority: Launch-required.
- iOS launch inclusion: Required after a real engine, calibration, fairness,
  privacy, device, and professional-review gates pass.
- Complexity: High.
- Dependencies: fairness/device/legal review.

Feature 14: Widgets/Live Activities

- Feature summary: Glanceable routine reminders.
- Priority: Launch-required.
- iOS launch inclusion: Required with real WidgetKit and ActivityKit targets.
- Complexity: High.
- Dependencies: native builds and platform QA.

## 8. Feature Priority Matrix

| Feature         | User Value | Revenue Impact | Differentiation | Complexity | Risk Reduction | Dependency | MVP Need |
| --------------- | ---------: | -------------: | --------------: | ---------: | -------------: | ---------: | -------: |
| Rebrand         |          5 |              5 |               3 |          3 |              5 |          5 |        5 |
| Shelf Intake    |          5 |              5 |               4 |          4 |              4 |          5 |        5 |
| Conflict Engine |          5 |              5 |               5 |          4 |              5 |          5 |        5 |
| Routine Builder |          5 |              5 |               5 |          4 |              4 |          5 |        5 |
| Today Check-Off |          5 |              5 |               3 |          3 |              3 |          4 |        5 |
| Photo Progress  |          4 |              4 |               4 |          4 |              4 |          3 |        4 |
| Paywall         |          4 |              5 |               2 |          4 |              4 |          5 |        5 |
| Share Card      |          4 |              4 |               5 |          3 |              2 |          3 |        3 |
| Recommendations |          3 |              3 |               3 |          4 |              2 |          3 |        2 |
| Ask             |          3 |              3 |               2 |          4 |              2 |          2 |        1 |
| Commerce        |          2 |              3 |               2 |          4 |              1 |          2 |        1 |
| Community       |          2 |              2 |               3 |          5 |              1 |          1 |        1 |

## 9. UX And Product Design Plan

### Information Architecture

Primary tabs:

- Today
- Shelf
- Progress
- You

Secondary routes:

- Add product
- Product detail
- Conflict detail
- Routine edit
- Paywall
- Settings
- Privacy controls
- Ask
- Recommendations
- Community/Skin Notes
- Commerce/transparency

### Onboarding Flow

1. Welcome with privacy promise.
2. Age gate.
3. Health data consent.
4. Goals and skin profile.
5. Add first products.
6. Analyzing/reveal.
7. First useful shelf/routine insight.
8. Today routine.
9. Paywall after value or reverse trial.

### Empty States

- Shelf empty: "Add what you already use."
- Today empty: "Build a routine from your shelf."
- Progress empty: "Take a baseline photo. No score."
- Ask empty: "Add products for shelf-aware answers."

### Error States

No dead ends. Every scan/catalog/camera failure must offer manual add or safe exit.

### Accessibility

- Minimum 44 pt touch targets.
- No color-only badges.
- Dynamic type support.
- VoiceOver labels for product, conflict, date, completion state.
- Reduce Motion respected.

## 10. Technical Architecture

### High-Level Diagram

```text
Expo mobile app
  -> local private storage for shelf, photos, completions
  -> central exact-session admission for authenticated Supabase requests
  -> Supabase Auth/Postgres/RLS for account, catalog, publication fences
  -> separate RevenueCat entitlement and no-card reverse-trial projections
  -> Supabase Edge Functions for deletion/export, webhook, grants, reconciliation
  -> RevenueCat SDK for IAP/subscriptions behind a durable transaction journal
  -> PostHog for consented analytics
  -> Sentry for scrubbed crash reporting
  -> Open Beauty Facts/CosIng import pipelines for catalog data
```

### Decision: Current Stack

[Decision under uncertainty] Keep Expo React Native + Supabase + RevenueCat because the repo is already implemented around it, and it fits camera-heavy, subscription mobile development.

| Criteria                  | Score |
| ------------------------- | ----: |
| Product fit               |     5 |
| Speed to MVP              |     5 |
| Long-term maintainability |     4 |
| Security                  |     4 |
| Scalability               |     4 |
| Cost                      |     4 |
| Developer experience      |     5 |
| Ecosystem maturity        |     5 |
| Hiring availability       |     5 |
| Vendor lock-in risk       |     3 |

### Tradeoffs

- Expo is fast, but native camera/OCR/widgets need custom build verification.
- Supabase RLS is strong, but policies must be adversarially tested.
- RevenueCat speeds billing, but store setup still blocks launch.
- Local-first privacy is strong, but multi-device sync is deferred.

### 2026-07-15 Integrated Source Checkpoint

[Confirmed] The prior fully verified source checkpoint has 53 migrations through
`20260715000054_health_consent_withdrawal_lifecycle.sql`. The combined local verification
passed two clean resets, 261 pgTAP assertions (46 schema + 215 health-consent lifecycle),
database lint, an empty shadow diff, 77/77 public tables with RLS, and an exact
54-private-table classification (40 directly queryable + 14 sealed). Phase 9 health-consent verification passed 104 Deno tests
plus 7 evidence tests. The authority-lane rehearsals
pass on PostgreSQL 15 and 17. Focused server suites pass 20/20 subscription reconciliation,
8/8 subscription grants, 20/20 atomic RevenueCat webhook, and 215/215 durable deletion;
the focused mobile server contract passes 2/2. The mobile workspace passes 266 test files /
3,026 tests plus typecheck and lint.

[Confirmed] This checkpoint centralizes exact-session remote admission and controlled
refresh, synchronously closes Supabase and RevenueCat publication during account
replacement/deletion, separates the RevenueCat and no-card grant authorities, projects
both through an owner-derived RPC, reconciles only against a fresh provider
`request_date`, and durably journals native purchase/restore admission.

[Open Question] This is source-only evidence. Hosted migrations, live Supabase/RevenueCat
and App Store sandbox behavior, physical-iPhone QA, professional review, final privacy/
legal approval, and App Review remain open. The subsequent migration-0055 source
candidate implements Apple authorization-code plus state/nonce capture, a versioned
encrypted token vault, daily token validation, canonical signed server notifications,
native credential invalidation, terminal event-before-identity reconciliation before code
exchange, and an authoritative exact-session access fence.
Hosted cutover, primary-App-ID delivery, Vault/Cron continuity, existing-account
recapture, key rotation/rollback, stale-JWT denial, and physical-iPhone/TestFlight proof
remain open. Successful daily validation advances the subject digest and freshly seals
the refresh token under the current keys, but dormant or failing rows still require
zero-row evidence, recapture/reauthorization, or lifecycle retirement. `TRANSFERRED`
fails closed as `credential_transferred`, but no transfer/migration policy is approved.

[Confirmed] The migration-0055 candidate subsequently passed two clean resets,
exact 54-migration history through 0055, the full structural pgTAP suite plus
114/114 Apple lifecycle assertions, schema lint, an empty shadow diff, temporary
type generation, 20/20 focused Apple event/lifecycle Edge tests, and the 47-test
Apple auth work lane. This closes the local source replay gate only; every hosted,
Apple-provider, device, professional-review, and App Review gate above remains open.

## 11. Data Model Summary

Main entities:

- `profiles`
- `skin_profiles`
- `consents`
- `user_products`
- `products`
- `ingredients`
- `product_ingredients`
- `conflict_rules`
- `routine_conflicts`
- `routines`
- `routine_steps`
- `routine_completions`
- `photos`
- `notification_preferences`
- `entitlements`
- `reverse_trial_grants`
- `subscription_events`
- `account_publication_leases`
- `catalog_reports`
- `analytics_events`

Data retention:

- The source deletion lifecycle covers registered user-owned data and advertises an
  honest provider-verification window of up to 29 days; live end-to-end erasure proof
  remains a launch gate.
- Photos local-only by default.
- Catalog provenance retained.
- Subscription events retained for finance/legal reconciliation.
- Audit logs minimized and redacted.

## 12. Security, Privacy, And Trust

Rules:

- Owner-scoped RLS on all user tables.
- Service-role only for trusted backend jobs.
- All authenticated mobile Supabase traffic uses one exact-session admission gate and
  controlled refresh path; account deletion, owner replacement, invalid credential
  state, or lease failure closes new remote/provider publication synchronously.
- No sensitive health/photo data in analytics or logs.
- Granular consent for health data, photos, analytics, commerce, cloud Ask, community.
- Health-consent withdrawal must have a reviewed non-destructive design; deleting the
  entire account is not an acceptable substitute for withdrawing one consent purpose.
- Data export and deletion must work against live backend.
- Do not expose unreviewed rules in production.
- Do not store faceprints, embeddings, identity vectors, or cloud photo analysis by default.
- Exact privacy-report, privacy-policy, support, and other App Store URLs plus stable
  non-expiring review/demo access must be verified in the submitted candidate.

Compliance areas:

- App Store policies.
- Consumer health data privacy, especially Washington MHMDA.
- GDPR/UK/EU where launched.
- CCPA/CPRA if applicable.
- FTC advertising and affiliate disclosure.
- Auto-renewal subscription rules.
- ODbL/source licensing.
- Trademark clearance.

## 13. Monetization Plan

### Free Tier

- Quiz result.
- Basic shelf.
- One or limited conflict check.
- Basic Today preview.
- User data remains exportable/deletable.

### Paid Tier

RoutineKind Pro:

- Unlimited conflict checks.
- Full routine builder.
- Skin-cycling scheduler.
- Photo progress timeline.
- Reminders/adherence.
- Production Ask and recommendations after their mandatory review gates.

### Pricing

[Decision under uncertainty] Test:

- Annual: $49.99/year.
- Monthly: $8.99-$9.99/month.
- No weekly plan.

### Trial Strategy

- 7-day reverse trial with no card after onboarding value.
- Optional store-backed 14-day trial test after RevenueCat live.
- Keep the no-card grant in `reverse_trial_grants`; never write it into or revoke the
  ordered RevenueCat `entitlements` projection. Read both through the owner-derived
  no-argument projection RPC.
- On iOS, billing and cancellation copy names the App Store only. Purchase and restore
  admission is durably journaled so an unresolved native transaction blocks a repeat
  purchase and directs the user to restore instead.

### Upgrade Triggers

- First reviewed conflict.
- Full routine unlock.
- Photo timeline setup.
- Unlimited checks.
- Reverse-trial expiry.

### Churn Risks

- User never adds enough products.
- Guidance not trusted.
- Scanner misses too often.
- Paywall appears before value.
- Routine does not become habit.

## 14. Analytics And Metrics

### Activation Metric

[Decision] First useful insight plus first routine check-off within 24 hours.

### Core Events

- `onboarding_started`
- `health_consent_granted`
- `product_add_started`
- `product_added`
- `barcode_scanned`
- `scan_matched`
- `scan_no_match`
- `first_useful_insight`
- `conflict_detected`
- `conflict_detail_viewed`
- `routine_created`
- `first_checkoff_completed`
- `routine_checkoff_completed`
- `cycle_night_completed`
- `photo_baseline_added`
- `paywall_shown`
- `reverse_trial_started`
- `trial_started`
- `purchase_completed`
- `subscription_cancel_intent`
- `share_card_exported`

### Dashboards

- Onboarding funnel.
- Shelf add funnel.
- First insight funnel.
- Today retention cohort.
- Paywall and subscription cohort.
- Catalog miss/wrong-match report.
- Privacy/consent state.
- Crash/error rate.

## 15. Build Roadmap

### Phase 0: Strategy And Identity

Goal: remove existential brand risk.

Done criteria:

- final name selected
- counsel/domain/social checks recorded
- public code/config/copy migration plan

### Phase 1: Launch Gates

Goal: make core trust systems real.

Done criteria:

- reviewer signoff path
- live Supabase staging
- RevenueCat sandbox
- exact final policy/support/privacy-report URLs and non-expiring review/demo access
- device QA plan
- reviewed non-destructive health-consent withdrawal and complete Sign in with Apple
  server credential lifecycle

### Phase 2: Core Workflow

Goal: shelf -> insight -> routine -> check-off.

Done criteria:

- 3 product add paths work
- reviewed conflicts show
- routine generated
- Today check-off persists

### Phase 3: Revenue And Analytics

Goal: test willingness to pay.

Done criteria:

- paywall after value
- no-card reverse trial and RevenueCat entitlements remain independent
- RevenueCat webhook ordering and bounded provider reconciliation work
- durable purchase/restore journal prevents unsafe repeat transactions
- PostHog funnel dashboard works

### Phase 4: Closed Beta

Goal: prove retention and trust.

Done criteria:

- 50-100 users
- D7/D14 metrics
- catalog issue review
- churn interviews
- all-features TestFlight coverage, including OCR, Ask, commerce, community,
  trends, widgets, Live Activities, links, sharing, and operator workflows

### Phase 5: Public Launch

Goal: controlled store launch.

Done criteria:

- store metadata reviewed
- support ready
- crash/privacy dashboards live
- launch ring plan

### Phase 6: Growth

Goal: scale toward 10,000+ payers.

Done criteria:

- ASO baseline
- creator seeding
- share card attribution
- retention improvements

## 16. Codex Build Strategy

- Work in small, reviewable launch-gate slices.
- Read source docs before editing.
- Update docs and readiness status when behavior changes.
- For UI-facing changes, run human-simulated E2E.
- Do not expose flagged features without the relevant gate.
- Prefer local deterministic logic for safety-relevant surfaces.
- Keep customer-facing copy claim-safe.

## 17. Risks And Open Questions

### Product Risks

- The app is too broad to explain.
- Users do not add enough products.
- First insight is weak.
- Routine does not become habit.

### Market Risks

- Existing OnSkin owns the scanner/name lane.
- HadaBuddy attacks the same shelf-to-routine workflow at lower price.
- AI beauty apps may capture attention with bolder claims.

### Technical Risks

- Catalog match rate poor.
- Camera/OCR unreliable on devices.
- Supabase RLS mistakes.
- RevenueCat entitlement bugs.
- Old clients bypassing the publication/authority-lane rollout.
- Incomplete Sign in with Apple token and server-notification lifecycle.
- Local photo storage edge cases.

### Legal/Privacy Risks

- Consumer health data handling.
- Destructive or ambiguous health-consent withdrawal.
- Face/photo data trust.
- Unreviewed medical-adjacent claims.
- ODbL/source obligations.
- Affiliate disclosure.
- UGC moderation.

### Open Questions

- What final brand is cleared?
- Who signs off clinical/cosmetic rules?
- What countries launch first?
- What exact free tier creates word-of-mouth without killing conversion?
- What catalog coverage threshold is acceptable?
- Which beta metrics kill or greenlight public launch?
- What approved Apple account-transfer policy applies after fail-closed
  `credential_transferred`?

## 18. Final Build Order

1. Reconcile the iOS all-features governance contract and validators.
2. Finalize brand recommendation, clearance packet, and account decisions.
3. Establish iOS/EAS and live staging foundations.
4. Complete auth, data rights, catalog, native OCR, Shelf, and reviewed guidance.
5. Complete the core routine/Today loop, photos, trends, payments, Ask,
   commerce, community, widgets, Live Activities, links, sharing, growth, and
   operator tooling.
6. Incorporate professional decisions tied to exact source hashes.
7. Run automated, human-simulated, live-staging, physical-iPhone,
   accessibility, privacy, security, and performance verification.
8. Run the all-features TestFlight beta and close every P0/P1.
9. Build and inspect the production candidate and App Store packet.
10. Submit only when authorized, respond to review, and launch under staffed
    monitoring and rollback controls.

## 19. Master Plan Update System

Future changes must use the patch format in `docs/MASTER_PLAN_UPDATE_PATCH.md`:

- Change proposed
- Reason/evidence
- Affected docs
- Affected features
- Risk
- Recommendation

No major strategy, architecture, pricing, privacy, or launch claim change should be made silently.

## 20. Sources

- [RevenueCat State of Subscription Apps 2026](https://www.revenuecat.com/state-of-subscription-apps/)
- [Apple App Store Small Business Program](https://developer.apple.com/app-store/small-business-program/)
- [Google Play service fees](https://support.google.com/googleplay/android-developer/answer/112622?hl=en)
- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [OnSkin App Store](https://apps.apple.com/kz/app/onskin-beauty-product-scanner/id1630768985)
- [OnSkin website](https://onskin.com/)
- [HadaBuddy](https://www.hadabuddy.com/)
- [HadaBuddy FAQ](https://www.hadabuddy.com/faq)
- [Thea App Store](https://apps.apple.com/us/app/thea-1-beauty-app/id6523434295)
- [Nolla Skin App Store](https://apps.apple.com/us/app/nolla-skin/id6741805934)
- [SkinSort](https://skinsort.com/)
- [SkinSort Routine Creator](https://skinsort.com/routine)
- [Skin Bliss](https://www.getskinbliss.com/)
- [Yuka](https://yuka.io/en/)
- [Yuka Google Play](https://play.google.com/store/apps/details?id=io.yuka.android&hl=en_US)
- [Think Dirty](https://www.thinkdirtyapp.com/)
- [Think Dirty App Store](https://apps.apple.com/us/app/think-dirty-shop-clean/id687176839)
- [Open Beauty Facts GitHub](https://github.com/openfoodfacts/openbeautyfacts)
- [Open Food Facts ODbL license](https://wiki.openfoodfacts.org/ODBL_License)
- [European Commission CosIng](https://single-market-economy.ec.europa.eu/sectors/cosmetics/cosmetic-ingredient-database_en)
- [Washington Attorney General MHMDA](https://www.atg.wa.gov/protecting-washingtonians-personal-health-data-and-privacy)
- [Washington RCW 19.373](https://app.leg.wa.gov/RCW/default.aspx?cite=19.373&full=true)
- [McKinsey Future of Wellness 2025](https://www.mckinsey.com/industries/consumer-packaged-goods/our-insights/future-of-wellness-trends)
- [American Academy of Dermatology stats](https://www.aad.org/media/stats-numbers)
