import {
  defaultHostedSupabaseKey,
  firstConfiguredSupabaseKey,
  type EdgeEnvironmentReader,
} from './supabaseKeyMap.ts';

const denoEnvironment: EdgeEnvironmentReader = (name) => Deno.env.get(name);

/**
 * Hosted key maps take precedence over singular and legacy local variables.
 * This helper belongs only in trusted Edge/server code because secret keys
 * bypass Row-Level Security.
 */
export function readSupabaseSecretKey(read: EdgeEnvironmentReader = denoEnvironment): string {
  const hosted = defaultHostedSupabaseKey(read('SUPABASE_SECRET_KEYS'), 'SUPABASE_SECRET_KEYS');
  if (hosted) return hosted;

  const fallback = firstConfiguredSupabaseKey(
    read('SUPABASE_SECRET_KEY'),
    read('SUPABASE_SERVICE_ROLE_KEY'),
  );
  if (!fallback) throw new Error('SUPABASE_SECRET_KEY_NOT_CONFIGURED');
  return fallback;
}
