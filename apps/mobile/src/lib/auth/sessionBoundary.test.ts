import { describe, expect, it } from 'vitest';

import {
  latestSessionForCompletedBoundary,
  shouldClearLocalPrivateDataForSessionChange,
} from './sessionBoundary';

describe('auth session boundary', () => {
  it('does not wipe local private data during initial restore or first sign-in', () => {
    expect(shouldClearLocalPrivateDataForSessionChange(null, null)).toBe(false);
    expect(shouldClearLocalPrivateDataForSessionChange(null, 'user-a')).toBe(false);
    expect(shouldClearLocalPrivateDataForSessionChange(null, 'user-a', 'unclaimed')).toBe(false);
    expect(shouldClearLocalPrivateDataForSessionChange(null, 'user-a', 'match')).toBe(false);
  });

  it('keeps local private data when Supabase refreshes the same user session', () => {
    expect(shouldClearLocalPrivateDataForSessionChange('user-a', 'user-a')).toBe(false);
  });

  it('wipes local private data when a known session signs out or changes user id', () => {
    expect(shouldClearLocalPrivateDataForSessionChange('user-a', null)).toBe(true);
    expect(shouldClearLocalPrivateDataForSessionChange('user-a', 'user-b')).toBe(true);
  });

  it('wipes local private data when the persisted owner belongs to another user', () => {
    expect(shouldClearLocalPrivateDataForSessionChange(null, null, 'mismatch')).toBe(true);
    expect(shouldClearLocalPrivateDataForSessionChange(null, 'user-b', 'mismatch')).toBe(true);
    expect(shouldClearLocalPrivateDataForSessionChange('user-b', 'user-b', 'mismatch')).toBe(true);
  });

  it('publishes the latest same-user session without accepting a different target', () => {
    const older = { accessToken: 'older', user: { id: 'user-a' } };
    const refreshed = { accessToken: 'refreshed', user: { id: 'user-a' } };
    const other = { accessToken: 'other', user: { id: 'user-b' } };

    expect(latestSessionForCompletedBoundary(refreshed, older, 'user-a')).toBe(refreshed);
    expect(latestSessionForCompletedBoundary(other, older, 'user-a')).toBe(older);
    expect(latestSessionForCompletedBoundary(null, older, null)).toBeNull();
  });
});
