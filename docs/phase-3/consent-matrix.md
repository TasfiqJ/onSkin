# Consent Matrix

Status: legal copy blocked; technical consent surfaces partially implemented  
Last updated: 2026-07-04

## Consent Principles

- Consent must be specific, informed, and revocable.
- High-risk consents are not bundled.
- Defaults are off for sharing, trend analysis, Ask cloud mode, commerce partner sharing, and marketing. Photo cloud backup is unavailable, not merely off.
- Withdrawal must be as easy as granting.
- Consent text/version must be stored when required.
- Placeholder legal copy cannot ship.

## Matrix

| Consent                        | Purpose                                                       | Default                      | Collection/sharing                         | Source                                               | Current status                                                |
| ------------------------------ | ------------------------------------------------------------- | ---------------------------- | ------------------------------------------ | ---------------------------------------------------- | ------------------------------------------------------------- |
| Health data collection         | Create profile/routine and save health-adjacent skincare data | Required for account/routine | Collection by OnSkin/Supabase              | `apps/mobile/src/features/onboarding/consentCopy.ts` | Placeholder legal copy blocked                                |
| Marketing                      | Emails/promotions                                             | Off                          | Marketing contact                          | You tab / consent ledger                             | Copy placeholder until legal                                  |
| Commerce partner sharing       | Show paid where-to-buy links and partner click token          | Off                          | Anonymous click token to affiliate partner | `apps/mobile/src/features/commerce/*`                | Technical gate exists; partner/legal blocked                  |
| Photo cloud backup             | Reserved future backup of progress photos                     | Unavailable                  | No current upload or metadata mirror       | `apps/mobile/src/features/photos/consent.ts`         | No setter/UX; future implementation and legal review required |
| Photo trend reading            | On-device trend state                                         | Off                          | On-device by default, no upload            | `apps/mobile/src/features/trend/*`                   | Public launch blocked pending fairness/legal                  |
| Ask cloud mode                 | Broader cloud-grounded answers                                | Off                          | Minimized summary to cloud model vendor    | `apps/mobile/src/features/ask/*`                     | Deferred until vendor/legal review                            |
| Notifications                  | Reminders and routine nudges                                  | Off/platform controlled      | Notification token/local scheduling        | `apps/mobile/src/features/notifications/*`           | Needs policy copy review                                      |
| Account deletion               | Delete account/data                                           | User action                  | Deletion request to Edge Function          | `apps/mobile/src/features/settings/actions.ts`       | Technical path exists                                         |
| Health-data consent withdrawal | Withdraw and delete collected health data                     | User action                  | Withdrawal ledger + deletion               | `apps/mobile/src/features/settings/actions.ts`       | Technical path exists                                         |
| Data export                    | Export user data                                              | User action                  | Export request to Edge Function            | `apps/mobile/src/features/settings/actions.ts`       | Technical path exists                                         |

## Policy URL Contract

The app must expose functional links for:

- Privacy policy.
- Terms of service.
- Support.
- Account deletion instructions.
- Data export instructions.
- Consumer health data privacy policy/notice.

These are configured through public environment variables and wired into in-app settings/paywall.

## Launch Rule

`CONSENT_COPY_VERSION` values containing placeholder markers cannot be used in a production build. `npm run phase3:audit-copy:strict` must remain failing until final copy is reviewed and blocker rows are closed.
