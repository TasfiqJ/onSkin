# Engineering22 final local delivery

**BLOCKED** — source-proof hardening is not retained or accepted.

Branch `stage/m1-native-runtime47`; clean starting and final status.

Starting HEAD `16fdc6101bd43a1a70dec51fc5a832fa580c8d4d`

Starting tree `fec3e97ca19de8dea6c6c513653c10419c5218fa`

Starting immediate parent `4dce84e20a71f19c60c16c7682e683bb512363ed`

Final HEAD `08da2f379c487f8b56d470c7093eb6045b700204`

Final tree `ad60f0499cef4e39f906bf451d2898307b08d46d`

One append-only documentation commit: `08da2f379c487f8b56d470c7093eb6045b700204` — docs: record blocked optional draft source-proof hardening.

Application, package, script and test Git subtrees are unchanged. [Final source diff](SOURCE.diff) changes only two documentation files; [rejected candidate](REJECTED_CANDIDATE.diff) remains separate.

[Validation receipts](VALIDATION.json) · [Changed-file inventory](CHANGED_FILES.json) · [Evidence manifest](SHA256SUMS.txt) · [Frozen contracts](FROZEN_CONTRACTS.json).

Candidate focused result: 100 passed / 1 protected v5 failure. Preserved application: 98 focused tests passed; 8,527 uncached root tests passed; four uncached typecheck and four configured lint tasks passed. These passes do not establish the requested hardening.

---

# Engineering22 optional draft source-proof hardening

Authorization: `BRAIN-ONSKIN-OPTIONAL-DRAFT-SOURCE-PROOF-22`; dispatch `ENGINEERING22_DEFENSIVE_001`. Mode: LOCAL_ONLY / DEFENSIVE / ZERO_NEW_PAID_OPERATIONS. Result: **BLOCKED**. The requested strict predicate is not retained in application source because it fails an existing protected v5 regression. This is a documented stop, not an accepted repair or an expansion of scope.

## Exact starting identity

- Worktree: `[LOCAL_USER_HOME]\Documents\ChatGPT\MasterV2Code\c16-candidate`.
- Branch: `stage/m1-native-runtime47`, clean at start.
- HEAD: `16fdc6101bd43a1a70dec51fc5a832fa580c8d4d`.
- Tree: `fec3e97ca19de8dea6c6c513653c10419c5218fa`.
- Immediate parent: `4dce84e20a71f19c60c16c7682e683bb512363ed`.
- Preserved PR48 ancestor: `d292743c99c1fb98f5714789f4fd60fb1e7d5a5d`; ancestor check passed.
- No competing writer was observed. Git status was clean before edits and no index lock existed. CIM process enumeration was unavailable; ordinary process enumeration found only the calling PowerShell among the relevant writer processes. Prior implementation agents were finished and the new review agent was read-only. No permission changes were made.

Final identity, clean verification and the single append-only documentation commit are recorded in [SOURCE_IDENTITY.json](SOURCE_IDENTITY.json) and [FINAL_REPORT.md](FINAL_REPORT.md). Application, package and test source are unchanged from the starting commit.

## Static finding and protected regression

`optionalChangeDraftEventMatches` currently compares event identity, kind, target identity, observed date, category, text and predecessor revision. The proposed one-line change additionally required `event.sourceProof === fields.sourceProof`, matching the exact-proof requirement in `sameOptionalChangeInput41`. No existing identity, factual-content, revision, actor, basis, owner, target or integrity validation was removed or changed.

The current representations are incompatible for an actual-routine v5 wrapper:

1. `completionsStore.ts:151` returns `snapshotOptionalChange41(raw, extension)`. Its source proof hashes the full outer canonical record. The panel's saved fields and the draft store's refresh retain this proof.
2. `completionsStore.ts:185` passes `hashOptionalChange41(predecessor.completionBytes)` to the canonical optional-change append. The retained event therefore records the inner predecessor proof.
3. `optionalChange41.ts:129` correctly requires exact event/input predecessor proof equality. Its frozen event semantics were left unchanged.
4. Durable confirmation, readback and retirement all use `reconcileOptionalChangeDraft`. The requested direct equality rejects the valid v5 event during canonical readback at `completionsStore.ts:273`.

