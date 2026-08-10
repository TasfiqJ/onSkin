import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const isWindows = process.platform === 'win32';
const today = new Date().toISOString().slice(0, 10);
const scale = Number(process.env.TEXT_PRESSURE_SCALE ?? 1.2);
const evidenceDir =
  process.env.TEXT_PRESSURE_EVIDENCE_DIR ??
  path.join(
    repoRoot,
    'test-results',
    'human-e2e',
    today,
    `text-pressure-${String(Math.round(scale * 100)).padStart(3, '0')}-route-audit-current`,
  );
const appPort = Number(process.env.TEXT_PRESSURE_PORT ?? 8232);
const debugPort = Number(process.env.TEXT_PRESSURE_DEBUG_PORT ?? 9332);
const baseUrl = process.env.TEXT_PRESSURE_BASE_URL ?? `http://localhost:${appPort}`;
const shouldStartServer = !process.env.TEXT_PRESSURE_BASE_URL;
const viewport = {
  height: Number(process.env.TEXT_PRESSURE_VIEWPORT_HEIGHT ?? 640),
  width: Number(process.env.TEXT_PRESSURE_VIEWPORT_WIDTH ?? 360),
};
const entitlementLoadingText = 'Checking your access';
const entitlementWaitMs = positiveNumber(process.env.TEXT_PRESSURE_ENTITLEMENT_WAIT_MS, 35_000);
const httpAttemptTimeoutMs = positiveNumber(
  process.env.TEXT_PRESSURE_HTTP_ATTEMPT_TIMEOUT_MS,
  5_000,
);
const cdpCommandTimeoutMs = positiveNumber(
  process.env.TEXT_PRESSURE_CDP_COMMAND_TIMEOUT_MS,
  15_000,
);
const childProcessFailures = new WeakMap();

const defaultRoutes = [
  '/today',
  '/today?routine=PM',
  '/progress',
  '/progress/capture',
  '/progress/review',
  '/routine/plan',
  '/routine/ramp',
  '/routine/tolerance',
  '/routine/reorder',
  '/routine/adaptation',
  '/cycle/settings',
  '/cycle/disruption',
  '/cycle/procedure',
  '/cycle/phased-intro',
  '/cycle/recovery',
  '/cycle/why-tonight',
  '/recommendations',
  '/recommendations/preferences',
  '/recommendations/stale-local-rec',
  '/community',
  '/community/note/missing-note-e2e',
  '/community/ask',
  '/community/people-like-you',
  '/commerce/consent',
  '/commerce/stacks',
  '/commerce/stack/barrier-basics',
  '/commerce/stack/missing-stack-e2e',
  '/commerce/transparency',
  '/settings/subscription',
  '/settings/notifications',
  '/settings/timing',
  '/settings/skin-profile',
  '/settings/privacy',
  '/trend/optin',
  '/trend/fairness',
  '/ask',
  '/ask/consent',
  '/shelf',
  '/shelf/search',
  '/shelf/no-match',
  '/shelf/scan',
  '/shelf/ocr',
  '/shelf/manual',
  '/shelf/archive',
  '/shelf/opened',
  '/paywall/upsell?feature=full_routine',
  '/paywall/success',
  '/routine/streak',
  '/routine/widgets',
  '/cycle/week',
];

function parseRouteOverride(value) {
  if (!value?.trim()) return null;

  const routes = value
    .split(/[\n,]+/)
    .map((route) => route.trim())
    .filter(Boolean);

  for (const route of routes) {
    if (!route.startsWith('/')) {
      throw new Error(`TEXT_PRESSURE_ROUTES entries must start with "/": ${route}`);
    }
  }

  return routes;
}

const routes = parseRouteOverride(process.env.TEXT_PRESSURE_ROUTES) ?? defaultRoutes;

mkdirSync(evidenceDir, { recursive: true });

function positiveNumber(value, fallback) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.round(parsed);
}

