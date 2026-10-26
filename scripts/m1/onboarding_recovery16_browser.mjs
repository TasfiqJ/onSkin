// Existing Chrome CDP + Expo harness, no dependencies. Synthetic local fixture only.
// Keyboard viewport/text pressure is browser simulation, never native/VoiceOver proof.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const root = fileURLToPath(new URL('../../', import.meta.url));
const evidence = path.resolve(process.argv[2]);
mkdirSync(evidence, { recursive: true });
if (readdirSync(evidence).length) throw new Error('Evidence directory must be new and empty');
const base = 'http://localhost:8296';
const browserPath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find(existsSync);
if (!browserPath) throw new Error('NOT_RUN: existing Chrome unavailable');
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('EXPO_PUBLIC_') && !/(TOKEN|SECRET|PASSWORD|PASSCODE|API[_-]?KEY|AUTHORIZATION|COOKIE|PRIVATE[_-]?KEY|DSN)(_|$)/i.test(k)));
Object.assign(env, { CI: '1', BROWSER: 'none', EXPO_NO_DOTENV: '1', EXPO_NO_TELEMETRY: '1', EXPO_PUBLIC_APP_ENV: 'development', EXPO_PUBLIC_E2E_APP_LOCK_ENABLED: 'false', EXPO_PUBLIC_E2E_FIRST_SESSION_AUTH: 'anonymous_owner', EXPO_PUBLIC_E2E_LOCAL_RESET: '1', EXPO_PUBLIC_SUPABASE_URL: 'https://blocked-supabase-url.invalid', EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '__BLOCKED_PLACEHOLDER__' });
const server = spawn(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', 'npm --workspace apps/mobile run web -- --port 8296 --host localhost'], { cwd: root, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
let serverLog = ''; for (const stream of [server.stdout, server.stderr]) stream.on('data', chunk => { serverLog += chunk; writeFileSync(path.join(evidence, 'expo.log'), serverLog); });
const json = (name, value) => writeFileSync(path.join(evidence, name + '.json'), JSON.stringify(value, null, 2) + '\n');
const assert = (ok, message) => { if (!ok) throw new Error(message); };
async function wait(fn, label, ms = 60000) { const until = Date.now() + ms; while (Date.now() < until) { try { if (await fn()) return; } catch {} await delay(150); } throw new Error('Timeout: ' + label); }
class CDP {
  constructor(url) {
    this.pending = new Map(); this.id = 0; this.logs = []; this.network = []; this.ws = new WebSocket(url);
    this.ready = new Promise((resolve, reject) => { this.ws.addEventListener('open', resolve); this.ws.addEventListener('error', reject); });
    this.ws.addEventListener('message', event => {
      const m = JSON.parse(event.data);
      if (m.id) { const p = this.pending.get(m.id); this.pending.delete(m.id); if (m.error) p?.reject(new Error(m.error.message)); else p?.resolve(m.result); }
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
  const state = await c.eval(`({path:location.pathname,text:document.body.innerText,viewport:{width:innerWidth,height:innerHeight},overflow:document.documentElement.scrollWidth>innerWidth,controls:[...document.querySelectorAll('[role=button],input')].map(n=>{const r=n.getBoundingClientRect();return {label:n.getAttribute('aria-label')||n.textContent,disabled:n.getAttribute('aria-disabled'),x:r.x,y:r.y,width:r.width,height:r.height}})})`);
  json(prefix + '-' + name, state);
  const shot = await c.send('Page.captureScreenshot', { format: 'png' }); writeFileSync(path.join(evidence, prefix + '-' + name + '.png'), Buffer.from(shot.data, 'base64'));
  return state;
}
async function text(value) { await wait(() => c.eval(`document.body.innerText.includes(${JSON.stringify(value)})`), value); }
async function route(value) { await wait(() => c.eval(`location.pathname===${JSON.stringify(value)}`), value); }
async function click(label, exact = true) {
  await wait(() => c.eval(`!![...document.querySelectorAll('[role=button],button,a')].find(n=>{if(n.getBoundingClientRect().width===0)return false;const s=(n.getAttribute('aria-label')||n.textContent||'').replace(/\\s+/g,' ').trim();return ${exact ? 's===' : 's.includes('}${JSON.stringify(label)}${exact ? '' : ')'}&&n.getAttribute('aria-disabled')!=='true'})`), 'click ' + label);
  const r = await c.eval(`(()=>{const n=[...document.querySelectorAll('[role=button],button,a')].find(n=>{if(n.getBoundingClientRect().width===0)return false;const s=(n.getAttribute('aria-label')||n.textContent||'').replace(/\\s+/g,' ').trim();return ${exact ? 's===' : 's.includes('}${JSON.stringify(label)}${exact ? '' : ')'}});n.scrollIntoView({block:'center'});const r=n.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await c.send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...r }); await c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...r }); await delay(200);
}
async function fill(label, value) {
  await c.eval(`(()=>{const n=document.querySelector('input[aria-label='+${JSON.stringify(JSON.stringify(label))}+']');if(!n)throw Error('missing input');n.scrollIntoView({block:'center'});n.focus();const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(n,'');n.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await c.send('Input.insertText', { text: value }); await delay(150);
}
async function metrics(width, height) { await c.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: true }); }
async function stop(child) {
  if (!child?.pid || child.exitCode !== null) return;
  const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
  await new Promise(resolve => killer.on('exit', resolve));
}
try {
  await wait(async () => (await fetch(base)).ok, 'Expo server', 180000);
  const profile = path.join(evidence, 'task-owned-browser-profile'); mkdirSync(profile);
  browser = spawn(browserPath, ['--headless=new', '--remote-debugging-port=9396', '--user-data-dir=' + profile, '--disable-background-networking', '--disable-sync', '--no-first-run', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let targets; await wait(async () => { targets = await (await fetch('http://127.0.0.1:9396/json')).json(); return targets.some(t => t.type === 'page'); }, 'Chrome');
  c = new CDP(targets.find(t => t.type === 'page').webSocketDebuggerUrl); await c.ready;
  for (const method of ['Page.enable', 'Runtime.enable', 'Network.enable']) await c.send(method);
  await c.send('Fetch.enable', { patterns: [{ urlPattern: 'http*' }] });
  await c.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  const answers = ['Shiny in places', 'Rarely', 'Often stings, burns, or reddens', 'Frequently', 'Yes, noticeably', 'Weeks or longer', 'Fine lines or firmness changes are visible', 'A lot over time', 'Sometimes burns', 'Tone 4', 'None that I know of', 'No'];
  for (const [width, height] of [[360, 640], [375, 667], [390, 844], [430, 932]]) {
    prefix = `${width}x${height}`; console.log('Browser flow ' + prefix); await metrics(width, height);
    await c.send('Page.navigate', { url: base + '/?e2eReset=local' }); await text('Begin'); await snap('welcome');
    await c.send('Page.navigate', { url: base + '/onboarding/quiz' }); await text('First, your'); await snap('direct-entry-age-fenced');
    await fill('Day of birth', '01'); await fill('Month of birth', '01'); await fill('Year of birth', '1990'); await click('Continue');
    await text('Before the quiz'); await snap('consent'); await click('I agree. Continue'); await text('What brings you here?'); await click('Clear skin', false); await click('Continue');
    for (const [i, answer] of answers.entries()) { await text(answer); await click(answer); await click(i === 11 ? 'See my profile' : 'Next'); }
    await text("What's on your shelf?"); await snap('products-empty');
    await c.eval('history.back()'); await route('/onboarding/quiz'); await text('See my profile'); await snap('quiz-mounted-return'); await click('See my profile'); await route('/onboarding/products');
    await fill('Product name', 'Synthetic unsaved product with a long label');
    await c.eval(`(()=>{for(const n of document.querySelectorAll('*')) {if(n.children.length===0&&n.textContent.trim()) {const s=getComputedStyle(n);n.style.fontSize=(parseFloat(s.fontSize)*2)+'px';n.style.lineHeight=(parseFloat(s.lineHeight)*2)+'px';}}})()`);
    await metrics(width, Math.max(320, height - 300)); await snap('keyboard-viewport-text200');
    await click('Skip for now'); await text('not been added'); await snap('unsaved-warning'); await click('Keep editing');
    assert(await c.eval(`document.querySelector('input[aria-label="Product name"]').value.includes('Synthetic unsaved')`), 'Keep editing lost text');
    await click('Skip for now'); await click('Continue without adding it'); await metrics(width, height);
    await route('/onboarding/reveal'); await snap('reveal'); await click('Continue'); await route('/onboarding/notifications'); await snap('reminder-start');
    await c.eval(`(()=>{const original=Storage.prototype.setItem;globalThis.__restore16=()=>{Storage.prototype.setItem=original};Storage.prototype.setItem=function(k,v){if(k==='layerwell.notifPrefs.v1')throw Error('SYNTHETIC16_WRITE_REFUSED');return original.call(this,k,v)}})()`);
    await click('Not now'); await text('could not save'); assert(await c.eval(`location.pathname==='/onboarding/notifications'`), 'Failure silently advanced'); await snap('reminder-storage-failure');
    await c.eval('__restore16()'); await click('Check current choice and retry'); await text('Reminders are off'); await snap('reminder-retry-off');
    await click('Turn reminders off'); await text('Reminders are off'); await click('Continue'); await route('/onboarding/account'); await snap('account');
    summary.push({ viewport: { width, height }, result: 'PASS', mountedQuizReturn: true, emptyShelfSkip: true, unsavedChoice: true, storageFailureRetry: true, keyboardViewportPressure: 'SIMULATED', textPressure: '200% direct DOM leaf text', reducedMotion: true, nativeDelivery: 'NOT_RUN' });
  }
  json('summary', { status: 'PASS', source: 'actual Expo web with existing development-only anonymous-owner fixture', flows: summary, native: 'NOT_RUN', permissions: 'NO_REAL_OS_REQUEST' });
} catch (error) {
  if (c) await snap('FAILURE').catch(() => {});
  json('ERROR', { status: 'FAIL', message: error.message, completed: summary }); process.exitCode = 1;
} finally {
  if (c) { json('console', c.logs); json('network', c.network); c.ws.close(); }
  await stop(browser); await stop(server);
}
