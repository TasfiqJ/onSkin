import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  activeAccountDeletionOwnsLocalData,
  fetchAccountDeletionBarrierState,
  parseAccountDeletionBarrierResponse,
  type ActiveAccountDeletionOwnerProofDependencies,
} from './accountDeletionBarrier';

const remoteGateMocks = vi.hoisted(() => ({
  requireBinding: vi.fn((accessToken: string, subject: string) => ({
    accessToken,
    sessionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    subject,
  })),
  runDeletionPermit: vi.fn(async (_permit, transport, operation) => operation(transport)),
}));

vi.mock('@/lib/env', () => ({
  env: {
    supabaseUrl: 'https://project.supabase.co',
    supabasePublishableKey: 'sb_publishable_test',
  },
}));
vi.mock('@/lib/supabase/remoteRequestGate', () => ({
  requireSupabaseRemoteSessionBinding: remoteGateMocks.requireBinding,
  runWithSupabaseAccountDeletionRequestPermit: remoteGateMocks.runDeletionPermit,
}));

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('account deletion barrier preflight', () => {
  const USER_B = '22222222-2222-4222-8222-222222222222';

  function ownerProofDependencies(
    options: {
      ownership?: 'cleanup_required' | 'match' | 'mismatch' | 'retained' | 'unclaimed';
      readLocalDataOwnership?: (
        userId: string,
      ) => Promise<'cleanup_required' | 'match' | 'mismatch' | 'retained' | 'unclaimed'>;
    } = {},
  ): ActiveAccountDeletionOwnerProofDependencies {
    return {
      readLocalDataOwnership: vi.fn(
        options.readLocalDataOwnership ?? (async () => options.ownership ?? 'match'),
      ),
    };
  }

  it('preserves A local private data when candidate B has the active remote barrier', async () => {
    const dependencies = ownerProofDependencies({ ownership: 'mismatch' });

    await expect(activeAccountDeletionOwnsLocalData(USER_B, dependencies)).resolves.toBe(
      'preserve',
    );

    expect(dependencies.readLocalDataOwnership).toHaveBeenCalledWith(USER_B);
  });

  it('authorizes B local private cleanup from the authenticated preflight subject', async () => {
    const dependencies = ownerProofDependencies({ ownership: 'match' });

    await expect(activeAccountDeletionOwnsLocalData(USER_B, dependencies)).resolves.toBe('clear');

    expect(dependencies.readLocalDataOwnership).toHaveBeenCalledWith(USER_B);
  });

  it.each([
    {
      label: 'local proof unavailable',
      options: {
        readLocalDataOwnership: async () => Promise.reject(new Error('storage unavailable')),
      },
    },
    {
      label: 'full proof inconsistent',
      options: {
        readLocalDataOwnership: async () =>
          Promise.reject(new Error('LOCAL_DATA_OWNER_PROOF_INVALID')),
      },
    },
  ])('fails closed without invalidating the session when $label', async ({ options }) => {
    await expect(
      activeAccountDeletionOwnsLocalData(USER_B, ownerProofDependencies(options)),
    ).rejects.toThrow('ACCOUNT_DELETION_BARRIER_PREFLIGHT_FAILED');
  });

  it('classifies missing local ownership as unclaimed without authorizing private cleanup', async () => {
    await expect(
      activeAccountDeletionOwnsLocalData(
        USER_B,
        ownerProofDependencies({ ownership: 'unclaimed' }),
      ),
    ).resolves.toBe('unclaimed');
  });

  it('preserves a retained foreign-owner proof without authorizing cleanup', async () => {
    await expect(
      activeAccountDeletionOwnsLocalData(USER_B, ownerProofDependencies({ ownership: 'retained' })),
    ).resolves.toBe('preserve');
  });

  it('resumes an already-authorized interrupted cleanup before forced sign-out', async () => {
    await expect(
      activeAccountDeletionOwnsLocalData(
        USER_B,
        ownerProofDependencies({ ownership: 'cleanup_required' }),
      ),
    ).resolves.toBe('clear');
  });

  it('rejects a malformed authenticated subject before deriving a local binding', async () => {
    const dependencies = ownerProofDependencies();

    await expect(activeAccountDeletionOwnsLocalData('not-a-subject', dependencies)).rejects.toThrow(
      'ACCOUNT_DELETION_BARRIER_PREFLIGHT_FAILED',
    );
    expect(dependencies.readLocalDataOwnership).not.toHaveBeenCalled();
  });

  it.each([
    [
      { status: 'clear', ownerSubject: USER_B },
      { status: 'clear', ownerSubject: USER_B },
    ],
    [
      { status: 'active', ownerSubject: USER_B },
      { status: 'active', ownerSubject: USER_B },
    ],
  ] as const)(
    'accepts only the owner-attested response for the exact bearer session %#',
    async (responseBody, expected) => {
      const transport = vi.fn(
        async (_input: string | URL | Request, _init?: RequestInit) =>
          new Response(JSON.stringify(responseBody), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
      );

      await expect(
        fetchAccountDeletionBarrierState('candidate-jwt', USER_B, transport),
      ).resolves.toEqual(expected);
      expect(transport).toHaveBeenCalledOnce();
      const [url, init] = transport.mock.calls[0]!;
      expect(url).toBe('https://project.supabase.co/functions/v1/account-deletion');
      expect(init).toMatchObject({
        method: 'POST',
        body: JSON.stringify({ action: 'preflight' }),
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'error',
        headers: {
          apikey: 'sb_publishable_test',
          Authorization: 'Bearer candidate-jwt',
        },
      });
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      expect(remoteGateMocks.requireBinding).toHaveBeenCalledWith('candidate-jwt', USER_B);
      expect(remoteGateMocks.runDeletionPermit).toHaveBeenCalledWith(
        {
          action: 'preflight',
          timeoutMs: 15_000,
          binding: {
            accessToken: 'candidate-jwt',
            sessionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            subject: USER_B,
          },
        },
        transport,
        expect.any(Function),
      );
    },
  );

  it('fails closed for status errors, extras, malformed state, and oversized bodies', async () => {
    expect(() =>
      parseAccountDeletionBarrierResponse(401, {
        error: 'ACCOUNT_DELETION_SESSION_REJECTED',
      }),
    ).toThrow('ACCOUNT_DELETION_BARRIER_SESSION_REJECTED');
    expect(() => parseAccountDeletionBarrierResponse(401, { error: 'UNAUTHORIZED' })).toThrow(
      'ACCOUNT_DELETION_BARRIER_PREFLIGHT_FAILED',
    );
    expect(() =>
      parseAccountDeletionBarrierResponse(200, {
        status: 'active',
        operationId: 'must-not-cross-boundary',
      }),
    ).toThrow('ACCOUNT_DELETION_BARRIER_PREFLIGHT_FAILED');
    expect(() => parseAccountDeletionBarrierResponse(200, { status: 'unknown' })).toThrow(
      'ACCOUNT_DELETION_BARRIER_PREFLIGHT_FAILED',
    );
    expect(() => parseAccountDeletionBarrierResponse(200, { status: 'active' })).toThrow(
      'ACCOUNT_DELETION_BARRIER_PREFLIGHT_FAILED',
    );
    expect(() => parseAccountDeletionBarrierResponse(200, { status: 'clear' })).toThrow(
      'ACCOUNT_DELETION_BARRIER_PREFLIGHT_FAILED',
    );
    expect(() =>
      parseAccountDeletionBarrierResponse(200, {
        status: 'active',
        ownerSubject: 'not-a-subject',
      }),
    ).toThrow('ACCOUNT_DELETION_BARRIER_PREFLIGHT_FAILED');

    const oversized = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            status: 'clear',
            ownerSubject: USER_B,
            padding: 'x'.repeat(2_000),
          }),
          { status: 200 },
        ),
    );
    await expect(
      fetchAccountDeletionBarrierState('candidate-jwt', USER_B, oversized),
    ).rejects.toThrow('ACCOUNT_DELETION_BARRIER_PREFLIGHT_FAILED');
  });

  it('rejects a valid-looking response attested for a foreign owner subject', async () => {
    const foreignSubject = '33333333-3333-4333-8333-333333333333';
    const transport = vi.fn(
      async () =>
        new Response(JSON.stringify({ status: 'clear', ownerSubject: foreignSubject }), {
          status: 200,
        }),
    );

    await expect(
      fetchAccountDeletionBarrierState('candidate-jwt', USER_B, transport),
    ).rejects.toThrow('ACCOUNT_DELETION_BARRIER_PREFLIGHT_FAILED');
  });

  it('does not dispatch after the candidate permit becomes stale', async () => {
    const transport = vi.fn();
    remoteGateMocks.runDeletionPermit.mockRejectedValueOnce(
      new Error('SUPABASE_REMOTE_REQUEST_RESULT_STALE'),
    );

    await expect(
      fetchAccountDeletionBarrierState('candidate-jwt', USER_B, transport),
    ).rejects.toThrow('ACCOUNT_DELETION_BARRIER_PREFLIGHT_FAILED');

    expect(transport).not.toHaveBeenCalled();
  });

  it('distinguishes exact bearer rejection from a retryable server outage', async () => {
    const rejected = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: 'ACCOUNT_DELETION_SESSION_REJECTED' }), {
          status: 401,
        }),
    );
    const unclassified401 = vi.fn(
      async () => new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), { status: 401 }),
    );
    const unavailable = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: 'ACCOUNT_DELETION_UNAVAILABLE' }), { status: 503 }),
    );

    await expect(
      fetchAccountDeletionBarrierState('stale-jwt', USER_B, rejected),
    ).rejects.toMatchObject({ code: 'ACCOUNT_DELETION_BARRIER_SESSION_REJECTED' });
    await expect(
      fetchAccountDeletionBarrierState('candidate-jwt', USER_B, unclassified401),
    ).rejects.toMatchObject({
      code: 'ACCOUNT_DELETION_BARRIER_PREFLIGHT_FAILED',
    });
    await expect(
      fetchAccountDeletionBarrierState('candidate-jwt', USER_B, unavailable),
    ).rejects.toMatchObject({
      code: 'ACCOUNT_DELETION_BARRIER_PREFLIGHT_FAILED',
    });
  });

  it('settles at the deadline even when the transport ignores AbortSignal forever', async () => {
    vi.useFakeTimers();
    let observedSignal: AbortSignal | undefined;
    const transport = vi.fn(
      (_input: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>(() => {
          observedSignal = init?.signal ?? undefined;
        }),
    );

    const pending = fetchAccountDeletionBarrierState('candidate-jwt', USER_B, transport);
    const rejected = expect(pending).rejects.toThrow('ACCOUNT_DELETION_BARRIER_PREFLIGHT_FAILED');
    await vi.advanceTimersByTimeAsync(15_000);
    await rejected;
    expect(observedSignal?.aborted).toBe(true);
  });

  it('ignores a late clear response after the fail-closed deadline', async () => {
    vi.useFakeTimers();
    let resolveTransport!: (response: Response) => void;
    const transport = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveTransport = resolve;
        }),
    );

    const outcome = fetchAccountDeletionBarrierState('candidate-jwt', USER_B, transport).then(
      (state) => `published:${state}`,
      (error: unknown) => (error instanceof Error ? error.message : 'unknown'),
    );
    await vi.advanceTimersByTimeAsync(15_000);
    await expect(outcome).resolves.toBe('ACCOUNT_DELETION_BARRIER_PREFLIGHT_FAILED');

    resolveTransport(
      new Response(JSON.stringify({ status: 'clear', ownerSubject: USER_B }), { status: 200 }),
    );
    await Promise.resolve();
    await expect(outcome).resolves.toBe('ACCOUNT_DELETION_BARRIER_PREFLIGHT_FAILED');
  });

  it('rejects missing and whitespace-padded bearer values without transport work', async () => {
    const transport = vi.fn();
    await expect(fetchAccountDeletionBarrierState('', USER_B, transport)).rejects.toThrow(
      'ACCOUNT_DELETION_BARRIER_PREFLIGHT_FAILED',
    );
    await expect(fetchAccountDeletionBarrierState(' padded ', USER_B, transport)).rejects.toThrow(
      'ACCOUNT_DELETION_BARRIER_PREFLIGHT_FAILED',
    );
    expect(transport).not.toHaveBeenCalled();
  });
});
