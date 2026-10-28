"""Externally anchored Campaign24 artifact integrity, never Security acceptance."""
import argparse
import hashlib
import io
import json
import os
from pathlib import Path
import re
import shutil
import signal
import stat
import struct
import subprocess
import sys
import tempfile
import threading
import time
import unicodedata
import zipfile
import zlib

MODE = 'checkpoint'
AUTHORITY = 'BRAIN-M1X-SECURITY-DEPENDENCY-DB24-CANDIDATE-01'
INPUT = '4ad7e101bd0d6d47613a956c7958a3148d143f12dd333e40652e910ea8573298'
BASE = '5976394fd39f41550bde8107b9cc27c758b7ce14'
BASE_TREE = '63a896fad61d85a51b0d1e9a23020ba02d169c9e'
CHECKPOINT = 'docs/brain/checkpoints/M1-03/SECURITY-DEPENDENCY-DB24/'
CHECKPOINT_FILES = {'README.md', 'FINAL_REPORT.md', 'payload.zip', 'verify24.py', 'manifest.json'}
WORKLIST = {'docs/phase-4/generated/source-worklist.json', 'docs/phase-4/generated/source-worklist.md'}
EXISTING = {'.github/workflows/quality.yml', '.github/workflows/security-candidate22.yml', 'ONSKIN_BRAIN_HANDOFF.txt', 'apps/catalog-operator-console/package.json', 'apps/mobile/package.json', 'docs/phase-4/generated/source-worklist.json', 'docs/phase-4/generated/source-worklist.md', 'package-lock.json', 'package.json', 'scripts/phase2/local-supabase-reset.mjs', 'scripts/phase5/check-native-config.mjs', 'scripts/phase5/ios-extension-contract.mjs', 'scripts/phase9/ios-privacy-contract.mjs', 'scripts/phase9/ios-privacy-source-audit.mjs', 'scripts/phase9/ios-privacy-source-audit.test.mjs', 'scripts/phase9/patch-tooling-security.mjs', 'scripts/phase9/patch-tooling-security.test.mjs', 'scripts/phase9/tooling-security-vulnerabilities.test.mjs', 'scripts/postinstall.mjs', 'scripts/release/full-app-j01/check.py', 'scripts/security22/README.md', 'scripts/security22/backports.json', 'scripts/security22/dependency.mjs', 'scripts/security22/dependency.test.mjs', 'scripts/security22/evaluate.py', 'scripts/security22/patch-tooling.mjs', 'scripts/security22/patch-tooling.test.mjs', 'scripts/security22/policy.json', 'scripts/security22/run.py', 'scripts/security22/toolchain.json', 'scripts/security22/toolchain.py'}
NEW = {'docs/brain/checkpoints/M1-03/SECURITY-DEPENDENCY-DB24/FINAL_REPORT.md', 'docs/brain/checkpoints/M1-03/SECURITY-DEPENDENCY-DB24/README.md', 'docs/brain/checkpoints/M1-03/SECURITY-DEPENDENCY-DB24/manifest.json', 'docs/brain/checkpoints/M1-03/SECURITY-DEPENDENCY-DB24/payload.zip', 'docs/brain/checkpoints/M1-03/SECURITY-DEPENDENCY-DB24/verify24.py', 'docs/brain/contracts/M1X-24/candidate24.json', 'docs/brain/task-specs/M1X-24/TASK.md', 'docs/security/security24/advisories.md', 'docs/security/security24/blockers.md', 'docs/security/security24/canonical-db24.md', 'docs/security/security24/validation.md', 'scripts/phase2/canonical-postgres-mirror24.mjs', 'scripts/phase2/canonical-postgres-mirror24.test.mjs', 'scripts/release/full-app-j01/source_consumer24.test.py', 'scripts/security24/advisory-behavior.test.mjs', 'scripts/security24/backports.json', 'scripts/security24/graph.mjs', 'scripts/security24/patch-tooling.mjs', 'scripts/security24/patch-tooling.test.mjs', 'scripts/security24/probe.mjs', 'scripts/security24/test_packet24.py'}
MAX_FILES = 20000
MAX_FILE = 128 * 1024 * 1024
MAX_TOTAL = 512 * 1024 * 1024
MAX_RATIO = 500
MAX_DEPTH = 5
HEX64 = re.compile('[0-9a-f]{64}')
HEX40 = re.compile('[0-9a-f]{40}')


class Refusal(ValueError):
    pass


def need(ok, code):
    if not ok:
        raise Refusal(code)


def fields(value, keys, code):
    need(type(value) is dict and set(value) == set(keys), code)
    return value


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def pairs(items):
    result = {}
    for key, value in items:
        need(key not in result, 'DUPLICATE_JSON_KEY')
        result[key] = value
    return result


def loads(raw):
    need(type(raw) is bytes and len(raw) <= 16*1024*1024, 'JSON_BOUND')
    try:
        value = json.loads(raw.decode('utf-8'), object_pairs_hook=pairs,
            parse_constant=lambda _: need(False, 'NONFINITE_JSON'))
    except Refusal:
        raise
    except (ValueError, UnicodeError, RecursionError):
        raise Refusal('JSON_INVALID') from None
    def finite(value, depth=0):
        need(depth <= 100, 'JSON_DEPTH')
        if type(value) is float:
            need(False, 'FLOAT_NOT_ALLOWED')
        if type(value) is dict:
            for child in value.values(): finite(child, depth+1)
        elif type(value) is list:
            for child in value: finite(child, depth+1)
    finite(value)
    return value


def safe_path(name):
    need(type(name) is str and 0 < len(name) <= 4096 and not name.startswith('/') and
         '\\' not in name and not any(c in name for c in ':<>"|?*') and
         not any(ord(c) < 32 or 127 <= ord(c) < 160 for c in name), 'UNSAFE_PATH')
    parts = name.split('/')
    for component in parts:
        normalized = unicodedata.normalize('NFKC', component)
        need(normalized and normalized not in ('.', '..') and '/' not in normalized and '\\' not in normalized and
             not any(c in normalized for c in ':<>\"|?*') and not normalized.endswith(('.', ' ')) and
             not re.fullmatch(r'(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?', normalized, re.I), 'UNSAFE_PATH')
    need(len(parts) <= 64, 'PATH_DEPTH_BOUND')
    need(all(p and p not in ('.', '..') and not p.endswith(('.', ' ')) and
             not re.fullmatch(r'(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?', p, re.I) for p in parts), 'UNSAFE_PATH')
    return parts


def paths(names):
    aliases, directories = {}, set()
    for name in names:
        parts = safe_path(name)
        for count in range(1, len(parts)+1):
            parent = '/'.join(parts[:count]); kind = 'file' if count == len(parts) else 'directory'
            alias = unicodedata.normalize('NFKC', parent).casefold()
            need(alias not in aliases or aliases[alias] == (parent, kind), 'PATH_ALIAS_OR_COLLISION')
            aliases[alias] = (parent, kind)
            need(len(aliases) <= MAX_FILES*4, 'PATH_COMPONENT_BOUND')
            if kind == 'directory': directories.add(parent)
    return directories


