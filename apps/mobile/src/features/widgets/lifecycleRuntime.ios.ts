import {
  acknowledgeRoutineWidgetActionTokens,
  clearRoutineWidgetActions,
  discardRoutineWidgetPreparedActions,
  prepareRoutineWidgetActions,
  retainOnlyPublishedRoutineWidgetActions,
  resolveRoutineWidgetActionTokens,
} from './actionRegistry';
import {
  RoutineWidgetReconciliationCoordinator,
  type RoutineWidgetControllerDependencies,
} from './controllerCore';
import {
  createRoutineWidgetProps,
  normalizeRoutineWidgetOpaqueUuid,
  routineLiveActivityProps,
  ROUTINE_WIDGET_MAX_STEPS,
  ROUTINE_WIDGET_TODAY_DEEP_LINKS,
  type RoutineWidgetPhase,
} from './contract';
import {
  mountRoutineWidgetLifecycleWithDependencies,
  type RoutineWidgetLifecycleAuthorityInput,
  type RoutineWidgetLifecycleDependencies,
} from './lifecycleCoordinator';
import {
  activateRoutineWidgetNativeOwner,
  clearRoutineWidgetNativeState,
  closeRoutineWidgetNativeAdmission,
  commitRoutineWidgetNativeQuiescedReconciliation,
  commitRoutineWidgetNativeReconciliation,
  publishRoutineWidgetNativeTimeline,
  quiesceRoutineWidgetNativeAdmission,
  readRoutineWidgetNativeAuthority,
  readRoutineWidgetNativeOutbox,
  reconcileRoutineWidgetNativeActivities,
  routineWidgetNativeStateConfigured,
} from './nativeLifecycle';
import { runWithRoutineWidgetOwnerAuthority } from './ownerAuthority';
import {
  ROUTINE_LIVE_ACTIVITY_START_ENABLED,
  ROUTINE_WIDGET_INTERACTIVE_PUBLICATION_ENABLED,
  routineWidgetRuntimeEnabled,
} from './runtimeGate';
import TonightActivity from './TonightActivity.ios';
import { randomUUID } from 'expo-crypto';

import { currentRoutineType, localDateString } from '@/features/today/useToday';
import { toggleCompletion } from '@/features/today/completionsStore';
import { HEALTH_PROCESSING_STATUS_LEASE_MS } from '@/lib/consent/healthProcessingEpoch';
import { env } from '@/lib/env';

export type RoutineWidgetPublicationSnapshot = Readonly<
  | { enabled: false }
  | {
      enabled: true;
      completedCount: number;
      liveActivityEnabled: boolean;
      localDate: string;
      phase: Exclude<RoutineWidgetPhase, 'none'>;
      remainingStepKeys: readonly string[];
      totalCount: number;
    }
>;

export type RoutineWidgetLifecyclePublicationOptions = Readonly<{
  onCanonicalMutation?: () => void | Promise<void>;
  readSnapshot: () => RoutineWidgetPublicationSnapshot | null;
}>;

export type RoutineWidgetLifecycleRelease = (() => void) & {
  refresh: () => Promise<void>;
};

const UUID_GENERATION_ATTEMPTS = 8;
const PUBLICATION_CONCURRENCY_ATTEMPTS = 4;
const ROUTINE_WIDGET_LIVE_ACTIVITY_STALE_ERROR_CODE = 'ERR_LAYERWELL_LIVE_ACTIVITY_STALE';
export const ROUTINE_WIDGET_RECONCILIATION_HEADROOM_MS = 30_000;
export const ROUTINE_WIDGET_PRE_CLOSE_DRAIN_TIMEOUT_MS = 1_000;

export type RoutineWidgetPreCloseDrainResult = Readonly<{
  status: 'drained' | 'failed' | 'skipped' | 'timed_out';
}>;

type ActiveRoutineWidgetPreCloseDrain = Readonly<{
  input: RoutineWidgetLifecycleAuthorityInput;
  run: () => Promise<RoutineWidgetPreCloseDrainResult>;
  token: symbol;
}>;

