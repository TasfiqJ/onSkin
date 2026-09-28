import type { GoalId, PregnancyStatus, SkinAxis } from '@layerwell/types';
import { GOALS, SKIN_AXES } from '@layerwell/types';

import {
  runCurrentHealthDataOperation,
  type HealthDataWriteOperationLease,
} from '@/lib/consent/healthDataWriteAdmission';
import { getPrivateItem, removePrivateItem, updatePrivateItem } from '@/lib/storage/privateKV';

import type { ScoredQuizProfileResult } from './quiz';
import {
  ONBOARDING_QUIZ,
  QUIZ_AXIS_ORDER,
  QUIZ_AXIS_POLES,
  QUIZ_SCORING_PROVENANCE,
} from './quizContract';

// Keep the original key so pre-contract bytes remain discoverable for explicit
// recovery. Only an exact v2 receipt produced by the pinned quiz contract is an
// onboarding-completion authority.
const KEY = 'layerwell.skinprofile.v1';
const SCHEMA_VERSION = 2 as const;
const GOAL_IDS = new Set<GoalId>(GOALS.map((goal) => goal.id));
const PREGNANCY_STATUSES = new Set<PregnancyStatus>([
  'none',
  'pregnant',
  'breastfeeding',
  'prefer_not',
]);
const RESULT_KEYS = [
  'axes',
  'axesBasisPoints',
  'axisScores',
  'dspt',
  'fitzpatrick',
  'monkTone',
  'sensitivities',
  'pregnancyStatus',
  'provenance',
] as const;
const PROVENANCE_KEYS = [
  'contractId',
  'contentVersion',
  'scoringVersion',
  'outputSchemaVersion',
  'contentSha256',
  'scoringSha256',
  'contractSha256',
  'reviewStatus',
  'derivedFields',
  'poleTieRule',
] as const;

const SENSITIVITY_OPTIONS =
  ONBOARDING_QUIZ.find((question) => question.kind === 'sensitivities')?.options ?? [];
const SENSITIVITY_IDS = SENSITIVITY_OPTIONS.map((option) => option.id).filter(
  (optionId) => optionId !== 'none',
);
const AXIS_SCORE_DOMAINS = Object.fromEntries(
  QUIZ_AXIS_ORDER.map((axis) => {
    let possible = new Set([0]);
    let maximum = 0;
    for (const question of ONBOARDING_QUIZ) {
      if (question.kind !== axis) continue;
      const contributions = question.options.map((option) => option.score?.[axis]);
      if (contributions.some((score) => !Number.isSafeInteger(score))) {
        throw new Error(`CURRENT_QUIZ_AXIS_SCORE_INVALID:${axis}`);
      }
      const integerContributions = contributions as number[];
      maximum += Math.max(...integerContributions.map((score) => Math.abs(score)));
      possible = new Set(
        [...possible].flatMap((current) => integerContributions.map((score) => current + score)),
      );
    }
    if (maximum <= 0 || possible.size === 0) {
      throw new Error(`CURRENT_QUIZ_AXIS_DOMAIN_MISSING:${axis}`);
    }
    return [axis, { maximum, possible: possible as ReadonlySet<number> }];
  }),
) as Record<SkinAxis, { maximum: number; possible: ReadonlySet<number> }>;

export type StoredSkinProfile = {
  result: ScoredQuizProfileResult;
  goals: GoalId[];
  completedAt: string; // canonical ISO-8601
};

export type StoredSkinProfileRead =
  | { status: 'available'; profile: StoredSkinProfile }
  | {
      status:
        | 'missing'
        | 'legacy'
        | 'contract_mismatch'
        | 'unavailable'
        | 'invalid'
        | 'unsupported_version';
      profile: null;
    };

type StoredSkinProfileEnvelope = {
  version: typeof SCHEMA_VERSION;
  profile: StoredSkinProfile;
};

