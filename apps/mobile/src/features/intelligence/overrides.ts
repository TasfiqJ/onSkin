import {
  getPrivateItem,
  removePrivateItem,
  setPrivateItem,
  updatePrivateItem,
} from '@/lib/storage/privateKV';

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

type StoredConflictChoices = {
  schemaVersion: 1;
  choices: ConflictChoices;
};

type NormalizedChoices = {
  value: StoredConflictChoices;
  changed: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
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
    !Number.isInteger(value.ruleVersion) ||
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
    return { value: { schemaVersion: 1, choices }, changed: true };
  }

  if (!isRecord(value) || value.schemaVersion !== 1 || !isRecord(value.choices)) return null;

  const choices: ConflictChoices = {};
  for (const storedRecord of Object.values(value.choices)) {
    const record = normalizeRecord(storedRecord);
    if (!record) continue;
    const identity = normalizedIdentity(record.ruleId, record.productIds)!;
    choices[identity.key] = record;
  }

  const normalized: StoredConflictChoices = { schemaVersion: 1, choices };
  return {
    value: normalized,
    changed: JSON.stringify(value) !== JSON.stringify(normalized),
  };
}

/** Normalize legacy/current choice storage for a stable account-export shape.
 * Unknown future schemas remain present and explicitly labeled instead of being
 * rewritten or silently omitted by an older app. */
export function normalizeConflictChoicesForExport(value: unknown): unknown {
  const normalized = normalizeChoices(value);
  if (normalized) return normalized.value;
  return {
    export_status: 'unrecognized_conflict_choice_schema',
    stored_value: value,
  };
}

async function persist(value: StoredConflictChoices): Promise<void> {
  if (Object.keys(value.choices).length === 0) {
    await removePrivateItem(KEY);
    return;
  }
  await setPrivateItem(KEY, JSON.stringify(value));
}

function choicesForMutation(raw: string | null): ConflictChoices {
  if (!raw) return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return {};
  }
  if (isRecord(parsed) && typeof parsed.schemaVersion === 'number' && parsed.schemaVersion > 1) {
    throw new Error('CONFLICT_CHOICES_SCHEMA_UNSUPPORTED');
  }
  return normalizeChoices(parsed)?.value.choices ?? {};
}

/** Strict loader for write paths. Private-storage failures propagate so the UI
 * cannot claim a choice was saved or replace unreadable prior state. */
export async function loadConflictChoices(): Promise<ConflictChoices> {
  const raw = await getPrivateItem(KEY);
  if (!raw) return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    await removePrivateItem(KEY);
    return {};
  }

  if (isRecord(parsed) && typeof parsed.schemaVersion === 'number' && parsed.schemaVersion > 1) {
    throw new Error('CONFLICT_CHOICES_SCHEMA_UNSUPPORTED');
  }

  const normalized = normalizeChoices(parsed);
  if (!normalized) {
    await removePrivateItem(KEY);
    return {};
  }
  if (normalized.changed) await persist(normalized.value);
  return normalized.value.choices;
}

/** Conservative read for schedule/shelf rendering. If private state cannot be
 * read, the app falls back to the safer suggested schedule and may re-surface
 * the conflict rather than applying an unverified override. */
export async function getConflictChoices(): Promise<ConflictChoices> {
  try {
    return await loadConflictChoices();
  } catch {
    return {};
  }
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
