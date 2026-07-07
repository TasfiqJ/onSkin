# Document 4: The Smart Shelf — Build Spec

*The personal product inventory · barcode / search / OCR / manual intake · the opened-date linchpin · PAO & expiry intelligence · the Shelf surfaces, badges & calm conflict banner · the product-detail management hub · product lifecycle · replenishment · privacy.*

> This is build-order document **#4** of the 15 named in docs/00 (§"Build order", item 4: *"Smart shelf (PAO/expiration)"*). It is the user's **digital cabinet** and the product-data **capture engine** of the whole app. It *extends* the `user_products` table defined in docs/01 §3, and it *operationalises* the PAO/expiry intelligence, the catalog tables, and the badge taxonomy already specified in **docs/02 §6 and §7** — it does **not** re-derive them. It renders the **Shelf screen** (spec p11–12) and the entire add-to-shelf flow, it is the **product source** the routine builder (docs/03) reads from, it feeds the conflict engine (docs/02 `detect_conflicts`), and it is where **replenishment** begins — which later connects to the reminders surface (doc #7) and the ShopMy affiliate integration (doc #10). The scan is, alongside the first check-off, one of the two highest-leverage actions a new user can take.

---

## TL;DR

- **The Smart Shelf is the product-data capture engine and one of the two activation magic-moments (the barcode scan).** It is where products *enter* the system (by scan, search, OCR, or manual entry), where **PAO / expiry** lives, and where the conflict engine and the routine builder get their raw inputs. It is simultaneously the **activation moment** (scanning a product is fast, tactile, and immediately rewarding) and the **switching cost** (a fully-digitised cabinet, with opened-dates and history, is expensive to recreate elsewhere). Scanning is proven mass behaviour — **Yuka has ~80M users and ~6M referenced products** built almost entirely on "scan a barcode, get a verdict."

- **Scope is deliberately narrow against docs/02.** docs/02 owns the **catalog** (`products`, `ingredients`, `product_ingredients`, `ingredient_pao_defaults`) and the **PAO *logic*** (the `expiry_computed` waterfall, the category-default table, the badge *taxonomy*). Document 4 owns the **shelf *feature and experience*** — the intake flows and all their edge cases, the Shelf screens, the product-detail management hub, the product lifecycle, and replenishment. The rule of thumb: **docs/02 decides what a product *is* and when it expires; doc 4 decides how the user *adds, sees, manages, and replaces* it.**

