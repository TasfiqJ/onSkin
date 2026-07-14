import type { User } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  appleCredentialResultForState,
  checkAppleCredentialForSession,
  getAppleCredentialSubject,
  monitorAppleCredentialLifecycle,
  type AppleCredentialLifecycleDependencies,
} from './appleCredentialLifecycle';

vi.mock('expo-apple-authentication', () => ({
  AppleAuthenticationCredentialState: {
    AUTHORIZED: 1,
    NOT_FOUND: 2,
    REVOKED: 0,
    TRANSFERRED: 3,
  },
  addRevokeListener: vi.fn(),
  getCredentialStateAsync: vi.fn(),
}));

vi.mock('react-native', () => ({
  AppState: { addEventListener: vi.fn() },
  Platform: { OS: 'ios' },
}));

const AUTHORIZED = 1;
const NOT_FOUND = 2;
const REVOKED = 0;
const TRANSFERRED = 3;

function appleUser(
  identities: Record<string, unknown>[] = [
    { id: 'fallback-id', identity_data: { sub: 'apple-user-1' }, provider: 'apple' },
  ],
): User {
  return {
    app_metadata: { provider: 'apple', providers: ['apple'] },
    aud: 'authenticated',
    created_at: '2026-07-13T00:00:00.000Z',
    id: 'supabase-user-1',
    identities,
    user_metadata: {},
  } as unknown as User;
}

function nonAppleUser(): User {
  return {
    ...appleUser([]),
    app_metadata: { provider: 'email', providers: ['email'] },
  };
}

