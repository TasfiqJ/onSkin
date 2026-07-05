import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  conflictCheckAccess,
  loadFreeConflictCheckRuleIds,
  recordFreeConflictCheckRuleId,
} from './conflictQuota';

const mocks = vi.hoisted(() => ({
  storage: new Map<string, string>(),
}));

vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: vi.fn(async (key: string) => mocks.storage.get(key) ?? null),
  setPrivateItem: vi.fn(async (key: string, value: string) => {
    mocks.storage.set(key, value);
  }),
}));

describe('free conflict-check quota', () => {
  beforeEach(() => {
    mocks.storage.clear();
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
      conflictCheckAccess({ isPro: false, ruleId: 'rule-a', seenRuleIds: ['rule-a'] }),
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

  it('lets Pro users open every conflict check', () => {
    expect(conflictCheckAccess({ isPro: true, ruleId: 'rule-b', seenRuleIds: ['rule-a'] })).toEqual(
      {
        allowed: true,
        reason: 'pro',
        shouldRecord: false,
      },
    );
  });

  it('persists rule ids once', async () => {
    await expect(recordFreeConflictCheckRuleId('rule-a')).resolves.toEqual(['rule-a']);
    await expect(recordFreeConflictCheckRuleId('rule-a')).resolves.toEqual(['rule-a']);

    await expect(loadFreeConflictCheckRuleIds()).resolves.toEqual(['rule-a']);
  });
});
