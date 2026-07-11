import { beforeEach, describe, expect, it, vi } from 'vitest';

import { detectConflicts, type DetectedConflict } from './engine';
import {
  choiceForConflict,
  getConflictChoices,
  getOverriddenKeys,
  loadConflictChoices,
  setConflictChoice,
  setConflictOverride,
  unresolvedConflicts,
} from './overrides';
import { STARTER_RULES } from './rules';

const mocks = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  getPrivateItem: vi.fn(),
  removePrivateItem: vi.fn(),
  setPrivateItem: vi.fn(),
  updatePrivateItem: vi.fn(),
}));

vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: mocks.getPrivateItem,
  setPrivateItem: mocks.setPrivateItem,
  removePrivateItem: mocks.removePrivateItem,
  updatePrivateItem: mocks.updatePrivateItem,
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

describe('conflict choice persistence', () => {
  beforeEach(() => {
    mocks.storage.clear();
    mocks.getPrivateItem.mockReset();
    mocks.removePrivateItem.mockReset();
    mocks.setPrivateItem.mockReset();
    mocks.updatePrivateItem.mockReset();
    mocks.getPrivateItem.mockImplementation(async (key: string) => mocks.storage.get(key) ?? null);
    mocks.setPrivateItem.mockImplementation(async (key: string, value: string) => {
      mocks.storage.set(key, value);
    });
    mocks.removePrivateItem.mockImplementation(async (key: string) => {
      mocks.storage.delete(key);
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
    await expect(loadConflictChoices()).resolves.toEqual({});
  });

  it('migrates the legacy override array into a versioned pair-aware record', async () => {
    const current = conflict();
    const key = `${current.rule.id}:glycolic+retinol`;
    mocks.storage.set(KEY, JSON.stringify([key, key, '', false]));

    await expect(loadConflictChoices()).resolves.toEqual({
      [key]: {
        choice: 'use_together',
        ruleId: current.rule.id,
        ruleVersion: 1,
        productIds: ['glycolic', 'retinol'],
      },
    });
    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toEqual({
      schemaVersion: 1,
      choices: {
        [key]: {
          choice: 'use_together',
          ruleId: current.rule.id,
          ruleVersion: 1,
          productIds: ['glycolic', 'retinol'],
        },
      },
    });
  });

  it('removes malformed state but preserves a newer schema it cannot safely write', async () => {
    mocks.storage.set(KEY, '{not-json');
    await expect(loadConflictChoices()).resolves.toEqual({});
    expect(mocks.storage.has(KEY)).toBe(false);

    const futureState = JSON.stringify({ schemaVersion: 2, choices: { future: true } });
    mocks.storage.set(KEY, futureState);
    await expect(loadConflictChoices()).rejects.toThrow('CONFLICT_CHOICES_SCHEMA_UNSUPPORTED');
    await expect(getConflictChoices()).resolves.toEqual({});
    await expect(setConflictChoice(conflict(), 'use_together')).rejects.toThrow(
      'CONFLICT_CHOICES_SCHEMA_UNSUPPORTED',
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

  it('normalizes the legacy keep-only value to a resolution-accurate accepted choice', async () => {
    const current = conflict();
    const key = `${current.rule.id}:glycolic+retinol`;
    mocks.storage.set(
      KEY,
      JSON.stringify({
        schemaVersion: 1,
        choices: {
          [key]: {
            choice: 'keep_alternate_nights',
            ruleId: current.rule.id,
            ruleVersion: 1,
            productIds: ['glycolic', 'retinol'],
          },
        },
      }),
    );

    const choices = await loadConflictChoices();
    expect(choiceForConflict(choices, current)).toBe('accept_suggested_timing');
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

  it('falls back safely for rendering but propagates private-read failures on writes', async () => {
    mocks.getPrivateItem.mockRejectedValue(new Error('private storage unavailable'));
    mocks.updatePrivateItem.mockRejectedValue(new Error('private storage unavailable'));

    await expect(getConflictChoices()).resolves.toEqual({});
    await expect(loadConflictChoices()).rejects.toThrow('private storage unavailable');
    await expect(setConflictChoice(conflict(), 'use_together')).rejects.toThrow(
      'private storage unavailable',
    );
  });

  it('propagates write failures and does not claim the new choice exists', async () => {
    mocks.updatePrivateItem.mockRejectedValueOnce(new Error('write failed'));

    await expect(setConflictChoice(conflict(), 'use_together')).rejects.toThrow('write failed');
    expect(mocks.storage.has(KEY)).toBe(false);
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
