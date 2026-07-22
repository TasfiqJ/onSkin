# Phase 10 Beta Event Schema And Dashboards

Status: BLOCKED until dashboard links and privacy-payload evidence are attached.

The beta schema is frozen to answer whether real users reach value, return, trust the product, understand Pro, and can be supported. Do not add new beta analytics properties without updating `apps/mobile/src/lib/analytics/eventRegistry.ts`, this document, and the Phase 9 privacy payload audit.

The local `phase10:beta-analytics-audit` gate now checks the minimum event list
below against both `ANALYTICS_ALLOWED_EVENTS` and runtime `track(...)` calls in
non-test app source. A beta event is not considered ready if it is only
documented or allowlisted.

Phase H required events from `docs/CODEX_IMPLEMENTATION_PROMPT.md` are pinned
as a non-negotiable subset of the minimum coverage. Do not remove or rename:
`onboarding_started`, `product_added`, `first_useful_insight`,
`conflict_detected`, `routine_created`, `first_checkoff_completed`,
`routine_checkoff_completed`, `cycle_night_completed`, `photo_baseline_added`,
`paywall_shown`, `reverse_trial_started`, or `purchase_completed`.

## Privacy Rules

- Every event must have exactly one key/type/value schema in
  `ANALYTICS_EVENT_SCHEMAS`; the global `ANALYTICS_ALLOWED_PROP_KEYS` list is
  only the union of keys used by those event schemas. A key approved for one
  event is not approved for another event.
- Runtime filtering and the TypeScript `track(...)` signature use the same
  schema, including required keys, optional key groups, and mutually exclusive
  payload branches. An unknown key, cross-event key, missing required key,
  accessor, nested value, unsupported bucket, unsafe opaque ID, malformed
  app/build version, decimal, negative count, or count above 10,000 suppresses
  the event entirely; it is not converted into a misleading bare event.
- The source audit parses production TypeScript/JavaScript with the TypeScript
  AST. Calls must use a literal event and an inline object payload. Dynamic
  event names, payload identifiers, spreads, computed/duplicate keys,
  methods/accessors, relative/dynamic/barrel tracker acquisition, tracker
  escapes, parse failures, and event-schema drift are errors in ordinary Phase
  9 and Phase 10 verification. A 1-positive/36-negative isolated fixture matrix
  guards the parser, payload-shape coverage, immutable sanitizer handoff, and
  vendor boundary.
- Events with no property schema must be called without a payload. Events with
  property schemas must use an explicit inline payload. The two previously
  unused allowlist entries (`cloud_backup_opted_in` and `product_scanned`) are
  not registered events.
- Share-link attribution is limited to the fixed conflict-card campaign/source/
  medium/content/creative values, `ios|android|web`, a version-shaped app
  version, a numeric-or-`dev` build number, and an 8-64 character opaque share
  ID. `term`, arbitrary campaigns, and raw query values are not analytics
  properties.
- No product names, ingredient strings, free text, photo paths, image data, medical details, pregnancy status, user IDs, emails, names, raw OCR, diagnoses, or skin profile details may be sent to analytics.
- Sensitive research feedback belongs in the approved support/research workspace, not PostHog event properties.
- Dashboard exports must use tester IDs or cohorts, not contact details.

## Required Dashboards

| Dashboard                  | Required views                                                                                                                                            |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Enrollment and install     | invited, accepted, installed, first app open by platform/build/wave                                                                                       |
| Onboarding and first value | onboarding_started, account_created, product_add_started, product_added, first-value proxy, drop-off                                                      |
| Shelf and catalog          | barcode/search/manual mix, no-match, corrections, manual fallback completion                                                                              |
| Routine loop               | routine_plan_viewed, routine_created, first_useful_insight, first_checkoff_completed, routine_checkoff_completed, cycle_night_completed, streak milestone |
| Photo and reminder         | permission prompt, capture, trend/progress usage, reminder opt-in/denial                                                                                  |
| Paywall and entitlement    | paywall_shown, contextual_paywall_shown, trial_started, purchase_completed, restore_tapped, manage_subscription_opened                                    |
| Privacy and support        | deletion/export requests, consent withdrawal, support contact opened/failed, support categories, privacy escalations                                      |
| Release health             | crashes, ANRs, app-start, affected users, build adoption                                                                                                  |
| Retention cohorts          | D1, D7, D14, D30 by activated/not activated, platform, wave, first-value path                                                                             |

## Cohorts

- wave: wave_0_internal, wave_1_friendly, wave_2_target
- platform: ios, android
- build: exact app version and build number
- activation_state: installed, onboarded, product_added, first_value, first_checkoff
- catalog_state: matched, no_match, wrong_match_reported, manual_complete
- payment_state: paywall_seen, trial_started, purchase_completed, restore_attempted, restore_failed
- privacy_state: export_requested, deletion_requested, consent_revoked

## Minimum Event Coverage

The current app already emits the V1-loop events required for beta analysis. The dashboards must include at least:

- `onboarding_started`
- `screen_viewed`
- `account_created`
- `product_add_started`
- `product_added`
- `catalog_barcode_lookup`
- `catalog_search`
- `catalog_lookup_no_match`
- `catalog_correction_reported`
- `ingredient_parse_completed`
- `routine_plan_viewed`
- `routine_created`
- `first_routine_created`
- `first_useful_insight`
- `conflict_detected`
- `first_checkoff_completed`
- `routine_checkoff_completed`
- `cycle_night_completed`
- `photo_baseline_added`
- `photo_captured`
- `first_photo_captured`
- `notification_prompt_shown`
- `notification_prompt_granted`
- `notification_prompt_denied`
- `paywall_shown`
- `contextual_paywall_shown`
- `reverse_trial_started`
- `trial_started`
- `purchase_completed`
- `restore_tapped`
- `manage_subscription_opened`
- `support_contact_opened`
- `support_contact_failed`
- `landing_viewed`
- `share_card_exported`
- `share_link_opened`
- `ask_opened`
- `review_prompt_attempted`

Routine event definitions:

- `routine_plan_viewed`: any routine plan surface view, including examples.
- `routine_created`: a non-example plan with at least one executable AM or PM
  step.
- `first_routine_created`: the first `routine_created` event for the install or
  account marker.
- `first_useful_insight`: the first non-example plan insight, including a
  zero-step recovery insight that explains which product needs more details.

## Dashboard Acceptance

Each dashboard must have:

- owner
- link
- data source
- refresh cadence
- event definitions
- property definitions
- beta-wave filter
- platform/build filter
- privacy review date
- launch decision field

## Evidence Slots

| Item                                | Evidence |
| ----------------------------------- | -------- |
| PostHog dashboard links             | BLOCKED  |
| Sentry release health links         | BLOCKED  |
| Play Console Android vitals link    | BLOCKED  |
| App Store Connect analytics link    | BLOCKED  |
| RevenueCat cohort/dashboard link    | BLOCKED  |
| Support dashboard link              | BLOCKED  |
| Phase 9 privacy payload audit rerun | BLOCKED  |
| Dashboard owner signoff             | BLOCKED  |
