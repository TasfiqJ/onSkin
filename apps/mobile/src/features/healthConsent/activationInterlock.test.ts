import { describe, expect, it } from 'vitest';

import type { HealthDataLifecycleRecord } from './lifecycleStore';
import {
  applyHealthDataLifecycleRecord,
  createHealthDataGateSnapshot,
  healthDataChildrenMayMount,
  healthDataPausedShellRequired,
  healthDataUnconsentedRedirectRequired,
  releaseHealthDataActivationRoute,
} from './activationInterlock';

const OWNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const NOW = '2026-07-15T12:00:00.000Z';

function record(
  state: HealthDataLifecycleRecord['state'],
  epoch: number,
  overrides: Partial<HealthDataLifecycleRecord> = {},
): HealthDataLifecycleRecord {
  return {
    schemaVersion: 3,
    ownerUserId: OWNER,
    state,
    processingEpoch: epoch,
    operationId: null,
    idempotencyKey: null,
    localCleanupComplete: state !== 'verification_required',
    activationRoutePending: false,
    verificationReason: state === 'verification_required' ? 'processing_epoch_changed' : null,
    verificationResumeState: state === 'verification_required' ? 'active' : null,
    serverVerifiedAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe('health-data activation route interlock', () => {
  it('blocks a subscription-delivered reconsent before router navigation can run', () => {
    const withdrawn = record('withdrawn', 2);
    const reconsented = record('active', 3, { activationRoutePending: true });

    // This is the real ordering: writeHealthDataLifecycle notifies first and
    // the caller's router.replace runs only after the awaited write returns.
    const notified = applyHealthDataLifecycleRecord(
      createHealthDataGateSnapshot(withdrawn),
      reconsented,
    );
    expect(notified).toMatchObject({ record: reconsented, activationRouteEpoch: 3 });
    expect(healthDataChildrenMayMount(notified)).toBe(false);

    const staleRoute = releaseHealthDataActivationRoute(notified, ['(tabs)', 'routine']);
    expect(staleRoute).toBe(notified);
    expect(healthDataChildrenMayMount(staleRoute)).toBe(false);

    const durablyAcknowledged = applyHealthDataLifecycleRecord(notified, {
      ...reconsented,
      activationRoutePending: false,
    });
    const settledGoalsRoute = releaseHealthDataActivationRoute(durablyAcknowledged, [
      'onboarding',
      'goals',
    ]);
    expect(healthDataChildrenMayMount(settledGoalsRoute)).toBe(true);
  });

  it('blocks an externally observed newer active epoch until goals is selected', () => {
    const epochTwo = record('active', 2);
    const epochThree = record('active', 3, { activationRoutePending: true });
    const notified = applyHealthDataLifecycleRecord(
      createHealthDataGateSnapshot(epochTwo),
      epochThree,
    );

    expect(notified.activationRouteEpoch).toBe(3);
    expect(healthDataChildrenMayMount(notified)).toBe(false);
  });

  it('rebuilds the barrier from a persisted pending activation after process death', () => {
    const pending = record('active', 3, { activationRoutePending: true });
    const coldStart = createHealthDataGateSnapshot(pending);

    expect(coldStart.activationRouteEpoch).toBe(3);
    expect(healthDataChildrenMayMount(coldStart)).toBe(false);
    expect(
      healthDataChildrenMayMount(
        releaseHealthDataActivationRoute(coldStart, ['onboarding', 'goals']),
      ),
    ).toBe(false);
  });

  it('blocks cleanup-required verification recovery even at the same epoch', () => {
    const cleanupRequired = record('verification_required', 2, {
      localCleanupComplete: true,
      verificationReason: 'consent_contract_mismatch',
    });
    const active = record('active', 2);
    const notified = applyHealthDataLifecycleRecord(
      createHealthDataGateSnapshot(cleanupRequired),
      active,
    );

    expect(notified.activationRouteEpoch).toBe(2);
    expect(healthDataChildrenMayMount(notified)).toBe(false);
  });

  it('resumes an exact same-epoch transient outage without redirecting or deleting', () => {
    const outage = record('verification_required', 2, {
      localCleanupComplete: false,
      verificationReason: 'status_unavailable',
      verificationResumeState: 'active',
    });
    const active = record('active', 2);
    const notified = applyHealthDataLifecycleRecord(createHealthDataGateSnapshot(outage), active);

    expect(notified.activationRouteEpoch).toBeNull();
    expect(healthDataChildrenMayMount(notified)).toBe(true);
  });

  it('does not interlock an ordinary same-epoch active status refresh', () => {
    const active = record('active', 2);
    const refreshed = record('active', 2, { serverVerifiedAt: '2026-07-15T12:01:00.000Z' });
    const notified = applyHealthDataLifecycleRecord(
      createHealthDataGateSnapshot(active),
      refreshed,
    );

    expect(notified.activationRouteEpoch).toBeNull();
    expect(healthDataChildrenMayMount(notified)).toBe(true);
  });

  it('does not let a stale unconsented render redirect a synchronously committed grant', () => {
    const declined = createHealthDataGateSnapshot(record('unconsented', 0));
    const granted = applyHealthDataLifecycleRecord(
      declined,
      record('active', 1, { activationRoutePending: true }),
    );

    expect(healthDataUnconsentedRedirectRequired(declined, OWNER, false)).toBe(true);
    expect(healthDataUnconsentedRedirectRequired(granted, OWNER, false)).toBe(false);
    expect(granted.activationRouteEpoch).toBe(1);
    expect(healthDataChildrenMayMount(granted)).toBe(false);
  });

  it('selects the paused shell immediately for a same-owner withdrawal interlock', () => {
    const active = createHealthDataGateSnapshot(record('active', 2));
    const withdrawing = applyHealthDataLifecycleRecord(
      active,
      record('withdrawing', 2, {
        idempotencyKey: null,
        localCleanupComplete: false,
      }),
    );

    expect(healthDataPausedShellRequired(withdrawing, OWNER)).toBe(true);
    expect(healthDataPausedShellRequired(withdrawing, 'owner-b')).toBe(false);
  });

  it('preserves a new-epoch barrier through a transient fence and exact recovery', () => {
    const epochTwo = record('active', 2);
    const epochThree = record('active', 3, { activationRoutePending: true });
    const activated = applyHealthDataLifecycleRecord(
      createHealthDataGateSnapshot(epochTwo),
      epochThree,
    );
    const transientFence = record('verification_required', 3, {
      localCleanupComplete: false,
      activationRoutePending: true,
      verificationReason: 'status_unavailable',
      verificationResumeState: 'active',
    });
    const fenced = applyHealthDataLifecycleRecord(activated, transientFence);
    const recovered = applyHealthDataLifecycleRecord(fenced, epochThree);

    expect(fenced.activationRouteEpoch).toBe(3);
    expect(recovered.activationRouteEpoch).toBe(3);
    expect(healthDataChildrenMayMount(recovered)).toBe(false);
    expect(
      healthDataChildrenMayMount(
        releaseHealthDataActivationRoute(recovered, ['(tabs)', 'progress']),
      ),
    ).toBe(false);
    const acknowledged = applyHealthDataLifecycleRecord(recovered, {
      ...epochThree,
      activationRoutePending: false,
    });
    expect(
      healthDataChildrenMayMount(
        releaseHealthDataActivationRoute(acknowledged, ['onboarding', 'goals']),
      ),
    ).toBe(true);
  });
});
