import type { QueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';

import type { AccountGenerationLease } from '@/lib/auth/accountGeneration';
import { runRequestWithLease } from '@/lib/network/requestPolicy';
import { queryKeys, runOwnerQueryOperation, type OwnerQueryScope } from '@/lib/query/queryKeys';

import { reserveTrialGroundedTurn, type GroundedTurnOperationId } from './store';

const OPERATION_ID = /^[a-f0-9]{32}$/;
const REQUEST_FINGERPRINT = /^[a-f0-9]{32}$/;
const DEFAULT_PROVIDER_DEADLINE_MS = 20_000;
const DEFAULT_PROVIDER_RESPONSE_BYTES = 128 * 1024;

export const ASK_GROUNDED_TURN_IN_PROGRESS = 'ASK_GROUNDED_TURN_IN_PROGRESS';
export const ASK_GROUNDED_TURN_OPERATION_CONFLICT = 'ASK_GROUNDED_TURN_OPERATION_CONFLICT';
export const ASK_GROUNDED_DELIVERY_MUST_BE_SYNCHRONOUS =
  'ASK_GROUNDED_DELIVERY_MUST_BE_SYNCHRONOUS';
export const ASK_GROUNDED_DELIVERY_FAILED = 'ASK_GROUNDED_DELIVERY_FAILED';
const ASK_GROUNDED_COORDINATOR_RESET_TEST_ONLY = 'ASK_GROUNDED_COORDINATOR_RESET_TEST_ONLY';

declare const groundedTurnRequestFingerprintBrand: unique symbol;
export type GroundedTurnRequestFingerprint = string & {
  readonly [groundedTurnRequestFingerprintBrand]: true;
};

export class GroundedTurnDeliveryError extends Error {
  readonly code = ASK_GROUNDED_DELIVERY_FAILED;

  constructor() {
    super(ASK_GROUNDED_DELIVERY_FAILED);
    this.name = 'GroundedTurnDeliveryError';
  }
}

/** Create one content-free identity per distinct grounded answer. Trial retries
 * must reuse it so an uncertain reservation response cannot consume two turns. */
export function createGroundedTurnOperationId(): GroundedTurnOperationId {
  const operationId = randomUUID().replace(/-/g, '').toLowerCase();
  if (!OPERATION_ID.test(operationId)) throw new Error('ASK_TURN_OPERATION_ID_UNAVAILABLE');
  return operationId as GroundedTurnOperationId;
}

/** Create a content-free identity for the exact provider input. Keep it with the
 * operation and reuse both identities only when retrying that same input. */
export function createGroundedTurnRequestFingerprint(): GroundedTurnRequestFingerprint {
  const fingerprint = randomUUID().replace(/-/g, '').toLowerCase();
  if (!REQUEST_FINGERPRINT.test(fingerprint)) {
    throw new Error('ASK_GROUNDED_REQUEST_FINGERPRINT_UNAVAILABLE');
  }
  return fingerprint as GroundedTurnRequestFingerprint;
}

export type GroundedTurnAccess =
  | Readonly<{
      kind: 'trial';
      period: string;
      operationId: GroundedTurnOperationId;
    }>
  | Readonly<{
      kind: 'uncapped';
      operationId: GroundedTurnOperationId;
    }>;

export type GroundedTurnProviderContext = Readonly<{
  attempt: number;
  operationId: GroundedTurnOperationId;
  recordedTrialCount: number | null;
  signal: AbortSignal;
}>;

export type GroundedTurnPublishContext = Readonly<{
  assertCurrent: () => void;
  operationId: GroundedTurnOperationId;
  ownerScope: OwnerQueryScope;
  recordedTrialCount: number | null;
}>;

type SynchronousResult<T> = T extends PromiseLike<unknown> ? never : T;

export type GroundedTurnExecution<TProviderResult, TPublishedResult> = Readonly<{
  /** The provider phase must remain side-effect free. Its late result is detached
   * after cancellation or deadline expiry and can never authorize publication. */
  request: (context: GroundedTurnProviderContext) => Promise<TProviderResult>;
  /** Publication/delivery must be synchronous, atomic, and no-throw so the owner
   * assertion and visible commit are one uninterrupted JavaScript turn. This
   * boundary cannot roll back caller-owned side effects if the callback throws. */
  publish: (
    result: TProviderResult,
    context: GroundedTurnPublishContext,
  ) => SynchronousResult<TPublishedResult>;
  providerDeadlineMs?: number;
  providerMaxResponseBytes?: number;
  queryClient: Pick<QueryClient, 'setQueryData'>;
  /** Opaque, content-free identity for the exact provider input. A retry must
   * retain it; a different input must own a different fingerprint. */
  requestFingerprint: GroundedTurnRequestFingerprint;
}>;

type GroundedTurnRequestExecution<TProviderResult> = Readonly<{
  providerDeadlineMs?: number;
  providerMaxResponseBytes?: number;
  request: (context: GroundedTurnProviderContext) => Promise<TProviderResult>;
}>;

type ActiveGroundedTurn = Readonly<{
  joinFingerprint: string;
  operationId: GroundedTurnOperationId;
  promise: Promise<unknown>;
}>;

type GroundedTurnCoordinator = Readonly<{
  run: <T>(
    ownerScope: OwnerQueryScope,
    operationId: GroundedTurnOperationId,
    joinFingerprint: string,
    operation: () => Promise<T>,
  ) => Promise<T>;
}>;

function groundedTurnError(code: string): Error {
  return new Error(code);
}

/** One active provider turn per owner generation. An identical invocation joins
 * the same promise; a distinct rapid turn is rejected before it can reserve quota. */
function createGroundedTurnCoordinator(): GroundedTurnCoordinator {
  const activeByGeneration = new Map<number, ActiveGroundedTurn>();

  return Object.freeze({
    run<T>(
      ownerScope: OwnerQueryScope,
      operationId: GroundedTurnOperationId,
      joinFingerprint: string,
      operation: () => Promise<T>,
    ): Promise<T> {
      const active = activeByGeneration.get(ownerScope.generation);
      if (active) {
        if (active.operationId !== operationId) {
          return Promise.reject(groundedTurnError(ASK_GROUNDED_TURN_IN_PROGRESS));
        }
        if (active.joinFingerprint !== joinFingerprint) {
          return Promise.reject(groundedTurnError(ASK_GROUNDED_TURN_OPERATION_CONFLICT));
        }
        return active.promise as Promise<T>;
      }

      let pending!: Promise<T>;
      pending = Promise.resolve()
        .then(operation)
        .finally(() => {
          if (activeByGeneration.get(ownerScope.generation)?.promise === pending) {
            activeByGeneration.delete(ownerScope.generation);
          }
        });
      activeByGeneration.set(
        ownerScope.generation,
        Object.freeze({ joinFingerprint, operationId, promise: pending }),
      );
      return pending;
    },
  });
}

let defaultGroundedTurnCoordinator = createGroundedTurnCoordinator();

/** Test isolation only. Production callers cannot inject or replace the global
 * coordinator and therefore cannot bypass the one-turn-per-owner guarantee. */
export function resetGroundedTurnCoordinatorForTests(): void {
  if (process.env.NODE_ENV !== 'test') {
    throw groundedTurnError(ASK_GROUNDED_COORDINATOR_RESET_TEST_ONLY);
  }
  defaultGroundedTurnCoordinator = createGroundedTurnCoordinator();
}

function joinFingerprint(
  access: GroundedTurnAccess,
  requestFingerprint: GroundedTurnRequestFingerprint,
): string {
  const accessIdentity = access.kind === 'trial' ? `trial:${access.period}` : 'uncapped';
  return `${accessIdentity}:${requestFingerprint}`;
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    (typeof value === 'object' || typeof value === 'function') &&
    value !== null &&
    typeof (value as { then?: unknown }).then === 'function'
  );
}

