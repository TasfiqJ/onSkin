export const COMPLETION_SYNC_UUID_UNAVAILABLE = 'COMPLETION_SYNC_UUID_UNAVAILABLE';
export const COMPLETION_SYNC_TIMEZONE_INVALID = 'COMPLETION_SYNC_TIMEZONE_INVALID';
export const COMPLETION_SYNC_INVALID = 'COMPLETION_SYNC_INVALID';

const CANONICAL_UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const STEP_KEY = /^(AM|PM):([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/u;
const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/u;
const UUID_ATTEMPTS = 8;

export type CompletionSyncRoutineType = 'AM' | 'PM';
export type CompletionSyncOperationKind = 'step' | 'routine_day';
export type CompletionSyncRetryableCode = 'COMPLETION_PRODUCT_RETRY_LATER';
export type CompletionSyncRemoteTerminalCode =
  | 'COMPLETION_REQUEST_INVALID'
  | 'COMPLETION_EVENT_CONFLICT'
  | 'COMPLETION_IDENTITY_CONFLICT'
  | 'COMPLETION_AFTER_PRODUCT_DELETION';
export const COMPLETION_DEPENDENCY_TERMINAL = 'COMPLETION_DEPENDENCY_TERMINAL' as const;
export type CompletionSyncTerminalCode =
  | CompletionSyncRemoteTerminalCode
  | typeof COMPLETION_DEPENDENCY_TERMINAL;
export type CompletionSyncUnavailableReason =
  | 'COMPLETION_TIMEZONE_UNAVAILABLE'
  | 'COMPLETION_PRODUCT_IDENTITY_REPAIR_REQUIRED';
export type CompletionSyncUnsyncedDisposition = 'recoverable' | 'terminal';

const COMPLETION_SYNC_REMOTE_TERMINAL_CODES = new Set<CompletionSyncRemoteTerminalCode>([
  'COMPLETION_REQUEST_INVALID',
  'COMPLETION_EVENT_CONFLICT',
  'COMPLETION_IDENTITY_CONFLICT',
  'COMPLETION_AFTER_PRODUCT_DELETION',
]);

export type CompletionSyncOperation = Readonly<{
  eventId: string;
  kind: CompletionSyncOperationKind;
  routineId: string;
  routineType: CompletionSyncRoutineType;
  stepId: string | null;
  userProductId: string | null;
  stepOrder: number | null;
  completedAt: string;
  completedDate: string;
  timezone: string;
}>;

export type CompletionSyncTerminal = Readonly<{
  eventId: string;
  code: CompletionSyncTerminalCode;
  /** Present only for a routine-day marker blocked by these remote-terminal steps. */
  dependencyEventIds?: string[];
}>;

export type CompletionSyncUnsynced = Readonly<{
  eventId: string;
  stepKey: string;
  routineType: CompletionSyncRoutineType;
  stepOrder: number;
  completedAt: string;
  completedDate: string;
  completionDayInserted: boolean;
  reason: CompletionSyncUnavailableReason;
  /**
   * Identity-incompatible legacy facts cannot be rebound without an explicit,
   * crash-safe old-to-new product mapping. They remain terminal local evidence
   * rather than being presented as retryable work.
   */
  disposition: CompletionSyncUnsyncedDisposition;
  /** Exact IANA spelling observed at the tap, when one was available. */
  timezoneEvidence: string | null;
}>;

export type CompletionSyncState = {
  routineIds: Record<CompletionSyncRoutineType, string | null>;
  stepIds: Record<string, Readonly<{ id: string; stepOrder: number }>>;
  journal: CompletionSyncOperation[];
  outbox: string[];
  terminal: CompletionSyncTerminal[];
  /**
   * Truthful local evidence for real-plan taps that could not yet be projected
   * into a server operation. It remains in the encrypted export until recovery
   * succeeds or the user repairs an incompatible legacy Shelf identity.
   */
  unsynced: CompletionSyncUnsynced[];
};

export type CompletionSyncEvidence = Readonly<{
  hasCompletedStep: (completedDate: string, stepKey: string) => boolean;
  hasCompletedDay: (completedDate: string) => boolean;
}>;

export function emptyCompletionSyncState(): CompletionSyncState {
  return {
    routineIds: { AM: null, PM: null },
    stepIds: {},
    journal: [],
    outbox: [],
    terminal: [],
    unsynced: [],
  };
}

export function canonicalCompletionSyncUuid(value: unknown): string | null {
  return typeof value === 'string' && CANONICAL_UUID_V4.test(value) ? value : null;
}

export function createCompletionSyncUuid(factory: () => string): string {
  for (let attempt = 0; attempt < UUID_ATTEMPTS; attempt += 1) {
    const candidate = canonicalCompletionSyncUuid(factory());
    if (candidate !== null) return candidate;
  }
  throw new Error(COMPLETION_SYNC_UUID_UNAVAILABLE);
}

export function createUniqueCompletionSyncUuid(
  factory: () => string,
  used: ReadonlySet<string>,
): string {
  for (let attempt = 0; attempt < UUID_ATTEMPTS; attempt += 1) {
    const candidate = canonicalCompletionSyncUuid(factory());
    if (candidate !== null && !used.has(candidate)) return candidate;
  }
  throw new Error(COMPLETION_SYNC_UUID_UNAVAILABLE);
}

export function completionSyncStepIdentity(
  value: unknown,
): Readonly<{ routineType: CompletionSyncRoutineType; userProductId: string }> | null {
  if (typeof value !== 'string') return null;
  const match = STEP_KEY.exec(value);
  if (!match) return null;
  return {
    routineType: match[1] as CompletionSyncRoutineType,
    userProductId: match[2]!,
  };
}

export function canonicalCompletionSyncDate(value: unknown): string | null {
  if (typeof value !== 'string' || !LOCAL_DATE.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(year!, month! - 1, day!, 12, 0, 0, 0);
  return parsed.getFullYear() === year &&
    parsed.getMonth() === month! - 1 &&
    parsed.getDate() === day
    ? value
    : null;
}

export function canonicalCompletionSyncInstant(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) return null;
  return new Date(milliseconds).toISOString() === value ? value : null;
}

export function canonicalCompletionSyncTimezone(value: unknown): string | null {
  if (
    typeof value !== 'string' ||
    value.length < 1 ||
    value.length > 255 ||
    value !== value.trim() ||
    CONTROL_CHARACTER.test(value)
  ) {
    return null;
  }
  try {
    // Persisted IANA aliases must remain readable across ICU/OS upgrades even
    // when the runtime resolves them to a newer canonical spelling.
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return value;
  } catch {
    return null;
  }
}

export function currentCompletionSyncTimezone(): string | null {
  try {
    return canonicalCompletionSyncTimezone(
      new Intl.DateTimeFormat('en-US').resolvedOptions().timeZone,
    );
  } catch {
    return null;
  }
}

/** Calendar date produced by one exact instant/zone pair. Persisted aliases are
 * accepted as-is; only the derived date is canonicalized. */
export function completionSyncDateInTimezone(completedAt: string, timezone: string): string | null {
  const instant = canonicalCompletionSyncInstant(completedAt);
  const zone = canonicalCompletionSyncTimezone(timezone);
  if (instant === null || zone === null) return null;
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date(instant));
    const fields = new Map(parts.map(({ type, value }) => [type, value]));
    return canonicalCompletionSyncDate(
      `${fields.get('year') ?? ''}-${fields.get('month') ?? ''}-${fields.get('day') ?? ''}`,
    );
  } catch {
    return null;
  }
}

