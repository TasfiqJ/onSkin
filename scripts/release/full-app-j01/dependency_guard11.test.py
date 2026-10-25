"""Refuse unrelated dependencies, sources, scripts and forged approved graph records."""
import copy
import importlib.util
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('dependency11_check', HERE/'check.py')
check = importlib.util.module_from_spec(spec)
spec.loader.exec_module(check)


def main():
    baseline = check.git('show', check.RELEASE11_BASE+':package-lock.json')
    current = (check.ROOT/'package-lock.json').read_bytes()
    check.dependency11_guard(baseline)
    check.dependency11_guard(current)
    proposed = json.loads(baseline)
    proposed['packages'].update(check.load(check.ROOT/'docs/brain/contracts/SECURITY-11/dependency-patch.v1.json')['nodes'])
    check.dependency11_guard(json.dumps(proposed).encode())
    parsed = json.loads(current)
    rejected = 0
    cases = [
        ('version', lambda x:x['packages']['node_modules/vitest'].__setitem__('version', '5.0.5')),
        ('source', lambda x:x['packages']['node_modules/@vitest/mocker'].__setitem__('resolved', 'https://example.invalid/pkg.tgz')),
        ('integrity', lambda x:x['packages']['node_modules/vitest'].__setitem__('integrity', 'sha512-forged')),
        ('extra-closure', lambda x:x['packages']['node_modules/chai'].__setitem__('version', '6.3.0')),
        ('runtime-zod-major', lambda x:x['packages']['node_modules/zod'].__setitem__('version', '4.6.6')),
        ('root-script', lambda x:x['packages'][''].__setitem__('scripts', {'postinstall':'other'})),
        ('extra-package', lambda x:x['packages'].__setitem__('node_modules/unissued', {'version':'1.0.0'})),
        ('removed-package', lambda x:x['packages'].pop('node_modules/braces')),
        ('top-level-change', lambda x:x.__setitem__('lockfileVersion', 2)),
    ]
    for name, mutate in cases:
        value = copy.deepcopy(parsed); mutate(value)
        try:
            check.dependency11_guard(json.dumps(value).encode())
        except ValueError as error:
            rejected += 1
            print(json.dumps(dict(case=name, rejected=True, error=str(error))))
        else:
            raise AssertionError(name)
    check.dependency11_guard(current)
    print(json.dumps(dict(passed=True, rejected=rejected, candidate_nodes=8,
        final_lock_changed=current != baseline, disposition='UNAPPLIED_RETAINED_SOURCE_WITNESS_BLOCKED', release='NO_GO')))


if __name__ == '__main__':
    main()
