import type { GoalId, PregnancyStatus, SkinAxis } from '@layerwell/types';
import { GOALS } from '@layerwell/types';

import {
  ONBOARDING_QUIZ,
  QUIZ_AXIS_ORDER,
  QUIZ_AXIS_POLES,
  QUIZ_SCORING_PROVENANCE,
} from './quizContract';

/**
 * The only server skin-profile tuple current source is permitted to consume.
 *
 * Version 2 is the first server schema that binds every derived field to the
 * exact quiz content/scoring contract. Legacy, future, partially deployed, or
 * mismatched rows are absence for readers; they are never repaired in place.
 */
export const CURRENT_SERVER_SKIN_PROFILE_PROVENANCE = Object.freeze({
  version: 2,
  quiz_contract_id: QUIZ_SCORING_PROVENANCE.contractId,
  quiz_content_version: QUIZ_SCORING_PROVENANCE.contentVersion,
  quiz_scoring_version: QUIZ_SCORING_PROVENANCE.scoringVersion,
  quiz_output_schema_version: QUIZ_SCORING_PROVENANCE.outputSchemaVersion,
  quiz_content_sha256: QUIZ_SCORING_PROVENANCE.contentSha256,
  quiz_scoring_sha256: QUIZ_SCORING_PROVENANCE.scoringSha256,
  quiz_contract_sha256: QUIZ_SCORING_PROVENANCE.contractSha256,
  quiz_review_status: QUIZ_SCORING_PROVENANCE.reviewStatus,
  quiz_pole_tie_rule: QUIZ_SCORING_PROVENANCE.poleTieRule,
});

export const CURRENT_SERVER_SKIN_PROFILE_SELECT = [
  'oily_dry',
  'sensitive_resistant',
  'pigmented_non',
  'wrinkled_tight',
  'dspt',
  'oily_dry_basis_points',
  'sensitive_resistant_basis_points',
  'pigmented_non_basis_points',
  'wrinkled_tight_basis_points',
  'fitzpatrick',
  'monk_tone',
  'sensitivities',
  'pregnancy_status',
  'goals',
  'completed_at',
  'version',
  'quiz_contract_id',
  'quiz_content_version',
  'quiz_scoring_version',
  'quiz_output_schema_version',
  'quiz_content_sha256',
  'quiz_scoring_sha256',
  'quiz_contract_sha256',
  'quiz_review_status',
  'quiz_pole_tie_rule',
].join(', ');

export const CURRENT_SERVER_SKIN_PROFILE_FILTERS = Object.freeze(
  Object.entries(CURRENT_SERVER_SKIN_PROFILE_PROVENANCE),
);

/** Device state is authoritative; only literal absence permits server recovery. */
export function isServerSkinProfileFallbackPermitted(localStatus: string): boolean {
  return localStatus === 'missing';
}

type FilterQuery = {
  eq(column: string, value: string | number): FilterQuery;
};

/** Apply every current-contract discriminator before selecting a candidate. */
export function applyCurrentServerSkinProfileFilters<T extends FilterQuery>(query: T): T {
  let filtered: FilterQuery = query;
  for (const [column, value] of CURRENT_SERVER_SKIN_PROFILE_FILTERS) {
    filtered = filtered.eq(column, value);
  }
  return filtered as T;
}

type AxisColumnMap = Record<
  SkinAxis,
  {
    raw: 'oily_dry' | 'sensitive_resistant' | 'pigmented_non' | 'wrinkled_tight';
    basis:
      | 'oily_dry_basis_points'
      | 'sensitive_resistant_basis_points'
      | 'pigmented_non_basis_points'
      | 'wrinkled_tight_basis_points';
  }
>;

const AXIS_COLUMNS: AxisColumnMap = {
  oily_dry: {
    raw: 'oily_dry',
    basis: 'oily_dry_basis_points',
  },
  sensitive_resistant: {
    raw: 'sensitive_resistant',
    basis: 'sensitive_resistant_basis_points',
  },
  pigmented_non: {
    raw: 'pigmented_non',
    basis: 'pigmented_non_basis_points',
  },
  wrinkled_tight: {
    raw: 'wrinkled_tight',
    basis: 'wrinkled_tight_basis_points',
  },
};

const OUTPUT_KEYS = Object.freeze(CURRENT_SERVER_SKIN_PROFILE_SELECT.split(', ').sort());
const GOAL_IDS = new Set<GoalId>(GOALS.map((goal) => goal.id));
const PREGNANCY_STATUSES = new Set<PregnancyStatus>([
  'none',
  'pregnant',
  'breastfeeding',
  'prefer_not',
]);

function buildAxisScoreDomain(axis: SkinAxis): {
  maximum: number;
  possible: ReadonlySet<number>;
} {
  let scores = new Set([0]);
  let maximum = 0;
  for (const question of ONBOARDING_QUIZ) {
    if (question.kind !== axis) continue;
    const contributions = question.options.map((option) => option.score?.[axis]);
    if (contributions.some((score) => !Number.isSafeInteger(score))) {
      throw new Error(`CURRENT_QUIZ_AXIS_SCORE_INVALID:${axis}`);
    }
    const integers = contributions as number[];
    const questionMaximum = Math.max(...integers.map((score) => Math.abs(score)));
    maximum += questionMaximum;
    scores = new Set([...scores].flatMap((current) => integers.map((score) => current + score)));
  }
  if (maximum <= 0 || scores.size === 0) {
    throw new Error(`CURRENT_QUIZ_AXIS_DOMAIN_MISSING:${axis}`);
  }
  return { maximum, possible: scores };
}

