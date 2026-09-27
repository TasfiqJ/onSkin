import { createElement } from 'react';
import {
  act,
  create,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TIMELAPSE_FRAME_DURATION_MS, type TimelapseFrame } from './timelapse';
import { PhotoTimelapse } from './PhotoTimelapse';

const mocks = vi.hoisted(() => ({
  appState: 'active' as 'active' | 'background',
  appStateListener: null as ((state: 'active' | 'background') => void) | null,
  decryptRequests: vi.fn(),
  diskCacheComplete: true,
  diskCacheResults: [] as boolean[],
  focus: vi.fn(),
  network: vi.fn(),
  reduceMotion: false as boolean | null,
}));

vi.mock('react-native', () => ({
  AccessibilityInfo: { setAccessibilityFocus: (...args: unknown[]) => mocks.focus(...args) },
  AppState: {
    get currentState() {
      return mocks.appState;
    },
    addEventListener: (_event: string, listener: typeof mocks.appStateListener) => {
      mocks.appStateListener = listener;
      return { remove: vi.fn() };
    },
  },
  findNodeHandle: () => 77,
  Modal: 'Modal',
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  View: 'View',
  useWindowDimensions: () => ({ fontScale: 2, height: 667, width: 320 }),
}));
vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
vi.mock('@/components/ui', () => ({ RouteIconButton: 'RouteIconButton', Text: 'Text' }));
vi.mock('@/lib/applock/AppLockProvider', () => ({
  useAppLock: () => ({ appUnlocked: true, enabled: true, photoTimelineUnlocked: true }),
}));
vi.mock('@/lib/auth/accountGeneration', () => ({ captureAccountIdentityGeneration: () => 9 }));
vi.mock('@/lib/accessibility/useReduceMotionPreference', () => ({
  useReduceMotionPreference: () => mocks.reduceMotion,
}));
vi.mock('@/theme/tokens', () => ({
  colors: {
    clayBright: '#AA5533',
    cream: '#FFF8EE',
    hairlineDark: '#444444',
    ink: '#111111',
    nightSurface: '#222222',
  },
}));
vi.mock('expo-image', async () => {
  const { createElement: element } = await import('react');
  return { Image: (props: Record<string, unknown>) => element('ExpoImage', props) };
});
vi.mock('./encryptedStorage', () => ({
  isEncryptedPhotoUri: (uri: unknown) =>
    typeof uri === 'string' && uri.endsWith('.layerwellphoto'),
}));
vi.mock('./sensitiveImageCoordinator', () => ({
  requestSensitiveImage: (...args: unknown[]) => {
    mocks.decryptRequests(...args);
    return {
      promise: Promise.resolve('data:image/jpeg;base64,private-frame'),
      cancel: vi.fn(),
      promote: vi.fn(),
    };
  },
}));
vi.mock('./sensitiveImageCoordinatorCore', () => ({
  isSensitiveImageRequestCancelled: () => false,
}));
vi.mock('./sensitiveImageDiskCache', () => ({
  isSensitiveImageDiskCacheMigrationComplete: () => mocks.diskCacheComplete,
  prepareSensitiveImageDiskCacheMigration: async () => {
    const result = mocks.diskCacheResults.shift() ?? mocks.diskCacheComplete;
    if (result) mocks.diskCacheComplete = true;
    return result;
  },
}));
vi.mock('./sensitiveImageMemory', () => ({
  isSensitiveImageLifecycleActive: () => true,
  purgeSensitiveImageMemory: vi.fn(),
  subscribeToSensitiveImageLifecycle: () => () => undefined,
}));

const frames: TimelapseFrame[] = [
  {
    id: 'older',
    localUri: 'file://photos/older.layerwellphoto',
    takenLocalDate: '2026-01-02',
  },
  {
    id: 'newer',
    localUri: 'file://photos/newer.layerwellphoto',
    takenLocalDate: '2026-02-03',
  },
];

let renderer: ReactTestRenderer | null = null;

function hostNode(type: string): ReactTestInstance {
  return renderer!.root.find((node) => node.type === type);
}

function displayedPhoto(): ReactTestInstance {
  return hostNode('ExpoImage');
}

beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    }),
  );
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  mocks.appState = 'active';
  mocks.appStateListener = null;
  mocks.reduceMotion = false;
  mocks.decryptRequests.mockReset();
  mocks.diskCacheComplete = true;
  mocks.diskCacheResults = [];
  mocks.focus.mockReset();
  mocks.network.mockReset();
  vi.stubGlobal('fetch', mocks.network);
});

afterEach(async () => {
  if (renderer) await act(async () => renderer?.unmount());
  renderer = null;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('PhotoTimelapse runtime contract', () => {
  it('starts dwell only after display, cancels in background, and never resumes on foreground', async () => {
    await act(async () => {
      renderer = create(createElement(PhotoTimelapse, { frames, onClose: vi.fn() }));
    });
    expect(displayedPhoto().props.recyclingKey).toContain(':older:');

    await act(async () => {
      vi.advanceTimersByTime(TIMELAPSE_FRAME_DURATION_MS);
    });
    expect(displayedPhoto().props.recyclingKey).toContain(':older:');

    await act(async () => displayedPhoto().props.onLoad());
    await act(async () => mocks.appStateListener?.('background'));
    await act(async () => {
      vi.advanceTimersByTime(TIMELAPSE_FRAME_DURATION_MS);
    });
    expect(displayedPhoto().props.recyclingKey).toContain(':older:');

    await act(async () => mocks.appStateListener?.('active'));
    await act(async () => {
      vi.advanceTimersByTime(TIMELAPSE_FRAME_DURATION_MS);
    });
    expect(displayedPhoto().props.recyclingKey).toContain(':older:');
  });

  it('renders encrypted frames through the real memory-only PhotoImage boundary', async () => {
    await act(async () => {
      renderer = create(createElement(PhotoTimelapse, { frames, onClose: vi.fn() }));
    });
    await act(async () => displayedPhoto().props.onLoad());
    await act(async () => {
      vi.advanceTimersByTime(TIMELAPSE_FRAME_DURATION_MS);
    });

    expect(displayedPhoto().props).toMatchObject({
      cachePolicy: 'none',
      source: { uri: 'data:image/jpeg;base64,private-frame' },
      transition: 0,
    });
    expect(displayedPhoto().props.recyclingKey).toContain(':newer:');
    expect(mocks.decryptRequests).toHaveBeenLastCalledWith(
      'newer:legacy-full:v1',
      'file://photos/newer.layerwellphoto',
      9,
      'interactive',
    );
    expect(mocks.network).not.toHaveBeenCalled();
  });

  it('clears a failed disk-cache migration on explicit retry and renders the recovered frame', async () => {
    mocks.diskCacheComplete = false;
    mocks.diskCacheResults = [false, true];
    await act(async () => {
      renderer = create(createElement(PhotoTimelapse, { frames, onClose: vi.fn() }));
    });

    const retry = renderer!.root.find(
      (node) => node.props.accessibilityLabel === 'Retry displaying this photo',
    );
    const blockedPlay = renderer!.root.find(
      (node) =>
        node.props.accessibilityLabel === 'Retry this photo before playing the time-lapse',
    );
    expect(blockedPlay.props.disabled).toBe(true);

    await act(async () => retry.props.onPress());

    expect(displayedPhoto().props.source).toEqual({
      uri: 'data:image/jpeg;base64,private-frame',
    });
    expect(
      renderer!.root.findAll(
        (node) => node.props.accessibilityLabel === 'Retry displaying this photo',
      ),
    ).toHaveLength(0);
  });

  it('exposes modal escape, a focusable heading, and scrollable large-text content', async () => {
    const onClose = vi.fn();
    await act(async () => {
      renderer = create(createElement(PhotoTimelapse, { frames, onClose }));
    });

    const scrollView = hostNode('ScrollView');
    expect(scrollView.props).toMatchObject({
      accessibilityViewIsModal: true,
      showsVerticalScrollIndicator: false,
    });
    await act(async () => scrollView.props.onAccessibilityEscape());
    expect(onClose).toHaveBeenCalledOnce();

    const heading = renderer!.root.find(
      (node) => node.props.accessibilityRole === 'header',
    );
    expect(heading.props.accessibilityLabel).toContain('oldest to newest');
    expect(scrollView.props.contentContainerStyle.flexGrow).toBe(1);
    expect(mocks.focus).toHaveBeenCalledWith(77);
  });
});
