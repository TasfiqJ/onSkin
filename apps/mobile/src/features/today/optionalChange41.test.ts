import * as digest from '@noble/hashes/sha256';
import { describe, expect, it, vi } from 'vitest';

import {
  createOptionalChangeEvent41, hashOptionalChange41, OPTIONAL_CHANGE41_INVALID,
  optionalChangeDate41, sameOptionalChangeInput41, validateOptionalChangeEvent41,
  validateOptionalChangeInput41, type OptionalChangeInput41,
} from './optionalChange41';
import { appendOptionalChangeEnvelope41, decodeOptionalChangeEnvelope41 } from './optionalChangeJournal41';

type DigestModule46 = typeof import('@noble/hashes/sha256');

vi.mock('@noble/hashes/sha256', async (importOriginal) => {
  const original = await importOriginal<DigestModule46>();
  return { ...original, sha256: Object.assign(vi.fn(original.sha256), original.sha256) };
});

const DAY = '2026-07-08';
const ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const NOW = '2026-07-08T16:00:00.000Z';
function input(patch: Partial<OptionalChangeInput41> = {}): OptionalChangeInput41 {
  return { id: ID, expectedRevision: 0, expectedSourceProof: hashOptionalChange41(null),
    expectedSourceBytes: null, observedOn: DAY, category: 'personal_note', text: 'Used my usual cleanser.',
    kind: 'note', targetEventId: null, confirmation: true, ...patch };
}

describe('optional factual owner events', () => {
  it('creates a frozen owner report with separate observed/recorded times and a complete content hash', () => {
    const event = createOptionalChangeEvent41(input({ observedOn: '2026-07-01' }), 'owner-a', NOW);
    expect(event).toMatchObject({ id: ID, ownerUserId: 'owner-a', observedOn: '2026-07-01', recordedAt: NOW,
      actor: 'owner', basis: 'owner_reported', revision: 1, expectedRevision: 0 });
    expect(Object.isFrozen(event)).toBe(true);
    const { contentHash, ...body } = event;
    expect(contentHash).toBe(hashOptionalChange41(body));
    expect(() => validateOptionalChangeEvent41(event)).not.toThrow();
  });
  it('requires an affirmative save for an explicit empty no-change statement', () => {
    expect(() => validateOptionalChangeInput41(input({ category: 'no_change', text: '' }), DAY)).not.toThrow();
    for (const patch of [{ confirmation: false }, { category: 'personal_note', text: '' },
      { category: 'no_change', text: 'other' }]) {
      expect(() => validateOptionalChangeInput41(input(patch as Partial<OptionalChangeInput41>), DAY)).toThrow();
    }
  });
  it.each(['2026-02-30', '2026-2-03', '0000-01-01', '2026-07-09', '2026-07-08 ', 'not-date'])(
    'rejects invalid/future/noncanonical observed dates: %s', (observedOn) => {
      expect(() => validateOptionalChangeInput41(input({ observedOn }), DAY)).toThrow();
    },
  );
  it('accepts leap dates and ordinary multilingual factual text', () => {
    expect(optionalChangeDate41('2024-02-29')).toBe(true);
    expect(() => validateOptionalChangeInput41(input({ text: 'Crème utilisée. বাংলা 日本語 😀\nPersonal observation.' }), DAY)).not.toThrow();
  });
  it.each(['x'.repeat(2001), '  ', '\u0000private', 'hidden\u202etext', 'x\ud800', 'x\u007f', 'x\u200b', 'x\u2028'])(
    'rejects oversized, invisible-control, surrogate and empty text', (text) => {
      expect(() => validateOptionalChangeInput41(input({ text }), DAY)).toThrow(OPTIONAL_CHANGE41_INVALID);
    },
  );
  it.each(['bad', '2026-02-30T16:00:00.000Z', '2026-07-08', '2026-07-08T16:00:00Z'])(
    'rejects invalid/noncanonical recorded timestamps', (recordedAt) => {
      expect(() => createOptionalChangeEvent41(input(), 'owner-a', recordedAt)).toThrow();
    },
  );
  it('rejects changed full content even when a caller substitutes the original hash', () => {
    const original = createOptionalChangeEvent41(input(), 'owner-a', NOW);
    const substituted = { ...original, text: 'A different factual report.' };
    expect(() => validateOptionalChangeEvent41(substituted)).toThrow();
    expect(sameOptionalChangeInput41(original, input({ text: substituted.text }))).toBe(false);
  });
  it('forced digest collisions cannot substitute a duplicate event or a changed source', () => {
    // This is an intentionally broken hash port, not an assertion about finding
    // a SHA-256 collision. Full bytes/factual equality must independently hold.
    const hash = vi.mocked(digest.sha256);
    const realHash = hash.getMockImplementation()!;
    hash.mockReturnValue(new Uint8Array(32));
    try {
      const requested = input();
      const raw = appendOptionalChangeEnvelope41(null, null, requested, 'owner-a', NOW, DAY);
      const envelope = decodeOptionalChangeEnvelope41(JSON.parse(raw) as unknown, 'owner-a');
      expect(() => appendOptionalChangeEnvelope41(raw, envelope, { ...requested, text: 'Substituted report' }, 'owner-a', NOW, DAY)).toThrow();
      const changed = JSON.stringify({ ...envelope, completionBytes: '{}' });
      const next = input({ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', expectedRevision: 1,
        expectedSourceBytes: raw, expectedSourceProof: hashOptionalChange41(raw) });
      expect(() => appendOptionalChangeEnvelope41(changed, decodeOptionalChangeEnvelope41(JSON.parse(changed) as unknown, 'owner-a'), next, 'owner-a', NOW, DAY)).toThrow();
    } finally { hash.mockImplementation(realHash); }
  });
  it('validates stable IDs, explicit expected revision, provenance and exact field inventory', () => {
    for (const patch of [{ id: 'NOT-ID' }, { expectedRevision: -1 }, { expectedRevision: 0.5 },
      { kind: 'correction', targetEventId: null }, { targetEventId: ID }, { extra: 'ignored' }]) {
      expect(() => validateOptionalChangeInput41({ ...input(), ...patch } as OptionalChangeInput41, DAY)).toThrow();
    }
    const original = createOptionalChangeEvent41(input(), 'owner-a', NOW);
    expect(() => validateOptionalChangeEvent41({ ...original, basis: 'machine' } as never)).toThrow();
    expect(() => validateOptionalChangeEvent41({ ...original, actor: 'clinician' } as never)).toThrow();
  });
});
