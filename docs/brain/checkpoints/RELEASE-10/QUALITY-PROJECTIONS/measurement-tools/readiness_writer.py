import hashlib,json,pathlib,subprocess
from run import ROOT,OUT,run
assert not subprocess.check_output(['git','status','--porcelain=v1'],cwd=ROOT).strip()
paths=['docs/generated/readiness-status-audit.json','docs/generated/readiness-status-audit.md']
before={p:(ROOT/p).read_bytes() for p in paths}
try:
    result=run('readiness-official-writer',['node','scripts/docs/readiness-status-audit.mjs','--strict'])
finally:
    unchanged={p:(ROOT/p).exists() and (ROOT/p).read_bytes()==raw for p,raw in before.items()}
    # Restore only these two explicitly authorized output preimages if publication aborted.
    for p,raw in before.items():
        if not unchanged[p]:(ROOT/p).write_bytes(raw)
    row=dict(exit=result,unchanged_before_restore=unchanged,sha256={p:hashlib.sha256(raw).hexdigest() for p,raw in before.items()},
             status='BLOCKED_OUTSIDE_SCOPE',provenance='No valid real governed source/evidence/RC chain available')
    (OUT/'readiness-writer-preservation.json').write_bytes((json.dumps(row,indent=2)+'\n').encode())
    print(json.dumps(row))
