import { describe, expect, it } from 'vitest';

import { shouldLockForAppState, shouldShowPrivacyShieldForAppState } from './privacyState';

describe('app privacy state', () => {
  it('shows the privacy shield whenever the app is not active', () => {
    expect(shouldShowPrivacyShieldForAppState('active')).toBe(false);
    expect(shouldShowPrivacyShieldForAppState('inactive')).toBe(true);
    expect(shouldShowPrivacyShieldForAppState('background')).toBe(true);
    expect(shouldShowPrivacyShieldForAppState('unknown')).toBe(true);
  });

  it('locks on inactive/background transitions only when biometric app lock is enabled', () => {
    expect(shouldLockForAppState('inactive', true)).toBe(true);
    expect(shouldLockForAppState('background', true)).toBe(true);
    expect(shouldLockForAppState('active', true)).toBe(false);
    expect(shouldLockForAppState('inactive', false)).toBe(false);
  });
});
