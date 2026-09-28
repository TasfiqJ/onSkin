import { describe, expect, it } from 'vitest';

import { createRoutineWidgetProps } from './contract';
import {
  ROUTINE_WIDGET_NATIVE_AUTHORITY_MISMATCH,
  ROUTINE_WIDGET_NATIVE_LEDGER_SCHEMA_VERSION,
  ROUTINE_WIDGET_NATIVE_OWNER_MISMATCH,
  ROUTINE_WIDGET_NATIVE_REVISION_MISMATCH,
  appendRoutineWidgetNativeAction,
  commitRoutineWidgetNativeReconciliation,
  configureRoutineWidgetNativeOwner,
  createRoutineWidgetNativeLedger,
  overlayRoutineWidgetNativeSnapshot,
  publishRoutineWidgetNativeSnapshot,
  redactRoutineWidgetNativeLedger,
} from './nativeOutboxModel';

const AUTHORITY_0 = '00000000-0000-4000-8000-0000000000e0';
const AUTHORITY_A = '00000000-0000-4000-8000-0000000000e1';
const AUTHORITY_B = '00000000-0000-4000-8000-0000000000e2';
const AUTHORITY_CLOSED = '00000000-0000-4000-8000-0000000000e3';
const AUTHORITY_FRESH = '00000000-0000-4000-8000-0000000000e4';
const OWNER_A = '00000000-0000-4000-8000-0000000000a1';
const OWNER_B = '00000000-0000-4000-8000-0000000000b1';
const OWNER_A_FRESH = '00000000-0000-4000-8000-0000000000a2';
const SNAPSHOT_A = '00000000-0000-4000-8000-0000000000c1';
const SNAPSHOT_B = '00000000-0000-4000-8000-0000000000d1';
const TOKEN_ONE = '00000000-0000-4000-8000-000000000001';
const TOKEN_TWO = '00000000-0000-4000-8000-000000000002';

function props(ownerGeneration = OWNER_A, snapshotNonce = SNAPSHOT_A) {
  return createRoutineWidgetProps({
    ownerGeneration,
    snapshotNonce,
    phase: 'PM',
    localDate: '2026-07-16',
    completedCount: 0,
    totalCount: 2,
    actionTokens: [TOKEN_ONE, TOKEN_TWO],
    deepLink: 'layerwell-development://today',
    updatedAtMs: 1_000,
    staleAtMs: 10_000,
  });
}

function activated(
  ledger = createRoutineWidgetNativeLedger(AUTHORITY_0),
  ownerGeneration = OWNER_A,
  nextAuthorityNonce = AUTHORITY_A,
) {
  return configureRoutineWidgetNativeOwner(ledger, {
    expectedAuthorityNonce: ledger.authorityNonce,
    nextAuthorityNonce,
    ownerGeneration,
  });
}

function published() {
  const owned = activated();
  return publishRoutineWidgetNativeSnapshot(owned, {
    expectedAuthorityNonce: AUTHORITY_A,
    props: props(),
  });
}

function appendInput(expectedRevision = 0, actionToken = TOKEN_ONE, pressedAtMs = 2_000) {
  return {
    expectedAuthorityNonce: AUTHORITY_A,
    actionToken,
    ownerGeneration: OWNER_A,
    snapshotNonce: SNAPSHOT_A,
    expectedRevision,
    pressedAtMs,
  } as const;
}

