import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import * as b from '../c16-candidate/scripts/e2e/cat04-catalog-recovery-audit.mjs';
const out=path.resolve(process.env.ONSKIN_DIAGNOSTIC32_EVIDENCE);mkdirSync(out);
const appPort=8500,debugPort=9500,origin=`http://localhost:${appPort}`;
let server,browser,client;
try{
 server=b.startExpoServer({appPort,evidenceDir:out,group:{id:'failed-source32',env:{EXPO_PUBLIC_E2E_FIRST_SESSION_AUTH:'anonymous_owner',EXPO_PUBLIC_NATIVE_CAMERA_ENABLED:'false'}}});await b.waitForUrl(origin);
 browser=spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',['--headless=new',`--remote-debugging-port=${debugPort}`,`--user-data-dir=${process.env.ONSKIN_DIAGNOSTIC32_PROFILE}`,'--no-first-run','--disable-background-networking','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1','about:blank'],{stdio:'ignore',windowsHide:true});
 client=await b.connectToPage(debugPort,origin);await client.send('Runtime.enable');await client.send('Page.enable');await client.send('Page.navigate',{url:origin+'/routine/records'});await b.waitForText(client,'My actual routine',60000);
 const result=await b.evaluate(client,`(async()=>{
 const mod=suffix=>[...__r.getModules().values()].find(m=>(m.verboseName??'').replaceAll('\\\\','/').endsWith(suffix))?.publicModule.exports;
 const raw=mod('/lib/storage/privateAsyncStorage.web.ts').default,kv=mod('/lib/storage/privateKV.ts');
 const keys=['layerwell.shelf.v1','layerwell.skinprofile.v1','layerwell.conflict.overrides','layerwell.routineOrder.v1','layerwell.healthDataCollectionConsent.v1'];
 const rows=[];for(const key of keys){const value=await raw.getItem(key);let readable=true,decryptedPresent=false;try{decryptedPresent=(await kv.getPrivateItem(key))!==null}catch{readable=false}rows.push({key,present:value!==null,readable,decryptedPresent})}
 const profile=await mod('/features/onboarding/skinProfileStore.ts').readStoredSkinProfile();
 const lease=mod('/lib/consent/healthDataWriteAdmission.ts').captureHealthDataWriteLease();let sourceError=null,source=null;
 try{source=await mod('/features/routine/planSourceFence44.ts').capturePlanSource44(lease)}catch(error){sourceError=/^[A-Z0-9_]+$/.test(error.message)?error.message:'unclassified'}
 return {rows,profileStatus:profile.status,sourceAvailable:source!==null,sourceError};})()`,true);
 writeFileSync(path.join(out,'SUMMARY.json'),JSON.stringify(result,null,2)+'\n');assert(result.sourceAvailable===false);
}finally{client?.close();await b.stopProcessBestEffort(browser);await b.stopProcessBestEffort(server)}
