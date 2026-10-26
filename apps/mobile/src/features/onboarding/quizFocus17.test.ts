import {
  assertHealthDataWriteLease,
  captureHealthDataWriteLease,
} from '@/lib/consent/healthDataWriteAdmission';
import { createElement, useState } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import QuizScreen from '@/app/onboarding/quiz';
import { runAccountGenerationOperation } from '@/lib/auth/accountGeneration';
import {
  clearActiveHealthProcessingEpoch,
  setActiveHealthProcessingEpoch,
} from '@/lib/consent/healthProcessingEpoch';
import { ONBOARDING_QUIZ, type QuizAnswers } from './quiz';

const ports = vi.hoisted(() => ({
  initial: {} as QuizAnswers,
  answer: vi.fn(),
  reset: vi.fn(),
  track: vi.fn(),
  consent: vi.fn<() => Promise<boolean>>(),
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
vi.mock('./OnboardingContext', () => ({
  useOnboarding: () => {
    const [quizAnswers, update] = useState(ports.initial);
    let lease: ReturnType<typeof captureHealthDataWriteLease> | null = null;
    try {
      lease = captureHealthDataWriteLease();
    } catch {
      /* closed synthetic authority */
    }
    return {
      quizAnswers,
      privacyStatus: lease ? 'ready' : 'denied',
      isCurrent: () => {
        try {
          if (!lease) return false;
          assertHealthDataWriteLease(lease);
          return true;
        } catch {
          return false;
        }
      },
      setAnswer: (id: string, value: string | string[]) => {
        ports.answer(id, value);
        update((prior) => ({ ...prior, [id]: value }));
      },
      reset: () => {
        ports.reset();
        update({});
      },
    };
  },
}));
vi.mock('./healthConsentStore', () => ({ hasCurrentHealthDataCollectionConsent: ports.consent }));
vi.mock('@/lib/analytics/track', () => ({ track: ports.track }));

let view: ReactTestRenderer | undefined;
let accountGeneration: number;
function grant(owner = 'synthetic-owner-a') {
  clearActiveHealthProcessingEpoch();
  setActiveHealthProcessingEpoch(1, { ownerUserId: owner, accountGeneration });
}
function deferred() {
  let resolve!: (result: boolean) => void;
  const promise = new Promise<boolean>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function mount() {
  await act(async () => {
    view = create(createElement(QuizScreen));
  });
}
function cards() {
  return view!.root.findAllByType('OptionCard' as never);
}
function button(label: string) {
  return view!.root.findAllByType('Button' as never).find((item) => item.props.label === label)!;
}
async function answer() {
  await act(async () => {
    cards()[0]!.props.onPress();
  });
}
beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  accountGeneration = await runAccountGenerationOperation((lease) => lease.generation);
  grant();
  ports.initial = {};
  ports.answer.mockReset();
  ports.reset.mockReset();
  ports.track.mockReset();
  ports.push.mockReset();
  ports.replace.mockReset();
  ports.consent.mockReset().mockResolvedValue(true);
});
afterEach(async () => {
  await act(async () => {
    view?.unmount();
  });
  view = undefined;
  clearActiveHealthProcessingEpoch();
});

it('masks the mounted draft immediately on focus and refuses old answer/analytics callbacks', async () => {
  await mount();
  await answer();
  const oldSelection = cards()[0]!.props.onPress;
  const oldNext = button('Next').props.onPress;
  const check = deferred();
  ports.consent.mockReturnValueOnce(check.promise);
  await act(async () => {
    ports.blur?.();
    ports.focus?.();
  });
  expect(cards()).toHaveLength(0);
  const writes = ports.answer.mock.calls.length;
  const events = ports.track.mock.calls.length;
  await act(async () => {
    oldSelection();
    oldNext();
  });
  expect(ports.answer).toHaveBeenCalledTimes(writes);
  expect(ports.track).toHaveBeenCalledTimes(events);
  await act(async () => {
    check.resolve(true);
  });
  expect(cards()[0]!.props.selected).toBe(true);
  await act(async () => {
    oldSelection();
    oldNext();
  });
  expect(ports.answer).toHaveBeenCalledTimes(writes);
  expect(view!.root.findByType('ProgressBar' as never).props.current).toBe(1);
});

it.each([true, false])(
  'retires stale consent completion %s across blur/refocus',
  async (result) => {
    await mount();
    await answer();
    const old = deferred();
    const current = deferred();
    ports.consent.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
    await act(async () => {
      ports.blur?.();
      ports.focus?.();
      ports.blur?.();
      ports.focus?.();
    });
    await act(async () => {
      old.resolve(result);
    });
    expect(cards()).toHaveLength(0);
    expect(ports.replace).not.toHaveBeenCalled();
    await act(async () => {
      current.resolve(true);
    });
    expect(cards()[0]!.props.selected).toBe(true);
  },
);

it.each(['withdrawal', 'same-owner-regrant', 'owner-return'] as const)(
  'closes immediately on %s during pending consent and never adopts old answers',
  async (boundary) => {
    await mount();
    await answer();
    const oldSelection = cards()[0]!.props.onPress;
    const check = deferred();
    ports.consent.mockReturnValueOnce(check.promise);
    await act(async () => {
      ports.blur?.();
      ports.focus?.();
    });
    await act(async () => {
      if (boundary === 'withdrawal') clearActiveHealthProcessingEpoch();
      if (boundary === 'same-owner-regrant') grant();
      if (boundary === 'owner-return') {
        grant('synthetic-owner-b');
        grant();
      }
      oldSelection();
      check.resolve(true);
    });
    expect(cards()).toHaveLength(0);
    expect(ports.answer).toHaveBeenCalledTimes(1);
    expect(ports.push).not.toHaveBeenCalled();
    if (boundary !== 'withdrawal') {
      await act(async () => {
        ports.blur?.();
        ports.focus?.();
      });
      expect(cards()).toHaveLength(0);
      expect(JSON.stringify(view!.toJSON())).toContain('Start a new quiz');
    }
  },
);

it('shows actual denial with privacy recovery instead of an endless checking screen', async () => {
  ports.consent.mockResolvedValue(false);
  await mount();
  expect(cards()).toHaveLength(0);
  expect(ports.replace).toHaveBeenCalledWith('/onboarding/consent');
  expect(JSON.stringify(view!.toJSON())).not.toContain('Checking your privacy choice');
  expect(button('Return to privacy')).toBeDefined();
});

it('refuses an unowned inherited draft and requires explicit reset through the existing API', async () => {
  ports.initial = { [ONBOARDING_QUIZ[0]!.id]: ONBOARDING_QUIZ[0]!.options[0]!.id };
  await mount();
  expect(cards()).toHaveLength(0);
  await act(async () => {
    button('Start a new quiz').props.onPress();
  });
  expect(ports.reset).toHaveBeenCalledTimes(1);
  expect(ports.replace).toHaveBeenCalledWith('/onboarding/goals');
  expect(ports.answer).not.toHaveBeenCalled();
});

it('ignores an approval after unmount and stale options after changing question', async () => {
  await mount();
  await answer();
  const oldSelection = cards()[0]!.props.onPress;
  await act(async () => {
    button('Next').props.onPress();
  });
  await act(async () => {
    oldSelection();
  });
  expect(ports.answer).toHaveBeenCalledTimes(1);
  const check = deferred();
  ports.consent.mockReturnValueOnce(check.promise);
  await act(async () => {
    ports.blur?.();
    ports.focus?.();
    view!.unmount();
    view = undefined;
  });
  await act(async () => {
    check.resolve(false);
  });
  expect(ports.replace).not.toHaveBeenCalled();
});
