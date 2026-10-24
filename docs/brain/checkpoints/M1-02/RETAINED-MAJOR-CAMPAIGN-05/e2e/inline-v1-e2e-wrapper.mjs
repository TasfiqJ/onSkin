import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const target = pathToFileURL(resolve('scripts/e2e/onboarding-first-session.mjs')).href;
const fragment = readFileSync(new URL('./e2e-fragment.txt', import.meta.url), 'utf8');
registerHooks({ load(url, context, nextLoad) {
  const result = nextLoad(url, context);
  if (url !== target) return result;
  const original = String(result.source);
  let source = original;
  const replace = (needle, replacement) => {
    if (source.split(needle).length !== 2) throw new Error('Driver anchor changed: ' + needle);
    source = source.replace(needle, replacement);
  };
  replace('async function screenshot(client, name) {', `async function screenshot(client, name) {
    if (!/^(R05-|FAILURE|CO-03|CO-09-b|CO-13)/.test(name)) return;`);
  replace('async function clickByText(client, label, { exact = true, timeoutMs = 30_000 } = {}) {', `async function clickByText(client, label, { exact = true, timeoutMs = 30_000 } = {}) {
    writeFileSync(path.join(evidenceDir, 'actions.jsonl'), JSON.stringify({ action: 'click', label }) + String.fromCharCode(10), { flag: 'a' });`);
  if (!process.argv.includes('--cross-owner')) replace('    let ageReverificationBefore = null;', fragment + '\n    let ageReverificationBefore = null;');
  else {
    replace("  await captureStep(client, 'CO-01-owner-a', { assertClean: false });", `  await captureStep(client, 'CO-01-owner-a', { assertClean: false });
      await navigateClientSide(client, '/you');
      await scrollTextIntoView(client, 'Local recovery', {exact:false});
      await clickByText(client, 'Local recovery', {exact:false});
      await waitForText(client, 'No pending cleanup');
      await captureStep(client, 'R05-CO-a-local-status', { assertClean: true });`);
    replace("if (key === 'layerwell.shelf.v1' && !state.readEntered) { state.readEntered = true; await readGate; }", "if (key === 'layerwell.shelf.v1' && (!state.readEntered || state.holdRecovery)) { state.readEntered = true; state.holdRecovery = false; await readGate; }");
    replace('state.release = () => { storage.getItem = originalGet;', 'state.release = () => { state.released = true; storage.getItem = originalGet;');
    replace("  await evaluate(\n    client,\n    `(() => { __LAYERWELL_E2E_ACCOUNT_EVENT__('b'); __LAYERWELL_E2E_ACCOUNT_EVENT__('b'); })()`,", `  await evaluate(client, '__crossOwnerRace.holdRecovery = true');
      await scrollTextIntoView(client, 'Check Shelf again');
      await clickByText(client, 'Check Shelf again');
      await captureStep(client, 'R05-CO-a-delayed-local-read', { assertClean: true });
      await evaluate(
    client,
    \`(() => { __LAYERWELL_E2E_ACCOUNT_EVENT__('b'); __LAYERWELL_E2E_ACCOUNT_EVENT__('b'); })()\`,`);
    replace("  const liveState = await inspect('CO-b-boundaries');", `  await navigateClientSide(client, '/you');
      await scrollTextIntoView(client, 'Local recovery', {exact:false});
      await clickByText(client, 'Local recovery', {exact:false});
      await waitForText(client, 'No pending cleanup');
      await captureStep(client, 'R05-CO-b-own-local-status', { assertClean: true });
      assert(!(await evaluate(client, 'document.body.innerText')).includes('late-owner-a'), 'Old A reached Recovery');
      await clickByText(client, 'Close local recovery');
      await navigateClientSide(client, '/you');
      const liveState = await inspect('CO-b-boundaries');`);
    replace("  await captureStep(client, 'CO-14-return-a-relaunch-closed');", `  await captureStep(client, 'CO-14-return-a-relaunch-closed');
      await navigateClientSide(client, '/you');
      await scrollTextIntoView(client, 'Local recovery', {exact:false});
      await clickByText(client, 'Local recovery', {exact:false});
      await waitForText(client, 'First, your');
      const refusedRecovery = await captureStep(client, 'R05-CO-return-a-recovery-closed', { assertClean: true });
      assert(!refusedRecovery.bodyText.includes('No pending cleanup'), 'Closed A saw local status');`);
  }
  process.once('exit', () => {
    writeFileSync(resolve(process.env.ONBOARDING_E2E_EVIDENCE_DIR, 'executed-driver.mjs'), source);
    writeFileSync(resolve(process.env.ONBOARDING_E2E_EVIDENCE_DIR, 'driver-binding.json'), JSON.stringify({
    originalSha256: createHash('sha256').update(original).digest('hex'),
    executedSha256: createHash('sha256').update(source).digest('hex'),
    changes: ['bounded screenshots and action trace', 'real local Recovery, reminder read retry and keyboard/offline flows', 'synthetic underlying IO delay during actual cross-owner reconciliation'],
  }, null, 2) + '\n');
  });
  return { ...result, source };
} });
