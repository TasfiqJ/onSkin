# Build Progress

Tracks the build against docs/00 §"build order". One slice per commit.
See [DECISIONS.md](DECISIONS.md) for implementation choices and
[BLOCKERS.md](BLOCKERS.md) for everything waiting on the founder.

## 2026-07-08

- Fixed the remaining 320 x 430 personalized recommendation clipping from the
  ultra-short route sweep. The For You hub now has a sub-460 px density for
  heading/card spacing, and recommendation preferences keep value/budget chips
  at a real 48 px floor while moving texture chips below the first viewport
  for deliberate scroll access. Codex in-app browser Expo web verifies
  `/recommendations` and `/recommendations/preferences` at 320 x 430 with zero
  clipped controls, zero sub-44 controls, zero blocked center hit-tests, zero
  horizontal overflow, and a successful `Sustainable` chip tap. Evidence and
  bug report:
  `test-results/human-e2e/2026-07-08/recommendations-short-phone-430-clearance/`,
  `docs/e2e-bug-reports/2026-07-08-recommendations-ultrashort-hub-preferences-clipping.md`.

- Fixed the ultra-short 320 x 430 Progress contextual ProGate clearance. The
  shared ProGate now applies a sub-460 px density that trims only nonessential
  body spacing/copy while preserving 48 px Terms, Privacy, Restore, Maybe
  later, Start free trial, and Explore first controls. Codex in-app browser
  Expo web evidence verifies `/progress` at 320 x 430 has zero clipped
  controls, zero blocked center hit-tests, zero horizontal overflow, and zero
  unexpected warn/error logs; tapping `Explore first` unlocks the Progress
  photo surface without store checkout. Evidence and bug report:
  `test-results/human-e2e/2026-07-08/progress-progate-short-phone-430-clearance/`,
  `docs/e2e-bug-reports/2026-07-08-progress-progate-short-phone-430-clearance.md`.

- Tightened the shortest-height Shelf intake fallbacks below 460 px viewport
  height. Manual add now hides nonessential helper/PAO copy, trims field
  spacing, keeps the fixed Continue action at 52 px, and gives the category
  sheet enough ultra-short bottom padding for `Something else` to scroll fully
  into view. OCR label capture now uses a shorter camera panel and compact
  action spacing while preserving inline capture-failure recovery and editable
  manual text. Barcode no-match now has an ultra-compact density for all three
  recovery rows and explicit row accessibility labels. Codex in-app browser
  Expo web evidence at 320 x 440 verifies manual add, category selection into
  `/shelf/opened`, OCR capture failure, manual INCI continuation into
  `/shelf/manual`, and zero current-origin warn/error logs; 320 x 430 evidence
  verifies the no-match `Add it by hand` labeled fallback routes to
  `/shelf/manual`. Evidence:
  `test-results/human-e2e/2026-07-08/shelf-ultrashort-manual-ocr-current/`.

- Re-ran `npm run phase5:verify` on current `main` after the latest native
  capture route changes. Phase 5 QA packet smoke, native config check,
  generated device QA packet, root typecheck, root lint, and the full mobile
  test suite all pass non-strict verification. The generated Phase 5 packet now
  hashes the current progress capture route. Strict Phase 5 remains blocked on
  external/native evidence only: real EAS iOS and Android build IDs, physical
  iOS and Android device names/OS versions, native camera, photo,
  notification, share, RevenueCat, Sentry QA, and a real named tester signoff.

- Re-ran `npm run phase8:verify` on current `main` after the current
  growth/share-card route work. Phase 8 smoke, growth/store code gates,
  generated QA packet, root typecheck, root lint, and the full mobile test
  suite all pass non-strict verification. The generated Phase 8 packet now
  hashes the current share-card and conflict-share files. Strict Phase 8 remains
  blocked only on external founder/reviewer evidence: final brand/domain,
  production marketing/support/store URLs, DNS, Universal Links/App Links,
  share-card device QA, attribution privacy review, store packets, creator
  compliance, support response readiness, launch dashboard readiness, dry run,
  Apple Team ID, Android release certificate fingerprints, and named signoff.

- Finished the onboarding products category-sheet hardening on compact phones.
  The compact picker now uses a route-local overlay instead of nested React
  Native `Modal` semantics, reserves a 52 px outside dismiss area, exposes one
  named `Choose product category` dialog, hides background content from the
  accessibility tree while open, pads the internal chip list, and keeps keyboard
  taps handled inside the scroll view. Codex in-app browser Expo web at 320 x
  480 completed goals, consent, and quiz, typed `Barrier Screen SPF`, opened the
  category sheet, verified a single named dialog, 48 px category chips, full
  320 px sheet width, and zero horizontal overflow, selected `SPF`, confirmed
  the collapsed field exposes `Category, SPF`, added the product, and verified
  the 48 x 48 remove control. Evidence:
  `test-results/human-e2e/2026-07-08/onboarding-product-category-picker-320x480-postfix/`.

- Re-ran `npm run phase7:verify` on current `main` after the latest Today and
  Progress route work. Phase 7 smoke, core-loop code gates, generated QA
  packet, root typecheck, root lint, and the full mobile test suite all pass
  non-strict verification. The generated Phase 7 packet now hashes the current
  Today and Progress route files. Strict Phase 7 remains blocked only on
  external founder/reviewer evidence: final brand/domain and policy URLs, live
  Supabase/RLS, reviewed conflict/routine/recommendation content, source-cleared
  catalog import, physical-device QA, RevenueCat QA, privacy export/delete QA,
  beta dashboard readiness, and named signoff.

- Repaired the Phase 9 privacy payload audit so it enforces the current
  route-owned progress-photo share confirmation instead of requiring a native
  `Alert.alert`. The audit now proves the photo detail route opens explicit
  share title/body/confirm copy before export, offers Cancel and Share actions,
  and keeps native alerts out of the sensitive photo-share path. Re-ran
  `npm run phase9:privacy-payload-audit` and full `npm run phase9:verify`;
  both pass non-strict code gates, including root typecheck, root lint, and
  170 mobile test files / 1743 tests. Strict Phase 9 remains blocked on
  Tas-owned live Supabase, RevenueCat, store/build, observability, dependency,
  beta, and named-signoff evidence.

- Tightened and reverified the current Shelf manual category picker after the
  bottom-sheet safe-area/semantics hardening. Expo web in the Codex in-app
  browser at 320 x 480 fills `/shelf/manual`, opens the named
  `Choose product category` dialog, verifies the 48 px outside dismiss reserve
  with no open-state control issues, scrolls to a fully visible
  `Something else` row, selects it, confirms the collapsed field exposes
  `Category, Other`, and continues to `/shelf/opened` with zero horizontal
  overflow and zero unexpected warn/error logs. Evidence and report:
  `test-results/human-e2e/2026-07-08/shelf-manual-category-picker-320x480-postfix/`,
  `docs/e2e-bug-reports/2026-07-08-shelf-manual-category-picker-safe-area.md`.

- Re-ran the current `main` shortest-phone route sweep after the recent compact
  route fixes. Expo web at 320 x 480 checked 49 direct-entry routes across
  Today, Progress, routine, cycle, recommendations, community, commerce,
  settings, trend, Ask, Shelf, paywall, streak, and widgets. The rerun found
  zero failed routes, zero visible clipped controls, zero sub-44 user-facing
  controls, zero blocked hit-tests, zero horizontal overflow, and zero
  disallowed browser logs. Evidence:
  `test-results/human-e2e/2026-07-08/current-main-short-phone-480-rerun/`.

- Fixed the `/recommendations` For You hub and `/community` Skin Notes hub on
  shortest 320 x 480 phones. The previous compact layouts still clipped visible
  cards: the second recommendation card before its evidence and `See how` row,
  and the third Skin Note before the bottom of the note card. Both hubs now have
  sub-520 px densities for heading, card spacing, card copy, and metadata rows
  while keeping Back, Preferences, and any exposed Ask control at 48 px.
  Post-fix Expo web evidence verifies no clipped visible cards, no sub-44
  controls, zero horizontal overflow, and no dialogs. Evidence and bug reports:
  `test-results/human-e2e/2026-07-08/recommendations-short-phone-480-card-fit/`,
  `test-results/human-e2e/2026-07-08/community-short-phone-480-card-fit/`,
  `docs/e2e-bug-reports/2026-07-08-recommendations-short-phone-card-clipping.md`,
  `docs/e2e-bug-reports/2026-07-08-community-short-phone-card-clipping.md`.

- Fixed shared contextual ProGate compliance on shortest 320 x 480 phones.
  The shared paywall body could push Terms, Privacy, and Restore below direct
  routine/cycle/streak/widget routes, while the tabbed Progress paywall could
  place those controls under the floating tab bar. The sub-520 px ProGate
  treatment now moves compliance into the top row beside the 48 px `Maybe later`
  exit, hides the duplicate bottom compliance row, and trims only body
  spacing. Codex evidence checked 16 contextual ProGate routes with zero clipped
  controls, zero sub-44 controls, zero blocked center hit-tests, zero horizontal
  overflow, and zero dialogs. Evidence and bug report:
  `test-results/human-e2e/2026-07-08/progate-short-phone-480-compliance/`,
  `docs/e2e-bug-reports/2026-07-08-progate-short-phone-compliance-clipping.md`.

- Fixed the `/cycle/phased-intro` action sheet on shortest 320 x 480
  phones. The primary `Sounds good` button clipped below the viewport and the
  secondary override was pushed out of the first view. The sheet now uses a
  sub-520 px density for copy, timeline spacing, and actions while preserving
  48 px tap targets. Codex in-app browser evidence verifies `Sounds good` and
  `Add it now anyway` are both fully visible and hit-test clean, with zero
  horizontal overflow, and tapping `Sounds good` returns direct entries to
  `/today`. Evidence and bug report:
  `test-results/human-e2e/2026-07-08/cycle-phased-intro-short-phone-480/`,
  `docs/e2e-bug-reports/2026-07-08-cycle-phased-intro-short-phone-action-clipping.md`.

- Fixed the `/progress` empty first-photo CTA on shortest 320 x 480 phones.
  The compact first-run copy stack was still tall enough for the floating tab
  bar to cover the lower CTA label, leaving only about 2 px of clearance. The
  Progress empty state now trims only its compact spacing and keeps the CTA a
  52 px pill. Post-fix Codex in-app browser evidence shows `Take my first
photo` at y=315-367 with 33.6 px clearance above the floating tab bar, correct
  center hit-test, zero horizontal overflow, and a successful tap into the
  `/progress/capture` local-only consent gate. Evidence and bug report:
  `test-results/human-e2e/2026-07-08/progress-empty-short-phone-clearance/`,
  `docs/e2e-bug-reports/2026-07-08-progress-empty-short-phone-clearance.md`.

- Fixed shortest-phone bottom-action clearance for the empty Shelf and
  contextual full-routine paywall. A 320 x 480 route sweep found `/shelf`
  hiding `Add by hand` under the floating tab bar and
  `/paywall/upsell?feature=full_routine` clipping `Maybe later` below the
  viewport. The Shelf no-archive empty state now uses a sub-520 px density and
  the contextual paywall trims its short-phone sheet rhythm while preserving
  44 px+ controls. Post-fix Codex in-app browser evidence shows both Shelf
  actions hit-test correctly, `Add by hand` opens `/shelf/manual`, `Maybe later`
  is fully visible, and tapping it dismisses to `/today`. Evidence and bug
  report:
  `test-results/human-e2e/2026-07-08/shelf-paywall-short-phone-clearance/`,
  `docs/e2e-bug-reports/2026-07-08-shelf-paywall-short-phone-bottom-actions.md`.

- Hardened commerce click attribution at the app boundary. The mirrored
  click payload guard now requires the exact docs/10 shape
  (`clickToken`, `productType`, `source`, `consented`), rejects surprise
  partner identifiers, rejects raw URLs/emails/free-text values, and only
  accepts known affiliate source buckets while preserving the opaque-token
  outbound handoff. Added negative contract coverage for extra identifiers,
  malformed product types, unsafe tokens, bad source buckets, and non-boolean
  consent. This is a non-UI privacy/trust boundary change, so no human E2E was
  required. Also verified the current shortest-phone Shelf empty-state and
  contextual upsell polish at 320 x 480: Shelf keeps both empty-state actions
  visible and routes them to `/shelf/manual` and `/shelf/scan`; the reminders
  upsell keeps preview-store copy, Terms, Privacy, Restore, and `Maybe later`
  visible with 48 px+ user-facing controls and recovers to `/today`. Evidence:
  `test-results/human-e2e/2026-07-08/shelf-paywall-short-phone-clearance/`,
  `test-results/human-e2e/2026-07-08/commerce-attribution-and-short-phone-ui/`,
  and
  `docs/e2e-bug-reports/2026-07-08-shelf-paywall-short-phone-bottom-actions.md`.
  Refreshed the stale Shelf route contracts so the archived-products and
  short-phone empty-state assertions cover the current `shortPhone` path.

- Fixed commerce stack paid-link exposure before the separate where-to-buy
  consent. The stack detail route now renders locked `Consent needed` rows,
  locked accessibility labels, no external glyphs, and non-paid disclosure copy
  while commerce consent is off; the FTC `Paid link` chip/disclosure remains
  unchanged after consent. Codex in-app browser Expo web verifies the no-consent
  stack and recommendation branches at 320 x 568 with zero horizontal overflow,
  no sub-44 visible controls, locked stack item and recommendation Allow handoff
  to `/commerce/consent`, and the shelf alternative route to `/shelf/manual`.
  Evidence and bug report:
  `test-results/human-e2e/2026-07-08/commerce-no-consent-locking/`,
  `docs/e2e-bug-reports/2026-07-08-commerce-stack-paid-links-before-consent.md`.

- Fixed the `/today` empty-routine first viewport on shortest 320 x 480
  phones. The compact empty-state card now uses tighter spacing while keeping
  the `Add products` CTA at 56 px tall; post-fix Codex in-app browser evidence
  shows the CTA hit-tests correctly with 37 px clearance above the floating tab
  bar and zero horizontal overflow. Evidence and bug report:
  `test-results/human-e2e/2026-07-08/today-empty-short-phone-480-clearance/`,
  `docs/e2e-bug-reports/2026-07-08-today-empty-state-short-phone-clearance.md`.

- Fixed the `/cycle/disruption` sheet on shortest 320 x 480 phones. The fourth
  choice, `I had a facial or peel`, was clipped to a 42.6 px visible bottom
  sliver while the sheet had no useful page scroll. The route now adds a
  sub-520 px sheet density that preserves the same four choices and accessibility
  labels while reducing row padding, title/body leading, icon size, and sheet
  spacing. Codex in-app browser Expo web verifies all four choices are fully
  visible with 56 px+ hit targets, zero horizontal overflow, zero blocked
  controls, and zero sub-44 visible controls at 320 x 480; tapping the formerly
  clipped facial/peel option routes to `/cycle/procedure`. Evidence and bug
  report:
  `test-results/human-e2e/2026-07-08/cycle-disruption-short-phone-480/`,
  `docs/e2e-bug-reports/2026-07-08-cycle-disruption-short-phone-choice-clipping.md`.

- Fixed and verified the Today SPF gap prompt on compact phones. The compact
  prompt now exposes a visible `Not now` dismissal instead of an icon-only
  close affordance, and the SPF headline can wrap to two lines instead of
  ellipsizing at 320 px. Codex in-app browser Expo web at 320 x 568 used the
  real manual shelf flow to add `Gentle cleanser` and `Barrier moisturizer`,
  verified `/today?routine=AM` shows the SPF prompt with 48 px+ `See why` and
  `Not now` controls, zero horizontal overflow, `/recommendations/gap:mineral_spf`
  detail routing, dismissal, and reload persistence. Evidence and bug report:
  `test-results/human-e2e/2026-07-08/today-spf-gap-prompt-current/`,
  `docs/e2e-bug-reports/2026-07-08-today-spf-gap-prompt-compact.md`.

- Added current app-surface evidence for Recommendations direct-entry exits.
  Codex in-app browser Expo web at 320 x 568 verifies direct
  `/recommendations` Back recovery to `/you`, direct
  `/recommendations/preferences` Back recovery to `/recommendations`, and stale
  `/recommendations/stale-local-rec` `Back to For you` recovery to
  `/recommendations`. Hub Back/Preferences, preferences chips, route Back, and
  stale-detail recovery controls all measure 48 px or larger, with zero
  horizontal overflow, no sub-44 controls, no JavaScript dialog, and only
  expected local Supabase placeholder / Expo web notification warnings.
  Evidence:
  `test-results/human-e2e/2026-07-08/recommendations-direct-entry-exits-current/`.

- Fixed shortest-phone paywall compliance reachability at 320 x 480. Direct
  `/progress/capture` and `/progress/review` now receive the compact
  photo-timeline paywall treatment instead of pushing Terms, Privacy, and
  Restore below the first viewport, and compact lifecycle paywalls
  `/paywall/reoffer`, `/paywall/downgrade`, and `/paywall/winback` now render
  the shared compliance row inside the visible fixed action footer. Codex
  in-app browser E2E verifies all five routes have visible Terms, Privacy, and
  Restore controls with clean center hit-tests, no sub-44 controls, no visible
  clipped controls, zero horizontal overflow, and no dialogs. Evidence and bug
  report:
  `test-results/human-e2e/2026-07-08/short-phone-480-paywall-compliance-final/`,
  `docs/e2e-bug-reports/2026-07-08-paywall-compliance-short-phone-480.md`.

- Added current app-surface evidence for the onboarding notification soft-ask
  skip branch. Codex in-app browser Expo web at 320 x 568 verifies
  `/onboarding/notifications` shows the calm soft ask, `Not now` continues to
  `/onboarding/account`, and the same session's `/settings/notifications`
  renders both routine reminder switches off (`aria-checked=false`) with 48 px
  switch targets, zero horizontal overflow, and no JavaScript dialog. Focused
  notification onboarding tests already cover the OS-denied branch source
  contract. Evidence:
  `test-results/human-e2e/2026-07-08/onboarding-notification-skip-current/`.

- Fixed `/ask` on shortest 320 x 480 phones. The empty Ask state now uses a
  stricter `height < 520` layout: decorative pills are hidden, the top two
  prompt buttons stay above the fixed composer, and the first-answer user
  bubble/answer/report stack uses denser spacing only on those shortest phones.
  Codex in-app browser E2E reproduced the old prompt-composer hit-blocking, then
  verified the fixed empty state and first-prompt state with zero hit-blocked
  controls, zero sub-44 px controls, zero horizontal overflow, and only expected
  local placeholder warnings. Evidence and bug report:
  `test-results/human-e2e/2026-07-08/ask-short-phone-480-composer-clearance/`,
  `docs/e2e-bug-reports/2026-07-08-ask-short-phone-composer-overlap.md`.

- Made Today check-offs match the append-only routine-completion contract from
  docs/01 and docs/03. Repeated taps on an already-completed row now preserve
  the local completion instead of toggling it off, and completed rows no-op in
  the UI so duplicate taps do not re-trigger analytics. Added focused
  completion-store regressions, fixed the test clock around the 48-hour
  backfill window, updated Phase 7 QA wording from undoable to append-only, and
  captured Codex in-app browser evidence at 320 x 568 for first check-off,
  repeat tap, and reload persistence in
  `test-results/human-e2e/2026-07-08/today-checkoff-append-only/`.

- Tightened the shortest-phone onboarding footer experience at 320 x 480.
  Goal selection now switches to a compact two-column card grid so all six
  choices remain visible and hit-testable above the fixed Continue footer.
  Product intake no longer leaves an optional category trigger clipped behind
  `Skip for now`; on compact phones the category picker appears as a visible
  footer action only after a product name exists. Added onboarding route
  contracts and Codex in-app browser evidence covering `/onboarding/goals`,
  `/onboarding/products`, typed product entry, category sheet open, and `Serum`
  selection with zero hit-blocked controls, zero sub-44 controls, and zero
  horizontal overflow.

- Added a production dialog contract test that scans mobile source files and
  rejects native `Alert` imports/calls plus explicit browser `window` /
  `globalThis` alert, confirm, or prompt calls. This locks in the route-owned
  recovery work so future launch surfaces cannot silently reintroduce blocking
  system dialogs over polished in-app failure states.

- Removed the last production native-alert calls from shared navigation helpers.
  `openExternalHttpsUrl` and `openAppSettings` now stay UI-free and return
  `false` for invalid links, browser/linking failures, settings failures, and
  dev-only E2E fixtures, so policy, billing, retailer, camera-settings, and
  permission-recovery screens must own inline feedback. Updated navigation and
  paywall contracts to reject helper-level `Alert.alert` while preserving the
  existing route option shape for call-site compatibility. Current route
  surfaces already pass `alertOnFailure: false` and have local E2E evidence for
  route-owned recovery; this slice removes the shared default that could
  reintroduce platform chrome over polished launch flows.

- Replaced Progress single-photo delete confirmation with route-owned inline UI.
  The detail route now owns delete confirmation and local-delete failure feedback,
  closes back to Progress only after successful removal, and uses a dev-only
  `EXPO_PUBLIC_E2E_PHOTO_DELETE_FAILURE` fixture for deterministic recovery
  testing. Added central claim-safe delete copy, source contracts that prevent
  `Alert.alert` from returning to the route, an E2E bug report, and Codex
  in-app browser evidence at 320 x 568 showing cancel recovery, forced delete
  failure, no JavaScript dialog, 48 px controls, zero horizontal overflow, and
  hidden raw fixture text. Native iOS/Android deletion with real encrypted image
  bytes remains device QA follow-up.

- Replaced the reviewed conflict share-card export failure `Alert.alert` paths
  with route-owned inline feedback. Added dev-only E2E fixtures for reviewed
  conflict sharing and native share unavailability, kept production review gates
  unchanged, and captured 320 x 568 in-app browser evidence showing the branded
  share card remains visible while the unavailable state stays in-screen.

- Replaced two remaining non-destructive native-alert fallbacks with route-owned
  inline recovery. The reviewed conflict share-card export path now renders
  durable `role="alert"` feedback when native sharing is unavailable, keeps Share
  to Stories and Done visible, and uses dev-only fixtures for reviewed-conflict
  and native-share failure coverage without weakening production review gates.
  Progress Timeline `Play` now keeps the user on the dated timeline with calm
  inline copy about on-device capture, no autoplay, and no AI scores. Codex
  in-app browser evidence at 320 x 568 covers both flows with no JavaScript
  dialog, no raw provider/native text, 48 px+ controls, and zero horizontal
  overflow. Native iOS/Android share sheet, screen-reader, and Dynamic Type
  evidence remain device QA follow-up.

- Hardened biometric app-lock recovery across the global lock overlay, locked
  Progress timeline, and You-tab security switch. Native auth unavailable states
  now render stable in-app `role="alert"` feedback while user cancellation stays
  quiet and retry remains available. Added dev-only app-lock auth/readiness/enabled
  fixtures for reproducible E2E coverage, updated source contracts, and captured
  Codex in-app browser evidence at 320 x 568 for the locked overlay retry path and
  the You-tab App lock switch failure with no dialog, no raw native/provider text,
  48 px+ controls, and zero horizontal overflow. Native iOS/Android biometric
  prompt chrome remains a device QA follow-up.

- Hardened subscription/paywall recovery to stay route-owned instead of stacking
  native alerts over polished paywall surfaces. Contextual, onboarding, re-offer,
  downgrade, win-back, subscription settings, compliance restore, policy-link,
  and commerce-link recovery now use persistent inline feedback where the screen
  already owns the failure state. Added `PaywallFeedback`, an external-open
  `alertOnFailure: false` opt-out, contract coverage for no native `Alert.alert`
  purchase/restore recovery, and Codex in-app browser evidence for direct
  `/paywall/upsell?feature=full_routine` compliance restore plus
  `/settings/subscription` Manage/Terms/Restore recovery at 320 x 568 with no
  dialog, route-owned `role="alert"` feedback, no raw provider text, and zero
  horizontal overflow. Native RevenueCat purchase-sheet failure remains device
  QA because Expo web disables purchases without live store configuration.

- Hardened Phase 7 and Phase 8 QA packet traceability. Phase 7 core-loop
  packets now hash the Phase 7 verifier scripts, root script manifest, and
  shared evidence-normalization helper. Phase 8 growth/store packets now hash
  the Phase 8 verifier scripts, root script manifest, and the same shared helper
  alongside public-growth source inputs. The cross-phase evidence-normalization
  smoke now covers Phase 7 and Phase 8 packet flags, so closed-beta and
  public-growth evidence cannot regress to raw string checks locally. The
  refreshed packets remain blocked on external brand, legal, clinical, device,
  RevenueCat, Supabase, store-console, launch-dashboard, and named-signoff
  evidence.

- Hardened Phase 6 payments QA packet traceability. Generated payments packets
  now hash the Phase 6 verifier scripts, root script manifest, and shared
  evidence-normalization helper alongside the RevenueCat runtime, Supabase
  functions, migrations, and payment docs. The cross-phase normalization smoke
  now covers Phase 6 packet evidence flags, so payment evidence cannot regress
  to raw string checks without failing locally. The refreshed packet remains
  blocked on real RevenueCat offering review, iOS sandbox restore, Android
  license-test restore, webhook HMAC replay evidence, finance signoff, and
  named owner signoff.

- Hardened Phase 5 device-QA packet evidence normalization. The Phase 5 packet
  builder now uses the shared normalized evidence/signoff helpers, the
  cross-phase evidence-normalization smoke covers `PHASE5_QA_SIGNOFF`, and the
  generated device-QA packet hashes the Phase 5 verifier scripts plus the shared
  helper it depends on. `PHASE5_QA_SIGNOFF` tolerates whitespace/case but only
  `true` passes, while `PHASE5_SIGNED_OFF_BY` is written as a normalized real
  tester/reviewer name and placeholders remain blocked. The refreshed generated
  packet remains blocked on real EAS build IDs, physical devices, and named
  tester evidence.

