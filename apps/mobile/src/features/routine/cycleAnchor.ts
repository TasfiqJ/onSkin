import { useQuery } from '@tanstack/react-query';

import { localDateString } from '@/features/today/useToday';
import { getPrivateItem, removePrivateItem, setPrivateItem } from '@/lib/storage/privateKV';

// The skin-cycle anchor (the date the cycle "started"), used to compute which
// night tonight is (docs/02 §5 / docs/03 §5). Set on "Start today"; defaults to
// today so the cycle begins on night 1. (Persisting per-user belongs to the
// routine-builder server persistence. B-SUPABASE.)
const KEY = 'onskin.cycleAnchor';

function normalizeLocalDateISO(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return null;
  const [, y, m, d] = match;
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
    ? text
    : null;
}

export async function getCycleAnchor(): Promise<string> {
  try {
    const raw = await getPrivateItem(KEY);
    if (!raw) return localDateString();
    const normalized = normalizeLocalDateISO(raw);
    if (!normalized) {
      await removePrivateItem(KEY).catch(() => undefined);
      return localDateString();
    }
    if (normalized !== raw) await setPrivateItem(KEY, normalized).catch(() => undefined);
    return normalized;
  } catch {
    return localDateString();
  }
}

export async function setCycleAnchor(iso = localDateString()): Promise<void> {
  try {
    await setPrivateItem(KEY, normalizeLocalDateISO(iso) ?? localDateString());
  } catch {
    /* best-effort */
  }
}

export function useCycleAnchor() {
  return useQuery({ queryKey: ['cycleAnchor'], queryFn: getCycleAnchor });
}
