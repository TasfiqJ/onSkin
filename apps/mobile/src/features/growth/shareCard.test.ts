import type { RefObject } from 'react';
import type { View } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
  runAccountGenerationOperation,
  waitForAccountGenerationOperationsToSettle,
} from '@/lib/auth/accountGeneration';
import {
  createOwnerQueryScope,
  isOwnerQueryScopeCurrent,
  type OwnerQueryScope,
} from '@/lib/query/queryKeys';
import type { PlaintextStagingHandle } from '@/lib/storage/plaintextStaging';

import {
  createConflictShareActionCoordinator,
  createConflictShareCardExporter,
  type ConflictSharePublication,
} from './shareCard';

vi.mock('react-native-view-shot', () => ({ captureRef: vi.fn() }));
vi.mock('expo-file-system/legacy', () => ({
  EncodingType: { Base64: 'base64' },
  writeAsStringAsync: vi.fn(),
}));
vi.mock('expo-sharing', () => ({
  isAvailableAsync: vi.fn(),
  shareAsync: vi.fn(),
}));
vi.mock('@/lib/storage/plaintextStaging', () => ({
  cleanupPlaintextStaging: vi.fn(),
  markPlaintextStagingState: vi.fn(),
  reservePlaintextStaging: vi.fn(),
}));

const STAGING: PlaintextStagingHandle = {
  operationId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  purpose: 'conflict_share_png',
  uri: 'file://cache/private-plaintext-staging-v1/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.png',
};
const LINK = {
  shareId: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  url: 'https://share.example/s/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
};

