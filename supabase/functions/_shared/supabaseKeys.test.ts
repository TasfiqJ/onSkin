import { readSupabasePublishableKey } from './supabasePublishableKey.ts';
import { readSupabaseSecretKey } from './supabaseSecretKey.ts';
import type { EdgeEnvironmentReader } from './supabaseKeyMap.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function environment(values: Record<string, string | undefined>): EdgeEnvironmentReader {
  return (name) => values[name];
}

function assertThrowsCode(run: () => unknown, expected: string, secret?: string): void {
  let thrown: unknown;
  try {
    run();
  } catch (error) {
    thrown = error;
  }
  assert(thrown instanceof Error, `expected ${expected} to be thrown.`);
  assert(thrown.message === expected, `expected ${expected}, got ${thrown.message}.`);
  if (secret) assert(!thrown.message.includes(secret), 'error message leaked key material.');
}

Deno.test('hosted Supabase key maps take priority and select only default', () => {
  const publishable = readSupabasePublishableKey(
    environment({
      SUPABASE_PUBLISHABLE_KEYS: JSON.stringify({
        default: 'sb_publishable_hosted',
        mobile: 'sb_publishable_mobile',
      }),
      SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_singular',
      SUPABASE_ANON_KEY: 'legacy-anon',
    }),
  );
  const secret = readSupabaseSecretKey(
    environment({
      SUPABASE_SECRET_KEYS: JSON.stringify({
        default: 'sb_secret_hosted',
        internal: 'sb_secret_internal',
      }),
      SUPABASE_SECRET_KEY: 'sb_secret_singular',
      SUPABASE_SERVICE_ROLE_KEY: 'legacy-service-role',
    }),
  );

  assert(publishable === 'sb_publishable_hosted', 'hosted publishable default must win.');
  assert(secret === 'sb_secret_hosted', 'hosted secret default must win.');
});

Deno.test('singular and legacy Supabase keys remain safe local fallbacks', () => {
  assert(
    readSupabasePublishableKey(
      environment({
        SUPABASE_PUBLISHABLE_KEY: ' sb_publishable_local ',
        EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_expo',
        SUPABASE_ANON_KEY: 'legacy-anon',
      }),
    ) === 'sb_publishable_local',
    'singular publishable key must precede local/legacy names.',
  );
  assert(
    readSupabasePublishableKey(
      environment({ EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_expo' }),
    ) === 'sb_publishable_expo',
    'Expo local publishable fallback must remain supported.',
  );
  assert(
    readSupabasePublishableKey(environment({ SUPABASE_ANON_KEY: 'legacy-anon' })) === 'legacy-anon',
    'legacy anon key must remain the last publishable fallback.',
  );
  assert(
    readSupabaseSecretKey(
      environment({
        SUPABASE_SECRET_KEY: ' sb_secret_local ',
        SUPABASE_SERVICE_ROLE_KEY: 'legacy-service-role',
      }),
    ) === 'sb_secret_local',
    'singular secret key must precede the legacy service-role key.',
  );
  assert(
    readSupabaseSecretKey(environment({ SUPABASE_SERVICE_ROLE_KEY: 'legacy-service-role' })) ===
      'legacy-service-role',
    'legacy service-role fallback must remain supported.',
  );
});

Deno.test('present but malformed hosted maps fail closed without leaking keys', () => {
  const secret = 'sb_secret_must_not_leak';
  for (const value of [
    '{',
    '[]',
    '{}',
    JSON.stringify({ internal: secret }),
    JSON.stringify({ default: '' }),
    JSON.stringify({ default: secret, internal: 42 }),
  ]) {
    assertThrowsCode(
      () =>
        readSupabaseSecretKey(
          environment({
            SUPABASE_SECRET_KEYS: value,
            SUPABASE_SECRET_KEY: 'must-not-silently-fallback',
          }),
        ),
      'SUPABASE_SECRET_KEYS_INVALID',
      secret,
    );
  }

  assertThrowsCode(
    () =>
      readSupabasePublishableKey(
        environment({
          SUPABASE_PUBLISHABLE_KEYS: JSON.stringify({ mobile: 'sb_publishable_mobile' }),
          SUPABASE_PUBLISHABLE_KEY: 'must-not-silently-fallback',
        }),
      ),
    'SUPABASE_PUBLISHABLE_KEYS_INVALID',
  );
});

Deno.test('missing configuration fails closed and public values cannot become admin keys', () => {
  assertThrowsCode(
    () => readSupabasePublishableKey(environment({})),
    'SUPABASE_PUBLISHABLE_KEY_NOT_CONFIGURED',
  );
  assertThrowsCode(
    () =>
      readSupabaseSecretKey(
        environment({ EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_public_only' }),
      ),
    'SUPABASE_SECRET_KEY_NOT_CONFIGURED',
  );
});
