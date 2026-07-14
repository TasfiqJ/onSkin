import type { BudgetBand, ValuesFilter } from '@onskin/types';
import { VALUES_FILTERS } from '@onskin/types';

import { captureAuthenticatedAccountOwner } from '@/lib/auth/authenticatedAccountOwner';
import { runOwnerQueryOperation, type OwnerQueryScope } from '@/lib/query/queryKeys';
import { supabase } from '@/lib/supabase/client';
import {
  multiRemovePrivateItems,
  readPrivateItem,
  type PrivateKVReadFailureReason,
  updatePrivateItem,
} from '@/lib/storage/privateKV';
import {
  decodePrivateStringSet,
  encodePrivateStringSet,
  PRIVATE_STRING_SET_UNSUPPORTED_VERSION,
} from '@/lib/storage/privateStringSet';

import { DEFAULT_PREFERENCES, type RecPreferences } from './preferences';

// Local-first recommendation state (docs/09 §12, the D-029 pattern). v1 source of
// truth is AsyncStorage (works offline; the For-you hub + gap prompts must render
// before the backend exists, B-SUPABASE), with a best-effort `recommendation_
// preferences` Supabase mirror. The mirror is best effort and serialized within
// the running process; durable retry remains a separate D-007 outbox checkpoint.
// The `recommendations` cache table is NOT used as a source of truth. The pure
// engine recomputes live (the doc: "never the source of truth"). We persist only
// the user's PREFERENCES and which suggestions they have DISMISSED ("not for
// me"), so a dismissed card doesn't reappear.

const PREF_KEY = 'onskin.recPrefs.v1';
const DISMISSED_KEY = 'onskin.recDismissed.v1';
const PREF_SCHEMA_VERSION = 1 as const;
const MAX_PREFERENCE_RECORD_CHARS = 16_384;
const MAX_FORMAT_PREFERENCES = 16;
const MAX_FORMAT_PREFERENCE_CHARS = 64;
const MAX_DISMISSED_RECORD_CHARS = 524_288;
const MAX_DISMISSED_RECOMMENDATIONS = 1_024;
const MAX_RECOMMENDATION_ID_CHARS = 256;
const MAX_E2E_RECOMMENDATION_READ_DELAY_MS = 3_000;

export const REC_PREFERENCES_INVALID = 'REC_PREFERENCES_INVALID';
export const REC_PREFERENCES_UNAVAILABLE = 'REC_PREFERENCES_UNAVAILABLE';
export const REC_PREFERENCES_UNSUPPORTED_VERSION = 'REC_PREFERENCES_UNSUPPORTED_VERSION';
export const REC_DISMISSED_INVALID = 'REC_DISMISSED_INVALID';
export const REC_DISMISSED_UNAVAILABLE = 'REC_DISMISSED_UNAVAILABLE';
export const REC_DISMISSED_UNSUPPORTED_VERSION = 'REC_DISMISSED_UNSUPPORTED_VERSION';

type RecPreferencesEnvelope = {
  version: typeof PREF_SCHEMA_VERSION;
  preferences: RecPreferences;
};

type RecommendationStorageFormat = 'current' | 'legacy';
type RecommendationReadUnavailableReason = PrivateKVReadFailureReason;
type RecommendationReadCorruptReason =
  | 'content_key_invalid'
  | 'envelope_invalid'
  | 'decryption_failed'
  | 'invalid_payload';

export type RecommendationPreferencesRead =
  | { status: 'absent'; preferences: RecPreferences }
  | {
      status: 'available';
      preferences: RecPreferences;
      format: RecommendationStorageFormat;
    }
  | {
      status: 'unavailable';
      preferences: null;
      reason: RecommendationReadUnavailableReason;
    }
  | { status: 'corrupt'; preferences: null; reason: RecommendationReadCorruptReason }
  | { status: 'unsupported_version'; preferences: null };

export type DismissedRecommendationsRead =
  | { status: 'absent'; dismissed: string[] }
  | { status: 'available'; dismissed: string[]; format: RecommendationStorageFormat }
  | {
      status: 'unavailable';
      dismissed: null;
      reason: RecommendationReadUnavailableReason;
    }
  | { status: 'corrupt'; dismissed: null; reason: RecommendationReadCorruptReason }
  | { status: 'unsupported_version'; dismissed: null };

export type RecommendationInputs = {
  prefs: RecPreferences;
  dismissed: string[];
};

