import { readPrivateItem, updatePrivateItem } from '@/lib/storage/privateKV';

import {
  isConflictChoiceEligible,
  type ConflictChoiceRecord,
  type ConflictChoices,
  type ConflictUserChoice,
} from './conflictChoices';
import type { DetectedConflict } from './engine';

export { conflictKey } from './conflictIdentity';
export {
  choiceForConflict,
  type ConflictChoiceRecord,
  type ConflictChoices,
  type ConflictUserChoice,
  unresolvedConflicts,
} from './conflictChoices';

// Pair- and rule-version-aware conflict choices (docs/02 section 4.6, docs/03
// section 7). The existing key is retained so current-device export and account
// cleanup remain compatible. Legacy string arrays migrate as use-together
// choices for rule version 1.
const KEY = 'onskin.conflict.overrides';

export const CONFLICT_CHOICES_INVALID = 'CONFLICT_CHOICES_INVALID';
export const CONFLICT_CHOICES_SCHEMA_UNSUPPORTED = 'CONFLICT_CHOICES_SCHEMA_UNSUPPORTED';
export const CONFLICT_CHOICES_UNAVAILABLE = 'CONFLICT_CHOICES_UNAVAILABLE';

const CONFLICT_CHOICE_READ_ERRORS = new Set([
  CONFLICT_CHOICES_INVALID,
  CONFLICT_CHOICES_SCHEMA_UNSUPPORTED,
  CONFLICT_CHOICES_UNAVAILABLE,
]);

export function isConflictChoicesReadError(error: unknown): boolean {
  return error instanceof Error && CONFLICT_CHOICE_READ_ERRORS.has(error.message);
}

type StoredConflictChoices = {
  schemaVersion: 1;
  choices: ConflictChoices;
};

type NormalizedChoices = {
  value: StoredConflictChoices;
};

type ConflictChoicesFormat = 'current' | 'legacy';

export type ConflictChoicesStateRead =
  | { status: 'absent'; choices: ConflictChoices }
  | { status: 'available'; choices: ConflictChoices; format: ConflictChoicesFormat }
  | { status: 'unavailable' | 'corrupt' | 'unsupported_version'; choices: null };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value);
  return (
    keys.length === expected.length &&
    expected.every((key) => Object.prototype.hasOwnProperty.call(value, key))
  );
}

function normalizeChoice(value: unknown): ConflictUserChoice | null {
  if (value === 'accept_suggested_timing' || value === 'use_together') return value;
  return value === 'keep_alternate_nights' ? 'accept_suggested_timing' : null;
}

function normalizedIdentity(
  ruleIdValue: unknown,
  productIdsValue: unknown,
): { key: string; ruleId: string; productIds: [string, string] } | null {
  if (typeof ruleIdValue !== 'string' || !Array.isArray(productIdsValue)) return null;
  const ruleId = ruleIdValue.trim();
  const ids = productIdsValue
    .filter((id): id is string => typeof id === 'string')
    .map((id) => id.trim())
    .filter(Boolean)
    .sort();
  if (!ruleId || ids.length !== 2 || ids[0] === ids[1]) return null;
  const productIds: [string, string] = [ids[0]!, ids[1]!];
  return { key: `${ruleId}:${productIds.join('+')}`, ruleId, productIds };
}

function identityFromLegacyKey(
  keyValue: unknown,
): { key: string; ruleId: string; productIds: [string, string] } | null {
  if (typeof keyValue !== 'string') return null;
  const key = keyValue.trim();
  const separator = key.indexOf(':');
  if (separator <= 0) return null;
  return normalizedIdentity(key.slice(0, separator), key.slice(separator + 1).split('+'));
}

function normalizeRecord(value: unknown): ConflictChoiceRecord | null {
  if (!isRecord(value)) return null;
  const choice = normalizeChoice(value.choice);
  if (!choice) return null;
  const identity = normalizedIdentity(value.ruleId, value.productIds);
  if (!identity) return null;
  if (
    typeof value.ruleVersion !== 'number' ||
    !Number.isSafeInteger(value.ruleVersion) ||
    value.ruleVersion < 1
  ) {
    return null;
  }
  return {
    choice,
    ruleId: identity.ruleId,
    ruleVersion: value.ruleVersion,
    productIds: identity.productIds,
  };
}

