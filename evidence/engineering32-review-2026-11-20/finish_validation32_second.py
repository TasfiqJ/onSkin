import json, subprocess, sys
from run import OUT, REPO, execute, write, identity, now

source=identity();assert not source['status']
write('FINAL_REPEAT_DECLARATION2.json',dict(at=now(),source=source,
 ordinaryCommittedDriverRepeats=3,viewports=[[375,667],[390,844],[430,932]],freshProfilePerViewport=True,
 runtimeOnlyFreshProfiles=9,ordinaryOperatorRetriesAllowed=0,
 induced=['closing holder','sustained holder and explicit retry','pending document reload','unsupported locks','rejected locks','raw strict-storage denial','unsupported database schema'],
 retainedEarlierRuns=True,stopOnFailure=True))
for repeat in range(1,4):
 label='final-acceptance2-connected-r'+str(repeat)
 code=execute(label,['node','scripts/e2e/actual-apply-outcome29.mjs'],{'ONSKIN_OUTCOME_EVIDENCE':str(OUT/(label+'-browser'))},clean=True)
 if code:sys.exit(code)
label='final-runtime2-r1'
if execute(label,['node','scripts/e2e/runtime-handoff32.mjs'],{'ONSKIN_RUNTIME32_EVIDENCE':str(OUT/(label+'-browser'))},clean=True):sys.exit(1)
for args in [['final-diary'],['final-intake'],['final-daily-375','375'],['final-daily-390','390'],['final-daily-430','430']]:
 if subprocess.call([sys.executable,str(OUT/'browser_validation.py'),*args],cwd=REPO):sys.exit(1)
sys.exit(subprocess.call([sys.executable,str(OUT/'final_validation.py')],cwd=REPO))
