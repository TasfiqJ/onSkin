import hashlib, json, sys
from pathlib import Path

E = Path(__file__).resolve().parent
ORIGINAL = E.parent / 'ENGINEERING27_EVIDENCE'
EXPECTED = '35f9a81f032cbaa229e374d52769c1ee7c726174004b1218f9157fa546f5f1db'
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
manifest = ORIGINAL / 'SHA256SUMS.txt'
assert sha(manifest) == EXPECTED
entries = [row.split('  ', 1) for row in manifest.read_text().splitlines()]
assert len(entries) == 22
assert {p.name for p in ORIGINAL.iterdir()} == {name for _, name in entries} | {'SHA256SUMS.txt'}
for digest, name in entries: assert sha(ORIGINAL / name) == digest
result = {'result': 'MATCH', 'originalManifestSha256': EXPECTED, 'verifiedEntries': 22,
          'extraEntries': [], 'files': {name: digest for digest, name in entries}}
target = E / ('ORIGINAL_E27_' + sys.argv[1] + '.json')
assert not target.exists()
target.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'result': 'MATCH', 'verifiedEntries': 22, 'extras': 0, 'manifestSha256': EXPECTED}))
