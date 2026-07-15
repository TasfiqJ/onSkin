import {
  type AccountPublicationAction,
  type AccountPublicationSessionBinding,
  createAccountPublicationCapability,
  exchangeAccountPublicationFence,
} from './accountPublicationFence';

export const ACCOUNT_PUBLICATION_RENEW_INTERVAL_MS = 20_000;
export const ACCOUNT_PUBLICATION_OPERATION_FRESHNESS_MS = 30_000;
export const ACCOUNT_PUBLICATION_DRAIN_WAIT_MS = 60_000;
/**
 * Product-policy liveness boundary for a purchase/restore caller. Reaching it
 * detaches only the caller-facing promise; it is never evidence that the store
 * operation was cancelled or that its underlying SDK promise settled.
 */
export const ACCOUNT_PUBLICATION_STORE_OPERATION_CALLER_DETACH_MS = 120_000;

export type AccountPublicationState = 'closed' | 'reserved' | 'active' | 'draining' | 'quarantined';
export type AccountPublicationDrainReason =
  | 'account_boundary'
  | 'app_backgrounded'
  | 'account_deletion'
  | 'renewal_failed'
  | 'renewal_stale'
  | 'session_rejected'
  | 'shutdown';

export type AccountPublicationSnapshot = Readonly<{
  state: AccountPublicationState;
  generation: number;
  subject: string | null;
  sessionId: string | null;
}>;

export type AccountPublicationTicket = Readonly<{
  generation: number;
  subject: string;
  sessionId: string;
  assertCurrent: () => void;
}>;

export type AccountPublicationOperationKind =
  | 'configure'
  | 'offering'
  | 'eligibility'
  | 'purchase'
  | 'restore'
  | 'customer_info'
  | 'listener'
  | 'entitlement_write'
  | 'manage_subscription';

export type AccountPublicationControllerErrorCode =
  | 'ACCOUNT_PUBLICATION_ADMISSION_CLOSED'
  | 'ACCOUNT_PUBLICATION_BINDING_REJECTED'
  | 'ACCOUNT_PUBLICATION_OPERATION_QUARANTINED'
  | 'ACCOUNT_PUBLICATION_RESULT_STALE'
  | 'ACCOUNT_PUBLICATION_STOREKIT_COMPLETION_UNCONFIRMED'
  | 'ACCOUNT_PUBLICATION_STORE_OPERATION_CALLER_DETACHED'
  | 'ACCOUNT_PUBLICATION_STORE_OPERATION_IN_PROGRESS';

export class AccountPublicationControllerError extends Error {
  constructor(readonly code: AccountPublicationControllerErrorCode) {
    super(code);
    this.name = 'AccountPublicationControllerError';
  }
}

type TimerHandle = ReturnType<typeof setTimeout>;

export type AccountPublicationControllerDependencies = {
  createCapability?: () => Promise<string>;
  exchange?: (
    action: AccountPublicationAction,
    capability: string,
    binding?: AccountPublicationSessionBinding,
  ) => Promise<'reserved' | 'active' | 'released'>;
  isAccountActivityBlocked: () => boolean;
  monotonicNow?: () => number;
  now?: () => number;
  resetProviderIdentity: () => Promise<void>;
  schedule?: (callback: () => void, delayMs: number) => TimerHandle;
  cancelScheduled?: (handle: TimerHandle) => void;
};

type ClosedState = {
  kind: 'closed';
  generation: number;
};

type ReservedState = {
  kind: 'reserved';
  generation: number;
  subject: string;
  sessionId: string;
  accessToken: string;
  capability: string;
};

type ActiveState = {
  kind: 'active';
  generation: number;
  subject: string;
  sessionId: string;
  accessToken: string;
  capability: string;
  renewedAtMonotonic: number;
  renewedAtWall: number;
};

type DrainingState = {
  kind: 'draining';
  generation: number;
  subject: string;
  sessionId: string;
  capability: string;
  reason: AccountPublicationDrainReason;
};

type QuarantinedState = {
  kind: 'quarantined';
  generation: number;
  subject: string;
  sessionId: string;
  capability: string;
  reason: AccountPublicationDrainReason;
};

type InternalState = ClosedState | ReservedState | ActiveState | DrainingState | QuarantinedState;

