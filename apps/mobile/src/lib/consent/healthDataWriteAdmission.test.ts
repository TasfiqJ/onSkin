import { afterEach, describe, expect, it, vi } from 'vitest';

import { runAccountGenerationOperation } from '@/lib/auth/accountGeneration';

import {
  assertHealthDataWriteLease,
  assertHealthDataWriteAllowed,
  assertHealthPurposePrivateDataWriteAllowed,
  captureHealthDataWriteLease,
  captureHealthPurposePrivateDataWriteLease,
  runCurrentHealthDataOperation,
  runHealthDataOperation,
} from './healthDataWriteAdmission';
import {
  clearActiveHealthProcessingEpoch,
  HEALTH_PROCESSING_STATUS_LEASE_MS,
  setActiveHealthProcessingEpoch,
} from './healthProcessingEpoch';

describe('local health-data write admission', () => {
  afterEach(() => {
    clearActiveHealthProcessingEpoch();
    vi.useRealTimers();
  });

  it('blocks classified writes with no epoch or an expired status lease', () => {
    expect(() => assertHealthPurposePrivateDataWriteAllowed('layerwell.skinprofile.v1')).toThrow(
      'HEALTH_DATA_WRITE_ADMISSION_CLOSED',
    );

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-15T12:00:00.000Z'));
    setActiveHealthProcessingEpoch(3, {
      ownerUserId: 'owner-a',
      accountGeneration: 1,
      serverVerifiedAt: '2026-07-15T12:00:00.000Z',
    });
    vi.advanceTimersByTime(HEALTH_PROCESSING_STATUS_LEASE_MS);
    expect(() => assertHealthPurposePrivateDataWriteAllowed('layerwell.skinprofile.v1')).toThrow(
      'HEALTH_DATA_WRITE_ADMISSION_CLOSED',
    );
  });

  it('rejects a foreign expected owner without destroying the valid owner lease', () => {
    setActiveHealthProcessingEpoch(3, {
      ownerUserId: 'owner-a',
      accountGeneration: 1,
      serverVerifiedAt: null,
    });

    expect(() => assertHealthDataWriteAllowed('owner-b')).toThrow(
      'HEALTH_DATA_WRITE_OWNER_MISMATCH',
    );
    expect(() => assertHealthDataWriteAllowed('owner-a')).not.toThrow();
  });

  it('allows classified writes only under a current owner-bound epoch', () => {
    setActiveHealthProcessingEpoch(3, {
      ownerUserId: 'owner-a',
      accountGeneration: 1,
      serverVerifiedAt: null,
    });

    expect(() => assertHealthPurposePrivateDataWriteAllowed('layerwell.skinprofile.v1')).not.toThrow();
    expect(captureHealthPurposePrivateDataWriteLease('layerwell.commerceConsent.v1')).not.toBeNull();
    expect(captureHealthPurposePrivateDataWriteLease('layerwell.communityConsent.v1')).not.toBeNull();
    expect(captureHealthPurposePrivateDataWriteLease('layerwell.communityAge16.v1')).toBeNull();
    // Non-health account and billing records remain outside this purpose gate.
    clearActiveHealthProcessingEpoch();
    expect(() => assertHealthPurposePrivateDataWriteAllowed('layerwell.entitlement.v2')).not.toThrow();
  });

  it('invalidates captured work across clear and same-value re-grant', () => {
    setActiveHealthProcessingEpoch(3, {
      ownerUserId: 'owner-a',
      accountGeneration: 1,
      serverVerifiedAt: null,
    });
    const lease = captureHealthDataWriteLease('owner-a');

    clearActiveHealthProcessingEpoch();
    setActiveHealthProcessingEpoch(3, {
      ownerUserId: 'owner-a',
      accountGeneration: 1,
      serverVerifiedAt: null,
    });

    expect(() => assertHealthDataWriteLease(lease)).toThrow('HEALTH_DATA_WRITE_ADMISSION_CLOSED');
  });

  it('invalidates captured work across a same-owner same-epoch status renewal', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-15T12:00:00.000Z'));
    setActiveHealthProcessingEpoch(3, {
      ownerUserId: 'owner-a',
      accountGeneration: 1,
      serverVerifiedAt: '2026-07-15T12:00:00.000Z',
    });
    const lease = captureHealthDataWriteLease('owner-a');

    vi.advanceTimersByTime(60_000);
    setActiveHealthProcessingEpoch(3, {
      ownerUserId: 'owner-a',
      accountGeneration: 1,
      serverVerifiedAt: '2026-07-15T12:01:00.000Z',
    });

    expect(() => assertHealthDataWriteLease(lease)).toThrow(
      'HEALTH_DATA_WRITE_ADMISSION_CLOSED',
    );
  });

  it('invalidates captured work when its server-status lease expires', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-15T12:00:00.000Z'));
    setActiveHealthProcessingEpoch(3, {
      ownerUserId: 'owner-a',
      accountGeneration: 1,
      serverVerifiedAt: '2026-07-15T12:00:00.000Z',
    });
    const lease = captureHealthDataWriteLease('owner-a');

    vi.advanceTimersByTime(HEALTH_PROCESSING_STATUS_LEASE_MS);

    expect(() => assertHealthDataWriteLease(lease)).toThrow('HEALTH_DATA_WRITE_ADMISSION_CLOSED');
  });

  it('rejects a whole operation after clear and same-owner same-epoch re-grant', async () => {
    let accountGeneration!: number;
    await runAccountGenerationOperation((lease) => {
      accountGeneration = lease.generation;
    });
    setActiveHealthProcessingEpoch(9, {
      ownerUserId: 'owner-a',
      accountGeneration,
      serverVerifiedAt: null,
    });
    let release!: () => void;
    let markStarted!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const operation = runHealthDataOperation('owner-a', async (lease) => {
      markStarted();
      await gate;
      lease.assertCurrent();
    });
    await started;

    clearActiveHealthProcessingEpoch();
    setActiveHealthProcessingEpoch(9, {
      ownerUserId: 'owner-a',
      accountGeneration,
      serverVerifiedAt: null,
    });
    release();

    await expect(operation).rejects.toThrow('HEALTH_DATA_WRITE_ADMISSION_CLOSED');
  });

  it('binds an owner-less local-store API to the exact current owner and lease', async () => {
    let accountGeneration!: number;
    await runAccountGenerationOperation((lease) => {
      accountGeneration = lease.generation;
    });
    setActiveHealthProcessingEpoch(11, {
      ownerUserId: 'owner-a',
      accountGeneration,
      serverVerifiedAt: null,
    });

    let release!: () => void;
    let markStarted!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const operation = runCurrentHealthDataOperation(async () => {
      markStarted();
      await gate;
      return 'stale';
    });
    await started;

    clearActiveHealthProcessingEpoch();
    setActiveHealthProcessingEpoch(11, {
      ownerUserId: 'owner-b',
      accountGeneration,
      serverVerifiedAt: null,
    });
    release();

    await expect(operation).rejects.toThrow('HEALTH_DATA_WRITE_OWNER_MISMATCH');
  });
});
