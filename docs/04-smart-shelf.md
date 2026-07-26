# Document 4: The Smart Shelf — Build Spec

_The personal product inventory · barcode / search / OCR / manual intake · the opened-date linchpin · PAO & expiry intelligence · the Shelf surfaces, badges & calm conflict banner · the product-detail management hub · product lifecycle · replenishment · privacy._

> This is build-order document **#4** of the 15 named in docs/00 (§"Build order", item 4: _"Smart shelf (PAO/expiration)"_). It is the user's **digital cabinet** and the product-data **capture engine** of the whole app. It _extends_ the `user_products` table defined in docs/01 §3, and it _operationalises_ the PAO/expiry intelligence, the catalog tables, and the badge taxonomy already specified in **docs/02 §6 and §7** — it does **not** re-derive them. It renders the **Shelf screen** (spec p11–12) and the entire add-to-shelf flow, it is the **product source** the routine builder (docs/03) reads from, it feeds the conflict engine (docs/02 `detect_conflicts`), and it is where **replenishment** begins — which later connects to the reminders surface (doc #7) and the ShopMy affiliate integration (doc #10). The scan is, alongside the first check-off, one of the two highest-leverage actions a new user can take.

---

## TL;DR

> **Current implementation boundary (2026-07-18):** barcode decoding, reviewed-catalog lookup/search, manual intake, opened-date/PAO editing, and explicit recovery are source candidates. Shelf Scan and Shelf OCR now share a CAT-06 foreground/focus, fresh-permission, camera-ready, keyed-remount, and generation-bound operation lifecycle. When the iOS permission prompt causes `inactive`, its request result is invalidated and the camera remains closed until a fresh foreground query. The label route has a staging-only Apple Vision source candidate that converts a temporary local photo into bounded, editable text; development and production keep native OCR disabled, and manual typing remains the floor. This is not signed-archive or physical-device proof. The retained CAT-04/CAT-05 deterministic web packets predate the lifecycle change and are stale until regenerated; even fresh web evidence cannot prove native camera behavior. The scan match card currently confirms catalog identity/source quality; it does not yet show parsed actives or a catalog-derived PAO. Ambiguous-match selection and non-beauty classification/confirmation are also unimplemented. Treat unverified camera/OCR, richer result-card, and classification behavior as target behavior until exact-build and physical-device evidence pass.

> **CAT-07 freshness boundary (2026-07-19):** strict physical-package date, label-or-catalog PAO, disabled future category-estimate, and unknown provenance; explicit replacement opening state; and authenticated byte-preserving local v1→v2 handling are source candidates only. Integrated source/static-policy verification, qualified chemistry/legal review, hosted migration/RLS/live-catalog evidence, refreshed E2E, and signed-build physical-iPhone storage/relaunch/accessibility/notification evidence remain open. See `docs/hugeToDo/CAT-07-SHELF-FRESHNESS-SOURCE-CHECKPOINT-2026-07-19.md`.

> **Current CORE-05 replay boundary (2026-07-26):** CAT-07's freshness
> semantics remain the product-content contract, but its local v1→v2 note is
> predecessor history. The current encrypted Shelf record is strict schema v3:
> canonical products, stable lowercase UUID-v4 identities, a FIFO mirror
> outbox, bounded terminal receipts, and explicit incompatibilities. Historical
> schemas never fabricate a missing delete or other replay. Migration `0069`
> separates mutable `user_products` content from deletion-wins
> `shelf_product_identities`, seals direct Shelf/completion mutation behind
> owner-derived health/account-fenced RPCs, and lets completion replay wait for
> stable product identity. Shelf drains before completion. This is source-level
> replay and export work, not proof of hosted two-device convergence, native
> storage durability, withdrawal cleanup, or App Store readiness. See
> [the CORE-05 source checkpoint](hugeToDo/CORE-05-ADHERENCE-SOURCE-CHECKPOINT-2026-07-26.md).

- **The Smart Shelf is intended to be the product-data capture engine, with barcode intake as a candidate activation moment.** Products can currently enter by reviewed-catalog scan/search or manual intake; the internal staging label path has a bounded Apple Vision candidate with editable review, while every build retains manual text recovery and production remains disabled. PAO/expiry lives on the Shelf, and downstream conflict/routine logic reads the stored products. Competitor adoption suggests that scanning can reduce intake friction, but OnSkin must measure scan-to-save activation, repeat use, and retention in a consented beta before claiming that this behavior or switching cost transfers to this app.

- **Scope is deliberately narrow against docs/02.** docs/02 owns the **catalog** (`products`, `ingredients`, `product_ingredients`, product-specific PAO evidence, and future category metadata) and the freshness truth table: a date recorded/reconfirmed from this physical package, explicit label PAO, reviewed catalog PAO, disabled future catalog-linked category estimate, or unknown. A product-level catalog expiry date has no lot/package binding and never enters Shelf. Migration `0060` purges, force-RLS seals, and prevents repopulation of legacy `ingredient_pao_defaults`; Shelf never reads it. Document 4 owns the **shelf _feature and experience_** — intake and its edge cases, Shelf screens, product-detail management, lifecycle, replacement, and replenishment. docs/02 determines the evidence semantics; doc 4 determines how the user adds, sees, manages, and replaces a unit.

- **The Shelf reports label/catalog freshness evidence; it does not diagnose product efficacy, contamination, or safety.** Formulation, packaging, storage, and use conditions differ, so the app must not infer potency loss, microbial growth, infection risk, or a special eye/SPF safety exception from elapsed time alone. User-facing copy identifies the source and says only what the evidence supports: a physical-package date, an opened-date-plus-reviewed-PAO date, or no known date. Approximate category estimates are future-gated and unavailable in the launch candidate.

