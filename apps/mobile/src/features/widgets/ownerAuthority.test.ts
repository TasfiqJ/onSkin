import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ROUTINE_WIDGET_OWNER_AUTHORITY_KEY,
  ROUTINE_WIDGET_OWNER_AUTHORITY_STALE,
  ROUTINE_WIDGET_OWNER_AUTHORITY_UNSUPPORTED_VERSION,
  runWithRoutineWidgetOwnerAuthority,
} from './ownerAuthority';

const OLD_GENERATION = '10000000-0000-4000-8000-000000000001';
const NEW_GENERATION = '20000000-0000-4000-8000-000000000002';

const mocks = vi.hoisted(() => ({
  current: null as string | null,
  key: null as string | null,
  ownerArgument: null as string | null,
  randomValues: [] as string[],
  stale: false,
  staleAfterUpdate: false,
  lease: {
    generation: 7,
    epoch: 11,
    ownerUserId: 'owner-a',
    accountGeneration: 13,
    expiresAt: 999_999,
    signal: new AbortController().signal,
    assertCurrent: vi.fn(),
  },
}));

vi.mock('expo-crypto', () => ({
  randomUUID: () => mocks.randomValues.shift() ?? NEW_GENERATION,
}));

vi.mock('@/lib/consent/healthDataWriteAdmission', () => ({
  runHealthDataOperation: async (
    ownerUserId: string,
    operation: (lease: typeof mocks.lease) => unknown,
  ) => {
    mocks.ownerArgument = ownerUserId;
    return operation(mocks.lease);
  },
}));

vi.mock('@/lib/storage/privateKV', () => ({
  updatePrivateItem: async (key: string, updater: (current: string | null) => string | null) => {
    mocks.key = key;
    mocks.current = updater(mocks.current);
    if (mocks.staleAfterUpdate) mocks.stale = true;
  },
}));

function stored(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    accountGeneration: 13,
    ownerGeneration: OLD_GENERATION,
    ownerUserId: 'owner-a',
    processingEpoch: 11,
    processingGeneration: 7,
    schemaVersion: 1,
    ...overrides,
  });
}

beforeEach(() => {
  mocks.current = null;
  mocks.key = null;
  mocks.ownerArgument = null;
  mocks.randomValues = [NEW_GENERATION];
  mocks.stale = false;
  mocks.staleAfterUpdate = false;
  mocks.lease.generation = 7;
  mocks.lease.epoch = 11;
  mocks.lease.ownerUserId = 'owner-a';
  mocks.lease.accountGeneration = 13;
  mocks.lease.assertCurrent.mockReset();
  mocks.lease.assertCurrent.mockImplementation(() => {
    if (mocks.stale) throw new Error('lease stale');
  });
});

describe('routine widget private owner authority', () => {
  it('reuses only the exact owner, processing, and account binding', async () => {
    mocks.current = stored();
    const operation = vi.fn(async (authority) => authority.ownerGeneration);

    await expect(
      runWithRoutineWidgetOwnerAuthority(
        { ownerUserId: 'owner-a', processingEpoch: 11 },
        operation,
      ),
    ).resolves.toBe(OLD_GENERATION);

    expect(mocks.ownerArgument).toBe('owner-a');
    expect(mocks.key).toBe(ROUTINE_WIDGET_OWNER_AUTHORITY_KEY);
    expect(operation).toHaveBeenCalledOnce();
    expect(JSON.parse(mocks.current!)).toEqual(JSON.parse(stored()));
    expect(mocks.randomValues).toEqual([NEW_GENERATION]);
  });

  it.each([
    ['owner', { ownerUserId: 'owner-b' }],
    ['epoch', { processingEpoch: 10 }],
    ['processing generation', { processingGeneration: 6 }],
    ['account generation', { accountGeneration: 12 }],
  ])('rotates for an older %s binding', async (_label, override) => {
    mocks.current = stored(override);

    const authority = await runWithRoutineWidgetOwnerAuthority(
      { ownerUserId: 'owner-a', processingEpoch: 11 },
      async (value) => value,
    );

    expect(authority).toEqual({
      schemaVersion: 1,
      ownerUserId: 'owner-a',
      ownerGeneration: NEW_GENERATION,
      processingEpoch: 11,
      processingGeneration: 7,
      accountGeneration: 13,
    });
    expect(JSON.parse(mocks.current!)).toEqual(authority);
  });

  it('rotates malformed current bytes but preserves and rejects a future schema', async () => {
    mocks.current = '{not-json';
    await expect(
      runWithRoutineWidgetOwnerAuthority(
        { ownerUserId: 'owner-a', processingEpoch: 11 },
        async (authority) => authority.ownerGeneration,
      ),
    ).resolves.toBe(NEW_GENERATION);

    const future = JSON.stringify({ schemaVersion: 2, future: true });
    mocks.current = future;
    const operation = vi.fn();
    await expect(
      runWithRoutineWidgetOwnerAuthority(
        { ownerUserId: 'owner-a', processingEpoch: 11 },
        operation,
      ),
    ).rejects.toThrow(ROUTINE_WIDGET_OWNER_AUTHORITY_UNSUPPORTED_VERSION);
    expect(mocks.current).toBe(future);
    expect(operation).not.toHaveBeenCalled();
  });

  it('rejects an epoch mismatch before private mutation', async () => {
    const operation = vi.fn();
    await expect(
      runWithRoutineWidgetOwnerAuthority(
        { ownerUserId: 'owner-a', processingEpoch: 12 },
        operation,
      ),
    ).rejects.toThrow(ROUTINE_WIDGET_OWNER_AUTHORITY_STALE);
    expect(mocks.key).toBeNull();
    expect(operation).not.toHaveBeenCalled();
  });

  it('never calls native work after the health lease becomes stale', async () => {
    mocks.staleAfterUpdate = true;
    const operation = vi.fn();

    await expect(
      runWithRoutineWidgetOwnerAuthority(
        { ownerUserId: 'owner-a', processingEpoch: 11 },
        operation,
      ),
    ).rejects.toThrow('lease stale');
    expect(operation).not.toHaveBeenCalled();
  });
});
