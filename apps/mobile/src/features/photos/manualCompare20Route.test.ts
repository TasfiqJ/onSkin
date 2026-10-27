import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import Progress from '../../app/(tabs)/progress';
import { NavigationContext } from 'expo-router/build/react-navigation/core/NavigationContext';
import { runAccountGenerationOperation } from '@/lib/auth/accountGeneration';
import {
  activeHealthProcessingLeaseSnapshot,
  clearActiveHealthProcessingEpoch,
  setActiveHealthProcessingEpoch,
} from '@/lib/consent/healthProcessingEpoch';
import { HEALTH_DATA_CONSENT } from '@/features/onboarding/consentCopy';
import {
  clearHealthDataCollectionConsentLocal,
  setHealthDataCollectionConsentLocal,
} from '@/features/onboarding/healthConsentStore';
import { CompareSlider } from './CompareSlider';
import type { PhotoRecord } from './store';

const ports = vi.hoisted(() => ({
  photos: [] as PhotoRecord[],
  storage: new Map<string, string>(),
  fail: false,
  lock: {
    appUnlocked: true,
    enabled: true,
    photoTimelineUnlocked: true,
    unlockPhotoTimeline: vi.fn(),
  },
  focused: true,
  listeners: new Map<string, () => void>(),
  focus: vi.fn(),
  reads: 0,
  pendingRead: null as Promise<PhotoRecord[]> | null,
  pan: { begin: () => {}, change: (_event: { translationX: number }) => {}, end: () => {} },
}));
vi.mock('react-native', async () => {
  const R = await import('react');
  return {
    View: 'View',
    Text: 'Text',
    Pressable: 'Pressable',
    ScrollView: 'ScrollView',
    Modal: ({ visible, children, ...props }: { visible: boolean; children: React.ReactNode }) =>
      visible ? R.createElement('Modal', props, children) : null,
    FlatList: ({
      data,
      renderItem,
      ListHeaderComponent,
      ...props
    }: {
      data: unknown[];
      ListHeaderComponent?: React.ReactNode;
      renderItem: (arg: { item: unknown; index: number }) => React.ReactNode;
    }) =>
      R.createElement(
        'FlatList',
        props,
        ListHeaderComponent,
        data.map((item, index) =>
          R.createElement(R.Fragment, { key: index }, renderItem({ item, index })),
        ),
      ),
    SectionList: ({ ListHeaderComponent }: { ListHeaderComponent: React.ReactNode }) =>
      R.createElement('SectionList', null, ListHeaderComponent),
    Platform: { OS: 'web' },
    useWindowDimensions: () => ({ width: 390, height: 844, fontScale: 1 }),
    AccessibilityInfo: { setAccessibilityFocus: vi.fn() },
    findNodeHandle: () => {
      throw Error('WEB_FIND_NODE_HANDLE_UNSUPPORTED');
    },
  };
});
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 34, left: 0, right: 0 }),
}));
vi.mock('expo-router', () => ({ router: { push: vi.fn() } }));
vi.mock('expo-router/build/react-navigation/core/NavigationContext', async () => ({
  NavigationContext: (await import('react')).createContext({
    isFocused: () => ports.focused,
    addListener: (name: string, fn: () => void) => {
      ports.listeners.set(name, fn);
      return () => ports.listeners.delete(name);
    },
  }),
}));
vi.mock('@/components/ui', () => ({
  Card: 'Card',
  Screen: 'Screen',
  Text: 'Text',
  StateNotice: 'StateNotice',
}));
vi.mock('@/components/navigation/DockMotion', () => ({ reportDockScroll: vi.fn() }));
vi.mock('@/features/subscription/ProGate', () => ({
  ProGate: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('@/lib/applock/AppLockProvider', () => ({ useAppLock: () => ports.lock }));
vi.mock('@/lib/analytics/track', () => ({ track: vi.fn() }));
vi.mock('@/theme/haptics', () => ({ haptics: { select: vi.fn() } }));
vi.mock('@/features/photos/PhotoDeleteSyncStatus', () => ({ PhotoDeleteSyncStatus: () => null }));
vi.mock('@/features/photos/PhotoTimelapse', () => ({ PhotoTimelapse: () => null }));
vi.mock('@/features/photos/PhotoImage', () => ({ PhotoImage: 'PhotoImage' }));
vi.mock('@/features/photos/sensitiveImageMemory', () => ({
  purgeSensitiveImageMemory: async () => true,
}));
vi.mock('@/lib/accessibility/useReduceMotionPreference', () => ({
  useReduceMotionPreference: () => true,
  motionAwareModalAnimation: () => 'none',
}));
vi.mock('@/features/photos/store', () => ({
  loadPhotos: async () => {
    ports.reads++;
    if (ports.fail) throw Error('SYNTHETIC_STORAGE_UNAVAILABLE');
    if (ports.pendingRead) return ports.pendingRead;
    return ports.photos;
  },
}));
vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: async (key: string) => ports.storage.get(key) ?? null,
  updatePrivateItem: async (key: string, update: (raw: string | null) => string | null) => {
    const value = update(ports.storage.get(key) ?? null);
    if (value === null) ports.storage.delete(key);
    else ports.storage.set(key, value);
  },
  removePrivateItem: async (key: string) => {
    ports.storage.delete(key);
  },
}));
vi.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: vi.fn(),
}));
vi.mock('react-native-gesture-handler', () => ({
  Gesture: {
    Pan: () => {
      const pan = {
        onBegin: (fn: () => void) => {
          ports.pan.begin = fn;
          return pan;
        },
        onChange: (fn: (event: { translationX: number }) => void) => {
          ports.pan.change = fn;
          return pan;
        },
        onEnd: (fn: () => void) => {
          ports.pan.end = fn;
          return pan;
        },
      };
      return pan;
    },
  },
  GestureDetector: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('react-native-reanimated', async () => {
  const R = await import('react');
  return {
    default: { View: 'AnimatedView' },
    runOnJS: (fn: unknown) => fn,
    useSharedValue: (value: unknown) => R.useRef({ value }).current,
    useAnimatedStyle: () => ({}),
  };
});

let view: ReactTestRenderer;
let client: QueryClient;
function photo(id: string, day: string): PhotoRecord {
  return {
    id,
    series: 'front',
    takenLocalDate: day,
    takenAt: `${day}T12:00:00Z`,
    timeOfDay: 'morning',
    isReference: false,
    referencePhotoId: null,
    alignmentScore: null,
    lightingScore: null,
    localUri: `data:image/png;synthetic-${id}`,
    notes: null,
    captureSessionId: null,
  } as PhotoRecord;
}
async function grant(owner = 'synthetic-a') {
  const accountGeneration = await runAccountGenerationOperation((lease) => lease.generation);
  clearActiveHealthProcessingEpoch();
  setActiveHealthProcessingEpoch(20, { ownerUserId: owner, accountGeneration });
}
async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}
async function mount() {
  await act(async () => {
    view = create(
      React.createElement(QueryClientProvider, { client }, React.createElement(Progress)),
      { createNodeMock: () => ({ focus: ports.focus }) },
    );
  });
  await flush();
}
const slider = () => view.root.findByType(CompareSlider);
const button = (label: string) =>
  view.root.findAll(
    (n) => (n.type as unknown) === 'Pressable' && n.props.accessibilityLabel === label,
  )[0]!;
const pickerRows = () =>
  view.root.findAll(
    (n) =>
      (n.type as unknown) === 'Pressable' &&
      String(n.props.accessibilityLabel).startsWith('Choose '),
  );
const text = () => JSON.stringify(view.toJSON());
const pair = () => [slider().props.before.id, slider().props.after.id];
const hasSlider = () => view.root.findAllByType(CompareSlider).length > 0;
async function refresh() {
  await act(async () => {
    await client.invalidateQueries({ queryKey: ['photos'] });
  });
  await flush();
}
async function press(action: () => void) {
  await act(async () => action());
  await flush();
}

beforeEach(async () => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0) as unknown as number;
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  ports.photos = [photo('a', '2026-04-01'), photo('b', '2026-05-12'), photo('c', '2026-06-24')];
  ports.storage.clear();
  ports.fail = false;
  ports.focused = true;
  ports.listeners.clear();
  ports.lock.photoTimelineUnlocked = true;
  ports.focus.mockReset();
  ports.reads = 0;
  ports.pendingRead = null;
  await setHealthDataCollectionConsentLocal({
    granted: true,
    version: HEALTH_DATA_CONSENT.version,
    consentText: HEALTH_DATA_CONSENT.fullText,
  });
  await grant();
  client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: Infinity, refetchOnMount: false },
    },
  });
});
afterEach(async () => {
  if (view) await act(async () => view.unmount());
  await client.cancelQueries();
  client.clear();
  clearActiveHealthProcessingEpoch();
  await clearHealthDataCollectionConsentLocal();
  ports.storage.clear();
});

