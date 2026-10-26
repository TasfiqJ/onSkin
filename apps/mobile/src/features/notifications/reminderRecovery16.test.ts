import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import NotificationsScreen from '@/app/onboarding/notifications';
import { runAccountGenerationOperation } from '@/lib/auth/accountGeneration';
import {
  clearActiveHealthProcessingEpoch,
  setActiveHealthProcessingEpoch,
} from '@/lib/consent/healthProcessingEpoch';
import { DEFAULT_PREFS, loadNotifPrefs, saveNotifPrefs } from './store';
import type { NotificationPermissionOutcome, ReminderScheduleOutcome } from './deliver';
import { SOFT_ASK } from './copy';

const ports = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  failSave: false,
  push: vi.fn(),
  replace: vi.fn(),
  permission: vi.fn<() => Promise<NotificationPermissionOutcome>>(),
  schedule: vi.fn<() => Promise<ReminderScheduleOutcome>>(),
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
        const cleanup = callback();
        ports.blur = cleanup;
        return cleanup;
      }, [callback]),
  };
});
vi.mock('./deliver', () => ({
  requestPermission: ports.permission,
  rescheduleReminders: ports.schedule,
  isDeliverableAuthorizationState: (state: string) =>
    ['authorized', 'provisional', 'ephemeral'].includes(state),
}));
vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: async (key: string) => ports.storage.get(key) ?? null,
  removePrivateItem: async (key: string) => {
    ports.storage.delete(key);
  },
  updatePrivateItem: async (key: string, update: (current: string | null) => string | null) => {
    if (ports.failSave) throw new Error('synthetic-write-failure');
    const next = update(ports.storage.get(key) ?? null);
    if (next === null) ports.storage.delete(key);
    else ports.storage.set(key, next);
  },
}));

let renderer: ReactTestRenderer | undefined;
let accountGeneration: number;
async function grant(owner = 'synthetic-owner-a') {
  clearActiveHealthProcessingEpoch();
  setActiveHealthProcessingEpoch(1, { ownerUserId: owner, accountGeneration });
}
async function mount() {
  await act(async () => {
    renderer = create(createElement(NotificationsScreen));
  });
}
function text() {
  return JSON.stringify(renderer!.toJSON());
}
function button(label: string) {
  return renderer!.root.findAllByType('Button' as never).find((n) => n.props.label === label)!;
}
async function press(label: string) {
  await act(async () => {
    button(label).props.onPress();
  });
}
beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  accountGeneration = await runAccountGenerationOperation((lease) => lease.generation);
  await grant();
  ports.storage.clear();
  ports.failSave = false;
  ports.push.mockReset();
  ports.replace.mockReset();
  ports.permission
    .mockReset()
    .mockResolvedValue({ kind: 'authorized', state: 'authorized', requestAttempted: true });
  ports.schedule.mockReset().mockResolvedValue('scheduled');
});
afterEach(async () => {
  await act(async () => renderer?.unmount());
  renderer = undefined;
  clearActiveHealthProcessingEpoch();
});

it('keeps a failed storage write visible and never advances', async () => {
  await mount();
  ports.failSave = true;
  await press(SOFT_ASK.yes);
  expect(ports.push).not.toHaveBeenCalled();
  expect(text()).toContain('could not save');
  expect(ports.schedule).not.toHaveBeenCalled();
  expect(button('Check current choice and retry')).toBeDefined();
});

it('admits rapid taps synchronously before the next render', async () => {
  let release!: (value: NotificationPermissionOutcome) => void;
  ports.permission.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  await mount();
  const onPress = button(SOFT_ASK.yes).props.onPress;
  await act(async () => {
    onPress();
    onPress();
  });
  expect(ports.permission).toHaveBeenCalledTimes(1);
  await act(async () => {
    release({ kind: 'authorized', state: 'authorized', requestAttempted: true });
  });
  expect(ports.schedule).toHaveBeenCalledTimes(1);
});

