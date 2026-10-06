import { runAccountGenerationOperation } from '@/lib/auth/accountGeneration';

import { activeHealthProcessingLeaseSnapshot } from './healthProcessingEpoch';

export const HEALTH_DATA_WRITE_ADMISSION_CLOSED = 'HEALTH_DATA_WRITE_ADMISSION_CLOSED';
export const HEALTH_DATA_WRITE_OWNER_MISMATCH = 'HEALTH_DATA_WRITE_OWNER_MISMATCH';

/**
 * Private records whose continued existence depends on health-data consent.
 * Consent/lifecycle authority, Auth, billing, entitlement, App Lock, and
 * commerce recovery records are deliberately outside this set.
 */
export const HEALTH_PURPOSE_PRIVATE_DATA_KEYS = [
  'layerwell.ask.consent.v1',
  'layerwell.ask.groundedTurns.v1',
  'layerwell.catalog.lookupQueue.v1',
  'layerwell.commerceConsent.v1',
  'layerwell.communityConsent.v1',
  'layerwell.community.reactions.v1',
  'layerwell.completions.firstCompletion.v1',
  'layerwell.completions.pending',
  'layerwell.completions.v1',
  'layerwell.conflict.overrides',
  'layerwell.cycle.v1',
  'layerwell.cycleAnchor',
  'layerwell.milestones.v1',
  'layerwell.notifPrefs.v1',
  'layerwell.notiflog.v1',
  'layerwell.photos.captureConsent',
  'layerwell.photos.captureConsent.v1',
  'layerwell.photos.cloudBackup',
  'layerwell.photos.deleteJournal.v1',
  'layerwell.photos.v1',
  'layerwell.ramp.v1',
  'layerwell.recDismissed.v1',
  'layerwell.recPrefs.v1',
  'layerwell.reviewPrompt.v1',
  'layerwell.cycle.v2',
  'layerwell.routineActivation.v1',
  'layerwell.routineOrder.v1',
  'layerwell.widgetActionMap.v1',
  'layerwell.widgetActionMap.v2',
  'layerwell.widgetOwnerAuthority.v1',
  'layerwell.shelf.v1',
  'layerwell.skinprofile.v1',
  'layerwell.subscription.freeConflictCheckRuleIds.v1',
  'layerwell.trendInsights.v1',
  'layerwell.trendState.v1',
] as const;

const HEALTH_PURPOSE_KEYS = new Set<string>(HEALTH_PURPOSE_PRIVATE_DATA_KEYS);

export type HealthDataWriteLease = Readonly<{
  generation: number;
  epoch: number;
  ownerUserId: string;
  accountGeneration: number;
  expiresAt: number | null;
}>;

export type HealthDataWriteOperationLease = HealthDataWriteLease &
  Readonly<{
    signal: AbortSignal;
    assertCurrent: () => void;
  }>;

export function isHealthPurposePrivateDataKey(key: string): boolean {
  return HEALTH_PURPOSE_KEYS.has(key);
}

/** Capture the exact owner/epoch authorization a multi-await write starts under. */
export function captureHealthDataWriteLease(expectedOwnerUserId?: string): HealthDataWriteLease {
  const active = activeHealthProcessingLeaseSnapshot();
  if (active === null || active.ownerUserId === null || active.accountGeneration === null) {
    throw new Error(HEALTH_DATA_WRITE_ADMISSION_CLOSED);
  }
  if (expectedOwnerUserId !== undefined && active.ownerUserId !== expectedOwnerUserId) {
    throw new Error(HEALTH_DATA_WRITE_OWNER_MISMATCH);
  }
  return Object.freeze({
    generation: active.generation,
    epoch: active.epoch,
    ownerUserId: active.ownerUserId,
    accountGeneration: active.accountGeneration,
    expiresAt: active.expiresAt,
  });
}

/** Reassert that no withdrawal, expiry, owner transition, or re-grant occurred. */
export function assertHealthDataWriteLease(lease: HealthDataWriteLease): void {
  const active = activeHealthProcessingLeaseSnapshot();
  if (active === null || active.ownerUserId === null || active.accountGeneration === null) {
    throw new Error(HEALTH_DATA_WRITE_ADMISSION_CLOSED);
  }
  if (active.ownerUserId !== lease.ownerUserId) {
    throw new Error(HEALTH_DATA_WRITE_OWNER_MISMATCH);
  }
  if (
    active.generation !== lease.generation ||
    active.epoch !== lease.epoch ||
    active.accountGeneration !== lease.accountGeneration
  ) {
    throw new Error(HEALTH_DATA_WRITE_ADMISSION_CLOSED);
  }
}

/**
 * Runs a cloud/private mirror under one immutable account + health authority.
 * Call `lease.assertCurrent()` immediately before each irreversible dispatch
 * or final local queue mutation when the callback performs preparatory awaits.
 */
export function runHealthDataOperation<T>(
  expectedOwnerUserId: string,
  operation: (lease: HealthDataWriteOperationLease) => T | Promise<T>,
): Promise<T> {
  const healthLease = captureHealthDataWriteLease(expectedOwnerUserId);
  return runAccountGenerationOperation(async (accountLease) => {
    const assertCurrent = () => {
      accountLease.assertCurrent();
      assertHealthDataWriteLease(healthLease);
      if (healthLease.accountGeneration !== accountLease.generation) {
        throw new Error(HEALTH_DATA_WRITE_ADMISSION_CLOSED);
      }
    };
    const operationLease = Object.freeze({
      ...healthLease,
      signal: accountLease.signal,
      assertCurrent,
    });
    assertCurrent();
    const result = await operation(operationLease);
    assertCurrent();
    return result;
  });
}

export const runHealthDataWriteOperation = runHealthDataOperation;

/**
 * Captures the currently-published owner at the synchronous operation entry.
 * This is for local feature stores whose public API has no user-id parameter.
 * The delegated operation still owns one immutable account + health lease, so
 * a close/re-grant (including an identical numeric epoch) cannot be inherited.
 */
export function runCurrentHealthDataOperation<T>(
  operation: (lease: HealthDataWriteOperationLease) => T | Promise<T>,
): Promise<T> {
  const active = activeHealthProcessingLeaseSnapshot();
  if (active?.ownerUserId === null || active?.ownerUserId === undefined) {
    return Promise.reject(new Error(HEALTH_DATA_WRITE_ADMISSION_CLOSED));
  }
  return runHealthDataOperation(active.ownerUserId, operation);
}

export function assertHealthDataWriteAllowed(expectedOwnerUserId?: string): void {
  captureHealthDataWriteLease(expectedOwnerUserId);
}

export function captureHealthPurposePrivateDataWriteLease(
  key: string,
): HealthDataWriteLease | null {
  return isHealthPurposePrivateDataKey(key) ? captureHealthDataWriteLease() : null;
}

export function assertHealthPurposePrivateDataWriteAllowed(key: string): void {
  if (isHealthPurposePrivateDataKey(key)) assertHealthDataWriteAllowed();
}
