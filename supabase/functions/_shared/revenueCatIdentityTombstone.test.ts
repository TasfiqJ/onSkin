import {
  buildRevenueCatIdentityTombstoneFamily,
  buildRevenueCatIdentityTombstoneLookup,
  canonicalRevenueCatIdentity,
  parseRevenueCatIdentityTombstoneKeyring,
  RevenueCatIdentityTombstoneError,
} from './revenueCatIdentityTombstone.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertStableFailure(
  operation: () => unknown,
  expected:
    | 'REVENUECAT_IDENTITY_TOMBSTONE_CONFIG_INVALID'
    | 'REVENUECAT_IDENTITY_TOMBSTONE_INPUT_INVALID',
): void {
  try {
    operation();
  } catch (error) {
    assert(error instanceof RevenueCatIdentityTombstoneError, 'unexpected error type.');
    assert(error.message === expected, `expected ${expected}, got ${error.message}.`);
    return;
  }
  throw new Error(`expected ${expected}.`);
}

async function assertStableAsyncFailure(
  operation: () => Promise<unknown>,
  expected: 'REVENUECAT_IDENTITY_TOMBSTONE_INPUT_INVALID',
): Promise<void> {
  try {
    await operation();
  } catch (error) {
    assert(error instanceof RevenueCatIdentityTombstoneError, 'unexpected async error type.');
    assert(error.message === expected, `expected ${expected}, got ${error.message}.`);
    return;
  }
  throw new Error(`expected ${expected}.`);
}

const KEY_ONE = '00'.repeat(32);
const KEY_TWO = '11'.repeat(32);

Deno.test('RevenueCat identity tombstone keyring parser is canonical and rotation-safe', () => {
  const parsed = parseRevenueCatIdentityTombstoneKeyring(`1=${KEY_ONE};2=${KEY_TWO}`, '2');
  assert(parsed.currentVersion === 2, 'current key version was not selected.');
  assert(
    JSON.stringify(parsed.keys.map((key) => key.version)) === JSON.stringify([1, 2]),
    'key versions were reordered or omitted.',
  );

  for (const [keys, current] of [
    ['', '1'],
    [`01=${KEY_ONE}`, '1'],
    [`2=${KEY_TWO};1=${KEY_ONE}`, '2'],
    [`1=${KEY_ONE};2=${KEY_ONE}`, '2'],
    [`1=${'ab'.repeat(32).toUpperCase()}`, '1'],
    [`1=${KEY_ONE}`, '2'],
    [`1=${KEY_ONE};`, '1'],
    [
      `1=${KEY_ONE};2=${KEY_TWO};3=${'22'.repeat(32)};4=${'33'.repeat(32)};5=${'44'.repeat(32)}`,
      '5',
    ],
  ] as const) {
    assertStableFailure(
      () => parseRevenueCatIdentityTombstoneKeyring(keys, current),
      'REVENUECAT_IDENTITY_TOMBSTONE_CONFIG_INVALID',
    );
  }
});

Deno.test('RevenueCat identity canonicalization rejects ambiguous UTF-8 inputs', () => {
  assert(canonicalRevenueCatIdentity('opaque-id') === 'opaque-id', 'valid ID changed.');
  assert(canonicalRevenueCatIdentity('é') === 'é', 'canonical Unicode scalar changed.');
  for (const value of [
    '',
    ' opaque-id',
    'opaque-id\n',
    'e\u0301',
    '\ud800',
    'a\u0000b',
    'x'.repeat(1_501),
  ]) {
    assertStableFailure(
      () => canonicalRevenueCatIdentity(value),
      'REVENUECAT_IDENTITY_TOMBSTONE_INPUT_INVALID',
    );
  }
});

Deno.test(
  'RevenueCat deletion family HMAC has a stable domain-separated known answer',
  async () => {
    const keyring = parseRevenueCatIdentityTombstoneKeyring(`1=${KEY_ONE};2=${KEY_TWO}`, '2');
    const family = await buildRevenueCatIdentityTombstoneFamily(
      'proj_test_123',
      ['opaque-id', '00000000-0000-4000-8000-000000000001', 'opaque-id'],
      keyring,
    );
    assert(family.keyVersion === 2, 'family used a non-current HMAC key.');
    assert(
      JSON.stringify(family.rawIdentities) ===
        JSON.stringify(['00000000-0000-4000-8000-000000000001', 'opaque-id']),
      'family was not canonical, sorted, and deduplicated.',
    );
    assert(
      JSON.stringify(family.identityHmacs) ===
        JSON.stringify([
          '96a38d041c9da5246fdd1314f1f1ea10e313cbcfadc9bb8475424ecda48885f7',
          '96fc2383ed0fe56f212971a54b437c936c078e1e741d19f97a4e13ffa4c02ce1',
        ]),
      'domain-separated HMAC known-answer vector changed.',
    );
    assert(
      !JSON.stringify(family.identityHmacs).includes('opaque-id'),
      'raw identity entered the retained HMAC values.',
    );
  },
);

Deno.test('RevenueCat webhook lookup checks every configured key and source mapping', async () => {
  const keyring = parseRevenueCatIdentityTombstoneKeyring(`1=${KEY_ONE};2=${KEY_TWO}`, '2');
  const parent = '$RCAnonymousID:00000000-0000-4000-8000-000000000001';
  const lookup = await buildRevenueCatIdentityTombstoneLookup(
    'proj_test_123',
    [
      { identityValue: parent, hashIdentity: parent },
      {
        identityValue: parent,
        hashIdentity: '00000000-0000-4000-8000-000000000001',
      },
      { identityValue: parent, hashIdentity: parent },
    ],
    keyring,
  );
  assert(lookup.identityHmacs.length === 4, 'lookup did not cover 2 keys × 2 hashes.');
  assert(
    JSON.stringify(lookup.keyVersions) === JSON.stringify([1, 1, 2, 2]),
    'lookup key order was unstable.',
  );
  assert(
    lookup.identityValues.every((value) => value === parent),
    'embedded UUID hash was not mapped back to its exact structured parent.',
  );
  assert(
    new Set(lookup.identityHmacs).size === 4,
    'domain/key/identity separation did not produce unique lookup HMACs.',
  );
});

Deno.test('RevenueCat deletion family is bounded by identity count and UTF-8 bytes', async () => {
  const keyring = parseRevenueCatIdentityTombstoneKeyring(`1=${KEY_ONE}`, '1');
  await assertStableAsyncFailure(
    () =>
      buildRevenueCatIdentityTombstoneFamily(
        'proj_test_123',
        Array.from({ length: 67 }, (_, index) => `identity-${index}`),
        keyring,
      ),
    'REVENUECAT_IDENTITY_TOMBSTONE_INPUT_INVALID',
  );
  await assertStableAsyncFailure(
    () =>
      buildRevenueCatIdentityTombstoneFamily(
        'proj_test_123',
        ['a'.repeat(1_500), 'b'.repeat(1_500), 'c'.repeat(1_097)],
        keyring,
      ),
    'REVENUECAT_IDENTITY_TOMBSTONE_INPUT_INVALID',
  );
});