export function canonicalCompletionSyncStepOrder(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1 && value <= 100
    ? value
    : null;
}

export function completionSyncOperationKey(
  operation: Pick<CompletionSyncOperation, 'eventId'>,
): string {
  return operation.eventId;
}

export function retryableCompletionSyncCode(value: unknown): CompletionSyncRetryableCode | null {
  return value === 'COMPLETION_PRODUCT_RETRY_LATER' ? value : null;
}

export function remoteTerminalCompletionSyncCode(
  value: unknown,
): CompletionSyncRemoteTerminalCode | null {
  return typeof value === 'string' &&
    COMPLETION_SYNC_REMOTE_TERMINAL_CODES.has(value as CompletionSyncRemoteTerminalCode)
    ? (value as CompletionSyncRemoteTerminalCode)
    : null;
}

export function terminalCompletionSyncCode(value: unknown): CompletionSyncTerminalCode | null {
  return value === COMPLETION_DEPENDENCY_TERMINAL ? value : remoteTerminalCompletionSyncCode(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function invalid(): never {
  throw new Error(COMPLETION_SYNC_INVALID);
}

function decodeRoutineIds(value: unknown): CompletionSyncState['routineIds'] {
  if (!isRecord(value) || !hasExactKeys(value, ['AM', 'PM'])) invalid();
  const AM = value.AM === null ? null : canonicalCompletionSyncUuid(value.AM);
  const PM = value.PM === null ? null : canonicalCompletionSyncUuid(value.PM);
  if (
    (value.AM !== null && AM === null) ||
    (value.PM !== null && PM === null) ||
    (AM !== null && PM !== null && AM === PM)
  ) {
    invalid();
  }
  return { AM, PM };
}

function decodeStepIds(
  value: unknown,
  routineIds: CompletionSyncState['routineIds'],
): CompletionSyncState['stepIds'] {
  if (!isRecord(value)) invalid();
  const stepIds: CompletionSyncState['stepIds'] = {};
  const usedIds = new Set<string>();
  for (const [stepKey, candidate] of Object.entries(value)) {
    const identity = completionSyncStepIdentity(stepKey);
    if (!isRecord(candidate) || !hasExactKeys(candidate, ['id', 'stepOrder'])) invalid();
    const stepId = canonicalCompletionSyncUuid(candidate.id);
    const stepOrder = canonicalCompletionSyncStepOrder(candidate.stepOrder);
    if (
      identity === null ||
      stepId === null ||
      stepOrder === null ||
      routineIds[identity.routineType] === null ||
      usedIds.has(stepId)
    ) {
      invalid();
    }
    usedIds.add(stepId);
    stepIds[stepKey] = { id: stepId, stepOrder };
  }
  return stepIds;
}

function decodeOperation(
  value: unknown,
  routineIds: CompletionSyncState['routineIds'],
  stepIds: CompletionSyncState['stepIds'],
  evidence: CompletionSyncEvidence,
): CompletionSyncOperation {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      'eventId',
      'kind',
      'routineId',
      'routineType',
      'stepId',
      'userProductId',
      'stepOrder',
      'completedAt',
      'completedDate',
      'timezone',
    ])
  ) {
    invalid();
  }
  const eventId = canonicalCompletionSyncUuid(value.eventId);
  const kind = value.kind === 'step' || value.kind === 'routine_day' ? value.kind : null;
  const routineType =
    value.routineType === 'AM' || value.routineType === 'PM' ? value.routineType : null;
  const routineId = canonicalCompletionSyncUuid(value.routineId);
  const completedAt = canonicalCompletionSyncInstant(value.completedAt);
  const completedDate = canonicalCompletionSyncDate(value.completedDate);
  const timezone = canonicalCompletionSyncTimezone(value.timezone);
  if (
    eventId === null ||
    kind === null ||
    routineType === null ||
    routineId === null ||
    completedAt === null ||
    completedDate === null ||
    timezone === null ||
    routineIds[routineType] !== routineId
  ) {
    invalid();
  }

  if (kind === 'routine_day') {
    if (
      routineType !== 'PM' ||
      value.stepId !== null ||
      value.userProductId !== null ||
      value.stepOrder !== null ||
      !evidence.hasCompletedDay(completedDate)
    ) {
      invalid();
    }
    return {
      eventId,
      kind,
      routineId,
      routineType,
      stepId: null,
      userProductId: null,
      stepOrder: null,
      completedAt,
      completedDate,
      timezone,
    };
  }

  const stepId = canonicalCompletionSyncUuid(value.stepId);
  const userProductId = canonicalCompletionSyncUuid(value.userProductId);
  const stepOrder = canonicalCompletionSyncStepOrder(value.stepOrder);
  const stepKey = `${routineType}:${userProductId ?? ''}`;
  if (
    stepId === null ||
    userProductId === null ||
    stepOrder === null ||
    stepIds[stepKey]?.id !== stepId ||
    stepIds[stepKey]?.stepOrder !== stepOrder ||
    !evidence.hasCompletedStep(completedDate, stepKey)
  ) {
    invalid();
  }
  return {
    eventId,
    kind,
    routineId,
    routineType,
    stepId,
    userProductId,
    stepOrder,
    completedAt,
    completedDate,
    timezone,
  };
}