export const SKIN_PROFILE_INVALID = 'SKIN_PROFILE_INVALID';
export const SKIN_PROFILE_LEGACY = 'SKIN_PROFILE_LEGACY';
export const SKIN_PROFILE_CONTRACT_MISMATCH = 'SKIN_PROFILE_CONTRACT_MISMATCH';
export const SKIN_PROFILE_UNSUPPORTED_VERSION = 'SKIN_PROFILE_UNSUPPORTED_VERSION';

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

function isCanonicalIsoString(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0) return false;
  try {
    return new Date(value).toISOString() === value;
  } catch {
    return false;
  }
}

function isApprovedGoalList(value: unknown): value is GoalId[] {
  return (
    Array.isArray(value) &&
    value.length >= 1 &&
    value.length <= 2 &&
    new Set(value).size === value.length &&
    value.every((goal): goal is GoalId => typeof goal === 'string' && GOAL_IDS.has(goal as GoalId))
  );
}

function isExactAxisRecord(
  value: unknown,
  predicate: (axisValue: unknown, axis: SkinAxis) => boolean,
): value is Record<SkinAxis, number> {
  return (
    isRecord(value) &&
    hasExactKeys(value, SKIN_AXES) &&
    SKIN_AXES.every((axis) => predicate(value[axis], axis))
  );
}

function isStructurallyValidProvenance(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value) || !hasExactKeys(value, PROVENANCE_KEYS)) return false;
  if (
    typeof value.contractId !== 'string' ||
    typeof value.contentVersion !== 'string' ||
    typeof value.scoringVersion !== 'string' ||
    !Number.isSafeInteger(value.outputSchemaVersion) ||
    typeof value.contentSha256 !== 'string' ||
    typeof value.scoringSha256 !== 'string' ||
    typeof value.contractSha256 !== 'string' ||
    typeof value.reviewStatus !== 'string' ||
    typeof value.poleTieRule !== 'string' ||
    !Array.isArray(value.derivedFields) ||
    !value.derivedFields.every((field) => typeof field === 'string')
  ) {
    return false;
  }
  return true;
}

function isExactCurrentProvenance(
  value: Record<string, unknown>,
): value is ScoredQuizProfileResult['provenance'] {
  const expected = QUIZ_SCORING_PROVENANCE;
  return (
    value.contractId === expected.contractId &&
    value.contentVersion === expected.contentVersion &&
    value.scoringVersion === expected.scoringVersion &&
    value.outputSchemaVersion === expected.outputSchemaVersion &&
    value.contentSha256 === expected.contentSha256 &&
    value.scoringSha256 === expected.scoringSha256 &&
    value.contractSha256 === expected.contractSha256 &&
    value.reviewStatus === expected.reviewStatus &&
    value.poleTieRule === expected.poleTieRule &&
    Array.isArray(value.derivedFields) &&
    value.derivedFields.length === expected.derivedFields.length &&
    value.derivedFields.every((field, index) => field === expected.derivedFields[index])
  );
}

function isCanonicalSensitivityList(value: unknown): value is string[] {
  if (!Array.isArray(value) || new Set(value).size !== value.length) return false;
  let priorIndex = -1;
  for (const sensitivity of value) {
    if (typeof sensitivity !== 'string') return false;
    const index = SENSITIVITY_IDS.indexOf(sensitivity);
    if (index < 0 || index <= priorIndex) return false;
    priorIndex = index;
  }
  return true;
}

function expectedDspt(axisScores: Record<SkinAxis, number>): string {
  return QUIZ_AXIS_ORDER.map((axis) =>
    axisScores[axis] >= 0 ? QUIZ_AXIS_POLES[axis].positive : QUIZ_AXIS_POLES[axis].negative,
  ).join('');
}

