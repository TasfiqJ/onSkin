import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const isWindows = process.platform === 'win32';
const today = new Date().toISOString().slice(0, 10);
const evidenceDir =
  process.env.TABBAR_E2E_EVIDENCE_DIR ??
  path.join(repoRoot, 'test-results', 'human-e2e', today, 'navigation-native-tabbar-current');
const appPort = Number(process.env.TABBAR_E2E_PORT ?? 8184);
const debugPort = Number(process.env.TABBAR_E2E_DEBUG_PORT ?? 9284);
const baseUrl = process.env.TABBAR_E2E_BASE_URL ?? `http://localhost:${appPort}`;
const shouldStartServer = !process.env.TABBAR_E2E_BASE_URL;
const viewports = [
  { name: '320x568', width: 320, height: 568 },
  { name: '360x640', width: 360, height: 640 },
  { name: '375x667', width: 375, height: 667 },
  { name: '390x844', width: 390, height: 844 },
  { name: '412x915', width: 412, height: 915 },
  { name: '430x932', width: 430, height: 932 },
];
const tabs = [
  { label: 'Today', route: 'today' },
  { label: 'Progress', route: 'progress' },
  { label: 'Shelf', route: 'shelf' },
  { label: 'You', route: 'you' },
];

mkdirSync(evidenceDir, { recursive: true });

