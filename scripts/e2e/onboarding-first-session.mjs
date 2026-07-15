import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const isWindows = process.platform === 'win32';
const today = new Date().toISOString().slice(0, 10);
const accountUpgradeMode =
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
      ? 'onboarding-account-upgrade-current'
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
      ...(accountUpgradeMode ? { EXPO_PUBLIC_E2E_ACCOUNT_UPGRADE: 'email_same_user' } : {}),
      ...(accountIsolationMode ? { EXPO_PUBLIC_E2E_ACCOUNT_ISOLATION: 'signout_clear_retry' } : {}),
      EXPO_PUBLIC_E2E_COMPLETION_COMMIT_DELAY_MS: '1200',
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
    const nodes = Array.from(document.querySelectorAll('button,[role="button"],[role="checkbox"],[role="radio"],a,label'));
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

async function clickableRectByText(client, label, { exact = true, timeoutMs = 30_000 } = {}) {
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
  return rect;
}

async function dispatchTouch(client, rect, id = 1) {
  await client.send('Input.dispatchTouchEvent', {
    touchPoints: [{ force: 1, id, radiusX: 2, radiusY: 2, x: rect.x, y: rect.y }],
    type: 'touchStart',
  });
  await client.send('Input.dispatchTouchEvent', {
    touchPoints: [],
    type: 'touchEnd',
  });
}

async function clickByText(client, label, options = {}) {
  const rect = await clickableRectByText(client, label, options);

  await dispatchTouch(client, rect);
  await delay(250);
  return rect;
}

