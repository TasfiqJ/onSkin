"""Capture an actual command and its unmodified output; grant no admission."""
import datetime
import json
import pathlib
import subprocess
import sys
import time

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
label, cwd, *command = sys.argv[1:]
directory = pathlib.Path(__file__).resolve().parent
started = datetime.datetime.now(datetime.timezone.utc).isoformat()
clock = time.monotonic()
with (directory / (label + '.log')).open('wb') as output:
    result = subprocess.run(command, cwd=cwd, stdout=output, stderr=subprocess.STDOUT)
receipt = dict(label=label, command=command, cwd=cwd, started_utc=started,
               finished_utc=datetime.datetime.now(datetime.timezone.utc).isoformat(),
               seconds=round(time.monotonic() - clock, 3), raw_exit=result.returncode)
(directory / (label + '.json')).write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8')
print(json.dumps(receipt))
print((directory / (label + '.log')).read_text(encoding='utf-8', errors='replace')[-10000:])
sys.exit(result.returncode)
