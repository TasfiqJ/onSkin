// One finite production-bundle history/BFCache probe. No synthetic lifecycle event.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn,execFileSync} from 'node:child_process';
import {readFileSync,existsSync,statSync,mkdirSync,mkdtempSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import * as b from '../c16-candidate/scripts/e2e/cat04-catalog-recovery-audit.mjs';
import {traceRuntimeAdmission32} from '../c16-candidate/scripts/e2e/runtime-admission-trace32.mjs';
const out=process.env.ONSKIN_STATIC32_EVIDENCE,build=path.resolve(process.env.ONSKIN_STATIC32_BUILD);assert(out&&existsSync(path.join(build,'index.html')));mkdirSync(out);
const json=(name,value)=>writeFileSync(path.join(out,name),JSON.stringify(value,null,2)+'\n');
const appPort=await b.findAvailablePort(8640),debugPort=await b.findAvailablePort(9640),origin=`http://localhost:${appPort}`;
json('DECLARED_MATRIX.json',{cases:1,viewport:[390,844],flow:['inert status','first app document','inert same-origin navigation','actual history return','independent exclusive-lock refusal'],automaticRetries:0,manualRetries:0,syntheticLifecycleEvents:0});
const traces=[],summary={pass:false,source:execFileSync('git',['rev-parse','HEAD'],{cwd:path.resolve('../c16-candidate'),encoding:'utf8'}).trim(),scope:'Local production web export, no configured identity/provider/native qualification'};
let browser,client,probe;
const mime={'.js':'application/javascript','.css':'text/css','.json':'application/json','.html':'text/html','.png':'image/png','.svg':'image/svg+xml'};
const server=createServer((request,response)=>{
 const route=decodeURIComponent(new URL(request.url,origin).pathname);
 if(route==='/status'){response.setHeader('Content-Type','text/plain');response.end('runtime32-static-status');return;}
 let file=path.resolve(build,'.'+route);if(file!==build&&!file.startsWith(build+path.sep)){response.writeHead(403);response.end();return;}
 if(existsSync(file)&&statSync(file).isDirectory())file=path.join(file,'index.html');
 if(!existsSync(file)&&existsSync(file+'.html'))file+='.html';
 if(!existsSync(file)){if(path.extname(route)){response.writeHead(404);response.end();return;}file=path.join(build,'index.html');}
 response.setHeader('Content-Type',mime[path.extname(file)]??'application/octet-stream');response.end(readFileSync(file));
});
try{
 await new Promise(resolve=>server.listen(appPort,'127.0.0.1',resolve));
 browser=spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',['--headless=new',`--remote-debugging-port=${debugPort}`,`--user-data-dir=${mkdtempSync(path.join(tmpdir(),'onskin-runtime32-static-'))}`,'--no-first-run','--disable-background-networking','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1','about:blank'],{stdio:'ignore',windowsHide:true});
 json('owned-processes.json',{browserPid:browser.pid,serverPid:process.pid,appPort,debugPort});
 client=await b.connectToPage(debugPort,origin+'/status');await client.send('Page.enable');await client.send('Runtime.enable');await b.setViewport(client,{width:390,height:844});
 await traceRuntimeAdmission32(client,event=>traces.push(event));
 await client.send('Page.navigate',{url:origin+'/'});await b.waitForCondition(client,"globalThis.__layerwellPrivateWebRuntime?.snapshot()==='admitted'",30000,'production first exclusive admission');
 const before=await b.evaluate(client,'({documentId:globalThis.__runtimeDocument32,transitions:globalThis.__layerwellPrivateWebRuntime.diagnostics()})');
 const history=await client.send('Page.getNavigationHistory'),entry=history.entries[history.currentIndex].id;
 await client.send('Page.navigate',{url:origin+'/status'});await b.waitForCondition(client,"location.pathname==='/status'&&!globalThis.__layerwellPrivateWebRuntime",30000,'actual inert document');
 await client.send('Page.navigateToHistoryEntry',{entryId:entry});await b.waitForCondition(client,"location.pathname==='/'&&globalThis.__layerwellPrivateWebRuntime?.snapshot()==='admitted'",30000,'history returned with exclusive admission');
 const after=await b.evaluate(client,'({documentId:globalThis.__runtimeDocument32,transitions:globalThis.__layerwellPrivateWebRuntime.diagnostics()})');
 probe=await b.connectToPage(debugPort,origin+'/status');await probe.send('Runtime.enable');
 const competingAcquired=await b.evaluate(probe,"(async()=>{let acquired=null;await navigator.locks.request('layerwell.private-runtime.v1',{mode:'exclusive',ifAvailable:true},lock=>{acquired=lock!==null});return acquired})()",true);
 assert.equal(competingAcquired,false,'Restored admitted owner must actually retain exclusive authority');
 summary.cacheNotUsedReasons=client.events.filter(row=>row.method==='Page.backForwardCacheNotUsed').flatMap(row=>(row.params.notRestoredExplanations??[]).map(item=>item.reason));summary.before=before;summary.after=after;summary.actualCachedRestore=traces.some(row=>row.event==='pageshow'&&row.persisted);summary.sameDocumentRestored=before.documentId===after.documentId;summary.competingAcquired=competingAcquired;summary.pass=true;
}catch(error){summary.error=String(error);summary.stack=error.stack;process.exitCode=1;}
finally{client?.close();probe?.close();await b.stopProcessBestEffort(browser);await new Promise(resolve=>server.close(resolve));json('TRACE.json',traces);json('SUMMARY.json',summary);}
