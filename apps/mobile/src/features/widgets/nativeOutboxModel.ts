import {
  applyRoutineWidgetOptimisticCheckOff,
  normalizeRoutineWidgetOpaqueUuid,
  normalizeRoutineWidgetProps,
  type RoutineWidgetProps,
} from './contract';

export const ROUTINE_WIDGET_NATIVE_LEDGER_SCHEMA_VERSION = 1 as const;
export const ROUTINE_WIDGET_NATIVE_OUTBOX_MAX_ACTIONS = 32;
export const ROUTINE_WIDGET_NATIVE_LEDGER_INVALID = 'ROUTINE_WIDGET_NATIVE_LEDGER_INVALID';
export const ROUTINE_WIDGET_NATIVE_AUTHORITY_MISMATCH = 'ROUTINE_WIDGET_NATIVE_AUTHORITY_MISMATCH';
export const ROUTINE_WIDGET_NATIVE_OWNER_MISMATCH = 'ROUTINE_WIDGET_NATIVE_OWNER_MISMATCH';
export const ROUTINE_WIDGET_NATIVE_SNAPSHOT_MISMATCH = 'ROUTINE_WIDGET_NATIVE_SNAPSHOT_MISMATCH';
export const ROUTINE_WIDGET_NATIVE_REVISION_MISMATCH = 'ROUTINE_WIDGET_NATIVE_REVISION_MISMATCH';
export const ROUTINE_WIDGET_NATIVE_OUTBOX_FULL = 'ROUTINE_WIDGET_NATIVE_OUTBOX_FULL';

export type RoutineWidgetNativeOutboxRecord = Readonly<{
  actionToken: string;
  ownerGeneration: string;
  snapshotNonce: string;
  expectedRevision: number;
  committedRevision: number;
  pressedAtMs: number;
  nextProps: RoutineWidgetProps;
}>;

/**
 * The authority fields model the fixed native tombstone row. Snapshot/outbox
 * bytes are deliberately represented as unknown because deletion must never
 * parse or trust them before closing authority.
 */
export type RoutineWidgetNativeLedger = Readonly<{
  schemaVersion: typeof ROUTINE_WIDGET_NATIVE_LEDGER_SCHEMA_VERSION;
  authorityNonce: string;
  ownerGeneration: string | null;
  snapshot: unknown;
  outbox: unknown;
}>;

type CheckedRoutineWidgetNativeLedger = Readonly<{
  schemaVersion: typeof ROUTINE_WIDGET_NATIVE_LEDGER_SCHEMA_VERSION;
  authorityNonce: string;
  ownerGeneration: string | null;
  snapshot: RoutineWidgetProps | null;
  outbox: readonly RoutineWidgetNativeOutboxRecord[];
}>;

