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
