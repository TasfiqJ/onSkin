# Phase 11 RevenueCat Production Verification

Status: BLOCKED until live production payment evidence exists.

## Required Verification

| Item | Evidence |
| --- | --- |
| iOS product IDs match App Store Connect | BLOCKED |
| Android product IDs match Play Console | BLOCKED |
| Offering and entitlement IDs match app config | BLOCKED |
| Annual/monthly/trial pricing reviewed | BLOCKED |
| Purchase completes on production candidate | BLOCKED |
| Restore works on iOS and Android | BLOCKED |
| Webhook reaches Supabase | BLOCKED |
| Supabase entitlement grant matches RevenueCat customer state | BLOCKED |
| Refund/cancel/billing retry events documented | BLOCKED |
| Customer deletion/reconciliation path documented | BLOCKED |

## Anti-Inflation Rules

- Do not treat TestFlight sandbox purchases as revenue.
- Do not annualize gross launch revenue without active-subscriber context.
- Track refunds, trials, cancellations, billing issues, taxes, and store fees separately.
- Reconcile App Store, Play, RevenueCat, and Supabase; do not rely on one dashboard.

## Launch Blockers

- restore failure
- entitlement mismatch
- unexpected charge
- webhook failure
- unclear Pro value
- product IDs not reviewed
- support lacks payment escalation path

