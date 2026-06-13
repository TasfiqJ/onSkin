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

## Smart Shelf (docs/04, Slice 18)

- **D-026 — 2026-06-13 — Product thumbnails are on-device by default**
  (docs/04 §7 / §2; the doc's suggested "D-024"). `user_products.thumbnail_path`
  is a LOCAL device path; cloud upload only on the same explicit opt-in that
  governs progress photos (docs/01 §3). The shelf is health-inference data, so
  this matches the photo-privacy posture. UI placeholders are striped greige.

- **D-027 — 2026-06-13 — Provenance recorded on every shelf row**
  (docs/04 §3 / §2; the doc's suggested "D-023"). `pao_source`
  ('label'|'catalog'|'category_default'|'unknown') and `expiry_source`
  ('printed'|'pao_computed'|'estimated'|'unknown') so the UI is honest about
  estimates and **never fabricates a precise date**. The PAO sourcing waterfall
  (label/catalog → category default → honest unknown) lives in `pao.ts`
  (`resolvePaoMonths`) + `shelf/expiry.ts` (`surfacedExpiry`); printed expiry
  wins for sunscreen via the `least()` semantics already in the generated column.

- **D-028 — 2026-06-13 — `shelf_scans` gets an owner-only UPDATE policy.**
  docs/04 §2's SQL snippet shows only SELECT + INSERT, but the prose (§4.6) has
  the contribute-back job flip `contributed_back → true` — an UPDATE. Added an
  owner-scoped UPDATE policy (same `(select auth.uid()) = user_id` pattern); no
  DELETE policy (account-deletion cascade handles removal; no user-facing delete).
  Does not weaken any existing RLS.

- **D-029 — 2026-06-13 — Local-first shelf store (AsyncStorage) is the v1 source
  of truth**, with a best-effort Supabase mirror. docs/04 §8 mandates the shelf
  works offline (view + manual-add + queued lookups in a bathroom with no
  signal); single-user last-write-wins is safe. `features/shelf/store.ts` holds
  the cabinet; intake also fires a guarded `user_products` insert (B-SUPABASE) so
  it reconciles via the persisted mutation queue (D-007) once the project exists.
  This unifies the data source: `usePlan` + the conflict-detail sheet now read the
  real shelf via `useShelf` (moved to `features/shelf/`).

- **D-030 — 2026-06-13 — Simplified opened-date + PAO pickers for v1.** The
  opened-date "Pick a date" uses relative quick-picks (2 wks / 1 / 3 / 6 mo ago)
  and PAO edits via common-value chips (3/6/9/12/18/24 mo), avoiding a native
  date-picker dependency. The design's own Next-steps lists "inline opened-date /
  PAO edit pickers" as a follow-on, so a full calendar picker is a known later
  refinement, not a gap.

- **D-031 — 2026-06-13 — Badge precedence + the calm safety treatment**
  (docs/04 §5.3). `expiryBadge` is date-driven: expired > countdown > (paired |
  date) > unknown. "paired" overrides ONLY the calm future-date slot (never an
  urgent countdown/expired), so a resolved interaction is surfaced as "handled"
  without hiding a real expiry. The eye/SPF firmer case reuses the amber
  countdown tint with "Replace for safety" — visible but **never red**; a
  safety-critical *countdown* stays a normal calm countdown.

- **D-032 — 2026-06-13 — PAO category defaults are launch-gated like the conflict
  matrix** (review finding). `pao.ts` now carries the same `*** BLOCKED:
  B-DERM-REVIEW` banner as `rules.ts` plus `PAO_DEFAULTS_REVIEWED = false` and a
  `reviewedCategoryPao()` accessor that mirrors `shippableRules`: the unreviewed
  numbers are used in development (so the shelf is demoable) but **withheld in
  production** until cosmetic-chemist sign-off, where intake falls back to the
  honest "PAO est." state rather than a fabricated number. The pure
  `resolvePaoMonths` resolver stays ungated (tested directly). A test asserts the
  flag is false (parity with the claim-safety `reviewedBy` guard).

- **D-033 — 2026-06-13 — Printed best-before is a catalog/scan datum, with an
  inline manual fallback on the detail hub** (review finding, docs/04 §3/§5.6).
  The design's "Mineral SPF 50 · printed expiry" is a *scanned/catalog* product
  (OBF carries expiry data, B-CATALOG-SEED), so the manual-add form deliberately
  stays clean (matching the mock) and uses PAO. To keep the §3 "printed expiry
  wins for sunscreen" / `least()` rule reachable through the always-available
  path, the product-detail freshness block exposes an inline editable
  "Best before" (future quick-picks → `expiry_source = 'printed'`), which §5.6
  already mandates as editable. The `computeExpiry` least() logic is unit-tested.

## Actives & skin-cycling scheduler (docs/05, Slice 19)

- **D-034 — 2026-06-13 — The cycle is a stored, versioned data object with a pure,
  local-day-aware projection** (docs/05 §3; the doc's suggested "D-025"). New
  `cycles` + `cycle_nights` schema (migration 0017, owner-only RLS via the
  `owns_cycle()` definer helper, mirroring `owns_routine`). v1 keeps the live cycle
  in a local-first AsyncStorage store (`features/scheduler/cycleStore.ts`, the
  D-029 pattern) with the schema as the forward-compatible server target
  (B-SUPABASE); server-authoritative `orchestrate()`/`schedule_for()` are deferred
  (B-SERVER-DETECT/B-ROUTINE-PERSIST). The projection (`projection.ts`) is the pure
  `night_index = ((today − anchor) mod L + L) mod L` → tonight / week-ahead /
  next-of-slot, safe for dates before the anchor.

- **D-035 — 2026-06-13 — Multi-active orchestration enforces the cardinal rules by
  construction** (docs/05 §4; the doc's suggested "D-026"). `orchestrate.ts` places
  **one potent active per night** (so a **retinoid and an exfoliant can never share
  a night** — the harm-relevant FIRM rule, asserted in fixtures), respects class
  **frequency caps** personalised by sensitivity (`classes.ts` table), inserts
  **recovery nights** between pushes, keeps **vitamin C in the AM** off the cycle,
  **suppresses retinoids in pregnancy** (→ the docs/02 safety note), and **stages
  new actives one at a time** (phased introduction). Deterministic + explainable
  (the "why tonight?" trace), not AI. The numbers are **B-DERM-REVIEW** starting
  positions; the FIRM separation is enforced regardless.

- **D-036 — 2026-06-13 — Resume re-anchors "where you left off"; disruptions never
  break the streak** (docs/05 §3/§7; the doc's suggested "D-027"). `resumeCycle`
  advances `anchor_date` by the paused duration so the sequence continues (you were
  on a recovery night, you still are), rather than snapping to today's modular
  position; a single **skip** does not re-anchor. Pause/travel/procedure/irritation
  are all *managed* (a recovery window or a pause), never punished — consistent with
  the calm streak (docs/03 §6). Auto de-escalation is conservative (pause + recovery,
  never escalate) and non-diagnostic.

- **D-037 — 2026-06-13 — The new engine is layered ALONGSIDE the Slice-9
  `scheduler.ts`, and the Today wiring is additive.** The Doc-2/3 PM rendering +
  templates (`scheduler.ts`, used by `today.tsx`/`generate.ts`) are kept; Doc 5's
  richer orchestration lives in `features/scheduler/`. Today gains a tappable
  cycling strip → the week overview and a recovery/pause banner, without rewiring
  the shipped PM checklist. The cycle settings' drag-to-reassign shows handles + the
  rule nudge (the doc's point — guidance not gates) with true drag deferred to
  **B-DRAG-DND**. The DB `cycle_nights.slot` enum uses the doc's nouns
  (`exfoliation`/`recovery`); the local engine uses verbs (`exfoliate`/`recover`) —
  a trivial mapping at the (deferred) server-sync boundary.
