"""Publish truthful source observations; no acceptance or protected admission."""
import json
from pathlib import Path
import re

root = Path.cwd()
q = root / 'docs/brain/checkpoints/M1-03/QUALITY-RECOVERY-01'
rows = []
for path in sorted((q / 'evidence').glob('*.receipt.json')):
    value = json.loads(path.read_bytes())
    rows.append(dict(id=path.name.removesuffix('.receipt.json'), status=value['status'],
        raw_exit=value['exit_code'], source_commit=value['source_commit'],
        source_tree=value['source_tree'], output=value['output']))
by_id = {r['id']: r for r in rows}
for name in ['final-ci', 'final-forced-test', 'final-forced-typecheck', 'final-forced-lint',
             'final-worklist-check', 'final-source-profile', 'governance',
             'original-secret-fixtures']:
    assert by_id[name]['status'] == 'PASS' and by_id[name]['raw_exit'] == 0, name
for name in ['expo-compatibility', 'expo-doctor', 'ios-privacy-check', 'store-source-contract', 'original-security-contracts']:
    assert by_id[name]['status'] == 'FAIL' and by_id[name]['raw_exit'] == 1, name
summary = dict(outcome='PARTIAL_SAFE_BLOCKED', admission='NONE', source_executions=rows,
    root_tests=dict(passed=6067, mobile=6043, console=24, failed=0, cached_tasks=0),
    governance=dict(total=77, passed=75, failed=0, skipped=2,
        skips=['test_f4_dangling_and_existing_directory_junctions_do_not_create_targets: Windows junction test only',
               'test_windows_junction_input_and_output_rejected: Windows junction test only']),
    secret_fixtures=dict(total=12, passed=12), original_security_contracts=dict(total_cases_including_secret=82, original_contract_cases=70, failure_reports=23, errors=2, raw_exit=1),
    doctor=dict(total=21, passed=20, failed=1), spend_usd=0, protected_source_go=False,
    main_promotion_authorized=False, accepted_tasks=['M0-01', 'M0-02', 'M1-01', 'M1-02'])
(q / 'evidence/summary.json').write_bytes((json.dumps(summary, indent=2) + '\n').encode())
def write(name, text):
    (q / name).write_bytes(text.encode())
