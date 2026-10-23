"""Capture local, credential-free checks with raw exits in an external evidence directory."""
import argparse
import datetime
import json
import os
import pathlib
import subprocess
import sys
import time

from review import BASE, FLAGS, canonical, git, need, sha


def run(repo, out, label, args, timeout):
    folder=out/label;folder.mkdir()
    environment=dict(os.environ, PYTHONDONTWRITEBYTECODE='1')
    started=datetime.datetime.now(datetime.timezone.utc).isoformat()
    begin=time.monotonic()
    intent=dict(args=args,cwd=str(repo),started=started,timeout_seconds=timeout,
                environment={'PYTHONDONTWRITEBYTECODE':'1'},
                environment_note='Other host variables inherited; no values exported. No credential use requested.')
    (folder/'intent.json').write_bytes(canonical(intent))
    timed_out=False
    with (folder/'stdout.txt').open('wb') as stdout,(folder/'stderr.txt').open('wb') as stderr:
        p=subprocess.Popen(args,cwd=repo,env=environment,stdout=stdout,stderr=stderr)
        try:code=p.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            timed_out=True
            if os.name=='nt':
                subprocess.run(['taskkill','/PID',str(p.pid),'/T','/F'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
            else:p.kill()
            code=p.wait()
    result=dict(raw_exit=code,timed_out=timed_out,status='INCOMPLETE' if timed_out else 'PASS' if code==0 else 'FAIL',
                elapsed_seconds=round(time.monotonic()-begin,3),
                finished=datetime.datetime.now(datetime.timezone.utc).isoformat(),
                stdout_sha256=sha((folder/'stdout.txt').read_bytes()),stderr_sha256=sha((folder/'stderr.txt').read_bytes()))
    (folder/'result.json').write_bytes(canonical(result))
    print(label,json.dumps(result),flush=True)
    return result


def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--repo',type=pathlib.Path,required=True)
    p.add_argument('--out',type=pathlib.Path,required=True);a=p.parse_args();repo=a.repo.resolve();out=a.out.absolute()
    need(not out.exists() and not out.is_relative_to(repo),'NEW_EXTERNAL_OUTPUT_REQUIRED')
    need(not git(repo,'status','--porcelain=v1','--untracked-files=all'),'CLEAN_SOURCE_REQUIRED')
    out.mkdir(parents=True)
    checks=[('new-adversarial',[sys.executable,'-B','-m','unittest','discover','-s','scripts/security_readiness/m103/source_inventory_review','-p','test_review.py','-v'],120),
            ('security70',[sys.executable,'-B','-m','unittest','discover','-s','scripts/phase9/security_acceptance','-p','test_contract.py','-v'],180),
            ('secret12',[sys.executable,'-B','-m','unittest','discover','-s','scripts/phase9/security_acceptance','-p','test_secret_scan.py','-v'],180),
            ('expiry8',['node','--test','scripts/phase9/security-advisory-exceptions.test.mjs'],180),
            ('phase4-worklist',['node','scripts/phase4/build-source-worklist.mjs','--strict','--check'],180),
            ('original-source-scope',[sys.executable,'-B','scripts/phase9/security_acceptance/contract.py','source'],180),
            ('governance103',[sys.executable,'-B','-m','unittest','discover','-s','scripts/brain','-p','test_*.py','-v'],600)]
    results={label:run(repo,out,label,args,timeout) for label,args,timeout in checks}
    receipt=dict(source_commit=git(repo,'rev-parse','HEAD').decode().strip(),
                 source_tree=git(repo,'rev-parse','HEAD^{tree}').decode().strip(),
                 python=sys.version,platform=sys.platform,results=results,**FLAGS)
    (out/'receipt.json').write_bytes(canonical(receipt))
    return 1 if any(v['status']=='INCOMPLETE' for v in results.values()) else 0


if __name__=='__main__':sys.exit(main())
