import sys
from run import OUT, execute
label=sys.argv[1]
if 'continuity' in label:
    command=['node','scripts/e2e/actual-apply-outcome29.mjs']; overrides={'ONSKIN_OUTCOME_EVIDENCE':str(OUT/label)}
    if label=='final-continuity4':command=['node',str(OUT/'continuity_supervised.mjs')]
elif 'diary' in label:
    command=['node','scripts/e2e/diary-note-history.mjs','--evidence',str(OUT/label)]; overrides={}
elif 'intake' in label:
    command=['node','scripts/e2e/manual-intake-drafts21.mjs']; overrides={'ONSKIN_INTAKE_EVIDENCE':str(OUT/label),'ONSKIN_INTAKE_LIFECYCLE30':'1'}
elif 'daily' in label:
    width=sys.argv[2];height={'375':'667','390':'844','430':'932'}[width];offset={'375':0,'390':1,'430':2}[width]
    command=['node','scripts/e2e/onboarding-first-session.mjs','--daily-loop']; overrides={'ONBOARDING_E2E_EVIDENCE_DIR':str(OUT/label),
      'ONBOARDING_E2E_VIEWPORT_WIDTH':width,'ONBOARDING_E2E_VIEWPORT_HEIGHT':height,'ONBOARDING_E2E_PORT':str(8600+offset),'ONBOARDING_E2E_DEBUG_PORT':str(9600+offset)}
else: raise AssertionError(label)
sys.exit(execute(label,command,overrides,clean=label.startswith('final-')))
