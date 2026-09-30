import { localDateString } from '@/features/today/useToday';
import {
  assertHealthDataWriteLease,
  HEALTH_DATA_WRITE_ADMISSION_CLOSED,
} from '@/lib/consent/healthDataWriteAdmission';
import {
  activeHealthProcessingLeaseSnapshot,
  subscribeActiveHealthProcessingLeaseChanges,
  type ActiveHealthProcessingLeaseSnapshot,
} from '@/lib/consent/healthProcessingEpoch';

import { loadCycleConfig, type CycleConfig } from './cycleStore';

export const CYCLE_CONFIG_DAY_CHANGED = 'CYCLE_CONFIG_DAY_CHANGED';

export type CycleConfigAuthority = ActiveHealthProcessingLeaseSnapshot &
  Readonly<{ ownerUserId: string; accountGeneration: number }>;

/** Return the actual stable storage-authority object, not a new render token. */
export function cycleConfigAuthoritySnapshot(): CycleConfigAuthority | null {
  const active = activeHealthProcessingLeaseSnapshot();
  if (active === null || active.ownerUserId === null || active.accountGeneration === null) {
    return null;
  }
  return active as CycleConfigAuthority;
}

export function closedCycleConfigAuthoritySnapshot(): null {
  return null;
}

export function assertCycleConfigAuthority(
  authority: CycleConfigAuthority | null,
): asserts authority is CycleConfigAuthority {
  if (authority === null) throw new Error(HEALTH_DATA_WRITE_ADMISSION_CLOSED);
  assertHealthDataWriteLease(authority);
}

/** Expiry itself is not an epoch-module notification; also schedule that edge. */
export function subscribeCycleConfigAuthorityChanges(notify: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;
  const armExpiry = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    const active = cycleConfigAuthoritySnapshot();
    if (active?.expiresAt == null) return;
    timer = setTimeout(() => {
      timer = null;
      if (disposed) return;
      notify();
      armExpiry();
    }, Math.min(2_147_483_647, Math.max(1, active.expiresAt - Date.now())));
  };
  const unsubscribe = subscribeActiveHealthProcessingLeaseChanges(() => {
    if (disposed) return;
    armExpiry();
    notify();
  });
  armExpiry();
  return () => {
    disposed = true;
    unsubscribe();
    if (timer !== null) clearTimeout(timer);
  };
}

export function cycleConfigQueryScope(authority: CycleConfigAuthority) {
  return [
    'cycleConfig',
    authority.ownerUserId,
    authority.accountGeneration,
    authority.generation,
    authority.epoch,
  ] as const;
}

export function cycleConfigQueryKey(authority: CycleConfigAuthority, day: string) {
  return [...cycleConfigQueryScope(authority), day] as const;
}

export async function readCycleConfigForAuthority(
  authority: CycleConfigAuthority | null,
  day: string,
): Promise<CycleConfig> {
  assertCycleConfigAuthority(authority);
  if (day !== localDateString()) throw new Error(CYCLE_CONFIG_DAY_CHANGED);
  const config = await loadCycleConfig();
  assertCycleConfigAuthority(authority);
  if (day !== localDateString()) throw new Error(CYCLE_CONFIG_DAY_CHANGED);
  return config;
}

// Storage already serializes transforms. This narrower queue additionally
// orders each hook mutation's cancellation/read-back/cache publication. An old
// generation can neither block nor release a successor generation's queue.
const publicationTails = new Map<string, Promise<void>>();

export async function serializeCycleConfigPublication<T>(
  authority: CycleConfigAuthority,
  operation: () => Promise<T>,
): Promise<T> {
  const key = JSON.stringify(cycleConfigQueryScope(authority));
  const ready = (publicationTails.get(key) ?? Promise.resolve()).catch(() => undefined);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = ready.then(() => gate);
  publicationTails.set(key, tail);
  await ready;
  try {
    assertCycleConfigAuthority(authority);
    return await operation();
  } finally {
    release();
    if (publicationTails.get(key) === tail) publicationTails.delete(key);
  }
}
