import {
  ACCOUNT_DELETION_PAYLOAD_KEY_ENV,
  DELETION_PAYLOAD_ENVELOPE_VERSION,
  type DeletionEncryptedStepName,
  deletionPayloadEnvelopeFromByteaRpc,
  deletionPayloadEnvelopeToByteaRpc,
  DurableDeletionCryptoError,
  loadDeletionPayloadKeyFromEnv,
  maxDeletionPayloadPlaintextBytes,
  openDeletionPayload,
  parseDeletionPayloadEnvelope,
  sealDeletionPayload,
} from './durableDeletionCrypto.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertBytesEqual(actual: Uint8Array, expected: Uint8Array, message: string): void {
  assert(actual.byteLength === expected.byteLength, message);
  assert(
    actual.every((byte, index) => byte === expected[index]),
    message,
  );
}

async function assertCryptoError(
  operation: () => unknown | Promise<unknown>,
  code: DurableDeletionCryptoError['code'],
  forbiddenValue?: string,
): Promise<void> {
  try {
    await operation();
  } catch (error) {
    assert(error instanceof DurableDeletionCryptoError, 'expected a typed crypto error.');
    assert(error.code === code, `expected ${code}, received ${error.code}.`);
    assert(error.message === code, 'crypto errors must contain only a stable code.');
    if (forbiddenValue !== undefined) {
      assert(!error.message.includes(forbiddenValue), 'error message must omit secret material.');
      assert(
        !JSON.stringify(error).includes(forbiddenValue),
        'serialized error must omit secret material.',
      );
    }
    return;
  }
  throw new Error(`expected ${code}.`);
}

const USER_A = '00000000-0000-4000-8000-000000000001';
const USER_B = '00000000-0000-4000-8000-000000000002';
const KEY_A = `${'01'.repeat(31)}02`;
const KEY_B = `${'02'.repeat(31)}03`;
const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();
const observedNonces = new Set<string>();

async function keyFrom(encoded: string): Promise<CryptoKey> {
  return await loadDeletionPayloadKeyFromEnv((name) => {
    assert(
      name === ACCOUNT_DELETION_PAYLOAD_KEY_ENV,
      'the loader must read only the documented environment variable.',
    );
    return encoded;
  });
}

async function sealWithFreshNonce(options: {
  key: CryptoKey;
  userId: string;
  stepName: DeletionEncryptedStepName;
  plaintext: Uint8Array;
}): Promise<Uint8Array> {
  const sealed = await sealDeletionPayload(options);
  const envelope = parseDeletionPayloadEnvelope(options.stepName, sealed);
  assert(!observedNonces.has(envelope.nonce), 'tests must never reuse an AES-GCM nonce.');
  observedNonces.add(envelope.nonce);
  return sealed;
}

function canonicalEnvelopeBytes(value: {
  version: number;
  nonce: string;
  ciphertext: string;
  extra?: unknown;
}): Uint8Array {
  return TEXT_ENCODER.encode(JSON.stringify(value));
}

Deno.test('payload key loader accepts one exact nonextractable AES-256 env encoding', async () => {
  let reads = 0;
  const key = await loadDeletionPayloadKeyFromEnv((name) => {
    reads += 1;
    assert(name === 'ACCOUNT_DELETION_PAYLOAD_KEY_HEX', 'unexpected env name.');
    return KEY_A;
  });
  assert(reads === 1, 'the key environment variable must be read exactly once.');
  assert(key.type === 'secret', 'expected a secret key.');
  assert(key.extractable === false, 'the imported key must be nonextractable.');
  assert(key.algorithm.name === 'AES-GCM', 'expected AES-GCM.');
  assert('length' in key.algorithm && key.algorithm.length === 256, 'expected AES-256.');
  let exported = false;
  try {
    await crypto.subtle.exportKey('raw', key);
    exported = true;
  } catch {
    // Expected for a nonextractable key.
  }
  assert(!exported, 'the raw payload key must not be exportable.');
});

Deno.test('payload key loader rejects every noncanonical encoding without echoing it', async () => {
  for (const invalid of [
    undefined,
    '',
    '0'.repeat(63),
    '0'.repeat(65),
    'AA'.repeat(32),
    ` ${KEY_A}`,
    `${KEY_A} `,
    `0x${KEY_A}`,
    'g0'.repeat(32),
    btoa('not-a-raw-key'),
  ]) {
    const secret = typeof invalid === 'string' && invalid.length > 0 ? invalid : undefined;
    await assertCryptoError(
      () => loadDeletionPayloadKeyFromEnv(() => invalid),
      'DELETION_PAYLOAD_KEY_INVALID',
      secret,
    );
  }
  await assertCryptoError(
    () =>
      loadDeletionPayloadKeyFromEnv(() => {
        throw new Error(`do-not-leak-${KEY_A}`);
      }),
    'DELETION_PAYLOAD_KEY_INVALID',
    KEY_A,
  );
});

