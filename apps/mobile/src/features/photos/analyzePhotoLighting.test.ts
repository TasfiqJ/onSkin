import { describe, expect, it, vi } from 'vitest';

import type { PlaintextStagingHandle } from '@/lib/storage/plaintextStaging';

import {
  createPhotoLightingAnalyzer,
  trustedImageManipulatorJpegUri,
} from './analyzePhotoLighting';
import { isPhotoAnalysisCleanupError } from './photoAnalysisCleanup';

vi.mock('expo-file-system', () => ({ File: class {} }));
vi.mock('expo-file-system/legacy', () => ({
  cacheDirectory: null,
  deleteAsync: vi.fn(),
  moveAsync: vi.fn(),
}));
vi.mock('expo-image-manipulator', () => ({
  manipulateAsync: vi.fn(),
  SaveFormat: { JPEG: 'jpeg' },
}));
vi.mock('jpeg-js', () => ({ decode: vi.fn() }));
vi.mock('@/lib/storage/plaintextStaging', () => ({
  cleanupPlaintextStaging: vi.fn(),
  isImageManipulatorPlaintextCleanupError: (error: unknown) =>
    error instanceof Error && error.name === 'ImageManipulatorPlaintextCleanupError',
  isCanonicalImageManipulatorJpegName: (value: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.jpg$/iu.test(value),
  markPlaintextStagingState: vi.fn(),
  reservePlaintextStaging: vi.fn(),
  retryPlaintextStagingRecovery: vi.fn(),
  runPlaintextImageManipulatorOperation: <T>(operation: () => Promise<T>) => operation(),
}));

const CACHE = 'file:///private/app/Library/Caches/';
const GENERATED = `${CACHE}ImageManipulator/00000000-0000-4000-8000-000000000001.jpg`;
const HANDLE: PlaintextStagingHandle = {
  operationId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  purpose: 'photo_analysis_jpeg',
  uri: `${CACHE}private-plaintext-staging-v1/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.jpg`,
};

function harness() {
  const events: string[] = [];
  const cleanup = vi.fn(async () => {
    events.push('cleanup');
  });
  const deps = {
    cacheDirectory: CACHE,
    cleanup,
    decodeJpeg: vi.fn(() => ({
      width: 2,
      height: 2,
      data: new Uint8Array([
        128, 128, 128, 255, 128, 128, 128, 255, 128, 128, 128, 255, 128, 128, 128, 255,
      ]),
    })),
    deleteAsync: vi.fn(async () => {
      events.push('delete-generated');
    }),
    manipulate: vi.fn(async () => {
      events.push('manipulate');
      return { uri: GENERATED };
    }),
    markWritten: vi.fn(async () => {
      events.push('mark-written');
    }),
    moveAsync: vi.fn(async () => {
      events.push('move');
    }),
    readBytes: vi.fn(async () => {
      events.push('read');
      return new Uint8Array([1]);
    }),
    reserve: vi.fn(async () => {
      events.push('reserve');
      return HANDLE;
    }),
    retryRecovery: vi.fn(async () => 0),
    runGeneratedOperation: async <T>(operation: () => Promise<T>) => {
      try {
        return await operation();
      } catch (error) {
        events.push('rescan');
        throw error;
      }
    },
  };
  return { analyze: createPhotoLightingAnalyzer(deps), cleanup, deps, events };
}

describe('photo lighting plaintext lifecycle', () => {
  it('accepts only exact package-owned UUIDv4 JPEG cache children', () => {
    expect(trustedImageManipulatorJpegUri(GENERATED, CACHE)).toBe(GENERATED);
    expect(trustedImageManipulatorJpegUri(`${GENERATED}?x=1`, CACHE)).toBeNull();
    expect(trustedImageManipulatorJpegUri(`${CACHE}Camera/photo.jpg`, CACHE)).toBeNull();
    expect(
      trustedImageManipulatorJpegUri(`${CACHE}ImageManipulator/../photo.jpg`, CACHE),
    ).toBeNull();
  });

  it('journals before generation, adopts the sample, and cleans before resolving', async () => {
    const { analyze, deps, events } = harness();

    await expect(analyze('file:///capture.jpg')).resolves.toMatchObject({ state: 'good' });
    expect(events).toEqual(['reserve', 'manipulate', 'move', 'mark-written', 'read', 'cleanup']);
    expect(deps.moveAsync).toHaveBeenCalledWith({ from: GENERATED, to: HANDLE.uri });
    expect(deps.readBytes).toHaveBeenCalledWith(HANDLE.uri);
  });

  it('turns startup recovery failure into a route-blocking exact retry', async () => {
    const { analyze, deps } = harness();
    deps.reserve.mockRejectedValueOnce(new Error('startup residue'));

    const error = await analyze('file:///capture.jpg').catch((caught: unknown) => caught);
    if (!isPhotoAnalysisCleanupError(error)) throw error;
    await expect(error.retryCleanup()).resolves.toBeUndefined();
    expect(deps.manipulate).not.toHaveBeenCalled();
    expect(deps.retryRecovery).toHaveBeenCalledOnce();
  });

  it('retains a strict retry when journal-owned deletion fails', async () => {
    const { analyze, cleanup } = harness();
    cleanup.mockRejectedValueOnce(new Error('cache busy')).mockResolvedValueOnce(undefined);

    const error = await analyze('file:///capture.jpg').catch((caught: unknown) => caught);
    expect(isPhotoAnalysisCleanupError(error)).toBe(true);
    if (!isPhotoAnalysisCleanupError(error)) throw error;
    await expect(error.retryCleanup()).resolves.toBeUndefined();
    expect(cleanup).toHaveBeenCalledTimes(2);
  });

  it('rescans generated output and clears the journal reservation when adoption fails', async () => {
    const { analyze, deps, events } = harness();
    deps.moveAsync.mockRejectedValueOnce(new Error('move failed'));

    await expect(analyze('file:///capture.jpg')).rejects.toThrow('move failed');
    expect(events).toEqual(['reserve', 'manipulate', 'rescan', 'cleanup']);
  });

  it('rescans before clearing the reservation when native manipulation rejects without a URI', async () => {
    const { analyze, deps, events } = harness();
    deps.manipulate.mockRejectedValueOnce(new Error('native failed after write'));

    await expect(analyze('file:///capture.jpg')).rejects.toThrow('native failed after write');
    expect(events).toEqual(['reserve', 'rescan', 'cleanup']);
  });

  it('retains a serialized rescan retry when failure recovery cannot delete generated output', async () => {
    const { analyze, deps } = harness();
    const retryCleanup = vi.fn(async () => undefined);
    const generatedCleanupError = Object.assign(new Error('scan failed'), {
      name: 'ImageManipulatorPlaintextCleanupError',
      retryCleanup,
    });
    deps.runGeneratedOperation = vi.fn(async () => {
      throw generatedCleanupError;
    });

    const error = await analyze('file:///capture.jpg').catch((caught: unknown) => caught);
    if (!isPhotoAnalysisCleanupError(error)) throw error;
    await expect(error.retryCleanup()).resolves.toBeUndefined();
    expect(retryCleanup).toHaveBeenCalledOnce();
  });
});
