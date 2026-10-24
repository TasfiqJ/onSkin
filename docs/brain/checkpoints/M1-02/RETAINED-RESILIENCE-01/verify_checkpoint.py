"""Read-only provenance check. This is not Brain or protected acceptance."""
import hashlib
import json
import pathlib
import subprocess

HERE = pathlib.Path(__file__).resolve().parent
ROOT = pathlib.Path(subprocess.check_output(['git', 'rev-parse', '--show-toplevel'], text=True).strip())
BASE = 'd9912f4c8b30358593569c5b9b4e84773c6f463e'
SOURCE = '8284218a0c0c261a7eca841029ff3090af3e7c3b'
PREFIX = 'docs/brain/checkpoints/M1-02/RETAINED-RESILIENCE-01/'
NOTE = 'docs/brain/checkpoints/M1-03/BLOCKED-EXTERNAL-CUSTODY-2026-10-23.md'

def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT, text=True).strip()

def read(name):
    return json.loads((HERE / name).read_text(encoding='utf-8'))

assert git('branch', '--show-current') == 'stage/m1-retained-resilience'
assert git('rev-parse', BASE + '^{tree}') == '389c2a09b62e78a225a2b41c8a1965a1b0e1ab80'
assert git('rev-parse', SOURCE + '^{tree}') == '3d0575e6a94031b1b698c79dce95c434962d7b46'
scope = read('source-scope.json')
source_paths = {row['path'] for row in scope['files']}
assert len(source_paths) == 8
assert set(git('diff', '--name-only', BASE, SOURCE).splitlines()) == source_paths
parent = BASE
for commit in read('source-commits.json')['commits']:
    assert git('rev-parse', commit['sha'] + '^') == parent == commit['parent']
    assert git('rev-parse', commit['sha'] + '^{tree}') == commit['tree']
    assert set(git('diff', '--name-only', parent, commit['sha']).splitlines()) == set(commit['paths'])
    parent = commit['sha']
assert parent == SOURCE
for row in scope['files']:
    assert row['path'].startswith(row['authorized_prefix'])
    assert git('rev-parse', SOURCE + ':' + row['path']) == row['after_blob']
    assert hashlib.sha256((ROOT / row['path']).read_bytes()).hexdigest() == row['after_sha256']
for row in read('protected-objects.json'):
    assert git('rev-parse', BASE + ':' + row['path']) == git('rev-parse', 'HEAD:' + row['path'])
for path in git('diff', '--name-only', BASE).splitlines():
    assert path in source_paths or path in {NOTE, 'ONSKIN_BRAIN_HANDOFF.txt'} or path.startswith(PREFIX), path
assert not git('ls-tree', '-r', '--name-only', BASE, PREFIX, NOTE)
receipts = list((HERE / 'receipts').glob('*/receipt.json'))
for receipt_path in receipts:
    receipt = json.loads(receipt_path.read_text())
    for stream in ['stdout', 'stderr']:
        raw = (receipt_path.parent / (stream + '.txt')).read_bytes()
        assert len(raw) == receipt[stream + '_bytes']
        assert hashlib.sha256(raw).hexdigest() == receipt[stream + '_sha256']
for run in read('completion-report.json')['ui']:
    summary = json.loads((HERE / run['summary']).read_text())
    assert summary['verdict'] == 'pass'
    assert run['evidence_class'] == 'ACTUAL_EXPO_WEB_SYNTHETIC_LOCAL_SURFACE'
    assert run['native'] is False
manifest_path = HERE / 'evidence-manifest.json'
if manifest_path.exists():
    for entry in read('evidence-manifest.json')['entries']:
        relative = pathlib.PurePosixPath(entry['path'])
        assert not relative.is_absolute() and '..' not in relative.parts
        path = HERE / str(relative)
        assert path.is_file() and not path.is_symlink()
        raw = path.read_bytes()
        assert len(raw) == entry['bytes']
        assert hashlib.sha256(raw).hexdigest() == entry['sha256'], entry['path']
print(json.dumps({'result': 'PASS', 'scope': 'CHECKPOINT_PROVENANCE_ONLY',
                  'source': SOURCE, 'source_paths': len(source_paths),
                  'complete_command_receipts': len(receipts), 'actual_web_runs': 4,
                  'protected_admission': 'NONE'}))
