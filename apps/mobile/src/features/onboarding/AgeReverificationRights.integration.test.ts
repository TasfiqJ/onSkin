import { createHash } from 'node:crypto';
import { createElement, type ComponentType, type ReactNode } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { AgePolicyGate } from './AgePolicyGate';
import { AgeReverificationRights } from './AgeReverificationRights';
import { AGE_POLICY_RECEIPT_KEY } from './ageGate';
import { setPrivateItem } from '@/lib/storage/privateKV';
import { LOCAL_UNCONFIGURED_HEALTH_DATA_OWNER } from '@/features/healthConsent/lifecycle';
import { claimLocalDataOwnership } from '@/lib/auth/sessionOwner';
import {
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
} from '@/lib/auth/accountGeneration';
import {
  activeHealthProcessingLeaseSnapshot,
  clearActiveHealthProcessingEpoch,
} from '@/lib/consent/healthProcessingEpoch';

const ports = vi.hoisted(() => ({
  owner: 'owner-a' as string | null,
  configured: false,
  state: 'active',
  unavailable: false,
  bytes: new Map<string, string>(),
  listeners: new Set<(state: string) => void>(),
}));
vi.mock('react-native-get-random-values', () => ({}));
vi.mock('react-native', () => ({
  AppState: {
    get currentState() {
      return ports.state;
    },
    addEventListener: (_event: string, listener: (state: string) => void) => {
      ports.listeners.add(listener);
      return { remove: () => ports.listeners.delete(listener) };
    },
  },
  Platform: { OS: 'web' },
  View: 'View',
  Pressable: 'Pressable',
}));
vi.mock('expo-secure-store', () => ({}));
vi.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'sha256' },
  digestStringAsync: async (_algorithm: string, value: string) =>
    createHash('sha256').update(value).digest('hex'),
}));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => {
      if (ports.unavailable) throw new Error('unavailable');
      return ports.bytes.get(key) ?? null;
    },
    setItem: async (key: string, value: string) => {
      ports.bytes.set(key, value);
    },
    removeItem: async (key: string) => {
      ports.bytes.delete(key);
    },
    getAllKeys: async () => [...ports.bytes.keys()],
    multiGet: async (keys: string[]) => {
      if (ports.unavailable) throw new Error('unavailable');
      return keys.map((key) => [key, ports.bytes.get(key) ?? null]);
    },
  },
}));
vi.mock('expo-router', () => ({
  router: { replace: vi.fn() },
  useSegments: () => ['onboarding', 'age'],
}));
vi.mock('@/components/ui', () => ({ Button: 'Button', Screen: 'Screen', Text: 'Text' }));
vi.mock('@/lib/auth/AuthProvider', () => ({
  useAuth: () => ({
    user: ports.owner ? { id: ports.owner } : null,
    initializing: false,
    signOut: vi.fn(),
  }),
}));
vi.mock('@/features/healthConsent/lifecycle', () => ({
  LOCAL_UNCONFIGURED_HEALTH_DATA_OWNER: 'local-device-unclaimed',
}));
vi.mock('@/lib/env', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/env')>()),
  get isSupabaseConfigured() {
    return ports.configured;
  },
}));
vi.mock('@/features/healthConsent/HealthDataLifecycleGate', () => ({
  // A view port, not authority: real owner proof, crypto, receipt and account
  // generation decide whether this view can mount. Actual actions run in E2E.
  PausedHealthDataShell: (props: { rightsOnly: boolean; record: { ownerUserId: string } }) =>
    createElement('RightsView', {
      testID: 'rights',
      owner: props.record.ownerUserId,
      rightsOnly: props.rightsOnly,
    }),
}));
vi.mock('@/lib/navigation/externalOpen', () => ({ openExternalHttpsUrl: vi.fn() }));
vi.mock('@/lib/query/queryClient', () => ({
  queryClient: { getQueryCache: () => ({ subscribe: () => () => {} }), setQueryData: vi.fn() },
}));

let view: ReactTestRenderer;
const render = () =>
  createElement(
    AgePolicyGate as ComponentType<{
      bootstrap: ReactNode;
      recovery: ReactNode;
      children?: ReactNode;
    }>,
    {
      bootstrap: createElement('AgeForm'),
      recovery: createElement(AgeReverificationRights),
    },
    createElement('HealthProviders', { testID: 'health' }),
  );
