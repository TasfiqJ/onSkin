"""Original secret job diagnostics only. No G97 policy, waiver or acceptance.

Acquire two exact Linux executables, scan all local refs and an object-derived
current snapshot, and bind the actual processes to source/run/tool bytes.
"""
import argparse, datetime, hashlib, io, json, os, pathlib, platform, re
import shutil, subprocess, sys, tarfile, tempfile, urllib.request, urllib.parse, gzip

PINS = {
    'gitleaks': dict(version='8.24.3',
        url='https://github.com/gitleaks/gitleaks/releases/download/v8.24.3/gitleaks_8.24.3_linux_x64.tar.gz',
        asset='9991e0b2903da4c8f6122b5c3186448b927a5da4deef1fe45271c3793f4ee29c',
        binary='e18325d568268b6efb6cd0cc721f8bea5667f4cd1c8d03618ab61987f41269ad'),
    'trufflehog': dict(version='3.99.3',
        url='https://github.com/trufflesecurity/trufflehog/releases/download/v3.99.3/trufflehog_3.99.3_linux_amd64.tar.gz',
        asset='029b182e0ed35fd5b02cd1eadc2a94bd457ab14ad22a9380b6e5d9652261d28d',
        binary='f315489f12691f669fd16bafeaf983168dcdd22c0652b541ff7e41dc7da9aa61'),
}
PROOF = 'secret-scan-proof.json'
def require(ok, message):
    if not ok: raise ValueError('SECRET_' + message)
def sha(body): return hashlib.sha256(body).hexdigest()
def canon(value): return json.dumps(value, sort_keys=True, separators=(',', ':'), allow_nan=False).encode()
def stamp(): return datetime.datetime.now(datetime.timezone.utc).isoformat()
def write(path, value):
    with pathlib.Path(path).open('xb') as f: f.write(canon(value) + b'\n')
def git(root, *args):
    return subprocess.check_output(['git', '-C', str(root), *args], stderr=subprocess.PIPE)
def blobs(root, oids):
    raw = subprocess.check_output(['git', '-C', str(root), 'cat-file', '--batch'],
        input=('\n'.join(oids) + '\n').encode())
    offset = 0
    for oid in oids:
        end = raw.index(b'\n', offset); header = raw[offset:end].decode().split()
        require(header[:2] == [oid, 'blob'], 'BLOB_IDENTITY')
        size = int(header[2]); offset = end + 1
        yield raw[offset:offset + size]; offset += size + 1
    require(offset == len(raw), 'BLOB_STREAM')
def regular(path, empty=False):
    path = pathlib.Path(path); info = path.lstat()
    require(path.is_file() and not path.is_symlink() and info.st_nlink == 1 and
            not getattr(info, 'st_file_attributes', 0) & 0x400 and
            (empty or info.st_size > 0), 'NONREGULAR_INPUT')
    return path.read_bytes()
def load(path):
    def pairs(items):
        value = {}
        for k, v in items:
            require(k not in value, 'DUPLICATE_JSON_FIELD'); value[k] = v
        return value
    return json.loads(regular(path), object_pairs_hook=pairs,
                      parse_constant=lambda v: require(False, 'NONFINITE_JSON'))

def extract(archive, name):
    """Inspect all members before returning the sole executable; never extractall."""
    seen = set(); executable = None
    with tarfile.open(fileobj=io.BytesIO(archive), mode='r:gz') as tar:
        for member in tar:
            path = pathlib.PurePosixPath(member.name)
            require(member.name not in seen and not path.is_absolute() and
                    '..' not in path.parts and '\\' not in member.name and
                    not re.match(r'^[A-Za-z]:', member.name), 'ARCHIVE_PATH')
            seen.add(member.name)
            require(member.isfile() and 0 <= member.size <= 128 * 1024**2, 'ARCHIVE_MEMBER')
            if member.name == name:
                executable = tar.extractfile(member).read()
    require(executable is not None, 'ARCHIVE_EXECUTABLE_MISSING')
    return executable

def version_record(path, name):
    args = [str(path), 'version' if name == 'gitleaks' else '--version']
    p = subprocess.run(args, capture_output=True, timeout=20, check=False)
    value = dict(argv=args, exit=p.returncode, stdout=p.stdout.decode(), stderr=p.stderr.decode())
    validate_version(value, name)
    return value

