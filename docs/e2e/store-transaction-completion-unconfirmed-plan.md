# Store Transaction Safety E2E Plan

Status: automated implementation and pre-fix Expo web observations exist; the
subsequent safety/accessibility fixes invalidate those screenshots as acceptance
evidence, so complete web and native human evidence remain open. Nothing in this
document is App Store or legal approval.

## Acceptance contract

- Purchase/Restore configuration, offering, or publication-admission failures
  before the native-call hook create no journal. The hook must commit and be
  read back before the SDK call; storage failure means the sheet is not invoked.
- Once native invocation begins, caller detachment, boundary closure, provider
  errors, cache-write failure, reminder-write failure, process death, and a
  fulfilled purchase without persisted active entitlement remain fail-closed.
- RevenueCat's `PURCHASE_CANCELLED` code clears this attempt's temporary journal
  because its error guide says the attempt was not charged. The installed React
  Native SDK derives deprecated `userCancelled` from that same code, so the flag
  is not separate evidence. On iOS the code can also mean the item is already
  owned; cancellation feedback therefore directs users who expected access to
  Restore. A persisted active purchase clears. Generic unconfirmed clears after
  a user-initiated persisted Restore (active or verified empty), or a later
  current-owner active CustomerInfo result that is durably persisted.
- RevenueCat `PAYMENT_PENDING_ERROR` is a distinct durable reason. Copy tells the
  user to follow Apple/Google instructions and not buy again. Verified-empty
  Restore does not clear it. A 30-day `expiresAt` review marker is anchored to the
  original write-ahead timestamp and is never refreshed by reads/retries, but it
  is not trusted time and never releases checkout. Only persisted active provider
  proof clears this pending reason. Any later resolution-bound retention policy
  requires provider/native evidence and counsel approval.
- Storage contains only a domain-separated owner binding, safety reason, status,
  creation timestamp, and payment-pending review timestamp—never an action,
  acknowledgement, Auth/provider user ID, product, order, receipt, or
  transaction ID. Foreign accounts receive one generic bit.
- Acknowledgement is process-local and hides the notice only for the current
  foreground; it performs no durable write and stores no behavioral timestamp.
  Purchase admission remains device-wide. The root host is above route content
  but behind App Lock, hidden for `inactive|background`, and bounded by a
  ScrollView for Dynamic Type.
- Terminal server-verified account deletion converts matching exact-owner
  records to one ownerless tombstone with only fresh `kind`, `createdAt`, and
  `expiresAt`. It omits the old owner/reason/provider/product/original
  timestamp. `expiresAt` is a 30-day review marker, not an automatic deletion or
  admission signal. Manage subscription, Support, verified-empty Restore, and
  device-clock changes never clear it; persisted active Restore or active listener
  verification clears it while leaving foreign exact records.
- Malformed, future, or unavailable storage is never overwritten and fails
  closed. Emergency in-memory promotion must be persisted before later reads or
  admission decisions.

RevenueCat documents that Restore must be user-initiated because it can show OS
sign-in UI, and that CustomerInfo must be checked for active entitlement:
https://www.revenuecat.com/docs/getting-started/restoring-purchases. Its error
guide distinguishes pending payment (additional user action required) from
documented cancellation (not charged, with an iOS already-owned caveat):
https://www.revenuecat.com/docs/test-and-launch/errors.

## Expo web-compatible subset

Run one fixture at a time in a `__DEV__` development build:

```powershell
$env:EXPO_PUBLIC_E2E_ACCOUNT_ISOLATION='signout_clear_retry'
$env:EXPO_PUBLIC_E2E_STORE_TRANSACTION_NOTICE='purchase_unconfirmed'
npm --workspace apps/mobile run web
```

Repeat with `payment_pending`, `deleted_account_pending`, and `foreign_pending`.
The allowlist is disabled in production. Start at 375 x 667; 360 x 640 is
optional resilience evidence. For each applicable fixture capture:

1. Exact visible title/body, alert semantics, Restore control, and 44 px minimum
   targets; `payment_pending` must expose Manage and Support, and the deletion
   tombstone must expose Restore, Manage, and Support.
