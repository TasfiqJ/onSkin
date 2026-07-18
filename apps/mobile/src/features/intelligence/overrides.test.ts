import { beforeEach, describe, expect, it, vi } from 'vitest';

import { detectConflicts, type DetectedConflict } from './engine';
import {
  choiceForConflict,
  CONFLICT_CHOICES_INVALID,
  CONFLICT_CHOICES_SCHEMA_UNSUPPORTED,
  CONFLICT_CHOICES_UNAVAILABLE,
  getConflictChoices,
  getOverriddenKeys,
  isConflictChoicesReadError,
  loadConflictChoices,
  normalizeConflictChoicesForExport,
  readConflictChoicesState,
  setConflictChoice,
  setConflictOverride,
  unresolvedConflicts,
} from './overrides';
import { STARTER_RULES } from './rules';
import { decodeOutboxEnvelope, OUTBOX_STORAGE_KEY } from '@/lib/offline/outbox.pure';

const mocks = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  decodeShelfProducts: vi.fn(),
  digestStringAsync: vi.fn(async () => 'a'.repeat(64)),
  hashOutboxOwner: vi.fn(async () => 'b'.repeat(64)),
  nextUuid: 900,
  randomUUID: vi.fn(),
  readPrivateItem: vi.fn(),
  scheduleOutboxFlush: vi.fn(),
  updatePrivateItem: vi.fn(),
  updatePrivateItemsTransactionally: vi.fn(),
}));

vi.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: mocks.digestStringAsync,
  randomUUID: mocks.randomUUID,
}));

vi.mock('@/features/shelf/store', () => ({
  SHELF_STORAGE_KEY: 'onskin.shelf.v1',
  decodeShelfProductsForOutboxDependency: mocks.decodeShelfProducts,
  shelfProductOutboxPayload: vi.fn((product: { id: string }) => ({ name: product.id })),
}));

vi.mock('@/lib/offline/outbox', () => ({
  hashOutboxOwner: mocks.hashOutboxOwner,
  scheduleOutboxFlush: mocks.scheduleOutboxFlush,
}));

vi.mock('@/lib/storage/privateKV', () => ({
  readPrivateItem: mocks.readPrivateItem,
  updatePrivateItem: mocks.updatePrivateItem,
  updatePrivateItemsTransactionally: mocks.updatePrivateItemsTransactionally,
}));

const KEY = 'onskin.conflict.overrides';

function conflict(): DetectedConflict {
  const [result] = detectConflicts(
    [
      { id: 'retinol', name: 'Retinol 0.3%', tags: ['retinoid'] },
      { id: 'glycolic', name: 'Glycolic 7%', tags: ['aha'] },
    ],
    { sensitivity: 'sensitive', pregnancy: false },
    STARTER_RULES,
  );
  return result!;
}

function authenticatedConflict(): DetectedConflict {
  return {
    ...conflict(),
    productAId: '00000000-0000-4000-8000-000000000102',
    productBId: '00000000-0000-4000-8000-000000000101',
  };
}

