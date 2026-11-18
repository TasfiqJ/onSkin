import hashlib, json, subprocess
from pathlib import Path

E = Path(__file__).resolve().parent
R = E.parent / 'c16-candidate'
START = '0998a353feee905bf9be5cd728dbb76be4fd23ee'
ORIGINAL = {
 'apps/mobile/src/features/today/OptionalChangePanel41.tsx': 'c152a2813d7ffc949ae6ec81a691e3e76e77d2e22e4a64d0a3ded0f1b026562d',
 'apps/mobile/src/features/today/OptionalChangePanel41.test.tsx': 'ab63c800285963bcc79275b880d3b68077f85b1605d82992b2714a469036e9a3',
}
MOCKS = {
 'apps/mobile/src/features/routine/planRecovery.test.ts': 'push: mocks.push, replace: mocks.replace',
 'apps/mobile/src/features/scheduler/cycleReadiness.plan.test.ts': 'replace: mocks.replace, push: vi.fn()',
}
def git(*args): return subprocess.check_output(['git', *args], cwd=R).decode()
for path, expected in ORIGINAL.items():
    assert hashlib.sha256((R / path).read_bytes()).hexdigest() == expected
changes = []
for path, methods in MOCKS.items():
    before = git('show', START + ':' + path)
    after = (R / path).read_text(encoding='utf-8')
    old = "vi.mock('expo-router', () => ({ router: { " + methods + " } }));"
    new = """vi.mock('expo-router', async () => {
  const { useEffect } = await import('react');
  return {
    router: { """ + methods + """ },
    // Mounted Today is focused here: run the callback on mount and register
    // its cleanup for unmount. These renderers do not simulate navigation blur;
    // dedicated mounted panel tests separately cover normal focus retirement.
    useFocusEffect: (callback: () => void | (() => void)) => useEffect(callback, [callback]),
  };
});"""
    assert before.count(old) == 1 and after == before.replace(old, new, 1)
    changes.append({'path': path, 'onlyExistingMockDeclarationChanged': True,
                    'routerMethodsPreserved': methods,
                    'allOtherBytesAfterGitLineEndingNormalizationUnchanged': True})
assert git('diff', '--name-only', START).splitlines() == sorted([*ORIGINAL, *MOCKS])
result = {'result': 'PASS', 'originalCandidateHashesPreserved': ORIGINAL, 'mockChanges': changes,
          'callbackSemantics': 'Real React useEffect invokes callback on mounted focused render; returned cleanup is registered for unmount/dependency change; dependency array is exactly [callback].',
          'navigationBlur': 'Not simulated by these two renderers; unchanged dedicated panel tests separately verify normal focus retirement.',
          'unchanged': ['All original assertions, fixtures, authority ports, test bodies and existing mounted focus-retirement coverage',
                        'Both retained E27 candidate files byte-for-byte', 'All source outside the two router mock declarations'],
          'notIntroduced': ['No-op focus callback', 'Fake navigation stack', 'Conditional hook', 'Global focus override', 'Production bypass', 'Test-only production path'],
          'originalE27Failure': 'ENGINEERING27_EVIDENCE/root-tests.log: 7932 mobile passed / 45 failed because both router-only mocks lacked useFocusEffect.'}
(E / 'SOURCE_INVARIANTS.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
print(json.dumps(result))
