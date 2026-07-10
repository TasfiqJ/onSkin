# Phase 10 Retention And Activation Report

Status: BLOCKED until real beta cohort data exists.

## Cohorts

Report each metric by:

- wave
- platform
- build
- activation state
- first-value path
- catalog state
- payment state
- support-contact state

## Funnel

| Step                              | Count | Rate | Notes |
| --------------------------------- | ----: | ---: | ----- |
| Invited                           |   TBD |  TBD | TBD   |
| Accepted invite                   |   TBD |  TBD | TBD   |
| Installed                         |   TBD |  TBD | TBD   |
| Opened app                        |   TBD |  TBD | TBD   |
| Completed onboarding              |   TBD |  TBD | TBD   |
| Added product                     |   TBD |  TBD | TBD   |
| Reached first value               |   TBD |  TBD | TBD   |
| Completed first check-off         |   TBD |  TBD | TBD   |
| Returned D1                       |   TBD |  TBD | TBD   |
| Returned D7                       |   TBD |  TBD | TBD   |
| Returned D14                      |   TBD |  TBD | TBD   |
| Returned D30                      |   TBD |  TBD | TBD   |
| Saw paywall                       |   TBD |  TBD | TBD   |
| Started trial/purchase flow       |   TBD |  TBD | TBD   |
| Restored/manage subscription used |   TBD |  TBD | TBD   |

## Guardrails

- Activation must not depend on unbuilt features.
- D1 and D7 return should be strongest among first-value users.
- Catalog-blocked users must either recover through manual fallback or be counted as launch risk.
- Users who contact support should not churn because of unresolved P0/P1 issues.
- Willingness to pay must be tied to current V1 value, not promised future AI/dermatology features.

## Decision

| Decision       | Evidence required                                                                 |
| -------------- | --------------------------------------------------------------------------------- |
| Go             | Activation, retention, catalog, payment, privacy, and support all pass guardrails |
| Limited launch | Core works but traffic must remain narrow by country/channel/platform             |
| Hold           | Fixable blockers remain before public exposure                                    |
| No-go          | Demand, trust, retention, or safety evidence is too weak                          |
