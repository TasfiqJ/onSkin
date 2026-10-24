import subprocess,sys,pathlib,json,datetime,time
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
log=pathlib.Path(sys.argv[1]); cwd=sys.argv[2]; args=sys.argv[3:]
start=datetime.datetime.now(datetime.timezone.utc).isoformat(); t=time.monotonic()
r=subprocess.run(args,cwd=cwd,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
log.parent.mkdir(parents=True,exist_ok=True); log.write_bytes(r.stdout)
receipt=dict(command=args,cwd=cwd,start=start,exit=r.returncode,seconds=round(time.monotonic()-t,3),log=str(log))
log.with_suffix(log.suffix+'.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps(receipt)); print(r.stdout.decode('utf-8','replace')[-6500:]); sys.exit(r.returncode)
