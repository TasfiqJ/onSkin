"""Bind real executables, exact public configuration and check programs."""
import hashlib
from pathlib import Path
import re
import shutil
import sys

from collect import execute
from inventory import regular
from redact import canonical, loads, require


def identity(root):
    config = loads(regular(root, 'scripts/security22/toolchain.json', 65536))
    expected = dict(schema=1, nodeMajor=22, npmVersion='11.20.0', pythonMinimum=[3, 9],
                           checks=['inventory', 'dependency', 'tooling', 'historical_workflow_contract'],
                           qualification='TECHNICAL_ONLY_NO_ADMISSION')
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
    candidates = [node.parent/'node_modules/npm', node.parent.parent/'lib/node_modules/npm']
    for bundled in list(candidates):
        if (bundled/'bin/npm-cli.js').is_file():
            code, out, _ = execute([str(node), str(bundled/'bin/npm-cli.js'), 'prefix', '--global'], root, 15, 4096)
            if code == 0:
                prefix = Path(out.decode().strip())
                if prefix.is_absolute():
                    candidates.extend([prefix/'node_modules/npm', prefix/'lib/node_modules/npm'])
    npm = next((path for path in candidates if (path/'package.json').is_file() and
                loads((path/'package.json').read_bytes()).get('version') == '11.20.0'), None)
    require(npm is not None and npm.resolve() == npm.absolute(), 'NPM_IDENTITY')
    code, out, _ = execute([str(node), str(npm/'bin/npm-cli.js'), '--version'], root, 15, 4096)
    require(code == 0 and out.strip() == b'11.20.0', 'NPM_VERSION')
    package_rows = []
    for parent, dirs, files in __import__('os').walk(npm, followlinks=False):
        for name in dirs:
            require(not (Path(parent)/name).is_symlink(), 'NPM_TOOL_LINK')
        for name in files:
            path = Path(parent)/name
            require(not path.is_symlink() and path.is_file() and path.stat().st_size < 32*1024*1024, 'NPM_TOOL_FILE')
            package_rows.append([path.relative_to(npm).as_posix(), hashlib.sha256(path.read_bytes()).hexdigest()])
            require(len(package_rows) <= 50000, 'NPM_TOOL_BOUND')
    tools['npm'] = dict(version='11.20.0', cliSHA256=hashlib.sha256((npm/'bin/npm-cli.js').read_bytes()).hexdigest(),
                        treeSHA256=hashlib.sha256(canonical(sorted(package_rows))).hexdigest(), files=len(package_rows))
    paths = ['scripts/security22/'+name for name in ('toolchain.json', 'policy.json', 'run.py', 'inventory.py',
             'toolchain.py', 'collect.py', 'evaluate.py', 'redact.py', 'dependency.mjs', 'dependency.test.mjs', 'test_security22.py')]
    paths += ['scripts/phase4/source-policy.mjs', 'scripts/postinstall.mjs', 'scripts/phase9/patch-tooling-security.mjs',
              'scripts/phase9/patch-tooling-security.test.mjs', 'scripts/phase9/tooling-security-vulnerabilities.test.mjs',
              'scripts/phase9/security_acceptance/contract.py', 'scripts/phase9/security_acceptance/proposal.json',
              'scripts/phase9/security_acceptance/source-manifest.json', 'package-lock.json', 'package.json',
              'apps/mobile/package.json', 'apps/catalog-operator-console/package.json']
    sources = {name: hashlib.sha256(regular(root, name, 16*1024*1024)).hexdigest() for name in paths}
    return dict(schema=1, tools=tools, inputs=sources, identitySHA256=hashlib.sha256(canonical([tools, sources])).hexdigest())
