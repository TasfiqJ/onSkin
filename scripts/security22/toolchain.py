"""Bind real executables, exact public configuration and check programs."""
import hashlib
import os
from pathlib import Path
import posixpath
import re
import shutil
import stat
import sys

from collect import execute
from inventory import regular, remember, safe
from redact import Refusal, canonical, loads, require

PINNED_NPM_MODEL_SHA256 = 'c1d3e494bb27b0ae253a41f06bd2621786f0d215dff2679e9005b25f6c3ca0b9'
NPM_MAX_FILES = 50000
NPM_MAX_BYTES = 64 * 1024 * 1024
NPM_MAX_FILE = 32 * 1024 * 1024
NPM_MAX_DEPTH = 64


def _stamp(info):
    # Windows stat(path) infers executable bits from suffix; fstat(fd) cannot.
    mode = info.st_mode & ~0o111 if os.name == 'nt' else info.st_mode
    return (info.st_dev, info.st_ino, mode, info.st_nlink, info.st_size,
            info.st_mtime_ns, info.st_ctime_ns)


def _tool_read(root, name):
    try:
        path = root
        for part in safe(name):
            path = path / part
            info = path.lstat()
            require(not stat.S_ISLNK(info.st_mode) and not getattr(info, 'st_file_attributes', 0) & 1024,
                    'NPM_TOOL_LINK')
        require(stat.S_ISREG(info.st_mode) and info.st_nlink == 1 and
                not info.st_mode & (stat.S_ISUID | stat.S_ISGID) and info.st_size <= NPM_MAX_FILE, 'NPM_TOOL_FILE')
        descriptor = os.open(path, os.O_RDONLY | getattr(os, 'O_NOFOLLOW', 0) | getattr(os, 'O_BINARY', 0))
        with os.fdopen(descriptor, 'rb') as source:
            require(_stamp(os.fstat(source.fileno())) == _stamp(info), 'NPM_TOOL_CHANGED')
            raw = source.read(info.st_size + 1)
            require(len(raw) == info.st_size and _stamp(os.fstat(source.fileno())) == _stamp(info), 'NPM_TOOL_CHANGED')
        require(_stamp(path.lstat()) == _stamp(info), 'NPM_TOOL_CHANGED')
        return raw
    except OSError:
        raise Refusal('NPM_TOOL_READ') from None