def inventory(value):
    need(type(value) is dict and 0 < len(value) < MAX_FILES and 'manifest.json' not in value, 'INVENTORY_SCHEMA')
    directories = paths(value)
    total = 0
    for item in value.values():
        fields(item, ('bytes', 'sha256'), 'WITNESS_SCHEMA')
        need(type(item['bytes']) is int and 0 <= item['bytes'] <= MAX_FILE and
             type(item['sha256']) is str and HEX64.fullmatch(item['sha256']), 'WITNESS_SCHEMA')
        total += item['bytes']; need(total <= MAX_TOTAL, 'INVENTORY_TOTAL_BOUND')
    return directories


def node(path, directory=False):
    info = path.lstat()
    need(not stat.S_ISLNK(info.st_mode) and not getattr(info, 'st_file_attributes', 0) & 1024, 'LINK_OR_REPARSE')
    need(stat.S_ISDIR(info.st_mode) if directory else stat.S_ISREG(info.st_mode), 'NONREGULAR_NODE')
    if not directory:
        need(info.st_nlink == 1 and not info.st_mode & (stat.S_ISUID | stat.S_ISGID | stat.S_ISVTX) and info.st_size <= MAX_FILE,
             'FILE_MODE_OR_BOUND')
    return info


def read_regular(path, limit=MAX_FILE):
    path = Path(os.path.abspath(path))
    for parent in path.parents: node(parent, True)
    before = node(path)
    need(before.st_size <= limit, 'FILE_BOUND')
    flags = os.O_RDONLY | getattr(os, 'O_NOFOLLOW', 0) | getattr(os, 'O_BINARY', 0)
    descriptor = os.open(path, flags)
    try:
        opened = os.fstat(descriptor)
        need((opened.st_dev, opened.st_ino) == (before.st_dev, before.st_ino), 'FILE_CHANGED')
        pieces, total = [], 0
        while True:
            chunk = os.read(descriptor, 1024*1024)
            if not chunk: break
            total += len(chunk); need(total <= limit and total <= before.st_size, 'FILE_CHANGED_OR_BOUND')
            pieces.append(chunk)
        after = os.fstat(descriptor); current = node(path)
        for info in (after, current):
            need((info.st_dev, info.st_ino, info.st_size, info.st_mtime_ns) ==
                 (before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns), 'FILE_CHANGED')
        need(total == before.st_size, 'FILE_TRUNCATED')
        return b''.join(pieces)
    finally:
        os.close(descriptor)


class Directory:
    def __init__(self, root):
        self.root = Path(os.path.abspath(root))
        for parent in (self.root, *self.root.parents): node(parent, True)

    def read(self, name):
        safe_path(name)
        return read_regular(self.root.joinpath(*name.split('/')))

    def exact(self, expected):
        directories = paths(expected)
        actual, found_dirs, stack, total = set(), set(), [self.root], 0
        while stack:
            parent = stack.pop()
            with os.scandir(parent) as entries:
                for entry in entries:
                    path = Path(entry.path); name = path.relative_to(self.root).as_posix(); safe_path(name)
                    info = path.lstat()
                    if stat.S_ISDIR(info.st_mode):
                        node(path, True); need(name in directories and name not in found_dirs, 'UNEXPECTED_DIRECTORY')
                        found_dirs.add(name); stack.append(path)
                    else:
                        info = node(path); need(name in expected and name not in actual, 'UNEXPECTED_FILE')
                        total += info.st_size; need(total <= MAX_TOTAL, 'TOTAL_BOUND'); actual.add(name)
        paths(actual)
        need(actual == set(expected) and found_dirs == directories, 'EXACT_INVENTORY_MISMATCH')


class Archive:
    def __init__(self, raw, depth=0, budget=None):
        need(type(raw) is bytes and len(raw) <= MAX_FILE and depth <= MAX_DEPTH, 'ZIP_BOUND')
        self.raw, self.depth = raw, depth
        self.budget = budget if budget is not None else dict(bytes=0, members=0)
        # Count and frame the central directory before ZipFile allocates member
        # objects. ZIP64/multidisk are unnecessary under this bounded protocol.
        end = raw.rfind(b'PK\x05\x06', max(0, len(raw)-65557))
        need(end >= 0 and end+22 <= len(raw), 'ZIP_END_RECORD')
        disk, start_disk, disk_count, count, size, offset, comment = struct.unpack_from('<HHHHIIH', raw, end+4)
        need(disk == start_disk == 0 and disk_count == count and count <= MAX_FILES and
             count != 65535 and size != 0xffffffff and offset != 0xffffffff and
             comment == 0 and end+22 == len(raw) and offset+size == end, 'ZIP_DIRECTORY_BOUND')
        cursor, observed = offset, 0
        central_headers = {}
        while cursor < end:
            need(cursor+46 <= end and raw[cursor:cursor+4] == b'PK\x01\x02', 'ZIP_DIRECTORY_FRAME')
            central_offset = struct.unpack_from('<I', raw, cursor+42)[0]
            need(central_offset not in central_headers, 'ZIP_LOCAL_OVERLAP_OR_GAP')
            central_headers[central_offset] = struct.unpack_from('<5H', raw, cursor+6)
            need(central_headers[central_offset][0] <= 20, 'ZIP_NONREGULAR_OR_UNSUPPORTED')
            lengths = struct.unpack_from('<HHH', raw, cursor+28)
            need(struct.unpack_from('<H', raw, cursor+34)[0] == 0 and
                 struct.unpack_from('<I', raw, cursor+42)[0] != 0xffffffff, 'ZIP64_OR_MULTIDISK_UNSUPPORTED')
            cursor += 46+sum(lengths); observed += 1
            need(cursor <= end and observed <= MAX_FILES, 'ZIP_MEMBER_BOUND')
        need(cursor == end and observed == count, 'ZIP_DIRECTORY_COUNT')
        try: self.zip = zipfile.ZipFile(io.BytesIO(raw))
        except (ValueError, OSError, zipfile.BadZipFile): raise Refusal('ZIP_INVALID') from None
        self.members, explicit, file_names, dir_names, aliases = {}, set(), [], set(), {}
        declared_total = 0
        for item in self.zip.infolist():
            self.budget['members'] += 1; need(self.budget['members'] <= MAX_FILES, 'ZIP_MEMBER_BOUND')
            name = item.filename
            need(name == item.orig_filename and '\x00' not in name, 'UNSAFE_PATH')
            directory = item.is_dir(); name = name[:-1] if directory else name; parts = safe_path(name)
            mode = item.external_attr >> 16; kind = stat.S_IFMT(mode)
            need(item.create_system == 3 and kind == (stat.S_IFDIR if directory else stat.S_IFREG) and
                 not mode & (stat.S_ISUID | stat.S_ISGID | stat.S_ISVTX) and not item.external_attr & 1024 and
                 not item.extra and not item.comment and item.external_attr & 65535 in ((0, 16) if directory else (0, 32)) and
                 item.flag_bits in (0, 2048) and item.compress_type in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED), 'ZIP_NONREGULAR_OR_UNSUPPORTED')
            need(not (item.external_attr & 16) or directory, 'ZIP_DIRECTORY_MODE')
            need(item.file_size <= MAX_FILE and item.file_size <= max(1024*1024, item.compress_size*MAX_RATIO), 'ZIP_EXPANSION_BOUND')
            declared_total += item.file_size
            need(declared_total <= MAX_TOTAL, 'ZIP_TOTAL_EXPANSION_BOUND')
            if directory: need(item.file_size == 0, 'ZIP_DIRECTORY_BYTES')
            for length in range(1, len(parts)+1):
                parent = '/'.join(parts[:length]); typ = 'directory' if length < len(parts) or directory else 'file'
                alias = unicodedata.normalize('NFKC', parent).casefold()
                need(alias not in aliases or aliases[alias] == (parent, typ), 'PATH_ALIAS_OR_COLLISION')
                aliases[alias] = (parent, typ)
                need(len(aliases) <= MAX_FILES*4, 'PATH_COMPONENT_BOUND')
            need(name not in explicit, 'ZIP_DUPLICATE_MEMBER'); explicit.add(name)
            if directory: dir_names.add(name)
            else: self.members[name] = item; file_names.append(name)
        intervals = []
        for item in self.zip.infolist():
            start = item.header_offset
            need(0 <= start and start+30 <= offset, 'ZIP_LOCAL_FRAME')
            header = struct.unpack_from('<4s5H3I2H', raw, start)
            signature, version, flags, compression, _, _, crc, compressed, size, nlen, extra = header
            need(header[1:6] == central_headers[start] and version <= 20 and
                 signature == b'PK\x03\x04' and flags == item.flag_bits and compression == item.compress_type and
                 crc == item.CRC and compressed == item.compress_size and size == item.file_size and extra == 0,
                 'ZIP_LOCAL_IDENTITY')
            name = raw[start+30:start+30+nlen].decode('utf8' if flags & 2048 else 'cp437')
            need(name == item.filename, 'ZIP_LOCAL_NAME')
            end_data = start+30+nlen+extra+compressed
            need(end_data <= offset, 'ZIP_LOCAL_BOUND')
            intervals.append((start, end_data))
        cursor = 0
        for start, finish in sorted(intervals):
            need(start == cursor, 'ZIP_LOCAL_OVERLAP_OR_GAP'); cursor = finish
        need(cursor == offset, 'ZIP_LOCAL_TRAILING_BYTES')
        self.directories = paths(file_names)
        need(dir_names <= self.directories, 'ZIP_UNEXPECTED_DIRECTORY')

    def read(self, name):
        safe_path(name); need(name in self.members, 'ZIP_MISSING_MEMBER')
        item = self.members[name]
        name_size = struct.unpack_from('<H', self.raw, item.header_offset+26)[0]
        start = item.header_offset+30+name_size
        packed = self.raw[start:start+item.compress_size]
        if item.compress_type == zipfile.ZIP_DEFLATED:
            decoder = zlib.decompressobj(-15)
            try:
                result = decoder.decompress(packed, item.file_size+1)
            except zlib.error:
                raise Refusal('ZIP_READ_INVALID') from None
            need(decoder.eof and not decoder.unused_data and not decoder.unconsumed_tail, 'ZIP_READ_INVALID')
        else:
            result = packed
        need(len(result) == item.file_size and zlib.crc32(result) & 0xffffffff == item.CRC, 'ZIP_READ_INVALID')
        return result

    def exact(self, expected):
        need(set(self.members) == set(expected), 'ZIP_EXACT_INVENTORY')


