"""Verify this exact evidence-only delivery and original refusal boundaries."""
import argparse, hashlib, json, pathlib, subprocess

BASE='4f6a2d2c84a06ba9b794967fb76a5f9b6fc994fe'
TREE='791580347993487bd3920727ee7b0e31668eed4e'
ANCHOR='b22116affd45a3621b89ab80e4260db6db608068abb468c253563ebb1235ddf8'
FINGERPRINT='4954012441f89c16902e8de3a55ef75403034bfaa23da413cacb614d3a79113c'
PREFIX='docs/brain/checkpoints/M1-03/SECURITY-SOURCE-COVERAGE-TRIAGE-01/'
def sha(b):return hashlib.sha256(b).hexdigest()
def need(ok,code):
    if not ok:raise ValueError(code)
def main():
    ap=argparse.ArgumentParser();ap.add_argument('--repo',type=pathlib.Path,required=True);ap.add_argument('--precommit',action='store_true');a=ap.parse_args();r=a.repo.resolve();cp=r/PREFIX
    def git(*args):return subprocess.check_output(['git',*args],cwd=r)
    def value(*args):return git(*args).decode().strip()
    need(value('branch','--show-current')=='stage/m1-gate-recovery','BRANCH')
    need(value('rev-parse',BASE+'^{tree}')==TREE,'BASE_TREE')
    need(value('remote','get-url','origin')=='https://github.com/TasfiqJ/onSkin.git','ORIGIN')
    need(sha((cp/'inputs/TASK_MANIFEST.json').read_bytes())==ANCHOR,'EXTERNAL_ANCHOR')
    # Validate every issued member, not merely the manifest file.
    subprocess.run(['python','-B','verify_context.py','--expected-manifest-sha256',ANCHOR],cwd=cp/'inputs',check=True)
    w=json.loads((cp/'inputs/PREIMAGE_WITNESSES.json').read_bytes())
    need(sha(json.dumps(w,sort_keys=True,separators=(',',':')).encode())==FINGERPRINT,'FINGERPRINT')
    need(len(w['files'])==20,'PREIMAGE_COUNT')
    for f in w['files']:
        blob=value('rev-parse',BASE+':'+f['path']);b=git('cat-file','blob',blob)
        need((blob,len(b),sha(b))==(f['git_blob'],f['bytes'],f['sha256']),'BASE_PREIMAGE:'+f['path'])
        if f['path']!='ONSKIN_BRAIN_HANDOFF.txt':need((r/f['path']).read_bytes()==b,'PROTECTED_WORKING_DRIFT:'+f['path'])
    old=set(git('ls-tree','-r','--name-only',BASE).decode().splitlines())
    def allowed(status,path):
        need((status=='M' and path=='ONSKIN_BRAIN_HANDOFF.txt') or (status=='A' and path.startswith(PREFIX) and path not in old),'WRITE_BOUNDARY:'+path)
    previous=BASE
    for commit in value('rev-list','--reverse',BASE+'..HEAD').splitlines():
        need(value('rev-list','--parents','-n','1',commit).split()==[commit,previous],'NONLINEAR_HISTORY')
        for line in value('diff-tree','--no-commit-id','--name-status','--no-renames','-r',commit).splitlines():
            status,path=line.split('\t');allowed(status,path)
        previous=commit
    for line in value('diff',BASE,'--name-status','--no-renames').splitlines():
        status,path=line.split('\t');allowed(status,path)
    status=git('status','--porcelain=v1','--untracked-files=all').decode().splitlines()
    for line in status:
        p=line[3:];need(p=='ONSKIN_BRAIN_HANDOFF.txt' or p.startswith(PREFIX),'OUTSIDE_WORKTREE_WRITE:'+p)
    if not a.precommit:need(not status,'DIRTY_DELIVERY')
    gates=json.loads((cp/'GATE_MATRIX.json').read_bytes())
    need(all(v is False for v in gates['admissions'].values()),'FORGED_ADMISSION')
    need(gates['incremental_spend_usd']==0 and gates['status']=='PARTIAL_DIAGNOSTIC','STATUS_OR_COST')
    need(gates['security_predicates']['current_sast_coverage_percent'] is None,'INVENTED_COVERAGE')
    need(gates['original_provider']['security']['conclusion']=='failure','FALSE_SECURITY_GREEN')
    need(gates['original_provider']['quality']['canonical_local_database']=='success','FALSE_CANONICAL_DB_STATUS')
    m=json.loads((cp/'SCAN_COVERAGE_MATRIX.json').read_bytes());s=m['summary']
    need(s['reviewed_inventory']==s['frozen_required_count']+s['frozen_auxiliary_count']+s['frozen_exclusion_count']==11922,'FROZEN_DENOMINATOR')
    need(s['tracked']==sum(s['status_counts'].values())==20230,'CURRENT_DENOMINATOR')
    need(len(m['paths'])==s['status_counts']['extra']+s['status_counts']['changed']==8397,'DIFFERENCE_ROWS')
    need(m['coverage_percent'] is None and m['scanned_current_paths'] is None,'FALSE_SCAN_COVERAGE')
    secrets=json.loads((cp/'SAFE_SECRET_DISCREPANCIES.json').read_bytes())
    need(len(secrets['current_locations'])==sum(secrets['current_prefix_counts'].values())==1120,'SECRET_COUNT')
    need(all(set(v)=={'location_sha256','rule_id','source_prefix'} and len(v['location_sha256'])==64 for v in secrets['current_locations']),'UNSAFE_SECRET_LOCATION_SCHEMA')
    manifest=json.loads((cp/'ARTIFACT_SHA256.json').read_bytes());seen=set()
    for f in manifest['files']:
        p=f['path'];need(p not in seen,'DUPLICATE_ARTIFACT');seen.add(p);b=(r/p).read_bytes()
        oid=hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
        need((len(b),sha(b),oid)==(f['bytes'],f['sha256'],f['git_blob']),'ARTIFACT_BYTES:'+p)
        need(not (r/p).is_symlink() and (r/p).stat().st_nlink==1,'NONREGULAR_ARTIFACT')
        if not a.precommit:need(value('rev-parse','HEAD:'+p)==oid,'COMMITTED_ARTIFACT:'+p)
    expected={p.relative_to(r).as_posix() for p in cp.rglob('*') if p.is_file() and p.name!='ARTIFACT_SHA256.json'}|{'ONSKIN_BRAIN_HANDOFF.txt'}
    need(seen==expected,'ARTIFACT_INVENTORY')
    if not a.precommit:
        for line in value('ls-tree','-r','HEAD').splitlines():
            meta,p=line.split('\t')
            if p.startswith(PREFIX):need(meta.split()[:2]==['100644','blob'],'NONREGULAR_COMMITTED_ARTIFACT')
    print('R1 DELIVERY PASS: exact authority/preimages; evidence-only history; all admissions false;',len(seen),'regular artifact hashes; source/coverage/secret refusals retained')

if __name__=='__main__':main()
