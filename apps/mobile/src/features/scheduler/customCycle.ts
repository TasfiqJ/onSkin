import type { ActiveClass } from './classes';
import {
  allowedCycleOccurrences,
  minimumCycleLengthForOccurrences as minimumBoundedCycleLength,
} from './cadence';
import type { AmItem, Cycle, NightSlot, SchedulerSlot } from './orchestrate';

export const CUSTOM_CYCLE_SCHEMA_VERSION = 1 as const;
export const MIN_CUSTOM_CYCLE_LENGTH = 1;
export const MAX_CUSTOM_CYCLE_LENGTH = 14;

export type CustomCycleNight = {
  productId: string | null;
};

export type CustomCycleDefinition = {
  schemaVersion: typeof CUSTOM_CYCLE_SCHEMA_VERSION;
  lengthNights: number;
  nights: CustomCycleNight[];
};

export type CycleEditorActive = {
  id: string;
  name: string;
  className: Extract<ActiveClass, 'aha' | 'bha' | 'retinoid'>;
  eligible: boolean;
  staged: boolean;
  maxFrequencyPerWeek: number;
};

export type CustomCycleEditBlock = 'active_unavailable' | 'cadence_limit' | 'recovery_required';

export type CustomCycleEditResult = {
  definition: CustomCycleDefinition;
  blocked: CustomCycleEditBlock | null;
};

