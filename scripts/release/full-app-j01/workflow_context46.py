"""Analysis-only context for the unchanged candidate22 workflow."""
import argparse
import hashlib
import json
import os
import pathlib
import re
import stat

WORKFLOW = '.github/workflows/security-candidate22.yml'
SOURCE_SHA256 = '4a51fc735970bf2996bd89e6756f3388c619d0f7c82ec431775e26ef29271af4'
TOKENS = [
    (b'$' + b'{{ github.event.pull_request.head.sha }}', 'head', 2),
    (b'$' + b'{{ github.event.pull_request.number }}', 'pr', 1),
]


def require(ok, code):
    if not ok:
        raise ValueError(code)


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def _directory(path):
    path = pathlib.Path(os.path.abspath(path))
    for current in [path, *path.parents]:
        info = current.lstat()
        require(stat.S_ISDIR(info.st_mode) and not stat.S_ISLNK(info.st_mode)
                and not getattr(info, 'st_file_attributes', 0) & 0x400
                and pathlib.Path(os.path.realpath(current)) == current, 'CONTEXT_DIRECTORY')
    return path


def _read_regular(path, limit=65536):
    path = pathlib.Path(path)
    _directory(path.parent)
    before = path.lstat()
    require(stat.S_ISREG(before.st_mode) and before.st_nlink == 1
            and not getattr(before, 'st_file_attributes', 0) & 0x400
            and before.st_size <= limit, 'CONTEXT_REGULAR_FILE')
    fd = os.open(path, os.O_RDONLY | getattr(os, 'O_NOFOLLOW', 0) | getattr(os, 'O_BINARY', 0))
    try:
        opened = os.fstat(fd)
        chunks = []
        size = 0
        while size <= limit:
            raw = os.read(fd, min(65536, limit + 1 - size))
            if not raw:
                break
            chunks.append(raw)
            size += len(raw)
        result = b''.join(chunks)
        after, final = path.lstat(), os.fstat(fd)
        for info in [opened, after, final]:
            require(stat.S_ISREG(info.st_mode) and info.st_nlink == 1
                    and not getattr(info, 'st_file_attributes', 0) & 0x400
                    and (info.st_dev, info.st_ino, info.st_size, info.st_mtime_ns)
                    == (before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns),
                    'CONTEXT_INPUT_CHANGED')
        require(len(result) == before.st_size <= limit, 'CONTEXT_INPUT_CHANGED')
        return result
    finally:
        os.close(fd)


def observed_head(root):
    """Read a regular clone's Git HEAD without running a shell or Git program."""
    git = _directory(root / '.git')
    raw = _read_regular(git / 'HEAD', 512).decode('ascii').strip()
    if raw.startswith('ref: '):
        ref = raw[5:]
        require(re.fullmatch(r'refs/heads/[A-Za-z0-9._/-]+', ref)
                and all(part not in ('', '.', '..') for part in ref.split('/')), 'CONTEXT_REF')
        target = git.joinpath(*ref.split('/'))
        if target.exists():
            raw = _read_regular(target, 512).decode('ascii').strip()
        else:
            lines = _read_regular(git / 'packed-refs', 8 * 1024 * 1024).decode('ascii').splitlines()
            values = [line.split(' ', 1)[0] for line in lines if line.endswith(' ' + ref)]
            require(len(values) == 1, 'CONTEXT_REF')
            raw = values[0]
    require(re.fullmatch('[0-9a-f]{40}', raw) is not None, 'CONTEXT_HEAD')
    return raw


