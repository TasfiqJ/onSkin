# Document 2: The Ingredient Intelligence Layer — Build Spec

_Ingredient & product catalog · the conflict / synergy engine · evidence grading · the skin-cycling scheduler · PAO & expiry intelligence · and the Shelf, conflict-banner, conflict-detail and PM auto-resolution surfaces._

> This is build-order document **#2** of the 15 named in docs/00 (§"Build order", item 2: _"Ingredient/product DB pipeline + conflict engine"_). docs/00 calls this layer **"the moat and the longest pole."** It sits underneath the Shelf (spec p11–12), the conflict-detail screen (spec p13), the PM "conflict auto-resolved" banner (spec p9), the routine builder (doc #3), and the paywall's top two value props ("Routine intelligence — order, timing, skin cycling" and "Ingredient conflict checks, with evidence grades", spec p7). It extends the schema in docs/01 §3; it does not redefine those tables.

> **Current publication boundary (2026-07-26):** those historical paywall
> propositions are not production-authorized copy while the clinical corpus has
> zero admitted rules. The runtime offer must describe only currently available
> non-claim shelf/routine capabilities and state that health-related guidance is
> under independent review. Evidence-graded conflict, timing, safety, or
> professional-review marketing may return only after the exact corpus, copy,
> build, and professional-review gates pass.

---

## TL;DR

- **The moat is not "conflict detection." Conflict detection is already table stakes** — SkinSort's Routine Creator, Cosmily, and HadaBuddy all ship cross-product ingredient-conflict checks in 2026. What none of them combine, and what this layer is, is: a **barcode-scanned personal shelf + skin-profile personalization + _evidence-graded, resolution-first_ (never binary-warning) conflict handling + automatic folding of conflicts into a daily skin-cycling habit loop + PAO/expiry intelligence + a privacy-first posture** — wrapped in calm, non-alarmist, cosmetic-claim-safe copy. The defensibility is **data quality + the evidence-grading discipline + the depth of integration + compounding personal-data lock-in**, not the mere existence of a checker.

- **Build a curated rules engine, not ML — exactly as docs/00 §3 concluded.**
  Keep the corpus intentionally bounded. There is no target count and no
  presumed ~40-row authority: missing coverage stays explicitly unsupported
  until an exact rule has sources, scope, severity, mechanism, calm resolution,
  citations, hashes, and independent review. ML is the wrong tool: the outputs
  must be explainable to a user and auditable to a lawyer, and a hallucinated
  interaction is a direct liability.

- **The evidence is proposition-specific and often disease-oriented
  (in-vitro/mechanistic), not patient-oriented.** Under SORT, many candidate
  skincare interactions land at grade C, but that does not make "contested" a
  universal baseline. A retinoid/acid efficacy-cancellation claim can be
  unsupported while additive irritation remains plausible; pregnancy guidance
  can be precautionary; and copper-peptide claims can remain held for
  insufficient evidence. Every label must name the exact proposition it grades.

- **Three candidate source components, each with provenance and review obligations.** Ingredients may be transformed from an exact-hash-bound offline **EU CosIng** artifact, but the Commission describes CosIng as informative and not legal approval. Product candidates may be transformed from an exact-hash-bound offline **Open Beauty Facts** artifact while keeping that ODbL component separable; OBF images are excluded. OnSkin performs no request-time OBF lookup and no automatic contribution-back. Counsel must classify the exact database combination and approve attribution, share-alike, offer-of-data, and territorial duties before promotion. Then **hand-curate the top ~2,000 products** for guaranteed quality. Do **not** scrape INCIDecoder / SkinSort / Skincarisma — no approved source route (docs/00 §3).

