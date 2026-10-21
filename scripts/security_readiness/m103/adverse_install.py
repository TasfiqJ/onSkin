"""Adverse checks against a private installed candidate; restore every byte."""
import argparse, pathlib, subprocess
from candidate import SHA, derive, require, verify


def exercise(root):
    manifest=verify(root);site=root/'venv/lib/python3.12/site-packages'
    metadata=site/'semgrep-1.181.0.dist-info/METADATA';raw=metadata.read_bytes()
    require(b'Requires-Dist: mcp==1.30.0' in raw,'INSTALLED_DERIVATIVE_METADATA')
    try:
        metadata.write_bytes(raw.replace(b'Requires-Dist: mcp==1.30.0',b'Requires-Dist: mcp==1.29.0'))
        result=subprocess.run([str(root/'venv/bin/python'),'-I','-B','-m','pip','check'],capture_output=True)
        require(result.returncode!=0,'HIDDEN_CONSTRAINT_MISMATCH_ACCEPTED')
        try:verify(root)
        except ValueError:pass
        else:raise AssertionError('installed metadata drift accepted')
    finally:metadata.write_bytes(raw)
    launcher=root/'venv/bin/semgrep';raw=launcher.read_bytes()
    try:
        launcher.write_bytes(raw+b'\n# synthetic drift\n')
        try:verify(root)
        except ValueError:pass
        else:raise AssertionError('entrypoint drift accepted')
    finally:launcher.write_bytes(raw)
    for path in [next((root/'venv').rglob('*.pyc')),root/'venv/pyvenv.cfg']:
        raw=path.read_bytes()
        try:
            path.write_bytes(raw+b'\nsynthetic-drift\n')
            try:verify(root)
            except ValueError:pass
            else:raise AssertionError('cache or launch policy drift accepted')
        finally:path.write_bytes(raw)
    interpreter=root/'venv/bin/python';link=interpreter.readlink()
    try:
        interpreter.unlink();interpreter.symlink_to('/bin/false')
        try:verify(root)
        except ValueError:pass
        else:raise AssertionError('interpreter link drift accepted')
    finally:interpreter.unlink();interpreter.symlink_to(link)
    semgrep=next(r for r in manifest['wheels'] if r['name']=='semgrep')
    original=(root/'originals'/semgrep['filename']).read_bytes()
    require(SHA(original)==semgrep['original_sha256'],'ORIGINAL_DRIFT')
    first,proof=derive(original);second,_=derive(original)
    require(first==second and SHA(first)==semgrep['install_sha256'],'DERIVATIVE_NOT_REPRODUCIBLE')
    for path,digest in proof['native_cores'].items():
        # .data launchers are pip-rewritten; upstream native core and libraries
        # live under semgrep/bin and must be exact original member bytes.
        if path.startswith('semgrep/bin/'):require(SHA((site/path).read_bytes())==digest,'UPSTREAM_NATIVE_BYTES_CHANGED')
    wheel=root/'wheelhouse'/semgrep['filename'];raw=wheel.read_bytes()
    try:
        wheel.write_bytes(raw[:-1]+bytes([raw[-1]^1]))
        try:verify(root)
        except ValueError:pass
        else:raise AssertionError('wheel drift accepted')
    finally:wheel.write_bytes(raw)
    verify(root)
    print('PASS: deterministic derivative, unchanged installed native bytes, real pip mismatch refusal, metadata/launcher/wheel drift refusal; admission NONE.')


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('private_candidate',type=pathlib.Path);a=p.parse_args();exercise(a.private_candidate)