def render(raw, head, pr):
    require(type(head) is str and re.fullmatch('[0-9a-f]{40}', head)
            and head != '0' * 40, 'CONTEXT_HEAD')
    require(type(pr) is int and pr == 47, 'CONTEXT_PR')
    require(digest(raw) == SOURCE_SHA256, 'CONTEXT_SOURCE_IDENTITY')
    spans = []
    for token, name, count in TOKENS:
        require(raw.count(token) == count, 'CONTEXT_SOURCE_OMISSION')
        for match in re.finditer(re.escape(token), raw):
            spans.append((match.start(), match.end(), token, name))
    parts, records, unchanged = [], [], []
    cursor = 0
    output_offset = 0
    for start, end, token, name in sorted(spans):
        part = raw[cursor:start]
        parts.append(part)
        unchanged.append({'sourceStart': cursor, 'sourceEnd': start,
                          'outputStart': output_offset, 'sha256': digest(part)})
        output_offset += len(part)
        value = (head if name == 'head' else str(pr)).encode('ascii')
        parts.append(value)
        records.append({'field': name, 'sourceStart': start, 'sourceEnd': end,
                        'outputStart': output_offset, 'outputEnd': output_offset + len(value),
                        'sourceToken': token.decode('ascii'), 'publicValue': value.decode('ascii')})
        output_offset += len(value)
        cursor = end
    parts.append(raw[cursor:])
    unchanged.append({'sourceStart': cursor, 'sourceEnd': len(raw),
                      'outputStart': output_offset, 'sha256': digest(raw[cursor:])})
    output = b''.join(parts)
    restored = output
    for row in reversed(records):
        restored = (restored[:row['outputStart']] + row['sourceToken'].encode('ascii')
                    + restored[row['outputEnd']:])
    require(restored == raw, 'CONTEXT_LOSSLESS_RECONSTRUCTION')
    return output, records, unchanged


def materialize_context(root, output_directory, head, pr=47):
    root = _directory(root)
    require(head == observed_head(root), 'CONTEXT_HEAD_MISMATCH')
    output_directory = pathlib.Path(os.path.abspath(output_directory))
    _directory(output_directory.parent)
    require(os.path.commonpath([root, output_directory]) != str(root), 'CONTEXT_OUTPUT_IN_SOURCE')
    require(not output_directory.exists() and not output_directory.is_symlink(), 'CONTEXT_OUTPUT_EXISTS')
    source = root / WORKFLOW
    raw = _read_regular(source)
    output, records, unchanged = render(raw, head, pr)
    require(_read_regular(source) == raw and observed_head(root) == head, 'CONTEXT_INPUT_CHANGED')
    receipt = {
        'schema': 1, 'qualification': 'ANALYSIS_ONLY_TYPED_TEMPLATE_MATERIALIZATION_NOT_ORIGINAL_SCAN_PASS',
        'head': head, 'pr': pr, 'source': WORKFLOW, 'sourceSHA256': digest(raw),
        'sourceBytes': len(raw), 'output': 'candidate22-context.yml',
        'outputSHA256': digest(output), 'outputBytes': len(output),
        'substitutions': records, 'unchangedRanges': unchanged, 'losslessReconstruction': True,
        'originalModified': False, 'originalPartialParseWarningRetained': True,
        'originalRuleToolEquivalenceGranted': False, 'acceptanceGranted': False, 'release': 'NO_GO',
        'scope': 'Complete source workflow; only exact two typed public field expressions replaced. No commands executed.',
    }
    output_directory.mkdir()
    for name, value in [('candidate22-context.yml', output),
                        ('context-receipt.json', json.dumps(receipt, sort_keys=True, indent=2).encode('utf8'))]:
        with (output_directory / name).open('xb') as stream:
            stream.write(value)
            stream.flush()
            os.fsync(stream.fileno())
    require(_read_regular(source) == raw and observed_head(root) == head, 'CONTEXT_INPUT_CHANGED')
    require(_read_regular(output_directory / 'candidate22-context.yml') == output, 'CONTEXT_OUTPUT_CHANGED')
    return receipt


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', required=True, type=pathlib.Path)
    parser.add_argument('--output-directory', required=True, type=pathlib.Path)
    parser.add_argument('--head', required=True)
    parser.add_argument('--pr', required=True, type=int)
    args = parser.parse_args()
    try:
        receipt = materialize_context(args.root, args.output_directory, args.head, args.pr)
        print(json.dumps({'state': 'CONTEXT_MATERIALIZED_ANALYSIS_ONLY',
                          'outputSHA256': receipt['outputSHA256'], 'acceptanceGranted': False}))
        return 0
    except (OSError, ValueError, UnicodeError):
        print(json.dumps({'state': 'REFUSED', 'code': 'CONTEXT_INPUT_OR_OUTPUT_INCOMPLETE',
                          'acceptanceGranted': False}))
        return 1


if __name__ == '__main__':
    raise SystemExit(main())

