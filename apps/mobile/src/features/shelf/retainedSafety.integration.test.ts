import { randomUUID } from 'node:crypto';
import { createElement } from 'react';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const native = vi.hoisted(() => ({
  bytes: new Map<string, string>(),
  writeGate: null as Promise<void> | null,
  writeStarted: null as (() => void) | null,
  unavailable: false,
}));
vi.mock('react-native-get-random-values', () => ({}));
vi.mock('react-native', () => ({ Platform: { OS: 'web' } }));
vi.mock('expo-crypto', () => ({ randomUUID }));
vi.mock('expo-secure-store', () => ({}));
vi.mock('@/features/today/useToday', () => ({ localDateString: () => '2026-10-20' }));
vi.mock('@/features/scheduler/profile', () => ({ readProfileBits: async () => ({}) }));
vi.mock('@/features/intelligence/overrides', () => ({ getConflictChoices: async () => ({}) }));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => {
      if (native.unavailable) throw new Error('NATIVE_STORE_UNAVAILABLE');
      return native.bytes.get(key) ?? null;
    },
    setItem: async (key: string, raw: string) => {
      if (native.unavailable) throw new Error('NATIVE_STORE_UNAVAILABLE');
      if (key === 'layerwell.shelf.v1' && native.writeGate) {
        const gate = native.writeGate;
        native.writeGate = null;
        native.writeStarted?.();
        await gate;
      }
      native.bytes.set(key, raw);
    },
    getAllKeys: async () => [...native.bytes.keys()],
    multiGet: async (keys: string[]) => keys.map((key) => [key, native.bytes.get(key) ?? null]),
    removeItem: async (key: string) => {
      native.bytes.delete(key);
    },
    multiRemove: async (keys: string[]) => {
      keys.forEach((key) => native.bytes.delete(key));
    },
  },
}));

async function domain() {
  const epoch = await import('@/lib/consent/healthProcessingEpoch');
  const account = await import('@/lib/auth/accountGeneration');
  const kv = await import('@/lib/storage/privateKV');
  const shelf = await import('./store');
  const age = await import('@/features/onboarding/ageGateStore');
  return { epoch, account, kv, shelf, age };
}
const shelfKey = 'layerwell.shelf.v1';
const input = {
  name: 'Synthetic local moisturizer',
  addedVia: 'manual' as const,
  operationId: '11111111-1111-4111-8111-111111111111',
};

beforeEach(() => {
  vi.resetModules();
  native.bytes.clear();
  native.writeGate = null;
  native.writeStarted = null;
  native.unavailable = false;
});

