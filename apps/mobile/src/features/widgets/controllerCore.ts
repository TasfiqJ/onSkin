import type {
  ResolvedRoutineWidgetAction,
  RoutineWidgetActionPhase,
  RoutineWidgetActionResolutionRequest,
} from './actionRegistry';
import {
  normalizeRoutineWidgetProps,
  ROUTINE_WIDGET_MAX_STEPS,
  type RoutineWidgetProps,
} from './contract';

export const ROUTINE_WIDGET_MAX_TIMELINE_ENTRIES = 32;

export const ROUTINE_WIDGET_TIMELINE_INVALID = 'ROUTINE_WIDGET_TIMELINE_INVALID';
export const ROUTINE_WIDGET_PENDING_ACTIONS_INVALID = 'ROUTINE_WIDGET_PENDING_ACTIONS_INVALID';
export const ROUTINE_WIDGET_ACTION_RESOLUTION_INVALID = 'ROUTINE_WIDGET_ACTION_RESOLUTION_INVALID';
export const ROUTINE_WIDGET_CANONICAL_COMPLETION_REJECTED =
  'ROUTINE_WIDGET_CANONICAL_COMPLETION_REJECTED';
export const ROUTINE_WIDGET_ACTION_ACKNOWLEDGEMENT_INCOMPLETE =
  'ROUTINE_WIDGET_ACTION_ACKNOWLEDGEMENT_INCOMPLETE';
export const ROUTINE_WIDGET_TIMELINE_REPLACEMENT_NOT_COMMITTED =
  'ROUTINE_WIDGET_TIMELINE_REPLACEMENT_NOT_COMMITTED';
export const ROUTINE_WIDGET_RECONCILIATION_INVALIDATED =
  'ROUTINE_WIDGET_RECONCILIATION_INVALIDATED';

/** Receipt returned only after the synchronous native timeline write returns. */
export const ROUTINE_WIDGET_TIMELINE_REPLACED = Symbol('ROUTINE_WIDGET_TIMELINE_REPLACED');

type RoutineWidgetControllerErrorCode =
  | typeof ROUTINE_WIDGET_TIMELINE_INVALID
  | typeof ROUTINE_WIDGET_PENDING_ACTIONS_INVALID
  | typeof ROUTINE_WIDGET_ACTION_RESOLUTION_INVALID
  | typeof ROUTINE_WIDGET_CANONICAL_COMPLETION_REJECTED
  | typeof ROUTINE_WIDGET_ACTION_ACKNOWLEDGEMENT_INCOMPLETE
  | typeof ROUTINE_WIDGET_TIMELINE_REPLACEMENT_NOT_COMMITTED
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
  acknowledgeActions: (tokens: readonly string[]) => Promise<number>;
  completeAction: (
    stepKey: string,
    localDate: string,
  ) => Promise<RoutineWidgetCanonicalCompletionResult>;
  now?: () => number;
  readTimeline: () => Promise<unknown>;
  /** Must return the receipt only after synchronously committing the prepared replacement. */
  replaceTimeline: () => typeof ROUTINE_WIDGET_TIMELINE_REPLACED;
  resolveActions: (
    request: RoutineWidgetActionResolutionRequest,
  ) => Promise<readonly ResolvedRoutineWidgetAction[]>;
}>;

export type RoutineWidgetReconciliationResult = Readonly<{
  acknowledgedTokenCount: number;
  completedStepCount: number;
  ignoredTokenCount: number;
  pendingTokenCount: number;
  resolvedTokenCount: number;
  timelineEntryCount: number;
}>;

type NormalizedTimelineEntry = Readonly<{
  dateMs: number;
  props: RoutineWidgetProps;
}>;

type PendingGroup = {
  localDate: string;
  phase: RoutineWidgetActionPhase;
  tokens: string[];
};

type ResolvedCompletion = Readonly<{
  localDate: string;
  stepKey: string;
  token: string;
}>;

const TIMELINE_ENTRY_KEYS = ['date', 'props'];
const RESOLVED_ACTION_KEYS = ['status', 'stepKey', 'token'];
const MAX_STEP_KEY_LENGTH = 512;