function normalizeChoices(value: unknown): NormalizedChoices | null {
  if (Array.isArray(value)) {
    const choices: ConflictChoices = {};
    for (const legacyKey of value) {
      const identity = identityFromLegacyKey(legacyKey);
      if (!identity) continue;
      choices[identity.key] = {
        choice: 'use_together',
        ruleId: identity.ruleId,
        ruleVersion: 1,
        productIds: identity.productIds,
      };
    }
    return { value: { schemaVersion: 1, choices } };
  }

  if (!isRecord(value) || value.schemaVersion !== 1 || !isRecord(value.choices)) return null;

  const choices: ConflictChoices = {};
  for (const storedRecord of Object.values(value.choices)) {
    const record = normalizeRecord(storedRecord);
    if (!record) continue;
    const identity = normalizedIdentity(record.ruleId, record.productIds)!;
    choices[identity.key] = record;
  }

  return { value: { schemaVersion: 1, choices } };
}

function recognizedCurrentFormat(
  value: Record<string, unknown>,
  normalized: StoredConflictChoices,
): ConflictChoicesFormat | null {
  if (
    value.schemaVersion !== 1 ||
    !hasExactKeys(value, ['schemaVersion', 'choices']) ||
    !isRecord(value.choices)
  ) {
    return null;
  }

  const storedEntries = Object.entries(value.choices);
  if (storedEntries.length !== Object.keys(normalized.choices).length) return null;

  let format: ConflictChoicesFormat = 'current';
  for (const [key, storedValue] of storedEntries) {
    if (
      !isRecord(storedValue) ||
      !hasExactKeys(storedValue, ['choice', 'ruleId', 'ruleVersion', 'productIds'])
    ) {
      return null;
    }

    const normalizedRecord = normalized.choices[key];
    if (!normalizedRecord) return null;

    if (storedValue.choice === 'keep_alternate_nights') {
      if (normalizedRecord.choice !== 'accept_suggested_timing') return null;
      format = 'legacy';
    } else if (storedValue.choice !== normalizedRecord.choice) {
      return null;
    }

    if (
      storedValue.ruleId !== normalizedRecord.ruleId ||
      storedValue.ruleVersion !== normalizedRecord.ruleVersion ||
      !Array.isArray(storedValue.productIds) ||
      storedValue.productIds.length !== normalizedRecord.productIds.length ||
      !storedValue.productIds.every(
        (productId, index) => productId === normalizedRecord.productIds[index],
      )
    ) {
      return null;
    }
  }

  return format;
}

/** Normalize legacy/current choice storage for a stable account-export shape.
 * Unknown future schemas remain present and explicitly labeled instead of being
 * rewritten or silently omitted by an older app. */
export function normalizeConflictChoicesForExport(value: unknown): unknown {
  const normalized = normalizeChoices(value);
  if (normalized) {
    if (!isRecord(value)) return normalized.value;
    if (recognizedCurrentFormat(value, normalized.value)) return normalized.value;
  }
  return {
    export_status: 'unrecognized_conflict_choice_schema',
    stored_value: value,
  };
}

function decodeChoices(raw: string): {
  choices: ConflictChoices;
  format: ConflictChoicesFormat;
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error(CONFLICT_CHOICES_INVALID);
  }
  if (
    isRecord(parsed) &&
    typeof parsed.schemaVersion === 'number' &&
    Number.isSafeInteger(parsed.schemaVersion) &&
    parsed.schemaVersion > 1
  ) {
    throw new Error(CONFLICT_CHOICES_SCHEMA_UNSUPPORTED);
  }
  const normalized = normalizeChoices(parsed);
  if (!normalized) throw new Error(CONFLICT_CHOICES_INVALID);
  if (!isRecord(parsed)) {
    return { choices: normalized.value.choices, format: 'legacy' };
  }
  const format = recognizedCurrentFormat(parsed, normalized.value);
  if (!format) throw new Error(CONFLICT_CHOICES_INVALID);
  return { choices: normalized.value.choices, format };
}

function choicesForMutation(raw: string | null): ConflictChoices {
  return raw === null ? {} : decodeChoices(raw).choices;
}

let e2eConflictChoicesReadFailureCount = 0;

