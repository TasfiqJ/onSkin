# Phase 7 Core Loop QA Checklist

Run this checklist on real iOS and Android beta builds before enabling public production distribution.

Strict Phase 7 packet completion requires one external evidence switch per
scenario group. Do not set any switch to `true` until the matching iOS/Android
or live-service evidence is captured, reviewed, and linked in the Phase 7 packet:
`PHASE7_ONBOARDING_CONSENT_QA_PASS`, `PHASE7_SHELF_INTAKE_QA_PASS`,
`PHASE7_REVIEWED_GUIDANCE_QA_PASS`, `PHASE7_ROUTINE_BUILDER_QA_PASS`,
`PHASE7_TODAY_CHECKOFF_QA_PASS`, `PHASE7_PHOTOS_PRIVACY_QA_PASS`,
`PHASE7_REMINDERS_QA_PASS`, `PHASE7_PAYMENTS_LIFECYCLE_QA_PASS`,
`PHASE7_PRIVACY_CONTROLS_QA_PASS`, `PHASE7_SHARE_CARD_QA_PASS`,
`PHASE7_DEFERRED_SURFACES_QA_PASS`, and `PHASE7_ANALYTICS_QA_PASS`.

## Onboarding and consent

- Final brand/domain visible where applicable.
- Age gate rejects under-minimum users and records only necessary state.
- Health-data consent text is final, versioned, and logged.
- Placeholder consent copy is absent from production.
- Policy links open real privacy, terms, support, export, deletion, and consumer-health pages.

## Shelf intake

- Add 3 real owned products using manual, search, and scan/OCR fallback paths.
- Wrong match and no match are understandable.
- Source and confidence labels are visible where data is not first-party.
- PAO/expiry labels distinguish label/catalog/default estimates.
- Offline add/edit/delete does not corrupt local shelf.

## Intelligence and recommendations

- Reviewed conflict rules surface with evidence and no alarm/medical claims.
- Unreviewed rules do not surface in production.
- If no reviewed rule applies, empty/no-issue state is honest.
- Recommendations remain type-first and do not include commerce inputs.
- Goal-active recommendations remain hidden unless reviewed.

## Routine and Today

- AM/PM plan persists after app restart.
- Check-off works offline, then online, without duplicate records.
- Undo/re-check behaves predictably.
- Timezone and date rollover do not reset the wrong day.
- Recovery/pause/skipped states do not contradict the routine.

## Photos and privacy

- Camera capture stores local file and timeline renders after restart.
- App lock gates existing photo timeline.
- Settings and locked Progress label photo storage as device-only; no cloud-backup control is exposed.
- Saving a photo emits no automatic image or metadata request to Supabase under any current UI state.
- Trend opt-in is hidden unless `EXPO_PUBLIC_PHASE7_TREND_ENABLED=true`.
- No AI score/grade/age/percent wording appears.

## Reminders

- Permission prompt copy is accurate.
- Quiet hours and configured routine time are respected.
- Android notification permission behavior is verified on Android 13+.
- Reminder tap/check-off is idempotent.
- Review prompt appears only after real value.

## Payments

- Paywall loads localized RevenueCat prices.
- Purchase, restore, cancellation, expiration, refund, and account deletion states are tested.
- Pro gates unlock only from verified entitlement state.
- Reverse trial expiration does not leave paid access behind.

## Deferred surfaces

- `/commerce/*`, `/ask/*`, `/trend/*`, `/routine/widgets`, `/community/ask`, `/community/people-like-you`, and `/share/conflict/*` are unavailable by default.
- You tab does not show deferred rows by default.
- Today does not show Ask teaser by default.
- Progress does not show trend insight or opt-in by default.
- Where-to-buy rows return null by default.

## Share card

- Requires final brand domain and share-card flags.
- Requires exact current `ruleId`, not a fallback conflict.
- Requires `conflict.rule.reviewedBy`.
- Does not include sensitive notes, product IDs, local paths, or raw ingredient text.
- Export/share events do not include product names.

## Local regression evidence

- Generated Phase 7 core-loop QA packets must show the source Git SHA and
  whether they were produced from a clean or dirty Git worktree. Treat a packet
  with `Git status: DIRTY` as investigation evidence only, not final core-loop
  signoff. The packet must hash the launch helpers, checker, smoke coverage,
  human-simulated E2E rules/tree/manifest, Phase 5 native-device packet, Phase
  6 payments packet, Phase 9 shared evidence helpers, and the Phase 7
  checklist/exit-review docs so reviewers can tie the packet to the exact local
  gates and upstream evidence packets that produced it.

- 2026-07-06: Vitest covers `shippableRules()` production withholding/reviewed
  pass-through and `generatePlan()` default production behavior for an unreviewed
  retinoid × glycolic routine. This supports the "unreviewed rules do not
  surface in production" checklist item; it does not replace real iOS/Android
  beta-device QA or named reviewer sign-off.
- 2026-07-07: Chrome CDP Expo web E2E at 320 x 568 and 390 x 568 covers bottom
  tab navigation: `/today` starts selected, Progress/Shelf/You are reached by
  clicking the floating tab bar, exactly one tab is selected after each switch,
  all four labels stay one-line inside their tab bounds, tab targets are at least
  54 px tall, center hit-tests land inside each tab, horizontal overflow is zero,
  and no non-tab controls intersect the floating-bar zone. Evidence is in
  `test-results/human-e2e/2026-07-07/navigation-current/`; it does not replace
  native simulator/device keyboard-hide or platform text-scale QA.
- 2026-07-08: Headless Chrome E2E at 320 x 568 and 390 x 568 covers the
  floating tab bar scene-background polish follow-up. Pre-fix screenshot review
  showed PM Today's dark surface ending above the floating tab bar, leaving a
  light scene-clearance band behind the bar. Post-fix, `/(tabs)` paints scene
  clearance by route: PM Today samples `colors.night` behind the bar, while
  Progress/Shelf/You sample `colors.paper`; labels remain visible, tab centers
  hit the expected target, exactly one tab is selected after each switch, and
  horizontal overflow is zero. Evidence is in
  `test-results/human-e2e/2026-07-08/navigation-tabbar-polish/`; it does not
  replace native simulator/device keyboard-hide or platform text-scale QA.
- 2026-07-07: Expo web E2E at 320 x 568 plus focused onboarding consent tests
  cover direct quiz-entry privacy gating: `/onboarding/quiz` without a local
  health-data collection grant redirects to `/onboarding/consent`, does not
  render quiz questions before consent, remains on consent after refresh, and
  opens the first quiz question only after `I agree. Continue`. Evidence is in
  `test-results/human-e2e/2026-07-07/onboarding-direct-quiz-consent/`; it does
  not replace native secure-storage timing QA or final legal consent-copy review.
- 2026-07-07: Expo web E2E at 320 x 568 plus focused age-gate tests cover the
  first-run DOB gate: the visible copy says `We don't store your birth date.`,
  impossible and future DOBs show invalid-date recovery, a valid underage DOB
  stays on `/onboarding/age` with the 16+ block copy, and all checked states have
  zero horizontal overflow with no visible sub-44 px controls. Evidence is in
  `test-results/human-e2e/2026-07-07/onboarding-age-gate-live-audit/`; it does
  not replace native keyboard/device QA or final counsel review of the age floor.
