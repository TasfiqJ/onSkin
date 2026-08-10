# Document 10 — Creator Stacks + ShopMy · Build Spec (validation + every-detail implementation notes)

> **2026-07-12 launch-scope update:** The reviewed creator workflow and live
> commerce rail are required for the iOS all-features release. Older deferral
> language is superseded by `docs/hugeToDo/launch-contract.json`; all legal,
> privacy, source, ranking-isolation, operational, and device gates still apply.

> **2026-07-29 COM-01A authority:** The current source checkpoint is
> **literal zero admission**. Mobile/direct routes, catalog and creator-stack
> reads, consent grants, click recording, external navigation, analytics, the
> provider poll, and order attribution are inert and side-effect-free. Only
> refusal, withdrawal, owner deletion, and account data-rights cleanup remain.
> Every positive flow, development stack, retailer row, consent-allow action,
> opaque-token path, provider-poll description, and browser-evidence statement
> below is historical/stale and a future-design candidate only. It does not
> describe current runtime authority. COM-01 through COM-07 remain
> launch-blocked. See the
> [COM-01A checkpoint](hugeToDo/COM-01-COMMERCE-ADMISSION-SOURCE-CHECKPOINT-2026-07-29.md).

> Companion to `docs/10-compass-artifact.md` (the strategic spec). This file is the
> implementation-grade specification: the validated verdict, then **every** detail of
> how the commerce layer works, looks, and feels — minor and major. Authoritative for
> the Doc 10 build slice. All external claims were re-verified by a cited deep-research
> pass on 2026-06-13 (25 claims, 25 confirmed, 0 refuted; primary sources throughout).

---

## 0. The validated verdict (read first)

The verdict below is retained as commercial research, not present-tense build
authority. A future successor must pass the checkpoint's Apple 2.5.18,
3.1.3(e), and 5.1.2(vi); App Privacy/ATT; FTC affiliate, native-advertising,
health-claim, and HBNR; Washington RCW 19.373; Nevada NRS
603A.400-.550; applicable CCPA/CPRA; provider, publication, hosted, native,
and named-review gates. Consent or an opaque token does not cure a prohibited
photo-derived marketing use. No source checkpoint guarantees Apple acceptance,
legal compliance, product-market fit, seven-figure revenue, or any revenue.

**Build it — phased, narrow, rail-agnostic — but as a SIX-figure supplement, not a
seven-figure pillar.** The seven-figure business is the _subscription_ business.

- **Affiliate is optional, not load-bearing.** Yuka reached 7 figures with **zero**
  brand/affiliate revenue — **97.3% of its 2024 $7.37M from subscriptions**
  (yuka.io/en/independence). A trust-first skincare app does **not need** affiliate to
  hit 7 figures. Doc 10 is _upside_, not necessity.
- **The funnel does not reach $1M and its inputs are unverified.** No source validated
  the 15% CTR / 5% conversion / $70 AOV / 17% commission / 3-cycles assumptions; the
  only anchored figure is ShopMy's **beauty commission band 15–25%**. Even the spec's
  own optimistic math tops out at **~$700K/yr at 150K engaged users**. Treat as
  +10–20% on top of subscriptions.
- **The decisive trust condition** is that commission **never enters ranking** — which
  Doc 9 already enforces in code, and which is also the **FTC safe harbor** (paid-for-
  rankings = deceptive; independent ranking + clear disclosure = fine).
- **THE BLOCKING TECHNICAL UNKNOWN (B-SHOPMY):** ShopMy's documented APIs do **not**
  confirm a brand/app can create affiliate links on its **own first-party
  recommendations under a house account.** Link creation lives only in the **OAuth
  Developer API**, scoped _"on behalf of authenticated ShopMy users"_ (individual
  creators, per-user `write_links`); the **Brand Partners API is reporting-only**
  (poll-based `Fetch Order Report`, **no webhooks**, 200 req/day). The whole Doc 10
  primary-rail assumption rests on an unconfirmed capability. **Must be answered by
  ShopMy partnerships before any real link is minted.** → The build is **rail-agnostic**
  at the resolution boundary so we can swap to Skimlinks/Sovrn/direct without
  re-architecting.

