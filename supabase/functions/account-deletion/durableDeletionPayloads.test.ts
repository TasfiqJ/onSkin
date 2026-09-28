import {
  APPLE_AUTHORIZATION_CODE_MAX_CHARS,
  APPLE_REVOCATION_TOKEN_MAX_CHARS,
  APPLE_SUBJECT_MAX_CHARS,
  applePayloadWithRevocationToken,
  createAppleDeletionPayload,
  createAppleDeletionPayloadWithRevocationToken,
  decodeAppleDeletionPayload,
  DurableDeletionPayloadError,
  encodeAppleDeletionPayload,
} from './durableDeletionPayloads.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertDeepEqual(actual: unknown, expected: unknown): void {
  const left = JSON.stringify(actual);
  const right = JSON.stringify(expected);
  if (left !== right) throw new Error(`${left} !== ${right}`);
}

function assertPayloadError(action: () => unknown, code: string): void {
  try {
    action();
  } catch (error) {
    assert(error instanceof DurableDeletionPayloadError, 'expected payload error');
    assert(error.code === code, `expected ${code}, got ${error.code}`);
    assert(!error.message.includes('secret'), 'error must not echo payload');
    return;
  }
  throw new Error(`expected ${code}`);
}

Deno.test('Apple intake payload records not-linked, manual, or exact code state', () => {
  assertDeepEqual(createAppleDeletionPayload({ appleLinked: false }), {
    version: 1,
    appleLinked: false,
    phase: 'not_linked',
  });
  assertDeepEqual(createAppleDeletionPayload({ appleLinked: true }), {
    version: 1,
    appleLinked: true,
    phase: 'manual',
  });
  assertDeepEqual(
    createAppleDeletionPayload({
      appleLinked: true,
      authorizationCode: 'authorization-code',
      expectedAppleSubject: 'apple-subject',
    }),
    {
      version: 1,
      appleLinked: true,
      phase: 'authorization_code',
      authorizationCode: 'authorization-code',
      expectedAppleSubject: 'apple-subject',
    },
  );
});

Deno.test('Apple payload code-to-token transition removes the consumed code', () => {
  const initial = createAppleDeletionPayload({
    appleLinked: true,
    authorizationCode: 'single-use-code',
    expectedAppleSubject: 'apple-subject',
  });
  const transitioned = applePayloadWithRevocationToken(
    initial,
    'durable-revocation-token',
    'refresh_token',
  );
  assertDeepEqual(transitioned, {
    version: 1,
    appleLinked: true,
    phase: 'revocation_token',
    revocationToken: 'durable-revocation-token',
    tokenTypeHint: 'refresh_token',
  });
  assert(
    !JSON.stringify(transitioned).includes('single-use-code') &&
      !JSON.stringify(transitioned).includes('apple-subject'),
    'consumed code and temporary subject binding removed',
  );
});

Deno.test('Apple retained refresh token enters deletion without a one-use code', () => {
  const payload = createAppleDeletionPayloadWithRevocationToken('retained-refresh-token');
  assertDeepEqual(payload, {
    version: 1,
    appleLinked: true,
    phase: 'revocation_token',
    revocationToken: 'retained-refresh-token',
    tokenTypeHint: 'refresh_token',
  });
  for (const invalid of [
    '',
    ' leading',
    'bad\ntoken',
    'x'.repeat(APPLE_REVOCATION_TOKEN_MAX_CHARS + 1),
  ]) {
    assertPayloadError(
      () => createAppleDeletionPayloadWithRevocationToken(invalid),
      'APPLE_DELETION_PAYLOAD_INVALID',
    );
  }
});

Deno.test('Apple payload encoding is canonical and round-trips every phase', () => {
  const payloads = [
    createAppleDeletionPayload({ appleLinked: false }),
    createAppleDeletionPayload({ appleLinked: true }),
    createAppleDeletionPayload({
      appleLinked: true,
      authorizationCode: 'code-1',
      expectedAppleSubject: 'apple-subject-1',
    }),
    applePayloadWithRevocationToken(
      createAppleDeletionPayload({
        appleLinked: true,
        authorizationCode: 'code-2',
        expectedAppleSubject: 'apple-subject-2',
      }),
      'token-2',
      'access_token',
    ),
  ];
  for (const payload of payloads) {
    assertDeepEqual(decodeAppleDeletionPayload(encodeAppleDeletionPayload(payload)), payload);
  }
});

Deno.test(
  'Apple payload decoder rejects noncanonical, extra, contradictory, and malformed values',
  () => {
    const invalid = [
      '{}',
      '{"appleLinked":false,"version":1,"phase":"not_linked"}',
      '{"version":1,"appleLinked":false,"phase":"manual"}',
      '{"version":1,"appleLinked":true,"phase":"not_linked"}',
      '{"version":1,"appleLinked":true,"phase":"manual","extra":true}',
      '{"version":1,"appleLinked":true,"phase":"authorization_code","authorizationCode":"","expectedAppleSubject":"apple-subject"}',
      '{"version":1,"appleLinked":true,"phase":"authorization_code","authorizationCode":"code"}',
      '{"version":1,"appleLinked":true,"phase":"revocation_token","revocationToken":"token","tokenTypeHint":"id_token"}',
      'not-json',
    ];
    for (const value of invalid) {
      assertPayloadError(
        () => decodeAppleDeletionPayload(new TextEncoder().encode(value)),
        'APPLE_DELETION_PAYLOAD_INVALID',
      );
    }
  },
);

Deno.test('Apple payload constructor enforces exact secret bounds and context', () => {
  for (const options of [
    { appleLinked: false, authorizationCode: 'unexpected' },
    {
      appleLinked: true,
      authorizationCode: 'code',
      expectedAppleSubject: ' leading',
    },
    {
      appleLinked: true,
      authorizationCode: 'code',
      expectedAppleSubject: 'x'.repeat(APPLE_SUBJECT_MAX_CHARS + 1),
    },
    { appleLinked: true, authorizationCode: ' leading' },
    { appleLinked: true, authorizationCode: 'bad\ncode' },
    {
      appleLinked: true,
      authorizationCode: 'x'.repeat(APPLE_AUTHORIZATION_CODE_MAX_CHARS + 1),
      expectedAppleSubject: 'apple-subject',
    },
    { appleLinked: true, extra: true },
  ]) {
    assertPayloadError(
      () => createAppleDeletionPayload(options as never),
      'APPLE_DELETION_PAYLOAD_INVALID',
    );
  }
});

Deno.test('Apple payload transition is one-way and token-bounded', () => {
  const manual = createAppleDeletionPayload({ appleLinked: true });
  assertPayloadError(
    () => applePayloadWithRevocationToken(manual, 'token', 'refresh_token'),
    'APPLE_DELETION_PAYLOAD_TRANSITION_INVALID',
  );
  const code = createAppleDeletionPayload({
    appleLinked: true,
    authorizationCode: 'code',
    expectedAppleSubject: 'apple-subject',
  });
  assertPayloadError(
    () =>
      applePayloadWithRevocationToken(
        code,
        'x'.repeat(APPLE_REVOCATION_TOKEN_MAX_CHARS + 1),
        'refresh_token',
      ),
    'APPLE_DELETION_PAYLOAD_TRANSITION_INVALID',
  );
});
