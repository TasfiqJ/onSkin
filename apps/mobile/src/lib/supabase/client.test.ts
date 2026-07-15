import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  isSupabaseControlledRefreshTerminalError,
  readPersistedSupabaseSessionCandidate,
  refreshPersistedSupabaseSessionCandidate,
} from './client';

const h = vi.hoisted(() => {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {},
  });
  return {
    fetch: vi.fn(),
    getUser: vi.fn(),
    values: new Map<string, string>(),
  };
});

vi.mock('react-native-url-polyfill/auto', () => ({}));

vi.mock('../env', () => ({
  env: {
    supabasePublishableKey: 'publishable-key',
    supabaseUrl: 'https://project.supabase.co',
  },
}));

vi.mock('./largeSecureStore', () => ({
  LargeSecureStore: class {
    async getItem(key: string) {
      return h.values.get(key) ?? null;
    }

    async setItem(key: string, value: string) {
      h.values.set(key, value);
    }

    async removeItem(key: string) {
      h.values.delete(key);
    }
  },
}));

vi.mock('./remoteRequestGate', () => ({
  createSupabaseRemoteRequestGatedFetch:
    (transport: typeof fetch) =>
    (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) =>
      transport(input, init),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ auth: { getUser: h.getUser } }),
  isAuthApiError: () => false,
  isAuthSessionMissingError: () => false,
}));

const STORAGE_KEY = 'sb-project-auth-token';
const SUBJECT = '10000000-0000-4000-8000-000000000001';
const SESSION_ID = '20000000-0000-4000-8000-000000000002';

function jwt(): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ exp: 4_000_000_000, session_id: SESSION_ID, sub: SUBJECT }),
  ).toString('base64url');
  return `${header}.${payload}.signature`;
}

function sessionPayload() {
  return {
    access_token: jwt(),
    expires_in: 3600,
    refresh_token: 'rotated-refresh-token',
    token_type: 'bearer',
    user: { id: SUBJECT },
  };
}

describe('controlled Supabase session storage', () => {
  beforeEach(() => {
    h.fetch.mockReset();
    h.getUser.mockReset();
    h.values.clear();
    vi.stubGlobal('fetch', h.fetch);
  });

  it('reads an encrypted candidate without invoking auth-js', async () => {
    h.values.set(STORAGE_KEY, JSON.stringify({ ...sessionPayload(), expires_at: 4_000_000_000 }));

    await expect(readPersistedSupabaseSessionCandidate()).resolves.toMatchObject({
      access_token: jwt(),
      refresh_token: 'rotated-refresh-token',
      user: { id: SUBJECT },
    });
    expect(h.getUser).not.toHaveBeenCalled();
    expect(h.fetch).not.toHaveBeenCalled();
  });

  it.each(['not-json', JSON.stringify({ access_token: 'token' })])(
    'fails closed for invalid encrypted session content %#',
    async (serialized) => {
      h.values.set(STORAGE_KEY, serialized);
      await expect(readPersistedSupabaseSessionCandidate()).rejects.toThrow(
        'SUPABASE_PERSISTED_SESSION_INVALID',
      );
    },
  );

  it('makes one exact refresh request and durably stores validated rotated credentials', async () => {
    h.fetch.mockResolvedValue(Response.json(sessionPayload()));

    const session = await refreshPersistedSupabaseSessionCandidate(
      'current-refresh-token',
      SUBJECT,
    );

    expect(h.fetch).toHaveBeenCalledOnce();
    const [url, init] = h.fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://project.supabase.co/auth/v1/token?grant_type=refresh_token');
    expect(init).toMatchObject({
      body: JSON.stringify({ refresh_token: 'current-refresh-token' }),
      method: 'POST',
      redirect: 'manual',
    });
    expect(session).toMatchObject({
      expires_at: 4_000_000_000,
      refresh_token: 'rotated-refresh-token',
      user: { id: SUBJECT },
    });
    expect(JSON.parse(h.values.get(STORAGE_KEY) ?? '{}')).toMatchObject({
      expires_at: 4_000_000_000,
      refresh_token: 'rotated-refresh-token',
    });
    expect(h.getUser).not.toHaveBeenCalled();
  });

  it('does not replace durable credentials on an exact terminal refresh rejection', async () => {
    const current = JSON.stringify({ ...sessionPayload(), expires_at: 4_000_000_000 });
    h.values.set(STORAGE_KEY, current);
    h.fetch.mockResolvedValue(
      Response.json({ code: 'session_not_found', message: 'terminal' }, { status: 400 }),
    );

    let observed: unknown;
    try {
      await refreshPersistedSupabaseSessionCandidate('current-refresh-token', SUBJECT);
    } catch (error: unknown) {
      observed = error;
    }
    expect(isSupabaseControlledRefreshTerminalError(observed)).toBe(true);
    expect(h.values.get(STORAGE_KEY)).toBe(current);
  });
});
