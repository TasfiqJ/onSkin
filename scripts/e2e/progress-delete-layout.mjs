import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import * as browser from './cat04-catalog-recovery-audit.mjs';
import {
  installNativePhotoLayoutFixture,
  measureProgressLayout,
} from './progress-delete-layout-fixture.mjs';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
export const VIEWPORTS = [
  [360, 640],
  [375, 667],
  [390, 844],
];
export const EMPTY_STATUSES = ['local', 'remote', 'none', 'unavailable'];
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const atTop = `Array.from(document.querySelectorAll('*')).forEach(node => {
  if (node.scrollHeight > node.clientHeight && /auto|scroll/.test(getComputedStyle(node).overflowY)) node.scrollTop = 0;
})`;

export function assertReachableControl(snapshot, label) {
  assert.equal(snapshot.horizontalOverflow, 0, 'Horizontal overflow');
  assert.ok(snapshot.dock, 'Real floating tab bar must be mounted');
  const matches = snapshot.controls.filter(
    (control) => control.label === label || control.text === label,
  );
  assert.equal(matches.length, 1, `Expected exactly one ${label}`);
  const control = matches[0];
  assert.ok(control.fullyVisible, `${label} is clipped, off-viewport or behind the dock`);
  assert.ok(control.centerHittable, `${label} fails document.elementFromPoint at its center`);
  assert.ok(control.aboveDock, `${label} overlaps the floating tab bar`);
  assert.ok(control.touchTarget, `${label} is smaller than 44 x 44`);
  return control;
}

async function tapMeasured(client, control) {
  const { x, y, width, height } = control.rect;
  // Deliberately no scrollIntoView: these coordinates were measured at the
  // default scroll position, including ancestor clipping and dock occlusion.
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ id: 1, x: x + width / 2, y: y + height / 2, radiusX: 2, radiusY: 2, force: 1 }],
  });
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await delay(350);
}

