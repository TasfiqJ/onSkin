# Phase 10 Beta Event Schema And Dashboards

Status: BLOCKED until dashboard links and privacy-payload evidence are attached.

The beta schema is frozen to answer whether real users reach value, return, trust the product, understand Pro, and can be supported. Do not add new beta analytics properties without updating `apps/mobile/src/lib/analytics/eventRegistry.ts`, this document, and the Phase 9 privacy payload audit.

## Privacy Rules

- Event properties must be from `ANALYTICS_ALLOWED_PROP_KEYS`.
- The sanitizer in `apps/mobile/src/lib/analytics/track.ts` must continue dropping sensitive keys and values.
- No product names, ingredient strings, free text, photo paths, image data, medical details, pregnancy status, user IDs, emails, names, raw OCR, diagnoses, or skin profile details may be sent to analytics.
- Sensitive research feedback belongs in the approved support/research workspace, not PostHog event properties.
- Dashboard exports must use tester IDs or cohorts, not contact details.

## Required Dashboards

| Dashboard                  | Required views                                                                                                           |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Enrollment and install     | invited, accepted, installed, first app open by platform/build/wave                                                      |
| Onboarding and first value | onboarding_started, account_created, product_add_started, product_added, first-value proxy, drop-off                     |
| Shelf and catalog          | barcode/search/manual mix, no-match, corrections, manual fallback completion                                             |
| Routine loop               | plan view, routine_created, first_useful_insight, first_checkoff_completed, routine_checkoff_completed, streak milestone |
| Photo and reminder         | permission prompt, capture, trend/progress usage, reminder opt-in/denial                                                 |
| Paywall and entitlement    | paywall_shown, contextual_paywall_shown, trial_started, purchase_completed, restore_tapped, manage_subscription_opened   |
| Privacy and support        | deletion/export requests, consent withdrawal, support categories, privacy escalations                                    |
| Release health             | crashes, ANRs, app-start, affected users, build adoption                                                                 |
| Retention cohorts          | D1, D7, D14, D30 by activated/not activated, platform, wave, first-value path                                            |

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
- `routine_created`
- `first_routine_created`
- `first_useful_insight`
- `conflict_detected`
- `first_checkoff_completed`
- `routine_checkoff_completed`
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
- `share_card_exported`
- `share_link_opened`
- `ask_opened`
- `review_prompt_attempted`

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
