import { describe, expect, it } from 'vitest';

import {
  ROUTINE_WIDGET_TODAY_DEEP_LINK,
  ROUTINE_WIDGET_TODAY_DEEP_LINKS,
  applyRoutineWidgetOptimisticCheckOff,
  createRoutineWidgetProps,
  isRoutineWidgetDeepLink,
  normalizeRoutineLiveActivityProps,
  normalizeRoutineWidgetProps,
  pendingRoutineWidgetActionTokens,
  routineWidgetTodayDeepLinkForVariant,
  routineLiveActivityProps,
} from './contract';

const TOKEN_ONE = '00000000-0000-4000-8000-000000000001';
const TOKEN_TWO = '00000000-0000-4000-8000-000000000002';
const TOKEN_THREE = '00000000-0000-4000-8000-000000000003';
const OWNER_GENERATION = '00000000-0000-4000-8000-0000000000a1';
const SNAPSHOT_NONCE = '00000000-0000-4000-8000-0000000000b1';
const TOKEN_ALPHA = 'deadbeef-dead-4ead-8bad-deadbeef0001';

function readyProps() {
  return createRoutineWidgetProps({
    ownerGeneration: OWNER_GENERATION,
    snapshotNonce: SNAPSHOT_NONCE,
    phase: 'PM',
    localDate: '2026-07-16',
    completedCount: 1,
    totalCount: 3,
    actionTokens: [TOKEN_TWO, TOKEN_THREE],
    deepLink: ROUTINE_WIDGET_TODAY_DEEP_LINK,
    updatedAtMs: 1_000,
    staleAtMs: 10_000,
  });
}

describe('routine widget closed App Group schema', () => {
  it('accepts only the exact static Layerwell Today links for the three build variants', () => {
    expect(isRoutineWidgetDeepLink('layerwell-development://today')).toBe(true);
    expect(isRoutineWidgetDeepLink('layerwell-staging://today')).toBe(true);
    expect(isRoutineWidgetDeepLink('layerwell://today')).toBe(true);
    expect(isRoutineWidgetDeepLink('layerwell://today/')).toBe(false);
    expect(isRoutineWidgetDeepLink('layerwell://today?step=1')).toBe(false);
    expect(isRoutineWidgetDeepLink('layerwell-preview://today')).toBe(false);
    expect(isRoutineWidgetDeepLink('LAYERWELL://today')).toBe(false);
  });

  it('selects the matching static link from a fail-closed app-variant helper', () => {
    expect(routineWidgetTodayDeepLinkForVariant('development')).toBe(
      ROUTINE_WIDGET_TODAY_DEEP_LINKS.development,
    );
    expect(routineWidgetTodayDeepLinkForVariant('staging')).toBe(
      ROUTINE_WIDGET_TODAY_DEEP_LINKS.staging,
    );
    expect(routineWidgetTodayDeepLinkForVariant('production')).toBe(
      ROUTINE_WIDGET_TODAY_DEEP_LINKS.production,
    );
    expect(routineWidgetTodayDeepLinkForVariant('preview')).toBeNull();
    expect(routineWidgetTodayDeepLinkForVariant(undefined)).toBeNull();
  });

  it('rejects unknown fields, including identifying or health-detail fields', () => {
    const props = readyProps();
    expect(normalizeRoutineWidgetProps({ ...props, productName: 'private' })).toBeNull();
    expect(normalizeRoutineWidgetProps({ ...props, userId: 'private' })).toBeNull();
    expect(normalizeRoutineWidgetProps({ ...props, healthText: 'private' })).toBeNull();
  });

  it('accepts only unique UUIDv4 capability tokens with no pending overlap', () => {
    const props = readyProps();
    expect(normalizeRoutineWidgetProps(props)).toEqual(props);
    expect(normalizeRoutineWidgetProps({ ...props, actionTokens: ['step-key'] })).toBeNull();
    expect(
      normalizeRoutineWidgetProps({
        ...props,
        actionTokens: [TOKEN_TWO, TOKEN_TWO],
      }),
    ).toBeNull();
    expect(
      normalizeRoutineWidgetProps({
        ...props,
        actionTokens: [TOKEN_ALPHA, TOKEN_ALPHA.toUpperCase()],
      }),
    ).toBeNull();
    expect(
      normalizeRoutineWidgetProps({
        ...props,
        pendingActionTokens: [TOKEN_TWO],
      }),
    ).toBeNull();
  });

  it('accepts only the five-minute lease boundary and rejects one millisecond more', () => {
    expect(normalizeRoutineWidgetProps({ ...readyProps(), staleAtMs: 301_000 })).not.toBeNull();
    expect(normalizeRoutineWidgetProps({ ...readyProps(), staleAtMs: 301_001 })).toBeNull();
  });

  it('rejects calendar-invalid local dates instead of normalizing them', () => {
    expect(normalizeRoutineWidgetProps({ ...readyProps(), localDate: '2026-02-29' })).toBeNull();
    expect(normalizeRoutineWidgetProps({ ...readyProps(), localDate: '2026-13-01' })).toBeNull();
    expect(
      normalizeRoutineWidgetProps({ ...readyProps(), localDate: '2026-07-16' }),
    ).not.toBeNull();
  });

  it('never throws while rejecting hostile status and phase values', () => {
    const props = readyProps();
    const throwingValue = {
      toString() {
        throw new Error('must not be coerced');
      },
    };
    expect(() => normalizeRoutineWidgetProps({ ...props, status: throwingValue })).not.toThrow();
    expect(normalizeRoutineWidgetProps({ ...props, status: throwingValue })).toBeNull();
    expect(() => normalizeRoutineWidgetProps({ ...props, phase: throwingValue })).not.toThrow();
    expect(normalizeRoutineWidgetProps({ ...props, phase: throwingValue })).toBeNull();
  });
});

