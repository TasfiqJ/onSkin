# Decisions Log

Small, reversible implementation choices NOT dictated by `/docs`. Anything with
schema / privacy / RLS / legal / cost / account implications goes to
[BLOCKERS.md](BLOCKERS.md) instead and is built around, not decided here.

Format: `D-NNN — date — decision — rationale`.

---

## Scaffold & tooling

- **D-001 — 2026-06-12 — Expo SDK 56 (not the "52+" the docs cite).** SDK 56 is
  the current stable release (`expo@56.0.11`, React Native 0.85.3, React 19.2.3)
  as verified against npm at build time. The docs' "Expo SDK 52+ / New Arch" is
  satisfied — New Architecture is the default in SDK 56. Pinned versions come
  from the official `create-expo-app` template so the whole native set stays
  mutually compatible; additions use `expo install` for the same reason.

- **D-002 — 2026-06-12 — Turborepo monorepo** (`apps/mobile` + `packages/types`
  + `supabase/`), per docs/00 §9 ("Turborepo monorepo with shared TS packages").
  Shared `@onskin/types` package holds the Supabase `Database` type + domain
  enums so the mobile client and Edge Functions share one source of truth.
  NOTE: Metro's monorepo module resolution cannot be runtime-verified in this
  environment (no Mac/simulator/device). Standard Expo monorepo `metro.config.js`
  is used; flagged for first-device verification (see BLOCKERS B-VERIFY-METRO).

- **D-003 — 2026-06-12 — expo-router (file-based navigation).** Not specified in
  docs; expo-router is the current Expo default and what the template ships.
  Reversible.

- **D-004 — 2026-06-12 — NativeWind v4 + Tailwind CSS pinned to 3.4.x.** docs/00
  §8 specifies "design tokens → NativeWind." NativeWind v4's peer dep is
  `tailwindcss >3.3.0`, but it is built against the Tailwind **v3** config format
  (`tailwind.config.js` content/theme), so Tailwind v4 (CSS-first config) is
  avoided to prevent an untestable broken build. Pinned `tailwindcss@^3.4`.

- **D-005 — 2026-06-12 — Fonts via `@expo-google-fonts`:** Instrument Serif
  (display) + Hanken Grotesk (UI), the exact families named on the design spec
  cover page. Both are SIL OFL (zero-cost, embeddable) per docs/00 §8's free
  route. A monospaced face (system mono) is used for the spec's caption/label
  treatment ("01 · Welcome", "2 of 4", "NEXT").

- **D-006 — 2026-06-12 — App identifiers:** bundle id `com.onskin.app`, URL
  scheme `onskin://`. Placeholder defaults; must match the registered App
  ID / Play package once accounts exist (see BLOCKERS B-APPLE / B-GOOGLE).

- **D-007 — 2026-06-12 — Offline/data layer: TanStack Query + a persisted
  mutation queue** for v1, exactly per docs/01 §6 recommendation. Persistence
  via AsyncStorage. Legend-State/PowerSync deferred to a future multi-device
  decision.

- **D-008 — 2026-06-12 — Face detection lib: `react-native-vision-camera-face-detector@2.0.1`**
  (ML Kit-backed, cross-platform) over a custom Apple Vision Swift plugin for
  v1. docs/00 §4 presents both; the ML Kit wrapper is the lower-risk
  cross-platform path and stores no faceprint template (BIPA-safe). Camera
  capture is a later slice; only the dependency choice is logged here.

- **D-009 — 2026-06-12 — Token storage: LargeSecureStore (AES-256) pattern**
  exactly as docs/01 §5 prescribes — `expo-secure-store` holds an AES key,
  `aes-js` encrypts the Supabase session JSON into AsyncStorage to dodge the
  ~2KB SecureStore limit. `react-native-get-random-values` polyfills CSPRNG.

- **D-010 — 2026-06-12 — Supabase client flags:** `autoRefreshToken: true`,
  `persistSession: true`, `detectSessionInUrl: false` (docs/01 §5), with
  `AppState`-driven start/stop of auto-refresh.

## Data model & RLS (Slice 1, hardened after an adversarial RLS review)

- **D-011 — 2026-06-12 — `longest_streak` is a non-decreasing personal best.**
  `recompute_streak` sets `current_streak` to the live value but uses
  `greatest(longest_streak, computed)` so a user's all-time best never shrinks
  if completions are later deleted. `current_streak` IS recomputed on both INSERT
  and DELETE of completions so the live streak stays accurate. The doc calls
  streaks "computed/authoritative, cached" — this keeps the live value
  authoritative while treating longest as a badge.

- **D-012 — 2026-06-12 — Completion validation window is timezone-tolerant
  `[current_date − 2, current_date + 1]`.** `completed_date` is the user's LOCAL
  day while the server's `current_date` is UTC, so the guard allows +1 day ahead
  (users east of UTC) and ~48h of backfill behind. This is a deliberate v1
  heuristic; precise per-user-timezone validation (using
  `notification_preferences.timezone`) is a later refinement, not a founder
  blocker.

