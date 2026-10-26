import { createHash, randomUUID } from 'node:crypto';
import { QueryClient, QueryClientProvider, focusManager, onlineManager } from '@tanstack/react-query';
import { createElement, type ComponentType } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { setHealthDataCollectionConsentLocal } from '@/features/onboarding/healthConsentStore';
import { HEALTH_DATA_CONSENT } from '@/features/onboarding/consentCopy';
import ProductsScreen from '@/app/onboarding/products';
import ShelfScreen from '@/app/(tabs)/shelf';
import ArchiveScreen from '@/app/shelf/archive';
import { OnboardingProvider } from '@/features/onboarding/OnboardingContext';
import { IntakeProvider } from './IntakeContext';
import { addProduct, loadShelf, updateProduct } from './store';
import { useShelf } from './useShelf';
import type { ShelfData } from './useShelf';
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
vi.mock('@/components/navigation/DockMotion', () => ({ reportDockScroll() {} }));
vi.mock('react-native', () => ({
  View: 'View',
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  TextInput: 'TextInput',
  Keyboard: { dismiss: vi.fn() },
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
  SegmentChip: 'SegmentChip',
  ConflictBanner: 'ConflictBanner',
  ExpiryBadge: 'ExpiryBadge',
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
      node.type === ('Pressable' as never) &&
      node.props.accessibilityLabel === 'Remove Synthetic balm',
  )[0]!;
}
beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  ports.bytes.clear();
  await setHealthDataCollectionConsentLocal({ granted: true, version: HEALTH_DATA_CONSENT.version, consentText: HEALTH_DATA_CONSENT.fullText });
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
      node.type === ('Button' as never) &&
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

it.each(['synthetic-core-b', 'synthetic-core-a'])(
  'Shelf withholds cached product identities for replacement grant %s',
  async (owner) => {
    await addProduct({ name: 'Synthetic private A name', addedVia: 'manual' });
    let source!: ReturnType<typeof useShelf>;
    function Probe() {
      source = useShelf();
      return null;
    }
    await mount(Probe);
    expect(source.data?.items[0]?.name).toBe('Synthetic private A name');
    clearActiveHealthProcessingEpoch();
    ports.bytes.delete('layerwell.shelf.v1');
    const accountGeneration = await runAccountGenerationOperation((lease) => lease.generation);
    await act(async () => {
      setActiveHealthProcessingEpoch(1, { ownerUserId: owner, accountGeneration });
    });
    expect(source.data).toBeUndefined();
    expect(source.isError).toBe(true);
    await act(async () => {
      await source.refetch();
    });
    await flush();
    expect(source.data?.items).toEqual([]);
  },
);

it.each([1, 3, 20, 100])(
  'Quick Find narrows %i real encrypted saved products without writes or analytics',
  async (count) => {
    for (let i = 0; i < count; i++)
      await addProduct({
        name: i === 0 ? 'Crème Sérum' : `Synthetic cleanser ${i}`,
        brand: i === 0 ? 'Élan' : null,
        addedVia: 'manual',
      });
    await mount(ShelfScreen);
    const input = () =>
      renderer!.root.findAll(
        (node) =>
          node.type === ('TextInput' as never) &&
          node.props.accessibilityLabel === 'Quick Find saved products',
      )[0]!;
    const writes = ports.writes;
    ports.track.mockClear();
    await act(async () => {
      input().props.onChangeText('  elan  creme ');
    });
    const names = () =>
      renderer!.root
        .findAll(
          (node) =>
            node.type === ('Pressable' as never) &&
            String(node.props.accessibilityLabel).includes('Date unknown'),
        )
        .map((node) => node.props.accessibilityLabel);
    expect(names()).toEqual(['Crème Sérum, Date unknown']);
    expect(rendered()).not.toContain('Build my routine');
    await act(async () => {
      input().props.onChangeText('not on this shelf');
    });
    expect(rendered()).toContain('No saved products match Quick Find');
    expect(rendered()).not.toContain('empty for now');
    await act(async () => {
      input().props.onKeyPress({ nativeEvent: { key: 'Escape' } });
    });
    expect(input().props.value).toBe('');
    expect(rendered()).toContain('Build my routine');
    expect(names()).toHaveLength(count);
    expect(ports.writes).toBe(writes);
    expect(ports.track).not.toHaveBeenCalled();
  },
);

it('Quick Find combines with existing filters and never searches ingredients or unknown expiry', async () => {
  await addProduct({
    name: 'Synthetic balm',
    brand: 'Test brand',
    addedVia: 'manual',
    ingredients: ['retinol'],
  });
  await addProduct({ name: 'Synthetic cleanser', addedVia: 'manual' });
  await mount(ShelfScreen);
  const input = () => renderer!.root.findAll((node) => node.type === ('TextInput' as never))[0]!;
  await act(async () => {
    input().props.onChangeText('retinol');
  });
  expect(rendered()).toContain('No saved products match Quick Find');
  await act(async () => {
    input().props.onChangeText('Synthetic');
    renderer!.root
      .findAll(
        (node) => node.type === ('SegmentChip' as never) && node.props.label === 'Actives',
      )[0]!
      .props.onPress();
  });
  expect(rendered()).toContain('Synthetic balm, Date unknown');
  expect(rendered()).not.toContain('Synthetic cleanser, Date unknown');
  await act(async () => {
    renderer!.root
      .findAll(
        (node) => node.type === ('SegmentChip' as never) && node.props.label === 'Expiring',
      )[0]!
      .props.onPress();
  });
  expect(rendered()).not.toContain('Synthetic balm, Date unknown');
});

it('Quick Find cannot survive a same-owner regrant or disclose a retired cache', async () => {
  await addProduct({ name: 'Synthetic private A name', addedVia: 'manual' });
  await mount(ShelfScreen);
  const input = renderer!.root.findAll((node) => node.type === ('TextInput' as never))[0]!;
  await act(async () => {
    input.props.onChangeText('private A');
  });
  ports.bytes.delete('layerwell.shelf.v1');
  clearActiveHealthProcessingEpoch();
  const accountGeneration = await runAccountGenerationOperation((lease) => lease.generation);
  await act(async () => {
    setActiveHealthProcessingEpoch(1, { ownerUserId: 'synthetic-core-a', accountGeneration });
  });
  expect(rendered()).not.toContain('Synthetic private A name');
  expect(rendered()).not.toContain('private A');
  const retry = renderer!.root.findAll(
    (node) =>
      node.type === ('Button' as never) &&
      node.props.accessibilityLabel === 'Retry loading private Shelf data',
  )[0]!;
  await act(async () => {
    retry.props.onPress();
  });
  await flush();
  expect(rendered()).toContain('empty for now');
});


// Campaign07: retain the actual encrypted store, QueryClient and useShelf.
it.each([
  [2026, 9, 24, '2026-10-24'],
  [2026, 10, 1, '2026-11-01'],
  [2026, 2, 8, '2026-03-08'],
])('refreshes supported expiry at local midnight without rereading private storage (%s-%s-%s)', async (year, month, day, printed) => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(Number(year), Number(month), Number(day), 23, 59, 59, 800));
  let visible: ShelfData | undefined;
  function ShelfProbe() { visible = useShelf().data; return null; }
  try {
    await addProduct({ name: 'Synthetic dated balm', addedVia: 'manual', expiryDate: String(printed), expirySource: 'printed' });
    await act(async () => {
      renderer = create(createElement(QueryClientProvider, { client }, createElement(ShelfProbe)));
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(50); });
    expect(visible?.items[0]?.badge.label).toBe('0 days left');
    const ciphertext = new Map(ports.bytes);
    // The platform read port can now fail: date-only presentation must use
    // the admitted snapshot, without turning a new read into empty/success.
    ports.failRead = true;
    await act(async () => { await vi.advanceTimersByTimeAsync(1250); });
    // The date effect updates the existing QueryClient; deliver its queued
    // observer notification after React has committed that effect.
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(visible?.items[0]?.badge.label).toBe('Time to replace');
    expect(visible).toBe(client.getQueryData(['shelf']));
    expect(ports.bytes).toEqual(ciphertext);
    await act(async () => { clearActiveHealthProcessingEpoch(); });
    expect(visible).toBeUndefined();
  } finally { vi.useRealTimers(); }
});


