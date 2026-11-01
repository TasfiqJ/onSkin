import { spawn } from 'node:child_process';
import { dailyLoopFlow } from './retained-daily-loop.mjs';
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

import {
  assertCompletedAccountRecovery,
  assertCrossOwnerRaceOutcomes,
  assertNoUncaughtErrors,
  isDisallowedLog as disallowedLog,
} from './retained-safety-assertions.mjs';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const isWindows = process.platform === 'win32';
const today = new Date().toISOString().slice(0, 10);
const accountCheckpointMode = process.argv.includes('--account-upgrade-checkpoint');
const accountUpgradeMode =
  accountCheckpointMode ||
  process.argv.includes('--account-upgrade') ||
  process.env.ONBOARDING_E2E_ACCOUNT_UPGRADE?.trim().toLowerCase() === 'email_same_user';
const crossOwnerMode = process.argv.includes('--cross-owner');
const accountIsolationMode =
  crossOwnerMode ||
  process.argv.includes('--account-isolation') ||
  process.env.ONBOARDING_E2E_ACCOUNT_ISOLATION?.trim().toLowerCase() === 'signout_clear_retry';
const deletionRecoveryMode = process.env.ONBOARDING_E2E_DELETION_RECOVERY;
if (
  deletionRecoveryMode &&
  !['pending_then_completed_manual', 'invalid', 'invalid_support_only', 'expired'].includes(
    deletionRecoveryMode,
  )
) {
  throw new Error('Unknown deletion recovery fixture.');
}
assertSingleMode();
function assertSingleMode() {
  if (accountUpgradeMode && accountIsolationMode) {
    throw new Error('Choose only one onboarding E2E mode.');
  }
}
const evidenceDir =
  process.env.ONBOARDING_E2E_EVIDENCE_DIR ??
  path.join(
    repoRoot,
    'test-results',
    'human-e2e',
    today,
    accountUpgradeMode
      ? accountCheckpointMode
        ? 'onboarding-account-upgrade-checkpoint-current'
        : 'onboarding-account-upgrade-current'
      : accountIsolationMode
        ? 'onboarding-account-isolation-current'
        : 'onboarding-first-session-430-current',
  );
const appPort = Number(process.env.ONBOARDING_E2E_PORT ?? 8285);
const debugPort = Number(process.env.ONBOARDING_E2E_DEBUG_PORT ?? 9385);
const baseUrl = process.env.ONBOARDING_E2E_BASE_URL ?? `http://localhost:${appPort}`;
const shouldStartServer = !process.env.ONBOARDING_E2E_BASE_URL;
const viewport = {
  height: Number(
    process.env.ONBOARDING_E2E_VIEWPORT_HEIGHT ??
      (accountUpgradeMode || accountIsolationMode ? 640 : 430),
  ),
  width: Number(
    process.env.ONBOARDING_E2E_VIEWPORT_WIDTH ??
      (accountUpgradeMode || accountIsolationMode ? 360 : 320),
  ),
};
const isLaunchFloorViewport = viewport.width >= 375 && viewport.height >= 667;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// These are the real driver's decisions. Synthetic IO tests cover refusals;
// the separate Chrome run supplies actual UI and encrypted-store evidence.
export async function continueAfterReminderChoice35({ readChoice, click, waitForAccount }) {
  const choice = await readChoice();
  assert(choice?.path === '/onboarding/notifications', 'Reminder choice auto-advanced or left its screen.');
  assert(choice.persistedOff === true, 'OFF must be durably saved before continuation.');
  assert(choice.sameOwner === true && choice.currentConsent === true, 'Reminder authority is not current.');
  const deliveryUnconfirmed = choice.bodyText?.includes(
    'Your off choice is saved, but delivery is unconfirmed. Existing reminders may remain. You can retry or continue with delivery unconfirmed.',
  ) === true;
  assert(deliveryUnconfirmed || choice.bodyText?.includes('Reminders are off. Your choice was saved.'),
    'Missing truthful saved OFF confirmation.');
  const label = deliveryUnconfirmed ? 'Continue with delivery unconfirmed' : 'Continue';
  assert(choice.controls?.some((control) => control.label === label &&
    control.role === 'button' && control.disabled === false && control.hitOk === true),
  'Saved reminder choice has no enabled, reachable continuation.');
  await click(label);
  await waitForAccount();
  return { deliveryUnconfirmed };
}

export function assertFreeFirstSession35(receipt, expectedNames) {
  assert(receipt?.sameOwner === true && receipt.currentConsent === true,
    'Free journey lost its current owner or health consent.');
  assert(receipt.proActive === false, 'Free continuation must not grant Pro authority.');
  assert(Array.isArray(receipt.products) && receipt.products.length === expectedNames.length &&
    new Set(receipt.products).size === expectedNames.length &&
    expectedNames.every((name) => receipt.products.includes(name)),
  'Free journey did not preserve the exact synthetic Shelf products.');
}

// A mounted background tab is not a foreground control, even when its own
// computed style and rectangle look visible. This runs in the real document.
export function shelfTargetExpression37(name, { scroll = false, label = null } = {}) {
  return `(${shelfTargetDocument37.toString()})(${JSON.stringify({ name, scroll, label })})`;
}

function shelfTargetDocument37({ name, scroll, label }) {
  const normalize = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
  const box = (node) => {
    const r = node.getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom,
      width: r.width, height: r.height, x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };
  const describe = (node) => node ? { tag: node.tagName,
    role: node.getAttribute('role') || (node.tagName === 'BUTTON' ? 'button' : null),
    label: normalize(node.getAttribute('aria-label') || node.getAttribute('accessibilitylabel') || node.textContent),
    text: normalize(node.textContent).slice(0, 180), rect: box(node) } : null;
  const ancestors = (node) => {
    const result = [];
    for (let current = node; current; current = current.parentElement) {
      const s = getComputedStyle(current);
      result.push({ ...describe(current), display: s.display, visibility: s.visibility,
        opacity: s.opacity, pointerEvents: s.pointerEvents, overflowX: s.overflowX,
        overflowY: s.overflowY, position: s.position, hidden: current.hidden,
        ariaHidden: current.getAttribute('aria-hidden'), inert: current.hasAttribute('inert'),
        scrollTop: current.scrollTop, scrollHeight: current.scrollHeight, clientHeight: current.clientHeight });
    }
    return result;
  };
  const active = (chain) => chain.every((a) => !a.hidden && !a.inert && a.ariaHidden !== 'true' &&
    a.display !== 'none' && !['hidden', 'collapse'].includes(a.visibility) && Number(a.opacity) > 0 && a.pointerEvents !== 'none');
  const tabs = [...document.querySelectorAll('[role="tab"]')].map((node) => ({ ...describe(node),
    selected: node.getAttribute('aria-selected'), active: active(ancestors(node)) }));
  const routeActive = location.pathname === '/shelf' && document.visibilityState === 'visible' &&
    tabs.filter((tab) => tab.active && tab.selected === 'true').length === 1 &&
    tabs.some((tab) => tab.active && tab.selected === 'true' && tab.label === 'Shelf');
  const controls = [...document.querySelectorAll('button,[role],a,label')];
  const filters = controls.filter((node) => ['All', 'Actives', 'Expiring'].includes(describe(node).label))
    .map((node) => ({ ...describe(node), active: active(ancestors(node)), pressed: node.getAttribute('aria-pressed') }));
  const matching = controls.filter((node) => [node.getAttribute('aria-label'), node.getAttribute('accessibilitylabel'),
    node.textContent, node.getAttribute('title')].some((value) => normalize(value).includes(name)));
  const owned = matching.filter((node) => {
    const d = describe(node);
    return d.role === 'button' && d.label.startsWith(name + ', ') && d.label.length > name.length + 2 &&
      (label === null || d.label === label) && active(ancestors(node));
  });
  const selected = owned.length === 1 ? owned[0] : null;
  let scrolled = false;
  if (scroll && routeActive && selected && filters.filter((f) => f.active && f.pressed === 'true').length === 1 &&
      filters.some((f) => f.active && f.label === 'All' && f.pressed === 'true')) {
    for (let p = selected.parentElement; p; p = p.parentElement) {
      const style = getComputedStyle(p);
      if (!/(auto|scroll)/.test(style.overflowY) || p.scrollHeight <= p.clientHeight) continue;
      const r = box(p);
      p.scrollTop += box(selected).y - (Math.max(0, r.top) + Math.min(innerHeight, r.bottom)) / 2;
      scrolled = true;
      break;
    }
  }
  const candidates = matching.map((node) => {
    const r = box(node), chain = ancestors(node);
    const clip = { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
    for (const a of chain.slice(1)) {
      if (/(auto|hidden|scroll|clip)/.test(a.overflowX)) {
        clip.left = Math.max(clip.left, a.rect.left); clip.right = Math.min(clip.right, a.rect.right);
      }
      if (/(auto|hidden|scroll|clip)/.test(a.overflowY)) {
        clip.top = Math.max(clip.top, a.rect.top); clip.bottom = Math.min(clip.bottom, a.rect.bottom);
      }
    }
    const hit = document.elementFromPoint(r.x, r.y), hitChain = [];
    for (let p = hit; p; p = p.parentElement) hitChain.push(describe(p));
    const points = [[r.x, r.y], [r.left + 4, r.top + 4], [r.right - 4, r.top + 4],
      [r.left + 4, r.bottom - 4], [r.right - 4, r.bottom - 4]];
    const pointHits = points.map(([x, y]) => {
      const root = document.elementFromPoint(x, y);
      return { x, y, root: describe(root), owned: root !== null && (root === node || node.contains(root)) };
    });
    return { ...describe(node), ancestors: chain, active: active(chain), clip,
      scrollContainer: chain.slice(1).find((a) => /(auto|scroll)/.test(a.overflowY) && a.scrollHeight > a.clientHeight) ?? null,
      disabled: node.disabled === true || node.getAttribute('aria-disabled') === 'true',
      fullyVisible: r.width >= 44 && r.height >= 44 && r.left >= clip.left && r.right <= clip.right &&
        r.top >= clip.top && r.bottom <= clip.bottom,
      hitRoot: describe(hit), hitChain, pointHits, hitOwned: pointHits.every((p) => p.owned), selected: node === selected };
  });
  return { at: new Date().toISOString(), path: location.pathname, routeActive, tabs, filters,
    viewport: { width: innerWidth, height: innerHeight, deviceScaleFactor: devicePixelRatio },
    exactCandidates: owned.length, candidates, target: candidates.find((c) => c.selected) ?? null, scrolled };
}

export function selectShelfTarget37(snapshot, requireHit = true) {
  assert(snapshot?.path === '/shelf' && snapshot.routeActive === true, 'Shelf route is not foreground.');
  assert(snapshot.exactCandidates === 1 && snapshot.target?.role === 'button' && snapshot.target.active === true,
    'Shelf product needs exactly one active accessible button.');
  assert(snapshot.filters?.filter((f) => f.active && f.pressed === 'true').length === 1 &&
    snapshot.filters.some((f) => f.active && f.label === 'All' && f.pressed === 'true'),
  'Shelf All filter changed before the product tap.');
  const target = snapshot.target;
  assert(target.disabled === false, 'Shelf product is disabled.');
  if (requireHit) assert(target.fullyVisible === true && target.hitOwned === true &&
    Number.isFinite(target.rect?.x) && Number.isFinite(target.rect?.y),
  'Shelf product is offscreen, clipped or occluded; touch refused.');
  return target;
}

export async function tapOwnedShelfProduct37({ name, expectedNames, inspect, scroll, readAuthority,
  send, waitForDetail, record }) {
  let last = null;
  const observe = async (stage, operation) => {
    last = await operation(); await record(stage, last); return last;
  };
  try {
    const before = await readAuthority();
    const guard = (receipt) => {
      assertFreeFirstSession35(receipt, expectedNames);
      assert(receipt.persistedOff === true && before.authority37 !== null &&
        typeof before.authority37 === 'object' && Number.isSafeInteger(before.authority37.generation) &&
        before.authority37.generation > 0 && Number.isSafeInteger(before.authority37.epoch) && before.authority37.epoch > 0 &&
        /^[a-f0-9]{64}$/.test(before.authority37.ownerBinding) &&
        JSON.stringify(receipt.authority37) === JSON.stringify(before.authority37),
      'Shelf owner/consent epoch or saved OFF choice changed.');
      const products = receipt.productIds37?.filter((p) => p.name === name);
      assert(products?.length === 1 && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(products[0].id),
        'Shelf has no unique current owned product identity.');
      return products[0].id;
    };
    const id = guard(before);
    const initial = selectShelfTarget37(await observe('before-scroll', () => inspect(null)), false);
    await observe('scrolled', () => scroll(initial.label));
    const current = await readAuthority();
    assert(guard(current) === id, 'Shelf product identity changed after scrolling.');
    const target = selectShelfTarget37(await observe('pre-touch', () => inspect(initial.label)));
    assert(target.label === initial.label && target.label.startsWith(name + ', '), 'Shelf product accessible name changed.');
    const start = { type: 'touchStart', touchPoints: [{ force: 1, id: 1, radiusX: 2, radiusY: 2,
      x: target.rect.x, y: target.rect.y }] };
    await record('dispatch-touchStart', { at: new Date().toISOString(), ...start });
    await send('Input.dispatchTouchEvent', start);
    const end = { type: 'touchEnd', touchPoints: [] };
    await record('dispatch-touchEnd', { at: new Date().toISOString(), ...end });
    await send('Input.dispatchTouchEvent', end);
    const outcome = await waitForDetail('/shelf/' + id);
    assert(outcome?.path === '/shelf/' + id, 'Shelf touch did not open the exact owned product.');
    assert(guard(await readAuthority()) === id, 'Shelf detail lost its product authority.');
    await record('detail-arrived', outcome);
    return outcome;
  } catch (error) {
    await record('refused', { at: new Date().toISOString(), error: error.message, last });
    throw error;
  }
}

async function observeFirstSession35(client, expectedOwnerBinding, includeProducts = false) {
  return evaluate(client, `(async () => {
    const mod = (suffix) => {
      const m = [...__r.getModules().values()].find(m => (m.verboseName ?? '').replaceAll('\\\\', '/').endsWith(suffix));
      if (!m?.publicModule?.exports) throw new Error('Missing loaded observation module: ' + suffix);
      return m.publicModule.exports;
    };
    const health = mod('/lib/consent/healthProcessingEpoch.ts');
    const ownership = mod('/lib/auth/sessionOwner.ts');
    const lease = health.activeHealthProcessingLeaseSnapshot();
    const proof = await ownership.readLocalDataOwnerProof();
    const binding = lease?.ownerUserId ? await ownership.localDataOwnerBinding(lease.ownerUserId) : null;
    const sameOwner = binding !== null && proof.kind === 'owned' && proof.ownerBinding === binding &&
      (${JSON.stringify(expectedOwnerBinding)} === null || binding === ${JSON.stringify(expectedOwnerBinding)});
    const raw = await mod('/lib/storage/privateKV.ts').getPrivateItem('layerwell.notifPrefs.v1');
    const saved = raw === null ? null : JSON.parse(raw);
    const purposes = ['amEnabled','pmEnabled','captureReminders','streakNudges','replenishmentAlerts','liveActivityEnabled','promotionalOptIn'];
    const result = { sameOwner, currentConsent: lease !== null && health.activeHealthProcessingLeaseSnapshot() === lease,
      persistedOff: saved?.version === 1 && purposes.every(key => saved.prefs?.[key] === false),
      authority37: lease ? { generation: lease.generation, epoch: lease.epoch, ownerBinding: lease.ownerBinding,
        accountGeneration: lease.accountGeneration, identityGeneration: lease.identityGeneration } : null };
    if (${includeProducts}) {
      const products = await mod('/features/shelf/store.ts').loadShelf();
      const entitlement = await mod('/features/subscription/store.ts').readEntitlementCache();
      result.proActive = entitlement.status === 'absent' ? false : entitlement.status === 'available'
        ? mod('/features/subscription/entitlement.ts').deriveState(entitlement.entitlement, new Date().toISOString()).isPro : null;
      result.products = products.map(product => product.name);
      result.productIds37 = products.map(product => ({ name: product.name, id: product.id }));
      result.currentConsent = result.currentConsent && health.activeHealthProcessingLeaseSnapshot() === lease;
    }
    return ${JSON.stringify(expectedOwnerBinding)} === null ? { ...result, binding } : result;
  })()`, true);
}

function clearPreviousEvidence() {
  assert(
    readdirSync(evidenceDir).length === 0,
    'Use a fresh evidence directory; prior evidence is immutable.',
  );
  for (const entry of readdirSync(evidenceDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    if (!/\.(?:json|log|md|png)$/i.test(entry.name)) continue;
    rmSync(path.join(evidenceDir, entry.name), { force: true });
  }
}

function browserPathCandidates() {
  return [
    process.env.CHROME_PATH,
    process.env.BROWSER_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/microsoft-edge',
  ].filter(Boolean);
}

function findBrowserPath() {
  const candidate = browserPathCandidates().find((item) => item && existsSync(item));
  if (!candidate) {
    throw new Error(
      'Could not find Chrome or Edge. Set CHROME_PATH or BROWSER_PATH to run onboarding E2E.',
    );
  }
  return candidate;
}

async function waitForUrl(url, timeoutMs = 120_000) {
  const startedAt = Date.now();
  let lastError = null;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, { redirect: 'manual' });
      if (response.status < 500) return;
    } catch (error) {
      lastError = error;
    }

    await delay(500);
  }

  throw new Error(`Timed out waiting for ${url}: ${lastError?.message ?? 'no response'}`);
}

