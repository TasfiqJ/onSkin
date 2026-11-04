import { randomUUID } from 'node:crypto';
import '@/features/shelf/firstValue26TestPorts';
import { describe, expect, it } from 'vitest';

import { decodePlanHistory45, PLAN_HISTORY45_MAX_BYTES } from './planHistory45';

function envelope() {
  return { schemaVersion: 1, ownerUserId: 'synthetic45-owner', versions: [{
    id: randomUUID() as string, sequence: 1, createdAt: '2026-11-03T12:00:00.000Z',
    sourceHash: 'a'.repeat(64), am: [{ productId: 'synthetic-product', name: 'Synthetic cleanser' }], pm: [],
  }] };
}

describe('Campaign45 strict immutable fact-only codec', () => {
  it('decodes only true absence as empty and freezes every exposed fact', () => {
    expect(decodePlanHistory45(null, 'synthetic45-owner').versions).toEqual([]);
    const result = decodePlanHistory45(JSON.stringify(envelope()), 'synthetic45-owner');
    for (const value of [result, result.versions, result.versions[0], result.versions[0]!.am,
      result.versions[0]!.am[0]]) expect(Object.isFrozen(value)).toBe(true);
    expect(Object.keys(result.versions[0]!)).toEqual(['id', 'sequence', 'createdAt', 'sourceHash', 'am', 'pm']);
  });

  for (const [label, mutate] of [
    ['future schema', (row: ReturnType<typeof envelope>) => { row.schemaVersion = 2; }],
    ['wrong owner', (row: ReturnType<typeof envelope>) => { row.ownerUserId = 'successor'; }],
    ['noncontiguous sequence', (row: ReturnType<typeof envelope>) => { row.versions[0]!.sequence = 2; }],
    ['fractional sequence', (row: ReturnType<typeof envelope>) => { row.versions[0]!.sequence = 1.5; }],
    ['invalid ID', (row: ReturnType<typeof envelope>) => { row.versions[0]!.id = 'not-an-immutable-uuid'; }],
    ['bad hash', (row: ReturnType<typeof envelope>) => { row.versions[0]!.sourceHash = 'A'.repeat(64); }],
    ['invalid calendar date', (row: ReturnType<typeof envelope>) => { row.versions[0]!.createdAt = '2026-02-30T12:00:00.000Z'; }],
    ['offset time', (row: ReturnType<typeof envelope>) => { row.versions[0]!.createdAt = '2026-11-03T12:00:00.000+00:00'; }],
    ['unbounded name', (row: ReturnType<typeof envelope>) => { row.versions[0]!.am[0]!.name = 'x'.repeat(201); }],
    ['control character', (row: ReturnType<typeof envelope>) => { row.versions[0]!.am[0]!.name = 'bad\nname'; }],
    ['unpaired surrogate', (row: ReturnType<typeof envelope>) => { row.versions[0]!.am[0]!.name = '\ud800'; }],
    ['unbounded product ID', (row: ReturnType<typeof envelope>) => { row.versions[0]!.am[0]!.productId = 'x'.repeat(129); }],
    ['duplicate product ID', (row: ReturnType<typeof envelope>) => { row.versions[0]!.am.push(row.versions[0]!.am[0]!); }],
    ['empty factual plan', (row: ReturnType<typeof envelope>) => { row.versions[0]!.am = []; }],
    ['unbounded period', (row: ReturnType<typeof envelope>) => { row.versions[0]!.am = Array.from({ length: 51 }, (_, index) => ({ productId: String(index), name: 'Synthetic' })); }],
  ] as const) {
    it(`refuses ${label}`, () => {
      const row = envelope(); mutate(row);
      expect(() => decodePlanHistory45(JSON.stringify(row), 'synthetic45-owner')).toThrow();
    });
  }

  for (const raw of ['', '{invalid', 'null', '[]', '{}', '{"schemaVersion":0}', ' '.repeat(PLAN_HISTORY45_MAX_BYTES + 1)]) {
    it(`refuses malformed/legacy or oversized bytes (length ${raw.length})`, () => {
      expect(() => decodePlanHistory45(raw, 'synthetic45-owner')).toThrow();
    });
  }

  it('refuses unknown advice/photo fields and invalid AM/PM types without normalization', () => {
    const row = envelope();
    for (const modified of [
      { ...row, advice: 'unsupported' },
      { ...row, versions: [{ ...row.versions[0], photo: 'private-file' }] },
      { ...row, versions: [{ ...row.versions[0], am: 'AM' }] },
      { ...row, versions: [{ ...row.versions[0], pm: null }] },
      { ...row, versions: [{ ...row.versions[0], am: [{ ...row.versions[0]!.am[0], conclusion: 'medical' }] }] },
    ]) expect(() => decodePlanHistory45(JSON.stringify(modified), 'synthetic45-owner')).toThrow();
  });

  it('rejects duplicate IDs, reordered records and over-capacity instead of dropping history', () => {
    const row = envelope();
    const first = row.versions[0]!;
    const second = { ...first, id: randomUUID(), sequence: 2 };
    for (const versions of [
      [first, { ...first, sequence: 2 }], [second, first],
      Array.from({ length: 101 }, (_, index) => ({ ...first, id: randomUUID(), sequence: index + 1 })),
    ]) expect(() => decodePlanHistory45(JSON.stringify({ ...row, versions }), 'synthetic45-owner')).toThrow();
  });

  it('retains factual Unicode names without introducing claims', () => {
    const row = envelope(); row.versions[0]!.am[0]!.name = 'í•©ì„± ì„¸ì•ˆì œ ðŸ§´';
    expect(decodePlanHistory45(JSON.stringify(row), row.ownerUserId).versions[0]!.am[0]!.name).toBe('í•©ì„± ì„¸ì•ˆì œ ðŸ§´');
  });
});
