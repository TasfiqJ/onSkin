import type {
  ResolvedRoutineWidgetAction,
  RoutineWidgetActionAcknowledgementRequest,
  RoutineWidgetActionResolutionRequest,
} from './actionRegistry';
import { normalizeRoutineWidgetOpaqueUuid } from './contract';
import {
  ROUTINE_WIDGET_NATIVE_LIFECYCLE_VERSION,
  decodeRoutineWidgetNativeAuthority,
  decodeRoutineWidgetNativeOutboxJSON,
  type RoutineWidgetNativeAuthority,
  type RoutineWidgetNativeOutbox,
  type RoutineWidgetNativeReconciliationResult,
} from './nativeLifecycleContract';

export const ROUTINE_WIDGET_NATIVE_AUTHORITY_INVALID = 'ROUTINE_WIDGET_NATIVE_AUTHORITY_INVALID';
export const ROUTINE_WIDGET_NATIVE_OUTBOX_INVALID = 'ROUTINE_WIDGET_NATIVE_OUTBOX_INVALID';
export const ROUTINE_WIDGET_ACTION_RESOLUTION_INVALID = 'ROUTINE_WIDGET_ACTION_RESOLUTION_INVALID';
export const ROUTINE_WIDGET_CANONICAL_COMPLETION_REJECTED =
  'ROUTINE_WIDGET_CANONICAL_COMPLETION_REJECTED';
export const ROUTINE_WIDGET_NATIVE_RECONCILIATION_INVALID =
  'ROUTINE_WIDGET_NATIVE_RECONCILIATION_INVALID';
export const ROUTINE_WIDGET_ACTION_ACKNOWLEDGEMENT_INCOMPLETE =
  'ROUTINE_WIDGET_ACTION_ACKNOWLEDGEMENT_INCOMPLETE';
export const ROUTINE_WIDGET_RECONCILIATION_INVALIDATED =
  'ROUTINE_WIDGET_RECONCILIATION_INVALIDATED';

type RoutineWidgetControllerErrorCode =
  | typeof ROUTINE_WIDGET_NATIVE_AUTHORITY_INVALID
  | typeof ROUTINE_WIDGET_NATIVE_OUTBOX_INVALID
  | typeof ROUTINE_WIDGET_ACTION_RESOLUTION_INVALID
  | typeof ROUTINE_WIDGET_CANONICAL_COMPLETION_REJECTED
  | typeof ROUTINE_WIDGET_NATIVE_RECONCILIATION_INVALID
  | typeof ROUTINE_WIDGET_ACTION_ACKNOWLEDGEMENT_INCOMPLETE
  | typeof ROUTINE_WIDGET_RECONCILIATION_INVALIDATED;

export class RoutineWidgetControllerError extends Error {
  readonly code: RoutineWidgetControllerErrorCode;

  constructor(code: RoutineWidgetControllerErrorCode) {
    super(code);
    this.name = 'RoutineWidgetControllerError';
    this.code = code;
  }
}

export type RoutineWidgetCanonicalCompletionResult = Readonly<{
  done: boolean;
  inserted: boolean;
  firstEver?: boolean;
}>;

export type RoutineWidgetControllerDependencies = Readonly<{
  acknowledgeActions: (request: RoutineWidgetActionAcknowledgementRequest) => Promise<number>;
  commitReconciliation: (input: {
    acceptedTokens: readonly string[];
    expectedAuthorityNonce: string;
    expectedRevision: number;
    ownerGeneration: string;
    snapshotNonce: string;
  }) => RoutineWidgetNativeReconciliationResult;
  commitCapturedReconciliation: (input: {
    acceptedTokens: readonly string[];
    expectedAuthorityNonce: string;
    expectedRevision: number;
    ownerGeneration: string;
    quiescenceNonce: string;
    snapshotNonce: string;
  }) => RoutineWidgetNativeReconciliationResult;
  completeAction: (
    stepKey: string,
    localDate: string,
  ) => Promise<RoutineWidgetCanonicalCompletionResult>;
  now?: () => number;
  readAuthority: () => RoutineWidgetNativeAuthority;
  readOutbox: (expectedAuthorityNonce: string) => RoutineWidgetNativeOutbox;
  resolveActions: (
    request: RoutineWidgetActionResolutionRequest,
  ) => Promise<readonly ResolvedRoutineWidgetAction[]>;
}>;

