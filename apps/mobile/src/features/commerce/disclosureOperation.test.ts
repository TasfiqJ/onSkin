import { beforeEach, describe, expect, it, vi } from 'vitest';

import { runCommerceDisclosure } from './disclosureOperation';

const mocks = vi.hoisted(() => ({ leaseOpen: true }));
vi.mock('@/lib/consent/dependentConsentLease', () => ({
  runHealthDependentConsentOperation: async (
    type: string,
    operation: (lease: { assertCurrent: () => void }) => Promise<unknown>,
  ) => {
    if (type !== 'data_sharing') throw new Error('wrong type');
    const assertCurrent = () => {
      if (!mocks.leaseOpen) throw new Error('HEALTH_DEPENDENT_CONSENT_STALE');
    };
    assertCurrent();
    const result = await operation({ assertCurrent });
    assertCurrent();
    return result;
  },
}));

describe('commerce disclosure operation', () => {
  beforeEach(() => { mocks.leaseOpen = true; });

  it('does nothing when exact refresh is closed', async () => {
    const confirmServerClick = vi.fn();
    const finalAction = vi.fn();
    await expect(runCommerceDisclosure({
      refreshConsent: async () => false,
      confirmServerClick,
      finalAction,
    })).resolves.toBe('consent_closed');
    expect(confirmServerClick).not.toHaveBeenCalled();
    expect(finalAction).not.toHaveBeenCalled();
  });

  it('never opens after a server insert refusal', async () => {
    const finalAction = vi.fn();
    await expect(runCommerceDisclosure({
      refreshConsent: async () => true,
      confirmServerClick: async () => { throw new Error('insert refused'); },
      finalAction,
    })).rejects.toThrow('insert refused');
    expect(finalAction).not.toHaveBeenCalled();
  });

  it('never opens when consent is revoked during a delayed click confirmation', async () => {
    let release!: () => void;
    let started!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const didStart = new Promise<void>((resolve) => { started = resolve; });
    const finalAction = vi.fn();
    const pending = runCommerceDisclosure({
      refreshConsent: async () => true,
      confirmServerClick: async () => { started(); await gate; },
      finalAction,
    });
    await didStart;
    mocks.leaseOpen = false;
    release();
    await expect(pending).rejects.toThrow('HEALTH_DEPENDENT_CONSENT_STALE');
    expect(finalAction).not.toHaveBeenCalled();
  });
});