Deno.test('AES-GCM envelope round-trips and never contains plaintext', async () => {
  const key = await keyFrom(KEY_A);
  const plaintextText = 'apple-refresh-token-super-secret';
  const plaintext = TEXT_ENCODER.encode(plaintextText);
  const sealed = await sealWithFreshNonce({
    key,
    userId: USER_A,
    stepName: 'apple_revoke',
    plaintext,
  });
  const envelope = parseDeletionPayloadEnvelope('apple_revoke', sealed);
  assert(
    JSON.stringify(Object.keys(envelope).sort()) ===
      JSON.stringify(['ciphertext', 'nonce', 'version']),
    'the versioned envelope must have exact keys.',
  );
  assert(envelope.version === DELETION_PAYLOAD_ENVELOPE_VERSION, 'expected envelope v1.');
  assert(/^[A-Za-z0-9_-]{16}$/.test(envelope.nonce), 'nonce must be 12-byte base64url.');
  assert(
    !TEXT_DECODER.decode(sealed).includes(plaintextText),
    'serialized envelope must not contain plaintext.',
  );
  const opened = await openDeletionPayload({
    key,
    userId: USER_A,
    stepName: 'apple_revoke',
    serializedEnvelope: sealed,
  });
  assertBytesEqual(opened, plaintext, 'decrypted plaintext must round-trip exactly.');
});

Deno.test('RevenueCat reconciliation payload round-trips under its exact AAD step', async () => {
  const key = await keyFrom(KEY_A);
  const plaintextText = JSON.stringify({
    version: 1,
    customerId: USER_A,
    aliases: ['anonymous-alias', 'legacy-alias'],
    deleteOutcome: 'accepted',
  });
  const plaintext = TEXT_ENCODER.encode(plaintextText);
  const sealed = await sealWithFreshNonce({
    key,
    userId: USER_A,
    stepName: 'revenuecat_delete',
    plaintext,
  });
  assert(
    !TEXT_DECODER.decode(sealed).includes('anonymous-alias'),
    'RevenueCat aliases must never appear in the serialized envelope.',
  );
  const opened = await openDeletionPayload({
    key,
    userId: USER_A,
    stepName: 'revenuecat_delete',
    serializedEnvelope: sealed,
  });
  assertBytesEqual(
    opened,
    plaintext,
    'RevenueCat reconciliation plaintext must round-trip exactly.',
  );
});

Deno.test('every seal uses a fresh random 96-bit nonce', async () => {
  const key = await keyFrom(KEY_A);
  const options = {
    key,
    userId: USER_A,
    stepName: 'posthog_delete' as const,
    plaintext: TEXT_ENCODER.encode('same-plaintext'),
  };
  const first = await sealWithFreshNonce(options);
  const second = await sealWithFreshNonce(options);
  const firstEnvelope = parseDeletionPayloadEnvelope(options.stepName, first);
  const secondEnvelope = parseDeletionPayloadEnvelope(options.stepName, second);
  assert(firstEnvelope.nonce !== secondEnvelope.nonce, 'nonce reuse is forbidden.');
  assert(
    firstEnvelope.ciphertext !== secondEnvelope.ciphertext,
    'fresh nonces must produce distinct ciphertext.',
  );
});

Deno.test(
  'AAD rejects cross-user and every cross-step substitution with one opaque code',
  async () => {
    const key = await keyFrom(KEY_A);
    const plaintextSecret = 'credential-that-must-not-leak';
    const stepNames = ['apple_revoke', 'revenuecat_delete', 'posthog_delete'] as const;
    for (const sourceStepName of stepNames) {
      const sealed = await sealWithFreshNonce({
        key,
        userId: USER_A,
        stepName: sourceStepName,
        plaintext: TEXT_ENCODER.encode(plaintextSecret),
      });
      await assertCryptoError(
        () =>
          openDeletionPayload({
            key,
            userId: USER_B,
            stepName: sourceStepName,
            serializedEnvelope: sealed,
          }),
        'DELETION_PAYLOAD_DECRYPT_FAILED',
        plaintextSecret,
      );
      for (const destinationStepName of stepNames) {
        if (destinationStepName === sourceStepName) continue;
        await assertCryptoError(
          () =>
            openDeletionPayload({
              key,
              userId: USER_A,
              stepName: destinationStepName,
              serializedEnvelope: sealed,
            }),
          'DELETION_PAYLOAD_DECRYPT_FAILED',
          plaintextSecret,
        );
      }
    }
  },
);

