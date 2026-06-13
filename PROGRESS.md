# Build Progress

Tracks the build against docs/00 §"build order". One slice per commit.
See [DECISIONS.md](DECISIONS.md) for implementation choices and
[BLOCKERS.md](BLOCKERS.md) for everything waiting on the founder.

Legend: ✅ done · 🟡 partial (built around a blocker) · ⬜ not started · 🚫 blocked on missing doc

---

## Done

### Slice 0 — Project scaffold & tooling ✅ (2026-06-12)
- Turborepo monorepo: `apps/mobile` (Expo SDK 56) + `packages/types` (`@onskin/types`) + `supabase/` (next slice).
- Expo SDK 56 baseline (RN 0.85.3 / React 19.2.3), expo-router, New Architecture on.
- NativeWind v4 + Tailwind v3.4 wired (babel/metro/tailwind config) with the
  "paper · greige · clay · ink · night" design-token palette + Instrument Serif /
  Hanken Grotesk font families from the design spec.
- TypeScript (strict) + ESLint 9 flat config (eslint-config-expo) + Prettier.
- `@onskin/types` shared domain enums (consents, axes, goals, routines, conflicts,
  analytics taxonomy) derived from docs/01 §3 + design spec.
- Tracking files: DECISIONS.md, BLOCKERS.md (seeded), .env.example (every var documented).
- **Gates:** `turbo run typecheck` ✅ · `eslint` ✅. (App not runtime-tested — no
  Mac/simulator in this environment; flagged B-VERIFY-METRO.)

### Slice 1 — Data model + RLS ✅ (2026-06-12)
- All 12 tables from docs/01 §3 as Supabase migrations (0001–0011): profiles
  (+defensive signup trigger), skin_profiles, user_products (generated PAO/expiry),
  routines + routine_steps (+`owns_routine` helper), append-only routine_completions
  (48h backfill cap + computed/cached streaks), photos (+private Storage bucket,
  anon cloud-backup blocked), entitlements + subscriptions_events, immutable
  consents ledger, notification_preferences. Catalog tables (ingredients/products/
  conflict_rules) from the docs/00 §2 sketch (later rewritten to the docs/02 §3
  schema in Slice 7; data BLOCKED: B-CATALOG-SEED + B-DERM-REVIEW).
- RLS on every table: `(select auth.uid())`, `TO authenticated`, `WITH CHECK`,
  indexed policy columns, security-definer helpers, all definer fns REVOKE'd.
- **Adversarially reviewed by 4 independent agents** (RLS-bypass / SQL-executability
  / spec-fidelity / advisor-lints); fixed a definer-RPC IDOR, ownership-checked
  completion inserts, NULLS-NOT-DISTINCT dedup, tz-tolerant backfill, delete-streak
  recompute, and DB-level consent immutability. See DECISIONS D-011…D-015.
- Hand-authored `Database` type in `@onskin/types` matching the migrations
  (regenerate via `supabase gen types` once the project exists).
- **Gates:** typecheck ✅ · lint ✅. (Migrations not applied — no live DB; re-run
  Supabase Advisors on first `db push`.)

### Slice 2 — Supabase client + auth foundation ✅ (2026-06-12)
- `LargeSecureStore` AES-256 token storage (docs/01 §5): AES key in SecureStore,
  encrypted session in AsyncStorage (dodges the ~2KB SecureStore limit).
- Typed `supabase` client (`createClient<Database>`) with
  `autoRefreshToken`/`persistSession`/`detectSessionInUrl:false` + URL polyfill.
- `AuthProvider`: session state via `onAuthStateChange`, `AppState`-driven
  start/stop auto-refresh; methods — `ensureAnonymousSession` (guest-first),
  Apple (`signInWithIdToken`), Google (v16 `signIn` → idToken), email OTP
  (`signInWithOtp`/`verifyOtp`). Verified all APIs against installed versions.
- `recordConsent`/`getLatestConsents` writing the immutable ledger with a
  SHA-256 hash of the exact text + version (final copy BLOCKED: B-PRIVACY-COPY).
