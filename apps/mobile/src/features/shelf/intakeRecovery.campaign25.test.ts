import { createHash, randomUUID } from 'node:crypto';
import { createElement, StrictMode, useLayoutEffect, useRef } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import OpenedDateScreen from '@/app/shelf/opened';
import { Button } from '@/components/ui/Button';
import { ShelfDataAvailabilityGate } from '@/features/shelf/ShelfDataAvailabilityGate';
import { IntakeProvider, useIntake } from '@/features/shelf/IntakeContext';
import { addProduct, loadShelf } from '@/features/shelf/store';
import { HEALTH_DATA_CONSENT } from '@/features/onboarding/consentCopy';
import { setHealthDataCollectionConsentLocal } from '@/features/onboarding/healthConsentStore';
import { setStoredSkinProfileFromExplicitQuiz } from '@/features/onboarding/skinProfileStore';
import { ONBOARDING_QUIZ, scoreQuiz, type QuizAnswers } from '@/features/onboarding/quiz';
import { runAccountGenerationOperation } from '@/lib/auth/accountGeneration';
import {
  clearActiveHealthProcessingEpoch,
  setActiveHealthProcessingEpoch,
} from '@/lib/consent/healthProcessingEpoch';

// Actual stores, encryption, receipts, owner/grant APIs, Query, route and UI.
// Only native hardware/rendering/router and absent external transport controlled.
const native = vi.hoisted(() => ({
  bytes: new Map<string, string>(),
  failShelfReads: false,
  failAfterCommit: false,
  holdReadAfterCommit: false,
  holdNextRead: false,
  releaseReadback: null as (() => void) | null,
  holdWrite: null as Promise<void> | null,
  releaseWrite: null as (() => void) | null,
  intakeId: null as string | null,
  pushes: [] as unknown[],
  replacements: [] as unknown[],
}));
vi.mock('react-native-get-random-values', () => ({}));
vi.mock('react-native', () => ({
  Platform: { OS: 'web' },
  ActivityIndicator: 'ActivityIndicator',
  View: 'View',
  Text: 'Text',
  AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) },
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  TextInput: 'TextInput',
  useWindowDimensions: () => ({ width: 430, height: 932, fontScale: 1 }),
}));
vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView',
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
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
vi.mock('expo-router', () => ({
  router: {
    push: (route: unknown) => native.pushes.push(route),
    replace: (route: unknown) => native.replacements.push(route),
    canGoBack: () => true,
    back: vi.fn(),
  },
  useLocalSearchParams: () => ({ intakeId: native.intakeId }),
}));
vi.mock('expo-router/react-navigation', () => ({ usePreventRemove: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: () => {
      throw new Error('NO_EXTERNAL_TRANSPORT_IN_LOCAL_REPRO');
    },
  },
}));
// Resolve only used exports, retaining their actual implementations.
vi.mock('@/components/ui', async () => ({
  ...(await import('@/components/ui/Button')),
  ...(await import('@/components/ui/Screen')),
  ...(await import('@/components/ui/Text')),
  ...(await import('@/components/ui/RouteIconButton')),
  ...(await import('@/components/ui/StateNotice')),
  ...(await import('@/components/ui/Sheet')),
}));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => {
      if (native.failShelfReads && key === 'layerwell.shelf.v1')
        throw new Error('SYNTHETIC_NATIVE_SHELF_READ_FAILURE');
      const snapshot = native.bytes.get(key) ?? null;
      if (key === 'layerwell.shelf.v1' && native.holdNextRead) {
        native.holdNextRead = false;
        await new Promise<void>((release) => {
          native.releaseReadback = release;
        });
      }
      return snapshot;
    },
    setItem: async (key: string, raw: string) => {
      native.bytes.set(key, raw);
      if (native.failAfterCommit && key === 'layerwell.shelf.v1') native.failShelfReads = true;
      if (native.holdReadAfterCommit && key === 'layerwell.shelf.v1') native.holdNextRead = true;
      if (native.holdWrite && key === 'layerwell.shelf.v1') await native.holdWrite;
    },
    getAllKeys: async () => [...native.bytes.keys()],
    multiGet: async (keys: string[]) => keys.map((key) => [key, native.bytes.get(key) ?? null]),
    removeItem: async (key: string) => {
      native.bytes.delete(key);
    },
    multiRemove: async (keys: string[]) => {
      keys.forEach((key) => native.bytes.delete(key));
    },
  },
}));

