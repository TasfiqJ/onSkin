import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const isWindows = process.platform === 'win32';
const appPort = Number(process.env.SHELF_STRESS_E2E_PORT ?? 8323);
const debugPort = Number(process.env.SHELF_STRESS_E2E_DEBUG_PORT ?? 9423);
const baseUrl = process.env.SHELF_STRESS_E2E_BASE_URL ?? `http://localhost:${appPort}`;
const shouldStartServer = !process.env.SHELF_STRESS_E2E_BASE_URL;
const activeCount = Number(process.env.SHELF_STRESS_E2E_ACTIVE_COUNT ?? 100);
const archiveCount = Number(process.env.SHELF_STRESS_E2E_ARCHIVE_COUNT ?? 100);
const viewport = { width: 390, height: 844 };
const evidenceDir =
  process.env.SHELF_STRESS_E2E_EVIDENCE_DIR ??
  path.join(repoRoot, 'test-results', 'human-e2e', '2026-07-21', 'shelf-archive-stress-current');

mkdirSync(evidenceDir, { recursive: true });

const resolvedEvidenceDir = path.resolve(evidenceDir);
for (const artifact of [
  '01-shelf-top.png',
  '02-shelf-bottom.png',
  '03-archive-top.png',
  '04-archive-bottom.png',
  '05-shelf-restored-after-archive.png',
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
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);
  const browserPath = candidates.find((candidate) => existsSync(candidate));
  if (!browserPath) throw new Error('Chrome or Edge was not found. Set CHROME_PATH.');
  return browserPath;
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
      const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
      if (response.ok) return await response.json();
    } catch (error) {
      lastError = error;
    }
    await delay(250);
  }
  throw new Error(`Timed out reading ${url}: ${lastError?.message ?? 'no response'}`);
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
      EXPO_PUBLIC_E2E_APP_LOCK_ENABLED: 'disabled',
      EXPO_PUBLIC_E2E_ENTITLEMENT: 'store_pro',
      EXPO_PUBLIC_E2E_SHELF_STRESS_ACTIVE_COUNT: String(activeCount),
      EXPO_PUBLIC_E2E_SHELF_STRESS_ARCHIVE_COUNT: String(archiveCount),
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
  writeFileSync(path.join(evidenceDir, 'browser-process.log'), '');
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
  const target = targets.find(
    (candidate) => candidate.type === 'page' && candidate.webSocketDebuggerUrl,
  );
  if (!target) throw new Error('Chrome DevTools did not expose a page target.');
  const client = new CdpClient(target.webSocketDebuggerUrl);
  await client.ready;
  for (const domain of ['Page', 'Runtime', 'Log', 'Network']) await client.send(`${domain}.enable`);
  return client;
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
      const node = Array.from(document.querySelectorAll('[aria-label]')).find(
        (candidate) => candidate.getAttribute('aria-label') === ${JSON.stringify(label)}
      );
      if (!node) return null;
      const rect = node.getBoundingClientRect();
      node.scrollIntoView({ block: 'center', inline: 'center' });
      const next = node.getBoundingClientRect();
      return { x: next.left + next.width / 2, y: next.top + next.height / 2 };
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

function listSnapshotExpression(listId, rowPrefix) {
  return `(() => {
    const root = document.getElementById(${JSON.stringify(listId)});
    if (!root) return null;
    const candidates = [root, ...root.querySelectorAll('*')];
    const scrollNode = candidates
      .filter((node) => node.scrollHeight > node.clientHeight + 1)
      .sort((left, right) =>
        (right.scrollHeight - right.clientHeight) - (left.scrollHeight - left.clientHeight)
      )[0] ?? root;
    const rows = Array.from(document.querySelectorAll('[id^=${JSON.stringify(rowPrefix)}]'));
    const visibleRows = rows.filter((row) => {
      const rect = row.getBoundingClientRect();
      return rect.bottom > 0 && rect.top < window.innerHeight && rect.width > 0 && rect.height > 0;
    });
    return {
      clientHeight: scrollNode.clientHeight,
      documentHorizontalOverflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
      ids: rows.map((row) => row.id),
      maxScrollTop: Math.max(0, scrollNode.scrollHeight - scrollNode.clientHeight),
      mountedRows: rows.length,
      pathname: location.pathname,
      scrollHeight: scrollNode.scrollHeight,
      scrollTop: scrollNode.scrollTop,
      visibleIds: visibleRows.map((row) => row.id),
      visibleRows: visibleRows.length,
    };
  })()`;
}

