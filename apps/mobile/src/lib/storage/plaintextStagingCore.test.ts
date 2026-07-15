import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';

import {
  createPlaintextStagingCoordinator,
  PLAINTEXT_STAGING_CACHE_UNAVAILABLE,
  PLAINTEXT_STAGING_ENTRY_MISSING,
  PLAINTEXT_STAGING_ENTRY_UNOWNED,
  PLAINTEXT_STAGING_JOURNAL_INVALID,
  PLAINTEXT_STAGING_JOURNAL_KEY,
  PLAINTEXT_STAGING_SCAVENGE_FAILED,
  PLAINTEXT_STAGING_STATE_INVALID,
} from './plaintextStagingCore';

const FIRST_ID = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const SECOND_ID = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const STAGING_DIRECTORY = 'file://cache/private-plaintext-staging-v1/';
const SRC_DIR = fileURLToPath(new URL('../../', import.meta.url));

function createHarness(options: { cacheDirectory?: string | null; ids?: string[] } = {}) {
  const storage = new Map<string, string>();
  const files = new Set<string>();
  const directories = new Set<string>();
  const ids = [...(options.ids ?? [FIRST_ID, SECOND_ID])];
  const deleteAsync = vi.fn(async (uri: string) => {
    files.delete(uri);
    for (const file of [...files]) {
      if (file.startsWith(uri)) files.delete(file);
    }
    directories.delete(uri);
  });
  const getItem = vi.fn(async (key: string) => storage.get(key) ?? null);
  const removeItem = vi.fn(async (key: string) => {
    storage.delete(key);
  });
  const setItem = vi.fn(async (key: string, value: string) => {
    storage.set(key, value);
  });
  const deps = {
    cacheDirectory: options.cacheDirectory === undefined ? 'file://cache/' : options.cacheDirectory,
    createOperationId: vi.fn(() => ids.shift() ?? FIRST_ID),
    now: vi.fn(() => 1_721_234_567_890),
    storage: { getItem, removeItem, setItem },
    fileSystem: {
      deleteAsync,
      getInfoAsync: vi.fn(async (uri: string) => ({
        exists: directories.has(uri) || [...files].some((file) => file.startsWith(uri)),
      })),
      makeDirectoryAsync: vi.fn(async (uri: string) => {
        directories.add(uri);
      }),
      readDirectoryAsync: vi.fn(async (uri: string) =>
        [...files]
          .filter((file) => file.startsWith(uri))
          .map((file) => file.slice(uri.length))
          .filter((name) => name.length > 0 && !name.includes('/')),
      ),
    },
  };

  return {
    coordinator: createPlaintextStagingCoordinator(deps),
    deleteAsync,
    deps,
    directories,
    files,
    storage,
  };
}

function readJournal(storage: Map<string, string>) {
  const raw = storage.get(PLAINTEXT_STAGING_JOURNAL_KEY);
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
}

