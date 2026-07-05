import { useQuery } from '@tanstack/react-query';

import { localDateString } from '@/features/today/useToday';
import { getPrivateItem, setPrivateItem } from '@/lib/storage/privateKV';

// The skin-cycle anchor (the date the cycle "started"), used to compute which
// night tonight is (docs/02 §5 / docs/03 §5). Set on "Start today"; defaults to
// today so the cycle begins on night 1. (Persisting per-user belongs to the
// routine-builder server persistence. B-SUPABASE.)
const KEY = 'onskin.cycleAnchor';

export async function getCycleAnchor(): Promise<string> {
  try {
    return (await getPrivateItem(KEY)) ?? localDateString();
  } catch {
    return localDateString();
  }
}

export async function setCycleAnchor(iso = localDateString()): Promise<void> {
  try {
    await setPrivateItem(KEY, iso);
  } catch {
    /* best-effort */
  }
}

export function useCycleAnchor() {
  return useQuery({ queryKey: ['cycleAnchor'], queryFn: getCycleAnchor });
}
