# E2E Bug Report: Fresh consent grant bounced away from goals

- Severity: High
- Surface: Expo web
- Environment: Development Expo web, 390 x 844 viewport, local Supabase placeholders
- Feature: Health-data consent, activation interlock, and first-run onboarding
- Date: 2026-07-15
- Tester: Codex in-app browser

## Reproduction Steps

1. Start Expo web with the dev-only local reset enabled and open `/?e2eReset=local`.
2. Tap Begin, pass the neutral DOB gate, and decline health-data collection.
3. Confirm `No consent recorded`, then tap `I agree. Continue` once.

## Expected Result

The durable grant creates a fresh processing epoch, the global activation interlock selects `/onboarding/goals`, goals mounts once, and the route remains stable.

## Actual Result

The grant was durable and goals appeared transiently, but two successive defects
restored an earlier age/consent history entry. First, the consent screen and the
global lifecycle gate both issued navigation for the same activation. After that
duplicate owner was removed, acknowledgement changed the activation interlock's
root element type and remounted the nested Expo Router stack. Expo Router's web
history contraction then invoked history traversal/popstate and restored the prior
entry. The user could not proceed despite a valid grant.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-15/health-consent-withdrawal-current/04-bug-consent-retry-failed-390x844.png`
- Transient pre-fix goals captures: `10-goals-stable-390x844.png` and `12-goals-stable-390x844.png` (the filenames reflect the intended assertion; the subsequent route trace proved they were not stable)
- UI trace: fresh grant reached `/onboarding/goals` and then returned to `/onboarding/age` or `/onboarding/consent` within the same interaction
- Terminal diagnostic: both the consent screen and `HealthDataLifecycleGate` initially issued a goals navigation for the same grant
- High-frequency route trace after removing that duplicate still showed goals -> age, isolating the remaining stack-remount/history restoration defect

## Frequency

- Always in the reproduced decline-to-grant flow

## Scope

- Affected route/screen: `/onboarding/consent`, `/onboarding/goals`, and the dormant `/onboarding/age` stack entry
- Affected account or fixture: local unconfigured development owner after an initial refusal
- External service involved: none
- Destructive action involved: no; the flow changes health-data consent authority

## Root Cause

The failure had two layers:

1. The consent screen and the synchronous activation interlock both navigated
   after a fresh grant.
2. The activation acknowledgement changed the gate root from
   `MountedGoalsActivationInterlock` to `Fragment`. That conditional wrapper
   identity remounted the nested Expo `Stack`; on web, the router's history
   contraction used `history.go`, and the resulting popstate restored the earlier
   age/consent entry.

Paused-shell reconsent and fresh-verification retry also retained screen-owned
route commands. They were removed so the global lifecycle gate is the sole
navigator for every activation-barrier release.

## Minimal Fix Recommendation

- Resolve the stored-age skip at Welcome instead of from a self-navigating age screen.
- Recheck age immediately before recording a consent choice, including direct consent entry.
- Return the durable `activationRoutePending` result from the grant operation.
- When that barrier is pending, make `HealthDataLifecycleGate` the sole goals navigator; only an already-active refresh without a barrier navigates from the screen.
- Keep the activation-interlock wrapper structurally stable while acknowledgement toggles only its overlay, pointer-event, and accessibility barrier state; do not remount the nested Expo stack.
- Remove paused-shell reconsent/retry route commands so the gate remains the sole navigation owner.
- Use a synchronous ref as well as rendered busy state to reject concurrent consent actions.

## Verification Flow After Fix

1. Repeat reset -> age -> decline -> one grant tap at 390 x 844.
2. Wait on goals, then reload and confirm goals remains selected.
3. Repeat the direct already-active consent refresh and confirm exactly one route command.
4. Re-run focused lifecycle, activation-interlock, route, and consent-component tests.

## Post-Fix Evidence

- Fresh reset/grant: `23-fresh-grant-goals-final-390x844.png` and
  `24-fresh-grant-goals-reload-final-390x844.png`.
- Terminal fresh reconsent: `20-reconsent-goals-stable-postfix-390x844.png`
  and `22-reconsent-goals-reload-postfix-390x844.png`.
- Both activation paths reported `/onboarding/goals` at every 100 ms sample
  through 1.9 seconds and again at 6.5 seconds; reload remained on goals.
- Runtime regression coverage keeps the wrapper child mounted exactly once,
  preserves child state, toggles the pointer/accessibility barrier, acknowledges
  once, and proves paused reconsent/fresh-verification retry issue zero local
  route commands.
- Full run report: `test-results/human-e2e/2026-07-15/health-consent-withdrawal-current/report.md`.

## Remaining Risk

- Native iPhone navigation-stack behavior and process-death activation still require device/TestFlight evidence.
