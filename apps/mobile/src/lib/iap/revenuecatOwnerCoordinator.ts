import {
  AccountGenerationLeaseError,
  awaitAccountGenerationLease,
  getAccountGeneration,
  type AccountGenerationLease,
} from '@/lib/auth/accountGeneration';

export const REVENUECAT_IDENTITY_MISMATCH = 'REVENUECAT_IDENTITY_MISMATCH';
export const REVENUECAT_OPERATION_BUSY = 'REVENUECAT_OPERATION_BUSY';
export const REVENUECAT_OPERATION_FENCED = 'REVENUECAT_OPERATION_FENCED';
export const REVENUECAT_RESET_UNPROVEN = 'REVENUECAT_RESET_UNPROVEN';

export class RevenueCatIdentityMismatchError extends Error {
  readonly code = REVENUECAT_IDENTITY_MISMATCH;

  constructor() {
    super(REVENUECAT_IDENTITY_MISMATCH);
    this.name = 'RevenueCatIdentityMismatchError';
  }
}

export class RevenueCatOperationBusyError extends Error {
  readonly code = REVENUECAT_OPERATION_BUSY;

  constructor() {
    super(REVENUECAT_OPERATION_BUSY);
    this.name = 'RevenueCatOperationBusyError';
  }
}

export class RevenueCatOperationFencedError extends Error {
  readonly code = REVENUECAT_OPERATION_FENCED;

  constructor() {
    super(REVENUECAT_OPERATION_FENCED);
    this.name = 'RevenueCatOperationFencedError';
  }
}

export class RevenueCatResetUnprovenError extends Error {
  readonly code = REVENUECAT_RESET_UNPROVEN;

  constructor() {
    super(REVENUECAT_RESET_UNPROVEN);
    this.name = 'RevenueCatResetUnprovenError';
  }
}

export type RevenueCatOwnerContext = Readonly<{
  appUserId: string;
  lease: AccountGenerationLease;
}>;

export type RevenueCatOwnerStamp = Readonly<{
  appUserId: string;
  generation: number;
  identityEpoch: number;
}>;

export type RevenueCatIdentityAdapter = {
  configure: (
    appUserId: string,
    markNativeConfigureDispatched: () => void,
  ) => void | Promise<void>;
  /**
   * An unconditional async native call queued behind earlier configure work.
   * It must resolve `{ configured: false }` for a genuinely unconfigured SDK,
   * rather than reject, so a pre-dispatch refusal can be distinguished from an
   * uncertain native configure dispatch.
   */
  fenceIdentity: () => Promise<Readonly<{ configured: boolean }>>;
  getAppUserID: () => Promise<string>;
  isAnonymous: () => Promise<boolean>;
  isConfigured: () => Promise<boolean>;
  logIn: (appUserId: string) => Promise<unknown>;
  logOut: () => Promise<unknown>;
};

type ActiveNativeRecord = {
  readonly generation: number;
  readonly kind: 'configure' | 'manage' | 'purchase' | 'restore' | 'winback';
  readonly ownerId: string;
  cancelled: boolean;
  nativeStarted: boolean;
  stale: boolean;
  readonly terminal: Promise<void>;
  resolveTerminal: () => void;
};

type ActiveConfiguration = {
  readonly ownerId: string;
  readonly generation: number;
  readonly operation: Promise<void>;
  readonly record: ActiveNativeRecord;
};

type ActiveListener = {
  readonly cleanup: () => void;
  removed: boolean;
  readonly stamp: RevenueCatOwnerStamp;
};

function activeRecord(
  context: RevenueCatOwnerContext,
  kind: ActiveNativeRecord['kind'],
): ActiveNativeRecord {
  let resolveTerminal!: () => void;
  const terminal = new Promise<void>((resolve) => {
    resolveTerminal = resolve;
  });
  return {
    cancelled: false,
    generation: context.lease.generation,
    kind,
    nativeStarted: false,
    ownerId: context.appUserId,
    resolveTerminal,
    stale: false,
    terminal,
  };
}

