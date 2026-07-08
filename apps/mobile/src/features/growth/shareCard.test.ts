import type { RefObject } from 'react';
import type { View } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { shareConflictCard } from './shareCard';

const mocks = vi.hoisted(() => ({
  captureRef: vi.fn(),
  deleteAsync: vi.fn(),
  isAvailableAsync: vi.fn(),
  shareAsync: vi.fn(),
}));

vi.mock('react-native-view-shot', () => ({
  captureRef: mocks.captureRef,
}));

vi.mock('expo-file-system/legacy', () => ({
  deleteAsync: mocks.deleteAsync,
}));

vi.mock('expo-sharing', () => ({
  isAvailableAsync: mocks.isAvailableAsync,
  shareAsync: mocks.shareAsync,
}));

function mountedRef(): RefObject<View | null> {
  return { current: {} as View };
}

const runtime = globalThis as typeof globalThis & { __DEV__?: boolean };
const originalDev = runtime.__DEV__;

describe('conflict share-card export', () => {
  beforeEach(() => {
    mocks.captureRef.mockReset();
    mocks.deleteAsync.mockReset();
    mocks.isAvailableAsync.mockReset();
    mocks.shareAsync.mockReset();
    mocks.deleteAsync.mockResolvedValue(undefined);
    if (originalDev === undefined) delete runtime.__DEV__;
    else runtime.__DEV__ = originalDev;
    delete process.env.EXPO_PUBLIC_E2E_SHARE_CARD_EXPORT;
  });

  afterEach(() => {
    if (originalDev === undefined) delete runtime.__DEV__;
    else runtime.__DEV__ = originalDev;
    delete process.env.EXPO_PUBLIC_E2E_SHARE_CARD_EXPORT;
  });

  it('returns false without capture when the card view is not mounted', async () => {
    await expect(shareConflictCard({ current: null })).resolves.toBe(false);

    expect(mocks.captureRef).not.toHaveBeenCalled();
    expect(mocks.deleteAsync).not.toHaveBeenCalled();
  });

  it('opens the native share sheet and deletes the temporary PNG', async () => {
    mocks.captureRef.mockResolvedValueOnce('file://cache/conflict-card.png');
    mocks.isAvailableAsync.mockResolvedValueOnce(true);
    mocks.shareAsync.mockResolvedValueOnce(undefined);

    await expect(shareConflictCard(mountedRef())).resolves.toBe(true);

    expect(mocks.shareAsync).toHaveBeenCalledWith('file://cache/conflict-card.png', {
      mimeType: 'image/png',
      dialogTitle: 'Share your shelf check',
      UTI: 'public.png',
    });
    expect(mocks.deleteAsync).toHaveBeenCalledWith('file://cache/conflict-card.png', {
      idempotent: true,
    });
  });

  it('returns false and deletes the PNG when sharing is unavailable', async () => {
    mocks.captureRef.mockResolvedValueOnce('file://cache/conflict-card.png');
    mocks.isAvailableAsync.mockResolvedValueOnce(false);

    await expect(shareConflictCard(mountedRef())).resolves.toBe(false);

    expect(mocks.shareAsync).not.toHaveBeenCalled();
    expect(mocks.deleteAsync).toHaveBeenCalledWith('file://cache/conflict-card.png', {
      idempotent: true,
    });
  });

  it('returns false and deletes the PNG when the share sheet rejects', async () => {
    mocks.captureRef.mockResolvedValueOnce('file://cache/conflict-card.png');
    mocks.isAvailableAsync.mockResolvedValueOnce(true);
    mocks.shareAsync.mockRejectedValueOnce(new Error('native share rejected'));

    await expect(shareConflictCard(mountedRef())).resolves.toBe(false);

    expect(mocks.deleteAsync).toHaveBeenCalledWith('file://cache/conflict-card.png', {
      idempotent: true,
    });
  });

  it('returns false and deletes the PNG when availability probing throws', async () => {
    mocks.captureRef.mockResolvedValueOnce('file://cache/conflict-card.png');
    mocks.isAvailableAsync.mockRejectedValueOnce(new Error('probe failed'));

    await expect(shareConflictCard(mountedRef())).resolves.toBe(false);

    expect(mocks.shareAsync).not.toHaveBeenCalled();
    expect(mocks.deleteAsync).toHaveBeenCalledWith('file://cache/conflict-card.png', {
      idempotent: true,
    });
  });

  it('uses the dev-only E2E unavailable fixture without opening native sharing', async () => {
    runtime.__DEV__ = true;
    process.env.EXPO_PUBLIC_E2E_SHARE_CARD_EXPORT = 'unavailable';

    await expect(shareConflictCard(mountedRef())).resolves.toBe(false);

    expect(mocks.captureRef).not.toHaveBeenCalled();
    expect(mocks.isAvailableAsync).not.toHaveBeenCalled();
    expect(mocks.shareAsync).not.toHaveBeenCalled();
    expect(mocks.deleteAsync).not.toHaveBeenCalled();
  });

  it('ignores the E2E share-card fixture outside dev builds', async () => {
    runtime.__DEV__ = false;
    process.env.EXPO_PUBLIC_E2E_SHARE_CARD_EXPORT = 'unavailable';
    mocks.captureRef.mockResolvedValueOnce('file://cache/conflict-card.png');
    mocks.isAvailableAsync.mockResolvedValueOnce(true);
    mocks.shareAsync.mockResolvedValueOnce(undefined);

    await expect(shareConflictCard(mountedRef())).resolves.toBe(true);

    expect(mocks.shareAsync).toHaveBeenCalledWith('file://cache/conflict-card.png', {
      mimeType: 'image/png',
      dialogTitle: 'Share your shelf check',
      UTI: 'public.png',
    });
  });

  it('lets capture failures bubble as card-creation failures', async () => {
    mocks.captureRef.mockRejectedValueOnce(new Error('capture failed'));

    await expect(shareConflictCard(mountedRef())).rejects.toThrow('capture failed');

    expect(mocks.deleteAsync).not.toHaveBeenCalled();
  });
});
