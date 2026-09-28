import { describe, expect, it, vi } from 'vitest';

import {
  clearRejectedSessionActivity,
  clearRejectedSessionActivityDurably,
} from './sessionInvalidation';

function harness() {
  const calls: string[] = [];
  return {
    calls,
    dependencies: {
      persistInvalidationMarker: vi.fn(async () => {
        calls.push('marker');
      }),
      signOut: vi.fn(async () => {
        calls.push('sign-out');
      }),
      clearPersistedSession: vi.fn(async () => {
        calls.push('clear-session');
      }),
      waitForAccountOperations: vi.fn(async () => {
        calls.push('account-operations');
      }),
      waitForPrivateWrites: vi.fn(async () => {
        calls.push('private-writes');
      }),
      waitForPhotoWrites: vi.fn(async () => {
        calls.push('photo-writes');
      }),
      clearAccountIsolatedState: vi.fn(async () => {
        calls.push('account-isolated-state');
      }),
      clearAuthDerivedActivity: vi.fn(async () => {
        calls.push('derived-activity');
      }),
      markAuthDerivedCleanupRequired: vi.fn(async () => {
        calls.push('recovery-marker');
      }),
      clearAuthDerivedCleanupRequired: vi.fn(async () => {
        calls.push('clear-recovery-marker');
      }),
    },
  };
}

describe('rejected auth session cleanup', () => {
  it('orders durable invalidation before sign-out and persisted-session removal', async () => {
    const h = harness();
    await expect(clearRejectedSessionActivity(h.dependencies)).resolves.toBeUndefined();
    expect(h.calls).toEqual([
      'marker',
      'sign-out',
      'clear-session',
      'account-operations',
      'private-writes',
      'photo-writes',
      'account-isolated-state',
      'derived-activity',
    ]);
  });

  it('durably brackets session removal and every cleanup stage', async () => {
    const h = harness();

    await expect(clearRejectedSessionActivityDurably(h.dependencies)).resolves.toBeUndefined();
    expect(h.calls).toEqual([
      'recovery-marker',
      'marker',
      'sign-out',
      'clear-session',
      'account-operations',
      'private-writes',
      'photo-writes',
      'account-isolated-state',
      'derived-activity',
      'clear-recovery-marker',
    ]);
  });

  it('does not remove the session when the crash-recovery marker cannot commit', async () => {
    const h = harness();
    h.dependencies.markAuthDerivedCleanupRequired.mockRejectedValueOnce(
      new Error('storage unavailable'),
    );

    await expect(clearRejectedSessionActivityDurably(h.dependencies)).rejects.toThrow(
      'storage unavailable',
    );
    expect(h.dependencies.signOut).not.toHaveBeenCalled();
    expect(h.dependencies.clearPersistedSession).not.toHaveBeenCalled();
    expect(h.dependencies.clearAuthDerivedCleanupRequired).not.toHaveBeenCalled();
  });

  it('retains the crash-recovery marker after any downstream cleanup failure', async () => {
    const h = harness();
    h.dependencies.clearAuthDerivedActivity.mockRejectedValueOnce(
      new Error('vendor cleanup unavailable'),
    );

    await expect(clearRejectedSessionActivityDurably(h.dependencies)).rejects.toThrow(
      'REJECTED_SESSION_CLEAR_FAILED:auth_derived_activity',
    );
    expect(h.dependencies.signOut).toHaveBeenCalledOnce();
    expect(h.dependencies.clearAuthDerivedCleanupRequired).not.toHaveBeenCalled();
  });

  it('still attempts sign-out, persisted-session removal, and every cleanup after marker failure', async () => {
    const h = harness();
    h.dependencies.persistInvalidationMarker.mockRejectedValueOnce(
      new Error('storage unavailable'),
    );

    await expect(clearRejectedSessionActivity(h.dependencies)).rejects.toThrow(
      'REJECTED_SESSION_CLEAR_FAILED:invalidation_marker',
    );
    expect(h.dependencies.signOut).toHaveBeenCalledOnce();
    expect(h.dependencies.clearPersistedSession).toHaveBeenCalledOnce();
    expect(h.dependencies.clearAuthDerivedActivity).toHaveBeenCalledOnce();
  });

  it('attempts owner-bound local erasure even when sign-out fails', async () => {
    const h = harness();
    h.dependencies.signOut.mockRejectedValueOnce(new Error('session transport failed'));

    await expect(clearRejectedSessionActivity(h.dependencies)).rejects.toThrow(
      'REJECTED_SESSION_CLEAR_FAILED:sign_out',
    );
    expect(h.dependencies.clearPersistedSession).toHaveBeenCalledOnce();
    expect(h.dependencies.clearAccountIsolatedState).toHaveBeenCalledOnce();
    expect(h.dependencies.clearAuthDerivedActivity).toHaveBeenCalledOnce();
  });

  it('aggregates required failures without leaking provider details', async () => {
    const h = harness();
    h.dependencies.signOut.mockRejectedValueOnce(new Error('private remote detail'));
    h.dependencies.clearPersistedSession.mockRejectedValueOnce(new Error('private key detail'));

    await expect(clearRejectedSessionActivity(h.dependencies)).rejects.toThrow(
      'REJECTED_SESSION_CLEAR_FAILED:sign_out,persisted_session',
    );
    expect(h.dependencies.clearAuthDerivedActivity).toHaveBeenCalledOnce();
  });
});
