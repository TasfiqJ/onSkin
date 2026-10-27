"""Exact Git metadata and public working-byte reconciliation, with explicit custody gaps.

Historical finding artifacts are NEVER opened. Metadata is not content scanning.
"""
import hashlib
import io
import os
from pathlib import Path
import re
import stat
import struct
import tarfile
import unicodedata
import zipfile
import zlib

from collect import execute
from redact import Refusal, canonical, require


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


GIT_COMMAND = ['git', '--no-pager', '--no-replace-objects', '--no-optional-locks',
               '-c', 'core.fsmonitor=false', '-c', 'core.untrackedCache=false',
               '-c', 'diff.external=', '-c', 'core.hooksPath=']


def git(root, *args):
    code, out, _ = execute([*GIT_COMMAND, *args], root, seconds=180, limit=64 * 1024 * 1024)
    require(code == 0, 'GIT_INCOMPLETE')
    return out


def safe(name):
    require(isinstance(name, str) and name and not name.startswith('/') and
            not any(c in name for c in '\\:<>|?*"') and not any(ord(c) < 32 for c in name), 'UNSAFE_PATH')
    parts = name.rstrip('/').split('/')
    require(all(p and p not in ('.', '..') and not p.endswith(('.', ' ')) and
                not re.fullmatch(r'(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?', p, re.I)
                for p in parts), 'UNSAFE_PATH')
    return parts


def remember(name, kind, aliases, explicit):
    parts = safe(name)
    for index in range(1, len(parts) + 1):
        path = '/'.join(parts[:index])
        key = unicodedata.normalize('NFKC', path).casefold()
        node = (path, 'directory' if index < len(parts) else kind)
        require(key not in aliases or aliases[key] == node, 'PATH_ALIAS_OR_COLLISION')
        aliases[key] = node
    key = unicodedata.normalize('NFKC', '/'.join(parts)).casefold()
    require(key not in explicit, 'DUPLICATE_PATH')
    explicit.add(key)


def protected(name):
    # Publicly committed historical evidence is still outside this authority to open.
    lower = name.casefold()
    return (lower.startswith('docs/brain/checkpoints/m1-03/') and
            not lower.startswith('docs/brain/checkpoints/m1-03/security-recovery-22/')) or any(
                token in lower for token in ('gitleaks-results', 'trufflehog-results', 'secret-scan-proof',
                                              'private-review', 'original-secret', 'raw-findings'))


def regular(root, name, maximum):
    parts = safe(name)
    path = root
    for part in parts:
        path = path / part
        info = path.lstat()
        require(not stat.S_ISLNK(info.st_mode) and not getattr(info, 'st_file_attributes', 0) & 1024,
                'LINK_OR_REPARSE')
    require(stat.S_ISREG(info.st_mode) and info.st_nlink == 1 and info.st_size <= maximum,
            'NONREGULAR_OR_OVERSIZED')
    require(not info.st_mode & (stat.S_ISUID | stat.S_ISGID), 'SPECIAL_MODE')
    with path.open('rb') as stream:
        # Bound by the witnessed size as well as the policy ceiling; detect growth
        # without allocating a maximum-size buffer for every small source file.
        raw = stream.read(info.st_size + 1)
    after = path.lstat()
    require(len(raw) <= maximum and (info.st_ino, info.st_size, info.st_mtime_ns) ==
            (after.st_ino, after.st_size, after.st_mtime_ns), 'CHANGED_INPUT')
    return raw


def archive_kind(name, raw):
    lower = name.casefold()
    if raw.startswith(b'PK\x03\x04') or raw.startswith(b'PK\x05\x06') or lower.endswith('.zip'):
        return 'zip'
    if raw.startswith(b'\x1f\x8b') or lower.endswith(('.gz', '.tgz')):
        return 'gzip'
    if lower.endswith('.tar') or len(raw) > 262 and raw[257:262] == b'ustar':
        return 'tar'
    if raw.startswith((b'7z\xbc\xaf\x27\x1c', b'Rar!', b'\xfd7zXZ\0', b'BZh')) or lower.endswith(('.7z', '.rar', '.xz', '.bz2')):
        return 'unsupported'
    return None


