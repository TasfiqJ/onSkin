import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const isWindows = process.platform === 'win32';
const today = new Date().toISOString().slice(0, 10);
const evidenceDir =
  process.env.ONBOARDING_E2E_EVIDENCE_DIR ??
  path.join(repoRoot, 'test-results', 'human-e2e', today, 'onboarding-first-session-430-current');
const appPort = Number(process.env.ONBOARDING_E2E_PORT ?? 8285);
const debugPort = Number(process.env.ONBOARDING_E2E_DEBUG_PORT ?? 9385);
const baseUrl = process.env.ONBOARDING_E2E_BASE_URL ?? `http://localhost:${appPort}`;
const shouldStartServer = !process.env.ONBOARDING_E2E_BASE_URL;
const viewport = {
  height: Number(process.env.ONBOARDING_E2E_VIEWPORT_HEIGHT ?? 430),
  width: Number(process.env.ONBOARDING_E2E_VIEWPORT_WIDTH ?? 320),
};

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

async function clickByText(client, label, { exact = true, timeoutMs = 30_000 } = {}) {
  const startedAt = Date.now();
  let rect = null;

  while (Date.now() - startedAt < timeoutMs) {
    rect = await evaluate(client, rectByTextExpression(label, exact));
    if (rect && rect.disabled !== true && rect.ariaDisabled !== 'true') break;
    await delay(250);
  }

  assert(rect, `Could not find visible clickable text: ${label}`);
  assert(rect.disabled !== true && rect.ariaDisabled !== 'true', `Clickable text is disabled: ${label}`);

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

function fillExpression(label, value) {
  return `(() => {
    const label = ${JSON.stringify(label)};
    const value = ${JSON.stringify(value)};
    const normalize = (next) => String(next ?? '').replace(/\\s+/g, ' ').trim();
    const controls = Array.from(document.querySelectorAll('input,textarea'));
    const target = controls.find((node) => {
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

async function captureStep(client, name, { assertClean = true } = {}) {
  await delay(250);
  const snapshot = await evaluate(client, auditExpression());
  writeJson(`${name}.json`, snapshot);
  await screenshot(client, name);
  if (assertClean) {
    assert(snapshot.overflowX <= 1, `${name} has horizontal overflow: ${snapshot.overflowX}px`);
    assert(snapshot.issueCount === 0, `${name} has ${snapshot.issueCount} visible control issue(s).`);
  }
  return snapshot;
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
    if (index === 8) await captureStep(client, '08-quiz-after-09');
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
  await waitForText(client, product.name);
  return await captureStep(client, evidenceName);
}

function writeReport(summary) {
  const lines = [
    '# Human-Simulated E2E Run Report',
    '',
    '## Summary',
    '',
    `- Date: ${summary.date}`,
    '- Codex task: First-session onboarding 320 x 430 stress run',
    `- App surface: ${summary.surface}`,
    `- Build/start command: \`${summary.startCommand}\``,
    `- Browser/device/simulator/OS: Headless Chrome or Edge, ${viewport.width} x ${viewport.height}`,
    '- Feature or PR tested: First-run onboarding activation path',
    `- Overall verdict: ${summary.verdict === 'pass' ? 'Pass' : 'Fail'}`,
    '',
    '## Flows Executed',
    '',
    '| Flow | Branch | Result | Evidence | Notes |',
    '| ---- | ------ | ------ | -------- | ----- |',
    `| First-run onboarding | Happy path / stress viewport | ${summary.verdict} | \`${path.relative(repoRoot, evidenceDir).replace(/\\/g, '/')}\` | Reached ${summary.endUrl} |`,
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
    'npm run e2e:onboarding-first-session',
    '```',
    '',
    '## Remaining Risk',
    '',
    '- 320 x 430 is resilience evidence below the accepted launch web floor.',
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
      { category: 'Moisturiser', name: 'Ceramide moisturizer' },
    ];
    await addProduct(client, productNames[0], '10-products-after-1');
    await addProduct(client, productNames[1], '11-products-after-2');
    await addProduct(client, productNames[2], '12-products-after-3');
    await clickByText(client, 'Continue');

    await waitForText(client, 'Building your plan', 15_000);
    await captureStep(client, '13-post-products-continue-current');
    await waitForText(client, 'YOUR SKIN PROFILE', 45_000);
    await waitForText(client, 'FIRST INSIGHT');
    await waitForText(client, 'Timing handled');
    const reveal = await captureStep(client, '14-reveal-checks');
    await screenshot(client, '14-reveal-insight');
    assert(reveal.bodyText.includes('FIRST INSIGHT'), 'Reveal did not show FIRST INSIGHT.');
    assert(reveal.bodyText.includes('Timing handled'), 'Reveal did not show Timing handled.');
    assert(
      reveal.bodyText.includes('Products that need different timing are separated before the first check-off.'),
      'Reveal did not show the shelf-derived timing insight body.',
    );
    assert(!reveal.bodyText.includes('See my routine'), 'Reveal still exposes See my routine CTA.');

    await clickByText(client, 'Continue');
    await waitForPath(client, '/onboarding/notifications');
    await captureStep(client, '15-notifications');
    await clickByText(client, 'Not now');

    await waitForPath(client, '/onboarding/account');
    await captureStep(client, '16-account');
    await clickByText(client, 'Not now');

    await waitForPath(client, '/onboarding/paywall');
    await waitForText(client, 'Start free trial');
    const paywall = await captureStep(client, '17-paywall-current');
    await screenshot(client, '17-paywall');
    writeJson('17-paywall.json', paywall);

    const problemLogs = collectProblemLogs(client.events);
    const disallowedLogs = problemLogs.filter(disallowedLog);
    writeJson('browser-warn-error-logs.json', problemLogs);
    assert(disallowedLogs.length === 0, `Unexpected browser warn/error logs: ${disallowedLogs.length}`);

    const overflowXByStep = {};
    for (const [key, snapshot] of Object.entries({
      welcome,
      reveal,
      paywall,
    })) {
      overflowXByStep[key] = snapshot.overflowX;
    }

    const summary = {
      browserProblemLogCount: problemLogs.length,
      date: today,
      endUrl: paywall.url,
      evidenceFiles: [
        '01-welcome.png',
        '03-age-filled.png',
        '05-goals-selected.png',
        '09-products-empty.png',
        '12-products-after-3.png',
        '14-reveal-insight.png',
        '15-notifications.png',
        '16-account.png',
        '17-paywall-current.png',
      ],
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
      routeCheck: {
        accountSkipLedToPaywall: paywall.url.includes('/onboarding/paywall'),
        notificationSkipLedToAccount: true,
        revealContinueLedToNotifications: true,
        revealRoute: reveal.url,
      },
      startCommand: shouldStartServer
        ? `EXPO_PUBLIC_E2E_LOCAL_RESET=1 npm --workspace apps/mobile run web -- --port ${appPort} --host localhost`
        : `Existing Expo web at ${baseUrl}`,
      startUrl: `${baseUrl}/?e2eReset=local`,
      steps: [
        'Reset local private state with dev-only fixture.',
        'Began onboarding, entered valid adult DOB, selected Clear skin and Barrier repair.',
        'Granted explicit health-data collection consent.',
        'Answered 12-question quiz with visible option buttons.',
        'Added Retinol 0.3% serum, Glycolic 7% toner, and Ceramide moisturizer from product intake.',
        'Continued from reveal to notification soft ask, skipped reminders, skipped account, and reached onboarding paywall.',
      ],
      surface: 'Headless Chrome Expo web',
      verdict: 'pass',
      viewport: {
        ...viewport,
        supportClass: 'resilience stress viewport below launch web support floor',
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