function clearPreviousEvidence() {
  for (const entry of readdirSync(evidenceDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    if (!/\.(?:json|log|md|png)$/i.test(entry.name)) continue;
    rmSync(path.join(evidenceDir, entry.name), { force: true });
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function settleWithin(action, timeoutMs, label) {
  const task = Promise.resolve().then(action);
  task.catch(() => undefined);
  const result = await Promise.race([
    task.then(
      () => ({ status: 'done' }),
      (error) => ({ error, status: 'error' }),
    ),
    delay(timeoutMs).then(() => ({ status: 'timeout' })),
  ]);

  if (result.status === 'timeout') {
    console.warn(`WARN Timed out while ${label}.`);
    return;
  }

  if (result.status === 'error') {
    console.warn(
      `WARN Failed while ${label}: ${
        result.error instanceof Error ? result.error.message : String(result.error)
      }`,
    );
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
      'Could not find Chrome or Edge. Set CHROME_PATH or BROWSER_PATH to run text-pressure E2E.',
    );
  }
  return candidate;
}

function observeChildProcess(child, label) {
  child.once('error', (error) => {
    childProcessFailures.set(
      child,
      new Error(
        `${label} failed to start: ${error instanceof Error ? error.message : String(error)}`,
      ),
    );
  });
  return child;
}

function assertChildProcessRunning(child, label) {
  if (!child) return;
  const spawnFailure = childProcessFailures.get(child);
  if (spawnFailure) throw spawnFailure;
  if (child.exitCode !== null || child.signalCode !== null) {
    throw new Error(
      `${label} exited before it became ready (code=${child.exitCode ?? 'none'}, signal=${
        child.signalCode ?? 'none'
      }).`,
    );
  }
}

async function boundedFetch(url, init, attemptTimeoutMs, readResponse) {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort(new Error(`HTTP attempt timed out after ${attemptTimeoutMs}ms.`));
  }, attemptTimeoutMs);

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    return await readResponse(response);
  } finally {
    clearTimeout(timeout);
  }
}

async function waitForUrl(url, timeoutMs = 120_000, child = null, childLabel = 'process') {
  const startedAt = Date.now();
  let lastError = null;

  while (Date.now() - startedAt < timeoutMs) {
    assertChildProcessRunning(child, childLabel);
    const remainingMs = timeoutMs - (Date.now() - startedAt);
    const attemptTimeoutMs = Math.max(1, Math.min(httpAttemptTimeoutMs, remainingMs));
    try {
      const status = await boundedFetch(
        url,
        { redirect: 'manual' },
        attemptTimeoutMs,
        async (response) => {
          const responseStatus = response.status;
          await response.body?.cancel();
          return responseStatus;
        },
      );
      if (status < 500) return;
    } catch (error) {
      lastError = error;
    }

    assertChildProcessRunning(child, childLabel);
    const retryDelayMs = Math.min(500, timeoutMs - (Date.now() - startedAt));
    if (retryDelayMs > 0) await delay(retryDelayMs);
  }

  throw new Error(`Timed out waiting for ${url}: ${lastError?.message ?? 'no response'}`);
}

