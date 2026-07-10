# Phase 11 Store Release Plan

Status: BLOCKED until App Store Connect and Play Console approval evidence is attached.

## Store Constraints

- Apple supports manual release after approval and may take up to 24 hours to go live after release.
- Apple's phased release documentation is for version updates, so first public launch must be controlled with manual release timing, availability, and traffic channels rather than assuming update-style phased release.
- Google Play first production release does not show a rollout percentage option. Starting production publishes the app to users in the selected countries.
- Google staged rollout percentages are for app updates after launch, not the primary throttle for the first release.
- If the Play account is a newly created personal account, production access requires the closed-test requirement to be satisfied first.

## Apple Release Checklist

| Item                                                       | Evidence |
| ---------------------------------------------------------- | -------- |
| App Store version created                                  | BLOCKED  |
| Correct build selected                                     | BLOCKED  |
| Pricing and availability set                               | BLOCKED  |
| Manual release selected                                    | BLOCKED  |
| Privacy nutrition labels reviewed                          | BLOCKED  |
| Account deletion available in app                          | BLOCKED  |
| Review notes include no-medical-advice and payment context | BLOCKED  |
| App Review approval state                                  | BLOCKED  |
| Release owner assigned                                     | BLOCKED  |

## Google Release Checklist

| Item                                            | Evidence |
| ----------------------------------------------- | -------- |
| Production access eligibility confirmed         | BLOCKED  |
| Country selection approved                      | BLOCKED  |
| Data safety form matches actual behavior        | BLOCKED  |
| Health content declaration reviewed             | BLOCKED  |
| Account deletion disclosure reviewed            | BLOCKED  |
| Pre-launch report reviewed                      | BLOCKED  |
| Android vitals dashboard linked                 | BLOCKED  |
| First release no-percentage constraint accepted | BLOCKED  |
| Release owner assigned                          | BLOCKED  |

## Availability Strategy

Start narrow. Use selected countries and invite-led traffic for Ring 0/Ring 1. Do not launch worldwide by default. Do not schedule broad creator or paid acquisition until 72-hour and week-1 evidence pass.

## Release Hold Criteria

Hold release if any of these are true:

- Phase 10 decision is hold or no-go.
- App Store or Play review has unresolved issues.
- Store privacy/data safety disclosures do not match implementation.
- RevenueCat production products are not verified.
- Support or incident owner is unavailable.
- Monitoring dashboards are missing.
- Deletion/export/account deletion is not live.
- Medical or cosmetic claims are not review-approved.
