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
  width: 360,
  height: 640,
  fontScale: 2,
  goals: ['routine'] as string[],
  count: 0,
  push: vi.fn(),
  replace: vi.fn(),
  reset: vi.fn(),
  remove: vi.fn(async (_id: string) => {}),
  refetch: vi.fn(async () => {}),
  unavailable: false,
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
  useWindowDimensions: () => ports,
}));
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));
vi.mock('@/components/ui', () => ({
  Button: 'Button',
  Card: 'Card',
  Chip: 'Chip',
  Screen: 'Screen',
  Text: 'Text',
}));
vi.mock('./OnboardingContext', () => ({ useOnboarding: () => ({ goals: ports.goals }) }));
vi.mock('@/features/shelf/IntakeContext', () => ({ useIntake: () => ({ reset: ports.reset }) }));
vi.mock('@/features/shelf/useShelf', () => ({
  useShelf: () => ({
    data: {
      items: Array.from({ length: ports.count }, (_, i) => ({
        id: `synthetic-${i}`,
        name: 'Synthetic long product label '.repeat(5),
      })),
    },
    refetch: ports.refetch,
  }),
}));
vi.mock('@/features/shelf/mutations', () => ({
  useShelfMutations: () => ({ remove: ports.remove }),
}));
vi.mock('@/features/shelf/ShelfDataAvailabilityGate', () => ({
  ShelfDataAvailabilityGate: ({ children }: { children: unknown }) =>
    ports.unavailable ? null : children,
}));
vi.mock('@/features/shelf/analytics', () => ({ trackProductAddStarted: vi.fn() }));
vi.mock('@/lib/analytics/track', () => ({ track: vi.fn() }));
vi.mock('@/lib/accessibility/useReduceMotionPreference', () => ({
  useReduceMotionPreference: () => true,
  motionAllowed: () => false,
}));
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
    renderer = create(createElement(ProductsScreen));
  });
}
async function type() {
  await act(async () => {
    renderer!.root.findByType('TextInput' as never).props.onChangeText('Synthetic unsaved product');
  });
}
beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  clearActiveHealthProcessingEpoch();
  const accountGeneration = await runAccountGenerationOperation((lease) => lease.generation);
  setActiveHealthProcessingEpoch(1, { ownerUserId: 'synthetic-owner-a', accountGeneration });
  ports.width = 360;
  ports.height = 640;
  ports.fontScale = 2;
  ports.count = 0;
  ports.goals = ['routine'];
  ports.unavailable = false;
  ports.push.mockReset();
  ports.replace.mockReset();
  ports.reset.mockReset();
  ports.remove.mockReset().mockResolvedValue(undefined);
});
afterEach(async () => {
  await act(async () => renderer?.unmount());
  renderer = undefined;
  clearActiveHealthProcessingEpoch();
});

it.each([
  [360, 640],
  [375, 667],
  [390, 844],
  [430, 932],
])(
  'keeps explicit empty-Shelf skip at %ix%i with typed text and an unsaved choice',
  async (width, height) => {
    ports.width = width;
    ports.height = height;
    await mount();
    await type();
    expect(button('Skip for now')).toBeDefined();
    await press('Skip for now');
    expect(ports.push).not.toHaveBeenCalled();
    expect(JSON.stringify(renderer!.toJSON())).toContain('not been added');
    await press('Keep editing');
    expect(renderer!.root.findByType('TextInput' as never).props.value).toBe(
      'Synthetic unsaved product',
    );
    await press('Skip for now');
    await press('Continue without adding it');
    expect(ports.push).toHaveBeenCalledExactlyOnceWith('/onboarding/analyzing');
    expect(ports.reset).not.toHaveBeenCalled();
  },
);

it.each([1, 2, 3, 20])('offers Continue with %i saved products while typing', async (count) => {
  ports.count = count;
  await mount();
  await type();
  expect(button(`Continue with ${count} ${count === 1 ? 'product' : 'products'}`)).toBeDefined();
});

it('blocks continuation during removal and never duplicates an in-progress removal', async () => {
  let release!: () => void;
  ports.count = 1;
  ports.remove.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  await mount();
  const remove = renderer!.root
    .findAllByType('Pressable' as never)
    .find((n) => String(n.props.accessibilityLabel).startsWith('Remove'))!;
  await act(async () => {
    remove.props.onPress();
    remove.props.onPress();
  });
  expect(ports.remove).toHaveBeenCalledTimes(1);
  expect(button('Continue with 1 product').props.disabled).toBe(true);
  await press('Continue with 1 product');
  expect(ports.push).not.toHaveBeenCalled();
  await act(async () => {
    release();
  });
});

it('preserves missing-goals and retired-health-lease gates and unavailable Shelf', async () => {
  ports.goals = [];
  await mount();
  await press('Skip for now');
  expect(ports.replace).toHaveBeenCalledWith('/onboarding/goals');
  ports.goals = ['routine'];
  clearActiveHealthProcessingEpoch();
  await press('Skip for now');
  expect(ports.push).not.toHaveBeenCalled();
  ports.unavailable = true;
  await act(async () => {
    renderer!.update(createElement(ProductsScreen));
  });
  expect(renderer!.root.findAllByType('Button' as never)).toHaveLength(0);
});
