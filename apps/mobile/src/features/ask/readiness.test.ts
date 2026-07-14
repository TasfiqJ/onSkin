import { onlineManager } from '@tanstack/react-query';
import { afterEach, describe, expect, it } from 'vitest';

import { answerQuestion, type AskContext } from './answer';
import { deriveAskReadiness, type AskDependencySnapshot } from './readiness';

const SUCCESS: AskDependencySnapshot = {
  isSuccess: true,
  isError: false,
  isLoading: false,
  isFetching: false,
};
const DISABLED_OR_PAUSED: AskDependencySnapshot = {
  isSuccess: false,
  isError: false,
  isLoading: false,
  isFetching: false,
};
const ERROR: AskDependencySnapshot = {
  isSuccess: false,
  isError: true,
  isLoading: false,
  isFetching: false,
};
const CONTEXT: AskContext = {
  conflicts: [],
  hasShelfProducts: false,
  pmSteps: [],
  isExamplePlan: true,
  hasReplenish: false,
  topRec: null,
  youreSet: true,
  goalConcernText: null,
  groundedAllowed: false,
  groundedReason: 'free_locked',
};

afterEach(() => {
  onlineManager.setOnline(true);
});

describe('Ask readiness', () => {
  it('keeps deterministic prompt submission ready while offline cloud queries are disabled', () => {
    onlineManager.setOnline(false);

    const state = deriveAskReadiness({
      local: [SUCCESS, SUCCESS, SUCCESS, SUCCESS],
      quotaFixtureEnabled: false,
      turns: DISABLED_OR_PAUSED,
    });
    const answer = answerQuestion('What should I do tonight?', CONTEXT);

    expect(onlineManager.isOnline()).toBe(false);
    expect(state).toEqual({
      isSuccess: true,
      isError: false,
      isLoading: false,
      isFetching: false,
    });
    expect(answer.kind).toBe('deterministic');
  });

  it('ignores unavailable cloud state in production route readiness', () => {
    expect(
      deriveAskReadiness({
        local: [SUCCESS, SUCCESS, SUCCESS, SUCCESS],
        quotaFixtureEnabled: false,
        turns: ERROR,
      }),
    ).toMatchObject({ isSuccess: true, isError: false });
  });

  it('fails closed when the explicit private-quota recovery fixture is unreadable', () => {
    expect(
      deriveAskReadiness({
        local: [SUCCESS, SUCCESS, SUCCESS, SUCCESS],
        quotaFixtureEnabled: true,
        turns: ERROR,
      }),
    ).toMatchObject({ isSuccess: false, isError: true });
  });
});
