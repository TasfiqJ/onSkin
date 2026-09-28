import { createElement, type ComponentType, type ReactNode } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AgeGateScreen from '../../app/onboarding/age';
import { AgePolicyGate } from './AgePolicyGate';
import type { AgePolicyReceiptStatus } from './ageGateStore';
import {
  clearAgePolicyReverificationHandoff,
  consumePostAgeConsentRoute,
  stagePostAgeConsentRoute,
} from './agePolicyRoute';

type TestAppState = 'active' | 'background' | 'inactive';
type QueryCacheListener = (event: {
  type: 'updated';
  action: { type: 'success' };
  query: {
    queryKey: readonly unknown[];
    state: { data: unknown };
  };
}) => void;

const mocks = vi.hoisted(() => ({
  appState: 'active' as TestAppState,
  appStateListener: null as ((state: TestAppState) => void) | null,
  getReceiptStatus: vi.fn<() => Promise<AgePolicyReceiptStatus>>(),
  queryCacheListeners: new Set<QueryCacheListener>(),
  replace: vi.fn(),
  segments: ['today'] as string[],
  setAgeVerified: vi.fn(),
  setQueryData: vi.fn(),
}));

vi.mock('react-native', () => ({
  AppState: {
    get currentState() {
      return mocks.appState;
    },
    addEventListener: vi.fn((_event: string, listener: (state: TestAppState) => void) => {
      mocks.appStateListener = listener;
      return {
        remove: () => {
          if (mocks.appStateListener === listener) mocks.appStateListener = null;
        },
      };
    }),
  },
  Platform: { OS: 'web' },
  ScrollView: 'ScrollView',
  TextInput: 'TextInput',
  Pressable: 'Pressable',
  View: 'View',
  useWindowDimensions: () => ({ fontScale: 1, height: 844, width: 390 }),
}));
vi.mock('expo-router', () => ({
  router: { replace: mocks.replace },
  useSegments: () => mocks.segments,
}));
vi.mock('@/components/ui', () => ({
  Button: 'Button',
  Screen: 'Screen',
  Text: 'Text',
}));
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ setQueryData: mocks.setQueryData }),
}));
vi.mock('@/lib/analytics/track', () => ({ track: vi.fn() }));
vi.mock('@/lib/auth/AuthProvider', () => ({
  useAuth: () => ({ ensureAnonymousSession: vi.fn(async () => undefined) }),
}));
vi.mock('@/lib/brand', () => ({ BRAND: { appName: 'Layerwell' } }));
vi.mock('@/lib/query/queryClient', () => ({
  queryClient: {
    getQueryCache: () => ({
      subscribe: (listener: QueryCacheListener) => {
        mocks.queryCacheListeners.add(listener);
        return () => mocks.queryCacheListeners.delete(listener);
      },
    }),
    setQueryData: mocks.setQueryData,
  },
}));
vi.mock('@/theme/tokens', () => ({
  colors: { ink: '#111111', paper: '#ffffff' },
}));
vi.mock('./ageGateStore', () => ({
  AGE_POLICY_STATUS_QUERY_KEY: ['agePolicyReceiptStatus', 'policy-hash'],
  getAgePolicyReceiptStatus: mocks.getReceiptStatus,
  setAgeVerified: mocks.setAgeVerified,
}));

let renderer: ReactTestRenderer | null = null;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

async function flush(): Promise<void> {
  await act(async () => {
    for (let index = 0; index < 8; index += 1) await Promise.resolve();
  });
}

async function renderGate(withAgeRoute = false): Promise<void> {
  await act(async () => {
    renderer = create(
      createElement(
        AgePolicyGate as ComponentType<{ bootstrap: ReactNode; children?: ReactNode }>,
        {
          bootstrap: withAgeRoute
            ? createElement(AgeGateScreen)
            : createElement('Bootstrap', { testID: 'bootstrap' }),
        },
        createElement(
          'ProtectedProviders',
          { testID: 'protected' },
          withAgeRoute ? createElement(AgeGateScreen) : null,
        ),
      ),
    );
  });
}

async function emitAppState(state: TestAppState): Promise<void> {
  mocks.appState = state;
  await act(async () => {
    mocks.appStateListener?.(state);
    await Promise.resolve();
  });
}

function protectedMounted(): boolean {
  return renderer!.root.findAllByProps({ testID: 'protected' }).length > 0;
}

function renderedText(): string {
  return JSON.stringify(renderer!.toJSON());
}

beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  mocks.appState = 'active';
  mocks.appStateListener = null;
  mocks.segments = ['today'];
  mocks.getReceiptStatus.mockReset();
  mocks.queryCacheListeners.clear();
  mocks.replace.mockReset();
  mocks.setAgeVerified.mockReset().mockResolvedValue(undefined);
  mocks.setQueryData
    .mockReset()
    .mockImplementation((queryKey: readonly unknown[], data: unknown) => {
      for (const listener of mocks.queryCacheListeners) {
        listener({
          type: 'updated',
          action: { type: 'success' },
          query: { queryKey, state: { data } },
        });
      }
    });
  consumePostAgeConsentRoute();
  clearAgePolicyReverificationHandoff();
});

afterEach(async () => {
  if (renderer) await act(async () => renderer?.unmount());
  renderer = null;
});

describe('AgePolicyGate foreground receipt lifecycle', () => {
  it('closes protected providers on background and keeps them closed through a fresh missing read', async () => {
    const initial = deferred<AgePolicyReceiptStatus>();
    mocks.getReceiptStatus.mockReturnValueOnce(initial.promise);
    await renderGate();

    expect(protectedMounted()).toBe(false);
    expect(renderedText()).toContain('Checking age eligibility');

    initial.resolve('current');
    await flush();
    expect(protectedMounted()).toBe(true);
    expect(mocks.setQueryData).toHaveBeenLastCalledWith(expect.any(Array), 'current');

    await emitAppState('background');
    expect(protectedMounted()).toBe(false);
    expect(renderedText()).toContain('Checking age eligibility');

    const foreground = deferred<AgePolicyReceiptStatus>();
    mocks.getReceiptStatus.mockReturnValueOnce(foreground.promise);
    await emitAppState('active');
    expect(mocks.getReceiptStatus).toHaveBeenCalledTimes(2);
    expect(protectedMounted()).toBe(false);

    foreground.resolve('missing');
    await flush();
    expect(protectedMounted()).toBe(false);
    expect(mocks.replace).toHaveBeenLastCalledWith('/onboarding/age');
    expect(mocks.setQueryData).toHaveBeenLastCalledWith(expect.any(Array), 'missing');
  });

  it('keeps an unavailable foreground read closed and retryable until a current read succeeds', async () => {
    mocks.getReceiptStatus.mockResolvedValueOnce('current');
    await renderGate();
    await flush();
    expect(protectedMounted()).toBe(true);

    await emitAppState('inactive');
    const foreground = deferred<AgePolicyReceiptStatus>();
    mocks.getReceiptStatus.mockReturnValueOnce(foreground.promise);
    await emitAppState('active');
    expect(protectedMounted()).toBe(false);

    foreground.resolve('unavailable');
    await flush();
    expect(protectedMounted()).toBe(false);
    expect(renderedText()).toContain('Try again');
    expect(mocks.replace).not.toHaveBeenCalled();

    const retry = deferred<AgePolicyReceiptStatus>();
    mocks.getReceiptStatus.mockReturnValueOnce(retry.promise);
    const retryButton = renderer!.root.findAll(
      (node) =>
        node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function',
    )[0]!;
    await act(async () => {
      retryButton.props.onPress();
      await Promise.resolve();
    });
    expect(retryButton.props.disabled).toBe(true);
    expect(renderedText()).toContain('Trying again');
    expect(protectedMounted()).toBe(false);

    retry.resolve('current');
    await flush();
    expect(protectedMounted()).toBe(true);
    expect(mocks.setQueryData).toHaveBeenLastCalledWith(expect.any(Array), 'current');
  });

  it('ignores stale reads from an earlier foreground generation', async () => {
    mocks.getReceiptStatus.mockResolvedValueOnce('current');
    await renderGate();
    await flush();
    expect(protectedMounted()).toBe(true);

    await emitAppState('background');
    const firstForeground = deferred<AgePolicyReceiptStatus>();
    mocks.getReceiptStatus.mockReturnValueOnce(firstForeground.promise);
    await emitAppState('active');
    expect(protectedMounted()).toBe(false);

    await emitAppState('background');
    const secondForeground = deferred<AgePolicyReceiptStatus>();
    mocks.getReceiptStatus.mockReturnValueOnce(secondForeground.promise);
    await emitAppState('active');

    firstForeground.resolve('current');
    await flush();
    expect(protectedMounted()).toBe(false);
    expect(mocks.setQueryData).toHaveBeenCalledTimes(1);

    secondForeground.resolve('missing');
    await flush();
    expect(protectedMounted()).toBe(false);
    expect(mocks.replace).toHaveBeenLastCalledWith('/onboarding/age');
    expect(mocks.setQueryData).toHaveBeenCalledTimes(2);
  });

  it('does not re-read for duplicate active events without a foreground transition', async () => {
    mocks.getReceiptStatus.mockResolvedValueOnce('current');
    await renderGate();
    await flush();

    await emitAppState('active');
    await emitAppState('active');

    expect(mocks.getReceiptStatus).toHaveBeenCalledOnce();
    expect(protectedMounted()).toBe(true);
  });

  it('ignores cached current data but accepts the age route publication after its durable write', async () => {
    mocks.segments = ['onboarding', 'age'];
    mocks.setQueryData(['agePolicyReceiptStatus', 'policy-hash'], 'current');
    const initial = deferred<AgePolicyReceiptStatus>();
    mocks.getReceiptStatus.mockReturnValueOnce(initial.promise);
    await renderGate();

    expect(protectedMounted()).toBe(false);
    expect(renderedText()).toContain('Checking age eligibility');

    initial.resolve('missing');
    await flush();
    expect(protectedMounted()).toBe(false);
    expect(renderer!.root.findAllByProps({ testID: 'bootstrap' })).toHaveLength(1);

    stagePostAgeConsentRoute();
    await act(async () => {
      mocks.setQueryData(['agePolicyReceiptStatus', 'policy-hash'], 'current');
      await Promise.resolve();
    });

    expect(protectedMounted()).toBe(true);
    expect(mocks.replace).toHaveBeenLastCalledWith('/onboarding/consent');
  });

  it('immediately closes protected providers for a fresh missing age-route publication', async () => {
    mocks.segments = ['onboarding', 'age'];
    mocks.getReceiptStatus.mockResolvedValueOnce('current');
    await renderGate();
    await flush();
    expect(protectedMounted()).toBe(true);

    await act(async () => {
      mocks.setQueryData(['agePolicyReceiptStatus', 'policy-hash'], 'missing');
      await Promise.resolve();
    });

    expect(protectedMounted()).toBe(false);
    expect(renderer!.root.findAllByProps({ testID: 'bootstrap' })).toHaveLength(1);
  });

  it('keeps a failed age-route revocation closed and ignores its older pending read', async () => {
    mocks.segments = ['onboarding', 'age'];
    const staleRead = deferred<AgePolicyReceiptStatus>();
    mocks.getReceiptStatus.mockReturnValueOnce(staleRead.promise);
    await renderGate();

    await act(async () => {
      mocks.setQueryData(['agePolicyReceiptStatus', 'policy-hash'], 'unavailable');
      await Promise.resolve();
    });
    expect(protectedMounted()).toBe(false);
    expect(renderedText()).toContain('Try again');

    staleRead.resolve('current');
    await flush();

    expect(protectedMounted()).toBe(false);
    expect(renderedText()).toContain('Try again');
  });

  it('ignores downgrade publications outside the safe age route', async () => {
    mocks.segments = ['today'];
    mocks.getReceiptStatus.mockResolvedValueOnce('current');
    await renderGate();
    await flush();
    expect(protectedMounted()).toBe(true);

    await act(async () => {
      mocks.setQueryData(['agePolicyReceiptStatus', 'policy-hash'], 'missing');
      await Promise.resolve();
    });

    expect(protectedMounted()).toBe(true);
  });

  it('preserves the calm re-verification state across the protected-to-bootstrap tree swap', async () => {
    mocks.segments = ['onboarding', 'age'];
    mocks.getReceiptStatus.mockResolvedValueOnce('current').mockResolvedValueOnce('current');
    mocks.setAgeVerified.mockRejectedValueOnce(new Error('private kv unavailable'));
    await renderGate(true);
    await flush();
    expect(protectedMounted()).toBe(true);

    const inputs = renderer!.root.findAll((node) => String(node.type) === 'TextInput');
    expect(inputs).toHaveLength(3);
    await act(async () => {
      inputs[0]!.props.onChangeText('01');
      inputs[1]!.props.onChangeText('01');
      inputs[2]!.props.onChangeText('2020');
      await Promise.resolve();
    });
    const submit = renderer!.root.find((node) => String(node.type) === 'Button');
    expect(submit.props.disabled).toBe(false);

    await act(async () => {
      submit.props.onPress();
      await Promise.resolve();
    });
    await flush();

    expect(protectedMounted()).toBe(false);
    expect(mocks.setAgeVerified).toHaveBeenCalledExactlyOnceWith(false);
    expect(renderedText()).toContain('You need to be at least');
    expect(renderedText()).toContain("We couldn't finish the age check");
    expect(
      renderer!.root
        .findAll((node) => String(node.type) === 'TextInput')
        .map((input) => input.props.value),
    ).toEqual(['', '', '']);

    await act(async () => {
      mocks.setQueryData(['agePolicyReceiptStatus', 'policy-hash'], 'current');
      await Promise.resolve();
    });
    expect(protectedMounted()).toBe(false);

    await emitAppState('background');
    await emitAppState('active');
    await flush();
    expect(protectedMounted()).toBe(false);
    expect(renderedText()).toContain("We couldn't finish the age check");
  });
});
