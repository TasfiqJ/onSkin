import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import NotificationsScreen from '@/app/onboarding/notifications';
import { runAccountGenerationOperation } from '@/lib/auth/accountGeneration';
import {
  clearActiveHealthProcessingEpoch,
  setActiveHealthProcessingEpoch,
} from '@/lib/consent/healthProcessingEpoch';

const ports = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  push: vi.fn(),
  replace: vi.fn(),
  schedule: vi.fn<() => Promise<string>>(),
  focus: undefined as (() => () => void) | undefined,
  blur: undefined as (() => void) | undefined,
}));
vi.mock('react-native', () => ({ View: 'View', Pressable: 'Pressable', ScrollView: 'ScrollView' }));
vi.mock('@/components/ui', () => ({
  Button: 'Button',
  Card: 'Card',
  ProgressBar: 'ProgressBar',
  Screen: 'Screen',
  Text: 'Text',
}));
vi.mock('expo-router', async () => {
  const { useEffect } = await import('react');
  return {
    router: { push: ports.push, replace: ports.replace },
    useFocusEffect: (callback: () => () => void) =>
      useEffect(() => {
        ports.focus = callback;
        ports.blur = callback();
        return () => ports.blur?.();
      }, [callback]),
  };
});
vi.mock('./deliver', () => ({
  requestPermission: async () => ({
    kind: 'authorized',
    state: 'authorized',
    requestAttempted: true,
  }),
  rescheduleReminders: ports.schedule,
  isDeliverableAuthorizationState: (state: string) => state === 'authorized',
}));
vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: async (key: string) => ports.storage.get(key) ?? null,
  removePrivateItem: async (key: string) => {
    ports.storage.delete(key);
  },
  updatePrivateItem: async (key: string, update: (current: string | null) => string | null) => {
    const next = update(ports.storage.get(key) ?? null);
    if (next === null) ports.storage.delete(key);
    else ports.storage.set(key, next);
  },
}));
let view: ReactTestRenderer | undefined;
let accountGeneration: number;
function grant(owner = 'synthetic-owner-a') {
  clearActiveHealthProcessingEpoch();
  setActiveHealthProcessingEpoch(1, { ownerUserId: owner, accountGeneration });
}
function button(label: string) {
  return view!.root.findAllByType('Button' as never).find((n) => n.props.label === label)!;
}
async function off() {
  await act(async () => {
    view!.root.findByType('Pressable' as never).props.onPress();
  });
}
beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  accountGeneration = await runAccountGenerationOperation((lease) => lease.generation);
  grant();
  ports.storage.clear();
  ports.push.mockReset();
  ports.replace.mockReset();
  ports.schedule.mockReset().mockResolvedValue('scheduled');
  await act(async () => {
    view = create(createElement(NotificationsScreen));
  });
});
afterEach(async () => {
  await act(async () => {
    view?.unmount();
  });
  view = undefined;
  clearActiveHealthProcessingEpoch();
});

it.each(['same-focus-hidden', 'refocus', 'owner-return', 'same-owner-regrant'] as const)(
  'refuses the saved Continue callback after %s',
  async (boundary) => {
    await off();
    const oldContinue = button('Continue').props.onPress;
    if (boundary === 'same-focus-hidden') {
      let settle!: (value: string) => void;
      ports.schedule.mockReturnValueOnce(
        new Promise((resolve) => {
          settle = resolve;
        }),
      );
      await off();
      await act(async () => {
        oldContinue();
      });
      expect(ports.push).not.toHaveBeenCalled();
      await act(async () => {
        settle('scheduled');
      });
    } else {
      await act(async () => {
        ports.blur?.();
        if (boundary === 'owner-return') {
          grant('synthetic-owner-b');
          grant();
        }
        if (boundary === 'same-owner-regrant') grant();
        ports.blur = ports.focus?.();
      });
    }
    await act(async () => {
      oldContinue();
    });
    expect(ports.push).not.toHaveBeenCalled();
    await off();
    await act(async () => {
      button('Continue').props.onPress();
    });
    expect(ports.push).toHaveBeenCalledExactlyOnceWith('/onboarding/account');
  },
);

it.each(['scheduled', 'rejected'])(
  'retires a %s schedule settlement across same-lease blur/refocus',
  async (outcome) => {
    let resolve!: (value: string) => void;
    let reject!: (error: Error) => void;
    ports.schedule.mockReturnValueOnce(
      new Promise((yes, no) => {
        resolve = yes;
        reject = no;
      }),
    );
    await off();
    await act(async () => {
      ports.blur?.();
      ports.blur = ports.focus?.();
    });
    await act(async () => {
      if (outcome === 'scheduled') resolve('scheduled');
      else reject(new Error('synthetic schedule failure'));
    });
    expect(ports.push).not.toHaveBeenCalled();
    expect(JSON.stringify(view!.toJSON())).not.toContain('Your choice was saved');
    expect(JSON.stringify(view!.toJSON())).not.toContain('delivery is unconfirmed');
    await off();
    expect(button('Continue')).toBeDefined();
  },
);
