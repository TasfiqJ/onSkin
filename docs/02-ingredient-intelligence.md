# Document 2: The Ingredient Intelligence Layer — Build Spec

_Ingredient & product catalog · the conflict / synergy engine · evidence grading · the skin-cycling scheduler · PAO & expiry intelligence · and the Shelf, conflict-banner, conflict-detail and PM auto-resolution surfaces._

> This is build-order document **#2** of the 15 named in docs/00 (§"Build order", item 2: _"Ingredient/product DB pipeline + conflict engine"_). docs/00 calls this layer **"the moat and the longest pole."** It sits underneath the Shelf (spec p11–12), the conflict-detail screen (spec p13), the PM "conflict auto-resolved" banner (spec p9), the routine builder (doc #3), and the paywall's top two value props ("Routine intelligence — order, timing, skin cycling" and "Ingredient conflict checks, with evidence grades", spec p7). It extends the schema in docs/01 §3; it does not redefine those tables.

---

## TL;DR

- **The moat is not "conflict detection." Conflict detection is already table stakes** — SkinSort's Routine Creator, Cosmily, and HadaBuddy all ship cross-product ingredient-conflict checks in 2026. What none of them combine, and what this layer is, is: a **barcode-scanned personal shelf + skin-profile personalization + _evidence-graded, resolution-first_ (never binary-warning) conflict handling + automatic folding of conflicts into a daily skin-cycling habit loop + PAO/expiry intelligence + a privacy-first posture** — wrapped in calm, non-alarmist, cosmetic-claim-safe copy. The defensibility is **data quality + the evidence-grading discipline + the depth of integration + compounding personal-data lock-in**, not the mere existence of a checker.

- **Build a curated rules engine, not ML — exactly as docs/00 §3 concluded.** The number of ingredient pairs that genuinely matter is small (~40). Hand-curate them from the dermatology and cosmetic-chemistry literature, attach to each a **severity grade, an evidence grade, a mechanism, a non-alarmist resolution, and a citation**, and version them. ML is the wrong tool: the dataset is tiny, the outputs must be explainable to a user and auditable to a lawyer, and a hallucinated interaction is a direct liability.

- **The science is genuinely contested, and almost all of it is _disease-oriented_ (in-vitro / mechanistic), not _patient-oriented_ (clinical-outcome) evidence.** Under the **Strength of Recommendation Taxonomy (SORT; Ebell et al., _American Family Physician_ 2004;69(3):548–556)** — A = consistent good-quality patient-oriented evidence, B = inconsistent/limited, C = consensus, opinion, _disease-oriented evidence_, case series — nearly every skincare-ingredient interaction lands at **grade C**, because the evidence is petri-dish pH studies and stability assays, not trials measuring outcomes that matter to a person. **"Contested" is therefore the honest baseline, not a hedge.** The product consequence: the engine must be as willing to **refute a myth** (niacinamide × vitamin C) as it is to **flag a real risk** — most "checkers" only ever warn, and warning about safe combinations is itself a trust-killer and a vector for misinformation.