it('refuses the actual opposite-slot choice instead of displaying one record twice', async () => {
  await mount();
  await press(slider().props.onPickBefore);
  const same = pickerRows().find((n) => n.props.accessibilityLabel.includes('Jun 24'))!;
  await press(same.props.onPress);
  expect(slider().props.before.id).not.toBe(slider().props.after.id);
});

it.each([0, 1, 2, 3, 20])('renders the truthful route for %i synthetic captures', async (count) => {
  ports.photos = Array.from({ length: count }, (_, index) => photo(String(index), '2026-10-01'));
  await mount();
  expect(hasSlider()).toBe(count > 1);
  if (count === 0) expect(text()).toContain('Take my first photo');
  if (count === 1) {
    expect(text()).toContain('Take another');
    expect(text()).not.toContain('your first photo');
  }
  if (count > 1) {
    expect(slider().props.sideBySide).toBe(true);
    expect(slider().props.beforeLabel).toBe('First');
    expect(text()).toContain('First and second identify display positions.');
  }
});

it('retains an alternate pair, cancels, returns focus, and changes no private storage', async () => {
  await mount();
  const original = [...ports.storage];
  await press(slider().props.onPickBefore);
  expect(
    pickerRows().find((n) => n.props.accessibilityLabel.includes('Jun 24'))!.props.disabled,
  ).toBe(true);
  await press(
    pickerRows().find((n) => n.props.accessibilityLabel.includes('May 12'))!.props.onPress,
  );
  expect(pair()).toEqual(['b', 'c']);
  expect(ports.focus).toHaveBeenCalled();
  await press(slider().props.onPickAfter);
  expect(text()).toContain('"animationType":"none"');
  await press(button('Cancel photo selection').props.onPress);
  expect(pair()).toEqual(['b', 'c']);
  expect([...ports.storage]).toEqual(original);
});