/**
 * Owns the process-global RevenueCat identity and every native operation whose
 * late completion could be applied to a different authenticated account.
 *
 * Pure reads detach on an account boundary. Native identity writes and store
 * sheets instead leave a quarantine behind until account cleanup proves an
 * anonymous SDK identity.
 */
export class RevenueCatOwnerCoordinator {
  private activeConfiguration: ActiveConfiguration | null = null;
  private activeHazard: ActiveNativeRecord | null = null;
  private activeListener: ActiveListener | null = null;
  private cleanupAcceptableOwnerId: string | null = null;
  private cleanupRevision = 0;
  private identityEpoch = 0;
  private quarantined = false;
  private ready: RevenueCatOwnerStamp | null = null;
  private resetPromise: Promise<void> | null = null;
  private resetting = false;
  private readonly retiredAuthenticatedIds = new Set<string>();

  private assertContextCurrent(context: RevenueCatOwnerContext): void {
    context.lease.assertCurrent();
    if (!context.appUserId) throw new RevenueCatOperationFencedError();
  }

  private clearListener(): void {
    const listener = this.activeListener;
    this.activeListener = null;
    if (!listener || listener.removed) return;
    listener.removed = true;
    try {
      listener.cleanup();
    } catch {
      // The captured owner/epoch guard still makes a callback inert even when
      // an SDK removal call itself is unexpectedly unavailable.
    }
  }

  private invalidateIdentity(): void {
    if (this.ready) this.retiredAuthenticatedIds.add(this.ready.appUserId);
    this.ready = null;
    this.identityEpoch += 1;
    this.clearListener();
  }

  private quarantine(): void {
    if (!this.quarantined) {
      this.quarantined = true;
      this.invalidateIdentity();
      return;
    }
    this.clearListener();
  }

  private assertAvailable(): void {
    if (this.quarantined || this.resetting) throw new RevenueCatOperationFencedError();
  }

  private setReady(context: RevenueCatOwnerContext): RevenueCatOwnerStamp {
    this.identityEpoch += 1;
    const stamp = Object.freeze({
      appUserId: context.appUserId,
      generation: context.lease.generation,
      identityEpoch: this.identityEpoch,
    });
    this.ready = stamp;
    this.retiredAuthenticatedIds.add(context.appUserId);
    return stamp;
  }

  private assertStampCurrent(stamp: RevenueCatOwnerStamp): void {
    if (
      this.quarantined ||
      this.resetting ||
      !this.ready ||
      this.ready.appUserId !== stamp.appUserId ||
      this.ready.generation !== stamp.generation ||
      this.ready.identityEpoch !== stamp.identityEpoch ||
      getAccountGeneration() !== stamp.generation
    ) {
      throw new AccountGenerationLeaseError();
    }
  }

  private currentStamp(context: RevenueCatOwnerContext): RevenueCatOwnerStamp {
    this.assertContextCurrent(context);
    this.assertAvailable();
    const stamp = this.ready;
    if (
      !stamp ||
      stamp.appUserId !== context.appUserId ||
      stamp.generation !== context.lease.generation
    ) {
      throw new RevenueCatOperationFencedError();
    }
    this.assertStampCurrent(stamp);
    return stamp;
  }

  private async proveExpectedIdentity(
    adapter: RevenueCatIdentityAdapter,
    context: RevenueCatOwnerContext,
  ): Promise<void> {
    const [appUserId, anonymous] = await Promise.all([
      adapter.getAppUserID(),
      adapter.isAnonymous(),
    ]);
    this.assertContextCurrent(context);
    if (anonymous || appUserId !== context.appUserId) {
      this.quarantine();
      throw new RevenueCatIdentityMismatchError();
    }
  }

  private async proveAnonymousIdentity(adapter: RevenueCatIdentityAdapter): Promise<void> {
    const [appUserId, anonymous] = await Promise.all([
      adapter.getAppUserID(),
      adapter.isAnonymous(),
    ]);
    if (!anonymous || this.retiredAuthenticatedIds.has(appUserId)) {
      throw new RevenueCatResetUnprovenError();
    }
  }

  private markStale(record: ActiveNativeRecord): void {
    record.stale = true;
    record.cancelled = !record.nativeStarted;
    if (record.nativeStarted) this.quarantine();
    if (!record.nativeStarted) {
      if (this.activeHazard === record) this.activeHazard = null;
      if (this.activeConfiguration?.record === record) this.activeConfiguration = null;
    }
  }