- Hardened Shelf replenish similar-options recovery after commerce consent.
  The `/shelf/replenish` `See similar options` consented empty-state branch now
  uses the shared route-owned `CommerceLinkNotice` instead of `Alert.alert`,
  keys the notice state to the current product, and keeps the user in the
  replacement context while the catalogue/partner rail is launch-gated. Codex
  in-app browser Expo web at 320 x 568 with commerce enabled verifies the
  boundary product setup, consent sheet, no dialog after the consented retap,
  one visible `role="alert"` notice at y=427-545, zero horizontal overflow, and
  empty warn/error logs. Evidence and bug report:
  `test-results/human-e2e/2026-07-08/shelf-replenish-similar-inline-recovery-current/`,
  `docs/e2e-bug-reports/2026-07-08-shelf-replenish-similar-inline-recovery.md`.

- Hardened the Phase 10 beta analytics audit. `phase10:beta-analytics-audit`
  now parses the minimum beta event list in
  `docs/phase-10/beta-event-schema.md` and blocks if any event is only
  documented or allowlisted without a runtime `track(...)` emission in non-test
  app source. The schema documents this gate so closed-beta readiness cannot
  overstate instrumentation coverage. Non-strict Phase 10 analytics still
  warns, correctly, on missing external dashboard and privacy-payload evidence.

- Hardened the Phase 10 closed-beta packet hash coverage. Generated beta
  packets now hash the Phase 10 verifier scripts, the shared Phase 9 evidence
  normalization helper, and the Phase 10/11 public-contact smoke script in
  addition to the beta docs and app analytics files, so a packet cannot omit the
  local gates that decided its status. The refreshed packet remains blocked on
  external beta identity, TestFlight/Play, dashboard, payment, catalog,
  retention, and named-signoff evidence.

- Hardened Phase 11 public-launch evidence gates. Launch ring evidence now uses
  the shared normalized evidence parser instead of raw `true` string checks, the
  evidence-normalization smoke covers Phase 11 readiness/ring/packet scripts,
  and public-launch packets now hash the Phase 11 verifier scripts plus the
  shared Phase 9/10 helpers that influence launch status. The refreshed packet
  remains blocked on Phase 10 exit, store approval, production environment,
  RevenueCat production, monitoring/support, ring reports, and named signoff.

- Verified the full nested scheduler route group on `main`. Codex in-app
  browser Expo web at 320 x 568 confirms fresh free direct `/cycle/settings`,
  `/cycle/disruption`, `/cycle/recovery`, `/cycle/why-tonight`,
  `/cycle/phased-intro`, and `/cycle/procedure` all show the scheduler
  contextual paywall with no nested route content, no sub-44 px visible
  controls, and zero horizontal overflow. The same paywall's no-card Pro week
  unlocks the route group; a manual retinol plus glycolic shelf fixture and the
  phased-intro `Add it now anyway` override verify scheduled glycolic/retinol
  settings rows, APART explainability copy, disruption/procedure/phased-intro
  surfaces, empty recovery, active recovery after `Start recovery`, and
  `Ease back in` returning to `/today`. Evidence and report are in
  `test-results/human-e2e/2026-07-08/nested-scheduler-routes-current/`.

- Hardened the enabled Community anonymous ask path. The
  `community_participation` gate now stays local-first when the consent ledger
  mirror is unavailable, so the composer can open in local/offline placeholder
  mode after the explicit 16+ checkbox. Deferred `Submit for review` recovery
  now renders a route-owned `Asking opens soon` `role="alert"` panel and scrolls
  it into view instead of using a native alert. Codex in-app browser Expo web at
  320 x 568 with `EXPO_PUBLIC_PHASE7_COMMUNITY_POSTING_ENABLED=true` verifies
  the consent gate reaches the composer, claim-heavy copy is flagged, submit
  opens no dialog, the recovery sits fully in view at y=292-471, and horizontal
  overflow remains zero. Evidence and bug report:
  `test-results/human-e2e/2026-07-08/community-ask-submit-inline-recovery-current/`,
  `docs/e2e-bug-reports/2026-07-08-community-ask-submit-inline-recovery.md`.

- Hardened commerce paid-link recovery for compact phones. The recommendation
  where-to-buy and shoppable stack paid-link paths now use a route-owned
  accessible commerce notice instead of native `Alert.alert`; the notice renders
  before paid-link rows so a first-row tap is immediately visible at 320 px.
  Codex in-app browser Expo web at 320 x 568 with commerce enabled verifies the
  stack paid-link stub stays on `/commerce/stack/sensitive-skin-starter-set`,
  opens no dialog, shows `Where to buy` inline at viewport y=242-408, keeps the
  paid row touchable, and preserves zero horizontal overflow. Evidence and bug
  report:
  `test-results/human-e2e/2026-07-08/commerce-link-recovery-alert-prefix/`,
  `docs/e2e-bug-reports/2026-07-08-commerce-paid-link-inline-recovery.md`.

- Verified the remaining full-routine intelligence direct-route gate on `main`.
  Codex in-app browser Expo web at 320 x 568 confirms fresh free direct
  `/routine/reorder`, `/routine/ramp`, `/routine/tolerance`, and
  `/routine/adaptation` all show the `Unlock your full routine.` contextual
  paywall with no premium route-body markers, no sub-44 px visible controls, and
  zero horizontal overflow. The local no-card Pro week unlocks the sequencing,
  ramp, tolerance, and adaptation surfaces, and fresh direct-entry exits
  (`Done`, `Skip`, `Looks good`, `Back`) all return to `/today`. Evidence and
  report are in
  `test-results/human-e2e/2026-07-08/full-routine-intelligence-current/`.

- Verified the reminders/streak/widgets direct-entry Pro gate and local
  reverse-trial access on `main`. Codex in-app browser Expo web at 320 x 568
  confirms fresh free direct `/routine/streak`, `/routine/welcome-back`, and
  `/routine/widgets` all show the `Reminders, streaks & home-screen widgets.`
  contextual paywall with no premium content, 48 px+ visible controls, no
  horizontal overflow, and no browser dialogs or current-origin warn/error logs.
  From the same paywall, `Explore first. 7 days of Pro` unlocks the calm streak,
  welcome-back, and widget-deferred surfaces; `Tonight's step` and
  `Back to Today` return direct entries to `/today`. Evidence and report are in
  `test-results/human-e2e/2026-07-08/reminders-streak-welcome-current/`.

- Hardened and verified the installed-base Trend reconsent gate. When Supabase
  is configured and the consent ledger returns old `photo_capture` consent but
  no `photo_trend_insights` row, Trend now fails closed instead of falling back
  to any local flag, preserving the explicit reconsent requirement for previous
  photo users. Focused tests cover the legacy-photo/no-trend-consent case, the
  explicit trend-consent row, and local-first fallback when the backend is not
  configured. Codex in-app browser Expo web E2E at 320 x 568 with populated
  Progress photos verifies a returning photo user sees photo history while the
  Trend card stays hidden, the no-score refusal links to optional off-by-default
  consent, one explicit `Read my progress` toggle unlocks the card, and the
  scoped output remains score-free with zero horizontal overflow. Evidence is
  in
  `test-results/human-e2e/2026-07-08/installed-base-trend-reconsent-current/`.

- Hardened settings privacy/security choice recovery and shared switch
  activation. The You-tab Marketing emails, partner data-sharing, and cloud
  backup save-failure paths now render route-owned inline `Choice not saved`
  feedback instead of blocking native alerts, and the shared `ToggleSwitch`
  uses `onPress` across platforms so Expo web pointer/touch activation works
  like native taps. Codex in-app browser Expo web E2E at 320 x 568 verifies
  `/settings/privacy` redirects to `/you?section=privacy`, pointer tap and
  keyboard activation on Marketing emails show inline `role="alert"` recovery,
  keep the switch unchecked on failed persistence, open no JS dialog, leak no
  raw backend text, preserve a 52 x 48 switch target, and keep zero horizontal
  overflow. Evidence is in
  `test-results/human-e2e/2026-07-08/settings-privacy-choice-inline-feedback/`.
  Tracked report:
  `docs/e2e-bug-reports/2026-07-08-settings-privacy-choice-inline-feedback.md`.

- Hardened Progress camera/photo permission-denied recovery. The shared
  `openAppSettings` helper can now return failure without owning a native alert,
  letting `/progress/capture` render route-owned `Camera settings unavailable`
  feedback when the OS Settings handoff fails. The denied/no-retry gate no
  longer exposes background capture chrome behind the recovery overlay. In-app
  browser Expo web E2E at 320 x 568 with
  `EXPO_PUBLIC_E2E_PROGRESS_CAMERA_PERMISSION=denied_no_retry`,
  `EXPO_PUBLIC_E2E_APP_SETTINGS_FAILURE=1`, and
  `EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro` verifies consent into the permission
  gate, one `Open settings` action, no `Capture photo` control, no dialog,
  inline alert copy, no raw fixture text, 48 px+ visible controls, zero
  horizontal overflow, and `Not now` returning to `/progress`. Evidence and bug
  report:
  `test-results/human-e2e/2026-07-08/progress-photo-permission-denied-current/`,
  `docs/e2e-bug-reports/2026-07-08-progress-photo-permission-settings-inline-recovery.md`.

- Hardened Progress still-photo capture failure recovery. `/progress/capture`
  now converts `takePictureAsync` rejection into route-owned `Photo wasn't
captured` recovery instead of a platform alert, with a foreground retry, a
  `Not now` exit, disabled background shutter, and explicit compact heading
  line heights for wrapped recovery copy. In-app browser Expo web E2E at
  320 x 568 with `EXPO_PUBLIC_E2E_PROGRESS_CAPTURE_FAILURE=once` and
  `EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro` verifies no dialog, no raw fixture
  error, 56 px retry, 48 px exit, retry into the normal permission gate,
  recovery to `/progress`, and zero current-origin browser logs. Evidence and
  bug report:
  `test-results/human-e2e/2026-07-08/progress-photo-capture-failure-current/`,
  `docs/e2e-bug-reports/2026-07-08-progress-photo-capture-failure-inline-recovery.md`.

- Hardened Shelf OCR label-capture failure recovery. `/shelf/ocr` now keeps
  capture rejection and camera-unavailable states in route-owned review/manual
  fallback UI instead of relying on Shelf OCR native alert calls, exposes
  inline `Label wasn't captured` copy plus a retry action, and keeps retry,
  manual ingredient text, and the final Continue action clear on 320 px phones.
  In-app browser Expo web E2E with
  `EXPO_PUBLIC_E2E_SHELF_OCR_CAPTURE_FAILURE=once` verifies no dialog, no raw
  fixture error, text entry of `Aqua, Glycerin, Niacinamide`, carry-forward to
  `/shelf/manual`, clean layout audits, and zero current-origin browser logs.
  Evidence and bug report:
  `test-results/human-e2e/2026-07-08/shelf-ocr-capture-failure-current/`,
  `docs/e2e-bug-reports/2026-07-08-shelf-ocr-capture-failure-inline-recovery.md`.

- Hardened first-use Progress photo consent save failure recovery. The
  `/progress/capture` failure path now relies on durable route-owned
  `Photo choice not saved` feedback instead of also calling a native/system
  alert for the same consent persistence failure; camera-capture failure alerts
  remain unchanged. In-app browser Expo web E2E at 320 x 568 with
  `EXPO_PUBLIC_E2E_PHOTO_CONSENT_FAILURE=once` and
  `EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro` verifies the failed save keeps the
  camera and permission path closed, opens no JavaScript dialog, keeps retry and
  `Not now` inside the compact viewport, shows no raw fixture error, and retry
  reaches the normal web camera-permission gate. Evidence and bug report:
  `test-results/human-e2e/2026-07-08/progress-photo-consent-failure-current/`,
  `docs/e2e-bug-reports/2026-07-08-progress-photo-consent-native-alert.md`.

- Fixed shared web switch activation and completed the Ask cloud-consent
  failure branch. The shared `ToggleSwitch` now uses React Native `onPress`
  across platforms, keeps web focus support, and handles the Space key on web
  so Ask/Trend/settings privacy switches do not render as inert semantic
  controls. In-app browser Expo web E2E at 320 x 568 with
  `EXPO_PUBLIC_PHASE7_CLOUD_ASK_ENABLED=true`,
  `EXPO_PUBLIC_E2E_ASK_CONSENT_FAILURE=grant_once,revoke_once`, and
  `EXPO_PUBLIC_E2E_ASK_CONSENT_LEDGER=local_only` verifies Ask consent failed
  grant and withdrawal stay inline, retryable, state-authoritative, dialog-free,
  and free of raw provider/fixture errors. Evidence and bug report:
  `test-results/human-e2e/2026-07-08/ask-consent-failure-current/`,
  `docs/e2e-bug-reports/2026-07-08-toggle-switch-web-inert.md`.

- Hardened Shelf add recovery on compact phones. In-app browser Expo web E2E at
  320 x 568 now covers catalog search no-match to manual add, barcode offline
  fallback copy with search/OCR/manual options, the no-match sheet routes, and
  finishing a manually added product into the archive. The run found and fixed
  a compact empty-Shelf bug where `View archive (1)` was covered by the
  floating tab bar; the archive action now renders as a visible 48 px target and
  opens `/shelf/archive` with the finished product visible. Evidence and bug
  report:
  `test-results/human-e2e/2026-07-08/shelf-add-recovery-current/`.

- Added a dev-only fixture and human E2E evidence for the unreviewed
  cycle-cadence production gate. With an active Pro fixture and
  `EXPO_PUBLIC_E2E_ROUTINE_CADENCE_REVIEW_GATE=closed`, `/cycle/week`,
  `/cycle/settings`, and `/cycle/why-tonight` now prove the review-gate copy is
  what users see while dermatologist/cosmetic-chemist cadence review remains
  closed; cycle controls, night rows, pause/recovery banners, and add-active
  cycle promises stay hidden. Evidence is in
  `test-results/human-e2e/2026-07-08/cycle-cadence-review-gate-current/`.

- Verified the critical public-copy smoke under the working `RoutineKind`
  display name. Expo web at 320 x 568 covers age gate, public share landing,
  catalog search, timing lock-screen preview, and free `/routine/widgets`
  before/after the no-card Pro week. The required public surfaces show
  `RoutineKind`, all captured states show no visible `OnSkin`, widgets still
  defer behind native-device QA, and current-origin browser warn/error logs are
  empty. Evidence is in
  `test-results/human-e2e/2026-07-08/public-copy-smoke-current/`.

- Hardened the Today empty-routine and compact PM cycle-strip states. Today no
  longer treats the routine-plan example preview as real check-off data: when
  the local shelf has no real routine, it shows `No routine yet` with a direct
  `Add products` action into manual shelf intake, and it hides routine-only
  recommendation/tonight prompts until a real plan exists. The PM skin-cycling
  strip now uses compact two-line labels with full accessibility labels so
  six-night cycles stay readable at 320 px without visual ellipses. System
  Chrome Expo web E2E at 320 x 568 covers the empty state, the `Add products`
  route handoff, and the PM strip geometry. Tracked report:
  `docs/e2e-bug-reports/2026-07-08-today-example-routine-empty-state.md`.

- Removed the remaining native alert from Skin Note share failure recovery.
  The share helper now returns `false` without opening a blocking platform
  dialog, leaving `/community/note/[id]` as the single owner of durable
  `accessibilityRole="alert"` feedback. The community share tests now reject
  helper-level `Alert.alert` so the route cannot regress into double recovery
  on compact phones, and the route scrolls the recovery region plus retry/help
  controls fully into view on a 320 px phone viewport. E2E evidence is in
  `test-results/human-e2e/2026-07-08/community-note-native-alert-current/`.
  Tracked report:
  `docs/e2e-bug-reports/2026-07-08-community-note-native-alert.md`.

- Fixed the scheduler profile source so local-first onboarding stays
  personalized before Supabase is available. The shared `readProfileBits`
  helper now reads the device-local skin profile first, mapping the quiz axes,
  pregnancy/breastfeeding state, and goals into routine/cycle/recommendation/Ask
  profile bits before falling back to neutral defaults. This prevents generated
  plans, cycle orchestration, recommendations, and Ask grounding from silently
  using a neutral profile in the local placeholder/offline path. Focused
  scheduler profile tests cover local-profile mapping and the true empty
  fallback. System Chrome Expo web E2E at 320 x 568 now covers the routine-plan
  empty example label, a seeded oily/resistant local profile label, the compact
  evening row fit, and direct-entry Back recovery. The same slice also guards
  consent ledger read/write/withdrawal calls when Supabase is unconfigured so
  placeholder hosts are not queried from local settings surfaces. Tracked report:
  `docs/e2e-bug-reports/2026-07-08-scheduler-local-profile-fallback.md`.

- Hardened recommendation preference save failure recovery. The preferences
  route now has a clamped
  `EXPO_PUBLIC_E2E_RECOMMENDATION_PREFERENCES_DELAY_MS` fixture so the saving
  state is observable, and compact preference chips expose `aria-selected` on
  Expo web in addition to their React Native accessibility state. The route also
  uses its persistent `Preference not saved` alert region without firing a
  blocking native alert on top of it. System Chrome Expo web at 320 x 568 with
  `EXPO_PUBLIC_E2E_RECOMMENDATION_PREFERENCES_FAILURE=once` and a 1.2s save
  delay verifies `Vegan` stays unselected and disabled while the forced save is
  pending, shows persistent `Preference not saved` recovery copy after failure,
  opens no JS/system dialog, disables again during retry, becomes selected only
  after the successful save, persists selected state after reload, keeps zero
  horizontal overflow, and keeps all visible controls 48 px tall. Evidence is in
  `test-results/human-e2e/2026-07-08/recommendation-preference-save-failure-current/`,
  with the tracked report in
  `docs/e2e-bug-reports/2026-07-08-recommendation-preference-save-state.md`.

- Hardened Trend consent failure recovery. The `/trend/optin` save and
  withdrawal failure path now relies on the existing route-owned
  `accessibilityRole="alert"` panel instead of also firing a blocking native
  `Alert.alert`, so compact-phone recovery stays polished and retryable. The
  Trend route contract now rejects native alerts in that path. In-app browser
  Expo web E2E at 320 x 568 with
  `EXPO_PUBLIC_PHASE7_TREND_ENABLED=true`,
  `EXPO_PUBLIC_E2E_TREND_CONSENT_FAILURE=grant_once,revoke_once`, and
  `EXPO_PUBLIC_E2E_TREND_CONSENT_LEDGER=local_only` verifies failed grant and
  failed withdrawal show inline `Choice not saved` copy with no JS/system dialog,
  keep the switch state honest, clear on retry, keep the switch 52 x 48, and
  have zero horizontal overflow. Evidence is in
  `test-results/human-e2e/2026-07-08/trend-consent-failure-inline-feedback/`,
  with the tracked report in
  `docs/e2e-bug-reports/2026-07-08-trend-consent-native-alert.md`.

- Hardened single-photo Progress detail sharing on compact phones. The detail
  route no longer relies on a platform `Alert.alert` confirmation that can be
  invisible/inert on Expo web; it uses a route-owned confirmation panel and
  leaves stable `accessibilityRole="alert"` share-unavailable feedback when the
  photo cannot be shared. The compact layout now reduces the photo height, wraps
  quality chips, keeps the dark detail content scrollable, and keeps the 48 px
  action row fully visible at 320 x 568. Focused photo route/share tests pass.
  In-app browser Expo web E2E with populated progress photos, store-backed Pro,
  and `EXPO_PUBLIC_E2E_SHARE_PHOTO_FAILURE=1` verifies direct
  `/progress/e2e-front-2026-04-01` shows fully visible share confirmation
  controls, stays on the same route after failed sharing, renders accessible
  recovery copy, has zero horizontal overflow, and logs no browser warnings or
  errors. Evidence is in
  `test-results/human-e2e/2026-07-08/progress-photo-detail-share-failure-current/`,
  with the tracked report in
  `docs/e2e-bug-reports/2026-07-08-progress-photo-share-failure.md`.

- Hardened the contextual Pro gate while entitlement is resolving. The gate no
  longer leaves slow entitlement checks as an empty screen; it shows a neutral
  `Checking your access` holding state and keeps Pro-only route children hidden
  until the entitlement query returns. Added a clamped
  `EXPO_PUBLIC_E2E_ENTITLEMENT_DELAY_MS` fixture so this branch is repeatable.
  System Chrome Expo web at 320 x 568 with
  `EXPO_PUBLIC_E2E_ENTITLEMENT=expired_store` and a 2.2s entitlement delay
  verifies direct `/routine/plan` shows only the neutral holding state during
  the delay, samples no routine-plan premium text during resolution, then
  resolves to the lapsed paid renewal paywall with zero horizontal overflow and
  48 px+ controls. Evidence is in
  `test-results/human-e2e/2026-07-08/slow-entitlement-no-flash/`, with the
  tracked report in
  `docs/e2e-bug-reports/2026-07-08-slow-entitlement-no-flash.md`.

- Corrected lapsed paid entitlement contextual paywall framing. Contextual Pro
  gates now distinguish first-time free users from users with a prior expired
  entitlement: first-time users still get the no-card `Explore first` path, while
  lapsed paid users see `Restore Pro for` and a `Renew Pro` CTA instead of
  another first-trial CTA. Added local `expired_store` and
  `expired_reverse_trial` E2E entitlement fixtures plus route contracts. System
  Chrome Expo web at 320 x 568 with `EXPO_PUBLIC_E2E_ENTITLEMENT=expired_store`
  verifies direct `/routine/plan` shows the contextual renewal paywall, hides
  `Explore first. 7 days of Pro` and `Start free trial`, keeps all controls 48
  px+ tall, has zero horizontal overflow, and shows no routine-plan content.
  Evidence is in
  `test-results/human-e2e/2026-07-08/lapsed-entitlement-contextual-paywall/`,
  with the tracked report in
  `docs/e2e-bug-reports/2026-07-08-lapsed-entitlement-contextual-paywall.md`.

- Hardened Skin Note share failure recovery. The native share helper now exposes
  reusable failure copy and a dev-only forced-failure fixture, while the note
  detail route awaits the share attempt and leaves persistent
  `accessibilityRole="alert"` feedback on the Skin Note surface when the share
  sheet cannot open. Focused community route/share and affected paywall/progress
  contract tests pass. In-app browser Expo web E2E at 320 x 568 with
  `EXPO_PUBLIC_E2E_SHARE_NOTE_FAILURE=1` verifies
  `/community/note/note-niacinamide-vitc` keeps the user on the note, renders
  the failed-share recovery copy, keeps the `Share note` control 128 x 48, and
  has zero horizontal overflow. Evidence is in
  `test-results/human-e2e/2026-07-08/community-note-share-failure-current/`,
  with the tracked report in
  `docs/e2e-bug-reports/2026-07-08-community-note-share-failure.md`.

- Hardened paywall and subscription-management handoff failure recovery. The
  shared paywall ComplianceRow now treats Terms/Privacy opens as awaitable
  handoffs and renders inline `Link unavailable` feedback when the external
  policy opener fails; Restore also leaves visible success/empty/failure status
  in the paywall instead of relying only on a transient alert. Subscription
  Settings now gives the same persistent feedback for Terms, Privacy, Restore,
  and store-management deep-link failure, with a local store-backed entitlement
  fixture for the manage-billing branch. System Chrome Expo web E2E at 320 x 568
  with `EXPO_PUBLIC_E2E_EXTERNAL_OPEN_FAILURE=all` and
  `EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro` verifies
  `/paywall/upsell?feature=full_routine` and `/settings/subscription` show
  visible recovery copy, keep 48 px+ controls, and have zero horizontal
  overflow. Evidence is in
  `test-results/human-e2e/2026-07-08/subscription-compliance-feedback-current/`, with
  the tracked report in
  `docs/e2e-bug-reports/2026-07-08-paywall-subscription-link-failure.md`.

- Hardened Settings policy/help link failure recovery. Human E2E with
  `EXPO_PUBLIC_E2E_EXTERNAL_OPEN_FAILURE=browser` reproduced the
  `/settings/privacy` direct-entry branch at 320 x 568: the shared external
  opener returned failure, but Expo web did not surface an observable browser
  dialog or persistent in-app recovery copy. Settings now keeps the shared
  native/browser handoff helper, adds a dev-only failed-handoff fixture guarded
  to development runtime, and renders row-local `Link unavailable` feedback
  with `accessibilityRole="alert"` when a policy, consumer-health, terms,
  support, deletion, or export help link cannot open. Final System Chrome Expo
  web evidence verifies all six rows remain 70-94 px tall, each failure renders
  a 48 px row-local recovery message, horizontal overflow is zero, and the route
  stays on `/you?section=privacy`. Evidence is in
  `test-results/human-e2e/2026-07-08/settings-policy-link-failure/`, with the
  tracked report in
  `docs/e2e-bug-reports/2026-07-08-settings-policy-link-failure.md`.

- Hardened the For You "you're set" state for compact phone heights. Human E2E
  seeded a complete shelf and reproduced the empty-state branch at 320 x 568 and
  320 x 480: before the fix, the branch used a non-scrollable centered view, the
  completion icon crowded the hub subtitle, and the trust footnote clipped below
  the viewport. The empty state now uses the same compact-aware scroll pattern as
  the recommendation list, with explicit icon sizing and tighter short-phone
  rhythm. Final System Chrome Expo web evidence confirms no subtitle overlap, no
  horizontal overflow, no sub-44 px visible controls, no first-viewport subtitle
  collision, a fully visible 320 x 568 footnote, and a fully reachable 320 x 480
  footnote after scroll. Evidence is in
  `test-results/human-e2e/2026-07-08/recommendations-youre-set-compact/`, with
  the tracked report in
  `docs/e2e-bug-reports/2026-07-08-recommendations-youre-set-compact.md`.