function fail(code: RoutineWidgetControllerErrorCode): never {
  throw new RoutineWidgetControllerError(code);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return (
    keys.length === sortedExpected.length &&
    keys.every((key, index) => key === sortedExpected[index])
  );
}

function normalizeTimeline(value: unknown): NormalizedTimelineEntry[] {
  if (!Array.isArray(value) || value.length > ROUTINE_WIDGET_MAX_TIMELINE_ENTRIES) {
    fail(ROUTINE_WIDGET_TIMELINE_INVALID);
  }

  const entries: NormalizedTimelineEntry[] = [];
  let priorDateMs = -1;
  for (const candidate of value) {
    if (!isRecord(candidate) || !hasExactKeys(candidate, TIMELINE_ENTRY_KEYS)) {
      fail(ROUTINE_WIDGET_TIMELINE_INVALID);
    }
    if (!(candidate.date instanceof Date)) fail(ROUTINE_WIDGET_TIMELINE_INVALID);
    const dateMs = candidate.date.getTime();
    if (!Number.isSafeInteger(dateMs) || dateMs < 0 || dateMs <= priorDateMs) {
      fail(ROUTINE_WIDGET_TIMELINE_INVALID);
    }
    const props = normalizeRoutineWidgetProps(candidate.props);
    if (!props) fail(ROUTINE_WIDGET_TIMELINE_INVALID);
    entries.push(Object.freeze({ dateMs, props }));
    priorDateMs = dateMs;
  }
  return entries;
}

function safeNow(now: () => number): number {
  const value = now();
  if (!Number.isSafeInteger(value) || value < 0) fail(ROUTINE_WIDGET_TIMELINE_INVALID);
  return value;
}

function pendingGroups(
  entries: readonly NormalizedTimelineEntry[],
  nowMs: number,
): { groups: PendingGroup[]; pendingTokenCount: number } {
  const allPendingTokens = new Set<string>();
  const eligibleTokens = new Map<string, string>();
  const groups = new Map<string, PendingGroup>();

  for (const { props } of entries) {
    for (const token of props.pendingActionTokens) {
      allPendingTokens.add(token);
      if (allPendingTokens.size > ROUTINE_WIDGET_MAX_STEPS) {
        fail(ROUTINE_WIDGET_PENDING_ACTIONS_INVALID);
      }
    }

    if (
      (props.status !== 'ready' && props.status !== 'complete') ||
      (props.phase !== 'AM' && props.phase !== 'PM') ||
      nowMs < props.updatedAtMs ||
      nowMs >= props.staleAtMs
    ) {
      continue;
    }

    const groupKey = `${props.localDate}\u0000${props.phase}`;
    let group = groups.get(groupKey);
    if (!group) {
      const created: PendingGroup = {
        localDate: props.localDate,
        phase: props.phase,
        tokens: [],
      };
      groups.set(groupKey, created);
      group = created;
    }
    for (const token of props.pendingActionTokens) {
      const existingGroup = eligibleTokens.get(token);
      if (existingGroup !== undefined && existingGroup !== groupKey) {
        fail(ROUTINE_WIDGET_PENDING_ACTIONS_INVALID);
      }
      if (existingGroup === undefined) {
        eligibleTokens.set(token, groupKey);
        group.tokens.push(token);
      }
    }
  }

  return {
    groups: [...groups.values()].filter(({ tokens }) => tokens.length > 0),
    pendingTokenCount: allPendingTokens.size,
  };
}

