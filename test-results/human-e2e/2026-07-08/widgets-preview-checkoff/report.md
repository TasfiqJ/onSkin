# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-08
- Codex task: Verify and finish `/routine/widgets` one-tap widget preview check-off.
- App surface: Expo web through Codex in-app browser.
- Build/start command: `EXPO_PUBLIC_E2E_ENTITLEMENT=pro EXPO_PUBLIC_PHASE7_WIDGETS_ENABLED=true npm --workspace apps/mobile run web -- --port 8166 --host localhost`
- Browser/device/simulator/OS: In-app browser, 320 x 568 viewport, Windows host.
- Feature tested: Reminders/widgets native-widget preview check-off.
- Overall verdict: Pass after accessibility fix.

## Tool Inventory

- Expo CLI: Used through `npm --workspace apps/mobile run web`.
- Expo web: Used on `http://localhost:8166/routine/widgets`.
- Codex in-app browser: Used for user-like taps, screenshots, logs, and DOM attribute checks.
- Playwright-style browser API: Used through the in-app browser runtime.

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| Open widgets surface | Pro entitlement with widgets enabled | Pass | `postfix-initial.png`, `postfix-initial-summary.json` | `ONE-TAP CHECK-OFF` renders, rows are 48 px checkboxes, no horizontal overflow. |
| Tap preview rows | Ceramide then SPF | Pass | `postfix-after-spf.png`, `postfix-after-spf-summary.json` | Count reaches `4 of 4`; both labels switch to `Undo preview check-off`; feedback mentions native widget build. |
| Accessibility state | Checkbox state before/after | Pass | `postfix-initial-summary.json`, `postfix-after-spf-summary.json` | `aria-checked=false` initially and `true` after tapping. |
| Error/dialog check | Dialog state and terminal warnings | Pass with expected environment warnings | `report.md` | No JavaScript dialog. Supabase placeholder and web notifications warnings were observed in the Expo terminal and are expected local blockers. |

## Bugs Found

| ID | Severity | Reproduction | Expected | Actual | Evidence |
| -- | -------- | ------------ | -------- | ------ | -------- |
| WIDGETS-PREVIEW-INERT-CHECKOFF | P2 | Inspect/tap the original `TAP` row in `/routine/widgets`. | Tappable-looking row is a real accessible control. | Static `View` with fake `TAP` affordance. | `docs/e2e-bug-reports/2026-07-08-widgets-preview-inert-checkoff.md` |
| WIDGETS-PREVIEW-ARIA-CHECKED | P2 | Browser-check the first fix on Expo web. | Checkbox state is exposed to web accessibility APIs. | `role="checkbox"` rendered without `aria-checked`. | `checkbox-attributes-after-spf.json` |

## Tests Added Or Updated

- `apps/mobile/src/features/subscription/proGatedRoutes.test.ts`
- Covers the interactive widget preview contract: checkbox role/state, explicit `aria-checked`, honest native-widget-build feedback, dynamic count, and removal of fake inert `TAP` affordance.

## Commands Run

```bash
npm --workspace apps/mobile run test -- src/features/subscription/proGatedRoutes.test.ts
EXPO_PUBLIC_E2E_ENTITLEMENT=pro EXPO_PUBLIC_PHASE7_WIDGETS_ENABLED=true npm --workspace apps/mobile run web -- --port 8166 --host localhost
```

## Remaining Risk

- Native WidgetKit/Glance/AppIntent check-off still needs physical-device Phase 7/Phase 5 QA.
- Local Supabase placeholder warnings remain expected until Tas provides production Supabase configuration.
