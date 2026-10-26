import { createElement, useLayoutEffect } from 'react';
import { NavigationContext } from 'expo-router/build/react-navigation/core/NavigationContext';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Goals from '@/app/onboarding/goals';
import Quiz from '@/app/onboarding/quiz';
import Products from '@/app/onboarding/products';
import Analyzing from '@/app/onboarding/analyzing';
import Reveal from '@/app/onboarding/reveal';
import { OnboardingProvider, useOnboarding } from './OnboardingContext';
import { ONBOARDING_QUIZ, type QuizAnswers } from './quiz';
import { HEALTH_DATA_CONSENT } from './consentCopy';
import { setHealthDataCollectionConsentLocal } from './healthConsentStore';
import { runAccountGenerationOperation } from '@/lib/auth/accountGeneration';
import {
  activeHealthProcessingLeaseSnapshot,
  clearActiveHealthProcessingEpoch,
  setActiveHealthProcessingEpoch,
} from '@/lib/consent/healthProcessingEpoch';

const ports = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  owner: (): string => '',
  readGate: null as Promise<void> | null,
  focused: true,
  events: new Map<string, Set<() => void>>(),
  push: vi.fn(),
  replace: vi.fn(),
  insert: vi.fn(),
  track: vi.fn(),
  resetIntake: vi.fn(),
  remove: vi.fn(),
}));
vi.mock('expo-router', () => ({
  router: { push: ports.push, replace: ports.replace },
  useLocalSearchParams: () => ({}),
}));
vi.mock('expo-router/build/react-navigation/core/NavigationContext', async () => ({
  NavigationContext: (await import('react')).createContext({
    isFocused: () => ports.focused,
    addListener: (name: string, fn: () => void) => {
      if (!ports.events.has(name)) ports.events.set(name, new Set());
      ports.events.get(name)!.add(fn);
      return () => {
        ports.events.get(name)?.delete(fn);
      };
    },
  }),
}));
vi.mock('react-native', () => ({
  View: 'View',
  ScrollView: 'ScrollView',
  TextInput: 'TextInput',
  Pressable: 'Pressable',
  Keyboard: { dismiss: vi.fn() },
  Platform: { OS: 'web' },
  useWindowDimensions: () => ({ width: 390, height: 844, fontScale: 1 }),
  Easing: { inOut: (x: unknown) => x, ease: () => 0 },
  Animated: {
    Value: class {
      interpolate() {
        return 1;
      }
    },
    View: 'AnimatedView',
    timing: () => ({}),
    sequence: () => ({}),
    loop: () => ({ start: vi.fn(), stop: vi.fn() }),
  },
}));
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));
vi.mock('@/components/ui', () => ({
  Button: 'Button',
  OptionCard: 'OptionCard',
  Chip: 'Chip',
  ProgressBar: 'ProgressBar',
  Card: 'Card',
  Screen: 'Screen',
  Text: 'Text',
}));
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: async () => {} }),
}));
vi.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: vi.fn(),
}));
vi.mock('@/lib/supabase/client', () => ({
  getPersistedSupabaseUser: async () => ({ data: { user: { id: ports.owner() } } }),
  supabase: { from: () => ({ insert: ports.insert }) },
}));
vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: async (key: string) => {
    const value = ports.storage.get(ports.owner() + ':' + key) ?? null;
    if (key.includes('Consent') && ports.readGate) await ports.readGate;
    return value;
  },
  removePrivateItem: async (key: string) => {
    ports.storage.delete(ports.owner() + ':' + key);
  },
  updatePrivateItem: async (key: string, fn: (raw: string | null) => string | null) => {
    const owner = ports.owner();
    const value = fn(ports.storage.get(owner + ':' + key) ?? null);
    if (value === null) ports.storage.delete(owner + ':' + key);
    else ports.storage.set(owner + ':' + key, value);
  },
}));
vi.mock('@/features/shelf/IntakeContext', () => ({
  useIntake: () => ({ reset: ports.resetIntake }),
}));
vi.mock('@/features/shelf/useShelf', () => ({
  useShelf: () => ({ data: { items: [] }, refetch: async () => {} }),
}));
vi.mock('@/features/shelf/mutations', () => ({
  useShelfMutations: () => ({ remove: ports.remove }),
}));
vi.mock('@/features/shelf/ShelfDataAvailabilityGate', () => ({
  ShelfDataAvailabilityGate: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/features/shelf/analytics', () => ({ trackProductAddStarted: vi.fn() }));
vi.mock('@/lib/analytics/track', () => ({ track: ports.track }));
vi.mock('@/lib/accessibility/useReduceMotionPreference', () => ({
  useReduceMotionPreference: () => true,
  motionAllowed: () => false,
}));
vi.mock('@/features/routine/usePlan', () => ({ usePlan: () => ({ data: null }) }));
vi.mock('@/features/routine/activationAnalytics', () => ({
  recordFirstUsefulInsightAnalytics: vi.fn(),
}));
const ROUTES = { Goals, Quiz, Products, Analyzing, Reveal };
type Route = keyof typeof ROUTES;
let view: ReactTestRenderer | undefined;
let context: ReturnType<typeof useOnboarding>;
let accountGeneration: number;
function Probe() {
  const value = useOnboarding();
  useLayoutEffect(() => {
    context = value;
  });
  return null;
}
function Tree({ route }: { route: Route }) {
  return createElement(
    OnboardingProvider,
    null,
    createElement(NavigationContext.Provider, { value: undefined }, createElement(Probe)),
    createElement(ROUTES[route]),
  );
}
async function show(route: Route) {
  await act(async () => {
    if (view) view.update(createElement(Tree, { route }));
    else view = create(createElement(Tree, { route }));
  });
}
function buttons() {
  return view!.root.findAllByType('Button' as never);
}
function button(label: string) {
  return buttons().find((n) => n.props.label === label)!;
}
async function press(label: string) {
  await act(async () => button(label).props.onPress());
}
async function answer() {
  await act(async () => {
    (view!.root.findAllByType('OptionCard' as never)[0] ??
      view!.root.findAllByType('Chip' as never)[0])!.props.onPress();
  });
}
function deferred() {
  let release!: () => void;
  const promise = new Promise<void>((done) => {
    release = done;
  });
  return { promise, release };
}
function event(name: 'focus' | 'blur') {
  ports.focused = name === 'focus';
  for (const fn of [...(ports.events.get(name) ?? [])]) fn();
}
async function grant(ownerUserId = 'synthetic-route-a') {
  clearActiveHealthProcessingEpoch();
  const old = ports.owner;
  ports.owner = () => ownerUserId;
  await setHealthDataCollectionConsentLocal({
    granted: true,
    version: HEALTH_DATA_CONSENT.version,
    consentText: HEALTH_DATA_CONSENT.fullText,
  });
  ports.owner = old;
  setActiveHealthProcessingEpoch(18, { ownerUserId, accountGeneration });
}
async function completeDraft() {
  await act(async () => {
    context.toggleGoal('clear_skin');
    for (const q of ONBOARDING_QUIZ)
      context.setAnswer(q.id, q.multiSelect ? [q.options[0]!.id] : q.options[0]!.id);
  });
}
beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  ports.events.clear();
  ports.storage.clear();
  ports.readGate = null;
  ports.focused = true;
  ports.owner = () => activeHealthProcessingLeaseSnapshot()?.ownerUserId ?? 'closed';
  ports.push.mockReset();
  ports.replace.mockReset();
  ports.track.mockReset();
  ports.insert.mockReset().mockResolvedValue({ error: null });
  accountGeneration = await runAccountGenerationOperation((lease) => lease.generation);
  await grant();
});
afterEach(async () => {
  await act(async () => view?.unmount());
  view = undefined;
  clearActiveHealthProcessingEpoch();
  vi.useRealTimers();
});

it('completes the actual Goals to Quiz to Products to Analyzing to Reveal routes with synthetic data', async () => {
  await show('Goals');
  await act(async () => view!.root.findAllByType('OptionCard' as never)[0]!.props.onPress());
  await press('Continue');
  expect(ports.push).toHaveBeenLastCalledWith('/onboarding/quiz');
  await show('Quiz');
  for (let i = 0; i < ONBOARDING_QUIZ.length; i++) {
    await answer();
    await press(i === ONBOARDING_QUIZ.length - 1 ? 'See my profile' : 'Next');
  }
  expect(ports.push).toHaveBeenLastCalledWith('/onboarding/products');
  expect(Object.keys(context.quizAnswers)).toHaveLength(12);
  await show('Products');
  await press('Skip for now');
  expect(ports.push).toHaveBeenLastCalledWith('/onboarding/analyzing');
  vi.useFakeTimers();
  await show('Analyzing');
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2600);
  });
  expect(ports.replace).toHaveBeenLastCalledWith('/onboarding/reveal');
  expect(context.quizAnswers).toEqual({});
  await show('Reveal');
  expect(JSON.stringify(view!.toJSON())).toContain('YOUR SKIN PROFILE');
  await press('Continue');
  expect(ports.push).toHaveBeenLastCalledWith('/onboarding/notifications');
  expect(ports.insert).toHaveBeenCalledTimes(1);
  expect(ports.insert).toHaveBeenCalledWith(
    expect.objectContaining({ user_id: 'synthetic-route-a' }),
  );
});

