import { createHash, randomUUID } from 'node:crypto';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { Pressable } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import LocalRecoveryScreen from '@/app/settings/local-recovery';
import { CURRENT_AGE_POLICY_RECEIPT_BYTES, setAgeVerified } from '@/features/onboarding/ageGateStore';
import { HEALTH_DATA_CONSENT } from '@/features/onboarding/consentCopy';
import { setHealthDataCollectionConsentLocal } from '@/features/onboarding/healthConsentStore';
import { saveNotifPrefs } from '@/features/notifications/store';
import { writePhotoDeleteJournal } from '@/features/photos/photoDeleteJournal';
import { addProduct } from '@/features/shelf/store';
import { toggleCompletion } from '@/features/today/completionsStore';
import { localDateString } from '@/features/today/useToday';
import { runAccountGenerationOperation } from '@/lib/auth/accountGeneration';
import { runHealthDataOperation } from '@/lib/consent/healthDataWriteAdmission';
import { clearActiveHealthProcessingEpoch, setActiveHealthProcessingEpoch } from '@/lib/consent/healthProcessingEpoch';

// Platform ports only. Domain loaders, age/consent parsers, leases, photo
// deletion journal, stores and mounted route are the actual production source.
const ports = vi.hoisted(() => ({
  bytes: new Map<string, string>(), vault: new Map<string, string>(), failed: new Set<string>(),
  reads: new Map<string, number>(), write: vi.fn(), provider: vi.fn(), push: vi.fn(), back: vi.fn(),
  listeners: new Set<(state: string) => void>(),
  delayKey: null as string | null, release: null as (() => void) | null,
}));
vi.mock('react-native', () => ({ View: 'View', Pressable: 'Pressable', ScrollView: 'ScrollView', Platform: { OS: 'web' },
  AppState: { currentState: 'active', addEventListener: (_name: string, listener: (state: string) => void) => {
    ports.listeners.add(listener); return { remove: () => ports.listeners.delete(listener) };
  } } }));
vi.mock('expo-router', async () => {
  const { useEffect } = await import('react');
  return { router: { push: ports.push, back: ports.back, replace: ports.back, canGoBack: () => false },
    useFocusEffect: (effect: () => (() => void)) => useEffect(effect, [effect]) };
});
vi.mock('@/components/ui', () => ({ Screen: 'Screen', Text: 'Text', RouteIconButton: 'RouteIconButton' }));
vi.mock('expo-crypto', () => ({ randomUUID, CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: async (_algorithm: string, value: string) => createHash('sha256').update(value).digest('hex') }));
vi.mock('react-native-get-random-values', () => ({}));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: {
  getItem: async (key: string) => ports.vault.get(key) ?? null,
  setItem: async (key: string, value: string) => { ports.write(); ports.vault.set(key, value); },
  removeItem: async (key: string) => { ports.write(); ports.vault.delete(key); },
} }));
vi.mock('expo-secure-store', () => ({ WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'when-unlocked-this-device-only' }));
vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: async (key: string) => {
    ports.reads.set(key, (ports.reads.get(key) ?? 0) + 1);
    if (ports.failed.has(key)) throw new Error('SYNTHETIC_PRIVATE_KV_UNAVAILABLE');
    const snapshot = ports.bytes.get(key) ?? null;
    if (ports.delayKey === key) {
      ports.delayKey = null;
      await new Promise<void>(resolve => { ports.release = resolve; });
    }
    return snapshot;
  },
  setPrivateItem: async (key: string, value: string) => { ports.write(); ports.bytes.set(key, value); },
  removePrivateItem: async (key: string) => { ports.write(); ports.bytes.delete(key); },
  updatePrivateItem: async (key: string, update: (raw: string | null) => string | null) => {
    ports.write(); const value = update(ports.bytes.get(key) ?? null);
    if (value === null) ports.bytes.delete(key); else ports.bytes.set(key, value);
  },
}));
vi.mock('@/lib/supabase/client', () => ({ supabase: { from: ports.provider, rpc: ports.provider } }));
vi.mock('@/features/photos/encryptedStorage', () => ({}));
vi.mock('@/features/photos/photoThumbnail', () => ({}));

