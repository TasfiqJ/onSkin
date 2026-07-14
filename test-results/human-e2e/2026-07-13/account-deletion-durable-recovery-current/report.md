# Human-Simulated E2E Run Report

## Summary

- Run window: 2026-07-13 to 2026-07-14 (America/Toronto)
- Codex task: durable asynchronous account-deletion mobile intake and recovery
- App surface: actual Expo web app with credential-free development fixtures; native iPhone evidence remains required
- Browser/device: Codex in-app Chromium browser on Windows; saved JPEG capture surface 1279 x 720
- Feature tested: pre-Auth recovery gate, status refresh, terminal Apple manual notice, signed-out continuation, retryable invalid receipt, expired receipt, and ownerless support-only receipt
- Overall verdict: Expo-web compatibility pass with the source-level publication-fence gap and native/hosted/provider gates still explicitly blocking launch

## Commands And Fixtures

The Expo app was relaunched on `http://localhost:8097/` with each of these development-only fixtures:

```text
EXPO_PUBLIC_E2E_ACCOUNT_DELETION_RECOVERY=pending_then_completed_manual
EXPO_PUBLIC_E2E_ACCOUNT_DELETION_RECOVERY=invalid
EXPO_PUBLIC_E2E_ACCOUNT_DELETION_RECOVERY=expired
EXPO_PUBLIC_E2E_ACCOUNT_DELETION_RECOVERY=invalid_support_only

npm --workspace apps/mobile run web -- --port 8097
```

No live Supabase URL, user session, provider credential, status capability, or destructive operation was used. Fixture branches do not call the account-deletion Edge Function, including when `Retry deletion request` is exercised.

## Flows Executed

| Flow | Human-simulated action | Observed result | Evidence |
| ---- | ---------------------- | --------------- | -------- |
| Pending recovery gate | Launch with unresolved deletion | One alert and one `Check status now` control; product/Auth/vendor subtree remained blocked | `01-pending-1279x720.jpg` |
| Manual status refresh | Click `Check status now` | Transitioned to the terminal Apple-manual state with `Open Apple instructions` and `Continue` | `02-apple-manual-1279x720.jpg` |
| Safe post-delete continuation | Click `Continue` | Opened the signed-out landing page with `Begin` and `I already have an account`; no account content appeared | `03-signed-out-landing-1279x720.jpg` |
| Retryable invalid receipt | Launch invalid fixture, click `Check status now`, then `Retry deletion request` | Stayed blocked in the invalid state; exactly one retry and one support action remained available; fixture issued no destructive request | `04-invalid-receipt-1279x720.jpg` |
| Expired receipt | Launch expired fixture and click `Check status now` | Stayed blocked; `Open support` remained available and no retry action was offered | `05-expired-receipt-1279x720.jpg` |
| Ownerless support-only receipt | Launch `invalid_support_only` and click `Check status now` | Stayed blocked; `Open support` remained available and no retry action was offered | `06-ownerless-support-only-1279x720.jpg` |

The external Apple and support links were not opened, so this run does not claim external handoff behavior. The fixture retry control was exercised only to verify the non-destructive UI transition.

The exact fixture/action/button trace, role counts, expected-warning classes, safety flags, capture dimensions, and limitations are retained in `observations.json`. The manifest builder parses every committed JPEG header and requires this structured record; it does not infer native, hosted, or provider proof from the screenshots.

## Browser Observations

- Each recovery screen exposed one alert landmark and no dialog landmark.
- The pending branch had exactly one `Check status now` button.
- The terminal branch had uniquely named `Open Apple instructions` and `Continue` buttons.
- The retryable invalid branch had exactly one each of `Check status now`, `Retry deletion request`, and `Open support`.
- The expired and ownerless support-only branches had `Check status now` and `Open support`, with no retry button.
- The signed-out landing page exposed `Begin` and `I already have an account`; no authenticated route or account content appeared.
- Browser error count was zero. The only console warnings were the expected placeholder Supabase configuration and Expo notifications web-support warnings.
- On the recorded 1279 x 720 Expo-web surface, all primary controls were visible and reachable with no observed horizontal clipping. This run does not claim a compact-phone viewport pass.

## Related Automated Verification

The integrated checkpoint passed repository typecheck, lint, and 227 test files / 2,430 tests after the final forced-sign-out quarantine integration. Focused owner-bound deletion/recovery/barrier coverage also passed, including:

- v2 owner binding and captured verified bearer authority;
- A-local/B-active and B-local/B-active barrier branches;
- foreign-owner preservation versus exact-owner private cleanup;
- invalid, expired, unavailable, malformed, and ownerless support-only recovery;
- timeout and late-response containment;
- durable terminal cleanup/notice ordering; and
- pre-Auth gate ordering before Auth, private data, vendors, sync, and routes.

Final repository verification is rerun after every source correction; the commit record, not this prose snapshot, is authoritative for the final test count.

## Remaining Launch Gates

- Implement and rehearse migration `20260713000052_account_session_publication_fence.sql`: reserve/activate/renew/release publication leases under the account lock, drain them before provider deletion, require a settling interval plus repeated absence, and prevent finalization while a lease is live.
- Add a provider-approved block/reaper or continuing detect-and-redelete control for old or tampered clients that can recreate RevenueCat identity outside the new client fence.
- Run protected, target-bound destructive staging workflows with explicitly authorized disposable accounts and preserve redacted evidence for response loss, worker continuity, provider reconciliation, stale-session writes, Storage/service-row residue, and final absence.
- Repeat the recovery branches on a supported physical iPhone with VoiceOver, Dynamic Type, safe areas, Keychain persistence, force-quit/relaunch, foreground/background, external links, Apple credential revocation, and native notification behavior.
- Complete qualified privacy/legal review, final App Store metadata/privacy disclosures, and App Review. This credential-free Expo-web pass is not evidence of hosted-provider completion, legal approval, Apple approval, or revenue readiness.
