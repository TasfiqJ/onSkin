"""Collect local, append-only Engineering21 evidence after the final commit."""
from pathlib import Path
import datetime
import hashlib
import json
import subprocess

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent / 'c16-candidate'
BASE = '4dce84e20a71f19c60c16c7682e683bb512363ed'
BASE_TREE = '9d61cabdc11cff36577e4e7aa94b00ca4a95f393'
ANCESTOR = 'd292743c99c1fb98f5714789f4fd60fb1e7d5a5d'
BRANCH = 'stage/m1-native-runtime47'

def git(*args):
    return subprocess.check_output(['git', *args], cwd=REPO)

def string(*args):
    return git(*args).decode('utf-8').strip()

def digest(data):
    return hashlib.sha256(data).hexdigest()

def write_json(name, value):
    (ROOT / name).write_text(json.dumps(value, indent=2) + '\n', encoding='utf-8')

assert string('branch', '--show-current') == BRANCH
assert string('rev-parse', BASE + '^{tree}') == BASE_TREE
assert not string('status', '--porcelain=v1'), 'Final worktree must be clean'
subprocess.run(['git', 'merge-base', '--is-ancestor', BASE, 'HEAD'], cwd=REPO, check=True)
subprocess.run(['git', 'merge-base', '--is-ancestor', ANCESTOR, 'HEAD'], cwd=REPO, check=True)
subprocess.run(['git', 'diff', '--check', BASE, 'HEAD'], cwd=REPO, check=True)

checks = {}
for label in ['manual-gate-r2', 'optional-focused-final', 'draft-postdispatch-core-r1', 'root-tests-final',
              'root-types-r2', 'root-lint-r2', 'consumer-build-r3']:
    receipt = json.loads((ROOT / (label + '.json')).read_text(encoding='utf-8'))
    assert receipt['exit'] == 0, label
    assert digest((ROOT / (label + '.log')).read_bytes()) == receipt['logSha256'], label
    checks[label] = {key: receipt[key] for key in ['command', 'start', 'end', 'exit', 'seconds', 'logSha256']}

browser = {}
for prefix in ['manual-browser-', 'optional-browser-']:
    candidates = []
    for path in ROOT.glob(prefix + '*/summary.json'):
        summary = json.loads(path.read_text(encoding='utf-8'))
        if summary.get('pass'):
            candidates.append((summary['endedAt'], path, summary))
    assert candidates, prefix
    _, path, summary = max(candidates, key=lambda row: row[0])
    assert [(row['width'], row['height']) for row in summary['viewports']] == [(375, 667), (390, 844), (430, 932)]
    assert not summary['blockedRemoteRequests']
    for name, expected in summary['sourceSha256'].items():
        assert digest((REPO / name).read_bytes()) == expected, 'Browser source changed: ' + name
    browser[path.parent.name] = {'summary': str(path.relative_to(ROOT)), 'sha256': digest(path.read_bytes()),
                                 'pass': True, 'sourceHashesMatchFinalWorktree': True}

frozen = [f'docs/release/full-app-j01/{name}.v{version}.json'
          for version in [1, 2] for name in ['contract', 'matrix', 'precedence']]
frozen.append('docs/hugeToDo/launch-contract.json')
frozen_rows = []
for name in frozen:
    before = git('show', BASE + ':' + name)
    after = git('show', 'HEAD:' + name)
    assert before == after, 'Frozen source changed: ' + name
    frozen_rows.append({'path': name, 'baselineAndFinalGitBlobSha256': digest(after),
                        'worktreeSha256': digest((REPO / name).read_bytes()), 'unchanged': True})
write_json('FROZEN_CONTRACTS.json', frozen_rows)

changed = []
for line in string('diff', '--name-status', BASE, 'HEAD').splitlines():
    change, name = line.split('\t')
    data = (REPO / name).read_bytes()
    changed.append({'change': change, 'path': name, 'bytes': len(data), 'worktreeSha256': digest(data),
                    'committedBlobSha256': digest(git('show', 'HEAD:' + name))})
