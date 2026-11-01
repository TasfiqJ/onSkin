import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import test, { before, after } from 'node:test';
import { shelfTargetExpression37, selectShelfTarget37 } from './onboarding-first-session.mjs';

// Independent REAL Chrome DOM fixtures. These are selector/occlusion controls,
// never an Expo first-session pass or a fabricated owner admission.
let browser, profile, server, socket, send, port, html;
const name = 'Mineral SPF 50';
const card = '<button id="product" role="button" aria-label="Mineral SPF 50, Date unknown"><span>Mineral SPF 50</span></button>';
function page(content = card, extra = '', spacer = 0) {
  return `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>
    *{box-sizing:border-box}body{margin:0}button{min-height:48px}#scroll{height:400px;width:327px;margin:24px;overflow-y:auto}
    #product{width:290px;height:86px}#tabs{position:fixed;bottom:0;height:80px;background:white;width:100%}
    </style><div id="background" aria-hidden="true"><div role="checkbox" aria-label="Mineral SPF 50" style="position:absolute;top:220px">Mineral SPF 50</div></div>
    <div id="scroll"><button role="button" aria-label="All" aria-pressed="true">All</button>
    <button role="button" aria-label="Expiring" aria-pressed="false">Expiring</button>
    <div style="height:${spacer}px"></div>${content}<div style="height:400px"></div></div>
    <nav id="tabs"><a role="tab" aria-selected="false">Today</a><a role="tab" aria-selected="true">Shelf</a></nav>${extra}`;
}
async function evaluate(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  assert.equal(r.exceptionDetails, undefined, JSON.stringify(r.exceptionDetails));
  return r.result?.value;
}
async function load(content = page(), route = '/shelf') {
  html = content;
  await send('Page.navigate', { url: `http://127.0.0.1:${port}${route}` });
  for (let i = 0; i < 100; i++) {
    if (await evaluate(`location.pathname === ${JSON.stringify(route)} && document.readyState === 'complete' && !!document.querySelector('#tabs')`)) return;
    await delay(20);
  }
  throw new Error('Synthetic DOM document did not load');
}
const inspect = (options) => evaluate(shelfTargetExpression37(name, options));

before(async () => {
  server = createServer((req, res) => { res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' }); res.end(html); });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve)); port = server.address().port;
  profile = await mkdtemp(path.join(tmpdir(), 'compact-shelf37-dom-'));
  const executable = [process.env.CHROME_PATH, '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium', '/usr/bin/chromium-browser', 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((p) => p && existsSync(p));
  assert.ok(executable, 'Real Chrome required; selector controls must not silently skip.');
  browser = spawn(executable, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-extensions',
    ...(process.platform === 'linux' ? ['--no-sandbox'] : []), 'about:blank'], { stdio: 'ignore', windowsHide: true });
  let debug;
  for (let i = 0; i < 200; i++) {
    try { debug = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break; }
    catch { await delay(50); }
  }
  assert.ok(debug, 'Chrome CDP port not available.');
  const targets = await (await fetch(`http://127.0.0.1:${debug}/json`)).json();
  socket = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  let id = 0; const pending = new Map();
  socket.addEventListener('message', (e) => { const r = JSON.parse(e.data); if (!r.id) return;
    const p = pending.get(r.id); pending.delete(r.id); if (r.error) p.reject(new Error(r.error.message)); else p.resolve(r.result); });
  send = (method, params = {}) => new Promise((resolve, reject) => { const n = ++id; pending.set(n, { resolve, reject }); socket.send(JSON.stringify({ id: n, method, params })); });
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 667, deviceScaleFactor: 2, mobile: true });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true });
});

