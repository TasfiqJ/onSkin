# Engineering21 final local delivery

**COMPLETE_LOCAL_CHECKPOINT**; independent acceptance is not claimed.

Branch: `stage/m1-native-runtime47`. Starting and final Git status: clean.

Starting HEAD: `4dce84e20a71f19c60c16c7682e683bb512363ed`

Starting tree: `9d61cabdc11cff36577e4e7aa94b00ca4a95f393`

Final HEAD: `16fdc6101bd43a1a70dec51fc5a832fa580c8d4d`

Final tree: `fec3e97ca19de8dea6c6c513653c10419c5218fa`

Append-only commits:

- `16fdc6101bd43a1a70dec51fc5a832fa580c8d4d` — feat: add durable manual intake and optional change draft recovery

Changed files: 58; full names, sizes and hashes in [CHANGED_FILES.json](CHANGED_FILES.json). Reversible source diff: [SOURCE.diff](SOURCE.diff). Validation receipts: [VALIDATION.json](VALIDATION.json). Evidence manifest: [SHA256SUMS.txt](SHA256SUMS.txt). Frozen contracts: [FROZEN_CONTRACTS.json](FROZEN_CONTRACTS.json).

No remaining blocker to this local checkpoint. Native process termination, installed-device accessibility, genuine provider authority and release qualification were not attempted. All 38 requirements and 18 gates remain UNACCEPTED; release remains NO_GO.

---

# Engineering21 durable consumer draft recovery

Authorization: **ENGINEERING21_DEFENSIVE_SCOPE_001**. Execution is **LOCAL_ONLY / DEFENSIVE / ZERO_NEW_PAID_OPERATIONS**. Result: **COMPLETE_LOCAL_CHECKPOINT** for the two assigned consumer workstreams. It does not claim independent acceptance. The independent ChatGPT Brain remains the source-code reviewer and acceptance decision-maker.

All **38 requirements remain UNACCEPTED**. All **18 gates remain UNACCEPTED**. Release remains **NO_GO**. Frozen J01 contracts, acceptance matrices and professional production boundaries are unchanged. Additional professional workflow implementation is deferred.

## Source identity and finalization

| Item | Recorded value |
|---|---|
| Existing worktree | `[LOCAL_USER_HOME]\Documents\ChatGPT\MasterV2Code\c16-candidate` |
| Branch | `stage/m1-native-runtime47` |
| Starting HEAD | `4dce84e20a71f19c60c16c7682e683bb512363ed` |
| Starting Git tree | `9d61cabdc11cff36577e4e7aa94b00ca4a95f393` |
| Starting status | Clean; all five required checks passed |
| Preserved PR48 ancestor | `d292743c99c1fb98f5714789f4fd60fb1e7d5a5d`; ancestor check exit 0 |
| Final HEAD/tree, branch/status | Exact post-commit values in [SOURCE_IDENTITY.json](SOURCE_IDENTITY.json) and [FINAL_REPORT.md](FINAL_REPORT.md); same branch, clean final Git status |
| Append-only commit list | One local commit directly after the starting HEAD; full commit/parent/tree list in the final identity and report; no remote publication |
| Changed-file inventory and evidence manifest | [CHANGED_FILES.json](CHANGED_FILES.json), [SOURCE.diff](SOURCE.diff), [SHA256SUMS.txt](SHA256SUMS.txt) |
| Final delivery result | **COMPLETE_LOCAL_CHECKPOINT**; no remaining local implementation blocker |

The five starting checks are preserved in [BASELINE.json](BASELINE.json). Local evidence is held separately in `[LOCAL_USER_HOME]\Documents\ChatGPT\MasterV2Code\ENGINEERING21_EVIDENCE`. Test receipts record the command, source HEAD/tree, working status/tracked-diff hash, exit code, elapsed time and log SHA-256. Checks ran before the local commit, on the recorded working changes. Final source inventory hashes include every committed new file; browser source hashes are checked against the final worktree. The post-commit identity is stored outside the repository to avoid a self-referential commit hash.

## Workstream A: manual product intake

Manual intake has its own collection, `layerwell.manualIntakeDrafts.v1`, separate from Engineering20 bottle-transcription drafts. Shelf and Add by hand expose a separate saved-intake inventory at `/shelf/intake-drafts`. Explicit save can retain incomplete raw product name, brand, barcode, EAN-8/UPC-E choice, category and ingredient text together with normalized intake, existing provenance, phase, opening mode/date, PAO value/source and custom PAO text. Draft and operation IDs, revisions and timestamps are durable. Camera state, captured images, photo URIs, callbacks, focus identities and runtime lease objects are excluded; nonmanual origins are refused rather than relabeled.

