const inspector = require('node:inspector');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');
const script = resolve('scripts/docs/readiness-status-audit.mjs');
process.argv = [process.execPath, script, '--strict', '--check'];
const session = new inspector.Session();
session.connect();
session.post('Debugger.enable');
session.post('Debugger.setBreakpointByUrl', { url: pathToFileURL(script).href, lineNumber: 1680 });
session.on('Debugger.paused', ({ params }) => {
  const expression = 'JSON.stringify({snapshot:verifyReadinessStatusSnapshot(sourceSnapshot),inventory:inventoryStabilityErrors(),chain:governedEvidenceChainStabilityErrors(),blockers,sourceHead:sourceSnapshot.headSha,recorded:sourceSnapshotSummary})';
  session.post('Debugger.evaluateOnCallFrame', { callFrameId: params.callFrames[0].callFrameId, expression, returnByValue:true }, (error, result) => {
    console.error('RELEASE10_READ_ONLY_INSPECTOR_DIAGNOSTIC', error || result.result.value);
    session.post('Debugger.resume');
  });
});
import(pathToFileURL(script).href);