- Added fresh Ask direct-entry navigation evidence for the deterministic/free
  advisor and deferred cloud Ask route. System Chrome Expo web at 320 x 568
  verifies direct `/ask`, reload, Back recovery to `/today`, direct
  `/ask/consent`, and `Back to Ask` recovery to `/ask`, with 48+ px controls,
  zero horizontal overflow, and no browser errors. Evidence is in
  `test-results/human-e2e/2026-07-08/ask-navigation-direct-entry/`.

- Refreshed closed-beta/public-launch readiness evidence after the latest safe-
  area and packet commits. `npm run phase10-11:verify` passes non-strict code
  gates, while the generated Phase 10 and Phase 11 packets remain correctly
  `blocked` on external proof: final identity URLs, TestFlight/Play evidence,
  RevenueCat production evidence, monitoring/support proof, beta/launch reports,
  and named signoffs. `LAUNCH_READINESS.md` and `BLOCKERS.md` now reflect the
  current 166-file / 1,677-test mobile suite and the latest non-strict
  verification status.

- Polished the floating bottom tab bar scene background so it no longer sits on
  a mismatched white band over PM Today. Human E2E geometry already proved the
  labels and hit targets were correct, but screenshot review showed Today's
  dark surface stopped above the floating bar because the tab scene clearance
  used the default light background outside the `Screen` component. The tabs
  layout now paints scene clearance by route: PM Today uses `colors.night`,
  while Progress, Shelf, You, and AM Today use `colors.paper`. Headless Chrome
  evidence at 320 x 568 and 390 x 568 confirms Today has a dark bottom sample
  behind the bar, light tabs keep paper samples, all labels remain visible, all
  centers hit the expected tab, targets stay 54 px tall, and horizontal
  overflow is zero. Evidence is in
  `test-results/human-e2e/2026-07-08/navigation-tabbar-polish/`, with the
  tracked report in
  `docs/e2e-bug-reports/2026-07-08-tabbar-scene-background.md`.

- Hardened `/conflict/[ruleId]` stale conflict and detail sheets for compact
  phone viewports, native bottom safe areas, and web modal semantics. E2E first
  caught the route-local sheet still collapsing when Expo web reported a
  transient 44 px window height: the dialog had `maxHeight: 0px` and pushed
  `Back to Shelf` / `Add a product` below the viewport. The fallback now only
  trusts viewport heights greater than the 44 px dismiss reserve, otherwise it
  uses the compact sheet fallback. The same fallback guard was applied to
  `/commerce/consent` because it shares the route-local bottom-sheet pattern.
  Post-fix in-app browser evidence at 320 x 568 confirms the missing conflict
  sheet has a 524 px dialog, `aria-modal`, the `Timing note unavailable` label,
  zero horizontal overflow, no mojibake, a 56 px `Back to Shelf` action, and a
  48 px `Add a product` action. Evidence is in
  `test-results/human-e2e/2026-07-08/conflict-detail-safe-area/`, with the
  tracked report in
  `docs/e2e-bug-reports/2026-07-08-conflict-detail-safe-area.md`.

- Hardened the `/commerce/consent` MHMDA where-to-buy consent gate for native
  bottom safe areas and modal semantics. The route-local sheet now uses
  `useWindowDimensions()` plus `useSafeAreaInsets()`, caps itself at viewport
  height minus a 44 px dismiss reserve, adds extra footer padding only when a
  real native bottom inset exists, exposes `role="dialog"` / `aria-modal`, and
  removes the full-screen scrim from accessibility traversal because the visible
  Dismiss control is the named exit. Focused commerce route contracts, mobile
  typecheck, and mobile lint pass. Codex in-app browser evidence with
  `EXPO_PUBLIC_PHASE7_COMMERCE_ENABLED=true` confirms `/commerce/consent` at
  320 px has one named dialog, zero horizontal overflow, a 48 x 48 Dismiss
  control, a 264 x 54 Allow action, a 264 x 48 Not now action, and no mojibake
  in visible text; screenshot capture was unavailable, so native
  home-indicator, Dynamic Type, VoiceOver/TalkBack, and outbound-link handoff
  remain follow-up QA. Evidence is in
  `test-results/human-e2e/2026-07-08/commerce-consent-safe-area/`, with the
  tracked report in
  `docs/e2e-bug-reports/2026-07-08-commerce-consent-safe-area.md`.

- Hardened the `/shelf/manual` category picker for native bottom safe areas and
  very short phone heights. The route-local sheet now owns its viewport cap with
  `useWindowDimensions()`, reserves a 44 px outside dismiss area, applies
  `useSafeAreaInsets()` bottom padding only when a real native inset exists,
  and exposes web modal semantics with `role="dialog"` / `aria-modal`. Focused
  Shelf route contracts, mobile typecheck/lint/test, and root
  typecheck/lint/test pass. Codex in-app browser evidence confirms the compact
  collapsed route at 320 px has zero horizontal
  overflow and 50+ px visible controls; browser input dispatch failed before
  modal-open capture, so native home-indicator, Dynamic Type,
  VoiceOver/TalkBack, and stable picker-open E2E remain follow-up QA. Evidence
  is in
  `test-results/human-e2e/2026-07-08/shelf-manual-category-picker-safe-area/`,
  with the tracked report in
  `docs/e2e-bug-reports/2026-07-08-shelf-manual-category-picker-safe-area.md`.

- Hardened the first-run `/onboarding/products` category picker for native
  bottom safe areas and compact dismiss targets. The hand-built picker now owns
  the same core contract as the shared sheets: compact web keeps the 40 px
  bottom baseline, native devices with a real bottom inset get
  `insets.bottom + 24`, sheet height is capped at viewport height minus a 44 px
  outside dismiss reserve, the sheet exposes modal-dialog semantics on web, and
  category chips sit in a shrinkable scroll view for short screens or larger
  text. Focused onboarding route contracts and product-category tests pass, as
  do mobile typecheck and lint. Codex in-app browser evidence confirms the
  compact route at 320 px has zero horizontal overflow with 50+ px visible
  controls; browser screenshot and modal-open capture timed out, so native
  home-indicator, Dynamic Type, VoiceOver/TalkBack, and stable modal-open E2E
  remain follow-up QA. Evidence is in
  `test-results/human-e2e/2026-07-08/onboarding-product-category-picker-safe-area/`,
  with the tracked report in
  `docs/e2e-bug-reports/2026-07-08-onboarding-product-category-picker-safe-area.md`.

## 2026-07-07

- Ran the Phase 9 release-engineering verification suite. `npm run
phase9:verify` passes non-strict across release contact smoke, evidence
  normalization, release smoke, RLS/policy checks, Edge/public-form/live-harness
  guards, data-rights and consent-withdrawal smoke, privacy-payload audit,
  store-build inspect, dependency inventory/SBOM, QA packet generation, root
  typecheck, root lint, and root tests. The generated Phase 9 packet remains
  `DIRTY` because support artifacts are produced earlier in the same local run;
  it is not final RC evidence. Strict Phase 9 remains blocked on Tas-owned live
  Supabase/Edge/RevenueCat/store/native-build/security/beta evidence and named
  release signoff.

- Ran the Phase 8 growth/store verification suite after the Phase 7 picker
  hardening work. `npm run phase8:verify` passes non-strict: smoke checks,
  growth/store readiness, QA packet generation, root typecheck, root lint, and
  root tests all pass. Strict Phase 8 remains blocked only on external evidence:
  final brand/domain/support/store URLs, Universal Links/App Links device QA,
  share-card device QA, attribution privacy signoff, store packets, creator
  compliance, support workflow, launch dashboard, dry run, Apple Team ID,
  Android release certificate fingerprint, and named signoff.

- Hardened the populated Progress comparison photo picker for native bottom
  safe areas and compact dismiss targets. The `EXPO_PUBLIC_E2E_PROGRESS_PHOTOS`
  `populated` mode now supplies three local metadata-only photo records, with an
  optional `EXPO_PUBLIC_E2E_ENTITLEMENT=pro` gate for deterministic Pro-route
  E2E, and the hand-built picker preserves the 40 px compact web baseline,
  adds `insets.bottom + 24` when a real bottom inset exists, and caps the sheet
  at viewport height minus a 44 px outside dismiss target. Focused
  `progressRoutes.test.ts` passes with contracts for the fixture gate,
  safe-area cap, modal labels, and contextual photo-tile labels. Codex in-app
  browser E2E verifies `/progress` opens with three local-only photos after the
  local Pro preview, the picker exposes one named `Choose the first photo`
  dialog, no sub-44 controls, three 92 x 123 photo tiles, dismiss recovery, and
  selecting `May 12` updates the comparison chip. Evidence is in
  `test-results/human-e2e/2026-07-07/progress-compare-picker-safe-area-current/`,
  with the tracked report in
  `docs/e2e-bug-reports/2026-07-07-progress-compare-picker-safe-area.md`.

- Hardened the hand-built `/settings/timing` reminder time-picker sheet for
  native bottom safe areas and compact dismiss targets. The modal now uses
  `useSafeAreaInsets()` only when a real bottom inset exists, caps the sheet at
  viewport height minus a 44 px outside dismiss target, and shrinks the internal
  time list before the backdrop collapses. Focused `settingsRoutes.test.ts`
  passes, and Codex in-app browser E2E verifies the Morning picker has one named
  dialog, 40 px zero-inset web bottom padding, zero horizontal overflow, 48 px
  picker rows, a 44 px named dismiss target in the compact observed viewport,
  and a successful update to `8:00 AM`. Evidence is in
  `test-results/human-e2e/2026-07-07/settings-time-picker-safe-area-current/`,
  with the tracked report in
  `docs/e2e-bug-reports/2026-07-07-settings-time-picker-safe-area.md`.

- Refreshed the generated Phase 7 core-loop QA packet after the current shared
  sheet, progress-capture, conflict, routine, Today, Progress, and You route
  hashes changed. Non-strict `phase7:check-core-loop` passes with code gates
  present and only external evidence warnings; `phase7:qa-packet` regenerated
  `docs/phase-7/generated/core-loop-qa-packet.{md,json}`. Repository-level
  `npm run typecheck`, `npm run lint`, and `npm test` pass, with the mobile
  suite at 166 files / 1,676 tests. Strict Phase 7 still waits on founder/legal,
  Supabase RLS, clinical review, catalog beta import, device QA, RevenueCat,
  privacy export/delete, beta dashboard, and named signoff evidence already
  tracked in `docs/FOR_TAS_TO_DO.md`.

- Hardened the shared `Sheet` component for native safe areas and inaccessible
  backdrop strips. `Sheet` now applies bottom safe-area padding only when a real
  bottom inset exists, preserving existing compact web `pb-6`/`pb-8` density,
  and non-accessible backdrops are explicitly `aria-hidden` with `tabIndex=-1`
  instead of creating tiny unlabeled focus targets. In-app browser E2E at
  320 x 568 verifies `/shelf/no-match` exposes one dialog, a 48 px Close action,
  zero horizontal overflow, no sub-44 exposed controls, and Close recovers to
  `/shelf`; `/cycle/disruption` exposes one compact dialog, all four disruption
  choices, no sub-44 exposed controls, a non-focusable hidden backdrop, and the
  intended 24 px web bottom padding. Evidence is in
  `test-results/human-e2e/2026-07-07/shared-sheet-safe-area-current/`, with the
  tracked report in
  `docs/e2e-bug-reports/2026-07-07-shared-sheet-backdrop-focus-target.md`.

- Hardened the first-use `/progress/capture` consent and recovery overlays so
  their scroll padding includes safe-area insets. Live Codex in-app browser
  Expo web evidence at 320 x 568 on the current branch verifies the local-only
  consent gate keeps complete privacy copy visible, exposes `Take photos. On
device only` as a 52 px control and `Not now` as a 48 px control, has zero
  horizontal overflow, and routes `Not now` back to `/progress` with the
  first-photo CTA and tab bar targets still 54 px+. Focused
  `progressRoutes.test.ts` passes. Evidence is in
  `test-results/human-e2e/2026-07-07/progress-capture-safe-area/`; native
  notch/home-indicator device confirmation remains in `docs/FOR_TAS_TO_DO.md`.

- Verified the realistic shelf-label routine branches in the Codex in-app
  browser at 320 x 568. From `/onboarding/products`, adding `Retinol 0.3%
Night Serum`, `Glycolic 7% Toner`, and `Mineral SPF 50` produces a
  `BUILT FROM YOUR SHELF` routine plan with SPF in Morning, Glycolic on Night
  1, Retinol on Night 2, and `Timing handled` as the first insight; `Start
today` opens the PM Glycolic check-off and completion reaches `1 of 1`.
  Removing the night actives to leave only `Mineral SPF 50` keeps the plan
  honest with `No night steps yet.` and Today PM shows no stale skin-cycling,
  retinol, glycolic, or recover copy. Focused routine generation, plan,
  cycle-anchor, and scheduler-cycle tests pass. Evidence is in
  `test-results/human-e2e/2026-07-07/routine-front-label-products-current/`.

- Replaced the compact `/shelf/manual` category picker with a bottom sheet after
  320 x 568 E2E showed the prior inline nested list still let the fixed
  Continue footer intercept visible category-row hit tests. The picker now opens
  as a dimmed modal sheet with a visible Close action, 52 px category rows, and
  a height-aware scroll area; the form footer stays separate. Post-fix E2E at
  320 x 568 verifies `Something else` is visible and center-tappable after a
  normal user scroll, the collapsed field reads `Other`, Continue remains a
  56 px target, horizontal overflow is zero, and Continue advances to
  `/shelf/opened`. Evidence is in
  `test-results/human-e2e/2026-07-07/shelf-manual-category-picker-current/`,
  with the tracked report in
  `docs/e2e-bug-reports/2026-07-07-shelf-manual-category-picker-sheet.md`.

- Verified the real conflict-detail choice path in a fresh 320 x 568 Chrome
  context seeded with a retinol/glycolic Shelf conflict. The Shelf banner opened
  the detail through `Review conflict`, the detail showed calm evidence and
  resolution copy, the compact saved-choice footer now reads `saved · we won't
ask again`, and tapping `Use together anyway` returned to Shelf with the
  conflict banner suppressed. The run decrypted the local override envelope and
  confirmed the canonical conflict key persisted. Focused conflict route,
  override, and Shelf tests pass. Evidence is in
  `test-results/human-e2e/2026-07-07/conflict-detail-choice-current/`.

- Verified conflict-check quota direct-route gating in a fresh 320 x 568 Chrome
  context seeded with real retinol/glycolic and retinol/BHA shelf conflicts. The
  first free direct conflict route rendered the AHA detail and recorded the free
  quota use, the second distinct direct conflict route rendered the
  `conflict_checks` contextual paywall with zero sampled locked-detail flashes,
  and the no-card reverse-trial path unlocked then reloaded the BHA detail as
  Pro. Focused `conflictQuota` and gated-route contract tests pass. Evidence is
  in
  `test-results/human-e2e/2026-07-07/conflict-quota-direct-routes-current/`.

- Fixed compact scheduler cycle-night labels after 320 x 568 E2E with a
  reverse-trial entitlement and two shelf actives showed `/cycle/week` and
  `/cycle/settings` using terse `N1`, `N2`, etc. labels on customer-facing rows.
  The scheduler week overview and settings active-night rows now render
  user-facing `Night 1`, `Night 2`, etc. labels with compact widths that keep
  the phone layout free of horizontal overflow. Post-fix in-app browser E2E at
  320 x 568 verifies `/cycle/week` and `/cycle/settings` show the full labels,
  contain no `N#` labels, keep zero horizontal overflow, and expose no clipped
  or sub-44 px visible controls. Evidence is in
  `test-results/human-e2e/2026-07-07/cycle-night-labels-current/`, with the
  tracked report in
  `docs/e2e-bug-reports/2026-07-07-cycle-night-labels-terse-copy.md`.

- Fixed the compact reverse-trial keep-options paywall after 320 x 568 E2E
  reproduced a billing-context ordering issue: tapping `Keep Pro after your
week` from `/settings/subscription` showed the fixed CTA before the annual
  price, store-unavailable reason, and compliance row. The active reverse-trial
  keep/options screen now keeps the annual price and preview checkout reason in
  the compact footer above the purchase CTA and restores enough compact scroll
  reserve for Terms, Privacy, and Restore to sit above that footer after a normal
  scroll. Post-fix Expo web E2E at 320 x 568 and 390 x 568 verifies the settings
  row opens `/paywall/reoffer`, active no-card copy is used, expired copy is
  absent, the annual price and store-unavailable reason appear before the CTA,
  horizontal overflow is zero, and scrolled compliance controls are 48 px+ with
  no overlap or clipping. Evidence is in
  `test-results/human-e2e/2026-07-07/reverse-trial-keep-options-current/`, with
  the tracked report in
  `docs/e2e-bug-reports/2026-07-07-reverse-trial-keep-options-compact-footer.md`.

- Fixed Ask active-frequency routing after a 320 x 568 human E2E pass showed
  `Should I use retinol every night?` misrouting to the product-fit engine and
  recommending a mineral SPF instead of refusing/escalating a frequency-style
  active-use question. The Ask intent router now treats common active-frequency
  wording for retinol, acids, exfoliants, and benzoyl peroxide as the existing
  medical/escalation bucket, and broad product-fit matching no longer catches
  generic `should I use` phrasing. Focused Ask intent/answer/route-contract
  tests pass, and post-fix Expo web E2E at 320 x 568 shows the typed question
  escalating with zero horizontal overflow, no sub-44 px controls, no fit-engine
  copy, and no SPF/vitamin-C recommendation. Evidence is in
  `test-results/human-e2e/2026-07-07/ask-first-prompt-compact-current/` and
  `test-results/human-e2e/2026-07-07/ask-active-frequency-escalation/`, with
  the tracked report in
  `docs/e2e-bug-reports/2026-07-07-ask-active-frequency-misroute.md`.

- Fixed the compact paywall monthly-equivalent price label after 320 x 568 E2E
  screenshots showed the secondary `$4.16 /mo` copy squeezed into a cramped
  two-line block on contextual Progress and Routine paywalls. Contextual
  `ProGate`, direct upsell sheets, and onboarding paywall pricing now keep the
  monthly equivalent on one shrinkable `$4.16/mo` line while preserving the
  annual billed amount as the dominant price. In-app browser E2E at 320 x 568
  verifies Progress, `/routine/plan`, `/onboarding/paywall`, and
  `/paywall/upsell?feature=full_routine` have zero horizontal overflow, no
  sub-44 px controls, and no split monthly price label. Evidence is in
  `test-results/human-e2e/2026-07-07/paywall-monthly-equivalent-compact-line/`,
  with the tracked report in
  `docs/e2e-bug-reports/2026-07-07-paywall-monthly-equivalent-wrap.md`.

- Fixed the compact For You recommendation hub continuation after the current
  320 x 568 route sweep showed the third recommendation card peeking into the
  first viewport as a 19 px tappable sliver. Short-phone recommendation hubs now
  keep cards after the first two below the fold on narrow compact viewports,
  preserving the complete first two cards and avoiding an unfinished scroll
  boundary. Expo web E2E at 320 x 568 and 390 x 568 verifies zero horizontal
  overflow, no sub-44 px controls, no partial small visible controls, and only
  the first two recommendation cards visible in the initial viewport. Evidence
  is in
  `test-results/human-e2e/2026-07-07/recommendations-hub-narrow-scroll-continuation/`,
  with the tracked report in
  `docs/e2e-bug-reports/2026-07-07-recommendations-hub-third-card-sliver.md`.

- Tightened the compact Skin Notes hub after the current 320 x 568 and
  390 x 568 route audit showed the next Community card clipping into the first
  viewport. The hub now applies a height-aware compact card density, heading
  spacing, and section rhythm on short phones while preserving the expert
  library behavior and full-card tap targets. In-app browser E2E verifies
  `/community` has zero horizontal overflow and no sub-44 px controls at
  320 x 568 and 390 x 568; at 320 the first three Skin Notes are fully readable,
  and at 390 the first four note cards fit in viewport. Focused Community route
  contracts pass. Evidence is in
  `test-results/human-e2e/2026-07-07/community-hub-compact-card-fit/`, with the
  tracked report in
  `docs/e2e-bug-reports/2026-07-07-community-hub-compact-card-clip.md`.

- Tightened the compact For You recommendation hub after the current 320 x 568
  route audit showed the second recommendation card clipped before its
  evidence/`See how` row. The hub now applies a compact-only card density and
  shorter scroll start on short phones while preserving full-card tap targets.
  Expo web E2E at 320 x 568 and 390 x 568 verifies three recommendation cards
  render with zero horizontal overflow and no sub-44 px controls; the second
  card is fully visible at 320 x 568 with a 34 px bottom gap and a visible
  evidence/CTA row. Focused recommendation route contracts pass. Evidence is in
  `test-results/human-e2e/2026-07-07/recommendations-hub-compact-card-fit/`,
  with the tracked report in
  `docs/e2e-bug-reports/2026-07-07-recommendations-hub-compact-card-clip.md`.

- Hardened and verified onboarding privacy/quiz resilience. Direct health-consent
  decline now has current Expo web evidence showing the quiz stays locked and
  direct `/onboarding/quiz` recovers to consent. The sensitivities quiz chips
  were verified as mutually exclusive (`None that I know of` replaces concrete
  sensitivities and vice versa) with 48 px controls and no overflow. The
  profile-save-failure fixture also verifies that the first failed local profile
  save does not reveal a profile, preserves answers, and retries into Reveal.
  During that pass, a direct consent/quiz entry with no selected goals exposed a
  recovery gap; Products and Analyzing now route missing-goal sessions back to
  Goals, and Goals returns completed-quiz users to Products instead of inventing
  a goal or forcing a full quiz restart. Evidence is in
  `test-results/human-e2e/2026-07-07/onboarding-consent-quiz-resilience/`,
  `test-results/human-e2e/2026-07-07/onboarding-profile-save-failure/`, and
  `test-results/human-e2e/2026-07-07/onboarding-direct-no-goals-recovery/`, with
  the tracked report in
  `docs/e2e-bug-reports/2026-07-07-onboarding-direct-entry-missing-goals.md`.

- Fixed compact recommendation preferences after current 390 x 568 E2E showed
  the Texture chip row clipping below the viewport. The preferences route now
  uses height-aware compact section spacing, extra scroll bottom padding, and
  compact-only dense texture chips that still keep a 48 px minimum touch width.
  Expo web E2E at 320 x 568 and 390 x 568 verifies the budget row has a 34 px
  bottom buffer, all five texture chips fit in one fully visible 390 px row with
  a 32 px bottom buffer, `Oil` remains a 48 px target, and horizontal overflow is
  zero. Focused recommendation route contracts pass. Evidence is in
  `test-results/human-e2e/2026-07-07/recommendation-preferences-texture-clearance/`,
  with the tracked report in
  `docs/e2e-bug-reports/2026-07-07-recommendation-preferences-texture-chip-clip.md`.

- Fixed compact lifecycle paywall footer clearance for `/paywall/reoffer` and
  `/paywall/downgrade`. Short-phone layouts now reserve enough scroll-body space
  for Terms/Privacy/Restore above the fixed action footer and give fixed footer
  decline actions a 32 px bottom buffer instead of sitting against the viewport
  edge. The paywall mobile contract pins the compact breakpoint, scroll padding,
  and footer buffer. In-app browser E2E at 320 x 568 and 390 x 568 verifies
  reoffer and downgrade scrolled compliance controls are 48 px, fixed footer
  actions keep a 32 px bottom buffer, unavailable-store copy remains readable,
  decline actions route to `/today`, and horizontal overflow is zero. Evidence is
  in `test-results/human-e2e/2026-07-07/paywall-lifecycle-bottom-buffer/`, with
  the tracked report in
  `docs/e2e-bug-reports/2026-07-07-paywall-lifecycle-footer-buffer.md`.

- Verified the local reminder settings/timing slice. Expo web E2E at 320 x 568
  opens `/settings/notifications`, confirms tier switches and routine rows are
  readable with 48 px visible controls and zero horizontal overflow, opens
  `/settings/timing` from the Morning row, changes the AM reminder from 7:30 AM
  to 8:00 AM through the named time-picker sheet, and confirms the updated time
  appears back on the notifications hub. The same pass verifies quiet-hours copy
  and the generic lock-screen preview. Focused settings/notification policy,
  store, delivery, preference, and claims-safety tests pass. Evidence is in
  `test-results/human-e2e/2026-07-07/settings-reminder-timing-current/`; native
  notification permission, scheduling, timezone, and DST QA remain device gates.

- Verified the local settings privacy/data-rights recovery slice. Expo web E2E
  at 320 x 568 direct-opens `/settings/privacy`, confirms it resolves to
  `/you?section=privacy`, triggers the local backend-unavailable export path,
  shows the visible privacy-request failure copy, keeps data-rights controls at
  56 px with zero horizontal overflow, and dismisses destructive Delete/Withdraw
  prompt attempts without leaving the privacy surface. Focused settings action,
  settings route, and external-link tests pass. Evidence is in
  `test-results/human-e2e/2026-07-07/settings-privacy-data-rights-current/`;
  live Supabase export/delete/withdraw and native share-sheet QA remain
  founder-owned launch evidence.