async function readJson(url, timeoutMs = 30_000) {
  const startedAt = Date.now();
  let lastError = null;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return await response.json();
    } catch (error) {
      lastError = error;
    }

    await delay(250);
  }

  throw new Error(`Timed out reading ${url}: ${lastError?.message ?? 'no response'}`);
}

async function stopProcess(child) {
  if (!child?.pid) return;

  const detach = () => {
    child.stdout?.removeAllListeners('data');
    child.stderr?.removeAllListeners('data');
    child.stdout?.destroy?.();
    child.stderr?.destroy?.();
    child.stdin?.destroy?.();
    child.unref?.();
  };

  if (child.exitCode !== null) {
    detach();
    return;
  }

  const waitForExit = (timeoutMs) =>
    Promise.race([
      new Promise((resolve) => child.once('exit', () => resolve(true))),
      delay(timeoutMs).then(() => false),
    ]);

  if (!isWindows) {
    child.kill('SIGTERM');
    await waitForExit(500);
    if (child.exitCode === null) child.kill('SIGKILL');
    await waitForExit(500);
    detach();
    return;
  }

  await Promise.race([
    new Promise((resolve) => {
      const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      });
      killer.once('exit', resolve);
      killer.once('error', resolve);
    }),
    delay(3_000),
  ]);
  if (child.exitCode === null) child.kill('SIGKILL');
  await waitForExit(1_000);
  detach();
}

async function removeBrowserProfile(userDataDir) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      rmSync(userDataDir, { force: true, maxRetries: 2, recursive: true, retryDelay: 150 });
      return;
    } catch (error) {
      if (attempt === 3) {
        process.stderr.write(
          `Warning: browser profile cleanup deferred for ${userDataDir}: ${error.message}\n`,
        );
        return;
      }
      await delay(250);
    }
  }
}

