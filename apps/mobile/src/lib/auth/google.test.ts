import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getGoogleIdToken } from './google';

const mocks = vi.hoisted(() => ({
  configure: vi.fn(),
  hasPlayServices: vi.fn(),
  signIn: vi.fn(),
}));

vi.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: mocks.configure,
    hasPlayServices: mocks.hasPlayServices,
    signIn: mocks.signIn,
  },
}));

describe('Google sign-in helper', () => {
  beforeEach(() => {
    mocks.configure.mockClear();
    mocks.hasPlayServices.mockReset();
    mocks.signIn.mockReset();
  });

  it('rechecks request ownership after Play Services and the native Google prompt', async () => {
    mocks.hasPlayServices.mockResolvedValueOnce(true);
    mocks.signIn.mockResolvedValueOnce({
      data: {
        idToken: 'google-token',
        user: { email: 'user@example.com' },
      },
      type: 'success',
    });
    const assertRequestCurrent = vi.fn();

    await expect(getGoogleIdToken(assertRequestCurrent)).resolves.toEqual({
      email: 'user@example.com',
      idToken: 'google-token',
    });
    expect(assertRequestCurrent).toHaveBeenCalledTimes(2);
  });

  it('does not open the Google prompt when ownership changes during Play Services await', async () => {
    mocks.hasPlayServices.mockResolvedValueOnce(true);
    const assertRequestCurrent = vi.fn(() => {
      throw new Error('request superseded');
    });

    await expect(getGoogleIdToken(assertRequestCurrent)).rejects.toThrow('request superseded');
    expect(assertRequestCurrent).toHaveBeenCalledTimes(1);
    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  it('rejects a late Google result when ownership changes while the prompt is open', async () => {
    mocks.hasPlayServices.mockResolvedValueOnce(true);
    mocks.signIn.mockResolvedValueOnce({
      data: {
        idToken: 'late-token',
        user: { email: 'user@example.com' },
      },
      type: 'success',
    });
    let assertionCount = 0;

    await expect(
      getGoogleIdToken(() => {
        assertionCount += 1;
        if (assertionCount === 2) throw new Error('request superseded');
      }),
    ).rejects.toThrow('request superseded');
    expect(mocks.signIn).toHaveBeenCalledTimes(1);
  });

  it('returns null for native cancellation without exposing a token', async () => {
    mocks.hasPlayServices.mockResolvedValueOnce(true);
    mocks.signIn.mockResolvedValueOnce({ type: 'cancelled' });

    await expect(getGoogleIdToken()).resolves.toBeNull();
  });
});
