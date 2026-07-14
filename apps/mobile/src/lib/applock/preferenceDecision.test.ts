import { describe, expect, it } from 'vitest';

import { decideAppLockPreference } from './preferenceDecision';

describe('App Lock preference consumer decisions', () => {
  it.each([
    [{ status: 'absent', enabled: false }, false],
    [{ status: 'available', enabled: false, format: 'current' }, false],
    [{ status: 'available', enabled: true, format: 'current' }, true],
    [{ status: 'available', enabled: true, format: 'legacy' }, true],
  ] as const)('uses proven preference %j exactly', (result, enabled) => {
    expect(decideAppLockPreference(result)).toEqual({
      enabled,
      locked: enabled,
      recovery: null,
    });
  });

  it.each([
    { status: 'corrupt', enabled: null, reason: 'invalid_value' },
    { status: 'corrupt', enabled: null, reason: 'envelope_invalid' },
    { status: 'unsupported_version', enabled: null },
  ] as const)('blocks with authenticated repair only for repairable state %j', (result) => {
    expect(decideAppLockPreference(result)).toEqual({
      enabled: true,
      locked: true,
      recovery: 'repair',
    });
  });

  it.each([
    { status: 'corrupt', enabled: null, reason: 'content_key_invalid' },
    { status: 'corrupt', enabled: null, reason: 'decryption_failed' },
    { status: 'unavailable', enabled: null, reason: 'content_key_missing' },
    { status: 'unavailable', enabled: null, reason: 'content_key_conflict' },
    { status: 'unavailable', enabled: null, reason: 'content_key_storage_unavailable' },
    { status: 'unavailable', enabled: null, reason: 'storage_unavailable' },
    { status: 'unavailable', enabled: null, reason: 'account_boundary' },
  ] as const)('blocks with non-destructive reread recovery for state %j', (result) => {
    expect(decideAppLockPreference(result)).toEqual({
      enabled: true,
      locked: true,
      recovery: 'retry',
    });
  });
});
