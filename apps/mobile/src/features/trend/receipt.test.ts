import { describe, expect, it, vi } from 'vitest';

import {
  TREND_ABSTENTION_REASONS,
  canonicalTrendReceiptPayloadV1,
  parseTrendEngineInputV1,
  parseTrendResultReceiptV1,
  sealTrendResultReceiptV1,
  verifyTrendResultReceiptV1,
  type TrendResultOutcomeV1,
  type TrendResultReceiptV1,
} from './receipt';

const BEFORE_ID = '11111111-1111-4111-8111-111111111111';
const AFTER_ID = '22222222-2222-4222-8222-222222222222';
const BEFORE_SESSION = '33333333-3333-4333-8333-333333333333';
const AFTER_SESSION = '44444444-4444-4444-8444-444444444444';
const REQUEST_ID = '55555555-5555-4555-8555-555555555555';
const RECEIPT_ID = '66666666-6666-4666-8666-666666666666';
const TAG = 'local_test_tag_01';
const ANALYSIS_EVIDENCE = {
  normalizedInputPairSha256: 'f'.repeat(64),
  decryptionAttestationSha256: '0'.repeat(64),
} as const;

function input() {
  return {
    schemaVersion: 1,
    requestId: REQUEST_ID,
    accountBinding: {
      accountSubject: 'account-subject-a',
      accountGeneration: 7,
      consentGeneration: 11,
    },
    buildProvenance: {
      applicationId: 'app.layerwell.mobile',
      applicationVersion: '1.2.3',
      nativeBuildNumber: '42',
      sourceRevision: 'abcdef1234567890abcdef1234567890abcdef12',
      archiveDigestSha256: 'a'.repeat(64),
    },
    engineProvenance: {
      engineId: 'trend-engine-candidate',
      engineVersion: 'engine-v1',
      preprocessingVersion: 'preprocess-v1',
      registrationVersion: 'registration-v1',
      measurementVersion: 'measurement-v1',
      calibrationVersion: 'calibration-unavailable-v1',
    },
    deviceProvenance: {
      platform: 'ios',
      model: 'iPhone-test-device',
      osVersion: '26.0',
      performanceClass: 'unsupported-source-fixture',
    },
    inputPair: {
      before: {
        photoId: BEFORE_ID,
        captureSessionId: BEFORE_SESSION,
        series: 'front',
        capturedAt: '2026-01-01T12:00:00.000Z',
        encryptedPayloadSha256: 'b'.repeat(64),
        captureMetadataVersion: 'capture-metadata-v1',
        captureMetadataSha256: 'c'.repeat(64),
      },
      after: {
        photoId: AFTER_ID,
        captureSessionId: AFTER_SESSION,
        series: 'front',
        capturedAt: '2026-03-01T12:00:00.000Z',
        encryptedPayloadSha256: 'd'.repeat(64),
        captureMetadataVersion: 'capture-metadata-v1',
        captureMetadataSha256: 'e'.repeat(64),
      },
    },
    requestedAt: '2026-03-01T12:01:00.000Z',
    expiresAt: '2026-03-01T12:11:00.000Z',
  };
}

function seal(outcome: TrendResultOutcomeV1): TrendResultReceiptV1 {
  const receipt = sealTrendResultReceiptV1(input(), outcome, {
    receiptId: RECEIPT_ID,
    nonce: 'nonce_for_local_test_01',
    issuedAt: '2026-03-01T12:02:00.000Z',
    expiresAt: '2026-03-01T12:10:00.000Z',
    issuerId: 'local-trend-issuer-v1',
    keyId: 'secure-key-v1',
    authenticate: () => TAG,
  });
  expect(receipt).not.toBeNull();
  return receipt!;
}

function verifier(receipt: TrendResultReceiptV1, overrides: Record<string, unknown> = {}) {
  return verifyTrendResultReceiptV1(receipt, {
    expectedInput: input(),
    accountSubject: 'account-subject-a',
    accountGeneration: 7,
    consentGeneration: 11,
    now: '2026-03-01T12:05:00.000Z',
    verifyAuthentication: (_payload, _issuer, tag) => tag === TAG,
    consumeReplayKey: () => true,
    ...overrides,
  });
}