write_json('CHANGED_FILES.json', changed)
(ROOT / 'SOURCE.diff').write_bytes(git('diff', '--binary', '--full-index', BASE, 'HEAD'))
commits = []
for line in string('log', '--reverse', '--format=%H%x09%T%x09%P%x09%s', BASE + '..HEAD').splitlines():
    head, tree, parents, subject = line.split('\t', 3)
    commits.append({'head': head, 'tree': tree, 'parents': parents.split(), 'subject': subject})
assert commits
for index, commit in enumerate(commits):
    assert commit['parents'] == [BASE if index == 0 else commits[index - 1]['head']], 'Nonlinear append'
identity = {'authorization': 'ENGINEERING21_DEFENSIVE_SCOPE_001', 'result': 'COMPLETE_LOCAL_CHECKPOINT',
            'collectedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'worktree': str(REPO),
            'branch': BRANCH, 'startingHead': BASE, 'startingTree': BASE_TREE, 'startingStatus': 'clean',
            'finalHead': string('rev-parse', 'HEAD'), 'finalTree': string('rev-parse', 'HEAD^{tree}'),
            'finalStatus': 'clean', 'pr48Ancestor': ANCESTOR, 'pr48Preserved': True,
            'appendOnlyCommits': commits, 'changedFileCount': len(changed),
            'requirements': '38 UNACCEPTED', 'gates': '18 UNACCEPTED', 'release': 'NO_GO',
            'independentAcceptance': False, 'remainingLocalBlockers': []}
write_json('SOURCE_IDENTITY.json', identity)
write_json('VALIDATION.json', {'checks': checks, 'browser': browser,
                             'note': 'Ordinary local synthetic validation only; native/device/provider qualification excluded.'})
report = (REPO / 'docs/ENGINEERING21_REPORT.md').read_text(encoding='utf-8').replace('../../ENGINEERING21_EVIDENCE/', '')
assert 'pending root' not in report.lower()
exact = '# Engineering21 final local delivery\n\n**COMPLETE_LOCAL_CHECKPOINT**; independent acceptance is not claimed.\n\n'
exact += f"Branch: `{BRANCH}`. Starting and final Git status: clean.\n\nStarting HEAD: `{BASE}`\n\nStarting tree: `{BASE_TREE}`\n\n"
exact += f"Final HEAD: `{identity['finalHead']}`\n\nFinal tree: `{identity['finalTree']}`\n\n"
exact += 'Append-only commits:\n\n' + '\n'.join(f"- `{row['head']}` — {row['subject']}" for row in commits) + '\n\n'
exact += f"Changed files: {len(changed)}; full names, sizes and hashes in [CHANGED_FILES.json](CHANGED_FILES.json). "
exact += 'Reversible source diff: [SOURCE.diff](SOURCE.diff). Validation receipts: [VALIDATION.json](VALIDATION.json). '
exact += 'Evidence manifest: [SHA256SUMS.txt](SHA256SUMS.txt). Frozen contracts: [FROZEN_CONTRACTS.json](FROZEN_CONTRACTS.json).\n\n'
exact += 'No remaining blocker to this local checkpoint. Native process termination, installed-device accessibility, genuine provider authority and release qualification were not attempted. '
exact += 'All 38 requirements and 18 gates remain UNACCEPTED; release remains NO_GO.\n\n---\n\n' + report
(ROOT / 'FINAL_REPORT.md').write_text(exact, encoding='utf-8')
files = sorted((path for path in ROOT.rglob('*') if path.is_file() and path.name != 'SHA256SUMS.txt'), key=lambda path: str(path.relative_to(ROOT)))
lines = [f'{digest(path.read_bytes())}  {path.relative_to(ROOT).as_posix()}' for path in files]
(ROOT / 'SHA256SUMS.txt').write_text('\n'.join(lines) + '\n', encoding='utf-8')
for path, line in zip(files, lines):
    assert digest(path.read_bytes()) == line[:64], str(path)
print(json.dumps({'identity': identity, 'manifestFiles': len(files),
                  'manifestSha256': digest((ROOT / 'SHA256SUMS.txt').read_bytes())}, indent=2))