type TrackedOperation = {
  callerDetachHandle: TimerHandle | null;
  callerDetached: boolean;
  generation: number;
  rejectForDrainDeadline: () => void;
  storeOperation: boolean;
  settlement: Promise<void>;
};

type TrackedListener = {
  generation: number;
  remove: () => void;
};

function controllerError(
  code: AccountPublicationControllerErrorCode,
): AccountPublicationControllerError {
  return new AccountPublicationControllerError(code);
}

function sameBinding(
  state: Pick<ReservedState | ActiveState, 'subject' | 'sessionId'>,
  binding: AccountPublicationSessionBinding,
): boolean {
  return state.subject === binding.subject && state.sessionId === binding.sessionId;
}

function defaultMonotonicNow(): number {
  const performanceClock = globalThis.performance;
  if (performanceClock && typeof performanceClock.now === 'function') {
    return performanceClock.now();
  }
  return Date.now();
}

/**
 * Process-local publication authority for the RevenueCat identity. The
 * capability intentionally exists only inside this instance: process death
 * loses it and a restored session must reserve a new lease after the server's
 * old lease expires. The 20s cadence and 30s freshness ceiling are coupled to
 * migration 0052's 60s active TTL. They are not proof that RevenueCat blocks
 * old/tampered clients or that a provider has a finite recreation bound.
 */
export class AccountPublicationController {
  private readonly createCapability: () => Promise<string>;
  private readonly exchange: NonNullable<AccountPublicationControllerDependencies['exchange']>;
  private readonly monotonicNow: () => number;
  private readonly now: () => number;
  private readonly schedule: NonNullable<AccountPublicationControllerDependencies['schedule']>;
  private readonly cancelScheduled: NonNullable<
    AccountPublicationControllerDependencies['cancelScheduled']
  >;
  private state: InternalState = { kind: 'closed', generation: 0 };
  private transitionTail: Promise<void> = Promise.resolve();
  private admissionEpoch = 0;
  private admissionPaused = false;
  private renewHandle: TimerHandle | null = null;
  private drainPromise: Promise<void> | null = null;
  private readonly operations = new Set<TrackedOperation>();
  private readonly providerListeners = new Set<TrackedListener>();
  private readonly closedListeners = new Set<(reason: AccountPublicationDrainReason) => void>();
  private readonly issuedTickets = new WeakSet<object>();

  constructor(private readonly dependencies: AccountPublicationControllerDependencies) {
    this.createCapability = dependencies.createCapability ?? createAccountPublicationCapability;
    this.exchange = dependencies.exchange ?? exchangeAccountPublicationFence;
    this.monotonicNow = dependencies.monotonicNow ?? defaultMonotonicNow;
    this.now = dependencies.now ?? Date.now;
    this.schedule = dependencies.schedule ?? ((callback, delayMs) => setTimeout(callback, delayMs));
    this.cancelScheduled = dependencies.cancelScheduled ?? ((handle) => clearTimeout(handle));
  }

  snapshot(): AccountPublicationSnapshot {
    const state = this.state;
    return Object.freeze({
      state: state.kind,
      generation: state.generation,
      subject: state.kind === 'closed' ? null : state.subject,
      sessionId: state.kind === 'closed' ? null : state.sessionId,
    });
  }

  isActiveFor(binding: AccountPublicationSessionBinding): boolean {
    const state = this.freshActiveState();
    return state !== null && sameBinding(state, binding);
  }

  activeGenerationForSubject(subject: string): number | null {
    const state = this.freshActiveState();
    return state?.subject === subject ? state.generation : null;
  }

  addAdmissionClosedListener(
    listener: (reason: AccountPublicationDrainReason) => void,
  ): () => void {
    this.closedListeners.add(listener);
    return () => this.closedListeners.delete(listener);
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const completion = this.transitionTail.then(operation, operation);
    this.transitionTail = completion.then(
      () => undefined,
      () => undefined,
    );
    return completion;
  }

  private ensureAccountActivityOpen(): void {
    if (this.dependencies.isAccountActivityBlocked()) {
      throw controllerError('ACCOUNT_PUBLICATION_ADMISSION_CLOSED');
    }
  }

  private ensureNewAdmissionOpen(): void {
    this.ensureAccountActivityOpen();
    if (this.admissionPaused) {
      throw controllerError('ACCOUNT_PUBLICATION_ADMISSION_CLOSED');
    }
  }

