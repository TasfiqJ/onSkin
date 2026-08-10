import { createHash } from 'node:crypto';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  HEALTH_DEPENDENT_CONSENT_COPY,
  HEALTH_DEPENDENT_CONSENT_COPY_RELEASE_BLOCKED,
} from './dependentConsentContract';
import { getHealthDependentConsentStatus, getLatestConsents, recordConsent } from './consent';

const mocks = vi.hoisted(() => ({
  appEnvironment: 'development' as 'development' | 'staging' | 'production',
  configured: true,
  digest: vi.fn(),
  getPersistedUser: vi.fn(),
  rpc: vi.fn(),
  rpcResults: new Map<string, { data: unknown; error: unknown }>(),
  from: vi.fn(),
  insert: vi.fn(),
  select: vi.fn(),
  order: vi.fn(),
  queryResult: { data: [] as unknown[], error: null as unknown },
  healthOpen: true,
  healthOwner: 'user-a',
  healthGeneration: 1,
  controller: null as AbortController | null,
}));

vi.mock('@/lib/env', () => ({
  env: {
    get appEnvironment() {
      return mocks.appEnvironment;
    },
  },
  get isSupabaseConfigured() {
    return mocks.configured;
  },
}));
vi.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: mocks.digest,
  getRandomBytesAsync: vi.fn(),
}));
vi.mock('./healthDataWriteAdmission', () => ({
  runCurrentHealthDataOperation: async (
    operation: (lease: {
      ownerUserId: string;
      epoch: number;
      signal: AbortSignal;
      assertCurrent: () => void;
    }) => unknown,
  ) => {
    if (!mocks.healthOpen) throw new Error('HEALTH_DATA_WRITE_ADMISSION_CLOSED');
    const generation = mocks.healthGeneration;
    const owner = mocks.healthOwner;
    const controller = new AbortController();
    mocks.controller = controller;
    const assertCurrent = () => {
      if (
        !mocks.healthOpen ||
        generation !== mocks.healthGeneration ||
        owner !== mocks.healthOwner ||
        controller.signal.aborted
      ) {
        throw new Error('HEALTH_DATA_WRITE_ADMISSION_CLOSED');
      }
    };
    const result = await operation({ ownerUserId: owner, epoch: 7, signal: controller.signal, assertCurrent });
    assertCurrent();
    return result;
  },
}));
vi.mock('../supabase/client', () => ({
  getPersistedSupabaseUser: mocks.getPersistedUser,
  supabase: { rpc: mocks.rpc, from: mocks.from },
}));

function status(
  type: keyof typeof HEALTH_DEPENDENT_CONSENT_COPY,
  state: 'unconsented' | 'active' | 'withdrawing' | 'withdrawn',
  generation: number,
) {
  const copyState = state === 'active' ? 'grant' : 'withdrawal';
  const copy = state === 'unconsented' ? null : HEALTH_DEPENDENT_CONSENT_COPY[type][copyState];
  return [{
    consent_type: type,
    state,
    generation,
    health_epoch: 7,
    version: copy?.version ?? null,
    consent_text_hash: copy?.sha256 ?? null,
  }];
}