describe('conflict choice persistence', () => {
  beforeEach(() => {
    mocks.storage.clear();
    mocks.decodeShelfProducts.mockReset();
    mocks.decodeShelfProducts.mockReturnValue([]);
    mocks.digestStringAsync.mockReset();
    mocks.digestStringAsync.mockResolvedValue('a'.repeat(64));
    mocks.hashOutboxOwner.mockReset();
    mocks.hashOutboxOwner.mockResolvedValue('b'.repeat(64));
    mocks.nextUuid = 900;
    mocks.randomUUID.mockReset();
    mocks.randomUUID.mockImplementation(
      () => `00000000-0000-4000-8000-${String(mocks.nextUuid++).padStart(12, '0')}`,
    );
    mocks.readPrivateItem.mockReset();
    mocks.scheduleOutboxFlush.mockClear();
    mocks.updatePrivateItem.mockReset();
    mocks.updatePrivateItemsTransactionally.mockReset();
    mocks.updatePrivateItemsTransactionally.mockImplementation(
      async (
        keys: readonly string[],
        updater: (
          current: ReadonlyMap<string, string | null>,
        ) => ReadonlyMap<string, string | null>,
      ) => {
        const current = new Map(keys.map((key) => [key, mocks.storage.get(key) ?? null]));
        const next = updater(current);
        for (const [key, value] of next) {
          if (value === null) mocks.storage.delete(key);
          else mocks.storage.set(key, value);
        }
      },
    );
    mocks.readPrivateItem.mockImplementation(async (key: string) => {
      const value = mocks.storage.get(key);
      return value === undefined
        ? { status: 'absent' as const }
        : { status: 'available' as const, value };
    });
    mocks.updatePrivateItem.mockImplementation(
      async (key: string, updater: (current: string | null) => string | null) => {
        const next = updater(mocks.storage.get(key) ?? null);
        if (next === null) mocks.storage.delete(key);
        else mocks.storage.set(key, next);
      },
    );
  });

  it('returns an empty map when no choice exists', async () => {
    await expect(readConflictChoicesState()).resolves.toEqual({ status: 'absent', choices: {} });
    await expect(loadConflictChoices()).resolves.toEqual({});
    expect(mocks.updatePrivateItem).not.toHaveBeenCalled();
  });

  it('classifies stable domain read errors for availability UI', () => {
    expect(isConflictChoicesReadError(new Error(CONFLICT_CHOICES_UNAVAILABLE))).toBe(true);
    expect(isConflictChoicesReadError(new Error(CONFLICT_CHOICES_INVALID))).toBe(true);
    expect(isConflictChoicesReadError(new Error(CONFLICT_CHOICES_SCHEMA_UNSUPPORTED))).toBe(true);
    expect(isConflictChoicesReadError(new Error('unrelated'))).toBe(false);
    expect(isConflictChoicesReadError(CONFLICT_CHOICES_UNAVAILABLE)).toBe(false);
  });

  it('keeps the targeted read fixture dev-only and supports one-shot recovery', async () => {
    try {
      vi.stubEnv('EXPO_PUBLIC_E2E_CONFLICT_CHOICES_READ_FAILURE', 'always');
      vi.stubGlobal('__DEV__', false);
      await expect(readConflictChoicesState()).resolves.toEqual({
        status: 'absent',
        choices: {},
      });
      expect(mocks.readPrivateItem).toHaveBeenCalledTimes(1);

      mocks.readPrivateItem.mockClear();
      vi.stubEnv('EXPO_PUBLIC_E2E_CONFLICT_CHOICES_READ_FAILURE', 'once');
      vi.stubGlobal('__DEV__', true);
      await expect(readConflictChoicesState()).resolves.toEqual({
        status: 'unavailable',
        choices: null,
      });
      expect(mocks.readPrivateItem).not.toHaveBeenCalled();

      await expect(readConflictChoicesState()).resolves.toEqual({
        status: 'absent',
        choices: {},
      });
      expect(mocks.readPrivateItem).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    }
  });

  it('normalizes a legacy override array in memory without rewriting storage', async () => {
    const current = conflict();
    const key = `${current.rule.id}:glycolic+retinol`;
    const legacy = JSON.stringify([key, key, '', false]);
    mocks.storage.set(KEY, legacy);

    const choices = {
      [key]: {
        choice: 'use_together',
        ruleId: current.rule.id,
        ruleVersion: 1,
        productIds: ['glycolic', 'retinol'],
      },
    };
    await expect(readConflictChoicesState()).resolves.toEqual({
      status: 'available',
      choices,
      format: 'legacy',
    });
    await expect(loadConflictChoices()).resolves.toEqual(choices);
    expect(mocks.storage.get(KEY)).toBe(legacy);
    expect(mocks.updatePrivateItem).not.toHaveBeenCalled();
  });

  it('fails closed and preserves malformed or future-version state', async () => {
    const malformed = '{not-json';
    mocks.storage.set(KEY, malformed);
    await expect(readConflictChoicesState()).resolves.toEqual({
      status: 'corrupt',
      choices: null,
    });
    await expect(loadConflictChoices()).rejects.toThrow(CONFLICT_CHOICES_INVALID);
    await expect(getConflictChoices()).rejects.toThrow(CONFLICT_CHOICES_INVALID);
    await expect(getOverriddenKeys()).rejects.toThrow(CONFLICT_CHOICES_INVALID);
    expect(mocks.updatePrivateItem).not.toHaveBeenCalled();
    await expect(setConflictChoice(conflict(), 'use_together')).rejects.toThrow(
      CONFLICT_CHOICES_INVALID,
    );
    expect(mocks.storage.get(KEY)).toBe(malformed);

    const futureState = JSON.stringify({ schemaVersion: 2, choices: { future: true } });
    mocks.storage.set(KEY, futureState);
    await expect(readConflictChoicesState()).resolves.toEqual({
      status: 'unsupported_version',
      choices: null,
    });
    await expect(loadConflictChoices()).rejects.toThrow(CONFLICT_CHOICES_SCHEMA_UNSUPPORTED);
    await expect(getConflictChoices()).rejects.toThrow(CONFLICT_CHOICES_SCHEMA_UNSUPPORTED);
    await expect(getOverriddenKeys()).rejects.toThrow(CONFLICT_CHOICES_SCHEMA_UNSUPPORTED);
    await expect(setConflictChoice(conflict(), 'use_together')).rejects.toThrow(
      CONFLICT_CHOICES_SCHEMA_UNSUPPORTED,
    );
    expect(mocks.storage.get(KEY)).toBe(futureState);
  });

  it('persists both accepted and overridden decisions for the exact pair and rule version', async () => {
    const current = conflict();

    const accepted = await setConflictChoice(current, 'accept_suggested_timing');
    expect(choiceForConflict(accepted, current)).toBe('accept_suggested_timing');
    expect(await getOverriddenKeys()).toEqual(new Set());

    const overridden = await setConflictChoice(current, 'use_together');
    expect(choiceForConflict(overridden, current)).toBe('use_together');
    expect(await getOverriddenKeys()).toEqual(new Set([`${current.rule.id}:glycolic+retinol`]));
  });

  it('normalizes the documented legacy timing choice without rewriting it during a read', async () => {
    const current = conflict();
    const key = `${current.rule.id}:glycolic+retinol`;
    const legacy = JSON.stringify({
      schemaVersion: 1,
      choices: {
        [key]: {
          choice: 'keep_alternate_nights',
          ruleId: current.rule.id,
          ruleVersion: 1,
          productIds: ['glycolic', 'retinol'],
        },
      },
    });
    mocks.storage.set(KEY, legacy);

    const expected = {
      [key]: {
        choice: 'accept_suggested_timing' as const,
        ruleId: current.rule.id,
        ruleVersion: 1,
        productIds: ['glycolic', 'retinol'] as [string, string],
      },
    };
    await expect(readConflictChoicesState()).resolves.toEqual({
      status: 'available',
      choices: expected,
      format: 'legacy',
    });
    await expect(getConflictChoices()).resolves.toEqual(expected);
    expect(mocks.storage.get(KEY)).toBe(legacy);
    expect(mocks.updatePrivateItem).not.toHaveBeenCalled();
    expect(normalizeConflictChoicesForExport(JSON.parse(legacy))).toEqual({
      schemaVersion: 1,
      choices: expected,
    });

    await setConflictChoice(current, 'use_together');
    expect(JSON.parse(mocks.storage.get(KEY)!)).toMatchObject({
      schemaVersion: 1,
      choices: { [key]: { choice: 'use_together' } },
    });
  });

  it('accepts semantically equivalent current property order without rewriting bytes', async () => {
    const current = conflict();
    const key = `${current.rule.id}:glycolic+retinol`;
    const reordered = JSON.stringify({
      choices: {
        [key]: {
          productIds: ['glycolic', 'retinol'],
          ruleVersion: 1,
          ruleId: current.rule.id,
          choice: 'use_together',
        },
      },
      schemaVersion: 1,
    });
    mocks.storage.set(KEY, reordered);

    const state = await readConflictChoicesState();
    expect(state).toMatchObject({ status: 'available', format: 'current' });
    expect(state.choices?.[key]?.choice).toBe('use_together');
    expect(mocks.storage.get(KEY)).toBe(reordered);
    expect(mocks.updatePrivateItem).not.toHaveBeenCalled();
  });

  it('refuses unknown current fields without partially applying or overwriting them', async () => {
    const current = conflict();
    const key = `${current.rule.id}:glycolic+retinol`;
    const unknown = JSON.stringify({
      schemaVersion: 1,
      choices: {
        [key]: {
          choice: 'use_together',
          ruleId: current.rule.id,
          ruleVersion: 1,
          productIds: ['glycolic', 'retinol'],
          futureField: true,
        },
      },
    });
    mocks.storage.set(KEY, unknown);

    await expect(readConflictChoicesState()).resolves.toEqual({
      status: 'corrupt',
      choices: null,
    });
    await expect(loadConflictChoices()).rejects.toThrow(CONFLICT_CHOICES_INVALID);
    await expect(setConflictChoice(current, 'use_together')).rejects.toThrow(
      CONFLICT_CHOICES_INVALID,
    );
    expect(mocks.storage.get(KEY)).toBe(unknown);
    expect(normalizeConflictChoicesForExport(JSON.parse(unknown))).toEqual({
      export_status: 'unrecognized_conflict_choice_schema',
      stored_value: JSON.parse(unknown),
    });
  });

  it('rejects non-canonical current identities and extra envelope fields byte-for-byte', async () => {
    const current = conflict();
    const canonicalKey = `${current.rule.id}:glycolic+retinol`;
    const record = {
      choice: 'use_together',
      ruleId: current.rule.id,
      ruleVersion: 1,
      productIds: ['glycolic', 'retinol'],
    };
    const cases = [
      {
        schemaVersion: 1,
        choices: { [canonicalKey]: record },
        futureEnvelopeField: true,
      },
      {
        schemaVersion: 1,
        choices: { [`${current.rule.id}:retinol+glycolic`]: record },
      },
      {
        schemaVersion: 1,
        choices: {
          [canonicalKey]: { ...record, productIds: ['retinol', 'glycolic'] },
        },
      },
    ];

    for (const value of cases) {
      const raw = JSON.stringify(value);
      mocks.storage.set(KEY, raw);

      await expect(readConflictChoicesState()).resolves.toEqual({
        status: 'corrupt',
        choices: null,
      });
      await expect(loadConflictChoices()).rejects.toThrow(CONFLICT_CHOICES_INVALID);
      expect(mocks.storage.get(KEY)).toBe(raw);
      expect(mocks.updatePrivateItem).not.toHaveBeenCalled();
    }
  });

  it('classifies only safe future integers as unsupported', async () => {
    for (const schemaVersion of [1.5, -1, Number.MAX_SAFE_INTEGER + 1]) {
      const raw = JSON.stringify({ schemaVersion, choices: {} });
      mocks.storage.set(KEY, raw);
      await expect(readConflictChoicesState()).resolves.toEqual({
        status: 'corrupt',
        choices: null,
      });
      await expect(loadConflictChoices()).rejects.toThrow(CONFLICT_CHOICES_INVALID);
      expect(mocks.storage.get(KEY)).toBe(raw);
    }

    const future = JSON.stringify({ schemaVersion: 3, choices: {} });
    mocks.storage.set(KEY, future);
    await expect(loadConflictChoices()).rejects.toThrow(CONFLICT_CHOICES_SCHEMA_UNSUPPORTED);
    expect(mocks.storage.get(KEY)).toBe(future);
  });

  it('does not apply an old choice after the reviewed rule version changes', async () => {
    const current = conflict();
    const choices = await setConflictChoice(current, 'use_together');
    const updated = { ...current, rule: { ...current.rule, ruleVersion: 2 } };

    expect(choiceForConflict(choices, updated)).toBeNull();
    expect(unresolvedConflicts([updated], choices)).toEqual([updated]);
  });

  it('keeps safety and reassurance rows ineligible for a local scheduling choice', async () => {
    const safety = detectConflicts(
      [{ id: 'retinol', name: 'Retinol', tags: ['retinoid'] }],
      { sensitivity: 'neutral', pregnancy: true },
      STARTER_RULES,
    ).find((item) => item.rule.interactionType === 'safety')!;

    await expect(setConflictChoice(safety, 'use_together')).rejects.toThrow(
      'CONFLICT_CHOICE_NOT_ELIGIBLE',
    );

    const reassurance = detectConflicts(
      [
        { id: 'niacinamide', name: 'Niacinamide', tags: ['niacinamide'] },
        { id: 'vitamin-c', name: 'Vitamin C', tags: ['vitamin_c'] },
      ],
      { sensitivity: 'neutral', pregnancy: false },
      STARTER_RULES,
    ).find((item) => item.rule.interactionType === 'myth')!;
    await expect(setConflictChoice(reassurance, 'use_together')).rejects.toThrow(
      'CONFLICT_CHOICE_NOT_ELIGIBLE',
    );
    expect(mocks.storage.has(KEY)).toBe(false);
  });

  it('never lets a stored choice suppress a safety-class conflict', async () => {
    const current = conflict();
    const choices = await setConflictChoice(current, 'use_together');
    const safetyClone: DetectedConflict = {
      ...current,
      rule: { ...current.rule, interactionType: 'safety' },
    };

    expect(choiceForConflict(choices, safetyClone)).toBeNull();
    expect(unresolvedConflicts([safetyClone], choices)).toEqual([safetyClone]);
  });

  it('classifies private-read failures and keeps strict consumers fail closed', async () => {
    mocks.readPrivateItem.mockResolvedValue({
      status: 'unavailable',
      reason: 'storage_unavailable',
    });
    mocks.updatePrivateItem.mockRejectedValue(new Error('private storage unavailable'));

    await expect(readConflictChoicesState()).resolves.toEqual({
      status: 'unavailable',
      choices: null,
    });
    await expect(getConflictChoices()).rejects.toThrow(CONFLICT_CHOICES_UNAVAILABLE);
    await expect(getOverriddenKeys()).rejects.toThrow(CONFLICT_CHOICES_UNAVAILABLE);
    await expect(loadConflictChoices()).rejects.toThrow(CONFLICT_CHOICES_UNAVAILABLE);
    await expect(setConflictChoice(conflict(), 'use_together')).rejects.toThrow(
      'private storage unavailable',
    );
  });

  it('maps a thrown private read to unavailable without attempting a repair', async () => {
    mocks.readPrivateItem.mockRejectedValueOnce(new Error('transport failed'));

    await expect(readConflictChoicesState()).resolves.toEqual({
      status: 'unavailable',
      choices: null,
    });
    expect(mocks.updatePrivateItem).not.toHaveBeenCalled();
  });

  it('maps private corruption and future envelopes without reading or rewriting their bytes', async () => {
    mocks.readPrivateItem.mockResolvedValueOnce({
      status: 'corrupt',
      reason: 'decryption_failed',
    });
    await expect(readConflictChoicesState()).resolves.toEqual({
      status: 'corrupt',
      choices: null,
    });

    mocks.readPrivateItem.mockResolvedValueOnce({ status: 'unsupported_version' });
    await expect(readConflictChoicesState()).resolves.toEqual({
      status: 'unsupported_version',
      choices: null,
    });
    expect(mocks.updatePrivateItem).not.toHaveBeenCalled();
  });

  it('propagates write failures and does not claim the new choice exists', async () => {
    mocks.updatePrivateItem.mockRejectedValueOnce(new Error('write failed'));

    await expect(setConflictChoice(conflict(), 'use_together')).rejects.toThrow('write failed');
    expect(mocks.storage.has(KEY)).toBe(false);
  });

  it('atomically commits an authenticated choice with both Shelf dependency snapshots', async () => {
    const current = authenticatedConflict();
    mocks.storage.set('onskin.shelf.v1', 'opaque-shelf');
    mocks.decodeShelfProducts.mockReturnValue(
      [current.productAId, current.productBId].map((id) => ({ id })),
    );
    const assertCurrent = vi.fn();

    const choices = await setConflictChoice(current, 'use_together', {
      ownerId: 'owner-a',
      ownerGeneration: 7,
      assertCurrent,
    });

    expect(choiceForConflict(choices, current)).toBe('use_together');
    expect(mocks.updatePrivateItemsTransactionally).toHaveBeenCalledWith(
      ['onskin.conflict.overrides', 'onskin.shelf.v1', OUTBOX_STORAGE_KEY],
      expect.any(Function),
    );
    const envelope = decodeOutboxEnvelope(mocks.storage.get(OUTBOX_STORAGE_KEY)!);
    expect(envelope.rows.filter((row) => row.entityType === 'shelf_product')).toHaveLength(2);
    expect(envelope.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ entityType: 'shelf_product', entityId: current.productAId }),
        expect.objectContaining({ entityType: 'shelf_product', entityId: current.productBId }),
        expect.objectContaining({
          entityType: 'conflict_choice',
          payload: expect.objectContaining({
            product_a_id: current.productBId,
            product_b_id: current.productAId,
            user_choice: 'use_together',
          }),
        }),
      ]),
    );
    expect(mocks.storage.get('onskin.shelf.v1')).toBe('opaque-shelf');
    expect(mocks.scheduleOutboxFlush).toHaveBeenCalledOnce();
    expect(assertCurrent).toHaveBeenCalled();
  });

  it('confirms a committed three-key transaction after its response is lost', async () => {
    const current = authenticatedConflict();
    mocks.storage.set('onskin.shelf.v1', 'opaque-shelf');
    mocks.decodeShelfProducts.mockReturnValue(
      [current.productAId, current.productBId].map((id) => ({ id })),
    );
    mocks.updatePrivateItemsTransactionally.mockImplementationOnce(
      async (
        keys: readonly string[],
        updater: (
          current: ReadonlyMap<string, string | null>,
        ) => ReadonlyMap<string, string | null>,
      ) => {
        const next = updater(new Map(keys.map((key) => [key, mocks.storage.get(key) ?? null])));
        for (const [key, value] of next) {
          if (value === null) mocks.storage.delete(key);
          else mocks.storage.set(key, value);
        }
        throw new Error('commit response lost');
      },
    );

    await expect(
      setConflictChoice(current, 'accept_suggested_timing', {
        ownerId: 'owner-a',
        ownerGeneration: 7,
      }),
    ).resolves.toEqual(expect.any(Object));
    expect(mocks.scheduleOutboxFlush).toHaveBeenCalledOnce();
  });

  it('snapshots every local and outbox field before an owner hash can yield', async () => {
    const current = authenticatedConflict();
    const expectedRuleVersion = current.rule.ruleVersion;
    const expectedSeverity = current.computedSeverity;
    const expectedProductIds = [current.productBId!, current.productAId!] as const;
    mocks.storage.set('onskin.shelf.v1', 'opaque-shelf');
    mocks.decodeShelfProducts.mockReturnValue(expectedProductIds.map((id) => ({ id })));
    let releaseHash!: (hash: string) => void;
    mocks.hashOutboxOwner.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseHash = resolve;
        }),
    );

    const pending = setConflictChoice(current, 'use_together', {
      ownerId: 'owner-a',
      ownerGeneration: 7,
    });
    await vi.waitFor(() => expect(mocks.hashOutboxOwner).toHaveBeenCalledOnce());
    current.rule.ruleVersion = expectedRuleVersion + 10;
    current.computedSeverity = 'high';
    current.productAId = '00000000-0000-4000-8000-000000000199';
    releaseHash('b'.repeat(64));
    const choices = await pending;

    const record = Object.values(choices)[0]!;
    expect(record).toMatchObject({
      ruleVersion: expectedRuleVersion,
      productIds: expectedProductIds,
    });
    const conflictRow = decodeOutboxEnvelope(mocks.storage.get(OUTBOX_STORAGE_KEY)!).rows.find(
      (row) => row.entityType === 'conflict_choice',
    );
    expect(conflictRow?.payload).toMatchObject({
      rule_version: expectedRuleVersion,
      computed_severity: expectedSeverity,
      product_a_id: expectedProductIds[0],
      product_b_id: expectedProductIds[1],
    });
  });

  it('does not save or queue from a stale route whose Shelf dependency was deleted', async () => {
    const current = authenticatedConflict();
    mocks.storage.set('onskin.shelf.v1', 'opaque-shelf');
    mocks.decodeShelfProducts.mockReturnValue([{ id: current.productAId }]);

    await expect(
      setConflictChoice(current, 'use_together', {
        ownerId: 'owner-a',
        ownerGeneration: 7,
      }),
    ).rejects.toThrow('CONFLICT_CHOICE_SHELF_DEPENDENCY_MISSING');
    expect(mocks.storage.has(KEY)).toBe(false);
    expect(mocks.storage.has(OUTBOX_STORAGE_KEY)).toBe(false);
    expect(mocks.scheduleOutboxFlush).not.toHaveBeenCalled();
  });

  it('serializes concurrent decisions without dropping either product pair', async () => {
    const conflicts = detectConflicts(
      [
        { id: 'retinol', name: 'Retinol 0.3%', tags: ['retinoid'] },
        { id: 'glycolic', name: 'Glycolic 7%', tags: ['aha'] },
        { id: 'lactic', name: 'Lactic 5%', tags: ['aha'] },
      ],
      { sensitivity: 'sensitive', pregnancy: false },
      STARTER_RULES,
    ).filter((item) => item.rule.resolutionType === 'alternate_nights');

    await Promise.all([
      setConflictChoice(conflicts[0]!, 'accept_suggested_timing'),
      setConflictChoice(conflicts[1]!, 'use_together'),
    ]);

    const stored = await loadConflictChoices();
    expect(Object.keys(stored)).toHaveLength(2);
    expect(choiceForConflict(stored, conflicts[0]!)).toBe('accept_suggested_timing');
    expect(choiceForConflict(stored, conflicts[1]!)).toBe('use_together');
  });

  it('retains all choices across 100 concurrent atomic transforms', async () => {
    const base = conflict();
    const conflicts = Array.from(
      { length: 100 },
      (_, index): DetectedConflict => ({
        ...base,
        productAId: `retinol-${index}`,
        productAName: `Retinol ${index}`,
        productBId: `acid-${index}`,
        productBName: `Acid ${index}`,
      }),
    );

    await Promise.all(
      conflicts.map((item, index) =>
        setConflictChoice(item, index % 2 === 0 ? 'accept_suggested_timing' : 'use_together'),
      ),
    );

    const stored = await loadConflictChoices();
    expect(Object.keys(stored)).toHaveLength(100);
    conflicts.forEach((item, index) => {
      expect(choiceForConflict(stored, item)).toBe(
        index % 2 === 0 ? 'accept_suggested_timing' : 'use_together',
      );
    });
  });

  it('keeps the legacy adapter deterministic and ignores malformed keys', async () => {
    await setConflictOverride('not-a-pair', true);
    expect(mocks.storage.has(KEY)).toBe(false);

    const current = conflict();
    const key = `${current.rule.id}:retinol+glycolic`;
    await setConflictOverride(key, true);
    expect(await getOverriddenKeys()).toEqual(new Set([`${current.rule.id}:glycolic+retinol`]));
    await setConflictOverride(key, false);
    expect(mocks.storage.has(KEY)).toBe(false);
  });
});
