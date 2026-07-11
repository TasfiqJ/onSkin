# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-10 to 2026-07-11 (single continuous run)
- Codex task: Full authored cycle settings and deterministic reconciliation
- App surface: Expo web in the Codex in-app browser
- Build/start command: `npm --workspace @onskin/mobile run web -- --port 8154`
- Browser/device: Chromium-compatible in-app browser at 390 x 844 and supported-floor 360 x 640
- Fixture: Existing encrypted local profile/shelf with Glycolic 7% Toner eligible, Retinol 0.3% Night Serum safety-paused, Mineral SPF 50, and Pro E2E entitlement
- Environment: `EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro`, cadence gate `open` then `closed`, cycle write failure `once`
- External services: None; expected Supabase placeholder and web notification warnings only
- Overall verdict: Pass after three issues found and fixed

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| --- | --- | --- | --- | --- |
| Enter Custom, edit length, Cancel, reopen | Cancel transaction | Pass | `custom-settings-top-360x640.png` | Draft changed from 7 to 8 nights; persisted state remained 7. |
| Move Glycolic from Night 1 to Night 2 | Assignment | Pass | UI snapshot in task transcript | Recovery and eligible-active radio choices had unique accessible names. |
| Increase frequency | Cadence-safe extension | Pass | `custom-14-night-preview-390x844.png` | Editor extended 7 to 14 nights so two occurrences stayed at 1/week. |
| Save during injected private-write failure | Pending, browser Back, retry | Pass | `custom-save-failure-and-back-guard-390x844.png` | Controls and route removal stayed locked; full draft and alert remained; retry committed and exited. |
| Reload committed Custom | Persistence | Pass | `custom-persisted-reload-390x844.png` | Stable IDs, length, assignments, and requested/applied cadence survived reload. |
| Shorten while intent exceeds cadence | Retained intent | Pass | `custom-persisted-reload-390x844.png` | Save remained available; 1.8/week requested versus 0.9/week applied was explicit. |
| Save preset, return to Custom | Preset round trip | Pass | UI snapshot in task transcript | Gentle regenerated without deleting the saved Custom definition. |
| Week, Why Tonight, Today, Plan | Cross-surface authority | Pass | `custom-week-reconciled-390x844.png`, `why-tonight-cadence-cap-390x844.png`, `today-custom-projection-390x844.png`, `plan-custom-projection-390x844.png` | Night 1 applied Glycolic; Night 2 reconciled to recovery with `cadence_cap`; all surfaces agreed. |
| Force cadence review gate closed | Safety/review gate | Pass | `custom-withheld-review-gate-390x844.png` | Stored Custom was withheld and never described as a missing shelf product. |
| 360 x 640 layout | Supported-floor geometry | Pass | `custom-settings-top-360x640.png`, `custom-settings-bottom-360x640.png` | 360 client/scroll width, no horizontal overflow, minimum interactive size 48 x 48, no undersized controls. |

## Bugs Found

| ID | Severity | Result | Record |
| --- | --- | --- | --- |
| CYCLE-E2E-001 | High | Fixed and re-run | `bug-runtime-cadence-module-cycle.md` |
| CYCLE-E2E-002 | Low | Fixed and re-run | `bug-why-trace-label-wrap.md` |
| CYCLE-E2E-003 | Medium | Fixed and re-run | `bug-pending-browser-back.md` |

## Tests Added Or Updated

- `customCycle.test.ts`: schema, length budgets, retained intent, deterministic projection, and all reconciliation reasons.
- `cycleStore.test.ts`: v2 migration/isolation, malformed/future/missing-schema preservation, concurrent disruption plus Custom save.
- `orchestrate.test.ts`: generated/Custom weekly budget equivalence and normalized cadence.
- `cycleWeekRoute.test.ts`: complete editor, persistence ordering, analytics transition, review gate, and pending route guard.
- `localDeviceExport.test.ts`: authoritative v2 cycle export plus explicitly labeled legacy state.
- `todayRoute.test.ts`: only an actually performed active night advances cycle completion.

## Commands Run

```text
npm --workspace @onskin/mobile run typecheck
npm --workspace @onskin/mobile run lint
npm --workspace @onskin/mobile exec vitest run <focused files>
npm --workspace @onskin/mobile exec vitest run src/features/scheduler ...
git diff --check
```

## Browser Diagnostics

- JavaScript dialogs: 0.
- Unexpected post-fix runtime errors: 0 (`browser-warn-error-logs.json`).
- Expected development warnings: Supabase placeholder URL/key and expo-notifications web limitation.
- Geometry: 360 px client width, 360 px scroll width, 48 px minimum visible control dimension.


## Remaining Risk

- Native encrypted-storage relaunch, process death, Android hardware Back, iOS swipe-back, timezone/DST changes, Dynamic Type, VoiceOver/TalkBack, and physical-device rendering remain release-device QA.
- Clinical and cosmetic-chemistry cadence approval remains blocked by `B-DERM-REVIEW`; production keeps cycle cadence withheld until that signoff.
- Cross-device/server cycle history remains `B-ROUTINE-PERSIST`.
