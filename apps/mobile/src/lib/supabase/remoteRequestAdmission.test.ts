import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  SUPABASE_REMOTE_REQUEST_BODY_MAX_CHARS,
  SupabaseRemoteRequestAdmissionController,
  classifySupabaseRemoteTarget,
  isSupabaseRemoteRequestAdmissionError,
  parseSupabaseRemoteSessionBinding,
  type SupabaseAccountDeletionAction,
  type SupabaseRemoteRequestAdmissionErrorCode,
  type SupabaseRemoteSessionBinding,
} from './remoteRequestAdmission';

const SUPABASE_URL = 'https://project.supabase.co';
const PUBLIC_KEY = 'sb_publishable_test';
const USER_A = '1111111a-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';
const SESSION_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SESSION_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const REFRESH_A = 'refresh-token-a';
const APPLE_BOOTSTRAP = Object.freeze({
  appleUser: 'apple-subject',
  authorizationCode: 'single-use-authorization-code',
  identityToken: 'apple-identity-token',
  nonce: 'a'.repeat(43),
});

function base64Url(value: string): string {
  return btoa(value).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function base64UrlBytes(bytes: Uint8Array): string {
  return base64Url(String.fromCharCode(...bytes));
}

function token(subject = USER_A, sessionId = SESSION_A, discriminator = 'one'): string {
  return `${base64Url('{"alg":"none"}')}.${base64Url(
    JSON.stringify({ sub: subject, session_id: sessionId, discriminator }),
  )}.${base64Url(discriminator)}`;
}

const TOKEN_A = token();
const TOKEN_A_ROTATED = token(USER_A, SESSION_A, 'rotated');
const TOKEN_B = token(USER_B, SESSION_B, 'two');

function controller(): SupabaseRemoteRequestAdmissionController {
  return new SupabaseRemoteRequestAdmissionController(SUPABASE_URL, {
    publicAuthorizationToken: PUBLIC_KEY,
  });
}

function bearer(accessToken: string): HeadersInit {
  return { Authorization: `Bearer ${accessToken}` };
}

function jsonHeaders(accessToken?: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    ...(accessToken === undefined ? {} : bearer(accessToken)),
  };
}

function activate(
  admission: SupabaseRemoteRequestAdmissionController,
  accessToken = TOKEN_A,
  subject = USER_A,
): SupabaseRemoteSessionBinding {
  admission.setCandidate(accessToken, subject);
  return admission.activate(accessToken, subject);
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function sessionPayload(
  accessToken = TOKEN_A,
  userId = USER_A,
  refreshToken = REFRESH_A,
): Record<string, unknown> {
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: 'bearer',
    expires_in: 3600,
    user: { id: userId },
  };
}

function ordinaryTransport() {
  return vi.fn(async (_input: string | URL | Request, _init?: RequestInit) =>
    jsonResponse({ ok: true }),
  );
}