it('preserves canonical Shelf cache identity required by routine source-currentness', async () => {
  await addProduct({ name: 'Synthetic routine source', addedVia: 'manual' });
  let visible: ShelfData | undefined;
  function CanonicalProbe() { visible = useShelf().data; return null; }
  await mount(CanonicalProbe);
  expect(visible?.items[0]?.name).toBe('Synthetic routine source');
  expect(visible).toBe(client.getQueryData(['shelf']));
});

it('refreshes admitted dates after a foreground timezone change without private IO', async () => {
  const previousZone = process.env.TZ;
  process.env.TZ = 'America/Toronto';
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-24T20:00:00Z'));
  focusManager.setFocused(false);
  client.setDefaultOptions({ queries: { retry: false, staleTime: Infinity, gcTime: Infinity } });
  let visible: ShelfData | undefined;
  function ZoneProbe() { visible = useShelf().data; return null; }
  try {
    await addProduct({ name: 'Synthetic travel date', addedVia: 'manual', expiryDate: '2026-10-24', expirySource: 'printed' });
    await act(async () => { renderer = create(createElement(QueryClientProvider, { client }, createElement(ZoneProbe))); });
    await act(async () => { await vi.advanceTimersByTimeAsync(50); });
    expect(visible?.items[0]?.badge.label).toBe('0 days left');
    const ciphertext = new Map(ports.bytes);
    ports.failRead = true;
    // Process-local test timezone only; no host clock or OS setting changes.
    process.env.TZ = 'Asia/Tokyo';
    await act(async () => { focusManager.setFocused(true); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(visible?.items[0]?.badge.label).toBe('Time to replace');
    expect(visible).toBe(client.getQueryData(['shelf']));
    expect(ports.bytes).toEqual(ciphertext);
  } finally {
    await act(async () => { renderer?.unmount(); });
    renderer = undefined;
    focusManager.setFocused(undefined);
    if (previousZone === undefined) delete process.env.TZ;
    else process.env.TZ = previousZone;
    vi.useRealTimers();
  }
});
