import os, subprocess, sys
from pathlib import Path
root=Path(__file__).resolve().parent.parent
repo=root.parent/'c16-candidate'
os.environ['BROWSER_PATH']=r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
os.environ['ONSKIN_INTAKE_EVIDENCE']=str(root/'checks/manual-browser')
os.environ['ONSKIN_CHANGE_EVIDENCE']=str(root/'checks/optional-browser')
os.environ['ONSKIN_RECOVERY_EVIDENCE']=str(root/'checks/recovery-browser')
os.environ['ONSKIN_E2E_EVIDENCE']='../BRAIN_LATEST_REVIEW_2026-11-18/checks/professional-browser'
jobs=[('current-manual-browser',['node','scripts/e2e/manual-intake-drafts21.mjs']),
 ('current-optional-browser',['node','scripts/e2e/optional-change-drafts21.mjs']),
 ('current-recovery-browser',['node',str(root.parent/'ENGINEERING25_EVIDENCE/local-recovery-browser25.mjs')])]
for width,height in [(375,667),(430,932)]:
 for name,script in [('queue','professional-reconciliation'),('owner','professional-owner')]:
  jobs.append((f'current-professional-{name}-{width}',['node',f'scripts/e2e/{script}.mjs',str(width),str(height)]))
results=[]
for label,args in jobs:
 result=subprocess.run([sys.executable,'-X','utf8',str(root/'audit/run_check.py'),label,*args],cwd=repo)
 results.append((label,result.returncode))
print(results,flush=True)
raise SystemExit(0 if all(code==0 for _,code in results)else 1)
