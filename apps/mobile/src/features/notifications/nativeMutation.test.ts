import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  NotificationNativeCleanupError,
  NotificationNativeCleanupTimeoutError,
  NotificationNativeCompensationError,
  NotificationNativeMutationCoordinator,
  NotificationNativeMutationFencedError,
  NotificationNativeMutationSupersededError,
  type NotificationNativeMutationBackend,
} from './nativeMutation';

vi.mock('expo-notifications', () => ({
  cancelAllScheduledNotificationsAsync: vi.fn(async () => undefined),
  cancelScheduledNotificationAsync: vi.fn(async () => undefined),
  dismissAllNotificationsAsync: vi.fn(async () => undefined),
  dismissNotificationAsync: vi.fn(async () => undefined),
  scheduleNotificationAsync: vi.fn(async (request: { identifier?: string }) =>
    Promise.resolve(request.identifier ?? 'generated'),
  ),
}));

function createBackend(): NotificationNativeMutationBackend {
  return {
    cancelAllScheduledNotificationsAsync: vi.fn(async () => undefined),
    cancelScheduledNotificationAsync: vi.fn(async () => undefined),
    dismissAllNotificationsAsync: vi.fn(async () => undefined),
    dismissNotificationAsync: vi.fn(async () => undefined),
    scheduleNotificationAsync: vi.fn(async (request) => request.identifier ?? 'generated'),
  };
}