After applying only that predicate change, three new pure in-memory invariants passed for note, correction and retraction with equal/unequal proof values. They used no store, serialization, history append or persisted-record injection. No pre-fix reproduction was run.

The required existing synthetic suites then produced **100 passing tests and one failure across six files**, including those three new invariants. The unchanged failing test is `optionalChangeDrafts.test.ts:239`: **preserves check-offs and actual-routine bytes while adding a durable optional record inside the v5 wrapper**. It failed with `OPTIONAL_CHANGE41_READBACK_UNCONFIRMED`. This is the stop condition; it was not skipped, weakened, converted to success or hidden by a timeout change.

The original outer predecessor cannot generally be recovered from its saved hash after subsequent completion or actual-routine changes. Comparing against an event's own proof would make the added check meaningless. Changing stored proof semantics, adding a new draft field, rewriting retained events or reconstructing only a subset of histories would exceed this narrow authorization or lose exact retry guarantees. No such workaround was implemented. Brain must resolve the representation/compatibility scope before a repair can proceed.

## Preserved source and evidence

The rejected candidate and its in-memory tests are preserved in [REJECTED_CANDIDATE.diff](REJECTED_CANDIDATE.diff), `candidate-proof-invariants.ts` and `CANDIDATE_SOURCE.json`. The original failed command receipt/log remain intact as `candidate-focused.json` and `candidate-focused.log`.

Only the agent's one-line candidate edit and its new test file were then removed using a scoped patch. Git status returned to clean before documentation changes. No reset, checkout, rebase, stash, clean, force operation, branch switch or replacement worktree was used. The final commit changes only this report and `PROGRESS.md`; it does not silently claim that the source-proof issue is fixed.

Required existing focused suites were rerun against the preserved application. Full uncached root tests, configured root typecheck and lint validate that preserved source, not the rejected hardening candidate. Exact commands, counts, exits, durations and hashes are recorded in [VALIDATION.json](VALIDATION.json) and the final report. A passing preserved-source suite does not waive the candidate failure.

| Validation | Result |
|---|---|
| Rejected candidate focused suite | 100 passed, 1 protected v5 failure; includes 3 passing new in-memory invariants; exit 1 |
| Preserved application focused suites | 98 passed across 5 files; exit 0 |
| Preserved application uncached root tests | 8,527 passed across 576 files; 3 tasks, 0 cache hits; exit 0 |
| Configured root typecheck | 4 tasks passed, 0 cache hits; exit 0 |
| Configured root lint | 4 tasks passed, 0 cache hits; exit 0 |

## Limits and prohibited-operation confirmation

- No schema, canonical event/history contract, historical data, owner/consent authority, actual routine, appointment brief, analytics, manual-intake or professional feature change was retained.
- No additional persisted-record fixture, pre-fix vulnerability reproduction, exploit development/test, penetration test or destructive experiment was created or run. Only the new in-memory post-change invariants and authorized existing synthetic suites were executed.
- No browser journey, native build, native/physical-device attempt, App Store action or external provider contact occurred.
- No dependency install/download, unexpected external download, cloud execution, hosted CI, access/permission change, account/production change, spending, push, upload, publication, merge, deployment or release occurred.
- All work and evidence stayed in the existing local worktree and `[LOCAL_USER_HOME]\Documents\ChatGPT\MasterV2Code\ENGINEERING22_EVIDENCE`.

All **38 requirements and 18 gates remain UNACCEPTED**. J01 Visible Pores remains the only Korean assessment and remains inactive/refusing positive results. Release remains **NO_GO**. Engineering21 remains accepted for continuity only. Independent review and acceptance remain with Brain.
