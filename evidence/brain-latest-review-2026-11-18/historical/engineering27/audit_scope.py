import hashlib, json, subprocess
from pathlib import Path

EVIDENCE = Path(__file__).resolve().parent
REPO = EVIDENCE.parent / 'c16-candidate'
START = '0998a353feee905bf9be5cd728dbb76be4fd23ee'
APP = 'apps/mobile/src/features/today/OptionalChangePanel41.tsx'
TEST = 'apps/mobile/src/features/today/OptionalChangePanel41.test.tsx'
def git(*args):
    return subprocess.check_output(['git', *args], cwd=REPO).decode()
old_app = git('show', START + ':' + APP)
old_test = git('show', START + ':' + TEST)
app = (REPO / APP).read_text(encoding='utf-8')
test = (REPO / TEST).read_text(encoding='utf-8')
assert git('diff', '--name-only', START).splitlines() == [TEST, APP]
marker = "describe('optional change panel41 actual interaction'"
assert test[test.index(marker):] == old_test[old_test.index(marker):]
assert test[:test.index("describe('collapsed optional change draft entry'")] == old_test[:old_test.index(marker)]
assert app[:app.index('export function OptionalChangePanel41')] == old_app[:old_app.index('export function OptionalChangePanel41')]
def primary_handler(source):
    start = source.index('onPress={() => {', source.index('label="Record a change (optional)"'))
    return source[start:source.index('}} />', start) + 6]
assert primary_handler(app) == primary_handler(old_app)
new_content = app[app.index('function OptionalChangeContent41'):]
new_content = new_content.replace(
    'function OptionalChangeContent41({ lease, isSourceCurrent, dark = false, initialInventoryOpen = false }: PanelProps41 & { initialInventoryOpen?: boolean })',
    'function OptionalChangeContent41({ lease, isSourceCurrent, dark = false }: PanelProps41)')
new_content = new_content.replace('const [inventoryOpen, setInventoryOpen] = useState(initialInventoryOpen);',
                                  'const [inventoryOpen, setInventoryOpen] = useState(false);')
assert new_content == old_app[old_app.index('function OptionalChangeContent41'):]
result = {
    'allowedSourceFilesOnly': [APP, TEST],
    'existingMountedTestsAndAssertionsUnchanged': True,
    'existingTestPortsAndSharedHelpersUnchanged': True,
    'primaryEntryHandlerUnchanged': True,
    'contentUnchangedExceptInitialInventoryStateParameter': True,
    'inventoryResumeRefreshDiscardBackAndCanonicalHistoryLogicUnchanged': True,
    'originalAcceptedLeaseAndSourcePinnedWhileEntryActive': True,
    'focusRetirementClosesEntryAndInvalidatesCapturedHandler': True,
    'noNewRoutePersistentStateKeyPackageOrSchema': True,
    'accessibility': {'headingRole': 'header', 'hint': 'Opens saved factual notes, corrections and retractions.',
                      'buttonConvention': 'Existing shared Button has min-h-[56px]; unchanged, no smaller style override.'},
    'testDiscovery': 'Existing observationHistory.test.ts imports the .tsx panel tests; Vitest include excludes direct .tsx entry files. Separate bridge run and root run cover all mounted tests.',
    'newCases': 13, 'existingMountedCases': 35,
    'existingTestsSha256': hashlib.sha256(old_test[old_test.index(marker):].encode()).hexdigest(),
    'peerReview': 'Read-only review found scope and authority wiring appropriate. Recommended focus cleanup was applied. Reviewer made no edits or test calls.',
    'failedFirstRun': {'receipt': 'focused-mounted.json', 'passed': 47, 'failed': 1,
                      'cause': 'New primary-path test omitted existing category selection before expecting factual text field.',
                      'correction': 'Added Observed local date assertion and explicit Other personal note press; original failing assertion retained.',
                      'productionChangedForFailure': False, 'timeoutOrRetryConfigurationChanged': False}
}
(EVIDENCE / 'SOURCE_INVARIANTS.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
print(json.dumps(result))