const BUDGET_BANDS = new Set<BudgetBand>(['drugstore', 'mid', 'premium']);
const VALUES = new Set<ValuesFilter>(VALUES_FILTERS);
const preferenceMirrorTails = new Map<number, Promise<void>>();

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

function normalizePreferences(value: unknown): RecPreferences | null {
  if (!isRecord(value)) return null;
  const normalized = {
    values: normalizeValues(value.values),
    budget: normalizeBudget(value.budget),
    formats: uniqueStrings(value.formats),
  };
  return normalized.values.length <= VALUES_FILTERS.length &&
    normalized.formats.length <= MAX_FORMAT_PREFERENCES &&
    normalized.formats.every((format) => format.length <= MAX_FORMAT_PREFERENCE_CHARS)
    ? normalized
    : null;
}

function validatePreferencesForMutation(value: unknown): RecPreferences {
  if (!isRecord(value) || !hasExactKeys(value, ['values', 'budget', 'formats'])) {
    throw new Error(REC_PREFERENCES_INVALID);
  }
  if (!Array.isArray(value.values) || !Array.isArray(value.formats)) {
    throw new Error(REC_PREFERENCES_INVALID);
  }
  const values = value.values;
  const formats = value.formats;
  const budget = value.budget;
  if (
    values.length > VALUES_FILTERS.length ||
    values.some(
      (item, index) =>
        typeof item !== 'string' ||
        !VALUES.has(item as ValuesFilter) ||
        values.indexOf(item) !== index,
    ) ||
    (budget !== null && (typeof budget !== 'string' || !BUDGET_BANDS.has(budget as BudgetBand))) ||
    formats.length > MAX_FORMAT_PREFERENCES ||
    formats.some(
      (item, index) =>
        typeof item !== 'string' ||
        item.length === 0 ||
        item.trim() !== item ||
        item.length > MAX_FORMAT_PREFERENCE_CHARS ||
        formats.indexOf(item) !== index,
    )
  ) {
    throw new Error(REC_PREFERENCES_INVALID);
  }

  return {
    values: [...(values as ValuesFilter[])],
    budget: budget as BudgetBand | null,
    formats: [...(formats as string[])],
  };
}

function emptyPreferences(): RecPreferences {
  return {
    values: [...DEFAULT_PREFERENCES.values],
    budget: DEFAULT_PREFERENCES.budget,
    formats: [...DEFAULT_PREFERENCES.formats],
  };
}

function samePreferences(left: RecPreferences, right: RecPreferences): boolean {
  return (
    left.budget === right.budget &&
    JSON.stringify(left.values) === JSON.stringify(right.values) &&
    JSON.stringify(left.formats) === JSON.stringify(right.formats)
  );
}

function exactCurrentPreferences(
  stored: Record<string, unknown>,
  normalized: RecPreferences,
): boolean {
  return (
    hasExactKeys(stored, ['values', 'budget', 'formats']) &&
    JSON.stringify(stored.values) === JSON.stringify(normalized.values) &&
    stored.budget === normalized.budget &&
    JSON.stringify(stored.formats) === JSON.stringify(normalized.formats)
  );
}

function decodePreferences(raw: string): {
  preferences: RecPreferences;
  format: RecommendationStorageFormat;
} {
  if (raw.length > MAX_PREFERENCE_RECORD_CHARS) {
    throw new Error(REC_PREFERENCES_INVALID);
  }
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
    if (!normalized || !exactCurrentPreferences(parsed.preferences, normalized)) {
      throw new Error(REC_PREFERENCES_INVALID);
    }
    return { preferences: normalized, format: 'current' };
  }

  const normalized = normalizePreferences(parsed);
  if (
    !normalized ||
    !hasExactKeys(parsed, ['values', 'budget', 'formats']) ||
    !Array.isArray(parsed.values) ||
    !Array.isArray(parsed.formats)
  ) {
    throw new Error(REC_PREFERENCES_INVALID);
  }
  return { preferences: normalized, format: 'legacy' };
}

function encodePreferences(preferences: RecPreferences): string {
  return JSON.stringify({
    version: PREF_SCHEMA_VERSION,
    preferences,
  } satisfies RecPreferencesEnvelope);
}

