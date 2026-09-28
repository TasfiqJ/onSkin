import assert from 'node:assert/strict';
import test from 'node:test';

import { Db06EvidenceError } from './staging-deployment-evidence-lib.mjs';
import { verifyStagingTrafficFreeze } from './staging-traffic-freeze-canary.mjs';

const projectRef = 'abcdefghijklmnopqrst';

function frozenResponse() {
  return new Response(JSON.stringify({ error: 'DB06_STAGING_TRAFFIC_FROZEN' }), {
    status: 503,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json',
    },
  });
}

test('traffic-freeze canary accepts only exact redacted frozen responses', async () => {
  const seen = [];
  const result = await verifyStagingTrafficFreeze({
    projectRef,
    functionSlugs: ['waitlist', 'growth-event'],
    fetchImpl: async (url, init) => {
      seen.push({ url, init });
      return frozenResponse();
    },
  });
  assert.equal(result.checkedFunctionCount, 2);
  assert.equal(result.allReturnedFrozenNoStore, true);
  assert.deepEqual(
    result.functions.map(({ slug }) => slug),
    ['growth-event', 'waitlist'],
  );
  assert.equal(
    seen.every(({ init }) => init.method === 'GET'),
    true,
  );
});

test('traffic-freeze canary fails closed on an open or malformed endpoint', async () => {
  await assert.rejects(
    verifyStagingTrafficFreeze({
      projectRef,
      functionSlugs: ['waitlist'],
      fetchImpl: async () => new Response('{"ok":true}', { status: 200 }),
    }),
    (error) =>
      error instanceof Db06EvidenceError && error.code === 'DB06_TRAFFIC_FREEZE_CANARY_NOT_FROZEN',
  );
  await assert.rejects(
    verifyStagingTrafficFreeze({
      projectRef,
      functionSlugs: ['waitlist'],
      fetchImpl: async () =>
        new Response('x'.repeat(5000), {
          status: 503,
          headers: { 'Cache-Control': 'no-store' },
        }),
    }),
    (error) =>
      error instanceof Db06EvidenceError &&
      error.code === 'DB06_TRAFFIC_FREEZE_CANARY_RESPONSE_INVALID',
  );
});
