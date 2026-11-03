"""C45 historical execution: authenticated fixtures, retained attempts, bounded recovery.

Only a successful NORMAL original44 --historical invocation, subsequently parsed by
the unchanged authenticated original44 reader, qualifies as a complete invocation.
Diagnostic or resumed individual stages never stand in for that requirement.
"""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import shutil
import signal
import subprocess
import sys
import time
import traceback
from types import ModuleType
import urllib.error

BASE = '3865cdd8f610d2c715bd1f3f304ab3c756ca4fbc'
TREE = 'c02c58151aa2c23090712494bb8b758f1feb7dab'
PREFIX = 'scripts/release/full-app-j01/'
ORIGINAL44_SHA = 'faa8527c97f14ded526b83e50eb6da5c93ef7f7e4545125a0f3f0d9d9545987a'
NEUTRAL_SHA = '944c04283b834e5f20bdfcbf95c265c7af57f8f4754952b4353dee5f8d8952dd'
RETRYABLE_HTTP = {429, 500, 502, 503, 504}
MAX_ATTEMPTS = 3
OPAQUE_REFUSALS = {
    'R'+str(number)+'_'+suffix
    for number in (44, 41, 40, 39, 38, 37, 36, 35, 34, 33, 32)
    for suffix in ('EXECUTION_INCOMPLETE', 'HISTORICAL_CHILD_EXIT', 'READONLY_CHILD_EXIT',
                   'HISTORICAL_TIMEOUT_OR_OUTPUT')
} | {'R32_CHILD_EXIT', 'R29_PUBLIC_READ_INCOMPLETE'}


def need(value, code):
    if not value:
        raise ValueError('C45H_'+code)


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def regular(path, limit=8*1024*1024):
    path = Path(path)
    for parent in path.parents:
        info = parent.lstat()
        need(parent.is_dir() and not parent.is_symlink() and
             not getattr(info, 'st_file_attributes', 0) & 1024, 'REGULAR_PARENT')
    before = path.lstat()
    need(path.is_file() and not path.is_symlink() and before.st_nlink == 1 and
         not getattr(before, 'st_file_attributes', 0) & 1024 and before.st_size <= limit, 'REGULAR_FILE')
    raw = path.read_bytes()
    after = path.lstat()
    need((before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns, before.st_ctime_ns) ==
         (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns, after.st_ctime_ns), 'CHANGED_READ')
    return raw


def document(raw):
    def pairs(items):
        value = {}
        for key, item in items:
            need(key not in value, 'DUPLICATE_FIELD')
            value[key] = item
        return value
    return json.loads(raw, object_pairs_hook=pairs,
                      parse_constant=lambda _: (_ for _ in ()).throw(ValueError('C45H_NONFINITE')))


def write_json(path, value):
    Path(path).write_bytes((json.dumps(value, indent=2, sort_keys=True)+'\n').encode())


def external_evidence(root, evidence):
    root, evidence = Path(root).resolve(), Path(evidence).resolve()
    need(evidence != root and not evidence.is_relative_to(root), 'EVIDENCE_INSIDE_FIXTURE')
    return evidence


def git(root, *args):
    return subprocess.check_output(['git', '--no-replace-objects', *args], cwd=root,
                                   stderr=subprocess.PIPE)


def original44(root):
    path = Path(root)/PREFIX/'main_integration44.py'
    raw = regular(path)
    need(digest(raw) == ORIGINAL44_SHA, 'ORIGINAL44_IDENTITY')
    module = ModuleType('authenticated_original44_neutral_reader_not_current45_acceptance')
    module.__file__ = str(path)
    exec(compile(raw, str(path), 'exec'), module.__dict__)
    return module


def fixture_identity(root):
    root = Path(root).resolve()
    need(git(root, 'rev-parse', 'HEAD').strip().decode() == BASE and
         git(root, 'rev-parse', 'HEAD^{tree}').strip().decode() == TREE, 'FIXTURE_PIN')
    need(git(root, 'remote', 'get-url', 'origin').strip().decode().removesuffix('.git') ==
         'https://github.com/TasfiqJ/onSkin', 'ORIGIN')
    module = original44(root)
    module.authenticate_parent()
    module.primitives().helpers().full29_store()
    index, count = module.snapshot(BASE)
    locks = {}
    for path in ('package.json', 'package-lock.json', 'apps/mobile/package.json'):
        raw = regular(root/path)
        need(raw == git(root, 'show', BASE+':'+path), 'LOCK_INPUT')
        locks[path] = dict(bytes=len(raw), sha256=digest(raw))
    return dict(root=str(root), head=BASE, tree=TREE, trackedBlobs=count,
                indexBytes=len(index), indexSHA256=digest(index), locks=locks,
                original44SHA256=ORIGINAL44_SHA)


