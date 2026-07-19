#!/usr/bin/env node
import assert from 'node:assert/strict';

import {
  compressedResourceKind,
  hasInlineSourceMapMarker,
  hasUsableDwarfSections,
  isBundledSourceMapPath,
  isDsymDwarfPath,
  isInlineSourceMapCandidatePath,
  isMachOMagic,
  looksLikeSourceMapDocumentPrefix,
  parseDwarfdumpUuidOutput,
  parseDistributionSignatureDetails,
  parseHermesSourceMapDebugId,
  validateProvisioningBinding,
} from './ios-artifact-inspection.mjs';

const first = '11111111-1111-4111-8111-111111111111';
const second = '22222222-2222-4222-8222-222222222222';

assert.deepEqual(
  parseDwarfdumpUuidOutput(
    `UUID: ${second.toUpperCase()} (arm64) /private/tmp/App\nnoise\nUUID: ${first} (arm64e) /private/tmp/App\nUUID: ${second} (arm64) duplicate`,
  ),
  [first, second],
);
assert.deepEqual(parseDwarfdumpUuidOutput('not a UUID inventory'), []);
assert.equal(parseHermesSourceMapDebugId(JSON.stringify({ debug_id: first })), first);
assert.equal(parseHermesSourceMapDebugId(JSON.stringify({ debugId: second })), second);
assert.throws(() => parseHermesSourceMapDebugId('{'), /valid JSON/);
assert.throws(() => parseHermesSourceMapDebugId('{}'), /UUID debug ID/);
for (const magic of [
  'feedface',
  'cefaedfe',
  'feedfacf',
  'cffaedfe',
  'cafebabe',
  'bebafeca',
  'cafebabf',
  'bfbafeca',
]) {
  assert.equal(isMachOMagic(Buffer.from(magic, 'hex')), true);
}
assert.equal(isMachOMagic(Buffer.from('504b0304', 'hex')), false);
for (const path of [
  'main.js.map',
  'main.js.sourcemap',
  'main.js.map.gz',
  'MAIN.JS.SOURCEMAP.BR',
  'main.js.map.txt',
]) {
  assert.equal(isBundledSourceMapPath(path), true);
}
assert.equal(isBundledSourceMapPath('main.hbc'), false);
assert.equal(
  hasInlineSourceMapMarker('//# sourceMappingURL=data:application/json;base64,e30='),
  true,
);
assert.equal(hasInlineSourceMapMarker('//# sourceMappingURL=main.js.map'), false);
for (const path of [
  'main.js',
  'main.mjs',
  'main.cjs',
  'main.jsbundle',
  'main.bundle',
  'main.hbc',
]) {
  assert.equal(isInlineSourceMapCandidatePath(path), true);
}
assert.equal(isInlineSourceMapCandidatePath('main.json'), false);
assert.equal(
  looksLikeSourceMapDocumentPrefix('{"version":3,"sources":["a.ts"],"mappings":"AAAA"}'),
  true,
);
assert.equal(looksLikeSourceMapDocumentPrefix('{"version":3,"sources":[]}'), false);
assert.equal(
  looksLikeSourceMapDocumentPrefix(
    '{"version":3,"sections":[{"offset":{"line":0,"column":0},"map":{}}]}',
  ),
  true,
);
assert.equal(compressedResourceKind('asset.bin', Buffer.from('1f8b', 'hex')), 'gzip');
assert.equal(compressedResourceKind('asset.dat', Buffer.from('789c', 'hex')), 'zlib');
assert.equal(compressedResourceKind('asset.br', Buffer.from('0000', 'hex')), 'brotli');
assert.equal(compressedResourceKind('asset.bin', Buffer.from('0000', 'hex')), '');
assert.equal(isDsymDwarfPath('/tmp/App.dSYM/Contents/Resources/DWARF/App'), true);
assert.equal(isDsymDwarfPath('/tmp/App.app/App'), false);
assert.equal(
  hasUsableDwarfSections(`
    sectname __debug_info
       size 0x0000000000000100
    sectname __debug_abbrev
       size 0x0000000000000040
  `),
  true,
);
assert.equal(
  hasUsableDwarfSections(`
    sectname __text
       size 0x0000000000000100
  `),
  false,
);
assert.deepEqual(
  parseDistributionSignatureDetails(
    'Authority=Apple Distribution: RoutineKind Inc. (ABCDE12345)\nTeamIdentifier=ABCDE12345',
  ),
  { signingTeamIdentifier: 'ABCDE12345' },
);
assert.deepEqual(
  parseDistributionSignatureDetails(
    'Authority=iPhone Distribution: RoutineKind Inc. (ABCDE12345)\nTeamIdentifier=ABCDE12345',
  ),
  { signingTeamIdentifier: 'ABCDE12345' },
);
assert.equal(
  parseDistributionSignatureDetails(
    'Authority=Apple Development: Developer (ABCDE12345)\nTeamIdentifier=ABCDE12345',
  ),
  null,
);
assert.equal(
  parseDistributionSignatureDetails(
    'Authority=Apple Distribution: RoutineKind Inc. (ABCDE12345)\nTeamIdentifier=invalid',
  ),
  null,
);

const provisioningFixture = {
  profile: {
    TeamIdentifier: ['ABCDE12345'],
    ExpirationDate: '2027-07-18T00:00:00.000Z',
    Entitlements: {
      'application-identifier': 'ABCDE12345.com.routinekind.app',
      'com.apple.developer.team-identifier': 'ABCDE12345',
      'get-task-allow': false,
      'keychain-access-groups': ['ABCDE12345.com.routinekind.app'],
    },
  },
  appEntitlements: {
    'application-identifier': 'ABCDE12345.com.routinekind.app',
    'com.apple.developer.team-identifier': 'ABCDE12345',
    'get-task-allow': false,
    'keychain-access-groups': ['ABCDE12345.com.routinekind.app'],
  },
  bundleIdentifier: 'com.routinekind.app',
  signingTeamIdentifier: 'ABCDE12345',
  now: Date.parse('2026-07-18T00:00:00.000Z'),
};
assert.deepEqual(validateProvisioningBinding(provisioningFixture), []);
for (const [mutate, pattern] of [
  [(value) => (value.profile.TeamIdentifier = ['ZZZZZ99999']), /profile team/],
  [(value) => (value.profile.ProvisionedDevices = ['device']), /App Store distribution/],
  [(value) => (value.profile.ExpirationDate = '2025-01-01T00:00:00.000Z'), /expired/],
  [(value) => (value.appEntitlements['com.apple.developer.healthkit'] = true), /not covered/],
]) {
  const value = structuredClone(provisioningFixture);
  mutate(value);
  assert.ok(validateProvisioningBinding(value).some((error) => pattern.test(error)));
}

console.log('iOS artifact inspection parser smoke passed.');
