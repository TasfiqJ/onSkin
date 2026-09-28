import { getPrivateItem, updatePrivateItem } from '@/lib/storage/privateKV';
import {
  assertHealthDataWriteLease,
  runCurrentHealthDataOperation,
  type HealthDataWriteLease,
} from '@/lib/consent/healthDataWriteAdmission';

import type { GeneratedPlan, PlanStep } from './generate';

const STORAGE_KEY = 'layerwell.routineOrder.v1';

export const ROUTINE_ORDER_INVALID = 'ROUTINE_ORDER_INVALID';
export const ROUTINE_ORDER_UNSUPPORTED_VERSION = 'ROUTINE_ORDER_UNSUPPORTED_VERSION';

export const ROUTINE_ORDER_QUERY_KEY = ['routineOrder', 'v1'] as const;

/** In-memory only: old owners/consent generations cannot supply a new editor. */
export function routineOrderQueryKeyForLease(lease?: HealthDataWriteLease) {
  return [
    ...ROUTINE_ORDER_QUERY_KEY,
    lease?.accountGeneration ?? 'closed',
    lease?.generation ?? 'closed',
  ] as const;
}

export type RoutineOrderPhase = 'am' | 'pm';

export type RoutineOrderOverrides = {
  schemaVersion: 1;
  am: string[];
  pm: string[];
};

export type RoutineOrderSaveTransaction = {
  previous: RoutineOrderOverrides;
  next: RoutineOrderOverrides;
};

type NormalizedOverrides = {
  value: RoutineOrderOverrides;
  changed: boolean;
};

function emptyOverrides(): RoutineOrderOverrides {
  return { schemaVersion: 1, am: [], pm: [] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeIds(value: unknown): { ids: string[]; changed: boolean } | null {
  if (!Array.isArray(value)) return null;

  const ids: string[] = [];
  const seen = new Set<string>();
  let changed = false;

  for (const item of value) {
    if (typeof item !== 'string') {
      changed = true;
      continue;
    }

    const id = item.trim();
    if (!id || seen.has(id)) {
      changed = true;
      continue;
    }

    if (id !== item) changed = true;
    seen.add(id);
    ids.push(id);
  }

  return { ids, changed };
}

function normalizeOverrides(value: unknown): NormalizedOverrides | null {
  if (!isRecord(value)) return null;
  if (value.schemaVersion !== undefined && value.schemaVersion !== 1) return null;

  const am = normalizeIds(value.am ?? []);
  const pm = normalizeIds(value.pm ?? []);
  if (!am || !pm) return null;

  const normalized: RoutineOrderOverrides = {
    schemaVersion: 1,
    am: am.ids,
    pm: pm.ids,
  };

  return {
    value: normalized,
    changed:
      am.changed ||
      pm.changed ||
      value.schemaVersion !== 1 ||
      JSON.stringify(value) !== JSON.stringify(normalized),
  };
}

function validateIdsForWrite(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;

  const ids: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== 'string' || item.length === 0 || item.trim() !== item || seen.has(item)) {
      return null;
    }
    seen.add(item);
    ids.push(item);
  }
  return ids;
}

function validateOverridesForWrite(value: unknown): RoutineOrderOverrides {
  if (isRecord(value) && typeof value.schemaVersion === 'number' && value.schemaVersion > 1) {
    throw new Error(ROUTINE_ORDER_UNSUPPORTED_VERSION);
  }
  if (!isRecord(value)) throw new Error(ROUTINE_ORDER_INVALID);

  const keys = Object.keys(value).sort();
  if (
    keys.length !== 3 ||
    keys[0] !== 'am' ||
    keys[1] !== 'pm' ||
    keys[2] !== 'schemaVersion' ||
    value.schemaVersion !== 1
  ) {
    throw new Error(ROUTINE_ORDER_INVALID);
  }

  const am = validateIdsForWrite(value.am);
  const pm = validateIdsForWrite(value.pm);
  if (!am || !pm) throw new Error(ROUTINE_ORDER_INVALID);

  return { schemaVersion: 1, am, pm };
}

function validateSaveTransaction(value: unknown): RoutineOrderSaveTransaction {
  if (!isRecord(value)) throw new Error(ROUTINE_ORDER_INVALID);
  const keys = Object.keys(value).sort();
  if (keys.length !== 2 || keys[0] !== 'next' || keys[1] !== 'previous') {
    throw new Error(ROUTINE_ORDER_INVALID);
  }
  return {
    previous: validateOverridesForWrite(value.previous),
    next: validateOverridesForWrite(value.next),
  };
}

function hasOverrides(value: RoutineOrderOverrides): boolean {
  return value.am.length > 0 || value.pm.length > 0;
}

function decodeOverrides(raw: string): RoutineOrderOverrides {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error(ROUTINE_ORDER_INVALID);
  }
  // Current-schema validation is structural, not JSON property-order equality.
  // This also rejects partial/current records instead of repairing them on read.
  if (isRecord(parsed) && parsed.schemaVersion !== undefined) {
    return validateOverridesForWrite(parsed);
  }
  // Recognize only the historical AM/PM envelope. Keep its existing ID cleanup
  // (trim/deduplicate/filter) in memory; reads never migrate or delete bytes.
  if (
    !isRecord(parsed) ||
    (!('am' in parsed) && !('pm' in parsed)) ||
    Object.keys(parsed).some((key) => key !== 'am' && key !== 'pm')
  ) {
    throw new Error(ROUTINE_ORDER_INVALID);
  }
  const normalized = normalizeOverrides(parsed);
  if (!normalized) throw new Error(ROUTINE_ORDER_INVALID);
  return normalized.value;
}