def selected_fixture_identity(root, trusted_fixture):
    """Neutral read-only store/index/whole-tree guard before tracing older code."""
    root = Path(root).resolve()
    trusted_fixture = Path(trusted_fixture).resolve()
    trusted = trusted_fixture/PREFIX/'check.py'
    raw = regular(trusted)
    need(digest(raw) == NEUTRAL_SHA, 'NEUTRAL_IDENTITY')
    authority = ModuleType('authenticated_pr45_ancestry_store_only')
    authority.__file__ = str(trusted)
    exec(compile(raw, str(trusted), 'exec'), authority.__dict__)
    authority.full29_store()
    need(git(trusted_fixture, 'rev-parse', 'HEAD').strip().decode() == BASE and
         git(trusted_fixture, 'rev-parse', 'HEAD^{tree}').strip().decode() == TREE, 'TRUSTED_FIXTURE_PIN')
    guard = ModuleType('authenticated_neutral_store_helpers_only')
    guard.__file__ = str(root/PREFIX/'check.py')
    exec(compile(raw, str(trusted), 'exec'), guard.__dict__)
    guard.full29_store()
    head = git(root, 'rev-parse', 'HEAD').strip().decode()
    # A genuine older single-branch clone need not contain its future PR45 base.
    git(trusted_fixture, 'merge-base', '--is-ancestor', head, BASE)
    tree = guard.tree29(head)
    index = git(root, 'ls-files', '--stage', '-z')
    need(index == b''.join((mode+' '+oid+' 0\t'+path+'\0').encode()
         for path, (mode, oid) in tree.items()), 'SELECTED_INDEX')
    need(all(line.startswith(b'H ') for line in git(root, 'ls-files', '-v', '-z').split(b'\0') if line),
         'SELECTED_INDEX_FLAGS')
    need(not git(root, 'status', '--porcelain=v1', '--untracked-files=all', '-z'), 'SELECTED_DIRTY')
    count = guard.working29_guard(tree)
    return dict(root=str(root), head=head, tree=git(root, 'rev-parse', 'HEAD^{tree}').strip().decode(),
                trackedBlobs=count, indexSHA256=digest(index))


def tools_identity(node, npm):
    """Hash actual executable/CLI/package inputs; version strings are insufficient."""
    node, npm = Path(node).resolve(), Path(npm).resolve()
    package = npm.parent.parent
    need(npm.name == 'npm-cli.js' and (package/'package.json').is_file(), 'NPM_PACKAGE')
    def file_hash(path, limit=256*1024*1024):
        before = path.lstat()
        need(path.is_file() and not path.is_symlink() and before.st_nlink == 1 and
             not getattr(before, 'st_file_attributes', 0) & 1024 and before.st_size <= limit, 'TOOL_FILE')
        sha = hashlib.sha256()
        with path.open('rb') as stream:
            for block in iter(lambda: stream.read(1024*1024), b''):
                sha.update(block)
        after = path.lstat()
        need((before.st_ino, before.st_size, before.st_mtime_ns, before.st_ctime_ns) ==
             (after.st_ino, after.st_size, after.st_mtime_ns, after.st_ctime_ns), 'TOOL_CHANGED_READ')
        return dict(bytes=before.st_size, sha256=sha.hexdigest())
    rows, total = [], 0
    for path in sorted(package.rglob('*')):
        need(not path.is_symlink() and not getattr(path.lstat(), 'st_file_attributes', 0) & 1024, 'TOOL_LINK')
        if path.is_file() and path.suffix in ('.js', '.cjs', '.mjs', '.json'):
            row = dict(path=str(path.relative_to(package)).replace('\\', '/'), **file_hash(path, 16*1024*1024))
            rows.append(row)
            total += row['bytes']
            need(len(rows) <= 15000 and total <= 128*1024*1024, 'TOOL_PACKAGE_LIMIT')
    need(rows, 'TOOL_PACKAGE_EMPTY')
    return dict(nodePath=str(node), node=file_hash(node), npmCLIPath=str(npm), npmCLI=file_hash(npm),
                npmPackagePath=str(package), npmPackageFiles=len(rows), npmPackageBytes=total,
                npmPackageSHA256=digest(json.dumps(rows, sort_keys=True, separators=(',', ':')).encode()))


def verify_receipt(row, expected_command=None, expected_exit=None):
    need(type(row) is dict and type(row.get('exit')) is int and
         type(row.get('expectedExit')) is int and type(row.get('bytes')) is int and
         type(row.get('command')) is list and row['command'] and
         all(type(v) is str and v for v in row['command']), 'RECEIPT_SCHEMA')
    if expected_command is not None:
        need(row['command'] == expected_command, 'COMMAND_CHANGED')
    if expected_exit is not None:
        need(row['expectedExit'] == expected_exit, 'EXPECTED_EXIT_CHANGED')
    raw = regular(Path(row['log']))
    need(len(raw) == row['bytes'] and digest(raw) == row.get('sha256'), 'LOG_CHANGED')
    return raw


