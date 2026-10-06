import * as React from 'react';
import {
  BaseNavigationContainer,
  createNavigationContainerRef,
  createNavigatorFactory,
  useNavigationBuilder,
  useNavigation as useCoreNavigation,
  usePreventRemove as useCorePreventRemove,
} from 'expo-router/build/react-navigation/core';
import { StackRouter } from 'expo-router/build/react-navigation/routers';
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { runAccountGenerationOperation } from '@/lib/auth/accountGeneration';
import {
  clearActiveHealthProcessingEpoch,
  setActiveHealthProcessingEpoch,
} from '@/lib/consent/healthProcessingEpoch';
import { APP_PROGRESS_ROUTE } from '@/lib/navigation/safeBack';

import PhotoDetailScreen from '@/app/progress/[id]';
import { PHOTO_COPY } from './copy';
import { usePhotoActions, type PhotoRecord } from './usePhotos';

const mocks = vi.hoisted(() => ({
  realNavigation: false,
  forcedLock: false,
  lockListeners: new Set<() => void>(),
  routeId: 'photo-a',
  owner: 'owner-a',
  rows: [] as PhotoRecord[],
  loadPhotos: vi.fn(),
  updatePhoto: vi.fn(),
  setReference: vi.fn(),
  removePhoto: vi.fn(),
  addPhotoWithOutcome: vi.fn(),
  getPhotoDeleteStatus: vi.fn(),
  retryPhotoDeletes: vi.fn(),
  purge: vi.fn(),
  select: vi.fn(),
  track: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  push: vi.fn(),
}));