export function loadRoutineOrderOverrides(
  expectedLease?: HealthDataWriteLease,
): Promise<RoutineOrderOverrides> {
  return runCurrentHealthDataOperation(async (lease) => {
    if (expectedLease) assertHealthDataWriteLease(expectedLease);
    lease.assertCurrent();
    const raw = await getPrivateItem(STORAGE_KEY);
    lease.assertCurrent();
    const overrides = raw === null ? emptyOverrides() : decodeOverrides(raw);
    lease.assertCurrent();
    return overrides;
  });
}

export async function saveRoutineOrderOverrides(
  transaction: RoutineOrderSaveTransaction,
  expectedLease?: HealthDataWriteLease,
): Promise<RoutineOrderOverrides> {
  const { previous, next } = validateSaveTransaction(transaction);
  const changed = {
    am: !sameIds(previous.am, next.am),
    pm: !sameIds(previous.pm, next.pm),
  };

  return runCurrentHealthDataOperation(async (lease) => {
    // Bind an editor's original authority, not whichever account is active now.
    if (expectedLease) assertHealthDataWriteLease(expectedLease);
    let committed: RoutineOrderOverrides | null = null;
    lease.assertCurrent();
    await updatePrivateItem(STORAGE_KEY, (current) => {
      lease.assertCurrent();
      const latest = current === null ? emptyOverrides() : decodeOverrides(current);
      committed = {
        schemaVersion: 1,
        am: changed.am ? next.am : latest.am,
        pm: changed.pm ? next.pm : latest.pm,
      };
      lease.assertCurrent();
      return hasOverrides(committed) ? JSON.stringify(committed) : null;
    });
    lease.assertCurrent();
    if (!committed) throw new Error(ROUTINE_ORDER_INVALID);
    return committed;
  });
}

function stepIds(steps: readonly PlanStep[]): string[] {
  return steps.map((step) => step.productId);
}

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

/**
 * Keeps the user's relative order for known products. Newly generated products
 * enter beside their nearest canonical predecessor (or successor when first),
 * so shelf changes do not discard the saved order or strand additions at random.
 */
export function reconcileRoutineSteps(
  canonicalSteps: readonly PlanStep[],
  overrideIds: readonly string[],
): PlanStep[] {
  if (overrideIds.length === 0) return canonicalSteps as PlanStep[];

  const stepById = new Map(canonicalSteps.map((step) => [step.productId, step] as const));
  const orderedIds: string[] = [];
  const present = new Set<string>();

  for (const id of overrideIds) {
    if (!stepById.has(id) || present.has(id)) continue;
    orderedIds.push(id);
    present.add(id);
  }

  const canonicalIds = stepIds(canonicalSteps);
  for (let index = 0; index < canonicalIds.length; index += 1) {
    const id = canonicalIds[index]!;
    if (present.has(id)) continue;

    let predecessor: string | null = null;
    for (let candidate = index - 1; candidate >= 0; candidate -= 1) {
      const candidateId = canonicalIds[candidate]!;
      if (present.has(candidateId)) {
        predecessor = candidateId;
        break;
      }
    }

    if (predecessor) {
      orderedIds.splice(orderedIds.indexOf(predecessor) + 1, 0, id);
    } else {
      const successor = canonicalIds
        .slice(index + 1)
        .find((candidateId) => present.has(candidateId));
      if (successor) orderedIds.splice(orderedIds.indexOf(successor), 0, id);
      else orderedIds.push(id);
    }
    present.add(id);
  }

  if (sameIds(orderedIds, canonicalIds)) return canonicalSteps as PlanStep[];

  return orderedIds.map((id, index) => ({
    ...stepById.get(id)!,
    order: (index + 1) * 10,
  }));
}

export function routineOrderOverrideForPhase(
  canonicalSteps: readonly PlanStep[],
  editedSteps: readonly PlanStep[],
  previousOverrideIds: readonly string[] = [],
  activeProductIds: readonly string[] = canonicalSteps.map((step) => step.productId),
): string[] {
  const canonicalIds = stepIds(canonicalSteps);
  const editedIds = stepIds(editedSteps);
  const activeIds = new Set(activeProductIds);
  const canonicalIdSet = new Set(canonicalIds);
  const hiddenIds = new Set(
    previousOverrideIds.filter((id) => activeIds.has(id) && !canonicalIdSet.has(id)),
  );

  if (hiddenIds.size === 0) return sameIds(canonicalIds, editedIds) ? [] : editedIds;

  // Keep temporarily safety/cadence-excluded products in their prior ordinal
  // slots while replacing every visible slot with the user's current ordering.
  const retainedPrior = previousOverrideIds.filter(
    (id, index, all) => activeIds.has(id) && all.indexOf(id) === index,
  );
  const next: string[] = [];
  let visibleIndex = 0;

  for (const id of retainedPrior) {
    if (hiddenIds.has(id)) {
      next.push(id);
    } else if (canonicalIdSet.has(id) && visibleIndex < editedIds.length) {
      next.push(editedIds[visibleIndex]!);
      visibleIndex += 1;
    }
  }
  next.push(...editedIds.slice(visibleIndex));
  return next;
}

export function applyRoutineOrderOverrides(
  plan: GeneratedPlan,
  overrides: RoutineOrderOverrides,
): GeneratedPlan {
  const am = reconcileRoutineSteps(plan.am, overrides.am);
  const pm = reconcileRoutineSteps(plan.pm, overrides.pm);
  return am === plan.am && pm === plan.pm ? plan : { ...plan, am, pm };
}
