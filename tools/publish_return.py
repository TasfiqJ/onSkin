"""Publish a screened Codex return to the docs-only control branch, never app refs.
Requires ordinary existing GitHub authentication. Does not configure accounts,
run hosted jobs, change application files, create PRs or waive safety gates.
Use --dry-run first. Ref races abort; no force update is used.
"""
from __future__ import annotations
import argparse, base64, hashlib, json, os, pathlib, re, subprocess, sys, urllib.error, urllib.parse, urllib.request
REPO='TasfiqJ/onSkin'; BRANCH='brain/masterv2'
KNOWN_WORKFLOWS={
'g97-security-acceptance.yml':'6afd4e34c6142c1a28814f2deb73483b1365d863',
'ios-launch-contract.yml':'3f80c9f19ac4a3675d82446501a0d3aae4c511a0',
'ios-simulator-compile.yml':'0564dea4c256471ab139a7fd03acc59f3e8d2a78',
'quality.yml':'e983e936097fe2f8478804ba23d69a713e9a1b2c',
'security-candidate22.yml':'02f80cd4a48b3bb82b09028adc8970673a504eba',
'security.yml':'34416c61c8712303b45cf072c7754d54d0e8dd76'}
def digest(b):return hashlib.sha256(b).hexdigest()
def main():
 p=argparse.ArgumentParser();p.add_argument('--report-dir',required=True,type=pathlib.Path);p.add_argument('--expected-control-commit',required=True);p.add_argument('--git-repo',type=pathlib.Path);p.add_argument('--dry-run',action='store_true');a=p.parse_args()
 token=os.environ.get('GH_TOKEN') or os.environ.get('GITHUB_TOKEN')
 if not token:
  if not a.git_repo:p.error('Use an existing approved token environment or --git-repo for its normal existing GitHub credential helper.')
  env=dict(os.environ,GIT_TERMINAL_PROMPT='0',GCM_INTERACTIVE='never')
  r=subprocess.run(['git','-C',str(a.git_repo),'credential','fill'],input='protocol=https\nhost=github.com\npath=TasfiqJ/onSkin.git\n\n',capture_output=True,text=True,timeout=20,env=env)
  if r.returncode:raise RuntimeError('Existing GitHub authentication unavailable; do not provision or print credentials.')
  token=dict(x.split('=',1) for x in r.stdout.splitlines() if '=' in x).get('password')
 if not token:raise RuntimeError('No existing GitHub authentication')
 def api(path,method='GET',data=None):
  url='https://api.github.com/repos/'+REPO+('/'+path if path else '')
  headers={'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json','User-Agent':'onSkin-control-return'}
  body=None if data is None else json.dumps(data).encode();req=urllib.request.Request(url,data=body,headers=headers,method=method)
  with urllib.request.urlopen(req,timeout=40) as r:return json.load(r)
 def file(path,ref):
  x=api('contents/'+urllib.parse.quote(path,safe='/')+'?ref='+urllib.parse.quote(ref,safe=''))
  if x.get('encoding')!='base64':raise RuntimeError('Unexpected GitHub content encoding')
  return base64.b64decode(x['content'])
 head=api('git/ref/heads/'+BRANCH)['object']['sha']
 if head!=a.expected_control_commit:raise RuntimeError('CONTROL_ADVANCED: reread current task and reconcile; no force publication')
 c=json.loads(file('CONTROL.json',head));task=c['active_task']
 hooks=api('hooks?per_page=100');rules=api('rulesets?includes_parents=true')
 if any(x.get('active') for x in hooks) or rules:raise RuntimeError('Publication configuration changed; independent review required')
 meta=api('');main=meta['default_branch']
 if meta.get('has_pages'):raise RuntimeError('Pages integration requires new publication review')
 workflow=api('contents/.github/workflows?ref='+urllib.parse.quote(main,safe=''))
 if {x['name']:x['sha'] for x in workflow}!=KNOWN_WORKFLOWS:raise RuntimeError('Workflow triggers changed; review instead of bypassing')
 openprs=api('pulls?state=open&head='+urllib.parse.quote('TasfiqJ:'+BRANCH,safe=''))
 if openprs:raise RuntimeError('Control branch has a PR; do not trigger pull-request workflows')
 tree=api('git/trees/'+head+'?recursive=1')
 if tree.get('truncated') or any(x['path'].startswith('.github/workflows/') for x in tree['tree']):raise RuntimeError('Unsafe/incomplete control branch tree')
 report=json.loads((a.report_dir/'REPORT.json').read_text(encoding='utf-8'))
 if report['task_id']!=task['id'] or report['task_revision']!=task['revision'] or report['task_sha256']!=task['sha256'] or report['control_commit']!=head:raise RuntimeError('Report does not match active pinned task')
 final=report['final_head'];assert re.fullmatch('[0-9a-f]{40}',final),'Use complete source commit'
 assert re.fullmatch('[0-9a-f]{40}',report['final_tree']),'Use complete source tree'
 assert report.get('release')=='NO_GO','Return cannot authorize release'
 prefix='returns/'+task['id']+'/r'+str(task['revision'])+'/'+final+'/'
 if any(x['path'].startswith(prefix) for x in tree['tree']):raise RuntimeError('Immutable return exists; use a Brain-authorized report revision rather than overwrite')
 files=[];manifest=[]
 for f in sorted(a.report_dir.rglob('*')):
  if not f.is_file():continue
  if f.is_symlink():raise RuntimeError('No symlink payloads')
  rel=f.relative_to(a.report_dir).as_posix();assert '..' not in pathlib.PurePosixPath(rel).parts
  raw=f.read_bytes();text=raw.decode('utf-8')
  if len(raw)>220000:raise RuntimeError('Split oversized UTF-8 files into exact ordered parts: '+rel)
  if re.search(r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bgh[pousr]_[A-Za-z0-9]{30,}\b|\bAKIA[0-9A-Z]{16}\b',text):raise RuntimeError('Sensitive payload pattern: '+rel)
  files.append({'path':prefix+rel,'mode':'100644','type':'blob','content':text});manifest.append({'path':rel,'bytes':len(raw),'sha256':digest(raw)})
 if not files or not (a.report_dir/'REPORT.md').is_file():raise RuntimeError('REPORT.md and REPORT.json are required')
 manifesttext=json.dumps({'files':manifest,'screening':'Pattern scan plus author content review required; no real private data.'},indent=2)+'\n'
 files.append({'path':prefix+'MANIFEST.json','mode':'100644','type':'blob','content':manifesttext})
 if a.dry_run:print(json.dumps({'status':'PREFLIGHT_PASS_NO_WRITE','head':head,'prefix':prefix,'files':len(files)}));return
 newtree=api('git/trees','POST',{'base_tree':api('git/commits/'+head)['tree']['sha'],'tree':files})['sha']
 reportcommit=api('git/commits','POST',{'message':'Record '+task['id']+' immutable engineering return [skip ci]','tree':newtree,'parents':[head]})['sha']
 # Verify every payload before exposing it as the latest report.
 for f in files:
  if file(f['path'],reportcommit)!=f['content'].encode():raise RuntimeError('Remote content mismatch: '+f['path'])
 pointer={'schema_version':1,'task_id':task['id'],'task_revision':task['revision'],'report_commit':reportcommit,'report_path':prefix+'REPORT.json','application_head':final,'application_tree':report['final_tree'],'source_base':report['starting_head'],'status':report['status'],'independent_acceptance':False}
 pointertree=api('git/trees','POST',{'base_tree':newtree,'tree':[{'path':'returns/LATEST.json','mode':'100644','type':'blob','content':json.dumps(pointer,indent=2)+'\n'}]})['sha']
 pointercommit=api('git/commits','POST',{'message':'Publish verified latest return for '+task['id']+' [skip ci]','tree':pointertree,'parents':[reportcommit]})['sha']
 if api('git/ref/heads/'+BRANCH)['object']['sha']!=head:raise RuntimeError('REF_RACE: immutable objects retained but branch not updated; reconcile')
 api('git/refs/heads/'+BRANCH,'PATCH',{'sha':pointercommit,'force':False})
 if api('git/ref/heads/'+BRANCH)['object']['sha']!=pointercommit:raise RuntimeError('Unexpected branch after publication')
 runs=api('actions/runs?branch='+urllib.parse.quote(BRANCH,safe='')+'&per_page=100')
 caused=[x for x in runs.get('workflow_runs',[]) if x['head_sha'] in [reportcommit,pointercommit]]
 print(json.dumps({'status':'RETURN_PUBLISHED' if not caused else 'UNEXPECTED_WORKFLOW_OBSERVED','report_commit':reportcommit,'control_branch_commit':pointercommit,'index':'https://github.com/'+REPO+'/blob/'+reportcommit+'/'+prefix+'REPORT.md','observed_publication_runs':len(caused)},indent=2))
if __name__=='__main__':
 try:main()
 except Exception as e:
  print(type(e).__name__+': '+str(e),file=sys.stderr);sys.exit(1)