export type RoutineWidgetReconciliationResult = Readonly<{
  acknowledgedTokenCount: number;
  completedStepCount: number;
  ignoredTokenCount: number;
  nativeStatus: 'committed' | 'redacted' | 'empty';
  outboxRecordCount: number;
  resolvedTokenCount: number;
}>;

export type RoutineWidgetCapturedOutboxInput = Readonly<{
  expectedAuthorityNonce: string;
  expectedOwnerGeneration: string;
  outbox: RoutineWidgetNativeOutbox;
  quiescenceNonce: string;
}>;

type BoundOutbox = Readonly<{
  authorityNonce: string;
  localDate: string;
  ownerGeneration: string;
  phase: 'AM' | 'PM';
  records: RoutineWidgetNativeOutbox['records'];
  snapshotNonce: string;
}>;

const RESOLUTION_KEYS = ['status', 'stepKey', 'token'].sort();
const MAX_STEP_KEY_LENGTH = 512;

function fail(code: RoutineWidgetControllerErrorCode): never {
  throw new RoutineWidgetControllerError(code);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value).sort();
  return keys.length === expected.length && keys.every((key, index) => key === expected[index]);
}

function safeNow(now: () => number): number {
  const value = now();
  if (!Number.isSafeInteger(value) || value < 0) fail(ROUTINE_WIDGET_NATIVE_OUTBOX_INVALID);
  return value;
}

function normalizeAuthority(
  value: RoutineWidgetNativeAuthority,
  expectedOwnerGeneration: string,
): RoutineWidgetNativeAuthority {
  let authority: RoutineWidgetNativeAuthority;
  try {
    authority = decodeRoutineWidgetNativeAuthority(value);
  } catch {
    fail(ROUTINE_WIDGET_NATIVE_AUTHORITY_INVALID);
  }
  if (!authority.enabled || authority.ownerGeneration !== expectedOwnerGeneration) {
    fail(ROUTINE_WIDGET_NATIVE_AUTHORITY_INVALID);
  }
  return authority;
}

function normalizeOutbox(
  value: RoutineWidgetNativeOutbox,
  authority: RoutineWidgetNativeAuthority,
): BoundOutbox | null {
  let outbox: RoutineWidgetNativeOutbox;
  try {
    outbox = decodeRoutineWidgetNativeOutboxJSON(JSON.stringify(value));
  } catch {
    fail(ROUTINE_WIDGET_NATIVE_OUTBOX_INVALID);
  }
  if (outbox.authorityNonce !== authority.authorityNonce) {
    fail(ROUTINE_WIDGET_NATIVE_OUTBOX_INVALID);
  }
  const first = outbox.records[0];
  if (!first) return null;
  if (first.ownerGeneration !== authority.ownerGeneration) {
    fail(ROUTINE_WIDGET_NATIVE_OUTBOX_INVALID);
  }
  for (const record of outbox.records) {
    if (
      record.ownerGeneration !== first.ownerGeneration ||
      record.snapshotNonce !== first.snapshotNonce ||
      record.localDate !== first.localDate ||
      record.phase !== first.phase ||
      record.staleAtMs !== first.staleAtMs
    ) {
      fail(ROUTINE_WIDGET_NATIVE_OUTBOX_INVALID);
    }
  }
  return Object.freeze({
    authorityNonce: outbox.authorityNonce,
    localDate: first.localDate,
    ownerGeneration: first.ownerGeneration,
    phase: first.phase,
    records: outbox.records,
    snapshotNonce: first.snapshotNonce,
  });
}

function normalizeResolution(
  value: readonly ResolvedRoutineWidgetAction[],
  tokens: readonly string[],
  phase: 'AM' | 'PM',
): ResolvedRoutineWidgetAction[] {
  if (!Array.isArray(value) || value.length !== tokens.length) {
    fail(ROUTINE_WIDGET_ACTION_RESOLUTION_INVALID);
  }
  return value.map((candidate, index) => {
    if (!isRecord(candidate) || !exactKeys(candidate, RESOLUTION_KEYS)) {
      fail(ROUTINE_WIDGET_ACTION_RESOLUTION_INVALID);
    }
    if (candidate.token !== tokens[index] || !normalizeRoutineWidgetOpaqueUuid(candidate.token)) {
      fail(ROUTINE_WIDGET_ACTION_RESOLUTION_INVALID);
    }
    if (candidate.status === 'resolved') {
      if (
        typeof candidate.stepKey !== 'string' ||
        candidate.stepKey.length === 0 ||
        candidate.stepKey.length > MAX_STEP_KEY_LENGTH ||
        candidate.stepKey !== candidate.stepKey.trim() ||
        !candidate.stepKey.startsWith(`${phase}:`) ||
        candidate.stepKey.length === phase.length + 1
      ) {
        fail(ROUTINE_WIDGET_ACTION_RESOLUTION_INVALID);
      }
      return Object.freeze({
        token: candidate.token,
        stepKey: candidate.stepKey,
        status: 'resolved' as const,
      });
    }
    if (
      (candidate.status === 'unknown' ||
        candidate.status === 'expired' ||
        candidate.status === 'stale') &&
      candidate.stepKey === null
    ) {
      return Object.freeze({
        token: candidate.token,
        stepKey: null,
        status: candidate.status,
      });
    }
    fail(ROUTINE_WIDGET_ACTION_RESOLUTION_INVALID);
  });
}