let activePreCloseDrain: ActiveRoutineWidgetPreCloseDrain | null = null;

export function drainRoutineWidgetOutboxBeforeHealthLeaseClose(
  input: RoutineWidgetLifecycleAuthorityInput,
): Promise<RoutineWidgetPreCloseDrainResult> {
  const active = activePreCloseDrain;
  if (
    active === null ||
    active.input.ownerUserId !== input.ownerUserId ||
    active.input.processingEpoch !== input.processingEpoch
  ) {
    try {
      return Promise.resolve(
        Object.freeze({
          status:
            closeRoutineWidgetNativeAdmission().status === 'closed'
              ? ('skipped' as const)
              : ('failed' as const),
        }),
      );
    } catch {
      return Promise.resolve(Object.freeze({ status: 'failed' }));
    }
  }
  return active.run();
}

function invalidPublication(): never {
  throw new Error('ROUTINE_WIDGET_PUBLICATION_INVALID');
}

function publicationEnabled(): boolean {
  return (
    routineWidgetRuntimeEnabled() &&
    ROUTINE_WIDGET_INTERACTIVE_PUBLICATION_ENABLED &&
    routineWidgetNativeStateConfigured()
  );
}

function normalizedCurrentSnapshot(
  snapshot: RoutineWidgetPublicationSnapshot | null,
  now: Date,
): Exclude<RoutineWidgetPublicationSnapshot, { enabled: false }> | null {
  if (snapshot === null || snapshot.enabled === false) return null;
  if (
    snapshot.localDate !== localDateString(now) ||
    snapshot.phase !== currentRoutineType(now) ||
    !Number.isSafeInteger(snapshot.completedCount) ||
    snapshot.completedCount < 0 ||
    !Number.isSafeInteger(snapshot.totalCount) ||
    snapshot.totalCount < 0 ||
    snapshot.totalCount > ROUTINE_WIDGET_MAX_STEPS ||
    snapshot.completedCount > snapshot.totalCount ||
    !Array.isArray(snapshot.remainingStepKeys) ||
    snapshot.remainingStepKeys.length !== snapshot.totalCount - snapshot.completedCount
  ) {
    invalidPublication();
  }
  const unique = new Set<string>();
  for (const stepKey of snapshot.remainingStepKeys) {
    if (
      typeof stepKey !== 'string' ||
      stepKey.length === 0 ||
      stepKey !== stepKey.trim() ||
      !stepKey.startsWith(`${snapshot.phase}:`) ||
      stepKey.length === snapshot.phase.length + 1 ||
      unique.has(stepKey)
    ) {
      invalidPublication();
    }
    unique.add(stepKey);
  }
  return snapshot;
}

function freshSnapshotNonce(ownerGeneration: string): string {
  for (let attempt = 0; attempt < UUID_GENERATION_ATTEMPTS; attempt += 1) {
    const candidate = normalizeRoutineWidgetOpaqueUuid(randomUUID().toLowerCase());
    if (candidate !== null && candidate !== ownerGeneration) return candidate;
  }
  return invalidPublication();
}

function samePublicationSnapshot(
  expected: Exclude<RoutineWidgetPublicationSnapshot, { enabled: false }>,
  candidate: RoutineWidgetPublicationSnapshot | null,
): boolean {
  return (
    candidate?.enabled === true &&
    candidate.completedCount === expected.completedCount &&
    candidate.liveActivityEnabled === expected.liveActivityEnabled &&
    candidate.localDate === expected.localDate &&
    candidate.phase === expected.phase &&
    candidate.totalCount === expected.totalCount &&
    candidate.remainingStepKeys.length === expected.remainingStepKeys.length &&
    candidate.remainingStepKeys.every(
      (stepKey, index) => stepKey === expected.remainingStepKeys[index],
    )
  );
}

function isRoutineWidgetLiveActivityStaleError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === ROUTINE_WIDGET_LIVE_ACTIVITY_STALE_ERROR_CODE
  );
}