- **Skincare genuinely expires, on two distinct axes — and the shelf must be honest, not alarmist, about both.** *Efficacy:* active ingredients degrade (vitamin C oxidises within weeks, retinol breaks down, SPF UV-filters lose protection, antioxidants/peptides/ceramides decline) — this is the **universal** concern. *Safety:* preservative systems weaken over time, allowing microbial contamination (*Pseudomonas*, *Staphylococcus*, *Candida*), with documented infections — but for a product only *slightly* past its PAO **with no visible, textural, or smell change, the safety risk is usually low** (INKEY; CosmeticsInfo's "when in doubt, throw it out"). The genuinely higher-stakes exceptions are **eye-area products and sunscreen** (AAD/CosmeticsInfo flag eye products; SPF efficacy is safety-critical). Product consequence: the shelf says **"time to replace,"** never *"expired — dangerous."*

- **PAO is EU/UK law; the US (FDA) mandates neither expiry nor PAO — so the data is patchy and the shelf must degrade gracefully.** Under **EU Reg (EC) 1223/2009, Article 19 / Annex VIIIa**, a product with an unopened shelf life **> 30 months** is exempt from a best-before date and must instead carry the **open-jar PAO symbol** ("12M", "24M"); a product with shelf life **≤ 30 months** must carry an expiry/best-before date; single-dose, airless/sealed, and inherently-stable products are exempt. The **US FDA does not require expiration dating or PAO on cosmetics** (sunscreens excepted, as OTC drugs). The result: EU/UK products often have PAO data, US products frequently have none — so the shelf must fall back **label/catalog PAO → category default → honest "estimated / unknown,"** and **never fabricate a precise date.**

- **`opened_at` is the linchpin of the whole feature — and the hardest datum to get — so capture it at intake.** PAO only starts counting at first opening, and docs/01's generated column is `expiry_computed = least(expiry_date, opened_at + pao_months)`. Without `opened_at`, there is no PAO clock. Every intake path therefore ends with a calm **"When did you open it?"** (Just opened it / Pick a date / Not opened yet), with an honest "not sure? we'll estimate" path. Unopened products show an estimated *shelf* life, not a PAO countdown.

- **Intake is a multi-path funnel with the scan as the hero and robust fallbacks behind it.** Barcode → **Open Beauty Facts** v2 API (strictly **one API call per real scan**; ODbL **contribute-back** obligation) → match → result sheet → opened-date → save. Fallbacks, each fully specified for every edge case (no match, ambiguous match, unreadable/absent barcode, offline, non-beauty barcode): **Search** the catalog → **Scan the INCI list (OCR)** → **Add manually** (the always-works path). Unknown/new products are **contributed back** to Open Beauty Facts after light validation, satisfying the ODbL obligation and improving coverage for everyone.

- **The Shelf surfaces are calm, evidence-graded, and exactly as the spec draws them.** Title + count, **All / Actives / Expiring** filter chips, the **clay, resolution-first conflict banner** (never red; absent when all-clear), product cards with the PAO/expiry **badge taxonomy** (future-date / countdown / "paired" / expired / unknown), and the **"Scan a barcode"** FAB (spec p12). Tapping a card opens the **product-detail management hub** — full active breakdown, PAO/expiry with its source, the conflicts the product is part of, the routines it's used in, and the lifecycle actions (mark opened, edit opened-date, mark finished/discarded, replace, remove).

- **Seven-figure verdict: the shelf is king-making — it is the data engine, the lock-in, and a recurring commerce surface.** Scanning is the proven entry behaviour and the activation moment; the **shelf-as-managed-inventory with PAO + opened-dates + replenishment is the underserved wedge** (Yuka/EWG have no shelf; SkinSort and HadaBuddy organise or AI-generate but don't do PAO/replenishment well). The shelf is the input to everything monetisable (personalisation, conflict detection, routine building → activation), it is the switching cost (retention), and **replenishment is a recurring-value and affiliate surface** (beauty repeat-purchase rates run **25–35%**, higher with replenishment; ShopMy has facilitated **$500M+** in sales with an OAuth API and a 30-day cookie). The risks are **data coverage** (mitigated by fallbacks + contribute-back) and **staying honest/claim-safe** (mitigated by non-alarmist PAO copy, opt-in replenishment, and clinical sign-off of the defaults) — not demand.

---

## Key Findings

1. **The shelf is the product-data capture engine, and the scan is an activation magic-moment.** Everything downstream — the conflict engine (docs/02), the routine builder (docs/03), personalisation, and replenishment — depends on knowing what the user owns. Yuka's ~80M users and ~6M products prove that barcode scanning is mass-market, low-friction behaviour; the scan→add action is the shelf's equivalent of the first check-off (docs/01 §7) as a leading activation signal.

2. **Skincare expires on two axes, and the honest framing is a trust asset.** *Efficacy* loss is universal and is the primary, defensible reason to track freshness (vitamin C, retinol, SPF, peptides all degrade; AAD; Leslie Baumann MD; INKEY). *Safety* (preservative decline → microbial contamination) is real and documented, **but** for products only slightly past PAO with no visible change the risk is usually low, and the genuinely higher-stakes exceptions are **eye-area products and sunscreen**. The shelf should be useful and calm ("time to replace"), never alarmist — consistent with the spec's "evidence-graded, never alarmist" mandate (p12).

3. **PAO is an EU/UK regulatory construct; the US has no equivalent — so PAO data is structurally incomplete.** EU Reg 1223/2009 Art. 19: shelf life >30 months → open-jar PAO symbol; ≤30 months → expiry date; exemptions for single-dose/sealed/stable products. US FDA mandates neither for cosmetics (sunscreens excepted). The shelf must therefore source PAO via a waterfall and degrade to an honest "unknown," recording **which source** each value came from.

4. **`opened_at` is both the most important and the least reliable datum, so it must be captured deliberately and treated as an estimate.** PAO counts from first opening; `expiry_computed = least(expiry_date, opened_at + pao_months)` (docs/01 §3). Capture `opened_at` at intake with a calm, skippable prompt; support an **unopened** state (no PAO clock, show estimated shelf life); and always communicate the computed date as an estimate, because the input is self-reported.

5. **The category-default PAO numbers are well-supported starting positions — and need cosmetic-chemist sign-off.** Validated, conservative defaults (Leslie Baumann MD; Image Skincare; INKEY): vitamin C serum **3–6 mo** (oxidises fast; brown = toss), retinol/benzoyl-peroxide **~6 mo**, mascara/liquid-eye **3–6 mo**, water-based serum/toner **6–12 mo**, moisturiser tube **12 mo** / jar **6–9 mo** (finger contamination), oils/anhydrous balms **12–24 mo**, cleanser **~12 mo**, **sunscreen → use printed expiry** (OTC drug). These extend docs/02 §6's table and are a **B-DERM-REVIEW** item (formulation/packaging change the real numbers — airless pumps extend life, jars shorten it).

6. **Data sourcing is fully operationalisable, with hard constraints.** Open Beauty Facts exposes a stable v2 JSON API (`world.openbeautyfacts.org/api/v2/product/[barcode].json`), a universal `product_type=all` scanner, **~100,000+ products across 170 countries** (volunteer-driven, so coverage is uneven), bulk dumps for seeding, and an **ODbL** licence requiring **source attribution, no co-mingling of non-free data, and contribute-back of any product you add** (authenticated POST). The rule **"1 API call = 1 real scan"** is explicit and must be honoured; bulk work uses the dumps. Coverage gaps make the **search/OCR/manual fallbacks essential, not optional.** Ingredient parsing uses CosIng (docs/02).

7. **Barcode scanning is on-device, and scan reliability is a competitive bar.** `react-native-vision-camera` with a barcode frame processor (docs/00 §1/§4) runs entirely on-device (supporting the "scanning happens on your device" promise). Yuka's scanner is the reliability benchmark; reviewers note SkinSort's scanner is *less* reliable — so scan speed and forgiveness are a genuine differentiator worth investing in.

8. **The shelf is health-inference data and must be owner-only and on-device-friendly.** What a person owns reveals skin conditions, concerns, and even pregnancy (via product types) — so the shelf is downstream of the health-data-collection consent (docs/01 §4), is RLS-isolated per user (docs/02 §8), stores product thumbnails **on-device by default**, and is never sold, shared, or used to train AI (brand promise, spec p4).

9. **Replenishment is a real retention and monetisation surface — and PAO makes the trigger honest.** Beauty repeat-purchase rates run **25–35%** (higher with replenishment/subscription), repeat buyers spend materially more, and replenishables "keep commissions flowing." PAO/expiry gives an **honest** reason to nudge ("your SPF is nearly finished / nearly expired") rather than manufactured urgency, which fits the trust positioning. The nudge can route to **ShopMy** (docs/00 §5: OAuth API, 30-day cookie, $500M+ facilitated) **only behind the separate MHMDA data-sharing consent** (docs/01 §4) and with claim-safe copy.

10. **Competitively, scanning and basic "organise your products" are table stakes; the smart-cabinet-with-PAO/opened-date/replenishment is the wedge.** Yuka/EWG: scan + score, **no shelf**. SkinSort: scan + skin-match + "organise all your cosmetics" + a routine/diary tracker + daily logging + incompatibility flags (but web-first, weaker scanner, **no PAO/expiry**). HadaBuddy: "**scan your shelf** → AI-built 7-day routine" — explicitly targeting the "what do I do with these 12 bottles" moment (but one-shot AI, no PAO/replenishment). Think Dirty: scan + lists. **None** combines a managed inventory with **opened-date + PAO/expiry intelligence + replenishment** *and* conflict-resolved cycling *and* privacy-first *and* the compounding data lock-in. PAO/expiry/replenishment is the genuinely under-served dimension.

---

## Details

### 1. What the Smart Shelf is — and is not (scope & philosophy)

**It is** the user's personal product inventory and the system's product-data capture surface. Concretely, the shelf:
- is the **intake point** — every product enters here (scan / search / OCR / manual), and intake captures the data the rest of the app needs (catalog link, parsed actives, concentration, `opened_at`, PAO);
- is the **source of truth for what the user owns** — the routine builder (docs/03) draws its steps from `user_products`, and the conflict engine (docs/02 `detect_conflicts`) runs over the shelf;
- is the **home of PAO / expiry** — the place freshness is surfaced and managed;
- is the **launch point for replenishment** — when a product is running low, expiring, or finished.

**It is not**, and these boundaries are load-bearing:
- the **catalog** — docs/02 owns `products`/`ingredients`/`product_ingredients`/`ingredient_pao_defaults` and the PAO *logic*; the shelf *reads and applies* them.
- the **conflict rules** — docs/02 owns the matrix and `detect_conflicts`; the shelf *renders* their results (the banner, the "paired" badge) and *triggers* recomputation on change.
- the **routine** — docs/03 consumes the shelf; the shelf does not sequence or schedule.
- a **diagnostic or claims surface** — the shelf never diagnoses, never makes drug claims, and never alarms. PAO is a **guide, not a cliff**; copy is claim-safe and calm ("time to replace," "may be past its best"), per docs/02 §7.7 and §9.

**Scope boundary (docs/02 §6 ↔ doc 4), stated crisply:**

| Concern | Owned by docs/02 (§6/§7) | Owned by doc 4 (here) |
|---|---|---|
| The catalog (products, ingredients, tags, PAO defaults) | ✔ | reads |
| `expiry_computed` waterfall + category-default table | ✔ (logic) | applies + presents |
| Badge *taxonomy* (date/countdown/paired/expired) | ✔ (defined) | renders + thresholds + states |
| Conflict rules + `detect_conflicts` | ✔ | triggers + renders |
| **Intake flows** (scan/search/OCR/manual) + edge cases | — | ✔ |
| **Shelf screens** (list, detail, add-flow) | sketched (§7.1/7.5) | ✔ (full) |
| **Product lifecycle** (unopened/active/finished/discarded) | — | ✔ |
| **Replenishment** | — | ✔ |

### 2. Data model — extends docs/01 `user_products` + docs/02 catalog

**Recap of the existing `user_products` (docs/01 §3) — unchanged, the spine of the shelf:**
`id`, `user_id`, `catalog_product_id NULL FK` (→ docs/02 `products`), manual fallbacks `manual_name` / `manual_brand`, `barcode`, `opened_at date`, `pao_months int`, `expiry_date date`, and the generated column `expiry_computed date GENERATED ALWAYS AS (least(expiry_date, opened_at + (pao_months || ' months')::interval)) STORED`, plus `status text` (active/finished/discarded). Owner-only RLS; indexed on `user_id`, `catalog_product_id`.

**Extensions this feature needs** (additive columns + one small intake/contribute-back log; they do **not** redefine the table):

```sql
alter table public.user_products
  add column created_at      timestamptz not null default now(),
  add column updated_at      timestamptz not null default now(),
  add column is_opened       boolean not null default true,   -- false = unopened (no PAO clock yet)
  add column finished_at     date,                            -- when status moved to finished/discarded
  add column nickname        text,                            -- user's own label ("my night serum")
  add column notes           text,                            -- freeform ("travel size", "samples")
  add column thumbnail_path  text,                            -- LOCAL device path by default (on-device photo)
  add column pao_source      text,    -- 'label' | 'catalog' | 'category_default' | 'unknown'
  add column expiry_source   text,    -- 'printed' | 'pao_computed' | 'estimated' | 'unknown'
  add column added_via       text;    -- 'barcode' | 'search' | 'ocr' | 'manual' | 'onboarding'

-- Optional: an intake log for analytics + the contribute-back queue (owner-only).
create table public.shelf_scans (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  barcode           text,
  matched_product_id uuid references public.products(id),     -- null = no catalog match
  result            text not null,    -- 'matched' | 'no_match' | 'ambiguous' | 'offline_queued'
  contributed_back  boolean not null default false,           -- ODbL obligation satisfied?
  created_at        timestamptz not null default now()
);
create index on public.shelf_scans (user_id);

-- RLS (owner-only, exactly the docs/01 §3 pattern): wrap auth.uid() in a subselect,
-- TO authenticated, index policy columns, WITH CHECK on writes.
alter table public.shelf_scans enable row level security;
create policy ss_owner_sel on public.shelf_scans
  for select to authenticated using ((select auth.uid()) = user_id);
create policy ss_owner_ins on public.shelf_scans
  for insert to authenticated with check ((select auth.uid()) = user_id);
-- user_products already has owner-only RLS per docs/01; the new columns inherit it.
create index on public.user_products (user_id, status, expiry_computed);  -- for the Expiring filter/sort
```

> **Decision-log notes (DECISIONS.md):** **D-022** — `opened_at` is captured at intake and an explicit **`is_opened` unopened state** is supported (no PAO clock until opened); **D-023** — every `user_products` row records `pao_source`/`expiry_source` provenance so the UI can be honest about estimates; **D-024** — product **thumbnails are stored on-device by default** (`thumbnail_path` local), cloud only on the same opt-in that governs progress photos (docs/01 §3). Anything touching the **data-sharing** consent for replenishment/affiliate belongs in **BLOCKERS.md** (see §6/§7).

### 3. PAO / expiry intelligence (the science + the rules) — operationalising docs/02 §6

**The two-axis science (validated; honest grading).** Skincare expires in two ways: **efficacy** (active ingredients lose potency — vitamin C oxidises within weeks and browns; retinol degrades, especially with heat/light; SPF UV-filters lose protection; antioxidants/peptides/ceramides decline) and **safety** (preservative systems weaken, permitting microbial growth — *Pseudomonas aeruginosa*, *Staphylococcus epidermidis*, *Candida* — with documented irritation and infections). **Efficacy is the universal, defensible concern.** Safety is real but proportionate: for a product only slightly past PAO **with no visible, textural, or olfactory change, the risk is usually low** (INKEY; CosmeticsInfo's "when in doubt, throw it out"), while **eye-area products and sunscreen are the genuinely higher-stakes exceptions** (AAD/CosmeticsInfo flag eye products; SPF efficacy is safety-critical). The shelf reflects this with **calm, useful, non-alarmist** copy — "time to replace," never "dangerous."

**The regulatory reality and the data gap.** EU Reg 1223/2009 Art. 19 / Annex VIIIa: unopened shelf life **>30 months** → open-jar **PAO** symbol ("12M"); **≤30 months** → expiry/best-before date (hourglass); single-dose, sealed/airless, and inherently-stable products are exempt; PAO must be stability-test-backed. **US FDA mandates neither** expiry nor PAO for cosmetics (sunscreens excepted as OTC drugs). Consequence: PAO data is present for many EU/UK products and absent for many US ones — so the shelf sources it via a waterfall and is honest when it doesn't know.

**The `expiry_computed` walkthrough (docs/01's generated column, applied).** `expiry_computed = least(expiry_date, opened_at + pao_months)` — i.e. **whichever comes first**, the printed expiry or the PAO-from-opening. Three practical consequences:
- **Sunscreen** carries a printed expiry (OTC drug); that printed `expiry_date` will often be **sooner** than `opened_at + pao_months`, so it wins — exactly the spec's **Mineral SPF 50** card showing **"3 wks left"** (opened Aug 2025 + 12-mo PAO would be Aug 2026, but the printed expiry is weeks away, so `least()` surfaces the nearer date). This is the generated column behaving correctly and is the canonical example of why we store both.
- **Unopened** products (`is_opened = false`, `opened_at` null) have **no PAO clock**; the shelf shows an *estimated shelf life* from `expiry_date` if printed, else a gentle "unopened — estimated shelf life ~N months," never a fabricated PAO countdown.
- **Maya's other cards** all follow `opened_at + pao_months`: Retinol opened Mar + 6-mo PAO → **"Sep 2026"**; Ceramide opened May + 12-mo PAO → **"May 2027"**; Glycolic opened Jan + 12-mo PAO, shown with the **"paired"** badge only once scheduler/routine placement has confirmed the conflict is already resolved (docs/02/03), not because of its date.

**PAO sourcing waterfall (records provenance in `pao_source`):**
1. **Printed / catalog PAO** — `products.default_pao_months` from the label or the curated catalog (docs/02). `pao_source='label'|'catalog'`.
2. **Category default** — `ingredient_pao_defaults` keyed on the product's category. `pao_source='category_default'`.
3. **Honest unknown** — no reliable PAO → `pao_source='unknown'`, show "PAO estimated/unknown," **never invent a precise date.**

**Category-default PAO table (extends docs/02 §6; conservative; B-DERM-REVIEW):**

| Category | Default PAO (months) | Basis / rationale |
|---|---|---|
| Vitamin C (L-ascorbic) serum | **3–6** | oxidises quickly once opened; browning = degraded (Baumann: ~4 wks once browning) |
| Retinol / retinoid serum | **6** | breaks down with air/heat/light (Baumann: replace ~2 mo after opening for potency) |
| Benzoyl peroxide / oxidising actives | **6** | oxidiser; potency decay |
| Mascara / liquid eye products | **3–6** | eye-area microbial risk (AAD/CosmeticsInfo) |
| Water-based serum / toner | **6–12** | preservative-dependent |
| Moisturiser — tube | **12** | lower contamination than jars |
| Moisturiser — jar | **6–9** | finger-dipping contamination |
| Oil / anhydrous balm | **12–24** | low water activity → slow microbial growth |
| Cleanser (rinse-off) | **~12** | short contact, rinsed |
| **Sunscreen (SPF)** | **use printed expiry** | OTC drug; regulated expiry exists |

(Final numbers confirmed with the cosmetic chemist; airless/pump packaging extends these, jars/droppers shorten them — log under **B-DERM-REVIEW**.)

**Storage/condition tips (surfaced as gentle guidance, not stored as data).** Heat, steam, and light accelerate degradation; bathrooms are the worst place; airless pumps and clean hands extend life. The shelf may show a one-line tip on a product detail ("Keep this out of the bathroom to help it last") — never alarmist, never a "claim."

**Badge thresholds (operationalising docs/02 §7.6 — see §5.3 for visual detail).** Countdown badge when `expiry_computed` is within a threshold (default **≤30 days**, "N wks/days left," clay); expired/replace when past `expiry_computed` (gentle); future-date when comfortably ahead (neutral month/year); "PAO unknown/est." (quiet) when `pao_source='unknown'`; "paired" when a conflict on this product is already resolved (clay, calm).

### 4. Product intake — the multi-path funnel (the hero flow)

Intake is the most important *how-it-works* surface in this document. There is **one hero path (scan)** and **three fallbacks**, and **every path ends at the opened-date capture (§4.5)** and writes a `user_products` row.

#### 4.1 Barcode scan (the hero)

1. **Entry:** the **"Scan a barcode"** FAB (spec p12), the onboarding "current products" step (docs/01 §2 step 6), or an empty-shelf prompt.
2. **Camera:** `react-native-vision-camera` with a barcode frame processor (docs/00 §4), **on-device**, with a clear framing reticle, a steadying hint ("Line up the barcode"), and privacy microcopy ("Scanning happens on your device"). Torch toggle for low light. A selection haptic on a successful read.
3. **Lookup:** on a decoded barcode, **one** call to Open Beauty Facts v2 (`/api/v2/product/[barcode].json`; **one API call = one real scan**), optionally `product_type=all` to catch mis-scans. Cache the matched product into the local catalog mirror.
4. **Result sheet:** product name, brand, a rounded thumbnail (OBF image if present, else placeholder), the **parsed actives** (from `product_ingredients` → tags, docs/02), and an **estimated PAO** with its source shown honestly ("est. 6 mo PAO"). A clear primary **"Add to shelf."**
5. **Opened-date (§4.5)** → confirm/adjust PAO → **save** to `user_products` (`added_via='barcode'`, `catalog_product_id` set) and log a `shelf_scans` row.

**Edge cases (all handled, calmly):**
- **No catalog match** → "We don't have this one yet" → offer **Search catalog**, **Scan the ingredient list (OCR)**, or **Add manually**, and queue a **contribute-back** (§4.6). Never a dead end.
- **Ambiguous / multiple matches** → a short disambiguation list (name + brand + size) to pick from.
- **Unreadable barcode** → "Can't read it? Enter the numbers" (manual barcode) or jump to OCR/manual.
- **No barcode on the product** (common for unboxed minis/samples) → straight to OCR/manual.
- **Offline** → save with a provisional name and **queue the lookup** (`result='offline_queued'`); reconcile and enrich when back online (docs/01 §6).
- **Non-beauty barcode** (food/petfood via `product_type=all`) → gentle "This looks like a food product — want to add it anyway?" (don't hard-fail).

#### 4.2 Search the catalog

Typeahead over `products` (the GIN full-text index, docs/02 §3) by name/brand, biased to the user's locale/market. Select a result → opened-date → save (`added_via='search'`). For the long tail not in the catalog, the search empty-state offers OCR/manual + contribute-back.

#### 4.3 Scan the ingredient list (OCR)

Camera → **on-device OCR** (ML Kit Text Recognition / Apple Vision, docs/00 §4) of the printed INCI list → tokenise and match against `ingredients` + `ingredient_synonyms` (docs/02) → build a **provisional product** (name/brand from the user, actives from the parsed list) → opened-date → save (`added_via='ocr'`) + contribute-back. Because INCI lists are hard to OCR (small fonts, curved/reflective tubes), **always show the parsed result for confirmation/correction** and never block on a perfect parse. (Feasibility caveat in Caveats.)

#### 4.4 Add manually (the always-works fallback)

A simple form: **name, brand, category** (drives the default PAO), optional **barcode**, optional **ingredients** (free-text → parsed against the catalog for actives), **opened-date**, and **PAO** (auto-filled from the category default, fully editable). This path always succeeds, even fully offline, and is the floor under every other path (`added_via='manual'`).

#### 4.5 The opened-date capture (the linchpin)

Every path converges here. A calm sheet: **"When did you open it?"** with **Just opened it** (sets `opened_at = today`), **Pick a date** (a date picker; sets a past `opened_at` and recomputes), and **Not opened yet** (sets `is_opened=false`, no PAO clock). An honest secondary line — *"Not sure? We'll estimate from when you added it."* The PAO value is shown and **editable** here (pre-filled from the source waterfall, §3), with its source labelled. This single screen is what makes every expiry estimate downstream meaningful; it is worth a dedicated, friction-light moment.

#### 4.6 Contribute-back pipeline (ODbL obligation)

Any product the user adds that **wasn't** in Open Beauty Facts (no-match scans, OCR-built, manual with a barcode) is, after **light validation** (sane name/brand, a barcode, a legible INCI photo where available), **contributed back** to OBF via the authenticated POST endpoint (`code` + credentials + fields) — satisfying the ODbL **contribute-back** requirement and improving coverage for everyone. This runs as a queued, offline-tolerant job (an Edge Function or a client task), marks `shelf_scans.contributed_back=true`, and is privacy-safe (it sends *product* data — barcode, label, INCI — never the user's personal shelf/profile). Source attribution to Open Beauty Facts is shown wherever catalog data is displayed (ODbL).

#### 4.7 First intake from onboarding

The onboarding "current products intake" (docs/01 §2 step 6) is the shelf's first population; **skip must stay visible** (docs/01). Whatever is added there seeds `user_products` (`added_via='onboarding'`) and immediately feeds the first routine generation ("See my routine," docs/03 §2) and the first conflict pass.

### 5. The Shelf surfaces (look, feel, and behaviour) — every detail

**Design tokens (committed; docs/00 §8, DECISIONS D-005, docs/02 §7):** display = **Instrument Serif** (the "Shelf" title); UI = **Hanken Grotesk** (everything functional); **monospace** for metadata/labels ("14 products," "opened Mar · 6 mo PAO," badge text). Palette **paper · greige · clay · ink · night**. The shelf is a **light-mode** surface (it's used at the mirror/shelf, AM). 8pt grid; Reanimated 3 motion; restrained haptics; WCAG 2.2 AA; Dynamic Type; RTL-ready.

#### 5.1 Shelf list screen (spec p12) — full anatomy, top to bottom

- **Status bar** — standard (9:41, signal/wifi/battery).
- **Title block** — **"Shelf"** in Instrument Serif (large), with the product count **"14 products"** right-aligned in mono. Generous top padding on paper.
- **Filter chips** — pill segments **All / Actives / Expiring**; **All** selected (ink fill, paper text), the others outlined. Single-select; a selection haptic on change. (Behaviour in §5.4.)
- **Conflict banner** (when noteworthy) — a **clay-tinted, low-contrast** card with a small clay dot, a bold line ("Retinol + glycolic acid share your PM routine"), a calm resolution subhead ("Use them on alternate nights."), and a quiet **"Review →"** to the conflict detail (docs/02 §7.3). Shelf-only detection must not claim the app already placed products; that copy belongs to scheduler-backed routine contexts. **Never red, never an alert icon.** Absent (or a subtle "all clear") when nothing needs attention.
- **Product cards** — a vertical list of paper cards (§5.2).
- **"Scan a barcode" FAB** — a dark (ink) pill, centred low, clearly primary.
- **Tab bar** — Today · Progress · Shelf · You (Shelf active, clay dot).

**States:** **empty** → a warm prompt to scan/add the first product (ties to onboarding step 6); **loading** → skeleton cards, never spinners (docs/01 §8); **all-resolved** → no banner, calm; **offline** → a quiet "Offline — changes will sync" line, full read + manual-add still work.

#### 5.2 Product card anatomy

A paper card, rounded corners, subtle border. Left: a **rounded-square thumbnail** (diagonal-hatch placeholder until imagery; the on-device `thumbnail_path` photo when present). Centre: **product name** (Hanken, semibold) and a **mono metadata line** — `brand · opened {month} · {N} mo PAO` (e.g. "Verra Skin · opened Mar · 6 mo PAO"). Right: the **badge** (§5.3). Long names truncate gracefully; multi-active products may show up to ~2 active tags inline (rest under detail). The whole card is tappable → product detail (§5.6), with a subtle press state and selection haptic. The **Expiring** card may carry a faint clay border (the spec's SPF card) to draw the eye calmly.

#### 5.3 Badge taxonomy (operationalising docs/02 §7.6) — exact behaviour

Right-aligned, mono. Five states, each with a precise trigger and tone:
- **Future date** (neutral) — stacked **month/year** ("Sep 2026", "May 2027"); shown when `expiry_computed` is comfortably ahead (beyond the countdown threshold). Greige text on paper. *Information, not warning.*
- **Countdown** (clay) — **"N wks/days left"** when `expiry_computed` is within the threshold (default **≤30 days**). Clay-tinted pill. The spec's **Mineral SPF 50 "3 wks left."**
- **"paired"** (clay, calm) — when a conflict involving this product is **already resolved** by scheduler or real routine placement (docs/02/03). The conflict engine alone only returns advice; it does not earn the badge. Signals "handled," not "problem." The spec's **Glycolic 7% "paired."**
- **Expired / replace** (gentle) — when past `expiry_computed`. A calm "Time to replace," never red, never "dangerous" (except the genuinely safety-critical eye/SPF cases, which may say "Replace for best protection").
- **PAO unknown / estimated** (quiet) — when `pao_source='unknown'` or `opened_at` is missing; a low-key "PAO est." so the user knows the date is a guess. Honesty over false precision.

#### 5.4 Filters & sorting

- **All** — the full active shelf (`status='active'`), default.
- **Actives** — products bearing an active tag (retinoid / AHA / BHA / vitamin-C / BP / etc., via docs/02 tags). Useful for "what's potent in my routine."
- **Expiring** — products whose badge is countdown/expired (the §5.3 thresholds; uses the `(user_id, status, expiry_computed)` index).
- **Default sort:** soonest `expiry_computed` first within the active set (surfaces what needs attention), with unopened/unknown sorted last. A secondary **search within shelf** (by name/brand) for large cabinets.
- Finished/discarded products live in an **archive** view (§5.7), not the main list.

#### 5.5 Conflict banner (calm, reusable — docs/02 §7.2)

Identical pattern to the PM routine banner: **clay tint not red**, a small dot, a verb-first calm subhead that states the **resolution** ("Use them on alternate nights"), one quiet action ("Review →"). Only scheduler-backed contexts may claim actual placement. It appears only when there's a noteworthy/unresolved interaction across the shelf; the reassurance variant (docs/02 §7.8) appears when two products the evidence *clears* are added (a quiet positive note).

#### 5.6 Product detail (the management hub) — tap a card

The shelf's deepest screen and the place product management happens. Top to bottom:
- **Header** — product name (Instrument Serif), brand (mono), the thumbnail (tap to add/replace an on-device photo), and the **source attribution** (Open Beauty Facts / catalog, per ODbL) in fine print.
- **Freshness block** — **opened date** (editable inline), **PAO** (editable, with its `pao_source` labelled honestly), the computed **expiry** (`expiry_computed`, with `expiry_source`), and the current **status**. For unopened items, a "Mark as opened" affordance that starts the PAO clock.
- **What it contributes** — the **actives** this product brings (tags + concentration band from docs/02), in plain, claim-safe language.
- **Conflicts & pairings** — any interactions this product is part of, rendered calmly ("Timing note with your glycolic toner — use on alternate nights. Review →") with a link to the conflict detail (docs/02 §7.3); positive pairings surfaced as reassurance. Use "paired" language only when scheduler/routine placement has confirmed the interaction is handled.
- **Where it's used** — the routines/steps this product appears in (docs/03), so the user sees its role.
- **Lifecycle actions** — **Mark opened** / **Edit opened-date** / **Mark finished** / **Mark discarded** / **Replace / replenish** (§6) / **Remove**. Destructive actions confirm; finishing/discarding archives (keeps history), removing deletes.
- **Microcopy** — claim-safe throughout; freshness phrased as "best used by," "may be past its best," "time to replace."

#### 5.7 Lifecycle states & transitions

`unopened (is_opened=false)` → **active** (`status='active'`, `opened_at` set, `is_opened=true`) → **finished** or **discarded** (`status` set, `finished_at` recorded). Finished/discarded products move to a calm **archive** (not deleted) — preserving repurchase history and the data lock-in, and powering "you've repurchased this 3 times" and replenishment. The main list shows only `active`. Each transition animates calmly (fade), with a selection haptic; nothing celebratory or alarming.

#### 5.8 Empty, sparse, loading & error states

**Empty shelf** — a warm illustration-light prompt: "Add your first product — scan a barcode, or add it by hand." **Sparse** (1–2 products) — the same calm tone, plus a gentle nudge toward completing the routine's missing roles (claim-safe, e.g. "A daily SPF would round out your mornings"). **Loading** — skeleton cards. **Errors** — OBF/network errors degrade to the manual path, never a hard wall; a quiet "Couldn't reach the product catalog — you can still add it by hand."

#### 5.9 Microcopy, motion, haptics, accessibility, localisation (extends docs/02 §7.7)

- **Microcopy:** claim-safe (cosmetic verbs only), calm (no "danger/warning/avoid"), evidence-honest (say "estimated" when it is), resolution-first.
- **Motion:** subtle fades, the clay highlight for attention; respect Reduce Motion; no bouncy/gamified animation anywhere on the shelf.
- **Haptics:** selection ticks on chips, card taps, and lifecycle actions; nothing alarming on an expiry or conflict.
- **Accessibility:** badges carry **text, not colour alone** (a colour-blind user must read "3 wks left," not infer it from clay); 44pt targets; VoiceOver focus lands on the screen title on entry and announces card state ("Mineral SPF 50, 3 weeks left"); Dynamic Type reflow (no fixed-height text containers).
- **Localisation:** externalise all copy (badges, PAO labels, lifecycle actions) for ~30% string expansion and RTL (docs/01 §8); dates and month abbreviations localise.

### 6. Replenishment (the recurring-value + monetisation surface) — claim-safe, opt-in

**The honest trigger.** When a product nears `expiry_computed` (the countdown threshold), is past it, or is marked **finished**, the shelf can surface a calm **"time to replace"** prompt. Because the trigger is real (the product is genuinely running low or expiring), this is honest help, not manufactured urgency — which fits the trust positioning. The *notification* for this lives in the reminders surface (doc #7) and is gated by `notification_preferences.replenishment_alerts` (docs/01 §3); in-app, it appears as a quiet badge/action on the card and detail.

**The flow.** Prompt → product detail **"Replace"** → either **re-add the same product** (one tap, resets `opened_at` on the new unit) or **see equivalents** (suggested via the actives/category, docs/02; claim-safe "similar options") → optionally an **affiliate link**. Affiliate routing uses **ShopMy** (docs/00 §5: OAuth API, 30-day cookie + 30-day return window, $500M+ facilitated) **only** behind the separate **MHMDA data-sharing consent** (docs/01 §4) — and any attribution SDK is preceded by ATT priming (docs/01 §8). Amazon Associates/Skimlinks/Sovrn are fallbacks (docs/00 §5).

**Why it matters (economics).** Beauty repeat-purchase rates run **25–35%** (higher with replenishment/subscription), repeat buyers spend materially more than first-timers, and "replenishables keep commissions flowing" — and skincare is inherently replenishable (you run out). PAO/expiry makes the shelf the *natural, non-spammy* place this happens.

**Boundaries (non-negotiable).** Never manufacture urgency; never imply a product *must* be replaced for **safety** except the genuine eye/sunscreen cases; keep all copy claim-safe (docs/02 §9); replenishment and affiliate are **opt-in** and behind the data-sharing consent. The shelf's credibility — the entire brand promise — outweighs any single affiliate click.

### 7. Privacy & compliance (the personal shelf) — extends docs/02 §8

The catalog and PAO rules are non-personal; **the user's shelf is health-inference data** — what someone owns reveals skin conditions, concerns, and even pregnancy (via product types). So the shelf:
- is **owner-only RLS** (docs/02 §8; the docs/01 §3 pattern), downstream of the **health-data-collection consent** taken before the quiz (docs/01 §4);
- stores **product thumbnails on-device by default** (`thumbnail_path` local), consistent with the photo-privacy posture (docs/01 §3); cloud only on the same explicit opt-in;
- treats **replenishment/affiliate as data *sharing*** — product data goes to an affiliate/attribution partner **only** after the **separate, distinct MHMDA data-sharing consent** (docs/01 §4); the **contribute-back** to Open Beauty Facts sends *product* data (barcode, label, INCI), **never** the personal shelf/profile;
- is **never sold** (brand promise, spec p4), is included in the GDPR Art. 20 **export** (docs/01 §4), and is removed on account deletion (cascade, docs/01 §4).

*Whether the shelf's product mix constitutes additional special-category inference to disclose in the DPIA is a question for counsel — log under BLOCKERS (B-PRIVACY).* 

### 8. Offline & sync

The shelf must work in a bathroom with no signal (docs/01 §6): **view** the cached shelf; **add manually** (queued); **barcode lookups queue** when offline and enrich on reconnect; **contribute-back** queues. The data layer is TanStack Query + a persisted mutation queue (DECISIONS **D-007**); writes are idempotent and last-write-wins is safe (single-user). The local **catalog mirror** caches matched products so previously-seen items resolve offline.

### 9. Engineering / implementation notes

- **Barcode scanning:** `react-native-vision-camera` + a barcode frame processor (docs/00 §1/§4), on-device; honour **one OBF call per real scan**; cache matches into the local catalog mirror. Yuka-grade scan reliability is the bar (SkinSort's is weaker) — invest in fast acquisition, good low-light handling, and forgiving framing.
- **OCR:** on-device ML Kit Text Recognition / Apple Vision → tokenise → match `ingredients`/`ingredient_synonyms` (docs/02); always confirmable/editable (INCI OCR is error-prone).
- **Contribute-back:** an authenticated OBF POST (`code` + credentials + fields), queued and offline-tolerant, with a validation gate; ODbL source attribution shown on catalog data.
- **New schema summary:** the `user_products` additive columns + `shelf_scans`; suggested DECISIONS **D-022/023/024**; BLOCKER ties — **B-DERM-REVIEW** (PAO category defaults) and **B-PRIVACY** (data-sharing consent for replenishment).
- **PostHog instrumentation** (docs/01 §7): `product_add_started` (safe `source` bucket), `product_added` (with `added_via`), `barcode_scanned`, `scan_matched` / `scan_no_match`, `opened_date_set`, `product_finished` / `_discarded`, `replenishment_nudge_shown` / `_tapped`, `affiliate_link_tapped`. Wire the **scan→add** funnel as a shelf activation metric.
- **Performance:** the `(user_id, status, expiry_computed)` index powers the Expiring filter/sort; recompute conflicts (`detect_conflicts`, docs/02) on any shelf change so the banner and "paired" badges stay current; the badge computation is pure and client-cached for offline.

---

## Seven-Figure Validation (the shelf & the money)

The Smart Shelf is a king-making feature because it sits at the intersection of activation, retention, and commerce:

- **The scan is an activation magic-moment, and scanning is proven mass behaviour.** Yuka's ~80M users and ~6M products were built on the scan; the scan→add action is fast, tactile, and immediately rewarding — the shelf's analogue to the first check-off (docs/01 §7) as a leading activation signal.
- **The shelf is the input to everything monetisable.** Personalisation, conflict detection (docs/02), and routine building (docs/03) all depend on knowing what the user owns — so a well-populated shelf is the precondition for the value the paywall sells.
- **It is the compounding switching cost.** A fully-digitised cabinet — products, opened-dates, PAO, repurchase history — is expensive to recreate elsewhere; combined with the routine and the photo timeline, it is the data lock-in behind annual retention (RevenueCat: ~44% one-year on annual vs ~17% monthly, docs/01 §9).
- **Replenishment is a recurring-value and affiliate surface, made honest by PAO.** Beauty repeat-purchase runs **25–35%** (higher with replenishment); skincare is inherently replenishable; ShopMy has facilitated **$500M+** in sales with an OAuth API and a 30-day cookie (docs/00 §5). PAO/expiry gives an honest reason to surface a replacement, preserving trust while opening a commerce line — gated behind the data-sharing consent.
- **The wedge is under-served.** Yuka/EWG have no shelf; SkinSort organises and logs but has **no PAO/expiry** and a weaker scanner; HadaBuddy AI-generates from your shelf but doesn't do PAO/replenishment; Think Dirty does lists. **Nobody does the smart cabinet — opened-dates + PAO/expiry + replenishment — combined with conflict-resolved cycling, privacy-first, and the data lock-in.** And the category mood is moving toward exactly this: trust, longevity, and "what do I do with what I already own" (the HadaBuddy use case), inside a ~**$169.9bn** skincare market (Euromonitor, docs/03).

**Verdict: yes — the Smart Shelf is a seven-figure, king-of-the-category feature.** It is the data engine that makes the rest of the app valuable, the lock-in that retains, and a recurring commerce surface. The risks are **data coverage** (mitigated by the search/OCR/manual fallbacks and the contribute-back loop) and **staying honest and claim-safe** (mitigated by non-alarmist PAO copy, opt-in/consented replenishment, and cosmetic-chemist sign-off of the defaults) — not demand.

---

## Synthesis

**(a) What it is:** the user's digital cabinet and the system's product-data capture engine — intake, PAO/expiry, source-of-truth for what the user owns, and the launch point for replenishment. Scoped narrowly against docs/02 (catalog/logic) and docs/03 (routine).

**(b) Data model:** extends docs/01 `user_products` (additive columns for provenance, lifecycle, on-device thumbnail, and the unopened state) plus a small `shelf_scans` intake/contribute-back log; owner-only RLS throughout.

**(c) PAO/expiry science & rules:** two axes (efficacy + safety), honestly graded (efficacy universal; contamination proportionate; eye/SPF the exceptions); EU PAO vs US-none → a sourcing waterfall (label/catalog → category default → honest unknown) with provenance recorded; `expiry_computed = least(printed, opened+PAO)`, validated by the SPF "3 wks left" example; conservative category defaults under B-DERM-REVIEW.

**(d) Intake funnel:** scan (hero) → search → OCR → manual, every edge case handled, all converging on the opened-date linchpin; unknown products contributed back to Open Beauty Facts (ODbL), one API call per scan.

**(e) Surfaces:** the Shelf list (title/count, All/Actives/Expiring, calm conflict banner, cards, scan FAB), the badge taxonomy (date/countdown/paired/expired/unknown), and the product-detail management hub (freshness, actives, conflicts, usage, lifecycle actions) — all light-mode, calm, claim-safe, accessible, localised.

**(f) Replenishment:** an honest PAO-triggered, opt-in, claim-safe surface that can route to ShopMy behind the data-sharing consent — a recurring-value and affiliate line that preserves trust.

**(g) Privacy & offline:** health-inference data → owner-only RLS, on-device thumbnails, sharing only on the separate MHMDA consent; full offline view + manual-add + queued lookups/contribute-back.

**(h) Composition & confidence:** the shelf consumes docs/02 (catalog/engine/PAO), feeds docs/03 (routine source), and connects forward to doc #7 (replenishment reminders) and doc #10 (ShopMy); PAO defaults and the replenishment/affiliate path are the items most needing review (B-DERM-REVIEW, B-PRIVACY).

---

## Recommendations

1. **Build the scan-first intake with robust fallbacks and the contribute-back loop.** Treat the scan as a hero activation moment; never let any path dead-end — search, OCR, and manual must always be one tap away, and one API call per real scan must be honoured.
2. **Capture `opened_at` at intake — it is the linchpin.** Make the "When did you open it?" moment calm and skippable, support an explicit unopened state, and always treat the resulting expiry as an estimate (DECISIONS D-022).
3. **Populate PAO via the waterfall and be honest when unknown.** Record `pao_source`/`expiry_source` provenance (D-023); never fabricate a precise date; use printed expiry for sunscreen.
4. **Keep PAO non-alarmist and get the category defaults signed off.** "Time to replace," not "dangerous"; the eye/SPF exceptions are the only places to lean firmer; the default table is a **B-DERM-REVIEW** item.
5. **Ship the calm Shelf surfaces and badge taxonomy exactly as the spec draws them** — title/count, All/Actives/Expiring, the clay resolution-first banner, the five badge states, the scan FAB — and invest in **Yuka-grade scan reliability**.
6. **Make the product detail the management hub** — freshness with provenance, actives, the conflicts the product is in, where it's used, and the full lifecycle actions — with finishing/discarding archiving (not deleting) to preserve history and lock-in.
7. **Treat replenishment as honest help, opt-in, and consented.** PAO-triggered, claim-safe, routed to ShopMy only behind the separate MHMDA data-sharing consent; never manufacture urgency (D-024-adjacent; B-PRIVACY).
8. **Store product thumbnails on-device by default** (D-024) and keep the shelf owner-only RLS, consistent with the privacy-as-trust positioning.
9. **Make the shelf fully offline-capable** — view, manual-add, and queued lookups/contribute-back — on the TanStack Query + persisted-queue layer (D-007).
10. **Instrument the scan→add funnel in PostHog** as a shelf activation metric, alongside opened-date capture, finishes, and replenishment taps.

---

## Caveats (confidence flags)

- **Expiry science is two-axis, and the safety axis must be framed proportionately.** Efficacy loss is universal and high-confidence; contamination danger is real but, for products only slightly past PAO with no visible change, usually low — **eye-area products and sunscreen are the exceptions**, and PAO is a conservative, manufacturer-set guide, not a hard cliff. Keep copy honest and non-alarmist. *High confidence on efficacy; medium on per-product danger; design deliberately non-alarmist.*
- **The category-default PAO numbers are starting positions for cosmetic-chemist review** (B-DERM-REVIEW); real values depend on formulation and packaging (airless pumps extend, jars/droppers shorten). *Medium confidence; re-confirm at review.*
- **PAO data coverage is structurally patchy** — the US mandates no PAO/expiry, and Open Beauty Facts coverage is uneven — so the fallbacks and the honest "estimated/unknown" state are essential, not optional, and a precise date must never be fabricated. *High confidence on the constraint.*
- **`opened_at` is self-reported and frequently unknown,** so every expiry is an estimate and must be communicated as one; the unopened state must be handled explicitly. *High confidence.*
- **Open Beauty Facts coverage varies by market and carries ODbL obligations** (source attribution, no co-mingling of non-free data, contribute-back), and the **one-call-per-scan** rule must be respected; scan match rates will vary by region. *High confidence on constraints; medium on match rates.*
- **OCR of INCI lists is genuinely hard** (small fonts, curved/reflective packaging) — treat it as a best-effort fallback that always allows manual correction and never blocks. *Medium confidence.*
- **Barcode scan reliability is a competitive bar** (Yuka sets it high; SkinSort is weaker) and depends on on-device camera performance, which can't be fully verified in this environment — re-verify `vision-camera` barcode performance on real devices. *Medium confidence pending device testing.*
- **Replenishment and affiliate must stay claim-safe, opt-in, and behind the separate MHMDA data-sharing consent;** never manufacture urgency or imply safety-necessity outside the genuine eye/SPF cases. The data-sharing consent for replenishment is effectively a launch gate (B-PRIVACY). *High confidence on the requirement.*
- **Affiliate economics and the post-Epic external-commission landscape are in flux** (docs/00 §5); the ShopMy integration and its monetisation should be revisited as that settles. *Medium confidence.*
- **The competitive set moves fast** — SkinSort organises/logs, HadaBuddy scans-your-shelf into an AI routine, Think Dirty does lists, and ingredient-scanner apps are crowded — so the wedge must remain the **opened-date + PAO/expiry + replenishment** combination fused with conflict-resolved cycling, privacy-first, and the data lock-in. *Medium confidence.*
- **The shelf is health-inference data,** so its RLS isolation, the on-device thumbnail default, and the consents are load-bearing; the data-sharing consent for replenishment is the key new privacy obligation this document introduces. *High confidence.*