describe('plaintext staging journal', () => {
  it('reserves conflict-card exports under an exact owned PNG purpose', async () => {
    const harness = createHarness();

    const handle = await harness.coordinator.reserve('conflict_share_png');

    expect(handle).toEqual({
      operationId: FIRST_ID,
      purpose: 'conflict_share_png',
      uri: `${STAGING_DIRECTORY}${FIRST_ID}.png`,
    });
    expect(readJournal(harness.storage)).toMatchObject({
      entries: [{ operationId: FIRST_ID, purpose: 'conflict_share_png', state: 'reserved' }],
    });
  });

  it('reserves an opaque owned filename with a content-free strict journal entry', async () => {
    const harness = createHarness();

    const handle = await harness.coordinator.reserve('photo_share_jpeg');

    expect(handle).toEqual({
      operationId: FIRST_ID,
      purpose: 'photo_share_jpeg',
      uri: `${STAGING_DIRECTORY}${FIRST_ID}.jpg`,
    });
    expect(readJournal(harness.storage)).toEqual({
      version: 1,
      entries: [
        {
          operationId: FIRST_ID,
          createdAt: 1_721_234_567_890,
          purpose: 'photo_share_jpeg',
          state: 'reserved',
        },
      ],
    });
    const raw = harness.storage.get(PLAINTEXT_STAGING_JOURNAL_KEY)!;
    expect(raw).not.toContain('file://');
    expect(raw).not.toContain('photo-id');
    expect(raw).not.toContain('content');
  });

  it('serializes concurrent reservations without losing either entry', async () => {
    const harness = createHarness();
    let releaseFirstWrite!: () => void;
    const firstWriteGate = new Promise<void>((resolve) => {
      releaseFirstWrite = resolve;
    });
    harness.deps.storage.setItem = vi
      .fn()
      .mockImplementationOnce(async (key: string, value: string) => {
        await firstWriteGate;
        harness.storage.set(key, value);
      })
      .mockImplementation(async (key: string, value: string) => {
        harness.storage.set(key, value);
      });

    const coordinator = createPlaintextStagingCoordinator(harness.deps);
    const first = coordinator.reserve('photo_share_png');
    const second = coordinator.reserve('data_export_json');
    await vi.waitFor(() => expect(harness.deps.storage.setItem).toHaveBeenCalledTimes(1));
    releaseFirstWrite();

    await expect(Promise.all([first, second])).resolves.toHaveLength(2);
    expect(
      (readJournal(harness.storage)?.entries as { operationId: string }[]).map(
        (entry) => entry.operationId,
      ),
    ).toEqual([FIRST_ID, SECOND_ID]);
  });

  it('enforces forward-only state transitions', async () => {
    const harness = createHarness();
    const handle = await harness.coordinator.reserve('data_export_json');

    await expect(harness.coordinator.markState(handle, 'sharing')).rejects.toThrow(
      PLAINTEXT_STAGING_STATE_INVALID,
    );
    await harness.coordinator.markState(handle, 'plaintext_written');
    await harness.coordinator.markState(handle, 'sharing');

    expect(readJournal(harness.storage)).toMatchObject({
      entries: [{ operationId: FIRST_ID, state: 'sharing' }],
    });
  });

  it('resolves only an exact opaque, written capture entry with a present file', async () => {
    const harness = createHarness();
    const handle = await harness.coordinator.reserve('photo_capture_jpeg');

    await expect(
      harness.coordinator.lookup(handle.operationId, 'photo_capture_jpeg'),
    ).resolves.toBeNull();
    harness.files.add(handle.uri);
    await harness.coordinator.markState(handle, 'plaintext_written');

    await expect(
      harness.coordinator.lookup(handle.operationId, 'photo_capture_jpeg'),
    ).resolves.toEqual(handle);
    await expect(
      harness.coordinator.lookup(handle.operationId, 'photo_analysis_jpeg'),
    ).resolves.toBeNull();
    await expect(
      harness.coordinator.lookup('../not-opaque', 'photo_capture_jpeg'),
    ).resolves.toBeNull();
  });

  it('fails closed when a written capture journal entry has no file', async () => {
    const harness = createHarness();
    const handle = await harness.coordinator.reserve('photo_capture_jpeg');
    await harness.coordinator.markState(handle, 'plaintext_written');

    await expect(
      harness.coordinator.lookup(handle.operationId, 'photo_capture_jpeg'),
    ).rejects.toThrow(PLAINTEXT_STAGING_ENTRY_MISSING);
  });

  it('retains cleanup-pending ownership when deletion fails and succeeds on retry', async () => {
    const harness = createHarness();
    const handle = await harness.coordinator.reserve('photo_share_png');
    harness.files.add(handle.uri);
    await harness.coordinator.markState(handle, 'plaintext_written');
    harness.deleteAsync.mockRejectedValueOnce(new Error('cache busy'));

    await expect(harness.coordinator.cleanup(handle)).rejects.toThrow('cache busy');
    expect(harness.files.has(handle.uri)).toBe(true);
    expect(readJournal(harness.storage)).toMatchObject({
      entries: [{ operationId: FIRST_ID, state: 'cleanup_pending' }],
    });

    await expect(harness.coordinator.cleanup(handle)).resolves.toBeUndefined();
    expect(harness.files.has(handle.uri)).toBe(false);
    expect(readJournal(harness.storage)).toBeNull();
  });

  it('cleans a capture by opaque operation even from cleanup-pending recovery', async () => {
    const harness = createHarness();
    const handle = await harness.coordinator.reserve('photo_capture_jpeg');
    harness.files.add(handle.uri);
    await harness.coordinator.markState(handle, 'plaintext_written');
    harness.deleteAsync.mockRejectedValueOnce(new Error('process interrupted cleanup'));

    await expect(harness.coordinator.cleanup(handle)).rejects.toThrow(
      'process interrupted cleanup',
    );
    await expect(
      harness.coordinator.cleanupOperation(handle.operationId, 'photo_capture_jpeg'),
    ).resolves.toBeUndefined();

    expect(harness.files.has(handle.uri)).toBe(false);
    expect(readJournal(harness.storage)).toBeNull();
  });

  it('proves an already-scavenged capture absent but rejects unowned plaintext', async () => {
    const harness = createHarness();

    await expect(
      harness.coordinator.cleanupOperation(FIRST_ID, 'photo_capture_jpeg'),
    ).resolves.toBeUndefined();

    harness.files.add(`${STAGING_DIRECTORY}${FIRST_ID}.jpg`);
    await expect(
      harness.coordinator.cleanupOperation(FIRST_ID, 'photo_capture_jpeg'),
    ).rejects.toThrow(PLAINTEXT_STAGING_ENTRY_UNOWNED);
  });

  it('never treats a lost journal as proof that an exact handle plaintext file is absent', async () => {
    const harness = createHarness();
    const handle = await harness.coordinator.reserve('conflict_share_png');
    harness.files.add(handle.uri);
    harness.storage.delete(PLAINTEXT_STAGING_JOURNAL_KEY);

    await expect(harness.coordinator.cleanup(handle)).rejects.toThrow(
      PLAINTEXT_STAGING_ENTRY_UNOWNED,
    );
    expect(harness.files.has(handle.uri)).toBe(true);

    harness.files.delete(handle.uri);
    await expect(harness.coordinator.cleanup(handle)).resolves.toBeUndefined();
    await expect(
      harness.coordinator.cleanup({ ...handle, uri: `${handle.uri}.forged` }),
    ).rejects.toThrow(PLAINTEXT_STAGING_ENTRY_UNOWNED);
  });

  it('simulates crash/relaunch by scavenging an orphan from a fresh coordinator', async () => {
    const harness = createHarness();
    const handle = await harness.coordinator.reserve('data_export_json');
    harness.files.add(handle.uri);
    await harness.coordinator.markState(handle, 'plaintext_written');

    const relaunched = createPlaintextStagingCoordinator(harness.deps);
    await expect(relaunched.scavenge()).resolves.toBe(1);

    expect(harness.files.has(handle.uri)).toBe(false);
    expect(readJournal(harness.storage)).toBeNull();
    expect(harness.deleteAsync).toHaveBeenCalledWith(STAGING_DIRECTORY, { idempotent: true });
  });

  it('keeps the journal intact when scavenger deletion fails so relaunch can retry', async () => {
    const harness = createHarness();
    const handle = await harness.coordinator.reserve('data_export_json');
    harness.files.add(handle.uri);
    harness.deleteAsync.mockRejectedValueOnce(new Error('filesystem unavailable'));

    await expect(harness.coordinator.scavenge()).rejects.toThrow(PLAINTEXT_STAGING_SCAVENGE_FAILED);
    expect(readJournal(harness.storage)).not.toBeNull();
    expect(harness.files.has(handle.uri)).toBe(true);

    const retry = createPlaintextStagingCoordinator(harness.deps);
    await expect(retry.scavenge()).resolves.toBe(1);
    expect(readJournal(harness.storage)).toBeNull();
  });

  it('deletes the dedicated plaintext directories before surfacing a malformed journal', async () => {
    const harness = createHarness();
    harness.storage.set(PLAINTEXT_STAGING_JOURNAL_KEY, '{not-json');
    harness.files.add(`${STAGING_DIRECTORY}${FIRST_ID}.jpg`);

    await expect(harness.coordinator.scavenge()).rejects.toThrow(PLAINTEXT_STAGING_JOURNAL_INVALID);
    expect(harness.deleteAsync).toHaveBeenCalledWith(STAGING_DIRECTORY, { idempotent: true });
    expect(harness.files).not.toContain(`${STAGING_DIRECTORY}${FIRST_ID}.jpg`);
    expect(readJournal(harness.storage)).toBeNull();
    await expect(harness.coordinator.scavenge()).resolves.toBe(0);
  });

  it('rejects journal entries that contain a path or any non-schema field', async () => {
    const harness = createHarness();
    harness.storage.set(
      PLAINTEXT_STAGING_JOURNAL_KEY,
      JSON.stringify({
        version: 1,
        entries: [
          {
            operationId: FIRST_ID,
            createdAt: 1,
            purpose: 'data_export_json',
            state: 'reserved',
            uri: 'file://private/content.json',
          },
        ],
      }),
    );

    await expect(harness.coordinator.scavenge()).rejects.toThrow(PLAINTEXT_STAGING_JOURNAL_INVALID);
    expect(harness.deleteAsync).toHaveBeenCalledWith(STAGING_DIRECTORY, { idempotent: true });
  });

  it('deletes the entire app-owned staging directory before surfacing an unowned entry', async () => {
    const harness = createHarness();
    const handle = await harness.coordinator.reserve('photo_share_jpeg');
    const foreign = `${STAGING_DIRECTORY}foreign.txt`;
    harness.files.add(handle.uri);
    harness.files.add(foreign);

    await expect(harness.coordinator.scavenge()).rejects.toThrow(PLAINTEXT_STAGING_ENTRY_UNOWNED);
    expect(harness.deleteAsync).toHaveBeenCalledWith(STAGING_DIRECTORY, {
      idempotent: true,
    });
    expect(harness.files).toEqual(new Set());
    expect(readJournal(harness.storage)).toBeNull();
    await expect(harness.coordinator.scavenge()).resolves.toBe(0);
  });

  it('blocks a new reservation while an unowned cache entry exists', async () => {
    const harness = createHarness();
    harness.files.add(`${STAGING_DIRECTORY}foreign.txt`);

    await expect(harness.coordinator.reserve('data_export_json')).rejects.toThrow(
      PLAINTEXT_STAGING_ENTRY_UNOWNED,
    );

    expect(harness.deps.storage.setItem).not.toHaveBeenCalled();
    expect(harness.deleteAsync).not.toHaveBeenCalled();
  });

  it('rejects a forged handle and never deletes its URI', async () => {
    const harness = createHarness();
    const handle = await harness.coordinator.reserve('photo_share_jpeg');
    harness.files.add(handle.uri);
    const forged = { ...handle, uri: 'file://cache/unowned.jpg' };

    await expect(harness.coordinator.cleanup(forged)).rejects.toThrow(
      PLAINTEXT_STAGING_ENTRY_UNOWNED,
    );
    expect(harness.deleteAsync).not.toHaveBeenCalled();
    expect(harness.files.has(handle.uri)).toBe(true);
  });

  it('refuses new plaintext when no owned cache directory exists', async () => {
    const harness = createHarness({ cacheDirectory: null });

    await expect(harness.coordinator.reserve('data_export_json')).rejects.toThrow(
      PLAINTEXT_STAGING_CACHE_UNAVAILABLE,
    );
    await expect(harness.coordinator.scavenge()).rejects.toThrow(
      PLAINTEXT_STAGING_CACHE_UNAVAILABLE,
    );
    expect(harness.deps.storage.setItem).not.toHaveBeenCalled();
  });

  it('runs a queued startup scavenger before a later reservation', async () => {
    const harness = createHarness();
    let releaseScavenge!: () => void;
    const scavengeGate = new Promise<void>((resolve) => {
      releaseScavenge = resolve;
    });
    harness.deleteAsync.mockImplementationOnce(async (uri: string) => {
      expect(uri).toBe(STAGING_DIRECTORY);
      await scavengeGate;
    });

    const scavenging = harness.coordinator.scavenge();
    const reserving = harness.coordinator.reserve('photo_capture_jpeg');
    await vi.waitFor(() =>
      expect(harness.deleteAsync).toHaveBeenCalledWith(STAGING_DIRECTORY, {
        idempotent: true,
      }),
    );
    expect(harness.deps.fileSystem.makeDirectoryAsync).not.toHaveBeenCalled();

    releaseScavenge();
    await expect(scavenging).resolves.toBe(0);
    await expect(reserving).resolves.toMatchObject({ purpose: 'photo_capture_jpeg' });
  });

  it('scavenges the app-owned Camera and ImageManipulator ingress directories', async () => {
    const harness = createHarness();
    const cameraFile = 'file://cache/Camera/camera-output.jpg';
    const analysisFile = 'file://cache/ImageManipulator/analysis-output.jpg';
    harness.files.add(cameraFile);
    harness.files.add(analysisFile);

    await expect(harness.coordinator.scavenge()).resolves.toBe(0);

    expect(harness.files.has(cameraFile)).toBe(false);
    expect(harness.files.has(analysisFile)).toBe(false);
    expect(harness.deleteAsync).toHaveBeenCalledWith('file://cache/Camera/', {
      idempotent: true,
    });
    expect(harness.deleteAsync).toHaveBeenCalledWith('file://cache/ImageManipulator/', {
      idempotent: true,
    });
  });

  it('propagates ingress cleanup failure so an account boundary can stay closed', async () => {
    const harness = createHarness();
    harness.deleteAsync.mockRejectedValueOnce(new Error('camera cache unavailable'));

    await expect(harness.coordinator.scavenge()).rejects.toThrow(PLAINTEXT_STAGING_SCAVENGE_FAILED);
    expect(harness.deleteAsync).toHaveBeenCalledWith('file://cache/ImageManipulator/', {
      idempotent: true,
    });
  });
});

