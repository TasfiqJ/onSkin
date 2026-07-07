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
- 2026-07-07: In-app browser E2E at 320 x 568 covers compact recommendation
  preferences: open `/recommendations/preferences` and verify the `Drugstore`,
  `Mid-range`, and `Premium` budget chips remain on one row, 48 px tall, fully
  visible within the viewport, and without horizontal overflow. Evidence is in
  `test-results/human-e2e/2026-07-07/recommendation-preferences-compact-current/`;
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
