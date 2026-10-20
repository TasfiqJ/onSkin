import { afterEach, describe, expect, it, vi } from 'vitest';

import { accountIsolationE2EEvent, accountIsolationE2EPreflightTransport, getAccountIsolationE2EFixture } from './accountIsolationE2E';

vi.mock('@/lib/env', () => ({ env: { appEnvironment: 'development' }, isSupabaseConfigured: false }));
vi.mock('react-native', () => ({ Platform: { OS: 'web' } }));

afterEach(() => {
  delete process.env.EXPO_PUBLIC_E2E_ACCOUNT_ISOLATION;
  vi.unstubAllGlobals();
});

describe('account isolation E2E fixture', () => {
  it('provides a permanent synthetic session only in the explicit development mode', () => {
    process.env.EXPO_PUBLIC_E2E_ACCOUNT_ISOLATION = 'signout_clear_retry';

    const fixture = getAccountIsolationE2EFixture(true, 'development', false, 'web');

    expect(fixture).toMatchObject({
      clearDelayMs: 700,
      clearFailures: 2,
      mode: 'signout_clear_retry',
      session: {
        user: {
          email: 'tas.account-a.e2e@example.com',
          id: '00000000-0000-4000-8000-0000000000a1',
          is_anonymous: false,
        },
      },
    });
    expect(getAccountIsolationE2EFixture(false, 'development', false, 'web')).toBeNull();
    expect(getAccountIsolationE2EFixture(true, 'production', false, 'web')).toBeNull();
    expect(getAccountIsolationE2EFixture(true, 'development', true, 'web')).toBeNull();
  });

  it('stays disabled for missing or unknown values', () => {
    expect(getAccountIsolationE2EFixture(true, 'development', false, 'web')).toBeNull();
    process.env.EXPO_PUBLIC_E2E_ACCOUNT_ISOLATION = 'unknown';
    expect(getAccountIsolationE2EFixture(true, 'development', false, 'web')).toBeNull();
  });
});

describe('cross-owner fixture environment refusal', () => {
  it.each(['cross_owner', 'signout_clear_retry'])('gates %s to DEV/web/development/unconfigured', mode => {
    process.env.EXPO_PUBLIC_E2E_ACCOUNT_ISOLATION = mode;
    expect(getAccountIsolationE2EFixture(true, 'development', false, 'web')?.mode).toBe(mode);
    expect(getAccountIsolationE2EFixture(false, 'development', false, 'web')).toBeNull();
    expect(getAccountIsolationE2EFixture(true, 'staging', false, 'web')).toBeNull();
    expect(getAccountIsolationE2EFixture(true, 'production', false, 'web')).toBeNull();
    expect(getAccountIsolationE2EFixture(true, 'development', true, 'web')).toBeNull();
    expect(getAccountIsolationE2EFixture(true, 'development', false, 'ios')).toBeNull();
    expect(getAccountIsolationE2EFixture(true, 'development', false, 'android')).toBeNull();
  });
});

it('accepts a canonical Request from the real gate and rejects a stale candidate bearer', async () => {
  vi.stubGlobal('__DEV__', true);
  vi.stubGlobal('localStorage', { getItem: (key: string) => state.get(key) ?? null, setItem: (key: string, value: string) => state.set(key, value) });
  const state = new Map<string, string>();
  process.env.EXPO_PUBLIC_E2E_ACCOUNT_ISOLATION = 'cross_owner';
  const a = accountIsolationE2EEvent('a');
  const transport = accountIsolationE2EPreflightTransport()!;
  const request = (token: string) => new Request('https://blocked-supabase-url.invalid/functions/v1/account-deletion', {
    method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ action: 'preflight' }),
  });
  expect(await (await transport(request(a.access_token))).json()).toEqual({ status: 'clear', ownerSubject: a.user.id });
  const b = accountIsolationE2EEvent('b');
  expect((await transport(request(a.access_token))).status).toBe(401);
  expect(await (await transport(request(b.access_token))).json()).toEqual({ status: 'clear', ownerSubject: b.user.id });
  delete process.env.EXPO_PUBLIC_E2E_ACCOUNT_ISOLATION;
  expect(accountIsolationE2EPreflightTransport()).toBeUndefined();
  expect(() => accountIsolationE2EEvent('a')).toThrow('DISABLED');
});
