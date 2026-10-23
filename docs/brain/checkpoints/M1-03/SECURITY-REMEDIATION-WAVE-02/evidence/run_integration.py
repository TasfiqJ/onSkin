import hashlib,json,os,pathlib,subprocess,sys,time,shlex
out=pathlib.Path('/evidence/integration3');out.mkdir(exist_ok=False)
sys.path.insert(0,'/work/repo/scripts/phase9/security_acceptance');import contract as c
rows=[]
launchers=pathlib.Path('/work/bridge2/old-launchers')
official_entry=c.SCANNER_BIND_GUARD+'import site;site.addsitedir(sys.argv[1]);sys.path.insert(0,sys.argv.pop(1));from semgrep.console_scripts.entrypoint import main;main()'
launcher='#!/bin/sh\nexec '+shlex.quote(sys.executable)+' -I -S -B -c '+shlex.quote(official_entry)+' /work/bridge2/old-site "$@"\n'
(launchers/'semgrep').write_text(launcher);(launchers/'semgrep').chmod(0o755)
(out/'old-launcher.json').write_text(json.dumps(dict(source=launcher,sha256=hashlib.sha256(launcher.encode()).hexdigest(),purpose='Dispatch official installed console_scripts.entrypoint.main with original source bind guard for --target installation. First attempt lacked PATH; second used Python-only collector entry unsuitable for MCP show --experimental. This third attempt uses the ACTUAL official console entry; no scanner output substituted.'),indent=2)+'\n')
for label,python,site in [('old',sys.executable,'/work/bridge2/old-site'),('new','/work/bridge2/candidate-env/bin/python','/work/bridge2/candidate-env/lib/python3.12/site-packages')]:
    bootstrap='import sys,site,runpy;p=sys.argv.pop(1);site.addsitedir(p);sys.argv=[sys.argv[1],p];runpy.run_path(sys.argv[0],run_name="__main__")'
    args=[python,'-I','-S','-B','-c',bootstrap,site,'/evidence/integration_smoke.py'];start=time.monotonic()
    with (out/(label+'.log')).open('wb') as f:
        try:code=subprocess.run(args,stdout=f,stderr=subprocess.STDOUT,cwd='/work/bridge2',timeout=120,env={**os.environ,'PYTHONDONTWRITEBYTECODE':'1','PATH':'/work/bin:/work/node-v24.19.0-linux-x64/bin:'+os.environ['PATH']}).returncode
        except subprocess.TimeoutExpired:code=124
    row=dict(label=label,argv=args,cwd='/work/bridge2',exit=code,seconds=time.monotonic()-start,log_sha256=hashlib.sha256((out/(label+'.log')).read_bytes()).hexdigest());rows.append(row)
    (out/(label+'.receipt.json')).write_text(json.dumps(row,indent=2)+'\n');print(json.dumps(row),flush=True)
(out/'summary.json').write_text(json.dumps(dict(runs=rows,old_new_pass=all(r['exit']==0 for r in rows),stage_technical_edit_eligible=False),indent=2)+'\n')
