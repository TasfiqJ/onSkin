"""Real filesystem and adversarial metadata controls; no historical assertions changed."""
import ast
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import stat
import sys
import tempfile
import subprocess
import time
from types import SimpleNamespace
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('replay27',Path(__file__).with_name('replay27.py'))
replay=importlib.util.module_from_spec(spec);spec.loader.exec_module(replay)


def altered(info, **changes):
    return SimpleNamespace(**{**{name:getattr(info,name) for name in dir(info) if name.startswith('st_')},**changes})



def original_reader_domain27(target, expected):
    # Only these two unchanged helper ASTs execute. The original consumer/main
    # is never invoked here; full pinned consumer execution is a separate job.
    pin = replay.PINNED27[2]
    script = 'scripts/release/full-app-j01/source_consumer26.test.py'
    root = Path(replay.__file__).resolve().parents[3]
    def git(*args):
        child = subprocess.run(['git', '--no-replace-objects', *args], cwd=root, capture_output=True, timeout=30)
        assert child.returncode == 0 and len(child.stdout) <= 1024*1024
        return child.stdout
    raw = git('show', pin['head']+':'+script)
    proof = {'helper_only_not_consumer': True,
        'helper_sha256_match': hashlib.sha256(raw).hexdigest() == pin['consumerSHA256'],
        'helper_git_blob_match': hashlib.sha1(('blob '+str(len(raw))+'\0').encode()+raw).hexdigest() == pin['consumerBlob'],
        'helper_git_mode_match': git('ls-tree', pin['head'], '--', script).decode().strip() == '100644 blob '+pin['consumerBlob']+'\t'+script,
        'helper_pinned_tree_match': git('rev-parse', pin['head']+'^{tree}').decode().strip() == pin['tree']}
    assert all(proof.values())
    nodes = [node for node in ast.parse(raw).body if isinstance(node, ast.FunctionDef) and node.name in ('require26', 'bytes26')]
    assert len(nodes) == 2 and {node.name for node in nodes} == {'require26', 'bytes26'} and all(not node.decorator_list for node in nodes)
    namespace = dict(Path=Path, os=os, stat=stat)
    exec(compile(ast.Module(body=nodes, type_ignores=[]), '<authenticated-original-reader-helpers>', 'exec'), namespace)
    proof['unchanged_original_helper_asts'] = True
    # Finish all setup before measurement. This leaves bytes unchanged and gives
    # Windows creation/change metadata an opportunity to represent distinct times.
    setup = target.lstat(); time.sleep(0.02)
    os.utime(target, ns=(setup.st_atime_ns, setup.st_mtime_ns+1000000))
    before = target.lstat()
    fields = ('st_dev', 'st_ino', 'st_mode', 'st_nlink', 'st_size', 'st_mtime_ns', 'st_ctime_ns', 'st_birthtime_ns')
    with target.open('rb') as stream:
        opened = os.fstat(stream.fileno())
        observed = stream.read(len(expected)+1)
        read_finished = os.fstat(stream.fileno())
        after_read = target.lstat()
        original_returned = original_refused = False
        try:
            original_returned = namespace['bytes26'](target) == expected
        except ValueError as error:
            assert error.args == ('R26_REPLAY_CHANGED',)
            original_refused = True
        current_returned = replay.bytes27(target) == expected
        finished = os.fstat(stream.fileno())
        after = target.lstat()
    assert replay.same27(before, after_read) and replay.same27(before, after)
    assert replay.same27(opened, read_finished) and replay.same27(opened, finished)
    assert observed == expected and current_returned and replay.bytes27(target) == expected
    assert replay.same27(after, target.lstat())
    for field in fields:
        available = all(hasattr(info, field) for info in (before, after, opened, finished))
        proof[field+'_available'] = available
        proof['path_before_after_'+field+'_equal'] = available and getattr(before, field) == getattr(after, field)
        proof['handle_before_after_'+field+'_equal'] = available and getattr(opened, field) == getattr(finished, field)
        proof['path_handle_before_'+field+'_equal'] = available and getattr(before, field) == getattr(opened, field)
        proof['path_handle_after_'+field+'_equal'] = available and getattr(after, field) == getattr(finished, field)
    proof['regular_type_equal'] = stat.S_ISREG(before.st_mode) and stat.S_ISREG(opened.st_mode)
    proof['execute_bits_equal'] = before.st_mode & 0o111 == opened.st_mode & 0o111
    proof['nonexecute_mode_equal'] = before.st_mode & ~0o111 == opened.st_mode & ~0o111
    stamp_fields = ('st_dev', 'st_ino', 'st_size', 'st_mtime_ns', 'st_ctime_ns')
    compatible = all(getattr(before, field) == getattr(opened, field) == getattr(finished, field) == getattr(after, field) for field in stamp_fields)
    assert original_returned == compatible and original_refused == (not compatible)
    proof.update(original_stamp_compatible=compatible, original_helper_returned_expected_bytes=original_returned,
        original_helper_refused_R26_REPLAY_CHANGED=original_refused, current_reader_returned_expected_bytes=current_returned,
        fixture_bytes_unchanged=True, path_metadata_stable_excluding_only_atime=True, handle_metadata_stable_excluding_only_atime=True)
    assert all(type(value) is bool for value in proof.values())
    print(json.dumps(proof, sort_keys=True), flush=True)