  private attachOwnerInvalidation(
    context: RevenueCatOwnerContext,
    record: ActiveNativeRecord,
  ): () => void {
    const invalidate = () => this.markStale(record);
    context.lease.signal.addEventListener('abort', invalidate, { once: true });
    if (context.lease.signal.aborted) invalidate();
    return () => context.lease.signal.removeEventListener('abort', invalidate);
  }

  private assertRecordCanStart(
    context: RevenueCatOwnerContext,
    record: ActiveNativeRecord,
  ): void {
    this.assertContextCurrent(context);
    if (record.cancelled || record.stale || this.resetting || this.quarantined) {
      throw new AccountGenerationLeaseError();
    }
  }

  private async logOutAndProveAnonymous(adapter: RevenueCatIdentityAdapter): Promise<void> {
    let logoutError: unknown = null;
    try {
      await adapter.logOut();
    } catch (error) {
      logoutError = error;
    }

    try {
      await this.proveAnonymousIdentity(adapter);
    } catch (proofError) {
      throw logoutError ?? proofError;
    }
  }

  private async logInAndProveExpected(
    adapter: RevenueCatIdentityAdapter,
    context: RevenueCatOwnerContext,
  ): Promise<void> {
    let loginError: unknown = null;
    try {
      await adapter.logIn(context.appUserId);
    } catch (error) {
      loginError = error;
    }

    try {
      await this.proveExpectedIdentity(adapter, context);
    } catch (proofError) {
      throw loginError ?? proofError;
    }
  }

  private async proveIdentitySafeForPublication(
    adapter: RevenueCatIdentityAdapter,
    acceptableOwnerId: string | null,
  ): Promise<void> {
    let fence: Readonly<{ configured: boolean }>;
    try {
      // Always fence, even in a fresh JS coordinator: the native RevenueCat
      // singleton and an older runtime's queued configure can survive reload.
      fence = await adapter.fenceIdentity();
    } catch {
      // A later cleanup retry can try the ordered native fence again; newer
      // owners remain quarantined while native state is unproven.
      throw new RevenueCatResetUnprovenError();
    }
    if (!fence.configured) return;

    const [appUserId, anonymous] = await Promise.all([
      adapter.getAppUserID(),
      adapter.isAnonymous(),
    ]);
    if (anonymous) {
      if (this.retiredAuthenticatedIds.has(appUserId)) {
        throw new RevenueCatResetUnprovenError();
      }
      return;
    }
    if (acceptableOwnerId && appUserId === acceptableOwnerId) return;
    await this.logOutAndProveAnonymous(adapter);
  }

