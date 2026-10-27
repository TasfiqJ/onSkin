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
const base = 'http://localhost:8300';
const browserPath = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
].find(existsSync);
if (!browserPath) throw new Error('NOT_RUN: existing Chrome unavailable');
const env = Object.fromEntries(
  Object.entries(process.env).filter(
    ([k]) =>
      !k.startsWith('EXPO_PUBLIC_') &&
      !/(TOKEN|SECRET|PASSWORD|PASSCODE|API[_-]?KEY|AUTHORIZATION|COOKIE|PRIVATE[_-]?KEY|DSN)(_|$)/i.test(
        k,
      ),
  ),
);
Object.assign(env, {
  CI: '1',
  BROWSER: 'none',
  EXPO_NO_DOTENV: '1',
  EXPO_NO_TELEMETRY: '1',
  EXPO_PUBLIC_APP_ENV: 'development',
  EXPO_PUBLIC_E2E_APP_LOCK_ENABLED: 'false',
  EXPO_PUBLIC_E2E_FIRST_SESSION_AUTH: 'anonymous_owner',
  EXPO_PUBLIC_E2E_LOCAL_RESET: '1',
  EXPO_PUBLIC_E2E_ENTITLEMENT: 'store_pro',
  EXPO_PUBLIC_E2E_PROGRESS_PHOTOS: 'populated',
  EXPO_PUBLIC_E2E_PROGRESS_STORAGE_FAILURE: 'unavailable_once',
  EXPO_PUBLIC_SUPABASE_URL: 'https://blocked-supabase-url.invalid',
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '__BLOCKED_PLACEHOLDER__',
});
const server = spawn(
  process.env.ComSpec ?? 'cmd.exe',
  ['/d', '/s', '/c', 'npm --workspace apps/mobile run web -- --port 8300 --host localhost'],
  { cwd: root, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
);
let serverLog = '';
for (const stream of [server.stdout, server.stderr])
  stream.on('data', (chunk) => {
    serverLog += chunk;
    writeFileSync(path.join(evidence, 'expo.log'), serverLog);
  });
const json = (name, value) =>
  writeFileSync(path.join(evidence, name + '.json'), JSON.stringify(value, null, 2) + '\n');
const assert = (ok, message) => {
  if (!ok) throw new Error(message);
};
async function wait(fn, label, ms = 60000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    try {
      if (await fn()) return;
    } catch {}
    await delay(150);
  }
  throw new Error('Timeout: ' + label);
}
class CDP {
  constructor(url) {
    this.pending = new Map();
    this.id = 0;
    this.logs = [];
    this.network = [];
    this.trace = [];
    this.ws = new WebSocket(url);
    this.ready = new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve);
      this.ws.addEventListener('error', reject);
    });
    this.ws.addEventListener('message', (event) => {
      const m = JSON.parse(event.data);
      if (m.id) {
        const p = this.pending.get(m.id);
        this.pending.delete(m.id);
        if (m.error) p?.reject(new Error(m.error.message));
        else p?.resolve(m.result);
      }
      if (m.method) this.trace.push({ method: m.method, at: Date.now() });
      if (m.method === 'Network.responseReceived')
        this.network.push({
          response: true,
          status: m.params.response.status,
          origin: new URL(m.params.response.url).origin,
          path: new URL(m.params.response.url).pathname,
        });
      if (m.method === 'Runtime.exceptionThrown')
        this.logs.push({ type: 'exception', text: m.params.exceptionDetails.text });
      if (m.method === 'Runtime.consoleAPICalled')
        this.logs.push({
          type: m.params.type,
          text: m.params.args
            .map((a) => a.value ?? a.description ?? '')
            .join(' ')
            .slice(0, 1000),
        });
      if (m.method === 'Network.requestWillBeSent') {
        const u = new URL(m.params.request.url);
        this.network.push({ origin: u.origin, path: u.pathname, method: m.params.request.method });
      }
      if (m.method === 'Fetch.requestPaused') {
        const u = new URL(m.params.request.url);
        void this.send(
          ['localhost', '127.0.0.1'].includes(u.hostname)
            ? 'Fetch.continueRequest'
            : 'Fetch.failRequest',
          {
            requestId: m.params.requestId,
            ...(!['localhost', '127.0.0.1'].includes(u.hostname)
              ? { errorReason: 'BlockedByClient' }
              : {}),
          },
        );
      }
    });
  }
  async send(method, params = {}) {
    await this.ready;
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async eval(expression) {
    const r = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
    return r.result.value;
  }
}
let browser,
  c,
  prefix = 'starting';
