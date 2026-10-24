"""Capture actual commands/exits; invoke from the repository root."""
import datetime, hashlib, json, os, pathlib, subprocess, sys, time
sys.stdout.reconfigure(encoding='utf-8')

ROOT = pathlib.Path(__file__).resolve().parents[5]
OUT = pathlib.Path(__file__).resolve().parent / 'receipts'
name, *args = sys.argv[1:]
run_root = ROOT
if args[:1] == ['--cwd']:
    run_root = pathlib.Path(args[1])
    args = args[2:]
OUT.mkdir(exist_ok=True)
start = datetime.datetime.now(datetime.timezone.utc).isoformat()
tick = time.monotonic()
source_start = dict(head=subprocess.check_output(['git','rev-parse','HEAD'], cwd=run_root).decode().strip(),
    tree=subprocess.check_output(['git','rev-parse','HEAD^{tree}'], cwd=run_root).decode().strip(),
    dirty=subprocess.check_output(['git','status','--short'], cwd=run_root).decode())
result = subprocess.run(args, cwd=run_root, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
    env={**os.environ, 'CI': 'true', 'TURBO_TELEMETRY_DISABLED': '1', 'EXPO_NO_TELEMETRY': '1'})
log = OUT / (name + '.log')
log.write_bytes(result.stdout)
receipt = dict(command=args, cwd=str(run_root), started_utc=start, exit=result.returncode,
    source_start=source_start,
    seconds=round(time.monotonic()-tick, 3), sha256=hashlib.sha256(result.stdout).hexdigest(),
    head=subprocess.check_output(['git','rev-parse','HEAD'], cwd=run_root).decode().strip(),
    dirty=subprocess.check_output(['git','status','--short'], cwd=run_root).decode())
log.with_suffix('.json').write_text(json.dumps(receipt, indent=2)+'\n', encoding='utf-8')
print(json.dumps(receipt))
print(result.stdout.decode('utf-8', errors='replace')[-6500:])
sys.exit(result.returncode)
