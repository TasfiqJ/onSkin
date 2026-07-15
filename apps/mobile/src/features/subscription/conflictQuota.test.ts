import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { runAccountGenerationOperation } from '@/lib/auth/accountGeneration';
import {
  clearActiveHealthProcessingEpoch,
  setActiveHealthProcessingEpoch,
} from '@/lib/consent/healthProcessingEpoch';

import {
  conflictCheckAccess,
  loadFreeConflictCheckRuleIds,
  recordFreeConflictCheckRuleId,
} from './conflictQuota';

const mocks = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  readGate: null as Promise<void> | null,
  readStarted: null as (() => void) | null,
  writes: 0,
}));

vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: vi.fn(async (key: string) => {
    mocks.readStarted?.();
    if (mocks.readGate) await mocks.readGate;
    return mocks.storage.get(key) ?? null;
  }),
  setPrivateItem: vi.fn(async (key: string, value: string) => {
    mocks.storage.set(key, value);
    mocks.writes += 1;
  }),
  removePrivateItem: vi.fn(async (key: string) => {
    mocks.storage.delete(key);
    mocks.writes += 1;
  }),
}));

const KEY = 'onskin.subscription.freeConflictCheckRuleIds.v1';
let accountGeneration = 0;

describe('free conflict-check quota', () => {
  beforeEach(async () => {
    mocks.storage.clear();
    mocks.readGate = null;
    mocks.readStarted = null;
    mocks.writes = 0;
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
    await expect(recordFreeConflictCheckRuleId(' rule-a ')).resolves.toEqual(['rule-a']);
    await expect(recordFreeConflictCheckRuleId('rule-a')).resolves.toEqual(['rule-a']);

    await expect(loadFreeConflictCheckRuleIds()).resolves.toEqual(['rule-a']);
  });

  it('removes malformed persisted quota state', async () => {
    mocks.storage.set(KEY, '{not-json');

    await expect(loadFreeConflictCheckRuleIds()).resolves.toEqual([]);
    expect(mocks.storage.has(KEY)).toBe(false);
  });

  it('normalizes duplicate and invalid persisted rule ids', async () => {
    mocks.storage.set(KEY, JSON.stringify([' rule-a ', '', 'rule-a', 42, ' rule-b ']));

    await expect(loadFreeConflictCheckRuleIds()).resolves.toEqual(['rule-a', 'rule-b']);
    expect(JSON.parse(mocks.storage.get(KEY) ?? '[]')).toEqual(['rule-a', 'rule-b']);
  });

  it('does not write blank rule ids into quota history', async () => {
    await expect(recordFreeConflictCheckRuleId('   ')).resolves.toEqual([]);
    expect(mocks.storage.has(KEY)).toBe(false);
  });

  it('does not repair or return quota bytes after close and same-epoch re-grant', async () => {
    const original = JSON.stringify([' rule-a ', '', 'rule-a']);
    mocks.storage.set(KEY, original);
    let releaseRead!: () => void;
    let markReadStarted!: () => void;
    mocks.readGate = new Promise<void>((resolve) => {
      releaseRead = resolve;
    });
    const readStarted = new Promise<void>((resolve) => {
      markReadStarted = resolve;
    });
    mocks.readStarted = markReadStarted;

    const pending = loadFreeConflictCheckRuleIds();
    await readStarted;
    clearActiveHealthProcessingEpoch();
    setActiveHealthProcessingEpoch(1, {
      ownerUserId: 'user-a',
      accountGeneration,
    });
    releaseRead();

    await expect(pending).rejects.toThrow('HEALTH_DATA_WRITE_ADMISSION_CLOSED');
    expect(mocks.storage.get(KEY)).toBe(original);
    expect(mocks.writes).toBe(0);
  });
});
