import type { BudgetBand, ValuesFilter } from '@layerwell/types';
import { VALUES_FILTERS } from '@layerwell/types';

import {
  HEALTH_DATA_WRITE_ADMISSION_CLOSED,
  runHealthDataWriteOperation,
} from '@/lib/consent/healthDataWriteAdmission';
import { activeHealthProcessingOwnerUserId } from '@/lib/consent/healthProcessingEpoch';
import { getPersistedSupabaseUser, supabase } from '@/lib/supabase/client';
import {
  getPrivateItem,
  multiRemovePrivateItems,
  updatePrivateItem,
} from '@/lib/storage/privateKV';
import { decodePrivateStringSet, encodePrivateStringSet } from '@/lib/storage/privateStringSet';

import {
  DEFAULT_PREFERENCES,
  RECOMMENDATION_FORMATS,
  type RecommendationFormat,
  type RecPreferences,
} from './preferences';

// Local-first recommendation state (docs/09 §12, the D-029 pattern). v1 source of
// truth is encrypted private storage (works offline; the For-you hub + gap prompts
// render without the backend), with a best-effort immediate Supabase preference
// mirror when an exact current session is available. There is no retry queue in
// this checkpoint, so the local record remains authoritative after a remote
// failure. The `recommendations` cache table is NOT used as a source of truth.
// The pure engine recomputes live. We persist only the user's PREFERENCES and
// which suggestions they have DISMISSED ("not for me").

const PREF_KEY = 'layerwell.recPrefs.v1';
const DISMISSED_KEY = 'layerwell.recDismissed.v1';
const PREF_SCHEMA_VERSION = 1 as const;

export const REC_PREFERENCES_INVALID = 'REC_PREFERENCES_INVALID';
export const REC_PREFERENCES_UNSUPPORTED_VERSION = 'REC_PREFERENCES_UNSUPPORTED_VERSION';

type RecPreferencesEnvelope = {
  version: typeof PREF_SCHEMA_VERSION;
  preferences: RecPreferences;
};

const BUDGET_BANDS = new Set<BudgetBand>(['drugstore', 'mid', 'premium']);
const VALUES = new Set<ValuesFilter>(VALUES_FILTERS);
const FORMATS = new Set<RecommendationFormat>(RECOMMENDATION_FORMATS);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === expected.length && expected.every((key) => hasOwn(value, key));
}

function uniqueStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter((item) => item.length > 0),
    ),
  ];
}

function normalizeValues(value: unknown): ValuesFilter[] {
  return uniqueStrings(value).filter((item): item is ValuesFilter =>
    VALUES.has(item as ValuesFilter),
  );
}

function normalizeBudget(value: unknown): BudgetBand | null {
  return typeof value === 'string' && BUDGET_BANDS.has(value as BudgetBand)
    ? (value as BudgetBand)
    : null;
}

function normalizeFormats(value: unknown): RecommendationFormat[] {
  return uniqueStrings(value).filter((item): item is RecommendationFormat =>
    FORMATS.has(item as RecommendationFormat),
  );
}

function normalizePreferences(value: unknown): RecPreferences | null {
  if (!isRecord(value)) return null;
  return {
    values: normalizeValues(value.values),
    budget: normalizeBudget(value.budget),
    formats: normalizeFormats(value.formats),
  };
}

function decodePreferences(raw: string): RecPreferences {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error(REC_PREFERENCES_INVALID);
  }
  if (!isRecord(parsed)) throw new Error(REC_PREFERENCES_INVALID);

  if (hasOwn(parsed, 'version')) {
    if (parsed.version !== PREF_SCHEMA_VERSION) {
      if (
        typeof parsed.version === 'number' &&
        Number.isSafeInteger(parsed.version) &&
        parsed.version > PREF_SCHEMA_VERSION
      ) {
        throw new Error(REC_PREFERENCES_UNSUPPORTED_VERSION);
      }
      throw new Error(REC_PREFERENCES_INVALID);
    }
    if (!hasExactKeys(parsed, ['version', 'preferences']) || !isRecord(parsed.preferences)) {
      throw new Error(REC_PREFERENCES_INVALID);
    }
    const normalized = normalizePreferences(parsed.preferences);
    if (
      !normalized ||
      !hasExactKeys(parsed.preferences, ['values', 'budget', 'formats']) ||
      JSON.stringify(normalized) !== JSON.stringify(parsed.preferences)
    ) {
      throw new Error(REC_PREFERENCES_INVALID);
    }
    return normalized;
  }

  const normalized = normalizePreferences(parsed);
  if (!normalized) throw new Error(REC_PREFERENCES_INVALID);
  return normalized;
}

function encodePreferences(preferences: RecPreferences): string {
  return JSON.stringify({
    version: PREF_SCHEMA_VERSION,
    preferences,
  } satisfies RecPreferencesEnvelope);
}

// --- preferences --------------------------------------------------------------
export async function loadPreferences(): Promise<RecPreferences> {
  const raw = await getPrivateItem(PREF_KEY);
  return raw === null ? DEFAULT_PREFERENCES : decodePreferences(raw);
}

export async function savePreferences(prefs: RecPreferences): Promise<void> {
  const expectedOwnerUserId = activeHealthProcessingOwnerUserId();
  if (!expectedOwnerUserId) throw new Error(HEALTH_DATA_WRITE_ADMISSION_CLOSED);
  await runHealthDataWriteOperation(expectedOwnerUserId, async (lease) => {
    const normalized = normalizePreferences(prefs) ?? DEFAULT_PREFERENCES;
    await updatePrivateItem(PREF_KEY, (current) => {
      if (current !== null) decodePreferences(current);
      return encodePreferences(normalized);
    });
    lease.assertCurrent();
    // Best-effort mirror (B-SUPABASE). The authenticated scalar RPC owns the row
    // write and rechecks session, health epoch, and account access. Direct table
    // DML is intentionally unavailable to mobile.
    try {
      const { data } = await getPersistedSupabaseUser();
      lease.assertCurrent();
      if (data.user?.id !== lease.ownerUserId) return;
      await supabase.rpc('set_recommendation_preferences', {
        p_values_filters: normalized.values,
        p_budget_band: normalized.budget,
        p_format_prefs: normalized.formats,
      });
      lease.assertCurrent();
    } catch {
      lease.assertCurrent();
      /* offline / no DB. The encrypted local preference remains authoritative. */
    }
    lease.assertCurrent();
  });
}

// --- dismissed suggestions ("not for me") -------------------------------------
export async function loadDismissed(): Promise<string[]> {
  return decodePrivateStringSet(await getPrivateItem(DISMISSED_KEY));
}

export async function dismissRecommendation(id: string): Promise<void> {
  const normalizedId = id.trim();
  if (normalizedId.length === 0) return;
  await updatePrivateItem(DISMISSED_KEY, (current) => {
    const dismissed = decodePrivateStringSet(current);
    return encodePrivateStringSet(
      dismissed.includes(normalizedId) ? dismissed : [...dismissed, normalizedId],
    );
  });
}

/** Test/seed reset. */
export async function clearRecState(): Promise<void> {
  await multiRemovePrivateItems([PREF_KEY, DISMISSED_KEY]);
}
