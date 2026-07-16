import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import { auditRevenueCatDeletionSourceContract } from './payments-source-contract.mjs';

const root = resolve(import.meta.dirname, '../..');
const sources = Object.freeze({
  entrypoint: readFileSync(resolve(root, 'supabase/functions/account-deletion/index.ts'), 'utf8'),
  runtime: readFileSync(
    resolve(root, 'supabase/functions/account-deletion/durableDeletionRuntime.ts'),
    'utf8',
  ),
  executor: readFileSync(
    resolve(root, 'supabase/functions/account-deletion/revenueCatV2DeletionExecutor.ts'),
    'utf8',
  ),
  providerDeletion: readFileSync(
    resolve(root, 'supabase/functions/account-deletion/durableProviderDeletion.ts'),
    'utf8',
  ),
});

function replaceSource(key, search, replacement) {
  const changed = sources[key].replace(search, replacement);
  assert.notEqual(changed, sources[key], `test mutation must change ${key}`);
  return { ...sources, [key]: changed };
}

test('accepts the active durable RevenueCat V2 deletion chain', () => {
  const result = auditRevenueCatDeletionSourceContract(sources);
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.errors));
});

test('rejects a disconnected account-deletion entrypoint', () => {
  const result = auditRevenueCatDeletionSourceContract(
    replaceSource('entrypoint', 'createDurableDeletionRuntime({ client, schedule })', 'undefined'),
  );
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /entrypoint/);
});

test('rejects a non-awaited durable runtime construction', () => {
  const result = auditRevenueCatDeletionSourceContract(
    replaceSource(
      'entrypoint',
      'const dependencies = await createDurableDeletionRuntime',
      'const dependencies = createDurableDeletionRuntime',
    ),
  );
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /entrypoint/);
});

test('rejects a handler factory imported from an unreviewed module', () => {
  const result = auditRevenueCatDeletionSourceContract(
    replaceSource(
      'entrypoint',
      "from './durableDeletionHttpHandler.ts';",
      "from './unreviewedHttpHandler.ts';",
    ),
  );
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /entrypoint/);
});

test('rejects a live HTTP callback disconnected from the durable handler', () => {
  const result = auditRevenueCatDeletionSourceContract(
    replaceSource('entrypoint', 'handler(request)', "new Response('disconnected')"),
  );
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /entrypoint/);
});

test('rejects a conditionally unreachable live HTTP server', () => {
  const result = auditRevenueCatDeletionSourceContract(
    replaceSource(
      'entrypoint',
      'Deno.serve((request) => stagingTrafficFreezeResponse() ?? handler(request));',
      'if (false) Deno.serve((request) => stagingTrafficFreezeResponse() ?? handler(request));',
    ),
  );
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /entrypoint/);
});

test('rejects drift in the entrypoint configuration guard', () => {
  const result = auditRevenueCatDeletionSourceContract(
    replaceSource(
      'entrypoint',
      'if (!/^https:\\/\\/[a-z0-9.-]+$/i.test(supabaseUrl)) {',
      'if (supabaseUrl === supabaseUrl) {',
    ),
  );
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /entrypoint/);
});

test('rejects a commented entrypoint decoy after the live call is disconnected', () => {
  const activeCall = 'createDurableDeletionRuntime({ client, schedule })';
  const changed = replaceSource('entrypoint', activeCall, 'undefined');
  const result = auditRevenueCatDeletionSourceContract({
    ...changed,
    entrypoint: `${changed.entrypoint}\n// ${activeCall}`,
  });
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /entrypoint/);
});

test('rejects a string entrypoint decoy after the live call is disconnected', () => {
  const activeCall = 'createDurableDeletionRuntime({ client, schedule })';
  const changed = replaceSource('entrypoint', activeCall, 'undefined');
  const result = auditRevenueCatDeletionSourceContract({
    ...changed,
    entrypoint: `${changed.entrypoint}\nconst decoy = ${JSON.stringify(activeCall)};`,
  });
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /entrypoint/);
});

