# Document 4: The Smart Shelf — Build Spec

_The personal product inventory · barcode / search / OCR / manual intake · the opened-date linchpin · PAO & expiry intelligence · the Shelf surfaces, badges & calm conflict banner · the product-detail management hub · product lifecycle · replenishment · privacy._

> This is build-order document **#4** of the 15 named in docs/00 (§"Build order", item 4: _"Smart shelf (PAO/expiration)"_). It is the user's **digital cabinet** and the product-data **capture engine** of the whole app. It _extends_ the `user_products` table defined in docs/01 §3, and it _operationalises_ the PAO/expiry intelligence, the catalog tables, and the badge taxonomy already specified in **docs/02 §6 and §7** — it does **not** re-derive them. It renders the **Shelf screen** (spec p11–12) and the entire add-to-shelf flow, it is the **product source** the routine builder (docs/03) reads from, it feeds the conflict engine (docs/02 `detect_conflicts`), and it is where **replenishment** begins — which later connects to the reminders surface (doc #7) and the ShopMy affiliate integration (doc #10). The scan is, alongside the first check-off, one of the two highest-leverage actions a new user can take.

---

## TL;DR

> **Current implementation boundary (2026-07-18):** barcode decoding, reviewed-catalog lookup/search, manual intake, opened-date/PAO editing, and explicit recovery are source candidates. The label route can capture a reference photo and accepts user-typed or pasted INCI text, but no native text-recognition adapter currently converts that photo into text. The scan match card currently confirms catalog identity/source quality; it does not yet show parsed actives or a catalog-derived PAO. Ambiguous-match selection and non-beauty classification/confirmation are also unimplemented. Treat the richer OCR, result-card, and classification descriptions below as target behavior until source, native-device, and human evidence prove them.

- **The Smart Shelf is intended to be the product-data capture engine, with barcode intake as a candidate activation moment.** Products can currently enter by reviewed-catalog scan/search or manual intake; the label path is capture-assisted manual text until native OCR exists. PAO/expiry lives on the Shelf, and downstream conflict/routine logic reads the stored products. Competitor adoption suggests that scanning can reduce intake friction, but OnSkin must measure scan-to-save activation, repeat use, and retention in a consented beta before claiming that this behavior or switching cost transfers to this app.

- **Scope is deliberately narrow against docs/02.** docs/02 owns the **catalog** (`products`, `ingredients`, `product_ingredients`, `ingredient_pao_defaults`) and the **PAO _logic_** (the `expiry_computed` waterfall, the category-default table, the badge _taxonomy_). Document 4 owns the **shelf _feature and experience_** — the intake flows and all their edge cases, the Shelf screens, the product-detail management hub, the product lifecycle, and replenishment. The rule of thumb: **docs/02 decides what a product _is_ and when it expires; doc 4 decides how the user _adds, sees, manages, and replaces_ it.**