class WindowsJob:
    """Admit a suspended child before it can create descendants; drain on close."""
    def __init__(self):
        import ctypes
        from ctypes import wintypes as w
        self.c, self.w = ctypes, w
        self.k = ctypes.WinDLL('kernel32', use_last_error=True)
        class Limits(ctypes.Structure):
            _fields_ = [('processTime', ctypes.c_int64), ('jobTime', ctypes.c_int64),
                        ('flags', w.DWORD), ('minimum', ctypes.c_size_t), ('maximum', ctypes.c_size_t),
                        ('active', w.DWORD), ('affinity', ctypes.c_size_t), ('priority', w.DWORD), ('schedule', w.DWORD)]
        class IO(ctypes.Structure):
            _fields_ = [(name, ctypes.c_uint64) for name in ('readOps', 'writeOps', 'otherOps', 'read', 'write', 'other')]
        class Extended(ctypes.Structure):
            _fields_ = [('limits', Limits), ('io', IO), ('processMemory', ctypes.c_size_t),
                        ('jobMemory', ctypes.c_size_t), ('peakProcess', ctypes.c_size_t), ('peakJob', ctypes.c_size_t)]
        class Accounting(ctypes.Structure):
            _fields_ = [(name, ctypes.c_int64) for name in ('user', 'kernel', 'periodUser', 'periodKernel')]+[
                ('pageFaults', w.DWORD), ('total', w.DWORD), ('active', w.DWORD), ('terminated', w.DWORD)]
        class Thread(ctypes.Structure):
            _fields_ = [('size', w.DWORD), ('usage', w.DWORD), ('id', w.DWORD), ('owner', w.DWORD),
                        ('base', w.LONG), ('delta', w.LONG), ('flags', w.DWORD)]
        self.Accounting, self.Thread = Accounting, Thread
        for name, arguments, result in (
            ('CreateJobObjectW', [ctypes.c_void_p, w.LPCWSTR], w.HANDLE),
            ('SetInformationJobObject', [w.HANDLE, ctypes.c_int, ctypes.c_void_p, w.DWORD], w.BOOL),
            ('AssignProcessToJobObject', [w.HANDLE, w.HANDLE], w.BOOL),
            ('TerminateJobObject', [w.HANDLE, w.UINT], w.BOOL),
            ('QueryInformationJobObject', [w.HANDLE, ctypes.c_int, ctypes.c_void_p, w.DWORD, ctypes.c_void_p], w.BOOL),
            ('CreateToolhelp32Snapshot', [w.DWORD, w.DWORD], w.HANDLE),
            ('Thread32First', [w.HANDLE, ctypes.c_void_p], w.BOOL),
            ('Thread32Next', [w.HANDLE, ctypes.c_void_p], w.BOOL),
            ('OpenThread', [w.DWORD, w.BOOL, w.DWORD], w.HANDLE),
            ('ResumeThread', [w.HANDLE], w.DWORD), ('CloseHandle', [w.HANDLE], w.BOOL)):
            function = getattr(self.k, name)
            function.argtypes, function.restype = arguments, result
        self.handle = self.k.CreateJobObjectW(None, None)
        need(self.handle, 'JOB_CREATE')
        limits = Extended()
        limits.limits.flags = 0x2000  # JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE; no breakaway.
        need(self.k.SetInformationJobObject(self.handle, 9, ctypes.byref(limits), ctypes.sizeof(limits)), 'JOB_LIMITS')

    def admit(self, process):
        need(self.k.AssignProcessToJobObject(self.handle, int(process._handle)), 'JOB_ASSIGN')
        snapshot = self.k.CreateToolhelp32Snapshot(4, 0)
        need(snapshot and snapshot != self.w.HANDLE(-1).value, 'THREAD_SNAPSHOT')
        count = 0
        try:
            thread = self.Thread()
            thread.size = self.c.sizeof(thread)
            found = self.k.Thread32First(snapshot, self.c.byref(thread))
            while found:
                if thread.owner == process.pid:
                    handle = self.k.OpenThread(2, False, thread.id)
                    need(handle, 'THREAD_OPEN')
                    try:
                        need(self.k.ResumeThread(handle) != 0xffffffff, 'THREAD_RESUME')
                        count += 1
                    finally:
                        self.k.CloseHandle(handle)
                found = self.k.Thread32Next(snapshot, self.c.byref(thread))
        finally:
            self.k.CloseHandle(snapshot)
        need(count, 'NO_ADMITTED_THREAD')

    def drain(self):
        need(self.k.TerminateJobObject(self.handle, 1), 'JOB_TERMINATE')
        deadline = time.monotonic()+10
        while True:
            accounting = self.Accounting()
            need(self.k.QueryInformationJobObject(self.handle, 1, self.c.byref(accounting),
                 self.c.sizeof(accounting), None), 'JOB_QUERY')
            if accounting.active == 0:
                return
            need(time.monotonic() < deadline, 'JOB_DRAIN_TIMEOUT')
            time.sleep(0.01)

    def close(self):
        if self.handle:
            self.k.CloseHandle(self.handle)
            self.handle = None


def drain_posix_group(pid):
    try:
        os.killpg(pid, signal.SIGKILL)
    except ProcessLookupError:
        return
    deadline = time.monotonic()+10
    while True:
        # Zombies cannot execute or mutate the fixture and may await container init.
        rows = subprocess.check_output(['ps', '-eo', 'pgid=,stat=']).decode().splitlines()
        active = [row for row in rows if len(row.split()) >= 2 and row.split()[0] == str(pid) and
                  not row.split()[1].startswith('Z')]
        if not active:
            return
        need(time.monotonic() < deadline, 'PROCESS_GROUP_DRAIN_TIMEOUT')
        time.sleep(0.01)


def run_command(args, cwd, env, log, expected=0, timeout=21600):
    need(type(expected) is int and type(args) is list and args and
         all(type(v) is str and v for v in args), 'COMMAND_SCHEMA')
    start = time.monotonic()
    timed_out = False
    job = WindowsJob() if os.name == 'nt' else None
    process = None
    with Path(log).open('xb') as stream:
        try:
            options = dict(creationflags=0x4 | 0x08000000) if job else dict(start_new_session=True)
            process = subprocess.Popen(args, cwd=cwd, env=env, stdout=stream, stderr=subprocess.STDOUT, **options)
            if job:
                job.admit(process)
            try:
                process.wait(timeout=timeout)
            except subprocess.TimeoutExpired:
                timed_out = True
            if job:
                job.drain()
            else:
                drain_posix_group(process.pid)
            process.wait()
        finally:
            if job:
                job.close()  # Also closes admission/descendants on exception.
            elif process is not None:
                drain_posix_group(process.pid)
            if process is not None and process.poll() is None:
                process.kill()
                process.wait()
    raw = regular(Path(log))
    return dict(command=args, cwd=str(cwd), exit=process.returncode, expectedExit=expected,
                timedOut=timed_out, seconds=round(time.monotonic()-start, 3), log=str(log),
                bytes=len(raw), sha256=digest(raw), descendantsDrained=True,
                processControl='WINDOWS_OWNED_JOB' if job else 'POSIX_OWNED_SESSION')