test('rejects a disconnected RevenueCat work lane', () => {
  const result = auditRevenueCatDeletionSourceContract(
    replaceSource(
      'runtime',
      'revenuecat_delete: revenueCatExecutor',
      'revenuecat_delete: undefined',
    ),
  );
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /work lane/);
});

test('rejects a durable worker disconnected from the reviewed executor map', () => {
  const result = auditRevenueCatDeletionSourceContract(
    replaceSource('runtime', '      executors,', '      executors: {},'),
  );
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /work lane/);
});

test('rejects a no-op RevenueCat mutation reservation adapter', () => {
  const result = auditRevenueCatDeletionSourceContract(
    replaceSource(
      'runtime',
      "reserveMutation: () => acquireRevenueCatProviderBudget('customer-information')",
      'reserveMutation: () => Promise.resolve()',
    ),
  );
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /work lane/);
});

test('rejects a synthetic RevenueCat provider network adapter', () => {
  const result = auditRevenueCatDeletionSourceContract(
    replaceSource(
      'runtime',
      'return await revenueCatProviderNetwork.execute(request, context);',
      'return await Promise.resolve({ status: 204, body: null });',
    ),
  );
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /work lane/);
});

test('rejects a synthetic durable request-start adapter', () => {
  const result = auditRevenueCatDeletionSourceContract(
    replaceSource(
      'runtime',
      'return { requestStartedAt: await gateway.markRequestStarted(claim) };',
      'return { requestStartedAt: new Date().toISOString() };',
    ),
  );
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /work lane/);
});

test('rejects a duplicate property that overrides the durable request-start adapter', () => {
  const result = auditRevenueCatDeletionSourceContract(
    replaceSource(
      'runtime',
      '      recordAbsenceObservation(claim) {',
      "      markRequestStarted: async () => ({ requestStartedAt: 'synthetic' }),\n      recordAbsenceObservation(claim) {",
    ),
  );
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /work lane/);
});

test('rejects a provider quota adapter that bypasses the durable budget decision', () => {
  const result = auditRevenueCatDeletionSourceContract(
    replaceSource(
      'runtime',
      'allowed = await gateway.consumeRevenueCatProviderBudget(revenueCatProviderBudgetKey, domain);',
      'allowed = true;',
    ),
  );
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /work lane/);
});

test('rejects a provider quota decision that defaults open', () => {
  const result = auditRevenueCatDeletionSourceContract(
    replaceSource('runtime', 'let allowed = false;', 'let allowed = true;'),
  );
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /work lane/);
});

test('rejects a provider quota catch block that fails open', () => {
  const result = auditRevenueCatDeletionSourceContract(
    replaceSource(
      'runtime',
      '    } catch {\n      // A missing distributed quota decision',
      '    } catch {\n      allowed = true;\n      // A missing distributed quota decision',
    ),
  );
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /work lane/);
});

test('rejects any extra runtime use of the configured V2 secret', () => {
  const result = auditRevenueCatDeletionSourceContract(
    replaceSource(
      'runtime',
      '  const revenueCatProviderBudgetKey = await deriveRevenueCatV2CredentialBinding(',
      '  console.log(revenueCatSecret);\n  const revenueCatProviderBudgetKey = await deriveRevenueCatV2CredentialBinding(',
    ),
  );
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /work lane/);
});

test('rejects a second direct read of the configured V2 secret', () => {
  const result = auditRevenueCatDeletionSourceContract(
    replaceSource(
      'runtime',
      '  const revenueCatProviderBudgetKey = await deriveRevenueCatV2CredentialBinding(',
      "  console.log(readEnvironment('REVENUECAT_V2_SECRET_API_KEY'));\n  const revenueCatProviderBudgetKey = await deriveRevenueCatV2CredentialBinding(",
    ),
  );
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /work lane/);
});

test('rejects a no-op encrypted RevenueCat state persistence adapter', () => {
  const result = auditRevenueCatDeletionSourceContract(
    replaceSource(
      'runtime',
      "persist: (claim, plaintext) => encryptedState.persist(claim, 'revenuecat_delete', plaintext)",
      'persist: async () => {}',
    ),
  );
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /work lane/);
});

