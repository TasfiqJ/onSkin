import { fetchWithTimeout, readLimitedResponseText } from './fetch.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test('fetch timeout remains active while a response body stalls after headers', async () => {
  let aborted = false;
  const fakeFetch: typeof fetch = (_input, init) => {
    const signal = (init as { signal?: AbortSignal } | undefined)?.signal;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"partial":'));
        signal?.addEventListener(
          'abort',
          () => {
            aborted = true;
            controller.error(new DOMException('aborted', 'AbortError'));
          },
          { once: true },
        );
      },
    });
    return Promise.resolve(new Response(body, { status: 200 }));
  };

  const startedAt = performance.now();
  const response = await fetchWithTimeout(
    'https://example.test/stalled-body',
    {},
    25,
    fakeFetch,
  );
  let rejected = false;
  try {
    await readLimitedResponseText(response, 1_024);
  } catch (error) {
    rejected = error instanceof DOMException && error.name === 'AbortError';
  }
  const elapsedMs = performance.now() - startedAt;
  assert(rejected, 'stalled body read must reject with the abort boundary');
  assert(aborted, 'the same request signal remains live through body consumption');
  assert(elapsedMs < 500, 'body stall is bounded by the configured request timeout');
});

Deno.test('fetch timeout is cleared after a complete bounded body read', async () => {
  let aborted = false;
  const fakeFetch: typeof fetch = (_input, init) => {
    (init as { signal?: AbortSignal } | undefined)?.signal?.addEventListener('abort', () => {
      aborted = true;
    });
    return Promise.resolve(new Response('{"ok":true}', { status: 200 }));
  };
  const response = await fetchWithTimeout('https://example.test/complete', {}, 25, fakeFetch);
  assert((await readLimitedResponseText(response, 1_024)) === '{"ok":true}', 'body read');
  await new Promise((resolve) => setTimeout(resolve, 40));
  assert(!aborted, 'completed body clears its timer instead of aborting later');
});