async function flush() {
  await act(async () => {
    for (let n = 0; n < 30; n++) await Promise.resolve();
  });
}
beforeEach(async () => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  ports.bytes.clear();
  ports.owner = 'owner-a';
  ports.configured = false;
  ports.unavailable = false;
  ports.state = 'active';
  clearActiveHealthProcessingEpoch();
  await claimLocalDataOwnership('owner-a');
});
afterEach(async () => {
  if (view) await act(async () => view.unmount());
});

it.each([null, 'true', '{broken', '{"receipt_version":99}'])(
  'isolates verified-owner rights for receipt %s',
  async (raw) => {
    if (raw !== null) await setPrivateItem(AGE_POLICY_RECEIPT_KEY, raw);
    await act(async () => {
      view = create(render());
    });
    await flush();
    expect(view.root.findAllByProps({ testID: 'health' })).toHaveLength(0);
    await act(async () => {
      view.root.findByProps({ label: 'Privacy & account' }).props.onPress();
    });
    await flush();
    expect(view.root.findByProps({ testID: 'rights' }).props).toMatchObject({
      owner: 'owner-a',
      rightsOnly: true,
    });
    expect(view.root.findAllByProps({ testID: 'health' })).toHaveLength(0);
    expect(activeHealthProcessingLeaseSnapshot()).toBeNull();
  },
);

it('closes rights synchronously for A to B, foreground recheck and unavailable storage', async () => {
  await act(async () => {
    view = create(render());
  });
  await flush();
  await act(async () => {
    view.root.findByProps({ label: 'Privacy & account' }).props.onPress();
  });
  await flush();
  expect(view.root.findAllByProps({ testID: 'rights' })).toHaveLength(1);
  const oldPublication = view.root.findByProps({ testID: 'rights' }).parent!.props.onRecord;
  await act(async () => {
    beginAccountGenerationBoundary();
    ports.owner = 'owner-b';
    endAccountGenerationBoundary();
    view.update(render());
  });
  await flush();
  expect(view.root.findAllByProps({ testID: 'rights' })).toHaveLength(0);
  expect(view.root.findAllByProps({ testID: 'health' })).toHaveLength(0);
  ports.owner = 'owner-a';
  await act(async () => view.update(render()));
  await flush();
  expect(view.root.findAllByProps({ testID: 'rights' })).toHaveLength(1);
  await act(async () => {
    ports.state = 'background';
    ports.listeners.forEach((listener) => listener('background'));
  });
  expect(view.root.findAllByProps({ testID: 'rights' })).toHaveLength(0);
  ports.unavailable = true;
  await act(async () => {
    ports.state = 'active';
    ports.listeners.forEach((listener) => listener('active'));
  });
  await flush();
  expect(view.root.findAllByProps({ testID: 'rights' })).toHaveLength(0);
  expect(activeHealthProcessingLeaseSnapshot()).toBeNull();
  await act(async () => oldPublication({ ownerUserId: 'owner-a' }));
  expect(view.root.findAllByProps({ testID: 'rights' })).toHaveLength(0);
});

it('restores the proven local-only owner rights after a guest cold relaunch without granting health access', async () => {
  ports.bytes.clear();
  await claimLocalDataOwnership(LOCAL_UNCONFIGURED_HEALTH_DATA_OWNER);
  ports.owner = null;
  await act(async () => {
    view = create(render());
  });
  await flush();
  await act(async () => view.root.findByProps({ label: 'Privacy & account' }).props.onPress());
  await flush();
  expect(view.root.findByProps({ testID: 'rights' }).props.owner).toBe(
    LOCAL_UNCONFIGURED_HEALTH_DATA_OWNER,
  );
  expect(view.root.findAllByProps({ testID: 'health' })).toHaveLength(0);
  expect(activeHealthProcessingLeaseSnapshot()).toBeNull();
});

it.each([true, false])(
  'does not adopt a retained account owner into signed-out rights (configured=%s)',
  async (configured) => {
    ports.configured = configured;
    ports.owner = null;
    await act(async () => {
      view = create(render());
    });
    await flush();
    await act(async () => view.root.findByProps({ label: 'Privacy & account' }).props.onPress());
    await flush();
    expect(view.root.findAllByProps({ testID: 'rights' })).toHaveLength(0);
    expect(view.root.findAllByProps({ testID: 'health' })).toHaveLength(0);
    expect(activeHealthProcessingLeaseSnapshot()).toBeNull();
  },
);
