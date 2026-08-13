# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-18
- Codex task: PERF-P0-007 / OPT-010 Shelf outbox status
- App surface: Expo web
- Build/start command: `npm --workspace apps/mobile run web -- --port <port> --host localhost`
- Browser/device: Codex in-app browser, requested 390 x 844 viewport, observed 390 x 845
- Fixtures: development-web-only `EXPO_PUBLIC_E2E_SHELF_SYNC_STATUS=saved_local|syncing|needs_attention`
- Overall verdict: Pass after one accessibility fix

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| Empty Shelf | Saved locally | Pass | `saved-locally-390x844.png` | Calm non-alert status; no overflow |
| Empty Shelf | Syncing | Pass after fix | `syncing-390x844.png` | Exactly one named progress bar |
| Empty Shelf | Needs attention and retry | Pass | `needs-attention-390x844.png` | One alert; 308 x 56 px retry; no dialog |
| Manual add | Local use while syncing | Pass | `syncing-populated-390x844.png` | Added synthetic cleanser without blocking |
| Reload | Populated state and status | Pass | `syncing-populated-reload-390x844.png` | Product and status remained visible |

## Bug Found And Fixed

- The first syncing pass exposed a progress bar nested inside another progress bar. The wrapper role was removed and the `ActivityIndicator` became the single named/busy progress bar. See `docs/e2e-bug-reports/2026-07-18-shelf-sync-duplicate-progressbar.md`.

## Commands And Tests

- Focused Vitest: 7 files / 128 tests passed.
- Root/mobile typecheck and zero-warning lint passed.
- Full root Vitest passed: 338 files / 4,016 tests.
- `git diff --check`, Prettier, and metrics JSON parsing passed.
- The human-E2E manifest check reports the existing generated manifest as stale; its dirty user-owned outputs were intentionally preserved.

## Remaining Risk

- Expo web is secondary implementation evidence, not native release evidence.
- Signed supported-iOS offline/reconnect, background/foreground, process-kill, duplicate-worker, account-switch, and hosted RPC replay remain open.
- The local Supabase fixture is intentionally unavailable; no hosted server mutation was claimed.
