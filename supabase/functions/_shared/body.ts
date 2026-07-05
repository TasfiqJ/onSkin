export function intEnv(name: string, fallback: number, min: number, max: number): number {
  const value = Number(Deno.env.get(name));
  if (!Number.isInteger(value) || value < min || value > max) return fallback;
  return value;
}

export function userEdgeBodyMaxBytes(): number {
  return intEnv('USER_EDGE_BODY_MAX_BYTES', 16384, 1024, 65536);
}

export function contentLengthTooLarge(req: Request, maxBytes: number): boolean {
  const contentLength = Number(req.headers.get('content-length'));
  return Number.isFinite(contentLength) && contentLength > maxBytes;
}

export async function readLimitedText(req: Request, maxBytes: number): Promise<string | null> {
  const reader = req.body?.getReader();
  if (!reader) return '';

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
  return new TextDecoder().decode(bytes);
}

export async function readLimitedJson(
  req: Request,
  maxBytes: number,
  makeResponse: (body: unknown, status?: number) => Response,
  badJsonBody: unknown,
): Promise<unknown | Response> {
  const raw = await readLimitedText(req, maxBytes);
  if (raw === null) return makeResponse({ error: 'payload_too_large' }, 413);
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return makeResponse(badJsonBody, 400);
  }
}