it.each(['a', 'c'])('retires the open picker when selected record %s is deleted', async (id) => {
  await mount();
  await press(slider().props.onPickBefore);
  const oldChoose = pickerRows().find((n) => n.props.accessibilityLabel.includes('May 12'))!.props
    .onPress;
  ports.photos = ports.photos.filter((p) => p.id !== id);
  await refresh();
  await press(oldChoose);
  expect(pair()).not.toContain(id);
  expect(new Set(pair()).size).toBe(2);
  expect(pickerRows()).toHaveLength(0);
});

it('retires old picker and trigger closures through identical-data invalidate/refetch', async () => {
  await mount();
  await press(slider().props.onPickBefore);
  const oldChoose = pickerRows().find((n) => n.props.accessibilityLabel.includes('May 12'))!.props
    .onPress;
  const oldTrigger = slider().props.onPickAfter;
  await refresh();
  await press(oldChoose);
  await press(oldTrigger);
  expect(pair()).toEqual(['a', 'c']);
  expect(pickerRows()).toHaveLength(0);
});

it.each(['same-owner-regrant', 'owner-a-b-a'])(
  'retains no old picker influence across %s',
  async (boundary) => {
    await mount();
    await press(slider().props.onPickBefore);
    const oldChoose = pickerRows().find((n) => n.props.accessibilityLabel.includes('May 12'))!.props
      .onPress;
    await act(async () => {
      if (boundary === 'owner-a-b-a') await grant('synthetic-b');
      await grant();
    });
    await flush();
    await press(oldChoose);
    expect(pair()).toEqual(['a', 'c']);
    expect(pickerRows()).toHaveLength(0);
  },
);

