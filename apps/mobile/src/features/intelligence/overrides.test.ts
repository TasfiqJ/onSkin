import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { runAccountGenerationOperation } from '@/lib/auth/accountGeneration';
import {
  clearActiveHealthProcessingEpoch,
  setActiveHealthProcessingEpoch,
} from '@/lib/consent/healthProcessingEpoch';

import { previewDetectConflicts, type DetectedConflict } from './engine';
import {
  choiceForConflict,
  CONFLICT_CHOICES_INVALID,
  CONFLICT_CHOICES_SCHEMA_UNSUPPORTED,
  getConflictChoices,
  getOverriddenKeys,
  loadConflictChoices,
  normalizeConflictChoicesForExport,
  setConflictChoice,
  setConflictOverride,
} from './overrides';
import { STARTER_RULES } from './rules';

const mocks = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  getPrivateItem: vi.fn(),
  updatePrivateItem: vi.fn(),
}));

vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: mocks.getPrivateItem,
  updatePrivateItem: mocks.updatePrivateItem,
}));

const KEY = 'layerwell.conflict.overrides';
let accountGeneration = 0;

function candidateConflict(): DetectedConflict {
  return previewDetectConflicts(
    [
      { id: 'retinol', name: 'Retinol 0.3%', tags: ['retinoid'] },
      { id: 'glycolic', name: 'Glycolic 7%', tags: ['aha'] },
    ],
    { sensitivity: 'sensitive', reproductiveStatus: 'none' },
    STARTER_RULES,
  )[0]!;
}