function currentResultShapeKind(value: unknown): 'current' | 'contract_mismatch' | 'invalid' {
  if (!isRecord(value) || !hasExactKeys(value, RESULT_KEYS)) return 'invalid';
  if (
    !isExactAxisRecord(
      value.axisScores,
      (axisValue, axis) =>
        typeof axisValue === 'number' &&
        Number.isSafeInteger(axisValue) &&
        AXIS_SCORE_DOMAINS[axis].possible.has(axisValue),
    ) ||
    !isExactAxisRecord(
      value.axesBasisPoints,
      (axisValue) =>
        typeof axisValue === 'number' &&
        Number.isSafeInteger(axisValue) &&
        axisValue >= 0 &&
        axisValue <= 10_000,
    ) ||
    !isExactAxisRecord(
      value.axes,
      (axisValue) => typeof axisValue === 'number' && Number.isFinite(axisValue),
    )
  ) {
    return 'invalid';
  }

  const axisScores = value.axisScores;
  const axesBasisPoints = value.axesBasisPoints;
  const axes = value.axes;
  for (const axis of QUIZ_AXIS_ORDER) {
    const maximum = AXIS_SCORE_DOMAINS[axis].maximum;
    const numerator = (axisScores[axis] + maximum) * 10_000;
    const denominator = 2 * maximum;
    if (
      maximum <= 0 ||
      !Number.isSafeInteger(numerator) ||
      numerator % denominator !== 0 ||
      axesBasisPoints[axis] !== numerator / denominator ||
      axes[axis] !== axesBasisPoints[axis] / 10_000
    ) {
      return 'invalid';
    }
  }

  if (
    typeof value.dspt !== 'string' ||
    value.dspt !== expectedDspt(axisScores) ||
    !Number.isSafeInteger(value.fitzpatrick) ||
    (value.fitzpatrick as number) < 1 ||
    (value.fitzpatrick as number) > 6 ||
    !Number.isSafeInteger(value.monkTone) ||
    (value.monkTone as number) < 1 ||
    (value.monkTone as number) > 10 ||
    !isCanonicalSensitivityList(value.sensitivities) ||
    typeof value.pregnancyStatus !== 'string' ||
    !PREGNANCY_STATUSES.has(value.pregnancyStatus as PregnancyStatus) ||
    !isStructurallyValidProvenance(value.provenance)
  ) {
    return 'invalid';
  }

  return isExactCurrentProvenance(value.provenance) ? 'current' : 'contract_mismatch';
}

function currentProfileShapeKind(value: unknown): 'current' | 'contract_mismatch' | 'invalid' {
  if (!isRecord(value) || !hasExactKeys(value, ['result', 'goals', 'completedAt'])) {
    return 'invalid';
  }
  if (!isApprovedGoalList(value.goals) || !isCanonicalIsoString(value.completedAt)) {
    return 'invalid';
  }
  return currentResultShapeKind(value.result);
}

function isStrictCurrentProfile(value: unknown): value is StoredSkinProfile {
  return currentProfileShapeKind(value) === 'current';
}

// Old v1/unversioned bytes are validated only to distinguish a legitimate
// legacy receipt from corrupt data. They are never returned as a usable
// profile and never unlock onboarding.
function isLegacyAxisRecord(value: unknown, validator: (axisValue: unknown) => boolean): boolean {
  return isRecord(value) && SKIN_AXES.every((axis) => validator(value[axis]));
}

