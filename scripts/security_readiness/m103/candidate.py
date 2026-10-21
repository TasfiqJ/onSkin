"""Private Linux/Python3.12 diagnostic candidate; never an admission producer."""
import argparse, base64, csv, email, hashlib, io, json, os, pathlib, platform
import re, stat, subprocess, sys, urllib.parse, urllib.request, zipfile

SHA = lambda data: hashlib.sha256(data).hexdigest()
HERE = pathlib.Path(__file__).resolve().parent
REPO = HERE.parents[2]
INPUTS = REPO / 'docs/brain/checkpoints/M1-03/OVERNIGHT-01/inputs/BRAIN_STATE/CANDIDATE_TOOL_INPUTS.json'
PINS = REPO / 'scripts/phase9/security_acceptance/semgrep-requirements-linux-py312.txt'


def require(ok, reason):
    if not ok: raise ValueError(reason)


def write_json(path, value):
    path.write_text(json.dumps(value, sort_keys=True, indent=2) + '\n')


def official(url):
    u = urllib.parse.urlparse(url)
    require(u.scheme == 'https' and u.hostname in {'pypi.org','files.pythonhosted.org'} and
            not u.username and not u.password, 'OFFICIAL_HTTPS_REQUIRED')
    with urllib.request.urlopen(url, timeout=120) as response:
        v = urllib.parse.urlparse(response.geturl())
        require(v.scheme == 'https' and v.hostname in {'pypi.org','files.pythonhosted.org'}, 'REDIRECT_REFUSED')
        data = response.read(160*1024*1024 + 1)
    require(len(data) <= 160*1024*1024, 'DOWNLOAD_LIMIT')
    return data


def wheel_members(raw):
    """Validate every regular member and every RECORD hash before any execution."""
    members = {}
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        for info in archive.infolist():
            name = info.filename
            require(not name.startswith('/') and
                    not any(x in ('','..','.') for x in name.rstrip('/').split('/')) and
                    not any(c in name for c in '\\:\0') and name not in members,
                    'WHEEL_MEMBER_PATH_OR_DUPLICATE')
            mode = info.external_attr >> 16
            require(not stat.S_ISLNK(mode) and (not stat.S_IFMT(mode) or stat.S_ISREG(mode) or
                    (info.is_dir() and stat.S_ISDIR(mode))), 'WHEEL_LINK_OR_SPECIAL')
            if info.is_dir():
                require(info.file_size == 0, 'WHEEL_DIRECTORY_DATA')
                continue
            require(info.file_size <= 384*1024*1024, 'WHEEL_MEMBER_LIMIT')
            require(not name.endswith(('.pth','.egg-link')) and name not in {'sitecustomize.py','usercustomize.py'} and
                    not re.search(r'\.data/(?:purelib|platlib)/(?:sitecustomize|usercustomize)\.py$',name), 'WHEEL_STARTUP_HOOK')
            members[name] = archive.read(info)
    records = [n for n in members if n.endswith('.dist-info/RECORD')]
    require(len(records) == 1, 'WHEEL_RECORD_COUNT')
    rows = list(csv.reader(io.StringIO(members[records[0]].decode())))
    require(len(rows) == len(members) and len({r[0] for r in rows}) == len(rows), 'WHEEL_RECORD_SET')
    require({r[0] for r in rows} == set(members), 'WHEEL_RECORD_OMISSION')
    for name, digest, size in rows:
        if name == records[0]: require(digest == size == '', 'WHEEL_RECORD_SELF_HASH')
        else:
            expected = 'sha256=' + base64.urlsafe_b64encode(hashlib.sha256(members[name]).digest()).decode().rstrip('=')
            require(digest == expected and size == str(len(members[name])), 'WHEEL_RECORD_DRIFT')
    for name, data in members.items():
        if name.endswith('.dist-info/entry_points.txt'):
            import configparser
            c = configparser.ConfigParser(); c.read_string(data.decode())
            require(set(c.sections()) <= {'console_scripts','gui_scripts','opentelemetry_distro',
                    'opentelemetry_configurator','opentelemetry_instrumentor','opentelemetry_context',
                    'opentelemetry_environment_variables','opentelemetry_meter_provider',
                    'opentelemetry_tracer_provider','opentelemetry_logs_exporter',
                    'opentelemetry_metrics_exporter','opentelemetry_traces_exporter',
                    'opentelemetry_logger_provider','pyinstaller40','pytest11','cli','distutils.setup_keywords',
                    'opentelemetry_id_generator','opentelemetry_propagator','opentelemetry_resource_detector',
                    'opentelemetry_traces_sampler'}, 'WHEEL_ENTRYPOINT_GROUP')
            require(all(re.fullmatch(r'[\w.]+:[\w.]+(?:\s*\[[\w, ]+\])?', v) or
                        re.fullmatch(r'[\w.]+', v) for section in c.sections() for _,v in c.items(section)),
                    'WHEEL_ENTRYPOINT_SYNTAX')
    return members


