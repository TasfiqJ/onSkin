import { createElement } from 'react';
import { OnboardingProvider } from './OnboardingContext';
import { setHealthDataCollectionConsentLocal } from '@/features/onboarding/healthConsentStore';
import { HEALTH_DATA_CONSENT } from '@/features/onboarding/consentCopy';

import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import QuizScreen from '@/app/onboarding/quiz';
import { ONBOARDING_QUIZ, type QuizAnswers } from './quiz';
import { quizNavigation16 } from './quizNavigation16';
import { runAccountGenerationOperation } from '@/lib/auth/accountGeneration';
import {
  clearActiveHealthProcessingEpoch,
  setActiveHealthProcessingEpoch,
} from '@/lib/consent/healthProcessingEpoch';

const ports = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  answers: {} as QuizAnswers,
  consent: true,
  push: vi.fn(),
  replace: vi.fn(),
  focus: undefined as (() => void) | undefined,
  blur: undefined as (() => void) | undefined,
}));
vi.mock('expo-router', () => ({ router: { push: ports.push, replace: ports.replace } }));
vi.mock('expo-router/build/react-navigation/core/NavigationContext', async () => ({
  NavigationContext: (await import('react')).createContext({
    isFocused: () => true,
    addListener: (name: string, callback: () => void) => {
      if (name === 'focus') ports.focus = callback;
      else ports.blur = callback;
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
vi.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: vi.fn(),
}));
vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: async (key: string) => ports.storage.get(key) ?? null,
  removePrivateItem: async (key: string) => {
    ports.storage.delete(key);
  },
  updatePrivateItem: async (key: string, update: (raw: string | null) => string | null) => {
    const next = update(ports.storage.get(key) ?? null);
    if (next === null) ports.storage.delete(key);
    else ports.storage.set(key, next);
  },
}));
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock('@/lib/supabase/client', () => ({ getPersistedSupabaseUser: vi.fn(), supabase: {} }));
vi.mock('./skinProfileStore', () => ({ setStoredSkinProfileFromExplicitQuiz: vi.fn() }));
function tree() {
  return createElement(OnboardingProvider, null, createElement(QuizScreen));
}
vi.mock('@/lib/analytics/track', () => ({ track: vi.fn() }));
let renderer: ReactTestRenderer | undefined;
function button(label: string) {
  return renderer!.root.findAllByType('Button' as never).find((n) => n.props.label === label)!;
}
async function press(label: string) {
  await act(async () => {
    button(label).props.onPress();
  });
}
async function mount() {
  await act(async () => {
    await setHealthDataCollectionConsentLocal({
      granted: ports.consent,
      version: HEALTH_DATA_CONSENT.version,
      consentText: ports.consent ? HEALTH_DATA_CONSENT.fullText : HEALTH_DATA_CONSENT.declineText,
    });
    renderer = create(tree());
  });
}
async function answerCurrent() {
  await act(async () => {
    const option =
      renderer!.root.findAllByType('OptionCard' as never)[0] ??
      renderer!.root.findAllByType('Chip' as never)[0];
    option!.props.onPress();
  });
}
beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  clearActiveHealthProcessingEpoch();
  const accountGeneration = await runAccountGenerationOperation((lease) => lease.generation);
  setActiveHealthProcessingEpoch(1, { ownerUserId: 'synthetic-owner-a', accountGeneration });
  ports.storage.clear();
  ports.answers = {};
  ports.consent = true;
  ports.push.mockReset();
  ports.replace.mockReset();
  ports.focus = undefined;
  ports.blur = undefined;
});
afterEach(async () => {
  await act(async () => renderer?.unmount());
  renderer = undefined;
  clearActiveHealthProcessingEpoch();
});

it('projects only an answered, current rendered transition and bounded Back', () => {
  expect(quizNavigation16(0, 0, 12, false, 'next')).toBeNull();
  expect(quizNavigation16(1, 0, 12, true, 'back')).toBeNull();
  expect(quizNavigation16(0, 0, 12, true, 'back')).toBeNull();
  expect(quizNavigation16(11, 11, 12, true, 'next')).toBe(12);
  expect(quizNavigation16(12, 11, 12, true, 'next')).toBeNull();
  expect(quizNavigation16(11, 11, 12, true, 'back')).toBe(10);
});

it('returns from Products to the still-mounted last question and continues again once', async () => {
  await mount();
  for (let i = 0; i < ONBOARDING_QUIZ.length - 1; i++) {
    await answerCurrent();
    await press('Next');
  }
  await answerCurrent();
  const finish = button('See my profile').props.onPress;
  await act(async () => {
    finish();
    finish();
  });
  expect(ports.push).toHaveBeenCalledTimes(1);
  await act(async () => {
    ports.blur?.();
    ports.focus?.();
    renderer!.update(tree());
  });
  await press('See my profile');
  expect(ports.push).toHaveBeenCalledTimes(2);
});

it('rejects stale rapid Next/Back callbacks instead of skipping questions', async () => {
  await mount();
  await answerCurrent();
  await press('Next');
  await answerCurrent();
  const next = button('Next').props.onPress;
  const back = button('Back').props.onPress;
  await act(async () => {
    next();
    back();
    next();
  });
  const progress = renderer!.root.findByType('ProgressBar' as never);
  expect(progress.props.current).toBe(3);
  expect(ports.push).not.toHaveBeenCalled();
});

it('cannot continue an unanswered question or direct entry without current consent', async () => {
  ports.answers = {};
  await mount();
  const next = button('Next');
  expect(next.props.disabled).toBe(true);
  await press('Next');
  expect(renderer!.root.findByType('ProgressBar' as never).props.current).toBe(1);
  await act(async () => {
    renderer!.unmount();
  });
  ports.consent = false;
  await mount();
  expect(ports.replace).toHaveBeenCalledWith('/onboarding/consent');
  expect(ports.push).not.toHaveBeenCalled();
  expect(renderer!.root.findAllByType('OptionCard' as never)).toHaveLength(0);
});