const summary = [];
const steps = [];
async function snap(name) {
  const state = await c.eval(
    `({path:location.pathname,text:location.pathname==='/onboarding/quiz'?'REDACTED_QUIZ_CONTENT':document.body.innerText,viewport:{width:innerWidth,height:innerHeight},overflow:document.documentElement.scrollWidth>innerWidth,controls:[...document.querySelectorAll('[role=button],input')].filter(n=>location.pathname!=='/onboarding/quiz'||['Next','Back','See my profile','Return to privacy','Start a new quiz'].includes(n.textContent)).map(n=>{const r=n.getBoundingClientRect();return {label:n.getAttribute('aria-label')||n.textContent,disabled:n.getAttribute('aria-disabled'),x:r.x,y:r.y,width:r.width,height:r.height}})})`,
  );
  json(prefix + '-' + name, state);
  const shot = await c.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
  });
  writeFileSync(
    path.join(evidence, prefix + '-' + name + '.png'),
    Buffer.from(shot.data, 'base64'),
  );
  return state;
}
async function text(value) {
  await wait(() => c.eval(`document.body.innerText.includes(${JSON.stringify(value)})`), value);
}
async function route(value) {
  await wait(() => c.eval(`location.pathname===${JSON.stringify(value)}`), value);
}
async function click(label, exact = true) {
  steps.push({
    action: 'click',
    label: (await c.eval("location.pathname==='/onboarding/quiz'"))
      ? 'synthetic quiz choice or navigation'
      : label,
    at: Date.now(),
  });
  await wait(
    () =>
      c.eval(
        `!![...document.querySelectorAll('[role=button],[role=radio],[role=checkbox],button,a')].find(n=>{if(n.getBoundingClientRect().width===0)return false;const s=(n.getAttribute('aria-label')||n.textContent||'').replace(/\\s+/g,' ').trim();return ${exact ? 's===' : 's.includes('}${JSON.stringify(label)}${exact ? '' : ')'}&&n.getAttribute('aria-disabled')!=='true'})`,
      ),
    'click ' + label,
  );
  const r = await c.eval(
    `(()=>{const n=[...document.querySelectorAll('[role=button],[role=radio],[role=checkbox],button,a')].find(n=>{if(n.getBoundingClientRect().width===0)return false;const s=(n.getAttribute('aria-label')||n.textContent||'').replace(/\\s+/g,' ').trim();return ${exact ? 's===' : 's.includes('}${JSON.stringify(label)}${exact ? '' : ')'}});n.scrollIntoView({block:'center'});const r=n.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`,
  );
  await c.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    button: 'left',
    clickCount: 1,
    ...r,
  });
  await c.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    button: 'left',
    clickCount: 1,
    ...r,
  });
  await delay(200);
}
async function fill(label, value) {
  await c.eval(
    `(()=>{const n=[...document.querySelectorAll('input')].find(n=>n.getAttribute('aria-label')===${JSON.stringify(label)}&&n.getBoundingClientRect().width>0);if(!n)throw Error('missing input');n.scrollIntoView({block:'center'});n.focus();const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(n,'');n.dispatchEvent(new Event('input',{bubbles:true}));})()`,
  );
  await c.send('Input.insertText', { text: value });
  await delay(150);
}
async function metrics(width, height) {
  await c.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await delay(350);
}
async function stop(child) {
  if (!child?.pid || child.exitCode !== null) return;
  const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
    windowsHide: true,
    stdio: 'ignore',
  });
  await new Promise((resolve) => killer.on('exit', resolve));
}
async function pressure(scale) {
  await c.eval(`(()=>{
    globalThis.__textPressure20?.disconnect();
    const bases=new WeakMap();
    const apply=()=>{for(const n of document.querySelectorAll('*')){
      if(['SCRIPT','STYLE','META','LINK'].includes(n.tagName))continue;
      if(![...n.childNodes].some(v=>v.nodeType===3&&v.textContent.trim())&&n.tagName!=='INPUT')continue;
      if(!bases.has(n)){const s=getComputedStyle(n);const font=parseFloat(s.fontSize);bases.set(n,{font,line:parseFloat(s.lineHeight)||font*1.5});}
      const b=bases.get(n);n.style.fontSize=b.font*${scale}+'px';n.style.lineHeight=b.line*${scale}+'px';
    }};
    const observer=new MutationObserver(apply);observer.observe(document.body,{childList:true,subtree:true});
    globalThis.__textPressure20=observer;apply();
  })()`);
  await delay(250);
}
async function modulePort(exportName) {
  const found = await c.eval(`(()=>{
    const mods=globalThis.__r?.getModules?.();if(!mods)throw Error('Metro module inventory unavailable');
    const candidates=[...mods.values()].filter(m=>m.isInitialized&&m.publicModule?.exports&&Object.prototype.hasOwnProperty.call(m.publicModule.exports,${JSON.stringify(exportName)}));
    if(candidates.length!==1)throw Error('Ambiguous initialized port: '+candidates.length);
    globalThis.__port20=candidates[0].publicModule.exports;
    return Object.getOwnPropertyDescriptor(__port20,${JSON.stringify(exportName)}).configurable;
  })()`);
  assert(found, 'Port is not safely instrumentable: ' + exportName);
}