def validate_version(value, name):
    require(set(value) == {'argv', 'exit', 'stdout', 'stderr'} and type(value['exit']) is int and
            value['exit'] == 0 and value['argv'][1:] ==
            ['version' if name == 'gitleaks' else '--version'], 'TOOL_VERSION')
    text = value['stdout'] + value['stderr']
    require(text == ('8.24.3\n' if name == 'gitleaks' else 'trufflehog 3.99.3\n'), 'TOOL_VERSION')

def acquire(directory):
    require(sys.platform == 'linux' and platform.machine().lower() in ('x86_64', 'amd64'),
            'LINUX_X86_64_REQUIRED')
    directory = pathlib.Path(directory).absolute()
    require(not os.path.lexists(directory), 'FRESH_TOOL_DIRECTORY_REQUIRED')
    directory.mkdir(parents=True); tools = {}
    for name, pin in PINS.items():
        target = directory / name
        with urllib.request.urlopen(pin['url'], timeout=90) as response:
            require(response.geturl().startswith('https://'), 'HTTPS_REQUIRED')
            body = response.read(128 * 1024**2 + 1)
        require(sha(body) == pin['asset'], 'ASSET_BYTES:' + name)
        binary = extract(body, name)
        require(sha(binary) == pin['binary'], 'EXECUTABLE_BYTES:' + name)
        (directory / (name + '.tar.gz')).write_bytes(body)
        with target.open('xb') as f: f.write(binary)
        target.chmod(0o755)
        tools[name] = dict(**pin, path=str(target), version_result=version_record(target, name))
    write(directory / 'tools.json', tools)
    return tools

def verify_tools(directory):
    tools = load(pathlib.Path(directory) / 'tools.json')
    require(set(tools) == set(PINS), 'TOOL_INVENTORY')
    for name, pin in PINS.items():
        value = tools[name]
        require(set(value) == set(pin) | {'path', 'version_result'} and
                all(value[k] == v for k, v in pin.items()), 'TOOL_PIN:' + name)
        require(sha(regular(value['path'])) == pin['binary'] and
                sha(regular(pathlib.Path(directory) / (name + '.tar.gz'))) == pin['asset'],
                'TOOL_BYTES:' + name)
        require(version_record(value['path'], name) == value['version_result'], 'TOOL_VERSION:' + name)
    return tools

def git_scope(root):
    """All locally available refs, complete reachable history, every HEAD blob."""
    head = git(root, 'rev-parse', 'HEAD').decode().strip()
    require(git(root, 'rev-parse', '--is-shallow-repository').strip() == b'false', 'SHALLOW_HISTORY')
    refs = git(root, 'for-each-ref', '--format=%(refname) %(objectname)').decode().splitlines()
    commits = sorted(set(git(root, 'rev-list', '--all', 'HEAD').decode().splitlines()))
    require(head in commits and bool(refs), 'NEWEST_COMMIT_MISSING')
    patch_commits = []; current_commit = None
    # Gitleaks8.24.3 counts commits only after its built-in binary/deletion
    # filter. Keep every reachable commit above, and independently reproduce
    # that counter without adding exclusions to the scanner command.
    for line in git(root, 'log', '--all', 'HEAD', '--full-history', '--diff-merges=first-parent',
                    '--format=COMMIT%H', '--numstat', '--diff-filter=d').decode().splitlines():
        if line.startswith('COMMIT'): current_commit = line[6:]
        elif re.match(r'^\d+\t\d+\t', line) and current_commit not in patch_commits: patch_commits.append(current_commit)
    rows = []
    for item in git(root, 'ls-tree', '-rz', '--full-tree', head).split(b'\0'):
        if not item: continue
        meta, raw_name = item.split(b'\t', 1); mode, kind, oid = meta.decode().split()
        name = raw_name.decode('utf-8'); path = pathlib.PurePosixPath(name)
        require(mode in ('100644', '100755') and kind == 'blob' and
                not path.is_absolute() and '..' not in path.parts and '\\' not in name and
                not re.match(r'^[A-Za-z]:', name), 'UNSUPPORTED_GIT_ENTRY')
        rows.append(dict(path=name, mode=mode, object=oid))
    for row, blob in zip(rows, blobs(root, [r['object'] for r in rows])):
        row.update(bytes=len(blob), sha256=sha(blob))
    return dict(head=head, tree=git(root, 'rev-parse', 'HEAD^{tree}').decode().strip(),
        parents=git(root, 'show', '-s', '--format=%P', head).decode().split(),
        refs=refs, commits=commits, patch_commits=sorted(patch_commits), snapshot=rows,
        snapshot_sha256=sha(canon(rows)))