Deno.test('context and option objects are strict and fail closed', async () => {
  const key = await keyFrom(KEY_A);
  const plaintext = TEXT_ENCODER.encode('secret');
  for (const invalid of [
    {
      key,
      userId: 'ABCDEFAB-0000-4000-8000-000000000001',
      stepName: 'apple_revoke',
      plaintext,
    },
    { key, userId: ` ${USER_A}`, stepName: 'apple_revoke', plaintext },
    { key, userId: USER_A, stepName: 'unknown_step', plaintext },
    { key, userId: USER_A, stepName: 'apple_revoke', plaintext, extra: true },
  ]) {
    await assertCryptoError(
      () => sealDeletionPayload(invalid as never),
      'DELETION_PAYLOAD_CONTEXT_INVALID',
    );
  }
});

Deno.test('wrong key and canonical ciphertext or nonce tampering fail authentication', async () => {
  const key = await keyFrom(KEY_A);
  const wrongKey = await keyFrom(KEY_B);
  const sealed = await sealWithFreshNonce({
    key,
    userId: USER_A,
    stepName: 'posthog_delete',
    plaintext: TEXT_ENCODER.encode('encrypted-reconciliation-state'),
  });
  await assertCryptoError(
    () =>
      openDeletionPayload({
        key: wrongKey,
        userId: USER_A,
        stepName: 'posthog_delete',
        serializedEnvelope: sealed,
      }),
    'DELETION_PAYLOAD_DECRYPT_FAILED',
  );

  const envelope = parseDeletionPayloadEnvelope('posthog_delete', sealed);
  const tamperedCiphertext = canonicalEnvelopeBytes({
    ...envelope,
    ciphertext: `${envelope.ciphertext[0] === 'A' ? 'B' : 'A'}${envelope.ciphertext.slice(1)}`,
  });
  await assertCryptoError(
    () =>
      openDeletionPayload({
        key,
        userId: USER_A,
        stepName: 'posthog_delete',
        serializedEnvelope: tamperedCiphertext,
      }),
    'DELETION_PAYLOAD_DECRYPT_FAILED',
  );

  const tamperedNonce = canonicalEnvelopeBytes({
    ...envelope,
    nonce: `${envelope.nonce[0] === 'A' ? 'B' : 'A'}${envelope.nonce.slice(1)}`,
  });
  await assertCryptoError(
    () =>
      openDeletionPayload({
        key,
        userId: USER_A,
        stepName: 'posthog_delete',
        serializedEnvelope: tamperedNonce,
      }),
    'DELETION_PAYLOAD_DECRYPT_FAILED',
  );
});

Deno.test(
  'envelope parser rejects malformed, noncanonical, oversized, and unknown versions',
  async () => {
    const key = await keyFrom(KEY_A);
    const sealed = await sealWithFreshNonce({
      key,
      userId: USER_A,
      stepName: 'apple_revoke',
      plaintext: TEXT_ENCODER.encode('secret'),
    });
    const envelope = parseDeletionPayloadEnvelope('apple_revoke', sealed);
    const malformed = [
      new Uint8Array(),
      TEXT_ENCODER.encode('not-json'),
      TEXT_ENCODER.encode(` ${TEXT_DECODER.decode(sealed)}`),
      TEXT_ENCODER.encode(
        JSON.stringify({
          ciphertext: envelope.ciphertext,
          nonce: envelope.nonce,
          version: envelope.version,
        }),
      ),
      canonicalEnvelopeBytes({ ...envelope, version: 2 }),
      canonicalEnvelopeBytes({ ...envelope, extra: true }),
      canonicalEnvelopeBytes({ ...envelope, nonce: 'A'.repeat(15) }),
      canonicalEnvelopeBytes({ ...envelope, ciphertext: '=' }),
      new Uint8Array(8_193),
    ];
    for (const value of malformed) {
      await assertCryptoError(
        () =>
          openDeletionPayload({
            key,
            userId: USER_A,
            stepName: 'apple_revoke',
            serializedEnvelope: value,
          }),
        'DELETION_PAYLOAD_ENVELOPE_INVALID',
      );
    }
  },
);

