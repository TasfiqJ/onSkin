"""Bounded synthetic filesystem controls, including authentic pre-repair code."""
import hashlib
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import types
from unittest.mock import patch

ROOT = Path(__file__).absolute().parents[2]
sys.path.insert(0, str(ROOT / 'scripts/security22'))
from redact import Refusal

BASE = '34fac69f3ba527724ecdf2d1cef69f27372756ad'
LEGACY_SHA256 = '92bf5db492343bc8fa24ac224c83d149f06762dad2641c4496bed342a490d9be'


def legacy_child(root, scenario, source):
    raw = Path(source).read_bytes()
    assert hashlib.sha256(raw).hexdigest() == LEGACY_SHA256
    module = types.ModuleType('authenticated_legacy_toolchain22')
    exec(compile(raw, 'authenticated_legacy_toolchain22', 'exec'), module.__dict__)
    root = Path(root)
    def regular(_, name, limit):
        if name == 'scripts/security22/toolchain.json':
            return json.dumps(dict(schema=1, nodeMajor=22, npmVersion='11.20.0', pythonMinimum=[3, 9],
                checks=['inventory', 'dependency', 'tooling', 'historical_workflow_contract'],
                qualification='TECHNICAL_ONLY_NO_ADMISSION')).encode()
        return b'synthetic-public-source\n'
    def execute(argv, *args, **kwargs):
        if argv == ['git', '--version']: return 0, b'git version 2.47.3\n', b''
        if argv == ['node', '--version']: return 0, b'v22.16.0\n', b''
        if argv[-2:] == ['prefix', '--global']: return 0, str(root).encode() + b'\n', b''
        if argv[-1] == '--version': return 0, b'11.20.0\n', b''
        raise AssertionError('UNEXPECTED_SYNTHETIC_COMMAND')
    with patch.object(module, 'regular', regular), patch.object(module, 'execute', execute), \
         patch.object(module.shutil, 'which', lambda name: str(root / 'bin' / name)):
        try:
            value = module.identity(root)
            return dict(scenario=scenario, state='ACCEPTED_IDENTITY', files=value['tools']['npm']['files'],
                treeSHA256=value['tools']['npm']['treeSHA256'])
        except Refusal:
            return dict(scenario=scenario, state='REFUSED')


def historical_reproduction():
    if os.name != 'posix':
        return dict(qualification='HISTORICAL_FUNCTION_SYNTHETIC_FILESYSTEM_ONLY', state='NOT_RUN',
            reason='POSIX_PERMISSION_SEMANTICS_UNAVAILABLE', acceptanceGranted=False)
    raw = subprocess.check_output(['git', 'show', BASE + ':scripts/security22/toolchain.py'], cwd=ROOT, timeout=30)
    assert hashlib.sha256(raw).hexdigest() == LEGACY_SHA256
    with tempfile.TemporaryDirectory(prefix='security23-before-') as temporary:
        root = Path(temporary); root.chmod(0o755)
        source = root / 'legacy.py'; source.write_bytes(raw); source.chmod(0o644)
        npm = root / 'bin/node_modules/npm'
        files = {'bin/node': b'synthetic-node', 'bin/git': b'synthetic-git',
            'bin/node_modules/npm/package.json': b'{"name":"npm","version":"11.20.0"}',
            'bin/node_modules/npm/bin/npm-cli.js': b'// synthetic',
            'bin/node_modules/npm/node_modules/semver/package.json': b'{"name":"semver","bin":{"semver":"cli.js"}}',
            'bin/node_modules/npm/node_modules/semver/cli.js': b'// harmless synthetic cli',
            'bin/node_modules/npm/private_dir/child.js': b'// synthetic, not sensitive'}
        for name, data in files.items():
            path = root / name; path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data); path.chmod(0o644)
        results = []
        def probe(scenario):
            options = dict(user=65534, group=65534) if os.geteuid() == 0 else {}
            child = subprocess.run([sys.executable, '-B', __file__, '--legacy-child', str(root), scenario, str(source)],
                capture_output=True, timeout=15, **options)
            assert child.returncode == 0
            results.append(json.loads(child.stdout))
        probe('readable')
        link = npm / 'node_modules/.bin/semver'; link.parent.mkdir(); link.symlink_to('../semver/cli.js')
        probe('declared-contained-link'); link.unlink(); link.parent.rmdir()
        denied = npm / 'private_dir'; denied.chmod(0)
        try: probe('unreadable-directory')
        finally: denied.chmod(0o755)
        probe('restored')
        assert [v.get('files') for v in results] == [5, None, 4, 5]
        assert results[0]['treeSHA256'] == results[3]['treeSHA256'] != results[2]['treeSHA256']
        return dict(qualification='HISTORICAL_FUNCTION_SYNTHETIC_FILESYSTEM_ONLY', state='DEFECT_REPRODUCED',
            realNonprivilegedPOSIX=True, executableRepliesAndRepositoryReads='SYNTHETIC',
            legacySourceSHA256=LEGACY_SHA256, results=results, acceptanceGranted=False)


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == '--legacy-child':
        print(json.dumps(legacy_child(*sys.argv[2:]))); sys.exit(0)
    try:
        print(json.dumps(historical_reproduction(), sort_keys=True))
    except BaseException:
        print(json.dumps(dict(state='INCOMPLETE', reason='SYNTHETIC_REPRODUCTION_FAILED', acceptanceGranted=False)))
        sys.exit(1)
