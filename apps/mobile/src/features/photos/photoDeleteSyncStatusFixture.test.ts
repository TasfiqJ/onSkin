import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

import {
  createPhotoDeleteSyncStatusFixtureReader,
  photoDeleteSyncStatusQueryEnabled,
  photoDeleteSyncStatusQueryKey,
  resolvePhotoDeleteSyncStatusFixture,
} from './photoDeleteSyncStatusFixture';

const IDLE = {
  status: 'available',
  value: { kind: 'idle', pendingCount: 0, attentionCount: 0 },
} as const;

describe('photo deletion sync status development fixture', () => {
  it('rejects every fixture outside development web', () => {
    expect(
      resolvePhotoDeleteSyncStatusFixture({
        development: false,
        platform: 'web',
        raw: 'unavailable_once',
      }),
    ).toBeNull();
    expect(
      resolvePhotoDeleteSyncStatusFixture({
        development: true,
        platform: 'ios',
        raw: 'needs_attention',
      }),
    ).toBeNull();
    expect(
      resolvePhotoDeleteSyncStatusFixture({
        development: true,
        platform: 'web',
        raw: 'unknown',
      }),
    ).toBeNull();
  });

  it('keeps existing presentation fixtures static and typed', () => {
    for (const [raw, attentionCount] of [
      ['saved_local', 0],
      ['syncing', 0],
      ['needs_attention', 1],
    ] as const) {
      const fixture = resolvePhotoDeleteSyncStatusFixture({
        development: true,
        platform: 'web',
        raw,
      });
      expect(fixture).toEqual({
        kind: 'static',
        value: {
          status: 'available',
          value: { kind: raw, pendingCount: 1, attentionCount },
        },
      });
      expect(photoDeleteSyncStatusQueryEnabled(fixture)).toBe(false);
    }
  });

  it('replaces only the first real read and then exposes real recovery', async () => {
    const fixture = resolvePhotoDeleteSyncStatusFixture({
      development: true,
      platform: 'web',
      raw: ' unavailable_once ',
    });
    const realReader = vi.fn(async () => IDLE);
    const read = createPhotoDeleteSyncStatusFixtureReader(fixture, realReader);

    await expect(read()).resolves.toEqual({ status: 'unavailable', value: null });
    await expect(read()).resolves.toEqual(IDLE);

    expect(realReader).toHaveBeenCalledTimes(2);
    expect(fixture).toEqual({ kind: 'unavailable_once' });
  });

  it('consumes the one-shot fault before awaiting concurrent real reads', async () => {
    const fixture = resolvePhotoDeleteSyncStatusFixture({
      development: true,
      platform: 'web',
      raw: 'unavailable_once',
    });
    const realReader = vi.fn(async () => IDLE);
    const read = createPhotoDeleteSyncStatusFixtureReader(fixture, realReader);

    const [first, second] = await Promise.all([read(), read()]);

    expect(first).toEqual({ status: 'unavailable', value: null });
    expect(second).toEqual(IDLE);
    expect(realReader).toHaveBeenCalledTimes(2);
  });

  it('delegates immediately when the one-shot fault is not selected', async () => {
    const realReader = vi.fn(async () => IDLE);
    const read = createPhotoDeleteSyncStatusFixtureReader(null, realReader);

    await expect(read()).resolves.toEqual(IDLE);
    expect(realReader).toHaveBeenCalledOnce();
  });

  it('isolates one-shot cache identity and recovers through a real query refetch', async () => {
    const fixture = resolvePhotoDeleteSyncStatusFixture({
      development: true,
      platform: 'web',
      raw: 'unavailable_once',
    });
    const baseKey = ['photo_delete_outbox_status', 'owner-scope', 0] as const;
    const firstKey = photoDeleteSyncStatusQueryKey(baseKey, fixture, 'fixture-a');
    const remountKey = photoDeleteSyncStatusQueryKey(baseKey, fixture, 'fixture-b');
    const firstReader = vi.fn(async () => IDLE);
    const readFirst = createPhotoDeleteSyncStatusFixtureReader(fixture, firstReader);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });

    await expect(
      queryClient.fetchQuery({ queryKey: firstKey, queryFn: readFirst }),
    ).resolves.toEqual({
      status: 'unavailable',
      value: null,
    });
    await expect(
      queryClient.fetchQuery({ queryKey: firstKey, queryFn: readFirst }),
    ).resolves.toEqual({
      status: 'unavailable',
      value: null,
    });
    expect(firstReader).toHaveBeenCalledOnce();

    await queryClient.refetchQueries({ queryKey: firstKey, exact: true });
    expect(queryClient.getQueryData(firstKey)).toEqual(IDLE);
    expect(firstReader).toHaveBeenCalledTimes(2);

    expect(remountKey).not.toEqual(firstKey);
    const remountReader = vi.fn(async () => IDLE);
    await expect(
      queryClient.fetchQuery({
        queryKey: remountKey,
        queryFn: createPhotoDeleteSyncStatusFixtureReader(fixture, remountReader),
      }),
    ).resolves.toEqual({ status: 'unavailable', value: null });
    expect(remountReader).toHaveBeenCalledOnce();
    queryClient.clear();
  });
});
