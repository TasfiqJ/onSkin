export const PLAINTEXT_STAGING_JOURNAL_KEY = 'onskin.plaintext_staging_journal.v1';
export const PLAINTEXT_STAGING_CACHE_UNAVAILABLE = 'PLAINTEXT_STAGING_CACHE_UNAVAILABLE';
export const PLAINTEXT_STAGING_JOURNAL_INVALID = 'PLAINTEXT_STAGING_JOURNAL_INVALID';
export const PLAINTEXT_STAGING_ENTRY_UNOWNED = 'PLAINTEXT_STAGING_ENTRY_UNOWNED';
export const PLAINTEXT_STAGING_STATE_INVALID = 'PLAINTEXT_STAGING_STATE_INVALID';

const JOURNAL_VERSION = 1;
const MAX_JOURNAL_ENTRIES = 128;
const STAGING_DIRECTORY_NAME = 'private-plaintext-staging-v1/';
const OPAQUE_OPERATION_ID = /^[0-9a-f]{32}$/;

export type PlaintextStagingPurpose = 'data_export_json' | 'photo_share_jpeg' | 'photo_share_png';

export type PlaintextStagingState =
  | 'reserved'
  | 'plaintext_written'
  | 'sharing'
  | 'cleanup_pending';

export type PlaintextStagingHandle = {
  operationId: string;
  purpose: PlaintextStagingPurpose;
  uri: string;
};

type PlaintextStagingJournalEntry = {
  operationId: string;
  createdAt: number;
  purpose: PlaintextStagingPurpose;
  state: PlaintextStagingState;
};

type PlaintextStagingJournal = {
  version: typeof JOURNAL_VERSION;
  entries: PlaintextStagingJournalEntry[];
};

