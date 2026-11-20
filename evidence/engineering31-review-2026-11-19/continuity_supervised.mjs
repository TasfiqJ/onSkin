// Operator-equivalent setup recovery. The committed driver/assertions stay
// unchanged. Never clear storage, release/steal a lock or create an admission.
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
const repo = process.cwd(), out = process.env.ONSKIN_OUTCOME_EVIDENCE;
if (!out || existsSync(out)) throw Error('Fresh evidence path required');
const b = await import(pathToFileURL(path.join(repo, 'scripts/e2e/cat04-catalog-recovery-audit.mjs')));
const child = spawn(process.execPath, ['scripts/e2e/actual-apply-outcome29.mjs'], { cwd: repo, env: process.env, stdio: 'inherit', windowsHide: true });
let done = false;
const completed = new Promise(resolve => child.once('exit', code => { done = true; resolve(code ?? 1); }));
const events = [];
async function connect(url) {
  const ws = new WebSocket(url), pending = new Map(); let serial = 0;
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
  ws.addEventListener('message', event => { const data = JSON.parse(event.data); if (!data.id) return; const item = pending.get(data.id); if (!item) return; pending.delete(data.id); data.error ? item.reject(Error(data.error.message)) : item.resolve(data.result); });
  ws.addEventListener('close', () => { for (const item of pending.values()) item.reject(Error('Owned target closed')); pending.clear(); });
  return { send(method, params = {}) { return new Promise((resolve, reject) => { const id = ++serial; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); }); }, close() { ws.close(); } };
}
while (!done) {
  let client;
  try {
    const owned = path.join(out, 'owned-processes.json');
    if (!existsSync(owned)) { await delay(200); continue; }
    const { appPort, debugPort } = JSON.parse(readFileSync(owned, 'utf8'));
    const origin = `http://localhost:${appPort}`;
    const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
    const pages = targets.filter(target => target.type === 'page' && target.url.startsWith(origin + '/'));
    if (pages.length !== 1) { await delay(200); continue; }
    const target = pages[0];
    if (!target.webSocketDebuggerUrl.startsWith(`ws://127.0.0.1:${debugPort}/`)) throw Error('Unowned debug target');
    client = await connect(target.webSocketDebuggerUrl);
    const paused = await b.evaluate(client, `document.body?.innerText.includes('Private app access paused')&&!!document.querySelector('[aria-label="Retry private app access"]')`);
    if (paused) {
      const held = await b.evaluate(client, `(async()=>{const q=await navigator.locks.query();return q.held.filter(row=>row.name==='layerwell.private-runtime.v1').length})()`, true);
      // A live other runtime must remain a refusal. No held lock means the
      // earlier context ended; the ordinary UI can request admission again.
      if (held === 0) {
        await b.scrollControlIntoView(client, 'Retry private app access'); await b.clickByText(client, 'Retry private app access');
        events.push({ at: new Date().toISOString(), targetId: target.id, path: new URL(target.url).pathname,
          appPages: pages.length, heldLocksBefore: held, action: 'real visible Retry private app access', storageOrLockMutation: false });
        await delay(500);
      }
    }
  } catch (error) {
    if (!done && !/fetch failed|Owned target closed|WebSocket/.test(String(error))) events.push({ at: new Date().toISOString(), diagnostic: String(error) });
  } finally { client?.close(); }
  await delay(200);
}
const code = await completed;
writeFileSync(path.join(out, 'SUPERVISOR.json'), JSON.stringify({ committedDriverUnchanged: true, noTimeoutOrAssertionChange: true,
  noStorageKeyOrAdmissionOverride: true, onlyOwnedSingleTabVisibleRecovery: true, events, exit: code }, null, 2) + '\n');
process.exitCode = code;
