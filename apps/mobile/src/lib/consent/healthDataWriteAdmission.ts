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
  'onskin.ask.consent.v1',
  'onskin.ask.groundedTurns.v1',
  'routinekind.catalog.lookupQueue.v1',
  'onskin.commerceConsent.v1',
  'onskin.communityConsent.v1',
  'onskin.community.reactions.v1',
  'onskin.completions.firstCompletion.v1',
  'onskin.completions.pending',
  'onskin.completions.v1',
  'onskin.conflict.overrides',
  'onskin.cycle.v1',
  'onskin.cycleAnchor',
  'onskin.milestones.v1',
  'onskin.notifPrefs.v1',
  'onskin.notiflog.v1',
  'onskin.photos.captureConsent',
  'onskin.photos.captureConsent.v1',
  'onskin.photos.cloudBackup',
  'onskin.photos.v1',
  'onskin.ramp.v1',
  'onskin.recDismissed.v1',
  'onskin.recPrefs.v1',
  'onskin.reviewPrompt.v1',
  'routinekind.cycle.v2',
  'routinekind.routineActivation.v1',
  'routinekind.routineOrder.v1',
  'routinekind.widgetActionMap.v1',
  'routinekind.widgetActionMap.v2',
  'routinekind.widgetOwnerAuthority.v1',
  'onskin.shelf.v1',
  'onskin.skinprofile.v1',
  'onskin.subscription.freeConflictCheckRuleIds.v1',
  'onskin.trendInsights.v1',
  'onskin.trendState.v1',
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