- 2026-07-07: Expo web E2E at 320 x 568 plus focused onboarding tests cover
  health-consent decline, sensitivities exclusivity, profile-save failure, and
  direct-entry missing-goal recovery. Declining health-data collection keeps the
  quiz locked and direct quiz entry recovers to consent; `None that I know of`
  and `Fragrance` clear each other on the sensitivities step; the dev-only
  `EXPO_PUBLIC_E2E_PROFILE_SAVE_FAILURE=once` fixture stops on
  `We could not save your profile.` before reveal and retries into Reveal; and a
  direct consent/quiz path without goals recovers to Goals, then resumes Products
  after a goal is selected. Evidence is in
  `test-results/human-e2e/2026-07-07/onboarding-consent-quiz-resilience/`,
  `test-results/human-e2e/2026-07-07/onboarding-profile-save-failure/`, and
  `test-results/human-e2e/2026-07-07/onboarding-direct-no-goals-recovery/`; it
  does not replace native keyboard/accessibility QA or final legal quiz-copy
  review.
- 2026-07-08: Codex in-app browser Expo web at 320 x 568 plus focused
  notification onboarding tests cover the notification soft-ask skip path.
  `/onboarding/notifications` renders the calm soft ask, `Not now` continues to
  `/onboarding/account`, and the same session's `/settings/notifications`
  shows `Morning routine` and `Evening · tonight's step` switches both off
  (`aria-checked=false`) with 48 px switch targets, zero horizontal overflow,
  and no JavaScript dialog. Evidence is in
  `test-results/human-e2e/2026-07-08/onboarding-notification-skip-current/`;
  this does not replace native iOS/Android OS notification denial, system-prompt,
  permission-state, or scheduled-notification QA.
- 2026-07-08: Codex in-app browser Expo web at 320 px plus focused onboarding
  route contracts cover the compact `/onboarding/products` category selector
  after native safe-area hardening. The collapsed route has zero horizontal
  overflow, a 54 px product-name input, a 50 px `Choose product category`
  control, and a 56 px footer action; source contracts verify the picker sheet
  uses native bottom-inset padding when present, caps height at viewport minus a
  44 px outside dismiss reserve, exposes web modal-dialog semantics, and keeps
  category chips inside a shrinkable scroll view. Evidence is in
  `test-results/human-e2e/2026-07-08/onboarding-product-category-picker-safe-area/`;
  it does not replace native iOS/Android home-indicator, Dynamic Type,
  VoiceOver/TalkBack, or a stable modal-open browser run.
- 2026-07-07: Expo web E2E at 320 x 568 covers runtime brand identity on
  `/ask`, `/paywall/upsell?feature=full_routine`, and
  `/settings/subscription`: the checked surfaces render `Ask RoutineKind` and
  `RoutineKind Pro`, no visible `OnSkin` labels appear, and browser console
  errors are empty. `npm run brand:audit:strict` also reports zero
  public-launch-risk and zero review-needed references. Evidence is in
  `test-results/human-e2e/2026-07-07/runtime-brand-identity/`; it does not
  replace final brand/legal clearance, native identifier QA, store listing QA, or
  final-domain/share-card QA.
- 2026-07-08: Codex in-app browser Expo web at 320 x 568 covers the
  public-copy smoke with `EXPO_PUBLIC_APP_DISPLAY_NAME=RoutineKind`.
  `/onboarding/age`, `/s/sharecard01`, `/shelf/search`, and `/settings/timing`
  show `RoutineKind`, all six captured states including free `/routine/widgets`
  before and after `Explore first. 7 days of Pro` show no visible `OnSkin`, the
  no-card Pro week reaches the widgets deferred surface (`Widgets are not in
this beta` / `Back to Today`), visible controls are 48 px+, horizontal
  overflow is zero, and current-origin browser warn/error logs are empty.
  Evidence is in
  `test-results/human-e2e/2026-07-08/public-copy-smoke-current/`; this does not
  replace final trademark clearance, store listings, native identifiers, final
  domain, Universal Links/App Links, or device QA.
- 2026-07-08: Codex in-app browser Expo web at 320 x 568 covers direct-entry
  reminders/streak/widgets Pro gating. Fresh free `/routine/streak`,
  `/routine/welcome-back`, and `/routine/widgets` all show the
  reminders/widgets contextual paywall with no premium surface content, 48 px+
  visible controls, zero horizontal overflow, no JavaScript dialog, and no
  current-origin warn/error logs. Starting the no-card Pro week unlocks
  `/routine/streak`, `/routine/welcome-back`, and the widget deferred surface;
  `Tonight's step` and `Back to Today` both return to `/today`. Evidence is in
  `test-results/human-e2e/2026-07-08/reminders-streak-welcome-current/`; this
  does not replace native iOS/Android rendering, screen-reader, safe-area,
  RevenueCat, or WidgetKit/Glance/ActivityKit QA.
- 2026-07-08: Codex in-app browser Expo web at 320 x 568 covers remaining
  full-routine direct routes. Fresh free `/routine/reorder`, `/routine/ramp`,
  `/routine/tolerance`, and `/routine/adaptation` all show the full-routine
  contextual paywall with no premium route-body markers, 48 px+ visible
  controls, and zero horizontal overflow. Starting the no-card Pro week unlocks
  the sequencing editor, ramp status, tolerance check-in, and adaptation summary
  surfaces. Fresh direct-entry exits for `Done`, `Skip`, `Looks good`, and
  `Back` return to `/today`. Evidence is in
  `test-results/human-e2e/2026-07-08/full-routine-intelligence-current/`; this
  does not replace native iOS/Android safe-area, screen-reader, Dynamic Type,
  RevenueCat, or real non-example shelf/profile beta QA.
- 2026-07-07: Expo web E2E at 320 x 568 covers local Trend route recovery in
  both launch-gated and enabled modes. Default `/trend/optin` and
  `/trend/fairness` show the deferred Trend surface with `Back to Progress` and
  return to `/progress`; the enabled local-only consent fixture starts the
  `Read my progress` switch off, toggles on/off, opens fairness after a user-like
  scroll, returns nested/direct fairness to `/trend/optin`, and returns direct
  opt-in to `/progress`, with zero horizontal overflow and no browser errors.
  Evidence is in `test-results/human-e2e/2026-07-07/trend-routes-current/`; it
  does not replace native photo/toggle QA, live authenticated consent-ledger/RLS
  evidence, fairness validation, or final legal consent-copy review.
- 2026-07-08: Codex in-app browser Expo web at 320 x 568 covers installed-base
  Trend reconsent with populated local Progress photos and no
  `photo_trend_insights` consent. A clean-origin returning photo user sees
  `12 weeks · 3 photos · all on this phone` while the Trend insight is hidden;
  the no-score refusal remains visible with optional/off-by-default opt-in copy;
  `/trend/optin` starts with `Read my progress` off and separate revocable
  consent copy; one explicit switch tap sets `aria-checked=true`; and reopening
  Progress renders the on-device Trend card. The scoped Trend output has no
  score, grade, skin age, or percentage, visible controls are 48 px+, and
  horizontal overflow is zero. Evidence is in
  `test-results/human-e2e/2026-07-08/installed-base-trend-reconsent-current/`;
  focused tests now ensure a configured consent ledger with legacy
  `photo_capture` but no `photo_trend_insights` fails closed. This does not
  replace native secure-storage/biometric-lock QA or live Supabase
  consent-ledger/RLS evidence.
- 2026-07-07: Codex in-app browser Expo web E2E at 320 x 568 covers the
  first-use `/progress/capture` local-only consent gate after the safe-area
  overlay hardening. The gate renders complete on-device/no-faceprint/cloud-
  separate/lost-phone-tradeoff copy, keeps `Take photos. On device only` at
  52 px and `Not now` at 48 px, has zero horizontal overflow, and tapping
  `Not now` returns to `/progress` with the first-photo CTA and bottom tabs
  still tappable. Evidence is in
  `test-results/human-e2e/2026-07-07/progress-capture-safe-area/`; it does not
  replace native iOS/Android notch, home-indicator, camera-permission, or real
  camera-start QA.