The sequence is explicit Save Draft, leave/reload, open inventory, select Resume, review the restored values, continue to opening/PAO review, and explicitly Add to Shelf. Resuming establishes a fresh in-memory intake session and current admitted runtime capability. The UI distinguishes the last saved revision from later unsaved edits. Neither typing nor navigation silently saves a draft. Recovered uncertain opening choices show the original attempted date rather than substituting today's date.

Every manual Add first journals the exact attempted product payload under the existing stable operation ID. The Shelf transaction validates the exact saved revision and original authority. An existing product must match the complete canonical payload, including lifecycle fields; a matching ID alone is insufficient. A missing product with a retained outbox/terminal operation fails closed. A separate canonical Shelf readback and another locked draft/Shelf comparison precede retirement of that exact draft. Failed or uncertain readback retains recovery instead of claiming success or allocating another operation identity.

Product removal now reserves both Shelf and intake drafts and refuses removal while an attempted draft references that operation. Verified submission retirement or explicit exact-revision draft discard resolves this ambiguity. This prevents removal followed by replay from recreating an uncertain earlier product. Stale save/discard callbacks cannot replace or clear a successor revision.

Primary implementation: `manualIntakeDraftCodec.ts`, `manualIntakeDraftStore.ts`, `manualIntakeRecovery.ts`, `manualIntakeSubmission.ts`, `IntakeContext.tsx`, Shelf `store.ts`, `manual.tsx`, `opened.tsx`, `intake-drafts.tsx` and their navigation entry points. The collection permits at most 20 records and 1,000,000 UTF-8 bytes; exact schemas, field bounds, integrity hashes and duplicate identity refusal apply.

## Workstream B: optional factual change drafts

The optional editor provides explicit Save Draft and a separate Saved change drafts inventory for notes, corrections and retractions. `layerwell.optionalChangeDrafts.v1` preserves the event ID/kind, exact target ID/content hash, observed date, category, original factual text, source proof/revision, attempted state and draft metadata. Its maximum is 20 records and 200,000 UTF-8 bytes. It never stores the full `completions.v1` source bytes; those remain in the current runtime after fresh canonical reads.

Resume verifies current authority, reads current optional history and reconciles the exact saved target. A changed source requires explicit refresh and another review; a missing or changed target closes confirmation while preserving the text. A correction may still deliberately address an earlier retained event after review of current history. No recovery automatically appends an event or changes earlier history.

Saved/recovered confirmation journals attempted state before calling the canonical submission helper. Exact source bytes reviewed in this runtime must still match. An existing event ID is checked against its complete factual content and target proof; an exact event is verified without appending twice, while a conflict is refused. Canonical readback precedes exact draft retirement. Already-recorded drafts are frozen for review even if the saved attempted flag was false. If later unsaved editor text differs from that recorded saved event, the text is retained, confirmation closes and the UI directs the owner to resume the saved original; it cannot announce that the different text was saved.

The never-explicitly-saved editor keeps its established in-memory append and refresh behavior, including its existing fresh-ID refresh semantics. Durable recovery applies to explicitly saved/recovered optional drafts. The original 27 rendered editor tests and assertions were preserved exactly; eight additional adapter cases exercise the new delegation. Separate real encrypted storage and mounted UI tests cover persistence and canonical history guarantees.

Primary implementation: `optionalChangeDraftCodec.ts`, `optionalChangeDraftStore.ts`, `OptionalChangeDraftInventory.tsx`, `OptionalChangePanel41.tsx` and `completionsStore.ts`. These are owner-reported factual records, not diagnoses, app observations or clinical conclusions. Drafts do not enter history, routine/check-off records, appointment briefs, provider records, synchronization or analytics automatically.

## Authority, storage, cleanup and export

Both stores use the established source-reserved private transaction. Current adult eligibility, the exact health-consent contract and the active persisted lifecycle owner/processing epoch are verified before draft payload reads. Operations retain the original admitted health-write capability across awaits; regrant or owner A-to-B-to-A cannot lend new authority to an older callback. Record IDs and full revision/CAS proofs prevent older callbacks from replacing or discarding successors.

Both keys are registered in private-key ownership/classification, purpose-bound authenticated encryption, health-purpose cleanup, full local deletion and export inventories. Unsupported schemas, malformed records, plaintext/unbound envelopes, unreadable storage and missing recovery keys are refused. They are not interpreted as empty collections or migrated into admitted drafts. Current purpose-bound ciphertext and its existing key are required; the draft recovery path does not recreate a missing key.

