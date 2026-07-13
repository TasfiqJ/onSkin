# Document 10: Creator Stacks + ShopMy — Build Specification & Strategic Validation

> **2026-07-12 launch-scope update:** Creator links and production commerce are
> required for the iOS all-features release. Older “later” or post-launch
> sequencing is superseded by `docs/hugeToDo/launch-contract.json`; source,
> consent, disclosure, ranking-isolation, privacy, and live-rail gates remain.

## TL;DR

- **Build it, but as a tightly walled-off "where to buy" utility on OnSkin's own independent recommendations — NOT a creator marketplace.** Affiliate commerce is compatible with a trust-first brand only if it follows the Wirecutter "church and state" model: links are attached strictly _after_ ranking, never influence it, and are disclosed radically. ShopMy is the right primary rail.
- **Affiliate is a credible six-figure secondary stream, not a 7-figure pillar on its own.** The 7-figure thesis must stay anchored in subscriptions (the Yuka model: $7.17M of $7.3M from subscriptions). Realistic math puts OnSkin affiliate at roughly $130K–$700K/yr at 50K–150K engaged users — meaningful high-margin upside, not the main event.
- **Defer hosting third-party creators at launch.** Start with OnSkin's own expert-/derm-reviewed stacks and "where to buy" links. Creator hosting adds 1099/tax, FTC monitoring liability, and trust risk; treat it as a Phase 3 option behind a Pro+ wall, not a v1 feature.

## Key Findings

### 1. The verdict on trust (the central question)

A commerce layer **helps** a trust-first app _if and only if_ it is architecturally subordinate to the recommendation engine. The evidence is clear on both sides:

- **The pro-case (Wirecutter):** Wirecutter has run a credible, trusted recommendation business on affiliate revenue for over a decade by maintaining a strict separation: "Product picks are made independently; only then does the commerce team step in to handle affiliate links or partnerships." Their public stance is that "commerce is the journalism" and that "trust is the only differentiator." Critically, when the only quality retailer for a product has no affiliate program, Wirecutter links there anyway and earns nothing — and says so. That is the standard OnSkin must meet: disclosure is a label, but _integrity is a process_.
- **The anti-case (Yuka):** Yuka — OnSkin's explicit role model — **refuses affiliate revenue entirely.** Co-founder Julie Chapon told Glossy that "Yuka does not accept affiliate revenue or participate in similar programs, nor does it accept money from brands for any reason." In 2024 Yuka earned $7.17M from subscriptions (98.1% of $7.3M total), $137,893 from books/calendars, and $58,043 from services — _zero_ from manufacturers. Yuka's 2024 U.S. impact study claims **94% of U.S. users will return a product to the shelf if it gets a "bad" rating** and 92% are buying fewer ultra-processed products since using the app — exactly the behavior-change credibility that affiliate money could erode.

**Resolution:** OnSkin should adopt Wirecutter's _structure_ while staying closer to Yuka's _ethos_. The FTC itself draws the precise line OnSkin needs (16 CFR Part 255, Example 9): a review site that takes payment for higher rankings is deceptive, but one that "does not take payments for higher rankings" and merely "receives payments... such as for affiliate link referrals" is fine _if it clearly and conspicuously discloses_ this. The church-and-state rule from Document 9 is therefore not just an ethical preference — it is the legal safe harbor.

### 2. ShopMy: how it works and how OnSkin integrates it

ShopMy (legal entity Shop My Shelf, Inc.) is the right primary rail. Per its October 22, 2025 funding release, it **raised $70M at a $1.5B valuation** (Series C led by Avenir, with Bain Capital Ventures, Bessemer Venture Partners, and Menlo Ventures), reports **200% year-over-year revenue growth with sustained profitability since 2024**, facilitates **over $1B in annual GMV**, spans **130 countries** with 140+ employees, and serves **185,000+ creators** and **1,200+ direct brand partners**. Founded 2020 by Harry Rein (CEO), Tiffany Lopinsky (President), and Chris Tinsley (CBDO).

**The "1,200 vs 50,000 brands" discrepancy is resolved:** ShopMy has two tiers. ~1,200 are _direct, paying Brand Partners_ with platform dashboards, custom commission codes, and access to the Brand Partners API/Order Report. ~48,000–50,000 are _Commissionable Partners_ reached indirectly through third-party affiliate networks (ShareASale/AWIN, Impact, Rakuten, CJ) — these pay ShopMy nothing and have no platform access, but creators can still link them and earn. **Only the ~1,200 direct partners have first-party ShopMy tracking; the rest rely on third-party network attribution.**