async function reconcileBoundRoutineWidgetNativeOutbox(
  outbox: BoundOutbox | null,
  quiescenceNonce: string | null,
  dependencies: RoutineWidgetControllerDependencies,
  assertCurrent: () => void,
): Promise<RoutineWidgetReconciliationResult> {
  if (outbox === null) {
    return Object.freeze({
      acknowledgedTokenCount: 0,
      completedStepCount: 0,
      ignoredTokenCount: 0,
      nativeStatus: 'empty',
      outboxRecordCount: 0,
      resolvedTokenCount: 0,
    });
  }

  const events = outbox.records.map(({ actionToken, createdAtMs }) =>
    Object.freeze({ token: actionToken, createdAtMs }),
  );
  const tokens = events.map(({ token }) => token);
  const nowMs = safeNow(dependencies.now ?? Date.now);
  let resolution: ResolvedRoutineWidgetAction[];
  if (events.some(({ createdAtMs }) => createdAtMs > nowMs)) {
    resolution = tokens.map((token) =>
      Object.freeze({ token, stepKey: null, status: 'expired' as const }),
    );
  } else {
    assertCurrent();
    resolution = normalizeResolution(
      await dependencies.resolveActions({
        events,
        ownerGeneration: outbox.ownerGeneration,
        snapshotNonce: outbox.snapshotNonce,
        localDate: outbox.localDate,
        phase: outbox.phase,
      }),
      tokens,
      outbox.phase,
    );
    assertCurrent();
  }

  // A resolver response is validated in full before the first canonical write.
  const resolved = resolution.filter(
    (action): action is Extract<ResolvedRoutineWidgetAction, { status: 'resolved' }> =>
      action.status === 'resolved',
  );
  const uniqueCompletions = new Map<string, string>();
  for (const action of resolved) uniqueCompletions.set(action.stepKey, action.stepKey);
  for (const stepKey of uniqueCompletions.values()) {
    assertCurrent();
    const completion = await dependencies.completeAction(stepKey, outbox.localDate);
    assertCurrent();
    if (!completion || completion.done !== true || typeof completion.inserted !== 'boolean') {
      fail(ROUTINE_WIDGET_CANONICAL_COMPLETION_REJECTED);
    }
  }

  const acceptedTokens = resolved.map(({ token }) => token);
  assertCurrent();
  const reconciliationInput = {
    acceptedTokens,
    expectedAuthorityNonce: outbox.authorityNonce,
    expectedRevision: outbox.records[outbox.records.length - 1]!.revision,
    ownerGeneration: outbox.ownerGeneration,
    snapshotNonce: outbox.snapshotNonce,
  };
  const nativeResult =
    quiescenceNonce === null
      ? dependencies.commitReconciliation(reconciliationInput)
      : dependencies.commitCapturedReconciliation({
          ...reconciliationInput,
          quiescenceNonce,
        });
  assertCurrent();
  if (
    !nativeResult ||
    (nativeResult.status !== 'committed' && nativeResult.status !== 'redacted') ||
    (nativeResult.status === 'committed' && acceptedTokens.length !== tokens.length)
  ) {
    fail(ROUTINE_WIDGET_NATIVE_RECONCILIATION_INVALID);
  }

  if (acceptedTokens.length > 0) {
    const acceptedTokenSet = new Set(acceptedTokens);
    assertCurrent();
    const acknowledged = await dependencies.acknowledgeActions({
      events: events.filter(({ token }) => acceptedTokenSet.has(token)),
      ownerGeneration: outbox.ownerGeneration,
      snapshotNonce: outbox.snapshotNonce,
    });
    assertCurrent();
    if (!Number.isSafeInteger(acknowledged) || acknowledged !== acceptedTokens.length) {
      fail(ROUTINE_WIDGET_ACTION_ACKNOWLEDGEMENT_INCOMPLETE);
    }
  }

  return Object.freeze({
    acknowledgedTokenCount: acceptedTokens.length,
    completedStepCount: uniqueCompletions.size,
    ignoredTokenCount: tokens.length - acceptedTokens.length,
    nativeStatus: nativeResult.status,
    outboxRecordCount: tokens.length,
    resolvedTokenCount: acceptedTokens.length,
  });
}

