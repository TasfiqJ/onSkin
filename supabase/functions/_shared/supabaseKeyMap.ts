export type EdgeEnvironmentReader = (name: string) => string | undefined;

function invalidMap(name: string): Error {
  return new Error(`${name}_INVALID`);
}

/**
 * Resolves the default key from Supabase's hosted JSON key maps.
 *
 * A missing/blank map allows the documented singular/legacy fallback. Once a
 * map is present, malformed content fails closed instead of silently selecting
 * a lower-priority key. Error messages never include key material.
 */
export function defaultHostedSupabaseKey(raw: string | undefined, name: string): string | null {
  if (!raw?.trim()) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw invalidMap(name);
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw invalidMap(name);
  }

  const entries = Object.entries(parsed as Record<string, unknown>);
  if (
    entries.length === 0 ||
    entries.some(
      ([keyName, value]) =>
        !keyName.trim() || typeof value !== 'string' || value.trim().length === 0,
    )
  ) {
    throw invalidMap(name);
  }

  const defaultKey = (parsed as Record<string, unknown>).default;
  if (typeof defaultKey !== 'string' || !defaultKey.trim()) {
    throw invalidMap(name);
  }
  return defaultKey.trim();
}

export function firstConfiguredSupabaseKey(...values: Array<string | undefined>): string | null {
  for (const value of values) {
    const candidate = value?.trim();
    if (candidate) return candidate;
  }
  return null;
}
