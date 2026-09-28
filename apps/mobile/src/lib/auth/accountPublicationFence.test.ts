import { Buffer } from 'node:buffer';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  accountPublicationSessionBinding,
  createAccountPublicationCapability,
  exchangeAccountPublicationFence,
  parseAccountPublicationResponse,
  type AccountPublicationAction,
} from './accountPublicationFence';

const cryptoMock = vi.hoisted(() => ({
  getRandomBytesAsync: vi.fn(),
}));
const remoteGateMock = vi.hoisted(() => ({
  runDeletionPermit: vi.fn(async (_permit, transport, operation) => operation(transport)),
}));

vi.mock('expo-crypto', () => cryptoMock);
vi.mock('@/lib/env', () => ({
  env: {
    supabaseUrl: 'https://project.supabase.co',
    supabasePublishableKey: 'sb_publishable_test',
  },
}));
vi.mock('@/lib/supabase/remoteRequestGate', () => ({
  runWithSupabaseAccountDeletionRequestPermit: remoteGateMock.runDeletionPermit,
}));

const CAPABILITY = 'ab'.repeat(32);
const SUBJECT = '11111111-1111-4111-8111-111111111111';
const SESSION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const BINDING = {
  accessToken: 'signed.session.token',
  sessionId: SESSION_ID,
  subject: SUBJECT,
} as const;

