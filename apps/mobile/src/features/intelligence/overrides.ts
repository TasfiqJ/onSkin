import AsyncStorage from '@react-native-async-storage/async-storage';

import type { DetectedConflict } from './engine';

// Persisted "use together anyway" overrides (docs/03 §7, Recommendation 7): once a
// user overrides a conflict, the app must NOT re-nag. routine_conflicts is the
// server mirror (B-SUPABASE / B-ROUTINE-PERSIST); this local-first set makes the
// choice stick offline and immediately, honouring the conflict sheet's promise
// ("your choice is saved, we won't re-nag"). Mirrors the app's other local stores.
const KEY = 'onskin.conflict.overrides';

/** Stable identity for a conflict: the rule + the unordered product pair. */
export function conflictKey(
  c: Pick<DetectedConflict, 'productAId' | 'productBId'> & { rule: { id: string } },
): string {
  const pair = [c.productAId ?? '', c.productBId ?? ''].sort().join('+');
  return `${c.rule.id}:${pair}`;
}

export async function getOverriddenKeys(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export async function setConflictOverride(key: string, overridden: boolean): Promise<void> {
  const keys = await getOverriddenKeys();
  if (overridden) keys.add(key);
  else keys.delete(key);
  await AsyncStorage.setItem(KEY, JSON.stringify([...keys]));
}