function consumeE2EConflictChoicesReadFailure(): boolean {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return false;
  const fixture = process.env.EXPO_PUBLIC_E2E_CONFLICT_CHOICES_READ_FAILURE?.trim().toLowerCase();
  if (fixture === 'always') return true;
  if (fixture !== 'once' || e2eConflictChoicesReadFailureCount > 0) return false;
  e2eConflictChoicesReadFailureCount += 1;
  return true;
}

/** Classify choice state without repairing, deleting, or migrating persisted bytes. */
export async function readConflictChoicesState(): Promise<ConflictChoicesStateRead> {
  if (consumeE2EConflictChoicesReadFailure()) {
    return { status: 'unavailable', choices: null };
  }

  let stored: Awaited<ReturnType<typeof readPrivateItem>>;
  try {
    stored = await readPrivateItem(KEY);
  } catch {
    return { status: 'unavailable', choices: null };
  }

  if (stored.status === 'absent') return { status: 'absent', choices: {} };
  if (stored.status === 'unavailable') return { status: 'unavailable', choices: null };
  if (stored.status === 'corrupt') return { status: 'corrupt', choices: null };
  if (stored.status === 'unsupported_version') {
    return { status: 'unsupported_version', choices: null };
  }

  try {
    const decoded = decodeChoices(stored.value);
    return { status: 'available', ...decoded };
  } catch (error) {
    return error instanceof Error && error.message === CONFLICT_CHOICES_SCHEMA_UNSUPPORTED
      ? { status: 'unsupported_version', choices: null }
      : { status: 'corrupt', choices: null };
  }
}

/** Strict loader for consumers and write paths. Unreadable private state never
 * becomes a valid empty choice map or replaces the prior bytes. */
export async function loadConflictChoices(): Promise<ConflictChoices> {
  const state = await readConflictChoicesState();
  if (state.status === 'available' || state.status === 'absent') return state.choices;
  if (state.status === 'unsupported_version') {
    throw new Error(CONFLICT_CHOICES_SCHEMA_UNSUPPORTED);
  }
  if (state.status === 'corrupt') throw new Error(CONFLICT_CHOICES_INVALID);
  throw new Error(CONFLICT_CHOICES_UNAVAILABLE);
}

/** Compatibility name retained for existing consumers; reads are now strict. */
export async function getConflictChoices(): Promise<ConflictChoices> {
  return loadConflictChoices();
}

export async function setConflictChoice(
  conflict: DetectedConflict,
  choice: ConflictUserChoice,
): Promise<ConflictChoices> {
  if (!isConflictChoiceEligible(conflict)) {
    throw new Error('CONFLICT_CHOICE_NOT_ELIGIBLE');
  }

  const identity = normalizedIdentity(conflict.rule.id, [conflict.productAId, conflict.productBId]);
  if (!identity) throw new Error('CONFLICT_CHOICE_IDENTITY_INVALID');

  let next: ConflictChoices = {};
  await updatePrivateItem(KEY, (raw) => {
    next = {
      ...choicesForMutation(raw),
      [identity.key]: {
        choice,
        ruleId: identity.ruleId,
        ruleVersion: conflict.rule.ruleVersion,
        productIds: identity.productIds,
      },
    };
    return JSON.stringify({ schemaVersion: 1, choices: next });
  });
  return next;
}

/** Compatibility adapter for existing badge helpers and older callers. */
export async function getOverriddenKeys(): Promise<Set<string>> {
  const choices = await getConflictChoices();
  return new Set(
    Object.entries(choices).flatMap(([key, record]) =>
      record.choice === 'use_together' ? [key] : [],
    ),
  );
}

/** Legacy API retained for migrations/tests. New UI writes should use
 * setConflictChoice so rule version and pair identity come from detection. */
export async function setConflictOverride(key: string, overridden: boolean): Promise<void> {
  const identity = identityFromLegacyKey(key);
  if (!identity) return;
  await updatePrivateItem(KEY, (raw) => {
    const next = { ...choicesForMutation(raw) };
    if (overridden) {
      next[identity.key] = {
        choice: 'use_together',
        ruleId: identity.ruleId,
        ruleVersion: 1,
        productIds: identity.productIds,
      };
    } else {
      delete next[identity.key];
    }
    return Object.keys(next).length > 0
      ? JSON.stringify({ schemaVersion: 1, choices: next })
      : null;
  });
}
