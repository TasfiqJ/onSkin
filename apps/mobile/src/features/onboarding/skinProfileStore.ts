import type { GoalId, PregnancyStatus, SkinAxis } from '@onskin/types';
import { GOALS, SKIN_AXES } from '@onskin/types';

import {
  readPrivateItem,
  removePrivateItem,
  type PrivateKVReadFailureReason,
  type PrivateKVReadResult,
  updatePrivateItem,
} from '@/lib/storage/privateKV';

import type { SkinProfileResult } from './quiz';

// Local-first onboarding-completion record (D-029, the pattern shared with the
// shelf / completions / cycle stores). The server `skin_profiles` row is the
// eventual sync target (B-SUPABASE), but in v1 this AsyncStorage record is the
// SOURCE OF TRUTH for "has this user finished onboarding?" so a failed or slow
// server write never strands a returning user back at the start of onboarding
// (the entry gate in app/index.tsx previously read only the never-populated
// server table). It also preserves the computed reveal data across a cold start.
const KEY = 'onskin.skinprofile.v1';
const SCHEMA_VERSION = 1 as const;
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
  | { status: 'missing'; profile: null }
  | { status: 'unavailable'; profile: null; reason: PrivateKVReadFailureReason }
  | {
      status: 'invalid';
      profile: null;
      reason:
        | Extract<PrivateKVReadResult, { status: 'corrupt' }>['reason']
        | 'invalid_record';
    }
  | { status: 'unsupported_version'; profile: null };

type StoredSkinProfileEnvelope = {
  version: typeof SCHEMA_VERSION;
  profile: StoredSkinProfile;
};

export const SKIN_PROFILE_INVALID = 'SKIN_PROFILE_INVALID';
export const SKIN_PROFILE_UNAVAILABLE = 'SKIN_PROFILE_UNAVAILABLE';
export const SKIN_PROFILE_UNSUPPORTED_VERSION = 'SKIN_PROFILE_UNSUPPORTED_VERSION';

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

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === expected.length && expected.every((key) => hasOwn(value, key));
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'undefined';
}

function isStrictCurrentProfile(value: unknown): value is StoredSkinProfile {
  if (!isRecord(value) || !hasExactKeys(value, ['result', 'goals', 'completedAt'])) return false;
  if (!isRecord(value.result)) return false;
  if (
    !hasExactKeys(value.result, [
      'axes',
      'axisScores',
      'dspt',
      'fitzpatrick',
      'monkTone',
      'sensitivities',
      'pregnancyStatus',
    ])
  ) {
    return false;
  }
  if (
    !isRecord(value.result.axes) ||
    !hasExactKeys(value.result.axes, SKIN_AXES) ||
    !isRecord(value.result.axisScores) ||
    !hasExactKeys(value.result.axisScores, SKIN_AXES)
  ) {
    return false;
  }
  const normalized = normalizeStoredSkinProfile(value);
  return normalized !== null && canonicalJson(normalized) === canonicalJson(value);
}

function decodeStoredSkinProfile(raw: string): StoredSkinProfile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error(SKIN_PROFILE_INVALID);
  }
  if (!isRecord(parsed)) throw new Error(SKIN_PROFILE_INVALID);

  if (hasOwn(parsed, 'version')) {
    if (parsed.version !== SCHEMA_VERSION) {
      if (
        typeof parsed.version === 'number' &&
        Number.isSafeInteger(parsed.version) &&
        parsed.version > SCHEMA_VERSION
      ) {
        throw new Error(SKIN_PROFILE_UNSUPPORTED_VERSION);
      }
      throw new Error(SKIN_PROFILE_INVALID);
    }
    if (
      !hasExactKeys(parsed, ['version', 'profile']) ||
      !isStrictCurrentProfile(parsed.profile)
    ) {
      throw new Error(SKIN_PROFILE_INVALID);
    }
    return parsed.profile;
  }

  const normalized = normalizeStoredSkinProfile(parsed);
  if (!normalized) throw new Error(SKIN_PROFILE_INVALID);
  return normalized;
}

function encodeStoredSkinProfile(profile: StoredSkinProfile): string {
  return JSON.stringify({
    version: SCHEMA_VERSION,
    profile,
  } satisfies StoredSkinProfileEnvelope);
}

