import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const repoRoot = 'C:/Users/jasim/Desktop/onSkin/.claude/worktrees/m1-retained-safety/';
const isWindows = process.platform === 'win32';
const today = new Date().toISOString().slice(0, 10);
const accountCheckpointMode = process.argv.includes('--account-upgrade-checkpoint');
const accountUpgradeMode =
  accountCheckpointMode ||
  process.argv.includes('--account-upgrade') ||
  process.env.ONBOARDING_E2E_ACCOUNT_UPGRADE?.trim().toLowerCase() === 'email_same_user';
const accountIsolationMode =
  process.argv.includes('--account-isolation') ||
  process.env.ONBOARDING_E2E_ACCOUNT_ISOLATION?.trim().toLowerCase() === 'signout_clear_retry';
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

mkdirSync(evidenceDir, { recursive: true });

function assert(condition, message) {
  if (!condition) throw new Error(message);
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
      ...(accountIsolationMode ? { EXPO_PUBLIC_E2E_ACCOUNT_ISOLATION: 'signout_clear_retry' } : {}),
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

function disallowedLog(log) {
  const serialized = JSON.stringify(log);
  return !(
    serialized.includes('EXPO_PUBLIC_SUPABASE') ||
    serialized.includes('Notifications') ||
    serialized.includes('expo-notifications') ||
    serialized.includes('placeholder') ||
    serialized.includes('403') ||
    serialized.includes('supabase.co') ||
    serialized.includes('shadow') ||
    serialized.includes('props.pointerEvents is deprecated')
  );
}

async function answerQuiz(client) {
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
    if (index === 0) await captureStep(client, '07-quiz-01');
    await clickByText(client, answer);
    if (index === 3) await captureStep(client, '08-quiz-after-04');
    if (index === 8) {
      await scrollTextIntoView(client, 'Does not burn');
      await captureStep(client, '08-quiz-after-09');
    }
    if (index === 10) await captureStep(client, '08-quiz-after-11');
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
    await client.send('Emulation.setDeviceMetricsOverride', {
      deviceScaleFactor: 2,
      height: viewport.height,
      mobile: true,
      scale: 1,
      screenOrientation: { angle: 0, type: 'portraitPrimary' },
      width: viewport.width,
    });
    await client.send('Emulation.setTouchEmulationEnabled', { enabled: true });

    await client.send('Page.navigate', { url: `${baseUrl}/?e2eReset=local` });
    await waitForText(client, 'First, your', 60_000);
    const welcome = await captureStep(client, '01-fixture-starts-at-age');
    const directProtectedAgeGate = welcome;
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

    await waitForPath(client, '/onboarding/account');
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

    await navigateClientSide(client, '/you');
    await waitForText(client, 'tas.account-a.e2e@example.com');
    await scrollTextIntoView(client, 'Sign out');
    await captureStep(client, '25-account-before-signout', { assertClean: false });
    await clickByText(client, 'Sign out');
    await waitForCondition(client, `document.body.innerText.includes('Account change paused') || document.body.innerText.includes('Account access paused')`, 30_000, 'closed account failure');
    const failure = await captureStep(client, '26-account-clear-failure', { assertClean: false });
    for (const p of productNames) assert(!failure.bodyText.includes(p.name), 'Old owner content exposed.');
    await clickByText(client, 'Try again');
    await waitForText(client, 'Securing account data...', 10_000);
    await captureStep(client, '27-account-clear-retry', { assertClean: false });
    await waitForText(client, 'Begin', 30_000);
    await captureStep(client, '28-signed-out-welcome');
    for (const target of ['/shelf', '/today?routine=AM']) {
      await navigateClientSide(client, target); await waitForPath(client, '/onboarding/age');
      await waitForText(client, 'First, your');
      const blocked = await captureStep(client, target.startsWith('/shelf') ? '29-shelf-age-blocked' : '30-today-age-blocked');
      for (const p of productNames) assert(!blocked.bodyText.includes(p.name), 'Signed-out direct entry exposed old owner data.');
    }
    writeJson('summary.json', { status: 'PASS', viewport, scenario: 'Existing signed-in owner: actual age/consent/onboarding, first cleanup failure, retry and signed-out direct-entry age barriers.', limits: 'Local development Auth/cleanup fixture only. Billing stays unverified. No Pro/photo admission, live auth/provider or device proof.' });
    console.log('Signed-in owner isolation and cleanup-retry fixture UI passed.');
  } catch (error) {
    // Capture the actual failed surface before closing Chrome/Metro. Synthetic
    // fixture only: never inspect storage, keys, cookies or network bodies.
    if (client) {
      await captureStep(client, 'FAILURE', { assertClean: false }).catch(() => undefined);
    }
    writeJson('ERROR.json', { status: 'FAIL', message: String(error.message), viewport });
    throw error;
  } finally {
    client?.close();
    await stopProcess(browser);
    await stopProcess(server);
    await removeBrowserProfile(userDataDir);
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