vi.mock('react-native', () => ({
  View: 'View',
  TextInput: 'TextInput',
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  useWindowDimensions: () => ({ width: 390, height: 844 }),
}));
vi.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: mocks.routeId }),
  useNavigation: () => useCoreNavigation(),
  router: { replace: mocks.replace, back: mocks.back, push: mocks.push, canGoBack: () => false },
}));
vi.mock('expo-router/react-navigation', () => ({
  usePreventRemove: (prevent: boolean, callback: Parameters<typeof useCorePreventRemove>[1]) => {
    // Every rendered detail test executes the actual React Navigation removal protocol.
    useCorePreventRemove(prevent, callback);
  },
}));
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
vi.mock('@/components/ui', () => ({ Text: 'Text', RouteIconButton: 'RouteIconButton' }));
vi.mock('@/features/subscription/ProGate', () => ({
  ProGate: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('./PhotoTimelineLockGate', () => ({
  PhotoTimelineLockGate: ({ children }: { children: React.ReactNode }) => {
    const locked = React.useSyncExternalStore(
      (listener) => {
        mocks.lockListeners.add(listener);
        return () => {
          mocks.lockListeners.delete(listener);
        };
      },
      () => mocks.forcedLock,
    );
    return locked ? null : children;
  },
}));
vi.mock('./PhotoImage', () => ({ PhotoImage: 'PhotoImage' }));
vi.mock('@/lib/auth/AuthProvider', () => ({
  useAuth: () => ({ user: mocks.owner ? { id: mocks.owner } : null }),
}));
vi.mock('@/lib/accessibility/useReduceMotionPreference', () => ({
  useReduceMotionPreference: () => true,
  motionAllowed: () => false,
}));
vi.mock('@/theme/haptics', () => ({ haptics: { select: mocks.select } }));
vi.mock('@/theme/tokens', () => ({
  colors: {
    cream: '#fff',
    paper: '#fff',
    paperRaised: '#fff',
    muted: '#777',
    ink: '#111',
    clayDeep: '#333',
    hairlineStrong: '#aaa',
  },
}));
vi.mock('@/lib/analytics/track', () => ({ track: mocks.track }));
vi.mock('./sensitiveImageMemory', () => ({ purgeSensitiveImageMemory: mocks.purge }));
vi.mock('./sharePhoto', () => ({ sharePhotoImageOnly: vi.fn() }));
vi.mock('./photoDeleteJournal', () => ({ subscribePhotoDeleteChanges: () => () => undefined }));
vi.mock('./store', () => ({
  loadPhotos: mocks.loadPhotos,
  updatePhoto: mocks.updatePhoto,
  setReference: mocks.setReference,
  removePhoto: mocks.removePhoto,
  addPhotoWithOutcome: mocks.addPhotoWithOutcome,
  getPhotoDeleteStatus: mocks.getPhotoDeleteStatus,
  retryPhotoDeletes: mocks.retryPhotoDeletes,
}));

function photo(id: string, notes = 'persisted note', isReference = false): PhotoRecord {
  return {
    id,
    notes,
    isReference,
    series: 'front',
    takenLocalDate: '2026-10-05',
    takenAt: '2026-10-05T12:00:00Z',
    timeOfDay: 'morning',
    alignmentScore: null,
    lightingScore: null,
    referencePhotoId: null,
    localUri: `file:///${id}.layerwellphoto`,
    captureSessionId: null,
    headRoll: null,
    headYaw: null,
    headPitch: null,
    qualitySource: null,
    localOnly: true,
    storagePath: null,
    faceRegionRedacted: false,
    isEncrypted: true,
    encryptedLocalUri: `file:///${id}.layerwellphoto`,
    thumbnailLocalUri: null,
    encryptionVersion: 'xchacha20poly1305:v1',
    keyId: 'key',
  };
}
function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}
let renderer: ReactTestRenderer | null;
let client: QueryClient;
let latestActions: ReturnType<typeof usePhotoActions> | null;
function ActionProbe() {
  const actions = usePhotoActions({ authenticatedOwnerUserId: mocks.owner || null });
  React.useEffect(() => {
    latestActions = actions;
  }, [actions]);
  return null;
}
function content() {
  return React.createElement(
    QueryClientProvider,
    { client },
    React.createElement(ActionProbe),
    React.createElement(PhotoDetailScreen),
  );
}
const navigationRef = createNavigationContainerRef();
function PlainStack(props: Parameters<typeof useNavigationBuilder>[1]) {
  const { state, descriptors, NavigationContent } = useNavigationBuilder(StackRouter, props);
  return React.createElement(
    NavigationContent,
    null,
    state.routes.map((route) =>
      React.createElement(React.Fragment, { key: route.key }, descriptors[route.key]!.render()),
    ),
  );
}
const Navigation = createNavigatorFactory(PlainStack)();
function DetailRoute() {
  return content();
}
function Destination() {
  return React.createElement('Destination', null, 'Destination');
}
// Positional React.createElement children satisfy the real container at runtime.
// Its upstream declaration requires children in props, so adapt only that type.
const NavigationHost = BaseNavigationContainer as React.ComponentType<
  React.PropsWithChildren<Omit<React.ComponentProps<typeof BaseNavigationContainer>, 'children'>>
>;
function element() {
  return React.createElement(
    NavigationHost,
    {
      ref: navigationRef,
      initialState: { index: 1, routes: [{ name: 'Destination' }, { name: 'Detail' }] },
    },
    React.createElement(
      Navigation.Navigator,
      null,
      React.createElement(Navigation.Screen, { name: 'Destination', component: Destination }),
      React.createElement(Navigation.Screen, { name: 'Detail', component: DetailRoute }),
    ),
  );
}
async function flush(operation: () => void = () => undefined) {
  await act(async () => {
    operation();
  });
  for (let i = 0; i < 8; i += 1)
    await act(async () => {
      await new Promise<void>((done) => setTimeout(done, 0));
    });
}
async function mount() {
  await flush(() => {
    renderer = create(element());
  });
}
function nodes(type: string) {
  return renderer!.root.findAll((node) => (node.type as unknown) === type);
}
function text(node: ReactTestInstance | string | number): string {
  return typeof node === 'object'
    ? node.children.map((child) => text(child as ReactTestInstance | string | number)).join(' ')
    : String(node);
}
function visible() {
  return renderer ? text(renderer.root) : '';
}
function input() {
  const inputs = nodes('TextInput');
  expect(inputs).toHaveLength(1);
  return inputs[0]!;
}
function button(label: string) {
  const found = nodes('Pressable').filter((node) => text(node) === label);
  expect(found, `button ${label}; visible: ${visible()}`).toHaveLength(1);
  return found[0]!;
}
async function change(value: string) {
  await flush(() => input().props.onChangeText(value));
}
async function press(label: string) {
  await flush(() => button(label).props.onPress());
}
async function openDelete() {
  const open = nodes('Pressable').find((node) => node.props.accessibilityLabel === 'Delete photo');
  expect(open).toBeDefined();
  await flush(() => open!.props.onPress());
  return button(PHOTO_COPY.detail.deleteConfirm).props.onPress as () => void;
}
async function grant(owner = mocks.owner, epoch = 1) {
  const accountGeneration = await runAccountGenerationOperation((lease) => lease.generation);
  await act(async () => {
    setActiveHealthProcessingEpoch(epoch, { ownerUserId: owner, accountGeneration });
  });
}

beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal('requestAnimationFrame', (callback: () => void) => {
    callback();
    return 0;
  });
  mocks.realNavigation = false;
  mocks.forcedLock = false;
  mocks.lockListeners.clear();
  mocks.routeId = 'photo-a';
  mocks.owner = 'owner-a';
  mocks.rows = [photo('photo-a')];
  for (const mock of [
    mocks.loadPhotos,
    mocks.updatePhoto,
    mocks.setReference,
    mocks.removePhoto,
    mocks.addPhotoWithOutcome,
    mocks.getPhotoDeleteStatus,
    mocks.retryPhotoDeletes,
    mocks.purge,
    mocks.select,
    mocks.track,
    mocks.replace,
    mocks.back,
    mocks.push,
  ])
    mock.mockReset();
  mocks.loadPhotos.mockImplementation(async () => [...mocks.rows]);
  mocks.updatePhoto.mockImplementation(async (id: string, patch: { notes: string }) => {
    mocks.rows = mocks.rows.map((row) => (row.id === id ? { ...row, ...patch } : row));
  });
  mocks.setReference.mockImplementation(async (id: string) => {
    mocks.rows = mocks.rows.map((row) => ({ ...row, isReference: row.id === id }));
  });
  mocks.removePhoto.mockImplementation(async (id: string) => {
    mocks.rows = mocks.rows.filter((row) => row.id !== id);
    return { localDeleted: true, cleanupPending: false, remotePending: false };
  });
  mocks.getPhotoDeleteStatus.mockResolvedValue({
    localPending: 0,
    remotePending: 0,
    needsAttention: false,
  });
  mocks.retryPhotoDeletes.mockResolvedValue(undefined);
  mocks.purge.mockResolvedValue(true);
  renderer = null;
  latestActions = null;
  client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity, gcTime: Infinity, refetchOnMount: false },
      mutations: { retry: false },
    },
  });
  onlineManager.setOnline(true);
  clearActiveHealthProcessingEpoch();
  await grant();
});
afterEach(async () => {
  await flush(() => onlineManager.setOnline(true));
  if (renderer) await flush(() => renderer?.unmount());
  renderer = null;
  client.clear();
  clearActiveHealthProcessingEpoch();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe.sequential(
  'C-08B2 rendered detail with real source gate, mutation hooks and note coordinator',
  () => {
    it.each(['note', 'reference', 'delete'] as const)(
      'executes a current local %s mutation offline rather than pausing until reconnect',
      async (kind) => {
        const consoleError = vi.spyOn(console, 'error');
        await mount();
        if (kind === 'note') await change('saved without a connection');
        const confirmDelete = kind === 'delete' ? await openDelete() : null;
        await flush(() => onlineManager.setOnline(false));
        if (kind === 'note') await press(PHOTO_COPY.detail.noteSave);
        else if (kind === 'reference') await press(PHOTO_COPY.detail.setReference);
        else await flush(() => confirmDelete!());
        const operation =
          kind === 'note'
            ? mocks.updatePhoto
            : kind === 'reference'
              ? mocks.setReference
              : mocks.removePhoto;
        expect(operation).toHaveBeenCalledTimes(1);
        expect(
          client
            .getMutationCache()
            .getAll()
            .some((mutation) => mutation.state.isPaused),
        ).toBe(false);
        if (kind === 'note') expect(mocks.rows[0]?.notes).toBe('saved without a connection');
        if (kind === 'reference') {
          expect(mocks.rows[0]?.isReference).toBe(true);
          expect(mocks.track).toHaveBeenCalledWith('reference_reset');
        }
        if (kind === 'delete') {
          expect(mocks.rows).toEqual([]);
          expect(mocks.purge).toHaveBeenCalledTimes(1);
          expect(mocks.replace).toHaveBeenCalledWith(APP_PROGRESS_ROUTE);
        }
        await flush(() => onlineManager.setOnline(true));
        expect(
          consoleError.mock.calls.filter((args) =>
            String(args[0]).includes('Cannot update a component'),
          ),
        ).toEqual([]);
        consoleError.mockRestore();
      },
    );

    it('shows Saving until a durable note write succeeds, then restores that note after remount', async () => {
      const pending = deferred();
      mocks.updatePhoto.mockImplementationOnce(async (id: string, patch: { notes: string }) => {
        await pending.promise;
        mocks.rows = mocks.rows.map((row) => (row.id === id ? { ...row, ...patch } : row));
      });
      await mount();
      await change('a new private note');
      await press(PHOTO_COPY.detail.noteSave);
      expect(visible()).toContain(PHOTO_COPY.detail.noteSaving);
      expect(visible()).not.toContain(PHOTO_COPY.detail.noteSaved);
      pending.resolve();
      await flush();
      expect(visible()).toContain(PHOTO_COPY.detail.noteSaved);
      expect(mocks.updatePhoto).toHaveBeenCalledWith('photo-a', { notes: 'a new private note' });
      await flush(() => renderer!.unmount());
      await mount();
      expect(input().props.value).toBe('a new private note');
    });

    it('coalesces repeated blur/save requests to the latest later edit while one note is pending', async () => {
      const first = deferred();
      mocks.updatePhoto.mockImplementationOnce(async (id: string, patch: { notes: string }) => {
        await first.promise;
        mocks.rows = mocks.rows.map((row) => (row.id === id ? { ...row, ...patch } : row));
      });
      await mount();
      await change('first');
      await flush(() => input().props.onBlur());
      await change('second');
      await press(PHOTO_COPY.detail.noteSave);
      await change('latest');
      await flush(() => {
        input().props.onBlur();
        input().props.onEndEditing();
      });
      expect(mocks.updatePhoto).toHaveBeenCalledTimes(1);
      first.resolve();
      await flush();
      expect(mocks.updatePhoto.mock.calls.map((call) => call[1].notes)).toEqual([
        'first',
        'latest',
      ]);
      expect(input().props.value).toBe('latest');
      expect(visible()).toContain(PHOTO_COPY.detail.noteSaved);
    });

    it('retains the newest draft on failure, ignores implicit blur retry, and explicitly retries the latest text', async () => {
      const pending = deferred();
      mocks.updatePhoto.mockReturnValueOnce(pending.promise);
      await mount();
      await change('first');
      await press(PHOTO_COPY.detail.noteSave);
      await change('queued');
      await press(PHOTO_COPY.detail.noteSave);
      await change('latest unsaved');
      pending.reject(new Error('DISK_FULL'));
      await flush();
      expect(input().props.value).toBe('latest unsaved');
      expect(visible()).toContain(PHOTO_COPY.detail.noteSaveUnavailable);
      expect(visible()).not.toContain(PHOTO_COPY.detail.noteSaved);
      await flush(() => {
        input().props.onBlur();
        input().props.onEndEditing();
      });
      expect(mocks.updatePhoto).toHaveBeenCalledTimes(1);
      await change('latest retry intent');
      await press(PHOTO_COPY.detail.noteSaveRetry);
      expect(mocks.updatePhoto.mock.calls.map((call) => call[1].notes)).toEqual([
        'first',
        'latest retry intent',
      ]);
      expect(input().props.value).toBe('latest retry intent');
      expect(visible()).toContain(PHOTO_COPY.detail.noteSaved);
    });

    it('keeps the unsaved draft across a failed refetch and the existing storage Retry gate', async () => {
      mocks.updatePhoto.mockRejectedValueOnce(new Error('WRITE_FAILED'));
      await mount();
      await change('must survive the gate');
      mocks.loadPhotos.mockRejectedValueOnce(new Error('READ_FAILED'));
      await press(PHOTO_COPY.detail.noteSave);
      expect(visible()).toContain(PHOTO_COPY.storage.title);
      expect(nodes('TextInput')).toHaveLength(0);
      await press(PHOTO_COPY.storage.retry);
      expect(input().props.value).toBe('must survive the gate');
      expect(visible()).toContain(PHOTO_COPY.detail.noteSaveRetry);
    });

    it('does not save a stale rendered note callback after close/regrant or owner replacement', async () => {
      await mount();
      await change('owner A draft');
      const staleBlur = input().props.onBlur as () => void;
      const staleSave = button(PHOTO_COPY.detail.noteSave).props.onPress as () => void;
      await flush(() => clearActiveHealthProcessingEpoch());
      await grant();
      await flush();
      await flush(() => {
        staleBlur();
        staleSave();
      });
      expect(mocks.updatePhoto).not.toHaveBeenCalled();
      const secondBlur = input().props.onBlur as () => void;
      mocks.owner = 'owner-b';
      mocks.rows = [photo('photo-a', 'owner B note')];
      await grant('owner-b', 2);
      await flush();
      await flush(() => secondBlur());
      expect(mocks.updatePhoto).not.toHaveBeenCalled();
      expect(input().props.value).toBe('owner B note');
    });

    it('carries accepted authority in mutation variables instead of inheriting changed React Query observer options', async () => {
      await mount();
      const old = latestActions!;
      mocks.owner = 'owner-b';
      mocks.rows = [photo('photo-a', 'B')];
      await grant('owner-b', 2);
      await flush();
      await act(async () => {
        await expect(old.note.mutateAsync({ id: 'photo-a', notes: 'from A' })).rejects.toThrow();
        await expect(old.reference.mutateAsync('photo-a')).rejects.toThrow();
        await expect(old.remove.mutateAsync('photo-a')).rejects.toThrow();
      });
      expect(mocks.updatePhoto).not.toHaveBeenCalled();
      expect(mocks.setReference).not.toHaveBeenCalled();
      expect(mocks.removePhoto).not.toHaveBeenCalled();
      expect(input().props.value).toBe('B');
    });

    it('emits reference haptic/analytics only after successful current persistence', async () => {
      const pending = deferred();
      mocks.setReference.mockReturnValueOnce(pending.promise);
      await mount();
      const set = button(PHOTO_COPY.detail.setReference).props.onPress as () => void;
      await flush(() => {
        set();
        set();
      });
      expect(mocks.setReference).toHaveBeenCalledTimes(1);
      expect(mocks.select).not.toHaveBeenCalled();
      expect(mocks.track).not.toHaveBeenCalled();
      pending.resolve();
      await flush();
      expect(mocks.select).toHaveBeenCalledTimes(1);
      expect(mocks.track).toHaveBeenCalledWith('reference_reset');
    });

    it('shows a recoverable reference failure without any success effects', async () => {
      mocks.setReference.mockRejectedValueOnce(new Error('WRITE_FAILED'));
      await mount();
      await press(PHOTO_COPY.detail.setReference);
      expect(visible()).toContain(PHOTO_COPY.detail.referenceUnavailable);
      expect(mocks.select).not.toHaveBeenCalled();
      expect(mocks.track).not.toHaveBeenCalled();
      await press(PHOTO_COPY.detail.setReference);
      expect(mocks.setReference).toHaveBeenCalledTimes(2);
      expect(mocks.track).toHaveBeenCalledTimes(1);
    });

    it('rejects a captured reference action after owner loss and suppresses a late success under the new owner', async () => {
      const pending = deferred();
      mocks.setReference.mockReturnValueOnce(pending.promise);
      await mount();
      const stale = button(PHOTO_COPY.detail.setReference).props.onPress as () => void;
      await flush(() => stale());
      mocks.owner = 'owner-b';
      mocks.rows = [photo('photo-a', 'B')];
      await grant('owner-b', 2);
      await flush();
      await flush(() => stale());
      expect(mocks.setReference).toHaveBeenCalledTimes(1);
      pending.resolve();
      await flush();
      expect(mocks.select).not.toHaveBeenCalled();
      expect(mocks.track).not.toHaveBeenCalled();
    });

    it('runs one local deletion and waits for successful sensitive-memory purge before leaving detail', async () => {
      const pending = deferred();
      const purge = deferred<boolean>();
      mocks.removePhoto.mockImplementationOnce(async (id: string) => {
        await pending.promise;
        mocks.rows = mocks.rows.filter((row) => row.id !== id);
        return { localDeleted: true, cleanupPending: false, remotePending: false };
      });
      mocks.purge.mockReturnValueOnce(purge.promise);
      await mount();
      const confirm = await openDelete();
      await flush(() => {
        confirm();
        confirm();
      });
      expect(mocks.removePhoto).toHaveBeenCalledTimes(1);
      expect(mocks.removePhoto).toHaveBeenCalledWith('photo-a', 'owner-a');
      pending.resolve();
      await flush();
      expect(mocks.purge).toHaveBeenCalledTimes(1);
      expect(mocks.replace).not.toHaveBeenCalled();
      expect(nodes('PhotoImage')).toHaveLength(0);
      purge.resolve(true);
      await flush();
      expect(mocks.replace).toHaveBeenCalledWith(APP_PROGRESS_ROUTE);
    });

    it('keeps a visible usable delete retry after metadata persistence failure', async () => {
      mocks.removePhoto.mockRejectedValueOnce(new Error('METADATA_FAILED'));
      await mount();
      const confirm = await openDelete();
      await flush(() => confirm());
      expect(visible()).toContain(PHOTO_COPY.detail.deleteUnavailable);
      expect(nodes('PhotoImage')).toHaveLength(1);
      expect(mocks.replace).not.toHaveBeenCalled();
      expect(mocks.purge).toHaveBeenCalledTimes(1);
      const retry = await openDelete();
      await flush(() => retry());
      expect(mocks.removePhoto).toHaveBeenCalledTimes(2);
      expect(mocks.replace).toHaveBeenCalledWith(APP_PROGRESS_ROUTE);
    });

    it.each(['encrypted files', 'decoded memory'])(
      'retains a visible recovery path when %s cleanup needs retry',
      async (failure) => {
        mocks.removePhoto.mockImplementationOnce(async (id: string) => {
          mocks.rows = mocks.rows.filter((row) => row.id !== id);
          return {
            localDeleted: true,
            cleanupPending: failure === 'encrypted files',
            remotePending: false,
          };
        });
        if (failure === 'decoded memory') mocks.purge.mockResolvedValueOnce(false);
        await mount();
        const confirm = await openDelete();
        await flush(() => confirm());
        expect(nodes('PhotoImage')).toHaveLength(0);
        if (failure === 'encrypted files') {
          expect(mocks.purge).toHaveBeenCalledTimes(1);
          expect(mocks.removePhoto).toHaveBeenCalledTimes(1);
          expect(mocks.replace).toHaveBeenCalledWith(APP_PROGRESS_ROUTE);
          return;
        }
        expect(mocks.replace).not.toHaveBeenCalled();
        expect(visible()).toContain(PHOTO_COPY.detail.deleteCleanupPending);
        const retry = button(PHOTO_COPY.deleteSync.retry).props.onPress as () => void;
        await flush(() => {
          retry();
          retry();
        });
        expect(mocks.removePhoto).toHaveBeenCalledTimes(1);
        expect(mocks.purge).toHaveBeenCalledTimes(2);
        expect(mocks.replace).toHaveBeenCalledWith(APP_PROGRESS_ROUTE);
      },
    );

    it('purges at forced health teardown without late navigation or later-owner continuation', async () => {
      const pending = deferred<{
        localDeleted: true;
        cleanupPending: false;
        remotePending: false;
      }>();
      mocks.removePhoto.mockReturnValueOnce(pending.promise);
      await mount();
      const confirm = await openDelete();
      await flush(() => confirm());
      await flush(() => clearActiveHealthProcessingEpoch());
      mocks.owner = 'owner-b';
      mocks.rows = [photo('photo-a', 'B')];
      await grant('owner-b', 2);
      await flush();
      await flush(() => confirm());
      pending.resolve({ localDeleted: true, cleanupPending: false, remotePending: false });
      await flush();
      expect(mocks.removePhoto).toHaveBeenCalledTimes(1);
      expect(mocks.purge).toHaveBeenCalledTimes(1);
      expect(mocks.replace).not.toHaveBeenCalled();
      expect(input().props.value).toBe('B');
    });

    it('cancels retained and in-flight photo snapshots so a deleted image cannot republish later', async () => {
      const deletion = deferred();
      const staleRead = deferred<PhotoRecord[]>();
      mocks.removePhoto.mockImplementationOnce(async () => {
        await deletion.promise;
        mocks.rows = [];
        return { localDeleted: true, cleanupPending: false, remotePending: false };
      });
      await mount();
      const retainedRows = [...mocks.rows];
      const confirm = await openDelete();
      await flush(() => confirm());
      mocks.loadPhotos.mockReturnValueOnce(staleRead.promise);
      await flush(() => {
        void client.refetchQueries({ queryKey: ['photos'] });
      });
      deletion.resolve();
      await flush();
      expect(nodes('PhotoImage')).toHaveLength(0);
      staleRead.resolve(retainedRows);
      await flush();
      expect(nodes('PhotoImage')).toHaveLength(0);
      const cachedIds = client
        .getQueryCache()
        .findAll({ queryKey: ['photos'] })
        .flatMap((query) => {
          const data = query.state.data as { all?: PhotoRecord[] } | undefined;
          return data?.all?.map((row) => row.id) ?? [];
        });
      expect(cachedIds).not.toContain('photo-a');
    });
  },
);

describe.sequential('C-08B2-R3 real React Navigation removal guard', () => {
  async function mountStack() {
    mocks.realNavigation = true;
    mocks.replace.mockImplementation(() => navigationRef.goBack());
    mocks.back.mockImplementation(() => navigationRef.goBack());
    await mount();
    expect(navigationRef.getRootState().routes).toHaveLength(2);
  }
  function capturedBack() {
    return nodes('RouteIconButton').find((node) => node.props.accessibilityLabel === 'Back')!.props
      .onPress as () => void;
  }
  it('blocks captured Back and native/replacement removal through store and memory awaits, then releases exactly once', async () => {
    const store = deferred();
    const memory = deferred<boolean>();
    mocks.removePhoto.mockImplementationOnce(async () => {
      await store.promise;
      mocks.rows = [];
      return { localDeleted: true, cleanupPending: true, remotePending: true };
    });
    mocks.purge.mockReturnValueOnce(memory.promise);
    await mountStack();
    const back = capturedBack();
    const confirm = await openDelete();
    await flush(() => {
      confirm();
      back();
    });
    expect(mocks.removePhoto).toHaveBeenCalledTimes(1);
    expect(navigationRef.getRootState().routes).toHaveLength(2);
    await flush(() => navigationRef.goBack());
    expect(navigationRef.getRootState().routes).toHaveLength(2);
    await flush(() =>
      navigationRef.dispatch({ type: 'REPLACE', payload: { name: 'Destination' } }),
    );
    expect(navigationRef.getRootState().routes.at(-1)?.name).toBe('Detail');
    store.resolve();
    await flush();
    expect(mocks.purge).toHaveBeenCalledTimes(1);
    await flush(() => {
      back();
      navigationRef.goBack();
    });
    expect(navigationRef.getRootState().routes).toHaveLength(2);
    memory.resolve(true);
    await flush();
    expect(navigationRef.getRootState().routes).toHaveLength(1);
    await flush(() => back());
    expect(mocks.replace.mock.calls.length + mocks.back.mock.calls.length).toBe(1);
    expect(mocks.removePhoto).toHaveBeenCalledTimes(1);
  });

  it('keeps ordinary route removal blocked after false purge and retries memory without deleting twice', async () => {
    mocks.purge.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    await mountStack();
    const back = capturedBack();
    const confirm = await openDelete();
    await flush(() => confirm());
    expect(visible()).toContain(PHOTO_COPY.detail.deleteCleanupPending);
    await flush(() => {
      back();
      navigationRef.goBack();
    });
    expect(navigationRef.getRootState().routes).toHaveLength(2);
    await press(PHOTO_COPY.deleteSync.retry);
    expect(navigationRef.getRootState().routes).toHaveLength(1);
    expect(mocks.removePhoto).toHaveBeenCalledTimes(1);
    expect(mocks.purge).toHaveBeenCalledTimes(2);
  });

  it('forced lock removal purges immediately and the old completion cannot navigate or borrow a new authority', async () => {
    const store = deferred<{ localDeleted: true; cleanupPending: false; remotePending: false }>();
    mocks.removePhoto.mockReturnValueOnce(store.promise);
    await mountStack();
    const back = capturedBack();
    const confirm = await openDelete();
    await flush(() => confirm());
    await flush(() => {
      mocks.forcedLock = true;
      for (const listener of mocks.lockListeners) listener();
    });
    expect(nodes('PhotoImage')).toHaveLength(0);
    expect(mocks.purge).toHaveBeenCalledTimes(1);
    await grant('owner-b', 2);
    store.resolve({ localDeleted: true, cleanupPending: false, remotePending: false });
    await flush();
    await flush(() => back());
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(mocks.back).not.toHaveBeenCalled();
    expect(mocks.purge).toHaveBeenCalledTimes(1);
  });
  it('keeps a memory-only retry reachable even when mutation readback and the source gate fail', async () => {
    mocks.removePhoto.mockRejectedValueOnce(new Error('COMMIT_RESULT_UNCERTAIN'));
    mocks.purge.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    await mountStack();
    const back = capturedBack();
    const confirm = await openDelete();
    mocks.loadPhotos.mockRejectedValue(new Error('STORAGE_UNAVAILABLE'));
    await flush(() => confirm());
    expect(visible()).toContain(PHOTO_COPY.detail.deleteCleanupPending);
    const retry = button(PHOTO_COPY.deleteSync.retry);
    await flush(() => {
      back();
      navigationRef.goBack();
    });
    expect(navigationRef.getRootState().routes).toHaveLength(2);
    await flush(() => retry.props.onPress());
    expect(mocks.removePhoto).toHaveBeenCalledTimes(1);
    expect(mocks.purge).toHaveBeenCalledTimes(2);
    expect(navigationRef.getRootState().routes).toHaveLength(1);
  });
});
