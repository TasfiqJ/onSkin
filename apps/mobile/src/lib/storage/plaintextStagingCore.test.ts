import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';

import {
  createPlaintextStagingCoordinator,
  LEGACY_PLAINTEXT_STAGING_JOURNAL_KEY,
  PLAINTEXT_STAGING_CACHE_UNAVAILABLE,
  PLAINTEXT_STAGING_ENTRY_UNOWNED,
  PLAINTEXT_STAGING_JOURNAL_INVALID,
  PLAINTEXT_STAGING_JOURNAL_KEY,
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
  it('uses the current identity namespace and migrates a legacy journal before cleanup', async () => {
    const harness = createHarness();
    harness.storage.set(
      LEGACY_PLAINTEXT_STAGING_JOURNAL_KEY,
      JSON.stringify({
        version: 1,
        entries: [
          {
            operationId: FIRST_ID,
            createdAt: 1,
            purpose: 'data_export_json',
            state: 'plaintext_written',
          },
        ],
      }),
    );
    harness.files.add(`${STAGING_DIRECTORY}${FIRST_ID}.json`);

    expect(PLAINTEXT_STAGING_JOURNAL_KEY).toBe('routinekind.plaintext_staging_journal.v1');
    await expect(harness.coordinator.scavenge()).resolves.toBe(1);

    expect(harness.files).toEqual(new Set());
    expect(harness.storage.has(PLAINTEXT_STAGING_JOURNAL_KEY)).toBe(false);
    expect(harness.storage.has(LEGACY_PLAINTEXT_STAGING_JOURNAL_KEY)).toBe(false);
  });

  it('fails closed when current and legacy journals claim different plaintext', async () => {
    const harness = createHarness();
    const journal = (operationId: string) =>
      JSON.stringify({
        version: 1,
        entries: [
          {
            operationId,
            createdAt: 1,
            purpose: 'data_export_json',
            state: 'plaintext_written',
          },
        ],
      });
    harness.storage.set(PLAINTEXT_STAGING_JOURNAL_KEY, journal(FIRST_ID));
    harness.storage.set(LEGACY_PLAINTEXT_STAGING_JOURNAL_KEY, journal(SECOND_ID));
    harness.files.add(`${STAGING_DIRECTORY}${FIRST_ID}.json`);
    harness.files.add(`${STAGING_DIRECTORY}${SECOND_ID}.json`);

    await expect(harness.coordinator.scavenge()).rejects.toThrow(PLAINTEXT_STAGING_JOURNAL_INVALID);

    expect(harness.deleteAsync).not.toHaveBeenCalled();
    expect(harness.files.size).toBe(2);
    expect(harness.storage.has(PLAINTEXT_STAGING_JOURNAL_KEY)).toBe(true);
    expect(harness.storage.has(LEGACY_PLAINTEXT_STAGING_JOURNAL_KEY)).toBe(true);
  });

  it('keeps the legacy journal authoritative when the current-key migration write fails', async () => {
    const harness = createHarness();
    const legacyJournal = JSON.stringify({
      version: 1,
      entries: [
        {
          operationId: FIRST_ID,
          createdAt: 1,
          purpose: 'data_export_json',
          state: 'plaintext_written',
        },
      ],
    });
    harness.storage.set(LEGACY_PLAINTEXT_STAGING_JOURNAL_KEY, legacyJournal);
    harness.files.add(`${STAGING_DIRECTORY}${FIRST_ID}.json`);
    harness.deps.storage.setItem.mockRejectedValueOnce(new Error('storage write interrupted'));

    await expect(harness.coordinator.scavenge()).rejects.toThrow('storage write interrupted');

    expect(harness.deleteAsync).not.toHaveBeenCalled();
    expect(harness.storage.has(PLAINTEXT_STAGING_JOURNAL_KEY)).toBe(false);
    expect(harness.storage.get(LEGACY_PLAINTEXT_STAGING_JOURNAL_KEY)).toBe(legacyJournal);

    await expect(harness.coordinator.scavenge()).resolves.toBe(1);
    expect(harness.files).toEqual(new Set());
    expect(harness.storage.has(PLAINTEXT_STAGING_JOURNAL_KEY)).toBe(false);
    expect(harness.storage.has(LEGACY_PLAINTEXT_STAGING_JOURNAL_KEY)).toBe(false);
  });

  it('resumes safely from identical dual journals when legacy removal is interrupted', async () => {
    const harness = createHarness();
    const legacyJournal = JSON.stringify({
      version: 1,
      entries: [
        {
          operationId: FIRST_ID,
          createdAt: 1,
          purpose: 'data_export_json',
          state: 'plaintext_written',
        },
      ],
    });
    harness.storage.set(LEGACY_PLAINTEXT_STAGING_JOURNAL_KEY, legacyJournal);
    harness.files.add(`${STAGING_DIRECTORY}${FIRST_ID}.json`);
    harness.deps.storage.removeItem.mockRejectedValueOnce(new Error('storage remove interrupted'));

    await expect(harness.coordinator.scavenge()).rejects.toThrow('storage remove interrupted');

    expect(harness.deleteAsync).not.toHaveBeenCalled();
    expect(harness.storage.get(PLAINTEXT_STAGING_JOURNAL_KEY)).toBe(legacyJournal);
    expect(harness.storage.get(LEGACY_PLAINTEXT_STAGING_JOURNAL_KEY)).toBe(legacyJournal);
    expect(harness.deps.storage.setItem.mock.invocationCallOrder[0]).toBeLessThan(
      harness.deps.storage.removeItem.mock.invocationCallOrder[0]!,
    );

    await expect(harness.coordinator.scavenge()).resolves.toBe(1);
    expect(harness.files).toEqual(new Set());
    expect(harness.storage.has(PLAINTEXT_STAGING_JOURNAL_KEY)).toBe(false);
    expect(harness.storage.has(LEGACY_PLAINTEXT_STAGING_JOURNAL_KEY)).toBe(false);
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

  it('simulates crash/relaunch by scavenging an orphan from a fresh coordinator', async () => {
    const harness = createHarness();
    const handle = await harness.coordinator.reserve('data_export_json');
    harness.files.add(handle.uri);
    await harness.coordinator.markState(handle, 'plaintext_written');

    const relaunched = createPlaintextStagingCoordinator(harness.deps);
    await expect(relaunched.scavenge()).resolves.toBe(1);

    expect(harness.files.has(handle.uri)).toBe(false);
    expect(readJournal(harness.storage)).toBeNull();
    expect(harness.deleteAsync).toHaveBeenCalledWith(handle.uri, { idempotent: true });
  });

  it('keeps the journal intact when scavenger deletion fails so relaunch can retry', async () => {
    const harness = createHarness();
    const handle = await harness.coordinator.reserve('data_export_json');
    harness.files.add(handle.uri);
    harness.deleteAsync.mockRejectedValueOnce(new Error('filesystem unavailable'));

    await expect(harness.coordinator.scavenge()).rejects.toThrow('filesystem unavailable');
    expect(readJournal(harness.storage)).not.toBeNull();
    expect(harness.files.has(handle.uri)).toBe(true);

    const retry = createPlaintextStagingCoordinator(harness.deps);
    await expect(retry.scavenge()).resolves.toBe(1);
    expect(readJournal(harness.storage)).toBeNull();
  });

  it('fails closed on a malformed journal before touching the filesystem', async () => {
    const harness = createHarness();
    harness.storage.set(PLAINTEXT_STAGING_JOURNAL_KEY, '{not-json');
    harness.files.add(`${STAGING_DIRECTORY}${FIRST_ID}.jpg`);

    await expect(harness.coordinator.scavenge()).rejects.toThrow(PLAINTEXT_STAGING_JOURNAL_INVALID);
    expect(harness.deleteAsync).not.toHaveBeenCalled();
    expect(harness.files).toContain(`${STAGING_DIRECTORY}${FIRST_ID}.jpg`);
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
    expect(harness.deleteAsync).not.toHaveBeenCalled();
  });

  it('deletes journal-owned plaintext but fails closed without touching a coexisting foreign file', async () => {
    const harness = createHarness();
    const handle = await harness.coordinator.reserve('photo_share_jpeg');
    const foreign = `${STAGING_DIRECTORY}foreign.txt`;
    harness.files.add(handle.uri);
    harness.files.add(foreign);

    await expect(harness.coordinator.scavenge()).rejects.toThrow(PLAINTEXT_STAGING_ENTRY_UNOWNED);
    expect(harness.deleteAsync).toHaveBeenCalledExactlyOnceWith(handle.uri, {
      idempotent: true,
    });
    expect(harness.files).toEqual(new Set([foreign]));
    expect(readJournal(harness.storage)).toBeNull();
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
    await expect(harness.coordinator.scavenge()).resolves.toBe(0);
    expect(harness.deps.storage.setItem).not.toHaveBeenCalled();
  });
});

describe('plaintext staging startup contract', () => {
  it('starts one content-free scavenger before the root component can mount', () => {
    const rootLayout = readFileSync(`${SRC_DIR}/app/_layout.tsx`, 'utf8');
    const functionOffset = rootLayout.indexOf('export default function RootLayout()');
    const scavengeOffset = rootLayout.indexOf(
      'void scavengePlaintextStaging().catch(() => undefined);',
    );

    expect(rootLayout).toContain(
      "import { scavengePlaintextStaging } from '@/lib/storage/plaintextStaging';",
    );
    expect(scavengeOffset).toBeGreaterThan(-1);
    expect(scavengeOffset).toBeLessThan(functionOffset);
    expect(rootLayout).not.toContain('console.log(scavengePlaintextStaging');
  });
});
