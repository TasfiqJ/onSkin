import { createElement, useLayoutEffect } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';

import QuizScreen from '@/app/onboarding/quiz';
import { runAccountGenerationOperation } from '@/lib/auth/accountGeneration';
import {
  clearActiveHealthProcessingEpoch,
  setActiveHealthProcessingEpoch,
} from '@/lib/consent/healthProcessingEpoch';
import { OnboardingProvider, useOnboarding } from './OnboardingContext';

const ports = vi.hoisted(() => ({
  focus: undefined as (() => void) | undefined,
  push: vi.fn(),
  replace: vi.fn(),
}));
vi.mock('expo-router', () => ({ router: { push: ports.push, replace: ports.replace } }));
vi.mock('expo-router/build/react-navigation/core/NavigationContext', async () => ({
  NavigationContext: (await import('react')).createContext({
    isFocused: () => true,
    addListener: (name: string, callback: () => void) => {
      if (name === 'focus') ports.focus = callback;
      return () => {};
    },
  }),
}));
vi.mock('react-native', () => ({
  ScrollView: 'ScrollView',
  View: 'View',
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
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock('@/lib/supabase/client', () => ({ getPersistedSupabaseUser: vi.fn(), supabase: {} }));
vi.mock('./skinProfileStore', () => ({ setStoredSkinProfileFromExplicitQuiz: vi.fn() }));
vi.mock('./healthConsentStore', () => ({
  hasCurrentHealthDataCollectionConsent: async () => true,
}));
vi.mock('@/lib/analytics/track', () => ({ track: vi.fn() }));

let view: ReactTestRenderer | undefined;
let context: ReturnType<typeof useOnboarding>;
function Probe() {
  const value = useOnboarding();
  useLayoutEffect(() => {
    context = value;
  }, [value]);
  return null;
}
afterEach(async () => {
  await act(async () => {
    view?.unmount();
  });
  view = undefined;
  clearActiveHealthProcessingEpoch();
});
it('masks the actual protected provider draft across owner return and explicitly clears it only through reset', async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const accountGeneration = await runAccountGenerationOperation((lease) => lease.generation);
  const grant = (ownerUserId: string) => {
    clearActiveHealthProcessingEpoch();
    setActiveHealthProcessingEpoch(1, { ownerUserId, accountGeneration });
  };
  grant('synthetic-owner-a');
  await act(async () => {
    view = create(
      createElement(OnboardingProvider, null, createElement(Probe), createElement(QuizScreen)),
    );
  });
  const oldSelection = view!.root.findAllByType('OptionCard' as never)[0]!.props.onPress;
  await act(async () => {
    oldSelection();
  });
  expect(Object.keys(context.quizAnswers)).toHaveLength(1);
  await act(async () => {
    grant('synthetic-owner-b');
    grant('synthetic-owner-a');
    oldSelection();
    ports.focus?.();
  });
  expect(view!.root.findAllByType('OptionCard' as never)).toHaveLength(0);
  // Explicitly record the protected-core limitation rather than pretending
  // that masking the mounted screen has cleared provider-wide private memory.
  expect(Object.keys(context.quizAnswers)).toHaveLength(1);
  const restart = view!.root
    .findAllByType('Button' as never)
    .find((n) => n.props.label === 'Start a new quiz')!;
  await act(async () => {
    restart.props.onPress();
  });
  expect(Object.keys(context.quizAnswers)).toHaveLength(0);
  expect(ports.replace).toHaveBeenLastCalledWith('/onboarding/goals');
  expect(ports.push).not.toHaveBeenCalled();
});
