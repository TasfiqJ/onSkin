import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ProgressScreen from '@/app/(tabs)/progress';
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
import { localDay } from './date';
import { loadPhotos, type PhotoRecord } from './store';
import {
  defaultComparePair,
  detectMilestones,
  forSeries,
  groupByMonth,
  metadataLine,
  referenceFor,
} from './timeline';

const fixture = vi.hoisted(() => ({
  height: 640,
  width: 360,
  count: 0,
  status: 'local',
  photos: [] as PhotoRecord[],
  storage: new Map<string, string>(),
}));
vi.mock('react-native', () => ({
  View: 'View',
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  FlatList: 'FlatList',
  SectionList: 'SectionList',
  Modal: 'Modal',
  useWindowDimensions: () => ({ height: fixture.height, width: fixture.width }),
}));
vi.mock('expo-router', () => ({ router: { push: vi.fn() } }));
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
vi.mock('@/components/ui', () => ({
  Screen: 'Screen',
  Card: 'Card',
  Text: 'Text',
  StateNotice: 'StateNotice',
}));
vi.mock('@/components/navigation/DockMotion', () => ({ reportDockScroll: vi.fn() }));
vi.mock('@/features/subscription/ProGate', () => ({
  ProGate: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('@/lib/applock/AppLockProvider', () => ({
  useAppLock: () => ({ appUnlocked: true, enabled: true, photoTimelineUnlocked: true }),
}));
vi.mock('@/features/photos/sensitiveImageMemory', () => ({
  purgeSensitiveImageMemory: async () => true,
}));
vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: async (key: string) => fixture.storage.get(key) ?? null,
  updatePrivateItem: async (key: string, update: (raw: string | null) => string | null) => {
    const value = update(fixture.storage.get(key) ?? null);
    if (value === null) fixture.storage.delete(key);
    else fixture.storage.set(key, value);
  },
  removePrivateItem: async (key: string) => {
    fixture.storage.delete(key);
  },
}));
vi.mock('expo-crypto', () => ({ CryptoDigestAlgorithm: { SHA256: 'SHA-256' } }));
vi.mock('./store', () => ({ loadPhotos: vi.fn(async () => fixture.photos) }));
vi.mock('./PhotoImage', () => ({ PhotoImage: 'PhotoImage' }));
vi.mock('./CompareSlider', () => ({ CompareSlider: 'CompareSlider' }));
vi.mock('./PhotoTimelapse', () => ({ PhotoTimelapse: 'PhotoTimelapse' }));
vi.mock('./PhotoDeleteSyncStatus', () => ({
  PhotoDeleteSyncStatus: () =>
    fixture.status === 'none'
      ? null
      : React.createElement('DeletionStatus', { state: fixture.status }),
}));
vi.mock('@/lib/accessibility/useReduceMotionPreference', () => ({
  useReduceMotionPreference: () => true,
  motionAwareModalAnimation: () => 'none',
}));
vi.mock('@/lib/analytics/track', () => ({ track: vi.fn() }));
let renderer: ReactTestRenderer | null = null;
let client: QueryClient;
function photo(id: string, day: string): PhotoRecord {
  return {
    id,
    series: 'front',
    takenLocalDate: day,
    takenAt: `${day}T12:00:00.000Z`,
    timeOfDay: 'morning',
    isReference: false,
    referencePhotoId: null,
    alignmentScore: null,
    lightingScore: null,
    localUri: null,
    notes: null,
    captureSessionId: null,
    headRoll: null,
    headYaw: null,
    headPitch: null,
    qualitySource: null,
    localOnly: true,
    storagePath: null,
    faceRegionRedacted: false,
    isEncrypted: false,
    encryptedLocalUri: null,
    thumbnailLocalUri: null,
    encryptionVersion: 'none',
    keyId: null,
  };
}
function text(node: ReactTestInstance | string | number): string {
  return typeof node === 'object'
    ? node.children.map((child) => text(child as ReactTestInstance | string | number)).join(' ')
    : String(node);
}
function nodes(type: string) {
  return renderer!.root.findAll((node) => (node.type as unknown) === type);
}
async function mount() {
  fixture.photos = fixture.count ? [photo('a', '2026-09-01'), photo('b', '2026-09-30')] : [];
  if (fixture.count === 0) {
    // A current empty cache exercises the real hook/gate without private photo I/O.
    const lease = activeHealthProcessingLeaseSnapshot()!;
    const today = localDay();
    const photos = fixture.photos;
    client.setQueryData(
      [
        'photos',
        'authority',
        lease.generation,
        lease.epoch,
        lease.accountGeneration,
        lease.ownerUserId,
        'front',
        today,
      ],
      {
        all: photos,
        series: forSeries(photos, 'front'),
        count: 0,
        metadata: metadataLine(photos),
        comparePair: defaultComparePair(photos, { series: 'front' }),
        monthGroups: groupByMonth(photos, 'front', today),
        milestones: detectMilestones(photos, 'front'),
        reference: referenceFor(photos, 'front'),
      },
    );
  }
  await act(async () => {
    renderer = create(
      React.createElement(QueryClientProvider, { client }, React.createElement(ProgressScreen)),
    );
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  if (fixture.count === 0) expect(loadPhotos).not.toHaveBeenCalled();
  else {
    expect(nodes('CompareSlider')[0]!.props.before.id).toBe('a');
    expect(nodes('CompareSlider')[0]!.props.after.id).toBe('b');
  }
}
beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  fixture.count = 0;
  fixture.status = 'local';
  fixture.storage.clear();
  vi.mocked(loadPhotos).mockClear();
  clearActiveHealthProcessingEpoch();
  await setHealthDataCollectionConsentLocal({
    granted: true,
    version: HEALTH_DATA_CONSENT.version,
    consentText: HEALTH_DATA_CONSENT.fullText,
  });
  const accountGeneration = await runAccountGenerationOperation((lease) => lease.generation);
  setActiveHealthProcessingEpoch(21, { ownerUserId: 'synthetic-layout21', accountGeneration });
  client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
        staleTime: Infinity,
        refetchOnMount: false,
      },
    },
  });
});
afterEach(async () => {
  await act(async () => {
    renderer?.unmount();
  });
  renderer = null;
  await client.cancelQueries();
  client.clear();
  clearActiveHealthProcessingEpoch();
  await clearHealthDataCollectionConsentLocal();
  fixture.storage.clear();
});

