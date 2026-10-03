import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import NotificationPreferenceScheduleReconciler, {
  createNotificationScheduleLifecycleCoordinator,
} from './NotificationPreferenceScheduleReconciler';

const mocks = vi.hoisted(() => ({
  currentState: 'active' as 'active' | 'background' | 'inactive',
  devWarn: vi.fn(),
  listener: null as ((state: 'active' | 'background' | 'inactive') => void) | null,
  platform: 'ios',
  remove: vi.fn(),
  reschedule: vi.fn(async (_prefs?: unknown, _lifecycle?: unknown) => undefined),
}));

vi.mock('react-native', () => ({
  AppState: {
    addEventListener: (_event: string, listener: typeof mocks.listener) => {
      mocks.listener = listener;
      return { remove: mocks.remove };
    },
    get currentState() {
      return mocks.currentState;
    },
  },
  Platform: {
    get OS() {
      return mocks.platform;
    },
  },
}));
vi.mock('@/lib/observability/safeLog', () => ({ devWarn: mocks.devWarn }));
vi.mock('./deliver', () => ({ rescheduleReminders: mocks.reschedule }));

let renderer: ReactTestRenderer | null = null;

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  mocks.currentState = 'active';
  mocks.devWarn.mockClear();
  mocks.listener = null;
  mocks.platform = 'ios';
  mocks.remove.mockClear();
  mocks.reschedule.mockReset();
  mocks.reschedule.mockResolvedValue(undefined);
});

afterEach(async () => {
  if (renderer) await act(async () => renderer?.unmount());
  renderer = null;
  vi.useRealTimers();
});

describe('notification schedule lifecycle coordinator', () => {
  it('defers an inactive start and runs exactly one pass on foreground', async () => {
    const reconcile = vi.fn(async () => undefined);
    const coordinator = createNotificationScheduleLifecycleCoordinator({
      reconcile,
      onAttemptError: vi.fn(),
    });

    coordinator.start('background');
    expect(reconcile).not.toHaveBeenCalled();

    coordinator.handleAppStateChange('active');
    await vi.waitFor(() => expect(reconcile).toHaveBeenCalledOnce());
    coordinator.handleAppStateChange('active');
    await Promise.resolve();
    expect(reconcile).toHaveBeenCalledOnce();
    coordinator.dispose();
  });

  it('aborts a crossing pass and retains one fresh foreground convergence pass', async () => {
    let releaseFirst!: () => void;
    let firstSignal: AbortSignal | null = null;
    const reconcile = vi.fn(async ({ signal }: { signal: AbortSignal }) => {
      if (reconcile.mock.calls.length === 1) {
        firstSignal = signal;
        await new Promise<void>((resolve) => {
          releaseFirst = resolve;
        });
      }
    });
    const coordinator = createNotificationScheduleLifecycleCoordinator({
      reconcile,
      onAttemptError: vi.fn(),
    });

    coordinator.start('active');
    await vi.waitFor(() => expect(reconcile).toHaveBeenCalledOnce());
    coordinator.handleAppStateChange('background');
    expect(firstSignal).not.toBeNull();
    expect((firstSignal as unknown as AbortSignal).aborted).toBe(true);
    releaseFirst();
    await Promise.resolve();
    coordinator.handleAppStateChange('active');
    await vi.waitFor(() => expect(reconcile).toHaveBeenCalledTimes(2));
    coordinator.dispose();
  });
});

describe('root local-reminder reconciler', () => {
  it('reconciles on cold active mount and again after a background/foreground transition', async () => {
    await act(async () => {
      renderer = create(createElement(NotificationPreferenceScheduleReconciler));
    });
    await vi.waitFor(() => expect(mocks.reschedule).toHaveBeenCalledOnce());
    expect(mocks.reschedule.mock.calls[0]?.[0]).toBeUndefined();
    expect(mocks.reschedule.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        isCurrent: expect.any(Function),
        signal: expect.any(AbortSignal),
      }),
    );

    await act(async () => mocks.listener?.('background'));
    await act(async () => mocks.listener?.('active'));
    await vi.waitFor(() => expect(mocks.reschedule).toHaveBeenCalledTimes(2));
  });

  it('does not start native reconciliation on web', async () => {
    mocks.platform = 'web';
    await act(async () => {
      renderer = create(createElement(NotificationPreferenceScheduleReconciler));
    });
    expect(mocks.reschedule).not.toHaveBeenCalled();
    expect(mocks.listener).toBeNull();
  });

  it('keeps the root host behind health admission and source cleanup on the coordinator', () => {
    const root = readFileSync(
      fileURLToPath(new URL('../../app/_layout.tsx', import.meta.url)),
      'utf8',
    );
    const cleanup = readFileSync(
      fileURLToPath(new URL('../healthConsent/selectiveCleanup.ts', import.meta.url)),
      'utf8',
    );
    const delivery = readFileSync(fileURLToPath(new URL('./deliver.ts', import.meta.url)), 'utf8');

    expect(root).toContain("import { lazy, Suspense, useEffect, useState } from 'react';");
    expect(root).toMatch(
      /<HealthDataLifecycleGate>[\s\S]*?<NotificationPreferenceScheduleReconciler \/>[\s\S]*?<OnboardingProvider>/u,
    );
    expect(delivery).toContain('export type NotificationScheduleLifecycle');
    expect(delivery).toContain('cancelPreferenceReminderSchedules');
    expect(cleanup).toContain('clearNativeNotificationsForAccountIsolation');
    expect(cleanup).not.toContain('Notifications.cancelAllScheduledNotificationsAsync');
  });
});