async function geometry(name) {
  const value = await c.eval(`(()=>{
    const modal=document.querySelector('[aria-label="Cancel photo selection"]')?.parentElement;
    const controls=[...(modal||document).querySelectorAll('[role=button]')].filter(n=>n.getBoundingClientRect().width>0&&!n.closest('[aria-hidden=true]')).map(n=>{
      const r=n.getBoundingClientRect();const lines=[];const walker=document.createTreeWalker(n,NodeFilter.SHOW_TEXT);let t;
      while(t=walker.nextNode()){if(!t.textContent.trim())continue;const range=document.createRange();range.selectNodeContents(t);for(const b of range.getClientRects())lines.push({x:b.x,y:b.y,right:b.right,bottom:b.bottom,width:b.width,height:b.height})}
      const fullyVisible=r.x>=0&&r.y>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight-(modal?0:94);
      return {label:n.getAttribute('aria-label')||n.textContent,disabled:n.getAttribute('aria-disabled'),x:r.x,y:r.y,width:r.width,height:r.height,lines,fullyVisible,centerHit:n.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)),glyphFits:lines.every(b=>b.x>=r.x-1&&b.right<=r.right+1&&b.y>=r.y-1&&b.bottom<=r.bottom+1)};
    });return {viewport:{width:innerWidth,height:innerHeight},active:document.activeElement?.getAttribute('aria-label'),overflow:document.documentElement.scrollWidth>innerWidth,controls};
  })()`);
  json(prefix + '-' + name + '-geometry', value);
  assert(!value.overflow, 'Horizontal document overflow at ' + name);
  for (const control of value.controls.filter(
    (n) => n.fullyVisible && n.disabled !== 'true' && n.label !== 'Dismiss photo picker',
  )) {
    assert(control.width >= 47.5 && control.height >= 47.5, 'Small touch target: ' + control.label);
    assert(control.glyphFits, 'Clipped glyphs in control: ' + control.label);
    assert(control.centerHit, 'Obstructed target: ' + control.label);
  }
  return value;
}
async function focusKey(label) {
  await c.send('Page.bringToFront');
  await c.send('Emulation.setFocusEmulationEnabled', { enabled: true });
  await c.eval(
    `globalThis.__key20=[];for(const name of ['keydown','keyup','click'])document.addEventListener(name,e=>__key20.push({type:e.type,key:e.key,label:e.target.getAttribute?.('aria-label')}),{once:true,capture:true})`,
  );
  await c.eval(
    `(()=>{const n=[...document.querySelectorAll('[role=button]')].find(n=>n.getAttribute('aria-label')===${JSON.stringify(label)}&&n.getBoundingClientRect().width>0);if(!n)throw Error('Missing keyboard control');n.scrollIntoView({block:'center'});n.focus()})()`,
  );
  for (const type of ['keyDown', 'keyUp'])
    await c.send('Input.dispatchKeyEvent', {
      type,
      key: 'Enter',
      code: 'Enter',
      windowsVirtualKeyCode: 13,
      nativeVirtualKeyCode: 13,
      ...(type === 'keyDown' ? { text: '\r', unmodifiedText: '\r' } : {}),
    });
  await delay(250);
  json(
    prefix + '-keyboard-' + Date.now(),
    await c.eval(
      `({events:__key20,active:document.activeElement?.getAttribute('aria-label'),picker:!!document.querySelector('[aria-label="Cancel photo selection"]')})`,
    ),
  );
}
async function navigateProgress() {
  await c.send('Page.navigate', { url: base + '/progress' });
  await text('Your timeline could not open.');
  await snap('storage-unavailable');
  await click('Try again');
  await text('Switch to swipe');
}
async function runtimeClient() {
  await c.eval(
    `(()=>{const root=document.getElementById('root');const key=Object.keys(root).find(k=>k.startsWith('__reactContainer'));const queue=[root[key]?.current||root[key]],seen=new Set();while(queue.length){const f=queue.pop();if(!f||seen.has(f))continue;seen.add(f);queue.push(f.child,f.sibling);if(f.memoizedProps?.client?.getQueryCache){globalThis.__client20=f.memoizedProps.client;return}}throw Error('Actual query client unavailable')})()`,
  );
}
async function retainPicker() {
  await c.eval(
    `(()=>{const root=document.getElementById('root');const key=Object.keys(root).find(k=>k.startsWith('__reactContainer'));const queue=[root[key]?.current||root[key]],seen=new Set();while(queue.length){const f=queue.pop();if(!f||seen.has(f))continue;seen.add(f);queue.push(f.child,f.sibling);if(f.type?.name==='PairPicker'&&f.memoizedProps?.onSelect){globalThis.__oldChoice20=f.memoizedProps.onSelect;return}}throw Error('Mounted picker callback unavailable')})()`,
  );
}

