import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  COMMERCE_ADMISSION_CLOSED,
  declineCommerceConsent,
  grantCommerceConsent,
  isCommerceConsented,
  refuseCommerceConsent,
} from './consent';

const mocks = vi.hoisted(() => ({
  refuse: vi.fn(),
  withdraw: vi.fn(),
  clear: vi.fn(),
}));

vi.mock('@/lib/consent/dependentConsentLifecycle', () => ({
  refuseHealthDependentConsent: mocks.refuse,
  withdrawHealthDependentConsent: mocks.withdraw,
}));
vi.mock('./store', () => ({ clearCommerceState: mocks.clear }));

describe('COM-01A commerce consent boundary', () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.refuse.mockResolvedValue(undefined);
    mocks.withdraw.mockResolvedValue(undefined);
  });

  it('always resolves closed without consulting consent authority or storage', async () => {
    await expect(isCommerceConsented()).resolves.toBe(false);
    expect(mocks.refuse).not.toHaveBeenCalled();
    expect(mocks.withdraw).not.toHaveBeenCalled();
    expect(mocks.clear).not.toHaveBeenCalled();
  });

  it('throws before every side effect when a positive grant is attempted', async () => {
    await expect(grantCommerceConsent()).rejects.toThrow(COMMERCE_ADMISSION_CLOSED);
    expect(mocks.refuse).not.toHaveBeenCalled();
    expect(mocks.withdraw).not.toHaveBeenCalled();
    expect(mocks.clear).not.toHaveBeenCalled();
  });

  it('retains explicit withdrawal cleanup and records success only after completion', async () => {
    await expect(declineCommerceConsent()).resolves.toBeUndefined();
    expect(mocks.withdraw).toHaveBeenCalledWith({
      type: 'data_sharing',
      deleteLocal: mocks.clear,
    });
  });

  it('cannot report a failed withdrawal as successful', async () => {
    mocks.withdraw.mockRejectedValueOnce(new Error('withdrawal pending'));
    await expect(declineCommerceConsent()).rejects.toThrow('withdrawal pending');
  });

  it('retains never-consented refusal cleanup without opening admission', async () => {
    await expect(refuseCommerceConsent()).resolves.toBeUndefined();
    expect(mocks.refuse).toHaveBeenCalledWith({
      type: 'data_sharing',
      deleteLocal: mocks.clear,
    });
    expect(mocks.withdraw).not.toHaveBeenCalled();
  });
});