- Tightened the compact contextual reminders/widgets paywall so the long
  `Reminders, streaks & home-screen widgets.` title and fallback store-copy stay
  readable on a 320 x 568 phone without crowding the compliance or dismiss
  controls. The upsell now uses short-phone spacing and a narrower title size for
  that long compact title while preserving the visible `Maybe later` exit.
  Focused paywall mobile contracts pass, and in-app browser E2E verifies zero
  horizontal overflow, no clipped elements, visible controls at least 48 px tall,
  and dismiss recovery to `/today`. Evidence is in
  `test-results/human-e2e/2026-07-07/paywall-upsell-reminders-compact/`.

- Re-buffered the `/shelf/search` direct-entry manual fallback after the local
  Shelf route contract was tightened from `pb-4` to `pb-8`. Expo web E2E at
  320 x 568 verifies `Add by hand` is a 56 px control with a 32 px bottom buffer,
  no visible sub-44 px controls, zero horizontal overflow, and a working route to
  `/shelf/manual`. Focused Shelf route contracts pass. Evidence is in
  `test-results/human-e2e/2026-07-07/shelf-search-manual-fallback-buffer/`, with
  the tracked report in
  `docs/e2e-bug-reports/2026-07-07-bottom-edge-action-buffer.md`.

- Added a compact direct-entry-only policy spacer for `/settings/privacy` after
  the current 320/390 px phone sweep showed the next `POLICIES` rows becoming
  partially visible and tappable under the floating tab bar even after the
  privacy controls themselves were clear. The You tab now keeps the privacy card
  anchored while pushing policy links below the first viewport on compact direct
  entry, and the settings route contract pins the buffer. Expo web E2E at
  320 x 568 and 390 x 568 verifies `/settings/privacy` resolves to
  `/you?section=privacy`, `Withdraw health-data consent` remains above the tab
  bar, `POLICIES` starts below the viewport, there are no non-tab controls in
  the tab-bar zone, and horizontal overflow is zero. Evidence is in
  `test-results/human-e2e/2026-07-07/settings-privacy-policy-buffer/`, with the
  tracked report in
  `docs/e2e-bug-reports/2026-07-07-settings-privacy-policy-buffer.md`.

- Shortened the compact Today SPF instruction after the 320 x 568 check-off
  evidence showed the completed `Mineral SPF 50` row still using the full
  reapplication sentence while other compact routine rows used concise display
  copy. Compact phones now render `Last step. Reapply later.` for the SPF
  instruction without changing the routine step or completion key, and the Today
  route contract pins the mapping. Expo web evidence confirms the new copy is
  present, the old copy is absent, horizontal overflow is zero, and visible
  controls are at least 48 px tall. Evidence is in
  `test-results/human-e2e/2026-07-07/today-spf-compact-instruction/`, with the
  tracked report in
  `docs/e2e-bug-reports/2026-07-07-today-spf-compact-instruction-copy.md`.

- Restored the compact `/settings/privacy` direct-entry scroll calibration after
  the current phone-width sweep found the positive privacy nudges had regressed
  to negative values, landing `Withdraw health-data consent` under the floating
  tab bar at 320 x 568 and 390 x 568. The You tab now pins positive compact and
  narrow-phone nudges, and the settings route contract rejects negative privacy
  nudge constants. Expo web E2E verified `/settings/privacy` resolves to
  `/you?section=privacy`, visible privacy controls are 44 px or taller, and no
  privacy control crosses the safe tab-bar boundary. Evidence is in
  `test-results/human-e2e/2026-07-07/settings-privacy-positive-nudge-regression/`,
  with the tracked report in
  `docs/e2e-bug-reports/2026-07-07-settings-privacy-negative-nudge-regression.md`.

- Verified the critical Today AM check-off loop through the in-app browser at
  320 x 568 using the local shelf routine. The flow completed `Mineral SPF 50`,
  undid it back to `0 of 1`, completed it again, reloaded Today, and preserved
  the `1 of 1` checked state. Visible controls stayed at least 48 px high with
  zero horizontal overflow. Evidence is in
  `test-results/human-e2e/2026-07-07/today-checkoff-persistence/`; native
  iOS/Android verification remains part of Phase 5 device QA.

- Reworked the compact `/onboarding/products` category picker after the
  phone-width audit showed the horizontal category rail clipping offscreen chips
  and feeling inconsistent with the rest of the mobile shell. Compact phones now
  show a single collapsed selector that opens a dimmed bottom sheet with 48 px
  category chips; tablet/desktop widths keep the wrapped chip set. In-app
  browser E2E at 320 x 568 and 390 x 568 verified the collapsed selector,
  expanded sheet, `SPF` selection, product add path, no footer collision, no
  horizontal overflow, and no sub-44 px controls. Evidence is in
  `test-results/human-e2e/2026-07-07/onboarding-product-category-sheet/`, with
  the tracked report in
  `docs/e2e-bug-reports/2026-07-07-onboarding-product-category-rail-clipping.md`.

- Made the recommendation preference save-failure branch provable through the
  real app surface. `/recommendations/preferences` now supports a dev-only
  one-shot `EXPO_PUBLIC_E2E_RECOMMENDATION_PREFERENCES_FAILURE=once` fixture,
  keeps the chip state fail-closed until local private persistence succeeds,
  and shows persistent `Preference not saved` recovery copy with
  `role="alert"` while preserving native `Alert.alert` for platforms that
  display it. Expo web E2E at 320 x 568 verified forced failure, visible
  recovery copy, retry success, zero horizontal overflow, and no sub-44 px
  visible controls; evidence is in
  `test-results/human-e2e/2026-07-07/recommendation-preference-save-failure/`,
  with the tracked report in
  `docs/e2e-bug-reports/2026-07-07-recommendation-preference-save-failure.md`.

- Calibrated the `/settings/privacy` direct-entry scroll target across compact
  phone widths after a 320/390 px rerun showed the policy rows still becoming
  partially tappable under the floating tab bar with a single positive nudge.
  The You tab now uses separate narrow-phone and compact-phone privacy scroll
  offsets, and the settings route contract pins both constants. Expo web E2E at
  320 x 568 and 390 x 568 now verifies `/settings/privacy` resolves to
  `/you?section=privacy`, horizontal overflow is zero, visible controls are at
  least 44 px, and no non-tab privacy control crosses the floating tab-bar
  bounding box. Evidence is in
  `test-results/human-e2e/2026-07-07/settings-direct-entry-privacy/`, with the
  tracked report in
  `docs/e2e-bug-reports/2026-07-07-settings-privacy-direct-tabbar-underlap.md`.

- Fixed compact floating-tab navigation after a 320 x 568 human E2E pass showed
  the first `Progress` tap staying on Today and a locked Progress paywall leaving
  hidden compliance controls over the tab bar after switching away. Tab icon/text
  visuals now opt out of hit testing so the semantic tab target owns the full
  tap area, locked contextual paywalls render nothing while their route is
  unfocused, and contextual paywall impressions only track for focused locked
  routes. Expo web E2E at 320 and 390 px verified Today, Progress, Shelf, and
  You selection, one-line readable labels, 54 px tab targets, no horizontal
  overflow, and no controls overlapping the floating bar; supplemental 320 x 568
  metrics also confirmed `pointer-events: none` on the inner tab content.
  Evidence is in
  `test-results/human-e2e/2026-07-07/navigation-tabbar-compact/` and
  `test-results/human-e2e/2026-07-07/navigation-tab-pointer-events/`, with the
  tracked report in
  `docs/e2e-bug-reports/2026-07-07-navigation-tabbar-compact-hit-targets.md`.

- Fixed a stale Phase 7 smoke-check blocker after `/ask/consent` gained its
  route-specific `Back to Ask` deferred CTA. The launch checker now validates
  the gated Cloud Ask deferred surface by required JSX props instead of one
  exact single-line JSX shape, so it accepts the safer route while still
  requiring `surface="cloudAsk"`, `fallbackRoute={APP_ASK_ROUTE}`, and
  `fallbackLabel="Back to Ask"`. `phase7:check-core-loop-smoke`,
  `phase7:check-core-loop`, and the Ask route contract test pass; remaining
  Phase 7 output is warning-only external evidence/final-copy work already
  tracked in `docs/FOR_TAS_TO_DO.md`.

- Tightened the feature-flagged `/trend/optin` compact layout after the forced
  consent failure path showed the secondary fairness row clipped at the bottom
  of a 320 x 568 viewport. The opt-in card and failure alert now use short-phone
  density, and compact failure states hide secondary fairness/footer links until
  a retry succeeds. Expo web E2E with
  `EXPO_PUBLIC_PHASE7_TREND_ENABLED=true`,
  `EXPO_PUBLIC_E2E_TREND_CONSENT_FAILURE=grant_once,revoke_once`, and
  `EXPO_PUBLIC_E2E_TREND_CONSENT_LEDGER=local_only` verified grant failure,
  grant retry success, revoke failure, and revoke retry success with no
  horizontal overflow or sub-44 px controls; evidence is in
  `test-results/human-e2e/2026-07-07/trend-optin-compact-layout/`, with the
  tracked bug report in
  `docs/e2e-bug-reports/2026-07-07-trend-optin-compact-failure-density.md`.

- Fixed `/paywall/success` after a compact route audit found the primary
  `See tonight's routine` CTA sitting flush with the 320 x 568 viewport bottom.
  The success screen now adds an explicit short-phone bottom action buffer while
  preserving the existing clean checkmark, renewal terms, and split metadata
  rows. The flow tree and paywall contract test now pin the bottom-buffer
  requirement; native purchase-success rendering remains part of RevenueCat and
  physical-device QA.

- Hardened Trend opt-in consent failure recovery. `/trend/optin` now has
  dev-only one-shot grant/revoke failure fixtures plus a dev-only
  `EXPO_PUBLIC_E2E_TREND_CONSENT_LEDGER=local_only` ledger mode so the recovery
  UI can be proven without Tas-owned Supabase credentials. Failed grant and
  withdrawal attempts now show persistent `Choice not saved` copy with
  `role="alert"`, keep the switch on the last saved value, and re-enable the
  control even when the consent refresh is slow. Successful retries update the
  visible consent query immediately and clear the alert while the ledger refresh
  continues in the background. Expo web E2E at 320 x 568 verified grant failure,
  grant retry, withdrawal failure, and withdrawal retry with no raw dev errors
  visible and no horizontal overflow; evidence is in
  `test-results/human-e2e/2026-07-07/trend-consent-failure/`, with the tracked
  bug report in
  `docs/e2e-bug-reports/2026-07-07-trend-consent-failure-recovery.md`.

- Hardened the first-use Progress photo consent failure branch. The capture
  route now has a dev-only one-shot
  `EXPO_PUBLIC_E2E_PHOTO_CONSENT_FAILURE=once` fixture, persistent
  `Photo choice not saved` copy with `role="alert"`, and a retryable CTA that
  does not open the camera before consent saves. Photo capture consent now
  stores a local proof with version, text hash, and timestamp before camera
  access and treats the remote ledger as best-effort for local-only capture;
  cloud backup remains fail-closed because it moves images off device. Compact
  failure recovery also drops the prep reminder after the failed save and uses a
  52 px primary action so both `Take photos` and `Not now` stay fully reachable
  on a 320 x 568 phone. Expo web E2E at 320 x 568 verified failure copy, no
  pre-consent camera path, no clipped or sub-44 px controls, and retry into the
  normal permission gate; evidence is in
  `test-results/human-e2e/2026-07-07/progress-photo-consent-save-failure-fix/`,
  with the tracked bug report in
  `docs/e2e-bug-reports/2026-07-07-progress-photo-consent-save-failure.md`.

- Tightened the compact Ask first-prompt answer state after human-simulated E2E
  at 320 x 568 showed the post-answer `What should I do tonight?` suggestion
  peeking underneath the fixed composer. Empty-state suggested prompts now keep
  the first answer anchored, and compact phones hide post-answer suggestion
  rows so the composer is the follow-up path. The Ask route contract pins the
  behavior; Expo web E2E verified no horizontal overflow, no clipped/sub-44 px
  controls, no partial follow-up prompt under the composer, and no browser
  errors. Evidence is in
  `test-results/human-e2e/2026-07-07/ask-first-prompt-short-phone-fix/`; the
  tracked bug report is
  `docs/e2e-bug-reports/2026-07-07-ask-first-prompt-compact-composer-overlap.md`.

- Made the critical onboarding profile-save failure branch testable through the
  real app surface. `/onboarding/analyzing` now supports a dev-only one-shot
  `EXPO_PUBLIC_E2E_PROFILE_SAVE_FAILURE=once` fixture that rejects the first
  local profile save, shows the existing retry state without advancing to
  reveal, then lets `Try again` call the real persistence path. The onboarding
  route contract pins the dev-only guard and fail-closed ordering. Expo web E2E
  at 320 x 568 completed age, goals, consent, quiz, product skip, forced save
  failure, and retry to reveal; evidence is in
  `test-results/human-e2e/2026-07-07/onboarding-profile-save-failure/`, with
  the tracked testability bug report in
  `docs/e2e-bug-reports/2026-07-07-onboarding-profile-save-failure-e2e-hook.md`.

- Repaired stale commerce stack detail source so an unavailable
  `/commerce/stack/[slug]` route has a real recovery state when commerce is
  enabled: `Stack unavailable` copy, disclosure/product-availability review
  explanation, `Back to stacks`, and `How paid links work`. Expo web E2E at
  320 x 568 with the commerce flag and final-domain fixture enabled verified the
  missing-stack state, no horizontal overflow, no clipped/sub-44 px controls,
  `Back to stacks` routing to `/commerce/stacks`, and `How paid links work`
  routing to `/commerce/transparency`. Evidence is in
  `test-results/human-e2e/2026-07-07/commerce-missing-stack-recovery/`; default
  beta runtime still correctly defers commerce behind Phase 7 flags.

- Repaired stale Skin Note direct entries so a missing
  `/community/note/[id]` no longer presents a muted one-line unavailable state
  with only the top Back icon. The route now shows explicit `Note unavailable`
  copy, explains that the note may have been updated or removed during expert
  review, and provides a 56 px `Back to Skin Notes` recovery action into
  `/community`. Expo web E2E at 320 x 568 verified the recovery state, no
  horizontal overflow, no clipped controls, and the Skin Notes escape. Evidence
  is in
  `test-results/human-e2e/2026-07-07/community-missing-note-recovery/`; the
  tracked bug report is
  `docs/e2e-bug-reports/2026-07-07-community-missing-note-recovery.md`.

- Repaired stale Shelf replenishment direct entries so a missing
  `/shelf/replenish?id=...` no longer presents a generic one-line missing state
  with only `Close`. The route now explains that the replacement prompt is no
  longer active, avoids reusing stale freshness or shopping prompts, and offers
  explicit `Back to Shelf` and `Add a product` recovery actions. The Shelf route
  contract now pins the unavailable copy and destinations; Expo web E2E at
  320 x 568 verified no horizontal overflow, 56 px recovery buttons, the Shelf
  escape, and the manual-add recovery path. Evidence is in
  `test-results/human-e2e/2026-07-07/shelf-replenish-missing-product-recovery/`;
  the tracked bug report is
  `docs/e2e-bug-reports/2026-07-07-shelf-replenish-missing-product-recovery.md`.

- Repaired stale conflict-detail direct entries so a missing `/conflict/[ruleId]`
  no longer presents a generic one-line missing state with only a `Close`
  action. The route now explains that the timing note is no longer active,
  avoids reusing stale routine advice, and provides explicit `Back to Shelf`
  and `Add a product` recovery actions that stay fully visible on 320 x 568
  phones. Expo web E2E verified no horizontal overflow, no clipped controls,
  the Shelf escape, and the manual-add recovery path. Evidence is in
  `test-results/human-e2e/2026-07-07/conflict-missing-detail-recovery/`; the
  tracked bug report is
  `docs/e2e-bug-reports/2026-07-07-conflict-missing-detail-recovery.md`.

- Repaired stale Shelf product-detail direct entries so a missing `/shelf/[id]`
  no longer presents a muted one-line empty state with only the top Back icon.
  The route now shows clear `Product unavailable` copy, keeps the state
  scrollable on short phones, and provides explicit `Back to Shelf` and
  `Add a product` recovery actions. Expo web E2E at 320 x 568 verified the
  recovery state, no horizontal overflow, the Shelf escape, and the manual-add
  recovery path. Evidence is in
  `test-results/human-e2e/2026-07-07/shelf-missing-product-recovery/`; the
  tracked bug report is
  `docs/e2e-bug-reports/2026-07-07-shelf-missing-product-recovery.md`.

- Tightened onboarding product intake around the documented three-product
  first-insight target without blocking users who only have one or two products.
  `/onboarding/products` now shows a 0-3 progress cue, keeps the primary footer
  nudging toward the next product until three are added, and preserves a
  secondary `Continue with N products` escape before the target. Expo web E2E
  verified the 2-of-3, 3-of-3, and Continue paths; evidence is in
  `test-results/human-e2e/2026-07-07/onboarding-products-three-target.png`, and
  the tracked bug report is
  `docs/e2e-bug-reports/2026-07-07-onboarding-products-three-target.md`.

- Repaired stale `/progress/[id]` direct entries so a missing local photo no
  longer lands on a dead one-line `Photo not found.` state. The route now shows
  calm photo-unavailable recovery copy, a 56 px `Take a new photo` primary
  action, and a 56 px `Back to Progress` escape inside a short-phone scroll
  container. Expo web E2E at 320 x 568 verified the visible recovery state,
  no horizontal overflow, the capture recovery path, and the Progress escape.
  Evidence is in
  `test-results/human-e2e/2026-07-07/progress-missing-photo-recovery/`; the
  tracked bug report is
  `docs/e2e-bug-reports/2026-07-07-progress-missing-photo-recovery.md`.

- Expanded the `/routine/plan` skin-cycling row labels from shorthand `N1` /
  `N2` / `N3-4` and `x/week` cadence copy into phone-readable `Night 1`,
  `Night 2`, `Nights 3-4`, and `times/week to start`. The Pro-gated route
  contract now guards those labels and the wider cycle-label column. Expo web
  E2E at 390 x 844 verified the first-insight handoff, PM card labels, and
  visible `Start today` CTA. Evidence is in
  `test-results/human-e2e/2026-07-07/routine-plan-ascii-copy.png`; the tracked
  bug report is
  `docs/e2e-bug-reports/2026-07-07-routine-plan-cycle-labels.md`.

- Tightened the deferred `/routine/widgets` route so unavailable native widgets
  now use `Back to Today` with an explicit Today fallback instead of generic
  `Back` copy. The regression is covered by the Pro-gated route contract and
  tracked in `docs/e2e-bug-reports/2026-07-07-widgets-deferred-cta.md`. App
  surface automation remains a follow-up for this slice because the bundled
  Browser plugin is missing its documented runtime script and Playwright is not
  installed in the repo.

- Fixed the Today check-off activation metric so `first_checkoff_completed`
  cannot re-fire after a user checks off a step, undoes it, and checks it off
  again. The local completion store now keeps a durable first-completion marker
  and backfills that marker for legacy completion logs before future toggles.
  Focused completion-store tests cover normal persistence, undo/recheck, and
  legacy-log behavior; the tracked bug report is
  `docs/e2e-bug-reports/2026-07-07-today-first-checkoff-refire.md`.

- Fixed the compact win-back paywall fallback after 320 x 568 E2E showed the
  unavailable native-offer reason colliding with the fixed action area. The
  win-back surface now uses compact-height spacing, clips the scroll body behind
  an opaque footer, and keeps the current-plan fallback reason directly above
  `See current Pro plan`. Expo web E2E verified the repaired layout, the fallback
  CTA to `/paywall/upsell?feature=full_routine`, and the direct-entry `No thanks`
  escape to Today. Evidence is in
  `test-results/human-e2e/2026-07-07/paywall-winback-current-plan-fallback/`;
  the tracked bug report is
  `docs/e2e-bug-reports/2026-07-07-paywall-winback-fallback-overlap.md`.

- Fixed the paid-expiry downgrade paywall's unavailable-store state so a disabled
  `Renew Pro` action now explains the local store-checkout reason instead of
  looking inert. The lifecycle paywall contract now requires unavailable-store
  reasons on re-offer and downgrade surfaces, and Expo web E2E at 320 x 568
  verified the reason, scroll-reachable compliance controls, 48 px targets, and
  zero horizontal overflow. Evidence is in
  `test-results/human-e2e/2026-07-07/paywall-downgrade-unavailable-reason/`;
  the tracked bug report is
  `docs/e2e-bug-reports/2026-07-07-paywall-downgrade-unavailable-reason.md`.

- Tightened deferred Community posting direct entries so `/community/ask` and
  `/community/people-like-you` now use `Back to Skin Notes` instead of a generic
  `Back` CTA while community posting is gated. Expo web E2E at 320 x 568 verified
  both CTAs route back to `/community`, remain 56 px tall, and do not horizontally
  overflow. Evidence is in
  `test-results/human-e2e/2026-07-07/community-deferred-cta/`; the branch is
  tracked in `docs/e2e-bug-reports/2026-07-07-community-deferred-cta.md`.

- Tightened the direct-entry `/ask/consent` deferred route so unavailable cloud
  Ask now uses `Back to Ask` instead of a generic `Back` CTA. Expo web E2E at
  320 x 568 verified the CTA is 56 px tall, no horizontal overflow appears, and
  tapping it renders the deterministic `/ask` advisor. Evidence is in
  `test-results/human-e2e/2026-07-07/ask-consent-deferred-cta/`; the tracked bug
  report is
  `docs/e2e-bug-reports/2026-07-07-ask-consent-deferred-cta.md`.

- Added a single named dialog contract to the populated Progress comparison
  photo picker. The picker now labels the React Native web `Modal` wrapper with
  `Choose the first/second photo`, keeps the named dismiss control, and labels
  each date tile with the comparison target. Expo web E2E at 320 x 568 used two
  synthetic local photo records to verify one dialog, contextual photo-tile
  labels, no sub-44 px controls, no horizontal overflow, and dismissal back to
  `/progress`. Evidence is in
  `test-results/human-e2e/2026-07-07/progress-photo-picker-dialog-name/`; the
  tracked bug report is
  `docs/e2e-bug-reports/2026-07-07-progress-photo-picker-dialog-name.md`.

- Added a stable dialog name to the custom Settings time picker after the
  shared-sheet accessibility pass found this Modal-backed picker needed its own
  contract. `/settings/timing` now passes the picker title to the Modal wrapper
  without adding duplicate nested dialog roles, while keeping native modal
  semantics, named dismiss, and 48 px time rows. Expo web E2E at 320 x 568
  verified one `Morning reminder` dialog, one named dismiss, no sub-44 px
  controls, and no horizontal overflow. Evidence is in
  `test-results/human-e2e/2026-07-07/settings-time-picker-dialog-semantics/`;
  the tracked bug report is
  `docs/e2e-bug-reports/2026-07-07-settings-time-picker-dialog-semantics.md`.

- Fixed direct `/progress/review` entries without a captured photo. The review
  route now requires a non-blank `capturedUri` before showing the captured-photo
  review UI or allowing save; stale/direct entries show `Photo not captured`
  recovery with `Take photo`, `Back to Progress`, and Close. Expo web E2E at
  320 x 568 verified no fake `your photo` placeholder, no `Save to my phone`
  leak, no sub-44 px controls, Take photo routes to `/progress/capture`, and
  Back/Close recover to `/progress`. Evidence is in
  `test-results/human-e2e/2026-07-07/progress-review-direct-entry-recovery/`;
  the tracked bug report is
  `docs/e2e-bug-reports/2026-07-07-progress-review-direct-entry-fake-photo.md`.

- Added shared Sheet dialog semantics after the route-surface accessibility
  sweep found the modal body had visual sheet behavior without a dialog role.
  The shared sheet now exposes `role="dialog"` / `aria-modal` plus native
  modal semantics, and the navigation route contract pins the behavior. Expo web
  E2E at 320 x 568 verified `/shelf/no-match` exposes one dialog, keeps Close
  at 48 x 48, has no horizontal overflow or sub-44 px visible controls, and
  returns to `/shelf` after Close. Evidence is in
  `test-results/human-e2e/2026-07-07/shared-sheet-dialog-semantics/`; the
  tracked bug report is
  `docs/e2e-bug-reports/2026-07-07-shared-sheet-missing-dialog-semantics.md`.

- Fixed the compact Shelf manual-add category picker after human-simulated
  Expo web E2E at 320 x 568 showed the full list could run into the fixed
  Continue footer. The picker now has a capped internal scroll area while each
  category row keeps a 48 px target; rerun evidence verified no horizontal
  overflow, no sub-44 px controls, the footer owns its hit zone, and
  `Something else` remains reachable and selectable. Evidence is in
  `test-results/human-e2e/2026-07-07/shelf-manual-category-picker-footer-overlap/`;
  the tracked bug report is
  `docs/e2e-bug-reports/2026-07-07-shelf-manual-category-picker-footer-overlap.md`.

- Added the missing privacy-safe routine-depth analytics from docs/03 / docs/05
  where the local actions already exist: routine reorder moves emit
  `step_reordered` and `routine_edited`, ramp offers/acceptance emit
  `ramp_step_up_offered` / `ramp_step_up_accepted`, and conflict decisions emit
  `conflict_resolution_chosen` plus `conflict_overridden` only for the
  use-together override. Payloads stay bucket-only with no product, rule, or
  step identifiers.