describe('exact consent backend contract', () => {
  beforeEach(() => {
    mocks.appEnvironment = 'development';
    mocks.configured = true;
    mocks.healthOpen = true;
    mocks.healthOwner = 'user-a';
    mocks.healthGeneration = 1;
    mocks.controller = null;
    mocks.digest.mockReset();
    mocks.digest.mockImplementation(async (_algorithm: string, text: string) =>
      createHash('sha256').update(text, 'utf8').digest('hex'),
    );
    mocks.getPersistedUser.mockReset();
    mocks.getPersistedUser.mockResolvedValue({ data: { user: { id: 'user-a' } }, error: null });
    mocks.rpcResults.clear();
    mocks.rpc.mockReset();
    mocks.rpc.mockImplementation((name: string) => ({
      abortSignal: vi.fn(async () =>
        mocks.rpcResults.get(name) ?? { data: null, error: new Error(`missing ${name}`) },
      ),
    }));
    mocks.insert.mockReset();
    mocks.insert.mockResolvedValue({ error: null });
    mocks.order.mockReset();
    const query = {
      order: mocks.order,
      then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve(mocks.queryResult).then(resolve, reject),
    };
    mocks.order.mockReturnValue(query);
    mocks.select.mockReset();
    mocks.select.mockReturnValue(query);
    mocks.from.mockReset();
    mocks.from.mockReturnValue({ insert: mocks.insert, select: mocks.select });
    mocks.queryResult = { data: [], error: null };
  });

  it('rejects every protected direct granted=false write before hashing or network', async () => {
    for (const type of Object.keys(HEALTH_DEPENDENT_CONSENT_COPY) as (keyof typeof HEALTH_DEPENDENT_CONSENT_COPY)[]) {
      await expect(
        recordConsent({ type, granted: false, version: 'x', consentText: 'x' }),
      ).rejects.toThrow('HEALTH_DEPENDENT_WITHDRAWAL_RPC_REQUIRED');
    }
    expect(mocks.digest).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('performs an exact generation CAS with a strong per-action idempotency key', async () => {
    const copy = HEALTH_DEPENDENT_CONSENT_COPY.data_sharing.grant;
    mocks.rpcResults.set('record_health_dependent_consent', {
      data: status('data_sharing', 'active', 9),
      error: null,
    });
    const result = await recordConsent({
      type: 'data_sharing',
      granted: true,
      version: copy.version,
      consentText: copy.text,
      expectedGeneration: 8,
      idempotencyKey: 'ab'.repeat(32),
      expectedUserId: 'user-a',
    });
    expect(result).toMatchObject({ state: 'active', generation: 9, healthEpoch: 7 });
    expect(mocks.rpc).toHaveBeenCalledWith('record_health_dependent_consent', {
      p_expected_epoch: 7,
      p_expected_generation: 8,
      p_idempotency_key: 'ab'.repeat(32),
      p_consent_type: 'data_sharing',
      p_version: copy.version,
      p_consent_text_hash: copy.sha256,
    });
  });

  it('rejects a grant attestation that skips a generation or adds response fields', async () => {
    const copy = HEALTH_DEPENDENT_CONSENT_COPY.data_sharing.grant;
    const request = () => recordConsent({
      type: 'data_sharing',
      granted: true,
      version: copy.version,
      consentText: copy.text,
      expectedGeneration: 8,
      idempotencyKey: 'ac'.repeat(32),
      expectedUserId: 'user-a',
    });
    mocks.rpcResults.set('record_health_dependent_consent', {
      data: status('data_sharing', 'active', 10),
      error: null,
    });
    await expect(request()).rejects.toThrow('HEALTH_DEPENDENT_CONSENT_STATUS_INVALID');

    mocks.rpcResults.set('record_health_dependent_consent', {
      data: [{ ...status('data_sharing', 'active', 9)[0], unexpected: true }],
      error: null,
    });
    await expect(request()).rejects.toThrow('HEALTH_DEPENDENT_CONSENT_STATUS_INVALID');
  });

  it('accepts an exact initial unconsented status with the active base-health epoch', async () => {
    mocks.rpcResults.set('get_health_dependent_consent_status', {
      data: status('photo_capture', 'unconsented', 0),
      error: null,
    });

    await expect(getHealthDependentConsentStatus('photo_capture')).resolves.toEqual({
      consentType: 'photo_capture',
      state: 'unconsented',
      generation: 0,
      healthEpoch: 7,
      version: null,
      consentTextHash: null,
    });
  });

  it('allows production status reads but blocks a new production grant before mutation', async () => {
    mocks.appEnvironment = 'production';
    mocks.rpcResults.set('get_health_dependent_consent_status', {
      data: status('data_sharing', 'unconsented', 0),
      error: null,
    });

    await expect(getHealthDependentConsentStatus('data_sharing')).resolves.toMatchObject({
      state: 'unconsented',
      generation: 0,
    });
    const rpcCallsAfterStatus = mocks.rpc.mock.calls.length;
    const copy = HEALTH_DEPENDENT_CONSENT_COPY.data_sharing.grant;
    await expect(
      recordConsent({
        type: 'data_sharing',
        granted: true,
        version: copy.version,
        consentText: copy.text,
        expectedGeneration: 0,
        idempotencyKey: 'ab'.repeat(32),
        expectedUserId: 'user-a',
      }),
    ).rejects.toThrow(HEALTH_DEPENDENT_CONSENT_COPY_RELEASE_BLOCKED);
    expect(mocks.rpc).toHaveBeenCalledTimes(rpcCallsAfterStatus);
  });

  it('rejects wrong copy, foreign owner, and malformed authoritative status', async () => {
    await expect(
      recordConsent({
        type: 'ask_layerwell',
        granted: true,
        version: 'stale',
        consentText: 'wrong',
        expectedGeneration: 1,
        idempotencyKey: 'cd'.repeat(32),
      }),
    ).rejects.toThrow('HEALTH_DEPENDENT_CONSENT_COPY_INVALID');
    expect(mocks.rpc).not.toHaveBeenCalled();

    const copy = HEALTH_DEPENDENT_CONSENT_COPY.ask_layerwell.grant;
    mocks.getPersistedUser.mockResolvedValueOnce({ data: { user: { id: 'user-b' } }, error: null });
    await expect(
      recordConsent({
        type: 'ask_layerwell',
        granted: true,
        version: copy.version,
        consentText: copy.text,
        expectedGeneration: 1,
        idempotencyKey: 'ef'.repeat(32),
      }),
    ).rejects.toThrow('CONSENT_OWNER_CHANGED');

    mocks.rpcResults.set('get_health_dependent_consent_status', {
      data: [{ ...status('ask_layerwell', 'active', 2)[0], consent_text_hash: '0'.repeat(64) }],
      error: null,
    });
    await expect(getHealthDependentConsentStatus('ask_layerwell')).rejects.toThrow(
      'HEALTH_DEPENDENT_CONSENT_STATUS_INVALID',
    );
  });

  it('returns deterministic receipt shapes and orders withdrawal before grant ties', async () => {
    mocks.queryResult = {
      data: [
        {
          id: 'b', consent_type: 'marketing', granted: false,
          granted_at: '2026-07-15T00:00:00.000Z', version: 'v2', consent_text_hash: 'b'.repeat(64),
        },
        {
          id: 'a', consent_type: 'marketing', granted: true,
          granted_at: '2026-07-15T00:00:00.000Z', version: 'v1', consent_text_hash: 'a'.repeat(64),
        },
      ],
      error: null,
    };
    await expect(getLatestConsents()).resolves.toEqual({
      marketing: {
        id: 'b', consentType: 'marketing', granted: false,
        grantedAt: '2026-07-15T00:00:00.000Z', version: 'v2', consentTextHash: 'b'.repeat(64),
      },
    });
    expect(mocks.select).toHaveBeenCalledWith(
      'id, consent_type, granted, granted_at, version, consent_text_hash',
    );
    expect(mocks.order.mock.calls).toEqual([
      ['granted_at', { ascending: false }],
      ['granted', { ascending: true }],
      ['id', { ascending: false }],
    ]);
  });

  it('does not touch placeholder Supabase when unconfigured', async () => {
    mocks.configured = false;
    await expect(getLatestConsents()).resolves.toEqual({});
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