it.each(['Goals', 'Quiz', 'Products', 'Analyzing', 'Reveal'] as const)(
  'makes %s private state inaccessible during mounted route reentry consent checks',
  async (route) => {
    await show('Goals');
    await completeDraft();
    if (route === 'Reveal')
      await act(async () => {
        await context.persistSkinProfile();
      });
    await show(route);
    const old = context;
    const gate = deferred();
    ports.readGate = gate.promise;
    await act(async () => {
      event('blur');
      event('focus');
    });
    expect(context.quizAnswers).toEqual({});
    expect(context.goals).toEqual([]);
    expect(context.profileResult).toBeNull();
    expect(JSON.stringify(view!.toJSON())).toContain('Checking your privacy choice');
    expect(view!.root.findAllByType('OptionCard' as never)).toHaveLength(0);
    expect(view!.root.findAllByType('TextInput' as never)).toHaveLength(0);
    expect(() => old.computeResult()).toThrow();
    await expect(old.persistSkinProfile()).rejects.toThrow();
    await act(async () => {
      old.setAnswer('pregnancy', 'pregnant');
      old.toggleGoal('hydration');
      old.reset();
    });
    ports.readGate = null;
    await act(async () => gate.release());
    expect(context.privacyStatus).toBe('ready');
  },
);