let screen: ReactTestRenderer | undefined;
let client: QueryClient;
let intake: ReturnType<typeof useIntake>;
const pause = () => new Promise<void>((resolve) => setTimeout(resolve, 20));
async function flush() {
  await act(async () => {
    await pause();
  });
}
function input(label: string) {
  return screen!.root
    .findAllByType('TextInput' as never)
    .find((node) => node.props.accessibilityLabel === label);
}
function action(label: string) {
  return screen!.root
    .findAllByType('Pressable' as never)
    .find((node) => node.props.accessibilityLabel === label)!;
}
function save() {
  return screen!.root
    .findAllByType(Button)
    .find((node) => ['Add to shelf', 'Finish setup'].includes(node.props.label))!;
}
function SeedDraft() {
  const current = useIntake();
  const seeded = useRef(false);
  useLayoutEffect(() => {
    intake = current;
    if (seeded.current) return;
    seeded.current = true;
    native.intakeId = current.reset({
      name: 'Draft synthetic cleanser',
      category: 'cleanser',
      addedVia: 'manual',
    });
  }, [current]);
  return null;
}
async function mount() {
  await act(async () => {
    screen = create(
      createElement(
        StrictMode,
        null,
        createElement(
          QueryClientProvider,
          { client },
          createElement(
            IntakeProvider,
            null,
            createElement(SeedDraft),
            createElement(
              ShelfDataAvailabilityGate,
              { preserveMountedDraft: true } as Parameters<typeof ShelfDataAvailabilityGate>[0],
              createElement(OpenedDateScreen),
            ),
          ),
        ),
      ),
    );
  });
  await flush();
  expect(action('Pick a date')).toBeDefined();
}
async function chooseDateAndPao() {
  await act(async () => {
    action('Pick a date').props.onPress();
  });
  await act(async () => {
    input('Exact opened date')!.props.onChangeText('2026-09-14');
  });
  await act(async () => {
    action('Edit period after opening').props.onPress();
  });
  await act(async () => {
    input('PAO months printed on label')!.props.onChangeText('15');
  });
}

beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  native.bytes.clear();
  native.pushes = [];
  native.replacements = [];
  native.intakeId = null;
  native.failShelfReads = false;
  native.failAfterCommit = false;
  native.holdReadAfterCommit = false;
  native.holdNextRead = false;
  native.releaseReadback = null;
  native.holdWrite = null;
  native.releaseWrite = null;
  clearActiveHealthProcessingEpoch();
  await setHealthDataCollectionConsentLocal({
    granted: true,
    version: HEALTH_DATA_CONSENT.version,
    consentText: HEALTH_DATA_CONSENT.fullText,
  });
  const accountGeneration = await runAccountGenerationOperation((lease) => lease.generation);
  setActiveHealthProcessingEpoch(25, {
    ownerUserId: 'synthetic-review-owner-a',
    accountGeneration,
  });
  const answers = Object.fromEntries(
    ONBOARDING_QUIZ.map((question) => [
      question.id,
      question.multiSelect ? [question.options[0]!.id] : question.options[0]!.id,
    ]),
  ) as QuizAnswers;
  await setStoredSkinProfileFromExplicitQuiz({
    result: scoreQuiz(answers),
    goals: ['clear_skin'],
    completedAt: new Date().toISOString(),
  });
  await addProduct({
    name: 'Existing synthetic owned balm',
    category: 'moisturiser',
    addedVia: 'manual',
    operationId: randomUUID(),
  });
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, retryDelay: 0, gcTime: Infinity } },
  });
});
afterEach(async () => {
  native.releaseReadback?.();
  native.releaseWrite?.();
  native.holdReadAfterCommit = false;
  native.holdNextRead = false;
  native.holdWrite = null;
  native.failShelfReads = false;
  native.failAfterCommit = false;
  await act(async () => {
    screen?.unmount();
  });
  screen = undefined;
  client.clear();
  clearActiveHealthProcessingEpoch();
});

it('retains exact opened choice, date, and unconfirmed PAO text across a same-grant read failure/retry', async () => {
  await mount();
  await chooseDateAndPao();
  const originalSession = intake.sessionId;
  native.failShelfReads = true;
  await act(async () => {
    await client.refetchQueries({ queryKey: ['shelf'], exact: true });
  });
  await flush();
  expect(client.getQueryState(['shelf'])?.status).toBe('error');
  expect(JSON.stringify(screen!.toJSON())).toContain('Shelf data unavailable');
  native.failShelfReads = false;
  await act(async () => {
    await client.refetchQueries({ queryKey: ['shelf'], exact: true });
  });
  await flush();
  expect(intake.sessionId).toBe(originalSession);
  expect(action('Pick a date').props.accessibilityState.selected).toBe(true);
  expect(input('Exact opened date')?.props.value).toBe('2026-09-14');
  expect(input('PAO months printed on label')?.props.value).toBe('15');
});

