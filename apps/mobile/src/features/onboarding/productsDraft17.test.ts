import {
  assertHealthDataWriteLease,
  captureHealthDataWriteLease,
} from '@/lib/consent/healthDataWriteAdmission';
import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ProductsScreen from '@/app/onboarding/products';
import { runAccountGenerationOperation } from '@/lib/auth/accountGeneration';
import {
  clearActiveHealthProcessingEpoch,
  setActiveHealthProcessingEpoch,
} from '@/lib/consent/healthProcessingEpoch';

const ports = vi.hoisted(() => ({
  count: 0,
  goals: [] as string[],
  push: vi.fn(),
  replace: vi.fn(),
  remove: vi.fn<() => Promise<void>>(),
  refetch: vi.fn<() => Promise<void>>(),
}));
vi.mock('expo-router', () => ({
  router: { push: ports.push, replace: ports.replace },
  useLocalSearchParams: () => ({}),
}));
vi.mock('expo-router/build/react-navigation/core/NavigationContext', async () => ({
  NavigationContext: (await import('react')).createContext(undefined),
}));
vi.mock('react-native', () => ({
  Keyboard: { dismiss: vi.fn() },
  Platform: { OS: 'web' },
  ScrollView: 'ScrollView',
  TextInput: 'TextInput',
  View: 'View',
  Pressable: 'Pressable',
  useWindowDimensions: () => ({ width: 360, height: 640, fontScale: 2 }),
}));
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));
vi.mock('@/components/ui', () => ({
  Button: 'Button',
  Card: 'Card',
  Chip: 'Chip',
  Screen: 'Screen',
  Text: 'Text',
}));
vi.mock('./OnboardingContext', () => ({
  useOnboarding: () => {
    const lease = captureHealthDataWriteLease();
    return {
      goals: ports.goals,
      privacyStatus: 'ready',
      isCurrent: () => {
        try {
          assertHealthDataWriteLease(lease);
          return true;
        } catch {
          return false;
        }
      },
    };
  },
}));
vi.mock('@/features/shelf/IntakeContext', () => ({ useIntake: () => ({ reset: vi.fn() }) }));
vi.mock('@/features/shelf/useShelf', () => ({
  useShelf: () => ({
    data: {
      items: Array.from({ length: ports.count }, (_, i) => ({
        id: `fixture-${i}`,
        name: 'Synthetic product',
      })),
    },
    refetch: ports.refetch,
  }),
}));
vi.mock('@/features/shelf/mutations', () => ({
  useShelfMutations: () => ({ remove: ports.remove }),
}));
vi.mock('@/features/shelf/ShelfDataAvailabilityGate', () => ({
  ShelfDataAvailabilityGate: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/features/shelf/analytics', () => ({ trackProductAddStarted: vi.fn() }));
vi.mock('@/lib/analytics/track', () => ({ track: vi.fn() }));
vi.mock('@/lib/accessibility/useReduceMotionPreference', () => ({
  useReduceMotionPreference: () => true,
  motionAllowed: () => false,
}));
let view: ReactTestRenderer | undefined;
function button(label: string) {
  return view!.root.findAllByType('Button' as never).find((n) => n.props.label === label)!;
}
async function press(label: string) {
  await act(async () => {
    button(label).props.onPress();
  });
}
async function type(value = 'Synthetic unsaved draft') {
  await act(async () => {
    view!.root.findByType('TextInput' as never).props.onChangeText(value);
  });
}
beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  clearActiveHealthProcessingEpoch();
  const accountGeneration = await runAccountGenerationOperation((lease) => lease.generation);
  setActiveHealthProcessingEpoch(1, { ownerUserId: 'synthetic-owner-a', accountGeneration });
  ports.count = 0;
  ports.goals = [];
  ports.push.mockReset();
  ports.replace.mockReset();
  ports.remove.mockReset().mockResolvedValue();
  ports.refetch.mockReset().mockResolvedValue();
});
afterEach(async () => {
  await act(async () => {
    view?.unmount();
  });
  view = undefined;
  clearActiveHealthProcessingEpoch();
});
it.each([0, 1, 2, 3, 20])(
  'keeps the %i-item draft until explicit acknowledgement before the missing-goals redirect',
  async (count) => {
    ports.count = count;
    await act(async () => {
      view = create(createElement(ProductsScreen));
    });
    await type();
    const continuation = count
      ? `Continue with ${count} ${count === 1 ? 'product' : 'products'}`
      : 'Skip for now';
    await press(continuation);
    expect(ports.replace).not.toHaveBeenCalled();
    expect(ports.push).not.toHaveBeenCalled();
    await press('Keep editing');
    expect(view!.root.findByType('TextInput' as never).props.value).toContain('Synthetic');
    await press(continuation);
    await type('Changed draft');
    await press(continuation);
    expect(ports.replace).not.toHaveBeenCalled();
    await press('Continue without adding it');
    expect(ports.replace).toHaveBeenCalledExactlyOnceWith('/onboarding/goals');
    expect(ports.push).not.toHaveBeenCalled();
  },
);
it('retains the removal barrier until a failed deletion has finished its durable refetch', async () => {
  let release!: () => void;
  ports.count = 1;
  ports.goals = ['routine'];
  ports.remove.mockRejectedValue(new Error('synthetic removal failure'));
  ports.refetch.mockReturnValue(
    new Promise<void>((done) => {
      release = done;
    }),
  );
  await act(async () => {
    view = create(createElement(ProductsScreen));
  });
  await type();
  await act(async () => {
    view!.root
      .findAllByType('Pressable' as never)
      .find((n) => String(n.props.accessibilityLabel).startsWith('Remove'))!
      .props.onPress();
  });
  await press('Continue with 1 product');
  expect(ports.push).not.toHaveBeenCalled();
  await act(async () => {
    release();
  });
  await press('Continue with 1 product');
  expect(button('Continue without adding it')).toBeDefined();
});

it('retires a captured unsaved acknowledgement after editing or cancelling the choice', async () => {
  ports.goals = ['routine'];
  await act(async () => {
    view = create(createElement(ProductsScreen));
  });
  await type();
  await press('Skip for now');
  const old = button('Continue without adding it').props.onPress;
  await press('Keep editing');
  await act(async () => {
    old();
  });
  expect(ports.push).not.toHaveBeenCalled();
  await press('Skip for now');
  const beforeEdit = button('Continue without adding it').props.onPress;
  await type('Changed draft');
  await act(async () => {
    beforeEdit();
  });
  expect(ports.push).not.toHaveBeenCalled();
});
