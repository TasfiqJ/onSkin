import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ROUTINE_WIDGET_NATIVE_UNAVAILABLE } from './nativeLifecycleContract';
import {
  clearRoutineWidgetNativeState,
  closeRoutineWidgetNativeAdmission,
  commitRoutineWidgetNativeQuiescedReconciliation,
  commitRoutineWidgetNativeReconciliation,
  quiesceRoutineWidgetNativeAdmission,
  readRoutineWidgetNativeAuthority,
  routineWidgetNativeStateConfigured,
} from './nativeLifecycle.ios';

const AUTHORITY_NONCE = '10000000-0000-4000-8000-000000000001';
const OWNER_GENERATION = '20000000-0000-4000-8000-000000000002';
const QUIESCENCE_NONCE = '30000000-0000-4000-8000-000000000003';
const SNAPSHOT_NONCE = '40000000-0000-4000-8000-000000000004';
const ACTION_TOKEN = '50000000-0000-4000-8000-000000000005';

const mocks = vi.hoisted(() => ({
  values: {} as Record<string, unknown>,
}));

vi.mock('expo', () => ({
  requireOptionalNativeModule: () =>
    new Proxy(
      {},
      {
        get: (_target, property) => mocks.values[String(property)],
      },
    ),
}));

function closedAuthority() {
  return {
    schemaVersion: 1,
    authorityNonce: AUTHORITY_NONCE,
    enabled: false,
    ownerGeneration: null,
  } as const;
}

beforeEach(() => {
  for (const key of Object.keys(mocks.values)) delete mocks.values[key];
});