describe('conflict choice persistence', () => {
  beforeEach(async () => {
    mocks.storage.clear();
    mocks.getPrivateItem.mockReset();
    mocks.updatePrivateItem.mockReset();
    mocks.getPrivateItem.mockImplementation(async (key: string) => mocks.storage.get(key) ?? null);
    mocks.updatePrivateItem.mockImplementation(
      async (key: string, updater: (current: string | null) => string | null) => {
        const next = updater(mocks.storage.get(key) ?? null);
        if (next === null) mocks.storage.delete(key);
        else mocks.storage.set(key, next);
      },
    );
    clearActiveHealthProcessingEpoch();
    await runAccountGenerationOperation((lease) => {
      accountGeneration = lease.generation;
    });
    setActiveHealthProcessingEpoch(1, {
      ownerUserId: 'user-a',
      accountGeneration,
    });
  });

  afterEach(() => {
    clearActiveHealthProcessingEpoch();
  });

  it('returns an empty map when no choice exists', async () => {
    await expect(loadConflictChoices()).resolves.toEqual({});
  });

  it('keeps legacy rows exportable but hashless and permanently dormant', async () => {
    const current = candidateConflict();
    const key = `${current.rule.id}:glycolic+retinol`;
    const legacy = JSON.stringify([key]);
    mocks.storage.set(KEY, legacy);

    const choices = await loadConflictChoices();
    expect(choices).toEqual({
      [key]: {
        choice: 'use_together',
        ruleId: current.rule.id,
        ruleVersion: 1,
        productIds: ['glycolic', 'retinol'],
        corpusSha256: null,
        ruleContentSha256: null,
      },
    });
    expect(choiceForConflict(choices, current)).toBeNull();
    expect(await getOverriddenKeys()).toEqual(new Set());
    expect(mocks.storage.get(KEY)).toBe(legacy);
  });

  it('fails closed while preserving malformed and future-version state', async () => {
    const malformed = '{not-json';
    mocks.storage.set(KEY, malformed);
    await expect(loadConflictChoices()).rejects.toThrow(CONFLICT_CHOICES_INVALID);
    await expect(getConflictChoices()).resolves.toEqual({});
    expect(mocks.storage.get(KEY)).toBe(malformed);

    const futureState = JSON.stringify({ schemaVersion: 2, choices: { future: true } });
    mocks.storage.set(KEY, futureState);
    await expect(loadConflictChoices()).rejects.toThrow(CONFLICT_CHOICES_SCHEMA_UNSUPPORTED);
    await expect(getConflictChoices()).resolves.toEqual({});
    expect(mocks.storage.get(KEY)).toBe(futureState);
  });

  it('rejects candidate and fabricated hash-shaped conflicts before storage', async () => {
    const candidate = candidateConflict();
    await expect(setConflictChoice(candidate, 'use_together')).rejects.toThrow(
      'CONFLICT_CHOICE_NOT_ELIGIBLE',
    );
    const fabricated: DetectedConflict = {
      ...candidate,
      rule: {
        ...candidate.rule,
        corpusSha256: 'a'.repeat(64),
        ruleContentSha256: 'b'.repeat(64),
      },
    };
    await expect(setConflictChoice(fabricated, 'accept_suggested_timing')).rejects.toThrow(
      'CONFLICT_CHOICE_NOT_ELIGIBLE',
    );
    expect(mocks.storage.has(KEY)).toBe(false);
  });

  it('rejects safety and reassurance candidates', async () => {
    const safety = previewDetectConflicts(
      [{ id: 'retinol', name: 'Retinol', tags: ['retinoid'] }],
      { sensitivity: 'neutral', reproductiveStatus: 'pregnant' },
      STARTER_RULES,
    ).find((item) => item.rule.interactionType === 'safety')!;
    const reassurance = previewDetectConflicts(
      [
        { id: 'niacinamide', name: 'Niacinamide', tags: ['niacinamide'] },
        { id: 'vitamin-c', name: 'Vitamin C', tags: ['vitamin_c'] },
      ],
      { sensitivity: 'neutral', reproductiveStatus: 'none' },
      STARTER_RULES,
    ).find((item) => item.rule.interactionType === 'myth')!;

    await expect(setConflictChoice(safety, 'use_together')).rejects.toThrow(
      'CONFLICT_CHOICE_NOT_ELIGIBLE',
    );
    await expect(setConflictChoice(reassurance, 'use_together')).rejects.toThrow(
      'CONFLICT_CHOICE_NOT_ELIGIBLE',
    );
  });

  it('normalizes the known legacy timing choice without activating it', async () => {
    const current = candidateConflict();
    const key = `${current.rule.id}:glycolic+retinol`;
    const legacy = {
      schemaVersion: 1,
      choices: {
        [key]: {
          choice: 'keep_alternate_nights',
          ruleId: current.rule.id,
          ruleVersion: 1,
          productIds: ['glycolic', 'retinol'],
        },
      },
    };
    mocks.storage.set(KEY, JSON.stringify(legacy));

    const choices = await loadConflictChoices();
    expect(choices[key]).toMatchObject({
      choice: 'accept_suggested_timing',
      corpusSha256: null,
      ruleContentSha256: null,
    });
    expect(choiceForConflict(choices, current)).toBeNull();
    expect(normalizeConflictChoicesForExport(legacy)).toEqual({
      schemaVersion: 1,
      choices,
    });
  });

  it('refuses unknown current-record fields instead of partially applying them', async () => {
    const current = candidateConflict();
    const key = `${current.rule.id}:glycolic+retinol`;
    const unknown = {
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
    };
    mocks.storage.set(KEY, JSON.stringify(unknown));

    await expect(loadConflictChoices()).rejects.toThrow(CONFLICT_CHOICES_INVALID);
    expect(normalizeConflictChoicesForExport(unknown)).toEqual({
      export_status: 'unrecognized_conflict_choice_schema',
      stored_value: unknown,
    });
  });

  it('legacy adapter cannot create an override and can only remove dormant state', async () => {
    const current = candidateConflict();
    const key = `${current.rule.id}:glycolic+retinol`;
    await setConflictOverride(key, true);
    expect(mocks.storage.has(KEY)).toBe(false);

    mocks.storage.set(KEY, JSON.stringify([key]));
    await setConflictOverride(key, false);
    expect(mocks.storage.has(KEY)).toBe(false);
  });

  it('falls back safely when private reads fail', async () => {
    mocks.getPrivateItem.mockRejectedValue(new Error('private storage unavailable'));
    await expect(getConflictChoices()).resolves.toEqual({});
    await expect(loadConflictChoices()).rejects.toThrow('private storage unavailable');
  });
});