def derive(raw):
    original = wheel_members(raw)
    metadata = [n for n in original if n.endswith('.dist-info/METADATA')]
    require(len(metadata) == 1, 'WHEEL_METADATA_COUNT')
    name = metadata[0]; before = original[name]
    old, new = b'Requires-Dist: mcp==1.29.0', b'Requires-Dist: mcp==1.30.0'
    require(before.splitlines().count(old) == 1 and new not in before, 'EXACT_MCP_REQUIREMENT_REQUIRED')
    changed = dict(original); changed[name] = before.replace(old, new)
    record = name.rsplit('/',1)[0] + '/RECORD'
    rows = list(csv.reader(io.StringIO(original[record].decode())))
    for row in rows:
        if row[0] == name:
            row[1:] = ['sha256='+base64.urlsafe_b64encode(hashlib.sha256(changed[name]).digest()).decode().rstrip('='), str(len(changed[name]))]
    s = io.StringIO(newline=''); csv.writer(s, lineterminator='\n').writerows(rows); changed[record] = s.getvalue().encode()
    out = io.BytesIO()
    with zipfile.ZipFile(out,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
        for n in sorted(changed):
            info = zipfile.ZipInfo(n, (1980,1,1,0,0,0)); info.create_system=3
            info.external_attr=(stat.S_IFREG | (0o755 if n.endswith('/semgrep-core') else 0o644)) << 16
            info.compress_type=zipfile.ZIP_DEFLATED; z.writestr(info, changed[n], compresslevel=9)
    result = out.getvalue(); validated=wheel_members(result)
    require(set(original)==set(validated) and
            {n for n in original if original[n]!=validated[n]} == {name,record}, 'DERIVATIVE_SCOPE_DRIFT')
    return result, dict(original_sha256=SHA(raw), derived_sha256=SHA(result),
        changed_members=[name,record], before_requirement=old.decode(), after_requirement=new.decode(),
        unchanged_member_count=len(original)-2,
        native_cores={n:SHA(b) for n,b in original.items() if '/bin/' in n},
        upstream_release=False, admission='NONE', classification='NON_ADMITTING_UNREVIEWED')


def installed_tree(root):
    rows=[]
    for p in sorted(root.rglob('*')):
        if '__pycache__' in p.parts or p.suffix == '.pyc': continue
        # Venv interpreter links are platform launch inputs, recorded separately.
        if p.is_symlink():
            if p == root/'lib64':
                require(os.readlink(p)=='lib' and (root/'lib').is_dir(), 'INSTALLED_LINK')
                rows.append(dict(path='lib64',link='lib'));continue
            require(p.parent == root/'bin' and p.name in {'python','python3','python3.12'}, 'INSTALLED_LINK')
            rows.append(dict(path=p.relative_to(root).as_posix(),link=os.readlink(p),target_sha256=SHA(p.read_bytes())))
        elif p.is_file(): rows.append(dict(path=p.relative_to(root).as_posix(),bytes=p.stat().st_size,sha256=SHA(p.read_bytes())))
    return rows


def verify(root):
    manifest=json.loads((root/'candidate.json').read_bytes())
    require(manifest['admission']=='NONE' and manifest['classification']=='NON_ADMITTING_UNREVIEWED', 'CANDIDATE_AUTHORITY')
    require(installed_tree(root/'venv') == manifest['installed_tree'], 'INSTALLED_TREE_DRIFT')
    for row in manifest['wheels']:
        require(SHA((root/'wheelhouse'/row['filename']).read_bytes())==row['install_sha256'], 'WHEEL_DRIFT')
    result=subprocess.run([str(root/'venv/bin/python'),'-I','-B','-m','pip','check'],capture_output=True)
    require(result.returncode==0, 'INSTALLED_REQUIREMENT_MISMATCH')
    return manifest


def prepare(root):
    require(sys.platform=='linux' and platform.machine()=='x86_64' and sys.version_info[:2]==(3,12), 'LINUX_X86_64_PY312_REQUIRED')
    root=root.absolute()
    require(root.parent == pathlib.Path.home() and root.name.startswith('onskin-overnight01-'),
            'PRIVATE_DIRECT_CHILD_REQUIRED')
    require(root.is_absolute() and not root.exists() and not root.is_symlink() and
            not root.is_relative_to(REPO) and not root.is_relative_to(pathlib.Path('/usr')),
            'NEW_PRIVATE_ROOT_REQUIRED')
    # Dedicated root: no inherited credentials, source-bearing request or scanner execution here.
    root.mkdir(mode=0o700); (root/'wheelhouse').mkdir(); (root/'originals').mkdir(); (root/'metadata').mkdir()
    inputs=json.loads(INPUTS.read_bytes()); overrides={r['name']:r for r in inputs['packages']}
    for row in inputs['preserved_reference_inputs']:
        require(SHA((REPO/row['path']).read_bytes())==row['sha256'], 'FROZEN_INPUT_DRIFT')
    pins=[]
    for line in PINS.read_text().splitlines():
        if not line or line.startswith('#'): continue
        name,version,digest=re.fullmatch(r'([\w.-]+)==([^ ]+) --hash=sha256:([0-9a-f]{64})',line).groups()
        if name in overrides: version,digest=overrides[name]['version'],overrides[name]['wheel_sha256']
        pins.append((name,version,digest))
    rows=[]; requirements=[]; derivative=None
    for name,version,digest in pins:
        url='https://pypi.org/pypi/'+name+'/'+version+'/json'
        raw=official(url); meta=json.loads(raw)
        (root/'metadata'/(name+'.json')).write_bytes(raw)
        matches=[r for r in meta['urls'] if r['digests']['sha256']==digest and r['filename'].endswith('.whl')]
        require(len(matches)==1, 'EXACT_OFFICIAL_WHEEL_UNAVAILABLE:'+name)
        item=matches[0]; data=official(item['url'])
        require(SHA(data)==digest and len(data)==item['size'], 'UPSTREAM_WHEEL_DRIFT:'+name)
        if name in overrides: require(len(data)==overrides[name]['wheel_bytes'], 'UPSTREAM_WHEEL_SIZE')
        wheel_members(data)
        filename=item['filename']; require(pathlib.Path(filename).name==filename, 'WHEEL_FILENAME')
        if name=='semgrep':
            (root/'originals'/filename).write_bytes(data); data,derivative=derive(data)
            require(derive((root/'originals'/filename).read_bytes())[0]==data, 'NONDETERMINISTIC_DERIVATIVE')
        (root/'wheelhouse'/filename).write_bytes(data)
        rows.append(dict(name=name,version=version,filename=filename,official_url=item['url'],
            metadata_sha256=SHA(raw),original_sha256=digest,install_sha256=SHA(data),bytes=len(data)))
        requirements.append(name+'=='+version+' --hash=sha256:'+SHA(data))
        write_json(root/'acquisition.json',dict(admission='NONE',wheels=rows,derivative=derivative))
    (root/'requirements.txt').write_text('\n'.join(requirements)+'\n')
    subprocess.run([sys.executable,'-I','-B','-m','venv',str(root/'venv')],check=True)
    command=[str(root/'venv/bin/python'),'-I','-B','-m','pip','--isolated','install','--no-index',
        '--no-compile','--only-binary=:all:','--find-links',str(root/'wheelhouse'),'--require-hashes',
        '--requirement',str(root/'requirements.txt'),'--report',str(root/'install-report.json')]
    with (root/'install.stdout').open('wb') as out,(root/'install.stderr').open('wb') as err:
        result=subprocess.run(command,stdout=out,stderr=err)
    require(result.returncode==0, 'DEPENDENCY_CONSISTENCY_INSTALL_FAILED; see private install.stderr')
    result=subprocess.run([str(root/'venv/bin/python'),'-I','-B','-m','pip','check'],capture_output=True)
    (root/'pip-check.txt').write_bytes(result.stdout+result.stderr)
    require(result.returncode==0, 'INSTALLED_REQUIREMENT_MISMATCH')
    write_json(root/'candidate.json',dict(admission='NONE',classification='NON_ADMITTING_UNREVIEWED',
        wheels=rows,derivative=derivative,argv=command,raw_exit=0,installed_tree=installed_tree(root/'venv'),
        python=sys.version,platform=platform.platform(),requirements_sha256=SHA((root/'requirements.txt').read_bytes())))
    verify(root)
    print('Prepared and verified candidate; admission NONE.')


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__); p.add_argument('command',choices=['prepare','verify']);p.add_argument('private_root',type=pathlib.Path)
    a=p.parse_args()
    if a.command=='prepare': prepare(a.private_root)
    else: verify(a.private_root);print('Candidate integrity only; admission NONE.')