async function updateLiveActivity(
  widgetProps: ReturnType<typeof createRoutineWidgetProps>,
  optedIn: boolean,
  nowMs: number,
): Promise<'stale' | 'updated'> {
  const activityProps = routineLiveActivityProps(widgetProps, nowMs);
  const instances = TonightActivity.getInstances();
  try {
    if (!optedIn || activityProps?.status !== 'in_progress') {
      await Promise.all(instances.map((activity) => activity.end('immediate')));
      return 'updated';
    }
    const [current, ...duplicates] = instances;
    if (current) await current.update(activityProps);
    else TonightActivity.start(activityProps, ROUTINE_WIDGET_TODAY_DEEP_LINKS[env.appEnvironment]);
    await Promise.all(duplicates.map((activity) => activity.end('immediate')));
    return 'updated';
  } catch (error) {
    if (!isRoutineWidgetLiveActivityStaleError(error)) throw error;
    // Activity.request can succeed just before native post-start authorization
    // fails. Re-read after the typed stale error so the freshly created
    // instance is ended and awaited before this publication retries.
    const staleInstances = TonightActivity.getInstances();
    await Promise.allSettled(staleInstances.map((activity) => activity.end('immediate')));
    return 'stale';
  }
}

const controllerDependencies: RoutineWidgetControllerDependencies = {
  acknowledgeActions: acknowledgeRoutineWidgetActionTokens,
  commitCapturedReconciliation: commitRoutineWidgetNativeQuiescedReconciliation,
  commitReconciliation: commitRoutineWidgetNativeReconciliation,
  completeAction: toggleCompletion,
  readAuthority: readRoutineWidgetNativeAuthority,
  readOutbox: readRoutineWidgetNativeOutbox,
  resolveActions: resolveRoutineWidgetActionTokens,
};

const dependencies: RoutineWidgetLifecycleDependencies = {
  activateOwner: activateRoutineWidgetNativeOwner,
  capabilityEnabled: publicationEnabled,
  closeAdmission: closeRoutineWidgetNativeAdmission,
  clearNativeState: async () => {
    const [native, actions] = await Promise.allSettled([
      clearRoutineWidgetNativeState(),
      clearRoutineWidgetActions(),
    ]);
    if (native.status === 'rejected') throw native.reason;
    if (actions.status === 'rejected') throw actions.reason;
    return native.value;
  },
  controllerDependencies,
  readAuthority: readRoutineWidgetNativeAuthority,
  reconcileActivities: reconcileRoutineWidgetNativeActivities,
  runWithOwnerAuthority: runWithRoutineWidgetOwnerAuthority,
};

