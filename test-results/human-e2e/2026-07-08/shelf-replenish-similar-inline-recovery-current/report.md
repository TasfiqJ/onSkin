# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-08
- Codex task: Replace Shelf replenishment similar-options native alert/inert recovery with inline route feedback.
- App surface: Expo web
- Build/start command: `EXPO_PUBLIC_PHASE7_COMMERCE_ENABLED=true EXPO_PUBLIC_FINAL_BRAND_DOMAIN=https://routinekind.app npm --workspace apps/mobile run web -- --port 19179 --clear`
- Browser/device/simulator/OS: Codex in-app browser, 320 x 568 viewport
- Feature or PR tested: `/shelf/replenish` consented `See similar options`
- Overall verdict: Pass after fix

## Tool Inventory

- Expo CLI: Used through `npm --workspace apps/mobile run web`
- iOS Simulator: Not used
- Android emulator: Not used
- Expo web: Used
- Playwright: Used through Codex in-app browser APIs
- Playwright MCP: Not installed as a durable repo harness
- Codex Computer Use: Not needed
- Other: Browser screenshot and console-log capture

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| Shelf product intake | Boundary replenish setup | Pass | `01-replenish-before-similar.png` | Added `Similar Flow Serum`, set `3 months ago` plus `3 mo` PAO, reached `0 days left`. |
| Commerce consent | No-consent branch | Pass | `03-commerce-real-consent-sheet.png` | `See similar options` opened the real commerce consent sheet after enabling final-domain commerce flags. |
| Replenish similar options | Consented unavailable catalogue | Failed before fix | `05-native-alert-current.png` | Route stayed visually unchanged on Expo web, and source used `Alert.alert` for native. |
| Replenish similar options | Consented unavailable catalogue | Pass after fix | `07-inline-recovery-keyed-state-patched.png` | One inline `role="alert"` appeared in view, no dialog opened, and `scrollWidth=320`. |

## Bugs Found

| ID | Severity | Reproduction | Expected | Actual | Evidence |
| -- | -------- | ------------ | -------- | ------ | -------- |
| shelf-replenish-similar-inline-recovery | Medium | Consent commerce, then tap `See similar options` in `/shelf/replenish`. | Inline route-owned feedback. | Expo web looked inert; native source path used `Alert.alert`. | `docs/e2e-bug-reports/2026-07-08-shelf-replenish-similar-inline-recovery.md` |

## Tests Added Or Updated

- Test file: `apps/mobile/src/features/shelf/shelfRoutes.test.ts`
- What it covers: Rejects `Alert.alert` in `/shelf/replenish`, requires `CommerceLinkNotice`, `setSimilarFeedback`, and the commerce empty-state copy.
- Why this should be automated: This is a compact-phone recovery branch that can regress through source-level fallback changes.

## Commands Run

```bash
npm --workspace apps/mobile run test -- src/features/shelf/shelfRoutes.test.ts
```

## Remaining Risk

- Native iOS/Android bottom-sheet rendering, Dynamic Type, screen-reader announcement, and safe-area behavior were not covered in this web-compatible pass.
- Approved live similar products and affiliate/catalog partner rows remain launch-gated, so this verifies the honest unavailable state only.