---

## 1. Scope of THIS slice (Phase 1 + the 4 designed surfaces)

Build, design-faithfully, with the live money rail **stubbed + inert** (B-SHOPMY):

1. **The "where to buy" affordance** — a quiet section _beneath_ the recommendation
   rationale on the Doc 9 card. (design surface 01)
2. **The shoppable Stack** — an expert/derm-reviewed routine as an ordered, paid-link
   collection. (design surface 02) — Phase 2 concept, UI shipped now with in-house
   curated, launch-gated content.
3. **The transparency page** — the Wirecutter-grade church-and-state explainer.
   (design surface 03)
4. **The MHMDA consent gate** — a separate, distinct opt-in before any commerce
   telemetry leaves the device. (design surface 04)

Plus the **church-and-state commerce schema**, the **opaque-token attribution**, the
**rail-agnostic link resolution** (stubbed), and the **FTC/MHMDA guardrails**.

**NOT in this slice:** Phase 3 hosted creators (behind a future Pro+ tier; deferred
with kill-criteria), the live ShopMy integration (B-SHOPMY), the Order-Report poll
Edge Function beyond a stub (B-SHOPMY), the real catalog/retailer/price data
(B-CATALOG-SEED). Pro+ ($79.99) stays _reserved_, not built.

---

## 2. Design tokens & conventions (unchanged from the series)

Instrument Serif (display) · Hanken Grotesk (UI/body) · IBM Plex Mono (labels/eyebrows
/the "Paid link" chip). Palette: paper `#FAF7F2` · paperRaised `#FFFFFF` · greige
`#EFEAE1` · clay `#A5694B` · clayDeep `#8A5239` · clayTint `#F3E7DF` · ink `#201B15` ·
inkSoft `#4A443B` · muted `#8A8071` · night `#1B1813` (transparency page) · cream
`#F4EFE7` · clayBright `#D9A183` (night accent) · sage `#4F7A4A` (derm-reviewed chip).
8pt grid; calm, advisory, **never a storefront**; **no `react-native-svg`** — geometric
Views + text glyphs; the external-link glyph is `↗`, the "paid link" chip is a greige
mono pill. WCAG 2.2 AA; fit/role indicated by **text, not colour alone**; Dynamic Type
reflow; RTL-ready; externalised copy.

---

## 3. SURFACE 01 — the "where to buy" affordance (extends the Doc 9 rec card)

**Where:** the bottom of `app/recommendations/[id].tsx` (the what/why/how card). It
**replaces** the Doc-9 inert "Where to find it →" link. The rationale (What/Why/How +
evidence + caveat) **always leads**; "where to buy" is **secondary, beneath the
divider**, never competing with the why.

**Two states, gated by the commerce consent (§6):**

- **Consent NOT granted (default):** show a single quiet row — `🔒 Where to buy` (mono
  eyebrow) + one line: _"Turn on where-to-buy links to see partner retailers — a
  separate, private choice."_ + a calm `Allow where-to-buy` text button that opens the
  **consent gate sheet** (§6 / surface 04). No retailer data, no tracking, nothing
  shared. Below it, always: _"Already own one? Add it to your shelf instead"_ (links to
  `/shelf/manual`).
- **Consent granted:** the **"Where to buy" block**:
  - Eyebrow: `WHERE TO BUY` (IBM Plex Mono, 10px, tracked, muted).
  - 1–3 **retailer option rows**, each: a striped greige product thumbnail (26×32,
    `repeating-linear-gradient` placeholder — no real imagery, B-CATALOG-SEED), the
    product/retailer name (13px semibold), a sub line _"at a partner retailer · $34"_
    (11px muted; price is illustrative until B-CATALOG-SEED), then on the right a
    **`Paid link` mono chip** (greige `#F0EBE2` pill, 9px) + the `↗` external glyph.
    Row has a hairline inset border, 12px radius, 11×13 padding.
  - **The FTC disclosure line directly beneath the rows** (never collapsed, always
    visible with the links — 16 CFR 255 "unavoidable"): _"Paid link — Layerwell may earn a
    commission. **It never affects what we recommend.**"_ (the independence clause
    bold-inked). A small `How this works →` opens the transparency page.
  - Footer (unchanged): _"Already own one? Add it to your shelf instead."_
  - **Tapping a retailer row:** fires the opaque-token attribution (§5), records a
    `click_event` (owner-scoped, consented), then **deep-links straight out** to the
    retailer/pin (no in-app webview). No health data leaves the device — only the
    opaque token. Until B-SHOPMY/B-CATALOG-SEED the link is a stub: an honest Alert
    explaining links go live with the catalog + partner approval, sharing nothing.

