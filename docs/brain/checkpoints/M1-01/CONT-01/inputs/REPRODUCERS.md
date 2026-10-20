# Exact review reproductions and source orientation
All tests below use synthetic disposable state. Never patch/clean another working tree, dump keys/cookies/local-storage values, or turn a diagnostic result into admission.

## Source and installed worktrees
Reviewed current branch source `c0d97372212fd94e168b1c598b603381ccb9f9cc` is in `C:/Users/jasim/Desktop/onSkin/.claude/worktrees/m1-retained-safety` (clean at review). Accepted M0 `6aa01995f6dcb94fd28d358badc9f8d1e0273d39` remains in `C:/Users/jasim/Documents/Codex/2026-10-19/c-users-jasim-desktop-onskin-x20-6/work/onSkin-stage` (also clean). These are observed locations, not permission to overwrite either; fresh refs/dirty checks govern. The M1 dependency directories point via junctions into M0 installed dependencies. Do not edit shared node_modules.

## Web diagnostic
Original harness: scripts/e2e/onboarding-first-session.mjs. Use new unique evidence directories/ports per run; the old harness deletes prior files in its output directory. Preserve all original evidence.
Current original task evidence used8317/9417. Brain current read-only diagnostic used8327/9427,390x844; baseline8328/9428. A temp copy set explicit repoRoot (because copy lives outside repository), captured body/URL/PNG/events in a catch before original finally teardown, and stopped after seeing consent but before granting it. It did not modify actual app code. Debug experiment8329/9429 enabled CDP Debugger pause-on-all-exceptions only immediately before Continue, logged bounded error description/stack (no variable inspection), resumed automatically, and captured the same failure.
Raw minimized source-facing audit files are in:
- `C:/Users/jasim/AppData/Local/Temp/onskin-brain-web-audit-yq4c5m77/` (AUDIT_PATCH.json, run.txt, surface/FAILURE-AFTER-SUBMIT.json/png).
- `C:/Users/jasim/AppData/Local/Temp/onskin-brain-web-baseline-_gjm3fcp/` (baseline-audit.mjs, run.txt, failure snapshot).
- `C:/Users/jasim/AppData/Local/Temp/onskin-brain-web-exception-43nkaoma/` (exception-audit.mjs, run.txt).
Temp availability is not guaranteed. The recorded outcomes/hashes are preserved in BRAIN_REVIEW; reproduce from exact source when unavailable. These scripts are diagnostics, not production fixes or full-flow pass generators. Review before reuse.
Observed error: `TypeError: (0 , _nobleCiphersUtilsJs.randomBytes) is not a function`, getOrCreateContentKey -> private mutation -> setAgeVerified -> age submit. Inspect actual bundled dependency path/exports as well as Node resolution. Lock contains mobile ciphers2.3.0 and hoisted1.3.0; only2.3.0 has the expected export. Existing metro.config.js adds resolved hoisted dependency watch folder but not explicit resolved app-level folder. This resolver cause is a hypothesis to prove; do not paper over it by weakening random generation/receipts.
Relevant other encrypted callers: features/photos/encryptedStorage.ts, lib/supabase/largeSecureStore.ts and largeSecureStoreCrypto.ts. Trace shared resolution without expanding photo features or changing envelope/key semantics.

## New M1 report regression
Use a disposable copy of selected governance/source inputs and separate Git directory. Preserve read-only real base objects using a local Git alternate if needed. Set the disposable branch to stage/m1-retained-safety and exact c0. Run the actual `scripts/brain/brain.py --root <fixture> --profile M1-01 report <fixture-report>`; establish the unchanged original report as positive control.
Then independently change: executions/artifacts to empty and source/surface to PASS; declared measured to accepted6aa while tests still name71f; or an in-scope fixture runtime file while keeping the original measured report. All three incorrectly returned0. Results are in BRAIN_REVIEW/REPRODUCED_CASES.json. Do not copy fabricated results into real evidence. Add real CLI tests without mocked Git for these relationships and a valid partial/failure control.
Raw reviewer cases: `C:/Users/jasim/AppData/Local/Temp/onskin-brain-m1-adversarial-ermpeh_m/reproductions.json`.

## Reproduced command checks
`python -B -m unittest discover -s scripts/brain -p test_*.py -v`:39pass/2Windowsprivilege skips.
`python -B scripts/brain/brain.py --profile M1-01 validate` and original report check:0.
`node node_modules/vitest/vitest.mjs run --root apps/mobile src/features/onboarding/ageGate.test.ts src/features/onboarding/ageGateStore.test.ts src/features/onboarding/AgePolicyGate.lifecycle.test.ts src/features/shelf/store.test.ts src/lib/storage/privateKV.test.ts`:148pass/5files.
`node scripts/phase4/build-source-worklist.mjs --strict --check`:1; both outputs stale.
Raw logs: `C:/Users/jasim/AppData/Local/Temp/onskin-brain-m1-review-_em9span/`. Its outer Python printer failed after completed tests on cp1252 checkmark output; use saved logs, not a wrapper PASS assumption.

## Rights topology
Read app/_layout.tsx; AgePolicyGate wraps HealthDataLifecycleGate and all normal private providers. agePolicyRouteMayMountWithoutReceipt currently permits only welcome/age. PausedHealthDataShell already contains rights actions but cannot be reached under a closed age gate. Engineer a separate minimal rights shell with existing exact-owner/auth/AppLock/deletion safety, not a general settings or health subtree exemption.
