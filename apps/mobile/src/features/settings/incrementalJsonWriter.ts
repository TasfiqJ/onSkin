export const INCREMENTAL_JSON_MAX_CHUNK_CODE_UNITS = 64 * 1024;
export const INCREMENTAL_JSON_MAX_CHUNK_UTF8_BYTES = INCREMENTAL_JSON_MAX_CHUNK_CODE_UNITS * 3;
export const INCREMENTAL_JSON_VALUE_UNSUPPORTED = 'INCREMENTAL_JSON_VALUE_UNSUPPORTED';

type IncrementalJsonWriterDependencies = Readonly<{
  writeBytes: (bytes: Uint8Array) => void | Promise<void>;
  assertCurrent: () => void;
  yieldControl: () => Promise<void>;
  maxChunkCodeUnits?: number;
}>;

export type IncrementalJsonWriteResult = Readonly<{
  chunksWritten: number;
  bytesWritten: number;
}>;

function unsupportedValue(): never {
  throw new Error(INCREMENTAL_JSON_VALUE_UNSUPPORTED);
}

function isPlainRecord(value: object): value is Record<string, unknown> {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isHighSurrogate(code: number): boolean {
  return code >= 0xd800 && code <= 0xdbff;
}

function isLowSurrogate(code: number): boolean {
  return code >= 0xdc00 && code <= 0xdfff;
}

function hexEscape(code: number): string {
  return `\\u${code.toString(16).padStart(4, '0')}`;
}

function escapedStringToken(
  value: string,
  index: number,
): Readonly<{
  nextIndex: number;
  token: string;
}> {
  const code = value.charCodeAt(index);
  if (code === 0x22) return { token: '\\"', nextIndex: index + 1 };
  if (code === 0x5c) return { token: '\\\\', nextIndex: index + 1 };
  if (code === 0x08) return { token: '\\b', nextIndex: index + 1 };
  if (code === 0x09) return { token: '\\t', nextIndex: index + 1 };
  if (code === 0x0a) return { token: '\\n', nextIndex: index + 1 };
  if (code === 0x0c) return { token: '\\f', nextIndex: index + 1 };
  if (code === 0x0d) return { token: '\\r', nextIndex: index + 1 };
  if (code < 0x20) return { token: hexEscape(code), nextIndex: index + 1 };
  if (isHighSurrogate(code)) {
    const nextCode = index + 1 < value.length ? value.charCodeAt(index + 1) : -1;
    if (isLowSurrogate(nextCode)) {
      return { token: value.slice(index, index + 2), nextIndex: index + 2 };
    }
    return { token: hexEscape(code), nextIndex: index + 1 };
  }
  if (isLowSurrogate(code)) return { token: hexEscape(code), nextIndex: index + 1 };
  return { token: value[index]!, nextIndex: index + 1 };
}

function objectPropertyIsOmitted(value: unknown): boolean {
  return value === undefined || typeof value === 'function' || typeof value === 'symbol';
}

/**
 * Writes the JSON-safe value with the exact two-space formatting used by
 * `JSON.stringify(value, null, 2)` without ever assembling the complete JSON
 * string. Production export inputs are parsed JSON or plain local-export
 * records; non-plain objects and cycles fail closed.
 */
export async function writePrettyJsonIncrementally(
  value: unknown,
  dependencies: IncrementalJsonWriterDependencies,
): Promise<IncrementalJsonWriteResult> {
  const maxChunkCodeUnits = dependencies.maxChunkCodeUnits ?? INCREMENTAL_JSON_MAX_CHUNK_CODE_UNITS;
  if (
    !Number.isSafeInteger(maxChunkCodeUnits) ||
    maxChunkCodeUnits < 2 ||
    maxChunkCodeUnits > INCREMENTAL_JSON_MAX_CHUNK_CODE_UNITS
  ) {
    return unsupportedValue();
  }

  const encoder = new TextEncoder();
  const activeContainers = new Set<object>();
  let buffer = '';
  let chunksWritten = 0;
  let bytesWritten = 0;

  async function flush(): Promise<void> {
    if (buffer.length === 0) return;
    const chunk = buffer;
    buffer = '';
    dependencies.assertCurrent();
    const bytes = encoder.encode(chunk);
    if (bytes.byteLength > maxChunkCodeUnits * 3) return unsupportedValue();
    await dependencies.writeBytes(bytes);
    dependencies.assertCurrent();
    chunksWritten += 1;
    bytesWritten += bytes.byteLength;
    await dependencies.yieldControl();
    dependencies.assertCurrent();
  }

  async function append(text: string): Promise<void> {
    let offset = 0;
    while (offset < text.length) {
      if (buffer.length === maxChunkCodeUnits) await flush();
      const available = maxChunkCodeUnits - buffer.length;
      let end = Math.min(text.length, offset + available);
      if (
        end < text.length &&
        end > offset &&
        isHighSurrogate(text.charCodeAt(end - 1)) &&
        isLowSurrogate(text.charCodeAt(end))
      ) {
        end -= 1;
      }
      if (end === offset) {
        await flush();
        continue;
      }
      buffer += text.slice(offset, end);
      offset = end;
    }
  }

  async function appendIndent(depth: number): Promise<void> {
    await append('  '.repeat(depth));
  }

  async function appendJsonString(text: string): Promise<void> {
    await append('"');
    let fragment = '';
    let index = 0;
    while (index < text.length) {
      const escaped = escapedStringToken(text, index);
      if (fragment.length + escaped.token.length > 4_096) {
        await append(fragment);
        fragment = '';
      }
      fragment += escaped.token;
      index = escaped.nextIndex;
    }
    if (fragment.length > 0) await append(fragment);
    await append('"');
  }

  async function appendValue(current: unknown, depth: number, arraySlot: boolean): Promise<void> {
    if (current === null) {
      await append('null');
      return;
    }
    if (typeof current === 'string') {
      await appendJsonString(current);
      return;
    }
    if (typeof current === 'boolean') {
      await append(current ? 'true' : 'false');
      return;
    }
    if (typeof current === 'number') {
      await append(Number.isFinite(current) ? String(current) : 'null');
      return;
    }
    if (objectPropertyIsOmitted(current)) {
      if (arraySlot) {
        await append('null');
        return;
      }
      return unsupportedValue();
    }
    if (typeof current !== 'object' || !current) return unsupportedValue();
    if (activeContainers.has(current)) return unsupportedValue();
    activeContainers.add(current);
    try {
      if (Array.isArray(current)) {
        await append('[');
        for (let index = 0; index < current.length; index += 1) {
          await append(index === 0 ? '\n' : ',\n');
          await appendIndent(depth + 1);
          await appendValue(current[index], depth + 1, true);
        }
        if (current.length > 0) {
          await append('\n');
          await appendIndent(depth);
        }
        await append(']');
        return;
      }
      if (!isPlainRecord(current)) return unsupportedValue();

      await append('{');
      let wroteProperty = false;
      for (const key of Object.keys(current)) {
        const child = current[key];
        if (objectPropertyIsOmitted(child)) continue;
        await append(wroteProperty ? ',\n' : '\n');
        wroteProperty = true;
        await appendIndent(depth + 1);
        await appendJsonString(key);
        await append(': ');
        await appendValue(child, depth + 1, false);
      }
      if (wroteProperty) {
        await append('\n');
        await appendIndent(depth);
      }
      await append('}');
    } finally {
      activeContainers.delete(current);
    }
  }

  dependencies.assertCurrent();
  await appendValue(value, 0, false);
  await flush();
  dependencies.assertCurrent();
  return { chunksWritten, bytesWritten };
}