**Empty/thin-catalog:** when no retailer options resolve (the normal v1 state, no
catalog), show _"We'll show where to buy once our product catalog is live — it never
changes what we recommend."_ (calm, honest). The affordance never fabricates a retailer.

**Replacement/replenish reuse:** the Doc-4 `app/shelf/replenish.tsx` "see similar"
path is upgraded to route through the **same** consent gate + disclosure (it was inert
in Doc 4 pending B-PRIVACY); now it shares the commerce module's gate + copy.

---

## 4. SURFACE 02 — the shoppable Stack (expert/derm-reviewed)

**Where:** `app/commerce/stack/[slug].tsx`, with a calm entry from the For-you hub
(`/recommendations`) and the You tab. List of available stacks at
`app/commerce/stacks.tsx` (or fold a single hero stack into the hub for v1).

**Look & feel (design surface 02):**

- Paper background.
- A **sage "Dermatologist-reviewed" chip** at top-left: sage-tint `#E6ECE0` pill, a
  small sage star glyph `✦`, mono `DERMATOLOGIST-REVIEWED` (10px, sage `#3E6A39`). For
  in-house editorial stacks the chip reads `EDITOR'S ROUTINE` (clay-tint). The chip's
  label is driven by `curator_kind` (`derm` | `editorial` | `creator`).
- Title (Instrument Serif, 29px): e.g. _"The sensitive-skin starter set."_
- Subtitle (13px muted): _"Four products, in order. Curated on merit and evidence — not
  by who pays."_
- **Ordered stack items** (numbered 1..N), each a white card (16px radius, hairline
  inset): a mono index, a striped thumbnail (32×38), the product name (13.5px bold) +
  role/role-note (_"Cleanse · fragrance-free"_, 11px muted), then a **`Paid link` chip +
  `↗`** on the right. Tapping an item → the same attribution + deep-link-out as §3,
  consent-gated.
- **Footer disclosure** (always visible): _"Paid links — Layerwell may earn a commission.
  We picked these on merit; the commission never changed the list."_
- **Trust guarantee in copy + data:** the stack is ordered by the **routine sequence**
  (Doc 3) and curated by merit; it carries **no rate/commission field** in its ordering
  — the order is editorial/clinical, never commission-sorted (church-and-state).

**Launch gate (B-DERM-REVIEW):** stack content is medical-adjacent. Stacks carry
`reviewed_by` (null until clinical sign-off) and a `shippableStacks()` gate mirroring
`shippableRules()` / `shippableRecTypes()` — in production only reviewed stacks show;
in dev the demo stack is available. The starter set's product _items_ reuse the Doc-9
type catalog (type-first; specific products arrive with B-CATALOG-SEED).

---

## 5. ATTRIBUTION & the church-and-state architecture

**Opaque click token (no health data — the trust guarantee, validated by MHMDA):**

- `buildClickToken()` → a random, opaque id (expo-crypto `randomUUID`), tied to **no**
  profile, concern, goal, skin axis, pregnancy status, or photo. It is a bare
  correlation handle for crediting a purchase, nothing more.
- The outbound URL carries **only** the opaque token (+ the retailer/pin). A pure,
  **tested** `buildOutboundUrl()` asserts the URL contains **none** of: `concern`,
  `goal`, `skin`, `acne`, `sensitiv`, `pregnan`, `axis`, `dspt`, `profile`, `photo`,
  `email`, `user` — i.e. **no health-adjacent attribute ever reaches the retailer.**
  This is Doc 10's analogue of Doc 9's "FIT score has no commercial input" guard.

