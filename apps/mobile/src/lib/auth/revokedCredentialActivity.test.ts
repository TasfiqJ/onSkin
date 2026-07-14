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
});