describe('retained encrypted Shelf with real account and health fences', () => {
  it('publishes a durable offline save through the actual Shelf query cache', async () => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    const d = await domain();
    d.epoch.setActiveHealthProcessingEpoch(1, { ownerUserId: 'owner-a', accountGeneration: 0 });
    await d.shelf.addProduct(input);
    const { QueryClient, QueryClientProvider, onlineManager } =
      await import('@tanstack/react-query');
    const { useShelf } = await import('./useShelf');
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    let visibleCount = 0;
    function Surface() {
      visibleCount = useShelf().data?.items.length ?? 0;
      return null;
    }
    let rendered!: ReturnType<typeof create>;
    onlineManager.setOnline(true);
    try {
      await act(async () => {
        rendered = create(createElement(QueryClientProvider, { client }, createElement(Surface)));
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 30));
      });
      expect(visibleCount).toBe(1);
      onlineManager.setOnline(false);
      await act(async () => {
        await d.shelf.addProduct({
          ...input,
          operationId: randomUUID(),
          name: 'Second offline item',
        });
        await client.invalidateQueries({ queryKey: ['shelf'] });
        await new Promise((resolve) => setTimeout(resolve, 30));
      });
      expect(await d.shelf.loadShelf()).toHaveLength(2);
      expect(visibleCount).toBe(2);
    } finally {
      onlineManager.setOnline(true);
      await act(async () => rendered?.unmount());
      client.clear();
    }
  });
  it('cold-writes and relaunches an encrypted receipt and one idempotent offline Shelf item', async () => {
    let d = await domain();
    await d.age.setAgeVerified(true);
    expect(await d.age.getAgePolicyReceiptStatus()).toBe('current');
    await expect(d.shelf.loadShelf()).rejects.toThrow('HEALTH_DATA_WRITE_ADMISSION_CLOSED');
    d.epoch.setActiveHealthProcessingEpoch(1, { ownerUserId: 'owner-a', accountGeneration: 0 });
    const [one, duplicate] = await Promise.all([
      d.shelf.addProduct(input),
      d.shelf.addProduct(input),
    ]);
    expect(one.id).toBe(duplicate.id);
    expect(await d.shelf.loadShelf()).toHaveLength(1);
    expect(native.bytes.get(shelfKey)).not.toContain(input.name);
    vi.resetModules();
    d = await domain();
    expect(await d.age.getAgePolicyReceiptStatus()).toBe('current');
    await expect(d.shelf.loadShelf()).rejects.toThrow();
    d.epoch.setActiveHealthProcessingEpoch(1, { ownerUserId: 'owner-a', accountGeneration: 0 });
    expect((await d.shelf.loadShelf())[0]?.name).toBe(input.name);
    await d.shelf.updateProduct(one.id, { status: 'finished', finishedAt: '2026-10-20' });
    expect((await d.shelf.loadShelf())[0]?.status).toBe('finished');
    await d.shelf.removeProduct(one.id);
    expect(await d.shelf.loadShelf()).toEqual([]);
  });

  it('keeps corrupt, unsupported and unavailable bytes closed without empty success or replacement', async () => {
    const d = await domain();
    d.epoch.setActiveHealthProcessingEpoch(1, { ownerUserId: 'owner-a', accountGeneration: 0 });
    await d.shelf.addProduct(input);
    const valid = native.bytes.get(shelfKey)!;
    for (const raw of [valid.slice(0, -3), JSON.stringify({ version: 'xchacha20poly1305:v99' })]) {
      native.bytes.set(shelfKey, raw);
      await expect(d.shelf.loadShelf()).rejects.toThrow();
      await expect(d.shelf.addProduct(input)).rejects.toThrow();
      expect(native.bytes.get(shelfKey)).toBe(raw);
    }
    native.bytes.set(shelfKey, valid);
    native.unavailable = true;
    await expect(d.shelf.loadShelf()).rejects.toThrow();
    expect(native.bytes.get(shelfKey)).toBe(valid);
  });

  it.each(['account switch', 'withdrawal'] as const)(
    'rejects and rolls back a late native write after %s',
    async (boundary) => {
      const d = await domain();
      d.epoch.setActiveHealthProcessingEpoch(1, { ownerUserId: 'owner-a', accountGeneration: 0 });
      await d.shelf.addProduct(input);
      const before = native.bytes.get(shelfKey);
      let release!: () => void;
      native.writeGate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const started = new Promise<void>((resolve) => {
        native.writeStarted = resolve;
      });
      const writing = d.shelf.addProduct({
        ...input,
        name: 'Late owner A',
        operationId: randomUUID(),
      });
      const rejected = expect(writing).rejects.toThrow();
      await started;
      if (boundary === 'account switch') d.account.beginAccountGenerationBoundary();
      else d.epoch.clearActiveHealthProcessingEpoch();
      release();
      await rejected;
      if (boundary === 'account switch') {
        await d.account.waitForAccountGenerationOperationsToSettle();
        d.account.endAccountGenerationBoundary();
      }
      expect(native.bytes.get(shelfKey)).toBe(before);
      await expect(d.shelf.loadShelf()).rejects.toThrow();
      // Real account/purpose cleanup removes the record before publication.
      native.bytes.delete(shelfKey);
      d.epoch.setActiveHealthProcessingEpoch(2, {
        ownerUserId: 'owner-b',
        accountGeneration: boundary === 'account switch' ? 1 : 0,
      });
      expect(await d.shelf.loadShelf()).toEqual([]);
      expect(native.bytes.get(shelfKey)).toBeUndefined();
    },
  );
});