it('masks the real source during withdrawal and cannot republish it with a retained picker', async () => {
  await mount();
  await press(slider().props.onPickBefore);
  const oldChoose = pickerRows()[1]!.props.onPress;
  await act(async () => {
    await clearHealthDataCollectionConsentLocal();
    clearActiveHealthProcessingEpoch();
  });
  await press(oldChoose);
  expect(hasSlider()).toBe(false);
  expect(text()).not.toContain('Take my first photo');
  await act(async () => grant());
  await flush();
  await press(oldChoose);
  expect(pair()).toEqual(['a', 'c']);
});

it('retires the picker and choices on blur/refocus and timeline lock/relock', async () => {
  await mount();
  await press(slider().props.onPickBefore);
  const oldChoose = pickerRows()[1]!.props.onPress;
  await press(() => {
    ports.focused = false;
    ports.listeners.get('blur')?.();
  });
  expect(hasSlider()).toBe(false);
  await press(() => {
    ports.focused = true;
    ports.listeners.get('focus')?.();
  });
  await press(oldChoose);
  expect(pair()).toEqual(['a', 'c']);
  ports.lock.photoTimelineUnlocked = false;
  await act(async () =>
    view.update(
      React.createElement(QueryClientProvider, { client }, React.createElement(Progress)),
    ),
  );
  expect(hasSlider()).toBe(false);
  ports.lock.photoTimelineUnlocked = true;
  await act(async () =>
    view.update(
      React.createElement(QueryClientProvider, { client }, React.createElement(Progress)),
    ),
  );
  await flush();
  await press(oldChoose);
  expect(pair()).toEqual(['a', 'c']);
});

it('keeps unavailable storage distinct, retries the real query, and retires pre-error handlers', async () => {
  await mount();
  await press(slider().props.onPickBefore);
  const oldChoose = pickerRows()[1]!.props.onPress;
  ports.fail = true;
  await refresh();
  await press(oldChoose);
  expect(hasSlider()).toBe(false);
  expect(text()).toContain('Your timeline could not open.');
  expect(text()).not.toContain('Take my first photo');
  ports.fail = false;
  const retry = view.root.findAll(
    (n) =>
      (n.type as unknown) === 'Pressable' &&
      n.findAll((c) => (c.type as unknown) === 'Text' && c.children.includes('Try again')).length >
        0,
  )[0]!;
  await press(retry.props.onPress);
  await press(oldChoose);
  expect(pair()).toEqual(['a', 'c']);
});

it('performs no photo read without real health authority', async () => {
  clearActiveHealthProcessingEpoch();
  await mount();
  expect(ports.reads).toBe(0);
  expect(hasSlider()).toBe(false);
});

it('distinguishes unreadable bytes and missing image bytes from empty or deleted metadata', async () => {
  await mount();
  const image = view.root.findAll((n) => (n.type as unknown) === 'PhotoImage')[0]!;
  await press(image.props.onDisplayError);
  expect(text()).toContain('Cannot read photo.');
  expect(hasSlider()).toBe(true);
  ports.photos = ports.photos.map((p) => ({ ...p, localUri: null }));
  await refresh();
  expect(text()).toContain('No image bytes.');
  expect(hasSlider()).toBe(true);
});