async function syntheticCases() {
  await runtimeClient();
  for (const count of [0, 1, 2, 20]) {
    await c.eval(
      `(()=>{const q=__client20.getQueryCache().findAll({queryKey:['photos']}).find(q=>q.state.status==='success'&&q.state.data?.series);const d=q.state.data,base=d.series[0]||globalThis.__record20;if(base)globalThis.__record20=base;const series=Array.from({length:${count}},(_,i)=>({...__record20,id:'e2e-c20-'+i,takenLocalDate:'2026-06-24',takenAt:'2026-06-24T12:00:00Z',isReference:i===0,referencePhotoId:i? 'e2e-c20-0':null}));__client20.setQueryData(q.queryKey,{...d,series,all:series,count:series.length,metadata:{weeks:series.length?1:0,count:series.length,text:'Synthetic source: '+series.length+' current photos'},comparePair:series.length>1?{before:series[0],after:series[series.length-1]}:null,reference:series[0]||null,monthGroups:series.length?[{key:'2026-06',label:'June 2026',photos:series}]:[],milestones:[]})})()`,
    );
    await text(
      count === 0 ? 'Take my first photo' : count === 1 ? 'Take another' : 'Switch to swipe',
    );
    await snap('synthetic-count-' + count);
    if (count === 20) {
      await text('capture order is not known');
      await click('Change first photo (currently Jun 24, 2026)');
      await snap('twenty-same-day-picker');
      for (let i = 0; i < 12; i++) {
        if (
          await c.eval(
            `!![...document.querySelectorAll('[role=button]')].find(n=>n.getAttribute('aria-label')?.endsWith('capture 10 of 20'))`,
          )
        )
          break;
        const at = await c.eval(
          `(()=>{const n=document.getElementById('progress-comparison-picker-list'),r=n.getBoundingClientRect();return {x:r.x+r.width/2,y:Math.min(innerHeight-80,r.y+r.height/2)}})()`,
        );
        await c.send('Input.dispatchMouseEvent', {
          type: 'mouseWheel',
          deltaX: 0,
          deltaY: 220,
          ...at,
        });
        await delay(180);
      }
      const label = await c.eval(
        `document.querySelector('[aria-label$="capture 10 of 20"]')?.getAttribute('aria-label')`,
      );
      assert(label, '20-record picker did not expose capture 10');
      await click(label);
      await snap('twenty-same-day-alternate');
    }
  }
  // Synthetic unreadable and absent bytes are separate from the current metadata record.
  for (const kind of ['unreadable', 'missing']) {
    await c.eval(
      `(()=>{const q=__client20.getQueryCache().findAll({queryKey:['photos']}).find(q=>q.state.status==='success'&&q.state.data?.series?.length===20);const d=q.state.data,series=[{...d.series[0],localUri:${'kind' === 'never' ? 'null' : "'REPLACE_URI'"}},...d.series.slice(1)];__client20.setQueryData(q.queryKey,{...d,series,all:series})})()`.replace(
        "'REPLACE_URI'",
        kind === 'unreadable' ? "'data:image/png;base64,broken-synthetic-bytes'" : 'null',
      ),
    );
    await text(kind === 'unreadable' ? 'Cannot read photo.' : 'No image bytes.');
    await snap('synthetic-bytes-' + kind);
  }
  await c.eval(`__client20.invalidateQueries({queryKey:['photos']})`);
  await text('Switch to swipe');
}
async function dragDivider() {
  await c.send('Page.bringToFront');
  await c.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
  const before = await c.eval(
    `(()=>{const n=document.querySelector('[aria-valuenow]');n.scrollIntoView({block:'center'});const r=n.getBoundingClientRect();return {value:Number(n.getAttribute('aria-valuenow')),x:r.x+r.width/2,y:r.y+r.height/2,hit:n.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}})()`,
  );
  assert(before.hit, 'Image divider is obstructed');
  json(
    'debug-slider',
    await c.eval(
      `(()=>{const root=document.getElementById('root'),key=Object.keys(root).find(k=>k.startsWith('__reactContainer')),q=[root[key]?.current||root[key]],seen=new Set();while(q.length){const f=q.pop();if(!f||seen.has(f))continue;seen.add(f);q.push(f.child,f.sibling);if(f.type?.name==='CompareSlider'){let h=f.memoizedState;const states=[];while(h){const v=h.memoizedState;states.push(typeof v==='number'?v:v&&typeof v==='object'&&'value' in v?{value:v.value}:null);h=h.next}return {states,source:String(f.type)}}}return null})()`,
    ),
  );
  await c.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: before.x, y: before.y }],
  });
  await delay(60);
  for (let i = 1; i <= 8; i++) {
    await c.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: before.x - i * 7, y: before.y }],
    });
    await delay(30);
  }
  await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await delay(250);
  const after = await c.eval(
    `Number(document.querySelector('[aria-valuenow]').getAttribute('aria-valuenow'))`,
  );
  json(prefix + '-gesture-value', {
    before,
    after,
    meaning: 'percent of first image visible only',
  });
  assert(after !== before.value, 'Swipe gesture did not move the image divider');
}
async function sourceProbes() {
  prefix = 'source-lifecycle';
  await syntheticCases();
  await runtimeClient();
  await click('Change before photo (currently Apr 1, 2026)');
  await retainPicker();
  await c.eval(`__client20.invalidateQueries({queryKey:['photos'],refetchType:'none'})`);
  await text('Your timeline could not open.');
  await snap('invalidated-retained-source-hidden');
  await c.eval(`__client20.refetchQueries({queryKey:['photos']})`);
  await text('Switch to swipe');
  await c.eval(`__oldChoice20('e2e-front-2026-05-12')`);
  await snap('old-choice-retired-after-refresh');
  assert(
    await c.eval(
      `!!document.querySelector('[aria-label="Change before photo (currently Apr 1, 2026)"]')`,
    ),
    'Refresh adopted an old picker',
  );
  await click('Change before photo (currently Apr 1, 2026)');
  await retainPicker();
  // Current synthetic metadata replacement only. No store mutation, real photo KV or cloud operation.
  await c.eval(
    `(()=>{const query=__client20.getQueryCache().findAll({queryKey:['photos']}).find(q=>q.state.status==='success'&&q.state.data?.series?.length===3);if(!query)throw Error('Fixture source unavailable');const d=query.state.data;const series=d.series.filter(p=>p.id!=='e2e-front-2026-06-24');__client20.setQueryData(query.queryKey,{...d,all:series,series,count:2,metadata:{...d.metadata,count:2,text:'Synthetic source: 2 current photos'},comparePair:{before:series[0],after:series[1]},monthGroups:d.monthGroups.map(g=>({...g,photos:g.photos.filter(p=>series.some(s=>s.id===p.id))})).filter(g=>g.photos.length),milestones:[]})})()`,
  );
  await text('Change photo');
  await c.eval(`__oldChoice20('e2e-front-2026-06-24')`);
  await snap('deleted-record-and-old-picker-retired');
  assert(
    await c.eval(
      `!!document.querySelector('[aria-label="Change after photo (currently May 12, 2026)"]')&&!document.querySelector('[aria-label="Cancel photo selection"]')`,
    ),
    'Deleted record stayed selected',
  );
  await c.eval(`__client20.invalidateQueries({queryKey:['photos']})`);
  await text('Change photo');
  await modulePort('activeHealthProcessingLeaseSnapshot');
  await c.eval(
    'globalThis.__epoch20=__port20;globalThis.__accepted20=__epoch20.activeHealthProcessingLeaseSnapshot()',
  );
  for (const kind of ['same-owner-regrant', 'owner-a-b-a']) {
    await click('Change before photo (currently Apr 1, 2026)');
    await retainPicker();
    await c.eval(
      `(()=>{const e=__epoch20,a=__accepted20;e.clearActiveHealthProcessingEpoch();${kind === 'owner-a-b-a' ? "e.setActiveHealthProcessingEpoch(a.epoch,{...a,ownerUserId:'synthetic-browser-b20',ownerBinding:'b'.repeat(64)});e.clearActiveHealthProcessingEpoch();" : ''}e.setActiveHealthProcessingEpoch(a.epoch,a)})()`,
    );
    await delay(500);
    await c.eval(`__oldChoice20('e2e-front-2026-05-12')`);
    await snap(kind + '-old-choice-retired');
    assert(
      await c.eval(
        `!document.querySelector('[aria-label="Cancel photo selection"]')&&(!!document.querySelector('[aria-label="Change before photo (currently Apr 1, 2026)"]')||document.body.innerText.includes('Your timeline could not open.'))`,
      ),
      'Retired owner influenced current pair',
    );
    await navigateProgress();
    await runtimeClient();
    await modulePort('activeHealthProcessingLeaseSnapshot');
    await c.eval(
      'globalThis.__epoch20=__port20;globalThis.__accepted20=__epoch20.activeHealthProcessingLeaseSnapshot()',
    );
  }
  await click('Change before photo (currently Apr 1, 2026)');
  await retainPicker();
  await modulePort('clearHealthDataCollectionConsentLocal');
  await c.eval('__port20.clearHealthDataCollectionConsentLocal()');
  await c.eval('__epoch20.clearActiveHealthProcessingEpoch()');
  await delay(300);
  await c.eval(`__oldChoice20('e2e-front-2026-05-12')`);
  await snap('withdrawn-source-hidden');
  assert(
    await c.eval(
      `!document.querySelector('[aria-label^="Change before photo"]')&&!localStorage.getItem('layerwell.photos.v1')`,
    ),
    'Withdrawal leaked comparison or wrote photo KV',
  );
  json('source-probes', {
    status: 'PASS',
    currentSource: 'real usePhotos and QueryClient; approved DEV records',
    deletion: 'synthetic current metadata replacement, no store deletion receipt claim',
    owner: 'real epoch publication around synthetic identities; not Auth/provider qualification',
    withdrawal: 'canonical local consent clear and real health lease retirement',
    photoKVWritten: false,
  });
}
async function runFlows() {
  prefix = 'setup';
  await metrics(390, 844);
  await c.send('Page.navigate', { url: base + '/?e2eReset=local' });
  await text('Begin');
  await c.send('Page.navigate', { url: base + '/onboarding/quiz' });
  await text('First, your');
  await fill('Day of birth', '01');
  await fill('Month of birth', '01');
  await fill('Year of birth', '1990');
  await click('Continue');
  await text('Before the quiz');
  await click('I agree. Continue');
  await text('What brings you here?');
  if (process.argv.includes('--gesture-only')) {
    await navigateProgress();
    await click('Switch to swipe comparison');
    await click('Show more of the first image');
    await dragDivider();
    await snap('gesture');
    return;
  }
  if (process.argv.includes('--probe-only')) {
    await navigateProgress();
    await sourceProbes();
    return;
  }
  for (const [width, height] of [
    [360, 640],
    [375, 667],
    [390, 844],
    [430, 932],
  ]) {
    prefix = width + 'x' + height;
    console.log('Browser flow ' + prefix);
    await metrics(width, height);
    await navigateProgress();
    if (width === 360) await pressure(2);
    await snap('side-by-side-default');
    await geometry('default');
    await click('Change before photo (currently Apr 1, 2026)');
    await snap('picker');
    await geometry('picker');
    const blocked = await c.eval(
      `(()=>{const n=document.querySelector('[aria-label="Choose Jun 24, 2026 as the first comparison photo, capture 1 of 3"]');if(n?.getAttribute('aria-disabled')!=='true')throw Error('Opposite record not disabled');n.scrollIntoView({block:'center'});const r=n.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`,
    );
    for (const type of ['mousePressed', 'mouseReleased'])
      await c.send('Input.dispatchMouseEvent', { type, button: 'left', clickCount: 1, ...blocked });
    await delay(150);
    await snap('same-item-refused');
    assert(
      await c.eval(`!!document.querySelector('[aria-label="Cancel photo selection"]')`),
      'Same item closed the picker',
    );
    await click('Choose May 12, 2026 as the first comparison photo,', false);
    await snap('alternate-pair');
    await geometry('alternate-pair');
    assert(
      await c.eval(
        `document.activeElement?.getAttribute('aria-label')==='Change before photo (currently May 12, 2026)'`,
      ),
      'Selection did not return focus',
    );
    await click('Change after photo (currently Jun 24, 2026)');
    await focusKey('Cancel photo selection');
    await snap('keyboard-cancel-focus');
    assert(
      await c.eval(
        `document.activeElement?.getAttribute('aria-label')==='Change after photo (currently Jun 24, 2026)'`,
      ),
      'Cancel did not return focus',
    );
    await click('Switch to swipe comparison');
    await snap('swipe');
    await click('Show more of the first image');
    await text('62 percent of the before photo visible');
    await dragDivider();
    await snap('image-visibility-adjusted');
    await geometry('swipe-adjusted');
    await click('Switch to side-by-side comparison');
    await click('Timeline');
    await snap('timeline');
    await click('Compare');
    await text('Switch to swipe');
    await snap('timeline-back');
    await click('Change before photo (currently Apr 1, 2026)');
    await metrics(width, Math.min(420, height));
    await snap('keyboard-viewport-pressure');
    await geometry('keyboard-pressure');
    await click('Choose May 12, 2026 as the first comparison photo,', false);
    await snap('keyboard-pressure-selected');
    await geometry('keyboard-selected');
    await metrics(width, height);
    summary.push({
      viewport: { width, height },
      status: 'PASS',
      textScale: width === 360 ? 2 : 1,
      sameItemRefused: true,
      alternatePair: true,
      keyboardAndFocus: true,
      timelineBack: true,
      divider: 'image visibility only',
      motion: 'reduced',
    });
  }
  await sourceProbes();
  json('summary', {
    status: 'PASS',
    flows: summary,
    surface:
      'actual Expo web development build; existing browser-only store_pro and populated photo fixtures',
    storageRetry: 'real usePhotos unavailable_once fixture and protected gate Retry',
    glyphs:
      'DOM font and line height x2 with PNG and control glyph bounds; not native Dynamic Type',
    keyboard: 'Enter/cancel and reduced viewport; native keyboard NOT_RUN',
    safeArea: 'unit route uses 34px bottom inset; browser viewport pressure only',
    physicalIPhone: 'NOT_RUN',
    VoiceOver: 'NOT_RUN',
    provider: 'NOT_RUN',
    release: 'NO_GO',
  });
}

