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
  path.join(repoRoot, 'test-results', 'human-e2e', today, 'navigation-tabbar-geometry-current');
const appPort = Number(process.env.TABBAR_E2E_PORT ?? 8184);
const debugPort = Number(process.env.TABBAR_E2E_DEBUG_PORT ?? 9284);
const baseUrl = process.env.TABBAR_E2E_BASE_URL ?? `http://localhost:${appPort}`;
const shouldStartServer = !process.env.TABBAR_E2E_BASE_URL;
const viewports = [
  { name: '320x568', width: 320, height: 568 },
  { name: '390x568', width: 390, height: 568 },
];
const tabs = [
  { id: 'bottom-tab-today', label: 'Today', route: 'today' },
  { id: 'bottom-tab-progress', label: 'Progress', route: 'progress' },
  { id: 'bottom-tab-shelf', label: 'Shelf', route: 'shelf' },
  { id: 'bottom-tab-you', label: 'You', route: 'you' },
];

mkdirSync(evidenceDir, { recursive: true });

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
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
      'Could not find Chrome or Edge. Set CHROME_PATH or BROWSER_PATH to run tab bar geometry E2E.',
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

      if (response.status < 500) {
        return;
      }
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

      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      lastError = error;
    }

    await delay(250);
  }

  throw new Error(`Timed out reading ${url}: ${lastError?.message ?? 'no response'}`);
}

async function stopProcess(child) {
  if (!child?.pid || child.exitCode !== null) {
    return;
  }

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

    if (message.method) {
      this.events.push(message);
    }
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
  const pageTarget = targets.find((target) => target.type === 'page' && target.webSocketDebuggerUrl);

  if (!pageTarget) {
    throw new Error('Chrome DevTools did not expose a page target.');
  }

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
    throw new Error(result.exceptionDetails.text ?? 'Evaluation failed.');
  }

  return result.result?.value;
}

async function waitForExpression(client, expression, timeoutMs = 30_000) {
  const startedAt = Date.now();
  let lastValue;

  while (Date.now() - startedAt < timeoutMs) {
    lastValue = await evaluate(client, expression);

    if (lastValue) {
      return lastValue;
    }

    await delay(250);
  }

  throw new Error(`Timed out waiting for expression: ${expression}; last value: ${lastValue}`);
}