  configureFor<TAdapter extends RevenueCatIdentityAdapter>(
    context: RevenueCatOwnerContext,
    loadAdapter: () => Promise<TAdapter>,
  ): Promise<void> {
    try {
      this.assertContextCurrent(context);
      this.assertAvailable();
      if (
        this.ready?.appUserId === context.appUserId &&
        this.ready.generation === context.lease.generation
      ) {
        return Promise.resolve();
      }
      if (this.ready && this.ready.appUserId !== context.appUserId) {
        throw new RevenueCatOperationFencedError();
      }
      if (this.activeHazard) throw new RevenueCatOperationBusyError();
      if (this.activeConfiguration) {
        if (
          this.activeConfiguration.ownerId !== context.appUserId ||
          this.activeConfiguration.generation !== context.lease.generation
        ) {
          throw new RevenueCatOperationFencedError();
        }
        return awaitAccountGenerationLease(context.lease, () =>
          this.activeConfiguration!.operation,
        );
      }
    } catch (error) {
      return Promise.reject(error);
    }

    const record = activeRecord(context, 'configure');
    const detachInvalidation = this.attachOwnerInvalidation(context, record);
    const operation = (async () => {
      let identityProven = false;
      try {
        const adapter = await loadAdapter();
        this.assertRecordCanStart(context, record);
        const configured = await adapter.isConfigured();
        this.assertRecordCanStart(context, record);

        if (!configured) {
          await adapter.configure(context.appUserId, () => {
            record.nativeStarted = true;
          });
          if (!record.nativeStarted) throw new RevenueCatOperationFencedError();
          const fence = await adapter.fenceIdentity();
          if (!fence.configured) throw new RevenueCatResetUnprovenError();
          await this.proveExpectedIdentity(adapter, context);
          identityProven = true;
        } else {
          const [nativeUserId, anonymous] = await Promise.all([
            adapter.getAppUserID(),
            adapter.isAnonymous(),
          ]);
          this.assertRecordCanStart(context, record);
          if (!anonymous && nativeUserId === context.appUserId) {
            identityProven = true;
          } else {
            record.nativeStarted = true;
            if (!anonymous) {
              // Never log a new owner directly over another authenticated ID:
              // RevenueCat can alias those identities. Prove logout first.
              await this.logOutAndProveAnonymous(adapter);
              this.assertRecordCanStart(context, record);
            }
            await this.logInAndProveExpected(adapter, context);
            identityProven = true;
          }
        }

        this.assertRecordCanStart(context, record);
        this.setReady(context);
      } catch (error) {
        if (record.nativeStarted && !identityProven) this.quarantine();
        throw error;
      } finally {
        detachInvalidation();
        if (this.activeConfiguration?.record === record) this.activeConfiguration = null;
        record.resolveTerminal();
      }
    })();

    this.activeConfiguration = {
      generation: context.lease.generation,
      operation,
      ownerId: context.appUserId,
      record,
    };
    return awaitAccountGenerationLease(context.lease, () => operation);
  }

  runRead<TAdapter extends RevenueCatIdentityAdapter, TResult>(
    context: RevenueCatOwnerContext,
    loadAdapter: () => Promise<TAdapter>,
    operation: (adapter: TAdapter) => Promise<TResult>,
  ): Promise<TResult> {
    return awaitAccountGenerationLease(context.lease, async () => {
      const stamp = this.currentStamp(context);
      const adapter = await loadAdapter();
      this.assertContextCurrent(context);
      this.assertStampCurrent(stamp);
      await this.proveExpectedIdentity(adapter, context);
      this.assertStampCurrent(stamp);
      const value = await operation(adapter);
      this.assertContextCurrent(context);
      this.assertStampCurrent(stamp);
      await this.proveExpectedIdentity(adapter, context);
      this.assertStampCurrent(stamp);
      return value;
    });
  }

  runHazard<TAdapter extends RevenueCatIdentityAdapter, TResult>(
    context: RevenueCatOwnerContext,
    kind: Exclude<ActiveNativeRecord['kind'], 'configure'>,
    loadAdapter: () => Promise<TAdapter>,
    operation: (adapter: TAdapter) => Promise<TResult>,
  ): Promise<TResult> {
    try {
      this.currentStamp(context);
      if (this.activeConfiguration || this.activeHazard) throw new RevenueCatOperationBusyError();
    } catch (error) {
      return Promise.reject(error);
    }

    const record = activeRecord(context, kind);
    this.activeHazard = record;
    const detachInvalidation = this.attachOwnerInvalidation(context, record);
    const operationPromise = (async () => {
      let postIdentityProven = false;
      try {
        const stamp = this.currentStamp(context);
        const adapter = await loadAdapter();
        this.assertRecordCanStart(context, record);
        this.assertStampCurrent(stamp);
        await this.proveExpectedIdentity(adapter, context);
        this.assertRecordCanStart(context, record);
        this.assertStampCurrent(stamp);

        record.nativeStarted = true;
        let nativeError: unknown = null;
        let value!: TResult;
        try {
          value = await operation(adapter);
        } catch (error) {
          nativeError = error;
        }

        this.assertRecordCanStart(context, record);
        this.assertStampCurrent(stamp);
        await this.proveExpectedIdentity(adapter, context);
        this.assertStampCurrent(stamp);
        postIdentityProven = true;
        if (nativeError) throw nativeError;
        return value;
      } catch (error) {
        if (record.nativeStarted && !postIdentityProven) this.quarantine();
        throw error;
      } finally {
        detachInvalidation();
        if (this.activeHazard === record) this.activeHazard = null;
        record.resolveTerminal();
      }
    })();

    return awaitAccountGenerationLease(context.lease, () => operationPromise);
  }

