import { describe, expect, it } from 'vitest';

import { getQuizCompletionState, ONBOARDING_QUIZ, type QuizAnswers } from './quiz';

function buildCompleteAnswers(): QuizAnswers {
  return Object.fromEntries(
    ONBOARDING_QUIZ.map((question) => [
      question.id,
      question.multiSelect === true ? [question.options[0]!.id] : question.options[0]!.id,
    ]),
  );
}

describe('onboarding quiz completion state', () => {
  it('treats an empty quiz as incomplete instead of ready for reveal scoring', () => {
    const state = getQuizCompletionState({});

    expect(state.complete).toBe(false);
    expect(state.answeredCount).toBe(0);
    expect(state.total).toBe(ONBOARDING_QUIZ.length);
    expect(state.missingQuestionIds).toEqual(ONBOARDING_QUIZ.map((question) => question.id));
  });

  it('requires every single-select and multi-select question to have a valid answer', () => {
    const completeAnswers = buildCompleteAnswers();

    expect(getQuizCompletionState(completeAnswers)).toEqual({
      answeredCount: ONBOARDING_QUIZ.length,
      total: ONBOARDING_QUIZ.length,
      complete: true,
      missingQuestionIds: [],
    });
  });

  it('rejects empty multi-select and stale option values', () => {
    const answers = buildCompleteAnswers();
    answers.q_sensitivities = [];
    answers.q_oil = 'stale-option';

    const state = getQuizCompletionState(answers);

    expect(state.complete).toBe(false);
    expect(state.missingQuestionIds).toEqual(['q_oil', 'q_sensitivities']);
  });
});