describe('Trend v1 input contract', () => {
  it('binds exact build, engine, device, account/generation, and ordered photo/session identities', () => {
    expect(parseTrendEngineInputV1(input())).toEqual(input());
  });

  it.each([
    ['root', (value: any) => (value.extra = true)],
    ['account', (value: any) => (value.accountBinding.extra = true)],
    ['build', (value: any) => (value.buildProvenance.extra = true)],
    ['engine', (value: any) => (value.engineProvenance.extra = true)],
    ['device', (value: any) => (value.deviceProvenance.extra = true)],
    ['pair', (value: any) => (value.inputPair.extra = true)],
    ['photo', (value: any) => (value.inputPair.before.extra = true)],
  ])('rejects unknown %s fields', (_label, mutate) => {
    const value = input();
    mutate(value);
    expect(parseTrendEngineInputV1(value)).toBeNull();
  });

  it('rejects cross-view, reused, reversed, malformed, and generation-invalid inputs', () => {
    const cases = [
      () => ({
        ...input(),
        inputPair: { ...input().inputPair, after: { ...input().inputPair.after, series: 'left' } },
      }),
      () => ({
        ...input(),
        inputPair: {
          ...input().inputPair,
          after: { ...input().inputPair.after, photoId: BEFORE_ID },
        },
      }),
      () => ({
        ...input(),
        inputPair: {
          ...input().inputPair,
          after: { ...input().inputPair.after, capturedAt: '2025-01-01T00:00:00.000Z' },
        },
      }),
      () => ({ ...input(), requestId: 'not-a-uuid' }),
      () => ({
        ...input(),
        buildProvenance: { ...input().buildProvenance, sourceRevision: 'short' },
      }),
      () => ({ ...input(), accountBinding: { ...input().accountBinding, accountGeneration: -1 } }),
    ];
    for (const build of cases) expect(parseTrendEngineInputV1(build())).toBeNull();
  });
});

