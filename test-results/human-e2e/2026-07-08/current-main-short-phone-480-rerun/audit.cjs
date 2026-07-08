const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const outDir = __dirname;
const baseUrl = process.env.E2E_BASE_URL || 'http://localhost:8211';
const browserExecutablePath =
  process.env.PLAYWRIGHT_CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const routes = [
  '/today',
  '/today?routine=PM',
  '/progress',
  '/progress/capture',
  '/progress/review',
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
  '/recommendations',
  '/recommendations/preferences',
  '/recommendations/stale-local-rec',
  '/community',
  '/community/note/missing-note-e2e',
  '/community/ask',
  '/community/people-like-you',
  '/commerce/consent',
  '/commerce/stacks',
  '/commerce/stack/barrier-basics',
  '/commerce/stack/missing-stack-e2e',
  '/commerce/transparency',
  '/settings/subscription',
  '/settings/notifications',
  '/settings/timing',
  '/settings/privacy',
  '/trend/optin',
  '/trend/fairness',
  '/ask',
  '/ask/consent',
  '/shelf',
  '/shelf/search',
  '/shelf/no-match',
  '/shelf/scan',
  '/shelf/ocr',
  '/shelf/manual',
  '/shelf/archive',
  '/shelf/opened',
  '/paywall/upsell?feature=full_routine',
  '/paywall/success',
  '/routine/streak',
  '/routine/widgets',
  '/cycle/week',
];

