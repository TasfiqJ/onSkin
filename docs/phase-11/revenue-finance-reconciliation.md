# Phase 11 Revenue And Finance Reconciliation

Status: BLOCKED until live store and RevenueCat data exists.

## Sources

| Source | Metric |
| --- | --- |
| RevenueCat | trials, purchases, renewals, cancellations, refunds, entitlements |
| App Store Connect | proceeds, refunds, subscription status, territory |
| Play Console | orders, cancellations, refunds, subscriptions, territory |
| Supabase | entitlement grants, user state, webhook receipt |
| Support | payment tickets, refund requests, restore failures |

## Reconciliation Rules

- Separate gross revenue, proceeds, taxes, refunds, store fees, failed payments, and active subscribers.
- Do not call one launch-day purchase annual recurring revenue unless the active subscriber basis is clear.
- Track trial-to-paid separately from download-to-paid.
- Cohort every purchase by source, platform, country, and launch ring.
- Record support cost and catalog ops cost against each launch ring.

## Seven-Figure Model Inputs

| Input | Actual | Notes |
| --- | --- | --- |
| store impression to product page | TBD | TBD |
| product page to install | TBD | TBD |
| install to onboarding complete | TBD | TBD |
| onboarding to first value | TBD | TBD |
| D1 retention | TBD | TBD |
| D7 retention | TBD | TBD |
| trial start rate | TBD | TBD |
| trial-to-paid rate | TBD | TBD |
| paid retention | TBD | TBD |
| refund rate | TBD | TBD |
| support cost per active user | TBD | TBD |
| catalog ops cost per active user | TBD | TBD |
| CAC by cohort | TBD | TBD |