  /** Block new operations while preserving tickets already inside native UI. */
  pauseAdmission(): void {
    this.admissionPaused = true;
    this.clearRenewTimer();
  }

  /** Resume only if the retained active publication is still fresh. */
  resumeAdmission(): boolean {
    this.admissionPaused = false;
    const state = this.state;
    if (state.kind !== 'active') return false;
    if (!this.hasFreshAuthority(state)) {
      void this.beginDrain('renewal_stale');
      return false;
    }
    this.scheduleRenewal(state);
    return true;
  }

  private clearRenewTimer(): void {
    if (this.renewHandle === null) return;
    this.cancelScheduled(this.renewHandle);
    this.renewHandle = null;
  }

  private clockStamp(): { monotonic: number; wall: number } | null {
    try {
      const monotonic = this.monotonicNow();
      const wall = this.now();
      return Number.isFinite(monotonic) && Number.isFinite(wall) ? { monotonic, wall } : null;
    } catch {
      return null;
    }
  }

  /**
   * Use both clocks and trust the larger elapsed duration. The monotonic clock
   * rejects wall-clock rollback, while the wall clock conservatively catches a
   * runtime whose monotonic clock pauses during device sleep. Any rollback or
   * invalid reading closes local authority instead of extending it.
   */
  private hasFreshAuthority(state: ActiveState): boolean {
    const current = this.clockStamp();
    if (!current) return false;
    const monotonicElapsed = current.monotonic - state.renewedAtMonotonic;
    const wallElapsed = current.wall - state.renewedAtWall;
    return (
      monotonicElapsed >= 0 &&
      wallElapsed >= 0 &&
      Math.max(monotonicElapsed, wallElapsed) <= ACCOUNT_PUBLICATION_OPERATION_FRESHNESS_MS
    );
  }

  private freshActiveState(): ActiveState | null {
    const state = this.state;
    if (state.kind !== 'active') return null;
    if (this.hasFreshAuthority(state)) return state;
    void this.beginDrain('renewal_stale');
    return null;
  }

  private scheduleRenewal(state: ActiveState): void {
    this.clearRenewTimer();
    const generation = state.generation;
    this.renewHandle = this.schedule(() => {
      this.renewHandle = null;
      const current = this.state;
      if (current.kind !== 'active' || current.generation !== generation) return;
      void this.renew({
        subject: current.subject,
        sessionId: current.sessionId,
        accessToken: current.accessToken,
      }).catch(() => {
        // renew() closes admission synchronously before this rejection reaches
        // the timer. AuthProvider receives the lifecycle notification and
        // unpublishes the authenticated tree.
      });
    }, ACCOUNT_PUBLICATION_RENEW_INTERVAL_MS);
  }

  async reserve(binding: AccountPublicationSessionBinding): Promise<AccountPublicationSnapshot> {
    this.ensureNewAdmissionOpen();
    const epoch = this.admissionEpoch;
    const capability = await this.createCapability();
    return this.enqueue(async () => {
      this.ensureNewAdmissionOpen();
      if (epoch !== this.admissionEpoch || this.state.kind !== 'closed') {
        throw controllerError('ACCOUNT_PUBLICATION_ADMISSION_CLOSED');
      }
      const generation = this.state.generation + 1;
      this.state = {
        kind: 'reserved',
        generation,
        subject: binding.subject,
        sessionId: binding.sessionId,
        accessToken: binding.accessToken,
        capability,
      };
      try {
        const result = await this.exchange('publication_reserve', capability, binding);
        if (
          result !== 'reserved' ||
          this.state.kind !== 'reserved' ||
          this.state.generation !== generation ||
          epoch !== this.admissionEpoch
        ) {
          throw controllerError('ACCOUNT_PUBLICATION_RESULT_STALE');
        }
        return this.snapshot();
      } catch (error) {
        if (this.state.kind === 'reserved' && this.state.generation === generation) {
          void this.beginDrain('session_rejected');
        }
        throw error;
      }
    });
  }