test('rejects a synthetic RevenueCat identity-barrier adapter', () => {
  const result = auditRevenueCatDeletionSourceContract(
    replaceSource(
      'runtime',
      '      async establishIdentityBarrier(claim, snapshot) {',
      '      async establishIdentityBarrier(claim, snapshot) {\n        return { established: true, tombstoneVersion: 1, identityCount: 1 };',
    ),
  );
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /work lane/);
});

test('rejects a legacy key substituted for the required V2 deletion key', () => {
  const result = auditRevenueCatDeletionSourceContract(
    replaceSource('runtime', "'REVENUECAT_V2_SECRET_API_KEY'", "'REVENUECAT_SECRET_API_KEY'"),
  );
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /work lane/);
});

test('rejects an executor that bypasses the attested delete builder', () => {
  const result = auditRevenueCatDeletionSourceContract(
    replaceSource(
      'executor',
      'const request = buildRevenueCatV2DeleteRequest({',
      'const request = unreviewedDeleteRequest({',
    ),
  );
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /dispatch/);
});

test('rejects a same-name delete-builder shadow inside the dispatch scope', () => {
  const result = auditRevenueCatDeletionSourceContract(
    replaceSource(
      'executor',
      '  const request = buildRevenueCatV2DeleteRequest({',
      '  const buildRevenueCatV2DeleteRequest = () => ({}) as never;\n  const request = buildRevenueCatV2DeleteRequest({',
    ),
  );
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /dispatch/);
});

test('rejects an executor that skips the durable pre-dispatch boundary', () => {
  const result = auditRevenueCatDeletionSourceContract(
    replaceSource(
      'executor',
      'await options.network.reserveMutation({ deadlineAtMs: context.deadlineAtMs });',
      'await Promise.resolve();',
    ),
  );
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /dispatch/);
});

test('rejects an executor that does not await the durable request-start marker', () => {
  const result = auditRevenueCatDeletionSourceContract(
    replaceSource(
      'executor',
      'const started = await options.gateway.markRequestStarted(claim);',
      'const started = options.gateway.markRequestStarted(claim);',
    ),
  );
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /dispatch/);
});

test('rejects an executor that does not await the RevenueCat DELETE response', () => {
  const result = auditRevenueCatDeletionSourceContract(
    replaceSource(
      'executor',
      'const response = await executeNetwork(options, request, context, budget, true);',
      'const response = executeNetwork(options, request, context, budget, true);',
    ),
  );
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /dispatch/);
});

test('rejects a non-awaited identity barrier before RevenueCat dispatch', () => {
  const result = auditRevenueCatDeletionSourceContract(
    replaceSource(
      'executor',
      '  await establishIdentityBarrier(options, claim, {\n    version: 1,\n    projectId: ready.preflightEvidence.projectId,',
      '  void establishIdentityBarrier(options, claim, {\n    version: 1,\n    projectId: ready.preflightEvidence.projectId,',
    ),
  );
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /dispatch/);
});

test('rejects a non-awaited transition to durable reconciliation', () => {
  const result = auditRevenueCatDeletionSourceContract(
    replaceSource(
      'executor',
      '  await persistAndTransitionToReconciliation(\n    options,\n    claim,',
      '  void persistAndTransitionToReconciliation(\n    options,\n    claim,',
    ),
  );
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /dispatch/);
});

test('rejects a factory disconnected from RevenueCat deletion execution', () => {
  const result = auditRevenueCatDeletionSourceContract(
    replaceSource(
      'executor',
      '    await executeRevenueCatV2Deletion(resolved, claim, context);',
      '    return;',
    ),
  );
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /dispatch/);
});

test('rejects a request-budget guard that always permits dispatch', () => {
  const result = auditRevenueCatDeletionSourceContract(
    replaceSource(
      'executor',
      '  return budget.used < options.maxRequests && hasDeadlineReserve(options, context);',
      '  return true;',
    ),
  );
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /dispatch/);
});

