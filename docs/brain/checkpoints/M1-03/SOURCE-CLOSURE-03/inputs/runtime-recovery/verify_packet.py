"""Strict read-only verification for a bounded Brain-to-Codex Cloud continuation."""
import argparse,hashlib,json,pathlib,stat,sys,zipfile
ROOT=pathlib.Path(__file__).resolve().parent
SHA=lambda raw:hashlib.sha256(raw).hexdigest()

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--expected-manifest-sha256',required=True)
    args=parser.parse_args()
    path=ROOT/'PACKET_MANIFEST.json'
    raw=path.read_bytes()
    assert SHA(raw)==args.expected_manifest_sha256, 'External packet digest mismatch'
    value=json.loads(raw)
    assert value['schema_version']==1 and value['kind']=='BRAIN_CLOUD_RUNTIME_RECOVERY_PACKET'
    names=set()
    for item in value['files']:
        name=item['path'];p=pathlib.PurePosixPath(name)
        assert name==p.as_posix() and not p.is_absolute() and '..' not in p.parts and name not in names
        names.add(name);target=ROOT.joinpath(*p.parts);info=target.lstat()
        assert stat.S_ISREG(info.st_mode) and info.st_nlink==1, 'File not regular or hard-linked: '+name
        data=target.read_bytes()
        assert len(data)==item['bytes'] and SHA(data)==item['sha256'], 'File drift: '+name
    exact={p.relative_to(ROOT).as_posix() for p in ROOT.rglob('*') if p.is_file()}
    exact.discard('PACKET_MANIFEST.json')
    assert names==exact, 'Extra/missing files: '+str(sorted(names^exact))
    old=ROOT/'PRIOR/CLOUD_CONTEXT.zip'
    assert SHA(old.read_bytes())==value['prior_cloud_context_sha256']
    with zipfile.ZipFile(old) as z:
        assert z.testzip() is None
        assert SHA(z.read('TASK_MANIFEST.json'))==value['prior_cloud_context_manifest_sha256']
    assert SHA((ROOT/'PRIOR/EXACT_CODEX_CLOUD_PROMPT.md').read_bytes())==value['prior_cloud_prompt_sha256']
    print('PASS: reissued Brain Cloud runtime-recovery packet, exact '+str(len(names))+' files, original context and prompt, no admission')

if __name__=='__main__':
    try:main()
    except (AssertionError,OSError,ValueError,KeyError,zipfile.BadZipFile) as e:
        print('FAIL: '+str(e),file=sys.stderr);sys.exit(1)