def nested_safety(raw, name, depth, budget):
    if raw[:4] in (b'PK\x03\x04', b'PK\x05\x06', b'PK\x07\x08') or name.lower().endswith('.zip') or b'PK\x05\x06' in raw[-65557:]:
        child = Archive(raw, depth, budget)
        for member in child.members:
            data = child.read(member); budget['bytes'] += len(data); need(budget['bytes'] <= MAX_TOTAL, 'ZIP_TOTAL_EXPANSION_BOUND')
            nested_safety(data, member, depth+1, budget)
    elif name.lower().endswith(('.tar', '.tgz', '.tar.gz', '.gz', '.bz2', '.xz', '.7z', '.rar', '.zst')) or \
        raw.startswith((b'\x1f\x8b', b'BZh', b'\xfd7zXZ\x00', b'7z\xbc\xaf\x27\x1c', b'Rar!', b'\x28\xb5\x2f\xfd')) or \
        raw[257:263] in (b'ustar\x00', b'ustar '):
        raise Refusal('UNSUPPORTED_NESTED_ARCHIVE')


def check_files(container, files):
    inventory(files); expected = set(files) | {'manifest.json'}; container.exact(expected)
    budget = container.budget if isinstance(container, Archive) else dict(bytes=0, members=0)
    for name, witness in files.items():
        raw = container.read(name)
        need(len(raw) == witness['bytes'] and sha(raw) == witness['sha256'], 'ARTIFACT_HASH_MISMATCH')
        budget['bytes'] += len(raw); need(budget['bytes'] <= MAX_TOTAL, 'TOTAL_BOUND')
        nested_safety(raw, name, 1, budget)
    return len(expected)


def manifest(container, anchor, checkpoint=True):
    need(type(anchor) is str and HEX64.fullmatch(anchor), 'EXTERNAL_ANCHOR_REQUIRED')
    raw = container.read('manifest.json'); need(sha(raw) == anchor, 'MANIFEST_SHA256_MISMATCH')
    value = loads(raw)
    common = ('schema', 'authority', 'status', 'acceptanceGranted', 'release', 'inputManifestSHA256', 'source', 'files')
    fields(value, (*common, 'payload') if checkpoint else (*common, 'qualification', 'checkpoint', 'gitDelta'), 'MANIFEST_SCHEMA')
    need(type(value['schema']) is int and value['schema'] == 1 and value['authority'] == AUTHORITY and
         value['status'] == 'SUBMITTED_REVIEW_REQUIRED' and value['acceptanceGranted'] is False and
         value['release'] == 'NO_GO' and value['inputManifestSHA256'] == INPUT, 'MANIFEST_AUTHORITY')
    source = value['source']; keys = ('base', 'baseTree', 'runtimeHead', 'runtimeTree', 'sourceHead', 'sourceTree')
    fields(source, keys if checkpoint else (*keys, 'candidateHead', 'candidateTree'), 'SOURCE_SCHEMA')
    need(all(type(v) is str and HEX40.fullmatch(v) for v in source.values()) and
         source['base'] == BASE and source['baseTree'] == BASE_TREE, 'SOURCE_IDENTITY')
    if checkpoint:
        need(type(value['files']) is dict and set(value['files']) == CHECKPOINT_FILES-{'manifest.json'}, 'CHECKPOINT_FILES')
        fields(value['payload'], ('schema', 'files', 'qualification'), 'PAYLOAD_SCHEMA')
        need(type(value['payload']['schema']) is int and value['payload']['schema'] == 1 and
             value['payload']['qualification'] == 'SANITIZED_TECHNICAL_EVIDENCE_NOT_ACCEPTANCE', 'PAYLOAD_QUALIFICATION')
    else:
        need(value['qualification'] == 'SANITIZED_REVIEW_RETURN_NOT_ACCEPTANCE', 'RETURN_QUALIFICATION')
    check_files(container, value['files'])
    return value


def checkpoint(container, anchor):
    value = manifest(container, anchor)
    payload = Archive(container.read('payload.zip'))
    declared = value['payload']['files']; inventory(declared); payload.exact(declared)
    for name, witness in declared.items():
        raw = payload.read(name)
        need(len(raw) == witness['bytes'] and sha(raw) == witness['sha256'], 'PAYLOAD_HASH_MISMATCH')
    return value


