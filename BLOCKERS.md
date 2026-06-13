# Blockers — the founder's do-not-guess list

Everything here needs **you** (the founder): an account, an API key, money, a
signature, legal sign-off, or a product/content decision the `/docs` don't
specify. The code is built _around_ each one and reads from `.env` placeholders
(see `.env.example`) or uses clearly-labelled placeholder content. Each spot is
marked in code with `// BLOCKED: <id>`.

**Status key:** 🔴 open (needs you, nothing safe to stub) · 🟡 stubbed (code
built + wired to a placeholder; drop in the real value and it works) · 🟢
de-risked · ✅ cleared.

---

## How to clear these in one pass (the founder's TODO)

Self-contained TODO. Built so far: **Slices 0–24** — full foundation (auth, data
model + RLS, design system, onboarding, app shell + Today, privacy controls), the
**Document 2 ingredient-intelligence layer**, the **Document 3 routine builder**,
the **Document 4 Smart Shelf**, the **Document 5 actives & skin-cycling scheduler**,
the **Document 6 guided photo progress** (local-first capture/review/timeline/compare,
no-AI-score, biometric gallery lock, unbundled photo consents), and the **Document 7
reminders, streaks & widgets** (tiered local-first notifications + frequency caps +
quiet hours, the calm forgiving streak, the soft-ask + settings hub + timing +
welcome-back + widget/Live-Activity previews), and the **Document 8 subscriptions &
paywall** (the reverse-trial conversion model, honest paywall + lifecycle screens,
local-first entitlement gating), and the **Document 9 personalized recommendations**
(the independent "church and state" advisor — the six honest triggers + an honest
"you're set", the merit-only FIT score, type-first + restrained, the what/why/how
explainability), and the **Document 10 creator stacks + commerce** (the walled-off
"where to buy" layer — church-and-state schema, opaque-token attribution, FTC "paid
link" disclosure, the MHMDA consent gate, expert/derm shoppable stacks + the
transparency page; validated as a six-figure supplement, the live rail stubbed pending
B-SHOPMY; **670 tests**). See PROGRESS.md.

**1. To make the app actually run end-to-end**
- **B-SUPABASE** first: create the project, provide the URL + publishable +
  secret keys, then `supabase db push` (applies every migration) and
  `supabase gen types typescript … > packages/types/src/database.types.ts`.
  On a Mac, `expo start` / EAS build for iOS.
- Then add each account key as a single `.env` value when ready: **B-APPLE**,
  **B-GOOGLE**, **B-REVENUECAT**, **B-POSTHOG**, **B-SENTRY**, **B-TURNSTILE**.

**2. To unblock legal/clinical content** (you + counsel + a dermatologist):
**B-QUIZ-COPY**, **B-PRIVACY-COPY**, and **B-DERM-REVIEW** (LAUNCH GATE — clinical
sign-off of the conflict matrix before any rule reaches users). See
**[docs/legal-readiness.md](docs/legal-readiness.md)** for the full legal map +
cost estimates (regulatory posture, privacy law, the four required sign-offs).

**3. To unblock the rest of the build order**: provide the missing feature
documents — see **B-MISSING-DOCS**. Next in build order: **Document 11** (community
layer). Also: a **custom dev build** unlocks the deferred native work —
**B-REVENUECAT** (the `react-native-purchases` SDK + offerings → real prices/purchase),
**B-CAMERA** (vision-camera + ML-Kit guided capture), **B-WIDGETS**
(WidgetKit/Glance/ActivityKit), and **B-NOTIF-VERIFY** (on-device notification
delivery) all need it; **B-LEGAL** is the store/auto-renewal-law review for launch; and
**B-CATALOG-SEED** (CosIng/OBF import) lights up real shelf data, scan match rates, and
the **B-SHELF-CONTRIB** contribute-back loop.

**Snapshot of current statuses** — Accounts: B-SUPABASE/REVENUECAT/APPLE/GOOGLE/
POSTHOG/SENTRY/TURNSTILE 🟡, B-SHOPMY 🔴 · Legal/clinical: B-QUIZ-COPY/
PRIVACY-COPY 🔴, **B-PRIVACY 🔴** (data-sharing + facial-image DPIA + photo marketing
claim + win-back push/lock-screen copy), **B-LEGAL 🔴** (Apple 3.1.2 / ARL /
external-link / final policy text), **B-DERM-REVIEW 🔴 (launch gate)** · Data:
B-CATALOG-SEED 🔴, **B-SHELF-CONTRIB 🔴** · Native: **B-CAMERA 🔴** (capture pipeline),
**B-WIDGETS 🔴** (WidgetKit/Glance/ActivityKit), **B-NOTIF-VERIFY 🟡** (on-device
delivery + Android-14) · Verify: APPLE-TRIAL-TOGGLE ✅, SUPABASE-KEYS ✅, METRO 🟢,
RC 🟡, PASSKEYS 🔴, RIVE-LOTTIE 🟡, AUTH-LINKING 🟡 · Deferred: B-SERVER-DETECT 🟡,
B-ROUTINE-PERSIST 🟡, B-DRAG-DND 🟡 · Docs: MISSING-DOCS 🔴 (Docs 9–15), EVERY-N-DAYS 🔴.

