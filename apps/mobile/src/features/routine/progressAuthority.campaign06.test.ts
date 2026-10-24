import { randomUUID } from 'node:crypto';
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { createElement, useEffect } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { runAccountGenerationOperation } from '@/lib/auth/accountGeneration';
import {
  clearActiveHealthProcessingEpoch,
  setActiveHealthProcessingEpoch,
} from '@/lib/consent/healthProcessingEpoch';
import { toggleCompletion } from '@/features/today/completionsStore';
import { localDateString } from '@/features/today/useToday';
import { useProgress } from './useProgress';

// Only platform/network boundaries: real encrypted KV, completion journal,
// account/health leases, clock, React Query and progress projection.
const ports = vi.hoisted(() => ({
  bytes: new Map<string, string>(),
  fail: false,
  hold: false,
  release: null as (() => void) | null,
}));
vi.mock('react-native-get-random-values', () => ({}));
vi.mock('expo-crypto', () => ({ randomUUID }));
vi.mock('expo-secure-store', () => ({}));
vi.mock('react-native', () => ({
  Platform: { OS: 'web' },
  AppState: {
    currentState: 'active',
    addEventListener: () => ({ remove() {} }),
  },
}));
vi.mock('@/lib/env', () => ({ isSupabaseConfigured: false }));
vi.mock('@/lib/supabase/client', () => ({ supabase: {} }));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => {
      if (key === 'layerwell.completions.v1' && ports.fail)
        throw new Error('SYNTHETIC_READ_REFUSAL');
      const snapshot = ports.bytes.get(key) ?? null;
      if (key === 'layerwell.completions.v1' && ports.hold) {
        ports.hold = false;
        await new Promise<void>((resolve) => {
          ports.release = resolve;
        });
      }
      return snapshot;
    },
    setItem: async (key: string, value: string) => {
      ports.bytes.set(key, value);
    },
    removeItem: async (key: string) => {
      ports.bytes.delete(key);
    },
    getAllKeys: async () => [...ports.bytes.keys()],
    multiGet: async (keys: string[]) => keys.map((key) => [key, ports.bytes.get(key) ?? null]),
  },
}));

let client: QueryClient;
let renderer: ReactTestRenderer | undefined;
let source: ReturnType<typeof useProgress>;
const observations: (number | undefined)[] = [];
function Probe() {
  const next = useProgress();
  observations.push(next.data?.streak);
  useEffect(() => {
    source = next;
  });
  return null;
}
async function grant(owner = 'synthetic-progress-a', expiring = false) {
  clearActiveHealthProcessingEpoch();
  const accountGeneration = await runAccountGenerationOperation((lease) => lease.generation);
  setActiveHealthProcessingEpoch(1, {
    ownerUserId: owner,
    accountGeneration,
    ...(expiring ? { serverVerifiedAt: new Date(Date.now() - 299_950).toISOString() } : {}),
  });
}
async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}
async function mount() {
  await act(async () => {
    renderer = create(createElement(QueryClientProvider, { client }, createElement(Probe)));
  });
  await flush();
}
beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  ports.bytes.clear();
  ports.fail = false;
  ports.hold = false;
  ports.release = null;
  observations.length = 0;
  await grant();
  await toggleCompletion('PM:synthetic', localDateString(), {
    phase: 'PM',
    stepKeys: ['PM:synthetic'],
  });
  expect(ports.bytes.get('layerwell.completions.v1')).not.toContain('PM:synthetic');
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 60_000, gcTime: Infinity } },
  });
  onlineManager.setOnline(false);
});
afterEach(async () => {
  await act(async () => {
    renderer?.unmount();
    ports.release?.();
  });
  renderer = undefined;
  client.clear();
  clearActiveHealthProcessingEpoch();
  onlineManager.setOnline(true);
});

it.each(['synthetic-progress-b', 'synthetic-progress-a'])(
  'never carries cached totals into a new grant for %s',
  async (owner) => {
    await mount();
    expect(source.data?.streak).toBe(1);
    observations.length = 0;
    ports.bytes.delete('layerwell.completions.v1');
    ports.hold = true;
    await act(async () => {
      await grant(owner);
    });
    expect(source.data).toBeUndefined();
    expect(observations).not.toContain(1);
    await act(async () => {
      ports.release?.();
    });
    await flush();
    // Grant replacement never silently restarts a retired read. Explicit retry
    // adopts the current authority; ordinary app reentry mounts a new observer.
    ports.hold = false;
    await act(async () => {
      await source.refetch();
    });
    await flush();
    expect(source.data?.streak).toBe(0);
  },
);

it('closes already visible totals at withdrawal without requiring a parent remount', async () => {
  await mount();
  expect(source.data?.streak).toBe(1);
  await act(async () => {
    clearActiveHealthProcessingEpoch();
  });
  expect(source.data).toBeUndefined();
});

it('does not reuse A totals after A to B to A', async () => {
  await mount();
  ports.bytes.delete('layerwell.completions.v1');
  await act(async () => {
    await grant('synthetic-progress-b');
  });
  await flush();
  await act(async () => {
    await grant();
  });
  await flush();
  await act(async () => {
    await source.refetch();
  });
  await flush();
  expect(source.data?.streak).toBe(0);
});

it('withholds prior observations while a current read is pending and recovers offline after refusal', async () => {
  await mount();
  ports.hold = true;
  await act(async () => {
    void source.refetch();
  });
  await flush();
  expect(source.data).toBeUndefined();
  await act(async () => {
    ports.release?.();
  });
  await flush();
  ports.fail = true;
  await act(async () => {
    await source.refetch();
  });
  await flush();
  expect(source.data).toBeUndefined();
  expect(source.isError).toBe(true);
  ports.fail = false;
  await act(async () => {
    await source.refetch();
  });
  await flush();
  expect(source.data?.streak).toBe(1);
  expect(source.isPaused).toBe(false);
});

it('retires a delayed old read before a replacement owner obtains its own projection', async () => {
  ports.hold = true;
  await mount();
  const release = ports.release;
  ports.bytes.delete('layerwell.completions.v1');
  await act(async () => {
    await grant('synthetic-progress-b');
  });
  await flush();
  await act(async () => {
    release?.();
  });
  await flush();
  await act(async () => {
    await source.refetch();
  });
  await flush();
  expect(source.data?.streak).toBe(0);
});

it('retires a bounded grant at its actual expiry without a navigation event', async () => {
  await grant('synthetic-progress-a', true);
  await mount();
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 80));
  });
  expect(source.data).toBeUndefined();
});
