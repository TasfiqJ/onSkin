# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-14
- Codex task: Maximum React Native optimization, typed Ask grounded-turn private state
- App surface: Expo web
- Build/start command: `npm --workspace apps/mobile run web -- --port <fixture-port>`
- Browser/device/simulator/OS: Codex in-app browser on Windows; 390 x 844 supported-phone override
- Feature tested: Ask grounded-turn quota recovery and deterministic-advisor separation
- Overall verdict: PASS for the current Expo-web recovery contract

This final pass ran after route readiness was separated from cloud-grounding readiness. Production entitlement or quota failures cannot pause the always-free deterministic advisor. The development-only quota fault fixture intentionally promotes the private-state failure to the full recovery surface so its retry, escape, safe-copy, and unsupported-version behavior can be driven directly.

## Tool Inventory

- Expo CLI: Available
- Expo web: Available
- Codex in-app browser: Available
- Physical iPhone / iOS Simulator: Not used; native protected-storage interruption remains external

## Flows Executed

1. Persistent private-storage failure (`EXPO_PUBLIC_E2E_ASK_TURNS_STORAGE_FAILURE=always`, port 8270)
   - Opened `/ask` directly and confirmed the expected `Guidance unavailable` start screen.
   - Confirmed the copy says private data was not reset or removed.
   - Clicked `Try again`; the route stayed fail-closed and added the bounded `still unavailable` message.
   - Reloaded `/ask`; the route returned to the same recovery state.
   - Clicked `Back to Today`; the app navigated to `/today` and rendered `Good morning.`
2. One-shot private-storage failure (`EXPO_PUBLIC_E2E_ASK_TURNS_STORAGE_FAILURE=once`, port 8271)
   - Opened `/ask` and confirmed the same recovery start state by retained role/text snapshot.
   - Clicked `Try again`; the full Ask surface returned and the recovery alert disappeared.
   - Typed `What should I do tonight?` into the restored composer and clicked `Send`.
   - Confirmed the deterministic local answer rendered with `answered by your conflict engine · $0`, an example routine, and `From your generated plan. Your products, in your sequence.` This was not a cloud-grounded quota turn.
3. Unsupported future private-state version (`EXPO_PUBLIC_E2E_ASK_TURNS_STORAGE_FAILURE=future`, port 8272)
   - Opened `/ask` and confirmed recovery instead of a fabricated zero-turn state by retained role/text snapshot.
   - Clicked `Try again`; recovery remained fail-closed.
   - Confirmed the UI did not expose `ASK_TURN_RECORD_UNSUPPORTED_VERSION` or another raw internal error.

All flows used `EXPO_PUBLIC_PHASE7_CLOUD_ASK_ENABLED=false`; the development fixture alone enabled the quota read. Separate behavioral tests set TanStack Query offline and prove that dormant/failed cloud state does not block deterministic prompt submission in production routing.

## Evidence

- `persistent-recovery.jpg`: initial persistent-failure recovery card.
- `persistent-after-retry.jpg`: bounded retry failure message with both escape actions intact.
- `one-shot-restored.jpg`: restored Ask header, suggested questions, composer, and disclosure.
- `one-shot-deterministic-answer.jpg`: completed deterministic Ask turn after recovery.
- `future-version-after-retry.jpg`: unsupported-version retry remains fail-closed.
- `observations.json`: retained visible-text snapshots for every branch, geometry/hit tests, routes, warning/error inventory, capture dimensions, and the boundary between UI-copy and unit-level byte-preservation proof.

The one-shot and future initial states were retained as role/text snapshots because they matched the persistent initial recovery state exactly; the shared visual state is represented by `persistent-recovery.jpg` instead of duplicate captures.

Phone-layout observations:

- Requested override: 390 x 844 CSS pixels.
- Observed DOM viewport: 390 x 845 CSS pixels.
- Each retained JPEG: 390 x 843 pixels with JPEG magic bytes (`FF D8 FF`).
- No horizontal overflow appeared in recovery, restored Ask, or answered Ask states.
- Recovery actions measured 342 x 56 and 342 x 50 CSS pixels; center-point hit tests resolved to the intended controls.
- Restored answer-state controls measured at least 48 CSS pixels high, including the composer and Send action.
- No JavaScript dialog appeared in any branch.

Browser logs contained no app errors. Expected development-only warnings were limited to the intentionally blocked Supabase placeholder configuration, Expo Notifications' web limitation, and duplicate development GoTrue clients after reload.

Acceptance checklist result:

- Expected starting screen verified: PASS
- Tap/click/type/navigation/reload interaction: PASS
- Persistent error branch: PASS
- Recoverable one-shot branch: PASS
- Unsupported-version branch: PASS
- Safe data-preservation copy: PASS
- Supported-phone geometry and hit targets: PASS
- Raw internal error suppression: PASS
- Deterministic/cloud-readiness separation: PASS by focused behavioral tests
- Screenshot, snapshot, and console evidence retained: PASS
- Repository-wide human-E2E manifest freshness: FAIL because the generated manifest predates many pre-existing user-owned source/evidence changes; generated outputs were deliberately left untouched

## Remaining Risk

- Native encrypted-storage interruption is not proven by Expo web.
- The production cloud Ask provider and server-authoritative abuse caps remain launch blockers outside this local quota checkpoint.
- Signed iOS/Android builds, physical-device proof, and protected-storage process interruption remain external evidence gates.