describe('plaintext staging startup contract', () => {
  it('runs owner-bound photo recovery and scavenging after session isolation but before app lock', () => {
    const rootLayout = readFileSync(`${SRC_DIR}/app/_layout.tsx`, 'utf8');
    const startupGate = readFileSync(
      `${SRC_DIR}/lib/storage/PlaintextStagingStartupGate.tsx`,
      'utf8',
    );
    const startupCoordinator = readFileSync(
      `${SRC_DIR}/lib/storage/privateStorageStartup.ts`,
      'utf8',
    );

    expect(rootLayout).toContain('<PlaintextStagingStartupGate>');
    expect(rootLayout.indexOf('<SessionBoundaryGate>')).toBeLessThan(
      rootLayout.indexOf('<PlaintextStagingStartupGate>'),
    );
    expect(rootLayout.indexOf('<PlaintextStagingStartupGate>')).toBeLessThan(
      rootLayout.indexOf('<AppLockProvider>'),
    );
    expect(startupGate).toContain('preparePrivateStorageForSession(userId)');
    expect(startupGate).not.toContain('const startupScavengeResult');
    expect(startupCoordinator.indexOf('await dependencies.recoverPhotos();')).toBeLessThan(
      startupCoordinator.indexOf('await dependencies.scavengePlaintext();'),
    );
    expect(startupGate).toContain("if (status === 'ready') return children;");
    expect(startupGate).not.toContain('.catch(() => undefined)');
    expect(rootLayout).not.toContain('void scavengePlaintextStaging().catch');
  });

  it('bypasses a missing native cache only on the filesystem-free web adapter', () => {
    const adapter = readFileSync(`${SRC_DIR}/lib/storage/plaintextStaging.ts`, 'utf8');

    expect(adapter).toContain("if (Platform.OS === 'web') return Promise.resolve(0);");
    expect(adapter).toContain('return coordinator.scavenge();');
  });
});
