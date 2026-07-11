# Document 9: Personalized Recommendations — Build Spec

_The independent, needs-based recommendation engine · profile + evidence-based (not AI-scan, not pay-to-play) · gap-filling, replacement, conflict-resolution, better-fit & goal-driven suggestions · the "what / why / how" explainability + a fit score · the editorial–commerce "church and state" separation · the surfaces · ranked by fit and evidence, never by commission._

> This is build-order document **#9** of the 15 named in docs/00 (§"Build order", item 9: _"Personalized recommendations"_). It is the **recommendation engine** that turns the user's profile (docs/01), the ingredient/product catalog and evidence grades (docs/02), the routine and scheduler gaps (docs/03/05), and the shelf/replenishment state (docs/04) into **honest, personalized suggestions for what to use** — the digital equivalent of a trusted skin advisor. Its cardinal rule, and the reason it can exist inside a trust-first brand at all, is that **it ranks purely by fit, evidence, and need — never by commission**: the commerce/affiliate layer (the ShopMy integration and creator-curated stacks of **doc #10**) sits _downstream_ and **never influences what is recommended**. It is consistent with docs/06's decision to ship **no AI skin scores** — recommendations are **profile- and evidence-based, not selfie-scan-based**. This document deliberately answers, with the same rigour applied to the paywall, the harder question: _is a recommendation engine even right for OnSkin, and if so, what is the only way to execute it without destroying the trust that is the business?_ The short answer — validated by Yuka, Wirecutter, and Consumer Reports — is **yes, but only as an independent, restrained, needs-based advisor.**

---

## TL;DR

- **A recommendation capability is essential and expected — personalised guidance is the single biggest value driver in beauty.** 94% of beauty marketers report sales boosts from personalisation, AI-driven personalisation lifts conversion up to ~50%, 80% of consumers prefer brands that personalise (Deloitte), and skincare is called _"the perfect use case"_ because of its complexity and repeat-purchase nature: people _"can't fully understand their skin,"_ abandon purchases from uncertainty (Google: 60%), and want a _"virtual beauty consultant"_ to reduce guesswork. The trusted-advisor role is what users most want — and what deepens retention.

- **But the dominant execution model is the wrong one for OnSkin, and this is the central decision.** Nearly all of that evidence measures **e-commerce/brand recommenders optimised to _sell more_** (basket size +17%, AOV +15–25%). That upsell logic is the **pay-to-play conflict of interest that would destroy OnSkin's trust moat** — the one thing that makes it a seven-figure business (Yuka's $7.3M on trust + zero marketing). OnSkin therefore builds the **inverse**: an **independent, needs-based, restrained advisor** that ranks by **fit, evidence, and need — never commission**, recommends the **minimum** required, and is willing to say _"your routine's complete — you don't need anything."_

- **The trust architecture is "church and state," copied from the best in the world.** Wirecutter: _"product picks are made independently; only then does the commerce team step in to handle affiliate links."_ Consumer Reports: _"never taken a single advertising dollar."_ Yuka — OnSkin's own reference case — _literally recommends "similar but healthier alternatives," "100% independently; no brand or manufacturer can influence them."_ So the recommendation **engine (this doc)** ranks purely on merit; the **commerce layer (doc #10)** is walled off downstream and can never reorder a result. The cautionary tale is the opposite: undisclosed commercial conflict is what destroys a recommender's credibility.

- **It is profile- and evidence-based, not AI-scan-based — consistent with docs/06.** Recommendations derive from the **quiz/Baumann profile, goals, the current shelf, detected conflicts, and stated preferences**, scored against the **evidence-graded catalog** (docs/02) — not from a questionable selfie "skin score" (which docs/06 rejected on accuracy, privacy, and fairness grounds). This is both a consistency and a differentiation point.

- **The trust differentiator is the "what / why / how" + a fit score.** Most recommenders show _what_ (a product) and _why_ (it suits you); OnSkin adds **how it decided** — your profile + the gap + the evidence grade + the fit criteria — the move Wirecutter credits for its trust. Each suggestion carries a plain **fit rationale**, the docs/02 **evidence grade** ("recommendation, not a rule"), and an honest note of any **caveat/flaw**, never just a sell.