def npm_inventory(npm, model):
    """Reconcile all observed content with a separately pinned installer model."""
    npm = Path(npm).absolute()
    require(npm.resolve() == npm, 'NPM_IDENTITY')
    require(os.name in ('nt', 'posix'), 'NPM_MODEL_IDENTITY')
    profile = model['profiles'][os.name]
    require(set(profile) == {'files', 'bytes', 'treeSHA256'} and
            type(profile['files']) is int and 0 < profile['files'] <= NPM_MAX_FILES and
            type(profile['bytes']) is int and 0 < profile['bytes'] <= NPM_MAX_BYTES and
            type(profile['treeSHA256']) is str and re.fullmatch('[0-9a-f]{64}', profile['treeSHA256']), 'NPM_MODEL_IDENTITY')
    require(type(model['bins']) is list and 0 < len(model['bins']) <= 64, 'NPM_BIN_METADATA')
    declared = {}
    for entry in model['bins']:
        require(set(entry) == {'name', 'target', 'link', 'targetSHA256', 'package', 'binValue'} and
                type(entry['name']) is str and re.fullmatch('[a-z0-9][a-z0-9_-]*', entry['name']), 'NPM_BIN_METADATA')
        link = 'node_modules/.bin/' + entry['name']
        require(link not in declared, 'NPM_BIN_METADATA')
        safe(entry['target']); safe(entry['package'])
        require(type(entry['link']) is str and entry['link'] == posixpath.relpath(entry['target'], 'node_modules/.bin') and
                type(entry['targetSHA256']) is str and re.fullmatch('[0-9a-f]{64}', entry['targetSHA256']), 'NPM_BIN_METADATA')
        declared[link] = entry
    rows, links, directories, aliases, explicit = [], {}, set(), {}, set()
    total, nodes = 0, 0

    def walk(directory, prefix='', depth=0):
        nonlocal total, nodes
        require(depth <= NPM_MAX_DEPTH and len(directories) <= NPM_MAX_FILES, 'NPM_TOOL_BOUND')
        try:
            before = directory.lstat()
            require(stat.S_ISDIR(before.st_mode) and not stat.S_ISLNK(before.st_mode) and
                    not getattr(before, 'st_file_attributes', 0) & 1024, 'NPM_TOOL_LINK')
            # scandir raises on denied enumeration; no default os.walk omission.
            names = []
            with os.scandir(directory) as stream:
                for entry in stream:
                    nodes += 1
                    require(nodes <= NPM_MAX_FILES, 'NPM_TOOL_BOUND')
                    names.append(entry.name)
            names.sort()
        except OSError:
            raise Refusal('NPM_TOOL_ENUMERATION') from None
        for name in names:
            relative = prefix + name
            path = directory / name
            try:
                info = path.lstat()
            except OSError:
                raise Refusal('NPM_TOOL_READ') from None
            require(not getattr(info, 'st_file_attributes', 0) & 1024, 'NPM_TOOL_LINK')
            if stat.S_ISDIR(info.st_mode):
                remember(relative, 'directory', aliases, explicit)
                directories.add(relative)
                walk(path, relative + '/', depth + 1)
            elif stat.S_ISLNK(info.st_mode):
                remember(relative, 'file', aliases, explicit)
                require(os.name == 'posix' and relative in declared and info.st_nlink == 1, 'NPM_TOOL_LINK')
                try:
                    target = os.readlink(path)
                    require(target == declared[relative]['link'] and _stamp(path.lstat()) == _stamp(info), 'NPM_BIN_TARGET')
                except OSError:
                    raise Refusal('NPM_BIN_TARGET') from None
                links[relative] = target
            else:
                remember(relative, 'file', aliases, explicit)
                raw = _tool_read(npm, relative)
                total += len(raw)
                rows.append([relative, hashlib.sha256(raw).hexdigest()])
                require(len(rows) <= NPM_MAX_FILES and total <= NPM_MAX_BYTES, 'NPM_TOOL_BOUND')
        try:
            require(_stamp(directory.lstat()) == _stamp(before), 'NPM_TOOL_CHANGED')
        except OSError:
            raise Refusal('NPM_TOOL_CHANGED') from None

    walk(npm)
    expected_links = {name: entry['link'] for name, entry in declared.items()} if os.name == 'posix' else {}
    require(links == expected_links, 'NPM_EXPECTED_CONTENT')
    expected_bins = set(declared) if os.name == 'posix' else {name + suffix for name in declared for suffix in ('', '.cmd', '.ps1')}
    seen_bins = {name for name, _ in rows if name.startswith('node_modules/.bin/')} | set(links)
    require(seen_bins == expected_bins, 'NPM_EXPECTED_CONTENT')
    implied = {str(parent) for name in [*(name for name, _ in rows), *links] for parent in Path(name).parents if str(parent) != '.'}
    implied = {name.replace('\\', '/') for name in implied}
    require(directories == implied, 'NPM_EXPECTED_CONTENT')
    tree = hashlib.sha256(canonical(sorted(rows))).hexdigest()
    require(len(rows) == profile['files'] and total == profile['bytes'] and tree == profile['treeSHA256'], 'NPM_EXPECTED_CONTENT')
    hashes = dict(rows)
    for entry in declared.values():
        package = loads(_tool_read(npm, entry['package']))
        bins = package.get('bin')
        if type(bins) is str:
            bins = {package['name'].split('/')[-1]: bins}
        require(type(bins) is dict and bins.get(entry['name']) == entry['binValue'] and
                type(entry['binValue']) is str and not entry['binValue'].startswith('/') and
                '..' not in entry['binValue'].split('/'), 'NPM_BIN_METADATA')
        target = posixpath.normpath(posixpath.join(posixpath.dirname(entry['package']), entry['binValue']))
        require(target == entry['target'] and hashes.get(target) == entry['targetSHA256'] and
                hashlib.sha256(_tool_read(npm, target)).hexdigest() == entry['targetSHA256'], 'NPM_BIN_TARGET')
    require('bin/npm-cli.js' in hashes, 'NPM_EXPECTED_CONTENT')
    return dict(version='11.20.0', cliSHA256=hashes['bin/npm-cli.js'], treeSHA256=tree,
                files=len(rows), bytes=total, links=len(links),
                installationModelSHA256=hashlib.sha256(canonical(model)).hexdigest())