def explicit_refusal(raw):
    """Original semantic/custody refusal outranks any later diagnostic recovery."""
    for line in raw.replace(b'\r', b'').splitlines():
        if not line.startswith(b'{'):
            continue
        try:
            value = document(line)
        except (ValueError, TypeError):
            return 'C45H_ORIGINAL_DOCUMENT_INVALID'
        code = value.get('error') if type(value) is dict else None
        if type(code) is str and re.fullmatch('R[0-9]+_[A-Z0-9_]+', code) and code not in OPAQUE_REFUSALS:
            return code
    return None


def original_refusal(row, fixture):
    raw = verify_receipt(row)
    refusal = explicit_refusal(raw)
    if refusal:
        return refusal
    stage = failure_stage(raw, fixture)
    return explicit_refusal(verify_receipt(stage['row'])) if stage else None


def checkpoint_guard(checkpoint, identity, tools=None):
    need(type(checkpoint) is dict and set(checkpoint) == {'schema', 'identity', 'node', 'npm', 'tools', 'setup'} and
         type(checkpoint['schema']) is int and checkpoint['schema'] == 1 and checkpoint.get('identity') == identity and
         type(checkpoint.get('setup')) is list and len(checkpoint['setup']) == 4, 'CHECKPOINT_IDENTITY')
    rows = checkpoint['setup']
    node, npm = checkpoint.get('node'), checkpoint.get('npm')
    need(type(node) is str and Path(node).is_absolute() and type(npm) is str and
         Path(npm).is_absolute() and Path(npm).name == 'npm-cli.js', 'TOOLCHAIN_PATHS')
    need(type(checkpoint['tools']) is dict and checkpoint['tools'].get('nodePath') == node and
         checkpoint['tools'].get('npmCLIPath') == npm, 'CHECKPOINT_TOOLS')
    if tools is not None:
        need(checkpoint['tools'] == tools, 'TOOLCHAIN_CHANGED')
    commands = [[node, '--version'], [node, npm, '--version'],
                [node, npm, 'ci', '--ignore-scripts=false', '--no-audit', '--no-fund'],
                [node, 'scripts/postinstall.mjs', '--check']]
    for row, command in zip(rows, commands):
        raw = verify_receipt(row, command, 0)
        need(row['exit'] == 0 and row.get('timedOut') is False, 'SETUP_EXIT')
        if command == commands[0]:
            need(raw.strip() == b'v22.21.0', 'NODE_VERSION')
        if command == commands[1]:
            need(raw.strip() == b'11.20.0', 'NPM_VERSION')
    return checkpoint


def tool_candidates(env):
    located = shutil.which('node')
    need(located is not None, 'NODE_PATH')
    node = Path(located).resolve()
    candidates = [node.parent/'node_modules/npm/bin/npm-cli.js',
                  node.parent.parent/'lib/node_modules/npm/bin/npm-cli.js']
    if env.get('APPDATA'):
        candidates.insert(0, Path(env['APPDATA'])/'npm/node_modules/npm/bin/npm-cli.js')
    return node, [p.resolve() for p in candidates if p.is_file()]


def find_tools(env):
    node, candidates = tool_candidates(env)
    npm = next((p.resolve() for p in candidates if p.is_file() and
                subprocess.check_output([str(node), str(p), '--version'], env=env).strip() == b'11.20.0'), None)
    need(npm is not None, 'NPM_VERSION')
    need(subprocess.check_output([str(node), '--version'], env=env).strip() == b'v22.21.0', 'NODE_VERSION')
    return node, npm


def prepare(root, evidence):
    """Resume setup only after full tracked-byte/lock/receipt/toolchain verification."""
    root = Path(root).resolve()
    evidence = external_evidence(root, evidence)
    evidence.mkdir(parents=True, exist_ok=True)
    identity = fixture_identity(root)
    module = original44(root)
    env = module.primitives().clean_environment()
    config = evidence/'empty.npmrc'
    if not config.exists():
        config.write_bytes(b'')
    need(regular(config) == b'', 'NPM_CONFIG')
    env.update(npm_config_userconfig=os.devnull, npm_config_globalconfig=str(config))
    path = evidence/'checkpoint.json'
    if path.exists():
        checkpoint = checkpoint_guard(document(regular(path)), identity)
        node, candidates = tool_candidates(env)
        need(Path(checkpoint['node']).resolve() == node and Path(checkpoint['npm']).resolve() in candidates,
             'TOOLCHAIN_PATH_CHANGED')
        current_tools = tools_identity(checkpoint['node'], checkpoint['npm'])
        checkpoint_guard(checkpoint, identity, current_tools)
        # Installed native patches and actual runtimes are live inputs, not cached success.
        for args, expected in (([checkpoint['node'], '--version'], b'v22.21.0'),
                               ([checkpoint['node'], checkpoint['npm'], '--version'], b'11.20.0')):
            need(subprocess.check_output(args, cwd=root, env=env).strip() == expected, 'TOOLCHAIN_CHANGED')
        live = run_command([checkpoint['node'], 'scripts/postinstall.mjs', '--check'], root, env,
                           evidence/('resume-postinstall-'+str(time.time_ns())+'.log'))
        need(live['exit'] == 0 and not live['timedOut'], 'POSTINSTALL_CHANGED')
        write_json(evidence/('resume-'+str(time.time_ns())+'.json'),
                   dict(identity=identity, livePostinstall=live, checkpointSHA256=digest(regular(path))))
        return module, env, checkpoint
    node, npm = find_tools(env)
    tools_before = tools_identity(node, npm)
    commands = [[str(node), '--version'], [str(node), str(npm), '--version'],
                [str(node), str(npm), 'ci', '--ignore-scripts=false', '--no-audit', '--no-fund'],
                [str(node), 'scripts/postinstall.mjs', '--check']]
    rows = []
    for number, args in enumerate(commands):
        row = run_command(args, root, env, evidence/('setup-'+str(number)+'.log'), timeout=1800)
        rows.append(row)
        need(row['exit'] == 0 and not row['timedOut'], 'SETUP_EXIT')
    tools = tools_identity(node, npm)
    need(tools == tools_before, 'SETUP_TOOL_INPUTS_CHANGED')
    checkpoint = dict(schema=1, identity=identity, node=str(node), npm=str(npm), tools=tools, setup=rows)
    checkpoint_guard(checkpoint, identity, tools)
    need(fixture_identity(root) == identity, 'SETUP_SOURCE_CHANGED')
    write_json(path, checkpoint)
    return module, env, checkpoint


