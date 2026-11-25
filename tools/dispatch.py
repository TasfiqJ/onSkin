from __future__ import annotations
import hashlib,json,sys,urllib.request
repo='TasfiqJ/onSkin';branch='brain/masterv2'
def get(url):
 req=urllib.request.Request(url,headers={'User-Agent':'onSkin-control-reader','Accept':'application/vnd.github+json'})
 with urllib.request.urlopen(req,timeout=25) as r:return r.read()
ref=json.loads(get(f'https://api.github.com/repos/{repo}/git/ref/heads/{branch}'));commit=ref['object']['sha']
c=json.loads(get(f'https://raw.githubusercontent.com/{repo}/{commit}/CONTROL.json'));a=c['active_task']
t=get(f'https://raw.githubusercontent.com/{repo}/{commit}/'+a['path'])
assert hashlib.sha256(t).hexdigest()==a['sha256'],'Task hash mismatch'
print('PINNED CONTROL:',commit);print('TASK:',a['id'],'REVISION:',a['revision']);print('DISPATCH:',a['dispatch']);print(t.decode())
print('This reader never executes instructions, edits application files or grants an unapproved task.')
