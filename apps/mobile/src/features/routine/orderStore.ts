import { getPrivateItem, updatePrivateItem } from '@/lib/storage/privateKV';

import type { GeneratedPlan, PlanStep } from './generate';

const STORAGE_KEY = 'routinekind.routineOrder.v1';

export const ROUTINE_ORDER_INVALID = 'ROUTINE_ORDER_INVALID';
export const ROUTINE_ORDER_UNSUPPORTED_VERSION = 'ROUTINE_ORDER_UNSUPPORTED_VERSION';

export const ROUTINE_ORDER_QUERY_KEY = ['routineOrder', 'v1'] as const;

export type RoutineOrderPhase = 'am' | 'pm';

export type RoutineOrderOverrides = {
  schemaVersion: 1;
  am: string[];
  pm: string[];
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
  if (isRecord(parsed) && typeof parsed.schemaVersion === 'number' && parsed.schemaVersion > 1) {
    throw new Error(ROUTINE_ORDER_UNSUPPORTED_VERSION);
  }
  const normalized = normalizeOverrides(parsed);
  if (!normalized) throw new Error(ROUTINE_ORDER_INVALID);
  if (isRecord(parsed) && parsed.schemaVersion === 1 && normalized.changed) {
    throw new Error(ROUTINE_ORDER_INVALID);
  }
  return normalized.value;
}

export async function loadRoutineOrderOverrides(): Promise<RoutineOrderOverrides> {
  const raw = await getPrivateItem(STORAGE_KEY);
  return raw === null ? emptyOverrides() : decodeOverrides(raw);
}

export async function saveRoutineOrderOverrides(
  value: RoutineOrderOverrides,
): Promise<RoutineOrderOverrides> {
  const normalized = normalizeOverrides(value);
  const next = normalized?.value ?? emptyOverrides();
  await updatePrivateItem(STORAGE_KEY, (current) => {
    if (current !== null) decodeOverrides(current);
    return hasOverrides(next) ? JSON.stringify(next) : null;
  });
  return next;
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
