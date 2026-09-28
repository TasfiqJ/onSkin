import assert from 'node:assert/strict';
import test from 'node:test';

import { auditPhoto03Sources, photo03Source } from './photo03-source-contract.mjs';

test('repository satisfies aggregate PHOTO-03 AST/dataflow contract', () => {
  assert.deepEqual(auditPhoto03Sources(), { checks: 11, status: 'pass' });
});

test('rejects enabling native face tracking', () => {
  assert.throws(
    () => auditPhoto03Sources({ provider: photo03Source('provider').replace('isTrackingEnabled: false', 'isTrackingEnabled: true') }),
    /tracking signals must stay disabled/u,
  );
});

test('rejects adding identity-capable face observation fields', () => {
  assert.throws(
    () => auditPhoto03Sources({ analysis: photo03Source('analysis').replace('  headEulerAngleX?', '  embedding?: number[];\n  headEulerAngleX?') }),
    /allowlist geometry and finite pose only/u,
  );
});

test('rejects matched framing without complete pose signals', () => {
  assert.throws(
    () => auditPhoto03Sources({ analysis: photo03Source('analysis').replace('    poseSignalsPresent &&', '    true &&') }),
    /must require every finite pose signal/u,
  );
});

test('rejects raw native face publication', () => {
  assert.throws(
    () => auditPhoto03Sources({ detector: photo03Source('detector').replace("publishIfCurrent({ status: 'done', faces });", "publishIfCurrent({ status: 'done', faces: await detector.detectFaces(uri) });") }),
    /validated faces|allowlisted before publication/u,
  );
});

test('rejects lighting success before plaintext cleanup', () => {
  assert.throws(
    () => auditPhoto03Sources({ lighting: photo03Source('lighting').replace('    const retryCleanup = () => cleanupOwnedSample', '    return assessment!;\n    const retryCleanup = () => cleanupOwnedSample') }),
    /cleaned before success/u,
  );
});

test('rejects network egress added to capture analysis', () => {
  assert.throws(
    () => auditPhoto03Sources({ hook: `${photo03Source('hook')}\nfetch('https://example.invalid');` }),
    /must have no cloud, network, or analytics egress/u,
  );
});

test('rejects production-accessible analysis fixtures', () => {
  assert.throws(
    () => auditPhoto03Sources({ hook: photo03Source('hook').replace("if (typeof __DEV__ === 'undefined' || !__DEV__) return null;", '') }),
    /fixtures must stay double-gated/u,
  );
});

test('rejects an object spread that overrides disabled detector options', () => {
  assert.throws(
    () =>
      auditPhoto03Sources({
        provider: photo03Source('provider').replace(
          '  isTrackingEnabled: false,',
          '  isTrackingEnabled: false,\n  ...{ landmarkMode: true, isTrackingEnabled: true },',
        ),
      }),
    /cannot contain overriding object spreads/u,
  );
});

test('rejects pose completeness replaced with a true initializer', () => {
  assert.throws(
    () =>
      auditPhoto03Sources({
        analysis: photo03Source('analysis').replace(
          'const poseSignalsPresent = headRoll !== null && headYaw !== null && headPitch !== null;',
          'const poseSignalsPresent = true;',
        ),
      }),
    /derived from all three finite pose signals/u,
  );
});

test('rejects an effective 4096px lighting resize while the bounded constant remains', () => {
  assert.throws(
    () =>
      auditPhoto03Sources({
        lighting: photo03Source('lighting').replace(
          'resize: { width: SAMPLE_WIDTH }',
          'resize: { width: 4096 }',
        ),
      }),
    /bind its effective width to the bounded sample constant/u,
  );
});

test('rejects cleanupOwnedSample returning before owned cleanup', () => {
  assert.throws(
    () =>
      auditPhoto03Sources({
        lighting: photo03Source('lighting').replace(
          '): Promise<void> {\n  const results',
          '): Promise<void> {\n  return;\n  const results',
        ),
      }),
    /must delete generated and journal-owned plaintext/u,
  );
});

test('rejects aliased expo fetch egress', () => {
  assert.throws(
    () =>
      auditPhoto03Sources({
        hook: `import { fetch as sendCapture } from 'expo/fetch';\n${photo03Source('hook')}\nsendCapture('https://example.invalid');`,
      }),
    /must have no cloud, network, or analytics egress/u,
  );
});
