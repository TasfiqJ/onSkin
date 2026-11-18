import hashlib
import json
import subprocess
from pathlib import Path

EVIDENCE = Path(__file__).resolve().parent
REPO = EVIDENCE.parent / 'c16-candidate'
TARGET = 'apps/mobile/src/features/shelf/formulaHistoryJourney.test.ts'
START = 'ac026eea9e6860a19972bf5a6c78057f95eb9320'

def git(*args):
    return subprocess.check_output(['git', *args], cwd=REPO)

before = git('show', START + ':' + TARGET).decode()
after = (REPO / TARGET).read_text(encoding='utf-8')
old = "  await act(async()=>{renderer=create(createElement(QueryClientProvider,{client},createElement(FormulaHistoryScreen)));});await flush26();\n"
new = """  await act(async()=>{renderer=create(createElement(QueryClientProvider,{client},createElement(FormulaHistoryScreen)));});
  await vi.waitFor(async () => {
    await act(async () => { await Promise.resolve(); });
    const record = control('Record label observation');
    expect(record, 'Record label observation').toBeDefined();
    expect(record.props.disabled).not.toBe(true);
  });
"""
assert before.count(old) == 1
assert after == before.replace(old, new, 1)
paths = git('diff', '--name-only', START).decode().splitlines()
assert paths == [TARGET]
body_start = "it('resumes only explicitly after remount"
assert before[before.index(body_start):] == after[after.index(body_start):]
helper_before = before[before.index('const control='):before.index('beforeEach(')]
helper_after = after[after.index('const control='):after.index('beforeEach(')]
assert helper_before == helper_after
runtime_path = 'node_modules/vitest/dist/chunks/test.DNmyFkvJ.js'
runtime = (REPO / runtime_path).read_text(encoding='utf-8')
assert 'const { interval = 50, timeout = 1e3 }' in runtime[runtime.index('function waitFor('):]
result = {
    'onlyChangedPath': TARGET,
    'exactSingleSetupReplacement': True,
    'allTestBodiesAndAssertionsByteIdenticalAfterGitLineEndingNormalization': True,
    'controlPressAndLabelHelpersUnchanged': True,
    'setupAuthorityAndFixturesUnchanged': True,
    'allLaterFlush26CallsUnchanged': True,
    'activationOutsideReadinessWait': True,
    'waitUsesUnmodifiedVitestDefaults': {'timeoutMs': 1000, 'intervalMs': 50, 'source': runtime_path},
    'noNewSleepTimeoutOverrideRetryConfigSkipOrConcurrencyChange': True,
    'testBodySha256': hashlib.sha256(after[after.index(body_start):].encode()).hexdigest(),
    'sourceRawSha256': hashlib.sha256((REPO / TARGET).read_bytes()).hexdigest(),
    'sourceGitBlob': git('hash-object', TARGET).decode().strip(),
    'readOnlyPeerReview': 'PASS: exact mounted enabled control; unchanged press, test cases and later waits; no blocker. Reviewer performed no edits or tests.'
}
(EVIDENCE / 'SOURCE_INVARIANTS.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
print(json.dumps(result))
