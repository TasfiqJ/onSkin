# Phase 10 Beta Event Schema And Dashboards

Status: SOURCE CONTRACT IN PROGRESS / BLOCKED. No production analytics
transport is enabled. CAT-09 remains blocked until the separate analytics
consent and authoritative receipt-verification path, vendor/legal review, live
payload evidence, named dashboard ownership, links, and reviewed thresholds
exist.

The beta schema is frozen to answer whether real users reach value, return, trust the product, understand Pro, and can be supported. Do not add new beta analytics properties without updating `apps/mobile/src/lib/analytics/eventRegistry.ts`, this document, and the Phase 9 privacy payload audit.

The local `phase10:beta-analytics-audit` gate now checks the minimum event list
below against both `ANALYTICS_ALLOWED_EVENTS` and runtime `track(...)` calls in
non-test app source. A beta event is not considered ready if it is only
documented or allowlisted.

Phase H required events from `docs/CODEX_IMPLEMENTATION_PROMPT.md` are pinned
as a non-negotiable subset of the minimum coverage. Do not remove or rename:
`onboarding_started`, `product_added`, `first_useful_insight`,
`routine_created`, `first_checkoff_completed`, `routine_checkoff_completed`,
`cycle_night_completed`, `photo_baseline_added`, `paywall_shown`,
`reverse_trial_started`, or `purchase_completed`.

## Privacy Rules

- Event properties must be from `ANALYTICS_ALLOWED_PROP_KEYS`.
- The sanitizer in `apps/mobile/src/lib/analytics/track.ts` must continue dropping sensitive keys and values.
- No product names, ingredient strings, free text, photo paths, image data, medical details, pregnancy status, user IDs, emails, names, raw OCR, diagnoses, or skin profile details may be sent to analytics.
- Do not allow or emit `conflict_detected`, `conflict_detail_viewed`,
  `conflict_overridden`, or `conflict_resolution_chosen`. Do not substitute a
  generic event from a conflict-only detail or share route: the route itself
  reveals conflict existence.
- Sensitive research feedback belongs in the approved support/research workspace, not PostHog event properties.
- Dashboard exports must use tester IDs or cohorts, not contact details.

## Publication Boundary

`apps/mobile/src/lib/analytics/publicationGate.ts` is default closed and has no
event buffer, persistence, retry, or replay path. `track(...)` sanitizes the
event and its properties before attempting publication. The gate can open only
for an exact nonempty owner and an externally verified, owner-bound receipt at
the current gate generation, using an injected transport. Closing synchronously
discards that transport and receipt and increments the generation, so a stale
receipt cannot cross an account switch.

Account-deletion admission closes the gate synchronously through the deletion
barrier. Auth account, background, and deletion boundaries close it before
prior-owner cleanup or publication drains. Analytics identity reset also
closes before awaiting legacy persistence purge and stays closed if purge
fails. Events attempted before a valid open, after close, during deletion, or
with a stale generation are dropped and are never replayed.

There is no non-test production caller of `openAnalyticsPublication(...)`, no
approved analytics receipt verifier, and no injected vendor transport.
PostHog construction, capture, identify, and flush therefore remain disabled.
Environment keys do not open the gate. These source controls are not live
analytics, consent, vendor, legal, dashboard, or launch evidence.

## CAT-09 Fixed Event And Bucket Contract

Only the following coarse values may be used for the CAT-09 calculations
below. The source helpers accept no query, barcode, OCR text, token text,
product identity, exact duration, wall-clock timestamp, or free text.

| Event                                      | Required properties and fixed vocabulary                                                                                                                                                                                                                                                                                              |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `catalog_search`, `catalog_barcode_lookup` | `result`: `matched`, `no_match`, `too_short`, `error`; `latency_bucket`: `lt_1s`, `1s_to_lt_3s`, `3s_to_lt_6s`, `6s_to_lt_12s`, `gte_12s`, `unknown`                                                                                                                                                                                  |
| `label_recognition_completed`              | `result`: `recognized`, `no_text`, `timed_out`, `failed`, `cancelled`; the same fixed `latency_bucket` vocabulary; `on_device=true`                                                                                                                                                                                                   |
| `ingredient_parse_completed`               | `source`: `manual`, `label_capture`; `result`: `parsed`, `partial`, `failed`; `unknown_count_bucket`: `none`, `one_to_two`, `three_to_five`, `six_plus`, `unknown`; optional `native_ocr_enabled` boolean                                                                                                                             |
| `catalog_lookup_no_match`                  | `lookup_type=search`; emitted only for a true search `no_match`, never for offline or error                                                                                                                                                                                                                                           |
| `catalog_correction_reported`              | Emitted only after the first-party report service confirms a newly created correction. The exact-schema sanitizer accepts only `wrong_match`, `missing_product`, `ingredient_issue`, `duplicate`, `source_issue`, `expiry_issue`, and `category_issue`; unrelated properties are removed and invalid or missing types drop the event. |