- **Skin cycling is a dermatologist-originated _framework_, not an RCT-proven protocol.** The classic four-night cycle (Exfoliate → Retinoid → Recover → Recover, then repeat) was coined by **Dr. Whitney Bowe** and went viral on TikTok; its rationale is mechanistic (staggering irritating actives to protect the barrier) and expert-endorsed, with "gentle" (more recovery nights) and "advanced" (fewer) variants that map directly onto OnSkin's per-user personalization. Frame it honestly, personalize it by the user's sensitivity axis, and let the conflict engine _resolve into_ the cycle (the spec's PM screen shows exactly this).

- **Freshness data is jurisdiction- and product-specific, so provenance is mandatory.** EU Regulation (EC) No 1223/2009 Article 19(1)(c) requires either a minimum-durability date or, where the minimum durability exceeds 30 months and durability after opening is relevant, a PAO indication using the symbol in Annex VII point 2. Ordinary U.S. cosmetics generally have no FDA expiration-date requirement. The FDA says sunscreen without a printed expiration date should be considered expired three years after purchase, but OnSkin neither captures nor verifies purchase date and therefore cannot perform that calculation. Canadian sunscreens can be non-prescription drugs or natural health products, with the applicable label regime depending on classification. The Shelf therefore records exact evidence and may remain unknown; it never invents a date merely from market or product type.

- **Liability is two-sided and must be engineered against from line one.** _False reassurance_ (telling someone a combination is fine when it harms them) and _false alarm_ (scaring someone off a safe, beneficial combination) are both failures. Both are mitigated by the same design: evidence grades, exact-rule applicability instead of generic concentration/sensitivity defaults, a separate **safety** rule class, a clear **not-medical-advice** disclaimer, two independent exact-hash approvals (board-certified dermatologist plus qualified cosmetic chemist/pharmacist), separate regulatory-counsel claims/jurisdiction clearance, and versioned, auditable rules. Under the FD&C Act and FTC rules, **in-app copy is a "claim" surface** — the language must stay cosmetic ("reduces the appearance of," "may minimise irritation") and never drift into drug claims ("treats acne," "stimulates collagen").

- **Seven-figure verdict: yes — this is the willingness-to-pay and retention engine, not plumbing.** It powers the paywall's headline value props, it is the reason a user's data compounds (your shelf, your conflicts, your cycle, your photos = switching cost), and the category has a direct proof point in **Yuka** (per its own 2024 accounts: $7.3M revenue, 98.1% from subscriptions, ~15-person team, zero marketing — docs/01 §9). The risk to the thesis is **not** demand; it is **getting the science wrong**, which is precisely why the rest of this document is mostly about evidence discipline.

---

## Key Findings

1. **Conflict _detection_ is no longer a differentiator; evidence-graded, resolution-first _treatment_ is.** The 2026 competitive set is crowded at the "scan and warn" layer: Yuka (barcode → a single 0–100 hazard score; 65M+ downloads, but per-product, no routine, no resolution); EWG Skin Deep (a 1–10 hazard rating across ~75,000 ingredients, with the well-documented flaw that it ignores concentration and formulation, so a well-formulated retinol can score "high hazard" purely because the molecule does); INCIDecoder (the deepest ingredient encyclopaedia, research-linked, but web-first, thin mobile, no barcode, no skin profile, no routine-building — and no public API); SkinSort (skin-type-aware match scores plus a Routine Creator that sequences and cross-checks compatibility — the closest competitor to this layer); Cosmily (compatibility + community); and HadaBuddy (scan your shelf → an AI-built routine from your products, with conflict detection). The clear conclusion: OnSkin **cannot** win by adding a conflict checker. It wins by turning an admitted interaction into the exact reviewed evidence, resolution, placement, and user controls for that rule. Alternate-night timing is a design example only, not a generic product promise.

2. **The evidence base is often disease-oriented — grade the exact
   proposition, not the ingredient pair.** Stability assays and mechanistic
   evidence do not automatically establish patient outcomes. The app must
   distinguish efficacy cancellation, irritation, stability, safety, and
   formulation-specific exceptions, and must use authoritative or primary
   sources instead of commercial explainers as review authority.

3. **The three tentpole pairs sit at three different evidence tiers — and that is the whole point of grading.**
   - **Benzoyl peroxide × retinoid is molecule- and formulation-specific.**
     Martin 1998 tested light-exposed tretinoin 0.025% gel with benzoyl peroxide
     10% lotion and separately found adapalene stable in the tested conditions.
     PMID 20967192 applies only to its optimized aqueous tretinoin 0.05% gel.
     EPIDUO and TWYNEO support only their exact finished formulations. No
     generic retinol, "encapsulated," or modern-delivery-system exemption exists.
   - **Retinoid × AHA/BHA contains different propositions.** Efficacy
     cancellation and additive irritation require separate evidence labels and
     rules. Alternate use or lower frequency is a conservative tolerance option
     only when an exact approved rule supports it.
   - **Niacinamide × vitamin C permits only a narrow myth correction.** The
     historical study used nicotinamide and ascorbic acid under laboratory
     conditions that do not establish a routine-use incompatibility. The
     candidate conclusion is "no evidence requires routine separation," subject
     to derivative, pH, vehicle, packaging, and finished formulation—not generic
     safety, compatibility, or synergy.

4. **A curated rules engine is the correct architecture, decisively
   (re-affirming docs/00 §3).** Each admitted pair needs exact applicability,
   presentation copy, a human-readable mechanism, structured source IDs, and a
   defensible grade bound to the approved corpus hash. Corpus size is an output
   of evidence and review, never a launch quota. ML offers nothing here except
   opacity and hallucination risk.

5. **Data sourcing requires exact-artifact review; it is not solved by source availability alone.** The [Commission's CosIng page](https://single-market-economy.ec.europa.eu/sectors/cosmetics/cosmetic-ingredient-database_en) makes clear that the database is informative and does not replace the applicable regulation, annexes, or product safety assessment. Only an approved offline CosIng artifact bound to its exact SHA-256 may be transformed. OBF is considered only as a separable offline source component. Its [license guide](https://openfoodfacts.github.io/openfoodfacts-server/api/tutorials/license-be-on-the-legal-side/) distinguishes database, contents, and image rights, and [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/) can trigger different duties depending on the resulting work/database. Images, request-time API access, and external contribution are excluded. Counsel must record the derivative-versus-collective classification and the exact attribution/share-alike/offer-of-data posture before production promotion. _Confidence: high on the cited source statements; legal classification remains pending counsel._

6. **Freshness evidence is incomplete by design, and jurisdiction does not justify a fabricated fallback.** [EU Regulation (EC) No 1223/2009](https://eur-lex.europa.eu/eli/reg/2009/1223/oj), Article 19(1)(c), requires a minimum-durability date for relevant products and, where minimum durability exceeds 30 months, a PAO indication unless durability after opening is not relevant; the open-jar symbol is Annex VII point 2, while Annex VII point 3 is the minimum-durability symbol. The [FDA says ordinary cosmetics have no U.S. shelf-life or expiration-date labeling requirement](https://www.fda.gov/cosmetics/cosmetics-labeling/shelf-life-and-expiration-dating-cosmetics). U.S. sunscreens are OTC drugs; the [FDA says a sunscreen without a printed expiration date should be considered expired three years after purchase](https://www.fda.gov/drugs/understanding-over-counter-medicines/sunscreen-how-help-protect-your-skin-sun). OnSkin does not capture or verify purchase date, so it cannot derive that date and must remain unknown absent exact package evidence. [Health Canada classifies sunscreens as non-prescription drugs or natural health products based on their active ingredients](https://www.canada.ca/en/health-canada/services/sun-safety/sunscreens.html); drug and NHP label duties apply by classification, while [general cosmetic labeling requirements](https://www.canada.ca/en/health-canada/services/consumer-product-safety/cosmetics/labelling.html) do not create a universal cosmetic expiry/PAO field. Preserve the actual source or remain unknown.

7. **Skin cycling is a framework to be personalised, not a protocol to be asserted.** Dr. Whitney Bowe's classic four-night cycle is mechanistically sensible and widely endorsed, and it explicitly supports modification by skin type/concern ("gentle" = more recovery nights for sensitive skin like the spec's "Maya"; "advanced" = fewer). It has not, as a _cycle_, been validated in controlled trials; the honest claim is "a dermatologist-developed framework for staggering actives to protect the barrier," not "clinically proven to outperform." Personalise the cadence from `skin_profiles`, and let the conflict engine drive placement.

8. **The liability is two-sided and symmetrical.** _False reassurance_ and
   _false alarm_ are equally damaging. The mitigations are shared: evidence
   grades; molecule/formulation/exposure-aware applicability; distinct
   reproductive contexts; calm clinician referral for admitted safety rules; a
   prominent not-medical-advice disclaimer; two independent exact-hash
   professional approvals; separate regulatory-counsel claims/jurisdiction
   clearance; and a user feedback path.

9. **Barcode → product is the "magic moment" input, but coverage is the constraint.** A scan that resolves against OnSkin's reviewed catalog, parses its INCI list, and slots it onto the shelf with exact catalog provenance is the activation hook for this layer (and the spec's "Scan a barcode" CTA). Freshness may still be unknown. Because coverage is uneven, the flow must always offer **search and manual entry** fallbacks plus **OCR of the printed ingredient list** as a second-line capture. Unknown products stay user-local and may create an owner-scoped OnSkin missing-product/correction report; nothing is published to OBF.

10. **Cosmetic-claim discipline is a content-engineering requirement, not a legal footnote.** Under the FD&C Act §201(g)/(i), _intended use_ — and therefore whether something is a regulated drug claim — is judged by **claims**, including those "on the Internet, or in other promotional materials" (FDA). The FTC separately polices advertising. The intelligence layer generates a great deal of user-facing copy (resolutions, banners, reassurance). All of it must stay in cosmetic territory and avoid disease/structure-function verbs.

---

## Details

### 1. What this layer is — and is not (scope & philosophy)

The ingredient intelligence layer is the **cross-cutting "brain"** that several user-facing features read from. It is not itself a screen. Concretely, it provides:

- a **catalog** of ingredients and products transformed from separately reviewed, hash-bound offline source components plus hand-curated data, with parsed INCI lists and concentration bands where known;
- a **conflict / synergy engine** that, given a user's shelf and routines, returns graded interactions with mechanisms, evidence grades, and resolutions;
- a **skin-cycling scheduler** that lays actives across nights and into which conflicts are resolved;
- **PAO / expiry intelligence** for the shelf;
- the **copy and grading system** that makes all of the above calm, honest, and claim-safe.

It reads from: `user_products` (the shelf, docs/01 §3), `routines` + `routine_steps` (incl. `cycling_night`, docs/01 §3), and `skin_profiles` (the sensitivity axis, the typed reproductive context `pregnant | breastfeeding | none | unknown | prefer_not_to_say`, and goals — health-inference data gated behind the health-data consent, docs/01 §4). It writes the catalog and rule tables (service-role) and a per-user `routine_conflicts` cache (owner-only).

**Design philosophy (committed):**

- **Resolution-first, never binary.** The default unit of output is the exact admitted rule's approved resolution, with the warning subordinate to the fix. Timing or override actions render only when those exact action bytes are part of the admitted cosmetic rule. Safety-class exclusions stay firm and clinician-deferred.
- **Evidence-graded and honest.** Every rule shows its grade. We say "contested" when it is contested and "myth" when it is refuted. This is the explicit anti-pattern to hazard-score apps (EWG) and to checkers that only ever warn.
- **Exposure- and context-aware.** Molecule, concentration, amount, surface
  area, frequency, duration, pH, vehicle, occlusion, damaged skin,
  leave-on/rinse-off use, and finished formulation may matter. Modulation is
  pair-specific and professionally approved; there is no generic resistant-skin
  downgrade. The exact admitted rule defines any sensitivity or unknown branch;
  otherwise the outcome is `unsupported_unreviewed`.
- **Calm, not gamified; private by default.** Per the spec cover's design decisions: "Streaks and cycling are calm, not gamified," and "Privacy copy is treated as brand voice." The shelf and conflict surfaces inherit this.

### 2. Data architecture & sourcing pipeline

A three-stage pipeline: **seed → curate → serve.**

**2.1 Ingredients ← EU CosIng.** Seed the ingredient dictionary from CosIng: INCI name (the canonical key, mandated on EU labels by Reg. 1223/2009 Art. 19), CAS and EC numbers, declared functions, and Annex II–VI status (prohibited / restricted / colourant / preservative / UV filter) with conditions and SCCS-opinion links. ~15,000 INCI inventory entries; the regulated subset is ~2,000–2,400. Carry CosIng's _"informative purpose and no legal value"_ disclaimer in internal provenance notes. **Action / confidence flag:** the Commission relaunched CosIng and the bulk-download path has been inconsistent; **verify the current export route at build time** and record the source + import date in a provenance table (mirrors exist but prefer the official source).

**2.2 Products ← reviewed Open Beauty Facts offline component.** A separately acquired candidate export/snapshot may be transformed only when a detached approval manifest binds its source URL, snapshot date, exact SHA-256, projected fields, attribution surface, database-component separation, and named reviewers. The import tool never fetches a source. The [current Product Opener API documentation](https://openfoodfacts.github.io/openfoodfacts-server/api/) identifies v3 as current and v2 as deprecated; OnSkin calls neither at runtime, so a user's barcode/search is never disclosed to OBF. Candidate fields are barcode, product name, brand, raw INCI text, and categories; images are excluded because the [source license guide](https://openfoodfacts.github.io/openfoodfacts-server/api/tutorials/license-be-on-the-legal-side/) distinguishes image rights and warns of additional packaging rights. There is no automatic or manual-in-app contribution to OBF. Attribution, share-alike, offer-of-data, and derivative-versus-collective classification remain counsel decisions, not assumptions encoded by the product spec. Coverage is volunteer-driven and must be treated as incomplete — hence stage 3.

**2.3 Hand-curation (the quality floor).** Manually curate the **top ~2,000 products** — best-sellers across Sephora/Ulta/derm-favourites and the products our quiz cohort actually owns — to guarantee correct INCI parsing, brand normalisation, **concentration bands** for the actives that matter (e.g., "Retinol 0.3%", "Glycolic 7%" — exactly the precision the spec's product cards show), and exact label/catalog PAO provenance where verified. Curated/editorial rows remain independently provenance-tagged rather than being silently merged into the OBF component; reviewed precedence determines the user-visible record.

**2.4 INCI parsing & ingredient normalisation.** Ingredient strings from an approved OBF-derived offline artifact can be messy (OCR artefacts, translations, "/"-separated INCI, parenthetical common names). The pipeline:

- tokenises the list, maps each token to a canonical `ingredient` via an INCI-name match plus a **synonym table** (e.g., "Vitamin C", "L-Ascorbic Acid", "Ascorbic Acid", "3-O-Ethyl Ascorbic Acid" → distinct canonical ingredients with a shared **functional family** "vitamin-C / ascorbates"; "Retinol", "Retinyl Palmitate", "Retinaldehyde/Retinal", "Adapalene", "Tretinoin" → family "retinoids", with adapalene/tretinoin sub-flags);
- assigns each ingredient one or more **functional tags** ("AHA", "BHA", "PHA", "retinoid", "vitamin-C", "niacinamide", "benzoyl-peroxide", "copper-peptide", "hydroquinone", "physical-SPF", "chemical-SPF", "humectant", "ceramide", "barrier-repair"). Tags are candidate-discovery indexes only: every candidate is then filtered by exact molecule, finished formulation/product, exposure, reproductive context, approved conditions, and corpus hashes before it can produce an outcome;
- records ingredient **position** in the list and a **concentration band** when derivable (label %, "≤1%" line break in EU lists, or curated value).

**2.5 What NOT to build on.** Do not scrape INCIDecoder, SkinSort, Skincarisma, CosDNA, or Cosmily: no public APIs, and their content/compilations carry ToS and database-right/legal risk (docs/00 §3). Their _existence_ is competitive intelligence, not a data source.

**2.6 Refresh, provenance, versioning.** Refresh is an operator-controlled artifact release, not a runtime or scheduled provider fetch. Each candidate OBF/CosIng artifact is acquired separately, hash-bound, reviewed, transformed offline, QA-gated, and promoted or rolled back as a versioned batch. Every catalog row stores its source component, source reference, snapshot date, artifact hash, import batch, and import time. The legacy `user_contributed` source label means user-entered/local catalog provenance only; it does not authorize external publication. The **rule set is independently versioned** (see §4) so a derm-reviewed change is a traceable event, not a silent edit.

### 3. Data model (the schema) — extends docs/01 §3

All tables in `public`. **D-016's former broad-read model is superseded by the CAT-03 serving contract.** Only the bounded, product-scoped relations needed by the app are directly readable by the `authenticated` role, and every row must satisfy a positive active-campaign, reviewed-lineage, current-mutation-root serving predicate. A signed-anonymous Supabase user carries the `authenticated` role; a publishable-key client with no session has no catalog read lane. The `service_role` has no direct catalog-table read and may use only the bounded lookup/search RPCs. `conflict_rules`, `sequencing_rules`, `creator_stacks`, `creator_stack_items`, `ingredient_tags`, `product_categories`, and `ingredient_tag_definitions` are direct-read sealed until their applicable evidence-bound publication authority exists. `ingredient_pao_defaults` is different: migration `0060` purges every row, drops its legacy read policy, force-RLS seals it, revokes every API-role privilege, and installs a validated always-false check so it cannot be repopulated. It is a historical compatibility relation, never freshness authority. Current `product_categories` values remain bounded editorial metadata/future candidates; they do not authorize Shelf category estimates until an exact retained server marker, named reviewer/source evidence, and a versioned admission path exist. Per-user tables are owner-only RLS exactly as docs/01 §3 prescribes (wrap `auth.uid()` in a subselect, `TO authenticated`, index policy columns, `WITH CHECK` on writes).

```sql
-- ============ CATALOG (operator writes; positive-RLS/RPC serving only) ============

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
  subflag       text,                            -- descriptive only; never a generic exemption authority
  primary key (ingredient_id, tag)
);

create table public.products (                   -- the catalog user_products.catalog_product_id -> here
  id            uuid primary key default gen_random_uuid(),
  barcode       text,                            -- join key to user_products.barcode / scans
  name          text not null,
  brand         text,
  category      text,                            -- 'cleanser','serum','moisturiser','spf','toner','exfoliant', ...
  default_pao_months int,                        -- legacy/display convenience; never direct Shelf authority (§6)
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
  applies_when    jsonb,                           -- typed exact molecule/formulation/exposure/reproductive context
  source_citation text not null,                   -- e.g. 'Martin et al., Br. J. Dermatol. 1998'
  rule_version    int  not null default 1,
  reviewed_by     text,                            -- display metadata only; never admission authority
  is_active       boolean not null default true,
  unique (tag_a, tag_b, interaction_type, rule_version)
);

create table public.ingredient_pao_defaults (     -- legacy compatibility relation; never authority (§6)
  category        text primary key,
  default_pao_months int not null,
  rationale       text
);

-- Migration 0060 deletes every row, removes the legacy read path, force-RLS
-- seals and revokes the table, and validates CHECK (false). Current
-- product_categories rows remain editorial/future metadata, not Shelf evidence.

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

**RLS sketch (positive serving authority, not role-wide publication):**

```sql
alter table public.products enable row level security;
create policy products_read_servable on public.products
  for select to authenticated
  using (private.catalog_product_is_servable(id));
-- Safe dependent relations use equally narrow product/dependency predicates.
-- Never substitute USING (true), is_active alone, or reviewed_by alone.
-- PUBLIC, anon, and service_role SELECT are revoked. service_role reads through
-- lookup_catalog_product_by_barcode/search_catalog_products only.
-- The eight global/dictionary authority tables named above have no API read lane.

alter table public.routine_conflicts enable row level security;
create policy rc_owner_sel on public.routine_conflicts
  for select to authenticated using ((select auth.uid()) = user_id);
create policy rc_owner_ins on public.routine_conflicts
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy rc_owner_upd on public.routine_conflicts
  for update to authenticated using ((select auth.uid()) = user_id)
                                with check ((select auth.uid()) = user_id);
```

> **Decision-log note (DECISIONS.md):** **D-016's world-readable catalog posture is superseded** by positive CAT-03 RLS, direct service-role denial, and bounded serving RPCs. **D-017** retains functional-tag conflict matching, while **D-018** retains `routine_conflicts` as a recomputed per-user cache. Global rule content must carry review metadata in bundled as well as database form and fail closed in production until its separate qualified-review gate passes. Anything touching consent/RLS/legal for the _personal_ layer (e.g., whether detected-conflict data counts as shared if exported) belongs in **BLOCKERS.md**, not here.

### 4. The conflict & synergy engine

#### 4.1 Interaction types (the five classes)

Every rule is one of:

1. **`irritation`** — an exact cumulative-irritation/barrier-compromise proposition. Dose, sensitivity, severity, and resolution affect the outcome only when that admitted rule defines the branch; otherwise it is `unsupported_unreviewed`. Alternate-night or lower-frequency timing is not a default.
2. **`stability`** — one exact ingredient/formulation may degrade another _in
   contact / in the same layer_. This class is formulation-specific. The
   benzoyl-peroxide/tretinoin result cannot be generalized across every
   retinoid, and free-copper chemistry does not by itself admit a copper-peptide
   skincare rule.
3. **`efficacy`** — a claimed reduction in how well one ingredient works. **Use sparingly and grade harshly** — most "efficacy-cancelling" claims are myths (see §4.4). Often collapses into `reassure`.
4. **`synergy`** — an exact beneficial proposition that may surface only when
   its specific formulation and outcome are independently supported and
   approved. It must never imply increased SPF, relaxed sunscreen reapplication,
   or generic irritation mitigation.
5. **`safety`** — medical-adjacent guidance, categorically separate and
   conservative (see §4.8). Applicability must distinguish pregnancy from
   breastfeeding and exact molecules/exposure contexts. Resolution may
   suppress and refer only when the exact reviewed rule authorizes it.

Plus the special label **`myth`** (`interaction_type` stored as `myth`): an exact,
widely feared proposition that the admitted evidence refutes. The engine may
surface only that rule's reviewed reassurance bytes. Niacinamide plus vitamin C
is a candidate design example, not an automatic reassurance from pair detection.

#### 4.2 Severity scale

`none | mild | moderate | high`. **Base severity** lives on the rule; **computed severity** is modulated at detection time:

- Modulation is defined per exact reviewed rule. There is no global `+1` for a
  concentration band or `-1` for "resistant" skin.
- Unknown molecule, formulation, or exposure follows the rule's approved
  cautious/unsupported branch; it never creates compatibility.
- A stability exemption names an exact evidence-bound finished formulation. A
  generic subflag such as `encapsulated` cannot suppress a rule, and a stability
  exemption cannot suppress a separate irritation rule.

Until the exact Maya products, proposition, thresholds, severity, and copy are
professionally approved, the fixture proves the candidate is hidden and the
coverage state is `unsupported_unreviewed`; it does not assert a medical
severity.

#### 4.3 Evidence grade (SORT-anchored)

Internal grade maps to **SORT** (Ebell et al., AFP 2004): **A** = consistent good-quality patient-oriented evidence; **B** = inconsistent/limited patient-oriented evidence; **C** = consensus, opinion, _disease-oriented_ evidence (in-vitro, mechanistic), case series. **Reality check: essentially all skincare-interaction claims are C**, because they rest on stability assays and pH chemistry rather than trials of outcomes that matter to a person. We therefore present a **consumer-facing label** mapped on top of the grade:

| Consumer label  | Internal                                                 | When to use                                                                 | Example                                                 |
| --------------- | -------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------- |
| **Established** | C (robust mechanism + repeated in-vitro/clinical signal) | strong, repeatable mechanism with supporting data                           | exact tested tretinoin/BP stability proposition         |
| **Plausible**   | C (mechanism, thin human data)                           | a real chemical/biological mechanism, little outcome data                   | additive irritation from separate potent leave-on acids |
| **Contested**   | C (conflicting expert opinion)                           | reputable sources actively disagree; the popular claim isn't well-supported | retinoid × AHA/BHA _efficacy_                           |
| **Refuted**     | — (evidence contradicts the exact claim)                 | evidence addresses the specifically worded proposition                      | only “must always separate niacinamide and vitamin C”   |

> **Honesty requirement:** because the candidate grades are mostly C, the
> in-app "Source" line and any evidence-detail view must render the exact
> admitted rule's proposition-specific limitations and label. The spec's
> **"Evidence: contested"** chip is a design-only placeholder, not a generalized
> label.

#### 4.4 The bounded draft matrix

Below is a draft research matrix, not a validated or launch-admitted corpus.
Each row may become one or more `conflict_rules` only after its exact scope,
copy, sources, severity, exceptions, and presentation bytes are approved by a
board-certified dermatologist and a cosmetic chemist or pharmacist. Regulatory
counsel must separately approve jurisdiction-specific drug/cosmetic handling
and claims. Citations are source candidates, not professional approval.

| #   | Family A × Family B                        | Draft disposition       | Required scope before review                                                                                                                                        | Resolution candidate                           | Primary basis                                                   |
| --- | ------------------------------------------ | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------- |
| 1   | retinoid × AHA                             | retain as irritation    | Exact molecules, separate versus finished product, concentration, pH, vehicle, leave-on/rinse-off, frequency, sensitivity, barrier condition                        | conservative alternate use or lower frequency  | FDA AHA guidance; exact retinoid labeling                       |
| 2   | retinoid × salicylic acid                  | retain as irritation    | No generic "resistant skin" bypass; exact product/formulation and exposure context required                                                                         | conservative alternate use                     | Current tretinoin labeling; FDA BHA guidance                    |
| 3   | benzoyl peroxide × retinoid                | split by formulation    | Separate simple tretinoin, adapalene, retinol/retinal/esters, and named validated finished formulations; a stability exemption does not erase irritation            | separate unless exact formulation is approved  | Martin et al. 1998; PMID 20967192; FDA EPIDUO and TWYNEO labels |
| 4   | niacinamide × vitamin C                    | neutral myth correction | Vitamin-C molecule/derivative, pH, vehicle, and finished formulation; do not repeat the false claim that the 1963 experiment used niacin or promise generic synergy | no required separation                         | Guttman & Brooke, PMID 14076500; formulation-specific evidence  |
| 5   | vitamin C × AHA                            | retain as irritation    | Dose/formulation sensitive; no categorical chemical incompatibility or mandatory AM/PM split                                                                        | buffer, lower frequency, or separate if needed | PMID 11207686; FDA AHA guidance; PMID 9723049                   |
| 6   | copper peptide × vitamin C                 | hold                    | Free-copper chemistry does not prove clinically meaningful GHK-Cu/product layering degradation                                                                      | none until exact evidence and review           | PMID 38081796; PMID 19071607; PMID 25384620                     |
| 7   | copper peptide × AHA/BHA                   | hold                    | No blanket cosmetic-layering rule is supported; AHA evidence must not be silently extended to BHA                                                                   | none until exact evidence and review           | PMID 25384620                                                   |
| 8   | separate leave-on AHA × BHA products       | retain as irritation    | Strength, pH, leave-on/rinse-off, frequency, sensitivity, barrier condition, and finished-formulation exemption                                                     | one potent acid per session if uncertainty     | FDA AHA and BHA guidance                                        |
| 9   | vitamin C × sunscreen                      | qualify as adjunctive   | Exact stable antioxidant formulation; never an SPF, replacement, or relaxed-reapplication claim                                                                     | no schedule change                             | PMID 18603326                                                   |
| 10  | niacinamide × retinoid                     | neutral compatibility   | Do not claim generic dryness mitigation or synergy without exact formulation evidence                                                                               | no schedule change                             | PMID 38628085; PMID 38299457                                    |
| 11  | topical retinoid × pregnancy               | retain as safety        | Split tazarotene from tretinoin/adapalene/cosmetic retinoids; calm precautionary avoidance and clinician referral                                                   | suppress and refer                             | ACOG; meta-analysis PMID 26215715; molecule labels              |
| 11b | topical retinoid × breastfeeding           | separate review lane    | Do not reuse pregnancy copy; molecule, area, infant-contact, and clinician context are required                                                                     | clinician-led, molecule-specific               | Current LactMed tretinoin/adapalene records                     |
| 12  | salicylic acid × pregnancy                 | retain as caution       | Exact salicylic acid, not generic BHA; concentration, amount, area, frequency, duration, occlusion, vehicle, and damaged skin; unknown stays cautious               | calm caution and clinician referral            | ACOG; AAD pregnancy skincare; MotherToBaby                      |
| 12b | salicylic acid × breastfeeding             | separate review lane    | Do not reuse pregnancy caution; avoid infant contact or ingestion and assess application area                                                                       | clinician-led, context-specific                | Current LactMed salicylic-acid record                           |
| 13  | hydroquinone × pregnancy                   | retain as safety        | Pregnancy precaution plus U.S. prescription/unapproved-OTC handling; do not present an illegal OTC purchase path                                                    | suppress and refer                             | PMID 9638901; FDA OTC hydroquinone notice                       |
| 13b | hydroquinone × breastfeeding               | separate review lane    | Unstudied and not formally contraindicated; long-term use and infant contact require separate clinician review                                                      | clinician-led, context-specific                | Current LactMed hydroquinone record                             |
| 14  | active × compromised self-reported barrier | future review candidate | Exact symptom/input boundary without diagnosis; product, dose, frequency, and recovery criteria                                                                     | pause or lower frequency                       | Must receive clinical and cosmetic-chemistry review             |

There is no presumed row 15-40. Missing coverage is
`unsupported_unreviewed`, never "compatible." The corpus ships only an exact,
whole-corpus approved release; every addition or copy/source/scope change
creates new hashes and invalidates earlier review receipts.
Two or more real products with missing/unparsed tags are also
`unsupported_unreviewed`; the engine reserves `not_applicable` for a state
with no product/context pair to assess and never turns missing parsing facts
into reassurance.

#### 4.5 Resolution strategies (the verbs)

- **`separate_am_pm`** — one ingredient AM, the other PM when the exact reviewed
  rule supports that resolution. Wires into the AM/PM routines (doc #3).
- **`alternate_nights`** — place the exact pair on different cycling nights only
  when the admitted rule approves that resolution. The spec's PM banner is a
  design-only placeholder; its timing and copy cannot render until bound to the
  exact admitted rule and computed schedule.
- **`buffer`** — available only when an exact product label or independently
  approved rule defines the step; there is no generic one-minute or
  moisturizer-between-actives instruction.
- **`lower_frequency`** — reduce one active to N×/week only when the exact
  admitted rule defines the product, exposure, sensitivity/unknown branch,
  cadence, and copy; it is never a generic default.
- **`no_change`** — no scheduling change is required for the exact approved
  proposition; this is not blanket compatibility or synergy.
- **`reassure`** — neutrally correct only the exact reviewed myth proposition.
- **`avoid_refer`** — `safety` only: suppress the recommendation and route to a clinician (§4.8).

#### 4.6 Detection algorithm

Runs (a) on the **shelf** (any two products the user owns) for the Shelf conflict banner, and (b) on each **routine** (products in the same AM/PM/cycling slot) for routine-level and PM auto-resolution. Pseudocode:

```
detect(user):
  products = user_products(user, status='active') joined to product_ingredients -> tags
  profile  = skin_profiles(user)   # sensitivity, reproductive_context, goals
  results  = []
  for (p_a, p_b) in unordered_pairs(products):     # shelf-level
      for tag_a in tags(p_a), tag_b in tags(p_b):
          candidates = active_rules(tag_a, tag_b)   # all candidates, both orders
          for rule in candidates:
              if not exact_applicability_matches(
                  rule,
                  molecules(p_a,p_b),
                  finished_formulations(p_a,p_b),
                  exposure(p_a,p_b),
                  profile.reproductive_context,
                  profile,
              ): continue
              if exact_finished_formulation_exempt(rule, p_a, p_b): continue
              # Preserve the admitted rule's exact severity and simultaneous
              # irritation/stability/safety outcomes; never overwrite it globally.
              results.append(Conflict(rule, p_a, p_b, rule.severity))
  # routine-level: only flag pairs that land in the SAME application moment
  # (same routine + same cycling_night, or both 'daily'); pairs already separated
  # by AM/PM or by alternate nights are RESOLVED, not flagged.
  rank(results, by=[type=='safety', severity, evidence_label])  # safety first, then severity
  upsert routine_conflicts(user, results)  # preserve prior user_choice/overrides
  return results
```

Key behaviours:

- **Tag-based, both-orders candidate discovery.** `(retinoid, aha)` and
  `(aha, retinoid)` discover the same candidate set. The engine evaluates every
  candidate and can preserve multiple simultaneous exact interaction
  propositions for one product pair.
- **Resolution-aware:** if two clashing actives are _already_ on different cycling nights or different AM/PM slots, the routine view shows them as **resolved/"paired"** (the spec's "paired" badge on the Glycolic 7% card, p12), not as an active warning.
- **Idempotent, canonical upsert** identifies a choice by `(user_id, corpus_sha256,
rule_sha256, unordered product pair)`, preserves the user's earlier
  `status`/`user_choice` only for those exact reviewed bytes, and records the
  corpus and rule versions. Reversed product order cannot create a second
  decision.
- **Choice contract:** the encrypted local record is the immediate authority and
  stores the exact product pair, choice, corpus hash, rule hash, and versions.
  Both `accept_suggested_timing` and `use_together` remove only that exact
  reviewed-hash row from repeated Shelf, Plan, Recommendations, and Ask prompts.
  Any copy, mechanism, citation, applicability, exception, replacement, or
  presentation change becomes unresolved even if an author forgot to increment
  a version. `use_together` records the user's preference but does not
  auto-co-locate potent actives. Safety, pregnancy, breastfeeding, cadence, and
  exposure gates are never bypassed. The owner-RLS `routine_conflicts` row is a
  best-effort mirror until `B-SUPABASE`/`B-ROUTINE-PERSIST` close.
- **Where it runs:** as a Postgres function (`detect_conflicts(uid)`, `SECURITY
DEFINER`, hardened with `REVOKE … FROM public, anon, authenticated` per
  DECISIONS.md D-013 pattern) for authoritative server computation, **and**
  mirrored as a pure client-side function over one exact admitted whole-corpus
  release so the shelf works offline (docs/01 §6: TanStack Query + persisted
  cache). Draft/demo rules are a visibly separate preview input and are never a
  production default.

#### 4.7 Personalization

- **Sensitivity** changes severity or resolution only when the exact admitted,
  pair-specific rule defines that branch. Otherwise the branch is
  `unsupported_unreviewed`; V1 never infers a generic increase or downgrade.
- **Goals** (`skin_profiles.goals`) may tune non-safety tone only after review;
  they do not authorize a medical severity or regimen.
- **Pregnancy and breastfeeding are distinct contexts.** Neither context may
  borrow the other's rule or copy; unknown and prefer-not-to-say remain
  conservative without asserting a health state.
- **Unknown exposure or sensitivity:** select a cautious branch only when the
  exact admitted rule defines one for that unknown state; otherwise return
  `unsupported_unreviewed`.

#### 4.8 Safety rules (the one place the app gets firm — and defers)

Genuine medical safety guidance is **not** cosmetic compatibility and is handled
in a separate, conservative path. During pregnancy, ACOG advises avoiding
topical retinoids even though absorption is low; a meta-analysis of inadvertent
exposure did not detect a major increase in measured adverse outcomes but was
not powered to justify use. Tazarotene must remain molecule-specific because its
labeling differs from other topical retinoids. ACOG lists topical salicylic acid
among OTC options during pregnancy, while AAD advises limiting and discussing
concentrations above 2%; percentage alone is not exposure, so area, amount,
frequency, duration, occlusion, vehicle, and damaged skin matter and unknown
stays cautious. Hydroquinone remains a pregnancy precaution and, in the United
States, OTC hydroquinone skin-lightening products are unapproved drugs rather
than an ordinary cosmetic purchase path.

Breastfeeding is a separate corpus lane. Current LactMed records do not support
copying blanket pregnancy avoidance into lactation: topical tretinoin and
adapalene are considered low risk with application-area and infant-contact
precautions; topical salicylic acid is compatible with contact precautions; and
hydroquinone is unstudied, not formally contraindicated, and requires distinct
long-term-use/contact judgment. Only an exact molecule/context rule approved by
both required professionals and separately cleared by regulatory counsel for
the exact claims and target jurisdiction may surface.

Engine behaviour for `safety` rules:

- **Detect early.** The authoritative profile exposes a typed pregnancy,
  breastfeeding, none, unknown, or prefer-not context. The moment an admitted
  rule's exact applicability meets a flagged state, raise it.
- **Calm, non-diagnostic, defer to a clinician.** Pregnancy and breastfeeding
  copy are independently reviewed and must not imply diagnosis, danger, or a
  universal contraindication.
- **Suppress and defer only when exact scope requires it.** Suppress the exact
  molecule/product only when that admitted reproductive-context rule requires
  suppression, then offer a clinician conversation or its reviewed alternative.
  A cosmetic timing choice cannot restore a safety-excluded product.
- **Disclaimer-linked.** Always paired with the global not-medical-advice line (§9).

### 5. The skin-cycling scheduler

**Source framework:** Dr. Whitney Bowe's classic four-night cycle — **Night 1 Exfoliate → Night 2 Retinoid → Night 3 Recover → Night 4 Recover**, then repeat — designed to stagger the most irritating actives to protect the moisture barrier. Bowe explicitly supports variants: **gentle** (more recovery nights, fewer push nights — for sensitive skin) and **advanced** (fewer recovery nights, stronger products). This maps onto `routine_steps.cycling_night` (docs/01 §3: 1=exfoliation, 2=retinoid, 3–4=recovery) with no schema change.

**Personalisation:**

- **Sensitive / "barrier repair" goal (Maya):** start gentle — e.g., a 5- or 6-night cycle with extra recovery nights, retinoid 2×/week (matches the spec's reveal advice: "a low-strength retinoid two nights a week, no daily acids, ceramides every day," p6). The spec's PM screen shows **"NIGHT 2 OF 4"** with Retinoid active — a faithful classic cycle for a user who tolerates it.
- **Resistant / oily:** the classic 4-night, or advanced.
- **No actives owned:** no cycling; a simple daily AM/PM.

**How conflicts fold in:** only an admitted `alternate_nights` resolution may
place exact products on different nights. The banner must describe a
conservative tolerance plan rather than categorical incompatibility—for
example, “Both products can cause dryness, burning, redness, or peeling; this
reviewed plan keeps them on different nights.” The scheduler may then compute a
truthful next reviewed placement from the cycle calendar.

**Calendar / "next acid night" computation:** given the cycle definition (ordered nights + start date/anchor) and today's date, project forward to the next night whose slot is `exfoliation`; render as a friendly weekday ("Saturday"). Recompute on edits and on date rollover (local-day aware — see the timezone tolerance in DECISIONS.md D-012).

**Calm, not gamified (per spec cover):** the night strip (Exfoliate · Retinoid · Recover · Recover) uses the clay accent for tonight only; no points, badges, or stre-streak pressure on the cycle itself. (Streaks live in the habit loop, doc #7, and are themselves "calm.")

### 6. PAO / expiry / shelf intelligence

**Regulatory basis (for data provenance, not a compliance conclusion):** Under [EU Regulation (EC) No 1223/2009](https://eur-lex.europa.eu/eli/reg/2009/1223/oj), Article 19(1)(c), a relevant product carries a minimum-durability date; if minimum durability exceeds 30 months, it instead carries a PAO indication unless durability after opening is not relevant. The open-jar symbol is Annex VII point 2. The [FDA does not require expiration dating for ordinary cosmetics](https://www.fda.gov/industry/fda-basics-industry/do-i-need-label-my-cosmetics-products-expiration-dates). Sunscreens require classification-specific handling: U.S. OTC-drug rules allow a stability-supported three-year omission, and Canadian products may be drugs or NHPs. Canadian drug labels include an expiration date under [Food and Drug Regulations C.01.004](https://laws-lois.justice.gc.ca/eng/regulations/C.R.C.%2C_c._870/section-C.01.004.html), while NHP labels follow [Health Canada's NHP labeling guidance](https://www.canada.ca/en/health-canada/services/drugs-health-products/natural-non-prescription/legislation-guidelines/guidance-documents/labelling.html). These sources do not support a universal printed-date assumption.

**Truth table (the only launch-eligible freshness waterfall):** `expiry_computed` may select the earlier of a printed date explicitly recorded or reconfirmed from this physical package and an opened-date-plus-PAO candidate, but the app must preserve which evidence created the winning candidate. A product catalog row is not bound to the user's lot, batch, or package, so its `expiry_date` remains catalog/correction evidence and never auto-populates Shelf `expiryDate`.

| Product state and evidence                                                                         | Stored/surfaced source                                       | User-visible truth                                                                                             | Countdown, expired, or replacement signal  |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | --------------------------------------- |
| Unopened with a printed package date                                                               | `expiry_source='printed'`                                    | Show the printed date and identify it as printed                                                               | Eligible near or past that date            |
| Unopened without a printed package date                                                            | `expiry_source='unknown'`                                    | Show unopened with no app-derived date                                                                         | Not eligible                               |
| Opened with a printed package date that wins                                                       | `expiry_source='printed'`                                    | Show the printed date and identify it as printed                                                               | Eligible near or past that date            |
| Opened with an explicit label PAO or reviewed catalog PAO that wins                                | `expiry_source='pao_computed'`; `pao_source='label'          | 'catalog'`                                                                                                     | Explain opened date plus label/catalog PAO | Eligible near or past the computed date |
| Future-gated: opened with an externally reviewed, server-attested catalog-linked category fallback | `expiry_source='estimated'`; `pao_source='category_default'` | Unavailable at launch; if later approved, show explicitly approximate and never as a package/manufacturer date | Not eligible                               |
| No trustworthy candidate                                                                           | `expiry_source='unknown'`                                    | Show no date or estimate                                                                                       | Not eligible                               |

If printed and PAO candidates both exist, the earlier actual candidate wins; an exact tie resolves to `printed`. Shelf `pao_source='label'` is reserved for direct product-label entry. Reviewed product-specific `label`, `brand_label`, or `catalog` evidence delivered through catalog intake persists to Shelf as `catalog`, while the catalog retains the finer origin; actor-neutral copy protects ambiguous historical v1 label rows. A category estimate is a separate future-gated state, not a synonym for unknown. Current `product_categories` rows lack a named reviewer/source snapshot and the served payload lacks an exact retained category-evidence marker, so neither those mutable fields nor `products.default_pao_months` authorize Shelf evidence. Mobile/v1 intake and migration `0060` fail every `category_default` claim closed to unknown. The purged, sealed `ingredient_pao_defaults` compatibility relation is never consulted. No sunscreen-specific numeric fallback is permitted.

Historical catalog-linked Shelf dates cannot prove whether the value came from
the physical unit or a product-level catalog import. V1/`0060` retains them
only in app `legacyUnverifiedExpiryDate` / database
`legacy_unverified_expiry_date` for possible user
reconfirmation; it neither promotes them to trusted `printed` nor silently
deletes the retained value. Replenishment and all time-pressure UI ignore that
quarantine.

PAO input is technically bounded to integer months `1..120` in new catalog,
database, and Shelf-v2 paths. The ceiling limits malformed data and date math;
it is not a legal threshold, a category default, or a product-lifetime claim.

Catalog intake also requires exactly one reviewed matching-source/region
product-specific `label`/`brand_label`/`catalog` row; matching duplicates fail
closed. Category-only payloads remain unknown because the current projection
cannot prove the reviewed `product_categories` authority. A category row is
ignored when one valid product-specific row wins. Activating `estimated` from
catalog intake requires an exact bounded server-attested category marker that
is retained locally, named cosmetic-chemistry review, and a versioned database
admission path replacing the current quarantine guard; mutable client fields are insufficient. Current
mobile intake and v1 upgrade therefore fail `category_default` closed to
`unknown`.

**Badge logic (the shelf, spec p12):**

- **Date badge** ("Sep 2026", "May 2027") — shown only for a trusted printed or label/catalog-PAO candidate that is comfortably ahead.
- **Countdown badge** ("3 wks left") — shown only for a trusted printed or label/catalog-PAO candidate within the configured threshold.
- **"Expiring" filter** — includes only trusted countdown or past-date states; reviewed category estimates and unknowns are excluded.
- **"paired" badge** — when a product's conflict is _already resolved_ by the scheduler (the spec's Glycolic 7% card), signalling "handled," not "problem."
- **Expired** — a gentle, non-alarmist "time to replace" state only when trusted printed or label/catalog PAO evidence is past.

**Barcode scan → shelf (the activation flow):** the spec's "Scan a barcode" CTA opens the app's `expo-camera` barcode surface (docs/00 §4); on a successful barcode read, query OnSkin's reviewed catalog → match `products.barcode` → show name/brand/parsed actives → prompt **"When did you open it?"** and preserve only freshness evidence valid for this unit: a physical-package date explicitly entered/reconfirmed by the user, explicit open-jar PAO, reviewed catalog PAO, or unknown. A product-level catalog expiry date is never imported into Shelf. A reviewed category estimate may appear only after its exact-marker and named-review gates. Fallbacks in order: **search** the same catalog, **OCR** the printed INCI list, **manual entry**. New/unknown products remain user-local and may be reported to OnSkin's owner-scoped correction queue. There is no request-time OBF recipient or external contribution path.

### 7. UI / UX specification (every surface — look, feel, and behaviour)

**Design tokens (from the spec cover, committed):** display = **Instrument Serif** (editorial moments — screen titles like "Shelf," "Your plan is ready," profile headlines); UI = **Hanken Grotesk** (everything functional); a **monospaced** face for captions/labels/metadata ("14 products," "opened Mar · 6 mo PAO," "NEXT", the "01 · Welcome" annotations — see DECISIONS.md D-005). Palette: **paper · greige · clay · ink · night** — warm clinical neutrals with one restrained **clay** accent. **Light mode** for shelf/AM; **dark ("night")** for the PM routine and capture screens (spec: shown dark "since that's when they're used"). 8pt grid; Reanimated 3 motion; restrained haptics; WCAG 2.2 AA; Dynamic Type; full dark mode; RTL-ready (docs/00 §8, docs/01 §8).

#### 7.1 Shelf screen (spec p11–12)

Anatomy, top to bottom:

- **Status bar** (9:41, signal/wifi/battery) — standard.
- **Title block:** "**Shelf**" in Instrument Serif (large), with the product count "**14 products**" right-aligned in mono. Generous top padding on paper.
- **Filter chips:** pill segments **All / Actives / Expiring** — "All" selected (ink fill, paper text); others outlined. `Actives` filters to products bearing an active tag (retinoid/AHA/BHA/vitamin-C/BP); `Expiring` filters via the badge logic in §6. Single-select; haptic tick on change.
- **Conflict banner (calm):** a **clay-tinted, low-contrast** card with a small clay dot, title, subhead, and quiet **"Review →"** affordance opening the conflict detail. The title and resolution are rendered verbatim from an admitted rule; a design-only placeholder such as "Retinol + glycolic acid share your PM routine" / "Use them on alternate nights" must never appear in production without that exact approval. **Never red, never an alert icon.** Shelf-only detection must not claim placement; placement-confirmed copy is reserved for scheduler-backed routine contexts with real cycle output. The banner appears only when there's an admitted unresolved or noteworthy interaction; unsupported coverage renders no reassurance.
- **Product cards:** each a paper card with a rounded thumbnail (placeholder hatch until imagery), product name (Hanken, semibold), a mono metadata line ("Verra Skin · opened Mar · 6 mo PAO"), and a **right-aligned badge** (date / countdown / "paired"). Tappable → product detail (opened date, PAO, the actives it contributes, any conflicts it's part of, finish/discard actions).
- **Scan FAB:** a dark **"Scan a barcode"** pill, centred low, clearly primary.
- **Tab bar:** Today · Progress · Shelf · You (Shelf active, clay dot indicator).

States: **empty shelf** → a warm prompt to scan/add the first product (ties to onboarding's "current products intake," docs/01 §2 step 6); **loading** → skeleton cards (no spinners, docs/01 §8); **all-resolved** → no banner, calm.

#### 7.2 Conflict banner (calm, reusable)

Used on Shelf and (variant) in the PM routine. Rules: clay tint not red;
verbatim admitted title, resolution, evidence label, and action bytes; one quiet
review affordance. A routine context may add computed placement only when it
actually placed the products. Design examples such as alternate-night timing or
"contested" evidence remain placeholders until an exact admitted rule supplies
them.

#### 7.3 Conflict detail screen (spec p13 — the trust set-piece)

The most important screen for credibility. Anatomy:

- **Severity + evidence chips, side by side:** render only the exact
  professionally approved severity and proposition-specific evidence label.
- **Title:** "**Retinol × glycolic acid**" — Instrument Serif, the "×" rendered as a true multiplication sign (the pairing, stated plainly).
- **Mechanism copy:** draw the exact approved bytes from the corpus. A candidate
  irritation statement may say both products can independently cause dryness,
  burning, redness, or peeling and concurrent use may increase irritation; it
  must not transfer an efficacy debate into an irritation claim.
- **"OUR SUGGESTION":** render the exact approved conservative option. If a
  cycle exists, the routine view may add exact nights and confirm the plan
  reflects them; shelf-only conflict detail must not assert placement.
- **Affected products:** "Retinol 0.3% · Glycolic 7%" (the user's actual shelf items, with concentrations).
- **Source:** render structured, versioned identifiers and links from the
  admitted source registry together with the rule/corpus hash. Never display a
  fabricated generic “literature review” label.
- **Actions, user in control:** render only the action labels and choices approved
  in the exact admitted rule. Design-only examples such as "Keep alternate
  nights" or "Use together anyway" are not production copy. A choice is saved
  only after the encrypted write succeeds and stops repeat advisory prompts for
  that exact pair/rule version. Guided check-offs remain on the reviewed
  one-potent-active schedule until named co-use review; safety rows never render
  override actions.

Accessibility: severity/evidence chips have text labels (not colour-only); VoiceOver focus lands on the title on entry; the two actions are ≥44pt.

#### 7.4 PM Today auto-resolution (spec p9 — the highest-value moment, dark mode)

- **Header:** "THURSDAY · 9:41 PM" (mono), "**Good evening.**" (serif) — on the night palette.
- **Skin-cycling night strip:** "SKIN CYCLING · NIGHT 2 OF 4" with four segments **Exfoliate · Retinoid · Recover · Recover**; tonight (Retinoid) highlighted in clay; the rest muted. Calm, no gamification.
- **Evening routine checklist:** product-specific application instructions come
  only from the exact product label or a separately approved rule; a generic
  retinoid tag cannot supply dose, dry-skin, eye-area, or buffer instructions.
- **Conflict auto-resolution banner:** state the approved tolerance plan and the
  computed next placement without saying the products categorically “do not
  mix.”

#### 7.5 Barcode scan & add-to-shelf

Camera capture and OCR run on device. A decoded barcode or minimized search
query may be sent to OnSkin's first-party catalog service for resolution under
the applicable consent and policy; the app must not imply that the entire
lookup is on-device. Show the reviewed result and exact freshness source when
one exists. Unknown freshness stays unknown. Unknown products remain local
unless the user separately submits a minimized OnSkin missing-product report;
no external source publication occurs.

#### 7.6 Product card states & badge taxonomy

Badges (right-aligned, mono): **future date** (neutral) · **"N wks/days left"** (clay, within threshold) · **"paired"** (resolved-conflict, calm) · **"expired / replace"** (gentle). Card tap → detail. Long, multi-active products show up to ~2 active tags inline, rest under detail.

#### 7.7 Microcopy, motion, haptics, accessibility, localisation

- **Microcopy principles:** **claim-safe** (cosmetic verbs only — "reduce the appearance of," "may minimise irritation," "supports the barrier"; never "treats," "cures," "stimulates collagen," "heals"); **calm** (no exclamation, no "warning/danger/avoid" for cosmetic-compatibility rules); **evidence-honest** (say "contested"/"myth" when true); **resolution-first** (lead with the fix).
- **Motion:** subtle fades and the clay highlight; respect Reduce Motion. No bouncy/gamified celebration on conflicts.
- **Haptics:** selection tick on chip/checkbox; nothing alarming on a conflict.
- **Accessibility:** chips/badges carry text (never colour-only); 44pt targets; VoiceOver focus management on screen entry; Dynamic Type reflow (no fixed-height text containers); dark-mode variants for PM/capture.
- **Localisation:** externalise all rule copy (`resolution_copy`, `mechanism`, labels) for ~30% string-expansion and RTL (docs/01 §8). Rule copy is content, not code.

#### 7.8 Reassurance surfaces (the differentiator made visible)

When an admitted rule has enough exact evidence to correct a myth, surface
neutral reassurance in the same calm card style. For niacinamide plus vitamin
C, the current research packet supports only "no evidence requires routine
separation"; it does not authorize a generic synergy or "work well together"
claim across every derivative, pH, vehicle, or finished formulation.

### 8. Privacy & compliance (personal layer)

The **catalog and rules are non-personal**. The **personal layer**—the user's
shelf, detected interactions, reproductive context, and cycle—is
health-inference data covered by the applicable consent and policy controls. It
is owner-isolated and may be processed by disclosed first-party infrastructure
and contracted processors only for approved purposes. Counsel-approved
sale/share/processing language must describe the actual architecture; a blanket
“never shared” promise is not substituted for a processor inventory or data-flow
review. It is not used to train AI under the current source contract.

### 9. Legal / liability framing (the part the brief is most worried about)

**The cosmetic-vs-drug line (FD&C Act §201(g)/(i)).** A product (or, by extension, the claims around it) becomes a **drug** if it is intended to "diagnose, cure, mitigate, treat, or prevent disease" _or_ to "affect the structure or any function of the body." **Intended use is judged by claims — including claims on the Internet and in promotional materials (FDA).** OnSkin's in-app copy (resolutions, banners, value props) is a **claims surface**. The FTC separately polices advertising for truthfulness/substantiation. **Constraints:** keep all generated copy cosmetic ("reduce the appearance of fine lines," "may minimise irritation," "supports the look of an even tone"); never "treats acne," "cures rosacea," "stimulates collagen," "repairs DNA." Route anything disease-adjacent to "see a dermatologist."

**Not medical advice — a standing disclaimer.** A clear, persistent disclaimer
appears in onboarding, Settings, conflict detail, and safety screens. It is a
supporting disclosure; it does not replace substantiation, accurate scope,
professional approval, product labeling, privacy duties, or regulatory
clearance.

**The two-sided liability, addressed by design.**

- _False reassurance_ (saying a harmful combo is fine): mitigated by exact-rule
  applicability, `unsupported_unreviewed` coverage, the separate `safety` class,
  evidence grades that do not overstate, professional approvals, and counsel
  clearance.
- _False alarm_ (scaring a user away from an unsupportedly characterized pair):
  mitigated by exact-proposition reassurance and `unsupported_unreviewed`
  coverage. The engine never upgrades absence of a warning into “this is fine.”

**Expert sign-off and versioning (mandatory before launch).** The entire
`conflict_rules` corpus — types, severities, grades, mechanisms, presentation
copy, applicability, exceptions, resolutions, replacements, and source
registry — must receive two distinct exact-hash approvals: one from a
board-certified dermatologist and one from a qualified cosmetic chemist or
pharmacist. A free-text `reviewed_by` marker is not authority. Receipts bind the
corpus hash, every rule hash, source-registry hash, count, reviewer identity and
credential, jurisdiction, decision, scope, date, and re-review/expiry. Any byte
or scope change invalidates admission. The app stores the exact corpus/rule
hashes behind every surfaced choice. Ship with a user feedback path feeding
rule QA. Separate regulatory counsel must also clear the exact claims, actions,
source/licensing posture, and target jurisdictions. Log these independent
external gates as **BLOCKER B-DERM-REVIEW** and **BLOCKER B-REG-COUNSEL**.

**Other flags:** geofencing around healthcare facilities is banned under MHMDA — never location-target health content (docs/00 §7). Affiliate links (ShopMy, doc #10) layered on top of conflict resolutions must not create a conflict-of-interest appearance ("we flagged X so you'd buy Y") — keep recommendations evidence-led and disclosed.

### 10. Engineering / implementation notes

- **Where logic lives:** authoritative detection as a hardened
  `SECURITY DEFINER` Postgres function (`detect_conflicts(uid)`) with
  `REVOKE … FROM public, anon, authenticated` (DECISIONS.md D-013 pattern),
  invoked after shelf/routine mutations; a mirrored **pure client-side**
  detector over the exact admitted whole-corpus release for offline shelves
  (docs/01 §6). Scheduling/next-acid-night is computed client-side from the
  cycle definition and reconciled server-side.
- **Offline:** the rule set and the user's catalog slice are cached (TanStack Query persistence, docs/01 §6); detection and badges work offline; `routine_conflicts` writes queue and sync (idempotent upsert).
- **Performance:** tag-indexed rule lookups; pairwise detection over a shelf of ~10–30 products is trivial; precompute and cache `routine_conflicts`, recompute on change only.
- **Testing (non-negotiable for a liability surface):** every admitted rule has
  fixtures for exact applicability, exposure, exceptions, copy, hashes, and
  resolution. Draft Maya data must prove hidden/`unsupported_unreviewed`
  behavior until its exact severity and plan are professionally approved.
  Human-simulated E2E then covers admitted scan→shelf→detail→choice flows without
  substituting UI evidence for review.
- **Analytics:** no rule ID, ingredient/product name, severity, pregnancy or
  breastfeeding state, conflict text, shelf contents, or choice detail enters
  analytics. Any future measurement must use the closed allowlisted event
  registry, exact low-cardinality non-health buckets, explicit consent, and the
  receipt-bound publication gate; direct mobile vendor capture remains
  disabled.
- **Ships as build-order #2** (docs/00): after auth/data-model/RLS (#1), before the routine builder (#3) and smart-shelf surfacing (#4) consume it.

---

## Seven-Figure Validation (the moat & the money)

**Is this the feature that makes OnSkin "king of the category" and underwrites a 7-figure business? The honest answer: yes — but for the right reasons, and not the obvious one.**

**Market reality.** The skincare _app_ segment is estimated at **~$500M in 2025 growing ~15%/yr toward ~$1.8B by 2033** (DataInsights — directional, vendor-sourced), sitting inside a **~$122–178B skincare products market** (Fortune Business Insights; Precedence) and a fast-growing beauty-tech market (SkyQuest: ~$88B in 2025 → ~$354B by 2033 at ~19% CAGR — definitions vary, treat as directional). Demand for ingredient transparency is a named driver of app adoption. A **$1M ARR at $39.99/yr is roughly 25,000 paying subscribers** (gross, before the store cut) — a small slice of a market this size, and lower still with a Pro+ tier (docs/00 §5 floats Pro+ $79.99/yr).

**The direct proof point.** **Yuka** monetises a privacy-first, scan-based, subscription product to **$7.3M/year (98.1% from subscriptions), with ~15 staff, 80M+ users, zero brand revenue and zero marketing spend** (Yuka's own 2024 accounts, via docs/01 §9). It proves consumers will pay for trustworthy, independent ingredient intelligence. OnSkin's wedge over Yuka is precisely this layer's _depth_: Yuka gives one number per product; OnSkin gives a personalised, resolved, habit-integrated system.

**Why this layer specifically drives the money:**

1. **It is the paywall.** Two of the four paywall value props (spec p7) are this layer verbatim: "Routine intelligence — order, timing, skin cycling" and "Ingredient conflict checks, with evidence grades." This is what the user is asked to pay for at the Day-0 conversion moment where ~half of subscription conversions happen (RevenueCat SOSA, docs/01 §9).
2. **It is the retention/lock-in engine.** Every product scanned, every conflict resolved, every cycling night logged deepens a **personal data moat**: re-creating "my shelf + my conflicts + my cycle + my photos" elsewhere is the switching cost. docs/01 §9 ties exactly this data-accumulation to retention, and annual plans retain far better than monthly (RevenueCat SOSA ~44% one-year on annual vs ~17% monthly) — so the layer's compounding value is what makes the annual default stick.
3. **It is a potential trust/word-of-mouth flywheel.** Evidence-bound,
   non-alarmist, proposition-specific guidance can earn trust only when it is
   accurate and professionally reviewed. For niacinamide plus vitamin C, the
   present candidate says only that no evidence requires routine separation.

**The honest competitive read (where the moat is NOT).** Conflict _detection_
is not defensible by itself. Any defensibility must come from reviewed data
quality, proposition-specific evidence, exact scope, calm resolution,
integration, truthful freshness, and privacy. Reassurance and synergy are not
automatic differentiators; they are claim surfaces that require the same
substantiation as warnings.

**What would break the thesis:** (a) **getting the science wrong** — a false-reassurance harm or a viral "this app spreads myths" moment would destroy the trust the model depends on (hence §9's mandatory expert sign-off); (b) treating it as a feature to _advertise_ rather than an experience to _integrate_; (c) data-coverage so thin that scans frequently fail (mitigated by reviewed curation + OCR + manual entry + the correction queue). Mitigate those and this layer is the engine, not the plumbing.

**Verdict: the ingredient intelligence layer is the single most defensible, monetisable, and retention-driving component of OnSkin — conditional on evidence discipline and deep integration, exactly as docs/00 predicted when it called this "the moat and the longest pole."**

---

## Synthesis

**(a) What this layer is:** the cross-cutting brain — catalog + conflict/synergy engine + skin-cycling scheduler + PAO intelligence + grading/copy system — feeding the Shelf, the conflict surfaces, the PM auto-resolution, the routine builder, and the paywall.

**(b) Data:** separately reviewed, exact-hash-bound offline CosIng and OBF source components plus a hand-curated top ~2,000; tag-based normalisation; no source runtime recipient, OBF images, or external contribution; never scrape INCIDecoder/SkinSort/Skincarisma. CosIng claim authority and ODbL classification/obligations remain explicit review decisions.

**(c) Engine:** a bounded whole-corpus authority with explicit unsupported
coverage; typed molecule/formulation/exposure and pregnancy-versus-
breastfeeding applicability; exact presentation copy and structured sources;
two distinct professional exact-hash receipts plus separate regulatory-counsel
claims/jurisdiction clearance; deterministic, ambiguity-rejecting detection;
and resolution-first output that remains runnable offline only from the exact
admitted release.

**(d) Skin cycling:** Bowe's four-night framework, personalised by sensitivity, with conflicts _resolved into_ the cycle and rendered as the spec's calm PM banner + next-acid-night.

**(e) PAO:** preserve printed, explicit label PAO, reviewed catalog PAO, future-gated category estimate, and unknown as distinct states; only physical-package printed or label/catalog-PAO candidates can drive date/countdown/expired/replacement UI. Current category metadata is insufficient authority, so every `category_default` intake/upgrade fails closed until an exact retained server marker, versioned database admission path, and named chemistry review exist; the legacy `ingredient_pao_defaults` relation is purged, sealed, and unusable.

**(f) UI/feel:** Instrument Serif + Hanken Grotesk + mono labels; paper/greige/clay/ink/night; light for shelf/AM, dark for PM/capture; calm, non-alarmist, claim-safe, evidence-honest, resolution-first; user control, evidence labels, reassurance, and actions all come from exact admitted rule bytes.

**(g) Liability:** cosmetic-claim discipline (in-app copy is a claims surface); standing not-medical-advice disclaimer; exact-scope safety rules with clinician routing; **mandatory independent dermatologist + cosmetic-chemist/pharmacist exact-hash approvals and separate regulatory-counsel claims/jurisdiction clearance** (B-DERM-REVIEW and B-REG-COUNSEL gate launch); versioned, auditable rules; user feedback loop.

**(h) 7-figure verdict:** yes — it is the paywall, the retention/lock-in engine, and the trust flywheel; defensible on integration + grading + data + privacy + lock-in, **not** on conflict detection alone; the one existential risk is getting the science wrong, which §9 is built to prevent.

---

## Recommendations

1. **Build the curated rules engine, not ML, and ship only an exact
   independently approved subset.** There is no numeric launch target and no
   currently validated row.
2. **Make `B-DERM-REVIEW` a hard launch gate.** No rule ships without detached,
   exact-hash clinician and cosmetic-chemist/pharmacist approvals plus separate
   regulatory-counsel claims/jurisdiction clearance. `reviewed_by` is display
   metadata only.
3. **Stand up the three-component offline pipeline now (build-order #2).** Use only reviewed CosIng and OBF artifacts bound to their exact hashes, keep the OBF-derived component separable, and hand-curate the top ~2,000. Store source, snapshot, artifact hash, batch, field-level provenance, and review state on every row. Query only OnSkin's reviewed catalog at runtime; do not send scans or corrections to OBF.
4. **Use functional tags only for candidate discovery.** Admission and
   exemptions bind exact molecules, products/formulations, exposure context,
   evidence, and hashes; generic `encapsulated` is never an exemption.
5. **Treat exact-proposition reassurance as a liability surface.** It may say
   only what the admitted evidence and reviewers approved; absence of a warning
   is never generic compatibility or synergy.
6. **Implement the skin-cycling scheduler as the place conflicts get resolved,** and invest in the PM auto-resolution screen (§7.4) — it is the highest-value, most-demoable moment in the layer.
7. **Engineer the two-sided liability:** pair-specific exposure logic,
   pregnancy/breastfeeding separation, unsupported coverage, calm reviewed
   copy, detached exact-hash approvals, supporting disclaimers, and feedback.
8. **Handle freshness gaps honestly:** preserve the truth table's distinct sources, never collapse unknown into an estimate, and never assume a sunscreen has a printed date or a universal numeric PAO.
9. **Do not instrument conflict existence or resolution.** Future analytics are
   limited to consented, closed-registry, low-cardinality non-health events that
   cannot encode a rule, ingredient/product, severity, reproductive state,
   shelf, conflict existence, or choice.
10. **Position the moat correctly in all messaging:** "personalised, evidence-graded routine intelligence that resolves conflicts into your daily plan and stays honest about the science" — not "a conflict checker."

---

## Caveats (confidence flags)

- **Ingredient-interaction evidence is proposition-, molecule-, formulation-,
  exposure-, and context-specific and often disease-oriented.** Commercial
  explainers are not review authority. Every admitted rule needs structured
  primary/authoritative sources, exact-hash dual professional approval,
  separate counsel clearance, and calm scoped copy. _No current rule is
  approved._
- **Specific conflict-pair grades and any category freshness fallback require dermatologist/cosmetic-chemist review; none is a settled launch fact.** Category estimates remain non-actionable and unavailable until the exact catalog-linked rule is approved. _Medium confidence on candidate architecture; external review pending._
- **Skin cycling is a dermatologist-developed framework, not an RCT-validated protocol.** Frame and personalise it honestly; do not claim clinical superiority. _Medium-high confidence on the framework's provenance and rationale; low confidence in any "clinically proven" outcome claim._
- **CosIng's exact bulk-download mechanics may have changed** with the Commission's relaunch/migration; the ~15,000 INCI figure and "no legal value" disclaimer are reliable, but verify the export route and consider whether a mirror is needed at build time. _Medium confidence._
- **Open Beauty Facts coverage is uneven and volunteer-driven,** so scan-match rates will vary by market; reviewed curation + OCR + manual entry + the OnSkin correction queue are essential, not optional. OBF runtime lookup and contribution are excluded, and counsel must approve the exact ODbL posture before OBF-derived data is promoted. _High confidence on the constraint; medium on match rates; legal classification pending._
- **Freshness labeling differs by jurisdiction and product classification.** Ordinary U.S. cosmetics often lack authoritative dates; U.S. and Canadian sunscreens require classification-specific review and still do not justify a universal printed-date assumption. Launch preserves physical-package printed / label-or-catalog PAO / unknown states; category estimate remains a distinct but disabled future state. _High confidence on the cited regulatory gap; legal review remains pending._
- **The cosmetic-vs-drug claims boundary is real and FDA/FTC-enforced;** in-app copy is a claims surface. The constraints in §9 should be reviewed by regulatory counsel, especially for the safety class. _High confidence on the principle; legal review recommended for wording._
- **Competitive landscape moves fast** — SkinSort, Cosmily, and HadaBuddy already ship conflict checks in 2026, and new entrants will appear; the moat is the integration + grading + trust + data lock-in, and that positioning must be revisited periodically. _Medium confidence._
- **Market-size figures are vendor-sourced and definition-dependent** (skincare-app vs beauty-tech vs skincare-products); treat the specific numbers as directional. The Yuka financials (its own accounts) are the most reliable proof point. _Medium confidence on market sizing; high on the Yuka reference._
- **`auth` role coverage for anonymous catalog reads** (does product intake during the pre-account anon session correctly read the catalog under `TO authenticated`?) should be verified against Supabase's `is_anonymous` role behaviour at build time (docs/01 §1). _Medium confidence._