def windows_job(child):
    """A gated launcher cannot create descendants until assigned to this job."""
    import ctypes
    from ctypes import wintypes
    class BASIC(ctypes.Structure):
        _fields_ = [('processTime', ctypes.c_int64), ('jobTime', ctypes.c_int64),
                    ('flags', wintypes.DWORD), ('minWorking', ctypes.c_size_t),
                    ('maxWorking', ctypes.c_size_t), ('active', wintypes.DWORD),
                    ('affinity', ctypes.c_size_t), ('priority', wintypes.DWORD), ('scheduling', wintypes.DWORD)]
    class IO(ctypes.Structure):
        _fields_ = [(key, ctypes.c_uint64) for key in ('readOps', 'writeOps', 'otherOps', 'readBytes', 'writeBytes', 'otherBytes')]
    class EXTENDED(ctypes.Structure):
        _fields_ = [('basic', BASIC), ('io', IO), ('processMemory', ctypes.c_size_t),
                    ('jobMemory', ctypes.c_size_t), ('peakProcess', ctypes.c_size_t), ('peakJob', ctypes.c_size_t)]
    kernel = ctypes.WinDLL('kernel32', use_last_error=True)
    kernel.CreateJobObjectW.argtypes = [ctypes.c_void_p, wintypes.LPCWSTR]
    kernel.CreateJobObjectW.restype = wintypes.HANDLE
    kernel.SetInformationJobObject.argtypes = [wintypes.HANDLE, ctypes.c_int, ctypes.c_void_p, wintypes.DWORD]
    kernel.SetInformationJobObject.restype = wintypes.BOOL
    kernel.AssignProcessToJobObject.argtypes = [wintypes.HANDLE, wintypes.HANDLE]
    kernel.AssignProcessToJobObject.restype = wintypes.BOOL
    kernel.CloseHandle.argtypes = [wintypes.HANDLE]
    kernel.CloseHandle.restype = wintypes.BOOL
    job = kernel.CreateJobObjectW(None, None)
    if not job:
        raise Refusal('CHILD_CONTAINMENT_UNAVAILABLE')
    limits = EXTENDED(); limits.basic.flags = 0x2000  # JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
    if not kernel.SetInformationJobObject(job, 9, ctypes.byref(limits), ctypes.sizeof(limits)) or not kernel.AssignProcessToJobObject(job, wintypes.HANDLE(int(child._handle))):
        kernel.CloseHandle(job)
        raise Refusal('CHILD_CONTAINMENT_UNAVAILABLE')
    return lambda: kernel.CloseHandle(job)