function fail(code: string): never {
  throw new Error(code);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cloneProps(value: unknown): RoutineWidgetProps {
  const normalized = normalizeRoutineWidgetProps(value);
  if (!normalized) fail(ROUTINE_WIDGET_NATIVE_LEDGER_INVALID);
  return Object.freeze({
    ...normalized,
    actionTokens: Object.freeze([...normalized.actionTokens]) as unknown as string[],
    pendingActionTokens: Object.freeze([...normalized.pendingActionTokens]) as unknown as string[],
  });
}

function checkedUuid(value: unknown): string {
  const uuid = normalizeRoutineWidgetOpaqueUuid(value);
  if (!uuid) fail(ROUTINE_WIDGET_NATIVE_LEDGER_INVALID);
  return uuid;
}

function checkedAuthority(
  value: unknown,
): Pick<CheckedRoutineWidgetNativeLedger, 'schemaVersion' | 'authorityNonce' | 'ownerGeneration'> {
  if (!isRecord(value) || value.schemaVersion !== ROUTINE_WIDGET_NATIVE_LEDGER_SCHEMA_VERSION) {
    fail(ROUTINE_WIDGET_NATIVE_LEDGER_INVALID);
  }
  const authorityNonce = checkedUuid(value.authorityNonce);
  const ownerGeneration =
    value.ownerGeneration === null ? null : checkedUuid(value.ownerGeneration);
  if (ownerGeneration === authorityNonce) fail(ROUTINE_WIDGET_NATIVE_LEDGER_INVALID);
  return {
    schemaVersion: ROUTINE_WIDGET_NATIVE_LEDGER_SCHEMA_VERSION,
    authorityNonce,
    ownerGeneration,
  };
}

function sameProps(left: RoutineWidgetProps, right: RoutineWidgetProps): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function checkedLedger(value: unknown): CheckedRoutineWidgetNativeLedger {
  const authority = checkedAuthority(value);
  if (!isRecord(value) || !Array.isArray(value.outbox)) {
    fail(ROUTINE_WIDGET_NATIVE_LEDGER_INVALID);
  }
  if (value.outbox.length > ROUTINE_WIDGET_NATIVE_OUTBOX_MAX_ACTIONS) {
    fail(ROUTINE_WIDGET_NATIVE_LEDGER_INVALID);
  }
  const snapshot = value.snapshot === null ? null : cloneProps(value.snapshot);
  if (authority.ownerGeneration === null && (snapshot !== null || value.outbox.length > 0)) {
    fail(ROUTINE_WIDGET_NATIVE_LEDGER_INVALID);
  }
  if (snapshot !== null && snapshot.ownerGeneration !== authority.ownerGeneration) {
    fail(ROUTINE_WIDGET_NATIVE_LEDGER_INVALID);
  }
  const outbox = value.outbox.map((candidate): RoutineWidgetNativeOutboxRecord => {
    if (!isRecord(candidate)) fail(ROUTINE_WIDGET_NATIVE_LEDGER_INVALID);
    return Object.freeze({
      actionToken: checkedUuid(candidate.actionToken),
      ownerGeneration: checkedUuid(candidate.ownerGeneration),
      snapshotNonce: checkedUuid(candidate.snapshotNonce),
      expectedRevision: checkedRevision(candidate.expectedRevision),
      committedRevision: checkedRevision(candidate.committedRevision),
      pressedAtMs: checkedTimestamp(candidate.pressedAtMs),
      nextProps: cloneProps(candidate.nextProps),
    });
  });
  return Object.freeze({ ...authority, snapshot, outbox: Object.freeze(outbox) });
}

function checkedRevision(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > 10_000) {
    fail(ROUTINE_WIDGET_NATIVE_LEDGER_INVALID);
  }
  return value as number;
}

function checkedTimestamp(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    fail(ROUTINE_WIDGET_NATIVE_LEDGER_INVALID);
  }
  return value as number;
}

function assertAuthorityNonce(
  ledger: Pick<CheckedRoutineWidgetNativeLedger, 'authorityNonce'>,
  expectedAuthorityNonceValue: unknown,
): string {
  const expectedAuthorityNonce = checkedUuid(expectedAuthorityNonceValue);
  if (ledger.authorityNonce !== expectedAuthorityNonce) {
    fail(ROUTINE_WIDGET_NATIVE_AUTHORITY_MISMATCH);
  }
  return expectedAuthorityNonce;
}

function frozenLedger(input: {
  authorityNonce: string;
  ownerGeneration: string | null;
  snapshot: RoutineWidgetProps | null;
  outbox: readonly RoutineWidgetNativeOutboxRecord[];
}): RoutineWidgetNativeLedger {
  return Object.freeze({
    schemaVersion: ROUTINE_WIDGET_NATIVE_LEDGER_SCHEMA_VERSION,
    authorityNonce: checkedUuid(input.authorityNonce),
    ownerGeneration: input.ownerGeneration === null ? null : checkedUuid(input.ownerGeneration),
    snapshot: input.snapshot === null ? null : cloneProps(input.snapshot),
    outbox: Object.freeze([...input.outbox]),
  });
}

export function createRoutineWidgetNativeLedger(
  initialAuthorityNonceValue: unknown,
): RoutineWidgetNativeLedger {
  return frozenLedger({
    authorityNonce: checkedUuid(initialAuthorityNonceValue),
    ownerGeneration: null,
    snapshot: null,
    outbox: [],
  });
}

/**
 * Models the native CAS transaction that activates an account/consent owner.
 * Both activation and cleanup rotate authorityNonce, so a request captured
 * before either boundary can never overwrite the newer owner.
 */
