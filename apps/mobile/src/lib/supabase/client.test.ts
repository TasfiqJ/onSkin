import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  processLock: vi.fn(async (_name: string, _timeout: number, operation: () => Promise<unknown>) =>
    operation(),
  ),
  removeItem: vi.fn(),
  setItem: vi.fn(),
  signOut: vi.fn(),
  stopAutoRefresh: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => {
    mocks.createClient(...args);
    return {
      auth: {
        signOut: mocks.signOut,
        stopAutoRefresh: mocks.stopAutoRefresh,
      },
    };
  },
  processLock: mocks.processLock,
}));

vi.mock('react-native-url-polyfill/auto', () => ({}));

vi.mock('../env', () => ({
  env: {
    supabasePublishableKey: 'publishable-key',
    supabaseUrl: 'https://project.supabase.co',
  },
}));

vi.mock('./largeSecureStore', () => ({
  LargeSecureStore: class {
    removeItem = mocks.removeItem;
    setItem = mocks.setItem;
  },
}));

describe('Supabase local session invalidation', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('window', {});
    mocks.createClient.mockClear();
    mocks.processLock.mockClear();
    mocks.removeItem.mockReset().mockResolvedValue(undefined);
    mocks.signOut.mockReset().mockResolvedValue({ error: null });
    mocks.setItem.mockReset().mockResolvedValue(undefined);
    mocks.stopAutoRefresh.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('advances auth-js through public local sign-out before verifying storage removal', async () => {
    const { invalidateLocalSupabaseSession } = await import('./client');

    await expect(invalidateLocalSupabaseSession()).resolves.toBeUndefined();

    expect(mocks.stopAutoRefresh).toHaveBeenCalledOnce();
    expect(mocks.signOut).toHaveBeenCalledExactlyOnceWith({ scope: 'local' });
    expect(mocks.removeItem).toHaveBeenNthCalledWith(1, 'sb-project-auth-token');
    expect(mocks.removeItem).toHaveBeenNthCalledWith(2, 'sb-project-auth-token-code-verifier');
    expect(mocks.signOut.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.removeItem.mock.invocationCallOrder[0]!,
    );
  });

  it('runs provider commits under the exact auth-js storage process lock', async () => {
    const { runSupabaseAuthStorageMutation } = await import('./client');
    const operation = vi.fn(async () => 'complete');

    await expect(runSupabaseAuthStorageMutation(operation)).resolves.toBe('complete');

    expect(mocks.processLock).toHaveBeenCalledExactlyOnceWith(
      'lock:sb-project-auth-token',
      -1,
      operation,
    );
  });

  it('fails closed without raw cleanup when auth-js cannot invalidate its refresh epoch', async () => {
    mocks.signOut.mockResolvedValueOnce({ error: new Error('network unavailable') });
    const { invalidateLocalSupabaseSession } = await import('./client');

    await expect(invalidateLocalSupabaseSession()).rejects.toThrow(
      'SUPABASE_LOCAL_SESSION_INVALIDATION_FAILED',
    );

    expect(mocks.stopAutoRefresh).toHaveBeenCalledOnce();
    expect(mocks.removeItem).not.toHaveBeenCalled();
  });

  it('prevents an already-started refresh from resurrecting a deleted session', async () => {
    let removalEpoch = 0;
    let releaseRefresh!: () => void;
    const refresh = new Promise<void>((resolve) => {
      releaseRefresh = resolve;
    }).then(async () => {
      const epochBeforeSave = 0;
      if (removalEpoch !== epochBeforeSave) return;
      await mocks.setItem('sb-project-auth-token', 'ghost-session');
    });
    mocks.signOut.mockImplementationOnce(async () => {
      // auth-js `_removeSession` performs this synchronously before storage I/O.
      removalEpoch += 1;
      return { error: null };
    });
    const { invalidateLocalSupabaseSession } = await import('./client');

    await invalidateLocalSupabaseSession();
    releaseRefresh();
    await refresh;

    expect(mocks.setItem).not.toHaveBeenCalled();
    expect(mocks.removeItem).toHaveBeenCalledTimes(2);
  });
});