async function reserveTrialTurnUnderLease(
  lease: AccountGenerationLease,
  access: Extract<GroundedTurnAccess, { kind: 'trial' }>,
): Promise<number> {
  try {
    // This ambiguous local write must remain in both the generation drain and
    // private-KV mutation drain. Never detach or race it against cancellation.
    const count = await reserveTrialGroundedTurn(access.period, access.operationId);
    lease.assertCurrent();
    return count;
  } catch (error) {
    // A boundary that starts during the write owns the terminal error even when
    // the storage layer subsequently reports its own cancellation/failure.
    lease.assertCurrent();
    throw error;
  }
}

function publishTrialQuota(
  lease: AccountGenerationLease,
  ownerScope: OwnerQueryScope,
  access: Extract<GroundedTurnAccess, { kind: 'trial' }>,
  queryClient: Pick<QueryClient, 'setQueryData'>,
  count: number,
): void {
  lease.assertCurrent();
  queryClient.setQueryData<number>(queryKeys.askGroundedTurns(ownerScope, access.period), (prior) =>
    Math.max(prior ?? 0, count),
  );
  lease.assertCurrent();
}

async function requestProviderUnderLease<T>(
  lease: AccountGenerationLease,
  access: GroundedTurnAccess,
  recordedTrialCount: number | null,
  execution: GroundedTurnRequestExecution<T>,
): Promise<T> {
  try {
    return await runRequestWithLease(
      lease,
      {
        endpoint: 'ask_grounded',
        deadlineMs: positiveInteger(execution.providerDeadlineMs, DEFAULT_PROVIDER_DEADLINE_MS),
        idempotent: true,
        maxAttempts: 2,
        maxResponseBytes: positiveInteger(
          execution.providerMaxResponseBytes,
          DEFAULT_PROVIDER_RESPONSE_BYTES,
        ),
      },
      ({ attempt, signal }) =>
        execution.request(
          Object.freeze({
            attempt,
            operationId: access.operationId,
            recordedTrialCount,
            signal,
          }),
        ),
    );
  } catch (error) {
    // Convert request-policy owner cancellation back to the canonical generation
    // error while preserving same-owner provider/timeout taxonomy.
    lease.assertCurrent();
    throw error;
  }
}

