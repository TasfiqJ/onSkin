"""Verify UTF-8 publication files and reconstruct exact logical raw evidence.
Usage: python verify_bundle.py /downloaded/evidence /fresh/reconstructed
The destination must not exist. No source checkout, deletion or network is used.
"""
import hashlib
import json
from pathlib import Path
import sys

root, target = map(Path, sys.argv[1:])
assert not target.exists()
manifest = json.loads((root / 'MANIFEST.json').read_text(encoding='utf-8'))
for row in manifest['files']:
    data = (root / row['path']).read_bytes()
    data.decode('utf-8')
    assert b'\0' not in data and len(data) == row['bytes']
    assert hashlib.sha256(data).hexdigest() == row['sha256'], row['path']
target.mkdir(parents=True)
index = json.loads((root / 'PARTS_INDEX.json').read_text(encoding='utf-8'))
for row in index:
    data = b''.join((root / part).read_bytes() for part in row['parts'])
    assert len(data) == row['bytes'] and hashlib.sha256(data).hexdigest() == row['sha256']
    path = target / row['logical']
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
print(json.dumps(dict(verified=True, files=len(manifest['files']), logicalFiles=len(index),
                     note='Run verify_ancestry.py on the reconstructed witness; PATCH_VERIFICATION.json records actual isolated-index tree checks.'), indent=2))
