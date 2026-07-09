# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-09
- Codex task: Settings support contact analytics and inline recovery
- App surface: Expo web in Codex in-app browser
- Build/start command: `npm --workspace apps/mobile run web -- --port 8255`
- Browser/device/simulator/OS: Codex in-app browser, 390 x 844 modern phone viewport
- Feature tested: Support policy row from `/you?section=privacy`
- Overall verdict: Pass

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| Support contact | Support URL unavailable local fixture | Pass | `01-support-row-inline-recovery.png`, `01-support-row-inline-recovery.json`, `summary.json` | Tapping Support shows inline route-owned recovery instead of a native dialog. Analytics code now emits literal `support_contact_failed` locally or `support_contact_opened` after a configured opener succeeds. |

## Bugs Found

| ID | Severity | Reproduction | Expected | Actual | Evidence |
| --- | -------- | ------------ | -------- | ------ | -------- |
| None | - | - | - | - | - |

## Tests Added or Updated

- `apps/mobile/src/lib/analytics/track.test.ts`: supports beta-safe support contact event names and sanitized bucket props.
- `apps/mobile/src/features/settings/settingsRoutes.test.ts`: keeps Support row analytics literal and privacy-safe.
- `npm run phase10:beta-analytics-audit`: verifies the new events are documented, allowlisted, and emitted from non-test runtime source.
- `npm run phase9:privacy-payload-audit`: verifies literal event names and payload privacy gates.

## Commands Run

```bash
npm --workspace apps/mobile run web -- --port 8255
# Browser-driven route check through Codex in-app browser
```

## Remaining Risk

- Live support URL, support desk evidence, ticket categories, SLA proof, and owner signoff remain external Phase 10 blockers.
- Native iOS/Android external-link handoff still needs physical-device QA.
