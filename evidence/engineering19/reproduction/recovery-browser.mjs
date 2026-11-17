import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import * as b from '../../scripts/e2e/cat04-catalog-recovery-audit.mjs';

const out = path.resolve('../ENGINEERING19_EVIDENCE/recovery-browser-v2');
mkdirSync(out, { recursive: false });
const appPort = await b.findAvailablePort(8490), debugPort = await b.findAvailablePort(9490);
const baseUrl = `http://localhost:${appPort}`;
const userDataDir = mkdtempSync(path.join(tmpdir(), 'onskin-e19-recovery-'));
let server, chrome, client;
const receipt = { surface: 'Actual Expo web; explicitly synthetic development refusal; no native proof', startedAt: new Date().toISOString(), viewports: [], pass: false };
const json = (name, value) => writeFileSync(path.join(out, name), JSON.stringify(value, null, 2));
async function capture(name) {
  const state = await b.evaluate(client, `({path:location.pathname,text:document.body.innerText,width:innerWidth,height:innerHeight,overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),focus:document.activeElement?.getAttribute('role')})`);
  assert.equal(state.overflow, 0);
  json(name+'.json', state);
  const shot = await client.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  writeFileSync(path.join(out, name+'.png'), Buffer.from(shot.data, 'base64'));
  return state;
}
try {
  server = b.startExpoServer({ appPort, evidenceDir: out, group: { id:'e19-provenance', env: {
    EXPO_PUBLIC_E2E_FIRST_SESSION_AUTH:'anonymous_owner', EXPO_PUBLIC_E2E_ENTITLEMENT:'store_pro',
    EXPO_PUBLIC_E2E_PROGRESS_STORAGE_FAILURE:'provenance',
  } } });
  chrome = spawn(b.findBrowserPath(), ['--headless=new', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${userDataDir}`,
    '--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-extensions','--disable-sync','about:blank'], { stdio:'ignore', windowsHide:true });
  await b.waitForUrl(baseUrl);
  client = await b.connectToPage(debugPort, baseUrl);
  for (const method of ['Page.enable','Runtime.enable','Network.enable','Log.enable']) await client.send(method);
  for (const [width,height] of [[375,667],[430,932]]) {
    const id = `${width}x${height}`;
    await b.setViewport(client,{width,height});
    await client.send('Page.navigate',{url:baseUrl+'/?e2eReset=local'});
    await b.waitForText(client,'Begin',60000); await b.clickByText(client,'Begin');
    await b.waitForPath(client,'/onboarding/age');
    await b.fillByLabel(client,'Day of birth','01'); await b.fillByLabel(client,'Month of birth','01'); await b.fillByLabel(client,'Year of birth','1990');
    await b.clickByText(client,'Continue'); await b.waitForPath(client,'/onboarding/consent');
    await b.clickByText(client,'I agree. Continue'); await b.waitForPath(client,'/onboarding/goals');
    await b.waitForText(client,'What brings you here?'); await delay(2500);
    await capture(id+'-explicit-consent-goals');
    await client.send('Page.navigate',{url:baseUrl+'/progress/capture'});
    await b.waitForText(client,'Recovery could not prove');
    const before = await capture(id+'-refusal');
    assert(!before.text.includes('Take photo'));
    assert(!before.text.includes('PHOTO_FILE_PROVENANCE_REQUIRED'));
    for (let retry=0;retry<2;retry++) {
      await b.scrollControlIntoView(client,'Try again');
      const control = await b.evaluate(client, `(()=>{const n=[...document.querySelectorAll('[role="button"],button')].find(n=>n.textContent.trim()==='Try again');n.focus();const r=n.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,focus:document.activeElement===n,hit:n.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}})()`);
      assert(control.focus && control.hit && control.h>=48 && control.y>=0 && control.y+control.h<=height);
      json(`${id}-retry-${retry}.json`,control);
      await client.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});
      await client.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
      await b.waitForText(client,'Recovery could not prove');
    }
    await capture(id+'-retry-controls');
    await client.send('Page.reload');
    await b.waitForText(client,'Recovery could not prove');
    await capture(id+'-reload-refusal');
    await b.clickByText(client,'Back to Progress');
    await b.waitForPath(client,'/progress');
    await b.waitForText(client,'Recovery could not prove');
    await capture(id+'-exit-progress');
    receipt.viewports.push({width,height,explicitAgeConsent:true,persistentRefusal:true,keyboardRetryTwice:true,focusHitTarget:true,overflow:0,reload:true,exit:true});
  }
  assert(!client.events.some(e=>e.method==='Runtime.exceptionThrown'));
  receipt.pass=true;
  console.log('PASS recovery refusal 375x667 and 430x932');
} catch (error) {
  receipt.error=error.message;
  if(client) await capture('FAILURE').catch(()=>{});
  throw error;
} finally {
  receipt.endedAt=new Date().toISOString();
  json('summary.json',receipt);
  if(client) json('network.json',client.events.filter(e=>e.method==='Network.requestWillBeSent').map(e=>({url:e.params.request.url.split('?')[0],method:e.params.request.method})));
  client?.close();
  await b.stopProcessBestEffort(chrome);
  await b.stopProcessBestEffort(server);
}
