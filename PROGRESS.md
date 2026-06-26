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

### Slice 20 — Doc 6 Guided Photo Progress + new design ("OnSkin Photo Progress") ✅ (2026-06-13)
- **Schema** (migration 0018): additive `photos` columns (`reference_photo_id`,
  `series`, `capture_session_id`, coarse `head_roll/yaw/pitch` pose QA — **never a
  faceprint**, `taken_local_date`, `time_of_day`, `notes`, `local_uri`,
  `is_encrypted`) + `(user_id, series, taken_local_date)` index. Owner-only RLS
  (0008) **unchanged**; added a hardened `owns_photo()` definer + restrictive
  policies so a shot's `reference_photo_id` must be owner-owned (the D-014 pattern).
  `Database` type + `@onskin/types` extended.
- **Pure, tested helpers** (`features/photos/`): `quality.ts` (capture readiness
  gate, calm coaching line, lighting state, review verdict — **flagged, never
  blocked**, D-040) + `timeline.ts` (default compare pair + one-cycle interval,
  month grouping, calm milestones, the "13 weeks · 26 photos · all on this phone"
  line, per-series reference). **89 fixtures** (192 tests total).
- **Local-first store** (`store.ts`, D-039): photo metadata in AsyncStorage, image
  bytes on-device at `local_uri`; the Supabase mirror is **metadata-only** and
  **always `local_only = true` / `storage_path = null`** — bytes/`local_uri` never
  leave the device. **No faceprint ever stored.** Photo `consent.ts` records the
  unbundled `photo_capture` + `photo_cloud_backup` consents to the immutable ledger.
- **Claim-safety guard** (`photos/claimsafety.test.ts`, D-042): centralised
  `copy.ts` scanned for score/grade/skin-age/%/drug/alarm terms; the no-AI-score
  **refusal** copy is exempt from the score check (it negates those terms) but held
  to the drug/alarm bar; a positive test asserts the stance is stated.
- **9 design surfaces**: guided capture (dark; ghost/alignment/lighting/auto-ready
  shutter/on-device microcopy + first-use consent gate), review & retake, first-run
  honest-expectations (the Progress empty state), **Compare** (real Reanimated/
  gesture before-after wipe + **tap-a-date pair picker** + side-by-side toggle, no
  %), **Timeline** (month film strip + calm milestone + a quiet **Play** affordance),
  single-photo detail (note/set-reference/share-with-redaction/delete), the
  plain-spoken **no-AI-score** screen, the biometric **gallery lock** (Face ID over
  the timeline + cloud-backup-off row), and the calm capture-reminder preference.
- **Progress tab = the photo timeline** (D-038); the calm adherence **streak moved**
  to `app/routine/streak.tsx`, reachable from Today's (now-tappable) streak pill +
  the You tab. Photos stay decoupled from the daily streak (docs/06 §5).
- **Live camera deferred to B-CAMERA** (vision-camera + ML-Kit face detection +
  luminance check + auto-capture + client-side encryption + cloud-upload job): the
  capture/review screens are design-faithful and perform a **simulated** capture so
  intake → review → timeline → compare works end-to-end now.
- **Adversarially reviewed by a 4-dimension workflow** (RLS/SQL · spec · design ·
  claim-safety/privacy, **17 agents, each finding independently verified**) →
  **0 blocking, 0 high**; RLS/SQL and claim-privacy found no leak or banned copy.
  Fixed the confirmed medium/low items: added **`NSFaceIDUsageDescription`** +
  the `expo-local-authentication` config plugin (the biometric lock — incl. the
  Slice-6 app-lock — would have failed on iOS), made the **consent gate fail-closed**
  during its async load, **wired the compare date-chips to a real pair picker** (the
  "tap a date to change" affordance), added the Timeline **Play** pill + the
  `cloud_backup_opted_in` event, fixed the **GalleryLock safe-area** (#16130F incl.
  the inset bands), and removed dead `twelve_weeks`/`refAlignment` code. D-038…D-044.
- **Gates:** typecheck ✅ · lint ✅ · test ✅ (192).

### Slice 21 — Doc 7 Reminders, Streaks & Widgets + new design ✅ (2026-06-13)
- **Schema** (migration 0019): `notification_preferences` tier/quiet-hours/discretion
  extensions (`am/pm_reminder_enabled`, `capture_reminders`, `quiet_hours_*`,
  `live_activity_enabled`, `promotional_opt_in`, `lockscreen_discreet`; **`updated_at`
  already existed — not re-added**), the `streak_freezes` forgiveness ledger
  (append-only, owner-RLS), and a **content-free** `notification_log` (tier/kind/ts
  only). `Database` type + `@onskin/types` extended.
- **Pure, tested cores**: `features/streak/streak.ts` — the calm forgiving streak
  (a "completion day"; recovery nights count; **auto-freezes** absorb ≤2 *interior*
  misses, committed only when a further-back completion proves the gap was interior,
  so a clean ended run is never falsely "frozen"; earn-back; weekly adherence +
  heat-map; non-decreasing best, D-011) — **11 fixtures**; `features/notifications/
  policy.ts` — tiers, per-tier weekly caps, overnight quiet-hours, and the per-kind
  `tierEnabled` opt-out gate — **16 fixtures**; plus a notification claim-safety
  guard (guilt/urgency/drug/alarm, curly-apostrophe-aware). `useProgress` refactored
  to delegate to the streak module (Today + streak + welcome-back share one core).
- **Delivery** (`features/notifications/`): local-first prefs `store.ts` (guarded
  mirror); `deliver.ts` schedules AM/PM **utility** reminders as repeating DAILY
  local notifications (real SDK-56 API; channelId on the trigger; guarded off-device)
  and `notifyBehavioural()` — the frequency-cap + opt-out + quiet-hours engine.