function isValidLegacyProfile(value: unknown): boolean {
  if (!isRecord(value) || !isRecord(value.result)) return false;
  const result = value.result;
  const dspt = typeof result.dspt === 'string' ? result.dspt.trim().toUpperCase() : '';
  const pregnancy = typeof result.pregnancyStatus === 'string' ? result.pregnancyStatus.trim() : '';
  const goals = Array.isArray(value.goals)
    ? [
        ...new Set(
          value.goals
            .filter((goal): goal is string => typeof goal === 'string')
            .map((goal) => goal.trim())
            .filter((goal): goal is GoalId => GOAL_IDS.has(goal as GoalId)),
        ),
      ]
    : [];
  return (
    isLegacyAxisRecord(
      result.axes,
      (axisValue) =>
        typeof axisValue === 'number' &&
        Number.isFinite(axisValue) &&
        axisValue >= 0 &&
        axisValue <= 1,
    ) &&
    isLegacyAxisRecord(
      result.axisScores,
      (axisValue) => typeof axisValue === 'number' && Number.isFinite(axisValue),
    ) &&
    /^[OD][SR][PN][WT]$/.test(dspt) &&
    (result.fitzpatrick == null ||
      (Number.isInteger(result.fitzpatrick) &&
        (result.fitzpatrick as number) >= 1 &&
        (result.fitzpatrick as number) <= 6)) &&
    (result.monkTone == null ||
      (Number.isInteger(result.monkTone) &&
        (result.monkTone as number) >= 1 &&
        (result.monkTone as number) <= 10)) &&
    Array.isArray(result.sensitivities) &&
    PREGNANCY_STATUSES.has(pregnancy as PregnancyStatus) &&
    goals.length >= 1 &&
    typeof value.completedAt === 'string' &&
    !Number.isNaN(Date.parse(value.completedAt))
  );
}

function classifyStoredSkinProfile(raw: string): StoredSkinProfileRead {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return { status: 'invalid', profile: null };
  }
  if (!isRecord(parsed)) return { status: 'invalid', profile: null };

  if (!hasOwn(parsed, 'version')) {
    return isValidLegacyProfile(parsed)
      ? { status: 'legacy', profile: null }
      : { status: 'invalid', profile: null };
  }

  if (
    typeof parsed.version === 'number' &&
    Number.isSafeInteger(parsed.version) &&
    parsed.version > SCHEMA_VERSION
  ) {
    return { status: 'unsupported_version', profile: null };
  }
  if (parsed.version === 1) {
    return hasExactKeys(parsed, ['version', 'profile']) && isValidLegacyProfile(parsed.profile)
      ? { status: 'legacy', profile: null }
      : { status: 'invalid', profile: null };
  }
  if (parsed.version !== SCHEMA_VERSION || !hasExactKeys(parsed, ['version', 'profile'])) {
    return { status: 'invalid', profile: null };
  }

  const kind = currentProfileShapeKind(parsed.profile);
  if (kind === 'current') {
    return { status: 'available', profile: parsed.profile as StoredSkinProfile };
  }
  if (kind === 'contract_mismatch') {
    return { status: 'contract_mismatch', profile: null };
  }
  return { status: 'invalid', profile: null };
}

function errorForStoredStatus(status: StoredSkinProfileRead['status']): Error {
  switch (status) {
    case 'legacy':
      return new Error(SKIN_PROFILE_LEGACY);
    case 'contract_mismatch':
      return new Error(SKIN_PROFILE_CONTRACT_MISMATCH);
    case 'unsupported_version':
      return new Error(SKIN_PROFILE_UNSUPPORTED_VERSION);
    case 'missing':
      return new Error('SKIN_PROFILE_UNAVAILABLE');
    default:
      return new Error(SKIN_PROFILE_INVALID);
  }
}

function encodeStoredSkinProfile(profile: StoredSkinProfile): string {
  return JSON.stringify({
    version: SCHEMA_VERSION,
    profile,
  } satisfies StoredSkinProfileEnvelope);
}

async function readStoredSkinProfileForLease(
  lease: HealthDataWriteOperationLease,
): Promise<StoredSkinProfileRead> {
  let raw: string | null;
  try {
    lease.assertCurrent();
    raw = await getPrivateItem(KEY);
    lease.assertCurrent();
  } catch {
    lease.assertCurrent();
    return { status: 'unavailable', profile: null };
  }
  const result =
    raw === null ? ({ status: 'missing', profile: null } as const) : classifyStoredSkinProfile(raw);
  lease.assertCurrent();
  return result;
}

