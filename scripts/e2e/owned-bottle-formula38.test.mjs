import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import test, { before, after } from 'node:test';
import { assertFormulaMessageVisible38, formulaControlExpression38, formulaMessageExpression38,
  selectFormulaControl38, touchFormulaControl38 } from './owned-bottle-formula38.mjs';

// Independent real Chrome DOM controls. These are selector/decision negatives,
// not an Expo journey, owner qualification, native test or formula confirmation.
let browser, profile, server, socket, send, port, html;
const route = '/shelf/formula-history', label = 'Confirm this bottle observation';
const button = `<button aria-label="${label}" style="width:290px;height:52px">Confirm<span> observation</span></button>`;
const page = (content = button, extra = '') => `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>
  *{box-sizing:border-box}body{margin:0}#scroll{height:400px;width:327px;margin:24px;overflow:auto}button{min-height:48px}
  </style><main id="scroll">${content}</main>${extra}`;
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  assert.equal(result.exceptionDetails, undefined, JSON.stringify(result.exceptionDetails));
  return result.result?.value;
}
async function load(content = page(), nextRoute = route) {
  html = content;
  await send('Page.navigate', { url: `http://127.0.0.1:${port}${nextRoute}` });
  for (let i = 0; i < 100; i++) {
    if (await evaluate(`location.pathname === ${JSON.stringify(nextRoute)} && document.readyState === 'complete' && !!document.querySelector('#scroll')`)) return;
    await delay(20);
  }
  throw new Error('Real DOM fixture did not load.');
}
const inspect = (name = label, options = {}) => evaluate(formulaControlExpression38(name, { path: route, ...options }));

before(async () => {
  server = createServer((req, res) => { res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' }); res.end(html); });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  port = server.address().port;
  profile = await mkdtemp(path.join(tmpdir(), 'formula38-dom-'));
  const executable = [process.env.CHROME_PATH, 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((p) => p && existsSync(p));
  assert.ok(executable, 'Real Chrome is required; do not silently skip selector controls.');
  browser = spawn(executable, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-extensions',
    ...(process.platform === 'linux' ? ['--no-sandbox'] : []), 'about:blank'], { stdio: 'ignore', windowsHide: true });
  let debug;
  for (let i = 0; i < 200; i++) {
    try { debug = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break; }
    catch { await delay(50); }
  }
  assert.ok(debug, 'Chrome CDP did not start.');
  const targets = await (await fetch(`http://127.0.0.1:${debug}/json`)).json();
  socket = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  let id = 0; const pending = new Map();
  socket.addEventListener('message', (event) => { const response = JSON.parse(event.data); if (!response.id) return;
    const operation = pending.get(response.id); pending.delete(response.id);
    if (response.error) operation.reject(new Error(response.error.message)); else operation.resolve(response.result); });
  send = (method, params = {}) => new Promise((resolve, reject) => { const next = ++id;
    pending.set(next, { resolve, reject }); socket.send(JSON.stringify({ id: next, method, params })); });
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 667, deviceScaleFactor: 2, mobile: true });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true });
});