async function readJson(url, timeoutMs = 30_000, child = null, childLabel = 'process') {
  const startedAt = Date.now();
  let lastError = null;

  while (Date.now() - startedAt < timeoutMs) {
    assertChildProcessRunning(child, childLabel);
    const remainingMs = timeoutMs - (Date.now() - startedAt);
    const attemptTimeoutMs = Math.max(1, Math.min(httpAttemptTimeoutMs, remainingMs));
    try {
      const result = await boundedFetch(url, {}, attemptTimeoutMs, async (response) => {
        if (!response.ok) {
          await response.body?.cancel();
          return { ok: false, value: null };
        }
        return { ok: true, value: await response.json() };
      });
      if (result.ok) return result.value;
    } catch (error) {
      lastError = error;
    }

    assertChildProcessRunning(child, childLabel);
    const retryDelayMs = Math.min(250, timeoutMs - (Date.now() - startedAt));
    if (retryDelayMs > 0) await delay(retryDelayMs);
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

function startExpoServer() {
  const child = observeChildProcess(
    spawn(
      process.execPath,
      [
        path.join(repoRoot, 'node_modules', 'expo', 'bin', 'cli'),
        'start',
        '--web',
        '--port',
        String(appPort),
        '--host',
        'localhost',
      ],
      {
        cwd: path.join(repoRoot, 'apps', 'mobile'),
        env: {
          ...process.env,
          BROWSER: 'none',
          CI: '1',
          EXPO_PUBLIC_E2E_APP_LOCK_ENABLED: 'false',
          EXPO_PUBLIC_E2E_TODAY_ROUTINE: 'pm',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      },
    ),
    'Expo web',
  );

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
  const child = observeChildProcess(
    spawn(
      browserPath,
      [
        '--headless=new',
        `--remote-debugging-port=${debugPort}`,
        `--user-data-dir=${userDataDir}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-background-networking',
        '--disable-extensions',
        '--disable-gpu',
        '--disable-gpu-sandbox',
        '--disable-sync',
        '--hide-scrollbars',
        'about:blank',
      ],
      {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      },
    ),
    'Headless browser',
  );
  const logPath = path.join(evidenceDir, 'browser.log');
  const logLines = [];
  const append = (chunk) => {
    logLines.push(chunk.toString());
    writeFileSync(logPath, logLines.join(''));
  };
  child.stdout?.on('data', append);
  child.stderr?.on('data', append);
  return child;
}

class CdpClient {
  constructor(wsUrl) {
    this.events = [];
    this.nextId = 1;
    this.pending = new Map();
    this.ws = new WebSocket(wsUrl);
    this.ready = new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () =>
          reject(
            new Error(`Timed out opening the browser CDP socket after ${cdpCommandTimeoutMs}ms.`),
          ),
        cdpCommandTimeoutMs,
      );
      this.ws.addEventListener(
        'open',
        () => {
          clearTimeout(timeout);
          resolve();
        },
        { once: true },
      );
      this.ws.addEventListener(
        'error',
        () => {
          clearTimeout(timeout);
          reject(new Error('The browser CDP socket failed before opening.'));
        },
        { once: true },
      );
    });
    this.ws.addEventListener('message', (event) => this.handleMessage(event));
    this.ws.addEventListener('close', () => this.rejectPending('The browser CDP socket closed.'));
    this.ws.addEventListener('error', () => this.rejectPending('The browser CDP socket failed.'));
  }

  rejectPending(message) {
    for (const { reject, timeout } of this.pending.values()) {
      clearTimeout(timeout);
      reject(new Error(message));
    }
    this.pending.clear();
  }

  handleMessage(event) {
    const message = JSON.parse(event.data.toString());
    if (message.id && this.pending.has(message.id)) {
      const { reject, resolve, timeout } = this.pending.get(message.id);
      this.pending.delete(message.id);
      clearTimeout(timeout);

      if (message.error) {
        reject(new Error(`${message.error.message}: ${message.error.data ?? ''}`));
      } else {
        resolve(message.result ?? {});
      }
      return;
    }

    if (message.method) this.events.push(message);
  }

  async send(method, params = {}) {
    await this.ready;
    const id = this.nextId;
    this.nextId += 1;

    return await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Timed out waiting for browser CDP method ${method}.`));
      }, cdpCommandTimeoutMs);
      this.pending.set(id, { reject, resolve, timeout });
      try {
        this.ws.send(JSON.stringify({ id, method, params }));
      } catch (error) {
        clearTimeout(timeout);
        this.pending.delete(id);
        reject(error);
      }
    });
  }

  async close() {
    this.rejectPending('The browser CDP client is closing.');
    await Promise.race([
      new Promise((resolve) => {
        if (this.ws.readyState >= WebSocket.CLOSING) {
          resolve();
          return;
        }
        this.ws.addEventListener('close', resolve, { once: true });
        this.ws.close();
      }),
      delay(1_000),
    ]);
  }
}

async function connectToPage(browser) {
  const targets = await readJson(
    `http://127.0.0.1:${debugPort}/json`,
    30_000,
    browser,
    'Headless browser',
  );
  const pageTarget = targets.find(
    (target) => target.type === 'page' && target.webSocketDebuggerUrl,
  );
  if (!pageTarget) throw new Error('Chrome DevTools did not expose a page target.');

  const client = new CdpClient(pageTarget.webSocketDebuggerUrl);
  await client.ready;
  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('Log.enable');
  await client.send('Network.enable');
  return client;
}

async function evaluate(client, expression) {
  const result = await client.send('Runtime.evaluate', {
    awaitPromise: true,
    expression,
    returnByValue: true,
  });

  if (result.exceptionDetails) {
    const details = result.exceptionDetails;
    const exception = details.exception;
    const message =
      exception?.description ??
      exception?.value ??
      exception?.className ??
      details.text ??
      'Evaluation failed.';
    throw new Error(message);
  }

  return result.result?.value;
}

