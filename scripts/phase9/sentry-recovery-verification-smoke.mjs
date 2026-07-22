#!/usr/bin/env node
import assert from 'node:assert/strict';

import {
  validateSentryRecoveryResponses,
  verifySentryRecovery,
} from './sentry-recovery-verification.mjs';

const javascriptEventId = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const nativeEventId = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const release = 'com.routinekind.app@1.2.3+42';
const dist = '42';
const binaryUuid = '11111111-1111-4111-8111-111111111111';
const hermesDebugId = '22222222-2222-4222-8222-222222222222';
const now = Date.parse('2026-07-18T16:00:00.000Z');
const capturedAt = '2026-07-18T15:00:00.000Z';

function fixture() {
  return {
    javascriptEvent: {
      eventID: javascriptEventId,
      release: { version: release },
      dist,
      dateReceived: capturedAt,
      errors: [],
      entries: [
        {
          data: {
            values: [
              {
                stacktrace: {
                  frames: [
                    { lineNo: 12, origAbsPath: 'app:///src/app.tsx', function: 'renderApp' },
                  ],
                },
              },
            ],
          },
        },
      ],
    },
    nativeEvent: {
      eventID: nativeEventId,
      release: { version: release },
      dist,
      dateReceived: capturedAt,
      errors: [],
      debugMeta: {
        images: [{ debugId: binaryUuid, imageAddr: '0x1000', imageSize: '0x1000' }],
      },
      entries: [
        {
          data: {
            values: [
              {
                stacktrace: {
                  frames: [
                    {
                      instructionAddr: '0x1100',
                      symbolAddr: '0x1080',
                      function: 'routinekindRecoveryProbe',
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    },
    sourceMapDebug: [
      {
        uploaded_source_file_with_correct_debug_id: true,
        uploaded_source_map_with_correct_debug_id: true,
        debug_id: hermesDebugId,
      },
    ],
    debugFilesByUuid: {
      [binaryUuid]: [
        { debugId: binaryUuid, symbolType: 'macho', data: { features: ['debug', 'symtab'] } },
      ],
    },
  };
}

const expected = {
  javascriptEventId,
  nativeEventId,
  release,
  dist,
  binaryUuids: [binaryUuid],
  hermesDebugId,
  now,
  maxAgeMs: 30 * 24 * 60 * 60 * 1000,
};

assert.deepEqual(validateSentryRecoveryResponses(fixture(), expected), []);

for (const [label, mutate, pattern] of [
  [
    'wrong release',
    (value) => (value.javascriptEvent.release.version = 'wrong@1.0.0+1'),
    /release/,
  ],
  ['wrong dist', (value) => (value.nativeEvent.dist = '41'), /dist/],
  ['unresolved JS', (value) => (value.javascriptEvent.entries = []), /JavaScript recovery/],
  ['missing source map', (value) => (value.sourceMapDebug = []), /source-map recovery/],
  [
    'wrong source-map debug ID',
    (value) => (value.sourceMapDebug[0].debug_id = '33333333-3333-4333-8333-333333333333'),
    /exact Hermes debug ID/,
  ],
  [
    'minified generated JS frame',
    (value) =>
      (value.javascriptEvent.entries[0].data.values[0].stacktrace.frames[0] = {
        lineNo: 1,
        origAbsPath: 'app:///main.jsbundle',
        function: 'a',
      }),
    /JavaScript recovery/,
  ],
  ['unresolved native', (value) => (value.nativeEvent.entries = []), /Native recovery/],
  [
    'native frame without provider symbol address',
    (value) => delete value.nativeEvent.entries[0].data.values[0].stacktrace.frames[0].symbolAddr,
    /Native recovery/,
  ],
  [
    'unrelated native system frame',
    (value) =>
      (value.nativeEvent.entries[0].data.values[0].stacktrace.frames[0] = {
        instructionAddr: '0x9999',
        function: 'systemFrameworkFunction',
      }),
    /Native recovery/,
  ],
  [
    'frame-level debug ID without matching image',
    (value) => {
      value.nativeEvent.debugMeta.images = [];
      value.nativeEvent.entries[0].data.values[0].stacktrace.frames[0].debugId = binaryUuid;
    },
    /Native recovery/,
  ],
  [
    'arbitrary event-level frame outside exception entries',
    (value) => {
      value.nativeEvent.entries = [];
      value.nativeEvent.unrelated = {
        frames: [{ instructionAddr: '0x1100', function: 'routinekindRecoveryProbe' }],
      };
    },
    /Native recovery/,
  ],
  [
    'client-controlled context debug metadata',
    (value) => {
      value.nativeEvent.contexts = { debugMeta: value.nativeEvent.debugMeta };
      delete value.nativeEvent.debugMeta;
    },
    /Native recovery/,
  ],
  ['missing event UUID', (value) => (value.nativeEvent.debugMeta.images = []), /binary UUID/],
  ['missing uploaded dSYM', (value) => (value.debugFilesByUuid[binaryUuid] = []), /debug file/],
  [
    'uploaded UUID is not a Mach-O debug file',
    (value) =>
      (value.debugFilesByUuid[binaryUuid] = [
        { debugId: binaryUuid, symbolType: 'macho', data: { features: ['symtab'] } },
      ]),
    /Mach-O debug file/,
  ],
  [
    'symbol error',
    (value) => (value.nativeEvent.errors = [{ type: 'native_missing_dsym' }]),
    /symbol/,
  ],
  [
    'stale event',
    (value) => (value.nativeEvent.dateReceived = '2026-05-01T00:00:00.000Z'),
    /stale/,
  ],
]) {
  const value = structuredClone(fixture());
  mutate(value);
  const errors = validateSentryRecoveryResponses(value, expected);
  assert.ok(
    errors.some((error) => pattern.test(error)),
    `${label}: ${errors.join('\n')}`,
  );
}

const providerInput = {
  env: {
    SENTRY_AUTH_TOKEN: 'sntrys_test_token',
    SENTRY_ORG: 'routinekind',
    SENTRY_PROJECT: 'mobile',
    SENTRY_API_URL: 'https://sentry.io',
  },
  javascriptEventId,
  nativeEventId,
  release,
  dist,
  binaryUuids: [binaryUuid],
  hermesDebugId,
  now,
  maxAgeMs: 30 * 24 * 60 * 60 * 1000,
};

for (const [label, override, pattern] of [
  ['empty binary inventory', { binaryUuids: [] }, /non-empty UUID list/],
  ['malformed binary UUID', { binaryUuids: ['not-a-uuid'] }, /Every binary UUID/],
  [
    'duplicate binary UUID',
    { binaryUuids: [binaryUuid, binaryUuid] },
    /must not contain duplicates/,
  ],
  ['malformed Hermes ID', { hermesDebugId: '' }, /Hermes source-map debug ID/],
  ['malformed release', { release: 'owner@example.com' }, /bundle@version\+build/],
  ['malformed dist', { dist: '../private' }, /distribution ID/],
  ['invalid now', { now: Number.NaN }, /finite non-negative/],
  ['invalid maximum age', { maxAgeMs: 0 }, /bounded positive duration/],
]) {
  let fetchCalls = 0;
  await assert.rejects(
    verifySentryRecovery({
      ...providerInput,
      ...override,
      fetchImpl: async () => {
        fetchCalls += 1;
        throw new Error('must not fetch');
      },
    }),
    pattern,
    label,
  );
  assert.equal(fetchCalls, 0, `${label} reached the provider before validation`);
}

console.log('Sentry recovery verification smoke passed (1 positive, 25 negative cases).');