- 2026-07-08: Codex in-app browser Expo web E2E at 320 x 568 covers first-use
  `/progress/capture` photo consent save failure and retry with
  `EXPO_PUBLIC_E2E_PHOTO_CONSENT_FAILURE=once` and
  `EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro`. The forced failed save keeps the
  camera and permission path closed, renders route-owned `Photo choice not
saved` feedback with `role="alert"`, opens no JavaScript dialog, keeps the
  retry CTA at 52 px and `Not now` at 48 px inside the viewport, shows no raw
  fixture error, has zero horizontal overflow, and retry reaches the normal web
  camera-permission gate. The same slice removed the leftover native
  `Alert.alert` call from the consent persistence failure path; the separate
  camera-capture failure branch was later converted to route-owned recovery as
  recorded below. Evidence is in
  `test-results/human-e2e/2026-07-08/progress-photo-consent-failure-current/`;
  it does not replace native iOS/Android system-alert, camera-permission,
  restart-persistence, safe-area, or real camera-start QA.
- 2026-07-08: Codex in-app browser Expo web E2E at 320 x 568 covers
  `/progress/capture` camera/photo permission denied recovery with
  `EXPO_PUBLIC_E2E_PROGRESS_CAMERA_PERMISSION=denied_no_retry`,
  `EXPO_PUBLIC_E2E_APP_SETTINGS_FAILURE=1`, and
  `EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro`. The route starts on the local-only
  photo consent gate, consent reaches a denied/no-retry permission gate with one
  `Open settings` action, no `Capture photo` control, and no JavaScript dialog.
  The forced Settings handoff failure renders route-owned
  `Camera settings unavailable` copy with `role="alert"`, no native/browser
  dialog, no raw fixture text, no horizontal overflow, and 48 px+ visible
  controls; `Not now` returns to `/progress`. Evidence and the bug report are in
  `test-results/human-e2e/2026-07-08/progress-photo-permission-denied-current/`
  and
  `docs/e2e-bug-reports/2026-07-08-progress-photo-permission-settings-inline-recovery.md`;
  this does not replace native iOS/Android OS permission-sheet, real Settings
  handoff, physical camera, or home-indicator QA.
- 2026-07-08: Codex in-app browser Expo web E2E at 320 x 568 covers
  `/progress/capture` still-photo rejection with
  `EXPO_PUBLIC_E2E_PROGRESS_CAPTURE_FAILURE=once` and
  `EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro`. The capture surface exposes one
  enabled `Capture photo` action, the forced rejection opens no JavaScript
  dialog, and the route renders inline `Photo wasn't captured` recovery with
  `role="alert"`, a 56 px `Try photo again` action, a 48 px `Not now` exit, a
  disabled background shutter, no raw fixture error, and zero current-origin
  browser logs. Retrying consumes the fixture and shows the normal web
  permission gate; the compact permission heading has explicit line height so
  wrapped serif copy does not overlap. Evidence and the bug report are in
  `test-results/human-e2e/2026-07-08/progress-photo-capture-failure-current/`
  and
  `docs/e2e-bug-reports/2026-07-08-progress-photo-capture-failure-inline-recovery.md`;
  this does not replace native iOS/Android camera mount, real
  `takePictureAsync` rejection, permission-denied, encrypted image persistence,
  or safe-area QA.
- 2026-07-07: Codex in-app browser Expo web E2E with
  `EXPO_PUBLIC_E2E_PROGRESS_PHOTOS=populated` covers the populated Progress
  comparison picker after safe-area and compact-dismiss hardening. The local
  Pro preview opens a three-photo timeline, the Compare view shows the no-score
  framing, the first date chip opens one named `Choose the first photo` dialog,
  all visible controls remain at least 44 px, the picker exposes three
  contextual photo-tile labels, Dismiss closes the dialog, and selecting
  `May 12` updates the first comparison chip with zero horizontal overflow.
  Evidence is in
  `test-results/human-e2e/2026-07-07/progress-compare-picker-safe-area-current/`;
  it does not replace native iOS/Android home-indicator, real encrypted image,
  biometric app-lock, or VoiceOver/TalkBack QA.
- 2026-07-07: Expo web E2E at 320 x 568 covers conflict/share direct-entry
  recovery for missing and unshareable states. `/conflict/missing-rule-e2e`
  shows the stale timing-note explanation, warns that stale routine advice is
  never reused, returns `Back to Shelf` to `/shelf`, and opens `Add a product` to
  `/shelf/manual`. Default `/share/conflict/missing-rule-e2e` shows the
  launch-gated fallback and returns to `/shelf`; a share-card-enabled local
  server shows the unshareable reviewed-card state, disables `Share to Stories`,
  and returns `Done` to `/shelf`, with no private product names, zero horizontal
  overflow, and no browser errors. Evidence is in
  `test-results/human-e2e/2026-07-07/conflict-share-routes-current/`; it does
  not replace native share-sheet export QA, public-link final domain QA, or
  reviewed conflict-rule content approval.
- 2026-07-07: Fresh Chrome E2E at 320 x 568 covers the real conflict-detail
  choice path with a seeded retinol/glycolic Shelf conflict. The Shelf banner
  opens the conflict detail through `Review conflict`, the detail shows calm
  evidence/severity/resolution copy without claiming the products are already
  cycle-placed, the compact saved-choice footer reads `saved · we won't ask
again`, and tapping `Use together anyway` returns to Shelf with the conflict
  banner suppressed. The run decrypted local override storage and confirmed the
  canonical conflict key persisted. Evidence is in
  `test-results/human-e2e/2026-07-07/conflict-detail-choice-current/`; it does
  not replace dermatologist/cosmetic-chemist approval of the starter conflict
  matrix or native-device QA.
- 2026-07-08: In-app browser E2E at 320 x 568 covers the stale conflict-detail
  compact-sheet fallback after the first safe-area patch exposed a zero-height
  regression. Pre-fix `/conflict/missing-rule-e2e` rendered `maxHeight: 0px`
  and pushed `Back to Shelf` / `Add a product` below the viewport. Post-fix,
  the route uses the compact fallback unless the reported viewport is taller
  than the 44 px dismiss reserve; the same guard now protects `/commerce/consent`.
  The rerun shows a 524 px dialog, `aria-modal`, `Timing note unavailable`
  label, zero horizontal overflow, no mojibake, and visible 56 px / 48 px
  actions. Evidence is in
  `test-results/human-e2e/2026-07-08/conflict-detail-safe-area/`; it does not
  replace native iOS/Android home-indicator, Dynamic Type, VoiceOver, or
  TalkBack QA.
- 2026-07-07: Expo web E2E at 320 x 568 covers commerce trust route recovery in
  default deferred and enabled local modes. Default `/commerce/stacks`,
  `/commerce/transparency`, `/commerce/consent`, and
  `/commerce/stack/sensitive-skin-starter-set` show the deferred beta surface and
  return `Back to You` to `/you`. With `EXPO_PUBLIC_PHASE7_COMMERCE_ENABLED=true`
  and `EXPO_PUBLIC_FINAL_BRAND_DOMAIN=https://routinekind.app`, direct
  transparency/stacks/consent recover to `/you`, direct stack detail recovers to
  `/commerce/stacks`, stack hierarchy keeps paid-link disclosure and 48 px
  transparency control visible, unavailable stack recovery exposes no retailer
  links, recommendation where-to-buy is locked without commerce consent, Allow
  returns to the originating recommendation, consented state remains
  catalog-blocked until approved links exist, the shelf alternative routes to
  `/shelf/manual`, and stack items open the separate consent sheet with zero
  horizontal overflow and no browser errors. Evidence is in
  `test-results/human-e2e/2026-07-07/commerce-routes-current/`; it does not
  replace real retailer link handoff/failure QA, native modal/outbound-link QA,
  ShopMy or fallback partner approval, source-cleared catalog QA, final legal
  paid-link consent copy, or production domain verification.
