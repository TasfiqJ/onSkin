import type { BudgetBand, ValuesFilter } from '@onskin/types';
import { VALUES_FILTERS } from '@onskin/types';

import { supabase } from '@/lib/supabase/client';
import {
  getPrivateItem,
  multiRemovePrivateItems,
  removePrivateItem,
  setPrivateItem,
} from '@/lib/storage/privateKV';

import { DEFAULT_PREFERENCES, type RecPreferences } from './preferences';

// Local-first recommendation state (docs/09 §12, the D-029 pattern). v1 source of
// truth is AsyncStorage (works offline; the For-you hub + gap prompts must render
// before the backend exists, B-SUPABASE), with a best-effort `recommendation_
// preferences` Supabase mirror that reconciles via the persisted mutation queue
// (D-007) once the project is live. The `recommendations` cache table is NOT used
// as a source of truth. The pure engine recomputes live (the doc: "never the
// source of truth"). We persist only the user's PREFERENCES and which suggestions
// they have DISMISSED ("not for me"), so a dismissed card doesn't reappear.

const PREF_KEY = 'onskin.recPrefs.v1';
const DISMISSED_KEY = 'onskin.recDismissed.v1';

const BUDGET_BANDS = new Set<BudgetBand>(['drugstore', 'mid', 'premium']);
const VALUES = new Set<ValuesFilter>(VALUES_FILTERS);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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

function normalizePreferences(value: unknown): RecPreferences | null {
  if (!isRecord(value)) return null;
  return {
    values: normalizeValues(value.values),
    budget: normalizeBudget(value.budget),
    formats: uniqueStrings(value.formats),
  };
}

function isDefaultPreferences(prefs: RecPreferences): boolean {
  return prefs.values.length === 0 && prefs.budget === null && prefs.formats.length === 0;
}

function normalizeDismissed(value: unknown): string[] | null {
  return Array.isArray(value) ? uniqueStrings(value) : null;
}

// --- preferences --------------------------------------------------------------
export async function loadPreferences(): Promise<RecPreferences> {
  let raw: string | null = null;
  try {
    raw = await getPrivateItem(PREF_KEY);
  } catch {
    return DEFAULT_PREFERENCES;
  }
  if (!raw) return DEFAULT_PREFERENCES;
  try {
    const parsed: unknown = JSON.parse(raw);
    const normalized = normalizePreferences(parsed);
    if (!normalized) {
      await removePrivateItem(PREF_KEY).catch(() => undefined);
      return DEFAULT_PREFERENCES;
    }
    if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
      if (isDefaultPreferences(normalized))
        await removePrivateItem(PREF_KEY).catch(() => undefined);
      else await setPrivateItem(PREF_KEY, JSON.stringify(normalized)).catch(() => undefined);
    }
    return normalized;
  } catch {
    await removePrivateItem(PREF_KEY).catch(() => undefined);
    return DEFAULT_PREFERENCES;
  }
}

export async function savePreferences(prefs: RecPreferences): Promise<void> {
  const normalized = normalizePreferences(prefs) ?? DEFAULT_PREFERENCES;
  await setPrivateItem(PREF_KEY, JSON.stringify(normalized));
  // Best-effort mirror (B-SUPABASE). Owner-RLS table; clients can only write their
  // own row. Guarded so the store works fully before the backend is configured.
  try {
    const { data } = await supabase.auth.getUser();
    if (data.user?.id) {
      await supabase.from('recommendation_preferences').upsert({
        user_id: data.user.id,
        values_filters: normalized.values,
        budget_band: normalized.budget,
        format_prefs: normalized.formats,
      });
    }
  } catch {
    /* offline / no DB */
  }
}

// --- dismissed suggestions ("not for me") -------------------------------------
export async function loadDismissed(): Promise<string[]> {
  let raw: string | null = null;
  try {
    raw = await getPrivateItem(DISMISSED_KEY);
  } catch {
    return [];
  }
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    const normalized = normalizeDismissed(parsed);
    if (!normalized) {
      await removePrivateItem(DISMISSED_KEY).catch(() => undefined);
      return [];
    }
    if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
      if (normalized.length > 0)
        await setPrivateItem(DISMISSED_KEY, JSON.stringify(normalized)).catch(() => undefined);
      else await removePrivateItem(DISMISSED_KEY).catch(() => undefined);
    }
    return normalized;
  } catch {
    await removePrivateItem(DISMISSED_KEY).catch(() => undefined);
    return [];
  }
}

export async function dismissRecommendation(id: string): Promise<void> {
  const normalizedId = id.trim();
  if (normalizedId.length === 0) return;
  const cur = await loadDismissed();
  if (cur.includes(normalizedId)) return;
  await setPrivateItem(DISMISSED_KEY, JSON.stringify([...cur, normalizedId]));
}

/** Test/seed reset. */
export async function clearRecState(): Promise<void> {
  await multiRemovePrivateItems([PREF_KEY, DISMISSED_KEY]);
}