**Commercials (all confirmed against ShopMy's own docs):**

- Commission rates: **10–30%**, set by brand/retailer; beauty typically lands in the 15–25% band per creator reports. Commission is on the price _before_ taxes and shipping.
- **30-day cookie window** (ShopMy network default) plus a **30-day return window** before order amounts "lock."
- Payout: **weekly, every Friday**, via Stripe or PayPal, **$11 minimum** in locked earnings. Commissions sit "pending" 30–120 days (retailer return window) before becoming "locked."
- Tax: ShopMy issues 1099s (via PayPal/Stripe with a W9).

**The critical integration finding — there are TWO ShopMy APIs with different account models:**

1. **OAuth Developer API** (`https://api.shopmy.us/v1/Partners/...`) acts **on behalf of an authenticated individual ShopMy creator/user.** Scopes are `read_links`, `write_links`, `read_collections`, `write_collections`, `read_profile`. OAuth flow: authorize at `https://shopmy.us/oauth?Developer_id=…&scopes=…&redirect_url=…`, exchange the returned `shopmy_code` at `POST /Partners/oauth-exchange-token` (one-time, persist the token), then call endpoints with **both** an `Authorization: Bearer <developer key>` header and an `X-Access-Token: Bearer <user token>` header. Endpoints: Fetch Collections, Fetch Links, **Create Link** (`POST /Partners/Links`, requires `write_links`), **Fetch URL Rate** (`POST /Partners/Urls`, returns the user's merchant commission rate for a URL), and a **Search Catalog** endpoint (`GET /Partners/Catalog/search`) that resolves a product URL and returns multiple retailers each with a commission `rate` (float %, e.g. 12.5 = 12.5%), brand, image, and a default flag. A created link is a short "Pin" of the form `https://shopmy.us/p-<id>` (or `https://go.shopmy.us/p-<id>`).
2. **Brand Partners API** is first-party (single brand-level bearer key, no OAuth) and exposes **Fetch Order Report** (`POST /v1/Partners/OrderReport`) — the only place commission/order data is available. Fields include Order ID, Transaction Date, Record Updated Date, Click Date, Order Amount USD, Commission Amount USD, Creator Name, Domain, Code, Click-Order Delta (Hours), SKU, Customer Status (new/existing), Ship-to Country, Gross Sales, Number of Items. The public response contract lists **no click token/click ID and no commission lifecycle status**. OnSkin must not infer either from `Click Date`, `Code`, or `Customer Status`; attributable reconciliation therefore remains blocked until ShopMy approves an explicit correlation/status contract. **Rate limit: 200 requests/day, max 500 records/call** (up to ~100K orders/day); a sandbox version exists (1,000 req/day, synthetic data).

**There are NO webhooks/postbacks documented anywhere in ShopMy's docs.** Attribution reporting is **poll-only** — OnSkin must run a scheduled job (Supabase pg_cron → Edge Function) that polls the Order Report using `recordUpdatedStartDate`/`recordUpdatedEndDate` for incremental changes. Given the 30–120-day pending window, a daily or weekly poll is sufficient.

**Strategic implication:** ShopMy's OAuth API is designed for a _creator-side_ integration — each monetizing user would need their own ShopMy creator account and must OAuth-authorize OnSkin; the API **cannot mint commissionable links under a single OnSkin "house" account.** Commission data is only available via the brand-side Order Report, not the OAuth API. To run affiliate on OnSkin's _own_ independent recommendations (the recommended path), OnSkin must confirm the exact account structure with ShopMy (partners@shopmyshelf.us) at build time — **API access is gated and "not yet publicly available" except to approved partners.** This is a hard build-time re-verification item.

### 3. ShopMy "Stacks"/collections and the creator-curation question

ShopMy's native primitives map directly onto "stacks": **Collections** (curated shelves of products) are fetchable/creatable via the OAuth API, and ShopMy's consumer app **Circles** (launched August 2025; **30,000+ Circles and 150,000+ wishlisted products created since launch**, per ShopMy's Oct. 2025 release) lets shoppers assemble feeds from trusted creators. This validates the "shoppable routine" concept at scale.

**On expert vs. influencer curation:** the trust research is decisive. Peer-reviewed and trade sources find dermatologist-created content is more trusted and more accurate than skinfluencer content, but also that dermatologist-influencers face real conflict-of-interest scrutiny ("If a dermatologist's Instagram feed is saturated with paid promotions, that can be a turn-off"). For OnSkin, **expert-/evidence-curated stacks are a genuine differentiator; pure influencer stacks are a trust liability.** Recommendation: OnSkin's editorial/expert-reviewed routines first; if creators are ever added, gate to verified, board-certified or licensed professionals with mandatory conflict disclosure.

### 4. App Store / Google Play: physical-goods affiliate links are allowed without IAP

**Confirmed: affiliate links to buy physical skincare from external retailers do not require IAP and Apple/Google take no cut.** Apple's IAP requirement applies to _digital_ goods/services consumed in-app; physical goods are explicitly exempt. OnSkin's subscriptions (Pro $39.99/yr; Pro+ $79.99/yr reserved) must still use IAP via RevenueCat, but "where to buy" links for physical products may deep-link straight out to the retailer/ShopMy.

A 2025 development eases this further: following the _Epic v. Apple_ injunction, Apple updated its U.S. App Store guidelines (May 2025) to permit external purchase links without the prior 27% fee or "scare screens." This is relevant mainly to subscriptions, not to OnSkin's physical-goods links (which were already permitted) — but it reduces the regulatory risk surface. Apple has appealed, so this is a watch item.

### 5. The economics: six figures, realistically — not seven on its own

The market is large and growing: global social commerce is in the trillions, personal/beauty care is the largest and one of the fastest-growing categories, and beauty product discovery is overwhelmingly social-driven. But OnSkin's affiliate take is governed by funnel math, not market size.

**Worked model (conservative, US-centric):**

- Beauty AOV via creator commerce roughly $59–$80 (TikTok Shop ~$59; Instagram Shopping higher).
- Skincare repeat/replenishment is favorable: beauty/skincare repeat-purchase rates run **30–40%+** (skincare retains better than color cosmetics due to routine-based replenishment; transaction cycle ~104 days).
- ShopMy commission ~15–20% blended for beauty; OnSkin's _net_ share depends on whether it keeps the full commission (own recommendations) or shares with creators.

At **50,000 engaged users**, if ~15% click through to a "where to buy" surface and ~5% of those convert at ~$70 AOV with ~17% commission, that is roughly $45K–$60K per purchase cycle; with replenishment across ~3 cycles/yr, **~$130K–$200K/yr**. At **150,000 engaged users** with modestly better conversion, this scales toward **~$500K–$700K/yr**. To approach a clean $1M _from affiliate alone_ would require ~250K+ highly engaged, high-converting users — achievable only at significant scale and not the base case.

**Conclusion:** affiliate is a high-margin (near-zero-COGS) _supplement_ that can plausibly add 10–20% on top of subscription revenue and improve blended LTV. The 7-figure business remains a _subscription_ business. The comparable case underscores this: Wirecutter drove roughly $150M in _e-commerce transactions_ in 2015 (its actual affiliate cut was far smaller), and even after the NYT acquisition it earned NYT "more than $20 million a year" by 2018 — but Wirecutter is a pure-affiliate media business. A subscription app should treat affiliate as the secondary engine.

### 6. FTC compliance (current, 2023 Guides + 2024–2025 enforcement)

- The Endorsement Guides were revised in 2023 (88 Fed. Reg. 48092), adding a definition of "clear and conspicuous" ("difficult to miss... and easily understandable"; online disclosures should be "unavoidable"; a disclosure behind a "more" link is insufficient).
- **"Affiliate link" alone is NOT adequate; "paid link" placed next to the link IS adequate; "commissionable link" is NOT.** The disclosure must be visible at the same time as the recommendation/link, not in a footer.
- A platform's built-in disclosure tool may not by itself be adequate.
- **Intermediary/platform liability:** OnSkin can be liable for deceptive endorsements it disseminates or for failing to ensure disclosures — so if creators are ever hosted, OnSkin must train and monitor them.
- Enforcement is intensifying: the FTC's final Rule on the Use of Consumer Reviews and Testimonials took effect **October 21, 2024**, carrying civil penalties up to **$51,744 per violation** for knowing violators. The FTC sent influencer warning letters (Nov 2023) and has continued targeting health/wellness and beauty claims through 2024–2025. The 2024 Fashion Nova action confirms brands are held responsible for creators' missing disclosures.

### 7. Compliance: MHMDA / GDPR Art. 9 health-data consent

Skincare "concern" data is health-adjacent and likely "consumer health data" under Washington's MHMDA. The Act requires **opt-in consent to collect**, a **separate and distinct opt-in consent to share** with any third party/affiliate, and a **signed authorization to sell** (one-year, revocable, onerous — effectively to be avoided). "Sharing" is defined extremely broadly ("release, disclose... make available... to a third party or affiliate"), so even passing health-adjacent data to ShopMy via a tracking parameter could trigger the separate-consent requirement. Penalties run to $7,500/violation with a private right of action. **Design rule: the affiliate path must not transmit any health-adjacent attribute to ShopMy or retailers; attribution should carry only an opaque, non-health click token.** Stay claim-safe: recommend for cosmetic "concerns," never medical "conditions."

### 8. Competitive landscape

- **LTK** — per LTK, **250,000+ creators, 7,000 retailers, 1M+ brands, ~40M monthly shoppers**, driving nearly **$5B in annual retail sales**; average brand commission **10–25%** (up to 30%); a creator-feed model vetted to established creators (5K+ followers).
- **ShopMy** — cleaner storefront/Circles model, broader brand reach via networks, weekly payouts, lower creator barrier.
- **TikTok Shop** — **sells a beauty product roughly every two seconds** and **converts at ~4.7%** (vs. ~2.3% for Instagram Shopping, per a 52-brand analysis) via in-app checkout — but it is the antithesis of OnSkin's calm, independent ethos.
- **Yuka** — the trust benchmark; refuses affiliate entirely, recommends "better alternatives" without monetization.
- **Sephora** launched **My Sephora Storefront** (storefronts live Oct. 6, 2025; built with platform Motom; **15% commission with a 15-day attribution window**; open to U.S. creators with 3,000+ followers). Amazon, Ulta, and Condé Nast (its "Vette" platform, set for 2026) are also building creator storefronts — validating the category but raising competition.

**OnSkin's honest differentiation:** be the only one whose engine is provably independent ("commission never enters ranking"), whose disclosures are radical (Wirecutter-grade transparency page), and whose ethos is "use what you own" — surfacing "where to buy" only for products the engine _already_ recommended on merit.

### 9. Technical / data model (Supabase + Expo)

- **Church-and-state at the schema level:** keep two physically separate domains. The `recommendations` path (products, ingredients, fit scores, evidence) must contain **no commission, rate, or affiliate fields**. A separate `commerce` schema (`affiliate_links`, `click_events`, `order_attributions`, `creator_stacks`) joins to a product only _after_ ranking, by `product_id`, read-only from the ranking engine's perspective. Enforce with separate Postgres schemas and RLS so the ranking service role cannot read commission data.
- **Link generation:** call ShopMy Search Catalog / Create Link to resolve a recommended product's retailers and rates; store the returned `https://shopmy.us/p-<id>` Pin. Never re-rank by `rate`.
- **Attribution:** use universal links (iOS AASA) / App Links (Android assetlinks.json) for the in-app→retailer hand-off; attach an opaque first-party click token (no health data). Per Document 9's guidance, **start with simple universal/deep links before reaching for Branch/AppsFlyer.**
- **Order ingestion:** Supabase pg_cron → Edge Function (Deno) polls ShopMy's Order Report daily, keyed on `recordUpdatedStartDate`, upserting into `order_attributions`. No webhook exists, so polling is mandatory.
- **Consent gating:** a distinct MHMDA/GDPR consent toggle must be satisfied before any commerce telemetry leaves the device; if absent, show "where to buy" links with zero third-party data transfer (plain outbound link, no tracking parameter beyond an opaque token tied to no health attribute).

### 10. UX best practices (calm, editorial, non-pushy)

- "Where to buy" should be a **secondary, quiet affordance** beneath the recommendation rationale — never a "Buy Now" CTA that competes with the fit/evidence explanation.
- Disclosure copy: a persistent, plain-language line adjacent to every link — e.g., "Paid link — OnSkin may earn a commission. This never affects what we recommend." (Satisfies FTC; "paid link" is the FTC-approved wording.)
- A dedicated, Wirecutter-style **transparency page** explaining the church-and-state separation in detail (the highest-leverage trust artifact).
- Default to deep-linking out to the retailer; avoid an in-app webview checkout (keeps OnSkin out of the transaction and reduces data-handling liability).
- Preserve the "skinimalism / use what you own" ethos: lead with what the user _already owns_; surface purchase only for genuine gaps the engine identified.

## Details

Each of Key Findings 1–10 is build-ready and maps to a deliverable: (1)/(8) the trust verdict and competitive positioning drive the product framing; (2)/(9) ShopMy's two-API model and the poll-based Order Report drive the integration architecture; (3) Collections/Circles define the "stack" primitive; (4) confirms the IAP exemption for physical goods; (5) sets revenue expectations and KPIs; (6)/(7) define the FTC and MHMDA guardrails; (10) defines the UX. The phased rollout below sequences them.

## Recommendations

**Phase 1 (launch): Own-recommendation "where to buy" only.**

- Integrate ShopMy as the primary rail for attaching disclosed affiliate links to OnSkin's _independently ranked_ recommendations. Skimlinks/Sovrn as aggregator fallback for non-ShopMy retailers. Avoid Amazon Associates in-app — its operating agreement restricts client-side/mobile-app use and "apps primarily focused on shopping... may not be approved." Treat Amazon as out of scope.
- Ship the church-and-state schema separation, the opaque-token attribution via universal links, the daily Order Report poll, and the MHMDA separate-consent gate.
- Ship the transparency page and FTC-compliant "paid link" disclosures.
- **Benchmark to advance:** ≥10% of MAU engaging "where to buy," ≥3% click→purchase, and zero ranking-bias incidents in audit.

**Phase 2 (scale): Expert-/evidence-curated Stacks.**

- Publish OnSkin editorial / derm-reviewed routine "stacks" as shoppable collections (mirroring ShopMy Collections). Keep curation in-house or with vetted, disclosed board-certified experts.
- **Benchmark:** stacks measurably lift retention/Pro conversion; affiliate run-rate ≥$150K/yr.

**Phase 3 (optional, behind Pro+): Hosted creators.**

- Only if Phases 1–2 show affiliate is additive _and_ trust metrics (NPS, review sentiment) are stable. Requires: creator verification (licensed/board-certified preferred), mandatory FTC disclosure tooling and monitoring, 1099/tax handling (lean on ShopMy's creator-side payouts rather than OnSkin brokering money directly), and revenue-share clarity.
- **Kill criteria:** any measurable drop in trust metrics, any pay-to-play perception, or any regulatory exposure reverts to Phase 1.

**Cross-cutting:** Re-verify at build time (1) ShopMy account/account-structure for running affiliate on first-party recommendations (and exact Create Link / Fetch URL Rate response schemas, which are gated), (2) Apple/Google policy state (Apple's appeal pending), (3) current FTC penalty amounts and any new enforcement, and (4) MHMDA rulemaking updates.

## Caveats

- **Affiliate ≠ the 7-figure thesis.** Treat it as a six-figure, high-margin supplement (plausibly 10–20% on top of subscriptions). Over-indexing on it risks the very trust that drives the subscription business.
- **ShopMy API is gated and partly undocumented.** The Create Link / Fetch URL Rate response schemas, the exact first-party account model for a _brand/app_ (vs. individual creator), and a provider-approved order correlation/lifecycle contract need direct confirmation with ShopMy. The public Order Report exposes neither a click token/click ID nor a commission lifecycle status. No webhooks exist — polling is mandatory, but a successful poll alone does not prove attributable reconciliation.
- **Fast-moving areas flagged for re-verification:** App Store external-link rules (Apple appeal pending), FTC enforcement/penalty figures, MHMDA interpretation of "sharing" health-adjacent data, and ShopMy's metrics (valuation/creator/GMV counts current as of late 2025).
- **The single biggest risk is perception, not law.** If users ever sense that commission influences recommendations, the Yuka-style trust advantage collapses. The church-and-state architecture and radical disclosure are non-negotiable mitigations — not nice-to-haves.