- 2026-07-08: Source-contract and Expo web follow-up hardens the enabled
  `/commerce/consent` MHMDA consent sheet for native safe areas and modal
  semantics. With `EXPO_PUBLIC_PHASE7_COMMERCE_ENABLED=true`, in-app browser
  evidence at 320 px verifies one `Before we show where to buy` dialog with
  `aria-modal=true`, a 44 px top reserve, zero horizontal overflow, 48 x 48
  Dismiss, 264 x 54 Allow, 264 x 48 Not now, and no mojibake. Evidence is in
  `test-results/human-e2e/2026-07-08/commerce-consent-safe-area/`; screenshot
  capture was unavailable, and this does not replace native iOS/Android
  home-indicator, Dynamic Type, screen-reader, or outbound-link handoff QA.
- 2026-07-08: System Chrome Expo web E2E at 320 x 568 covers paywall and
  subscription settings external-handoff failure recovery. With
  `EXPO_PUBLIC_E2E_EXTERNAL_OPEN_FAILURE=all` and
  `EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro`, direct
  `/paywall/upsell?feature=full_routine` renders row-local `Link unavailable`
  after Terms/Privacy failure and a visible restore-empty message after Restore.
  Direct `/settings/subscription` renders store-backed `RoutineKind Pro`,
  `Manage in App Store`, Restore, Terms, and Privacy; failed billing management
  renders visible recovery copy and policy/restore failures stay on the current
  surface. Paywall compliance controls are 48 px+ tall, subscription rows are
  52-53 px tall, horizontal overflow is zero, and screenshots/metrics are in
  `test-results/human-e2e/2026-07-08/subscription-compliance-feedback-current/`. This
  does not replace native iOS/Android RevenueCat restore, native StoreKit/Play
  billing management, or final production policy URL QA.
- 2026-07-08: System Chrome Expo web E2E at 320 x 568 covers the lapsed paid
  entitlement branch for contextual routine paywalls. With
  `EXPO_PUBLIC_E2E_ENTITLEMENT=expired_store`, direct `/routine/plan` shows the
  paid recovery framing (`Restore Pro for`, `Renew Pro`), hides `Explore first.
7 days of Pro` and `Start free trial`, exposes no routine-plan content, keeps
  Renew/Terms/Privacy/Restore/Maybe later controls 48 px+ tall, and has zero
  horizontal overflow. Evidence is in
  `test-results/human-e2e/2026-07-08/lapsed-entitlement-contextual-paywall/`.
  This does not replace native RevenueCat expiry, refund, restore, or store
  purchase QA.
- 2026-07-08: System Chrome Expo web E2E at 320 x 568 covers the slow
  entitlement-resolution branch for contextual Pro gates. With
  `EXPO_PUBLIC_E2E_ENTITLEMENT=expired_store` and
  `EXPO_PUBLIC_E2E_ENTITLEMENT_DELAY_MS=2200`, direct `/routine/plan` shows the
  neutral `Checking your access` holding state while entitlement resolves,
  samples no premium routine-plan text during the delay, then resolves to the
  lapsed paid renewal paywall. The final paywall has zero horizontal overflow
  and Renew/Terms/Privacy/Restore/Maybe later controls are 48 px+ tall.
  Evidence is in
  `test-results/human-e2e/2026-07-08/slow-entitlement-no-flash/`. This does
  not replace native offline/cache, live RevenueCat slow-network, or device
  lifecycle QA.
- 2026-07-07: Fresh Chrome E2E at 320 x 568 covers representative Pro route
  locking and local reverse-trial unlocking. In fresh free state, direct
  `/routine/widgets`, `/cycle/settings`, and `/routine/plan` render the correct
  contextual paywalls with `Maybe later`, store-unavailable fallback copy,
  `Explore first. 7 days of Pro`, Terms/Privacy/Restore controls, zero
  horizontal overflow, and no browser errors. Starting the no-card reverse trial
  from `/routine/plan` unlocks the routine plan, direct `/cycle/settings` renders
  scheduler settings instead of the scheduler paywall, and `/routine/widgets`
  reaches the widget deferred surface with `Back to Today`. `/paywall/success`
  renders the compact success state cleanly, and direct
  `/paywall/upsell?feature=full_routine` dismisses with `Maybe later` to
  `/today`. Evidence is in
  `test-results/human-e2e/2026-07-07/pro-gating-current/`; it does not replace
  RevenueCat purchase/restore/native store-sheet QA, loading-state no-flash
  tracing, policy/billing link handoff failure QA, lapsed paid entitlement QA,
  or native scheduler/widget QA.
- 2026-07-07: Fresh Chrome E2E at 320 x 568 covers conflict-check quota direct
  routes with a seeded retinol/glycolic plus retinol/BHA shelf. The first free
  direct conflict detail renders the retinoid/AHA explanation and resolution,
  the second distinct direct conflict route renders the conflict-checks
  contextual paywall with `Explore first. 7 days of Pro`, and a 50 ms sampler
  saw zero locked-detail flash samples before the paywall settled. Starting the
  no-card reverse trial unlocks the retinoid/BHA detail, and reloading that same
  direct route as reverse-trial Pro keeps the full detail visible. Focused
  `conflictQuota` and gated-route contract tests pass. Evidence is in
  `test-results/human-e2e/2026-07-07/conflict-quota-direct-routes-current/`; it
  does not replace native billing, RevenueCat restore, or dermatologist review of
  the starter conflict matrix.
- 2026-07-07: In-app browser E2E at 320 x 568 covers scheduler cycle-night
  labels with a local reverse-trial entitlement and two shelf actives. Before
  the fix, `/cycle/week` and `/cycle/settings` rendered customer-facing `N1`,
  `N2`, etc. labels. Post-fix, both routes render `Night 1`, `Night 2`, etc.,
  contain no `N#` visible labels, keep zero horizontal overflow, and expose no
  clipped or sub-44 px visible controls. Evidence is in
  `test-results/human-e2e/2026-07-07/cycle-night-labels-current/`; it does not
  replace real iOS/Android scheduler QA or native Dynamic Type QA.
- 2026-07-08: Codex in-app browser Expo web at 320 x 568 covers the
  unreviewed cycle-cadence production gate with an active Pro fixture and
  `EXPO_PUBLIC_E2E_ROUTINE_CADENCE_REVIEW_GATE=closed`. Direct `/cycle/week`,
  `/cycle/settings`, and `/cycle/why-tonight` show review-gate copy while
  cadence review remains closed, keep AM/daily-routine reassurance visible,
  hide Settings/variant/night controls, hide cycle rows and pause/recovery
  banners, avoid `add an active/build your cycle` promises, keep visible
  controls 48 px+ (56 px on `Got it`), and have zero horizontal overflow.
  `Got it` from direct `/cycle/why-tonight` returns to `/today`. Evidence is in
  `test-results/human-e2e/2026-07-08/cycle-cadence-review-gate-current/`; this
  does not replace native iOS/Android bottom-sheet, safe-area, screen-reader,
  or reviewer-signoff QA.
- 2026-07-08: Codex in-app browser Expo web at 320 x 568 covers the full nested
  scheduler route group. Fresh free direct `/cycle/settings`,
  `/cycle/disruption`, `/cycle/recovery`, `/cycle/why-tonight`,
  `/cycle/phased-intro`, and `/cycle/procedure` all render the scheduler
  contextual paywall with no route-body content, zero horizontal overflow, and
  no sub-44 px visible controls. The local no-card reverse trial unlocks the
  same route group; a manual retinol plus glycolic shelf fixture and the
  phased-intro `Add it now anyway` override produce scheduled settings rows
  (`Night 1` glycolic, `Night 2` retinol), Why Tonight APART trace copy,
  disruption options, phased-intro/procedure surfaces, empty recovery, and
  active recovery after `Start recovery`. `Ease back in` returns to `/today`.
  Evidence is in
  `test-results/human-e2e/2026-07-08/nested-scheduler-routes-current/`; this
  does not replace native iOS/Android bottom-sheet, safe-area, Dynamic Type,
  screen-reader, or live RevenueCat/Supabase entitlement QA.
