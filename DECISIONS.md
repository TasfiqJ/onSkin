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
  - `supabase/`), per docs/00 §9 ("Turborepo monorepo with shared TS packages").
    Shared `@onskin/types` package holds the Supabase `Database` type + domain
    enums so the mobile client and Edge Functions share one source of truth.
    Expo web now runtime-verifies `@onskin/types` and hoisted dependencies in
    the current installed worktree. The Metro config also watches a resolved
    linked-dependency target when one exists. Native first-device/build
    verification remains a Phase 5 gate because this Windows host cannot run
    the iOS simulator.

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
  The Slice-1 docs/00 §2 catalog _sketch_ (migration 0003) was rewritten to the
  docs/02 §3 schema — it was a never-applied placeholder, so editing forward is
  clean (no deployed DB; B-SUPABASE).
  **Superseded 2026-07-18:** migration `0058` removes direct API-role reads from
  clinical/editorial and catalog-authority tables, including `conflict_rules`
  and `sequencing_rules`. Clients use only bounded, positively eligible serving
  projections; bundled rule mirrors retain review metadata and fail closed in
  production until their separate qualified-review gate passes.

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
  (docs/03 §3): `sequencing_rules` holds versioned
  role→priority/phase/eligibility authority. Migration `0058` supersedes the
  original catalog-style, world-readable posture: direct API-role reads are
  sealed, and the client engine sorts only individually reviewed bundled rules
  admitted by the production gate. Without an admitted rule, automatic phase
  placement and rule-derived instructions are withheld. Ramp/frequency/cycling
  remain medical-adjacent and fall under B-DERM-REVIEW. Roles are classified by
  functional TAGS first, then name keywords (a "glycolic toner" is an
  exfoliant, not a toner).

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
  safety-critical _countdown_ stays a normal calm countdown.

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
  The design's "Mineral SPF 50 · printed expiry" is a _scanned/catalog_ product
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
  are all _managed_ (a recovery window or a pause), never punished — consistent with
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

## Guided photo capture & progress (docs/06, Slice 20)

> Note: docs/06 §6 _suggests_ "D-028/029/030" for the photo privacy / flagged-not-
> blocked / no-AI-score decisions, but those numbers were already taken by the Smart
> Shelf slice. They are recorded here as D-039/D-040/D-042 with the mapping noted.

- **D-038 — 2026-06-13 — The Progress tab IS the photo timeline (docs/06); the calm
  streak relocated to `/routine/streak`.** docs/06 explicitly and repeatedly defines
  the Progress tab as the guided-photo feature ("It is the Progress tab"), and the
  new "OnSkin Photo Progress" design confirms it (Compare/Timeline). The calm
  adherence streak (docs/03 §6, briefly the Progress tab in Slice 14) was **moved**,
  not removed — it now lives in the routine stack (`app/routine/streak.tsx`) and is
  reachable from **Today's streak pill** (now tappable) and the **You** tab's "Streak
  & adherence" link. This preserves docs/03 while honouring docs/06, and keeps photos
  deliberately **decoupled from the daily streak** (docs/06 §5). Reversible.