async function reconcileRoutineWidgetNativeOutbox(
  expectedOwnerGeneration: string,
  dependencies: RoutineWidgetControllerDependencies,
  assertCurrent: () => void,
): Promise<RoutineWidgetReconciliationResult> {
  if (normalizeRoutineWidgetOpaqueUuid(expectedOwnerGeneration) === null) {
    fail(ROUTINE_WIDGET_NATIVE_AUTHORITY_INVALID);
  }
  assertCurrent();
  const authority = normalizeAuthority(dependencies.readAuthority(), expectedOwnerGeneration);
  assertCurrent();
  const outbox = normalizeOutbox(dependencies.readOutbox(authority.authorityNonce), authority);
  assertCurrent();
  return reconcileBoundRoutineWidgetNativeOutbox(outbox, null, dependencies, assertCurrent);
}

async function reconcileCapturedRoutineWidgetNativeOutbox(
  input: RoutineWidgetCapturedOutboxInput,
  dependencies: RoutineWidgetControllerDependencies,
  assertCurrent: () => void,
): Promise<RoutineWidgetReconciliationResult> {
  const expectedAuthorityNonce = normalizeRoutineWidgetOpaqueUuid(input.expectedAuthorityNonce);
  const expectedOwnerGeneration = normalizeRoutineWidgetOpaqueUuid(input.expectedOwnerGeneration);
  const quiescenceNonce = normalizeRoutineWidgetOpaqueUuid(input.quiescenceNonce);
  if (
    expectedAuthorityNonce === null ||
    expectedOwnerGeneration === null ||
    expectedAuthorityNonce === expectedOwnerGeneration ||
    quiescenceNonce === null ||
    quiescenceNonce === expectedAuthorityNonce ||
    quiescenceNonce === expectedOwnerGeneration
  ) {
    fail(ROUTINE_WIDGET_NATIVE_AUTHORITY_INVALID);
  }
  const authority = normalizeAuthority(
    {
      schemaVersion: ROUTINE_WIDGET_NATIVE_LIFECYCLE_VERSION,
      authorityNonce: expectedAuthorityNonce,
      enabled: true,
      ownerGeneration: expectedOwnerGeneration,
    },
    expectedOwnerGeneration,
  );
  assertCurrent();
  const outbox = normalizeOutbox(input.outbox, authority);
  assertCurrent();
  return reconcileBoundRoutineWidgetNativeOutbox(
    outbox,
    quiescenceNonce,
    dependencies,
    assertCurrent,
  );
}

/** Serializes native reads, canonical writes, native CAS, and private acknowledgement. */
export class RoutineWidgetReconciliationCoordinator {
  private generation = 0;
  private tail: Promise<void> = Promise.resolve();

  invalidate(): void {
    this.generation += 1;
  }

  reconcile(
    expectedOwnerGeneration: string,
    dependencies: RoutineWidgetControllerDependencies,
  ): Promise<RoutineWidgetReconciliationResult> {
    const capturedGeneration = this.generation;
    const assertCurrent = () => {
      if (capturedGeneration !== this.generation) {
        fail(ROUTINE_WIDGET_RECONCILIATION_INVALIDATED);
      }
    };
    const operation = this.tail.then(() => {
      assertCurrent();
      return reconcileRoutineWidgetNativeOutbox(
        expectedOwnerGeneration,
        dependencies,
        assertCurrent,
      );
    });
    this.tail = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }

  reconcileCaptured(
    input: RoutineWidgetCapturedOutboxInput,
    dependencies: RoutineWidgetControllerDependencies,
  ): Promise<RoutineWidgetReconciliationResult> {
    const capturedGeneration = this.generation;
    const assertCurrent = () => {
      if (capturedGeneration !== this.generation) {
        fail(ROUTINE_WIDGET_RECONCILIATION_INVALIDATED);
      }
    };
    const operation = this.tail.then(() => {
      assertCurrent();
      return reconcileCapturedRoutineWidgetNativeOutbox(input, dependencies, assertCurrent);
    });
    this.tail = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }
}
