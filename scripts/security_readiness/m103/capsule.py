"""Private tmpfs copy, verified before readonly mount and isolated execution.

Requires Linux bubblewrap/user namespaces. Missing capabilities refuse execution.
Nothing is installed into workflows. Network namespace and seccomp both deny
source-bearing network access. The host can mutate only the watched originals.
"""
import ctypes.util, hashlib, json, os, pathlib, shutil, subprocess, sys

HERE=pathlib.Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
from integrity import regular, tree, require
from sandbox import clean_env, deny_network


def runtime_inputs(venv):
    """Measure the isolated interpreter's entire import path and ELF closure."""
    result=subprocess.run([str(venv/'bin/python'),'-I','-B','-c',
        'import sys,json;print(json.dumps(dict(paths=sys.path,executable=sys.executable)))'],capture_output=True,check=True)
    info=json.loads(result.stdout);directories=[];files={str(pathlib.Path(info['executable']).resolve()),'/usr/bin/uname'}
    absent=[]
    for name in info['paths']:
        p=pathlib.Path(name)
        if p.is_relative_to(venv):continue
        require(p.is_absolute() and not p.is_symlink(),'RUNTIME_IMPORT_LINK')
        if p.is_dir():
            if not any(p.is_relative_to(pathlib.Path(d['path'])) for d in directories):
                measured=tree(p,system=True);directories.append(dict(path=str(p),tree=measured))
                files.update(r['resolved'] for r in measured if r.get('resolved'))
        elif p.exists():files.add(str(p))
        else:absent.append(str(p))
    # Include the exact sandbox library, not an unmeasured find_library result.
    lib=ctypes.util.find_library('seccomp');require(lib,'SECCOMP_UNAVAILABLE')
    cache=subprocess.check_output(['/sbin/ldconfig','-p']).decode()
    seccomp=next((line.split('=>')[-1].strip() for line in cache.splitlines() if lib in line and 'x86-64' in line),None)
    require(seccomp,'SECCOMP_PATH_UNAVAILABLE');files.add(seccomp)
    elf=[pathlib.Path(p) for p in files]+[p for p in venv.rglob('*') if p.is_file() and not p.is_symlink() and (p.suffix=='.so' or p.name=='semgrep-core')]
    elf += [pathlib.Path(d['path'])/r['path'] for d in directories for r in d['tree'] if r['path'].endswith('.so')]
    for p in elf:
        with p.open('rb') as f:magic=f.read(4)
        if magic!=b'\x7fELF':continue
        out=subprocess.run(['/usr/bin/ldd',str(p)],capture_output=True,check=True).stdout.decode()
        for line in out.splitlines():
            require('not found' not in line,'RUNTIME_LIBRARY_MISSING')
            for word in line.split():
                if word.startswith('/'):files.add(word)
    rows=[]
    for name in sorted(files):
        p=pathlib.Path(name);target=p.resolve(strict=True);raw=regular(target)
        rows.append(dict(path=name,resolved=str(target),sha256=hashlib.sha256(raw).hexdigest(),bytes=len(raw),mode=target.stat().st_mode&0o777))
    return dict(directories=directories,files=rows,absent=absent,seccomp=seccomp)


def check_runtime(value):
    for d in value['directories']:require(tree(pathlib.Path(d['path']),system=True)==d['tree'],'RUNTIME_TREE_DRIFT')
    for row in value['files']:
        p=pathlib.Path(row['path'])
        require(str(p.resolve(strict=True))==row['resolved'] and hashlib.sha256(regular(p.resolve())).hexdigest()==row['sha256'],'RUNTIME_FILE_DRIFT')
    require(all(not pathlib.Path(p).exists() and not pathlib.Path(p).is_symlink() for p in value['absent']),'RUNTIME_IMPORT_ADDITION')