**Rail-agnostic resolution (the B-SHOPMY hedge):**

- `resolveWhereToBuy(productType)` → `WhereToBuyOption[]`, each tagged with a
  `source: 'shopmy' | 'skimlinks' | 'direct' | 'none'`. v1 returns a **stub** (or empty
  when no catalog). The live ShopMy `Search Catalog`/`Create Link` resolution is behind
  B-SHOPMY; because the boundary is source-tagged, swapping rails if the house-account
  model is unworkable is a localised change.

**Church-and-state at the schema level (commerce ≠ ranking):**

- Commerce tables (`affiliate_links`, `click_events`, `order_attributions`,
  `creator_stacks`, `creator_stack_items`) live **downstream**; they join to a product
  only by `product_type`/`catalog_product_id`, **after** ranking.
- **No commission/rate/affiliate field exists in any ranking-path table** (`products`,
  `ingredients`, `recommendations`, the Doc-9 engine). Verified by the Doc-9 church-and-
  state test + a Doc-10 test asserting the ranking modules import no commerce module.
- The ranking code imports **nothing** from `features/commerce/`. One-way only.
- **Note (D-0xx):** the spec's "physically separate Postgres schemas" is satisfied for
  v1 by _module-boundary + column-separation + RLS_ (one Supabase service role; all
  tables in `public`, consistent with the prior 21 migrations). A true separate
  `commerce` Postgres schema is a deferred infra hardening — the load-bearing guarantee
  (no commission in ranking, code can't read it on the ranking path) is delivered now.

**Order ingestion (poll-only — no webhooks exist):**

- The `Fetch Order Report` poll is a **Supabase pg_cron → Edge Function** keyed on
  `recordUpdatedStartDate`, daily, upserting `order_attributions`. v1 ships the schema +
  a fail-closed handler; the live poll still needs the brand API key + approval
  (B-SHOPMY). The documented response has no click-token/click-ID field and no
  commission lifecycle-status field. The adapter therefore keeps `click_token = null`
  and the default `pending` status instead of guessing from `Click Date`, `Code`,
  `Customer Status`, or any other unrelated field. B-SHOPMY remains blocking until
  ShopMy approves a usable correlation and reconciliation contract. The API budget is
  200 requests/day with at most 500 records/page; a full final page is treated as an
  incomplete run, never a false success.

---

## 6. SURFACE 04 — the MHMDA consent gate (separate, distinct, opt-in)

**Where:** `app/commerce/consent.tsx`, a dimmed bottom sheet, shown the **first** time a
user taps anything that would share a commerce signal (a retailer row / "Allow
where-to-buy"). Wired to the **`data_sharing`** consent type (MHMDA "sharing" consent —
the only third-party-sharing consent in the doc-01 enum; recorded with commerce-specific
copy + version, so the ledger proves what was shown).

**Look & feel (design surface 04):**

- Dimmed scrim `rgba(32,27,21,0.42)`; sheet `#FAF7F2`, 32px top radius, grab handle.
- A clay-tint `#F3E7DF` rounded icon box (52×52) with a shield-check glyph.
- Title (Instrument Serif, 29px): _"Before we show where to buy."_
- Body (14px muted): _"Opening a 'where to buy' link shares a single anonymous click
  token with our affiliate partner — so a purchase can be credited. That's it."_
- A two-row white card: ✓ (sage) _"An opaque token tied to no skin data"_ · ✕ (clay)
  **\*"Never** your profile, concerns or photos."\*
- Mono note: _"a separate, revocable choice (MHMDA / GDPR) · decline and links still
  work with zero tracking"_ — wait, **correction**: per MHMDA, if consent is declined,
  we must **not** transmit any tracking. The honest copy is: _"a separate, revocable
  choice (MHMDA / GDPR) · decline and we simply won't show paid links."_ (The design's
  "links still work with zero tracking" implies a non-tracked outbound link is still
  shown; that is defensible ONLY if truly zero data leaves — but the safer, MHMDA-clean
  default is: **no consent → no paid links shown at all**, only the "add to your shelf"
  path. We adopt the stricter reading. This is logged as a DECISION.)