- 2026-07-07: In-app browser E2E at 320 x 568 covers the Today AM check-off
  loop with a local shelf routine: complete `Mineral SPF 50`, undo back to
  `0 of 1`, re-complete, reload Today, and verify the checked `1 of 1` state
  persists with zero horizontal overflow and no sub-44 px visible controls.
  Evidence is in
  `test-results/human-e2e/2026-07-07/today-checkoff-persistence/`; it does not
  replace real iOS/Android beta-device QA.
- 2026-07-08: Codex in-app browser Expo web E2E at 320 x 568 covers the current
  append-only Today AM check-off contract with a local manual shelf product:
  add `Cream cleanser`, open `/today?routine=AM`, verify `0 of 1`, complete the
  row to `1 of 1`, tap the completed row again, reload Today, and verify the
  row remains `aria-checked=true` / `1 of 1` with zero horizontal overflow and
  no current-origin warning/error logs. Evidence is in
  `test-results/human-e2e/2026-07-08/today-checkoff-append-only/`; it does not
  replace native iOS/Android beta-device QA, offline sync QA, or secure-storage
  timing checks.
- 2026-07-08: System Chrome Expo web E2E at 320 x 568 covers Today empty-routine
  recovery and compact PM cycle-strip readability. Empty local state now shows
  `No routine yet`, `Build a routine from your shelf.`, and a 56 px `Add
products` action without showing the example `Cream cleanser` or `Morning
routine` check-off rows; tapping the action routes to `/shelf/manual`. A
  seeded six-night PM cycle shows split two-line Exfoliate/Retinoid/Recover
  labels with full accessibility labels, zero horizontal overflow, and no
  visible sub-44 px controls. Evidence is in
  `test-results/human-e2e/2026-07-08/today-empty-and-cycle-current/`; it does
  not replace native iOS/Android beta-device QA, Dynamic Type QA, or native
  secure-storage timing checks.
- 2026-07-07: In-app browser E2E at 320 x 568 covers recommendation dismissal
  persistence and the dismissed-card cold-start branch: open `/recommendations`,
  open `A ceramide moisturiser`, tap `Not for me`, confirm the hub recomputes to
  the remaining cleanser card, reload, and poll 25 startup samples without the
  dismissed card flashing or resurfacing. Evidence is in
  `test-results/human-e2e/2026-07-07/recommendation-dismissal-cold-start/`; it
  does not replace real iOS/Android beta-device QA.
- 2026-07-07: In-app browser E2E at 320 x 568 covers recommendation acceptance
  into shelf intake: open the remaining `A gentle cleanser` detail, tap
  `Add to shelf`, and verify `/shelf/manual?presetCategory=cleanser` with the
  `Cleanser` category prefilled, visible controls at least 48 px tall, and zero
  horizontal overflow. Evidence is in
  `test-results/human-e2e/2026-07-07/recommendation-accept-manual-add/`; it does
  not replace real iOS/Android beta-device QA.
- 2026-07-07: Expo web E2E at 320 x 568 and 390 x 568 plus focused route
  contracts cover compact For You hub card fit: `/recommendations` renders three
  recommendation cards with zero horizontal overflow and no visible sub-44 px
  controls; at 320 x 568 the second card is fully visible with its evidence and
  `See how` row, a 169 px card height, and a 34 px bottom gap. Evidence is in
  `test-results/human-e2e/2026-07-07/recommendations-hub-compact-card-fit/`; it
  does not replace real iOS/Android beta-device QA.
- 2026-07-07: Follow-up in-app browser E2E at 320 x 568 and 390 x 568 covers the
  compact For You hub scroll continuation after a route sweep found the third
  recommendation card entering the first viewport as a 19 px tappable sliver.
  `/recommendations` now keeps only the first two recommendation cards visible
  in the initial compact viewport, with zero horizontal overflow, no visible
  sub-44 px controls, and no partial small visible controls. Evidence is in
  `test-results/human-e2e/2026-07-07/recommendations-hub-narrow-scroll-continuation/`;
  it does not replace real iOS/Android beta-device QA or native Dynamic Type QA.
- 2026-07-08: System Chrome Expo web E2E at 320 x 568 and 320 x 480 plus focused
  route contracts cover the compact For You "you're set" state. The pre-fix pass
  found the empty state on a non-scrollable fixed view, with content extending to
  602 px at 320 x 568 and 558 px at 320 x 480. `/recommendations` now uses the
  compact scrollable empty-state layout, keeps the completion icon clear of the
  hub subtitle in the first viewport, has zero horizontal overflow and no
  sub-44 px controls, shows the footnote fully at 320 x 568, and makes it fully
  reachable after scroll at 320 x 480. Evidence is in
  `test-results/human-e2e/2026-07-08/recommendations-youre-set-compact/`; it
  does not replace real iOS/Android beta-device QA or native Dynamic Type QA.
- 2026-07-07: In-app browser E2E at 320 x 568 and 390 x 568 plus focused
  Community route contracts cover compact Skin Notes hub card fit: `/community`
  renders the first three note cards fully at 320 x 568 and the first four note
  cards fully at 390 x 568, with zero horizontal overflow and no visible
  sub-44 px controls. Evidence is in
  `test-results/human-e2e/2026-07-07/community-hub-compact-card-fit/`; it does
  not replace real iOS/Android beta-device QA or native Dynamic Type QA.
- 2026-07-07: Expo web E2E at 320 x 568 and 390 x 568 plus focused route
  contracts cover compact recommendation preferences: open
  `/recommendations/preferences`, verify `Drugstore`, `Mid-range`, and `Premium`
  keep a readable one-row budget layout, verify `Gel`, `Cream`, `Fluid`, `Balm`,
  and `Oil` stay fully visible as 48 px texture chips on 390 px phones, then tap
  `Oil` and confirm the compact chips remain reachable without horizontal
  overflow or sub-44 px controls. Evidence is in
  `test-results/human-e2e/2026-07-07/recommendation-preferences-texture-clearance/`;
  it does not replace real iOS/Android beta-device QA.
- 2026-07-08: System Chrome Expo web E2E at 320 x 568 plus focused route
  contracts cover recommendation preference save failure recovery with a
  one-shot local persistence failure and a 1.2s save delay. `Vegan` remains
  `aria-selected=false` and disabled while the failed save is pending, the route
  shows stable `Preference not saved` recovery copy after rejection with no
  JS/system dialog, retry disables the chips again, and `Vegan` becomes
  `aria-selected=true` only after the successful save. Reload preserves the
  saved selection, every visible control remains 48 px tall, and horizontal
  overflow stays zero. Evidence is in
  `test-results/human-e2e/2026-07-08/recommendation-preference-save-failure-current/`;
  it does not replace real iOS/Android beta-device QA.
- 2026-07-07: In-app browser E2E at 320 x 568 covers stale recommendation detail
  recovery: direct-open `/recommendations/stale-local-rec`, verify the stale
  suggestion copy and 48 px `Back to For you` action, tap it, and confirm the
  app returns to `/recommendations` with zero horizontal overflow. Evidence is in
  `test-results/human-e2e/2026-07-07/recommendation-stale-detail-recovery/`; it
  does not replace real iOS/Android beta-device QA.
