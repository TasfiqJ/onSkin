# Phase 7 Beta Evidence Dashboard

Purpose: prove whether the V1 loop is valuable enough to keep funding. This is the dashboard spec for a 50-100 user closed beta.

## Activation

| Metric                   | Event(s)                                                                              | Target                                                  |
| ------------------------ | ------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Product shelf activation | `product_add_started` to `product_added` by unique product count                      | 60% of users add 3+ products within 48 hours            |
| First value moment       | `routine_plan_viewed`, `routine_created`, `first_useful_insight`, and `conflict_detected` | 50% reach useful guidance/no-issue within first session |
| Routine activation       | `first_checkoff_completed`, `routine_checkoff_completed`, and `cycle_night_completed` | 45% complete at least one check-off within 48 hours     |
| Photo activation         | `photo_baseline_added`, `first_photo_captured`, and `photo_captured`                  | 25% capture a baseline photo within 7 days              |

`routine_created` and `first_routine_created` are reserved for non-example
plans with at least one placed AM or PM step. A plan that only tells the user a
product needs a category or ingredient clue can still count as
`first_useful_insight`, but it must not inflate routine creation.

## Retention

| Metric              | Event(s)                                                                 | Target                                 |
| ------------------- | ------------------------------------------------------------------------ | -------------------------------------- |
| D7 routine return   | `routine_checkoff_completed`, `cycle_night_completed`                    | 25% D7 active                          |
| D14 habit cohort    | `routine_checkoff_completed`, `cycle_night_completed`, `timeline_viewed` | 15% D14 active                         |
| Reminder usefulness | notification open/check-off after reminder                               | Positive lift versus no-reminder users |
| Privacy trust       | export/delete/withdraw support tickets                                   | No pattern of confusion or panic       |

## Monetization

| Metric              | Event(s)                                                                      | Target                                                  |
| ------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------- |
| Paywall after value | `paywall_shown` or `contextual_paywall_shown` after shelf/routine/photo value | 80% of paywalls after value moment                      |
| Trial start         | `reverse_trial_started`, `trial_started`, and `purchase_completed`            | Benchmark in beta cohort, no entitlement leakage        |
| Restore success     | restore events and support tickets                                            | Restore succeeds in iOS/Android QA and no beta blockers |
| Churn reason        | downgrade/cancel survey                                                       | Product-value reasons separated from billing/confusion  |

## Trust and safety

| Metric                      | Event(s)                                          | Target                                               |
| --------------------------- | ------------------------------------------------- | ---------------------------------------------------- |
| Unreviewed surface exposure | `phase7_deferred_surface_viewed`, route inventory | Zero unreviewed guidance exported/shared             |
| Sensitive data in analytics | analytics sanitizer audits                        | Zero product names, notes, local paths, receipt data |
| Support ambiguity           | support tickets tagged policy/payment/privacy     | No repeated unclear-copy class before public launch  |

## Kill criteria

- Fewer than 30% of beta users add 2+ products.
- Users do not understand why commerce, community, Ask, or trend surfaces are unavailable.
- Payment restore/cancellation creates support burden or access leakage.
- Export/delete/withdraw flows fail in QA.
- Reviewed rules are unavailable and the product cannot create a useful no-issue/routine loop.

## Success criteria

The product earns a public launch only when activation, D14 retention, payment QA, privacy QA, and clinical/legal review are all green. A seven-figure revenue plan then needs pricing conversion evidence, not just feature completion.