function assert(condition, message) {
  if (!condition) throw new Error(message);
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
      'Could not find Chrome or Edge. Set CHROME_PATH or BROWSER_PATH to run native-tab geometry E2E.',
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
  if (!child?.pid || child.exitCode !== null) return;
  if (!isWindows) {
    child.kill('SIGTERM');
    await delay(250);
    if (child.exitCode === null) child.kill('SIGKILL');
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
  await delay(500);
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
      EXPO_NO_DOTENV: '1',
      EXPO_PUBLIC_APP_ENV: 'development',
      EXPO_PUBLIC_E2E_FIRST_SESSION_AUTH: 'anonymous_owner',
      CI: '1',
      EXPO_PUBLIC_E2E_APP_LOCK_ENABLED: 'false',
      EXPO_PUBLIC_E2E_ENTITLEMENT: 'store_pro',
      EXPO_PUBLIC_E2E_TODAY_ROUTINE: 'pm',
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
    { stdio: 'ignore', windowsHide: true },
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
      if (message.error) reject(new Error(`${message.error.message}: ${message.error.data ?? ''}`));
      else resolve(message.result ?? {});
      return;
    }
    if (message.method) this.events.push(message);
  }

  async send(method, params = {}) {
    await this.ready;
    const id = this.nextId++;
    return await new Promise((resolve, reject) => {
      this.pending.set(id, { reject, resolve });
      this.ws.send(JSON.stringify({ id, method, params }));
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
  if (result.exceptionDetails)
    throw new Error(result.exceptionDetails.text ?? 'Evaluation failed.');
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
    `(() => {
      const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
      const text = tabs.map((node) => (node.textContent ?? '').replace(/\\s+/g, ' ').trim());
      return document.querySelector('[role="tablist"]') &&
        ${JSON.stringify(tabs.map((tab) => tab.label))}.every((label) => text.some((value) => value.includes(label)));
    })()`,
    60_000,
  );
  await evaluate(
    client,
    `document.fonts && document.fonts.ready ? document.fonts.ready.then(() => true) : true`,
  );
}

async function screenshot(client, name) {
  const result = await client.send('Page.captureScreenshot', {
    captureBeyondViewport: false,
    format: 'png',
  });
  writeFileSync(path.join(evidenceDir, `${name}.png`), Buffer.from(result.data, 'base64'));
}

const snapshotExpression = `(() => {
  const tabSpecs = ${JSON.stringify(tabs)};
  const normalize = (value) => (value ?? '').replace(/\\s+/g, ' ').trim();
  const rectOf = (node) => {
    if (!node) return null;
    const rect = node.getBoundingClientRect();
    return { bottom: rect.bottom, height: rect.height, left: rect.left, right: rect.right, top: rect.top, width: rect.width, x: rect.x, y: rect.y };
  };
  const tabList = document.querySelector('[role="tablist"]');
  const tabNodes = Array.from(document.querySelectorAll('[role="tab"]'));
  const body = document.body;
  const root = document.documentElement;
  const items = tabSpecs.map((spec) => {
    const node = tabNodes.find((candidate) => normalize(candidate.textContent).includes(spec.label)) ?? null;
    const rect = rectOf(node);
    const labelNode = node ? Array.from(node.querySelectorAll('*')).find(n => n.children.length === 0 && normalize(n.textContent) === spec.label) : null;
    const center = rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : null;
    const hit = center ? document.elementFromPoint(center.x, center.y) : null;
    return {
      ariaLabel: node?.getAttribute('aria-label') ?? null,
      centerHitContains: Boolean(node && hit && (node === hit || node.contains(hit))),
      label: spec.label,
      iconRect: rectOf(node?.querySelector('svg')),
      labelRect: rectOf(labelNode),
      labelLineHeight: labelNode ? parseFloat(getComputedStyle(labelNode).lineHeight) : 0,
      rect,
      route: spec.route,
      selected: node?.getAttribute('aria-selected') === 'true',
      text: normalize(node?.textContent),
    };
  });
  return {
    horizontalOverflow: Math.max(body.scrollWidth, root.scrollWidth) - window.innerWidth,
    innerHeight: window.innerHeight,
    innerWidth: window.innerWidth,
    location: window.location.href,
    selectedCount: items.filter((item) => item.selected).length,
    tabList: { rect: rectOf(tabList), role: tabList?.getAttribute('role') ?? null },
    tabs: items,
  };
})()`;

function validateSnapshot(snapshot, expectedSelectedLabel, viewportName) {
  assert(snapshot.innerWidth > 0, `${viewportName}: missing viewport width`);
  assert(
    snapshot.horizontalOverflow <= 1,
    `${viewportName}: horizontal overflow ${snapshot.horizontalOverflow}`,
  );
  assert(snapshot.tabList?.role === 'tablist', `${viewportName}: missing tablist role`);
  assert(snapshot.tabList.rect, `${viewportName}: missing native tab bar bounds`);
  assert(
    snapshot.tabList.rect.width <= snapshot.innerWidth + 1,
    `${viewportName}: tab bar escapes viewport width`,
  );
  assert(snapshot.tabList.rect.left >= -1, `${viewportName}: tab bar escapes viewport left`);
  assert(
    snapshot.tabList.rect.right <= snapshot.innerWidth + 1,
    `${viewportName}: tab bar escapes viewport right`,
  );
  assert(
    snapshot.tabList.rect.bottom <= snapshot.innerHeight + 1,
    `${viewportName}: tab bar escapes viewport bottom`,
  );
  assert(snapshot.selectedCount === 1, `${viewportName}: expected exactly one selected tab`);

  for (const tab of snapshot.tabs) {
    assert(tab.rect, `${viewportName}: missing ${tab.label} tab`);
    assert(
      tab.text.includes(tab.label),
      `${viewportName}: ${tab.label} label is missing or abbreviated`,
    );
    assert(tab.rect.height >= 44, `${viewportName}: ${tab.label} hit target is under 44px tall`);
    assert(tab.rect.width >= 44, `${viewportName}: ${tab.label} hit target is under 44px wide`);
    assert(
      tab.labelRect && tab.labelRect.height >= tab.labelLineHeight - 1,
      `${viewportName}: ${tab.label} label is vertically clipped`,
    );
    assert(
      snapshot.tabList.rect.left >= 16 && snapshot.tabList.rect.right <= snapshot.innerWidth - 16,
      `${viewportName}: dock must float inside the screen edges`,
    );
    assert(
      tab.iconRect?.width >= 20 && tab.iconRect?.height >= 20,
      `${viewportName}: ${tab.label} icon is missing or too small`,
    );
    assert(tab.centerHitContains, `${viewportName}: ${tab.label} center hit-test misses the tab`);
    assert(
      tab.selected === (tab.label === expectedSelectedLabel),
      `${viewportName}: ${tab.label} selected state mismatch`,
    );
  }
}

function writeJson(name, value) {
  writeFileSync(path.join(evidenceDir, name), `${JSON.stringify(value, null, 2)}\n`);
}

function collectProblemLogs(events) {
  return events
    .filter((event) => {
      if (event.method === 'Runtime.consoleAPICalled')
        return ['error', 'warning'].includes(event.params.type);
      if (event.method === 'Log.entryAdded')
        return ['error', 'warning'].includes(event.params.entry.level);
      return event.method === 'Runtime.exceptionThrown';
    })
    .map((event) => ({ method: event.method, params: event.params }));
}

function textCondition(text) {
  return `document.body && document.body.innerText.includes(${JSON.stringify(text)})`;
}

async function waitForText(client, text, timeoutMs = 30_000) {
  await waitForExpression(client, textCondition(text), timeoutMs, `text "${text}"`);
}

async function waitForPath(client, pathOrPrefix, timeoutMs = 30_000) {
  await waitForExpression(
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


async function run() {
  let server = null;
  let browser = null;
  let client = null;
  const userDataDir = path.join(tmpdir(), `layerwell-native-tabbar-cdp-${process.pid}`);
  const summary = {
    baseUrl,
    evidenceDir,
    generatedAt: new Date().toISOString(),
    status: 'pass',
    viewports: [],
  };

  try {
    if (shouldStartServer) {
      server = startExpoServer();
      await waitForUrl(baseUrl);
    }
    const browserPath = findBrowserPath();
    browser = startBrowser(browserPath, userDataDir);
    await readJson(`http://127.0.0.1:${debugPort}/json/version`);
    client = await connectToPage();

    await client.send('Emulation.setDeviceMetricsOverride', { deviceScaleFactor: 2, height: 844, width: 390, mobile: false });
    await client.send('Page.navigate', { url: baseUrl });
    await waitForText(client, 'Begin', 60_000);
    await scrollTextIntoView(client, 'Begin');
    await clickByText(client, 'Begin');
    await waitForText(client, 'First, your');
    await fillByLabel(client, 'Day of birth', '01');
    await fillByLabel(client, 'Month of birth', '01');
    await fillByLabel(client, 'Year of birth', '1990');
    await clickByText(client, 'Continue');
    await waitForText(client, 'Before the quiz');
    await clickByText(client, 'I agree. Continue');
    await waitForText(client, 'What brings you here?');
    await screenshot(client, 'setup-age-and-consent-complete');

    for (const viewport of viewports) {
      await client.send('Emulation.setDeviceMetricsOverride', {
        deviceScaleFactor: 2,
        height: viewport.height,
        mobile: false,
        screenHeight: viewport.height,
        screenWidth: viewport.width,
        width: viewport.width,
      });
      const viewportResult = { ...viewport, steps: [] };
      for (const tab of tabs) {
        if (tab.route === 'today') {
          await client.send('Page.navigate', { url: `${baseUrl}/${tab.route}` });
        } else {
          const current = await evaluate(client, snapshotExpression);
          const target = current.tabs.find((item) => item.label === tab.label).rect;
          const point = {
            x: target.x + target.width / 2,
            y: target.y + target.height / 2,
            button: 'left',
            clickCount: 1,
          };
          await client.send('Input.dispatchMouseEvent', { ...point, type: 'mousePressed' });
          await client.send('Input.dispatchMouseEvent', { ...point, type: 'mouseReleased' });
        }
        await waitForLoad(client);
        await waitForExpression(
          client,
          `(() => Array.from(document.querySelectorAll('[role="tab"]')).some((node) =>
            (node.textContent ?? '').includes(${JSON.stringify(tab.label)}) && node.getAttribute('aria-selected') === 'true'))()`,
        );
        const snapshot = await evaluate(client, snapshotExpression);
        const stepName = `${viewport.name}-${tab.route}`;
        writeJson(`${stepName}.json`, snapshot);
        validateSnapshot(snapshot, tab.label, viewport.name);
        await screenshot(client, stepName);
        viewportResult.steps.push({
          selected: tab.label,
          snapshot: `${stepName}.json`,
          screenshot: `${stepName}.png`,
        });
      }
      summary.viewports.push(viewportResult);
    }

    if (process.env.TABBAR_E2E_MOTION === '1') {
      const reduced = process.env.EXPO_PUBLIC_E2E_REDUCE_MOTION === 'enabled';
      const motionState = `(() => {
        const dock = document.querySelector('[data-testid="floating-dock"]');
        const tab = Array.from(document.querySelectorAll('[role="tab"]')).find(n => n.textContent.includes('Shelf'));
        return { dockTransform: getComputedStyle(dock).transform, tabTransform: getComputedStyle(tab).transform, tabBackground: getComputedStyle(tab).backgroundColor, scrollY: document.getElementById('you-screen').scrollTop };
      })()`;
      await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 100, y: 200 });
      await delay(400);
      const before = await evaluate(client, motionState);
      const current = await evaluate(client, snapshotExpression);
      const target = current.tabs.find((t) => t.label === 'Shelf').rect;
      await client.send('Input.dispatchMouseEvent', {
        type: 'mouseMoved',
        x: target.x + target.width / 2,
        y: target.y + target.height / 2,
      });
      await delay(400);
      const hovered = await evaluate(client, motionState);
      assert(hovered.tabBackground !== before.tabBackground, 'Hover must provide visible feedback');
      assert(
        reduced
          ? hovered.tabTransform === before.tabTransform
          : hovered.tabTransform !== before.tabTransform,
        'Hover motion must honor Reduce Motion',
      );
      await screenshot(client, 'hover-shelf');
      await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 150, y: 250 });
      await delay(400);
      await client.send('Input.dispatchMouseEvent', {
        type: 'mouseWheel',
        x: 150,
        y: 250,
        deltaX: 0,
        deltaY: 480,
      });
      await delay(120);
      const scrolling = await evaluate(client, motionState);
      assert(scrolling.scrollY > before.scrollY, 'The real settings surface must scroll');
      assert(
        reduced
          ? scrolling.dockTransform === before.dockTransform
          : scrolling.dockTransform !== before.dockTransform,
        'Scroll motion must honor Reduce Motion',
      );
      await screenshot(client, 'scroll-feedback');
      await delay(800);
      const settled = await evaluate(client, motionState);
      assert(
        settled.dockTransform === before.dockTransform,
        'Dock must settle after scrolling stops',
      );
      summary.motion = { reduced, before, hovered, scrolling, settled };
    }

    summary.deferredRoutes = [];
    for (const route of ['ask', 'community', 'recommendations']) {
      await client.send('Page.navigate', { url: `${baseUrl}/${route}` });
      await waitForExpression(client, `document.body.innerText.includes('Back to Today')`);
      await screenshot(client, `deferred-${route}`);
      const target = await evaluate(
        client,
        `(() => {
        const node = Array.from(document.querySelectorAll('[role="button"],button')).find(n => n.textContent.includes('Back to Today'));
        const r = node.getBoundingClientRect(); return { x:r.x+r.width/2, y:r.y+r.height/2 };
      })()`,
      );
      await client.send('Input.dispatchMouseEvent', {
        ...target,
        type: 'mousePressed',
        button: 'left',
        clickCount: 1,
      });
      await client.send('Input.dispatchMouseEvent', {
        ...target,
        type: 'mouseReleased',
        button: 'left',
        clickCount: 1,
      });
      await waitForExpression(client, `location.pathname === '/today'`);
      summary.deferredRoutes.push({ route, returnsToToday: true });
    }

    for (const route of ['scan', 'search']) {
      await client.send('Page.navigate', { url: `${baseUrl}/shelf/${route}` });
      await waitForExpression(
        client,
        `location.pathname === '/shelf/manual' && document.body.innerText.includes('Add by hand')`,
      );
      await screenshot(client, `manual-fallback-${route}`);
    }

    const problemLogs = collectProblemLogs(client.events);
    writeJson('browser-warn-error-logs.json', problemLogs);
    const unexpectedLogs = problemLogs.filter((log) => {
      const serialized = JSON.stringify(log);
      return !(
        // Existing SDK 57/RN Web deprecation, also allowed by the onboarding harness.
        serialized.includes('props.pointerEvents is deprecated. Use style.pointerEvents') ||
        serialized.includes('EXPO_PUBLIC_SUPABASE') ||
        serialized.includes('Notifications') ||
        serialized.includes('expo-notifications') ||
        serialized.includes('placeholder') ||
        serialized.includes('403') ||
        serialized.includes('supabase.co')
      );
    });
    assert(
      unexpectedLogs.length === 0,
      `Unexpected browser warn/error logs: ${unexpectedLogs.length}`,
    );
    summary.problemLogCount = problemLogs.length;
    writeJson('summary.json', summary);
    console.log(`Native tab bar geometry E2E passed. Evidence: ${evidenceDir}`);
  } catch (error) {
    summary.status = 'fail';
    summary.error = error instanceof Error ? error.message : String(error);
    writeJson('summary.json', summary);
    throw error;
  } finally {
    client?.close();
    await stopProcess(browser);
    await stopProcess(server);
    try {
      rmSync(userDataDir, { force: true, maxRetries: 5, recursive: true, retryDelay: 250 });
    } catch (error) {
      console.warn(
        `WARN Could not remove temporary browser profile: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

await run();
