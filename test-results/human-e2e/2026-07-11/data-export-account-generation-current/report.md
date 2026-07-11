# Account-Generation Export Isolation E2E

## Summary

- Date: 2026-07-11
- Surface: Expo web development build in the Codex in-app browser
- Viewports: 360 x 640 support floor and 390 x 844 modern supported phone
- Result: Pass for local UI and deterministic concurrency contracts
- Fixture account: `tas.account-a.e2e@example.com`

## Start Command

```powershell
$env:EXPO_PUBLIC_E2E_ACCOUNT_ISOLATION='signout_clear_retry'
$env:EXPO_PUBLIC_E2E_DATA_EXPORT_DELAY_MS='2500'
$env:EXPO_PUBLIC_APP_ENV='development'
npm --workspace apps/mobile run web -- --port 8361 --host localhost
```

Both fixtures are development-only. The account fixture supplies a synthetic
permanent account A, delays cleanup, and fails its first cleanup attempt. The
export fixture holds the current generation after local collection so sign-out
can exercise the real cancellation boundary without a live Supabase project.

## Flows Executed

| Flow | Result | Evidence |
| ---- | ------ | -------- |
| Start export for account A | `Export my data` changed to disabled `Preparing...` while the account remained visible | `01-export-preparing-360x640.png`, `04-export-preparing-390x844.png` |
| Sign out during delayed export | Account A Settings unmounted and only the account-boundary recovery gate rendered | `02-boundary-recovery-360x640.png`, `05-boundary-recovery-390x844.png` |
| Forced first cleanup failure | The next account stayed locked out; the gate exposed one named `Try again` action and no account A content | Recovery screenshots and DOM snapshots |
| Retry cleanup | Retry reached signed-out Welcome with `Begin` and `I already have an account` | `03-signed-out-after-retry-360x640.png`, `06-signed-out-after-retry-390x844.png` |
| Support-floor geometry | Pending export had 0 px horizontal overflow and no visible controls below 44 x 44 | `geometry-360x640.json` |
| Browser diagnostics | No JavaScript dialog or browser error occurred | `browser-warn-error.json` |

The 18 recorded warnings are repeated instances of three documented local
conditions: placeholder Supabase URL/key and Expo Notifications web support.
There were no other warning messages and no browser errors.

## Automated Coverage

- `accountGeneration.test.ts`: abort, complete-operation drainage, stale lease,
  nested boundary, same-generation, and thrown-operation cleanup.
- `actions.test.ts`: authenticated owner capture before local data, exact server
  owner match, delayed Edge abort, no stale write/share, and post-write deletion.
- `localAccountIsolation.test.ts`: boundary begin/drain/end and failure cleanup.
- `accountSessionIsolationContracts.test.ts`: root session-boundary integration.
- Focused result: 4 files and 40 tests passed.

## Remaining Risk

- Live Supabase A-to-B behavior still needs configured staging evidence.
- Native iOS and Android share-sheet/cache interruption still needs supported
  physical-device evidence.
- The local fixture proves UI gating and the deterministic race contract; it
  does not claim third-party network or native share-sheet behavior.