export function configureRoutineWidgetNativeOwner(
  ledgerValue: unknown,
  input: Readonly<{
    expectedAuthorityNonce: string;
    nextAuthorityNonce: string;
    ownerGeneration: string;
  }>,
): RoutineWidgetNativeLedger {
  const authority = checkedAuthority(ledgerValue);
  assertAuthorityNonce(authority, input.expectedAuthorityNonce);
  const nextAuthorityNonce = checkedUuid(input.nextAuthorityNonce);
  const ownerGeneration = checkedUuid(input.ownerGeneration);
  if (nextAuthorityNonce === authority.authorityNonce || nextAuthorityNonce === ownerGeneration) {
    fail(ROUTINE_WIDGET_NATIVE_LEDGER_INVALID);
  }
  return frozenLedger({
    authorityNonce: nextAuthorityNonce,
    ownerGeneration,
    snapshot: null,
    outbox: [],
  });
}

/**
 * Deletion-only transaction. It intentionally ignores all old bytes, creates
 * a fresh closed tombstone, and therefore works on malformed/oversized payloads.
 */
export function redactRoutineWidgetNativeLedger(
  _ledgerValue: unknown,
  nextAuthorityNonceValue: unknown,
): RoutineWidgetNativeLedger {
  return frozenLedger({
    authorityNonce: checkedUuid(nextAuthorityNonceValue),
    ownerGeneration: null,
    snapshot: null,
    outbox: [],
  });
}

export function overlayRoutineWidgetNativeSnapshot(
  ledgerValue: unknown,
): RoutineWidgetProps | null {
  const ledger = checkedLedger(ledgerValue);
  let current = ledger.snapshot === null ? null : cloneProps(ledger.snapshot);
  for (const record of ledger.outbox) {
    if (current === null) fail(ROUTINE_WIDGET_NATIVE_LEDGER_INVALID);
    const next = cloneProps(record.nextProps);
    if (
      record.ownerGeneration !== ledger.ownerGeneration ||
      record.ownerGeneration !== current.ownerGeneration ||
      record.snapshotNonce !== current.snapshotNonce ||
      record.expectedRevision !== current.interactionRevision ||
      record.committedRevision !== record.expectedRevision + 1 ||
      next.ownerGeneration !== record.ownerGeneration ||
      next.snapshotNonce !== record.snapshotNonce ||
      next.interactionRevision !== record.committedRevision
    ) {
      fail(ROUTINE_WIDGET_NATIVE_LEDGER_INVALID);
    }
    const expected = applyRoutineWidgetOptimisticCheckOff(current, record.pressedAtMs);
    if (!expected || !sameProps(expected, next)) fail(ROUTINE_WIDGET_NATIVE_LEDGER_INVALID);
    current = next;
  }
  return current;
}

/** AppIntent CAS + durable append, committed before perform() may return. */
export function appendRoutineWidgetNativeAction(
  ledgerValue: unknown,
  input: Readonly<{
    expectedAuthorityNonce: string;
    actionToken: string;
    ownerGeneration: string;
    snapshotNonce: string;
    expectedRevision: number;
    pressedAtMs: number;
  }>,
): RoutineWidgetNativeLedger {
  const ledger = checkedLedger(ledgerValue);
  assertAuthorityNonce(ledger, input.expectedAuthorityNonce);
  const requestedToken = checkedUuid(input.actionToken);
  const ownerGeneration = checkedUuid(input.ownerGeneration);
  const snapshotNonce = checkedUuid(input.snapshotNonce);
  const expectedRevision = checkedRevision(input.expectedRevision);
  const pressedAtMs = checkedTimestamp(input.pressedAtMs);
  if (ledger.ownerGeneration !== ownerGeneration) fail(ROUTINE_WIDGET_NATIVE_OWNER_MISMATCH);
  const existing = ledger.outbox.find((record) => record.actionToken === requestedToken);
  if (existing) {
    if (
      existing.ownerGeneration === ownerGeneration &&
      existing.snapshotNonce === snapshotNonce &&
      existing.expectedRevision === expectedRevision &&
      existing.pressedAtMs === pressedAtMs
    ) {
      return ledger;
    }
    fail(ROUTINE_WIDGET_NATIVE_REVISION_MISMATCH);
  }
  const current = overlayRoutineWidgetNativeSnapshot(ledger);
  if (!current || current.snapshotNonce !== snapshotNonce) {
    fail(ROUTINE_WIDGET_NATIVE_SNAPSHOT_MISMATCH);
  }
  if (current.interactionRevision !== expectedRevision) {
    fail(ROUTINE_WIDGET_NATIVE_REVISION_MISMATCH);
  }
  const next = applyRoutineWidgetOptimisticCheckOff(current, pressedAtMs);
  if (!next || next === current || next.status === 'stale') {
    fail(ROUTINE_WIDGET_NATIVE_SNAPSHOT_MISMATCH);
  }
  const actionToken = current.actionTokens[0];
  if (!actionToken || actionToken !== requestedToken) {
    fail(ROUTINE_WIDGET_NATIVE_SNAPSHOT_MISMATCH);
  }
  if (ledger.outbox.length >= ROUTINE_WIDGET_NATIVE_OUTBOX_MAX_ACTIONS) {
    fail(ROUTINE_WIDGET_NATIVE_OUTBOX_FULL);
  }
  const record: RoutineWidgetNativeOutboxRecord = Object.freeze({
    actionToken,
    ownerGeneration,
    snapshotNonce,
    expectedRevision,
    committedRevision: next.interactionRevision,
    pressedAtMs,
    nextProps: cloneProps(next),
  });
  return frozenLedger({
    authorityNonce: ledger.authorityNonce,
    ownerGeneration,
    snapshot: ledger.snapshot,
    outbox: [...ledger.outbox, record],
  });
}

