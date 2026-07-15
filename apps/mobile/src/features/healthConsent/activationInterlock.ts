import type { HealthDataLifecycleRecord } from './lifecycleStore';

export type HealthDataGateSnapshot = Readonly<{
  record: HealthDataLifecycleRecord | null;
  activationRouteEpoch: number | null;
}>;

export function createHealthDataGateSnapshot(
  record: HealthDataLifecycleRecord | null = null,
): HealthDataGateSnapshot {
  return Object.freeze({
    record,
    activationRouteEpoch: record?.activationRoutePending === true ? record.processingEpoch : null,
  });
}

function resumesPreservedActiveEpoch(
  previous: HealthDataLifecycleRecord,
  next: HealthDataLifecycleRecord,
): boolean {
  return (
    previous.state === 'verification_required' &&
    previous.verificationReason === 'status_unavailable' &&
    previous.verificationResumeState === 'active' &&
    previous.processingEpoch === next.processingEpoch
  );
}

export function healthDataActivationRequiresFreshRoute(
  previous: HealthDataLifecycleRecord | null,
  next: HealthDataLifecycleRecord,
): boolean {
  if (next.state !== 'active') return false;
  if (previous?.state === 'active' && previous.processingEpoch === next.processingEpoch) {
    return false;
  }
  if (previous && resumesPreservedActiveEpoch(previous, next)) return false;
  return true;
}

/**
 * Store notifications fire synchronously inside the lifecycle write, before
 * the caller can request navigation. Keep the active record and its route
 * barrier in one snapshot so React can never observe active authority without
 * also observing the barrier that keeps health providers unmounted.
 */
export function applyHealthDataLifecycleRecord(
  current: HealthDataGateSnapshot,
  next: HealthDataLifecycleRecord | null,
  transitionFrom: HealthDataLifecycleRecord | null = current.record,
): HealthDataGateSnapshot {
  if (next === null) return createHealthDataGateSnapshot();
  if (next.activationRoutePending) {
    return Object.freeze({ record: next, activationRouteEpoch: next.processingEpoch });
  }
  if (next.state !== 'active') {
    const preservesPendingActivation =
      current.activationRouteEpoch !== null &&
      next.state === 'verification_required' &&
      next.verificationReason === 'status_unavailable' &&
      next.verificationResumeState === 'active' &&
      next.processingEpoch === current.activationRouteEpoch;
    return Object.freeze({
      record: next,
      activationRouteEpoch: preservesPendingActivation ? current.activationRouteEpoch : null,
    });
  }

  const activationRouteEpoch = healthDataActivationRequiresFreshRoute(transitionFrom, next)
    ? next.processingEpoch
    : current.activationRouteEpoch;
  return Object.freeze({ record: next, activationRouteEpoch });
}

export function healthDataActivationRouteIsSelected(segments: readonly string[]): boolean {
  return segments[0] === 'onboarding' && segments[1] === 'goals';
}

export function releaseHealthDataActivationRoute(
  current: HealthDataGateSnapshot,
  segments: readonly string[],
): HealthDataGateSnapshot {
  if (
    current.activationRouteEpoch === null ||
    current.record?.state !== 'active' ||
    current.record.processingEpoch !== current.activationRouteEpoch ||
    current.record.activationRoutePending ||
    !healthDataActivationRouteIsSelected(segments)
  ) {
    return current;
  }
  return Object.freeze({ record: current.record, activationRouteEpoch: null });
}

export function healthDataChildrenMayMount(current: HealthDataGateSnapshot): boolean {
  return current.activationRouteEpoch === null;
}

export function healthDataPausedShellRequired(
  current: HealthDataGateSnapshot,
  expectedOwnerUserId: string | null,
): boolean {
  const record = current.record;
  return (
    record?.ownerUserId === expectedOwnerUserId &&
    (record.state === 'withdrawing' ||
      record.state === 'withdrawn' ||
      record.state === 'verification_required')
  );
}

/**
 * Route effects can run from a render that still captured an older record
 * after a synchronous lifecycle-store notification updated the committed
 * snapshot. Redirect only from that live snapshot so a newly active grant is
 * never bounced back to consent while goals is being selected.
 */
export function healthDataUnconsentedRedirectRequired(
  current: HealthDataGateSnapshot,
  expectedOwnerUserId: string | null,
  unconsentedRouteAllowed: boolean,
): boolean {
  const record = current.record;
  return (
    record?.ownerUserId === expectedOwnerUserId &&
    record.state === 'unconsented' &&
    !unconsentedRouteAllowed
  );
}