async function listSnapshot(client, listId, rowPrefix) {
  return await evaluate(client, listSnapshotExpression(listId, rowPrefix));
}

async function waitForVisibleListRow(client, { listId, rowId, rowPrefix, timeoutMs = 15_000 }) {
  const startedAt = Date.now();
  let lastSnapshot = null;
  while (Date.now() - startedAt < timeoutMs) {
    lastSnapshot = await listSnapshot(client, listId, rowPrefix);
    if (lastSnapshot?.visibleIds.includes(rowId)) return lastSnapshot;
    await delay(100);
  }
  throw new Error(
    `Timed out waiting for visible row ${rowId}; last scrollTop=${lastSnapshot?.scrollTop ?? 'missing'}`,
  );
}

async function scrollList(client, listId, ratio) {
  await evaluate(
    client,
    `(async () => {
      const root = document.getElementById(${JSON.stringify(listId)});
      if (!root) return false;
      const candidates = [root, ...root.querySelectorAll('*')];
      const node = candidates
        .filter((candidate) => candidate.scrollHeight > candidate.clientHeight + 1)
        .sort((left, right) =>
          (right.scrollHeight - right.clientHeight) - (left.scrollHeight - left.clientHeight)
        )[0] ?? root;
      const max = Math.max(0, node.scrollHeight - node.clientHeight);
      node.scrollTo({ top: max * ${ratio}, behavior: 'instant' });
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      await new Promise((resolve) => setTimeout(resolve, 80));
      return true;
    })()`,
  );
}

async function scrollListByViewport(client, listId, viewportFraction = 0.65) {
  await evaluate(
    client,
    `(async () => {
      const root = document.getElementById(${JSON.stringify(listId)});
      if (!root) return false;
      const candidates = [root, ...root.querySelectorAll('*')];
      const node = candidates
        .filter((candidate) => candidate.scrollHeight > candidate.clientHeight + 1)
        .sort((left, right) =>
          (right.scrollHeight - right.clientHeight) - (left.scrollHeight - left.clientHeight)
        )[0] ?? root;
      node.scrollBy({
        top: Math.max(1, node.clientHeight * ${viewportFraction}),
        behavior: 'instant',
      });
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      await new Promise((resolve) => setTimeout(resolve, 50));
      return true;
    })()`,
  );
}

async function traverseList(client, { expectedCount, listId, rowPrefix }) {
  const seen = new Set();
  const samples = [];
  await scrollList(client, listId, 0);
  let unchangedSamples = 0;
  const maxIterations = expectedCount * 4 + 20;
  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    const snapshot = await listSnapshot(client, listId, rowPrefix);
    assert(snapshot, `Missing list ${listId}`);
    const before = seen.size;
    for (const id of snapshot.ids) seen.add(id);
    unchangedSamples = seen.size === before ? unchangedSamples + 1 : 0;
    samples.push({
      iteration,
      ratio: snapshot.maxScrollTop > 0 ? snapshot.scrollTop / snapshot.maxScrollTop : 0,
      ...snapshot,
    });
    if (seen.size === expectedCount && snapshot.scrollTop >= snapshot.maxScrollTop - 2) break;
    if (unchangedSamples >= 6 && snapshot.scrollTop >= snapshot.maxScrollTop - 2) break;
    await scrollListByViewport(client, listId);
  }
  await scrollList(client, listId, 1);
  const bottom = await listSnapshot(client, listId, rowPrefix);
  for (const id of bottom.ids) seen.add(id);
  samples.push({ iteration: samples.length, ratio: 1, ...bottom });
  assert(
    seen.size === expectedCount,
    `${listId} traversed ${seen.size}/${expectedCount} unique rows`,
  );
  assert(
    samples.every((sample) => sample.visibleRows > 0),
    `${listId} produced a blank intermediate viewport`,
  );
  assert(
    samples.every((sample) => sample.documentHorizontalOverflow === 0),
    `${listId} overflowed`,
  );
  return {
    maxMountedRows: Math.max(...samples.map((sample) => sample.mountedRows)),
    minMountedRows: Math.min(...samples.map((sample) => sample.mountedRows)),
    samples,
    seenIds: [...seen],
  };
}