def live_preflight(module, evidence, attempts=4, sleep=time.sleep):
    """Real reads on every attempt; semantic PR/refusal errors are never retried."""
    need(type(attempts) is int and 1 <= attempts <= 4, 'LIVE_ATTEMPT_LIMIT')
    rows = []
    targets = dict(module.pins()) | {45: (BASE, TREE, module.BRANCH)}
    for number, (head, tree, branch) in targets.items():
        prior = targets[number-1] if number > 35 else (module.MAIN, '', 'main')
        for attempt in range(1, attempts+1):
            try:
                value = module.fetch_pr(number)
            except urllib.error.HTTPError as error:
                rows.append(dict(pr=number, attempt=attempt, status=error.code, url=error.url,
                                 qualification='ACTUAL_HTTP_EXCEPTION', error=str(error)))
                write_json(Path(evidence)/'live-preflight.json', rows)
                if error.code not in RETRYABLE_HTTP or attempt == attempts:
                    raise
                sleep(min(2**(attempt-1), 8))
                continue
            module.original41().pr_guard(value, number, head, branch, prior[0], prior[2])
            rows.append(dict(pr=number, attempt=attempt, status=200, head=value['head']['sha'],
                             base=value['base']['sha']))
            write_json(Path(evidence)/'live-preflight.json', rows)
            break
    refs = module.live_refs(True)
    need(refs == dict(main=module.MAIN, source=BASE, **{'pr'+str(n): p[0] for n, p in module.pins().items()}),
         'LIVE_REFS_CHANGED')
    return dict(receipts=rows, refs=refs)


def failure_stage(raw, fixture):
    """Find the deepest actual failed receipt without executing receipt-provided code."""
    selected = None
    queue = [raw]
    seen = set()
    while queue:
        data = queue.pop(0)
        for name in re.findall(rb'R[0-9]+_HISTORICAL_WORKSPACE ([^\r\n]+)', data):
            candidate = Path(name.decode())
            need(candidate.is_absolute(), 'WORKSPACE_ABSOLUTE')
            workspace = candidate.resolve()
            if workspace in seen:
                continue
            seen.add(workspace)
            path = workspace/'logs/receipts.json'
            if not path.is_file():
                continue
            rows = document(regular(path))
            need(type(rows) is list and all(type(row) is dict for row in rows), 'CHILD_RECEIPTS')
            for row in rows:
                label = row.get('name')
                need(type(label) is str and re.fullmatch('[A-Za-z0-9_.-]{1,160}', label) and
                     row.get('log') == str(workspace/'logs'/(label+'.log')), 'CHILD_LOG_PATH')
                child = regular(Path(row['log']))
                need(len(child) == row['bytes'] and digest(child) == row['sha256'], 'CHILD_LOG_CHANGED')
                queue.append(child)
                if type(row.get('exit')) is int and row['exit'] != row.get('expectedExit', 0):
                    args = row.get('command')
                    need(type(args) is list and all(type(v) is str for v in args), 'CHILD_COMMAND')
                    roots = [p for p in workspace.iterdir() if p.is_dir() and (p/'.git').exists()]
                    if len(roots) == 1:
                        selected = dict(root=str(roots[0]), row=row)
    return selected


TRACE_CODE = r'''
import hashlib,importlib.util,json,sys,time,traceback
from pathlib import Path
root,relative,expected,args,output=json.loads(sys.argv[1]);path=Path(root)/relative
assert hashlib.sha256(path.read_bytes()).hexdigest()==expected
spec=importlib.util.spec_from_file_location('authentic_historical_exception_diagnostic',path)
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
events=[];start=time.monotonic()
def trace(frame,event,arg):
    if event=='call':
        if frame.f_code.co_filename==str(path):
            frame.f_trace_lines=False;frame.f_trace_opcodes=False;return trace
        return None
    if event=='exception' and len(events)<200:
        kind,error,tb=arg
        events.append(dict(function=frame.f_code.co_name,line=frame.f_lineno,type=kind.__name__,
            message=str(error),httpStatus=getattr(error,'code',None),url=getattr(error,'url',None),
            traceback=''.join(traceback.format_exception(kind,error,tb))))
    return trace
sys.argv=[str(path),*args];sys.settrace(trace)
try:code=m.main()
finally:sys.settrace(None)
assert hashlib.sha256(path.read_bytes()).hexdigest()==expected
Path(output).write_bytes((json.dumps(dict(diagnosticOnly=True,exit=code,events=events,
    originalSourceSHA256=expected,seconds=round(time.monotonic()-start,3)))+'\n').encode())
raise SystemExit(code)
'''


