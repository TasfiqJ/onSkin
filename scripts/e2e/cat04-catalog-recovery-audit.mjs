import { execFileSync, spawn } from 'node:child_process';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const isWindows = process.platform === 'win32';
const SEARCH_QUERY = 'ceramide cleanser';
const FIXTURE_BARCODE = '012345678905';

const CAT04_DECLARED_UNTRACKED_OUTPUT_PATTERNS = Object.freeze([
  /^\.tmp(?:\/|$)/,
  /^docs\/generated\/(?:source-packet-audit|tas-todo-audit|readiness-status-audit|device-support-policy-audit|performance-readiness-audit|generated-packet-status-audit)\.(?:json|md)$/,
  /^docs\/phase-(?:3|4|5|6|7|8|9|10|11)\/generated\/.+\.(?:json|md)$/,
  /^test-results\/human-e2e\/\d{4}-\d{2}-\d{2}\/cat04-catalog-recovery-current(?:\/|$)/,
]);

function normalizeRepoPath(value) {
  return String(value).replace(/\\/g, '/').replace(/^\.\//, '');
}

function isDeclaredCat04UntrackedOutput(repoPath) {
  const normalized = normalizeRepoPath(repoPath);
  return CAT04_DECLARED_UNTRACKED_OUTPUT_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function collectCat04UntrackedSourcePaths(untrackedRepoFiles) {
  return [...new Set(untrackedRepoFiles.map(normalizeRepoPath).filter(Boolean))]
    .filter((repoPath) => !isDeclaredCat04UntrackedOutput(repoPath))
    .sort(compareArtifactPaths);
}

export function listCat04NonIgnoredUntrackedRepoFiles(root = repoRoot) {
  try {
    return execFileSync('git', ['ls-files', '--others', '--exclude-standard', '-z'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
      .split('\0')
      .filter(Boolean)
      .map(normalizeRepoPath);
  } catch (error) {
    throw new Error(
      `Unable to enumerate nonignored untracked CAT04 source files: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export function assertCat04SourceProvenance({
  root = repoRoot,
  untrackedRepoFiles = listCat04NonIgnoredUntrackedRepoFiles(root),
} = {}) {
  const untrackedSourcePaths = collectCat04UntrackedSourcePaths(untrackedRepoFiles);
  if (untrackedSourcePaths.length > 0) {
    throw new Error(
      `Refusing to generate CAT04 evidence while nonignored untracked source is outside the declared generated/evidence/runtime outputs: ${untrackedSourcePaths.join(', ')}. Commit the source before running this audit.`,
    );
  }
  return untrackedSourcePaths;
}

export const CAT04_REQUIRED_VIEWPORTS = Object.freeze([
  Object.freeze({ id: 'iphone-375x667', width: 375, height: 667 }),
  Object.freeze({ id: 'iphone-390x844', width: 390, height: 844 }),
  Object.freeze({ id: 'iphone-430x932', width: 430, height: 932 }),
]);

export const CAT04_AUDIT_LIMITATIONS = Object.freeze([
  'This audit uses Expo web and deterministic development fixtures.',
  'It does not prove native camera hardware, OS permission sheets, or physical-iPhone behavior.',
  'The existing scan fixture seeds only the Scan screen; no production fixture drives lookupBarcode from an offline queued retry to a ready match. A restart-same-origin, Shelf-ready review accept/reject cycle therefore requires a real staging catalog and is deliberately not faked here.',
]);

export const CAT04_FIXTURE_GROUPS = Object.freeze([
  Object.freeze({
    id: 'matched',
    env: Object.freeze({
      EXPO_PUBLIC_E2E_CATALOG_SEARCH_RESULT: 'matched',
      EXPO_PUBLIC_E2E_SHELF_SCAN_RESULT: 'matched',
    }),
  }),
  Object.freeze({
    id: 'no-match',
    env: Object.freeze({
      EXPO_PUBLIC_E2E_CATALOG_SEARCH_RESULT: 'no_match',
      EXPO_PUBLIC_E2E_SHELF_SCAN_RESULT: 'no_match',
    }),
  }),
  Object.freeze({
    id: 'offline',
    env: Object.freeze({ EXPO_PUBLIC_E2E_SHELF_SCAN_RESULT: 'offline' }),
  }),
  Object.freeze({
    id: 'scan-error',
    env: Object.freeze({
      EXPO_PUBLIC_E2E_CATALOG_SEARCH_RESULT: 'wrong_match',
      EXPO_PUBLIC_E2E_SHELF_SCAN_RESULT: 'error',
    }),
  }),
  Object.freeze({
    id: 'camera-recovery',
    env: Object.freeze({
      EXPO_PUBLIC_E2E_APP_SETTINGS_FAILURE: '1',
      EXPO_PUBLIC_E2E_SHELF_CAMERA_PERMISSION: 'denied_no_retry',
    }),
  }),
  Object.freeze({
    id: 'ocr-capture-failure',
    env: Object.freeze({ EXPO_PUBLIC_E2E_SHELF_OCR_CAPTURE_FAILURE: 'once' }),
  }),
]);

export const CAT04_SCENARIO_MATRIX = Object.freeze([
  Object.freeze({
    id: 'search-matched',
    fixture: 'matched',
    groupId: 'matched',
    route: '/shelf/search',
  }),
  Object.freeze({
    id: 'scan-matched',
    fixture: 'matched',
    groupId: 'matched',
    route: '/shelf/scan',
  }),
  Object.freeze({
    id: 'scan-wrong-match-recovery',
    fixture: 'matched_wrong_match_recovery',
    groupId: 'matched',
    route: '/shelf/scan',
  }),
  Object.freeze({
    id: 'search-no-match',
    fixture: 'no_match',
    groupId: 'no-match',
    route: '/shelf/search',
  }),
  Object.freeze({
    id: 'scan-no-match',
    fixture: 'no_match',
    groupId: 'no-match',
    route: '/shelf/scan',
  }),
  Object.freeze({
    id: 'search-wrong-match-recovery',
    fixture: 'wrong_match',
    groupId: 'scan-error',
    route: '/shelf/search',
  }),
  Object.freeze({
    id: 'search-offline',
    fixture: 'offline',
    groupId: 'offline',
    route: '/shelf/search',
  }),
  Object.freeze({
    id: 'scan-offline',
    fixture: 'offline',
    groupId: 'offline',
    route: '/shelf/scan',
  }),
  Object.freeze({
    id: 'scan-error',
    fixture: 'error',
    groupId: 'scan-error',
    route: '/shelf/scan',
  }),
  Object.freeze({
    id: 'scan-camera-denied-settings-failure',
    fixture: 'denied_no_retry',
    groupId: 'camera-recovery',
    route: '/shelf/scan',
  }),
  Object.freeze({
    id: 'ocr-camera-denied-settings-failure',
    fixture: 'denied_no_retry',
    groupId: 'camera-recovery',
    route: '/shelf/ocr',
  }),
  Object.freeze({
    id: 'ocr-capture-failure',
    fixture: 'capture_failure_once',
    groupId: 'ocr-capture-failure',
    route: '/shelf/ocr',
  }),
  Object.freeze({
    id: 'no-match-missing-barcode',
    fixture: 'missing_barcode',
    groupId: 'ocr-capture-failure',
    route: '/shelf/no-match',
  }),
  Object.freeze({
    id: 'catalog-recovery-malformed',
    fixture: 'malformed_params',
    groupId: 'ocr-capture-failure',
    route: '/shelf/catalog-recovery',
  }),
  Object.freeze({
    id: 'manual-barcode-validation',
    fixture: 'manual_barcode_validation',
    groupId: 'ocr-capture-failure',
    route: '/shelf/manual',
  }),
]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export function isExcludedFromInteractionTree(node) {
  return Boolean(node?.closest?.('[aria-hidden="true"],[inert]'));
}

export function measureControlGeometry(node, viewport, styleFor) {
  if (isExcludedFromInteractionTree(node)) return null;

  const clippingValues = new Set(['auto', 'clip', 'hidden', 'scroll']);
  const unsafeClippingValues = new Set(['clip', 'hidden']);
  const rect = node.getBoundingClientRect();
  let exposedLeft = Math.max(0, rect.left);
  let exposedRight = Math.min(viewport.width, rect.right);
  let exposedTop = Math.max(0, rect.top);
  let exposedBottom = Math.min(viewport.height, rect.bottom);
  let scrollClipped = false;
  let unsafeClipped = false;

  for (let ancestor = node; ancestor; ancestor = ancestor.parentElement) {
    const style = styleFor(ancestor);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return null;
    }
    if (ancestor === node) continue;

    const ancestorRect = ancestor.getBoundingClientRect();
    const clientLeft = Number(ancestor.clientLeft);
    const clientTop = Number(ancestor.clientTop);
    const clientWidth = Number(ancestor.clientWidth);
    const clientHeight = Number(ancestor.clientHeight);
    const clipLeft = ancestorRect.left + (Number.isFinite(clientLeft) ? clientLeft : 0);
    const clipTop = ancestorRect.top + (Number.isFinite(clientTop) ? clientTop : 0);
    const clipRight = clipLeft + (Number.isFinite(clientWidth) ? clientWidth : ancestorRect.width);
    const clipBottom =
      clipTop + (Number.isFinite(clientHeight) ? clientHeight : ancestorRect.height);

    if (clippingValues.has(style.overflowX)) {
      const nextLeft = Math.max(exposedLeft, clipLeft);
      const nextRight = Math.min(exposedRight, clipRight);
      const reduced = nextLeft > exposedLeft + 1 || nextRight < exposedRight - 1;
      if (reduced) {
        if (unsafeClippingValues.has(style.overflowX)) unsafeClipped = true;
        else scrollClipped = true;
      }
      exposedLeft = nextLeft;
      exposedRight = nextRight;
    }
    if (clippingValues.has(style.overflowY)) {
      const nextTop = Math.max(exposedTop, clipTop);
      const nextBottom = Math.min(exposedBottom, clipBottom);
      const reduced = nextTop > exposedTop + 1 || nextBottom < exposedBottom - 1;
      if (reduced) {
        if (unsafeClippingValues.has(style.overflowY)) unsafeClipped = true;
        else scrollClipped = true;
      }
      exposedTop = nextTop;
      exposedBottom = nextBottom;
    }
  }

  const exposedWidth = Math.max(0, exposedRight - exposedLeft);
  const exposedHeight = Math.max(0, exposedBottom - exposedTop);
  if (rect.width <= 0 || rect.height <= 0 || exposedWidth <= 1 || exposedHeight <= 1) return null;

  return {
    exposedHeight,
    exposedLeft,
    exposedTop,
    exposedWidth,
    fullyExposed: exposedWidth >= rect.width - 1 && exposedHeight >= rect.height - 1,
    rect,
    scrollClipped,
    unsafeClipped,
  };
}

export function interactionTreeText(root, styleFor) {
  if (!root) return '';
  const walker = root.ownerDocument.createTreeWalker(root, 4);
  const values = [];
  for (let textNode = walker.nextNode(); textNode; textNode = walker.nextNode()) {
    const parent = textNode.parentElement;
    if (!parent || isExcludedFromInteractionTree(parent)) continue;
    if (parent.closest('script,style,noscript')) continue;
    let rendered = true;
    for (let ancestor = parent; ancestor; ancestor = ancestor.parentElement) {
      const style = styleFor(ancestor);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
        rendered = false;
        break;
      }
    }
    if (rendered) values.push(textNode.nodeValue ?? '');
  }
  return values.join(' ');
}

async function withAuditTimeout(operation, timeoutMs, label) {
  let timeout = null;
  const timeoutPromise = new Promise((_, reject) => {
    timeout = setTimeout(() => {
      const error = new Error(`${label} timed out after ${timeoutMs}ms.`);
      error.code = 'CAT04_OPERATION_TIMEOUT';
      reject(error);
    }, timeoutMs);
  });
  try {
    return await Promise.race([operation, timeoutPromise]);
  } finally {
    clearTimeout(timeout);
  }
}

export function validateCat04AuditConfiguration() {
  const requiredViewportIds = ['iphone-375x667', 'iphone-390x844', 'iphone-430x932'];
  const requiredScenarioIds = [
    'search-matched',
    'search-no-match',
    'search-offline',
    'search-wrong-match-recovery',
    'scan-matched',
    'scan-no-match',
    'scan-offline',
    'scan-error',
    'scan-wrong-match-recovery',
    'scan-camera-denied-settings-failure',
    'ocr-camera-denied-settings-failure',
    'ocr-capture-failure',
    'no-match-missing-barcode',
    'catalog-recovery-malformed',
    'manual-barcode-validation',
  ];
  const viewportIds = CAT04_REQUIRED_VIEWPORTS.map(({ id }) => id).sort();
  const scenarioIds = CAT04_SCENARIO_MATRIX.map(({ id }) => id).sort();
  const groupIds = new Set(CAT04_FIXTURE_GROUPS.map(({ id }) => id));

  assert(
    JSON.stringify(viewportIds) === JSON.stringify(requiredViewportIds.sort()),
    'CAT04 audit viewports do not match the required Expo-web matrix.',
  );
  assert(
    JSON.stringify(scenarioIds) === JSON.stringify(requiredScenarioIds.sort()),
    'CAT04 audit scenarios do not cover every required deterministic lane.',
  );
  assert(new Set(viewportIds).size === viewportIds.length, 'CAT04 viewport IDs must be unique.');
  assert(new Set(scenarioIds).size === scenarioIds.length, 'CAT04 scenario IDs must be unique.');
  assert(groupIds.size === CAT04_FIXTURE_GROUPS.length, 'CAT04 fixture-group IDs must be unique.');
  for (const scenario of CAT04_SCENARIO_MATRIX) {
    assert(groupIds.has(scenario.groupId), `Unknown fixture group: ${scenario.groupId}`);
  }
  for (const group of CAT04_FIXTURE_GROUPS) {
    assert(
      CAT04_SCENARIO_MATRIX.some(({ groupId }) => groupId === group.id),
      `Fixture group has no scenario: ${group.id}`,
    );
  }
  return {
    executionCount: CAT04_REQUIRED_VIEWPORTS.length * CAT04_SCENARIO_MATRIX.length,
    scenarioCount: CAT04_SCENARIO_MATRIX.length,
    viewportCount: CAT04_REQUIRED_VIEWPORTS.length,
  };
}

export function safeArtifactId(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function requestUrlById(events) {
  const requests = new Map();
  for (const event of events) {
    if (event.method === 'Network.requestWillBeSent') {
      requests.set(event.params.requestId, event.params.request?.url ?? null);
    } else if (event.method === 'Network.webSocketCreated') {
      requests.set(event.params.requestId, event.params.url ?? null);
    }
  }
  return requests;
}

function localEndpoint(url, allowedOrigins) {
  try {
    const candidate = new URL(url);
    if (!['http:', 'https:', 'ws:', 'wss:'].includes(candidate.protocol)) return true;
    return allowedOrigins.some((origin) => {
      const allowed = new URL(origin);
      return candidate.hostname === allowed.hostname && candidate.port === allowed.port;
    });
  } catch {
    return true;
  }
}

function consoleText(params) {
  return (params.args ?? [])
    .map((argument) => argument.value ?? argument.description ?? argument.unserializableValue ?? '')
    .join(' ')
    .slice(0, 2_000);
}

/** Convert CDP events into release-blocking browser failures. */
export function classifyBrowserFailures(events, allowedOrigins = []) {
  const failures = [];
  const requests = requestUrlById(events);

  for (const event of events) {
    const { method, params = {} } = event;
    if (method === 'Runtime.consoleAPICalled' && ['error', 'assert'].includes(params.type)) {
      failures.push({ method, text: consoleText(params), type: 'console-error' });
      continue;
    }
    if (method === 'Runtime.exceptionThrown') {
      failures.push({
        method,
        text:
          params.exceptionDetails?.exception?.description ??
          params.exceptionDetails?.text ??
          'Uncaught page exception',
        type: 'page-exception',
      });
      continue;
    }
    if (method === 'Log.entryAdded' && params.entry?.level === 'error') {
      failures.push({ method, text: params.entry.text, type: 'browser-log-error' });
      continue;
    }
    if (method === 'Network.requestWillBeSent') {
      const url = params.request?.url;
      if (url && !localEndpoint(url, allowedOrigins)) {
        failures.push({ method, type: 'unexpected-remote-request', url });
      }
      continue;
    }
    if (method === 'Network.webSocketCreated') {
      const url = params.url;
      if (url && !localEndpoint(url, allowedOrigins)) {
        failures.push({ method, type: 'unexpected-remote-websocket', url });
      }
      continue;
    }
    if (method === 'Network.webSocketFrameError') {
      failures.push({
        errorText: params.errorMessage,
        method,
        type: 'websocket-frame-error',
        url: requests.get(params.requestId) ?? null,
      });
      continue;
    }
    if (method === 'Network.responseReceived' && Number(params.response?.status) >= 400) {
      failures.push({
        method,
        status: params.response.status,
        type: 'http-error-response',
        url: params.response.url,
      });
      continue;
    }
    if (method === 'Network.loadingFailed' && params.canceled !== true) {
      failures.push({
        errorText: params.errorText,
        method,
        type: 'network-loading-failed',
        url: requests.get(params.requestId) ?? null,
      });
      continue;
    }
    if (method === 'Page.javascriptDialogOpening') {
      failures.push({ method, text: params.message, type: 'unexpected-page-dialog' });
      continue;
    }
    if (method === 'Inspector.targetCrashed' || method === 'Page.crashed') {
      failures.push({ method, type: 'page-crash' });
    }
  }

  return failures;
}

function hostPortAvailable(host, port) {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.listen(port, host, () => server.close(() => resolve(true)));
  });
}

async function portAvailable(port) {
  return (await hostPortAvailable('127.0.0.1', port)) && (await hostPortAvailable('::1', port));
}

async function findAvailablePort(preferred) {
  for (let offset = 0; offset <= 100; offset += 1) {
    const candidate = preferred + offset;
    if (await portAvailable(candidate)) return candidate;
  }
  throw new Error(`No open localhost port from ${preferred} through ${preferred + 100}.`);
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
  const candidate = browserPathCandidates().find((item) => existsSync(item));
  if (!candidate) {
    throw new Error('Chrome or Edge was not found. Set CHROME_PATH or BROWSER_PATH.');
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
    await waitForExit(750);
    if (child.exitCode === null) child.kill('SIGKILL');
    await waitForExit(750);
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
    delay(4_000),
  ]);
  if (child.exitCode === null) child.kill('SIGKILL');
  await waitForExit(1_000);
  detach();
}

async function stopProcessBestEffort(child) {
  await Promise.race([stopProcess(child), delay(7_000)]);
}

export function cat04ServerEnvironment(group, inheritedEnvironment = process.env) {
  const env = { ...inheritedEnvironment };
  for (const key of Object.keys(env)) {
    if (key.startsWith('EXPO_PUBLIC_E2E_')) delete env[key];
  }
  return {
    ...env,
    BROWSER: 'none',
    CI: '1',
    EXPO_NO_DOTENV: '1',
    EXPO_PUBLIC_APP_ENV: 'development',
    EXPO_PUBLIC_E2E_APP_LOCK_ENABLED: 'false',
    EXPO_PUBLIC_E2E_LOCAL_RESET: '1',
    EXPO_PUBLIC_E2E_SHELF_SCAN_BARCODE: FIXTURE_BARCODE,
    EXPO_PUBLIC_NATIVE_CAMERA_ENABLED: 'true',
    EXPO_PUBLIC_NATIVE_OCR_ENABLED: 'false',
    EXPO_PUBLIC_POSTHOG_KEY: '',
    EXPO_PUBLIC_REVENUECAT_ANDROID_KEY: '',
    EXPO_PUBLIC_REVENUECAT_IOS_KEY: '',
    EXPO_PUBLIC_REVENUECAT_TEST_STORE_KEY: '',
    EXPO_PUBLIC_SENTRY_DSN: '',
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '__BLOCKED_PLACEHOLDER__',
    EXPO_PUBLIC_SUPABASE_URL: 'https://blocked-supabase-url.invalid',
    ...group.env,
  };
}

function startExpoServer({ appPort, evidenceDir, group }) {
  const command = isWindows ? (process.env.ComSpec ?? 'cmd.exe') : 'npm';
  const args = isWindows
    ? [
        '/d',
        '/s',
        '/c',
        `npm --workspace apps/mobile run web -- --clear --port ${appPort} --host localhost`,
      ]
    : [
        '--workspace',
        'apps/mobile',
        'run',
        'web',
        '--',
        '--clear',
        '--port',
        String(appPort),
        '--host',
        'localhost',
      ];
  const logPath = path.join(evidenceDir, `expo-${safeArtifactId(group.id)}.log`);
  writeFileSync(logPath, '');
  const child = spawn(command, args, {
    cwd: repoRoot,
    env: cat04ServerEnvironment(group),
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  const append = (chunk) => appendFileSync(logPath, chunk.toString());
  child.stdout.on('data', append);
  child.stderr.on('data', append);
  return child;
}

function startBrowser({ browserPath, debugPort, userDataDir }) {
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
    this.inflight = new Set();
    this.ws = new WebSocket(wsUrl);
    this.ready = new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('CDP websocket did not open within 20000ms.')),
        20_000,
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
          reject(new Error('CDP websocket failed before opening.'));
        },
        { once: true },
      );
      this.ws.addEventListener(
        'close',
        () => {
          clearTimeout(timeout);
          reject(new Error('CDP websocket closed before opening.'));
        },
        { once: true },
      );
    });
    this.ws.addEventListener('message', (event) => this.handleMessage(event));
    this.ws.addEventListener('close', () => {
      this.rejectPending(new Error('CDP websocket closed before the command completed.'));
    });
    this.ws.addEventListener('error', () => {
      this.rejectPending(new Error('CDP websocket failed before the command completed.'));
    });
  }

  rejectPending(error) {
    for (const { reject, timeout } of this.pending.values()) {
      clearTimeout(timeout);
      reject(error);
    }
    this.pending.clear();
  }

  handleMessage(event) {
    const message = JSON.parse(event.data.toString());
    if (message.id && this.pending.has(message.id)) {
      const { reject, resolve, timeout } = this.pending.get(message.id);
      this.pending.delete(message.id);
      clearTimeout(timeout);
      if (message.error) reject(new Error(`${message.error.message}: ${message.error.data ?? ''}`));
      else resolve(message.result ?? {});
      return;
    }
    if (!message.method) return;
    if (message.method === 'Network.requestWillBeSent') {
      this.inflight.add(message.params.requestId);
    }
    if (['Network.loadingFinished', 'Network.loadingFailed'].includes(message.method)) {
      this.inflight.delete(message.params.requestId);
    }
    this.events.push({ ...message, observedAt: new Date().toISOString() });
  }

  async send(method, params = {}, timeoutMs = 20_000) {
    await this.ready;
    if (this.ws.readyState !== 1) throw new Error(`CDP websocket is not open for ${method}.`);
    const id = this.nextId;
    this.nextId += 1;
    return await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (!this.pending.has(id)) return;
        this.pending.delete(id);
        reject(new Error(`CDP command ${method} timed out after ${timeoutMs}ms.`));
      }, timeoutMs);
      this.pending.set(id, { reject, resolve, timeout });
      try {
        this.ws.send(JSON.stringify({ id, method, params }));
      } catch (error) {
        this.pending.delete(id);
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  close() {
    this.ws.close();
  }
}

async function connectToPage(debugPort) {
  const targets = await readJson(`http://127.0.0.1:${debugPort}/json`);
  const target = targets.find(
    (candidate) => candidate.type === 'page' && candidate.webSocketDebuggerUrl,
  );
  if (!target) throw new Error('No debuggable browser page was found.');
  const client = new CdpClient(target.webSocketDebuggerUrl);
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
    await delay(200);
  }
  throw new Error(`Timed out waiting for ${label}: ${lastError?.message ?? 'condition false'}`);
}

async function waitForText(client, text, timeoutMs = 30_000) {
  await waitForCondition(
    client,
    `(() => {
      const isExcludedFromInteractionTree = ${isExcludedFromInteractionTree.toString()};
      const interactionTreeText = ${interactionTreeText.toString()};
      return interactionTreeText(document.body, (node) => getComputedStyle(node)).replace(/\\s+/g, ' ').includes(${JSON.stringify(text)});
    })()`,
    timeoutMs,
    `text ${JSON.stringify(text)}`,
  );
}

async function waitForPath(client, prefix, timeoutMs = 30_000) {
  await waitForCondition(
    client,
    `window.location.pathname.startsWith(${JSON.stringify(prefix)})`,
    timeoutMs,
    `path ${prefix}`,
  );
}

async function waitForNetworkIdle(client, timeoutMs = 10_000, { maxInflight = 0 } = {}) {
  const startedAt = Date.now();
  let quietSince = null;
  while (Date.now() - startedAt < timeoutMs) {
    if (client.inflight.size <= maxInflight) {
      quietSince ??= Date.now();
      if (Date.now() - quietSince >= 400) return;
    } else {
      quietSince = null;
    }
    await delay(100);
  }
  throw new Error(
    `Network did not become idle; ${client.inflight.size} request(s) remain; allowed ${maxInflight}.`,
  );
}

function networkIdleTimeoutForFixtureGroup(fixtureGroup) {
  return fixtureGroup === 'camera-recovery' ? 30_000 : 10_000;
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

function controlExpression(label, exact, scroll) {
  return `(() => {
    const wanted = ${JSON.stringify(label)};
    const exact = ${JSON.stringify(exact)};
    const normalize = (value) => String(value ?? '').replace(/\\s+/g, ' ').trim();
    const matches = (value) => exact ? value === wanted : value.includes(wanted);
    const isExcludedFromInteractionTree = ${isExcludedFromInteractionTree.toString()};
    const candidates = Array.from(document.querySelectorAll('button,[role="button"],[role="radio"],[role="checkbox"],[role="switch"],a,label'))
      .filter((node) => !isExcludedFromInteractionTree(node));
    const target = candidates.find((node) => [
      node.getAttribute('aria-label'),
      node.getAttribute('accessibilitylabel'),
      node.textContent,
      node.getAttribute('title'),
    ].map(normalize).filter(Boolean).some(matches));
    if (!target) return null;
    if (${JSON.stringify(scroll)}) target.scrollIntoView({ block: 'center', inline: 'center' });
    const rect = target.getBoundingClientRect();
    const style = getComputedStyle(target);
    return {
      ariaDisabled: target.getAttribute('aria-disabled'),
      disabled: Boolean(target.disabled),
      height: rect.height,
      visible: rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden',
      width: rect.width,
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  })()`;
}

async function clickByText(client, label, { exact = true, timeoutMs = 30_000 } = {}) {
  const startedAt = Date.now();
  let target = null;
  while (Date.now() - startedAt < timeoutMs) {
    target = await evaluate(client, controlExpression(label, exact, true));
    if (target?.visible && !target.disabled && target.ariaDisabled !== 'true') break;
    await delay(200);
  }
  assert(target?.visible, `Could not find visible control ${JSON.stringify(label)}.`);
  assert(!target.disabled && target.ariaDisabled !== 'true', `${label} is disabled.`);
  assert(
    target.width >= 44 && target.height >= 44,
    `${label} is smaller than 44 by 44 CSS pixels.`,
  );
  await client.send('Input.dispatchTouchEvent', {
    touchPoints: [
      {
        force: 1,
        id: 1,
        radiusX: 2,
        radiusY: 2,
        x: target.x,
        y: target.y,
      },
    ],
    type: 'touchStart',
  });
  await client.send('Input.dispatchTouchEvent', {
    touchPoints: [],
    type: 'touchEnd',
  });
  await delay(250);
}

async function scrollControlIntoView(client, label, { exact = true, timeoutMs = 30_000 } = {}) {
  const startedAt = Date.now();
  let target = null;
  while (Date.now() - startedAt < timeoutMs) {
    target = await evaluate(client, controlExpression(label, exact, true));
    if (target?.visible) break;
    await delay(200);
  }
  assert(target?.visible, `Could not scroll control ${JSON.stringify(label)} into view.`);
  await delay(250);
  return target;
}

async function scrollTextIntoView(client, text, timeoutMs = 30_000) {
  const expression = `(() => {
    const wanted = ${JSON.stringify(text)};
    const normalize = (value) => String(value ?? '').replace(/\\s+/g, ' ').trim();
    const isExcludedFromInteractionTree = ${isExcludedFromInteractionTree.toString()};
    const candidates = Array.from(document.querySelectorAll('body *'))
      .filter((node) => !isExcludedFromInteractionTree(node))
      .filter((node) => normalize(node.textContent).includes(wanted))
      .sort((a, b) => normalize(a.textContent).length - normalize(b.textContent).length);
    const target = candidates[0];
    if (!target) return false;
    target.scrollIntoView({ block: 'center', inline: 'nearest' });
    return true;
  })()`;
  await waitForCondition(client, expression, timeoutMs, `text to scroll ${JSON.stringify(text)}`);
  await delay(250);
}

function fillExpression(label, value) {
  return `(() => {
    const wanted = ${JSON.stringify(label)};
    const value = ${JSON.stringify(value)};
    const normalize = (next) => String(next ?? '').replace(/\\s+/g, ' ').trim();
    const isExcludedFromInteractionTree = ${isExcludedFromInteractionTree.toString()};
    const controls = Array.from(document.querySelectorAll('input,textarea'))
      .filter((node) => !isExcludedFromInteractionTree(node));
    const target = controls.find((node) => [
      node.getAttribute('aria-label'),
      node.getAttribute('accessibilitylabel'),
      node.getAttribute('placeholder'),
    ].map(normalize).includes(wanted));
    if (!target) return null;
    target.scrollIntoView({ block: 'center', inline: 'nearest' });
    target.focus();
    const prototype = target instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    if (setter) setter.call(target, value);
    else target.value = value;
    target.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      data: value,
      inputType: 'insertText',
    }));
    target.dispatchEvent(new Event('change', { bubbles: true }));
    return { value: target.value };
  })()`;
}

async function fillByLabel(client, label, value) {
  const result = await evaluate(client, fillExpression(label, value));
  assert(result, `Could not find input ${JSON.stringify(label)}.`);
  assert(result.value === value, `${label} did not receive its deterministic value.`);
  await delay(150);
}

async function waitForInputValue(client, label, value, timeoutMs = 10_000) {
  await waitForCondition(
    client,
    `(() => {
      const isExcludedFromInteractionTree = ${isExcludedFromInteractionTree.toString()};
      return Array.from(document.querySelectorAll('input,textarea')).some((node) => {
        if (isExcludedFromInteractionTree(node)) return false;
        const candidate = node.getAttribute('aria-label') || node.getAttribute('accessibilitylabel') || node.getAttribute('placeholder');
        return candidate === ${JSON.stringify(label)} && node.value === ${JSON.stringify(value)};
      });
    })()`,
    timeoutMs,
    `${label} value ${JSON.stringify(value)}`,
  );
}

function enabledControlExpression(label) {
  return `(() => {
    const wanted = ${JSON.stringify(label)};
    const normalize = (value) => String(value ?? '').replace(/\\s+/g, ' ').trim();
    const isExcludedFromInteractionTree = ${isExcludedFromInteractionTree.toString()};
    return Array.from(document.querySelectorAll('button,[role="button"]')).some((node) => {
      if (isExcludedFromInteractionTree(node)) return false;
      const values = [node.getAttribute('aria-label'), node.textContent].map(normalize).filter(Boolean);
      return values.includes(wanted) && !node.disabled && node.getAttribute('aria-disabled') !== 'true';
    });
  })()`;
}

function auditExpression() {
  return `(() => {
    const normalize = (value) => String(value ?? '').replace(/\\s+/g, ' ').trim();
    const doc = document.documentElement;
    const body = document.body;
    const overflowX = Math.max(0, doc.scrollWidth - innerWidth, body.scrollWidth - innerWidth);
    const isExcludedFromInteractionTree = ${isExcludedFromInteractionTree.toString()};
    const interactionTreeText = ${interactionTreeText.toString()};
    const measureControlGeometry = ${measureControlGeometry.toString()};
    const controls = [];
    const issues = [];
    for (const node of document.querySelectorAll('button,[role="button"],[role="radio"],[role="checkbox"],[role="switch"],input,textarea,select')) {
      const geometry = measureControlGeometry(
        node,
        { height: innerHeight, width: innerWidth },
        (candidate) => getComputedStyle(candidate),
      );
      if (!geometry) continue;
      const {
        exposedHeight,
        exposedLeft,
        exposedTop,
        exposedWidth,
        fullyExposed,
        rect,
        scrollClipped,
        unsafeClipped,
      } = geometry;
      const label = normalize(node.getAttribute('aria-label') || node.getAttribute('accessibilitylabel') || node.textContent || node.getAttribute('placeholder'));
      if (!label) continue;
      const disabled = Boolean(node.disabled) || node.getAttribute('aria-disabled') === 'true';
      const center = {
        x: Math.max(0, Math.min(innerWidth - 1, exposedLeft + exposedWidth / 2)),
        y: Math.max(0, Math.min(innerHeight - 1, exposedTop + exposedHeight / 2)),
      };
      const hit = document.elementFromPoint(center.x, center.y);
      const hitOk = !hit || node === hit || node.contains(hit) || hit.contains(node);
      const control = {
        disabled,
        fullyExposed,
        height: Number(rect.height.toFixed(2)),
        hitOk,
        label,
        scrollClipped,
        unsafeClipped,
        width: Number(rect.width.toFixed(2)),
        x: Number(rect.left.toFixed(2)),
        y: Number(rect.top.toFixed(2)),
      };
      controls.push(control);
      const horizontallyViewportClipped = rect.left < -1 || rect.right > innerWidth + 1;
      if (horizontallyViewportClipped || unsafeClipped) {
        issues.push({ control, type: 'clippedVisibleControl' });
      }
      if (horizontallyViewportClipped) {
        issues.push({ control, type: 'horizontalControlClipping' });
      }
      if (!fullyExposed) continue;
      if (!disabled && (rect.width < 44 || rect.height < 44)) issues.push({ control, type: 'sub44VisibleControl' });
      if (!disabled && !hitOk) issues.push({ control, type: 'blockedCenterHitTest' });
    }
    if (overflowX > 1) issues.push({ overflowX, type: 'horizontalOverflow' });
    return {
      alerts: Array.from(document.querySelectorAll('[role="alert"]'))
        .filter((node) => !isExcludedFromInteractionTree(node))
        .map((node) => normalize(node.textContent)),
      bodyText: normalize(interactionTreeText(body, (node) => getComputedStyle(node))).slice(0, 8_000),
      controls,
      inputs: Array.from(document.querySelectorAll('input,textarea'))
        .filter((node) => !isExcludedFromInteractionTree(node))
        .map((node) => ({
          label: normalize(node.getAttribute('aria-label') || node.getAttribute('accessibilitylabel') || node.getAttribute('placeholder')),
          value: node.value,
        })),
      issues,
      overflowX,
      title: document.title,
      url: location.href,
      viewport: { height: innerHeight, width: innerWidth },
    };
  })()`;
}

function assertSnapshotClean(snapshot, label) {
  assert(snapshot.viewport.width > 0 && snapshot.viewport.height > 0, `${label} has no viewport.`);
  assert(snapshot.overflowX <= 1, `${label} has ${snapshot.overflowX}px horizontal overflow.`);
  assert(snapshot.issues.length === 0, `${label} has ${snapshot.issues.length} control issue(s).`);
}

function assertInteractiveControl(snapshot, label) {
  const control = snapshot.controls.find((candidate) => candidate.label.includes(label));
  assert(control, `${snapshot.url} does not expose an interactive ${label} control.`);
  assert(!control.disabled, `${label} is disabled at ${snapshot.url}.`);
  assert(control.fullyExposed, `${label} is not fully exposed at ${snapshot.url}.`);
  assert(control.width >= 44 && control.height >= 44, `${label} is below the 44pt web proxy.`);
  assert(control.hitOk, `${label} is not center-hit-testable.`);
}

function assertDisabledControl(snapshot, label) {
  const control = snapshot.controls.find((candidate) => candidate.label.includes(label));
  assert(control, `${snapshot.url} does not expose a ${label} control.`);
  assert(control.disabled, `${label} should be disabled at ${snapshot.url}.`);
}

async function navigate(
  client,
  baseUrl,
  route,
  viewport,
  scenarioId,
  query = {},
  { maxInflight = 0 } = {},
) {
  await setViewport(client, viewport);
  const url = new URL(route, baseUrl);
  url.searchParams.set('cat04Audit', `${scenarioId}-${viewport.id}-${Date.now()}`);
  if (route === '/shelf/search') url.searchParams.set('e2eQuery', SEARCH_QUERY);
  for (const [key, value] of Object.entries(query)) {
    if (value !== null && value !== undefined) url.searchParams.set(key, String(value));
  }
  await client.send('Page.navigate', { url: url.toString() });
  await waitForPath(client, route);
  await waitForCondition(client, 'document.readyState === "complete"', 30_000, 'document ready');
  await waitForNetworkIdle(client, 10_000, { maxInflight });
}

function writeJson(evidenceDir, name, value) {
  writeFileSync(path.join(evidenceDir, name), `${JSON.stringify(value, null, 2)}\n`);
}

function compareArtifactPaths(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

export function listEvidenceArtifacts(evidenceDir) {
  const artifacts = [];

  const visit = (directory, relativeDirectory = '') => {
    const entries = readdirSync(directory, { withFileTypes: true }).sort((left, right) =>
      compareArtifactPaths(left.name, right.name),
    );
    for (const entry of entries) {
      const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(absolutePath, relativePath);
      } else if (entry.isFile() && relativePath !== 'summary.json') {
        artifacts.push(relativePath);
      }
    }
  };

  visit(evidenceDir);
  return artifacts.sort(compareArtifactPaths);
}

export function readSourceGitSha(root = repoRoot) {
  let sourceGitSha;
  try {
    sourceGitSha = execFileSync('git', ['rev-parse', '--verify', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
      windowsHide: true,
    }).trim();
  } catch (error) {
    throw new Error(
      `Unable to bind CAT04 evidence to the source Git commit: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!/^[a-f0-9]{40}$/.test(sourceGitSha)) {
    throw new Error('CAT04 sourceGitSha must be a lowercase full 40-character Git SHA.');
  }
  return sourceGitSha;
}

async function captureStep(client, evidenceDir, artifactName) {
  await delay(250);
  const snapshot = await evaluate(client, auditExpression());
  assertSnapshotClean(snapshot, artifactName);
  writeJson(evidenceDir, `${artifactName}.json`, snapshot);
  const screenshot = await client.send('Page.captureScreenshot', {
    captureBeyondViewport: false,
    format: 'png',
  });
  writeFileSync(path.join(evidenceDir, `${artifactName}.png`), screenshot.data, 'base64');
  return snapshot;
}

async function establishLocalHealthConsent({ client, baseUrl, evidenceDir, groupId, viewport }) {
  const artifactPrefix = safeArtifactId(`bootstrap-${groupId}-${viewport.id}`);
  const eventStart = client.events.length;
  const result = {
    artifactPrefix,
    browserFailures: [],
    completedAt: null,
    error: null,
    fixtureGroup: groupId,
    nativeDeviceProof: false,
    startedAt: new Date().toISOString(),
    surface: 'expo-web',
    verdict: 'fail',
    viewport,
  };

  try {
    await setViewport(client, viewport);
    const resetUrl = new URL('/', baseUrl);
    resetUrl.searchParams.set('e2eReset', 'local');
    resetUrl.searchParams.set('cat04Bootstrap', `${groupId}-${viewport.id}-${Date.now()}`);
    await client.send('Page.navigate', { url: resetUrl.toString() });
    await waitForText(client, 'Begin', 60_000);
    await clickByText(client, 'Begin');
    await waitForPath(client, '/onboarding/age');
    await waitForText(client, 'First, your');
    await fillByLabel(client, 'Day of birth', '01');
    await fillByLabel(client, 'Month of birth', '01');
    await fillByLabel(client, 'Year of birth', '1990');
    await waitForCondition(
      client,
      enabledControlExpression('Continue'),
      10_000,
      'enabled Continue',
    );
    await clickByText(client, 'Continue');

    await waitForPath(client, '/onboarding/consent');
    await waitForText(client, 'Before the quiz');
    await clickByText(client, 'I agree. Continue');
    await waitForPath(client, '/onboarding/goals');
    await waitForText(client, 'What brings you here?');

    // Fresh grants deliberately hold all health routes behind the mounted-goals
    // activation interlock. Probe the real catalog route until that durable
    // acknowledgement has completed instead of mutating private storage.
    const probeDeadline = Date.now() + 30_000;
    let catalogReady = false;
    while (Date.now() < probeDeadline && !catalogReady) {
      const probeUrl = new URL('/shelf/search', baseUrl);
      probeUrl.searchParams.set('cat04ConsentProbe', `${groupId}-${viewport.id}-${Date.now()}`);
      await client.send('Page.navigate', { url: probeUrl.toString() });
      await delay(1_000);
      catalogReady = await evaluate(
        client,
        `window.location.pathname === '/shelf/search' && document.body?.innerText.includes('Search catalog')`,
      );
    }
    assert(catalogReady, 'Explicit local consent did not release the catalog route.');
    await waitForNetworkIdle(client, networkIdleTimeoutForFixtureGroup(groupId), {
      maxInflight: groupId === 'offline' ? 1 : 0,
    });
    await captureStep(client, evidenceDir, `${artifactPrefix}-catalog-ready`);
    result.browserFailures = classifyBrowserFailures(client.events.slice(eventStart), [baseUrl]);
    assert(
      result.browserFailures.length === 0,
      `Consent bootstrap emitted ${result.browserFailures.length} browser failure(s).`,
    );
    result.endUrl = await evaluate(client, 'location.href');
    result.verdict = 'pass';
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    result.browserFailures = classifyBrowserFailures(client.events.slice(eventStart), [baseUrl]);
    result.failureArtifacts = await captureFailure(client, evidenceDir, artifactPrefix);
  } finally {
    result.completedAt = new Date().toISOString();
    writeJson(evidenceDir, `${artifactPrefix}-result.json`, result);
  }

  return result;
}

function inputValue(snapshot, label) {
  return snapshot.inputs.find((input) => input.label === label)?.value ?? null;
}

async function openSearchAndSubmit(client, baseUrl, viewport, scenarioId, options = {}) {
  await navigate(client, baseUrl, '/shelf/search', viewport, scenarioId, {}, options);
  await waitForText(client, 'Search catalog');
  await waitForCondition(
    client,
    `(() => {
      const isExcludedFromInteractionTree = ${isExcludedFromInteractionTree.toString()};
      return Array.from(document.querySelectorAll('input,textarea')).some(
        (node) => !isExcludedFromInteractionTree(node) && node.value === ${JSON.stringify(SEARCH_QUERY)},
      );
    })()`,
    10_000,
    'seeded catalog query',
  );
  await waitForCondition(client, enabledControlExpression('Search'), 30_000, 'enabled Search');
  await clickByText(client, 'Search');
}

async function manualRecovery(client, evidenceDir, artifactPrefix, expected) {
  await waitForPath(client, '/shelf/manual');
  await waitForText(client, 'Add by hand');
  const snapshot = await captureStep(client, evidenceDir, `${artifactPrefix}-manual-recovery`);
  assertInteractiveControl(snapshot, 'Product name');
  if (expected.query) {
    assert(
      inputValue(snapshot, 'Product name') === expected.query,
      'Manual recovery lost the search query.',
    );
  }
  if (expected.barcode) {
    assert(
      inputValue(snapshot, 'Barcode, optional') === expected.barcode,
      'Manual recovery lost the package barcode.',
    );
  }
}

async function openedDateRecovery(client, evidenceDir, artifactPrefix) {
  await waitForPath(client, '/shelf/opened');
  await waitForText(client, 'When did you open it?');
  await scrollControlIntoView(client, 'Just opened it');
  const snapshot = await captureStep(client, evidenceDir, `${artifactPrefix}-opened-date`);
  assertInteractiveControl(snapshot, 'Just opened it');
  assert(snapshot.bodyText.includes('Not opened yet'), 'Opened-date recovery lost Not opened yet.');
}

async function exerciseQueuedRetry({
  client,
  baseUrl,
  evidenceDir,
  scenario,
  viewport,
  artifactPrefix,
  outcomeText,
}) {
  await scrollControlIntoView(client, 'Retry when online');
  await clickByText(client, 'Retry when online');
  await waitForText(
    client,
    'Retry saved on this device. We will check the RoutineKind catalog when the app is online.',
  );
  await scrollTextIntoView(
    client,
    'Retry saved on this device. We will check the RoutineKind catalog when the app is online.',
  );
  const saved = await captureStep(client, evidenceDir, `${artifactPrefix}-retry-saved`);
  assert(
    saved.bodyText.includes('Retry saved on this device.'),
    'First retry did not expose its saved state.',
  );

  await navigate(client, baseUrl, scenario.route, viewport, `${scenario.id}-repeat`, {}, {
    maxInflight: scenario.fixture === 'offline' ? 1 : 0,
  });
  await waitForText(client, outcomeText);
  await scrollControlIntoView(client, 'Retry when online');
  await clickByText(client, 'Retry when online');
  await waitForText(
    client,
    'This barcode is already saved for retry. Review its match from Shelf when it is ready.',
  );
  await scrollTextIntoView(
    client,
    'This barcode is already saved for retry. Review its match from Shelf when it is ready.',
  );
  const repeated = await captureStep(client, evidenceDir, `${artifactPrefix}-retry-already-saved`);
  assert(
    repeated.bodyText.includes('already saved for retry'),
    'Repeated retry did not expose its already-saved state.',
  );

  await scrollControlIntoView(client, 'Add it by hand', { exact: false });
  await clickByText(client, 'Add it by hand', { exact: false });
  await manualRecovery(client, evidenceDir, artifactPrefix, { barcode: FIXTURE_BARCODE });
}

async function executeScenario({
  client,
  baseUrl,
  evidenceDir,
  scenario,
  viewport,
  artifactPrefix,
}) {
  switch (scenario.id) {
    case 'search-matched': {
      await openSearchAndSubmit(client, baseUrl, viewport, scenario.id);
      await waitForText(client, 'Reviewed Barrier Serum');
      const snapshot = await captureStep(client, evidenceDir, `${artifactPrefix}-catalog-match`);
      assertInteractiveControl(snapshot, 'Use Reviewed Barrier Serum match');
      assertInteractiveControl(snapshot, 'Not this product');
      await clickByText(client, 'Use this match');
      await openedDateRecovery(client, evidenceDir, artifactPrefix);
      return;
    }
    case 'search-wrong-match-recovery': {
      await openSearchAndSubmit(client, baseUrl, viewport, scenario.id);
      await waitForText(client, 'Wrong Catalog Serum');
      const match = await captureStep(client, evidenceDir, `${artifactPrefix}-wrong-match`);
      assertInteractiveControl(match, 'Not this product');
      await clickByText(client, 'Not this product');
      await waitForText(client, 'Confirm catalog report');
      await scrollControlIntoView(client, 'Send report');
      const confirmation = await captureStep(
        client,
        evidenceDir,
        `${artifactPrefix}-wrong-match-confirmation`,
      );
      assertInteractiveControl(confirmation, 'Send report');
      assert(
        confirmation.bodyText.includes('Catalog product ID') &&
          confirmation.bodyText.includes('RoutineKind account ID') &&
          confirmation.bodyText.includes('Nothing is sent to Open Beauty Facts'),
        'Wrong-match confirmation did not disclose exact identity, account linkage, and recipient boundary.',
      );
      await clickByText(client, 'Send report');
      await waitForText(client, 'Report not sent');
      const feedback = await captureStep(
        client,
        evidenceDir,
        `${artifactPrefix}-wrong-match-feedback`,
      );
      assert(
        feedback.bodyText.includes(
          'Catalog reporting is unavailable in this build, so nothing was sent.',
        ),
        'Wrong-match feedback did not preserve the recoverable failure message.',
      );
      await clickByText(client, 'Add by hand');
      await manualRecovery(client, evidenceDir, artifactPrefix, { query: SEARCH_QUERY });
      return;
    }
    case 'search-no-match': {
      await openSearchAndSubmit(client, baseUrl, viewport, scenario.id);
      await waitForText(client, 'No catalog match yet.');
      const snapshot = await captureStep(client, evidenceDir, `${artifactPrefix}-no-match`);
      assertInteractiveControl(snapshot, 'Report missing product');
      assertInteractiveControl(snapshot, 'Add by hand');
      await clickByText(client, 'Report missing product');
      await waitForText(client, 'Confirm catalog report');
      await waitForInputValue(client, 'Product name for report', SEARCH_QUERY);
      await fillByLabel(client, 'Product name for report', 'Confirmed missing product');
      await scrollControlIntoView(client, 'Send report');
      const confirmation = await captureStep(
        client,
        evidenceDir,
        `${artifactPrefix}-report-confirmation`,
      );
      assert(
        inputValue(confirmation, 'Product name for report') === 'Confirmed missing product',
        'Missing-product report did not preserve the explicitly confirmed structured name.',
      );
      assertInteractiveControl(confirmation, 'Send report');
      assert(
        confirmation.bodyText.includes(
          "RoutineKind's catalog-review team and authorized operators",
        ) &&
          confirmation.bodyText.includes('included in your RoutineKind data export') &&
          confirmation.bodyText.includes('Nothing is sent to Open Beauty Facts'),
        'Missing-product confirmation did not disclose recipients and data-rights treatment.',
      );
      await clickByText(client, 'Send report');
      await waitForText(client, 'Report not sent');
      await captureStep(client, evidenceDir, `${artifactPrefix}-report-feedback`);
      await clickByText(client, 'Add by hand');
      await manualRecovery(client, evidenceDir, artifactPrefix, { query: SEARCH_QUERY });
      return;
    }
    case 'search-offline': {
      await openSearchAndSubmit(client, baseUrl, viewport, scenario.id, {
        maxInflight: scenario.fixture === 'offline' ? 1 : 0,
      });
      await waitForText(client, "Couldn't reach the product catalog.");
      const snapshot = await captureStep(client, evidenceDir, `${artifactPrefix}-offline`);
      assertInteractiveControl(snapshot, 'Add by hand');
      assert(
        !snapshot.bodyText.includes('Report missing product'),
        'Offline was mislabeled as no-match.',
      );
      await clickByText(client, 'Add by hand');
      await manualRecovery(client, evidenceDir, artifactPrefix, { query: SEARCH_QUERY });
      return;
    }
    case 'scan-matched': {
      await navigate(client, baseUrl, scenario.route, viewport, scenario.id, {}, {
        maxInflight: scenario.fixture === 'offline' ? 1 : 0,
      });
      await waitForText(client, 'Mineral SPF 50');
      const snapshot = await captureStep(client, evidenceDir, `${artifactPrefix}-catalog-match`);
      assertInteractiveControl(snapshot, 'Add this');
      assertInteractiveControl(snapshot, 'Not this product');
      await clickByText(client, 'Add this');
      await openedDateRecovery(client, evidenceDir, artifactPrefix);
      return;
    }
    case 'scan-wrong-match-recovery': {
      await navigate(client, baseUrl, scenario.route, viewport, scenario.id, {}, {
        maxInflight: scenario.fixture === 'offline' ? 1 : 0,
      });
      await waitForText(client, 'Mineral SPF 50');
      await clickByText(client, 'Not this product');
      await waitForPath(client, '/shelf/no-match');
      await waitForText(client, 'Not the right product.');
      await scrollControlIntoView(client, 'Report wrong match');
      const recovery = await captureStep(client, evidenceDir, `${artifactPrefix}-recovery-sheet`);
      assertInteractiveControl(recovery, 'Report wrong match');
      assert(
        recovery.bodyText.includes('Add it by hand'),
        'Scan wrong-match route lost its manual recovery action.',
      );
      await clickByText(client, 'Report wrong match');
      await waitForText(client, 'Confirm catalog report');
      await scrollControlIntoView(client, 'Send report');
      const confirmation = await captureStep(
        client,
        evidenceDir,
        `${artifactPrefix}-report-confirmation`,
      );
      assertInteractiveControl(confirmation, 'Send report');
      assert(
        confirmation.bodyText.includes('Barcode') &&
          confirmation.bodyText.includes('Catalog product ID') &&
          confirmation.bodyText.includes('Nothing is sent to Open Beauty Facts'),
        'Scan wrong-match confirmation did not disclose the exact recovery identity and recipient boundary.',
      );
      await clickByText(client, 'Send report');
      await waitForText(client, 'Report not sent');
      const feedback = await captureStep(client, evidenceDir, `${artifactPrefix}-report-feedback`);
      assert(
        feedback.bodyText.includes(
          'Catalog reporting is unavailable in this build, so nothing was sent.',
        ),
        'Scan wrong-match recovery did not render inline report feedback.',
      );
      await scrollControlIntoView(client, 'Add it by hand', { exact: false });
      await clickByText(client, 'Add it by hand', { exact: false });
      await manualRecovery(client, evidenceDir, artifactPrefix, { barcode: FIXTURE_BARCODE });
      return;
    }
    case 'scan-no-match': {
      await navigate(client, baseUrl, scenario.route, viewport, scenario.id);
      await waitForText(client, `Barcode ${FIXTURE_BARCODE} is not in the catalog yet.`);
      await scrollControlIntoView(client, 'Product not found');
      const snapshot = await captureStep(client, evidenceDir, `${artifactPrefix}-no-match`);
      assertInteractiveControl(snapshot, 'Product not found');
      await clickByText(client, 'Product not found');
      await waitForPath(client, '/shelf/no-match');
      await waitForText(client, 'Report missing product');
      const recovery = await captureStep(client, evidenceDir, `${artifactPrefix}-recovery-sheet`);
      assertInteractiveControl(recovery, 'Search catalog');
      assertInteractiveControl(recovery, 'Add it by hand');
      await clickByText(client, 'Add it by hand', { exact: false });
      await manualRecovery(client, evidenceDir, artifactPrefix, { barcode: FIXTURE_BARCODE });
      return;
    }
    case 'scan-offline':
    case 'scan-error': {
      await navigate(client, baseUrl, scenario.route, viewport, scenario.id, {}, {
        maxInflight: scenario.fixture === 'offline' ? 1 : 0,
      });
      const outcomeText =
        scenario.id === 'scan-offline' ? "Couldn't reach the product catalog" : 'Lookup failed.';
      await waitForText(client, outcomeText);
      await scrollControlIntoView(client, 'Retry when online');
      const snapshot = await captureStep(
        client,
        evidenceDir,
        `${artifactPrefix}-${scenario.id === 'scan-offline' ? 'offline' : 'error'}`,
      );
      assertInteractiveControl(snapshot, 'Retry barcode');
      await exerciseQueuedRetry({
        client,
        baseUrl,
        evidenceDir,
        scenario,
        viewport,
        artifactPrefix,
        outcomeText,
      });
      return;
    }
    case 'scan-camera-denied-settings-failure': {
      await navigate(client, baseUrl, scenario.route, viewport, scenario.id);
      await waitForText(client, 'Camera permission is needed for barcode scanning.');
      const snapshot = await captureStep(client, evidenceDir, `${artifactPrefix}-denied`);
      assertInteractiveControl(snapshot, 'Open settings');
      assert(
        !snapshot.bodyText.includes('Allow camera'),
        'Scan rendered a custom Allow camera action.',
      );
      await clickByText(client, 'Open settings');
      await waitForText(client, 'Camera settings unavailable');
      await captureStep(client, evidenceDir, `${artifactPrefix}-settings-failure`);
      return;
    }
    case 'ocr-camera-denied-settings-failure': {
      await navigate(client, baseUrl, scenario.route, viewport, scenario.id);
      await waitForText(client, 'Open settings');
      const snapshot = await captureStep(client, evidenceDir, `${artifactPrefix}-denied`);
      assertInteractiveControl(snapshot, 'Open settings');
      await clickByText(client, 'Open settings');
      await waitForText(client, 'Camera settings unavailable');
      await captureStep(client, evidenceDir, `${artifactPrefix}-settings-failure`);
      return;
    }
    case 'ocr-capture-failure': {
      await navigate(client, baseUrl, scenario.route, viewport, scenario.id);
      await waitForText(client, 'Capture label');
      await clickByText(client, 'Capture label');
      await waitForText(client, "Label wasn't captured");
      await scrollControlIntoView(client, 'Try label photo again');
      const snapshot = await captureStep(client, evidenceDir, `${artifactPrefix}-capture-failure`);
      assertInteractiveControl(snapshot, 'Try label photo again');
      assert(
        snapshot.inputs.some(({ label }) => label === 'Ingredient label text'),
        'OCR capture recovery lost its manual-text input.',
      );
      return;
    }
    case 'no-match-missing-barcode': {
      await navigate(client, baseUrl, scenario.route, viewport, scenario.id);
      await waitForText(client, 'Add it by hand');
      await scrollControlIntoView(client, 'Add it by hand', { exact: false });
      const snapshot = await captureStep(client, evidenceDir, `${artifactPrefix}-report-hidden`);
      assertInteractiveControl(snapshot, 'Add it by hand');
      assert(
        !snapshot.bodyText.includes('Report missing product') &&
          !snapshot.bodyText.includes('Report wrong match'),
        'No-match route exposed a report action without a barcode report contract.',
      );
      return;
    }
    case 'catalog-recovery-malformed': {
      await navigate(client, baseUrl, scenario.route, viewport, scenario.id, {
        barcode: 'not-a-barcode',
        productId: 'not-a-product-id',
      });
      await waitForText(client, 'Match unavailable');
      await waitForText(client, 'Your Shelf is unchanged.');
      await scrollControlIntoView(client, 'Back to Shelf');
      const snapshot = await captureStep(client, evidenceDir, `${artifactPrefix}-unavailable`);
      assertInteractiveControl(snapshot, 'Back to Shelf');
      assert(
        snapshot.bodyText.includes('may have expired or already been reviewed'),
        'Malformed recovery route did not explain its fail-closed state.',
      );
      return;
    }
    case 'manual-barcode-validation': {
      const productName = `Formatted barcode ${viewport.id}`;
      const formattedBarcode = '0 36000-29145 2';
      await navigate(client, baseUrl, scenario.route, viewport, scenario.id);
      await waitForText(client, 'Add by hand');
      await fillByLabel(client, 'Product name', productName);

      await fillByLabel(client, 'Barcode, optional', 'lot 036000291452');
      await waitForInputValue(client, 'Barcode, optional', 'lot 036000291452');
      await waitForText(
        client,
        'Enter a complete 8, 12, 13, or 14 digit barcode from the package.',
      );
      await scrollControlIntoView(client, 'Continue');
      const alphabetic = await captureStep(
        client,
        evidenceDir,
        `${artifactPrefix}-alphabetic-blocked`,
      );
      assertDisabledControl(alphabetic, 'Continue');

      await fillByLabel(client, 'Barcode, optional', '036000/291452');
      await waitForInputValue(client, 'Barcode, optional', '036000/291452');
      await waitForText(
        client,
        'Enter a complete 8, 12, 13, or 14 digit barcode from the package.',
      );
      await scrollControlIntoView(client, 'Continue');
      const punctuation = await captureStep(
        client,
        evidenceDir,
        `${artifactPrefix}-punctuation-blocked`,
      );
      assertDisabledControl(punctuation, 'Continue');

      await fillByLabel(client, 'Barcode, optional', '042526');
      await waitForInputValue(client, 'Barcode, optional', '042526');
      await waitForText(
        client,
        'Enter a complete 8, 12, 13, or 14 digit barcode from the package.',
      );
      await scrollControlIntoView(client, 'Continue');
      const incompleteUpcE = await captureStep(
        client,
        evidenceDir,
        `${artifactPrefix}-incomplete-upce-blocked`,
      );
      assertDisabledControl(incompleteUpcE, 'Continue');

      await fillByLabel(client, 'Barcode, optional', '036000291453');
      await waitForInputValue(client, 'Barcode, optional', '036000291453');
      await waitForText(client, 'Check the numbers. This barcode checksum does not match.');
      await scrollControlIntoView(client, 'Continue');
      const checksum = await captureStep(client, evidenceDir, `${artifactPrefix}-checksum-blocked`);
      assertDisabledControl(checksum, 'Continue');

      await fillByLabel(client, 'Barcode, optional', formattedBarcode);
      await waitForInputValue(client, 'Barcode, optional', formattedBarcode);
      await waitForCondition(
        client,
        enabledControlExpression('Continue'),
        10_000,
        'enabled Continue for normalized barcode',
      );
      await scrollControlIntoView(client, 'Continue');
      const valid = await captureStep(client, evidenceDir, `${artifactPrefix}-formatted-valid`);
      assertInteractiveControl(valid, 'Continue');
      assert(
        !valid.alerts.some((alert) => alert.includes('barcode')),
        'Valid formatted barcode retained a validation alert.',
      );
      await clickByText(client, 'Continue');

      await waitForPath(client, '/shelf/opened');
      await waitForText(client, 'When did you open it?');
      await scrollControlIntoView(client, 'Just opened it');
      await clickByText(client, 'Just opened it');
      await waitForText(client, 'PAO not set');
      await scrollControlIntoView(client, 'Edit period after opening');
      await clickByText(client, 'Edit period after opening');
      await waitForText(client, 'Choose the months printed beside the open-jar symbol.');
      await scrollControlIntoView(client, '12 mo');
      await clickByText(client, '12 mo');
      await waitForText(client, 'PAO: 12 months after opening');
      await waitForCondition(
        client,
        enabledControlExpression('Add to shelf'),
        10_000,
        'enabled Add to shelf after explicit opening state and label PAO',
      );
      await clickByText(client, 'Add to shelf');
      await waitForCondition(
        client,
        `window.location.pathname === '/shelf'`,
        30_000,
        'Shelf after normalized manual save',
      );
      await waitForText(client, productName);
      await clickByText(client, productName, { exact: false });
      await waitForCondition(
        client,
        `window.location.pathname.startsWith('/shelf/') && window.location.pathname !== '/shelf/opened'`,
        30_000,
        'saved manual product detail',
      );
      await waitForText(client, 'barcode 036000291452');
      await scrollTextIntoView(client, 'barcode 036000291452');
      const detail = await captureStep(client, evidenceDir, `${artifactPrefix}-normalized-detail`);
      assert(
        detail.bodyText.includes('barcode 036000291452'),
        'Formatted barcode was not normalized before the shelf write.',
      );
      return;
    }
    default:
      throw new Error(`No CAT04 scenario executor for ${scenario.id}.`);
  }
}

async function captureFailure(client, evidenceDir, artifactPrefix) {
  if (!client) return [];
  const files = [];
  try {
    const snapshot = await evaluate(client, auditExpression());
    const name = `${artifactPrefix}-failure`;
    writeJson(evidenceDir, `${name}.json`, snapshot);
    const result = await client.send('Page.captureScreenshot', {
      captureBeyondViewport: false,
      format: 'png',
    });
    writeFileSync(path.join(evidenceDir, `${name}.png`), result.data, 'base64');
    files.push(`${name}.json`, `${name}.png`);
  } catch {
    // The primary scenario error is retained; best-effort failure capture must not replace it.
  }
  return files;
}

async function runScenario(context) {
  const { client, baseUrl, evidenceDir, scenario, viewport } = context;
  const artifactPrefix = safeArtifactId(`${scenario.id}-${viewport.id}`);
  const startedAt = new Date().toISOString();
  const eventStart = client.events.length;
  const result = {
    artifactPrefix,
    completedAt: null,
    error: null,
    fixture: scenario.fixture,
    fixtureGroup: scenario.groupId,
    nativeDeviceProof: false,
    route: scenario.route,
    scenarioId: scenario.id,
    startedAt,
    surface: 'expo-web',
    verdict: 'fail',
    viewport,
  };

  try {
    await withAuditTimeout(
      executeScenario({ ...context, artifactPrefix }),
      120_000,
      `CAT04 scenario ${scenario.id} at ${viewport.width}x${viewport.height}`,
    );
    await waitForNetworkIdle(client, networkIdleTimeoutForFixtureGroup(scenario.groupId), {
      maxInflight: scenario.fixture === 'offline' ? 1 : 0,
    });
    const failures = classifyBrowserFailures(client.events.slice(eventStart), [baseUrl]);
    result.browserFailures = failures;
    assert(failures.length === 0, `${scenario.id} emitted ${failures.length} browser failure(s).`);
    result.endUrl = await evaluate(client, 'location.href');
    result.verdict = 'pass';
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    result.timedOut = error?.code === 'CAT04_OPERATION_TIMEOUT';
    result.browserFailures = classifyBrowserFailures(client.events.slice(eventStart), [baseUrl]);
    result.failureArtifacts = await captureFailure(client, evidenceDir, artifactPrefix);
  } finally {
    result.completedAt = new Date().toISOString();
    writeJson(evidenceDir, `${artifactPrefix}-result.json`, result);
  }

  return result;
}

function clearPreviousEvidence(evidenceDir) {
  mkdirSync(evidenceDir, { recursive: true });
  for (const entry of readdirSync(evidenceDir, { withFileTypes: true })) {
    if (!entry.isFile() || !/\.(?:json|log|md|png)$/i.test(entry.name)) continue;
    rmSync(path.join(evidenceDir, entry.name), { force: true });
  }
}

function writeReport(evidenceDir, summary) {
  const bootstrapRows = summary.bootstrapResults.map(
    (result) =>
      `| ${result.fixtureGroup} | ${result.viewport.width}x${result.viewport.height} | ${result.verdict} | ${result.error ?? ''} |`,
  );
  const rows = summary.scenarios.map(
    (scenario) =>
      `| ${scenario.scenarioId} | ${scenario.viewport.width}x${scenario.viewport.height} | ${scenario.verdict} | ${scenario.error ?? ''} |`,
  );
  const lines = [
    '# CAT04 Catalog Recovery Expo-Web Audit',
    '',
    `- Verdict: ${summary.verdict}`,
    '- Surface: Expo web deterministic development fixtures',
    '- Native-device proof: No',
    `- Source Git SHA: ${summary.sourceGitSha}`,
    ...summary.limitations.map((limitation) => `- Limitation: ${limitation}`),
    '',
    '## Explicit-consent bootstrap',
    '',
    '| Fixture group | Viewport | Verdict | Error |',
    '| --- | --- | --- | --- |',
    ...bootstrapRows,
    '',
    '## Recovery scenarios',
    '',
    '| Scenario | Viewport | Verdict | Error |',
    '| --- | --- | --- | --- |',
    ...rows,
    '',
    `Machine-readable result: \`summary.json\``,
    '',
  ];
  writeFileSync(path.join(evidenceDir, 'report.md'), `${lines.join('\n')}\n`);
}

function recordFixtureGroupFailure(summary, group, message) {
  const timestamp = new Date().toISOString();
  for (const viewport of CAT04_REQUIRED_VIEWPORTS) {
    if (
      !summary.bootstrapResults.some(
        (result) => result.fixtureGroup === group.id && result.viewport.id === viewport.id,
      )
    ) {
      summary.bootstrapResults.push({
        completedAt: timestamp,
        error: `Fixture group ${group.id} did not complete consent bootstrap: ${message}`,
        fixtureGroup: group.id,
        nativeDeviceProof: false,
        startedAt: timestamp,
        surface: 'expo-web',
        verdict: 'fail',
        viewport,
      });
    }
  }
  const groupScenarios = CAT04_SCENARIO_MATRIX.filter(({ groupId }) => groupId === group.id);
  for (const viewport of CAT04_REQUIRED_VIEWPORTS) {
    for (const scenario of groupScenarios) {
      if (
        summary.scenarios.some(
          (result) => result.scenarioId === scenario.id && result.viewport.id === viewport.id,
        )
      ) {
        continue;
      }
      summary.scenarios.push({
        completedAt: timestamp,
        error: `Fixture group ${group.id} could not run this scenario: ${message}`,
        fixture: scenario.fixture,
        fixtureGroup: group.id,
        nativeDeviceProof: false,
        route: scenario.route,
        scenarioId: scenario.id,
        startedAt: timestamp,
        surface: 'expo-web',
        verdict: 'fail',
        viewport,
      });
    }
  }
}

export async function runCat04CatalogRecoveryAudit({
  evidenceDir: evidenceDirOverride,
  requestedAppPort = Number(process.env.CAT04_RECOVERY_E2E_PORT ?? 8460),
  requestedDebugPort = Number(process.env.CAT04_RECOVERY_E2E_DEBUG_PORT ?? 9560),
} = {}) {
  const configuration = validateCat04AuditConfiguration();
  const today = new Date().toISOString().slice(0, 10);
  const evidenceDir =
    evidenceDirOverride ??
    process.env.CAT04_RECOVERY_E2E_EVIDENCE_DIR ??
    path.join(repoRoot, 'test-results', 'human-e2e', today, 'cat04-catalog-recovery-current');
  assertCat04SourceProvenance();
  clearPreviousEvidence(evidenceDir);
  const summary = {
    completedAt: null,
    expectedBootstrapCount: CAT04_FIXTURE_GROUPS.length * CAT04_REQUIRED_VIEWPORTS.length,
    expectedExecutionCount: configuration.executionCount,
    fixtureGroups: CAT04_FIXTURE_GROUPS.map(({ id }) => id),
    limitations: CAT04_AUDIT_LIMITATIONS,
    nativeDeviceProof: false,
    requiredViewports: CAT04_REQUIRED_VIEWPORTS,
    scenarioDefinitions: CAT04_SCENARIO_MATRIX,
    bootstrapResults: [],
    scenarios: [],
    schemaVersion: 1,
    sourceGitSha: readSourceGitSha(),
    startedAt: new Date().toISOString(),
    surface: 'expo-web',
    verdict: 'fail',
  };
  let browserPath = null;
  try {
    browserPath = findBrowserPath();
  } catch (error) {
    summary.fatalError = error instanceof Error ? error.message : String(error);
    for (const group of CAT04_FIXTURE_GROUPS) {
      recordFixtureGroupFailure(summary, group, summary.fatalError);
    }
  }

  for (
    let groupIndex = 0;
    browserPath && groupIndex < CAT04_FIXTURE_GROUPS.length;
    groupIndex += 1
  ) {
    const group = CAT04_FIXTURE_GROUPS[groupIndex];
    const groupScenarios = CAT04_SCENARIO_MATRIX.filter(({ groupId }) => groupId === group.id);
    let userDataDir = null;
    let server = null;
    let browser = null;
    let client = null;

    try {
      const appPort = await findAvailablePort(requestedAppPort + groupIndex * 20);
      const debugPort = await findAvailablePort(requestedDebugPort + groupIndex * 20);
      const baseUrl = `http://localhost:${appPort}`;
      userDataDir = mkdtempSync(path.join(tmpdir(), `cat04-${safeArtifactId(group.id)}-`));
      server = startExpoServer({ appPort, evidenceDir, group });
      await waitForUrl(baseUrl);
      browser = startBrowser({ browserPath, debugPort, userDataDir });
      client = await connectToPage(debugPort);
      await client.send('Page.enable');
      await client.send('Runtime.enable');
      await client.send('Log.enable');
      await client.send('Network.enable');
      await client.send('Page.setLifecycleEventsEnabled', { enabled: true });
      await client.send('Page.bringToFront');

      for (const viewport of CAT04_REQUIRED_VIEWPORTS) {
        const bootstrap = await establishLocalHealthConsent({
          client,
          baseUrl,
          evidenceDir,
          groupId: group.id,
          viewport,
        });
        summary.bootstrapResults.push(bootstrap);
        assert(
          bootstrap.verdict === 'pass',
          bootstrap.error ?? `Consent bootstrap failed for ${group.id} at ${viewport.id}.`,
        );

        for (const scenario of groupScenarios) {
          const scenarioResult = await runScenario({
            client,
            baseUrl,
            evidenceDir,
            scenario,
            viewport,
          });
          summary.scenarios.push(scenarioResult);
          assert(
            scenarioResult.timedOut !== true,
            `Stopping fixture group ${group.id} after ${scenario.id} timed out.`,
          );
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      recordFixtureGroupFailure(summary, group, message);
    } finally {
      if (client) {
        writeJson(evidenceDir, `browser-events-${safeArtifactId(group.id)}.json`, client.events);
        client.close();
      }
      await stopProcessBestEffort(browser);
      await stopProcessBestEffort(server);
      if (userDataDir) {
        try {
          rmSync(userDataDir, { force: true, recursive: true });
        } catch (error) {
          writeJson(evidenceDir, `cleanup-warning-${safeArtifactId(group.id)}.json`, {
            message: error instanceof Error ? error.message : String(error),
            userDataDir,
          });
        }
      }
    }
  }

  summary.completedAt = new Date().toISOString();
  summary.verdict =
    summary.bootstrapResults.length === summary.expectedBootstrapCount &&
    summary.bootstrapResults.every(({ verdict }) => verdict === 'pass') &&
    summary.scenarios.length === summary.expectedExecutionCount &&
    summary.scenarios.every(({ verdict }) => verdict === 'pass')
      ? 'pass'
      : 'fail';
  writeReport(evidenceDir, summary);
  summary.artifacts = listEvidenceArtifacts(evidenceDir);
  summary.screenshots = summary.artifacts.filter((name) => name.endsWith('.png'));
  writeJson(evidenceDir, 'summary.json', summary);
  if (summary.verdict !== 'pass') process.exitCode = 1;
  return summary;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(scriptPath)) {
  await runCat04CatalogRecoveryAudit();
}