- **Three data sources, all free, each with obligations.** Ingredients ← **EU CosIng** (the European Commission's official cosmetic-ingredient database; ~15,000 INCI inventory entries, CAS/EC numbers, functions, Annex II–VI restrictions; carries an explicit _"informative purpose and no legal value"_ disclaimer). Products ← **Open Beauty Facts** (barcode-linked, ODbL — attribution + share-alike + **contribute-back**; ~100,000+ products, volunteer-driven so coverage is uneven; the live API is strictly **one call per real user scan**, bulk seeding must use the daily exports or you will be blocked). Then **hand-curate the top ~2,000 products** for guaranteed quality. Do **not** scrape INCIDecoder / SkinSort / Skincarisma — no public APIs, ToS/legal risk (docs/00 §3).

- **Skin cycling is a dermatologist-originated _framework_, not an RCT-proven protocol.** The classic four-night cycle (Exfoliate → Retinoid → Recover → Recover, then repeat) was coined by **Dr. Whitney Bowe** and went viral on TikTok; its rationale is mechanistic (staggering irritating actives to protect the barrier) and expert-endorsed, with "gentle" (more recovery nights) and "advanced" (fewer) variants that map directly onto OnSkin's per-user personalization. Frame it honestly, personalize it by the user's sensitivity axis, and let the conflict engine _resolve into_ the cycle (the spec's PM screen shows exactly this).

- **PAO is EU/UK law only; the US (FDA) does not mandate cosmetic expiry dates.** So PAO data from the catalog/label will be missing for a large share of US products — the shelf must degrade gracefully to **category-default PAO values** and an honest "PAO unknown" state, never a fabricated date.

- **Liability is two-sided and must be engineered against from line one.** _False reassurance_ (telling someone a combination is fine when it harms them) and _false alarm_ (scaring someone off a safe, beneficial combination) are both failures. Both are mitigated by the same design: evidence grades, conservative concentration/sensitivity-aware defaults, a separate and maximally-conservative **safety** rule class (pregnancy × retinoids), a clear **not-medical-advice** disclaimer, **dermatologist + cosmetic-chemist/pharmacist sign-off** of the rule set before launch, and versioned, auditable rules. Under the FD&C Act and FTC rules, **in-app copy is a "claim" surface** — the language must stay cosmetic ("reduces the appearance of," "may minimise irritation") and never drift into drug claims ("treats acne," "stimulates collagen").

- **Seven-figure verdict: yes — this is the willingness-to-pay and retention engine, not plumbing.** It powers the paywall's headline value props, it is the reason a user's data compounds (your shelf, your conflicts, your cycle, your photos = switching cost), and the category has a direct proof point in **Yuka** (per its own 2024 accounts: $7.3M revenue, 98.1% from subscriptions, ~15-person team, zero marketing — docs/01 §9). The risk to the thesis is **not** demand; it is **getting the science wrong**, which is precisely why the rest of this document is mostly about evidence discipline.

---

## Key Findings

1. **Conflict _detection_ is no longer a differentiator; evidence-graded, resolution-first _treatment_ is.** The 2026 competitive set is crowded at the "scan and warn" layer: Yuka (barcode → a single 0–100 hazard score; 65M+ downloads, but per-product, no routine, no resolution); EWG Skin Deep (a 1–10 hazard rating across ~75,000 ingredients, with the well-documented flaw that it ignores concentration and formulation, so a well-formulated retinol can score "high hazard" purely because the molecule does); INCIDecoder (the deepest ingredient encyclopaedia, research-linked, but web-first, thin mobile, no barcode, no skin profile, no routine-building — and no public API); SkinSort (skin-type-aware match scores plus a Routine Creator that sequences and cross-checks compatibility — the closest competitor to this layer); Cosmily (compatibility + community); and HadaBuddy (scan your shelf → an AI-built routine from your products, with conflict detection). The clear conclusion: OnSkin **cannot** win by adding a conflict checker. It wins by being the only product that turns "these two clash" into "**use these on alternate nights, here's the evidence grade and why, and when a cycle exists the plan shows the exact placement — and you stay in control**." That is the experience the spec already draws.

2. **The evidence base is contested and overwhelmingly disease-oriented — design _for_ that, don't paper over it.** Per SORT (Ebell et al., AFP 2004), recommendations built only on surrogate/disease-oriented outcomes (stability assays, pH-in-a-beaker, cell-turnover mechanism) are categorised **level C** regardless of how confident they sound, because disease-oriented improvements do not reliably predict patient-oriented ones. Reputable sources actively dispute the popular "rules": **Paula's Choice** states plainly that **no research has shown AHA/BHA exfoliants make retinol or retinoids less effective**, tracing the "pH clash" belief to a single study performed on proteins in a petri dish (not intact skin). The honest framing — surfaced to the user as the spec's **"Evidence: contested"** chip — is both more accurate and a trust asset, because it is visibly not scaremongering.

3. **The three tentpole pairs sit at three different evidence tiers — and that is the whole point of grading.**
   - **Benzoyl peroxide × oxidation-sensitive retinoids (retinol / tretinoin): established mechanism, but formulation-dependent.** The classic stability work (B. Martin et al., _Br. J. Dermatol._ 1998;139(suppl.52):8–11, cited across multiple granted formulation patents) found benzoyl peroxide degraded **~50% of tretinoin within ~2 hours and ~95% within 24 hours** in the presence of light. **But:** adapalene showed **no degradation** over 24h (which is why Epiduo can combine adapalene + BP in one tube), and modern optimised/encapsulated tretinoin gels showed **~100% of the tretinoin intact after 7 hours** when deliberately mixed with BP at skin temperature. So the rule is real for _older/simple_ retinol and tretinoin, exempt for adapalene, and weakened for modern delivery systems. Resolution: **separate AM (BP) / PM (retinoid)**.
   - **Retinol × AHA/BHA: contested on efficacy, real on irritation.** The _efficacy-cancelling_ claim is largely a myth (Paula's Choice; Glow Recipe quotes board-certified dermatologist Dr. Hadley King describing retinol + BHA as potentially _synergistic_). The _cumulative-irritation / barrier-compromise_ concern is real and clinically acknowledged for sensitive or already-inflamed skin (e.g., Westlake Dermatology, London Dermatology Centre). Resolution: **alternate nights** (precisely the spec's behaviour), buffer, or lower frequency — driven by the user's sensitivity axis.
   - **Niacinamide × vitamin C: refuted myth.** The fear traces to a **1960s study that used _niacin_ (not niacinamide) under high heat**, forming nicotinic acid (which can flush). Niacinamide is far more stable, does not convert under normal skincare conditions, and modern formulations are routinely combined (Journal of Cosmetic Dermatology-era work and broad dermatology consensus). The engine must classify this **"myth / safe to combine"** and _reassure_, not warn.

4. **A curated rules engine is the correct architecture, decisively (re-affirming docs/00 §3).** The set of genuinely-mattering pairs is ~40; each needs a human-readable mechanism, an auditable citation, and a defensible grade. ML offers nothing here except opacity and hallucination risk, and a wrong interaction surfaced to a user is a liability event. Reserve any future ML for _non-safety_ personalization (e.g., ranking product recommendations), behind consent, far downstream.

5. **Data sourcing is solved with two free sources — but each carries a real obligation that must be in the build plan.** CosIng (free; created 2008 by the European Commission; nomenclature mandated by Reg. (EC) 1223/2009 Art. 19; ~15,000 INCI entries; the regulated Annex subset is smaller, ~2,000–2,400) — carry its _"no legal value"_ caveat internally and **verify the current bulk-download route at build time** (the Commission has relaunched/migrated CosIng and bulk availability has been inconsistent; several third-party mirrors exist). Open Beauty Facts (ODbL — **attribution + share-alike + contribute-back** is a legal obligation; the live API endpoint `world.openbeautyfacts.org/api/v2/product/{barcode}.json` is for **one real scan per call** and scraping is blocked; **bulk seeding uses the daily CSV/Parquet/MongoDB exports**, processed with DuckDB per docs/00 §3). _Confidence: high on the sources and licences; medium on CosIng's exact bulk-download mechanics today — re-verify._

6. **PAO is a EU/UK regulatory artefact with no US equivalent — the shelf must be built around the gap.** Under EU Reg. (EC) 1223/2009 (Art. 19, Annex VIIIa; first introduced by Directive 2003/15/EC), the open-jar "12M / 6M" symbol is mandatory **only** for products with a minimum durability **over 30 months** (products ≤30 months instead carry a best-before/hourglass date); sealed/single-dose/inherently-stable products are exempt. The US FDA does **not** require expiry or PAO on cosmetics (it _does_ require expiry on sunscreens, which are OTC drugs). Therefore much of a US user's shelf will have **no authoritative PAO**, and the system must fall back to **conservative category defaults** and an explicit "estimated / unknown" state.

7. **Skin cycling is a framework to be personalised, not a protocol to be asserted.** Dr. Whitney Bowe's classic four-night cycle is mechanistically sensible and widely endorsed, and it explicitly supports modification by skin type/concern ("gentle" = more recovery nights for sensitive skin like the spec's "Maya"; "advanced" = fewer). It has not, as a _cycle_, been validated in controlled trials; the honest claim is "a dermatologist-developed framework for staggering actives to protect the barrier," not "clinically proven to outperform." Personalise the cadence from `skin_profiles`, and let the conflict engine drive placement.

8. **The liability is two-sided and symmetrical.** _False reassurance_ and _false alarm_ are equally damaging — one is a safety/legal risk, the other a trust/credibility risk and a misinformation harm. The mitigations are shared: evidence grades on every rule; concentration- and sensitivity-aware modulation; a distinct, maximally-conservative **safety** class for genuine medical contraindications (pregnancy/breastfeeding × retinoids, high-dose salicylic acid, hydroquinone) that routes to a clinician; a prominent not-medical-advice disclaimer; expert sign-off; and versioned rules with a user feedback path.

9. **Barcode → product is the "magic moment" input, but coverage is the constraint.** A scan that instantly identifies a product, parses its INCI list, and slots it onto the shelf with a PAO estimate is the activation hook for this layer (and the spec's "Scan a barcode" CTA). Because Open Beauty Facts coverage is uneven, the flow must always offer **search and manual entry** fallbacks, **OCR of the printed ingredient list** as a second-line capture, and — to honour ODbL and improve the commons — **contribute newly-added products back**.

10. **Cosmetic-claim discipline is a content-engineering requirement, not a legal footnote.** Under the FD&C Act §201(g)/(i), _intended use_ — and therefore whether something is a regulated drug claim — is judged by **claims**, including those "on the Internet, or in other promotional materials" (FDA). The FTC separately polices advertising. The intelligence layer generates a great deal of user-facing copy (resolutions, banners, reassurance). All of it must stay in cosmetic territory and avoid disease/structure-function verbs.

---

## Details

### 1. What this layer is — and is not (scope & philosophy)

The ingredient intelligence layer is the **cross-cutting "brain"** that several user-facing features read from. It is not itself a screen. Concretely, it provides:

- a **catalog** of ingredients (CosIng-seeded) and products (Open Beauty Facts-seeded + hand-curated), with parsed INCI lists and concentration bands where known;
- a **conflict / synergy engine** that, given a user's shelf and routines, returns graded interactions with mechanisms, evidence grades, and resolutions;
- a **skin-cycling scheduler** that lays actives across nights and into which conflicts are resolved;
- **PAO / expiry intelligence** for the shelf;
- the **copy and grading system** that makes all of the above calm, honest, and claim-safe.

It reads from: `user_products` (the shelf, docs/01 §3), `routines` + `routine_steps` (incl. `cycling_night`, docs/01 §3), and `skin_profiles` (the sensitivity axis, pregnancy status, goals — health-inference data gated behind the health-data consent, docs/01 §4). It writes the catalog and rule tables (service-role) and a per-user `routine_conflicts` cache (owner-only).

**Design philosophy (committed):**

- **Resolution-first, never binary.** The default unit of output is "here is what to do" (alternate nights / separate AM-PM / buffer / no change needed), with the warning subordinate to the fix. For cosmetic timing rows, the conflict-detail screen ends on **"Keep alternate nights" / "Use together anyway"** so the user can record a preference. Safety-class exclusions are the explicit exception: they stay firm and clinician-deferred.
- **Evidence-graded and honest.** Every rule shows its grade. We say "contested" when it is contested and "myth" when it is refuted. This is the explicit anti-pattern to hazard-score apps (EWG) and to checkers that only ever warn.
- **Concentration- and context-aware.** A 0.3% retinol on resistant skin is not a 1.0% retinol on reactive skin. Where concentration/sensitivity are known, they modulate severity. This is the explicit anti-pattern to EWG's concentration-blind hazard model.
- **Calm, not gamified; private by default.** Per the spec cover's design decisions: "Streaks and cycling are calm, not gamified," and "Privacy copy is treated as brand voice." The shelf and conflict surfaces inherit this.

### 2. Data architecture & sourcing pipeline

A three-stage pipeline: **seed → curate → serve.**

**2.1 Ingredients ← EU CosIng.** Seed the ingredient dictionary from CosIng: INCI name (the canonical key, mandated on EU labels by Reg. 1223/2009 Art. 19), CAS and EC numbers, declared functions, and Annex II–VI status (prohibited / restricted / colourant / preservative / UV filter) with conditions and SCCS-opinion links. ~15,000 INCI inventory entries; the regulated subset is ~2,000–2,400. Carry CosIng's _"informative purpose and no legal value"_ disclaimer in internal provenance notes. **Action / confidence flag:** the Commission relaunched CosIng and the bulk-download path has been inconsistent; **verify the current export route at build time** and record the source + import date in a provenance table (mirrors exist but prefer the official source).

**2.2 Products ← Open Beauty Facts.** Seed products from the **daily export dumps** (CSV / Parquet / MongoDB), processed with DuckDB (docs/00 §3) — _not_ the live API. The live API (`world.openbeautyfacts.org/api/v2/product/{barcode}.json`, v2/v3) is reserved for **runtime per-scan lookups**, where the project's rule is **one API call per genuine user scan**; bulk pulls are blocked. Fields of interest: barcode (the join key to `user_products.barcode`), product name, brand, the raw INCI/ingredients text, images, categories. **Licence obligations (ODbL):** attribute Open Beauty Facts in-app (an "ingredient data" credit in Settings/About), keep any redistributed dataset share-alike, and **contribute back** any product a user adds via the app that isn't already in the commons. Send a descriptive `User-Agent` header on API calls (their requested contact mechanism). Coverage is volunteer-driven and uneven (~100,000+ products, 170 countries) — hence stage 3.

**2.3 Hand-curation (the quality floor).** Manually curate the **top ~2,000 products** — best-sellers across Sephora/Ulta/derm-favourites and the products our quiz cohort actually owns — to guarantee correct INCI parsing, brand normalisation, **concentration bands** for the actives that matter (e.g., "Retinol 0.3%", "Glycolic 7%" — exactly the precision the spec's product cards show), and a sensible default PAO. Curated rows are flagged `is_curated = true` and win over OBF data on conflict.

**2.4 INCI parsing & ingredient normalisation.** Raw OBF ingredient strings are messy (OCR artefacts, translations, "/"-separated INCI, parenthetical common names). The pipeline:

- tokenises the list, maps each token to a canonical `ingredient` via an INCI-name match plus a **synonym table** (e.g., "Vitamin C", "L-Ascorbic Acid", "Ascorbic Acid", "3-O-Ethyl Ascorbic Acid" → distinct canonical ingredients with a shared **functional family** "vitamin-C / ascorbates"; "Retinol", "Retinyl Palmitate", "Retinaldehyde/Retinal", "Adapalene", "Tretinoin" → family "retinoids", with adapalene/tretinoin sub-flags);
- assigns each ingredient one or more **functional tags** ("AHA", "BHA", "PHA", "retinoid", "vitamin-C", "niacinamide", "benzoyl-peroxide", "copper-peptide", "hydroquinone", "physical-SPF", "chemical-SPF", "humectant", "ceramide", "barrier-repair"), because **the conflict engine matches mostly on families/tags, not individual INCI names** (it is the _acid-ness_ and the _retinoid-ness_ that interact, not the specific brand molecule);
- records ingredient **position** in the list and a **concentration band** when derivable (label %, "≤1%" line break in EU lists, or curated value).

**2.5 What NOT to build on.** Do not scrape INCIDecoder, SkinSort, Skincarisma, CosDNA, or Cosmily: no public APIs, and their content/compilations carry ToS and database-right/legal risk (docs/00 §3). Their _existence_ is competitive intelligence, not a data source.

**2.6 Refresh, provenance, versioning.** A scheduled job (Supabase Edge Function or external cron) refreshes the OBF dump monthly and re-runs parsing; CosIng is refreshed on its publication cadence. Every catalog row stores `source` ('cosing' | 'open_beauty_facts' | 'curated' | 'user_contributed'), `source_ref`, and `imported_at`. The **rule set is independently versioned** (see §4) so a derm-reviewed change is a traceable event, not a silent edit.

### 3. Data model (the schema) — extends docs/01 §3

All tables in `public`. **Catalog tables are world-readable to authenticated users (and to anonymous users, because product intake happens during the pre-account quiz — docs/01 §2 step 6); writes are service-role only.** Per-user tables are owner-only RLS exactly as docs/01 §3 prescribes (wrap `auth.uid()` in a subselect, `TO authenticated`, index policy columns, `WITH CHECK` on writes).

```sql
-- ============ CATALOG (service-role writes; authenticated/anon read) ============

create table public.ingredients (
  id              uuid primary key default gen_random_uuid(),
  inci_name       text unique not null,        -- canonical key (Reg. 1223/2009 Art.19)
  display_name    text,                          -- friendly ("Vitamin C (L-Ascorbic Acid)")
  cas_number      text,
  ec_number       text,
  cosing_ref      text,                          -- provenance into CosIng
  annex_status    text,                          -- null | 'restricted' | 'prohibited' | 'preservative' | 'uv_filter' | 'colourant'
  annex_conditions text,                         -- e.g. max concentration / warnings
  source          text not null default 'cosing',
  imported_at     timestamptz not null default now()
);

create table public.ingredient_synonyms (       -- many spellings -> one ingredient
  id            uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  synonym       text not null,
  unique (synonym)
);

create table public.ingredient_tags (           -- functional families the engine matches on
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  tag           text not null,                   -- 'aha','bha','pha','retinoid','vitamin_c',
                                                 -- 'niacinamide','benzoyl_peroxide','copper_peptide',
                                                 -- 'hydroquinone','chemical_spf','physical_spf', ...
  subflag       text,                            -- e.g. 'adapalene','tretinoin','l_ascorbic_acid','encapsulated'
  primary key (ingredient_id, tag)
);

create table public.products (                   -- the catalog user_products.catalog_product_id -> here
  id            uuid primary key default gen_random_uuid(),
  barcode       text,                            -- join key to user_products.barcode / scans
  name          text not null,
  brand         text,
  category      text,                            -- 'cleanser','serum','moisturiser','spf','toner','exfoliant', ...
  default_pao_months int,                        -- from label, else category default (§6)
  is_curated    boolean not null default false,
  source        text not null default 'open_beauty_facts',
  source_ref    text,
  imported_at   timestamptz not null default now(),
  unique (barcode)
);
create index on public.products using gin (to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(brand,'')));

create table public.product_ingredients (        -- the join, with position + concentration band
  product_id        uuid not null references public.products(id) on delete cascade,
  ingredient_id     uuid not null references public.ingredients(id) on delete cascade,
  position          int,                          -- order in the INCI list (proxy for amount)
  concentration_band text,                         -- '<=1%','1-5%','>5%','unknown' | exact '0.3%' if curated
  primary key (product_id, ingredient_id)
);

-- The conflict / synergy matrix. Rules match on TAGS (families), not only INCI ids.
create table public.conflict_rules (
  id              uuid primary key default gen_random_uuid(),
  tag_a           text not null,                   -- e.g. 'retinoid'
  tag_b           text not null,                   -- e.g. 'aha'
  interaction_type text not null,                  -- 'irritation' | 'stability' | 'efficacy'
                                                   -- | 'synergy' | 'safety' | 'myth'
  base_severity   text not null,                   -- 'none' | 'mild' | 'moderate' | 'high'
  evidence_grade  text not null,                   -- 'A' | 'B' | 'C'  (SORT-anchored)
  evidence_label  text not null,                   -- consumer label: 'established'|'plausible'|'contested'|'refuted'
  mechanism       text not null,                   -- plain-language WHY (claim-safe)
  resolution_type text not null,                   -- 'separate_am_pm'|'alternate_nights'|'buffer'
                                                   -- |'lower_frequency'|'no_change'|'reassure'|'avoid_refer'
  resolution_copy text not null,                   -- the calm, claim-safe suggestion shown to user
  applies_when    jsonb,                           -- modulators: {"sensitivity":"sensitive"} | {"pregnancy":true}
                                                   --   | {"subflag_exempt":["adapalene","encapsulated"]}
  source_citation text not null,                   -- e.g. 'Martin et al., Br. J. Dermatol. 1998'
  rule_version    int  not null default 1,
  reviewed_by     text,                            -- 'derm:Dr X 2026-06' provenance of clinical sign-off
  is_active       boolean not null default true,
  unique (tag_a, tag_b, interaction_type, rule_version)
);

create table public.ingredient_pao_defaults (     -- category fallbacks where label PAO is unknown (§6)
  category        text primary key,                -- 'vitamin_c_serum','mascara','spf','moisturiser', ...
  default_pao_months int not null,
  rationale       text
);

-- ============ PER-USER (owner-only RLS) ============

-- Materialised, explainable record of detected interactions for a user's routines/shelf,
-- plus the user's chosen resolution. Recomputed on shelf/routine change.
create table public.routine_conflicts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  rule_id         uuid not null references public.conflict_rules(id),
  product_a_id    uuid references public.user_products(id) on delete cascade,
  product_b_id    uuid references public.user_products(id) on delete cascade,
  computed_severity text not null,                 -- after concentration/sensitivity modulation
  status          text not null default 'suggested', -- 'suggested'|'accepted'|'overridden'|'dismissed'
  user_choice     text,                            -- 'accept_suggested_timing'|'use_together'
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index on public.routine_conflicts (user_id);
```

**RLS sketch (catalog read = open to the role that does product intake during onboarding):**

```sql
alter table public.products enable row level security;
create policy products_read on public.products
  for select to authenticated using (true);            -- catalog is non-personal
-- (mirror for ingredients, ingredient_synonyms, ingredient_tags, product_ingredients,
--  conflict_rules (only is_active = true exposed), ingredient_pao_defaults)
-- NOTE: if product intake must work before sign-in (anon session), grant SELECT TO anon
--       on catalog tables too — these contain no personal data. Per docs/01 §1, anon users
--       hold the 'authenticated' role with is_anonymous=true, so `TO authenticated` already
--       covers them; verify at build time.

alter table public.routine_conflicts enable row level security;
create policy rc_owner_sel on public.routine_conflicts
  for select to authenticated using ((select auth.uid()) = user_id);
create policy rc_owner_ins on public.routine_conflicts
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy rc_owner_upd on public.routine_conflicts
  for update to authenticated using ((select auth.uid()) = user_id)
                                with check ((select auth.uid()) = user_id);
```

> **Decision-log note (DECISIONS.md):** these catalog/rule tables are new and should be logged (e.g. **D-016 — catalog tables world-readable, service-role write**; **D-017 — conflict rules matched on functional tags, not INCI ids**; **D-018 — `routine_conflicts` as a recomputed per-user cache**). Anything touching consent/RLS/legal for the _personal_ layer (e.g., whether detected-conflict data counts as shared if exported) belongs in **BLOCKERS.md**, not here.

### 4. The conflict & synergy engine

#### 4.1 Interaction types (the five classes)

Every rule is one of:

1. **`irritation`** — cumulative-irritation / barrier-compromise risk (real, dose- and sensitivity-dependent). _e.g., retinoid × AHA/BHA on sensitive skin._ Resolution usually `alternate_nights` or `lower_frequency`.
2. **`stability`** — one ingredient chemically degrades or destabilises another _in contact / in the same layer_ (a formulation-chemistry concern; often irrelevant if products are applied at different times). _e.g., benzoyl peroxide oxidising simple retinol; copper peptides catalysing ascorbic-acid oxidation._ Resolution usually `separate_am_pm`.
3. **`efficacy`** — a claimed reduction in how well one ingredient works. **Use sparingly and grade harshly** — most "efficacy-cancelling" claims are myths (see §4.4). Often collapses into `reassure`.
4. **`synergy`** — a _beneficial_ interaction worth surfacing positively. _e.g., vitamin C + sunscreen in the AM (antioxidant + UV defence); niacinamide + retinoid (niacinamide supports the barrier, tempering retinoid irritation)._ This is a differentiator: most checkers can't say anything nice.
5. **`safety`** — a genuine medical contraindication, categorically separate and **maximally conservative** (see §4.8). _e.g., topical retinoids in pregnancy/breastfeeding._ Resolution `avoid_refer` (suppress + route to clinician), never a casual cosmetic suggestion.

Plus the special label **`myth`** (interaction*type stored as `myth`): a widely-feared pairing the evidence \_refutes*. The engine surfaces these proactively to **reassure** (e.g., when a user adds both a niacinamide and a vitamin-C product). _No competitor does this well; it is pure trust equity._

#### 4.2 Severity scale

`none | mild | moderate | high`. **Base severity** lives on the rule; **computed severity** is modulated at detection time:

- **Concentration** — higher band ⇒ up to +1 step (a 10% glycolic + 1% retinol pushes harder than 0.3% retinol + a low-% PHA).
- **Sensitivity axis** (`skin_profiles.sensitive_resistant`) — sensitive ⇒ +1 step for `irritation` rules; resistant ⇒ may −1 step.
- **Sub-flag exemptions** — `applies_when.subflag_exempt` zeroes a `stability` rule when the retinoid is `adapalene` or `encapsulated` (per the Martin-1998 nuance: adapalene didn't degrade; optimised gels didn't degrade).

The spec's worked example — "Maya," **dry + sensitive** skin, with **Retinol 0.3%** and **Glycolic 7%** — yields a **Moderate** retinoid × AHA `irritation` conflict (sensitive bumps it up from mild; 0.3%/7% keeps it from high). That matches the spec's "Moderate" chip on p13 exactly.

#### 4.3 Evidence grade (SORT-anchored)

Internal grade maps to **SORT** (Ebell et al., AFP 2004): **A** = consistent good-quality patient-oriented evidence; **B** = inconsistent/limited patient-oriented evidence; **C** = consensus, opinion, _disease-oriented_ evidence (in-vitro, mechanistic), case series. **Reality check: essentially all skincare-interaction claims are C**, because they rest on stability assays and pH chemistry rather than trials of outcomes that matter to a person. We therefore present a **consumer-facing label** mapped on top of the grade:

| Consumer label  | Internal                                                 | When to use                                                                 | Example                                            |
| --------------- | -------------------------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------- |
| **Established** | C (robust mechanism + repeated in-vitro/clinical signal) | strong, repeatable mechanism with supporting data                           | BP degrades simple retinol/tretinoin (Martin 1998) |
| **Plausible**   | C (mechanism, thin human data)                           | a real chemical/biological mechanism, little outcome data                   | copper peptides + L-ascorbic acid (oxidation)      |
| **Contested**   | C (conflicting expert opinion)                           | reputable sources actively disagree; the popular claim isn't well-supported | retinoid × AHA/BHA _efficacy_                      |
| **Refuted**     | — (evidence contradicts the claim)                       | studies/consensus specifically debunk it                                    | niacinamide × vitamin C                            |

> **Honesty requirement:** because the grades are mostly C, the in-app "Source" line and any "evidence detail" view must say so plainly ("based largely on lab and mechanistic evidence; high-quality human-outcome studies are limited"). This is the spec's **"Evidence: contested"** chip generalised, and it is a feature, not a weakness.

#### 4.4 The matrix (the ~40 pairs — the crown jewel)

Below is the validated core. Each row is one or more `conflict_rules`. **This table must be signed off by a board-certified dermatologist and a cosmetic chemist/pharmacist before launch** (see §9; log as **BLOCKER B-DERM-REVIEW**). Citations are the _basis_, not proof; grades are deliberately conservative.

| #   | Family A × Family B                                                  | Type               | Base severity | Evidence (label / SORT) | Mechanism (claim-safe, plain)                                                                                                                                                | Resolution                                    | Basis                                                           |
| --- | -------------------------------------------------------------------- | ------------------ | ------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | --------------------------------------------------------------- |
| 1   | retinoid × AHA (glycolic/lactic)                                     | irritation         | mild→moderate | contested / C           | Both speed surface turnover; together they can over-exfoliate and stress the barrier, **especially on sensitive skin** — the "cancels each other out" idea is not supported. | alternate_nights                              | Paula's Choice; Westlake/London Derm; Glow Recipe (Dr. H. King) |
| 2   | retinoid × BHA (salicylic)                                           | irritation         | mild→moderate | contested / C           | As above; some dermatologists consider retinoid + BHA potentially synergistic for oily skin.                                                                                 | alternate_nights (oily/resistant: may co-use) | Glow Recipe (Dr. King); Paula's Choice                          |
| 3   | benzoyl peroxide × retinol/tretinoin (simple)                        | stability          | moderate      | established / C         | Benzoyl peroxide is an oxidiser; it can break simple retinol/tretinoin down on contact (~50% of tretinoin in ~2h, ~95% in 24h under light).                                  | separate_am_pm                                | Martin et al., _Br. J. Dermatol._ 1998                          |
| 3b  | benzoyl peroxide × **adapalene / encapsulated retinoid**             | (exempt)           | none          | established / C         | Adapalene and optimised/encapsulated retinoids resist BP oxidation (basis of adapalene+BP combo products).                                                                   | no_change                                     | Martin 1998; combination-product approvals                      |
| 4   | niacinamide × vitamin C (L-AA)                                       | **myth**           | none          | refuted / —             | The flushing fear came from a 1960s study using _niacin_ (not niacinamide) under heat; modern formulations combine them safely.                                              | reassure                                      | Clinikally; dermatology consensus                               |
| 5   | vitamin C (L-AA) × AHA (glycolic)                                    | irritation         | mild          | contested / C           | Chemically compatible (both work at low pH; commercial C+AHA products exist); the real concern is doubling potent actives → irritation.                                      | separate_am_pm or buffer                      | Dr. Sue Ann Wee (Schweiger Derm); commercial C+AHA              |
| 6   | copper peptides × vitamin C (L-AA)                                   | stability          | mild→moderate | plausible / C           | Copper can catalyse ascorbic-acid oxidation, so the vitamin C may degrade faster if layered together.                                                                        | separate_am_pm (C in AM, peptides PM)         | cosmetic-chemistry consensus                                    |
| 7   | copper peptides × AHA/BHA                                            | stability          | mild          | plausible / C           | Low-pH acids can destabilise peptides; best separated.                                                                                                                       | separate_am_pm / different days               | cosmetic-chemistry consensus                                    |
| 8   | multiple exfoliating acids stacked (AHA+BHA+ vitamin C same session) | irritation         | moderate→high | plausible / C           | Stacking several potent acids in one session raises over-exfoliation/barrier-damage risk.                                                                                    | lower_frequency (don't stack same night)      | dermatology consensus                                           |
| 9   | vitamin C (L-AA) × niacinamide                                       | synergy (positive) | n/a           | plausible / C           | Often complementary (brightening + barrier support); surface as a _good_ pairing, not a warning.                                                                             | no_change (reassure positively)               | as #4                                                           |
| 10  | vitamin C × sunscreen (AM)                                           | synergy (positive) | n/a           | plausible / C           | Antioxidant + UV protection are a classic morning pairing.                                                                                                                   | no_change (encourage)                         | dermatology consensus                                           |
| 11  | niacinamide × retinoid                                               | synergy (positive) | n/a           | plausible / C           | Niacinamide supports the barrier and can temper retinoid dryness/irritation.                                                                                                 | no_change (encourage)                         | dermatology consensus                                           |
| 12  | **retinoid × pregnancy/breastfeeding**                               | **safety**         | high          | (see §4.8)              | Conservative consensus is to avoid topical retinoids while pregnant/breastfeeding; this is a clinician conversation.                                                         | avoid_refer                                   | AAD-aligned expert consensus; see §4.8                          |
| 13  | **high-dose salicylic acid × pregnancy**                             | **safety**         | moderate→high | (see §4.8)              | High-dose salicylic acid is on common pregnancy-caution lists.                                                                                                               | avoid_refer                                   | pregnancy-safe-skincare consensus                               |
| 14  | **hydroquinone × pregnancy/breastfeeding**                           | **safety**         | high          | (see §4.8)              | Cosmetic hydroquinone use is hard to justify in pregnancy/lactation; defer to a clinician.                                                                                   | avoid_refer                                   | dermatology lactation reviews                                   |
| 15  | any active × compromised/over-exfoliated barrier (self-reported)     | irritation         | moderate      | plausible / C           | When skin is already irritated, pause actives and prioritise barrier repair.                                                                                                 | lower_frequency / recovery                    | skin-cycling rationale (Bowe)                                   |

Rows 16–~40 extend the same pattern conservatively (e.g., retinoid × vitamin C _timing_ → reassure-with-buffer; AHA × physical scrub → over-exfoliation; benzoyl peroxide × vitamin C → mild stability; fragrance/essential-oil flags × sensitive skin → caution; etc.), each graded C and resolution-first. **The matrix ships small and correct, not large and shaky.** Every addition is a versioned, derm-reviewed event.

#### 4.5 Resolution strategies (the verbs)

- **`separate_am_pm`** — one ingredient AM, the other PM (BP/retinoid; vitamin C/copper peptides). Wires into the AM/PM routines (doc #3).
- **`alternate_nights`** — the spec's signature move; place the two on different cycling nights. _Drives the skin-cycling scheduler (§5)._ The spec's PM banner ("Your glycolic toner is skipped tonight… Next acid night: Saturday") is this resolution rendered.
- **`buffer`** — apply a moisturiser between actives, or wait ~1 min (the spec's "Wait ~1 min after serum" microcopy on the AM Today screen is a buffer hint).
- **`lower_frequency`** — reduce one active to N×/week; the default de-escalation for sensitive skin.
- **`no_change`** — compatible (or synergistic) — surface calm reassurance, optionally a positive note.
- **`reassure`** — for `myth` rows: proactively tell the user the feared combination is fine.
- **`avoid_refer`** — `safety` only: suppress the recommendation and route to a clinician (§4.8).

#### 4.6 Detection algorithm

Runs (a) on the **shelf** (any two products the user owns) for the Shelf conflict banner, and (b) on each **routine** (products in the same AM/PM/cycling slot) for routine-level and PM auto-resolution. Pseudocode:

```
detect(user):
  products = user_products(user, status='active') joined to product_ingredients -> tags
  profile  = skin_profiles(user)   # sensitivity, pregnancy, goals
  results  = []
  for (p_a, p_b) in unordered_pairs(products):     # shelf-level
      for tag_a in tags(p_a), tag_b in tags(p_b):
          rule = active_rule(tag_a, tag_b)          # tag-based lookup, both orders
          if not rule: continue
          if exempt(rule, p_a, p_b): continue        # adapalene/encapsulated sub-flags
          sev = modulate(rule.base_severity, concentration(p_a,p_b), profile.sensitivity)
          if rule.type == 'safety' and applies(rule.applies_when, profile):
              sev = 'high'
          results.append(Conflict(rule, p_a, p_b, sev))
  # routine-level: only flag pairs that land in the SAME application moment
  # (same routine + same cycling_night, or both 'daily'); pairs already separated
  # by AM/PM or by alternate nights are RESOLVED, not flagged.
  rank(results, by=[type=='safety', severity, evidence_label])  # safety first, then severity
  upsert routine_conflicts(user, results)  # preserve prior user_choice/overrides
  return results
```

Key behaviours:

- **Tag-based, both-orders matching.** `(retinoid, aha)` and `(aha, retinoid)` resolve to one rule.
- **Resolution-aware:** if two clashing actives are _already_ on different cycling nights or different AM/PM slots, the routine view shows them as **resolved/"paired"** (the spec's "paired" badge on the Glycolic 7% card, p12), not as an active warning.
- **Idempotent, canonical upsert** identifies a choice by `(user_id, rule_id, unordered product pair)`, preserves the user's earlier `status`/`user_choice`, and records the rule version that was actually reviewed. Reversed product order cannot create a second decision.
- **V1 choice contract:** the encrypted local record is the immediate authority and stores the exact product pair, choice, and rule version. Both `accept_suggested_timing` and `use_together` remove that exact current-version row from repeated Shelf, Plan, Recommendations, and Ask prompts. The generic acceptance value is truthful for `alternate_nights`, `separate_am_pm`, and `lower_frequency`; legacy `keep_alternate_nights` records migrate to it. A changed rule version becomes unresolved again. `use_together` records the user's preference but does not auto-co-locate potent actives: the guided checklist keeps the reviewed one-potent-active/night and retinoid-exfoliant separation constraints until named clinical and cosmetic-chemistry review approves a pair-specific co-use rule. Safety, pregnancy, cadence, and concentration gates are never bypassed. The owner-RLS `routine_conflicts` row is a best-effort mirror until `B-SUPABASE`/`B-ROUTINE-PERSIST` close.
- **Where it runs:** as a Postgres function (`detect_conflicts(uid)`, `SECURITY DEFINER`, hardened with `REVOKE … FROM public, anon, authenticated` per DECISIONS.md D-013 pattern) for authoritative server computation, **and** mirrored as a pure client-side function over the **cached rule set** so the shelf works offline (docs/01 §6: TanStack Query + persisted cache). The rule set is small (~40 rules) and ships to the client.

#### 4.7 Personalization

- **Sensitivity** raises `irritation` severities and biases toward `lower_frequency`/`alternate_nights`; a future resistant/oily co-use path may ship only as an explicit, pair-specific, reviewer-approved rule. V1 does not infer it.
- **Goals** (`skin_profiles.goals`) tune tone, not safety (a "barrier repair" user sees more conservative cadence and more recovery nights).
- **Pregnancy/breastfeeding** triggers the safety class (§4.8) regardless of everything else.
- **Conservative default:** when concentration or sensitivity is unknown, assume the **more cautious** branch.

#### 4.8 Safety rules (the one place the app gets firm — and defers)

Genuine medical contraindications are **not** cosmetic compatibility and are handled in a separate, conservative path. The anchor case is **topical retinoids in pregnancy/breastfeeding**: the evidence shows minimal systemic absorption and **no demonstrated harm from topical use**, yet expert consensus (AAD-aligned guidance; dermatology pregnancy/lactation reviews) is to **avoid out of caution** ("better safe than sorry"), with bakuchiol a commonly-suggested alternative. (Oral retinoids like isotretinoin are absolute contraindications, but those are prescription drugs outside OnSkin's cosmetic scope.) High-dose salicylic acid and hydroquinone are on the same pregnancy-caution list.

Engine behaviour for `safety` rules:

- **Detect early.** `skin_profiles.pregnancy_status` is captured in onboarding (docs/01 §2 step 5; flagged there as "liability-reducing"). The moment a flagged product meets a flagged state, raise it.
- **Calm, non-diagnostic, defer to a clinician.** Copy pattern: _"Many dermatologists suggest pausing retinoids while pregnant or breastfeeding. This is a conversation for you and your doctor — consider setting this aside for now; we can suggest a gentler alternative."_ No diagnosis, no alarm, no "dangerous."
- **Suppress and defer.** Remove the retinoid from suggested routines/cycling and offer a clinician conversation or reviewed alternative. A cosmetic timing choice cannot restore a safety-excluded product.
- **Disclaimer-linked.** Always paired with the global not-medical-advice line (§9).

### 5. The skin-cycling scheduler

**Source framework:** Dr. Whitney Bowe's classic four-night cycle — **Night 1 Exfoliate → Night 2 Retinoid → Night 3 Recover → Night 4 Recover**, then repeat — designed to stagger the most irritating actives to protect the moisture barrier. Bowe explicitly supports variants: **gentle** (more recovery nights, fewer push nights — for sensitive skin) and **advanced** (fewer recovery nights, stronger products). This maps onto `routine_steps.cycling_night` (docs/01 §3: 1=exfoliation, 2=retinoid, 3–4=recovery) with no schema change.

**Personalisation:**

- **Sensitive / "barrier repair" goal (Maya):** start gentle — e.g., a 5- or 6-night cycle with extra recovery nights, retinoid 2×/week (matches the spec's reveal advice: "a low-strength retinoid two nights a week, no daily acids, ceramides every day," p6). The spec's PM screen shows **"NIGHT 2 OF 4"** with Retinoid active — a faithful classic cycle for a user who tolerates it.
- **Resistant / oily:** the classic 4-night, or advanced.
- **No actives owned:** no cycling; a simple daily AM/PM.

**How conflicts fold in (the integration that is the moat):** the scheduler reads the `alternate_nights` resolutions from the engine and _places_ the clashing actives on different nights, then renders the consequence in the daily view. The spec's PM banner — _"Your glycolic toner is skipped tonight — it doesn't mix well with retinol. Next acid night: Saturday."_ — is the scheduler computing: (a) tonight is retinoid night (cycling night 2), (b) glycolic is an AHA that `alternate_nights`-conflicts with the retinoid, so (c) suppress glycolic tonight and (d) compute the **next acid night** from the cycle calendar and name it. This is the single highest-value screen in the whole layer: the conflict is _already resolved and explained in context_, with zero user effort.

**Calendar / "next acid night" computation:** given the cycle definition (ordered nights + start date/anchor) and today's date, project forward to the next night whose slot is `exfoliation`; render as a friendly weekday ("Saturday"). Recompute on edits and on date rollover (local-day aware — see the timezone tolerance in DECISIONS.md D-012).

**Calm, not gamified (per spec cover):** the night strip (Exfoliate · Retinoid · Recover · Recover) uses the clay accent for tonight only; no points, badges, or stre-streak pressure on the cycle itself. (Streaks live in the habit loop, doc #7, and are themselves "calm.")

### 6. PAO / expiry / shelf intelligence

**Regulatory basis (for data provenance, not a claim):** EU Reg. (EC) 1223/2009 Art. 19 / Annex VIIIa — the open-jar "12M / 6M" PAO symbol is mandatory only for products with minimum durability **>30 months**; products ≤30 months carry a best-before date; sealed/single-dose/inherently-stable products are exempt. **US FDA does not require cosmetic expiry/PAO** (sunscreens excepted, as OTC drugs).

**The data reality and the fallback:** `user_products` already computes `expiry_computed = least(expiry_date, opened_at + pao_months)` (docs/01 §3). The intelligence layer's job is to **populate `pao_months` well**:

1. label/catalog PAO if known (`products.default_pao_months`);
2. else a **category default** from `ingredient_pao_defaults`;
3. else **"PAO unknown / estimated"** — never a fabricated precise date.

**Category-default PAO table (seed values; conservative):**

| Category                           | Default PAO (months)   | Rationale                                              |
| ---------------------------------- | ---------------------- | ------------------------------------------------------ |
| Vitamin C (L-AA) serum             | 3–6                    | ascorbic acid oxidises quickly once opened/air-exposed |
| Mascara / liquid eye               | 3–6                    | eye-area microbial risk                                |
| Benzoyl peroxide / actives in jars | 6                      | oxidiser; potency decay                                |
| Sunscreen (SPF)                    | use **printed expiry** | OTC drug; regulated expiry exists                      |
| Water-based serum/toner            | 6–12                   | preservative-dependent                                 |
| Moisturiser (tube)                 | 12                     | typical                                                |
| Moisturiser (jar)                  | 6–9                    | finger-dipping contamination                           |
| Oil / anhydrous balm               | 12–24                  | low water activity                                     |
| Cleanser                           | 12                     | rinse-off                                              |

(Final numbers to be confirmed with the cosmetic chemist — log under B-DERM-REVIEW.)

**Badge logic (the shelf, spec p12):**

- **Date badge** ("Sep 2026", "May 2027") — the `expiry_computed` month, shown neutrally when comfortably ahead.
- **Countdown badge** ("3 wks left") — clay-tinted when within a threshold (e.g., ≤30 days) — the spec's Mineral SPF 50 card.
- **"Expiring" filter** — the chip at top filters to products within threshold or past `expiry_computed`.
- **"paired" badge** — when a product's conflict is _already resolved_ by the scheduler (the spec's Glycolic 7% card), signalling "handled," not "problem."
- **Expired** — a gentle, non-alarmist "time to replace" state (and a replenishment nudge, doc #7).

**Barcode scan → shelf (the activation flow):** the spec's "Scan a barcode" CTA opens an on-device camera (vision-camera, docs/00 §4); on a successful barcode read, hit the OBF live API (one call per scan) → match `products.barcode` → show name/brand/parsed actives → prompt **"When did you open it?"** (sets `opened_at`) and confirm/estimate PAO → write `user_products`. Fallbacks in order: **search** the catalog, **OCR** the printed INCI list, **manual entry**. New/unknown products are **contributed back** to Open Beauty Facts (ODbL obligation) after light validation.

### 7. UI / UX specification (every surface — look, feel, and behaviour)

**Design tokens (from the spec cover, committed):** display = **Instrument Serif** (editorial moments — screen titles like "Shelf," "Your plan is ready," profile headlines); UI = **Hanken Grotesk** (everything functional); a **monospaced** face for captions/labels/metadata ("14 products," "opened Mar · 6 mo PAO," "NEXT", the "01 · Welcome" annotations — see DECISIONS.md D-005). Palette: **paper · greige · clay · ink · night** — warm clinical neutrals with one restrained **clay** accent. **Light mode** for shelf/AM; **dark ("night")** for the PM routine and capture screens (spec: shown dark "since that's when they're used"). 8pt grid; Reanimated 3 motion; restrained haptics; WCAG 2.2 AA; Dynamic Type; full dark mode; RTL-ready (docs/00 §8, docs/01 §8).

#### 7.1 Shelf screen (spec p11–12)

Anatomy, top to bottom:

- **Status bar** (9:41, signal/wifi/battery) — standard.
- **Title block:** "**Shelf**" in Instrument Serif (large), with the product count "**14 products**" right-aligned in mono. Generous top padding on paper.
- **Filter chips:** pill segments **All / Actives / Expiring** — "All" selected (ink fill, paper text); others outlined. `Actives` filters to products bearing an active tag (retinoid/AHA/BHA/vitamin-C/BP); `Expiring` filters via the badge logic in §6. Single-select; haptic tick on change.
- **Conflict banner (calm):** a **clay-tinted, low-contrast** card with a small clay dot, a short bold line — "**Retinol + glycolic acid share your PM routine**" — a one-line calm subhead — "Use them on alternate nights." — and a quiet **"Review →"** affordance opening the conflict detail. **Never red, never an alert icon.** Shelf-only detection must not claim placement; placement-confirmed copy is reserved for scheduler-backed routine contexts with real cycle output. The banner appears only when there's an _unresolved or noteworthy_ interaction; when everything is handled, it's absent or replaced by a subtle "all clear" affordance.
- **Product cards:** each a paper card with a rounded thumbnail (placeholder hatch until imagery), product name (Hanken, semibold), a mono metadata line ("Verra Skin · opened Mar · 6 mo PAO"), and a **right-aligned badge** (date / countdown / "paired"). Tappable → product detail (opened date, PAO, the actives it contributes, any conflicts it's part of, finish/discard actions).
- **Scan FAB:** a dark **"Scan a barcode"** pill, centred low, clearly primary.
- **Tab bar:** Today · Progress · Shelf · You (Shelf active, clay dot indicator).

States: **empty shelf** → a warm prompt to scan/add the first product (ties to onboarding's "current products intake," docs/01 §2 step 6); **loading** → skeleton cards (no spinners, docs/01 §8); **all-resolved** → no banner, calm.

#### 7.2 Conflict banner (calm, reusable)

Used on Shelf and (variant) in the PM routine. Rules: clay tint not red; verb-first calm subhead that states the _resolution_ ("Use them on alternate nights") unless the scheduler has actually placed the products, in which case routine context may say so and show the computed next night; one quiet action ("Review →"). It models the spec cover's mandate — "non-alarmist resolution… the evidence is contested."

#### 7.3 Conflict detail screen (spec p13 — the trust set-piece)

The most important screen for credibility. Anatomy:

- **Severity + evidence chips, side by side:** "**Moderate**" (severity) and "**Evidence: contested**" (the grade label). Both quiet, neutral-toned — _information, not alarm._
- **Title:** "**Retinol × glycolic acid**" — Instrument Serif, the "×" rendered as a true multiplication sign (the pairing, stated plainly).
- **Mechanism copy (claim-safe):** "Used the same evening, these can compound irritation — especially on sensitive skin like yours. Recent research suggests the risk is smaller than once thought, **so this is a recommendation, not a rule.**" (This is exactly the honest, contested-aware framing this whole document argues for, and it is already in the spec.)
- **"OUR SUGGESTION":** the resolution, stated calmly — "Alternate nights — keep retinol and glycolic on different evenings." If a cycle exists, the routine view may add exact nights and confirm the plan reflects them; shelf-only conflict detail must not assert placement.
- **Affected products:** "Retinol 0.3% · Glycolic 7%" (the user's actual shelf items, with concentrations).
- **Source:** "Derm. literature review, 2025" — the citation line. **Generalise:** this line must also carry the honesty note that the evidence is largely lab/mechanistic where that's true.
- **Two actions, user in control:** "**Keep alternate nights**" (primary, accept) and "**Use together anyway**" (secondary, records `routine_conflicts.user_choice='use_together'`). Either choice is saved only after the encrypted write succeeds and stops repeat advisory prompts for that exact pair/rule version. The sheet states that guided check-offs remain on the reviewed one-potent-active schedule until named co-use review; safety rows never render these override actions.

Accessibility: severity/evidence chips have text labels (not colour-only); VoiceOver focus lands on the title on entry; the two actions are ≥44pt.

#### 7.4 PM Today auto-resolution (spec p9 — the highest-value moment, dark mode)

- **Header:** "THURSDAY · 9:41 PM" (mono), "**Good evening.**" (serif) — on the night palette.
- **Skin-cycling night strip:** "SKIN CYCLING · NIGHT 2 OF 4" with four segments **Exfoliate · Retinoid · Recover · Recover**; tonight (Retinoid) highlighted in clay; the rest muted. Calm, no gamification.
- **Evening routine checklist:** "Evening routine · 0 of 3" with steps (Cream cleanser → Retinol 0.3% → Ceramide moisturizer), each with a calm one-line instruction ("Dry skin fully before the retinoid," "Pea-sized · avoid eye area," "Generous layer tonight") — these are the buffer/usage hints the engine attaches.
- **Conflict auto-resolution banner (clay dot, calm):** "Your glycolic toner is skipped tonight — it doesn't mix well with retinol. **Next acid night: Saturday.**" — the `alternate_nights` resolution + the computed next-acid-night, rendered in context. _This is the engine, the scheduler, and the calm-copy system working as one._

#### 7.5 Barcode scan & add-to-shelf

On-device camera with a framing reticle; on read, a result sheet (product, brand, parsed actives, estimated PAO); an "opened when?" prompt; confirm → shelf. Fallback chips: **Search**, **Scan ingredient list (OCR)**, **Add manually**. Privacy microcopy consistent with the brand voice ("Scanning happens on your device"). Unknown products → contribute-back to OBF.

#### 7.6 Product card states & badge taxonomy

Badges (right-aligned, mono): **future date** (neutral) · **"N wks/days left"** (clay, within threshold) · **"paired"** (resolved-conflict, calm) · **"expired / replace"** (gentle). Card tap → detail. Long, multi-active products show up to ~2 active tags inline, rest under detail.

#### 7.7 Microcopy, motion, haptics, accessibility, localisation

- **Microcopy principles:** **claim-safe** (cosmetic verbs only — "reduce the appearance of," "may minimise irritation," "supports the barrier"; never "treats," "cures," "stimulates collagen," "heals"); **calm** (no exclamation, no "warning/danger/avoid" for cosmetic-compatibility rules); **evidence-honest** (say "contested"/"myth" when true); **resolution-first** (lead with the fix).
- **Motion:** subtle fades and the clay highlight; respect Reduce Motion. No bouncy/gamified celebration on conflicts.
- **Haptics:** selection tick on chip/checkbox; nothing alarming on a conflict.
- **Accessibility:** chips/badges carry text (never colour-only); 44pt targets; VoiceOver focus management on screen entry; Dynamic Type reflow (no fixed-height text containers); dark-mode variants for PM/capture.
- **Localisation:** externalise all rule copy (`resolution_copy`, `mechanism`, labels) for ~30% string-expansion and RTL (docs/01 §8). Rule copy is content, not code.

#### 7.8 Reassurance surfaces (the differentiator made visible)

When a user owns/added two ingredients the evidence _clears_ (e.g., niacinamide + vitamin C), surface a quiet **positive** note ("These two work well together — no need to separate them") in the same calm card style. This converts the most common skincare myth into a moment of trust, and it is something the warn-only competitors structurally cannot do.

### 8. Privacy & compliance (personal layer)

The **catalog and rules are non-personal** and carry no privacy weight. The **personal layer** — _your_ shelf, _your_ detected conflicts, _your_ cycle — is **health-inference data** (it reveals skin conditions, pregnancy status, product usage) and is therefore covered by the consents already specified in docs/01 §4 (health-data-collection consent before the quiz; the shelf and conflict data are downstream of that). It is RLS-isolated per user (§3), never sold or shared, and never used to train AI (consistent with the spec's "Sold, shared, or used to train AI: NEVER" and "on-device" brand promises, spec p4/p7). If a data-export (docs/01 §4, GDPR Art. 20) includes detected-conflict and shelf data, that is owner-only export, not sharing. _Whether surfacing pregnancy-linked safety rules constitutes additional special-category processing to disclose in the DPIA is a question for counsel — log under BLOCKERS._

### 9. Legal / liability framing (the part the brief is most worried about)

**The cosmetic-vs-drug line (FD&C Act §201(g)/(i)).** A product (or, by extension, the claims around it) becomes a **drug** if it is intended to "diagnose, cure, mitigate, treat, or prevent disease" _or_ to "affect the structure or any function of the body." **Intended use is judged by claims — including claims on the Internet and in promotional materials (FDA).** OnSkin's in-app copy (resolutions, banners, value props) is a **claims surface**. The FTC separately polices advertising for truthfulness/substantiation. **Constraints:** keep all generated copy cosmetic ("reduce the appearance of fine lines," "may minimise irritation," "supports the look of an even tone"); never "treats acne," "cures rosacea," "stimulates collagen," "repairs DNA." Route anything disease-adjacent to "see a dermatologist."

**Not medical advice — a standing disclaimer.** A clear, persistent disclaimer ("OnSkin provides general information about cosmetic products and routines. It is not medical advice and is not intended to diagnose, treat, cure, or prevent any disease. Consult a dermatologist for medical concerns.") appears in onboarding, in Settings, and contextually on the conflict-detail and any safety screens. This is both ethically right and the core liability mitigation.

**The two-sided liability, addressed by design.**

- _False reassurance_ (saying a harmful combo is fine): mitigated by conservative concentration/sensitivity defaults, the separate `safety` class, evidence grades that don't overstate, and expert sign-off.
- _False alarm_ (scaring off a safe/beneficial combo): mitigated by the `myth`/`reassure`/`synergy` classes and the contested-aware copy — the engine is _designed_ to de-escalate and to say "this is fine."

**Expert sign-off and versioning (mandatory before launch).** The entire `conflict_rules` set — types, severities, grades, mechanisms, resolutions, citations, and especially every `safety` rule — must be reviewed and signed off by a **board-certified dermatologist** and a **cosmetic chemist / pharmacist** (record provenance in `conflict_rules.reviewed_by`). Rules are **versioned** (`rule_version`) so each clinical change is an auditable event, and the app stores which rule version produced each surfaced `routine_conflicts` row. Ship with a **user feedback path** ("Was this helpful? / Report an issue") feeding rule QA. _This recommendation is **mandatory, not optional** — exactly as docs/01 made the Baumann patent review mandatory._ Log as **BLOCKER B-DERM-REVIEW** (gates launch of this layer).

**Other flags:** geofencing around healthcare facilities is banned under MHMDA — never location-target health content (docs/00 §7). Affiliate links (ShopMy, doc #10) layered on top of conflict resolutions must not create a conflict-of-interest appearance ("we flagged X so you'd buy Y") — keep recommendations evidence-led and disclosed.

### 10. Engineering / implementation notes

- **Where logic lives:** authoritative detection as a hardened `SECURITY DEFINER` Postgres function (`detect_conflicts(uid)`) with `REVOKE … FROM public, anon, authenticated` (DECISIONS.md D-013 pattern), invoked after shelf/routine mutations; a mirrored **pure client-side** detector over the cached (~40-rule) set for offline shelves (docs/01 §6). Scheduling/next-acid-night computed client-side from the cycle definition, reconciled server-side.
- **Offline:** the rule set and the user's catalog slice are cached (TanStack Query persistence, docs/01 §6); detection and badges work offline; `routine_conflicts` writes queue and sync (idempotent upsert).
- **Performance:** tag-indexed rule lookups; pairwise detection over a shelf of ~10–30 products is trivial; precompute and cache `routine_conflicts`, recompute on change only.
- **Testing (non-negotiable for a liability surface):** **every rule has a fixture test** asserting (inputs: two tagged products + a profile) → (expected type, computed severity, resolution, copy). The Maya fixture (dry/sensitive + Retinol 0.3% + Glycolic 7%) must assert **Moderate / contested / alternate_nights** and the PM "next acid night" output. Maestro E2E for the scan→shelf→banner→detail→override flow (docs/00 §9).
- **Analytics (PostHog, docs/01 §7):** `product_scanned` (`source`, `matched`), `product_added` (`method`: scan/search/ocr/manual), `conflict_detected` (`rule_id`, `severity`, `evidence_label`), `conflict_detail_viewed`, `conflict_resolution_chosen` (`keep`/`use_together`), `cycling_night_viewed`, `pao_expiring_shown`. These also measure whether the layer drives the activation/retention it's claimed to.
- **Ships as build-order #2** (docs/00): after auth/data-model/RLS (#1), before the routine builder (#3) and smart-shelf surfacing (#4) consume it.

---

## Seven-Figure Validation (the moat & the money)

**Is this the feature that makes OnSkin "king of the category" and underwrites a 7-figure business? The honest answer: yes — but for the right reasons, and not the obvious one.**

**Market reality.** The skincare _app_ segment is estimated at **~$500M in 2025 growing ~15%/yr toward ~$1.8B by 2033** (DataInsights — directional, vendor-sourced), sitting inside a **~$122–178B skincare products market** (Fortune Business Insights; Precedence) and a fast-growing beauty-tech market (SkyQuest: ~$88B in 2025 → ~$354B by 2033 at ~19% CAGR — definitions vary, treat as directional). Demand for ingredient transparency is a named driver of app adoption. A **$1M ARR at $39.99/yr is roughly 25,000 paying subscribers** (gross, before the store cut) — a small slice of a market this size, and lower still with a Pro+ tier (docs/00 §5 floats Pro+ $79.99/yr).

**The direct proof point.** **Yuka** monetises a privacy-first, scan-based, subscription product to **$7.3M/year (98.1% from subscriptions), with ~15 staff, 80M+ users, zero brand revenue and zero marketing spend** (Yuka's own 2024 accounts, via docs/01 §9). It proves consumers will pay for trustworthy, independent ingredient intelligence. OnSkin's wedge over Yuka is precisely this layer's _depth_: Yuka gives one number per product; OnSkin gives a personalised, resolved, habit-integrated system.

**Why this layer specifically drives the money:**

1. **It is the paywall.** Two of the four paywall value props (spec p7) are this layer verbatim: "Routine intelligence — order, timing, skin cycling" and "Ingredient conflict checks, with evidence grades." This is what the user is asked to pay for at the Day-0 conversion moment where ~half of subscription conversions happen (RevenueCat SOSA, docs/01 §9).
2. **It is the retention/lock-in engine.** Every product scanned, every conflict resolved, every cycling night logged deepens a **personal data moat**: re-creating "my shelf + my conflicts + my cycle + my photos" elsewhere is the switching cost. docs/01 §9 ties exactly this data-accumulation to retention, and annual plans retain far better than monthly (RevenueCat SOSA ~44% one-year on annual vs ~17% monthly) — so the layer's compounding value is what makes the annual default stick.
3. **It is the trust/word-of-mouth flywheel.** The evidence-graded, non-alarmist, myth-busting posture is _differentiated trust_, and trust is what drove Yuka's zero-marketing growth. An app that reassures (niacinamide + vitamin C is fine) as credibly as it cautions earns the recommendation.

**The honest competitive read (where the moat is NOT).** Conflict _detection_ is **not** defensible — SkinSort, Cosmily, and HadaBuddy already ship it in 2026, and a hazard score is a commodity (Yuka, EWG). If OnSkin positions on "we detect conflicts," it loses. The defensible moat is the **combination**: curated data quality + the SORT-anchored evidence-grading discipline + concentration/sensitivity awareness + the _resolution-first, calm_ treatment + deep integration into the daily habit loop and skin cycling + PAO intelligence + privacy-first + the compounding personal-data lock-in. No competitor combines all of these, and several (the warn-only checkers) _structurally cannot_ match the reassurance/synergy behaviour.

**What would break the thesis:** (a) **getting the science wrong** — a false-reassurance harm or a viral "this app spreads myths" moment would destroy the trust the model depends on (hence §9's mandatory expert sign-off); (b) treating it as a feature to _advertise_ rather than an experience to _integrate_; (c) data-coverage so thin that scans frequently fail (mitigated by curation + OCR + manual + contribute-back). Mitigate those and this layer is the engine, not the plumbing.

**Verdict: the ingredient intelligence layer is the single most defensible, monetisable, and retention-driving component of OnSkin — conditional on evidence discipline and deep integration, exactly as docs/00 predicted when it called this "the moat and the longest pole."**

---

## Synthesis

**(a) What this layer is:** the cross-cutting brain — catalog + conflict/synergy engine + skin-cycling scheduler + PAO intelligence + grading/copy system — feeding the Shelf, the conflict surfaces, the PM auto-resolution, the routine builder, and the paywall.

**(b) Data:** CosIng (ingredients, free, "no legal value," verify bulk route) + Open Beauty Facts (products, ODbL contribute-back, API = 1/scan, bulk via dumps) + hand-curated top ~2,000; tag-based normalisation; never scrape INCIDecoder/SkinSort/Skincarisma.

**(c) Engine:** a ~40-pair curated rules matrix; five interaction classes (irritation / stability / efficacy / synergy / safety) + a `myth` reassurance class; SORT-anchored evidence grades with honest consumer labels (established / plausible / contested / refuted); concentration- and sensitivity-modulated severity; resolution-first verbs (separate_am_pm / alternate_nights / buffer / lower_frequency / no_change / reassure / avoid_refer); detection that is tag-based, both-orders, resolution-aware, idempotent, and runnable offline.

**(d) Skin cycling:** Bowe's four-night framework, personalised by sensitivity, with conflicts _resolved into_ the cycle and rendered as the spec's calm PM banner + next-acid-night.

**(e) PAO:** EU-law artefact, US gap; populate from label → category default → honest "unknown"; the badge taxonomy (date / countdown / paired / expired) on the shelf.

**(f) UI/feel:** Instrument Serif + Hanken Grotesk + mono labels; paper/greige/clay/ink/night; light for shelf/AM, dark for PM/capture; calm, non-alarmist, claim-safe, evidence-honest, resolution-first; user always in control ("Use together anyway"); reassurance surfaces for myths.

**(g) Liability:** cosmetic-claim discipline (in-app copy is a claims surface); standing not-medical-advice disclaimer; conservative safety class with clinician routing; **mandatory dermatologist + cosmetic-chemist sign-off** of the rule set (B-DERM-REVIEW, gates launch); versioned, auditable rules; user feedback loop.

**(h) 7-figure verdict:** yes — it is the paywall, the retention/lock-in engine, and the trust flywheel; defensible on integration + grading + data + privacy + lock-in, **not** on conflict detection alone; the one existential risk is getting the science wrong, which §9 is built to prevent.

---

## Recommendations

1. **Build the curated rules engine, not ML — and ship the matrix small and correct.** Start with the ~15 validated rows in §4.4, each graded conservatively, each with a fixture test. Grow only via versioned, derm-reviewed additions.
2. **Make `B-DERM-REVIEW` a hard launch gate.** No `conflict_rules` row — especially any `safety` row — ships without board-certified-dermatologist + cosmetic-chemist sign-off recorded in `reviewed_by`. This is the primary liability control and the primary trust asset.
3. **Stand up the three-source pipeline now (build-order #2).** CosIng seed (verify bulk route), Open Beauty Facts via daily dumps (DuckDB) for seeding + API for per-scan (one call per scan; contribute-back), hand-curate the top ~2,000. Store source + import provenance on every row.
4. **Match rules on functional tags, not INCI ids,** and carry sub-flags (adapalene, encapsulated) so the BP-exemption and similar nuances are expressible.
5. **Treat the `myth`/`synergy`/`reassure` behaviour as a first-class differentiator.** Most of the category only warns; OnSkin's ability to credibly say "this is fine / this is good together" is unique trust equity — design surfaces for it (§7.8).
6. **Implement the skin-cycling scheduler as the place conflicts get resolved,** and invest in the PM auto-resolution screen (§7.4) — it is the highest-value, most-demoable moment in the layer.
7. **Engineer the two-sided liability:** conservative concentration/sensitivity defaults; a separate maximally-conservative safety path that defers to clinicians; claim-safe copy everywhere; a standing not-medical-advice disclaimer; versioned rules; a user feedback loop.
8. **Handle the PAO gap honestly:** category defaults + "estimated/unknown," never a fabricated date; use printed expiry for sunscreens.
9. **Instrument the layer in PostHog** to prove it drives activation/retention (scan→add→conflict→resolution funnels), and wire it to the paywall value props.
10. **Position the moat correctly in all messaging:** "personalised, evidence-graded routine intelligence that resolves conflicts into your daily plan and stays honest about the science" — not "a conflict checker."

---

## Caveats (confidence flags)

- **The ingredient-interaction evidence is genuinely contested and overwhelmingly disease-oriented (SORT grade C).** Reputable sources (Paula's Choice; dermatologists quoted by Glow Recipe) dispute the popular "rules." Every rule must carry an evidence grade and a non-alarmist resolution, and the matrix needs clinical sign-off. _Medium-low confidence on individual pairs; high confidence on the "curated rules engine, evidence-graded, resolution-first" architecture._
- **Specific conflict-pair grades and the PAO category defaults are starting positions for the dermatologist/cosmetic-chemist review, not settled facts.** The benzoyl-peroxide × retinoid figures (Martin 1998) and the niacinamide × vitamin C refutation are well-supported; many other rows rest on cosmetic-chemistry consensus. _Medium confidence; re-grade at review._
- **Skin cycling is a dermatologist-developed framework, not an RCT-validated protocol.** Frame and personalise it honestly; do not claim clinical superiority. _Medium-high confidence on the framework's provenance and rationale; low confidence in any "clinically proven" outcome claim._
- **CosIng's exact bulk-download mechanics may have changed** with the Commission's relaunch/migration; the ~15,000 INCI figure and "no legal value" disclaimer are reliable, but verify the export route and consider whether a mirror is needed at build time. _Medium confidence._
- **Open Beauty Facts coverage is uneven and volunteer-driven,** so scan-match rates will vary by market; the curation + OCR + manual + contribute-back fallbacks are essential, not optional. _High confidence on the constraint; medium on match rates._
- **PAO is EU/UK law with no US cosmetic equivalent;** US shelves will frequently lack authoritative PAO. The category-default + "unknown" approach is required. _High confidence._
- **The cosmetic-vs-drug claims boundary is real and FDA/FTC-enforced;** in-app copy is a claims surface. The constraints in §9 should be reviewed by regulatory counsel, especially for the safety class. _High confidence on the principle; legal review recommended for wording._
- **Competitive landscape moves fast** — SkinSort, Cosmily, and HadaBuddy already ship conflict checks in 2026, and new entrants will appear; the moat is the integration + grading + trust + data lock-in, and that positioning must be revisited periodically. _Medium confidence._
- **Market-size figures are vendor-sourced and definition-dependent** (skincare-app vs beauty-tech vs skincare-products); treat the specific numbers as directional. The Yuka financials (its own accounts) are the most reliable proof point. _Medium confidence on market sizing; high on the Yuka reference._
- **`auth` role coverage for anonymous catalog reads** (does product intake during the pre-account anon session correctly read the catalog under `TO authenticated`?) should be verified against Supabase's `is_anonymous` role behaviour at build time (docs/01 §1). _Medium confidence._