async function expectCode(
  completion: Promise<unknown>,
  code: SupabaseRemoteRequestAdmissionErrorCode,
): Promise<void> {
  await expect(completion).rejects.toSatisfy((error: unknown) =>
    isSupabaseRemoteRequestAdmissionError(error, code),
  );
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

async function flushUntil(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 100 && !predicate(); attempt += 1) {
    await Promise.resolve();
  }
  expect(predicate()).toBe(true);
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('bounded session binding decoder', () => {
  it('returns a frozen exact subject/session/token binding without atob', () => {
    vi.stubGlobal('atob', undefined);

    const binding = parseSupabaseRemoteSessionBinding(TOKEN_A, USER_A);

    expect(binding).toEqual({ subject: USER_A, sessionId: SESSION_A, accessToken: TOKEN_A });
    expect(Object.isFrozen(binding)).toBe(true);
  });

  it.each([
    ['', USER_A],
    [` ${TOKEN_A}`, USER_A],
    ['header.payload', USER_A],
    ['e30.bad+segment.signature', USER_A],
    [`e30.${base64Url(JSON.stringify({ sub: USER_A }))}.sig`, USER_A],
    [token(USER_A, 'not-a-session'), USER_A],
    [TOKEN_A, USER_B],
    [TOKEN_A, USER_A.toUpperCase()],
  ])('rejects malformed or foreign binding %#', (accessToken, expectedSubject) => {
    expect(parseSupabaseRemoteSessionBinding(accessToken, expectedSubject)).toBeNull();
  });

  it('rejects invalid UTF-8, non-canonical trailing bits, and oversized payloads', () => {
    const invalidUtf8 = `e30.${base64UrlBytes(new Uint8Array([0xff]))}.sig`;
    const nonCanonicalTrailingBits = 'e30.ef.sig';
    const oversized = `e30.${'a'.repeat(8_193)}.sig`;

    expect(parseSupabaseRemoteSessionBinding(invalidUtf8, USER_A)).toBeNull();
    expect(parseSupabaseRemoteSessionBinding(nonCanonicalTrailingBits, USER_A)).toBeNull();
    expect(parseSupabaseRemoteSessionBinding(oversized, USER_A)).toBeNull();
  });
});

describe('strict canonical Supabase URL classification', () => {
  it.each([
    ['/auth/v1/user', 'auth'],
    ['/rest/v1/profiles?select=*', 'rest'],
    ['/storage/v1/object/private/file%20name', 'storage'],
    ['/graphql/v1', 'graphql'],
    ['/realtime/v1/websocket', 'realtime'],
    ['/functions/v1/data-export', 'functions'],
    ['/functions/v1/apple-auth-lifecycle', 'apple_auth_lifecycle'],
    ['/functions/v1/account-deletion', 'account_deletion'],
    ['/future/v99/new-surface', 'unknown'],
  ] as const)('classifies canonical same-origin %s as %s', (path, expected) => {
    expect(classifySupabaseRemoteTarget(`${SUPABASE_URL}${path}`, SUPABASE_URL)).toBe(expected);
  });

  it('distinguishes a clean external origin', () => {
    expect(
      classifySupabaseRemoteTarget('https://external.example/rest/v1/profiles', SUPABASE_URL),
    ).toBe('external');
  });

  it.each([
    'https://project.supabase.co./rest/v1/profiles',
    'https://PROJECT.supabase.co/rest/v1/profiles',
    'https://project.supabase.co:443/rest/v1/profiles',
    'https://project.supabase.co/rest//v1/profiles',
    'https://project.supabase.co/rest/v1/../auth/v1/user',
    'https://project.supabase.co/functions/v1/%61ccount-deletion',
    'https://project.supabase.co/functions/v1/%252E%252E/auth',
    'https://project.supabase.co/functions/v1/%2Faccount-deletion',
    'https://project.supabase.co/functions/v1/%5Caccount-deletion',
    'https://project.supabase.co/functions/v1/%2faccount-deletion',
    'https://project.supabase.co/functions/v1/%ZZ',
    'https://project.supabase.co\\auth\\v1\\user',
    'wss://project.supabase.co/realtime/v1/websocket',
    'ftp://project.supabase.co/rest/v1/profiles',
    '/relative',
  ])('fails an ambiguous/non-canonical target closed: %s', (url) => {
    expect(classifySupabaseRemoteTarget(url, SUPABASE_URL)).toBe('unknown');
  });

  it.each([
    'https://project.supabase.co./',
    'https://PROJECT.supabase.co/',
    'https://project.supabase.co:443/',
    'https://project.supabase.co/path',
    'https://project.supabase.co/?key=value',
  ])('rejects a non-canonical configured origin: %s', (url) => {
    expect(() => new SupabaseRemoteRequestAdmissionController(url)).toThrowError(
      expect.objectContaining({ code: 'SUPABASE_REMOTE_REQUEST_TARGET_REJECTED' }),
    );
  });
});

describe('state transitions and ordinary transport', () => {
  it('starts closed with no owner or tracked/quarantined work', () => {
    expect(controller().snapshot()).toEqual({
      state: 'closed',
      generation: 0,
      subject: null,
      sessionId: null,
      inFlight: 0,
      quarantined: 0,
    });
  });

  it('requires exact, quiescent candidate and activation transitions', () => {
    const admission = controller();
    const binding = admission.setCandidate(TOKEN_A, USER_A);

    expect(admission.setCandidate(TOKEN_A, USER_A)).toBe(binding);
    expect(() => admission.setCandidate(TOKEN_A_ROTATED, USER_A)).toThrowError(
      expect.objectContaining({ code: 'SUPABASE_REMOTE_REQUEST_BINDING_REJECTED' }),
    );
    expect(() => admission.activate(TOKEN_A_ROTATED, USER_A)).toThrowError(
      expect.objectContaining({ code: 'SUPABASE_REMOTE_REQUEST_BINDING_REJECTED' }),
    );
    expect(admission.activate(TOKEN_A, USER_A)).toEqual(binding);
    expect(admission.hasActiveBinding(TOKEN_A, USER_A)).toBe(true);
    expect(admission.hasActiveBinding(TOKEN_A_ROTATED, USER_A)).toBe(false);
    expect(admission.hasActiveBinding(TOKEN_B, USER_B)).toBe(false);
  });

  it.each([
    '/rest/v1/profiles',
    '/storage/v1/object/private/path',
    '/graphql/v1',
    '/functions/v1/data-export',
  ])('admits active exact-token traffic for %s', async (path) => {
    const admission = controller();
    activate(admission);
    const transport = ordinaryTransport();

    const response = await admission.createFetch(transport)(`${SUPABASE_URL}${path}`, {
      headers: bearer(TOKEN_A),
    });

    expect(await response.json()).toEqual({ ok: true });
    const dispatched = transport.mock.calls[0]![0];
    expect(dispatched).toBeInstanceOf(Request);
    expect((dispatched as Request).redirect).toBe('manual');
    expect(transport.mock.calls[0]).toHaveLength(1);
  });

  it('captures immutable headers synchronously and dispatches the authorized snapshot', async () => {
    const admission = controller();
    activate(admission);
    const seen: { authorization: string | null; method: string }[] = [];
    const transport = vi.fn(async (input: string | URL | Request) => {
      const request = input as Request;
      seen.push({ authorization: request.headers.get('authorization'), method: request.method });
      return jsonResponse({ ok: true });
    });
    const headers = new Headers(bearer(TOKEN_A));
    const init: RequestInit = { method: 'POST', headers, body: '{}' };

    const request = admission.createFetch(transport)(`${SUPABASE_URL}/rest/v1/profiles`, init);
    headers.set('Authorization', `Bearer ${TOKEN_B}`);
    init.method = 'DELETE';
    init.body = '{"mutated":true}';
    await request;

    expect(seen).toEqual([{ authorization: `Bearer ${TOKEN_A}`, method: 'POST' }]);
  });

  it.each([
    ['https://external.example/rest/v1/profiles', 'SUPABASE_REMOTE_REQUEST_TARGET_REJECTED'],
    [`${SUPABASE_URL}/future/v99/new`, 'SUPABASE_REMOTE_REQUEST_TARGET_REJECTED'],
    [`${SUPABASE_URL}/realtime/v1/websocket`, 'SUPABASE_REMOTE_REQUEST_TARGET_REJECTED'],
    [`${SUPABASE_URL}/auth/v1/user/identities`, 'SUPABASE_REMOTE_REQUEST_TARGET_REJECTED'],
  ] as const)('never uses the Supabase-only transport for %s', async (url, code) => {
    const admission = controller();
    activate(admission);
    const transport = ordinaryTransport();

    await expectCode(admission.createFetch(transport)(url, { headers: bearer(TOKEN_A) }), code);
    expect(transport).not.toHaveBeenCalled();
  });

  it('rejects missing, foreign, rotated-before-publication, and malformed bearer headers', async () => {
    for (const headers of [
      undefined,
      bearer(TOKEN_B),
      bearer(TOKEN_A_ROTATED),
      { Authorization: TOKEN_A },
    ]) {
      const admission = controller();
      activate(admission);
      const transport = ordinaryTransport();
      await expectCode(
        admission.createFetch(transport)(`${SUPABASE_URL}/rest/v1/profiles`, { headers }),
        'SUPABASE_REMOTE_REQUEST_BINDING_REJECTED',
      );
      expect(transport).not.toHaveBeenCalled();
    }
  });

  it('buffers an authorized response before returning it to the caller', async () => {
    const admission = controller();
    activate(admission);
    let streamController!: ReadableStreamDefaultController<Uint8Array>;
    const transport = vi.fn(
      async () =>
        new Response(
          new ReadableStream<Uint8Array>({
            start(received) {
              streamController = received;
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
    );
    let returned = false;
    const response = admission
      .createFetch(transport)(`${SUPABASE_URL}/rest/v1/profiles`, {
        headers: bearer(TOKEN_A),
      })
      .then((value) => {
        returned = true;
        return value;
      });

    await flushMicrotasks();
    expect(returned).toBe(false);
    streamController.enqueue(new TextEncoder().encode('{"ok":true}'));
    streamController.close();

    expect(await (await response).json()).toEqual({ ok: true });
  });

  it('rejects manual redirects and mismatched response URLs', async () => {
    const admission = controller();
    activate(admission);
    const redirect = vi.fn(
      async () =>
        new Response(null, { status: 302, headers: { Location: 'https://evil.example' } }),
    );
    await expectCode(
      admission.createFetch(redirect)(`${SUPABASE_URL}/rest/v1/profiles`, {
        headers: bearer(TOKEN_A),
      }),
      'SUPABASE_REMOTE_REQUEST_TARGET_REJECTED',
    );

    const forged = jsonResponse({ ok: true });
    Object.defineProperty(forged, 'url', { value: 'https://evil.example/data' });
    await expectCode(
      admission.createFetch(async () => forged)(`${SUPABASE_URL}/rest/v1/profiles`, {
        headers: bearer(TOKEN_A),
      }),
      'SUPABASE_REMOTE_REQUEST_TARGET_REJECTED',
    );
  });
});

describe('explicit Auth request allowlist and lineage', () => {
  const anonymousBody = { data: {}, gotrue_meta_security: {} };
  const otpBody = {
    email: 'user@example.com',
    data: {},
    create_user: true,
    gotrue_meta_security: {},
    code_challenge: null,
    code_challenge_method: null,
  };
  const verifyBody = {
    email: 'user@example.com',
    token: '123456',
    type: 'email',
    gotrue_meta_security: {},
  };
  const providerBody = {
    provider: 'apple',
    id_token: 'provider-token',
    gotrue_meta_security: {},
  };

  it.each([
    ['/auth/v1/signup', anonymousBody, sessionPayload()],
    ['/auth/v1/otp', otpBody, {}],
    ['/auth/v1/verify', verifyBody, sessionPayload()],
    ['/auth/v1/token?grant_type=id_token', providerBody, sessionPayload()],
  ] as const)('allows the supported fresh-auth shape %s', async (path, body, payload) => {
    const admission = controller();
    const transport = vi.fn(async () => jsonResponse(payload));

    await admission.runWithPermit({ purpose: 'auth_fresh_sign_in' }, () =>
      admission.createFetch(transport)(`${SUPABASE_URL}${path}`, {
        method: 'POST',
        headers: jsonHeaders(PUBLIC_KEY),
        body: JSON.stringify(body),
      }),
    );

    expect(transport).toHaveBeenCalledOnce();
    expect(admission.snapshot().state).toBe('closed');
  });

  it.each([
    ['/auth/v1/sso', {}],
    ['/auth/v1/token?grant_type=password', { email: 'a@b.c', password: 'secret' }],
    ['/auth/v1/token?grant_type=pkce', { auth_code: 'code' }],
    ['/auth/v1/token?grant_type=id_token&grant_type=id_token', providerBody],
    ['/auth/v1/token?grant%5Ftype=id_token', providerBody],
    ['/auth/v1/signup/', anonymousBody],
    ['/auth/v1/signup', { ...anonymousBody, role: 'service_role' }],
  ] as const)('rejects unsupported/ambiguous fresh Auth shape %s', async (path, body) => {
    const admission = controller();
    const transport = ordinaryTransport();

    await expectCode(
      admission.runWithPermit({ purpose: 'auth_fresh_sign_in' }, () =>
        admission.createFetch(transport)(`${SUPABASE_URL}${path}`, {
          method: 'POST',
          headers: jsonHeaders(PUBLIC_KEY),
          body: JSON.stringify(body),
        }),
      ),
      'SUPABASE_REMOTE_REQUEST_TARGET_REJECTED',
    );
    expect(transport).not.toHaveBeenCalled();
  });

  it('rejects duplicate security-sensitive JSON properties', async () => {
    const admission = controller();
    const transport = ordinaryTransport();
    const body =
      '{"provider":"apple","provider":"google","id_token":"token","gotrue_meta_security":{}}';

    await expectCode(
      admission.runWithPermit({ purpose: 'auth_fresh_sign_in' }, () =>
        admission.createFetch(transport)(`${SUPABASE_URL}/auth/v1/token?grant_type=id_token`, {
          method: 'POST',
          headers: jsonHeaders(PUBLIC_KEY),
          body,
        }),
      ),
      'SUPABASE_REMOTE_REQUEST_TARGET_REJECTED',
    );
  });

  it('validates fresh session payload self-consistency before auth-js can parse it', async () => {
    const admission = controller();
    const wrongUser = vi.fn(async () => jsonResponse(sessionPayload(TOKEN_A, USER_B)));

    await expectCode(
      admission.runWithPermit({ purpose: 'auth_fresh_sign_in' }, () =>
        admission.createFetch(wrongUser)(`${SUPABASE_URL}/auth/v1/signup`, {
          method: 'POST',
          headers: jsonHeaders(PUBLIC_KEY),
          body: JSON.stringify(anonymousBody),
        }),
      ),
      'SUPABASE_REMOTE_REQUEST_BINDING_REJECTED',
    );
  });

  it('uses arrayBuffer when a React Native Response polyfill has undefined body', async () => {
    const admission = controller();
    const response = jsonResponse(sessionPayload());
    const encoded = new TextEncoder().encode(JSON.stringify(sessionPayload()));
    Object.defineProperty(response, 'body', { value: undefined });
    Object.defineProperty(response, 'arrayBuffer', {
      value: vi.fn(async () => encoded.slice().buffer),
    });

    await admission.runWithPermit({ purpose: 'auth_fresh_sign_in' }, () =>
      admission.createFetch(async () => response)(`${SUPABASE_URL}/auth/v1/signup`, {
        method: 'POST',
        headers: jsonHeaders(PUBLIC_KEY),
        body: JSON.stringify(anonymousBody),
      }),
    );

    expect(response.arrayBuffer).toHaveBeenCalledOnce();
  });

  it('caps Auth responses at 128 KiB before reading their body', async () => {
    const admission = controller();
    const oversized = jsonResponse(sessionPayload());
    oversized.headers.set('Content-Length', String(128 * 1024 + 1));

    await expectCode(
      admission.runWithPermit({ purpose: 'auth_fresh_sign_in' }, () =>
        admission.createFetch(async () => oversized)(`${SUPABASE_URL}/auth/v1/signup`, {
          method: 'POST',
          headers: jsonHeaders(PUBLIC_KEY),
          body: JSON.stringify(anonymousBody),
        }),
      ),
      'SUPABASE_REMOTE_REQUEST_TARGET_REJECTED',
    );
  });

  it('binds refresh to the exact opaque refresh token and atomically rotates candidate lineage', async () => {
    const admission = controller();
    const binding = admission.setCandidate(TOKEN_A, USER_A);
    const transport = vi.fn(async () =>
      jsonResponse(sessionPayload(TOKEN_A_ROTATED, USER_A, 'refresh-token-b')),
    );

    await admission.runWithPermit(
      { purpose: 'auth_refresh', binding, refreshToken: REFRESH_A },
      () =>
        admission.createFetch(transport)(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
          method: 'POST',
          headers: jsonHeaders(PUBLIC_KEY),
          body: JSON.stringify({ refresh_token: REFRESH_A }),
        }),
    );

    expect(admission.snapshot()).toMatchObject({
      state: 'candidate',
      subject: USER_A,
      sessionId: SESSION_A,
    });
    expect(admission.setCandidate(TOKEN_A_ROTATED, USER_A).accessToken).toBe(TOKEN_A_ROTATED);
    expect(() => admission.activate(TOKEN_A, USER_A)).toThrowError(
      expect.objectContaining({ code: 'SUPABASE_REMOTE_REQUEST_BINDING_REJECTED' }),
    );
    expect(admission.activate(TOKEN_A_ROTATED, USER_A).accessToken).toBe(TOKEN_A_ROTATED);
  });

  it('rejects a refresh request whose body does not match the permit credential', async () => {
    const admission = controller();
    const binding = admission.setCandidate(TOKEN_A, USER_A);
    const transport = ordinaryTransport();

    await expectCode(
      admission.runWithPermit({ purpose: 'auth_refresh', binding, refreshToken: REFRESH_A }, () =>
        admission.createFetch(transport)(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
          method: 'POST',
          headers: jsonHeaders(PUBLIC_KEY),
          body: JSON.stringify({ refresh_token: 'different-token' }),
        }),
      ),
      'SUPABASE_REMOTE_REQUEST_PERMIT_REJECTED',
    );
    expect(transport).not.toHaveBeenCalled();
  });

  it('allows bounded retry attempts only for the same refresh credential', async () => {
    const admission = controller();
    const binding = admission.setCandidate(TOKEN_A, USER_A);
    const transport = vi
      .fn<() => Promise<Response>>()
      .mockResolvedValueOnce(jsonResponse({ error: 'temporary' }, 503))
      .mockResolvedValueOnce(jsonResponse(sessionPayload(TOKEN_A_ROTATED)));
    const gated = admission.createFetch(transport);
    const descriptor = {
      method: 'POST',
      headers: jsonHeaders(PUBLIC_KEY),
      body: JSON.stringify({ refresh_token: REFRESH_A }),
    };

    await admission.runWithPermit(
      { purpose: 'auth_refresh', binding, refreshToken: REFRESH_A },
      async () => {
        const first = await gated(
          `${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,
          descriptor,
        );
        expect(first.status).toBe(503);
        await gated(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, descriptor);
      },
    );

    expect(transport).toHaveBeenCalledTimes(2);
  });

  it.each([
    [TOKEN_B, USER_B],
    [token(USER_A, SESSION_B), USER_A],
  ])('rejects refresh response lineage %s', async (responseToken, responseUser) => {
    const admission = controller();
    const binding = admission.setCandidate(TOKEN_A, USER_A);

    await expectCode(
      admission.runWithPermit({ purpose: 'auth_refresh', binding, refreshToken: REFRESH_A }, () =>
        admission.createFetch(async () =>
          jsonResponse(sessionPayload(responseToken, responseUser)),
        )(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
          method: 'POST',
          headers: jsonHeaders(PUBLIC_KEY),
          body: JSON.stringify({ refresh_token: REFRESH_A }),
        }),
      ),
      'SUPABASE_REMOTE_REQUEST_BINDING_REJECTED',
    );
    expect(admission.snapshot()).toMatchObject({ state: 'candidate', sessionId: SESSION_A });
  });

  it('allows exact candidate verification and active exact verification only', async () => {
    const admission = controller();
    const binding = admission.setCandidate(TOKEN_A, USER_A);
    const transport = vi.fn(async () => jsonResponse({ id: USER_A }));
    const gated = admission.createFetch(transport);

    await admission.runWithPermit({ purpose: 'auth_verify', binding }, () =>
      gated(`${SUPABASE_URL}/auth/v1/user`, { headers: bearer(TOKEN_A) }),
    );
    admission.activate(TOKEN_A, USER_A);
    await gated(`${SUPABASE_URL}/auth/v1/user`, { headers: bearer(TOKEN_A) });

    expect(transport).toHaveBeenCalledTimes(2);
  });

  it('supports all three anonymous identity-upgrade shapes and preserves lineage', async () => {
    const cases = [
      {
        path: '/auth/v1/token?grant_type=id_token',
        method: 'POST',
        bearerToken: TOKEN_A,
        body: {
          provider: 'apple',
          id_token: 'provider-token',
          link_identity: true,
          gotrue_meta_security: {},
        },
        response: sessionPayload(TOKEN_A_ROTATED),
      },
      {
        path: '/auth/v1/user',
        method: 'PUT',
        bearerToken: TOKEN_A,
        body: { email: 'user@example.com', code_challenge: null, code_challenge_method: null },
        response: { id: USER_A },
      },
      {
        path: '/auth/v1/verify',
        method: 'POST',
        bearerToken: PUBLIC_KEY,
        body: {
          email: 'user@example.com',
          token: '123456',
          type: 'email_change',
          gotrue_meta_security: {},
        },
        response: { msg: 'confirmation pending', code: 'email_change_pending' },
      },
    ] as const;

    for (const testCase of cases) {
      const admission = controller();
      const binding = admission.setCandidate(TOKEN_A, USER_A);
      await admission.runWithPermit({ purpose: 'auth_identity_upgrade', binding }, () =>
        admission.createFetch(async () => jsonResponse(testCase.response))(
          `${SUPABASE_URL}${testCase.path}`,
          {
            method: testCase.method,
            headers: jsonHeaders(testCase.bearerToken),
            body: JSON.stringify(testCase.body),
          },
        ),
      );
      expect(admission.snapshot()).toMatchObject({ state: 'candidate', subject: USER_A });
    }
  });

  it('allows exact global logout after close and rejects alternate query ambiguity', async () => {
    const binding = parseSupabaseRemoteSessionBinding(TOKEN_A, USER_A)!;
    const admission = controller();
    const transport = vi.fn(async () => new Response(null, { status: 204 }));

    await admission.runWithPermit({ purpose: 'auth_logout', binding }, () =>
      admission.createFetch(transport)(`${SUPABASE_URL}/auth/v1/logout?scope=global`, {
        method: 'POST',
        headers: bearer(TOKEN_A),
      }),
    );
    await expectCode(
      admission.runWithPermit({ purpose: 'auth_logout', binding }, () =>
        admission.createFetch(transport)(`${SUPABASE_URL}/auth/v1/logout?scope=local`, {
          method: 'POST',
          headers: bearer(TOKEN_A),
        }),
      ),
      'SUPABASE_REMOTE_REQUEST_TARGET_REJECTED',
    );
  });
});

describe('composite Sign in with Apple bootstrap permit', () => {
  const freshAppleBody = {
    provider: 'apple',
    id_token: APPLE_BOOTSTRAP.identityToken,
    nonce: APPLE_BOOTSTRAP.nonce,
    gotrue_meta_security: {},
  };
  const captureBody = { action: 'capture', ...APPLE_BOOTSTRAP };
  const activeLifecycleResponse = {
    status: 'active',
    generation: 1,
    nextValidationAt: '2026-07-16T12:00:00.000Z',
  };

  it('keeps a fresh session closed until exact auth and lifecycle capture both validate', async () => {
    const admission = controller();
    const transport = vi.fn(async (input: string | URL | Request) =>
      (input instanceof Request ? input.url : input.toString()).includes('/auth/v1/')
        ? jsonResponse(sessionPayload())
        : jsonResponse(activeLifecycleResponse),
    );
    const gated = admission.createFetch(transport);

    await admission.runWithPermit(
      { purpose: 'apple_auth_bootstrap', credentials: APPLE_BOOTSTRAP },
      async () => {
        expect(admission.snapshot().state).toBe('closed');
        await gated(`${SUPABASE_URL}/auth/v1/token?grant_type=id_token`, {
          method: 'POST',
          headers: jsonHeaders(PUBLIC_KEY),
          body: JSON.stringify(freshAppleBody),
        });
        expect(admission.snapshot().state).toBe('closed');
        await gated(`${SUPABASE_URL}/functions/v1/apple-auth-lifecycle`, {
          method: 'POST',
          headers: jsonHeaders(TOKEN_A),
          body: JSON.stringify(captureBody),
        });
        expect(admission.snapshot().state).toBe('closed');
      },
    );

    expect(transport).toHaveBeenCalledTimes(2);
    expect(admission.snapshot()).toMatchObject({ state: 'closed', subject: null });
  });

  it('preserves the anonymous UUID, requires the rotated bearer, and rotates only after capture', async () => {
    const admission = controller();
    const previous = activate(admission);
    const transport = vi.fn(async (input: string | URL | Request) =>
      (input instanceof Request ? input.url : input.toString()).includes('/auth/v1/')
        ? jsonResponse(sessionPayload(TOKEN_A_ROTATED))
        : jsonResponse(activeLifecycleResponse),
    );
    const gated = admission.createFetch(transport);

    await admission.runWithPermit(
      { purpose: 'apple_auth_bootstrap', credentials: APPLE_BOOTSTRAP, binding: previous },
      async () => {
        await gated(`${SUPABASE_URL}/auth/v1/token?grant_type=id_token`, {
          method: 'POST',
          headers: jsonHeaders(TOKEN_A),
          body: JSON.stringify({ ...freshAppleBody, link_identity: true }),
        });
        expect(admission.hasActiveBinding(TOKEN_A, USER_A)).toBe(true);
        await gated(`${SUPABASE_URL}/functions/v1/apple-auth-lifecycle`, {
          method: 'POST',
          headers: jsonHeaders(TOKEN_A_ROTATED),
          body: JSON.stringify(captureBody),
        });
        expect(admission.hasActiveBinding(TOKEN_A, USER_A)).toBe(true);
      },
    );

    expect(admission.snapshot()).toMatchObject({ state: 'active', subject: USER_A });
    expect(admission.hasActiveBinding(TOKEN_A_ROTATED, USER_A)).toBe(true);
    expect(admission.hasActiveBinding(TOKEN_A, USER_A)).toBe(false);
  });

  it('uses the previous exact bearer when same-user linking returns no replacement token', async () => {
    const admission = controller();
    const previous = activate(admission);
    const transport = vi
      .fn<() => Promise<Response>>()
      .mockResolvedValueOnce(jsonResponse({ user: { id: USER_A } }))
      .mockResolvedValueOnce(jsonResponse(activeLifecycleResponse));
    const gated = admission.createFetch(transport);

    await admission.runWithPermit(
      { purpose: 'apple_auth_bootstrap', credentials: APPLE_BOOTSTRAP, binding: previous },
      async () => {
        await gated(`${SUPABASE_URL}/auth/v1/token?grant_type=id_token`, {
          method: 'POST',
          headers: jsonHeaders(TOKEN_A),
          body: JSON.stringify({ ...freshAppleBody, link_identity: true }),
        });
        await gated(`${SUPABASE_URL}/functions/v1/apple-auth-lifecycle`, {
          method: 'POST',
          headers: jsonHeaders(TOKEN_A),
          body: JSON.stringify(captureBody),
        });
      },
    );

    expect(admission.hasActiveBinding(TOKEN_A, USER_A)).toBe(true);
  });

  it('never lets Supabase consume the Apple authorization code as an ID-token access_token', async () => {
    const admission = controller();
    const transport = ordinaryTransport();

    await expectCode(
      admission.runWithPermit(
        { purpose: 'apple_auth_bootstrap', credentials: APPLE_BOOTSTRAP },
        () =>
          admission.createFetch(transport)(`${SUPABASE_URL}/auth/v1/token?grant_type=id_token`, {
            method: 'POST',
            headers: jsonHeaders(PUBLIC_KEY),
            body: JSON.stringify({
              ...freshAppleBody,
              access_token: APPLE_BOOTSTRAP.authorizationCode,
            }),
          }),
      ),
      'SUPABASE_REMOTE_REQUEST_PERMIT_REJECTED',
    );

    expect(transport).not.toHaveBeenCalled();
    expect(admission.snapshot().state).toBe('closed');
  });

  it.each([
    {
      label: 'wrong endpoint',
      path: '/functions/v1/catalog-search',
      bearerToken: TOKEN_A,
      body: captureBody,
    },
    {
      label: 'query ambiguity',
      path: '/functions/v1/apple-auth-lifecycle?retry=true',
      bearerToken: TOKEN_A,
      body: captureBody,
    },
    {
      label: 'wrong bearer',
      path: '/functions/v1/apple-auth-lifecycle',
      bearerToken: TOKEN_B,
      body: captureBody,
    },
    {
      label: 'wrong authorization code',
      path: '/functions/v1/apple-auth-lifecycle',
      bearerToken: TOKEN_A,
      body: { ...captureBody, authorizationCode: 'different-code' },
    },
    {
      label: 'extra body field',
      path: '/functions/v1/apple-auth-lifecycle',
      bearerToken: TOKEN_A,
      body: { ...captureBody, retry: true },
    },
  ])('rejects the second request for $label before dispatch', async (testCase) => {
    const admission = controller();
    const transport = vi.fn(async () => jsonResponse(sessionPayload()));
    const gated = admission.createFetch(transport);

    await expectCode(
      admission.runWithPermit(
        { purpose: 'apple_auth_bootstrap', credentials: APPLE_BOOTSTRAP },
        async () => {
          await gated(`${SUPABASE_URL}/auth/v1/token?grant_type=id_token`, {
            method: 'POST',
            headers: jsonHeaders(PUBLIC_KEY),
            body: JSON.stringify(freshAppleBody),
          });
          await gated(`${SUPABASE_URL}${testCase.path}`, {
            method: 'POST',
            headers: jsonHeaders(testCase.bearerToken),
            body: JSON.stringify(testCase.body),
          });
        },
      ),
      'SUPABASE_REMOTE_REQUEST_PERMIT_REJECTED',
    );
    expect(transport).toHaveBeenCalledOnce();
    expect(admission.snapshot().state).toBe('closed');
  });

  it('rejects partial provider success and never rotates the anonymous binding', async () => {
    const admission = controller();
    const previous = activate(admission);
    const transport = vi
      .fn<() => Promise<Response>>()
      .mockResolvedValueOnce(jsonResponse(sessionPayload(TOKEN_A_ROTATED)))
      .mockResolvedValueOnce(jsonResponse({ error: 'temporarily_unavailable' }, 503));
    const gated = admission.createFetch(transport);

    await expectCode(
      admission.runWithPermit(
        { purpose: 'apple_auth_bootstrap', credentials: APPLE_BOOTSTRAP, binding: previous },
        async () => {
          await gated(`${SUPABASE_URL}/auth/v1/token?grant_type=id_token`, {
            method: 'POST',
            headers: jsonHeaders(TOKEN_A),
            body: JSON.stringify({ ...freshAppleBody, link_identity: true }),
          });
          await gated(`${SUPABASE_URL}/functions/v1/apple-auth-lifecycle`, {
            method: 'POST',
            headers: jsonHeaders(TOKEN_A_ROTATED),
            body: JSON.stringify(captureBody),
          });
        },
      ),
      'SUPABASE_REMOTE_REQUEST_PERMIT_REJECTED',
    );

    expect(admission.hasActiveBinding(TOKEN_A, USER_A)).toBe(true);
    expect(admission.hasActiveBinding(TOKEN_A_ROTATED, USER_A)).toBe(false);
  });

  it('rejects a forged active response and an auth-only partial operation', async () => {
    for (const lifecyclePayload of [
      { ...activeLifecycleResponse, generation: 0 },
      { ...activeLifecycleResponse, generation: '9223372036854775808' },
      { ...activeLifecycleResponse, status: 'blocked' },
      { ...activeLifecycleResponse, extra: true },
    ]) {
      const admission = controller();
      const transport = vi
        .fn<() => Promise<Response>>()
        .mockResolvedValueOnce(jsonResponse(sessionPayload()))
        .mockResolvedValueOnce(jsonResponse(lifecyclePayload));
      const gated = admission.createFetch(transport);
      await expectCode(
        admission.runWithPermit(
          { purpose: 'apple_auth_bootstrap', credentials: APPLE_BOOTSTRAP },
          async () => {
            await gated(`${SUPABASE_URL}/auth/v1/token?grant_type=id_token`, {
              method: 'POST',
              headers: jsonHeaders(PUBLIC_KEY),
              body: JSON.stringify(freshAppleBody),
            });
            await gated(`${SUPABASE_URL}/functions/v1/apple-auth-lifecycle`, {
              method: 'POST',
              headers: jsonHeaders(TOKEN_A),
              body: JSON.stringify(captureBody),
            });
          },
        ),
        'SUPABASE_REMOTE_REQUEST_BINDING_REJECTED',
      );
    }

    const authOnly = controller();
    await expectCode(
      authOnly.runWithPermit(
        { purpose: 'apple_auth_bootstrap', credentials: APPLE_BOOTSTRAP },
        () =>
          authOnly.createFetch(async () => jsonResponse(sessionPayload()))(
            `${SUPABASE_URL}/auth/v1/token?grant_type=id_token`,
            {
              method: 'POST',
              headers: jsonHeaders(PUBLIC_KEY),
              body: JSON.stringify(freshAppleBody),
            },
          ),
      ),
      'SUPABASE_REMOTE_REQUEST_PERMIT_REJECTED',
    );
  });

  it('rejects a rapid second Apple bootstrap while the first semantic lease is active', async () => {
    const admission = controller();
    let releaseAuth!: (response: Response) => void;
    const transport = vi.fn(async (input: string | URL | Request) => {
      const url = input instanceof Request ? input.url : input.toString();
      if (url.includes('/auth/v1/')) {
        return new Promise<Response>((resolve) => {
          releaseAuth = resolve;
        });
      }
      return jsonResponse(activeLifecycleResponse);
    });
    const gated = admission.createFetch(transport);
    const first = admission.runWithPermit(
      { purpose: 'apple_auth_bootstrap', credentials: APPLE_BOOTSTRAP },
      async () => {
        await gated(`${SUPABASE_URL}/auth/v1/token?grant_type=id_token`, {
          method: 'POST',
          headers: jsonHeaders(PUBLIC_KEY),
          body: JSON.stringify(freshAppleBody),
        });
        await gated(`${SUPABASE_URL}/functions/v1/apple-auth-lifecycle`, {
          method: 'POST',
          headers: jsonHeaders(TOKEN_A),
          body: JSON.stringify(captureBody),
        });
      },
    );
    await expectCode(
      admission.runWithPermit(
        { purpose: 'apple_auth_bootstrap', credentials: APPLE_BOOTSTRAP },
        async () => undefined,
      ),
      'SUPABASE_REMOTE_REQUEST_PERMIT_REJECTED',
    );

    await vi.waitFor(() => expect(transport).toHaveBeenCalledOnce());
    releaseAuth(jsonResponse(sessionPayload()));
    await first;
    expect(transport).toHaveBeenCalledTimes(2);
  });
});

describe('native Apple credential invalidation permit', () => {
  async function invalidate(
    admission: SupabaseRemoteRequestAdmissionController,
    binding: SupabaseRemoteSessionBinding,
    reason: 'not_found' | 'revoked' = 'revoked',
  ): Promise<void> {
    await admission.runWithPermit(
      {
        purpose: 'apple_credential_invalid',
        binding,
        appleUser: APPLE_BOOTSTRAP.appleUser,
        reason,
      },
      () =>
        admission.createFetch(async () => jsonResponse({ status: 'blocked' }))(
          `${SUPABASE_URL}/functions/v1/apple-auth-lifecycle`,
          {
            method: 'POST',
            headers: jsonHeaders(binding.accessToken),
            body: JSON.stringify({
              action: 'credential_invalid',
              appleUser: APPLE_BOOTSTRAP.appleUser,
              reason,
            }),
          },
        ),
    );
  }

  it('admits one exact request for an active or closed persisted session binding', async () => {
    const active = controller();
    const activeBinding = activate(active);
    await invalidate(active, activeBinding, 'revoked');
    expect(active.hasActiveBinding(TOKEN_A, USER_A)).toBe(true);

    const closed = controller();
    const persistedBinding = parseSupabaseRemoteSessionBinding(TOKEN_A, USER_A)!;
    await invalidate(closed, persistedBinding, 'not_found');
    expect(closed.snapshot()).toMatchObject({ state: 'closed', subject: null });
  });

  it.each([
    {
      label: 'wrong endpoint',
      path: '/functions/v1/data-export',
      bearerToken: TOKEN_A,
      body: {
        action: 'credential_invalid',
        appleUser: APPLE_BOOTSTRAP.appleUser,
        reason: 'revoked',
      },
    },
    {
      label: 'wrong bearer',
      path: '/functions/v1/apple-auth-lifecycle',
      bearerToken: TOKEN_B,
      body: {
        action: 'credential_invalid',
        appleUser: APPLE_BOOTSTRAP.appleUser,
        reason: 'revoked',
      },
    },
    {
      label: 'wrong reason',
      path: '/functions/v1/apple-auth-lifecycle',
      bearerToken: TOKEN_A,
      body: {
        action: 'credential_invalid',
        appleUser: APPLE_BOOTSTRAP.appleUser,
        reason: 'not_found',
      },
    },
    {
      label: 'extra field',
      path: '/functions/v1/apple-auth-lifecycle',
      bearerToken: TOKEN_A,
      body: {
        action: 'credential_invalid',
        appleUser: APPLE_BOOTSTRAP.appleUser,
        reason: 'revoked',
        retry: true,
      },
    },
  ])('rejects $label before dispatch', async (testCase) => {
    const admission = controller();
    const binding = activate(admission);
    const transport = ordinaryTransport();
    await expectCode(
      admission.runWithPermit(
        {
          purpose: 'apple_credential_invalid',
          binding,
          appleUser: APPLE_BOOTSTRAP.appleUser,
          reason: 'revoked',
        },
        () =>
          admission.createFetch(transport)(`${SUPABASE_URL}${testCase.path}`, {
            method: 'POST',
            headers: jsonHeaders(testCase.bearerToken),
            body: JSON.stringify(testCase.body),
          }),
      ),
      'SUPABASE_REMOTE_REQUEST_PERMIT_REJECTED',
    );
    expect(transport).not.toHaveBeenCalled();
  });

  it('rejects an unpermitted call and a forged blocked response', async () => {
    const admission = controller();
    const binding = activate(admission);
    const descriptor = {
      method: 'POST',
      headers: jsonHeaders(TOKEN_A),
      body: JSON.stringify({
        action: 'credential_invalid',
        appleUser: APPLE_BOOTSTRAP.appleUser,
        reason: 'revoked',
      }),
    };
    await expectCode(
      admission.createFetch(ordinaryTransport())(
        `${SUPABASE_URL}/functions/v1/apple-auth-lifecycle`,
        descriptor,
      ),
      'SUPABASE_REMOTE_REQUEST_PERMIT_REJECTED',
    );
    await expectCode(
      admission.runWithPermit(
        {
          purpose: 'apple_credential_invalid',
          binding,
          appleUser: APPLE_BOOTSTRAP.appleUser,
          reason: 'revoked',
        },
        () =>
          admission.createFetch(async () => jsonResponse({ status: 'blocked', extra: true }))(
            `${SUPABASE_URL}/functions/v1/apple-auth-lifecycle`,
            descriptor,
          ),
      ),
      'SUPABASE_REMOTE_REQUEST_BINDING_REJECTED',
    );
  });

  it('does not poison bearerless recovery/status lanes after invalidation', async () => {
    const admission = controller();
    await invalidate(admission, parseSupabaseRemoteSessionBinding(TOKEN_A, USER_A)!);
    await admission.runWithPermit({ purpose: 'account_deletion', action: 'status' }, () =>
      admission.createFetch(async () => jsonResponse({ status: 'none' }))(
        `${SUPABASE_URL}/functions/v1/account-deletion`,
        {
          method: 'POST',
          headers: jsonHeaders(),
          body: JSON.stringify({ action: 'status', capability: 'opaque' }),
        },
      ),
    );
  });
});

describe('typed account-deletion permits', () => {
  async function requestAction(
    admission: SupabaseRemoteRequestAdmissionController,
    action: SupabaseAccountDeletionAction,
    binding?: SupabaseRemoteSessionBinding,
  ): Promise<void> {
    await admission.runWithPermit({ purpose: 'account_deletion', action, binding }, () =>
      admission.createFetch(async () => jsonResponse({ ok: true }))(
        `${SUPABASE_URL}/functions/v1/account-deletion`,
        {
          method: 'POST',
          headers: jsonHeaders(binding?.accessToken),
          body: JSON.stringify({ action, capability: 'opaque' }),
        },
      ),
    );
  }

  it('admits each action only in its exact lifecycle state', async () => {
    const preflight = controller();
    const preflightBinding = preflight.setCandidate(TOKEN_A, USER_A);
    await requestAction(preflight, 'preflight', preflightBinding);

    const reserve = controller();
    const reserveBinding = reserve.setCandidate(TOKEN_A, USER_A);
    await requestAction(reserve, 'publication_reserve', reserveBinding);
    await requestAction(reserve, 'publication_activate', reserveBinding);

    const renew = controller();
    const renewBinding = activate(renew);
    await requestAction(renew, 'publication_renew', renewBinding);

    const deletion = controller();
    const deletionBinding = activate(deletion);
    await deletion.beginDeletion(TOKEN_A, USER_A);
    await requestAction(deletion, 'begin', deletionBinding);

    await requestAction(controller(), 'status');
    await requestAction(controller(), 'publication_release');
  });

  it('rejects bearer/action/query/body mismatches and oversized control responses', async () => {
    const admission = controller();
    const binding = admission.setCandidate(TOKEN_A, USER_A);
    const transport = ordinaryTransport();
    const cases = [
      {
        path: '/functions/v1/account-deletion?duplicate=true',
        body: JSON.stringify({ action: 'preflight' }),
      },
      { path: '/functions/v1/account-deletion', body: JSON.stringify({ action: 'begin' }) },
      {
        path: '/functions/v1/account-deletion',
        body: '{"action":"preflight","action":"begin"}',
      },
      {
        path: '/functions/v1/account-deletion',
        body: JSON.stringify({
          action: 'preflight',
          padding: 'x'.repeat(SUPABASE_REMOTE_REQUEST_BODY_MAX_CHARS),
        }),
      },
    ];

    for (const testCase of cases) {
      await expect(
        admission.runWithPermit({ purpose: 'account_deletion', action: 'preflight', binding }, () =>
          admission.createFetch(transport)(`${SUPABASE_URL}${testCase.path}`, {
            method: 'POST',
            headers: jsonHeaders(TOKEN_A),
            body: testCase.body,
          }),
        ),
      ).rejects.toBeInstanceOf(Error);
    }
    expect(transport).not.toHaveBeenCalled();
  });
});

describe('semantic leases, timeout quarantine, drain, and stale completion', () => {
  it('rejects a permit that completed without making an authorized request', async () => {
    await expectCode(
      controller().runWithPermit({ purpose: 'auth_fresh_sign_in' }, async () => undefined),
      'SUPABASE_REMOTE_REQUEST_PERMIT_REJECTED',
    );
  });

  it.each([0, 9, 120_001, 10.5, Number.NaN])(
    'rejects invalid explicit semantic timeout %s',
    async (timeoutMs) => {
      await expectCode(
        controller().runWithPermit(
          { purpose: 'auth_fresh_sign_in', timeoutMs },
          async () => undefined,
        ),
        'SUPABASE_REMOTE_REQUEST_PERMIT_REJECTED',
      );
    },
  );

  it('aborts on deadline, rejects close while work is quarantined, and blocks reopening', async () => {
    vi.useFakeTimers();
    const admission = controller();
    let signal!: AbortSignal;
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    const operation = admission.runWithPermit(
      { purpose: 'auth_fresh_sign_in', timeoutMs: 20 },
      async (received) => {
        signal = received;
        await blocked;
      },
    );
    await flushMicrotasks();

    await vi.advanceTimersByTimeAsync(20);
    expect(signal.aborted).toBe(true);
    expect(admission.snapshot()).toMatchObject({ inFlight: 1, quarantined: 1 });
    await expectCode(admission.close(), 'SUPABASE_REMOTE_REQUEST_DRAIN_QUARANTINED');
    expect(() => admission.setCandidate(TOKEN_A, USER_A)).toThrowError(
      expect.objectContaining({ code: 'SUPABASE_REMOTE_REQUEST_DRAIN_QUARANTINED' }),
    );

    release();
    await expectCode(operation, 'SUPABASE_REMOTE_REQUEST_RESULT_STALE');
    await admission.waitForResidualSettlement();
    await admission.close();
    expect(admission.snapshot()).toMatchObject({ inFlight: 0, quarantined: 0 });
  });

  it('does not use a bare timeout race when the transport ignores abort', async () => {
    vi.useFakeTimers();
    const admission = controller();
    const binding = admission.setCandidate(TOKEN_A, USER_A);
    let releaseTransport!: (response: Response) => void;
    const transport = vi.fn(
      async (_input: string | URL | Request) =>
        new Promise<Response>((resolve) => {
          releaseTransport = resolve;
        }),
    );
    const operation = admission.runWithPermit(
      { purpose: 'auth_verify', binding, timeoutMs: 25 },
      () =>
        admission.createFetch(transport)(`${SUPABASE_URL}/auth/v1/user`, {
          method: 'GET',
          headers: bearer(TOKEN_A),
        }),
    );
    await flushUntil(() => transport.mock.calls.length === 1);
    const close = admission.close();
    let closeSettled = false;
    void close.catch(() => {
      closeSettled = true;
    });

    expect((transport.mock.calls[0]![0] as Request).signal.aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(24);
    expect(closeSettled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expectCode(close, 'SUPABASE_REMOTE_REQUEST_DRAIN_QUARANTINED');
    expect(admission.snapshot().inFlight).toBe(2);

    releaseTransport(jsonResponse({ id: USER_A }));
    await expectCode(operation, 'SUPABASE_REMOTE_REQUEST_RESULT_STALE');
    await admission.waitForResidualSettlement();
    await admission.close();
  });

  it('does not report semantic success while an un-awaited child fetch is running', async () => {
    const admission = controller();
    const binding = admission.setCandidate(TOKEN_A, USER_A);
    let release!: (response: Response) => void;
    const transport = vi.fn(
      async () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    );
    let permitSettled = false;
    const child = { completion: null as Promise<Response> | null };
    const permit = admission
      .runWithPermit({ purpose: 'auth_verify', binding }, () => {
        child.completion = admission.createFetch(transport)(`${SUPABASE_URL}/auth/v1/user`, {
          method: 'GET',
          headers: bearer(TOKEN_A),
        });
      })
      .then(() => {
        permitSettled = true;
      });
    await flushUntil(() => transport.mock.calls.length === 1);

    expect(permitSettled).toBe(false);
    expect(admission.snapshot().inFlight).toBe(2);
    release(jsonResponse({ id: USER_A }));
    await child.completion;
    await permit;
    expect(permitSettled).toBe(true);
    expect(admission.snapshot().inFlight).toBe(0);
  });

  it('fails and quarantines an un-awaited child that ignores the parent deadline', async () => {
    vi.useFakeTimers();
    const admission = controller();
    const binding = admission.setCandidate(TOKEN_A, USER_A);
    let release!: (response: Response) => void;
    let child!: Promise<Response>;
    const permit = admission.runWithPermit(
      { purpose: 'auth_verify', binding, timeoutMs: 20 },
      () => {
        child = admission.createFetch(
          async () =>
            new Promise<Response>((resolve) => {
              release = resolve;
            }),
        )(`${SUPABASE_URL}/auth/v1/user`, {
          method: 'GET',
          headers: bearer(TOKEN_A),
        });
      },
    );
    await flushMicrotasks();
    await vi.advanceTimersByTimeAsync(20);

    await expectCode(permit, 'SUPABASE_REMOTE_REQUEST_RESULT_STALE');
    expect(admission.snapshot()).toMatchObject({ inFlight: 1, quarantined: 1 });
    expect(() => admission.setCandidate(TOKEN_A, USER_A)).toThrowError(
      expect.objectContaining({ code: 'SUPABASE_REMOTE_REQUEST_DRAIN_QUARANTINED' }),
    );

    release(jsonResponse({ id: USER_A }));
    await expectCode(child, 'SUPABASE_REMOTE_REQUEST_RESULT_STALE');
    await admission.waitForResidualSettlement();
    await admission.close();
  });

  it('fulfills close only after every tracked SDK/request continuation has truly settled', async () => {
    const admission = controller();
    activate(admission);
    let release!: (response: Response) => void;
    const transport = vi.fn(
      async () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    );
    const request = admission.createFetch(transport)(`${SUPABASE_URL}/rest/v1/profiles`, {
      headers: bearer(TOKEN_A),
    });
    await flushMicrotasks();
    let closeSettled = false;
    const close = admission.close().then(() => {
      closeSettled = true;
    });
    await flushMicrotasks();

    expect(closeSettled).toBe(false);
    release(jsonResponse({ late: true }));
    await expectCode(request, 'SUPABASE_REMOTE_REQUEST_RESULT_STALE');
    await close;
    expect(closeSettled).toBe(true);
    expect(admission.snapshot().inFlight).toBe(0);
  });

  it('captures an Auth request and epoch before async body normalization', async () => {
    const admission = controller();
    let bodyController!: ReadableStreamDefaultController<Uint8Array>;
    const body = new ReadableStream<Uint8Array>({
      start(received) {
        bodyController = received;
      },
    });
    const request = new Request(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: jsonHeaders(PUBLIC_KEY),
      body,
      duplex: 'half',
    } as RequestInit);
    const transport = ordinaryTransport();
    const operation = admission.runWithPermit({ purpose: 'auth_fresh_sign_in' }, () =>
      admission.createFetch(transport)(request),
    );
    await flushMicrotasks();
    const close = admission.close();
    bodyController.enqueue(
      new TextEncoder().encode(JSON.stringify({ data: {}, gotrue_meta_security: {} })),
    );
    bodyController.close();

    await expectCode(operation, 'SUPABASE_REMOTE_REQUEST_RESULT_STALE');
    await close;
    admission.setCandidate(TOKEN_A, USER_A);
    expect(transport).not.toHaveBeenCalled();
  });

  it('keeps activation closed while a candidate semantic operation is not quiescent', async () => {
    const admission = controller();
    const binding = admission.setCandidate(TOKEN_A, USER_A);
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    const operation = admission.runWithPermit({ purpose: 'auth_verify', binding }, async () => {
      await admission.createFetch(async () => jsonResponse({ id: USER_A }))(
        `${SUPABASE_URL}/auth/v1/user`,
        { headers: bearer(TOKEN_A) },
      );
      await blocked;
    });
    await flushMicrotasks();

    expect(() => admission.activate(TOKEN_A, USER_A)).toThrowError(
      expect.objectContaining({ code: 'SUPABASE_REMOTE_REQUEST_ADMISSION_CLOSED' }),
    );
    release();
    await operation;
    expect(admission.activate(TOKEN_A, USER_A).subject).toBe(USER_A);
  });

  it('rotates only from the exact previous active binding and drains old requests', async () => {
    const admission = controller();
    const previous = activate(admission);
    let release!: (response: Response) => void;
    const request = admission.createFetch(
      async () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    )(`${SUPABASE_URL}/rest/v1/profiles`, { headers: bearer(TOKEN_A) });
    await flushMicrotasks();
    const rotation = admission.rotateActiveBinding(previous, TOKEN_A_ROTATED, USER_A);
    release(jsonResponse({ late: true }));

    await expectCode(request, 'SUPABASE_REMOTE_REQUEST_RESULT_STALE');
    expect((await rotation).accessToken).toBe(TOKEN_A_ROTATED);
    await expect(admission.rotateActiveBinding(previous, TOKEN_A, USER_A)).rejects.toMatchObject({
      code: 'SUPABASE_REMOTE_REQUEST_BINDING_REJECTED',
    });
  });

  it('enters deletion synchronously with exact binding and drains old work', async () => {
    const admission = controller();
    activate(admission);
    let release!: (response: Response) => void;
    const request = admission.createFetch(
      async () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    )(`${SUPABASE_URL}/functions/v1/data-export`, { headers: bearer(TOKEN_A) });
    await flushMicrotasks();
    const deletion = admission.beginDeletion(TOKEN_A, USER_A);

    expect(admission.snapshot().state).toBe('deletion');
    release(jsonResponse({ late: true }));
    await expectCode(request, 'SUPABASE_REMOTE_REQUEST_RESULT_STALE');
    expect((await deletion).subject).toBe(USER_A);
  });

  it('fails Realtime closed and never invokes the connector', async () => {
    const admission = controller();
    const binding = activate(admission);
    const connect = vi.fn(async () => undefined);

    await expectCode(
      admission.runRealtime('wss://project.supabase.co/realtime/v1/websocket', binding, connect),
      'SUPABASE_REMOTE_REQUEST_TARGET_REJECTED',
    );
    expect(connect).not.toHaveBeenCalled();
  });
});
