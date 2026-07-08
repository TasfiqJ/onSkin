const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const outDir = __dirname;
const baseUrl = process.env.E2E_BASE_URL || 'http://localhost:8210';
const route = '/recommendations';
const browserExecutablePath =
  process.env.PLAYWRIGHT_CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

async function main() {
  const browser = await chromium.launch({
    executablePath: browserExecutablePath,
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 320, height: 480 } });
  const logs = [];
  page.on('console', (message) => {
    logs.push({ type: message.type(), text: message.text() });
  });
  page.on('pageerror', (error) => {
    logs.push({ type: 'pageerror', text: error.message });
  });

  await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(750);
  await page.screenshot({ path: path.join(outDir, 'recommendations.png'), fullPage: false });

  const result = await page.evaluate(() => {
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
    };
    const candidates = Array.from(document.querySelectorAll('button, [role="button"], a, input'));
    const controls = candidates
      .map((node, index) => {
        const rect = node.getBoundingClientRect();
        const styles = window.getComputedStyle(node);
        const visible =
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
        const label =
          node.getAttribute('aria-label') ||
          node.textContent?.replace(/\s+/g, ' ').trim() ||
          node.getAttribute('href') ||
          '';
        const hitLabel =
          hit?.getAttribute('aria-label') || hit?.textContent?.replace(/\s+/g, ' ').trim() || '';

        return {
          ariaLabel: node.getAttribute('aria-label') || '',
          center,
          clipped,
          hitBlocked: hit ? !node.contains(hit) && hit !== node : true,
          hitLabel,
          index,
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
          visibleHeight: Math.min(rect.bottom, viewport.height) - Math.max(rect.top, 0),
          visibleWidth: Math.min(rect.right, viewport.width) - Math.max(rect.left, 0),
        };
      })
      .filter(Boolean);

    const issues = [];
    for (const control of controls) {
      if (control.tinyTarget) issues.push({ type: 'tiny-target', label: control.label });
      if (control.clipped) issues.push({ type: 'clipped-visible-control', label: control.label });
      if (control.hitBlocked) issues.push({ type: 'hit-blocked', label: control.label });
    }
    const horizontalOverflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    if (horizontalOverflow > 1) issues.push({ type: 'horizontal-overflow', value: horizontalOverflow });

    return {
      controls,
      currentDialog: document.querySelector('[role="dialog"]')?.textContent?.replace(/\s+/g, ' ').trim() || null,
      issueCount: issues.length,
      issues,
      route: window.location.pathname,
      scroll: {
        clientHeight: document.documentElement.clientHeight,
        clientWidth: document.documentElement.clientWidth,
        scrollHeight: document.documentElement.scrollHeight,
        scrollWidth: document.documentElement.scrollWidth,
        x: window.scrollX,
        y: window.scrollY,
      },
      textStart: document.body.textContent?.replace(/\s+/g, ' ').trim().slice(0, 900) || '',
      url: window.location.href,
      viewport,
    };
  });

  fs.writeFileSync(path.join(outDir, 'recommendations.json'), `${JSON.stringify(result, null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, 'browser-logs.json'), `${JSON.stringify(logs, null, 2)}\n`);

  const disallowedLogs = logs.filter((entry) => {
    if (!['error', 'pageerror'].includes(entry.type)) return false;
    return !/ERR_CONNECTION_REFUSED|supabase|placeholder/i.test(entry.text);
  });
  await browser.close();

  const summary = {
    route,
    issueCount: result.issueCount,
    issues: result.issues,
    disallowedLogCount: disallowedLogs.length,
  };
  fs.writeFileSync(path.join(outDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));
  if (result.issueCount > 0 || disallowedLogs.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