export function readStoredSkinProfile(): Promise<StoredSkinProfileRead> {
  return runCurrentHealthDataOperation((lease) => readStoredSkinProfileForLease(lease));
}

export function getStoredSkinProfile(): Promise<StoredSkinProfile | null> {
  return runCurrentHealthDataOperation(async (lease) => {
    const result = await readStoredSkinProfileForLease(lease);
    lease.assertCurrent();
    return result.status === 'available' ? result.profile : null;
  });
}

async function writeStoredSkinProfile(
  rec: StoredSkinProfile,
  recoverInvalidExistingReceipt: boolean,
): Promise<void> {
  if (!isStrictCurrentProfile(rec)) throw new Error('INVALID_SKIN_PROFILE_RECORD');
  await runCurrentHealthDataOperation(async (lease) => {
    lease.assertCurrent();
    await updatePrivateItem(KEY, (current) => {
      lease.assertCurrent();
      if (current !== null) {
        const existing = classifyStoredSkinProfile(current);
        if (
          existing.status !== 'available' &&
          existing.status !== 'legacy' &&
          existing.status !== 'contract_mismatch' &&
          !(
            recoverInvalidExistingReceipt &&
            (existing.status === 'invalid' || existing.status === 'unsupported_version')
          )
        ) {
          throw errorForStoredStatus(existing.status);
        }
      }
      lease.assertCurrent();
      return encodeStoredSkinProfile(rec);
    });
    lease.assertCurrent();
  });
}

export function setStoredSkinProfile(rec: StoredSkinProfile): Promise<void> {
  return writeStoredSkinProfile(rec, false);
}

/**
 * Commits a profile scored from a newly completed, current-contract quiz.
 *
 * Unlike general profile mutation, this explicit recovery path may replace
 * corrupt or future-version bytes. updatePrivateItem keeps the replacement
 * atomic: the prior receipt remains untouched unless the new current receipt
 * is durably written.
 */
export function setStoredSkinProfileFromExplicitQuiz(rec: StoredSkinProfile): Promise<void> {
  return writeStoredSkinProfile(rec, true);
}

export async function updateStoredPregnancyStatus(
  pregnancyStatus: PregnancyStatus,
): Promise<StoredSkinProfile> {
  if (!PREGNANCY_STATUSES.has(pregnancyStatus)) {
    throw new Error('INVALID_PREGNANCY_STATUS');
  }
  return runCurrentHealthDataOperation(async (lease) => {
    let next: StoredSkinProfile | null = null;
    lease.assertCurrent();
    await updatePrivateItem(KEY, (currentRaw) => {
      lease.assertCurrent();
      if (currentRaw === null) throw new Error('SKIN_PROFILE_UNAVAILABLE');
      const current = classifyStoredSkinProfile(currentRaw);
      if (current.status !== 'available') throw errorForStoredStatus(current.status);
      next = {
        ...current.profile,
        result: { ...current.profile.result, pregnancyStatus },
      };
      if (!isStrictCurrentProfile(next)) throw new Error(SKIN_PROFILE_INVALID);
      lease.assertCurrent();
      return encodeStoredSkinProfile(next);
    });
    lease.assertCurrent();
    if (!next) throw new Error('SKIN_PROFILE_UNAVAILABLE');
    return next;
  });
}

/** Only an exact current contract receipt is an onboarding gate signal. */
export function isOnboardedLocal(): Promise<boolean> {
  return runCurrentHealthDataOperation(async (lease) => {
    const result = await readStoredSkinProfileForLease(lease);
    lease.assertCurrent();
    return result.status === 'available';
  });
}

/** Cleared on account deletion / full reset (not on an in-session retry). */
export async function clearStoredSkinProfile(): Promise<void> {
  // Closed-consent cleanup: deletion is account-scoped and never reads plaintext.
  await removePrivateItem(KEY);
}
