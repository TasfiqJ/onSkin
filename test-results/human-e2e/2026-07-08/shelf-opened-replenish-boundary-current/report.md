# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-08
- Codex task: Shelf opened-date and replenishment boundary
- App surface: Expo web through Codex in-app browser
- Build/start command: `EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro npm --workspace apps/mobile run web -- --port 8148 --host localhost --clear`
- Browser/device/simulator/OS: Codex in-app browser, 320 x 568 viewport
- Feature or PR tested: Shelf Product Add, opened-date and replenish boundary branch
- Overall verdict: Pass with native-device follow-up

## Tool Inventory

- Expo CLI: used through `npm --workspace apps/mobile run web`
- iOS Simulator: not used
- Android emulator: not used
- Expo web: used
- Playwright/browser automation: Codex in-app browser targeted page checks and screenshots
- Codex Computer Use: not used

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| Shelf Product Add | Opened-date compact sheet | Pass | `02-opened-sheet-initial.png`, `02-opened-sheet-initial.json` | `Just opened it`, `Pick a date`, and `Not opened yet` are all visible before scrolling to PAO/save actions. |
| Shelf Product Add | Boundary PAO/date | Pass | `03-opened-boundary-configured.png`, `04-shelf-boundary-product.png` | Set `3 months ago` plus `3 mo` PAO; Shelf shows `0 days left` without scarcity copy. |
| Shelf Product Add | Replenish boundary prompt | Pass | `05-replenish-boundary-prompt.png`, `05-replenish-boundary-prompt.json` | Replacement prompt uses PAO/printed-date freshness copy, `not an alarm`, no `running low`/`nearly finished` copy, and keeps consent-gated similar options. |
| Shelf Product Add | Re-add fresh unit | Pass | `06-shelf-after-readd.png`, `06-shelf-after-readd.json` | `Re-add the same one` archives the old boundary unit and creates one active fresh unit with `opened Jul`, `3 mo PAO`, and `Oct 2026`. |

## Bugs Found

| ID | Severity | Reproduction | Expected | Actual | Evidence |
| -- | -------- | ------------ | -------- | ------ | -------- |
| `2026-07-08-shelf-replenish-scarcity-copy` | Important | Open a replenish prompt from a PAO/expiry-triggered product. | Copy explains freshness/PAO honestly and avoids manufactured scarcity. | The route used "nearly finished" / "running low" language even when the trigger was an expiry boundary. | `docs/e2e-bug-reports/2026-07-08-shelf-replenish-scarcity-copy.md` |

## Tests Added or Updated

- `apps/mobile/src/features/shelf/shelfRoutes.test.ts`: source contract prevents replenishment copy from using manufactured scarcity and requires PAO/printed-date freshness framing.

## Commands Run

```bash
npm --workspace apps/mobile run test -- src/features/shelf/shelfRoutes.test.ts

$env:EXPO_PUBLIC_E2E_ENTITLEMENT='store_pro'
npm --workspace apps/mobile run web -- --port 8148 --host localhost --clear
```

## Evidence Files

- `01-manual-initial.png`
- `01-manual-initial.json`
- `02-opened-sheet-initial.png`
- `02-opened-sheet-initial.json`
- `03-opened-boundary-configured.png`
- `03-opened-boundary-configured.json`
- `03a-pao-options-ambiguous.json`
- `04-shelf-boundary-product.png`
- `04-shelf-boundary-product.json`
- `05-replenish-boundary-prompt.png`
- `05-replenish-boundary-prompt.json`
- `06-shelf-after-readd.png`
- `06-shelf-after-readd.json`
- `ui-geometry-audit.json`
- `browser-warn-error-logs-localhost-8148.json`

## Remaining Risk

- Expo web cannot prove native iOS/Android bottom-sheet gestures, home-indicator spacing, Dynamic Type, VoiceOver/TalkBack traversal, or real device storage restart behavior.
- Cosmetic-chemist signoff for PAO defaults remains blocked under `B-DERM-REVIEW`.
- Commerce/affiliate similar-options behavior still needs final legal consent copy, approved catalog links, and native outbound-link QA before launch.
