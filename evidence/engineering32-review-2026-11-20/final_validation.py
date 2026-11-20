import json
import subprocess
import sys
from run import OUT, REPO, execute, write
def invoke(label,args):
    print('BEGIN '+label,flush=True)
    code=execute(label,args,clean=True)
    print(('PASS ' if code==0 else 'FAIL ')+label,flush=True)
    return dict(label=label,exit=code)
prior=OUT.parent/'ENGINEERING30_EVIDENCE_20261119'
suffix='-'+sys.argv[1] if len(sys.argv)>1 else ''
tasks=[
 ('final-root-tests',['npm.cmd','test','--','--force','--concurrency=1','--','--maxWorkers=4']),
 ('final-typecheck',['npm.cmd','run','typecheck','--','--force']),
 ('final-lint',['npm.cmd','run','lint','--','--force']),
 ('final-consumer-build',['npm.cmd','--workspace','apps/mobile','exec','--','expo','export','--platform','web','--output-dir',str(OUT/'build/consumer-final')]),
 ('final-professional-build',['npm.cmd','--workspace','apps/professional-web','run','build','--','--outDir',str(OUT/'build/professional-final')]),
 *[(name,json.loads((prior/(name+'-r3.json')).read_text())['command']) for name in ['final-privacy','final-consumer-authority','final-manual-recovery']],
 ('final-connected-recovery',['npm.cmd','--workspace','apps/mobile','run','test','--',
   'src/features/routine/routineDecisionRecovery32.test.ts','src/lib/storage/webRuntimeHandoff32.test.ts','src/lib/storage/webRuntimeAdmission.test.ts','src/features/routine/actualRoutineJourney.test.ts','src/features/routine/actualRoutineStore.test.ts',
   'src/features/shelf/coreJourney.campaign06.test.ts','src/features/shelf/savedProductCompare.test.ts',
   'src/features/shelf/appointmentBriefRecords.test.ts','src/features/shelf/shareAppointmentBrief.test.ts','src/features/shelf/diaryBriefPhoto.test.ts',
   'src/features/photos/progressDataAuthority.c08a1.test.ts','src/features/photos/progressDetailUX.c08b2.test.ts','src/features/photos/photoNoteHistory.test.ts',
   'src/features/photos/photoRecoveryCopy.test.ts','src/lib/accessibility/inlineDialogFocus.test.ts','src/lib/accessibility/modalBackground.test.ts']),
 ('final-driver-regressions',json.loads((prior/'final-driver-regressions-r3.json').read_text())['command'])]
results=[];target_cases={}
all_cases=[p.relative_to(REPO/'apps/mobile').as_posix() for p in (REPO/'apps/mobile/src').rglob('*.test.ts')]
for label,args in tasks:
    if 'run' in args and 'test' in args and not any(arg.startswith('--maxWorkers') for arg in args):
        if label=='final-privacy':args += ['src/lib/storage/privateAsyncStorage32.test.ts','src/features/settings/localPrivateDataKeys.test.ts','src/features/healthConsent/dependentConsentCleanup.test.ts','src/features/healthConsent/lifecycle.test.ts']
        args += ['--maxWorkers=4']
    if suffix:args=[arg.replace('consumer-final','consumer-final'+suffix).replace('professional-final','professional-final'+suffix) for arg in args]
    patterns=[arg for arg in args if arg.startswith('src/')]
    for pattern in patterns:
        matched=[case for case in all_cases if pattern in case];assert matched,('No real test case matches',label,pattern)
        target_cases[label+suffix+'::'+pattern]=matched
    results.append(invoke(label+suffix,args))
write('FINAL_TARGET_CASES'+suffix+'.json',target_cases)
write('FINAL_CHECKS_SUMMARY'+suffix+'.json',results)
sys.exit(0 if all(r['exit']==0 for r in results) else 1)
