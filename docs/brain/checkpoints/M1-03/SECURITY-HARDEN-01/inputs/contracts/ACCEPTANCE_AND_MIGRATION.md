# Migration, QA and acceptance gates
## Schema strategy
Inspect and obey current DB06/DB08/R2B ownership before touching migrations or replay. Do not edit previously applied migrations or change the chain count to pretend replay happened. Additive expand/backfill/validate/switch/contract is the default. Add nullable/versioned columns and new tables first; deploy backward-compatible readers; backfill idempotently per owner; compare record/owner/version counts and orphan references; enable new reads only after reconciliation. Keep old reads until a verified rollback window closes. Destructive contraction is a separate approval/task, never bundled into a normal main push.
Use stable idempotency keys and CAS; do not synchronously dual-write two independent authorities. A durable transaction/outbox bridges server events. Replayed deletes/withdrawals win over late writes. Quarantine uncertain formula identities rather than guessing. Preserve current subscription IDs and entitlement provenance.
Before any data-changing deployment capture schema/source/environment identities, backup and restore evidence, data reconciliation queries, privilege/RLS tests, rollback/read-compatibility plan and a write-fencing switch. Rollback means compatible software plus preserved data/tombstones, not dropping newly owned history.

## Required negative and positive test matrix
| Boundary | Positive test | Mandatory negative test |
|---|---|---|
| Owner identity | Guest and verified same-owner account can access own record | Different owner ID, late async response, stale session, sign-out, withdrawal and deletion cannot publish or recover previous owner content |
| Formula history | Explicit new version links to confirmed bottle | Rename/reformulation cannot rewrite past formula or infer concentration |
| Offline ledger | Repeated upload retains one immutable event and correct projection | Same id+different payload rejects; stale CAS cannot overwrite newer state; deletion beats delayed outbox |
| Practice grant | Current scoped grant permits allowed text at publication | Cross-tenant IDs, expired/revoked epoch, concurrent switch and cached export fail closed |
| Intended/actual | Owner explicitly applies a received plan | Acknowledgement, staff role or plan publication cannot mutate actual routine |
| Billing | Exact-owner verified current receipt enables paid-only operation | A free-quota operation, linked-client access, unknown receipt, stale refund event or arbitrary client flag never grants Plus |
| Free continuity | Ordinary edits/history/brief/export/delete remain accessible after expiry | Quota/expired plan cannot lock data rights or demand a paid media tier |
| Professional core | Text-only web/grants/queue/brief works end-to-end | Missing hosted-media entitlement must NOT fail core acceptance; media upload remains denied |
| Capacity | Atomic accepted-plan reservation within limit | Parallel acceptance cannot overbook; downgrade cannot delete history |
| Queue | Correct material event creates/deduplicates item | Check-off/silence must not create urgent clinical conclusions; closed item cannot hide new material event |
| Local artifacts | Encrypted capture/analysis/thumbnail can be opened by active owner | Cache/temp/export/native late completion leaks after background/lock/logout/delete must fail |
| Measurement | Known masks produce exact union and denominator arithmetic | Empty support → null, not zero; overlap counted once; orientation wrong/missing region/device unsupported → unavailable |
| Comparison | Common support and validated compatible noise allow justified change | Mismatched model/profile/version, changed denominator, absent noise or near-zero relative baseline does not produce improvement |
| Provider event order | Latest authoritative retrieval controls state | Forged webhook/replay/out-of-order chargeback cannot reopen rights |
| Restore | Restored data reconciles counts and identities | Backup restore cannot resurrect deleted users or revoked grants before service resumes |

## Evidence dimensions
Track C source implementation; I integration; D physical-device/supported surface; Q qualified review; L live provider/hosted deployment; R public release. Add research G0–G5 and commercial observed gates separately. Do not collapse the axes into a single percent-complete. An automated green run can establish an executed source test, not a real notification, signed TestFlight build, clinical validation, authenticated reviewer identity, buyer willingness to pay or App Review approval.
Every report names command, working directory, exact head/tree, lock/runtime versions, exit code, assertions/test count and artifact hash/path. A skipped/unavailable command is not PASS. Quote only relevant non-sensitive log excerpts, preserve full sanitized artifacts separately. A prior run on a different head is historical. If the test runner modifies generated files, inspect and reconcile rather than committing unexplained churn.

## Device release matrix
On each supported app profile test installation/upgrade/relaunch/background, owner switching, offline/online reconciliation, camera permission denial/revocation, manual/OCR fallback, saved-image orientation, private lock/no-content-flash, memory/thermal interruption, capture cancellation, notification permission/schedule/cleanup, export/temp deletion and accessibility. Test purchase/restore/manage/refund/lapsed/unknown using actual sandbox/provider evidence when payments are exposed. A simulator cannot close these items.
Clinical supported configurations add physical-camera, capture regime, exposure metadata, saved-image diagnostics, localization/measurement parity, profile failover and model precision tests. A model that converts successfully still needs output/threshold parity and full-pipeline performance evidence. New device/OS/camera/image-processing/model builds trigger scoped requalification.

## Release/no-go
Block any P0/P1 privacy/data-loss/authorization defect, unapproved claims, unverifiable provider state, failed applicable CI, missing support for promised behaviour, or ability to bypass the clinical admission manifest. Disable an optional capability rather than bypass its gate. Internal TestFlight, external beta, research study, public store release and paid commercial expansion each have a separate exact-build packet and approval record. No auto public release after a main commit or successful upload.
