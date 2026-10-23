"""Check this issuance only; never grant original Security admission."""
import ast
import hashlib
import json
import pathlib
import subprocess

BASE = 'bfa2cf14110e701937d4b50b063565f3dea34f8a'
PREFIX = 'docs/brain/checkpoints/M1-03/SECURITY-SBOM-FIXTURE-01/'
TARGET = 'scripts/phase9/security_acceptance/test_contract.py'
ROOT = pathlib.Path(subprocess.check_output(['git', 'rev-parse', '--show-toplevel']).decode().strip())
CHECKPOINT = ROOT / PREFIX

def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT)

def identity(raw):
    return dict(bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest(),
                git_blob=hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest())

patch = json.loads((CHECKPOINT / 'inputs/PATCH_REVIEW.json').read_bytes())
patch_bytes = (ROOT / patch['committed_patch_path']).read_bytes()
assert identity(patch_bytes) == dict(bytes=patch['patch_bytes'], sha256=patch['committed_patch_sha256'], git_blob=patch['committed_patch_git_blob'])
observed = identity((ROOT / TARGET).read_bytes())
assert observed == dict(bytes=patch['expected_postimage_bytes'], sha256=patch['expected_postimage_sha256'], git_blob=patch['expected_postimage_git_blob'])
unchanged = []
for witness in json.loads((CHECKPOINT / 'inputs/PREIMAGE_WITNESSES.json').read_bytes())['files']:
    path = witness['path']
    before = git('cat-file', 'blob', BASE + ':' + path)
    assert dict(path=path, **identity(before)) == witness
    if path not in (TARGET, 'ONSKIN_BRAIN_HANDOFF.txt'):
        assert (ROOT / path).read_bytes() == before, path
        unchanged.append(path)
before_ast = ast.parse(git('cat-file', 'blob', BASE + ':' + TARGET))
after_ast = ast.parse((ROOT / TARGET).read_bytes())
for tree in (before_ast, after_ast):
    cls = next(node for node in tree.body if isinstance(node, ast.ClassDef) and node.name == 'ContractTests')
    tests = [node.name for node in cls.body if isinstance(node, ast.FunctionDef) and node.name.startswith('test_')]
    assert len(tests) == 70
    cls.body = [node for node in cls.body if not (isinstance(node, ast.FunctionDef) and node.name == 'workflow_fixture')]
assert ast.dump(before_ast) == ast.dump(after_ast), 'Original assertions or test bodies changed'
changed = set(git('diff', '--name-only', BASE).decode().splitlines())
changed.update(git('ls-files', '--others', '--exclude-standard').decode().splitlines())
for path in changed:
    assert path in (TARGET, 'ONSKIN_BRAIN_HANDOFF.txt') or path.startswith(PREFIX), path
    full = ROOT / path
    assert full.is_file() and not full.is_symlink() and full.stat().st_nlink == 1, path
assert git('diff', '--name-only', BASE, '--', TARGET).decode().strip() == TARGET
subprocess.run(['git', 'diff', '--check', BASE, '--', TARGET, 'ONSKIN_BRAIN_HANDOFF.txt'], cwd=ROOT, check=True)
print(json.dumps(dict(status='PASS', base=BASE, head=git('rev-parse', 'HEAD').decode().strip(),
    tree=git('rev-parse', 'HEAD^{tree}').decode().strip(), target_postimage=observed,
    unchanged_witnesses=len(unchanged), original_test_bodies_preserved=70,
    only_changed_function='ContractTests.workflow_fixture', changed_paths=sorted(changed),
    protected_source_go=False, security_admission='CLOSED'), indent=2))