- 2026-07-07: In-app browser E2E at 320 x 568 covers the direct routine-plan
  no-card path: direct-open `/routine/plan`, verify the contextual paywall
  controls are at least 48 px with zero horizontal overflow, tap `Explore first.
7 days of Pro`, verify a `BUILT FROM YOUR SHELF` plan and a visible 56 px
  `Start today` CTA, then tap it and confirm `/today` opens. Evidence is in
  `test-results/human-e2e/2026-07-07/routine-plan-current-compact-check/`; it
  does not replace real iOS/Android beta-device QA.
- 2026-07-07: Codex in-app browser E2E at 320 x 568 covers realistic routine
  generation from front-label shelf products and the sparse daytime-only shelf.
  Adding `Retinol 0.3% Night Serum`, `Glycolic 7% Toner`, and `Mineral SPF 50`
  from `/onboarding/products` produces a `BUILT FROM YOUR SHELF` plan with SPF
  in Morning, Glycolic on Night 1, Retinol on Night 2, and `Timing handled`; the
  PM Today handoff opens the Glycolic check-off and reaches `1 of 1`. Removing
  night actives so only `Mineral SPF 50` remains keeps `/routine/plan` and Today
  PM honest with `No night steps yet.` and no stale skin-cycling, retinol,
  glycolic, or recover copy. Focused routine generation, plan, cycle-anchor, and
  scheduler-cycle tests pass. Evidence is in
  `test-results/human-e2e/2026-07-07/routine-front-label-products-current/`; it
  does not replace native iOS/Android beta-device QA or reviewer signoff for
  cadence/conflict guidance.
- 2026-07-08: System Chrome Expo web E2E at 320 x 568 with
  `EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro` covers the routine-plan empty example
  label, real local profile label, compact evening row fit, and direct-entry
  Back recovery. Empty local state shows `EXAMPLE ROUTINE` and `Example only`
  without dry/sensitive profile copy. A seeded local profile/shelf shows `BUILT
FOR OILY, RESISTANT SKIN`, `Gel cleanser`, and `Mineral SPF 50` with no
  hardcoded dry/sensitive copy, no truncated compact PM suffix, zero horizontal
  overflow, and 44 px+ visible controls. Back returns to `/you`. Browser logs
  contain expected dev/placeholder configuration warnings but no failed
  placeholder Supabase request after the consent backend guard. Evidence is in
  `test-results/human-e2e/2026-07-08/routine-plan-profile-label-current/`; it
  does not replace native iOS/Android beta-device QA or live Supabase profile
  reconciliation.
- 2026-07-07: In-app browser E2E at 320 x 568 covers the Shelf product-detail
  routine handoff: open `Mineral SPF 50` from Shelf, verify the `ROUTINE ROLE`
  card says it is used in the Morning routine, tap `Review routine placement`,
  and confirm `/routine/plan` renders with zero horizontal overflow. Evidence is
  in
  `test-results/human-e2e/2026-07-07/shelf-product-detail-routine-role-current/`;
  it does not replace real iOS/Android beta-device QA.
- 2026-07-07: In-app browser E2E plus focused contracts cover compact privacy
  direct entry after the policy-buffer calibration: `/settings/privacy` redirects
  to `/you?section=privacy` at 320 x 568 and 390 x 568, lands on complete privacy
  controls, keeps `POLICIES` below the first viewport, has zero horizontal
  overflow, and has no non-tab controls in the floating tab-bar zone. Focused
  route contract, full typecheck, lint, and test suite passed. Evidence is in
  `test-results/human-e2e/2026-07-07/settings-privacy-policy-buffer/`. Native
  iOS/Android rendering still needs device QA.
- 2026-07-08: System Chrome Expo web E2E at 320 x 568 with
  `EXPO_PUBLIC_E2E_EXTERNAL_OPEN_FAILURE=browser` covers Settings policy/help
  handoff failure recovery. The pre-fix pass found no observable browser dialog
  or persistent in-app feedback when the shared opener failed. `/settings/privacy`
  now keeps users on `/you?section=privacy` and renders row-local
  `Link unavailable` recovery copy for Privacy policy, Consumer health privacy,
  Terms, Support, Account deletion, and Data export. All six rows are 70-94 px
  tall, each recovery message is 48 px tall, and horizontal overflow is zero.
  Evidence is in
  `test-results/human-e2e/2026-07-08/settings-policy-link-failure/`; it does
  not replace native iOS/Android OS handoff failure QA or final policy URL QA.
- 2026-07-07: In-app browser E2E at 320 x 568 covers the Progress first-photo
  non-destructive branch: open `/progress`, tap `Take my first photo`, verify
  `/progress/capture` local-only consent copy and 48 px+ visible controls, tap
  `Not now`, and confirm `/progress` returns with zero horizontal overflow.
  Evidence is in
  `test-results/human-e2e/2026-07-07/progress-current-compact-check/`; it does
  not replace native camera/capture QA.
- 2026-07-08: In-app browser Expo web E2E at 320 x 568 covers single-photo
  detail share failure recovery. With `EXPO_PUBLIC_E2E_PROGRESS_PHOTOS=populated`,
  `EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro`, and
  `EXPO_PUBLIC_E2E_SHARE_PHOTO_FAILURE=1`, direct
  `/progress/e2e-front-2026-04-01` renders fully visible 48 px Back, Set as
  reference, Share, and Delete controls; tapping Share opens a route-owned
  confirmation panel with fully visible Cancel and Share photo controls; failed
  sharing closes the panel, keeps the photo route, and renders the
  share-unavailable copy as an accessible alert above the 48 px action row.
  Horizontal overflow is zero and browser warn/error logs are empty. Evidence is
  in `test-results/human-e2e/2026-07-08/progress-photo-detail-share-failure-current/`;
  it does not replace native iOS/Android share-sheet and encrypted export QA.
- 2026-07-07: In-app browser E2E at 320 x 568 covers Ask route parity: `/ask`
  renders the free deterministic `Ask RoutineKind` advisor, a 48 px composer
  and Send control, and the disclosure footer with zero horizontal overflow;
  `/ask/consent` renders cloud-Ask deferred beta copy plus a 56 px `Back to Ask`
  CTA that returns to `/ask`. Evidence is in
  `test-results/human-e2e/2026-07-07/ask-current-compact-advisor/`; it does not
  replace native-device QA.
- 2026-07-08: System Chrome E2E at 320 x 568 covers the Ask direct-entry
  navigation follow-up. Direct `/ask` renders the deterministic advisor, reload
  preserves the advisor, the 48 px Back control routes to `/today`, direct
  `/ask/consent` renders the deferred cloud Ask beta surface, and its 272 x
  56 px `Back to Ask` CTA routes back to `/ask`. All five captured states have
  zero horizontal overflow and no browser errors. Evidence is in
  `test-results/human-e2e/2026-07-08/ask-navigation-direct-entry/`; it does not
  replace native keyboard, screen-reader, or OS back-swipe QA.
- 2026-07-08: Codex in-app browser Expo web E2E at 320 x 568 covers the enabled
  Ask cloud-consent save and withdrawal failure branch with
  `EXPO_PUBLIC_PHASE7_CLOUD_ASK_ENABLED=true`,
  `EXPO_PUBLIC_E2E_ASK_CONSENT_FAILURE=grant_once,revoke_once`, and
  `EXPO_PUBLIC_E2E_ASK_CONSENT_LEDGER=local_only`. The run found and fixed a
  shared web `ToggleSwitch` activation bug where the switch exposed the correct
  52 x 48 role/geometry but did not toggle because web disabled `onPress`.
  Post-fix, failed grant keeps the switch off and renders route-owned
  `Choice not saved`, grant retry turns it on and clears the alert, failed
  withdrawal keeps it on, and withdrawal retry turns it off. No JavaScript
  dialog appears, no raw fixture/provider error is visible, horizontal overflow
  is zero, and current-run browser warn/error logs are empty. Evidence is in
  `test-results/human-e2e/2026-07-08/ask-consent-failure-current/`; it does not
  replace native iOS/Android switch, VoiceOver/TalkBack, or live Supabase
  consent-ledger QA.
