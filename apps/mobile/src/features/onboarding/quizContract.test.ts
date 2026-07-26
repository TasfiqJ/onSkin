import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  canonicalSemanticJson,
  ONBOARDING_QUIZ,
  QUIZ_COMBINED_MANIFEST,
  QUIZ_CONTENT_MANIFEST,
  QUIZ_CONTENT_SHA256,
  QUIZ_CONTRACT_REVIEW_STATUS,
  QUIZ_CONTRACT_SHA256,
  QUIZ_SCORING_MANIFEST,
  QUIZ_SCORING_SHA256,
} from './quizContract';

function sha256(value: unknown): string {
  return createHash('sha256')
    .update(canonicalSemanticJson(value as Parameters<typeof canonicalSemanticJson>[0]), 'utf8')
    .digest('hex');
}

function mutableManifest<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe('onboarding quiz semantic contract', () => {
  it('pins exact canonical content, scoring, and combined SHA-256 digests', () => {
    expect(sha256(QUIZ_CONTENT_MANIFEST)).toBe(QUIZ_CONTENT_SHA256);
    expect(sha256(QUIZ_SCORING_MANIFEST)).toBe(QUIZ_SCORING_SHA256);
    expect(sha256(QUIZ_COMBINED_MANIFEST)).toBe(QUIZ_CONTRACT_SHA256);
  });

  it('keeps the draft launch-blocked and the scorer input deeply immutable', () => {
    expect(QUIZ_CONTRACT_REVIEW_STATUS).toBe('launch-blocked');
    expect(Object.isFrozen(ONBOARDING_QUIZ)).toBe(true);
    for (const question of ONBOARDING_QUIZ) {
      expect(Object.isFrozen(question)).toBe(true);
      expect(Object.isFrozen(question.options)).toBe(true);
      for (const option of question.options) {
        expect(Object.isFrozen(option)).toBe(true);
        if (option.score) expect(Object.isFrozen(option.score)).toBe(true);
      }
    }
  });

  it('changes the governed digest for copy, order, scoring, and tie-rule mutations', () => {
    const changedCopy = mutableManifest(QUIZ_CONTENT_MANIFEST);
    changedCopy.questions[0]!.prompt = `${changedCopy.questions[0]!.prompt} changed`;
    expect(sha256(changedCopy)).not.toBe(QUIZ_CONTENT_SHA256);

    const changedOrder = mutableManifest(QUIZ_CONTENT_MANIFEST);
    changedOrder.questions.reverse();
    expect(sha256(changedOrder)).not.toBe(QUIZ_CONTENT_SHA256);

    const changedScore = mutableManifest(QUIZ_SCORING_MANIFEST);
    changedScore.questions[0]!.options[0]!.score.oily_dry = -1;
    expect(sha256(changedScore)).not.toBe(QUIZ_SCORING_SHA256);

    const changedTie = mutableManifest(QUIZ_SCORING_MANIFEST);
    Object.assign(changedTie.rules, {
      poleTieRule: 'raw_score_greater_than_zero_uses_positive_pole',
    });
    expect(sha256(changedTie)).not.toBe(QUIZ_SCORING_SHA256);
  });

  it('canonicalizes object key order while preserving meaningful array order', () => {
    expect(canonicalSemanticJson({ b: 2, a: 1 })).toBe(canonicalSemanticJson({ a: 1, b: 2 }));
    expect(canonicalSemanticJson(['a', 'b'])).not.toBe(canonicalSemanticJson(['b', 'a']));
    expect(() => canonicalSemanticJson(Number.NaN)).toThrow('QUIZ_CONTRACT_NON_FINITE_NUMBER');
  });
});
