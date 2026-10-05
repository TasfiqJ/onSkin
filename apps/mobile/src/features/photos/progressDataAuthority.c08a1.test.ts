import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
  runAccountGenerationOperation,
  waitForAccountGenerationOperationsToSettle,
} from '@/lib/auth/accountGeneration';
import {
  clearActiveHealthProcessingEpoch,
  setActiveHealthProcessingEpoch,
} from '@/lib/consent/healthProcessingEpoch';

import { PhotoStorageGate } from './PhotoStorageGate';
import type { PhotoRecord } from './store';
import { usePhotos } from './usePhotos';

const mocks = vi.hoisted(() => ({
  addPhotoWithOutcome: vi.fn(),
  loadPhotos: vi.fn(),
  removePhoto: vi.fn(),
  setReference: vi.fn(),
  updatePhoto: vi.fn(),
}));

vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  View: 'View',
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

vi.mock('@/components/ui', () => ({
  Text: 'Text',
}));

vi.mock('@/theme/tokens', () => ({
  colors: {
    clayDeep: '#000',
    cream: '#fff',
    hairlineStrong: '#ccc',
    ink: '#111',
    muted: '#777',
    paper: '#fafafa',
    paperRaised: '#f4f4f4',
  },
}));

vi.mock('./store', () => ({
  addPhotoWithOutcome: mocks.addPhotoWithOutcome,
  loadPhotos: mocks.loadPhotos,
  removePhoto: mocks.removePhoto,
  setReference: mocks.setReference,
  updatePhoto: mocks.updatePhoto,
}));

type PhotoSource = ReturnType<typeof usePhotos>;

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function photo(id: string, takenLocalDate = '2026-10-03'): PhotoRecord {
  return {
    id,
    series: 'front',
    takenLocalDate,
    takenAt: `${takenLocalDate}T12:00:00.000Z`,
    timeOfDay: 'morning',
    alignmentScore: null,
    lightingScore: null,
    isReference: true,
    referencePhotoId: null,
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

let latestSource: PhotoSource | null = null;
let renderer: ReactTestRenderer | null = null;
let client: QueryClient;

function SourceProbe() {
  const source = usePhotos('front');
  React.useEffect(() => {
    latestSource = source;
  }, [source]);
  return React.createElement('SourceProbe', {
    currentCount: source.data?.count ?? null,
    sourceReady: source.sourceReady,
  });
}

function DetailStateProbe({ id }: { id: string }) {
  const { data } = usePhotos('front');
  if (!data) return React.createElement('DetailState', null, 'DETAIL_UNAVAILABLE');
  return React.createElement(
    'DetailState',
    null,
    data.all.some((item) => item.id === id) ? 'DETAIL_FOUND' : 'DETAIL_MISSING',
  );
}

function TestSurface({ detailId }: { detailId?: string }) {
  return React.createElement(
    React.Fragment,
    null,
    React.createElement(SourceProbe),
    React.createElement(
      PhotoStorageGate,
      null,
      React.createElement('CurrentContent', null, 'CURRENT_CONTENT'),
    ),
    detailId === undefined ? null : React.createElement(DetailStateProbe, { id: detailId }),
  );
}

function element(detailId?: string) {
  return React.createElement(
    QueryClientProvider,
    { client },
    React.createElement(TestSurface, { detailId }),
  );
}

async function flush(operation: () => void = () => undefined) {
  await act(async () => {
    operation();
  });
  for (let index = 0; index < 6; index += 1) {
    await act(async () => {
      await new Promise<void>((done) => setTimeout(done, 0));
    });
  }
}

async function mount(detailId?: string) {
  await flush(() => {
    renderer = create(element(detailId));
  });
}

function nodes(predicate: (node: ReactTestInstance) => boolean) {
  return renderer?.root.findAll(predicate) ?? [];
}

function text(node: ReactTestInstance | string | number): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  return node.children.map((child) => text(child as ReactTestInstance | string | number)).join(' ');
}

function renderedText() {
  return renderer ? text(renderer.root) : '';
}

function retryButton() {
  const buttons = nodes(
    (node) => (node.type as unknown) === 'Pressable' && text(node).includes('Try again'),
  );
  expect(buttons).toHaveLength(1);
  return buttons[0]!;
}

async function grantHealth(ownerUserId = 'user-a', epoch = 1) {
  const accountGeneration = await runAccountGenerationOperation((lease) => lease.generation);
  setActiveHealthProcessingEpoch(epoch, { ownerUserId, accountGeneration });
}

beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  clearActiveHealthProcessingEpoch();
  latestSource = null;
  renderer = null;
  for (const mock of Object.values(mocks)) mock.mockReset();

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

  await grantHealth();
});

