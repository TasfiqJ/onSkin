// Checkpoint-only extension of the unchanged repository CDP/Expo web driver.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const target = pathToFileURL(resolve('scripts/e2e/onboarding-first-session.mjs')).href;
const bindings = [];
process.once('exit', () => {
  mkdirSync(process.env.ONBOARDING_E2E_EVIDENCE_DIR, { recursive: true });
  writeFileSync(resolve(process.env.ONBOARDING_E2E_EVIDENCE_DIR, 'journey02-binding.json'),
    JSON.stringify(bindings, null, 2) + '\n');
});

const fragment = (name) => readFileSync(new URL(name + '.fragment.txt', import.meta.url), 'utf8');

registerHooks({
  load(url, context, nextLoad) {
    const result = nextLoad(url, context);
    if (url !== target) return result;
    const original = String(result.source);
    let source = original;
    function replace(needle, replacement) {
      if (source.split(needle).length !== 2) throw new Error('Unexpected harness anchor: ' + needle);
      source = source.replace(needle, replacement);
    }
    replace('async function screenshot(client, name) {', `async function screenshot(client, name) {
      if (!/^(J02-|FAILURE|01a-direct|04-consent|09-products-empty|19-today|M1-02-offline|M1-05-archive|M1-07-corruption|26-age|CO-03|CO-04|CO-07|CO-09|CO-12|CO-13)/.test(name)) return;`);
    replace('async function fillByLabel(client, label, value) {', `async function fillByLabel(client, label, value) {
      writeFileSync(path.join(evidenceDir, 'actions.jsonl'), JSON.stringify({ action: 'fill', label, value }) + '\\n', { flag: 'a' });`);
    replace('async function clickByText(client, label, { exact = true, timeoutMs = 30_000 } = {}) {', `async function clickByText(client, label, { exact = true, timeoutMs = 30_000 } = {}) {
      writeFileSync(path.join(evidenceDir, 'actions.jsonl'), JSON.stringify({ action: 'click', label }) + '\\n', { flag: 'a' });`);
    if (!process.argv.includes('--cross-owner')) {
    const next = "    await clickByText(client, index < answers.length - 1 ? 'Next' : 'See my profile');";
    replace(next, fragment('quiz-keyboard'));
    const ready = "  assert(manualReady.overflowX <= 1, 'Manual modal overflowed horizontally.');";
    replace(ready, ready + fragment('delayed-read'));
    const row = "  await captureStep(client, 'M1-02-offline-double-save');";
    replace(row, row + fragment('cache-observation'));
    const edit = "  await clickByText(client, 'Synthetic manual moisturizer', { exact: false });";
    replace(edit, edit + fragment('quick-opening'));
    }
    replace('function writeJson(name, value) {', `function writeJson(name, value) {
      if (name === 'summary.json') value = { ...value,
        driverRequestedEvidenceFiles: value.evidenceFiles,
        evidenceFiles: readdirSync(evidenceDir).filter(name => name.endsWith('.png')),
        screenshotSelection: 'Checkpoint wrapper retains a bounded selection; all UI snapshots and action logs remain.' };`);
    bindings.push({ original: target, originalSha256: createHash('sha256').update(original).digest('hex'),
      executedSha256: createHash('sha256').update(source).digest('hex'),
      changes: ['bounded screenshot selection', 'synthetic click/input trace', 'real keyboard repeat',
        'delayed actual Shelf background query before durable offline save; initial-read race covered by deterministic hook regressions', 'quick opening failure and retry'] });
    return { ...result, source };
  },
});