Cleanup uses the existing withdrawal/deletion drain and verified removal path. Tests include failed removal remaining pending and retryable; a retired processing epoch cannot admit a retained draft. Rights export uses its established verified-owner account authority even while health processing is paused, strictly decodes each collection and redacts owner identity fields. The sections are `shelf_and_routine.unconfirmed_manual_intake_drafts` and `activity_and_app_state.unconfirmed_optional_change_drafts`. Exports are factual rights records, not importable recovery backups.

The private source transaction now has a distinct synchronous check immediately before native dispatch. Submission keeps original account/health authority through native readback, while a later retired editor cannot announce success or retire the saved draft. A focus/query change after dispatch does not roll back an already committed product or optional event; the attempted draft remains available for exact reconciliation. Authority withdrawal remains enforced through the existing guarded mutation and cleanup mechanisms.

## Completed local validation

Focused counts below overlap and are not a combined total. The final uncached root total is 8,527 passing tests across 576 files.

| Receipt/check | Recorded result |
|---|---|
| `manual-storage-privacy-r1` | 8 files, 285 tests passed |
| `manual-gate-r2` | 18 files, 532 tests passed before Workstream B began |
| `manual-focused-final` | 14 files, 427 tests passed at its recorded working source |
| `optional-core-r2` | 6 files, 265 tests passed |
| `optional-draft-core-r2` | 1 file, 33 tests passed |
| `optional-source-regression-r1` | 3 files, 78 tests passed |
| `optional-focused-final` | 14 files, 430 tests passed at its recorded working source |
| `draft-postdispatch-core-r1` | 2 files, 63 tests passed |
| `journey-authority-fixtures-r1` | 4 files, 64 tests passed; existing assertions retained |
| `plan-native-import-fixtures-r1` | 2 files, 107 tests passed after adding Node `randomUUID` to the existing Expo crypto test adapters; actual plan/Today assertions unchanged |
| `manual-inventory-expiry-focused-r1` | 2 files, 36 tests passed: passive expiry masks the inventory and stale resume/discard performs no payload read, write or navigation |
| `root-types-r2` | Exit 0; 4 successful configured tasks, 0 cache hits; 53.266 seconds |
| `root-lint-r2` | Exit 0; 4 successful configured tasks, 0 cache hits; 104.859 seconds |
| `root-tests-r1` | Failed: mobile 29 failed / 7,715 passed, 15 failed / 536 passed files; root stopped before a complete successful suite |
| `root-tests-r2` | 8,526 tests passed: 7,851 mobile / 551 files, 24 operator / 7 files, 651 professional / 18 files; 3 successful tasks, 0 cache hits |
| `root-tests-final` | 8,527 tests passed: 7,852 mobile / 551 files, 24 operator / 7 files, 651 professional / 18 files; 3 successful tasks, 0 cache hits; 77.703 seconds |
| `consumer-build-r3` | Final local consumer web export exit 0; 75.734 seconds; native qualification excluded |
| `manual-browser-r4` | Manual intake journeys passed 375×667, 390×844 and 430×932; receipt 153.86 seconds, zero blocked external requests; owned browser/server processes stopped |
| Final source/typecheck/lint/build reconciliation | Final expiry regression included in the passing uncached suite; configured typecheck/lint and consumer export passed |
| `optional-browser-r4` | Optional note/correction/retraction journeys passed 375x667, 390x844 and 430x932; 231.86 seconds, zero blocked external requests; owned browser/server processes stopped |

The root suite command is `npm.cmd test -- --cache=local:w --concurrency=1`. The evidence wrapper disables dotenv/telemetry, removes credential environment variables and uses blocked development provider placeholders. Local browser drivers restrict requests to loopback and use isolated synthetic owners/storage. Both journeys passed at 375x667, 390x844 and 430x932 with keyboard controls, reload/resume, explicit confirmation/discard, read refusal and unsupported-data branches. Screenshots were inspected. Optional browser runs verify five unique canonical events, exact targets, changed-history refusal and explicit refresh/re-review, including a later correction of an earlier retained event. Completion bytes and the actual-routine journal began absent and stayed absent in this browser fixture; real encrypted store tests separately prove preservation of nonempty retained completion and actual-routine data.

## Retained failures and repairs

