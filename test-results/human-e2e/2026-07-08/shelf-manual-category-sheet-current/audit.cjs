const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const baseUrl = process.env.E2E_BASE_URL || 'http://localhost:8221';
const outDir = __dirname;

function writeJson(name, value) {
  fs.writeFileSync(path.join(outDir, name), JSON.stringify(value, null, 2));
}

async function snapshot(page, name) {
  await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: true });
  const data = await page.evaluate(() => {
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const doc = document.documentElement;
    const visibleButtons = [...document.querySelectorAll('[role="button"], button, a')]
      .map((el) => {
        const rect = el.getBoundingClientRect();
        const label =
          el.getAttribute('aria-label') ||
          el.getAttribute('title') ||
          (el.textContent || '').replace(/\s+/g, ' ').trim();
        return {
          label,
          role: el.getAttribute('role') || el.tagName.toLowerCase(),
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          visible:
            rect.width > 0 &&
            rect.height > 0 &&
            rect.bottom > 0 &&
            rect.right > 0 &&
            rect.top < viewport.height &&
            rect.left < viewport.width,
        };
      })
      .filter((item) => item.visible);
    const dialog = document.querySelector('[role="dialog"]');
    const dialogRect = dialog?.getBoundingClientRect();
    return {
      url: window.location.href,
      viewport,
      scrollWidth: doc.scrollWidth,
      bodyText: document.body.innerText.replace(/\s+/g, ' ').trim(),
      dialog: dialog
        ? {
            label: dialog.getAttribute('aria-label') || dialog.textContent?.slice(0, 80),
            top: dialogRect.top,
            bottom: dialogRect.bottom,
            height: dialogRect.height,
            width: dialogRect.width,
          }
        : null,
      visibleButtons,
    };
  });
  writeJson(`${name}.json`, data);
  return data;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function runViewport(browser, width, height) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const logs = [];
  page.on('console', (msg) => {
    if (['warning', 'error'].includes(msg.type())) {
      logs.push({ type: msg.type(), text: msg.text() });
    }
  });
  page.on('pageerror', (error) => logs.push({ type: 'pageerror', text: error.message }));

  await page.goto(`${baseUrl}/shelf/manual`, { waitUntil: 'networkidle' });
  await page.evaluate(() => window.localStorage.clear());
  await page.goto(`${baseUrl}/shelf/manual`, { waitUntil: 'networkidle' });
  await page.getByLabel('Product name').fill(`E2E Category Balm ${height}`);
  await page.getByLabel('Brand').fill('RoutineKind Test');
  await snapshot(page, `${width}x${height}-01-manual-filled`);

  await page.getByLabel('Category', { exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Choose product category' });
  await dialog.waitFor({ state: 'visible' });
  const openData = await snapshot(page, `${width}x${height}-02-sheet-open`);
  assert(openData.dialog?.label === 'Choose product category', 'category sheet dialog is unnamed');
  assert(openData.dialog.height <= height - 48 + 1, 'category sheet exceeds reserved dismiss area');
  assert(openData.scrollWidth <= width, 'sheet creates horizontal overflow');

  const categoryButtons = await dialog.locator('[role="button"]').evaluateAll((buttons) =>
    buttons.map((button) => {
      const rect = button.getBoundingClientRect();
      return {
        label: button.getAttribute('aria-label') || button.textContent?.replace(/\s+/g, ' ').trim(),
        width: rect.width,
        height: rect.height,
      };
    }),
  );
  const visibleCategoryButtons = categoryButtons.filter((button) =>
    button.label?.startsWith('Category, '),
  );
  assert(visibleCategoryButtons.length >= 3, 'category sheet did not expose category rows');
  assert(
    visibleCategoryButtons.every((button) => button.height >= 48),
    `category row below 48px: ${JSON.stringify(visibleCategoryButtons)}`,
  );

  const other = page.getByLabel('Category, Something else');
  await other.scrollIntoViewIfNeeded();
  const scrolledData = await snapshot(page, `${width}x${height}-03-sheet-scrolled`);
  assert(scrolledData.bodyText.includes('Something else'), 'lower category option is unreachable');
  await other.click();
  const selectedData = await snapshot(page, `${width}x${height}-04-other-selected`);
  assert(
    selectedData.visibleButtons.some((button) => button.label === 'Category, Other') ||
      selectedData.bodyText.includes('CATEGORY Other'),
    'selected category did not collapse to Other',
  );

  await page.getByRole('button', { name: 'Continue' }).click();
  await page.waitForURL(/\/shelf\/opened/);
  const openedData = await snapshot(page, `${width}x${height}-05-opened-step`);
  assert(openedData.url.includes('/shelf/opened'), 'Continue did not reach opened-date step');
  assert(openedData.scrollWidth <= width, 'opened-date step creates horizontal overflow');

  await context.close();
  return {
    viewport: { width, height },
    visibleCategoryButtons,
    logs,
  };
}

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROME_PATH || process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    headless: true,
  });
  try {
    const results = [];
    for (const viewport of [
      [320, 480],
      [320, 568],
    ]) {
      results.push(await runViewport(browser, viewport[0], viewport[1]));
    }
    writeJson('summary.json', {
      baseUrl,
      verdict: 'pass',
      results,
      disallowedLogs: results.flatMap((result) =>
        result.logs.filter((log) => {
          if (/Expo Web has limited support for notifications/i.test(log.text)) return false;
          if (/Listening to push token changes is not yet fully supported on web/i.test(log.text)) {
            return false;
          }
          if (/supabase.*placeholder|B-SUPABASE/i.test(log.text)) return false;
          return /error|warning|pageerror/i.test(log.type);
        }),
      ),
    });
    const summary = JSON.parse(fs.readFileSync(path.join(outDir, 'summary.json'), 'utf8'));
    assert(summary.disallowedLogs.length === 0, 'unexpected browser warnings/errors');
    fs.rmSync(path.join(outDir, 'failure.json'), { force: true });
  } finally {
    await browser.close();
  }
})().catch((error) => {
  writeJson('failure.json', { message: error.message, stack: error.stack });
  process.exit(1);
});