- **7 surfaces**: the soft-ask (wired to the real OS permission prompt), the tiered
  settings hub, timing/quiet-hours/lock-screen-discretion (calm 30-min picker), the
  welcome-back earn-back, and the widget gallery / interactive-checkoff / Live-Activity
  **previews** (+ the Live-Activity opt-in). Notification settings moved to an
  `app/settings` stack; the You tab links to it; Today's streak pill + the streak
  screen are freeze-aware.
- **Native deferred**: home-screen widgets + interactive check-off + Live Activity
  (**B-WIDGETS**); on-device delivery + Android-14 verification (**B-NOTIF-VERIFY**).
- **Adversarially reviewed by a 4-dimension workflow** (RLS/SQL · spec · design ·
  claim-safety/privacy, **13 agents, each finding verified**) → 0 blocking; **1 high**
  flagged by all four dimensions and **fixed**: `notifyBehavioural` now honours the
  per-kind opt-out toggles (the off-by-default promotional/winback consent gate),
  via the pure `tierEnabled`. Also fixed: the Android `channelId` moved onto the
  trigger (SDK-56 — so the calm 'routine' channel actually applies), the claim-safety
  guard made curly-apostrophe-aware (a "Don't break your streak" can no longer slip
  past), and an explicit `user_id` filter on the frequency-cap count. D-045…D-048.
- **Gates:** typecheck ✅ · lint ✅ · test ✅ (261).

### Slice 22 — Doc 8 Subscriptions, Paywall & Reverse Trial + new design ✅ (2026-06-13)
- **Conversion model**: the **reverse trial** (default, docs/08 §2.1) — the onboarding
  offer's two honest paths ("Start free trial" → carded 14-day trial; "Explore first"
  → an **app-granted 7-day full-Pro reverse trial, no card** → generous free floor +
  loss-aversion re-offer). Annual default, monthly anchor, **no weekly**, premium price
  under test ($49.99 vs $39.99, configured remotely). The model A/B + price test are
  judged on blended LTV-per-install × reach (the `offering_id`/`experiment_id`/
  `acquisition_channel` attribution columns are wired for it).
- **Schema** (migration 0020): additive `entitlements` columns (`store`, `period_type`,
  `will_renew`, `original_purchase_at`, `offering_id`, `experiment_id`,
  `acquisition_channel`). RLS **unchanged** — SELECT owner-only, writes service-role
  only (clients can never self-grant Pro). Database type + `@onskin/types` extended.
- **Pure, tested cores** (`features/subscription/`): `plans.ts` (catalog + fallback
  prices + the floored "$4.16/mo"), `entitlement.ts` (the gating brain —
  `deriveState`: isPro / periodType / daysLeft / willRenew / expired + `priorPeriodType`
  to pick the re-offer vs the paid downgrade), and a **paywall claim-safety guard**
  (no urgency/guilt/fake-scarcity/drug claims; asserts the honest disclosures). **91
  fixtures.**
