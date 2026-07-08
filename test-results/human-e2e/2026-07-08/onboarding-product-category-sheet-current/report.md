# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-08
- Codex task: Onboarding products category-sheet safe-area/accessibility hardening
- App surface: Expo web in Codex in-app browser
- Build/start command: `npm --workspace apps/mobile run web -- --port 8232 --clear`
- Browser/device/simulator/OS: Codex in-app browser, 320 x 480 viewport override
- Feature tested: `/onboarding/products` compact product category sheet
- Overall verdict: Pass

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| Onboarding products | Product name empty | Pass | `01-initial-320x480.png` | No horizontal overflow; product input and `Skip for now` visible. |
| Onboarding products | Typed product exposes category footer | Pass | `02-product-typed-320x480.png` | `Choose product category` is visible above `Add to shelf`. |
| Category sheet | Open compact sheet | Pass | `03-category-sheet-open-320x480.png` | Named category sheet opens; visible category chips are 48 px. |
| Category sheet | Select `Serum` | Pass | `04-serum-selected-320x480.png` | Collapsed control exposes `Category, Serum`. |
| Product add | Add selected product | Pass | `05-product-added-320x480.png`, `summary.json` | `Retinol serum` is added; no dialog remains. |

## Checks

- Horizontal overflow: 0 px.
- Minimum visible control height: 48 px.
- Blocked center hit-tests: 0.
- JavaScript dialogs: 0.
- Unexpected current-origin warn/error logs: 0.

## Bugs Found

None in this pass.

## Commands Run

```bash
npm run phase7:verify
npm --workspace apps/mobile run web -- --port 8232 --clear
```

## Remaining Risk

- Native iOS/Android safe-area, Dynamic Type, keyboard, and screen-reader traversal remain device QA follow-ups.