describe('C-08B2-R2 empty layout composition (pixel geometry is covered by the browser runner)', () => {
  it.each([
    [360, 640, true],
    [375, 667, true],
    [390, 844, false],
    [390, 699, true],
    [390, 700, false],
  ] as const)('uses the separate empty threshold at %i x %i', async (width, height, compact) => {
    fixture.width = width;
    fixture.height = height;
    await mount();
    const cta = nodes('Pressable').find((node) => text(node) === 'Take my first photo');
    expect(cta).toBeDefined();
    expect(cta!.props.className).toContain(compact ? 'h-[52px]' : 'h-14');
    expect(nodes('DeletionStatus')).toHaveLength(1);
    expect(nodes('CompareSlider')).toHaveLength(0);
  });
  it.each(['local', 'remote', 'none'])(
    'retains the empty CTA with %s deletion status',
    async (status) => {
      fixture.width = 360;
      fixture.height = 640;
      fixture.status = status;
      await mount();
      expect(
        nodes('Pressable').find((node) => text(node) === 'Take my first photo')!.props.className,
      ).toContain('h-[52px]');
      expect(nodes('DeletionStatus')).toHaveLength(status === 'none' ? 0 : 1);
    },
  );
  it.each([519, 520, 640, 667, 699, 700, 844])(
    'preserves populated Compare and Timeline sizing at height %i',
    async (height) => {
      fixture.width = 375;
      fixture.height = height;
      fixture.count = 2;
      await mount();
      expect(nodes('CompareSlider')).toHaveLength(1);
      expect(nodes('ScrollView')[0]!.props.contentContainerClassName).toBe(
        height < 520 ? 'pb-28' : 'pb-8',
      );
      expect(
        nodes('Pressable').filter((node) => text(node) === 'Take my first photo'),
      ).toHaveLength(0);
      const timeline = nodes('Pressable').find((node) => text(node) === 'Timeline')!;
      await act(async () => {
        timeline.props.onPress();
      });
      expect(nodes('SectionList')).toHaveLength(1);
      expect(nodes('SectionList')[0]!.props.contentContainerStyle.paddingBottom).toBe(
        height < 520 ? 112 : 32,
      );
      expect(nodes('CompareSlider')).toHaveLength(0);
    },
  );
});
