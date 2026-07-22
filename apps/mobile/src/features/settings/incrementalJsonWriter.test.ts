import { describe, expect, it, vi } from 'vitest';

import {
  INCREMENTAL_JSON_VALUE_UNSUPPORTED,
  writePrettyJsonIncrementally,
} from './incrementalJsonWriter';

function combineBytes(chunks: readonly Uint8Array[]): string {
  const byteLength = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
  const combined = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(combined);
}

async function collectJson(value: unknown, maxChunkCodeUnits = 64 * 1024) {
  const chunks: Uint8Array[] = [];
  const assertCurrent = vi.fn();
  const yieldControl = vi.fn(async () => undefined);
  const result = await writePrettyJsonIncrementally(value, {
    assertCurrent,
    maxChunkCodeUnits,
    writeBytes: (bytes) => {
      chunks.push(bytes.slice());
    },
    yieldControl,
  });
  return { assertCurrent, chunks, result, text: combineBytes(chunks), yieldControl };
}

describe('incremental JSON writer', () => {
  it('matches the existing pretty JSON export byte for byte', async () => {
    const bundle = {
      mobile_export_schema_version: 1,
      exported_at: '2026-07-21T12:00:00.000Z',
      server_account_data_status: 'included',
      server_account_data: {
        export_schema_version: 2,
        user_id: 'user-1',
        sources: [{ source: 'profiles', rows: [{ goals: ['calm', 'hydrate'] }] }],
      },
      local_device_data: {
        schema_version: 1,
        sections: {
          shelf_and_routine: { shelf_products: [{ id: 'local-1', usage: null }] },
          progress: { photo_records: { records: [], photo_files_included: false } },
        },
        exclusions: [],
      },
      local_media_note: 'Photo files are excluded.',
    };

    const written = await collectJson(bundle, 37);

    expect(written.text).toBe(JSON.stringify(bundle, null, 2));
    expect(written.result.bytesWritten).toBe(new TextEncoder().encode(written.text).byteLength);
    expect(written.result.chunksWritten).toBe(written.chunks.length);
    expect(written.yieldControl).toHaveBeenCalledTimes(written.chunks.length);
  });

  it('matches well-formed JSON escaping across bounded Unicode chunks', async () => {
    const fixture = {
      empty: { array: [], object: {} },
      escaped: 'quote:" slash:\\ controls:\b\t\n\f\r\u0000\u001f',
      unicode: `skin-😀-e\u0301-${String.fromCharCode(0xd800)}-${String.fromCharCode(0xdc00)}`,
      arrayRules: [undefined, () => undefined, Symbol('omitted'), Number.NaN, Infinity, -Infinity],
      objectRules: { kept: true, omitted: undefined },
    };

    const written = await collectJson(fixture, 7);

    expect(written.text).toBe(JSON.stringify(fixture, null, 2));
    expect(JSON.parse(written.text)).toEqual(JSON.parse(JSON.stringify(fixture)));
    expect(written.chunks.every((chunk) => chunk.byteLength <= 21)).toBe(true);
  });

  it('keeps a large export bounded without emitting the complete artifact as one chunk', async () => {
    const fixture = {
      server_account_data: Array.from({ length: 34 }, (_, source) => ({
        source,
        rows: Array.from({ length: 40 }, (_, row) => ({
          row,
          value: `${'é😀'.repeat(80)}:${source}:${row}`,
        })),
      })),
      local_device_data: {
        sections: Array.from({ length: 48 }, (_, section) => ({
          section,
          notes: 'private-fixture-note'.repeat(120),
        })),
      },
    };

    const written = await collectJson(fixture, 1_024);
    const completeBytes = new TextEncoder().encode(JSON.stringify(fixture, null, 2));

    expect(written.text).toBe(new TextDecoder().decode(completeBytes));
    expect(written.chunks.length).toBeGreaterThan(20);
    expect(written.chunks.every((chunk) => chunk.byteLength <= 3_072)).toBe(true);
    expect(written.chunks.every((chunk) => chunk.byteLength < completeBytes.byteLength)).toBe(true);
  });

  it('stops after account invalidation at an injected yield', async () => {
    const chunks: Uint8Array[] = [];
    let current = true;
    const assertCurrent = vi.fn(() => {
      if (!current) throw new Error('ACCOUNT_GENERATION_CHANGED');
    });

    const writing = writePrettyJsonIncrementally(
      { server_account_data: 'x'.repeat(2_000), local_device_data: 'y'.repeat(2_000) },
      {
        assertCurrent,
        maxChunkCodeUnits: 64,
        writeBytes: (bytes) => {
          chunks.push(bytes.slice());
        },
        yieldControl: async () => {
          current = false;
        },
      },
    );

    await expect(writing).rejects.toThrow('ACCOUNT_GENERATION_CHANGED');
    expect(chunks).toHaveLength(1);
    expect(assertCurrent).toHaveBeenCalledTimes(4);
  });

  it('preserves the first sink failure and schedules no later writes', async () => {
    const failure = new Error('FILE_WRITE_FAILED');
    const writeBytes = vi.fn(() => {
      throw failure;
    });
    const yieldControl = vi.fn(async () => undefined);

    await expect(
      writePrettyJsonIncrementally(
        { server_account_data: 'x'.repeat(2_000) },
        {
          assertCurrent: () => undefined,
          maxChunkCodeUnits: 64,
          writeBytes,
          yieldControl,
        },
      ),
    ).rejects.toBe(failure);

    expect(writeBytes).toHaveBeenCalledOnce();
    expect(yieldControl).not.toHaveBeenCalled();
  });

  it.each([
    [
      'circular input',
      () => {
        const value: Record<string, unknown> = {};
        value.self = value;
        return value;
      },
    ],
    ['non-plain input', () => new Date('2026-07-21T12:00:00.000Z')],
    ['bigint input', () => ({ invalid: BigInt(1) })],
  ])('fails closed on %s with a content-free code', async (_label, createValue) => {
    const chunks: Uint8Array[] = [];

    await expect(
      writePrettyJsonIncrementally(createValue(), {
        assertCurrent: () => undefined,
        maxChunkCodeUnits: 16,
        writeBytes: (bytes) => {
          chunks.push(bytes.slice());
        },
        yieldControl: async () => undefined,
      }),
    ).rejects.toThrow(INCREMENTAL_JSON_VALUE_UNSUPPORTED);

    expect(chunks.map((chunk) => new TextDecoder().decode(chunk)).join('')).not.toContain(
      '2026-07-21',
    );
  });
});