type PlaintextStagingDependencies = {
  cacheDirectory: string | null;
  createOperationId: () => string;
  now: () => number;
  storage: {
    getItem: (key: string) => Promise<string | null>;
    removeItem: (key: string) => Promise<void>;
    setItem: (key: string, value: string) => Promise<void>;
  };
  fileSystem: {
    deleteAsync: (uri: string, options: { idempotent: true }) => Promise<void>;
    getInfoAsync: (uri: string) => Promise<{ exists: boolean }>;
    makeDirectoryAsync: (uri: string, options: { intermediates: true }) => Promise<void>;
    readDirectoryAsync: (uri: string) => Promise<string[]>;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(record: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(record).sort();
  const sortedExpected = [...expected].sort();
  return (
    actual.length === sortedExpected.length &&
    actual.every((key, index) => key === sortedExpected[index])
  );
}

function isPurpose(value: unknown): value is PlaintextStagingPurpose {
  return (
    value === 'data_export_json' || value === 'photo_share_jpeg' || value === 'photo_share_png'
  );
}

function isState(value: unknown): value is PlaintextStagingState {
  return (
    value === 'reserved' ||
    value === 'plaintext_written' ||
    value === 'sharing' ||
    value === 'cleanup_pending'
  );
}

function parseJournal(raw: string | null): PlaintextStagingJournal {
  if (raw === null) return { version: JOURNAL_VERSION, entries: [] };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error(PLAINTEXT_STAGING_JOURNAL_INVALID);
  }

  if (
    !isRecord(parsed) ||
    !hasExactKeys(parsed, ['version', 'entries']) ||
    parsed.version !== JOURNAL_VERSION ||
    !Array.isArray(parsed.entries) ||
    parsed.entries.length > MAX_JOURNAL_ENTRIES
  ) {
    throw new Error(PLAINTEXT_STAGING_JOURNAL_INVALID);
  }

  const seen = new Set<string>();
  const entries: PlaintextStagingJournalEntry[] = [];
  for (const value of parsed.entries) {
    if (
      !isRecord(value) ||
      !hasExactKeys(value, ['operationId', 'createdAt', 'purpose', 'state']) ||
      typeof value.operationId !== 'string' ||
      !OPAQUE_OPERATION_ID.test(value.operationId) ||
      typeof value.createdAt !== 'number' ||
      !Number.isSafeInteger(value.createdAt) ||
      value.createdAt < 0 ||
      !isPurpose(value.purpose) ||
      !isState(value.state) ||
      seen.has(value.operationId)
    ) {
      throw new Error(PLAINTEXT_STAGING_JOURNAL_INVALID);
    }
    seen.add(value.operationId);
    entries.push({
      operationId: value.operationId,
      createdAt: value.createdAt,
      purpose: value.purpose,
      state: value.state,
    });
  }

  return { version: JOURNAL_VERSION, entries };
}

function extensionForPurpose(purpose: PlaintextStagingPurpose): string {
  if (purpose === 'data_export_json') return 'json';
  return purpose === 'photo_share_png' ? 'png' : 'jpg';
}

function fileNameForEntry(
  entry: Pick<PlaintextStagingJournalEntry, 'operationId' | 'purpose'>,
): string {
  return `${entry.operationId}.${extensionForPurpose(entry.purpose)}`;
}

function validTransition(from: PlaintextStagingState, to: PlaintextStagingState): boolean {
  if (from === to) return true;
  if (to === 'cleanup_pending') return true;
  if (from === 'reserved' && to === 'plaintext_written') return true;
  return from === 'plaintext_written' && to === 'sharing';
}

export function createPlaintextStagingCoordinator(deps: PlaintextStagingDependencies) {
  let mutationQueue: Promise<void> = Promise.resolve();

  const stagingDirectory = deps.cacheDirectory
    ? `${deps.cacheDirectory.replace(/\/+$/, '')}/${STAGING_DIRECTORY_NAME}`
    : null;

  function serialize<T>(operation: () => Promise<T>): Promise<T> {
    const pending = mutationQueue.then(operation, operation);
    mutationQueue = pending.then(
      () => undefined,
      () => undefined,
    );
    return pending;
  }

  async function readJournal(): Promise<PlaintextStagingJournal> {
    return parseJournal(await deps.storage.getItem(PLAINTEXT_STAGING_JOURNAL_KEY));
  }

  async function writeJournal(journal: PlaintextStagingJournal): Promise<void> {
    if (journal.entries.length === 0) {
      await deps.storage.removeItem(PLAINTEXT_STAGING_JOURNAL_KEY);
      return;
    }
    await deps.storage.setItem(PLAINTEXT_STAGING_JOURNAL_KEY, JSON.stringify(journal));
  }

  function uriForEntry(
    entry: Pick<PlaintextStagingJournalEntry, 'operationId' | 'purpose'>,
  ): string {
    if (!stagingDirectory) throw new Error(PLAINTEXT_STAGING_CACHE_UNAVAILABLE);
    return `${stagingDirectory}${fileNameForEntry(entry)}`;
  }

  async function directoryHasUnownedEntry(journal: PlaintextStagingJournal): Promise<boolean> {
    if (!stagingDirectory) throw new Error(PLAINTEXT_STAGING_CACHE_UNAVAILABLE);
    const info = await deps.fileSystem.getInfoAsync(stagingDirectory);
    const actualEntries = info.exists
      ? await deps.fileSystem.readDirectoryAsync(stagingDirectory)
      : [];
    const expectedNames = new Set(journal.entries.map(fileNameForEntry));
    return actualEntries.some((name) => !expectedNames.has(name));
  }

  async function assertDirectoryOwned(journal: PlaintextStagingJournal): Promise<void> {
    if (await directoryHasUnownedEntry(journal)) {
      throw new Error(PLAINTEXT_STAGING_ENTRY_UNOWNED);
    }
  }

  function assertOwnedHandle(
    handle: PlaintextStagingHandle,
    entry: PlaintextStagingJournalEntry,
  ): void {
    if (
      handle.operationId !== entry.operationId ||
      handle.purpose !== entry.purpose ||
      handle.uri !== uriForEntry(entry)
    ) {
      throw new Error(PLAINTEXT_STAGING_ENTRY_UNOWNED);
    }
  }

  async function cleanupJournalEntry(
    journal: PlaintextStagingJournal,
    index: number,
  ): Promise<void> {
    const entry = journal.entries[index]!;
    if (entry.state !== 'cleanup_pending') {
      const entries = [...journal.entries];
      entries[index] = { ...entry, state: 'cleanup_pending' };
      try {
        await writeJournal({ version: JOURNAL_VERSION, entries });
      } catch {
        // Deleting known plaintext reduces exposure even when the content-free
        // transition cannot persist. The old entry still supports retry.
      }
    }

    await deps.fileSystem.deleteAsync(uriForEntry(entry), { idempotent: true });
    await writeJournal({
      version: JOURNAL_VERSION,
      entries: journal.entries.filter((candidate) => candidate.operationId !== entry.operationId),
    });
  }

  return {
    reserve(purpose: PlaintextStagingPurpose): Promise<PlaintextStagingHandle> {
      return serialize(async () => {
        if (!stagingDirectory) throw new Error(PLAINTEXT_STAGING_CACHE_UNAVAILABLE);
        await deps.fileSystem.makeDirectoryAsync(stagingDirectory, { intermediates: true });
        const journal = await readJournal();
        await assertDirectoryOwned(journal);
        const operationId = deps.createOperationId().replace(/-/g, '').toLowerCase();
        if (
          !OPAQUE_OPERATION_ID.test(operationId) ||
          journal.entries.some((entry) => entry.operationId === operationId) ||
          journal.entries.length >= MAX_JOURNAL_ENTRIES
        ) {
          throw new Error(PLAINTEXT_STAGING_JOURNAL_INVALID);
        }
        const entry: PlaintextStagingJournalEntry = {
          operationId,
          createdAt: deps.now(),
          purpose,
          state: 'reserved',
        };
        if (!Number.isSafeInteger(entry.createdAt) || entry.createdAt < 0) {
          throw new Error(PLAINTEXT_STAGING_JOURNAL_INVALID);
        }
        await writeJournal({ version: JOURNAL_VERSION, entries: [...journal.entries, entry] });
        return { operationId, purpose, uri: uriForEntry(entry) };
      });
    },

    markState(handle: PlaintextStagingHandle, state: PlaintextStagingState): Promise<void> {
      return serialize(async () => {
        const journal = await readJournal();
        await assertDirectoryOwned(journal);
        const index = journal.entries.findIndex(
          (entry) => entry.operationId === handle.operationId,
        );
        if (index < 0) throw new Error(PLAINTEXT_STAGING_ENTRY_UNOWNED);
        const entry = journal.entries[index]!;
        assertOwnedHandle(handle, entry);
        if (!validTransition(entry.state, state)) {
          throw new Error(PLAINTEXT_STAGING_STATE_INVALID);
        }
        if (entry.state === state) return;
        const entries = [...journal.entries];
        entries[index] = { ...entry, state };
        await writeJournal({ version: JOURNAL_VERSION, entries });
      });
    },

    cleanup(handle: PlaintextStagingHandle): Promise<void> {
      return serialize(async () => {
        const journal = await readJournal();
        const index = journal.entries.findIndex(
          (entry) => entry.operationId === handle.operationId,
        );
        if (index < 0) return;
        const entry = journal.entries[index]!;
        assertOwnedHandle(handle, entry);
        await cleanupJournalEntry(journal, index);
      });
    },

    cleanupUri(uri: string): Promise<void> {
      return serialize(async () => {
        const journal = await readJournal();
        const index = journal.entries.findIndex((entry) => uriForEntry(entry) === uri);
        if (index < 0) return;
        await cleanupJournalEntry(journal, index);
      });
    },

    scavenge(): Promise<number> {
      return serialize(async () => {
        if (!stagingDirectory) return 0;
        const journal = await readJournal();
        const hasUnownedEntry = await directoryHasUnownedEntry(journal);

        for (const entry of journal.entries) {
          await deps.fileSystem.deleteAsync(uriForEntry(entry), { idempotent: true });
        }
        await writeJournal({ version: JOURNAL_VERSION, entries: [] });
        if (hasUnownedEntry) throw new Error(PLAINTEXT_STAGING_ENTRY_UNOWNED);
        return journal.entries.length;
      });
    },
  };
}