function runGroundedTurnLifecycle<TProviderResult, TPublishedResult>(
  ownerScope: OwnerQueryScope,
  access: GroundedTurnAccess,
  execution: GroundedTurnExecution<TProviderResult, TPublishedResult>,
): Promise<TPublishedResult> {
  return runOwnerQueryOperation(ownerScope, async (lease) => {
    let recordedTrialCount: number | null = null;
    if (access.kind === 'trial') {
      recordedTrialCount = await reserveTrialTurnUnderLease(lease, access);
      publishTrialQuota(
        lease,
        ownerScope,
        access,
        execution.queryClient,
        recordedTrialCount,
      );
    }

    const providerResult = await requestProviderUnderLease(
      lease,
      access,
      recordedTrialCount,
      execution,
    );
    lease.assertCurrent();

    let published: SynchronousResult<TPublishedResult>;
    try {
      published = execution.publish(
        providerResult,
        Object.freeze({
          assertCurrent: () => lease.assertCurrent(),
          operationId: access.operationId,
          ownerScope,
          recordedTrialCount,
        }),
      );
    } catch {
      // No rollback is possible for caller-owned side effects. The callback's
      // contract is atomic/no-throw; expose a content-free typed terminal error.
      lease.assertCurrent();
      throw new GroundedTurnDeliveryError();
    }
    if (isPromiseLike(published)) {
      // Attach a terminal rejection handler even for a caller that bypassed the
      // synchronous TypeScript contract; it must never become an unhandled task.
      void Promise.resolve(published).catch(() => undefined);
      throw groundedTurnError(ASK_GROUNDED_DELIVERY_MUST_BE_SYNCHRONOUS);
    }
    lease.assertCurrent();
    return published as TPublishedResult;
  });
}

/** Reserve quota, publish that durable count, run one bounded pure provider
 * request, then synchronously publish/deliver under the same captured owner. */
export function runGroundedTurnForOwner<TProviderResult, TPublishedResult>(
  ownerScope: OwnerQueryScope,
  access: GroundedTurnAccess,
  execution: GroundedTurnExecution<TProviderResult, TPublishedResult>,
): Promise<TPublishedResult> {
  if (!REQUEST_FINGERPRINT.test(execution.requestFingerprint)) {
    return Promise.reject(groundedTurnError('ASK_GROUNDED_REQUEST_FINGERPRINT_UNAVAILABLE'));
  }
  return defaultGroundedTurnCoordinator.run(
    ownerScope,
    access.operationId,
    joinFingerprint(access, execution.requestFingerprint),
    () => runGroundedTurnLifecycle(ownerScope, access, execution),
  );
}
