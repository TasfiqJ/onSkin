import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { processLock } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('Supabase auth storage lock contract', () => {
  it('uses one exact process lock for auth-js and manual provider commits', () => {
    const source = readFileSync(fileURLToPath(new URL('./client.ts', import.meta.url)), 'utf8');

    expect(source).toContain("import { createClient, processLock } from '@supabase/supabase-js';");
    expect(source).toContain('const authStorageLockName = `lock:${authStorageKey}`;');
    expect(source).toContain('lock: processLock');
    expect(source).toContain('return processLock(authStorageLockName, -1, operation);');
  });

  it('keeps queued reads behind a hung provider save and makes auto ticks fail fast', async () => {
    const lockName = 'provider-auth-storage-contract';
    const providerStarted = deferred();
    const allowProviderToSettle = deferred();
    const provider = processLock(lockName, -1, async () => {
      providerStarted.resolve();
      await allowProviderToSettle.promise;
    });
    await providerStarted.promise;

    let queuedReadStarted = false;
    const queuedRead = processLock(lockName, -1, async () => {
      queuedReadStarted = true;
    });
    let autoTickStarted = false;
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const autoTick = processLock(lockName, 0, async () => {
      autoTickStarted = true;
    });

    await expect(autoTick).rejects.toThrow('timed out');
    expect(autoTickStarted).toBe(false);
    expect(queuedReadStarted).toBe(false);

    allowProviderToSettle.resolve();
    await provider;
    await queuedRead;
    warning.mockRestore();

    expect(queuedReadStarted).toBe(true);
  });
});
