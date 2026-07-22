import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const isWindows = process.platform === 'win32';
const appPort = Number(process.env.PROGRESS_CACHE_E2E_PORT ?? 8340);
const debugPort = Number(process.env.PROGRESS_CACHE_E2E_DEBUG_PORT ?? 9440);
const baseUrl = `http://localhost:${appPort}`;
const viewport = { width: 390, height: 844 };
const evidenceDir =
  process.env.PROGRESS_CACHE_E2E_EVIDENCE_DIR ??
  path.join(
    repoRoot,
    'test-results',
    'human-e2e',
    '2026-07-21',
    'progress-query-cache-eviction-current',
  );

mkdirSync(evidenceDir, { recursive: true });
const resolvedEvidenceDir = path.resolve(evidenceDir);
for (const artifact of [
  '01-initial-progress.png',
  '02-first-return.png',
  '03-second-return.png',
  'browser-process.log',
  'expo-web.log',
  'failure.txt',
  'metrics.json',
  'report.md',
]) {
  const resolvedArtifact = path.resolve(resolvedEvidenceDir, artifact);
  if (resolvedArtifact.startsWith(`${resolvedEvidenceDir}${path.sep}`)) {
    rmSync(resolvedArtifact, { force: true });
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function findBrowserPath() {
  const candidates = [
    process.env.CHROME_PATH,
    process.env.BROWSER_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ].filter(Boolean);
  const match = candidates.find((candidate) => existsSync(candidate));
  if (!match) throw new Error('No supported system Chrome/Edge executable was found');
  return match;
}

function startServer() {
  writeFileSync(path.join(evidenceDir, 'expo-web.log'), '');
  const command = isWindows ? 'cmd.exe' : 'npm';
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
      EXPO_PUBLIC_E2E_APP_LOCK_ENABLED: 'disabled',
      EXPO_PUBLIC_E2E_ENTITLEMENT: 'store_pro',
      EXPO_PUBLIC_E2E_PROGRESS_PHOTOS: '10',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  const chunks = [];
  const append = (chunk) => {
    chunks.push(chunk.toString());
    writeFileSync(path.join(evidenceDir, 'expo-web.log'), chunks.join(''));
  };
  child.stdout.on('data', append);
  child.stderr.on('data', append);
  return child;
}

function startBrowser(browserPath, userDataDir) {
  writeFileSync(path.join(evidenceDir, 'browser-process.log'), '');
  const child = spawn(
    browserPath,
    [
      '--headless=new',
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${userDataDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-networking',
      '--disable-dev-shm-usage',
      '--disable-extensions',
      '--disable-sync',
      '--enable-unsafe-swiftshader',
      '--hide-scrollbars',
      '--use-angle=swiftshader',
      'about:blank',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true },
  );
  const chunks = [];
  const append = (chunk) => {
    chunks.push(chunk.toString());
    writeFileSync(path.join(evidenceDir, 'browser-process.log'), chunks.join(''));
  };
  child.stdout.on('data', append);
  child.stderr.on('data', append);
  return child;
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
  if (child.exitCode === null) {
    await Promise.race([
      new Promise((resolve) => child.once('exit', resolve)),
      delay(2_000),
    ]);
  }
}

async function removeTemporaryBrowserProfile(userDataDir) {
  const resolvedTemp = path.resolve(tmpdir());
  const resolvedProfile = path.resolve(userDataDir);
  if (!resolvedProfile.startsWith(`${resolvedTemp}${path.sep}`)) return;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      rmSync(resolvedProfile, { force: true, recursive: true, maxRetries: 3, retryDelay: 150 });
      return;
    } catch {
      await delay(250 * (attempt + 1));
    }
  }
}

async function readJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return await response.json();
}

async function waitForHttp(url, timeoutMs = 120_000) {
  const startedAt = Date.now();
  let lastError;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
      if (response.ok) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await delay(500);
  }
  throw new Error(`Timed out waiting for ${url}: ${String(lastError)}`);
}

class CdpClient {
  constructor(wsUrl) {
    this.events = [];
    this.nextId = 1;
    this.pending = new Map();
    this.ws = new WebSocket(wsUrl);
    this.ready = new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
    this.ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result ?? {});
        return;
      }
      this.events.push(message);
    });
  }

  async send(method, params = {}) {
    await this.ready;
    const id = this.nextId++;
    const result = new Promise((resolve, reject) => this.pending.set(id, { reject, resolve }));
    this.ws.send(JSON.stringify({ id, method, params }));
    return await result;
  }

  close() {
    this.ws.close();
  }
}

async function connectToPage() {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 30_000) {
    try {
      const pages = await readJson(`http://127.0.0.1:${debugPort}/json/list`);
      const page = pages.find((candidate) => candidate.type === 'page');
      if (page?.webSocketDebuggerUrl) return new CdpClient(page.webSocketDebuggerUrl);
    } catch {
      // Browser startup is still in progress.
    }
    await delay(250);
  }
  throw new Error('Timed out waiting for a CDP page target');
}