it('keeps explicit swipe controls functional and describes image visibility', async () => {
  await mount();
  await press(button('Switch to swipe comparison').props.onPress);
  await press(button('Show more of the first image').props.onPress);
  expect(text()).toContain('62 percent of the before photo visible');
  expect(text()).toContain('image visibility only');
  await press(button('Show less of the first image').props.onPress);
  expect(text()).toContain('52 percent of the before photo visible');
});

it('reopens a current comparison after a direct current-source record replacement', async () => {
  await mount();
  await press(slider().props.onPickBefore);
  const oldChoice = pickerRows()[1]!.props.onPress;
  const query = client.getQueryCache().findAll({ queryKey: ['photos'] })[0]!;
  const data = query.state.data as {
    series: PhotoRecord[];
    all: PhotoRecord[];
    [key: string]: unknown;
  };
  const series = data.series.filter((p) => p.id !== 'c');
  await act(async () => {
    client.setQueryData(query.queryKey, { ...data, series, all: series, count: 2 });
  });
  await flush();
  await press(oldChoice);
  expect(hasSlider()).toBe(true);
  expect(pair()).toEqual(['a', 'b']);
});

it('keeps current controls operable when navigation republishes its focused context', async () => {
  function element() {
    const navigation = {
      isFocused: () => true,
      addListener: (name: string, fn: () => void) => {
        ports.listeners.set(name, fn);
        return () => ports.listeners.delete(name);
      },
    };
    return React.createElement(
      QueryClientProvider,
      { client },
      React.createElement(
        NavigationContext.Provider,
        { value: navigation as never },
        React.createElement(Progress),
      ),
    );
  }
  await act(async () => {
    view = create(element());
  });
  await flush();
  await act(async () => {
    view.update(element());
  });
  await flush();
  await press(slider().props.onPickBefore);
  expect(pickerRows()).toHaveLength(3);
});

it('accepts a republished identical lease without confusing it with a regrant', async () => {
  await mount();
  const trigger = slider().props.onPickBefore;
  const accepted = activeHealthProcessingLeaseSnapshot()!;
  const repeated = setActiveHealthProcessingEpoch(accepted.epoch, accepted);
  expect(repeated.generation).toBe(accepted.generation);
  expect(repeated).not.toBe(accepted);
  await press(trigger);
  expect(pickerRows()).toHaveLength(3);
  expect(new Set(pickerRows().map((n) => n.props.accessibilityLabel)).size).toBe(3);
});

it('measures in the default mode before switching to a functional swipe gesture', async () => {
  await mount();
  const measured = view.root.findAll(
    (n) => (n.type as unknown) === 'View' && typeof n.props.onLayout === 'function',
  )[0]!;
  await press(() => measured.props.onLayout({ nativeEvent: { layout: { width: 342 } } }));
  await press(button('Switch to swipe comparison').props.onPress);
  await press(() => {
    ports.pan.begin();
    ports.pan.change({ translationX: -34 });
    ports.pan.end();
  });
  expect(text()).toContain('42 percent of the before photo visible');
});

it('retires selection and cancel closures when their individual picker closes or is replaced', async () => {
  await mount();
  await press(slider().props.onPickBefore);
  const oldChoice = pickerRows().find((n) => n.props.accessibilityLabel.includes('May 12'))!.props
    .onPress;
  const oldCancel = button('Cancel photo selection').props.onPress;
  await press(oldCancel);
  await press(oldChoice);
  expect(pair()).toEqual(['a', 'c']);
  await press(slider().props.onPickAfter);
  await press(oldCancel);
  expect(pickerRows()).toHaveLength(3);
  await press(
    pickerRows().find((n) => n.props.accessibilityLabel.includes('May 12'))!.props.onPress,
  );
  expect(pair()).toEqual(['a', 'b']);
  await press(oldChoice);
  expect(pair()).toEqual(['a', 'b']);
});

