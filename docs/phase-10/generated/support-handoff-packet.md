# Phase 10 Beta Support Handoff Packet

Generated: 2026-07-17T07:45:31.841Z
Status: pass
Git SHA: 6241c23a30673d7ee9a0504a52d069ba4ea04d8d
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

- `package.json`: `1355fd9c03faea3cb3742522e15221a2d05a67f3aaff3113ef1b7dcbdc3996f7`
- `scripts/phase10/build-support-handoff-packet.mjs`: `ea5ded8fefa3a0258b71c7cf26f16365cab41add4882a90bc12b8601805cc20a`
- `scripts/phase10/lib.mjs`: `ede0cba473e147f80438708cbdfb9dbe1a178186997292ad9ee62e38912a7f2a`
- `apps/mobile/src/app/settings/beta-feedback.tsx`: `0fa17f838f101c1340c11afe026c8efa4fa11534fd12a2d18eb89e0c944954ea`
- `docs/phase-10/support-operations.md`: `bed258fc581aa469539542cbad95184e5314adb4a3b3ac11983b677cd4a00c7e`
