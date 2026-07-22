import { describe, expect, it, vi } from 'vitest';

import { createPhotoNoteSaveCoordinator } from './photoNoteSaveCoordinator';

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, reject, resolve };
}

describe('photo note save coordinator', () => {
  it('does no work for an unchanged blur', async () => {
    const commit = vi.fn<(notes: string) => Promise<void>>();
    const coordinator = createPhotoNoteSaveCoordinator({ commit, initialNotes: 'saved' });

    await coordinator.requestSave();

    expect(commit).not.toHaveBeenCalled();
    expect(coordinator.getSnapshot()).toEqual({
      draft: 'saved',
      persisted: 'saved',
      status: 'idle',
    });
  });

  it('keeps one write in flight and coalesces a second blur to the latest draft', async () => {
    const first = deferred<void>();
    const second = deferred<void>();
    const commit = vi
      .fn<(notes: string) => Promise<void>>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const coordinator = createPhotoNoteSaveCoordinator({ commit, initialNotes: '' });

    coordinator.updateDraft('first');
    const firstSave = coordinator.requestSave();
    coordinator.updateDraft('latest');
    const queuedSave = coordinator.requestSave();

    expect(queuedSave).toBe(firstSave);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(coordinator.getSnapshot()).toMatchObject({ draft: 'latest', status: 'saving' });

    first.resolve();
    await Promise.resolve();
    expect(commit).toHaveBeenNthCalledWith(2, 'latest');
    second.resolve();
    await firstSave;

    expect(coordinator.getSnapshot()).toEqual({
      draft: 'latest',
      persisted: 'latest',
      status: 'saved',
    });
  });

  it('deduplicates same-draft editing callbacks without saving later unrequested typing', async () => {
    const first = deferred<void>();
    const commit = vi.fn<(notes: string) => Promise<void>>().mockReturnValueOnce(first.promise);
    const coordinator = createPhotoNoteSaveCoordinator({ commit, initialNotes: '' });

    coordinator.updateDraft('requested');
    const blurSave = coordinator.requestSave();
    const endEditingSave = coordinator.requestSave();
    coordinator.updateDraft('typed after the request');

    expect(endEditingSave).toBe(blurSave);
    expect(commit).toHaveBeenCalledTimes(1);
    first.resolve();
    await blurSave;

    expect(commit).toHaveBeenCalledTimes(1);
    expect(coordinator.getSnapshot()).toEqual({
      draft: 'typed after the request',
      persisted: 'requested',
      status: 'idle',
    });

    await coordinator.requestSave();
    expect(commit).toHaveBeenNthCalledWith(2, 'typed after the request');
  });

  it('stops after failure, retains the latest draft, and retries explicitly', async () => {
    const commit = vi
      .fn<(notes: string) => Promise<void>>()
      .mockRejectedValueOnce(new Error('private storage unavailable'))
      .mockResolvedValueOnce(undefined);
    const coordinator = createPhotoNoteSaveCoordinator({ commit, initialNotes: 'old' });

    coordinator.updateDraft('new');
    await coordinator.requestSave();

    expect(coordinator.getSnapshot()).toEqual({
      draft: 'new',
      persisted: 'old',
      status: 'error',
    });

    await coordinator.requestSave();
    expect(commit).toHaveBeenNthCalledWith(2, 'new');
    expect(coordinator.getSnapshot()).toEqual({
      draft: 'new',
      persisted: 'new',
      status: 'saved',
    });
  });

  it('unsubscribes a disposed editor from late completion publication', async () => {
    const pending = deferred<void>();
    const listener = vi.fn();
    const coordinator = createPhotoNoteSaveCoordinator({
      commit: () => pending.promise,
      initialNotes: '',
    });
    const unsubscribe = coordinator.subscribe(listener);

    coordinator.updateDraft('owner A note');
    const saving = coordinator.requestSave();
    unsubscribe();
    listener.mockClear();
    pending.resolve();
    await saving;

    expect(listener).not.toHaveBeenCalled();
    expect(coordinator.getSnapshot()).toMatchObject({ persisted: 'owner A note', status: 'saved' });
  });
});
