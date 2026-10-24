import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { createElement, type ComponentType } from 'react';
import { Pressable } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import NotificationSettingsScreen from '@/app/settings/notifications';
import TimingScreen from '@/app/settings/timing';
import { runAccountGenerationOperation } from '@/lib/auth/accountGeneration';
import { clearActiveHealthProcessingEpoch, setActiveHealthProcessingEpoch } from '@/lib/consent/healthProcessingEpoch';
import { useNotifPrefs, useUpdateNotifPrefs } from './useNotifications';
import { loadNotifPrefs, saveNotifPrefs } from './store';

const ports = vi.hoisted(() => ({ raw: null as string | null, failure: false, schedule: vi.fn(), request: vi.fn() }));
vi.mock('react-native', () => ({ View: 'View', Pressable: 'Pressable', ScrollView: 'ScrollView', Modal: 'Modal',
  Platform: { OS: 'web' }, AppState: { addEventListener: () => ({ remove() {} }) },
  useWindowDimensions: () => ({ width: 375, height: 667 }) }));
vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ bottom: 0 }) }));
vi.mock('@/components/ui', () => ({ Text: 'Text', RouteIconButton: 'RouteIconButton', ToggleSwitch: 'ToggleSwitch' }));
vi.mock('expo-router', () => ({ router: { back: vi.fn(), replace: vi.fn(), canGoBack: () => false } }));
vi.mock('@/lib/accessibility/useReduceMotionPreference', () => ({ useReduceMotionPreference: () => true, motionAwareModalAnimation: () => 'none' }));
vi.mock('./deliver', () => ({ rescheduleReminders: ports.schedule, getPermissionStatus: async () => 'unavailable',
  requestPermission: ports.request, isDeliverableAuthorizationState: () => false }));
vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: async () => { if (ports.failure) throw new Error('SYNTHETIC_PRIVATE_KV_UNAVAILABLE'); return ports.raw; },
  removePrivateItem: async () => { ports.raw = null; },
  updatePrivateItem: async (_key: string, update: (raw: string | null) => string | null) => { ports.raw = update(ports.raw); },
}));
let client: QueryClient;
let renderer: ReactTestRenderer;
let source: ReturnType<typeof useNotifPrefs>;
let update: ReturnType<typeof useUpdateNotifPrefs>;
function Probe() { source = useNotifPrefs(); update = useUpdateNotifPrefs(); return null; }
async function grant(owner = 'synthetic-a') {
  clearActiveHealthProcessingEpoch();
  const accountGeneration = await runAccountGenerationOperation(lease => lease.generation);
  setActiveHealthProcessingEpoch(1, { ownerUserId: owner, accountGeneration });
}
async function flush() { await act(async () => { await new Promise(resolve => setTimeout(resolve, 5)); }); }
async function mount(component: ComponentType = Probe) {
  await act(async () => { renderer = create(createElement(QueryClientProvider, { client }, createElement(component))); });
  await flush();
}
beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  ports.raw = null; ports.failure = false; ports.schedule.mockReset().mockResolvedValue('web_preferences_only'); ports.request.mockReset();
  await grant(); onlineManager.setOnline(false);
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
});
afterEach(async () => { await act(async () => renderer?.unmount()); client.clear(); onlineManager.setOnline(true); clearActiveHealthProcessingEpoch(); });

it.each(['unavailable', 'corrupt', 'unsupported'])('keeps %s preferences unavailable instead of publishing defaults', async kind => {
  ports.failure = kind === 'unavailable'; ports.raw = kind === 'corrupt' ? '{broken' : kind === 'unsupported' ? '{"version":99}' : null;
  await mount();
  expect(source.isError).toBe(true); expect(source.data).toBeUndefined();
  // The existing scheduler keeps its conservative off fallback.
  expect(await loadNotifPrefs()).toMatchObject({ amEnabled: false, pmEnabled: false });
  expect(ports.request).not.toHaveBeenCalled();
});
it('hides a retained snapshot on failed reread and explicitly recovers offline', async () => {
  await saveNotifPrefs({ amEnabled: true }); await mount(); expect(source.data?.amEnabled).toBe(true);
  ports.failure = true;
  await act(async () => { await source.refetch(); }); await flush();
  expect(source.isError).toBe(true); expect(source.data).toBeUndefined();
  ports.failure = false;
  await act(async () => { await source.refetch(); }); await flush();
  expect(source.data?.amEnabled).toBe(true); expect(source.isPaused).toBe(false);
});
it.each([NotificationSettingsScreen, TimingScreen])('renders an accessible storage retry and Back on %s', async component => {
  ports.failure = true; await mount(component);
  const retry = renderer.root.findAll(node => node.props.accessibilityLabel === 'Try loading reminder preferences again' && node.type === Pressable)[0];
  expect(retry).toBeDefined();
  expect(renderer.root.findAll(node => node.props.accessibilityLabel === 'Back').length).toBeGreaterThan(0);
  ports.failure = false;
  await act(async () => { retry!.props.onPress(); }); await flush();
  expect(renderer.root.findAll(node => node.props.accessibilityLabel === 'Try loading reminder preferences again')).toHaveLength(0);
  expect(ports.request).not.toHaveBeenCalled();
});
it('a delayed old reminder opt-in cannot write under the next owner after rerender', async () => {
  await mount(); const retired = update.mutateAsync;
  await act(async () => { await grant('synthetic-b'); renderer.update(createElement(QueryClientProvider, { client }, createElement(Probe))); });
  await act(async () => { await expect(retired({ amEnabled: true })).rejects.toThrow(/HEALTH_DATA_WRITE/); });
  expect(ports.raw).toBeNull(); expect(ports.schedule).not.toHaveBeenCalled();
  await act(async () => { await update.mutateAsync({ amEnabled: true }); });
  expect((await loadNotifPrefs()).amEnabled).toBe(true);
});

it('an owner change cannot render the prior grant preferences from QueryClient', async () => {
  await saveNotifPrefs({ amEnabled: true }); await mount(); expect(source.data?.amEnabled).toBe(true);
  ports.raw = null;
  await act(async () => { await grant('synthetic-b'); renderer.update(createElement(QueryClientProvider, { client }, createElement(Probe))); });
  await flush();
  expect(source.data?.amEnabled).toBe(false);
});

it('withdrawal immediately hides current preferences without waiting for a private read', async () => {
  await saveNotifPrefs({ amEnabled: true }); await mount();
  await act(async () => { clearActiveHealthProcessingEpoch(); });
  expect(source.data).toBeUndefined();
});