async function waitForLoad(client) {
  await waitForExpression(
    client,
    `Boolean(document.querySelector('[data-testid="bottom-tab-today"]'))`,
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
  const rectOf = (node) => {
    if (!node) return null;
    const rect = node.getBoundingClientRect();
    return {
      bottom: rect.bottom,
      height: rect.height,
      left: rect.left,
      right: rect.right,
      top: rect.top,
      width: rect.width,
      x: rect.x,
      y: rect.y,
    };
  };
  const ownTextNode = (node, label) => {
    if (!node) return null;
    const children = Array.from(node.querySelectorAll('*'));
    return children
      .filter((child) => child.textContent && child.textContent.trim() === label)
      .sort((left, right) => left.getBoundingClientRect().height - right.getBoundingClientRect().height)[0] ?? null;
  };
  const tabList = document.querySelector('[role="tablist"]');
  const body = document.body;
  const root = document.documentElement;
  const tabListRect = rectOf(tabList);
  const tabListStyle = tabList ? getComputedStyle(tabList) : null;
  const tabs = tabSpecs.map((tab) => {
    const node = document.querySelector('[data-testid="' + tab.id + '"]');
    const labelNode = ownTextNode(node, tab.label);
    const rect = rectOf(node);
    const labelRect = rectOf(labelNode);
    const labelStyle = labelNode ? getComputedStyle(labelNode) : null;
    const center = rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : null;
    const hit = center ? document.elementFromPoint(center.x, center.y) : null;
    const selected = node?.getAttribute('aria-selected') === 'true';

    return {
      ariaLabel: node?.getAttribute('aria-label') ?? null,
      center,
      centerHitContains: Boolean(node && hit && node.contains(hit)),
      centerHitText: hit?.textContent?.replace(/\\s+/g, ' ').trim() ?? null,
      id: tab.id,
      label: tab.label,
      labelClientWidth: labelNode?.clientWidth ?? null,
      labelFontSize: labelStyle?.fontSize ?? null,
      labelLineHeight: labelStyle?.lineHeight ?? null,
      labelRect,
      labelScrollWidth: labelNode?.scrollWidth ?? null,
      labelText: labelNode?.textContent?.trim() ?? null,
      rect,
      selected,
      text: node?.textContent?.replace(/\\s+/g, ' ').trim() ?? null,
    };
  });

  return {
    bodyScrollWidth: body.scrollWidth,
    devicePixelRatio: window.devicePixelRatio,
    horizontalOverflow: Math.max(body.scrollWidth, root.scrollWidth) - window.innerWidth,
    innerHeight: window.innerHeight,
    innerWidth: window.innerWidth,
    location: window.location.href,
    selectedCount: tabs.filter((tab) => tab.selected).length,
    tabList: {
      borderRadius: tabListStyle ? Number.parseFloat(tabListStyle.borderRadius) : null,
      rect: tabListRect,
      role: tabList?.getAttribute('role') ?? null,
    },
    tabs,
  };
})()`;

function validateSnapshot(snapshot, expectedSelectedLabel, viewportName) {
  assert(snapshot.innerWidth > 0, `${viewportName}: missing viewport width`);
  assert(snapshot.horizontalOverflow <= 1, `${viewportName}: horizontal overflow ${snapshot.horizontalOverflow}`);
  assert(snapshot.selectedCount === 1, `${viewportName}: expected exactly one selected tab`);
  assert(snapshot.tabList?.role === 'tablist', `${viewportName}: missing tablist role`);
  assert(snapshot.tabList.rect.width <= snapshot.innerWidth - 14, `${viewportName}: tab bar is not floating`);
  assert(snapshot.tabList.rect.height >= 64, `${viewportName}: tab bar is too short`);
  assert(snapshot.tabList.borderRadius >= 30, `${viewportName}: tab bar is not pill-shaped`);
  assert(snapshot.tabList.rect.bottom <= snapshot.innerHeight - 10, `${viewportName}: tab bar sits too low`);

  for (const tab of snapshot.tabs) {
    assert(tab.rect, `${viewportName}: missing ${tab.label} tab`);
    assert(tab.labelText === tab.label, `${viewportName}: ${tab.label} label is not rendered directly`);
    assert(tab.text?.includes(tab.label), `${viewportName}: ${tab.label} text is missing`);
    assert(tab.ariaLabel === `${tab.label} tab`, `${viewportName}: ${tab.label} accessibility label is wrong`);
    assert(tab.rect.width >= 74, `${viewportName}: ${tab.label} tab width ${tab.rect.width} is too narrow`);
    assert(tab.rect.height >= 52, `${viewportName}: ${tab.label} tab height ${tab.rect.height} is too short`);
    assert(tab.labelRect.height >= 15, `${viewportName}: ${tab.label} label line box is clipped`);
    assert(tab.labelRect.width >= Math.min(tab.label.length * 5.2, 28), `${viewportName}: ${tab.label} label is too narrow`);
    assert(
      tab.labelRect.left >= tab.rect.left - 1 && tab.labelRect.right <= tab.rect.right + 1,
      `${viewportName}: ${tab.label} label escapes its tab horizontally`,
    );
    assert(
      tab.labelRect.top >= tab.rect.top - 1 && tab.labelRect.bottom <= tab.rect.bottom + 1,
      `${viewportName}: ${tab.label} label escapes its tab vertically`,
    );
    assert(
      !tab.labelScrollWidth ||
        !tab.labelClientWidth ||
        tab.labelScrollWidth <= tab.labelClientWidth + 1,
      `${viewportName}: ${tab.label} label overflows its own frame`,
    );
    assert(tab.centerHitContains, `${viewportName}: ${tab.label} center hit-test does not land on the tab`);
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
      if (event.method === 'Runtime.consoleAPICalled') {
        return ['error', 'warning'].includes(event.params.type);
      }

      if (event.method === 'Log.entryAdded') {
        return ['error', 'warning'].includes(event.params.entry.level);
      }

      if (event.method === 'Runtime.exceptionThrown') {
        return true;
      }

      return false;
    })
    .map((event) => ({
      method: event.method,
      params: event.params,
    }));
}

async function run() {
  let server = null;
  let browser = null;
  let client = null;
  const userDataDir = path.join(tmpdir(), `routinekind-tabbar-cdp-${process.pid}`);
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

    for (const viewport of viewports) {
      await client.send('Emulation.setDeviceMetricsOverride', {
        deviceScaleFactor: 2,
        height: viewport.height,
        mobile: false,
        screenHeight: viewport.height,
        screenWidth: viewport.width,
        width: viewport.width,
      });
      const viewportResult = {
        height: viewport.height,
        name: viewport.name,
        steps: [],
        width: viewport.width,
      };

      for (const tab of tabs) {
        await client.send('Page.navigate', { url: `${baseUrl}/${tab.route}` });
        await waitForLoad(client);
        await waitForExpression(
          client,
          `document.querySelector('[data-testid="${tab.id}"]')?.getAttribute('aria-selected') === 'true'`,
        );
        const snapshot = await evaluate(client, snapshotExpression);
        validateSnapshot(snapshot, tab.label, viewport.name);

        const stepName = `${viewport.name}-${tab.route}`;
        await screenshot(client, stepName);
        writeJson(`${stepName}.json`, snapshot);
        viewportResult.steps.push({
          selected: tab.label,
          tabListRect: snapshot.tabList.rect,
          tabs: snapshot.tabs.map((item) => ({
            centerHitContains: item.centerHitContains,
            label: item.label,
            labelRect: item.labelRect,
            rect: item.rect,
            selected: item.selected,
          })),
        });
      }

      summary.viewports.push(viewportResult);
    }

    const problemLogs = collectProblemLogs(client.events);
    writeJson('browser-warn-error-logs.json', problemLogs);
    summary.problemLogCount = problemLogs.length;

    const unexpectedLogs = problemLogs.filter((log) => {
      const serialized = JSON.stringify(log);
      return !(
        serialized.includes('EXPO_PUBLIC_SUPABASE') ||
        serialized.includes('Notifications') ||
        serialized.includes('placeholder') ||
        serialized.includes('403') ||
        serialized.includes('supabase.co')
      );
    });

    assert(unexpectedLogs.length === 0, `Unexpected browser warn/error logs: ${unexpectedLogs.length}`);
    writeJson('summary.json', summary);

    console.log(`Tab bar geometry E2E passed. Evidence: ${evidenceDir}`);
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
        `WARN Could not remove temporary browser profile: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}

await run();
