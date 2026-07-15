import {
  AuthApiError,
  AuthInvalidTokenResponseError,
  AuthRefreshDiscardedError,
  AuthSessionMissingError,
  AuthUnknownError,
} from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

import {
  createSupabaseAuthRefreshProtectiveFetch,
  isDefinitiveSupabaseRefreshRejection,
  parseSupabaseAccessTokenClaims,
  SupabaseAuthRefreshProtectionError,
} from './authRefreshProtection';

const SUPABASE_URL = 'https://project.supabase.co';
const REFRESH_URL = `${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`;

function jwt(subject = 'user-a', sessionId = 'session-a'): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ exp: 4_000_000_000, session_id: sessionId, sub: subject }),
  ).toString('base64url');
  return `${header}.${payload}.signature`;
}

function validSessionResponse(): Response {
  return Response.json({
    access_token: jwt(),
    expires_in: 3600,
    refresh_token: 'rotated-refresh-token',
    token_type: 'bearer',
    user: { id: 'user-a' },
  });
}

function protectedFetch(response: Response) {
  const fetchImplementation = vi.fn(async () => response);
  return {
    fetchImplementation,
    run: createSupabaseAuthRefreshProtectiveFetch({
      fetchImplementation,
      supabaseUrl: SUPABASE_URL,
    }),
  };
}

describe('Supabase auth refresh protective fetch', () => {
  it('returns only the bounded subject, session, and expiry claims used by controlled refresh', () => {
    expect(parseSupabaseAccessTokenClaims(jwt('user-a', 'session-a'))).toEqual({
      subject: 'user-a',
      sessionId: 'session-a',
      expiresAt: 4_000_000_000,
    });
    expect(parseSupabaseAccessTokenClaims('not-a-jwt')).toBeNull();
    expect(parseSupabaseAccessTokenClaims(null)).toBeNull();
  });

  it('passes through a structurally valid, binding-consistent refresh response', async () => {
    const response = validSessionResponse();
    const { run } = protectedFetch(response);

    await expect(run(REFRESH_URL, { method: 'POST' })).resolves.toBe(response);
    await expect(response.json()).resolves.toMatchObject({
      refresh_token: 'rotated-refresh-token',
    });
  });

  it.each([
    {},
    { access_token: jwt(), expires_in: 3600, refresh_token: 'next' },
    {
      access_token: jwt('foreign-user'),
      expires_in: 3600,
      refresh_token: 'next',
      user: { id: 'user-a' },
    },
    {
      access_token: 'not-a-jwt',
      expires_in: 3600,
      refresh_token: 'next',
      user: { id: 'user-a' },
    },
    {
      access_token: jwt(),
      expires_in: 0,
      refresh_token: 'next',
      user: { id: 'user-a' },
    },
  ])('rejects malformed or incomplete 2xx session payload %#', async (payload) => {
    const { run } = protectedFetch(Response.json(payload));

    await expect(run(REFRESH_URL)).rejects.toMatchObject({
      code: 'invalid_success_response',
      name: 'SupabaseAuthRefreshProtectionError',
    });
  });

  it('rejects a non-JSON 2xx response as ambiguous instead of exposing it to auth-js', async () => {
    const { run } = protectedFetch(new Response('gateway HTML', { status: 200 }));

    await expect(run(REFRESH_URL)).rejects.toBeInstanceOf(SupabaseAuthRefreshProtectionError);
  });

  it.each([429, 400, 500, 501, 502, 503, 504, 520, 524, 530])(
    'throws for a non-definitive %s refresh response',
    async (status) => {
      const { run } = protectedFetch(
        Response.json({ code: 'unexpected_failure', message: 'redacted' }, { status }),
      );

      await expect(run(REFRESH_URL)).rejects.toMatchObject({
        code: 'ambiguous_error_response',
      });
    },
  );

  it.each([
    'refresh_token_not_found',
    'refresh_token_already_used',
    'session_expired',
    'session_not_found',
    'user_banned',
    'user_not_found',
  ])('passes through exact terminal code %s', async (code) => {
    const response = Response.json({ code, message: 'terminal' }, { status: 400 });
    const { run } = protectedFetch(response);

    await expect(run(REFRESH_URL)).resolves.toBe(response);
  });

  it.each([429, 500, 503])(
    'keeps an exact terminal-looking code ambiguous on degraded status %s',
    async (status) => {
      const response = Response.json(
        { code: 'user_not_found', message: 'terminal-looking' },
        { status },
      );
      await expect(protectedFetch(response).run(REFRESH_URL)).rejects.toMatchObject({
        code: 'ambiguous_error_response',
      });
    },
  );

  it('supports the legacy error_code field only for an exact terminal code', async () => {
    const terminal = Response.json(
      { error_code: 'refresh_token_not_found', message: 'terminal' },
      { status: 400 },
    );
    await expect(protectedFetch(terminal).run(REFRESH_URL)).resolves.toBe(terminal);

    const ambiguous = Response.json(
      { error_code: 'validation_failed', message: 'ambiguous' },
      { status: 400 },
    );
    await expect(protectedFetch(ambiguous).run(REFRESH_URL)).rejects.toMatchObject({
      code: 'ambiguous_error_response',
    });
  });

  it('rejects malformed error bodies without logging or trusting their status', async () => {
    const { run } = protectedFetch(new Response('<html>failure</html>', { status: 500 }));

    await expect(run(REFRESH_URL)).rejects.toMatchObject({
      code: 'ambiguous_error_response',
    });
  });

  it('recognizes Request input and leaves non-refresh or external URLs untouched', async () => {
    const refreshResponse = validSessionResponse();
    const refresh = protectedFetch(refreshResponse);
    await expect(
      runRequest(refresh.run, new Request(REFRESH_URL, { method: 'POST' })),
    ).resolves.toBe(refreshResponse);

    const malformed = new Response('not json');
    const passthrough = protectedFetch(malformed);
    await expect(passthrough.run(`${SUPABASE_URL}/rest/v1/items`)).resolves.toBe(malformed);

    const external = new Response('not json');
    await expect(
      protectedFetch(external).run(
        'https://attacker.example/auth/v1/token?grant_type=refresh_token',
      ),
    ).resolves.toBe(external);
  });

  it('does not classify duplicate refresh grant parameters as an exact refresh request', async () => {
    const response = new Response('not json');
    await expect(
      protectedFetch(response).run(
        `${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token&grant_type=refresh_token`,
      ),
    ).resolves.toBe(response);
  });

  it('decodes a valid session without relying on a global atob polyfill', async () => {
    const originalAtob = globalThis.atob;
    Object.defineProperty(globalThis, 'atob', {
      configurable: true,
      value: () => {
        throw new Error('atob unavailable');
      },
    });
    try {
      const response = validSessionResponse();
      await expect(protectedFetch(response).run(REFRESH_URL)).resolves.toBe(response);
    } finally {
      Object.defineProperty(globalThis, 'atob', {
        configurable: true,
        value: originalAtob,
      });
    }
  });
});