- TanStack Query client; providers wired into the root layout.
- Edge Functions (Deno, service-role): `revenuecat-webhook` (idempotent on
  event.id, reads event.app_user_id), `account-deletion` (Apple 5.1.1(v) order:
  SIWA-revoke → delete user → purge Storage → RC/PostHog deletion), `data-export`
  (GDPR Art. 20 JSON). External provider calls stubbed (B-REVENUECAT/B-APPLE/B-POSTHOG).
- **Gates:** typecheck ✅ · lint ✅. New blocker: B-VERIFY-AUTH-LINKING.

### Slice 3 — Design system ✅ (2026-06-12)
- Instrument Serif + Hanken Grotesk loaded; splash held until ready. JS tokens,
  haptics. Primitives: Text/Button/Card/ProgressBar/OptionCard/Chip/Screen.
- **Bundle validated:** `expo export --platform ios` succeeded (Metro resolved the
  `@onskin/types` workspace import + NativeWind transform + fonts) → B-VERIFY-METRO
  largely de-risked.

### Slice 4 — Onboarding flow ✅ (2026-06-12)
- Full guest-first sequence (docs/01 §2 + design spec): welcome (silent anon
  session) → goals (multi-select ≤2) → unbundled health-data consent → quiz →
  products (skip) → analyzing theater → reveal (DSPT + axis sliders) →
  notification priming → account (SIWA/Google/email-OTP) → paywall (single annual
  offer, no trial toggle) → temp home.
- Quiz **engine** (real 4-axis scoring → DSPT + 0..1 slider positions) with
  **placeholder questions** (BLOCKED: B-QUIZ-COPY). OnboardingContext accumulates
  answers, persists skin_profiles at the reveal.
- Consent recorded to the immutable ledger at the health-consent + account steps
  (placeholder copy hashed; BLOCKED: B-PRIVACY-COPY).
- docs/01 §7 funnel events instrumented via a `track()` shim (PostHog in slice 9).
- All backend calls are best-effort/guarded so the flow is fully navigable before
  Supabase/RevenueCat are configured. RevenueCat purchase stubbed (B-REVENUECAT).
- **Gates:** typecheck ✅ · lint ✅.

### Slice 5 — App shell + Today activation loop ✅ (2026-06-12)
- 4-tab bottom navigation (Today/Progress/Shelf/You) with the design-spec clay-dot
  active indicator.
- **Today** screen (design spec p.8/9): AM light / PM dark, time-aware greeting,
  streak chip, routine card with tappable **check-off** wired to
  `routine_completions` (the activation metric, docs/01 §7) via an optimistic
  TanStack mutation + streak read from `profiles`. Honest empty state where a
  routine doesn't exist yet (routine builder = Document 3, blocked).
- Progress + Shelf tabs: design-spec-faithful placeholders citing their blocked
  docs (6, and 2/4). You tab: account status + sign out (full privacy controls
  next slice).
- Welcome now gates: an onboarded returning user (completed skin_profile) is sent
  straight to `/today` (modeled as a query — no setState-in-effect).
- **Gates:** typecheck ✅ · lint ✅.

### Slice 6 — You / privacy & account controls ✅ (2026-06-12)
- **Biometric app-lock** (expo-local-authentication, docs/01 §5): opt-in Face ID
  to open the app; `AppLockProvider` locks on cold start + return-from-background;
  fully functional standalone (no backend needed).
- **Account deletion** (Apple 5.1.1(v)): confirm dialog → `account-deletion` Edge
  Function → sign out → welcome.
- **Data export** (GDPR Art. 20): `data-export` Edge Function → cache file → OS
  share sheet (`expo-file-system/legacy` + `expo-sharing`).
- **Consent center**: marketing + data-sharing opt-in toggles (separate from
  collection per MHMDA), writing the immutable ledger; notification toggles
  (`notification_preferences`).
- All backend writes guarded/optimistic; functional before config.
- **Gates:** typecheck ✅ · lint ✅.