function jwt(payload: Record<string, unknown>): string {
  return `e30.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`;
}

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('account publication fence transport', () => {
  it('creates a memory-ready 256-bit lowercase-hex capability', async () => {
    cryptoMock.getRandomBytesAsync.mockResolvedValueOnce(
      Uint8Array.from({ length: 32 }, (_value, index) => index),
    );

    await expect(createAccountPublicationCapability()).resolves.toBe(
      '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f',
    );
    expect(cryptoMock.getRandomBytesAsync).toHaveBeenCalledWith(32);
  });

  it.each([
    ['publication_reserve', 'reserved'],
    ['publication_activate', 'active'],
    ['publication_renew', 'active'],
    ['publication_release', 'released'],
  ] as const)('accepts only the exact success for %s', (action, status) => {
    expect(parseAccountPublicationResponse(action, 200, { status })).toBe(status);
    expect(() => parseAccountPublicationResponse(action, 200, { status, extra: true })).toThrow(
      'ACCOUNT_PUBLICATION_UNAVAILABLE',
    );
    expect(() =>
      parseAccountPublicationResponse(action, 200, {
        status: status === 'active' ? 'released' : 'active',
      }),
    ).toThrow('ACCOUNT_PUBLICATION_UNAVAILABLE');
  });

  it.each([
    [401, 'ACCOUNT_PUBLICATION_SESSION_REJECTED'],
    [409, 'ACCOUNT_DELETION_ACTIVE'],
    [409, 'ACCOUNT_PUBLICATION_LEASE_REJECTED'],
    [503, 'ACCOUNT_PUBLICATION_UNAVAILABLE'],
  ] as const)('maps only the exact %s response %s', (status, code) => {
    expect(() =>
      parseAccountPublicationResponse('publication_reserve', status, { error: code }),
    ).toThrow(code);
    expect(() =>
      parseAccountPublicationResponse('publication_reserve', status, { error: code, detail: '' }),
    ).toThrow('ACCOUNT_PUBLICATION_UNAVAILABLE');
  });

  it.each(['publication_reserve', 'publication_activate', 'publication_renew'] as const)(
    'sends the exact authenticated %s request without redirects or caching',
    async (action) => {
      const expectedStatus = action === 'publication_reserve' ? 'reserved' : 'active';
      const transport = vi.fn(
        async (_input: string | URL | Request, _init?: RequestInit) =>
          new Response(JSON.stringify({ status: expectedStatus }), { status: 200 }),
      );

      await expect(
        exchangeAccountPublicationFence(action, CAPABILITY, BINDING, transport),
      ).resolves.toBe(expectedStatus);

      const [url, init] = transport.mock.calls[0]!;
      expect(url).toBe('https://project.supabase.co/functions/v1/account-deletion');
      expect(String(url)).not.toContain(CAPABILITY);
      expect(init).toMatchObject({
        method: 'POST',
        body: JSON.stringify({ action, capability: CAPABILITY }),
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'error',
        headers: {
          Accept: 'application/json',
          apikey: 'sb_publishable_test',
          Authorization: 'Bearer signed.session.token',
          'Content-Type': 'application/json',
        },
      });
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      expect(remoteGateMock.runDeletionPermit).toHaveBeenCalledWith(
        { action, binding: BINDING, timeoutMs: 15_000 },
        transport,
        expect.any(Function),
      );
    },
  );

  it('releases with the capability only and never sends a bearer', async () => {
    const transport = vi.fn(
      async (_input: string | URL | Request, _init?: RequestInit) =>
        new Response(JSON.stringify({ status: 'released' }), { status: 200 }),
    );

    await expect(
      exchangeAccountPublicationFence('publication_release', CAPABILITY, undefined, transport),
    ).resolves.toBe('released');
    const [, init] = transport.mock.calls[0]!;
    expect(init?.headers).not.toHaveProperty('Authorization');
    expect(init?.body).toBe(
      JSON.stringify({ action: 'publication_release', capability: CAPABILITY }),
    );
  });

  it('settles unavailable at the deadline even when transport ignores abort', async () => {
    vi.useFakeTimers();
    let observedSignal: AbortSignal | undefined;
    const transport = vi.fn(
      (_input: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>(() => {
          observedSignal = init?.signal ?? undefined;
        }),
    );

    const pending = exchangeAccountPublicationFence(
      'publication_reserve',
      CAPABILITY,
      BINDING,
      transport,
    );
    const rejected = expect(pending).rejects.toThrow('ACCOUNT_PUBLICATION_UNAVAILABLE');
    await vi.advanceTimersByTimeAsync(15_000);
    await rejected;
    expect(observedSignal?.aborted).toBe(true);
  });

  it('bounds responses and never reflects a capability from transport errors', async () => {
    const oversized = vi.fn(
      async () =>
        new Response(JSON.stringify({ status: 'reserved', padding: 'x'.repeat(2_000) }), {
          status: 200,
        }),
    );
    await expect(
      exchangeAccountPublicationFence('publication_reserve', CAPABILITY, BINDING, oversized),
    ).rejects.toThrow('ACCOUNT_PUBLICATION_UNAVAILABLE');

    const leakingTransport = vi.fn(async () => {
      throw new Error(`network failed for ${CAPABILITY}`);
    });
    const error = await exchangeAccountPublicationFence(
      'publication_reserve',
      CAPABILITY,
      BINDING,
      leakingTransport,
    ).catch((caught: unknown) => caught);
    expect(error).toMatchObject({ message: 'ACCOUNT_PUBLICATION_UNAVAILABLE' });
    expect(String(error)).not.toContain(CAPABILITY);
  });

  it.each(['SUPABASE_REMOTE_REQUEST_BINDING_REJECTED', 'SUPABASE_REMOTE_REQUEST_RESULT_STALE'])(
    'fails closed before transport when the exact-bound permit rejects with %s',
    async (code) => {
      const transport = vi.fn();
      remoteGateMock.runDeletionPermit.mockRejectedValueOnce(new Error(code));

      await expect(
        exchangeAccountPublicationFence('publication_reserve', CAPABILITY, BINDING, transport),
      ).rejects.toThrow('ACCOUNT_PUBLICATION_UNAVAILABLE');

      expect(transport).not.toHaveBeenCalled();
    },
  );

  it('binds only canonical matching subject and session claims', () => {
    const accessToken = jwt({ sub: SUBJECT, session_id: SESSION_ID });
    expect(accountPublicationSessionBinding(accessToken, SUBJECT)).toEqual({
      subject: SUBJECT,
      sessionId: SESSION_ID,
      accessToken,
    });
    expect(accountPublicationSessionBinding(accessToken, SESSION_ID)).toBeNull();
    expect(accountPublicationSessionBinding(jwt({ sub: SUBJECT }), SUBJECT)).toBeNull();
    expect(
      accountPublicationSessionBinding(jwt({ sub: SUBJECT, session_id: 'not-a-session' }), SUBJECT),
    ).toBeNull();
    expect(accountPublicationSessionBinding('not.a.jwt.with.extras', SUBJECT)).toBeNull();
  });

  it('rejects invalid local arguments before transport work', async () => {
    const transport = vi.fn();
    const actions: AccountPublicationAction[] = ['publication_reserve', 'publication_release'];
    await expect(
      exchangeAccountPublicationFence(actions[0]!, 'not-a-capability', BINDING, transport),
    ).rejects.toThrow('ACCOUNT_PUBLICATION_UNAVAILABLE');
    await expect(
      exchangeAccountPublicationFence(actions[1]!, CAPABILITY, BINDING, transport),
    ).rejects.toThrow('ACCOUNT_PUBLICATION_UNAVAILABLE');
    expect(transport).not.toHaveBeenCalled();
  });
});
