# Executed checks and evidence classes

Repository cwd: `C:\Users\jasim\Desktop\WeddingCards\work\m102-retained-resilience`.
Environment: Windows, Node 22.21.0, npm 11.20.0, Python 3.9.13,
Vitest 4.1.11; unchanged dependencies and original postinstall patches.
Every complete command receipt records cwd, start UTC, source SHA/tree, raw
exit, elapsed time, stdout/stderr bytes and SHA256. Receipts at base SHA with
working source changes are explicitly development measurements, not clean
source-head claims. The forced root checks bind the committed measured source.

| Check | Result | Receipt |
|---|---|---|
| External-anchor packet verification | exit 0; 16 content files; admission NONE | context-verification.json |
| `npm ci --no-audit --no-fund` | exit 0; 1028 packages; original postinstall passed | receipts/install |
| Retained baseline: mobile test Today/routine/scheduler/streak/photos/notifications, `--maxWorkers=4` | exit 0; 118 files / 1602 tests | receipts/baseline-retained-3 |
| New regressions against unchanged implementation | exit 1; 9 failures / 86 passes | receipts/before-repairs-corrected |
| Repaired focused streak/photo/notification/transaction tests | exit 0; 4 files / 105 tests | receipts/after-repairs |
| Real encrypted photo integration | exit 0; 1 file / 32 tests | receipts/photo-publication-integration |
| `npm --workspace apps/mobile run typecheck` | exit 0 | receipts/mobile-typecheck |
| `npm --workspace apps/mobile run lint` | exit 0 | receipts/mobile-lint |
| `npm test -- --force --concurrency=2` | exit 0; 6054 mobile + 24 console = 6078 tests; zero cached tasks | receipts/measured-root-tests-complete |
| `npm run typecheck -- --force --concurrency=2` | exit 0; 3 tasks; zero cached | receipts/measured-root-typecheck |
| `npm run lint -- --force --concurrency=2` | exit 0; 3 configured tasks; zero cached | receipts/measured-root-lint |

The retained-baseline command is:

```text
npm --workspace apps/mobile run test -- src/features/today src/features/routine src/features/scheduler src/features/streak src/features/photos src/features/notifications --maxWorkers=4
```

The before/after development commands and full raw outputs are retained in their
receipts. Eleven added cases comprise 3 weekly-current-day vectors, 2 photo-store
cases, 1 real encrypted integration, and 5 native-permission cases. No existing
negative test was removed or weakened. Root lint includes the unchanged types
workspace's configured no-lint message, not a newly invented lint gate.

## Actual supported UI

Headless Chrome drives the actual local Expo web app using the existing
`scripts/e2e/onboarding-first-session.mjs --daily-loop`. Synthetic fresh owners,
explicit adult/health onboarding and the existing development corpus are used;
Supabase is blocked by invalid placeholder configuration, with no real provider
or user interaction. `extend-daily-loop.mjs` adds only a negative paid-streak
boundary in memory; its original/executed source hashes accompany each run.

| Viewport | Actual result | Evidence |
|---|---|---|
| 390 × 844 | exit 0; PASS | receipts/ui-daily390-final; ui/daily390-final |
| 375 × 667 | exit 0; PASS | receipts/ui-daily375; ui/daily375 |
| 430 × 932 | exit 0; PASS | receipts/ui-daily430; ui/daily430 |
| Cross-owner 390 × 844 | exit 0; PASS | receipts/ui-cross-owner390; ui/cross-owner390 |

Each flow navigates real controls through onboarding, manual Shelf, free Today,
AM completion, loaded-app network loss, rejected encrypted write with read/retry,
rapid duplicate presses, stable replay IDs after reconnect/document reload,
offline reminder-time save/failure/retry without opt-in, PM completion with one
routine-day marker, and paid denials. Each successful run retains 46 screenshots,
UI snapshots, a daily-loop result, viewport and harness binding, and browser logs.
Screenshots show synthetic content only. See each `summary.json`,
`M102-daily-loop.json` and `same-day-weekly.json`.

The unchanged maintained `--cross-owner` harness additionally drives delayed
owner-A reads/writes and callbacks, duplicate B events, first/repeated cleanup
refusal and recovery, actual B onboarding and private Shelf creation/edit,
navigation/reload, then return-to-A age closure. Its summary and boundary/race
snapshots are in `ui/cross-owner390`. No real account/provider is involved.

Positive weekly display/diary UI: **NOT_RUN_AUTHENTIC_PAID_AUTHORITY_UNAVAILABLE**.
Native permission/malformed OS responses use controlled platform ports, not a
real OS prompt. Positive photo-save recovery uses real crypto/storage cores
with a synthetic PNG, not native device UI. Native delivery, native offline cold
launch, actual OS DST scheduling and release evidence remain NOT_RUN.

Reproduce a supported run using a fresh evidence directory:

```powershell
$env:ONBOARDING_E2E_EVIDENCE_DIR='<new absolute checkpoint evidence directory>'
$env:ONBOARDING_E2E_VIEWPORT_WIDTH='390'
$env:ONBOARDING_E2E_VIEWPORT_HEIGHT='844'
$env:ONBOARDING_E2E_PORT='8378'
$env:ONBOARDING_E2E_DEBUG_PORT='9478'
node --import ./docs/brain/checkpoints/M1-02/RETAINED-RESILIENCE-01/extend-daily-loop.mjs scripts/e2e/onboarding-first-session.mjs --daily-loop
```

## Preserved failures and setup limitations

- `baseline-retained`: the first receipt wrapper could not print Vitest's Unicode
  marker through Windows cp1252. Raw stdout remains; test exit is UNKNOWN,
  wrapper exit 1, and the attempt is INCOMPLETE. The wrapper was corrected and
  rerun; no result was inferred from the lost receipt.
- `baseline-retained-2`: exit 1, 5 affected files, missing sparse SQL inputs.
  Fetching the unchanged pinned inputs yielded baseline-retained-3 PASS.
- `before-repairs`: 10 failures included one incorrectly chosen synthetic owner
  in a new test. That fixture was corrected to the same owner; the subsequent
  before-repairs-corrected run retains 9 genuine repair failures.
- `measured-root-tests`: exit 1, 5 failed cases due only to missing sparse docs,
  Supabase config and an email template. Those exact read-only inputs were fetched;
  measured-root-tests-complete then passed. No protected assertion was changed.
- `ui-daily390`: exit 1 before app startup because the evidence hook wrote before
  its directory existed. This is NOT_RUN UI. The hook now records on exit.
- `ui-daily390-2`: exit 1 after the real daily flow, at the paid weekly route.
  `ui/daily390/FAILURE.png` and ERROR.json preserve the actual denial. The positive
  paid case was retained as NOT_RUN; the final harness tests its negative boundary.
- `git diff --cached --check` over captured evidence exits 2 because raw Turbo,
  Vitest and Expo output contains original trailing whitespace and blank lines.
  `receipts/raw-log-whitespace` preserves that failure. Raw bytes and their hashes
  are kept intact; no whitespace policy is overridden. The source-only
  `git diff --check <base> <measured-source> -- apps` passes.

## Separate protected CI observation

Read-only refresh for PR10 head `cd2bd51997f283c0b446bf2124f427f482550fa8`:
Quality 40036061496 SUCCESS, iOS source contract 40036061450 SUCCESS,
Security 40036061435 FAILURE. See `protected-stage-observation.json`.
These are that separate branch's results, not this candidate's CI or admission.
No original Security/DB/clinical/native/release gate was executed or cleared here.