/** iOS alone loads the native activation/publication dependency graph. */
export function mountRoutineWidgetLifecycle(
  input: RoutineWidgetLifecycleAuthorityInput,
  publication?: RoutineWidgetLifecyclePublicationOptions,
): RoutineWidgetLifecycleRelease {
  const publisherEnabled = publicationEnabled();
  let initialCanonicalMutation = false;
  let initialSettled = false;
  let settleInitial!: () => void;
  let rejectInitial!: (error: unknown) => void;
  const initialLifecycle = new Promise<void>((resolve, reject) => {
    settleInitial = () => {
      if (initialSettled) return;
      initialSettled = true;
      resolve();
    };
    rejectInitial = (error) => {
      if (initialSettled) return;
      initialSettled = true;
      reject(error);
    };
  });
  // The coordinator owns error handling. This branch prevents an unobserved
  // rejection before the first foreground refresh consumes readiness.
  void initialLifecycle.catch(() => undefined);

  const mountDependencies: RoutineWidgetLifecycleDependencies = {
    ...dependencies,
    controllerDependencies: {
      ...dependencies.controllerDependencies,
      completeAction: async (stepKey, localDate) => {
        const result = await dependencies.controllerDependencies.completeAction(stepKey, localDate);
        initialCanonicalMutation = true;
        return result;
      },
    },
    runWithOwnerAuthority: async (authorityInput, operation) => {
      try {
        const result = await dependencies.runWithOwnerAuthority(authorityInput, operation);
        settleInitial();
        return result;
      } catch (error) {
        rejectInitial(error);
        throw error;
      }
    },
  };
  const releaseLifecycle = mountRoutineWidgetLifecycleWithDependencies(input, mountDependencies);
  const publisherOutbox = new RoutineWidgetReconciliationCoordinator();
  const drainToken = Symbol('routine-widget-pre-close-drain');
  let released = false;
  let preCloseDrainStarted = false;
  let preCloseDrainPromise: Promise<RoutineWidgetPreCloseDrainResult> | null = null;
  let publicationTail: Promise<void> = Promise.resolve();

  const release = (() => {
    if (released) return;
    released = true;
    rejectInitial(new Error('ROUTINE_WIDGET_LIFECYCLE_INVALIDATED'));
    publisherOutbox.invalidate();
    if (activePreCloseDrain?.token === drainToken) activePreCloseDrain = null;
    releaseLifecycle();
  }) as RoutineWidgetLifecycleRelease;

  release.refresh = () => {
    if (released || preCloseDrainStarted || !publisherEnabled || publication === undefined) {
      if (!publisherEnabled) void clearRoutineWidgetActions().catch(() => undefined);
      return Promise.resolve();
    }
    const operation = publicationTail.then(async () => {
      await initialLifecycle;
      if (released) return;
      if (initialCanonicalMutation) {
        initialCanonicalMutation = false;
        await publication.onCanonicalMutation?.();
        return;
      }
      const requestedSnapshot = publication.readSnapshot();
      if (requestedSnapshot === null) return;
      if (requestedSnapshot.enabled === false) {
        await dependencies.runWithOwnerAuthority(input, async (ownerAuthority, lease) => {
          lease.assertCurrent();
          const nativeAuthority = dependencies.readAuthority();
          lease.assertCurrent();
          if (
            nativeAuthority.enabled &&
            nativeAuthority.ownerGeneration === ownerAuthority.ownerGeneration
          ) {
            const reconciliation = await publisherOutbox.reconcile(
              ownerAuthority.ownerGeneration,
              dependencies.controllerDependencies,
            );
            lease.assertCurrent();
            if (reconciliation.completedStepCount > 0) {
              await publication.onCanonicalMutation?.();
              lease.assertCurrent();
            }
          }
        });
        if (!released) release();
        return;
      }

      await dependencies.runWithOwnerAuthority(input, async (ownerAuthority, lease) => {
        if (released) return;
        lease.assertCurrent();
        let nativeAuthority = dependencies.readAuthority();
        lease.assertCurrent();
        if (
          !nativeAuthority.enabled ||
          nativeAuthority.ownerGeneration !== ownerAuthority.ownerGeneration
        ) {
          nativeAuthority = dependencies.activateOwner({
            expectedAuthorityNonce: nativeAuthority.authorityNonce,
            ownerGeneration: ownerAuthority.ownerGeneration,
          });
        }
        if (
          !nativeAuthority.enabled ||
          nativeAuthority.ownerGeneration !== ownerAuthority.ownerGeneration
        ) {
          invalidPublication();
        }

        await dependencies.reconcileActivities();
        lease.assertCurrent();
        for (let attempt = 0; attempt < PUBLICATION_CONCURRENCY_ATTEMPTS; attempt += 1) {
          const reconciliation = await publisherOutbox.reconcile(
            ownerAuthority.ownerGeneration,
            dependencies.controllerDependencies,
          );
          lease.assertCurrent();
          if (reconciliation.completedStepCount > 0) {
            await publication.onCanonicalMutation?.();
            lease.assertCurrent();
          }

          const emptyOutbox = dependencies.controllerDependencies.readOutbox(
            nativeAuthority.authorityNonce,
          );
          lease.assertCurrent();
          if (emptyOutbox.authorityNonce !== nativeAuthority.authorityNonce) {
            invalidPublication();
          }
          // An AppIntent may commit immediately after reconciliation. Retry it
          // as expected concurrency; never route an accepted tap to purge.
          if (emptyOutbox.records.length !== 0) continue;

          const now = new Date();
          const snapshot = normalizedCurrentSnapshot(publication.readSnapshot(), now);
          if (snapshot === null) return;
          const updatedAtMs = now.getTime();
          const staleAtMs = Math.min(
            updatedAtMs + HEALTH_PROCESSING_STATUS_LEASE_MS,
            lease.expiresAt === null
              ? Number.MAX_SAFE_INTEGER
              : lease.expiresAt - ROUTINE_WIDGET_RECONCILIATION_HEADROOM_MS,
          );
          if (staleAtMs <= updatedAtMs) invalidPublication();

          const prepared =
            snapshot.remainingStepKeys.length > 0
              ? await prepareRoutineWidgetActions({
                  ownerGeneration: ownerAuthority.ownerGeneration,
                  localDate: snapshot.localDate,
                  phase: snapshot.phase,
                  stepKeys: snapshot.remainingStepKeys,
                  expiresAt: staleAtMs,
                })
              : Object.freeze({
                  actionTokens: Object.freeze([]),
                  ownerGeneration: ownerAuthority.ownerGeneration,
                  snapshotNonce: freshSnapshotNonce(ownerAuthority.ownerGeneration),
                });
          lease.assertCurrent();
          if (prepared.ownerGeneration !== ownerAuthority.ownerGeneration) invalidPublication();

          const deepLink = ROUTINE_WIDGET_TODAY_DEEP_LINKS[env.appEnvironment];
          const currentProps = createRoutineWidgetProps({
            ownerGeneration: ownerAuthority.ownerGeneration,
            snapshotNonce: prepared.snapshotNonce,
            phase: snapshot.phase,
            localDate: snapshot.localDate,
            completedCount: snapshot.completedCount,
            totalCount: snapshot.totalCount,
            actionTokens: prepared.actionTokens,
            deepLink,
            updatedAtMs,
            staleAtMs,
          });
          const staleProps = createRoutineWidgetProps({
            ownerGeneration: ownerAuthority.ownerGeneration,
            snapshotNonce: prepared.snapshotNonce,
            status: 'stale',
            localDate: snapshot.localDate,
            deepLink,
            updatedAtMs,
            staleAtMs,
          });
          lease.assertCurrent();
          if (!samePublicationSnapshot(snapshot, publication.readSnapshot())) invalidPublication();
          const nativePublication = publishRoutineWidgetNativeTimeline(
            nativeAuthority.authorityNonce,
            [
              { timestamp: updatedAtMs, props: currentProps },
              { timestamp: staleAtMs, props: staleProps },
            ],
          );
          lease.assertCurrent();
          if (nativePublication.status === 'outbox_pending') {
            await discardRoutineWidgetPreparedActions({
              ownerGeneration: ownerAuthority.ownerGeneration,
              snapshotNonce: prepared.snapshotNonce,
            });
            lease.assertCurrent();
            continue;
          }
          if (nativePublication.status !== 'published') invalidPublication();
          await retainOnlyPublishedRoutineWidgetActions({
            ownerGeneration: ownerAuthority.ownerGeneration,
            snapshotNonce: prepared.actionTokens.length === 0 ? null : prepared.snapshotNonce,
          });
          lease.assertCurrent();
          if (!samePublicationSnapshot(snapshot, publication.readSnapshot())) invalidPublication();
          const activityStatus = await updateLiveActivity(
            currentProps,
            snapshot.liveActivityEnabled && ROUTINE_LIVE_ACTIVITY_START_ENABLED,
            updatedAtMs,
          );
          lease.assertCurrent();
          if (activityStatus === 'stale') continue;
          if (!samePublicationSnapshot(snapshot, publication.readSnapshot())) invalidPublication();

          const postPublicationOutbox = dependencies.controllerDependencies.readOutbox(
            nativeAuthority.authorityNonce,
          );
          lease.assertCurrent();
          if (postPublicationOutbox.authorityNonce !== nativeAuthority.authorityNonce) {
            invalidPublication();
          }
          if (postPublicationOutbox.records.length !== 0) continue;
          return;
        }
        // A sustained tap storm remains durably queued in the native outbox.
        // A later foreground refresh retries; expected concurrency never tears
        // down authority or purges an accepted action.
      });
    });
    const cleanupInclusiveOperation = operation.catch(async () => {
      publisherOutbox.invalidate();
      if (initialCanonicalMutation) {
        initialCanonicalMutation = false;
        try {
          await publication.onCanonicalMutation?.();
        } catch {
          // Native/private state is still reduced below.
        }
      }
      if (!released) release();
    });
    publicationTail = cleanupInclusiveOperation.then(
      () => undefined,
      () => undefined,
    );
    return cleanupInclusiveOperation;
  };

  const runPreCloseDrain = (): Promise<RoutineWidgetPreCloseDrainResult> => {
    if (preCloseDrainPromise !== null) return preCloseDrainPromise;
    let admissionQuiesced = false;
    const sealAdmission = (): boolean => {
      if (admissionQuiesced) return true;
      try {
        const closed = dependencies.closeAdmission().status === 'closed';
        if (closed) admissionQuiesced = true;
        return closed;
      } catch {
        return false;
      }
    };
    if (released || !publisherEnabled || publication === undefined) {
      return Promise.resolve(
        Object.freeze({ status: sealAdmission() ? ('skipped' as const) : ('failed' as const) }),
      );
    }
    preCloseDrainStarted = true;
    const drainOperation = publicationTail.then(
      async (): Promise<RoutineWidgetPreCloseDrainResult> => {
        await initialLifecycle;
        if (released) return Object.freeze({ status: 'skipped' });
        if (initialCanonicalMutation) {
          initialCanonicalMutation = false;
          await publication.onCanonicalMutation?.();
        }
        let drained = false;
        await dependencies.runWithOwnerAuthority(input, async (ownerAuthority, lease) => {
          lease.assertCurrent();
          const nativeAuthority = dependencies.readAuthority();
          lease.assertCurrent();
          if (
            !nativeAuthority.enabled ||
            nativeAuthority.ownerGeneration !== ownerAuthority.ownerGeneration
          ) {
            return;
          }
          const quiescence = quiesceRoutineWidgetNativeAdmission({
            expectedAuthorityNonce: nativeAuthority.authorityNonce,
            ownerGeneration: ownerAuthority.ownerGeneration,
          });
          lease.assertCurrent();
          if (quiescence.status !== 'quiesced') invalidPublication();
          admissionQuiesced = true;
          const reconciliation = await publisherOutbox.reconcileCaptured(
            {
              expectedAuthorityNonce: nativeAuthority.authorityNonce,
              expectedOwnerGeneration: ownerAuthority.ownerGeneration,
              outbox: quiescence.outbox,
              quiescenceNonce: quiescence.quiescenceNonce,
            },
            dependencies.controllerDependencies,
          );
          lease.assertCurrent();
          if (reconciliation.completedStepCount > 0) {
            await publication.onCanonicalMutation?.();
            lease.assertCurrent();
          }
          drained = true;
        });
        return Object.freeze({ status: drained ? 'drained' : 'skipped' });
      },
    );
    publicationTail = drainOperation.then(
      () => undefined,
      () => undefined,
    );

    let timeout: ReturnType<typeof setTimeout> | null = null;
    const completed = drainOperation.then(
      (result) => (sealAdmission() ? result : Object.freeze({ status: 'failed' as const })),
      () => {
        sealAdmission();
        return Object.freeze({ status: 'failed' as const });
      },
    );
    const timedOut = new Promise<RoutineWidgetPreCloseDrainResult>((resolve) => {
      timeout = setTimeout(() => {
        publisherOutbox.invalidate();
        resolve(
          Object.freeze({
            status: sealAdmission() ? ('timed_out' as const) : ('failed' as const),
          }),
        );
      }, ROUTINE_WIDGET_PRE_CLOSE_DRAIN_TIMEOUT_MS);
    });
    preCloseDrainPromise = Promise.race([completed, timedOut]).finally(() => {
      if (timeout !== null) clearTimeout(timeout);
    });
    return preCloseDrainPromise;
  };

  activePreCloseDrain = Object.freeze({ input, run: runPreCloseDrain, token: drainToken });

  if (!publisherEnabled) void clearRoutineWidgetActions().catch(() => undefined);
  return release;
}
