# Human E2E Report: Persistent Routine Order

Date: 2026-07-10
Status: pass
Surface: Expo web in the Codex in-app browser
Viewports: 360 x 640 and 390 x 844

## Fixture

The flow added `Gentle Cleanser`, `Hydrating Toner`, `Barrier Moisturizer`, and `Retinol 0.3% Night Serum` through the real manual Shelf UI. The local profile remained unavailable after the current health-data consent review, so the cautious safety path correctly kept retinol out of Plan and Today. `Calm Face Oil` was added later through the same UI to force a live plan recompute.

## Flow

1. Opened generated Plan and used the new phase-specific Morning entry.
2. Moved `Barrier Moisturizer` ahead of `Hydrating Toner`.
3. Switched to Evening in the same editor and moved `Gentle Cleanser` after `Hydrating Toner`.
4. Saved, reopened both phases, reloaded Plan, and verified both orders remained.
5. Made another Morning move, tapped Cancel, and verified the last saved order remained.
6. Opened Today AM and PM and verified phase check-offs followed the saved order.
7. Added `Calm Face Oil`; Plan recomputed to place it after the surviving custom PM sequence without resetting AM or PM preferences. Reload produced the same result.
8. Restarted the same origin with `EXPO_PUBLIC_E2E_ROUTINE_ORDER_SAVE_FAILURE=once`, changed PM order, and tapped Save. The editor stayed open with one inline alert, no dialog, and the previous routine unchanged. Retry persisted the new order.
9. Repeated final Plan, editor, Today, geometry, and accessibility checks at 360 x 640 and 390 x 844.

## Results

- Morning saved order: `Gentle Cleanser -> Barrier Moisturizer -> Hydrating Toner`.
- Final Evening saved order: `Hydrating Toner -> Gentle Cleanser -> Calm Face Oil -> Barrier Moisturizer`.
- Stable shelf IDs, not product names, back the persisted order; duplicate-name behavior is pinned by unit tests.
- The safety-excluded retinol never re-entered Plan or Today through the order preference.
- Today no longer mentions retinoid preparation when no retinoid step is scheduled.
- Morning/Evening expose a named tablist and exact `aria-selected=true/false` state.
- Final Plan, editor, failure, and Today geometry reports have zero horizontal overflow, clipped controls, or visible controls below 44 px.
- No JavaScript dialog opened. Browser warn/error capture contains only the expected local Supabase placeholder warnings and Expo's documented web notification warning.

## Bugs Found And Fixed

1. The nominal 44 px Plan edit/safety controls rendered as 43.99 px. Their floor is now 48 px.
2. `pmDisplaySub` always gave cleanser retinoid-preparation copy. It now requires an actual scheduled retinoid step.
3. React Native web did not emit selected state from `accessibilityState` alone. The phase tabs now set explicit `aria-selected`, and the parent exposes `tablist`.

## Evidence

- `03-save-failure-360x640.png` and `.txt`
- `04-plan-retry-saved-390x844.png` and `.txt`
- `05-evening-editor-390x844.png` and `.txt`
- `07-today-pm-corrected-390x844.png` and `.txt`
- `08-today-pm-final-360x640.png` and `.txt`
- `09-plan-final-360x640.png` and `.txt`
- `10-editor-final-360x640.png` and `.txt`
- `*-geometry-*.json`, `phase-tab-accessibility.json`, and `browser-warn-error-logs.json`

## Remaining Risk

Expo web proves route behavior, persistence across reload, deterministic recompute, failure recovery, semantics, and responsive geometry. Physical iOS/Android encrypted-storage relaunch, VoiceOver/TalkBack traversal, keychain/keystore behavior, and OS lifecycle QA remain release-device evidence for Tas. Cross-device sync is not a V1 claim.