function decodeUnsynced(value: unknown, evidence: CompletionSyncEvidence): CompletionSyncUnsynced {
  const legacyKeys = [
    'eventId',
    'stepKey',
    'routineType',
    'stepOrder',
    'completedAt',
    'completedDate',
    'completionDayInserted',
    'reason',
  ] as const;
  const currentKeys = [...legacyKeys, 'disposition', 'timezoneEvidence'] as const;
  if (!isRecord(value) || (!hasExactKeys(value, legacyKeys) && !hasExactKeys(value, currentKeys))) {
    invalid();
  }
  const eventId = canonicalCompletionSyncUuid(value.eventId);
  const stepKey =
    typeof value.stepKey === 'string' &&
    value.stepKey.length <= 512 &&
    value.stepKey === value.stepKey.trim() &&
    !CONTROL_CHARACTER.test(value.stepKey) &&
    /^(AM|PM):.+$/u.test(value.stepKey)
      ? value.stepKey
      : null;
  const routineType =
    value.routineType === 'AM' || value.routineType === 'PM' ? value.routineType : null;
  const stepOrder = canonicalCompletionSyncStepOrder(value.stepOrder);
  const completedAt = canonicalCompletionSyncInstant(value.completedAt);
  const completedDate = canonicalCompletionSyncDate(value.completedDate);
  const reason =
    value.reason === 'COMPLETION_TIMEZONE_UNAVAILABLE' ||
    value.reason === 'COMPLETION_PRODUCT_IDENTITY_REPAIR_REQUIRED'
      ? value.reason
      : null;
  const legacy = !Object.hasOwn(value, 'disposition');
  const disposition = legacy
    ? reason === 'COMPLETION_PRODUCT_IDENTITY_REPAIR_REQUIRED'
      ? 'terminal'
      : 'recoverable'
    : value.disposition === 'recoverable' || value.disposition === 'terminal'
      ? value.disposition
      : null;
  const timezoneEvidence = legacy
    ? null
    : value.timezoneEvidence === null
      ? null
      : canonicalCompletionSyncTimezone(value.timezoneEvidence);
  const identity = completionSyncStepIdentity(stepKey);
  if (
    eventId === null ||
    stepKey === null ||
    routineType === null ||
    stepKey.startsWith(`${routineType}:`) === false ||
    stepOrder === null ||
    completedAt === null ||
    completedDate === null ||
    typeof value.completionDayInserted !== 'boolean' ||
    reason === null ||
    disposition === null ||
    (value.timezoneEvidence !== undefined &&
      value.timezoneEvidence !== null &&
      timezoneEvidence === null) ||
    !evidence.hasCompletedStep(completedDate, stepKey) ||
    (value.completionDayInserted && routineType !== 'PM') ||
    (value.completionDayInserted && !evidence.hasCompletedDay(completedDate)) ||
    (reason === 'COMPLETION_TIMEZONE_UNAVAILABLE' && identity === null) ||
    (reason === 'COMPLETION_PRODUCT_IDENTITY_REPAIR_REQUIRED' && identity !== null) ||
    (reason === 'COMPLETION_TIMEZONE_UNAVAILABLE' &&
      (disposition !== 'recoverable' || timezoneEvidence !== null)) ||
    (reason === 'COMPLETION_PRODUCT_IDENTITY_REPAIR_REQUIRED' && disposition !== 'terminal')
  ) {
    invalid();
  }
  return {
    eventId,
    stepKey,
    routineType,
    stepOrder,
    completedAt,
    completedDate,
    completionDayInserted: value.completionDayInserted,
    reason,
    disposition,
    timezoneEvidence,
  };
}

