import { describe, expect, it } from 'vitest';

import { shouldClearLocalPrivateDataForSessionChange } from './sessionBoundary';

describe('auth session boundary', () => {
  it('does not wipe local private data during initial restore or first sign-in', () => {
    expect(shouldClearLocalPrivateDataForSessionChange(null, null)).toBe(false);
    expect(shouldClearLocalPrivateDataForSessionChange(null, 'user-a')).toBe(false);
  });

  it('keeps local private data when Supabase refreshes the same user session', () => {
    expect(shouldClearLocalPrivateDataForSessionChange('user-a', 'user-a')).toBe(false);
  });

  it('wipes local private data when a known session signs out or changes user id', () => {
    expect(shouldClearLocalPrivateDataForSessionChange('user-a', null)).toBe(true);
    expect(shouldClearLocalPrivateDataForSessionChange('user-a', 'user-b')).toBe(true);
  });
});