- Kept the For You recommendation hub intro readable on phone-width web by
  extracting a reusable intro block and splitting the disclosure subtitle at the
  comma instead of relying on a cramped single line. Focused route contracts and
  Expo web human-simulated E2E at 320 x 568 and 390 x 844 pass, including
  Preferences navigation and return. Evidence is in
  `test-results/human-e2e/2026-07-07/recommendations-hub-intro-final/`, with
  resumed compact-phone geometry and screenshots in
  `test-results/human-e2e/2026-07-07/recommendations-preferences/`.

- Verified the Today check-off persistence launch criterion on Expo web. At
  320 x 568, a real morning step toggled from unchecked to checked, the routine
  count moved from `0 of 3` to `1 of 3`, and a full page reload preserved both
  the checked row and the count. Evidence is in
  `test-results/human-e2e/2026-07-07/today-checkoff-reload-persistence/`.

- Clarified the routine reorder launch gate after the docs/03 / blockers pass.
  The route comment and route-contract test now make the V1 behavior explicit:
  tap a step, use `Earlier` / `Later`, and show a non-blocking sequencing nudge.
  `BLOCKERS.md` now treats true drag/drop as an inert future claim rather than
  an active V1 launch blocker, and `LAUNCH_READINESS.md` matches that posture.

- Polished the You tab For You navigation row after the settings-route E2E
  sweep found `Skin Notes. Myth vs evidence` compressed into one awkward label.
  The row now uses `Skin Notes` with a separate reviewed/claim-safe hint, and
  hinted navigation rows expose the hint in their accessibility label. Focused
  settings route contracts and Expo web E2E at 320 x 568 and 390 x 844 pass,
  with evidence in
  `test-results/human-e2e/2026-07-07/you-for-you-row-polish/`.

- Refreshed the Phase 11 public-launch packet after the Phase 9 packet cleanup.
  It now records a clean git status, the current Phase 9/10 generated-packet
  hashes, and the current package hash while still correctly blocking on
  Tas-owned Phase 10 exit, store approval, production env, RevenueCat,
  monitoring/support, ring, creator, finance, week-1, and launch signoff proof.

- Refreshed the Phase 9 release-engineering QA packet from a clean worktree.
  The packet no longer carries the stale dirty-worktree warning and now hashes
  the current analytics registry, settings actions, RevenueCat webhook, and live
  webhook harness sources. Strict Phase 9 remains blocked only by Tas-owned live
  service, store, native QA, beta, and named-signoff evidence.

- Strengthened the floating bottom tab bar active state after human-simulated
  Expo web E2E showed the selected destination had a transparent background and
  border. The active tab now renders as a subtle filled pill inside the floating
  bar while preserving 52+ px touch targets and readable labels at 320 px and
  390 px phone widths. Focused navigation tests, mobile typecheck/lint/test,
  and repo typecheck/lint/test pass. Evidence is in
  `test-results/human-e2e/2026-07-07/navigation/` and
  `test-results/human-e2e/2026-07-07/navigation-active-tab-pill/`.

- Refreshed the Phase 7 core-loop QA packet and Phase 10 closed-beta packet
  after the latest analytics and commerce-source changes. The generated
  artifacts now carry current source hashes for `WhereToBuy`, the beta evidence
  dashboard, the analytics event registry, and the beta event schema, and the
  Phase 10 packet records a clean git status. External evidence remains blocked
  for Tas-provided beta, store, legal, account, and signoff proof.

- Cleared the remaining strict brand-audit launch-risk hits. The routine
  activation analytics marker now uses the working `RoutineKind` namespace, the
  local private-data registry test covers both legacy internal and current
  private storage namespaces, and Phase 5 / Phase 10-11 smoke temp directories
  no longer use the legacy brand prefix. `brand:audit:strict`, focused storage
  tests, Phase 5/10-11 smokes, mobile typecheck, and mobile lint pass. This was
  non-visual brand/QA infrastructure cleanup, so human E2E was not required.

- Reconciled the master-plan `photo_baseline_added` event with the existing
  photo-progress instrumentation. The first saved local Progress photo now emits
  both `first_photo_captured` and `photo_baseline_added` with metadata-only,
  on-device-safe properties, preserving the active docs/06 beta event while
  satisfying the master-plan core event taxonomy. Phase 7/10 beta evidence docs
  and the Phase 7 core-loop checker now require the baseline-photo event. This
  was non-visual analytics instrumentation, so human E2E was not required.

- Added the master-plan `product_add_started` event to close the Shelf
  add-start drop-off gap before beta dashboards. Onboarding product intake,
  empty Shelf scan/manual starts, scan/search/no-match fallbacks,
  recommendation detail, commerce "already own" handoff, and public share-link
  add starts now emit only compact source buckets before routing to the existing
  intake surfaces. Phase 7 and Phase 10 beta evidence docs plus the Phase 7
  core-loop checker now require the start-to-added funnel, and focused
  analytics/shelf contracts plus mobile typecheck/lint/test pass. This was
  non-visual analytics instrumentation, so human E2E was not required.

- Fixed the active reverse-trial subscription-options path. App-granted
  no-card reverse trials now route the Settings subscription row to an in-app
  keep-Pro options paywall instead of OS subscription management, and active
  reverse-trial/settings copy no longer implies App Store cancellation or a card
  on file. The expired reverse-trial re-offer still keeps its downgrade path.
  Focused settings/paywall/cancel-intent contracts pass, and Expo web E2E at
  390 x 844 and 320 x 568 verified Settings -> keep options uses active
  no-card copy in
  `test-results/human-e2e/2026-07-07/settings-subscription-reverse-trial/`.

- Hardened the RevenueCat webhook idempotency path so failed entitlement mirror
  writes can recover on RevenueCat retry. Event IDs with a completed or ignored
  audit row still dedupe, but rows stuck in `processing_status='error'` now
  reset to `processing`, reuse the existing `subscriptions_events` row, and
  retry the entitlement upsert. The Phase 9 live webhook harness now seeds this
  failed-row state and verifies the retry updates entitlement state without a
  second audit row. This was non-UI Edge Function reliability hardening, so
  human E2E was not required.

- Aligned the 2-day carded-trial reminder with RevenueCat localized pricing.
  Trial reminder notifications now use the verified entitlement price label when
  RevenueCat supplied one, falling back to the local plan label only when no
  store price is cached. This keeps the pre-charge reminder consistent with the
  actual store offer without adding any external dependency. This was non-UI
  notification copy logic, so human E2E was not required.

- Added the master-plan `subscription_cancel_intent` analytics event for the
  revenue dashboard. Opening subscription management still emits the generic
  manage event, but renewing store-backed entitlements now also emit a
  privacy-safe cancellation-intent bucket from settings. App-granted reverse
  trials and already non-renewing paid access are excluded so no-card
  exploration or already-cancelled subscriptions are not miscounted as churn.
  This was non-UI instrumentation, so human E2E was not required.

- Hardened RevenueCat entitlement sync so a verified empty CustomerInfo no
  longer leaves stale store-backed Pro access cached locally. Auth startup,
  CustomerInfo listeners, restore, and purchase sync now clear only
  store-backed paid records when RevenueCat reports no entitlement, while
  preserving app-granted reverse trials that are not store purchases. This was
  non-UI lifecycle hardening, so human E2E was not required.

- Added the docs/08 `paywall_dismissed` funnel event at the shared paywall
  dismiss helper. Onboarding, contextual, lifecycle, and win-back paywall exits
  now emit a privacy-safe dismissal event before returning through the existing
  safe-back fallback logic, giving beta economics a measurable shown-to-dismissed
  denominator. This was non-UI instrumentation hardening, so human E2E was not
  required.

- Hardened the satisfaction-timed review prompt so native StoreReview failures
  remain best-effort. Platform availability errors now track an unavailable
  prompt instead of throwing, native request failures are swallowed, and a local
  attempt is recorded whenever the app tries to prompt so cooldown/cap policy is
  not bypassed by a transient platform failure. This was non-UI logic hardening,
  so human E2E was not required.

- Fixed mojibake punctuation on the first-run age gate. The DOB screen now shows
  `We don't store your birth date.` instead of a broken apostrophe sequence.
  Added a route-contract regression and a user-flow branch, then verified Expo
  web at 320 x 568 through the initial, impossible-date, and underage states;
  the resumed compact pass also rechecked the title, privacy sentence,
  day/month/year fields, and Continue action. Evidence is in
  `test-results/human-e2e/2026-07-07/onboarding-age-gate-live-audit/`,
  `test-results/human-e2e/2026-07-07/onboarding-age-gate-copy-fix/`, and
  `test-results/human-e2e/2026-07-07/onboarding-age-copy/`.

- Aligned Shelf scan analytics with the master-plan/docs/04 activation funnel.
  Valid barcode scans now emit the privacy-safe `barcode_scanned` event, exact
  catalog matches emit `scan_matched`, true no-matches emit `scan_no_match`, and
  ambiguous or offline outcomes stay as bucketed scan results instead of being
  over-counted. Raw barcodes and product IDs remain out of analytics payloads.
  This was non-UI instrumentation hardening, so human E2E was not required.

- Hardened the Smart Shelf local store so direct product update patches are
  normalized before persistence. Malformed lifecycle/status/PAO/opened-date
  values now write back as clean shelf rows instead of relying on the next read
  repair, unopened rows cannot keep an opened-date clock, and a blank direct
  name patch preserves the existing product identity. This is non-UI data-layer
  hardening, so human E2E was not required.

- Closed the direct-entry health-data consent bypass on `/onboarding/quiz`.
  The quiz now verifies a granted local health-data collection consent before
  rendering any quiz questions and redirects missing, declined, or malformed
  consent state back to `/onboarding/consent`. Updated the onboarding route
  contract and the flow tree, and replaced the transient blank guard screen with
  a visible privacy-check state. Human-simulated Expo web E2E at 320 x 568
  verified direct quiz route -> consent redirect, refresh recovery, and the
  explicit agree -> quiz path, with evidence in
  `test-results/human-e2e/2026-07-07/onboarding-direct-quiz-consent/`.

- Hardened behavioural notification delivery so a successful local notification
  is not reported as failed just because the best-effort Supabase metadata log
  insert is offline or unavailable. The local cap ledger remains the v1 source of
  truth, and focused notification tests cover opt-outs, quiet hours, weekly caps,
  signed-in server cap unioning, and metadata-log failure after local delivery.

- Hardened settings privacy actions so account deletion and health-data consent
  withdrawal fail fast when the Supabase data-rights backend is still a
  placeholder, leaving local data intact instead of implying a completed legal
  deletion. Added regression coverage for backend-success-before-local-cleanup,
  backend failure, sign-out failure cleanup, Apple revocation-code fallback, and
  withdrawal ledger failure. This was non-UI logic hardening, so human E2E was
  not required.

- Buffered the `/cycle/procedure` post-procedure recovery CTA on compact phones.
  The primary `Start recovery` action now sits in a paper bottom wrapper with
  explicit bottom spacing, while the recovery checklist remains reachable by
  scroll. Added a route contract and human-simulated Expo web evidence at
  `test-results/human-e2e/2026-07-07/cycle-procedure-bottom-buffer/`.

- Repaired a Today completion-log migration edge so padded legacy date keys and
  canonical date keys that normalize to the same local day are merged instead of
  overwriting each other. This preserves valid check-off history for the streak
  and heat-map surfaces during local store repair.

- Hardened the local-first cycle scheduler store so direct config patches are
  normalized before persistence. Malformed anchors or invalid recovery windows
  now preserve the current valid cycle instead of writing corrupt state that is
  only repaired on the next read. Added scheduler store regressions for malformed
  anchors and invalid recovery input.

- Added notification timezone persistence for the local-first reminder
  preferences. Mobile now normalizes the current device/runtime timezone into
  `NotifPrefs`, repairs malformed legacy timezone values, and mirrors
  `notification_preferences.timezone` to Supabase with the AM/PM times and quiet
  hours, matching docs/07's timezone-aware reminder model.

- Fixed local reminder scheduling so AM/PM routine reminders and the weekly
  progress-photo nudge no longer disappear when their chosen time is inside
  quiet hours. Recurring notifications now shift to the quiet-hours end, matching
  the settings promise that reminders wait until morning while still keeping
  immediate behavioural sends suppressed inside quiet hours. Added policy and
  Expo-trigger boundary tests. Physical iOS/Android delivery remains a Tas device
  QA blocker in `docs/FOR_TAS_TO_DO.md`.

- Fixed the offline completion sync refresh path so a successful pending
  check-off flush invalidates the `completions` and `progress` queries Today
  actually reads, instead of a non-existent `today` query key. Added a contract
  test to keep the local-first check-off and streak surfaces wired after sync.

- Hardened first-session routine funnel analytics so repeat routine-plan views
  still record `routine_created`, but `first_routine_created` and
  `first_useful_insight` only fire once for real shelf-backed plans, not example
  plans or repeated route visits. Added a local-first activation marker and
  focused tests for repeat views, example plans, and malformed marker repair.

- Buffered compact direct-entry bottom actions on Shelf catalog search and the
  routine welcome-back earn-back screen. Both primary actions now sit in a small
  bottom wrapper instead of touching the phone edge, with route contract tests.
  Human-simulated Expo web E2E at 320 x 568 verified `Add by hand` routes to
  `/shelf/manual` and `Tonight's step` routes to `/today`; evidence is in
  `test-results/human-e2e/2026-07-07/direct-entry-bottom-actions/`. The tracked
  bug report is
  `docs/e2e-bug-reports/2026-07-07-bottom-edge-action-buffer.md`.

- Clarified the product-detail management hub so every active product now has a
  visible routine role card: placed products explain the generated AM/PM usage,
  and unplaced products send users to build the routine instead of leaving detail
  as a passive inventory screen. Updated the Shelf flow tree and added a route
  contract test. Human-simulated Expo web E2E covered Shelf -> product detail ->
  routine role card -> `/routine/plan` at 320 x 568 in
  `test-results/human-e2e/2026-07-07/product-detail-routine-role/`.

- Locked down the Today routine completion persistence requirement from the V1
  loop docs. Added a regression test proving a normal check-off survives fresh
  Today store reads, then ran human-simulated Expo web E2E at 320 x 568:
  open Today -> check the next routine item -> navigate to Shelf -> return to
  Today -> browser reload. The checked item stayed checked after both navigation
  and reload. Evidence is in
  `test-results/human-e2e/2026-07-07/today-persistence/`.

- Strengthened the first-session Shelf to routine handoff so any non-empty
  real-product Shelf now surfaces a clear `Build my routine` path into
  `/routine/plan`, with conflict-aware copy that turns timing notes into the
  next routine step instead of leaving the user at a passive list. Updated the
  Shelf flow tree before testing and added a route contract test. Human-simulated
  Expo web E2E covered manual product add -> Shelf handoff -> routine plan ->
  Start today -> first Today check-off at 320 x 568 in
  `test-results/human-e2e/2026-07-07/shelf-routine-handoff/`. The browser store
  already contained prior local E2E products, so the evidence records that
  persistence explicitly while still proving the handoff and check-off path. The
  tracked bug report is
  `docs/e2e-bug-reports/2026-07-07-shelf-routine-handoff.md`.

- Polished the first-use Progress photo consent gate after a 320 x 568
  human-simulated E2E sweep showed dense privacy copy competing with the capture
  guide behind the translucent overlay. The gate now uses an opaque night
  surface with stronger disclosure contrast while preserving 48 px+ actions.
  Evidence is in
  `test-results/human-e2e/2026-07-07/direct-entry-compact-sweep/`; the tracked
  bug report is
  `docs/e2e-bug-reports/2026-07-07-progress-capture-consent-contrast.md`.

- Hardened the remaining Phase 9/10 evidence sub-gates so RLS, Edge auth,
  data export/delete, consent withdrawal, observability payload, dependency
  audit, store-build, and beta analytics proof flags all share the normalized
  evidence parser: whitespace/case are tolerated, but only `true` passes.
  Added `phase9:evidence-normalization-smoke`, wired it into Phase 9/10
  verification, and re-ran `phase9:verify` plus `phase10:verify` successfully.

- Hardened Phase 6 payments evidence gates so RevenueCat, restore, webhook, and
  finance proof flags are trimmed/case-normalized while only `true` passes, and
  placeholder signoffs such as `Tester Name` or `example.com` emails no longer
  satisfy strict payments exit or generated QA packets. Phase 6 smoke now
  covers non-true evidence flags plus packet signoff normalization, and
  `phase6:verify` passes with only Tas-owned RevenueCat/payment evidence
  warnings.

- Hardened Phase 7/8/9 release evidence gates so external proof flags are
  trimmed/case-normalized while only `true` passes, generated packets strip
  placeholder signoffs, Phase 8 requires real-shaped Apple Team ID and Android
  SHA-256 certificate evidence, and Phase 9 production Phase 7 surface checks
  reject placeholder signoffs. Focused smoke now covers readiness and packet
  normalization, and `phase7:verify`, `phase8:verify`, and `phase9:verify`
  pass with only Tas-owned external-evidence warnings.

- Fixed the last compact-phone You tab underlap found in the 320 x 568
  human-simulated E2E sweep. The secondary routine block now uses
  short-phone-aware top spacing, keeping the `Retinoid ramp` button out of the
  floating tab bar touch zone on very short screens. Evidence is in
  `test-results/human-e2e/2026-07-07/compact-ui-sweep-3/`; the tracked bug
  report is
  `docs/e2e-bug-reports/2026-07-07-you-tabbar-underlap.md`.

- Hardened Phase 10/11 beta and public-launch evidence parsing so proof flags
  are trimmed/case-normalized while non-`true` values remain blocked, launch
  decisions are normalized to `go`/`limited`, and generic signoff placeholders
  like `Tester Name`, `TBD`, or `example.com` emails no longer satisfy named
  signoff gates. The existing Phase 10/11 public-contact smoke now covers
  malformed evidence flags and placeholder signoffs.

- Extended the Phase 10/11 smoke harness to generate beta/public launch packets
  into temporary directories and assert that normalized proof flags, launch
  decisions, and signoffs are written into packet JSON while placeholder
  signoffs are stripped.

- Tightened the Phase 5 device QA evidence validator after smoke testing found
  that slash-only iPhone labels and `Tester Name` style placeholders could
  still pass. Added negative smoke cases for missing physical iOS models,
  generic Android model labels, generic tester signoffs, and case-insensitive
  `PHASE5_QA_SIGNOFF=true` handling.

- Hardened the Phase 5 device QA packet so strict native-device completion
  requires real-looking EAS build UUIDs or `expo.dev` build URLs, physical
  iPhone/iPad and Android device labels with OS versions, and a non-placeholder
  named signoff. Added `phase5:qa-packet-smoke` and wired it into
  `phase5:verify` so placeholder build IDs, generic device labels, and dummy
  signoff names cannot unlock device QA.

- Aligned the Phase 2 live RLS smoke preflight with the shared placeholder
  parser so `pending`, newer blocked placeholders, cased copied examples, and
  `YOUR_*` style Supabase values are rejected before any live connection can
  start. Phase 2 env smoke now covers pending Supabase placeholders explicitly.

- Fixed compact phone polish around the floating bottom tab bar after 320 x 568
  E2E showed the empty Shelf subtitle colliding with its illustration and the
  You tab's third routine row entering the tab-bar zone. The empty Shelf state
  now uses short-screen top spacing, and very short You screens defer lower
  routine rows below the first viewport while 390 px phones still show Retinoid
  ramp above the bar. Evidence is in
  `test-results/human-e2e/2026-07-07/navigation-tabbar/`.

- Hardened Phase 8 growth/store readiness so the check and generated QA packet
  both evaluate process-env public identity values and share the release-grade
  production domain, URL, and support-email validators. Added
  `phase8:check-growth-store-smoke` and wired it into `phase8:verify` to prove
  final-domain, support-email, and store-link impostors stay blocked.

- Aligned the mobile Phase 7 runtime gate with the stricter public-domain rules.
  Production deferred surfaces now require a normalized first-party domain, so
  reserved hosts, credentialed domains, query injection, bare labels, and local
  IP URLs cannot unlock share cards, cloud Ask, trend, community, widgets, or
  goal-active recommendations. Focused Phase 7/growth tests cover the runtime
  domain rejection path.

- Hardened Phase 7 core-loop readiness so final brand domain and policy URLs use
  the shared production validators instead of raw truthiness/example checks. The
  gate now honors process-env overrides, rejects reserved or credentialed public
  identity values, and includes the Consumer Health Data Privacy URL in the
  strict public-policy evidence set. Added `phase7:check-core-loop-smoke` and
  wired it into `phase7:verify`.

- Hardened early infrastructure/catalog env gates against production-shaped
  impostors. Phase 2 now reuses the shared placeholder parser and rejects
  credentialed, reserved, plaintext, non-Supabase, local PostHog, and
  non-production Sentry public values before strict env readiness can pass.
  Phase 4 catalog source identity now requires a production attribution URL,
  production contact email, and production contact inside the Open Beauty Facts
  User-Agent. Focused Phase 2/4 smoke cases cover these regressions.

- Hardened Phase 9 live harness placeholder detection so every live Supabase,
  Edge, public-form, catalog, order-report, RevenueCat, data-rights, and
  consent-withdrawal probe uses the shared placeholder parser. Release smoke now
  blocks local placeholder regexes so pending, mixed-case, and newer placeholder
  values cannot accidentally pass live-evidence preflight checks.
  The RevenueCat live webhook harness also now initializes the shared placeholder
  guard before deriving webhook secret readiness.

- Regenerated Phase 8, Phase 9, Phase 10, and Phase 11 generated readiness
  packets after the public-identity packet builders began normalizing final
  domains, support emails, marketing URLs, and store URLs. The packets remain
  blocked/supporting evidence only until external launch evidence and named
  signoffs are supplied.

- Hardened Sign in with Apple helpers so provider identity tokens, emails,
  Apple subjects, and revocation authorization codes are trimmed and must be
  non-empty before use. Account deletion can no longer try to refresh an Apple
  revocation code for whitespace-only provider identity data, and focused auth
  tests cover malformed provider subjects and blank native return values.

- Hardened Expo native launch config so `EXPO_PUBLIC_FINAL_BRAND_DOMAIN` and
  store URL env values use production URL semantics before they reach native
  metadata. Malformed domains with credentials, query/hash, explicit ports,
  reserved pseudo-domains, placeholders, or unsupported schemes now stay out of
  iOS associated domains, Android App Links, native store URLs, and Expo
  `extra`.

- Hardened Phase 9 release smoke final-contact checks so privacy/terms/support,
  final domain, marketing, support email, and store URLs must be production
  shaped values instead of merely non-placeholder strings. Added a local
  no-network release-contact smoke harness that proves good final contacts pass
  and credentialed, reserved, placeholder, or production-gated public values are
  still rejected.

- Hardened Phase 6 payment readiness so RevenueCat public keys, product IDs,
  webhook auth/signing/secret keys, and policy URLs must be production-shaped
  values before strict payment gates can pass. Added a no-network payments env
  smoke that exercises the strict pass case plus placeholder keys, local product
  IDs, blocked webhook secrets, and malformed policy URLs.

- Hardened Phase 8 public growth domain normalization so reserved pseudo-public
  hostnames like `.localhost`, `.local`, `.test`, `.invalid`, and `.example`
  cannot produce first-party share links or Conflict Card domains. Focused
  growth tests now cover both direct public link creation and card-copy
  fallbacks.

- Hardened public Edge Function environment parsing for the waitlist and growth
  event endpoints. Shared Edge env parsing now normalizes `APP_ENV` /
  `EXPO_PUBLIC_APP_ENV`, fails unknown app environments closed to production,
  and treats malformed `PUBLIC_FORMS_TURNSTILE_REQUIRED` values as
  Turnstile-required instead of silently disabling the public-form abuse gate.

- Hardened client env boolean parsing for native camera, OCR, Phase 7 deferred
  surfaces, and Phase 8 growth toggles. Supported `true`/`false` values now
  tolerate case and whitespace, malformed explicit values fail closed, and the
  documented missing-value default still keeps native camera on for dev/staging
  builds while leaving OCR and deferred launch surfaces off.

- Hardened local Ask, Commerce, Community, and Trend private boolean gates with a
  shared encrypted-storage helper. Existing legacy `true`/`false` consent and
  age-confirmation flags migrate to compact canonical values, malformed flags
  fail closed and repair to off, and repair-write failures do not override an
  already-read local grant/denial decision. Focused store tests cover Ask
  consent, commerce data-sharing consent, community participation/16+ gates,
  and photo-trend-insights consent.

- Hardened public growth/share-card attribution URLs so final-brand domains are
  parsed through URL rules, malformed domains with query/userinfo/protocol tricks
  are rejected, and public growth paths cannot inject query strings or external
  URLs. Focused growth tests cover domain/path rejection and still prove only
  opaque, privacy-safe attribution survives.

- Hardened the neutral age-gate pass flag so known legacy boolean strings migrate
  to canonical encrypted values while malformed local private records are
  rewritten to a failed gate. Failed repair writes no longer override the
  locally read pass/fail decision, and the store still persists only the pass
  flag, never the date of birth, preserving the docs/01 data-minimization
  posture.

- Hardened biometric app-lock preference storage so known legacy boolean strings
  migrate to canonical encrypted values and malformed local private records are
  rewritten to the disabled state instead of being re-read indefinitely. Focused
  app-lock/private-KV tests cover migration, malformed values, repair-write
  failures, read failures, and existing authentication/privacy-shield behavior.

- Hardened local photo consent flags so padded canonical capture/cloud-backup
  values are repaired, noncanonical consent values fail closed, and failed
  repair writes do not override an already-read canonical grant.

- Hardened first-use Progress photo consent so the local-only privacy promise
  also states the backup-off tradeoff before capture. The visible gate and
  hashed consent text now explain that cloud backup is separate and a lost phone
  can mean lost photos when backup is off. Expo web E2E verified the compact
  320x568 consent gate and Not now escape in
  `test-results/human-e2e/2026-07-07/photo-consent-backup-tradeoff/`.

