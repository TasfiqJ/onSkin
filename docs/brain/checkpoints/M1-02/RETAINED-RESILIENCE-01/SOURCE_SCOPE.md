# Source attribution

Only these eight source/test paths differ between authorized base `d9912f4c`
and measured source `8284218a`. Exact blob IDs and SHA256 values are in
`source-scope.json`; ordered parents/trees are in `source-commits.json`.

| Path | Whitelist grant | Purpose |
|---|---|---|
| apps/mobile/src/features/streak/streak.ts | features/streak/** | Count completed current day |
| apps/mobile/src/features/streak/streak.test.ts | features/streak/** | Week-position and future-row regressions |
| apps/mobile/src/features/photos/store.ts | features/photos/** | Separate committed save from recoverable journal failure |
| apps/mobile/src/features/photos/store.test.ts | features/photos/** | Commit failure, deduplication and stale-health regression |
| apps/mobile/src/features/photos/photoDeleteR3.integration.test.ts | features/photos/** | Real encrypted persistence/reload recovery |
| apps/mobile/src/features/notifications/deliver.ts | features/notifications/** | Reuse strict permission classifier; explicit unavailable outcome |
| apps/mobile/src/features/notifications/deliver.test.ts | features/notifications/** | Malformed native responses and recovery |
| apps/mobile/src/features/notifications/transaction.cont01.test.ts | features/notifications/** | Complete realistic native permission port |

No exceptional shared primitive was edited. All other base entries are
unchanged at measured source. `protected-objects.json` checks original tree/blob
identities for workflows, Supabase, scripts, Brain state, dependencies and native
configuration. This is Git byte preservation, not protected gate acceptance.

The evidence tail may add only this new checkpoint, the separately authorized
M1-03 blocked note, and update the tracked `ONSKIN_BRAIN_HANDOFF.txt`. Its E2E
extension changes the maintained test harness in memory only; original
`scripts/e2e/**` and actual app navigation remain unchanged. The original and
executed harness hashes accompany each browser run.

The new checkout has its own Git directory and index; it borrows existing
objects through an alternates file, without hard links or changing another
checkout's branch. Automatic maintenance is disabled. Sparse missing test inputs
were fetched unchanged from the authorized base. Dependencies were freshly
installed from the unchanged lockfile. Npm cache cleanup was explicitly
authorized by the human; personal documents and source checkouts were preserved.
