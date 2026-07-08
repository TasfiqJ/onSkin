# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-08
- Codex task: Clear remaining 320 x 430 clipped-control failures from the post-Recommendations sweep.
- App surface: Expo web in Codex in-app browser
- Build/start command: `npm --workspace apps/mobile run web -- --port 8231`
- Browser/device/simulator/OS: Codex in-app browser, 320 x 430 viewport
- Feature or PR tested: Community Skin Notes, Subscription Settings, Notification Settings, Shelf opened-date recovery
- Overall verdict: Pass

## Tool Inventory

- Expo CLI: available, served at `http://localhost:8231`
- iOS Simulator: not used
- Android emulator: not used
- Expo web: used
- Playwright: used through Codex in-app browser
- Playwright MCP: not used
- Codex Computer Use: not used
- Other: Browser geometry audit script

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| Skin Notes hub | 320 x 430 direct `/community` | Pass | `community.json`, `community.png` | Zero clipped/tiny/blocked controls |
| Skin Notes note tap | Tap formerly clipped natural/sensitive card | Pass | `community-natural-note-after-tap.json`, `.png` | Opened `/community/note/note-natural-gentler` |
| Subscription Settings | 320 x 430 direct `/settings/subscription` | Pass | `settings-subscription.json`, `.png` | Restore/Terms/Privacy complete 48 px rows |
| Subscription Restore | Tap Restore purchases | Pass | `subscription-restore-after-tap.json`, `.png` | Route-owned feedback, no JS dialog |
| Notification Settings | 320 x 430 direct `/settings/notifications` | Pass | `settings-notifications.json`, `.png` | Replenishment no longer peeks/clips |
| Replenishment switch | Tap Replenishment | Pass | `notifications-replenishment-after-toggle.json`, `.png` | Toggle accepted, no JS dialog |
| Shelf opened recovery | 320 x 430 direct `/shelf/opened` with no draft | Pass | `shelf-opened.json`, `.png` | Backdrop `Dismiss` no longer exposed |
| Shelf opened recovery CTA | Tap Add product by hand | Pass | `shelf-opened-add-by-hand-after-tap.json`, `.png` | Routed to `/shelf/manual` |

## Bugs Found

| ID | Severity | Reproduction | Expected | Actual | Evidence |
| -- | -------- | ------------ | -------- | ------ | -------- |
| 2026-07-08-remaining-short-phone-430-clearance | Medium | Open four routes at 320 x 430 | Visible controls fully visible or intentionally below fold | Four clipped controls in post-Recommendations sweep | `docs/e2e-bug-reports/2026-07-08-remaining-short-phone-430-clearance.md` |

## Tests Added or Updated

- Test file: `apps/mobile/src/features/settings/settingsRoutes.test.ts`
- What it covers: sub-460 px Subscription/Notification Settings density and preserved 48 px controls.
- Test file: `apps/mobile/src/features/shelf/shelfRoutes.test.ts`
- What it covers: no-draft `/shelf/opened` sheet hides the backdrop from accessibility while keeping visible recovery actions.
- Existing community route contract already covers the sub-460 px Skin Notes density.

## Commands Run

```bash
npm --workspace apps/mobile run test -- --run src/features/settings/settingsRoutes.test.ts src/features/shelf/shelfRoutes.test.ts src/features/community/communityRoutes.test.ts
npm --workspace apps/mobile run web -- --port 8231
```

## Remaining Risk

- Native iOS/Android safe-area and screen-reader behavior remain device QA.
- RevenueCat restore and native subscription-management handoff remain external service/device QA.
- Real native notification scheduling remains device QA.