- Hardened encrypted Progress photo storage so malformed content keys are
  rotated, malformed note envelopes return `null`, and malformed photo/share
  envelopes fail with a stable storage error instead of trusting arbitrary JSON
  or hex. Focused regression tests now cover encrypted notes, key rotation,
  share-export ownership, and encrypted storage cleanup.

- Hardened server reverse-trial grants so the one-time grant ledger and Pro
  entitlement mirror are written through a single service-role RPC. A partial
  server failure can no longer consume the user's no-card trial without also
  returning the entitlement, and Phase 6/9 contract checks now pin the atomic
  grant path.

- Hardened subscription entitlement caching so time-boxed trial, intro,
  prepaid, reverse-trial, and app-granted access cannot unlock Pro without a
  valid expiry, and server reverse-trial grants now return the normalized cached
  entitlement.

- Removed the compact Progress photo-paywall compliance spacer that pushed
  `Terms`, `Privacy`, and `Restore` under the floating tab bar at 320x568.
  Human-simulated Expo web evidence now shows those controls clear of the tab
  bar with no non-tab overlap.

- Hardened progress/streak aggregation so malformed server completion dates,
  unsafe local heat-map counts, and invalid server personal-best streak values
  are ignored before they can distort adherence, heat-map, streak, milestone, or
  review-prompt surfaces.

- Hardened the Today completion loop and offline completion queue so impossible
  calendar dates, blank step IDs, duplicate local check-offs, malformed queue
  rows, and invalid enqueue timestamps are normalized or dropped before they can
  distort Today progress, heat-map counts, streak input, or server sync.
  Human-simulated Expo web E2E for Routine Plan First Value also passed at
  320x568: clean direct entry showed the contextual paywall, Explore first
  revealed the example routine, Start today reached Today, and Back recovered to
  You. Evidence is in `test-results/human-e2e/2026-07-07/routine-plan/`.

- Regenerated the Phase 7 core-loop QA packet after the latest route/storage
  changes and added the missing Tas-owned Phase 7 strict-evidence row to
  `docs/FOR_TAS_TO_DO.md`. Non-strict Phase 7 code gates pass; strict launch
  remains blocked on brand, legal/privacy, review, device, RevenueCat, Supabase,
  catalog, beta dashboard, and named signoff evidence.

- Hardened scheduler cycle date storage so cycle anchors and cycle configs reject
  impossible calendar dates, trim padded local dates, de-duplicate skipped nights,
  and persist normalized scheduler state before projection reads it.

- Hardened the Supabase large secure-store wrapper so invalid SecureStore content
  keys must be exactly 32 bytes, bad keys clear both SecureStore and the encrypted
  AsyncStorage session envelope, tampered sessions fail closed, and legacy AES
  sessions still migrate to authenticated storage.

- Hardened lightweight local engagement stores. Ask grounded-turn counters now
  remove malformed records, validate billing periods, and clamp trial counts;
  community reactions, streak milestones, and review-prompt history now remove
  unreadable JSON, normalize duplicates/whitespace, and drop invalid local rows
  before user-facing gates read them.

- Hardened notification preference and sent-ledger storage so unreadable local
  JSON is removed, invalid reminder times/booleans fall back to safe defaults,
  lock-screen discretion remains forced on, and behavioural notification caps
  only count valid notification kinds with finite, non-future timestamps.

- Hardened local onboarding gate state. Health-data consent records now remove
  unreadable or malformed local JSON, and the skin-profile completion gate now
  validates quiz result shape, approved goals, and completion timestamps before
  treating a returning user as onboarded.

- Hardened the local photo metadata store so unreadable photo JSON is removed,
  malformed rows are dropped, valid legacy rows regain safe defaults, and
  encrypted note metadata is re-persisted cleanly before Progress reads it.

- Hardened the local entitlement cache so malformed primary records are removed,
  valid legacy records migrate forward, active access requires a verified source,
  and development-only app-granted trials cannot stay active outside development.

- Hardened recommendation preference and dismissal storage so unreadable JSON is
  removed, invalid or whitespace-padded values are filtered to approved
  recommendation filters, and duplicate `Not for me` records are normalized
  before first-insight ranking reads them.

- Hardened the local Shelf store so unreadable shelf JSON is removed, malformed
  product rows are dropped, and valid legacy rows are normalized before the
  shelf, conflict banner, routine builder, and Today loop read them.

- Hardened local conflict-choice state. Free conflict-check quota records and
  `use together anyway` overrides now remove unreadable JSON, normalize duplicate
  or invalid arrays, and persist clean keys before quota/override decisions run.

- Hardened the local active-ramp store so unreadable ramp JSON is removed and
  mixed-validity ramp logs keep valid product entries while dropping malformed
  ones. A bad ramp record can no longer leak impossible frequencies into the
  scheduler or block future clean seeding.

- Hardened the local scheduler cycle config reader so malformed or wrong-shaped
  stored cycle state is cleared instead of being spread into runtime scheduling.
  Valid legacy partial configs still normalize with default pause/recovery/staging
  fields, preserving first-session handoff compatibility.

- Hardened Today completion persistence and the offline completion sync queue
  against malformed local JSON. Wrong-shaped or unreadable completion records are
  now cleared and treated as empty, then replaced by clean state on the next
  check-off/enqueue. Focused tests cover both recovery paths.

- Hardened the encrypted local private KV reader so a corrupt encrypted envelope
  is removed and treated as missing instead of throwing through shelf, routine,
  completion, or offline-queue callers. Legacy plaintext migration remains
  readable, encrypted roundtrips still hide values, and focused storage/core-loop
  tests cover the corrupt-envelope cleanup path.

- Fixed onboarding Products category chips on 320 x 568 phones. The optional
  category selector now uses a compact horizontal rail, preserving 48 px chip
  targets while keeping the last category from clipping under the fixed footer.
  Expo web evidence is in
  `test-results/human-e2e/2026-07-07/onboarding-products-category-rail/`.

- Aligned the top-level launch/blocker docs with the current RoutineKind
  identity state. `BLOCKERS.md` and `LAUNCH_READINESS.md` now say the app has
  moved off legacy OnSkin defaults locally while production remains blocked
  until counsel, domain/store reservation, and final identity evidence exist.

- Fixed the Ask advisor compact-phone footer so the AI/privacy disclosure no
  longer clips against the bottom edge under the composer on 320 x 568 screens.
  The composer now reserves short-phone bottom spacing, the chat scroll area has
  more end padding, and the route contract guards disclosure visibility. Expo
  web evidence is in
  `test-results/human-e2e/2026-07-07/ask-disclosure-footer-clearance/`.

- Tightened the Ask advisor compact-phone disclosure footer after the direct
  route audit still looked visually cramped. The footer now uses an explicit
  rendered 10 px mono size and a larger short-phone bottom buffer, with post-fix
  Expo web evidence in
  `test-results/human-e2e/2026-07-07/ask-disclosure-footer-polish/`.

- Completed the RoutineKind public identity sweep for local/native launch
  surfaces. Expo defaults, root package identity, Supabase local auth
  placeholders, catalog/commerce/community labels, and brand evidence docs now
  use RoutineKind; `npm run brand:audit:strict` passes with only deliberate
  guard-rail, internal-namespace, and historical-context counts remaining.

- Improved first-use Progress photo consent legibility on compact dark capture
  screens. The `Not now` escape now reads as a clear secondary action on the
  320 px surface, and the privacy footnote/skin-prep guidance no longer use
  near-invisible low-opacity text.

- Reworked unavailable-store copy on subscription paywalls so checkout fallback
  states stay user-facing and polished instead of exposing RevenueCat/setup
  diagnostics. Onboarding, contextual upsells, reverse-trial reoffers, and
  reusable Pro gates now render the message as calm body copy, and the paywall
  flow tree tracks infrastructure-copy leakage as a compact-phone acceptance
  concern.

- Fixed the routine-plan `Start today` handoff so it updates the scheduler cycle
  store before routing to Today, instead of writing only the legacy anchor. The
  CTA now re-anchors an existing cycle to today, clears pause state, removes a
  same-day skip, and preserves older cycle choices. Verified with a 320x568
  human-simulated Expo web pass through onboarding product add -> routine plan
  -> Today PM -> first check-off.

- Fixed compact Today routine rows so normal shelf product names can wrap to two
  lines instead of truncating beside `NEXT`. A 320x568 human-simulated Expo web
  pass reproduced `Final Sweep Clean...` on the PM routine row, then used the
  app's manual shelf flow on the current 8095 bundle to verify the full
  `Final Sweep Cleanser` label, zero horizontal overflow, check-off completion,
  and persistence after navigating away and back.

- Aligned beta/core-loop analytics evidence with emitted app events. Today now
  emits privacy-safe `routine_checkoff_completed` for every completed AM/PM
  step and keeps `first_checkoff_completed` for the first-ever completion. The
  Phase 7 gate now rejects stale dashboard event names and asserts the V1
  product-add, first-insight, routine, check-off, photo, paywall, reverse-trial,
  and purchase event coverage.

- Tightened the lighter floating tab-bar active treatment so the smallest 320 px
  phone viewport keeps a real label-width buffer. The active state now uses a
  calmer raised chip instead of the heavy dark pill, while source contracts and
  Expo web E2E verify one selected tab, zero horizontal overflow, 56 px tab
  height, and about 74.6 px per tab at 320 px.

- Added a dated `RoutineKind` candidate spot-check to the brand evidence packet:
  Apple public app search, Google Play public search, web-indexed App
  Store/Play queries, and DNS did not surface an exact app listing or active
  domain record on 2026-07-07. The docs keep this correctly scoped as screening
  evidence only, not trademark clearance, registrar availability, or store
  reservation.

- Fixed deferred Photo Trend direct-entry copy on 320 x 568 phones. Launch-gated
  `/trend/*` routes still recover to Progress, but the escape CTA now says
  `Back to Progress` instead of generic `Back`, matching the no-history route
  destination. Expo web evidence is in
  `test-results/human-e2e/2026-07-07/trend-routes/`.

## 2026-07-06

- Tightened the production native identity gate so `APP_VARIANT=production`
  requires both recorded brand clearance and explicit final display/slug/scheme
  bundle/package env values before Expo config can resolve. This prevents an
  uncleared working-candidate identity from slipping through simply because it
  no longer matches the legacy `OnSkin` audit pattern. The Phase 2 environment
  checker now mirrors the same final native identity requirement for staging and
  production readiness, with a repeatable `phase2:check-env-smoke` regression
  command for the missing-identity and explicit-identity boundary.

- Updated the Phase 9 privacy payload audit and data inventory to match the
  runtime-branded privacy posture. Lock-screen notification titles are now
  audited against `BRAND.appName`, and the app-switcher shield is documented as
  a neutral app privacy shield instead of a hardcoded legacy brand surface.

- Replaced legacy `OnSkin` wording in Phase 10 beta-facing tester templates
  with the working `RoutineKind` candidate while keeping the final-brand
  clearance caveat. The tester brief and Day 14 survey no longer train beta
  operations around the conflicted public identity.
- Fixed the compact Recommendation preferences budget row after a 320x568 route
  audit found `Premium` half-clipped at the bottom of the viewport. Budget
  options now render as equal-width 48 px compact chips with readable one-line
  labels, while values and texture filters keep the normal wrapped chip layout.
  Human-simulated E2E verified no clipped controls, small targets, horizontal
  overflow, or ellipsized budget labels in
  `test-results/human-e2e/2026-07-06/recommendation-preferences-budget-fit/`.
- Fixed empty Shelf compact-phone horizontal overflow from the bottle
  illustration. On Expo web, `StripedThumb` now uses a single clipped
  repeating-gradient background while native keeps the composed stripe fallback,
  eliminating offscreen transformed child geometry. Added a component contract
  and 320x568 human-simulated E2E evidence in
  `test-results/human-e2e/2026-07-06/shelf-empty-overflow/`; native thumbnail
  rendering still needs simulator/device visual QA.
- Added a production native identity guard for the rebrand path. Expo production
  config now refuses to resolve legacy `OnSkin` app names, schemes, permission
  copy, bundle IDs, or Android package IDs unless
  `BRAND_LEGAL_CLEARANCE=cleared`; development builds still use isolated local
  install identities. Phase 9 store-build inspection records this as a blocker
  instead of crashing, and Phase 5 warns when production EAS profiles do not
  declare final identity keys.
- Added a runtime brand identity module for the working `RoutineKind` rebrand and
  moved high-visibility app copy through it: Pro/paywall labels, Ask labels,
  app-lock prompts and shields, lock-screen notification title, share-card
  watermark/deep link fallback, catalog provenance, commerce paid-link
  disclosures, RevenueCat fallback titles, and Phase 8 public identity. Native
  config now accepts `EXPO_PUBLIC_APP_DISPLAY_NAME` and
  `EXPO_PUBLIC_APP_SCHEME` as fallbacks so runtime and build identity can be
  switched together after final clearance. Product IDs, storage keys, Supabase
  config, and native bundle identifiers intentionally remain for a later
  cleared-identity migration. `npm run brand:audit` now reports 74 public
  launch-risk references, down from 144 before the runtime-copy slice.
- Swept the remaining accessible runtime public-copy brand surfaces that do not
  require a cleared identifier migration: age gate, public share landing,
  catalog search disclosure, settings lock-screen preview, conflict safety
  disclaimer, export dialog, photo-encryption error, store metadata draft, and
  audit-counted comments. Human-simulated E2E checked `/onboarding/age`,
  `/s/[shareId]`, `/shelf/search`, `/settings/timing`, and the local
  reverse-trial route into `/routine/widgets` at 390x844 in
  `test-results/human-e2e/2026-07-06/runtime-brand-public-copy/`; visible
  checked screens show `RoutineKind` and no `OnSkin`. Widgets still show the
  existing deferred native-widget gate until device QA enables that surface.
  `npm run brand:audit` now reports 44 public launch-risk references, down from
  74 before this copy sweep.
- Updated Phase 8 public launch assets for the `RoutineKind` working identity:
  creator disclosure brief, support/review response template, store metadata
  source-of-truth labels, public-site title/landing/share/support/waitlist copy,
  and app-link association templates. The AASA and Android assetlinks templates
  now use explicit final bundle/package placeholders instead of stale
  `com.onskin.app` identifiers. Human-simulated E2E served the static public
  site locally and checked `index.html`, `share.html`, `support.html`, and
  `waitlist.html` at 390x844 in
  `test-results/human-e2e/2026-07-06/phase8-public-site-brand/`. E2E then found
  and fixed the support page's visible `__SUPPORT_EMAIL__` placeholder by
  rendering a human-readable fallback until the final monitored address is
  substituted; post-fix evidence is in
  `test-results/human-e2e/2026-07-06/phase8-public-site-support-placeholder/`.
  `npm run brand:audit` now reports 21 public launch-risk references, down from
  44; the remaining public-risk items require cleared
  native/store/RevenueCat/Supabase identity migration.
- Fixed routine-plan profile-label honesty for the first-value loop. The
  generated routine screen now labels empty-shelf output as `EXAMPLE ROUTINE`,
  derives real plan labels from saved `oily_dry` and `sensitive_resistant`
  profile axes, and falls back to `BUILT FROM YOUR SHELF` instead of fabricating
  dry/sensitive claims. Added pure mapping tests and updated the Routine Plan
  First Value branch in `docs/USER_FLOW_TREE.md`. Human-simulated E2E covered
  320x568 Expo web, the local no-card `Explore first` unlock path, and
  `Start today` handoff in
  `test-results/human-e2e/2026-07-06/routine-plan-profile-label/`.
- Fixed the first-session front-label product-name tagging path after E2E found
  onboarding-entered `Glycolic 7% Toner` was treated as a generic morning toner
  instead of a PM exfoliant. The offline tag layer now recognizes conservative
  label shorthand for common acids, Vitamin C, and SPF before catalog seed.
  Added tag and routine-generation regression tests, then rechecked the
  onboarding product shelf -> `Explore first` -> `/routine/plan` -> Today PM
  check-off path at 320x568. Evidence and bug report are in
  `test-results/human-e2e/2026-07-06/front-label-product-tags/` and
  `docs/e2e-bug-reports/2026-07-06-front-label-product-tags.md`.
- Added production-mode B-DERM-REVIEW regressions for the core routine loop:
  `shippableRules()` now has explicit tests for production withholding, reviewed
  rule pass-through, and dev fixtures; `generatePlan()` now proves its default
  production path does not surface unreviewed retinoid × glycolic guidance while
  still surfacing a reviewed fixture rule. This is a local code gate only; final
  public distribution still needs real reviewer identity and device QA evidence.
- Hardened conflict share-card export failure handling. If the native share
  availability probe or share sheet rejects after the PNG is captured, the helper
  now cleans up the temp image and returns the route's share-unavailable path
  instead of surfacing a card-creation error; capture failures still bubble as
  card-creation failures. Added focused unit coverage for unavailable sharing,
  rejected share sheets, probe failures, cleanup, and capture errors. Native
  share-sheet device QA remains outstanding.
- Hardened Settings data export share rejection handling. If the plaintext JSON
  export is created but the OS share sheet rejects, `exportData()` now deletes the
  cache file and returns the You tab's handled `Export unavailable` path instead
  of surfacing a generic privacy-request failure. Added cleanup/false-return
  regression coverage; native share-sheet device QA remains outstanding.
- Fixed the compact Progress-tab contextual paywall after 320x568 E2E found
  `Terms`, `Privacy`, and `Restore` sitting under the floating tab bar when
  store pricing was unavailable. Compact Progress-tab photo paywalls now require
  a deliberate scroll for the compliance row, and the scrolled controls remain
  48 px tall and clear of the tab bar. Post-fix evidence and bug report are in
  `test-results/human-e2e/2026-07-06/progress-paywall-compact-compliance/` and
  `docs/e2e-bug-reports/2026-07-06-progress-paywall-compliance-tab-overlap.md`;
  native RevenueCat/device QA remains outstanding.
- Made RevenueCat product identifiers config-driven for the rebrand path. Annual,
  monthly, and local reverse-trial IDs now read from public env keys with neutral
  `routinekind_*` development defaults, while strict Phase 6 payments gates warn
  until final App Store/Play/RevenueCat product IDs replace the placeholders.
- Refined the bottom navigation into a stronger premium floating control. The
  selected tab now uses a dark rounded pill with white icon/label contrast,
  stable one-line label fitting, and per-tab test IDs; the old tiny active rail
  was removed. Expo web human-simulated E2E rechecked Today, Progress, Shelf,
  and You at 320x568 plus Today at 390x844 with zero horizontal overflow and
  53.99 px tab hit targets. The same pass found and fixed a You-tab `FOR YOU`
  row overlap at 390x844; `Recommendations` now starts below the first viewport
  instead of under the floating bar. Evidence is under
  `test-results/human-e2e/2026-07-06/navigation-tabbar-floating-refresh/`;
  native iOS/Android Dynamic Type QA remains outstanding.
- Added a value-before-paywall path to contextual Pro gates. First-time free
  users who direct-open `/routine/plan` now see the full-routine paywall with a
  no-card `Explore first` reverse-trial action, while expired/lapsed entitlement
  users remain on the paid re-offer path. Added entitlement eligibility and
  mobile paywall contract tests, plus a direct-entry branch in
  `docs/USER_FLOW_TREE.md`; human-simulated E2E evidence is recorded under
  `test-results/human-e2e/2026-07-06/contextual-routine-explore-first/`.
- Fixed a compact-phone footer overlap on `/routine/plan`: the first 320x568
  viewport now ends on a complete evening card above `Start today`, the SPF gap
  note is reachable by deliberate scroll, and the CTA still routes to Today.
  Evidence and bug report are in
  `test-results/human-e2e/2026-07-06/routine-plan-footer-overlap/` and
  `docs/e2e-bug-reports/2026-07-06-routine-plan-footer-overlap.md`.
- Fixed the compact-phone purchase-success confirmation after E2E found the
  renewal metadata could orphan `yr` on 320 px screens. Success metadata now
  renders as two stable rows inside a constrained container, with an escaped
  checkmark and explicit line height. Added a mobile contract test and verified
  `/paywall/success` at 320x568 in
  `test-results/human-e2e/2026-07-06/paywall-success-metadata-wrap/`.
- Integrated the `04_repo_docs` strategy packet into the active `docs/` tree as
  the master plan, product requirements, architecture, roadmap, feature index,
  decision, testing, code-review, update-patch, and Codex implementation-prompt
  docs. Added `docs/FOR_TAS_TO_DO.md` for founder/account/legal/device/beta
  blockers Codex must not guess, and added
  `docs/rebrand-and-core-loop-migration-checklist.md` to turn the Phase 0
  rebrand and V1 loop plan into executable engineering slices. Wired the new
  docs into `AGENTS.md`, `CLAUDE.md`, and `BLOCKERS.md`.
- Added `scripts/brand-audit.mjs` plus `npm run brand:audit` and
  `npm run brand:audit:strict` so the rebrand migration has an objective
  inventory of remaining public identity references. Non-strict audit currently
  reports 144 public launch-risk references and 52 review-needed references;
  strict mode correctly fails until the brand migration is executed or counsel
  clears `OnSkin`. `apps/mobile/app.config.js` now derives native camera and
  Face ID permission copy from `APP_DISPLAY_NAME`, with optional env overrides,
  so future cleared brands do not require hardcoded native-copy edits. Unset
  local `APP_VARIANT` now resolves to the development install identity instead
  of silently reading production identifiers, with a Vitest contract guarding the
  behavior. Verified with `APP_DISPLAY_NAME=RoutineKind`,
  `npm --workspace apps/mobile run test -- src/lib/appConfig.test.ts`,
  `npm run phase5:check-native-config`, `npm run phase9:store-build-inspect`,
  `npm run typecheck`, `npm run lint`, and `npm test`.
- Added the V1 first-value analytics events from the master plan:
  `routine_created`, `first_useful_insight`, and `conflict_detected`. The
  routine plan screen now emits only privacy-safe source buckets and counts,
  alongside the existing `first_routine_created` event, while the sanitizer test
  rejects product names, rule IDs, and skin-goal payloads. Updated the Phase 10
  beta event schema and fixed the beta analytics audit so it parses only
  `ANALYTICS_ALLOWED_PROP_KEYS` instead of treating event names as property
  keys. Verified with `npm --workspace apps/mobile run test -- src/lib/analytics/track.test.ts`,
  `npm run phase10:beta-analytics-audit`, `npm run typecheck`, `npm run lint`,
  and `npm test`; strict Phase 10 evidence still needs external dashboard and
  privacy-payload proof.
- Ran the non-strict launch gate sweep from Phase 2 through Phase 11 after the
  docs and analytics work. Code gates pass where the repo has local checks, and
  generated packets under `docs/phase-3` through `docs/phase-11` were refreshed
  with current hashes and blocked status. Phase 2, strict Phase 3, native,
  payment, beta, and public-launch gates remain blocked only by external
  identity, environment, counsel/reviewer, production account, dashboard, device,
  store, beta, and named-signoff evidence. Added the exact command-gate evidence
  map to `docs/FOR_TAS_TO_DO.md`.
- Fixed the Phase 6 payments readiness checker after it falsely failed the
  RevenueCat webhook because it only accepted the old unbounded `req.text()`
  pattern. The webhook already uses the safer bounded
  `readLimitedText(req, maxBodyBytes)` path and parses `rawBody` only after
  signature verification, so the checker now validates that implementation.
  Phase 6 baseline now passes; strict mode remains blocked only by brand/legal
  URLs and external RevenueCat/iOS/Android/webhook/finance evidence. Refreshed
  the generated payments QA packet with current hashes.
- Re-ran Phase 5 native readiness after the phone UI sweeps. This Windows
  workspace has no `adb`, Android emulator, or `xcodebuild` available, so real
  iOS/Android simulator/device execution remains device-gated. The non-strict
  native config baseline passed; strict native config correctly fails on the
  intentionally disabled OCR warnings, and strict device QA correctly fails on
  missing iOS/Android build IDs, device names, QA signoff, and signer. Refreshed
  the generated Phase 5 device QA packet with current file hashes while keeping
  physical-device QA blocked until installable builds exist.
- Ran a 59-route compact-phone regression sweep at 320 x 568 after the
  onboarding pass and fixed the remaining You-tab hidden hit-area issue: the
  `Streak & adherence` row could begin behind the floating tab bar while a
  sliver of its touch area remained topmost. Compact You now shows the first
  three routine rows as complete first-viewport actions and moves secondary
  routine links into a lower section that requires deliberate scroll. Final
  human-simulated E2E passed 59/59 direct routes with no horizontal overflow,
  visible small controls, topmost tab-bar overlaps, or filtered console
  warn/error logs in
  `test-results/human-e2e/2026-07-06/compact-phone-route-sweep-final-pass/`.
- Fixed the fresh-phone onboarding path after 320x568 E2E exposed multiple
  short-phone blockers: goals and quiz answers could sit under fixed footers,
  consent copy could bleed behind actions or become unscrollable when clipped
  incorrectly, local placeholder Supabase blocked pre-account health consent,
  consent decline feedback appeared below the fold, and product intake hid the
  add action/confirmation. Onboarding fixed-footer screens now use a clipping
  wrapper with scrollable content, compact OptionCards, local-first health-data
  consent proof with version/hash and private-data cleanup registration, visible
  consent feedback, and a compact product footer that adds first then continues.
  Human-simulated E2E covered welcome, invalid/underage age gate, goals, consent
  decline/agree, quiz including None exclusivity, product add/remove, reveal,
  notifications/account fallbacks, paywall disclosure scroll, and Explore first
  to routine plan in
  `test-results/human-e2e/2026-07-06/onboarding-fresh-phone-sweep/`.