afterEach(async () => {
  if (renderer) {
    await flush(() => {
      renderer?.unmount();
    });
  }
  renderer = null;
  latestSource = null;
  client.clear();
  clearActiveHealthProcessingEpoch();
});

describe.sequential('C-08A1 Progress photo read authority', () => {
  it('shared currentness does not update the storage gate while its second consumer renders after refetch', async () => {
    const consoleError = vi.spyOn(console, 'error');
    try {
      mocks.loadPhotos.mockResolvedValueOnce([photo('owner-a')]);
      await flush(() => {
        renderer = create(
          React.createElement(
            QueryClientProvider,
            { client },
            React.createElement(PhotoStorageGate, null, React.createElement(SourceProbe)),
          ),
        );
      });
      const retained = latestSource!.data;
      expect(retained?.all[0]?.id).toBe('owner-a');

      const refresh = deferred<PhotoRecord[]>();
      mocks.loadPhotos.mockReturnValueOnce(refresh.promise);
      await act(async () => {
        void client.refetchQueries({ queryKey: ['photos'] });
      });
      await flush();
      expect(nodes((node) => node.type === SourceProbe)).toHaveLength(0);
      expect(renderedText()).toContain('Opening your private timeline...');

      // Structural sharing retains the same data while fetch state becomes current.
      refresh.resolve([photo('owner-a')]);
      await flush();
      expect(nodes((node) => node.type === SourceProbe)).toHaveLength(1);
      expect(latestSource!.data).toBe(retained);
      expect(
        consoleError.mock.calls.filter((args) =>
          String(args[0]).includes('Cannot update a component'),
        ),
      ).toEqual([]);
    } finally {
      consoleError.mockRestore();
    }
  });

  it('shared currentness closes both consumers synchronously on invalidation and stays closed on refetch error', async () => {
    const sources = new Map<string, PhotoSource>();
    function Consumer({ name }: { name: string }) {
      const source = usePhotos('front');
      React.useEffect(() => {
        sources.set(name, source);
      }, [name, source]);
      return React.createElement('Consumer', {
        sourceReady: source.sourceReady,
        count: source.data?.count,
      });
    }
    mocks.loadPhotos.mockResolvedValueOnce([photo('owner-a')]);
    await flush(() => {
      renderer = create(
        React.createElement(
          QueryClientProvider,
          { client },
          React.createElement(Consumer, { name: 'gate' }),
          React.createElement(Consumer, { name: 'progress' }),
        ),
      );
    });
    expect([...sources.values()].map((source) => source.sourceReady)).toEqual([true, true]);
    const currentness = [...sources.values()].map((source) => source.isSourceCurrent);
    act(() => {
      void client.invalidateQueries({ queryKey: ['photos'], refetchType: 'none' });
      expect(currentness.map((isCurrent) => isCurrent())).toEqual([false, false]);
    });
    await flush();
    expect([...sources.values()].map((source) => source.data)).toEqual([undefined, undefined]);
    expect([...sources.values()].map((source) => source.sourceReady)).toEqual([false, false]);

    mocks.loadPhotos.mockRejectedValueOnce(new Error('PHOTO_REFRESH_FAILED'));
    await act(async () => {
      await client.refetchQueries({ queryKey: ['photos'] });
    });
    await flush();
    expect([...sources.values()].map((source) => source.isError)).toEqual([true, true]);
    expect([...sources.values()].map((source) => source.data)).toEqual([undefined, undefined]);
    expect(currentness.map((isCurrent) => isCurrent())).toEqual([false, false]);
  });

  it('shared currentness closes on cache removal before retained observers publish again', async () => {
    mocks.loadPhotos.mockResolvedValueOnce([photo('owner-a')]);
    await mount();
    const isCurrent = latestSource!.isSourceCurrent;
    expect(isCurrent()).toBe(true);
    const replacementRead = deferred<PhotoRecord[]>();
    mocks.loadPhotos.mockReturnValueOnce(replacementRead.promise);
    act(() => {
      client.removeQueries({ queryKey: ['photos'] });
      expect(isCurrent()).toBe(false);
    });
    await flush();
    expect(latestSource!.sourceReady).toBe(false);
    expect(latestSource!.data).toBeUndefined();
    expect(renderedText()).not.toContain('CURRENT_CONTENT');
    replacementRead.resolve([]);
    await flush();
  });

  it('fails closed during initial loading and admits a current empty store as first-run data', async () => {
    const pending = deferred<PhotoRecord[]>();
    mocks.loadPhotos.mockReturnValueOnce(pending.promise);

    await mount('missing-id');

    expect(latestSource?.isLoading).toBe(true);
    expect(latestSource?.sourceReady).toBe(false);
    expect(latestSource?.data).toBeUndefined();
    expect(renderedText()).toContain('Opening your private timeline...');
    expect(renderedText()).not.toContain('CURRENT_CONTENT');
    expect(renderedText()).toContain('DETAIL_UNAVAILABLE');
    expect(renderedText()).not.toContain('DETAIL_MISSING');

    pending.resolve([]);
    await flush();

    expect(latestSource?.sourceReady).toBe(true);
    expect(latestSource?.data?.count).toBe(0);
    expect(renderedText()).toContain('CURRENT_CONTENT');
    expect(renderedText()).toContain('DETAIL_MISSING');
    expect(renderedText()).not.toContain('DETAIL_UNAVAILABLE');
  });

  it('shows Retry on an initial read failure instead of publishing empty or missing data', async () => {
    mocks.loadPhotos.mockRejectedValueOnce(new Error('PHOTO_READ_FAILED'));

    await mount('missing-id');

    expect(latestSource?.isError).toBe(true);
    expect(latestSource?.sourceReady).toBe(false);
    expect(latestSource?.data).toBeUndefined();
    expect(renderedText()).toContain('Your timeline could not open.');
    expect(renderedText()).toContain('Try again');
    expect(renderedText()).not.toContain('CURRENT_CONTENT');
    expect(renderedText()).toContain('DETAIL_UNAVAILABLE');
    expect(renderedText()).not.toContain('DETAIL_MISSING');
  });

  it('rejects retained data after a refetch error', async () => {
    mocks.loadPhotos.mockResolvedValueOnce([photo('owner-a')]);
    await mount();

    const retained = latestSource?.data;
    expect(retained?.all[0]?.id).toBe('owner-a');
    expect(latestSource?.data).toBe(retained);

    mocks.loadPhotos.mockRejectedValueOnce(new Error('PHOTO_REFRESH_FAILED'));
    await act(async () => {
      await client.refetchQueries({ queryKey: ['photos'] });
    });
    await flush();

    const retainedQuery = client
      .getQueryCache()
      .findAll({ queryKey: ['photos'] })
      .find((query) => query.state.data === retained);
    expect(retainedQuery?.state.data).toBe(retained);
    expect(latestSource?.isError).toBe(true);
    expect(latestSource?.sourceReady).toBe(false);
    expect(latestSource?.data).toBeUndefined();
    expect(renderedText()).toContain('Your timeline could not open.');
    expect(renderedText()).not.toContain('CURRENT_CONTENT');
  });

  it('withholds retained data for the whole refetch window', async () => {
    mocks.loadPhotos.mockResolvedValueOnce([photo('owner-a')]);
    await mount();

    const retained = latestSource?.data;
    const refresh = deferred<PhotoRecord[]>();
    mocks.loadPhotos.mockReturnValueOnce(refresh.promise);

    await act(async () => {
      void client.refetchQueries({ queryKey: ['photos'] });
      await Promise.resolve();
    });
    await flush();

    const retainedQuery = client
      .getQueryCache()
      .findAll({ queryKey: ['photos'] })
      .find((query) => query.state.data === retained);
    expect(retainedQuery?.state.data).toBe(retained);
    expect(latestSource?.isRefreshing).toBe(true);
    expect(latestSource?.sourceReady).toBe(false);
    expect(latestSource?.data).toBeUndefined();
    expect(renderedText()).toContain('Opening your private timeline...');
    expect(renderedText()).not.toContain('CURRENT_CONTENT');

    refresh.resolve([photo('owner-a-fresh')]);
    await flush();

    expect(latestSource?.sourceReady).toBe(true);
    expect(latestSource?.data?.all[0]?.id).toBe('owner-a-fresh');
    expect(renderedText()).toContain('CURRENT_CONTENT');
  });

  it('keeps owner-A cache non-authoritative across an account switch until owner-B reads current', async () => {
    mocks.loadPhotos.mockResolvedValueOnce([photo('owner-a')]);
    await mount();

    expect(latestSource?.data?.all[0]?.id).toBe('owner-a');
    const ownerBRead = deferred<PhotoRecord[]>();
    mocks.loadPhotos.mockReturnValueOnce(ownerBRead.promise);

    await act(async () => {
      beginAccountGenerationBoundary();
      await waitForAccountGenerationOperationsToSettle();
      endAccountGenerationBoundary();
      const accountGeneration = await runAccountGenerationOperation((lease) => lease.generation);
      setActiveHealthProcessingEpoch(2, { ownerUserId: 'user-b', accountGeneration });
    });
    await flush();

    const cachedIds = client
      .getQueryCache()
      .findAll({ queryKey: ['photos'] })
      .flatMap((query) => {
        const data = query.state.data as { all?: PhotoRecord[] } | undefined;
        return data?.all?.map((item) => item.id) ?? [];
      });
    expect(cachedIds).toContain('owner-a');
    expect(latestSource?.sourceReady).toBe(false);
    expect(latestSource?.data).toBeUndefined();
    expect(renderedText()).not.toContain('CURRENT_CONTENT');

    ownerBRead.resolve([photo('owner-b')]);
    await flush();

    expect(latestSource?.sourceReady).toBe(true);
    expect(latestSource?.data?.all[0]?.id).toBe('owner-b');
    expect(renderedText()).toContain('CURRENT_CONTENT');
  });

  it('live currentness closes immediately when health authority is lost before observer publication', async () => {
    mocks.loadPhotos.mockResolvedValueOnce([photo('owner-a')]);
    await mount();

    const capturedCurrentness = latestSource!.isSourceCurrent;
    expect(capturedCurrentness()).toBe(true);

    let currentInsideTransition = true;
    act(() => {
      clearActiveHealthProcessingEpoch();
      currentInsideTransition = capturedCurrentness();
    });

    expect(currentInsideTransition).toBe(false);
    await flush();

    expect(latestSource?.sourceReady).toBe(false);
    expect(latestSource?.data).toBeUndefined();
    expect(renderedText()).toContain('Your timeline could not open.');
    expect(renderedText()).not.toContain('CURRENT_CONTENT');
  });

  it('successful Retry stays closed while reading and restores only after current authority is proven', async () => {
    mocks.loadPhotos.mockRejectedValueOnce(new Error('PHOTO_READ_FAILED'));
    await mount();

    expect(renderedText()).toContain('Try again');

    const retryRead = deferred<PhotoRecord[]>();
    mocks.loadPhotos.mockReturnValueOnce(retryRead.promise);

    await flush(() => {
      retryButton().props.onPress();
    });

    expect(latestSource?.data).toBeUndefined();
    expect(renderedText()).toContain('Opening your private timeline...');
    expect(renderedText()).not.toContain('CURRENT_CONTENT');

    retryRead.resolve([photo('after-retry')]);
    await flush();

    expect(latestSource?.sourceReady).toBe(true);
    expect(latestSource?.data?.all[0]?.id).toBe('after-retry');
    expect(renderedText()).toContain('CURRENT_CONTENT');
  });

  it('publishes a current populated timeline and distinguishes real missing IDs from unavailable storage', async () => {
    mocks.loadPhotos.mockResolvedValueOnce([
      photo('older', '2026-09-01'),
      { ...photo('newer', '2026-10-03'), isReference: false, referencePhotoId: 'older' },
    ]);

    await mount('missing-id');

    expect(latestSource?.sourceReady).toBe(true);
    expect(latestSource?.data?.count).toBe(2);
    expect(latestSource?.data?.series.map((item) => item.id)).toEqual(['older', 'newer']);
    expect(latestSource?.data?.monthGroups.length).toBeGreaterThan(0);
    expect(latestSource?.data?.comparePair).not.toBeNull();
    expect(renderedText()).toContain('CURRENT_CONTENT');
    expect(renderedText()).toContain('DETAIL_MISSING');
    expect(renderedText()).not.toContain('DETAIL_UNAVAILABLE');
  });
});
