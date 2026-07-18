import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

import {
  createLabelPhotoLifecycle,
  LABEL_PHOTO_SCAVENGE_INCOMPLETE,
  LABEL_PHOTO_STALE_DELETE_LIMIT,
  scavengeStaleLabelPhotos,
  type LabelPhotoFileSystem,
} from './labelPhotoLifecycle';

const OCR_ROUTE = fileURLToPath(new URL('../../../app/shelf/ocr.tsx', import.meta.url));

function harness(initialFiles: string[] = []) {
  const files = new Set(initialFiles);
  const events: string[] = [];
  const fileSystem: LabelPhotoFileSystem = {
    cacheDirectory: 'file://cache/',
    deleteAsync: vi.fn(async (uri: string) => {
      events.push(`delete:${uri}`);
      files.delete(uri);
    }),
    moveAsync: vi.fn(async ({ from, to }: { from: string; to: string }) => {
      events.push(`move:${from}->${to}`);
      if (!files.has(from)) throw new Error('SOURCE_MISSING');
      files.delete(from);
      files.add(to);
    }),
    readDirectoryAsync: vi.fn(async () =>
      [...files]
        .filter((uri) => uri.startsWith('file://cache/'))
        .map((uri) => uri.slice('file://cache/'.length)),
    ),
  };
  return { events, files, fileSystem };
}

const ids = ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002'];

describe('temporary label-photo lifecycle', () => {
  it.each(['cancel', 'continue'] as const)(
    'awaits idempotent deletion before %s',
    async (reason) => {
      const raw = `file://cache/raw-${reason}.jpg`;
      const test = harness([raw]);
      const lifecycle = createLabelPhotoLifecycle(test.fileSystem, () => ids[0]!);
      const managed = await lifecycle.adoptCapturedPhoto(raw);

      await lifecycle.cleanup(reason);

      expect(test.fileSystem.deleteAsync).toHaveBeenCalledWith(managed, { idempotent: true });
      expect(test.files.has(managed)).toBe(false);
      expect(lifecycle.current()).toBeNull();
    },
  );

  it('deletes the old managed photo before a retake replacement is adopted', async () => {
    const firstRaw = 'file://cache/raw-first.jpg';
    const secondRaw = 'file://cache/raw-second.jpg';
    const test = harness([firstRaw, secondRaw]);
    let idIndex = 0;
    const lifecycle = createLabelPhotoLifecycle(test.fileSystem, () => ids[idIndex++]!);
    const firstManaged = await lifecycle.adoptCapturedPhoto(firstRaw);

    await lifecycle.cleanup('retake');
    const secondManaged = await lifecycle.adoptCapturedPhoto(secondRaw);

    expect(test.events.indexOf(`delete:${firstManaged}`)).toBeLessThan(
      test.events.indexOf(`move:${secondRaw}->${secondManaged}`),
    );
    expect(test.files.has(firstManaged)).toBe(false);
    expect(test.files.has(secondManaged)).toBe(true);
  });

  it('deletes the retained photo on capture failure and on unmount', async () => {
    const failedRaw = 'file://cache/raw-before-failure.jpg';
    const unmountRaw = 'file://cache/raw-before-unmount.jpg';
    const test = harness([failedRaw, unmountRaw]);
    let idIndex = 0;
    const lifecycle = createLabelPhotoLifecycle(test.fileSystem, () => ids[idIndex++]!);
    const failedManaged = await lifecycle.adoptCapturedPhoto(failedRaw);
    await lifecycle.cleanup('capture_failure');
    expect(test.files.has(failedManaged)).toBe(false);

    const unmountManaged = await lifecycle.adoptCapturedPhoto(unmountRaw);
    await lifecycle.dispose();
    expect(test.files.has(unmountManaged)).toBe(false);
  });

  it('keeps a failed post-dispose deletion retryable under the managed prefix', async () => {
    const raw = 'file://cache/raw-after-dispose.jpg';
    const test = harness([raw]);
    const lifecycle = createLabelPhotoLifecycle(test.fileSystem, () => ids[0]!);
    await lifecycle.dispose();
    vi.mocked(test.fileSystem.deleteAsync).mockRejectedValueOnce(new Error('DELETE_FAILED'));

    await expect(lifecycle.adoptCapturedPhoto(raw)).rejects.toThrow('DELETE_FAILED');

    const managed = `file://cache/catalog-label-photo-temp-${ids[0]}.jpg`;
    expect(test.fileSystem.moveAsync).toHaveBeenCalledWith({ from: raw, to: managed });
    expect(test.files.has(raw)).toBe(false);
    expect(test.files.has(managed)).toBe(true);
    expect(lifecycle.hasPendingCleanup()).toBe(true);

    await lifecycle.cleanup('capture_failure');
    expect(test.files.has(managed)).toBe(false);
    expect(lifecycle.hasPendingCleanup()).toBe(false);
  });

  it('bounds relaunch scavenging and never deletes unrelated cache files', async () => {
    const stale = Array.from(
      { length: LABEL_PHOTO_STALE_DELETE_LIMIT + 3 },
      (_, index) =>
        `file://cache/catalog-label-photo-temp-00000000-0000-4000-8000-${String(index).padStart(12, '0')}.jpg`,
    );
    const unrelated = [
      'file://cache/public-cache.json',
      'file://cache/catalog-label-photo-temp-not-a-uuid.jpg',
    ];
    const test = harness([...stale, ...unrelated]);

    await expect(scavengeStaleLabelPhotos(test.fileSystem)).rejects.toThrow(
      LABEL_PHOTO_SCAVENGE_INCOMPLETE,
    );
    expect(stale.filter((uri) => test.files.has(uri))).toHaveLength(3);
    expect(unrelated.every((uri) => test.files.has(uri))).toBe(true);
    await expect(scavengeStaleLabelPhotos(test.fileSystem)).resolves.toBe(3);
    expect(unrelated.every((uri) => test.files.has(uri))).toBe(true);
  });

  it('reports a stale-file deletion failure and succeeds when cleanup is retried', async () => {
    const stale = `file://cache/catalog-label-photo-temp-${ids[0]}.jpg`;
    const test = harness([stale]);
    vi.mocked(test.fileSystem.deleteAsync).mockRejectedValueOnce(new Error('DELETE_FAILED'));

    await expect(scavengeStaleLabelPhotos(test.fileSystem)).rejects.toThrow('DELETE_FAILED');
    expect(test.files.has(stale)).toBe(true);

    await expect(scavengeStaleLabelPhotos(test.fileSystem)).resolves.toBe(1);
    expect(test.files.has(stale)).toBe(false);
  });

  it('wires every route exit/failure to the manager and keeps native OCR unavailable', () => {
    const source = readFileSync(OCR_ROUTE, 'utf8');
    for (const reason of ['cancel', 'continue', 'retake', 'capture_failure']) {
      expect(source).toContain(`cleanupLabelPhoto('${reason}')`);
    }
    expect(source).toContain('scavengeStaleLabelPhotos');
    expect(source).toContain('setPhotoScavengeFailed(true)');
    expect(source).toContain('retryPhotoScavenging');
    expect(source).toContain('.dispose()');
    expect(source).toContain('const NATIVE_OCR_ADAPTER_AVAILABLE = false');
  });
});
