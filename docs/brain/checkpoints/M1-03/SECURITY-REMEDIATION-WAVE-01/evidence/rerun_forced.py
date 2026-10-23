"""Rerun original commands after repairing this container's noexec scratch mount."""
import datetime, hashlib, json, os, pathlib, subprocess, sys, time
root=pathlib.Path(sys.argv[1] if len(sys.argv)>1 else '/work/repo'); out=pathlib.Path(sys.argv[2] if len(sys.argv)>2 else '/evidence/docker-forced-rerun');out.mkdir(exist_ok=False)
npm=['node','/work/npm-runtime/node_modules/npm/bin/npm-cli.js']
plan=[('npm-ci',npm+['ci','--no-audit','--no-fund'])] if '--fresh-ci' in sys.argv else []
plan += [('root-'+name,npm+['run',name,'--','--force']) for name in ('test','typecheck','lint')]
for name,argv in plan:
    begin=time.monotonic();started=datetime.datetime.now(datetime.timezone.utc).isoformat()
    with (out/(name+'.log')).open('wb') as f:
        try:code=subprocess.run(argv,cwd=root,stdout=f,stderr=subprocess.STDOUT,timeout=900,env={**os.environ,'TURBO_TELEMETRY_DISABLED':'1','DO_NOT_TRACK':'1'}).returncode
        except subprocess.TimeoutExpired:code=124
    body=(out/(name+'.log')).read_bytes()
    receipt={'name':name,'argv':argv,'cwd':str(root),'started':started,'ended':datetime.datetime.now(datetime.timezone.utc).isoformat(),'seconds':time.monotonic()-begin,'exit':code,
             'log_sha256':hashlib.sha256(body).hexdigest(),'head':subprocess.check_output(['git','rev-parse','HEAD'],cwd=root).decode().strip(),'tree':subprocess.check_output(['git','rev-parse','HEAD^{tree}'],cwd=root).decode().strip(),
             'source_changes_after':subprocess.check_output(['git','status','--porcelain','--untracked-files=no'],cwd=root).decode()}
    (out/(name+'.receipt.json')).write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps({'command':name,'exit':code}),flush=True)