it('denies a captured Save while canonical Shelf source is in error even after native read availability returns', async () => {
  await mount();
  await act(async () => {
    action('Not opened yet').props.onPress();
  });
  const capturedSave = save().props.onPress;
  native.failShelfReads = true;
  await act(async () => {
    await client.refetchQueries({ queryKey: ['shelf'], exact: true });
  });
  await flush();
  expect(client.getQueryState(['shelf'])?.status).toBe('error');
  native.failShelfReads = false;
  await act(async () => {
    await capturedSave();
  });
  await flush();
  expect(await loadShelf()).toHaveLength(1);
  expect(native.replacements).toEqual([]);
});

it('retains the intake and avoids navigation when add commits but canonical readback is unavailable', async () => {
  await mount();
  await act(async () => {
    action('Not opened yet').props.onPress();
  });
  const originalSession = intake.sessionId;
  const saving = save().props.onPress;
  native.failAfterCommit = true;
  await act(async () => {
    await saving();
  });
  await flush();
  expect(client.getQueryState(['shelf'])?.status).toBe('error');
  expect(intake.sessionId).toBe(originalSession);
  expect(native.replacements).toEqual([]);
  native.failShelfReads = false;
  native.failAfterCommit = false;
  expect(await loadShelf()).toHaveLength(2);
});

it('denies a captured Save after the same owner and epoch are cleared and regranted', async () => {
  await mount();
  await act(async () => {
    action('Not opened yet').props.onPress();
  });
  const capturedSave = save().props.onPress;
  const accountGeneration = await runAccountGenerationOperation((lease) => lease.generation);
  await act(async () => {
    clearActiveHealthProcessingEpoch();
    setActiveHealthProcessingEpoch(25, {
      ownerUserId: 'synthetic-review-owner-a',
      accountGeneration,
    });
    await capturedSave();
  });
  expect(await loadShelf()).toHaveLength(1);
  expect(native.replacements).toEqual([]);
});

it('does not let an older Close callback clear a successor intake session', async () => {
  await mount();
  const oldClose = action('Close').props.onPress;
  let successor!: string;
  await act(async () => {
    successor = intake.reset({
      name: 'Successor synthetic product',
      category: 'moisturiser_tube',
      addedVia: 'manual',
    });
    oldClose();
  });
  expect(intake.sessionId).toBe(successor);
  expect(intake.draft.name).toBe('Successor synthetic product');
});

it('actually saves once and navigates under React StrictMode', async () => {
  await mount();
  await act(async () => {
    action('Not opened yet').props.onPress();
  });
  await act(async () => {
    await save().props.onPress();
  });
  await flush();
  expect(await loadShelf()).toHaveLength(2);
  expect(native.replacements).toHaveLength(1);
});

it('joins rapid duplicate Add callbacks into exactly one durable product and one navigation', async () => {
  await mount();
  await act(async () => {
    action('Not opened yet').props.onPress();
  });
  const oldSave = save().props.onPress;
  await act(async () => {
    await Promise.all([oldSave(), oldSave(), oldSave()]);
  });
  await flush();
  expect(await loadShelf()).toHaveLength(2);
  expect(native.replacements).toHaveLength(1);
});

it('retries postcommit readback against the exact same persisted product identity', async () => {
  await mount();
  await act(async () => {
    action('Not opened yet').props.onPress();
  });
  native.failAfterCommit = true;
  await act(async () => {
    await save().props.onPress();
  });
  await flush();
  expect(client.getQueryState(['shelf'])?.status).toBe('error');
  native.failShelfReads = false;
  native.failAfterCommit = false;
  const persisted = await loadShelf();
  const savedProduct = persisted.find((product) => product.name === 'Draft synthetic cleanser')!;
  expect(savedProduct).toBeDefined();
  await act(async () => {
    await client.refetchQueries({ queryKey: ['shelf'], exact: true });
  });
  await flush();
  await act(async () => {
    await save().props.onPress();
  });
  await flush();
  const after = await loadShelf();
  expect(after).toHaveLength(2);
  expect(after.find((product) => product.name === 'Draft synthetic cleanser')?.id).toBe(
    savedProduct.id,
  );
  expect(native.replacements).toHaveLength(1);
});

