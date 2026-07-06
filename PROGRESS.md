# Build Progress

Tracks the build against docs/00 §"build order". One slice per commit.
See [DECISIONS.md](DECISIONS.md) for implementation choices and
[BLOCKERS.md](BLOCKERS.md) for everything waiting on the founder.

## 2026-07-06

- Fixed the Ask OnSkin empty-shelf conflict reassurance after 320x568 E2E showed a
  typed retinol/glycolic question on `/ask` replying `Nothing on your shelf clashes
  right now. You’re set.` even though there were no shelf products to check. The
  deterministic Ask context now distinguishes an empty shelf from a populated shelf
  with zero conflicts, so empty-shelf conflict questions ask the user to add products
  before real pair checks. E2E rechecked `/ask`, Ask report feedback, `/ask/consent`,
  Skin Notes hub/detail, deferred community posting routes, stale note recovery, and
  phone-width control geometry in `test-results/human-e2e/2026-07-06/ask-community-composer-next-slice/`.
- Fixed the cycle settings variant copy after a 320x568 E2E pass with real
  retinol and glycolic shelf actives showed `/cycle/week` honestly generated a
  `classic, 6 nights` schedule while `/cycle/settings` still advertised the
  Classic option as `4 nights`. The selected variant card now reports the
  generated cycle length, unselected cards use non-fixed descriptors, and the
  variant buttons expose matching accessibility labels. E2E rechecked the
  two-active manual shelf setup, cycle settings, tapping a future week row into
  the selected-night explanation, scrolling to `Got it`, and returning to the
  week view with no horizontal overflow.
- Fixed subscription settings free-state policy access after 320x568 E2E showed
  `/settings/subscription` exposed Restore only for free users, even though the
  settings branch and subscription spec require Terms and Privacy access from the
  subscription settings surface. Free subscription settings now show Restore,
  Terms, and Privacy as 48 px full-row actions, and E2E rechecked
  subscription/notification/timing direct-entry Back recovery to `/you`.
- Fixed lifecycle paywall compliance reachability after 320x568 E2E showed
  `/paywall/reoffer`, `/paywall/downgrade`, and `/paywall/winback` could present
  purchase or re-subscribe actions without Terms, Privacy, or Restore controls
  on the paywall surface. The three lifecycle routes now reuse the shared 48 px
  compliance row, win-back uses the dark tone, and the paywall exit path also
  buffered the Today SPF prompt dismiss control from exact 44 px to 48 px after
  Expo web rendered it at 43.99 px.
- Fixed the Shelf scan CTA short-phone overlap after 320x568 E2E showed the
  floating `Scan a barcode` pill covering the first product card and stealing a
  product-detail tap. Compact Shelf layouts now render the scan action inline
  inside the scroll content while taller phones keep the floating CTA; E2E
  verified product-card taps open detail, all active products can be marked
  finished, the empty Shelf exposes a 48 px Archive action, and Archive opens,
  scrolls, and returns cleanly.
- Fixed product-detail duplicate conflict rendering after 320x568 E2E with a
  duplicated retinol shelf fixture showed a red runtime warning toast over the
  detail UI. Product detail conflict rows now use the existing rule-plus-product
  `conflictKey`, so repeated same-rule interactions render cleanly; E2E verified
  no duplicate-key console errors, lower conflict rows scroll correctly, lifecycle
  actions stay reachable, and direct-entry Back returns to Shelf.
- Fixed the conflict detail short-phone sheet after 320x568 E2E with real
  retinol/glycolic shelf data showed the dense sheet clipping its title and
  context offscreen while `Use together anyway` rendered as a 40 px target.
  Conflict sheets now cap to viewport height, scroll dense content internally,
  and keep secondary, share, and safety actions at 48 px; E2E verified top
  content visibility, reachable actions, and the direct-entry exit back to
  Shelf.
- Fixed the progress review short-phone action clip after 320x568 E2E showed
  `/progress/review` pushing `Retake` and `Save to my phone` below the viewport.
  The review hero now scales down on compact phones, the quality note spacing
  tightens, and the 56 px actions stay fully visible; E2E also rechecked
  Progress capture, no-score, missing-photo, and deferred Trend exits.
- Fixed the routine plan direct-entry trap after 320x568 E2E showed
  `/routine/plan` had no visible escape when opened from You, leaving only
  `Start today`. The plan screen now uses the shared 48 px Back control with a
  You fallback, scrollable review content, and a tighter CTA reserve; E2E
  verified Back returns to `/you`, `Start today` remains 56 px, and the gap note
  clears the CTA with no overflow or small controls.
- Fixed the You tab short-phone first-viewport overlap after 320x568 E2E showed
  routine rows sitting behind the floating tab bar. Compact You screens now use
  denser account, subscription, and routine spacing, 48 px compact account and
  row targets, and a larger scroll buffer; E2E verified the last visible routine
  row taps through cleanly and the bottom data actions remain reachable.
- Fixed the Ask OnSkin proactive-answer layout after 320x568 E2E showed the
  automatic first answer starting scrolled under the header and a follow-up
  prompt clipping behind the composer. Automatic lead-in answers now stay
  anchored below the title, user-triggered turns still scroll to the latest
  message, and compact phones show one follow-up prompt plus the composer; E2E
  verified no clipped, small, or overlapped controls on `/ask`.
- Fixed the Today SPF prompt short-phone tab-bar overlap after a 320x568 E2E
  sweep showed `See why` and `Not now` sitting under the floating navigation.
  Compact Today screens now tighten the trial banner and routine card, preserve
  48 px recommendation actions, suppress redundant recommendation chrome while
  the SPF prompt is visible, and keep optional lower cards out of the first
  compact viewport; E2E verified zero overlapped controls and no horizontal
  overflow at 320x568.
- Refined the floating bottom tab bar after E2E review showed the active black
  icon chip made the navigation feel heavy and left label readability too tight
  for a premium phone UI. The bar now uses a calmer white raised surface,
  Wealthsimple-style minimal active treatment, 13 px one-line labels, 56 px tab
  targets, and an explicit stacking layer; E2E verified Today, Progress, Shelf,
  and You switching at 320 px plus readable 390 px geometry.
- Fixed the onboarding paywall short-phone conversion path after 320x568 E2E
  showed `Start free trial`, `Explore first`, and the compliance row below the
  first viewport. Compact phones now tighten paywall spacing while preserving the
  four value props, conspicuous annual price, no-card reverse-trial path, and
  48 px Terms/Privacy/Restore targets; E2E verified `Explore first` routes to
  `/routine/plan`.
- Fixed onboarding fixed-footer overlap after 320x568 E2E showed the final goals
  and product `Add to shelf` action running underneath the bottom Continue/Skip
  button. Goals and product intake now keep enough scroll padding for short
  phones, and E2E verified selecting `Barrier repair`, continuing to consent,
  typing a product, and adding it from the lower form action.
- Fixed the weekly tolerance check-in sheet after 320x568 E2E showed the
  `Irritated` choice and disabled `Save` action below the first viewport.
  Compact phones now show Skip, all three tolerance choices, and Save with
  buffered touch targets; selecting `Irritated` still routes into recovery, whose
  short-phone layout now keeps the `Ease back in` action visible.
- Fixed the cycle disruption sheet after 320x568 E2E showed the post-procedure
  recovery option hidden below the first viewport. Compact phones now show all
  four disruption choices as 70 px+ rows with contextual accessibility labels,
  and tapping `I had a facial or peel` still opens the recovery route.
- Fixed the phased-introduction cycle sheet after 320x568 E2E showed the
  `Sounds good` action clipped and `Add it now anyway` pushed below the first
  viewport. Compact phones now use tighter sheet spacing, skip the tiny backdrop
  reserve, and show both 48 px+ actions with a visible bottom buffer.