function startExpoServer() {
  const command = isWindows ? (process.env.ComSpec ?? 'cmd.exe') : 'npm';
  const args = isWindows
    ? [
        '/d',
        '/s',
        '/c',
        `npm --workspace apps/mobile run web -- --port ${appPort} --host localhost`,
      ]
    : [
        '--workspace',
        'apps/mobile',
        'run',
        'web',
        '--',
        '--port',
        String(appPort),
        '--host',
        'localhost',
      ];
  const serverEnvironment = { ...process.env };
  for (const key of Object.keys(serverEnvironment)) {
    const credentialNamed =
      /(?:TOKEN|SECRET|PASSWORD|PASSCODE|API[_-]?KEY|AUTHORIZATION|COOKIE|PRIVATE[_-]?KEY|DSN)(?:_|$)/iu.test(
        key,
      );
    if (key.startsWith('EXPO_PUBLIC_') || credentialNamed) delete serverEnvironment[key];
  }
  const child = spawn(command, args, {
    cwd: repoRoot,
    env: {
      ...serverEnvironment,
      BROWSER: 'none',
      CI: '1',
      EXPO_NO_DOTENV: '1',
      EXPO_PUBLIC_APP_ENV: 'development',
      EXPO_PUBLIC_E2E_APP_LOCK_ENABLED: 'false',
      ...(!accountIsolationMode ? { EXPO_PUBLIC_E2E_FIRST_SESSION_AUTH: 'anonymous_owner' } : {}),
      ...(accountUpgradeMode ? { EXPO_PUBLIC_E2E_ACCOUNT_UPGRADE: 'email_same_user' } : {}),
      ...(accountIsolationMode
        ? {
            EXPO_PUBLIC_E2E_ACCOUNT_ISOLATION: crossOwnerMode
              ? 'cross_owner'
              : 'signout_clear_retry',
          }
        : {}),
      ...(deletionRecoveryMode
        ? { EXPO_PUBLIC_E2E_ACCOUNT_DELETION_RECOVERY: deletionRecoveryMode }
        : {}),
      EXPO_PUBLIC_E2E_LOCAL_RESET: '1',
      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '__BLOCKED_PLACEHOLDER__',
      EXPO_PUBLIC_SUPABASE_URL: 'https://blocked-supabase-url.invalid',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  const logPath = path.join(evidenceDir, 'expo-web.log');
  const logLines = [];
  const append = (chunk) => {
    logLines.push(chunk.toString());
    writeFileSync(logPath, logLines.join(''));
  };
  child.stdout.on('data', append);
  child.stderr.on('data', append);

  return child;
}

function startBrowser(browserPath, userDataDir) {
  return spawn(
    browserPath,
    [
      '--headless=new',
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${userDataDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-networking',
      '--disable-extensions',
      '--disable-sync',
      '--hide-scrollbars',
      'about:blank',
    ],
    {
      stdio: 'ignore',
      windowsHide: true,
    },
  );
}

class CdpClient {
  constructor(wsUrl) {
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
    this.ws = new WebSocket(wsUrl);
    this.ready = new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
    this.ws.addEventListener('message', (event) => this.handleMessage(event));
  }

  handleMessage(event) {
    const message = JSON.parse(event.data.toString());

    if (message.id && this.pending.has(message.id)) {
      const { reject, resolve } = this.pending.get(message.id);
      this.pending.delete(message.id);

      if (message.error) {
        reject(new Error(`${message.error.message}: ${message.error.data ?? ''}`));
      } else {
        resolve(message.result ?? {});
      }
      return;
    }

    if (message.method === 'Debugger.paused') {
      const rows = this.events.filter((event) => event.method === 'diagnostic.exception');
      this.events.push({
        method: 'diagnostic.exception',
        params: {
          description: message.params.data?.description?.slice(0, 2000),
          frames: message.params.callFrames.slice(0, 8).map((frame) => ({
            functionName: frame.functionName,
            location: frame.location,
          })),
        },
      });
      if (rows.length < 100)
        writeJson(
          'exceptions.json',
          this.events.filter((e) => e.method === 'diagnostic.exception'),
        );
      void this.send('Debugger.resume');
      return;
    }
    if (message.method) this.events.push(message);
  }

  async send(method, params = {}) {
    await this.ready;
    const id = this.nextId;
    this.nextId += 1;
    const payload = JSON.stringify({ id, method, params });

    return await new Promise((resolve, reject) => {
      this.pending.set(id, { reject, resolve });
      this.ws.send(payload);
    });
  }

  close() {
    this.ws.close();
  }
}

async function connectToPage() {
  const targets = await readJson(`http://127.0.0.1:${debugPort}/json`);
  const pageTarget = targets.find(
    (target) => target.type === 'page' && target.webSocketDebuggerUrl,
  );
  if (!pageTarget) throw new Error('Could not find a debuggable browser page.');
  const client = new CdpClient(pageTarget.webSocketDebuggerUrl);
  await client.ready;
  return client;
}

async function evaluate(client, expression, awaitPromise = false) {
  const result = await client.send('Runtime.evaluate', {
    awaitPromise,
    expression,
    returnByValue: true,
  });

  if (result.exceptionDetails) {
    throw new Error(
      result.exceptionDetails.exception?.description ??
        result.exceptionDetails.text ??
        'Runtime.evaluate failed',
    );
  }

  return result.result?.value;
}

async function waitForCondition(client, expression, timeoutMs, label) {
  const startedAt = Date.now();
  let lastError = null;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      if (await evaluate(client, expression)) return;
    } catch (error) {
      lastError = error;
    }

    await delay(250);
  }

  throw new Error(`Timed out waiting for ${label}: ${lastError?.message ?? 'condition false'}`);
}

function textCondition(text) {
  return `document.body && document.body.innerText.includes(${JSON.stringify(text)})`;
}

async function waitForText(client, text, timeoutMs = 30_000) {
  await waitForCondition(client, textCondition(text), timeoutMs, `text "${text}"`);
}

async function waitForPath(client, pathOrPrefix, timeoutMs = 30_000) {
  await waitForCondition(
    client,
    `window.location.pathname.startsWith(${JSON.stringify(pathOrPrefix)})`,
    timeoutMs,
    `path ${pathOrPrefix}`,
  );
}

function rectByTextExpression(label, exact) {
  return `(() => {
    const label = ${JSON.stringify(label)};
    const exact = ${JSON.stringify(exact)};
    const normalize = (value) => String(value ?? '').replace(/\\s+/g, ' ').trim();
    const visible = (node) => {
      if (!(node instanceof Element)) return false;
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity || '1') > 0;
    };
    const textMatches = (text) => exact ? text === label : text.includes(label);
    const nodes = Array.from(document.querySelectorAll('button,[role="button"],[role="tab"],[role="checkbox"],[role="radio"],a,label'));
    const matches = [];
    for (const node of nodes) {
      if (!visible(node)) continue;
      const values = [
        node.getAttribute('aria-label'),
        node.getAttribute('accessibilitylabel'),
        node.textContent,
        node.getAttribute('title'),
      ].map(normalize).filter(Boolean);
      if (!values.some(textMatches)) continue;
      const rect = node.getBoundingClientRect();
      matches.push({
        ariaDisabled: node.getAttribute('aria-disabled'),
        disabled: Boolean(node.disabled),
        height: rect.height,
        label: values[0],
        text: normalize(node.textContent),
        width: rect.width,
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      });
    }
    matches.sort((a, b) => {
      const aIn = a.x >= 0 && a.x <= innerWidth && a.y >= 0 && a.y <= innerHeight ? 0 : 1;
      const bIn = b.x >= 0 && b.x <= innerWidth && b.y >= 0 && b.y <= innerHeight ? 0 : 1;
      if (aIn !== bIn) return aIn - bIn;
      return a.width * a.height - b.width * b.height;
    });
    return matches[0] ?? null;
  })()`;
}

async function clickByText(client, label, { exact = true, timeoutMs = 30_000 } = {}) {
  const startedAt = Date.now();
  let rect = null;

  while (Date.now() - startedAt < timeoutMs) {
    rect = await evaluate(client, rectByTextExpression(label, exact));
    if (rect && rect.disabled !== true && rect.ariaDisabled !== 'true') break;
    await delay(250);
  }

  assert(rect, `Could not find visible clickable text: ${label}`);
  assert(
    rect.disabled !== true && rect.ariaDisabled !== 'true',
    `Clickable text is disabled: ${label}`,
  );

  await client.send('Input.dispatchTouchEvent', {
    touchPoints: [{ force: 1, id: 1, radiusX: 2, radiusY: 2, x: rect.x, y: rect.y }],
    type: 'touchStart',
  });
  await client.send('Input.dispatchTouchEvent', {
    touchPoints: [],
    type: 'touchEnd',
  });
  await delay(250);
  return rect;
}

function scrollTextIntoViewExpression(label, exact) {
  return `(() => {
    const label = ${JSON.stringify(label)};
    const exact = ${JSON.stringify(exact)};
    const normalize = (value) => String(value ?? '').replace(/\\s+/g, ' ').trim();
    const visible = (node) => {
      if (!(node instanceof Element)) return false;
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity || '1') > 0;
    };
    const textMatches = (text) => exact ? text === label : text.includes(label);
    const nodes = Array.from(document.querySelectorAll('button,[role="button"],[role="tab"],[role="checkbox"],[role="radio"],a,label'));
    const target = nodes.find((node) => {
      if (!visible(node)) return false;
      const values = [
        node.getAttribute('aria-label'),
        node.getAttribute('accessibilitylabel'),
        node.textContent,
        node.getAttribute('title'),
      ].map(normalize).filter(Boolean);
      return values.some(textMatches);
    });
    if (!target) return null;
    target.scrollIntoView({ block: 'center', inline: 'nearest' });
    const rect = target.getBoundingClientRect();
    return {
      height: rect.height,
      label: normalize(target.getAttribute('aria-label') || target.textContent),
      text: normalize(target.textContent),
      width: rect.width,
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  })()`;
}

async function scrollTextIntoView(client, label, { exact = true, timeoutMs = 30_000 } = {}) {
  const startedAt = Date.now();
  let rect = null;

  while (Date.now() - startedAt < timeoutMs) {
    rect = await evaluate(client, scrollTextIntoViewExpression(label, exact));
    if (rect) break;
    await delay(250);
  }

  assert(rect, `Could not find text to scroll into view: ${label}`);
  await delay(350);
  return rect;
}

function fillExpression(label, value) {
  return `(() => {
    const label = ${JSON.stringify(label)};
    const value = ${JSON.stringify(value)};
    const normalize = (next) => String(next ?? '').replace(/\\s+/g, ' ').trim();
    const visible = (node) => {
      if (!(node instanceof Element)) return false;
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity || '1') > 0;
    };
    const controls = Array.from(document.querySelectorAll('input,textarea'));
    const target = controls.find((node) => {
      if (!visible(node)) return false;
      const values = [
        node.getAttribute('aria-label'),
        node.getAttribute('accessibilitylabel'),
        node.getAttribute('placeholder'),
      ].map(normalize);
      return values.includes(label);
    });
    if (!target) return null;
    target.focus();
    const prototype = target instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    if (setter) setter.call(target, value);
    else target.value = value;
    target.dispatchEvent(new InputEvent('input', { bubbles: true, data: value, inputType: 'insertText' }));
    target.dispatchEvent(new Event('change', { bubbles: true }));
    const rect = target.getBoundingClientRect();
    return { height: rect.height, value: target.value, width: rect.width, x: rect.left, y: rect.top };
  })()`;
}

async function fillByLabel(client, label, value) {
  const result = await evaluate(client, fillExpression(label, value));
  assert(result, `Could not find input with label or placeholder: ${label}`);
  assert(result.value === value, `Input "${label}" did not receive expected value.`);
  await delay(150);
  return result;
}

function auditExpression() {
  return `(() => {
    const normalize = (value) => String(value ?? '').replace(/\\s+/g, ' ').trim();
    const viewport = { height: innerHeight, width: innerWidth };
    const doc = document.documentElement;
    const body = document.body;
    const overflowX = Math.max(0, doc.scrollWidth - innerWidth, body.scrollWidth - innerWidth);
    const visible = (node) => {
      if (!(node instanceof Element)) return false;
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight && style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity || '1') > 0;
    };
    const visibleBounds = (node, rect) => {
      let left = Math.max(0, rect.left);
      let right = Math.min(innerWidth, rect.right);
      let top = Math.max(0, rect.top);
      let bottom = Math.min(innerHeight, rect.bottom);
      for (let ancestor = node.parentElement; ancestor; ancestor = ancestor.parentElement) {
        const style = getComputedStyle(ancestor);
        if (!/(auto|hidden|scroll|clip)/.test(style.overflow + style.overflowX + style.overflowY)) continue;
        const bounds = ancestor.getBoundingClientRect();
        left = Math.max(left, bounds.left);
        right = Math.min(right, bounds.right);
        top = Math.max(top, bounds.top);
        bottom = Math.min(bottom, bounds.bottom);
      }
      return { bottom, left, right, top };
    };
    const nodes = Array.from(document.querySelectorAll('button,[role="button"],[role="tab"],[role="checkbox"],[role="radio"],a,input,textarea,select'));
    const controls = [];
    const issues = [];

    for (const node of nodes) {
      if (!visible(node)) continue;
      const rect = node.getBoundingClientRect();
      const bounds = visibleBounds(node, rect);
      if (bounds.right <= bounds.left || bounds.bottom <= bounds.top) continue;
      const label = normalize(
        node.getAttribute('aria-label') ||
          node.getAttribute('accessibilitylabel') ||
          node.textContent ||
          node.getAttribute('placeholder') ||
          node.value,
      );
      if (!label) continue;
      const disabled = Boolean(node.disabled) || node.getAttribute('aria-disabled') === 'true';
      const center = {
        x: Math.max(0, Math.min(innerWidth - 1, bounds.left + (bounds.right - bounds.left) / 2)),
        y: Math.max(0, Math.min(innerHeight - 1, bounds.top + (bounds.bottom - bounds.top) / 2)),
      };
      const hit = document.elementFromPoint(center.x, center.y);
      const hitOk = !hit || node === hit || node.contains(hit) || hit.contains(node);
      const item = {
        disabled,
        height: Number(rect.height.toFixed(2)),
        hitOk,
        label,
        role: node.getAttribute('role') || node.tagName.toLowerCase(),
        selected: node.getAttribute('aria-selected') === 'true',
        width: Number(rect.width.toFixed(2)),
        x: Number(rect.left.toFixed(2)),
        y: Number(rect.top.toFixed(2)),
      };
      controls.push(item);
      // Partial vertical controls are expected while a user scrolls a short
      // viewport; horizontal clipping still indicates a responsive defect.
      if (rect.left < -1 || rect.right > innerWidth + 1) {
        issues.push({ control: item, type: 'clippedVisibleControl' });
      }
      if ((rect.width < 44 || rect.height < 44) && !disabled) {
        issues.push({ control: item, type: 'sub44VisibleControl' });
      }
      if (!hitOk && !disabled) {
        issues.push({ control: item, type: 'blockedCenterHitTest' });
      }
    }

    if (overflowX > 1) issues.push({ overflowX, type: 'horizontalOverflow' });

    return {
      bodyText: normalize(document.body?.innerText).slice(0, 5000),
      controls,
      issueCount: issues.length,
      issues,
      overflowX,
      title: document.title,
      url: window.location.href,
      viewport,
    };
  })()`;
}

function writeJson(name, value) {
  writeFileSync(path.join(evidenceDir, name), `${JSON.stringify(value, null, 2)}\n`);
}

async function screenshot(client, name) {
  const result = await client.send('Page.captureScreenshot', {
    captureBeyondViewport: false,
    format: 'png',
  });
  writeFileSync(path.join(evidenceDir, `${name}.png`), Buffer.from(result.data, 'base64'));
}

async function navigateClientSide(client, pathname) {
  await client.send('Runtime.evaluate', {
    awaitPromise: true,
    expression: `(() => {
      const navigate = globalThis.__LAYERWELL_E2E_NAVIGATE__;
      if (typeof navigate !== 'function') throw new Error('Account-isolation E2E navigator unavailable.');
      navigate(${JSON.stringify(pathname)});
    })()`,
    returnByValue: true,
  });
}

async function captureStep(client, name, { assertClean = true } = {}) {
  await delay(250);
  const snapshot = await evaluate(client, auditExpression());
  writeJson(`${name}.json`, snapshot);
  await screenshot(client, name);
  assertNoUncaughtErrors(snapshot, client.events);
  if (assertClean) {
    assert(snapshot.overflowX <= 1, `${name} has horizontal overflow: ${snapshot.overflowX}px`);
    assert(
      snapshot.issueCount === 0,
      `${name} has ${snapshot.issueCount} visible control issue(s).`,
    );
  }
  return snapshot;
}

function assertInteractiveControl(snapshot, label) {
  const control = snapshot.controls.find((item) => item.label.includes(label));
  assert(control, `${snapshot.url} did not expose an interactive control labeled ${label}.`);
  assert(control.hitOk, `${label} center is not hittable at ${snapshot.url}.`);
  assert(control.width >= 44, `${label} control is too narrow: ${control.width}px.`);
  assert(control.height >= 44, `${label} control is too short: ${control.height}px.`);
}

function collectProblemLogs(events) {
  return events
    .filter((event) => {
      if (event.method === 'Runtime.consoleAPICalled') {
        return ['error', 'warning'].includes(event.params.type);
      }

      if (event.method === 'Log.entryAdded') {
        return ['error', 'warning'].includes(event.params.entry.level);
      }

      return event.method === 'Runtime.exceptionThrown';
    })
    .map((event) => ({
      method: event.method,
      params: event.params,
    }));
}

async function answerQuiz(client, prefix = '') {
  const answers = [
    'Shiny in places',
    'Rarely',
    'Often stings, burns, or reddens',
    'Frequently',
    'Yes, noticeably',
    'Weeks or longer',
    'Fine lines or firmness changes are visible',
    'A lot over time',
    'Sometimes burns',
    'Tone 4',
    'None that I know of',
    'No',
  ];

  for (const [index, answer] of answers.entries()) {
    await waitForText(client, answer);
    if (index === 0) await captureStep(client, prefix + '07-quiz-01');
    await clickByText(client, answer);
    if (index === 3) await captureStep(client, prefix + '08-quiz-after-04');
    if (index === 8) {
      await scrollTextIntoView(client, 'Does not burn');
      await captureStep(client, prefix + '08-quiz-after-09');
    }
    if (index === 10) await captureStep(client, prefix + '08-quiz-after-11');
    await clickByText(client, index < answers.length - 1 ? 'Next' : 'See my profile');
  }
}

async function addProduct(client, product, evidenceName) {
  await fillByLabel(client, 'Product name', product.name);
  const compactCategoryPicker = await evaluate(
    client,
    rectByTextExpression('Choose product category', false),
  );
  if (compactCategoryPicker) {
    await clickByText(client, 'Choose product category', { exact: false });
    await waitForText(client, 'Product category');
    await clickByText(client, product.category);
  } else {
    await scrollTextIntoView(client, product.category);
    await clickByText(client, product.category);
  }
  await clickByText(client, 'Add to shelf');
  await waitForText(client, 'When did you open it?');
  await clickByText(client, 'Just opened it');
  await scrollTextIntoView(client, 'Add to shelf');
  await clickByText(client, 'Add to shelf');
  await waitForText(client, product.name);
  return await captureStep(client, evidenceName);
}

async function retainedRoute(client, pathname) {
  // Normal web router history event; no provider, lease or consent injection.
  await evaluate(
    client,
    `(() => { history.pushState({}, '', ${JSON.stringify(pathname)}); dispatchEvent(new PopStateEvent('popstate')); })()`,
  );
  await waitForPath(client, pathname.split('?')[0]);
}

// Same portable runner and real UI. Only the Auth/preflight transport and
// native-I/O settlement timing are synthetic; all authority is application code.
async function crossOwnerFlow(client, products) {
  const aMarkers = [
    ...products.map((p) => p.name),
    'tas.account-a.e2e@example.com',
    '00000000-0000-4000-8000-0000000000a1',
    'late-owner-a',
    'M102 synthetic moisturizer',
  ];
  const bName = 'Owner B manual moisturizer';
  const moduleExpression = `(suffix) => {
    const m = [...__r.getModules().values()].find(m => (m.verboseName ?? '').replaceAll('\\\\', '/').endsWith(suffix));
    if (!m?.publicModule?.exports) throw new Error('Missing loaded module: ' + suffix);
    return m.publicModule.exports;
  }`;
  await navigateClientSide(client, '/you');
  await waitForText(client, 'tas.account-a.e2e@example.com');
  await captureStep(client, 'CO-01-owner-a', { assertClean: false });
  // Observe rendered mutations and animation frames after the neutral boundary
  // first appears. Record booleans only, never private records or bearer values.
  await evaluate(
    client,
    `(() => {
    const markers = ${JSON.stringify(aMarkers)};
    const state = globalThis.__crossOwnerObserved = { closed: false, samples: 0, leaks: 0 };
    const sample = () => {
      const text = document.body.innerText;
      if (/Securing account data|Account access paused/.test(text)) state.closed = true;
      if (state.closed) { state.samples++; if (markers.some(x => text.includes(x))) state.leaks++; }
    };
    new MutationObserver(sample).observe(document.body, { subtree: true, childList: true, characterData: true });
    const frame = () => { sample(); requestAnimationFrame(frame); }; requestAnimationFrame(frame);
  })()`,
  );
  await evaluate(
    client,
    `(async () => {
    const mod = ${moduleExpression};
    const kv = mod('/lib/storage/privateKV.ts');
    const gen = mod('/lib/auth/accountGeneration.ts');
    const query = mod('/lib/query/queryClient.ts').queryClient;
    const storageModule = [...__r.getModules().values()].find(m => /async-storage/.test(m.verboseName ?? '') && m.publicModule?.exports?.default?.multiGet);
    if (!storageModule) throw new Error('AsyncStorage module unavailable');
    const storage = storageModule.publicModule.exports.default;
    const originalGet = storage.getItem, originalSet = storage.setItem;
    const raw = await kv.getPrivateItem('layerwell.shelf.v1');
    const state = globalThis.__crossOwnerRace = { readEntered: false, writeEntered: false, results: null };
    let releaseRead, releaseWrite, releaseCallback;
    const readGate = new Promise(r => releaseRead = r), writeGate = new Promise(r => releaseWrite = r), callbackGate = new Promise(r => releaseCallback = r);
    storage.getItem = async function(key, ...rest) {
      const value = await originalGet.call(this, key, ...rest);
      if (key === 'layerwell.shelf.v1' && !state.readEntered) { state.readEntered = true; await readGate; }
      return value;
    };
    storage.setItem = async function(key, ...rest) {
      const result = await originalSet.call(this, key, ...rest);
      if (key === 'layerwell.shelf.v1' && !state.writeEntered) { state.writeEntered = true; await writeGate; }
      return result;
    };
    const result = p => p.then(() => 'UNEXPECTED_SUCCESS', e => String(e.code ?? e.message));
    const read = result(kv.getPrivateItem('layerwell.shelf.v1'));
    const lateValue = JSON.parse(raw);
    lateValue.products[0].name = 'late-owner-a';
    const write = result(kv.setPrivateItem('layerwell.shelf.v1', JSON.stringify(lateValue)));
    const callback = result(gen.runAccountGenerationOperation(async lease => {
      await callbackGate; lease.assertCurrent(); query.setQueryData(['late-owner-a'], 'late-owner-a');
    }));
    Promise.all([read, write, callback]).then(results => { state.results = results; });
    state.release = () => { storage.getItem = originalGet; storage.setItem = originalSet; releaseRead(); releaseWrite(); releaseCallback(); };
  })()`,
    true,
  );
  await waitForCondition(
    client,
    `__crossOwnerRace.readEntered && __crossOwnerRace.writeEntered`,
    15_000,
    'real A read/write entered native transport',
  );
  await evaluate(
    client,
    `(() => { __LAYERWELL_E2E_ACCOUNT_EVENT__('b'); __LAYERWELL_E2E_ACCOUNT_EVENT__('b'); })()`,
  );
  await waitForText(client, 'Securing account data');
  await captureStep(client, 'CO-02-draining-old-owner');
  const closed = await evaluate(
    client,
    `(() => {
    const mod = ${moduleExpression};
    return { healthClosed: mod('/lib/consent/healthProcessingEpoch.ts').activeHealthProcessingOwnerUserId() === null,
      remoteClosed: mod('/lib/supabase/remoteRequestGate.ts').supabaseRemoteRequestSnapshot().state !== 'active',
      commerceClosed: mod('/lib/iap/revenuecat.ts').accountPublicationSnapshot().state !== 'active' };
  })()`,
  );
  writeJson('CO-immediate-authority-closure.json', closed);
  assert(
    Object.values(closed).every((v) => v === true),
    'Old authority stayed open while A operations drained',
  );
  await evaluate(client, '__crossOwnerRace.release()');
  await waitForText(client, 'Account access paused');
  const refused = await captureStep(client, 'CO-03-cleanup-refused');
  assertInteractiveControl(refused, 'Try again');
  const races = await evaluate(client, '__crossOwnerRace.results');
  assertCrossOwnerRaceOutcomes(races);
  writeJson('cross-owner-races.json', {
    outcomes: races,
    interpretation:
      'Delayed A read, committed-write settlement/rollback, and queued callback rejected by real boundaries.',
  });
  await clickByText(client, 'Try again');
  await delay(1200);
  const repeated = await captureStep(client, 'CO-04-repeated-refusal');
  assert(
    repeated.bodyText.includes('Account access paused'),
    'Duplicate/retry escaped failed cleanup',
  );
  assertInteractiveControl(repeated, 'Try again');
  await clickByText(client, 'Try again');
  await waitForText(client, 'First, your');
  await captureStep(client, 'CO-05-b-age-required');
  // A's age and consent are gone. B must submit both through their forms.
  await fillByLabel(client, 'Day of birth', '01');
  await fillByLabel(client, 'Month of birth', '01');
  await fillByLabel(client, 'Year of birth', '1990');
  await clickByText(client, 'Continue');
  await waitForText(client, 'Before the quiz');
  await captureStep(client, 'CO-06-b-consent-required');
  await clickByText(client, 'I agree. Continue');
  await waitForText(client, 'What brings you here?');
  await clickByText(client, 'Clear skin', { exact: false });
  await scrollTextIntoView(client, 'Continue');
  await clickByText(client, 'Continue');
  await answerQuiz(client, 'CO-B-');
  await waitForText(client, "What's on your shelf?");
  const empty = await captureStep(client, 'CO-07-b-empty-shelf');
  assert(!aMarkers.some((x) => empty.bodyText.includes(x)), 'A content reached B onboarding');
  await addProduct(client, { category: 'Treatment', name: bName }, 'CO-08-b-manual-created');
  await scrollTextIntoView(client, 'Continue with 1 product');
  await clickByText(client, 'Continue with 1 product');
  await waitForText(client, 'YOUR SKIN PROFILE', 45_000);
  await clickByText(client, 'Continue');
  await waitForPath(client, '/onboarding/notifications');
  await clickByText(client, 'Not now');
  await waitForPath(client, '/onboarding/account');
  await clickByText(client, 'Not now');
  await waitForText(client, 'Continue with the free plan');
  await clickByText(client, 'Continue with the free plan', { exact: false });
  await waitForPath(client, '/today');
  await clickByText(client, 'Shelf');
  await waitForText(client, bName);
  const bShelf = await captureStep(client, 'CO-09-b-usable-shelf', { assertClean: false });
  assert(new URL(bShelf.url).pathname === '/shelf', 'B product interaction must target Shelf');
  // The mounted Today tab may contain a same-name checkbox. Bind the visible
  // Shelf product button by its complete accessible label, then hit-test it.
  const bProduct = bShelf.controls.find((control) =>
    control.role === 'button' && control.label.startsWith(`${bName},`));
  assert(bProduct, 'B Shelf product button is unavailable');
  assertInteractiveControl(bShelf, bProduct.label);
  await clickByText(client, bProduct.label);
  await scrollTextIntoView(client, 'Edit opened date');
  const bDetail = await captureStep(client, 'CO-09b-b-product-detail', { assertClean: false });
  assertInteractiveControl(bDetail, 'Edit opened date');
  await clickByText(client, 'Edit opened date');
  await clickByText(client, '1 mo ago');
  await captureStep(client, 'CO-10-b-usable-edit', { assertClean: false });
  await navigateClientSide(client, '/you');
  await waitForText(client, 'tas.account-b.e2e@example.com');
  await captureStep(client, 'CO-11-b-identity', { assertClean: false });
  const inspect = async (name) => {
    const state = await evaluate(
      client,
      `(async () => {
      const mod = ${moduleExpression};
      const owner = mod('/lib/auth/sessionOwner.ts');
      const proof = await owner.readLocalDataOwnerProof();
      const health = mod('/lib/consent/healthProcessingEpoch.ts');
      const queries = mod('/lib/query/queryClient.ts').queryClient.getQueryCache().getAll();
      const shelf = await mod('/lib/storage/privateKV.ts').getPrivateItem('layerwell.shelf.v1');
      const daily = await Promise.all(['layerwell.notifPrefs.v1', 'layerwell.completions.v1', 'layerwell.routineOrder.v1']
        .map(key => mod('/lib/storage/privateKV.ts').getPrivateItem(key)));
      const markers = [...${JSON.stringify(aMarkers)}, await owner.localDataOwnerBinding('00000000-0000-4000-8000-0000000000a1')];
      return { exactB: proof.kind === 'owned' && proof.ownerBinding === await owner.localDataOwnerBinding('00000000-0000-4000-8000-0000000000b2'),
        noRetainedADailyState: daily[1] === null && daily[2] === null &&
          daily[0] !== null && JSON.parse(daily[0]).prefs.amTime === '07:30' &&
          JSON.parse(daily[0]).prefs.amEnabled === false && JSON.parse(daily[0]).prefs.pmEnabled === false,
        healthOwnerB: health.activeHealthProcessingOwnerUserId() === '00000000-0000-4000-8000-0000000000b2',
        noAInCache: !markers.some(x => JSON.stringify(queries.map(q => [q.queryKey, q.state.data])).includes(x)),
        noAInShelfOrQueue: !markers.some(x => (shelf ?? '').includes(x)), hasB: shelf?.includes(${JSON.stringify(bName)}) === true,
        bEditPersisted: Date.parse(JSON.parse(shelf).products.find(p => p.name === ${JSON.stringify(bName)}).openedAt) < Date.now() - 20 * 86400000,
        ciphertextOnly: !(localStorage.getItem('layerwell.shelf.v1') ?? '').includes(${JSON.stringify(bName)}),
        noWidgetCapabilities: !localStorage.getItem('layerwell.widgetActionMap.v1') && !localStorage.getItem('layerwell.widgetActionMap.v2'),
        renderedObservation: globalThis.__crossOwnerObserved ?? null };
    })()`,
      true,
    );
    writeJson(name + '.json', state);
    for (const [key, value] of Object.entries(state))
      if (key !== 'renderedObservation') assert(value === true, `${name}: ${key}`);
    return state;
  };
  const liveState = await inspect('CO-b-boundaries');
  assert(
    liveState.renderedObservation.closed &&
      liveState.renderedObservation.samples > 10 &&
      liveState.renderedObservation.leaks === 0,
    'Observed old A flash during B transition',
  );
  // Activate another real browser tab to deliver visibility/AppState events.
  const backgroundTab = await client.send('Target.createTarget', { url: 'about:blank' });
  await client.send('Target.activateTarget', { targetId: backgroundTab.targetId });
  await waitForCondition(
    client,
    `document.visibilityState === 'hidden'`,
    15_000,
    'real browser background',
  );
  await client.send('Page.bringToFront');
  await waitForCondition(
    client,
    `document.visibilityState === 'visible'`,
    15_000,
    'real browser foreground',
  );
  await client.send('Target.closeTarget', { targetId: backgroundTab.targetId });
  await navigateClientSide(client, '/shelf');
  await waitForText(client, bName);
  await client.send('Page.reload', { ignoreCache: true });
  await waitForText(client, bName, 60_000);
  await captureStep(client, 'CO-12-b-document-relaunch', { assertClean: false });
  await inspect('CO-b-relaunch-boundaries');
  // Replacement back to A cannot resurrect A's deleted data or B's grants.
  await evaluate(client, `__LAYERWELL_E2E_ACCOUNT_EVENT__('a')`);
  await waitForText(client, 'Account access paused');
  await clickByText(client, 'Try again');
  await delay(1200);
  await waitForText(client, 'Account access paused');
  await clickByText(client, 'Try again');
  await waitForText(client, 'First, your');
  const returned = await captureStep(client, 'CO-13-return-a-age-closed');
  assert(
    ![...aMarkers, bName].some((x) => returned.bodyText.includes(x)),
    'Return transition resurrected private content',
  );
  await client.send('Page.reload', { ignoreCache: true });
  await waitForText(client, 'First, your', 60_000);
  await captureStep(client, 'CO-14-return-a-relaunch-closed');
  assert(
    await evaluate(client, `!localStorage.getItem('layerwell.shelf.v1')`),
    'Return A recovered old Shelf',
  );
  const logs = collectProblemLogs(client.events);
  writeJson('browser-warn-error-logs.json', logs);
  assert(logs.filter(disallowedLog).length === 0, 'Unexpected cross-owner browser error/warning');
  const summary = {
    verdict: 'pass',
    scenario: 'actual_cross_owner',
    viewport,
    noAFlash: true,
    delayedAOperationsRejected: true,
    duplicateAndFailedCleanupRetry: true,
    bOwnAdmission: true,
    bUsableManualShelfAndEdit: true,
    exactBOwnerCacheQueueHealth: true,
    bDocumentRelaunch: true,
    returnAClosedWithoutResurrection: true,
    noUncaughtErrors: true,
    limits:
      'DEV/web/development/unconfigured synthetic identity and preflight transport; real Auth reconciliation, owner proof, cleanup, encrypted storage/query, age/consent and routing. No live provider, paid authority, native process death or device proof.',
  };
  writeJson('summary.json', summary);
  console.log(`Cross-owner E2E passed. Evidence: ${evidenceDir}`);
}

async function retainedShelfFlow(client) {
  await retainedRoute(client, '/shelf/no-match?barcode=4006381333931');
  await waitForText(client, 'Add it by hand');
  await captureStep(client, 'M1-01-manual-fallback');
  await clickByText(client, 'Add it by hand', { exact: false });
  await waitForPath(client, '/shelf/manual');
  await fillByLabel(client, 'Product name', 'Synthetic manual moisturizer');
  await clickByText(client, 'Category');
  await clickByText(client, 'Category, Moisturiser (tube)');
  await clickByText(client, 'Continue');
  await waitForText(client, 'Not opened yet');
  await clickByText(client, 'Not opened yet');
  await scrollTextIntoView(client, 'Add to shelf');
  const manualReady = await captureStep(client, 'M1-01b-manual-ready', { assertClean: false });
  // The modal intentionally occludes its mounted background form. Check the
  // actionable modal control, retaining the full audit (including occlusion).
  assertInteractiveControl(manualReady, 'Add to shelf');
  assert(manualReady.overflowX <= 1, 'Manual modal overflowed horizontally.');
  await client.send('Network.emulateNetworkConditions', {
    offline: true,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  });
  const rect = await evaluate(client, rectByTextExpression('Add to shelf', true));
  assert(rect && !rect.disabled, 'Manual save must be reachable offline.');
  for (let n = 0; n < 2; n++) {
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: rect.x, y: rect.y, id: 1 }],
    });
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }
  await captureStep(client, 'M1-01c-after-double-submit', { assertClean: false });
  writeJson(
    'M1-offline-durable-read.json',
    await evaluate(
      client,
      `(async () => {
    const module = [...__r.getModules().values()].find(m => /lib[\\\\/]storage[\\\\/]privateKV\\.ts$/.test(m.verboseName ?? ''));
    if (!module) return { available: false };
    const raw = await module.publicModule.exports.getPrivateItem('layerwell.shelf.v1');
    const shelf = JSON.parse(raw);
    return { available: true, version: shelf.version, productCount: shelf.products.length,
      containsSyntheticManual: shelf.products.some(p => p.name === 'Synthetic manual moisturizer') };
  })()`,
      true,
    ),
  );
  await waitForPath(client, '/shelf');
  await waitForText(client, 'Synthetic manual moisturizer');
  await captureStep(client, 'M1-02-offline-double-save');
  const matches = await evaluate(
    client,
    `Array.from(document.querySelectorAll('[role="button"]')).filter(n => n.getAttribute('aria-label')?.startsWith('Synthetic manual moisturizer')).length`,
  );
  assert(matches === 1, `Double save rendered ${matches} manual rows.`);
  await scrollTextIntoView(client, 'Synthetic manual moisturizer', { exact: false });
  await clickByText(client, 'Synthetic manual moisturizer', { exact: false });
  await scrollTextIntoView(client, 'Edit opened date');
  await clickByText(client, 'Edit opened date');
  await clickByText(client, '1 mo ago');
  await captureStep(client, 'M1-03-offline-edit');
  await evaluate(
    client,
    `(() => { const original = Storage.prototype.setItem;
    globalThis.__M1_RESTORE_SYNTHETIC_WRITE__ = () => { Storage.prototype.setItem = original; delete globalThis.__M1_RESTORE_SYNTHETIC_WRITE__; };
    Storage.prototype.setItem = function(key, value) { if (key === 'layerwell.shelf.v1') throw new DOMException('Synthetic local write failure', 'QuotaExceededError'); return original.call(this, key, value); };
  })()`,
  );
  await clickByText(client, 'Edit opened date');
  await clickByText(client, 'Today');
  await waitForText(client, 'Your change was not confirmed.');
  await captureStep(client, 'M1-03b-write-failure-intent-retained', { assertClean: false });
  await evaluate(client, 'globalThis.__M1_RESTORE_SYNTHETIC_WRITE__()');
  await clickByText(client, 'Today');
  await waitForCondition(
    client,
    `!document.body.innerText.includes('Your change was not confirmed.')`,
    30_000,
    'write retry success',
  );
  await captureStep(client, 'M1-03c-write-retry', { assertClean: false });
  await clickByText(client, 'Mark finished');
  await waitForPath(client, '/shelf');
  await retainedRoute(client, '/shelf/archive');
  await waitForText(client, 'Synthetic manual moisturizer');
  await captureStep(client, 'M1-04-offline-archive');
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  });
  await client.send('Page.reload', { ignoreCache: true });
  await waitForText(client, 'Synthetic manual moisturizer', 60_000);
  await captureStep(client, 'M1-05-archive-relaunch');
  await retainedRoute(client, '/shelf');
  await scrollTextIntoView(client, 'Retinol 0.3% serum', { exact: false });
  await clickByText(client, 'Retinol 0.3% serum', { exact: false });
  await clickByText(client, 'More options');
  await evaluate(
    client,
    `(() => { const original = Storage.prototype.setItem;
    globalThis.__M1_RESTORE_SYNTHETIC_WRITE__ = () => { Storage.prototype.setItem = original; delete globalThis.__M1_RESTORE_SYNTHETIC_WRITE__; };
    Storage.prototype.setItem = function(key, value) { if (key === 'layerwell.shelf.v1') throw new DOMException('Synthetic local write failure', 'QuotaExceededError'); return original.call(this, key, value); };
  })()`,
  );
  await clickByText(client, 'Remove completely', { exact: false });
  await waitForText(client, 'Your change was not confirmed.');
  await captureStep(client, 'M1-05b-remove-failure', { assertClean: false });
  await evaluate(client, 'globalThis.__M1_RESTORE_SYNTHETIC_WRITE__()');
  await clickByText(client, 'Remove completely', { exact: false });
  await waitForPath(client, '/shelf');
  assert(
    !(await evaluate(client, 'document.body.innerText')).includes('Retinol 0.3% serum'),
    'Removed product remains visible.',
  );
  await captureStep(client, 'M1-06-remove');
  const retainedCiphertext = await evaluate(client, `localStorage.getItem('layerwell.shelf.v1')`);
  assert(
    retainedCiphertext && !retainedCiphertext.includes('Synthetic manual moisturizer'),
    'Shelf was not encrypted.',
  );
  await evaluate(
    client,
    `localStorage.setItem('layerwell.shelf.v1', '{"version":"xchacha20poly1305:v99"}')`,
  );
  await client.send('Page.reload', { ignoreCache: true });
  await waitForText(client, 'Your private data could not open.', 60_000);
  await captureStep(client, 'M1-07-corruption-preserved');
  assert(
    await evaluate(
      client,
      `localStorage.getItem('layerwell.shelf.v1') === '{"version":"xchacha20poly1305:v99"}'`,
    ),
    'Corrupt bytes were silently changed.',
  );
  await evaluate(
    client,
    `localStorage.setItem('layerwell.shelf.v1', ${JSON.stringify(retainedCiphertext)})`,
  );
  await client.send('Page.reload', { ignoreCache: true });
  await waitForText(client, 'Shelf', 60_000);
  await captureStep(client, 'M1-08-storage-recovered');
  // The dev anonymous fixture has no persisted Auth session. Publish its owner
  // through the actual eligible age form again before testing owner rights.
  await retainedRoute(client, '/onboarding/age');
  await waitForText(client, 'First, your');
  await fillByLabel(client, 'Day of birth', '01');
  await fillByLabel(client, 'Month of birth', '01');
  await fillByLabel(client, 'Year of birth', '1990');
  await clickByText(client, 'Continue');
  await waitForPath(client, '/onboarding/consent');
  await waitForText(client, 'Before the quiz');
}

