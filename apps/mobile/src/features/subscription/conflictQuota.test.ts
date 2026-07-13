import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  conflictCheckAccess,
  loadFreeConflictCheckRuleIds,
  recordFreeConflictCheckRuleId,
} from './conflictQuota';

const mocks = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  getPrivateItem: vi.fn(),
  updatePrivateItem: vi.fn(),
  writes: 0,
}));

vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: mocks.getPrivateItem,
  updatePrivateItem: mocks.updatePrivateItem,
}));

const KEY = 'onskin.subscription.freeConflictCheckRuleIds.v1';

describe('free conflict-check quota', () => {
  beforeEach(() => {
    mocks.storage.clear();
    mocks.writes = 0;
    mocks.getPrivateItem.mockReset();
    mocks.updatePrivateItem.mockReset();
    mocks.getPrivateItem.mockImplementation(async (key: string) => mocks.storage.get(key) ?? null);
    mocks.updatePrivateItem.mockImplementation(
      async (key: string, updater: (current: string | null) => string | null) => {
        const current = mocks.storage.get(key) ?? null;
        const next = updater(current);
        if (next === current) return;
        mocks.writes += 1;
        if (next === null) mocks.storage.delete(key);
        else mocks.storage.set(key, next);
      },
    );
  });

  it('allows and records the first free conflict check', () => {
    expect(conflictCheckAccess({ isPro: false, ruleId: 'rule-a', seenRuleIds: [] })).toEqual({
      allowed: true,
      reason: 'free_available',
      shouldRecord: true,
    });
  });

  it('allows revisiting the already-used free conflict check', () => {
    expect(
      conflictCheckAccess({ isPro: false, ruleId: ' rule-a ', seenRuleIds: ['rule-a'] }),
    ).toEqual({
      allowed: true,
      reason: 'already_viewed',
      shouldRecord: false,
    });
  });

  it('locks a second distinct free conflict check', () => {
    expect(
      conflictCheckAccess({ isPro: false, ruleId: 'rule-b', seenRuleIds: ['rule-a'] }),
    ).toEqual({
      allowed: false,
      reason: 'quota_exhausted',
      shouldRecord: false,
    });
  });

  it('fails a free user closed when quota state is unavailable', () => {
    expect(
      conflictCheckAccess({
        isPro: false,
        ruleId: 'rule-a',
        seenRuleIds: [],
        quotaAvailable: false,
      }),
    ).toEqual({
      allowed: false,
      reason: 'quota_unavailable',
      shouldRecord: false,
    });
  });

  it('lets Pro users open every conflict check without depending on quota storage', () => {
    expect(
      conflictCheckAccess({
        isPro: true,
        ruleId: 'rule-b',
        seenRuleIds: [],
        quotaAvailable: false,
      }),
    ).toEqual({ allowed: true, reason: 'pro', shouldRecord: false });
  });

  it('distinguishes a missing quota without writing an empty record', async () => {
    await expect(loadFreeConflictCheckRuleIds()).resolves.toEqual({
      status: 'missing',
      ruleIds: [],
    });
    expect(mocks.updatePrivateItem).not.toHaveBeenCalled();
    expect(mocks.writes).toBe(0);
  });

  it('atomically records the first id in a strict versioned envelope', async () => {
    await expect(recordFreeConflictCheckRuleId(' rule-a ')).resolves.toEqual({
      status: 'available',
      format: 'current',
      ruleIds: ['rule-a'],
    });
    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toEqual({
      schemaVersion: 1,
      ruleIds: ['rule-a'],
    });
    expect(mocks.updatePrivateItem).toHaveBeenCalledTimes(1);
  });

  it('reads a normalized legacy array without repairing it, then upgrades on mutation', async () => {
    const legacy = JSON.stringify([' rule-a ', 'rule-a']);
    mocks.storage.set(KEY, legacy);

    await expect(loadFreeConflictCheckRuleIds()).resolves.toEqual({
      status: 'available',
      format: 'legacy',
      ruleIds: ['rule-a'],
    });
    expect(mocks.storage.get(KEY)).toBe(legacy);
    expect(mocks.updatePrivateItem).not.toHaveBeenCalled();

    await expect(recordFreeConflictCheckRuleId('rule-a')).resolves.toMatchObject({
      status: 'available',
      format: 'current',
      ruleIds: ['rule-a'],
    });
    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toEqual({
      schemaVersion: 1,
      ruleIds: ['rule-a'],
    });
  });

  it('classifies malformed bytes as corrupt and preserves them on reads and mutations', async () => {
    const before = '{not-json';
    mocks.storage.set(KEY, before);

    await expect(loadFreeConflictCheckRuleIds()).resolves.toEqual({
      status: 'corrupt',
      ruleIds: null,
    });
    await expect(recordFreeConflictCheckRuleId('rule-a')).resolves.toEqual({
      status: 'corrupt',
      ruleIds: null,
    });
    expect(mocks.storage.get(KEY)).toBe(before);
  });

  it('classifies missing-schema current-shaped data as corrupt without repair', async () => {
    const before = JSON.stringify({ ruleIds: ['rule-a'] });
    mocks.storage.set(KEY, before);

    await expect(loadFreeConflictCheckRuleIds()).resolves.toEqual({
      status: 'corrupt',
      ruleIds: null,
    });
    expect(mocks.storage.get(KEY)).toBe(before);
    expect(mocks.updatePrivateItem).not.toHaveBeenCalled();
  });

  it('classifies and preserves a future schema', async () => {
    const before = JSON.stringify({ schemaVersion: 2, ruleIds: ['rule-a'] });
    mocks.storage.set(KEY, before);

    await expect(loadFreeConflictCheckRuleIds()).resolves.toEqual({
      status: 'unsupported_version',
      ruleIds: null,
    });
    await expect(recordFreeConflictCheckRuleId('rule-b')).resolves.toEqual({
      status: 'unsupported_version',
      ruleIds: null,
    });
    expect(mocks.storage.get(KEY)).toBe(before);
  });

  it('returns typed unavailable on private-storage failure', async () => {
    mocks.getPrivateItem.mockRejectedValueOnce(new Error('secure storage unavailable'));

    await expect(loadFreeConflictCheckRuleIds()).resolves.toEqual({
      status: 'unavailable',
      ruleIds: null,
    });
  });

  it('returns typed unavailable and preserves quota bytes on write failure', async () => {
    const before = JSON.stringify({ schemaVersion: 1, ruleIds: [] });
    mocks.storage.set(KEY, before);
    mocks.updatePrivateItem.mockRejectedValueOnce(new Error('secure storage write unavailable'));

    await expect(recordFreeConflictCheckRuleId('rule-a')).resolves.toEqual({
      status: 'unavailable',
      ruleIds: null,
    });
    expect(mocks.storage.get(KEY)).toBe(before);
  });

  it('does not write blank rule ids into quota history', async () => {
    await expect(recordFreeConflictCheckRuleId('   ')).resolves.toEqual({
      status: 'missing',
      ruleIds: [],
    });
    expect(mocks.updatePrivateItem).not.toHaveBeenCalled();
    expect(mocks.storage.has(KEY)).toBe(false);
  });

  it('does zero writes for a repeated claim in the current canonical format', async () => {
    mocks.storage.set(KEY, JSON.stringify({ schemaVersion: 1, ruleIds: ['rule-a'] }));

    await expect(recordFreeConflictCheckRuleId('rule-a')).resolves.toMatchObject({
      status: 'available',
      ruleIds: ['rule-a'],
    });
    expect(mocks.writes).toBe(0);
  });

  it('allows only one winner across 100 simultaneous distinct free claims', async () => {
    const results = await Promise.all(
      Array.from({ length: 100 }, (_, index) => recordFreeConflictCheckRuleId(`rule-${index}`)),
    );

    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toEqual({
      schemaVersion: 1,
      ruleIds: ['rule-0'],
    });
    expect(results).toHaveLength(100);
    expect(
      results.every(
        (result) =>
          result.status === 'available' &&
          result.ruleIds.length === 1 &&
          result.ruleIds[0] === 'rule-0',
      ),
    ).toBe(true);
  });
});
