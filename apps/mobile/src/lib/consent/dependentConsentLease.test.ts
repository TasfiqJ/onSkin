import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runAccountGenerationOperation } from '@/lib/auth/accountGeneration';

import {
  activeHealthDependentConsentLeaseSnapshot,
  assertClosedHealthDependentConsentLease,
  beginHealthDependentConsentCheck,
  beginHealthDependentConsentGrant,
  closeHealthDependentConsent,
  dependentConsentProcessStateForTests,
  publishHealthDependentConsentActive,
  resetHealthDependentConsentLeasesForTests,
  runHealthDependentConsentOperation,
} from './dependentConsentLease';
import {
  clearActiveHealthProcessingEpoch,
  setActiveHealthProcessingEpoch,
} from './healthProcessingEpoch';

describe('health-dependent consent operation leases', () => {
  let accountGeneration = 0;

  beforeEach(async () => {
    resetHealthDependentConsentLeasesForTests();
    clearActiveHealthProcessingEpoch();
    await runAccountGenerationOperation((lease) => {
      accountGeneration = lease.generation;
    });
    setActiveHealthProcessingEpoch(7, {
      ownerUserId: 'user-a',
      accountGeneration,
    });
  });

  afterEach(() => {
    clearActiveHealthProcessingEpoch();
    resetHealthDependentConsentLeasesForTests();
  });

  function activate(type: 'ask_onskin' | 'data_sharing' = 'ask_onskin') {
    const checking = beginHealthDependentConsentCheck(type);
    return publishHealthDependentConsentActive({ lease: checking, serverGeneration: 11 });
  }

  it('binds work to owner, account, base publication, and dependent generation', async () => {
    activate();

    await expect(
      runHealthDependentConsentOperation('ask_onskin', async (lease) => {
        expect(lease.ownerUserId).toBe('user-a');
        expect(lease.healthEpoch).toBe(7);
        expect(lease.serverGeneration).toBe(11);
        lease.assertCurrent();
        return 'ok';
      }),
    ).resolves.toBe('ok');
  });

  it('closes synchronously and invalidates an in-flight disclosure before it resumes', async () => {
    activate('data_sharing');
    let release!: () => void;
    let started!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const didStart = new Promise<void>((resolve) => {
      started = resolve;
    });
    const pending = runHealthDependentConsentOperation('data_sharing', async (lease) => {
      started();
      await gate;
      lease.assertCurrent();
    });
    await didStart;

    const closed = closeHealthDependentConsent('data_sharing', 'user-a');
    expect(dependentConsentProcessStateForTests('user-a', 'data_sharing')?.state).toBe('closed');
    release();

    await expect(pending).rejects.toThrow('HEALTH_DEPENDENT_CONSENT_STALE');
    expect(() => assertClosedHealthDependentConsentLease(closed)).not.toThrow();
  });

  it('does not let a queued grant publish after a later withdrawal', () => {
    const grant = beginHealthDependentConsentGrant('community_participation');
    const closed = closeHealthDependentConsent('community_participation', 'user-a');

    expect(() =>
      publishHealthDependentConsentActive({ lease: grant, serverGeneration: 12 }),
    ).toThrow('HEALTH_DEPENDENT_CONSENT_STALE');
    expect(() => assertClosedHealthDependentConsentLease(closed)).not.toThrow();
  });

  it('rejects close/regrant ABA even when owner and base epoch are numerically identical', async () => {
    const first = activate();
    closeHealthDependentConsent('ask_onskin', 'user-a');
    const secondGrant = beginHealthDependentConsentGrant('ask_onskin');
    const second = publishHealthDependentConsentActive({
      lease: secondGrant,
      serverGeneration: 13,
    });

    expect(second.generation).toBeGreaterThan(first.generation);
    expect(activeHealthDependentConsentLeaseSnapshot('ask_onskin')?.generation).toBe(
      second.generation,
    );
    await expect(
      runHealthDependentConsentOperation('ask_onskin', (lease) => lease.generation),
    ).resolves.toBe(second.generation);
  });

  it('never lets A dependent authority cross into B', async () => {
    activate();
    setActiveHealthProcessingEpoch(7, {
      ownerUserId: 'user-b',
      accountGeneration,
    });

    expect(activeHealthDependentConsentLeaseSnapshot('ask_onskin')).toBeNull();
    await expect(
      runHealthDependentConsentOperation('ask_onskin', async () => undefined),
    ).rejects.toThrow('HEALTH_DEPENDENT_CONSENT_CLOSED');
  });

  it('keeps a privacy-reducing close current across same-owner base renewal', () => {
    activate();
    const closed = closeHealthDependentConsent('ask_onskin', 'user-a');
    clearActiveHealthProcessingEpoch({ ownerUserId: 'user-a' });
    setActiveHealthProcessingEpoch(7, {
      ownerUserId: 'user-a',
      accountGeneration,
    });

    expect(() => assertClosedHealthDependentConsentLease(closed)).not.toThrow();
    expect(activeHealthDependentConsentLeaseSnapshot('ask_onskin')).toBeNull();
  });
});
