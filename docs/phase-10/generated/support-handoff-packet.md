# Phase 10 Beta Support Handoff Packet

Generated: 2026-07-09T20:51:18.012Z
Status: pass
Git SHA: f0f0d720e3f7a9cfabe75709e60ab6fea26a3bd8
Git status: clean

This generated packet converts the in-app Beta feedback route into exact
support-desk setup instructions. It does not prove the external desk exists;
Tas must still configure the real support URL, queues, owners, macros, and
SLA reports before `PHASE10_SUPPORT_DESK_PASS=true` can be set.

## Handoff Contract

- URL env: `EXPO_PUBLIC_SUPPORT_URL`
- Required query params: `source=beta_feedback`, `category`, `severity`
- Free text sent: no
- Personal data sent: no free-text or health/photo detail is sent by this handoff

## Categories

| Query value             | Label                   | Desk queue           | Escalation owner                       | Theme                          |
| ----------------------- | ----------------------- | -------------------- | -------------------------------------- | ------------------------------ |
| `onboarding_confusion`  | Onboarding confusion    | beta-onboarding      | Support ops + onboarding owner         | activation confusion           |
| `catalog_match`         | Catalog match issue     | beta-catalog         | Catalog owner                          | catalog miss or wrong match    |
| `guidance_trust`        | Guidance trust concern  | beta-guidance-review | Clinical/claims reviewer + engineering | guidance trust                 |
| `routine_checkoff`      | Routine or check-off    | beta-routine         | Routine owner                          | routine activation             |
| `visual_progress`       | Progress photos         | beta-photos          | Photo/privacy owner                    | progress photo friction        |
| `notifications`         | Reminders               | beta-reminders       | Notifications owner                    | reminder reliability           |
| `paywall_comprehension` | Paywall comprehension   | beta-payments        | Payments + legal owner                 | pricing or trial comprehension |
| `privacy_rights`        | Privacy or data rights  | beta-privacy         | Privacy/legal owner                    | privacy rights                 |
| `crash_performance`     | Crash or performance    | beta-release         | Release/build owner                    | crash or performance           |
| `account_auth`          | Account or sign-in      | beta-auth            | Auth/backend owner                     | account access                 |
| `app_install`           | Install or app review   | beta-install         | Release/build owner                    | install or update              |
| `advice_boundary`       | Advice boundary concern | beta-claims          | Clinical/claims reviewer + legal       | medical-advice boundary        |
| `other`                 | Other                   | beta-general         | Support ops owner                      | uncategorized feedback         |

## Severities

| Query value | Label              | Response target | Escalation                         | Definition                                                                             |
| ----------- | ------------------ | --------------- | ---------------------------------- | -------------------------------------------------------------------------------------- |
| `p0`        | Cannot use the app | same day        | page owner immediately             | Crash, data-loss risk, unexpected charge, privacy failure, or harmful medical framing. |
| `p1`        | Core flow blocked  | 1 business day  | feature owner                      | Core activation, catalog, payment, auth, or routine flow is blocked.                   |
| `p2`        | Can continue       | 2 business days | weekly beta triage unless repeated | Tester can continue, but the issue is wrong, confusing, or unreliable.                 |
| `p3`        | Suggestion         | weekly triage   | backlog review                     | Suggestion, polish, wording, or non-launch request.                                    |

## Blockers

- None.

## Warnings

- None.

## Source Hashes

- `package.json`: `387960dacb05532538212d2c6ad3aa590887d2f9d9dcad8afe586b5c50351cfa`
- `scripts/phase10/build-support-handoff-packet.mjs`: `bdc16041ab8e7bcd1f5f524b4ffcec18c3721df2090fcd287d9717317dcc749d`
- `scripts/phase10/lib.mjs`: `3d326b6f8589e7157f9def40c2b3cd17c31bda9b4b3746f35f7ffd5f3d4deb0c`
- `apps/mobile/src/app/settings/beta-feedback.tsx`: `c308e90f8217f36e03a55df0afa490ea2c8030f0fa98923ca28b7cfe72ce0272`
- `docs/phase-10/support-operations.md`: `66af3dc3110f55906996505088ac853d3af730f3700966b2199b01fef2c8cb9f`