async function waitForExpression(client, expression, timeoutMs = 30_000) {
  const startedAt = Date.now();
  let lastValue;

  while (Date.now() - startedAt < timeoutMs) {
    lastValue = await evaluate(client, expression);
    if (lastValue) return lastValue;
    await delay(250);
  }

  throw new Error(`Timed out waiting for expression: ${expression}; last value: ${lastValue}`);
}

async function waitForLoad(client) {
  await waitForExpression(
    client,
    `document.body && document.body.innerText.trim().length > 0`,
    60_000,
  );
  await evaluate(
    client,
    `document.fonts && document.fonts.ready ? document.fonts.ready.then(() => true) : true`,
  );
}

async function waitForEntitlementSettled(client) {
  await waitForExpression(
    client,
    `!document.body?.innerText?.includes(${JSON.stringify(entitlementLoadingText)})`,
    entitlementWaitMs,
  );
}

async function waitForRoute(client, url) {
  const expected = new URL(url);
  const expectedPath = `${expected.pathname}${expected.search}`;
  await waitForExpression(
    client,
    `window.location.pathname + window.location.search === ${JSON.stringify(expectedPath)}`,
    60_000,
  );
}

function routeToFileStem(route) {
  return route
    .replace(/^\//, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
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

function disallowedLog(log) {
  const serialized = JSON.stringify(log);
  return !(
    serialized.includes('EXPO_PUBLIC_SUPABASE') ||
    serialized.includes('Notifications') ||
    serialized.includes('expo-notifications') ||
    serialized.includes('placeholder') ||
    serialized.includes('403') ||
    serialized.includes('supabase.co')
  );
}

function pressureExpression() {
  return `(() => {
    const scale = ${JSON.stringify(scale)};
    const nodes = Array.from(document.body.querySelectorAll('*'));
    let scaled = 0;

    for (const node of nodes) {
      const text = Array.from(node.childNodes).some((child) => child.nodeType === Node.TEXT_NODE && child.textContent.trim().length > 0);
      if (!text) continue;
      if (node.closest('[role="tab"]')) continue;

      const style = getComputedStyle(node);
      const fontSize = Number.parseFloat(style.fontSize);
      if (!Number.isFinite(fontSize) || fontSize < 8 || fontSize > 72) continue;

      const lineHeight = Number.parseFloat(style.lineHeight);
      node.dataset.e2eTextPressure = String(scale);
      node.style.fontSize = (fontSize * scale).toFixed(3) + 'px';
      if (Number.isFinite(lineHeight)) node.style.lineHeight = (lineHeight * scale).toFixed(3) + 'px';
      scaled += 1;
    }

    return scaled;
  })()`;
}

const auditExpression = `(() => {
  const viewport = { width: window.innerWidth, height: window.innerHeight };
  const root = document.documentElement;
  const body = document.body;
  const selector = [
    'a[href]',
    'button',
    'input',
    'select',
    'textarea',
    '[role="button"]',
    '[role="checkbox"]',
    '[role="switch"]',
    '[role="tab"]',
    '[tabindex]:not([tabindex="-1"])'
  ].join(',');
  const isVisible = (node, rect) => {
    const style = getComputedStyle(node);
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      rect.bottom > 0 &&
      rect.top < viewport.height &&
      style.visibility !== 'hidden' &&
      style.display !== 'none' &&
      Number.parseFloat(style.opacity || '1') > 0.01 &&
      node.getAttribute('aria-hidden') !== 'true'
    );
  };
  const labelOf = (node) =>
    node.getAttribute('aria-label') ||
    node.getAttribute('title') ||
    node.getAttribute('placeholder') ||
    node.innerText ||
    node.textContent ||
    node.getAttribute('data-testid') ||
    node.tagName;
  const controls = Array.from(document.querySelectorAll(selector))
    .map((node) => {
      const rect = node.getBoundingClientRect();
      if (!isVisible(node, rect)) return null;
      const visibleWidth = Math.max(0, Math.min(rect.right, viewport.width) - Math.max(rect.left, 0));
      const visibleHeight = Math.max(0, Math.min(rect.bottom, viewport.height) - Math.max(rect.top, 0));
      const center = {
        x: Math.max(0, Math.min(viewport.width - 1, rect.left + rect.width / 2)),
        y: Math.max(0, Math.min(viewport.height - 1, rect.top + rect.height / 2)),
      };
      const hit = document.elementFromPoint(center.x, center.y);
      const hitInside = Boolean(hit && (node === hit || node.contains(hit)));
      const role = node.getAttribute('role') || node.tagName.toLowerCase();
      const label = labelOf(node).replace(/\\s+/g, ' ').trim().slice(0, 140);
      return {
        center,
        centerBlocked: !hitInside,
        hitInside,
        hitTag: hit?.tagName ?? null,
        hitText: hit?.innerText?.replace(/\\s+/g, ' ').trim().slice(0, 140) ?? null,
        label,
        partialClip: rect.top < 0 || rect.bottom > viewport.height || rect.left < 0 || rect.right > viewport.width,
        rect: {
          bottom: rect.bottom,
          height: rect.height,
          left: rect.left,
          right: rect.right,
          top: rect.top,
          visibleHeight,
          visibleWidth,
          width: rect.width,
        },
        role,
        tag: node.tagName,
        tinyTarget: visibleHeight < 44 || visibleWidth < 44,
      };
    })
    .filter(Boolean);

  const issues = [];
  for (const control of controls) {
    if (control.role === 'tab') continue;
    if (control.tinyTarget) issues.push({ control, type: 'tinyTarget' });
    if (control.centerBlocked) issues.push({ control, type: 'centerBlocked' });
    if (control.partialClip && Math.min(control.rect.visibleHeight, control.rect.height) < 44) {
      issues.push({ control, type: 'partialClip' });
    }
  }

  const textOverflows = Array.from(document.querySelectorAll('[data-e2e-text-pressure]'))
    .map((node) => {
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      const text = node.textContent?.replace(/\\s+/g, ' ').trim() ?? '';
      return {
        clientWidth: node.clientWidth,
        overflow: node.scrollWidth - node.clientWidth,
        rect: { height: rect.height, width: rect.width },
        text: text.slice(0, 120),
        whiteSpace: style.whiteSpace,
      };
    })
    .filter((item) => item.text && item.overflow > 2 && item.whiteSpace !== 'normal')
    .slice(0, 20);

  return {
    controls,
    horizontalOverflow: Math.max(body.scrollWidth, root.scrollWidth) - viewport.width,
    issueCount: issues.length,
    issues,
    location: window.location.href,
    textOverflows,
    textStart: body.innerText.replace(/\\s+/g, ' ').trim().slice(0, 900),
    viewport,
  };
})()`;

async function auditRoute(client, route) {
  const url = new URL(route, baseUrl).toString();
  await client.send('Page.navigate', { url });
  await waitForRoute(client, url);
  await waitForLoad(client);
  await waitForEntitlementSettled(client);
  await delay(350);
  const scaledCount = await evaluate(client, pressureExpression());
  await delay(150);

  const result = await evaluate(client, auditExpression);
  result.route = route;
  result.scaledCount = scaledCount;
  result.textScale = scale;
  result.url = url;

  if (result.horizontalOverflow > 1) {
    result.issues.push({
      horizontalOverflow: result.horizontalOverflow,
      type: 'horizontalOverflow',
    });
    result.issueCount = result.issues.length;
  }
  if (result.textOverflows.length > 0) {
    result.issues.push({ textOverflows: result.textOverflows, type: 'textOverflow' });
    result.issueCount = result.issues.length;
  }

  return result;
}

async function auditRouteWithRetry(client, route) {
  let lastError = null;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      return await auditRoute(client, route);
    } catch (error) {
      lastError = error;
      if (attempt < 2) {
        await delay(500);
      }
    }
  }

  const url = new URL(route, baseUrl).toString();
  const message = lastError instanceof Error ? lastError.message : String(lastError);
  return {
    controls: [],
    horizontalOverflow: 0,
    issueCount: 1,
    issues: [{ message, type: 'routeAuditError' }],
    location: null,
    route,
    scaledCount: 0,
    textOverflows: [],
    textScale: scale,
    textStart: '',
    url,
    viewport,
  };
}