export async function runProgressDeleteLayout({ evidenceDir, comparisonDir = null }) {
  assert.ok(evidenceDir, '--evidence directory is required');
  evidenceDir = path.resolve(evidenceDir);
  assert.ok(
    !existsSync(path.join(evidenceDir, 'summary.json')),
    'Refusing to overwrite existing acceptance evidence',
  );
  mkdirSync(evidenceDir, { recursive: true });
  const appPort = await browser.findAvailablePort(8470);
  const debugPort = await browser.findAvailablePort(9470);
  const baseUrl = `http://localhost:${appPort}`;
  const profile = mkdtempSync(path.join(tmpdir(), 'onskin-progress-layout-'));
  const summary = {
    sourceGitSha: execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: repoRoot,
      encoding: 'utf8',
    }).trim(),
    sourceFiles: Object.fromEntries(
      [
        'apps/mobile/src/app/(tabs)/progress.tsx',
        'apps/mobile/src/features/photos/PhotoDeleteSyncStatus.tsx',
        'apps/mobile/src/features/photos/photoDeleteRemoteCleanup.ts',
        'apps/mobile/src/app/progress/[id].tsx',
        'apps/mobile/src/lib/consent/healthDataWriteAdmission.ts',
        'scripts/e2e/progress-delete-layout.mjs',
        'scripts/e2e/progress-delete-layout-fixture.mjs',
      ].map((file) => [file, hash(readFileSync(path.join(repoRoot, file)))]),
    ),
    surface: 'actual Expo web app; local development fixture; native I/O simulated',
    startedAt: new Date().toISOString(),
    bootstrap: [],
    scenarios: [],
    pageErrors: [],
    dialogs: [],
    verdict: 'fail',
  };
  let server, chrome, client;
  const json = (name, value) =>
    writeFileSync(path.join(evidenceDir, name), JSON.stringify(value, null, 2) + '\n');
  const snapshot = async (name) => {
    const result = await browser.evaluate(client, `(${measureProgressLayout.toString()})()`);
    json(name + '.json', result);
    const image = await client.send('Page.captureScreenshot', {
      captureBeyondViewport: false,
      format: 'png',
    });
    writeFileSync(path.join(evidenceDir, name + '.png'), Buffer.from(image.data, 'base64'));
    return result;
  };
  const settle = async () => {
    await delay(700);
    await browser.evaluate(client, atTop);
    await delay(500);
    await browser.waitForCondition(
      client,
      `location.pathname === '/progress' && !document.body.innerText.includes('Your timeline could not open.') && !document.body.innerText.includes('Opening your private timeline...')`,
      15000,
      'authoritative Progress source',
    );
  };
  try {
    server = browser.startExpoServer({
      appPort,
      evidenceDir,
      group: {
        id: 'progress-delete-layout',
        env: {
          EXPO_PUBLIC_E2E_FIRST_SESSION_AUTH: 'anonymous_owner',
          EXPO_PUBLIC_E2E_ENTITLEMENT: 'store_pro',
        },
      },
    });
    chrome = spawn(
      browser.findBrowserPath(),
      [
        '--headless=new',
        `--remote-debugging-port=${debugPort}`,
        `--user-data-dir=${profile}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-background-networking',
        '--disable-extensions',
        '--disable-sync',
        '--hide-scrollbars',
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
        'about:blank',
      ],
      { stdio: 'ignore', windowsHide: true },
    );
    await browser.waitForUrl(baseUrl);
    client = await browser.connectToPage(debugPort, baseUrl);
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('Log.enable');
    await client.send('Network.enable');
    await client.send('Page.bringToFront');
    await browser.setViewport(client, { width: 390, height: 844 });
    await client.send('Page.navigate', { url: baseUrl + '/progress' });
    await browser.waitForPath(client, '/onboarding/age', 60000);
    summary.bootstrap.push({
      step: 'protected Progress entry rejected without age receipt',
      path: await browser.evaluate(client, 'location.pathname'),
    });
    await snapshot('bootstrap-01-age-required');
    await client.send('Page.navigate', { url: baseUrl + '/?e2eReset=local' });
    await browser.waitForText(client, 'Begin', 60000);
    summary.bootstrap.push(
      await browser.evaluate(
        client,
        `(${installNativePhotoLayoutFixture.toString()})({ portsOnly: true })`,
        true,
      ),
    );
    await browser.clickByText(client, 'Begin');
    await browser.waitForPath(client, '/onboarding/age');
    await browser.fillByLabel(client, 'Day of birth', '01');
    await browser.fillByLabel(client, 'Month of birth', '01');
    await browser.fillByLabel(client, 'Year of birth', '1990');
    await snapshot('bootstrap-02-visible-age-input');
    await browser.clickByText(client, 'Continue');
    await browser.waitForPath(client, '/onboarding/consent');
    await snapshot('bootstrap-03-visible-health-consent');
    await browser.clickByText(client, 'I agree. Continue');
    await browser.waitForPath(client, '/onboarding/goals');
    await browser.waitForText(client, 'What brings you here?');
    await delay(2500);
    summary.bootstrap.push({
      step: 'real eligible age and explicit health-consent submission; goals activation mounted',
      path: await browser.evaluate(client, 'location.pathname'),
    });
    await snapshot('bootstrap-04-goals-activation');
    await client.send('Page.navigate', { url: baseUrl + '/progress' });
    await browser.waitForPath(client, '/progress');
    await delay(2000);
    const installed = await browser.evaluate(
      client,
      `(${installNativePhotoLayoutFixture.toString()})()`,
      true,
    );
    summary.bootstrap.push(installed);

    for (const [width, height] of VIEWPORTS) {
      await browser.setViewport(client, { width, height });
      for (const status of EMPTY_STATUSES) {
        const id = `empty-${status}-${width}x${height}`;
        const seed = await browser.evaluate(
          client,
          `__C08B2_LAYOUT_FIXTURE__.seed(${JSON.stringify(status)})`,
          true,
        );
        await settle();
        if (status === 'unavailable') await browser.waitForText(client, 'Check again');
        const measured = await snapshot(id);
        assert.deepEqual(measured.viewport, { width, height });
        assert.equal(
          measured.alerts.length,
          status === 'local' || status === 'unavailable' ? 1 : 0,
          'Exactly one attention/unavailable alert, no competing status',
        );
        if (measured.alerts.length) assert.equal(measured.alerts[0].live, 'polite');
        assert.equal(measured.progressIndicators, 0, 'No duplicate progress indicators');
        if (status === 'none')
          assert.equal(
            measured.controls.filter((control) =>
              /Try deletion again|Check again/.test(control.label),
            ).length,
            0,
            'No previous fixture obligation may leak into empty/none state',
          );
        const capture = assertReachableControl(measured, 'Take my first photo');
        assert.equal(measured.partialControls.length, 0, `${id}: partially visible control`);
        const row = {
          id,
          seed,
          viewport: measured.viewport,
          capture,
          retry: null,
          retryActivated: false,
          captureActivated: false,
        };
        if (status !== 'none') {
          const label = status === 'unavailable' ? 'Check again' : 'Try deletion again';
          row.retry = assertReachableControl(measured, label);
          const before = await browser.evaluate(
            client,
            `({manual:__C08B2_LAYOUT_FIXTURE__.io.manualRetries,reads:__C08B2_LAYOUT_FIXTURE__.io.statusReads})`,
          );
          if (status === 'unavailable')
            await browser.evaluate(client, '__C08B2_LAYOUT_FIXTURE__.io.statusUnavailable = false');
          await tapMeasured(client, row.retry);
          await browser.waitForCondition(
            client,
            status === 'unavailable'
              ? `__C08B2_LAYOUT_FIXTURE__.io.statusReads > ${before.reads}`
              : `__C08B2_LAYOUT_FIXTURE__.io.manualRetries > ${before.manual}`,
            10000,
            'real deletion recovery handler',
          );
          row.retryActivated = true;
          await settle();
          await snapshot(id + '-after-recovery-action');
        }
        const afterRetry = await snapshot(id + '-before-capture-action');
        await tapMeasured(client, assertReachableControl(afterRetry, 'Take my first photo'));
        await browser.waitForPath(client, '/progress/capture');
        row.captureActivated = true;
        row.capturePath = await browser.evaluate(client, 'location.pathname');
        await snapshot(id + '-capture-destination');
        await browser.evaluate(client, 'history.back()');
        await browser.waitForPath(client, '/progress');
        await settle();
        summary.scenarios.push(row);
        console.log(JSON.stringify({ id, passed: true }));
      }
      await browser.evaluate(client, `__C08B2_LAYOUT_FIXTURE__.seed('none',true)`, true);
      await settle();
      for (const mode of ['Compare', 'Timeline']) {
        await browser.clickByText(client, mode);
        await settle();
        const id = `populated-${mode.toLowerCase()}-${width}x${height}`;
        const measured = await snapshot(id);
        const capture = assertReachableControl(measured, 'Take a progress photo');
        assert.equal(measured.partialControls.length, 0, 'Populated layout has a partial control');
        assertReachableControl(measured, 'Compare');
        assertReachableControl(measured, 'Timeline');
        assert.equal(
          measured.controls.filter((control) => control.text === 'Take my first photo').length,
          0,
        );
        const row = { id, viewport: measured.viewport, capture, priorGeometryEqual: null };
        if (comparisonDir) {
          const prior = JSON.parse(readFileSync(path.join(comparisonDir, id + '.json')));
          const controls = (view) =>
            view.controls
              .filter((control) => !control.inDock)
              .map(({ label, rect }) => ({ label, rect }));
          assert.deepEqual(
            controls(measured),
            controls(prior),
            `${id}: populated geometry changed`,
          );
          row.priorGeometryEqual = true;
        }
        summary.scenarios.push(row);
        console.log(JSON.stringify({ id, passed: true }));
      }
    }
    summary.pageErrors = client.events
      .filter((event) => event.method === 'Runtime.exceptionThrown')
      .map((event) => event.params.exceptionDetails);
    summary.dialogs = client.events
      .filter((event) => event.method === 'Page.javascriptDialogOpening')
      .map((event) => event.params);
    summary.console = client.events
      .filter((event) => event.method === 'Runtime.consoleAPICalled')
      .map((event) => ({
        level: event.params.type,
        text: event.params.args.map((arg) => arg.value ?? arg.description ?? '').join(' '),
      }));
    assert.equal(summary.pageErrors.length, 0, 'Unhandled browser exception');
    assert.equal(summary.dialogs.length, 0, 'JavaScript dialog');
    assert.equal(summary.scenarios.length, 18);
    summary.verdict = 'pass';
  } catch (error) {
    summary.error = error instanceof Error ? error.stack : String(error);
    if (client) await snapshot('failure').catch(() => undefined);
    throw error;
  } finally {
    summary.completedAt = new Date().toISOString();
    json('summary.json', summary);
    client?.close();
    await browser.stopProcessBestEffort(chrome);
    await browser.stopProcessBestEffort(server);
    // Only this runner's own mkdtemp-created browser profile is eligible.
    if (profile.startsWith(path.join(tmpdir(), 'onskin-progress-layout-'))) {
      try {
        rmSync(profile, { force: true, recursive: true, maxRetries: 3, retryDelay: 200 });
      } catch {
        /* A locked temporary profile is not acceptance evidence. */
      }
    }
  }
  return summary;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argument = (name) => {
    const index = process.argv.indexOf(name);
    return index === -1 ? null : process.argv[index + 1];
  };
  await runProgressDeleteLayout({
    evidenceDir: argument('--evidence'),
    comparisonDir: argument('--comparison'),
  });
}