- Primary CTA (clay pill, 54px): _"Allow where-to-buy links"_ → records `data_sharing`
  granted, dismisses, proceeds. Secondary: _"Not now"_ → records nothing, dismisses,
  the affordance stays in its locked state.
- **Revocable:** the You-tab "Share data with partners" toggle already writes
  `data_sharing`; turning it off revokes (a new ledger row) and the affordance re-locks.

**MHMDA correctness:** consent is **separate from collection** (distinct from
`health_data_collection`), **opt-in**, **not bundled**, **freely given**, **revocable**;
and **no health-adjacent attribute is ever in the shared payload** regardless of consent
(the opaque token carries none). The private right of action is live — this gate is
non-negotiable.

---

## 7. SURFACE 03 — the transparency page (the highest-leverage trust artifact)

**Where:** `app/commerce/transparency.tsx` (dark, `#1B1813`). Reachable from every
"How this works →" disclosure link, the You tab ("How we stay honest"), and the consent
gate.

**Look & feel (design surface 03):**

- Near-black `#1B1813`, cream `#F4EFE7` text.
- Eyebrow (mono, clayBright `#D9A183`): `HOW WE STAY HONEST`.
- Title (Instrument Serif, 31px): _"How recommendations and money stay separate."_
- **Four numbered principles** (mono index in clayBright + bold title + muted body):
  1. _"We rank by fit and evidence."_ — _"Commission, partnerships and affiliate data
     never enter the ranking — by architecture, not promise."_
  2. _"Links come after, never before."_ — _"We decide what's best for you first; only
     then do we attach a 'where to buy' link."_
  3. _"We disclose every paid link."_ — _"Right next to the link, in plain words — never
     hidden in a footer."_
  4. _"Sometimes we earn nothing."_ — _"If the best place to buy has no program, we link
     there anyway — and tell you so."_ (the Wirecutter integrity standard)
- Footer (hairline-dark divider): a lock glyph + _"We never send anything about your
  skin to a retailer."_
- Copy is centralised + scanned by the claim-safety/FTC guard.

---

## 8. FTC + claim-safety guard (the Doc 10 trust test)

Centralised commerce copy (`features/commerce/copy.ts`) is scanned by
`claimsafety.test.ts` to enforce, on every edit:

- **FTC wording:** the disclosure uses **"paid link"**; it must **NOT** contain
  "affiliate link" or "commissionable link" (FTC: those are inadequate). It must state
  independence ("never affects what we recommend" / "the commission never changed the
  list"). A "buy now" button is never used as the disclosure.
- **No dark patterns:** no urgency/scarcity/guilt ("don't miss", "only N left", "hurry",
  "selling fast"), curly-apostrophe-aware.
- **Claim-safe:** concerns not conditions — no drug/disease verbs or disease names
  (treats/cures/heals/prevents; acne/rosacea/eczema/melasma/dermatitis).
- **Positive controls:** the guard fails on a reintroduced "affiliate link" disclosure,
  a "Buy now!" CTA, and a condition claim.

---

## 9. Data model (migration 0022 — commerce domain, church-and-state)

All tables in `public` (consistent with prior migrations); **no commission/rate field in
any ranking-path table.** Generic active affiliate links are an independently governed
commerce surface readable to `authenticated`; they are not product-fact or ranking
authority. Migration `0058` supersedes the original broad creator-stack policies and
revokes every API-role read of stacks/items until a separate evidence-bound B-DERM
publication authority exists. Per-user telemetry is owner-RLS; order/commission data is
service-role only (clients never read commission).

- `affiliate_links` — catalog-level resolved links. `id`, `product_type`,
  `catalog_product_id?`, `retailer`, `label`, `url`, `price_cents?`, `currency?`,
  `source` (`shopmy|skimlinks|direct|none`), `is_paid` (bool — is it commissionable),
  `is_active`, `created_at`. SELECT → authenticated; write → service-role. (Rate/
  commission deliberately **omitted** from the client-readable columns; commission lives
  only in `order_attributions`, service-role.)
- `creator_stacks` — `id`, `slug` (unique), `title`, `subtitle`, `curator`,
  `curator_kind` (`editorial|derm|creator`), `reviewed_by?` (B-DERM-REVIEW), `is_active`,
  `created_at`. Direct SELECT → none of PUBLIC/anon/authenticated/service_role until the
  evidence-bound review/publication contract is installed; operator writes do not make a
  row publishable.
- `creator_stack_items` — `id`, `stack_id` (fk), `position`, `product_type`,
  `catalog_product_id?`, `role_label`, `note?`. Direct SELECT → none of
  PUBLIC/anon/authenticated/service_role while the parent publication authority is
  absent.
- `commerce_click_events` — owner-scoped telemetry. `id`, `user_id` (fk auth.users),
  `click_token` (opaque), `product_type?`, `affiliate_link_id?`, `source`, `consented`
  (bool), `created_at`. Owner-only RLS (select/insert/delete own; no update). **No
  health column.**
- `order_attributions` — the polled Order Report. `id`, `external_order_id` (unique),
  `click_token?`, `order_amount_cents`, `commission_cents`, `currency`, `status`
  (`pending|locked|returned`), `transaction_date`, `record_updated_at`, `created_at`.
  **Service-role only** — RLS enabled, **no client policies** (clients can never read
  commission data; this is the church-and-state wall at the row level).

`@layerwell/types` + `database.types.ts` extended. The original 0022 policy description is
historical; migration `0058` is the effective direct-read authority. No ranking table is
touched.

---

## 10. Decisions & blockers (logged with the slice)

- **D-058+ — church-and-state commerce domain**: separate commerce tables, no
  commission in the ranking path; ranking imports no commerce module; physical-schema
  split deferred (module-boundary + RLS deliver the guarantee).
- **D — rail-agnostic resolution** behind a `source` discriminator (the B-SHOPMY hedge).
- **D — opaque-token attribution**, no health-adjacent attribute ever reaches a retailer
  (tested); deep-link-out, no in-app webview.
- **D — MHMDA strict default**: no commerce consent → **no paid links shown** (stricter
  than the mock's "links still work"); consent reuses `data_sharing`, recorded with
  commerce copy/version.
- **D — six-figure framing**: instrument and plan affiliate as a supplement; never let
  commission metrics tune ranking.
- **B-SHOPMY (elevated)**: now also covers the **house-account question** (can a brand
  mint links on its own recs?) + the gated Create Link / URL-Rate / Order-Report
  schemas + approval, including the absence of a documented Order Report correlation
  field or commission lifecycle status. **Blocking before any real link is minted.**
- **B-PRIVACY / B-PRIVACY-COPY**: final MHMDA data-sharing consent copy + DPIA for the
  commerce flow + FTC disclosure final wording (counsel).
- **B-CATALOG-SEED**: real retailers/prices/links; until then where-to-buy is type-first
  - honest-empty.
- **B-DERM-REVIEW**: the expert/derm stacks' clinical sign-off (`reviewed_by`).
- **B-LEGAL**: Google Play 2026 physical-goods/external-link confirmation (Apple
  3.1.3(e) verified; Play not independently confirmed), Amazon Associates in-app
  restriction check if used as fallback.

---

## 11. Sources (re-verified 2026-06-13, primary unless noted)

- Yuka independence + revenue: yuka.io/en/independence, help.yuka.io.
- ShopMy two-API model, poll-only Order Report, house-account gap, access gating:
  docs.shopmy.us (getting-started, fetch-order-report, getting-started-1, llms.txt).
- FTC "clear & conspicuous" + "paid link" wording: ftc.gov endorsement-guides FAQ,
  16 CFR 255.0, perkinscoie.com.
- MHMDA scope/consent/teeth: app.leg.wa.gov RCW 19.373, atg.wa.gov, eff.org.
- Apple 3.1.3(e) physical-goods (no IAP): developer.apple.com app-store review
  guidelines.