def identity(root):
    config = loads(regular(root, 'scripts/security22/toolchain.json', 65536))
    expected = dict(schema=1, nodeMajor=22, npmVersion='11.20.0', pythonMinimum=[3, 9],
                           checks=['inventory', 'dependency', 'tooling', 'historical_workflow_contract'],
                           qualification='TECHNICAL_ONLY_NO_ADMISSION')
    model = config.pop('npmInstallation', None)
    require(hashlib.sha256(canonical(model)).hexdigest() == PINNED_NPM_MODEL_SHA256, 'NPM_MODEL_IDENTITY')
    require(config == expected and all(type(config[key]) is type(value) for key, value in expected.items()) and
            all(type(value) is int for value in config['pythonMinimum']), 'TOOLCHAIN_CONFIG')
    require(sys.version_info[:2] >= (3, 9), 'PYTHON_VERSION')
    tools = {}
    for name, command, pattern in [('git', ['git', '--version'], rb'git version [0-9.]+(?:\.windows\.\d+)?'),
                                    ('node', ['node', '--version'], rb'v22\.[0-9]+\.[0-9]+')]:
        path = shutil.which(name)
        require(path is not None and not Path(path).is_symlink(), 'TOOL_UNAVAILABLE')
        code, out, _ = execute(command, root, 15, 4096)
        require(code == 0 and re.fullmatch(pattern, out.strip()), 'TOOL_VERSION')
        tools[name] = dict(version=out.decode().strip(), executableSHA256=hashlib.sha256(Path(path).read_bytes()).hexdigest())
    tools['python'] = dict(version='.'.join(map(str, sys.version_info[:3])),
                           executableSHA256=hashlib.sha256(Path(sys.executable).read_bytes()).hexdigest())
    node = Path(shutil.which('node')).resolve()
    # The declared profile requires a clean global prefix with a regular Node
    # binary. Do not probe or execute an unverified alternate npm installation.
    npm = node.parent/'node_modules/npm' if os.name == 'nt' else node.parent.parent/'lib/node_modules/npm'
    require(npm.resolve() == npm.absolute(), 'NPM_IDENTITY')
    tools['npm'] = npm_inventory(npm, model)
    package = loads(_tool_read(npm, 'package.json'))
    require(package.get('name') == 'npm' and package.get('version') == '11.20.0', 'NPM_IDENTITY')
    code, out, _ = execute([str(node), str(npm/'bin/npm-cli.js'), '--version'], root, 15, 4096)
    require(code == 0 and out.strip() == b'11.20.0', 'NPM_VERSION')
    paths = ['scripts/security22/'+name for name in ('toolchain.json', 'policy.json', 'run.py', 'inventory.py',
             'toolchain.py', 'collect.py', 'evaluate.py', 'redact.py', 'dependency.mjs', 'dependency.test.mjs', 'test_security22.py')]
    paths += ['scripts/phase4/source-policy.mjs', 'scripts/postinstall.mjs', 'scripts/phase9/patch-tooling-security.mjs',
              'scripts/phase9/patch-tooling-security.test.mjs', 'scripts/phase9/tooling-security-vulnerabilities.test.mjs',
              'scripts/phase9/security_acceptance/contract.py', 'scripts/phase9/security_acceptance/proposal.json',
              'scripts/phase9/security_acceptance/source-manifest.json', 'package-lock.json', 'package.json',
              'apps/mobile/package.json', 'apps/catalog-operator-console/package.json']
    paths += ['scripts/security22/patch-tooling.mjs', 'scripts/security22/patch-tooling.test.mjs',
              'scripts/security22/backports.json']
    paths += ['scripts/security23/test_partial_results.py', 'scripts/security23/test_toolchain.py']
    sources = {name: hashlib.sha256(regular(root, name, 16*1024*1024)).hexdigest() for name in paths}
    return dict(schema=1, tools=tools, inputs=sources, identitySHA256=hashlib.sha256(canonical([tools, sources])).hexdigest())
