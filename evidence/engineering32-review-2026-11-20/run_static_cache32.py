import sys
from run import OUT,identity,now,write,execute
write('STATIC_CACHE_DECLARATION.json',dict(at=now(),source=identity(),cases=1,viewport=[390,844],productionExport='build/consumer-final-drain32',actualHistoryNavigation=True,noSyntheticLifecycle=True,noAdmissionRetries=True,runAfterFinalBuild=True))
sys.exit(execute('final-static-cache32',['node',str(OUT/'static_cache32.mjs')],{'ONSKIN_STATIC32_EVIDENCE':str(OUT/'final-static-cache32-browser'),'ONSKIN_STATIC32_BUILD':str(OUT/'build/consumer-final-drain32')},clean=True))
