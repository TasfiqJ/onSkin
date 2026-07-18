# Shelf Outbox Status Checkpoint — 2026-07-18

## Scope

This checkpoint closes PERF-P0-007's local requirement that the Shelf distinguish saved-local, syncing, and needs-attention states without blocking offline use.

The implementation adds:

- a strict pure selector that filters rows by both owner hash and captured account generation;
- exact priority ordering: dead rows require attention, otherwise leased rows are syncing, ready rows are saved locally, and no current-owner rows are idle;
- an observable content-free revision signal published after enqueue scheduling, lease, settlement, retry, and terminal worker outcomes;
- an owner-fenced read query that preserves corrupt, unavailable, and future-version outbox states instead of flattening them into success;
- explicit retry that requeues only the current owner's dead rows, resets only delivery metadata, and immediately joins the existing single-flight worker;
- a narrow Shelf leaf that does not subscribe product rows or poll in the background.

## Local verification

- Focused Vitest matrix: 7 files and 128 tests passed across outbox pure/runtime, centralized query keys, Shelf status contracts, Shelf routes, Shelf storage, and Shelf mutations.
- Root/mobile typecheck and zero-warning lint passed.
- Full root Vitest passed: 338 files and 4,016 tests.
- Focused ESLint, Prettier, metrics JSON parsing, and `git diff --check` passed for the changed files.
- `npm run e2e:human:manifest:check` correctly reports the pre-existing generated manifest as stale. Its JSON and Markdown outputs already contain unrelated user edits, so this checkpoint preserves them instead of regenerating or staging them.

## Human-simulated E2E

Surface: actual Expo web development builds, requested 390 x 844 viewport (observed 390 x 845), local empty Shelf followed by a real manual `E2E Sync Cleanser` add and reload.

Observed results:

- `Saved locally`: one calm status, zero alerts, zero progress bars, zero horizontal overflow.
- `Syncing Shelf changes`: exactly one named progress bar after the accessibility fix, zero alerts, zero horizontal overflow.
- `Shelf sync needs attention`: exactly one alert, one `Try sync again` action measuring approximately 308 x 56 px, zero progress bars, zero horizontal overflow.
- The manual add remains fully usable while syncing; the populated Shelf and status survive reload.
- No JavaScript dialog or browser error occurred. Expected development-only warnings were limited to unavailable local Supabase configuration and Expo Notifications web support.

Evidence: `test-results/human-e2e/2026-07-18/shelf-outbox-status-current/`.

## Evidence boundary

Expo web proves local presentation and interaction structure, not native lifecycle durability. Release verification still requires signed supported-iOS offline/reconnect, background/foreground, process-kill, duplicate-worker, physical account-switch, and hosted RPC response-loss/replay evidence. Completion-history adoption remains outside the accepted Shelf entity contract until authoritative server routine/step UUID mapping exists.