def commands(tools, mirror, snapshot, sarif, current):
    gl = tools['gitleaks']['path']; th = tools['trufflehog']['path']
    common = ['--redact=100', '--exit-code=2', '--log-level=info']
    return {
        'gitleaks-history': [gl, 'detect', '--source=' + mirror, '--log-opts=--all --full-history --diff-merges=first-parent',
            *common, '--report-format=sarif', '--report-path=' + sarif],
        'gitleaks-current': [gl, 'detect', '--no-git', '--source=' + snapshot,
            *common, '--report-format=json', '--report-path=' + current],
        'trufflehog-history': [th, 'git', pathlib.Path(mirror).as_uri(), '--bare', '--fail',
            '--no-update', '--json', '--only-verified', '--concurrency=1'],
        'trufflehog-current': [th, 'filesystem', snapshot, '--fail', '--no-update', '--json',
            '--only-verified', '--concurrency=1'],
    }

def execute(argv, cwd):
    started = stamp()
    try:
        p = subprocess.run(argv, cwd=cwd, capture_output=True, timeout=1200, check=False)
        code, out, err = p.returncode, p.stdout, p.stderr
    except subprocess.TimeoutExpired as e:
        code, out, err = 124, e.stdout or b'', e.stderr or b''
    return dict(argv=argv, cwd=str(cwd), started=started, finished=stamp(), exit=code,
        stdout=out.decode('utf-8'), stderr=err.decode('utf-8'),
        stdout_sha256=sha(out), stderr_sha256=sha(err))

