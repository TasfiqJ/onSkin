"""Frozen successor refusal controls; only disposable in-memory readers are mutated."""
import copy
import importlib.util
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('dependency13_check', HERE/'check.py')
check = importlib.util.module_from_spec(spec)
spec.loader.exec_module(check)


def main():
    current = check.git('cat-file','blob','843be0fdf1fe9354dfdc4750118481486d9a778a')
    authority = check.dependency13_guard(current)
    rejected = 0
    def expect(name, raw=current, overrides=None, expected=1):
        nonlocal rejected
        def reader(path):
            return (overrides or {}).get(path, check.regular(check.ROOT/path))
        try:
            check.dependency13_guard(raw, reader)
            actual, error = 0, None
        except (ValueError, KeyError, TypeError, OSError) as exc:
            actual, error = 1, str(exc)
        print(json.dumps(dict(case=name, exit=actual, expected_exit=expected, error=error)), flush=True)
        assert actual == expected, (name, error)
        rejected += actual
    expect('authentic-current', expected=0)
    changes = [
        ('changed-node', lambda x:x['packages']['node_modules/vitest'].__setitem__('version','5.0.5')),
        ('extra-node', lambda x:x['packages'].__setitem__('node_modules/unissued',{'version':'1.0.0'})),
        ('removed-node', lambda x:x['packages'].pop('node_modules/@vitest/spy')),
        ('reordered-nodes', lambda x:x.__setitem__('packages',dict(reversed(list(x['packages'].items()))))),
        ('unrelated-package', lambda x:x['packages']['node_modules/zod'].__setitem__('version','4.6.6')),
        ('untrusted-registry', lambda x:x['packages']['node_modules/vitest'].__setitem__('resolved','https://example.invalid/other.tgz')),
        ('unverified-integrity', lambda x:x['packages']['node_modules/vitest'].__setitem__('integrity','sha512-forged')),
        ('root-script', lambda x:x['packages'][''].__setitem__('scripts',{'postinstall':'unissued'})),
        ('native-extra', lambda x:x['packages'].__setitem__('node_modules/native-unissued',{'version':'1.0.0','hasInstallScript':True})),
    ]
    for name, mutate in changes:
        value = json.loads(current); mutate(value)
        expect(name, (json.dumps(value, indent=2)+'\n').encode())
    expect('byte-only-whitespace', current+b' ')
    expect('old-blob-as-new-authority',check.git('show',check.RELEASE12_BASE+':package-lock.json'))
    for name, mutate in [
        ('wrong-version',lambda x:x.__setitem__('schemaVersion',2)),
        ('wrong-PR',lambda x:x.__setitem__('pr',16)),
        ('wrong-source',lambda x:x['base'].__setitem__('commit','0'*40)),
        ('wrong-original-lock',lambda x:x['originalLock'].__setitem__('sha256',check.RELEASE12_LOCK_SHA256)),
        ('fake-native-archive',lambda x:x['claims'].__setitem__('releaseArchive','INSPECTED')),
        ('fake-Apple',lambda x:x['claims'].__setitem__('appleAttestation','ACCEPTED')),
        ('wrong-user-space-classification',lambda x:x['candidateNodes']['node_modules/vitest'].__setitem__('dev',False)),
        *[(f'enable-{key}',lambda x,k=key:x['admissions'].__setitem__(k,True)) for key in authority['admissions']],
        *[(f'clear-{key}',lambda x,k=key:x['gates'].__setitem__(k,'PASS')) for key in authority['gates']],
    ]:
        value=copy.deepcopy(authority); mutate(value)
        expect(name,overrides={check.RELEASE13_MANIFEST:(json.dumps(value,indent=2)+'\n').encode()})
    for row in authority['registry']:
        for key in ('metadata','attestations'):
            path=row[key]['path']
            expect('altered-'+key+':'+row['path'],overrides={path:check.regular(check.ROOT/path)+b' '})
    for path in (authority['provenance']['path'],authority['dependencyWitness']['path'],
                 authority['originalMapping']['path']):
        expect('altered-protected-witness:'+path,overrides={path:check.regular(check.ROOT/path)+b' '})
    for path in authority['unchangedNativeNodes']:
        for key in ('version','integrity','resolved'):
            value=json.loads(current);value['packages'][path][key]='forged'
            expect('altered-native:'+path+':'+key,(json.dumps(value,indent=2)+'\n').encode())
    for path in ('package.json','apps/mobile/package.json'):
        expect('changed-declaration:'+path,overrides={path:check.regular(check.ROOT/path)+b' '})
    expect('authentic-restored',expected=0)
    actual_lock=check.git('show',check.RELEASE13_BASE+':package-lock.json')
    check.unapplied12_guard(actual_lock,lambda p:check.git('show',check.RELEASE13_BASE+':'+p))
    for name,raw,overrides in [
        ('candidate-activation-refused',current,{}),
        ('forged-unapplied-blocker',actual_lock,{check.RELEASE12_BLOCKER:b'{}'}),
        ('altered-protected-native-mapping',actual_lock,{'docs/phase-9/ios-sdk-package-mapping.json':b'{}'}),
    ]:
        def reader(path):return overrides.get(path,check.git('show',check.RELEASE13_BASE+':'+path))
        try:check.unapplied12_guard(raw,reader)
        except (ValueError,KeyError,OSError) as error:
            rejected+=1
            print(json.dumps(dict(case=name,exit=1,expected_exit=1,error=str(error))))
        else:raise AssertionError(name)
    check.unapplied12_guard(actual_lock,lambda p:check.git('show',check.RELEASE13_BASE+':'+p))
    print(json.dumps(dict(passed=True,rejected=rejected,qualification='IN_MEMORY_EXACT_SOURCE_READERS',release='NO_GO')))


if __name__ == '__main__':
    main()