  async activate(binding: AccountPublicationSessionBinding): Promise<AccountPublicationTicket> {
    return this.enqueue(async () => {
      this.ensureNewAdmissionOpen();
      const state = this.state;
      if (state.kind !== 'reserved' || !sameBinding(state, binding)) {
        throw controllerError('ACCOUNT_PUBLICATION_BINDING_REJECTED');
      }
      const result = await this.exchange('publication_activate', state.capability, binding);
      if (
        result !== 'active' ||
        this.state.kind !== 'reserved' ||
        this.state.generation !== state.generation
      ) {
        throw controllerError('ACCOUNT_PUBLICATION_RESULT_STALE');
      }
      const activatedAt = this.clockStamp();
      if (!activatedAt) throw controllerError('ACCOUNT_PUBLICATION_RESULT_STALE');
      const active: ActiveState = {
        ...state,
        kind: 'active',
        accessToken: binding.accessToken,
        renewedAtMonotonic: activatedAt.monotonic,
        renewedAtWall: activatedAt.wall,
      };
      this.state = active;
      this.scheduleRenewal(active);
      return this.issueTicket(active);
    }).catch((error) => {
      void this.beginDrain('session_rejected');
      throw error;
    });
  }

  async renew(binding: AccountPublicationSessionBinding): Promise<AccountPublicationTicket> {
    return this.enqueue(async () => {
      this.ensureNewAdmissionOpen();
      const state = this.state;
      if (state.kind !== 'active' || !sameBinding(state, binding)) {
        throw controllerError('ACCOUNT_PUBLICATION_BINDING_REJECTED');
      }
      if (!this.hasFreshAuthority(state)) {
        void this.beginDrain('renewal_stale');
        throw controllerError('ACCOUNT_PUBLICATION_ADMISSION_CLOSED');
      }
      try {
        const result = await this.exchange('publication_renew', state.capability, binding);
        if (
          result !== 'active' ||
          this.state.kind !== 'active' ||
          this.state.generation !== state.generation
        ) {
          throw controllerError('ACCOUNT_PUBLICATION_RESULT_STALE');
        }
        const renewedAt = this.clockStamp();
        if (!renewedAt) throw controllerError('ACCOUNT_PUBLICATION_RESULT_STALE');
        const renewed: ActiveState = {
          ...state,
          accessToken: binding.accessToken,
          renewedAtMonotonic: renewedAt.monotonic,
          renewedAtWall: renewedAt.wall,
        };
        this.state = renewed;
        this.scheduleRenewal(renewed);
        return this.issueTicket(renewed);
      } catch (error) {
        void this.beginDrain('renewal_failed');
        throw error;
      }
    });
  }

  private issueTicket(state: ActiveState): AccountPublicationTicket {
    let ticket!: AccountPublicationTicket;
    ticket = Object.freeze({
      generation: state.generation,
      subject: state.subject,
      sessionId: state.sessionId,
      assertCurrent: () => this.assertTicketCurrent(ticket),
    });
    this.issuedTickets.add(ticket);
    return ticket;
  }

  private ticketForActive(expectedSubject?: string): AccountPublicationTicket {
    this.ensureNewAdmissionOpen();
    const state = this.state;
    if (
      state.kind !== 'active' ||
      (expectedSubject !== undefined && state.subject !== expectedSubject)
    ) {
      throw controllerError('ACCOUNT_PUBLICATION_ADMISSION_CLOSED');
    }
    if (!this.hasFreshAuthority(state)) {
      void this.beginDrain('renewal_stale');
      throw controllerError('ACCOUNT_PUBLICATION_ADMISSION_CLOSED');
    }
    return this.issueTicket(state);
  }

  assertTicketCurrent(ticket: AccountPublicationTicket): void {
    if (!this.issuedTickets.has(ticket)) {
      throw controllerError('ACCOUNT_PUBLICATION_RESULT_STALE');
    }
    this.ensureAccountActivityOpen();
    const state = this.state;
    if (
      state.kind !== 'active' ||
      state.generation !== ticket.generation ||
      state.subject !== ticket.subject ||
      state.sessionId !== ticket.sessionId
    ) {
      throw controllerError('ACCOUNT_PUBLICATION_RESULT_STALE');
    }
    if (!this.hasFreshAuthority(state)) {
      void this.beginDrain('renewal_stale');
      throw controllerError('ACCOUNT_PUBLICATION_RESULT_STALE');
    }
  }