def diagnose(stage, fixture, evidence, env):
    """A traced diagnostic cannot certify an original normal command as passed."""
    if stage is None:
        return dict(classification='UNCLASSIFIED_NO_RECORDED_STAGE')
    root, row = Path(stage['root']).resolve(), stage['row']
    refusal = explicit_refusal(verify_receipt(row))
    if refusal:
        return dict(classification='ORIGINAL_SEMANTIC_OR_CUSTODY_REFUSAL_NO_RETRY', refusal=refusal,
                    originalStage=stage, normalOriginalCommandStillRequired=True)
    args = row['command']
    scripts = [v for v in args if re.fullmatch(r'scripts/release/full-app-j01/(?:main_integration[0-9]+|check)\.py', v)]
    if len(scripts) != 1 or '--historical' in args:
        return dict(classification='SEMANTIC_OR_UNBOUNDED_DIAGNOSTIC_NOT_RETRIED', stage=stage)
    evidence = external_evidence(root, evidence)
    relative = scripts[0]
    source_before = selected_fixture_identity(root, fixture)
    raw = regular(root/relative)
    need(raw == git(root, 'show', 'HEAD:'+relative), 'DIAGNOSTIC_SOURCE_CHANGED')
    output = Path(evidence)/'exception-events.json'
    payload = [str(root), relative, digest(raw), args[args.index(relative)+1:], str(output)]
    command = [sys.executable, '-I', '-B', '-c', TRACE_CODE, json.dumps(payload)]
    result = run_command(command, root, env, Path(evidence)/'diagnostic.log', row.get('expectedExit', 0), 1800)
    need(selected_fixture_identity(root, fixture) == source_before, 'DIAGNOSTIC_SOURCE_CHANGED')
    events = document(regular(output)) if output.exists() else {}
    classification = diagnostic_classification(result, events)
    value = dict(classification=classification, originalStage=stage, diagnostic=result, exceptionEvents=events,
                 selectedSource=source_before,
                 normalOriginalCommandStillRequired=True)
    write_json(Path(evidence)/'diagnosis.json', value)
    return value


def diagnostic_classification(result, events):
    need(type(result.get('exit')) is int and type(events) is dict, 'DIAGNOSTIC_SCHEMA')
    need(events.get('diagnosticOnly') is True and type(events.get('exit')) is int and
         events['exit'] == result['exit'], 'DIAGNOSTIC_AUTHENTIC_EXIT')
    captured = events.get('events', [])
    need(type(captured) is list and all(type(e) is dict for e in captured), 'DIAGNOSTIC_EVENTS')
    if result['exit'] == result.get('expectedExit') and events.get('diagnosticOnly') is True:
        return 'DIAGNOSTIC_RECOVERED_CAUSE_UNPROVEN'
    # A caught HTTP error must not mask a later semantic/custody exception.
    fatal = [e for e in captured if e.get('function') == 'main']
    if not fatal:
        fatal = captured[-1:]
    if fatal and fatal[-1].get('type') == 'HTTPError' and type(fatal[-1].get('httpStatus')) is int and \
            fatal[-1]['httpStatus'] in RETRYABLE_HTTP:
        return 'REPRODUCED_RETRYABLE_HTTP'
    return 'SEMANTIC_OR_UNCLASSIFIED_NO_AUTOMATIC_RETRY'


def verify_complete(root, receipt):
    root = Path(root).resolve()
    need(receipt.get('cwd') == str(root) and receipt.get('head') == BASE and receipt.get('tree') == TREE,
         'INVOCATION_FIXTURE')
    expected = [sys.executable, '-I', '-B', PREFIX+'main_integration44.py', '--historical']
    raw = verify_receipt(receipt, expected, 0)
    need(receipt['exit'] == 0 and receipt.get('timedOut') is False, 'FULL_INVOCATION_NOT_PASSED')
    verify_tool_attestation(receipt)
    value = original44(root).historical_result(raw)
    need(value.get('status') == 'PASS' and value.get('acceptanceGranted') is False and
         value.get('release') == 'NO_GO', 'ORIGINAL_READER_REFUSED')
    return value


def verify_tool_attestation(row, checkpoint=None):
    qualification = row.get('toolInputQualification')
    if qualification == 'HASHED_BEFORE_AND_AFTER_ACTUAL_NORMAL_INVOCATION':
        before, after = row.get('toolInputsBefore'), row.get('toolInputsAfter')
        need(type(before) is dict and before and before == after, 'INVOCATION_TOOL_ATTESTATION')
        if checkpoint is not None:
            need(before == checkpoint['tools'], 'INVOCATION_CHECKPOINT_TOOLS')
        return
    need(qualification == 'EXTERNAL_NORMAL_LAUNCH_VERSION_PATH_LOCK_HOOKS_LATER_BYTE_FINGERPRINT',
         'MISSING_INVOCATION_TOOL_QUALIFICATION')
    need(row.get('toolInputsBefore') is None and type(row.get('toolInputsAfter')) is dict,
         'EXTERNAL_TOOL_QUALIFICATION')
    original_raw = regular(Path(row['originalReceiptPath']))
    need(digest(original_raw) == row.get('originalReceiptSHA256'), 'EXTERNAL_RECEIPT_CHANGED')
    original = document(original_raw)
    for field in ('command', 'cwd', 'head', 'tree', 'exit', 'expectedExit', 'timedOut', 'log', 'bytes', 'sha256'):
        need(original.get(field) == row.get(field), 'EXTERNAL_RECEIPT_FIELDS_CHANGED')
    launch_raw = regular(Path(row['launchCheckpointPath']))
    need(digest(launch_raw) == row.get('launchCheckpointSHA256'), 'LAUNCH_CHECKPOINT_CHANGED')
    launch = document(launch_raw)
    need(launch.get('identity', {}).get('head') == BASE and launch['identity'].get('tree') == TREE and
         launch['identity'].get('root') == row['cwd'] and len(launch.get('setup', [])) == 4,
         'LAUNCH_CHECKPOINT_IDENTITY')
    node, npm = launch['node'], launch['npm']
    commands = [[node, '--version'], [node, npm, '--version'],
                [node, npm, 'ci', '--ignore-scripts=false', '--no-audit', '--no-fund'],
                [node, 'scripts/postinstall.mjs', '--check']]
    for number, (setup, command) in enumerate(zip(launch['setup'], commands)):
        raw = verify_receipt(setup, command, 0)
        need(setup['exit'] == 0 and setup.get('timedOut') is False, 'LAUNCH_SETUP_EXIT')
        if number < 2:
            need(raw.strip() == (b'v22.21.0' if number == 0 else b'11.20.0'), 'LAUNCH_TOOL_VERSION')
    if checkpoint is not None:
        need(launch['identity'] == checkpoint['identity'] and row['toolInputsAfter'] == checkpoint['tools'],
             'EXTERNAL_CURRENT_INPUTS_CHANGED')


