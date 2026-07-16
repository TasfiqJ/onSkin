export class BoundedResponseBodyError extends Error {
  constructor(code) {
    super(code);
    this.name = 'BoundedResponseBodyError';
    this.code = code;
  }
}

export async function readBoundedResponseBody(response, { maxBytes, abortController }) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0 || !abortController) {
    throw new BoundedResponseBodyError('BOUNDED_RESPONSE_OPTIONS_INVALID');
  }
  const declaredLength = Number.parseInt(response.headers.get('content-length') ?? '0', 10);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    abortController.abort();
    await response.body?.cancel().catch(() => {});
    throw new BoundedResponseBodyError('BOUNDED_RESPONSE_TOO_LARGE');
  }
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        abortController.abort();
        await reader.cancel().catch(() => {});
        throw new BoundedResponseBodyError('BOUNDED_RESPONSE_TOO_LARGE');
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, totalBytes);
}
