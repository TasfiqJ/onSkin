import {
  defaultHostedSupabaseKey,
  firstConfiguredSupabaseKey,
  type EdgeEnvironmentReader,
} from './supabaseKeyMap.ts';

const denoEnvironment: EdgeEnvironmentReader = (name) => Deno.env.get(name);

/** Hosted maps win; singular and legacy names keep local development usable. */
export function readSupabasePublishableKey(read: EdgeEnvironmentReader = denoEnvironment): string {
  const hosted = defaultHostedSupabaseKey(
    read('SUPABASE_PUBLISHABLE_KEYS'),
    'SUPABASE_PUBLISHABLE_KEYS',
  );
  if (hosted) return hosted;

  const fallback = firstConfiguredSupabaseKey(
    read('SUPABASE_PUBLISHABLE_KEY'),
    read('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY'),
    read('SUPABASE_ANON_KEY'),
  );
  if (!fallback) throw new Error('SUPABASE_PUBLISHABLE_KEY_NOT_CONFIGURED');
  return fallback;
}
