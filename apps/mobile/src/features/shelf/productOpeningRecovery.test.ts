import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ProductDetailScreen from '@/app/shelf/[id]';

const mocks = vi.hoisted(() => ({ setOpened: vi.fn(), assertCurrent: vi.fn() }));
vi.mock('expo-crypto', () => ({ randomUUID: () => '11111111-1111-4111-8111-111111111111' }));
vi.mock('expo-router', () => ({
  router: { push: vi.fn(), replace: vi.fn() },
  useLocalSearchParams: () => ({ id: 'synthetic-product' }),
}));
vi.mock('react-native', () => ({
  Platform: { OS: 'web' },
  View: 'View',
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  TextInput: 'TextInput',
  useWindowDimensions: () => ({ width: 390, height: 844 }),
}));
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0 }),
}));
vi.mock('@/components/ui', () => ({
  Button: 'Button',
  RouteIconButton: 'RouteIconButton',
  Screen: 'Screen',
  StripedThumb: 'StripedThumb',
  Text: 'Text',
}));
vi.mock('@/features/catalog/CatalogReportConfirmation', () => ({
  CatalogReportConfirmation: () => null,
}));
vi.mock('@/features/catalog/client', () => ({
  isCatalogProductId: () => false,
  reportCatalogIssue: vi.fn(),
}));
vi.mock('./LocalDateField', () => ({ LocalDateField: 'LocalDateField' }));
vi.mock('./mutations', () => ({ useShelfMutations: () => ({ setOpened: mocks.setOpened }) }));
vi.mock('./useShelf', () => ({
  useShelf: () => ({
    data: {
      items: [
        {
          id: 'synthetic-product',
          engineProduct: { tags: [] },
          badge: { kind: 'unknown' },
          product: {
            id: 'synthetic-product',
            name: 'Synthetic unopened balm',
            status: 'active',
            addedVia: 'manual',
            catalogSource: 'user_local',
            isOpened: false,
            openedAt: null,
            paoMonths: null,
            paoSource: 'unknown',
            expiryDate: null,
            expirySource: 'unknown',
            ingredients: [],
            legacyUnverifiedExpiryDate: null,
            repurchaseCount: 1,
          },
        },
      ],
      archive: [],
      conflicts: [],
    },
  }),
}));
vi.mock('@/features/routine/usePlan', () => ({ usePlan: () => ({ data: undefined }) }));
vi.mock('@/features/scheduler/useCycle', () => ({ useCycle: () => ({ data: undefined }) }));
vi.mock('@/features/today/useToday', () => ({ localDateString: () => '2026-10-23' }));
vi.mock('@/theme/haptics', () => ({ haptics: { select: vi.fn() } }));
vi.mock('@/lib/consent/healthDataWriteAdmission', () => ({
  runCurrentHealthDataOperation: async (operation: (lease: unknown) => unknown) =>
    operation({ assertCurrent: mocks.assertCurrent }),
}));

let screen: ReactTestRenderer;
function opening() {
  return screen.root
    .findAllByType('Pressable' as never)
    .find((node) =>
      node
        .findAllByType('Text' as never)
        .some((text) => text.props.children === 'Record opening date'),
    )!;
}
function alerts() {
  return screen.root
    .findAllByType('Text' as never)
    .filter((node) => node.props.accessibilityRole === 'alert')
    .map((node) => node.props.children);
}
beforeEach(async () => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  vi.resetAllMocks();
  mocks.setOpened.mockResolvedValue(undefined);
  await act(async () => {
    screen = create(createElement(ProductDetailScreen));
  });
});
afterEach(async () => {
  await act(async () => screen.unmount());
});

describe('unopened product quick action through the real detail route', () => {
  it('announces write failure and allows a successful retry', async () => {
    mocks.setOpened.mockRejectedValueOnce(new Error('SYNTHETIC_STORAGE_UNAVAILABLE'));
    await act(async () => {
      await opening().props.onPress();
    });
    expect(alerts()).toEqual([expect.stringContaining('Your change was not confirmed.')]);
    await act(async () => {
      await opening().props.onPress();
    });
    expect(alerts()).toEqual([]);
    expect(mocks.setOpened).toHaveBeenLastCalledWith('synthetic-product', {
      openedAt: '2026-10-23',
      isOpened: true,
    });
  });

  it('joins no duplicate write while the first tap is pending', async () => {
    let release!: () => void;
    mocks.setOpened.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        release = resolve;
      }),
    );
    await act(async () => {
      const first = opening().props.onPress();
      const second = opening().props.onPress();
      release();
      await Promise.all([first, second]);
    });
    expect(mocks.setOpened).toHaveBeenCalledTimes(1);
  });
});
