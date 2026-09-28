import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

import { OperatorAuth } from './auth';
import type { OperatorConsoleEnvironment } from './env';

const environment: OperatorConsoleEnvironment = {
  environment: 'local',
  supabaseUrl: 'http://127.0.0.1:54321',
  publishableKey: 'sb_publishable_012345678901234567890123456789',
  operatorApiUrl: 'http://127.0.0.1:54321/functions/v1/catalog-operator',
};

function client(
  signOut: () => Promise<{ error: Error | null }>,
  token: string,
  stopAutoRefresh = vi.fn(),
): SupabaseClient {
  return {
    auth: {
      signOut,
      stopAutoRefresh,
      getSession: vi.fn(async () => ({
        data: { session: { access_token: token } },
        error: null,
      })),
    },
  } as unknown as SupabaseClient;
}

describe('OperatorAuth sign-out disposal', () => {
  it('retires and replaces the in-memory client after successful sign-out', async () => {
    const stop = vi.fn();
    const clients = [
      client(vi.fn(async () => ({ error: null })), 'retired', stop),
      client(vi.fn(async () => ({ error: null })), 'replacement'),
    ];
    const auth = new OperatorAuth(environment, () => {
      const next = clients.shift();
      if (!next) throw new Error('unexpected client creation');
      return next;
    });

    await auth.signOut();

    expect(stop).toHaveBeenCalledTimes(2);
    await expect(auth.accessToken()).resolves.toBe('replacement');
  });

  it('still destroys the token-bearing client when sign-out returns or throws an error', async () => {
    for (const signOut of [
      vi.fn(async () => ({ error: new Error('network') })),
      vi.fn(async () => {
        throw new Error('transport');
      }),
    ]) {
      const stop = vi.fn();
      const replacement = client(
        vi.fn(async () => ({ error: null })),
        'replacement',
      );
      const clients = [client(signOut, 'retired', stop), replacement];
      const auth = new OperatorAuth(environment, () => {
        const next = clients.shift();
        if (!next) throw new Error('unexpected client creation');
        return next;
      });

      await expect(auth.signOut()).rejects.toThrow(
        'The operator session could not be revoked.',
      );
      expect(stop).toHaveBeenCalledTimes(2);
      await expect(auth.accessToken()).resolves.toBe('replacement');
    }
  });
});
