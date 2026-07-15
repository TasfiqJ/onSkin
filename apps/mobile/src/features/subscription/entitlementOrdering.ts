import type { StoredEntitlement } from './entitlement';

type EntitlementEvidence = Readonly<{
  source?: StoredEntitlement['source'];
  verifiedAt?: string | null;
  isActive?: boolean;
  isPro?: boolean;
  evidenceIdentity?: string | null;
  evidenceStatus?: string | null;
  daysLeft?: number | null;
}>;

const TIME_DERIVED_STATUS_TRANSITIONS: Readonly<Record<string, readonly string[]>> = {
  fresh: ['reconciliation_due', 'stale', 'expired'],
  reconciliation_due: ['stale', 'expired'],
  stale: ['expired'],
  absent: ['stale'],
};

function canonicalAuthoritativeVerificationTime(
  evidence: EntitlementEvidence | null | undefined,
): number | null {
  if (
    !evidence ||
    (evidence.source !== 'revenuecat' &&
      evidence.source !== 'server' &&
      evidence.source !== 'app_granted') ||
    !evidence.verifiedAt
  ) {
    return null;
  }

  const parsed = Date.parse(evidence.verifiedAt);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== evidence.verifiedAt) {
    return null;
  }
  return parsed;
}

function isDeterministicTimeDerivedUpdate(
  current: EntitlementEvidence,
  incoming: EntitlementEvidence,
): boolean {
  if (
    !current.evidenceIdentity ||
    current.evidenceIdentity !== incoming.evidenceIdentity ||
    !current.evidenceStatus ||
    !incoming.evidenceStatus
  ) {
    return false;
  }

  if (
    TIME_DERIVED_STATUS_TRANSITIONS[current.evidenceStatus]?.includes(
      incoming.evidenceStatus,
    )
  ) {
    return true;
  }

  return (
    current.evidenceStatus === incoming.evidenceStatus &&
    typeof current.daysLeft === 'number' &&
    typeof incoming.daysLeft === 'number' &&
    incoming.daysLeft < current.daysLeft
  );
}

function authorizesAccess(evidence: EntitlementEvidence): boolean | null {
  if (typeof evidence.isPro === 'boolean') return evidence.isPro;
  if (typeof evidence.isActive === 'boolean') return evidence.isActive;
  return null;
}

/**
 * Select the newest provider/server-authored evidence. Equal timestamps retain
 * the already-published value unless the exact same proof has deterministically
 * aged (for example fresh to stale/expired, or fewer days remaining).
 */
export function selectLatestAuthoritativeEntitlementEvidence<T extends EntitlementEvidence>(
  current: T | null | undefined,
  incoming: T,
): T {
  const incomingTime = canonicalAuthoritativeVerificationTime(incoming);
  if (incomingTime === null) return current ?? incoming;

  const currentTime = canonicalAuthoritativeVerificationTime(current);
  if (current && currentTime !== null && currentTime > incomingTime) return current;
  if (current && currentTime === incomingTime) {
    const currentAccess = authorizesAccess(current);
    const incomingAccess = authorizesAccess(incoming);
    if (currentAccess === true && incomingAccess === false) return incoming;
    if (currentAccess === false && incomingAccess === true) return current;
    return isDeterministicTimeDerivedUpdate(current, incoming) ? incoming : current;
  }
  return incoming;
}