- **What it recommends is needs-based, not novelty-based.** Six honest triggers: **gap-filling** (your AM has no SPF), **replacement** (an expiring/finished product, from docs/04), **conflict resolution** (a swap to de-conflict your shelf, from docs/02), **better-fit** (a gentler alternative for your sensitivity), **goal-driven** (an evidence-backed active for a goal you've set and not addressed), and **routine completion** (a complete starter routine). And a real seventh state: **"you're set"** — recommend nothing when nothing is needed.

- **It is deterministic, explainable, restrained — not a black-box recommender.** Like the conflict engine (docs/02) and the scheduler (docs/05), it is a **rules + evidence + fit-scoring engine over the curated catalog**, not collaborative-filtering ("people like you bought…"), which would be a privacy problem, a cold-start problem, and a trust problem. It recommends by **type first** ("you'd benefit from a mineral SPF"), optionally surfacing **specific products** ranked by fit; it never manufactures need, and it leans toward _fewer_ products (skinimalism — docs/05: 72% overwhelmed, "fewer/smarter").

- **Seven-figure verdict: yes — king-making, but _only_ as the independent advisor.** Personalisation is beauty's #1 value driver and the trusted-advisor role is the retention engine (people return to the tool that _knows their skin_); it strengthens the Pro value prop ("routine intelligence," doc #8) and tees up the affiliate revenue stream (doc #10). The honest condition: the value exists **only** if the engine is trusted — a pay-to-play recommender is a commodity that erodes the moat and converts worse over time. Built independently, it is the feature that makes OnSkin the skin advisor people trust; built as a storefront, it is the feature that ends the brand. The whole document is about staying on the right side of that line.

---

## Key Findings

1. **Personalised guidance is the #1 value driver in beauty, and skincare is the ideal category.** 94% of beauty marketers report personalisation sales boosts; ~50% conversion lift; 80% prefer personalising brands (Deloitte); skincare's complexity + repeat-purchase make it _"the perfect use case"_; 60% of beauty shoppers abandon purchases from uncertainty (Google). Users want a trusted advisor.

2. **The e-commerce recommender model optimises to sell more — the wrong objective for a trust-first app.** The lifts cited (basket +17%, AOV +15–25%, conversion) come from brand recommenders engineered to move product; that upsell logic is the conflict of interest that erodes trust. OnSkin must invert the objective: recommend what's _best/needed_, not what _sells_.

3. **Trust is the only durable differentiator, and "church and state" separation is how it's protected.** Wirecutter makes picks independently, then the commerce team adds affiliate links; Consumer Reports takes no ad money; Yuka recommends alternatives with no brand influence. The recommendation engine must rank purely on merit; the commerce/affiliate layer (doc #10) is downstream and can never reorder results.

4. **Yuka proves an independent recommender is compatible with — even core to — a seven-figure trust model.** Yuka ($7.3M, zero marketing, docs/01 §9) _literally_ recommends "healthier alternatives" objectively, with no brand influence and no ads. An honest recommender is not a contradiction of OnSkin's thesis; it is part of the proven model.

5. **Recommendations must be profile- and evidence-based, not AI-scan-based.** Consistent with docs/06 (no AI skin scores — questioned accuracy, privacy, fairness), OnSkin recommends from the **quiz/Baumann profile, goals, shelf, conflicts, and preferences** scored against the **evidence-graded catalog** (docs/02) — both a consistency and a differentiation point versus selfie-scan recommenders (Haut.AI, Perfect Corp, etc.).

6. **The "what / why / how" structure plus a fit score is the trust mechanic.** Wirecutter's trust comes from showing _how_ it decided, not just _what_ and _why_; the "%-match + explanation" pattern is industry-validated (Inference Beauty). OnSkin shows the fit rationale, the docs/02 evidence grade, and honest caveats on every suggestion.

7. **What gets recommended is needs-based (six honest triggers) plus an honest "you're set."** Gap-filling, replacement (docs/04), conflict resolution (docs/02), better-fit, goal-driven, and routine completion — and the willingness to recommend _nothing_. Recommend by type first, specific products second, the minimum always (skinimalism, docs/05).

8. **It is a deterministic rules + evidence + fit-scoring engine, not collaborative filtering.** Black-box "people like you bought" recommenders bring privacy, cold-start, and trust problems; OnSkin's engine scores the curated catalog against the profile/goals/gaps with explainable rules — the same architecture as docs/02/05.

9. **Compliance is claim-safety + consent.** Recommend for **concerns, not conditions** (no medical claims; B-DERM-REVIEW, docs/02); any path that links to buy via an affiliate (doc #10) requires the **separate MHMDA/GDPR data-sharing consent** (docs/01 §4) and FTC affiliate disclosure (a doc #10 concern). Never sell health data.

10. **Seven figures comes from trust-driven retention + Pro value + the teed-up affiliate stream — conditional on independence.** Personalisation is the retention/loyalty engine and a core Pro value prop (doc #8); doc #10's affiliate revenue rides on it. But the value exists **only if independent**; a pay-to-play recommender is a commodity that erodes the moat. King-making as an advisor; brand-ending as a storefront.

---

## Details

### 1. What it is — and is not (scope; the doc #10 boundary; the advisor-vs-storefront decision)

**It is** the recommendation engine: it decides **what products/types a user should consider** — to fill gaps, replace expiring items, de-conflict their shelf, find better-fitting alternatives, address goals, or complete a routine — **personalised to their profile and ranked by fit and evidence**, with honest explanation. It owns the recommendation _logic_, the _surfaces_ where suggestions appear, the _explainability_, and the _trust architecture_ that keeps it independent.

**It is not**, and these boundaries are the whole point:

- **not the commerce/affiliate layer** — the ShopMy integration, the "buy" flow, attribution, and creator-curated stacks are **doc #10**, _downstream_ of this engine. This engine produces a _ranked-by-merit_ list; doc #10 may _optionally_ attach a transparent affiliate link to a recommended product, but **the affiliate economics never reorder or bias the engine's output** (§3).
- **not an AI skin-score/scan recommender** — recommendations come from the profile + evidence, not a selfie analysis (docs/06).
- **not a black-box "people like you" recommender** — deterministic, explainable rules + evidence + fit-scoring (§5).
- **not an upsell engine** — it recommends the _minimum needed_ and will recommend _nothing_ when nothing is needed (§4); it never manufactures demand.
- **not the conflict engine, the routine builder, the shelf, or the scheduler** — it _consumes_ their outputs (the gaps, the conflicts, the expirations, the profile) and _adds_ "here's what would help."

**The advisor-vs-storefront decision (made explicitly).** OnSkin builds the **trusted independent advisor**, not the storefront. Every design choice below flows from that: rank by merit, explain the "how," recommend the minimum, disclose any commerce, and keep the engine walled off from the affiliate economics. This is the only model compatible with the trust thesis — and, per Yuka/Wirecutter/Consumer Reports, the one that actually earns durable loyalty.

### 2. The honest verdict — is a recommendation engine right for OnSkin? (the tension, resolved)

The user-facing question deserves a direct answer, because the naïve version of this feature is dangerous.

**The case _for_:** personalised guidance is beauty's #1 value driver (94% sales boosts; ~50% conversion lift; 80% prefer it), skincare is _"the perfect use case,"_ and the unmet need is real — people can't read their own skin, abandon purchases from uncertainty, and want a _virtual advisor_. A skincare app **without** any "what should I use?" answer leaves its single most-wanted capability on the table, and the trusted-advisor role is a powerful retention engine.

**The case _against_ (the trap):** the dominant recommender model is built to **sell more** (AOV, basket, conversion) and is frequently **pay-to-play**, which is the **conflict of interest that erodes trust** — and trust is OnSkin's entire moat (Yuka's $7.3M, docs/01 §9). A recommendation engine that subtly favours what pays, manufactures need, or pushes products onto a skinimalist audience (docs/05: 72% overwhelmed, "fewer/smarter") would **directly contradict the brand's "works with what's already on your shelf" promise** and convert worse as users sense the bias.

**The resolution (the spine of this document):** build the **independent, needs-based, restrained advisor**, not the storefront. This captures the demand (the advisor people want) _without_ the trap (the upsell that kills trust), and it is exactly what the best-in-class independent recommenders do — Yuka recommends "healthier alternatives" with no brand influence; Wirecutter makes picks independently then adds commerce; Consumer Reports takes no ad money. **Verdict: yes, a recommendation engine is right for OnSkin — but only this version.** The rest of the document specifies it.

### 3. The trust architecture — "church and state" (the cardinal rule)

This is the single most important section, because it is what lets the feature exist:

- **Rank by fit, evidence, and need — never by commission.** The engine's scoring function (§5) takes **no input from the affiliate economics** of doc #10. A product's commission rate, brand partnership, or purchasability **cannot raise its rank**. This is enforced architecturally: the ranking inputs (§5) contain **no commercial fields**, and the commerce layer (doc #10) only ever _reads_ the engine's already-ranked output.
- **Editorial picks first, commerce second (Wirecutter's "church and state").** The engine decides what's best for the user; _only then_ may doc #10 attach a transparent affiliate link to a recommended product. The order is never reversed.
- **Transparent disclosure.** Where a recommended product carries an affiliate link (doc #10), it is **clearly disclosed** ("we may earn a commission — it never affects what we recommend"), and the independence is stated plainly (Yuka's model). FTC endorsement/affiliate disclosure obligations attach at the commerce layer (doc #10, B-LEGAL).
- **Honest, including flaws.** Following Wirecutter's most-valuable-asset principle, recommendations note **caveats and downsides**, not just upside, and favour **"good/great enough"** over the most expensive (anti-upsell).
- **Restraint as policy.** The engine is biased _toward fewer products_ and toward "you're set" (§4); it never pads a list to fill space or create a sale.

> This is what separates a king-making advisor from a trust-destroying storefront. Every other section assumes this rule holds.

### 4. What gets recommended (the six honest triggers + "you're set")

The engine recommends only when there is a genuine, profile-grounded reason:

1. **Gap-filling** — the user's routine/profile has a missing essential. The core complete routine is _cleanser → (treat) → moisturiser → SPF_ (docs/03); a missing **SPF** (the highest-value gap), **moisturiser**, or **barrier support for a sensitive/compromised barrier** triggers a gap recommendation _by type_.
2. **Replacement** — a product has a tracked PAO/printed expiry state or an unsuperseded unit the user marked **finished** (docs/04 PAO/expiry + replenishment); recommend a **repurchase** or a **better-fitting alternative** without claiming remaining quantity.
3. **Conflict resolution** — the shelf holds a **conflict** (docs/02); recommend a **swap** that de-conflicts (e.g., a non-conflicting alternative to one of two clashing actives), framed as "this would simplify your routine."
4. **Better-fit** — an owned product **doesn't suit the profile** (e.g., a fragranced or high-strength product for sensitive skin); recommend a **gentler/more-suitable alternative**, claim-safe, as an option not a mandate.
5. **Goal-driven** — the user set a **goal** (docs/01: brightening, anti-aging, etc.) **not yet addressed** by their routine; recommend an **evidence-backed active/type** for it (with the docs/02 evidence grade), introduced conservatively (one at a time, docs/05).
6. **Routine completion** — a **beginner** with little/no shelf gets a **complete, minimal starter routine** by type (cleanser, moisturiser, SPF, plus at most one goal-active), not a 10-step regimen.

**And the honest seventh state — "you're set."** When the routine is complete, conflict-free, and goal-appropriate, the engine **recommends nothing** and says so warmly ("Your routine looks complete — nothing to add right now"). This is a feature, not a gap: it is the clearest possible signal of independence and the strongest trust-builder, and it fits the skinimalist audience.

### 5. How it works — the engine (rules + evidence + fit-scoring over the catalog)

Consistent with docs/02 (conflict engine) and docs/05 (scheduler), the recommender is a **deterministic, explainable rules + evidence + fit-scoring engine over the curated catalog** — **not** collaborative filtering. (Black-box "people like you bought…" brings a privacy problem, a cold-start problem, and a trust problem, and can't explain itself — all disqualifying here.)

**Inputs (no commercial fields — §3):**

- **Profile** — `skin_profiles` (docs/01): the Baumann-style axes, `sensitivities`, `pregnancy_status`, `goals`.
- **Shelf** — `user_products` (docs/04): what's owned, its tags/concentration, status (active/finished/expiring).
- **Routine & gaps** — the AM/PM routine and its missing essentials (docs/03), the scheduler state (docs/05).
- **Conflicts** — `routine_conflicts` (docs/02): unresolved clashes on the shelf.
- **Preferences** — values/format filters (fragrance-free, vegan, cruelty-free, non-comedogenic, budget band, texture) — §8.
- **Catalog** — `products` + `product_ingredients` + `ingredient_tags` + `conflict_rules`/evidence grades (docs/02).

**The algorithm (per candidate trigger):**

```
recommend(user):
  needs = detect_needs(user)        # the six triggers (§4); empty → "you're set"
  for each need in needs (priority: safety/gap > replacement > conflict > better-fit > goal):
      type = required_product_type(need)            # e.g. 'mineral_spf', 'ceramide_moisturizer'
      candidates = catalog.filter(type)
                          .exclude(conflicts_with_shelf(user))      # docs/02 — never recommend a new conflict
                          .exclude(unsuitable_for_profile(user))     # sensitivity, pregnancy (docs/02 safety)
                          .filter(user.preferences)                  # fragrance-free, vegan, budget, ... (§8)
      score each candidate by FIT (see below); rank
      attach why + how + evidence_grade + caveats     # §6
  return the minimal set of needs, by type first, with ranked specific products optional
```

**The FIT score (transparent, merit-only):** a weighted, explainable score over —

- **profile match** (suits the skin type/sensitivity/pregnancy — hard safety exclusions first),
- **evidence** (the docs/02 grade for the active's relevance to the user's goal/need),
- **need priority** (how much it fills a genuine gap),
- **simplicity/fit-with-shelf** (doesn't add a conflict; complements what's owned),
- **preference match** (values/format/budget filters),
- **catalog quality** (the curated top-products tier, docs/02, ranks above sparse volunteer entries).

**Cold-start** is a non-problem because the engine is profile-driven, not behaviour-driven: the quiz (docs/01) yields a usable profile from minute one, so recommendations work on day zero without any usage history (a key advantage over collaborative filtering).

**Restraint is built into the algorithm:** it returns the **minimal set of genuine needs**, **type-first**, biased toward fewer products and toward "you're set"; it **never** pads, ranks by novelty, or recommends into a complete routine.

### 6. The "what / why / how" explainability + the fit score (the trust differentiator)

Every recommendation carries the trust-building triad (Wirecutter's structure; the "%-match + explanation" pattern, Inference Beauty):

- **What** — the recommendation, **type-first** ("A mineral SPF 30+"), with optional **specific products** ranked by fit.
- **Why** — the **personalised reason** ("Your morning routine has no SPF, and daily SPF is the highest-impact step for your anti-aging goal").
- **How** — **how the engine decided**: your profile + the detected gap + the **evidence grade** (docs/02: "broad consensus" / "recommendation, not a rule") + the **fit criteria** (sensitive-skin-suitable, fragrance-free per your preference). The "how" is the differentiator that converts a suggestion into trust.
- **The fit indicator** — a calm **fit rationale** (and optionally a %-match), never a hype score; claim-safe.
- **Honest caveats** — any downside/flaw ("can pill under makeup," "fragranced — we excluded those for your sensitivity") — the Wirecutter "flaws but not dealbreakers" honesty.

No recommendation is ever a bare product card with a buy button; the explanation is mandatory, and it is what makes the feature OnSkin rather than a storefront.

### 7. The surfaces — where recommendations appear (look & feel)

Recommendations surface **contextually, where the need arises**, and in one calm hub — never as a nagging "shop" tab. Design tokens per docs/00 §8 (Instrument Serif display, Hanken Grotesk UI, monospace labels; paper/greige/clay/ink; calm, not commercial).

- **7.1 The "For you" hub** (within the You tab, or a calm card on Today): the user's current recommendations grouped by trigger ("Fill a gap," "Time to replace," "A gentler option"), each a **recommendation card** (§11) with the what/why/how. When there's nothing to recommend, it shows the **"you're set"** state proudly. Deliberately _not_ a storefront grid.
- **7.2 In-routine gap prompts** (docs/03): when the routine builder shows a missing essential (no SPF), an inline, dismissible "Add SPF?" prompt links to the gap recommendation — calm, contextual, skippable.
- **7.3 Replenishment** (docs/04 §6): a tracked PAO/printed-expiry or user-marked-finished surface offers **repurchase or a better-fit alternative** (the replacement trigger), claim-safe and without depletion inference.
- **7.4 Conflict-resolution swap** (docs/02 §7): the conflict-detail screen can offer a **de-conflicting alternative** ("this would let you keep both nights simple"), as an option.
- **7.5 Goal surfaces** (docs/01 goals): when a goal is unaddressed, a gentle "to support [brightening], you might consider…" appears in the For-you hub.

Across all surfaces: **type-first**, explanation-mandatory, dismissible, never modal-blocking, never urgent, and any commerce link (doc #10) clearly disclosed.

### 8. Personalisation inputs & preferences

- **Derived automatically:** the profile (Baumann axes, sensitivities, pregnancy, goals — docs/01), the shelf (docs/04), the routine/gaps (docs/03), the conflicts (docs/02).
- **User-set preferences (a Settings surface):** **values filters** (fragrance-free, vegan, cruelty-free, non-comedogenic, sustainable), **format/texture** (cream vs gel, etc.), and a **budget band** (drugstore / mid / premium). Values filters "dramatically increase lifetime value" (Immerss) and are honest personalisation (they constrain _what fits you_, not what sells). These filters **hard-constrain** the candidate set (§5), so a fragrance-averse user never sees fragranced recommendations.
- **Pregnancy/safety** is a hard exclusion (docs/02 safety): pregnancy suppresses retinoid recommendations and routes to the clinician copy.
- **Honesty about inputs:** recommendations are explained in terms of these inputs (§6), so the user always sees _why_ something was suggested for _them_.

### 9. Data model (extends the catalog; no commercial fields in ranking)

The engine reads existing tables (docs/01–04) and adds light preference + (optional) cache structures. **Crucially, the ranking inputs contain no commercial fields** (§3).

```sql
-- User recommendation preferences (the values/format/budget filters; owner-only RLS per docs/01 §3)
create table public.recommendation_preferences (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  values_filters text[] default '{}',   -- 'fragrance_free' | 'vegan' | 'cruelty_free' | 'non_comedogenic' | 'sustainable'
  budget_band    text,                  -- 'drugstore' | 'mid' | 'premium' | null (no preference)
  format_prefs   text[] default '{}',   -- 'gel' | 'cream' | 'fluid' | ...
  updated_at     timestamptz not null default now()
);

-- Optional: a cache of current recommendations (recomputed on profile/shelf/routine change; not authoritative)
create table public.recommendations (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  trigger       text not null,          -- 'gap' | 'replacement' | 'conflict' | 'better_fit' | 'goal' | 'routine_completion'
  product_type  text not null,          -- the recommended type (type-first)
  catalog_product_id uuid references public.products(id),  -- optional specific product
  fit_rationale text not null,          -- the 'why' + 'how' (explainability is mandatory)
  evidence_grade text,                  -- from docs/02
  status        text default 'active',  -- 'active' | 'dismissed' | 'accepted'
  created_at    timestamptz not null default now(),
  unique (user_id, trigger, product_type)
);
create index on public.recommendations (user_id, status);
-- Owner-only RLS on both. NOTE: no commission/affiliate/partnership column exists in the ranking path —
-- commerce metadata lives entirely in doc #10's layer and is JOINed only AFTER ranking, never before.
```

The recommendation logic itself is a **pure function** (client + server mirror, like docs/02 `detect_conflicts`) over the profile/shelf/routine/conflicts/preferences + catalog; the `recommendations` cache is a convenience, recomputed on relevant changes, never the source of truth and never commercially weighted.

> **Decision-log notes (DECISIONS.md):** **D-038** — recommendations are **ranked purely by fit, evidence, and need; commission/affiliate/partnership data NEVER enters the ranking path** ("church and state"); the commerce layer (doc #10) reads ranked output only, and any affiliate link is disclosed. **D-039** — recommendations are **profile- and evidence-based, not AI-scan-based** (consistent with docs/06), and **explainable** (the "what / why / how" + fit rationale + docs/02 evidence grade + honest caveats are mandatory on every suggestion). **D-040** — the engine is **restrained and needs-based** (the six triggers + an honest "you're set"), **type-first**, biased toward _fewer_ products; it never manufactures need or recommends into a complete routine. Claim-safety on any health-adjacent recommendation is gated by **B-DERM-REVIEW**; the data-sharing consent and FTC disclosure for the doc #10 commerce link belong in **B-LEGAL**.

### 10. Compliance, claim-safety & honesty

- **Claim-safe — concerns, not conditions** (docs/02 §9, B-DERM-REVIEW): recommend for **cosmetic concerns** ("for the appearance of uneven tone") not **medical conditions** ("to treat melasma"); no diagnosis, no "treats/cures." A recommendation is never framed as medical advice.
- **Data-sharing consent before any affiliate path** (docs/01 §4): under MHMDA/GDPR, sharing with third parties/affiliates requires a **separate, distinct consent** from collection; the engine itself shares nothing, but the moment a recommendation links out to commerce (doc #10), that consent must be in place. **Selling health data is avoided entirely.**
- **FTC affiliate/endorsement disclosure** attaches at the commerce layer (doc #10): any affiliate relationship must be clearly disclosed (a doc #10 / B-LEGAL concern); this document's job is to keep the **engine independent** so the disclosure is true ("commission never affects what we recommend").
- **Pregnancy/safety exclusions** (docs/02): hard-exclude contraindicated actives; route to clinician copy.
- **No dark patterns:** no manufactured scarcity, no "everyone's buying this," no padded lists; the "you're set" state and the type-first restraint are the honest defaults.

### 11. UI / UX details (consolidated — look, feel, behaviour)

Design tokens (docs/00 §8, D-005): Instrument Serif (section headers), Hanken Grotesk (the why/how copy), monospace (the evidence grade, fit label); palette paper · greige · clay · ink; calm, advisory, **never commercial**; 8pt grid; Reanimated 3 motion; restrained haptics; WCAG 2.2 AA; Dynamic Type; RTL-ready.

- **The recommendation card:** a calm card showing **What** (type-first, e.g., "A mineral SPF 30+"; optional specific product below), **Why** (one-line personalised reason), an expandable **How** (your profile + gap + evidence grade + fit criteria + caveats), a small **fit rationale/indicator**, and — only if doc #10 attaches it — a clearly **disclosed** "where to find it" link. A **dismiss** ("not for me") and **accept/add to shelf** action. Never a bare product + buy button.
- **The "For you" hub:** grouped by trigger; calm; the **"you're set"** state shown warmly when empty.
- **In-routine/replenishment/conflict prompts:** inline, contextual, dismissible (§7).
- **Preferences:** the values/format/budget filters (§8) in a calm settings surface.
- **Microcopy:** advisory and honest — "Your routine has no SPF — here's the highest-impact thing you could add," "Your routine looks complete — nothing to add right now," "We may earn a commission, and it never affects what we recommend"; never "Buy now!", never urgency, never hype.
- **Motion/haptics:** gentle reveal of recommendations; a calm "added to your shelf" confirmation; nothing pushy.
- **Accessibility:** the what/why/how is screen-reader-legible; fit indicated by **text not colour alone**; Dynamic Type reflow; dismiss/accept clearly labelled.
- **Localisation:** product types, copy, and the evidence grades externalised for ~30% expansion + RTL; budget bands and availability localise; the catalog/availability varies by region.

### 12. Engineering / implementation notes

- **Where it runs:** the recommendation logic is a **pure function** mirrored client + server (like docs/02 `detect_conflicts`), over the cached profile/shelf/routine/conflicts/preferences + catalog, so the For-you hub and gap prompts work **offline** (docs/01 §6); a server function can recompute and cache `recommendations` on relevant changes.
- **The catalog dependency:** recommendations are only as good as the catalog (docs/02 — Open Beauty Facts + the curated top ~2,000 products); the FIT score **ranks curated, well-attributed products above sparse volunteer entries**, and the engine degrades gracefully (type-first guidance even when specific-product coverage is thin).
- **The "church and state" boundary in code (D-038):** the ranking module imports **no commerce module**; doc #10's affiliate/attribution code can only **consume** the ranked `recommendations` output and attach links _after_ ranking. Enforce with module boundaries and review.
- **Recompute triggers:** profile change (re-quiz), shelf change (add/finish/expire), routine change, conflict change, preference change.
- **PostHog instrumentation** (docs/01 §7): `recommendation_shown` (count only), `recommendation_expanded`, `recommendation_accepted` / `_dismissed`, `youre_set_shown`, `preference_set`. Do **not** send trigger or product-type props to vendor analytics; those categories can reveal the user's need. Measure the "how"-expansion and accept/dismiss to tune relevance — **never** to bias toward commission.
- **Performance:** scoring the curated catalog against a profile is cheap; cache and recompute on triggers; keep it pure and idempotent.

---

## Seven-Figure Validation (the advisor & the money)

Personalised recommendations are king-making for OnSkin — _as an independent advisor_:

- **Personalisation is beauty's #1 value driver and the trusted-advisor role is a retention engine.** 94% of beauty marketers report personalisation sales boosts; ~50% conversion lift; 80% prefer personalising brands (Deloitte); personalisation "turns one-time buyers into lifelong fans" and "builds loyalty." People return to the tool that _knows their skin_ — and retention is the subscription business (docs/01 §9, doc #8).
- **It strengthens the core Pro value prop.** "Routine intelligence — order, timing, skin cycling" (the paywall's #1 prop, doc #8) is materially stronger when it also answers _"and here's what would help."_ A trusted "what should I use?" is among the most-wanted capabilities in skincare.
- **It tees up a second revenue stream — honestly.** The affiliate layer (doc #10, ShopMy: $500M+ in brand sales, 47,000+ brands, 30-day cookie) rides on the recommendation engine; because the engine is **independent**, the affiliate revenue is _earned trust converting_, not _trust being spent_. This is the Wirecutter model (affiliate revenue **on top of** editorial independence) and a real diversification beyond subscriptions.
- **Independence is the moat, and Yuka proves it monetises.** Yuka reached $7.3M on **independent** recommendations + zero marketing (docs/01 §9); an honest "here's a better/needed product" advisor is the proven, trust-compounding model — and the privacy/honesty differentiation (no AI-scan, no pay-to-play) is a sharp contrast with the AI-scan, sell-more recommenders that dominate the category.

**Verdict: yes — the recommendation engine is a seven-figure, king-of-the-category feature — but _only_ as the independent, needs-based advisor.** The value is entirely conditional on **trust**: built independently (rank by merit, explain the "how," recommend the minimum, disclose any commerce, wall off the affiliate economics), it is the feature that makes OnSkin _the_ skin advisor people rely on — deepening retention, strengthening Pro, and honestly powering doc #10's affiliate stream. Built as a pay-to-play storefront, it converts worse over time and **destroys the trust moat that is the entire business**. The honest risks — catalog quality limits, the perennial temptation to let commerce bias the ranking, and over-recommending against a skinimalist audience — are real and are managed by the church-and-state architecture, the restraint policy, and the "you're set" default above.

---

## Synthesis

**(a) What it is:** the independent, needs-based recommendation engine — what products/types to consider, personalised to the profile, ranked by fit and evidence, honestly explained; it consumes docs/01–05 outputs and is walled off from the commerce layer (doc #10).

**(b) The honest verdict:** a recommendation engine is right for OnSkin (personalisation is beauty's #1 value driver, the advisor is what users most want) — _but only_ as the independent, restrained advisor, never the sell-more e-commerce recommender that would destroy the trust moat.

**(c) Trust architecture:** "church and state" — rank by fit/evidence/need, **never commission**; editorial picks first, commerce second (doc #10); transparent disclosure; honest about flaws; restraint as policy. The cardinal rule that lets the feature exist.

**(d) What it recommends:** six honest, needs-based triggers (gap-fill, replacement, conflict-resolution, better-fit, goal-driven, routine-completion) plus an honest **"you're set"**; minimum needed, type-first.

**(e) How it works:** a deterministic rules + evidence + **fit-scoring** engine over the curated catalog (not collaborative filtering), inputs = profile/shelf/routine/conflicts/preferences (no commercial fields), cold-start-free because profile-driven, restrained by design.

**(f) Explainability:** the **what / why / how** + a fit rationale + the docs/02 evidence grade + honest caveats on every suggestion — the trust differentiator (Wirecutter's structure).

**(g) Surfaces & inputs:** a calm "For you" hub + contextual prompts (in-routine, replenishment, conflict, goal); values/format/budget preferences that hard-constrain the candidate set; claim-safe and consent-gated.

**(h) Economics & confidence:** king-making as the trusted advisor (retention + Pro value + the honest affiliate stream of doc #10), brand-ending as a storefront; the value is conditional on independence, which the architecture enforces; the honest risks (catalog limits, commerce-bias temptation, over-recommending) are managed.

---

## Recommendations

1. **Build the independent, needs-based advisor — not the e-commerce recommender.** Capture the demand (the advisor people want) without the trap (the upsell that kills trust); this is the only version compatible with the moat.
2. **Enforce "church and state" in the architecture** (D-038): rank by fit/evidence/need, keep **all** commission/affiliate data out of the ranking path, let doc #10 attach disclosed links only _after_ ranking, and review the module boundary.
3. **Make it profile- and evidence-based, not AI-scan-based** (D-039) — consistent with docs/06 — and explainable: the **what / why / how** + fit rationale + evidence grade + honest caveats on every suggestion (mandatory).
4. **Recommend the minimum, type-first, and ship the "you're set" state** (D-040) — restraint is the trust signal and the skinimalism fit; never pad, never manufacture need, never recommend into a complete routine.
5. **Use the six honest triggers** (gap-fill, replacement, conflict-resolution, better-fit, goal-driven, routine-completion), prioritising safety/SPF gaps first.
6. **Build a deterministic rules + evidence + fit-scoring engine over the curated catalog** — not collaborative filtering — pure and offline-capable (docs/06), cold-start-free via the quiz profile.
7. **Surface recommendations contextually and calmly** (a "For you" hub + in-routine/replenishment/conflict/goal prompts), never as a storefront tab; dismissible, never urgent.
8. **Offer honest values/format/budget preferences** that hard-constrain candidates (fragrance-free, vegan, budget) — honest personalisation, not upsell.
9. **Keep it claim-safe and consent-correct** — concerns not conditions (B-DERM-REVIEW), the separate data-sharing consent before any doc #10 affiliate path, FTC disclosure at the commerce layer (B-LEGAL); never sell health data.
10. **Position it as the trusted skin advisor** — "we tell you what would actually help, and we'll tell you when you don't need anything" — the differentiation from the AI-scan, sell-more recommenders and the foundation doc #10's affiliate stream rides on.

---

## Caveats (confidence flags)

- **The value is entirely conditional on independence.** Personalisation is beauty's #1 value driver, but a pay-to-play recommender is a commodity that converts worse over time and erodes the trust moat; the church-and-state architecture (D-038) is load-bearing, not optional. _High confidence — this is the decision the whole feature hinges on._
- **Most personalisation evidence is from sell-more e-commerce recommenders** (basket/AOV/conversion lifts), so the _demand_ is well-validated but the _execution model_ must be inverted for OnSkin; don't import the e-commerce playbook's objective. _High confidence on the inversion._
- **The engine is only as good as the catalog** (docs/02 — uneven volunteer coverage + ~2,000 curated products); the FIT score ranks curated products above sparse entries and degrades to type-first guidance, but specific-product recommendations will be thin outside the curated tier until coverage grows. _Medium confidence; improves with catalog investment._
- **The recommendation rules are claim-safe consensus, not medical advice** — recommend for concerns not conditions, evidence-graded, conservative, pregnancy-safe; gated by B-DERM-REVIEW. _Medium-high confidence; clinician sign-off required._
- **Over-recommending against a skinimalist audience is a real risk** — the audience wants _fewer_ products (docs/05: 72% overwhelmed); the restraint policy and the "you're set" default (D-040) are the guardrails, and the engine should err toward recommending nothing. _High confidence that restraint is required._
- **The commerce-bias temptation is perennial** — every future growth pressure will push to let commission tilt the ranking; this must be resisted architecturally and culturally, because the moment users sense bias, the moat is gone (the conflict-of-interest cautionary tale). _High confidence — treat as a standing risk._
- **Affiliate/data-sharing compliance is real and attaches at doc #10** — the separate MHMDA/GDPR data-sharing consent and FTC disclosure are required before any commerce link; this engine stays independent so the disclosure ("commission never affects what we recommend") is true. _High confidence that compliance is required (B-LEGAL)._
- **Recommendations must not become AI-scan-dependent** — staying profile/evidence-based keeps consistency with docs/06 and avoids the accuracy/privacy/fairness problems of selfie scoring; resist the pressure to add an "AI skin analysis recommends…" surface (that's the deferred, consented, fairness-validated doc #12 path, if ever). _Medium-high confidence._
- **Personalisation depends on profile quality** — a thin or stale quiz profile yields weaker recommendations; prompt periodic profile refresh (and tie to the photo-progress and routine data) without becoming naggy. _Medium confidence._
- **Measurement must not corrupt the objective** — analytics (accept/dismiss, "how"-expansion) should tune _relevance_, never be optimised toward commission or AOV; instrument for trust and fit, not for sell-through. _High confidence that the metric choice matters._
