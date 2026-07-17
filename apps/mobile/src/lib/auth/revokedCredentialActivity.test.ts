import { describe, expect, it, vi } from 'vitest';

import { clearAuthDerivedLocalActivity } from './revokedCredentialActivity';

function dependencies() {
  const calls: string[] = [];
  return {
    calls,
    deps: {
      cancelQueries: vi.fn(async () => {
        calls.push('cancel:queries');
      }),
      cancelScheduledNotifications: vi.fn(async () => {
        calls.push('cancel:notifications');
      }),
      clearRoutineWidgetActions: vi.fn(async () => {
        calls.push('clear:widget-actions');
      }),
      clearRoutineWidgetNativeState: vi.fn(async () => {
        calls.push('clear:native-widgets');
      }),
      clearQueries: vi.fn(() => {
        calls.push('clear:queries');
      }),
      purgeSensitiveImageMemory: vi.fn(async () => {
        calls.push('purge:image-memory');
      }),
      resetAnalyticsIdentity: vi.fn(async () => {
        calls.push('reset:analytics');
      }),
      resetRevenueCatIdentity: vi.fn(async () => {
        calls.push('reset:revenuecat');
      }),
    },
  };
}

describe('revoked credential local activity cleanup', () => {
  it('clears only ephemeral/auth-derived activity in a bounded order', async () => {
    const harness = dependencies();

    await expect(clearAuthDerivedLocalActivity(harness.deps)).resolves.toBeUndefined();
    expect(harness.calls).toEqual([
      'clear:native-widgets',
      'clear:widget-actions',
      'cancel:queries',
      'clear:queries',
      'purge:image-memory',
      'cancel:notifications',
      'reset:analytics',
      'reset:revenuecat',
      'cancel:queries',
      'clear:queries',
    ]);
    expect(Object.keys(harness.deps)).not.toContain('clearLocalPrivateData');
  });

  it('closes native admission before a query cancellation can stall', async () => {
    const harness = dependencies();
    let releaseQueryCancellation!: () => void;
    harness.deps.cancelQueries.mockImplementationOnce(
      () => new Promise<void>((resolve) => (releaseQueryCancellation = resolve)),
    );

    const cleanup = clearAuthDerivedLocalActivity(harness.deps);
    expect(harness.deps.clearRoutineWidgetNativeState).toHaveBeenCalledOnce();
    expect(harness.deps.clearRoutineWidgetActions).toHaveBeenCalledOnce();
    expect(harness.deps.cancelQueries).toHaveBeenCalledOnce();
    expect(harness.deps.clearQueries).not.toHaveBeenCalled();

    releaseQueryCancellation();
    await cleanup;
  });

  it('attempts every cleanup and reports stable labels when one stage fails', async () => {
    const harness = dependencies();
    harness.deps.resetAnalyticsIdentity.mockRejectedValueOnce(new Error('provider detail'));

    await expect(clearAuthDerivedLocalActivity(harness.deps)).rejects.toThrow(
      'AUTH_DERIVED_ACTIVITY_CLEAR_FAILED:analytics_identity',
    );
    expect(harness.deps.resetRevenueCatIdentity).toHaveBeenCalledOnce();
    expect(harness.deps.cancelQueries).toHaveBeenCalledTimes(2);
    expect(harness.deps.clearQueries).toHaveBeenCalledTimes(2);
  });

  it('reports native widget cleanup failure while still clearing later vendors and queries', async () => {
    const harness = dependencies();
    harness.deps.clearRoutineWidgetNativeState.mockRejectedValueOnce(
      new Error('native storage unavailable'),
    );

    await expect(clearAuthDerivedLocalActivity(harness.deps)).rejects.toThrow(
      'AUTH_DERIVED_ACTIVITY_CLEAR_FAILED:routine_widget_native_state',
    );
    expect(harness.deps.resetRevenueCatIdentity).toHaveBeenCalledOnce();
    expect(harness.deps.cancelQueries).toHaveBeenCalledTimes(2);
    expect(harness.deps.clearQueries).toHaveBeenCalledTimes(2);
  });

  it('reports encrypted action-registry failure without deleting durable skincare data', async () => {
    const harness = dependencies();
    harness.deps.clearRoutineWidgetActions.mockRejectedValueOnce(
      new Error('private action registry unavailable'),
    );

    await expect(clearAuthDerivedLocalActivity(harness.deps)).rejects.toThrow(
      'AUTH_DERIVED_ACTIVITY_CLEAR_FAILED:routine_widget_actions',
    );
    expect(harness.deps.clearRoutineWidgetNativeState).toHaveBeenCalledOnce();
    expect(harness.deps.resetRevenueCatIdentity).toHaveBeenCalledOnce();
    expect(Object.keys(harness.deps)).not.toContain('clearLocalPrivateData');
  });
});
