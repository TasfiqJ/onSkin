import type { User } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getAppleAuthorizationCodeForRevocation, getAppleIdToken } from './apple';

const mocks = vi.hoisted(() => ({
  addRevokeListener: vi.fn(),
  getCredentialStateAsync: vi.fn(),
  isAvailableAsync: vi.fn(),
  refreshAsync: vi.fn(),
  signInAsync: vi.fn(),
}));

vi.mock('expo-apple-authentication', () => ({
  AppleAuthenticationCredentialState: {
    AUTHORIZED: 1,
    NOT_FOUND: 2,
    REVOKED: 0,
    TRANSFERRED: 3,
  },
  AppleAuthenticationScope: {
    EMAIL: 'EMAIL',
    FULL_NAME: 'FULL_NAME',
  },
  addRevokeListener: mocks.addRevokeListener,
  getCredentialStateAsync: mocks.getCredentialStateAsync,
  isAvailableAsync: mocks.isAvailableAsync,
  refreshAsync: mocks.refreshAsync,
  signInAsync: mocks.signInAsync,
}));

vi.mock('react-native', () => ({
  AppState: { addEventListener: vi.fn() },
  Platform: { OS: 'ios' },
}));

function userWithAppleIdentity(identity: Record<string, unknown> | null): User {
  return {
    id: 'user-1',
    app_metadata: {},
    aud: 'authenticated',
    created_at: '2026-07-07T00:00:00.000Z',
    user_metadata: {},
    identities: identity
      ? [
          {
            provider: 'apple',
            ...identity,
          },
        ]
      : [],
  } as unknown as User;
}

describe('Sign in with Apple helpers', () => {
  beforeEach(() => {
    mocks.addRevokeListener.mockReset();
    mocks.getCredentialStateAsync.mockReset();
    mocks.isAvailableAsync.mockReset();
    mocks.refreshAsync.mockReset();
    mocks.signInAsync.mockReset();
  });

  it('normalizes Apple sign-in token and first-run email before Supabase receives them', async () => {
    mocks.signInAsync.mockResolvedValueOnce({
      email: ' user@example.com ',
      identityToken: ' token-1 ',
    });

    await expect(getAppleIdToken()).resolves.toEqual({
      email: 'user@example.com',
      idToken: 'token-1',
    });
  });

  it('rejects blank Apple identity tokens instead of starting a Supabase sign-in', async () => {
    mocks.signInAsync.mockResolvedValueOnce({
      email: 'user@example.com',
      identityToken: '   ',
    });

    await expect(getAppleIdToken()).resolves.toBeNull();
  });

  it('refreshes a revocation code with a trimmed Apple subject', async () => {
    mocks.isAvailableAsync.mockResolvedValueOnce(true);
    mocks.refreshAsync.mockResolvedValueOnce({ authorizationCode: ' code-1 ' });

    const user = userWithAppleIdentity({
      id: 'fallback-id',
      identity_data: { sub: ' apple-subject ' },
    });

    await expect(getAppleAuthorizationCodeForRevocation(user)).resolves.toBe('code-1');
    expect(mocks.refreshAsync).toHaveBeenCalledWith({ user: 'apple-subject' });
  });

  it('falls back to a trimmed Apple identity id when identity data has no subject', async () => {
    mocks.isAvailableAsync.mockResolvedValueOnce(true);
    mocks.refreshAsync.mockResolvedValueOnce({ authorizationCode: 'code-2' });

    const user = userWithAppleIdentity({
      id: ' apple-identity-id ',
      identity_data: { sub: '   ' },
    });

    await expect(getAppleAuthorizationCodeForRevocation(user)).resolves.toBe('code-2');
    expect(mocks.refreshAsync).toHaveBeenCalledWith({ user: 'apple-identity-id' });
  });

  it('does not call Apple refresh for blank or missing Apple subjects', async () => {
    const user = userWithAppleIdentity({
      id: '   ',
      identity_data: { sub: '   ' },
    });

    await expect(getAppleAuthorizationCodeForRevocation(user)).resolves.toBeNull();
    expect(mocks.isAvailableAsync).not.toHaveBeenCalled();
    expect(mocks.refreshAsync).not.toHaveBeenCalled();
  });

  it('does not refresh when multiple Apple identities bind to conflicting subjects', async () => {
    const user = {
      ...userWithAppleIdentity(null),
      identities: [
        { id: 'one', identity_data: { sub: 'apple-one' }, provider: 'apple' },
        { id: 'two', identity_data: { sub: 'apple-two' }, provider: 'apple' },
      ],
    } as unknown as User;

    await expect(getAppleAuthorizationCodeForRevocation(user)).resolves.toBeNull();
    expect(mocks.isAvailableAsync).not.toHaveBeenCalled();
    expect(mocks.refreshAsync).not.toHaveBeenCalled();
  });

  it('returns no revocation code when Apple is unavailable or returns a blank code', async () => {
    mocks.isAvailableAsync.mockResolvedValueOnce(false);
    await expect(
      getAppleAuthorizationCodeForRevocation(
        userWithAppleIdentity({ id: 'apple-id', identity_data: {} }),
      ),
    ).resolves.toBeNull();
    expect(mocks.refreshAsync).not.toHaveBeenCalled();

    mocks.isAvailableAsync.mockResolvedValueOnce(true);
    mocks.refreshAsync.mockResolvedValueOnce({ authorizationCode: '   ' });
    await expect(
      getAppleAuthorizationCodeForRevocation(
        userWithAppleIdentity({ id: 'apple-id', identity_data: {} }),
      ),
    ).resolves.toBeNull();
  });
});
