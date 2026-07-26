import type { PhotoDeleteOutboxStatusRead } from '@/lib/offline/outbox';

export type PhotoDeleteSyncStatusFixture =
  | Readonly<{
      kind: 'static';
      value: PhotoDeleteOutboxStatusRead;
    }>
  | Readonly<{ kind: 'unavailable_once' }>;

export function resolvePhotoDeleteSyncStatusFixture(input: {
  development: boolean;
  platform: string;
  raw: string | null | undefined;
}): PhotoDeleteSyncStatusFixture | null {
  if (!input.development || input.platform !== 'web') return null;
  const value = input.raw?.trim().toLowerCase();
  if (value === 'unavailable_once') return Object.freeze({ kind: 'unavailable_once' });
  if (!['saved_local', 'syncing', 'needs_attention'].includes(value ?? '')) return null;
  const status: PhotoDeleteOutboxStatusRead = {
    status: 'available',
    value: Object.freeze({
      kind: value as 'needs_attention' | 'saved_local' | 'syncing',
      pendingCount: 1,
      attentionCount: value === 'needs_attention' ? 1 : 0,
    }),
  };
  return Object.freeze({
    kind: 'static',
    value: status,
  });
}

export function createPhotoDeleteSyncStatusFixtureReader(
  fixture: PhotoDeleteSyncStatusFixture | null,
  readRealStatus: () => Promise<PhotoDeleteOutboxStatusRead>,
): () => Promise<PhotoDeleteOutboxStatusRead> {
  let injectUnavailable = fixture?.kind === 'unavailable_once';
  return async () => {
    const replaceResult = injectUnavailable;
    injectUnavailable = false;
    const result = await readRealStatus();
    return replaceResult ? { status: 'unavailable', value: null } : result;
  };
}

export function photoDeleteSyncStatusQueryEnabled(
  fixture: PhotoDeleteSyncStatusFixture | null,
): boolean {
  return fixture?.kind !== 'static';
}

export function photoDeleteSyncStatusQueryKey(
  base: readonly unknown[],
  fixture: PhotoDeleteSyncStatusFixture | null,
  fixtureInstanceId: string,
): readonly unknown[] {
  return fixture?.kind === 'unavailable_once'
    ? [...base, 'development_unavailable_once', fixtureInstanceId]
    : base;
}