  runOperation<T>(
    kind: AccountPublicationOperationKind,
    operation: (ticket: AccountPublicationTicket) => T | Promise<T>,
    expectedSubject?: string,
  ): Promise<T> {
    const storeOperation = kind === 'purchase' || kind === 'restore';
    let ticket: AccountPublicationTicket;
    try {
      ticket = this.ticketForActive(expectedSubject);
    } catch (error) {
      return Promise.reject(error);
    }
    if (
      storeOperation &&
      [...this.operations].some((tracked) => tracked.storeOperation && tracked.callerDetached)
    ) {
      this.issuedTickets.delete(ticket);
      return Promise.reject(controllerError('ACCOUNT_PUBLICATION_STORE_OPERATION_IN_PROGRESS'));
    }

    let publicSettled = false;
    let resolveCompletion!: (value: T | PromiseLike<T>) => void;
    let rejectCompletion!: (reason?: unknown) => void;
    const completion = new Promise<T>((resolve, reject) => {
      resolveCompletion = resolve;
      rejectCompletion = reject;
    });
    const resolvePublic = (value: T): void => {
      if (publicSettled) return;
      publicSettled = true;
      resolveCompletion(value);
    };
    const rejectPublic = (error: unknown): void => {
      if (publicSettled) return;
      publicSettled = true;
      rejectCompletion(error);
    };
    let resolveSettlement!: () => void;
    const settlement = new Promise<void>((resolve) => {
      resolveSettlement = resolve;
    });
    const storeKitResult = storeOperation;
    const tracked: TrackedOperation = {
      callerDetachHandle: null,
      callerDetached: false,
      generation: ticket.generation,
      rejectForDrainDeadline: () =>
        rejectPublic(
          controllerError(
            storeKitResult
              ? 'ACCOUNT_PUBLICATION_STOREKIT_COMPLETION_UNCONFIRMED'
              : 'ACCOUNT_PUBLICATION_RESULT_STALE',
          ),
        ),
      storeOperation,
      settlement,
    };
    this.operations.add(tracked);
    if (storeOperation) {
      tracked.callerDetachHandle = this.schedule(() => {
        tracked.callerDetachHandle = null;
        if (!this.operations.has(tracked) || publicSettled) return;
        tracked.callerDetached = true;
        // Revocation is operation-local. The publication remains active for
        // safe listener/status work, while a late pre-native continuation must
        // fail its next authority assertion before it can enter the store SDK.
        this.issuedTickets.delete(ticket);
        rejectPublic(controllerError('ACCOUNT_PUBLICATION_STORE_OPERATION_CALLER_DETACHED'));
      }, ACCOUNT_PUBLICATION_STORE_OPERATION_CALLER_DETACH_MS);
    }

    void (async () => {
      try {
        const result = await operation(ticket);
        ticket.assertCurrent();
        resolvePublic(result);
      } catch (error) {
        try {
          ticket.assertCurrent();
          rejectPublic(error);
        } catch {
          rejectPublic(
            controllerError(
              storeKitResult
                ? 'ACCOUNT_PUBLICATION_STOREKIT_COMPLETION_UNCONFIRMED'
                : 'ACCOUNT_PUBLICATION_RESULT_STALE',
            ),
          );
        }
      } finally {
        if (tracked.callerDetachHandle !== null) {
          this.cancelScheduled(tracked.callerDetachHandle);
          tracked.callerDetachHandle = null;
        }
        this.operations.delete(tracked);
        resolveSettlement();
      }
    })();

    return completion;
  }

  registerProviderListener(ticket: AccountPublicationTicket, remove: () => void): () => void {
    this.ensureNewAdmissionOpen();
    ticket.assertCurrent();
    const tracked: TrackedListener = { generation: ticket.generation, remove };
    this.providerListeners.add(tracked);
    return () => {
      if (!this.providerListeners.delete(tracked)) return;
      remove();
    };
  }

  private removeProviderListenersSynchronously(): void {
    const listeners = [...this.providerListeners];
    this.providerListeners.clear();
    for (const listener of listeners) {
      try {
        listener.remove();
      } catch {
        // Reset remains mandatory and will fail the drain if provider state
        // cannot be made safe. Listener removal itself must still be attempted
        // for every registered callback before waiting on callback writes.
      }
    }
  }

