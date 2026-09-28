import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { StoreTransactionNoticeHost } from './StoreTransactionNoticeHost';

type Notice =
  | { kind: 'owner_pending'; reason: 'completion_unconfirmed' | 'payment_pending' }
  | { kind: 'another_account_pending' }
  | { kind: 'deleted_account_pending' }
  | null;

const h = vi.hoisted(() => ({
  notice: null as Notice,
  noticeListener: null as ((event: { attention: boolean }) => void) | null,
  readNotice: vi.fn<() => Promise<Notice>>(),
  restoreMutate: vi.fn(),
}));

vi.mock('react-native', () => ({
  AppState: {
    currentState: 'active',
    addEventListener: vi.fn(() => ({ remove: vi.fn() })),
  },
  Modal: 'Modal',
  Platform: { OS: 'ios' },
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  View: 'View',
  useWindowDimensions: () => ({ height: 667, width: 375 }),
}));
vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
vi.mock('@/components/ui', () => ({ Button: 'Button', Text: 'Text' }));
vi.mock('@/lib/applock/AppLockProvider', () => ({ useAppLock: () => ({ appUnlocked: true }) }));
vi.mock('@/lib/auth/AuthProvider', () => ({
  useAuth: () => ({ initializing: false, user: { id: 'owner-a' } }),
}));
vi.mock('@/lib/env', () => ({ env: { supportUrl: null } }));
vi.mock('@/lib/launch/phase8', () => ({ productionUrlReady: () => false }));
vi.mock('@/lib/iap/revenuecat', () => ({
  MANAGE_SUBSCRIPTION_URL_ANDROID: 'https://play.google.com/store/account/subscriptions',
  MANAGE_SUBSCRIPTION_URL_IOS: 'https://apps.apple.com/account/subscriptions',
  showNativeManageSubscriptions: vi.fn(async () => false),
}));
vi.mock('@/lib/iap/storeTransactionNotice', () => ({
  readStoreTransactionNotice: h.readNotice,
  seedStoreTransactionNoticeE2E: vi.fn(),
  shouldSeedStoreTransactionNoticeE2E: () => false,
  storeTransactionRecoveryMessage: () => null,
  subscribeToStoreTransactionNotice: (listener: (event: { attention: boolean }) => void) => {
    h.noticeListener = listener;
    return () => {
      if (h.noticeListener === listener) h.noticeListener = null;
    };
  },
}));
vi.mock('@/lib/navigation/externalUrl', () => ({ safeExternalHttpsUrl: () => null }));
vi.mock('@/lib/navigation/externalOpen', () => ({
  openExternalHttpsUrl: vi.fn(async () => false),
}));
vi.mock('@/theme/tokens', () => ({
  colors: {
    clayDeep: '#71452d',
    hairlineStrong: '#c9b9a8',
    mutedStrong: '#625b54',
  },
}));
vi.mock('./useEntitlement', () => ({
  useEntitlementActions: () => ({
    restore: { isPending: false, mutate: h.restoreMutate },
  }),
}));

let renderer: ReactTestRenderer | null = null;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

async function flush(): Promise<void> {
  await act(async () => {
    for (let index = 0; index < 8; index += 1) await Promise.resolve();
  });
}

beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  h.notice = { kind: 'owner_pending', reason: 'payment_pending' };
  h.noticeListener = null;
  h.readNotice.mockReset().mockImplementation(async () => h.notice);
  h.restoreMutate.mockReset().mockImplementation((_input, callbacks) => {
    callbacks.onSuccess({ active: false });
  });
});

afterEach(async () => {
  if (renderer) {
    await act(async () => renderer?.unmount());
  }
  renderer = null;
});

describe('StoreTransactionNoticeHost', () => {
  it('does not let the initial read overwrite a newer journal refresh', async () => {
    const initial = deferred<Notice>();
    const refreshed = deferred<Notice>();
    h.readNotice
      .mockReset()
      .mockReturnValueOnce(initial.promise)
      .mockReturnValueOnce(refreshed.promise);

    await act(async () => {
      renderer = create(createElement(StoreTransactionNoticeHost));
    });
    await vi.waitFor(() => expect(h.readNotice).toHaveBeenCalledOnce());

    await act(async () => {
      h.noticeListener?.({ attention: true });
      await Promise.resolve();
    });
    await vi.waitFor(() => expect(h.readNotice).toHaveBeenCalledTimes(2));
    refreshed.resolve({ kind: 'deleted_account_pending' });
    await flush();
    expect(JSON.stringify(renderer!.toJSON())).toContain('Deleted-account purchase needs checking');

    initial.resolve(null);
    await flush();
    expect(JSON.stringify(renderer!.toJSON())).toContain('Deleted-account purchase needs checking');
  });

  it('does not carry action feedback into a later attention notice', async () => {
    await act(async () => {
      renderer = create(createElement(StoreTransactionNoticeHost));
    });
    await flush();

    const restoreButton = renderer!.root.findByProps({
      label: 'Check with Restore purchases',
    });
    await act(async () => {
      restoreButton.props.onPress();
      await Promise.resolve();
    });
    await flush();
    expect(JSON.stringify(renderer!.toJSON())).toContain(
      'The store check completed, but approval is still unresolved.',
    );

    h.notice = null;
    await act(async () => {
      h.noticeListener?.({ attention: false });
      await Promise.resolve();
    });
    await flush();
    expect(renderer!.toJSON()).toBeNull();

    h.notice = { kind: 'deleted_account_pending' };
    await act(async () => {
      h.noticeListener?.({ attention: true });
      await Promise.resolve();
    });
    await flush();

    const rendered = JSON.stringify(renderer!.toJSON());
    expect(rendered).toContain('Deleted-account purchase needs checking');
    expect(rendered).not.toContain('The store check completed, but approval is still unresolved.');
  });
});