- **D-039 — 2026-06-13 — Local-first photo store; image bytes never leave the device;
  no faceprint** (docs/06 §6/§7; the doc's suggested "D-028"). Photo **metadata** is
  AsyncStorage (`features/photos/store.ts`, the D-029 pattern); image **bytes** live
  on-device at `local_uri`. The best-effort Supabase mirror (B-SUPABASE) sends
  **metadata only** and **always** `local_only = true` / `storage_path = null` — image
  data and `local_uri` are never mirrored. **No faceprint/biometric template is ever
  computed or stored**; the additive `head_roll/yaw/pitch` columns are coarse pose QA,
  not an identification template (avoids BIPA's trigger). Migration 0018 is purely
  additive; owner-only RLS (0008) is unchanged, plus a hardened `owns_photo()` definer
  - restrictive policies so a shot's `reference_photo_id` must be owned (the D-014
    pattern).

- **D-040 — 2026-06-13 — No real camera in v1; the capture pipeline is B-CAMERA** (the
  doc's suggested "D-029" — quality flagged, never blocked). `react-native-vision-
camera` + the ML-Kit face-detection frame processor (alignment/pose/quality),
  on-device luminance/white-balance, auto-capture, client-side image encryption, and
  the Wi-Fi/charging cloud-upload job all need a **custom dev build** and on-device
  performance tuning (docs/00 §4 spike, docs/06 §10). The guided-capture / review /
  detail screens are rendered **design-faithfully** and the shutter performs a
  **simulated** capture (with a quiet "preview · live in device build" note) so the
  full intake → review → timeline → compare flow is exercisable end-to-end now. The
  pure `quality.ts` (readiness gate, coaching, lighting state, review verdict) is
  tested and ready to consume real on-device signals. **Quality is FLAGGED, never
  BLOCKED** — `isCaptureReady` only arms the auto-shutter; the user always controls
  capture and Save always works.

- **D-041 — 2026-06-13 — Compare is a real Reanimated/gesture before/after wipe**
  over flat-tone placeholders (no `react-native-svg`/gradient lib in the project),
  with the **side-by-side** toggle as the accessible-preferred mode (docs/06 §4).
  **No numbers, no "improvement %"** (the doc's suggested "D-030"). Real on-device
  images render via `expo-image` once capture lands; until then the striped/flat
  placeholders match the design's own "user-photo placeholder" note.

- **D-042 — 2026-06-13 — Claim-safety guard extended to photo copy** (docs/06 §8/§9,
  the Slice-11 pattern; the doc's suggested "D-030" made testable). All user-facing
  photo strings live in `features/photos/copy.ts` so `claimsafety.test.ts` scans them
  for drug/disease verbs, alarm words, AND affirmative score/grade/skin-age/% claims.
  The deliberate **no-AI-score REFUSAL** copy (`NO_SCORE_COPY`) is **exempt from the
  score check** (it names "score/grade/skin age" precisely to reject them) but still
  held to the drug-claim + alarm-word bar — and a positive test asserts the stance is
  actually stated.

- **D-043 — 2026-06-13 — The weekly photo reminder is an opt-in preference only;
  delivery is Document 7** (docs/06 §5). This slice ships the local-first preference
  (`features/photos/reminders.ts`), the calm copy, and the You-tab toggle; the actual
  scheduling — at a consistent time of day, timed with the docs/05 scheduler — is
  Doc 7's reminder system, not invented here. A missed week never breaks anything.

- **D-044 — 2026-06-13 — Photo capture/review/detail use the design's near-black
  `#16130F` backdrop**, distinct from the `night` token (`#1B1813`), to match the
  "OnSkin Photo Progress" `.dc.html` exactly (it uses a darker capture palette so the
  face is the brightest thing on screen). Logged so the divergence from the night
  token is intentional, not drift.

## Reminders, streaks & widgets (docs/07, Slice 21)

> Note: docs/07 §7 suggests "D-031/032/033" for tiering / forgiving-streak /
> interactive-checkoff; those numbers were taken by the Smart Shelf slice, so they
> are recorded here as D-045/046/047 with the mapping noted.

- **D-045 — 2026-06-13 — Notifications are tiered, local-first, frequency-capped,
  and quiet-hours-aware** (docs/07 §3, the doc's suggested "D-031"). `policy.ts`
  (pure, tested) maps each kind to one of utility / behavioural / promotional, caps
  the non-utility tiers per week (behavioural 3, promotional 1; utility uncapped but
  suppressed in quiet hours), and `withinQuietHours` handles overnight windows.
  `store.ts` is the local-first source of truth (the D-029 pattern) with a guarded
  `notification_preferences` mirror; `deliver.ts` schedules the AM/PM **utility**
  reminders as repeating DAILY local notifications (`SchedulableTriggerInputTypes.DAILY`,
  SDK 56) at the user's chosen times, skipping any time inside quiet hours, and
  exposes `notifyBehavioural()` (the frequency-cap engine) for the shelf/scheduler to
  raise their triggers. All delivery is **guarded to no-op off-device** — real OS
  delivery + Android-14 exact-alarm acceptance is **B-NOTIF-VERIFY**. Push (APNs/FCM)
  is reserved for the promotional tier only; nothing health-revealing is ever placed
  in a push payload (§8).

- **D-046 — 2026-06-13 — The streak is forgiving and framed as weekly adherence +
  heat-map** (docs/07 §4, the doc's suggested "D-032"; implements the D-021/§6
  philosophy). `features/streak/streak.ts` (pure, 11 fixtures): a "completion day"
  counts (recovery nights are completions), up to `freezeWindow = 2` interior missed
  days are absorbed by **auto-applied freezes (never purchased)** — only committed
  when a further-back completion proves the miss was interior, so a clean run that
  simply ended is never falsely "frozen"; beyond the window the streak resets to the
  post-gap run. `bestStreak` is the non-decreasing personal best (D-011, linear).
  `useProgress` was refactored to delegate to this module so Today + the streak
  screen + welcome-back all share one tested core. No guilt copy, no manufactured
  loss-aversion, no default leaderboards (the §4.6 anti-patterns are rejected). The
  client computes the streak from `routine_completions` for v1 (B-SUPABASE); the
  `streak_freezes` table is the forward-compat server-audit target.

- **D-047 — 2026-06-13 — Widgets / interactive check-off / Live Activity are in-app
  previews in v1; the native surfaces are B-WIDGETS** (the doc's suggested "D-033").
  WidgetKit/Glance/ActivityKit + the iOS-17 interactive check-off all need a custom
  dev build (`expo-apple-targets`/`expo-widgets`); `app/routine/widgets.tsx` renders
  faithful **previews** of the widget gallery, the one-tap check-off, and the PM Live
  Activity, and the **Live-Activity opt-in** (`live_activity_enabled`) is wired now.
  The interactive check-off, when built, writes `routine_completions` through the
  same idempotent path as the in-app check-off.

- **D-048 — 2026-06-13 — Notification settings live in a dedicated `app/settings`
  stack; the photo-reminder pref is unified into the notification store.** The You
  tab now links to a tiered Notifications hub + a Timing/quiet-hours/discretion
  screen (matching the design's two settings screens), replacing the old inline
  toggles. The Slice-20 local photo-reminder flag is superseded by
  `notification_preferences.capture_reminders`; `features/photos/reminders.ts` now
  delegates to the notification store so there is a single source of truth. Times use
  a calm 30-minute picker (no native date-picker dependency, the D-030 convention).

## Subscriptions, paywall & conversion model (docs/08, Slice 22)

> docs/08 §8 suggests "D-034…D-037" for the model/IAP/honesty/GTM decisions; those
> numbers were taken by the Slice-19 scheduler. Recorded here as D-049…D-053.

- **D-049 — 2026-06-13 — The conversion model is a REVERSE TRIAL (default), A/B-tested
  vs a hard paywall** (docs/08 §2.1, the doc's suggested "D-034"). The onboarding offer
  shows two honest paths: "Start free trial" (the carded 14-day store trial → annual)
  and a visible "Explore first" → an **app-granted ~7-day full-Pro reverse trial, no
  card**, that drops to a generous free floor + re-presents the offer (loss aversion
  earned by real use). **Annual default, premium price under test ($49.99 candidate vs
  $39.99 baseline, configured remotely via offerings), monthly anchor, NO weekly plan.**
  The model A/B + price test are judged on **blended LTV-per-install × reach** — analysis
  only (no in-app code beyond the `offering_id`/`experiment_id`/`acquisition_channel`
  attribution columns). The reverse trial is fully functional locally; the carded
  trial/purchase are stubbed (B-REVENUECAT).

- **D-050 — 2026-06-13 — Entitlement gating is local-first + offline-safe; the app
  gates on `is_active` regardless of SOURCE** (docs/08 §4, the D-029 pattern). The
  server `entitlements` row is SELECT owner-only (clients can never self-grant Pro —
  RLS unchanged), so v1's source of truth is a local AsyncStorage cache
  (`features/subscription/store.ts`), reconciled from the server row when present
  (B-SUPABASE). Pure, tested `entitlement.ts` derives the `SubscriptionState`
  (isPro / periodType / daysLeft / willRenew / expired + `priorPeriodType` so the UI
  picks the reverse-trial re-offer vs the paid graceful-downgrade). A lapsed entitlement
  **falls back to the free tier with data preserved — never deleted** (docs/08 §6).
  `ProGate` / `withProGate` wrap a feature behind a calm contextual upsell.

- \*\*D-051 — 2026-06-13 — Honest-by-design paywall = Apple-3.1.2-compliant + ARL-compliant
  - trust-maximising** (docs/08 §7/§9, the doc's suggested "D-036"). The billed amount
    is the most conspicuous price; **Terms + Privacy + Restore are present and functional**
    on the paywall + the contextual upsell (`ComplianceRow`); **no free-trial toggle**; the
    auto-renew disclosure + the 2-day-before reminder promise + cancel-anytime are shown;
    the reverse trial is no-card; cancellation is a **one-tap OS deep-link\*\* (no maze); the
    win-back is a respectful, easy-"no" offer. A `claimsafety.test.ts` guard blocks
    reintroduced urgency / guilt / fake-scarcity / drug claims and asserts the honest
    disclosures are present.

- **D-052 — 2026-06-13 — Store IAP via RevenueCat is the universal default; prices are
  never hardcoded as truth** (docs/08 §7/§12, the doc's suggested "D-035"). `plans.ts`
  prices are clearly-labelled **fallback display values** — the real localized prices
  come from the RevenueCat Offering at runtime (B-REVENUECAT). The RC SDK binds to the
  **stable Supabase user id as `appUserID`** from first launch so identity carries
  through account linking (`configureRevenueCat`, a no-op until the SDK lands). US
  web/external checkout stays an optional, re-verify-at-build margin experiment, not a
  dependency (B-LEGAL).

- **D-053 — 2026-06-13 — The webhook never revokes on a CANCELLATION** (docs/08 §4).
  `revenuecat-webhook` now grants on INITIAL_PURCHASE/RENEWAL/PRODUCT_CHANGE/
  UNCANCELLATION/NON_RENEWING_PURCHASE, **revokes only on EXPIRATION/REFUND/PAUSE**, and
  on **CANCELLATION/BILLING_ISSUE keeps `is_active` true** (access continues until
  `expires_at`) while setting `will_renew = false` — plus writes the new
  `store`/`period_type`/`will_renew`/`original_purchase_at` columns. Idempotent on
  `event.id`, reads `event.app_user_id`, 200-fast (the exact payload is B-VERIFY-RC).

## Personalized recommendations (docs/09, Slice 23)

> docs/09 §9 suggests "D-038/039/040" for the church-and-state / evidence-based /
> restraint decisions; those numbers were taken by the Smart Shelf slice. Recorded
> here as D-054…D-057 with the mapping noted.

- **D-054 — 2026-06-13 — Church and state, enforced in code (docs/09 §3, the doc's
  "D-038").** The recommendation engine is a pure, deterministic rules + evidence +
  **FIT-scoring** function (`features/recommendations/{catalog,fit,engine}.ts`) over
  the profile/shelf/routine/conflicts/preferences + a type catalog — **no
  commission/affiliate/partnership field is an input anywhere**. `fitScore` takes no
  commercial parameter (a test asserts the breakdown has exactly the six merit
  inputs), the ranking modules import **no** commerce module (doc #10 is not built),
  and migration 0021 has **no commercial column** in the ranking path (a SQL comment
  records this). Any future affiliate link is attached downstream, disclosed
  ("never affects what we recommend"), and consent-gated (B-PRIVACY) — the
  "Where to find it" / replenish "see similar" paths are **inert** and share nothing.

- **D-055 — 2026-06-13 — Profile- and evidence-based, not AI-scan-based, and
  explainable (docs/09 §6, the doc's "D-039").** Recommendations derive from the
  quiz profile + shelf + conflicts + preferences scored against the evidence-graded
  type catalog — **not** a selfie scan (consistent with docs/06) and **not**
  collaborative filtering. Every suggestion carries the mandatory **what / why /
  how** triad + the docs/02 evidence grade + an honest caveat; all user-facing copy
  is centralised (`copy.ts`) and scanned by `claimsafety.test.ts` (concerns not
  conditions, no drug/disease/alarm/urgency/guilt, curly-apostrophe-aware), which
  also scans the **engine-produced** why/how strings over fixtures.

- **D-056 — 2026-06-13 — Restrained + needs-based, type-first, launch-gated (docs/09
  §4/§5, the doc's "D-040").** The engine returns the **minimal** set of genuine
  needs (the six triggers), prioritised safety/gap > replacement > conflict >
  better-fit > goal, **one goal active at a time**, never padding, never
  re-recommending an owned role, and recommends **nothing** ("you're set") when the
  routine is complete/conflict-free/goal-appropriate. The medically-adjacent
  **goal-active** rec types (retinoid/acids/vitamin C/azelaic/niacinamide) are
  launch-gated under **B-DERM-REVIEW** exactly like the conflict matrix + PAO
  defaults — `RECS_REVIEWED = false` + `shippableRecTypes()` withholds them in
  production (structural routine-completeness types still ship); the pregnancy
  hard-exclusion is enforced independently of the gate (→ a pregnancy-safe
  alternative, e.g. vitamin C instead of a retinoid).

- **D-057 — 2026-06-13 — The "For you" hub is NOT Pro-gated in v1; local-first
  state.** The docs do not specify gating recommendations behind Pro, and doc 9's
  thesis frames the independent advisor as the core trust feature — so gating it
  would be _inventing a restriction_. The hub, the what/why/how card, and the
  preferences surface are shown to all (revisit with doc-10 pricing if ever). The
  preferences + dismissals are a **local-first** AsyncStorage store (the D-029
  pattern) with a guarded owner-RLS `recommendation_preferences` mirror; the
  `recommendations` cache table is **forward-compat only** — the pure engine
  recomputes live and is never the source of truth (docs/09 §5/§12). Replacement
  reuses the existing replenishment sheet (docs/04); "Add to shelf" routes to the
  manual-add flow until the catalog lands (B-CATALOG-SEED).

## Creator stacks + commerce (docs/10, Slice 24)

> Validated by a cited deep-research pass (25 claims confirmed, 0 refuted): affiliate
> is a SIX-figure supplement, not a seven-figure pillar (Yuka: 97.3% of $7.37M from
> subscriptions, zero affiliate); the seven-figure business stays a subscription
> business. The build is framed and scoped accordingly.

- **D-058 — 2026-06-13 — Church-and-state at the schema + code level (docs/10 §9).**
  The commerce domain (migration 0022: `affiliate_links`, `creator_stacks`,
  `creator_stack_items`, `commerce_click_events`, `order_attributions`) is walled off
  DOWNSTREAM of the docs/09 ranking engine: it joins to a product only by
  `product_type`/`catalog_product_id`, after ranking, and **no commission/rate field is
  client-readable** — commission lives ONLY in `order_attributions`, which is
  **service-role only** (RLS enabled, zero client policies, the row-level wall). The
  ranking modules (`features/recommendations/*`) import **nothing** from
  `features/commerce`. The doc's "physically separate Postgres schemas" is satisfied for
  v1 by module-boundary + column-separation + RLS (one Supabase service role; all tables
  in `public`, consistent with the prior 21 migrations); a true separate `commerce`
  schema is a deferred infra hardening — the load-bearing guarantee is delivered now.

- **D-059 — 2026-06-13 — Rail-agnostic resolution (the B-SHOPMY hedge).** The research
  surfaced a BLOCKING unknown: ShopMy's documented APIs do **not** confirm a brand can
  mint affiliate links on its **own** first-party recommendations under a house account
  (link creation is creator-OAuth-only; the Brand Partners API is reporting-only,
  poll-based, **no webhooks**). So `links.ts` resolves behind a `source` discriminator
  (`shopmy`|`skimlinks`|`direct`|`none`) — if the house-account model is unworkable we
  swap rails without re-architecting. The live rail is **stubbed/inert** (B-SHOPMY): v1
  returns a dev-only demo set and an honest empty state in production; tapping records a
  click + shows an honest stub. The Order-Report poll (pg_cron → Edge Function, keyed on
  `record_updated_at`) is schema-only here.

- **D-060 — 2026-06-13 — Opaque-token attribution; no health-adjacent data ever reaches
  a retailer (docs/10 §5).** `attribution.ts` (pure, tested) builds the outbound URL
  with **only** an opaque token — `buildOutboundUrl(url, token)` takes no profile
  argument, so skin data cannot be attached even by mistake; a health-term denylist +
  fixtures assert the URL and the persisted click payload carry no concern/goal/skin/
  pregnancy/photo/profile attribute. This is Doc 10's analogue of the docs/09 "FIT score
  has no commercial input" guard. Deep-link straight out (no in-app webview) — keeps
  OnSkin out of the transaction and reduces data-handling liability.

- **D-061 — 2026-06-13 — MHMDA-strict consent gate (docs/10 §6).** The "where to buy"
  affordance is gated behind a **separate, distinct, opt-in, revocable** consent
  (reusing the `data_sharing` consent type — the only third-party-sharing consent in the
  docs/01 enum — recorded with commerce-specific copy + version into the immutable
  ledger). **Stricter than the mock:** no consent ⇒ **no paid links are shown at all**
  (the mock implied "links still work with zero tracking"; we adopt the safer MHMDA
  reading). The local flag is the v1 source of truth (offline-safe); the You-tab
  "Share data with partners" toggle revokes it (re-locks the affordance). Final consent
  copy + DPIA: B-PRIVACY / B-PRIVACY-COPY.

- **D-062 — 2026-06-13 — FTC-correct disclosure + launch-gated expert/derm stacks.** The
  disclosure uses **"paid link"** (FTC-adequate) and never "affiliate link"/
  "commissionable link" (FTC-inadequate), is rendered **visible WITH the links** (16 CFR
  255 "unavoidable", never collapsed), and states independence — enforced by a
  `claimsafety.test.ts` guard with positive controls. The expert/derm-reviewed shoppable
  **stacks** are medical-adjacent → launch-gated under **B-DERM-REVIEW**
  (`STACKS_REVIEWED = false` + `shippableStacks()`, mirroring `shippableRules()`); they
  are ordered by the routine sequence, never by commission.

## Community layer / "Skin Notes" (docs/11, Slice 25)

> docs/11 pre-specifies "D-041…D-045" for the multiplier/no-UGC/expert-anchored/consent/
> phasing decisions; those numbers were long taken. Recorded here as D-063…D-067.
> Validated by a cited deep-research pass (24 claims): community is a retention/trust
> MULTIPLIER, not a seven-figure pillar and not required for one (Yuka: 97.3% of $7.37M
> from subscriptions, zero community). The gaming-RCT's NEGATIVE contribution×consumption
> interaction independently supports the phasing. The compliance layer was NOT verified
> this round → treated as prudent-but-unconfirmed (B-COMMUNITY-LEGAL).

- **D-063 — 2026-06-13 — Community is a retention/trust multiplier, not a revenue pillar;
  net-new scope is the EXPERT-ANCHORED trust layer (docs/11 §1/§2, the doc's "D-041").**
  The proven private retention mechanics (streak/heat-map, docs/03/07) are already
  shipped, so Doc 11's net-new scope is "Skin Notes" — an expert-seeded "myth vs
  evidence" trust layer that EXTENDS the recommendation engine — never an open social
  feed. Church-and-state holds: the community module imports nothing from
  `features/commerce`; any future community→recommendation signal is aggregated +
  anonymised, never commission-biased.

- **D-064 — 2026-06-13 — "No open UGC" by construction (docs/11 §5, the doc's "D-042").**
  The forbidden patterns (open/algorithmic feed, follower graph, DMs, likes/leaderboards,
  public before/after photo galleries, incentivised/suppressed reviews) are barred at the
  ARCHITECTURE level: **the community schema (migration 0023) has NO image/photo/
  storage_path column anywhere — photos can never enter community** (enforced at the table
  layer; local-only stays local-only, docs/06/D-039); the only reaction is a structured
  closed-vocabulary `helped`/`use_this`, never a like count, follower, or ranking. The
  validation confirmed the harm this avoids (photo appearance-comparison correlates
  r=0.53 with stigmatisation in people with acne).

- **D-065 — 2026-06-13 — Anonymous-by-default, expert-seeded, human PRE-moderated, claim-
  safe (docs/11 §4/§6, the doc's "D-043").** "Skin Notes" copies Flo's cage (anonymous to
  peers, topic-structured, approve-before-publish) and tightens it. Expert notes
  (`features/community/notes.ts`) reuse the docs/02 evidence vocab (refuted=sage, etc.),
  are launch-gated under **B-DERM-REVIEW** (`NOTES_REVIEWED = false` + `shippableNotes()`,
  mirroring `shippableRules()`; a note must ALSO pass the claim-safety guard
  `claimSafetyOk` — the same belt-and-suspenders the `community_notes` RLS enforces:
  `reviewed_by IS NOT NULL AND claim_safety_ok`). The shipped **claim-safety scan**
  (`claimSafetyScan.ts`, tested, catches inflected drug/disease verbs + dosage + alarm)
  is a FIRST-PASS FLAG only; human pre-moderation is authoritative, with a DSA-Art.17
  appeal path. All community copy is centralised + claim-safety-guarded (concerns not
  conditions, the mandatory "not medical advice" disclaimer).

- **D-066 — 2026-06-13 — A new, separate, unbundled `community_participation` consent +
  a hard 16+ gate + anon lockout (docs/11 §8, the doc's "D-044").** Posting health-
  adjacent info to others is a new MHMDA/GDPR-Art.9 event; the consents enum gains a 7th
  type `community_participation`, NEVER reused from the photo/`data_sharing` grants,
  recorded with community copy+version into the immutable ledger and referenced by
  `community_questions.consent_grant_id` (validated by the `owns_consent()` definer
  helper). **Anonymous (`is_anonymous` JWT) users are LOCKED OUT of posting** via a
  RESTRICTIVE RLS policy — closing the gap docs/01 §1 named. Posting is hard-gated to
  16+. Local-first + ledger-authoritative-then-local (the Slice-24 precedence) so a
  withdrawal re-locks; withdrawal deletes the user's questions (Edge Function, deferred).

- **D-067 — 2026-06-13 — Phase 1 only is LIVE; peer phases are design-faithful previews,
  deferred; observable kill switch (docs/11 §11, the doc's "D-045").** Phase 1 (expert
  read-mostly Skin Notes hub + the myth-vs-evidence card + the in-context "Read the
  evidence" affordance, wired into the conflict reassurance) ships live. The peer **Ask**
  composer + **"people like you"** are built design-faithfully but **deferred** — the Ask
  shows the gates + the honest pre-moderation/"asking opens soon" state and does not post,
  because the moderation/legal store floor (filter/report/block/published-contact/~24h
  SLA) must be staffed first (**B-COMMUNITY-MOD** / **B-COMMUNITY-LEGAL** /
  **B-EXPERT-NETWORK**). The full schema lands now for the architecture-level kill list.
  The research-confirmed NEGATIVE peer-contribution×consumption interaction is a second
  reason not to ship peer-post + peer-read at once. The kill switch is **observable
  tripwires** (brand/claim-safety incident, MHMDA/consent gap, moderation-cost ceiling,
  ~24h SLA breach), not a likely-unfireable A/B churn holdout.

## AI trend analysis / "Changes in your own photos" (docs/12, Slice 26 — the LAST build item)

> docs/12 pre-specifies "D-046…D-050"; those numbers were long taken. Recorded here as
> D-068…D-072. Validated by a cited deep-research pass: AI trend analysis is NOT a
> seven-figure pillar; the population skin score is a trust destroyer; the highest-value
> move is to KEEP REFUSING AI scores and MARKET THE REFUSAL (the same trust engine behind
> Yuka's $7.37M, zero AI face analysis). The verdict rests on four HIGH-confidence grounds
> (trust-promise reversal, unfixable fairness physics, the regulatory claim-surface, the
> absence of any independent validation) — the economics are explicitly non-load-bearing.
>
> **2026-07-29 PHOTO-05A source checkpoint:** the decision-number crosswalk
> remains deliberate (`D-046`…`D-050` in docs/12 map to root
> `D-068`…`D-072`). PHOTO-05A supersedes the former implementation note that
> allowed a conservative stub to render `consistent`. No engine or result
> issuer currently exists, so Trend processing, positive consent, result copy,
> and content analytics remain at literal zero admission. The future
> on-device-only, no-score, calibrated, fairness-gated, separately consented
> decisions remain requirements, not current runtime capabilities.

- **D-068 — 2026-06-13 — The population "skin score" / "skin age" is KILLED OUTRIGHT
  (docs/12 §4, the doc's "D-046").** AI trend analysis is not a pillar; it ranks below
  the photo timeline (docs/06), the recommendation engine (docs/09), and the paywall
  (docs/08). **No score / grade / percentage / "skin age" column exists in the schema or
  copy, by construction** (`photo_trend` holds only abstract deltas + a change-state +
  a copy key). The shipped no-AI-score refusal (docs/06, the `/progress/about` screen) is
  **preserved and treated as the asset** (Phase 0: market the refusal); the feature is
  **deferred** until an independent, peer-reviewed, Monk-stratified consumer-selfie
  benchmark exists (none does).

- **D-069 — 2026-06-13 — On-device ONLY; cloud is not a phase (docs/12 §5/§8, the doc's
  "D-047").** Every shipped promise stays literally true — "photos never leave your
  device / never train AI" is binary and survives only on-device. The engine is
  **classical computer vision** (image registration + SSIM/colour delta on the user's
  own series), honestly "your phone comparing your own photos", **never a general
  multimodal LLM** and **never marketed as "AI"**. The real CV engine + the MDC
  calibration + device-performance verification are **B-AI-ONDEVICE** (shares B-CAMERA's
  custom-dev-build need). Until that exact engine and a versioned result issuer exist,
  the pure classifier, tone adjustment, caller values, environment flags, historical
  consent/data, and Apple image-processing primitives are not measurement authority:
  PHOTO-05A renders no Trend result and invokes no Trend input or analytics path.

- **D-070 — 2026-06-13 — Within-person CHANGE, never a population score; a hard MDC noise
  floor; "consistent" celebrated (docs/12 §6, the doc's "D-048").** Any future output is
  a within-person change-STATE (`consistent` | `change_observed` | `inconclusive_lighting`
  | `insufficient_data`) — surfaced **only** above a Minimal-Detectable-Change floor, and
  **"consistent / no detectable change" is a celebrated first-class output (adherence
  win)**, never a flat line to feel bad about; "lighting varied too much" is shown
  honestly. The copy is descriptive, non-evaluative, non-diagnostic, enforced by
  extending `claimsafety.test.ts` to trend strings (the forbidden list: any number/score/
  skin-age/grade/%/rating, disease-detection → FDA SaMD, "dermatologist-grade"/superiority
  → FTC, "improved/worse" verdict, structure/function, "AI" marketing — with a
  negation-exemption for the disclosure strings that quote banned terms to refuse them).
  None of these states may be produced before a real engine, calibrated threshold, and
  issuer-authenticated result contract exist; missing measurement authority yields no
  Trend output, not a reassuring default.

- **D-071 — 2026-06-13 — Fairness is a LAUNCH GATE (docs/12 §7, the doc's "D-049",
  B-AI-FAIRNESS).** The Monk Skin Tone scale (read from `skin_profiles.monk_tone`), never
  Fitzpatrick; the per-user **MDC floor is set EQUAL-OR-HIGHER for darker Monk tones**
  (`toneAdjustmentFactor` is monotonic non-decreasing — a darker-skinned user needs a
  larger delta to register a change, so they are never handed a falsely confident trend;
  a unit test asserts the same delta reads "change" on light skin and "consistent" on
  dark); **redness/erythema is never the trend metric** (optically masked as melanin
  rises — physics, not a tunable); and **no public accuracy / "works for everyone" claim
  ships until a ≥25–30% dark-skin, Monk 7–10-heavy cohort shows parity** — a launch gate
  the whole field has failed. The "Fairness check" surface states this calmly (the
  internal blocker is B-AI-FAIRNESS; not surfaced as a code in the UI).
  PHOTO-05A does not evaluate a Monk band or tone multiplier at runtime because no
  engine is admitted. A future fairness threshold remains conditional on the signed,
  predeclared evaluation; a hardcoded factor is not fairness evidence.

- **D-072 — 2026-06-13 — A separate, explicit, DEFAULT-OFF `photo_trend_insights` consent
  (docs/12 §8, the doc's "D-050").** The consents enum gains an 8th type
  `photo_trend_insights`, distinct from `photo_capture` / `photo_cloud_backup`. The
  on-device-derived insight is **still a health inference** (MHMDA / GDPR Art. 9), so it
  is **excluded from cloud backup** and **deleted on revocation** (`deleteTrendState`),
  local-first + ledger-authoritative-then-local so a withdrawal re-locks. **Never
  default-on**: the installed base who onboarded under the "no AI grades" refusal are
  **re-consented**, never silently enrolled — the refusal screen is preserved and merely
  gains an optional opt-in link. The "don't call it AI" tension is resolved honestly
  (classical CV described plainly; any future on-device ML would be disclosed). New
  blockers: **B-AI-FAIRNESS** (launch gate), **B-AI-LEGAL** (FDA SaMD / EU MDR + AI Act /
  FTC AI-washing counsel sign-off of the copy + the DPIA extension), **B-AI-ONDEVICE**
  (the on-device CV/Core ML engine + MDC calibration + device verification); the consent
  copy + DPIA also extend **B-PRIVACY / B-PRIVACY-COPY**.
  While admission is closed, positive Trend consent is neither read, displayed, refreshed,
  nor granted. Explicit withdrawal/deletion may still erase legacy private state as a
  data-rights operation and can never activate the feature.

- **D-073 — 2026-06-14 — "Ask OnSkin" is the grounded, TEMPLATE-BOUNDED front-end to the
  on-device intelligence layer, never an open chatbot (docs/13, the doc's "D-051/D-057").**
  Slice 27 — the founder-delegated feature beyond the 12 build-order docs (chosen by
  objective reasoning). The TRUTH SOURCE is the deterministic engine (`detectConflicts`
  via `useShelf`, `generatePlan` via `usePlan`, `recommend` via `useRecommendations`) +
  the curated corpus; the LLM is only a constrained narration layer, and **substantive
  health claims are filled from the engine + already-claim-safe copy, never free-generated**
  (`answer.ts` builds every `claim` from `bannerSubhead`/`RESOLUTION_LEAD`/`whyCopy`/
  `fitLabel`). A deterministic **input router** (`classifyIntent`, medical-first) catches
  dosing/diagnosis/severe intent BEFORE any model and **escalates**; **refuse-over-guess**
  is the cardinal rule. The whole deterministic advisor runs **on-device at $0** and needs
  no consent — the cloud-grounded path is deferred (B-AI-ASSISTANT-VENDOR) and degrades
  honestly, never fakes a grounded answer. It is a seven-figure **contributor, not a
  king-maker** (the moat is narrow/structural, per the stress-tested doc).

- **D-074 — 2026-06-14 — The shipped claim-safety guard runs at RUNTIME, broadened to the
  full Ask forbidden list (docs/13 §4/§5, "D-052").** Every rendered answer's substantive
  `claim` passes `guardClaim` (`guard.ts`): the shipped `scanClaimSafety` (drug/disease
  verb, dose, alarm) PLUS the same disease-noun / superiority-AI-washing / skin-score /
  "AI"-marketing nets the build-time `claimsafety.test.ts` enforces — so the runtime net
  matches the brand's full stated list, not a subset (review fix). It scans ONLY the
  substantive sentence; product-name DATA (a "7%") is a separate, unscanned field. On a
  flag → refuse-over-guess. The Art. 50 / SB 243 **AI-disclosure** copy names the AI
  honestly (exempt from the AI-marketing scan, like the Slice-24 pattern); marketing leads
  with independent/grounded/knows-your-shelf/private, never "AI".

- **D-075 — 2026-06-14 — A separate, explicit, DEFAULT-OFF `ask_onskin` consent + a
  content-free / safety-audit-only data model (docs/13 §7/§10, "D-053/D-058").** The
  consents enum gains a 9th type `ask_onskin` (migration 0025), distinct from every other
  consent — the user's question is a health disclosure transmitted to the cloud (MHMDA /
  GDPR Art. 9 attaches to the TRANSMISSION). Default-off, revocable, ledger-authoritative-
  then-local; **deletion-on-revocation clears the local turn counter** (`clearAskStore`).
  `ask_sessions` / `ask_turn_audit` are **content-free** (intent + verdicts + version
  pointers + a `narration_engine_mismatch` counter, never the question/answer); the ONLY
  health-content store is `ask_safety_audit` — a **short, encrypted, access-logged,
  consented safety-audit window** (resolving the "no transcript" vs auditable/appealable/
  EU-AI-Act contradiction), excluded from training/backup/sale, auto-purged. Owner-only
  RLS throughout. **No commission/affiliate/score/photo column exists in any Ask path**
  (church-and-state, D-038; no-photo-analysis, doc 12).

- **D-076 — 2026-06-14 — Pro-gating: the deterministic on-device advisor is FREE (the moat
  taste); only the cloud-grounded layer is Pro-gated + trial-capped (docs/13 §15, "D-054").**
  `GatedFeature` gains `ask` + `UPSELL_COPY.ask`. The pure `askGate` + the local-first
  per-period grounded-turn counter (`onskin.ask.groundedTurns.v1`) enforce: free → grounded
  is Pro; trial/reverse-trial → a hard cap then the paywall; fully paid → uncapped. The
  authoritative cap is server-side at the Edge Function (deferred); the client counter is a
  best-effort cost guardrail. The first-session moat taste (the deterministic conflict
  answer) is surfaced free on Today (`AskTeaser`) and You.

- **D-077 — 2026-06-14 — Safety conflicts ESCALATE, never "you're set"; medical escalation
  is VERBAL-only (review fixes, docs/13 §4/§9).** `conflictAnswer` detects any
  `interactionType === 'safety'` conflict (e.g. a pregnancy contraindication) BEFORE the
  top/reassurance/no-conflicts logic and routes it to a calm clinician-caution answer — a
  high-severity contraindication is never silently dropped and contradicted with "nothing
  clashes." And because **no in-app dermatologist finder exists yet** (deferred,
  B-DERM-REVIEW), the medical-escalation answer carries **no CTA** (verbal guidance only) —
  a misrouted "find a derm" button on the highest-stakes control is worse than none.

- **D-078 — 2026-06-14 — Product-fit answers use catalog-backed recommendations only, to
  keep raw product names out of the scanned claim (review fix, docs/13 §4).** `pickFitRec`
  selects the top `gap`/`routine_completion`/`better_fit`/`goal` recommendation (a clean
  TYPE name) and skips the shelf-anchored `replacement`/`conflict` triggers whose `what`
  embeds a raw product name (e.g. "Your Glycolic 7% Toner is running low") — whose "7%"
  would false-trip the runtime dosage guard and silently refuse a valid fit answer. New
  blockers: **B-AI-ASSISTANT-VENDOR** (the zero-retention/no-training cloud LLM + the
  Edge-Function cost/abuse caps), **B-AI-ASSISTANT-SAFETY** (the grounding + layered guard +
  red-team eval launch gate), **B-AI-ASSISTANT-LEGAL** (§230 / FDA / FTC / EU AI Act Art. 50
  - state companion-chatbot laws + minors/COPPA + the Art. 9 transmission consent + DPIA);
    depends on **B-CATALOG-SEED** + **B-DERM-REVIEW** (the corpus is the prerequisite), and the
    consent copy extends **B-PRIVACY / B-PRIVACY-COPY**.

## Launch governance

- **D-079 — 2026-07-04 — Phase 1 source-of-truth cleanup added launch-readiness,
  brand, V1 scope, Phase 2, and seven-figure-readiness docs.** This does not
  legally clear a brand. `B-BRAND` remains a founder/counsel launch blocker, but
  engineering should not create production infrastructure under the `OnSkin`
  identity unless counsel clears it in writing. The default planning path is a
  rebrand before Phase 2; `RoutineKind` is a working clearance candidate only.

- **D-080 — 2026-07-04 — Phase 2 infrastructure is scaffolded locally, but live
  accounts remain blocked by brand/account/secret ownership.** The repo now has
  EAS variant config, native SDK dependencies, guarded RevenueCat purchase/restore
  wiring, PostHog capture/identify wiring, Sentry startup wiring, env validation,
  a Supabase staging deploy wrapper, and a live-project RLS smoke test. The
  implementation intentionally keeps real purchases, analytics, crash reporting,
  and backend deploys inert without real provider keys and custom native builds.
  Public launch remains blocked until staging/prod Supabase, Apple/Google,
  RevenueCat, PostHog, Sentry, Turnstile, policy URLs, device QA, and legal/brand
  gates are completed under the cleared identity.

- **D-081 - 2026-07-04 - Phase 3 signoff is implemented as an auditable gate,
  not as a fake local clearance.** The repo now has Phase 3 regulatory,
  clinical, chemistry, privacy/data, consent, store-review, Apple/Google, claims,
  and quiz-FTO packets; scripts to audit risky copy and generate exact file-hash
  review manifests; central policy links; conservative store metadata; and tests
  for store-claim safety plus production gates. The app remains launch-blocked
  until actual counsel, dermatologist, cosmetic-chemist, privacy, and IP/FTO
  signoffs are attached. `phase3:audit-copy:strict` is expected to fail until
  placeholders and blocker markers are truly closed.

- **D-082 - 2026-07-04 - Phase 4 catalog is implemented as source-gated
  infrastructure, not a fake launch database.** The repo now has additive
  catalog schema/RLS, import-batch provenance, parser/quality models, OBF fixture
  import/QA tooling, lookup/search/report Edge Functions, mobile source/quality
  disclosure, and a correction loop. Production recommendations may use only
  `verified` or `usable` products that are reviewed, source-approved, and free of
  open corrections. Open Beauty Facts contribution-back is not promised until
  ODbL/source review, account credentials, moderation, and queue operations are
  approved. Product images remain disabled until image rights are reviewed.

- **D-083 - 2026-07-04 - Phase 5 native camera ships as an Expo Camera baseline,
  while OCR and precise face/pose signals stay gated.** Expo Camera is the first
  native camera stack because it matches the current Expo SDK, supports live
  barcode scanning and still capture, and keeps the build surface smaller than a
  full VisionCamera/MLKit frame-processor stack before device QA. The app may
  claim live barcode capture and progress-photo capture only after physical
  iOS/Android QA passes. Native OCR remains hidden while
  `EXPO_PUBLIC_NATIVE_OCR_ENABLED=false`; the label path is a real camera capture
  plus editable user-confirmed text, not a simulated OCR claim. Progress-photo
  signals are coarse preview estimates until a reviewed detector proves transient
  face/pose processing without persisting faceprints, embeddings, tracking IDs,
  or raw frame streams.

- **D-084 - 2026-07-04 - Phase 5 local photo storage uses authenticated local
  encryption and no exact-alarm escalation.** Captured progress-photo temp files
  are encrypted into app-private `.onskinphoto` envelopes using
  XChaCha20-Poly1305 with a SecureStore-held content key; renderers decrypt to
  memory for display/share, and deletion removes ciphertext. Routine reminders
  stay gentle/inexact and the app does not request Android exact-alarm
  permissions. Strict Phase 5 completion requires the generated device QA packet
  to contain real EAS build IDs, physical device names, and named signoff.

- **D-085 - 2026-07-10 - Progress quality guidance uses measured static-photo
  analysis and explicit unavailable states; it never fabricates live camera
  confidence.** This supersedes only the Progress-signal boundary in D-083.
  After capture, a fresh native binary runs transient local ML Kit face
  detection for one-face framing/pose and a downsampled local luminance/balance
  check. The preview overlay remains static, Save remains available for low or
  unavailable quality under D-029, and only actually measured coarse metadata
  may be persisted. No face template, identity vector, raw frame stream, local
  path, image, analyzer sample, or quality verdict enters analytics. Photo
  metadata makes no Supabase network attempt while cloud backup is off; an
  explicit backup opt-in permits only documented coarse metadata carrying
  measured provenance. Legacy rows have no provenance and their former timer
  scores are never reused for reference comparison, detail claims, or server
  mirroring. Real-time guidance and auto-capture remain unimplemented and must
  not appear in launch copy unless a separately reviewed, calibrated, and
  device-tested frame pipeline ships.

- **D-086 - 2026-07-10 - Progress photo cloud backup stays unavailable until it
  works end to end.** This supersedes the metadata-mirror allowance in D-039 and
  D-085. A local consent flag and coarse Supabase metadata insert did not back up
  encrypted photo bytes, restore a timeline, or prove remote deletion, so the
  live-looking backup toggle and `cloud_backup_opted_in` emitter were misleading.
  The current app has no backup setter, clears stale local enablement at startup,
  performs no automatic Supabase write from local photo save, and labels storage
  as device-only in Settings and locked Progress. The reserved
  `photo_cloud_backup` consent type and private-bucket schema remain future
  scaffolding only. Backup may return only with client-side encrypted upload,
  retry/queue semantics, cross-device restore, object/metadata deletion,
  unbundled reviewed consent, no-plaintext network inspection, supported-device
  performance evidence, and honest recovery UI in the same reviewed release.

- **D-087 - 2026-07-10 - Account export discloses device-only exclusions before
  action and inside the artifact.** `Export my data` must not imply that local
  Progress photo files are in the JSON bundle. Settings names the exclusion and
  points to explicit per-photo sharing; `data-export` repeats the current-build
  boundary in `local_only_photo_note` and distinguishes server-side photo
  metadata rows from device-only files. This preserves an honest portability
  contract without uploading photos merely to make export appear complete.
