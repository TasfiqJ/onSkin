import datetime
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import time

sys.stdout.reconfigure(encoding='utf-8')
run_dir = Path(__file__).resolve().parent
repo = Path(os.environ.get('CAMPAIGN05_CHECKOUT', r'C:\Users\jasim\Desktop\WeddingCards\work\m102-retained-resilience'))
name, *command = sys.argv[1:]
assert name and not any(c in name for c in '/\\:'), name

def git(*args):
    return subprocess.check_output(['git', *args], cwd=repo).decode('utf-8').strip()

start = datetime.datetime.now(datetime.timezone.utc).isoformat()
head = git('rev-parse', 'HEAD')
tree = git('rev-parse', 'HEAD^{tree}')
status = git('status', '--porcelain=v1')
diff = subprocess.check_output(['git', 'diff', '--binary', 'HEAD'], cwd=repo)
changed = set(git('diff', '--name-only', 'HEAD').splitlines()) | set(git('ls-files', '--others', '--exclude-standard').splitlines())
working_files = []
for relative in sorted(changed):
    path = repo / relative
    if path.is_file():
        working_files.append(dict(path=relative, bytes=path.stat().st_size, sha256=hashlib.sha256(path.read_bytes()).hexdigest()))
log = run_dir / (name + '.log')
assert not log.exists(), log
clock = time.monotonic()
with log.open('wb') as stream:
    result = subprocess.run(command, cwd=repo, stdout=stream, stderr=subprocess.STDOUT)
receipt = dict(command=command, cwd=str(repo), started_at=start,
               finished_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),
               duration_seconds=round(time.monotonic()-clock, 3), exit_code=result.returncode,
               head=head, tree=tree, status_before=status,
               tracked_diff_sha256=hashlib.sha256(diff).hexdigest(),
               working_files=working_files,
               status_after=git('status', '--porcelain=v1'),
               log=log.name, log_bytes=log.stat().st_size,
               log_sha256=hashlib.sha256(log.read_bytes()).hexdigest())
(run_dir / (name + '.json')).write_text(json.dumps(receipt, indent=2)+'\n', encoding='utf-8')
print(json.dumps({k:receipt[k] for k in ['exit_code','head','duration_seconds','log','log_sha256']}, indent=2))
print(log.read_text(encoding='utf-8', errors='replace')[-4500:])
sys.exit(result.returncode)
