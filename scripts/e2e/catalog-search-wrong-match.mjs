import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const isWindows = process.platform === 'win32';
const today = new Date().toISOString().slice(0, 10);
const requestedAppPort = Number(process.env.CATALOG_WRONG_MATCH_E2E_PORT ?? 8426);
const externalBaseUrl = process.env.CATALOG_WRONG_MATCH_E2E_BASE_URL;
const shouldStartServer = !externalBaseUrl;
const appPort = shouldStartServer ? await findAvailablePort(requestedAppPort) : requestedAppPort;
const evidenceDir =
  process.env.CATALOG_WRONG_MATCH_E2E_EVIDENCE_DIR ??
  path.join(repoRoot, 'test-results', 'human-e2e', today, 'catalog-search-wrong-match-current');
const debugPort = Number(process.env.CATALOG_WRONG_MATCH_E2E_DEBUG_PORT ?? 9526);
const baseUrl = externalBaseUrl ?? `http://localhost:${appPort}`;
const primaryViewport = { height: 844, width: 390 };
const supportFloorViewport = { height: 640, width: 360 };
const searchQuery = 'ceramide cleanser';

mkdirSync(evidenceDir, { recursive: true });

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function clearPreviousEvidence() {
  for (const entry of readdirSync(evidenceDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    if (!/\.(?:json|log|md|png)$/i.test(entry.name)) continue;
    rmSync(path.join(evidenceDir, entry.name), { force: true });
  }
}

function hostPortAvailable(host, port) {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.listen(port, host, () => {
      server.close(() => resolve(true));
    });
  });
}

async function portAvailable(port) {
  return (await hostPortAvailable('127.0.0.1', port)) && (await hostPortAvailable('::1', port));
}

