# Phase 11 Store Release Plan

Status: BLOCKED until App Store Connect approval evidence is attached.

## Store Constraints

- Apple supports manual release after approval and may take up to 24 hours to go live after release.
- Apple's phased release documentation is for version updates, so first public launch must be controlled with manual release timing, availability, and traffic channels rather than assuming update-style phased release.
- The active contract is iPhone-only and US-only. iPad, Android, Canada,
  France, and every other App Store territory are not release targets.
- The first production release is controlled through manual release, US-only
  availability, Ring 0 production smoke, and invite-led traffic—not an assumed
  percentage rollout.

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

## Availability Strategy

Start with the United States only and invite-led traffic for Ring 0/Ring 1.
Confirm the final App Store territory list immediately before release and retain
the evidence. Do not schedule broad creator or paid acquisition until the
72-hour and week-1 gates pass. Adding any country requires its own legal,
language, pricing, support, claims, tax, privacy, catalog, and QA gate.

## Release Hold Criteria

Hold release if any of these are true:

- Phase 10 decision is hold or no-go.
- App Review has unresolved issues.
- App Store privacy disclosures do not match implementation.
- RevenueCat production products are not verified.
- Support or incident owner is unavailable.
- Monitoring dashboards are missing.
- Deletion/export/account deletion is not live.
- Medical or cosmetic claims are not review-approved.
- US-only availability is not provable or an unreviewed territory is enabled.

Primary references:

- https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/select-an-app-store-version-release-option/
- https://developer.apple.com/help/app-store-connect/update-your-app/release-a-version-update-in-phases/
