import { describe, expect, it } from 'vitest';

import { ONBOARDING_QUIZ } from './quiz';

const visibleQuizCopy = ONBOARDING_QUIZ.flatMap((question) => [
  question.eyebrow,
  question.prompt,
  ...question.options.map((option) => option.label),
  ...question.options.map((option) => option.subtitle ?? ''),
]);

describe('visible onboarding quiz copy', () => {
  it('does not expose scaffolding markers to users', () => {
    expect(visibleQuizCopy).not.toContainEqual(expect.stringMatching(/placeholder|pending b-quiz-copy/i));
  });
});
