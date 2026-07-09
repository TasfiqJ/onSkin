# Phase 10 Beta Support Operations

Status: BLOCKED until support inbox, categories, SLA, macros, and escalation owners are live.

## Support Channels

| Channel | Purpose | Status |
| --- | --- | --- |
| Beta support email or desk | All tester issues and feedback | BLOCKED |
| Privacy request path | deletion, export, consent withdrawal | BLOCKED |
| Payment escalation | unexpected charge, restore failure, entitlement mismatch | BLOCKED |
| Incident escalation | crash, data leak, incorrect medical framing, P0 support theme | BLOCKED |

Do not accept beta bug reports through personal DMs as the source of truth. If a tester sends a DM, create a ticket with only necessary context and reply through the approved channel.

## Categories

The in-app Beta feedback route opens `EXPO_PUBLIC_SUPPORT_URL` with
`source=beta_feedback`, a `category` query value, and a `severity` query value.
It sends no free text and no health/photo detail. Configure the support desk to
preserve these exact query values as ticket fields.

| Query value | Desk category | Default queue |
| --- | --- | --- |
| `onboarding_confusion` | onboarding confusion | beta-onboarding |
| `catalog_match` | catalog no match or wrong match | beta-catalog |
| `guidance_trust` | guidance trust concern | beta-guidance-review |
| `routine_checkoff` | routine/check-off issue | beta-routine |
| `visual_progress` | photo/progress issue | beta-photos |
| `notifications` | reminders/notifications issue | beta-reminders |
| `paywall_comprehension` | paywall comprehension | beta-payments |
| `privacy_rights` | privacy/deletion/export issue | beta-privacy |
| `crash_performance` | crash/performance issue | beta-release |
| `account_auth` | account/auth issue | beta-auth |
| `app_install` | app review/store/install issue | beta-install |
| `advice_boundary` | medical advice boundary concern | beta-claims |
| `other` | other | beta-general |

## Severity

| Severity | Definition | Response target |
| --- | --- | --- |
| `p0` | data exposure, unexpected charge, deletion/export failure, harmful medical framing, widespread crash | same day, page owner |
| `p1` | payment restore failure, blocked activation, catalog failure affecting many testers, support queue breach | 1 business day |
| `p2` | confusing copy, single-device issue, non-blocking catalog miss | 2 business days |
| `p3` | suggestion, polish, non-launch request | weekly triage |

Run `npm run phase10:support-handoff` after any Beta feedback route or support
operations edit. The generated packet is the exact setup handoff for the
external support desk, but `PHASE10_SUPPORT_DESK_PASS=true` still requires the
real desk, categories, macros, SLA report, and owner signoff.

## Required Macros

- install/build-number request
- catalog miss report
- wrong-match report
- restore failure
- unexpected charge
- deletion/export request
- photo/privacy concern
- no-medical-advice boundary
- beta feedback thank-you
- interview invite

## Escalation Owners

| Area | Owner | Backup | Status |
| --- | --- | --- | --- |
| Release/build | TBD | TBD | BLOCKED |
| Support ops | TBD | TBD | BLOCKED |
| Privacy/legal | TBD | TBD | BLOCKED |
| Payments | TBD | TBD | BLOCKED |
| Catalog | TBD | TBD | BLOCKED |
| Clinical/claims | TBD | TBD | BLOCKED |
| Engineering | TBD | TBD | BLOCKED |

## Daily Triage

Every beta day:

- review P0/P1 tickets first
- tag ticket category, severity, platform, build, wave, and tester ID
- export counts by category
- check payment, deletion/export, and privacy issues separately
- compare support themes to dashboards
- decide whether the next wave is allowed

## Exit Evidence

Attach:

- support desk screenshot
- category report
- SLA report
- P0/P1 incident list
- unresolved launch risks
- support owner signoff