def scan(root, tools_directory, work, output, run_id, expected_head, source_ref):
    root = pathlib.Path(root).resolve(); work = pathlib.Path(work).absolute()
    output = pathlib.Path(output).absolute(); output.mkdir(parents=True, exist_ok=True)
    require(not os.path.lexists(work), 'FRESH_SCAN_DIRECTORY_REQUIRED'); work.mkdir(parents=True)
    tools = verify_tools(tools_directory); started = stamp(); scope = git_scope(root)
    require(scope['head'] == expected_head and source_ref, 'SOURCE_IDENTITY')
    mirror = work / 'history.git'; snapshot = work / 'current-source'; snapshot.mkdir()
    subprocess.run(['git', 'clone', '--mirror', '--no-hardlinks', '--no-local', str(root), str(mirror)],
                   check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    require(git_scope(mirror) == scope, 'MIRROR_SCOPE_DRIFT')
    for row, blob in zip(scope['snapshot'], blobs(root, [r['object'] for r in scope['snapshot']])):
        target = snapshot / row['path']; target.parent.mkdir(parents=True, exist_ok=True)
        with target.open('xb') as f: f.write(blob)
    sarif = output / 'gitleaks-results.sarif'; current = work / 'current-gitleaks.json'
    argv = commands(tools, str(mirror), str(snapshot), str(sarif), str(current))
    results = {name: execute(args, work) for name, args in argv.items()}
    results['gitleaks-current']['report'] = load(current)
    # Gitleaks raw reports are already --redact=100. Never persist TruffleHog raw
    # secret fields into uploadable artifacts. A finding still refuses below.
    for name in ('trufflehog-history', 'trufflehog-current'):
        if results[name]['stdout'].strip():
            results[name]['stdout'] = '[REDACTED SENSITIVE SCANNER OUTPUT; raw digest retained]\n'
            results[name]['sensitive_output_redacted'] = True
    for row in scope['snapshot']:
        require(sha(regular(snapshot / row['path'], empty=True)) == row['sha256'], 'SNAPSHOT_CHANGED')
    require(git_scope(root) == scope and verify_tools(tools_directory) == tools, 'SOURCE_OR_TOOL_CHANGED')
    write(output / 'gitleaks-tool.json', dict(version='8.24.3', sha256=PINS['gitleaks']['binary'], exit=0))
    proof = dict(schema=1, purpose='ORIGINAL_SECRET_DIAGNOSTIC_NOT_G97_ACCEPTANCE',
        source=scope, source_ref=source_ref, run_id=run_id, started=started, finished=stamp(),
        tools=tools, commands=results, mirror=str(mirror), snapshot=str(snapshot),
        sarif=str(sarif), current_report=str(current),
        sarif_sha256=sha(regular(sarif)))
    write(output / PROOF, proof)
    return proof

def current_disposition(root, records, prefix, commit):
    """Reuse unchanged typed Git proofs; never refresh historical QA or policy."""
    if not records: return dict(records=0, independentAcceptance=False)
    try:
        import history
        here = pathlib.Path(__file__).parent
        prior = json.loads(gzip.decompress(regular(here / 'history.json.gz')))
        rules = load(here / 'proposal.json')['rules']
        return history.verify_current(root, records, prefix, commit, prior,
            regular(here / 'gitleaks.toml').decode(), rules)[0]
    except (ValueError, KeyError, TypeError, subprocess.SubprocessError) as error:
        raise ValueError('SECRET_CURRENT_SOURCE_FINDINGS_UNREVIEWED') from error

def validate_proof(directory, root, commit, run_id, now=None):
    directory = pathlib.Path(directory); proof = load(directory / PROOF)
    require(set(proof) == {'schema', 'purpose', 'source', 'source_ref', 'run_id', 'started', 'finished',
        'tools', 'commands', 'mirror', 'snapshot', 'sarif', 'current_report', 'sarif_sha256'}, 'PROOF_SCHEMA')
    require(type(proof['schema']) is int and proof['schema'] == 1 and
        proof['purpose'] == 'ORIGINAL_SECRET_DIAGNOSTIC_NOT_G97_ACCEPTANCE', 'PROOF_SCHEMA')
    require(proof['source'] == git_scope(root) and proof['source']['head'] == commit and
        proof['run_id'] == run_id and re.fullmatch('[1-9][0-9]{0,19}', run_id), 'SOURCE_OR_RUN_DRIFT')
    now = now or datetime.datetime.now(datetime.timezone.utc)
    start, end = [datetime.datetime.fromisoformat(proof[k]) for k in ('started', 'finished')]
    require(start <= end <= now and now - start <= datetime.timedelta(hours=6), 'STALE_PROOF')
    require(proof['source_ref'] and proof['source_ref'] in
        {r.split()[0] for r in proof['source']['refs']}, 'SOURCE_REF_MISSING')
    require(dict(r.split() for r in proof['source']['refs'])[proof['source_ref']] == commit, 'SOURCE_REF_DRIFT')
    if os.environ.get('GITHUB_ACTIONS') == 'true':
        require(proof['source_ref'] == os.environ.get('GITHUB_REF') and
                commit == os.environ.get('GITHUB_SHA') and run_id == os.environ.get('GITHUB_RUN_ID'), 'GITHUB_CONTEXT_DRIFT')
    tools = proof['tools']; require(set(tools) == set(PINS), 'TOOL_INVENTORY')
    for name, pin in PINS.items():
        value = tools[name]
        require(set(value) == set(pin) | {'path', 'version_result'} and
            all(value[k] == v for k, v in pin.items()) and
            value['version_result']['argv'][0] == value['path'], 'TOOL_IDENTITY:' + name)
        validate_version(value['version_result'], name)
    expected = commands(tools, proof['mirror'], proof['snapshot'], proof['sarif'], proof['current_report'])
    require(set(proof['commands']) == set(expected), 'COMMAND_INVENTORY')
    for name, argv in expected.items():
        row = proof['commands'][name]
        require(set(row) == {'argv', 'cwd', 'started', 'finished', 'exit', 'stdout', 'stderr',
            'stdout_sha256', 'stderr_sha256'} | ({'report'} if name == 'gitleaks-current' else set()),
            'COMMAND_SCHEMA')
        require(row['argv'] == argv and row['cwd'] == str(pathlib.Path(proof['mirror']).parent), 'COMMAND_SCOPE')
        require(start <= datetime.datetime.fromisoformat(row['started']) <=
            datetime.datetime.fromisoformat(row['finished']) <= end, 'COMMAND_TIME')
        require(type(row['exit']) is int and row['exit'] in ((0, 2) if name.startswith('gitleaks') else (0, 183)), 'SCANNER_EXECUTION_ERROR')
        for stream in ('stdout', 'stderr'):
            require(sha(row[stream].encode()) == row[stream + '_sha256'], 'OUTPUT_BYTES')
        clean_stderr = re.sub(r'\x1b\[[0-9;]*m', '', row['stderr'])
        if name.startswith('gitleaks'):
            require(re.search(r'scanned ~\d+ bytes .* in ', clean_stderr) and
                    re.search(r'(?:no leaks found|leaks found: \d+)\s*$', clean_stderr), 'TRUNCATED_OUTPUT')
        else:
            events = [json.loads(line) for line in row['stderr'].splitlines() if line.strip()]
            finished = [e for e in events if e.get('msg') == 'finished scanning']
            require(len(finished) == 1 and events[-1] == finished[0] and
                    finished[0].get('trufflehog_version') == '3.99.3' and
                    finished[0].get('chunks', 0) > 0 and finished[0].get('bytes', 0) > 0 and
                    finished[0].get('verified_secrets') == 0 and finished[0].get('unverified_secrets') == 0 and
                    not any(e.get('level') == 'error' or 'error' in e for e in events), 'TRUNCATED_OR_FAILED_OUTPUT')
        if name == 'gitleaks-history':
            counts = re.findall(r'(\d+) commits scanned', clean_stderr)
            require(len(counts) == 1 and int(counts[0]) == len(proof['source']['patch_commits']), 'HISTORY_COUNT_DRIFT')
        if name.startswith('trufflehog'):
            require(row['exit'] == 0 and not row['stdout'].strip(), 'VERIFIED_FINDINGS')
    sarif = regular(directory / 'gitleaks-results.sarif')
    require(sha(sarif) == proof['sarif_sha256'], 'SARIF_SUBSTITUTION')
    report = json.loads(sarif)
    require(report.get('version') == '2.1.0' and len(report.get('runs', [])) == 1 and
            isinstance(report['runs'][0].get('results'), list), 'SARIF_SCHEMA')
    history = proof['commands']['gitleaks-history']; current = proof['commands']['gitleaks-current']
    require(bool(report['runs'][0]['results']) == (history['exit'] == 2) and
            isinstance(current['report'], list) and bool(current['report']) == (current['exit'] == 2), 'EXIT_REPORT_DRIFT')
    for row, records in [(history, report['runs'][0]['results']), (current, current['report'])]:
        clean = re.sub(r'\x1b\[[0-9;]*m', '', row['stderr'])
        found = re.findall(r'leaks found: (\d+)\s*$', clean)
        require((len(found) == 1 and int(found[0]) == len(records)) if row['exit'] == 2 else
                bool(re.search(r'no leaks found\s*$', clean)) and not records, 'TRUNCATED_REPORT')
    current_disposition(root, current['report'], proof['snapshot'], commit)
    return proof

def main():
    p = argparse.ArgumentParser(); p.add_argument('mode', choices=['acquire', 'scan', 'check', 'outcome'])
    p.add_argument('--tools'); p.add_argument('--work'); p.add_argument('--output')
    p.add_argument('--root', default='.'); p.add_argument('--commit'); p.add_argument('--run-id'); p.add_argument('--source-ref')
    p.add_argument('--scanner', choices=['gitleaks', 'trufflehog'])
    a = p.parse_args()
    try:
        if a.mode == 'acquire': acquire(a.tools)
        elif a.mode == 'scan': scan(a.root, a.tools, a.work, a.output, a.run_id, a.commit, a.source_ref)
        elif a.mode == 'check': validate_proof(a.output, a.root, a.commit, a.run_id)
        else:
            proof = load(pathlib.Path(a.output) / PROOF)
            codes = [proof['commands'][a.scanner + '-' + mode]['exit'] for mode in ('history', 'current')]
            for mode in ('history', 'current'):
                row = proof['commands'][a.scanner + '-' + mode]
                print(json.dumps(dict(command=row['argv'], raw_exit=row['exit'])))
            return next((code for code in codes if code), 0)
        print(json.dumps(dict(status='DIAGNOSTIC_RECORDED' if a.mode != 'check' else 'DIAGNOSTIC_BOUND', acceptanceGranted=False)))
        return 0
    except (ValueError, OSError, KeyError, TypeError, subprocess.SubprocessError) as e:
        print(json.dumps(dict(status='REJECTED', code=str(e), acceptanceGranted=False)))
        return 1
if __name__ == '__main__': sys.exit(main())