function decodeDismissed(raw: string): {
  dismissed: string[];
  format: RecommendationStorageFormat;
} {
  if (raw.length > MAX_DISMISSED_RECORD_CHARS) throw new Error(REC_DISMISSED_INVALID);
  let dismissed: string[];
  try {
    dismissed = decodePrivateStringSet(raw);
  } catch (error) {
    throw new Error(
      error instanceof Error && error.message === PRIVATE_STRING_SET_UNSUPPORTED_VERSION
        ? REC_DISMISSED_UNSUPPORTED_VERSION
        : REC_DISMISSED_INVALID,
    );
  }
  if (
    dismissed.length > MAX_DISMISSED_RECOMMENDATIONS ||
    dismissed.some((id) => id.length > MAX_RECOMMENDATION_ID_CHARS)
  ) {
    throw new Error(REC_DISMISSED_INVALID);
  }
  const parsed = JSON.parse(raw) as unknown;
  return { dismissed, format: Array.isArray(parsed) ? 'legacy' : 'current' };
}

type DevRecommendationReadState = 'unavailable' | 'corrupt' | 'unsupported_version';
type RecommendationStateKind = 'preferences' | 'dismissed';

let e2eReadFixtureSignature: string | null = null;
let e2eGenericReadFailures = 0;
let e2ePreferenceReadFailures = 0;
let e2eDismissedReadFailures = 0;
let e2eDismissFailureSignature: string | null = null;
let e2eDismissFailures = 0;

function resetDevRecommendationReadFixture(): void {
  e2eReadFixtureSignature = null;
  e2eGenericReadFailures = 0;
  e2ePreferenceReadFailures = 0;
  e2eDismissedReadFailures = 0;
}

function devRecommendationReadState(
  kind: RecommendationStateKind,
): DevRecommendationReadState | null {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return null;
  const fixture = process.env.EXPO_PUBLIC_E2E_RECOMMENDATION_READ_FAILURE?.trim().toLowerCase();
  if (!fixture) {
    resetDevRecommendationReadFixture();
    return null;
  }

  if (fixture !== e2eReadFixtureSignature) {
    e2eReadFixtureSignature = fixture;
    e2eGenericReadFailures = 0;
    e2ePreferenceReadFailures = 0;
    e2eDismissedReadFailures = 0;
  }

  const otherKind = kind === 'preferences' ? 'dismissed' : 'preferences';
  if (fixture.startsWith(`${otherKind}_`)) return null;
  const mode = fixture.startsWith(`${kind}_`) ? fixture.slice(kind.length + 1) : fixture;

  if (mode === 'corrupt') return 'corrupt';
  if (mode === 'future') return 'unsupported_version';
  if (mode === 'always') return 'unavailable';
  if (mode !== 'once') return null;

  if (fixture === 'once') {
    if (e2eGenericReadFailures > 0) return null;
    e2eGenericReadFailures += 1;
    return 'unavailable';
  }

  if (kind === 'preferences') {
    if (e2ePreferenceReadFailures > 0) return null;
    e2ePreferenceReadFailures += 1;
  } else {
    if (e2eDismissedReadFailures > 0) return null;
    e2eDismissedReadFailures += 1;
  }
  return 'unavailable';
}

