import { getPrivateItem, removePrivateItem, setPrivateItem } from '@/lib/storage/privateKV';
import { localDateString } from '@/features/today/useToday';

import { applyTolerance, type RampState } from './ramp';

// Local-first retinoid/active ramp state (docs/03 §4). The `active_ramp` table
// (migration 0015) is the deferred server target (B-ROUTINE-PERSIST); this store is
// the v1 source of truth (D-029 pattern, shared with the shelf/photos/cycle/
// completions stores). The plan generates the INITIAL ramp (initRamp); this store
// persists the user-driven changes that were previously dropped on the floor: the
// offer-only step-up and the tolerance de-escalation. Keyed by user_product id.
const KEY = 'onskin.ramp.v1';

export type StoredRamp = RampState & {
  startedAt: string; // ISO local date the ramp began
  lastStepUp: string | null; // ISO local date of the last accepted step-up
};

type Log = Record<string, StoredRamp>; // productId -> ramp

async function load(): Promise<Log> {
  try {
    const raw = await getPrivateItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Log) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function save(log: Log): Promise<void> {
    await setPrivateItem(KEY, JSON.stringify(log));
}

export async function getStoredRamps(): Promise<Log> {
  return load();
}

/** Seed a product's ramp from the generated initial the first time it is seen. */
export async function ensureRamp(productId: string, initial: RampState): Promise<StoredRamp> {
  const log = await load();
  const existing = log[productId];
  if (existing) return existing;
  const seeded: StoredRamp = { ...initial, startedAt: localDateString(), lastStepUp: null };
  log[productId] = seeded;
  await save(log);
  return seeded;
}

/** Accept a step-up offer: +1 night toward target, mark steady, stamp lastStepUp. */
export async function stepUpRamp(productId: string): Promise<void> {
  const log = await load();
  const r = log[productId];
  if (!r) return;
  log[productId] = {
    ...r,
    freqPerWeek: Math.min(r.targetPerWeek, r.freqPerWeek + 1),
    toleranceState: 'steady',
    lastStepUp: localDateString(),
  };
  await save(log);
}

/** Apply the weekly tolerance answer to every stored ramp (de-escalate on irritation,
 *  steady on comfortable, hold on dry) via the pure applyTolerance (docs/03 §4). */
export async function applyToleranceToRamps(
  answer: 'comfortable' | 'a_bit_dry' | 'irritated',
): Promise<void> {
  const log = await load();
  let changed = false;
  for (const [id, r] of Object.entries(log)) {
    const next = applyTolerance(r, answer);
    log[id] = { ...r, ...next };
    changed = true;
  }
  if (changed) await save(log);
}

/** Test/seed reset. */
export async function clearRamps(): Promise<void> {
  await removePrivateItem(KEY);
}
