import { getPrivateItem, removePrivateItem, setPrivateItem } from '@/lib/storage/privateKV';

export { conflictKey } from './conflictIdentity';

// Persisted "use together anyway" overrides (docs/03 §7, Recommendation 7): once a
// user overrides a conflict, the app must NOT re-nag. routine_conflicts is the
// server mirror (B-SUPABASE / B-ROUTINE-PERSIST); this local-first set makes the
// choice stick offline and immediately, honouring the conflict sheet's promise
// ("your choice is saved, we won't re-nag"). Mirrors the app's other local stores.
const KEY = 'onskin.conflict.overrides';

function normalizeKeys(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(value.filter((key): key is string => typeof key === 'string' && key.length > 0)),
  ];
}

function didNormalizeKeys(value: unknown, normalized: readonly string[]): boolean {
  return (
    !Array.isArray(value) ||
    value.length !== normalized.length ||
    normalized.some((key, index) => value[index] !== key)
  );
}

export async function getOverriddenKeys(): Promise<Set<string>> {
  let raw: string | null = null;
  try {
    raw = await getPrivateItem(KEY);
  } catch {
    return new Set();
  }
  if (!raw) return new Set();
  try {
    const parsed: unknown = JSON.parse(raw);
    const normalized = normalizeKeys(parsed);
    if (didNormalizeKeys(parsed, normalized)) {
      if (normalized.length > 0)
        await setPrivateItem(KEY, JSON.stringify(normalized)).catch(() => undefined);
      else await removePrivateItem(KEY).catch(() => undefined);
    }
    return new Set(normalized);
  } catch {
    await removePrivateItem(KEY).catch(() => undefined);
    return new Set();
  }
}

export async function setConflictOverride(key: string, overridden: boolean): Promise<void> {
  const keys = await getOverriddenKeys();
  if (overridden) keys.add(key);
  else keys.delete(key);
  await setPrivateItem(KEY, JSON.stringify([...keys]));
}
