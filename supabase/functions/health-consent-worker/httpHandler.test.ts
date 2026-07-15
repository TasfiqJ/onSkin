import { createHealthConsentWorkerHttpHandler } from './httpHandler.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const SECRET = 'b'.repeat(64);

function workRequest(secret = SECRET, body: unknown = { action: 'work' }): Request {
  return new Request('https://example.test', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-health-consent-worker-secret': secret,
    },
    body: JSON.stringify(body),
  });
}

function harness() {
  let runs = 0;
  const handler = createHealthConsentWorkerHttpHandler({
    workerSecret: SECRET,
    runWorker: async () => {
      runs += 1;
      return {
        claimed: 2,
        completed: 1,
        deferred: 1,
        actionRequired: 0,
        deadlineReached: false,
      };
    },
  });
  return { handler, runs: () => runs };
}

Deno.test('scheduler route accepts only POST with the dedicated exact secret', async () => {
  const { handler, runs } = harness();
  const missing = await handler(
    new Request('https://example.test', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'work' }),
    }),
  );
  assert(missing.status === 401, 'missing secret rejected');
  const wrong = await handler(workRequest(`${SECRET}0`));
  assert(wrong.status === 401, 'near-match secret rejected');
  const method = await handler(
    new Request('https://example.test', {
      method: 'GET',
      headers: { 'x-health-consent-worker-secret': SECRET },
    }),
  );
  assert(method.status === 405, 'non-POST method rejected');
  assert(runs() === 0, 'unauthorized/method probes issue no work');

  const invalidBody = await handler(workRequest(SECRET, { action: 'status' }));
  assert(invalidBody.status === 400, 'non-work action rejected');
  assert(runs() === 0, 'invalid work body issues no work');

  const oversized = await handler(
    workRequest(SECRET, { action: 'work', padding: 'x'.repeat(2_000) }),
  );
  assert(oversized.status === 413, 'oversized scheduler body rejected');
  assert(runs() === 0, 'oversized work body issues no work');

  const accepted = await handler(workRequest());
  const body = await accepted.json();
  assert(accepted.status === 200, 'authorized scheduler accepted');
  assert(body.status === 'worked' && body.completed === 1, 'sanitized report returned');
  assert(runs() === 1, 'one authorized run');
  assert(accepted.headers.get('Cache-Control')?.includes('no-store'), 'response is not cached');
});

Deno.test('scheduler route redacts worker failures', async () => {
  const handler = createHealthConsentWorkerHttpHandler({
    workerSecret: SECRET,
    runWorker: async () => {
      throw new Error('raw database detail');
    },
  });
  const response = await handler(workRequest());
  const text = await response.text();
  assert(response.status === 503, 'worker failure is unavailable');
  assert(!text.includes('database detail'), 'raw failure is redacted');
});

Deno.test('partial lane failure is retryable while preserving healthy-lane evidence', async () => {
  const handler = createHealthConsentWorkerHttpHandler({
    workerSecret: SECRET,
    runWorker: async () => ({
      claimed: 2,
      completed: 1,
      deferred: 0,
      actionRequired: 0,
      deadlineReached: false,
      partialFailure: true,
      failedLanes: ['dependent'],
    }),
  });
  const response = await handler(workRequest());
  const body = await response.json();
  assert(response.status === 503, 'partial privacy-lane failure must alert/retry');
  assert(response.headers.get('Retry-After') === '60', 'retry cadence must be explicit');
  assert(
    body.error === 'HEALTH_CONSENT_WORKER_PARTIAL_FAILURE' &&
      body.completed === 1 &&
      body.failedLanes?.[0] === 'dependent',
    'redacted response must retain healthy progress and failed-lane identity',
  );
});

Deno.test('scheduler handler rejects weak configuration before serving', () => {
  let rejected = false;
  try {
    createHealthConsentWorkerHttpHandler({
      workerSecret: 'weak',
      runWorker: async () => ({
        claimed: 0,
        completed: 0,
        deferred: 0,
        actionRequired: 0,
        deadlineReached: false,
      }),
    });
  } catch {
    rejected = true;
  }
  assert(rejected, 'weak scheduler secret must fail closed');
});
