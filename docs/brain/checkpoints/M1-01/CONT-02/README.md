# M1-01 / CONT-02 - partial checkpoint for independent Brain review

M1 is **not self-accepted**. Main promotion, PR9 merge and later tasks remain unauthorized. The local implementation and supported fixture results below are measured at `bb9d84be5fba8bbcb8a05343b66152a7ae8cded6`, tree `8c38e82f86b595eae9ac64c5409a75763c8f1c37`. Final delivery is the live stage ref after the evidence-only commits; resolve it independently. Context is HIGH; no compaction observed. Stop after the normal stage push.

## Repairs

- Both You layouts and SessionBoundaryGate own their rejected sign-out/retry interactions. Auth still rejects incomplete durable cleanup; the completion assertion remains. Concurrent sign-outs join one promise instead of invalidating each other's sequence.
- Actual browser diagnosis then exposed `PRIVATE_KV_WRITE_BLOCKED_ACCOUNT_BOUNDARY` during widget capability revocation. The new deletion-only lane accepts no caller-selected key, serializes behind older writes/rollbacks, attempts both exact widget capability keys and retains failures for retry. Ordinary private writes remain blocked. It cannot erase Shelf, billing or photo records. Real-storage race/failure tests cover it.
- The new interrupted-withdrawal browser flow exposed cold local guest rights losing their owner when Auth is absent. Rights now use the same unconfigured local-device fallback as the existing lifecycle/You code, still requiring exact durable owner proof. Configured signed-out and foreign-owner cases stay closed. No protected health children or fresh-consent path is mounted.
- The maintained runner incorporates the useful historical isolation mechanics, current age/rights policy, visible retry/hit tests, unconditional uncaught-exception/overlay failure and failure-before-teardown capture. It uses repository-relative resolution and fresh evidence directories; no evidence-folder runner copy was added. A completion summary cannot pass with false required recovery flags.
- The existing non-destructive deletion fixture previously reset completion on router remount. Its synthetic transport phase now survives document reload/remount, cannot regress after acknowledgement, and refuses corrupt/unavailable fixture state. A tested resolver excludes release, staging/production, configured provider and non-web modes. This is not a real deletion receipt or provider proof.

## Fresh evidence

| Check | Result at measured source |
| --- | --- |
| Forced root tests, quiet final rerun | 6,013 pass: 5,989 mobile + 24 console; zero failures/skips/cache hits |
| Forced root typecheck / lint | Pass; 3 executions each. Types has no independent lint; console lint is TypeScript |
| Focused safety integration | 332 pass / 19 files; overlaps root, never added |
| Metro/native-age source + harness contracts | 14 pass; source only |
| Governance / real CLI regressions | 44 pass + 2 genuine Windows symlink-privilege skips / 46 cases |
| Recovery browser flow | Pass at 390x844 first, then 375x667 and 430x932 |
| Retained Shelf / age-closed rights | Pass at all 3 sizes, including real local cleanup refusals twice, saved intent after reload, then successful withdrawal |
| Same-owner guest upgrade | Pass at all 3 sizes, including invalid-code retry and retained Shelf |
| Deletion fixture displays and recovery | 4 modes x 3 sizes = 12 passes, including simulated completion/manual acknowledgement and reload |

All 21 selected browser runs use the same measured source. Their actual commands, viewport/ports, environments, source commit/tree, raw output hashes and exits are in execution receipts. `completion-report.json` selects the final evidence; `evidence/history-run-index.json` preserves prior attempts. A concurrent root check caught our evidence filenames changing during its read-only worktree assertion; the unchanged full suite passed when rerun with recording stopped. One concurrent Chrome launch never connected; the same measured-source upgrade scenario passed serially. Neither failed launch nor transient loading is an app pass.

## Remaining gap and evidence limits

A-to-B delayed callback/publication and owner isolation were exercised in mounted source integration. The browser suite covers A-to-sign-out and legitimate same-owner upgrade. **No A-to-B browser replay is claimed**; that remains an in-scope evidence gap for independent Brain disposition. Native Keychain/photos/notifications, physical devices, real provider accounts/deletion/billing and qualified review were not executed. Synthetic web transport cannot establish those axes. Existing private crypto/photos/reminders, minimized adult18 receipts, offline routine/Today and manual Shelf remain guarded; no database, dependency, workflow, protected Security inventory/scanner/pin/date or release change was made.

Measured-source CI: Security39467726887 fails inventory and raw OSV review/advisory gates; iOS39467727134 is source-only success. Quality39467726756 repository, PostgreSQL15/17 and both Expo exports pass; its canonical DB job was still in progress in the recorded observation. No final DB cause is inferred and no older green is borrowed. See `evidence/ci-measured.json` and decoded Security job log. Final delivery's own CI is read after push in the tool transcript; this source observation is not relabelled as that later head. Proposal expiry remains 2026-10-21T00:00:00Z and was not renewed.

## Reproduction and custody

From the repository root, use the existing `node scripts/e2e/onboarding-first-session.mjs` with `--account-isolation`, `--retained-safety` or `--account-upgrade`. Set unique `ONBOARDING_E2E_EVIDENCE_DIR`, `ONBOARDING_E2E_PORT`, `ONBOARDING_E2E_DEBUG_PORT`, `ONBOARDING_E2E_VIEWPORT_WIDTH` and `ONBOARDING_E2E_VIEWPORT_HEIGHT`. For deletion fixtures, use `ONBOARDING_E2E_DELETION_RECOVERY` = pending_then_completed_manual / invalid / invalid_support_only / expired. Run isolated browser invocations sequentially; a timestamp profile collision is a possible, unproven explanation of the retained parallel launch failure. Never reuse or clear old evidence.

The independent issuance digest is 4a5812eaac01c099c831a5f445898c1bd101d6a754aac497e67dfe50d966fcd1. `inputs/` and the separately committed Brain REVIEW-02 match the manifest and Git blobs exactly. Original M0/M1/CONT-01 records remain unchanged. `source-custody-final.json` checks protected paths at every continuation commit and all 414 worklist fingerprints; only the 2 authorized derived outputs were regenerated with the unchanged generator, preserving all 14 item meanings and source membership.

Post-measurement CLI/worklist/Git verification is recorded separately, so it cannot be mistaken for an execution at the measured runtime source. This checkpoint and the root TXT are a review submission, not M1 acceptance, release admission or another task issuance.
