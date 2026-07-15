import { useQuery } from '@tanstack/react-query';

import { localDateString } from '@/features/today/useToday';
import {
  runCurrentHealthDataOperation,
  type HealthDataWriteOperationLease,
} from '@/lib/consent/healthDataWriteAdmission';
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
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? text
    : null;
}

async function repairInvalidAnchor(
  lease: HealthDataWriteOperationLease,
  repair: () => Promise<void>,
): Promise<void> {
  try {
    lease.assertCurrent();
    await repair();
    lease.assertCurrent();
  } catch {
    // Repairs are best-effort only for ordinary storage failures. A revoked,
    // replaced, or account-stale operation must still reject.
    lease.assertCurrent();
  }
}

export function getCycleAnchor(): Promise<string> {
  return runCurrentHealthDataOperation(async (lease) => {
    try {
      lease.assertCurrent();
      const raw = await getPrivateItem(KEY);
      lease.assertCurrent();
      if (!raw) {
        const fallback = localDateString();
        lease.assertCurrent();
        return fallback;
      }
      const normalized = normalizeLocalDateISO(raw);
      if (!normalized) {
        await repairInvalidAnchor(lease, () => removePrivateItem(KEY));
        lease.assertCurrent();
        return localDateString();
      }
      if (normalized !== raw) {
        await repairInvalidAnchor(lease, () => setPrivateItem(KEY, normalized));
      }
      lease.assertCurrent();
      return normalized;
    } catch {
      // Preserve the documented local fallback without turning authorization
      // invalidation into a successful read under a replacement lease.
      lease.assertCurrent();
      return localDateString();
    }
  });
}

export function setCycleAnchor(iso = localDateString()): Promise<void> {
  return runCurrentHealthDataOperation(async (lease) => {
    try {
      lease.assertCurrent();
      await setPrivateItem(KEY, normalizeLocalDateISO(iso) ?? localDateString());
      lease.assertCurrent();
    } catch {
      // Best-effort applies only while the operation's original authority is
      // current. Consent/account invalidation must propagate to the caller.
      lease.assertCurrent();
    }
  });
}

export function useCycleAnchor() {
  return useQuery({ queryKey: ['cycleAnchor'], queryFn: getCycleAnchor });
}