it.each([
  { kind: 'denied', state: 'denied', requestAttempted: true },
  { kind: 'blocked', state: 'denied', requestAttempted: false },
  { kind: 'error', state: 'unavailable', requestAttempted: false },
] as const)('represents $kind as durable OFF with explicit continuation', async (outcome) => {
  ports.permission.mockResolvedValue(outcome);
  await mount();
  await press(SOFT_ASK.yes);
  expect(await loadNotifPrefs({ strict: true })).toMatchObject({
    amEnabled: false,
    pmEnabled: false,
  });
  expect(ports.push).not.toHaveBeenCalled();
  expect(text()).toContain('off');
  if (outcome.kind === 'error') expect(text()).toContain('unavailable');
  await press('Continue');
  expect(ports.push).toHaveBeenCalledExactlyOnceWith('/onboarding/account');
});

it('retries current durable OFF after saved-but-unscheduled opt-in without another permission sheet', async () => {
  ports.schedule.mockRejectedValueOnce(new Error('synthetic-runtime-unavailable'));
  await mount();
  await press(SOFT_ASK.yes);
  expect(ports.push).not.toHaveBeenCalled();
  expect(text()).toContain('saved');
  expect(text()).toContain('unconfirmed');
  await saveNotifPrefs({ amEnabled: false, pmEnabled: false });
  await press('Check current choice and retry');
  expect(ports.permission).toHaveBeenCalledTimes(1);
  expect(await loadNotifPrefs({ strict: true })).toMatchObject({
    amEnabled: false,
    pmEnabled: false,
  });
  expect(text()).toContain('off');
});

it('allows explicit honest continuation after OFF is durable but native cancellation is unavailable', async () => {
  ports.schedule.mockRejectedValue(new Error('synthetic-runtime-unavailable'));
  await mount();
  await act(async () => {
    renderer!.root.findByType('Pressable' as never).props.onPress();
  });
  expect(ports.push).not.toHaveBeenCalled();
  expect(text()).toContain('Existing reminders may remain');
  await press('Continue with delivery unconfirmed');
  expect(await loadNotifPrefs({ strict: true })).toMatchObject(DEFAULT_PREFS);
  expect(ports.push).toHaveBeenCalledExactlyOnceWith('/onboarding/account');
});

it.each(['owner-return', 'same-owner-regrant', 'withdrawal', 'unmount', 'blur'] as const)(
  'prevents stale completion/navigation on %s',
  async (boundary) => {
    let release!: (value: NotificationPermissionOutcome) => void;
    ports.permission.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    await mount();
    await act(async () => {
      button(SOFT_ASK.yes).props.onPress();
    });
    await act(async () => {
      if (boundary === 'owner-return') {
        await grant('synthetic-owner-b');
        await grant();
      }
      if (boundary === 'same-owner-regrant') await grant();
      if (boundary === 'withdrawal') clearActiveHealthProcessingEpoch();
      if (boundary === 'unmount') {
        renderer!.unmount();
        renderer = undefined;
      }
      if (boundary === 'blur') ports.blur?.();
    });
    await act(async () => {
      release({ kind: 'authorized', state: 'authorized', requestAttempted: true });
    });
    expect(ports.push).not.toHaveBeenCalled();
    expect(ports.storage.size).toBe(0);
    expect(ports.schedule).not.toHaveBeenCalled();
  },
);

it('does not use an old OFF receipt to continue after a later storage failure', async () => {
  ports.schedule.mockRejectedValue(new Error('synthetic-runtime-unavailable'));
  await mount();
  await act(async () => {
    renderer!.root.findByType('Pressable' as never).props.onPress();
  });
  ports.failSave = true;
  await press('Continue with delivery unconfirmed');
  expect(ports.push).not.toHaveBeenCalled();
  expect(text()).toContain('could not save');
});

it('retains saved intent but never navigates after unmount during scheduling', async () => {
  let release!: (value: ReminderScheduleOutcome) => void;
  ports.schedule.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  await mount();
  await act(async () => {
    button(SOFT_ASK.yes).props.onPress();
  });
  expect(await loadNotifPrefs({ strict: true })).toMatchObject({ amEnabled: true });
  await act(async () => {
    renderer!.unmount();
    renderer = undefined;
    release('scheduled');
  });
  expect(ports.push).not.toHaveBeenCalled();
  expect(ports.schedule).toHaveBeenCalledTimes(1);
});
