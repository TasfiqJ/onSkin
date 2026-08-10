import { getPrivateItem, updatePrivateItem } from '@/lib/storage/privateKV';
import {
  runCurrentHealthDataOperation,
  type HealthDataWriteOperationLease,
} from '@/lib/consent/healthDataWriteAdmission';

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
const KEY = 'layerwell.conflict.overrides';

export const CONFLICT_CHOICES_INVALID = 'CONFLICT_CHOICES_INVALID';
export const CONFLICT_CHOICES_SCHEMA_UNSUPPORTED = 'CONFLICT_CHOICES_SCHEMA_UNSUPPORTED';

type StoredConflictChoices = {
  schemaVersion: 1;
  choices: ConflictChoices;
};

type NormalizedChoices = {
  value: StoredConflictChoices;
};

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
    !Number.isInteger(value.ruleVersion) ||
    value.ruleVersion < 1
  ) {
    return null;
  }
  const normalizeHash = (hash: unknown): string | null =>
    typeof hash === 'string' && /^[a-f0-9]{64}$/u.test(hash) ? hash : null;
  return {
    choice,
    ruleId: identity.ruleId,
    ruleVersion: value.ruleVersion,
    productIds: identity.productIds,
    corpusSha256: normalizeHash(value.corpusSha256),
    ruleContentSha256: normalizeHash(value.ruleContentSha256),
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
        corpusSha256: null,
        ruleContentSha256: null,
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

function isRecognizedCurrentState(
  value: Record<string, unknown>,
  normalized: StoredConflictChoices,
): boolean {
  if (
    value.schemaVersion !== 1 ||
    !hasExactKeys(value, ['schemaVersion', 'choices']) ||
    !isRecord(value.choices)
  ) {
    return false;
  }

  const storedEntries = Object.entries(value.choices);
  if (storedEntries.length !== Object.keys(normalized.choices).length) return false;

  return storedEntries.every(([key, storedValue]) => {
    if (
      !isRecord(storedValue) ||
      !(
        hasExactKeys(storedValue, ['choice', 'ruleId', 'ruleVersion', 'productIds']) ||
        hasExactKeys(storedValue, [
          'choice',
          'ruleId',
          'ruleVersion',
          'productIds',
          'corpusSha256',
          'ruleContentSha256',
        ])
      )
    ) {
      return false;
    }
    const normalizedRecord = normalized.choices[key];
    if (!normalizedRecord) return false;
    const recognizedChoice =
      storedValue.choice === normalizedRecord.choice ||
      (storedValue.choice === 'keep_alternate_nights' &&
        normalizedRecord.choice === 'accept_suggested_timing');
    return (
      recognizedChoice &&
      storedValue.ruleId === normalizedRecord.ruleId &&
      storedValue.ruleVersion === normalizedRecord.ruleVersion &&
      (storedValue.corpusSha256 ?? null) === normalizedRecord.corpusSha256 &&
      (storedValue.ruleContentSha256 ?? null) === normalizedRecord.ruleContentSha256 &&
      Array.isArray(storedValue.productIds) &&
      storedValue.productIds.length === normalizedRecord.productIds.length &&
      storedValue.productIds.every(
        (productId, index) => productId === normalizedRecord.productIds[index],
      )
    );
  });
}

/** Normalize legacy/current choice storage for a stable account-export shape.
 * Unknown future schemas remain present and explicitly labeled instead of being
 * rewritten or silently omitted by an older app. */
export function normalizeConflictChoicesForExport(value: unknown): unknown {
  const normalized = normalizeChoices(value);
  if (
    normalized &&
    !(
      isRecord(value) &&
      value.schemaVersion === 1 &&
      !isRecognizedCurrentState(value, normalized.value)
    )
  ) {
    return normalized.value;
  }
  return {
    export_status: 'unrecognized_conflict_choice_schema',
    stored_value: value,
  };
}

function decodeChoices(raw: string): ConflictChoices {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error(CONFLICT_CHOICES_INVALID);
  }
  if (isRecord(parsed) && typeof parsed.schemaVersion === 'number' && parsed.schemaVersion > 1) {
    throw new Error(CONFLICT_CHOICES_SCHEMA_UNSUPPORTED);
  }
  const normalized = normalizeChoices(parsed);
  if (!normalized) throw new Error(CONFLICT_CHOICES_INVALID);
  if (
    isRecord(parsed) &&
    parsed.schemaVersion === 1 &&
    !isRecognizedCurrentState(parsed, normalized.value)
  ) {
    throw new Error(CONFLICT_CHOICES_INVALID);
  }
  return normalized.value.choices;
}