def verify_attempts(root, attempts):
    need(type(attempts) is list and 1 <= len(attempts) <= MAX_ATTEMPTS, 'ATTEMPT_LEDGER')
    for position, row in enumerate(attempts):
        need(type(row) is dict and row.get('cwd') == str(Path(root).resolve()) and
             row.get('head') == BASE and row.get('tree') == TREE and
             type(row.get('timedOut')) is bool, 'ATTEMPT_FIXTURE')
        verify_receipt(row, [sys.executable, '-I', '-B', PREFIX+'main_integration44.py', '--historical'], 0)
        verify_tool_attestation(row)
        need(position == len(attempts)-1 or not original_refusal(row, root),
             'SEMANTIC_REFUSAL_RETRIED_WITHOUT_REPAIR')


def completed_result(root, evidence, checkpoint, row, attempts, module):
    verify_attempts(root, attempts)
    for attempt in attempts:
        verify_tool_attestation(attempt, checkpoint)
    need(row in attempts, 'INVOCATION_NOT_IN_ATTEMPTS')
    value = verify_complete(root, row)
    final_directory = Path(evidence)/('final-live-'+str(time.time_ns()))
    final_directory.mkdir()
    final_live = live_preflight(module, final_directory)
    result = dict(status='COMPLETE_ORIGINAL44_FULL_INVOCATION', invocation=row,
                  original44Historical=value, attempts=attempts, checkpoint=checkpoint,
                  checkpointDirectory=str(Path(evidence).resolve()), finalLive=final_live,
                  qualification='NORMAL_FULL_ORIGINAL_INVOCATION_NOT_STAGED_EQUIVALENCE',
                  acceptanceGranted=False, release='NO_GO')
    write_json(Path(evidence)/'result.json', result)
    return result


def verify_result(root, result_path, evidence=None):
    """Explicit completed-proof reuse, with unchanged inputs and fresh live reads."""
    result_path = external_evidence(root, result_path)
    value = document(regular(result_path))
    need(type(value) is dict and value.get('status') == 'COMPLETE_ORIGINAL44_FULL_INVOCATION' and
         value.get('acceptanceGranted') is False and value.get('release') == 'NO_GO', 'RESULT_NOT_COMPLETE')
    checkpoint_directory = Path(value['checkpointDirectory'])
    need(checkpoint_directory.is_absolute(), 'CHECKPOINT_DIRECTORY')
    module, _, checkpoint = prepare(root, checkpoint_directory)
    need(checkpoint == value['checkpoint'], 'RESULT_CHECKPOINT_CHANGED')
    verify_attempts(root, value['attempts'])
    for row in value['attempts']:
        verify_tool_attestation(row, checkpoint)
    need(value['invocation'] in value['attempts'], 'INVOCATION_NOT_IN_ATTEMPTS')
    parsed = verify_complete(root, value['invocation'])
    need(parsed == value['original44Historical'], 'RESULT_TRANSCRIPT_CHANGED')
    live_directory = Path(evidence).resolve() if evidence else result_path.parent/('reuse-live-'+str(time.time_ns()))
    live_directory = external_evidence(root, live_directory)
    live_directory.mkdir(parents=True, exist_ok=False)
    live = live_preflight(module, live_directory)
    write_json(live_directory/'revalidated-result.json', dict(resultSHA256=digest(regular(result_path)),
               checkpointSHA256=digest(regular(checkpoint_directory/'checkpoint.json')), finalLive=live,
               qualification='EXPLICIT_REUSE_OF_COMPLETED_NORMAL_INVOCATION_NOT_NEW_FULL_INVOCATION',
               acceptanceGranted=False, release='NO_GO'))
    return value


def adopt_complete(root, receipt_path, checkpoint_directory):
    """Authenticate a normal invocation started before orchestration source froze.

    This accepts no staged-equivalence claim: the normal command, actual exit,
    raw output and complete unchanged original reader must all validate.
    """
    root, checkpoint_directory = Path(root).resolve(), Path(checkpoint_directory).resolve()
    receipt_path = external_evidence(root, receipt_path)
    module, _, checkpoint = prepare(root, checkpoint_directory)
    row = document(regular(Path(receipt_path)))
    need(row.get('cwd') == str(root) and row.get('head') == BASE and row.get('tree') == TREE,
         'ADOPT_FIXTURE_CHANGED')
    if 'toolInputQualification' not in row:
        launch = Path(receipt_path).resolve().parent/'checkpoint.json'
        row.update(toolInputsBefore=None, toolInputsAfter=checkpoint['tools'],
                   toolInputQualification='EXTERNAL_NORMAL_LAUNCH_VERSION_PATH_LOCK_HOOKS_LATER_BYTE_FINGERPRINT',
                   originalReceiptPath=str(Path(receipt_path).resolve()),
                   originalReceiptSHA256=digest(regular(Path(receipt_path))),
                   launchCheckpointPath=str(launch), launchCheckpointSHA256=digest(regular(launch)))
    verify_tool_attestation(row, checkpoint)
    value = verify_complete(root, row)
    directory = checkpoint_directory/('adopt-live-'+str(time.time_ns()))
    directory.mkdir()
    live = live_preflight(module, directory)
    result = dict(status='COMPLETE_ORIGINAL44_FULL_INVOCATION', invocation=row,
                  original44Historical=value, attempts=[row], checkpoint=checkpoint,
                  checkpointDirectory=str(checkpoint_directory), finalLive=live,
                  qualification='EXTERNALLY_STARTED_NORMAL_FULL_INVOCATION_AUTHENTICATED_NOT_STAGED_EQUIVALENCE',
                  acceptanceGranted=False, release='NO_GO')
    write_json(checkpoint_directory/'result.json', result)
    return result