async function run() {
  clearPreviousEvidence();

  let browser = null;
  let client = null;
  let server = null;
  const userDataDir = path.join(tmpdir(), `layerwell-text-pressure-${process.pid}`);
  const summary = {
    baseUrl,
    evidenceDir,
    generatedAt: new Date().toISOString(),
    routeCount: routes.length,
    scale,
    status: 'pass',
    viewport,
  };

  try {
    if (shouldStartServer) {
      server = startExpoServer();
      await waitForUrl(baseUrl, 120_000, server, 'Expo web');
    }

    const browserPath = findBrowserPath();
    browser = startBrowser(browserPath, userDataDir);
    await readJson(
      `http://127.0.0.1:${debugPort}/json/version`,
      30_000,
      browser,
      'Headless browser',
    );
    client = await connectToPage(browser);
    await client.send('Emulation.setDeviceMetricsOverride', {
      deviceScaleFactor: 2,
      height: viewport.height,
      mobile: false,
      screenHeight: viewport.height,
      screenWidth: viewport.width,
      width: viewport.width,
    });

    const results = [];
    const failedRoutes = [];

    for (const route of routes) {
      const name = routeToFileStem(route);
      const beforeEventIndex = client.events.length;
      const result = await auditRouteWithRetry(client, route);
      const routeLogs = collectProblemLogs(client.events.slice(beforeEventIndex));
      const disallowedLogs = routeLogs.filter(disallowedLog);
      result.disallowedLogCount = disallowedLogs.length;
      result.disallowedLogs = disallowedLogs;
      if (disallowedLogs.length > 0) {
        result.issues.push({ logs: disallowedLogs, type: 'disallowedBrowserLogs' });
        result.issueCount = result.issues.length;
      }

      try {
        await screenshot(client, name);
      } catch (error) {
        result.issues.push({
          message: error instanceof Error ? error.message : String(error),
          type: 'screenshotError',
        });
        result.issueCount = result.issues.length;
      }
      writeJson(`${name}.json`, result);
      results.push({
        disallowedLogCount: result.disallowedLogCount,
        issueCount: result.issueCount,
        issues: result.issues,
        route,
        scaledCount: result.scaledCount,
        textStart: result.textStart,
      });

      if (result.issueCount > 0) failedRoutes.push(results.at(-1));
    }

    summary.failedRouteCount = failedRoutes.length;
    summary.failedRoutes = failedRoutes;
    summary.results = results.map(
      ({ issues: _issues, textStart: _textStart, ...result }) => result,
    );
    if (failedRoutes.length > 0) summary.status = 'fail';

    writeJson('summary.json', summary);
    writeJson('failures.json', { failedRouteCount: failedRoutes.length, failedRoutes });
    writeFileSync(
      path.join(evidenceDir, 'report.md'),
      [
        '# Text-Pressure Route Audit',
        '',
        `Generated: ${summary.generatedAt}`,
        `Viewport: ${viewport.width} x ${viewport.height}`,
        `Text pressure scale: ${scale}`,
        `Status: ${summary.status}`,
        `Failed routes: ${failedRoutes.length} / ${routes.length}`,
        '',
        'This Expo web pass multiplies direct text-node font sizes and line heights after',
        'route render, then checks visible controls for clipping, blocked hit targets,',
        'sub-44 px visible targets, horizontal overflow, and unexpected browser logs.',
        '',
        '## Failed Routes',
        '',
        ...(failedRoutes.length
          ? failedRoutes.map((failure) => `- ${failure.route}: ${failure.issueCount} issue(s)`)
          : ['- None.']),
        '',
        '## Remaining Risk',
        '',
        '- Native iOS/Android Dynamic Type, VoiceOver, TalkBack, keyboard, and hardware safe-area behavior still require device QA.',
        '',
      ].join('\n'),
    );

    assert(failedRoutes.length === 0, `${failedRoutes.length} text-pressure route(s) failed.`);
    console.log(`Text-pressure route audit passed. Evidence: ${evidenceDir}`);
  } catch (error) {
    summary.status = 'fail';
    summary.error = error instanceof Error ? error.message : String(error);
    writeJson('summary.json', summary);
    throw error;
  } finally {
    await settleWithin(() => client?.close(), 3_000, 'closing the browser CDP client');
    await settleWithin(() => stopProcess(browser), 5_000, 'stopping the headless browser');
    await settleWithin(() => stopProcess(server), 5_000, 'stopping Expo web');
    try {
      rmSync(userDataDir, { force: true, maxRetries: 5, recursive: true, retryDelay: 250 });
    } catch (error) {
      console.warn(
        `WARN Could not remove temporary browser profile: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}

await run();
