import type { BudgetBand, ValuesFilter } from '@onskin/types';

import { supabase } from '@/lib/supabase/client';
import { getPrivateItem, multiRemovePrivateItems, setPrivateItem } from '@/lib/storage/privateKV';

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

// --- preferences --------------------------------------------------------------
export async function loadPreferences(): Promise<RecPreferences> {
  try {
    const raw = await getPrivateItem(PREF_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<RecPreferences>;
    return {
      values: Array.isArray(parsed.values) ? (parsed.values as ValuesFilter[]) : [],
      budget: (parsed.budget as BudgetBand | null) ?? null,
      formats: Array.isArray(parsed.formats) ? parsed.formats : [],
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export async function savePreferences(prefs: RecPreferences): Promise<void> {
  await setPrivateItem(PREF_KEY, JSON.stringify(prefs));
  // Best-effort mirror (B-SUPABASE). Owner-RLS table; clients can only write their
  // own row. Guarded so the store works fully before the backend is configured.
  try {
    const { data } = await supabase.auth.getUser();
    if (data.user?.id) {
      await supabase.from('recommendation_preferences').upsert({
        user_id: data.user.id,
        values_filters: prefs.values,
        budget_band: prefs.budget,
        format_prefs: prefs.formats,
      });
    }
  } catch {
    /* offline / no DB */
  }
}

// --- dismissed suggestions ("not for me") -------------------------------------
export async function loadDismissed(): Promise<string[]> {
  try {
    const raw = await getPrivateItem(DISMISSED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function dismissRecommendation(id: string): Promise<void> {
  const cur = await loadDismissed();
  if (cur.includes(id)) return;
  await setPrivateItem(DISMISSED_KEY, JSON.stringify([...cur, id]));
}

/** Test/seed reset. */
export async function clearRecState(): Promise<void> {
  await multiRemovePrivateItems([PREF_KEY, DISMISSED_KEY]);
}