- Final cross-phone sweep found and fixed two remaining phone-polish issues in
  the primary navigation slice. Shelf manual add now gives the bottom Continue
  CTA a real phone cushion while keeping the category picker and PAO note clean
  at 320 x 568. Today now treats sub-700 px heights as compact so the Tonight
  teaser does not peek as a fragment behind the floating tab bar at 360 x 640,
  while 390 x 844 still shows the full teaser. Human-simulated E2E covered
  320/360/390 px tab geometry, Today/Progress/Shelf/You switching, You bottom
  scroll, and manual-add -> opened-date handoff in
  `test-results/human-e2e/2026-07-06/final-cross-phone-sweep/`.
- Polished the floating bottom tab bar and Today clearance on phone widths after
  320x568 E2E showed the longest tab label had no practical text slack and the
  compact SPF prompt crowded the floating bar shadow. The tab bar now uses more
  usable horizontal width, tighter one-line label typography, and stable 52 px
  tab targets; Today uses the compact contextual recommendation prompt through
  standard phone heights with a shorter display title. E2E rechecked 320 px and
  390 px tab geometry, Today/Progress screenshots, and Today -> Progress ->
  Shelf -> You tab switching in
  `test-results/human-e2e/2026-07-06/navigation-tabbar-polish/`.
- Fixed the Shelf manual-add category picker on 320x568 phones after E2E showed
  lower picker rows could sit under the fixed Continue footer and hit-test to the
  footer instead of the visible option. The manual add scroll view now reserves
  picker-aware bottom space, category rows have stable 48 px targets, and the
  compact collapsed category field stays one-line with an "Other" display label
  for the catch-all category. E2E rechecked opening the picker, scrolling to the
  lower options, selecting "Something else", and validating no small controls,
  clipped text, or bad visible hit targets in
  `test-results/human-e2e/2026-07-06/shelf-add-phone-sweep/`.
- Fixed the Ask OnSkin empty-shelf conflict reassurance after 320x568 E2E showed a
  typed retinol/glycolic question on `/ask` replying that nothing on the shelf
  clashed even though there were no shelf products to check. The
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

Fixed `/onboarding/goals` after a 320 x 568 phone E2E pass showed the fixed `Continue` footer covering lower goal
cards. The goals route now uses explicit scroll flexing, short-phone-only card density, and bottom clearance so the
visible options stay complete above the footer while the final option remains reachable by normal scroll. The products
onboarding route received the same footer separation treatment, and route/component contracts now cover the compact
card behavior. Human-simulated E2E verified the visible-card geometry, scrolled to `Barrier repair`, selected it, and
continued to `/onboarding/consent` in
`test-results/human-e2e/2026-07-06/onboarding-goals-footer-clearance/`.

### Today compact routine copy polish (2026-07-06)

Fixed the compact Today habit card after a 320 x 568 phone E2E pass showed routine instruction copy rendering with
visual ellipses inside the Morning routine rows. Compact phone rows now use concise display-only instruction variants
while preserving the generated plan data and full copy on larger phones. Human-simulated E2E verified complete compact
copy (`Clean base first.`, `Under your SPF.`, `Seal it in.`), no horizontal overflow, and preserved SPF prompt/tab-bar
clearance at 320 x 568, plus no truncation at 360 x 640, in
`test-results/human-e2e/2026-07-06/navigation-final-sweep/`.

### You tab first-viewport clearance (2026-07-06)

Fixed the compact You tab after a 320 x 568 phone E2E pass showed lower routine navigation rows entering the floating
tab bar zone on first load. Phone-width account, subscription, and routine cards now use tighter compact margins and
padding while preserving 48 px row targets. Human-simulated E2E verified `Retinoid ramp` is complete and tappable above
the tab bar at 320 x 568, the full routine card is visible at 390 x 844, covered lower rows do not receive accidental
hits, and normal scroll reveals `Streak & adherence`, `Weekly check-in`, and `Recent changes` as full 48 px targets in
`test-results/human-e2e/2026-07-06/you-first-viewport-tab-clearance/`.

### Progress contextual paywall clearance (2026-07-06)

Fixed the compact Progress contextual paywall after a 320 x 568 phone E2E pass showed the fixed `Start free trial`
action overlapping the annual price card. `ProGate` now uses a short-phone compact layout and keeps the CTA plus
Terms/Privacy/Restore controls in the scroll flow, preserving 44+ px controls above the floating tab bar. Human-simulated
E2E verified the repaired 320 x 568 Progress paywall, the 390 x 844 Progress paywall, and Shelf at 390 x 844 with no
small controls, clipped text, horizontal overflow, or tab-bar overlap in
`test-results/human-e2e/2026-07-06/shelf-progress-phone-sweep/`.

### Phase 7 core-loop readiness checker (2026-07-06)

Fixed the Phase 7 core-loop gate after it still required the whole Ask route group to be cloud-gated and missed the
existing Today compact-phone condition. The checker now enforces the current launch contract: deterministic `/ask`
stays reachable, `/ask/consent` is deferred behind `phase7Flags.cloudAsk`, and the Today Ask teaser remains hidden unless
cloud Ask is enabled. Regenerated the Phase 7 QA packet and verified `npm run phase7:verify` passes. Strict Phase 7 still
fails only on external launch evidence, final production URLs, placeholder privacy/legal copy, and review-owner warnings.

### Phase 8 growth/store readiness refresh (2026-07-06)

Refreshed the Phase 8 growth/store QA packet against the current source hashes and re-ran the readiness gate. `npm run
phase8:verify` passes with no code blockers. Strict Phase 8 intentionally still fails on external production evidence:
final brand/domain, marketing and store URLs, device App Link/Universal Link proof, share-card QA, privacy attribution
review, creator/support approvals, launch dashboard readiness, release certificate fingerprints, and named signoff.

### Onboarding product input compact copy (2026-07-06)

Fixed `/onboarding/products` after a 320 x 568 phone E2E pass showed the product-name placeholder truncating inside the
input. The placeholder now uses shorter front-label copy that fits on compact iOS/Android phone widths while still
communicating the expected product-name entry. The onboarding route contract now guards against restoring the longer
compact-breaking placeholder.

### Shelf opened-date direct-entry guard (2026-07-07)

Fixed `/shelf/opened` after the direct-entry shelf audit found the opened-date sheet could be reached without an intake
draft and then save a generic `Product` row. The route now shows a recovery sheet with a 48 px `Add by hand` action and
visible Close control when product details are missing, and the save path refuses blank draft names before writing to
the shelf. The Shelf route contract now guards against restoring the generic fallback name.

### Progress paywall Explore first clearance (2026-07-07)

Fixed the compact `/progress` contextual photo-timeline paywall after a 320 x 568 phone E2E pass showed the no-card
`Explore first` reverse-trial card partially hidden under the floating tab bar. The Progress-specific compact paywall
variant now removes decorative chrome, tightens spacing, keeps 48 px primary and reverse-trial actions, and preserves
extra scroll room for Terms, Privacy, and Restore. Human E2E verified the first viewport and scrolled compliance branch
with no horizontal overflow.

### Routine sparse shelf honesty (2026-07-07)

Fixed `/routine/plan` and Today PM for a one-product daytime shelf after the generated plan correctly had no PM cycle
but the UI still presented skin-cycling/recovery copy. The plan now labels evening as plain `Evening` unless a real
cycle exists, renders real PM steps or an explicit no-night-steps state, and avoids fake `Recover` / `ceramide only`
guidance. Today hides cycle week affordances when `useCycle()` has no cycle and shows the same empty evening state
instead of `0 of 0`. Human E2E verified the Expo web flow with only `Mineral SPF 50`; the captured run artifacts are in
`test-results/human-e2e/2026-07-07/routine-plan-sparse-shelf/`, with native phone visual verification still outstanding.

### Routine cadence production review gate (2026-07-07)

Added a shared `B-DERM-REVIEW` gate for cycle cadence and ramp-frequency guidance. Development builds still exercise the
cycle/ramp fixtures, but production builds now withhold unreviewed cycle templates, cycling-night assignments, scheduler
cycles, and initial ramp states until the routine cadence rules are reviewed. Focused routine, scheduler, and conflict
claim-safety tests pin the production default. Follow-up route hardening now gates the cycle week, settings, and
why-tonight surfaces themselves in non-dev builds; production-mode Expo web E2E evidence is in
`test-results/human-e2e/2026-07-07/cycle-cadence-review-gate/`.

### Settings privacy direct-entry anchor (2026-07-07)

Fixed `/settings/privacy` after a 320 x 568 phone E2E pass showed the direct privacy entry reaching the You tab above the
privacy controls. The alias now redirects with `section=privacy`, and the You tab measures the real `PRIVACY & CONSENT`
card before scrolling it into view. The settings route contract now guards against anchoring to Security or Reminders by
mistake. Expo web E2E verified direct entry, visible privacy controls, a privacy row tap, and browser Back recovery in
`test-results/human-e2e/2026-07-07/settings-privacy-direct-entry/`.

### Progress direct paywall dismissal fallback (2026-07-07)

Fixed direct-entry contextual paywall dismissal after the Progress photo route audit found generic no-history paywalls
fell back to Today. Contextual Pro gates now keep feature-specific no-history fallbacks: photo timeline paywalls recover
to Progress, conflict-check paywalls recover to Shelf, and generic paywalls still recover to Today. Focused tests pin the
fallback mapping, and Expo web E2E verified `/progress/capture` at 320 x 568 dismisses to `/progress` with the Progress
tab selected. Evidence is in `test-results/human-e2e/2026-07-07/navigation-next-audit/`.

### Share conflict deferred CTA destination (2026-07-07)

Fixed the launch-gated `/share/conflict/[ruleId]` direct-entry state after the compact phone E2E pass showed the
deferred share-card escape action used generic `Back` copy even though the no-history fallback is Shelf. Deferred
surfaces now allow a route-specific fallback label, and the share-conflict route says `Back to Shelf` while still
recovering through `APP_SHELF_ROUTE`. Expo web E2E verified the 320 x 568 route has one accessible `Back to Shelf`
button, zero horizontal overflow, and lands on `/shelf` after tap. Evidence is in
`test-results/human-e2e/2026-07-07/conflict-routes/`.

### Recommendation detail compact explanation table (2026-07-07)

Fixed `/recommendations/[id]` after the compact phone E2E pass showed the `HOW WE DECIDED` key column wrapping
`evidence` into a broken two-line label. The recommendation detail key column is now non-shrinking, wide enough for the
longest shipped key, and pinned to one line while explanation values still wrap. Expo web E2E verified the direct For
You hub, preferences, stale detail recovery, and the fixed `gap:mineral_spf` detail at 320 x 568 with no horizontal
overflow, no small targets, and unique `Add to shelf` / `Not for me` actions. Evidence is in
`test-results/human-e2e/2026-07-07/recommendations-direct-entry/`.

### Commerce deferred direct-entry CTA destination (2026-07-07)

Fixed launch-gated commerce direct entry after `/commerce/stacks` at 320 x 568 showed a generic `Back` CTA even though
the safe no-history fallback is the You tab. The commerce layout now passes `Back to You` into the shared deferred
surface while preserving `APP_YOU_ROUTE`. Expo web E2E verified the direct route exposes one accessible `Back to You`
button, has no small/clipped controls or horizontal overflow, and lands on `/you` after tap. Evidence is in
`test-results/human-e2e/2026-07-07/commerce-routes/`.

### Native identity env parsing hardening (2026-07-07)

Hardened `apps/mobile/app.config.js` so `APP_VARIANT` and `EXPO_PUBLIC_APP_ENV` are trimmed, lowercased, and validated
before native identity is resolved. Blank or unknown variants now fail fast instead of accidentally inheriting the base
identity, and whitespace/case around `production` still triggers the production brand-clearance and final-identity
requirements. Phase 2 env smoke now normalizes case/whitespace before staging/production identity checks, and Phase 9
release smoke pins the app-config parser. This was a non-UI launch-gate slice, so human E2E was not required.

### Ask grounded-turn counter hardening (2026-07-07)

Wired the dormant cloud-grounded Ask answer branch to record a grounded turn and invalidate the local per-period gate
query before future cloud Ask can rely on the trial cap. No current code path returns a grounded answer before
B-AI-ASSISTANT-VENDOR, so this is behavior-neutral today, but it removes the dropped-wire risk when the cloud layer
ships. Focused Ask contract/store/gate tests and the full mobile suite pin the counter path.

### Env placeholder detection hardening (2026-07-07)

Hardened Phase 2 and Phase 4 env gates so copied placeholder values are detected case-insensitively. Strict Phase 2 now
fails unsupported `EXPO_PUBLIC_APP_ENV` values instead of warning, and strict Phase 4 rejects uppercase placeholder URLs
and legacy-brand casing variants in catalog source identity values. Added Phase 2 and Phase 4 smoke coverage for those
cases, and wired the Phase 4 smoke into `phase4:verify`. The real final policy URLs, catalog attribution URL, source
contact email, and app/source identity values remain external blockers for Tas.

### Supabase RLS smoke env guard hardening (2026-07-07)

Hardened `phase2:rls-smoke` so Supabase URL/key placeholders are rejected case-insensitively before any live client work
can start. The Phase 2 smoke runner now covers this with cased Supabase placeholders in an isolated no-network failure
case. Real staging/production RLS evidence remains blocked on Tas-created Supabase projects and credentials.

### Share-card public domain normalization (2026-07-07)

Switched the Shelf Conflict Card public handle/share URL to the shared Phase 8 public-domain normalizer. The card now
falls back to the local brand placeholder for `example.com`, localhost, credential-style hosts, or malformed domains
instead of composing a public-looking share URL from them. Focused growth card-copy tests pin valid first-party domains,
malformed host fallback, and share URL consistency. This was non-UI logic hardening, so no human E2E was required.

### Phase 8 public contact readiness hardening (2026-07-07)

Hardened Phase 8 marketing, App Store, and Play Store URL readiness so public links/review/paid-measurement gates only
treat safe HTTPS URLs on public hostnames as production-ready. Placeholder domains, localhost/private-style hosts,
embedded credentials, plaintext HTTP, and malformed strings now fail closed. Support email readiness now also rejects
placeholder and local domains, so `support@example.com` cannot unlock creator-link readiness. Added focused Phase 8
public contact readiness tests; external final-domain/store/support evidence remains blocked for Tas.

### Conflict-choice local key normalization (2026-07-07)

Hardened local conflict-choice storage so padded persisted rule IDs/override keys normalize to the canonical conflict
identity before free conflict-check quota or `use together anyway` decisions read them. Blank direct writes are ignored,
and focused quota/override tests pin padded legacy rows, duplicate repair, and clean persisted state. This was
non-visual local storage hardening, so human E2E was not required.

### Phase 10/11 public contact gate hardening (2026-07-07)

Hardened late beta and public launch readiness checks so final policy URLs, marketing URLs, store URLs, final domain,
and support email must be production-shaped public values rather than merely non-placeholder strings. Added a no-network
Phase 10/11 public-contact smoke that exercises the real readiness scripts against valid production contacts,
reserved domains, embedded credentials, plaintext store URLs, and placeholder/local support emails. Strict beta/public
launch remains blocked on Tas-owned final URLs, store links, support inbox, evidence, generated packet readiness, and
named signoff.

### Public growth domain reserve-suffix hardening (2026-07-07)

Aligned runtime public growth-domain normalization with the stricter launch gates. Share/deep-link URLs and conflict
card handles now reject reserved `.local`, `.test`, `.invalid`, and `.example` hostnames instead of composing public
links from local or documentation-only domains. Focused growth attribution/card-copy tests and the Phase 8 readiness
check pass; final production domain and app-link evidence remain external blockers for Tas.

### Phase 6 payment env readiness hardening (2026-07-07)

Hardened the payments/entitlements readiness gate so strict production payment exit cannot pass with copied RevenueCat
placeholders, local `routinekind_*_dev` product IDs, blocked webhook secrets, or malformed policy/support URLs. The
checker now accepts process-env overrides for CI/staging evidence, validates `appl_` and `goog_` RevenueCat public keys,
requires final product-ID shape, and reuses the shared production HTTPS URL guard. Added a no-network
`phase6:check-payments-env-smoke` and wired it into `phase6:verify`; real RevenueCat dashboard keys, products, webhook
secrets, store restore evidence, finance signoff, and named signoff remain Tas-owned blockers.

### Reverse-trial subscription settings trust fix (2026-07-07)

Fixed active app-granted reverse-trial subscription settings so the keep-Pro row stays inside the app instead of opening
OS subscription management. The settings note now states that no card is on file and avoids App Store cancellation copy
for the no-card trial. The keep-options paywall now renders active reverse-trial copy separately from the expired
re-offer. Added settings/paywall contract tests and ran Expo web human E2E at 390x844 and 320x568 with evidence under
`test-results/human-e2e/2026-07-07/settings-subscription-reverse-trial/`. Native iOS/Android billing handoff QA remains
required before store submission.

### Routine plan first insight (2026-07-07)

Added a generated-plan first insight block near the top of `/routine/plan` so the first-session value moment is visible,
not only tracked in analytics. The copy helper prioritizes example-state disclosure, actionable timing conflicts,
reassuring compatible pairings, missing-step gaps, cadence, then start-ready fallback without exposing product names or
rule IDs. Focused unit and route-contract coverage pins the claim-safe copy order. Expo web human E2E at 320 x 568
covered empty-shelf example disclosure, onboarding product add for retinol/glycolic/SPF, the real-shelf `Timing handled`
plan insight, Start Today, and first check-off under
`test-results/human-e2e/2026-07-07/routine-plan-first-insight/`.

### Ask compact answer labels (2026-07-07)

Fixed `/ask` answer triad labels on 320px phones so `WHAT`, `WHY`, and `HOW` stay readable instead of wrapping into
stacked letters. Added route-contract coverage for the compact label sizing and captured Expo web evidence at 320x568
and 390x844 under `test-results/human-e2e/2026-07-07/ask-compact-composer/`.

### Reviewed-rule gate hardening (2026-07-07)

Tightened the B-DERM-REVIEW production gate so blank or whitespace-only reviewer metadata cannot unlock conflict rules
or share-card eligibility. The same reviewed-rule predicate now backs `shippableRules()` and Phase 7 conflict-card
eligibility, with focused tests covering whitespace reviewer rows.

### Test Store entitlement cache hardening (2026-07-07)

Hardened the subscription entitlement cache so a RevenueCat Test Store entitlement cannot remain active when the app
environment is production. This complements the existing production guard against Test Store keys and prevents a stale
local test entitlement from unlocking Pro in a release build. Added a subscription store regression test; real RevenueCat
sandbox/production restore evidence remains blocked on store products and credentials.

### Floating tab bar premium refresh (2026-07-07)

Refined the primary bottom tab bar toward the requested Wealthsimple-like floating treatment: the selected tab now uses a
dark high-contrast pill with white active icon/label colors, and compact phone side margins are tighter so each tab has
more breathing room at 320 px. Updated navigation contract coverage and captured Expo web human E2E screenshots/geometry
at 320x568 and 390x844 under `test-results/human-e2e/2026-07-07/navigation-tabbar-wealthsimple-refresh/`.

### Paywall loading-price fail-closed hardening (2026-07-07)

Hardened subscription price display so purchase-capable paywalls do not show hardcoded annual/monthly fallback prices
while RevenueCat offerings are still unresolved. The UI now withholds slash-period pricing until an explicit available
or development-fallback offering exists, preserving preview pricing only with the disabled-store reason. Focused
subscription price/paywall/RevenueCat tests pass. Real store pricing, purchase, restore, and billing evidence remain
blocked on RevenueCat/store setup.

### Brand-safe privacy cache filenames (2026-07-07)

Moved generated data-export JSON files and decrypted photo-share cache files off legacy `onskin-*` names to runtime
brand-safe prefixes while preserving cleanup for both current `routinekind-*` and legacy `onskin-*` cache files.
Updated Phase 9 data-rights and privacy-payload smoke checks so generated plaintext/share artifacts must use current
brand prefixes and old cache files are only retained as cleanup targets. Focused data-rights, local-cleanup, photo
encryption, and Phase 9 smoke/audit checks pass; live data export/delete and observability payload evidence remain
Tas-owned external blockers.

### Paywall event taxonomy docs alignment (2026-07-07)

Aligned the master plan and Codex implementation prompt with the emitted/guarded paywall event name `paywall_shown`.
This avoids future duplicate analytics work around the previous mismatched name while preserving the existing Phase 7
and Phase 10 beta funnel taxonomy.

### Shelf barcode no-match recovery (2026-07-07)

Added Search catalog as a first-class recovery action on `/shelf/no-match`, alongside OCR and manual add, so a barcode
miss does not force users into the slower manual path when a name or brand search is more natural. The recovery tracks
the new privacy-safe `miss_search` source and routes through the existing catalog search intake draft. Expo web human
E2E at 320 x 568 covered the no-match sheet and all three fallback routes under
`test-results/human-e2e/2026-07-07/shelf-no-match-search-fallback/`; native camera barcode-miss verification remains a
device-harness follow-up.

### Shelf search offline copy cleanup (2026-07-07)

Replaced implementation-facing `backend` wording in the `/shelf/search` unavailable-catalog state with product-catalog
copy that a user can understand. Expo web human E2E at 320 x 568 verified a `retinol` search shows the catalog message,
does not expose `backend`, keeps Add by hand visible, and has no horizontal overflow. Evidence is in
`test-results/human-e2e/2026-07-07/shelf-search-offline-copy/`; live catalog error behavior still needs staging
Supabase/catalog evidence.

### Progress capture pre-consent gating (2026-07-07)

Stopped `/progress/capture` from rendering capture-frame labels, shutter copy, or camera-preview chrome before
`photo_capture` consent is saved. The route now returns the consent/loading gate before the capture shell and keeps
`canShowCamera` behind `consented === true`, preserving the local-only privacy promise for DOM/a11y users as well as
the visible UI. Expo web human E2E at 320 x 568 reproduced the pre-fix shell text leak and verified an empty leaked-term
set after the fix under `test-results/human-e2e/2026-07-07/progress-capture-preconsent-shell-leak/`; native camera
permission sequencing remains a device-harness follow-up.

### Shelf manual category picker footer clearance (2026-07-07)

Capped the `/shelf/manual` category picker to four 48 px rows and made the category list internally scrollable, so the
fixed Continue footer no longer covers picker options on 320 x 568 phones. Expo web human E2E reproduced the pre-fix
overlap, verified the picker/footer gap and inner scroll to `Something else`, then confirmed Continue still advances to
the opened-date sheet. Evidence is in
`test-results/human-e2e/2026-07-07/shelf-manual-category-picker-footer-overlap/`; native nested-scroll feel remains a
Phase 5 device-QA follow-up.

### Shared sheet modal semantics (2026-07-07)

Added explicit modal semantics to the shared `Sheet` component: native `accessibilityViewIsModal`, web
`role="dialog"`, and `aria-modal`. Expo web human E2E at 320 x 568 verified `/shelf/no-match` still exposes the compact
Close, Search catalog, OCR, and manual fallback actions, the sheet container renders as a modal dialog, and Close returns
to `/shelf` with no lingering dialog. Evidence is in
`test-results/human-e2e/2026-07-07/shared-sheet-dialog-semantics/`; physical screen-reader traversal remains a Phase 5
device-QA follow-up.

### Conflict missing-route recovery (2026-07-07)

Recovered stale `/conflict/[ruleId]` direct-entry routes as a real core-loop recovery state instead of a close-only
fallback. The detail sheet now says the timing note is no longer active, explains that old links never reuse stale
routine advice, routes Back to Shelf via `APP_SHELF_ROUTE`, and offers Add a product into `/shelf/manual`. Route-contract
coverage pins the copy and destinations. Expo web human E2E at 320 x 568 verified the stale state, Back to Shelf,
Add a product, no horizontal overflow, and only known local Supabase/web-notification warnings under
`test-results/human-e2e/2026-07-07/conflict-missing-detail-recovery/`. Tracked in
`docs/e2e-bug-reports/2026-07-07-conflict-missing-detail-recovery.md`.

### Shelf replenish missing-route recovery (2026-07-07)

Recovered stale `/shelf/replenish?id=...` direct-entry routes as a real Shelf recovery state instead of a close-only
fallback. The sheet now says the replacement prompt is no longer active, avoids reusing stale freshness or shopping
prompts for a removed product, routes Back to Shelf via `APP_SHELF_ROUTE`, and offers Add a product into
`/shelf/manual`. Route-contract coverage pins the copy and destinations. Expo web human E2E at 320 x 568 verified the
stale state, Back to Shelf, Add a product, no horizontal overflow, 56 px recovery buttons, and only known local
Supabase/web-notification warnings under
`test-results/human-e2e/2026-07-07/shelf-replenish-missing-product-recovery/`. Tracked in
`docs/e2e-bug-reports/2026-07-07-shelf-replenish-missing-product-recovery.md`.

### Commerce missing-stack recovery source (2026-07-07)

Recovered the commerce-enabled `/commerce/stack/[slug]` missing-stack branch as a real route body instead of a one-line
empty state. The hidden route body now uses compact-phone sizing, a visual placeholder, `Stack unavailable` copy,
disclosure/product-availability review context, `Back to stacks`, and `How paid links work`. Expo web human E2E at
320 x 568 with `EXPO_PUBLIC_PHASE7_COMMERCE_ENABLED=true` and a final-domain fixture verified the missing-stack state,
no horizontal overflow, no clipped/sub-44 px controls, `Back to stacks` routing to `/commerce/stacks`, and
`How paid links work` routing to `/commerce/transparency`. Default beta runtime still defers commerce without those
flags. Tracked in `docs/e2e-bug-reports/2026-07-07-commerce-missing-stack-recovery.md`; evidence is in
`test-results/human-e2e/2026-07-07/commerce-missing-stack-recovery/`.

