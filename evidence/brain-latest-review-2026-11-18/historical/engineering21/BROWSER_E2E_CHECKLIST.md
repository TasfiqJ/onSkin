# Engineering21 scoped human-simulated E2E receipt

Date: 2026-11-17. Scope: the two assigned durable consumer draft flows, using actual local Expo web and the existing headless Edge/CDP harness. This receipt applies `docs/E2E_TESTING_CHECKLIST.md` only to the authorized Engineering21 browser scope; it does not mark unrelated launch, native or frozen acceptance gates complete.

## Setup and evidence integrity

- [x] Read repository instructions, CLAUDE, human E2E policy, device policy and bug template. The UI owner updated the Engineering21 branches in `docs/USER_FLOW_TREE.md`.
- [x] Use existing dependencies and browser, isolated fresh Edge profile/storage, synthetic anonymous owner, actual adult-date entry and explicit health consent. Manual begins from Shelf. Optional additionally completes goals, twelve quiz answers, one manually added cleanser, profile reveal, saved-reminder-OFF review, account skip and explicit free-plan continuation.
- [x] Exercise 375 x 667, 390 x 844 and 430 x 932 with actual touch/click/type/scroll/reload interactions. No accepted profile, routine, history event or consent is injected to manufacture a positive result.
- [x] Use sanitized environment, `EXPO_OFFLINE=1`, `EXPO_UNSTABLE_HEADLESS=1`, no dotenv and telemetry disable flags. Local HTTP interception refuses any origin outside the exact localhost app origin. Both passing runs observed zero blocked external HTTP attempts.
- [x] Record exact starting HEAD/tree, dirty source inventory, hashes of driver/feature source, command, exit, duration, UI snapshots, screenshots, interaction trace, browser console and observed HTTP requests. `browser-source-and-cleanup.json` confirms all recorded source hashes still match and both runs' owned helper PIDs are absent.

## Manual intake — PASS

Command: `python ../ENGINEERING21_EVIDENCE/run_check.py manual-browser-r4 node scripts/e2e/manual-intake-drafts21.mjs` with `ONSKIN_INTAKE_EVIDENCE` set to the matching evidence directory. Exit 0; 153.86 seconds; 42 screenshots across three layouts.

- [x] Save incomplete original raw product name/brand/barcode/EAN-8/multiline ingredients in purpose-bound ciphertext; verify current saved status, make a later unsaved edit, reload, open inventory and explicitly resume the original values.
- [x] Select category, review opening options, explicitly save selected date, 17-month label PAO and custom PAO text; reload, resume original manual inputs, continue and review the recovered opening choices.
- [x] Explicit Add returns to canonical Shelf, reload exposes one matching product and completed-draft inventory is empty only afterward.
- [x] Save a brand-only incomplete draft, review discard, cancel, reopen review and confirm exact discard.
- [x] Ordinary scoped storage-read failure stays unavailable rather than empty; unsupported encrypted-envelope version stays invalid rather than empty and exact source bytes remain intact. Restore only the synthetic fixture and explicitly refresh. Second tab is denied before any private `layerwell.*` read.
- [x] Enter activates Save, Add and confirmed Discard. Save and Discard geometry receipts confirm focused, visible, hit-testable 56px-high targets at every layout; other touch controls meet the existing harness's 44px minimum. EAN-8 publishes its selected checked state.
- [x] The r3 UI bugs are documented with the repository bug template and rerun on the same surface. Field-order-independent save status and explicit barcode `aria-checked` pass; see `manual-browser-r4/BUG_FIX_VERIFICATION.md`.

## Optional change recovery — PASS

Command: `python ../ENGINEERING21_EVIDENCE/run_check.py optional-browser-r4 node scripts/e2e/optional-change-drafts21.mjs` with `ONSKIN_CHANGE_EVIDENCE` set to the matching evidence directory. Exit 0; 231.86 seconds; 42 screenshots across three layouts.