function writeReport(summary) {
  const taskLabel = summary.accountUpgradeMode
    ? 'Anonymous account-upgrade recovery run'
    : summary.accountIsolationMode
      ? 'Account sign-out isolation and cleanup recovery run'
      : `First-session onboarding ${viewport.width} x ${viewport.height} run`;
  const featureLabel = summary.accountUpgradeMode
    ? 'Identity-preserving account upgrade UI'
    : summary.accountIsolationMode
      ? 'Account-boundary private-data isolation'
      : 'First-run onboarding activation path';
  const branchLabel = summary.accountUpgradeMode
    ? 'Invalid email code and successful recovery'
    : summary.accountIsolationMode
      ? 'Cleanup failure, retry, and signed-out direct routes'
      : `Happy path plus age re-verification downgrade / ${
          isLaunchFloorViewport ? 'launch-floor phone viewport' : 'stress viewport'
        }`;
  const lines = [
    '# Human-Simulated E2E Run Report',
    '',
    '## Summary',
    '',
    `- Date: ${summary.date}`,
    `- Codex task: ${taskLabel}`,
    `- App surface: ${summary.surface}`,
    `- Build/start command: \`${summary.startCommand}\``,
    `- Browser/device/simulator/OS: Headless Chrome or Edge, ${viewport.width} x ${viewport.height}`,
    `- Feature or PR tested: ${featureLabel}`,
    `- Overall verdict: ${summary.verdict === 'pass' ? 'Pass' : 'Fail'}`,
    '',
    '## Flows Executed',
    '',
    '| Flow | Branch | Result | Evidence | Notes |',
    '| ---- | ------ | ------ | -------- | ----- |',
    `| First-run onboarding | ${branchLabel} | ${summary.verdict} | \`${path.relative(repoRoot, evidenceDir).replace(/\\/g, '/')}\` | ${summary.flowResult ?? `Reached ${summary.endUrl}`} |`,
    '',
    '## Bugs Found',
    '',
    summary.verdict === 'pass'
      ? 'None in this pass.'
      : 'See `summary.json` and browser logs in this evidence folder.',
    '',
    '## Commands Run',
    '',
    '```bash',
    summary.accountUpgradeMode
      ? summary.accountCheckpointMode
        ? 'node scripts/e2e/onboarding-first-session.mjs --account-upgrade-checkpoint'
        : 'npm run e2e:onboarding-account-upgrade'
      : summary.accountIsolationMode
        ? 'npm run e2e:onboarding-account-isolation'
        : 'npm run e2e:onboarding-first-session',
    '```',
    '',
    '## Remaining Risk',
    '',
    summary.accountUpgradeMode
      ? '- The development-only fixture proves route interaction and recovery, not live Supabase email delivery or identity mutation.'
      : summary.accountIsolationMode
        ? '- The development-only fixture proves local cache/storage isolation and recovery; live Supabase A-to-B switching remains staging QA.'
        : isLaunchFloorViewport
          ? '- Expo web verifies the supported phone geometry and flow logic; it does not replace native iPhone evidence.'
          : `- ${viewport.width} x ${viewport.height} is resilience evidence below the 375 x 667 phone launch floor.`,
    '- Native iOS/Android onboarding still needs simulator or physical-device QA for OS prompts and platform text settings.',
    '',
  ];

  writeFileSync(path.join(evidenceDir, 'report.md'), `${lines.join('\n')}`);
}

