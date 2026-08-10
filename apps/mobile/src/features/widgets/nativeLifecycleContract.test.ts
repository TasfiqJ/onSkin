import { describe, expect, it } from 'vitest';

import { createRoutineWidgetProps } from './contract';
import {
  ROUTINE_WIDGET_NATIVE_RESPONSE_INVALID,
  decodeRoutineWidgetNativeAuthorityJSON,
  decodeRoutineWidgetNativeCloseAdmissionJSON,
  decodeRoutineWidgetNativeCleanupJSON,
  decodeRoutineWidgetNativeOutboxJSON,
  decodeRoutineWidgetNativePublicationJSON,
  decodeRoutineWidgetNativeQuiescenceJSON,
  decodeRoutineWidgetNativeReconciliationJSON,
  encodeRoutineWidgetNativeReconciliation,
  encodeRoutineWidgetNativeQuiescedReconciliation,
  encodeRoutineWidgetNativeTimeline,
} from './nativeLifecycleContract';

const AUTHORITY = '00000000-0000-4000-8000-0000000000e1';
const OWNER = '00000000-0000-4000-8000-0000000000a1';
const SNAPSHOT = '00000000-0000-4000-8000-0000000000c1';
const TOKEN_ONE = '00000000-0000-4000-8000-000000000001';
const TOKEN_TWO = '00000000-0000-4000-8000-000000000002';
const QUIESCENCE = '00000000-0000-4000-8000-0000000000d1';

function authority(enabled = true) {
  return {
    authorityNonce: AUTHORITY,
    enabled,
    ownerGeneration: enabled ? OWNER : null,
    schemaVersion: 1,
  };
}

