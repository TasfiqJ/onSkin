import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const siteRoot = path.join(repoRoot, 'docs', 'phase-8', 'public-site');
const isWindows = process.platform === 'win32';
const today = new Date().toISOString().slice(0, 10);
const evidenceDir =
  process.env.PUBLIC_SITE_SUPPORT_EVIDENCE_DIR ??
  path.join(
    repoRoot,
    'test-results',
    'human-e2e',
    today,
    'phase8-public-support-device-floor-current',
  );
const appPort = Number(process.env.PUBLIC_SITE_SUPPORT_PORT ?? 8364);
const debugPort = Number(process.env.PUBLIC_SITE_SUPPORT_DEBUG_PORT ?? 9364);
const baseUrl = `http://127.0.0.1:${appPort}`;

mkdirSync(evidenceDir, { recursive: true });

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function contentType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.json')) return 'application/json; charset=utf-8';
  if (filePath.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.png')) return 'image/png';
  return 'application/octet-stream';
}

function startStaticServer() {
  const server = createServer((request, response) => {
    const requestUrl = new URL(request.url ?? '/', baseUrl);
    const pathname = requestUrl.pathname === '/' ? '/index.html' : requestUrl.pathname;
    if (pathname === '/favicon.ico') {
      response.writeHead(204);
      response.end();
      return;
    }
    const decodedPathname = decodeURIComponent(pathname);
    const filePath = path.resolve(siteRoot, `.${decodedPathname}`);

    if (!filePath.startsWith(siteRoot)) {
      response.writeHead(403);
      response.end('Forbidden');
      return;
    }

    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      response.writeHead(404);
      response.end('Not found');
      return;
    }

    response.writeHead(200, { 'content-type': contentType(filePath) });
    response.end(readFileSync(filePath));
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(appPort, '127.0.0.1', () => resolve(server));
  });
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
      'Could not find Chrome or Edge. Set CHROME_PATH or BROWSER_PATH to run public-site support E2E.',
    );
  }

  return candidate;
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
  const pageTarget = targets.find(
    (target) => target.type === 'page' && target.webSocketDebuggerUrl,
  );

  if (!pageTarget) {
    throw new Error('Chrome DevTools did not expose a page target.');
  }

  const client = new CdpClient(pageTarget.webSocketDebuggerUrl);
  await client.ready;
  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('Log.enable');
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

async function screenshot(client, name) {
  const result = await client.send('Page.captureScreenshot', {
    captureBeyondViewport: false,
    format: 'png',
  });
  writeFileSync(path.join(evidenceDir, `${name}.png`), Buffer.from(result.data, 'base64'));
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
  const userDataDir = path.join(tmpdir(), `layerwell-public-support-cdp-${process.pid}`);
  const summary = {
    baseUrl,
    evidenceDir,
    generatedAt: new Date().toISOString(),
    status: 'pass',
    viewport: { height: 700, width: 390 },
  };

  try {
    server = await startStaticServer();
    const browserPath = findBrowserPath();
    browser = startBrowser(browserPath, userDataDir);
    await readJson(`http://127.0.0.1:${debugPort}/json/version`);
    client = await connectToPage();

    await client.send('Emulation.setDeviceMetricsOverride', {
      deviceScaleFactor: 2,
      height: summary.viewport.height,
      mobile: false,
      screenHeight: summary.viewport.height,
      screenWidth: summary.viewport.width,
      width: summary.viewport.width,
    });
    await client.send('Page.navigate', { url: `${baseUrl}/support.html` });
    await waitForExpression(client, `document.readyState === 'complete'`);

    const snapshot = await evaluate(
      client,
      `(() => {
        const body = document.body;
        const root = document.documentElement;
        const text = body.innerText.replace(/\\s+/g, ' ').trim();
        const headings = Array.from(document.querySelectorAll('h1, h2')).map((node) =>
          node.textContent.trim()
        );
        const links = Array.from(document.querySelectorAll('a')).map((node) => ({
          href: node.getAttribute('href'),
          text: node.textContent.trim(),
        }));
        return {
          bodyScrollWidth: body.scrollWidth,
          headingText: headings,
          horizontalOverflow: Math.max(body.scrollWidth, root.scrollWidth) - window.innerWidth,
          innerHeight: window.innerHeight,
          innerWidth: window.innerWidth,
          links,
          location: window.location.href,
          text,
          title: document.title,
        };
      })()`,
    );

    writeJson('support-390x700.json', snapshot);
    await screenshot(client, 'support-390x700');

    for (const requiredText of [
      'Support',
      'Supported devices',
      'iOS 17.0+',
      '375 pt',
      'Android 10 / API 29+',
      '360 dp',
      '360 x 640',
      'stress coverage only',
    ]) {
      assert(snapshot.text.includes(requiredText), `support page is missing: ${requiredText}`);
    }
    const legacyDisplayName = ['On', 'Skin'].join('');
    assert(!snapshot.text.includes(legacyDisplayName), 'support page exposes legacy brand copy');
    assert(
      !snapshot.text.includes('__SUPPORT_EMAIL__'),
      'support page exposes support email token',
    );
    assert(
      snapshot.horizontalOverflow <= 1,
      `support page horizontal overflow ${snapshot.horizontalOverflow}`,
    );
    assert(
      snapshot.links.every((link) => !String(link.href).includes('__SUPPORT_EMAIL__')),
      'support page exposes placeholder support mailto link',
    );

    const problemLogs = collectProblemLogs(client.events);
    writeJson('browser-warn-error-logs.json', problemLogs);
    summary.problemLogCount = problemLogs.length;
    assert(problemLogs.length === 0, `Unexpected browser warn/error logs: ${problemLogs.length}`);
    writeJson('summary.json', summary);

    console.log(`Public support E2E passed. Evidence: ${evidenceDir}`);
  } catch (error) {
    summary.status = 'fail';
    summary.error = error instanceof Error ? error.message : String(error);
    writeJson('summary.json', summary);
    throw error;
  } finally {
    client?.close();
    await stopProcess(browser);
    await new Promise((resolve) => server?.close(resolve));
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
