import type { User } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getAppleAuthorizationCodeForRevocation, getAppleIdToken } from './apple';

const mocks = vi.hoisted(() => ({
  addRevokeListener: vi.fn(),
  digestStringAsync: vi.fn(),
  getCredentialStateAsync: vi.fn(),
  getRandomBytesAsync: vi.fn(),
  isAvailableAsync: vi.fn(),
  refreshAsync: vi.fn(),
  signInAsync: vi.fn(),
}));

vi.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: mocks.digestStringAsync,
  getRandomBytesAsync: mocks.getRandomBytesAsync,
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
    mocks.digestStringAsync.mockReset().mockResolvedValue('a'.repeat(64));
    mocks.getCredentialStateAsync.mockReset();
    mocks.getRandomBytesAsync
      .mockReset()
      .mockResolvedValueOnce(new Uint8Array(32).fill(1))
      .mockResolvedValueOnce(new Uint8Array(32).fill(2));
    mocks.isAvailableAsync.mockReset();
    mocks.refreshAsync.mockReset();
    mocks.signInAsync.mockReset();
  });

  it('binds a 256-bit raw nonce and state to a complete bounded Apple credential', async () => {
    mocks.signInAsync.mockImplementationOnce(async (options: { state?: string }) => ({
      authorizationCode: ' code-1 ',
      email: ' user@example.com ',
      identityToken: ' token-1 ',
      state: options.state,
      user: ' apple-user ',
    }));

    const nonce = 'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE';
    const state = 'AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI';
    await expect(getAppleIdToken()).resolves.toEqual({
      appleUser: 'apple-user',
      authorizationCode: 'code-1',
      email: 'user@example.com',
      idToken: 'token-1',
      nonce,
    });
    expect(mocks.getRandomBytesAsync).toHaveBeenCalledTimes(2);
    expect(mocks.getRandomBytesAsync).toHaveBeenNthCalledWith(1, 32);
    expect(mocks.getRandomBytesAsync).toHaveBeenNthCalledWith(2, 32);
    expect(mocks.digestStringAsync).toHaveBeenCalledWith('SHA-256', nonce);
    expect(mocks.signInAsync).toHaveBeenCalledWith({
      nonce: 'a'.repeat(64),
      requestedScopes: ['EMAIL'],
      state,
    });
  });

  it('treats only the native Apple cancellation code as a neutral result', async () => {
    mocks.signInAsync.mockRejectedValueOnce(
      Object.assign(new Error('The user canceled.'), { code: 'ERR_REQUEST_CANCELED' }),
    );

    await expect(getAppleIdToken()).resolves.toBeNull();

    mocks.getRandomBytesAsync
      .mockResolvedValueOnce(new Uint8Array(32).fill(3))
      .mockResolvedValueOnce(new Uint8Array(32).fill(4));
    mocks.signInAsync.mockRejectedValueOnce(
      Object.assign(new Error('Provider request failed.'), { code: 'ERR_REQUEST_FAILED' }),
    );
    await expect(getAppleIdToken()).rejects.toThrow('Provider request failed.');
  });

  it.each([
    ['identity token', { authorizationCode: 'code-1', identityToken: '   ', user: 'apple-user' }],
    [
      'authorization code',
      { authorizationCode: '   ', identityToken: 'token-1', user: 'apple-user' },
    ],
    ['Apple user', { authorizationCode: 'code-1', identityToken: 'token-1', user: '   ' }],
  ])('rejects a missing %s instead of dispatching a partial credential', async (_label, fields) => {
    mocks.signInAsync.mockImplementationOnce(async (options: { state?: string }) => ({
      email: null,
      state: options.state,
      ...fields,
    }));

    await expect(getAppleIdToken()).rejects.toThrow('invalid credential');
  });

  it('rejects a response whose state is not the exact request state', async () => {
    mocks.signInAsync.mockResolvedValueOnce({
      authorizationCode: 'code-1',
      email: null,
      identityToken: 'token-1',
      state: 'different-state',
      user: 'apple-user',
    });

    await expect(getAppleIdToken()).rejects.toThrow('invalid credential');
  });

  it.each([
    ['identity token', 'identityToken', 16_385],
    ['authorization code', 'authorizationCode', 8_193],
    ['Apple user', 'user', 1_025],
  ])('rejects an oversized %s before it reaches Supabase', async (_label, field, length) => {
    mocks.signInAsync.mockImplementationOnce(async (options: { state?: string }) => ({
      authorizationCode: field === 'authorizationCode' ? 'x'.repeat(length) : 'code-1',
      email: null,
      identityToken: field === 'identityToken' ? 'x'.repeat(length) : 'token-1',
      state: options.state,
      user: field === 'user' ? 'x'.repeat(length) : 'apple-user',
    }));

    await expect(getAppleIdToken()).rejects.toThrow('invalid credential');
  });

  it('fails before opening Apple when native randomness is malformed', async () => {
    mocks.getRandomBytesAsync.mockReset().mockResolvedValue(new Uint8Array(31));

    await expect(getAppleIdToken()).rejects.toThrow('secure request');
    expect(mocks.digestStringAsync).not.toHaveBeenCalled();
    expect(mocks.signInAsync).not.toHaveBeenCalled();
  });

  it('rejects identical nonce and state material before hashing or opening Apple', async () => {
    mocks.getRandomBytesAsync
      .mockReset()
      .mockResolvedValueOnce(new Uint8Array(32).fill(7))
      .mockResolvedValueOnce(new Uint8Array(32).fill(7));

    await expect(getAppleIdToken()).rejects.toThrow('secure request');
    expect(mocks.digestStringAsync).not.toHaveBeenCalled();
    expect(mocks.signInAsync).not.toHaveBeenCalled();
  });

  it('fails before opening Apple when SHA-256 output is malformed', async () => {
    mocks.digestStringAsync.mockResolvedValueOnce('not-a-sha256-digest');

    await expect(getAppleIdToken()).rejects.toThrow('secure request');
    expect(mocks.signInAsync).not.toHaveBeenCalled();
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
