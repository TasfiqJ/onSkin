import * as React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ProgressScreen from '@/app/(tabs)/progress';

const fixture = vi.hoisted(() => ({ height: 640, width: 360, count: 0, status: 'local' }));
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
vi.mock('@/components/ui', () => ({ Screen: 'Screen', Card: 'Card', Text: 'Text' }));
vi.mock('@/components/navigation/DockMotion', () => ({ reportDockScroll: vi.fn() }));
vi.mock('@/features/subscription/ProGate', () => ({
  ProGate: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('./PhotoStorageGate', () => ({
  PhotoStorageGate: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('./PhotoTimelineLockGate', () => ({
  PhotoTimelineLockGate: ({ children }: { children: React.ReactNode }) => children,
}));
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
vi.mock('./usePhotos', () => ({
  usePhotos: () => {
    const series = [
      { id: 'a', takenLocalDate: '2026-09-01', localUri: null, captureSessionId: null },
      { id: 'b', takenLocalDate: '2026-09-30', localUri: null, captureSessionId: null },
    ];
    return {
      data: {
        count: fixture.count,
        all: fixture.count ? series : [],
        series: fixture.count ? series : [],
        metadata: { text: 'Two local photos' },
        comparePair: fixture.count ? { before: series[0], after: series[1] } : null,
        monthGroups: [],
        milestones: [],
      },
    };
  },
}));
let renderer: ReactTestRenderer | null = null;
function text(node: ReactTestInstance | string | number): string {
  return typeof node === 'object'
    ? node.children.map((child) => text(child as ReactTestInstance | string | number)).join(' ')
    : String(node);
}
function nodes(type: string) {
  return renderer!.root.findAll((node) => (node.type as unknown) === type);
}
async function mount() {
  await act(async () => {
    renderer = create(React.createElement(ProgressScreen));
  });
}
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  fixture.count = 0;
  fixture.status = 'local';
});
afterEach(async () => {
  await act(async () => {
    renderer?.unmount();
  });
  renderer = null;
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