write('README.md', '''# M1-03 / QUALITY-RECOVERY-01

**PARTIAL_SAFE_BLOCKED â€” independent Brain review required; admission NONE.**

The issued two-package repair is delivered, with remaining source failures preserved. See [RESULTS](RESULTS.md), [BLOCKERS](BLOCKERS.md), the strict [completion report](completion-report.json), and [SHA256SUMS](SHA256SUMS.json).

External manifest SHA256 `99985ffc1dbe1fa0a94fe0af092bf42ccfb12ed7d48cdc30d12fca47ed1f634d` was supplied literally by the user and verified before edits. All 17 context files are byte-identical under inputs; the immutable independent review, authority and external digest proof are under `docs/brain/reviews/M1-03/SC03-REVIEW01/`. All eight existing preimages match issued SHA256 and Git blobs at the exact authorized base.

Functional implementation: `1bd013f5e68a671f76a3f9749e3b7fb395d49f15`, tree `bddaebf500681ab6bf0b729bb35df7a3ffe058e0`. Measured source after clean canonical worklist generation: `8dc7721b2d169e15d916f2bb3a9034bafbdb67b9`, tree `3121a99f228073def750a92ab87daa02bb326753`. Later commits contain checkpoint/handoff evidence only. Resolve final delivery from the live stage ref; the final response supplies its exact SHA/tree.

Prior reviews, source Security expiry, policies and protected code remain unchanged. No M1-03 self-acceptance, M2, hosted DB, release, spend or main promotion authority. Stop for Brain; founder returns `Codex is done`.
''')
write('BLOCKERS.md', '''# Blocked source follow-up and protected gates

1. **Four Expo SDK57 patch mismatches remain.** `@expo/ui57.0.25` expects `~57.0.26`; router57.0.28 expects `~57.0.29`; sharing57.0.23 expects `~57.0.24`; widgets57.0.26 expects `~57.0.27`. Official Expo check exits1; Doctor passes20/21 and exits1. The new finite source profile permits exactly the two issued mobile changes. Widgets additionally requires changes to the unlisted `scripts/phase5/patch-expo-widgets-lifecycle.mjs`, reviewed version/URL/SRI/native payloads and related contracts. Do not bypass, exclude or suppress these checks. Brain must independently review and issue a new exact source scope before repair.
2. **The legitimate lock update invalidates a frozen mapping.** Strict native privacy audit reports three MAPPING_LOCK_DRIFT errors in unlisted `docs/phase-9/ios-sdk-package-mapping.json`, for Google Sign-In, expo-image and react-native. Each binds the whole lockfile SHA256. Quality fails the installed iOS source step before reaching Expo compatibility. No native mapping, phase9 audit, original reviewers' pins or generated Phase9 output was edited. A new independent Brain allowance is required.
3. **Original Security fixture regression remains blocked.** Discovery ran82 cases (70 original contract +12 secret), with23 failure reports (including subtests) and2 errors, exit1. Valid known-artifact tests and several refusal tests stop at WORKFLOW_SBOM_UNRELATED_FAILURE_OR_DRIFT with the new dependency graph. Original secret12/12 and full governance75+2skips remain separate. Original phase9 fixtures, SBOM rules and scanner contracts cannot be changed under this issuance. Preserve this source regression for independent Brain review; do not treat historic70/70 as current green.
4. **Original canonical DB infrastructure remains blocked.** Exact immutable ECR image acquisition returns `Error response from daemon: error from registry: Data limit exceeded`. Original PG15/PG17 account-deletion jobs pass but cannot replace the canonical reset. Authorized registry/image custody or provider restoration is required. Image, Docker, workflows, credentials and spending remain unchanged; no quota workaround or paid retry.
5. **Original provider Security remains RED.** Secret/static/code/source-acceptance enforcement fails; findings remain unreviewed. The old source-only proposal expired2026-10-21T00:00:00Z without renewal. The issued old SAST diagnostic had189 failed paths/368 fixpoint events/eight unreviewed candidates. Private derivative remains NON_ADMITTING and was not adopted or rerun. Original safe contract tests passing never admit source Security.
6. **DB06/DB08/R2B and other evidence axes remain closed.** Same-target authorized DB/type/default-ACL custody and independent protected GO remain absent. No hosted replay, SQL/types/Edge changes, clinical/JANUS/patient content, device/native readiness, deployment, signing/TestFlight/release, M2 or main promotion.

The founder has no version-selection task. Independent Brain decides whether to issue the source follow-up; authorized infrastructure/Security/DB custodians retain their original gates. Only M0-01/M0-02/M1-01/M1-02 are accepted. protected_source_go=false; main_promotion_authorized=false; incremental_spend_usd=0; one writer; admission NONE.
''')
ci = {}
for path in sorted((q / 'evidence').glob('ci-*.json')):
    value = json.loads(path.read_bytes())
    if value.get('kind') == 'CI_OBSERVATION':
        for row in value['runs']:
            if row['run_id'] not in ci or value['recorded_at_utc'] > ci[row['run_id']][0]:
                ci[row['run_id']] = (value['recorded_at_utc'], row)