- **D-013 — 2026-06-12 — All `SECURITY DEFINER` functions hardened with
  `REVOKE`.** Found by the RLS review: definer functions keep Postgres' default
  `EXECUTE`-to-PUBLIC grant and are exposed as PostgREST RPCs, so any user could
  call `recompute_streak('<victim>')` and write another user's profile row.
  Fix: `revoke all ... from public, anon, authenticated` on every definer
  function except `owns_routine` (kept executable by `authenticated` because RLS
  policies invoke it). Triggers still fire (they run as the table owner).

- **D-014 — 2026-06-12 — Completion INSERT proves routine/step ownership.**
  `WITH CHECK` now also requires `owns_routine(routine_id)` (and step ownership)
  so a user can't log completions against another user's routine — FKs only
  check existence, not ownership.

- **D-015 — 2026-06-12 — `consents` is immutable at the DB layer.** A
  `BEFORE UPDATE` trigger blocks all updates (even service-role) so consent
  history can't be rewritten; revocation is a new row. DELETE is left open so the
  account-deletion FK cascade still works.

## Ingredient intelligence layer (docs/02, Slices 7–8)

- **D-016 — 2026-06-13 — Catalog/rule tables world-readable to authenticated
  (incl. anonymous), service-role write only** (docs/02 §3). Product intake
  happens during the pre-account quiz, so anon (who hold the `authenticated`
  role) must read the catalog; `conflict_rules` exposes only `is_active` rows.
  The Slice-1 docs/00 §2 catalog *sketch* (migration 0003) was rewritten to the
  docs/02 §3 schema — it was a never-applied placeholder, so editing forward is
  clean (no deployed DB; B-SUPABASE).

- **D-017 — 2026-06-13 — Conflict rules match on FUNCTIONAL TAGS, not INCI ids**
  (docs/02 §2.4/§4). It's the acid-ness / retinoid-ness that interacts. A
  client-side starter tag dictionary (`features/intelligence/tags.ts`) covers the
  active families so manual/OCR/curated products tag without the full CosIng seed.

- **D-018 — 2026-06-13 — `routine_conflicts` is a per-user, owner-RLS, recomputed
  cache** the tested client engine upserts (docs/02 §3). Insert/update prove
  ownership of referenced products via `owns_user_product()` (RLS-review finding,
  D-014 pattern). rule_id may reference a now-inactive rule by design (audit;
  `rule_version` records which version produced the row).

- **D-019 — 2026-06-13 — `conflict_rules.evidence_grade` is nullable; NULL = the
  doc's "—" for refuted myths** (docs/02 §4.3). The consumer `evidence_label`
  ('refuted') drives presentation; a debunked myth isn't recorded as a real SORT
  grade. (RLS/fidelity-review finding.)

- **D-020 — 2026-06-13 — One TESTED detection implementation (client TS), with a
  per-rule fixture suite (vitest).** docs/02 §10 mandates fixture tests for this
  liability surface. The bundled ruleset (`rules.ts`) mirrors the DB seed by
  FIXED rule id; the engine prefers cached-DB rules at runtime (docs/02 §10) and
  falls back to the bundle offline. The doc's server-authoritative
  `detect_conflicts()` PL/pgSQL twin is deferred (B-SERVER-DETECT) — a single
  tested impl is safer than an untestable SQL twin that could diverge.

- **D-021 — 2026-06-13 — Evidence labels stay honest, not inflated** (review
  finding): the 3 pregnancy `safety` rules are `contested` (caution, not
  demonstrated harm — docs/02 §4.8), with conservatism carried by `high`
  severity + `avoid_refer`, not by the evidence label. `bha × pregnancy` is
  dose-gated (`requiresHighDose`) so it doesn't false-alarm on low-dose BHA.

## Routine builder (docs/03, Slice 12+)

- **D-022 — 2026-06-13 — Application order is versioned DATA, not hard-coded**
  (docs/03 §3): `sequencing_rules` (catalog-style, world-readable) holds
  role→priority/phase/eligibility; the engine sorts by it. Pure ordering is
  low-risk cosmetic; the ramp/frequency/cycling on top are medical-adjacent and
  fall under B-DERM-REVIEW. Roles classified by functional TAGS first, then name
  keywords (a "glycolic toner" is an exfoliant, not a toner).

- **D-023 — 2026-06-13 — Retinoid ramp is per-user recomputable state**
  (`active_ramp`, docs/03 §4): "start low and slow" — sensitive start 2×/wk,
  resistant 3×/wk; step-ups are **offer-only** (never silent, ~21-day gate);
  auto **de-escalate** on self-reported irritation. Numbers are B-DERM-REVIEW
  starting positions.

- **D-024 — 2026-06-13 — Deterministic generator, not an AI router** (docs/03 §1):
  the plan is generated from curated rules + profile + shelf (classify → allocate
  → sequence → cycle/ramp → detect_conflicts → render), fully explainable and
  testable (Maya worked example asserted). `generatePlan` takes an injectable
  rule set (cached-DB rules at runtime; B-DERM-REVIEW gate via `shippableRules`).

- **D-025 — 2026-06-13 — Calm, forgiving streak** (docs/03 §6, Lally 2010 +
  streak-backfire literature): weekly adherence + month heat-map, grace-day
  "Streak protected", recovery nights count, no shame copy. (Implemented in the
  Progress screen, Slice 14+.)