- 2026-07-07: In-app browser E2E at 320 x 568 covers the Ask first-prompt and
  typed active-frequency branch: tapping `Is there a conflict on my shelf?`
  keeps the empty-shelf deterministic answer, report control, fixed composer,
  and disclosure readable with zero horizontal overflow and no sub-44 px
  controls. The typed `Should I use retinol every night?` regression now
  escalates safely and does not show fit-engine, SPF, or vitamin-C
  recommendation text. Focused Ask intent, answer, and route-contract tests
  pass. Evidence is in
  `test-results/human-e2e/2026-07-07/ask-first-prompt-compact-current/`, with
  additional Node REPL Playwright/system Chrome evidence in
  `test-results/human-e2e/2026-07-07/ask-active-frequency-escalation/`; native
  keyboard/screen-reader QA remains device follow-up.
- 2026-07-08: Codex in-app browser Expo web at 320 x 480 covers the Ask
  shortest-phone composer-clearance fix. Pre-fix evidence reproduced lower
  empty-state prompt buttons being intercepted by the fixed composer. Post-fix,
  `/ask` hides decorative pills on the shortest phones, shows the top two prompt
  buttons above the composer, verifies prompt centers hit their own buttons,
  and after tapping `Is there a conflict on my shelf?` keeps the empty-shelf
  answer, 48 px report control, 48 px input, Send, and disclosure hit-testable.
  Horizontal overflow is zero, no visible control is below 44 px, no JavaScript
  dialog appears, and browser warn/error logs contain only expected local
  placeholder warnings. Evidence and bug report are in
  `test-results/human-e2e/2026-07-08/ask-short-phone-480-composer-clearance/`
  and
  `docs/e2e-bug-reports/2026-07-08-ask-short-phone-composer-overlap.md`; native
  keyboard, Dynamic Type, and screen-reader traversal remain device follow-up.
- 2026-07-07: In-app browser E2E at 320 x 568 covers the Skin Notes expert
  library happy path: `/community` shows topic groups, evidence labels, and
  explicit library-not-feed copy with zero horizontal overflow; opening the
  niacinamide/vitamin C note shows claim, evidence, reviewer, and cosmetic-info
  disclaimer context, and Back returns to `/community`. Evidence is in
  `test-results/human-e2e/2026-07-07/community-current-compact-check/`; it does
  not replace native-device QA.
- 2026-07-07: Expo web E2E at 320 x 568 plus focused route contracts cover
  Community posting-deferred direct entries: `/community/ask` and
  `/community/people-like-you` explain peer posting is not in beta, use a
  destination-specific `Back to Skin Notes` CTA, route back to `/community`, keep
  the fallback CTA 100 px tall, and have zero horizontal overflow. Evidence is in
  `test-results/human-e2e/2026-07-07/community-deferred-routes/`; it does not
  replace native-device QA or the posting-enabled consent/moderation gate.
- 2026-07-07: In-app browser E2E at 320 x 568 covers stale Skin Note recovery:
  direct `/community/note/[id]` for a missing note shows the unavailable-state
  copy, explains that the note may have been updated or removed during expert
  review, exposes a 56 px `Back to Skin Notes` CTA, and returns to `/community`
  with zero horizontal overflow. Evidence is in
  `test-results/human-e2e/2026-07-07/community-missing-note-current-check/`; it
  does not replace native-device QA.
- 2026-07-08: In-app browser Expo web E2E at 320 x 568 with
  `EXPO_PUBLIC_E2E_SHARE_NOTE_FAILURE=1` covers Skin Note share failure
  recovery: direct `/community/note/note-niacinamide-vitc` renders the expert
  note detail, the `Share note` control is 128 x 48, tapping it keeps the route
  on the note and renders the failed-share recovery copy as an accessible alert
  with zero horizontal overflow. Evidence is in
  `test-results/human-e2e/2026-07-08/community-note-share-failure-current/`; it
  does not replace native iOS/Android OS share-sheet QA.
- 2026-07-07: Expo web E2E at 320 x 568 and 390 x 568 covers Shelf direct-entry
  recovery after the search fallback buffer fix: `/shelf/add`, `/shelf/manual`,
  `/shelf/search`, `/shelf/ocr`, `/shelf/scan`, `/shelf/no-match`,
  `/shelf/opened`, `/shelf/archive`, stale `/shelf/[id]`, and stale
  `/shelf/replenish` render with zero horizontal overflow; `/shelf/search`
  keeps the 56 px `Add by hand` fallback 32 px above the bottom edge and routes
  to `/shelf/manual`; stale detail and replenish recover to `/shelf` or
  `/shelf/manual`. Evidence is in
  `test-results/human-e2e/2026-07-07/shelf-search-manual-fallback-buffer/`; it
  does not replace native-device QA.
- 2026-07-07: In-app browser E2E at 320 x 568 covers the compact Shelf manual
  category picker follow-up: the prior inline nested list let the fixed Continue
  footer intercept lower visible row hit tests, so `/shelf/manual` now opens the
  category list as a dimmed bottom sheet with a visible Close action and 52 px
  rows. The rerun scrolls to `Something else`, verifies that row is visible and
  center-tappable, selects it so the collapsed field reads `Other`, and
  continues to `/shelf/opened` with zero horizontal overflow. Evidence is in
  `test-results/human-e2e/2026-07-07/shelf-manual-category-picker-current/`; it
  does not replace native iOS/Android gesture and Dynamic Type QA.
- 2026-07-08: Source-contract follow-up hardens `/shelf/manual` category picker
  safe-area behavior for native gesture insets and very short phones. The
  route-local sheet now owns its viewport cap, reserves 44 px outside-dismiss
  space, applies bottom inset padding only when present, and exposes web dialog
  semantics. In-app browser evidence confirms the compact collapsed route has
  zero horizontal overflow and 50+ px visible controls at 320 px; browser input
  dispatch failed before modal-open recapture. Evidence is in
  `test-results/human-e2e/2026-07-08/shelf-manual-category-picker-safe-area/`;
  this does not replace native iOS/Android home-indicator, Dynamic Type, or
  screen-reader QA.
- 2026-07-08: In-app browser Expo web E2E at 320 x 568 covers Shelf add
  recovery across search no-match, barcode/offline fallback, no-match sheet
  routing, and archive recovery after finishing a product. Local fixtures force
  catalog search no-match and barcode offline states; the run verifies manual,
  search, and label-scan fallbacks without contribution-back promises, adds
  `E2E Archive Balm`, marks it finished, fixes the discovered compact empty
  Shelf bug where `View archive (1)` was covered by the floating tab bar, and
  reruns the archive path so `/shelf/archive` opens with the finished product
  visible. Evidence and the bug report are in
  `test-results/human-e2e/2026-07-08/shelf-add-recovery-current/`; this does
  not replace native barcode camera/OCR QA, live Open Beauty Facts lookup,
  Supabase `shelf_scans` insert/RLS evidence, or real-device safe-area and
  screen-reader QA.
- 2026-07-08: Codex in-app browser Expo web at 320 x 568 covers the Shelf
  opened-date and replenishment boundary branch. `/shelf/opened` shows all three
  core opened-state choices before PAO/save controls on a short phone, a
  `3 months ago` + `3 mo` PAO boundary product produces `0 days left`, and the
  fixed replenish prompt explains the trigger as `PAO or printed date` with
  `not an alarm` copy instead of manufactured scarcity. `Re-add the same one`
  resets the active unit to `opened Jul`, `3 mo PAO`, and `Oct 2026` while
  preserving one archived prior unit. Evidence and the bug report are in
  `test-results/human-e2e/2026-07-08/shelf-opened-replenish-boundary-current/`
  and `docs/e2e-bug-reports/2026-07-08-shelf-replenish-scarcity-copy.md`; this
  does not replace native iOS/Android bottom-sheet, Dynamic Type, screen-reader,
  or restart-persistence QA.