after(async () => {
  if (send) await send('Browser.close').catch(() => {});
  socket?.close(); browser?.kill();
  await new Promise((resolve) => server ? server.close(resolve) : resolve());
  if (profile) await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

test('real DOM excludes mounted aria-hidden Today and hidden partial text, then owns the exact button', async () => {
  await load(page(card, '<div hidden><button aria-label="Mineral SPF 50 extra">Mineral SPF 50</button></div>' +
    `<section aria-hidden="true">${card.replace('id="product"', 'id="background-exact-button"')}</section>`));
  const s = await inspect();
  assert.equal(s.candidates.length, 4); assert.equal(s.exactCandidates, 1);
  assert.equal(s.candidates.filter((c) => c.label === 'Mineral SPF 50, Date unknown').length, 2);
  assert.equal(s.candidates.find((c) => c.role === 'checkbox').active, false);
  assert.equal(selectShelfTarget37(s).label, 'Mineral SPF 50, Date unknown');
  assert.ok(s.target.hitChain.length > 1);
});

test('real offscreen product fails before scrolling; only actual Shelf container scrolls', async () => {
  await load(page(card, '', 700));
  const before = await inspect(); assert.equal(before.target.fullyVisible, false);
  assert.throws(() => selectShelfTarget37(before), /offscreen/);
  await inspect({ scroll: true, label: before.target.label }); await delay(30);
  const after = await inspect({ label: before.target.label });
  assert.ok(selectShelfTarget37(after).hitOwned);
  assert.ok(after.target.scrollContainer.scrollTop > 0);
  assert.equal(await evaluate('document.querySelector("#background").scrollTop'), 0);
});

test('real two exact active product buttons fail closed without choosing one', async () => {
  await load(page(card + card.replace('id="product"', 'id="duplicate"')));
  const s = await inspect(); assert.equal(s.exactCandidates, 2); assert.equal(s.target, null);
  assert.throws(() => selectShelfTarget37(s), /exactly one/);
});

for (const [reason, content] of [
  ['absent product', ''],
  ['wrong accessible role', card.replace('role="button"', 'role="checkbox"')],
  ['partial accessible name', card.replace('aria-label="Mineral SPF 50, Date unknown"', 'aria-label="Mineral SPF 500, Date unknown"')],
  ['hidden exact button', `<div hidden>${card}</div>`],
  ['retired aria-hidden panel', `<div aria-hidden="true">${card}</div>`],
  ['inert panel', `<div inert>${card}</div>`],
]) test(`real DOM refuses ${reason}`, async () => {
  await load(page(content)); const s = await inspect(); assert.equal(s.exactCandidates, 0);
  assert.throws(() => selectShelfTarget37(s), /exactly one/);
});

test('real modal overlay at the product center refuses the foreground sibling hit', async () => {
  await load(page(card, '<div role="dialog" style="position:fixed;inset:0;z-index:10;background:white">Modal</div>'));
  const s = await inspect(); assert.equal(s.target.hitOwned, false);
  assert.equal(s.target.hitRoot.role, 'dialog'); assert.throws(() => selectShelfTarget37(s), /occluded/);
});

test('real clipped ancestor refuses even when the center remains visible', async () => {
  await load(page(`<div style="height:65px;overflow:hidden">${card}</div>`));
  const s = await inspect(); assert.equal(s.target.fullyVisible, false); assert.throws(() => selectShelfTarget37(s), /clipped/);
});

test('real product below sticky bottom bar refuses even with visible text', async () => {
  await load(page(card, '<style>#scroll{height:640px}#product{position:fixed;top:550px;left:24px}</style>'));
  const s = await inspect(); assert.equal(s.target.hitOwned, false); assert.throws(() => selectShelfTarget37(s), /occluded/);
});

test('real scrolled-away row refuses before a new touch', async () => {
  await load(); await evaluate(`document.querySelector('#scroll').scrollTop=300`);
  const s = await inspect(); assert.equal(s.target.fullyVisible, false); assert.throws(() => selectShelfTarget37(s), /offscreen/);
});

test('real non-Shelf route and deactivated Shelf tab both refuse', async () => {
  await load(page(), '/today'); const wrongRoute = await inspect();
  assert.throws(() => selectShelfTarget37(wrongRoute), /foreground/);
  await load(page().replace('aria-selected="false">Today', 'aria-selected="true">Today')
    .replace('aria-selected="true">Shelf', 'aria-selected="false">Shelf'));
  const inactive = await inspect(); assert.throws(() => selectShelfTarget37(inactive), /foreground/);
});

test('real Expiring selection cannot masquerade as an owned product tap', async () => {
  await load(page().replace('aria-label="All" aria-pressed="true"', 'aria-label="All" aria-pressed="false"')
    .replace('aria-label="Expiring" aria-pressed="false"', 'aria-label="Expiring" aria-pressed="true"'));
  const s = await inspect(); assert.throws(() => selectShelfTarget37(s), /All filter/);
});

test('real CDP touch lands on the authenticated descendant and fires the product control', async () => {
  await load(); await evaluate(`document.querySelector('#product').addEventListener('click',()=>document.title='product activated')`);
  const { rect } = selectShelfTarget37(await inspect());
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, x: rect.x, y: rect.y, radiusX: 2, radiusY: 2 }] });
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  for (let i = 0; i < 100 && await evaluate('document.title') !== 'product activated'; i++) await delay(10);
  assert.equal(await evaluate('document.title'), 'product activated');
});
