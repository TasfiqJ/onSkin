from pathlib import Path
import subprocess, hashlib, json

root = Path(r'C:\Users\jasim\Desktop\WeddingCards\work\m1x05-original-329853b7').resolve()
stage = Path(r'C:\Users\jasim\Desktop\WeddingCards\work\m102-retained-resilience')
assert root.parent == stage.parent.resolve() and root.name == 'm1x05-original-329853b7'
def git(*args): return subprocess.check_output(['git',*args],cwd=root).decode().strip()
assert git('rev-parse','HEAD') == '99596bfceac782d740415503bc25452cac623254'
assert not git('diff','HEAD','--name-only')
names = ['apps/mobile/src/features/'+p for p in ['shelf/retiredActions.campaign05.test.ts','photos/captureOwner.campaign05.test.ts','notifications/preferenceAvailability.campaign05.test.ts']]
assert set(git('ls-files','--others','--exclude-standard').splitlines()) == set(names)
record = dict(anchor=git('rev-parse','HEAD'),tree=git('rev-parse','HEAD^{tree}'),sparse_source_only=True,
    note='Negative tests used every mobile source path and installed dependencies, with no tracked production changes. Full-root and generator qualification use complete checkouts separately.',tests=[])
for name in names:
    path = (root/name).resolve()
    assert path.is_relative_to(root) and not path.is_symlink()
    data = path.read_bytes()
    assert data == (stage/name).read_bytes()
    record['tests'].append(dict(path=name,sha256=hashlib.sha256(data).hexdigest(),bytes=len(data)))
for name in ['apps/mobile/src/features/shelf/mutations.ts','apps/mobile/src/features/photos/usePhotos.ts','apps/mobile/src/features/notifications/useNotifications.ts','apps/mobile/src/features/notifications/store.ts']:
    expected = subprocess.check_output(['git','show','HEAD:'+name],cwd=root)
    assert expected == (root/name).read_bytes()
    record.setdefault('original_production',[]).append(dict(path=name,blob=git('rev-parse','HEAD:'+name),sha256=hashlib.sha256(expected).hexdigest()))
Path(__file__).with_name('independent-original-overlay.json').write_text(json.dumps(record,indent=2)+'\n',encoding='utf-8')
for name in names: (root/name).unlink()
assert git('status','--porcelain=v1') == ''
print('Verified original production and exact final tests; removed only the three owned overlay files.')
