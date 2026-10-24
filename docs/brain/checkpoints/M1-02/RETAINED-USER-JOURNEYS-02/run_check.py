"""Record a real command, its source revision, raw output and exit status."""
import datetime
import hashlib
import json
import pathlib
import subprocess
import sys
import time

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
label, *command = sys.argv[1:]
if not command or not label.replace('-', '').replace('_', '').isalnum():
    raise SystemExit('Usage: python -B run_check.py LABEL COMMAND [ARGS...]')
destination = pathlib.Path(__file__).parent / 'receipts' / label
destination.mkdir(parents=True, exist_ok=False)

def git(*args):
    return subprocess.check_output(['git', *args], text=True).strip()

receipt = {
    'command': command,
    'cwd': str(pathlib.Path.cwd()),
    'head': git('rev-parse', 'HEAD'),
    'tree': git('rev-parse', 'HEAD^{tree}'),
    'branch': git('branch', '--show-current'),
    'started_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
}
receipt['tracked_diff_sha256'] = hashlib.sha256(subprocess.check_output(['git', 'diff', '--binary', 'HEAD'])).hexdigest()
receipt['source_files_sha256'] = {
    str(path).replace('\\', '/'): hashlib.sha256(path.read_bytes()).hexdigest()
    for folder in ['shelf', 'onboarding']
    for path in (pathlib.Path('apps/mobile/src/features') / folder).glob('*') if path.is_file()
}
receipt['lockfile_sha256'] = hashlib.sha256(pathlib.Path('package-lock.json').read_bytes()).hexdigest()
started = time.monotonic()
try:
    result = subprocess.run(command, capture_output=True)
    receipt['exit'] = result.returncode
    outputs = {'stdout': result.stdout, 'stderr': result.stderr}
except OSError as error:
    receipt['exit'] = None
    receipt['execution_error'] = str(error)
    outputs = {'stdout': b'', 'stderr': str(error).encode()}
receipt['elapsed_seconds'] = round(time.monotonic() - started, 3)
for stream, data in outputs.items():
    (destination / (stream + '.txt')).write_bytes(data)
    receipt[stream + '_sha256'] = hashlib.sha256(data).hexdigest()
    receipt[stream + '_bytes'] = len(data)
(destination / 'receipt.json').write_bytes((json.dumps(receipt, indent=2) + '\n').encode())
for stream, data in outputs.items():
    print(stream.upper(), data.decode('utf-8', errors='replace')[-3500:])
print(json.dumps({key: value for key, value in receipt.items() if key != 'source_files_sha256'}, indent=2))
raise SystemExit(receipt['exit'] if receipt['exit'] is not None else 127)