export function decodeCompletionSyncState(
  value: unknown,
  evidence: CompletionSyncEvidence,
): CompletionSyncState {
  if (
    !isRecord(value) ||
    (!hasExactKeys(value, ['routineIds', 'stepIds', 'journal', 'outbox', 'terminal']) &&
      !hasExactKeys(value, [
        'routineIds',
        'stepIds',
        'journal',
        'outbox',
        'terminal',
        'unsynced',
      ])) ||
    !Array.isArray(value.journal) ||
    !Array.isArray(value.outbox) ||
    !Array.isArray(value.terminal) ||
    (value.unsynced !== undefined && !Array.isArray(value.unsynced))
  ) {
    invalid();
  }
  const routineIds = decodeRoutineIds(value.routineIds);
  const stepIds = decodeStepIds(value.stepIds, routineIds);
  const journal = value.journal.map((operation) =>
    decodeOperation(operation, routineIds, stepIds, evidence),
  );
  const eventIndex = new Map<string, number>();
  const semanticFacts = new Set<string>();
  const referencedRoutineIds = new Set<string>();
  const referencedStepIds = new Set<string>();
  for (const [index, operation] of journal.entries()) {
    if (eventIndex.has(operation.eventId)) invalid();
    const semantic = `${operation.kind}|${operation.stepId ?? ''}|${operation.completedDate}`;
    if (semanticFacts.has(semantic)) invalid();
    if (operation.kind === 'routine_day') {
      const step = journal[index - 1];
      if (
        step?.kind !== 'step' ||
        step.routineType !== 'PM' ||
        step.routineId !== operation.routineId ||
        step.completedDate !== operation.completedDate ||
        step.completedAt !== operation.completedAt ||
        step.timezone !== operation.timezone
      ) {
        invalid();
      }
    }
    eventIndex.set(operation.eventId, index);
    semanticFacts.add(semantic);
    referencedRoutineIds.add(operation.routineId);
    if (operation.stepId !== null) referencedStepIds.add(operation.stepId);
  }
  for (const routineId of Object.values(routineIds)) {
    if (routineId !== null && !referencedRoutineIds.has(routineId)) invalid();
  }
  for (const { id } of Object.values(stepIds)) {
    if (!referencedStepIds.has(id)) invalid();
  }

  const outbox: string[] = [];
  const pendingEventIds = new Set<string>();
  for (const candidate of value.outbox) {
    const eventId = canonicalCompletionSyncUuid(candidate);
    const index = eventId === null ? undefined : eventIndex.get(eventId);
    if (eventId === null || index === undefined || pendingEventIds.has(eventId)) invalid();
    pendingEventIds.add(eventId);
    outbox.push(eventId);
  }
  const pendingPosition = new Map(outbox.map((eventId, index) => [eventId, index]));
  for (const [index, operation] of journal.entries()) {
    if (operation.kind !== 'step') continue;
    const dependent = journal[index + 1];
    if (dependent?.kind !== 'routine_day') continue;
    const operationPosition = pendingPosition.get(operation.eventId);
    const dependentPosition = pendingPosition.get(dependent.eventId);
    if (
      operationPosition !== undefined &&
      dependentPosition !== undefined &&
      dependentPosition !== operationPosition + 1
    ) {
      invalid();
    }
  }

  const terminal: CompletionSyncTerminal[] = [];
  const terminalIds = new Set<string>();
  const terminalByEventId = new Map<string, CompletionSyncTerminal>();
  const pendingIds = new Set(outbox);
  for (const candidate of value.terminal) {
    if (!isRecord(candidate)) {
      invalid();
    }
    const eventId = canonicalCompletionSyncUuid(candidate.eventId);
    const code = terminalCompletionSyncCode(candidate.code);
    const dependencyEventIds =
      code === COMPLETION_DEPENDENCY_TERMINAL && Array.isArray(candidate.dependencyEventIds)
        ? candidate.dependencyEventIds.map(canonicalCompletionSyncUuid)
        : [];
    if (
      eventId === null ||
      code === null ||
      (code === COMPLETION_DEPENDENCY_TERMINAL
        ? !hasExactKeys(candidate, ['eventId', 'code', 'dependencyEventIds']) ||
          dependencyEventIds.length === 0 ||
          dependencyEventIds.some((dependency) => dependency === null) ||
          new Set(dependencyEventIds).size !== dependencyEventIds.length
        : !hasExactKeys(candidate, ['eventId', 'code'])) ||
      !eventIndex.has(eventId) ||
      pendingIds.has(eventId) ||
      terminalIds.has(eventId)
    ) {
      invalid();
    }
    const decodedTerminal: CompletionSyncTerminal =
      code === COMPLETION_DEPENDENCY_TERMINAL
        ? {
            eventId,
            code,
            dependencyEventIds: dependencyEventIds as string[],
          }
        : { eventId, code };
    terminalIds.add(eventId);
    terminalByEventId.set(eventId, decodedTerminal);
    terminal.push(decodedTerminal);
  }

  for (const { eventId, code, dependencyEventIds } of terminal) {
    const index = eventIndex.get(eventId)!;
    const operation = journal[index]!;
    if (code === COMPLETION_DEPENDENCY_TERMINAL) {
      if (operation.kind !== 'routine_day' || dependencyEventIds === undefined) invalid();
      let priorDependencyIndex = -1;
      for (const dependencyEventId of dependencyEventIds) {
        const dependencyIndex = eventIndex.get(dependencyEventId);
        const dependency = dependencyIndex === undefined ? undefined : journal[dependencyIndex];
        const dependencyTerminal = terminalByEventId.get(dependencyEventId);
        if (
          dependencyIndex === undefined ||
          dependencyIndex <= priorDependencyIndex ||
          dependencyIndex >= index ||
          dependency?.kind !== 'step' ||
          dependency.routineId !== operation.routineId ||
          dependency.completedDate !== operation.completedDate ||
          dependencyTerminal === undefined ||
          dependencyTerminal.code === COMPLETION_DEPENDENCY_TERMINAL
        ) {
          invalid();
        }
        priorDependencyIndex = dependencyIndex;
      }
      continue;
    }
    if (operation.kind === 'step') {
      const marker = journal.find(
        (candidate, candidateIndex) =>
          candidateIndex > index &&
          candidate.kind === 'routine_day' &&
          candidate.routineId === operation.routineId &&
          candidate.completedDate === operation.completedDate,
      );
      const markerTerminal =
        marker === undefined ? undefined : terminalByEventId.get(marker.eventId);
      if (
        marker !== undefined &&
        (markerTerminal?.code !== COMPLETION_DEPENDENCY_TERMINAL ||
          markerTerminal.dependencyEventIds?.includes(operation.eventId) !== true)
      ) {
        invalid();
      }
    }
  }

  const unsynced = (value.unsynced ?? []).map((candidate) => decodeUnsynced(candidate, evidence));
  const allEventIds = new Set(eventIndex.keys());
  const localStepFacts = new Set(
    journal
      .filter((operation) => operation.kind === 'step')
      .map((operation) =>
        `${operation.routineType}:${operation.userProductId}|${operation.completedDate}`,
      ),
  );
  const completionDayClaims = new Set(
    journal
      .filter((operation) => operation.kind === 'routine_day')
      .map((operation) => operation.completedDate),
  );
  for (const unavailable of unsynced) {
    const semantic = `${unavailable.stepKey}|${unavailable.completedDate}`;
    // Recovery moves a fact between lanes; it never creates a second copy.
    if (allEventIds.has(unavailable.eventId) || localStepFacts.has(semantic)) invalid();
    if (unavailable.completionDayInserted) {
      if (completionDayClaims.has(unavailable.completedDate)) invalid();
      completionDayClaims.add(unavailable.completedDate);
    }
    allEventIds.add(unavailable.eventId);
    localStepFacts.add(semantic);
  }
  const identityIds = [
    ...Object.values(routineIds).filter((id): id is string => id !== null),
    ...Object.values(stepIds).map(({ id }) => id),
    ...allEventIds,
  ];
  // The writer allocates these from one disjoint identity set. Reusing an ID
  // across roles is corrupt local provenance, not a migration opportunity.
  if (new Set(identityIds).size !== identityIds.length) invalid();

  return { routineIds, stepIds, journal, outbox, terminal, unsynced };
}