- Early Shelf regression fixtures lacked authentic persisted adult/lifecycle authority or the new source-transaction adapter. Fixtures were extended through real consent/lifecycle storage and the existing transaction contract. Assertions were retained. Removal's UI cancellation check was separated from continuing native authority; the destructive/post-dispatch regressions were rerun.
- The initial optional core failures were new test fixture/expectation errors: a January check-off correctly fell outside the current backfill window, and applying an actual routine changed the established completion projection. Fixtures now use the current local check-off day and compare the immediate pre-submit projection plus exact retained completion/actual-routine bytes. Existing protected assertions were not weakened.
- Review identified the uncertain-product removal/replay ambiguity, committed-event rollback on editor retirement, and misleading review of changed text against an already-recorded saved event. Source fixes and focused regression cases address each boundary.
- `root-tests-r1` remains preserved. Authentic authority fixture repairs cover affected retained-history/routine/Shelf cases. Original source-contract assertions remained unchanged: production guards were spelled separately and the local opening mode retains its `null` initial value with a restored-value fallback. Two native-module import failures were repaired by adding Node `randomUUID` to existing Expo crypto test adapters; the unchanged actual plan/Today tests then passed 107 cases. The unchanged `firstValueSources.campaign25` test had an unexplained initial readiness failure, then passed both its scoped rerun and `root-tests-r2`; the original failure is retained without claiming an established cause. The uncached r2 suite passed all 8,526 tests. No skipped failures or raised timeouts are claimed as repairs.
- `consumer-build-r1` failed with `EPERM` creating `assets/__node_modules`. The approved local build retry passed without installing dependencies; the report does not infer a broader cause from that error.
- Early browser attempts failed before completing the UI journey because of loopback/startup and transient source-import issues. Legacy Expo tooling also attempted an automatic background download despite offline configuration and reported failure. No provider or dependency was acquired. This failed warning is disclosed; no intentional external/provider operation was authorized. Subsequent launch controls suppress that behavior and restrict browser requests to loopback.
- The third manual browser run found a real false Unsaved indicator caused by JSON object-key ordering and missing DOM `aria-checked` for barcode options. Semantic field comparison and explicit radio accessibility attributes were added; focused UI/typecheck/lint checks were run. Both repaired browser journeys passed all three widths in their r4 runs.
- Optional browser r1 reached the existing unavailable-routine state because the fresh owner had not completed onboarding. R2 followed onboarding but stopped at the notifications screen, where saving reminders off requires a separate Continue. R3 used an unexported harness helper during category setup; this was corrected and all used helper exports were checked before r4. These failures occurred before the optional editor; their UI snapshots and logs remain recorded. The final driver follows existing explicit setup steps without injecting a profile, routine or successful history result.

Original failed logs remain in the evidence directory alongside reruns. No frozen acceptance contract, requirement/gate status or protected security/release failure was waived.

## Limits and excluded operations

These checks use ordinary synthetic local fixtures and the consumer web surface. Browser reload exercises a fresh page/runtime; lease retirement and component refresh are additionally covered by local tests. This evidence is not a native OS process-death or physical-device durability qualification. It does not establish native key custody, native accessibility, camera/OCR provider behavior, App Store qualification, genuine professional identity/licensing/staff/delivery/payment authority or independent acceptance. Engineering20 professional reconciliation and its regression contracts remain in scope only for preservation; professional expansion is deferred.

Operations not performed or authorized in this assignment:

- No push, upload, publication, remote evidence commit, merge, production deployment or release.
- No hosted CI/GitHub Actions; no GitHub access, permissions, secrets, webhooks or ruleset changes.
- No new paid operation, dependency installation or external service integration.
- No native build/device attempt, physical-device test or App Store operation.
- No genuine OCR, camera, professional, clinical or external provider contact initiated for feature verification; the failed automatic tooling warning above is retained separately.
- No exploit development/reproduction, penetration testing or destructive security experiment.
- No reset, checkout, rebase, stash, clean, force operation or replacement worktree to change the starting baseline.
- No change to the frozen J01 contract, 38 requirements, 18 gates or their acceptance decisions.

The local evidence manifest covers the retained failed and successful receipts, screenshots, canonical readbacks, source diff, changed-file inventory and exact final Git identity. [FROZEN_CONTRACTS.json](FROZEN_CONTRACTS.json) verifies the seven frozen contract/matrix/precedence files against the baseline. No local implementation blocker remains. Native, genuine provider and release qualification remain outside this authorization, with **UNACCEPTED / NO_GO** and independent Brain review unchanged.
