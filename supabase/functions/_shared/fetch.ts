import { intEnv } from './body.ts';

export function externalFetchTimeoutMs(): number {
  return intEnv('EDGE_EXTERNAL_FETCH_TIMEOUT_MS', 5000, 1000, 30000);
}

export function externalResponseMaxBytes(): number {
  return intEnv('EDGE_EXTERNAL_RESPONSE_MAX_BYTES', 262144, 1024, 1048576);
}

export async function fetchWithTimeout(
  input: string | URL | Request,
  init: RequestInit = {},
  timeoutMs = externalFetchTimeoutMs(),
): Promise<Response> {
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  if (init.signal?.aborted) {
    controller.abort();
  } else {
    init.signal?.addEventListener('abort', abortFromCaller, { once: true });
  }

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
    init.signal?.removeEventListener('abort', abortFromCaller);
  }
}

export async function readLimitedResponseTextWithByteLength(
  response: Response,
  maxBytes = externalResponseMaxBytes(),
): Promise<{ text: string; byteLength: number } | null> {
  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    await response.body?.cancel().catch(() => undefined);
    return null;
  }

  const reader = response.body?.getReader();
  if (!reader) return { text: '', byteLength: 0 };

  const chunks: Uint8Array[] = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return {
    text: new TextDecoder().decode(bytes),
    byteLength: received,
  };
}

export async function readLimitedResponseText(
  response: Response,
  maxBytes = externalResponseMaxBytes(),
): Promise<string | null> {
  const result = await readLimitedResponseTextWithByteLength(response, maxBytes);
  return result === null ? null : result.text;
}

export async function readLimitedResponseJson<T = Record<string, unknown>>(
  response: Response,
  maxBytes = externalResponseMaxBytes(),
): Promise<T | null> {
  const text = await readLimitedResponseText(response, maxBytes);
  if (text === null) return null;
  try {
    return JSON.parse(text || '{}') as T;
  } catch {
    return null;
  }
}
