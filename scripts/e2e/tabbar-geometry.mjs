import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const today = new Date().toISOString().slice(0, 10);
const evidenceDir =
  process.env.TABBAR_E2E_EVIDENCE_DIR ??
  path.join(repoRoot, 'test-results', 'human-e2e', today, 'navigation-native-tabbar-current');
const onboardingScript = path.join(repoRoot, 'scripts', 'e2e', 'onboarding-first-session.mjs');
const viewports = [
  { name: '320x568', width: 320, height: 568 },
  { name: '360x640', width: 360, height: 640 },
  { name: '375x667', width: 375, height: 667 },
  { name: '390x844', width: 390, height: 844 },
  { name: '412x915', width: 412, height: 915 },
  { name: '430x932', width: 430, height: 932 },
];
const expectedTabs = ['Today', 'Progress', 'Shelf', 'You'];

mkdirSync(evidenceDir, { recursive: true });

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function runOnboarding(viewport, index) {
  const viewportEvidenceDir = path.join(evidenceDir, viewport.name);
  mkdirSync(viewportEvidenceDir, { recursive: true });
  const appPort = 19840 + index;
  const debugPort = 19940 + index;

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [onboardingScript], {
      cwd: repoRoot,
      env: {
        ...process.env,
        ONBOARDING_E2E_DEBUG_PORT: String(debugPort),
        ONBOARDING_E2E_EVIDENCE_DIR: viewportEvidenceDir,
        ONBOARDING_E2E_PORT: String(appPort),
        ONBOARDING_E2E_VIEWPORT_HEIGHT: String(viewport.height),
        ONBOARDING_E2E_VIEWPORT_WIDTH: String(viewport.width),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let output = '';
    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.once('error', reject);
    child.once('exit', (code) => {
      writeFileSync(path.join(viewportEvidenceDir, 'runner.log'), output);
      if (code === 0) resolve(viewportEvidenceDir);
      else
        reject(
          new Error(
            `${viewport.name} onboarding/tab run failed (${code}).\n${output.slice(-4000)}`,
          ),
        );
    });
  });
}

function validateTabSnapshot(snapshot, viewport, expectedSelected) {
  assert(snapshot.overflowX <= 1, `${viewport.name} ${expectedSelected} has horizontal overflow.`);
  const tabs = snapshot.controls.filter((control) => control.role === 'tab');
  assert(tabs.length === 4, `${viewport.name} ${expectedSelected} did not expose four tabs.`);
  for (const label of expectedTabs) {
    const tab = tabs.find((control) => control.label.includes(label));
    assert(tab, `${viewport.name} is missing the ${label} tab.`);
    assert(tab.width >= 44 && tab.height >= 44, `${viewport.name} ${label} is below 44px.`);
  }
  const selectedTabs = tabs.filter((control) => control.selected);
  assert(selectedTabs.length === 1, `${viewport.name} must expose exactly one selected tab.`);
  assert(
    selectedTabs[0].label.includes(expectedSelected),
    `${viewport.name} selected ${selectedTabs[0].label}, expected ${expectedSelected}.`,
  );
}

async function run() {
  const summary = { generatedAt: new Date().toISOString(), status: 'pass', viewports: [] };
  try {
    for (const [index, viewport] of viewports.entries()) {
      const folder = await runOnboarding(viewport, index);
      const onboardingSummary = readJson(path.join(folder, 'summary.json'));
      assert(onboardingSummary.verdict === 'pass', `${viewport.name} onboarding did not pass.`);
      assert(
        onboardingSummary.routeCheck?.keyTabRoundTripPassed === true,
        `${viewport.name} did not complete the tab round trip.`,
      );
      const steps = [
        ['19-today-free-current.json', 'Today'],
        ['20-shelf-after-onboarding.json', 'Shelf'],
        ['21-progress-after-onboarding.json', 'Progress'],
        ['22-you-after-onboarding.json', 'You'],
        ['23-today-after-tab-round-trip.json', 'Today'],
      ];
      for (const [file, selected] of steps) {
        const target = path.join(folder, file);
        assert(existsSync(target), `${viewport.name} is missing ${file}.`);
        validateTabSnapshot(readJson(target), viewport, selected);
      }
      summary.viewports.push({ ...viewport, evidenceDir: folder, status: 'pass' });
    }
    writeFileSync(path.join(evidenceDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
    console.log(`Native tab bar geometry E2E passed. Evidence: ${evidenceDir}`);
  } catch (error) {
    summary.status = 'fail';
    summary.error = error instanceof Error ? error.message : String(error);
    writeFileSync(path.join(evidenceDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
    throw error;
  }
}

await run();
