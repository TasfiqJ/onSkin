import json
from pathlib import Path
import shutil
from run import OUT, identity, now, sha, write
from publication import client, preflight, BRANCH, PARENT, PREFIX

if __name__=='__main__':
    assert shutil.disk_usage(OUT).free >= 10*1024**3
    root=OUT/'stage2'/PREFIX
    source=identity(); assert not source['status']
    manifest=json.loads((root/'MANIFEST.json').read_text()); assert manifest['source']==source
    assert json.loads((root/'PUBLICATION_SCREEN.json').read_text())['safeForPublication'] is True
    expected={r['path'] for r in manifest['files']}|{'MANIFEST.json'}
    files={p.relative_to(root).as_posix():p for p in root.rglob('*') if p.is_file()}
    assert set(files)==expected
    for row in manifest['files']:
        data=files[row['path']].read_bytes();assert len(data)==row['bytes'] and sha(data)==row['sha256']
    api=client(); safety=preflight(api);write('preflight-immediate.json',safety)
    parent=api('git/commits/'+PARENT);assert parent['tree']['sha']==safety['parentTree']
    old=api('git/trees/'+safety['parentTree']+'?recursive=1');assert not old['truncated']
    old_blobs={r['path']:r['sha'] for r in old['tree'] if r['type']=='blob'}
    entries=[]
    for relative,p in sorted(files.items()):
        assert '..' not in Path(relative).parts
        data=p.read_bytes();assert b'\0' not in data and len(data)<=(524288 if relative=='MANIFEST.json' else 245760)
        entries.append(dict(path=PREFIX+relative,mode='100644',type='blob',content=data.decode('utf-8')))
    assert not any(r['path'].startswith('.github/workflows/') for r in entries)
    tree=api('git/trees',dict(base_tree=safety['parentTree'],tree=entries))
    actual=api('git/trees/'+tree['sha']+'?recursive=1');assert not actual['truncated']
    blobs={r['path']:r['sha'] for r in actual['tree'] if r['type']=='blob'}
    assert set(blobs)==set(old_blobs)|{r['path'] for r in entries}
    assert all(blobs[p]==v for p,v in old_blobs.items())
    assert not any(p.startswith('.github/workflows/') for p in blobs)
    assert identity()==source
    commit=api('git/commits',dict(message='[skip ci] Engineering32 bounded runtime and durable original command evidence',tree=tree['sha'],parents=[PARENT]))
    write('PUBLICATION_CANDIDATE.json',dict(at=now(),source=source,branch=BRANCH,parent=PARENT,tree=tree['sha'],commit=commit['sha'],
        workflowFree=True,preservedPriorBlobs=len(old_blobs),newFiles=len(files),manifestSha256=sha(files['MANIFEST.json'].read_bytes()),applicationSourcePush=False))
    assert identity()==source
    ref=api('git/refs',dict(ref='refs/heads/'+BRANCH,sha=commit['sha']))
    assert ref['object']['sha']==commit['sha']
    write('PUBLICATION_OBJECTS.json',dict(at=now(),commit=commit['sha'],tree=tree['sha'],branch=BRANCH,parent=PARENT,
        index=PREFIX+'README.md',source=source,onlyEvidenceBranchCreated=True,applicationSourcePush=False,hostedDispatch=False))
    print(json.dumps(dict(commit=commit['sha'],tree=tree['sha'],branch=BRANCH,files=len(files),workflowFree=True,applicationSourcePush=False)))
