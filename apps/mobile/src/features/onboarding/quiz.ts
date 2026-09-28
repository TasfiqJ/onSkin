import type { PregnancyStatus, SkinAxis } from '@layerwell/types';

import {
  ONBOARDING_QUIZ,
  QUIZ_AXIS_ORDER,
  QUIZ_AXIS_POLES,
  QUIZ_SCORING_PROVENANCE,
  type QuizQuestion,
  type QuizScoringProvenance,
} from './quizContract';

export {
  ONBOARDING_QUIZ,
  QUIZ_CONTRACT_ID,
  QUIZ_CONTRACT_REVIEW_STATUS,
  QUIZ_CONTENT_VERSION,
  QUIZ_SCORING_VERSION,
} from './quizContract';
export type { QuizOption, QuizOptionScore, QuizQuestion } from './quizContract';

/**
 * Skin-quiz scoring over the exact immutable draft contract.
 *
 * BLOCKED: B-QUIZ-COPY. The pinned draft content, scoring, and labels still
 * require professional IP/legal review and are not cleared for launch.
 */

export type QuizAnswers = Record<string, string | string[]>; // questionId -> optionId(s)

export type QuizCompletionState = {
  answeredCount: number;
  total: number;
  complete: boolean;
  missingQuestionIds: string[];
};

export function isQuizQuestionAnswered(
  question: QuizQuestion,
  answer: string | string[] | undefined,
): boolean {
  const optionIds = new Set(question.options.map((option) => option.id));
  if (question.multiSelect === true) {
    if (
      !Array.isArray(answer) ||
      answer.length === 0 ||
      new Set(answer).size !== answer.length ||
      !answer.every((optionId) => optionIds.has(optionId))
    ) {
      return false;
    }
    return !(answer.includes('none') && answer.length > 1);
  }
  return typeof answer === 'string' && optionIds.has(answer);
}

export function getQuizCompletionState(
  answers: QuizAnswers,
  quiz: readonly QuizQuestion[] = ONBOARDING_QUIZ,
): QuizCompletionState {
  const missingQuestionIds: string[] = [];
  for (const question of quiz) {
    if (!isQuizQuestionAnswered(question, answers[question.id])) {
      missingQuestionIds.push(question.id);
    }
  }
  return {
    answeredCount: quiz.length - missingQuestionIds.length,
    total: quiz.length,
    complete: missingQuestionIds.length === 0,
    missingQuestionIds,
  };
}

export function toggleExclusiveNoneSelection(
  current: readonly string[],
  optionId: string,
  noneOptionId = 'none',
): string[] {
  if (current.includes(optionId)) return current.filter((id) => id !== optionId);
  if (optionId === noneOptionId) return [noneOptionId];
  return [...current.filter((id) => id !== noneOptionId), optionId];
}

export type SkinProfileResult = {
  /** Compatibility projection derived only from integer basis points. */
  axes: Record<SkinAxis, number>;
  axisScores: Record<SkinAxis, number>;
  dspt: string;
  fitzpatrick: number | null;
  monkTone: number | null;
  sensitivities: string[];
  pregnancyStatus: PregnancyStatus;
};

export type ScoredQuizProfileResult = SkinProfileResult & {
  /** Authoritative normalized axis positions: integers in [0, 10_000]. */
  axesBasisPoints: Record<SkinAxis, number>;
  provenance: QuizScoringProvenance;
};

type CanonicalQuizAnswers = Record<string, string | readonly string[]>;

function invalidAnswers(reason: string): never {
  throw new Error(`QUIZ_ANSWERS_INVALID:${reason}`);
}

/**
 * Validate the entire answer set before scoring and canonicalize multiselect
 * values to contract option order. Nothing is defaulted, skipped, or repaired.
 */
export function canonicalizeCurrentQuizAnswers(answers: QuizAnswers): CanonicalQuizAnswers {
  const actualKeys = Object.keys(answers).sort();
  const expectedKeys = ONBOARDING_QUIZ.map((question) => question.id).sort();
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key, index) => key !== expectedKeys[index])
  ) {
    return invalidAnswers('question_key_set');
  }

  const canonical: CanonicalQuizAnswers = {};
  for (const question of ONBOARDING_QUIZ) {
    const answer = answers[question.id];
    const optionIds = new Set(question.options.map((option) => option.id));
    if (question.multiSelect === true) {
      if (!Array.isArray(answer) || answer.length === 0) {
        return invalidAnswers(`${question.id}:selection_required`);
      }
      if (new Set(answer).size !== answer.length) {
        return invalidAnswers(`${question.id}:duplicate_selection`);
      }
      if (!answer.every((optionId) => optionIds.has(optionId))) {
        return invalidAnswers(`${question.id}:unknown_option`);
      }
      if (answer.includes('none') && answer.length > 1) {
        return invalidAnswers(`${question.id}:none_not_exclusive`);
      }
      const selected = new Set(answer);
      canonical[question.id] = Object.freeze(
        question.options.filter((option) => selected.has(option.id)).map((option) => option.id),
      );
      continue;
    }

    if (typeof answer !== 'string') {
      return invalidAnswers(`${question.id}:single_selection_required`);
    }
    if (!optionIds.has(answer)) return invalidAnswers(`${question.id}:unknown_option`);
    canonical[question.id] = answer;
  }
  return Object.freeze(canonical);
}

