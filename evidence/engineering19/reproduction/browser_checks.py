import os, re, subprocess, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent
REPO=ROOT.parent/'c16-candidate'
kind=sys.argv[1]
base={k:v for k,v in os.environ.items() if not k.startswith('EXPO_PUBLIC_') and not re.search(r'(TOKEN|SECRET|PASSWORD|CREDENTIAL|API_KEY|PRIVATE_KEY|ACCESS_KEY)',k,re.I)}
for width,height in [(375,667),(430,932)]:
    env=base.copy()
    if kind=='consumer':
        label=f'consumer-{width}'
        env.update(ONBOARDING_E2E_EVIDENCE_DIR=str(ROOT/label), ONBOARDING_E2E_VIEWPORT_WIDTH=str(width), ONBOARDING_E2E_VIEWPORT_HEIGHT=str(height), ONBOARDING_E2E_PORT='8491', ONBOARDING_E2E_DEBUG_PORT='9491')
        command=['node','.tmp/engineering19/consumer-flow.mjs']
        result=subprocess.run([sys.executable,'-X','utf8',str(ROOT/'run_check.py'),label,*command],cwd=REPO,env=env)
        if result.returncode: raise SystemExit(result.returncode)
    else:
        for mode,script in [('queue','professional-reconciliation'),('owner','professional-owner')]:
            label=f'professional-{mode}-{width}'
            if (ROOT/(label+'.log')).exists(): label += '-v2'
            env.update(ONSKIN_E2E_EVIDENCE='../ENGINEERING19_EVIDENCE/professional-browser')
            command=['node',f'scripts/e2e/{script}.mjs',str(width),str(height)]
            result=subprocess.run([sys.executable,'-X','utf8',str(ROOT/'run_check.py'),label,*command],cwd=REPO,env=env)
            if result.returncode: raise SystemExit(result.returncode)