- Fixed the Shelf empty-active archive trap after 320x568 E2E showed finishing
  the only product returned to an empty Shelf with no route back to archived
  history. The empty state now exposes the 48 px View archive action when archive
  history exists, and the populated Shelf archive link uses the same buffered
  target and accessibility label.
- Tightened the floating bottom tab bar to a cleaner Wealthsimple-style capsule
  after 320 px E2E review showed the selected tab treatment still felt bulky and
  label geometry was operating at the edge. The active state now uses a compact
  dark icon chip with larger readable labels, and Expo web E2E verified 60 px
  targets plus Today, Progress, Shelf, and You switching at 320 px and 390 px.
- Fixed the Shelf scan no-camera fallback after 320x568 E2E showed the camera
  permission card squeezed behind the route header with a scan reticle over
  fallback copy. Short phones now use a compact scan card, hide the reticle when
  no camera is visible, and keep OCR/search/manual fallback actions reachable.
- Fixed the onboarding health-data consent screen after 320x568 E2E showed the
  fixed action stack covering legal copy. Consent copy now scrolls above the
  buffered agreement actions, with all three action targets staying at 48 px or
  taller on short phones.
- Buffered the shared deferred-surface Back CTA after 320 px E2E showed deferred
  commerce direct-entry copy placing the only action flush against the bottom edge.
  Deferred launch-gate copy now scrolls above a padded action area with a 24 px
  rendered bottom buffer on Expo web.
- Fixed the remaining Shelf card metadata orphan-wrap case after 320 px E2E
  showed `Jul` could still land on its own line. Short metadata phrases now stay
  together while separators still allow clean line breaks, and Expo web E2E
  verified the manual retinoid card wraps as `opened Jul`.
- Fixed the Shelf card metadata wrap after 320 px navigation E2E showed a manual
  product line breaking to a stray leading `· opened Jul`. Shelf metadata now
  uses a non-breaking separator so provenance and opened-date text wraps cleanly.
- Fixed the Cycle settings active-night labels after route audit found the
  scheduler week view correctly wraps zero-based indexes for users but settings
  still rendered raw `N0`-style night numbers. Settings now uses the same
  one-based cycle-night label as the week overview.
- Fixed the Ask OnSkin empty state after 320 px E2E showed the third suggested
  prompt sliding under the fixed composer. The prompt rows keep 48 px touch
  targets but use tighter short-phone spacing so all starter prompts clear the
  input bar.
- Fixed the Shelf OCR manual fallback after 320 px E2E showed the disabled final
  Continue action overlapping the ingredient text area before manual-review
  mode. The editable text area and final action now appear only in review mode,
  with enough scroll padding for the fixed footer.
- Fixed the Shelf opened-date intake sheet after 320 px E2E showed the third
  opened-state choice cut off on initial load. The sheet now uses the visible
  Close control instead of reserving a large backdrop strip, keeping all three
  core choices visible on short phones.
- Fixed the Shelf catalog search row after 320 px E2E showed the Search action
  clipping past the right edge. The input now shrinks correctly and the Search
  action keeps a 50 px buffered target inside the viewport.
- Fixed the populated Progress comparison surface after 320 px E2E showed the
  Photo CTA, Compare/Timeline tabs, No scores link, Side-by-side toggle, and
  date-change chips rendering below 44 px or clipping right. The controls now
  use 48 px buffered targets and the No scores link wraps to its own row.
- Fixed the Today streak/adherence pill grammar so a one-day streak reads
  `1 day` instead of `1 days`, while keeping the 48 px phone target and
  local-first streak path.
- Buffered the Today header streak/adherence pill to a 48 px phone target while
  keeping the calm chip treatment, and made progress loading fail-soft when
  Supabase is not configured so local check-offs still surface the streak. The
  Today flow tree now includes the streak pill target in the routine-completion
  path, with route/progress contract tests guarding both fixes.
- Refined the floating bottom tab bar toward the Wealthsimple-style reference:
  wider phone geometry, a quieter warm selected state, dark active labels, and a
  small active rail instead of the cramped black active block. Expo web E2E at
  320 px and 390 px verified readable labels, 62 px tab targets, and successful
  switching across Today, Progress, Shelf, and You.
- Replaced the Pro cycle settings fake drag handle/deferred reorder copy with
  honest `Scheduled` row badges and polished variant-recalculation copy. Expo
  web E2E at 320 px added two shelf actives through manual intake, started the
  no-card reverse trial, and verified unlocked `/cycle/settings` shows scheduled
  rows with no deferred drag-and-drop copy.
- Added contextual accessibility labels to each reminder time-picker row so
  assistive tech names both the setting and the candidate time. Expo web E2E at
  320 px verified contextual picker-row labels, 48 px row geometry, and applying
  a new morning reminder time from the sheet.
- Added contextual accessibility labels and time-picker hints to the reminder
  timing pills so screen-reader users hear the control purpose, not just the
  raw time. Expo web E2E at 320 px verified the timing route labels, 48 px
  control geometry, and morning picker opening/dismissal surface.
- Reworked the reminder timing and Progress comparison picker sheets so their
  backdrops expose named dismiss actions and their sheet bodies no longer create
  inert unlabeled tap targets. Expo web E2E at 320 px verified timing picker
  dismissal and modal accessibility geometry.
- Removed the fake inactive circular control from the Progress capture header by
  replacing it with a transparent 48 px spacer that balances the real Close
  button. Expo web E2E at 320 px verified direct `/progress/capture` geometry
  and the Not now escape path back to Progress.
- Audited the floating bottom tab bar on Expo web at 320 px and 390 px; labels
  and tab switching passed. Buffered the notification settings editable reminder
  row text targets from exact 44 px to 48 px and verified `/settings/notifications`
  at 320 px.
- Buffered remaining exact-44 interactive text controls in community, cycle,
  routine tolerance, recommendation preferences, and Shelf replacement surfaces
  to 48 px. Expo web E2E at 320 px verified recommendation preference chips
  render around 48 px, remain scroll-reachable, and still toggle selection.
- Human-simulated E2E reproduced the expired subscription settings win-back CTA
  at 43.99 px tall on a 320 px phone viewport. Buffered the CTA to 48 px and
  added a settings route contract test to prevent the exact-44 px regression.
- Human-simulated E2E reproduced the Shelf replenish missing-product `Close`
  exit at 43.99 px tall on a 320 px phone viewport. Buffered replenish text
  exits to 48 px and updated the Shelf route contract test.
- Human-simulated E2E reproduced the Shelf opened-date and PAO chips at
  43.99 px tall on a 320 px phone viewport. Buffered the intake chips to 48 px
  and updated the Shelf route contract test.
- Human-simulated E2E reproduced the Shelf scan torch switch at 43.99 px tall
  on a 320 px phone viewport. Buffered the switch target to 48 px and updated
  the Shelf route contract test.
- Wired barcode scan lookup outcomes to the owner-scoped `shelf_scans` intake
  log and added privacy-safe `product_scanned` analytics metadata. Expo web
  320 px verification covered the scan fallback surface and manual fallback
  path; native camera barcode decode still needs device QA.

Legend: done / partial / not started / launch-blocked. Use the readiness
statuses in `LAUNCH_READINESS.md` for current production state:
`implemented`, `stubbed`, `simulated`, `inert`, `needs-device-verification`,
and `launch-blocked`.

## Current launch status (2026-07-04)

The app is a substantial pre-launch build, not a production-ready release.
Docs 00-14 plus `docs/legal-readiness.md` exist, and the stale missing-docs
blocker has been removed from `BLOCKERS.md`.

