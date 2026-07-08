# E2E Bug Report: Community ask consent and submit recovery broke the enabled composer path

Severity: High
Surface: Expo web, with iOS/Android native alert risk
Environment: Expo web at 320 x 568, `EXPO_PUBLIC_PHASE7_COMMUNITY_POSTING_ENABLED=true`, local Supabase placeholder configuration
Feature: Community anonymous ask composer
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Start Expo web with community posting enabled.
2. Open `/community/ask` at a 320 px phone viewport.
3. Tick `You confirm you're 16 or older`.
4. Tap `Allow & continue`.
5. Type `Can glycolic acid cure acne if I use it every night?`.
6. Tap `Submit for review`.

## Expected Result

The consent gate is local-first while the backend ledger is unavailable, the composer opens after explicit age and consent, claim-heavy wording is flagged as a first-pass moderation signal, and deferred submission shows route-owned recovery without a blocking dialog or public post.

## Actual Result

Before the fix, `grantCommunityConsent()` set the local consent flag and then immediately rolled it back when the consent ledger mirror was unavailable, so local users could not reach the enabled composer. Source inspection also showed composer submit still used `Alert.alert`, creating a blocking native/system recovery path for the deferred posting state.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/community-ask-submit-inline-recovery-current/01-consent-gate-before-submit.png`
- Screenshot: `test-results/human-e2e/2026-07-08/community-ask-submit-inline-recovery-current/02-composer-before-submit.png`
- UI snapshot: pre-fix browser evaluation showed the route stayed on the consent gate after `Allow & continue` with Supabase placeholder configuration.
- Source: `apps/mobile/src/features/community/consent.ts` rolled back the local flag on ledger failure; `apps/mobile/src/app/community/ask.tsx` used `Alert.alert` for deferred submit.

## Frequency

- Always with local Supabase placeholder configuration when posting is enabled.
- Always for the deferred-submit code path on native before the fix.

## Scope

- Affected route/screen: `/community/ask`
- Affected account or fixture: Community posting enabled; local/offline backend state
- External service involved: Supabase consent ledger unavailable in local placeholder mode
- Destructive action involved: None

## Suspected Cause

The consent implementation contradicted the local-first community store contract by treating a missing ledger mirror as a reason to relock the UI. The composer also still used a platform alert for the intentionally deferred posting path instead of durable route-owned feedback.

## Minimal Fix Recommendation

Keep community participation consent local-first when the ledger mirror is unavailable, while firing analytics only after a successful ledger save. Replace the deferred submit platform alert with an inline `role="alert"` notice and scroll it into view on compact phones.

## Verification Flow After Fix

1. Open `/community/ask` with posting enabled and Supabase unconfigured.
2. Tick the 16+ checkbox and tap `Allow & continue`.
3. Confirm the anonymous composer opens.
4. Type claim-heavy text and confirm the claim-safety flag appears.
5. Tap `Submit for review`; confirm no dialog opens, no public post is created, the route remains `/community/ask`, and the inline deferred notice is fully visible.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/community-ask-submit-inline-recovery-current/03-composer-after-local-first-consent.png`
- Screenshot: `test-results/human-e2e/2026-07-08/community-ask-submit-inline-recovery-current/04-claim-flag-before-submit.png`
- Screenshot: `test-results/human-e2e/2026-07-08/community-ask-submit-inline-recovery-current/06-deferred-submit-inline-alert-visible.png`
- Logs: `test-results/human-e2e/2026-07-08/community-ask-submit-inline-recovery-current/console-warn-error.json`
- UI snapshot: `role="alert"` copy visible at y=292-471 in a 569 px viewport, `tab.getJsDialog()` returned `null`, and `scrollWidth=320`.
- Tests: `npm --workspace apps/mobile run test -- src/features/community/communityRoutes.test.ts src/features/community/consent.test.ts src/features/community/claimsafety.test.ts`

## Remaining Risk

- Untested branches: Native iOS/Android keyboard and screen-reader focus after the recovery scroll.
- Missing fixtures: Real production consent ledger save and moderation backend remain launch-gated.
- Follow-up needed: Native simulator pass once a mobile E2E harness or simulator session is available.
