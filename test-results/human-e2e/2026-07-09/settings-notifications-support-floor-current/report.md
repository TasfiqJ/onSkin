# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-09
- Codex task: Settings Notifications support-floor spacer verification
- App surface: Expo web in Codex in-app browser
- Build/start command: `npm --workspace apps/mobile run web -- --port 8255`
- Browser/device/simulator/OS: Codex in-app browser, 320 x 480 support floor, 320 x 568 compact, 390 x 844 modern phone
- Feature tested: `/settings/notifications` split-short notification nudge spacing
- Overall verdict: Pass

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| Notification settings | Direct route at 320 x 480 launch support floor | Pass | `01-support-floor-320x480.png`, `01-support-floor-320x480.json` | Visible switches are complete, 48 px+, and hit-testable; lower Progress-photo nudge row starts below the first viewport. |
| Notification settings | Direct route at 320 x 568 compact phone | Pass | `02-compact-320x568.png`, `02-compact-320x568.json` | Visible controls remain complete after the spacer change. |
| Notification settings | Direct route at 390 x 844 modern phone | Pass | `03-modern-390x844.png`, `03-modern-390x844.json` | Modern phone layout remains clear. |
| Notification settings | Toggle Replenishment switch | Pass | `summary.json` | User-like tap changed `aria-checked` from `false` to `true`. |

## Bugs Found

| ID | Severity | Reproduction | Expected | Actual | Evidence |
| --- | -------- | ------------ | -------- | ------ | -------- |
| SETTINGS-NOTIFICATIONS-2026-07-09 | P2 | Open `/settings/notifications` at 320 x 480 after the initial 136 px spacer change. | Lower-priority `Progress-photo nudge` row starts fully below first viewport. | Switch bottom extended roughly 5 px below the first viewport before the 184 px spacer fix. | Browser geometry captured during this run; see committed bug report. |

## Tests Added or Updated

- Test file: `apps/mobile/src/features/settings/settingsRoutes.test.ts`
- What it covers: route contract for the split-short spacer constant and 48 px notification switch rows.
- Why this should be automated: prevents accidental regression to a spacer that exposes partial bottom-edge controls.

## Commands Run

```bash
npm --workspace apps/mobile run web -- --port 8255
# Browser-driven route checks through Codex in-app browser
```

## Remaining Risk

- Native iOS/Android safe-area, Dynamic Type, VoiceOver/TalkBack, and real notification scheduling remain physical-device QA under `docs/FOR_TAS_TO_DO.md`.
- Expo web warns about placeholder Supabase env and web notification listener limits; those are expected local blockers, not route regressions.
