# Typed recommendation-state human E2E report

Date: 2026-07-14 (America/Toronto)
Surface: Expo web in the Codex in-app browser
Viewports: 375 x 667, 390 x 844, and an effective 390 x 845 from the 390 x 844 browser override
Result: PASS after one E2E-found lifecycle fix and adversarial dismissal-race hardening

## Scope

This pass verifies typed, non-destructive reads for recommendation preferences and dismissed suggestions across the For You hub, Preferences, recommendation detail, Today, and Ask. It also verifies that a failed `Not now` mutation cannot look like a successful dismissal.

The run used only development fixtures and local browser origins. No hosted account, Supabase row, purchase, message, or other external state was changed.

## Seed

On the isolated `http://127.0.0.1:8265` origin, the tester used visible app controls to select Vegan, Premium, and Gel, then opened `A ceramide moisturiser` and chose `Not for me`. The hub visibly retained only the mineral SPF and gentle cleanser cards. The same origin was reused across server restarts for one-shot recovery.

For the Today mutation branch, the tester added `Gentle Cleanser` through Add by hand, selected the Cleanser category and `Just opened it`, activated the local seven-day Pro preview, built the real routine, and opened Today with the SPF gap prompt visible.

## Flows and results

1. Persistent read failure (`EXPO_PUBLIC_E2E_RECOMMENDATION_READ_FAILURE=always`)
   - Hub: `Guidance unavailable`; no cards or reassuring empty-success state.
   - Preferences: `Recommendation choices unavailable`; no chips/default selections.
   - Retry: recovery stayed mounted and added persistent-failure copy.
   - Stale detail: recovery rendered before stale-detail copy or actions.
   - Ask: complete private-guidance recovery rendered, and persistent Retry surfaced retry-failed copy.
   - Today: no recommendation teaser or SPF prompt was published from unreadable choices.

2. Named loading (`EXPO_PUBLIC_E2E_RECOMMENDATION_READ_DELAY_MS=3000`)
   - Direct Preferences entry rendered `Loading recommendation preferences…` before controls.
   - The delay is development-only and clamped to 3,000 ms.

3. One-shot preference failure (`preferences_once`)
   - Initial direct entry rendered recovery.
   - Retry restored Vegan, Premium, and Gel with `aria-selected=true`; unrelated controls remained false.

4. One-shot dismissed-state failure (`dismissed_once`)
   - Initial hub entry rendered recovery.
   - Retry restored mineral SPF and gentle cleanser while `A ceramide moisturiser` remained absent (`count=0`).

5. Future schema (`future`)
   - Preferences rendered the same safe recovery surface.
   - Snapshot scan found no `REC_*`, `unsupported_version`, or future-schema code.

6. One-shot Today dismissal failure (`EXPO_PUBLIC_E2E_RECOMMENDATION_DISMISS_FAILURE=once`)
   - First `Not now` displayed `Suggestion not dismissed`; the alert and SPF prompt both remained after a 4.8-second wait.
   - `Reload suggestion` removed the alert but retained the prompt.
   - A second `Not now` committed successfully and removed the prompt.

7. Committed detail dismissal during a delayed strict reread (`EXPO_PUBLIC_E2E_RECOMMENDATION_READ_DELAY_MS=3000`)
   - At the mobile viewport, choosing `Not for me` synchronously removed the detail action surface and published the For You route in 43 ms, before the three-second strict reread completed.
   - The competing `Add to shelf` action was no longer visible after the route publication.
   - The tester chose the For You Back control while revalidation was still pending, then waited another 3.6 seconds. The app remained on Today with one recommendation left; no late second navigation occurred.

## E2E-found bug and fix

The first implementation kept dismissal-failure state inside `RecommendationsTeaser`. The strict query reset remounted that child and cleared the alert after it briefly appeared. The smallest fix moved ownership to the Today route and passed controlled failure callbacks into the teaser. The exact reproduction passed after the fix. See `docs/e2e-bug-reports/2026-07-14-recommendation-dismissal-failure-alert-remount.md`.

The final adversarial review also found that the original success handlers released their action lock before a delayed strict reread/navigation completed, and that leaving detail during pending work could permit a late second navigation or suppress shared cache containment. The hardened path keeps a ref-backed single flight, runs current-owner failure containment even after unmount, publishes a committed dismissal into the owner cache synchronously, starts strict invalidation in the background, and guards all React/navigation publication by mount state. The delayed mobile flow above verified the resulting timing and navigation behavior.

## Accessibility and interaction

- User-facing locators used accessible roles and names only.
- Recovery controls use the shared minimum 56-point Retry and 48-point exit contracts.
- Preference toggles exposed selected state through `aria-selected`.
- The dismissal failure used an alert/live-region and retained a named 48-point recovery button.
- The committed detail action disappeared before delayed revalidation, preventing a second dismissal or competing accept action.
- No JavaScript dialog appeared.

## Logs

Browser error count was zero. Expected local-preview warnings were limited to blocked Supabase placeholders, web notification limitations, repeated Metro disconnects caused by deliberate fixture restarts, and best-effort mirror warnings while authentication was intentionally unavailable. See `console-dialog-log.md`.

## Remaining risk

- This Expo-web pass does not prove iOS Keychain/SecureStore interruption behavior, native safe areas, VoiceOver, or physical-device process interruption.
- The best-effort Supabase preference mirror still has no durable outbox/timeout; local encrypted state remains authoritative and the deferred mirror reliability work is tracked in the optimization ledger.
- The 1,024-entry dismissal ceiling intentionally refuses further writes rather than resurrecting an older dismissed suggestion; a product-level recovery/retention policy remains open.

## Evidence files

See `screenshot-manifest.md`, `ui-snapshots.md`, `environment.md`, and `summary.json` in this folder.