try {
  await wait(async () => (await fetch(base)).ok, 'Expo server', 190000);
  const profile = path.join(evidence, 'task-owned-browser-profile');
  mkdirSync(profile);
  browser = spawn(
    browserPath,
    [
      '--headless=new',
      '--remote-debugging-port=9400',
      '--user-data-dir=' + profile,
      '--disable-background-networking',
      '--disable-sync',
      '--no-first-run',
      'about:blank',
    ],
    { windowsHide: true, stdio: 'ignore' },
  );
  let targets;
  await wait(async () => {
    targets = await (await fetch('http://127.0.0.1:9400/json')).json();
    return targets.some((t) => t.type === 'page');
  }, 'Chrome');
  c = new CDP(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await c.ready;
  for (const method of ['Page.enable', 'Runtime.enable', 'Network.enable']) await c.send(method);
  await c.send('Fetch.enable', { patterns: [{ urlPattern: 'http*' }] });
  await c.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });
  await runFlows();
} catch (error) {
  if (c) {
    await snap('FAILURE').catch(() => {});
    json(
      'debug-comparison',
      await c
        .eval(
          `(()=>{const root=document.getElementById('root'),key=Object.keys(root).find(k=>k.startsWith('__reactContainer')),queue=[root[key]?.current||root[key]],seen=new Set(),rows=[];while(queue.length){const f=queue.pop();if(!f||seen.has(f))continue;seen.add(f);queue.push(f.child,f.sibling);if(f.type?.name==='CompareView'){const hooks=[];let h=f.memoizedState;while(h){const v=h.memoizedState;hooks.push(typeof v==='boolean'||typeof v==='number'?v:v&&typeof v==='object'&&'generation' in v?{generation:v.generation}:Array.isArray(v)&&v[0]&&typeof v[0]==='object'&&'alive' in v[0]?{alive:v[0].alive}:null);h=h.next}const contexts=[];let x=f.dependencies?.firstContext;while(x){if(typeof x.memoizedValue?.isFocused==='function')contexts.push({focused:x.memoizedValue.isFocused()});x=x.next}const tokens=[];for(const row of f.updateQueue?.memoCache?.data||[]){for(const v of row){if(v&&typeof v==='object'&&'alive' in v)tokens.push({alive:v.alive,revision:v.revision})}}rows.push({sourceCurrent:f.memoizedProps.isSourceCurrent(),count:f.memoizedProps.data.series.length,hooks,contexts,tokens})}}return rows})()`,
        )
        .catch((e) => ({ error: e.message })),
    );
  }
  if (c)
    json(
      'debug-query',
      await c
        .eval(
          `globalThis.__client20?.getQueryCache().findAll({queryKey:['photos']}).map(q=>({status:q.state.status,fetch:q.state.fetchStatus,error:q.state.error?.message,count:q.state.data?.count,invalidated:q.state.isInvalidated}))`,
        )
        .catch(() => null),
    );
  json('ERROR', { status: 'FAIL', message: error.message });
  process.exitCode = 1;
} finally {
  if (c) {
    json('steps', steps);
    json('console', c.logs);
    json('network', c.network);
    json('trace', c.trace);
    c.ws.close();
  }
  await stop(browser);
  await stop(server);
}
