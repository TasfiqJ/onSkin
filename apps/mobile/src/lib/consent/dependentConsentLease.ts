import { runAccountGenerationOperation } from '@/lib/auth/accountGeneration';

import type {
  HealthDependentConsentLifecycleState,
  HealthDependentConsentType,
} from './dependentConsentContract';
import {
  activeHealthProcessingLeaseSnapshot,
  registerDependentConsentTransportSnapshotProvider,
} from './healthProcessingEpoch';

export const HEALTH_DEPENDENT_CONSENT_CLOSED = 'HEALTH_DEPENDENT_CONSENT_CLOSED';
export const HEALTH_DEPENDENT_CONSENT_OWNER_CHANGED =
  'HEALTH_DEPENDENT_CONSENT_OWNER_CHANGED';
export const HEALTH_DEPENDENT_CONSENT_STALE = 'HEALTH_DEPENDENT_CONSENT_STALE';

type DependentConsentProcessState = 'checking' | 'granting' | 'active' | 'closed';
export type HealthDependentConsentAuthority = 'local_only' | 'remote' | null;

export type HealthDependentConsentLease = Readonly<{
  type: HealthDependentConsentType;
  ownerUserId: string;
  accountGeneration: number;
  healthEpoch: number;
  healthGeneration: number;
  generation: number;
  serverGeneration: number | null;
  authority: HealthDependentConsentAuthority;
  state: DependentConsentProcessState;
}>;

export type HealthDependentConsentOperationLease = HealthDependentConsentLease &
  Readonly<{
    signal: AbortSignal;
    assertCurrent: () => void;
  }>;

type MutableProcessEntry = {
  type: HealthDependentConsentType;
  ownerUserId: string;
  accountGeneration: number;
  healthEpoch: number;
  healthGeneration: number;
  generation: number;
  serverGeneration: number | null;
  authority: HealthDependentConsentAuthority;
  state: DependentConsentProcessState;
};

const processEntries = new Map<string, MutableProcessEntry>();
let nextDependentGeneration = 0;

function entryKey(ownerUserId: string, type: HealthDependentConsentType): string {
  return `${ownerUserId}\u0000${type}`;
}

function validOwner(value: string): boolean {
  return Boolean(value && value === value.trim() && value.length <= 128);
}

function nextGeneration(): number {
  nextDependentGeneration += 1;
  if (!Number.isSafeInteger(nextDependentGeneration)) {
    throw new Error('HEALTH_DEPENDENT_CONSENT_GENERATION_EXHAUSTED');
  }
  return nextDependentGeneration;
}

function freezeEntry(entry: MutableProcessEntry): HealthDependentConsentLease {
  return Object.freeze({ ...entry });
}

function exactEntry(lease: HealthDependentConsentLease): MutableProcessEntry | null {
  const current = processEntries.get(entryKey(lease.ownerUserId, lease.type));
  return current?.generation === lease.generation ? current : null;
}

function assertBaseHealthCurrent(lease: HealthDependentConsentLease): void {
  const health = activeHealthProcessingLeaseSnapshot(lease.ownerUserId);
  if (!health) throw new Error(HEALTH_DEPENDENT_CONSENT_CLOSED);
  if (health.ownerUserId !== lease.ownerUserId) {
    throw new Error(HEALTH_DEPENDENT_CONSENT_OWNER_CHANGED);
  }
  // Active disclosure authority is bound to the exact base publication too.
  // A status renewal therefore forces a fresh dependent-status check. Withdrawal
  // uses assertClosedHealthDependentConsentLease instead and is never abandoned
  // merely because the same owner's base verification renewed.
  if (
    health.epoch !== lease.healthEpoch ||
    health.generation !== lease.healthGeneration ||
    health.accountGeneration !== lease.accountGeneration
  ) {
    throw new Error(HEALTH_DEPENDENT_CONSENT_CLOSED);
  }
}