def replay(root, evidence, max_attempts=MAX_ATTEMPTS):
    need(type(max_attempts) is int and 1 <= max_attempts <= MAX_ATTEMPTS, 'ATTEMPT_LIMIT')
    root = Path(root).resolve()
    evidence = external_evidence(root, evidence)
    completed = evidence/'result.json'
    if completed.exists() and document(regular(completed)).get('status') == 'COMPLETE_ORIGINAL44_FULL_INVOCATION':
        return verify_result(root, completed)
    module, env, checkpoint = prepare(root, evidence)
    attempts_path = evidence/'attempts.json'
    attempts = document(regular(attempts_path)) if attempts_path.exists() else []
    need(type(attempts) is list, 'ATTEMPT_LEDGER')
    if attempts:
        verify_attempts(root, attempts)
        refusal = original_refusal(attempts[-1], root)
        if refusal:
            result = dict(status='INCOMPLETE_REQUIRES_RESUME_OR_REPAIR', attempts=attempts,
                          stopReason=refusal, qualification='ORIGINAL_SEMANTIC_REFUSAL_PERSISTS_NO_AUTOMATIC_RETRY',
                          acceptanceGranted=False, release='NO_GO')
            write_json(evidence/'result.json', result)
            return result
        for prior in reversed(attempts):
            if prior['exit'] == 0 and not prior['timedOut']:
                return completed_result(root, evidence, checkpoint, prior, attempts, module)
    existing = [int(p.name[8:]) for p in evidence.glob('attempt-*')
                if p.is_dir() and re.fullmatch('attempt-[1-9][0-9]*', p.name)]
    start_number = max(existing, default=0)+1
    stop_reason = None
    for number in range(start_number, min(start_number+max_attempts, MAX_ATTEMPTS+1)):
        directory = evidence/('attempt-'+str(number))
        directory.mkdir(exist_ok=False)
        before = fixture_identity(root)
        need(before == checkpoint['identity'], 'RESUME_SOURCE_CHANGED')
        tools_before = tools_identity(checkpoint['node'], checkpoint['npm'])
        need(tools_before == checkpoint['tools'], 'INVOCATION_TOOL_INPUTS_CHANGED')
        live_preflight(module, directory)
        args = [sys.executable, '-I', '-B', PREFIX+'main_integration44.py', '--historical']
        row = run_command(args, root, env, directory/'normal-full-invocation.log')
        tools_after = tools_identity(checkpoint['node'], checkpoint['npm'])
        row.update(head=BASE, tree=TREE, toolInputsBefore=tools_before, toolInputsAfter=tools_after,
                   toolInputQualification='HASHED_BEFORE_AND_AFTER_ACTUAL_NORMAL_INVOCATION')
        write_json(directory/'receipt.json', row)
        need(fixture_identity(root) == before, 'INVOCATION_CHANGED_SOURCE')
        need(tools_after == tools_before, 'INVOCATION_TOOL_INPUTS_CHANGED')
        attempts.append(row)
        write_json(evidence/'attempts.json', attempts)
        if row['exit'] == 0 and not row['timedOut']:
            return completed_result(root, evidence, checkpoint, row, attempts, module)
        refusal = original_refusal(row, root)
        if refusal:
            stop_reason = refusal
            break
        stage = failure_stage(verify_receipt(row), root)
        diagnosis = diagnose(stage, root, directory, env)
        if diagnosis['classification'] not in ('REPRODUCED_RETRYABLE_HTTP', 'DIAGNOSTIC_RECOVERED_CAUSE_UNPROVEN'):
            break
        # Never turn diagnostic success into original success. The next iteration
        # executes the original full invocation, retaining this failed attempt.
        if number < min(start_number+max_attempts-1, MAX_ATTEMPTS):
            time.sleep(min(2**number, 8))
    result = dict(status='INCOMPLETE_REQUIRES_RESUME_OR_REPAIR', attempts=attempts,
                  stopReason=stop_reason,
                  qualification='FAILED_ATTEMPTS_RETAINED_NOT_SOURCE_ACCEPTANCE',
                  acceptanceGranted=False, release='NO_GO')
    write_json(evidence/'result.json', result)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--fixture', type=Path, required=True)
    parser.add_argument('--evidence', type=Path, required=True)
    parser.add_argument('--max-attempts', type=int, default=MAX_ATTEMPTS)
    args = parser.parse_args()
    try:
        result = replay(args.fixture, args.evidence, args.max_attempts)
        print(json.dumps(result, sort_keys=True))
        return 0 if result['status'] == 'COMPLETE_ORIGINAL44_FULL_INVOCATION' else 1
    except Exception as error:
        args.evidence.mkdir(parents=True, exist_ok=True)
        value = dict(status='INCOMPLETE_EXECUTION_EXCEPTION', type=type(error).__name__, error=str(error),
                     traceback=traceback.format_exc(), acceptanceGranted=False, release='NO_GO')
        write_json(args.evidence/('execution-error-'+str(time.time_ns())+'.json'), value)
        print(json.dumps(value, sort_keys=True))
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
