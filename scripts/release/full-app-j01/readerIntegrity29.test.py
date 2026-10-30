"""Independent bounded reader controls: actual fixture bytes, controlled metadata.

The fully aliased cases prove an observed byte-stability guarantee, not universal
TOCTOU protection or physical native security. Original27/28 tests are separate.
"""
import ast
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import stat
import subprocess
import sys
import tempfile
import threading
from types import ModuleType, SimpleNamespace
from unittest.mock import patch


BASE29 = 'bace116586d58ed955f0a024ca96ae9f4ad9286d'
PINS29 = {
    27: '344c6aea46306943ced4e3afdaa9c7b206b1a2d99d861a8fc1204736ffe97e18',
    28: '256b07a2378dd1cf2dbb3eb43073667bf286b1f7bed88e23d586e5c1498bc0d2',
}


def altered29(info, **changes):
    return SimpleNamespace(**{**{key: getattr(info, key) for key in dir(info) if key.startswith('st_')}, **changes})


def frozen29(root, number):
    path = 'scripts/release/full-app-j01/replay'+str(number)+'.py'
    child = subprocess.run(['git', '--no-replace-objects', 'show', BASE29+':'+path],
                           cwd=root, capture_output=True, timeout=30)
    assert child.returncode == 0 and hashlib.sha256(child.stdout).hexdigest() == PINS29[number]
    names = {name+str(number) for name in ('require', 'same', 'cross', 'regular', 'bytes')}
    nodes = [node for node in ast.parse(child.stdout).body if isinstance(node, ast.FunctionDef) and node.name in names]
    assert len(nodes) == 5 and {node.name for node in nodes} == names and all(not node.decorator_list for node in nodes)
    module = ModuleType('frozen_reader'+str(number))
    module.__dict__.update(Path=Path, os=os, stat=stat)
    exec(compile(ast.Module(body=nodes, type_ignores=[]), '<authenticated-frozen-reader>', 'exec'), module.__dict__)
    return module


def real_alias29(module, number, target, original, mode, phase=1, race=False):
    """Change real backing bytes after32 consumed bytes; freeze both API domains."""
    named = target.lstat()
    real_read, real_open, real_fstat, real_lseek, real_lstat = os.read, os.open, os.fstat, os.lseek, Path.lstat
    opened = None
    descriptor = None
    reads = 0
    current_phase = 1
    mutated = False
    signal, done = threading.Event(), threading.Event()
    worker_error = []

    def apply():
        nonlocal mutated
        if mode == 'initial-byte':
            with target.open('r+b') as stream:
                stream.write(b'X')
        elif mode == 'remaining-byte':
            with target.open('r+b') as stream:
                stream.seek(len(original)-1); stream.write(b'X')
        elif mode == 'truncate':
            target.write_bytes(b'short')
        elif mode == 'grow':
            target.write_bytes(original+b'extra')
        else:
            raise AssertionError('R29_UNKNOWN_FIXTURE')
        mutated = True

    def worker():
        try:
            if not signal.wait(5):
                raise AssertionError('R29_RACE_TIMEOUT')
            apply()
        except BaseException as error:
            worker_error.append(type(error).__name__)
        finally:
            done.set()

    thread = threading.Thread(target=worker) if race else None

    def open_source(path, flags, *args, **kwargs):
        nonlocal descriptor, opened
        fd = real_open(path, flags, *args, **kwargs)
        if Path(path) == target:
            descriptor, opened = fd, real_fstat(fd)
        return fd

    def fstat_source(fd):
        return opened if fd == descriptor else real_fstat(fd)

    def lstat_source(path, *args, **kwargs):
        return named if path == target else real_lstat(path, *args, **kwargs)

    def seek_source(fd, offset, whence):
        nonlocal current_phase, reads
        result = real_lseek(fd, offset, whence)
        if fd == descriptor:
            assert offset == 0 and whence == os.SEEK_SET
            current_phase, reads = 2, 0
        return result

    def read_source(fd, size):
        nonlocal reads
        if fd != descriptor:
            return real_read(fd, size)
        assert 0 < size <= 1024*1024
        block = real_read(fd, min(size, 32))
        reads += 1
        if current_phase == phase and reads == 1:
            if race:
                signal.set(); assert done.wait(5) and not worker_error
            else:
                apply()
        return block

    if thread:
        thread.start()
    result = None
    refused = False
    try:
        with patch.object(module.os, 'open', open_source), patch.object(module.os, 'read', read_source), \
             patch.object(module.os, 'fstat', fstat_source), patch.object(module.os, 'lseek', seek_source), \
             patch.object(Path, 'lstat', lstat_source):
            try:
                result = getattr(module, 'bytes'+str(number))(target)
            except (ValueError, OSError):
                refused = True
    finally:
        if thread:
            signal.set(); thread.join(5)
            assert not thread.is_alive() and not worker_error
    assert mutated
    actual = target.read_bytes()
    assert actual != original and (mode in ('truncate', 'grow') or len(actual) == len(original))
    return dict(refused=refused, returnedOriginal=result == original,
                returnedBacking=result == actual, mutationApplied=mutated,
                metadataAliasedInBothDomains=True, realBackingChanged=True,
                phase=phase, concurrentThread=race)