const SHELF = 'layerwell.shelf.v1';
const PREFS = 'layerwell.notifPrefs.v1';
const DOMAIN_KEYS = [SHELF, PREFS, 'layerwell.completions.v1', 'layerwell.photos.deleteJournal.v1'];
let renderer: ReactTestRenderer | undefined;
let client: QueryClient;
async function grant(owner = 'synthetic-recovery-a') {
  clearActiveHealthProcessingEpoch();
  await setAgeVerified(true);
  await setHealthDataCollectionConsentLocal({ granted: true, version: HEALTH_DATA_CONSENT.version, consentText: HEALTH_DATA_CONSENT.fullText });
  const accountGeneration = await runAccountGenerationOperation(lease => lease.generation);
  setActiveHealthProcessingEpoch(1, { ownerUserId: owner, accountGeneration });
}
async function flush() { await act(async () => { await new Promise(resolve => setTimeout(resolve, 5)); }); }
async function mount() { await act(async () => { renderer = create(createElement(QueryClientProvider, { client }, createElement(LocalRecoveryScreen))); }); await flush(); }
function row(title: string) {
  const heading = renderer!.root.findAll(node => node.type === ('Text' as never) && node.props.children === title)[0]!;
  return heading.parent!;
}
function rendered() { return JSON.stringify(renderer!.toJSON()); }
function rowText(title: string) { return row(title).findAllByType('Text' as never).map(node => node.props.children).join(' '); }
function check(title: string) {
  return renderer!.root.findAll(node => node.type === Pressable && node.props.accessibilityLabel === `Check ${title} again`)[0]!;
}
beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  ports.bytes.clear(); ports.vault.clear(); ports.failed.clear(); ports.reads.clear(); ports.write.mockClear(); ports.provider.mockReset();
  ports.delayKey = null; ports.release = null; renderer = undefined;
  client = new QueryClient();
  await grant(); ports.write.mockClear(); ports.reads.clear();
});
afterEach(async () => {
  await act(async () => { renderer?.unmount(); ports.release?.(); });
  clearActiveHealthProcessingEpoch(); client.clear(); vi.useRealTimers();
});

it('reads existing local evidence without writing, networking, scheduling or opening images', async () => {
  await addProduct({ name: 'Synthetic private name never displayed', addedVia: 'manual' });
  await toggleCompletion('AM:synthetic-step', localDateString());
  await saveNotifPrefs({ amEnabled: true });
  ports.write.mockClear();
  await mount();
  expect(row('Shelf').findAll(node => node.props.children === 'Saved on this device').length).toBeGreaterThan(0);
  expect(row('Today check-offs').findAll(node => node.props.children === 'Saved on this device').length).toBeGreaterThan(0);
  expect(row('Reminder choices').findAll(node => node.props.children === 'Needs confirmation').length).toBeGreaterThan(0);
  expect(rendered()).toContain('Cloud status not verified');
  expect(rendered()).not.toContain('Synthetic private name');
  expect(ports.reads.has('layerwell.photos.v1')).toBe(false);
  expect(ports.write).not.toHaveBeenCalled(); expect(ports.provider).not.toHaveBeenCalled();
});

it('isolates unavailable reminder storage from saved check-offs and unfinished photo cleanup', async () => {
  await toggleCompletion('AM:synthetic-step', localDateString());
  await runHealthDataOperation('synthetic-recovery-a', lease => writePhotoDeleteJournal([{
    operationId: '10000000-0000-4000-8000-000000000001', photoId: 'synthetic-photo',
    ownerUserId: lease.ownerUserId, epoch: lease.epoch, phase: 'prepared', remotePending: false, needsAttention: true, files: [],
  }], lease));
  ports.failed.add(PREFS); await mount();
  expect(rowText('Reminder choices')).toContain('Unavailable');
  expect(rowText('Today check-offs')).toContain('Saved on this device');
  expect(rowText('Photo cleanup')).toContain('Needs confirmation');
  expect(rendered()).not.toContain('synthetic-photo');
});

it('does not turn corrupt bytes into an empty state or overwrite them during retry', async () => {
  ports.bytes.set(SHELF, '{broken'); await mount();
  expect(rowText('Shelf')).toContain('Unavailable');
  await act(async () => { check('Shelf').props.onPress(); }); await flush();
  expect(ports.bytes.get(SHELF)).toBe('{broken'); expect(ports.write).not.toHaveBeenCalled();
});

