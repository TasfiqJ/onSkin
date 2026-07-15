import {
  APPLE_CODE_HMAC_KEY_ENV,
  APPLE_EVENT_HMAC_KEY_ENV,
  APPLE_SUBJECT_HMAC_CURRENT_VERSION_ENV,
  APPLE_SUBJECT_HMAC_KEYS_ENV,
  AppleLifecycleSecretError,
  appleCodeDigest,
  appleEventJtiDigest,
  appleRelayEmailDigest,
  appleSubjectDigest,
  appleSubjectDigestForVersion,
  loadAppleLifecycleSecrets,
} from './appleLifecycleSecrets.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const validEnv: Record<string, string> = {
  [APPLE_SUBJECT_HMAC_CURRENT_VERSION_ENV]: 'h2',
  [APPLE_SUBJECT_HMAC_KEYS_ENV]: JSON.stringify({ h1: '11'.repeat(32), h2: '22'.repeat(32) }),
  [APPLE_CODE_HMAC_KEY_ENV]: '33'.repeat(32),
  [APPLE_EVENT_HMAC_KEY_ENV]: '44'.repeat(32),
};

Deno.test('Apple lifecycle aliases are deterministic, domain-separated HMACs', async () => {
  const secrets = await loadAppleLifecycleSecrets((name) => validEnv[name]);
  const subject = await appleSubjectDigest(secrets, 'apple-subject');
  const code = await appleCodeDigest(secrets, 'apple-subject');
  const jti = await appleEventJtiDigest(secrets, 'apple-subject');
  const relay = await appleRelayEmailDigest(secrets, 'Relay@privaterelay.appleid.com');
  assert(secrets.subjectKeyVersion === 'h2', 'current subject key version');
  assert(secrets.subjectKeys.size === 2, 'bounded previous subject keys are retained');
  for (const digest of [subject, code, jti, relay]) {
    assert(/^[a-f0-9]{64}$/.test(digest), 'digest must be canonical lowercase hex');
  }
  assert(new Set([subject, code, jti, relay]).size === 4, 'purposes must be domain separated');
  assert(
    relay === (await appleRelayEmailDigest(secrets, 'relay@privaterelay.appleid.com')),
    'relay aliases normalize email case',
  );
  assert(
    subject !== (await appleSubjectDigestForVersion(secrets, 'h1', 'apple-subject')),
    'subject aliases are version-bound during key rotation',
  );
});

Deno.test(
  'Apple lifecycle secret loading rejects missing, malformed, or unselected keyrings',
  async () => {
    for (const overrides of [
      { [APPLE_SUBJECT_HMAC_CURRENT_VERSION_ENV]: '' },
      { [APPLE_SUBJECT_HMAC_KEYS_ENV]: '{}' },
      {
        [APPLE_SUBJECT_HMAC_CURRENT_VERSION_ENV]: 'missing',
        [APPLE_SUBJECT_HMAC_KEYS_ENV]: JSON.stringify({ h1: '11'.repeat(32) }),
      },
      { [APPLE_CODE_HMAC_KEY_ENV]: 'AA'.repeat(32) },
      { [APPLE_EVENT_HMAC_KEY_ENV]: '00' },
    ]) {
      try {
        const candidate: Record<string, string | undefined> = { ...validEnv, ...overrides };
        await loadAppleLifecycleSecrets((name) => candidate[name]);
        throw new Error('expected invalid secret configuration');
      } catch (error) {
        assert(error instanceof AppleLifecycleSecretError, 'must fail with stable secret error');
      }
    }
  },
);