def inside(request):
    value=json.loads(regular(pathlib.Path(request)))
    base=pathlib.Path('/tmp/capsule');runtime=base/'runtime';runtime.mkdir()
    for name in ['tmp','proc','dev']: (runtime/name).mkdir()
    for d in value['runtime']['directories']:
        dst=runtime/d['path'].lstrip('/');dst.parent.mkdir(parents=True,exist_ok=True)
        # Materialize system aliases as the measured target bytes. The capsule
        # has no path back through an alias to a mutable host directory.
        shutil.copytree(d['path'],dst,symlinks=False)
    for row in value['runtime']['files']:
        dst=runtime/row['path'].lstrip('/');dst.parent.mkdir(parents=True,exist_ok=True)
        raw=regular(pathlib.Path(row['resolved']))
        require(hashlib.sha256(raw).hexdigest()==row['sha256'],'CAPSULE_ELF_COPY_DRIFT')
        dst.write_bytes(raw);dst.chmod(row['mode'])
    for d in value['runtime']['directories']:
        copied=tree(runtime/d['path'].lstrip('/'))
        expected=[];resolved={r['resolved']:r for r in value['runtime']['files']}
        for row in d['tree']:
            if 'link' in row:
                target=resolved[row['resolved']]
                expected.append(dict(path=row['path'],bytes=target['bytes'],mode=target['mode'],sha256=row['target_sha256']))
            else:expected.append(row)
        require(copied==expected,'CAPSULE_RUNTIME_COPY_DRIFT')
    mounts=[]
    for name,original,expected,venv in value['copies']:
        dst=base/name;shutil.copytree(original,dst,symlinks=True)
        # Interpreter symlink resolution needs the original host target here;
        # both the original and capsule target are already independently hashed.
        require(tree(dst,venv=venv)==expected,'CAPSULE_COPY_DRIFT')
        mounts += ['--ro-bind',str(dst),original]
        (runtime/original.lstrip('/')).mkdir(parents=True,exist_ok=True)
    # The unchanged native CLI initializes trust even with networking denied.
    # Give it the exact pinned certifi bytes, with no host trust-store fallback.
    cert=base/'venv/lib/python3.12/site-packages/certifi/cacert.pem'
    trust=runtime/'etc/ssl/certs/ca-certificates.crt';trust.parent.mkdir(parents=True)
    trust.write_bytes(regular(cert));trust.chmod(0o444)
    rule=base/'rule.yaml';raw=regular(pathlib.Path(value['rule']))
    require(hashlib.sha256(raw).hexdigest()==value['rule_sha256'],'CAPSULE_RULE_DRIFT');rule.write_bytes(raw)
    rule_target=runtime/value['rule'].lstrip('/');rule_target.parent.mkdir(parents=True,exist_ok=True);rule_target.touch()
    command=['/usr/bin/bwrap','--unshare-all','--die-with-parent','--new-session','--cap-drop','ALL',
        '--ro-bind',str(runtime),'/', '--tmpfs','/tmp','--proc','/proc','--dev','/dev',
        *mounts,'--ro-bind',str(rule),value['rule'],'--chdir',value['source'],
        '--',value['python'],'-I','-B',str(HERE/'capsule.py'),'_exec',value['runtime']['seccomp'],*value['command']]
    os.execv(command[0],command)


def execute(seccomp,command):
    import sandbox
    # The exact resolved library was copied into the sealed runtime image.
    sandbox.ctypes.util.find_library=lambda name:seccomp if name=='seccomp' else None
    home=pathlib.Path('/tmp/home');home.mkdir(mode=0o700)
    env=clean_env(home,pathlib.Path(command[0]).parent)
    env.update(SSL_CERT_FILE='/etc/ssl/certs/ca-certificates.crt',REQUESTS_CA_BUNDLE='/etc/ssl/certs/ca-certificates.crt')
    os.environ.clear();os.environ.update(env);deny_network()
    os.execve(command[0],command,env)


if __name__=='__main__':
    if sys.argv[1]=='_inside':inside(sys.argv[2])
    elif sys.argv[1]=='_exec':execute(sys.argv[2],sys.argv[3:])
    else:raise ValueError('PRIVATE_CAPSULE_ENTRY_REQUIRED')
