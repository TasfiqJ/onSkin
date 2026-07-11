import type { GoalId, PregnancyStatus, SkinAxis } from '@onskin/types';
import { GOALS, SKIN_AXES } from '@onskin/types';

import { getPrivateItem, removePrivateItem, setPrivateItem } from '@/lib/storage/privateKV';

import type { SkinProfileResult } from './quiz';

// Local-first onboarding-completion record (D-029, the pattern shared with the
// shelf / completions / cycle stores). The server `skin_profiles` row is the
// eventual sync target (B-SUPABASE), but in v1 this AsyncStorage record is the
// SOURCE OF TRUTH for "has this user finished onboarding?" so a failed or slow
// server write never strands a returning user back at the start of onboarding
// (the entry gate in app/index.tsx previously read only the never-populated
// server table). It also preserves the computed reveal data across a cold start.
const KEY = 'onskin.skinprofile.v1';
const GOAL_IDS = new Set<GoalId>(GOALS.map((goal) => goal.id));
const PREGNANCY_STATUSES = new Set<PregnancyStatus>([
  'none',
  'pregnant',
  'breastfeeding',
  'prefer_not',
]);

export type StoredSkinProfile = {
  result: SkinProfileResult;
  goals: GoalId[];
  completedAt: string; // ISO
};

export type StoredSkinProfileRead =
  | { status: 'available'; profile: StoredSkinProfile }
  | { status: 'missing' | 'unavailable' | 'invalid'; profile: null };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function isoString(value: unknown): string | null {
  const text = nonEmptyString(value);
  return text && !Number.isNaN(Date.parse(text)) ? text : null;
}

function boundedNumber(value: unknown, min: number, max: number): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
    ? value
    : null;
}

function integerOrNull(value: unknown, min: number, max: number): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
    ? value
    : null;
}

function normalizeAxisMap(
  value: unknown,
  validator: (axisValue: unknown) => number | null,
): Record<SkinAxis, number> | null {
  if (!isRecord(value)) return null;
  const out = {} as Record<SkinAxis, number>;
  for (const axis of SKIN_AXES) {
    const axisValue = validator(value[axis]);
    if (axisValue == null) return null;
    out[axis] = axisValue;
  }
  return out;
}

function normalizeStringList(value: unknown): string[] {
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

function normalizeGoals(value: unknown): GoalId[] | null {
  if (!Array.isArray(value)) return null;
  const goals = [
    ...new Set(
      value
        .filter((goal): goal is string => typeof goal === 'string')
        .map((goal) => goal.trim())
        .filter((goal): goal is GoalId => GOAL_IDS.has(goal as GoalId)),
    ),
  ];
  return goals.length > 0 ? goals : null;
}

function normalizeDspt(value: unknown): string | null {
  const dspt = nonEmptyString(value)?.toUpperCase() ?? null;
  return dspt && /^[OD][SR][PN][WT]$/.test(dspt) ? dspt : null;
}

function normalizeResult(value: unknown): SkinProfileResult | null {
  if (!isRecord(value)) return null;
  const axes = normalizeAxisMap(value.axes, (axisValue) => boundedNumber(axisValue, 0, 1));
  const axisScores = normalizeAxisMap(value.axisScores, (axisValue) =>
    typeof axisValue === 'number' && Number.isFinite(axisValue) ? axisValue : null,
  );
  const dspt = normalizeDspt(value.dspt);
  const fitzpatrick = value.fitzpatrick == null ? null : integerOrNull(value.fitzpatrick, 1, 6);
  const monkTone = value.monkTone == null ? null : integerOrNull(value.monkTone, 1, 10);
  const pregnancy = nonEmptyString(value.pregnancyStatus);
  const pregnancyStatus =
    pregnancy && PREGNANCY_STATUSES.has(pregnancy as PregnancyStatus)
      ? (pregnancy as PregnancyStatus)
      : null;

  if (!axes || !axisScores || !dspt || !pregnancyStatus) return null;
  if (value.fitzpatrick != null && fitzpatrick == null) return null;
  if (value.monkTone != null && monkTone == null) return null;

  return {
    axes,
    axisScores,
    dspt,
    fitzpatrick,
    monkTone,
    sensitivities: normalizeStringList(value.sensitivities),
    pregnancyStatus,
  };
}

function normalizeStoredSkinProfile(value: unknown): StoredSkinProfile | null {
  if (!isRecord(value)) return null;
  const result = normalizeResult(value.result);
  const goals = normalizeGoals(value.goals);
  const completedAt = isoString(value.completedAt);
  if (!result || !goals || !completedAt) return null;
  return { result, goals, completedAt };
}

export async function readStoredSkinProfile(): Promise<StoredSkinProfileRead> {
  let raw: string | null = null;
  try {
    raw = await getPrivateItem(KEY);
  } catch {
    return { status: 'unavailable', profile: null };
  }
  if (!raw) return { status: 'missing', profile: null };
  try {
    const parsed: unknown = JSON.parse(raw);
    const normalized = normalizeStoredSkinProfile(parsed);
    if (!normalized) {
      return { status: 'invalid', profile: null };
    }
    if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
      await setPrivateItem(KEY, JSON.stringify(normalized)).catch(() => undefined);
    }
    return { status: 'available', profile: normalized };
  } catch {
    return { status: 'invalid', profile: null };
  }
}

export async function getStoredSkinProfile(): Promise<StoredSkinProfile | null> {
  const result = await readStoredSkinProfile();
  return result.status === 'available' ? result.profile : null;
}

export async function setStoredSkinProfile(rec: StoredSkinProfile): Promise<void> {
  const normalized = normalizeStoredSkinProfile(rec);
  if (!normalized) throw new Error('INVALID_SKIN_PROFILE_RECORD');
  await setPrivateItem(KEY, JSON.stringify(normalized));
}

export async function updateStoredPregnancyStatus(
  pregnancyStatus: PregnancyStatus,
): Promise<StoredSkinProfile> {
  if (!PREGNANCY_STATUSES.has(pregnancyStatus)) {
    throw new Error('INVALID_PREGNANCY_STATUS');
  }
  const current = await getStoredSkinProfile();
  if (!current) throw new Error('SKIN_PROFILE_UNAVAILABLE');

  const next: StoredSkinProfile = {
    ...current,
    result: { ...current.result, pregnancyStatus },
  };
  await setStoredSkinProfile(next);
  return next;
}

/** Has the user completed onboarding on this device? (the entry-gate signal). */
export async function isOnboardedLocal(): Promise<boolean> {
  return (await getStoredSkinProfile()) !== null;
}

/** Cleared on account deletion / full reset (not on an in-session retry). */
export async function clearStoredSkinProfile(): Promise<void> {
  await removePrivateItem(KEY);
}