2. Missing/invalid support configuration produces truthful in-modal feedback.
   Opening Manage/Support says the safety block remains and does not dismiss it.
3. `Not now — keep purchase blocked`, route navigation, refresh/relaunch, and
   return to foreground re-show the alert without reopening checkout.
4. App Lock covers the notice. `inactive` and `background` remove the Modal from
   the visible tree; returning active re-reads durable state.
5. Large text pressure scrolls the card at 375 x 667 without horizontal overflow,
   clipped controls, blocked hit centers, or inaccessible actions.
6. A foreign fixture exposes no owner/reason details. The web-preview
   Restore failure stays honest and never claims native StoreKit proof.
7. Capture screenshots, accessibility snapshot, console log, fixture/build
   values, and a run report in
   `test-results/human-e2e/2026-07-13/store-transaction-unconfirmed-web/`.

The current Windows run captured pre-fix purchase-unconfirmed and payment-pending
observations at 375 x 667, including dismissal/reload, failed Restore, and Manage
feedback. The operating-system Support handoff then disconnected browser control,
so deletion and foreign fixtures were not exercised. Later readback, clock-safety,
contrast, accessibility-name, and Restore-feedback changes invalidate every image
as final acceptance evidence; rerun all four fixtures. Do not manipulate browser
localStorage or cookies to fabricate these states; use only the guarded fixture
path.

## Required physical-iPhone/TestFlight gate

With redacted staging accounts and the live-intended RevenueCat configuration:

- prove no SDK invocation for admission/config/offering failure and for failed
  write-ahead; prove SDK invocation occurs only after the durable hook;
- force account A to close/switch during a delayed hook: SDK count is zero and
  live compensation removes A's new journal; force-quit after native start and
  verify relaunch promotion;
- exercise caller-detached watchdog, offline/store-problem, fulfilled purchase
  with no mapped entitlement, successful active purchase, and documented user
  cancellation;
- exercise Ask-to-Buy/payment-pending approval and decline on a physical device;
  verify empty Restore retains pending, later active provider state clears it,
  and device-clock forward/rollback cannot release checkout;
- verify generic exact-owner empty/active Restore, foreign-account Restore,
  automatic active CustomerInfo resolution, and preservation of other owners;
- verify deletion with unresolved generic and pending records, fresh ownerless
  tombstone minimization, immediate deletion availability, Manage/Support copy,
  active Restore resolution, review-marker handling, and a counsel-approved
  provider-trusted resolution path if one is later introduced;
- verify foreground/background/app-switcher privacy, App Lock, force-quit,
  VoiceOver focus order, maximum supported Dynamic Type, safe areas, and gestures;
- verify Apple ID/account transfer/alias combinations and the production policy
  with exactly one subscription group.

Record build ID, iOS/device model, sandbox/TestFlight Apple-ID arrangement,
RevenueCat project/environment and transfer behavior, redacted account mapping,
screen recording, device logs, and provider dashboard state. Expo web, unit
tests, simulators without the real store, or Windows cannot close this gate.

## Launch-policy gates

- Apple says account deletion must remain straightforward and that apps with
  subscriptions must explain continuing billing/cancellation; scheduling later
  deletion is allowed only when immediate deletion also remains available:
  https://developer.apple.com/support/offering-account-deletion-in-your-app.
- Resolution-bound ownerless/pending retention, the device-clock 30-day review
  marker, and the single-subscription-group assumption require privacy/consumer
  counsel approval against the launch jurisdictions and production privacy
  notice. They are engineering safety/minimization choices, not legal conclusions
  or fixed retention maxima.
- A malformed or unavailable local journal currently fails closed before deletion
  intake and terminal local finalization. A tested recovery path that preserves
  commerce safety without denying Apple's in-app deletion requirement must be
  approved before launch; source tests alone do not resolve that policy conflict.
- Live RevenueCat entitlement, product, restore/transfer/alias, webhook, and
  subscriber-recreation behavior must pass the release matrix. A placeholder
  support endpoint is a launch blocker.