Fresh verification on 2026-07-04: `npm run typecheck`, `npm run lint`, and
`npm test` passed; Vitest reported 38 test files and 986 tests.

Fresh source-of-truth docs added for Phase 1:

- `LAUNCH_READINESS.md`
- `docs/brand-evidence.md`
- `docs/brand-decision-memo.md`
- `docs/v1-scope-freeze.md`
- `docs/phase-2-readiness-checklist.md`
- `docs/seven-figure-readiness.md`

Phase 2 local infrastructure scaffolding added on 2026-07-04:

- `apps/mobile/app.config.js` and `apps/mobile/eas.json` for dev/staging/prod
  variants.
- RevenueCat, PostHog, and Sentry native/runtime wiring with production guards.
- `scripts/phase2/check-env.mjs`, `scripts/phase2/supabase-rls-smoke.mjs`, and
  `scripts/phase2/deploy-supabase-staging.ps1`.
- `docs/phase-2-production-infrastructure-runbook.md`,
  `docs/phase-2-status.md`, and `docs/store-privacy-inventory.md`.

Still blocked: real external accounts, secrets, Supabase deploy, RevenueCat
products/offerings, Apple/Google store records, EAS builds, device QA, legal
review, and brand clearance.

Phase 3 local clinical/legal/policy scaffolding added on 2026-07-04:

- `docs/phase-3/` regulatory positioning, claims vocabulary, clinical review,
  chemistry review, quiz FTO, data inventory, consent, store metadata, Apple,
  Google, and review-packet docs.
- `scripts/phase3/audit-copy.mjs` and `scripts/phase3/build-review-packet.mjs`,
  exposed through root package scripts.
- Central policy link registry plus in-app policy/data-rights links.
- Conservative store metadata draft and tests for store-claim safety.
- Production gate tests verifying unreviewed rules, PAO defaults, stacks, notes,
  and medical-adjacent recommendations stay gated until review.

Still blocked: actual attorney, dermatologist, cosmetic chemist, privacy, and
IP/FTO signoffs. Phase 3 cannot be honestly complete until those signoffs are
attached to the generated review packet hashes.

Phase 4 product and ingredient catalog scaffolding added on 2026-07-04:

- Additive catalog migration for source records, import batches, brands,
  product barcodes, categories, ingredient-list parse records, tag assignments,
  active bands, PAO/expiry provenance, correction reports, contribution queue,
  quality reports, lookup events, and shelf catalog metadata.
- Source/legal docs for CosIng, Open Beauty Facts, ODbL, ingredient taxonomy,
  curation sheet, observability dashboard, beta coverage, and exit review.
- Pure TypeScript ingredient parser, product quality model, OBF mapping, catalog
  client helpers, and focused tests.
- `scripts/phase4/*` for source env checks, OBF fixture import, and generated QA
  reports.
- Supabase Edge Functions for exact barcode lookup, local catalog search, and
  correction reporting.
- Mobile shelf search fallback, parser-backed OCR/manual intake metadata,
  source/quality disclosure on product detail, and report issue flow.

Still blocked: source/legal review, ODbL posture, real OBF/CosIng import,
curated launch batch, beta coverage, final attribution page/User-Agent, native
camera device verification, native OCR, and professional review for
recommendation-driving product data.

Phase 5 native/device scaffolding added on 2026-07-04:

- `expo-camera` dependency, config plugin, Android camera/notification
  permissions, and `runtimeVersion.policy=fingerprint`.
- Live shelf barcode scanner with checksum validation, duplicate suppression,
  and Phase 4 catalog lookup.
- Ingredient label capture path using a real camera still plus editable
  user-confirmed text; native OCR remains off until ML Kit/Vision is reviewed
  and device-tested.
- Guided progress photo capture with front camera stills, review screen, and
  encrypted app-private `.onskinphoto` storage using SecureStore-held keys.
- Encrypted-aware timeline/detail/compare rendering and local encrypted-file
  cleanup on deletion.
- `scripts/phase5/*`, `docs/phase-5/*`, and generated device QA packet support.

Still blocked: EAS iOS/Android build IDs, physical-device matrix, native OCR
module/signoff if claimed, real face/pose detector if precise framing claims are
used, notification device QA, RevenueCat native smoke, and native Sentry smoke.

Current priority stack:

