# E2E Bug Report: Scheduler ignored local onboarding profile before Supabase

Severity: High
Surface: Shared routine/scheduler data layer and routine-plan first value
Environment: Local Expo app state without configured Supabase; System Chrome Expo web at 320 x 568 for UI verification
Feature: Routine builder, actives scheduler, recommendations, and Ask profile grounding
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Complete onboarding locally so the device has a stored skin profile.
2. Run the app without configured Supabase, which is the current local launch state.
3. Open surfaces that consume `useProfileBits`: generated routine plan, cycle orchestration, recommendations, or Ask grounding.
4. For the user-visible routine-plan case, seed a local oily/resistant profile and a real shelf, then open `/routine/plan`.

## Expected Result

The app uses the local onboarding profile as the v1 source of truth, including sensitivity, moisture balance, pregnancy/breastfeeding state, and goals. `/routine/plan` labels the plan from that local profile instead of falling back to generic or hardcoded skin copy.

## Actual Result

`readProfileBits` checked Supabase configuration before reading the local onboarding profile. In a placeholder/offline Supabase state, it returned neutral defaults, so downstream surfaces could silently depersonalize after onboarding. On `/routine/plan`, the defect showed up as the profile label failing to reflect a real local oily/resistant profile.

## Evidence

- Unit test: `apps/mobile/src/features/scheduler/profile.test.ts`
- Source: `apps/mobile/src/features/scheduler/profile.ts`
- E2E evidence: `test-results/human-e2e/2026-07-08/routine-plan-profile-label-current/`
- Screenshots: `01-empty-example-label.png`, `02-local-profile-label.png`, `03-direct-entry-back-to-you.png`
- Browser logs: `empty-browser-logs.json`, `local-profile-browser-logs.json`

## Frequency

- Always when Supabase is not configured and a valid local onboarding profile exists.

## Scope

- Affected data source: `readProfileBits`
- Affected consumers: routine plan generation, cycle orchestration, recommendations, and Ask profile grounding
- External service involved: Supabase unavailable/placeholder local state
- Destructive action involved: None

## Related Issue Found In Same Flow

The direct-entry Back recovery pass returned to `/you`, where consent ledger reads attempted to query the placeholder Supabase URL before the fix. Consent ledger read/write/withdrawal paths now short-circuit when Supabase is unconfigured: reads return an empty ledger and writes/withdrawals fail with `CONSENT_BACKEND_UNAVAILABLE` before hashing or network calls.

## Suspected Cause

The shared profile helper treated Supabase configuration as the first gate and returned neutral defaults before consulting the device-local onboarding profile.

## Minimal Fix Recommendation

Read `getStoredSkinProfile()` first and map it into shared profile bits. Keep the neutral fallback only for the true empty state where no local profile exists and Supabase is unavailable.

## Verification Flow After Fix

1. Mock a local onboarding profile with oily/resistant axes, breastfeeding state, and a barrier-repair goal.
2. Call `readProfileBits`.
3. Confirm it returns oily/resistant, `pregnancy=true`, and the stored goal.
4. Clear the local profile and keep Supabase unavailable.
5. Confirm the neutral fallback still returns neutral/balanced/no pregnancy/no goals.
6. Open `/routine/plan` with no local shelf/profile and confirm the plan is labeled `EXAMPLE ROUTINE`.
7. Seed an oily/resistant local profile and real shelf, open `/routine/plan`, and confirm the label is `BUILT FOR OILY, RESISTANT SKIN`.
8. Tap Back and confirm `/you` renders without failed placeholder Supabase requests.

## Post-Fix Evidence

- `npm --workspace apps/mobile run test -- src/lib/consent/consent.test.ts src/lib/consent/withdrawal.test.ts src/features/scheduler/profile.test.ts src/features/routine/usePlan.test.ts src/features/routine/generate.test.ts src/features/today/todayRoute.test.ts src/features/subscription/proGatedRoutes.test.ts`
- Playwright System Chrome pass against Expo web: `scripts/tmp-e2e/routine-plan-profile-label.spec.js` before cleanup.
- Evidence folder: `test-results/human-e2e/2026-07-08/routine-plan-profile-label-current/`

## Remaining Risk

- Native iOS/Android full onboarding-to-plan UI should still be sampled during broader device QA.
- Live Supabase profile reconciliation remains blocked on staging/production Supabase credentials.
- The E2E run used seeded web storage to exercise the same local store payload shape; native secure-storage behavior still needs device QA.
