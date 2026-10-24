// Additive checkpoint wrapper. The repository driver and production fixtures stay unchanged.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const target = pathToFileURL(resolve('scripts/e2e/onboarding-first-session.mjs')).href;
const fragment = readFileSync(new URL('./notification-race.fragment.txt', import.meta.url), 'utf8');
registerHooks({
  load(url, context, nextLoad) {
    const result = nextLoad(url, context);
    if (url !== target) return result;
    const original = String(result.source);
    let source = original;
    const replace = (needle, replacement) => {
      if (source.split(needle).length !== 2) throw new Error('Unexpected driver anchor: ' + needle);
      source = source.replace(needle, replacement);
    };
    replace('async function screenshot(client, name) {', `async function screenshot(client, name) {
      if (!/^(R03-|FAILURE|01a-direct|04-consent|09-products-empty|19-today|21-progress|M102-04a|M102-09|26-age|CO-03|CO-04|CO-09|CO-13)/.test(name)) return;`);
    replace('async function clickByText(client, label, { exact = true, timeoutMs = 30_000 } = {}) {', `async function clickByText(client, label, { exact = true, timeoutMs = 30_000 } = {}) {
      writeFileSync(path.join(evidenceDir, 'actions.jsonl'), JSON.stringify({ action: 'touch', label }) + '\\n', { flag: 'a' });`);
    if (!process.argv.includes('--cross-owner')) replace('    let ageReverificationBefore = null;', fragment + '\n    let ageReverificationBefore = null;');
    replace('function writeJson(name, value) {', `function writeJson(name, value) {
      if (name === 'summary.json') value = { ...value,
        driverRequestedEvidenceFiles: value.evidenceFiles,
        evidenceFiles: readdirSync(evidenceDir).filter(name => name.endsWith('.png')),
        screenshotSelection: 'Bounded checkpoint selection; full UI snapshots retained.' };`);
    process.once('exit', () => {
    mkdirSync(process.env.ONBOARDING_E2E_EVIDENCE_DIR, { recursive: true });
    writeFileSync(resolve(process.env.ONBOARDING_E2E_EVIDENCE_DIR, 'driver-binding.json'), JSON.stringify({
      original: target, originalSha256: createHash('sha256').update(original).digest('hex'),
      executedSha256: createHash('sha256').update(source).digest('hex'),
      changes: ['bounded screenshots', 'touch trace', 'synthetic unavailable permission and offline saved-preference read race/retry/reload'],
    }, null, 2) + '\n');
    });
    return { ...result, source };
  },
});