it('coalesces duplicate read retries and recovers the feature independently', async () => {
  ports.failed.add(SHELF); await mount(); ports.failed.delete(SHELF);
  const before = ports.reads.get(SHELF)!;
  ports.delayKey = SHELF;
  const retry = check('Shelf').props.onPress;
  await act(async () => { retry(); retry(); });
  expect(ports.reads.get(SHELF)).toBe(before + 1);
  expect(check('Shelf').props.disabled).toBe(true);
  await act(async () => { ports.release!(); }); await flush();
  expect(rowText('Shelf')).toContain('Not configured');
});

it.each(['synthetic-recovery-b', 'synthetic-recovery-a'])('retires a delayed old Shelf read when authority changes to %s', async owner => {
  await addProduct({ name: 'Synthetic private old name', addedVia: 'manual' });
  ports.delayKey = SHELF; await mount();
  ports.bytes.clear();
  await act(async () => { await grant(owner); }); await flush();
  expect(rowText('Shelf')).toContain('Not configured');
  await act(async () => { ports.release!(); }); await flush();
  expect(rowText('Shelf')).toContain('Not configured');
  expect(rendered()).not.toContain('Synthetic private old name');
});

it('withdrawal hides all domain statuses before delayed reads settle', async () => {
  ports.delayKey = SHELF; await mount();
  await act(async () => { clearActiveHealthProcessingEpoch(); ports.release!(); }); await flush();
  expect(rendered()).not.toContain('No pending cleanup'); expect(rendered()).not.toContain('Today check-offs');
  expect(rendered()).toContain('unavailable until your age, consent, and account checks are current');
});

it('a same-owner Shelf write retires its earlier in-flight empty snapshot', async () => {
  ports.delayKey = SHELF; await mount();
  await act(async () => { await addProduct({ name: 'Synthetic later intake', addedVia: 'manual' }); });
  await act(async () => { ports.release!(); }); await flush();
  expect(rowText('Shelf')).toContain('Saved on this device');
});

it.each(['age', 'consent'])('rechecks %s admission after an in-flight domain read', async kind => {
  ports.delayKey = SHELF; await mount();
  if (kind === 'age') await setAgeVerified(false);
  else await setHealthDataCollectionConsentLocal({ granted: false, version: HEALTH_DATA_CONSENT.version, consentText: HEALTH_DATA_CONSENT.declineText });
  await act(async () => { ports.release!(); }); await flush();
  expect(rendered()).not.toContain('Today check-offs');
  expect(rendered()).not.toContain('Not configured');
});

it.each(['closed', 'underage', 'unconsented', 'private-kv-unreadable'])('rejects %s access before probing any domain', async kind => {
  if (kind === 'closed') clearActiveHealthProcessingEpoch();
  if (kind === 'underage') await setAgeVerified(false);
  if (kind === 'unconsented') await setHealthDataCollectionConsentLocal({ granted: false, version: HEALTH_DATA_CONSENT.version, consentText: HEALTH_DATA_CONSENT.declineText });
  if (kind === 'private-kv-unreadable') {
    for (const [key, value] of ports.bytes) if (value === CURRENT_AGE_POLICY_RECEIPT_BYTES) ports.failed.add(key);
  }
  ports.reads.clear(); await mount();
  expect(DOMAIN_KEYS.every(key => !ports.reads.has(key))).toBe(true);
  expect(rendered()).not.toContain('No pending cleanup');
});

it('refreshes this-day evidence after foreground local-day rollover', async () => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 9, 24, 23, 59));
  await toggleCompletion('AM:synthetic-step', localDateString()); await mount();
  expect(rowText('Today check-offs')).toContain('Saved on this device');
  vi.setSystemTime(new Date(2026, 9, 25, 0, 1));
  await act(async () => { for (const listener of ports.listeners) listener('active'); }); await flush();
  expect(rowText('Today check-offs')).toContain('Not configured');
});

it('foregrounding rechecks same-day readability instead of keeping an old saved descriptor', async () => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 9, 24, 12));
  await addProduct({ name: 'Synthetic local product', addedVia: 'manual' }); await mount();
  expect(rowText('Shelf')).toContain('Saved on this device');
  ports.failed.add(SHELF); vi.setSystemTime(new Date(2026, 9, 24, 12, 1));
  await act(async () => { for (const listener of ports.listeners) listener('active'); }); await flush();
  expect(rowText('Shelf')).toContain('Unavailable');
});