def archives(name, raw, policy, totals, depth=0):
    kind = archive_kind(name, raw)
    if kind is None:
        totals['binaryLeaves' if b'\0' in raw else 'textLeaves'] += 1
        return
    totals['containers'] += 1
    require(kind != 'unsupported' and depth < policy['maxArchiveDepth'], 'ARCHIVE_UNSUPPORTED_OR_DEPTH')
    if kind == 'gzip':
        pending = raw
        while pending:
            require(pending.startswith(b'\x1f\x8b'), 'GZIP_TRAILING_DATA')
            remaining = min(policy['maxFileBytes'], policy['maxExpandedBytes'] - totals['expandedBytes'])
            require(remaining >= 0, 'ARCHIVE_TOTAL_LIMIT')
            decoder = zlib.decompressobj(16 + zlib.MAX_WBITS)
            try:
                data = decoder.decompress(pending, remaining + 1)
            except zlib.error:
                require(False, 'GZIP_INVALID')
            consumed = len(pending) - len(decoder.unused_data)
            require(decoder.eof and len(data) <= remaining and consumed > 0 and
                    len(data) <= max(1048576, consumed * policy['maxRatio']), 'ARCHIVE_EXPANSION_LIMIT')
            totals['members'] += 1
            totals['gzipMembers'] = totals.get('gzipMembers', 0) + 1
            require(totals['members'] <= policy['maxArchiveMembers'], 'ARCHIVE_MEMBER_LIMIT')
            totals['expandedBytes'] += len(data)
            archives(name[:-3] if name.lower().endswith('.gz') else name+'.tar', data, policy, totals, depth + 1)
            pending = decoder.unused_data
        return
    aliases, explicit = {}, set()
    if kind == 'zip':
        # Bound directory allocation before ZipFile constructs its member objects.
        end = raw.rfind(b'PK\x05\x06', max(0, len(raw)-65557))
        require(end >= 0 and end + 22 <= len(raw), 'ZIP_DIRECTORY')
        count = struct.unpack_from('<H', raw, end + 10)[0]
        require(count < 65535 and count <= policy['maxArchiveMembers'] and
                struct.unpack_from('<H', raw, end + 4)[0] == 0 and
                struct.unpack_from('<H', raw, end + 6)[0] == 0, 'ZIP_DIRECTORY_LIMIT')
    handle = zipfile.ZipFile(io.BytesIO(raw)) if kind == 'zip' else tarfile.open(fileobj=io.BytesIO(raw), mode='r:')
    with handle:
        member_end = 0
        members = handle.infolist() if kind == 'zip' else iter(handle)
        if kind == 'zip':
            require(len(members) == count, 'ZIP_DIRECTORY_COUNT')
        for item in members:
            member = item.filename if kind == 'zip' else item.name
            directory = item.is_dir() if kind == 'zip' else item.isdir()
            remember(member, 'directory' if directory else 'file', aliases, explicit)
            totals['members'] += 1
            require(totals['members'] <= policy['maxArchiveMembers'], 'ARCHIVE_MEMBER_LIMIT')
            if kind == 'zip':
                mode = item.external_attr >> 16
                require(stat.S_IFMT(mode) in (0, stat.S_IFDIR if directory else stat.S_IFREG) and
                        not item.external_attr & 1024 and not item.flag_bits & 1 and
                        not mode & (stat.S_ISUID | stat.S_ISGID), 'ARCHIVE_MODE')
                size = item.file_size
                require(size <= max(1048576, item.compress_size * policy['maxRatio']), 'ARCHIVE_RATIO')
            else:
                require(item.isdir() or item.isfile(), 'ARCHIVE_NONREGULAR')
                require(not item.mode & (stat.S_ISUID | stat.S_ISGID), 'ARCHIVE_MODE')
                size = item.size
                member_end = max(member_end, (item.offset_data + size + 511) // 512 * 512)
            require(type(size) is int and 0 <= size <= policy['maxFileBytes'], 'ARCHIVE_MEMBER_SIZE')
            if directory:
                require(size == 0, 'ARCHIVE_DIRECTORY_DATA')
                continue
            if protected(member) or protected(name):
                totals['custodyMembers'] += 1
                continue
            totals['expandedBytes'] += size
            require(totals['expandedBytes'] <= policy['maxExpandedBytes'], 'ARCHIVE_TOTAL_LIMIT')
            source = handle.open(item) if kind == 'zip' else handle.extractfile(item)
            with source:
                data = source.read(policy['maxFileBytes'] + 1)
            require(len(data) == size, 'ARCHIVE_TRUNCATED')
            archives(member, data, policy, totals, depth + 1)
        if kind == 'tar':
            # tarfile stops at its first end marker. Do not hide a second TAR or
            # arbitrary nonzero trailing content behind that marker.
            tail = raw[member_end:]
            require(len(tail) >= 1024 and not any(tail), 'TAR_TRAILING_DATA')


def snapshot(root, policy):
    root = Path(root).absolute()
    for parent in (root, *root.parents):
        info = parent.lstat()
        require(stat.S_ISDIR(info.st_mode) and not stat.S_ISLNK(info.st_mode) and
                not getattr(info, 'st_file_attributes', 0) & 1024, 'ROOT_LINK_OR_REPARSE')
    require(Path(git(root, 'rev-parse', '--show-toplevel').decode().strip()).resolve() == root.resolve(), 'GIT_ROOT_MISMATCH')
    graft = Path(git(root, 'rev-parse', '--git-path', 'info/grafts').decode().strip())
    if not graft.is_absolute():
        graft = root / graft
    require(not git(root, 'for-each-ref', '--format=%(refname)', 'refs/replace/').strip() and
            not os.path.lexists(graft), 'GIT_REPLACEMENT_OR_GRAFT')
    require(git(root, 'rev-parse', '--is-shallow-repository').strip() == b'false', 'SHALLOW_REPOSITORY')
    require(not git(root, 'status', '--porcelain=v1', '-z', '--untracked-files=all'), 'DIRTY_SOURCE')
    flags = git(root, 'ls-files', '-v', '-z').split(b'\0')
    require(all(not row or row.startswith(b'H ') for row in flags), 'INDEX_FLAGS')
    head = git(root, 'rev-parse', 'HEAD').decode().strip()
    tree = git(root, 'rev-parse', 'HEAD^{tree}').decode().strip()
    require(git(root, 'rev-parse', policy['baseHead']+'^{tree}').decode().strip() == policy['baseTree'], 'BASE_TREE')
    git(root, 'merge-base', '--is-ancestor', policy['baseHead'], head)
    refs = {}
    for ref in policy['requiredRefs']:
        value = git(root, 'rev-parse', '--verify', ref).decode().strip()
        require(re.fullmatch('[0-9a-f]{40}', value), 'REF_IDENTITY')
        refs[ref] = value
    require(refs[policy['requiredRefs'][0]] == policy['baseHead'], 'BASE_REF_MOVED')
    scope = [head] + list(refs.values())
    history = git(root, 'rev-list', '--objects', '--no-object-names', *scope).splitlines()
    # No arbitrary --all refs or private/dangling commits are read.
    code, object_data, _ = execute([*GIT_COMMAND, 'cat-file', '--batch-check'], root, 180,
                                  64*1024*1024, input_data=b'\n'.join(history)+b'\n')
    checked = object_data.splitlines()
    require(code == 0 and len(checked) == len(history) and all(
        re.fullmatch(rb'[0-9a-f]{40} (blob|tree|commit|tag) [0-9]+', row) and
        row.split()[0] == oid for row, oid in zip(checked, history)), 'HISTORY_OBJECTS_INCOMPLETE')
    commits = len(git(root, 'rev-list', *scope).splitlines())
    rows, aliases, explicit = [], {}, set()
    modes = {}; byte_count = 0; matched = 0; custody = 0; oversized = 0; unsupported = 0
    archive_refusals = {}
    totals = dict(containers=0, members=0, gzipMembers=0, expandedBytes=0, binaryLeaves=0, textLeaves=0, custodyMembers=0)
    for entry in git(root, 'ls-tree', '-r', '-l', '-z', head).split(b'\0'):
        if not entry:
            continue
        meta, raw_name = entry.split(b'\t', 1)
        mode, kind, oid, length = meta.decode().split()
        name = raw_name.decode('utf-8', errors='strict')
        remember(name, 'file', aliases, explicit)
        require(mode in ('100644', '100755') and kind == 'blob' and length.isdigit(), 'GIT_MODE')
        size = int(length); modes[mode] = modes.get(mode, 0) + 1
        row = dict(path=name, mode=mode, object=oid, bytes=size)
        if protected(name):
            custody += 1; row['content'] = 'BLOCKED_EXTERNAL_CUSTODY'
        elif size > policy['maxFileBytes']:
            oversized += 1; row['content'] = 'OVERSIZED_INCOMPLETE'
        else:
            raw = regular(root, name, policy['maxFileBytes'])
            require(hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest() == oid, 'WORKTREE_BLOB_MISMATCH')
            if os.name != 'nt':
                require(bool((root/name).stat().st_mode & 0o111) == (mode == '100755'), 'WORKTREE_EXECUTABLE_MODE')
            row.update(content='MATCHED', sha256=digest(raw)); byte_count += len(raw); matched += 1
            try:
                archives(name, raw, policy, totals)
            except (ValueError, OSError, EOFError, zipfile.BadZipFile, tarfile.TarError) as error:
                unsupported += 1
                codes = {'UNSAFE_PATH', 'PATH_ALIAS_OR_COLLISION', 'DUPLICATE_PATH', 'ARCHIVE_UNSUPPORTED_OR_DEPTH',
                         'GZIP_TRAILING_DATA', 'GZIP_INVALID', 'ARCHIVE_TOTAL_LIMIT', 'ARCHIVE_EXPANSION_LIMIT',
                         'ARCHIVE_MEMBER_LIMIT', 'ZIP_DIRECTORY', 'ZIP_DIRECTORY_LIMIT', 'ZIP_DIRECTORY_COUNT',
                         'ARCHIVE_MODE', 'ARCHIVE_RATIO', 'ARCHIVE_NONREGULAR', 'ARCHIVE_MEMBER_SIZE',
                         'ARCHIVE_DIRECTORY_DATA', 'ARCHIVE_TRUNCATED', 'TAR_TRAILING_DATA'}
                reason = error.args[0] if isinstance(error, Refusal) and error.args and error.args[0] in codes else 'MALFORMED_OR_INACCESSIBLE'
                archive_refusals[reason] = archive_refusals.get(reason, 0) + 1
        rows.append(row)
    ignored = git(root, 'ls-files', '--others', '--ignored', '--exclude-standard', '-z').split(b'\0')
    generated = {}; unknown = 0
    for entry in ignored:
        if not entry:
            continue
        name = entry.decode('utf-8', errors='strict'); safe(name)
        category = 'dependency_installation' if name.startswith(('node_modules/', 'apps/mobile/node_modules/',
                                                                'apps/catalog-operator-console/node_modules/')) else 'generated_not_scanned'
        generated[category] = generated.get(category, 0) + 1
        if category == 'generated_not_scanned':
            unknown += 1
    require(not git(root, 'status', '--porcelain=v1', '-z', '--untracked-files=all') and
            git(root, 'rev-parse', 'HEAD').decode().strip() == head, 'SOURCE_CHANGED')
    return dict(schema=1, head=head, tree=tree, inventorySHA256=digest(canonical(rows)), refs=refs,
                history=dict(commits=commits, reachableObjects=len(set(history)),
                             objectSetSHA256=digest(b'\n'.join(sorted(set(history)))),
                             objectMetadataSHA256=digest(object_data),
                             contentScan='BLOCKED_EXTERNAL_CUSTODY', scope='HEAD_AND_EXPLICIT_PUBLIC_REFS'),
                metadata=dict(state='PASS', expected=len(rows), inventoried=len(rows), modes=modes,
                              modeQualification='GIT_MODES; WINDOWS_EXECUTABLE_BIT_NOT_REPRESENTABLE' if os.name == 'nt' else 'GIT_AND_WORKTREE_MODES'),
                workingBytes=dict(state='PASS' if not (custody or oversized) else 'INCOMPLETE',
                                  expected=len(rows), matched=matched, custodyBlocked=custody,
                                  oversized=oversized, bytesMatched=byte_count),
                archiveCoverage=dict(state='PASS' if not (unsupported or custody or totals['custodyMembers']) else 'INCOMPLETE',
                                     unsupportedOrRefusedContainers=unsupported, binaryContentScan='NOT_RUN',
                                     refusalCategories=archive_refusals,
                                     qualification='RECOGNIZED_CONTAINER_STRUCTURE_ONLY; NOT_A_CONTENT_SECURITY_SCAN', **totals),
                generated=dict(state='INCOMPLETE' if unknown else 'EXPLICIT_DEPENDENCY_COMPONENT_SCOPE', counts=generated))