after(async () => {
  if (send) await send('Browser.close').catch(() => {});
  socket?.close(); browser?.kill();
  await new Promise((resolve) => server ? server.close(resolve) : resolve());
  if (profile) {
    assert.equal(path.dirname(path.resolve(profile)), path.resolve(tmpdir()));
    assert.ok(path.basename(profile).startsWith('formula38-dom-'));
    await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
});

test('real foreground exact accessible button owns its touch', async () => {
  await load(page(button, `<section aria-hidden="true">${button}</section><section hidden>${button}</section>`));
  const snapshot = await inspect();
  assert.equal(snapshot.exactCandidates, 1);
  assert.equal(selectFormulaControl38(snapshot).label, label);
  await evaluate(`document.querySelector('button').addEventListener('click',()=>document.title='explicitly-tapped')`);
  assert.notEqual(await evaluate('document.title'), 'explicitly-tapped');
  await touchFormulaControl38({ label, path: route, inspect, send, guard: async () => {}, record: async () => {} });
  assert.equal(await evaluate('document.title'), 'explicitly-tapped');
});

for (const [reason, content] of [
  ['missing control', ''],
  ['hidden control', `<section hidden>${button}</section>`],
  ['retired aria-hidden screen', `<section aria-hidden="true">${button}</section>`],
  ['inert screen', `<section inert>${button}</section>`],
  ['transparent screen', `<section style="opacity:0">${button}</section>`],
  ['pointer-disabled screen', `<section style="pointer-events:none">${button}</section>`],
  ['wrong accessible role', button.replace('<button ', '<button role="checkbox" ')],
  ['partial accessible name', button.replace('aria-label="Confirm this bottle observation"', 'aria-label="Confirm this bottle observation later"')],
]) test(`real DOM refuses ${reason}`, async () => {
  await load(page(content));
  const snapshot = await inspect();
  assert.equal(snapshot.exactCandidates, 0);
  assert.throws(() => selectFormulaControl38(snapshot), /exactly one/);
});

test('real ambiguous duplicate accessible names refuse', async () => {
  await load(page(button + button));
  const snapshot = await inspect(); assert.equal(snapshot.exactCandidates, 2);
  assert.throws(() => selectFormulaControl38(snapshot), /exactly one/);
});

test('real disabled confirmation refuses', async () => {
  await load(page(button.replace('<button ', '<button disabled ')));
  const snapshot = await inspect();
  assert.throws(() => selectFormulaControl38(snapshot), /disabled/);
});

test('real wrong route refuses even with matching control', async () => {
  await load(page(), '/shelf/some-other-unit');
  const snapshot = await inspect();
  assert.throws(() => selectFormulaControl38(snapshot), /route/);
});

test('real opaque overlay refuses occult confirmation', async () => {
  await load(page(button, '<div role="dialog" style="position:fixed;inset:0;z-index:10;background:white">Overlay</div>'));
  const snapshot = await inspect(); assert.equal(snapshot.target.hitOwned, false);
  assert.throws(() => selectFormulaControl38(snapshot), /occluded/);
});

test('real clipped button refuses', async () => {
  await load(page(`<section style="height:30px;overflow:hidden">${button}</section>`));
  const snapshot = await inspect(); assert.equal(snapshot.target.fullyVisible, false);
  assert.throws(() => selectFormulaControl38(snapshot), /clipped/);
});

test('real below-fold control refuses until its actual container scrolls', async () => {
  await load(page('<div style="height:700px"></div>' + button + '<div style="height:400px"></div>'));
  const before = await inspect();
  assert.throws(() => selectFormulaControl38(before), /offscreen/);
  await inspect(label, { scroll: true }); await delay(30);
  assert.equal(selectFormulaControl38(await inspect()).hitOwned, true);
  assert.ok(await evaluate(`document.querySelector('#scroll').scrollTop > 0`));
});

test('real text input requires the exact accessible textbox identity', async () => {
  await load(page('<input aria-label="Variant as printed" style="width:290px;height:52px">'));
  const wrongRole = await inspect('Variant as printed');
  assert.throws(() => selectFormulaControl38(wrongRole), /exactly one/);
  assert.equal(selectFormulaControl38(await inspect('Variant as printed', { role: 'textbox' })).role, 'textbox');
});

test('owner or revision retirement between inspection and touch sends no event', async () => {
  await load();
  let guards = 0, sent = 0;
  await assert.rejects(() => touchFormulaControl38({ label, path: route, inspect,
    send: async () => { sent += 1; }, record: async () => {},
    guard: async () => { if (++guards === 2) throw new Error('retired synthetic owner/revision'); } }), /retired/);
  assert.equal(sent, 0);
});

test('real accessible status alert must be visible after confirmation', async () => {
  await load(page('<div role="alert" style="height:70px;width:290px">Storage did not confirm this observation.</div>'));
  const receipt = await evaluate(formulaMessageExpression38('Storage did not confirm this observation.'));
  assertFormulaMessageVisible38(receipt);
});

test('real matching error text below the fold cannot masquerade as visible feedback', async () => {
  await load(page('<div style="height:700px"></div><div role="alert" style="height:70px;width:290px">This draft is outdated.</div>'));
  const receipt = await evaluate(formulaMessageExpression38('This draft is outdated.'));
  assert.throws(() => assertFormulaMessageVisible38(receipt), /offscreen/);
});

test('real matching status under a modal cannot masquerade as visible feedback', async () => {
  await load(page('<div role="alert" style="height:70px;width:290px">Saved on this device and read back.</div>',
    '<div role="dialog" style="position:fixed;inset:0;z-index:10;background:white">Overlay</div>'));
  const receipt = await evaluate(formulaMessageExpression38('Saved on this device and read back.'));
  assert.throws(() => assertFormulaMessageVisible38(receipt), /occluded/);
});
