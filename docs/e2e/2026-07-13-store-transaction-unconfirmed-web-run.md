# Store Transaction Safety Web Observation

Status: superseded observation only; not acceptance evidence.

The run used Expo web in a development build at a 375 x 667 viewport with the
guarded `EXPO_PUBLIC_E2E_ACCOUNT_ISOLATION=signout_clear_retry` fixture. Each
store-notice fixture used a separate localhost origin. No browser storage,
cookies, production account, StoreKit state, or provider dashboard state was
edited.

## Observed branches

### `purchase_unconfirmed`

- The root modal appeared over onboarding with the expected purchase-safety
  title, no-buy-again message, Restore action, and process-local dismissal.
- Dismissal removed the modal for the current foreground. Reload showed the
  durable warning again.
- The web-incompatible Restore attempt kept the modal visible and reported that
  store status could not be safely confirmed; it did not claim native success.

### `payment_pending`

- The modal showed the pending-approval message plus Restore, Manage, Support,
  and dismissal actions without clipping at 375 x 667.
- Manage returned truthful in-modal feedback that opening settings did not clear
  the purchase block.
- Invoking Support handed control to the operating system and disconnected the
  browser controller. This is not classified as an application pass or failure.

### Not exercised

- `deleted_account_pending`
- `foreign_pending`
- App Lock, inactive/background privacy, maximum Dynamic Type, and native focus
- 360 x 640 resilience

## Local artifacts

The ignored evidence directory is
`test-results/human-e2e/2026-07-13/store-transaction-unconfirmed-web/` and contains:

- `purchase-unconfirmed-initial-375x667.png`
- `purchase-unconfirmed-dismissed-375x667.png`
- `purchase-unconfirmed-restore-failure-375x667.png`
- `payment-pending-initial-375x667.png`

## Why this run is superseded

After these observations, the implementation added exact post-write readback,
removed device-clock expiry as a checkout-release signal, corrected contrast and
accessible naming/alert structure, added retained-state Restore feedback, and
preserved a freshly rotated Auth session after publication-renewal failure. Those
changes materially affect the tested surface and safety contract. All four web
fixtures must therefore be rerun before this UI slice can be accepted or pushed
as a completed checkpoint. Physical iPhone/TestFlight StoreKit, Ask-to-Buy,
RevenueCat, app-switcher privacy, VoiceOver, and counsel gates remain separate.
