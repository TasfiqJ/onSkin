# Phase 11 Launch Command Center

Status: BLOCKED until Phase 10 exit review, Phase 9 RC signoff, store approval, production environment, payments, monitoring, support, and rollback evidence are complete.

Phase 11 is controlled public launch, not scale. The launch is allowed to expand only one ring at a time after the prior ring proves product quality, trust, retention, support, payment integrity, and monitoring health.

## Launch Roles

| Role                     | Owner | Backup | Status  |
| ------------------------ | ----- | ------ | ------- |
| Launch lead              | TBD   | TBD    | BLOCKED |
| Release engineer         | TBD   | TBD    | BLOCKED |
| Product owner            | TBD   | TBD    | BLOCKED |
| Support lead             | TBD   | TBD    | BLOCKED |
| Payments owner           | TBD   | TBD    | BLOCKED |
| Privacy/legal owner      | TBD   | TBD    | BLOCKED |
| Clinical/claims reviewer | TBD   | TBD    | BLOCKED |
| Catalog owner            | TBD   | TBD    | BLOCKED |
| Growth/ASO owner         | TBD   | TBD    | BLOCKED |

## Entry Gates

| Gate              | Required evidence                                                       | Status  |
| ----------------- | ----------------------------------------------------------------------- | ------- |
| Phase 10 exit     | Go or limited-launch memo with beta evidence                            | BLOCKED |
| Phase 9 RC        | signed release candidate packet                                         | BLOCKED |
| Store approval    | App Store and Play review state known                                   | BLOCKED |
| Production env    | production Supabase, URLs, app links, env values checked                | BLOCKED |
| RevenueCat        | production products, offerings, webhooks, restore, entitlements checked | BLOCKED |
| Monitoring        | PostHog, Sentry, RevenueCat, stores, support dashboards live            | BLOCKED |
| Support           | launch categories, macros, SLA, owners live                             | BLOCKED |
| Incident/rollback | rollback drill completed and owners reachable                           | BLOCKED |

The generated public-launch packet must hash the verifier scripts that decide
launch readiness, not only the app, generated beta packet, and Phase 11 docs.
Source hashes include the shared evidence normalization helper, Phase 10 beta
packet builder, Phase 10/11 public-contact smoke, and Phase 11 readiness, ring,
and packet scripts so a launch packet is tied to the exact local gates that
produced it. The packet must also hash both JSON and Markdown generated packets
from Phase 9 and Phase 10 so the machine-readable status and human-reviewed
evidence artifacts cannot drift apart. The packet Markdown must also show
whether it was generated from a clean or dirty Git worktree so reviewers can
reject stale or mixed-worktree public-launch evidence.

## Launch Rings

| Ring   | Audience                  | Traffic control                                               | Expansion rule                         |
| ------ | ------------------------- | ------------------------------------------------------------- | -------------------------------------- |
| Ring 0 | approved but not promoted | manual release, selected countries, invite-only links         | no promotion until smoke passes        |
| Ring 1 | invite-led soft launch    | founder list, beta waitlist, narrow organic channels          | 72-hour report must pass               |
| Ring 2 | narrow public discovery   | store search, limited creators only if disclosure pack passes | week-1 expansion must pass             |
| Ring 3 | broader organic           | more countries/channels after support and retention evidence  | no paid scale without cohort economics |

## First 72 Hours

Review every 4-6 hours:

- installs and onboarding completion
- first value and product-add completion
- paywall, trial, purchase, restore, entitlement sync
- crash-free sessions, ANR, app-start, release adoption
- support P0/P1 volume and SLA
- catalog no-match/wrong-match reports
- deletion/export/privacy requests
- app-store review themes
- creator/social claims if active

## Decision States

- Continue: no P0/P1 launch risk and metrics are within guardrails.
- Hold: stop expansion while fixing unresolved risk.
- Roll back or halt: use app-store, Play, EAS Update, feature flags, or server-side disablement depending on issue type.
- No-go: stop launch when trust, safety, payment, privacy, or retention evidence invalidates public expansion.