- **Skincare genuinely expires, on two distinct axes — and the shelf must be honest, not alarmist, about both.** _Efficacy:_ active ingredients degrade (vitamin C oxidises within weeks, retinol breaks down, SPF UV-filters lose protection, antioxidants/peptides/ceramides decline) — this is the **universal** concern. _Safety:_ preservative systems weaken over time, allowing microbial contamination (_Pseudomonas_, _Staphylococcus_, _Candida_), with documented infections — but for a product only _slightly_ past its PAO **with no visible, textural, or smell change, the safety risk is usually low** (INKEY; CosmeticsInfo's "when in doubt, throw it out"). The genuinely higher-stakes exceptions are **eye-area products and sunscreen** (AAD/CosmeticsInfo flag eye products; SPF efficacy is safety-critical). Product consequence: the shelf says **"time to replace,"** never _"expired — dangerous."_

- **PAO is EU/UK law; the US (FDA) mandates neither expiry nor PAO — so the data is patchy and the shelf must degrade gracefully.** Under **EU Reg (EC) 1223/2009, Article 19 / Annex VIIIa**, a product with an unopened shelf life **> 30 months** is exempt from a best-before date and must instead carry the **open-jar PAO symbol** ("12M", "24M"); a product with shelf life **≤ 30 months** must carry an expiry/best-before date; single-dose, airless/sealed, and inherently-stable products are exempt. The **US FDA does not require expiration dating or PAO on cosmetics** (sunscreens excepted, as OTC drugs). The result: EU/UK products often have PAO data, US products frequently have none — so the shelf must fall back **label/catalog PAO → category default → honest "estimated / unknown,"** and **never fabricate a precise date.**

- **`opened_at` is the linchpin of the whole feature — and the hardest datum to get — so capture it at intake.** PAO only starts counting at first opening, and docs/01's generated column is `expiry_computed = least(expiry_date, opened_at + pao_months)`. Without `opened_at`, there is no PAO clock. Every intake path therefore ends with a calm **"When did you open it?"** (Just opened it / Pick a date / Not opened yet), with an honest "not sure? we'll estimate" path. Unopened products show an estimated _shelf_ life, not a PAO countdown.

- **Intake is a multi-path funnel with scan first and explicit fallbacks.** Barcode decoding happens on-device, then the app queries **OnSkin's reviewed catalog** → match → opened-date → save. No barcode, search, or correction is sent to Open Beauty Facts (OBF) at runtime. Current fallbacks are **Search** the same catalog → **capture a label as a reference and type/paste its INCI text** → **Add manually** (the always-works path). Unknown/new products remain user-local and can create an owner-scoped OnSkin missing-product report; they are not published externally. Ambiguous-match and non-beauty classification remain target behavior, not current claims.

- **The Shelf surfaces are calm, evidence-graded, and exactly as the spec draws them.** Title + count, **All / Actives / Expiring** filter chips, the **clay, resolution-first conflict banner** (never red; absent when all-clear), product cards with the PAO/expiry **badge taxonomy** (future-date / countdown / "paired" / expired / unknown), and the **"Scan a barcode"** FAB (spec p12). Tapping a card opens the **product-detail management hub** — full active breakdown, PAO/expiry with its source, the conflicts the product is part of, the routines it's used in, and the lifecycle actions (mark opened, edit opened-date, mark finished/discarded, replace, remove).

- **Commercial hypothesis, not a revenue verdict:** a well-populated Shelf could support activation, retention, and an optional replenishment surface because it supplies product context to the rest of the app. That thesis remains unvalidated for OnSkin. Catalog coverage, scan reliability, user willingness to maintain opened dates, professional review, commerce consent, partner approval, conversion, retention, and unit economics are all material risks. No feature or market statistic establishes a seven-figure outcome.

---

## Key Findings

1. **The shelf is the product-data capture engine, and scan-to-save is an activation hypothesis.** Everything downstream — the conflict engine (docs/02), the routine builder (docs/03), personalisation, and replenishment — depends on knowing what the user owns. Other products demonstrate familiarity with barcode scanning, but only OnSkin beta telemetry can establish acquisition speed, match rate, completion, repeat use, or retention impact here.

2. **Skincare expires on two axes, and the honest framing is a trust asset.** _Efficacy_ loss is universal and is the primary, defensible reason to track freshness (vitamin C, retinol, SPF, peptides all degrade; AAD; Leslie Baumann MD; INKEY). _Safety_ (preservative decline → microbial contamination) is real and documented, **but** for products only slightly past PAO with no visible change the risk is usually low, and the genuinely higher-stakes exceptions are **eye-area products and sunscreen**. The shelf should be useful and calm ("time to replace"), never alarmist — consistent with the spec's "evidence-graded, never alarmist" mandate (p12).

3. **PAO is an EU/UK regulatory construct; the US has no equivalent — so PAO data is structurally incomplete.** EU Reg 1223/2009 Art. 19: shelf life >30 months → open-jar PAO symbol; ≤30 months → expiry date; exemptions for single-dose/sealed/stable products. US FDA mandates neither for cosmetics (sunscreens excepted). The shelf must therefore source PAO via a waterfall and degrade to an honest "unknown," recording **which source** each value came from.

4. **`opened_at` is both the most important and the least reliable datum, so it must be captured deliberately and treated as an estimate.** PAO counts from first opening; `expiry_computed = least(expiry_date, opened_at + pao_months)` (docs/01 §3). Capture `opened_at` at intake with a calm, skippable prompt; support an **unopened** state (no PAO clock, show estimated shelf life); and always communicate the computed date as an estimate, because the input is self-reported.

5. **The category-default PAO numbers are well-supported starting positions — and need cosmetic-chemist sign-off.** Validated, conservative defaults (Leslie Baumann MD; Image Skincare; INKEY): vitamin C serum **3–6 mo** (oxidises fast; brown = toss), retinol/benzoyl-peroxide **~6 mo**, mascara/liquid-eye **3–6 mo**, water-based serum/toner **6–12 mo**, moisturiser tube **12 mo** / jar **6–9 mo** (finger contamination), oils/anhydrous balms **12–24 mo**, cleanser **~12 mo**, **sunscreen → use printed expiry** (OTC drug). These extend docs/02 §6's table and are a **B-DERM-REVIEW** item (formulation/packaging change the real numbers — airless pumps extend life, jars shorten it).

6. **Data sourcing is an offline, exact-artifact release process with hard constraints.** A candidate OBF export/snapshot can be transformed only after a detached approval manifest binds the source URL/date, exact SHA-256, projected fields, attribution surface, database-component separation, and named review. The importer performs no network I/O. The [current Product Opener API documentation](https://openfoodfacts.github.io/openfoodfacts-server/api/) identifies v3 as current and v2 as deprecated; OnSkin calls neither version at runtime. The [source license guide](https://openfoodfacts.github.io/openfoodfacts-server/api/tutorials/license-be-on-the-legal-side/) distinguishes database, individual-content, and image rights, so OBF images stay disabled. Whether the exact OBF component is a derivative or collective database, and which attribution/share-alike/offer-of-data duties apply, remain counsel decisions under [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/). Coverage gaps make **search/OCR/manual fallbacks essential, not optional.** Ingredient parsing uses an equivalently reviewed offline CosIng component (docs/02).

7. **Barcode frame decoding is designed to stay on-device, and scan reliability is a release gate.** The current `expo-camera` integration sends the decoded package identifier—not a camera frame or image—to the first-party catalog request. The UI therefore says **“Decoding happens on your device”** rather than implying that the entire lookup is local. Physical-iPhone traffic inspection and camera QA must verify that behavior before it becomes a store claim.

8. **The shelf is health-inference data and must be owner-only and on-device-friendly.** What a person owns reveals skin conditions, concerns, and even pregnancy (via product types) — so the shelf is downstream of the health-data-collection consent (docs/01 §4), is RLS-isolated per user (docs/02 §8), stores product thumbnails **on-device by default**, and is never sold, shared, or used to train AI (brand promise, spec p4).

9. **Replenishment is a real retention and monetisation surface — and PAO makes the trigger honest.** Beauty repeat-purchase rates run **25–35%** (higher with replenishment/subscription), repeat buyers spend materially more, and replenishables "keep commissions flowing." A tracked PAO or printed expiry date, or a unit the user marked finished, gives an **honest** reason to offer replacement help rather than manufactured urgency. The nudge can route to **ShopMy** (docs/00 §5: OAuth API, 30-day cookie, $500M+ facilitated) **only behind the separate MHMDA data-sharing consent** (docs/01 §4) and with claim-safe copy.

10. **The proposed differentiation is managed opened-date/PAO context plus routine integration, not an uncontested-market claim.** Competitor features and positioning change quickly, and their implementation quality cannot be inferred from marketing pages alone. Re-run the competitive review before launch and validate whether users value this combination; do not publish “nobody does this,” scanner-quality comparisons, or category-leadership claims without dated substantiation and legal review.

---

## Details

### 1. What the Smart Shelf is — and is not (scope & philosophy)

**It is** the user's personal product inventory and the system's product-data capture surface. Concretely, the shelf:

- is the **intake point** — every product enters here (scan / search / OCR / manual), and intake captures the data the rest of the app needs (catalog link, parsed actives, concentration, `opened_at`, PAO);
- is the **source of truth for what the user owns** — the routine builder (docs/03) draws its steps from `user_products`, and the conflict engine (docs/02 `detect_conflicts`) runs over the shelf;
- is the **home of PAO / expiry** — the place freshness is surfaced and managed;
- is the **launch point for replenishment** — when a tracked PAO/printed expiry is near or past, or the user marks a unit finished.

**It is not**, and these boundaries are load-bearing:

- the **catalog** — docs/02 owns `products`/`ingredients`/`product_ingredients`/`ingredient_pao_defaults` and the PAO _logic_; the shelf _reads and applies_ them.
- the **conflict rules** — docs/02 owns the matrix and `detect_conflicts`; the shelf _renders_ their results (the banner, the "paired" badge) and _triggers_ recomputation on change.
- the **routine** — docs/03 consumes the shelf; the shelf does not sequence or schedule.
- a **diagnostic or claims surface** — the shelf never diagnoses, never makes drug claims, and never alarms. PAO is a **guide, not a cliff**; copy is claim-safe and calm ("time to replace," "may be past its best"), per docs/02 §7.7 and §9.

**Scope boundary (docs/02 §6 ↔ doc 4), stated crisply:**

| Concern                                                    | Owned by docs/02 (§6/§7) | Owned by doc 4 (here)         |
| ---------------------------------------------------------- | ------------------------ | ----------------------------- |
| The catalog (products, ingredients, tags, PAO defaults)    | ✔                        | reads                         |
| `expiry_computed` waterfall + category-default table       | ✔ (logic)                | applies + presents            |
| Badge _taxonomy_ (date/countdown/paired/expired)           | ✔ (defined)              | renders + thresholds + states |
| Conflict rules + `detect_conflicts`                        | ✔                        | triggers + renders            |
| **Intake flows** (scan/search/OCR/manual) + edge cases     | —                        | ✔                             |
| **Shelf screens** (list, detail, add-flow)                 | sketched (§7.1/7.5)      | ✔ (full)                      |
| **Product lifecycle** (unopened/active/finished/discarded) | —                        | ✔                             |
| **Replenishment**                                          | —                        | ✔                             |

### 2. Data model — extends docs/01 `user_products` + docs/02 catalog

**Recap of the existing `user_products` (docs/01 §3) — unchanged, the spine of the shelf:**
`id`, `user_id`, `catalog_product_id NULL FK` (→ docs/02 `products`), manual fallbacks `manual_name` / `manual_brand`, `barcode`, `opened_at date`, `pao_months int`, `expiry_date date`, and the generated column `expiry_computed date GENERATED ALWAYS AS (least(expiry_date, opened_at + (pao_months || ' months')::interval)) STORED`, plus `status text` (active/finished/discarded). Owner-only RLS; indexed on `user_id`, `catalog_product_id`.

**Extensions this feature needs** (additive columns plus a device-local reconnect queue; they do **not** redefine the table):

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

-- Migration 0059 retires the historical raw account-linked scan log. It is
-- neither analytics nor a reconnect queue: existing rows are purged, every
-- API policy/grant is removed, and the compatibility relation is force-RLS
-- sealed. Bounded scan-funnel analytics contain outcome buckets only.
delete from public.shelf_scans;
drop policy if exists "shelf_scans_select_own" on public.shelf_scans;
drop policy if exists "shelf_scans_insert_own" on public.shelf_scans;
drop policy if exists "shelf_scans_update_own" on public.shelf_scans;
drop policy if exists "health_processing_read_fence" on public.shelf_scans;
alter table public.shelf_scans enable row level security;
alter table public.shelf_scans force row level security;
revoke all on table public.shelf_scans from public, anon, authenticated, service_role;

-- Offline lookup recovery instead uses the encrypted, account-bound
-- `routinekind.catalog.lookupQueue.v1` device record: normalized barcode, optional
-- local Shelf row id, bounded retry state, seven-day logical expiry, and a
-- minimal reviewed candidate. Its bytes are purged on the next activation,
-- read/export, or lifecycle cleanup; OS suspension/termination can delay that
-- physical purge. It is deleted on withdrawal/account cleanup and cannot
-- mutate a Shelf row until the user explicitly accepts the candidate.
-- user_products already has owner-only RLS per docs/01; the new columns inherit it.
create index on public.user_products (user_id, status, expiry_computed);  -- for the Expiring filter/sort
```

> **Decision-log notes (DECISIONS.md):** **D-022** — `opened_at` is captured at intake and an explicit **`is_opened` unopened state** is supported (no PAO clock until opened); **D-023** — every `user_products` row records `pao_source`/`expiry_source` provenance so the UI can be honest about estimates; **D-024** — product **thumbnails are stored on-device by default** (`thumbnail_path` local), cloud only on the same opt-in that governs progress photos (docs/01 §3). Anything touching the **data-sharing** consent for replenishment/affiliate belongs in **BLOCKERS.md** (see §6/§7).

### 3. PAO / expiry intelligence (the science + the rules) — operationalising docs/02 §6

**The two-axis science (validated; honest grading).** Skincare expires in two ways: **efficacy** (active ingredients lose potency — vitamin C oxidises within weeks and browns; retinol degrades, especially with heat/light; SPF UV-filters lose protection; antioxidants/peptides/ceramides decline) and **safety** (preservative systems weaken, permitting microbial growth — _Pseudomonas aeruginosa_, _Staphylococcus epidermidis_, _Candida_ — with documented irritation and infections). **Efficacy is the universal, defensible concern.** Safety is real but proportionate: for a product only slightly past PAO **with no visible, textural, or olfactory change, the risk is usually low** (INKEY; CosmeticsInfo's "when in doubt, throw it out"), while **eye-area products and sunscreen are the genuinely higher-stakes exceptions** (AAD/CosmeticsInfo flag eye products; SPF efficacy is safety-critical). The shelf reflects this with **calm, useful, non-alarmist** copy — "time to replace," never "dangerous."

**The regulatory reality and the data gap.** EU Reg 1223/2009 Art. 19 / Annex VIIIa: unopened shelf life **>30 months** → open-jar **PAO** symbol ("12M"); **≤30 months** → expiry/best-before date (hourglass); single-dose, sealed/airless, and inherently-stable products are exempt; PAO must be stability-test-backed. **US FDA mandates neither** expiry nor PAO for cosmetics (sunscreens excepted as OTC drugs). Consequence: PAO data is present for many EU/UK products and absent for many US ones — so the shelf sources it via a waterfall and is honest when it doesn't know.

**The `expiry_computed` walkthrough (docs/01's generated column, applied).** `expiry_computed = least(expiry_date, opened_at + pao_months)` — i.e. **whichever comes first**, the printed expiry or the PAO-from-opening. Three practical consequences:

- **Sunscreen** carries a printed expiry (OTC drug); that printed `expiry_date` will often be **sooner** than `opened_at + pao_months`, so it wins — exactly the spec's **Mineral SPF 50** card showing **"3 wks left"** (opened Aug 2025 + 12-mo PAO would be Aug 2026, but the printed expiry is weeks away, so `least()` surfaces the nearer date). This is the generated column behaving correctly and is the canonical example of why we store both.
- **Unopened** products (`is_opened = false`, `opened_at` null) have **no PAO clock**; the shelf shows an _estimated shelf life_ from `expiry_date` if printed, else a gentle "unopened — estimated shelf life ~N months," never a fabricated PAO countdown.
- **Maya's other cards** all follow `opened_at + pao_months`: Retinol opened Mar + 6-mo PAO → **"Sep 2026"**; Ceramide opened May + 12-mo PAO → **"May 2027"**; Glycolic opened Jan + 12-mo PAO, shown with the **"paired"** badge only once scheduler/routine placement has confirmed the conflict is already resolved (docs/02/03), not because of its date.

**PAO sourcing waterfall (records provenance in `pao_source`):**

1. **Printed / catalog PAO** — `products.default_pao_months` from the label or the curated catalog (docs/02). `pao_source='label'|'catalog'`.
2. **Category default** — `ingredient_pao_defaults` keyed on the product's category. `pao_source='category_default'`.
3. **Honest unknown** — no reliable PAO → `pao_source='unknown'`, show "PAO estimated/unknown," **never invent a precise date.**

**Category-default PAO table (extends docs/02 §6; conservative; B-DERM-REVIEW):**

| Category                             | Default PAO (months)   | Basis / rationale                                                                  |
| ------------------------------------ | ---------------------- | ---------------------------------------------------------------------------------- |
| Vitamin C (L-ascorbic) serum         | **3–6**                | oxidises quickly once opened; browning = degraded (Baumann: ~4 wks once browning)  |
| Retinol / retinoid serum             | **6**                  | breaks down with air/heat/light (Baumann: replace ~2 mo after opening for potency) |
| Benzoyl peroxide / oxidising actives | **6**                  | oxidiser; potency decay                                                            |
| Mascara / liquid eye products        | **3–6**                | eye-area microbial risk (AAD/CosmeticsInfo)                                        |
| Water-based serum / toner            | **6–12**               | preservative-dependent                                                             |
| Moisturiser — tube                   | **12**                 | lower contamination than jars                                                      |
| Moisturiser — jar                    | **6–9**                | finger-dipping contamination                                                       |
| Oil / anhydrous balm                 | **12–24**              | low water activity → slow microbial growth                                         |
| Cleanser (rinse-off)                 | **~12**                | short contact, rinsed                                                              |
| **Sunscreen (SPF)**                  | **use printed expiry** | OTC drug; regulated expiry exists                                                  |

(Final numbers confirmed with the cosmetic chemist; airless/pump packaging extends these, jars/droppers shorten them — log under **B-DERM-REVIEW**.)

**Storage/condition tips (surfaced as gentle guidance, not stored as data).** Heat, steam, and light accelerate degradation; bathrooms are the worst place; airless pumps and clean hands extend life. The shelf may show a one-line tip on a product detail ("Keep this out of the bathroom to help it last") — never alarmist, never a "claim."

**Badge thresholds (operationalising docs/02 §7.6 — see §5.3 for visual detail).** Countdown badge when `expiry_computed` is within a threshold (default **≤30 days**, "N wks/days left," clay); expired/replace when past `expiry_computed` (gentle); future-date when comfortably ahead (neutral month/year); "PAO unknown/est." (quiet) when `pao_source='unknown'`; "paired" when a conflict on this product is already resolved (clay, calm).

### 4. Product intake — the multi-path funnel (the hero flow)

Intake is the most important _how-it-works_ surface in this document. There is **one hero path (scan)** and **three fallbacks**, and **every path ends at the opened-date capture (§4.5)** and writes a `user_products` row.

#### 4.1 Barcode scan (the hero)

1. **Entry:** the **"Scan a barcode"** FAB (spec p12), the onboarding "current products" step (docs/01 §2 step 6), or an empty-shelf prompt.
2. **Camera:** the current `expo-camera` native barcode scanner (docs/00 §4) decodes barcode frames **on-device**, with a clear framing reticle, a steadying hint ("Line up the barcode"), privacy microcopy ("Decoding happens on your device"), a torch toggle, and a selection haptic on a successful read. The decoded identifier is then sent to the first-party catalog service; physical-device traffic proof remains required.
3. **Lookup:** on a decoded barcode, query OnSkin's reviewed catalog service. The service queries only promoted catalog rows and has no OBF/OFF origin, request helper, live-API flag, or external candidate response.
4. **Result card:** the current source confirms product name, brand, and reviewed catalog/source quality before **“Add this.”** Parsed actives and catalog-derived PAO are not currently rendered on this card; adding either requires strict served-field decoding, provenance copy, and UI/device evidence. Product detail and opened-date intake remain the places where available freshness/ingredient context is shown.
5. **Opened-date (§4.5)** → confirm/adjust PAO → **save** to `user_products` (`added_via='barcode'`, `catalog_product_id` set). Emit only a bounded scan-outcome analytics event; never persist the raw barcode in analytics.

**Edge cases (all handled, calmly):**

- **No catalog match** → "We don't have this one yet" → offer **Search catalog**, **capture the ingredient label and type/paste its text**, or **Add manually**, plus an optional owner-scoped **Report missing product** action (§4.6). Never a dead end.
- **Ambiguous / multiple matches (target, not implemented)** → a short disambiguation list (name + brand + size) to pick from. The current strict service contract returns one reviewed match or no match.
- **Unreadable barcode** → "Can't read it? Enter the numbers" (manual barcode) or jump to OCR/manual.
- **No barcode on the product** (common for unboxed minis/samples) → straight to OCR/manual.
- **Offline** → preserve the normalized barcode through manual intake and, after an explicit queue action, store an encrypted account-bound lookup request with a seven-day logical TTL. Encrypted bytes are purged on the next activation, read/export, or lifecycle cleanup; the source does not promise wall-clock physical deletion while the OS suspends or terminates the app. Reconnect may produce a minimal reviewed candidate, but the app must show it for explicit accept/reject; it never silently enriches or overwrites a Shelf row (docs/01 §6).
- **Non-beauty barcode (target, not implemented)** → only after a reviewed category signal or explicit user classification, show a gentle confirmation rather than a safety verdict. The current source does not classify non-beauty products and must not claim this branch exists.

#### 4.2 Search the catalog

Typeahead over OnSkin's reviewed `products` rows (the GIN full-text index, docs/02 §3) by name/brand, biased to the user's locale/market. Select a result → opened-date → save (`added_via='search'`). For the long tail not in the catalog, the search empty-state offers OCR/manual plus an optional OnSkin missing-product report.

#### 4.3 Capture the ingredient list (manual text today; OCR target)

Current source can capture a temporary label photo as a visual reference, then asks the user to type or paste INCI text. The text parser matches that user-confirmed text against the local ingredient vocabulary and carries the editable result into manual intake. The photo is moved to an app-managed cache name; Back, Continue, retake, and capture-failure paths await idempotent deletion, unmount requests cleanup, and a bounded next-launch scavenger recovers managed files left by interruption or termination. The label image is never uploaded. **No ML Kit, Apple Vision, or other native text-recognition adapter is wired today, even if the legacy environment flag is set.** A future on-device OCR adapter must populate editable text only after native QA, retain manual correction, delete temporary imagery, and prove through traffic inspection that neither label imagery nor OCR text is sent to OBF or another undeclared recipient.

#### 4.4 Add manually (the always-works fallback)

A simple form: **name, brand, category** (drives the default PAO), optional **barcode**, optional **ingredients** (free-text → parsed against the catalog for actives), **opened-date**, and **PAO** (auto-filled from the category default, fully editable). This path always succeeds, even fully offline, and is the floor under every other path (`added_via='manual'`).

#### 4.5 The opened-date capture (the linchpin)

Every path converges here. A calm sheet: **"When did you open it?"** with **Just opened it** (sets `opened_at = today`), **Pick a date** (a date picker; sets a past `opened_at` and recomputes), and **Not opened yet** (sets `is_opened=false`, no PAO clock). An honest secondary line — _"Not sure? We'll estimate from when you added it."_ The PAO value is shown and **editable** here (pre-filled from the source waterfall, §3), with its source labelled. This single screen is what makes every expiry estimate downstream meaningful; it is worth a dedicated, friction-light moment.

#### 4.6 Missing-product and correction path (OnSkin only)

Any no-match, OCR-built, or manually entered product remains user-local. With health-data collection authority current, the user may submit an owner-scoped missing-product or wrong-match report to OnSkin's correction queue. The report is minimized to the fields required for review, remains subject to deletion/withdrawal controls, and is never forwarded automatically or manually by the app to OBF. The legacy `contributed_back` field and contribution queue remain inert and cannot be enabled by environment flags. ODbL does not become an assumed user-data transmission mandate: counsel must classify the exact OBF database use and approve whatever attribution, share-alike, or offer-of-data operations actually apply. Any future proposal to make a source a runtime recipient is a new privacy/legal/architecture decision, not this flow.

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

- **Future date** (neutral) — stacked **month/year** ("Sep 2026", "May 2027"); shown when `expiry_computed` is comfortably ahead (beyond the countdown threshold). Greige text on paper. _Information, not warning._
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

Identical pattern to the PM routine banner: **clay tint not red**, a small dot, a verb-first calm subhead that states the **resolution** ("Use them on alternate nights"), one quiet action ("Review →"). Only scheduler-backed contexts may claim actual placement. It appears only when there's a noteworthy/unresolved interaction across the shelf; the reassurance variant (docs/02 §7.8) appears when two products the evidence _clears_ are added (a quiet positive note).

#### 5.6 Product detail (the management hub) — tap a card

The shelf's deepest screen and the place product management happens. Top to bottom:

- **Header** — product name (Instrument Serif), brand (mono), the thumbnail (tap to add/replace an on-device photo), and source-specific attribution in fine print. Only an approved OBF-derived row is labeled OBF, with its reviewed attribution URL and snapshot date; curated/user-local rows retain their own provenance.
- **Freshness block** — **opened date** (editable inline), **PAO** (editable, with its `pao_source` labelled honestly), the computed **expiry** (`expiry_computed`, with `expiry_source`), and the current **status**. For unopened items, a "Mark as opened" affordance that starts the PAO clock.
- **What it contributes** — the **actives** this product brings (tags + concentration band from docs/02), in plain, claim-safe language.
- **Conflicts & pairings** — any interactions this product is part of, rendered calmly ("Timing note with your glycolic toner — use on alternate nights. Review →") with a link to the conflict detail (docs/02 §7.3); positive pairings surfaced as reassurance. Use "paired" language only when scheduler/routine placement has confirmed the interaction is handled.
- **Where it's used** — the routines/steps this product appears in (docs/03), so the user sees its role.
- **Lifecycle actions** — **Mark opened** / **Edit opened-date** / **Mark finished** / **Mark discarded** / **Replace / replenish** (§6) / **Remove**. Destructive actions confirm; finishing/discarding archives (keeps history), removing deletes.
- **Microcopy** — claim-safe throughout; freshness phrased as "best used by," "may be past its best," "time to replace."

#### 5.7 Lifecycle states & transitions

`unopened (is_opened=false)` → **active** (`status='active'`, `opened_at` set, `is_opened=true`) → **finished** or **discarded** (`status` set, `finished_at` recorded). Finished/discarded products move to a calm **archive** (not deleted) — preserving repurchase history and the data lock-in, and powering "you've repurchased this 3 times" and replenishment. The main list shows only `active`. Each transition animates calmly (fade), with a selection haptic; nothing celebratory or alarming.

#### 5.8 Empty, sparse, loading & error states

**Empty shelf** — a warm illustration-light prompt: "Add your first product — scan a barcode, or add it by hand." **Sparse** (1–2 products) — the same calm tone, plus a gentle nudge toward completing the routine's missing roles (claim-safe, e.g. "A daily SPF would round out your mornings"). **Loading** — skeleton cards. **Errors** — OnSkin catalog/network errors degrade to the manual path, never a hard wall; a quiet "Couldn't reach the product catalog — you can still add it by hand."

#### 5.9 Microcopy, motion, haptics, accessibility, localisation (extends docs/02 §7.7)

- **Microcopy:** claim-safe (cosmetic verbs only), calm (no "danger/warning/avoid"), evidence-honest (say "estimated" when it is), resolution-first.
- **Motion:** subtle fades, the clay highlight for attention; respect Reduce Motion; no bouncy/gamified animation anywhere on the shelf.
- **Haptics:** selection ticks on chips, card taps, and lifecycle actions; nothing alarming on an expiry or conflict.
- **Accessibility:** badges carry **text, not colour alone** (a colour-blind user must read "3 wks left," not infer it from clay); 44pt targets; VoiceOver focus lands on the screen title on entry and announces card state ("Mineral SPF 50, 3 weeks left"); Dynamic Type reflow (no fixed-height text containers).
- **Localisation:** externalise all copy (badges, PAO labels, lifecycle actions) for ~30% string expansion and RTL (docs/01 §8); dates and month abbreviations localise.

### 6. Replenishment (the recurring-value + monetisation surface) — claim-safe, opt-in

**The honest trigger.** When a product's tracked PAO or printed expiry date nears `expiry_computed`, is past it, or the user marks the unit **finished**, the shelf can surface a calm **"time to replace"** prompt. The app does not infer remaining quantity from elapsed time. The _notification_ for this lives in the reminders surface (doc #7), defaults off, and is gated by explicit `notification_preferences.replenishment_alerts` opt-in (docs/01 §3); in-app, it appears as a quiet badge/action on the card and detail.

**The flow.** Prompt → product detail **"Replace"** → either **re-add the same product** (one tap, resets `opened_at` on the new unit) or **see equivalents** (suggested via the actives/category, docs/02; claim-safe "similar options") → optionally an **affiliate link**. Affiliate routing uses **ShopMy** (docs/00 §5: OAuth API, 30-day cookie + 30-day return window, $500M+ facilitated) **only** behind the separate **MHMDA data-sharing consent** (docs/01 §4) — and any attribution SDK is preceded by ATT priming (docs/01 §8). Amazon Associates/Skimlinks/Sovrn are fallbacks (docs/00 §5).

**Why it matters (economics).** Beauty repeat-purchase rates run **25–35%** (higher with replenishment/subscription), repeat buyers spend materially more than first-timers, and "replenishables keep commissions flowing." Skincare is a repeat-purchase category, and tracked PAO/expiry plus explicit finished history makes the shelf the _natural, non-spammy_ place to offer replacement help.

**Boundaries (non-negotiable).** Never manufacture urgency; never imply a product _must_ be replaced for **safety** except the genuine eye/sunscreen cases; keep all copy claim-safe (docs/02 §9); replenishment and affiliate are **opt-in** and behind the data-sharing consent. The shelf's credibility — the entire brand promise — outweighs any single affiliate click.

### 7. Privacy & compliance (the personal shelf) — extends docs/02 §8

The catalog and PAO rules are non-personal; **the user's shelf is health-inference data** — what someone owns reveals skin conditions, concerns, and even pregnancy (via product types). So the shelf:

- is **owner-only RLS** (docs/02 §8; the docs/01 §3 pattern), downstream of the **health-data-collection consent** taken before the quiz (docs/01 §4);
- stores **product thumbnails on-device by default** (`thumbnail_path` local), consistent with the photo-privacy posture (docs/01 §3); cloud only on the same explicit opt-in;
- treats **replenishment/affiliate as data _sharing_** — product data goes to an affiliate/attribution partner **only** after the **separate, distinct MHMDA data-sharing consent** (docs/01 §4); OBF is not a runtime recipient, and barcode, label, INCI, shelf, profile, and correction data are never sent there by the app;
- is **never sold** (brand promise, spec p4), is included in the GDPR Art. 20 **export** (docs/01 §4), and is removed on account deletion (cascade, docs/01 §4).

_Whether the shelf's product mix constitutes additional special-category inference to disclose in the DPIA is a question for counsel — log under BLOCKERS (B-PRIVACY)._

### 8. Offline & sync

The shelf must work in a bathroom with no signal (docs/01 §6): **view** the cached shelf, **add manually**, and explicitly queue an OnSkin-catalog barcode lookup for reconnect. There is no third-party source lookup, report queue, or contribution queue. A correction report intentionally retains actionable identity and therefore requires a separate online user submission with inline failure recovery. The lookup queue is encrypted, health-consent and account-bound, limited to 64 unique normalized barcodes, marks entries ineligible after a seven-day logical TTL, uses bounded exponential backoff, and stores only a minimal reviewed candidate. Encrypted bytes are physically purged on the next activation, queue read/maintenance, local export, or account/consent lifecycle cleanup; mobile OS suspension or termination can delay that purge beyond the logical deadline. When an account owner is verified, local export removes foreign-owner residue before reading the exact-owner snapshot; a verified unclaimed local store preserves validated live records. Reconnect never mutates `user_products`: Shelf exposes the candidate, compares it with current user-entered details, and requires an explicit accept or reject. Acceptance revalidates the exact first-party product; catalog identity is opt-in, while ingredients and freshness are always preserved. Shelf creation uses a stable per-submission operation UUID so an uncertain retry cannot duplicate a row. Rejection removes the reviewed candidate immediately; acceptance removes it only after the confirmed Shelf save succeeds. Final retention wording and legal treatment remain open for qualified privacy/legal review. The data layer remains TanStack Query plus purpose-specific persisted queues (DECISIONS **D-007**).

### 9. Engineering / implementation notes

- **Barcode scanning:** `expo-camera` native barcode scanning (docs/00 §1/§4), on-device; query only OnSkin's reviewed catalog. Yuka-grade scan reliability is the bar (SkinSort's is weaker) — invest in fast acquisition, good low-light handling, duplicate suppression, UPC-E expansion, and forgiving framing.
- **OCR:** not implemented. The current route is label-photo-assisted manual text plus local token parsing. Any future ML Kit/Apple Vision adapter must remain confirmable/editable and pass native privacy, accuracy, failure, and temporary-file deletion QA before enablement or marketing.
- **Corrections:** owner-scoped missing/wrong-match reports stay inside OnSkin's reviewed correction workflow. No source credential, OBF POST, environment flag, or queue may publish them externally. Show approved source attribution on each derived catalog row.
- **New schema summary:** the `user_products` additive columns; migration `0059` purges and seals legacy `shelf_scans`; reconnect recovery lives in the encrypted account-bound device queue and requires user confirmation. Suggested DECISIONS **D-022/023/024**; BLOCKER ties — **B-DERM-REVIEW** (PAO category defaults) and **B-PRIVACY** (data-sharing consent for replenishment).
- **PostHog instrumentation** (docs/01 §7): `product_add_started` (safe `source` bucket), `product_added` (with `added_via`), `barcode_scanned`, `scan_matched` / `scan_no_match`, `opened_date_set`, `product_finished` / `_discarded`, `replenishment_nudge_shown` / `_tapped`, `affiliate_link_tapped`. Wire the **scan→add** funnel as a shelf activation metric.
- **Performance:** the `(user_id, status, expiry_computed)` index powers the Expiring filter/sort; recompute conflicts (`detect_conflicts`, docs/02) on any shelf change so the banner and "paired" badges stay current; the badge computation is pure and client-cached for offline.

---

## Commercial Hypothesis And Validation Plan

The Smart Shelf could contribute to activation, retention, and optional commerce, but source completeness and competitor scale do not establish business impact for OnSkin:

- **Test scan-to-save as an activation hypothesis.** Measure permission acceptance, successful decode, eligible match, opened-date completion, save completion, time-to-value, and seven-/thirty-day retention in a consented beta. Do not call it a magic moment until those cohorts support the claim.
- **The shelf is the input to everything monetisable.** Personalisation, conflict detection (docs/02), and routine building (docs/03) all depend on knowing what the user owns — so a well-populated shelf is the precondition for the value the paywall sells.
- **Retention is plausible, not proven.** A maintained cabinet may increase continuity, but it may also impose upkeep. Measure Shelf maintenance, corrections, archive/re-add behavior, churn reasons, and incremental retention without describing user data as “lock-in.”
- **Replenishment is a recurring-value and affiliate surface, made honest by PAO.** Beauty repeat-purchase runs **25–35%** (higher with replenishment); skincare is inherently replenishable; ShopMy has facilitated **$500M+** in sales with an OAuth API and a 30-day cookie (docs/00 §5). PAO/expiry gives an honest reason to surface a replacement, preserving trust while opening a commerce line — gated behind the data-sharing consent.
- **Differentiation requires a dated launch review.** Revalidate competitor product behavior, pricing, claims, privacy posture, and geographic availability from primary/current evidence before using comparisons. The working hypothesis is that opened-date/PAO context integrated with a reviewed routine is useful—not that no competitor can offer it.

**Verdict: strategically promising, commercially unproven.** A seven-figure business outcome depends on product-market fit, catalog match quality, permission and scan performance, user trust, retention, pricing, acquisition costs, partner approval, professional review, and operating execution. Search/manual fallbacks and privacy controls reduce specific failure modes; they do not eliminate demand or revenue risk.

---

## Synthesis

**(a) What it is:** the user's digital cabinet and the system's product-data capture engine — intake, PAO/expiry, source-of-truth for what the user owns, and the launch point for replenishment. Scoped narrowly against docs/02 (catalog/logic) and docs/03 (routine).

**(b) Data model:** extends docs/01 `user_products` (additive columns for provenance, lifecycle, on-device thumbnail, and the unopened state). Migration `0059` purges and force-RLS seals the legacy `shelf_scans` compatibility relation; reconnect state is encrypted, account-bound, short-lived device data, and its candidate cannot mutate Shelf state without explicit user acceptance.

**(c) PAO/expiry science & rules:** two axes (efficacy + safety), honestly graded (efficacy universal; contamination proportionate; eye/SPF the exceptions); EU PAO vs US-none → a sourcing waterfall (label/catalog → category default → honest unknown) with provenance recorded; `expiry_computed = least(printed, opened+PAO)`, validated by the SPF "3 wks left" example; conservative category defaults under B-DERM-REVIEW.

**(d) Intake funnel:** scan (hero) → OnSkin catalog search → OCR → manual, every edge case handled, all converging on the opened-date linchpin; unknown products remain local with an optional owner-scoped OnSkin report. No OBF runtime request or contribution occurs.

**(e) Surfaces:** the Shelf list (title/count, All/Actives/Expiring, calm conflict banner, cards, scan FAB), the badge taxonomy (date/countdown/paired/expired/unknown), and the product-detail management hub (freshness, actives, conflicts, usage, lifecycle actions) — all light-mode, calm, claim-safe, accessible, localised.

**(f) Replenishment:** an honest PAO-triggered, opt-in, claim-safe surface that can route to ShopMy behind the data-sharing consent — a recurring-value and affiliate line that preserves trust.

**(g) Privacy & offline:** health-inference data → owner-only RLS, on-device thumbnails, sharing only on the separate MHMDA consent; full offline view + manual add + an explicit encrypted OnSkin-catalog lookup queue, with no third-party source recipient. Catalog correction reports are separate online, identity-bearing user actions and are never silently queued.

**(h) Composition & confidence:** the shelf consumes docs/02 (catalog/engine/PAO), feeds docs/03 (routine source), and connects forward to doc #7 (replenishment reminders) and doc #10 (ShopMy); PAO defaults and the replenishment/affiliate path are the items most needing review (B-DERM-REVIEW, B-PRIVACY).

---

## Recommendations

1. **Build the scan-first intake with robust fallbacks and the OnSkin correction loop.** Treat the scan as a hero activation moment; never let any path dead-end — reviewed-catalog search, OCR, and manual must always be one tap away. Keep OBF absent from the runtime network graph.
2. **Capture `opened_at` at intake — it is the linchpin.** Make the "When did you open it?" moment calm and skippable, support an explicit unopened state, and always treat the resulting expiry as an estimate (DECISIONS D-022).
3. **Populate PAO via the waterfall and be honest when unknown.** Record `pao_source`/`expiry_source` provenance (D-023); never fabricate a precise date; use printed expiry for sunscreen.
4. **Keep PAO non-alarmist and get the category defaults signed off.** "Time to replace," not "dangerous"; the eye/SPF exceptions are the only places to lean firmer; the default table is a **B-DERM-REVIEW** item.
5. **Ship the calm Shelf surfaces and badge taxonomy exactly as the spec draws them** — title/count, All/Actives/Expiring, the clay resolution-first banner, the five badge states, the scan FAB — and invest in **Yuka-grade scan reliability**.
6. **Make the product detail the management hub** — freshness with provenance, actives, the conflicts the product is in, where it's used, and the full lifecycle actions — with finishing/discarding archiving (not deleting) to preserve history and lock-in.
7. **Treat replenishment as honest help, opt-in, and consented.** PAO-triggered, claim-safe, routed to ShopMy only behind the separate MHMDA data-sharing consent; never manufacture urgency (D-024-adjacent; B-PRIVACY).
8. **Store product thumbnails on-device by default** (D-024) and keep the shelf owner-only RLS, consistent with the privacy-as-trust positioning.
9. **Make the shelf fully offline-capable** — view, manual add, and an explicitly queued OnSkin-catalog lookup — on the TanStack Query + persisted-queue layer (D-007), with no external source publication. Keep identity-bearing correction reports as separate online actions with visible failure recovery.
10. **Instrument the scan→add funnel in PostHog** as a shelf activation metric, alongside opened-date capture, finishes, and replenishment taps.

---

## Caveats (confidence flags)

- **Expiry science is two-axis, and the safety axis must be framed proportionately.** Efficacy loss is universal and high-confidence; contamination danger is real but, for products only slightly past PAO with no visible change, usually low — **eye-area products and sunscreen are the exceptions**, and PAO is a conservative, manufacturer-set guide, not a hard cliff. Keep copy honest and non-alarmist. _High confidence on efficacy; medium on per-product danger; design deliberately non-alarmist._
- **The category-default PAO numbers are starting positions for cosmetic-chemist review** (B-DERM-REVIEW); real values depend on formulation and packaging (airless pumps extend, jars/droppers shorten). _Medium confidence; re-confirm at review._
- **PAO data coverage is structurally patchy** — the US mandates no PAO/expiry, and Open Beauty Facts coverage is uneven — so the fallbacks and the honest "estimated/unknown" state are essential, not optional, and a precise date must never be fabricated. _High confidence on the constraint._
- **`opened_at` is self-reported and frequently unknown,** so every expiry is an estimate and must be communicated as one; the unopened state must be handled explicitly. _High confidence._
- **Open Beauty Facts coverage varies by market, and ODbL treatment depends on the exact database use.** Keep imports offline, hash-bound, image-free, and component-separated; counsel must classify the result and approve attribution/share-alike/offer-of-data duties before promotion. Runtime lookup and contribution are excluded. Scan match rates will vary by region. _High confidence on source constraints; medium on match rates; legal classification pending._
- **OCR of INCI lists is genuinely hard** (small fonts, curved/reflective packaging) — treat it as a best-effort fallback that always allows manual correction and never blocks. _Medium confidence._
- **Barcode scan reliability is a competitive bar** (Yuka sets it high; SkinSort is weaker) and depends on on-device camera performance, which can't be fully verified in this environment — re-verify the `expo-camera` scanner, supported symbologies, torch, duplicate suppression, and UPC-E/UPC-A behavior on physical iPhones. _Medium confidence pending device testing._
- **Replenishment and affiliate must stay claim-safe, opt-in, and behind the separate MHMDA data-sharing consent;** never manufacture urgency or imply safety-necessity outside the genuine eye/SPF cases. The data-sharing consent for replenishment is effectively a launch gate (B-PRIVACY). _High confidence on the requirement._
- **Affiliate economics and the post-Epic external-commission landscape are in flux** (docs/00 §5); the ShopMy integration and its monetisation should be revisited as that settles. _Medium confidence._
- **The competitive set moves fast** — SkinSort organises/logs, HadaBuddy scans-your-shelf into an AI routine, Think Dirty does lists, and ingredient-scanner apps are crowded — so the wedge must remain the **opened-date + PAO/expiry + replenishment** combination fused with conflict-resolved cycling, privacy-first, and the data lock-in. _Medium confidence._
- **The shelf is health-inference data,** so its RLS isolation, the on-device thumbnail default, and the consents are load-bearing; the data-sharing consent for replenishment is the key new privacy obligation this document introduces. _High confidence._