table = '\n'.join('| ' + ' | '.join([r['head_commit'][:8], r['name'], str(r['run_id']), r['status'], r['conclusion']]) + ' |' for _, r in ci.values())
execution_table = '\n'.join(f"| {r['id']} | {r['source_commit'][:8]} | {r['status']} | {r['raw_exit']} |" for r in rows)
write('RESULTS.md', '''# Observed results: PARTIAL_SAFE_BLOCKED

## Dependency repair

| Package | Issued preimage | Delivered manifest | Installed |
|---|---|---|---|
| expo | ~57.0.30 | ~57.0.31 | 57.0.31 |
| expo-network | ~57.0.2 | ~57.0.3 | 57.0.3 |

Both smallest requested patches resolve from the official npm registry. Root package.json is byte-unchanged; there are no new overrides, React Native/Expo major upgrades, application or UI changes. Lockfile was generated by reviewed npm11.20.0, never hand-edited. Windows generation and Linux regeneration produced the identical SHA256 `ce1992c391d8b1c533ab9596b00d0f14dfc4c39d51256ed90619ca4351654782`. Mobile manifest SHA256 is `7c00e764f0b8ee6f8654c3bbcb635041bee7e2e04c20b7f8f3adfe17ad40ce73`.

Required upstream pins include @expo/cli57.0.32, config-plugins57.0.11, modules-core57.0.24, modules-jsi57.1.3 and router-server57.0.14. Upstream config-plugins57.0.11 requires xcode^4.0.0, resolved4.0.0; no speculative override was introduced. npm also resolved allowed child patches/minors and deduplicated Metro runtime0.84.5. All20 changed lock entries, additions/removals and integrity strings are retained in evidence/lock-delta.json. The clean install added1,032 packages; earlier Brain install added1,035. Three fewer entries correspond to deduplicated Metro copies and removal of xcode3's uuid dependency, with a new nested @expo/json-file. React Native stays0.86.3.

The [official Expo compatibility command](https://docs.expo.dev/more/expo-cli/#install) independently reproduces six baseline mismatches and four after this patch. The two issued mismatches disappear. Overall compatibility and Doctor remain FAIL; no Quality green or release readiness is claimed.

## Tests and environment

Fresh independent no-hardlink Linux x86_64 clones; Python3.12.3, Node24.19.0, reviewed npm11.20.0. No shared node_modules. First measured install used a new task-only npm cache; the final clean clone reused only that task's package cache and reran installation and all scripts. No install-script bypass flag was used. npm's existing install policy warns about @sentry/cli and unrs-resolver; those settings were unchanged. Windows orchestration used Python3.9.13 and Node22.21.0/npm11.20.0; full nested argv/cwd and environment are in receipts.

Forced root tests PASS6,067 (mobile6,043 + console24), zero cached tasks. Forced typecheck/lint PASS, zero cached tasks. Root trilogy, fresh npm ci, strict worklist and source profile were also rerun at exact measured8dc7721. Full supported governance at implementation1bd013f5:77 total,75 PASS, two genuine Windows-only skips; original71 cases and six new cases retained. Original secret fixtures12/12 PASS. The original Security discovery ran82 cases (70 contract +12 secret), reporting23 failure events and2 errors, raw exit1, despite authentic historical pack import. The observed refusal is WORKFLOW_SBOM_UNRELATED_FAILURE_OR_DRIFT. Subtest failures are failure events, not a count of distinct test methods. Original tests were preserved and not weakened. These local results grant no provider admission.

Postinstall check, widget25 fixtures, iOS workflow2 fixtures and original native/tooling safe fixtures pass. Strict iOS privacy mapping check and store-source inspection FAIL on the three lock-bound mapping errors. Doctor20/21, compatibility FAIL. Native/device build/readiness is NOT_RUN.

Authentic local Git pack SHA256 `5391562b0faab1959d5849ecbc26d5fbe17c8f85a63d4efd9b8535ff1b89d4f4` was imported with index-pack --strict and no lazy fetching. Verified current3,265 and historic3,264 witness sets,112 unique blob/SHA256 references,55 witness-history endpoints; additional governance bases are exercised by the preserved profile tests. Ref bytes remained unchanged. No history was invented and no Git refs were changed by hydration.

Failed preparations remain: no-local clone rejected unavailable promisor history; independent local no-hardlink clone succeeded; lock-only postinstall lacked node_modules; two WSL launcher preparations failed before install; initial new fixture emitted ERROR and was interrupted, then fixed to materialize authentic historical files and passed6/6. Initial dirty worklist generation is retained, followed by clean canonical generation and final strict check PASS. The implementation-clone worklist check detects its new uncommitted receipt files; final check runs in a separate clean exact clone with outputs captured externally. No observation was overwritten or relabeled.

## Provider observations

| Head | Workflow | Run | Status | Conclusion |
|---|---|---|---|---|
''' + table + '''

Raw job metadata/steps and sanitized source/DB failure lines are committed. Source Quality fails the frozen mapping; canonical DB fails ECR quota; original Security stays failed/unreviewed; iOS is source-only. Pending metadata remains pending. Final evidence-only push receives its own exact-head observation in the final response and delivery receipt; no older green substitutes for it.

## Full raw exits

Every output and receipt below is SHA256-bound, including failed/preparatory observations. Source snapshot hashes and dirty-source markers distinguish exploratory runs from the strict report's measured executions.

| Execution | Source | Status | Raw exit |
|---|---|---|---|
''' + execution_table + '''

## Delivery boundaries

Functional implementation1bd013f5/treebddaebf5; clean canonical source snapshot8dc7721b/tree3121a99f. Later differences are checkpoint/root handoff only. New governance fixes the prior SC03 endpoint at the exact issued base, retains the old default refusals and adds one immutable non-union interval. Actual adverse tests reject branch/head/preimage/input drift, added/reverted source, false acceptance, expiry changes, Security/DB GO and fabricated evidence. Previous47 roadmap tasks/dependencies,27 module identities and51 prior ADRs are preserved.

PR9 stays draft/open/unmerged. Main remainsbbc28dc3d1f945191a81be56945b8bda7bb6ef73. The final response gives the live pushed SHA/tree and final-head CI. ContextLOW; no compaction observed. Source repair stopped at an unlisted required change after one dependency hypothesis; independent Brain alone decides follow-up or promotion. protected_source_go=false; main_promotion_authorized=false; spend0; admission NONE.
''')
handoff = '''onSkin V2 / M1-03 QUALITY-RECOVERY-01 â€” PARTIAL_SAFE_BLOCKED
Authorization M103-QUALITY-RECOVERY01-SOURCE-EDIT-01. Admission NONE. Stop for independent Brain; founder returns Codex is done.
External manifest99985ffc1dbe1fa0a94fe0af092bf42ccfb12ed7d48cdc30d12fca47ed1f634d verified16 members before edits. All17 files installed byte-exact; independent SC03-REVIEW01 immutable. All8 preimages verified by SHA256/Git blob.
Base6c9c280669ccce07cab0b57f7b2118ec7bbd3a35/tree43ab1a4a7597c8572850b98fdc420080ec834b07. Functional implementation1bd013f5e68a671f76a3f9749e3b7fb395d49f15/treebddaebf500681ab6bf0b729bb35df7a3ffe058e0. Measured source8dc7721b2d169e15d916f2bb3a9034bafbdb67b9/tree3121a99f228073def750a92ab87daa02bb326753 includes canonical clean generated worklist. Later checkpoint/handoff-only tail. Final stage SHA/tree resolve from live stage/m1-retained-safety; exact final identity is in Codex final response, avoiding a self-referential commit hash.
Expo~57.0.30->~57.0.31 installed57.0.31; expo-network~57.0.2->~57.0.3 installed57.0.3. npm11.20.0 generated deterministic lock SHA256ce1992c391d8b1c533ab9596b00d0f14dfc4c39d51256ed90619ca4351654782. Root package.json/RN0.86.3 unchanged. Full transitive delta is committed.
LinuxNode24.19/npm11.20/Python3.12; fresh clean installs PASS. Forced6067 tests, typecheck/lint PASS0 cached, rerun at exact8dc7721. Governance77=75PASS+2genuine Windows-only skips; original71 retained and6new adverse cases. Original secret12/12 PASS. Security discovery82cases (70originalcontract+12secret) FAIL23failureevents+2errors, rawexit1, WORKFLOW_SBOM_UNRELATED_FAILURE_OR_DRIFT despite authentic hydration; refs unchanged. No protected admission.
Official Expo checkFAIL4remainingSDKpatches; Doctor20/21FAIL. Required widget57.0.27 version/SRI/native payload/source contract change is unlisted. ThreeMAPPING_LOCK_DRIFT errors in unlisted docs/phase-9/ios-sdk-package-mapping.json block Quality at installed-native audit. Store source inspectionFAIL. No weakening or extra source edit.
Original canonical ECR image Data limit exceeded remainsFAIL; PG15/PG17 success cannot replace canonical reset. Original provider SecurityFAILED; unreviewed secret/static/code/source-acceptance, incomplete old SAST189failed/368events/8unreviewed; private derivativeNON_ADMITTING; expiry2026-10-21T00:00:00Z unchanged/expired. DB06/DB08/R2B remain unadmitted. New exact-head CI statuses/run/jobs are checkpoint CI artifacts; final evidence-tail CI is separately observed after push.
PR9draft/open/unmerged; mainbbc28dc3d1f945191a81be56945b8bda7bb6ef73 unchanged. No main merge/force/reset/rebase, native app/UI/source/protected policy/SQL/types/Edge edits, credential testing, signing/TestFlight/deploy/release, M2 or spending. One writer. Safe work normally pushed on existing stage.
Strict completion-report.json, RESULTS.md, BLOCKERS.md, SHA256SUMS.json and sanitized raw receipts/logs are under docs/brain/checkpoints/M1-03/QUALITY-RECOVERY-01. Artifacts must match committed regular Git blobs; raw failures retained. ContextLOW/no compaction observed. Brain must independently issue any mapping/widget follow-up; founder has no version choice task.
protected_source_go=false; main_promotion_authorized=false; incremental_spend_usd=0; active_writers=1; accepted_tasks=M0-01/M0-02/M1-01/M1-02; admission=NONE.
'''
(root / 'ONSKIN_BRAIN_HANDOFF.txt').write_bytes(handoff.encode())
print('Wrote truthful blocked summary, results, blockers and root handoff')
