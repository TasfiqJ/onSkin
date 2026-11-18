from pathlib import Path
import datetime, hashlib, json, subprocess

root = Path(__file__).resolve().parent
repo = root.parent / 'c16-candidate'
base = '16fdc6101bd43a1a70dec51fc5a832fa580c8d4d'
base_tree = 'fec3e97ca19de8dea6c6c513653c10419c5218fa'
prior = '4dce84e20a71f19c60c16c7682e683bb512363ed'
pr48 = 'd292743c99c1fb98f5714789f4fd60fb1e7d5a5d'
branch = 'stage/m1-native-runtime47'

def git(*args):
    return subprocess.check_output(['git', *args], cwd=repo)
def text(*args):
    return git(*args).decode('utf-8').strip()
def sha(data):
    return hashlib.sha256(data).hexdigest()
def write(name, value):
    (root / name).write_text(json.dumps(value, indent=2) + '\n', encoding='utf-8')

assert text('branch', '--show-current') == branch
assert text('rev-parse', base + '^{tree}') == base_tree
assert text('rev-parse', base + '^') == prior
assert text('rev-parse', 'HEAD^') == base
assert not text('status', '--porcelain=v1')
subprocess.run(['git','merge-base','--is-ancestor',pr48,'HEAD'], cwd=repo, check=True)
subprocess.run(['git','diff','--check',base,'HEAD'], cwd=repo, check=True)
changed_names = text('diff','--name-only',base,'HEAD').splitlines()
assert set(changed_names) == {'PROGRESS.md', 'docs/ENGINEERING22_REPORT.md'}
unchanged = {}
for directory in ['apps', 'packages', 'scripts']:
    old = text('rev-parse', base + ':' + directory)
    final = text('rev-parse', 'HEAD:' + directory)
    assert old == final, directory
    unchanged[directory] = final
frozen = [f'docs/release/full-app-j01/{name}.v{version}.json' for version in [1,2]
          for name in ['contract','matrix','precedence']] + ['docs/hugeToDo/launch-contract.json']
frozen_hashes = {}
for name in frozen:
    old, final = git('show',base+':'+name), git('show','HEAD:'+name)
    assert old == final, name
    frozen_hashes[name] = sha(final)
write('FROZEN_CONTRACTS.json', frozen_hashes)
validation = {}
for label in ['candidate-focused','preserved-focused','preserved-root-tests','preserved-root-typecheck','preserved-root-lint']:
    receipt = json.loads((root/(label+'.json')).read_text(encoding='utf-8'))
    expected_exit = 1 if label == 'candidate-focused' else 0
    assert receipt['exit'] == expected_exit, label
    assert receipt['logSha256'] == sha((root/(label+'.log')).read_bytes()), label
    validation[label] = {key:receipt[key] for key in ['command','exit','seconds','start','end','logSha256']}
validation['interpretation'] = 'Candidate rejected: 100 pass / 1 protected v5 failure, including 3 passing new pure invariants. Preserved-source validation does not validate or accept the candidate.'
write('VALIDATION.json', validation)
identity = {'result':'BLOCKED', 'authorization':'BRAIN-ONSKIN-OPTIONAL-DRAFT-SOURCE-PROOF-22',
            'collectedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(), 'worktree':str(repo), 'branch':branch,
            'startingHead':base, 'startingTree':base_tree, 'startingImmediateParent':prior, 'startingStatus':'clean',
            'finalHead':text('rev-parse','HEAD'), 'finalTree':text('rev-parse','HEAD^{tree}'), 'finalStatus':'clean',
            'pr48Ancestor':pr48, 'pr48Preserved':True, 'unchangedGitSubtrees':unchanged,
            'appendOnlyCommits':[{'head':text('rev-parse','HEAD'),'parent':base,'subject':text('log','-1','--format=%s')}],
            'candidateRetainedInApplication':False, 'requestedHardeningCompleted':False,
            'blocker':'Direct proof equality breaks protected v5 readback: draft outer proof versus canonical event inner predecessor proof. Scope forbids contract/schema/history changes.',
            'requirements':'38 UNACCEPTED','gates':'18 UNACCEPTED','release':'NO_GO','independentAcceptance':False}
write('SOURCE_IDENTITY.json', identity)
write('CHANGED_FILES.json', [{'path':name,'worktreeSha256':sha((repo/name).read_bytes()),
                             'committedBlobSha256':sha(git('show','HEAD:'+name))} for name in changed_names])
(root/'SOURCE.diff').write_bytes(git('diff','--binary','--full-index',base,'HEAD'))
report = (repo/'docs/ENGINEERING22_REPORT.md').read_text(encoding='utf-8').replace('../../ENGINEERING22_EVIDENCE/', '')
prefix = '# Engineering22 final local delivery\n\n**BLOCKED** — source-proof hardening is not retained or accepted.\n\n'
prefix += f'Branch `{branch}`; clean starting and final status.\n\nStarting HEAD `{base}`\n\nStarting tree `{base_tree}`\n\nStarting immediate parent `{prior}`\n\n'
prefix += f"Final HEAD `{identity['finalHead']}`\n\nFinal tree `{identity['finalTree']}`\n\n"
prefix += f"One append-only documentation commit: `{identity['finalHead']}` — {identity['appendOnlyCommits'][0]['subject']}.\n\n"
prefix += 'Application, package, script and test Git subtrees are unchanged. [Final source diff](SOURCE.diff) changes only two documentation files; [rejected candidate](REJECTED_CANDIDATE.diff) remains separate.\n\n'
prefix += '[Validation receipts](VALIDATION.json) · [Changed-file inventory](CHANGED_FILES.json) · [Evidence manifest](SHA256SUMS.txt) · [Frozen contracts](FROZEN_CONTRACTS.json).\n\n'
prefix += 'Candidate focused result: 100 passed / 1 protected v5 failure. Preserved application: 98 focused tests passed; 8,527 uncached root tests passed; four uncached typecheck and four configured lint tasks passed. These passes do not establish the requested hardening.\n\n---\n\n'
(root/'FINAL_REPORT.md').write_text(prefix+report, encoding='utf-8')
files = sorted((path for path in root.rglob('*') if path.is_file() and path.name != 'SHA256SUMS.txt'), key=lambda path:path.as_posix())
lines = [f'{sha(path.read_bytes())}  {path.relative_to(root).as_posix()}' for path in files]
(root/'SHA256SUMS.txt').write_text('\n'.join(lines)+'\n', encoding='utf-8')
for path, line in zip(files,lines):
    assert sha(path.read_bytes()) == line[:64]
print(json.dumps({'identity':identity, 'manifestFiles':len(files), 'manifestSha256':sha((root/'SHA256SUMS.txt').read_bytes())},indent=2))
