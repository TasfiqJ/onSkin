import { describe, expect, it } from 'vitest';

import {
  decodePhotoStore,
  decodePhotoStoreItemsForExport,
  encodePhotoStore,
  MAX_PENDING_PHOTO_STORE_CHARS,
  MAX_PHOTO_RECORDS,
  MAX_PHOTO_STORE_CHARS,
  PHOTO_METADATA_INVALID,
  PHOTO_METADATA_UNSUPPORTED,
  PHOTO_MUTATION_RECOVERY_REQUIRED,
} from './photoStoreEnvelope';

const OPERATION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe('photo store envelope', () => {
  it('reads the legacy array without rewriting it', () => {
    const legacy = [{ id: 'legacy-photo', takenLocalDate: '2026-07-01' }];

    expect(decodePhotoStore(JSON.stringify(legacy))).toEqual({
      format: 'legacy',
      items: legacy,
      mutation: null,
      retainedItems: [],
    });
  });

  it('bounds legacy and V2 record counts before normalization', () => {
    const atLimit = Array.from({ length: MAX_PHOTO_RECORDS }, () => null);
    expect(decodePhotoStore(JSON.stringify(atLimit))).toMatchObject({
      format: 'legacy',
      items: atLimit,
    });
    expect(() => decodePhotoStore(JSON.stringify([...atLimit, null]))).toThrow(
      PHOTO_METADATA_INVALID,
    );

    expect(() => encodePhotoStore({ items: atLimit, mutation: null })).not.toThrow();
    expect(() => encodePhotoStore({ items: [...atLimit, null], mutation: null })).toThrow(
      PHOTO_METADATA_INVALID,
    );
  });

  it('accepts the raw character limit and rejects one character beyond it', () => {
    const base = JSON.stringify({ version: 2, items: [], mutation: null, retainedItems: [] });
    const atLimit = `${base}${' '.repeat(MAX_PHOTO_STORE_CHARS - base.length)}`;

    expect(atLimit).toHaveLength(MAX_PHOTO_STORE_CHARS);
    expect(decodePhotoStore(atLimit)).toMatchObject({ format: 'v2', items: [] });
    expect(() => decodePhotoStore(`${atLimit} `)).toThrow(PHOTO_METADATA_INVALID);
  });

  it('refuses to encode an envelope beyond the raw character limit', () => {
    const emptyPayload = { payload: '' };
    const baseLength = JSON.stringify({
      version: 2,
      items: [emptyPayload],
      mutation: null,
      retainedItems: [],
    }).length;
    const atLimitPayload = 'x'.repeat(MAX_PHOTO_STORE_CHARS - baseLength);

    expect(encodePhotoStore({ items: [{ payload: atLimitPayload }], mutation: null })).toHaveLength(
      MAX_PHOTO_STORE_CHARS,
    );
    expect(() =>
      encodePhotoStore({ items: [{ payload: `${atLimitPayload}x` }], mutation: null }),
    ).toThrow(PHOTO_METADATA_INVALID);
  });

  it.each(['delete', 'clear'] as const)(
    'lets a maximum settled store carry bounded %s recovery overhead and settle',
    (kind) => {
      const emptyRecord = { id: 'photo-at-limit', payload: '' };
      const settledBase = JSON.stringify({
        version: 2,
        items: [emptyRecord],
        mutation: null,
        retainedItems: [],
      });
      const record = {
        ...emptyRecord,
        payload: 'x'.repeat(MAX_PHOTO_STORE_CHARS - settledBase.length),
      };
      const settled = encodePhotoStore({ items: [record], mutation: null });
      const pending = encodePhotoStore({
        items: [],
        mutation: { kind, operationId: OPERATION_ID, phase: 'prepared' },
        retainedItems: [record],
      });

      expect(settled).toHaveLength(MAX_PHOTO_STORE_CHARS);
      expect(pending.length).toBeGreaterThan(MAX_PHOTO_STORE_CHARS);
      expect(pending.length).toBeLessThanOrEqual(MAX_PENDING_PHOTO_STORE_CHARS);
      expect(decodePhotoStore(pending)).toMatchObject({
        mutation: { kind, operationId: OPERATION_ID, phase: 'prepared' },
        retainedItems: [record],
      });
      expect(encodePhotoStore({ items: [], mutation: null }).length).toBeLessThan(
        MAX_PHOTO_STORE_CHARS,
      );
    },
  );

  it('keeps oversized legacy arrays and add journals outside the recovery-overhead allowance', () => {
    const legacyBase = JSON.stringify([{ payload: '' }]);
    const oversizedLegacy = JSON.stringify([
      { payload: 'x'.repeat(MAX_PHOTO_STORE_CHARS + 1 - legacyBase.length) },
    ]);
    expect(oversizedLegacy).toHaveLength(MAX_PHOTO_STORE_CHARS + 1);
    expect(() => decodePhotoStore(oversizedLegacy)).toThrow(PHOTO_METADATA_INVALID);

    const emptyAdd = {
      version: 2,
      items: [{ payload: '' }],
      mutation: { kind: 'add', operationId: OPERATION_ID, phase: 'prepared' },
      retainedItems: [],
    };
    const emptyAddLength = JSON.stringify(emptyAdd).length;
    const oversizedAdd = JSON.stringify({
      ...emptyAdd,
      items: [{ payload: 'x'.repeat(MAX_PHOTO_STORE_CHARS + 1 - emptyAddLength) }],
    });
    expect(oversizedAdd).toHaveLength(MAX_PHOTO_STORE_CHARS + 1);
    expect(() => decodePhotoStore(oversizedAdd)).toThrow(PHOTO_METADATA_INVALID);
    expect(() =>
      encodePhotoStore({
        items: [
          {
            payload: 'x'.repeat(MAX_PHOTO_STORE_CHARS + 1 - emptyAddLength),
          },
        ],
        mutation: { kind: 'add', operationId: OPERATION_ID, phase: 'prepared' },
        retainedItems: [],
      }),
    ).toThrow(PHOTO_METADATA_INVALID);
  });

  it('rejects pending journals whose eventual settled authority cannot fit', () => {
    const settledBase = JSON.stringify({
      version: 2,
      items: [{ payload: '' }],
      mutation: null,
      retainedItems: [],
    });
    const oversizedItems = [
      { payload: 'x'.repeat(MAX_PHOTO_STORE_CHARS + 1 - settledBase.length) },
    ];
    const unrecoverableDelete = JSON.stringify({
      version: 2,
      items: oversizedItems,
      mutation: { kind: 'delete', operationId: OPERATION_ID, phase: 'prepared' },
      retainedItems: [],
    });

    expect(unrecoverableDelete.length).toBeGreaterThan(MAX_PHOTO_STORE_CHARS);
    expect(unrecoverableDelete.length).toBeLessThanOrEqual(MAX_PENDING_PHOTO_STORE_CHARS);
    expect(() => decodePhotoStore(unrecoverableDelete)).toThrow(PHOTO_METADATA_INVALID);
    expect(() =>
      encodePhotoStore({
        items: oversizedItems,
        mutation: { kind: 'delete', operationId: OPERATION_ID, phase: 'prepared' },
        retainedItems: [],
      }),
    ).toThrow(PHOTO_METADATA_INVALID);
    expect(() =>
      encodePhotoStore({
        items: [{ id: 'clear-must-not-retain-current-items' }],
        mutation: { kind: 'clear', operationId: OPERATION_ID, phase: 'prepared' },
        retainedItems: [],
      }),
    ).toThrow(PHOTO_METADATA_INVALID);
  });

  it('round-trips a strict V2 envelope with a content-free journal', () => {
    const raw = encodePhotoStore({
      items: [{ id: OPERATION_ID, localUri: 'file://private/photo.onskinphoto' }],
      mutation: { kind: 'add', operationId: OPERATION_ID, phase: 'prepared' },
      retainedItems: [],
    });
    const decoded = decodePhotoStore(raw);

    expect(decoded).toMatchObject({
      format: 'v2',
      mutation: { kind: 'add', operationId: OPERATION_ID, phase: 'prepared' },
      retainedItems: [],
    });
    expect(JSON.stringify(decoded.mutation)).not.toContain('file://');
    expect(JSON.stringify(decoded.mutation)).not.toContain('takenLocalDate');
    expect(JSON.stringify(decoded.mutation)).not.toContain('captureSessionId');
    expect(JSON.stringify(decoded.mutation)).not.toContain('notes');
  });

  it('distinguishes a recognizable future envelope from malformed data', () => {
    expect(() =>
      decodePhotoStore(
        JSON.stringify({ version: 3, items: [], mutation: null, retainedItems: [] }),
      ),
    ).toThrow(PHOTO_METADATA_UNSUPPORTED);
    expect(() =>
      decodePhotoStore(JSON.stringify({ version: 3, futureShape: { records: [] } })),
    ).toThrow(PHOTO_METADATA_UNSUPPORTED);
  });

  it.each([
    { version: 2, items: [], mutation: null, retainedItems: [], extra: true },
    {
      version: 2,
      items: [],
      mutation: { kind: 'add', operationId: OPERATION_ID, phase: 'prepared', uri: 'file://x' },
      retainedItems: [],
    },
    {
      version: 2,
      items: [],
      mutation: { kind: 'add', operationId: '../photo', phase: 'prepared' },
      retainedItems: [],
    },
    { version: 2, items: [], mutation: null, retainedItems: [{ id: 'hidden' }] },
  ])('rejects malformed, future, or non-schema envelope state', (value) => {
    expect(() => decodePhotoStore(JSON.stringify(value))).toThrow(PHOTO_METADATA_INVALID);
  });

  it('refuses to encode retained authority without a pending mutation', () => {
    expect(() =>
      encodePhotoStore({
        items: [],
        mutation: null,
        retainedItems: [{ id: 'cannot-hide-this-record' }],
      } as never),
    ).toThrow(PHOTO_METADATA_INVALID);
  });

  it('exports legacy and settled V2 items but fails closed on staged metadata', () => {
    const items = [{ id: 'photo-1' }];
    expect(decodePhotoStoreItemsForExport(JSON.stringify(items))).toEqual(items);
    expect(
      decodePhotoStoreItemsForExport(
        encodePhotoStore({ items, mutation: null, retainedItems: [] }),
      ),
    ).toEqual(items);
    expect(() =>
      decodePhotoStoreItemsForExport(
        encodePhotoStore({
          items,
          mutation: { kind: 'delete', operationId: OPERATION_ID, phase: 'prepared' },
          retainedItems: [{ id: 'photo-2' }],
        }),
      ),
    ).toThrow(PHOTO_MUTATION_RECOVERY_REQUIRED);
  });
});
