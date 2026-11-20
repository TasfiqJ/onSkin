// Finite runtime-only real-browser matrix. No external retry supervisor.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import * as b from '../c16-candidate/scripts/e2e/cat04-catalog-recovery-audit.mjs';
import { traceRuntimeAdmission32 } from '../c16-candidate/scripts/e2e/runtime-admission-trace32.mjs';

const out = process.env.ONSKIN_RUNTIME32_EVIDENCE;
assert(out); mkdirSync(out);
const json = (name, value) => writeFileSync(path.join(out, name), JSON.stringify(value, null, 2) + '\n');
const appPort = await b.findAvailablePort(8520), debugPort = await b.findAvailablePort(9520), origin = `http://localhost:${appPort}`;
const receipt = { ordinary: [], induced: [], interventions: [], failures: [], traces: [] };
json('DECLARED_MATRIX.json', { repeats: 3, viewports: [[375,667],[390,844],[430,932]], ordinary: ['startup','reload','direct entry','return navigation'],
  induced: ['transient closing holder','live second tab refusal and explicit retry','pending reload termination','unsupported','denied'], ordinaryRetryBudget: 0 });
let server, browser;
const clients = new Set();
const evaluate = (client, source) => b.evaluate(client, source, true);
const state = client => evaluate(client, `({status:globalThis.__layerwellPrivateWebRuntime?.snapshot(),transitions:globalThis.__layerwellPrivateWebRuntime?.diagnostics(),privateCalls:globalThis.__privateCalls32??0,privateDatabaseCalls:globalThis.__privateDatabaseCalls32??0})`);
async function page(width, height, setup = '') {
  const client = await b.connectToPage(debugPort, origin+'/status'); clients.add(client);
  await client.send('Runtime.enable'); await client.send('Page.enable');
  await b.waitForCondition(client, "document.body?.innerText.trim()==='packager-status:running' && !globalThis.__layerwellPrivateWebRuntime",30000,'inert Metro status page before first app execution'); await b.setViewport(client, { width, height });
  await traceRuntimeAdmission32(client, event => { receipt.traces.push(event); json('TRACE.json', receipt.traces); });
  await client.send('Page.addScriptToEvaluateOnNewDocument', { source: `globalThis.__privateDatabaseCalls32=0;const open32=IDBFactory.prototype.open;IDBFactory.prototype.open=function(name,...args){if(name==='layerwell.routine-decision-ciphertext.v1')++globalThis.__privateDatabaseCalls32;return Reflect.apply(open32,this,[name,...args])}` });
  await client.send('Page.addScriptToEvaluateOnNewDocument', { source: `globalThis.__privateCalls32=0;for(const method of ['getItem','setItem','removeItem']){const original=Storage.prototype[method];Storage.prototype[method]=function(key,...args){if(/^(layerwell\\.|sb-)/.test(key))++globalThis.__privateCalls32;return Reflect.apply(original,this,[key,...args])}};${setup}` });
  return client;
}
async function newDocument(client, action) {
  const previous = await evaluate(client, 'globalThis.__runtimeDocument32??null');
  await action();
  await b.waitForCondition(client, `!!globalThis.__runtimeDocument32&&globalThis.__runtimeDocument32!==${JSON.stringify(previous)}`,30000,'successor document identity');
}
async function navigate(client, route = '/') { await newDocument(client, () => client.send('Page.navigate', { url: origin + route })); }
async function admitted(client) { await b.waitForCondition(client, `globalThis.__layerwellPrivateWebRuntime?.snapshot()==='admitted'`, 30000, 'actual exclusive admission'); return state(client); }
async function close(client) {
  const { targetInfo } = await client.send('Target.getTargetInfo');
  await client.send('Target.closeTarget', { targetId: targetInfo.targetId }).catch(() => {}); client.close(); clients.delete(client);
}
try {
  server = b.startExpoServer({ appPort, evidenceDir: out, group: { id: 'runtime32', env: { EXPO_PUBLIC_E2E_FIRST_SESSION_AUTH: 'anonymous_owner', EXPO_PUBLIC_NATIVE_CAMERA_ENABLED: 'false' } } });
  await b.waitForUrl(origin);
  for (const [width,height] of [[375,667],[390,844],[430,932]]) for (let repeat=1; repeat<=3; repeat++) {
    // A new browser process/profile is a fresh session at each matrix cell.
    browser = spawn(process.env.BROWSER_PATH ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
      ['--headless=new',`--remote-debugging-port=${debugPort}`,`--user-data-dir=${mkdtempSync(path.join(tmpdir(),'onskin-runtime32-'))}`,
        '--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-extensions','--disable-sync',
        '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1','about:blank'], { stdio:'ignore', windowsHide:true });
    json(`owned-${width}-${repeat}.json`, { browserPid: browser.pid, serverPid: server.pid, appPort, debugPort });
    const client = await page(width,height); await navigate(client);
    const startup = await admitted(client);
    await newDocument(client, () => client.send('Page.reload')); const reload = await admitted(client);
    await navigate(client,'/routine/records'); const direct = await admitted(client);
    await navigate(client,'/you'); await admitted(client);
    const history = await client.send('Page.getNavigationHistory');
    await newDocument(client, () => client.send('Page.navigateToHistoryEntry', { entryId: history.entries[history.currentIndex-1].id }));
    const returned = await admitted(client);
    for (const result of [startup,reload,direct,returned]) {
      assert.equal(result.transitions.filter(row=>row.reason==='exclusive-request').length,1);
      assert(!result.transitions.some(row=>row.status==='occupied'||row.status==='unavailable'));
    }
    receipt.ordinary.push({width,height,repeat,startup,reload,direct,returned,automaticRetries:0,manualRetries:0,pass:true});
    const shot = await client.send('Page.captureScreenshot',{format:'png'}); writeFileSync(path.join(out,`${width}-${repeat}.png`),Buffer.from(shot.data,'base64'));
    await close(client); await b.stopProcessBestEffort(browser); browser=undefined;
  }
  // Induced cases use a separate session and never count as ordinary success.
  browser = spawn(process.env.BROWSER_PATH ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    ['--headless=new',`--remote-debugging-port=${debugPort}`,`--user-data-dir=${mkdtempSync(path.join(tmpdir(),'onskin-contention32-'))}`,'--no-first-run','--disable-background-networking','about:blank'], {stdio:'ignore',windowsHide:true});
  let holder = await page(390,844); await navigate(holder); await admitted(holder);
  let next = await page(390,844); await navigate(next);
  await b.waitForCondition(next, `globalThis.__layerwellPrivateWebRuntime?.snapshot()==='checking'`,30000,'handoff queued');
  const pending = await state(next); assert.equal(pending.privateCalls,0); assert.equal(pending.privateDatabaseCalls,0);
  await close(holder); const handoff = await admitted(next);
  receipt.induced.push({case:'transient closing holder',pending,handoff,manualRetries:0,pass:true}); holder=next;
  next=await page(390,844); await navigate(next);
  await b.waitForCondition(next, `globalThis.__layerwellPrivateWebRuntime?.snapshot()==='occupied'`,30000,'bounded live-holder refusal');
  const occupied=await state(next); assert.equal(occupied.privateCalls,0); assert.equal(occupied.privateDatabaseCalls,0); assert.equal((await state(holder)).status,'admitted');
  await close(holder); assert.equal((await state(next)).status,'occupied');
  await b.clickByText(next,'Retry private app access'); receipt.interventions.push({case:'true contention',action:'explicit visible Retry private app access'});
  const recovered=await admitted(next); receipt.induced.push({case:'live second tab',occupied,recovered,manualRetries:1,pass:true}); holder=next;
  next=await page(390,844); await navigate(next);
  await b.waitForCondition(next, `globalThis.__layerwellPrivateWebRuntime?.snapshot()==='checking'`,30000,'pending before reload');
  await newDocument(next, () => next.send('Page.reload'));
  await b.waitForCondition(next, `globalThis.__layerwellPrivateWebRuntime?.snapshot()==='checking'`,30000,'successor pending');
  await close(holder); await admitted(next); await close(next);
  receipt.induced.push({case:'pending document reload termination',pass:true});
  for(const [name,setup] of [['unsupported',`Object.defineProperty(navigator,'locks',{configurable:true,value:undefined})`],
    ['denied',`Object.defineProperty(navigator,'locks',{configurable:true,value:{request:()=>Promise.reject(new DOMException('synthetic','SecurityError'))}})`]]) {
    const refused=await page(390,844,setup); await navigate(refused);
    await b.waitForCondition(refused, `globalThis.__layerwellPrivateWebRuntime?.snapshot()==='unavailable'`,30000,name);
    const result=await state(refused); assert.equal(result.privateCalls,0); assert.equal(result.privateDatabaseCalls,0); receipt.induced.push({case:name,result,pass:true}); await close(refused);
  }
  // Separate raw-storage boundary fixtures: no owner payload or live capability.
  const storagePage=await page(390,844); await navigate(storagePage); await admitted(storagePage);
  const storageBoundary=await evaluate(storagePage, `(async()=>{
    const entry=[...__r.getModules().values()].find(row=>(row.verboseName??'').replaceAll('\\\\','/').endsWith('/lib/storage/privateAsyncStorage.web.ts'));
    const raw=entry.publicModule.exports.default, name='layerwell.routine-decision-ciphertext.v1', key='layerwell.routineDecisionRecovery.v1';
    const legacyKeys=['layerwell.healthDataLifecycle.v1','layerwell.healthDataCollectionConsent.v1','layerwell.completions.v1','layerwell.shelf.v1','layerwell.skinprofile.v1','layerwell.conflict.overrides','layerwell.routineOrder.v1'];
    const legacySaved=legacyKeys.map(k=>localStorage.getItem(k)),listDatabases=indexedDB.databases,priorOpens=globalThis.__privateDatabaseCalls32;
    let legacyReadPreserved=false,legacyReadCreatedNoDatabase=false;
    try{
      // Isolated raw-port fixture for a legacy installation without the DB.
      indexedDB.databases=async()=>[];
      for(const k of legacyKeys)localStorage.setItem(k,'synthetic opaque legacy ciphertext');
      legacyReadPreserved=(await Promise.all(legacyKeys.map(k=>raw.getItem(k)))).every(value=>value==='synthetic opaque legacy ciphertext');
      legacyReadCreatedNoDatabase=globalThis.__privateDatabaseCalls32===priorOpens;
    }finally{indexedDB.databases=listDatabases;for(const [i,k] of legacyKeys.entries()){if(legacySaved[i]===null)localStorage.removeItem(k);else localStorage.setItem(k,legacySaved[i]);}}
    const original=IDBDatabase.prototype.transaction;let denied=false;
    IDBDatabase.prototype.transaction=function(store,mode,options){if(this.name===name&&mode==='readwrite')throw new DOMException('synthetic strict refusal','SecurityError');return Reflect.apply(original,this,[store,mode,options])};
    try{await raw.setItem(key,'synthetic opaque storage-port value');}catch{denied=true;}finally{IDBDatabase.prototype.transaction=original;}
    const unchanged=await raw.getItem(key)===null;
    await new Promise((resolve,reject)=>{const open=indexedDB.open(name,2);open.onerror=()=>reject(Error('fixture open'));open.onupgradeneeded=()=>open.result.createObjectStore('unsupported-fixture').put('synthetic','row');open.onsuccess=()=>{open.result.close();resolve()}});
    let futureRefused=false;try{await raw.getItem(key);}catch{futureRefused=true;}
    const version=(await indexedDB.databases()).find(row=>row.name===name)?.version;
    return {legacyReadPreserved,legacyReadCreatedNoDatabase,strictWriteDenied:denied,noCiphertextWritten:unchanged,futureRefused,versionPreserved:version===2};
  })()`);
  assert(Object.values(storageBoundary).every(Boolean)); receipt.induced.push({case:'raw storage denial and unsupported schema',storageBoundary,syntheticPortOnly:true,pass:true}); await close(storagePage);
} catch(error) { receipt.failures.push({message:String(error),stack:error.stack}); process.exitCode=1; }
finally { for(const client of clients) client.close(); await b.stopProcessBestEffort(browser); await b.stopProcessBestEffort(server); json('SUMMARY.json',receipt); }
assert.equal(receipt.failures.length,0);
