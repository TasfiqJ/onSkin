import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AGE_POLICY_RECEIPT_KEY } from './ageGate';
import {
  AGE_POLICY_REVERIFICATION_TOMBSTONE,
  AGE_POLICY_REVERIFICATION_TOMBSTONE_BYTES,
  classifyAgePolicyReceipt,
  CURRENT_AGE_POLICY_RECEIPT,
  CURRENT_AGE_POLICY_RECEIPT_BYTES,
  getAgePolicyReceiptStatus,
  getAgeVerified,
  setAgeVerified,
} from './ageGateStore';

const mocks = vi.hoisted(() => ({
  privateKV: new Map<string, string>(),
  getPrivateItem: vi.fn(async (key: string) => mocks.privateKV.get(key) ?? null),
  setPrivateItem: vi.fn(async (key: string, value: string) => {
    mocks.privateKV.set(key, value);
  }),
  removePrivateItem: vi.fn(async (key: string) => {
    mocks.privateKV.delete(key);
  }),
}));

vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: mocks.getPrivateItem,
  setPrivateItem: mocks.setPrivateItem,
  removePrivateItem: mocks.removePrivateItem,
}));

describe('age-policy receipt', () => {
  beforeEach(() => {
    mocks.privateKV.clear();
    vi.clearAllMocks();
  });

  it('stores the one exact current receipt without DOB, year, age, timestamp, or underage bytes', async () => {
    await setAgeVerified(true);

    await expect(getAgeVerified()).resolves.toBe(true);
    const raw = mocks.privateKV.get(AGE_POLICY_RECEIPT_KEY);
    expect(raw).toBe(CURRENT_AGE_POLICY_RECEIPT_BYTES);
    expect(raw).toBe(
      `{"receipt_version":1,"policy_sha256":"${CURRENT_AGE_POLICY_RECEIPT.policy_sha256}","eligible":true}`,
    );
    expect(Object.keys(JSON.parse(raw!)).sort()).toEqual([
      'eligible',
      'policy_sha256',
      'receipt_version',
    ]);
    expect(raw).not.toMatch(/birth|dob|year|age|timestamp|underage/i);
  });

  it('reports a missing receipt and fails closed', async () => {
    await expect(getAgePolicyReceiptStatus()).resolves.toBe('missing');
    await expect(getAgeVerified()).resolves.toBe(false);
    expect(mocks.setPrivateItem).not.toHaveBeenCalled();
  });

  it.each(['true', 'FALSE', 'v1:1', 'v1:0'])(
    'classifies legacy receipt %s and fails closed without repair',
    async (legacy) => {
      mocks.privateKV.set(AGE_POLICY_RECEIPT_KEY, legacy);

      await expect(getAgePolicyReceiptStatus()).resolves.toBe('legacy');
      await expect(getAgeVerified()).resolves.toBe(false);
      expect(mocks.privateKV.get(AGE_POLICY_RECEIPT_KEY)).toBe(legacy);
      expect(mocks.setPrivateItem).not.toHaveBeenCalled();
    },
  );

  it.each([
    'verified',
    '',
    '{',
    'null',
    '{"receipt_version":1,"policy_sha256":"not-a-sha","eligible":true}',
    `{"receipt_version":1,"policy_sha256":"${CURRENT_AGE_POLICY_RECEIPT.policy_sha256}","eligible":false}`,
    `{"receipt_version":1,"policy_sha256":"${CURRENT_AGE_POLICY_RECEIPT.policy_sha256}","eligible":true,"extra":"rejected"}`,
  ])('classifies malformed receipt %s as invalid without repair', async (malformed) => {
    mocks.privateKV.set(AGE_POLICY_RECEIPT_KEY, malformed);

    await expect(getAgePolicyReceiptStatus()).resolves.toBe('invalid');
    await expect(getAgeVerified()).resolves.toBe(false);
    expect(mocks.privateKV.get(AGE_POLICY_RECEIPT_KEY)).toBe(malformed);
    expect(mocks.setPrivateItem).not.toHaveBeenCalled();
  });

  it.each([
    'v2:1',
    `{"receipt_version":2,"policy_sha256":"${CURRENT_AGE_POLICY_RECEIPT.policy_sha256}","eligible":true}`,
  ])('fails closed for unsupported future receipt %s without repair', async (future) => {
    mocks.privateKV.set(AGE_POLICY_RECEIPT_KEY, future);

    await expect(getAgePolicyReceiptStatus()).resolves.toBe('unsupported');
    await expect(getAgeVerified()).resolves.toBe(false);
    expect(mocks.privateKV.get(AGE_POLICY_RECEIPT_KEY)).toBe(future);
    expect(mocks.setPrivateItem).not.toHaveBeenCalled();
  });

  it('fails closed for a well-formed stale-policy receipt without repair', async () => {
    const stale = JSON.stringify({
      receipt_version: 1,
      policy_sha256: '0'.repeat(64),
      eligible: true,
    });
    mocks.privateKV.set(AGE_POLICY_RECEIPT_KEY, stale);

    await expect(getAgePolicyReceiptStatus()).resolves.toBe('policy_mismatch');
    await expect(getAgeVerified()).resolves.toBe(false);
    expect(mocks.privateKV.get(AGE_POLICY_RECEIPT_KEY)).toBe(stale);
    expect(mocks.setPrivateItem).not.toHaveBeenCalled();
  });

  it('allows a fresh eligible evaluation to replace a stale-policy receipt', async () => {
    mocks.privateKV.set(
      AGE_POLICY_RECEIPT_KEY,
      JSON.stringify({
        receipt_version: 1,
        policy_sha256: '0'.repeat(64),
        eligible: true,
      }),
    );

    await setAgeVerified(true);

    expect(mocks.privateKV.get(AGE_POLICY_RECEIPT_KEY)).toBe(CURRENT_AGE_POLICY_RECEIPT_BYTES);
    await expect(getAgePolicyReceiptStatus()).resolves.toBe('current');
  });

  it('stores only a minimized re-verification tombstone for a non-affirmative evaluation', async () => {
    await setAgeVerified(false);

    expect(mocks.setPrivateItem).toHaveBeenCalledWith(
      AGE_POLICY_RECEIPT_KEY,
      AGE_POLICY_REVERIFICATION_TOMBSTONE_BYTES,
    );
    expect(mocks.removePrivateItem).not.toHaveBeenCalled();
    expect(mocks.privateKV.get(AGE_POLICY_RECEIPT_KEY)).toBe(
      AGE_POLICY_REVERIFICATION_TOMBSTONE_BYTES,
    );
    expect(JSON.parse(AGE_POLICY_REVERIFICATION_TOMBSTONE_BYTES)).toEqual(
      AGE_POLICY_REVERIFICATION_TOMBSTONE,
    );
    expect(AGE_POLICY_REVERIFICATION_TOMBSTONE_BYTES).not.toMatch(
      /birth|dob|year|age|threshold|underage|eligible|reason/i,
    );
    expect(classifyAgePolicyReceipt(AGE_POLICY_REVERIFICATION_TOMBSTONE_BYTES)).toBe(
      'reverification_required',
    );
    await expect(getAgeVerified()).resolves.toBe(false);
  });

  it('atomically overwrites an older affirmative receipt with the fail-closed tombstone', async () => {
    mocks.privateKV.set(AGE_POLICY_RECEIPT_KEY, CURRENT_AGE_POLICY_RECEIPT_BYTES);

    await setAgeVerified(false);

    expect(mocks.privateKV.get(AGE_POLICY_RECEIPT_KEY)).toBe(
      AGE_POLICY_REVERIFICATION_TOMBSTONE_BYTES,
    );
    await expect(getAgeVerified()).resolves.toBe(false);
  });

  it('atomically replaces a re-verification tombstone after a later eligible evaluation', async () => {
    mocks.privateKV.set(AGE_POLICY_RECEIPT_KEY, AGE_POLICY_REVERIFICATION_TOMBSTONE_BYTES);

    await setAgeVerified(true);

    expect(mocks.privateKV.get(AGE_POLICY_RECEIPT_KEY)).toBe(CURRENT_AGE_POLICY_RECEIPT_BYTES);
    await expect(getAgePolicyReceiptStatus()).resolves.toBe('current');
  });

  it('reports a failed tombstone overwrite and does not claim the old receipt was durably revoked', async () => {
    mocks.privateKV.set(AGE_POLICY_RECEIPT_KEY, CURRENT_AGE_POLICY_RECEIPT_BYTES);
    mocks.setPrivateItem.mockRejectedValueOnce(new Error('private kv unavailable'));

    await expect(setAgeVerified(false)).rejects.toThrow('private kv unavailable');
    expect(mocks.privateKV.get(AGE_POLICY_RECEIPT_KEY)).toBe(CURRENT_AGE_POLICY_RECEIPT_BYTES);
  });

  it('reports unavailable and fails closed without rewriting when private storage cannot be read', async () => {
    mocks.getPrivateItem.mockRejectedValueOnce(new Error('private kv unavailable'));

    await expect(getAgePolicyReceiptStatus()).resolves.toBe('unavailable');
    expect(mocks.setPrivateItem).not.toHaveBeenCalled();

    mocks.getPrivateItem.mockRejectedValueOnce(new Error('private kv unavailable'));
    await expect(getAgeVerified()).resolves.toBe(false);
  });
});