- **Freshness labeling is jurisdiction- and classification-specific.** [EU Regulation (EC) No 1223/2009](https://eur-lex.europa.eu/eli/reg/2009/1223/oj), Article 19(1)(c), governs minimum durability and PAO; the open-jar symbol is Annex VII point 2. The [FDA does not require expiration dates for ordinary cosmetics](https://www.fda.gov/cosmetics/cosmetics-labeling/shelf-life-and-expiration-dating-cosmetics), and its [OTC-drug guidance allows an omitted printed date when stability supports at least three years](https://www.fda.gov/drugs/understanding-over-counter-medicines/sunscreen-how-help-protect-your-skin-sun). [Health Canada classifies sunscreens as non-prescription drugs or natural health products by active ingredient](https://www.canada.ca/en/health-canada/services/sun-safety/sunscreens.html). None of those rules establishes a universal printed sunscreen date. The Shelf records actual evidence and otherwise remains unknown.

- **`opened_at` is required only for a PAO clock, and the unopened choice is explicit.** Every intake and replacement path asks the user to choose **Just opened it**, an exact past date, or **Not opened yet**. Unopened products have no PAO clock: a real printed date can still display, but an unopened unit without one remains unknown and receives no app-derived shelf-life estimate.

- **Intake is a multi-path funnel with scan first and explicit fallbacks.** Barcode decoding happens on-device, then the app queries **OnSkin's reviewed catalog** → match → opened-date → save. No barcode, search, or correction is sent to Open Beauty Facts (OBF) at runtime. Current fallbacks are **Search** the same catalog → **capture a label as a reference and type/paste its INCI text** → **Add manually** (the always-works path). Unknown/new products remain user-local and can create an owner-scoped OnSkin missing-product report; they are not published externally. Ambiguous-match and non-beauty classification remain target behavior, not current claims.

- **The Shelf surfaces are calm, evidence-graded, and exactly as the spec draws them.** Title + count, **All / Actives / Expiring** filter chips, the **clay, resolution-first conflict banner** (never red; absent when all-clear), product cards with source-specific future-date, countdown, "paired," expired, estimated, and unknown states, and the **"Scan a barcode"** FAB (spec p12). Tapping a card opens the **product-detail management hub** — full active breakdown, PAO/expiry with its source, the conflicts the product is part of, the routines it's used in, and the lifecycle actions (mark opened, edit opened-date, mark finished/discarded, replace, remove).

- **Commercial hypothesis, not a revenue verdict:** a well-populated Shelf could support activation, retention, and an optional replenishment surface because it supplies product context to the rest of the app. That thesis remains unvalidated for OnSkin. Catalog coverage, scan reliability, user willingness to maintain opened dates, professional review, commerce consent, partner approval, conversion, retention, and unit economics are all material risks. No feature or market statistic establishes a seven-figure outcome.

---

## Key Findings

1. **The shelf is the product-data capture engine, and scan-to-save is an activation hypothesis.** Everything downstream — the conflict engine (docs/02), the routine builder (docs/03), personalisation, and replenishment — depends on knowing what the user owns. Other products demonstrate familiarity with barcode scanning, but only OnSkin beta telemetry can establish acquisition speed, match rate, completion, repeat use, or retention impact here.

2. **Freshness is an evidence-reporting surface, not a product-safety or efficacy determination.** The source of a date matters more than a generic product-category narrative. The launch Shelf does not infer potency, contamination, infection risk, or a product-type exception; it surfaces only an explicitly recorded/reconfirmed physical-package date, a reviewed PAO computation, or unknown. A visibly approximate category estimate is future-gated and unavailable until the exact retained-marker, database, and named-review gates close.

3. **Freshness data is structurally incomplete across jurisdictions and classifications.** EU Article 19(1)(c) and Annex VII point 2 govern minimum durability/PAO. Ordinary U.S. cosmetics generally lack a required printed expiration date, and U.S./Canadian sunscreen labeling depends on the applicable drug or NHP framework. The Shelf records the exact source and degrades to unknown, never a jurisdiction-derived assumption.

4. **`opened_at` and physical-package dates must be captured deliberately.** PAO counts from first opening; capture an explicit opened/unopened choice at intake and again for a replacement unit. An unopened item has no PAO clock. Shelf `label` is reserved for direct product-label entry; reviewed catalog-delivered label/brand-label/catalog rows persist as Shelf `catalog`, while historical ambiguous label copy stays actor-neutral. A PAO-computed date must name the label or reviewed catalog PAO behind it. Only a date explicitly entered or reconfirmed from this package can become actionable `printed`; catalog product expiry rows stay outside Shelf.

5. **No category number is launch-approved merely because it sounds conservative.** A category fallback may be activated only when a qualified cosmetic chemist reviews the exact rule, it is linked to a reviewed catalog category, and a bounded server-attested projection gives the client enough authority to validate it. The current catalog payload does not, so category-only intake fails to `unknown`. Once that stronger path exists, the value is surfaced as `estimated`, remains distinct from `unknown`, and cannot drive countdown, expired, or replenishment state. Sunscreen receives no numeric category fallback.

6. **Data sourcing is an offline, exact-artifact release process with hard constraints.** A candidate OBF export/snapshot can be transformed only after a detached approval manifest binds the source URL/date, exact SHA-256, projected fields, attribution surface, database-component separation, and named review. The importer performs no network I/O. The [current Product Opener API documentation](https://openfoodfacts.github.io/openfoodfacts-server/api/) identifies v3 as current and v2 as deprecated; OnSkin calls neither version at runtime. The [source license guide](https://openfoodfacts.github.io/openfoodfacts-server/api/tutorials/license-be-on-the-legal-side/) distinguishes database, individual-content, and image rights, so OBF images stay disabled. Whether the exact OBF component is a derivative or collective database, and which attribution/share-alike/offer-of-data duties apply, remain counsel decisions under [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/). Coverage gaps make **search/OCR/manual fallbacks essential, not optional.** Ingredient parsing uses an equivalently reviewed offline CosIng component (docs/02).

7. **Barcode frame decoding is designed to stay on-device, and scan reliability is a release gate.** The current `expo-camera` integration sends the decoded package identifier—not a camera frame or image—to the first-party catalog request. The UI therefore says **“Decoding happens on your device”** rather than implying that the entire lookup is local. CAT-06 source now acquires a generation-bound camera lease before a queued barcode callback can parse, emit derived state, or start lookup work; foreground/focus/permission invalidation makes the callback inert. Physical-iPhone traffic, interruption, Settings, mount/retry, and accessibility inspection must still verify that behavior before it becomes a store claim.

8. **The shelf is health-inference data and must be owner-only and on-device-friendly.** What a person owns reveals skin conditions, concerns, and even pregnancy (via product types) — so the shelf is downstream of the health-data-collection consent (docs/01 §4), is RLS-isolated per user (docs/02 §8), stores product thumbnails **on-device by default**, and is never sold, shared, or used to train AI (brand promise, spec p4).

9. **Replenishment is a real retention and monetisation surface — and PAO makes the trigger honest.** Beauty repeat-purchase rates run **25–35%** (higher with replenishment/subscription), repeat buyers spend materially more, and replenishables "keep commissions flowing." A tracked PAO or recorded package date, or a unit the user marked finished, gives an **honest** reason to offer replacement help rather than manufactured urgency. The nudge can route to **ShopMy** (docs/00 §5: OAuth API, 30-day cookie, $500M+ facilitated) **only behind the separate MHMDA data-sharing consent** (docs/01 §4) and with claim-safe copy.

10. **The proposed differentiation is managed opened-date/PAO context plus routine integration, not an uncontested-market claim.** Competitor features and positioning change quickly, and their implementation quality cannot be inferred from marketing pages alone. Re-run the competitive review before launch and validate whether users value this combination; do not publish “nobody does this,” scanner-quality comparisons, or category-leadership claims without dated substantiation and legal review.

---

## Details

### 1. What the Smart Shelf is — and is not (scope & philosophy)

**It is** the user's personal product inventory and the system's product-data capture surface. Concretely, the shelf:

- is the **intake point** — every product enters here (scan / search / OCR / manual), and intake captures the data the rest of the app needs (catalog link, parsed actives, concentration, `opened_at`, PAO);
- is the **source of truth for what the user owns on this device** — the
  routine builder and conflict engine read canonical local Shelf-v3 content;
  `user_products` is its mutable server mirror, while
  `shelf_product_identities` preserves only stable server identity/deletion
  state for delayed completion replay;
- is the **home of PAO / expiry** — the place freshness is surfaced and managed;
- is the **launch point for replenishment** — when a trusted printed or label/catalog-PAO date is near or past, or the user marks a unit finished.

**It is not**, and these boundaries are load-bearing:

- the **catalog** — docs/02 owns `products`/`ingredients`/`product_ingredients`, product-specific PAO evidence, future category metadata, and the PAO _logic_; the shelf _reads and applies_ the bounded served result. Legacy `ingredient_pao_defaults` is empty, force-RLS sealed, non-repopulatable, and never an input.
- the **conflict rules** — docs/02 owns the matrix and `detect_conflicts`; the shelf _renders_ their results (the banner, the "paired" badge) and _triggers_ recomputation on change.
- the **routine** — docs/03 consumes the shelf; the shelf does not sequence or schedule.
- a **diagnostic or claims surface** — the shelf never diagnoses, never makes drug claims, and never alarms. PAO is a **guide, not a cliff**; copy is claim-safe and calm ("time to replace," "may be past its best"), per docs/02 §7.7 and §9.

**Scope boundary (docs/02 §6 ↔ doc 4), stated crisply:**

| Concern                                                    | Owned by docs/02 (§6/§7) | Owned by doc 4 (here)         |
| ---------------------------------------------------------- | ------------------------ | ----------------------------- |
| The catalog (products, ingredients, tags, PAO evidence)    | ✔                        | reads                         |
| Freshness truth table + source precedence                  | ✔ (logic)                | applies + presents            |
| Badge _taxonomy_ (date/countdown/paired/expired/estimated/unknown) | ✔ (defined)       | renders + thresholds + states |
| Conflict rules + `detect_conflicts`                        | ✔                        | triggers + renders            |
| **Intake flows** (scan/search/OCR/manual) + edge cases     | —                        | ✔                             |
| **Shelf screens** (list, detail, add-flow)                 | sketched (§7.1/7.5)      | ✔ (full)                      |
| **Product lifecycle** (unopened/active/finished/discarded) | —                        | ✔                             |
| **Replenishment**                                          | —                        | ✔                             |

### 2. Data model — extends docs/01 `user_products` + docs/02 catalog

**Recap of the existing `user_products` content table (docs/01 §3):**
`id`, `user_id`, `catalog_product_id NULL FK` (→ docs/02 `products`), manual fallbacks `manual_name` / `manual_brand`, `barcode`, `opened_at date`, `pao_months int`, `expiry_date date`, and the generated column `expiry_computed date GENERATED ALWAYS AS (least(expiry_date, opened_at + (pao_months || ' months')::interval)) STORED`, plus `status text` (active/finished/discarded). Owner-only RLS; indexed on `user_id`, `catalog_product_id`.

Migration `0069` supersedes the assumption that this mutable row is also the
only identity authority. `shelf_product_identities` retains only `id`,
`user_id`, `created_at`, `deleted_effective_at`, and `deleted_received_at`.
Routine steps reference that stable identity. A delete of missing content
creates or advances a same-owner tombstone; a later upsert cannot resurrect it.
A delayed completion at or before the effective cutoff can reconcile, while a
later completion is terminal. Direct product/routine/step/completion mutation
is revoked from API roles and admitted through the owner-derived sync RPCs.

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

> **Decision-log notes (DECISIONS.md):** **D-022** — `opened_at` is captured at intake and an explicit **`is_opened` unopened state** is supported (no PAO clock until opened); **D-023** — every `user_products` row records `pao_source`/`expiry_source` provenance so printed, label/catalog PAO, reserved future category estimate, and unknown never collapse into one another; **D-024** — product **thumbnails are stored on-device by default** (`thumbnail_path` local), cloud only on the same opt-in that governs progress photos (docs/01 §3). Anything touching the **data-sharing** consent for replenishment/affiliate belongs in **BLOCKERS.md** (see §6/§7).

**Historical CAT-07 v1→v2 boundary and current v3 supersession.** CAT-07
authenticated legacy schema-v1 bytes against their exact canonical form,
decoded them into v2 freshness semantics in memory, and avoided a read-only
rewrite. That behavior remains predecessor evidence. The current Shelf decoder
is strict v3. It retains canonical product content plus FIFO, terminal, and
incompatibility state. Eligible canonical v2 products may receive idempotent
upserts only during an authorized health/account-bound upgrade; historical
records do not invent a delete. Incompatible identifiers or content remain
repair-required instead of being silently normalized into replay. Failed
mutation preserves the prior authenticated bytes. Native encrypted-storage,
relaunch, interruption, process-death, and account-boundary evidence remains
open.

### 3. PAO / expiry intelligence — operationalising docs/02 §6

**Regulatory evidence, not legal clearance.** [EU Regulation (EC) No 1223/2009](https://eur-lex.europa.eu/eli/reg/2009/1223/oj), Article 19(1)(c), requires a minimum-durability date for relevant products and, where minimum durability exceeds 30 months, a PAO indication unless durability after opening is not relevant. The open-jar symbol is Annex VII point 2; Annex VII point 3 is the minimum-durability symbol. The [FDA says ordinary cosmetics have no U.S. expiration-date labeling requirement](https://www.fda.gov/industry/fda-basics-industry/do-i-need-label-my-cosmetics-products-expiration-dates). U.S. sunscreens are OTC drugs, but [an OTC product can omit a printed expiration date when stability testing shows at least three years](https://www.fda.gov/drugs/understanding-over-counter-medicines/sunscreen-how-help-protect-your-skin-sun). [Health Canada classifies sunscreens as non-prescription drugs or NHPs](https://www.canada.ca/en/health-canada/services/sun-safety/sunscreens.html); [drug expiration labeling](https://laws-lois.justice.gc.ca/eng/regulations/C.R.C.%2C_c._870/section-C.01.004.html) and [NHP labeling](https://www.canada.ca/en/health-canada/services/drugs-health-products/natural-non-prescription/legislation-guidelines/guidance-documents/labelling.html) apply by classification. Qualified legal review must approve final territorial copy.

**Freshness truth table.** The app may calculate the earlier actual candidate from a printed date explicitly recorded or reconfirmed from this physical package and an opened-date-plus-PAO date, but it never loses evidence provenance. Product catalog identity does not bind a lot, batch, or package, so a catalog `expiry_date` cannot create this candidate. An exact tie resolves to `printed`.

| Product state and evidence | Stored/surfaced source | Shelf/detail copy | Countdown, expired, or replenishment signal |
| --- | --- | --- | --- |
| Unopened + printed package date | `expiry_source='printed'` | Printed date | Eligible near or past the date |
| Unopened + no printed package date | `expiry_source='unknown'` | Unopened; no known date | Not eligible |
| Opened + winning printed package date | `expiry_source='printed'` | Printed date | Eligible near or past the date |
| Opened + winning explicit label or reviewed catalog PAO | `expiry_source='pao_computed'`; `pao_source='label'|'catalog'` | Opened date + source-specific PAO | Eligible near or past the computed date |
| Opened + externally reviewed catalog-linked category fallback | `expiry_source='estimated'`; `pao_source='category_default'` | Approximate category estimate | Not eligible in the launch candidate |
| No trustworthy candidate | `expiry_source='unknown'` | No known date | Not eligible |

Unknown is not an estimate. A category estimate stays disabled until qualified cosmetic-chemistry review approves the exact rule and catalog linkage. It remains visibly approximate and non-actionable after activation. There is no numeric sunscreen fallback and no assumption that any sunscreen carries a printed date.

Historical v1/catalog-linked dates have ambiguous package origin. Migration to
the current contract retains them in a separate legacy-unverified quarantine
for user reconfirmation; that value never drives a badge, Expiring filter,
recommendation, notification, or replenishment action and is never silently
promoted to `printed`.

**Badge thresholds (operationalising docs/02 §7.6 — see §5.3 for visual detail).** Future-date, countdown, expired, Expiring-filter, and replenishment states can derive only from trusted printed or label/catalog-PAO candidates. A category estimate is reserved for a future reviewed admission path, gets a neutral approximate label only after that path exists, and never drives time-pressure state. Unknown gets no date and no time-pressure state. "paired" remains unrelated conflict-placement status.

### 4. Product intake — the multi-path funnel (the hero flow)

Intake is the most important _how-it-works_ surface in this document. There is
**one hero path (scan)** and **three fallbacks**, and **every path ends at the
opened-date capture (§4.5)** and atomically writes canonical local Shelf-v3
content plus stable replay intent. The later server `user_products` mutation
occurs only through `sync_shelf_product`.

#### 4.1 Barcode scan (the hero)

1. **Entry:** the **"Scan a barcode"** FAB (spec p12), the onboarding "current products" step (docs/01 §2 step 6), or an empty-shelf prompt.
2. **Camera:** the current `expo-camera` native barcode scanner (docs/00 §4) decodes barcode frames **on-device**, with a clear framing reticle, a steadying hint ("Line up the barcode"), privacy microcopy ("Decoding happens on your device"), a torch toggle, and a selection haptic on a successful read. The shared CAT-06 source gate admits one focused/foreground preview only after fresh permission verification and camera-ready, uses a fresh keyed generation after mount failure, and invalidates queued callbacks before barcode parsing when lifecycle authority closes. The decoded identifier is then sent to the first-party catalog service; exact signed-build device and traffic proof remains required.
3. **Lookup:** on a decoded barcode, query OnSkin's reviewed catalog service. The service queries only promoted catalog rows and has no OBF/OFF origin, request helper, live-API flag, or external candidate response.
4. **Result card:** the current source confirms product name, brand, and reviewed catalog/source quality before **“Add this.”** Parsed actives and catalog-derived PAO are not currently rendered on this card; adding either requires strict served-field decoding, provenance copy, and UI/device evidence. Product detail and opened-date intake remain the places where available freshness/ingredient context is shown.
5. **Opened state (§4.5)** → choose opened/unopened and confirm only the freshness
   evidence actually available for this unit (physical-package date
   entered/reconfirmed by the user, explicit label PAO, reviewed catalog PAO,
   or unknown) → **save** to local Shelf v3 with
   `added_via='barcode'`, the reviewed `catalog_product_id`, and its stable
   upsert operation. Never import a product-level catalog expiry date. The
   server content mirror is replayed through `sync_shelf_product`. Emit only a
   bounded scan-outcome analytics event; never persist the raw barcode in
   analytics.

**Edge cases (all handled, calmly):**

- **No catalog match** → "We don't have this one yet" → offer **Search catalog**, **capture the ingredient label and type/paste its text**, or **Add manually**, plus an optional owner-scoped **Report missing product** action (§4.6). Never a dead end.
- **Ambiguous / multiple matches (target, not implemented)** → a short disambiguation list (name + brand + size) to pick from. The current strict service contract returns one reviewed match or no match.
- **Unreadable barcode** → "Can't read it? Enter the numbers" (manual barcode) or jump to OCR/manual.
- **No barcode on the product** (common for unboxed minis/samples) → straight to OCR/manual.
- **Offline** → preserve the normalized barcode through manual intake and, after an explicit queue action, store an encrypted account-bound lookup request with a seven-day logical TTL. Encrypted bytes are purged on the next activation, read/export, or lifecycle cleanup; the source does not promise wall-clock physical deletion while the OS suspends or terminates the app. Reconnect may produce a minimal reviewed candidate, but the app must show it for explicit accept/reject; it never silently enriches or overwrites a Shelf row (docs/01 §6).
- **Non-beauty barcode (target, not implemented)** → only after a reviewed category signal or explicit user classification, show a gentle confirmation rather than a safety verdict. The current source does not classify non-beauty products and must not claim this branch exists.

#### 4.2 Search the catalog

Typeahead over OnSkin's reviewed `products` rows (the GIN full-text index, docs/02 §3) by name/brand, biased to the user's locale/market. Select a result → opened-date → save (`added_via='search'`). For the long tail not in the catalog, the search empty-state offers OCR/manual plus an optional OnSkin missing-product report.

#### 4.3 Capture the ingredient list (manual floor; staging-only OCR candidate)

Current source can capture a temporary label photo as a visual reference and always accepts typed or pasted INCI text. In the internal `staging` profile only, a bounded Apple Vision revision-3 adapter proposes editable Unicode text; a late result cannot overwrite a user edit, uncertainty remains visible in words, and explicit adoption is required for a preserved alternative. The text parser matches only the user-reviewed text against the local ingredient vocabulary and carries it into manual intake. The photo is moved to an app-managed cache name; Back, Continue, retake, and capture-failure paths drain recognition and await idempotent deletion, unmount requests cleanup, and bounded startup recovery covers managed files plus the pre-managed Expo Camera cache window. Development and production keep native OCR disabled. Source and deterministic Expo-web checks do not prove Swift compilation, archive linkage, physical-device privacy, accuracy, latency, accessibility, or cleanup; exact-build traffic and filesystem inspection must still prove that neither label imagery nor OCR text reaches OBF or another undeclared recipient.

CAT-06 additionally keeps the label preview unmounted during review, blocks the
shutter until camera-ready, remounts a fresh generation after mount failure,
and makes late capture work inert when focus, foreground, permission, review,
or navigation invalidates its lease. Permission-query/request and Settings-open
failures have stable manual recovery. The final gate is the exact signed archive
plus both the CAT-05 OCR artifact and the CAT-06 two-iPhone/54-run camera
lifecycle artifact; a Boolean or deterministic browser fixture cannot replace
either.

#### 4.4 Add manually (the always-works fallback)

A simple form: **name, brand, category**, optional **barcode**, optional **ingredients** (free-text → parsed against the catalog for actives), an explicit **opened/unopened state**, optional **printed date**, and an explicit open-jar **PAO** only when the user can confirm it from the label. Manual category selection does not manufacture a PAO. This path always succeeds, even fully offline, and is the floor under every other path (`added_via='manual'`).

#### 4.5 The opened-date capture (the linchpin)

Every intake path converges here. A calm sheet asks **"When did you open it?"** with **Just opened it** (`opened_at = today`), **Pick a date** (a valid past date), and **Not opened yet** (`is_opened=false`, `opened_at=null`, no PAO clock). The app does not substitute add time when the user is unsure. Explicit open-jar PAO can be confirmed here with its source; reviewed catalog PAO remains catalog provenance; a printed package date becomes actionable only after the user enters or reconfirms it from this physical unit; and unknown remains a valid completion state. Product-level catalog expiry rows remain in catalog/correction surfaces. Replacement uses an equivalent explicit opening-state choice rather than silently starting a PAO clock. Confirmation commits the canonical product and stable upsert intent to the encrypted local Shelf-v3 record before UI success; `user_products` changes later only through the `0069` replay RPC.

#### 4.6 Missing-product and correction path (OnSkin only)

Any no-match, OCR-built, or manually entered product remains user-local. With health-data collection authority current, the user may submit an owner-scoped missing-product or wrong-match report to OnSkin's correction queue. The report is minimized to the fields required for review, remains subject to deletion/withdrawal controls, and is never forwarded automatically or manually by the app to OBF. The legacy `contributed_back` field and contribution queue remain inert and cannot be enabled by environment flags. ODbL does not become an assumed user-data transmission mandate: counsel must classify the exact OBF database use and approve whatever attribution, share-alike, or offer-of-data operations actually apply. Any future proposal to make a source a runtime recipient is a new privacy/legal/architecture decision, not this flow.

#### 4.7 First intake from onboarding

The onboarding "current products intake" (docs/01 §2 step 6) is the shelf's first population; **skip must stay visible** (docs/01). Whatever is added there seeds the encrypted local Shelf-v3 content and its stable upsert intent (`added_via='onboarding'`) and immediately feeds the first routine generation ("See my routine," docs/03 §2) and the first conflict pass. The server mirror is replayed later through `sync_shelf_product`; the onboarding route does not directly write `user_products`.

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

Right-aligned, mono. Each state has a precise trigger and tone:

- **Future date** (neutral) — stacked **month/year** ("Sep 2026", "May 2027"); shown only for a trusted printed or label/catalog-PAO candidate comfortably beyond the countdown threshold. Greige text on paper. _Information, not warning._
- **Countdown** (clay) — **"N wks/days left"** only when a trusted printed or label/catalog-PAO candidate is within the threshold (default **≤30 days**). Clay-tinted pill.
- **"paired"** (clay, calm) — when a conflict involving this product is **already resolved** by scheduler or real routine placement (docs/02/03). The conflict engine alone only returns advice; it does not earn the badge. Signals "handled," not "problem." The spec's **Glycolic 7% "paired."**
- **Expired / replace** (gentle) — only when a trusted printed or label/catalog-PAO candidate is past. A calm "Time to replace," never red and never a safety verdict.
- **Estimated** (quiet) — only for an externally reviewed catalog-linked category fallback; explicitly approximate and never countdown/expired/replenishment-eligible.
- **Unknown** (quiet) — no trustworthy date candidate; show no date or estimate and no time-pressure state.

#### 5.4 Filters & sorting

- **All** — the full active shelf (`status='active'`), default.
- **Actives** — products bearing an active tag (retinoid / AHA / BHA / vitamin-C / BP / etc., via docs/02 tags). Useful for "what's potent in my routine."
- **Expiring** — only products whose trusted printed or label/catalog-PAO candidate is countdown/expired (uses the `(user_id, status, expiry_computed)` index). Category estimates and unknowns are excluded.
- **Default sort:** soonest trusted date first within the active set, with reviewed estimates and unknowns sorted last. A secondary **search within shelf** (by name/brand) supports large cabinets.
- Finished/discarded products live in an **archive** view (§5.7), not the main list.

#### 5.5 Conflict banner (calm, reusable — docs/02 §7.2)

Identical pattern to the PM routine banner: **clay tint not red**, a small dot, a verb-first calm subhead that states the **resolution** ("Use them on alternate nights"), one quiet action ("Review →"). Only scheduler-backed contexts may claim actual placement. It appears only when there's a noteworthy/unresolved interaction across the shelf; the reassurance variant (docs/02 §7.8) appears when two products the evidence _clears_ are added (a quiet positive note).

#### 5.6 Product detail (the management hub) — tap a card

The shelf's deepest screen and the place product management happens. Top to bottom:

- **Header** — product name (Instrument Serif), brand (mono), the thumbnail (tap to add/replace an on-device photo), and source-specific attribution in fine print. Only an approved OBF-derived row is labeled OBF, with its reviewed attribution URL and snapshot date; curated/user-local rows retain their own provenance.
- **Freshness block** — **opened state/date** (editable inline), **PAO** with exact `label`, `catalog`, reserved-future `category_default`, or `unknown` provenance, the winning **expiry source** (`printed`, `pao_computed`, reserved-future `estimated`, or `unknown`), and current status. Category estimates are unavailable in the launch candidate; if later admitted they say "approximate", while unknown shows no date. For unopened items, a "Mark as opened" affordance creates a PAO-derived candidate only when an eligible PAO value exists, while retaining its exact source treatment.
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

**The honest trigger.** A calm **"time to replace"** prompt may come only from a near/past trusted printed date, a near/past explicit label or reviewed catalog PAO computation, or a unit the user marked **finished**. Reserved future category estimates and unknown states never trigger it. The app does not infer remaining quantity from elapsed time. The _notification_ lives in the reminders surface (doc #7), defaults off, and is gated by explicit `notification_preferences.replenishment_alerts` opt-in (docs/01 §3); in-app, it appears as a quiet badge/action on the card and detail.

**The flow.** Prompt → product detail **"Replace"** → **re-add the same product** or **see equivalents**. Re-add first requires an explicit opening-state choice: **Just opened it**, an exact past date, or **Not opened yet**. It archives the prior package, creates a new UUID, preserves product identity and PAO provenance, and clears the prior unit's printed date; it never infers the new unit's opening date from purchase or replacement time. Similar options use claim-safe copy and may route to an affiliate only behind the separate **MHMDA data-sharing consent** (docs/01 §4), with any attribution SDK preceded by ATT priming (docs/01 §8).

**Why it matters (economics).** Beauty repeat-purchase rates run **25–35%** (higher with replenishment/subscription), repeat buyers spend materially more than first-timers, and "replenishables keep commissions flowing." Skincare is a repeat-purchase category, and tracked PAO/expiry plus explicit finished history makes the shelf the _natural, non-spammy_ place to offer replacement help.

**Boundaries (non-negotiable).** Never manufacture urgency or imply that elapsed time establishes danger, contamination, infection, or loss of protection. Keep all copy claim-safe (docs/02 §9); replenishment alerts and affiliate sharing are opt-in and behind their applicable consent. Consent is necessary but not sufficient: whether user-initiated affiliate navigation for the selected Shelf item is contextual shopping or sensitive-health-data-targeted advertising remains an unresolved Apple App Review 2.5.18/5.1.2 and privacy-counsel gate. The shelf's credibility outweighs any single affiliate click.

### 7. Privacy & compliance (the personal shelf) — extends docs/02 §8

The catalog and PAO rules are non-personal; **the user's shelf is health-inference data** — what someone owns reveals skin conditions, concerns, and even pregnancy (via product types). So the shelf:

- is **owner-only RLS** (docs/02 §8; the docs/01 §3 pattern), downstream of the **health-data-collection consent** taken before the quiz (docs/01 §4);
- stores **product thumbnails on-device by default** (`thumbnail_path` local), consistent with the photo-privacy posture (docs/01 §3); cloud only on the same explicit opt-in;
- treats **replenishment/affiliate as data _sharing_** — product data goes to an affiliate/attribution partner **only** after the **separate, distinct MHMDA data-sharing consent** (docs/01 §4); OBF is not a runtime recipient, and barcode, label, INCI, shelf, profile, and correction data are never sent there by the app;
- is **never sold** (brand promise, spec p4), is included in the GDPR Art. 20 **export** (docs/01 §4), and is removed on account deletion (cascade, docs/01 §4).

_Whether the shelf's product mix constitutes additional special-category inference to disclose in the DPIA is a question for counsel — log under BLOCKERS (B-PRIVACY)._

### 8. Offline & sync

The Shelf must work in a bathroom with no signal (docs/01 §6): **view** the
canonical local content, **add manually**, and queue a Shelf mirror operation
without waiting for the network. The strict encrypted v3 envelope is the
durability boundary, not a TanStack optimistic cache: one authorized private-KV
transform commits the product and owner-free UUID-v4 upsert/delete operation
before success is published. Its FIFO retains ambiguous network, authorization,
thrown-RPC, or malformed-response outcomes and acknowledges only exact
accepted/idempotent dispositions.

The coordinator sends Shelf through `sync_shelf_product` before dispatching any
completion. Migration `0069` derives owner from Auth, holds the account/
health boundary, and writes mutable content separately from stable identity.
Delete wins even if the original upsert never arrived; same-owner retry is
idempotent and a later upsert cannot resurrect the tombstone. Missing identity
therefore stays retryable for completion. If local Shelf state proves an
unresolved terminal product operation and no corrective Shelf work, the
completion worker may reversibly move only its exact same-routine/date pending
group through the routine-day marker to the FIFO tail. It does not permanently
quarantine correctable intent. A true remote-terminal completion follows the
separate terminal marker-cascade rule described in docs/03.

Catalog lookup recovery is a different queue. It is encrypted,
health-consent/account-bound, limited to 64 unique normalized barcodes, marks
entries ineligible after seven days, and stores only a minimal reviewed
candidate. Physical byte purge waits for the next activation, read/export, or
lifecycle cleanup if the OS suspends the app. Reconnect presents the candidate
for explicit accept/reject and never silently mutates Shelf. Correction reports
remain separate online, identity-bearing submissions with visible failure
recovery; there is no third-party source lookup, report queue, or contribution
queue.

The requesting-device export wrapper is schema v2 and labels the current
pending/terminal local v3 record `shelf_and_sync_state`. Server export schema v4
uses health-lifecycle-fenced owner-derived projections for stable identity and
subject-facing Shelf receipts; raw request bodies and internal
`request_sha256` are excluded. With no safe replay-expiry protocol, minimal
tombstones and receipts remain only for the active account/health purpose and
are erased on withdrawal or account/Auth deletion. Hosted response-loss,
two-user/two-device convergence, native process death, export concurrency,
zero-residue erasure, final retention/legal treatment, and App Review remain
open gates.

### 9. Engineering / implementation notes

- **Barcode scanning:** `expo-camera` native barcode scanning (docs/00 §1/§4), on-device; query only OnSkin's reviewed catalog. Yuka-grade scan reliability is the bar (SkinSort's is weaker) — invest in fast acquisition, good low-light handling, duplicate suppression, UPC-E expansion, and forgiving framing.
- **OCR:** an Apple Vision revision-3 source candidate is enabled only in the internal staging profile. Its text remains confirmable/editable and manual entry remains available. Development and production stay disabled until exact-build CAT-05 privacy/accuracy/latency/accessibility/cleanup evidence and CAT-06 permission/lifecycle/mount/offline evidence pass on both required physical iPhones.
- **Corrections:** owner-scoped missing/wrong-match reports stay inside OnSkin's reviewed correction workflow. No source credential, OBF POST, environment flag, or queue may publish them externally. Show approved source attribution on each derived catalog row.
- **Schema summary:** the `user_products` additive content columns; migration
  `0059` purges and seals legacy `shelf_scans`; CAT-07 supplies strict freshness
  provenance history; current local Shelf state is strict v3; and migration
  `0069` adds deletion-wins `shelf_product_identities`, sealed minimized replay
  receipts, and owner-derived Shelf/completion RPCs. Catalog reconnect recovery
  remains a separate encrypted account-bound device queue requiring user
  confirmation. Suggested DECISIONS **D-022/023/024** remain relevant;
  qualified chemistry/legal review, hosted migration/RLS/catalog/replay
  evidence, final retention/privacy treatment, and **B-PRIVACY** for
  replenishment sharing remain blockers.
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

**(b) Data model:** extends docs/01 `user_products` content with provenance,
lifecycle, on-device thumbnail, and explicit unopened state. Migration `0059`
purges and force-RLS seals legacy `shelf_scans`. CAT-07's canonical v1→v2
freshness handling is predecessor evidence; the current encrypted Shelf record
is strict v3 and preserves products, FIFO replay, terminal receipts, and
incompatibilities. Migration `0069` separates deletion-wins stable identity
from mutable content and seals writes behind owner-derived RPCs. Catalog
reconnect state remains a separate encrypted device queue and cannot mutate
Shelf without explicit acceptance.

**(c) PAO/expiry rules:** a strict truth table preserves printed, explicit label PAO, reviewed catalog PAO, reserved future category estimate, and unknown as distinct states. Only printed or label/catalog PAO evidence may drive countdown, expired, or replenishment UI. The app makes no elapsed-time efficacy, contamination, infection, or special eye/SPF safety determination.

**(d) Intake funnel:** scan (hero) → OnSkin catalog search → OCR → manual, every edge case handled, all converging on the opened-date linchpin; unknown products remain local with an optional owner-scoped OnSkin report. No OBF runtime request or contribution occurs.

**(e) Surfaces:** the Shelf list (title/count, All/Actives/Expiring, calm conflict banner, cards, scan FAB), the badge taxonomy (date/countdown/paired/expired/estimated/unknown), and the product-detail management hub (freshness, actives, conflicts, usage, lifecycle actions) — all light-mode, calm, claim-safe, accessible, localised.

**(f) Replenishment:** an opt-in, claim-safe surface triggered only by trusted printed or label/catalog-PAO evidence, or a user-marked finish, that can route to ShopMy behind the data-sharing consent.

**(g) Privacy & offline:** health-inference data → encrypted local Shelf v3,
owner/account/health-fenced server RPCs, on-device thumbnails, and sharing only
on the separate MHMDA consent. Full offline view/manual add uses the durable
Shelf FIFO; the explicit OnSkin-catalog lookup queue remains separate, with no
third-party source recipient. Local export schema v2 includes
`shelf_and_sync_state`; server schema v4 includes subject-facing stable identity
and receipt fields. Catalog correction reports are separate online,
identity-bearing user actions and are never silently queued.

**(h) Composition & confidence:** the shelf consumes docs/02 (catalog/engine/PAO), feeds docs/03 (routine source), and connects forward to doc #7 (replenishment reminders) and doc #10 (ShopMy); PAO defaults and the replenishment/affiliate path are the items most needing review (B-DERM-REVIEW, B-PRIVACY).

---

## Recommendations

1. **Build the scan-first intake with robust fallbacks and the OnSkin correction loop.** Treat the scan as a hero activation moment; never let any path dead-end — reviewed-catalog search, OCR, and manual must always be one tap away. Keep OBF absent from the runtime network graph.
2. **Capture opening state explicitly at intake and replacement.** Offer today, an exact past date, or unopened; never substitute add/replacement time when the user is unsure (D-022).
3. **Implement the source truth table exactly.** Record `pao_source`/`expiry_source` provenance (D-023), keep unknown separate from reviewed estimate, and never assume a sunscreen has a printed date or numeric PAO.
4. **Keep category estimates non-actionable and externally gated.** No category value activates without qualified chemistry review and reviewed catalog linkage; even then it stays approximate and cannot drive countdown, expired, or replacement messaging.
5. **Ship the calm Shelf surfaces and badge taxonomy exactly as the spec draws them** — title/count, All/Actives/Expiring, the clay resolution-first banner, source-specific badge states, and the scan FAB — and invest in **Yuka-grade scan reliability**.
6. **Make the product detail the management hub** — freshness with provenance, actives, the conflicts the product is in, where it's used, and the full lifecycle actions — with finishing/discarding archiving (not deleting) to preserve history and lock-in.
7. **Treat replenishment as honest help, opt-in, and consented.** Trigger only from trusted printed or label/catalog-PAO evidence or a user-marked finish; route to ShopMy only behind the separate MHMDA data-sharing consent; never manufacture urgency (D-024-adjacent; B-PRIVACY).
8. **Store product thumbnails on-device by default** (D-024) and keep the shelf owner-only RLS, consistent with the privacy-as-trust positioning.
9. **Make the Shelf fully offline-capable** — view and manual mutations persist
   through the strict encrypted Shelf-v3 FIFO before UI success; the explicitly
   queued OnSkin-catalog lookup remains a separate recovery purpose. Drain
   Shelf before completion, preserve deletion-wins identity, and do not claim
   cross-device parity until hosted two-device evidence passes. Keep
   identity-bearing correction reports as separate online actions with visible
   failure recovery and no external source publication.
10. **Instrument the scan→add funnel in PostHog** as a shelf activation metric, alongside opened-date capture, finishes, and replenishment taps.

---

## Caveats (confidence flags)

- **The app is not qualified to infer efficacy, contamination, infection, or safety from elapsed time alone.** Freshness UI must remain an evidence/provenance report and avoid product-type exceptions unless a separately reviewed rule and legal basis support them. _High confidence on the claim boundary; professional review remains pending._
- **Category freshness estimates remain externally gated.** Exact rules need qualified cosmetic-chemistry review and reviewed catalog linkage; they stay approximate and non-actionable after activation. _Launch-blocked pending review._
- **Freshness data coverage is structurally patchy.** Ordinary U.S. cosmetics can lack dates, U.S./Canadian sunscreen duties depend on classification, and catalog coverage varies. Unknown must remain distinct from estimate, and a precise date must never be fabricated. _High confidence on the cited constraints; territorial legal review pending._
- **`opened_at` is self-reported and can be unknown.** A printed date keeps its printed provenance; a PAO computation must name its label/catalog PAO source; unopened without a printed date remains unknown. _High confidence._
- **Open Beauty Facts coverage varies by market, and ODbL treatment depends on the exact database use.** Keep imports offline, hash-bound, image-free, and component-separated; counsel must classify the result and approve attribution/share-alike/offer-of-data duties before promotion. Runtime lookup and contribution are excluded. Scan match rates will vary by region. _High confidence on source constraints; medium on match rates; legal classification pending._
- **OCR of INCI lists is genuinely hard** (small fonts, curved/reflective packaging) — treat it as a best-effort fallback that always allows manual correction and never blocks. _Medium confidence._
- **Barcode scan reliability is a competitive bar** (Yuka sets it high; SkinSort is weaker) and depends on on-device camera performance, which can't be fully verified in this environment — re-verify the `expo-camera` scanner, supported symbologies, torch, duplicate suppression, and UPC-E/UPC-A behavior on physical iPhones. _Medium confidence pending device testing._
- **Replenishment and affiliate must stay claim-safe, opt-in, and behind the applicable notification/data-sharing consent;** never manufacture urgency or imply safety necessity from elapsed time. Consent alone does not resolve whether item-specific affiliate navigation is contextual commerce or prohibited sensitive-data-targeted advertising under Apple 2.5.18/5.1.2. Qualified privacy/App Review classification is a launch gate (B-PRIVACY). _High confidence on the need for review; classification unresolved._
- **Affiliate economics and the post-Epic external-commission landscape are in flux** (docs/00 §5); the ShopMy integration and its monetisation should be revisited as that settles. _Medium confidence._
- **The competitive set moves fast** — SkinSort organises/logs, HadaBuddy scans-your-shelf into an AI routine, Think Dirty does lists, and ingredient-scanner apps are crowded — so the wedge must remain the **opened-date + PAO/expiry + replenishment** combination fused with conflict-resolved cycling, privacy-first, and the data lock-in. _Medium confidence._
- **The shelf is health-inference data,** so its RLS isolation, the on-device thumbnail default, and the consents are load-bearing; the data-sharing consent for replenishment is the key new privacy obligation this document introduces. _High confidence._