function fileSlug(route) {
  return route
    .replace(/^\//, '')
    .replace(/[/?=&:]+/g, '-')
    .replace(/-$/, '') || 'root';
}

function isAllowedLog(entry) {
  return (
    /EXPO_PUBLIC_SUPABASE|Supabase|placeholder|B-SUPABASE|expo-notifications|React DevTools|Download the React DevTools|favicon|net::ERR_CONNECTION_REFUSED/i.test(
      entry.text,
    ) || entry.type === 'warning'
  );
}

async function inspectRoute(page, route) {
  const url = `${baseUrl}${route}`;
  const slug = fileSlug(route);
  const logs = [];
  page.removeAllListeners('console');
  page.removeAllListeners('pageerror');
  page.on('console', (message) => {
    logs.push({ type: message.type(), text: message.text() });
  });
  page.on('pageerror', (error) => {
    logs.push({ type: 'pageerror', text: error.message });
  });

  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(650);
  await page.screenshot({ path: path.join(outDir, `${slug}.png`), fullPage: false });

  const result = await page.evaluate(() => {
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const documentElement = document.documentElement;
    const text = document.body.textContent?.replace(/\s+/g, ' ').trim() || '';
    const tabLabels = new Set(['Today', 'Progress', 'Shelf', 'You']);
    const tabControls = Array.from(document.querySelectorAll('button, [role="button"], a'))
      .map((node) => {
        const label =
          node.getAttribute('aria-label') ||
          node.textContent?.replace(/\s+/g, ' ').trim() ||
          node.getAttribute('href') ||
          '';
        const rect = node.getBoundingClientRect();
        return { label, rect };
      })
      .filter(({ label, rect }) => tabLabels.has(label) && rect.top > viewport.height * 0.65);
    const tabTop = tabControls.length ? Math.min(...tabControls.map(({ rect }) => rect.top)) : null;
    const candidates = Array.from(
      document.querySelectorAll('button, [role="button"], a, input, textarea, select'),
    );
    const controls = candidates
      .map((node, index) => {
        if (node.closest('[aria-hidden="true"]')) return null;
        const ariaHidden = node.getAttribute('aria-hidden') === 'true';
        const tabIndex = node.getAttribute('tabindex');
        if (ariaHidden || tabIndex === '-1') return null;
        const rect = node.getBoundingClientRect();
        const styles = window.getComputedStyle(node);
        const label =
          node.getAttribute('aria-label') ||
          node.textContent?.replace(/\s+/g, ' ').trim() ||
          node.getAttribute('placeholder') ||
          node.getAttribute('href') ||
          '';
        const visible =
          label &&
          rect.width > 0 &&
          rect.height > 0 &&
          styles.visibility !== 'hidden' &&
          styles.display !== 'none' &&
          rect.bottom > 0 &&
          rect.right > 0 &&
          rect.top < viewport.height &&
          rect.left < viewport.width;
        if (!visible) return null;
        const center = {
          x: Math.min(Math.max(rect.left + rect.width / 2, 0), viewport.width - 1),
          y: Math.min(Math.max(rect.top + rect.height / 2, 0), viewport.height - 1),
        };
        const hit = document.elementFromPoint(center.x, center.y);
        const clipped =
          rect.top < -0.5 ||
          rect.left < -0.5 ||
          rect.bottom > viewport.height + 0.5 ||
          rect.right > viewport.width + 0.5;
        const visibleHeight = Math.min(rect.bottom, viewport.height) - Math.max(rect.top, 0);
        const visibleWidth = Math.min(rect.right, viewport.width) - Math.max(rect.left, 0);
        const isTab = tabLabels.has(label) && rect.top > viewport.height * 0.65;
        return {
          center,
          clipped,
          hitBlocked: hit ? !node.contains(hit) && hit !== node : true,
          hitLabel:
            hit?.getAttribute('aria-label') || hit?.textContent?.replace(/\s+/g, ' ').trim() || '',
          index,
          isTab,
          label,
          rect: {
            bottom: rect.bottom,
            height: rect.height,
            left: rect.left,
            right: rect.right,
            top: rect.top,
            width: rect.width,
          },
          role: node.getAttribute('role') || node.tagName.toLowerCase(),
          tinyTarget: rect.width < 44 || rect.height < 44,
          visibleHeight,
          visibleWidth,
        };
      })
      .filter(Boolean);

    const issues = [];
    for (const control of controls) {
      if (control.tinyTarget && !control.isTab) {
        issues.push({ type: 'tiny-visible-control', label: control.label, rect: control.rect });
      }
      if (control.clipped && !control.isTab) {
        issues.push({
          type: 'clipped-visible-control',
          label: control.label,
          rect: control.rect,
          visibleHeight: control.visibleHeight,
          visibleWidth: control.visibleWidth,
        });
      }
      if (control.hitBlocked && !control.isTab) {
        issues.push({
          type: 'hit-blocked-control',
          hitLabel: control.hitLabel,
          label: control.label,
          rect: control.rect,
        });
      }
      if (!control.isTab && tabTop !== null && control.rect.bottom > tabTop - 2) {
        issues.push({
          type: 'control-near-tabbar-bottom',
          label: control.label,
          rect: control.rect,
          tabTop,
        });
      }
    }
    const horizontalOverflow = documentElement.scrollWidth - documentElement.clientWidth;
    if (horizontalOverflow > 1) {
      issues.push({ type: 'horizontal-overflow', value: horizontalOverflow });
    }

    return {
      controls,
      currentDialog:
        document.querySelector('[role="dialog"]')?.textContent?.replace(/\s+/g, ' ').trim() ||
        null,
      issueCount: issues.length,
      issues,
      route: window.location.pathname + window.location.search,
      scroll: {
        clientHeight: documentElement.clientHeight,
        clientWidth: documentElement.clientWidth,
        scrollHeight: documentElement.scrollHeight,
        scrollWidth: documentElement.scrollWidth,
        x: window.scrollX,
        y: window.scrollY,
      },
      tabTop,
      textStart: text.slice(0, 900),
      url: window.location.href,
      viewport,
    };
  });

  const disallowedLogs = logs.filter((entry) => ['error', 'pageerror'].includes(entry.type) && !isAllowedLog(entry));
  result.disallowedLogs = disallowedLogs;
  result.disallowedLogCount = disallowedLogs.length;
  result.browserLogCount = logs.length;

  fs.writeFileSync(path.join(outDir, `${slug}.json`), `${JSON.stringify(result, null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, `${slug}-logs.json`), `${JSON.stringify(logs, null, 2)}\n`);
  return {
    disallowedLogCount: result.disallowedLogCount,
    issueCount: result.issueCount,
    issues: result.issues,
    json: path.join(outDir, `${slug}.json`),
    route,
    screenshot: path.join(outDir, `${slug}.png`),
    textStart: result.textStart,
    url: result.url,
  };
}

async function main() {
  const browser = await chromium.launch({ executablePath: browserExecutablePath, headless: true });
  const page = await browser.newPage({ viewport: { width: 320, height: 480 } });
  const summary = [];
  for (const route of routes) {
    try {
      const result = await inspectRoute(page, route);
      summary.push(result);
      console.log(`${result.issueCount ? 'FAIL' : 'PASS'} ${route} issues=${result.issueCount} logs=${result.disallowedLogCount}`);
    } catch (error) {
      summary.push({ route, issueCount: 1, issues: [{ type: 'audit-error', message: error.message }] });
      console.log(`ERROR ${route} ${error.message}`);
    }
  }
  await browser.close();
  const failedRoutes = summary.filter((entry) => entry.issueCount > 0 || entry.disallowedLogCount > 0);
  fs.writeFileSync(path.join(outDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  fs.writeFileSync(
    path.join(outDir, 'failures.json'),
    `${JSON.stringify(
      {
        failedRouteCount: failedRoutes.length,
        failedRoutes: failedRoutes.map((entry) => ({
          route: entry.route,
          issueCount: entry.issueCount,
          disallowedLogCount: entry.disallowedLogCount,
          issues: entry.issues,
        })),
      },
      null,
      2,
    )}\n`,
  );
  if (failedRoutes.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