def stop(child):
    if os.name == 'nt':
        subprocess.run(['taskkill', '/PID', str(child.pid), '/T', '/F'],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=15)
    else:
        try:
            os.killpg(child.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass


def _execute(argv, root, seconds=120, limit=8 * 1024 * 1024, input_data=None, supplied_env=None):
    env = {key: value for key, value in (os.environ if supplied_env is None else supplied_env).items()
           if key.upper() not in ('NODE_OPTIONS', 'NODE_PATH', 'NODE_AUTH_TOKEN', 'PYTHONPATH', 'PYTHONSTARTUP') and
           not key.upper().startswith(('GIT_', 'NPM_'))}
    env.update(PYTHONDONTWRITEBYTECODE='1', GIT_TERMINAL_PROMPT='0', NO_COLOR='1')
    options = {'creationflags': subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.CREATE_NO_WINDOW} if os.name == 'nt' else {'start_new_session': True}
    if os.name == 'nt':
        executable = shutil.which(argv[0])
        if executable is None:
            raise Refusal('EXECUTABLE_UNAVAILABLE')
        gate = 'import os,sys,subprocess; os.read(0,1); sys.exit(subprocess.call(sys.argv[1:]))'
        command = [sys.executable, '-I', '-B', '-c', gate, executable, *argv[1:]]
        stdin_data = b'\n' + (input_data or b'')
    else:
        command = argv; stdin_data = input_data
    child = subprocess.Popen(command, cwd=root, env=env, stdin=subprocess.PIPE if stdin_data is not None else subprocess.DEVNULL,
                             stdout=subprocess.PIPE, stderr=subprocess.PIPE, **options)
    close_job = None
    try:
        if os.name == 'nt':
            close_job = windows_job(child)
    except BaseException:
        child.kill(); child.wait(timeout=10)
        for stream in (child.stdin, child.stdout, child.stderr):
            if stream:
                stream.close()
        raise
    output = [bytearray(), bytearray()]
    overflow = threading.Event()
    failed = threading.Event()
    lock = threading.Lock()

    def drain(pipe, index):
        try:
            while True:
                block = pipe.read(65536)
                if not block:
                    break
                with lock:
                    if sum(map(len, output)) + len(block) > limit:
                        overflow.set()
                        break
                    output[index].extend(block)
        except BaseException:
            failed.set()
        finally:
            try:
                pipe.close()
            except BaseException:
                failed.set()

    readers = [threading.Thread(target=drain, args=(pipe, index), daemon=True)
               for index, pipe in enumerate((child.stdout, child.stderr))]
    if stdin_data is not None:
        def feed():
            try:
                child.stdin.write(stdin_data)
            except BaseException:
                failed.set()
            finally:
                try:
                    child.stdin.close()
                except BaseException:
                    failed.set()
        readers.append(threading.Thread(target=feed, daemon=True))
    for reader in readers:
        reader.start()
    deadline = time.monotonic() + seconds
    try:
        while child.poll() is None or any(reader.is_alive() for reader in readers):
            if overflow.is_set() or time.monotonic() >= deadline:
                raise Refusal('OUTPUT_LIMIT' if overflow.is_set() else 'CHILD_TIMEOUT')
            if failed.is_set():
                raise Refusal('CHILD_STREAM_FAILURE')
            time.sleep(.01)
        child.wait(timeout=5)
        if overflow.is_set():
            raise Refusal('OUTPUT_LIMIT')
        if failed.is_set():
            raise Refusal('CHILD_STREAM_FAILURE')
        return child.returncode, bytes(output[0]), bytes(output[1])
    finally:
        if close_job:
            close_job()
        if os.name != 'nt':
            # Also retire detached-stdio descendants after a successful parent exit.
            stop(child)
        for reader in readers:
            reader.join(timeout=5)
        if child.poll() is None:
            child.kill()
        child.wait(timeout=10)


def bounded(command, root, environment, limit, timeout, input_bytes=None):
    need(input_bytes is None or type(input_bytes) is bytes and len(input_bytes) <= MAX_FILE, 'SUBPROCESS_INPUT_BOUND')
    need(type(limit) is int and 0 < limit <= 16*1024*1024 and type(timeout) in (int, float) and 0 < timeout <= 900,
         'SUBPROCESS_BOUND_SCHEMA')
    return _execute(command, root, timeout, limit, input_bytes, environment)


def git(root, *arguments, limit=16*1024*1024, overrides=(), input_bytes=None):
    # Commands are metadata-only except status and explicit bundle verification;
    # never execute a checker or other code from the delivered candidate.
    executable = shutil.which('git'); need(executable is not None, 'GIT_UNAVAILABLE')
    environment = {k: v for k, v in os.environ.items() if not k.upper().startswith('GIT_')}
    command = [executable, '--no-pager', '--no-replace-objects', '--no-optional-locks',
               '-c', 'core.fsmonitor=false', '-c', 'core.untrackedCache=false', '-c', 'core.hooksPath=',
               '-c', 'diff.external=', '-c', 'core.quotePath=false', '-c', 'core.longpaths=true']
    for setting in overrides: command += ['-c', setting]
    code, output, error = bounded(command+list(arguments), root, environment, limit, 90, input_bytes)
    need(code == 0, 'GIT_REFUSED')
    need(not error.strip() or arguments[:2] == ('bundle', 'verify'), 'GIT_DIAGNOSTIC')
    return output


def git_tree(root, endpoint):
    tree = {}
    for record in git(root, 'ls-tree', '-r', '-z', endpoint).split(b'\0'):
        if not record: continue
        meta, raw_name = record.split(b'\t', 1); mode, kind, oid = meta.decode('ascii').split(); name = raw_name.decode('utf-8')
        need(kind == 'blob' and mode in ('100644', '100755') and HEX40.fullmatch(oid) and name not in tree, 'GIT_TREE_MODE')
        tree[name] = (mode, oid)
    paths(tree); return tree


def diff(root, before, after):
    raw = git(root, 'diff-tree', '--no-commit-id', '--raw', '--no-abbrev', '--no-renames', '-r', '-z', before, after)
    pieces = raw.split(b'\0'); need(pieces[-1] == b'' and len(pieces) % 2 == 1, 'GIT_DIFF_SCHEMA')
    result = {}
    for i in range(0, len(pieces)-1, 2):
        meta = pieces[i].decode('ascii').split(); path = pieces[i+1].decode('utf-8'); safe_path(path)
        need(len(meta) == 5 and meta[0] in (':000000', ':100644') and meta[1] == '100644' and
             HEX40.fullmatch(meta[2]) and HEX40.fullmatch(meta[3]) and
             meta[4] == ('A' if meta[0] == ':000000' else 'M') and path not in result, 'GIT_DIFF_MODE')
        result[path] = tuple(meta)
    return result


def standalone_git_store(root):
    """Metadata-only inspection; never follows a shared/junction object store."""
    root = Path(os.path.abspath(root))
    node(root/'.git', True)
    objects = root/'.git/objects'
    nodes = 0
    def visit(path, depth=0):
        nonlocal nodes
        need(depth <= 8, 'GIT_OBJECT_STORE_BOUND')
        node(path, True)
        with os.scandir(path) as entries:
            for entry in entries:
                nodes += 1; need(nodes <= 1000000, 'GIT_OBJECT_STORE_BOUND')
                info = Path(entry.path).lstat()
                need(not stat.S_ISLNK(info.st_mode) and not getattr(info, 'st_file_attributes', 0) & 1024,
                    'GIT_SHARED_OBJECT_STORE_FORBIDDEN')
                if stat.S_ISDIR(info.st_mode): visit(Path(entry.path), depth+1)
                else: need(stat.S_ISREG(info.st_mode) and info.st_nlink == 1, 'GIT_SHARED_OBJECT_STORE_FORBIDDEN')
    visit(objects)


def verify_git(root, source, checkpoint_container=None):
    root = Path(os.path.abspath(root))
    for parent in (root, *root.parents): node(parent, True)
    standalone_git_store(root)
    need(git(root, 'rev-parse', '--is-shallow-repository').strip() == b'false', 'GIT_FULL_HISTORY_REQUIRED')
    common = Path(git(root, 'rev-parse', '--git-common-dir').decode().strip())
    if not common.is_absolute(): common = root/common
    need(Path(os.path.abspath(common)) == root/'.git', 'GIT_STANDALONE_CHECKOUT_REQUIRED')
    node(common, True)
    objects = Path(git(root, 'rev-parse', '--git-path', 'objects').decode().strip())
    if not objects.is_absolute(): objects = root/objects
    need(Path(os.path.abspath(objects)) == root/'.git/objects', 'GIT_STANDALONE_CHECKOUT_REQUIRED')
    node(objects, True)
    need(not os.path.lexists(objects/'info/alternates') and not os.path.lexists(objects/'info/http-alternates'),
        'GIT_ALTERNATE_OBJECT_STORE_FORBIDDEN')
    code, output, _ = bounded([shutil.which('git'), 'config', '--get', 'extensions.partialClone'], root,
        {k:v for k,v in os.environ.items() if not k.upper().startswith('GIT_')}, 65536, 15)
    need(code == 1 and not output, 'GIT_PARTIAL_CLONE_FORBIDDEN')
    need(not any(line.startswith(b'?') for line in git(root, 'rev-list', '--objects', '--missing=print', 'HEAD').splitlines()),
        'GIT_MISSING_REACHABLE_OBJECT')
    need(git(root, 'rev-parse', '2cffa9e92be101af4e3b371f1815ec9f458d8da4^{tree}').decode().strip() ==
        '9380dd155ee2c7879de7ef79eb27d0028b950d13' and
        git(root, 'merge-base', '2cffa9e92be101af4e3b371f1815ec9f458d8da4', BASE).decode().strip() ==
        '2cffa9e92be101af4e3b371f1815ec9f458d8da4', 'GIT_PR25_ANCESTRY')
    need(git(root, 'rev-parse', '34fac69f3ba527724ecdf2d1cef69f27372756ad^{tree}').decode().strip() ==
        '832baeae6421bfaa6fb668b025932d2c49a4f33c' and
        git(root, 'merge-base', '34fac69f3ba527724ecdf2d1cef69f27372756ad', BASE).decode().strip() ==
        '34fac69f3ba527724ecdf2d1cef69f27372756ad', 'GIT_BASE_ANCESTRY')
    need(git(root, 'rev-parse', BASE+'^{tree}').decode().strip() == BASE_TREE, 'GIT_BASE_TREE')
    need(not git(root, 'for-each-ref', '--format=%(refname)', 'refs/replace').strip(), 'GIT_REPLACE_FORBIDDEN')
    grafts = Path(git(root, 'rev-parse', '--git-path', 'info/grafts').decode().strip())
    if not grafts.is_absolute(): grafts = root/grafts
    need(not os.path.lexists(grafts), 'GIT_GRAFTS_FORBIDDEN')
    for prefix in ('runtime', 'source'):
        need(git(root, 'rev-parse', source[prefix+'Head']+'^{tree}').decode().strip() == source[prefix+'Tree'], 'GIT_SOURCE_TREE')
    need(git(root, 'merge-base', BASE, source['runtimeHead']).decode().strip() == BASE, 'GIT_BASE_ANCESTRY')
    prior = BASE
    for line in git(root, 'rev-list', '--reverse', '--parents', BASE+'..'+source['runtimeHead']).decode().splitlines():
        pieces = line.split(); need(len(pieces) == 2 and pieces[1] == prior, 'GIT_LINEAR_HISTORY')
        changed = diff(root, prior, pieces[0]); need(set(changed) <= EXISTING | NEW and
            not any(name.startswith(CHECKPOINT) or name == 'ONSKIN_BRAIN_HANDOFF.txt' or name in WORKLIST for name in changed), 'GIT_SOURCE_SCOPE')
        prior = pieces[0]
    need(prior == source['runtimeHead'] and git(root, 'rev-list', '--parents', '-n', '1', source['sourceHead']).decode().split() ==
         [source['sourceHead'], source['runtimeHead']], 'GIT_FREEZE_PARENT')
    need(set(diff(root, source['runtimeHead'], source['sourceHead'])) == WORKLIST, 'GIT_WORKLIST_ONLY_FREEZE')
    head = git(root, 'rev-parse', 'HEAD').decode().strip(); tree = git_tree(root, head)
    tail = head != source['sourceHead']
    if tail:
        need(git(root, 'rev-list', '--parents', '-n', '1', head).decode().split() == [head, source['sourceHead']], 'GIT_ONE_EVIDENCE_TAIL')
        need(set(diff(root, source['sourceHead'], head)) == {CHECKPOINT+n for n in CHECKPOINT_FILES} | {'ONSKIN_BRAIN_HANDOFF.txt'}, 'GIT_EVIDENCE_SCOPE')
    if 'candidateHead' in source:
        need(head == source['candidateHead'] and git(root, 'rev-parse', 'HEAD^{tree}').decode().strip() == source['candidateTree'], 'GIT_CANDIDATE_IDENTITY')
    # Deny configured external clean/smudge/process filters before status. The
    # exact changed public bytes below are compared without any Git filter.
    code, names, _ = bounded([shutil.which('git'), '--no-replace-objects', 'config', '--null', '--name-only', '--get-regexp', r'^filter\..*\.(clean|smudge|process)$'],
        root, {k:v for k,v in os.environ.items() if not k.upper().startswith('GIT_')}, 65536, 15)
    need(code in (0, 1), 'GIT_FILTER_CONFIG')
    overrides = []
    for key in names.decode('utf-8').split('\0'):
        if not key: continue
        need(re.fullmatch(r'filter\.[A-Za-z0-9_. -]{1,128}\.(clean|smudge|process)', key), 'GIT_FILTER_CONFIG')
        overrides += [key+'=', key.rsplit('.', 1)[0]+'.required=false']
    need(not git(root, 'status', '--porcelain=v1', '--untracked-files=all', '-z', overrides=overrides), 'GIT_CHECKOUT_DIRTY')
    index = {}
    for record in git(root, 'ls-files', '--stage', '-z').split(b'\0'):
        if not record: continue
        meta, name = record.split(b'\t', 1); mode, oid, stage = meta.decode('ascii').split(); path = name.decode('utf-8')
        need(stage == '0' and path not in index and mode in ('100644', '100755') and HEX40.fullmatch(oid), 'GIT_INDEX_MODE')
        index[path] = (mode, oid)
    need(index == tree, 'GIT_INDEX_TREE_MISMATCH')
    for record in git(root, 'ls-files', '-v', '-z').split(b'\0'):
        if record: need(record.startswith(b'H '), 'GIT_INDEX_FLAGS')
    changed = diff(root, BASE, head); need(set(changed) <= EXISTING | NEW and
        all((entry[0] == ':100644') == (name in EXISTING) for name, entry in changed.items()), 'GIT_SOURCE_SCOPE')
    checked = 0
    for name in changed:
        raw = read_regular(root.joinpath(*name.split('/')))
        oid = hashlib.sha1(('blob '+str(len(raw))+'\0').encode()+raw).hexdigest()
        need(tree[name] == ('100644', oid), 'GIT_WORKING_BLOB_MISMATCH'); checked += 1
    if tail and checkpoint_container is not None:
        for name in CHECKPOINT_FILES:
            raw = checkpoint_container.read(name)
            need(hashlib.sha1(('blob '+str(len(raw))+'\0').encode()+raw).hexdigest() == tree[CHECKPOINT+name][1], 'GIT_CHECKPOINT_COPY_MISMATCH')
    need(git(root, 'rev-parse', 'HEAD').decode().strip() == head and
        not git(root, 'status', '--porcelain=v1', '--untracked-files=all', '-z', overrides=overrides) and
        git(root, 'ls-files', '--stage', '-z') == b''.join(
            (mode+' '+oid+' 0\t'+path).encode()+b'\0' for path, (mode, oid) in index.items()), 'GIT_FINAL_SNAPSHOT')
    return dict(head=head, tree=git(root, 'rev-parse', 'HEAD^{tree}').decode().strip(),
                metadataFiles=len(tree), changedPublicWorkingFilesChecked=checked, evidenceTail=tail,
                unrelatedProtectedWorkingBytes='NOT_OPENED;GIT_METADATA_AND_STATUS_ONLY')


def return_packet(container, anchor, git_root=None):
    value = manifest(container, anchor, checkpoint=False)
    need({'FINAL_REPORT.md', 'verify_return24.py'} <= set(value['files']), 'RETURN_REQUIRED_FILES')
    descriptor = fields(value['checkpoint'], ('path', 'manifestSHA256'), 'RETURN_CHECKPOINT_SCHEMA')
    safe_path(descriptor['path']); need(type(descriptor['manifestSHA256']) is str and HEX64.fullmatch(descriptor['manifestSHA256']), 'RETURN_CHECKPOINT_ANCHOR')
    class Prefix:
        def read(self, name): return container.read(descriptor['path']+'/'+name)
        def exact(self, expected):
            names = {name[len(descriptor['path'])+1:] for name in value['files'] if name.startswith(descriptor['path']+'/')}
            need(names == set(expected), 'RETURN_CHECKPOINT_INVENTORY')
    inner = Prefix(); witness = checkpoint(inner, descriptor['manifestSHA256'])
    need(all(value['source'][name] == witness['source'][name] for name in witness['source']), 'RETURN_SOURCE_DISAGREEMENT')
    need(value['source']['candidateHead'] != value['source']['sourceHead'] and
         value['source']['candidateTree'] != value['source']['sourceTree'], 'RETURN_FINAL_TAIL_REQUIRED')
    delta = fields(value['gitDelta'], ('path', 'base', 'baseTree', 'head', 'tree'), 'RETURN_DELTA_SCHEMA')
    safe_path(delta['path'])
    need(delta['path'] in value['files'] and delta['base'] == BASE and delta['baseTree'] == BASE_TREE and
         delta['head'] == value['source']['candidateHead'] and delta['tree'] == value['source']['candidateTree'], 'RETURN_DELTA_IDENTITY')
    raw = container.read(delta['path'])
    need(raw.startswith(b'# v2 git bundle\n') or raw.startswith(b'# v3 git bundle\n'), 'RETURN_GIT_BUNDLE_FORMAT')
    header, separator, body = raw.partition(b'\n\n')
    need(separator and len(header) <= 65536 and body.startswith(b'PACK'), 'RETURN_GIT_BUNDLE_FORMAT')
    need(len(body) >= 32 and struct.unpack_from('>I', body, 4)[0] in (2, 3) and
         0 < struct.unpack_from('>I', body, 8)[0] <= 1000000 and hashlib.sha1(body[:-20]).digest() == body[-20:],
         'RETURN_GIT_PACK_CHECKSUM')
    lines = header.splitlines()[1:]
    requirements = [line[1:41].decode('ascii') for line in lines if line.startswith(b'-')]
    heads = [line[:40].decode('ascii') for line in lines if line and not line.startswith((b'-', b'@'))]
    need(all(re.fullmatch(rb'[0-9a-f]{40} (?:HEAD|refs/heads/stage/m1-security-dependency-db24(?:-[a-z0-9-]+)?)', line)
             for line in lines if line and not line.startswith((b'-', b'@'))) and
         all(line == b'@object-format=sha1' for line in lines if line.startswith(b'@')), 'RETURN_GIT_BUNDLE_HEADER')
    need(requirements == [BASE] and heads == [delta['head']], 'RETURN_GIT_BUNDLE_PREREQUISITE')
    result = dict(status='VERIFIED', qualification='ARTIFACT_INTEGRITY_ONLY_NOT_ACCEPTANCE',
                  manifestSHA256=anchor, filesIncludingManifest=len(value['files'])+1,
                  checkpointManifestSHA256=descriptor['manifestSHA256'], payloadFiles=len(witness['payload']['files']),
                  release='NO_GO', acceptanceGranted=False, gitBundlePrerequisites='NOT_CHECKED_WITHOUT_GIT_ROOT',
                  gitDeltaSemantics='NOT_CHECKED_WITHOUT_GIT_ROOT')
    if git_root is not None:
        result['git'] = verify_git(git_root, value['source'], inner)
        need(result['git']['evidenceTail'], 'RETURN_FINAL_TAIL_REQUIRED')
        temporary = Path(tempfile.mkdtemp(prefix='verify-return24-'))
        try:
            path = temporary/'delta.bundle'
            with path.open('xb') as stream: stream.write(raw)
            git(git_root, 'bundle', 'verify', str(path))
            # bundle verify checks prerequisites but does not validate compressed
            # pack objects. Parse all objects strictly in dry-run mode; no writes.
            need(not git(git_root, 'unpack-objects', '-n', '--strict', input_bytes=body), 'GIT_PACK_TRAILING_BYTES')
            result['gitBundlePrerequisites'] = 'VERIFIED'
            result['gitDeltaSemantics'] = 'VERIFIED_DRY_RUN_NO_OBJECT_WRITES'
        finally:
            # Only the one task-created regular file and empty task directory.
            if (temporary/'delta.bundle').exists(): node(temporary/'delta.bundle'); (temporary/'delta.bundle').unlink()
            temporary.rmdir()
    return result




def source_checks(root):
    root = Path(os.path.abspath(root))
    producer = 'scripts/phase4/build-source-worklist.mjs'
    original = git(root, 'show', BASE+':'+producer)
    need(read_regular(root/producer) == original, 'PHASE4_PRODUCER_CHANGED')
    environment = {k:v for k,v in os.environ.items() if not k.upper().startswith(('GIT_', 'NPM_', 'PHASE4_', 'GITHUB_'))}
    code, output, _ = bounded([sys.executable, '-B', 'scripts/release/full-app-j01/check.py'], root,
        environment, 1024*1024, 900)
    need(code == 0, 'RELEASE24_SOURCE_CHECK_FAILED')
    value = loads(output)
    need(type(value) is dict and value.get('valid') is True and value.get('release') == 'NO_GO' and
        value.get('source_acceptance') == 'SUBMITTED_REVIEW_REQUIRED' and
        value.get('current_source_governance') == 'RELEASE24_FINITE_SCOPE_ONLY', 'RELEASE24_SOURCE_SEMANTICS')
    node_cli = shutil.which('node'); need(node_cli is not None, 'NODE_UNAVAILABLE')
    code, _, _ = bounded([node_cli, producer, '--strict', '--check'], root, environment, 1024*1024, 90)
    need(code == 0, 'PHASE4_STRICT_FAILED')
    need(not git(root, 'status', '--porcelain=v1', '--untracked-files=all', '-z'), 'SOURCE_CHECK_CHANGED_CHECKOUT')
    return dict(release24='PASS_FINITE_SOURCE_GOVERNANCE_ONLY', phase4='PASS_UNCHANGED_PRODUCER_STRICT_CHECK',
        phase4ProducerSHA256=sha(original), executionContext='INDEPENDENT_EXACT_HEAD_CHECKOUT_NO_CI_EVENT_CLAIM', release='NO_GO', sourceAcceptance='SUBMITTED_REVIEW_REQUIRED')


def main():
    class Parser(argparse.ArgumentParser):
        def error(self, _): raise Refusal('ARGUMENT_SCHEMA')
    parser = Parser(description=__doc__)
    parser.add_argument('--expected-manifest-sha256', required=True)
    parser.add_argument('--root')
    parser.add_argument('--archive')
    parser.add_argument('--git-root')
    parser.add_argument('--expected-verifier-sha256', required=True)
    parser.add_argument('--expected-head')
    parser.add_argument('--expected-tree')
    parser.add_argument('--execute-source-checks', action='store_true')
    try:
        args = parser.parse_args()
        need(HEX64.fullmatch(args.expected_verifier_sha256) and sha(read_regular(Path(__file__))) ==
            args.expected_verifier_sha256, 'EXTERNAL_VERIFIER_ANCHOR')
        need(not args.execute_source_checks or args.git_root is not None, 'SOURCE_CHECK_REQUIRES_FULL_GIT')
        if args.git_root:
            need(type(args.expected_head) is str and HEX40.fullmatch(args.expected_head) and
                type(args.expected_tree) is str and HEX40.fullmatch(args.expected_tree), 'EXTERNAL_FINAL_IDENTITY_REQUIRED')
            need(git(args.git_root, 'rev-parse', 'HEAD').decode().strip() == args.expected_head and
                git(args.git_root, 'rev-parse', 'HEAD^{tree}').decode().strip() == args.expected_tree, 'EXTERNAL_FINAL_IDENTITY_MISMATCH')
        need(not (args.root and args.archive), 'CHOOSE_ROOT_OR_ARCHIVE')
        container = Archive(read_regular(Path(args.archive))) if args.archive else Directory(args.root or Path(__file__).parent)
        if MODE == 'return':
            result = return_packet(container, args.expected_manifest_sha256, args.git_root)
        else:
            value = checkpoint(container, args.expected_manifest_sha256)
            result = dict(status='VERIFIED', qualification='ARTIFACT_INTEGRITY_ONLY_NOT_ACCEPTANCE',
                          manifestSHA256=args.expected_manifest_sha256, filesIncludingManifest=5,
                          payloadFiles=len(value['payload']['files']), release='NO_GO', acceptanceGranted=False)
            if args.git_root: result['git'] = verify_git(args.git_root, value['source'], container)
        if args.git_root:
            need(result['git']['evidenceTail'], 'FINAL_EVIDENCE_TAIL_REQUIRED')
        result['sourceChecks'] = source_checks(args.git_root) if args.execute_source_checks else dict(state='NOT_RUN')
        if args.git_root:
            need(result['git']['head'] == args.expected_head and result['git']['tree'] == args.expected_tree and
                git(args.git_root, 'rev-parse', 'HEAD').decode().strip() == args.expected_head and
                git(args.git_root, 'rev-parse', 'HEAD^{tree}').decode().strip() == args.expected_tree and
                not git(args.git_root, 'status', '--porcelain=v1', '--untracked-files=all', '-z'),
                'EXTERNAL_FINAL_IDENTITY_MISMATCH')
        print(json.dumps(result, sort_keys=True)); return 0
    except BaseException as error:
        # No error text, filesystem path, member name, finding snippet or secret
        # fingerprint crosses this boundary, including subprocess exceptions.
        code = error.args[0] if isinstance(error, Refusal) and len(error.args) == 1 and type(error.args[0]) is str and error.args[0] in PUBLIC_CODES else 'VERIFICATION_INCOMPLETE'
        print(json.dumps(dict(status='CONTEXT_INVALID', error=code, qualification='ARTIFACT_INTEGRITY_ONLY_NOT_ACCEPTANCE',
                              release='NO_GO', acceptanceGranted=False), sort_keys=True)); return 1


PUBLIC_CODES = frozenset({'PATH_DEPTH_BOUND', 'PATH_COMPONENT_BOUND', 'GIT_FINAL_SNAPSHOT', 'GIT_OBJECT_STORE_BOUND', 'GIT_SHARED_OBJECT_STORE_FORBIDDEN', 'GIT_DIAGNOSTIC'}) | frozenset(['ARGUMENT_SCHEMA', 'ARTIFACT_HASH_MISMATCH', 'ARTIFACT_INTEGRITY_ONLY_NOT_ACCEPTANCE', 'CHECKPOINT_FILES', 'CHILD_CONTAINMENT_UNAVAILABLE', 'CHILD_STREAM_FAILURE', 'CHILD_TIMEOUT', 'CHOOSE_ROOT_OR_ARCHIVE', 'CONTEXT_INVALID', 'DUPLICATE_JSON_KEY', 'EXACT_INVENTORY_MISMATCH', 'EXECUTABLE_UNAVAILABLE', 'EXTERNAL_ANCHOR_REQUIRED', 'EXTERNAL_FINAL_IDENTITY_MISMATCH', 'EXTERNAL_FINAL_IDENTITY_REQUIRED', 'EXTERNAL_VERIFIER_ANCHOR', 'FILE_BOUND', 'FILE_CHANGED', 'FILE_CHANGED_OR_BOUND', 'FILE_MODE_OR_BOUND', 'FILE_TRUNCATED', 'FINAL_EVIDENCE_TAIL_REQUIRED', 'FLOAT_NOT_ALLOWED', 'GIT_', 'GIT_ALTERNATE_OBJECT_STORE_FORBIDDEN', 'GIT_BASE_ANCESTRY', 'GIT_BASE_TREE', 'GIT_CANDIDATE_IDENTITY', 'GIT_CHECKOUT_DIRTY', 'GIT_CHECKPOINT_COPY_MISMATCH', 'GIT_DIFF_MODE', 'GIT_DIFF_SCHEMA', 'GIT_EVIDENCE_SCOPE', 'GIT_FILTER_CONFIG', 'GIT_FREEZE_PARENT', 'GIT_FULL_HISTORY_REQUIRED', 'GIT_GRAFTS_FORBIDDEN', 'GIT_INDEX_FLAGS', 'GIT_INDEX_MODE', 'GIT_INDEX_TREE_MISMATCH', 'GIT_LINEAR_HISTORY', 'GIT_MISSING_REACHABLE_OBJECT', 'GIT_ONE_EVIDENCE_TAIL', 'GIT_PACK_TRAILING_BYTES', 'GIT_PARTIAL_CLONE_FORBIDDEN', 'GIT_PR25_ANCESTRY', 'GIT_REFUSED', 'GIT_REPLACE_FORBIDDEN', 'GIT_SOURCE_SCOPE', 'GIT_SOURCE_TREE', 'GIT_STANDALONE_CHECKOUT_REQUIRED', 'GIT_TREE_MODE', 'GIT_UNAVAILABLE', 'GIT_WORKING_BLOB_MISMATCH', 'GIT_WORKLIST_ONLY_FREEZE', 'HEAD', 'INVENTORY_SCHEMA', 'INVENTORY_TOTAL_BOUND', 'JSON_BOUND', 'JSON_DEPTH', 'JSON_INVALID', 'LINK_OR_REPARSE', 'MANIFEST_AUTHORITY', 'MANIFEST_SCHEMA', 'MANIFEST_SHA256_MISMATCH', 'NFKC', 'NODE_AUTH_TOKEN', 'NODE_OPTIONS', 'NODE_PATH', 'NODE_UNAVAILABLE', 'NONFINITE_JSON', 'NONREGULAR_NODE', 'NOT_CHECKED_WITHOUT_GIT_ROOT', 'NOT_RUN', 'NO_GO', 'NPM_', 'OUTPUT_LIMIT', 'O_BINARY', 'O_NOFOLLOW', 'PASS_FINITE_SOURCE_GOVERNANCE_ONLY', 'PASS_UNCHANGED_PRODUCER_STRICT_CHECK', 'PATH_ALIAS_OR_COLLISION', 'PAYLOAD_HASH_MISMATCH', 'PAYLOAD_QUALIFICATION', 'PAYLOAD_SCHEMA', 'PHASE4_', 'PHASE4_PRODUCER_CHANGED', 'PHASE4_STRICT_FAILED', 'PYTHONPATH', 'PYTHONSTARTUP', 'RELEASE24_FINITE_SCOPE_ONLY', 'RELEASE24_SOURCE_CHECK_FAILED', 'RELEASE24_SOURCE_SEMANTICS', 'RETURN_CHECKPOINT_ANCHOR', 'RETURN_CHECKPOINT_INVENTORY', 'RETURN_CHECKPOINT_SCHEMA', 'RETURN_DELTA_IDENTITY', 'RETURN_DELTA_SCHEMA', 'RETURN_FINAL_TAIL_REQUIRED', 'RETURN_GIT_BUNDLE_FORMAT', 'RETURN_GIT_BUNDLE_HEADER', 'RETURN_GIT_BUNDLE_PREREQUISITE', 'RETURN_GIT_PACK_CHECKSUM', 'RETURN_QUALIFICATION', 'RETURN_REQUIRED_FILES', 'RETURN_SOURCE_DISAGREEMENT', 'SANITIZED_REVIEW_RETURN_NOT_ACCEPTANCE', 'SANITIZED_TECHNICAL_EVIDENCE_NOT_ACCEPTANCE', 'SOURCE_CHECK_CHANGED_CHECKOUT', 'SOURCE_CHECK_REQUIRES_FULL_GIT', 'SOURCE_IDENTITY', 'SOURCE_SCHEMA', 'SUBMITTED_REVIEW_REQUIRED', 'SUBPROCESS_BOUND_SCHEMA', 'SUBPROCESS_INPUT_BOUND', 'TOTAL_BOUND', 'UNEXPECTED_DIRECTORY', 'UNEXPECTED_FILE', 'UNSAFE_PATH', 'UNSUPPORTED_NESTED_ARCHIVE', 'VERIFICATION_INCOMPLETE', 'VERIFIED', 'VERIFIED_DRY_RUN_NO_OBJECT_WRITES', 'WITNESS_SCHEMA', 'ZIP64_OR_MULTIDISK_UNSUPPORTED', 'ZIP_BOUND', 'ZIP_DIRECTORY_BOUND', 'ZIP_DIRECTORY_BYTES', 'ZIP_DIRECTORY_COUNT', 'ZIP_DIRECTORY_FRAME', 'ZIP_DIRECTORY_MODE', 'ZIP_DUPLICATE_MEMBER', 'ZIP_END_RECORD', 'ZIP_EXACT_INVENTORY', 'ZIP_EXPANSION_BOUND', 'ZIP_INVALID', 'ZIP_LOCAL_BOUND', 'ZIP_LOCAL_FRAME', 'ZIP_LOCAL_IDENTITY', 'ZIP_LOCAL_NAME', 'ZIP_LOCAL_OVERLAP_OR_GAP', 'ZIP_LOCAL_TRAILING_BYTES', 'ZIP_MEMBER_BOUND', 'ZIP_MISSING_MEMBER', 'ZIP_NONREGULAR_OR_UNSUPPORTED', 'ZIP_READ_INVALID', 'ZIP_TOTAL_EXPANSION_BOUND', 'ZIP_TRUNCATED_OR_BOUND', 'ZIP_UNEXPECTED_DIRECTORY'])


if __name__ == '__main__':
    sys.exit(main())