test('rejects a deadline-reserve guard that always permits dispatch', () => {
  const result = auditRevenueCatDeletionSourceContract(
    replaceSource(
      'executor',
      '  return checkedNow(options.clock) + options.deadlineReserveMs < context.deadlineAtMs;',
      '  return true;',
    ),
  );
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /dispatch/);
});

test('rejects removal of the pre-reservation budget guard return', () => {
  const result = auditRevenueCatDeletionSourceContract(
    replaceSource(
      'executor',
      '  if (!canRequest(options, context, budget)) {\n    await budgetRetry(options, claim, ready);\n    return;\n  }\n  const request = buildRevenueCatV2DeleteRequest({',
      '  if (!canRequest(options, context, budget)) {\n    await budgetRetry(options, claim, ready);\n  }\n  const request = buildRevenueCatV2DeleteRequest({',
    ),
  );
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /dispatch/);
});

test('rejects removal of the post-reservation budget guard return', () => {
  const result = auditRevenueCatDeletionSourceContract(
    replaceSource(
      'executor',
      '  if (!canRequest(options, context, budget)) {\n    await budgetRetry(options, claim, ready);\n    return;\n  }\n  const started = await options.gateway.markRequestStarted(claim);',
      '  if (!canRequest(options, context, budget)) {\n    await budgetRetry(options, claim, ready);\n  }\n  const started = await options.gateway.markRequestStarted(claim);',
    ),
  );
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /dispatch/);
});

test('rejects a non-throwing invalid request-start response guard', () => {
  const result = auditRevenueCatDeletionSourceContract(
    replaceSource(
      'executor',
      "    throw new RevenueCatV2DeletionExecutorError('REVENUECAT_V2_EXECUTOR_RESPONSE_INVALID');\n  }\n\n  let disposition;",
      '    return;\n  }\n\n  let disposition;',
    ),
  );
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /dispatch/);
});

test('rejects a catch path that swallows provider-capacity exhaustion', () => {
  const result = auditRevenueCatDeletionSourceContract(
    replaceSource(
      'executor',
      "  } catch (error) {\n    if (error instanceof AccountDeletionWorkerCapacityError) throw error;\n    disposition = classifyRevenueCatV2TransportFailure('after_request_started');",
      "  } catch (error) {\n    if (error instanceof AccountDeletionWorkerCapacityError) return;\n    disposition = classifyRevenueCatV2TransportFailure('after_request_started');",
    ),
  );
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /dispatch/);
});

test('rejects a dispatch finally block that suppresses durable reconciliation', () => {
  const result = auditRevenueCatDeletionSourceContract(
    replaceSource(
      'executor',
      "    disposition = classifyRevenueCatV2TransportFailure('after_request_started');\n  }\n\n  if (disposition.kind === 'action_required')",
      "    disposition = classifyRevenueCatV2TransportFailure('after_request_started');\n  } finally {\n    return;\n  }\n\n  if (disposition.kind === 'action_required')",
    ),
  );
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /dispatch/);
});

test('rejects a network helper that increments the request budget by the wrong amount', () => {
  const result = auditRevenueCatDeletionSourceContract(
    replaceSource('executor', '  budget.used += 1;', '  budget.used += 2;'),
  );
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /dispatch/);
});

test('rejects a network helper that retargets the authenticated request', () => {
  const result = auditRevenueCatDeletionSourceContract(
    replaceSource('executor', '  budget.used += 1;', "  request.url = 'https://example.com';"),
  );
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /dispatch/);
});

test('rejects an additional network dispatch before the durable reservation boundary', () => {
  const reserve =
    '  await options.network.reserveMutation({ deadlineAtMs: context.deadlineAtMs });';
  const result = auditRevenueCatDeletionSourceContract(
    replaceSource(
      'executor',
      reserve,
      `  await executeNetwork(options, request, context, budget, true);\n${reserve}`,
    ),
  );
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /dispatch/);
});