### Slice 7 — Intelligence catalog + conflict schema (docs/02 §3) ✅ (2026-06-13)
- Rewrote the catalog (migration 0003) to the docs/02 §3 spec: `ingredients`
  (+synonyms, +tags), `products` (category/PAO/curated + tsvector search),
  `product_ingredients`, **tag-based** `conflict_rules`, `ingredient_pao_defaults`.
- New per-user `routine_conflicts` cache (owner RLS + `owns_user_product()` check).
- Seeded the ~14 starter rules (docs/02 §4.4/§4.8) + PAO category defaults — all
  `reviewed_by = NULL` (BLOCKED: **B-DERM-REVIEW**, launch gate).
- `@onskin/types` extended (InteractionType, EvidenceLabel/Grade, ResolutionType,
  FunctionalTag, …) + Database type updated.
- **Adversarially reviewed by 3 agents** (RLS / SQL+fidelity / claim-safety) →
  fixed product-ownership RLS, nullable evidence_grade for refuted myths,
  over-stated safety evidence labels, and BHA pregnancy dose-gating. D-016…D-021.
- **Gates:** typecheck ✅ · lint ✅.

### Slice 8 — Conflict / synergy engine + fixture tests (docs/02 §4) ✅ (2026-06-13)
- Pure TS engine: tag dictionary, bundled starter ruleset (mirrors DB seed by
  fixed id), tag-based both-orders detection, concentration+sensitivity severity
  modulation, sub-flag exemptions, pregnancy pseudo-tag safety + dose-gating,
  resistant co-use, reassurance/synergy surfacing, safety-first ranking.
- **vitest fixture suite (12 tests, all passing)** incl. the Maya worked example
  (Moderate / contested / alternate_nights), niacinamide×vitC reassurance,
  BP×retinoid + adapalene exemption, pregnancy safety + BHA dose-gate, synergy.
  `npm test` is now real (the doc mandates per-rule fixtures, §10).
- **Gates:** typecheck ✅ · lint ✅ · test ✅.

### Slice 9 — Skin-cycling scheduler (docs/02 §5) ✅ (2026-06-13)
- Pure TS: cycle templates (classic 4-night / gentle / advanced) personalised by
  sensitivity + barrier-repair goal (null when no actives); date-only (local-day)
  night/slot computation; next-acid-night projection; PM auto-resolution logic
  (skip the acid on a retinoid night, name the next acid night).