### Settings privacy direct-entry tab-bar overlap (2026-07-07)

Fixed `/settings/privacy` on compact phones after Expo web E2E showed the route correctly redirected to
`/you?section=privacy` but left policy rows straddling the floating tab bar at 320 x 568 and 390 x 568. The You-tab
privacy direct entry now uses width-aware positive scroll nudges plus a retry after layout settles, preserving visible
privacy controls while keeping lower policy rows from crossing the tab-bar touch zone. Route-contract coverage pins the
compact and narrow nudge values plus the retry. Expo web E2E also verified direct-entry Back recovery for
`/settings/subscription`, `/settings/notifications`, and `/settings/timing`. Final 320 x 568 and 390 x 568 evidence is
in `test-results/human-e2e/2026-07-07/settings-direct-entry-privacy/`; tracked in
`docs/e2e-bug-reports/2026-07-07-settings-privacy-direct-tabbar-underlap.md`. Native screen-reader/device rendering
remains a Phase 5 QA follow-up.

### Shelf search manual fallback buffer (2026-07-07)

Buffered the direct `/shelf/search` manual fallback farther above compact phone bottom chrome after Expo web E2E showed
`Add by hand` had only a 16 px bottom gap on a 320 x 568 viewport. The footer now uses a 32 px bottom cushion, and the
Shelf route contract pins that spacing. Post-fix Expo web E2E at 320 x 568 and 390 x 568 verified `/shelf/search`
renders with zero horizontal overflow, keeps `Add by hand` 32 px above the bottom edge, and routes the fallback to
`/shelf/manual`; the broader Shelf direct-entry sweep also verified add/manual/OCR/scan/no-match/opened/archive/stale
detail/stale replenish recovery paths. Evidence is in
`test-results/human-e2e/2026-07-07/shelf-search-manual-fallback-buffer/`; tracked in
`docs/e2e-bug-reports/2026-07-07-bottom-edge-action-buffer.md`. Native iOS/Android gesture-area rendering remains a
device QA follow-up.

### Runtime brand identity smoke (2026-07-07)

Verified the working `RoutineKind` runtime identity on high-visibility app
surfaces without changing app code. Expo web human E2E at 320 x 568 opened
`/ask`, `/paywall/upsell?feature=full_routine`, and
`/settings/subscription`; visible copy rendered `Ask RoutineKind`,
`Part of RoutineKind Pro.`, and `RoutineKind Pro`, with no visible `OnSkin`
labels and no browser console errors. `npm run brand:audit:strict` reports zero
public-launch-risk and zero review-needed references. Evidence is in
`test-results/human-e2e/2026-07-07/runtime-brand-identity/`. This closes only
the local runtime-copy smoke for the working identity; final brand/legal
clearance, native identifiers, store listings, final domain, and share-card
device QA remain founder/vendor/legal launch blockers.

### Public-copy smoke evidence (2026-07-08)

Verified the working `RoutineKind` public-copy smoke without changing app code.
Codex in-app browser Expo web at 320 x 568 opened `/onboarding/age`,
`/s/sharecard01`, `/shelf/search`, `/settings/timing`, and free
`/routine/widgets` before and after tapping `Explore first. 7 days of Pro`.
Age gate, public share landing, catalog search, timing lock-screen preview, and
the widgets paywall show `RoutineKind`; all six captured states show no visible
`OnSkin`. The no-card Pro week reaches the widgets deferred surface
(`Widgets are not in this beta` / `Back to Today`), visible controls are
48 px+, horizontal overflow is zero, and current-origin browser warn/error logs
are empty. Evidence and report are in
`test-results/human-e2e/2026-07-08/public-copy-smoke-current/`. This does not
replace final trademark clearance, store listings, native identifiers, final
domain, Universal Links/App Links, or device QA.

### Trend route recovery evidence (2026-07-07)

Verified the photo Trend route gate in both default-deferred and enabled local
fixture modes without changing app code. Default Expo web at 320 x 568 opens
`/trend/optin` and `/trend/fairness` to the deferred Trend surface, shows
`Back to Progress`, and returns both direct entries to `/progress`. A temporary
Trend-enabled web server on port 8125 with
`EXPO_PUBLIC_E2E_TREND_CONSENT_LEDGER=local_only` verified the opt-in switch
starts off, toggles on and off, the fairness link is reachable after scroll as a
48 px control, fairness opens with the redness/fairness guard copy, direct
fairness returns to `/trend/optin`, and direct opt-in returns to `/progress`.
Evidence is in `test-results/human-e2e/2026-07-07/trend-routes-current/`. Native
photo/toggle QA, live authenticated consent-ledger/RLS proof, fairness
validation, and final legal consent-copy review remain external launch blockers.

### Conflict/share route recovery evidence (2026-07-07)

Verified missing conflict and unshareable share-card recovery without changing
app code. Expo web human E2E at 320 x 568 opened
`/conflict/missing-rule-e2e`, confirmed the stale timing-note copy and stale
routine-advice warning, returned `Back to Shelf` to `/shelf`, and opened the
`Add a product` escape hatch to `/shelf/manual`. Default
`/share/conflict/missing-rule-e2e` showed the launch-gated share-card fallback,
returned to `/shelf`, and exposed no private shelf details. A temporary
share-card-enabled web server on port 8126 verified the unshareable reviewed-card
state, disabled `Share to Stories`, and returned `Done` to `/shelf`, again with
no private product names, no horizontal overflow, and no browser console errors.
Evidence is in
`test-results/human-e2e/2026-07-07/conflict-share-routes-current/`. This covers
direct-entry missing/unshareable recovery only; real reviewed conflict choice
persistence, native share-sheet export, public-link domain QA, and reviewed rule
content remain launch blockers.

### Commerce route and consent recovery evidence (2026-07-07)

Verified commerce trust surfaces without changing app code. Default Expo web at
320 x 568 opened `/commerce/stacks`, `/commerce/transparency`,
`/commerce/consent`, and `/commerce/stack/sensitive-skin-starter-set` to the
deferred commerce beta surface; every direct entry showed `Back to You`, returned
to `/you`, had zero horizontal overflow, and logged no browser errors. A
temporary commerce-enabled web server on port 8127 with
`EXPO_PUBLIC_FINAL_BRAND_DOMAIN=https://routinekind.app` verified direct
transparency/stacks/consent recovery, stack-detail recovery to
`/commerce/stacks`, stack-list to detail to transparency hierarchy, unavailable
stack recovery, recommendation where-to-buy locking with commerce consent off,
separate consent-sheet entry, `Allow` returning to the originating
recommendation, the catalog-blocked empty state after consent, the shelf
alternative to `/shelf/manual`, and stack-item consent gating. Evidence is in
`test-results/human-e2e/2026-07-07/commerce-routes-current/`. Real retailer link
handoff/failure QA, native modal/outbound-link QA, ShopMy or fallback affiliate
partner approval, source-cleared catalog links, final paid-link consent/legal
copy, and production domain verification remain launch blockers.

### Pro route gating evidence (2026-07-07)

Verified representative Pro route locking and local reverse-trial unlocking in a
fresh Chrome context at 320 x 568 without changing app code. Fresh free state
opened `/routine/widgets`, `/cycle/settings`, and `/routine/plan` directly and
showed the correct contextual paywalls with `Maybe later`, store-unavailable
fallback copy, `Explore first. 7 days of Pro`, Terms/Privacy/Restore controls,
zero horizontal overflow, and no browser console errors. Starting the no-card
reverse trial from `/routine/plan` unlocked the routine plan, direct
`/cycle/settings` rendered the scheduler settings surface instead of the
scheduler paywall, and `/routine/widgets` reached the widget deferred surface
with `Back to Today` instead of the reminders/widgets paywall. The compact
`/paywall/success` route rendered the renewal metadata and `See tonight's
routine` CTA cleanly; direct `/paywall/upsell?feature=full_routine` dismissed
with `Maybe later` to `/today`. Evidence is in
`test-results/human-e2e/2026-07-07/pro-gating-current/`. This does not replace
RevenueCat purchase/restore/native store-sheet QA, conflict-check quota gating,
loading-state no-flash tracing, policy/billing link handoff failure QA, or native
iOS/Android scheduler/widget QA.

### Bottom tab navigation evidence (2026-07-07)

Verified the primary floating tab bar without changing app code. Chrome CDP Expo
web evidence at 320 x 568 and 390 x 568 starts on `/today`, clicks Progress,
Shelf, and You through the real tab bar, and confirms exactly one selected tab
after each switch, all four labels visible inside their tab bounds, 54 px tab
targets, center hit-tests inside each tab, zero horizontal overflow, no visible
non-tab controls intersecting the floating-bar zone, and zero browser console
errors. Evidence is in
`test-results/human-e2e/2026-07-07/navigation-current/`. Desktop Chrome cannot
prove native React Native keyboard-hide or platform text-scale behavior, so those
remain iOS/Android simulator/device QA follow-ups.

### Cycle cadence review-gate evidence (2026-07-08)

Added `EXPO_PUBLIC_E2E_ROUTINE_CADENCE_REVIEW_GATE=closed` as a dev-only fixture
inside the routine cadence review gate, so Expo web can exercise the
production-like closed-review branch without changing production semantics. The
fixture can close the gate in dev for E2E coverage, but it cannot open
unreviewed cadence outside dev.

Verified in the Codex in-app browser at 320 x 568 on Expo web port 8149 with
`EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro` and the closed-review fixture. Direct
`/cycle/week`, `/cycle/settings`, and `/cycle/why-tonight` show review-gate copy
while cadence review remains closed, keep AM/daily-routine reassurance visible,
hide Settings/variant/night controls, hide cycle rows and pause/recovery
banners, avoid `add an active/build your cycle` promises, keep visible controls
48 px+ (56 px on `Got it`), and have zero horizontal overflow. `Got it` from
direct `/cycle/why-tonight` returns to `/today`. Evidence and report are in
`test-results/human-e2e/2026-07-08/cycle-cadence-review-gate-current/`. This
does not replace native iOS/Android bottom-sheet, safe-area, screen-reader, or
reviewer-signoff QA.

### Shelf scan/OCR permission recovery evidence (2026-07-08)

Implemented route-owned recovery for Shelf scan and OCR when camera permission
is denied and the OS will not prompt again. `/shelf/scan` and `/shelf/ocr` now
share the camera Settings failure copy, use the shared `openAppSettings` helper
with `alertOnFailure: false`, and render inline `Camera settings unavailable`
feedback instead of relying on a native/browser alert. A dev-only
`EXPO_PUBLIC_E2E_SHELF_CAMERA_PERMISSION=denied_no_retry` fixture makes the
branch testable through Expo web without pretending web has a native camera.

Verified in the Codex in-app browser at 320 x 568 on Expo web port 8147 with
`EXPO_PUBLIC_E2E_SHELF_CAMERA_PERMISSION=denied_no_retry`,
`EXPO_PUBLIC_E2E_APP_SETTINGS_FAILURE=1`, and
`EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro`. Scan shows one `Open settings` action,
then inline settings-unavailable recovery with Search catalog, Scan ingredient
label, and Add it by hand fallbacks still visible. OCR shows one `Open settings`
action, then inline recovery, preserves `Continue with manual text`, accepts
`Aqua, Glycerin, Niacinamide`, and carries that text into `/shelf/manual`.
Across captured states there are no JavaScript dialogs, no raw fixture text,
zero horizontal overflow, no visible controls below 48 px, and no current-origin
browser warn/error logs. Evidence and report are in
`test-results/human-e2e/2026-07-08/shelf-camera-permission-denied-current/`.
This does not replace native iOS/Android OS permission-sheet, real
`Linking.openSettings()` handoff, barcode camera, OCR camera, or physical-device
safe-area QA.

### Shelf opened-date/replenish boundary evidence (2026-07-08)

Fixed the Shelf replenish prompt so PAO/expiry-triggered replacements do not use
manufactured scarcity copy. The previous prompt could say a product was
`nearly finished` or `running low` even when the trigger was a freshness
boundary; `/shelf/replenish` now frames the branch around PAO or printed-date
freshness, says it is not an alarm, and keeps similar options behind the
separate commerce consent.

Verified in the Codex in-app browser at 320 x 568 on Expo web port 8148 with
`EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro`. The run added
`Boundary Vitamin C Serum`, confirmed `/shelf/opened` shows all three core
opened-state choices before PAO/save controls on a short phone, set
`3 months ago` plus `3 mo` PAO, confirmed Shelf showed `0 days left`, opened the
replenish prompt, and confirmed PAO/printed-date copy with no scarcity wording.
`Re-add the same one` archived the boundary unit and created one active fresh
unit showing `opened Jul`, `3 mo PAO`, and `Oct 2026`. Evidence and the bug
report are in
`test-results/human-e2e/2026-07-08/shelf-opened-replenish-boundary-current/`
and `docs/e2e-bug-reports/2026-07-08-shelf-replenish-scarcity-copy.md`. This
does not replace native iOS/Android bottom-sheet, Dynamic Type, screen-reader,
safe-area, or restart-persistence QA.

### Settings data-rights inline recovery (2026-07-08)

Replaced the You-tab privacy/data-rights native-alert paths with route-owned
inline notices and confirmations. Export unavailable/failure, delete
confirmation/failure, health-data withdrawal confirmation/failure, and
cloud-backup explanatory/failure copy now stay in the route; destructive
account actions still require a second explicit press. A compact-phone E2E pass
found that newly inserted destructive confirmation controls could land under
the floating tab bar, so the route now tracks ScrollView offset and nudges
data-rights confirmations into view before the user confirms.

Verified in the Codex in-app browser at 320 x 568 on Expo web port 8160 with
placeholder Supabase unavailable. `/settings/privacy` resolves to
`/you?section=privacy`; `Export my data` renders inline `Export failed`;
`Delete account` opens a 200 x 56 inline Delete/Cancel confirmation, Cancel
removes it, and confirm renders inline `Deletion failed`; `Withdraw
health-data consent` opens a section-local 200 x 56 `Withdraw & delete`/Cancel
confirmation above the floating tab bar, and confirm renders inline
`Withdrawal failed`; cloud backup fails closed inline with the switch still off.
Across the pass there are no JavaScript/native dialogs, no raw backend/provider
text leaks, zero horizontal overflow, and no current-origin warn/error logs.
Evidence and bug reports are in
`test-results/human-e2e/2026-07-08/settings-data-rights-inline-recovery-current/`,
`docs/e2e-bug-reports/2026-07-08-settings-data-rights-native-alerts.md`, and
`docs/e2e-bug-reports/2026-07-08-settings-data-rights-tabbar-overlap.md`.
`npm --workspace apps/mobile run typecheck`, `npm --workspace apps/mobile run
lint`, and `npm --workspace apps/mobile run test` pass. Live Supabase
data-rights/consent-ledger evidence and native iOS/Android share-sheet,
safe-area, and screen-reader QA remain external launch gates.

### Shelf product-detail route-owned recovery (2026-07-08)

Replaced product-detail lifecycle and catalog-report native alerts with
route-owned sheets and inline catalog feedback. `More options` now opens a named
`Remove from shelf?` sheet for discard/delete choices, `Report an issue` opens a
named `Report catalog issue` sheet, and failed catalog reports stay on the
product detail with inline `Report not sent` recovery instead of platform chrome.

Verified in the Codex in-app browser at 320 x 568 on Expo web port 8102 by
adding `Route Owned Balm`, opening product detail, exercising both sheets, and
submitting `Wrong product match` against the unavailable catalog backend. The
first pass caught unnamed dialog nodes; post-fix both sheets expose named modal
dialog semantics, 48 px+ controls, no JavaScript/native dialog, and zero
horizontal overflow. Evidence and report are in
`test-results/human-e2e/2026-07-08/shelf-detail-you-inline-recovery-current/`
and
`docs/e2e-bug-reports/2026-07-08-shelf-product-detail-route-owned-recovery.md`.
Native iOS/Android screen-reader order, Dynamic Type, and live catalog-report
success evidence remain device/backend QA follow-up.

### Progress photo-detail route-owned delete/share recovery (2026-07-08)

Replaced the remaining single-photo detail native-alert recovery paths with
route-owned UI. Photo deletion now uses the dark Progress confirmation panel,
failed deletes render inline local-photo recovery, and the photo share helper is
UI-free so the route owns all unavailable-share feedback instead of stacking
platform alerts over the sensitive photo surface. Added a dev-only
`EXPO_PUBLIC_E2E_PHOTO_DELETE_FAILURE=1` fixture for safe destructive-path E2E.

Verified in the Codex in-app browser at 320 x 568 on Expo web port 8168 with
populated local photos, store Pro entitlement, forced share failure, and forced
delete failure. `/progress/e2e-front-2026-04-01` keeps 48 px Back, Set as
reference, Share photo, and Delete photo controls visible with zero horizontal
overflow; Share photo can be cancelled, then forced failure stays on the same
route with inline feedback and no JavaScript/native dialog; Delete photo can be
cancelled, then forced failure stays on the same route with inline recovery and
no dialog. Browser warn/error logs contain only expected placeholder Supabase
and Expo notifications web-support warnings. Evidence and bug report are in
`test-results/human-e2e/2026-07-08/progress-photo-detail-delete-recovery-current/`
and
`docs/e2e-bug-reports/2026-07-08-progress-photo-detail-native-alerts.md`.
Native iOS/Android share-sheet rejection chrome, screen-reader order, Dynamic
Type, and real encrypted-file deletion failure remain device QA follow-up.

### Navigation tab-bar resume audit and lint gate repair (2026-07-08)

Re-ran the floating bottom tab bar on the current `main` state in the Codex
in-app browser at 320 x 568 and 390 x 568. `/today` switched through Progress,
Shelf, You, and back to Today with exactly one selected tab after each tap, 53.99
px tab targets, successful center hit-tests for every tab, zero horizontal
overflow, no non-tab controls intersecting the floating-bar zone, and only
expected local placeholder Supabase / Expo notifications web warnings. Evidence
is in
`test-results/human-e2e/2026-07-08/navigation-tabbar-resume-current/`.

Also swept compact 320 x 568 core and secondary routes for horizontal overflow,
visible sub-44 px controls, floating-tab overlap, raw error leakage,
placeholder/TODO copy, and JavaScript dialogs. No issues were reported in
`test-results/human-e2e/2026-07-08/compact-route-audit-current/` or
`test-results/human-e2e/2026-07-08/compact-route-audit-current-secondary/`.

The mobile lint gate exposed one real repo issue:
`apps/mobile/src/features/navigation/dialogContracts.test.ts` used the forbidden
`Array<T>` style while lint runs with `--max-warnings=0`. Changed that local
type annotation to `T[]`. `npm --workspace apps/mobile run typecheck`, `npm
--workspace apps/mobile run lint`, `npm --workspace apps/mobile run test`, and
`npm --workspace apps/mobile run test -- src/features/navigation/dialogContracts.test.ts src/features/navigation/tabBar.test.ts`
pass.

### Onboarding products short-phone footer clearance (2026-07-08)

Found a 320 x 480 onboarding product-intake layout issue in the Codex in-app
browser: the optional `Choose product category` trigger could occupy the same
footer zone as the fixed `Skip for now` action on `/onboarding/products`.
Added an explicit shrink constraint to the product-intake scroll wrapper so
overflow content clips and scrolls above the fixed footer on short web
viewports. Added a source contract covering the new wrapper.

Post-fix human-simulated E2E at 320 x 480 verifies the initial state keeps the
product-name input and `Skip for now` footer visually separate, a normal scroll
brings `Choose category` fully above the footer, the category picker opens with
48 px category chips, selecting `Serum` persists the category, and adding
`Retinol serum` renders `1 ON YOUR SHELF` with compact footer actions. Evidence
and bug report are in
`test-results/human-e2e/2026-07-08/onboarding-products-short-phone-footer-fix/`
and
`docs/e2e-bug-reports/2026-07-08-onboarding-products-short-phone-footer-overlap.md`.
Native iOS/Android keyboard, Dynamic Type, and home-indicator safe-area QA
remain device follow-up.

### Routine plan unplaced shelf item guardrail (2026-07-08)

Hardened the routine generator so products with no review-safe category, tag,
ingredient, or name signal are no longer silently treated as hydrating serums.
Manual category picks now contribute only explicit review-safe functional tags
for known actives such as SPF, vitamin C, retinoids, and benzoyl peroxide, while
common hydrating/barrier INCI cues map through the tag dictionary. Unknown shelf
items are reported on the generated plan as `unplacedProducts`; AM/PM sequencing
and recommendation inputs skip them until the user adds a category or ingredient
clue.

During compact E2E, the original item-specific bottom note exposed a clipped
text sliver near the fixed `Start today` action. The specific product guidance
now lives in the first insight card, and bottom gap notes stay suppressed while
unplaced products are the primary issue.

Verified in the Codex in-app browser at 320 x 568 on Expo web port 8164 with
`EXPO_PUBLIC_E2E_ENTITLEMENT=pro` by adding `Mystery drops` with no category
through `/shelf/manual`, then opening `/routine/plan` from Shelf. The route
shows `Product needs details`, names `Mystery drops` as needing a category or
ingredient clue, keeps the product out of Morning and Evening rows, keeps
`Start today` visible, and has zero horizontal overflow, no raw error text, no
JavaScript dialog, no current-route warning/error logs, and no product-note
footer sliver. Tapping `Start today` routes to `/today` with zero horizontal
overflow and no raw error text. Evidence and bug report are in
`test-results/human-e2e/2026-07-08/routine-plan-unplaced-product/` and
`docs/e2e-bug-reports/2026-07-08-routine-plan-unclassified-product.md`.
Native iOS/Android screen-reader, Dynamic Type, and production entitlement QA
remain device follow-up.

### Shelf empty compact viewport evidence (2026-07-08)

Closed the missing user-flow evidence branch for an empty no-archive Shelf at a
320 px compact phone width. Added a focused source contract so the no-archive
empty Shelf keeps its compact spacing, bottle illustration, headline/helper
copy, `Scan a barcode` and `Add by hand` actions, and non-empty-only floating
scan FAB behavior.

Verified in the Codex in-app browser on Expo web port 8171 with a fresh local
origin and no shelf data. `/shelf` renders the empty-state bottle illustration,
headline, helper copy, both add actions, and the floating tab bar in the first
viewport. Runtime geometry reports zero horizontal overflow, 56 px and 50 px add
actions, 54 px tab targets, no JavaScript dialog, and no current-origin
warn/error logs. Evidence is in
`test-results/human-e2e/2026-07-08/shelf-empty-compact-current/`. Native
iOS/Android safe-area, Dynamic Type, and screen-reader traversal remain device
QA follow-up.

### Shelf no-match shortest-phone fallback (2026-07-08)

Found a 320 x 480 Shelf no-match recovery issue in the Codex in-app browser:
`/shelf/no-match` clipped the final `Add it by hand` fallback so its center was
outside the viewport while the document had no useful page scroll. Added a
route-local compact mode below 520 px height that keeps the close action large,
keeps all three recovery rows visible, reduces each fallback row to a still-safe
54 px target, and hides only the nonessential footer microcopy.

Post-fix human-simulated E2E at 320 x 481 verifies Search catalog, Scan the
ingredient list, and Add it by hand are all visible; the manual row has no
blocked hit-test, clipped-control state, sub-44 px target, horizontal overflow,
JavaScript dialog, or current-route warning/error logs; and tapping its visible
center routes to `/shelf/manual`. Evidence and bug report are in
`test-results/human-e2e/2026-07-08/shelf-no-match-short-phone-480/` and
`docs/e2e-bug-reports/2026-07-08-shelf-no-match-short-phone-fallback.md`.
Fresh current-source recheck on localhost:8193 confirms the manual fallback is
264.41 x 54 px at y=406.58-460.59 in a 320 x 480 viewport, center hit-testing
succeeds, and the tap-through still lands on `/shelf/manual`.
Native iOS/Android camera, safe-area, Dynamic Type, and screen-reader traversal
remain device QA follow-up.

### Progress first-photo shortest-phone controls (2026-07-08)

Found a 320 x 480 Progress first-use bug in the Codex in-app browser:
`/progress` rendered a 56 px `Take my first photo` CTA whose center was covered
by the floating Shelf tab, while `/progress/capture` and redirected
`/photos/capture` clipped `Not now` below the viewport with only an 11 px
visible sliver.

Added a shortest-phone mode for the empty Progress first-run state and the
first-use photo consent gate. The compact mode keeps the privacy-critical
local-only consent copy visible, keeps both consent actions 48 px+, preserves
the on-device/no-faceprint/cloud-separate tradeoff, and removes only the
nonessential prep reminder on sub-520 px height viewports.

Post-fix human-simulated E2E at 320 x 481 verifies `/progress` keeps `Take my
first photo` fully visible and unblocked above the floating tab bar;
`/progress/capture` and `/photos/capture` keep 52 px `Take photos. On device
only` and 48 px `Not now` fully visible, hit-testable, and free of horizontal
overflow, blocked controls, or sub-44 visible controls; and tapping `Not now`
returns to `/progress`. Evidence and bug report are in
`test-results/human-e2e/2026-07-08/progress-first-photo-short-phone-480/` and
`docs/e2e-bug-reports/2026-07-08-progress-first-photo-short-phone-tabbar-consent.md`.
Native iOS/Android camera permission sheets, hardware safe areas, Dynamic Type,
and screen-reader traversal remain device QA follow-up.

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
