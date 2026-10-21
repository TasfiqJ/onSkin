"""Export/import real historical Git custody locally. Never emit source values."""
import argparse
import datetime
import gzip
import hashlib
import json
import os
import pathlib
import subprocess
import sys


def hydrate(repo, pack, receipt, importing=False, object_source=None):
    env = dict(os.environ, GIT_NO_LAZY_FETCH='1')
    def git(*args, **kwargs):
        return subprocess.check_output(['git', '-C', str(repo), *args], env=env, **kwargs)
    if importing:
        with pack.open('rb') as source:
            subprocess.run(['git', '-C', str(repo), 'index-pack', '--stdin'],
                           stdin=source, stdout=subprocess.DEVNULL, env=env, check=True)
    witnesses = json.loads(gzip.decompress((repo/'scripts/phase9/security_acceptance/history.json.gz').read_bytes()))
    references = {}
    for row in witnesses:
        key = row['commit'] + ':' + row['path']
        expected = (row['source_blob'], row['source_sha256'])
        if key in references:
            assert references[key] == expected, 'Conflicting historical witness'
        references[key] = expected
    verified = []
    for key, (oid, sha) in sorted(references.items()):
        raw = git('cat-file', 'blob', key)
        assert hashlib.sha256(raw).hexdigest() == sha, 'Historical SHA256 disagreement: ' + key
        assert hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest() == oid, 'Historical blob disagreement: ' + key
        verified.append(dict(reference=key, git_blob=oid, sha256=sha, bytes=len(raw)))
    # Include original governance endpoints and original current-scan fixture,
    # plus full reachable history so referenced secondary files remain real.
    sys.path.insert(0, str(repo/'scripts/brain'))
    import m1_profile, m102_profile, m103_profile
    commits = {key.split(':',1)[0] for key in references}
    commits.add('569a16d07c0103e0c019f35e384a278671f2a76f')
    for module in [m1_profile, m102_profile, m103_profile]:
        commits.update(v for k,v in vars(module).items() if 'BASE' in k and isinstance(v,str) and len(v)==40)
    commits.add(git('rev-parse', 'HEAD').decode().strip())
    acquired=[]
    if object_source is not None:
        reachable=git('rev-list','--objects','--missing=print',*sorted(commits)).decode().splitlines()
        for missing in sorted(line[1:] for line in reachable if line.startswith('?')):
            source_command=['git','-C',str(object_source)]
            kind=subprocess.check_output(source_command+['cat-file','-t',missing],env=env).decode().strip()
            raw=subprocess.check_output(source_command+['cat-file',kind,missing],env=env)
            assert hashlib.sha1(kind.encode()+b' '+str(len(raw)).encode()+b'\0'+raw).hexdigest()==missing
            actual=git('hash-object','-w','-t',kind,'--stdin',input=raw).decode().strip()
            assert actual==missing
            acquired.append(dict(oid=missing,kind=kind,sha256=hashlib.sha256(raw).hexdigest(),bytes=len(raw),
                                 provenance='authorized local Git source',required_by_endpoints=sorted(commits)))
    identities = [dict(commit=c, tree=git('rev-parse', c+'^{tree}').decode().strip()) for c in sorted(commits)]
    if not importing:
        assert not pack.exists(), 'New private export required'
        with pack.open('xb') as output:
            subprocess.run(['git', '-C', str(repo), 'pack-objects', '--stdout', '--revs'],
                           input=('\n'.join(sorted(commits))+'\n').encode(), stdout=output, env=env, check=True)
    value = dict(schema_version=1, kind='LOCAL_GIT_OBJECT_CUSTODY', admission='NONE',
                 observed_at=datetime.datetime.now(datetime.timezone.utc).isoformat(), operation='IMPORT' if importing else 'EXPORT',
                 network='NO_LAZY_FETCH; local Git only', source_commit=git('rev-parse','HEAD').decode().strip(),
                 source_tree=git('rev-parse','HEAD^{tree}').decode().strip(),
                 pack_sha256=hashlib.file_digest(pack.open('rb'), 'sha256').hexdigest() if hasattr(hashlib,'file_digest') else hashlib.sha256(pack.read_bytes()).hexdigest(),
                 pack_bytes=pack.stat().st_size, witnesses=len(witnesses), references=verified, endpoints=identities,
                 acquired_objects=acquired)
    receipt.write_bytes((json.dumps(value,indent=2)+'\n').encode())
    print(value['operation'], len(verified), 'exact historical references;', len(identities), 'real commit/tree endpoints; pack',value['pack_sha256'])


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repo', type=pathlib.Path, required=True)
    parser.add_argument('--pack', type=pathlib.Path, required=True)
    parser.add_argument('--receipt', type=pathlib.Path, required=True)
    parser.add_argument('--import-pack', action='store_true')
    parser.add_argument('--object-source',type=pathlib.Path)
    args=parser.parse_args()
    hydrate(args.repo.resolve(), args.pack.resolve(), args.receipt.resolve(), args.import_pack, args.object_source)