it('keeps returned quiz answers and Back/re-answer valid in the same owner window', async () => {
  await show('Quiz');
  await answer();
  await press('Next');
  await answer();
  const oldNext = button('Next').props.onPress;
  const before = { ...context.quizAnswers } as QuizAnswers;
  const gate = deferred();
  ports.readGate = gate.promise;
  await act(async () => {
    event('blur');
    event('focus');
    oldNext();
  });
  ports.readGate = null;
  await act(async () => gate.release());
  expect(context.quizAnswers).toEqual(before);
  expect(view!.root.findByType('ProgressBar' as never).props.current).toBe(2);
  await press('Back');
  expect(view!.root.findByType('ProgressBar' as never).props.current).toBe(1);
  expect(view!.root.findAllByType('OptionCard' as never)[0]!.props.selected).toBe(true);
  await answer();
  await press('Next');
  expect(view!.root.findByType('ProgressBar' as never).props.current).toBe(2);
});

it.each(['owner-return', 'same-owner-regrant'] as const)(
  'cannot show or score old-owner profile on %s',
  async (boundary) => {
    await show('Goals');
    await completeDraft();
    await act(async () => {
      await context.persistSkinProfile();
    });
    await show('Reveal');
    const old = context;
    const oldContinue = button('Continue').props.onPress;
    const gate = deferred();
    ports.readGate = gate.promise;
    await act(async () => {
      if (boundary === 'owner-return') await grant('synthetic-route-b');
      await grant();
      oldContinue();
    });
    expect(context.profileResult).toBeNull();
    expect(JSON.stringify(view!.toJSON())).not.toContain('YOUR SKIN PROFILE');
    expect(() => old.computeResult()).toThrow();
    await expect(old.persistSkinProfile()).rejects.toThrow();
    ports.readGate = null;
    await act(async () => gate.release());
    expect(context.profileResult).toBeNull();
    expect(context.quizAnswers).toEqual({});
    expect(ports.push).not.toHaveBeenCalledWith('/onboarding/notifications');
  },
);