export function assertHealthDependentConsentLease(
  lease: HealthDependentConsentLease,
  expectedState: DependentConsentProcessState = 'active',
): void {
  const current = exactEntry(lease);
  if (!current || current.state !== expectedState) {
    throw new Error(HEALTH_DEPENDENT_CONSENT_STALE);
  }
  assertBaseHealthCurrent(lease);
}

export function beginHealthDependentConsentCheck(
  type: HealthDependentConsentType,
): HealthDependentConsentLease {
  const health = activeHealthProcessingLeaseSnapshot();
  if (!health?.ownerUserId || health.accountGeneration === null) {
    throw new Error(HEALTH_DEPENDENT_CONSENT_CLOSED);
  }
  const entry: MutableProcessEntry = {
    type,
    ownerUserId: health.ownerUserId,
    accountGeneration: health.accountGeneration,
    healthEpoch: health.epoch,
    healthGeneration: health.generation,
    generation: nextGeneration(),
    serverGeneration: null,
    authority: null,
    state: 'checking',
  };
  processEntries.set(entryKey(entry.ownerUserId, type), entry);
  return freezeEntry(entry);
}

export function beginHealthDependentConsentGrant(
  type: HealthDependentConsentType,
): HealthDependentConsentLease {
  const checking = beginHealthDependentConsentCheck(type);
  const current = exactEntry(checking);
  if (!current) throw new Error(HEALTH_DEPENDENT_CONSENT_STALE);
  current.state = 'granting';
  return freezeEntry(current);
}

/**
 * Close one dependent purpose synchronously. Callers invoke this before any
 * hashing, storage, auth, or network await in a privacy-reducing workflow.
 */
export function closeHealthDependentConsent(
  type: HealthDependentConsentType,
  expectedOwnerUserId?: string,
): HealthDependentConsentLease {
  const health = activeHealthProcessingLeaseSnapshot();
  const ownerUserId = expectedOwnerUserId ?? health?.ownerUserId ?? '';
  if (!validOwner(ownerUserId)) {
    throw new Error(HEALTH_DEPENDENT_CONSENT_OWNER_CHANGED);
  }

  const prior = processEntries.get(entryKey(ownerUserId, type));
  const accountGeneration =
    health?.ownerUserId === ownerUserId && health.accountGeneration !== null
      ? health.accountGeneration
      : prior?.accountGeneration;
  const healthEpoch =
    health?.ownerUserId === ownerUserId ? health.epoch : prior?.healthEpoch;
  const healthGeneration =
    health?.ownerUserId === ownerUserId ? health.generation : prior?.healthGeneration;
  if (
    accountGeneration === undefined ||
    healthEpoch === undefined ||
    healthGeneration === undefined
  ) {
    throw new Error(HEALTH_DEPENDENT_CONSENT_CLOSED);
  }
  const entry: MutableProcessEntry = {
    type,
    ownerUserId,
    accountGeneration,
    healthEpoch,
    healthGeneration,
    generation: nextGeneration(),
    serverGeneration: prior?.serverGeneration ?? null,
    authority: prior?.authority ?? null,
    state: 'closed',
  };
  processEntries.set(entryKey(ownerUserId, type), entry);
  return freezeEntry(entry);
}

export function assertClosedHealthDependentConsentLease(
  lease: HealthDependentConsentLease,
): void {
  const current = exactEntry(lease);
  if (!current || current.state !== 'closed') {
    throw new Error(HEALTH_DEPENDENT_CONSENT_STALE);
  }
}

export function publishHealthDependentConsentActive(params: {
  lease: HealthDependentConsentLease;
  serverGeneration: number | null;
  localOnly?: boolean;
}): HealthDependentConsentLease {
  const current = exactEntry(params.lease);
  if (!current || (current.state !== 'checking' && current.state !== 'granting')) {
    throw new Error(HEALTH_DEPENDENT_CONSENT_STALE);
  }
  if (
    params.serverGeneration !== null &&
    (!Number.isSafeInteger(params.serverGeneration) || params.serverGeneration < 1)
  ) {
    throw new Error('HEALTH_DEPENDENT_CONSENT_SERVER_GENERATION_INVALID');
  }
  if (params.serverGeneration === null && params.localOnly !== true) {
    throw new Error('HEALTH_DEPENDENT_CONSENT_SERVER_GENERATION_INVALID');
  }
  assertBaseHealthCurrent(params.lease);
  current.serverGeneration = params.serverGeneration;
  current.authority = params.serverGeneration === null ? 'local_only' : 'remote';
  current.state = 'active';
  return freezeEntry(current);
}

