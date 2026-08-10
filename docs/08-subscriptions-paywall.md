# Document 8: Subscriptions, Paywall & Go-to-Market (RevenueCat) — Build Spec

_The monetization + acquisition engine · the conversion-model choice (reverse trial, A/B-tested vs. hard paywall) · packaging & premium pricing (annual default, trial) · the onboarding paywall, contextual upsells & the compliance UI · RevenueCat Offerings / Paywalls / purchase / restore / entitlement-gating · the anonymous→paid flow · trial & subscription lifecycle · the go-to-market / acquisition model (creator-led, channel–model fit) · store compliance (IAP, Guideline 3.1.2, external-link, auto-renewal laws) · honest-by-design = compliant-by-design = trust-maximising._

> This is build-order document **#8** of the 15 named in docs/00 (§"Build order", item 8: _"Subscriptions/paywall (RevenueCat)"_). It is the **monetization engine** — the surface where everything the prior documents built becomes revenue — and, in this revised edition, it also specifies the **go-to-market / acquisition model** (§11), because the right conversion model and the right acquisition channel are a single, coupled decision. Its paywall's **four value props are the features the earlier docs deliver**: _routine intelligence — order, timing, skin cycling_ (docs/03 + docs/05), _ingredient conflict checks with evidence grades_ (docs/02), _private photo timeline — on-device only_ (docs/06), and _reminders, streaks & home-screen widgets_ (docs/07). It _implements_ the conversion moment inside the funnel docs/01 §2 designed (guest-first → quiz → personalization "aha" → offer), _extends_ docs/01's `entitlements` mirror and RevenueCat-webhook plumbing (§4/§8), and _executes_ docs/00's RevenueCat strategy. It renders the spec's paywall (p7: the four value props, "Start 14 days free," "We'll remind you 2 days before the trial ends · Cancel anytime"). **This is where the seven-figure business is realized** — and its central principle is that, for this product, **honest-by-design is also compliant-by-design, trust-maximising-by-design, and (correctly modelled) revenue-maximising-by-design.**
>
> **Revision note (this edition).** An earlier draft recommended a _hard_ onboarding paywall as the settled default. On review, that mismatches how skincare apps actually acquire users (discovery channels, not high-intent search) and contradicts the word-of-mouth/trust acquisition thesis. This edition makes the **reverse trial the default conversion model** (A/B-tested against a hard paywall), adds the **go-to-market section (§11)**, and recommends **testing a premium price** above the original $39.99. The reasoning is in §2, §5, §10, and §11.

> **Current publication boundary (2026-07-26):** the historical interaction,
> sequencing, skin-cycling, widget, and professional-review propositions are
> target-state copy, not an authorized description of the current
> zero-admission build. Until the exact capability and review gates pass, the
> runtime paywall may sell only functionality that is actually available, must
> disclose that health-related guidance is under independent review, and must
> not claim dermatologist review or imply payment unlocks unavailable guidance.

