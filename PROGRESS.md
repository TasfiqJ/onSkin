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
  conflict_rules) from the docs/00 §2 sketch (data BLOCKED: B-CONFLICT-RULES).
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

## In progress / remaining docs/02 work

- **PM auto-resolution live screen (§7.4)** — scheduler logic + `pmResolution` are
  built + tested, but rendering the live night-strip + "next acid night" needs a
  **cycle setup (anchor + template)** established by the routine builder
  (Document 3, not present). Deferred to Doc 3; not inventing the cycle schema.
- **Barcode scan + manual add + OBF lookup (§7.5)** — needs camera + the live OBF
  API + catalog seed (B-CATALOG-SEED).
- Blocked data/clinical: **B-DERM-REVIEW** (launch gate), **B-CATALOG-SEED**.

## Next (per docs/00 build order)
1. ✅ scaffold → **Slice 1: Auth + data model + RLS** (in progress)
2. 🚫 Ingredient/product DB + conflict engine — needs Document 2 (schema sketched only)
3. 🚫 AM/PM routine builder — needs Document 3 (tables exist)
4. 🚫 Smart shelf (PAO/expiry) — needs Document 4
5. 🚫 Actives / skin-cycling scheduler — needs Document 5
6. 🚫 Guided photo capture + comparison — needs Document 6
7. 🚫 Reminders / streaks / widgets — needs Document 7
8. 🟡 Subscriptions / paywall — design-spec paywall buildable; RC config blocked (Document 8)
9–12. 🚫 recommendations / creator stacks / community / AI — need their docs

## Open questions for the founder
- See [BLOCKERS.md](BLOCKERS.md) — consolidated. Highest priority: Documents 2–15
  are missing from /docs (B-MISSING-DOCS); legal copy + quiz questions (B-QUIZ-COPY,
  B-PRIVACY-COPY); and the account/key items (Supabase, RevenueCat, Apple, Google,
  PostHog, Sentry, Turnstile).