it('preserves a valid chosen pair through source refresh and requires recovery after its deletion', async () => {
  await mount();
  await press(slider().props.onPickBefore);
  await press(
    pickerRows().find((n) => n.props.accessibilityLabel.includes('May 12'))!.props.onPress,
  );
  expect(pair()).toEqual(['b', 'c']);
  await press(slider().props.onPickAfter);
  const oldChoice = pickerRows().find((n) => n.props.accessibilityLabel.includes('Apr 1'))!.props
    .onPress;
  await refresh();
  await press(oldChoice);
  expect(pair()).toEqual(['b', 'c']);
  expect(pickerRows()).toHaveLength(0);
  ports.photos = ports.photos.filter((photo) => photo.id !== 'b');
  await refresh();
  await press(oldChoice);
  expect(hasSlider()).toBe(false);
  expect(text()).toContain('no longer available');
  await press(button('Choose a new comparison pair').props.onPress);
  expect(pair()).toEqual(['a', 'c']);
});

it('denies retained stale cache and retired callbacks throughout a deferred real refetch', async () => {
  await mount();
  await press(slider().props.onPickBefore);
  await press(
    pickerRows().find((n) => n.props.accessibilityLabel.includes('May 12'))!.props.onPress,
  );
  expect(pair()).toEqual(['b', 'c']);
  await press(slider().props.onPickAfter);
  const oldChoice = pickerRows().find((n) => n.props.accessibilityLabel.includes('Apr 1'))!.props
    .onPress;
  const oldTrigger = slider().props.onPickBefore;
  const query = client.getQueryCache().findAll({ queryKey: ['photos'] })[0]!;
  const retained = query.state.data;
  let resolveRead!: (photos: PhotoRecord[]) => void;
  ports.pendingRead = new Promise((resolve) => {
    resolveRead = resolve;
  });
  let refetch!: Promise<void>;
  await act(async () => {
    refetch = client.invalidateQueries({ queryKey: ['photos'] });
  });
  await flush();
  expect(query.state.data).toBe(retained);
  expect(query.state.fetchStatus).toBe('fetching');
  expect(query.state.isInvalidated).toBe(true);
  expect(hasSlider()).toBe(false);
  expect(text()).not.toContain('Take my first photo');
  await press(oldChoice);
  await press(oldTrigger);
  expect(hasSlider()).toBe(false);
  await act(async () => {
    resolveRead(ports.photos);
    await refetch;
  });
  ports.pendingRead = null;
  await flush();
  await press(oldChoice);
  await press(oldTrigger);
  expect(pair()).toEqual(['b', 'c']);
  expect(pickerRows()).toHaveLength(0);
});

it.each(['same-owner-regrant', 'owner-a-b-a'])(
  'discards an actual nondefault selection at the %s authority boundary',
  async (boundary) => {
    await mount();
    await press(slider().props.onPickBefore);
    const oldChoice = pickerRows().find((n) => n.props.accessibilityLabel.includes('May 12'))!.props
      .onPress;
    await press(oldChoice);
    expect(pair()).toEqual(['b', 'c']);
    await act(async () => {
      if (boundary === 'owner-a-b-a') await grant('synthetic-b');
      await grant();
    });
    await flush();
    await press(oldChoice);
    expect(pair()).toEqual(['a', 'c']);
    expect(pickerRows()).toHaveLength(0);
  },
);

it('denies a populated retained cache with closed authority and does not read private photos', async () => {
  await mount();
  const cached = client.getQueryCache().findAll({ queryKey: ['photos'] })[0]!;
  const retained = cached.state.data;
  const reads = ports.reads;
  const oldTrigger = slider().props.onPickBefore;
  await act(async () => {
    clearActiveHealthProcessingEpoch();
  });
  await press(oldTrigger);
  expect(cached.state.data).toBe(retained);
  expect(hasSlider()).toBe(false);
  expect(ports.reads).toBe(reads);
  expect(text()).not.toContain('Take my first photo');
});
