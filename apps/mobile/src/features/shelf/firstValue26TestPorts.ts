// Campaign26 test-only platform adapters. Feature hooks, encryption, codecs,
// account/grant admission, local stores and Query are always the real modules.
import { createHash, randomUUID } from 'node:crypto';
import { createElement, type ReactNode } from 'react';
import { QueryClient, onlineManager } from '@tanstack/react-query';
import { act } from 'react-test-renderer';
import { vi } from 'vitest';

const ports26 = vi.hoisted(() => ({
  bytes: new Map<string, string>(),
  failRead: null as string | null,
  failWrite: null as string | null,
  holdRead: null as string | null,
  release: null as (() => void) | null,
  params: {} as Record<string, string>,
  appState: new Set<(state: string) => void>(),
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  track: vi.fn(),
  keyboardDismiss: vi.fn(),
  routeName: 'manual',
  routeChild: null as ReactNode,
  dimensions: { width: 430, height: 932, fontScale: 1 },
  insets: { top: 0, bottom: 0, left: 0, right: 0 },
}));
export { ports26 };
vi.mock('react-native-get-random-values', () => ({}));
vi.mock('react-native', () => ({
  Platform: {
    OS: 'web',
    select: (options: { web?: unknown; default?: unknown }) => options.web ?? options.default,
  },
  ActivityIndicator: 'ActivityIndicator',
  Modal: 'Modal',
  KeyboardAvoidingView: 'KeyboardAvoidingView',
  Keyboard: { dismiss: ports26.keyboardDismiss },
  AccessibilityInfo: {
    isReduceMotionEnabled: async () => true,
    addEventListener: () => ({ remove() {} }),
  },
  View: 'View',
  Text: 'Text',
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  TextInput: 'TextInput',
  AppState: {
    currentState: 'active',
    addEventListener: (_name: string, fn: (state: string) => void) => {
      ports26.appState.add(fn);
      return { remove: () => ports26.appState.delete(fn) };
    },
  },
  useWindowDimensions: () => ports26.dimensions,
}));
vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView',
  useSafeAreaInsets: () => ports26.insets,
}));
vi.mock('expo-status-bar', () => ({ StatusBar: 'StatusBar' }));
vi.mock('expo-haptics', () => ({ selectionAsync: async () => undefined }));
vi.mock('expo-secure-store', () => ({}));
vi.mock('expo-crypto', () => ({
  randomUUID,
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: async (_algorithm: unknown, text: string) =>
    createHash('sha256').update(text).digest('hex'),
}));
vi.mock('expo-router', () => {
  const Stack = ({
    screenLayout,
  }: {
    screenLayout: (value: { route: { name: string }; children: ReactNode }) => ReactNode;
  }) => screenLayout({ route: { name: ports26.routeName }, children: ports26.routeChild });
  Stack.Screen = function StackScreen() {
    return null;
  };
  return {
    Stack,
    Redirect: (props: object) => createElement('Redirect', props),
    router: {
      push: ports26.push,
      replace: ports26.replace,
      canGoBack: () => true,
      back: ports26.back,
    },
    useLocalSearchParams: () => ports26.params,
  };
});
vi.mock('expo-router/react-navigation', () => ({ usePreventRemove: () => undefined }));
vi.mock('expo-router/build/react-navigation/core/NavigationContext', async () => ({
  NavigationContext: (await import('react')).createContext(undefined),
}));
vi.mock('@/lib/supabase/client', () => ({
  getPersistedSupabaseUser: async () => null,
  supabase: {
    from: () => {
      throw new Error('NO_EXTERNAL_TRANSPORT_IN_LOCAL_TEST');
    },
  },
}));
vi.mock('@/lib/analytics/track', () => ({ track: ports26.track }));
// Use actual UI implementations, avoiding eager native-only barrel exports.
vi.mock('@/components/ui', async () => ({
  ...(await import('@/components/ui/Button')),
  ...(await import('@/components/ui/Screen')),
  ...(await import('@/components/ui/Text')),
  ...(await import('@/components/ui/Card')),
  ...(await import('@/components/ui/Sheet')),
  ...(await import('@/components/ui/RouteIconButton')),
  ...(await import('@/components/ui/StateNotice')),
  ...(await import('@/components/ui/StripedThumb')),
}));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => {
      if (ports26.failRead === key) throw new Error('SYNTHETIC_PLATFORM_READ_REFUSED');
      const snapshot = ports26.bytes.get(key) ?? null;
      if (ports26.holdRead === key) {
        ports26.holdRead = null;
        await new Promise<void>((resolve) => {
          ports26.release = resolve;
        });
      }
      return snapshot;
    },
    setItem: async (key: string, raw: string) => {
      if (ports26.failWrite === key) throw new Error('SYNTHETIC_PLATFORM_WRITE_REFUSED');
      ports26.bytes.set(key, raw);
    },
    getAllKeys: async () => [...ports26.bytes.keys()],
    multiGet: async (keys: string[]) => keys.map((key) => [key, ports26.bytes.get(key) ?? null]),
    removeItem: async (key: string) => {
      ports26.bytes.delete(key);
    },
    multiRemove: async (keys: string[]) => {
      keys.forEach((key) => ports26.bytes.delete(key));
    },
  },
}));

