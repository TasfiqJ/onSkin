# You Mutation-Isolation Human-Simulated E2E

Date: 2026-07-16 (America/Toronto)
Surface: Expo web development build, Codex in-app browser
Route: `http://localhost:8237/you?section=privacy`
Branch: `optimization`

## Fixture

- `EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro`
- `EXPO_PUBLIC_E2E_APP_LOCK_ENABLED=disabled`
- `EXPO_PUBLIC_E2E_APP_LOCK_READY=available`
- `EXPO_PUBLIC_E2E_APP_LOCK_AUTH=unavailable`
- `EXPO_PUBLIC_E2E_EXTERNAL_OPEN_FAILURE=browser`
- `EXPO_PUBLIC_E2E_DATA_EXPORT_DELAY_MS=2500`
- `EXPO_PUBLIC_PHASE7_COMMERCE_ENABLED=true`
- Policy and support URLs used configured `https://routinekind.com/...` placeholders.

The route was direct-opened, then allowed to settle before each counter baseline. Counter conclusions use deltas because development reloads, hydration, and query reconciliation make absolute counts non-contractual.

## 390 x 844 Ownership Matrix

Requested viewport 390 x 844; observed CSS viewport 390 x 845. Horizontal overflow remained 0 px.

| Gesture | Exact action-start delta | Allowed render deltas | Protected render deltas | Result |
| --- | ---: | --- | --- | --- |
| Data-sharing switch double-click | Consent +1 | Consent coordinator +4; Commerce +3; Privacy +3 | Screen, mutation shell, Account, Subscription, static overview, Security, Policies, Data, data-rights coordinator all 0 | Both shared switches settled on; no alert |
| App-lock switch double-click | App lock +1 | Security +3 | Every other measured owner 0 | Switch remained off; one inline unavailable alert |
| Terms policy double-click after a stable baseline | Policy +1 | Policies +3 | Every other measured owner 0 | One inline link-unavailable alert; no dialog |
| Delayed export double-click | Export +1 | Pending: data-rights coordinator +1, Privacy +1, Data +1; settled: each +3 | Screen, mutation shell, Account, Subscription, static overview, Commerce, Security, Policies all 0 | `Preparing...` and Delete were disabled during the 2.5-second fence; one sanitized export-failed alert after local web failure |
| Withdrawal prompt double-click, then Cancel | Destructive +0 | Open: data-rights coordinator +1, Privacy +1, Data +1; cancelled: each +2 | All other measured owners 0 | One inline confirmation; Cancel restored idle state |
| Delete prompt double-click, then Cancel | Destructive +0 | Open: data-rights coordinator +1, Privacy +1, Data +1; cancelled: each +2 | All other measured owners 0 | One inline confirmation; Cancel restored idle state |

No destructive confirm control was activated. Pure state-machine and source-order tests cover exact destructive single-flight execution.

## Responsive Layout

- Requested 375 x 667; observed 376 x 668. The Delete confirmation alert and both buttons were fully visible. Delete and Cancel were each about 56 px high, and horizontal overflow was 0 px.
- Requested and observed 430 x 932. Direct entry placed `PRIVACY & CONSENT` at about y=35.9 px, followed by Policies and Your Data in source order; horizontal overflow was 0 px.
- The final 390 x 845 state had no pending alert, enabled Export/Delete controls, synchronized data-sharing switches, and 0 px horizontal overflow.

## Browser Health

- JavaScript dialogs: 0 before, during, and after the measured actions.
- Browser console errors: 0.
- Warnings: six across two development reloads, all matching the known placeholder-Supabase and Expo-notifications-on-web signatures.
- No provider/backend error text was rendered. Data-right failures used the sanitized settings message.

## E2E-Found Bugs And Fixes

1. The first real consent double-click produced two starts because a fast local save released its ref guard between the gesture's two browser click events. The guard now stays claimed through the next animation frame. The repeated gesture produced one start and one durable choice.
2. The existing export E2E delay ran after local snapshot collection, so a web collection failure could skip the pending fixture. The development-only delay now fences the export operation before collection. The repeated gesture showed `Preparing...` for the configured delay and still started exactly once.

See:

- `docs/e2e-bug-reports/2026-07-16-you-fast-mutation-double-activation.md`
- `docs/e2e-bug-reports/2026-07-16-data-export-delay-skipped-local-failure.md`

## Evidence Files

- `390x844-export-pending.png`
- `390x844-withdraw-confirmation.png`
- `390x844-delete-confirmation.png`
- `390x844-final.png`
- `375x667-delete-confirmation.png`
- `430x932-direct-entry.png`
- `metrics.json`
- `browser-logs.json`

## Claim Boundary

This run proves the measured development Expo-web ownership path, rapid-gesture serialization, shared data-right exclusion, visible pending/confirmation feedback, supported-phone geometry, and sanitized failure behavior. It does not prove production Hermes commit duration, native LocalAuthentication/SecureStore behavior, authenticated consent success, native share sheets, live export/deletion/withdrawal, VoiceOver/TalkBack, or physical-device frame/CPU/memory behavior.