async function run() {
  mkdirSync(evidenceDir, { recursive: true });
  clearPreviousEvidence();

  const browserPath = findBrowserPath();
  const userDataDir = path.join(tmpdir(), `layerwell-onboarding-e2e-${Date.now()}`);
  const server = shouldStartServer ? startExpoServer() : null;
  const browser = startBrowser(browserPath, userDataDir);
  let client = null;

  try {
    if (shouldStartServer) await waitForUrl(baseUrl);
    await waitForUrl(`http://127.0.0.1:${debugPort}/json/version`);
    client = await connectToPage();
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('Log.enable');
    await client.send('Network.enable');
    writeJson('C37-run-environment.json', { startedAt: new Date().toISOString(),
      browser: await client.send('Browser.getVersion'), userDataDir, appPort, debugPort,
      baseUrl, viewport: { ...viewport, deviceScaleFactor: 2 },
      surface: 'Real Chrome/CDP development Expo web; synthetic local owner; no external provider' });
    await client.send('Emulation.setDeviceMetricsOverride', {
      deviceScaleFactor: 2,
      height: viewport.height,
      mobile: true,
      scale: 1,
      screenOrientation: { angle: 0, type: 'portraitPrimary' },
      width: viewport.width,
    });
    await client.send('Emulation.setTouchEmulationEnabled', { enabled: true });

    if (deletionRecoveryMode) {
      await client.send('Page.navigate', { url: `${baseUrl}/today` });
      const terminalText =
        deletionRecoveryMode === 'pending_then_completed_manual'
          ? 'Deleting your account'
          : deletionRecoveryMode === 'expired'
            ? 'Deletion receipt needs support'
            : 'Deletion status could not be verified';
      await waitForText(client, terminalText, 60_000);
      const initial = await captureStep(client, 'deletion-01-closed', { assertClean: false });
      assertInteractiveControl(initial, 'Check status now');
      assert(
        !initial.bodyText.includes('Morning routine') &&
          !initial.bodyText.includes('Account deletion completed'),
        'Deletion opened protected content or claimed premature completion.',
      );
      if (deletionRecoveryMode === 'invalid') {
        await scrollTextIntoView(client, 'Retry deletion request');
        await clickByText(client, 'Retry deletion request');
        await waitForText(client, terminalText);
        await captureStep(client, 'deletion-02-retry-still-closed', { assertClean: false });
      } else if (deletionRecoveryMode === 'pending_then_completed_manual') {
        await clickByText(client, 'Check status now');
        await waitForText(client, 'Account deletion completed');
        await scrollTextIntoView(client, 'Continue');
        const notice = await captureStep(client, 'deletion-02-synthetic-completion-manual', {
          assertClean: false,
        });
        assertInteractiveControl(notice, 'Continue');
        await clickByText(client, 'Continue');
        await waitForCondition(
          client,
          `document.body.innerText.includes('Begin') || document.body.innerText.includes('First, your')`,
          30_000,
          'acknowledged deletion public entry',
        );
        await captureStep(client, 'deletion-03-acknowledged');
      } else {
        assert(
          !initial.controls.some((control) => control.label === 'Retry deletion request'),
          'Unavailable retry was exposed.',
        );
        await clickByText(client, 'Check status now');
        await waitForText(client, terminalText);
      }
      const afterReload =
        deletionRecoveryMode === 'pending_then_completed_manual'
          ? `document.body.innerText.includes('First, your') || document.body.innerText.includes('Begin')`
          : `document.body.innerText.includes(${JSON.stringify(terminalText)})`;
      await client.send('Page.navigate', { url: `${baseUrl}/shelf` });
      await waitForCondition(client, afterReload, 60_000, 'closed deletion direct entry');
      await client.send('Page.reload', { ignoreCache: true });
      await waitForCondition(client, afterReload, 60_000, 'closed deletion relaunch');
      const reloaded = await captureStep(client, 'deletion-04-relaunch-closed', {
        assertClean: false,
      });
      assert(
        !reloaded.bodyText.includes('Morning routine'),
        'Deletion relaunch reopened health content.',
      );
      writeJson('summary.json', {
        verdict: 'pass',
        viewport,
        deletionRecoveryMode,
        limits:
          'Synthetic gate transport only; no real provider deletion, persisted Keychain or Apple revocation evidence.',
      });
      return;
    }
    await client.send('Page.navigate', { url: `${baseUrl}/?e2eReset=local` });
    let welcome;
    let directProtectedAgeGate;
    if (accountIsolationMode) {
      // The retained signed-in fixture correctly requires current 18+ proof.
      await waitForText(client, 'First, your', 60_000);
      welcome = await captureStep(client, '01-retained-owner-age-closed');
      directProtectedAgeGate = welcome;
    } else {
      await waitForText(client, 'Begin', 60_000);
      welcome = await captureStep(client, '01-welcome');
      await client.send('Page.navigate', { url: `${baseUrl}/today` });
      await waitForPath(client, '/onboarding/age', 30_000);
      await waitForText(client, 'First, your', 30_000);
      directProtectedAgeGate = await captureStep(client, '01a-direct-protected-age-gate');
      assert(
        !directProtectedAgeGate.bodyText.includes('Morning routine'),
        'Today mounted before age proof.',
      );
      await client.send('Page.navigate', { url: baseUrl });
      await waitForText(client, 'Begin', 30_000);
      await scrollTextIntoView(client, 'Begin');
      await clickByText(client, 'Begin');
    }
    await waitForText(client, 'First, your', 30_000);
    await captureStep(client, '02-age-empty');
    await fillByLabel(client, 'Day of birth', '01');
    await fillByLabel(client, 'Month of birth', '01');
    await fillByLabel(client, 'Year of birth', '1990');
    await captureStep(client, '03-age-filled');
    if (process.argv.includes('--diagnose-exceptions')) {
      await client.send('Debugger.enable');
      await client.send('Debugger.setPauseOnExceptions', { state: 'all' });
    }
    writeJson(
      'bundle-crypto-provenance.json',
      await evaluate(
        client,
        `(() => {
      const modules = globalThis.__r?.getModules?.();
      if (!modules) return { available: false };
      return { available: true, modules: [...modules.values()]
        .filter(m => /ciphers/i.test(m.verboseName ?? ''))
        .map(m => ({ path: m.verboseName, initialized: m.isInitialized,
          randomBytes: typeof m.publicModule?.exports?.randomBytes,
          xchacha20poly1305: typeof m.publicModule?.exports?.xchacha20poly1305 })) };
    })()`,
      ),
    );
    await clickByText(client, 'Continue');

    await waitForPath(client, '/onboarding/consent', 30_000);
    await waitForText(client, 'Before the quiz', 30_000);
    const postAgeSubmit = await captureStep(client, '03a-after-age-submit');
    assert(
      postAgeSubmit.bodyText.includes('Before the quiz'),
      `Age submission did not reach consent. Current screen: ${postAgeSubmit.url} — ${postAgeSubmit.bodyText}`,
    );
    await captureStep(client, '04-consent');
    await clickByText(client, 'I agree. Continue');
    await waitForPath(client, '/onboarding/goals');
    await waitForText(client, 'What brings you here?');
    await captureStep(client, '05-goals');
    await scrollTextIntoView(client, 'Clear skin', { exact: false });
    await clickByText(client, 'Clear skin', { exact: false });
    await scrollTextIntoView(client, 'Barrier repair', { exact: false });
    await clickByText(client, 'Barrier repair', { exact: false });
    await captureStep(client, '06-goals-selected');
    await scrollTextIntoView(client, 'Continue');
    await clickByText(client, 'Continue');

    await waitForPath(client, '/onboarding/quiz');
    await answerQuiz(client);

    await waitForText(client, "What's on your shelf?");
    await captureStep(client, '09-products-empty');
    const productNames = [
      { category: 'Treatment', name: 'Retinol 0.3% serum' },
      { category: 'Toner', name: 'Glycolic 7% toner' },
      { category: 'SPF', name: 'Mineral SPF 50' },
    ];
    await addProduct(client, productNames[0], '10-products-after-1');
    await addProduct(client, productNames[1], '11-products-after-2');
    await addProduct(client, productNames[2], '12-products-after-3');
    const firstOwner35 = await observeFirstSession35(client, null);
    assert(firstOwner35.sameOwner && firstOwner35.currentConsent, 'Product intake has no current synthetic owner.');
    await clickByText(client, 'Continue');

    await waitForCondition(
      client,
      `window.location.pathname !== '/onboarding/products'`,
      30_000,
      'product intake to leave after Continue',
    );
    const postProductsPath = await evaluate(client, 'window.location.pathname');
    assert(
      postProductsPath === '/onboarding/analyzing' || postProductsPath === '/onboarding/reveal',
      `Product intake continued to unexpected path: ${postProductsPath}`,
    );
    await captureStep(client, '13-post-products-continue-current');
    await waitForText(client, 'YOUR SKIN PROFILE', 45_000);
    await waitForCondition(
      client,
      `(document.body?.innerText ?? '').includes('FIRST INSIGHT') ||
        (document.body?.innerText ?? '').includes('Pair review in progress')`,
      30_000,
      'reviewed first insight or truthful pending-review state',
    );
    const reveal = await captureStep(client, '14-reveal-checks');
    await screenshot(client, '14-reveal-insight');
    const revealHasReviewedInsight =
      reveal.bodyText.includes('FIRST INSIGHT') && reveal.bodyText.includes('Timing handled');
    const revealHasPendingReview =
      reveal.bodyText.includes('Pair review in progress') &&
      reveal.bodyText.includes(
        "We won't show a compatibility result for these products until that review is complete.",
      );
    assert(
      revealHasReviewedInsight !== revealHasPendingReview,
      'Reveal must show exactly one reviewed insight or truthful pending-review state.',
    );
    if (revealHasReviewedInsight) {
      assert(
        reveal.bodyText.includes(
          'Products that need different timing are separated before the first check-off.',
        ),
        'Reveal did not show the reviewed shelf-derived timing insight body.',
      );
    }
    assert(!reveal.bodyText.includes('See my routine'), 'Reveal still exposes See my routine CTA.');

    await clickByText(client, 'Continue');
    await waitForPath(client, '/onboarding/notifications');
    await captureStep(client, '15-notifications');
    await clickByText(client, 'Not now');
    await waitForCondition(client, `(document.body?.innerText ?? '').includes('Reminders are off. Your choice was saved.') ||
      (document.body?.innerText ?? '').includes('Your off choice is saved, but delivery is unconfirmed.')`,
    30_000, 'durable OFF confirmation without automatic navigation');
    const reminderContinuation35 = await continueAfterReminderChoice35({
      readChoice: async () => {
        const saved = await captureStep(client, '15a-reminders-off-saved');
        const authority = await observeFirstSession35(client, firstOwner35.binding);
        writeJson('15a-reminder-persistence35.json', authority);
        return { ...saved, ...authority, path: new URL(saved.url).pathname };
      },
      click: (label) => clickByText(client, label),
      waitForAccount: () => waitForPath(client, '/onboarding/account'),
    });
    writeJson('15b-reminder-continuation35.json', reminderContinuation35);
    const account = await captureStep(client, '16-account');
    let accountCodeError = null;
    let accountCodeEntry = null;
    if (accountUpgradeMode) {
      await fillByLabel(client, 'Email address', 'tas.account.e2e@example.com');
      await clickByText(client, 'Email me a code');
      await waitForText(client, 'Enter the 6-digit code we sent');
      accountCodeEntry = await captureStep(client, '16a-account-code-entry');

      await fillByLabel(client, 'Verification code', '111111');
      await clickByText(client, 'Verify');
      await waitForText(client, 'That code did not work. Request a new code and try again.');
      accountCodeError = await captureStep(client, '16b-account-code-error');

      await fillByLabel(client, 'Verification code', '424242');
      await clickByText(client, 'Verify');
    } else {
      await clickByText(client, 'Not now');
    }

    await waitForPath(client, '/onboarding/paywall');
    await waitForText(client, 'Continue with the free plan', 30_000);
    const paywall = await captureStep(client, '17-paywall-current');
    await screenshot(client, '17-paywall');
    writeJson('17-paywall.json', paywall);
    assert(
      paywall.bodyText.includes('Continue with the free plan'),
      'Paywall did not expose the truthful free-plan path.',
    );
    assert(
      paywall.bodyText.includes('Start free trial') ||
        paywall.bodyText.includes('Subscribe to Pro'),
      'Paywall did not expose a trial-eligible or non-trial paid CTA.',
    );
    if (paywall.bodyText.includes('Store checkout is unavailable in this preview.')) {
      assert(paywall.controls.some((control) =>
        ['Start free trial', 'Subscribe to Pro'].includes(control.label) && control.disabled),
      'Unavailable preview checkout exposed an enabled paid action.');
    }
    if (accountUpgradeMode) {
      assert(accountCodeEntry, 'Account upgrade did not reach code entry.');
      assert(
        accountCodeError?.bodyText.includes(
          'That code did not work. Request a new code and try again.',
        ),
        'Account upgrade did not show the invalid-code recovery message.',
      );
      assert(
        paywall.url.includes('/onboarding/paywall'),
        'Valid account-upgrade code did not reach the onboarding paywall.',
      );
    }
    if (accountCheckpointMode) {
      const problemLogs = collectProblemLogs(client.events);
      const disallowedLogs = problemLogs.filter(disallowedLog);
      writeJson('browser-warn-error-logs.json', problemLogs);
      assert(
        disallowedLogs.length === 0,
        `Unexpected browser warn/error logs: ${disallowedLogs.length}`,
      );
      const summary = {
        accountCheckpointMode: true,
        accountUpgradeMode: true,
        accountIsolationMode: false,
        date: today,
        endUrl: paywall.url,
        evidenceFiles: [
          '16-account.png',
          '16a-account-code-entry.png',
          '16b-account-code-error.png',
          '17-paywall-current.png',
        ],
        flowResult:
          'A deterministic invalid code showed recovery copy; the valid code reached the current paywall with both free and paid paths visible.',
        browserWarnErrorCount: problemLogs.length,
        startCommand: shouldStartServer
          ? `EXPO_NO_DOTENV=1 EXPO_PUBLIC_APP_ENV=development EXPO_PUBLIC_E2E_FIRST_SESSION_AUTH=anonymous_owner EXPO_PUBLIC_E2E_ACCOUNT_UPGRADE=email_same_user EXPO_PUBLIC_E2E_LOCAL_RESET=1 npm --workspace apps/mobile run web -- --port ${appPort} --host localhost`
          : `Existing Expo web at ${baseUrl}`,
        surface: 'Headless Chrome Expo web',
        verdict: 'pass',
        viewport: {
          ...viewport,
          supportClass: isLaunchFloorViewport
            ? 'supported phone geometry at or above the 375 x 667 launch floor'
            : 'resilience stress viewport below the 375 x 667 launch floor',
        },
      };
      writeJson('summary.json', summary);
      writeReport(summary);
      console.log(`Onboarding account checkpoint E2E passed. Evidence: ${evidenceDir}`);
      return;
    }

    await scrollTextIntoView(client, 'Continue with the free plan', { exact: false });
    const paywallFreePath = await captureStep(client, '18-paywall-free-path-visible');
    await clickByText(client, 'Continue with the free plan', { exact: false });
    await waitForPath(client, '/today', 30_000);
    const todayFree = await captureStep(client, '19-today-free-current', {
      assertClean: false,
    });
    assert(
      !todayFree.bodyText.includes('PRO ACTIVE') &&
        !todayFree.bodyText.includes('Your Pro plan is active'),
      'Continuing with the free plan incorrectly exposed Pro authority.',
    );

    await clickByText(client, 'Shelf');
    await waitForPath(client, '/shelf', 30_000);
    await waitForText(client, '3 products', 30_000);
    await delay(750);
    const shelfAfterOnboarding = await captureStep(client, '20-shelf-after-onboarding', {
      assertClean: false,
    });
    assert(
      productNames.every((product) => shelfAfterOnboarding.bodyText.includes(product.name)),
      'Shelf did not retain every product added during onboarding.',
    );
    const freeReceipt35 = await observeFirstSession35(client, firstOwner35.binding, true);
    assertFreeFirstSession35(freeReceipt35, productNames.map((product) => product.name));
    writeJson('20-free-first-session35.json', freeReceipt35);
    assert(shelfAfterOnboarding.overflowX <= 1, 'Shelf has horizontal overflow.');
    const shelfTrace37 = [];
    await tapOwnedShelfProduct37({ name: 'Mineral SPF 50', expectedNames: productNames.map((p) => p.name),
      inspect: (label) => evaluate(client, shelfTargetExpression37('Mineral SPF 50', { label })),
      scroll: async (label) => {
        const snapshot = await evaluate(client, shelfTargetExpression37('Mineral SPF 50', { label, scroll: true }));
        await delay(350);
        await captureStep(client, '20-C37-product-before-touch', { assertClean: false });
        return snapshot;
      },
      readAuthority: () => observeFirstSession35(client, firstOwner35.binding, true),
      send: (method, params) => client.send(method, params),
      waitForDetail: async (expected) => {
        await waitForCondition(client, `location.pathname === ${JSON.stringify(expected)}`, 30_000,
          'exact owned product detail after a verified Shelf touch');
        return evaluate(client, `({path:location.pathname,at:new Date().toISOString()})`);
      },
      record: (stage, value) => { shelfTrace37.push({ stage, value }); writeJson('20-C37-Shelf-hit-chain.json', shelfTrace37); },
    });
    await waitForCondition(client, `/^\\/shelf\\/[^/]+$/.test(window.location.pathname)`,
      30_000, 'owned product detail after a visible Shelf tap');
    await waitForText(client, 'Mineral SPF 50');
    const firstProduct35 = await captureStep(client, '20a-owned-product-open35', { assertClean: false });
    assert(firstProduct35.overflowX <= 1, 'Owned product detail has horizontal overflow.');
    await clickByText(client, 'Back');
    await waitForPath(client, '/shelf');
    await waitForText(client, '3 products');
    const afterBack35 = await observeFirstSession35(client, firstOwner35.binding, true);
    assertFreeFirstSession35(afterBack35, productNames.map((product) => product.name));
    await captureStep(client, '20b-shelf-back-recovery35', { assertClean: false });
    writeJson('20b-shelf-back-authority35.json', afterBack35);

    // Exercise the real filter separately. Unknown dates stay unknown.
    await scrollTextIntoView(client, 'Expiring');
    selectShelfTarget37(await evaluate(client, shelfTargetExpression37('Mineral SPF 50')), false);
    const filterRect37 = await evaluate(client, rectByTextExpression('Expiring', true));
    assert(filterRect37 && await evaluate(client, `(() => {
      const n=document.elementFromPoint(${filterRect37?.x},${filterRect37?.y});
      return n?.closest('[role="button"]')?.getAttribute('aria-label') === 'Expiring'; })()`), 'Expiring chip is not hittable.');
    await clickByText(client, 'Expiring');
    const expiring37 = await captureStep(client, '20c-C37-explicit-expiring', { assertClean: false });
    const filtered37 = await evaluate(client, shelfTargetExpression37('Mineral SPF 50'));
    assert(filtered37.filters.some((f) => f.active && f.label === 'Expiring' && f.pressed === 'true') &&
      expiring37.bodyText.includes('0 of 3 saved products'), 'Explicit Expiring filter did not preserve truthful unknown dates.');
    await clickByText(client, 'All');
    await waitForText(client, '3 of 3 saved products');
    await captureStep(client, '20d-C37-All-restored', { assertClean: false });

    if (crossOwnerMode) {
      if (process.argv.includes('--daily-loop')) {
        await dailyLoopFlow({ client, evaluate, retainedRoute, waitForText, waitForCondition,
          clickByText, scrollTextIntoView, fillByLabel, captureStep, writeJson });
      }
      await crossOwnerFlow(client, productNames);
      return;
    }

    await clickByText(client, 'Progress', { exact: false });
    await waitForPath(client, '/progress', 30_000);
    await waitForText(
      client,
      accountIsolationMode
        ? 'We will keep Pro-only screens hidden'
        : 'Unlock your private photo timeline.',
      30_000,
    );
    await delay(750);
    const progressAfterOnboarding = await captureStep(client, '21-progress-after-onboarding', {
      assertClean: false,
    });
    assert(
      accountIsolationMode
        ? progressAfterOnboarding.bodyText.includes('subscription status is confirmed') &&
            !progressAfterOnboarding.bodyText.includes('PRO ACTIVE')
        : progressAfterOnboarding.bodyText.includes('Unlock your private photo timeline.') &&
            progressAfterOnboarding.bodyText.includes('Subscribe to Pro'),
      'Progress tab did not render the truthful free-plan feature gate.',
    );
    if (!accountIsolationMode) await clickByText(client, 'Maybe later');
    await delay(750);

    await clickByText(client, 'You');
    await waitForPath(client, '/you', 30_000);
    await delay(750);
    const youAfterOnboarding = await captureStep(client, '22-you-after-onboarding', {
      assertClean: false,
    });
    assert(
      youAfterOnboarding.bodyText.toLowerCase().includes('your data') &&
        youAfterOnboarding.bodyText.includes('Manage subscription'),
      'You tab did not render its account and settings surface.',
    );

    await clickByText(client, 'Today');
    await waitForPath(client, '/today', 30_000);
    const todayAfterTabRoundTrip = await captureStep(client, '23-today-after-tab-round-trip', {
      assertClean: false,
    });
    const roundTrip37 = await observeFirstSession35(client, firstOwner35.binding, true);
    assertFreeFirstSession35(roundTrip37, productNames.map((product) => product.name));
    assert(roundTrip37.persistedOff === true, 'Saved OFF choice was lost after the tab round trip.');
    writeJson('23-C37-round-trip-authority.json', roundTrip37);
    if (process.argv.includes('--daily-loop')) {
      await dailyLoopFlow({ client, evaluate, retainedRoute, waitForText, waitForCondition,
        clickByText, scrollTextIntoView, fillByLabel, captureStep, writeJson });
    }
    if (process.argv.includes('--retained-safety')) await retainedShelfFlow(client);

    let ageReverificationBefore = null;
    let ageReverificationBlocked = null;
    let ageReverificationDirectToday = null;
    let ageReverificationReloadedToday = null;
    if (!accountUpgradeMode && !accountIsolationMode) {
      if (process.argv.includes('--retained-safety'))
        await retainedRoute(client, '/onboarding/age');
      else await client.send('Page.navigate', { url: `${baseUrl}/onboarding/age` });
      await waitForPath(client, '/onboarding/age', 30_000);
      await waitForText(client, 'First, your', 30_000);
      await fillByLabel(client, 'Day of birth', '01');
      await fillByLabel(client, 'Month of birth', '01');
      await fillByLabel(client, 'Year of birth', String(new Date().getFullYear()));
      ageReverificationBefore = await captureStep(client, '25-age-reverification-before-submit');
      await clickByText(client, 'Continue');
      await waitForText(client, 'You need to be at least 18', 30_000);
      ageReverificationBlocked = await captureStep(client, '26-age-reverification-blocked');
      if (process.argv.includes('--retained-safety')) {
        await clickByText(client, 'Privacy & account');
        await waitForText(client, 'Export my data');
        const rights = await captureStep(client, 'M1-09-verified-owner-rights');
        assert(
          !rights.bodyText.includes('Review fresh consent') &&
            !rights.bodyText.includes('Morning routine'),
          'Rights shell reopened health admission.',
        );
        await scrollTextIntoView(client, 'Delete account');
        await clickByText(client, 'Delete account');
        await waitForText(client, 'Delete the whole account');
        await captureStep(client, 'M1-10-delete-cancel');
        await scrollTextIntoView(client, 'Cancel');
        await clickByText(client, 'Cancel');
        await scrollTextIntoView(client, 'Withdraw health-data consent');
        await clickByText(client, 'Withdraw health-data consent');
        await scrollTextIntoView(client, 'Confirm withdrawal');
        // Refuse a real local cleanup mutation without changing lifecycle or
        // gate state. The durable withdrawal intent must remain retryable.
        await evaluate(
          client,
          `(() => {
          const original = Storage.prototype.removeItem;
          Storage.prototype.removeItem = function(key) {
            if (key === 'layerwell.shelf.v1') throw new DOMException('Synthetic withdrawal cleanup refusal', 'QuotaExceededError');
            return original.call(this, key);
          };
        })()`,
        );
        await clickByText(client, 'Confirm withdrawal');
        await waitForText(client, 'Withdrawal has not finished.');
        await captureStep(client, 'M1-11a-withdrawal-cleanup-refused', { assertClean: false });
        await scrollTextIntoView(client, 'Retry / check status');
        await clickByText(client, 'Retry / check status');
        await waitForText(client, 'Status: withdrawing.');
        await scrollTextIntoView(client, 'Retry / check status');
        await clickByText(client, 'Retry / check status');
        await waitForText(client, 'Could not finish the privacy request.');
        await captureStep(client, 'M1-11b-withdrawal-repeated-refusal', { assertClean: false });
        await client.send('Page.reload', { ignoreCache: true });
        await waitForCondition(
          client,
          `document.body.innerText.includes('Privacy & account') && (document.body.innerText.includes('First, your') || document.body.innerText.includes('Begin'))`,
          60_000,
          'safe public bootstrap with rights access',
        );
        const interrupted = await captureStep(client, 'M1-11c-withdrawal-relaunch-paused', {
          assertClean: false,
        });
        assert(
          !interrupted.bodyText.includes('Morning routine') &&
            !interrupted.bodyText.includes('Review fresh consent'),
          'Withdrawal relaunch reopened health admission.',
        );
        await clickByText(client, 'Privacy & account');
        await waitForText(client, 'Status: withdrawing.');
        await scrollTextIntoView(client, 'Retry / check status');
        await clickByText(client, 'Retry / check status');
        await waitForText(client, 'Status: withdrawn.');
        await captureStep(client, 'M1-11-age-closed-withdrawal');
        assert(
          !(await evaluate(client, 'document.body.innerText')).includes('Review fresh consent'),
          'Rights shell offered health activation.',
        );
        await scrollTextIntoView(client, 'Back to age confirmation');
        await clickByText(client, 'Back to age confirmation');
      }
      assert(
        !ageReverificationBlocked.bodyText.includes('Morning routine') &&
          !ageReverificationBlocked.bodyText.includes('Evening routine'),
        'Protected Today content remained mounted after the fresh age downgrade.',
      );

      await client.send('Page.navigate', { url: `${baseUrl}/today?routine=AM` });
      await waitForPath(client, '/onboarding/age', 30_000);
      await waitForText(client, 'First, your', 30_000);
      ageReverificationDirectToday = await captureStep(
        client,
        '27-age-reverification-direct-today-blocked',
      );
      assert(
        !ageReverificationDirectToday.bodyText.includes('Morning routine'),
        'A direct Today route reopened after the in-process age downgrade.',
      );

      await client.send('Page.reload', { ignoreCache: true });
      await waitForText(client, 'First, your', 60_000);
      await client.send('Page.navigate', { url: `${baseUrl}/today?routine=AM` });
      await waitForPath(client, '/onboarding/age', 30_000);
      await waitForText(client, 'First, your', 30_000);
      // CDP can observe the replacement document before Chrome has painted its
      // first frame. Wait for the redirected age surface to become visual so
      // the retained screenshot is evidence of the post-reload state.
      await delay(1_000);
      ageReverificationReloadedToday = await captureStep(
        client,
        '28-age-reverification-reload-today-blocked',
      );
      assert(
        ageReverificationReloadedToday.bodyText.includes('First, your') &&
          !ageReverificationReloadedToday.bodyText.includes('Morning routine'),
        'The minimized re-verification tombstone did not keep Today closed after reload.',
      );
    }

    let accountBeforeSignOut = null;
    let accountBoundaryFailure = null;
    let accountBoundaryRetry = null;
    let signedOutWelcome = null;
    let signedOutShelf = null;
    let signedOutToday = null;
    let signedOutRelaunch = null;
    if (accountIsolationMode) {
      const assertPrivateNamesHidden = (snapshot, label) => {
        for (const product of productNames) {
          assert(
            !snapshot.bodyText.includes(product.name),
            `${label} exposed account A product: ${product.name}.`,
          );
        }
      };

      await navigateClientSide(client, '/you');
      await waitForPath(client, '/you', 30_000);
      await waitForText(client, 'tas.account-a.e2e@example.com', 30_000);
      await waitForText(client, 'Sign out', 30_000);
      await scrollTextIntoView(client, 'Sign out');
      accountBeforeSignOut = await captureStep(client, '25-account-before-signout', {
        assertClean: false,
      });
      assert(
        accountBeforeSignOut.overflowX <= 1,
        `Account surface has horizontal overflow: ${accountBeforeSignOut.overflowX}px.`,
      );
      assertInteractiveControl(accountBeforeSignOut, 'Sign out');

      await clickByText(client, 'Sign out');
      await waitForText(client, 'Account access paused', 30_000);
      accountBoundaryFailure = await captureStep(client, '26-account-boundary-clear-failure');
      assertPrivateNamesHidden(accountBoundaryFailure, 'Failed account boundary');
      assertInteractiveControl(accountBoundaryFailure, 'Try again');
      assert(
        accountBoundaryFailure.bodyText.includes('Your account data is still locked.'),
        'Missing recovery explanation.',
      );
      await clickByText(client, 'Try again');
      // Wait beyond the injected cleanup delay, then assert the stable repeated
      // refusal. A transient spinner is not evidence of completed recovery.
      await delay(1_200);
      await waitForText(client, 'Account access paused', 30_000);
      accountBoundaryRetry = await captureStep(client, '27-account-boundary-repeated-failure');
      assertPrivateNamesHidden(accountBoundaryRetry, 'Repeated failed account boundary');
      assertInteractiveControl(accountBoundaryRetry, 'Try again');
      await clickByText(client, 'Try again');
      await waitForPath(client, '/', 30_000);
      await waitForText(client, 'Begin', 30_000);
      signedOutWelcome = await captureStep(client, '28-signed-out-welcome');
      assertPrivateNamesHidden(signedOutWelcome, 'Signed-out welcome');

      await navigateClientSide(client, '/shelf');
      await waitForPath(client, '/onboarding/age', 30_000);
      await waitForText(client, 'First, your', 30_000);
      signedOutShelf = await captureStep(client, '29-signed-out-shelf-age-closed');
      assertPrivateNamesHidden(signedOutShelf, 'Signed-out Shelf');
      await navigateClientSide(client, '/today?routine=AM');
      await waitForPath(client, '/onboarding/age', 30_000);
      signedOutToday = await captureStep(client, '30-signed-out-today-age-closed');
      assertPrivateNamesHidden(signedOutToday, 'Signed-out Today');
      await client.send('Page.reload', { ignoreCache: true });
      await waitForText(client, 'First, your', 60_000);
      const relaunched = await captureStep(client, '31-signed-out-cold-relaunch');
      signedOutRelaunch = relaunched;
      assertPrivateNamesHidden(relaunched, 'Signed-out cold relaunch');
      assert(
        !relaunched.bodyText.includes('tas.account-a.e2e@example.com'),
        'Synthetic transport resurrected signed-out identity.',
      );
    }

    const problemLogs = collectProblemLogs(client.events);
    const disallowedLogs = problemLogs.filter(disallowedLog);
    writeJson('browser-warn-error-logs.json', problemLogs);
    assert(
      disallowedLogs.length === 0,
      `Unexpected browser warn/error logs: ${disallowedLogs.length}`,
    );

    const overflowXByStep = {};
    for (const [key, snapshot] of Object.entries({
      welcome,
      reveal,
      account,
      ...(accountCodeEntry ? { accountCodeEntry } : {}),
      ...(accountCodeError ? { accountCodeError } : {}),
      paywall,
      paywallFreePath,
      todayFree,
      ...(ageReverificationBefore ? { ageReverificationBefore } : {}),
      ...(ageReverificationBlocked ? { ageReverificationBlocked } : {}),
      ...(ageReverificationDirectToday ? { ageReverificationDirectToday } : {}),
      ...(ageReverificationReloadedToday ? { ageReverificationReloadedToday } : {}),
      ...(accountBeforeSignOut ? { accountBeforeSignOut } : {}),
      ...(accountBoundaryFailure ? { accountBoundaryFailure } : {}),
      ...(accountBoundaryRetry ? { accountBoundaryRetry } : {}),
      ...(signedOutWelcome ? { signedOutWelcome } : {}),
      ...(signedOutShelf ? { signedOutShelf } : {}),
      ...(signedOutToday ? { signedOutToday } : {}),
    })) {
      overflowXByStep[key] = snapshot.overflowX;
    }

    const summary = {
      retainedSafetyMode: process.argv.includes('--retained-safety'),
      accountIsolationMode,
      accountIsolation: accountIsolationMode
        ? {
            accountAEmail: 'tas.account-a.e2e@example.com',
            cleanupFailureStayedGated:
              accountBoundaryFailure?.bodyText.includes('Account access paused') ?? false,
            privateNamesHiddenAfterSignOut:
              Boolean(signedOutShelf && signedOutToday) &&
              productNames.every(
                (product) =>
                  !signedOutShelf.bodyText.includes(product.name) &&
                  !signedOutToday.bodyText.includes(product.name),
              ),
            signedOutShelfAgeClosed: signedOutShelf?.bodyText.includes('First, your') ?? false,
            signedOutTodayAgeClosed: signedOutToday?.bodyText.includes('First, your') ?? false,
            repeatedFailureStayedGated:
              accountBoundaryRetry?.bodyText.includes('Account access paused') ?? false,
            signedOutReloadAgeClosed: signedOutRelaunch?.bodyText.includes('First, your') ?? false,
            terminalWelcome: signedOutWelcome?.bodyText.includes('Begin') ?? false,
            noUncaughtRuntimeExceptions: !client.events.some(
              (event) => event.method === 'Runtime.exceptionThrown',
            ),
          }
        : null,
      accountUpgradeMode,
      accountUpgrade: accountUpgradeMode
        ? {
            email: 'tas.account.e2e@example.com',
            invalidCodeErrorShown:
              accountCodeError?.bodyText.includes(
                'That code did not work. Request a new code and try again.',
              ) ?? false,
            reachedCodeEntry: accountCodeEntry?.url.includes('/onboarding/account') ?? false,
            reachedPaywallAfterValidCode: paywall.url.includes('/onboarding/paywall'),
          }
        : null,
      browserProblemLogCount: problemLogs.length,
      date: today,
      endUrl:
        signedOutToday?.url ??
        ageReverificationReloadedToday?.url ??
        ageReverificationDirectToday?.url ??
        todayFree.url,
      evidenceFiles: [
        '01-welcome.png',
        '01a-direct-protected-age-gate.png',
        '03-age-filled.png',
        '06-goals-selected.png',
        '09-products-empty.png',
        '12-products-after-3.png',
        '14-reveal-insight.png',
        '15-notifications.png',
        '15a-reminders-off-saved.png',
        '16-account.png',
        ...(accountUpgradeMode ? ['16a-account-code-entry.png', '16b-account-code-error.png'] : []),
        '17-paywall-current.png',
        '18-paywall-free-path-visible.png',
        '19-today-free-current.png',
        '20-shelf-after-onboarding.png',
        '20a-owned-product-open35.png',
        '20b-shelf-back-recovery35.png',
        '21-progress-after-onboarding.png',
        '22-you-after-onboarding.png',
        '23-today-after-tab-round-trip.png',
        ...(!accountUpgradeMode && !accountIsolationMode
          ? [
              '25-age-reverification-before-submit.png',
              '26-age-reverification-blocked.png',
              '27-age-reverification-direct-today-blocked.png',
              '28-age-reverification-reload-today-blocked.png',
            ]
          : []),
        ...(accountIsolationMode
          ? [
              '25-account-before-signout.png',
              '26-account-boundary-clear-failure.png',
              '27-account-boundary-repeated-failure.png',
              '28-signed-out-welcome.png',
              '29-signed-out-shelf-age-closed.png',
              '30-signed-out-today-age-closed.png',
            ]
          : []),
      ],
      flowResult: accountUpgradeMode
        ? 'Recovered from an invalid deterministic email code, completed the account route with the valid code, then continued honestly to Today on the free plan.'
        : accountIsolationMode
          ? 'Completed onboarding on the free plan, failed two account cleanups behind usable recovery, retried successfully, signed out, and proved direct Shelf and Today routes could not expose account A data.'
          : 'Completed onboarding through the truthful free-plan path to Today without granting Pro, then proved an under-threshold re-verification immediately closed protected providers and remained closed across direct Today navigation and reload.',
      overflowXByStep,
      productNames: productNames.map((product) => product.name),
      reveal: {
        hasContinue: reveal.bodyText.includes('Continue'),
        hasDerivedInsightBody: reveal.bodyText.includes(
          'Products that need different timing are separated before the first check-off.',
        ),
        hasFirstInsightLabel: reveal.bodyText.includes('FIRST INSIGHT'),
        hasPendingReview: revealHasPendingReview,
        hasRoutinePreviewFallback: reveal.bodyText.includes('Routine preview'),
        hasSeeMyRoutine: reveal.bodyText.includes('See my routine'),
        hasTimingHandled: reveal.bodyText.includes('Timing handled'),
        text: reveal.bodyText,
      },
      freePlan: {
        hasContinueAction: paywallFreePath.bodyText.includes('Continue with the free plan'),
        hasProActiveCopy:
          todayFree.bodyText.includes('PRO ACTIVE') ||
          todayFree.bodyText.includes('Your Pro plan is active'),
        text: todayFree.bodyText,
        url: todayFree.url,
      },
      keyTabs: {
        progressUrl: progressAfterOnboarding.url,
        shelfRetainedProducts: productNames.every((product) =>
          shelfAfterOnboarding.bodyText.includes(product.name),
        ),
        shelfUrl: shelfAfterOnboarding.url,
        todayRoundTripUrl: todayAfterTabRoundTrip.url,
        youUrl: youAfterOnboarding.url,
      },
      routeCheck: {
        accountLedToPaywall: paywall.url.includes('/onboarding/paywall'),
        accountUpgradeErrorRecovered:
          !accountUpgradeMode ||
          (accountCodeError?.bodyText.includes('That code did not work') &&
            paywall.url.includes('/onboarding/paywall')),
        freePlanLedToToday: todayFree.url.includes('/today'),
        freePlanDidNotGrantPro:
          !todayFree.bodyText.includes('PRO ACTIVE') &&
          !todayFree.bodyText.includes('Your Pro plan is active'),
        keyTabRoundTripPassed:
          shelfAfterOnboarding.url.includes('/shelf') &&
          progressAfterOnboarding.url.includes('/progress') &&
          youAfterOnboarding.url.includes('/you') &&
          todayAfterTabRoundTrip.url.includes('/today'),
        notificationSkipLedToAccount: true,
        reminderSavedOffThenExplicitContinue: true,
        reminderDeliveryUnconfirmed: reminderContinuation35.deliveryUnconfirmed,
        ageReverificationClosedProtectedProviders:
          accountUpgradeMode ||
          accountIsolationMode ||
          (ageReverificationBlocked !== null &&
            !ageReverificationBlocked.bodyText.includes('Morning routine') &&
            !ageReverificationBlocked.bodyText.includes('Evening routine')),
        ageReverificationDirectTodayStayedClosed:
          accountUpgradeMode ||
          accountIsolationMode ||
          (ageReverificationDirectToday?.url.includes('/onboarding/age') === true &&
            !ageReverificationDirectToday.bodyText.includes('Morning routine')),
        ageReverificationReloadStayedClosed:
          accountUpgradeMode ||
          accountIsolationMode ||
          (ageReverificationReloadedToday?.url.includes('/onboarding/age') === true &&
            !ageReverificationReloadedToday.bodyText.includes('Morning routine')),
        signedOutShelfIsAgeClosed:
          !accountIsolationMode || signedOutShelf?.bodyText.includes('First, your') === true,
        signedOutTodayIsAgeClosed:
          !accountIsolationMode || signedOutToday?.bodyText.includes('First, your') === true,
        revealContinueLedToNotifications: true,
        revealRoute: reveal.url,
      },
      startCommand: shouldStartServer
        ? `EXPO_NO_DOTENV=1 EXPO_PUBLIC_APP_ENV=development ${!accountIsolationMode ? 'EXPO_PUBLIC_E2E_FIRST_SESSION_AUTH=anonymous_owner ' : ''}${accountUpgradeMode ? 'EXPO_PUBLIC_E2E_ACCOUNT_UPGRADE=email_same_user ' : ''}${accountIsolationMode ? 'EXPO_PUBLIC_E2E_ACCOUNT_ISOLATION=signout_clear_retry ' : ''}EXPO_PUBLIC_E2E_LOCAL_RESET=1 npm --workspace apps/mobile run web -- --port ${appPort} --host localhost`
        : `Existing Expo web at ${baseUrl}`,
      startUrl: `${baseUrl}/?e2eReset=local`,
      steps: [
        'Reset local private state with dev-only fixture.',
        'Verified direct protected-route entry failed closed to the age gate before any private Today content mounted.',
        'Began onboarding and entered a valid adult DOB.',
        'Granted explicit health-data collection consent before health-purpose inputs mounted.',
        'Selected Clear skin and Barrier repair.',
        'Answered 12-question quiz with visible option buttons.',
        'Added Retinol 0.3% serum, Glycolic 7% toner, and Mineral SPF 50 from product intake.',
        accountUpgradeMode
          ? 'Continued from reveal to notification soft ask, skipped reminders, recovered from an invalid email code, completed the deterministic account upgrade, and reached onboarding paywall.'
          : 'Saved reminders OFF, read back persistence under the current owner/consent, tapped the visible Continue, skipped account, and reached onboarding paywall.',
        'Used Continue with the free plan and reached Today without granting or implying Pro authority.',
        ...(accountIsolationMode
          ? [
              'Opened the signed-in account surface and initiated sign-out with account A private queries already populated.',
              'Verified first and repeated cleanup failures exposed usable recovery with no uncaught overlay, then retried successfully.',
              'Verified Welcome, direct Shelf, and direct Today routes contain no account A product names after cleanup.',
            ]
          : []),
      ],
      surface: 'Headless Chrome Expo web',
      today: { text: todayFree.bodyText, url: todayFree.url },
      verdict: 'pass',
      viewport: {
        ...viewport,
        supportClass: isLaunchFloorViewport
          ? 'supported phone geometry at or above the 375 x 667 launch floor'
          : 'resilience stress viewport below the 375 x 667 launch floor',
      },
    };

    if (accountIsolationMode) assertCompletedAccountRecovery(summary.accountIsolation);
    writeJson('summary.json', summary);
    writeReport(summary);
    console.log(`Onboarding first-session E2E passed. Evidence: ${evidenceDir}`);
  } catch (error) {
    // Capture the actual failed surface before closing Chrome/Metro. Synthetic
    // fixture only: never inspect storage, keys, cookies or network bodies.
    if (client) {
      await captureStep(client, 'FAILURE', { assertClean: false }).catch(() => undefined);
      writeJson('FAILURE-runtime-events.json', collectProblemLogs(client.events));
      writeJson(
        'FAILURE-race-state.json',
        await evaluate(
          client,
          `globalThis.__crossOwnerRace ? { readEntered: __crossOwnerRace.readEntered, writeEntered: __crossOwnerRace.writeEntered, results: __crossOwnerRace.results } : null`,
        ).catch(() => null),
      );
    }
    writeJson('ERROR.json', { status: 'FAIL', message: String(error.message), viewport });
    throw error;
  } finally {
    if (client) writeJson('network-outcomes35.json', client.events.filter((event) =>
      event.method === 'Network.responseReceived' || event.method === 'Network.loadingFailed').map((event) => {
      const response = event.params.response;
      let location = null;
      if (response?.url) {
        const url = new URL(response.url);
        location = { origin: url.origin, path: url.pathname };
      }
      return { kind: event.method, location, status: response?.status ?? null,
        error: event.params.errorText ?? null };
    }));
    client?.close();
    await stopProcess(browser);
    await stopProcess(server);
    await removeBrowserProfile(userDataDir);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
