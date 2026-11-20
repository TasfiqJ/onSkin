import base64
import json
import os
from pathlib import Path
import subprocess
import sys
from run import OUT, REPO, git, identity, now, sha, write as original_write

SUFFIX = '_'+sys.argv[1].upper() if len(sys.argv)>1 else ''
def write(name, value):
    return original_write(name.removesuffix('.json')+SUFFIX+'.json',value)

BASE = 'd292743c99c1fb98f5714789f4fd60fb1e7d5a5d'
START = 'e5b5d0934852dccac5bd90a2017f9536e2ac89f9'

def rawgit(*args, data=None, env=None):
    return subprocess.check_output(['git','--no-optional-locks',*args],cwd=REPO,input=data,env=env)

if __name__ == '__main__':
    source = identity(); assert not source['status']
    assert git('merge-base', START, source['head']) == START
    proof = OUT/('source-proof-'+sys.argv[1].lower() if SUFFIX else 'source-proof'); proof.mkdir()
    index = Path(git('rev-parse','--git-path','index')); before = sha(index.read_bytes())
    patches=[]
    for name,parent in [('CUMULATIVE_PR48_TO_FINAL.patch',BASE),('SESSION_ENGINEERING30_TO_FINAL.patch',START)]:
        data=rawgit('diff','--binary','--full-index','--no-renames','--no-ext-diff','--no-textconv',parent,source['head'],'--')
        data.decode('utf-8'); (proof/name).write_bytes(data)
        row=dict(file=name,base=parent,baseTree=git('rev-parse',parent+'^{tree}'),target=source['head'],targetTree=source['tree'],bytes=len(data),sha256=sha(data))
        for reverse,begin,want in [(False,parent,source['tree']),(True,source['head'],row['baseTree'])]:
            temp=proof/(name+('.reverse.index' if reverse else '.forward.index'))
            env=dict(os.environ,GIT_INDEX_FILE=str(temp),GIT_OPTIONAL_LOCKS='0')
            rawgit('read-tree',begin,env=env)
            rawgit('apply','--cached','--binary','--whitespace=nowarn',*(['--reverse'] if reverse else []),data=data,env=env)
            observed=rawgit('write-tree',env=env).decode().strip(); assert observed==want
            row['reverseExactTree' if reverse else 'forwardExactTree']=observed
        patches.append(row)
    assert sha(index.read_bytes())==before and identity()==source
    write('PATCH_VERIFICATION.json',dict(at=now(),patches=patches,activeIndexUnchanged=True,indexSha256=before,
        method='Separate retained indexes, forward/reverse git apply --cached --binary, exact tree equality; no checkout/reset/active-index mutation.'))
    chain=git('rev-list','--first-parent',source['head']).splitlines(); assert BASE in chain
    chain=list(reversed(chain[:chain.index(BASE)+1])); objects=[]
    for i,commit in enumerate(chain):
        data=rawgit('cat-file','commit',commit); headers=data.split(b'\n\n',1)[0].splitlines()
        parents=[line[7:].decode() for line in headers if line.startswith(b'parent ')]
        tree=next(line[5:].decode() for line in headers if line.startswith(b'tree '))
        objects.append(dict(sha=commit,length=len(data),payloadBase64=base64.b64encode(data).decode(),tree=tree,
            allParents=parents,selectedParentIndex=None if i==0 else parents.index(chain[i-1])))
    witness=dict(format='raw-git-commit-object-path-v1',published=BASE,publishedTree=objects[0]['tree'],engineering30=START,
       target=source['head'],targetTree=source['tree'],firstParentPath=True,pathBaseToTarget=objects,
       scope='Raw Git objects/parent/tree links; no authorship/signature/security acceptance claim. Patches plus exact baseline prove source trees.')
    (proof/'COMMIT_ANCESTRY_WITNESS.json').write_text(json.dumps(witness,indent=2)+'\n',encoding='utf-8')
    (proof/'verify_ancestry.py').write_bytes((OUT.parent/'ENGINEERING29_EVIDENCE/raw/verify_ancestry.py').read_bytes())
    result=subprocess.run(['python','-B',str(proof/'verify_ancestry.py'),str(proof/'COMMIT_ANCESTRY_WITNESS.json')],capture_output=True)
    assert result.returncode==0,result.stderr
    write('ANCESTRY_VERIFICATION.json',json.loads(result.stdout))
    write('CHANGED_FILES.json',dict(session=git('diff','--name-status',START,source['head']).splitlines(),
        cumulative=git('diff','--name-status',BASE,source['head']).splitlines(),commits=git('log','--format=%H %T %P %s',START+'..'+source['head']).splitlines()))
    frozen=[]
    for file in ['contract.v1.json','contract.v2.json','matrix.v1.json','matrix.v2.json','precedence.v2.json']:
        path='docs/release/full-app-j01/'+file
        old=rawgit('show',START+':'+path);current=(REPO/path).read_bytes()
        assert old==current
        frozen.append(dict(path=path,sha256=sha(current),unchanged=True))
    write('FROZEN_CONTRACTS.json',frozen)
    write('FINAL_IDENTITY.json',dict(at=now(),source=source,freeBytes=__import__('shutil').disk_usage(OUT).free,
        startHead=START,startTree=git('rev-parse',START+'^{tree}'),pr48=BASE,indexPreservedForProof=True,
        status='COMPLETE_LOCAL_CHECKPOINT_PENDING_INDEPENDENT_REVIEW',all38='UNACCEPTED',all18='UNACCEPTED',release='NO_GO'))
    print(json.dumps(dict(source=source,patches=patches,ancestryObjects=len(objects)),indent=2))