async function findAvailablePort(preferred) {
  for (let offset = 0; offset <= 80; offset += 1) {
    const port = preferred + offset;
    if (await portAvailable(port)) return port;
  }

  throw new Error(`Could not find an open localhost port from ${preferred} to ${preferred + 80}.`);
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
      'Could not find Chrome or Edge. Set CHROME_PATH or BROWSER_PATH to run catalog E2E.',
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

async function stopProcessBestEffort(child) {
  await Promise.race([stopProcess(child), delay(6_000)]);
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
  const child = spawn(command, args, {
    cwd: repoRoot,
    env: {
      ...process.env,
      BROWSER: 'none',
      CI: '1',
      EXPO_PUBLIC_E2E_APP_LOCK_ENABLED: 'false',
      EXPO_PUBLIC_E2E_CATALOG_SEARCH_RESULT: 'wrong_match',
      EXPO_PUBLIC_E2E_LOCAL_RESET: '1',
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

async function waitForText(client, text, timeoutMs = 30_000) {
  await waitForCondition(
    client,
    `document.body && document.body.innerText.includes(${JSON.stringify(text)})`,
    timeoutMs,
    `text "${text}"`,
  );
}

async function waitForPath(client, pathOrPrefix, timeoutMs = 30_000) {
  await waitForCondition(
    client,
    `window.location.pathname.startsWith(${JSON.stringify(pathOrPrefix)})`,
    timeoutMs,
    `path ${pathOrPrefix}`,
  );
}

async function setViewport(client, viewport) {
  await client.send('Emulation.setDeviceMetricsOverride', {
    deviceScaleFactor: 1,
    height: viewport.height,
    mobile: true,
    screenHeight: viewport.height,
    screenWidth: viewport.width,
    width: viewport.width,
  });
  await client.send('Emulation.setTouchEmulationEnabled', { enabled: true });
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
    const nodes = Array.from(document.querySelectorAll('button,[role="button"],a,label'));
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

function clickTextExpression(label, exact) {
  return `(() => {
    const label = ${JSON.stringify(label)};
    const exact = ${JSON.stringify(exact)};
    const normalize = (value) => String(value ?? '').replace(/\\s+/g, ' ').trim();
    const textMatches = (text) => exact ? text === label : text.includes(label);
    const visible = (node) => {
      if (!(node instanceof Element)) return false;
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity || '1') > 0;
    };
    const nodes = Array.from(document.querySelectorAll('button,[role="button"],a,label'));
    const matches = nodes.filter((node) => {
      if (!visible(node)) return false;
      const values = [
        node.getAttribute('aria-label'),
        node.getAttribute('accessibilitylabel'),
        node.textContent,
        node.getAttribute('title'),
      ].map(normalize).filter(Boolean);
      return values.some(textMatches);
    });
    matches.sort((a, b) => {
      const aRect = a.getBoundingClientRect();
      const bRect = b.getBoundingClientRect();
      const aIn = aRect.left >= 0 && aRect.right <= innerWidth && aRect.top >= 0 && aRect.bottom <= innerHeight ? 0 : 1;
      const bIn = bRect.left >= 0 && bRect.right <= innerWidth && bRect.top >= 0 && bRect.bottom <= innerHeight ? 0 : 1;
      if (aIn !== bIn) return aIn - bIn;
      return aRect.width * aRect.height - bRect.width * bRect.height;
    });
    const target = matches[0];
    if (!target || target.disabled || target.getAttribute('aria-disabled') === 'true') return false;
    const rect = target.getBoundingClientRect();
    const eventBase = {
      bubbles: true,
      button: 0,
      cancelable: true,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
      view: window,
    };
    target.dispatchEvent(new PointerEvent('pointerdown', { ...eventBase, buttons: 1, pointerId: 1, pointerType: 'mouse' }));
    target.dispatchEvent(new MouseEvent('mousedown', { ...eventBase, buttons: 1 }));
    target.dispatchEvent(new PointerEvent('pointerup', { ...eventBase, buttons: 0, pointerId: 1, pointerType: 'mouse' }));
    target.dispatchEvent(new MouseEvent('mouseup', { ...eventBase, buttons: 0 }));
    target.click();
    return true;
  })()`;
}

function focusTextExpression(label, exact) {
  return `(() => {
    const label = ${JSON.stringify(label)};
    const exact = ${JSON.stringify(exact)};
    const normalize = (value) => String(value ?? '').replace(/\\s+/g, ' ').trim();
    const textMatches = (text) => exact ? text === label : text.includes(label);
    const nodes = Array.from(document.querySelectorAll('button,[role="button"],a,label'));
    const target = nodes.find((node) => {
      const values = [
        node.getAttribute('aria-label'),
        node.getAttribute('accessibilitylabel'),
        node.textContent,
        node.getAttribute('title'),
      ].map(normalize).filter(Boolean);
      return values.some(textMatches);
    });
    if (!target || target.disabled || target.getAttribute('aria-disabled') === 'true') return false;
    target.focus();
    return document.activeElement === target || target.contains(document.activeElement);
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

  const clicked = await evaluate(client, clickTextExpression(label, exact));
  assert(clicked, `Clickable text did not activate: ${label}`);
  await evaluate(client, focusTextExpression(label, exact));
  await client.send('Input.dispatchKeyEvent', {
    code: 'Enter',
    key: 'Enter',
    type: 'keyDown',
    windowsVirtualKeyCode: 13,
  });
  await client.send('Input.dispatchKeyEvent', {
    code: 'Enter',
    key: 'Enter',
    type: 'keyUp',
    windowsVirtualKeyCode: 13,
  });
  await delay(300);
  return rect;
}

async function scrollControlIntoView(client, label) {
  const scrolled = await evaluate(
    client,
    `(() => {
      const wanted = ${JSON.stringify(label)};
      const normalize = (value) => String(value ?? '').replace(/\\s+/g, ' ').trim();
      const target = Array.from(document.querySelectorAll('button,[role="button"]')).find(
        (node) => normalize(node.getAttribute('aria-label') || node.textContent) === wanted,
      );
      if (!target) return false;
      target.scrollIntoView({ block: 'center', inline: 'nearest' });
      return true;
    })()`,
  );
  assert(scrolled, `Could not scroll control into view: ${label}`);
  await delay(200);
}

function enabledButtonExpression(label) {
  return `(() => {
    const label = ${JSON.stringify(label)};
    const normalize = (next) => String(next ?? '').replace(/\\s+/g, ' ').trim();
    const nodes = Array.from(document.querySelectorAll('button,[role="button"],a,label'));
    return nodes.some((node) => {
      const values = [
        node.getAttribute('aria-label'),
        node.getAttribute('accessibilitylabel'),
        node.textContent,
        node.getAttribute('title'),
      ].map(normalize).filter(Boolean);
      if (!values.some((value) => value === label)) return false;
      return !node.disabled && node.getAttribute('aria-disabled') !== 'true';
    });
  })()`;
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
    const nodes = Array.from(document.querySelectorAll('button,[role="button"],a,input,textarea,select'));
    const controls = [];
    const issues = [];

    for (const node of nodes) {
      if (!visible(node)) continue;
      const rect = node.getBoundingClientRect();
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
        x: Math.max(0, Math.min(innerWidth - 1, rect.left + rect.width / 2)),
        y: Math.max(0, Math.min(innerHeight - 1, rect.top + rect.height / 2)),
      };
      const hit = document.elementFromPoint(center.x, center.y);
      const hitOk = !hit || node === hit || node.contains(hit) || hit.contains(node);
      const item = {
        disabled,
        height: Number(rect.height.toFixed(2)),
        hitOk,
        label,
        role: node.getAttribute('role') || node.tagName.toLowerCase(),
        text: normalize(node.textContent || node.value).slice(0, 220),
        width: Number(rect.width.toFixed(2)),
        x: Number(rect.left.toFixed(2)),
        y: Number(rect.top.toFixed(2)),
      };
      controls.push(item);
      if (rect.left < -1 || rect.right > innerWidth + 1 || rect.top < -1 || rect.bottom > innerHeight + 1) {
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

    const dialog = document.querySelector('[role="dialog"],dialog');
    const alert = document.querySelector('[role="alert"]');
    const inputs = Array.from(document.querySelectorAll('input,textarea')).map((node) => ({
      label: normalize(node.getAttribute('aria-label') || node.getAttribute('accessibilitylabel') || node.getAttribute('placeholder')),
      value: node.value,
    }));

    return {
      alertText: normalize(alert?.textContent),
      bodyText: normalize(document.body?.innerText).slice(0, 5000),
      controls,
      dialogText: normalize(dialog?.textContent),
      inputs,
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

async function captureStep(client, name, { assertClean = true } = {}) {
  await delay(300);
  const snapshot = await evaluate(client, auditExpression());
  writeJson(`${name}.json`, snapshot);
  await screenshot(client, name);
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
  return control;
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
    serialized.includes('supabase.co') ||
    serialized.includes('placeholder') ||
    serialized.includes('403') ||
    serialized.includes('shadow') ||
    serialized.includes('props.pointerEvents is deprecated') ||
    serialized.includes(
      '[expo-notifications] Listening to push token changes is not yet fully supported on web',
    )
  );
}

async function openSearch(client, viewport) {
  await setViewport(client, viewport);
  const url = new URL('/shelf/search', baseUrl);
  url.searchParams.set('e2eReset', 'local');
  url.searchParams.set('e2eQuery', searchQuery);
  await client.send('Page.navigate', { url: url.toString() });
  await waitForPath(client, '/shelf/search');
  await waitForText(client, 'Search catalog');
  await waitForText(client, 'Add by hand');
}

async function searchForFixture(client) {
  const querySeeded = await evaluate(
    client,
    `Array.from(document.querySelectorAll('input,textarea')).some((node) => node.value === ${JSON.stringify(searchQuery)})`,
  );
  assert(querySeeded, 'Catalog search query was not prefilled from e2eQuery.');
  await waitForCondition(client, enabledButtonExpression('Search'), 5_000, 'enabled Search button');
  await clickByText(client, 'Search');
  await waitForText(client, 'Wrong Catalog Serum');
  await waitForText(client, 'Not this product');
}

function writeReport(summary) {
  const evidencePath = path.relative(repoRoot, evidenceDir).replace(/\\/g, '/');
  const lines = [
    '# Human-Simulated E2E Run Report',
    '',
    '## Summary',
    '',
    `- Date: ${summary.date}`,
    '- Codex task: Catalog search wrong-match pre-add reporting',
    '- App surface: Expo web',
    `- Build/start command: \`${summary.startCommand}\``,
    '- Browser/device/simulator/OS: Headless Chrome or Edge, 390 x 844 plus 360 x 640 support-floor spot check',
    '- Feature or PR tested: Shelf catalog search result reporting',
    `- Overall verdict: ${summary.verdict === 'pass' ? 'Pass' : 'Fail'}`,
    '',
    '## Flows Executed',
    '',
    '| Flow | Branch | Result | Evidence | Notes |',
    '| ---- | ------ | ------ | -------- | ----- |',
    `| Shelf catalog search | Wrong match before add | ${summary.verdict} | \`${evidencePath}\` | Searched \`${searchQuery}\`, reported \`Not this product\`, saw inline feedback, then continued to manual add with query preserved. |`,
    `| Shelf catalog search | 360 x 640 support-floor controls | ${summary.verdict} | \`${evidencePath}\` | Result card, \`Use this match\`, \`Not this product\`, Search, Back, and Add by hand were complete and center-hit-testable. |`,
    '',
    '## Bugs Found',
    '',
    summary.verdict === 'pass'
      ? 'None in this pass.'
      : 'See `summary.json`, JSON snapshots, screenshots, and browser logs in this evidence folder.',
    '',
    '## Commands Run',
    '',
    '```bash',
    'npm run e2e:catalog-search-wrong-match',
    '```',
    '',
    '## Remaining Risk',
    '',
    '- Live Supabase insertion remains backend/environment QA because this run uses the offline placeholder configuration.',
    '- Native iOS/Android camera and OS-level catalog recovery QA remain separate device work.',
    '',
  ];

  writeFileSync(path.join(evidenceDir, 'report.md'), `${lines.join('\n')}\n`);
}

async function run() {
  clearPreviousEvidence();

  let server = null;
  let browser = null;
  let client = null;
  const userDataDir = mkdtempSync(path.join(tmpdir(), 'routinekind-catalog-wrong-match-'));
  const summary = {
    date: today,
    endUrl: null,
    startCommand: shouldStartServer
      ? `EXPO_PUBLIC_E2E_CATALOG_SEARCH_RESULT=wrong_match npm --workspace apps/mobile run web -- --port ${appPort} --host localhost`
      : `CATALOG_WRONG_MATCH_E2E_BASE_URL=${baseUrl} npm run e2e:catalog-search-wrong-match`,
    verdict: 'fail',
  };

  try {
    if (shouldStartServer) server = startExpoServer();
    await waitForUrl(baseUrl);

    browser = startBrowser(findBrowserPath(), userDataDir);
    client = await connectToPage();
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('Log.enable');
    await client.send('Page.bringToFront');

    await openSearch(client, primaryViewport);
    const start = await captureStep(client, '01-search-start-390x844');
    assertInteractiveControl(start, 'Catalog search query');
    assertInteractiveControl(start, 'Search');
    assertInteractiveControl(start, 'Add by hand');

    await searchForFixture(client);
    const result = await captureStep(client, '02-wrong-match-result-390x844');
    assert(
      result.bodyText.includes('Wrong Catalog Serum'),
      'Search result did not render fixture.',
    );
    assert(result.bodyText.includes('Mismatch Lab'), 'Search result did not render fixture brand.');
    assertInteractiveControl(result, 'Use');
    assertInteractiveControl(result, 'Not this product');

    await clickByText(client, 'Not this product');
    await waitForText(client, 'Confirm catalog report');
    await scrollControlIntoView(client, 'Send report');
    const confirmation = await captureStep(client, '03-wrong-match-confirmation-390x844');
    assertInteractiveControl(confirmation, 'Send report');
    assert(
      confirmation.bodyText.includes('Catalog product ID') &&
        confirmation.bodyText.includes('RoutineKind account ID') &&
        confirmation.bodyText.includes('Nothing is sent to Open Beauty Facts'),
      'Wrong-match confirmation did not disclose identity, account linkage, and recipients.',
    );
    await clickByText(client, 'Send report');
    await waitForText(client, 'Report not sent');
    const reported = await captureStep(client, '04-wrong-match-inline-feedback-390x844');
    assert(
      reported.alertText.includes('Report not sent'),
      'Wrong-match feedback was not an alert.',
    );
    assert(
      reported.bodyText.includes(
        'Catalog reporting is unavailable in this build, so nothing was sent.',
      ),
      'Offline report fallback copy did not render.',
    );
    assert(!reported.dialogText, 'Wrong-match feedback opened a dialog.');
    assertInteractiveControl(reported, 'Add by hand');

    await clickByText(client, 'Add by hand');
    await waitForPath(client, '/shelf/manual');
    const manual = await captureStep(client, '05-manual-recovery-390x844');
    assert(
      manual.inputs.some((input) => input.label === 'Product name'),
      'Manual add did not expose the Product name input.',
    );
    assert(
      manual.inputs.some((input) => input.label === 'Product name' && input.value === searchQuery),
      'Manual add did not preserve the wrong-match search query.',
    );

    await openSearch(client, supportFloorViewport);
    await searchForFixture(client);
    const support = await captureStep(client, '06-wrong-match-result-360x640');
    assertInteractiveControl(support, 'Back');
    assertInteractiveControl(support, 'Search');
    assertInteractiveControl(support, 'Use');
    assertInteractiveControl(support, 'Not this product');
    assertInteractiveControl(support, 'Add by hand');

    const problemLogs = collectProblemLogs(client.events).filter(disallowedLog);
    writeJson('browser-problem-logs.json', problemLogs);
    assert(problemLogs.length === 0, `Unexpected browser warnings/errors: ${problemLogs.length}`);

    summary.endUrl = await evaluate(client, 'window.location.href');
    summary.verdict = 'pass';
  } catch (error) {
    summary.error = error instanceof Error ? error.message : String(error);
    process.exitCode = 1;
  } finally {
    if (client) {
      try {
        summary.endUrl ??= await evaluate(client, 'window.location.href');
      } catch {
        summary.endUrl ??= null;
      }
      client.close();
    }
    writeJson('summary.json', summary);
    writeReport(summary);
    await stopProcessBestEffort(browser);
    await stopProcessBestEffort(server);
    try {
      rmSync(userDataDir, { force: true, recursive: true });
    } catch (error) {
      writeJson('cleanup-warning.json', {
        message: error instanceof Error ? error.message : String(error),
        userDataDir,
      });
    }
  }
}

await run();