async function evaluate(client, expression) {
  const result = await client.send('Runtime.evaluate', {
    awaitPromise: true,
    expression,
    returnByValue: true,
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text ?? 'Evaluation failed');
  return result.result?.value;
}

async function waitForExpression(client, expression, timeoutMs = 60_000) {
  const startedAt = Date.now();
  let lastValue;
  while (Date.now() - startedAt < timeoutMs) {
    lastValue = await evaluate(client, expression);
    if (lastValue) return lastValue;
    await delay(250);
  }
  throw new Error(`Timed out waiting for expression: ${expression}; last=${lastValue}`);
}

async function screenshot(client, name) {
  const result = await client.send('Page.captureScreenshot', {
    captureBeyondViewport: false,
    format: 'png',
  });
  writeFileSync(path.join(evidenceDir, `${name}.png`), Buffer.from(result.data, 'base64'));
}

async function clickAriaLabel(client, label) {
  const point = await evaluate(
    client,
    `(() => {
      const node = Array.from(document.querySelectorAll('[aria-label], [role="button"]')).find(
        (candidate) =>
          candidate.getAttribute('aria-label') === ${JSON.stringify(label)} ||
          (candidate.getAttribute('role') === 'button' &&
            candidate.textContent?.trim() === ${JSON.stringify(label)})
      );
      if (!node) return null;
      node.scrollIntoView({ block: 'center', inline: 'center' });
      const rect = node.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    })()`,
  );
  assert(point, `Missing accessible action: ${label}`);
  await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
  await client.send('Input.dispatchMouseEvent', {
    button: 'left',
    clickCount: 1,
    type: 'mousePressed',
    ...point,
  });
  await client.send('Input.dispatchMouseEvent', {
    button: 'left',
    clickCount: 1,
    type: 'mouseReleased',
    ...point,
  });
  await delay(350);
}

function progressSnapshotExpression() {
  return `(() => {
    const diagnostics = globalThis.__ONSKIN_PHOTO_QUERY_CACHE_DIAGNOSTICS__ ?? {};
    const photoActions = Array.from(document.querySelectorAll('[aria-label^="Photo "]'));
    return {
      diagnostics: { queryExecutions: diagnostics.queryExecutions ?? 0 },
      documentHorizontalOverflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
      loadingVisible: document.body.innerText.includes('Opening your private timeline...'),
      pathname: location.pathname,
      photoActionCount: photoActions.length,
      storageUnavailableVisible: document.body.innerText.includes('Your timeline could not open.'),
      timelineListPresent: Boolean(document.getElementById('progress-timeline-list')),
    };
  })()`;
}

async function progressSnapshot(client) {
  return await evaluate(client, progressSnapshotExpression());
}

function browserLogs(events) {
  const entries = [];
  for (const event of events) {
    if (event.method === 'Runtime.consoleAPICalled') {
      entries.push({
        level: event.params.type,
        text: event.params.args.map((arg) => arg.value ?? arg.description ?? '').join(' '),
      });
    }
    if (event.method === 'Log.entryAdded') {
      entries.push({ level: event.params.entry.level, text: event.params.entry.text });
    }
  }
  return entries;
}

function isExpectedDevelopmentLog(entry) {
  return [
    'EXPO_PUBLIC_SUPABASE_URL is not a valid Supabase URL',
    'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not set',
    'Listening to push token changes is not yet fully supported on web',
  ].some((message) => entry.text.includes(message));
}

async function main() {
  const userDataDir = mkdtempSync(path.join(tmpdir(), 'onskin-progress-cache-'));
  let server;
  let browser;
  let client;
  try {
    server = startServer();
    await waitForHttp(baseUrl);
    browser = startBrowser(findBrowserPath(), userDataDir);
    client = await connectToPage();
    await Promise.all([
      client.send('Page.enable'),
      client.send('Runtime.enable'),
      client.send('Log.enable'),
      client.send('Emulation.setDeviceMetricsOverride', {
        deviceScaleFactor: 1,
        height: viewport.height,
        mobile: true,
        screenHeight: viewport.height,
        screenWidth: viewport.width,
        width: viewport.width,
      }),
    ]);
    await client.send('Page.navigate', { url: `${baseUrl}/progress` });
    await waitForExpression(client, `location.pathname === '/progress'`);
    try {
      await waitForExpression(
        client,
        `Array.from(document.querySelectorAll('[role="button"]')).some(
           (node) => node.textContent?.trim() === 'Timeline'
         ) &&
         (globalThis.__ONSKIN_PHOTO_QUERY_CACHE_DIAGNOSTICS__?.queryExecutions ?? 0) >= 1`,
      );
    } catch (error) {
      const entryState = await evaluate(
        client,
        `({
          pathname: location.pathname,
          queryExecutions:
            globalThis.__ONSKIN_PHOTO_QUERY_CACHE_DIAGNOSTICS__?.queryExecutions ?? 0,
          text: document.body.innerText.slice(0, 1_000),
        })`,
      );
      throw new Error(`Progress entry did not settle: ${JSON.stringify(entryState)}`, {
        cause: error,
      });
    }
    await clickAriaLabel(client, 'Timeline');
    await waitForExpression(client, `Boolean(document.getElementById('progress-timeline-list'))`);
    const initial = await progressSnapshot(client);
    assert(initial.photoActionCount > 0, 'Initial Progress timeline mounted no photo actions');
    assert(!initial.loadingVisible && !initial.storageUnavailableVisible, 'Initial Progress did not settle');
    await screenshot(client, '01-initial-progress');

    await clickAriaLabel(client, 'Today tab');
    await waitForExpression(client, `location.pathname === '/today'`);
    await clickAriaLabel(client, 'Progress tab');
    await waitForExpression(client, `location.pathname === '/progress'`);
    await waitForExpression(
      client,
      `(globalThis.__ONSKIN_PHOTO_QUERY_CACHE_DIAGNOSTICS__?.queryExecutions ?? 0) === ${
        initial.diagnostics.queryExecutions + 1
      } && Boolean(document.getElementById('progress-timeline-list'))`,
    );
    const firstReturn = await progressSnapshot(client);
    assert(firstReturn.photoActionCount > 0, 'First Progress return mounted no photo actions');
    assert(
      !firstReturn.loadingVisible && !firstReturn.storageUnavailableVisible,
      'First Progress return did not settle',
    );
    await screenshot(client, '02-first-return');

    await clickAriaLabel(client, 'Today tab');
    await waitForExpression(client, `location.pathname === '/today'`);
    await clickAriaLabel(client, 'Progress tab');
    await waitForExpression(client, `location.pathname === '/progress'`);
    await waitForExpression(
      client,
      `(globalThis.__ONSKIN_PHOTO_QUERY_CACHE_DIAGNOSTICS__?.queryExecutions ?? 0) === ${
        initial.diagnostics.queryExecutions + 2
      } && Boolean(document.getElementById('progress-timeline-list'))`,
    );
    const secondReturn = await progressSnapshot(client);
    assert(secondReturn.photoActionCount > 0, 'Second Progress return mounted no photo actions');
    assert(
      !secondReturn.loadingVisible && !secondReturn.storageUnavailableVisible,
      'Second Progress return did not settle',
    );
    await screenshot(client, '03-second-return');

    const logs = browserLogs(client.events);
    const unexpectedLogs = logs.filter(
      (entry) =>
        ['error', 'warning', 'warn'].includes(entry.level) && !isExpectedDevelopmentLog(entry),
    );
    const dialogCount = client.events.filter(
      (event) => event.method === 'Page.javascriptDialogOpening',
    ).length;
    assert(initial.documentHorizontalOverflow === 0, 'Initial Progress overflowed horizontally');
    assert(firstReturn.documentHorizontalOverflow === 0, 'First return overflowed horizontally');
    assert(secondReturn.documentHorizontalOverflow === 0, 'Second return overflowed horizontally');
    assert(dialogCount === 0, `Observed ${dialogCount} JavaScript dialogs`);
    assert(unexpectedLogs.length === 0, `Observed unexpected logs: ${JSON.stringify(unexpectedLogs)}`);

    const metrics = {
      browserLogs: logs,
      dialogCount,
      firstReturn,
      initial,
      secondReturn,
      unexpectedLogs,
      viewport,
    };
    writeFileSync(path.join(evidenceDir, 'metrics.json'), `${JSON.stringify(metrics, null, 2)}\n`);
    writeFileSync(path.join(evidenceDir, 'report.md'), buildReport(metrics));
  } finally {
    client?.close();
    await stopProcess(browser);
    await stopProcess(server);
    await removeTemporaryBrowserProfile(userDataDir);
  }
}

function buildReport(metrics) {
  return `# Progress Sensitive Query Cache Eviction E2E

Date: 2026-07-21 (America/Toronto)

Surface: Expo web through headless system Chrome/Edge at ${metrics.viewport.width} x ${metrics.viewport.height}

Result: Pass

## Flow

- Opened Progress with 10 deterministic development photos and switched to Timeline.
- Switched Progress -> Today -> Progress twice through the visible bottom tab bar.
- Query executions advanced exactly once per remount: ${metrics.initial.diagnostics.queryExecutions} -> ${metrics.firstReturn.diagnostics.queryExecutions} -> ${metrics.secondReturn.diagnostics.queryExecutions}.
- Timeline mode and visible photo actions returned after both encrypted-store-equivalent rereads, with no storage-unavailable state.
- Horizontal overflow: ${metrics.secondReturn.documentHorizontalOverflow} px. JavaScript dialogs: ${metrics.dialogCount}. Unexpected warn/error logs: ${metrics.unexpectedLogs.length}.

## Evidence Boundary

The global diagnostic contains one development-only integer execution count and no query key, photo, note, URI, account, storage, or provider content. Coupled with the real QueryObserver tests, this run proves focus teardown triggers a fresh query execution and the user-facing timeline recovers cleanly. The fixture uses deterministic unencrypted web photos, so native SecureStore/filesystem, production-Hermes memory, process-kill, and signed-device lifecycle evidence remain open.
`;
}

try {
  await main();
} catch (error) {
  writeFileSync(
    path.join(evidenceDir, 'failure.txt'),
    `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
  );
  throw error;
}