function browserLogs(events) {
  return events.flatMap((event) => {
    if (event.method === 'Log.entryAdded') {
      const entry = event.params.entry;
      return [{ level: entry.level, text: entry.text }];
    }
    if (event.method === 'Runtime.consoleAPICalled') {
      const level = event.params.type;
      const text = event.params.args
        .map((arg) => (typeof arg.value === 'string' ? arg.value : (arg.description ?? '')))
        .join(' ');
      return [{ level, text }];
    }
    return [];
  });
}

function isExpectedDevelopmentLog(entry) {
  return [
    'EXPO_PUBLIC_SUPABASE_URL',
    'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    'expo-notifications',
  ].some((marker) => entry.text.includes(marker));
}

function sharesVisibleAnchor(left, right) {
  const rightIds = new Set(right.visibleIds);
  return left.visibleIds.some((id) => rightIds.has(id));
}

async function main() {
  assert(
    Number.isInteger(activeCount) && activeCount >= 1 && activeCount <= 250,
    'Invalid active count',
  );
  assert(
    Number.isInteger(archiveCount) && archiveCount >= 1 && archiveCount <= 250,
    'Invalid archive count',
  );

  const browserPath = findBrowserPath();
  const userDataDir = mkdtempSync(path.join(tmpdir(), 'onskin-shelf-stress-'));
  let server = null;
  let browser = null;
  let client = null;
  try {
    if (shouldStartServer) server = startExpoServer();
    await waitForUrl(baseUrl);
    browser = startBrowser(browserPath, userDataDir);
    await Promise.race([
      readJson(`http://127.0.0.1:${debugPort}/json/version`),
      new Promise((_, reject) => {
        browser.once('exit', (code) => reject(new Error(`Browser exited before CDP: ${code}`)));
      }),
    ]);
    client = await connectToPage();
    await client.send('Emulation.setDeviceMetricsOverride', {
      deviceScaleFactor: 1,
      height: viewport.height,
      mobile: true,
      screenHeight: viewport.height,
      screenWidth: viewport.width,
      width: viewport.width,
    });
    await client.send('Page.navigate', { url: `${baseUrl}/shelf` });
    await waitForExpression(client, `location.pathname === '/shelf'`);
    await waitForExpression(client, `Boolean(document.getElementById('shelf-main-list'))`);
    await waitForExpression(client, `document.body.innerText.includes('${activeCount} products')`);
    await evaluate(client, `document.fonts?.ready ? document.fonts.ready.then(() => true) : true`);

    await screenshot(client, '01-shelf-top');
    const all = await traverseList(client, {
      expectedCount: activeCount,
      listId: 'shelf-main-list',
      rowPrefix: 'shelf-product-e2e-shelf-stress-active-',
    });
    const allBottom = all.samples.at(-1);
    assert(
      allBottom.ids.includes(
        `shelf-product-e2e-shelf-stress-active-${String(activeCount).padStart(4, '0')}`,
      ),
      'The unique final Shelf row was not mounted at the bottom boundary',
    );
    await screenshot(client, '02-shelf-bottom');

    await clickAriaLabel(client, 'Actives');
    const activeStart = await listSnapshot(
      client,
      'shelf-main-list',
      'shelf-product-e2e-shelf-stress-active-',
    );
    const expectedActiveCount = Math.ceil(activeCount / 3);
    const actives = await traverseList(client, {
      expectedCount: expectedActiveCount,
      listId: 'shelf-main-list',
      rowPrefix: 'shelf-product-e2e-shelf-stress-active-',
    });
    await scrollList(client, 'shelf-main-list', 0.55);
    const activeAnchor = await listSnapshot(
      client,
      'shelf-main-list',
      'shelf-product-e2e-shelf-stress-active-',
    );

    await clickAriaLabel(client, 'Expiring');
    const expiringStart = await listSnapshot(
      client,
      'shelf-main-list',
      'shelf-product-e2e-shelf-stress-active-',
    );
    const expectedExpiringCount = buildExpectedExpiringCount(activeCount);
    const expiring = await traverseList(client, {
      expectedCount: expectedExpiringCount,
      listId: 'shelf-main-list',
      rowPrefix: 'shelf-product-e2e-shelf-stress-active-',
    });
    await scrollList(client, 'shelf-main-list', 0.35);
    const expiringAnchor = await listSnapshot(
      client,
      'shelf-main-list',
      'shelf-product-e2e-shelf-stress-active-',
    );

    await clickAriaLabel(client, 'All');
    const allRestored = await listSnapshot(
      client,
      'shelf-main-list',
      'shelf-product-e2e-shelf-stress-active-',
    );
    assert(
      sharesVisibleAnchor(allRestored, allBottom),
      `All visible bottom anchor was not restored (${allRestored.scrollTop} vs ${allBottom.scrollTop})`,
    );
    assert(
      allRestored.ids.includes(
        `shelf-product-e2e-shelf-stress-active-${String(activeCount).padStart(4, '0')}`,
      ),
      'All did not restore the unique final-row recycler window',
    );
    await clickAriaLabel(client, 'Actives');
    const activeRestored = await listSnapshot(
      client,
      'shelf-main-list',
      'shelf-product-e2e-shelf-stress-active-',
    );
    assert(
      sharesVisibleAnchor(activeRestored, activeAnchor),
      `Actives visible anchor was not restored (${activeRestored.scrollTop} vs ${activeAnchor.scrollTop})`,
    );
    await clickAriaLabel(client, 'Expiring');
    const expiringRestored = await listSnapshot(
      client,
      'shelf-main-list',
      'shelf-product-e2e-shelf-stress-active-',
    );
    assert(
      sharesVisibleAnchor(expiringRestored, expiringAnchor),
      `Expiring visible anchor was not restored (${expiringRestored.scrollTop} vs ${expiringAnchor.scrollTop})`,
    );

    await clickAriaLabel(client, 'All');
    await scrollList(client, 'shelf-main-list', 1);
    await clickAriaLabel(client, `View archive, ${archiveCount} archived products`);
    await waitForExpression(client, `location.pathname === '/shelf/archive'`);
    await waitForExpression(client, `Boolean(document.getElementById('shelf-archive-list'))`);
    await screenshot(client, '03-archive-top');
    const archive = await traverseList(client, {
      expectedCount: archiveCount,
      listId: 'shelf-archive-list',
      rowPrefix: 'shelf-archive-product-e2e-shelf-stress-archive-',
    });
    const archiveBottom = archive.samples.at(-1);
    assert(
      archiveBottom.ids.includes(
        `shelf-archive-product-e2e-shelf-stress-archive-${String(archiveCount).padStart(4, '0')}`,
      ),
      'The unique final Archive row was not mounted at the bottom boundary',
    );
    await screenshot(client, '04-archive-bottom');

    await clickAriaLabel(client, 'Back');
    await waitForExpression(client, `location.pathname === '/shelf'`);
    await waitForExpression(client, `Boolean(document.getElementById('shelf-main-list'))`);
    const finalShelfRowId = `shelf-product-e2e-shelf-stress-active-${String(activeCount).padStart(4, '0')}`;
    const shelfAfterBack = await waitForVisibleListRow(client, {
      listId: 'shelf-main-list',
      rowId: finalShelfRowId,
      rowPrefix: 'shelf-product-e2e-shelf-stress-active-',
    });
    assert(
      sharesVisibleAnchor(shelfAfterBack, allBottom) &&
        shelfAfterBack.ids.includes(finalShelfRowId),
      `Shelf final-row boundary was not restored after Archive Back (${shelfAfterBack.scrollTop})`,
    );
    await screenshot(client, '05-shelf-restored-after-archive');

    const diagnostics = await evaluate(
      client,
      `({ ...(globalThis.__ONSKIN_SHELF_RENDER_DIAGNOSTICS__ ?? {}) })`,
    );
    const logs = browserLogs(client.events);
    const unexpectedLogs = logs.filter(
      (entry) =>
        ['error', 'warning', 'warn'].includes(entry.level) && !isExpectedDevelopmentLog(entry),
    );
    const dialogCount = client.events.filter(
      (event) => event.method === 'Page.javascriptDialogOpening',
    ).length;
    assert(dialogCount === 0, `Unexpected JavaScript dialogs: ${dialogCount}`);
    assert(
      unexpectedLogs.length === 0,
      `Unexpected browser logs: ${JSON.stringify(unexpectedLogs)}`,
    );

    const metrics = {
      activeCount,
      activeFilter: summarizeTraversal(actives),
      activeFilterInitialScrollTop: activeStart.scrollTop,
      activeFilterRestoredScrollTop: activeRestored.scrollTop,
      allFilter: summarizeTraversal(all),
      allFilterRestoredScrollTop: allRestored.scrollTop,
      archive: summarizeTraversal(archive),
      archiveCount,
      browserLogs: logs,
      diagnostics,
      dialogCount,
      expiringFilter: summarizeTraversal(expiring),
      expiringFilterInitialScrollTop: expiringStart.scrollTop,
      expiringFilterRestoredScrollTop: expiringRestored.scrollTop,
      horizontalOverflowPixels: shelfAfterBack.documentHorizontalOverflow,
      shelfAfterArchiveBackScrollTop: shelfAfterBack.scrollTop,
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

function buildExpectedExpiringCount(count) {
  return Array.from({ length: count }, (_, index) => index % 5).filter(
    (remainder) => remainder === 0 || remainder === 1,
  ).length;
}

function summarizeTraversal(traversal) {
  return {
    maxMountedRows: traversal.maxMountedRows,
    maxScrollTop: traversal.samples.at(-1).maxScrollTop,
    minMountedRows: traversal.minMountedRows,
    sampleCount: traversal.samples.length,
    uniqueRowsSeen: traversal.seenIds.length,
    visibleRowsAtBottom: traversal.samples.at(-1).visibleRows,
  };
}

function buildReport(metrics) {
  return `# Shelf And Archive Collection Stress E2E

Date: 2026-07-21 (America/Toronto)

Surface: Expo web through headless system Chrome/Edge at ${metrics.viewport.width} x ${metrics.viewport.height}

Result: Pass

## Flow

- Traversed all ${metrics.activeCount} deterministic mixed-height Shelf rows from top to the unique final row with no blank intermediate viewport.
- Switched All → Actives → Expiring → All, traversed the exact ${metrics.activeFilter.uniqueRowsSeen} active and ${metrics.expiringFilter.uniqueRowsSeen} expiring subsets, and restored the independent filter offsets.
- Activated the visible \`View archive (${metrics.archiveCount})\` action, traversed all ${metrics.archiveCount} finished/discarded rows to the unique final row, then used Back and restored the prior Shelf boundary.
- Horizontal overflow: ${metrics.horizontalOverflowPixels} px. JavaScript dialogs: ${metrics.dialogCount}. Unexpected warn/error logs: ${metrics.unexpectedLogs.length}.

## Mounted Row Bounds

| Collection | Unique rows seen | Mounted row range | Bottom visible rows |
| --- | ---: | ---: | ---: |
| All Shelf | ${metrics.allFilter.uniqueRowsSeen} | ${metrics.allFilter.minMountedRows}-${metrics.allFilter.maxMountedRows} | ${metrics.allFilter.visibleRowsAtBottom} |
| Actives | ${metrics.activeFilter.uniqueRowsSeen} | ${metrics.activeFilter.minMountedRows}-${metrics.activeFilter.maxMountedRows} | ${metrics.activeFilter.visibleRowsAtBottom} |
| Expiring | ${metrics.expiringFilter.uniqueRowsSeen} | ${metrics.expiringFilter.minMountedRows}-${metrics.expiringFilter.maxMountedRows} | ${metrics.expiringFilter.visibleRowsAtBottom} |
| Archive | ${metrics.archive.uniqueRowsSeen} | ${metrics.archive.minMountedRows}-${metrics.archive.maxMountedRows} | ${metrics.archive.visibleRowsAtBottom} |

The raw content-free Profiler counters, scroll geometry, expected development logs, and exact offset values are in \`metrics.json\`. Screenshots \`01\` through \`05\` cover Shelf top/bottom, Archive top/bottom, and restored Shelf after Back.

## Evidence Boundary

The deterministic fixture is development-web-only, capped at 250 rows, and overlays only after the real Shelf availability query succeeds. It contains no account, product, barcode, ingredient, health, storage, or provider data. This run proves collection traversal, filter subset completeness, offset restoration, blank-viewport behavior, and responsive layout on Expo web. It does not set or validate native \`initialNumToRender\`, batch, window, clipping, frame, memory, Dynamic Type, or VoiceOver parameters; those remain supported-iOS device gates.
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