describe('iOS native widget lifecycle bridge', () => {
  it('treats absent upstream constants as definitively unconfigured', async () => {
    const clear = vi.fn();
    mocks.values.layerwellClearNativeState = clear;

    expect(routineWidgetNativeStateConfigured()).toBe(false);
    expect(closeRoutineWidgetNativeAdmission()).toEqual({ status: 'not_configured' });
    expect(
      quiesceRoutineWidgetNativeAdmission({
        expectedAuthorityNonce: AUTHORITY_NONCE,
        ownerGeneration: OWNER_GENERATION,
      }),
    ).toEqual({ status: 'not_configured', outbox: null });
    await expect(clearRoutineWidgetNativeState()).resolves.toEqual({
      status: 'not_configured',
      authority: null,
      endedActivities: 0,
    });
    expect(clear).not.toHaveBeenCalled();
  });

  it('accepts exact version one configured false as a cleanup no-op', async () => {
    mocks.values.layerwellWidgetLifecycleVersion = 1;
    mocks.values.layerwellWidgetLifecycleConfigured = false;

    expect(closeRoutineWidgetNativeAdmission()).toEqual({ status: 'not_configured' });
    await expect(clearRoutineWidgetNativeState()).resolves.toMatchObject({
      status: 'not_configured',
    });
  });

  it.each([
    [2, true],
    [2, false],
    ['1', false],
    [1, 'true'],
    [undefined, true],
    [1, undefined],
  ])('fails cleanup closed for malformed or future constants %#', async (version, configured) => {
    mocks.values.layerwellWidgetLifecycleVersion = version;
    mocks.values.layerwellWidgetLifecycleConfigured = configured;
    mocks.values.layerwellCloseAdmissionJSON = vi.fn();
    mocks.values.layerwellClearNativeState = vi.fn();

    expect(() => closeRoutineWidgetNativeAdmission()).toThrow(ROUTINE_WIDGET_NATIVE_UNAVAILABLE);
    await expect(clearRoutineWidgetNativeState()).rejects.toThrow(
      ROUTINE_WIDGET_NATIVE_UNAVAILABLE,
    );
    expect(mocks.values.layerwellClearNativeState).not.toHaveBeenCalled();
  });

  it('decodes an exact cleanup tombstone and exposes configured reads', async () => {
    mocks.values.layerwellWidgetLifecycleVersion = 1;
    mocks.values.layerwellWidgetLifecycleConfigured = true;
    mocks.values.layerwellReadAuthorityJSON = vi.fn(() => JSON.stringify(closedAuthority()));
    mocks.values.layerwellCloseAdmissionJSON = vi.fn(() =>
      JSON.stringify({ schemaVersion: 1, status: 'closed' }),
    );
    mocks.values.layerwellClearNativeState = vi.fn(async () =>
      JSON.stringify({
        authority: closedAuthority(),
        endedActivities: 2,
        schemaVersion: 1,
      }),
    );

    expect(routineWidgetNativeStateConfigured()).toBe(true);
    expect(readRoutineWidgetNativeAuthority()).toEqual(closedAuthority());
    expect(closeRoutineWidgetNativeAdmission()).toEqual({ status: 'closed' });
    await expect(clearRoutineWidgetNativeState()).resolves.toEqual({
      status: 'cleared',
      authority: closedAuthority(),
      endedActivities: 2,
    });
    expect(mocks.values.layerwellCloseAdmissionJSON).toHaveBeenCalledTimes(2);
    expect(
      (mocks.values.layerwellCloseAdmissionJSON as ReturnType<typeof vi.fn>).mock
        .invocationCallOrder[1],
    ).toBeLessThan(
      (mocks.values.layerwellClearNativeState as ReturnType<typeof vi.fn>).mock
        .invocationCallOrder[0]!,
    );
  });

  it('rejects a malformed close receipt before starting the asynchronous purge', async () => {
    mocks.values.layerwellWidgetLifecycleVersion = 1;
    mocks.values.layerwellWidgetLifecycleConfigured = true;
    mocks.values.layerwellCloseAdmissionJSON = vi.fn(() =>
      JSON.stringify({ schemaVersion: 1, status: 'open' }),
    );
    mocks.values.layerwellClearNativeState = vi.fn();

    expect(() => closeRoutineWidgetNativeAdmission()).toThrow(
      'ROUTINE_WIDGET_NATIVE_RESPONSE_INVALID',
    );
    await expect(clearRoutineWidgetNativeState()).rejects.toThrow(
      'ROUTINE_WIDGET_NATIVE_RESPONSE_INVALID',
    );
    expect(mocks.values.layerwellClearNativeState).not.toHaveBeenCalled();
  });

  it('binds an exact quiescence receipt and final outbox to the requested owner authority', () => {
    mocks.values.layerwellWidgetLifecycleVersion = 1;
    mocks.values.layerwellWidgetLifecycleConfigured = true;
    const outbox = {
      schemaVersion: 1,
      authorityNonce: AUTHORITY_NONCE,
      records: [],
    };
    mocks.values.layerwellQuiesceAdmissionJSON = vi.fn(() =>
      JSON.stringify({
        outbox,
        ownerGeneration: OWNER_GENERATION,
        quiescenceNonce: QUIESCENCE_NONCE,
        schemaVersion: 1,
        status: 'quiesced',
      }),
    );

    expect(
      quiesceRoutineWidgetNativeAdmission({
        expectedAuthorityNonce: AUTHORITY_NONCE,
        ownerGeneration: OWNER_GENERATION,
      }),
    ).toEqual({
      status: 'quiesced',
      outbox,
      ownerGeneration: OWNER_GENERATION,
      quiescenceNonce: QUIESCENCE_NONCE,
    });
    expect(mocks.values.layerwellQuiesceAdmissionJSON).toHaveBeenCalledWith(
      AUTHORITY_NONCE,
      OWNER_GENERATION,
    );

    mocks.values.layerwellQuiesceAdmissionJSON = vi.fn(() =>
      JSON.stringify({
        outbox: { ...outbox, authorityNonce: OWNER_GENERATION },
        ownerGeneration: OWNER_GENERATION,
        quiescenceNonce: QUIESCENCE_NONCE,
        schemaVersion: 1,
        status: 'quiesced',
      }),
    );
    expect(() =>
      quiesceRoutineWidgetNativeAdmission({
        expectedAuthorityNonce: AUTHORITY_NONCE,
        ownerGeneration: OWNER_GENERATION,
      }),
    ).toThrow('ROUTINE_WIDGET_NATIVE_RESPONSE_INVALID');
  });

  it('uses a separate receipt-bound native method for the one-shot frozen commit', () => {
    mocks.values.layerwellWidgetLifecycleVersion = 1;
    mocks.values.layerwellWidgetLifecycleConfigured = true;
    mocks.values.layerwellCommitReconciliationJSON = vi.fn(() => '{"status":"committed"}');
    mocks.values.layerwellCommitQuiescedReconciliationJSON = vi.fn(
      () => '{"status":"committed"}',
    );
    const common = {
      acceptedTokens: [ACTION_TOKEN],
      expectedAuthorityNonce: AUTHORITY_NONCE,
      expectedRevision: 1,
      ownerGeneration: OWNER_GENERATION,
      snapshotNonce: SNAPSHOT_NONCE,
    };

    expect(commitRoutineWidgetNativeReconciliation(common)).toEqual({ status: 'committed' });
    expect(
      commitRoutineWidgetNativeQuiescedReconciliation({
        ...common,
        quiescenceNonce: QUIESCENCE_NONCE,
      }),
    ).toEqual({ status: 'committed' });
    expect(mocks.values.layerwellCommitReconciliationJSON).toHaveBeenCalledWith(
      JSON.stringify(common),
    );
    expect(mocks.values.layerwellCommitQuiescedReconciliationJSON).toHaveBeenCalledWith(
      JSON.stringify({ ...common, quiescenceNonce: QUIESCENCE_NONCE }),
    );
  });
});