function emptyAxisRecord(): Record<SkinAxis, number> {
  return {
    oily_dry: 0,
    sensitive_resistant: 0,
    pigmented_non: 0,
    wrinkled_tight: 0,
  };
}

function isSkinAxis(value: QuizQuestion['kind']): value is SkinAxis {
  return QUIZ_AXIS_ORDER.some((axis) => axis === value);
}

function contractError(reason: string): never {
  throw new Error(`QUIZ_CONTRACT_INVALID:${reason}`);
}

function exactBasisPoints(rawScore: number, axisMaximum: number, axis: SkinAxis): number {
  if (!Number.isSafeInteger(rawScore) || !Number.isSafeInteger(axisMaximum) || axisMaximum <= 0) {
    return contractError(`${axis}:axis_domain`);
  }
  const numerator = (rawScore + axisMaximum) * 10_000;
  const denominator = 2 * axisMaximum;
  if (!Number.isSafeInteger(numerator) || numerator % denominator !== 0) {
    return contractError(`${axis}:non_integral_basis_points`);
  }
  const basisPoints = numerator / denominator;
  if (basisPoints < 0 || basisPoints > 10_000) {
    return contractError(`${axis}:basis_points_range`);
  }
  return basisPoints;
}

/**
 * Score only the exact current immutable quiz.
 *
 * The optional identity parameter is a narrow compatibility bridge for the
 * existing onboarding context. A clone or any caller-supplied quiz is rejected
 * by identity and never influences scoring.
 */
export function scoreQuiz(
  answers: QuizAnswers,
  currentQuizIdentity: typeof ONBOARDING_QUIZ = ONBOARDING_QUIZ,
): ScoredQuizProfileResult {
  if (currentQuizIdentity !== ONBOARDING_QUIZ) {
    throw new Error('QUIZ_CONTRACT_IDENTITY_MISMATCH');
  }

  const canonicalAnswers = canonicalizeCurrentQuizAnswers(answers);
  const axisScores = emptyAxisRecord();
  const axisMaximums = emptyAxisRecord();
  let fitzpatrick: number | null = null;
  let monkTone: number | null = null;
  let sensitivities: string[] = [];
  let pregnancyStatus: PregnancyStatus | null = null;

  for (const question of ONBOARDING_QUIZ) {
    const answer = canonicalAnswers[question.id];
    if (question.kind === 'sensitivities') {
      if (!Array.isArray(answer)) return contractError(`${question.id}:answer_shape`);
      sensitivities = answer.filter((optionId) => optionId !== 'none');
      continue;
    }
    if (Array.isArray(answer)) return contractError(`${question.id}:answer_shape`);
    const chosen = question.options.find((option) => option.id === answer);
    if (!chosen) return contractError(`${question.id}:missing_canonical_option`);

    if (question.kind === 'pregnancy') {
      if (
        !(['none', 'pregnant', 'breastfeeding', 'prefer_not'] as const).includes(
          chosen.id as PregnancyStatus,
        )
      ) {
        return contractError(`${question.id}:pregnancy_mapping`);
      }
      pregnancyStatus = chosen.id as PregnancyStatus;
      continue;
    }
    if (question.kind === 'phototype' || question.kind === 'monk') {
      if (!Number.isSafeInteger(chosen.value)) {
        return contractError(`${question.id}:discrete_value`);
      }
      if (question.kind === 'phototype') fitzpatrick = chosen.value!;
      else monkTone = chosen.value!;
      continue;
    }
    if (!isSkinAxis(question.kind)) return contractError(`${question.id}:unknown_kind`);

    const axis = question.kind;
    const maxForQuestion = Math.max(
      ...question.options.map((option) => Math.abs(option.score?.[axis] ?? 0)),
    );
    const contribution = chosen.score?.[axis];
    if (
      !Number.isSafeInteger(maxForQuestion) ||
      maxForQuestion <= 0 ||
      !Number.isSafeInteger(contribution)
    ) {
      return contractError(`${question.id}:axis_score`);
    }
    for (const otherAxis of QUIZ_AXIS_ORDER) {
      if (otherAxis !== axis && chosen.score?.[otherAxis] !== undefined) {
        return contractError(`${question.id}:cross_axis_score`);
      }
    }
    axisMaximums[axis] += maxForQuestion;
    axisScores[axis] += contribution!;
  }

  if (fitzpatrick === null || monkTone === null || pregnancyStatus === null) {
    return contractError('required_output_missing');
  }

  const axesBasisPoints = emptyAxisRecord();
  const axes = emptyAxisRecord();
  let dspt = '';
  for (const axis of QUIZ_AXIS_ORDER) {
    const basisPoints = exactBasisPoints(axisScores[axis], axisMaximums[axis], axis);
    axesBasisPoints[axis] = basisPoints;
    axes[axis] = basisPoints / 10_000;
    dspt += axisScores[axis] >= 0 ? QUIZ_AXIS_POLES[axis].positive : QUIZ_AXIS_POLES[axis].negative;
  }

  return {
    axes,
    axesBasisPoints,
    axisScores,
    dspt,
    fitzpatrick,
    monkTone,
    sensitivities,
    pregnancyStatus,
    provenance: QUIZ_SCORING_PROVENANCE,
  };
}

export const AXIS_LABELS = QUIZ_AXIS_POLES;