it('rejects a queued opening edit captured before an uncertain save freezes its payload', async () => {
  await mount();
  await act(async () => {
    action('Not opened yet').props.onPress();
  });
  const queuedJustOpened = action('Just opened it').props.onPress;
  const saving = save().props.onPress;
  native.failAfterCommit = true;
  await act(async () => {
    const pending = saving();
    queuedJustOpened();
    await pending;
  });
  await flush();
  native.failShelfReads = false;
  native.failAfterCommit = false;
  const committed = (await loadShelf()).find(
    (product) => product.name === 'Draft synthetic cleanser',
  )!;
  expect(committed.isOpened).toBe(false);
  await act(async () => {
    await client.refetchQueries({ queryKey: ['shelf'], exact: true });
  });
  await flush();
  expect(action('Not opened yet').props.accessibilityState.selected).toBe(true);
  expect(action('Just opened it').props.accessibilityState.selected).toBe(false);
});

it('does not publish or clear the intake from a delayed readback after same-owner regrant', async () => {
  await mount();
  await act(async () => {
    action('Not opened yet').props.onPress();
  });
  const originalSession = intake.sessionId;
  const start = save().props.onPress;
  native.holdReadAfterCommit = true;
  let pending!: Promise<void>;
  await act(async () => {
    pending = start();
    await pause();
  });
  expect(native.releaseReadback).not.toBeNull();
  const accountGeneration = await runAccountGenerationOperation((lease) => lease.generation);
  await act(async () => {
    clearActiveHealthProcessingEpoch();
    setActiveHealthProcessingEpoch(25, {
      ownerUserId: 'synthetic-review-owner-a',
      accountGeneration,
    });
    native.holdReadAfterCommit = false;
    native.releaseReadback?.();
    await pending;
  });
  await flush();
  expect(native.replacements).toEqual([]);
  expect(intake.sessionId).toBe(originalSession);
});

it('rolls back a delayed native write and publishes no completion after same-owner regrant', async () => {
  await mount();
  await act(async () => {
    action('Not opened yet').props.onPress();
  });
  const originalSession = intake.sessionId;
  const start = save().props.onPress;
  native.holdWrite = new Promise<void>((release) => {
    native.releaseWrite = release;
  });
  let pending!: Promise<void>;
  await act(async () => {
    pending = start();
    await pause();
  });
  const accountGeneration = await runAccountGenerationOperation((lease) => lease.generation);
  await act(async () => {
    clearActiveHealthProcessingEpoch();
    setActiveHealthProcessingEpoch(25, {
      ownerUserId: 'synthetic-review-owner-a',
      accountGeneration,
    });
    native.holdWrite = null;
    native.releaseWrite?.();
    await pending;
  });
  await flush();
  expect(await loadShelf()).toHaveLength(1);
  expect(native.replacements).toEqual([]);
  expect(intake.sessionId).toBe(originalSession);
});

it('keeps the visible exact date synchronized when a shortcut replaces a typed date', async () => {
  await mount();
  await act(async () => {
    action('Pick a date').props.onPress();
  });
  await act(async () => {
    input('Exact opened date')!.props.onChangeText('2026-09-14');
  });
  const shortcut = screen!.root
    .findAllByType('Pressable' as never)
    .find((node) =>
      node.findAllByType('Text' as never).some((text) => text.props.children === '2 weeks ago'),
    )!;
  await act(async () => {
    shortcut.props.onPress();
  });
  const expected = new Date();
  expected.setDate(expected.getDate() - 14);
  const actualDate = `${expected.getFullYear()}-${String(expected.getMonth() + 1).padStart(2, '0')}-${String(expected.getDate()).padStart(2, '0')}`;
  expect(input('Exact opened date')!.props.value).toBe(actualDate);
});

it('does not let a captured backdrop dismiss a successor intake', async () => {
  await mount();
  const backdrop = screen!.root
    .findAllByType('Pressable' as never)
    .find(
      (node) =>
        node.props['aria-hidden'] === true &&
        node.props.accessible === false &&
        typeof node.props.onPress === 'function',
    )!;
  const staleDismiss = backdrop.props.onPress;
  const { router } = await import('expo-router');
  vi.mocked(router.back).mockClear();
  let successor!: string;
  await act(async () => {
    successor = intake.reset({
      name: 'Successor synthetic product',
      category: 'moisturiser',
      addedVia: 'manual',
    });
    staleDismiss();
  });
  expect(intake.sessionId).toBe(successor);
  expect(router.back).not.toHaveBeenCalled();
  expect(native.replacements).toEqual([]);
});
