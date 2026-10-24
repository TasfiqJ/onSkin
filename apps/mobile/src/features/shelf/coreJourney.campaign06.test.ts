import { createHash, randomUUID } from 'node:crypto';
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { createElement, type ComponentType } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import ProductsScreen from '@/app/onboarding/products';
import ArchiveScreen from '@/app/shelf/archive';
import { OnboardingProvider } from '@/features/onboarding/OnboardingContext';
import { IntakeProvider } from './IntakeContext';
import { addProduct, loadShelf, updateProduct } from './store';
import { runAccountGenerationOperation } from '@/lib/auth/accountGeneration';
import {
  clearActiveHealthProcessingEpoch,
  setActiveHealthProcessingEpoch,
} from '@/lib/consent/healthProcessingEpoch';

const ports = vi.hoisted(() => ({
  bytes: new Map<string, string>(),
  failRead: false,
  failWrite: false,
  writes: 0,
  hold: false,
  release: null as (() => void) | null,
  push: vi.fn(),
  track: vi.fn(),
}));
vi.mock('react-native-get-random-values', () => ({}));
vi.mock('expo-crypto', () => ({
  randomUUID,
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: async (_algorithm: string, value: string) =>
    createHash('sha256').update(value).digest('hex'),
}));
vi.mock('expo-secure-store', () => ({}));
vi.mock('react-native', () => ({
  View: 'View',
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  TextInput: 'TextInput',
  Platform: { OS: 'web' },
  useWindowDimensions: () => ({ width: 375, height: 667, fontScale: 1 }),
  AccessibilityInfo: {
    isReduceMotionEnabled: async () => true,
    addEventListener: () => ({ remove() {} }),
  },
}));
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0 }),
}));
vi.mock('@/components/ui', () => ({
  Screen: 'Screen',
  Text: 'Text',
  Button: 'Button',
  Card: 'Card',
  Chip: 'Chip',
  RouteIconButton: 'RouteIconButton',
  StripedThumb: 'StripedThumb',
  StateLoading: 'StateLoading',
  StateNotice: 'StateNotice',
}));
vi.mock('expo-router', () => ({
  router: { push: ports.push, replace: ports.push, canGoBack: () => false },
  useLocalSearchParams: () => ({}),
}));
vi.mock('@/theme/haptics', () => ({ haptics: { select() {} } }));
vi.mock('@/lib/analytics/track', () => ({ track: ports.track }));
vi.mock('@/lib/env', () => ({ isSupabaseConfigured: false }));
vi.mock('@/lib/supabase/client', () => ({
  supabase: {},
  getPersistedSupabaseUser: async () => ({ data: { user: null } }),
}));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => {
      if (key === 'layerwell.shelf.v1' && ports.failRead) throw new Error('SYNTHETIC_READ_REFUSAL');
      return ports.bytes.get(key) ?? null;
    },
    setItem: async (key: string, value: string) => {
      if (key === 'layerwell.shelf.v1') {
        if (value !== ports.bytes.get(key)) ports.writes++;
        if (ports.hold) {
          ports.hold = false;
          await new Promise<void>((resolve) => {
            ports.release = resolve;
          });
        }
        if (ports.failWrite && value !== ports.bytes.get(key))
          throw new Error('SYNTHETIC_WRITE_REFUSAL');
      }
      ports.bytes.set(key, value);
    },
    removeItem: async (key: string) => {
      ports.bytes.delete(key);
    },
    getAllKeys: async () => [...ports.bytes.keys()],
    multiGet: async (keys: string[]) => keys.map((key) => [key, ports.bytes.get(key) ?? null]),
  },
}));