function currentProps() {
  return createRoutineWidgetProps({
    ownerGeneration: OWNER,
    snapshotNonce: SNAPSHOT,
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

function staleProps() {
  return createRoutineWidgetProps({
    ownerGeneration: OWNER,
    snapshotNonce: SNAPSHOT,
    status: 'stale',
    localDate: '2026-07-16',
    deepLink: 'layerwell-development://today',
    updatedAtMs: 1_000,
    staleAtMs: 10_000,
  });
}

describe('native widget lifecycle JSON contract', () => {
  it('decodes exact open and closed authority receipts only', () => {
    expect(decodeRoutineWidgetNativeAuthorityJSON(JSON.stringify(authority()))).toEqual(
      authority(),
    );
    expect(decodeRoutineWidgetNativeAuthorityJSON(JSON.stringify(authority(false)))).toEqual(
      authority(false),
    );
    for (const invalid of [
      { ...authority(), extra: true },
      { ...authority(), enabled: false },
      { ...authority(), authorityNonce: OWNER },
      { ...authority(), schemaVersion: 2 },
      { ...authority(), ownerGeneration: OWNER.toUpperCase() },
    ]) {
      expect(() => decodeRoutineWidgetNativeAuthorityJSON(JSON.stringify(invalid))).toThrow(
        ROUTINE_WIDGET_NATIVE_RESPONSE_INVALID,
      );
    }
  });

  it('decodes a bounded ordered outbox and rejects replay/transplant shapes', () => {
    const records = [
      {
        actionToken: TOKEN_ONE,
        createdAtMs: 2_000,
        localDate: '2026-07-16',
        ownerGeneration: OWNER,
        phase: 'PM',
        revision: 1,
        snapshotNonce: SNAPSHOT,
        staleAtMs: 10_000,
      },
      {
        actionToken: TOKEN_TWO,
        createdAtMs: 3_000,
        localDate: '2026-07-16',
        ownerGeneration: OWNER,
        phase: 'PM',
        revision: 2,
        snapshotNonce: SNAPSHOT,
        staleAtMs: 10_000,
      },
    ];
    const payload = { authorityNonce: AUTHORITY, records, schemaVersion: 1 };
    expect(decodeRoutineWidgetNativeOutboxJSON(JSON.stringify(payload))).toEqual(payload);
    expect(() =>
      decodeRoutineWidgetNativeOutboxJSON(
        JSON.stringify({ ...payload, records: [records[1], records[0]] }),
      ),
    ).toThrow(ROUTINE_WIDGET_NATIVE_RESPONSE_INVALID);
    expect(() =>
      decodeRoutineWidgetNativeOutboxJSON(
        JSON.stringify({ ...payload, records: [{ ...records[0], privateStep: 'PM:secret' }] }),
      ),
    ).toThrow(ROUTINE_WIDGET_NATIVE_RESPONSE_INVALID);
    expect(() =>
      decodeRoutineWidgetNativeOutboxJSON(
        JSON.stringify({ ...payload, records: Array.from({ length: 33 }, () => records[0]) }),
      ),
    ).toThrow(ROUTINE_WIDGET_NATIVE_RESPONSE_INVALID);
  });

  it('requires cleanup to return a closed tombstone and ActivityKit end count', () => {
    const payload = { authority: authority(false), endedActivities: 2, schemaVersion: 1 };
    expect(decodeRoutineWidgetNativeCleanupJSON(JSON.stringify(payload))).toEqual({
      status: 'cleared',
      authority: authority(false),
      endedActivities: 2,
    });
    expect(() =>
      decodeRoutineWidgetNativeCleanupJSON(
        JSON.stringify({ ...payload, authority: authority(true) }),
      ),
    ).toThrow(ROUTINE_WIDGET_NATIVE_RESPONSE_INVALID);
  });

  it('decodes only the exact versioned synchronous close-admission receipt', () => {
    expect(
      decodeRoutineWidgetNativeCloseAdmissionJSON(
        JSON.stringify({ schemaVersion: 1, status: 'closed' }),
      ),
    ).toEqual({ status: 'closed' });
    for (const invalid of [
      { schemaVersion: 1, status: 'open' },
      { schemaVersion: 2, status: 'closed' },
      { schemaVersion: 1, status: 'closed', widgetName: 'alias' },
    ]) {
      expect(() => decodeRoutineWidgetNativeCloseAdmissionJSON(JSON.stringify(invalid))).toThrow(
        ROUTINE_WIDGET_NATIVE_RESPONSE_INVALID,
      );
    }
  });

  it('decodes typed publication concurrency and an exact final quiesced outbox', () => {
    expect(decodeRoutineWidgetNativePublicationJSON('{"status":"published"}')).toEqual({
      status: 'published',
    });
    expect(decodeRoutineWidgetNativePublicationJSON('{"status":"outbox_pending"}')).toEqual({
      status: 'outbox_pending',
    });
    const outbox = {
      authorityNonce: AUTHORITY,
      records: [
        {
          actionToken: TOKEN_ONE,
          createdAtMs: 2_000,
          localDate: '2026-07-16',
          ownerGeneration: OWNER,
          phase: 'PM',
          revision: 1,
          snapshotNonce: SNAPSHOT,
          staleAtMs: 10_000,
        },
      ],
      schemaVersion: 1,
    };
    expect(
      decodeRoutineWidgetNativeQuiescenceJSON(
        JSON.stringify({
          outbox,
          ownerGeneration: OWNER,
          quiescenceNonce: QUIESCENCE,
          schemaVersion: 1,
          status: 'quiesced',
        }),
        AUTHORITY,
        OWNER,
      ),
    ).toEqual({
      status: 'quiesced',
      outbox,
      ownerGeneration: OWNER,
      quiescenceNonce: QUIESCENCE,
    });

    for (const invalid of [{ status: 'stale' }, { status: 'published', schemaVersion: 1 }]) {
      expect(() => decodeRoutineWidgetNativePublicationJSON(JSON.stringify(invalid))).toThrow(
        ROUTINE_WIDGET_NATIVE_RESPONSE_INVALID,
      );
    }
    for (const invalid of [
      {
        outbox,
        ownerGeneration: OWNER,
        quiescenceNonce: QUIESCENCE,
        schemaVersion: 2,
        status: 'quiesced',
      },
      {
        outbox: { ...outbox, authorityNonce: OWNER },
        ownerGeneration: OWNER,
        quiescenceNonce: QUIESCENCE,
        schemaVersion: 1,
        status: 'quiesced',
      },
      {
        outbox,
        ownerGeneration: OWNER,
        quiescenceNonce: QUIESCENCE,
        schemaVersion: 1,
        status: 'closed',
      },
      {
        outbox,
        ownerGeneration: OWNER,
        quiescenceNonce: QUIESCENCE,
        schemaVersion: 1,
        status: 'quiesced',
        extra: true,
      },
    ]) {
      expect(() =>
        decodeRoutineWidgetNativeQuiescenceJSON(JSON.stringify(invalid), AUTHORITY, OWNER),
      ).toThrow(ROUTINE_WIDGET_NATIVE_RESPONSE_INVALID);
    }
  });

  it('encodes exactly current plus future stale timeline entries', () => {
    const entries = [
      { timestamp: 1_000, props: currentProps() },
      { timestamp: 10_000, props: staleProps() },
    ] as const;
    expect(JSON.parse(encodeRoutineWidgetNativeTimeline(entries))).toEqual(entries);
    expect(() => encodeRoutineWidgetNativeTimeline(entries.slice(0, 1))).toThrow(
      ROUTINE_WIDGET_NATIVE_RESPONSE_INVALID,
    );
    expect(() =>
      encodeRoutineWidgetNativeTimeline([entries[0], { ...entries[1], timestamp: 9_999 }]),
    ).toThrow(ROUTINE_WIDGET_NATIVE_RESPONSE_INVALID);
    expect(() =>
      encodeRoutineWidgetNativeTimeline([
        entries[0],
        {
          ...entries[1],
          props: { ...entries[1].props, ownerGeneration: AUTHORITY },
        },
      ]),
    ).toThrow(ROUTINE_WIDGET_NATIVE_RESPONSE_INVALID);
  });

  it('encodes exact all-or-redact reconciliation and decodes only terminal results', () => {
    const json = encodeRoutineWidgetNativeReconciliation({
      acceptedTokens: [TOKEN_ONE, TOKEN_TWO],
      expectedAuthorityNonce: AUTHORITY,
      expectedRevision: 2,
      ownerGeneration: OWNER,
      snapshotNonce: SNAPSHOT,
    });
    expect(JSON.parse(json)).toEqual({
      acceptedTokens: [TOKEN_ONE, TOKEN_TWO],
      expectedAuthorityNonce: AUTHORITY,
      expectedRevision: 2,
      ownerGeneration: OWNER,
      snapshotNonce: SNAPSHOT,
    });
    expect(
      JSON.parse(
        encodeRoutineWidgetNativeQuiescedReconciliation({
          acceptedTokens: [TOKEN_ONE, TOKEN_TWO],
          expectedAuthorityNonce: AUTHORITY,
          expectedRevision: 2,
          ownerGeneration: OWNER,
          quiescenceNonce: QUIESCENCE,
          snapshotNonce: SNAPSHOT,
        }),
      ),
    ).toEqual({
      acceptedTokens: [TOKEN_ONE, TOKEN_TWO],
      expectedAuthorityNonce: AUTHORITY,
      expectedRevision: 2,
      ownerGeneration: OWNER,
      quiescenceNonce: QUIESCENCE,
      snapshotNonce: SNAPSHOT,
    });
    expect(() =>
      encodeRoutineWidgetNativeReconciliation({
        acceptedTokens: [TOKEN_ONE, TOKEN_ONE],
        expectedAuthorityNonce: AUTHORITY,
        expectedRevision: 2,
        ownerGeneration: OWNER,
        snapshotNonce: SNAPSHOT,
      }),
    ).toThrow(ROUTINE_WIDGET_NATIVE_RESPONSE_INVALID);
    expect(decodeRoutineWidgetNativeReconciliationJSON('{"status":"committed"}')).toEqual({
      status: 'committed',
    });
    expect(decodeRoutineWidgetNativeReconciliationJSON('{"status":"redacted"}')).toEqual({
      status: 'redacted',
    });
    expect(() => decodeRoutineWidgetNativeReconciliationJSON('{"status":"partial"}')).toThrow(
      ROUTINE_WIDGET_NATIVE_RESPONSE_INVALID,
    );
  });
});
