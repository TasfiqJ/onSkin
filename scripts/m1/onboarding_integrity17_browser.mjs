// Existing Chrome CDP + Expo harness, no dependencies. Synthetic local fixture only.
// Keyboard viewport/text pressure is browser simulation, never native/VoiceOver proof.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const root = fileURLToPath(new URL('../../', import.meta.url));
if (!process.argv[2]) throw new Error('Supply an external empty evidence directory');
const evidence = path.resolve(process.argv[2]);
mkdirSync(evidence, { recursive: true });
if (readdirSync(evidence).length) throw new Error('Evidence directory must be new and empty');
const base = 'http://localhost:8297';
const browserPath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find(existsSync);
if (!browserPath) throw new Error('NOT_RUN: existing Chrome unavailable');
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('EXPO_PUBLIC_') && !/(TOKEN|SECRET|PASSWORD|PASSCODE|API[_-]?KEY|AUTHORIZATION|COOKIE|PRIVATE[_-]?KEY|DSN)(_|$)/i.test(k)));
Object.assign(env, { CI: '1', BROWSER: 'none', EXPO_NO_DOTENV: '1', EXPO_NO_TELEMETRY: '1', EXPO_PUBLIC_APP_ENV: 'development', EXPO_PUBLIC_E2E_APP_LOCK_ENABLED: 'false', EXPO_PUBLIC_E2E_FIRST_SESSION_AUTH: 'anonymous_owner', EXPO_PUBLIC_E2E_LOCAL_RESET: '1', EXPO_PUBLIC_SUPABASE_URL: 'https://blocked-supabase-url.invalid', EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '__BLOCKED_PLACEHOLDER__' });
const server = spawn(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', 'npm --workspace apps/mobile run web -- --port 8297 --host localhost'], { cwd: root, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
let serverLog = ''; for (const stream of [server.stdout, server.stderr]) stream.on('data', chunk => { serverLog += chunk; writeFileSync(path.join(evidence, 'expo.log'), serverLog); });
const json = (name, value) => writeFileSync(path.join(evidence, name + '.json'), JSON.stringify(value, null, 2) + '\n');
const assert = (ok, message) => { if (!ok) throw new Error(message); };
async function wait(fn, label, ms = 60000) { const until = Date.now() + ms; while (Date.now() < until) { try { if (await fn()) return; } catch {} await delay(150); } throw new Error('Timeout: ' + label); }
class CDP {
  constructor(url) {
    this.pending = new Map(); this.id = 0; this.logs = []; this.network = []; this.trace = []; this.ws = new WebSocket(url);
    this.ready = new Promise((resolve, reject) => { this.ws.addEventListener('open', resolve); this.ws.addEventListener('error', reject); });
    this.ws.addEventListener('message', event => {
      const m = JSON.parse(event.data);
      if (m.id) { const p = this.pending.get(m.id); this.pending.delete(m.id); if (m.error) p?.reject(new Error(m.error.message)); else p?.resolve(m.result); }
      if (m.method) this.trace.push({ method: m.method, at: Date.now() });
      if (m.method === 'Network.responseReceived') this.network.push({ response: true, status: m.params.response.status, origin: new URL(m.params.response.url).origin, path: new URL(m.params.response.url).pathname });
      if (m.method === 'Runtime.exceptionThrown') this.logs.push({ type: 'exception', text: m.params.exceptionDetails.text });
      if (m.method === 'Runtime.consoleAPICalled') this.logs.push({ type: m.params.type, text: m.params.args.map(a => a.value ?? a.description ?? '').join(' ').slice(0, 1000) });
      if (m.method === 'Network.requestWillBeSent') { const u = new URL(m.params.request.url); this.network.push({ origin: u.origin, path: u.pathname, method: m.params.request.method }); }
      if (m.method === 'Fetch.requestPaused') {
        const u = new URL(m.params.request.url);
        void this.send(['localhost', '127.0.0.1'].includes(u.hostname) ? 'Fetch.continueRequest' : 'Fetch.failRequest', { requestId: m.params.requestId, ...(!['localhost', '127.0.0.1'].includes(u.hostname) ? { errorReason: 'BlockedByClient' } : {}) });
      }
    });
  }
  async send(method, params = {}) { await this.ready; const id = ++this.id; return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject }); this.ws.send(JSON.stringify({ id, method, params })); }); }
  async eval(expression) { const r = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text); return r.result.value; }
}
let browser, c, prefix = 'starting';
const summary = [];
async function snap(name) {
  const state = await c.eval(`({path:location.pathname,text:location.pathname==='/onboarding/quiz'?'REDACTED_QUIZ_CONTENT':document.body.innerText,viewport:{width:innerWidth,height:innerHeight},overflow:document.documentElement.scrollWidth>innerWidth,controls:[...document.querySelectorAll('[role=button],input')].filter(n=>location.pathname!=='/onboarding/quiz'||['Next','Back','See my profile','Return to privacy','Start a new quiz'].includes(n.textContent)).map(n=>{const r=n.getBoundingClientRect();return {label:n.getAttribute('aria-label')||n.textContent,disabled:n.getAttribute('aria-disabled'),x:r.x,y:r.y,width:r.width,height:r.height}})})`);
  json(prefix + '-' + name, state);
  const shot = await c.send('Page.captureScreenshot', { format: 'png' }); writeFileSync(path.join(evidence, prefix + '-' + name + '.png'), Buffer.from(shot.data, 'base64'));
  return state;
}
async function text(value) { await wait(() => c.eval(`document.body.innerText.includes(${JSON.stringify(value)})`), value); }
async function route(value) { await wait(() => c.eval(`location.pathname===${JSON.stringify(value)}`), value); }
async function click(label, exact = true) {
  await wait(() => c.eval(`!![...document.querySelectorAll('[role=button],[role=radio],[role=checkbox],button,a')].find(n=>{if(n.getBoundingClientRect().width===0)return false;const s=(n.getAttribute('aria-label')||n.textContent||'').replace(/\\s+/g,' ').trim();return ${exact ? 's===' : 's.includes('}${JSON.stringify(label)}${exact ? '' : ')'}&&n.getAttribute('aria-disabled')!=='true'})`), 'click ' + label);
  const r = await c.eval(`(()=>{const n=[...document.querySelectorAll('[role=button],[role=radio],[role=checkbox],button,a')].find(n=>{if(n.getBoundingClientRect().width===0)return false;const s=(n.getAttribute('aria-label')||n.textContent||'').replace(/\\s+/g,' ').trim();return ${exact ? 's===' : 's.includes('}${JSON.stringify(label)}${exact ? '' : ')'}});n.scrollIntoView({block:'center'});const r=n.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await c.send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...r }); await c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...r }); await delay(200);
}
async function fill(label, value) {
  await c.eval(`(()=>{const n=[...document.querySelectorAll('input')].find(n=>n.getAttribute('aria-label')===${JSON.stringify(label)}&&n.getBoundingClientRect().width>0);if(!n)throw Error('missing input');n.scrollIntoView({block:'center'});n.focus();const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(n,'');n.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await c.send('Input.insertText', { text: value }); await delay(150);
}
async function metrics(width, height) { await c.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: true }); await delay(350); }
async function stop(child) {
  if (!child?.pid || child.exitCode !== null) return;
  const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
  await new Promise(resolve => killer.on('exit', resolve));
}
async function pressure(scale) {
  await c.eval(`(()=>{
    globalThis.__textPressure17?.disconnect();
    const bases=new WeakMap();
    const apply=()=>{for(const n of document.querySelectorAll('*')){
      if(['SCRIPT','STYLE','META','LINK'].includes(n.tagName))continue;
      if(![...n.childNodes].some(v=>v.nodeType===3&&v.textContent.trim())&&n.tagName!=='INPUT')continue;
      if(!bases.has(n)){const s=getComputedStyle(n);const font=parseFloat(s.fontSize);bases.set(n,{font,line:parseFloat(s.lineHeight)||font*1.5});}
      const b=bases.get(n);n.style.fontSize=b.font*${scale}+'px';n.style.lineHeight=b.line*${scale}+'px';
    }};
    const observer=new MutationObserver(apply);observer.observe(document.body,{childList:true,subtree:true});
    globalThis.__textPressure17=observer;apply();
  })()`);
  await delay(250);
}
async function modulePort(exportName) {
  const found = await c.eval(`(()=>{
    const mods=globalThis.__r?.getModules?.();if(!mods)throw Error('Metro module inventory unavailable');
    const candidates=[...mods.values()].filter(m=>m.isInitialized&&m.publicModule?.exports&&Object.prototype.hasOwnProperty.call(m.publicModule.exports,${JSON.stringify(exportName)}));
    if(candidates.length!==1)throw Error('Ambiguous initialized port: '+candidates.length);
    globalThis.__port17=candidates[0].publicModule.exports;
    return Object.getOwnPropertyDescriptor(__port17,${JSON.stringify(exportName)}).configurable;
  })()`);
  assert(found, 'Port is not safely instrumentable: ' + exportName);
}
async function holdConsent() {
  await modulePort('hasCurrentHealthDataCollectionConsent');
  await c.eval(`(()=>{
    const p=__port17;const original=p.hasCurrentHealthDataCollectionConsent;let release;
    globalThis.__held17={started:0,release:()=>release?.(),restore:()=>{p.hasCurrentHealthDataCollectionConsent=original}};
    p.hasCurrentHealthDataCollectionConsent=async()=>{__held17.started++;await new Promise(done=>release=done);return original();};
  })()`);
}
async function geometry(name) {
  const value = await c.eval(`(()=>{
    const controls=[...document.querySelectorAll('[role=button]')].filter(n=>n.getBoundingClientRect().width>0&&n.closest('[aria-hidden=true]')===null).map(n=>{
      const r=n.getBoundingClientRect(),label=(n.getAttribute('aria-label')||n.textContent||'').replace(/\\s+/g,' ').trim();
      const walker=document.createTreeWalker(n,NodeFilter.SHOW_TEXT);const lines=[];let t;
      while(t=walker.nextNode()){if(!t.textContent.trim())continue;const range=document.createRange();range.selectNodeContents(t);for(const b of range.getClientRects())lines.push({x:b.x,y:b.y,width:b.width,height:b.height});}
      const x=Math.min(innerWidth-1,Math.max(0,r.x+r.width/2)),y=Math.min(innerHeight-1,Math.max(0,r.y+r.height/2));
      return {label,x:r.x,y:r.y,width:r.width,height:r.height,lines,centerHit:n.contains(document.elementFromPoint(x,y)),fullyVisible:r.x>=0&&r.y>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1};
    });return {viewport:{width:innerWidth,height:innerHeight},activeInput:document.activeElement?.getAttribute('aria-label'),overflow:document.documentElement.scrollWidth-innerWidth,controls};
  })()`);
  json(prefix+'-'+name+'-geometry', value); return value;
}
async function onboarding() {
  // Each scenario owns a fresh synthetic local profile. Clear only this test
  // origin after the prior document has closed, never real account storage.
  await c.send('Page.navigate', { url: 'about:blank' }); await delay(100);
  await c.send('Storage.clearDataForOrigin', { origin: base, storageTypes: 'all' });
  await c.send('Page.navigate', { url: base + '/?e2eReset=local' }); await text('Begin');
  await c.send('Page.navigate', { url: base + '/onboarding/quiz' }); await text('First, your'); await snap('direct-quiz-age-fenced');
  await fill('Day of birth','01');await fill('Month of birth','01');await fill('Year of birth','1990');await click('Continue');
  await text('Before the quiz');await click('I agree. Continue');await text('What brings you here?');
}
async function answerQuiz() {
  // Fixed synthetic choices are used only for UI interaction, never logged as health data.
  const choices=['Shiny in places','Rarely','Often stings, burns, or reddens','Frequently','Yes, noticeably','Weeks or longer','Fine lines or firmness changes are visible','A lot over time','Sometimes burns','Tone 4','None that I know of','No'];
  for(const [i,choice]of choices.entries()){await text(choice);await click(choice);await click(i===11?'See my profile':'Next');}
  await route('/onboarding/products');await text("What's on your shelf?");
}
async function addManual(number) {
  await fill('Product name','Synthetic manual product '+number+' with a long readable label');
  await click('Add to shelf');await route('/shelf/opened');await click('Just opened it',false);await click('Add to shelf');
  await route('/onboarding/products');await text(number+' ON YOUR SHELF');
}
async function pendingRemoval() {
  await modulePort('useShelf');
  await c.eval(`(()=>{const p=__port17,original=p.useShelf;let release;
    __refetch17={started:0,release:()=>release?.(),restore:()=>p.useShelf=original};
    p.useShelf=()=>{const result=original();return {...result,refetch:async()=>{__refetch17.started++;await new Promise(done=>release=done);return result.refetch()}}};
    const write=Storage.prototype.setItem;__refetch17.restoreWrite=()=>Storage.prototype.setItem=write;
    Storage.prototype.setItem=function(k,v){if(k==='layerwell.shelf.v1')throw Error('SYNTHETIC17_REMOVE_WRITE_REFUSED');return write.call(this,k,v)};
  })()`);
  await fill('Product name','Synthetic unsaved product');
  await click('Remove Synthetic manual product 1 with a long readable label');
  await wait(()=>c.eval('__refetch17.started>0'),'pending real refetch');
  await snap('pending-delete-refetch');
  assert(await c.eval("[...document.querySelectorAll('[role=button]')].filter(n=>n.getBoundingClientRect().width>0&&n.textContent.includes('Continue with 1 product')).every(n=>n.getAttribute('aria-disabled')==='true')"),'Pending refetch exposed continuation');
  await c.eval('__refetch17.restoreWrite();__refetch17.restore();__refetch17.release()');
  await wait(()=>c.eval("[...document.querySelectorAll('[role=button]')].some(n=>n.getBoundingClientRect().width>0&&n.textContent.includes('Continue with 1 product')&&n.getAttribute('aria-disabled')!=='true')"),'removal recovery');
}
async function runFlows() {
  for(const [width,height]of [[360,640],[375,667],[390,844],[430,932]]) {
    prefix=width+'x'+height;console.log('Browser flow '+prefix);await metrics(width,height);
    await onboarding();await click('Clear skin',false);await click('Continue');await answerQuiz();await snap('products-empty');
    await holdConsent();await c.eval('history.back()');await route('/onboarding/quiz');await text('Checking your privacy choice');
    assert(await c.eval('__held17.started>0'), 'Held real consent read did not start');await snap('quiz-pending-return');
    assert(await c.eval("!document.body.innerText.includes('See my profile')"),'Pending quiz exposed answer/navigation');
    await c.eval('__held17.restore();__held17.release()');await text('See my profile');await snap('quiz-approved-mounted-return');
    await click('See my profile');await route('/onboarding/products');
    const maxCount=width===390?6:3;
    for(let count=0;count<=maxCount;count++) {
      if(count>0)await addManual(count);
      await fill('Product name','Synthetic unsaved product');
      const continuation=width===430&&count>=3?'Continue':count?'Continue with '+count+' '+(count===1?'product':'products'):'Skip for now';
      if(width===360&&count===0)await pressure(2);
      await snap('products-'+count+'-typed');await geometry('products-'+count+'-typed');
      if(width===360&&count===0){
        await fill('Product name','Synthetic unsaved product');await metrics(width,380);await fill('Product name','Synthetic unsaved product');await snap('keyboard-open-simulated-text200');await geometry('keyboard-open-simulated-text200');await metrics(width,height);
        await click('Choose product category');await text('Product category');await snap('category-text200');await click('Moisturiser');
      }
      if(count>0){await metrics(width,Math.max(380,height-260));await fill('Product name','Synthetic unsaved product');await snap('keyboard-'+count+'-simulated');await geometry('keyboard-'+count+'-simulated');await metrics(width,height);}
      if(width===390&&count===1)await pendingRemoval();
      await click(continuation);await text('not been added');await snap('unsaved-'+count);await geometry('unsaved-'+count);
      await click('Keep editing');assert(await c.eval("[...document.querySelectorAll('input')].find(n=>n.getAttribute('aria-label')==='Product name'&&n.getBoundingClientRect().width>0).value.includes('Synthetic unsaved')"),'Keep editing lost draft');
    }
    const continuation=width===430?'Continue':'Continue with '+maxCount+' products';
    await click(continuation);await click('Continue without adding it');await route('/onboarding/reveal');await click('Continue');await route('/onboarding/notifications');
    await snap('reminder-start');
    await c.eval(`(()=>{const original=Storage.prototype.setItem;globalThis.__restore17=()=>Storage.prototype.setItem=original;Storage.prototype.setItem=function(k,v){if(k==='layerwell.notifPrefs.v1')throw Error('SYNTHETIC17_WRITE_REFUSED');return original.call(this,k,v)}})()`);
    await click('Not now');await text('could not save');await snap('reminder-storage-failure');await c.eval('__restore17()');
    await click('Check current choice and retry');await text('Reminders are off');await snap('reminder-current-intent-retry');await geometry('reminder-current-intent-retry');
    await click('Continue');await route('/onboarding/account');await snap('account');
    summary.push({viewport:{width,height},result:'PASS',productsCounts:Array.from({length:maxCount+1},(_,i)=>i),focusPendingAndApproved:true,storageFailureRetry:true,native:'NOT_RUN'});
  }
  // Real current-consent storage is withdrawn while a mounted refocus is pending.
  prefix='withdrawal';await metrics(390,844);await onboarding();await click('Clear skin',false);await click('Continue');await answerQuiz();
  await holdConsent();await c.eval('history.back()');await text('Checking your privacy choice');await snap('pending');
  await modulePort('clearHealthDataCollectionConsentLocal');await c.eval('__port17.clearHealthDataCollectionConsentLocal()');
  await c.eval('__held17.restore();__held17.release()');await route('/onboarding/consent');await snap('denied-private-route');
  // Missing-goals direct entry keeps a typed unsaved draft until explicit acknowledgement.
  prefix='direct-products';await onboarding();
  await c.send('Page.navigate',{url:base+'/onboarding/products'});await route('/onboarding/products');await text("What's on your shelf?");
  await fill('Product name','Synthetic unsaved direct-entry draft');await click('Skip for now');await text('not been added');await snap('unsaved-before-goals');
  assert(await c.eval("location.pathname==='/onboarding/products'"),'Missing goals silently discarded draft');
  await click('Keep editing');await click('Skip for now');await click('Continue without adding it');await route('/onboarding/goals');await snap('acknowledged-goals-guard');
  json('summary',{status:'PASS',flows:summary,source:'actual Expo web development build',consentDelay:'synthetic wait around actual canonical store read; no approval fabrication',withdrawal:'actual local consent clear API in synthetic profile',textPressure:'persistent DOM glyph size and line-height x2; browser simulation',keyboard:'focused input plus reduced viewport; native keyboard NOT_RUN',evidenceClasses:{screenshots:'actual PNG pixels',browser:'actual app with disclosed synthetic ports',react:'separate mocked component tests',export:'source-only bundles',physicalDevice:'NOT_RUN'},native:'NOT_RUN',permissions:'NO_REAL_OS_REQUEST'});
}
try {
  await wait(async () => (await fetch(base)).ok, 'Expo server', 180000);
  const profile = path.join(evidence, 'task-owned-browser-profile'); mkdirSync(profile);
  browser = spawn(browserPath, ['--headless=new', '--remote-debugging-port=9397', '--user-data-dir=' + profile, '--disable-background-networking', '--disable-sync', '--no-first-run', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let targets; await wait(async () => { targets = await (await fetch('http://127.0.0.1:9397/json')).json(); return targets.some(t => t.type === 'page'); }, 'Chrome');
  c = new CDP(targets.find(t => t.type === 'page').webSocketDebuggerUrl); await c.ready;
  for (const method of ['Page.enable', 'Runtime.enable', 'Network.enable']) await c.send(method);
  await c.send('Page.addScriptToEvaluateOnNewDocument', { source: `globalThis.__permission17={blocked:0};if(globalThis.Notification)Object.defineProperty(Notification,'requestPermission',{configurable:true,value:()=>{__permission17.blocked++;return Promise.reject(Error('SYNTHETIC17_REAL_PERMISSION_FORBIDDEN'))}});` });
  await c.send('Fetch.enable', { patterns: [{ urlPattern: 'http*' }] });
  await c.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await runFlows();
} catch (error) {
  if (c) await snap('FAILURE').catch(() => {});
  json('ERROR', { status: 'FAIL', message: error.message, completed: summary }); process.exitCode = 1;
} finally {
  if (c) { json('console', c.logs); json('network', c.network); json('trace',c.trace); c.ws.close(); }
  await stop(browser); await stop(server);
}
