import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
} from '@/lib/auth/accountGeneration';

import { NotificationResponseHost } from './NotificationResponseHost';

const mocks = vi.hoisted(() => ({
  clear: vi.fn(async () => undefined),
  coldResponse: null as unknown,
  listener: null as ((response: unknown) => void) | null,
  platform: 'ios',
  push: vi.fn(),
  remove: vi.fn(),
}));

vi.mock('expo-router', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('react-native', () => ({
  Platform: {
    get OS() {
      return mocks.platform;
    },
  },
}));
vi.mock('expo-notifications', () => ({
  DEFAULT_ACTION_IDENTIFIER: 'expo.modules.notifications.actions.DEFAULT',
  addNotificationResponseReceivedListener: (listener: (response: unknown) => void) => {
    mocks.listener = listener;
    return { remove: mocks.remove };
  },
  clearLastNotificationResponseAsync: mocks.clear,
  getLastNotificationResponseAsync: async () => mocks.coldResponse,
}));

function response(
  identifier: string,
  data: unknown,
  actionIdentifier = 'expo.modules.notifications.actions.DEFAULT',
) {
  return {
    actionIdentifier,
    notification: { request: { content: { data }, identifier } },
  };
}

const ROUTINE_DATA = {
  destination: 'today',
  kind: 'pm_step',
  layerwellNotificationVersion: 1,
};

let renderer: ReactTestRenderer | null = null;

beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  mocks.clear.mockClear();
  mocks.coldResponse = null;
  mocks.listener = null;
  mocks.platform = 'ios';
  mocks.push.mockClear();
  mocks.remove.mockClear();
});

afterEach(async () => {
  if (renderer) await act(async () => renderer?.unmount());
  renderer = null;
});

describe('NotificationResponseHost', () => {
  it('routes one exact cold response and clears it without duplicate warm handling', async () => {
    mocks.coldResponse = response('notice-1', ROUTINE_DATA);
    await act(async () => {
      renderer = create(createElement(NotificationResponseHost));
    });

    expect(mocks.push).toHaveBeenCalledExactlyOnceWith('/(tabs)/today');
    expect(mocks.clear).toHaveBeenCalledOnce();

    await act(async () => mocks.listener?.(response('notice-1', ROUTINE_DATA)));
    expect(mocks.push).toHaveBeenCalledOnce();
  });

  it('rejects custom actions and payload-selected routes', async () => {
    await act(async () => {
      renderer = create(createElement(NotificationResponseHost));
    });

    await act(async () => {
      mocks.listener?.(response('notice-2', ROUTINE_DATA, 'DELETE'));
      mocks.listener?.(
        response('notice-3', {
          ...ROUTINE_DATA,
          route: '/settings/account',
        }),
      );
    });

    expect(mocks.push).not.toHaveBeenCalled();
    expect(mocks.clear).not.toHaveBeenCalled();
  });

  it('cannot route a retained owner-A response while an account boundary is active', async () => {
    await act(async () => {
      renderer = create(createElement(NotificationResponseHost));
    });
    beginAccountGenerationBoundary();
    try {
      await act(async () => mocks.listener?.(response('owner-a-notice', ROUTINE_DATA)));
      expect(mocks.push).not.toHaveBeenCalled();
      expect(mocks.clear).toHaveBeenCalledOnce();
    } finally {
      endAccountGenerationBoundary();
    }
  });

  it('does not subscribe on web and removes the native listener on unmount', async () => {
    mocks.platform = 'web';
    await act(async () => {
      renderer = create(createElement(NotificationResponseHost));
    });
    expect(mocks.listener).toBeNull();

    await act(async () => renderer?.unmount());
    renderer = null;
    expect(mocks.remove).not.toHaveBeenCalled();

    mocks.platform = 'ios';
    await act(async () => {
      renderer = create(createElement(NotificationResponseHost));
    });
    await act(async () => renderer?.unmount());
    renderer = null;
    expect(mocks.remove).toHaveBeenCalledOnce();
  });
});
