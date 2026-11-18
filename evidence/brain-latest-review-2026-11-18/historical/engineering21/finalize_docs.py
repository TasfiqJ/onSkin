from pathlib import Path

repo = Path(__file__).resolve().parent.parent / 'c16-candidate'
path = repo / 'docs/ENGINEERING21_REPORT.md'
lines = path.read_text(encoding='utf-8').splitlines()
replacements = {
    'Authorization: **ENGINEERING21_DEFENSIVE_SCOPE_001**.': 'Authorization: **ENGINEERING21_DEFENSIVE_SCOPE_001**. Execution is **LOCAL_ONLY / DEFENSIVE / ZERO_NEW_PAID_OPERATIONS**. Result: **COMPLETE_LOCAL_CHECKPOINT** for the two assigned consumer workstreams. It does not claim independent acceptance. The independent ChatGPT Brain remains the source-code reviewer and acceptance decision-maker.',
    '| Final HEAD/tree, branch/status |': '| Final HEAD/tree, branch/status | Exact post-commit values in [SOURCE_IDENTITY.json](../../ENGINEERING21_EVIDENCE/SOURCE_IDENTITY.json) and [FINAL_REPORT.md](../../ENGINEERING21_EVIDENCE/FINAL_REPORT.md); same branch, clean final Git status |',
    '| Append-only commit list |': '| Append-only commit list | One local commit directly after the starting HEAD; full commit/parent/tree list in the final identity and report; no remote publication |',
    '| Final changed-file inventory and evidence manifest |': '| Changed-file inventory and evidence manifest | [CHANGED_FILES.json](../../ENGINEERING21_EVIDENCE/CHANGED_FILES.json), [SOURCE.diff](../../ENGINEERING21_EVIDENCE/SOURCE.diff), [SHA256SUMS.txt](../../ENGINEERING21_EVIDENCE/SHA256SUMS.txt) |',
    '| Final delivery result |': '| Final delivery result | **COMPLETE_LOCAL_CHECKPOINT**; no remaining local implementation blocker |',
    'The five starting checks are preserved': r'The five starting checks are preserved in [BASELINE.json](../../ENGINEERING21_EVIDENCE/BASELINE.json). Local evidence is held separately in `[LOCAL_USER_HOME]\Documents\ChatGPT\MasterV2Code\ENGINEERING21_EVIDENCE`. Test receipts record the command, source HEAD/tree, working status/tracked-diff hash, exit code, elapsed time and log SHA-256. Checks ran before the local commit, on the recorded working changes. Final source inventory hashes include every committed new file; browser source hashes are checked against the final worktree. The post-commit identity is stored outside the repository to avoid a self-referential commit hash.',
    '## Local validation available': '## Completed local validation',
    'Counts below overlap': 'Focused counts below overlap and are not a combined total. The final uncached root total is 8,527 passing tests across 576 files.',
    '| Optional-change browser journeys': '| `optional-browser-r4` | Optional note/correction/retraction journeys passed 375x667, 390x844 and 430x932; 231.86 seconds, zero blocked external requests; owned browser/server processes stopped |',
    'The root suite command is': 'The root suite command is `npm.cmd test -- --cache=local:w --concurrency=1`. The evidence wrapper disables dotenv/telemetry, removes credential environment variables and uses blocked development provider placeholders. Local browser drivers restrict requests to loopback and use isolated synthetic owners/storage. Both journeys passed at 375x667, 390x844 and 430x932 with keyboard controls, reload/resume, explicit confirmation/discard, read refusal and unsupported-data branches. Screenshots were inspected. Optional browser runs verify five unique canonical events, exact targets, changed-history refusal and explicit refresh/re-review, including a later correction of an earlier retained event. Completion bytes and the actual-routine journal began absent and stayed absent in this browser fixture; real encrypted store tests separately prove preservation of nonempty retained completion and actual-routine data.',
    '- The third manual browser run': '- The third manual browser run found a real false Unsaved indicator caused by JSON object-key ordering and missing DOM `aria-checked` for barcode options. Semantic field comparison and explicit radio accessibility attributes were added; focused UI/typecheck/lint checks were run. Both repaired browser journeys passed all three widths in their r4 runs.',
    '- Optional browser r1 reached': '- Optional browser r1 reached the existing unavailable-routine state because the fresh owner had not completed onboarding. R2 followed onboarding but stopped at the notifications screen, where saving reminders off requires a separate Continue. R3 used an unexported harness helper during category setup; this was corrected and all used helper exports were checked before r4. These failures occurred before the optional editor; their UI snapshots and logs remain recorded. The final driver follows existing explicit setup steps without injecting a profile, routine or successful history result.',
    'Before final delivery, the root engineer must': 'The local evidence manifest covers the retained failed and successful receipts, screenshots, canonical readbacks, source diff, changed-file inventory and exact final Git identity. [FROZEN_CONTRACTS.json](../../ENGINEERING21_EVIDENCE/FROZEN_CONTRACTS.json) verifies the seven frozen contract/matrix/precedence files against the baseline. No local implementation blocker remains. Native, genuine provider and release qualification remain outside this authorization, with **UNACCEPTED / NO_GO** and independent Brain review unchanged.',
}
for prefix, replacement in replacements.items():
    matches = [index for index, line in enumerate(lines) if line.startswith(prefix)]
    assert len(matches) == 1, (prefix, matches)
    lines[matches[0]] = replacement
path.write_text('\n'.join(lines) + '\n', encoding='utf-8')
progress = repo / 'PROGRESS.md'
prior = progress.read_text(encoding='utf-8')
heading = '# Autonomous product engineering18'
assert prior.count(heading) == 1
entry = '''# Durable consumer draft recovery Engineering21 - 2026-11-17

**COMPLETE_LOCAL_CHECKPOINT**, authorization ENGINEERING21_DEFENSIVE_SCOPE_001. LOCAL_ONLY / DEFENSIVE / ZERO_NEW_PAID_OPERATIONS. Verified clean starting HEAD `4dce84e20a71f19c60c16c7682e683bb512363ed`, tree `9d61cabdc11cff36577e4e7aa94b00ca4a95f393`, same `stage/m1-native-runtime47` branch and preserved PR48 ancestry. Added separate explicitly saved manual-intake and optional note/correction/retraction recovery with original owner/epoch authority, exact revisions, stable submission identities, canonical readback, cleanup and paused rights export. Final uncached root **8,527 tests passed**; configured typecheck/lint each passed four uncached tasks; consumer web export and both browser journeys passed at 375x667, 390x844 and 430x932. Initial failures and repairs remain recorded. [Scoped report](docs/ENGINEERING21_REPORT.md); exact final HEAD/tree, append-only commit, file inventory and SHA-256 manifest are in the separate ENGINEERING21_EVIDENCE delivery. All 38 requirements and 18 gates remain **UNACCEPTED**, release **NO_GO**. Brain retains independent acceptance; professional expansion and native/provider qualification remain deferred. No remote publication, hosted CI, native/device attempt, new paid operation or release.

'''
progress.write_text(entry + prior[prior.index(heading):], encoding='utf-8')
print('Finalized Engineering21 report and progress checkpoint')