describe('native widget outbox transaction model', () => {
  it('commits an append before intent return and overlays it without replacing the base snapshot', () => {
    const base = published();
    const appended = appendRoutineWidgetNativeAction(base, appendInput());

    expect(base.snapshot).toMatchObject({ completedCount: 0 });
    expect(appended.outbox).toHaveLength(1);
    expect(overlayRoutineWidgetNativeSnapshot(appended)).toMatchObject({
      completedCount: 1,
      actionTokens: [TOKEN_TWO],
      pendingActionTokens: [TOKEN_ONE],
      interactionRevision: 1,
    });
  });

  it('serializes distinct intent appends in revision order without losing either action', () => {
    const first = appendRoutineWidgetNativeAction(published(), appendInput());
    const second = appendRoutineWidgetNativeAction(first, appendInput(1, TOKEN_TWO, 3_000));

    expect(
      (second.outbox as { actionToken: string }[]).map(({ actionToken }) => actionToken),
    ).toEqual([TOKEN_ONE, TOKEN_TWO]);
    expect(overlayRoutineWidgetNativeSnapshot(second)).toMatchObject({
      status: 'complete',
      completedCount: 2,
      pendingActionTokens: [TOKEN_ONE, TOKEN_TWO],
      interactionRevision: 2,
    });
  });

  it('rejects a stale CAS writer after an intervening append, preventing ABA replacement', () => {
    const first = appendRoutineWidgetNativeAction(published(), appendInput());
    expect(() => appendRoutineWidgetNativeAction(first, appendInput(0, TOKEN_ONE, 2_500))).toThrow(
      ROUTINE_WIDGET_NATIVE_REVISION_MISMATCH,
    );
  });

  it('makes an exact repeated append idempotent while rejecting a conflicting duplicate', () => {
    const input = appendInput();
    const first = appendRoutineWidgetNativeAction(published(), input);
    expect(appendRoutineWidgetNativeAction(first, input)).toStrictEqual(first);
    expect(first.outbox).toHaveLength(1);
    expect(() => appendRoutineWidgetNativeAction(first, appendInput(0, TOKEN_ONE, 2_001))).toThrow(
      ROUTINE_WIDGET_NATIVE_REVISION_MISMATCH,
    );
  });

  it('blocks fresh app publication while any intent record is pending', () => {
    const appended = appendRoutineWidgetNativeAction(published(), appendInput());
    expect(() =>
      publishRoutineWidgetNativeSnapshot(appended, {
        expectedAuthorityNonce: AUTHORITY_A,
        props: props(OWNER_A, SNAPSHOT_B),
      }),
    ).toThrow(ROUTINE_WIDGET_NATIVE_OWNER_MISMATCH);
  });

  it('commits an exactly acknowledged prefix and clears only after canonical completion', () => {
    const appended = appendRoutineWidgetNativeAction(published(), appendInput());
    const committed = commitRoutineWidgetNativeReconciliation(appended, {
      expectedAuthorityNonce: AUTHORITY_A,
      ownerGeneration: OWNER_A,
      snapshotNonce: SNAPSHOT_A,
      expectedRevision: 1,
      acceptedTokens: [TOKEN_ONE],
    });

    expect(committed.outbox).toEqual([]);
    expect(committed.snapshot).toMatchObject({
      completedCount: 1,
      pendingActionTokens: [],
      interactionRevision: 1,
    });
  });

  it('redacts optimistic display when any pending action is unknown or rejected', () => {
    const appended = appendRoutineWidgetNativeAction(published(), appendInput());
    const redacted = commitRoutineWidgetNativeReconciliation(appended, {
      expectedAuthorityNonce: AUTHORITY_A,
      ownerGeneration: OWNER_A,
      snapshotNonce: SNAPSHOT_A,
      expectedRevision: 1,
      acceptedTokens: [],
    });
    expect(redacted.ownerGeneration).toBe(OWNER_A);
    expect(redacted.snapshot).toBeNull();
    expect(redacted.outbox).toEqual([]);
  });

  it('rotates owner authority and destroys old snapshot/outbox state atomically', () => {
    const appended = appendRoutineWidgetNativeAction(published(), appendInput());
    const switched = configureRoutineWidgetNativeOwner(appended, {
      expectedAuthorityNonce: AUTHORITY_A,
      nextAuthorityNonce: AUTHORITY_B,
      ownerGeneration: OWNER_B,
    });

    expect(switched.ownerGeneration).toBe(OWNER_B);
    expect(switched.authorityNonce).toBe(AUTHORITY_B);
    expect(switched.snapshot).toBeNull();
    expect(switched.outbox).toEqual([]);
    expect(() =>
      appendRoutineWidgetNativeAction(switched, appendInput(1, TOKEN_TWO, 3_000)),
    ).toThrow(ROUTINE_WIDGET_NATIVE_AUTHORITY_MISMATCH);
  });

  it('unconditionally creates a durable tombstone without parsing malformed payload bytes', () => {
    const malformed = {
      schemaVersion: ROUTINE_WIDGET_NATIVE_LEDGER_SCHEMA_VERSION,
      authorityNonce: AUTHORITY_A,
      ownerGeneration: OWNER_A,
      snapshot: '{'.repeat(1_000_000),
      outbox: { not: 'an array' },
    };
    const redacted = redactRoutineWidgetNativeLedger(malformed, AUTHORITY_CLOSED);
    expect(redacted).toEqual({
      schemaVersion: ROUTINE_WIDGET_NATIVE_LEDGER_SCHEMA_VERSION,
      authorityNonce: AUTHORITY_CLOSED,
      ownerGeneration: null,
      snapshot: null,
      outbox: [],
    });
  });

  it('prevents a stale activation captured before cleanup from reopening the old owner', () => {
    const beforeCleanup = published();
    const cleaned = redactRoutineWidgetNativeLedger(beforeCleanup, AUTHORITY_CLOSED);

    expect(() =>
      configureRoutineWidgetNativeOwner(cleaned, {
        expectedAuthorityNonce: AUTHORITY_A,
        nextAuthorityNonce: AUTHORITY_B,
        ownerGeneration: OWNER_A,
      }),
    ).toThrow(ROUTINE_WIDGET_NATIVE_AUTHORITY_MISMATCH);
    expect(cleaned.ownerGeneration).toBeNull();
    expect(cleaned.authorityNonce).toBe(AUTHORITY_CLOSED);
  });

  it('allows only a fresh owner generation after cleanup and a synchronous authority recapture', () => {
    const cleaned = redactRoutineWidgetNativeLedger(published(), AUTHORITY_CLOSED);
    const fresh = configureRoutineWidgetNativeOwner(cleaned, {
      expectedAuthorityNonce: AUTHORITY_CLOSED,
      nextAuthorityNonce: AUTHORITY_FRESH,
      ownerGeneration: OWNER_A_FRESH,
    });
    const next = publishRoutineWidgetNativeSnapshot(fresh, {
      expectedAuthorityNonce: AUTHORITY_FRESH,
      props: props(OWNER_A_FRESH, SNAPSHOT_B),
    });
    expect(next.ownerGeneration).toBe(OWNER_A_FRESH);
  });

  it('keeps repeated cleanup closed and invalidates every older authority nonce', () => {
    const first = redactRoutineWidgetNativeLedger(published(), AUTHORITY_CLOSED);
    const second = redactRoutineWidgetNativeLedger(first, AUTHORITY_FRESH);
    expect(second.ownerGeneration).toBeNull();
    expect(second.authorityNonce).toBe(AUTHORITY_FRESH);
    expect(() =>
      configureRoutineWidgetNativeOwner(second, {
        expectedAuthorityNonce: AUTHORITY_CLOSED,
        nextAuthorityNonce: AUTHORITY_B,
        ownerGeneration: OWNER_A,
      }),
    ).toThrow(ROUTINE_WIDGET_NATIVE_AUTHORITY_MISMATCH);
  });

  it('rejects old-owner A after A to B to A unless a fresh generation is configured', () => {
    const firstA = published();
    const b = configureRoutineWidgetNativeOwner(firstA, {
      expectedAuthorityNonce: AUTHORITY_A,
      nextAuthorityNonce: AUTHORITY_B,
      ownerGeneration: OWNER_B,
    });
    const nextA = configureRoutineWidgetNativeOwner(b, {
      expectedAuthorityNonce: AUTHORITY_B,
      nextAuthorityNonce: AUTHORITY_FRESH,
      ownerGeneration: OWNER_A_FRESH,
    });
    expect(nextA.ownerGeneration).not.toBe(OWNER_A);
    expect(() =>
      publishRoutineWidgetNativeSnapshot(nextA, {
        expectedAuthorityNonce: AUTHORITY_FRESH,
        props: props(),
      }),
    ).toThrow(ROUTINE_WIDGET_NATIVE_OWNER_MISMATCH);
  });
});
