# Notification permission preflight and recovery checkpoint

Date: 2026-07-25
Status: Implemented and locally verified; signed-device delivery matrix pending

## Outcome

Notification scheduling now fails closed on authoritative OS permission state without erasing saved user intent:

- complete Expo permission responses are normalized to `granted`, `denied`, `undetermined`, or typed `unavailable`;
- iOS authorized, provisional, and ephemeral states count as delivery-capable;
- bridge failures and malformed responses remain content-free and cannot be misclassified as a user denial;
- onboarding returns a genuine denial as `false`, while unresolved or unavailable requests throw a safe typed error and stay on the existing retry route;
- AM, PM, and capture schedules read permission before the cached-signature fast path, clear the signature on revocation, cancel only their exact owned IDs, and rebuild from saved intent after access returns;
- trial reminders cancel the prior exact ID and report blocked scheduling truthfully; foreground permission reconciliation cancels that global ID on denial/unavailability and restores it from owner-fenced authoritative local entitlement evidence after access returns;
- every granted owner generation performs one deferred authoritative trial audit, so cold restart, process-local marker loss, and absent/unreadable notification preferences cannot strand an active trial reminder;
- corrupt, unsupported, or temporarily unreadable entitlement evidence never collapses to an assumed absence or cancels a valid trial schedule; the bounded reconciliation retry remains armed instead;
- behavioural delivery checks permission before UUID allocation, cap-ledger reservation, native scheduling, confirmation, or outbox work;
- the preference query forces a refetch on every shared TanStack focus/AppState transition, including while its local result is fresh;
- the Settings route includes active-trial-only delivery intent, suppresses stale action completions on blur/unmount, never prompts automatically, exposes a single accessible failure alert, and preserves every enabled preference through denied/unavailable states.

## Automated verification

- Mobile typecheck: PASS.
- Full mobile lint: PASS outside the restricted filesystem sandbox; the first sandboxed run failed only because ESLint import resolution was denied access to `C:\Users\jasim`.
- Focused changed-surface suite: 8 files, 140 tests, PASS.
- Coverage includes complete permission classification, malformed/bridge failure semantics, content-free request errors, fixed-schedule revocation/cache bypass/restoration, terminal-versus-retryable reconciliation, active-trial cache restoration, unreadable-evidence preservation, account-generation fencing, zero-side-effect behavioural blocking, foreground query contract, recovery UI source/lifecycle contract, onboarding truthfulness, settings placement, and entitlement result propagation.

## Human-simulated E2E

Codex in-app browser verification at 390 x 844 and 320 x 568 exercised:

1. saved Morning intent → undetermined permission;
2. explicit `Allow notifications` → granted;
3. reload with intent and grant retained;
4. unavailable permission → user retry;
5. denied/no-more-prompts → `Open settings`;
6. forced Settings opener failure → inline accessible error;
7. unchanged/undetermined OS request result → one inline accessible retry error with the action no longer busy.

The post-fix 390 x 844 first viewport contains no partial recovery action. Full actions are 55.99 px high, center-hit-testable after scroll, and both tested widths have zero horizontal overflow and no JavaScript dialog. A final 320 x 568 rerun after the alert-structure fix found exactly one `role="alert"`, a 246.48 x 55.99 px center-hit-testable action after scroll, zero overflow, and no application error. A fresh 390 x 844 unchanged-request fixture likewise produced exactly one content-free alert, released the busy state, retained saved Morning intent, opened no dialog, and logged no application error. See `test-results/human-e2e/2026-07-25/notification-permission-recovery-current/` (including `single-alert-inline-failure-320x568.png` and `unchanged-request-inline-failure-390x844.png`) and `docs/e2e-bug-reports/2026-07-25-notification-permission-recovery-partial-action.md`.

The full repository test command completed with 354 passing files / 4,262 passing tests and the same four pre-existing user-owned failures: one behavioural snapshot expectation and three Shelf metadata/expiry expectations. The permission deliver suite itself passed 52 tests in that run.

## Remaining external proof

Signed iOS and Android verification is still required for provisional/ephemeral authorization, Android 13 permission behavior, native Settings return, exact native cancellation/rebuild, trial restoration, banner presentation and tap routing, reboot/app-update behavior, DST/time-zone changes, lock-screen discretion, and screen-reader announcements.