let client: QueryClient;
let renderer: ReactTestRenderer | undefined;
async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}
async function mount(Component: ComponentType) {
  await act(async () => {
    renderer = create(
      createElement(
        QueryClientProvider,
        { client },
        createElement(
          OnboardingProvider,
          null,
          createElement(IntakeProvider, null, createElement(Component)),
        ),
      ),
    );
  });
  await flush();
}
function rendered() {
  return JSON.stringify(renderer!.toJSON());
}
function removeButton() {
  return renderer!.root.findAll(
    (node) =>
      node.type === 'Pressable' && node.props.accessibilityLabel === 'Remove Synthetic balm',
  )[0]!;
}
beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  ports.bytes.clear();
  ports.failRead = false;
  ports.failWrite = false;
  ports.writes = 0;
  ports.hold = false;
  ports.release = null;
  ports.track.mockClear();
  ports.push.mockClear();
  clearActiveHealthProcessingEpoch();
  const accountGeneration = await runAccountGenerationOperation((lease) => lease.generation);
  setActiveHealthProcessingEpoch(1, { ownerUserId: 'synthetic-core-a', accountGeneration });
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, retryDelay: 0, gcTime: Infinity } },
  });
  onlineManager.setOnline(false);
});
afterEach(async () => {
  await act(async () => {
    renderer?.unmount();
    ports.release?.();
  });
  renderer = undefined;
  client.clear();
  clearActiveHealthProcessingEpoch();
  onlineManager.setOnline(true);
});

it('archive refuses unreadable data instead of saying there is no history, and retries offline', async () => {
  const product = await addProduct({ name: 'Synthetic archived balm', addedVia: 'manual' });
  await updateProduct(product.id, { status: 'finished', finishedAt: '2026-10-24' });
  ports.failRead = true;
  await mount(ArchiveScreen);
  await flush();
  expect(rendered()).not.toContain('Nothing archived yet');
  expect(rendered()).toContain('Shelf data unavailable');
  ports.failRead = false;
  const retry = renderer!.root.findAll(
    (node) =>
      node.type === 'Button' &&
      node.props.accessibilityLabel === 'Retry loading private Shelf data',
  )[0]!;
  await act(async () => {
    retry.props.onPress();
  });
  await flush();
  expect(rendered()).toContain('Synthetic archived balm');
});

it('onboarding removal admits one write for repeated taps and reports a refused commit', async () => {
  await addProduct({ name: 'Synthetic balm', addedVia: 'onboarding' });
  await mount(ProductsScreen);
  ports.writes = 0;
  ports.hold = true;
  ports.failWrite = true;
  const press = removeButton().props.onPress;
  // Retain any promise so a rejected native commit is observed by the test.
  // The original void callback leaks its rejection; raw Vitest errors are retained.
  await act(async () => {
    const a = press();
    const b = press();
    if (a?.catch) void a.catch(() => {});
    if (b?.catch) void b.catch(() => {});
  });
  await flush();
  expect(removeButton().props.disabled).toBe(true);
  await act(async () => {
    ports.release?.();
  });
  await flush();
  expect(rendered()).toContain('Removal could not be confirmed');
  expect(ports.writes).toBe(1);
  expect((await loadShelf()).map((product) => product.name)).toEqual(['Synthetic balm']);
  ports.failWrite = false;
  await act(async () => {
    removeButton().props.onPress();
  });
  await flush();
  expect(await loadShelf()).toEqual([]);
});

it('a readable empty archive is still an honest empty state', async () => {
  await mount(ArchiveScreen);
  expect(rendered()).toContain('Nothing archived yet');
});

it('an old onboarding removal never starts a replacement grant read after its write retires', async () => {
  await addProduct({ name: 'Synthetic balm', addedVia: 'onboarding' });
  await mount(ProductsScreen);
  const query = client.getQueryCache().find({ queryKey: ['shelf'], exact: true })!;
  const fetch = vi.spyOn(query, 'fetch');
  ports.hold = true;
  await act(async () => {
    removeButton().props.onPress();
  });
  await flush();
  clearActiveHealthProcessingEpoch();
  const accountGeneration = await runAccountGenerationOperation((lease) => lease.generation);
  setActiveHealthProcessingEpoch(1, { ownerUserId: 'synthetic-core-b', accountGeneration });
  await act(async () => {
    ports.release?.();
  });
  await flush();
  expect(fetch).not.toHaveBeenCalled();
});