describe('Trend v1 result receipt', () => {
  it.each(TREND_ABSTENTION_REASONS)('round-trips explicit %s abstention', (reason) => {
    const receipt = seal({ kind: 'abstained', reason, limitations: [`reason:${reason}`] });
    expect(parseTrendResultReceiptV1(receipt)?.outcome).toEqual({
      kind: 'abstained',
      reason,
      limitations: [`reason:${reason}`],
    });
  });

  it('accepts finite externally supplied issued measurements without defining a default', () => {
    const receipt = seal({
      kind: 'issued',
      state: 'consistent',
      measurementUnit: 'normalized_absolute_delta',
      deltaMetric: 0.031,
      mdcThreshold: 0.077,
      analysisEvidence: ANALYSIS_EVIDENCE,
      limitations: ['source-test-only'],
    });
    expect(verifier(receipt).ok).toBe(true);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'rejects nonfinite issued measurement %s',
    (deltaMetric) => {
      expect(
        sealTrendResultReceiptV1(
          input(),
          {
            kind: 'issued',
            state: 'consistent',
            measurementUnit: 'normalized_absolute_delta',
            deltaMetric,
            mdcThreshold: 1,
            analysisEvidence: ANALYSIS_EVIDENCE,
            limitations: [],
          },
          {
            receiptId: RECEIPT_ID,
            nonce: 'nonce_for_local_test_01',
            issuedAt: '2026-03-01T12:02:00.000Z',
            expiresAt: '2026-03-01T12:10:00.000Z',
            issuerId: 'local-trend-issuer-v1',
            keyId: 'secure-key-v1',
            authenticate: () => TAG,
          },
        ),
      ).toBeNull();
    },
  );

  it.each([
    {
      state: 'consistent',
      measurementUnit: 'normalized_absolute_delta',
      deltaMetric: -0.01,
      mdcThreshold: 0.5,
    },
    {
      state: 'consistent',
      measurementUnit: 'normalized_absolute_delta',
      deltaMetric: 1.01,
      mdcThreshold: 0.5,
    },
    {
      state: 'consistent',
      measurementUnit: 'normalized_absolute_delta',
      deltaMetric: 0.5,
      mdcThreshold: 0.5,
    },
    {
      state: 'change_observed',
      measurementUnit: 'normalized_absolute_delta',
      deltaMetric: 0.49,
      mdcThreshold: 0.5,
    },
    {
      state: 'consistent',
      measurementUnit: 'unknown',
      deltaMetric: 0.1,
      mdcThreshold: 0.5,
    },
  ])('rejects ambiguous or state-inconsistent issued measurement %#', (measurement) => {
    expect(
      sealTrendResultReceiptV1(
        input(),
        { kind: 'issued', ...measurement, analysisEvidence: ANALYSIS_EVIDENCE, limitations: [] },
        {
          receiptId: RECEIPT_ID,
          nonce: 'nonce_for_local_test_01',
          issuedAt: '2026-03-01T12:02:00.000Z',
          expiresAt: '2026-03-01T12:10:00.000Z',
          issuerId: 'local-trend-issuer-v1',
          keyId: 'secure-key-v1',
          authenticate: () => TAG,
        },
      ),
    ).toBeNull();
  });

  it.each([[[' leading-space']], [['trailing-space ']], [['duplicate', 'duplicate']]])(
    'rejects untrimmed or duplicate limitations',
    (invalidLimitations) => {
      expect(
        sealTrendResultReceiptV1(
          input(),
          { kind: 'abstained', reason: 'cancelled', limitations: invalidLimitations },
          {
            receiptId: RECEIPT_ID,
            nonce: 'nonce_for_local_test_01',
            issuedAt: '2026-03-01T12:02:00.000Z',
            expiresAt: '2026-03-01T12:10:00.000Z',
            issuerId: 'local-trend-issuer-v1',
            keyId: 'secure-key-v1',
            authenticate: () => TAG,
          },
        ),
      ).toBeNull();
    },
  );

  it('rejects malformed issuer/seal metadata and receipt expiry outside the input lease', () => {
    const base = {
      receiptId: RECEIPT_ID,
      nonce: 'nonce_for_local_test_01',
      issuedAt: '2026-03-01T12:02:00.000Z',
      expiresAt: '2026-03-01T12:10:00.000Z',
      issuerId: 'local-trend-issuer-v1',
      keyId: 'secure-key-v1',
      authenticate: () => TAG,
    };
    const invalidOptions = [
      { ...base, receiptId: 'invalid' },
      { ...base, nonce: 'short' },
      { ...base, issuerId: 'has whitespace' },
      { ...base, keyId: '' },
      { ...base, issuedAt: '2026-03-01T12:00:00.000Z' },
      { ...base, expiresAt: '2026-03-01T12:12:00.000Z' },
      { ...base, authenticate: () => 'short' },
    ];
    for (const options of invalidOptions) {
      expect(
        sealTrendResultReceiptV1(
          input(),
          { kind: 'abstained', reason: 'cancelled', limitations: [] },
          options,
        ),
      ).toBeNull();
    }
  });

  it('rejects unknown receipt, outcome, and issuer fields', () => {
    const receipt = seal({ kind: 'abstained', reason: 'cancelled', limitations: [] });
    for (const mutate of [
      (value: any) => (value.extra = true),
      (value: any) => (value.outcome.extra = true),
      (value: any) => (value.issuer.extra = true),
    ]) {
      const value = structuredClone(receipt);
      mutate(value);
      expect(parseTrendResultReceiptV1(value)).toBeNull();
    }
  });

  it('rejects account/generation mismatch, early use, and expiry before authentication or replay use', () => {
    const receipt = seal({ kind: 'abstained', reason: 'unsupported_device', limitations: [] });
    const authentication = vi.fn(() => true);
    const replay = vi.fn(() => true);
    expect(verifier(receipt, { accountSubject: 'account-b' })).toEqual({
      ok: false,
      reason: 'account_mismatch',
    });
    expect(verifier(receipt, { accountGeneration: 8 })).toEqual({
      ok: false,
      reason: 'generation_mismatch',
    });
    expect(verifier(receipt, { consentGeneration: 12 })).toEqual({
      ok: false,
      reason: 'generation_mismatch',
    });
    expect(verifier(receipt, { now: '2026-03-01T12:01:59.000Z' })).toEqual({
      ok: false,
      reason: 'not_yet_valid',
    });
    expect(
      verifier(receipt, {
        now: '2026-03-01T12:10:00.000Z',
        verifyAuthentication: authentication,
        consumeReplayKey: replay,
      }),
    ).toEqual({ ok: false, reason: 'expired' });
    expect(authentication).not.toHaveBeenCalled();
    expect(replay).not.toHaveBeenCalled();
  });

  it('rejects a valid receipt when the expected request, pair, build, engine, or device differs', () => {
    const receipt = seal({ kind: 'abstained', reason: 'unsupported_device', limitations: [] });
    const mismatches = [
      { ...input(), requestId: '77777777-7777-4777-8777-777777777777' },
      {
        ...input(),
        inputPair: {
          ...input().inputPair,
          after: { ...input().inputPair.after, encryptedPayloadSha256: '1'.repeat(64) },
        },
      },
      {
        ...input(),
        buildProvenance: { ...input().buildProvenance, archiveDigestSha256: '2'.repeat(64) },
      },
      {
        ...input(),
        engineProvenance: { ...input().engineProvenance, calibrationVersion: 'calibration-v2' },
      },
      {
        ...input(),
        deviceProvenance: { ...input().deviceProvenance, model: 'different-iphone' },
      },
    ];
    for (const expectedInput of mismatches) {
      expect(verifier(receipt, { expectedInput })).toEqual({
        ok: false,
        reason: 'binding_mismatch',
      });
    }
  });

  it('detects tampering before consuming replay state', () => {
    const receipt = seal({ kind: 'abstained', reason: 'invalid_measurement', limitations: [] });
    const originalPayload = canonicalTrendReceiptPayloadV1(receipt);
    const tampered = {
      ...structuredClone(receipt),
      outcome: { kind: 'abstained', reason: 'cancelled', limitations: [] },
    };
    const replay = vi.fn(() => true);
    expect(
      verifyTrendResultReceiptV1(tampered, {
        expectedInput: input(),
        accountSubject: 'account-subject-a',
        accountGeneration: 7,
        consentGeneration: 11,
        now: '2026-03-01T12:05:00.000Z',
        verifyAuthentication: (payload) => payload === originalPayload,
        consumeReplayKey: replay,
      }),
    ).toEqual({ ok: false, reason: 'authentication_failed' });
    expect(replay).not.toHaveBeenCalled();
  });

  it('consumes an authenticated receipt once and rejects replay', () => {
    const receipt = seal({ kind: 'abstained', reason: 'storage_failure', limitations: [] });
    const seen = new Set<string>();
    const consumeReplayKey = (key: string) => {
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    };
    expect(verifier(receipt, { consumeReplayKey }).ok).toBe(true);
    expect(verifier(receipt, { consumeReplayKey })).toEqual({ ok: false, reason: 'replayed' });
  });

  it('fails closed when authentication, sealing, or replay storage throws', () => {
    const receipt = seal({ kind: 'abstained', reason: 'storage_failure', limitations: [] });
    expect(
      verifier(receipt, {
        verifyAuthentication: () => {
          throw new Error('key unavailable');
        },
      }),
    ).toEqual({ ok: false, reason: 'authentication_failed' });
    expect(
      verifier(receipt, {
        consumeReplayKey: () => {
          throw new Error('replay store unavailable');
        },
      }),
    ).toEqual({ ok: false, reason: 'replay_state_unavailable' });
    expect(
      sealTrendResultReceiptV1(
        input(),
        { kind: 'abstained', reason: 'cancelled', limitations: [] },
        {
          receiptId: RECEIPT_ID,
          nonce: 'nonce_for_local_test_01',
          issuedAt: '2026-03-01T12:02:00.000Z',
          expiresAt: '2026-03-01T12:10:00.000Z',
          issuerId: 'local-trend-issuer-v1',
          keyId: 'secure-key-v1',
          authenticate: () => {
            throw new Error('secure key unavailable');
          },
        },
      ),
    ).toBeNull();
  });
});