function normalizeResolution(
  value: readonly ResolvedRoutineWidgetAction[],
  group: PendingGroup,
): ResolvedRoutineWidgetAction[] {
  if (!Array.isArray(value) || value.length !== group.tokens.length) {
    fail(ROUTINE_WIDGET_ACTION_RESOLUTION_INVALID);
  }

  return value.map((candidate, index) => {
    if (!isRecord(candidate) || !hasExactKeys(candidate, RESOLVED_ACTION_KEYS)) {
      fail(ROUTINE_WIDGET_ACTION_RESOLUTION_INVALID);
    }
    if (candidate.token !== group.tokens[index]) {
      fail(ROUTINE_WIDGET_ACTION_RESOLUTION_INVALID);
    }
    if (candidate.status === 'resolved') {
      if (
        typeof candidate.stepKey !== 'string' ||
        candidate.stepKey.length === 0 ||
        candidate.stepKey.length > MAX_STEP_KEY_LENGTH ||
        candidate.stepKey !== candidate.stepKey.trim() ||
        !candidate.stepKey.startsWith(`${group.phase}:`) ||
        candidate.stepKey.length === group.phase.length + 1
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
        candidate.status === 'stale' ||
        candidate.status === 'expired') &&
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

function uniqueCompletions(actions: readonly ResolvedCompletion[]): ResolvedCompletion[] {
  const completions = new Map<string, ResolvedCompletion>();
  for (const action of actions) {
    const key = `${action.localDate}\u0000${action.stepKey}`;
    if (!completions.has(key)) completions.set(key, action);
  }
  return [...completions.values()];
}

async function reconcileRoutineWidgetTimeline(
  dependencies: RoutineWidgetControllerDependencies,
  assertCurrent: () => void,
): Promise<RoutineWidgetReconciliationResult> {
  assertCurrent();
  const timeline = normalizeTimeline(await dependencies.readTimeline());
  assertCurrent();
  const nowMs = safeNow(dependencies.now ?? Date.now);
  const pending = pendingGroups(timeline, nowMs);
  const resolved: ResolvedCompletion[] = [];

  // Resolve every group before the first canonical health-data write. A bad or
  // incomplete resolver response therefore cannot create a partial write set.
  for (const group of pending.groups) {
    assertCurrent();
    const resolution = normalizeResolution(
      await dependencies.resolveActions({
        tokens: group.tokens,
        localDate: group.localDate,
        phase: group.phase,
      }),
      group,
    );
    assertCurrent();
    for (const action of resolution) {
      if (action.status !== 'resolved') continue;
      resolved.push({ token: action.token, stepKey: action.stepKey, localDate: group.localDate });
    }
  }

  const completions = uniqueCompletions(resolved);
  for (const completion of completions) {
    assertCurrent();
    const result = await dependencies.completeAction(completion.stepKey, completion.localDate);
    assertCurrent();
    if (!result || result.done !== true || typeof result.inserted !== 'boolean') {
      fail(ROUTINE_WIDGET_CANONICAL_COMPLETION_REJECTED);
    }
  }

  if (resolved.length > 0) {
    const tokens = resolved.map(({ token }) => token);
    assertCurrent();
    const acknowledged = await dependencies.acknowledgeActions(tokens);
    assertCurrent();
    if (!Number.isSafeInteger(acknowledged) || acknowledged !== tokens.length) {
      fail(ROUTINE_WIDGET_ACTION_ACKNOWLEDGEMENT_INCOMPLETE);
    }
  }

  // expo-widgets updateTimeline is synchronous. Keeping this commit callback
  // synchronous lets the generation assertion and native dispatch occupy one
  // JavaScript turn with no stale continuation gap.
  assertCurrent();
  const replacementReceipt = dependencies.replaceTimeline();
  if (replacementReceipt !== ROUTINE_WIDGET_TIMELINE_REPLACED) {
    fail(ROUTINE_WIDGET_TIMELINE_REPLACEMENT_NOT_COMMITTED);
  }

  return Object.freeze({
    timelineEntryCount: timeline.length,
    pendingTokenCount: pending.pendingTokenCount,
    ignoredTokenCount: pending.pendingTokenCount - resolved.length,
    resolvedTokenCount: resolved.length,
    completedStepCount: completions.length,
    acknowledgedTokenCount: resolved.length,
  });
}

/**
 * Serializes all timeline reads and reconciliation writes. invalidate() closes
 * the captured generation synchronously; an in-flight canonical completion may
 * have succeeded, but its idempotency makes retry safe and the stale operation
 * can no longer acknowledge capabilities or replace the App Group timeline.
 */
export class RoutineWidgetReconciliationCoordinator {
  private generation = 0;
  private tail: Promise<void> = Promise.resolve();

  invalidate(): void {
    this.generation += 1;
  }

  reconcile(
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
      return reconcileRoutineWidgetTimeline(dependencies, assertCurrent);
    });
    this.tail = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }
}
