import hashlib,json,pathlib,subprocess,sys
root=pathlib.Path('/root/onskin-governance-fixture01')
ctx=pathlib.Path('/mnt/c/Users/jasim/Documents/ChatGPT/MasterV2Code/governance-fixture01-context')
a=json.loads((ctx/'SOURCE_EDIT_AUTHORIZATION.json').read_bytes())
def git(*args): return subprocess.check_output(['git',*args],cwd=root)
assert git('rev-parse','HEAD').decode().strip()==a['base_commit'],'STALE_ISSUANCE head'
assert git('rev-parse','HEAD^{tree}').decode().strip()==a['base_tree'],'STALE_ISSUANCE tree'
assert git('branch','--show-current').decode().strip()==a['branch'],'STALE_ISSUANCE branch'
assert not git('status','--porcelain=v1'),'STALE_ISSUANCE dirty'
assert not (root/'.git/objects/info/alternates').exists(),'alternates'
for group in ['allowed_existing_files','protected_unchanged']:
 for item in a[group]:
  p=item['path']; b=git('show',a['base_commit']+':'+p); oid=git('rev-parse',a['base_commit']+':'+p).decode().strip()
  assert (len(b),hashlib.sha256(b).hexdigest(),oid)==(item['bytes'],item['sha256'],item['git_blob']), 'STALE_ISSUANCE blob '+p
  assert (root/p).read_bytes()==b,'STALE_ISSUANCE worktree '+p
  print('MATCH',group,p,len(b),oid,hashlib.sha256(b).hexdigest())
print('PREFLIGHT PASS 7 writable + 16 protected; clean exact checkout; no alternates')
for p in ['AGENTS.md','docs/brain/AGENTS.md','CLAUDE.md','docs/brain/README.md','docs/brain/m103-quality-recovery03-active.json']:
 print('\nFILE',p); print((root/p).read_text())
