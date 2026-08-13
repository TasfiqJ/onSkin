# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-18
- Codex task: PERF-P0-007 / OPT-010 notification-preference outbox adoption
- App surface: Expo web
- Build/start command: `npm --workspace apps/mobile run web -- --port <port> --host localhost`
- Browser/device: Codex in-app browser, requested 390 x 844 viewport, observed 390 x 845
- Fixtures: development-web-only `EXPO_PUBLIC_E2E_NOTIFICATION_SYNC_STATUS=saved_local|syncing|needs_attention`
- Overall verdict: Pass

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| Notification Settings | Saved locally | Pass | `notifications-saved-local-390x844.jpg` | One calm status; no alert, progress bar, or overflow |
| Notification Settings | Syncing | Pass | `notifications-syncing-390x844.jpg` | Exactly one named progress bar |
| Notification Settings | Needs attention and retry | Pass | `notifications-needs-attention-390x844.jpg` | One alert; 316 x 56 px retry; no dialog |
| Notification Settings | Real local edit and reload | Pass | `notifications-toggle-persisted-390x844.jpg` | Morning changed from off to on and remained on |
| Timing | Saved locally | Pass | `timing-saved-local-390x844.jpg` | Shared status; zero overflow |
| Timing | Real local edit and reload | Pass | `timing-edit-persisted-390x844.jpg` | Quiet hours remained off after reload |

## Commands And Tests

- Focused Vitest: 12 files / 132 tests passed.
- Full root Vitest: 340 files / 4,027 tests passed.
- Root typecheck and zero-warning lint passed.
- Prettier and `git diff --check` passed for the checkpoint files.

## Remaining Risk

- Expo web is secondary implementation evidence, not native release evidence.
- Signed supported-iOS offline/reconnect, background/foreground, process-kill, duplicate-worker, physical account-switch, native notification scheduling, protected-storage interruption, and hosted RPC replay remain open.
- The local Supabase fixture is intentionally unavailable; no hosted server mutation was claimed.