Latency bucket boundaries are fixed: `[0,1000)` ms, `[1000,3000)` ms,
`[3000,6000)` ms, `[6000,12000)` ms, and `>=12000` ms. Negative or non-finite
readings map to `unknown`. Unknown-token count boundaries are fixed: `0`,
`1-2`, `3-5`, and `>=6`; negative, non-integral, or non-finite inputs map to
`unknown`.

## CAT-09 Frozen Formulas

Let `N(event, predicate)` be the count of successfully published events from
one exact release build, platform, beta ring, and reporting window. A zero
denominator produces `not_available`, never zero. Because publication is
currently disabled, every formula below is a dashboard definition awaiting
live evidence, not a measured result.

| Metric                                                 | Formula and interpretation                                                                                                                                                                                     |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Search or barcode outcome total                        | `N(event, result in {matched,no_match,too_short,error})`, calculated separately for `catalog_search` and `catalog_barcode_lookup`                                                                              |
| Lookup completion rate                                 | `N(event, result in {matched,no_match}) / outcome total`; `too_short` and `error` are not completed catalog outcomes                                                                                           |
| Lookup match, miss, invalid, and error shares          | For each fixed result, `N(event, result=value) / outcome total`                                                                                                                                                |
| Search no-match recovery-surface share                 | `N(catalog_lookup_no_match, lookup_type=search) / N(catalog_search, result=no_match)`; this measures whether the recovery UI was emitted, not catalog coverage                                                 |
| Known latency distribution                             | For each non-`unknown` latency bucket, `N(event, latency_bucket=value) / N(event, latency_bucket!=unknown)`; report `unknown / outcome total` separately and do not derive exact percentiles                   |
| OCR recognized rate                                    | `N(label_recognition_completed, result=recognized) / N(label_recognition_completed, result in fixed OCR vocabulary)`                                                                                           |
| OCR cancellation, timeout, no-text, and failure shares | For each result, `N(label_recognition_completed, result=value) / N(label_recognition_completed, result in fixed OCR vocabulary)`                                                                               |
| Unknown-token presence share                           | `N(ingredient_parse_completed, unknown_count_bucket in {one_to_two,three_to_five,six_plus}) / N(ingredient_parse_completed, unknown_count_bucket!=unknown)`; calculate separately by the fixed `source` bucket |
| Parse outcome share                                    | For each `parsed`, `partial`, or `failed`, `N(ingredient_parse_completed, result=value) / N(ingredient_parse_completed, result in fixed parse vocabulary)`                                                     |
| Accepted wrong-match report count                      | `N(catalog_correction_reported, correction_type=wrong_match)`; this is an accepted-report workload signal, not a confirmed catalog error rate                                                                  |
| Catalog support share                                  | `N(support_contact_opened, category=catalog_match) / N(support_contact_opened, any allowed category)` when that fixed support category is present; it is directional support impact, not prevalence            |

Offline, unconfigured, deletion-blocked, stale-session, pre-consent, and
pre-open calls do not publish and therefore are absent from these
denominators. Dashboard copy must not describe these formulas as complete
user-attempt, unique-user, market-coverage, safety, or product-quality rates.

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
- `first_checkoff_completed`
- `routine_checkoff_completed`
- `cycle_night_completed`
- `photo_baseline_added`
- `photo_captured`
- `first_photo_captured`
- `paywall_shown`
- `contextual_paywall_shown`
- `reverse_trial_started`
- `trial_started`
- `purchase_completed`
- `restore_tapped`
- `manage_subscription_opened`
- `support_contact_opened`
- `support_contact_failed`
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

| Item                                                          | Evidence |
| ------------------------------------------------------------- | -------- |
| PostHog dashboard links                                       | BLOCKED  |
| Sentry release health links                                   | BLOCKED  |
| Play Console Android vitals link                              | BLOCKED  |
| App Store Connect analytics link                              | BLOCKED  |
| RevenueCat cohort/dashboard link                              | BLOCKED  |
| Support dashboard link                                        | BLOCKED  |
| Phase 9 privacy payload audit rerun                           | BLOCKED  |
| Dashboard owner signoff                                       | BLOCKED  |
| Separate analytics consent and authoritative receipt verifier | BLOCKED  |
| Vendor/processor/privacy/legal review                         | BLOCKED  |
| Live exact-build payload and no-replay evidence               | BLOCKED  |