function choicesForMutation(raw: string | null): ConflictChoices {
  return raw === null ? {} : decodeChoices(raw);
}

/** Strict loader for write paths. Private-storage failures propagate so the UI
 * cannot claim a choice was saved or replace unreadable prior state. */
async function loadConflictChoicesWithLease(
  lease: HealthDataWriteOperationLease,
): Promise<ConflictChoices> {
  lease.assertCurrent();
  const raw = await getPrivateItem(KEY);
  lease.assertCurrent();
  const choices = raw === null ? {} : decodeChoices(raw);
  lease.assertCurrent();
  return choices;
}

export async function loadConflictChoices(): Promise<ConflictChoices> {
  return runCurrentHealthDataOperation((lease) => loadConflictChoicesWithLease(lease));
}

/** Conservative read for schedule/shelf rendering. If private state cannot be
 * read, the app falls back to the safer suggested schedule and may re-surface
 * the conflict rather than applying an unverified override. */
export async function getConflictChoices(): Promise<ConflictChoices> {
  return runCurrentHealthDataOperation(async (lease) => {
    try {
      return await loadConflictChoicesWithLease(lease);
    } catch {
      lease.assertCurrent();
      return {};
    }
  });
}

export async function setConflictChoice(
  conflict: DetectedConflict,
  choice: ConflictUserChoice,
): Promise<ConflictChoices> {
  return runCurrentHealthDataOperation(async (lease) => {
    if (!isConflictChoiceEligible(conflict)) {
      throw new Error('CONFLICT_CHOICE_NOT_ELIGIBLE');
    }

    const identity = normalizedIdentity(conflict.rule.id, [
      conflict.productAId,
      conflict.productBId,
    ]);
    if (!identity) throw new Error('CONFLICT_CHOICE_IDENTITY_INVALID');

    let next: ConflictChoices = {};
    lease.assertCurrent();
    await updatePrivateItem(KEY, (raw) => {
      lease.assertCurrent();
      next = {
        ...choicesForMutation(raw),
        [identity.key]: {
          choice,
          ruleId: identity.ruleId,
          ruleVersion: conflict.rule.ruleVersion,
          productIds: identity.productIds,
          corpusSha256: conflict.rule.corpusSha256,
          ruleContentSha256: conflict.rule.ruleContentSha256,
        },
      };
      lease.assertCurrent();
      return JSON.stringify({ schemaVersion: 1, choices: next });
    });
    lease.assertCurrent();
    return next;
  });
}

/** Compatibility adapter for existing badge helpers and older callers. */
export async function getOverriddenKeys(): Promise<Set<string>> {
  return runCurrentHealthDataOperation(async (lease) => {
    let choices: ConflictChoices;
    try {
      choices = await loadConflictChoicesWithLease(lease);
    } catch {
      lease.assertCurrent();
      choices = {};
    }
    lease.assertCurrent();
    return new Set(
      Object.entries(choices).flatMap(([key, record]) =>
        record.choice === 'use_together' &&
        record.corpusSha256 !== null &&
        record.ruleContentSha256 !== null
          ? [key]
          : [],
      ),
    );
  });
}

/** Legacy API retained for migrations/tests. New UI writes should use
 * setConflictChoice so rule version and pair identity come from detection. */
export async function setConflictOverride(key: string, overridden: boolean): Promise<void> {
  await runCurrentHealthDataOperation(async (lease) => {
    const identity = identityFromLegacyKey(key);
    if (!identity) return;
    lease.assertCurrent();
    await updatePrivateItem(KEY, (raw) => {
      lease.assertCurrent();
      const next = { ...choicesForMutation(raw) };
      // A legacy pair key cannot supply the exact corpus and rule hashes. It
      // may remove old state, but can never create an active choice.
      if (!overridden) {
        delete next[identity.key];
      }
      lease.assertCurrent();
      return Object.keys(next).length > 0
        ? JSON.stringify({ schemaVersion: 1, choices: next })
        : null;
    });
    lease.assertCurrent();
  });
}