export function closeCheckedHealthDependentConsent(
  lease: HealthDependentConsentLease,
): HealthDependentConsentLease {
  const current = exactEntry(lease);
  if (!current) throw new Error(HEALTH_DEPENDENT_CONSENT_STALE);
  const closed: MutableProcessEntry = {
    ...current,
    generation: nextGeneration(),
    state: 'closed',
  };
  processEntries.set(entryKey(closed.ownerUserId, closed.type), closed);
  return freezeEntry(closed);
}

export function activeHealthDependentConsentLeaseSnapshot(
  type: HealthDependentConsentType,
  expectedOwnerUserId?: string,
): HealthDependentConsentLease | null {
  const health = activeHealthProcessingLeaseSnapshot(expectedOwnerUserId);
  if (!health?.ownerUserId || health.accountGeneration === null) return null;
  const current = processEntries.get(entryKey(health.ownerUserId, type));
  if (
    !current ||
    current.state !== 'active' ||
    current.healthEpoch !== health.epoch ||
    current.healthGeneration !== health.generation ||
    current.accountGeneration !== health.accountGeneration
  ) {
    return null;
  }
  return freezeEntry(current);
}

export function runHealthDependentConsentOperation<T>(
  type: HealthDependentConsentType,
  operation: (lease: HealthDependentConsentOperationLease) => T | Promise<T>,
): Promise<T> {
  const dependentLease = activeHealthDependentConsentLeaseSnapshot(type);
  if (!dependentLease) return Promise.reject(new Error(HEALTH_DEPENDENT_CONSENT_CLOSED));
  return runAccountGenerationOperation(async (accountLease) => {
    const assertCurrent = () => {
      accountLease.assertCurrent();
      if (accountLease.generation !== dependentLease.accountGeneration) {
        throw new Error(HEALTH_DEPENDENT_CONSENT_CLOSED);
      }
      assertHealthDependentConsentLease(dependentLease);
    };
    const operationLease: HealthDependentConsentOperationLease = Object.freeze({
      ...dependentLease,
      signal: accountLease.signal,
      assertCurrent,
    });
    assertCurrent();
    const result = await operation(operationLease);
    assertCurrent();
    return result;
  });
}

export function dependentConsentTransportGeneration(
  type: HealthDependentConsentType,
): number | null {
  return activeHealthDependentConsentLeaseSnapshot(type)?.serverGeneration ?? null;
}

registerDependentConsentTransportSnapshotProvider((type) => {
  const lease = activeHealthDependentConsentLeaseSnapshot(type);
  if (!lease || lease.serverGeneration === null) return null;
  return Object.freeze({
    type,
    generation: lease.serverGeneration,
    processGeneration: lease.generation,
    assertCurrent: () => assertHealthDependentConsentLease(lease),
  });
});

export function dependentConsentProcessStateForTests(
  ownerUserId: string,
  type: HealthDependentConsentType,
): Readonly<{
  generation: number;
  serverGeneration: number | null;
  authority: HealthDependentConsentAuthority;
  state: DependentConsentProcessState;
}> | null {
  const entry = processEntries.get(entryKey(ownerUserId, type));
  return entry
    ? Object.freeze({
        generation: entry.generation,
        serverGeneration: entry.serverGeneration,
        authority: entry.authority,
        state: entry.state,
      })
    : null;
}

export function resetHealthDependentConsentLeasesForTests(): void {
  processEntries.clear();
}

export function lifecycleStateAuthorizesDependentConsent(
  state: HealthDependentConsentLifecycleState,
): state is 'active' {
  return state === 'active';
}