Deno.test(
  'step-specific max and oversize boundaries are enforced before seal and after parse',
  async () => {
    const key = await keyFrom(KEY_A);
    for (const stepName of ['apple_revoke', 'revenuecat_delete', 'posthog_delete'] as const) {
      const maximum = maxDeletionPayloadPlaintextBytes(stepName);
      const expectedEnvelopeLimit = stepName === 'apple_revoke' ? 8_192 : 32_768;
      assert(maximum > 0, 'expected a positive plaintext allowance.');
      await assertCryptoError(
        () =>
          sealDeletionPayload({
            key,
            userId: USER_A,
            stepName,
            plaintext: new Uint8Array(),
          }),
        'DELETION_PAYLOAD_PLAINTEXT_INVALID',
      );
      await assertCryptoError(
        () =>
          sealDeletionPayload({
            key,
            userId: USER_A,
            stepName,
            plaintext: new Uint8Array(maximum + 1),
          }),
        'DELETION_PAYLOAD_PLAINTEXT_INVALID',
      );

      const boundaryPlaintext = new Uint8Array(maximum);
      boundaryPlaintext[0] = 1;
      boundaryPlaintext[boundaryPlaintext.length - 1] = 2;
      const sealed = await sealWithFreshNonce({
        key,
        userId: USER_A,
        stepName,
        plaintext: boundaryPlaintext,
      });
      assert(
        sealed.byteLength === expectedEnvelopeLimit,
        `${stepName} maximum plaintext must fill its exact migration envelope limit.`,
      );
      const opened = await openDeletionPayload({
        key,
        userId: USER_A,
        stepName,
        serializedEnvelope: sealed,
      });
      assertBytesEqual(opened, boundaryPlaintext, 'boundary plaintext must round-trip.');
    }
  },
);

Deno.test('RevenueCat canonical bytea RPC transport preserves its exact envelope', async () => {
  const key = await keyFrom(KEY_A);
  const plaintext = TEXT_ENCODER.encode(
    '{"version":1,"customerId":"opaque-customer","aliases":[]}',
  );
  const sealed = await sealWithFreshNonce({
    key,
    userId: USER_A,
    stepName: 'revenuecat_delete',
    plaintext,
  });
  const bytea = deletionPayloadEnvelopeToByteaRpc('revenuecat_delete', sealed);
  assert(
    /^\\x[0-9a-f]+$/.test(bytea),
    'RevenueCat RPC bytea must use canonical PostgreSQL hex text.',
  );
  const restored = deletionPayloadEnvelopeFromByteaRpc('revenuecat_delete', bytea);
  assertBytesEqual(restored, sealed, 'RevenueCat bytea decode must restore the exact envelope.');
  const opened = await openDeletionPayload({
    key,
    userId: USER_A,
    stepName: 'revenuecat_delete',
    serializedEnvelope: restored,
  });
  assertBytesEqual(opened, plaintext, 'RevenueCat bytea transport must preserve decryptability.');
  await assertCryptoError(
    () => deletionPayloadEnvelopeFromByteaRpc('revenuecat_delete', `\\x${'00'.repeat(32_769)}`),
    'DELETION_PAYLOAD_BYTEA_INVALID',
  );
});

Deno.test('canonical bytea RPC hex transport round-trips the exact envelope bytes', async () => {
  const key = await keyFrom(KEY_A);
  const plaintext = TEXT_ENCODER.encode('bytea-rpc-round-trip-secret');
  const sealed = await sealWithFreshNonce({
    key,
    userId: USER_A,
    stepName: 'posthog_delete',
    plaintext,
  });
  const bytea = deletionPayloadEnvelopeToByteaRpc('posthog_delete', sealed);
  assert(/^\\x[0-9a-f]+$/.test(bytea), 'RPC bytea must use canonical PostgreSQL hex text.');
  assert(
    bytea.length === 2 + sealed.byteLength * 2,
    'bytea hex must represent every envelope byte exactly once.',
  );
  const restored = deletionPayloadEnvelopeFromByteaRpc('posthog_delete', bytea);
  assertBytesEqual(restored, sealed, 'bytea decode must restore the exact envelope.');
  const opened = await openDeletionPayload({
    key,
    userId: USER_A,
    stepName: 'posthog_delete',
    serializedEnvelope: restored,
  });
  assertBytesEqual(opened, plaintext, 'bytea transport must preserve decryptability.');
});

Deno.test(
  'bytea transport rejects noncanonical and oversized representations before decode',
  async () => {
    const key = await keyFrom(KEY_A);
    const sealed = await sealWithFreshNonce({
      key,
      userId: USER_A,
      stepName: 'apple_revoke',
      plaintext: TEXT_ENCODER.encode('secret'),
    });
    const valid = deletionPayloadEnvelopeToByteaRpc('apple_revoke', sealed);
    for (const invalid of [
      '',
      valid.slice(2),
      `\\X${valid.slice(2)}`,
      `\\x${valid.slice(2).toUpperCase()}`,
      `${valid}0`,
      '\\xzz',
      `\\x${'00'.repeat(8_193)}`,
    ]) {
      await assertCryptoError(
        () => deletionPayloadEnvelopeFromByteaRpc('apple_revoke', invalid),
        'DELETION_PAYLOAD_BYTEA_INVALID',
      );
    }
  },
);