1. Brand/legal decision: do not launch as `OnSkin` unless counsel clears it.
2. Supabase live backend and RLS verification.
3. Clinical/legal review for guidance, policies, claims, and consents.
4. Product/ingredient catalog source review, real import, and curated beta-driven seed.
5. Native camera/barcode/OCR/photo capture and notification device QA.
6. RevenueCat purchase/restore/webhook integration.
7. Closed beta proving activation, retention, and willingness to pay.

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
  (a "completion day"; recovery nights count; **auto-freezes** absorb ≤2 _interior_
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
  the manage win-back link. Lows fixed: webhook `will_renew` for NON*RENEWING/BILLING*
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
  a _subscription_ business. The research also surfaced a **blocking unknown** (ShopMy's
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
  - honest empty state, dev-only demo), `stacks.ts` (expert/derm stacks, **B-DERM-REVIEW
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
  0.81); **Monk > Fitzpatrick** (Nature npj 2025 + Google, who _forbid_ training on
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
- **Historical gates:** typecheck ✅ · lint ✅ · test ✅ (817 at this slice; current
  full-suite verification is 986 tests as of 2026-07-04).

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
  (separate, default-OFF — the question is a health disclosure _transmitted_ to the cloud,
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
  - **B-SHOPMY** + **B-CATALOG-SEED**.
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
  - `ageGateStore.ts` (stores only the pass flag, **never the DOB**). Placed before any data
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

### docs/07 — reminders / streaks / widgets ✅ CLEAN (2026-06-25)

Feature-fidelity re-audit against docs/07. Verdict: faithful and complete — **no unblocked gap**.
Migration 0019 matches §7 (additive `notification_preferences` toggles + quiet hours + `lockscreen_discreet`;
append-only `streak_freezes`; content-free `notification_log`; owner RLS). The pure `notifications/policy.ts`
implements the 3 tiers (utility/behavioural/promotional), correct per-tier weekly caps (∞/3/1), per-kind
toggle gating, overnight-aware quiet hours, and `canSend` (quiet hours suppress all, caps suppress
non-utility) — tested (13). The calm forgiving streak (`streak/streak.ts`, verified in the docs/03 pass)
implements recovery-nights-count + auto-freeze window + weekly adherence + heat-map + non-decreasing best.
Local-first delivery (`deliver.ts`), soft-ask priming, settings/timing/welcome-back surfaces present;
claim-safe copy guard. Blocked (correct): native WidgetKit/Glance widgets + interactive check-off + Live
Activity (B-WIDGETS; previews built), on-device delivery + Android-14 exact-alarm verification
(B-NOTIF-VERIFY), APNs/FCM push win-backs + PostHog (keys). **Gates:** typecheck ✅ · lint ✅ · 939 tests ✅.

### docs/08 — subscriptions / paywall (RevenueCat) ✅ CLEAN (2026-06-25)

Feature-fidelity re-audit against docs/08. Verdict: faithful and complete — **no unblocked gap**.
Migration 0020 matches §8 (additive `entitlements` columns store/period_type/will_renew/attribution;
RLS unchanged, service-role writes incl. the app-granted reverse trial). The pure `entitlement.ts`
`deriveState` **gates on `is_active` regardless of source** (store/carded-trial/reverse-trial all → isPro),
distinguishes reverse-trial via `period_type`, and on lapse falls to free with an `expired` flag for
honest never-data-deleting downgrade/win-back (priorPeriodType picks re-offer vs graceful-downgrade).
The event-type-correct idempotent webhook (verified in docs/01), the 3.1.2-compliant onboarding paywall
(no trial toggle, billed amount conspicuous, Terms/Privacy/Restore via `ComplianceRow`, trust block below),
offline-safe `ProGate`/`useEntitlement`, the plan catalog, and all 9 surfaces (offer/reverse-trial banner/
reoffer/upsell/success/manage/downgrade/winback) are present; claim-safety guard asserts the honest
disclosures (91 tests). §11 go-to-market is acquisition strategy (the `acquisition_channel` field exists for
LTV-by-channel), not app code. Blocked (correct): native RevenueCat SDK + purchase/restore + localized
prices + server reverse-trial grant (B-REVENUECAT), store/ARL/external-link/final-policy legal review
(B-LEGAL/B-PRIVACY-COPY), server entitlement mirror (B-SUPABASE). **Gates:** typecheck ✅ · lint ✅ · 939 ✅.

### docs/09 — personalized recommendations (independent advisor) ✅ CLEAN (2026-06-25)

Feature-fidelity re-audit against docs/09. Verdict: faithful and complete — **no unblocked gap**.
Migration 0021 is exemplary on **church and state**: NO commission/affiliate/partnership column anywhere,
the only catalog ref is a merit datum, owner RLS; recommendation_preferences (values/budget/format) +
the recommendations cache (trigger/type/fit_rationale mandatory). `fit.ts` FIT score = six **merit-only**
inputs (profile/evidence/need-priority/simplicity/preference/catalog-quality, weights sum 1.0) with NO
commercial parameter; hard safety exclusions (pregnancy/conflict/preference/refuted) run first (excluded,
never down-ranked); §5 priority ladder; skinimalism penalty. `engine.ts` implements the 6 honest triggers

- "you're set" over the gated catalog (`shippableRules`/`shippableRecTypes` B-DERM-REVIEW launch gate);
  what/why/how + evidence grade + caveats mandatory; the ranking path imports no commerce module (verified).
  Claim-safety guard (216 tests). Blocked (correct): commerce/affiliate path (doc 10 / B-PRIVACY data-sharing
  / B-SHOPMY), specific-product recs thin → type-first until B-CATALOG-SEED, goal-active clinical sign-off
  (B-DERM-REVIEW), server persistence (B-SUPABASE). **Gates:** typecheck ✅ · lint ✅ · 939 tests ✅.

### docs/10 — creator stacks + ShopMy (commerce layer) ✅ CLEAN (2026-06-25)

Feature-fidelity re-audit against docs/10 (build spec). Verdict: faithful and complete — **no unblocked
gap**. Migration 0022 enforces church-and-state at the row level: `order_attributions` (holding
`commission_cents`) has **intentionally NO client policies → service-role-only**; `affiliate_links` exposes
no commission column (only the disclosed price + `is_paid`); `commerce_click_events` is owner-RLS with **no
health column** + opaque token; catalog stacks world-readable/service-role-write. `attribution.ts` builds
an opaque outbound URL with a tested FORBIDDEN list (concern/goal/skin/pregnancy/photo/profile never reach a
retailer); rail-agnostic `resolveWhereToBuy` is source-tagged (B-SHOPMY hedge). The strict MHMDA default
(no `data_sharing` consent → no paid links shown), `shippableStacks` (B-DERM-REVIEW) gate, the transparency
page, and the FTC guard ("paid link" enforced, no "affiliate link", no dark patterns; commerce.test 11 +
attribution.test 9 + claimsafety) are all present; order-report-poll Edge Function stubbed. Blocked
(correct): live ShopMy house-account + Order-Report poll (B-SHOPMY), real catalog/retailers/prices
(B-CATALOG-SEED), final consent copy/DPIA/FTC wording (B-PRIVACY/B-PRIVACY-COPY), derm stack sign-off
(B-DERM-REVIEW), Play external-link confirmation (B-LEGAL). **Gates:** typecheck ✅ · lint ✅ · 939 tests ✅.

### docs/11 — community layer ("Skin Notes") ✅ CLEAN (2026-06-25)

Feature-fidelity re-audit against docs/11. Verdict: faithful and complete — **no unblocked gap**. The
expert-anchored, anonymous, claim-safe myth-vs-evidence trust layer (NOT an open feed) is built to the
architecture-level guarantees. Migration 0023 (7 tables) is **PHOTO-FREE** (explicit "NO image/photo/
storage_path/local_uri column anywhere", D-064 — verified by grep), has **no likes/followers/leaderboard/DM
columns**, is **anon-locked-out** (restrictive `community_questions_block_anon`), adds the
`community_participation` consent to the enum with a `current_community_consent()` helper gating inserts +
the 16+ gate, moderated reads (`select_published`/`select_approved`), and the Apple-1.2/Play UGC floor
(reports + blocks + moderation_events). The expert corpus is B-DERM-REVIEW-gated (`shippableNotes`); the
claim-safety pre-moderation flag + the 5 surfaces (hub/card/in-context/Ask/people-like-you) are present.
Validated as a retention **multiplier, not a 7-figure pillar**; Phase 1 (expert read-mostly) live, peer
posting consent+moderation-gated. Blocked (correct): peer moderation/legal store floor + posting
(B-COMMUNITY-MOD/B-COMMUNITY-LEGAL/B-EXPERT-NETWORK), expert clinical sign-off (B-DERM-REVIEW), consent
copy + DPIA (B-PRIVACY/B-PRIVACY-COPY), server persistence (B-SUPABASE). **Gates:** typecheck ✅ · lint ✅ · 939 ✅.

### docs/12 — AI trend analysis ("Changes in your own photos") ✅ CLEAN (2026-06-25)

Feature-fidelity re-audit against docs/12. Verdict: faithful and complete — **no unblocked gap**. The
population skin score is **killed**; the no-AI-score refusal is preserved + marketed; the only-defensible
narrow exception is built. Migration 0024 has **NO score/grade/percentage/skin_age column** (D-068/D-070,
"by construction" — verified) and **no image/storage/faceprint column** (source stays local_only); the
**separate default-off `photo_trend_insights` consent** is added (installed base re-consented, D-072), owner
RLS + deletion-on-revocation; `narrative_key` is descriptive (no number/grade). `trend.ts` implements the
**fairness-adjusted MDC floor** (`toneAdjustedMdc`: equal-or-higher noise threshold for darker Monk tones,
monotonic, unknown→conservative — redness never the metric, physics not tunable), insufficient-data/lighting
gates, and a no-number `changeState`. Classical CV (not an LLM, never marketed as "AI"), claim-safety guard
(D-070: no number/score/disease/superiority/AI; 50 fixtures). Validated as **not a 7-figure pillar**. Blocked
(correct): real on-device CV engine (B-AI-ONDEVICE), skin-tone fairness cohort validation (B-AI-FAIRNESS),
FDA/FTC/EU legal sign-off + DPIA (B-AI-LEGAL). **Gates:** typecheck ✅ · lint ✅ · 939 tests ✅.

### docs/13 — "Ask OnSkin" assistant ✅ CLEAN (2026-06-25)

Feature-fidelity re-audit against docs/13. Verdict: faithful and complete — **no unblocked gap**. The
deterministic, on-device, $0, **template-bounded** conversational front-end (NOT an open chatbot) is built
to spec. Migration 0025: `ask_onskin` default-off consent #9; `ask_sessions`/`ask_turn_audit` are
**content-free** (NO message_text/transcript column "by construction"); `ask_safety_audit` is the only
health-content store, exists **only with ask_onskin consent** (excluded from training/backup/sale,
deletion-on-revocation); **NO commission/affiliate/photo/score column** in any Ask path (church-and-state +
doc-12 no-score). `answer.ts` is template-bounded (D-057 — every substantive claim filled from
`detectConflicts`/`recommend`/`generatePlan`, model never free-generates a health claim), with the
deterministic medical-first intent router (`intent.ts`), the broadened runtime claim-safety guard
(`guard.ts`), **verbal-only escalation (no misrouted CTA)** and **safety conflicts that ALWAYS escalate,
never "you're set"** (D-077); product-fit uses catalog-backed recs (D-078). The 5 surfaces + Today/You entry
are present; adversarially reviewed (18→17 fixed). Validated as a 7-figure **contributor, not king-maker**.
Blocked (correct): the whole cloud-grounded language layer (B-AI-ASSISTANT-VENDOR/SAFETY/LEGAL), seeded
corpus (B-CATALOG-SEED/B-DERM-REVIEW), in-app derm finder (B-DERM-REVIEW), server persistence (B-SUPABASE),
final consent copy (B-PRIVACY-COPY). **Gates:** typecheck ✅ · lint ✅ · 939 tests ✅.

### docs/14 — growth to seven figures (GTM playbook) ✅ (2026-06-25) — flagship artifact BUILT

docs/14 is the go-to-market **strategy** doc, not a feature spec — most of it (the paid-UA math, ASO,
organic short-form, credentialed-creator seeding, the quiz→paywall funnel) is founder/marketing execution,
and the funnel it relies on is already built. It names **one concrete app artifact** as "the single most
important thing to build" and "the growth engine": the shareable **Shelf Conflict Card** (§3). That was the
one open docs/14 implementation gap, and it is now **built**:

- **`features/growth/`** — `ConflictCard.tsx` (a fixed-size, branded, watermarked, claim-safe card rendered
  from a `DetectedConflict` via the engine's guard-scanned presentation helpers, so it can never assert a
  claim the engine didn't), `shareCard.ts` (one-tap PNG export via **react-native-view-shot** `captureRef`
  → `expo-sharing`), `cardCopy.ts` (claim-safe brand/CTA copy) + `cardCopy.test.ts` (4 tests: no drug verbs,
  no disease names, no urgency/FOMO, carries the not-medical-advice footnote + watermark).
- **`app/share/conflict/[ruleId].tsx`** — the share screen (renders the card + "Share to Stories"), reached
  from a "Share this card" affordance on the conflict-detail sheet (gated OFF for safety contraindications —
  a clinician matter, never a growth share).
- Installed `react-native-view-shot` 5.1.0 (Expo-pinned); the `onskin://` deep-link scheme already existed.
  Blocked/launch items (correct): the live universal / App-Store **smart link** with a web fallback for
  not-yet-users needs the marketing domain + store listing (**B-GROWTH-LINK**); `captureRef` needs a **custom
  dev build** to run natively (the card renders everywhere; the export is dev-build-only, like B-CAMERA); the
  secondary **referral program** is deferred by design (docs/14 §"artifact first, referral second"); PostHog
  share-funnel events via the shim (**B-POSTHOG**). **Gates:** typecheck ✅ · lint ✅ · **943 tests ✅** (4 new).

### Design-fidelity + deep-verification + 7-figure validation pass (2026-06-25)

A multi-agent workflow (3 design specs + 3 deep functional verifications + 4 web-research briefs +
synthesis) drove this pass. The 3 Claude Design `.dc.html` mockups (Smart Shelf, Ingredient Intelligence,
Routine Builder) were imported from the local dx13 handoff bundle (the design MCP can't auth headlessly)
and implemented to pixel-perfect fidelity.

**7-figure validation verdict (synthesised, adversarially stress-tested): CONDITIONAL YES.** The three core
features are commodities in their headline form (free analyzers/builders exist; ChatGPT erodes the
personalize-my-routine verb), so as a parity headline they land at the ~$8.3K MRR median, ~10x short. They
ARE king-making only in their _compounding-data_ reconfiguration: resolution-first evidence-graded
intelligence (never a hazard score), the routine builder demoted to a **calm forgiving daily adherence loop**
(the real moat, Lally 2010 + Duolingo grace), and the shelf as the **system of record** with switching-cost
lock-in + the highest-intent affiliate trigger — plus an organic share artifact (the Conflict Card) to close
the distribution gap. OnSkin's architecture already implements most of the best-execution plan. Yuka ($7.17M
subs, zero marketing) proves the ceiling but is survivorship, not a blueprint. Full verdict + 10 best-execution
recs + 8 risks in the workflow output.

**Critical functional fixes (the deep verification found dead wiring my first audit missed):**

- **Today daily loop wired end-to-end** (was local `useState` that never persisted → activation never fired,
  streak/heat-map permanently empty). New local-first `completionsStore` (D-029 pattern); today.tsx persists +
  fires the activation metric; useProgress unions it so the forgiving streak + heat-map populate. This is the
  research verdict's #1 lever.
- **Concentration band re-enabled** (`EngineProduct.concentration` was never populated → the "0.3% != 1.0%"
  promise was inert AND the high-dose-salicylic×pregnancy SAFETY rule could never fire). New tested
  `deriveConcentration` threaded through useShelf + usePlan + generate.
- Override now clears the "paired" badge; shelf sort orders by actual expiry date within each bucket.

**Design fidelity (3 commits):** new `StripedThumb` no-SVG diagonal-hatch placeholder + tokens (mutedFaint,
paperWarm, sageMuted); Smart Shelf per-screen deltas; the synergy badge + family-level conflict titles + the
3-branch conflict sheet incl. a **dark night-mode safety sheet**; the `titleLg` header variant + geometric
checkmark + per-screen radii/copy across the routine builder. All claim-safe, em-dash-free, 947 tests green.

**Functional follow-ups — progress:**

- Smart Shelf: ✅ cold-load skeleton (commit 4e69e9d); ✅ proactive "Replace ->" affordance on countdown/
  expired cards (4e69e9d); ✅ `added_via='onboarding'` seed path now live (inline quick-add, commit 99d7fee).
  Scan lookup outcomes now write the best-effort `shelf_scans` row when Supabase/auth are available and
  track the documented scan funnel with privacy-safe metadata only. Still open: authenticated Open Beauty
  Facts contribution-back POST/job and native camera barcode decode need live-source/device QA.
- Routine Builder: ✅ ramp/tolerance now persist (local-first rampStore + useRamp; the offer gates on
  shouldOfferStepUp; tolerance persists applyTolerance, commit 99d7fee). Adaptation/reorder hardcoded-data
  follow-ups were closed in the 2026-07-06 generated-plan surface pass.
- Ingredient Intelligence: ✅ paired/alternate-night placement overclaims fixed. Shelf card "paired" now requires
  scheduler-resolved conflict keys instead of inferring placement from `alternate_nights`; shelf/banner/detail copy
  uses advice language until a real cycle exists; the E2E pass caught and fixed a remaining conflict-detail
  `Already in your plan` override; dead `intelligence/scheduler.ts` exports were pruned and the stale rules.ts
  "DB-cached rules" comment was corrected. Evidence:
  `test-results/human-e2e/2026-07-06/shelf-conflict-paired-copy/`.

### Deep-verification remediation pass — docs 01, 05-13 + 06 (2026-06-26)

Drove the full deep-verification reports (one per doc) to ground: fixed every genuine, non-blocked
functional gap they surfaced, one commit per doc, each gated (typecheck + lint + vitest + em-dash sweep)
and pushed. Key-, native-, clinical-, and vendor-blocked items were left as honest deferrals with markers.

- **docs/01 (07e5610):** `data-export` Edge Fn was service-role with no user filter (returned ALL users'
  data) → now reads every table through a caller-JWT client so RLS owner-scopes it. Health-data consent
  withdrawal (promised in copy, no mechanism) → real `withdrawHealthDataConsent` control. Orphaned
  server-completion hooks deleted; offline queue documented as the deferred sync target. `persistSkinProfile`
  made local-first so a failed server write never re-onboards a returning user.
- **docs/05 (7a88ec2):** ramp `freqByProductId` now populated from the live merged ramp into orchestrate
  (was dead-read → every active defaulted to the cap); pause/travel now drops the potent active (`!paused`
  guard); cycle PostHog events wired; "add it now anyway" staging override made real. +2 tests.
- **docs/07 (3481a46):** the entire behavioural/promotional notification tier had zero callers → wired a
  weekly capture nudge + a `BehaviouralTriggers` component (replenishment/ramp/win-back on app-background),
  with a local-first sent-log so the per-tier cap holds offline. Milestones detected + surfaced (+6 tests);
  48h backfill cap on completions; freeze-ledger deferral documented.
- **docs/08 (366f0fe):** the "2 days before trial ends" reminder (promised on 4 screens, never scheduled)
  → `scheduleTrialReminder` on startTrial + re-created in rescheduleReminders. Purchase-stub now signals
  `stub:true` so the grant can't bypass on a real cancellation. Win-back success copy branched off the trial
  framing (no false "14-day trial").
- **docs/09 (faef471):** "you're set" no longer claims goal coverage in production where goal recs are gated
  (+2 honesty tests); accept→add-to-shelf carries the rec category; dead `finished` channel removed; values
  copy softened to "prioritise" (type-first engine doesn't hard-exclude yet); SPF gap-prompt dismissal persists.
- **docs/10-13 (c1c3100):** replenish "see similar" routed through the commerce gate; You-tab where-to-buy
  row made a real revocable toggle + both data-sharing toggles read the resolved (ledger-else-local) consent;
  community hard 16+ age gate made a real ticked control (was decorative); "This helped" reaction persists;
  trend gate counts the front series (not all angles); no-score screen swaps invite→manage once opted in;
  Ask leads proactively on first open with a deterministic shelf answer; dormant grounded-turn cap marked.
- **docs/06 (f74ca21):** the complete-but-unwired guided-capture quality engine is now driven into the
  capture chrome over a mock signal, and saved photos carry engine-computed varied scores (was two frozen
  constants that silently defeated the review "darker than usual" note); timeline thumbnails render
  `localUri`; milestones render inline at each crossing photo; skin-prep + cloud-tradeoff copy surfaced;
  dead `reminders.ts` deleted.

Deferred-by-design (flagged, not fixed): the free-tier "one conflict check" cap (gating harm-relevant safety
conflicts behind Pro is wrong for a safety app; needs a product decision), the PM-reminder per-night content
(needs a daily content refresh, B-NOTIF-VERIFY), and "People like you" (Phase-2 scaffold, B-COMMUNITY-MOD).
**Gates across all 7 commits: typecheck + lint + 960 tests green, em-dash-free, pushed to origin/main.**

### Mobile route-escape touch targets (2026-07-06)

Fixed undersized icon-only Back/Dismiss controls on direct-entry trust surfaces across recommendations,
commerce, community, and trend routes by moving them to a shared 44 pt `RouteIconButton`. The commerce
consent bottom sheet is now viewport-capped and scrollable so Dismiss stays reachable on 320 px wide short
phones. Flow-tree expectations now explicitly require phone-sized route escapes for these branches, with
focused route-contract coverage guarding against regressing to 28 px or 36 px controls.

### Paywall short-phone reachability (2026-07-06)

Fixed subscription lifecycle and contextual paywall surfaces for short iOS/Android phones: re-offer,
downgrade, win-back, and Pro-gate bodies now scroll above fixed actions, secondary exits are at least
44 px tall, the contextual upsell sheet is viewport-capped and scrollable, and Terms/Privacy/Restore
links use explicit 44 x 44 native hit targets. The upsell scrim is hidden from accessibility when the
visible 44 px "Maybe later" exit is present, avoiding a tiny accessible dismiss target on 320 px screens.

### Progress photo route exits (2026-07-06)

Fixed undersized Progress photo exits across photo detail, capture, review, and no-score routes by moving
Back/Close controls to the shared 44 pt `RouteIconButton`. Capture consent, permission, and camera-recovery
overlays now scroll on short phones and their Not now exits are 44 px tall, so a user can always back out of
camera or privacy gates on small iOS and Android devices.

### Shared toggle and You tab touch targets (2026-07-06)

Replaced native/local switch variants with a shared `ToggleSwitch` that keeps a 52 x 48 phone target,
explicit `role="switch"` state, labels, disabled handling, and the same slim visual track. Applied it to
settings notifications, You privacy/security controls, Trend opt-in, Ask consent, and Widgets Live Activity
surfaces. Also converted You tab navigation and policy chevrons from tiny text buttons into whole-row 56 px
actions with a 44 x 44 chevron area. Expo web evidence at 320 x 568 found zero switch or button geometry
failures in `test-results/human-e2e/2026-07-06/shared-toggle-switch-mobile/`.

### Onboarding chip touch targets (2026-07-06)

Fixed shared onboarding and filter chips so `Chip` and `SegmentChip` keep a 48 px minimum touch height on
phone layouts, with source-contract tests guarding against regression to 40 px targets. The onboarding
product remove control is now a 48 x 48 button instead of a tiny glyph-only press area. Expo web evidence
at a confirmed 320 px CSS viewport found zero chip/remove geometry failures in
`test-results/human-e2e/2026-07-06/onboarding-chip-touch-targets/`.

### Recommendations teaser touch targets (2026-07-06)

Fixed the Today SPF recommendation prompt so the close, See why, and Not now actions render as visible
48 px phone targets instead of relying on tiny glyph/text hit-slop areas. Added a dev-only Today
`?routine=AM|PM` preview hook so AM and PM surfaces can be verified on demand without changing production
clock behavior. Expo web evidence at a confirmed 320 px CSS viewport found zero teaser target geometry
failures in `test-results/human-e2e/2026-07-06/recommendations-teaser-touch-targets/`.

### Commerce paid-link touch targets (2026-07-06)

Fixed where-to-buy and stack paid-link surfaces for small iOS/Android phones: retailer rows now give product
copy enough width, paid-link chips no longer squeeze names, disclosure/how-it-works controls are visible
48 px targets, and the shelf fallback is a real 48 px button. The You-tab commerce sharing toggle now remains
local-first when the consent ledger/backend is unavailable, so the real opt-in path works before Supabase is
configured. Expo web evidence at a confirmed 320 px CSS viewport found zero paid-link/control geometry
failures in `test-results/human-e2e/2026-07-06/commerce-touch-targets/`.

### Floating tab bar polish (2026-07-06)

Reworked the bottom tab bar from a tiny active dot to a floating OnSkin-style raised-paper capsule with
compact geometric line icons, readable 12 px labels, a clay-tinted active state, and tab-scene bottom
clearance so content does not sit under the pill. The four existing destinations remain unchanged.
Expo web evidence at a confirmed 320 px CSS viewport found one active tab, no horizontal overflow, and four
tab targets above 44 pt in
`test-results/human-e2e/2026-07-06/wealthsimple-style-tabbar/`.

### Settings export feedback (2026-07-06)

Patched the You-tab data export path so placeholder/offline Supabase configuration fails fast instead of
leaving the user with no visible result. The screen now keeps native alerts and also renders inline
`accessibilityRole="alert"` feedback under the export controls for unavailable/failing exports. Expo web
evidence at a confirmed 320 px CSS viewport verified You/settings route geometry, direct-entry Back recovery,
bottom-scroll policy/data controls, and the visible export failure message in
`test-results/human-e2e/2026-07-06/settings/`.

### Navbar label legibility (2026-07-06)

Patched the floating tab bar labels so Today, Progress, Shelf, and You no longer depend on the navigator's
tight default label box or faint inactive tint. Labels now render through an explicit one-line `Text` control
inside a 20 px label frame with protected shrink behavior, no Android font padding, 12 px text, 16 px
line-height, and stronger `inkSoft` inactive contrast inside the 90 px floating capsule. Expo web evidence at
a stress phone viewport verified all four labels visible with no tab-boundary clipping in
`test-results/human-e2e/2026-07-06/navbar-labels/final-navbar-320.png`.

### Navbar label visibility follow-up (2026-07-06)

Expanded the floating tab bar item and label geometry so tab text no longer sits inside a fragile 18-20 px
band. Each tab now owns one quarter of the capsule, labels render in a 24 px frame with 13 px text and 18 px
line-height, and targets remain at least 68 x 62 px on 320 px and 390 px phone viewports. Expo web evidence
verified tab switching, zero horizontal overflow, no clipped labels, and zero console errors in
`test-results/human-e2e/2026-07-06/navbar-label-visibility/`.

### Floating tab label slot correction (2026-07-06)

Moved the floating tab labels back into the navigator label slot after finding that text inside `tabBarIcon`
creates duplicate hidden/visible icon render layers. The final tab bar keeps the raised-paper floating capsule,
uses darker inactive labels, safe-area-aware bottom offset, 72 px tab targets, and a 26 px one-line label frame.
Expo web evidence at 320 x 844 and 320 x 568 verified one DOM label per tab, visible unclipped labels, zero
horizontal overflow, and zero console errors in
`test-results/human-e2e/2026-07-06/nav-tabbar-320/`.

### Settings timing row wrap (2026-07-06)

Fixed the remaining 320 px route-sweep overflow on `/settings/timing` by allowing the quiet-hours label and
time-pill group to wrap instead of forcing one row. The timing screen now shows `Nothing fires` above the
10:00 PM to 7:00 AM controls on narrow phones, with zero horizontal overflow, zero clipped text, and zero
undersized controls in `test-results/human-e2e/2026-07-06/nav-tabbar-320/settings-timing-final.png`.

### Shelf replace and opened-date touch targets (2026-07-06)

Fixed the Shelf card Replace nudge so it is a visible 96 x 44 clay-tint pill instead of a tiny text link with
`hitSlop`. The product-card tap target and Replace target are now sibling buttons, removing the invalid nested-button
browser warning while preserving direct replenishment. Also raised opened-date and PAO choice chips from 40-42 px to
44 px minimum targets on 320 px phones. Expo web evidence verified the Replace pill, zero nested-button console
errors, no horizontal overflow, and zero opened-date/PAO chip geometry failures in
`test-results/human-e2e/2026-07-06/shelf-touch-targets/`.

### Cycle week scheduler note semantics (2026-07-06)

Fixed `/cycle/week` scheduler notes so informational safety/fallback notes render as readable text cards instead of
inert `button` controls. Phased-introduction notes are now the only tappable note CTA, with a visible 44 pt target
and explicit "Review phased introduction" accessibility label. Safety notes are also rendered in the no-cycle branch,
matching the scheduler contract that notes survive when no cycle forms, such as pregnancy retinoid suppression.
Expo web evidence used the app-native onboarding "Explore first" reverse-trial path to unlock Pro locally, then
verified locked and unlocked `/cycle/week` at a 320 px viewport with no console errors in
`test-results/human-e2e/2026-07-06/cycle-week-notes/`.

### Cycle week selected-night projection (2026-07-06)

Fixed the cycle week projection so “This week, by night” renders the full seven-night window from the scheduler
spec instead of only five rows. Projected night rows now route to `/cycle/why-tonight?date=...`, and the explainer
reads that date so future rows show “WHY THIS NIGHT?” with selected-weekday trace copy instead of behaving like
inert haptic-only buttons. Expo web evidence used the app-native no-card Pro week plus manual retinol shelf intake
and verified seven visible night-row buttons, a future-row tap to `?date=2026-07-07`, Tuesday-specific explainer
copy, no horizontal overflow, and zero browser console errors in
`test-results/human-e2e/2026-07-06/cycle-week-selected-night/`.

### Cycle week wrapped night labels (2026-07-06)

Fixed the seven-night week view so row labels use the projected cycle-night index instead of the calendar row index.
A classic four-night cycle now wraps visibly as `N1`, `N2`, `N3`, `N4`, `N1`, `N2`, `N3` instead of showing impossible
`N5`/`N6`/`N7` labels. The same wrapped value is included in row accessibility labels as “cycle night X of 4,” keeping
screen-reader output aligned with the visible schedule. Expo web evidence at a phone viewport verified the wrapped
labels, no horizontal overflow, and zero browser console errors in
`test-results/human-e2e/2026-07-06/cycle-week-cycle-labels/`.

### Cycle repeated-active recovery spacing (2026-07-06)

Fixed the scheduler's repeated potent-active spacing so a retinoid-only or exfoliant-only cycle no longer stacks
the same product/slot on consecutive nights in the classic variant. The orchestration loop now inserts a recovery
night between repeated products or repeated potent slots while preserving the valid classic acid-to-retinoid sequence
for different slots. Expo web evidence used the app-native reverse-trial plus manual retinol shelf flow and verified
`Retinoid -> Recover -> Retinoid -> Recover -> Recover`, zero horizontal overflow, and zero console errors in
`test-results/human-e2e/2026-07-06/cycle-week-repeat-active-spacing/`.

### Contextual paywall touch target buffer (2026-07-06)

Fixed the Progress contextual paywall's borderline small-phone targets. The shared paywall dismiss control and
Terms/Privacy/Restore compliance row now render with a 48 px floor instead of relying on nominal 44 px sizing that
landed at 43.99 px in Expo web geometry. Human-simulated E2E at 320 px and 390 px verified `Maybe later`,
`Start free trial`, `Terms`, `Privacy`, `Restore`, and the floating tabs all exceed 44 px, with zero horizontal
overflow and zero browser console errors in
`test-results/human-e2e/2026-07-06/navigation-small-phone-tabbar/`.

### Paywall lifecycle decline target buffer (2026-07-06)

Fixed the same nominal-44 px rendering problem on lifecycle paywall secondary exits. `/paywall/reoffer`,
`/paywall/downgrade`, and `/paywall/winback` previously rendered their respectful "no" controls at 43.99 px on a
320 px short phone; the contextual upsell `Maybe later` exit also still used exact 44 px sizing. All four now use a
48 px floor, and the paywall mobile contract rejects exact `h-[44px]` exits. Human-simulated E2E at 320 x 568
verified zero small paywall targets, zero horizontal overflow, and zero console errors in
`test-results/human-e2e/2026-07-06/paywall-lifecycle-decline-targets/`.

### Navbar text rendering hardening (2026-07-06)

Replaced the remaining fragile bottom-tab label-slot path with a custom `FloatingTabBar` so Today, Progress,
Shelf, and You render as direct text inside one controlled 72 px tab item each. The bar keeps the Wealthsimple-style
floating raised capsule, explicit selected-tab semantics, safe-area positioning, and keyboard-hide behavior without
depending on the navigator's nested label wrappers. Human-simulated E2E at 320 x 568 and 390 x 844 verified no
clipped labels, no undersized tab targets, zero horizontal overflow, and clean tab switching evidence in
`test-results/human-e2e/2026-07-06/navbar-text-rendering/`.

### Commerce consent decline target buffer (2026-07-06)

Fixed the exact-44 px secondary decline action on `/commerce/consent` after Expo web rendered `Not now` at
43.99 px high on a 320 x 568 phone viewport. The action now uses a 48 px height buffer, the route contract test
guards against returning to the fragile 44 px class, and human-simulated E2E with local commerce flags verified no
small targets, no clipped controls, and zero horizontal overflow in
`test-results/human-e2e/2026-07-06/commerce-consent-decline-target/`.

### Community ask consent footer hardening (2026-07-06)

Fixed `/community/ask` posting consent on a 320 x 568 phone viewport after the 16+ checkbox and `Not now` decline
exit both rendered 43.99 px high and the decline exit started below the viewport. The consent explanation now scrolls
above a stable bottom action area, the checkbox has a 48 px floor, `Not now` is 48 px high, and route contracts reject
the exact 44 px decline class. Human-simulated E2E verified no small targets, no clipped controls, and zero horizontal
overflow in `test-results/human-e2e/2026-07-06/community-ask-consent-decline-target/`.

### Routine reorder nudge target buffer (2026-07-06)

Fixed `/routine/reorder` after the paid routine edit screen rendered `Done`, `Save`, `Fix the order`, and `Keep mine`
at 43.99 px high on a 320 x 568 phone viewport. Text exits now use a 48 px floor, the sequencing nudge actions are
48 px tall, and route contracts reject returning the nudge buttons to exact 44 px. Human-simulated E2E used the app's
local no-card reverse-trial fixture to reach the Pro route, verified no small targets or clipped controls, and tapped
`Keep mine` to confirm the nudge still dismisses in
`test-results/human-e2e/2026-07-06/routine-reorder-nudge-targets/`.

### Shelf detail action target hardening (2026-07-06)

Fixed `/shelf/[id]` product detail after a 320 x 568 phone E2E pass showed the `More options` menu rendering 43.99 px
and the inline `Report an issue`, opened-date edit, and best-before edit controls rendering as text-sized targets.
The overflow menu now uses a 48 px physical target, report/opened/best-before actions use full-height touch areas, and
opened-date / best-before edit chips render with a 48 px floor. The shelf route contract now rejects the old exact-44
and text-sized classes. Human-simulated E2E verified the manual-add-to-detail flow, scrolled freshness rows, expanded
editors, Back recovery, no horizontal overflow, and post-fix target geometry in
`test-results/human-e2e/2026-07-06/shelf-detail-action-targets/`.

### Progress capture consent exit hardening (2026-07-06)

Fixed `/progress/capture` after a 320 x 568 phone E2E pass showed the consent gate's `Not now` exit rendering at
43.99 px high and below the visible viewport. The capture consent overlay now switches to compact short-phone spacing,
the three capture gate exits use a 48 px floor, and the progress route contract rejects returning those exits to exact
44 px sizing. Human-simulated E2E used the local no-card reverse-trial path to unlock the Pro route, verified the
post-fix `Not now` target is visible at 48 px with no horizontal overflow, and tapped it back to `/progress` in
`test-results/human-e2e/2026-07-06/progress-capture-not-now-targets/`.

### Recommendation stale-detail exit hardening (2026-07-06)

Fixed the stale `/recommendations/[id]` direct-entry fallback after a 320 x 568 phone E2E pass showed `Back to For you`
rendering at 43.99 px high. The fallback exit now uses a 48 px floor, the recommendation route contract rejects the old
exact-44 px class, and the preferences top bar now uses a short `Preferences` label so it does not wrap above the
screen title on narrow phones. Human-simulated E2E verified the stale-detail exit target, tapped it back to
`/recommendations`, checked zero horizontal overflow, and confirmed the preferences header/chips in
`test-results/human-e2e/2026-07-06/recommendation-preferences-chip-targets/`.

### Routine generated-plan surfaces (2026-07-06)

Closed the remaining hardcoded routine-intelligence surface issue for `/routine/adaptation` and `/routine/reorder`.
Both screens now read the generated plan through `usePlan`, clearly label the example state when the shelf is empty,
and no longer present the Azelaic/Vitamin-C demo copy as if it came from the user's own shelf. The reorder fallback is
now tap-to-select with 48 px `Earlier`/`Later` controls, keeps the sequencing nudge, and both changed screens are
scrollable on short phones. Route contracts reject the old fixed demo arrays/copy and require the generated-plan
binding. Human-simulated E2E verified the local reverse-trial Pro route, the moved-order nudge, visible 48 px actions,
no small targets, no old Azelaic copy, and final screenshots in
`test-results/human-e2e/2026-07-06/routine-generated-plan-screens/`.

### Shelf PAO provenance honesty (2026-07-06)

Fixed the opened-date PAO editor so tapping an unchanged prefilled value preserves its existing provenance instead of
turning an estimated/category-default value into `from label`. Changed values are still treated as user-read label
values. Added a pure provenance regression test and verified the manual Shelf intake branch at 320 x 568: a Cleanser
manual add prefilled `12 months` as estimated, tapping the unchanged `12 mo` chip kept the opened sheet and final
product detail on `estimated` with no `from label` copy and no visible small controls. Evidence:
`test-results/human-e2e/2026-07-06/shelf-pao-provenance/`.

### Today SPF compact prompt clearance (2026-07-06)

Fixed the compact Today route after a 320 x 568 phone E2E pass showed the missing-SPF prompt actions rendering under
the floating tab bar. Short-phone routine rows now keep instruction copy to one line, and the compact SPF prompt
renders as a concise inline banner with 48 px `See why` and dismiss targets above the tab bar. The recommendation and
Today route contracts now cover the compact banner and row-density behavior. Human-simulated E2E verified no horizontal
overflow, no mojibake, and post-fix geometry (`See why` bottom `420.8`, dismiss bottom `415.7`, tab bar top `494.9`) in
`test-results/human-e2e/2026-07-06/today-spf-compact-banner/`.

### Onboarding goals footer clearance (2026-07-06)

Fixed `/onboarding/goals` after a 320 x 568 phone E2E pass showed the fixed `Continue` footer covering the lower goal
cards in the first-run funnel. Short phones now use a compact goal-card density that remains 63.9 px high in the web
surface, fixed-footer onboarding scroll views are flex-bounded, and Goals/Products footers use an opaque paper buffer.
Route contracts cover the compact goal branch and fixed-footer structure; `OptionCard` now has a default-preserving
compact variant with its own touch-target contract. Human-simulated E2E verified the first five goals are clean above
the footer, `Barrier repair` is reachable by scrolling, selecting it enables `Continue`, and tapping `Continue` opens
`/onboarding/consent` in `test-results/human-e2e/2026-07-06/onboarding-goals-footer-clearance/`.

## Open questions for the founder

See [BLOCKERS.md](BLOCKERS.md), [LAUNCH_READINESS.md](LAUNCH_READINESS.md),
and the Phase 1 docs under `docs/`.

Highest priority:

1. Brand decision: keep `OnSkin` only with written counsel clearance; otherwise
   clear and execute the rebrand path. `RoutineKind` is the working clearance
   candidate, not a final legal conclusion.
2. Assign account owners and billing for Supabase, Apple, Google, RevenueCat,
   PostHog, Sentry, Turnstile, and domain registration.
3. Retain counsel for privacy, terms, consumer-health-data, subscription, store
   listing, photo, commerce, and AI/Ask review.
4. Retain a dermatologist and cosmetic chemist for rules, PAO defaults,
   recommendations, Skin Notes, and Ask corpus review.
5. Decide whether V1 ships with commerce, community, widgets, and trend analysis
   hidden or preview-only. Default is post-launch.
6. Recruit the 50-100 user closed beta cohort for the frozen V1 loop.
