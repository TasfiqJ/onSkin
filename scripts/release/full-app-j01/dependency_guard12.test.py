"""Frozen successor refusal controls; only disposable in-memory readers are mutated."""
import copy
import importlib.util
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('dependency12_check', HERE/'check.py')
check = importlib.util.module_from_spec(spec)
spec.loader.exec_module(check)


def main():
    current = check.git('cat-file','blob','843be0fdf1fe9354dfdc4750118481486d9a778a')
    authority = check.dependency12_guard(current)
    rejected = 0
    def expect(name, raw=current, overrides=None, expected=1):
        nonlocal rejected
        def reader(path):
            return (overrides or {}).get(path, check.regular(check.ROOT/path))
        try:
            check.dependency12_guard(raw, reader)
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
        ('mismatched-manifest',lambda x:x.__setitem__('pr',0)),
        ('unverified-registry-metadata',lambda x:x['registry'][0].__setitem__('signature_verified',False)),
        ('old-witness-forged-new-hash',lambda x:x['original_root_lock_witness'].__setitem__('sha256',check.RELEASE12_LOCK_SHA256)),
        ('forged-candidate-old-hash',lambda x:x['candidate_root_lock'].__setitem__('sha256',x['original_root_lock_witness']['sha256'])),
        ('remove-node-authority',lambda x:x['nodes'].pop('node_modules/@vitest/mocker')),
        ('self-acceptance',lambda x:x.__setitem__('status','ACCEPTED')),
        *[(f'enable-{key}',lambda x,k=key:x['admissions'].__setitem__(k,True)) for key in ('security','M2','J01','public_release','paid')],
    ]:
        value=copy.deepcopy(authority); mutate(value)
        expect(name,overrides={check.RELEASE12_MANIFEST:(json.dumps(value,indent=2)+'\n').encode()})
    for row in authority['registry']:
        for key in ('metadata','attestations'):
            path=row[key]['path']
            expect('altered-'+key+':'+row['path'],overrides={path:check.regular(check.ROOT/path)+b' '})
    for row in authority['historical_contracts']:
        expect('altered-old-source-witness:'+row['path'],overrides={row['path']:check.regular(check.ROOT/row['path'])+b' '})
    for row in authority['declarations']:
        expect('declaration-mutation:'+row['path'],overrides={row['path']:check.regular(check.ROOT/row['path'])+b' '})
    proof=authority['provenance']['path']
    expect('forged-provenance',overrides={proof:b'{}'})
    expect('authentic-restored',expected=0)
    actual_lock=check.regular(check.ROOT/'package-lock.json')
    check.unapplied12_guard(actual_lock)
    for name,raw,overrides in [
        ('candidate-activation-refused',current,{}),
        ('forged-unapplied-blocker',actual_lock,{check.RELEASE12_BLOCKER:b'{}'}),
        ('altered-protected-native-mapping',actual_lock,{'docs/phase-9/ios-sdk-package-mapping.json':b'{}'}),
    ]:
        def reader(path):return overrides.get(path,check.regular(check.ROOT/path))
        try:check.unapplied12_guard(raw,reader)
        except (ValueError,KeyError,OSError) as error:
            rejected+=1
            print(json.dumps(dict(case=name,exit=1,expected_exit=1,error=str(error))))
        else:raise AssertionError(name)
    check.unapplied12_guard(actual_lock)
    print(json.dumps(dict(passed=True,rejected=rejected,qualification='IN_MEMORY_EXACT_SOURCE_READERS',release='NO_GO')))


if __name__ == '__main__':
    main()
