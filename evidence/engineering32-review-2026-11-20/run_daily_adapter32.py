import sys
from run import OUT,REPO,execute,write,identity,now
write('DAILY_REPLACEMENT_DECLARATION.json',dict(at=now(),source=identity(),viewports=[[375,667],[390,844],[430,932]],repeatsPerViewport=1,earlier375FailureRetained=True,change='Retarget the synthetic ledger refusal to the actual raw storage adapter; all substantive assertions/timeouts unchanged',stopOnFailure=True))
for width,height,offset in [('375','667',0),('390','844',1),('430','932',2)]:
 label='final3-daily-'+width+'-adapter'
 if execute(label,['node',str(OUT/'daily_backend32/onboarding-first-session.mjs'),'--daily-loop'],{'ONBOARDING_E2E_EVIDENCE_DIR':str(OUT/label),'ONBOARDING_E2E_VIEWPORT_WIDTH':width,'ONBOARDING_E2E_VIEWPORT_HEIGHT':height,'ONBOARDING_E2E_PORT':str(8600+offset),'ONBOARDING_E2E_DEBUG_PORT':str(9600+offset)},clean=True):sys.exit(1)