export type CustomCycleLimitViolation = {
  productId: string;
  requestedOccurrences: number;
  allowedOccurrences: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeProductId(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  const id = value.trim();
  return id && id.length <= 256 ? id : undefined;
}

function cloneDefinition(definition: CustomCycleDefinition): CustomCycleDefinition {
  return {
    schemaVersion: CUSTOM_CYCLE_SCHEMA_VERSION,
    lengthNights: definition.lengthNights,
    nights: definition.nights.map((night) => ({ productId: night.productId })),
  };
}

function withRequiredRecovery(nights: CustomCycleNight[]): CustomCycleNight[] {
  if (nights.some((night) => night.productId === null)) return nights;
  if (nights.length < MAX_CUSTOM_CYCLE_LENGTH) return [...nights, { productId: null }];
  return nights.map((night, index) => (index === nights.length - 1 ? { productId: null } : night));
}

function definitionFromNights(nights: CustomCycleNight[]): CustomCycleDefinition {
  const safeNights = withRequiredRecovery(nights);
  return {
    schemaVersion: CUSTOM_CYCLE_SCHEMA_VERSION,
    lengthNights: safeNights.length,
    nights: safeNights,
  };
}

export function normalizeCustomCycleDefinition(value: unknown): CustomCycleDefinition | null {
  if (!isRecord(value) || value.schemaVersion !== CUSTOM_CYCLE_SCHEMA_VERSION) return null;
  if (
    typeof value.lengthNights !== 'number' ||
    !Number.isInteger(value.lengthNights) ||
    value.lengthNights < MIN_CUSTOM_CYCLE_LENGTH ||
    value.lengthNights > MAX_CUSTOM_CYCLE_LENGTH ||
    !Array.isArray(value.nights) ||
    value.nights.length !== value.lengthNights
  ) {
    return null;
  }

  const nights: CustomCycleNight[] = [];
  for (const rawNight of value.nights) {
    if (!isRecord(rawNight)) return null;
    const productId = normalizeProductId(rawNight.productId);
    if (productId === undefined) return null;
    nights.push({ productId });
  }

  if (!nights.some((night) => night.productId === null)) return null;
  return definitionFromNights(nights);
}

export function emptyCustomCycleDefinition(): CustomCycleDefinition {
  return definitionFromNights([{ productId: null }]);
}

export function customCycleFromCycle(cycle: Cycle | null): CustomCycleDefinition {
  if (!cycle || cycle.nights.length === 0) return emptyCustomCycleDefinition();
  const nights = cycle.nights
    .slice(0, MAX_CUSTOM_CYCLE_LENGTH)
    .map((night) => ({ productId: night.productId }));
  return definitionFromNights(nights);
}

export function resizeCustomCycle(
  definition: CustomCycleDefinition,
  requestedLength: number,
): CustomCycleDefinition {
  const length = Math.max(
    MIN_CUSTOM_CYCLE_LENGTH,
    Math.min(MAX_CUSTOM_CYCLE_LENGTH, Math.round(requestedLength)),
  );
  const nights = definition.nights.slice(0, length).map((night) => ({ ...night }));
  while (nights.length < length) nights.push({ productId: null });
  if (!nights.some((night) => night.productId === null)) {
    nights[nights.length - 1] = { productId: null };
  }
  return definitionFromNights(nights);
}

export function customCycleProductIds(definition: CustomCycleDefinition): string[] {
  return [
    ...new Set(definition.nights.flatMap((night) => (night.productId ? [night.productId] : []))),
  ];
}

export function customCycleOccurrences(
  definition: CustomCycleDefinition,
  productId: string,
): number {
  return definition.nights.filter((night) => night.productId === productId).length;
}

export function approximateWeeklyFrequency(occurrences: number, lengthNights: number): number {
  if (lengthNights <= 0 || occurrences <= 0) return 0;
  return (occurrences * 7) / lengthNights;
}

export function allowedCustomCycleOccurrences(
  maxFrequencyPerWeek: number,
  lengthNights: number,
): number {
  return allowedCycleOccurrences(maxFrequencyPerWeek, lengthNights);
}

/** Smallest valid cycle where the requested occurrences stay within a weekly ceiling. */
export function minimumCycleLengthForOccurrences(
  occurrences: number,
  maxFrequencyPerWeek: number,
): number | null {
  return minimumBoundedCycleLength(occurrences, maxFrequencyPerWeek, {
    minLength: MIN_CUSTOM_CYCLE_LENGTH,
    maxLength: MAX_CUSTOM_CYCLE_LENGTH,
  });
}

export function customCycleLimitViolations(
  definition: CustomCycleDefinition,
  actives: readonly CycleEditorActive[],
): CustomCycleLimitViolation[] {
  return actives.flatMap((active) => {
    const requestedOccurrences = customCycleOccurrences(definition, active.id);
    const allowedOccurrences = allowedCustomCycleOccurrences(
      active.maxFrequencyPerWeek,
      definition.lengthNights,
    );
    return requestedOccurrences > allowedOccurrences
      ? [{ productId: active.id, requestedOccurrences, allowedOccurrences }]
      : [];
  });
}

export function fitCustomCycleToCadence(
  definition: CustomCycleDefinition,
  actives: readonly CycleEditorActive[],
): CustomCycleDefinition {
  let next = cloneDefinition(definition);
  while (
    customCycleLimitViolations(next, actives).length > 0 &&
    next.lengthNights < MAX_CUSTOM_CYCLE_LENGTH
  ) {
    next = definitionFromNights([...next.nights, { productId: null }]);
  }

  const activeById = new Map(actives.map((active) => [active.id, active] as const));
  const kept = new Map<string, number>();
  return definitionFromNights(
    next.nights.map((night) => {
      if (!night.productId) return { productId: null };
      const active = activeById.get(night.productId);
      if (!active) return { ...night };
      const used = kept.get(active.id) ?? 0;
      const allowed = allowedCustomCycleOccurrences(active.maxFrequencyPerWeek, next.lengthNights);
      if (used >= allowed) return { productId: null };
      kept.set(active.id, used + 1);
      return { ...night };
    }),
  );
}

export function pruneMissingCustomCycleProducts(
  definition: CustomCycleDefinition,
  knownProductIds: readonly string[],
): CustomCycleDefinition {
  const known = new Set(knownProductIds);
  return definitionFromNights(
    definition.nights.map((night) => ({
      productId: night.productId && known.has(night.productId) ? night.productId : null,
    })),
  );
}

export function assignCustomCycleNight(
  definition: CustomCycleDefinition,
  index: number,
  productId: string | null,
  actives: readonly CycleEditorActive[],
): CustomCycleEditResult {
  if (index < 0 || index >= definition.lengthNights) {
    return { definition: cloneDefinition(definition), blocked: 'active_unavailable' };
  }

  const active = productId ? actives.find((item) => item.id === productId) : null;
  if (productId && (!active || !active.eligible)) {
    return { definition: cloneDefinition(definition), blocked: 'active_unavailable' };
  }

  const nights = definition.nights.map((night) => ({ ...night }));
  nights[index] = { productId };
  if (productId && !nights.some((night) => night.productId === null)) {
    if (nights.length >= MAX_CUSTOM_CYCLE_LENGTH) {
      return { definition: cloneDefinition(definition), blocked: 'recovery_required' };
    }
    nights.push({ productId: null });
  }

  const candidate = definitionFromNights(nights);
  if (active) {
    const requested = customCycleOccurrences(candidate, active.id);
    const allowed = allowedCustomCycleOccurrences(
      active.maxFrequencyPerWeek,
      candidate.lengthNights,
    );
    if (requested > allowed) {
      return { definition: cloneDefinition(definition), blocked: 'cadence_limit' };
    }
  }

  return { definition: candidate, blocked: null };
}

export function adjustCustomCycleFrequency(
  definition: CustomCycleDefinition,
  active: CycleEditorActive,
  delta: -1 | 1,
): CustomCycleEditResult {
  if (delta < 0) {
    const index = definition.nights.findLastIndex((night) => night.productId === active.id);
    if (index < 0) return { definition: cloneDefinition(definition), blocked: null };
    return assignCustomCycleNight(definition, index, null, [active]);
  }

  if (!active.eligible) {
    return { definition: cloneDefinition(definition), blocked: 'active_unavailable' };
  }

  const target = customCycleOccurrences(definition, active.id) + 1;
  const nights = definition.nights.map((night) => ({ ...night }));
  while (
    (allowedCustomCycleOccurrences(active.maxFrequencyPerWeek, nights.length) < target ||
      nights.filter((night) => night.productId === null).length < 2) &&
    nights.length < MAX_CUSTOM_CYCLE_LENGTH
  ) {
    nights.push({ productId: null });
  }

  if (
    allowedCustomCycleOccurrences(active.maxFrequencyPerWeek, nights.length) < target ||
    nights.filter((night) => night.productId === null).length < 2
  ) {
    return { definition: cloneDefinition(definition), blocked: 'cadence_limit' };
  }

  const recoveryIndex = nights.findIndex((night) => night.productId === null);
  nights[recoveryIndex] = { productId: active.id };
  return { definition: definitionFromNights(nights), blocked: null };
}

function slotForClass(className: CycleEditorActive['className']): SchedulerSlot {
  return className === 'retinoid' ? 'retinoid' : 'exfoliate';
}

export function applyCustomCycleDefinition(options: {
  definition: CustomCycleDefinition;
  actives: readonly CycleEditorActive[];
  amDaily: readonly AmItem[];
  notes: readonly string[];
}): Cycle {
  const { definition, actives, amDaily, notes } = options;
  const activeById = new Map(actives.map((active) => [active.id, active] as const));
  const used = new Map<string, number>();

  const nights: NightSlot[] = definition.nights.map((night, index) => {
    if (!night.productId) {
      return {
        index,
        slot: 'recover',
        productId: null,
        productName: null,
        className: null,
        authoredProductId: null,
        reconciliationReason: 'authored_recovery',
      };
    }

    const active = activeById.get(night.productId);
    const reconciliationReason = !active
      ? 'missing'
      : !active.eligible
        ? 'safety'
        : active.staged
          ? 'staged'
          : null;
    if (!active || reconciliationReason) {
      return {
        index,
        slot: 'recover',
        productId: null,
        productName: null,
        className: null,
        authoredProductId: night.productId,
        reconciliationReason,
      };
    }

    const applied = used.get(active.id) ?? 0;
    const allowed = allowedCustomCycleOccurrences(
      active.maxFrequencyPerWeek,
      definition.lengthNights,
    );
    if (applied >= allowed) {
      return {
        index,
        slot: 'recover',
        productId: null,
        productName: null,
        className: null,
        authoredProductId: night.productId,
        reconciliationReason: 'cadence_cap',
      };
    }

    used.set(active.id, applied + 1);
    return {
      index,
      slot: slotForClass(active.className),
      productId: active.id,
      productName: active.name,
      className: active.className,
      authoredProductId: active.id,
      reconciliationReason: null,
    };
  });

  return {
    variant: 'custom',
    lengthNights: definition.lengthNights,
    nights,
    amDaily: [...amDaily],
    notes: [...notes],
  };
}

export function hasAdjacentSameClass(
  definition: CustomCycleDefinition,
  actives: readonly CycleEditorActive[],
): boolean {
  if (definition.lengthNights < 2) return false;
  const activeById = new Map(actives.map((active) => [active.id, active] as const));
  return definition.nights.some((night, index) => {
    if (!night.productId) return false;
    const next = definition.nights[(index + 1) % definition.lengthNights];
    if (!next?.productId) return false;
    const currentActive = activeById.get(night.productId);
    const nextActive = activeById.get(next.productId);
    return Boolean(
      currentActive &&
      nextActive &&
      slotForClass(currentActive.className) === slotForClass(nextActive.className),
    );
  });
}