def main():
    if sys.flags.optimize: raise ValueError('R27_ASSERTIONS_REQUIRED')
    passed=refused=not_run=0
    class Unavailable(Exception): pass
    def case(label, action, reject=False):
        nonlocal passed,refused,not_run
        try: action()
        except Unavailable:
            not_run+=1
            print(json.dumps(dict(case=label,notRun=True,osPreventedFixtureMutation=True)))
            return False
        except (ValueError,OSError):
            if not reject: raise AssertionError(label) from None
            refused+=1
        else:
            if reject: raise AssertionError(label)
            passed+=1
        print(json.dumps(dict(case=label,passExpected=True,refused=reject)),flush=True)
        return True
    with tempfile.TemporaryDirectory(prefix='replay27-reader-') as directory:
        root=Path(directory);target=root/'plain.py';original=b'public synthetic reader fixture\n'*4096
        target.write_bytes(original)
        def equal_read(): assert replay.bytes27(target)==original
        case('unchanged-real-filesystem',equal_read)
        case('authenticated-original-helper-domain-observation',lambda:original_reader_domain27(target,original))
        for suffix in ('.exe','.com','.cmd','.bat','.txt','.py','.dll','.ps1'):
            path=root/('mode'+suffix);path.write_bytes(original)
            case('unchanged-mode'+suffix,lambda p=path: replay.require27(replay.bytes27(p)==original,'R27_TEST'))
        case('size-bound',lambda:replay.bytes27(target,1),True)
        case('missing-source',lambda:replay.bytes27(root/'missing'),True)
        case('directory-as-source',lambda:replay.bytes27(root),True)
        link=root/'hardlink';os.link(target,link)
        case('real-hardlink',lambda:replay.bytes27(target),True);link.unlink()
        case('hardlink-exact-restoration',equal_read)
        link=root/'symlink'
        try:os.symlink(target,link)
        except OSError:
            not_run+=1;print(json.dumps(dict(case='real-symlink',notRun=True)))
        else:
            case('real-symlink',lambda:replay.bytes27(link),True);link.unlink()
        before=target.lstat()
        for field in ('st_dev','st_ino','st_mode','st_nlink','st_size','st_mtime_ns','st_ctime_ns'):
            case('same-domain-'+field,lambda f=field:replay.require27(not replay.same27(before,altered(before,**{f:getattr(before,f)^1})),'R27_TEST'))
        if hasattr(before,'st_birthtime_ns'):
            case('same-domain-birthtime',lambda:replay.require27(not replay.same27(before,altered(before,st_birthtime_ns=before.st_birthtime_ns+1)),'R27_TEST'))
        case('only-access-time-is-not-mutation',lambda:replay.require27(replay.same27(before,altered(before,st_atime=0,st_atime_ns=0)),'R27_TEST'))
        with target.open('rb') as stream:opened=os.fstat(stream.fileno())
        for field in ('st_dev','st_ino','st_nlink','st_size','st_mtime_ns'):
            case('cross-domain-'+field,lambda f=field:replay.require27(not replay.cross27(target,before,altered(opened,**{f:getattr(opened,f)^1})),'R27_TEST'))
        if os.name=='nt' and hasattr(before,'st_birthtime_ns'):
            case('windows-ctime-domain-independent',lambda:replay.require27(replay.cross27(target,before,altered(opened,st_ctime_ns=opened.st_ctime_ns+1)),'R27_TEST'))
            case('windows-birthtime-mismatch',lambda:replay.require27(not replay.cross27(target,before,altered(opened,st_birthtime_ns=opened.st_birthtime_ns+1)),'R27_TEST'))
        else:
            case('comparable-ctime-mismatch',lambda:replay.require27(not replay.cross27(target,before,altered(opened,st_ctime_ns=opened.st_ctime_ns+1)),'R27_TEST'))
        original_fstat=os.fstat
        calls=0
        def changed_handle(fd):
            nonlocal calls
            calls+=1;info=original_fstat(fd)
            return altered(info,st_ctime_ns=info.st_ctime_ns+1) if calls==2 else info
        with patch.object(replay.os,'fstat',side_effect=changed_handle):
            case('same-handle-ctime-mutation',lambda:replay.bytes27(target),True)
        original_read=os.read
        calls=0
        def incomplete(fd,size):
            nonlocal calls
            calls+=1
            return original_read(fd,min(size,32)) if calls==1 else b''
        with patch.object(replay.os,'read',side_effect=incomplete):case('incomplete-read',lambda:replay.bytes27(target),True)
        for kind in ('truncate','grow','same-size','substitute'):
            calls=0
            mutation_applied=False
            def mutate(fd,size):
                nonlocal calls,mutation_applied
                block=original_read(fd,min(size,32));calls+=1
                if calls==1:
                    try:
                        if kind=='substitute':
                            target.rename(root/'replaced');target.write_bytes(original)
                        elif kind=='truncate':target.write_bytes(b'short')
                        elif kind=='grow':target.write_bytes(original+b'extra')
                        else:target.write_bytes(b'X'+original[1:])
                    except OSError:raise Unavailable() from None
                    mutation_applied=True
                return block
            with patch.object(replay.os,'read',side_effect=mutate):
                completed=case('real-midread-'+kind,lambda:replay.bytes27(target),True)
            if completed:assert mutation_applied
            target.write_bytes(original)
            if (root/'replaced').exists():(root/'replaced').unlink()
            case('exact-restoration-'+kind,equal_read)
        original_lstat=Path.lstat
        def missing_parent(path,*args,**kwargs):
            if path==root:raise OSError()
            return original_lstat(path,*args,**kwargs)
        with patch.object(Path,'lstat',missing_parent):case('incomplete-parent-traversal',lambda:replay.bytes27(target),True)
        case('final-complete-restoration',equal_read)
        assert hashlib.sha256(target.read_bytes()).digest()==hashlib.sha256(original).digest()
    print(json.dumps(dict(status='PASS',positiveControls=passed,refusals=refused,notRun=not_run,
        qualification='REAL_LOCAL_FILESYSTEM_AND_SYNTHETIC_METADATA_NOT_HISTORICAL_EXECUTION',acceptanceGranted=False,release='NO_GO')))


if __name__=='__main__':
    try:main()
    except Exception:
        print(json.dumps(dict(status='FAIL',code='R27_READER_CONTROL_FAILED',acceptanceGranted=False,release='NO_GO')))
        raise SystemExit(1) from None