  private operationsForGeneration(generation: number): TrackedOperation[] {
    return [...this.operations].filter((operation) => operation.generation === generation);
  }

  private waitForTrackedOperationsUntilDeadline(generation: number): Promise<boolean> {
    const pending = this.operationsForGeneration(generation);
    if (pending.length === 0) return Promise.resolve(true);

    return new Promise<boolean>((resolve) => {
      let finished = false;
      let deadlineHandle: TimerHandle | null = null;
      const finish = (settled: boolean): void => {
        if (finished) return;
        finished = true;
        if (deadlineHandle !== null) this.cancelScheduled(deadlineHandle);
        resolve(settled);
      };
      deadlineHandle = this.schedule(() => finish(false), ACCOUNT_PUBLICATION_DRAIN_WAIT_MS);
      if (finished) this.cancelScheduled(deadlineHandle);
      void Promise.all(pending.map(({ settlement }) => settlement)).then(() => finish(true));
    });
  }

  private quarantineUnsettledOperations(draining: DrainingState): boolean {
    const pending = this.operationsForGeneration(draining.generation);
    if (pending.length === 0) return false;
    const current = this.state;
    if (
      current.kind !== 'draining' ||
      current.generation !== draining.generation ||
      current.capability !== draining.capability
    ) {
      return false;
    }
    this.state = { ...draining, kind: 'quarantined' };
    for (const operation of pending) operation.rejectForDrainDeadline();
    return true;
  }

  beginDrain(reason: AccountPublicationDrainReason): Promise<void> {
    this.admissionPaused = false;
    const current = this.state;
    if (current.kind === 'closed') {
      this.admissionEpoch += 1;
      return this.transitionTail;
    }
    if (current.kind === 'quarantined') {
      if (this.operationsForGeneration(current.generation).length > 0) {
        return Promise.reject(controllerError('ACCOUNT_PUBLICATION_OPERATION_QUARANTINED'));
      }
      this.state = { ...current, kind: 'draining' };
    } else if (current.kind !== 'draining') {
      this.admissionEpoch += 1;
      this.clearRenewTimer();
      this.state = {
        kind: 'draining',
        generation: current.generation,
        subject: current.subject,
        sessionId: current.sessionId,
        capability: current.capability,
        reason,
      };
      this.removeProviderListenersSynchronously();
      for (const listener of this.closedListeners) {
        try {
          listener(reason);
        } catch {
          // A lifecycle observer cannot reopen admission or prevent draining.
        }
      }
    }

    if (this.drainPromise) return this.drainPromise;
    const draining = this.state;
    if (draining.kind !== 'draining') return this.transitionTail;
    const drain = this.enqueue(async () => {
      const settled = await this.waitForTrackedOperationsUntilDeadline(draining.generation);
      if (!settled && this.quarantineUnsettledOperations(draining)) {
        throw controllerError('ACCOUNT_PUBLICATION_OPERATION_QUARANTINED');
      }
      await this.dependencies.resetProviderIdentity();
      const latest = this.state;
      if (
        latest.kind !== 'draining' ||
        latest.generation !== draining.generation ||
        latest.capability !== draining.capability
      ) {
        throw controllerError('ACCOUNT_PUBLICATION_RESULT_STALE');
      }
      const released = await this.exchange('publication_release', draining.capability);
      if (released !== 'released') {
        throw controllerError('ACCOUNT_PUBLICATION_RESULT_STALE');
      }
      this.state = { kind: 'closed', generation: draining.generation };
    });
    this.drainPromise = drain;
    void drain
      .finally(() => {
        if (this.drainPromise === drain) this.drainPromise = null;
      })
      .catch(() => {
        // The caller receives the original rejection. Keep the draining or
        // quarantined state and in-memory capability for an explicit safe retry.
      });
    return drain;
  }

  retryDrain(): Promise<void> {
    return this.state.kind === 'draining' || this.state.kind === 'quarantined'
      ? this.beginDrain(this.state.reason)
      : Promise.resolve();
  }
}

export function isAccountPublicationControllerError(
  error: unknown,
  code?: AccountPublicationControllerErrorCode,
): error is AccountPublicationControllerError {
  return (
    error instanceof AccountPublicationControllerError &&
    (code === undefined || error.code === code)
  );
}
