# Phase 11 Monitoring Dashboards

Status: BLOCKED until live dashboard links are attached.

## Required Dashboards

| Dashboard | Source | Launch use | Status |
| --- | --- | --- | --- |
| Store funnel | App Store Connect, Play Console | impressions, page views, installs, conversion | BLOCKED |
| Activation funnel | PostHog/Supabase | onboarding, product add, first value, check-off | BLOCKED |
| Retention cohorts | PostHog/App Analytics | D1/D7 by activated state, platform, source | BLOCKED |
| Payment funnel | RevenueCat, stores, Supabase | paywall, trial, purchase, restore, entitlement | BLOCKED |
| Support | support desk | tickets per 100 users, P0/P1, SLA | BLOCKED |
| Catalog | app events/support | match, miss, wrong-match, corrections | BLOCKED |
| Release health | Sentry, Android vitals, App Store metrics | crashes, ANRs, app-start, adoption | BLOCKED |
| Privacy/data rights | support/Supabase | deletion, export, consent withdrawal | BLOCKED |
| Creator/social claims | manual tracker | disclosures, banned claims, support escalations | BLOCKED |

## Alert Thresholds

| Alert | Default action |
| --- | --- |
| P0 data, payment, privacy, or harmful-claim issue | halt expansion and page owner |
| P1 restore/deletion/export failure | hold next ring |
| crash or ANR spike | hold launch and triage release health |
| support SLA breach | hold traffic expansion |
| catalog wrong-match theme harming trust | hold expansion until owner signs off |
| unexpected store review theme | review store copy, support macros, and onboarding |

## Dashboard Acceptance

Every launch dashboard must have:

- owner
- link
- refresh cadence
- source definition
- ring filter
- platform filter
- build/version filter
- decision threshold
- last reviewed timestamp

