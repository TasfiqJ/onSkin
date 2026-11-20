import base64
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
from run import OUT, REPO, identity, now, write

BRANCH='engineering32-review-2026-11-20'
PARENT='ef15a0d9a435016c9f8e389ed4bc10237ae153f4'
PREFIX='evidence/'+BRANCH+'/'
BASE='https://api.github.com/repos/TasfiqJ/onSkin/'
def client():
    result=subprocess.run(['git','credential','fill'],cwd=REPO,input='protocol=https\nhost=github.com\n\n',capture_output=True,text=True,
      env=dict(os.environ,GIT_TERMINAL_PROMPT='0',GCM_INTERACTIVE='Never'))
    fields=dict(line.split('=',1) for line in result.stdout.splitlines() if '=' in line)
    assert result.returncode==0 and fields.get('password'),'Existing GitHub access unavailable'
    headers={'Authorization':'Bearer '+fields['password'],'Accept':'application/vnd.github+json','User-Agent':'onSkin-Engineering31-evidence',
      'X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'}
    def api(path,value=None,method=None):
        request=urllib.request.Request(BASE+path if path else BASE.rstrip('/'),headers=headers,
          data=None if value is None else json.dumps(value).encode(),method=method)
        with urllib.request.urlopen(request,timeout=45) as response:return json.load(response)
    return api
def preflight(api,require_clean=True):
    source=identity()
    if require_clean:assert not source['status']
    prior=json.loads((OUT.parent/'ENGINEERING31_EVIDENCE_20261119/preflight-final3.json').read_text())
    refs={}
    for ref,expected in prior['preservedRefs'].items():
        if ref in ('pr48','archiveTag'):continue
        refs[ref]=api('git/ref/heads/'+ref)['object']['sha'];assert refs[ref]==expected,'Protected ref drift: '+ref
    refs['engineering31-review-2026-11-19']=api('git/ref/heads/engineering31-review-2026-11-19')['object']['sha']
    assert refs['engineering31-review-2026-11-19']==PARENT
    pr=api('pulls/48');refs['pr48']=dict(state=pr['state'],draft=pr['draft'],head=pr['head']['sha'],base=pr['base']['sha'])
    refs['archiveTag']=api('git/ref/tags/engineering19-review-2026-11-16')['object']['sha']
    assert refs['pr48']==prior['preservedRefs']['pr48'] and refs['archiveTag']==prior['preservedRefs']['archiveTag']
    try:api('git/ref/heads/'+BRANCH)
    except urllib.error.HTTPError as error:assert error.code==404
    else:raise AssertionError('Evidence branch exists; no overwrite authorized')
    repo=api('');assert not repo['private'] and not repo['archived'] and repo['default_branch']=='main' and repo['permissions']['push']
    hooks,rules=api('hooks'),api('rulesets');assert hooks==[] and rules==[]
    files=api('contents/.github/workflows?ref='+refs['main']);assert {r['path'] for r in files}=={r['path'] for r in prior['workflows']}
    for row in prior['workflows']:
        actual=api('contents/'+row['path']+'?ref='+refs['main']);assert actual['sha']==row['sha']
        body=base64.b64decode(actual['content']).decode()
        assert not any('\n  '+event+':' in body for event in ('create','workflow_run','repository_dispatch'))
    parent=api('git/commits/'+PARENT);tree=api('git/trees/'+parent['tree']['sha']+'?recursive=1')
    assert not tree['truncated'] and not any(r['path'].startswith('.github/workflows/') for r in tree['tree'])
    settings,permissions=api('actions/permissions'),api('actions/permissions/workflow')
    assert settings==prior['actionsPermissions'] and permissions==prior['workflowPermissions']
    return dict(at=now(),source=source,branch=BRANCH,parent=PARENT,parentTree=parent['tree']['sha'],preservedRefs=refs,
      parentWorkflowFree=True,repositoryHooks=hooks,repositoryRulesets=rules,workflows=prior['workflows'],
      actionsPermissions=settings,workflowPermissions=permissions,newBranchAbsent=True,
      rationale='Workflow-free evidence parent/candidate; unchanged default workflows restrict push to main or require PR/manual dispatch. No PR, dispatch, application ref or settings mutation. skip-ci supplementary only.',
      limitation='Repository-visible configuration; inaccessible installation internals are not independently attested.')
if __name__=='__main__':
    label=sys.argv[1];receipt=preflight(client(),require_clean='working' not in label);write(label+'.json',receipt)
    print(json.dumps(dict(at=receipt['at'],branch=BRANCH,parent=PARENT,workflowFree=True,protectedRefsUnchanged=True)))
