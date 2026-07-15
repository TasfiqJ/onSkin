import {
  APPLE_VAULT_CURRENT_VERSION_ENV,
  APPLE_VAULT_KEYS_ENV,
  AppleVaultError,
  appleVaultEnvelopeFromBytea,
  appleVaultEnvelopeToBytea,
  loadAppleVaultKeyring,
  openAppleRefreshToken,
  sealAppleRefreshToken,
} from './appleVault.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const USER_ID = '00000000-0000-4000-8000-000000000001';
const SUBJECT_HMAC = 'a'.repeat(64);
const CLIENT_ID = 'com.example.routinekind';

function env(values: Record<string, string>) {
  return (name: string) => values[name];
}

async function keyring(
  currentVersion = 'k2',
  keys: Record<string, string> = { k1: '11'.repeat(32), k2: '22'.repeat(32) },
) {
  return await loadAppleVaultKeyring(
    env({
      [APPLE_VAULT_CURRENT_VERSION_ENV]: currentVersion,
      [APPLE_VAULT_KEYS_ENV]: JSON.stringify(keys),
    }),
  );
}

async function expectCode(operation: () => Promise<unknown> | unknown, code: string) {
  try {
    await operation();
    throw new Error(`expected ${code}`);
  } catch (error) {
    assert(error instanceof AppleVaultError, 'expected AppleVaultError');
    assert(error.code === code, `expected ${code}, received ${error.code}`);
  }
}

Deno.test(
  'Apple refresh-token vault round-trips with canonical bytea and current key',
  async () => {
    const keys = await keyring();
    const token = 'refresh-token-that-must-never-appear-in-database-plaintext';
    const envelope = await sealAppleRefreshToken({
      keyring: keys,
      userId: USER_ID,
      subjectHmac: SUBJECT_HMAC,
      clientId: CLIENT_ID,
      refreshToken: token,
    });
    const serialized = new TextDecoder().decode(envelope);
    assert(!serialized.includes(token), 'envelope must not contain plaintext token');
    assert(serialized.includes('"keyVersion":"k2"'), 'current key version must be bound');

    const bytea = appleVaultEnvelopeToBytea(envelope);
    const opened = await openAppleRefreshToken({
      keyring: keys,
      userId: USER_ID,
      subjectHmac: SUBJECT_HMAC,
      clientId: CLIENT_ID,
      envelope: appleVaultEnvelopeFromBytea(bytea),
    });
    assert(opened === token, 'refresh token must round-trip exactly');
  },
);

Deno.test('Apple vault retains bounded previous-key reads during rotation', async () => {
  const oldKeys = await keyring('k1');
  const envelope = await sealAppleRefreshToken({
    keyring: oldKeys,
    userId: USER_ID,
    subjectHmac: SUBJECT_HMAC,
    clientId: CLIENT_ID,
    refreshToken: 'old-key-refresh-token',
  });
  const rotatedKeys = await keyring('k2');
  const opened = await openAppleRefreshToken({
    keyring: rotatedKeys,
    userId: USER_ID,
    subjectHmac: SUBJECT_HMAC,
    clientId: CLIENT_ID,
    envelope,
  });
  assert(opened === 'old-key-refresh-token', 'previous key must remain readable during rotation');
});

Deno.test('Apple vault authenticates owner, subject, client, key, and ciphertext', async () => {
  const keys = await keyring();
  const envelope = await sealAppleRefreshToken({
    keyring: keys,
    userId: USER_ID,
    subjectHmac: SUBJECT_HMAC,
    clientId: CLIENT_ID,
    refreshToken: 'bound-refresh-token',
  });

  for (const context of [
    {
      userId: '00000000-0000-4000-8000-000000000002',
      subjectHmac: SUBJECT_HMAC,
      clientId: CLIENT_ID,
    },
    { userId: USER_ID, subjectHmac: 'b'.repeat(64), clientId: CLIENT_ID },
    { userId: USER_ID, subjectHmac: SUBJECT_HMAC, clientId: 'com.example.other' },
  ]) {
    await expectCode(
      () => openAppleRefreshToken({ keyring: keys, envelope, ...context }),
      'APPLE_VAULT_DECRYPT_FAILED',
    );
  }

  const tampered = new Uint8Array(envelope);
  tampered[tampered.length - 3] ^= 1;
  await expectCode(
    () =>
      openAppleRefreshToken({
        keyring: keys,
        userId: USER_ID,
        subjectHmac: SUBJECT_HMAC,
        clientId: CLIENT_ID,
        envelope: tampered,
      }),
    'APPLE_VAULT_ENVELOPE_INVALID',
  );

  const wrongKeys = await keyring('k2', { k2: '33'.repeat(32) });
  await expectCode(
    () =>
      openAppleRefreshToken({
        keyring: wrongKeys,
        userId: USER_ID,
        subjectHmac: SUBJECT_HMAC,
        clientId: CLIENT_ID,
        envelope,
      }),
    'APPLE_VAULT_DECRYPT_FAILED',
  );
});

Deno.test('Apple vault configuration and bytea parsing fail closed', async () => {
  for (const values of [
    {},
    { [APPLE_VAULT_CURRENT_VERSION_ENV]: 'k1', [APPLE_VAULT_KEYS_ENV]: '{}' },
    {
      [APPLE_VAULT_CURRENT_VERSION_ENV]: 'missing',
      [APPLE_VAULT_KEYS_ENV]: JSON.stringify({ k1: '11'.repeat(32) }),
    },
    {
      [APPLE_VAULT_CURRENT_VERSION_ENV]: 'k1',
      [APPLE_VAULT_KEYS_ENV]: JSON.stringify({ k1: 'AA'.repeat(32) }),
    },
  ]) {
    await expectCode(
      () => loadAppleVaultKeyring(env(values as Record<string, string>)),
      'APPLE_VAULT_CONFIGURATION_INVALID',
    );
  }
  for (const value of ['plain', '\\x', '\\x0g', `\\x${'00'.repeat(8193)}`]) {
    try {
      appleVaultEnvelopeFromBytea(value);
      throw new Error('expected invalid bytea');
    } catch (error) {
      assert(error instanceof AppleVaultError, 'invalid bytea must fail with AppleVaultError');
    }
  }
});