describe('interactive widget pending-action outbox', () => {
  it('moves the first action token to pending and advances progress optimistically', () => {
    const initial = normalizeRoutineWidgetProps({
      ...readyProps(),
      pendingActionTokens: [TOKEN_ONE],
      interactionRevision: 1,
    });
    expect(initial).not.toBeNull();

    const next = applyRoutineWidgetOptimisticCheckOff(initial, 2_000);

    expect(next).toMatchObject({
      status: 'ready',
      completedCount: 2,
      totalCount: 3,
      actionTokens: [TOKEN_THREE],
      pendingActionTokens: [TOKEN_ONE, TOKEN_TWO],
      interactionRevision: 2,
      updatedAtMs: 2_000,
    });
    expect(next!.actionTokens).toHaveLength(next!.totalCount - next!.completedCount);
    // Pending tokens are the durable outbox for already optimistic taps. They
    // are deliberately not added to the remaining-action invariant.
    expect(next!.pendingActionTokens).toHaveLength(2);
    expect(initial!.actionTokens).toEqual([TOKEN_TWO, TOKEN_THREE]);
  });

  it('marks the final optimistic tap complete while retaining every pending token', () => {
    const first = applyRoutineWidgetOptimisticCheckOff(
      normalizeRoutineWidgetProps({
        ...readyProps(),
        pendingActionTokens: [TOKEN_ONE],
        interactionRevision: 1,
      }),
      2_000,
    );
    const complete = applyRoutineWidgetOptimisticCheckOff(first, 3_000);

    expect(complete).toMatchObject({
      status: 'complete',
      completedCount: 3,
      totalCount: 3,
      actionTokens: [],
      pendingActionTokens: [TOKEN_ONE, TOKEN_TWO, TOKEN_THREE],
      interactionRevision: 3,
    });
  });

  it('preserves the validated build-variant link across an optimistic transition', () => {
    const development = normalizeRoutineWidgetProps({
      ...readyProps(),
      deepLink: ROUTINE_WIDGET_TODAY_DEEP_LINKS.development,
    });
    expect(applyRoutineWidgetOptimisticCheckOff(development, 2_000)?.deepLink).toBe(
      ROUTINE_WIDGET_TODAY_DEEP_LINKS.development,
    );
  });

  it('fails closed after expiry without losing an already-pending outbox token', () => {
    const initial = normalizeRoutineWidgetProps({
      ...readyProps(),
      pendingActionTokens: [TOKEN_ONE],
      interactionRevision: 1,
    });
    const stale = applyRoutineWidgetOptimisticCheckOff(initial, 10_000);

    expect(stale).toMatchObject({
      status: 'stale',
      phase: 'none',
      completedCount: 0,
      totalCount: 0,
      actionTokens: [],
      pendingActionTokens: [TOKEN_ONE],
      interactionRevision: 1,
    });
    expect(stale!.pendingActionTokens).not.toContain(TOKEN_TWO);
  });

  it('fails closed on clock rollback without consuming the next capability', () => {
    const initial = normalizeRoutineWidgetProps({
      ...readyProps(),
      pendingActionTokens: [TOKEN_ONE],
      interactionRevision: 1,
    });
    const stale = applyRoutineWidgetOptimisticCheckOff(initial, 999);

    expect(stale).toMatchObject({
      status: 'stale',
      completedCount: 0,
      totalCount: 0,
      actionTokens: [],
      pendingActionTokens: [TOKEN_ONE],
      interactionRevision: 1,
    });
    expect(stale!.pendingActionTokens).not.toContain(TOKEN_TWO);
  });

  it('unions valid pending actions across timelines and ignores malformed entries', () => {
    const first = normalizeRoutineWidgetProps({
      ...readyProps(),
      pendingActionTokens: [TOKEN_ONE],
    });
    const second = normalizeRoutineWidgetProps({
      ...readyProps(),
      pendingActionTokens: [TOKEN_ONE, TOKEN_THREE],
      actionTokens: [TOKEN_TWO],
      completedCount: 2,
    });
    expect(
      pendingRoutineWidgetActionTokens([
        { props: first },
        { props: { ...second, secret: true } },
        { props: second },
      ]),
    ).toEqual([TOKEN_ONE, TOKEN_THREE]);
  });
});

