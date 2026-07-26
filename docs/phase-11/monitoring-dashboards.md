# Phase 11 Monitoring Dashboards

Status: SOURCE DEFINITIONS IN PROGRESS / BLOCKED. No production analytics
transport is enabled, and no live dashboard or threshold evidence is attached.

## Required Dashboards

| Dashboard             | Source                                    | Launch use                                      | Status  |
| --------------------- | ----------------------------------------- | ----------------------------------------------- | ------- |
| Store funnel          | App Store Connect, Play Console           | impressions, page views, installs, conversion   | BLOCKED |
| Activation funnel     | PostHog/Supabase                          | onboarding, product add, first value, check-off | BLOCKED |
| Retention cohorts     | PostHog/App Analytics                     | D1/D7 by activated state, platform, source      | BLOCKED |
| Payment funnel        | RevenueCat, stores, Supabase              | paywall, trial, purchase, restore, entitlement  | BLOCKED |
| Support               | support desk                              | tickets per 100 users, P0/P1, SLA               | BLOCKED |
| Catalog               | app events/support                        | match, miss, wrong-match, corrections           | BLOCKED |
| Release health        | Sentry, Android vitals, App Store metrics | crashes, ANRs, app-start, adoption              | BLOCKED |
| Privacy/data rights   | support/Supabase                          | deletion, export, consent withdrawal            | BLOCKED |
| Creator/social claims | manual tracker                            | disclosures, banned claims, support escalations | BLOCKED |

## CAT-09 Measurement Contract

The canonical fixed vocabularies, bucket boundaries, denominator rules, and
formulas are in `docs/phase-10/beta-event-schema.md`. Catalog dashboards must
use those definitions without silently changing buckets or excluding
unfavorable fixed outcomes.

For each exact build, platform, beta ring, and reporting window, show search and
barcode outcome totals; completion, match, miss, invalid, and error shares;
the known latency-bucket distribution plus the separate `unknown` share; true
search no-match recovery-surface share; OCR recognized/cancelled/no-text/
timeout/failure shares; ingredient-parse outcome and unknown-token count
buckets by fixed source; accepted wrong-match report count; and directional
catalog-support share. A zero denominator displays `not_available`.

Offline, unconfigured, deletion-blocked, stale-session, pre-consent, and
pre-open attempts are not published. The dashboards therefore must not label
these metrics as complete attempt rates, unique-user rates, market coverage,
confirmed catalog defect prevalence, safety, or product quality.

## Publication And Evidence Posture

The mobile analytics publication gate is default closed, contains no event
buffer or replay path, and accepts only an injected transport bound to an
exact owner and an externally verified receipt at the current generation.
Deletion admission and Auth account/background/deletion boundaries close it
synchronously and invalidate stale generations. Analytics reset closes before
legacy persistence purge and remains closed on purge failure.

No production caller opens the gate, and PostHog construction, capture,
identify, and flush remain disabled. Before any dashboard can be treated as
live launch evidence, the exact release candidate needs a separately approved
analytics consent record and authoritative receipt verifier, reviewed vendor
configuration/processor terms/retention/region and privacy/legal posture,
payload and no-replay evidence, named dashboard owners, links, refresh
cadences, and predeclared decision thresholds. Local source tests do not
establish any of those facts.

## Alert Thresholds

| Alert                                             | Default action                                    |
| ------------------------------------------------- | ------------------------------------------------- |
| P0 data, payment, privacy, or harmful-claim issue | halt expansion and page owner                     |
| P1 restore/deletion/export failure                | hold next ring                                    |
| crash or ANR spike                                | hold launch and triage release health             |
| support SLA breach                                | hold traffic expansion                            |
| catalog wrong-match theme harming trust           | hold expansion until owner signs off              |
| unexpected store review theme                     | review store copy, support macros, and onboarding |

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
- exact event-schema version or source commit
- zero-denominator behavior
- privacy/legal review reference
