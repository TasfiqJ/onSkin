import { deletePhotoStorage, photoStorageCleanupLimits } from './photoStorageCleanup.ts';

type ListOptions = {
  limit: number;
  offset: number;
  sortBy: { column: 'name'; order: 'asc' };
};

type ListEntry = {
  name: string;
  id: string | null;
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function assertRejectsCode(operation: () => Promise<unknown>, code: string): Promise<void> {
  try {
    await operation();
  } catch (error) {
    assert(error instanceof Error, 'expected an Error rejection.');
    assert(error.message === code, `expected ${code}, received ${error.message}.`);
    return;
  }
  throw new Error(`expected ${code} rejection.`);
}

class FakePhotoBucket {
  readonly objects: Set<string>;
  readonly listCalls: Array<{ prefix: string; options: ListOptions }> = [];
  readonly removeCalls: string[][] = [];
  failListAtOffset: number | null = null;
  failRemoveAtCall: number | null = null;

  constructor(paths: string[]) {
    this.objects = new Set(paths);
  }

  list(prefix: string, options: ListOptions) {
    this.listCalls.push({ prefix, options });
    if (this.failListAtOffset === options.offset) {
      return Promise.resolve({ data: null, error: { message: 'list unavailable' } });
    }

    const childKinds = new Map<string, 'file' | 'folder'>();
    const prefixWithSlash = `${prefix}/`;
    for (const path of this.objects) {
      if (!path.startsWith(prefixWithSlash)) continue;
      const remainder = path.slice(prefixWithSlash.length);
      const [child, ...descendants] = remainder.split('/');
      if (!child) continue;
      childKinds.set(child, descendants.length > 0 ? 'folder' : 'file');
    }

    const entries: ListEntry[] = [...childKinds]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, kind]) => ({
        name,
        id: kind === 'folder' ? null : `id:${prefix}/${name}`,
      }));
    return Promise.resolve({
      data: entries.slice(options.offset, options.offset + options.limit),
      error: null,
    });
  }

  remove(paths: string[]) {
    this.removeCalls.push([...paths]);
    if (this.failRemoveAtCall === this.removeCalls.length) {
      return Promise.resolve({ error: { message: 'remove unavailable' } });
    }
    for (const path of paths) this.objects.delete(path);
    return Promise.resolve({ error: null });
  }
}

function clientFor(bucket: FakePhotoBucket) {
  return {
    storage: {
      from(name: 'photos') {
        assert(name === 'photos', `unexpected bucket ${name}.`);
        return bucket;
      },
    },
  };
}

const USER_ID = '00000000-0000-4000-8000-000000000001';

Deno.test('account deletion removes every owned object after the first 1,000', async () => {
  const paths = Array.from(
    { length: 1_205 },
    (_, index) => `${USER_ID}/photo-${String(index).padStart(4, '0')}.enc`,
  );
  const bucket = new FakePhotoBucket(paths);

  await deletePhotoStorage(USER_ID, clientFor(bucket));

  assert(bucket.objects.size === 0, 'expected every object to be removed.');
  const removed = bucket.removeCalls.flat();
  assert(removed.length === paths.length, 'expected each collected path to be removed once.');
  assert(new Set(removed).size === paths.length, 'expected removal paths to be unique.');
  assert(
    bucket.removeCalls.every(
      (chunk) => chunk.length > 0 && chunk.length <= photoStorageCleanupLimits.removeChunkSize,
    ),
    'expected bounded non-empty removal chunks.',
  );
  assert(
    bucket.listCalls.some((call) => call.prefix === USER_ID && call.options.offset === 1000),
    'expected root pagination beyond the first 1,000 entries.',
  );
});

Deno.test('account deletion recursively removes exact nested owned paths', async () => {
  const otherUserPath = '00000000-0000-4000-8000-000000000002/2026/07/keep.enc';
  const paths = [
    `${USER_ID}/top-level.enc`,
    `${USER_ID}/2026/07/face/front.enc`,
    `${USER_ID}/2026/07/face/left.enc`,
    `${USER_ID}/2026/08/face/right.enc`,
  ];
  const bucket = new FakePhotoBucket([...paths, otherUserPath]);

  await deletePhotoStorage(USER_ID, clientFor(bucket));

  assert(
    bucket.objects.size === 1 && bucket.objects.has(otherUserPath),
    'expected nested owned objects to be removed without touching another owner.',
  );
  const removed = bucket.removeCalls.flat().sort();
  assert(
    JSON.stringify(removed) === JSON.stringify([...paths].sort()),
    'removed paths were not exact.',
  );
  for (const prefix of [
    USER_ID,
    `${USER_ID}/2026`,
    `${USER_ID}/2026/07`,
    `${USER_ID}/2026/07/face`,
  ]) {
    assert(
      bucket.listCalls.some((call) => call.prefix === prefix),
      `expected nested prefix ${prefix} to be listed.`,
    );
  }
});

Deno.test('account deletion photo cleanup is idempotent', async () => {
  const paths = Array.from(
    { length: 205 },
    (_, index) => `${USER_ID}/photo-${String(index).padStart(3, '0')}.enc`,
  );
  const bucket = new FakePhotoBucket(paths);
  const client = clientFor(bucket);
  bucket.failRemoveAtCall = 2;

  await assertRejectsCode(() => deletePhotoStorage(USER_ID, client), 'STORAGE_REMOVE_FAILED');
  const remainingAfterFailure = bucket.objects.size;
  assert(
    remainingAfterFailure === 105,
    'expected a failed chunk to leave that chunk and later chunks available for retry.',
  );

  bucket.failRemoveAtCall = null;
  await deletePhotoStorage(USER_ID, client);
  const removalCallsAfterSuccessfulRetry = bucket.removeCalls.length;
  await deletePhotoStorage(USER_ID, client);

  assert(bucket.objects.size === 0, 'expected storage to remain empty.');
  assert(
    bucket.removeCalls.length === removalCallsAfterSuccessfulRetry,
    'expected an empty retry not to issue removal calls.',
  );
});

Deno.test(
  'account deletion collects every page before removal and fails closed on list errors',
  async () => {
    const paths = Array.from(
      { length: 1_001 },
      (_, index) => `${USER_ID}/photo-${String(index).padStart(4, '0')}.enc`,
    );
    const bucket = new FakePhotoBucket(paths);
    bucket.failListAtOffset = 1000;

    await assertRejectsCode(
      () => deletePhotoStorage(USER_ID, clientFor(bucket)),
      'STORAGE_LIST_FAILED',
    );

    assert(bucket.removeCalls.length === 0, 'expected no removals before collection completed.');
    assert(bucket.objects.size === paths.length, 'expected list failure to preserve every object.');
  },
);

Deno.test('account deletion rejects unsafe listed paths before any removal', async () => {
  const removeCalls: string[][] = [];
  const bucket = {
    list() {
      return Promise.resolve({
        data: [{ name: '..', id: 'malicious-object' }],
        error: null,
      });
    },
    remove(paths: string[]) {
      removeCalls.push([...paths]);
      return Promise.resolve({ error: null });
    },
  };

  await assertRejectsCode(
    () =>
      deletePhotoStorage(USER_ID, {
        storage: { from: () => bucket },
      }),
    'STORAGE_LIST_FAILED',
  );

  assert(removeCalls.length === 0, 'expected unsafe list data to fail before removal.');
});