  private requestIdentityCleanup<TAdapter extends RevenueCatIdentityAdapter>(
    acceptableOwnerId: string | null,
    loadAdapter: () => Promise<TAdapter>,
  ): Promise<void> {
    if (this.resetPromise) {
      // Concurrent publication requests may accept one exact owner each. Their
      // safe intersection is anonymous; a full reset is already anonymous-only.
      if (
        this.cleanupAcceptableOwnerId !== null &&
        this.cleanupAcceptableOwnerId !== acceptableOwnerId
      ) {
        this.cleanupAcceptableOwnerId = null;
        this.cleanupRevision += 1;
      }
      return this.resetPromise;
    }

    this.cleanupAcceptableOwnerId = acceptableOwnerId;
    this.cleanupRevision += 1;
    this.resetting = true;
    this.quarantine();
    const nativeTerminals: Promise<void>[] = [];
    for (const record of [this.activeConfiguration?.record, this.activeHazard]) {
      if (!record) continue;
      if (record.nativeStarted) {
        nativeTerminals.push(record.terminal);
      } else {
        record.cancelled = true;
        record.stale = true;
        if (this.activeHazard === record) this.activeHazard = null;
        if (this.activeConfiguration?.record === record) this.activeConfiguration = null;
      }
    }

    let reset!: Promise<void>;
    reset = (async () => {
      try {
        await Promise.all(nativeTerminals);
        const adapter = await loadAdapter();
        while (true) {
          const cleanupRevision = this.cleanupRevision;
          await this.proveIdentitySafeForPublication(
            adapter,
            this.cleanupAcceptableOwnerId,
          );
          if (cleanupRevision === this.cleanupRevision) break;
        }
        this.ready = null;
        this.quarantined = false;
      } catch (error) {
        this.quarantined = true;
        this.ready = null;
        throw error;
      } finally {
        this.resetting = false;
        if (this.resetPromise === reset) this.resetPromise = null;
      }
    })();
    this.resetPromise = reset;
    return reset;
  }

  prepareForSessionPublication<TAdapter extends RevenueCatIdentityAdapter>(
    acceptableOwnerId: string | null,
    loadAdapter: () => Promise<TAdapter>,
  ): Promise<void> {
    return this.requestIdentityCleanup(acceptableOwnerId, loadAdapter);
  }

  reset<TAdapter extends RevenueCatIdentityAdapter>(
    loadAdapter: () => Promise<TAdapter>,
  ): Promise<void> {
    return this.requestIdentityCleanup(null, loadAdapter);
  }

  isStampCurrent(stamp: RevenueCatOwnerStamp): boolean {
    try {
      this.assertStampCurrent(stamp);
      return true;
    } catch {
      return false;
    }
  }

  stampFor(context: RevenueCatOwnerContext): RevenueCatOwnerStamp {
    return this.currentStamp(context);
  }

  registerListener(stamp: RevenueCatOwnerStamp, cleanup: () => void): () => void {
    this.assertStampCurrent(stamp);
    this.clearListener();
    const record: ActiveListener = { cleanup, removed: false, stamp };
    this.activeListener = record;
    return () => {
      if (record.removed) return;
      record.removed = true;
      if (this.activeListener === record) this.activeListener = null;
      cleanup();
    };
  }

  activeNativeCount(): number {
    return Number(Boolean(this.activeConfiguration?.record.nativeStarted)) +
      Number(Boolean(this.activeHazard?.nativeStarted)) +
      Number(Boolean(this.resetPromise));
  }

  async waitForNativeHazardsToSettle(): Promise<void> {
    while (true) {
      const waits = [
        this.activeConfiguration?.record.nativeStarted
          ? this.activeConfiguration.record.terminal
          : null,
        this.activeHazard?.nativeStarted ? this.activeHazard.terminal : null,
        this.resetPromise,
      ].filter((pending): pending is Promise<void> => Boolean(pending));
      if (waits.length === 0) return;
      await Promise.allSettled(waits);
    }
  }
}
