import concurrent.futures
import json
import os
from pathlib import Path
import shutil
import subprocess
import urllib.parse
import urllib.request
from run import OUT, REPO, identity, now, sha, write
from publication import client, BRANCH, PARENT, PREFIX

if __name__=='__main__':
    source=identity();assert not source['status'] and shutil.disk_usage(OUT).free>=10*1024**3
    commit=json.loads((OUT/'PUBLICATION_OBJECTS.json').read_text())['commit'];api=client()
    def actions():
        results={}
        for key,query in [('commit','head_sha='+commit),('branch','branch='+urllib.parse.quote(BRANCH,safe=''))]:
            value=api('actions/runs?'+query+'&per_page=100');assert value['total_count']==0 and value['workflow_runs']==[]
            results[key]=dict(totalCount=0,runs=[])
        return dict(at=now(),**results)
    initial=actions()
    remote_commit=api('git/commits/'+commit);assert [p['sha'] for p in remote_commit['parents']]==[PARENT]
    assert api('git/ref/heads/'+BRANCH)['object']['sha']==commit
    tree=api('git/trees/'+remote_commit['tree']['sha']+'?recursive=1');assert not tree['truncated']
    assert not any(r['path'].startswith('.github/workflows/') for r in tree['tree'])
    stage=OUT/'stage2'/PREFIX;download=OUT/'remote-readback';download.mkdir()
    paths=sorted(p for p in stage.rglob('*') if p.is_file())
    def check(p):
        relative=p.relative_to(stage).as_posix()
        url='https://raw.githubusercontent.com/TasfiqJ/onSkin/'+commit+'/'+PREFIX+urllib.parse.quote(relative,safe='/')
        with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'onSkin-Engineering31-independent-readback'}),timeout=30) as response:
            data=response.read();media=response.headers.get('Content-Type','')
        data.decode('utf-8');assert b'\0' not in data and data==p.read_bytes(),relative
        target=download/relative;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data)
        return dict(path=relative,bytes=len(data),sha256=sha(data),publicUtf8=True,media=media)
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:checked=list(pool.map(check,paths))
    reconstruct=OUT/'remote-reconstructed';outputs={}
    for name,command in [
       ('bundle',['python','-B',str(download/'verify_bundle.py'),str(download),str(reconstruct)]),
       ('ancestry',['python','-B',str(download/'verify_ancestry.py'),str(reconstruct/'COMMIT_ANCESTRY_WITNESS.json' if (reconstruct/'COMMIT_ANCESTRY_WITNESS.json').exists() else download/'COMMIT_ANCESTRY_WITNESS.json')])]:
        result=subprocess.run(command,capture_output=True);assert result.returncode==0,(name,result.stderr.decode(errors='replace'));outputs[name]=json.loads(result.stdout)
    proof=json.loads((download/'PATCH_VERIFICATION.json').read_text());proof_dir=OUT/'remote-tree-proof';proof_dir.mkdir();objects_dir=proof_dir/'objects';objects_dir.mkdir();alternates=(REPO/subprocess.check_output(['git','rev-parse','--git-common-dir'],cwd=REPO,encoding='utf-8').strip()/'objects').resolve()
    index=Path(subprocess.check_output(['git','rev-parse','--git-path','index'],cwd=REPO,encoding='utf-8').strip());before=sha(index.read_bytes());trees=[]
    for patch in proof['patches']:
        path=reconstruct/patch['file'];path=path if path.exists() else download/patch['file']
        data=path.read_bytes();assert len(data)==patch['bytes'] and sha(data)==patch['sha256']
        for reverse,begin,want in [(False,patch['base'],patch['targetTree']),(True,patch['target'],patch['baseTree'])]:
            env=dict(os.environ,GIT_INDEX_FILE=str(proof_dir/(patch['file']+('.reverse.index' if reverse else '.forward.index'))),GIT_OBJECT_DIRECTORY=str(objects_dir),GIT_ALTERNATE_OBJECT_DIRECTORIES=str(alternates),GIT_OPTIONAL_LOCKS='0')
            def git(*args,payload=None):return subprocess.check_output(['git','--no-optional-locks',*args],cwd=REPO,input=payload,env=env)
            git('read-tree',begin);git('apply','--cached','--binary','--whitespace=nowarn',*(['--reverse'] if reverse else []),payload=data)
            observed=git('write-tree').decode().strip();assert observed==want;trees.append(dict(patch=patch['file'],reverse=reverse,tree=observed,exact=True))
    preserved={}
    for ref,expected in json.loads((OUT/'preflight-final4.json').read_text())['preservedRefs'].items():
        if ref in ('pr48','archiveTag'):continue
        observed=api('git/ref/heads/'+ref)['object']['sha'];assert observed==expected;preserved[ref]=observed
    pr=api('pulls/48');assert pr['head']['sha']=='d292743c99c1fb98f5714789f4fd60fb1e7d5a5d' and pr['draft'] and pr['state']=='open'
    assert sha(index.read_bytes())==before and identity()==source
    final=actions()
    write('REMOTE_VERIFICATION.json',dict(at=now(),evidenceCommit=commit,evidenceTree=remote_commit['tree']['sha'],source=source,
        files=checked,offlineOutputs=outputs,forwardReverseTrees=trees,activeIndexUnchanged=True,activeIndexSha256=before,
        preservedRefs=preserved,pr48=dict(head=pr['head']['sha'],draft=True,state='open'),
        actionsBefore=initial,actionsAfter=final,workflowFree=True,applicationSourcePush=False,paidOperationsInitiated=0,hostedDispatches=0))
    print(json.dumps(dict(commit=commit,files=len(checked),offlineVerified=True,exactPatchTrees=len(trees),actionsRuns=0,sourceUnchanged=True)))