function mountedRef(): RefObject<View | null> {
  return { current: {} as View };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function createExporterHarness(overrides: {
  capture?: () => Promise<string>;
  isAvailable?: () => Promise<boolean>;
  share?: () => Promise<void>;
} = {}) {
  const order: string[] = [];
  const capture = vi.fn(async () => {
    order.push('capture');
    return overrides.capture ? overrides.capture() : 'png-base64';
  });
  const reserve = vi.fn(async () => {
    order.push('reserve');
    return STAGING;
  });
  const writeBase64 = vi.fn(async () => {
    order.push('write');
  });
  const markState = vi.fn(async (_handle: PlaintextStagingHandle, state: string) => {
    order.push(`mark:${state}`);
  });
  const isAvailable = vi.fn(async () => {
    order.push('availability');
    return overrides.isAvailable ? overrides.isAvailable() : true;
  });
  const share = vi.fn(async () => {
    order.push('share');
    if (overrides.share) await overrides.share();
  });
  const cleanup = vi.fn(async () => {
    order.push('cleanup');
  });

  return {
    capture,
    cleanup,
    exporter: createConflictShareCardExporter({
      capture,
      cleanup,
      isAvailable,
      markState,
      reserve,
      share,
      writeBase64,
    }),
    isAvailable,
    markState,
    order,
    reserve,
    share,
    writeBase64,
  };
}

const runtime = globalThis as typeof globalThis & { __DEV__?: boolean };
const originalDev = runtime.__DEV__;
let boundaryDepth = 0;

function beginBoundary(): void {
  beginAccountGenerationBoundary();
  boundaryDepth += 1;
}

function endBoundary(): void {
  endAccountGenerationBoundary();
  boundaryDepth = Math.max(0, boundaryDepth - 1);
}

beforeEach(() => {
  if (originalDev === undefined) delete runtime.__DEV__;
  else runtime.__DEV__ = originalDev;
  delete process.env.EXPO_PUBLIC_E2E_SHARE_CARD_EXPORT;
});

afterEach(() => {
  while (boundaryDepth > 0) endBoundary();
  if (originalDev === undefined) delete runtime.__DEV__;
  else runtime.__DEV__ = originalDev;
  delete process.env.EXPO_PUBLIC_E2E_SHARE_CARD_EXPORT;
});

describe('conflict share-card native export', () => {
  it('returns false without capture when the card view is not mounted', async () => {
    const harness = createExporterHarness();

    await expect(
      runAccountGenerationOperation((lease) =>
        harness.exporter(lease, { current: null }, new AbortController().signal),
      ),
    ).resolves.toBe(false);

    expect(harness.capture).not.toHaveBeenCalled();
    expect(harness.reserve).not.toHaveBeenCalled();
  });

  it('captures in memory, writes the exact owned PNG, shares, and cleans in order', async () => {
    const harness = createExporterHarness();

    await expect(
      runAccountGenerationOperation((lease) =>
        harness.exporter(lease, mountedRef(), new AbortController().signal),
      ),
    ).resolves.toBe(true);

    expect(harness.capture).toHaveBeenCalledWith(mountedRef(), {
      width: 1080,
      height: 1920,
      format: 'png',
      quality: 1,
      result: 'base64',
    });
    expect(harness.reserve).toHaveBeenCalledWith('conflict_share_png');
    expect(harness.writeBase64).toHaveBeenCalledWith(STAGING.uri, 'png-base64');
    expect(harness.markState).toHaveBeenNthCalledWith(1, STAGING, 'plaintext_written');
    expect(harness.markState).toHaveBeenNthCalledWith(2, STAGING, 'sharing');
    expect(harness.share).toHaveBeenCalledWith(STAGING.uri, {
      mimeType: 'image/png',
      dialogTitle: 'Share your shelf check',
      UTI: 'public.png',
    });
    expect(harness.cleanup).toHaveBeenCalledWith(STAGING);
    expect(harness.order).toEqual([
      'capture',
      'reserve',
      'write',
      'mark:plaintext_written',
      'availability',
      'mark:sharing',
      'share',
      'cleanup',
    ]);
  });

  it('returns false and cleans the owned PNG when native sharing rejects', async () => {
    const harness = createExporterHarness({
      share: async () => {
        throw new Error('native share rejected');
      },
    });

    await expect(
      runAccountGenerationOperation((lease) =>
        harness.exporter(lease, mountedRef(), new AbortController().signal),
      ),
    ).resolves.toBe(false);

    expect(harness.cleanup).toHaveBeenCalledWith(STAGING);
    expect(harness.order.at(-1)).toBe('cleanup');
  });

  it('cleans without opening the share sheet when availability is false or throws', async () => {
    for (const isAvailable of [
      async () => false,
      async () => {
        throw new Error('availability failed');
      },
    ]) {
      const harness = createExporterHarness({ isAvailable });

      await expect(
        runAccountGenerationOperation((lease) =>
          harness.exporter(lease, mountedRef(), new AbortController().signal),
        ),
      ).resolves.toBe(false);

      expect(harness.share).not.toHaveBeenCalled();
      expect(harness.cleanup).toHaveBeenCalledWith(STAGING);
    }
  });

  it('lets capture failures bubble without creating a staging reservation', async () => {
    const harness = createExporterHarness({
      capture: async () => {
        throw new Error('capture failed');
      },
    });

    await expect(
      runAccountGenerationOperation((lease) =>
        harness.exporter(lease, mountedRef(), new AbortController().signal),
      ),
    ).rejects.toThrow('capture failed');

    expect(harness.reserve).not.toHaveBeenCalled();
    expect(harness.cleanup).not.toHaveBeenCalled();
  });

  it('preserves the dev-only unavailable fixture without native work', async () => {
    runtime.__DEV__ = true;
    process.env.EXPO_PUBLIC_E2E_SHARE_CARD_EXPORT = 'unavailable';
    const harness = createExporterHarness();

    await expect(
      runAccountGenerationOperation((lease) =>
        harness.exporter(lease, mountedRef(), new AbortController().signal),
      ),
    ).resolves.toBe(false);

    expect(harness.capture).not.toHaveBeenCalled();
    expect(harness.reserve).not.toHaveBeenCalled();
  });
});

describe('conflict share-card owner action', () => {
  function startAction(options: {
    exporter: ReturnType<typeof createConflictShareCardExporter>;
    ownerScope?: OwnerQueryScope;
    publications?: ConflictSharePublication[];
  }) {
    const ownerScope = options.ownerScope ?? createOwnerQueryScope();
    const publications = options.publications ?? [];
    const coordinator = createConflictShareActionCoordinator({
      createLink: async () => LINK,
      nextFrame: async () => undefined,
      shareCard: options.exporter,
    });
    const completion = coordinator.start({
      ownerScope,
      ref: mountedRef(),
      isRouteCurrent: () => isOwnerQueryScopeCurrent(ownerScope),
      publish: (publication) => publications.push(publication),
    });
    if (!completion) throw new Error('expected accepted share action');
    return { completion, coordinator, ownerScope, publications };
  }

  it('releases an A-to-B boundary around a hung capture and discards its late memory result', async () => {
    const capture = deferred<string>();
    const harness = createExporterHarness({ capture: () => capture.promise });
    const action = startAction({ exporter: harness.exporter });
    await vi.waitFor(() => expect(harness.capture).toHaveBeenCalledOnce());

    // Only publications made while owner A was current are allowed. From the
    // boundary onward, no analytics/UI callback may observe the late result.
    action.publications.length = 0;
    beginBoundary();

    await expect(action.completion).resolves.toBeUndefined();
    await expect(waitForAccountGenerationOperationsToSettle()).resolves.toBeUndefined();
    expect(harness.reserve).not.toHaveBeenCalled();
    expect(harness.writeBase64).not.toHaveBeenCalled();
    expect(harness.markState).not.toHaveBeenCalled();
    expect(harness.share).not.toHaveBeenCalled();
    expect(harness.cleanup).not.toHaveBeenCalled();
    expect(action.publications).toEqual([]);

    endBoundary();
    capture.resolve('late-owner-a-base64');
    await Promise.resolve();
    await Promise.resolve();

    expect(harness.reserve).not.toHaveBeenCalled();
    expect(harness.writeBase64).not.toHaveBeenCalled();
    expect(harness.share).not.toHaveBeenCalled();
    expect(action.publications).toEqual([]);
  });

  it('keeps an open owner-A native share drain-held, then cleans without late publication', async () => {
    const nativeShare = deferred<void>();
    const harness = createExporterHarness({ share: () => nativeShare.promise });
    const action = startAction({ exporter: harness.exporter });
    await vi.waitFor(() => expect(harness.share).toHaveBeenCalledOnce());
    action.publications.length = 0;

    beginBoundary();
    let drainFinished = false;
    const drain = waitForAccountGenerationOperationsToSettle().then(() => {
      drainFinished = true;
    });
    await Promise.resolve();
    expect(drainFinished).toBe(false);

    nativeShare.resolve();
    await expect(action.completion).resolves.toBeUndefined();
    await drain;

    expect(harness.cleanup).toHaveBeenCalledWith(STAGING);
    expect(drainFinished).toBe(true);
    expect(action.publications).toEqual([]);
    endBoundary();
  });

  it('rejects a synchronous double submit before a second async action can start', async () => {
    const link = deferred<typeof LINK | null>();
    const createLink = vi.fn(() => link.promise);
    const shareCard = vi.fn(async () => true);
    const publications: ConflictSharePublication[] = [];
    const ownerScope = createOwnerQueryScope();
    const coordinator = createConflictShareActionCoordinator({
      createLink,
      nextFrame: async () => undefined,
      shareCard,
    });
    const input = {
      ownerScope,
      ref: mountedRef(),
      isRouteCurrent: () => isOwnerQueryScopeCurrent(ownerScope),
      publish: (publication: ConflictSharePublication) => publications.push(publication),
    };

    const first = coordinator.start(input);
    const second = coordinator.start(input);

    expect(first).not.toBeNull();
    expect(second).toBeNull();
    expect(createLink).toHaveBeenCalledOnce();
    expect(publications.filter(({ type }) => type === 'started')).toHaveLength(1);

    link.resolve(null);
    await expect(first).resolves.toBeUndefined();
    expect(shareCard).not.toHaveBeenCalled();
  });

  it('publishes the existing card-creation failure only for the current exact request', async () => {
    const harness = createExporterHarness({
      capture: async () => {
        throw new Error('capture failed');
      },
    });
    const action = startAction({ exporter: harness.exporter });

    await expect(action.completion).resolves.toBeUndefined();

    expect(action.publications.map(({ type }) => type)).toEqual([
      'busy',
      'started',
      'link_created',
      'failure',
      'busy',
    ]);
    expect(action.publications.at(-1)).toEqual({ type: 'busy', value: false });
  });
});