def main():
    assert not sys.flags.optimize
    root = Path(__file__).resolve().parents[3]
    passed = refused = boundaries = 0

    def case(number, label, action, reject=False):
        nonlocal passed, refused
        if reject:
            try:
                action()
            except (ValueError, OSError):
                refused += 1
            else:
                raise AssertionError('R29_EXPECTED_REFUSAL')
        else:
            assert action() is not False
            passed += 1
        print(json.dumps(dict(releaseNumber=number, case=label, refused=reject, passExpected=True)), flush=True)

    with tempfile.TemporaryDirectory(prefix='reader29-') as temporary:
        directory = Path(temporary)
        target = directory/'fixture.py'
        original = b'public synthetic integrity fixture\n'*4096
        for number in PINS29:
            source = Path(__file__).with_name('replay'+str(number)+'.py')
            spec = importlib.util.spec_from_file_location('current_reader'+str(number), source)
            module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
            read = getattr(module, 'bytes'+str(number))
            same = getattr(module, 'same'+str(number))
            regular = getattr(module, 'regular'+str(number))
            frozen = frozen29(root, number)

            def restore():
                target.write_bytes(original)
                assert target.read_bytes() == original and read(target) == original

            restore()
            case(number, 'unchanged-full-read', lambda: read(target) == original)
            target.write_bytes(b'')
            case(number, 'unchanged-empty-read', lambda: read(target) == b'')
            restore()
            named = target.lstat()
            case(number, 'atime-only-positive', lambda: same(named, altered29(named, st_atime=0, st_atime_ns=0)))
            for bit in (stat.S_ISUID, stat.S_ISGID, stat.S_ISVTX):
                case(number, 'suspicious-mode-'+str(bit), lambda b=bit: regular(altered29(named, st_mode=named.st_mode|b), len(original)), True)
            case(number, 'reparse-refusal', lambda: regular(altered29(named, st_file_attributes=1024), len(original)), True)
            case(number, 'hardlink-refusal', lambda: regular(altered29(named, st_nlink=2), len(original)), True)
            case(number, 'bound-refusal', lambda: read(target, 31), True)

            # This separately demonstrates the old conditional gap; it does not
            # explain the suppressed historical Windows exception.
            before = real_alias29(frozen, number, target, original, 'initial-byte')
            assert not before['refused'] and before['returnedOriginal'] and not before['returnedBacking']
            print(json.dumps(dict(releaseNumber=number, case='frozen-conditional-gap',
                status='FROZEN_READER_ACCEPTED_CHANGED_BACKING', **before,
                qualification='CONDITIONAL_MODEL_NOT_HISTORICAL_FAILURE_DIAGNOSIS')), flush=True)
            restore()
            passed += 1
            # A previously unconsumed byte changing before either observation
            # can yield two identical complete reads. Record that finite claim
            # boundary explicitly; do not claim to detect an unobserved past.
            coherent = real_alias29(module, number, target, original, 'remaining-byte')
            assert not coherent['refused'] and coherent['returnedBacking'] and not coherent['returnedOriginal']
            print(json.dumps(dict(releaseNumber=number,
                case='unconsumed-byte-coherent-observation-boundary', **coherent)), flush=True)
            case(number, 'coherent-observation-exact-restoration', restore)
            boundaries += 1
            last_observation = real_alias29(module, number, target, original, 'initial-byte', phase=2)
            assert not last_observation['refused'] and last_observation['returnedOriginal'] and not last_observation['returnedBacking']
            print(json.dumps(dict(releaseNumber=number,
                case='last-observation-consumed-byte-race-boundary', **last_observation,
                qualification='FINITE_TWO_READ_OBSERVATION_LIMIT_NOT_A_DETECTION_PASS')), flush=True)
            case(number, 'last-observation-boundary-exact-restoration', restore)
            boundaries += 1
            for phase, mode, race in ((1, 'initial-byte', False),
                                      (1, 'truncate', False), (1, 'grow', False),
                                      (2, 'remaining-byte', False),
                                      (2, 'truncate', False), (2, 'grow', False),
                                      (1, 'initial-byte', True)):
                observation = real_alias29(module, number, target, original, mode, phase, race)
                assert observation['refused'], 'R29_ALIAS_MUTATION_ACCEPTED'
                refused += 1
                print(json.dumps(dict(releaseNumber=number,
                    case='aliased-phase'+str(phase)+'-'+mode+('-thread' if race else ''),
                    **observation)), flush=True)
                case(number, 'exact-restoration-after-alias', restore)

            real_read, real_seek, real_lstat = os.read, os.lseek, Path.lstat
            for stage in ('first-read', 'verification-read', 'verification-seek', 'verification-incomplete'):
                verification = False
                def seek(fd, offset, whence):
                    nonlocal verification
                    if stage == 'verification-seek': raise OSError('synthetic')
                    verification = True
                    return real_seek(fd, offset, whence)
                def failing_read(fd, size):
                    if stage == 'first-read' or stage == 'verification-read' and verification:
                        raise OSError('synthetic')
                    if stage == 'verification-incomplete' and verification:
                        return b''
                    return real_read(fd, size)
                with patch.object(module.os, 'read', failing_read), patch.object(module.os, 'lseek', seek):
                    case(number, stage+'-failure', lambda: read(target), True)
                case(number, stage+'-exact-restoration', restore)

            # Changed pathname identity and parent identity remain independent of
            # the two byte passes, including substitution with matching bytes.
            for mode in ('pathname-substitution', 'parent-substitution', 'missing-parent'):
                calls = 0
                def substituted(path, *args, **kwargs):
                    nonlocal calls
                    info = real_lstat(path, *args, **kwargs)
                    if path == (target if mode == 'pathname-substitution' else directory):
                        calls += 1
                        if mode == 'missing-parent': raise OSError('synthetic')
                        if calls > 1: return altered29(info, st_ino=info.st_ino+1)
                    return info
                with patch.object(Path, 'lstat', substituted):
                    case(number, mode, lambda: read(target), True)
                case(number, mode+'-exact-restoration', restore)

            # A visible timestamp change must fail without relying on content.
            calls = 0
            def visible(path, *args, **kwargs):
                nonlocal calls
                info = real_lstat(path, *args, **kwargs)
                if path == target:
                    calls += 1
                    if calls > 1: return altered29(info, st_mtime_ns=info.st_mtime_ns+1)
                return info
            with patch.object(Path, 'lstat', visible):
                case(number, 'visible-timestamp-change', lambda: read(target), True)
            case(number, 'final-byte-exact-restoration', restore)

    print(json.dumps(dict(status='PASS', positiveControls=passed, refusals=refused,
        notRun=0, claimBoundaryObservations=boundaries, observedPython=list(sys.version_info[:3]), platform=sys.platform,
        qualification='OBSERVED_SOURCE_READER_STABILITY_REAL_FIXTURES_AND_CONTROLLED_METADATA_NOT_UNIVERSAL_TOCTOU_OR_NATIVE_SECURITY',
        acceptanceGranted=False, release='NO_GO')), flush=True)


if __name__ == '__main__':
    try:
        main()
    except Exception:
        print(json.dumps(dict(status='FAIL', code='R29_READER_INTEGRITY_FAILED',
                              acceptanceGranted=False, release='NO_GO')), flush=True)
        raise SystemExit(1) from None