async function rapidDoubleTouchByText(client, label, options = {}) {
  const rect = await clickableRectByText(client, label, options);
  await dispatchTouch(client, rect, 1);
  await dispatchTouch(client, rect, 2);
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
    const nodes = Array.from(document.querySelectorAll('button,[role="button"],[role="checkbox"],[role="radio"],a,label'));
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
    const nodes = Array.from(document.querySelectorAll('button,[role="button"],[role="checkbox"],[role="radio"],a,input,textarea,select'));
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
      const navigate = globalThis.__ROUTINEKIND_E2E_NAVIGATE__;
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

function assertDisabledControl(snapshot, label) {
  const control = snapshot.controls.find((item) => item.label.includes(label));
  assert(control, `${snapshot.url} did not expose a control labeled ${label}.`);
  assert(control.disabled === true, `${label} was not disabled while its write was pending.`);
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
  await clickByText(client, 'Choose product category', { exact: false });
  await waitForText(client, 'Product category');
  await clickByText(client, product.category);
  await clickByText(client, 'Add to shelf');
  await waitForText(client, 'When did you open it?');
  await clickByText(client, 'Just opened it');
  await scrollTextIntoView(client, 'Add to shelf');
  await clickByText(client, 'Add to shelf');
  await waitForText(client, product.name);
  return await captureStep(client, evidenceName);
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
      : `Happy path / ${isLaunchFloorViewport ? 'launch-floor phone viewport' : 'stress viewport'}`;
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
      ? 'npm run e2e:onboarding-account-upgrade'
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
  const userDataDir = path.join(tmpdir(), `routinekind-onboarding-e2e-${Date.now()}`);
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
    await waitForText(client, 'Begin', 60_000);
    const welcome = await captureStep(client, '01-welcome');

    await clickByText(client, 'Begin');
    await waitForText(client, 'First, your', 30_000);
    await captureStep(client, '02-age-empty');
    await fillByLabel(client, 'Day of birth', '01');
    await fillByLabel(client, 'Month of birth', '01');
    await fillByLabel(client, 'Year of birth', '1990');
    await captureStep(client, '03-age-filled');
    await clickByText(client, 'Continue');

    await waitForText(client, 'What brings you here?');
    await captureStep(client, '04-goals');
    await clickByText(client, 'Clear skin', { exact: false });
    await clickByText(client, 'Barrier repair', { exact: false });
    await captureStep(client, '05-goals-selected');
    await clickByText(client, 'Continue');

    await waitForText(client, 'Before the quiz');
    await captureStep(client, '06-consent');
    await clickByText(client, 'I agree. Continue');
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
    await waitForText(client, 'FIRST INSIGHT');
    await waitForText(client, 'Timing handled');
    const reveal = await captureStep(client, '14-reveal-checks');
    await screenshot(client, '14-reveal-insight');
    assert(reveal.bodyText.includes('FIRST INSIGHT'), 'Reveal did not show FIRST INSIGHT.');
    assert(reveal.bodyText.includes('Timing handled'), 'Reveal did not show Timing handled.');
    assert(
      reveal.bodyText.includes(
        'Products that need different timing are separated before the first check-off.',
      ),
      'Reveal did not show the shelf-derived timing insight body.',
    );
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
    await waitForText(client, 'Subscribe to Pro');
    await waitForText(client, 'Explore first', 30_000);
    const paywall = await captureStep(client, '17-paywall-current');
    await screenshot(client, '17-paywall');
    writeJson('17-paywall.json', paywall);
    assert(paywall.bodyText.includes('Explore first'), 'Paywall did not expose Explore first.');
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

    await scrollTextIntoView(client, 'Explore first', { exact: false });
    const paywallExplore = await captureStep(client, '18-paywall-explore-visible');
    await clickByText(client, 'Explore first', { exact: false });
    await waitForPath(client, '/routine/plan', 30_000);
    await waitForText(client, 'Your routine, in order.', 30_000);
    await waitForText(client, 'Start today', 30_000);
    const routinePlan = await captureStep(client, '19-routine-plan-current');
    assert(
      routinePlan.bodyText.includes('FIRST INSIGHT'),
      'Routine plan did not show FIRST INSIGHT.',
    );
    assert(
      routinePlan.bodyText.includes('Timing handled'),
      'Routine plan did not show Timing handled.',
    );
    assert(
      routinePlan.bodyText.includes('Mineral SPF 50'),
      'Routine plan did not show the SPF morning step.',
    );
    assert(
      routinePlan.bodyText.includes('Glycolic 7%'),
      'Routine plan did not show the glycolic night step.',
    );
    assert(
      routinePlan.bodyText.includes('Retinol 0.3%'),
      'Routine plan did not show the retinol night step.',
    );

    await clickByText(client, 'Start today');
    await waitForPath(client, '/today', 30_000);
    const todayAfterStart = await captureStep(client, '20-today-after-start-current', {
      assertClean: false,
    });

    await client.send('Page.navigate', { url: `${baseUrl}/today?routine=AM` });
    await waitForPath(client, '/today', 30_000);
    await waitForText(client, 'Morning routine', 30_000);
    await waitForText(client, 'Mineral SPF 50', 30_000);
    await scrollTextIntoView(client, 'Mineral SPF 50', { exact: false });
    const todayAmBefore = await captureStep(client, '21-today-am-before-checkoff');
    assertInteractiveControl(todayAmBefore, 'Mineral SPF 50');
    assert(todayAmBefore.bodyText.includes('0 of 1'), 'AM routine did not start at 0 of 1.');
    await rapidDoubleTouchByText(client, 'Mineral SPF 50', { exact: false });
    await waitForText(client, 'SAVING', 10_000);
    const todayAmSaving = await captureStep(client, '21a-today-am-saving');
    assertDisabledControl(todayAmSaving, 'Mineral SPF 50');
    await waitForText(client, '1 of 1', 30_000);
    const todayAmAfter = await captureStep(client, '22-today-am-after-checkoff');
    assertInteractiveControl(todayAmAfter, 'Mineral SPF 50');
    assert(todayAmAfter.bodyText.includes('1 of 1'), 'AM check-off did not reach 1 of 1.');
    await clickByText(client, 'Mineral SPF 50', { exact: false });
    const todayAmAfterRepeat = await captureStep(client, '22a-today-am-after-repeat-checkoff');
    assert(
      todayAmAfterRepeat.bodyText.includes('1 of 1'),
      'A repeated AM check-off removed the append-only completion.',
    );
    await client.send('Page.reload', { ignoreCache: false });
    await waitForPath(client, '/today', 30_000);
    await waitForText(client, 'Morning routine', 30_000);
    await waitForText(client, '1 of 1', 30_000);
    await scrollTextIntoView(client, 'Mineral SPF 50', { exact: false });
    const todayAmAfterReload = await captureStep(client, '22b-today-am-after-reload');
    assertInteractiveControl(todayAmAfterReload, 'Mineral SPF 50');
    assert(
      todayAmAfterReload.bodyText.includes('1 of 1'),
      'AM completion did not persist after a page reload.',
    );

    await client.send('Page.navigate', { url: `${baseUrl}/today?routine=PM` });
    await waitForPath(client, '/today', 30_000);
    await waitForText(client, 'Evening routine', 30_000);
    await waitForText(client, 'Glycolic 7%', 30_000);
    await scrollTextIntoView(client, 'Glycolic 7%', { exact: false });
    const todayPmBefore = await captureStep(client, '23-today-pm-before-checkoff', {
      assertClean: false,
    });
    assertInteractiveControl(todayPmBefore, 'Glycolic 7%');
    assert(todayPmBefore.bodyText.includes('0 of 1'), 'PM routine did not start at 0 of 1.');
    await rapidDoubleTouchByText(client, 'Glycolic 7%', { exact: false });
    await waitForText(client, '1 of 1', 30_000);
    const todayPmAfter = await captureStep(client, '24-today-pm-after-checkoff', {
      assertClean: false,
    });
    assertInteractiveControl(todayPmAfter, 'Glycolic 7%');
    assert(todayPmAfter.bodyText.includes('1 of 1'), 'PM check-off did not reach 1 of 1.');

    let accountBeforeSignOut = null;
    let accountBoundaryFailure = null;
    let accountBoundaryRetry = null;
    let signedOutWelcome = null;
    let signedOutShelf = null;
    let signedOutToday = null;
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
      accountBeforeSignOut = await captureStep(client, '25-account-before-signout', {
        assertClean: false,
      });
      assert(
        accountBeforeSignOut.overflowX <= 1,
        `Account surface has horizontal overflow: ${accountBeforeSignOut.overflowX}px.`,
      );
      assertInteractiveControl(accountBeforeSignOut, 'Sign out');

      await clickByText(client, 'Sign out');
      await waitForText(client, 'Account change paused', 30_000);
      accountBoundaryFailure = await captureStep(client, '26-account-boundary-clear-failure');
      assertPrivateNamesHidden(accountBoundaryFailure, 'Failed account boundary');
      assertInteractiveControl(accountBoundaryFailure, 'Try again');
      assert(
        accountBoundaryFailure.bodyText.includes('The next account is still locked out.'),
        'Account boundary failure did not explain that the next account remained locked out.',
      );

      await clickByText(client, 'Try again');
      await waitForText(client, 'Securing account data...', 10_000);
      accountBoundaryRetry = await captureStep(client, '27-account-boundary-retry');
      assertPrivateNamesHidden(accountBoundaryRetry, 'Retrying account boundary');

      await waitForPath(client, '/', 30_000);
      await waitForText(client, 'Begin', 30_000);
      signedOutWelcome = await captureStep(client, '28-signed-out-welcome');
      assertPrivateNamesHidden(signedOutWelcome, 'Signed-out welcome');

      await navigateClientSide(client, '/shelf');
      await waitForPath(client, '/shelf', 30_000);
      await waitForText(client, 'empty for now', 30_000);
      signedOutShelf = await captureStep(client, '29-signed-out-shelf');
      assertPrivateNamesHidden(signedOutShelf, 'Signed-out Shelf');

      await navigateClientSide(client, '/today?routine=AM');
      await waitForPath(client, '/today', 30_000);
      await waitForText(client, 'NO ROUTINE YET', 30_000);
      signedOutToday = await captureStep(client, '30-signed-out-today', {
        assertClean: false,
      });
      assert(
        signedOutToday.overflowX <= 1,
        `Signed-out Today has horizontal overflow: ${signedOutToday.overflowX}px.`,
      );
      assertInteractiveControl(signedOutToday, 'Add products');
      assertPrivateNamesHidden(signedOutToday, 'Signed-out Today');
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
      paywallExplore,
      routinePlan,
      todayAfterStart,
      todayAmBefore,
      todayAmSaving,
      todayAmAfter,
      todayAmAfterRepeat,
      todayAmAfterReload,
      todayPmBefore,
      todayPmAfter,
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
      accountIsolationMode,
      accountIsolation: accountIsolationMode
        ? {
            accountAEmail: 'tas.account-a.e2e@example.com',
            cleanupFailureStayedGated:
              accountBoundaryFailure?.bodyText.includes('Account change paused') ?? false,
            privateNamesHiddenAfterSignOut:
              Boolean(signedOutShelf && signedOutToday) &&
              productNames.every(
                (product) =>
                  !signedOutShelf.bodyText.includes(product.name) &&
                  !signedOutToday.bodyText.includes(product.name),
              ),
            reachedEmptyShelf: signedOutShelf?.bodyText.includes('empty for now') ?? false,
            reachedEmptyToday: signedOutToday?.bodyText.includes('NO ROUTINE YET') ?? false,
            retryShowedTransitionGate:
              accountBoundaryRetry?.bodyText.includes('Securing account data...') ?? false,
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
      endUrl: signedOutToday?.url ?? todayPmAfter.url,
      evidenceFiles: [
        '01-welcome.png',
        '03-age-filled.png',
        '05-goals-selected.png',
        '09-products-empty.png',
        '12-products-after-3.png',
        '14-reveal-insight.png',
        '15-notifications.png',
        '16-account.png',
        ...(accountUpgradeMode ? ['16a-account-code-entry.png', '16b-account-code-error.png'] : []),
        '17-paywall-current.png',
        '18-paywall-explore-visible.png',
        '19-routine-plan-current.png',
        '20-today-after-start-current.png',
        '21-today-am-before-checkoff.png',
        '21a-today-am-saving.png',
        '22-today-am-after-checkoff.png',
        '22a-today-am-after-repeat-checkoff.png',
        '22b-today-am-after-reload.png',
        '23-today-pm-before-checkoff.png',
        '24-today-pm-after-checkoff.png',
        ...(accountIsolationMode
          ? [
              '25-account-before-signout.png',
              '26-account-boundary-clear-failure.png',
              '27-account-boundary-retry.png',
              '28-signed-out-welcome.png',
              '29-signed-out-shelf.png',
              '30-signed-out-today.png',
            ]
          : []),
      ],
      flowResult: accountUpgradeMode
        ? 'Recovered from an invalid deterministic email code, completed the account route with the valid code, then finished activation through AM and PM check-offs.'
        : accountIsolationMode
          ? 'Completed activation, failed one account cleanup safely behind the transition gate, retried, signed out, and proved direct Shelf and Today routes could not expose account A data.'
          : 'Completed onboarding through Explore first, routine plan, Start today, same-rectangle double-touch AM/PM check-offs, disabled AM saving state, append-only repeat, AM reload persistence, and PM cycle completion.',
      overflowXByStep,
      productNames: productNames.map((product) => product.name),
      reveal: {
        hasContinue: reveal.bodyText.includes('Continue'),
        hasDerivedInsightBody: reveal.bodyText.includes(
          'Products that need different timing are separated before the first check-off.',
        ),
        hasFirstInsightLabel: reveal.bodyText.includes('FIRST INSIGHT'),
        hasRoutinePreviewFallback: reveal.bodyText.includes('Routine preview'),
        hasSeeMyRoutine: reveal.bodyText.includes('See my routine'),
        hasTimingHandled: reveal.bodyText.includes('Timing handled'),
        text: reveal.bodyText,
      },
      routinePlan: {
        hasFirstInsight: routinePlan.bodyText.includes('FIRST INSIGHT'),
        hasGlycolicNight: routinePlan.bodyText.includes('Glycolic 7%'),
        hasRetinolNight: routinePlan.bodyText.includes('Retinol 0.3%'),
        hasSpfMorning: routinePlan.bodyText.includes('Mineral SPF 50'),
        hasStartToday: routinePlan.bodyText.includes('Start today'),
        text: routinePlan.bodyText,
        url: routinePlan.url,
      },
      routeCheck: {
        accountLedToPaywall: paywall.url.includes('/onboarding/paywall'),
        accountUpgradeErrorRecovered:
          !accountUpgradeMode ||
          (accountCodeError?.bodyText.includes('That code did not work') &&
            paywall.url.includes('/onboarding/paywall')),
        amCheckoffReachedComplete: todayAmAfter.bodyText.includes('1 of 1'),
        exploreFirstLedToRoutinePlan: routinePlan.url.includes('/routine/plan'),
        notificationSkipLedToAccount: true,
        pmCheckoffReachedComplete: todayPmAfter.bodyText.includes('1 of 1'),
        signedOutShelfIsEmpty:
          !accountIsolationMode || signedOutShelf?.bodyText.includes('empty for now') === true,
        signedOutTodayIsEmpty:
          !accountIsolationMode || signedOutToday?.bodyText.includes('NO ROUTINE YET') === true,
        revealContinueLedToNotifications: true,
        revealRoute: reveal.url,
        startTodayLedToToday: todayAfterStart.url.includes('/today'),
      },
      startCommand: shouldStartServer
        ? `${accountUpgradeMode ? 'EXPO_PUBLIC_E2E_ACCOUNT_UPGRADE=email_same_user ' : ''}${accountIsolationMode ? 'EXPO_PUBLIC_E2E_ACCOUNT_ISOLATION=signout_clear_retry ' : ''}EXPO_PUBLIC_E2E_COMPLETION_COMMIT_DELAY_MS=1200 EXPO_PUBLIC_E2E_LOCAL_RESET=1 npm --workspace apps/mobile run web -- --port ${appPort} --host localhost`
        : `Existing Expo web at ${baseUrl}`,
      startUrl: `${baseUrl}/?e2eReset=local`,
      steps: [
        'Reset local private state with dev-only fixture.',
        'Began onboarding, entered valid adult DOB, selected Clear skin and Barrier repair.',
        'Granted explicit health-data collection consent.',
        'Answered 12-question quiz with visible option buttons.',
        'Added Retinol 0.3% serum, Glycolic 7% toner, and Mineral SPF 50 from product intake.',
        accountUpgradeMode
          ? 'Continued from reveal to notification soft ask, skipped reminders, recovered from an invalid email code, completed the deterministic account upgrade, and reached onboarding paywall.'
          : 'Continued from reveal to notification soft ask, skipped reminders, skipped account, and reached onboarding paywall.',
        'Used Explore first to unlock the routine plan without card entry.',
        'Verified the generated routine plan contains the first insight plus SPF, glycolic, and retinol placement.',
        'Tapped Start today, forced AM and PM dev routine states, and completed the SPF and glycolic check-offs to 1 of 1.',
        ...(accountIsolationMode
          ? [
              'Opened the signed-in account surface and initiated sign-out with account A private queries already populated.',
              'Verified a forced first cleanup failure exposed only the recovery gate, then retried through the transition state.',
              'Verified Welcome, direct Shelf, and direct Today routes contain no account A product names after cleanup.',
            ]
          : []),
      ],
      surface: 'Headless Chrome Expo web',
      today: {
        am: {
          afterText: todayAmAfter.bodyText,
          beforeText: todayAmBefore.bodyText,
          completed: todayAmAfter.bodyText.includes('1 of 1'),
          product: 'Mineral SPF 50',
          url: todayAmAfter.url,
        },
        afterStartUrl: todayAfterStart.url,
        pm: {
          afterText: todayPmAfter.bodyText,
          beforeText: todayPmBefore.bodyText,
          completed: todayPmAfter.bodyText.includes('1 of 1'),
          product: 'Glycolic 7% toner',
          url: todayPmAfter.url,
        },
      },
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
    console.log(`Onboarding first-session E2E passed. Evidence: ${evidenceDir}`);
  } finally {
    client?.close();
    await stopProcess(browser);
    await stopProcess(server);
    rmSync(userDataDir, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
