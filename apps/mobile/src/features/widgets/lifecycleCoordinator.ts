import {
  RoutineWidgetReconciliationCoordinator,
  type RoutineWidgetControllerDependencies,
} from './controllerCore';
import {
  clearRoutineWidgetNativeState,
  closeRoutineWidgetNativeAdmission,
} from './nativeLifecycle';
import type {
  activateRoutineWidgetNativeOwner,
  readRoutineWidgetNativeAuthority,
  reconcileRoutineWidgetNativeActivities,
} from './nativeLifecycle';
import type { RoutineWidgetNativeCleanupResult } from './nativeLifecycleContract';
import type {
  runWithRoutineWidgetOwnerAuthority,
  RoutineWidgetOwnerAuthorityInput,
} from './ownerAuthority';

export type RoutineWidgetLifecycleAuthorityInput = RoutineWidgetOwnerAuthorityInput;

export type RoutineWidgetLifecycleDependencies = Readonly<{
  activateOwner: typeof activateRoutineWidgetNativeOwner;
  capabilityEnabled: () => boolean;
  closeAdmission: typeof closeRoutineWidgetNativeAdmission;
  clearNativeState: typeof clearRoutineWidgetNativeState;
  controllerDependencies: RoutineWidgetControllerDependencies;
  readAuthority: typeof readRoutineWidgetNativeAuthority;
  reconcileActivities: typeof reconcileRoutineWidgetNativeActivities;
  runWithOwnerAuthority: typeof runWithRoutineWidgetOwnerAuthority;
}>;

/**
 * One process-global queue orders activation, reconciliation, release, and
 * privacy cleanup. A queued release cannot run after a newer owner's
 * activation, and a rejected task never poisons later cleanup.
 */
export class RoutineWidgetLifecycleCoordinator {
  private generation = 0;
  private tail: Promise<void> = Promise.resolve();
  private readonly outbox = new RoutineWidgetReconciliationCoordinator();

  constructor(private readonly dependencies: RoutineWidgetLifecycleDependencies | null = null) {}

  private enqueue<T>(operation: () => T | Promise<T>): Promise<T> {
    const result = this.tail.then(operation);
    this.tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private assertCurrent(generation: number): void {
    if (generation !== this.generation) {
      throw new Error('ROUTINE_WIDGET_LIFECYCLE_INVALIDATED');
    }
  }

  private closeAdmissionAndEnqueueCleanup(
    closeAdmission: typeof closeRoutineWidgetNativeAdmission,
    clearNativeState: typeof clearRoutineWidgetNativeState,
  ): Promise<RoutineWidgetNativeCleanupResult> {
    let failure: Readonly<{ error: unknown }> | null = null;
    try {
      closeAdmission();
    } catch (error) {
      failure = { error };
    }
    const cleanup = this.enqueue(() => clearNativeState());
    const admissionFailure = failure;
    if (admissionFailure === null) return cleanup;
    return cleanup.then(() => {
      throw admissionFailure.error;
    });
  }

  private async activateAndReconcile(
    input: RoutineWidgetLifecycleAuthorityInput,
    generation: number,
    dependencies: RoutineWidgetLifecycleDependencies,
  ): Promise<void> {
    try {
      this.assertCurrent(generation);
      await dependencies.runWithOwnerAuthority(input, async (ownerAuthority, lease) => {
        this.assertCurrent(generation);
        lease.assertCurrent();
        let nativeAuthority = dependencies.readAuthority();
        this.assertCurrent(generation);
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
        this.assertCurrent(generation);
        lease.assertCurrent();
        if (
          !nativeAuthority.enabled ||
          nativeAuthority.ownerGeneration !== ownerAuthority.ownerGeneration
        ) {
          throw new Error('ROUTINE_WIDGET_NATIVE_AUTHORITY_INVALID');
        }

        await dependencies.reconcileActivities();
        this.assertCurrent(generation);
        lease.assertCurrent();
        await this.outbox.reconcile(
          ownerAuthority.ownerGeneration,
          dependencies.controllerDependencies,
        );
        this.assertCurrent(generation);
        lease.assertCurrent();
      });
      this.assertCurrent(generation);
    } catch (error) {
      // Any partial activation or malformed native response is privacy-reduced
      // before this serialized slot is released to a later owner.
      let admissionFailure: Readonly<{ error: unknown }> | null = null;
      try {
        dependencies.closeAdmission();
      } catch (closeError) {
        admissionFailure = { error: closeError };
      }
      await dependencies.clearNativeState();
      if (admissionFailure !== null) throw admissionFailure.error;
      throw error;
    }
  }

  mount(
    input: RoutineWidgetLifecycleAuthorityInput,
    dependencies: RoutineWidgetLifecycleDependencies | null = this.dependencies,
  ): () => void {
    const generation = ++this.generation;
    this.outbox.invalidate();
    let released = false;
    const closeAdmission = dependencies?.closeAdmission ?? closeRoutineWidgetNativeAdmission;
    const clearNativeState = dependencies?.clearNativeState ?? clearRoutineWidgetNativeState;

    const operation = dependencies?.capabilityEnabled()
      ? this.enqueue(() => this.activateAndReconcile(input, generation, dependencies))
      : this.closeAdmissionAndEnqueueCleanup(closeAdmission, clearNativeState).then(
          () => undefined,
        );
    void operation.catch(() => undefined);

    return () => {
      if (released) return;
      released = true;
      // A newer mount rotates native authority itself. Do not let a late React
      // cleanup from the older host erase the newer owner's state.
      if (this.generation !== generation) return;
      this.generation += 1;
      this.outbox.invalidate();
      void this.closeAdmissionAndEnqueueCleanup(closeAdmission, clearNativeState).catch(
        () => undefined,
      );
    };
  }

  clearForPrivacy(): Promise<RoutineWidgetNativeCleanupResult> {
    this.generation += 1;
    this.outbox.invalidate();
    // Native admission closes synchronously before the FIFO is touched. A
    // stalled older operation can delay the purge, but cannot keep admitting
    // widget reads, writes, intents, or Live Activity mutations.
    return this.closeAdmissionAndEnqueueCleanup(
      this.dependencies?.closeAdmission ?? closeRoutineWidgetNativeAdmission,
      this.dependencies?.clearNativeState ?? clearRoutineWidgetNativeState,
    );
  }
}

const lifecycleCoordinator = new RoutineWidgetLifecycleCoordinator(null);

export function mountRoutineWidgetLifecycle(
  input: RoutineWidgetLifecycleAuthorityInput,
): () => void {
  return lifecycleCoordinator.mount(input);
}

export function mountRoutineWidgetLifecycleWithDependencies(
  input: RoutineWidgetLifecycleAuthorityInput,
  dependencies: RoutineWidgetLifecycleDependencies,
): () => void {
  return lifecycleCoordinator.mount(input, dependencies);
}

export function clearRoutineWidgetLifecycleForPrivacy(): Promise<RoutineWidgetNativeCleanupResult> {
  return lifecycleCoordinator.clearForPrivacy();
}
