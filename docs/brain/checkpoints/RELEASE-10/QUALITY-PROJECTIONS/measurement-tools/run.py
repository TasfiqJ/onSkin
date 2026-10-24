import datetime, json, pathlib, shutil, subprocess, sys, time
sys.stdout.reconfigure(encoding='utf-8')
ROOT = pathlib.Path(r'C:\Users\jasim\Desktop\WeddingCards\work\m102-retained-resilience')
OUT = pathlib.Path(__file__).parent / 'logs'
OUT.mkdir(exist_ok=True)
def run(name, argv):
    start = datetime.datetime.now(datetime.timezone.utc).isoformat()
    source = subprocess.check_output(['git','rev-parse','HEAD','HEAD^{tree}'], cwd=ROOT).decode().splitlines()
    before = subprocess.check_output(['git','status','--porcelain=v1'], cwd=ROOT).decode()
    with (OUT/(name+'.log')).open('xb') as f:
        p = subprocess.run(argv, cwd=ROOT, stdout=f, stderr=subprocess.STDOUT)
    row = dict(name=name, argv=argv, cwd=str(ROOT), source=source, status_before=before,
               started=start, finished=datetime.datetime.now(datetime.timezone.utc).isoformat(),
               exit=p.returncode, disk_free=shutil.disk_usage(ROOT).free)
    (OUT/(name+'.json')).write_text(json.dumps(row,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(row),flush=True)
    print((OUT/(name+'.log')).read_text(encoding='utf-8',errors='replace')[-2200:],flush=True)
    return p.returncode
if __name__ == '__main__': run(sys.argv[1],sys.argv[2:])