- **13 vitest fixtures** (incl. the spec's NIGHT 2 OF 4). 25 tests at this point.
- **Gates:** typecheck ✅ · lint ✅ · test ✅.

### Slice 10 — PAO intelligence + Shelf & conflict-detail surfaces ✅ (2026-06-13)
- PAO/expiry helper (docs/02 §6): label → category default → honest "unknown"
  (never fabricated), `computeExpiry`, badge taxonomy (date/countdown/expired/
  unknown). 8 vitest fixtures (33 total).
- `useShelf` hook: loads products + skin profile, tags via the client dictionary,
  runs the **launch-gated** engine (`shippableRules` — only `reviewed_by` rules
  surface in prod), computes PAO badges, derives the calm banner + reassurances.
- Shelf screen (design spec p11–12): title+count, All/Actives/Expiring filters,
  calm `ConflictBanner` (clay, never red), reassurance card, product cards with
  PAO badges, empty state, "Scan a barcode" FAB.
- Conflict-detail screen (spec p13, the trust set-piece): severity + evidence
  chips, claim-safe mechanism, "OUR SUGGESTION", affected products, source +
  honesty note, "Keep" / "Use together anyway" (records to `routine_conflicts`).
- Scan screen = honest placeholder (barcode/OBF = next slice).
- **Gates:** typecheck ✅ · lint ✅ · test ✅ (33).

### Slice 11 — Claim-safety regression guard (docs/02 §7.7/§9) ✅ (2026-06-13)
- Test guard asserting no drug/disease verbs (treats/cures/heals/diagnose/
  stimulates collagen/repairs DNA) and no alarm words (danger/harmful/warning/
  avoid/!) in any rule's `mechanism`/`resolutionCopy`, plus invariants
  (all `reviewed_by` null, unique ids, safety rules `avoid_refer`+pregnancy-gated,
  no safety rule labelled `established`). Survives every future rule edit.
- The guard caught one non-compliant string (rule 8 "Avoid using…") → rewritten
  calm/resolution-first in both `rules.ts` and the SQL seed. **63 tests pass.**

### Slice 12 — Routine-builder schema + generation engine (docs/03 §2–§5) ✅ (2026-06-13)
- Migrations: `sequencing_rules` (catalog, ~10 starter rules) + `active_ramp`
  (per-user, owner RLS). `@onskin/types` + Database type extended.
- Pure TS engine: role classification (tags>name), canonical sequencing,
  AM/PM allocation, retinoid ramp (offer-only step-up + de-escalation),
  `generatePlan` pipeline consuming the docs/02 engine + scheduler.
- 44 new fixtures incl. the **Maya worked example** (AM order, cycling nights,
  gentle cycle, 2×/wk ramp, retinoid×glycolic moderate/alternate_nights). 77 tests.

### Slice 13 — Exact design tokens from the Claude Design handoff ✅ (2026-06-13)
- Fetched + extracted the `.dc.html` bundle; ran a 3-agent extraction of the exact
  tokens + 13 per-screen specs. Aligned the palette to canonical hexes
  (paper #FAF7F2, clay #A5694B + sage/green system + severity ramp + amber +
  cream), added **IBM Plex Mono** (3-font system). Whole app re-themed via tokens.

### Slice 14 — Calm Progress / streak screen (docs/03 §6/§9.5, design 06) ✅ (2026-06-13)
- The flagship Doc-3 daily surface: weekly adherence ("N of 7 nights"), a month
  **heat-map** (4-level intensity), and a grace-day **"Streak protected"** sage
  card — no shame copy, recovery counts. Reads the append-only completions log +
  cached streak. Replaces the Progress placeholder. typecheck + lint + test green.

### Slice 15 — Routine builder "Generate" screens (design 01–03) ✅ (2026-06-13)
- `usePlan` (live `generatePlan` over the shelf; Maya example fallback). Plan-built
  "Start today" (sequenced AM + cycling PM + ramp default + honest gap note),
  drag-reorder edit with the non-blocking "Fix the order" nudge, retinoid ramp
  chart + offer-only step-up.

### Slice 16 — Today AM/PM daily loop + tolerance (design 04/05/07) ✅ (2026-06-13)
- Today rebuilt to exact design: AM (paper) streak pill + morning check-off +
  Tonight teaser; PM (night) skin-cycling strip + evening check-off + the Doc-2
  **auto-resolution banner** ("next acid night") computed from the scheduler +
  a persisted cycle anchor. Optional non-diagnostic weekly tolerance check-in sheet.

### Slice 17 — Routine builder "Living & in control" (design 08–10) ✅ (2026-06-13)
- Conflict **override sheet** (bottom-sheet; adapts for standard / myth-reassure /
  safety-defer; "Use together anyway" persists, "we won't re-nag"). Adaptation
  "Here's what changed" recompute view. Widgets + Live Activity preview.
- Paywall now hands off to the plan-built screen; You tab links the routine screens.

**Document 3 design is visually complete** (all 10 builder screens + the 3 core
screens re-themed). Remaining for live end-to-end: a manual-add shelf flow +
B-SUPABASE (data surfaces render the exact design but are empty until then),
full drag-and-drop (handles + nudge built; needs react-native-draggable-flatlist),
and routine persistence (server `build_routine`, docs/03 §11).

### Slice 18 — Doc 4 Smart Shelf + new design (docs/04, "OnSkin Smart Shelf") ✅ (2026-06-13)
- **Schema** (migration 0016): additive `user_products` columns (`is_opened`,
  `finished_at`, `nickname`, `notes`, `thumbnail_path`, `pao_source`,
  `expiry_source`, `added_via`) + the owner-RLS `shelf_scans` intake/contribute-back
  log + the `(user_id, status, expiry_computed)` Expiring index. `created_at`/
  `updated_at` already existed (0005) — not re-added. `Database` type + `@onskin/
  types` extended to match. Owner-only RLS throughout (D-028 adds the contribute-
  back UPDATE policy); no RLS weakened.
- **Local-first store** (D-029): `features/shelf/store.ts` (AsyncStorage) is the
  v1 source of truth (offline-first, docs/04 §8), with a guarded `user_products`
  Supabase mirror (B-SUPABASE). `useShelf` moved to `features/shelf/`; `usePlan` +
  the conflict-detail sheet now read the **real** cabinet.
- **Five-state badge taxonomy** (docs/04 §5.3): `pao.ts` extended with `paired` +
  the eye/SPF firmer "Replace for safety" (never red); new `ExpiryBadge` component
  with the exact design colours; new `SegmentChip` (ink-fill filter) + `Sheet`
  (dimmed bottom-sheet) primitives.
- **Intake funnel** (docs/04 §4, design screens 01–04): the no-match fork
  (dark sheet → OCR/manual + contribute-back), OCR-confirm (parses a sample INCI
  through the real tag dictionary; flags a low-confidence token, dashed), the
  always-works manual form, and the **opened-date linchpin** sheet (Just opened /
  Pick a date / Not opened yet + editable, source-labelled PAO). Live camera/OBF/
  OCR capture stubbed (B-CATALOG-SEED).
- **Shelf list** (screen 05) rebuilt to the design (count, All/Actives/Expiring,
  calm banner, cards, centered FAB, empty state); **product-detail hub** (06:
  freshness w/ provenance + inline opened-date & printed best-before edits, actives,
  conflicts/pairings, where-it's-used, lifecycle actions); **archive/lifecycle**
  (08, repurchase history); **replenishment** sheet (09: honest PAO trigger,
  opt-in, affiliate inert behind **B-PRIVACY**).
- **PAO defaults launch-gated** (D-032): `pao.ts` mirrors `shippableRules` —
  unreviewed numbers degrade to honest "PAO est." in production until
  **B-DERM-REVIEW** sign-off.
- **Adversarially reviewed by 4 agents** (RLS/SQL · spec fidelity · design fidelity
  · claim-safety/privacy, each with a verification pass) → **0 blocking/high**;
  fixed the lower-severity items (PAO gate, printed-expiry capture, badge border
  scope, OCR dashed flag, monochrome bin glyph, label consistency, B-PRIVACY
  marker). D-026…D-033; new blockers **B-PRIVACY**, **B-SHELF-CONTRIB**.
- **Gates:** typecheck ✅ · lint ✅ · test ✅ (87).

### Slice 19 — Doc 5 Actives & Skin-Cycling Scheduler + new design ✅ (2026-06-13)
- **Schema** (migration 0017): the stored/versioned `cycles` + `cycle_nights` (the
  part `cycling_night` alone never captured) with owner-only RLS via a new
  `owns_cycle()` definer helper (mirrors `owns_routine`). `Database` type + domain
  types extended; no RLS weakened.
- **Engine** (`features/scheduler/`, pure + tested): `classes.ts` (active class +
  frequency caps + AM/PM placement, **launch-gated** via `CAPS_REVIEWED`),
  `orchestrate.ts` (**multi-active orchestration** — one potent active/night, the
  **retinoid×exfoliant never-same-night** rule enforced by construction, caps,
  recovery nights, vitamin-C-in-AM, pregnancy suppression with a note that survives
  even when no cycle forms, phased introduction), `projection.ts` (the pure
  local-day projection → tonight / week-ahead / next-acid), `cycleStore.ts`
  (local-first config: variant/anchor/pause/recovery/skips; resume re-anchors
  where-left-off), `profile.ts` (shared profile reader), `useCycle.ts`.
  **17 fixtures** assert the FIRM invariants.
- **7 surfaces** (`app/cycle/`): week overview (dark), "why tonight?" trace,
  cycle settings (variant + assignment + firm-rule nudge), disruption hub
  (skip/pause/travel/procedure), post-procedure recovery, auto-de-escalation
  recovery mode, phased-introduction.
- **Wiring**: Today PM strip + AM teaser now driven by the orchestrated,
  profile-aware cycle (so pregnancy suppression / recovery / skip are never
  contradicted by a hardcoded surface); recovery/pause/skip banners on Today PM;
  the weekly tolerance "irritated" answer triggers auto-de-escalation;
  `usePlan` now reads the real skin profile (not a hardcoded `pregnancy:false`).
- **Adversarially reviewed by 4 agents** (RLS/SQL · spec · design · claim-safety,
  each verified) → **0 blocking, 4 high** — all fixed: skip made functional, the
  pregnancy safety note made un-droppable, the frequency caps launch-gated
  (`CAPS_REVIEWED`), and Today rewired off the hardcoded retinoid teaser/template
  onto the profile-aware engine. D-034…D-037.
- **Gates:** typecheck ✅ · lint ✅ · test ✅ (104).

## Remaining shelf/intelligence work (blocked sub-parts)

- **Live barcode scan + OBF lookup + OCR capture (docs/04 §4.1/§4.3)** — the
  fallback + confirm UIs are built; the on-device camera, the live OBF v2 API
  (one call/scan), and ML Kit text recognition need **B-CATALOG-SEED** + the
  native camera (shared with the photo slice).
- **OBF contribute-back pipeline (docs/04 §4.6)** — schema + no-match UI built;
  the queued authenticated POST job needs **B-SHELF-CONTRIB** (OBF write creds).
- **Replenishment affiliate (docs/04 §6)** — sheet built opt-in + inert; live
  "see similar"/affiliate routing is gated by **B-PRIVACY** (data-sharing consent)
  + **B-SHOPMY** + **B-CATALOG-SEED**.
- **PM auto-resolution live screen (docs/02 §7.4)** — built + tested + now driven
  by the Doc-5 orchestrated cycle (Slice 19).
- **Server-authoritative scheduler** (`orchestrate()`/`schedule_for()`, docs/05 §10)
  — deferred with **B-SERVER-DETECT**/B-ROUTINE-PERSIST; the tested client engine +
  local-first store cover v1.
- **Drag-to-reassign cycle nights** (docs/05 §6.2) — handles + rule nudge built;
  true drag is **B-DRAG-DND**.
- Blocked data/clinical: **B-DERM-REVIEW** (launch gate; now also gates the PAO
  category defaults + the scheduler frequency/recovery rules), **B-CATALOG-SEED**.

## Next (per docs/00 build order)
1. ✅ scaffold → Auth + data model + RLS (Slices 0–6)
2. ✅ Ingredient/product DB + conflict engine — Doc 2 (Slices 7–11)
3. ✅ AM/PM routine builder — Doc 3 (Slices 12–17)
4. ✅ Smart shelf (PAO/expiry) — Doc 4 (Slice 18); blocked sub-parts above
5. ✅ Actives / skin-cycling scheduler — Doc 5 (Slice 19): stored cycle + projection, multi-active orchestration, management/disruption surfaces
6. 🚫 Guided photo capture + comparison — needs Document 6
7. 🚫 Reminders / streaks / widgets — needs Document 7 (delivers the scheduler's reminders + replenishment + streak nudges)
8. 🟡 Subscriptions / paywall — design-spec paywall buildable; RC config blocked (Document 8)
9–12. 🚫 recommendations / creator stacks / community / AI — need their docs

## Open questions for the founder
- See [BLOCKERS.md](BLOCKERS.md) — consolidated. Highest priority: Documents 2–15
  are missing from /docs (B-MISSING-DOCS); legal copy + quiz questions (B-QUIZ-COPY,
  B-PRIVACY-COPY); and the account/key items (Supabase, RevenueCat, Apple, Google,
  PostHog, Sentry, Turnstile).