function runRequest(
  implementation: ReturnType<typeof createSupabaseAuthRefreshProtectiveFetch>,
  request: Request,
) {
  return implementation(request);
}

describe('definitive refresh rejection policy', () => {
  it.each([
    'refresh_token_not_found',
    'refresh_token_already_used',
    'session_expired',
    'session_not_found',
    'user_banned',
    'user_not_found',
  ])('accepts exact AuthApiError code %s', (code) => {
    expect(isDefinitiveSupabaseRefreshRejection(new AuthApiError('terminal', 400, code))).toBe(
      true,
    );
  });

  it('accepts AuthSessionMissingError after the protective fetch validated the response path', () => {
    expect(isDefinitiveSupabaseRefreshRejection(new AuthSessionMissingError())).toBe(true);
  });

  it.each([
    new AuthApiError('rate limited', 429, 'over_request_rate_limit'),
    new AuthApiError('degraded', 500, 'unexpected_failure'),
    new AuthApiError('unknown', 400, 'future_code'),
    new AuthApiError('invalid', 400, 'invalid_credentials'),
    new AuthUnknownError('unknown response', new Error('malformed upstream response')),
    new AuthInvalidTokenResponseError(),
    new AuthRefreshDiscardedError(),
    new Error('network'),
  ])('keeps ambiguous error %# retryable/local', (error) => {
    expect(isDefinitiveSupabaseRefreshRejection(error)).toBe(false);
  });
});