/** Fresh publication is allowed only for the exact active authority and no pending action. */
export function publishRoutineWidgetNativeSnapshot(
  ledgerValue: unknown,
  input: Readonly<{ expectedAuthorityNonce: string; props: unknown }>,
): RoutineWidgetNativeLedger {
  const ledger = checkedLedger(ledgerValue);
  assertAuthorityNonce(ledger, input.expectedAuthorityNonce);
  const props = cloneProps(input.props);
  if (
    ledger.ownerGeneration === null ||
    props.ownerGeneration !== ledger.ownerGeneration ||
    props.pendingActionTokens.length !== 0 ||
    ledger.outbox.length !== 0
  ) {
    fail(ROUTINE_WIDGET_NATIVE_OWNER_MISMATCH);
  }
  return frozenLedger({
    authorityNonce: ledger.authorityNonce,
    ownerGeneration: ledger.ownerGeneration,
    snapshot: props,
    outbox: [],
  });
}

/**
 * Commits the exact reconciliation prefix. Rejected/unknown actions redact the
 * display instead of preserving an optimistic completion that never committed.
 */
export function commitRoutineWidgetNativeReconciliation(
  ledgerValue: unknown,
  input: Readonly<{
    expectedAuthorityNonce: string;
    ownerGeneration: string;
    snapshotNonce: string;
    expectedRevision: number;
    acceptedTokens: readonly string[];
  }>,
): RoutineWidgetNativeLedger {
  const ledger = checkedLedger(ledgerValue);
  assertAuthorityNonce(ledger, input.expectedAuthorityNonce);
  const ownerGeneration = checkedUuid(input.ownerGeneration);
  const snapshotNonce = checkedUuid(input.snapshotNonce);
  if (ledger.ownerGeneration !== ownerGeneration) fail(ROUTINE_WIDGET_NATIVE_OWNER_MISMATCH);
  const overlay = overlayRoutineWidgetNativeSnapshot(ledger);
  if (!overlay || overlay.snapshotNonce !== snapshotNonce) {
    fail(ROUTINE_WIDGET_NATIVE_SNAPSHOT_MISMATCH);
  }
  if (overlay.interactionRevision !== input.expectedRevision) {
    fail(ROUTINE_WIDGET_NATIVE_REVISION_MISMATCH);
  }
  const accepted = [...input.acceptedTokens];
  if (
    new Set(accepted).size !== accepted.length ||
    accepted.some((token) => normalizeRoutineWidgetOpaqueUuid(token) === null)
  ) {
    fail(ROUTINE_WIDGET_NATIVE_LEDGER_INVALID);
  }
  const outboxTokens = ledger.outbox.map(({ actionToken }) => actionToken);
  if (accepted.some((token) => !outboxTokens.includes(token))) {
    fail(ROUTINE_WIDGET_NATIVE_LEDGER_INVALID);
  }
  if (accepted.length !== outboxTokens.length) {
    return frozenLedger({
      authorityNonce: ledger.authorityNonce,
      ownerGeneration,
      snapshot: null,
      outbox: [],
    });
  }
  const canonical = cloneProps({ ...overlay, pendingActionTokens: [] });
  return frozenLedger({
    authorityNonce: ledger.authorityNonce,
    ownerGeneration,
    snapshot: canonical,
    outbox: [],
  });
}
