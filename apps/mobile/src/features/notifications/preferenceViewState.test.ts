import { describe, expect, it } from 'vitest';

import type { NotifPrefs, NotifPrefsRead } from './store';
import { resolveNotificationPreferenceViewState } from './preferenceViewState';

const prefs = { amEnabled: false } as NotifPrefs;

describe('notification preference route state', () => {
  it('shows loading before the local read settles and recovery after a query failure', () => {
    expect(resolveNotificationPreferenceViewState(undefined)).toEqual({ status: 'loading' });
    expect(resolveNotificationPreferenceViewState(undefined, true)).toEqual({
      status: 'unavailable',
    });
  });

  it.each([
    { status: 'absent', prefs },
    { status: 'available', prefs, format: 'current' },
  ] as const)('exposes controls only for $status preferences', (read) => {
    expect(resolveNotificationPreferenceViewState(read)).toEqual({ status: 'ready', prefs });
  });

  it.each([
    { status: 'unavailable', prefs: null, reason: 'storage_unavailable' },
    { status: 'corrupt', prefs: null, reason: 'invalid_payload' },
    { status: 'unsupported_version', prefs: null },
  ] as const)('hides synthetic controls for $status preferences', (read) => {
    expect(resolveNotificationPreferenceViewState(read as NotifPrefsRead)).toEqual({
      status: 'unavailable',
    });
  });
});
