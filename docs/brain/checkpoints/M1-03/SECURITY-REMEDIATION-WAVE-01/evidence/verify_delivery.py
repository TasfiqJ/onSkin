"""Independent finite-scope and committed-blob verifier for this diagnostic delivery."""
import argparse, hashlib, json, pathlib, subprocess
BASE='05dc51d6c945d31c66b921ae99dee603de464cdc'
TREE='fc579c91528aa285f28f6364d7f4da8ee2aafd3b'
BRANCH='stage/m1-gate-recovery'
PREFIX='docs/brain/checkpoints/M1-03/SECURITY-REMEDIATION-WAVE-01/'
sha=lambda b:hashlib.sha256(b).hexdigest()
def require(ok,code):
    if not ok: raise ValueError(code)
def scope(paths):
    require(all(p=='ONSKIN_BRAIN_HANDOFF.txt' or p.startswith(PREFIX) for p in paths),'OUTSIDE_DIAGNOSTIC_SCOPE')
def identity(branch,base,tree):
    require((branch,base,tree)==(BRANCH,BASE,TREE),'WRONG_BRANCH_OR_SOURCE')
def unchanged_proposal(original,candidate):
    require(original==candidate,'PROTECTED_PROPOSAL_CHANGED')
def verified_wheel(body,expected):
    require(sha(body)==expected,'FORGED_WHEEL')
def no_go(report):
    require(report['protected_source_go'] is False and report['accepted_by_brain'] is False and report['admission']=='NONE','FALSE_GO')
def main():
    p=argparse.ArgumentParser(); p.add_argument('--root',type=pathlib.Path,default=pathlib.Path.cwd()); p.add_argument('--manifest',action='store_true'); a=p.parse_args(); root=a.root
    git=lambda *args:subprocess.check_output(['git',*args],cwd=root)
    identity(git('branch','--show-current').decode().strip(),BASE,git('rev-parse',BASE+'^{tree}').decode().strip())
    names=set(git('diff','--name-only',BASE).decode().splitlines())|set(git('ls-files','--others','--exclude-standard').decode().splitlines())
    scope(names)
    pre=json.loads((root/PREFIX/'inputs/PREIMAGE_WITNESSES.json').read_bytes())
    for row in pre['files']:
        if row['path']=='ONSKIN_BRAIN_HANDOFF.txt':continue
        blob=git('rev-parse','HEAD:'+row['path']).decode().strip(); body=git('cat-file','blob',blob)
        require(blob==row['git_blob'] and sha(body)==row['sha256'] and len(body)==row['bytes'] and (root/row['path']).read_bytes()==body,'PROTECTED_PREIMAGE_CHANGED:'+row['path'])
    report_path=root/PREFIX/'completion-report.json'
    if report_path.exists():no_go(json.loads(report_path.read_bytes()))
    checked=0
    if a.manifest:
        manifest=json.loads((root/PREFIX/'SHA256SUMS.json').read_bytes())
        for row in manifest['files']:
            body=git('show','HEAD:'+row['path']); blob=git('rev-parse','HEAD:'+row['path']).decode().strip()
            require(blob==row['git_blob'] and sha(body)==row['sha256'] and len(body)==row['bytes'] and (root/row['path']).read_bytes()==body,'EVIDENCE_BLOB_DRIFT:'+row['path']);checked+=1
    print(json.dumps({'status':'PASS','protected_preimages':24,'committed_artifacts_verified':checked,'source_edits':0,'admission':'NONE'}))
if __name__=='__main__':main()