- **Entitlement gating** (docs/08 §4, D-050): local-first cache (the D-029 pattern, the
  v1 source of truth; clients can't write the server row) + `useEntitlement` + a
  generic `ProGate` / `withProGate`. Gates on `is_active` **regardless of source**,
  offline-safe; wired on the **photo timeline, the scheduler (cycle week), and the
  widgets** screens (remaining gates are mechanical applications of the same HOC).
- **9 surfaces** (`app/paywall/` + onboarding + settings): the onboarding offer (4 value
  props, $49.99/yr most conspicuous, monthly secondary, "Explore first" reverse-trial
  row, Terms·Privacy·Restore, auto-renew disclosure, trust block below), the
  reverse-trial banner (AM **and** PM-night), the loss-aversion re-offer, the contextual
  upsell sheet, the purchase success, the manage-subscription screen (one-tap OS
  cancel), the graceful downgrade (data preserved), and the honest 30%-off win-back. The
  **reverse-trial expiry loop is wired end-to-end** (`lifecycle.ts` → a once-per-expiry
  next-launch redirect to the re-offer / downgrade; the win-back is reachable from
  manage).
- **Honest-by-design** (D-051): billed amount most conspicuous, **Terms + Privacy +
  Restore functional** on the paywall + upsell, **no trial toggle**, auto-renew
  disclosure, one-tap OS cancel — Apple 3.1.2 + ARL + trust at once.
- **Webhook** hardened (D-053): event-type-correct, **never revokes on CANCELLATION**
  (access continues to `expires_at`), `will_renew` from the renewing types only, writes
  the new columns; idempotent on `event.id`. Native StoreKit/Play purchase + localized
  offering prices + restore are stubbed (**B-REVENUECAT**); `appUserID`-binds the
  Supabase id.
- **Adversarially reviewed by a 4-dimension workflow** (RLS/SQL · spec · design ·
  honest-by-design, **18 agents, each finding verified**) → **0 blocking**; **1 high**
  flagged by all four dimensions and **fixed**: the reverse-trial expiry → re-offer /
  downgrade / win-back loop was built but unreachable — now wired via `lifecycle.ts` +
  the manage win-back link. Lows fixed: webhook `will_renew` for NON_RENEWING/BILLING_
  ISSUE, the manage "Terms & Privacy" row now opens the policy pages (not the store),
  the reverse-trial banner now shows in PM too, and the claim-safety scope comment
  corrected. D-049…D-053.
- **Gates:** typecheck ✅ · lint ✅ · test ✅ (346).

### Slice 23 — Doc 9 Personalized Recommendations + new design ✅ (2026-06-13)
- **The independent advisor**: the needs-based recommendation engine that turns the
  profile (docs/01) + evidence-graded catalog (docs/02) + routine gaps (docs/03/05) +
  shelf state (docs/04) into honest, type-first suggestions — **ranked by fit and
  evidence, never by commission**. Consumes docs/01–05 outputs; walled off from the
  (unbuilt) commerce layer (doc #10).
- **Schema** (migration 0021): `recommendation_preferences` (values/budget/format
  filters) + the `recommendations` cache — both **owner-only RLS** (the skin_profiles
  posture), and **NO commission/affiliate/partnership column anywhere in the ranking
  path** (church and state, D-054; a SQL comment records it). `Database` type +
  `@onskin/types` (`RECOMMENDATION_TRIGGERS`/`VALUES_FILTERS`/`BudgetBand`/
  `RECOMMENDATION_EVENTS`) extended; no RLS weakened.
- **Pure, tested engine** (`features/recommendations/`): `catalog.ts` (the
  recommendable type catalog + the **B-DERM-REVIEW launch gate** `RECS_REVIEWED` /
  `shippableRecTypes` on medically-adjacent goal actives), `fit.ts` (the **six-input,
  merit-only FIT score** — hard exclusions for pregnancy/would-add-a-conflict/refuted
  first, then a weighted explainable score; **no commercial input**, a test asserts
  exactly six merit inputs), `engine.ts` (`detectNeeds` + `recommend`: the **six
  honest triggers** + the honest **"you're set"**, prioritised safety/gap >
  replacement > conflict > better-fit > goal, type-first, restrained — one goal active
  at a time, never pads, never re-recommends owned, pregnancy swaps to a safe
  alternative), `copy.ts` (centralised claim-safe copy + builders), `preferences.ts` +
  `store.ts` (local-first AsyncStorage prefs + dismissals, the D-029 pattern, guarded
  Supabase mirror). **fit (11) + engine (14) + claim-safety (~30 scanned) fixtures.**
- **Claim-safety guard** (`claimsafety.test.ts`, D-055): concerns-not-conditions, no
  drug/disease/alarm/urgency/guilt (curly-apostrophe-aware), scanning the centralised
  copy AND the **engine-produced** what/why/how over gap/goal/replacement/**conflict**/
  **better-fit** fixtures + every conflict rule's `resolutionCopy` (which surfaces as a
  recommendation's how-evidence). Positive controls assert the guard fails on
  reintroduced violations.
- **5 design surfaces** + wiring: the calm **"For you" hub** grouped by trigger with
  what/why cards + evidence dot + "See how →" (`app/recommendations/index.tsx`), the
  honest **"you're set"** empty state, the **what / why / how card**
  (`[id].tsx` — type-first What + specific-product placeholder, Why, How-we-decided
  rows, an honest caveat, the disclosed-but-**inert** commerce line, Add-to-shelf /
  Not-for-me), the **preferences** screen (`preferences.tsx`), and the in-routine
  **SPF gap prompt** + Today "For you" card (`RecommendationsTeaser`, on `today.tsx`).
  Replacement **reuses** the existing replenishment sheet (docs/04). You-tab gains a
  **FOR YOU** section.
- **Church and state in code** (D-054): the ranking modules import **no** commerce
  module (doc #10 isn't built); any affiliate link is downstream, **disclosed**
  ("never affects what we recommend"), and **consent-gated** (B-PRIVACY) — the "Where
  to find it" / "see similar" paths are inert and share nothing. **Not Pro-gated**
  (D-057): the trusted advisor is core, gating it would invent a restriction the docs
  don't specify.
- **Adversarially reviewed by a 4-dimension workflow** (RLS/SQL · spec · design ·
  claim-safety/privacy/church-and-state, **16 agents, each finding independently
  verified**) → **0 blocking, 0 high**; RLS/SQL, spec, and design found no confirmed
  defects. Fixed the 3 confirmed lows: the conflict + better-fit engine strings (incl.
  `how.evidence = resolutionCopy`) are now claim-safety-scanned, and the inert "Where
  to find it" tap no longer fires `recommendation_accepted` (a commerce-intent signal
  must never enter the merit relevance funnel — docs/09 §12). D-054…D-057.
- **Gates:** typecheck ✅ · lint ✅ · test ✅ (587).

### Slice 24 — Doc 10 Creator Stacks + ShopMy (the commerce layer) + new design ✅ (2026-06-13)
- **Validated first** (cited deep-research, 25 claims confirmed / 0 refuted, primary
  sources): affiliate is a **six-figure supplement, not a seven-figure pillar** (Yuka:
  97.3% of $7.37M from subscriptions, zero affiliate) — the seven-figure business stays
  a *subscription* business. The research also surfaced a **blocking unknown** (ShopMy's
  documented APIs don't confirm a brand can mint links on its **own** recommendations
  under a house account; link creation is creator-OAuth-only, the Brand Partners API is
  reporting-only/poll-only, **no webhooks**) → the build is **rail-agnostic** and the
  live rail is **stubbed/inert**. Full validation + every-detail spec:
  [docs/10-creator-stacks-build-spec.md](docs/10-creator-stacks-build-spec.md).
- **Church-and-state schema** (migration 0022): the commerce domain (`affiliate_links`,
  `creator_stacks`, `creator_stack_items`, `commerce_click_events`, `order_attributions`)
  walled off **downstream** of the docs/09 ranking engine — **no commission/rate column
  is client-readable**; commission lives ONLY in `order_attributions`, which is
  **service-role only** (RLS enabled, zero client policies — the row-level wall);
  `commerce_click_events` is owner-RLS + content-free; the catalog tables are
  world-readable-to-authenticated / service-role-write (the D-016 pattern). The ranking
  modules import **nothing** from `features/commerce`. `Database` type + `@onskin/types`
  (`AffiliateSource`/`CuratorKind`/`OrderStatus`/`COMMERCE_EVENTS`) extended; no RLS weakened.
- **Pure, tested modules** (`features/commerce/`): `attribution.ts` (the **opaque-token
  trust guard** — `buildOutboundUrl` takes no profile, a health denylist + fixtures
  assert **no skin data ever reaches a retailer**, Doc 10's analogue of the docs/09
  "no commercial input" guard), `links.ts` (**rail-agnostic** `source`-tagged resolution
  + honest empty state, dev-only demo), `stacks.ts` (expert/derm stacks, **B-DERM-REVIEW
  launch gate** `STACKS_REVIEWED` + `shippableStacks()`), `consentLogic.ts` (the pure,
  tested **ledger-authoritative-then-local** consent precedence), `copy.ts` + the
  **FTC/claim-safety guard** ("paid link" not "affiliate link", disclosure unavoidable,
  no dark patterns, concerns-not-conditions), `consent.ts`/`store.ts` (local-first
  MHMDA consent + click token, the D-029 pattern). **83 new fixtures.**
- **4 design surfaces** + wiring: the quiet **consent-gated "where to buy"** beneath the
  rationale (`WhereToBuy.tsx`, in the Doc-9 rec card — replacing its inert link; FTC
  "Paid link" chip + the disclosure **visible with the links**, bold-inked independence
  clause, "add it to your shelf instead"), the expert/derm **shoppable Stack**
  (`app/commerce/stack/[slug].tsx` + `stacks.tsx`), the dark **transparency page**
  (`app/commerce/transparency.tsx` — the Wirecutter-grade church-and-state explainer),
  and the **MHMDA consent gate** (`app/commerce/consent.tsx` — separate/distinct/opt-in/
  revocable, **strict default: no consent ⇒ no paid links**). You-tab gains a **WHERE TO
  BUY** card. A geometric `LockGlyph` replaces colour emoji (no-svg convention).
- **Order-Report poll** Edge Function **stub** (`supabase/functions/order-report-poll/`)
  documenting the poll contract (`record_updated_at` incremental key, 500/page, idempotent
  upsert into `order_attributions`, pg_cron daily) — **inert** behind B-SHOPMY.
- **Honest, inert money path**: physical-goods links take no IAP cut (Apple 3.1.3(e),
  verified); tapping records a content-free click + shows an honest stub; the live ShopMy
  rail + real catalogue/retailers/prices are **B-SHOPMY** + **B-CATALOG-SEED**.
- **Adversarially reviewed by a 4-dimension workflow** (RLS/SQL · spec · design ·
  FTC/MHMDA/claim-safety/church-and-state, **16 agents, each finding verified**) → **0
  blocking**; **1 high fixed**: revoking the You-tab "Share data with partners" toggle now
  re-locks paid links (the ledger is authoritative-when-present + the toggle mirrors the
  local flag + a pure tested precedence) — the MHMDA revocation contract is honoured.
  Lows fixed: the Order-Report poll stub added, the disclosure independence clause
  bold-inked, the colour-emoji shield/lock replaced with a geometric monochrome glyph.
  D-058…D-062.
- **Gates:** typecheck ✅ · lint ✅ · test ✅ (670).

### Slice 25 — Doc 11 Community Layer ("Skin Notes") + new design ✅ (2026-06-13)
- **Validated first** (cited deep-research, 24 verified claims): community is a
  retention/trust **multiplier, NOT a seven-figure pillar** and not required for one
  (Yuka: 97.3% of $7.37M from subscriptions, zero community — `community/forum/feed = 0`
  in its report). An **open UGC feed is value-destroying** for this moat (misinformation
  survives even expert moderation ~21%; photo appearance-comparison correlates r=0.53
  with stigmatisation in acne). The gaming-RCT's **negative contribution×consumption
  interaction** independently supports the phasing. The compliance layer was NOT verified
  this round → prudent-but-unconfirmed (**B-COMMUNITY-LEGAL**). Net: build the narrow
  **expert-anchored "Skin Notes"** trust layer (Phase 1), defer peer posting.
- **Schema** (migration 0023): the 7 community tables — **segregated, consent-scoped,
  and PHOTO-FREE** (no image/storage_path column anywhere — photos can never enter
  community, D-064). `community_notes` has a production gate (`SELECT` only where
  `reviewed_by IS NOT NULL AND claim_safety_ok`); `community_questions` is owner-write/
  moderated-read with **anonymous users locked out of posting** via a restrictive
  `is_anonymous`-JWT policy + an `owns_consent()` definer requiring a current
  `community_participation` grant; `order`/audit tables service-role-only; reports/blocks
  (the Apple-1.2 floor) owner-only. The `consents` enum gains a 7th unbundled type
  `community_participation`. `Database` type + `@onskin/types` extended; no RLS weakened.
- **Pure, tested modules** (`features/community/`): `notes.ts` (the seeded expert "myth
  vs evidence" corpus + the **B-DERM-REVIEW gate** `NOTES_REVIEWED`/`shippableNotes()` +
  the docs/02 evidence-pill mapping + the rule→note bridge), `claimSafetyScan.ts` (the
  pre-moderation **FLAG** — inflected drug/disease verbs, dosage, alarm), `anonHandle.ts`
  (the calm random pseudonym), `copy.ts` + the **claim-safety guard** (concerns not
  conditions, the "not medical advice" disclaimer, "library not a feed", the meta-string
  exemption), `consent.ts`/`store.ts` (the separate `community_participation` consent +
  16+ gate, local-first). **101 new fixtures.**
- **5 design surfaces** + wiring: the **Skin Notes hub** (topic-structured, evidence
  pills, "a library, not a feed"), the **myth-vs-evidence card** (claim/verdict/why/
  source+credential/"not medical advice"/structured "This helped"), the **in-context**
  "Read the evidence" affordance (wired into the conflict niacinamide×vitC reassurance),
  the anonymous **Ask** composer (Phase-2 preview — random handle, live claim-safety
  state, 16+ + consent gates, pre-moderation, posting **deferred**), and **"people like
  you"** (Phase-2 preview, anonymised aggregate). You-tab gains a Skin Notes link.
- **Phase 1 live; peer phases deferred** (D-067): the Ask + people-like-you are
  design-faithful but inert (peer posting needs the moderation/legal store floor —
  **B-COMMUNITY-MOD** / **B-COMMUNITY-LEGAL** / **B-EXPERT-NETWORK**); the kill switch is
  observable tripwires, not an unfireable A/B test.
- **Adversarially reviewed by a 4-dimension workflow** (RLS/SQL · spec · design ·
  claim-safety/MHMDA/moat, **21 agents, each finding verified**) → **1 blocking, 0 high**;
  the blocking item **fixed**: the `community_questions` approved-read policy
  forward-referenced `community_blocks` before that table was created (CREATE POLICY
  resolves relations at creation time → the migration would abort) — `community_blocks`
  is now defined before the policy. 16 other findings refuted. D-063…D-067.
- **Gates:** typecheck ✅ · lint ✅ · test ✅ (767).

### Slice 26 — Doc 12 AI Trend Analysis ("Changes in your own photos") + new design ✅ (2026-06-13) — the LAST build item
- **Validated first** (cited deep-research, 25 claims → 20 confirmed, primary sources):
  AI trend analysis is **NOT a seven-figure pillar** and the population skin score is a
  trust destroyer. Confirmed: the skin-tone fairness gap is **persistent into Dec 2025**
  (AUROC 0.82 darker vs 0.89 lighter, p<0.01); smartphone capture degrades AI (~0.90 →
  0.81); **Monk > Fitzpatrick** (Nature npj 2025 + Google, who *forbid* training on
  MST-E); the **"AI" label is a measured trust tax** (only 5% of US adults trust AI "a
  lot"; healthcare net −23); Yuka is a subscription barcode-scanner with **zero AI face
  analysis**; even the flagship score app (Skin360) is "a sales/recommendation engine."
  Net: **kill the population score; keep refusing AI scores and market the refusal**
  (Phase 0); build only the narrow on-device exception, deferred.
- **The population score is KILLED** (D-068): no score/grade/percentage/"skin age" column
  or copy exists anywhere, by construction. The shipped no-AI-score refusal (docs/06,
  `/progress/about`) is **preserved as the asset** and merely gains an optional opt-in link.
- **Schema** (migration 0024): `photo_trend` (on-device-derived abstract deltas + a
  change-state + a copy key — **no score/image/faceprint column**), owner-RLS; the
  `consents` enum gains an 8th type **`photo_trend_insights`** (separate, default-OFF).
  `Database` type + `@onskin/types` (`TrendChangeState`/`TREND_EVENTS`) extended; no RLS
  weakened.
- **Pure, tested engine** (`features/trend/`): `trend.ts` (the change-state classifier +
  the **tone-adjusted MDC noise floor** — provably **equal-or-higher for darker Monk
  tones**, a test asserts the same delta reads "change" on light skin but "consistent" on
  dark), `copy.ts` (descriptive, claim-safe narratives + the off-by-default opt-in +
  fairness copy), the **claim-safety guard extended to trend strings** (D-070 — no
  number/score/grade/%/disease-detection/superiority/"improved-worse"/structure-function/
  "AI", with a negation-exemption + positive controls), `consent.ts`/`store.ts` (the
  separate consent + deletion-on-revocation). **50 new fixtures.** The real on-device CV
  engine (registration + SSIM/colour delta) is **stubbed behind B-AI-ONDEVICE**; the
  classification + fairness floor are the real logic.
- **5 design surfaces** + wiring: the **preserved refusal** + the opt-in link
  (`/progress/about`); the off-by-default **opt-in** (`app/trend/optin.tsx` — disclosure
  bullets, separate consent, the toggle OFF); the calm **output line** (`TrendInsight`,
  on the Progress tab — "Consistent · adherence win", descriptive, no number); the honest
  **inconclusive states** (lighting / insufficient data); and the **Monk-tone fairness
  floor** (`app/trend/fairness.tsx` — the band, higher-threshold-for-darker-tones,
  redness-not-the-metric, the gate). You-tab + the refusal screen link in.
- **On-device only; cloud is not a phase** (D-069): classical CV honestly framed ("your
  phone comparing your own photos"), never a general LLM, never marketed as "AI". The
  separate `photo_trend_insights` consent is default-OFF + revocable-with-deletion;
  installed base re-consented, never silently enrolled (D-072).
- **Review note:** the 4-dimension adversarial review + the deep-research synthesis hit a
  session/rate limit mid-run (the review's 4 agents were cut off → could not complete; the
  research returned 20 confirmed claims but its synthesis step failed). A **targeted manual
  verification** of the highest-risk items passed: migration 0024 re-adds the consent
  constraint with **all 8 types** (incl. `community_participation`, so it can't break);
  **no score/grade/image column** exists in `photo_trend`; the fairness monotonicity +
  claim-safety + classification are covered by the 50 passing tests. The full multi-agent
  review can be re-run after the limit resets. D-068…D-072.
- **Gates:** typecheck ✅ · lint ✅ · test ✅ (817).

### Slice 27 — Doc 13 "Ask OnSkin" assistant + new design ("OnSkin Ask Assistant") ✅ (2026-06-14) — founder-delegated, beyond the 12
- **Stress-tested first** (a 13-agent adversarial fact-check + red-team + completeness pass
  on the written doc): retired the falsified "non-copyable context moat" (ChatGPT free-tier
  now persists context; independent shelf-aware competitors ship), corrected the misattributed
  trust/cost stats, and forced the **template-bounded narration** architecture. Verdict: a
  seven-figure **contributor, not a king-maker** — narrow/structural moat (deterministic
  correctness + provable independence + privacy + owned context), deferred + Pro-gated.
- **The deterministic, on-device advisor is the whole v1 and ships at $0** — the language
  model is the interface, the curated engine is the truth, and **substantive health claims
  are template-filled from the engine, never free-generated** (D-073). The cloud-grounded
  layer is deferred (**B-AI-ASSISTANT-VENDOR**) and degrades honestly.
- **Schema** (migration 0025): the `consents` enum gains a 9th type **`ask_onskin`**
  (separate, default-OFF — the question is a health disclosure *transmitted* to the cloud,
  Art. 9); **content-free** `ask_sessions`/`ask_turn_audit` (intent + verdicts + version
  pointers + a `narration_engine_mismatch` counter, **no message text**); the short,
  consented, encrypted `ask_safety_audit` window (resolving the "no transcript" vs
  auditable/EU-AI-Act contradiction); owner-RLS; **no commission/score/photo column** in any
  Ask path. `@onskin/types` (`ASK_INTENTS`/`ASK_EVENTS`, `GatedFeature += 'ask'`) extended.
- **Pure, tested feature** (`features/ask/`): the medical-first **intent router**
  (`intent.ts`), the engine-reuse, template-bounded **answer builder** (`answer.ts` —
  reuses `detectConflicts`/`recommend`/`generatePlan` + claim-safe copy), the **broadened
  runtime claim-safety guard** (`guard.ts` — the shipped scan + the full disease/superiority/
  score/AI nets), the pure Pro-gate (`gate.ts`), the local-first consent + turn-counter
  store, and the orchestration hook. **29 new tests** (claim-safety on all copy + generated
  answers, intent routing, answer behaviour incl. the pregnancy-safety escalation, gate, the
  fit-rec picker).
- **5 design surfaces** + wiring: the **home** (shelf-grounded suggested prompts + pills +
  intro + input bar + the honest AI-disclosure footer), the **deterministic $0 answer** (the
  green ✓ badge + what/why/how + citation/severity chips + "recommendation, not a rule"), the
  **fit** answer, the **refuse + verbal escalation**, and the **default-OFF privacy gate**
  (`ask_onskin`). Surfaced free on Today (`AskTeaser`) + You. Calm, reactive, non-
  anthropomorphic; ends clean; no re-engagement.
- **Adversarially reviewed** (a 4-dimension review, each finding independently verified: 18
  findings → 17 confirmed → fixed). Two HIGH safety fixes: **safety conflicts (e.g. a
  pregnancy contraindication) now ESCALATE, never "you're set"** (D-077), and the medical
  escalation is **verbal-only — no misrouted "find a derm" CTA** (D-077). One MEDIUM fix:
  product-fit uses catalog-backed recs so a "7%" product name never false-trips the runtime
  guard (D-078). Plus a11y, telemetry, and the broadened runtime guard.
- **Gates:** typecheck ✅ · lint ✅ · test ✅ (932).

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
6. ✅ Guided photo capture + comparison — Doc 6 (Slice 20): local-first capture/review/timeline/compare, no-AI-score, biometric gallery lock, unbundled photo consents; on-device camera pipeline deferred to **B-CAMERA**
7. ✅ Reminders / streaks / widgets — Doc 7 (Slice 21): tiered local-first notifications + frequency caps + quiet hours, the calm forgiving streak, soft-ask + settings hub + timing + welcome-back + widget/Live-Activity previews; native widgets/delivery deferred to **B-WIDGETS** / **B-NOTIF-VERIFY**
8. ✅ Subscriptions / paywall — Doc 8 (Slice 22): reverse-trial conversion model, honest paywall + lifecycle screens, local-first entitlement gating; native IAP deferred to **B-REVENUECAT**, store/ARL review to **B-LEGAL**
9. ✅ Personalized recommendations — Doc 9 (Slice 23): the independent, needs-based "church and state" advisor — the six honest triggers + an honest "you're set", the merit-only six-input FIT score (no commercial input), type-first + restrained, the what/why/how explainability, the "For you" hub + card + preferences + in-routine gap prompt; goal-active rec types launch-gated under **B-DERM-REVIEW**, the commerce/affiliate path deferred + inert (doc #10 / **B-PRIVACY** / **B-CATALOG-SEED**)
10. ✅ Creator stacks + ShopMy — Doc 10 (Slice 24): the walled-off "where to buy" commerce layer on OnSkin's own independent recommendations — church-and-state schema (commission service-role-only, never client-readable, never in ranking), opaque-token attribution (no skin data to retailers), FTC "paid link" disclosure, the MHMDA consent gate, expert/derm shoppable stacks + the transparency page; validated as a **six-figure supplement** (not 7-figure). The live ShopMy rail is **rail-agnostic + stubbed/inert** — the house-account model is unconfirmed (**B-SHOPMY**), real catalogue/prices (**B-CATALOG-SEED**), final consent copy/DPIA (**B-PRIVACY**), stacks sign-off (**B-DERM-REVIEW**)
11. ✅ Community layer — Doc 11 (Slice 25): the expert-anchored, anonymous, claim-safe "Skin Notes" myth-vs-evidence trust layer — NOT an open feed. Photo-free + anon-locked-out + consent-scoped schema; the B-DERM-REVIEW-gated expert corpus; the claim-safety pre-moderation flag; the 5 surfaces (hub, card, in-context, Ask, people-like-you). Validated as a retention **multiplier, not a 7-figure pillar**. Phase 1 live; peer posting deferred behind the moderation/legal floor (**B-COMMUNITY-MOD** / **B-COMMUNITY-LEGAL** / **B-EXPERT-NETWORK**), clinical sign-off (**B-DERM-REVIEW**), consent copy/DPIA (**B-PRIVACY**)
12. ✅ AI trend analysis — Doc 12 (Slice 26, intentionally last): the population skin score **killed outright**; the shipped no-AI-score **refusal preserved + marketed** (Phase 0); the only-defensible narrow exception built — on-device, within-person, descriptive, **no-number** "Changes in your own photos" (off by default, separate `photo_trend_insights` consent, tone-adjusted MDC floor, redness-never-the-metric, classical CV not an LLM, never marketed as "AI"). Validated as **not a 7-figure pillar**. The real on-device CV engine + fairness cohort + legal sign-off deferred (**B-AI-ONDEVICE** / **B-AI-FAIRNESS** / **B-AI-LEGAL**)

**🎉 All 12 build-order documents are now BUILT (Slices 0–26).** Every remaining item is a
founder blocker (accounts/keys/legal/clinical/native dev build/catalog seed) — see BLOCKERS.md.

**Founder-delegated extensions (beyond the 12):**

13. ✅ "Ask OnSkin" assistant — Doc 13 (Slice 27): the grounded, **template-bounded** conversational front-end to the on-device intelligence layer — NOT an open chatbot. The deterministic, on-device, $0 advisor (conflict/routine/fit answers about your own shelf, refuse-over-guess, verbal clinician escalation, **safety conflicts always escalate**) ships as v1; substantive claims are template-filled from `detectConflicts`/`recommend`/`generatePlan`, never free-generated. New `ask_onskin` default-OFF consent + content-free/safety-audit-only schema (migration 0025); the broadened runtime claim-safety guard; the 5 surfaces + Today/You entry. Stress-tested + adversarially reviewed. Validated as a seven-figure **contributor, not a king-maker** (narrow/structural moat). The whole **cloud-grounded language layer is deferred** (**B-AI-ASSISTANT-VENDOR** / **B-AI-ASSISTANT-SAFETY** / **B-AI-ASSISTANT-LEGAL**, + **B-CATALOG-SEED** / **B-DERM-REVIEW** for the corpus).

## Post-build audit (per-doc fidelity pass)

### docs/01 — auth / onboarding / data model / RLS ✅ (2026-06-25)
Feature-fidelity re-audit of the implemented build against docs/01. Verdict: faithful and
high-quality — all 12 §3 tables match (RLS `(select auth.uid())` + `TO authenticated` +
`WITH CHECK` + indexed + definer helpers; append-only completions w/ 48h server cap +
hybrid cached streaks; immutable consents w/ DB update-block; private photos bucket + the
anon no-cloud-backup restrictive policy). LargeSecureStore, native Apple/Google + email-OTP,
biometric app-lock, the full §2 onboarding sequence (health-consent gates the quiz), and the
deletion/export/RC-webhook Edge Functions are all present. Two real, non-founder-blocked gaps
were found and **closed**:
- **Neutral DOB age gate (§4)** — built `app/onboarding/age.tsx` + tested pure `ageGate.ts`
  + `ageGateStore.ts` (stores only the pass flag, **never the DOB**). Placed before any data
  collection; blocks under-16. Threshold/parental-consent path still a counsel call.
- **Persisted offline check-off queue (§6)** — built `lib/offline/completionQueue.ts`
  (+ tested pure helpers) + `OfflineSync.tsx` foreground drain; the Today read merges pending.
  Fixed the misleading `queryClient.ts` comment.

Remaining docs/01 items are minor/deferred (orphan-anon cleanup → infra/B-SUPABASE;
anon→social linking mitigation → B-VERIFY-AUTH-LINKING; hard-delete-by-design;
consents ip/ua server-side). See BLOCKERS.md "Design-audit follow-ups".
**Gates:** typecheck ✅ · lint ✅ · 939 tests ✅.

### docs/02 — ingredient intelligence (catalog / conflict engine / scheduler / PAO) ✅ (2026-06-25)
Feature-fidelity re-audit against docs/02. Verdict: faithful and high-quality. All §3
catalog tables match (ingredients/synonyms/tags/products/product_ingredients/conflict_rules/
ingredient_pao_defaults + routine_conflicts; catalog world-readable, service-role write,
only `is_active` rules exposed; routine_conflicts owner-RLS hardened with `owns_user_product`).
The §4 engine is complete (5 interaction types + `myth`, both-orders tag matching, concentration/
sensitivity modulation, sub-flag exemptions, dose-gated + pregnancy-pseudo-tag safety, safety-first
ranking) with the **B-DERM-REVIEW runtime gate** (`shippableRules`/`reviewedCategoryPao` hide
unreviewed rules/PAO in production). 13 of the ~15 §4.4 rules seeded; seed SQL (0013) mirrors the
client `rules.ts` UUIDs exactly. The Maya fixture asserts **Moderate / contested / alternate_nights**;
the scheduler computes the **next-acid-night**. PAO (§6) resolves label→category→honest "PAO est.";
the conflict sheet is resolution-first, never-blocked, with the §4.3 honesty note. One real gap
**closed**:
- **Standing "not medical advice" disclaimer (§9)** — was present only in community/ask; added a
  shared `lib/legal/disclaimer.ts` and surfaced it on the conflict-detail/safety sheet, in Settings
  (You tab), and on the onboarding health-consent screen. Final wording is a counsel item
  (B-LEGAL / B-PRIVACY-COPY).

Deferred-by-design (documented): server `detect_conflicts(uid)` SECURITY DEFINER deferred in
favor of one tested TS detector (D-021 / B-SERVER-DETECT). Key/clinical-blocked (correct):
CosIng/OBF catalog seeding + OCR/scan (B-CATALOG-SEED), clinical sign-off of the matrix + PAO
defaults (B-DERM-REVIEW), PostHog conflict funnel events (B-POSTHOG).
**Gates:** typecheck ✅ · lint ✅ · 939 tests ✅.

### docs/03 — routine builder (generation / sequencing / ramp / cycling / habit loop) ✅ (2026-06-25)
Feature-fidelity re-audit against docs/03. Verdict: faithful and high-quality. §2 deterministic
pipeline (`generate.ts`: classify → sequence → cycling nights → ramp init → gaps → gated conflict
detection); §3 `sequencing_rules` (0014, 10 roles, versioned, B-DERM-REVIEW); §4 `active_ramp` (0015,
owner-RLS) + `ramp.ts` (sensitivity-keyed init, offer-only step-ups ~21d, auto de-escalate); §5
cycling + next-acid-night; §6 calm forgiving streak (`streak.ts`: freeze window, recovery-nights-count,
neutral-today, non-decreasing best, weekly adherence + month heat-map) — the persisted offline
check-off queue it depends on (D-007/§6) was the docs/01 fix above. Two real gaps **closed**:
- **"Use together anyway" re-nag (§7 / Rec 7)** — the override was written to `routine_conflicts`
  (B-SUPABASE, best-effort) but never read back, so the shelf banner re-surfaced the conflict despite
  the sheet promising "we won't re-nag". Added a local-first override store (`intelligence/overrides.ts`),
  suppressed overridden conflicts from the shelf banner (`useShelf`), and persist + invalidate on choice.
- **B-DERM-REVIEW gate leak** — `usePlan` passed raw `STARTER_RULES` (ungated) while useShelf/recommendations/
  `generate` default to `shippableRules()`; in production this surfaced unreviewed conflict rules in the
  plan (e.g. the vit-C synergy note). Switched usePlan to `shippableRules()`.

Deferred-by-design/blocked (documented): server `build_routine(uid)`/`recompute` + per-user cycle
anchor persistence (B-ROUTINE-PERSIST/B-SUPABASE; client engine + local anchor cover v1), full
drag-and-drop reorder (B-DRAG-DND; handles + non-blocking nudge built), clinical sign-off of
sequencing/ramp/cycling rules (B-DERM-REVIEW), PostHog routine events (B-POSTHOG).
**Gates:** typecheck ✅ · lint ✅ · 939 tests ✅.

### docs/04 — smart shelf (intake / PAO / lifecycle / replenishment) ✅ CLEAN (2026-06-25)
Feature-fidelity re-audit against docs/04. Verdict: faithful and complete — **no unblocked gap found**.
Migration 0016 matches §2 (additive `user_products` columns with correct enums + the careful note that
created_at/updated_at already exist in 0005; the `(user_id, status, expiry_computed)` index; `shelf_scans`
owner-RLS incl. the contribute-back UPDATE). The local-first store (`shelf/store.ts`) carries the full §2
shape (opened-date linchpin, `isOpened` unopened state, `paoSource`/`expirySource` provenance, lifecycle
`status`/`finishedAt`, `repurchaseCount`, on-device `thumbnailPath`) with add/update/remove/`reAddProduct`
(replenish: archive old unit + fresh one, reset clock, carry repurchase count). The 5-state badge taxonomy
(`pao.ts`), the SPF-printed-expiry-wins `least()` logic, the All/Actives/Expiring filters, the calm
override-aware conflict banner, and the intake routes (scan/no-match/ocr/manual/opened/[id]/archive/replenish)
are all present. Replenishment is correctly **inert + consent-gated** (shares nothing; B-PRIVACY).
Blocked (correct): live barcode/OBF scan + OCR (B-CATALOG-SEED + B-CAMERA), contribute-back job
(B-SHELF-CONTRIB), data-sharing consent + ShopMy affiliate (B-PRIVACY / B-SHOPMY), server persistence
(B-SUPABASE), PAO defaults sign-off (B-DERM-REVIEW), PostHog scan funnel (B-POSTHOG).
**Gates:** typecheck ✅ · lint ✅ · 939 tests ✅ (no code change this doc).

### docs/05 — actives / skin-cycling scheduler ✅ CLEAN (2026-06-25)
Feature-fidelity re-audit against docs/05. Verdict: faithful and complete — **no unblocked gap**.
Migration 0017 (`cycles` + `cycle_nights`, owner-RLS via `owns_cycle`) matches §3. The pure
`projection.ts` implements the safe-modulo `night_index`, tonight/week-ahead, and `nextSlotDate`
(next acid/retinoid night); `orchestrate.ts` is the multi-active core (one potent active/night and
retinoid≠exfoliant **by construction**, launch-gated class frequency caps, variant-keyed recovery,
pregnancy retinoid suppression whose note always travels, phased introduction, null cycle → simple
daily AM/PM). Pause/resume **re-anchoring** ("resume where left off", D-027) is correct in
`cycleStore.ts`. All §6/§7 surfaces have routes (week/settings/why-tonight/disruption/procedure/
recovery/phased-intro); auto-de-escalation rides the docs/03 ramp `deEscalate`. Blocked (correct):
server `orchestrate()`/`schedule_for()` (B-SERVER-DETECT/B-ROUTINE-PERSIST), drag-to-reassign nights
(B-DRAG-DND), reminder delivery (doc 7), clinical sign-off of frequency/separation/recovery rules
(B-DERM-REVIEW). **Gates:** typecheck ✅ · lint ✅ · 939 tests ✅ (no code change this doc).

### docs/06 — guided photo capture + progress comparison ✅ CLEAN (2026-06-25)
Feature-fidelity re-audit against docs/06. Verdict: faithful and complete — **no unblocked gap**.
Migration 0018 adds the §6 columns (reference/series/session/coarse pose/taken_local_date/time_of_day/
notes/local_uri/is_encrypted) with a **restrictive policy forcing `reference_photo_id` to be owned**
(defense-in-depth via `owns_photo`) and RLS unchanged. The local-first photo store (`photos/store.ts`)
enforces the privacy core: **`local_only` always true, `storage_path` null, metadata-only Supabase mirror
(image bytes + `local_uri` never sent), `is_encrypted` true, no faceprint (head pose is coarse QA only),
first-of-series → reference**. The two unbundled consents (`photo_capture` + `photo_cloud_backup`,
off-by-default) + biometric gallery lock + the no-AI-score stance (`about.tsx`, claim-safety guard) +
Compare slider/Timeline/single-photo surfaces are all present; quality/timeline helpers are pure+tested
(89 fixtures). Blocked (correct): on-device camera + face detection + encryption + cloud upload (B-CAMERA;
capture is simulated), DPIA + "never leaves your device" claim + final photo consent copy
(B-PRIVACY/B-PRIVACY-COPY), server persistence (B-SUPABASE), reminder delivery (Doc 7).
**Gates:** typecheck ✅ · lint ✅ · 939 tests ✅ (no code change this doc).

## Open questions for the founder
- See [BLOCKERS.md](BLOCKERS.md) — consolidated. Highest priority: Documents 2–15
  are missing from /docs (B-MISSING-DOCS); legal copy + quiz questions (B-QUIZ-COPY,
  B-PRIVACY-COPY); and the account/key items (Supabase, RevenueCat, Apple, Google,
  PostHog, Sentry, Turnstile).