it('rechecks actual withdrawn consent on Goals focus and offers usable privacy recovery', async () => {
  await show('Goals');
  const oldContinue = button('Continue').props.onPress;
  await setHealthDataCollectionConsentLocal({
    granted: false,
    version: HEALTH_DATA_CONSENT.version,
    consentText: HEALTH_DATA_CONSENT.declineText,
  });
  await act(async () => {
    event('blur');
    event('focus');
  });
  expect(context.privacyStatus).toBe('denied');
  expect(JSON.stringify(view!.toJSON())).not.toContain('What brings you here?');
  await act(async () => oldContinue());
  expect(ports.push).not.toHaveBeenCalled();
  await press('Return to privacy');
  expect(ports.replace).toHaveBeenLastCalledWith('/onboarding/consent');
});

it('retains an unsaved Products name on same-owner focus and requires explicit discard before continuing', async () => {
  await show('Goals');
  await completeDraft();
  await show('Products');
  await act(async () =>
    view!.root.findByType('TextInput' as never).props.onChangeText('Synthetic unsaved cleanser'),
  );
  await act(async () => {
    event('blur');
    event('focus');
  });
  expect(view!.root.findByType('TextInput' as never).props.value).toBe(
    'Synthetic unsaved cleanser',
  );
  await press('Skip for now');
  expect(button('Keep editing')).toBeDefined();
  expect(ports.push).not.toHaveBeenCalledWith('/onboarding/analyzing');
  await press('Keep editing');
  await press('Skip for now');
  await press('Continue without adding it');
  expect(ports.push).toHaveBeenLastCalledWith('/onboarding/analyzing');
});

it('erases the typed Products draft across owner transition and refuses its old continue callback', async () => {
  await show('Goals');
  await completeDraft();
  await show('Products');
  await act(async () =>
    view!.root.findByType('TextInput' as never).props.onChangeText('Synthetic A-only cleanser'),
  );
  const old = button('Skip for now').props.onPress;
  await act(async () => {
    await grant('synthetic-route-b');
    old();
  });
  expect(view!.root.findByType('TextInput' as never).props.value).toBe('');
  expect(context.goals).toEqual([]);
  expect(ports.push).not.toHaveBeenCalledWith('/onboarding/analyzing');
});

it('retires the delayed Analyzing navigation after blur and after unmount', async () => {
  await show('Goals');
  await completeDraft();
  vi.useFakeTimers();
  await show('Analyzing');
  await act(async () => event('blur'));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(3000);
  });
  expect(ports.replace).not.toHaveBeenCalledWith('/onboarding/reveal');
  await show('Goals');
  await act(async () => {
    await vi.advanceTimersByTimeAsync(3000);
  });
  expect(ports.replace).not.toHaveBeenCalledWith('/onboarding/reveal');
});

it('starts a fresh canonical read on every refocus and cannot inherit an older pending grant', async () => {
  await show('Goals');
  await completeDraft();
  const old = deferred();
  ports.readGate = old.promise;
  await act(async () => {
    event('blur');
    event('focus');
  });
  await setHealthDataCollectionConsentLocal({
    granted: false,
    version: HEALTH_DATA_CONSENT.version,
    consentText: HEALTH_DATA_CONSENT.declineText,
  });
  const current = deferred();
  ports.readGate = current.promise;
  await act(async () => {
    event('blur');
    event('focus');
  });
  await act(async () => old.release());
  expect(context.privacyStatus).toBe('checking');
  expect(context.goals).toEqual([]);
  ports.readGate = null;
  await act(async () => current.release());
  expect(context.privacyStatus).toBe('denied');
  expect(context.quizAnswers).toEqual({});
});

it('cannot let an old denied Goals check redirect a newly approved focus', async () => {
  await show('Goals');
  await setHealthDataCollectionConsentLocal({
    granted: false,
    version: HEALTH_DATA_CONSENT.version,
    consentText: HEALTH_DATA_CONSENT.declineText,
  });
  const old = deferred();
  ports.readGate = old.promise;
  await act(async () => {
    event('blur');
    event('focus');
  });
  await setHealthDataCollectionConsentLocal({
    granted: true,
    version: HEALTH_DATA_CONSENT.version,
    consentText: HEALTH_DATA_CONSENT.fullText,
  });
  const current = deferred();
  ports.readGate = current.promise;
  await act(async () => {
    event('blur');
    event('focus');
  });
  await act(async () => old.release());
  expect(ports.replace).not.toHaveBeenCalled();
  ports.readGate = null;
  await act(async () => current.release());
  expect(context.privacyStatus).toBe('ready');
  expect(ports.replace).not.toHaveBeenCalled();
  expect(view!.root.findAllByType('OptionCard' as never).length).toBeGreaterThan(0);
});
