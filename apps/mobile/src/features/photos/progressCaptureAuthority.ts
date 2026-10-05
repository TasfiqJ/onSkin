import {
  assertAccountIdentityGeneration,
  captureAccountIdentityGeneration,
} from '@/lib/auth/accountGeneration';
import {
  assertHealthDataWriteLease,
  captureHealthDataWriteLease,
  type HealthDataWriteLease,
} from '@/lib/consent/healthDataWriteAdmission';
import { subscribeActiveHealthProcessingLeaseChanges } from '@/lib/consent/healthProcessingEpoch';

import { trustedProgressCaptureSessionId } from './progressCapturePrivacy';

export const PROGRESS_CAPTURE_AUTHORITY_MISSING = 'PROGRESS_CAPTURE_AUTHORITY_MISSING';
export const PROGRESS_CAPTURE_AUTHORITY_CONFLICT = 'PROGRESS_CAPTURE_AUTHORITY_CONFLICT';

export type ProgressCaptureAuthoritySnapshot = Readonly<{
  accountIdentityGeneration: number;
  healthLease: HealthDataWriteLease;
}>;

const authorities = new Map<string, ProgressCaptureAuthoritySnapshot>();

function canonicalSessionId(value: unknown): string {
  const captureSessionId = trustedProgressCaptureSessionId(value);
  if (captureSessionId === null) throw new Error(PROGRESS_CAPTURE_AUTHORITY_MISSING);
  return captureSessionId;
}

export function captureProgressCaptureAuthority(): ProgressCaptureAuthoritySnapshot {
  return Object.freeze({
    accountIdentityGeneration: captureAccountIdentityGeneration(),
    healthLease: captureHealthDataWriteLease(),
  });
}

export function assertProgressCaptureAuthoritySnapshotCurrent(
  authority: ProgressCaptureAuthoritySnapshot,
): void {
  assertAccountIdentityGeneration(authority.accountIdentityGeneration);
  assertHealthDataWriteLease(authority.healthLease);
}

/**
 * Binds one native shutter session to the exact account identity + health grant
 * captured before camera work begins. The binding is process-local on purpose:
 * a direct/stale review route cannot manufacture or re-bind capture authority.
 */
export function reserveProgressCaptureAuthority(
  captureSessionId: string,
  authority: ProgressCaptureAuthoritySnapshot,
): void {
  const canonical = canonicalSessionId(captureSessionId);
  assertProgressCaptureAuthoritySnapshotCurrent(authority);

  const existing = authorities.get(canonical);
  if (existing !== undefined) {
    if (existing !== authority) throw new Error(PROGRESS_CAPTURE_AUTHORITY_CONFLICT);
    assertProgressCaptureAuthoritySnapshotCurrent(existing);
    return;
  }

  authorities.set(canonical, authority);
}

export function assertProgressCaptureAuthorityCurrent(captureSessionId: string): void {
  const canonical = canonicalSessionId(captureSessionId);
  const authority = authorities.get(canonical);
  if (authority === undefined) throw new Error(PROGRESS_CAPTURE_AUTHORITY_MISSING);
  assertProgressCaptureAuthoritySnapshotCurrent(authority);
}

export function isProgressCaptureAuthorityCurrent(captureSessionId: string): boolean {
  try {
    assertProgressCaptureAuthorityCurrent(captureSessionId);
    return true;
  } catch {
    return false;
  }
}

export function releaseProgressCaptureAuthority(captureSessionId: string | null | undefined): void {
  const canonical = trustedProgressCaptureSessionId(captureSessionId);
  if (canonical !== null) authorities.delete(canonical);
}

/**
 * Account boundaries synchronously close the active health lease, so this one
 * subscription observes real owner transitions plus withdrawal/re-grant.
 */
export function subscribeProgressCaptureAuthorityChanges(listener: () => void): () => void {
  return subscribeActiveHealthProcessingLeaseChanges(() => listener());
}
