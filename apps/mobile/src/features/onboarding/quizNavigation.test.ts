import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import QuizScreen from '@/app/onboarding/quiz';

import { ONBOARDING_QUIZ } from './quiz';
import { OnboardingProvider } from './OnboardingContext';
import { runAccountGenerationOperation } from '@/lib/auth/accountGeneration';
import {
  clearActiveHealthProcessingEpoch,
  setActiveHealthProcessingEpoch,
} from '@/lib/consent/healthProcessingEpoch';

const mocks = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), consent: vi.fn() }));
vi.mock('expo-router', () => ({ router: { push: mocks.push, replace: mocks.replace } }));
vi.mock('react-native', () => ({
  View: 'View',
  ScrollView: 'ScrollView',
  useWindowDimensions: () => ({ height: 667 }),
}));
vi.mock('@/components/ui', () => ({
  Button: 'Button',
  Chip: 'Chip',
  OptionCard: 'OptionCard',
  ProgressBar: 'ProgressBar',
  Screen: 'Screen',
  Text: 'Text',
}));
vi.mock('@/lib/analytics/track', () => ({ track: vi.fn() }));
vi.mock('./healthConsentStore', () => ({ hasCurrentHealthDataCollectionConsent: mocks.consent }));
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock('@/lib/supabase/client', () => ({ getPersistedSupabaseUser: vi.fn(), supabase: {} }));
vi.mock('./skinProfileStore', () => ({ setStoredSkinProfileFromExplicitQuiz: vi.fn() }));

let screen: ReactTestRenderer;
function button(label: string) {
  return screen.root.findAllByType('Button' as never).find((node) => node.props.label === label)!;
}
async function answer() {
  await act(async () => {
    const option =
      screen.root.findAllByType('OptionCard' as never)[0] ??
      screen.root.findAllByType('Chip' as never)[0]!;
    option.props.onPress();
  });
}
function index() {
  return screen.root.findByType('ProgressBar' as never).props.current;
}

beforeEach(async () => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  mocks.consent.mockResolvedValue(true);
  clearActiveHealthProcessingEpoch();
  const accountGeneration = await runAccountGenerationOperation((lease) => lease.generation);
  setActiveHealthProcessingEpoch(18, {
    ownerUserId: 'synthetic-navigation-owner18',
    accountGeneration,
  });
  await act(async () => {
    screen = create(createElement(OnboardingProvider, null, createElement(QuizScreen)));
  });
});
afterEach(async () => {
  await act(async () => screen.unmount());
  clearActiveHealthProcessingEpoch();
});

describe('quiz navigation through the real route', () => {
  it('advances one answered question for repeated Next taps in one render', async () => {
    await answer();
    const next = button('Next').props.onPress;
    await act(async () => {
      next();
      next();
    });
    expect(index()).toBe(2);
    expect(button('Next').props.disabled).toBe(true);
  });

  it('does not let a queued old Next handler skip an unanswered successor', async () => {
    await answer();
    const next = button('Next').props.onPress;
    await act(async () => next());
    await act(async () => next());
    expect(index()).toBe(2);
  });

  it('does not advance an unanswered question even if its handler is invoked', async () => {
    await act(async () => button('Next').props.onPress());
    expect(index()).toBe(1);
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it('keeps Back, re-answering and one final navigation usable', async () => {
    await answer();
    await act(async () => button('Next').props.onPress());
    await act(async () => button('Back').props.onPress());
    expect(index()).toBe(1);
    for (let n = 0; n < ONBOARDING_QUIZ.length; n++) {
      await answer();
      const next = button(n === ONBOARDING_QUIZ.length - 1 ? 'See my profile' : 'Next');
      await act(async () => {
        next.props.onPress();
        next.props.onPress();
      });
    }
    expect(mocks.push).toHaveBeenCalledTimes(1);
    expect(mocks.push).toHaveBeenCalledWith('/onboarding/products');
  });
});
