"""Offline verification: Python standard library only; no Git or network."""
import base64, hashlib, json, sys
from pathlib import Path
path = Path(sys.argv[1]) if len(sys.argv)>1 else Path(__file__).with_name('COMMIT_ANCESTRY_WITNESS.json')
witness = json.loads(path.read_text(encoding='utf-8'))
objects = witness['pathBaseToTarget']
assert objects and objects[0]['sha'] == witness['published']
assert objects[-1]['sha'] == witness['target']
for index, entry in enumerate(objects):
    raw = base64.b64decode(entry['payloadBase64'], validate=True)
    assert len(raw) == entry['length']
    assert hashlib.sha1(b'commit '+str(len(raw)).encode('ascii')+b'\0'+raw).hexdigest() == entry['sha']
    headers = raw.split(b'\n\n',1)[0].split(b'\n')
    tree = [line[5:].decode('ascii') for line in headers if line.startswith(b'tree ')]
    parents = [line[7:].decode('ascii') for line in headers if line.startswith(b'parent ')]
    assert tree == [entry['tree']] and parents == entry['allParents']
    if index:
        assert parents[entry['selectedParentIndex']] == objects[index-1]['sha']
    else:
        assert entry['selectedParentIndex'] is None
assert objects[-1]['tree'] == witness['targetTree']
assert witness['firstParentPath'] == all(entry['selectedParentIndex']==0 for entry in objects[1:])
print(json.dumps({'verified':True,'objects':len(objects),'edges':len(objects)-1,'published':witness['published'],'target':witness['target'],'tree':witness['targetTree'],'firstParentPath':witness['firstParentPath']}))