- [x] Begin with an empty draft inventory. Save original note text/date/category without appending history; purpose-bound ciphertext contains no factual text. Make a later unsaved edit, reload and explicitly resume exact original text and date; confirmation is unavailable until fresh review.
- [x] Explicitly confirm once; canonical history contains the original stable event ID once, and exact draft retirement follows readback. Reload retains the single event.
- [x] Save a correction to the original event, close it, explicitly append a separate later note, reload and resume the correction. Exact original target ID/hash/text remain unchanged while Review is disabled for changed history. Explicit Refresh reads current history, preserves target/text, and requires fresh review and confirmation.
- [x] Save/reload/resume a retraction with its original reason and observed date, then review and confirm. Previously retained note/correction events remain unchanged. Deliberately correct the earlier retained original after review; it keeps that exact target rather than silently choosing a newer event.
- [x] Each isolated viewport ends with five unique canonical events, the exact expected kinds/text/targets, no duplicate IDs and no automatic draft submission. Original completion bytes and actual routine journal remain unchanged. In this browser fixture both were initially absent and remain absent; preservation of nonempty histories belongs to the separate focused/regression test receipts.
- [x] Draft discard review/cancel/confirm, distinct unavailable/unsupported/empty states, exact refused-source preservation and explicit refresh all pass. Optional factual text does not enter observed request bodies or URLs.
- [x] Enter activates Save, Confirm, Refresh and Discard with explicit fresh review. Save, Confirm and Discard geometry is focused, hit-testable, at least 44px high and within the viewport. Actual touch controls also meet the harness minimum.

## Direct visual review

Inspected rendered PNGs directly, in addition to all snapshot/overflow assertions:

- Manual375: saved status, recovered opening choices and canonical Shelf count; manual390: unreadable storage; manual430: recovered saved inventory.
- Optional375: resumed-note review requirement, saved correction inventory and changed-history blocked review; optional390: recovered retraction reason; optional430: exact original multiline note, review requirement and unsupported-storage refusal.

No horizontal overflow was detected at any captured state. The screens are vertically scrollable; screenshot crops do not purport to display every field simultaneously. Full UI snapshots and exact input assertions accompany them.

## Retained failures and limits

- Manual r1: loopback socket restriction and CLI DevTools artifact-prefetch warning, before app interaction. Its diagnostic records the attempted tooling artifact fetch and missing successful provider result. Existing `EXPO_UNSTABLE_HEADLESS` suppresses that background helper in later runs; no new dependency was installed.
- Manual r2: stopped before interaction while B's shared source was incomplete; unresolved import and original failure retained. Manual r3: two genuine UI bugs, subsequently fixed and proven in r4.
- Optional r1-r3: driver setup/API defects before optional interaction (unfinished onboarding; omitted saved-reminder Continue; unexported helper). All original logs/screenshots/exit receipts and precise setup diagnostics are retained. R4 passes the corrected real UI setup and full feature journey.
- Browser HTTP receipts do not establish process-wide network isolation. No genuine OCR, camera, professional, clinical or provider operation was performed. No paid action, native build/device attempt, dependency install, hosted CI, remote write/upload/publication, merge/deploy or release occurred.
- Native persistence, VoiceOver/installed-device qualification, two-device/cloud recovery and OS delivery were not tested. Owner/epoch ABA, concurrent CAS, uncertain commit, rights export and withdrawal drain are primarily covered by the separately reported local invariant/regression tests; this receipt does not relabel those as browser proof.
- Independent acceptance remains with Brain. All 38 requirements and 18 gates remain UNACCEPTED; release remains NO_GO.

Evidence roots: `manual-browser-r4/`, `optional-browser-r4/`, their sibling `.json` command receipts and `.log` transcripts, `browser-source-and-cleanup.json`, and retained preceding runs. The root engineer owns the final evidence SHA-256 manifest and checkpoint report.
