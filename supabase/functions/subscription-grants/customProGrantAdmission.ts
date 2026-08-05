import type { EdgeAppEnvironment } from '../_shared/env.ts';

const LOCAL_SUPABASE_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);

/**
 * The custom full-Pro grant is a local-development exception only. APP_ENV is
 * not sufficient by itself: a hosted project must remain denied even if its
 * environment is accidentally labelled development.
 */
export function customProGrantAllowed(
  appEnvironment: EdgeAppEnvironment,
  supabaseUrl: string | undefined,
): boolean {
  if (appEnvironment !== 'development' || !supabaseUrl) return false;

  try {
    const url = new URL(supabaseUrl);
    return (
      url.protocol === 'http:' &&
      LOCAL_SUPABASE_HOSTS.has(url.hostname.toLowerCase()) &&
      url.port.length > 0 &&
      url.username.length === 0 &&
      url.password.length === 0 &&
      url.pathname === '/' &&
      url.search.length === 0 &&
      url.hash.length === 0
    );
  } catch {
    return false;
  }
}