> **Primary-source App Store revalidation (2026-08-08):** This is a planning
> checkpoint, not App Review approval. Apple’s current
> [App Review Guidelines 3.1.2](https://developer.apple.com/app-store/review/guidelines/)
> require an auto-renewable subscription to deliver ongoing value, run for at
> least seven days, work on every device where the app is available, and never
> use bait-and-switch or make users perform unrelated tasks to receive their
> paid entitlement. The first subscription group and auto-renewable product
> must be submitted with a new app version, with subscription review material,
> under Apple’s current
> [App Store Connect submission process](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-in-app-purchase)
> and [subscription setup guidance](https://developer.apple.com/help/app-store-connect/manage-subscriptions/offer-auto-renewable-subscriptions/).
> The app-granted Explore-first period remains separate from StoreKit: it must
> not be described as an Apple free trial, subscription offer, or an approved
> product until the exact App Store Connect configuration, reviewer evidence,
> and release signoffs exist.

---

## TL;DR

- **The paywall is where all the prior work becomes revenue, and its four value props are the features docs/02–07 already built.** This document specifies the **conversion model, the packaging, the paywall UI, the RevenueCat integration, the trial/subscription lifecycle, the go-to-market/acquisition model, the store compliance, and the optimisation** that turn that value into a subscription — the conversion _and acquisition_ engine on top of the value engine.

- **The conversion model is a reverse trial, not a hard paywall — because the model must match the channel.** Hard paywalls convert ~5× better per install (RevenueCat SOSA 2026: **10.7% vs 2.1%** Day-35) and earn ~8× the revenue-per-install — _but_ hard paywalls fit **high-intent channels (Search, ASO)**, whereas **discovery-channel users (TikTok/#SkinTok, Instagram) convert better on softer models that let them experience value first** (Airbridge, 2026). Skincare acquisition is overwhelmingly _discovery_-driven, and Layerwell's thesis is word-of-mouth/trust — and RevenueCat itself says _"freemium remains the right call when free users drive word of mouth."_ So Layerwell ships a **reverse trial** (full Pro free for ~7 days, no card, after a dismissed offer → then drop to a useful free tier, triggering loss aversion) — the best of both: discovery users experience the value, the habit and "aha" form, and non-converters stay as a free evangelist base.

- **This is a measured decision, not a faith one.** The reverse trial is the **default**, and **"reverse trial vs. hard paywall" is the first mandatory A/B test**, judged on **blended LTV-per-install × reach** (not per-install conversion alone, which structurally flatters the hard paywall). A trial in _some_ form is correct regardless: trial-inclusive paywalls win **64.5%** of head-to-head A/B tests (Adapty 2026).

- **Annual default, a trial, and value-first onboarding are confirmed right.** Health & Fitness is the only category where **annual dominates revenue (68%)**, and **annual retains far better (~19.9% at Day 380 vs 14.2% monthly vs 5.5% weekly)**; **~half of conversions happen Day 0** and a paywall before context "feels jarring," so the quiz→aha→offer sequence sets the ceiling. No weekly plan (5.5% retention, off-brand).

- **Price up: test a premium tier.** Counterintuitively, **higher-priced apps convert downloads ~2× better than low-priced apps** (RevenueCat 2026), and a premium price needs fewer subscribers for seven figures. The original **$39.99/yr is likely under-priced**; test **$49.99–$59.99/yr** against it, judged on LTV (higher price correlates with somewhat lower renewal, so net it out).

- **The go-to-market model is creator-led, not "zero marketing."** Beauty is _the_ creator category (eMarketer: influencer endorsements matter more to beauty buyers than in any other category), and **Layerwell's features _are_ the content creators make** (before/after, routines, "is your routine wrong?"). The blend: **(1) creator/#SkinTok/UGC as the spine, amplified by TikTok Spark Ads** (organic → scalable paid); **(2) content/SEO from the ingredient/conflict engine** (a compounding organic moat); **(3) ASO** (the high-intent baseline); **(4) paid UA measured strictly to LTV**; **(5) privacy-trust as the messaging spine** across all of it (the differentiator and word-of-mouth catalyst — Yuka's engine — _not_ a standalone channel). The reel-them-in hooks: the **conflict-check verdict** ("Is your routine fighting itself?"), the **skin-cycling/#SkinTok tie-in**, the **before/after**, and the **privacy angle**.

- **RevenueCat is the spine, honest-by-design is compliant-by-design.** Offerings/Packages/Entitlements + Paywalls + StoreKit 2/Play Billing + Restore + the idempotent, event-type-correct webhook→`entitlements` mirror (also carrying the app-granted **reverse-trial entitlement**), with offline-safe gating. Apple's **Guideline 3.1.2** (early-2026 enforcement) requires the **billed amount be the most conspicuous price**, **Terms + Privacy + Restore in the paywall**, **no free-trial _toggle_ on iOS**, and **no "tricks"** — exactly Layerwell's honest brand, which also satisfies the tightening **auto-renewal laws** and **maximises trust→willingness-to-pay**.

- **Seven-figure verdict: yes — but execution-dependent, and the creator-led + reverse-trial + trust model is the credible path.** The market is real and growing (skincare apps ~$500M→~$1.8B atop a ~$165B products industry; subscriptions the fastest-growing app model; fragmented), and the math works (**~17–25k annual subscribers ≈ ~$1M ARR**, the lower end at a premium price). But outcomes are polarised — the **median subscription app makes ~$8.3K MRR at 18 months**, the **top 5% make $1.16M+/month**, and pre-2020 apps still earn 69% of subscription revenue — so seven figures requires **top-quartile conversion + retention + a real acquisition engine**, not a generic paywall and not "zero marketing." Honest risks: ~⅓ cancel annual auto-renew in month 1; 2–5% refund; the reverse trial's "engagement > exposure" precondition; creator-channel and attribution dependence.

---

## Key Findings

1. **The paywall converts the value the prior docs built; this layer also owns the acquisition model.** Value props map to docs/02 (conflicts), docs/03+05 (routine/scheduler), docs/06 (photos), docs/07 (reminders/streaks/widgets); this layer owns the conversion model, packaging, the paywall, RevenueCat, lifecycle, **go-to-market**, compliance, and optimisation.

2. **The conversion model must match the acquisition channel — the central finding.** Hard paywalls force an immediate decision and suit **high-intent channels (Search, ASO)**; soft/freemium/reverse-trial models let users experience value first and **convert discovery-channel users (TikTok, Instagram) better** (Airbridge 2026). Skincare is discovery-driven, so a pure hard paywall is the wrong fit.

3. **The reverse trial is the best-of-both model, and RevenueCat endorses it.** Give temporary full-Pro access after a dismissed offer, no card; users experience value, then loss aversion fires when access drops — _if_ they engage during the window ("engagement > exposure," RevenueCat 2026). For Layerwell the precondition is met (daily routine, instant conflict check, photos begin day one). It also preserves a free evangelist base, which RevenueCat says is exactly when freemium beats a hard paywall.

4. **A trial in some form is right; decide the model by experiment.** Trial-inclusive paywalls beat visual-only in **64.5%** of A/B tests (Adapty 2026). "Reverse trial vs. hard paywall" is the **first mandatory A/B**, judged on **blended LTV-per-install × reach**, since per-install conversion structurally favours the hard paywall (which discards all non-payers).

5. **Annual default and value-first onboarding are confirmed.** H&F is **68% annual**; annual retains **~19.9% at D380 vs 14.2% monthly vs 5.5% weekly**; **~50% of conversions happen Day 0** and a context-free paywall "feels jarring" (RevenueCat 2026). No weekly plan.

6. **Premium pricing is viable and probably better.** **Higher-priced apps convert downloads ~2× better than low-priced apps** (RevenueCat 2026); a premium price lowers the subscriber count needed for seven figures. Test **$49.99–$59.99/yr** vs $39.99 on LTV.

7. **Beauty is the #1 creator category, and Layerwell's features are the content.** Influencer endorsements matter more to beauty buyers than in any other category (eMarketer 2025); the top beauty content formats are GRWM, tutorials, honest first-impressions, **before/afters**, and **routines** — which map directly to Layerwell's photo timeline, conflict engine, and routine builder. **TikTok Spark Ads** turn top organic creator content into a scalable paid channel (#TikTokMadeMeBuyIt: 77.8B+ views).

8. **"Zero marketing" is the wrong plan; a deliberate creator-led blend is right.** Yuka's zero-marketing $7.3M is an outlier; the realistic engine is creator/#SkinTok/UGC + content/SEO (the ingredient engine) + ASO + LTV-measured paid UA, with **privacy-trust as the messaging spine** that makes the content spread.

9. **RevenueCat is the integration spine; honest-by-design satisfies Apple 3.1.2, the ARLs, and trust at once.** Offerings/Packages/Entitlements + Paywalls + StoreKit 2/Play Billing + Restore + the idempotent webhook→`entitlements` mirror (also carrying the app-granted reverse-trial entitlement); the honest paywall (conspicuous billed amount, Terms/Privacy/Restore, no toggle) is required _and_ on-brand _and_ WTP-positive.

10. **IAP is mandatory and the durable default; external-link/web checkout is an unsettled, optional lever.** Store IAP via RevenueCat (15% under the Small Business Program / year-2+, else 30%); US external links are currently commission-free but litigated (post-_Epic_, Supreme Court review sought) — revisit, don't build on it (docs/00). Seven figures is achievable but top-quartile-execution-dependent.

---

## Details

### 1. What this layer is — and is not (scope; the boundary with docs/01 §2/§9)

**It is** the monetisation + acquisition engine: the **conversion-model choice** (reverse trial vs hard paywall), the **packaging** (free tier, Pro, pricing, the trial), the **paywall UI** (onboarding + contextual), the **RevenueCat integration** (offerings, paywalls, purchase, restore, the entitlements mirror, gating), the **trial and subscription lifecycle**, the **go-to-market / acquisition model** (§11), the **store/legal compliance**, and the **optimisation/analytics**.

**It is not**, and these boundaries keep it from re-treading docs/01:

- it **does not own the value props themselves** — docs/02–07 build the features; this layer _prices, gates, converts, and acquires for_ them.
- it **does not own the onboarding funnel's quiz/personalization mechanics** — docs/01 §2 owns the funnel; this layer owns the **offer moment within it**, the **purchase + account-link**, and the **acquisition that fills the funnel**.
- it **does not re-derive the conversion benchmarks** — docs/01 §9 established them; this layer _applies_ them, refreshes with current data, and _corrects_ the earlier hard-paywall default.
- it is **not a dark-pattern growth surface** — honest by mandate, by evidence, and by compliance (§9).

### 2. Packaging, the conversion model & pricing

#### 2.1 The conversion model — reverse trial (default), A/B-tested vs. hard paywall

**Why not a pure hard paywall.** A hard paywall converts ~5× better per install and earns ~8× the revenue-per-install (RevenueCat SOSA 2026) — but it (a) **fits high-intent search/ASO traffic, not the discovery traffic skincare actually runs on** (Airbridge 2026: discovery-channel users convert better on softer models that let them experience value), (b) **discards every non-payer** (no evangelists; ~70% higher refunds), which **contradicts the word-of-mouth/trust acquisition thesis** — and RevenueCat itself states freemium is the right call _"when free users drive word of mouth."_ For a trust-differentiated, discovery-acquired, slow-results skincare app, the pure hard paywall is a channel mismatch.

**The model: a reverse trial.** After the personalization "aha," the user sees the **onboarding offer** (§3) with two honest paths:

- **"Start free trial"** → the store trial (card on file via IAP) → 14-day trial → converts to the annual plan. _The committed path (for high-intent users)._
- **"Explore first" / "Not now"** → a **reverse trial**: **~7 days of full Pro access, no credit card**, then access **drops to a useful free tier** and the offer re-presents (loss aversion). _The discovery-channel path (let them feel the value first)._

This captures both populations, hard-walls no one, and — crucially — **keeps non-converters as free-tier users who post UGC and tell friends**, feeding the acquisition engine (§11). Its one precondition (RevenueCat: _"engagement > exposure"_) is met because Layerwell's value is _used daily_: the routine, the instant conflict check, and the photo timeline all engage within the window.

**Decide by experiment, not by faith.** The reverse trial is the **default**; **"reverse trial vs. hard paywall" is the first mandatory A/B test** (§10), judged on **blended LTV-per-install × reach**, because per-install conversion structurally flatters the hard paywall (it excludes the non-payers it loses). A trial in _some_ form ships regardless (trial-inclusive wins 64.5% of A/B tests, Adapty 2026).

#### 2.2 The free tier, the reverse-trial window, and Pro

- **The free tier (the floor and the evangelist base):** the **quiz + the personalized result/reveal** (the "aha," which seeds word-of-mouth), plus a genuinely useful taste — **a basic shelf and a single conflict check**. This is deliberately generous: it is the surface that creates UGC, ASO reviews, and word-of-mouth (§11), and it is the floor the reverse trial drops to. Data is preserved and exportable (docs/01 §4) whether or not the user ever pays.
- **The reverse-trial window:** **~7 days of full Pro**, no card, granted on a dismissed offer (an app-granted entitlement, §4/§8); at expiry → drop to the free tier + re-present the offer.
- **Pro (the four value props, spec p7):** the **full routine intelligence** (builder + scheduler, docs/03/05), the **full conflict/synergy engine with evidence grades** (docs/02), the **private on-device photo timeline** (docs/06), and **reminders, streaks & home-screen widgets** (docs/07).

#### 2.3 The plan matrix & pricing

- **Layerwell Pro · Annual — the default, with a 14-day free trial.** **Test the price: $49.99–$59.99/yr as the premium candidate vs. $39.99 as the baseline** (§10). Higher-priced apps convert downloads ~2× better (RevenueCat 2026), premium positioning fits the brand, and a premium price needs **~17–20k subscribers for $1M ARR vs. ~25k at $39.99**. Judge the winner on **LTV**, since higher price correlates with somewhat lower renewal.
- **Layerwell Pro · Monthly — ~$8.99–$9.99/mo (no trial, or a short trial).** Flexibility + the anchor that makes annual obvious; not the default.
- **No weekly plan.** Weekly retains ~5.5% at D380 and pushing weekly billing is off-brand for a calm health app.
- **A future Pro+ tier** is reserved (the `entitlements` enum already carries `pro`/`pro_plus`, docs/01 §3) for the eventual **Phase-2 AI trend analysis** (doc #12) — not shipped at launch.
- **Regional pricing** via App Store / Play price tiers (annual prices run higher on the App Store than Google Play outside North America, per RevenueCat).

### 3. The paywall (the spec p7 screen, the onboarding offer, contextual upsells & the compliance UI)

#### 3.1 The onboarding offer (the spec's p7)

Placed **after the personalization reveal** (docs/01 §2 step 10), the editorial-clinical paywall (Instrument Serif headline, Hanken Grotesk body, paper/greige/clay/ink palette; docs/00 §8):

- **A personalized headline** tying the plan to the quiz result ("Your plan for dry, sensitive skin is ready").
- **The current zero-admission value props**, each a line with a calm icon:
  _Routine builder — products and missing steps_ · _Ingredient and shelf
  details, with source status_ · _Private photo timeline — on-device only_ ·
  _Reminders and a forgiving streak_. The historical conflict, sequencing,
  skin-cycling, widget, and professional-review claims remain target-state copy
  gated by exact shipped capability and review evidence.
- **The offer, with the billed amount most conspicuous** (3.1.2): "**Start 14 days free**, then **[$49.99]/year**" — the **annual price is the largest, clearest element**.
- **The plan selector** — annual **pre-selected**; monthly secondary. **No free-trial toggle on iOS** (Apple rejects it under 3.1.2); a single clear annual-with-trial offer.
- **Two honest paths (the reverse trial, §2.1):** the primary CTA **"Start free trial"** → store purchase sheet (§3.3); a clearly visible **"Explore first"** → the **reverse trial** (7 days full Pro, no card) → later drop to the free tier + re-present.
- **The trial-reminder reassurance** (spec): "We'll remind you 2 days before the trial ends · Cancel anytime."
- **The auto-renew disclosure** (3.1.2 / ARLs), plain copy below the CTA: the trial converts to the annual price, auto-renews unless cancelled ≥24h before period end, cancel anytime in account settings, ToS + Privacy links.
- **Functional Terms of Use + Privacy Policy links and a Restore Purchases control**, tappable on the paywall itself (3.1.2 requires all three in the binary).
- **The trust block placed _after_ the plans**: while B-DERM-REVIEW is open, it
  states that health-related guidance is under independent review and uses only
  supported privacy claims ("photos stay on your device · no data sales"). A
  dermatologist/cosmetic-chemist credibility claim may appear only after the
  exact B-DERM-REVIEW evidence is approved for the shipped build.

#### 3.2 Contextual / soft paywalls

When a **free-tier** or **expired-reverse-trial** user taps a Pro-gated feature (the full scheduler, the photo timeline, a second conflict check, widgets), a **contextual paywall** appears, framed around _that_ feature ("Unlock your private photo timeline") — higher-intent and honest. Same compliance elements (price, terms, restore). Calm, dismissible, never nagging. For an expired reverse trial, the framing can honestly invoke loss aversion ("Keep your full routine and timeline").

#### 3.3 The purchase sheet & states

The CTA invokes the **native StoreKit / Play purchase sheet** (the OS handles payment, Face/Touch ID, receipt). States: **loading** (fetching offerings), **purchasing** (sheet up), **success** (a calm confirmation + "your plan's ready," continuing into the app), **cancelled** (return to offer, no penalty), **error** (network/store error — retry, never a dead end), **already-subscribed / reverse-trial-active** (detected via entitlement → skip the wall). **Restore Purchases** re-syncs entitlements for reinstalls/device-switches.

#### 3.4 Manage subscription

A **Settings → Subscription** screen shows the current plan/state (Pro, reverse trial with days remaining, or free), the renewal date, and a **"Manage subscription"** deep-link to the **App Store / Play subscription settings** (cancellation, plan changes, billing — OS-handled, one-tap cancel). It surfaces **Restore Purchases**, the **Terms + Privacy** links, and (honestly) how to cancel.

### 4. RevenueCat integration

**The model.** RevenueCat **Offerings → Packages → Entitlements**: an _Offering_ (e.g., "default") contains _Packages_ (annual, monthly) mapped to StoreKit/Play products; granting any activates the **`pro` Entitlement**. The app reads `CustomerInfo.entitlements.active["pro"]` to gate features.

**The reverse-trial entitlement (new).** The reverse trial is an **app-granted, time-boxed entitlement**, _not_ a store transaction: on a dismissed offer, the server writes the one-time window only to `reverse_trial_grants`. RevenueCat store authority remains exclusively in `entitlements`, so a local grant can neither overwrite nor revoke a purchase. The owner-derived read RPC returns both lanes; effective access is active when either verified lane is active. Reverse-trial expiry is derived from the immutable grant timestamp rather than a job that mutates the store projection. RevenueCat promotional access remains provider authority and is not classified as the local reverse-trial lane.

**The paywall rendering.** A **custom native paywall** styled to the editorial-clinical system (§3), reading the offering's localized prices (RevenueCat Paywalls is the faster-to-iterate alternative; decide at build).

**Purchase & restore.** **StoreKit 2** (iOS) / **Google Play Billing** (Android) via the RevenueCat SDK: `purchasePackage()` and `restorePurchases()`; localized prices and intro-offer eligibility from the store; **sandbox / TestFlight** testing for the full purchase, trial, reverse-trial, renewal, and restore matrix before launch.

**The webhook → `entitlements` mirror (extends docs/01 §3).** RevenueCat → **Supabase Edge Function** (service-role, bypasses RLS): read **`event.app_user_id`** (NOT `body.app_user_id` — the common 400 "user*id not found" bug), **return 200 fast**, **idempotent on `event.id`** (RevenueCat is at-least-once, not exactly-once), \*\*handle event \_types* correctly** — grant on `INITIAL_PURCHASE`/`RENEWAL`/`PRODUCT_CHANGE`, revoke on `EXPIRATION`, **never grant on a `CANCELLATION`** (access continues until `expires_at`). The authenticated reconciliation endpoint accepts no subject, fetches bounded RC **`GET /subscribers/{auth.uid}`\*\* server-side, and accepts only a fresh provider `request_date` snapshot. The store mirror and reconciliation write path are service-role only; clients read the combined no-argument projection RPC.

**App-user-ID aliasing (anonymous → authenticated).** Initialise RevenueCat with the **Supabase user ID as the `appUserID`** (the anonymous user's ID); on linking to SIWA/Google/email (docs/01 §2) the **same Supabase ID is preserved**, so the reverse-trial/purchase carries over without aliasing breakage. Avoid RevenueCat anonymous IDs; bind to the stable Supabase ID from first launch.

**Gating & offline.** Feature gates read the cached effective result of the two-lane projection so Pro and the reverse trial work **offline** (docs/01 §6); a webhook/`CustomerInfo` refresh reconciles on reconnect. A `legacy_unknown` store row is never treated as active until a fresh authoritative provider snapshot initializes its watermark. Gate at the UI _and_ defensively at the data layer where a Pro-only write could occur.

### 5. The conversion flow (anonymous → quiz → aha → offer → reverse trial / purchase → link → Day-0)

The full path (docs/01 §2 owns the funnel; this is the monetisation slice):

1. **Anonymous session** on first launch (`signInAnonymously()`, docs/01 §2) — no signup friction.
2. **Quiz** (the ~12 Baumann-style questions, docs/01 §2) — builds investment; health-data consent precedes it (docs/01 §4).
3. **Personalization reveal** (the "aha" — spec p6) — the value moment.
4. **The onboarding offer** (§3.1) — annual default, 14-day trial; **"Start free trial"** or **"Explore first" → reverse trial**.
5. **Purchase** via the store IAP sheet (§3.3) — or the **reverse trial** (7 days full Pro, no card) → later drop to the free tier + re-present.
6. **Account creation at the value moment** — SIWA (mandatory since Google is offered) / Google / email OTP — **preserving all anonymous data** via the linking pattern (docs/01 §2).
7. **Continue into the app** — first routine setup → first check-off (the activation north-star, docs/01 §7).

**Day-0 is decisive** (~half of conversions happen Day 0; a context-free paywall "feels jarring," RevenueCat 2026); the post-offer experience (a calm "you're in," the first routine, the immediate conflict check) is what makes the reverse trial's engagement precondition hold and prevents early churn.

### 6. Trial & subscription lifecycle

- **Reverse-trial start** — granted on a dismissed offer (§4); the app reflects full Pro for ~7 days, no card.
- **Reverse-trial end** — access drops to the free tier; the offer re-presents with honest loss-aversion framing; data preserved.
- **(Carded) trial start** — the 14-day store trial begins on purchase; Pro immediately.
- **The 2-day-before-end reminder** (spec) — a calm local notification ("Your free trial ends in 2 days; you'll move to [$49.99]/year unless you cancel"); Apple also sends its own. Honest, not a guilt trip.
- **Conversion** — at trial end the store charges and the conversion webhook fires; the mirror stays active.
- **Grace period & billing retry** — on a failed renewal, **billing retry / grace period** (StoreKit `gracePeriod`, Play grace period) keeps access briefly; a gentle "update your payment method" prompt (deep-link to the store); the `BILLING_ISSUE` webhook handled; RevenueCat renewal-recovery enabled.
- **Renewal** — annual renews yearly; the webhook keeps `expires_at` current.
- **Cancellation (easy and honest)** — "Manage subscription" deep-links to OS subscription settings (one-tap cancel); access continues until `expires_at` (the app does **not** revoke on `CANCELLATION`). No maze, no dark patterns.
- **Win-back (honest)** — after expiry, a **sparse, honest** win-back (docs/07 promotional tier; ARLs regulate win-back/retention offers): a value-restatement and, where appropriate, a respectful offer via RevenueCat win-back offers / the store's mechanisms. No pressure.
- **Expiration → graceful downgrade** — on `EXPIRATION`, the entitlement deactivates and the user **falls back to the free tier** with **data preserved**; Pro re-offered contextually.
- **Refunds** — 2–5% of payers refund (more in H&F); refunds flow through the store and the `REFUND`/`EXPIRATION` webhook revokes; RevenueCat refund-reduction tooling used where available.
- **Upgrade / downgrade / crossgrade** — monthly↔annual via the store's proration; the `PRODUCT_CHANGE` webhook updates the mirror.
- **Price increases** — require user consent (Apple's price-increase consent flow) and ARLs; handled via the store with clear notice.

### 7. Store compliance & the law (IAP, Guideline 3.1.2, external-link, auto-renewal laws)

- **IAP is mandatory for digital subscriptions** and the **durable default**: **RevenueCat over StoreKit 2 / Google Play Billing**. Commission is **15% under Apple's Small Business Program** (<$1M/yr, which Layerwell will be initially) **and on year-2+ of a subscription**, otherwise 30% (Google Play is structurally similar). _(The reverse trial is a non-transactional, app-granted entitlement — no IAP and no auto-renew — so it carries no store-billing or auto-renewal-law obligations; only the carded trial/subscription does.)_
- **Apple Guideline 3.1.2 (early-2026 enforcement) — the honest-paywall checklist:** include in the **binary** the subscription **title, length, price (and price-per-unit)**, and **functional Terms + Privacy links**; make the **billed amount the most clear and conspicuous price**; provide **Restore**; **no free-trial toggle**; **do not call it "free" if it charges after a trial**; avoid exaggerated claims. App Store Connect **metadata** also needs the Terms (standard Apple EULA link in the description or a custom EULA) and Privacy links. **Layerwell's honest paywall satisfies all of this by design.**
- **SIWA is mandatory** because Google sign-in is offered (Apple Guideline 4.8; docs/01 §2).
- **External-link / web checkout — an unsettled, optional lever.** Post-_Epic_ (April 30, 2025 contempt ruling), **US apps may include external payment links, currently with _zero_ Apple commission** — but the Ninth Circuit (Dec 2025) said Apple may charge a "reasonable" fee, the district court is to set it, and Apple is seeking Supreme Court review (mid-2026). **Treat web checkout as an optional margin experiment to revisit, not a foundation** (docs/00's guidance: abandon it if the commission settles high); ship IAP as the universal path. (The EU DMA's alternative-distribution/Core-Technology-Fee regime is separate and even more in flux — out of scope for launch.)
- **Auto-renewal law.** The **FTC "click-to-cancel" rule was vacated (8th Circuit, July 2025)** and is not currently enforceable (though the FTC is trying to revive it), but **state ARLs and federal ROSCA apply**: California **CARL** (amended July 1, 2025 — clear disclosure, standalone auto-renewal consent, **cancel as easy as signup**, **renewal reminders**, rules on win-back/retention offers), NY, CO, MA, and ROSCA. **IAP de-risks this** (store subscriptions are one-tap-cancellable via the OS, which also handles renewal disclosures/receipts); the burden mainly attaches to any **web checkout** Layerwell builds. **Layerwell voluntarily meets the strictest standard everywhere** (easy cancel, clear terms, honest win-backs).
- **Account deletion** (Apple/Google requirement, docs/01 §4) includes **calling RevenueCat's subscriber-deletion API**; the app notifies the user that **store billing continues until they cancel** in their store settings.

### 8. Data model (extends docs/01 §3)

**`entitlements`** (recap, docs/01 §3): the RevenueCat-only projection, keyed by `user_id`, including the exact webhook ordering tuple or a provider snapshot watermark. Historical rows with neither remain `legacy_unknown` and fail closed. Writes are service-role only.

**`reverse_trial_grants`**: the independent one-time app-grant authority (`user_id`, `granted_at`, `expires_at`, bounded metadata). It stores no RevenueCat event, transaction, store-user, offering, package, product, or cursor identifier. `read_entitlement_projections()` derives the authenticated owner and returns both explicit lanes.

**`subscriptions_events`** (the optional raw webhook log, docs/01 §3): service-role write, for audit/debug/reconciliation; stores the raw RevenueCat event (type, `event.id`, `app_user_id`, product, timestamps) so the entitlement state is reconstructable and the idempotency key (`event.id`) is enforced.

**Extensions for the reverse trial, offers, experiments, and gating:**

```sql
alter table public.entitlements
  add column store          text,    -- provider store only in this table
  add column period_type    text,    -- provider trial/intro/normal period
  add column will_renew     boolean, -- from CustomerInfo (false after a cancellation, before expiry)
  add column original_purchase_at timestamptz,
  add column offering_id    text,    -- which RevenueCat offering/experiment the user saw (attribution)
  add column experiment_id  text,    -- paywall/price/model A/B assignment (analytics)
  add column acquisition_channel text; -- attributed channel for LTV-by-channel (TikTok, ASA, organic, creator code)
-- Store projection writes are service-role only; app grants live separately.
```

Feature-gating reads `is_active` (+ `expires_at` as a safety check); `period_type` distinguishes the reverse trial from a carded trial/subscription (for copy and analytics); `will_renew` powers "renews / ends on…" copy; `offering_id`/`experiment_id` tie conversions to the A/B variant (§10); `acquisition_channel` enables **LTV-by-channel** so the model A/B and the GTM spend are judged on the right metric (§10/§11).

> **Decision-log notes (DECISIONS.md):** **D-034 (revised)** — the launch conversion model is a **reverse trial** (≈7-day full-Pro, no card, after a dismissed offer → drop to a useful free tier), **annual default with a 14-day carded trial, premium price under test, no weekly plan**, with a **generous free floor** and a **graceful (never data-deleting) downgrade**; **"reverse trial vs. hard paywall" and the price test are the first mandatory A/B experiments**, judged on **blended LTV-per-install × reach**. **D-035** — **store IAP via RevenueCat is the universal default**; **US web/external checkout is an optional, re-verify-at-build margin experiment**, not a dependency. **D-036** — **honest-by-design paywall and lifecycle** (billed amount most conspicuous, Terms/Privacy/Restore present, easy OS cancellation, honest win-backs, the 2-day trial reminder) — meeting Apple 3.1.2 _and_ the strictest ARL _and_ the trust thesis at once. **D-037 (new)** — **acquisition is a creator-led discovery blend with channel–model fit** (creator/#SkinTok/UGC + Spark Ads, content/SEO from the ingredient engine, ASO, LTV-measured paid UA, privacy-trust as the messaging spine); the reverse trial exists in part to convert discovery-channel traffic that a hard paywall would waste. The external-link economics, the ARL specifics, and the EULA/privacy placement belong in **BLOCKERS.md** under **B-LEGAL** for build-time legal review.

### 9. Honest-by-design monetisation (the no-dark-patterns stance — and why it wins)

The subscription-app playbook contains genuine dark patterns (manufactured urgency, guilt, hard-to-cancel mazes, the now-banned trial toggle, sunk-cost mega-onboarding). Layerwell **rejects these** — and the evidence says the honest path is also the winning path here:

- **Apple enforces it** — 3.1.2 (early 2026) rejects the trial toggle and "tricks," and demands a clear, conspicuous, honest paywall.
- **The law enforces it** — ARLs/ROSCA demand clear disclosure, easy cancellation, and honest win-backs.
- **Trust monetises it** — privacy-as-trust drove Yuka's $7.3M on zero marketing; for a face-photo skincare app, honesty is the WTP and word-of-mouth engine (docs/01 §9, docs/06).
- **The reverse trial is itself honest** — it lets people _experience_ the value with no card and no trickery, then choose; it is the honest counterpart to a hard wall, and it keeps a free base rather than discarding non-payers.
- **It still uses the _legitimate_ conversion levers** — deferred auth, quiz personalization, the onboarding offer, a habit-forming trial, annual default, clear value props, a trust block, contextual upsells, and (for the reverse trial) genuine loss aversion earned by real usage.

### 10. Optimisation & analytics

- **The first two mandatory experiments (D-034):** **(1) reverse trial vs. hard paywall**, judged on **blended LTV-per-install × reach** (not per-install conversion, which excludes the non-payers a hard paywall loses); **(2) price** ($39.99 vs $49.99 vs $59.99 annual), judged on **LTV** (higher price correlates with lower renewal, so net it). Then iterate on reverse-trial window length (5/7/10 days), trial length (14/21/30), paywall copy, and the four-value-prop ordering — offerings configured remotely (no app release per test).
- **Channel-level conversion (critical for the model decision):** track **trial/reverse-trial→paid and LTV by acquisition channel** (the `acquisition_channel` field, §8). The model A/B must be read per channel — discovery channels (TikTok) and high-intent channels (ASO) will favour different models, and the right answer may be **a soft/reverse-trial flow for discovery traffic and a harder gate for high-intent search traffic** (channel-aware offerings).
- **The metrics** — install→reverse-trial/trial, **trial→paid**, Day-0 conversion, **annual mix**, Y1 retention, churn (and the ~⅓ month-1 annual cancellation to watch), refund rate, RPI/LTV (by channel), paywall view→start rate. Benchmark against H&F medians (trial-to-paid ~6.9%; aim top-quartile) and the hard-paywall median (10.7%).
- **PostHog funnel** (docs/01 §7): `paywall_shown`, `reverse_trial_started`, `reverse_trial_expired`, `trial_started`, `purchase_completed`, plus `paywall_dismissed`, `contextual_paywall_shown`, `restore_tapped`, `manage_subscription_opened`, `winback_shown`/`_converted`. **RevenueCat↔PostHog** ties subscription events to the same distinct ID for cohort/funnel analysis (docs/01 §7).
- **The iterate loop** — paywall + acquisition optimisation compounds (the median↔top-decile gap widens ~15%/yr because "paywall optimisation, creative, and retention multiply"); treat both the paywall and the GTM creative as continuously-optimised surfaces.

### 11. Go-to-market & acquisition (the model to fill the funnel)

The conversion model (§2) and the acquisition channel are one coupled decision. This section specifies the acquisition model — and it is **not** "zero marketing."

#### 11.1 The channel–model fit principle

Hard paywalls suit **high-intent** traffic (Search, ASO) that arrives ready to decide; **softer models (reverse trial / freemium) convert discovery-channel traffic (TikTok, Instagram) better** because those users need to _experience_ value first (Airbridge 2026). Skincare acquisition is overwhelmingly **discovery**-driven, so the reverse trial (§2) and the creator-led blend below are designed to fit — and where high-intent **ASO/search** traffic exists, a **harder gate can be tested for that segment** (channel-aware offerings, §10).

#### 11.2 The blend (anchored on the channel that owns beauty)

1. **Creator / #SkinTok / UGC — the spine.** Beauty is _the_ creator category (eMarketer 2025: influencer endorsements matter more to beauty buyers than in any other category), and **Layerwell's features _are_ the content creators already make** — the top beauty formats are GRWM, tutorials, honest first-impressions, **before/afters**, and **routines**, which map directly to the photo timeline, the conflict engine ("is your routine wrong?"), and the routine builder. Operationally: **seed dermfluencers and micro-creators** (via UGC marketplaces — pay-as-you-go, per-creator codes), commission **UGC**, then **amplify winners with TikTok Spark Ads** (boost top organic creator content as paid while keeping the native feel — "turns your best UGC into a scalable acquisition channel"; #TikTokMadeMeBuyIt has 77.8B+ views). Beauty economics are workable (~$10–20 CPM on TikTok; beauty-specialist agencies report 3–6× ROAS and CAC reductions within 60 days).
2. **Content / SEO from the ingredient & conflict engine — the compounding moat.** Every "can I use retinol with vitamin C?" is an evergreen, on-brand search asset built from the data the app already has (docs/02). Durable, organic, and unavailable to AI-score competitors.
3. **ASO — the high-intent baseline.** Skincare is high search volume; ASO is the cheapest high-intent install source and the one segment where a harder gate may convert well (test).
4. **Paid UA — scale, measured strictly to LTV.** TikTok Spark Ads + Meta + Apple Search Ads, funded by the model's RPI, judged on **LTV-by-channel** (§8/§10) with multi-touch attribution (a user may see a TikTok video Monday, search Wednesday, install Friday).
5. **Privacy-trust as the messaging spine — the differentiator and word-of-mouth catalyst.** "The skincare app that doesn't sell your face · no AI scores · your photos stay on your phone." This is what makes the creator content _spread_ (the Yuka effect, docs/01 §9, docs/06) — woven through _all_ channels, **not** a standalone channel. It is also why the reverse-trial's free base matters: free users are the evangelists this messaging activates.

#### 11.3 The reel-them-in hooks (creative + contextual-paywall framing)

The genuinely shareable, on-brand hooks: **(a) the conflict-check verdict** — "Is your routine fighting itself?" (instant, Yuka-style payoff, screenshot-able); **(b) the skin-cycling / #SkinTok tie-in** (ride the 3.5B-view trend, docs/02/05); **(c) before/after** (the photo timeline — the #1 beauty content format — used privacy-respectfully); **(d) the privacy angle** ("no AI scores; your face never leaves your phone"). These are the ad creative _and_ the framing of the contextual paywalls (§3.2).

#### 11.4 CAC/LTV discipline (the 7-figure guardrail)

Acquire only where **LTV > CAC by a healthy margin**, measured per channel (the `acquisition_channel` field). The reverse-trial model and the annual default exist partly to make paid UA viable (recoupable LTV); the creator/content/ASO channels lower blended CAC; and the trust messaging compounds organic. Watch the honest risks: the **median app makes ~$8.3K MRR** (most paid UA doesn't out-earn CAC), so lean on the **lower-CAC creator/organic/ASO channels first** and scale paid only behind proven LTV.

### 12. UI / UX details (consolidated — look, feel, behaviour)

Design tokens (docs/00 §8, D-005): Instrument Serif (paywall headline), Hanken Grotesk (value props, body), monospace (price); palette paper · greige · clay · ink; light mode (the offer is a decision moment, not the PM context); 8pt grid; Reanimated 3 motion; restrained haptics; WCAG 2.2 AA; Dynamic Type; RTL-ready.

- **Onboarding offer:** personalized headline · four value-prop lines with calm icons · the offer with the **annual price as the most conspicuous element** · annual pre-selected (monthly secondary) · **"Start free trial"** CTA · visible **"Explore first"** (→ reverse trial) · "remind 2 days before · cancel anytime" · auto-renew disclosure · **Terms + Privacy + Restore** · trust block **below** the plans.
- **Reverse-trial state:** a calm, non-nagging banner ("You're exploring Pro — 5 days left") and, at expiry, the honest loss-aversion re-offer.
- **Contextual paywall:** feature-framed, dismissible, same compliance elements.
- **Purchase sheet & states:** native store sheet; loading / purchasing / success (calm confirmation) / cancelled / error (retry, never a dead end) / already-subscribed / reverse-trial-active.
- **Manage subscription (Settings):** plan/state, renewal date, "Manage subscription" (OS deep-link), Restore, Terms/Privacy, how-to-cancel.
- **Microcopy:** honest, calm, claim-safe — "Start 14 days free, then [$49.99]/year," "Explore Pro free for 7 days — no card," "Cancel anytime in your settings"; never "Don't miss out!" or a fake countdown.
- **Motion/haptics:** gentle reveal of the offer after the result; success haptic on purchase; no aggressive animation.
- **Accessibility:** price and terms screen-reader-legible; CTA and "Explore first" both clearly focusable; Dynamic Type reflow; sufficient contrast over any imagery.
- **Localisation/currency:** prices render in the store's **localized currency and format** from the offering (never hardcoded); all copy externalised for ~30% expansion + RTL (docs/01 §8); per-territory price tiers (§2).

### 13. Engineering / implementation notes

- **RevenueCat SDK** initialised with the **Supabase user ID as `appUserID`** from first launch (anonymous), preserving identity through account linking (§4); Offerings/Packages/Entitlements in the dashboard.
- **Reverse trial:** an **Edge Function grants the time-boxed `pro` window** only in `reverse_trial_grants` on a dismissed offer; the client derives expiry and combines that app lane with the independent RevenueCat lane (offline-safe).
- **Purchase/restore** via StoreKit 2 / Play Billing through the SDK; **sandbox/TestFlight** test matrix (purchase, carded trial, reverse trial grant + expiry, renewal, grace, restore, refund, upgrade/downgrade) before launch.
- **Webhook → Edge Function → `entitlements`** (service-role): `event.app_user_id`, return 200 fast, idempotent on `event.id`, event-type-correct (don't grant on cancellation); the separate authenticated, owner-derived endpoint performs bounded v1 `GET /subscribers` reconciliation using only fresh provider `request_date`; raw log to `subscriptions_events`.
- **Gating** reads the cached entitlement (offline-safe, docs/01 §6); defensive server-side checks where a Pro-only write could occur.
- **Compliance wiring:** Terms/Privacy links in the paywall **and** App Store Connect metadata; Restore on the paywall; the standard Apple EULA link in the description (or a custom EULA); price-increase consent via the store; **subscriber-deletion API** in the deletion Edge Function (docs/01 §4).
- **Attribution:** capture `acquisition_channel` (per-creator codes, UTM, MMP/SKAN/attribution SDK) so LTV-by-channel and the model A/B are measurable (§10/§11).
- **PostHog + RevenueCat** integration; the funnel events (§10).
- **Re-verify at build (fast-moving):** Apple's 3.1.2 trial-toggle/conspicuous-price enforcement; the external-link commission outcome (Supreme Court); RevenueCat webhook payload shape and the subscriber-deletion API; ARL specifics by state; Apple Guideline 4.8 wording (docs/01 §9 flags).

---

## Seven-Figure Validation (the model, the acquisition & the money)

This is the document where the seven-figure question is answered directly:

- **The market is real, growing, and fragmented.** Skincare apps are a **~$500M (2025) → ~$1.8B (2033)** category (15% CAGR) atop a **~$165B skincare _products_** industry; **subscriptions are the fastest-growing app monetisation model**; and the category has **no dominant pure-play** — room for a category-defining, trust-led entrant. (Market-size estimates vary widely; the ~$500M→$1.8B figure is the most defensible for pure skincare apps.)
- **The math works at modest scale — more so at a premium price.** At a **premium annual price ($49.99–$59.99)**, **~17–20k paying subscribers ≈ ~$1M ARR** (vs. ~25k at $39.99) — a smaller, achievable base, and higher-priced apps convert downloads ~2× better (RevenueCat 2026). On an H&F profile (trial-to-paid ~6.9% median, higher in the top quartile), that base is reachable with a real acquisition engine.
- **The model fits the channel.** The **reverse trial** converts the **discovery traffic** (TikTok/#SkinTok) skincare actually runs on — traffic a hard paywall would waste — while keeping a **free evangelist base** that powers word-of-mouth, ASO, and more UGC. Annual default (H&F 68% annual; ~19.9% D380 retention) and the data-lock-in moat (routines + the longitudinal photo timeline, docs/01 §7/§9, docs/06) protect LTV.
- **The acquisition engine is the realistic path to volume.** Creator/#SkinTok/UGC + Spark Ads (beauty's #1 channel; Layerwell's features _are_ the content), content/SEO from the ingredient engine (a compounding moat), ASO (high-intent baseline), LTV-measured paid UA, and **privacy-trust as the messaging spine** (Yuka's word-of-mouth engine) — a blend that lowers blended CAC and compounds organically, rather than betting on a single channel.
- **Honest-by-design compounds it.** The honest paywall, the no-card reverse trial, and easy cancellation satisfy Apple 3.1.2, the ARLs, _and_ the trust thesis simultaneously — reducing rejection/legal risk while strengthening the word-of-mouth flywheel.

**Verdict: yes — this layer can deliver a seven-figure business, but it is top-quartile-execution-dependent, not guaranteed by the category, and it depends on the _corrected_ model (reverse trial + creator-led acquisition + premium pricing under test), not a generic hard paywall with no marketing.** Outcomes are brutally polarised: the **median subscription app makes ~$8.3K MRR at 18 months**, the **top 5% make $1.16M+/month**, the gap widens ~15%/yr, and **pre-2020 apps still earn 69% of subscription revenue** (an incumbency headwind). Seven figures therefore requires **top-quartile conversion + retention + a disciplined, LTV-measured acquisition engine** — exactly the deferred-auth, quiz-personalised, reverse-trial, annual-default, honest, on-device-trust, creator-led pattern specified here. The honest risks (~⅓ cancel annual auto-renew in month 1; 2–5% refund; the reverse-trial "engagement > exposure" precondition; creator-channel and attribution dependence; the unsettled external-link economics) are real and are surfaced and managed above.

---

## Synthesis

**(a) What it is:** the monetisation + acquisition engine — the conversion model, packaging, the paywall, RevenueCat, the lifecycle, go-to-market, compliance, and optimisation — that converts _and acquires for_ the value docs/02–07 built; it owns the offer moment, the purchase, and the acquisition that fills the funnel, not the funnel mechanics (docs/01) or the features.

**(b) Conversion model & packaging:** a **reverse trial** (≈7-day full-Pro, no card → drop to a useful free tier), **annual default with a 14-day carded trial, premium price under test, no weekly**, a generous free floor, graceful downgrade — Pro = the four value props; the model A/B (reverse trial vs hard paywall) and the price test are the first mandatory experiments, judged on blended LTV-per-install × reach.

**(c) Paywall:** the spec p7 onboarding offer (four value props, annual pre-selected, no iOS toggle, billed amount most conspicuous, Terms/Privacy/Restore, trust block below) with two honest paths ("Start free trial" / "Explore first" → reverse trial) + contextual upsells + the purchase sheet + manage-subscription.

**(d) RevenueCat:** Offerings/Packages/Entitlements + Paywalls + StoreKit 2/Play Billing + Restore + the idempotent, event-type-correct webhook→`entitlements` mirror, the **app-granted reverse-trial entitlement**, offline-safe gating, and stable Supabase-ID identity through account linking.

**(e) Flow & lifecycle:** anonymous → quiz → aha → offer → reverse trial / carded trial → link (data preserved) → Day-0; then reverse-trial drop / trial conversion → grace/retry → renewal → easy cancel → honest win-back → graceful expiration → refund/deletion (subscriber-deletion API).

**(f) Go-to-market:** channel–model fit; a creator-led blend (creator/#SkinTok/UGC + Spark Ads, content/SEO from the ingredient engine, ASO, LTV-measured paid UA) with privacy-trust as the messaging spine; the conflict-verdict / skin-cycling / before-after / privacy hooks; CAC/LTV discipline.

**(g) Compliance & honesty:** IAP mandatory and default; Apple 3.1.2 honest-paywall checklist; external-link/web checkout an unsettled optional lever; ARLs/ROSCA satisfied (IAP one-tap cancel + voluntary strictest-standard); SIWA mandatory; honest = Apple-compliant = ARL-compliant = trust-maximising — and the reverse trial is itself the honest alternative to a hard wall.

**(h) Economics & confidence:** the market and math support seven figures (more easily at a premium price), but outcomes are polarised and execution-dependent; the reverse-trial + creator-led + premium-price model is the corrected path; the fast-moving compliance items are flagged for build-time re-verification (B-LEGAL).

---

## Recommendations

1. **Ship the reverse trial as the default conversion model** (D-034) — full Pro free for ~7 days (no card) after a dismissed offer, dropping to a useful free tier — and **A/B test it against a hard paywall**, judged on **blended LTV-per-install × reach** (not per-install conversion alone). Keep a trial in some form regardless (trial-inclusive wins 64.5% of A/B tests).
2. **Keep the annual default + 14-day carded trial + value-first onboarding, and drop weekly** — all confirmed by the data (H&F 68% annual; ~19.9% vs 14.2% vs 5.5% retention; ~50% Day-0; weekly off-brand).
3. **Test a premium price ($49.99–$59.99/yr) against $39.99**, judged on LTV — higher-priced apps convert downloads ~2× better and need fewer subscribers for seven figures.
4. **Build acquisition as a creator-led discovery blend** (D-037): creator/#SkinTok/UGC + **Spark Ads** as the spine, content/SEO from the ingredient engine, ASO baseline, LTV-measured paid UA, and **privacy-trust as the messaging spine** — _not_ "zero marketing." Layerwell's features _are_ the content; lead with the conflict-verdict / skin-cycling / before-after / privacy hooks.
5. **Match the model to the channel** — soft/reverse-trial for discovery traffic, and test a **harder gate for high-intent ASO/search** traffic (channel-aware offerings); read the model A/B **per channel**.
6. **Build the honest paywall to Apple 3.1.2** (D-036): the **billed amount most conspicuous**, **no trial toggle on iOS**, **Terms + Privacy + Restore in the paywall**, plain auto-renew disclosure, trust block below the plans; place the offer **after the personalization aha**.
7. **Implement the entitlements correctly** — the idempotent, event-type-correct webhook→mirror (`event.app_user_id`, 200-fast, never grant on cancellation, reconcile via `GET /subscribers`) **and** the app-granted reverse-trial entitlement; gate on the cached entitlement (offline-safe); bind RevenueCat to the stable Supabase ID.
8. **Default to store IAP via RevenueCat everywhere** (D-035); treat **US web/external checkout as an optional margin experiment** to revisit as the _Epic_ commission settles — never a dependency.
9. **Handle the full lifecycle honestly and meet the strictest auto-renewal standard everywhere** — the 2-day trial reminder, grace/billing-retry recovery, **OS one-tap cancellation**, honest win-backs (ARL-compliant), graceful expiration with data preserved, and the **subscriber-deletion API**; legal review under **B-LEGAL**.
10. **Instrument LTV-by-channel and treat both the paywall and the GTM creative as continuously-optimised surfaces** — the model A/B, the price test, and creative iteration are where the median↔top-decile gap is won; scale paid UA only behind proven per-channel LTV.

---

## Caveats (confidence flags)

- **The reverse trial is the recommended default, but the model choice should be proven with money, not prose** — RevenueCat is emphatic that hard paywalls win on per-install economics (8× RPI, 21% higher LTV), so the reverse-trial advantage is _for this app and its discovery-channel mix_ and must be validated by the A/B (on blended LTV-per-install × reach, per channel). _Medium-high confidence for Layerwell; run the test._
- **The reverse trial's value depends on engagement during the window** ("engagement > exposure") — if users don't actually use Pro in the ~7 days, loss aversion won't fire and value is given away; the daily routine + instant conflict check + photo start make this likely, but monitor the engagement-to-conversion link. _Medium-high confidence._
- **"Zero marketing" is not a viable plan; the creator-led blend is required** — Yuka's zero-marketing $7.3M is an outlier, and seven figures needs a deliberate, LTV-measured acquisition engine. _High confidence._
- **Creator-channel and attribution dependence is a real risk** — beauty acquisition concentrates on TikTok/#SkinTok (platform and algorithm risk), and multi-touch attribution is hard; diversify across creator + content/SEO + ASO + paid, and instrument LTV-by-channel. _Medium-high confidence._
- **Premium pricing is a hypothesis** — higher-priced apps convert downloads ~2× better, but higher price correlates with lower renewal, so net it out on LTV via the price test; the optimum is found empirically. _Medium confidence; A/B test._
- **Seven figures is achievable but top-quartile-execution-dependent, not guaranteed by the category** — median subscription app ~$8.3K MRR at 18 months, top 5% $1.16M+/month, gap widening ~15%/yr, pre-2020 apps 69% of revenue; success hinges on top-quartile conversion + retention + the acquisition engine. _High confidence on the polarisation._
- **Market-size estimates vary widely** (skincare-app figures span ~$500M to tens of billions by definition); treat all such numbers as directional; the ~$500M→$1.8B pure-skincare-app figure is the most defensible. _Medium confidence._
- **Conversion/retention benchmarks are directional** (RevenueCat SOSA editions differ year to year; cite the edition); use as targets, and re-pull current figures at build. _Medium-high confidence._
- **The external-link / web-checkout economics are legally unsettled and fast-moving** (post-_Epic_; Ninth Circuit remand on a "reasonable" fee; Apple seeking Supreme Court review) — build on IAP and treat web checkout as a revisitable experiment. _Medium confidence; re-verify at build (B-LEGAL)._
- **Apple 3.1.2 enforcement and auto-renewal law are both moving** — the trial-toggle/conspicuous-price enforcement is active; the FTC rule is vacated but may revive while state ARLs (CARL, etc.) and ROSCA apply (IAP de-risks cancellation, but any web checkout must independently comply); design to the honest checklist and have legal confirm current obligations at build (B-LEGAL). _High confidence that compliance is required; exact obligations vary._
- **Annual subscriptions churn meaningfully in month 1** (~⅓ cancel auto-renew within the first month) and 2–5% of payers refund (more in H&F); the post-purchase onboarding and honest value delivery are what protect this. _Medium-high confidence._
- **SIWA, account-deletion, and EULA/privacy placement are mandatory store requirements** whose exact wording shifts (Apple 4.8 / 3.1.2); confirm current guidelines before submission. _High confidence that they're required._
