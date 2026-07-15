# Consent Matrix

Status: legal copy blocked; technical consent surfaces partially implemented  
Last updated: 2026-07-15

## Consent Principles

- Consent must be specific, informed, and revocable.
- High-risk consents are not bundled.
- Defaults are off for sharing, trend analysis, Ask cloud mode, commerce partner sharing, and marketing. Photo cloud backup is unavailable, not merely off.
- Withdrawal must be as easy as granting.
- Consent text/version/hash must be stored when required; a grant is current only when its version and SHA-256 text hash match the exact displayed copy.
- Malformed, unreadable, declined, stale-version, and wrong-hash grants fail closed and remain preserved for explicit recovery.
- Placeholder legal copy cannot ship.

## Matrix

| Consent                        | Purpose                                                                                                                                                  | Default                                                 | Collection/sharing                                                                   | Source                                                                                                                                               | Current status                                                                                                                                                                                                                        |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Health data collection         | Collect goals, quiz answers, sensitivities, pregnancy/trying-to-become-pregnant/breastfeeding status, added products, and derived routine/progress state | Required before goals or any personal profile use/write | Encrypted local-first collection; owner-scoped Supabase processing when configured   | `apps/mobile/src/features/onboarding/consentCopy.ts`                                                                                                 | Required order is age -> consent -> goals -> quiz; authoritative epoch/source implementation and final legal copy remain blocked                                                                                                      |
| Marketing                      | Emails/promotions                                                                                                                                        | Off                                                     | Marketing contact                                                                    | You tab / consent ledger                                                                                                                             | Copy placeholder until legal                                                                                                                                                                                                          |
| Commerce partner sharing       | Show paid where-to-buy links and partner click token                                                                                                     | Off                                                     | Anonymous click token to affiliate partner                                           | `apps/mobile/src/features/commerce/*`                                                                                                                | Technical gate exists; partner/legal blocked                                                                                                                                                                                          |
| Photo cloud backup             | Reserved future backup of progress photos                                                                                                                | Unavailable                                             | No current upload or metadata mirror                                                 | `apps/mobile/src/features/photos/consent.ts`                                                                                                         | No setter/UX; future implementation and legal review required                                                                                                                                                                         |
| Photo trend reading            | On-device trend state                                                                                                                                    | Off                                                     | On-device by default, no upload                                                      | `apps/mobile/src/features/trend/*`                                                                                                                   | Launch-required; blocked pending engine/fairness/privacy/legal/device gates                                                                                                                                                           |
| Ask cloud mode                 | Broader cloud-grounded answers                                                                                                                           | Off                                                     | Minimized summary to cloud model vendor                                              | `apps/mobile/src/features/ask/*`                                                                                                                     | Launch-required; blocked pending vendor/safety/privacy/clinical/legal gates                                                                                                                                                           |
| Notifications                  | Reminders and routine nudges                                                                                                                             | Off/platform controlled                                 | Notification token/local scheduling                                                  | `apps/mobile/src/features/notifications/*`                                                                                                           | Needs policy copy review                                                                                                                                                                                                              |
| Account deletion               | Delete account/data                                                                                                                                      | User action                                             | Deletion request to Edge Function                                                    | `apps/mobile/src/features/settings/actions.ts`                                                                                                       | Technical path exists                                                                                                                                                                                                                 |
| Health-data consent withdrawal | Stop health-purpose processing and delete collected/derived health-purpose data without deleting the account or billing state                            | User action                                             | Local freeze + withdrawal ledger + durable Postgres/Storage/processor reconciliation | `apps/mobile/src/features/settings/actions.ts`, `supabase/functions/consent-withdrawal/index.ts`, `docs/hugeToDo/health-processor-inventory-v1.json` | Source candidate in progress; the paused shell and terminal-only fresh reconsent are locally implemented and Expo-web verified, while hosted worker/Storage, native-device/staging, retention approval, and final copy remain blocked |
| Data export                    | Export user data                                                                                                                                         | User action                                             | Export request to Edge Function                                                      | `apps/mobile/src/features/settings/actions.ts`                                                                                                       | Technical path exists                                                                                                                                                                                                                 |

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

The withdrawal/reconsent acceptance contract is
`docs/hugeToDo/HEALTH-CONSENT-WITHDRAWAL-PROCESSOR-RETENTION-MATRIX-2026-07-15.md`.
Source files, tests, or a passing empty-processor hash audit do not close the
live-service, backup, physical-iPhone, privacy/legal/security, policy, or App
Review gates.
