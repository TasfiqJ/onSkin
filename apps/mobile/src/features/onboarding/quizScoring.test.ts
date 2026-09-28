import { describe, expect, it } from 'vitest';

import {
  canonicalizeCurrentQuizAnswers,
  ONBOARDING_QUIZ,
  scoreQuiz,
  type QuizAnswers,
} from './quiz';

function completeAnswers(): QuizAnswers {
  return Object.fromEntries(
    ONBOARDING_QUIZ.map((question) => [
      question.id,
      question.multiSelect === true ? [question.options[0]!.id] : question.options[0]!.id,
    ]),
  );
}

describe('deterministic onboarding quiz scoring', () => {
  it('scores a complete exact answer set with integer raw and basis-point authority', () => {
    const result = scoreQuiz(completeAnswers());

    expect(result).toMatchObject({
      axisScores: {
        oily_dry: -4,
        sensitive_resistant: 4,
        pigmented_non: 4,
        wrinkled_tight: 4,
      },
      axesBasisPoints: {
        oily_dry: 0,
        sensitive_resistant: 10_000,
        pigmented_non: 10_000,
        wrinkled_tight: 10_000,
      },
      axes: {
        oily_dry: 0,
        sensitive_resistant: 1,
        pigmented_non: 1,
        wrinkled_tight: 1,
      },
      dspt: 'DSPW',
      fitzpatrick: 1,
      monkTone: 1,
      sensitivities: ['fragrance'],
      pregnancyStatus: 'none',
    });
    expect(Object.values(result.axisScores).every(Number.isSafeInteger)).toBe(true);
    expect(Object.values(result.axesBasisPoints).every(Number.isSafeInteger)).toBe(true);
  });

  it('uses the explicit positive-pole rule for every exact zero tie', () => {
    const answers = completeAnswers();
    answers.q_oil = 'b';
    answers.q_hydration = 'b';
    answers.q_react = 'a';
    answers.q_redness = 'c';
    answers.q_tone = 'a';
    answers.q_marks = 'c';
    answers.q_lines = 'a';
    answers.q_sun = 'c';

    const result = scoreQuiz(answers);

    expect(result.axisScores).toEqual({
      oily_dry: 0,
      sensitive_resistant: 0,
      pigmented_non: 0,
      wrinkled_tight: 0,
    });
    expect(result.axesBasisPoints).toEqual({
      oily_dry: 5_000,
      sensitive_resistant: 5_000,
      pigmented_non: 5_000,
      wrinkled_tight: 5_000,
    });
    expect(result.dspt).toBe('OSPW');
  });

  it('canonicalizes multiselect values to contract order without retaining none', () => {
    const answers = completeAnswers();
    answers.q_sensitivities = ['alcohol', 'fragrance', 'essential_oils'];

    expect(canonicalizeCurrentQuizAnswers(answers).q_sensitivities).toEqual([
      'fragrance',
      'essential_oils',
      'alcohol',
    ]);
    expect(scoreQuiz(answers).sensitivities).toEqual(['fragrance', 'essential_oils', 'alcohol']);

    answers.q_sensitivities = ['none'];
    expect(scoreQuiz(answers).sensitivities).toEqual([]);
  });

  it.each([
    [
      'missing question',
      (answers: QuizAnswers) => {
        delete answers.q_oil;
      },
      'QUIZ_ANSWERS_INVALID:question_key_set',
    ],
    [
      'extra question',
      (answers: QuizAnswers) => {
        answers.q_unknown = 'a';
      },
      'QUIZ_ANSWERS_INVALID:question_key_set',
    ],
    [
      'unknown option',
      (answers: QuizAnswers) => {
        answers.q_oil = 'stale';
      },
      'QUIZ_ANSWERS_INVALID:q_oil:unknown_option',
    ],
    [
      'duplicate multiselect option',
      (answers: QuizAnswers) => {
        answers.q_sensitivities = ['fragrance', 'fragrance'];
      },
      'QUIZ_ANSWERS_INVALID:q_sensitivities:duplicate_selection',
    ],
    [
      'none combined with a concrete option',
      (answers: QuizAnswers) => {
        answers.q_sensitivities = ['none', 'fragrance'];
      },
      'QUIZ_ANSWERS_INVALID:q_sensitivities:none_not_exclusive',
    ],
  ])('rejects %s before scoring', (_label, mutate, reason) => {
    const answers = completeAnswers();
    mutate(answers);
    expect(() => scoreQuiz(answers)).toThrow(reason);
  });

  it('rejects a cloned or caller-supplied quiz and always uses the immutable current contract', () => {
    const clonedQuiz = [...ONBOARDING_QUIZ] as typeof ONBOARDING_QUIZ;
    expect(() => scoreQuiz(completeAnswers(), clonedQuiz)).toThrow(
      'QUIZ_CONTRACT_IDENTITY_MISMATCH',
    );
  });

  it('returns exact contract provenance without raw answers or answer hashes', () => {
    const result = scoreQuiz(completeAnswers());
    const serialized = JSON.stringify(result);

    expect(result.provenance).toMatchObject({
      reviewStatus: 'launch-blocked',
      outputSchemaVersion: 1,
      poleTieRule: 'raw_score_greater_than_or_equal_to_zero_uses_positive_pole',
    });
    expect(Object.keys(result.provenance).some((key) => /answer/i.test(key))).toBe(false);
    for (const question of ONBOARDING_QUIZ) {
      expect(serialized).not.toContain(question.id);
    }
  });
});
