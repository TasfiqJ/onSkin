const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = process.cwd();
const OUT_DIR = path.join(
  ROOT,
  'test-results',
  'human-e2e',
  '2026-07-08',
  'progate-short-phone-480-compliance',
);
const BASE_URL = 'http://localhost:8204';

const routes = [
  '/progress',
  '/routine/plan',
  '/routine/ramp',
  '/routine/tolerance',
  '/routine/reorder',
  '/routine/adaptation',
  '/cycle/settings',
  '/cycle/disruption',
  '/cycle/procedure',
  '/cycle/phased-intro',
  '/cycle/recovery',
  '/cycle/why-tonight',
  '/cycle/week',
  '/routine/streak',
  '/routine/widgets',
  '/paywall/upsell?feature=full_routine',
];

const browserExecutableCandidates = [
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean);

function slugFor(route) {
  return route
    .replace(/^\//, '')
    .replace(/\?/g, '-')
    .replace(/=/g, '-')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function isAllowedLog(log) {
  return (
    log.message.includes('EXPO_PUBLIC_SUPABASE_URL is not a valid Supabase URL') ||
    log.message.includes('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not set') ||
    log.message.includes('expo-notifications') ||
    log.message.includes('Download the React DevTools') ||
    log.message.includes('Running application "main" with appParams')
  );
}

async function auditRoute(page, route, pageLogs, pageDialogs) {
  const slug = slugFor(route);
  const url = `${BASE_URL}${route}`;
  pageLogs.length = 0;
  pageDialogs.length = 0;

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(450);

  const audit = await page.evaluate(() => {
    function textFor(el) {
      const direct =
        el.getAttribute('aria-label') ||
        el.getAttribute('title') ||
        el.textContent ||
        el.getAttribute('value') ||
        '';
      return direct.replace(/\s+/g, ' ').trim();
    }

    function isVisible(el) {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        Number(style.opacity || '1') > 0.01
      );
    }

    function visibleRect(rect) {
      const left = Math.max(0, rect.left);
      const top = Math.max(0, rect.top);
      const right = Math.min(window.innerWidth, rect.right);
      const bottom = Math.min(window.innerHeight, rect.bottom);
      return {
        left,
        top,
        right,
        bottom,
        width: Math.max(0, right - left),
        height: Math.max(0, bottom - top),
      };
    }

    function controlRecord(el) {
      const rect = el.getBoundingClientRect();
      const visible = visibleRect(rect);
      const center = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
      const centerInViewport =
        center.x >= 0 &&
        center.x <= window.innerWidth &&
        center.y >= 0 &&
        center.y <= window.innerHeight;
      const hit = centerInViewport ? document.elementFromPoint(center.x, center.y) : null;
      const hitControl = hit ? hit.closest('button,a,[role="button"],input,textarea,select') : null;
      const hitOk = !hit || hit === el || el.contains(hit) || hitControl === el;
      const text = textFor(el);

      return {
        tag: el.tagName.toLowerCase(),
        role: el.getAttribute('role') || null,
        ariaHidden: el.getAttribute('aria-hidden') || null,
        tabIndex: el.getAttribute('tabindex') || null,
        disabled: el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true',
        text,
        rect: {
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
        },
        visibleRect: visible,
        center,
        centerInViewport,
        hitOk,
        hitText: hit ? textFor(hit) : null,
        hitTag: hit ? hit.tagName.toLowerCase() : null,
      };
    }

    const controls = Array.from(
      document.querySelectorAll('button,a,[role="button"],input,textarea,select'),
    )
      .filter(isVisible)
      .map(controlRecord);

    const targetLabels = [
      'Terms',
      'Privacy',
      'Restore',
      'Maybe later',
      'Start free trial',
      'Explore first',
      'Renew Pro',
      'See current Pro plan',
    ];

    const targets = controls.filter((control) =>
      targetLabels.some((label) => control.text.includes(label)),
    );

    const requiredLabels = ['Terms', 'Privacy', 'Restore', 'Maybe later'];
    const missingRequiredLabels = requiredLabels.filter(
      (label) => !controls.some((control) => control.text.includes(label)),
    );

    const targetIssues = targets
      .map((control) => {
        const minSide = Math.min(control.rect.width, control.rect.height);
        const visibleEnough =
          control.visibleRect.width >= Math.min(44, control.rect.width) &&
          control.visibleRect.height >= Math.min(44, control.rect.height);
        const issues = [];
        if (minSide < 44) issues.push('sub44');
        if (!visibleEnough) issues.push('clipped');
        if (control.centerInViewport && !control.hitOk) issues.push('hit-blocked');
        return { ...control, issues };
      })
      .filter((control) => control.issues.length > 0);

    const allVisibleControlIssues = controls
      .map((control) => {
        const userFacing =
          control.ariaHidden !== 'true' &&
          control.tabIndex !== '-1' &&
          (control.text.length > 0 || control.role === 'button' || control.tag === 'button');
        const minSide = Math.min(control.rect.width, control.rect.height);
        const visibleEnough =
          control.visibleRect.width >= Math.min(44, control.rect.width) &&
          control.visibleRect.height >= Math.min(44, control.rect.height);
        const issues = [];
        if (userFacing && minSide < 44) issues.push('sub44');
        if (userFacing && !visibleEnough) issues.push('clipped');
        if (userFacing && control.centerInViewport && !control.hitOk) issues.push('hit-blocked');
        return { ...control, issues };
      })
      .filter((control) => control.issues.length > 0);

    const navControls = controls.filter((control) =>
      ['Today', 'Progress', 'Shelf', 'You'].includes(control.text),
    );
    const tabTop = navControls.length
      ? Math.min(...navControls.map((control) => control.rect.top))
      : null;

    return {
      url: window.location.href,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      body: {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        horizontalOverflow:
          document.documentElement.scrollWidth - document.documentElement.clientWidth,
      },
      titleText: textFor(document.querySelector('h1,[role="heading"]') || document.body),
      visibleText: textFor(document.body).slice(0, 1600),
      tabTop,
      controls,
      targets,
      missingRequiredLabels,
      targetIssues,
      allVisibleControlIssues,
    };
  });

  const screenshotPath = path.join(OUT_DIR, `${slug}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: false });

  const disallowedLogs = pageLogs.filter((log) => !isAllowedLog(log));
  const failed =
    audit.missingRequiredLabels.length > 0 ||
    audit.targetIssues.length > 0 ||
    audit.body.horizontalOverflow > 1 ||
    pageDialogs.length > 0 ||
    disallowedLogs.some((log) => log.level === 'error');

  const result = {
    route,
    url,
    screenshot: screenshotPath,
    failed,
    dialogs: [...pageDialogs],
    logs: [...pageLogs],
    disallowedLogs,
    ...audit,
  };

  await fs.writeFile(path.join(OUT_DIR, `${slug}.json`), JSON.stringify(result, null, 2));
  return result;
}

(async () => {
  await fs.mkdir(OUT_DIR, { recursive: true });
  let executablePath = null;
  for (const candidate of browserExecutableCandidates) {
    try {
      await fs.access(candidate);
      executablePath = candidate;
      break;
    } catch {
      // Try the next installed browser path.
    }
  }
  const browser = await chromium.launch({
    headless: true,
    executablePath: executablePath || undefined,
  });
  const context = await browser.newContext({
    viewport: { width: 320, height: 480 },
    deviceScaleFactor: 1,
    hasTouch: true,
  });
  const page = await context.newPage();
  const pageLogs = [];
  const pageDialogs = [];

  page.on('console', (message) => {
    pageLogs.push({
      level: message.type(),
      message: message.text(),
      url: message.location()?.url || null,
    });
  });
  page.on('pageerror', (error) => {
    pageLogs.push({ level: 'error', message: error.message, url: null });
  });
  page.on('dialog', async (dialog) => {
    pageDialogs.push({ type: dialog.type(), message: dialog.message() });
    await dialog.dismiss().catch(() => {});
  });

  const results = [];
  for (const route of routes) {
    results.push(await auditRoute(page, route, pageLogs, pageDialogs));
  }

  await browser.close();

  const summary = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    viewport: { width: 320, height: 480 },
    browserExecutable: executablePath || 'playwright-managed',
    routeCount: results.length,
    failedRoutes: results
      .filter((result) => result.failed)
      .map((result) => ({
        route: result.route,
        missingRequiredLabels: result.missingRequiredLabels,
        targetIssues: result.targetIssues.map((issue) => ({
          text: issue.text,
          issues: issue.issues,
          rect: issue.rect,
          hitText: issue.hitText,
        })),
        horizontalOverflow: result.body.horizontalOverflow,
        dialogs: result.dialogs,
        disallowedLogs: result.disallowedLogs,
      })),
    routeSummaries: results.map((result) => ({
      route: result.route,
      failed: result.failed,
      url: result.url,
      screenshot: result.screenshot,
      missingRequiredLabels: result.missingRequiredLabels,
      targetIssueCount: result.targetIssues.length,
      allVisibleControlIssueCount: result.allVisibleControlIssues.length,
      horizontalOverflow: result.body.horizontalOverflow,
      dialogCount: result.dialogs.length,
      disallowedLogCount: result.disallowedLogs.length,
    })),
  };

  await fs.writeFile(path.join(OUT_DIR, 'summary.json'), JSON.stringify(summary, null, 2));
  process.stdout.write(JSON.stringify(summary, null, 2));
  if (summary.failedRoutes.length > 0) process.exitCode = 2;
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