---

## A. Accounts / API keys / money / signatures

### B-SUPABASE — Supabase project 🟡 stubbed
Create the Supabase project; provide `EXPO_PUBLIC_SUPABASE_URL` and the **new
publishable key** (`EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) + the **secret key**
(`SUPABASE_SECRET_KEY`, Edge Functions only). Then apply the migrations in
`supabase/migrations/` and run the Security & Performance Advisors. Legacy
anon/service_role keys are being deprecated end-of-2026 — use the new keys.

### B-REVENUECAT — RevenueCat 🟡 stubbed
Provide `EXPO_PUBLIC_REVENUECAT_IOS_KEY` / `_ANDROID_KEY`, configure the **Offerings →
Packages → Entitlements** (`pro`/`pro_plus`; the annual + monthly products; the price
A/B as offerings — docs/08 §10), set the webhook → `revenuecat-webhook` Edge Function
with `REVENUECAT_WEBHOOK_AUTH`. **Update (Slice 22):** the whole paywall + lifecycle +
local-first entitlement gating + the app-granted reverse trial are BUILT; what's
stubbed is the native SDK itself — install `react-native-purchases` in a **custom dev
build**, bind it to the **Supabase user id as `appUserID`** (`configureRevenueCat`),
fetch **localized prices from the offering** (the in-app prices are fallback labels —
never the real billing amount), and wire `purchasePackage()` / `restorePurchases()` to
the native StoreKit/Play sheet. The **server reverse-trial grant** (an Edge Function
writing the `period_type='reverse_trial'` row service-role) is the forward path; v1
grants it in the local cache. Full sandbox/TestFlight matrix (purchase, carded trial,
reverse-trial grant + expiry, renewal, grace, restore, refund, upgrade/downgrade)
before launch. RC webhook payload shape + subscriber-deletion API still to confirm
(B-VERIFY-RC).

### B-APPLE — Apple Developer account 🟡 stubbed
Register App ID `com.onskin.app`; enable Sign in with Apple; create the SIWA
service id + key (`APPLE_*` secrets) for **server-side token revocation on
account deletion** (Apple 5.1.1(v), TN3194); create the App Store Connect app.
South-Korea server-to-server SIWA notification endpoint (due 2026-01-01) to
confirm. Needs paid membership ($) + your signature on agreements.

### B-GOOGLE — Google Sign-In + Play Console 🟡 stubbed
OAuth client IDs (iOS / Web) → `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` /
`_WEB_CLIENT_ID`; Android SHA-1 fingerprints registered; Play Console app
($25 one-time). Watch the Android `DEVELOPER_ERROR` (SHA-1/client-id mismatch).

### B-POSTHOG — PostHog 🟡 stubbed
`EXPO_PUBLIC_POSTHOG_KEY` + `_HOST`, plus `POSTHOG_PERSONAL_API_KEY` for
server-side person-deletion on account delete. The docs/01 §7 funnel is already
instrumented through a `track()`/`identify()` shim (`src/lib/analytics/track.ts`);
the real `posthog-react-native` SDK (with bootstrapped flags + identify at the
value moment) + the RevenueCat→PostHog integration are wired in the analytics
slice (build-order, not yet reached). Env vars documented.

### B-SENTRY — Sentry 🟡 stubbed
`EXPO_PUBLIC_SENTRY_DSN` + `SENTRY_AUTH_TOKEN`/`SENTRY_ORG`/`SENTRY_PROJECT`
documented in `.env.example`. The `@sentry/react-native` SDK init + source-map
upload are part of the observability slice (not yet reached); no Sentry code is
wired yet beyond the documented env vars.

### B-TURNSTILE — Cloudflare Turnstile 🟡 stubbed
`EXPO_PUBLIC_TURNSTILE_SITE_KEY` + the secret configured in Supabase Auth.
Strongly recommended for anonymous sign-in + signup (docs/01 §5).

### B-SHOPMY — ShopMy affiliate rail + the house-account question 🔴 open (commerce launch gate)
**Updated (Slice 24, docs/10).** The Doc 10 commerce layer is BUILT around this: the
4 surfaces, the church-and-state schema, the opaque-token attribution, the FTC
disclosure, the MHMDA consent gate, the expert/derm stacks, and the transparency page
all ship; the live affiliate **rail is stubbed/inert** behind this blocker. A **cited
deep-research pass (2026-06-13)** surfaced the central unknown that must be answered by
ShopMy partnerships (partners@shopmyshelf.us) **before any real link is minted**:
- **The house-account question (BLOCKING):** ShopMy's documented APIs do **not** confirm
  a brand/app can create affiliate links on its **own** first-party recommendations under
  a house account. **Link creation lives only in the creator-side OAuth Developer API**,
  scoped *"on behalf of authenticated ShopMy users"* (individual creators must grant
  per-user `write_links`); the **Brand Partners API is reporting-only** (the poll-based
  `Fetch Order Report`, **no webhooks**, 200 req/day). If ShopMy can't run house-side,
  the OAuth-on-behalf-of-creator model forces the creator-marketplace shape the product
  explicitly rejects. **The build is rail-agnostic** (`features/commerce/links.ts` carries
  a `source` discriminator: `shopmy`|`skimlinks`|`direct`|`none`) so a fallback rail
  (Skimlinks/Sovrn aggregator, or direct retailer programs) can be swapped in without
  re-architecting. (Avoid Amazon Associates in-app — its operating agreement restricts
  mobile-app use.)
- **API access is GATED** to approved partners (the Brand Partners API needs the brand
  domain registered + a brand API key; the OAuth console is behind a login). OnSkin must
  be onboarded/approved before any integration. Provide `SHOPMY_BRAND_API_KEY` (the
  `order-report-poll` Edge Function stub consumes it) + the OAuth client id/secret if the
  creator rail is ever used.
- **Re-verify the gated schemas** at build time: the exact `Create Link` / `Fetch URL
  Rate` / `Search Catalog` / `Fetch Order Report` response shapes (partly undocumented).
- **No webhooks** → the daily `pg_cron → order-report-poll` Edge Function is mandatory
  (built as an inert stub; keyed on `record_updated_at`, idempotent upsert into the
  service-role-only `order_attributions`).
The economics are validated as a **six-figure supplement** (not a 7-figure pillar) — see
docs/10-creator-stacks-build-spec.md.

---

## B. Legal exposure — engine built, content is yours + counsel's

### B-QUIZ-COPY — Skin-type quiz questions & scoring 🔴 open
The 4-axis quiz **engine** (Oily/Dry, Sensitive/Resistant, Pigmented/Non,
Wrinkled/Tight + phototype + Monk tone + sensitivities + pregnancy + goals),
scoring, and reveal are built with **clearly-labelled placeholder questions**
(`PLACEHOLDER_QUIZ`). The validated Baumann BSTI questionnaire is **patented +
copyrighted** (docs/01 §2) — final original questions + scoring need a
**patent/trademark attorney review (mandatory, not optional)** before ship. Do
not reuse BSTI items or lean on "16 types" branding.

### B-PRIVACY-COPY — Legal copy (policies + consent strings) 🔴 open
The consent **ledger** + unbundled consent **screens** are built with
placeholder body text + a `version`/`consent_text_hash` mechanism. You + counsel
must supply final: standalone **Consumer Health Data Privacy Policy** (MHMDA),
Privacy Policy, Terms of Service, and the exact consent statements for
`health_data_collection`, `photo_capture`, `photo_cloud_backup`, `marketing`,
`data_sharing`. A GDPR Art. 35 **DPIA** is advised given large-scale health-data
processing. **Update (Slice 20):** the `photo_capture` consent screen (shown at
first camera use) and the `photo_cloud_backup` opt-in (separate, off by default)
are now **built with placeholder copy** (`features/onboarding/consentCopy.ts`) and
wired to the immutable ledger via the version + SHA-256 hash mechanism — drop in
the counsel-approved text and they ship.

### B-DERM-REVIEW — Clinical sign-off of the rules 🔴 open (LAUNCH GATE)
**Now also covers docs/09 recommendations.** docs/09 §5: the **goal-active
recommendation types** (which active for which goal — retinoid, AHA/BHA, vitamin C,
azelaic, niacinamide) are medically-adjacent and launch-gated exactly like the
conflict matrix: `RECS_REVIEWED = false` + `shippableRecTypes()`
(`apps/mobile/src/features/recommendations/catalog.ts`) withhold them in production
until a board-certified dermatologist signs off; structural routine-completeness
types (a cleanser, a moisturiser, an SPF) ship, and the pregnancy hard-exclusion is
enforced regardless. **Also covers the docs/10 expert/derm shoppable stacks** (Slice 24,
`STACKS_REVIEWED = false` + `shippableStacks()`): a published stack asserts a routine, so
it stays dev-only until a dermatologist signs off (`creator_stacks.reviewed_by`).
**Also covers docs/03 + docs/04 + docs/05 rules.** docs/03 §11: the
`sequencing_rules` (application order), the `active_ramp` cadence numbers, and the
skin-cycling personalisation. docs/04 §3: the **PAO category defaults** (gated in
production via `PAO_DEFAULTS_REVIEWED`, D-032). docs/05 §8: the **scheduler's
orchestration rules** — the class **frequency caps**, the **retinoid×exfoliant
same-night prohibition** (harm-relevant; enforced by construction regardless), the
**recovery/de-escalation protocol** (~7–10 days), and the pregnancy suppression —
all grade-C / medical-adjacent and need the same board-certified dermatologist +
cosmetic-chemist sign-off as the conflict matrix before launch. Original entry:
docs/02 §9 makes this **mandatory, not optional** — it gates launch of the whole
intelligence layer. The ~14 starter rules (migration `…0013_seed_intelligence.sql`
+ `apps/mobile/src/features/intelligence/rules.ts`) are authored from docs/02
§4.4/§4.8 but every row has `reviewed_by = NULL`. Before ANY rule (especially the
`safety`/pregnancy rows) is shown to real users, a **board-certified
dermatologist + a cosmetic chemist/pharmacist** must review every rule's
type/severity/grade/mechanism/resolution/citation and the PAO category defaults,
and populate `reviewed_by`. **Production exposure note (RLS review):** the seed
ships `is_active = true` for dev/demo; before any client-facing deploy, either
flip unreviewed rows to `is_active = false` or withhold the seed until
`reviewed_by` is set. Expand toward the doc's ~40 pairs only via versioned,
reviewed events. *(Supersedes the old B-CONFLICT-RULES — the matrix now exists;
what's blocked is the clinical sign-off + expansion.)*

### B-LEGAL — store-compliance + auto-renewal-law + external-link review 🔴 open
docs/08 §7 / §8: before launch, counsel must confirm the fast-moving compliance
surface the paywall is built to. (1) **Apple Guideline 3.1.2** (early-2026 enforcement):
the paywall is designed to it — billed amount most conspicuous, Terms/Privacy/Restore
present, no free-trial toggle, honest auto-renew disclosure — confirm current wording +
the App Store Connect metadata (EULA link in the description, Privacy link). (2) **Final
Terms of Use + Privacy Policy text** (the in-app links point to placeholder
`onskin.app/terms|privacy` — overlaps **B-PRIVACY-COPY**). (3) **Auto-renewal laws**
(CA CARL amended 2025-07-01, NY/CO/MA, federal ROSCA; the FTC click-to-cancel rule was
vacated 2025-07 but may revive): IAP de-risks cancellation (one-tap OS), but any web
checkout must independently comply — the win-back + 2-day-reminder copy meet the strict
standard, confirm. (4) **External-link / web checkout** is post-*Epic* unsettled (Ninth
Circuit remand, Apple seeking SCOTUS review mid-2026) — ship IAP; treat web checkout as
a revisitable margin experiment, **not** a dependency. (5) **Account deletion** must
call RevenueCat's **subscriber-deletion API** (extend the `account-deletion` Edge
Function) and the app already tells the user store billing continues until they cancel.

### B-CATALOG-SEED — CosIng + Open Beauty Facts data import 🔴 open
The catalog schema + ingestion design exist, but the actual data isn't imported
(needs network + the live DB, neither available at build time). docs/02 §2:
verify CosIng's current bulk-download route (it's been inconsistent since the
Commission relaunch); seed Open Beauty Facts from the **daily dumps** via DuckDB
(NOT the API — API is one call per real scan); honor ODbL (attribution in
Settings/About + share-alike + **contribute-back** newly-added products); hand-
curate the top ~2,000 products with concentration bands; populate
`ingredient_tags`. Until then the engine uses the client-side starter tag
dictionary for the common active families. **Also gates the Doc 10 commerce layer
(Slice 24):** the real retailers / prices / `affiliate_links` rows that the "where to
buy" affordance + the shoppable stacks resolve — until seeded (+ the rail approved,
B-SHOPMY), where-to-buy shows a dev-only demo set and an honest empty state in
production.

### B-SERVER-DETECT — server-authoritative detect_conflicts() 🟡 deferred
docs/02 §10 specifies a `SECURITY DEFINER` `detect_conflicts(uid)` PL/pgSQL twin
of the client detector. Deferred (DECISIONS D-020): the tested TS engine + the
owner-RLS `routine_conflicts` cache cover v1 without a security gap; add the SQL
twin once there's a live DB to test it against, to avoid an untested
divergent implementation on a liability surface.

---

## C. "Re-verify at build time" items

### B-VERIFY-APPLE-TRIAL-TOGGLE ✅ cleared by design
docs/01 §2 flags Apple 3.1.2 rejecting the free-trial toggle. Resolved by
_not_ building a trial toggle on iOS at all — single annual offer with a visible
"Not now," matching the design spec paywall. No founder action required.

### B-VERIFY-SUPABASE-KEYS ✅ accounted for
Using the new publishable/secret key env names from the start (legacy keys
deprecated end-2026). No action beyond providing the new keys (B-SUPABASE).

### B-VERIFY-METRO — Metro monorepo resolution 🟢 largely de-risked
Monorepo `metro.config.js` follows Expo's documented pattern. **`npx expo export
--platform ios` succeeds** — Metro resolved the `@onskin/types` workspace import
and bundled the full app (Babel + NativeWind transform + fonts all OK). Only the
interactive `expo start` dev server on a real device remains unverified; the
production bundle graph is proven.

### B-VERIFY-RC — RevenueCat webhook payload + subscriber-deletion API 🟡 stubbed
`revenuecat-webhook` Edge Function reads `event.app_user_id` (not
`body.app_user_id`), is idempotent on `event.id`, and returns 200 fast — but the
exact payload + the subscriber-deletion endpoint must be confirmed against live
RC docs/account.

### B-VERIFY-PASSKEYS 🔴 deferred
Supabase passkey GA + RN library maturity unverified. Per docs/01 §1, passkeys
are an optional post-launch Settings upgrade, NOT a primary method — not built
in this phase. Re-verify before adding.

### B-VERIFY-RIVE-LOTTIE 🟡 stubbed
docs/01 §8 recommends Rive for the "analyzing your skin" hero moment over
Lottie, but says re-evaluate after Lottie's late-2025 state-machine update. The
personalization-theater screen is built with a lightweight Reanimated
placeholder animation; swap in the chosen Rive/Lottie asset later.

---

## D. Missing source-of-truth documents

### B-MISSING-DOCS — Documents 4–15 not present in /docs 🔴 open
Received so far: `docs/00-architecture.md`, `docs/01-auth-onboarding.md`,
`docs/02-ingredient-intelligence.md`, `docs/03-routine-builder.md` (+ the
Claude Design handoff covering docs 1–3). Per CLAUDE.md's hard rule ("if it isn't
specified, STOP and ask — do not invent product behavior, schema, or copy"), the
remaining build-order items need their detailed doc:

| Build-order item | Needs document | Status |
| --- | --- | --- |
| 2 · Ingredient/product DB + conflict engine | Doc 2 ✅ received | **BUILT** (Slices 7–11): schema, engine, scheduler, PAO, Shelf + conflict-detail UI, 63 tests. Blocked sub-parts: data import (B-CATALOG-SEED), clinical sign-off (B-DERM-REVIEW), server detect fn (B-SERVER-DETECT) |
| 3 · AM/PM routine builder | Doc 3 ✅ received | **BUILT** (Slices 12–17): sequencing_rules + active_ramp schema, deterministic generation engine, all builder screens (plan-built, reorder, ramp, Today AM/PM, Progress/calm-streak, tolerance, override sheet, adaptation, widgets), 77 tests. Blocked sub-parts: routine persistence (B-ROUTINE-PERSIST), full drag-DnD (B-DRAG-DND), clinical sign-off (B-DERM-REVIEW) |
| 4 · Smart shelf (PAO/expiry) | Doc 4 ✅ received | **BUILT** (Slice 18): additive `user_products` columns + `shelf_scans` schema, local-first store, the full intake funnel (no-match fork / OCR-confirm / manual / **opened-date linchpin**), the five-state badge taxonomy (incl. the eye/SPF firmer exception), the product-detail management hub, archive/lifecycle, and the opt-in replenishment sheet (design's 9 screens). Blocked sub-parts: live barcode/OBF scan + OCR capture (**B-CATALOG-SEED** + camera), the contribute-back pipeline (**B-SHELF-CONTRIB**), the data-sharing consent + affiliate for replenishment (**B-PRIVACY**), server persistence (**B-SUPABASE** / B-ROUTINE-PERSIST), PAO defaults sign-off (**B-DERM-REVIEW**) |
| 5 · Actives / skin-cycling scheduler | Doc 5 ✅ received | **BUILT** (Slice 19): the stored/versioned `cycles` + `cycle_nights` schema + the pure local-day projection, **multi-active orchestration** (one potent active/night, retinoid×exfoliant never same night, class frequency caps, recovery nights, pregnancy suppression, phased introduction — 15 fixtures), the local-first cycle store, and all the management/disruption surfaces (week overview, "why tonight?", cycle settings, pause/skip/travel/procedure hub, post-procedure + auto-de-escalation recovery mode, phased-intro). Blocked sub-parts: server `orchestrate()`/`schedule_for()` (**B-SERVER-DETECT** / B-ROUTINE-PERSIST), drag-to-reassign nights (**B-DRAG-DND**), reminder *delivery* (Doc 7), clinical sign-off of the frequency/separation/recovery rules (**B-DERM-REVIEW**) |
| 6 · Guided photo capture + comparison | Doc 6 ✅ received | **BUILT** (Slice 20): additive `photos` columns (reference/series/pose-QA/local-day/local_uri/encrypted) + hardened `owns_photo()` (migration 0018), the local-first photo store (metadata-only mirror, `local_only` always true, no faceprint), the pure+tested capture-quality + timeline helpers (89 fixtures), the photo claim-safety guard, and all 9 design surfaces (guided capture, review&retake, first-run, **Compare** before/after slider + side-by-side, **Timeline** film strip + milestones, single-photo detail, no-AI-score, biometric gallery lock, calm reminder). The Progress tab is now the photo timeline; the calm streak moved to `/routine/streak`. Blocked sub-parts: the on-device camera + face detection + encryption + cloud-upload job (**B-CAMERA**), the DPIA + "never leaves your device" claim + photo consent copy (**B-PRIVACY** / **B-PRIVACY-COPY**), server persistence (**B-SUPABASE**), reminder *delivery* (Doc 7) |
| 7 · Reminders / streaks / widgets | Doc 7 ✅ received | **BUILT** (Slice 21): `notification_preferences` extensions + `streak_freezes` + content-free `notification_log` (migration 0019, owner-RLS); the pure tested calm forgiving streak (auto-freezes, earn-back, weekly adherence + heat-map, non-decreasing best — 11 fixtures) + the tiered notification policy (caps + quiet hours — 13 fixtures) + a notification claim-safety guard; local-first notification-prefs store + the `expo-notifications` DAILY-trigger delivery layer (frequency-cap engine); the soft-ask, the tiered settings hub, timing/quiet-hours/discretion, welcome-back, and the widgets/interactive-checkoff/Live-Activity previews. Blocked sub-parts: native widgets + interactive check-off + Live Activity (**B-WIDGETS**), on-device delivery + Android-14 verification (**B-NOTIF-VERIFY**), win-back push + lock-screen copy DPIA (**B-PRIVACY**), server `recompute_streak` twin + APNs/FCM (**B-SUPABASE** / B-SERVER-DETECT) |
| 8 · Subscriptions / paywall | Doc 8 ✅ received | **BUILT** (Slice 22): the reverse-trial conversion model (two honest paths), entitlements extensions (migration 0020: period_type/store/will_renew/attribution), the pure tested plan catalog + entitlement-state derivation + a paywall claim-safety guard (91 tests), the local-first entitlement cache + `useEntitlement`/`ProGate`/`withProGate` gating (offline-safe, gates on `is_active` regardless of source), the app-granted reverse trial, and all 9 surfaces (onboarding offer, reverse-trial banner, re-offer, contextual upsell, success, manage subscription, graceful downgrade, honest win-back) + the event-type-correct webhook (never revokes on CANCELLATION). Gating wired on the photo timeline / scheduler / widgets. Blocked sub-parts: the native `react-native-purchases` SDK + localized offering prices + purchase/restore + the server reverse-trial grant (**B-REVENUECAT**), store/ARL/external-link/final-policy legal review (**B-LEGAL** / **B-PRIVACY-COPY**), server entitlement mirror (**B-SUPABASE**) |
| 9 · Personalized recommendations | Doc 9 ✅ received | **BUILT** (Slice 23): the `recommendation_preferences` + `recommendations` schema (owner-RLS, **no commercial column**), the pure tested engine (the six honest triggers + an honest "you're set", the merit-only six-input FIT score, the B-DERM-REVIEW launch gate on goal actives), the centralised claim-safe copy + guard, and the 5 surfaces (For-you hub, what/why/how card, "you're set", preferences, in-routine gap prompt) + Today/You wiring. Blocked sub-parts: the commerce/affiliate path (**doc 10** / **B-PRIVACY** data-sharing consent / **B-SHOPMY**) is deferred + inert, specific-product recommendations are catalog-thin → type-first until **B-CATALOG-SEED**, clinical sign-off of the goal-active rec types (**B-DERM-REVIEW**), server persistence (**B-SUPABASE**) |
| 10 · Creator stacks + ShopMy | Doc 10 ✅ received | **BUILT** (Slice 24): the walled-off "where to buy" commerce layer on OnSkin's own recommendations — church-and-state schema (migration 0022: commission service-role-only in `order_attributions`, never client-readable / never in ranking), the opaque-token attribution (no skin data to retailers, tested), the FTC "paid link" disclosure + guard, the MHMDA consent gate, the rail-agnostic resolution, the expert/derm shoppable stacks (B-DERM-REVIEW-gated), the transparency page, and the Order-Report poll Edge Function stub. Validated as a six-figure supplement. Blocked sub-parts: the live ShopMy rail + the **house-account question** (**B-SHOPMY**), real catalogue/retailers/prices (**B-CATALOG-SEED**), final MHMDA consent copy + DPIA + FTC final wording (**B-PRIVACY** / **B-PRIVACY-COPY**), stacks clinical sign-off (**B-DERM-REVIEW**), Google Play 2026 physical-goods/external-link confirmation (**B-LEGAL**) |
| 11 · Community layer | Doc 11 | blocked |
| 12 · AI trend analysis | Doc 12 | blocked (intentionally last) |

I build the slices the received docs + the design spec fully authorize, scaffold
the UI/schema the design spec clearly shows, and stop short of inventing
unspecified behavior/copy/schema for the rest.

---

## New blockers discovered during build

### B-VERIFY-AUTH-LINKING — anon → social account linking 🟡 stubbed
docs/01 §1 flags that `linkIdentity()` for OAuth in RN is broken ("Identity is
already linked to another user") and that the reliable pattern is email-based
automatic linking. `signInWithApple`/`signInWithGoogle` use `signInWithIdToken`;
whether that LINKS to the existing anonymous user (preserving quiz/routine data)
or creates a NEW user must be verified on a real device with real Apple/Google
accounts (needs B-APPLE + B-GOOGLE). If it orphans data, switch to the
`updateUser({ email })` → re-auth email-match pattern.

### B-GOOGLE (addendum) — iOS URL scheme for the config plugin 🟡 stubbed
The `@react-native-google-signin/google-signin` Expo config plugin needs the
reversed iOS client id (`iosUrlScheme`) in `app.json` to build on iOS. Add it
once the iOS OAuth client exists.

### B-ROUTINE-PERSIST — server routine generation + per-user cycle anchor 🟡 deferred
docs/03 §11 specs a server-authoritative `build_routine(uid)` / `recompute_routine`
(`SECURITY DEFINER`, like docs/02's detect fn). Deferred with B-SERVER-DETECT: the
tested client `generatePlan` covers v1. The skin-cycle anchor is currently stored
locally (AsyncStorage); persist it per-user once the routine is written server-side.
Needs B-SUPABASE.

### B-DRAG-DND — full drag-and-drop reorder 🟡 stubbed
The routine edit/reorder screen (design 02) **and** the docs/05 cycle-settings
"assign actives to nights" surface have drag handles + the non-blocking rule nudge
(the doc's actual point — guidance not gates) functional, but true drag-and-drop
needs `react-native-draggable-flatlist` (reanimated/gesture-handler are present).
Small follow-on.

### B-PRIVACY — data-sharing consent + DPIA for the shelf/replenishment 🔴 open
docs/04 §6/§7 introduce the key new privacy obligation: **replenishment affiliate
links (ShopMy etc.) may only fire behind the separate, distinct MHMDA
data-sharing consent** (docs/01 §4, consent type `data_sharing`). The
replenishment sheet (`app/shelf/replenish.tsx`) is built **opt-in and inert** —
"See similar options" shows a calm note and shares nothing; no affiliate SDK is
wired, and ATT priming must precede any attribution SDK (docs/01 §8). To go live:
counsel must supply the data-sharing consent copy (overlaps **B-PRIVACY-COPY**),
the consent must be wired as the gate, and ShopMy provisioned (**B-SHOPMY**).
Also for counsel (docs/04 §7): whether the shelf's product mix is additional
special-category inference to disclose in the GDPR Art. 35 **DPIA**. This is
effectively a launch gate for the replenishment commerce line.

**Now also covers the docs/10 commerce layer (Slices 23–24).** Slice 24 built the
actual **MHMDA consent gate** (`app/commerce/consent.tsx`): a separate, distinct,
opt-in, revocable consent (reusing the `data_sharing` ledger type with commerce copy +
version) that gates the "where to buy" affordance — **strict default: no consent ⇒ no
paid links shown at all**. The cited deep-research pass (2026-06-13) confirmed inferred
skincare-concern data is **regulated consumer health data** under MHMDA, that sharing it
to an affiliate needs this separate consent, and that the **private right of action is
live** (Maxwell v. Amazon, Feb 2025) — so counsel must supply the **final consent copy**
(overlaps B-PRIVACY-COPY), confirm the **FTC "paid link" wording**, and complete a
**DPIA** covering the commerce data flow before the rail goes live. Counsel should also
decide whether commerce-sharing needs its **own** distinct consent sub-type vs. the
unified `data_sharing` (the docs/01 enum currently has one sharing consent). The opaque
click token carries **no** health-adjacent attribute regardless of consent (tested).
The earlier (Slice 23) recommendation "Where to find it" link is superseded by this gate.
Original Slice-23 note: the "For you" card's affiliate path was built **inert** — it
states the disclosure honestly
("we may earn a commission — it never affects what we recommend"), share nothing, and
fire no analytics. Going live requires the **same** separate MHMDA/GDPR data-sharing
consent as replenishment (the engine itself shares nothing; church-and-state keeps
the ranking independent so the disclosure is true) plus **B-SHOPMY** + the catalog
(**B-CATALOG-SEED**) and FTC affiliate disclosure at the commerce layer (doc #10).

**Now also covers the photo feature (docs/06 §6/§7, Slice 20).** Facial progress
photos are the most sensitive data the app holds. The on-device-first design
deliberately minimises exposure — **`local_only` default, no faceprint stored
(avoids BIPA's trigger), no image bytes leave the device** — but three items need
counsel/DPIA sign-off before launch: (1) the **GDPR Art. 35 DPIA** must cover
facial-image processing; (2) the **"your photos never leave your device and never
train AI" marketing claim** must be confirmed literally true in implementation
(it is, in code: the Supabase mirror is metadata-only with `local_only = true`,
no upload job is wired, and cloud backup is a separate off-by-default consent);
(3) the **`photo_capture` + `photo_cloud_backup` consent copy** (placeholder in
`consentCopy.ts`, hashed into the ledger) needs final wording (overlaps
**B-PRIVACY-COPY**). The encrypted **cloud-backup upload job** itself is built only
as an off-by-default toggle + consent here; the queued Wi-Fi/charging upload is
**B-CAMERA**.

**Also covers the engagement layer (docs/07 §8, Slice 21).** Notifications are
health-adjacent: the design keeps lock-screen content **discreet by default**
(generic copy, no product/condition names — `lockscreen_discreet`), and the
utility/behavioural tiers are **local notifications** so content never leaves the
device. Counsel/DPIA must sign off the **win-back push copy** (the only tier that
uses APNs/FCM — it must carry only generic copy, **no health-revealing content in
third-party push payloads**) and confirm the discreet-by-default posture. The
content-free `notification_log` (tier/kind/timestamp only) and metadata-only
analytics are built to that standard.

### B-SHELF-CONTRIB — Open Beauty Facts contribute-back pipeline 🔴 open
docs/04 §4.6 / §9: any product added that wasn't in OBF (no-match scans, OCR-built,
manual-with-barcode) must, after light validation, be **contributed back** to OBF
via the authenticated POST endpoint (ODbL obligation), marking
`shelf_scans.contributed_back = true`. The schema (`shelf_scans` + the owner UPDATE
policy, D-028) and the no-match UI ("we'll add it back for everyone") are built,
but the actual queued, offline-tolerant POST job (an Edge Function or client task)
needs **OBF write credentials** + the live OBF API (shares **B-CATALOG-SEED**'s
network/account needs). It must send **product** data only (barcode/label/INCI),
never the personal shelf/profile.

### B-CAMERA — on-device guided-capture pipeline (camera + face detection) 🔴 open
docs/06 §3/§10: the guided-capture hero needs a **custom dev build** (not Expo Go)
with `react-native-vision-camera` + a **face-detection frame processor**
(`react-native-vision-camera-face-detector`, ML Kit-backed; or a Swift Vision
plugin on iOS) for real-time alignment/pose/quality, plus **on-device
luminance/white-balance** from the frame buffer for the lighting check,
**auto-capture** when tolerances are met, **client-side image encryption** of the
saved file, and the **queued Wi-Fi/charging cloud-upload job** to the private
bucket for opted-in backups. None is installed (Slice 20 ships the full designed
capture/review UI with a **simulated** capture so the timeline flow works
end-to-end; `quality.ts` tolerances are pure + tested and ready to consume real
signals). **Must verify frame-processor performance on real devices** (docs/00 §4
flags isolating the camera module if RN underperforms) and **tune the auto-capture
tolerances** on-device. **No faceprint/template is ever stored** — detection is
for framing only (docs/06 §7). Shares the native camera with the shelf
barcode/OCR scan (B-CATALOG-SEED). The `NSCameraUsageDescription` Info.plist string
is already in `app.json`.

### B-WIDGETS — native home-screen widgets + interactive check-off + Live Activity 🔴 open
docs/07 §5/§6: the home-screen widgets (tonight/progress/streak/cycle), the **iOS-17
interactive check-off from the widget** (and Android `RemoteViews`), and the PM
**Live Activity** (ActivityKit, iOS 16.2+) / Android ongoing notification all need a
**custom dev build** with `expo-apple-targets` / `expo-widgets` (WidgetKit is
SwiftUI-only) + Glance on Android, App Groups + UserDefaults for data sharing, and
sparing `WidgetCenter.reloadAllTimelines()`. None is installed. Slice 21 ships
faithful **in-app previews** (`app/routine/widgets.tsx`) of all three + the
Live-Activity **opt-in** toggle (`live_activity_enabled`); the interactive check-off,
when built, writes `routine_completions` through the same idempotent path. Verify
the iOS-17 fallback (tap-to-open) on older iOS at build time.

### B-NOTIF-VERIFY — on-device notification delivery + Android-14 exact alarms 🟡 stubbed
docs/07 §3.5/§9: the local-notification **scheduling** is built against the real
`expo-notifications` SDK-56 API (`SchedulableTriggerInputTypes.DAILY`, the new
`shouldShowBanner/List/PlaySound` handler, an Android `routine` channel) in
`features/notifications/deliver.ts`, **guarded to no-op off-device**. Needs on-device
verification: the single **iOS opt-in prompt**, **Android-14 inexact alarms** (we use
`DEFAULT` importance + DAILY triggers and do **not** claim `USE_EXACT_ALARM`; if any
exact-alarm API is ever added, guard with `canScheduleExactAlarms()` or it crashes),
timezone correctness, and quiet-hours suppression. Also add the `expo-notifications`
config plugin (icon/sound) at native-build time. No live device/Mac here (shares
B-VERIFY-METRO's constraint).

### B-EVERY-N-DAYS — `every_n_days` step frequency has no interval column 🔴 open
docs/01 §3 lists `every_n_days` as a valid `routine_steps.frequency` value but
specifies **no column** to store the interval (e.g. "every 3 days"). Per
CLAUDE.md (don't invent schema), the column was intentionally omitted from
`routine_steps`. The routine-builder / skin-cycling docs (Documents 3 & 5,
missing) should specify how the interval is represented; add the column then.
Discovered during the Slice 1 RLS review.
