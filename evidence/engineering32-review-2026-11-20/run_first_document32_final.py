import sys
from run import OUT, identity, now, write, execute
source=identity();assert not source['status']
write('FIRST_DOCUMENT_REPEAT_DECLARATION3.json',dict(at=now(),source=source,viewports=[[375,667],[390,844],[430,932]],freshProfiles=9,repeatsPerViewport=3,
 initialTarget='inert local Metro /status; observer installed before first app navigation',ordinaryOperatorRetriesAllowed=0,includeReloadDirectReturn=True,
 inducedContentionSeparate=True,stopOnFailure=True))
sys.exit(execute('final3-first-document-r1',['node',str(OUT/'first_document_runtime32.mjs')],{'ONSKIN_RUNTIME32_EVIDENCE':str(OUT/'final3-first-document-r1-browser')},clean=True))
