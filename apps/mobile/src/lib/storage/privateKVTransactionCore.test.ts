import { describe, expect, it } from 'vitest';

import { MAX_PENDING_PHOTO_STORE_CHARS } from '@/features/photos/photoStoreEnvelope';
import { MAX_OUTBOX_ENVELOPE_CHARS } from '@/lib/offline/outbox.pure';

import {
  MAX_PRIVATE_KV_TRANSACTION_TOTAL_CHARS,
  MAX_PRIVATE_KV_TRANSACTION_VALUE_CHARS,
  MAX_PRIVATE_KV_TRANSACTION_LEGACY_TOTAL_CHARS,
  PRIVATE_KV_TRANSACTION_LEGACY_SCHEMA_VERSION,
  PRIVATE_KV_TRANSACTION_SCHEMA_VERSION,
  PrivateKVTransactionJournalError,
  decodePrivateKVTransactionJournal,
  encodePrivateKVTransactionJournal,
  type PrivateKVTransactionJournal,
} from './privateKVTransactionCore';

const TRANSACTION_ID = '1'.repeat(64);
const BEFORE_HASH_A = 'a'.repeat(64);
const BEFORE_HASH_B = 'b'.repeat(64);

describe('private KV transaction journal codec', () => {
  it('retains strict V1 recovery compatibility without accepting V1-sized expansion', () => {
    expect(MAX_PRIVATE_KV_TRANSACTION_LEGACY_TOTAL_CHARS).toBe(12 * 1024 * 1024);
    const legacy: PrivateKVTransactionJournal = {
      version: PRIVATE_KV_TRANSACTION_LEGACY_SCHEMA_VERSION,
      transactionId: TRANSACTION_ID,
      targets: [
        {
          key: 'onskin.photos.v1',
          beforeRaw: 'encrypted-before',
          nextValue: 'logical-next',
        },
      ],
    };

    expect(decodePrivateKVTransactionJournal(encodePrivateKVTransactionJournal(legacy))).toEqual(
      legacy,
    );

    const oversizedLegacy = {
      version: PRIVATE_KV_TRANSACTION_LEGACY_SCHEMA_VERSION,
      transactionId: TRANSACTION_ID,
      targets: [
        {
          key: 'onskin.photos.v1',
          beforeRaw: 'a'.repeat(3 * 1024 * 1024),
          nextValue: 'b'.repeat(3 * 1024 * 1024),
        },
        {
          key: 'onskin.outbox.v1',
          beforeRaw: 'c'.repeat(3 * 1024 * 1024),
          nextValue: 'd'.repeat(3 * 1024 * 1024),
        },
      ],
    };
    expect(() => decodePrivateKVTransactionJournal(JSON.stringify(oversizedLegacy))).toThrow(
      PrivateKVTransactionJournalError,
    );
  });

  it('strictly roundtrips V2 fingerprints and preserves future-version evidence', () => {
    const current: PrivateKVTransactionJournal = {
      version: PRIVATE_KV_TRANSACTION_SCHEMA_VERSION,
      transactionId: TRANSACTION_ID,
      targets: [
        {
          key: 'onskin.photos.v1',
          beforeRawHash: BEFORE_HASH_A,
          nextValue: 'prepared-photo',
        },
      ],
    };

    expect(decodePrivateKVTransactionJournal(encodePrivateKVTransactionJournal(current))).toEqual(
      current,
    );
    expect(() =>
      decodePrivateKVTransactionJournal(
        JSON.stringify({ version: 3, transactionId: TRANSACTION_ID, targets: [] }),
      ),
    ).toThrow(
      expect.objectContaining<Partial<PrivateKVTransactionJournalError>>({
        kind: 'unsupported_version',
      }),
    );
  });

  it('covers the maximum pending-photo plus maximum outbox atomic pair', () => {
    expect(MAX_PRIVATE_KV_TRANSACTION_TOTAL_CHARS).toBe(16 * 1024 * 1024);
    expect(MAX_PRIVATE_KV_TRANSACTION_VALUE_CHARS).toBeGreaterThanOrEqual(
      MAX_PENDING_PHOTO_STORE_CHARS,
    );
    const maximumDomainPair: PrivateKVTransactionJournal = {
      version: PRIVATE_KV_TRANSACTION_SCHEMA_VERSION,
      transactionId: TRANSACTION_ID,
      targets: [
        {
          key: 'onskin.photos.v1',
          beforeRawHash: BEFORE_HASH_A,
          nextValue: 'p'.repeat(MAX_PENDING_PHOTO_STORE_CHARS),
        },
        {
          key: 'onskin.outbox.v1',
          beforeRawHash: BEFORE_HASH_B,
          nextValue: 'o'.repeat(MAX_OUTBOX_ENVELOPE_CHARS),
        },
      ],
    };

    expect(() =>
      decodePrivateKVTransactionJournal(encodePrivateKVTransactionJournal(maximumDomainPair)),
    ).not.toThrow();
  });

  it('rejects per-target and aggregate values beyond the bounded V2 contract', () => {
    const targetTooLarge = {
      version: PRIVATE_KV_TRANSACTION_SCHEMA_VERSION,
      transactionId: TRANSACTION_ID,
      targets: [
        {
          key: 'onskin.photos.v1',
          beforeRawHash: BEFORE_HASH_A,
          nextValue: 'x'.repeat(MAX_PRIVATE_KV_TRANSACTION_VALUE_CHARS + 1),
        },
      ],
    };
    expect(() => decodePrivateKVTransactionJournal(JSON.stringify(targetTooLarge))).toThrow(
      PrivateKVTransactionJournalError,
    );

    const aggregateTooLarge = {
      version: PRIVATE_KV_TRANSACTION_SCHEMA_VERSION,
      transactionId: TRANSACTION_ID,
      targets: [
        {
          key: 'onskin.photos.v1',
          beforeRawHash: BEFORE_HASH_A,
          nextValue: 'x'.repeat(8 * 1024 * 1024),
        },
        {
          key: 'onskin.outbox.v1',
          beforeRawHash: BEFORE_HASH_B,
          nextValue: 'y'.repeat(8 * 1024 * 1024),
        },
      ],
    };
    expect(() => decodePrivateKVTransactionJournal(JSON.stringify(aggregateTooLarge))).toThrow(
      PrivateKVTransactionJournalError,
    );
  });
});