export async function grant26(ownerUserId = 'synthetic-first-value-a') {
  const { runAccountGenerationOperation } = await import('@/lib/auth/accountGeneration');
  const { clearActiveHealthProcessingEpoch, setActiveHealthProcessingEpoch } =
    await import('@/lib/consent/healthProcessingEpoch');
  clearActiveHealthProcessingEpoch();
  const accountGeneration = await runAccountGenerationOperation((lease) => lease.generation);
  setActiveHealthProcessingEpoch(25, { ownerUserId, accountGeneration });
}
export async function reset26() {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  ports26.bytes.clear();
  ports26.failRead = null;
  ports26.failWrite = null;
  ports26.holdRead = null;
  ports26.release = null;
  ports26.params = {};
  ports26.routeName = 'manual';
  ports26.routeChild = null;
  ports26.dimensions = { width: 430, height: 932, fontScale: 1 };
  ports26.insets = { top: 0, bottom: 0, left: 0, right: 0 };
  vi.clearAllMocks();
  const { clearActiveHealthProcessingEpoch } = await import('@/lib/consent/healthProcessingEpoch');
  clearActiveHealthProcessingEpoch();
  const { HEALTH_DATA_CONSENT } = await import('@/features/onboarding/consentCopy');
  const { setHealthDataCollectionConsentLocal } =
    await import('@/features/onboarding/healthConsentStore');
  await setHealthDataCollectionConsentLocal({
    granted: true,
    version: HEALTH_DATA_CONSENT.version,
    consentText: HEALTH_DATA_CONSENT.fullText,
  });
  await grant26();
  onlineManager.setOnline(false);
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, retryDelay: 0, staleTime: Infinity, gcTime: Infinity },
    },
  });
}
export async function profile26() {
  const { ONBOARDING_QUIZ, scoreQuiz } = await import('@/features/onboarding/quiz');
  const answers = Object.fromEntries(
    ONBOARDING_QUIZ.map((q) => [q.id, q.multiSelect ? [q.options[0]!.id] : q.options[0]!.id]),
  );
  const { setStoredSkinProfileFromExplicitQuiz } =
    await import('@/features/onboarding/skinProfileStore');
  await setStoredSkinProfileFromExplicitQuiz({
    result: scoreQuiz(answers),
    goals: ['clear_skin'],
    completedAt: new Date().toISOString(),
  });
  return answers;
}
export async function shelf26() {
  const { addProduct } = await import('./store');
  for (const [name, category] of [
    ['Synthetic cleanser', 'cleanser'],
    ['Synthetic balm', 'moisturiser'],
    ['Synthetic SPF', 'sunscreen'],
  ] as const) {
    await addProduct({ operationId: randomUUID(), name, category, addedVia: 'manual' });
  }
}
export async function flush26() {
  await act(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 25));
  });
}
export async function close26(client: QueryClient) {
  ports26.release?.();
  ports26.release = null;
  ports26.failRead = null;
  ports26.failWrite = null;
  ports26.holdRead = null;
  client.clear();
  onlineManager.setOnline(true);
  const { clearActiveHealthProcessingEpoch } = await import('@/lib/consent/healthProcessingEpoch');
  clearActiveHealthProcessingEpoch();
}
