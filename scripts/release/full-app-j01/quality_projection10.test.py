"""Real unchanged Phase4 producer controls; small source fixtures, not a full checkout."""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[3]
PRODUCER = 'scripts/phase4/build-source-worklist.mjs'
OUTPUTS = ['docs/phase-4/generated/source-worklist.json', 'docs/phase-4/generated/source-worklist.md']


def main():
    assert not subprocess.check_output(['git', 'status', '--porcelain=v1'], cwd=ROOT).strip(), 'clean source required'
    original = json.loads((ROOT/OUTPUTS[0]).read_bytes())
    paths = {s['path'] for item in original['items'] for s in item['sourcePaths']}
    paths.update([PRODUCER, *OUTPUTS, 'scripts/phase9/lib.mjs', 'scripts/launch/contract.mjs',
                  'scripts/launch/governed-evidence-chain.mjs', 'scripts/phase9/release-qa-integrity.mjs',
                  'scripts/e2e/cat07-committed-evidence.mjs', 'scripts/e2e/evidence-diagnostic-hygiene.mjs',
                  'scripts/e2e/human-e2e-manifest-render.mjs'])
    total = sum((ROOT/p).stat().st_size for p in paths)
    assert shutil.disk_usage(ROOT).free > total*4+128*1024*1024, 'fixture headroom unavailable'
    def check(root, name, expected):
        argv = ['node', PRODUCER, '--strict', '--check']
        p = subprocess.run(argv, cwd=root, capture_output=True)
        print(json.dumps(dict(case=name, argv=argv, cwd=str(root), exit=p.returncode,
            expected_exit=expected, stdout=p.stdout.decode(), stderr=p.stderr.decode())), flush=True)
        assert p.returncode == expected
    check(ROOT, 'canonical-current', 0)
    with tempfile.TemporaryDirectory(prefix='onskin-projection10-') as temporary:
        fixture = Path(temporary)
        for path in paths:
            target = fixture/path; target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes((ROOT/path).read_bytes())
        def git(*args):
            return subprocess.check_output(['git', '-c', 'core.autocrlf=false',
                '-c', 'user.name=Release10 fixture', '-c', 'user.email=fixture@example.invalid',
                *args], cwd=fixture, stderr=subprocess.PIPE)
        git('init', '--quiet'); git('add', '--all'); git('commit', '--quiet', '-m', 'authenticated bounded source')
        assert (fixture/PRODUCER).read_bytes() == (ROOT/PRODUCER).read_bytes()
        check(fixture, 'fixture-current-real-producer', 0)
        for path in OUTPUTS:
            target = fixture/path; authentic = target.read_bytes()
            try:
                if path.endswith('.json'):
                    value = json.loads(authentic); value['items'][0]['status'] = 'approved'
                    target.write_bytes((json.dumps(value)+'\n').encode())
                else: target.write_bytes(authentic+b'\nMalicious approval\n')
                check(fixture, 'output-tampered:'+path, 1)
            finally: target.write_bytes(authentic)
            check(fixture, 'output-restored:'+path, 0)
        target = fixture/'.github/workflows/quality.yml'; authentic = target.read_bytes()
        try:
            target.write_bytes(authentic+b'\n# source identity negative control\n')
            git('add', '.github/workflows/quality.yml'); git('commit', '--quiet', '-m', 'negative input identity')
            assert not git('status', '--porcelain=v1').strip()
            check(fixture, 'clean-committed-source-input-tampered', 1)
        finally:
            target.write_bytes(authentic)
            git('add', '.github/workflows/quality.yml'); git('commit', '--quiet', '-m', 'restore authentic input')
        check(fixture, 'clean-committed-source-input-restored', 0)
    check(ROOT, 'canonical-restored', 0)
    print(json.dumps(dict(passed=True, current=0, tampered=1, restored=0,
        producer_sha256=hashlib.sha256((ROOT/PRODUCER).read_bytes()).hexdigest(),
        qualification='BOUNDED_SOURCE_FIXTURE_NOT_INDEPENDENT_COMPLETE_CHECKOUT')))


if __name__ == '__main__':
    main()
