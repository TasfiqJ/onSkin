# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-13
- Codex task: Verify the launch-blocked Trend route-group privacy gate and direct-route identity.
- App surface: Expo web
- Build/start command: `npm --workspace apps/mobile run web -- --port 8267 --clear`
- Browser/device/simulator/OS: Codex in-app browser plus Google Chrome 149 on Windows. The first run requested 375 x 667 and observed 376 x 668; the visual recapture used an exact 375 x 667 CSS viewport at 2x device scale (750 x 1334 retained pixels).
- Feature or PR tested: `/trend/optin` and `/trend/fairness` hard-disabled direct routes.
- Overall verdict: Pass after one High-severity routing fix.

## Tool Inventory

- Expo CLI: Available; Expo SDK 56 Metro web server.
- iOS Simulator: Not available on this Windows host.
- Android emulator: Not used; Android is outside the current release contract.
- Expo web: Used.
- Playwright: Used through the Codex in-app browser for route, DOM, reload, overflow, control, and console assertions.
- Playwright MCP: In-app browser Playwright surface used for the first run.
- Codex Computer Use: Used for a second human-driven Chrome visual recapture and the stale-history recovery branch.
- Other: Vitest runtime privacy tests and Phase 7 static/smoke gates.

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| Direct `/trend/optin` | Hard-disabled capability | Pass after fix | `post-fix-trend-optin.png`, `post-fix-route-evidence.json` | Exact URL survives direct entry and refresh; no input/switch; truthful deferred copy. |
| Direct `/trend/fairness` | Hard-disabled capability | Pass | `post-fix-trend-fairness.png`, `post-fix-route-evidence.json` | Exact URL survives direct entry and refresh; enabled fairness content does not appear. |
| `/trend/optin` recovery | Back to Progress | Pass | `post-fix-route-evidence.json` | Unique 55.99 px button navigates to `/progress`. |
| `/trend/fairness` recovery | Back to Progress | Pass | `post-fix-route-evidence.json` | Unique 55.99 px button navigates to `/progress`. |
| Existing Trend history → `/trend/optin` recovery | Deterministic replace | Pass | `post-fix-route-evidence.json` | With `/trend/fairness` already in history, the named action still reaches `/progress` instead of navigating back to fairness. |
| Disabled privacy boundary | No child data access | Pass | `fairnessPrivacyGate.test.ts`; focused test transcript | Throwing matched-child and Monk-hook sentinels remain uncalled. |
| Responsive/accessibility sanity | Exact 375 x 667 CSS viewport | Pass | `post-fix-trend-optin.png`, `post-fix-trend-fairness.png`, `post-fix-route-evidence.json` | Refusal badge/title/body/detail are visibly rendered; zero horizontal overflow, no dialog, one named recovery button, no consent control. |

## Bugs Found

| ID | Severity | Reproduction | Expected | Actual | Evidence |
| -- | -------- | ------------ | -------- | ------ | -------- |
| TREND-E2E-2026-07-13-01 | High | Open `/trend/optin` while the layout returns a deferred surface instead of its navigator. | URL remains `/trend/optin`. | URL canonicalized to `/trend/fairness`. | `pre-fix-route-evidence.json`, `pre-fix-optin-canonicalized-to-fairness.png`, and `docs/e2e-bug-reports/2026-07-13-trend-layout-guard-route-canonicalization.md`. |

## Tests Added or Updated

- `apps/mobile/src/features/trend/fairnessPrivacyGate.test.ts`: renders the real layout/fairness boundaries with throwing sentinels and proves disabled child scenes and the private Monk-band hook do not mount.
- `apps/mobile/src/features/trend/trendRoutes.test.ts`: pins the navigator-preserving `screenLayout` gate, deterministic Progress replacement, truthful fallback, and both named routes.
- `apps/mobile/src/components/launch/DeferredSurface.test.ts` and `apps/mobile/src/lib/navigation/safeBack.test.ts`: pin deterministic replacement while preserving back-or-replace as the shared default.
- `scripts/e2e/human-e2e-manifest.mjs`: requires every Trend report, JSON, and PNG to exist and be Git-tracked, and validates `summary.artifacts` provenance.
- `scripts/phase7/check-core-loop.mjs`: recognizes the atomic routine-activation reservation contract.
- `scripts/phase7/check-core-loop-smoke.mjs`: pins affected source files into generated Phase 7 packet provenance and proves a dirty upstream human manifest cannot be reported as clean.

## Commands Run

```bash
npm install
npm --workspace apps/mobile run web -- --port 8267 --clear
npm --workspace apps/mobile exec vitest run src/features/trend/trendRoutes.test.ts src/features/trend/fairnessPrivacyGate.test.ts
npm --workspace apps/mobile run typecheck
node scripts/e2e/human-e2e-manifest.mjs --provenance-smoke
npm run phase7:check-core-loop
npm run phase7:check-core-loop-smoke
npm run format:check
npm run lint
npm test
```

## Browser Evidence Summary

- Both routes render `Photo trend insights are not in this beta` and the no-consent explanation.
- Chrome's exact 375 x 667 CSS-viewport captures retain 750 x 1334 pixels at 2x scale. Pixel analysis finds visible ink for the BETA badge, heading, body, detail, and recovery label; the bounds are recorded in `post-fix-route-evidence.json`.
- Both exact URLs survive direct entry and reload.
- Each route has zero inputs, zero switches, zero horizontal overflow, and no JavaScript dialog.
- Each route exposes one `Back to Progress` button measuring 55.99 px high and reaches `/progress`; the same result holds with another Trend route already in history.
- The three retained PNGs are byte-identical by design: the pre-fix defect changed only the canonical URL, while every hard-disabled Trend route renders the same refusal surface. URL evidence distinguishes the before and after states.
- Browser warn/error logs contain only the declared missing local Supabase configuration and Expo web notification limitation; unexpected warn/error count is zero.
- No external service or destructive action was used.

## Remaining Risk

- Native iPhone routing, VoiceOver, safe areas, and Dynamic Type remain Phase 5/7 physical-device QA.
- No validated Trend engine ships, so enabled-engine behavior is intentionally unavailable and untested.
- Expo web does not prove native photo, secure-storage, or consent-ledger behavior.