function dependencies(platformOS = 'ios') {
  let appStateListener: ((state: 'active' | 'background') => void) | null = null;
  let revokeListener: (() => void) | null = null;
  const removeAppState = vi.fn();
  const removeRevoke = vi.fn();
  const getCredentialState = vi.fn();
  const deps: AppleCredentialLifecycleDependencies = {
    addAppStateListener: vi.fn((listener) => {
      appStateListener = listener as typeof appStateListener;
      return { remove: removeAppState };
    }),
    addRevokeListener: vi.fn((listener) => {
      revokeListener = listener;
      return { remove: removeRevoke };
    }),
    getCredentialState,
    platformOS,
  };
  return {
    appState: (state: 'active' | 'background') => appStateListener?.(state),
    deps,
    getCredentialState,
    removeAppState,
    removeRevoke,
    revoke: () => revokeListener?.(),
  };
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('Apple credential lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses one exact trimmed Apple subject and rejects conflicting identity bindings', () => {
    expect(
      getAppleCredentialSubject(
        appleUser([
          { id: 'fallback', identity_data: { sub: ' apple-user-1 ' }, provider: 'apple' },
          { id: 'apple-user-1', identity_data: {}, provider: 'apple' },
        ]),
      ),
    ).toBe('apple-user-1');
    expect(
      getAppleCredentialSubject(
        appleUser([
          { id: 'first', identity_data: { sub: 'apple-user-1' }, provider: 'apple' },
          { id: 'second', identity_data: { sub: 'apple-user-2' }, provider: 'apple' },
        ]),
      ),
    ).toBeNull();
  });

  it('allows authorized/transferred, invalidates revoked/not-found, and blocks unknown states', () => {
    expect(appleCredentialResultForState(AUTHORIZED)).toEqual({ status: 'valid' });
    expect(appleCredentialResultForState(TRANSFERRED)).toEqual({ status: 'valid' });
    expect(appleCredentialResultForState(REVOKED)).toEqual({
      reason: 'credential_revoked',
      status: 'invalid',
    });
    expect(appleCredentialResultForState(NOT_FOUND)).toEqual({
      reason: 'credential_not_found',
      status: 'invalid',
    });
    expect(appleCredentialResultForState(999 as never)).toEqual({
      reason: 'credential_state_unknown',
      status: 'blocked',
    });
  });

  it('provides a side-effect-free pre-publication credential check', async () => {
    const harness = dependencies();
    harness.getCredentialState.mockResolvedValueOnce(AUTHORIZED);
    await expect(checkAppleCredentialForSession(appleUser(), harness.deps)).resolves.toEqual({
      status: 'valid',
    });
    expect(harness.getCredentialState).toHaveBeenCalledWith('apple-user-1');

    harness.getCredentialState.mockRejectedValueOnce(new Error('simulator unsupported'));
    await expect(checkAppleCredentialForSession(appleUser(), harness.deps)).resolves.toEqual({
      reason: 'credential_check_failed',
      status: 'blocked',
    });

    await expect(checkAppleCredentialForSession(nonAppleUser(), harness.deps)).resolves.toEqual({
      status: 'not_applicable',
    });
  });

  it('checks immediately and at foreground without overlapping checks', async () => {
    const harness = dependencies();
    let resolveFirst!: (state: number) => void;
    harness.getCredentialState.mockReturnValueOnce(
      new Promise<number>((resolve) => {
        resolveFirst = resolve;
      }),
    );
    const blocked = vi.fn();
    const invalid = vi.fn();

    const stop = monitorAppleCredentialLifecycle(
      appleUser(),
      { onCredentialCheckBlocked: blocked, onCredentialInvalid: invalid },
      harness.deps,
    );
    expect(harness.getCredentialState).toHaveBeenCalledOnce();
    expect(harness.getCredentialState).toHaveBeenCalledWith('apple-user-1');

    harness.appState('active');
    expect(harness.getCredentialState).toHaveBeenCalledOnce();
    resolveFirst(AUTHORIZED);
    await flushPromises();

    harness.getCredentialState.mockResolvedValueOnce(TRANSFERRED);
    harness.appState('background');
    harness.appState('active');
    await flushPromises();
    expect(harness.getCredentialState).toHaveBeenCalledTimes(2);
    expect(blocked).not.toHaveBeenCalled();
    expect(invalid).not.toHaveBeenCalled();

    stop();
    expect(harness.removeAppState).toHaveBeenCalledOnce();
    expect(harness.removeRevoke).toHaveBeenCalledOnce();
  });

  it.each([
    [REVOKED, 'credential_revoked'],
    [NOT_FOUND, 'credential_not_found'],
  ])('invalidates exactly once for confirmed state %s', async (state, reason) => {
    const harness = dependencies();
    harness.getCredentialState.mockResolvedValue(state);
    const blocked = vi.fn();
    const invalid = vi.fn();

    monitorAppleCredentialLifecycle(
      appleUser(),
      { onCredentialCheckBlocked: blocked, onCredentialInvalid: invalid },
      harness.deps,
    );
    await flushPromises();
    harness.revoke();

    expect(invalid).toHaveBeenCalledOnce();
    expect(invalid).toHaveBeenCalledWith(reason);
    expect(blocked).not.toHaveBeenCalled();
  });

  it.each([
    [999, 'credential_state_unknown'],
    ['error', 'credential_check_failed'],
  ])('blocks and does not invent revocation for %s', async (state, reason) => {
    const harness = dependencies();
    if (state === 'error') {
      harness.getCredentialState.mockRejectedValueOnce(new Error('native check failed'));
    } else {
      harness.getCredentialState.mockResolvedValueOnce(state);
    }
    const blocked = vi.fn();
    const invalid = vi.fn();

    monitorAppleCredentialLifecycle(
      appleUser(),
      { onCredentialCheckBlocked: blocked, onCredentialInvalid: invalid },
      harness.deps,
    );
    await flushPromises();

    expect(blocked).toHaveBeenCalledOnce();
    expect(blocked).toHaveBeenCalledWith(reason);
    expect(invalid).not.toHaveBeenCalled();
  });

  it('invalidates immediately and only once for the native revoke notification', async () => {
    const harness = dependencies();
    harness.getCredentialState.mockResolvedValue(AUTHORIZED);
    const blocked = vi.fn();
    const invalid = vi.fn();

    monitorAppleCredentialLifecycle(
      appleUser(),
      { onCredentialCheckBlocked: blocked, onCredentialInvalid: invalid },
      harness.deps,
    );
    harness.revoke();
    harness.revoke();
    await flushPromises();

    expect(invalid).toHaveBeenCalledOnce();
    expect(invalid).toHaveBeenCalledWith('revoked_notification');
    expect(blocked).not.toHaveBeenCalled();
  });

  it('fails closed when an authenticated Apple identity has no unambiguous subject', async () => {
    const harness = dependencies();
    const blocked = vi.fn();
    const invalid = vi.fn();

    monitorAppleCredentialLifecycle(
      appleUser([{ id: '  ', identity_data: { sub: '' }, provider: 'apple' }]),
      { onCredentialCheckBlocked: blocked, onCredentialInvalid: invalid },
      harness.deps,
    );
    await flushPromises();

    expect(invalid).toHaveBeenCalledWith('apple_subject_unavailable');
    expect(blocked).not.toHaveBeenCalled();
    expect(harness.getCredentialState).not.toHaveBeenCalled();
  });

  it('does nothing for non-iOS or non-Apple sessions', () => {
    const nonIos = dependencies('web');
    monitorAppleCredentialLifecycle(
      appleUser(),
      { onCredentialCheckBlocked: vi.fn(), onCredentialInvalid: vi.fn() },
      nonIos.deps,
    );
    expect(nonIos.getCredentialState).not.toHaveBeenCalled();
    expect(nonIos.deps.addRevokeListener).not.toHaveBeenCalled();

    const nonApple = dependencies();
    monitorAppleCredentialLifecycle(
      nonAppleUser(),
      { onCredentialCheckBlocked: vi.fn(), onCredentialInvalid: vi.fn() },
      nonApple.deps,
    );
    expect(nonApple.getCredentialState).not.toHaveBeenCalled();
    expect(nonApple.deps.addRevokeListener).not.toHaveBeenCalled();
  });

  it('blocks if the supported native revoke subscription cannot be installed', async () => {
    const harness = dependencies();
    vi.mocked(harness.deps.addRevokeListener).mockImplementationOnce(() => {
      throw new Error('native event unavailable');
    });
    const blocked = vi.fn();

    monitorAppleCredentialLifecycle(
      appleUser(),
      { onCredentialCheckBlocked: blocked, onCredentialInvalid: vi.fn() },
      harness.deps,
    );
    await flushPromises();

    expect(blocked).toHaveBeenCalledWith('credential_check_failed');
    expect(harness.getCredentialState).not.toHaveBeenCalled();
  });
});