describe('routine Live Activity closed schema', () => {
  it('rejects unknown and internally inconsistent state', () => {
    const valid = {
      schemaVersion: 2,
      ownerGeneration: OWNER_GENERATION,
      snapshotNonce: SNAPSHOT_NONCE,
      status: 'in_progress',
      completedCount: 1,
      totalCount: 3,
      updatedAtMs: 1_000,
      staleAtMs: 10_000,
    } as const;
    expect(normalizeRoutineLiveActivityProps(valid)).toEqual(valid);
    expect(normalizeRoutineLiveActivityProps({ ...valid, productId: 'private' })).toBeNull();
    expect(normalizeRoutineLiveActivityProps({ ...valid, completedCount: 3 })).toBeNull();
    expect(
      normalizeRoutineLiveActivityProps({ ...valid, status: 'complete', completedCount: 2 }),
    ).toBeNull();
    expect(normalizeRoutineLiveActivityProps({ ...valid, status: 'stale' })).toBeNull();
    expect(
      normalizeRoutineLiveActivityProps({
        ...valid,
        status: 'stale',
        completedCount: 0,
        totalCount: 0,
      }),
    ).not.toBeNull();
  });

  it('accepts only the five-minute Live Activity lease boundary', () => {
    const valid = {
      schemaVersion: 2,
      ownerGeneration: OWNER_GENERATION,
      snapshotNonce: SNAPSHOT_NONCE,
      status: 'in_progress',
      completedCount: 1,
      totalCount: 3,
      updatedAtMs: 1_000,
      staleAtMs: 301_000,
    } as const;
    expect(normalizeRoutineLiveActivityProps(valid)).toEqual(valid);
    expect(normalizeRoutineLiveActivityProps({ ...valid, staleAtMs: 301_001 })).toBeNull();
  });

  it('derives passive PM activity state and refuses AM publication', () => {
    const pm = readyProps();
    expect(routineLiveActivityProps(pm, 2_000)).toMatchObject({
      status: 'in_progress',
      completedCount: 1,
      totalCount: 3,
    });
    expect(routineLiveActivityProps(pm, 10_000)).toEqual({
      schemaVersion: 2,
      ownerGeneration: OWNER_GENERATION,
      snapshotNonce: SNAPSHOT_NONCE,
      status: 'stale',
      completedCount: 0,
      totalCount: 0,
      updatedAtMs: 1_000,
      staleAtMs: 10_000,
    });
    expect(routineLiveActivityProps(pm, 999)).toEqual({
      schemaVersion: 2,
      ownerGeneration: OWNER_GENERATION,
      snapshotNonce: SNAPSHOT_NONCE,
      status: 'stale',
      completedCount: 0,
      totalCount: 0,
      updatedAtMs: 1_000,
      staleAtMs: 10_000,
    });
    expect(routineLiveActivityProps({ ...pm, phase: 'AM' }, 2_000)).toBeNull();
  });
});