export async function readStoredSkinProfile(): Promise<StoredSkinProfileRead> {
  const stored = await readPrivateItem(KEY);
  if (stored.status === 'absent') return { status: 'missing', profile: null };
  if (stored.status === 'unavailable') {
    return { status: 'unavailable', profile: null, reason: stored.reason };
  }
  if (stored.status === 'corrupt') {
    return { status: 'invalid', profile: null, reason: stored.reason };
  }
  if (stored.status === 'unsupported_version') {
    return { status: 'unsupported_version', profile: null };
  }
  try {
    return { status: 'available', profile: decodeStoredSkinProfile(stored.value) };
  } catch (error) {
    if (error instanceof Error && error.message === SKIN_PROFILE_UNSUPPORTED_VERSION) {
      return { status: 'unsupported_version', profile: null };
    }
    return { status: 'invalid', profile: null, reason: 'invalid_record' };
  }
}

/** Genuine absence is the only nullable state. Unreadable bytes fail closed. */
export async function getStoredSkinProfile(): Promise<StoredSkinProfile | null> {
  const result = await readStoredSkinProfile();
  if (result.status === 'available') return result.profile;
  if (result.status === 'missing') return null;
  if (result.status === 'unsupported_version') {
    throw new Error(SKIN_PROFILE_UNSUPPORTED_VERSION);
  }
  if (result.status === 'invalid') throw new Error(SKIN_PROFILE_INVALID);
  throw new Error(SKIN_PROFILE_UNAVAILABLE);
}

export type LocalOnboardingStatus = 'complete' | 'missing';

/**
 * Strict entry-gate read. Only a genuinely absent profile means onboarding can
 * continue or fall through to the server mirror. Unreadable or unrecognized
 * private bytes are retained for explicit recovery and must fail closed.
 */
export async function readLocalOnboardingStatus(): Promise<LocalOnboardingStatus> {
  const result = await readStoredSkinProfile();
  if (result.status === 'available') return 'complete';
  if (result.status === 'missing') return 'missing';
  if (result.status === 'unsupported_version') {
    throw new Error(SKIN_PROFILE_UNSUPPORTED_VERSION);
  }
  if (result.status === 'invalid') throw new Error(SKIN_PROFILE_INVALID);
  throw new Error(SKIN_PROFILE_UNAVAILABLE);
}

export async function setStoredSkinProfile(rec: StoredSkinProfile): Promise<void> {
  const normalized = normalizeStoredSkinProfile(rec);
  if (!normalized) throw new Error('INVALID_SKIN_PROFILE_RECORD');
  await updatePrivateItem(KEY, (current) => {
    if (current !== null) {
      const decoded = decodeStoredSkinProfile(current);
      if (canonicalJson(decoded) === canonicalJson(normalized)) return current;
    }
    return encodeStoredSkinProfile(normalized);
  });
}

export async function updateStoredPregnancyStatus(
  pregnancyStatus: PregnancyStatus,
): Promise<StoredSkinProfile> {
  if (!PREGNANCY_STATUSES.has(pregnancyStatus)) {
    throw new Error('INVALID_PREGNANCY_STATUS');
  }
  let next: StoredSkinProfile | null = null;
  await updatePrivateItem(KEY, (currentRaw) => {
    if (currentRaw === null) throw new Error(SKIN_PROFILE_UNAVAILABLE);
    const current = decodeStoredSkinProfile(currentRaw);
    if (current.result.pregnancyStatus === pregnancyStatus) {
      next = current;
      return currentRaw;
    }
    next = {
      ...current,
      result: { ...current.result, pregnancyStatus },
    };
    return encodeStoredSkinProfile(next);
  });
  if (!next) throw new Error(SKIN_PROFILE_UNAVAILABLE);
  return next;
}

/** Has the user completed onboarding on this device? (the entry-gate signal). */
export async function isOnboardedLocal(): Promise<boolean> {
  return (await readLocalOnboardingStatus()) === 'complete';
}

/** Cleared on account deletion / full reset (not on an in-session retry). */
export async function clearStoredSkinProfile(): Promise<void> {
  await removePrivateItem(KEY);
}