const AXIS_SCORE_DOMAINS = Object.freeze(
  Object.fromEntries(QUIZ_AXIS_ORDER.map((axis) => [axis, buildAxisScoreDomain(axis)])) as Record<
    SkinAxis,
    { maximum: number; possible: ReadonlySet<number> }
  >,
);

const SENSITIVITY_OPTION_ORDER = (() => {
  const question = ONBOARDING_QUIZ.find((candidate) => candidate.kind === 'sensitivities');
  if (!question) throw new Error('CURRENT_QUIZ_SENSITIVITY_DOMAIN_MISSING');
  return Object.freeze(
    question.options.filter((option) => option.id !== 'none').map((option) => option.id),
  );
})();
const SENSITIVITY_IDS = new Set(SENSITIVITY_OPTION_ORDER);

export type CurrentServerSkinProfile = {
  oily_dry: number;
  sensitive_resistant: number;
  pigmented_non: number;
  wrinkled_tight: number;
  dspt: string;
  oily_dry_basis_points: number;
  sensitive_resistant_basis_points: number;
  pigmented_non_basis_points: number;
  wrinkled_tight_basis_points: number;
  fitzpatrick: number;
  monk_tone: number;
  sensitivities: string[];
  pregnancy_status: PregnancyStatus;
  goals: GoalId[];
  completed_at: string;
  version: typeof CURRENT_SERVER_SKIN_PROFILE_PROVENANCE.version;
  quiz_contract_id: typeof CURRENT_SERVER_SKIN_PROFILE_PROVENANCE.quiz_contract_id;
  quiz_content_version: typeof CURRENT_SERVER_SKIN_PROFILE_PROVENANCE.quiz_content_version;
  quiz_scoring_version: typeof CURRENT_SERVER_SKIN_PROFILE_PROVENANCE.quiz_scoring_version;
  quiz_output_schema_version: typeof CURRENT_SERVER_SKIN_PROFILE_PROVENANCE.quiz_output_schema_version;
  quiz_content_sha256: typeof CURRENT_SERVER_SKIN_PROFILE_PROVENANCE.quiz_content_sha256;
  quiz_scoring_sha256: typeof CURRENT_SERVER_SKIN_PROFILE_PROVENANCE.quiz_scoring_sha256;
  quiz_contract_sha256: typeof CURRENT_SERVER_SKIN_PROFILE_PROVENANCE.quiz_contract_sha256;
  quiz_review_status: typeof CURRENT_SERVER_SKIN_PROFILE_PROVENANCE.quiz_review_status;
  quiz_pole_tie_rule: typeof CURRENT_SERVER_SKIN_PROFILE_PROVENANCE.quiz_pole_tie_rule;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function isIntegerInRange(value: unknown, minimum: number, maximum: number): value is number {
  return (
    typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum && value <= maximum
  );
}

function isCurrentProvenance(value: Record<string, unknown>): boolean {
  return Object.entries(CURRENT_SERVER_SKIN_PROFILE_PROVENANCE).every(
    ([column, expected]) => value[column] === expected,
  );
}

function isValidTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u.test(value)) {
    return false;
  }
  return !Number.isNaN(Date.parse(value));
}

function isValidGoals(value: unknown): value is GoalId[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= 2 &&
    value.every(
      (goal): goal is GoalId => typeof goal === 'string' && GOAL_IDS.has(goal as GoalId),
    ) &&
    new Set(value).size === value.length
  );
}

function isValidSensitivities(value: unknown): value is string[] {
  if (
    !Array.isArray(value) ||
    !value.every((item): item is string => typeof item === 'string' && SENSITIVITY_IDS.has(item)) ||
    new Set(value).size !== value.length
  ) {
    return false;
  }
  const positions = value.map((item) => SENSITIVITY_OPTION_ORDER.indexOf(item));
  return positions.every((position, index) => index === 0 || position > positions[index - 1]!);
}

/**
 * Validate a complete PostgREST projection as the exact current profile.
 *
 * Server filters reduce transfer and reject known legacy rows early, while
 * this independent runtime check protects against missing columns, filter
 * mistakes, partial deploys, corrupt outputs, and forged/mocked responses.
 */
export function parseCurrentServerSkinProfile(value: unknown): CurrentServerSkinProfile | null {
  if (!isRecord(value) || !hasExactKeys(value, OUTPUT_KEYS) || !isCurrentProvenance(value)) {
    return null;
  }

  let dspt = '';
  for (const axis of QUIZ_AXIS_ORDER) {
    const columns = AXIS_COLUMNS[axis];
    const raw = value[columns.raw];
    const basisPoints = value[columns.basis];
    const domain = AXIS_SCORE_DOMAINS[axis];
    if (
      typeof raw !== 'number' ||
      !Number.isSafeInteger(raw) ||
      !domain.possible.has(raw) ||
      !isIntegerInRange(basisPoints, 0, 10_000)
    ) {
      return null;
    }
    const numerator = (raw + domain.maximum) * 10_000;
    const denominator = 2 * domain.maximum;
    if (numerator % denominator !== 0 || basisPoints !== numerator / denominator) return null;
    dspt += raw >= 0 ? QUIZ_AXIS_POLES[axis].positive : QUIZ_AXIS_POLES[axis].negative;
  }

  if (
    value.dspt !== dspt ||
    !isIntegerInRange(value.fitzpatrick, 1, 6) ||
    !isIntegerInRange(value.monk_tone, 1, 10) ||
    !isValidSensitivities(value.sensitivities) ||
    typeof value.pregnancy_status !== 'string' ||
    !PREGNANCY_STATUSES.has(value.pregnancy_status as PregnancyStatus) ||
    !isValidGoals(value.goals) ||
    !isValidTimestamp(value.completed_at)
  ) {
    return null;
  }

  return value as CurrentServerSkinProfile;
}
