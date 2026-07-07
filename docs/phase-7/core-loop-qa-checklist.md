# Phase 7 Core Loop QA Checklist

Run this checklist on real iOS and Android beta builds before enabling public production distribution.

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
- Cloud backup is off by default and separate from capture consent.
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
- 2026-07-07: Expo web E2E at 320 x 568 covers runtime brand identity on
  `/ask`, `/paywall/upsell?feature=full_routine`, and
  `/settings/subscription`: the checked surfaces render `Ask RoutineKind` and
  `RoutineKind Pro`, no visible `OnSkin` labels appear, and browser console
  errors are empty. `npm run brand:audit:strict` also reports zero
  public-launch-risk and zero review-needed references. Evidence is in
  `test-results/human-e2e/2026-07-07/runtime-brand-identity/`; it does not
  replace final brand/legal clearance, native identifier QA, store listing QA, or
  final-domain/share-card QA.
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
  not replace real reviewed conflict persistence QA, native share-sheet export
  QA, public-link final domain QA, or reviewed conflict-rule content approval.
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
  RevenueCat purchase/restore/native store-sheet QA, conflict-check quota UI QA,
  loading-state no-flash tracing, policy/billing link handoff failure QA, lapsed
  paid entitlement QA, or native scheduler/widget QA.
- 2026-07-07: In-app browser E2E at 320 x 568 covers the Today AM check-off
  loop with a local shelf routine: complete `Mineral SPF 50`, undo back to
  `0 of 1`, re-complete, reload Today, and verify the checked `1 of 1` state
  persists with zero horizontal overflow and no sub-44 px visible controls.
  Evidence is in
  `test-results/human-e2e/2026-07-07/today-checkoff-persistence/`; it does not
  replace real iOS/Android beta-device QA.
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
- 2026-07-07: In-app browser E2E at 320 x 568 covers the Progress first-photo
  non-destructive branch: open `/progress`, tap `Take my first photo`, verify
  `/progress/capture` local-only consent copy and 48 px+ visible controls, tap
  `Not now`, and confirm `/progress` returns with zero horizontal overflow.
  Evidence is in
  `test-results/human-e2e/2026-07-07/progress-current-compact-check/`; it does
  not replace native camera/capture QA.
- 2026-07-07: In-app browser E2E at 320 x 568 covers Ask route parity: `/ask`
  renders the free deterministic `Ask RoutineKind` advisor, a 48 px composer
  and Send control, and the disclosure footer with zero horizontal overflow;
  `/ask/consent` renders cloud-Ask deferred beta copy plus a 56 px `Back to Ask`
  CTA that returns to `/ask`. Evidence is in
  `test-results/human-e2e/2026-07-07/ask-current-compact-advisor/`; it does not
  replace native-device QA.
- 2026-07-07: In-app browser E2E at 320 x 568 covers the Ask first-prompt and
  typed active-frequency branch: tapping `Is there a conflict on my shelf?`
  keeps the empty-shelf deterministic answer, report control, fixed composer,
  and disclosure readable with zero horizontal overflow and no sub-44 px
  controls. The typed `Should I use retinol every night?` regression now
  escalates safely and does not show fit-engine, SPF, or vitamin-C
  recommendation text. Focused Ask intent, answer, and route-contract tests
  pass. Evidence is in
  `test-results/human-e2e/2026-07-07/ask-first-prompt-compact-current/`; native
  keyboard/screen-reader QA remains device follow-up.
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
- 2026-07-07: In-app browser E2E at 320 x 568 and 390 x 568 plus the paywall mobile contract
  covers lifecycle paywall compact footer buffers: `/paywall/reoffer` and
  `/paywall/downgrade` keep fixed footer actions outside the scroll body, expose
  Terms/Privacy/Restore after a normal scroll with 48 px controls above the fixed
  footer, keep the decline actions 48 px tall with a 32 px bottom buffer, render
  unavailable-store copy calmly, route the decline actions to `/today`, and have zero horizontal overflow. Evidence is
  in
  `test-results/human-e2e/2026-07-07/paywall-lifecycle-bottom-buffer/`;
  it does not replace native RevenueCat lifecycle purchase/restore QA.
- 2026-07-07: In-app browser E2E at 320 x 568 plus the paywall mobile contract
  covers compact monthly-equivalent price labels: Progress, `/routine/plan`,
  `/onboarding/paywall`, and `/paywall/upsell?feature=full_routine` now render
  the secondary monthly equivalent as one readable `$4.16/mo` line instead of a
  cramped `$4.16 /mo` split, while preserving the annual billed amount as the
  dominant price. Evidence is in
  `test-results/human-e2e/2026-07-07/paywall-monthly-equivalent-compact-line/`;
  it does not replace native RevenueCat price localization, purchase, or restore
  QA.