test('rejects an unreachable reviewed dispatch sequence', () => {
  const result = auditRevenueCatDeletionSourceContract(
    replaceSource(
      'executor',
      '  const request = buildRevenueCatV2DeleteRequest({',
      '  return;\n  const request = buildRevenueCatV2DeleteRequest({',
    ),
  );
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /dispatch/);
});

test('rejects a constant conditional return before the reviewed dispatch sequence', () => {
  const result = auditRevenueCatDeletionSourceContract(
    replaceSource(
      'executor',
      '  const request = buildRevenueCatV2DeleteRequest({',
      '  if (true) return;\n  const request = buildRevenueCatV2DeleteRequest({',
    ),
  );
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /dispatch/);
});

test('rejects mutation of the reviewed DELETE request before dispatch', () => {
  const reserve =
    '  await options.network.reserveMutation({ deadlineAtMs: context.deadlineAtMs });';
  const result = auditRevenueCatDeletionSourceContract(
    replaceSource('executor', reserve, `  request.init.method = 'POST';\n${reserve}`),
  );
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /dispatch/);
});

test('rejects RevenueCat API-origin drift', () => {
  const result = auditRevenueCatDeletionSourceContract(
    replaceSource(
      'providerDeletion',
      "const REVENUECAT_V2_API_BASE = 'https://api.revenuecat.com/v2';",
      "const REVENUECAT_V2_API_BASE = 'https://example.com/v2';",
    ),
  );
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /authenticated customer DELETE endpoint/);
});

test('reports missing provider declarations as contract errors instead of throwing', () => {
  const result = auditRevenueCatDeletionSourceContract(
    replaceSource(
      'providerDeletion',
      'const REVENUECAT_V2_API_BASE =',
      'const RENAMED_REVENUECAT_V2_API_BASE =',
    ),
  );
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /authenticated customer DELETE endpoint/);
});

test('rejects RevenueCat customer-path drift', () => {
  const result = auditRevenueCatDeletionSourceContract(
    replaceSource(
      'providerDeletion',
      '/customers/${encodeURIComponent(',
      '/subscribers/${encodeURIComponent(',
    ),
  );
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /authenticated customer DELETE endpoint/);
});

test('rejects a non-DELETE customer request', () => {
  const result = auditRevenueCatDeletionSourceContract(
    replaceSource('providerDeletion', "method: 'DELETE'", "method: 'POST'"),
  );
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /authenticated customer DELETE endpoint/);
});

test('rejects a duplicate method property that overrides DELETE', () => {
  const result = auditRevenueCatDeletionSourceContract(
    replaceSource(
      'providerDeletion',
      "      method: 'DELETE',",
      "      method: 'DELETE',\n      method: 'POST',",
    ),
  );
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /authenticated customer DELETE endpoint/);
});

test('rejects a RevenueCat V2 request without Bearer authentication', () => {
  const result = auditRevenueCatDeletionSourceContract(
    replaceSource(
      'providerDeletion',
      'Authorization: `Bearer ${secretApiKey}`',
      'Authorization: `${secretApiKey}`',
    ),
  );
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /authenticated customer DELETE endpoint/);
});

test('rejects mutation of the V2 secret binding inside the delete builder', () => {
  const path =
    '  const path = revenueCatV2CustomerPath(options.evidence.projectId, options.evidence.customerId);';
  const result = auditRevenueCatDeletionSourceContract(
    replaceSource('providerDeletion', path, `  options.secretApiKey = 'sk_unreviewed';\n${path}`),
  );
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /authenticated customer DELETE endpoint/);
});

test('rejects a weakened V2 delete-builder input guard', () => {
  const result = auditRevenueCatDeletionSourceContract(
    replaceSource('providerDeletion', '!isRecord(options) ||', 'options === options ||'),
  );
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /authenticated customer DELETE endpoint/);
});

test('rejects malformed source input', () => {
  assert.throws(
    () => auditRevenueCatDeletionSourceContract({ ...sources, unexpected: '' }),
    TypeError,
  );
});