function devRecommendationReadDelayMs(): number {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return 0;
  const raw = process.env.EXPO_PUBLIC_E2E_RECOMMENDATION_READ_DELAY_MS;
  if (!raw) return 0;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(Math.round(value), MAX_E2E_RECOMMENDATION_READ_DELAY_MS);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldSimulateRecommendationDismissFailure(ownerGeneration: number): boolean {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return false;
  const fixture = process.env.EXPO_PUBLIC_E2E_RECOMMENDATION_DISMISS_FAILURE?.trim().toLowerCase();
  if (!fixture) {
    e2eDismissFailureSignature = null;
    e2eDismissFailures = 0;
    return false;
  }
  const signature = `${fixture}:${ownerGeneration}`;
  if (signature !== e2eDismissFailureSignature) {
    e2eDismissFailureSignature = signature;
    e2eDismissFailures = 0;
  }
  if (fixture === 'always') return true;
  if (fixture !== 'once' || e2eDismissFailures > 0) return false;
  e2eDismissFailures += 1;
  return true;
}

function fixturePreferencesRead(status: DevRecommendationReadState): RecommendationPreferencesRead {
  if (status === 'unsupported_version') {
    return { status, preferences: null };
  }
  if (status === 'corrupt') {
    return { status, preferences: null, reason: 'invalid_payload' };
  }
  return { status, preferences: null, reason: 'storage_unavailable' };
}

function fixtureDismissedRead(status: DevRecommendationReadState): DismissedRecommendationsRead {
  if (status === 'unsupported_version') {
    return { status, dismissed: null };
  }
  if (status === 'corrupt') {
    return { status, dismissed: null, reason: 'invalid_payload' };
  }
  return { status, dismissed: null, reason: 'storage_unavailable' };
}

function preferencesFromRead(state: RecommendationPreferencesRead): RecPreferences {
  if (state.status === 'absent' || state.status === 'available') return state.preferences;
  if (state.status === 'unsupported_version') {
    throw new Error(REC_PREFERENCES_UNSUPPORTED_VERSION);
  }
  if (state.status === 'corrupt') throw new Error(REC_PREFERENCES_INVALID);
  throw new Error(REC_PREFERENCES_UNAVAILABLE);
}

function dismissedFromRead(state: DismissedRecommendationsRead): string[] {
  if (state.status === 'absent' || state.status === 'available') return state.dismissed;
  if (state.status === 'unsupported_version') {
    throw new Error(REC_DISMISSED_UNSUPPORTED_VERSION);
  }
  if (state.status === 'corrupt') throw new Error(REC_DISMISSED_INVALID);
  throw new Error(REC_DISMISSED_UNAVAILABLE);
}

async function performPreferenceMirror(
  ownerScope: OwnerQueryScope,
  snapshot: RecPreferences,
): Promise<void> {
  try {
    await runOwnerQueryOperation(ownerScope, async (mirrorLease) => {
      const owner = await captureAuthenticatedAccountOwner(mirrorLease);
      if (!owner) return;
      mirrorLease.assertCurrent();
      const { error } = await supabase
        .from('recommendation_preferences')
        .upsert({
          user_id: owner.userId,
          values_filters: snapshot.values,
          budget_band: snapshot.budget,
          format_prefs: snapshot.formats,
        })
        .abortSignal(mirrorLease.signal);
      mirrorLease.assertCurrent();
      if (error) throw new Error('SUPABASE_RECOMMENDATION_PREFERENCES_UPSERT_FAILED');
    });
  } catch {
    // The committed encrypted local state remains authoritative while this mirror is best effort.
  }
}

function enqueuePreferenceMirror(
  ownerScope: OwnerQueryScope,
  preferences: RecPreferences,
): Promise<void> {
  const snapshot: RecPreferences = {
    values: [...preferences.values],
    budget: preferences.budget,
    formats: [...preferences.formats],
  };
  const previous = preferenceMirrorTails.get(ownerScope.generation) ?? Promise.resolve();
  const current = previous
    .catch(() => undefined)
    .then(() => performPreferenceMirror(ownerScope, snapshot));
  const tail = current
    .catch(() => undefined)
    .finally(() => {
      if (preferenceMirrorTails.get(ownerScope.generation) === tail) {
        preferenceMirrorTails.delete(ownerScope.generation);
      }
    });
  preferenceMirrorTails.set(ownerScope.generation, tail);
  return current;
}

// --- preferences --------------------------------------------------------------
/** Classify preference state without repairing, deleting, or migrating bytes. */
export async function readRecommendationPreferences(): Promise<RecommendationPreferencesRead> {
  const fixture = devRecommendationReadState('preferences');
  if (fixture) return fixturePreferencesRead(fixture);

  let stored: Awaited<ReturnType<typeof readPrivateItem>>;
  try {
    stored = await readPrivateItem(PREF_KEY);
  } catch {
    return { status: 'unavailable', preferences: null, reason: 'storage_unavailable' };
  }

  if (stored.status === 'absent') {
    return { status: 'absent', preferences: emptyPreferences() };
  }
  if (stored.status === 'unavailable') {
    return { status: 'unavailable', preferences: null, reason: stored.reason };
  }
  if (stored.status === 'corrupt') {
    return { status: 'corrupt', preferences: null, reason: stored.reason };
  }
  if (stored.status === 'unsupported_version') {
    return { status: 'unsupported_version', preferences: null };
  }

  try {
    return { status: 'available', ...decodePreferences(stored.value) };
  } catch (error) {
    return error instanceof Error && error.message === REC_PREFERENCES_UNSUPPORTED_VERSION
      ? { status: 'unsupported_version', preferences: null }
      : { status: 'corrupt', preferences: null, reason: 'invalid_payload' };
  }
}

export async function loadPreferences(): Promise<RecPreferences> {
  return preferencesFromRead(await readRecommendationPreferences());
}

export async function savePreferences(
  ownerScope: OwnerQueryScope,
  prefs: RecPreferences,
): Promise<void> {
  await runOwnerQueryOperation(ownerScope, async (lease) => {
    const normalized = validatePreferencesForMutation(prefs);
    let changed = false;
    await updatePrivateItem(PREF_KEY, (current) => {
      if (current !== null) {
        const decoded = decodePreferences(current);
        if (decoded.format === 'current' && samePreferences(decoded.preferences, normalized)) {
          return current;
        }
      }
      changed = true;
      return encodePreferences(normalized);
    });
    lease.assertCurrent();
    if (changed) void enqueuePreferenceMirror(ownerScope, normalized);
  });
}

// --- dismissed suggestions ("not for me") -------------------------------------
/** Classify dismissal state without repairing, deleting, or migrating bytes. */
export async function readDismissedRecommendations(): Promise<DismissedRecommendationsRead> {
  const fixture = devRecommendationReadState('dismissed');
  if (fixture) return fixtureDismissedRead(fixture);

  let stored: Awaited<ReturnType<typeof readPrivateItem>>;
  try {
    stored = await readPrivateItem(DISMISSED_KEY);
  } catch {
    return { status: 'unavailable', dismissed: null, reason: 'storage_unavailable' };
  }

  if (stored.status === 'absent') return { status: 'absent', dismissed: [] };
  if (stored.status === 'unavailable') {
    return { status: 'unavailable', dismissed: null, reason: stored.reason };
  }
  if (stored.status === 'corrupt') {
    return { status: 'corrupt', dismissed: null, reason: stored.reason };
  }
  if (stored.status === 'unsupported_version') {
    return { status: 'unsupported_version', dismissed: null };
  }

  try {
    return { status: 'available', ...decodeDismissed(stored.value) };
  } catch (error) {
    return error instanceof Error && error.message === REC_DISMISSED_UNSUPPORTED_VERSION
      ? { status: 'unsupported_version', dismissed: null }
      : { status: 'corrupt', dismissed: null, reason: 'invalid_payload' };
  }
}

export async function loadDismissed(): Promise<string[]> {
  return dismissedFromRead(await readDismissedRecommendations());
}

/** One strict snapshot for the recommendation engine. Both reads begin together
 * so a one-shot failure recovers with one explicit retry. */
export async function loadRecommendationInputs(): Promise<RecommendationInputs> {
  const delayMs = devRecommendationReadDelayMs();
  if (delayMs > 0) await wait(delayMs);
  const [preferences, dismissed] = await Promise.all([
    readRecommendationPreferences(),
    readDismissedRecommendations(),
  ]);

  return {
    prefs: preferencesFromRead(preferences),
    dismissed: dismissedFromRead(dismissed),
  };
}

export async function dismissRecommendation(
  ownerScope: OwnerQueryScope,
  id: string,
): Promise<void> {
  const normalizedId = id.trim();
  if (normalizedId.length === 0) throw new Error(REC_DISMISSED_INVALID);
  if (normalizedId.length > MAX_RECOMMENDATION_ID_CHARS) {
    throw new Error(REC_DISMISSED_INVALID);
  }
  await runOwnerQueryOperation(ownerScope, async (lease) => {
    lease.assertCurrent();
    if (shouldSimulateRecommendationDismissFailure(lease.generation)) {
      throw new Error('E2E_RECOMMENDATION_DISMISS_FAILURE');
    }
    await updatePrivateItem(DISMISSED_KEY, (current) => {
      const dismissed = current === null ? [] : decodeDismissed(current).dismissed;
      if (dismissed.includes(normalizedId)) return current;
      if (dismissed.length >= MAX_DISMISSED_RECOMMENDATIONS) {
        throw new Error(REC_DISMISSED_INVALID);
      }
      const next = encodePrivateStringSet([...dismissed, normalizedId]);
      if (next.length > MAX_DISMISSED_RECORD_CHARS) {
        throw new Error(REC_DISMISSED_INVALID);
      }
      return next;
    });
    lease.assertCurrent();
  });
}

/** Test/seed reset. */
export async function clearRecState(): Promise<void> {
  const [preferences, dismissed] = await Promise.all([
    readRecommendationPreferences(),
    readDismissedRecommendations(),
  ]);
  preferencesFromRead(preferences);
  dismissedFromRead(dismissed);
  await multiRemovePrivateItems([PREF_KEY, DISMISSED_KEY]);
}
