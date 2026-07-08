# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-08
- Codex task: Verify and harden Shelf manual category picker on shortest phone viewports
- App surface: Expo web through Codex in-app browser
- Build/start command: `npm --workspace apps/mobile run web -- --port 8216 --host localhost`
- Browser/device/simulator/OS: Codex in-app browser, 320 x 480 viewport
- Feature tested: `/shelf/manual` manual product intake category picker
- Overall verdict: Pass

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| Manual add initial state | Shortest phone | Pass | `01-initial.png`, `01-initial.json` | Product name, brand, category, ingredients, and Continue fit with zero horizontal overflow. |
| Category picker open | Modal accessibility and safe area | Pass | `02-category-open.png`, `02-category-open.json` | One `role="dialog"` sheet named `Choose product category`, `aria-modal=true`, 48 px outside-dismiss reserve, no open-state control issues, zero horizontal overflow. |
| Lower category reachability | Scroll branch | Pass | `03-category-bottom-visible.png`, `03-category-bottom-visible.json` | `Something else` is fully visible at 272 x 52 px after a user-like scroll and is not hit-blocked. |
| Category selection | Collapsed field | Pass | `04-category-selected.png`, `04-category-selected.json` | Selecting `Something else` closes the sheet and exposes the collapsed field as `Category, Other`. |
| Continue to opened date | Happy path continuation | Pass | `05-opened-date.png`, `05-opened-date.json` | Continue routes to `/shelf/opened` at the opened-date sheet. |

## Bugs Found

| ID | Severity | Reproduction | Expected | Actual | Evidence |
| -- | -------- | ------------ | -------- | ------ | -------- |
| shelf-manual-picker-follow-up | Medium | Open `/shelf/manual` at 320 x 480, open category picker, select `Something else` | Dialog has a stable name, outside dismiss is 44+ px, bottom option is reachable, collapsed label matches visible text | Pre-fix follow-up evidence had a concatenated dialog name, a sub-44 outside-dismiss strip, and the selected `Other` field still announced `Something else` | `summary.json`, `02-category-open.json`, `04-category-selected.json` |

## Tests Added Or Updated

- Test file: `apps/mobile/src/features/shelf/shelfRoutes.test.ts`
- What it covers: Manual Shelf picker keeps a 48 px dismiss reserve, stable dialog label, internal list padding, handled taps, and the collapsed category accessibility label uses the same compact text shown on screen.
- Why this should be automated: Manual product intake is a critical always-works fallback and small regressions on short phones block the whole shelf/routine loop.

## Commands Run

```bash
npm --workspace apps/mobile run test -- shelfRoutes.test.ts
npm --workspace apps/mobile run web -- --port 8216 --host localhost
```

## Remaining Risk

- Native iOS and Android home-indicator behavior, Dynamic Type, VoiceOver, and TalkBack traversal still require simulator/device QA.
- The Expo web run used local placeholder Supabase env vars; those expected local warnings were present, with no unexpected route warn/error logs.