- 2026-07-08: In-app browser Expo web E2E at 320 x 568 covers Shelf OCR label
  capture failure recovery with `EXPO_PUBLIC_E2E_SHELF_OCR_CAPTURE_FAILURE=once`.
  The route now avoids Shelf OCR native/system alert calls, shows inline
  `Label wasn't captured` recovery copy, keeps a 48 px `Try label photo again`
  action outside the bottom CTA zone, lets the user enter manual ingredient
  text, and carries that text into `/shelf/manual`. Evidence and the bug report
  are in
  `test-results/human-e2e/2026-07-08/shelf-ocr-capture-failure-current/` and
  `docs/e2e-bug-reports/2026-07-08-shelf-ocr-capture-failure-inline-recovery.md`;
  this does not replace native iOS/Android camera mount, permission-denied, or
  real `takePictureAsync` rejection QA.
- 2026-07-08: Codex in-app browser Expo web at 320 x 568 covers Shelf scan/OCR
  camera permission denied recovery with
  `EXPO_PUBLIC_E2E_SHELF_CAMERA_PERMISSION=denied_no_retry`,
  `EXPO_PUBLIC_E2E_APP_SETTINGS_FAILURE=1`, and
  `EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro`. `/shelf/scan` and `/shelf/ocr` each
  render one `Open settings` action, the forced Settings failure opens no
  JavaScript dialog, and both routes show inline `Camera settings unavailable`
  recovery with no raw fixture text, zero horizontal overflow, and 48 px+
  visible controls. Scan keeps Search catalog, Scan ingredient label, and Add it
  by hand available; OCR keeps manual text available, accepts
  `Aqua, Glycerin, Niacinamide`, and carries it into `/shelf/manual`. Evidence
  and report are in
  `test-results/human-e2e/2026-07-08/shelf-camera-permission-denied-current/`;
  this does not replace native iOS/Android OS permission-sheet, real Settings
  handoff, barcode camera, OCR camera, or safe-area QA.
- 2026-07-07: Codex in-app browser E2E at 320 x 568 covers shared `Sheet`
  safe-area and hidden-backdrop behavior. `/shelf/no-match` exposes one modal
  dialog, a 48 px Close action, no sub-44 exposed controls, a hidden 12 px
  backdrop strip with `aria-hidden=true` and `tabIndex=-1`, zero horizontal
  overflow, and Close returns to `/shelf`. `/cycle/disruption` keeps all four
  compact disruption choices visible with no sub-44 exposed controls, a
  non-focusable hidden backdrop, zero horizontal overflow, and the intended
  24 px web bottom padding after the native safe-area hardening. Evidence is in
  `test-results/human-e2e/2026-07-07/shared-sheet-safe-area-current/`; it does
  not replace native iOS/Android safe-area, VoiceOver/TalkBack, or gesture-nav
  QA.
- 2026-07-07: In-app browser E2E at 320 x 568 covers the reminders/widgets
  contextual paywall compact route: direct-open
  `/paywall/upsell?feature=reminders_widgets`, verify the long title, fallback
  store-copy, Terms/Privacy/Restore row, `Start free trial`, and `Maybe later`
  are readable with zero horizontal overflow, no clipped elements, and visible
  controls at least 48 px tall, then tap `Maybe later` and confirm the route
  recovers to `/today`. Evidence is in
  `test-results/human-e2e/2026-07-07/paywall-upsell-reminders-compact/`; it does
  not replace native RevenueCat purchase, restore, or device rendering QA.
- 2026-07-07: In-app browser E2E at 320 x 568 plus focused settings contracts
  cover local privacy/data-rights recovery: direct-open `/settings/privacy`,
  verify it resolves to `/you?section=privacy`, tap `Export my data` with the
  local backend unavailable, confirm the visible privacy-request failure copy,
  zero horizontal overflow, and 56 px visible data-rights controls, then dismiss
  destructive Delete/Withdraw prompt attempts and confirm the app stays on the
  privacy surface. Evidence is in
  `test-results/human-e2e/2026-07-07/settings-privacy-data-rights-current/`; it
  does not replace live Supabase export/delete/withdrawal QA or native share
  sheet QA.
- 2026-07-07: In-app browser E2E at 320 x 568 plus focused notification tests
  cover local reminder settings and timing: open `/settings/notifications`, verify
  tier switches, row labels, zero horizontal overflow, and 48 px visible controls,
  open `/settings/timing` from the Morning row, change the AM reminder from
  7:30 AM to 8:00 AM through the named time-picker sheet, and confirm the updated
  time returns to the notifications hub. The timing screen also shows quiet-hours
  copy and the generic lock-screen preview. Evidence is in
  `test-results/human-e2e/2026-07-07/settings-reminder-timing-current/`; it does
  not replace native notification permission, OS scheduling, or device timezone/DST
  QA.
- 2026-07-07: Codex in-app browser E2E covers the hand-built `/settings/timing`
  time-picker sheet after native safe-area and compact-dismiss hardening. The
  Morning picker keeps 40 px bottom padding on the zero-inset web surface, has
  zero horizontal overflow, exposes one named dialog, 48 px visible picker rows,
  and a named dismiss target that remains 44 px in the compact observed
  viewport after sheet-height capping. Selecting `8:00 AM` closes the modal and
  updates the Morning pill. Evidence is in
  `test-results/human-e2e/2026-07-07/settings-time-picker-safe-area-current/`;
  it does not replace native iOS/Android home-indicator, VoiceOver/TalkBack, or
  OS scheduling QA.
- 2026-07-07: In-app browser E2E at 320 x 568 and 390 x 568 plus the paywall mobile contract
  covers lifecycle paywall compact footer buffers: `/paywall/reoffer` and
  `/paywall/downgrade` keep fixed footer actions outside the scroll body, expose
  Terms/Privacy/Restore after a normal scroll with 48 px controls above the fixed
  footer, keep the decline actions 48 px tall with a 32 px bottom buffer, render
  unavailable-store copy calmly, route the decline actions to `/today`, and have zero horizontal overflow. Evidence is
  in
  `test-results/human-e2e/2026-07-07/paywall-lifecycle-bottom-buffer/`;
  it does not replace native RevenueCat lifecycle purchase/restore QA.
- 2026-07-07: In-app browser E2E at 320 x 568 and 390 x 568 plus the paywall mobile contract
  covers active reverse-trial subscription keep options: `/settings/subscription`
  shows the no-card reverse-trial state, tapping `Keep Pro after your week`
  opens `/paywall/reoffer`, the keep-options screen uses active no-card copy
  instead of expired-trial copy, the annual price and store-unavailable reason
  appear before the keep-Pro CTA on the compact viewport, Terms/Privacy/Restore
  remain scroll-reachable as 48 px controls above the fixed footer, and
  horizontal overflow is zero.
  Evidence is in
  `test-results/human-e2e/2026-07-07/reverse-trial-keep-options-current/`;
  it does not replace native RevenueCat purchase, restore, or billing-management
  QA.
- 2026-07-07: In-app browser E2E at 320 x 568 plus the paywall mobile contract
  covers compact monthly-equivalent price labels: Progress, `/routine/plan`,
  `/onboarding/paywall`, and `/paywall/upsell?feature=full_routine` now render
  the secondary monthly equivalent as one readable `$4.16/mo` line instead of a
  cramped `$4.16 /mo` split, while preserving the annual billed amount as the
  dominant price. Evidence is in
  `test-results/human-e2e/2026-07-07/paywall-monthly-equivalent-compact-line/`;
  it does not replace native RevenueCat price localization, purchase, or restore
  QA.