function immediateRequest(identifier: string) {
  return {
    identifier,
    content: { title: 'RoutineKind' },
    trigger: null,
  } as const;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('NotificationNativeMutationCoordinator', () => {
  it('quarantines a stale exact schedule through cancel and dismiss compensation', async () => {
    const backend = createBackend();
    const coordinator = new NotificationNativeMutationCoordinator(backend, 25);
    const ownerA = new AbortController();
    let resolveSchedule!: (identifier: string) => void;
    vi.mocked(backend.scheduleNotificationAsync).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSchedule = resolve;
        }),
    );

    const scheduled = coordinator.scheduleExact(ownerA.signal, immediateRequest('owner-a-id'));
    ownerA.abort();

    expect(() => coordinator.cancelExact('owner-b-id')).toThrow(
      NotificationNativeMutationFencedError,
    );

    resolveSchedule('owner-a-id');
    await expect(scheduled).rejects.toBeInstanceOf(NotificationNativeMutationSupersededError);

    expect(backend.cancelScheduledNotificationAsync).toHaveBeenCalledWith('owner-a-id');
    expect(backend.dismissNotificationAsync).toHaveBeenCalledWith('owner-a-id');
    await expect(coordinator.cancelExact('owner-b-id')).resolves.toBeUndefined();
  });

  it('keeps same-ID replacement work fenced until a late cancellation is terminal', async () => {
    const backend = createBackend();
    const coordinator = new NotificationNativeMutationCoordinator(backend, 25);
    let resolveCancellation!: () => void;
    vi.mocked(backend.cancelScheduledNotificationAsync).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveCancellation = resolve;
        }),
    );

    const cancellation = coordinator.cancelExact('shared-id');
    expect(() =>
      coordinator.scheduleExact(new AbortController().signal, immediateRequest('shared-id')),
    ).toThrow(NotificationNativeMutationFencedError);

    resolveCancellation();
    await expect(cancellation).resolves.toBeUndefined();
    await expect(
      coordinator.scheduleExact(new AbortController().signal, immediateRequest('shared-id')),
    ).resolves.toBe('shared-id');
  });

  it('compensates a stale commit-ambiguous scheduling rejection before releasing the fence', async () => {
    const backend = createBackend();
    const coordinator = new NotificationNativeMutationCoordinator(backend, 25);
    const ownerA = new AbortController();
    let rejectSchedule!: (error: Error) => void;
    vi.mocked(backend.scheduleNotificationAsync).mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectSchedule = reject;
        }),
    );

    const scheduled = coordinator.scheduleExact(ownerA.signal, immediateRequest('owner-a-id'));
    ownerA.abort();
    rejectSchedule(new Error('bridge response lost'));

    await expect(scheduled).rejects.toThrow('bridge response lost');
    expect(backend.cancelScheduledNotificationAsync).toHaveBeenCalledWith('owner-a-id');
    expect(backend.dismissNotificationAsync).toHaveBeenCalledWith('owner-a-id');
    await expect(coordinator.cancelExact('owner-b-id')).resolves.toBeUndefined();
  });

  it('keeps same-generation work fenced through commit-then-reject compensation', async () => {
    const backend = createBackend();
    const coordinator = new NotificationNativeMutationCoordinator(backend, 25);
    let rejectSchedule!: (error: Error) => void;
    let resolveExactCancellation!: () => void;
    vi.mocked(backend.scheduleNotificationAsync).mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectSchedule = reject;
        }),
    );
    vi.mocked(backend.cancelScheduledNotificationAsync).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveExactCancellation = resolve;
        }),
    );

    const nativeError = new Error('commit response lost');
    const scheduled = coordinator.scheduleExact(
      new AbortController().signal,
      immediateRequest('same-owner-id'),
    );
    rejectSchedule(nativeError);
    await vi.waitFor(() => {
      expect(backend.cancelScheduledNotificationAsync).toHaveBeenCalledWith('same-owner-id');
      expect(backend.dismissNotificationAsync).toHaveBeenCalledWith('same-owner-id');
    });

    expect(() => coordinator.cancelExact('later-id')).toThrow(
      NotificationNativeMutationFencedError,
    );
    resolveExactCancellation();
    await expect(scheduled).rejects.toBe(nativeError);
    await expect(coordinator.cancelExact('later-id')).resolves.toBeUndefined();
  });

  it('bounds cleanup without releasing a never-settling owner-A mutation', async () => {
    vi.useFakeTimers();
    const backend = createBackend();
    const coordinator = new NotificationNativeMutationCoordinator(backend, 25);
    const ownerA = new AbortController();
    let resolveSchedule!: (identifier: string) => void;
    vi.mocked(backend.scheduleNotificationAsync).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSchedule = resolve;
        }),
    );

    const scheduled = coordinator.scheduleExact(ownerA.signal, immediateRequest('owner-a-id'));
    ownerA.abort();
    const cleanupResult = coordinator.clearAllWithinBound().catch((error: unknown) => error);

    expect(backend.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
    expect(backend.dismissAllNotificationsAsync).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(26);
    await expect(cleanupResult).resolves.toBeInstanceOf(NotificationNativeCleanupTimeoutError);
    expect(() => coordinator.cancelExact('owner-b-id')).toThrow(
      NotificationNativeMutationFencedError,
    );

    resolveSchedule('owner-a-id');
    await expect(scheduled).rejects.toBeInstanceOf(NotificationNativeMutationSupersededError);
    await Promise.resolve();
    await expect(coordinator.clearAllWithinBound()).resolves.toBeUndefined();
    await expect(coordinator.cancelExact('owner-b-id')).resolves.toBeUndefined();
  });

  it('allows a cleanup retry but keeps owner-B mutations fenced by the older cleanup', async () => {
    vi.useFakeTimers();
    const backend = createBackend();
    const coordinator = new NotificationNativeMutationCoordinator(backend, 25);
    let resolveFirstCancelAll!: () => void;
    vi.mocked(backend.cancelAllScheduledNotificationsAsync)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirstCancelAll = resolve;
          }),
      )
      .mockResolvedValue(undefined);

    const firstResult = coordinator.clearAllWithinBound().catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(26);
    await expect(firstResult).resolves.toBeInstanceOf(NotificationNativeCleanupTimeoutError);

    await expect(coordinator.clearAllWithinBound()).resolves.toBeUndefined();
    expect(() => coordinator.cancelExact('owner-b-id')).toThrow(
      NotificationNativeMutationFencedError,
    );

    resolveFirstCancelAll();
    await vi.waitFor(() => {
      expect(coordinator.isOrdinaryMutationFenced()).toBe(false);
    });
    await expect(coordinator.cancelExact('owner-b-id')).resolves.toBeUndefined();
  });

  it('fails exact cleanup truthfully and permits a later successful retry', async () => {
    const backend = createBackend();
    const coordinator = new NotificationNativeMutationCoordinator(backend, 25);
    vi.mocked(backend.dismissAllNotificationsAsync)
      .mockRejectedValueOnce(new Error('native dismiss unavailable'))
      .mockResolvedValue(undefined);

    await expect(coordinator.clearAllWithinBound()).rejects.toBeInstanceOf(
      NotificationNativeCleanupError,
    );
    expect(() => coordinator.cancelExact('owner-b-id')).toThrow(
      NotificationNativeMutationFencedError,
    );
    await expect(coordinator.clearAllWithinBound()).resolves.toBeUndefined();
    await expect(coordinator.cancelExact('owner-b-id')).resolves.toBeUndefined();
  });

  it('requires a retry when stale-schedule compensation fails during cleanup', async () => {
    const backend = createBackend();
    const coordinator = new NotificationNativeMutationCoordinator(backend, 25);
    const ownerA = new AbortController();
    let resolveSchedule!: (identifier: string) => void;
    vi.mocked(backend.scheduleNotificationAsync).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSchedule = resolve;
        }),
    );
    vi.mocked(backend.dismissNotificationAsync).mockRejectedValueOnce(
      new Error('exact dismiss unavailable'),
    );

    const scheduled = coordinator.scheduleExact(ownerA.signal, immediateRequest('owner-a-id'));
    ownerA.abort();
    const cleanup = coordinator.clearAllWithinBound();
    resolveSchedule('owner-a-id');

    await expect(scheduled).rejects.toBeInstanceOf(NotificationNativeCompensationError);
    await expect(cleanup).rejects.toBeInstanceOf(NotificationNativeCleanupError);
    expect(() => coordinator.cancelExact('owner-b-id')).toThrow(
      NotificationNativeMutationFencedError,
    );

    await expect(coordinator.clearAllWithinBound()).resolves.toBeUndefined();
    await expect(coordinator.cancelExact('owner-b-id')).resolves.toBeUndefined();
  });
});
