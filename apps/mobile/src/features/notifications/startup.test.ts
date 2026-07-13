import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  loadEntitlement: vi.fn(),
  loadNotifPrefs: vi.fn(),
  platform: { os: 'android' },
  secureStoreRead: vi.fn(),
  sentLogRead: vi.fn(),
  setNotificationChannelAsync: vi.fn(async () => undefined),
  setNotificationHandler: vi.fn(),
  supabaseRead: vi.fn(),
}));

vi.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 3 },
  setNotificationChannelAsync: mocks.setNotificationChannelAsync,
  setNotificationHandler: mocks.setNotificationHandler,
}));

vi.mock('react-native', () => ({
  Platform: {
    get OS() {
      return mocks.platform.os;
    },
  },
}));

vi.mock('expo-secure-store', () => ({ getItemAsync: mocks.secureStoreRead }));
vi.mock('./store', () => ({ loadNotifPrefs: mocks.loadNotifPrefs }));
vi.mock('./sentStore', () => ({ sentThisWeekForTierLocal: mocks.sentLogRead }));
vi.mock('@/features/subscription/store', () => ({ loadEntitlement: mocks.loadEntitlement }));
vi.mock('@/lib/supabase/client', () => ({
  supabase: { auth: { getUser: mocks.supabaseRead } },
}));

const SRC_DIR = fileURLToPath(new URL('../../', import.meta.url));

function expectNoBusinessReads(): void {
  expect(mocks.loadNotifPrefs).not.toHaveBeenCalled();
  expect(mocks.secureStoreRead).not.toHaveBeenCalled();
  expect(mocks.sentLogRead).not.toHaveBeenCalled();
  expect(mocks.loadEntitlement).not.toHaveBeenCalled();
  expect(mocks.supabaseRead).not.toHaveBeenCalled();
}

describe('minimal notification startup', () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.platform.os = 'android';
    mocks.loadEntitlement.mockReset();
    mocks.loadNotifPrefs.mockReset();
    mocks.secureStoreRead.mockReset();
    mocks.sentLogRead.mockReset();
    mocks.setNotificationChannelAsync.mockReset();
    mocks.setNotificationChannelAsync.mockResolvedValue(undefined);
    mocks.setNotificationHandler.mockReset();
    mocks.supabaseRead.mockReset();
  });

  it('idempotently installs the calm handler and Android channel without business reads', async () => {
    const { configureNotifications } = await import('./startup');

    const first = configureNotifications();
    const concurrent = configureNotifications();

    expect(concurrent).toBe(first);
    await expect(Promise.all([first, concurrent])).resolves.toEqual([undefined, undefined]);
    await expect(configureNotifications()).resolves.toBeUndefined();

    expect(mocks.setNotificationHandler).toHaveBeenCalledTimes(1);
    expect(mocks.setNotificationChannelAsync).toHaveBeenCalledExactlyOnceWith('routine', {
      name: 'Routine reminders',
      importance: 3,
    });
    const handler = mocks.setNotificationHandler.mock.calls[0]?.[0] as {
      handleNotification: () => Promise<Record<string, boolean>>;
    };
    await expect(handler.handleNotification()).resolves.toEqual({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    });
    expectNoBusinessReads();
  });

  it('contains an unsupported web failure and remains idempotent without reading private state', async () => {
    mocks.platform.os = 'web';
    mocks.setNotificationHandler.mockImplementationOnce(() => {
      throw new Error('notifications unavailable on web');
    });
    const { configureNotifications } = await import('./startup');

    await expect(configureNotifications()).resolves.toBeUndefined();
    await expect(configureNotifications()).resolves.toBeUndefined();

    expect(mocks.setNotificationHandler).toHaveBeenCalledTimes(1);
    expect(mocks.setNotificationChannelAsync).not.toHaveBeenCalled();
    expectNoBusinessReads();
  });

  it('keeps the root notification import graph at the two-platform-module boundary', () => {
    const startup = readFileSync(`${SRC_DIR}/features/notifications/startup.ts`, 'utf8');
    const root = readFileSync(`${SRC_DIR}/app/_layout.tsx`, 'utf8');
    const deliver = readFileSync(`${SRC_DIR}/features/notifications/deliver.ts`, 'utf8');
    const directImports = [...startup.matchAll(/from\s+['"]([^'"]+)['"]/g)].map(
      (match) => match[1],
    );
    const rootNotificationImports = [
      ...root.matchAll(/from\s+['"](@\/features\/notifications\/[^'"]+)['"]/g),
    ].map((match) => match[1]);

    expect(directImports).toEqual(['expo-notifications', 'react-native']);
    expect(startup).not.toMatch(
      /subscription|supabase|loadNotifPrefs|sentStore|SecureStore|scheduleNotificationAsync|cancelScheduled/,
    );
    expect(rootNotificationImports).toEqual(['@/features/notifications/startup']);
    expect(deliver).toContain("export { configureNotifications } from './startup';");
    expect(deliver).not.toContain('setNotificationHandler');
    expect(deliver).not.toContain('setNotificationChannelAsync');
  });
});
