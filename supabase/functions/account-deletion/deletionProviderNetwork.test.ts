import {
  createDeletionProviderJsonNetwork,
  DeletionProviderNetworkError,
} from './deletionProviderNetwork.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test('provider network bounds timeout and returns measured JSON', async () => {
  const timeouts: number[] = [];
  const now = Date.parse('2026-07-13T12:00:00.000Z');
  const network = createDeletionProviderJsonNetwork({
    maxResponseBytes: 16_384,
    maxTimeoutMs: 5_000,
    now: () => now,
    fetcher(_input, _init, timeoutMs) {
      timeouts.push(timeoutMs);
      return Promise.resolve(
        new Response('{"ok":true}', {
          status: 200,
          headers: { 'retry-after': '120' },
        }),
      );
    },
  });
  const response = await network.sendJson(
    { url: 'https://example.test', init: { method: 'GET' } },
    { deadlineAtMs: now + 1_234, requestNumber: 1 },
  );
  assert(response.status === 200, 'status retained');
  assert((response.body as { ok: boolean }).ok, 'JSON parsed');
  assert(response.responseBytes === 11, 'raw bytes measured');
  assert(timeouts[0] === 1_234, 'deadline constrains timeout');
  const revenueCatResponse = await network.execute(
    { url: 'https://example.test', init: { method: 'GET' } },
    { deadlineAtMs: now + 5_000 },
  );
  assert(revenueCatResponse.retryAfterMs === 120_000, 'Retry-After seconds are bounded');
});

Deno.test('provider network contains malformed JSON and rejects oversized bodies', async () => {
  const now = Date.parse('2026-07-13T12:00:00.000Z');
  const malformed = createDeletionProviderJsonNetwork({
    maxResponseBytes: 1_024,
    maxTimeoutMs: 5_000,
    now: () => now,
    fetcher: () => Promise.resolve(new Response('not-json', { status: 502 })),
  });
  const response = await malformed.execute(
    { url: 'https://example.test', init: {} },
    { deadlineAtMs: now + 1_000 },
  );
  assert(response.body === null, 'classifier receives unattested body');

  const oversized = createDeletionProviderJsonNetwork({
    maxResponseBytes: 1_024,
    maxTimeoutMs: 5_000,
    now: () => now,
    fetcher: () => Promise.resolve(new Response('x'.repeat(1_025), { status: 200 })),
  });
  let code = '';
  try {
    await oversized.execute(
      { url: 'https://example.test', init: {} },
      { deadlineAtMs: now + 1_000 },
    );
  } catch (error) {
    code = error instanceof DeletionProviderNetworkError ? error.code : 'unexpected';
  }
  assert(code === 'DELETION_PROVIDER_NETWORK_FAILED', 'oversize contained');
});

Deno.test('provider network refuses calls after the worker deadline', async () => {
  const now = Date.parse('2026-07-13T12:00:00.000Z');
  let called = false;
  const network = createDeletionProviderJsonNetwork({
    maxResponseBytes: 1_024,
    maxTimeoutMs: 5_000,
    now: () => now,
    fetcher: () => {
      called = true;
      return Promise.resolve(new Response('{}'));
    },
  });
  let failed = false;
  try {
    await network.execute({ url: 'https://example.test', init: {} }, { deadlineAtMs: now });
  } catch {
    failed = true;
  }
  assert(failed, 'deadline fails closed');
  assert(!called, 'no network request after deadline');
});
