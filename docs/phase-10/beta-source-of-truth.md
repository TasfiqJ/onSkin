# Phase 10 Closed Beta Source Of Truth

Status: BLOCKED until Phase 9 beta-candidate gates, store beta tracks, support operations, privacy/payment checks, and real tester evidence are complete.

Phase 10 is not a feature phase. It is the evidence phase that decides whether public traffic is worth spending. The beta must prove that real target users can safely reach first value, use the V1 loop, trust the catalog and guidance boundaries, understand Pro, restore access, contact support, and exercise privacy rights without operational failure.

## Current Decision

| Area | Required evidence | Current status |
| --- | --- | --- |
| Phase 9 candidate | Phase 9 release QA packet with named signoff | BLOCKED: external evidence required |
| Beta identity | Final brand, bundle IDs, domains, policy URLs, support email | BLOCKED: final live values required |
| iOS beta | TestFlight internal group, external group, beta review status, build number | BLOCKED: App Store Connect evidence required |
| Android beta | Play internal test, closed test, license testers, pre-launch report | BLOCKED: Play Console evidence required |
| Google production eligibility | Account type known; if new personal account, 12 opted-in testers for 14 continuous days | BLOCKED: account-specific proof required |
| Beta support | Inbox, categories, SLA, escalation owners, deletion/export escalation | BLOCKED: live desk evidence required |
| Analytics | Frozen schema, dashboard links, privacy-payload audit, cohort filters | BLOCKED: dashboard evidence required |
| Payments | RevenueCat/test-store/native QA, TestFlight sandbox notes, Android license tester results | BLOCKED: payment evidence required |
| Catalog | Match/miss/wrong-match report from real tester products | BLOCKED: beta data required |
| Retention | D1/D7/D14/D30 activated cohorts and churn reasons | BLOCKED: beta data required |
| Public launch decision | Go, limited launch, hold, or no-go memo with owners | BLOCKED: Phase 10 exit evidence required |

## Beta Waves

| Wave | Target users | Purpose | Entry gate | Exit gate |
| --- | ---: | --- | --- | --- |
| Wave 0 internal | 5-10 | Release rehearsal, support dry run, deletion/export/payment smoke | Phase 9 candidate passes non-strict code gates | No P0/P1 build, privacy, support, or payment issue remains |
| Wave 1 friendly | 15-25 | First real-user comprehension, catalog friction, trust and support themes | Wave 0 exit and reviewed tester brief | Top blockers fixed or explicitly accepted |
| Wave 2 target | 50-100 total real target users | Activation, retention, catalog usefulness, willingness-to-pay signal | Dashboards and support categories live | Public-launch memo can be written from evidence |

Do not count employees, contractors, duplicate devices, or passive installs as target-user completion. A completed beta user must install the final beta build, complete onboarding, add real shelf context, see a first-value moment, attempt at least one routine or progress action, and have the option to provide feedback through the approved channel.

## Seven-Figure Evidence Bar

At $49.99/year, $1,000,000 gross ARR requires about 20,005 active annual subscribers before refunds, taxes, failed payments, churn, and store fees. A 50-100 user beta cannot forecast that outcome precisely. Its job is to expose the failure modes that would make seven figures unrealistic:

- weak first-session value
- onboarding confusion
- catalog miss or wrong-match frustration
- guidance distrust
- paywall-before-value pressure
- restore or entitlement failure
- deletion/export/privacy concern
- support volume the team cannot handle
- retention that depends on unbuilt features

Proceed to Phase 11 only if the beta shows a credible path toward retained paid usage, not merely installs or compliments.

## Required Tickets And Artifacts

| Ticket | Artifact |
| --- | --- |
| P10-001 | `docs/phase-10/beta-source-of-truth.md` |
| P10-002 | `docs/phase-10/tester-recruitment-sheet.md` |
| P10-003 | `docs/phase-10/tester-brief.md` |
| P10-004 | `docs/phase-10/testflight-packet.md` |
| P10-005 | `docs/phase-10/google-closed-testing-packet.md` |
| P10-006 | `docs/phase-10/beta-event-schema.md` |
| P10-007 | `docs/phase-10/support-operations.md` |
| P10-008 | `docs/phase-10/surveys.md` |
| P10-009 | `docs/phase-10/surveys.md` |
| P10-010 | `docs/phase-10/interview-script.md` |
| P10-011 | `docs/phase-10/catalog-beta-report.md` |
| P10-012 | `docs/phase-10/payment-beta-report.md` |
| P10-013 | `docs/phase-10/support-beta-report.md` |
| P10-014 | `docs/phase-10/retention-activation-report.md` |
| P10-015 | `docs/phase-10/public-launch-decision-memo.md` |

## Hard No-Go Rules

Phase 10 cannot start if any of these are true:

- Phase 9 beta candidate packet is missing or unsigned.
- Public identity, policy URLs, deletion, export, or support paths contain placeholders.
- Analytics payload audit is not clean enough for beta or dashboard links are missing.
- TestFlight or Play Console setup is incomplete for the target platform.
- RevenueCat purchase, restore, entitlement, and webhook behavior has not been tested on native builds.
- Tester terms and feedback handling do not explain privacy, no medical advice, deletion/export, support, and payment-test limits.
- Support categories and escalation owners are not live.
- Catalog fallback and correction reporting cannot be used by testers.

Phase 10 cannot exit to public launch if any of these are true:

- Fewer than 50 real target users complete the beta loop.
- D1/D7 activated retention is too weak to justify public traffic.
- First value is unclear or delayed for a material segment.
- Catalog misses, wrong matches, or manual fallback failures block routine setup.
- Any tester is unexpectedly charged or cannot restore access.
- Deletion/export/privacy requests fail or route through informal channels.
- Support volume, severity, or response time is not manageable.
- Crash, ANR, app-start, or build-health metrics show unresolved P0/P1 risk.
- The launch decision is not documented as go, limited launch, hold, or no-go with owners.

## Evidence Environment Gates

Strict Phase 10 verification requires these variables to be set in the release shell, not in the mobile bundle:

- `PHASE10_PHASE9_BETA_CANDIDATE_PASS=true`
- `PHASE10_BETA_IDENTITY_PASS=true`
- `PHASE10_TESTFLIGHT_READY=true`
- `PHASE10_PLAY_CLOSED_TEST_READY=true`
- `PHASE10_PLAY_12_TESTERS_14_DAYS_SCHEDULED=true` when account type requires it
- `PHASE10_RECRUITING_PASS=true`
- `PHASE10_BETA_TERMS_PASS=true`
- `PHASE10_DASHBOARDS_PASS=true`
- `PHASE10_SUPPORT_DESK_PASS=true`
- `PHASE10_PRIVACY_PAYLOAD_PASS=true`
- `PHASE10_PAYMENT_QA_PASS=true`
- `PHASE10_CATALOG_BETA_PASS=true`
- `PHASE10_RETENTION_REPORT_PASS=true`
- `PHASE10_PUBLIC_LAUNCH_DECISION=go` or `limited`
- `PHASE10_SIGNED_OFF_BY=<owner>`

Run `npm run phase10:verify` for code/artifact gates and `npm run phase10:beta-readiness:strict` only when the external evidence exists.

