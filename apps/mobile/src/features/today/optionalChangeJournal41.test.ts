import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearPrivateMutationAfterRemoval46 } from '@/lib/auth/localAccountIsolation';

import { beginAccountGenerationBoundary, endAccountGenerationBoundary, runAccountGenerationOperation, waitForAccountGenerationOperationsToSettle } from '@/lib/auth/accountGeneration';
import { captureHealthDataWriteLease } from '@/lib/consent/healthDataWriteAdmission';
import { clearActiveHealthProcessingEpoch, setActiveHealthProcessingEpoch } from '@/lib/consent/healthProcessingEpoch';
import { beginPrivateKVAccountBoundary, endPrivateKVAccountBoundary, getPrivateItem, setPrivateItem, waitForPrivateKVWritesToSettle } from '@/lib/storage/privateKV';
import { collectLocalDeviceExportData } from '@/features/settings/localDeviceExport';
import { clearLocalPrivateData } from '@/features/settings/localPrivateData';

import { hashOptionalChange41, OPTIONAL_CHANGE41_BOUND, OPTIONAL_CHANGE41_MAX_EVENTS, type OptionalChangeInput41 } from './optionalChange41';
import { appendOptionalChangeEnvelope41, decodeOptionalChangeEnvelope41, snapshotOptionalChange41, type OptionalChangeEnvelope41 } from './optionalChangeJournal41';
import { appendOptionalChange41, getOptionalChanges41, toggleCompletion } from './completionsStore';

const native = vi.hoisted(() => ({
  raw: new Map<string, string>(), keys: new Map<string, string>(), id: 0,
  outcome: 'resolve' as 'resolve' | 'reject-before' | 'reject-after' | 'silent',
  afterWrite: undefined as (() => void) | undefined,
  readFailure: false, readsBeforeFailure: 0, keyFailure: false,
  setGate: null as Promise<void> | null, setStarted: undefined as (() => void) | undefined,
}));
vi.mock('expo-crypto', () => ({ randomUUID: () => `41000000-0000-4000-8000-${String(++native.id).padStart(12, '0')}` }));
vi.mock('react-native-get-random-values', () => ({}));
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
vi.mock('expo-secure-store', () => ({
  isAvailableAsync: async () => true,
  getItemAsync: async (key: string) => {
    if (native.keyFailure) throw new Error('SYNTHETIC_KEY_UNAVAILABLE');
    return native.keys.get(key) ?? null;
  },
  setItemAsync: async (key: string, value: string) => { native.keys.set(key, value); },
  deleteItemAsync: async (key: string) => { native.keys.delete(key); },
}));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: {
  getItem: async (key: string) => {
    if (native.readFailure && key === 'layerwell.completions.v1') {
      if (native.readsBeforeFailure > 0) native.readsBeforeFailure -= 1;
      else throw new Error('SYNTHETIC_READ_FAILURE');
    }
    return native.raw.get(key) ?? null;
  },
  getAllKeys: async () => [...native.raw.keys()],
  multiGet: async (keys: string[]) => keys.map((key) => [key, native.raw.get(key) ?? null]),
  setItem: async (key: string, value: string) => {
    const outcome = key === 'layerwell.completions.v1' ? native.outcome : 'resolve';
    if (key === 'layerwell.completions.v1') {
      native.outcome = 'resolve';
      native.setStarted?.();
      if (native.setGate) await native.setGate;
    }
    if (outcome === 'reject-before') throw new Error('SYNTHETIC_REJECT_BEFORE');
    if (outcome === 'silent') return;
    native.raw.set(key, value);
    if (key === 'layerwell.completions.v1') native.afterWrite?.();
    if (outcome === 'reject-after') throw new Error('SYNTHETIC_REJECT_AFTER');
  },
  removeItem: async (key: string) => { native.raw.delete(key); },
  multiRemove: async (keys: string[]) => { for (const key of keys) native.raw.delete(key); },
} }));
vi.mock('@/features/photos/encryptedStorage', () => ({
  decryptPhotoNoteForPurposeLimitedExport: async () => null,
  clearEncryptedPhotoStorage: async () => undefined,
}));
vi.mock('@/lib/offline/catalogLookupQueue', () => ({ purgeExpiredCatalogLookupQueueForPurposeLimitedExport: async () => undefined }));
vi.mock('@/features/widgets/lifecycleCoordinator', () => ({ clearRoutineWidgetLifecycleForPrivacy: async () => undefined }));
vi.mock('@/features/notifications/nativeMutation', () => ({ clearNativeNotificationsForAccountIsolation: async () => undefined }));
vi.mock('@/lib/analytics/track', () => ({ resetAnalyticsIdentity: async () => undefined }));
vi.mock('@/lib/iap/revenuecat', () => ({ resetRevenueCatIdentity: async () => undefined }));
vi.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file://synthetic-cache/', readDirectoryAsync: async () => [], deleteAsync: async () => undefined,
}));

const OWNER = 'owner-a';
const DAY = '2026-07-08';
const NOW = '2026-07-08T16:00:00.000Z';
function id(n: number) { return `aaaaaaaa-aaaa-4aaa-8aaa-${n.toString(16).padStart(12, '0')}`; }
function decode(raw: string) { return decodeOptionalChangeEnvelope41(JSON.parse(raw) as unknown, OWNER); }
function input(raw: string | null, envelope: OptionalChangeEnvelope41 | null, n = 1, patch: Partial<OptionalChangeInput41> = {}): OptionalChangeInput41 {
  const snapshot = snapshotOptionalChange41(raw, envelope);
  return { id: id(n), expectedRevision: snapshot.revision, expectedSourceProof: snapshot.sourceProof,
    expectedSourceBytes: snapshot.sourceBytes, observedOn: DAY, category: 'personal_note', text: 'A personal factual note.',
    kind: 'note', targetEventId: null, confirmation: true, ...patch };
}
function append(raw: string | null, request = input(raw, raw ? decode(raw) : null)) {
  return appendOptionalChangeEnvelope41(raw, raw ? decode(raw) : null, request, OWNER, NOW, DAY);
}

describe('optional one-key event journal primitives', () => {
  it('distinguishes no record from an affirmative no-change event', () => {
    expect(snapshotOptionalChange41(null, null)).toMatchObject({ revision: 0, events: [], sourceBytes: null });
    const raw = append(null, input(null, null, 1, { category: 'no_change', text: '' }));
    expect(decode(raw).changes.events).toMatchObject([{ category: 'no_change', text: '', revision: 1 }]);
    expect(decode(raw).completionBytes).toBeNull();
  });
  it('appends a correction/retraction with immutable original event and original observed date', () => {
    const first = append(null); const original = decode(first).changes.events[0];
    const correction = append(first, input(first, decode(first), 2, { kind: 'correction', targetEventId: id(1), text: 'I used the other cleanser.' }));
    const retraction = append(correction, input(correction, decode(correction), 3, { kind: 'retraction', targetEventId: id(2), text: 'I retract that correction.' }));
    expect(decode(retraction).changes.events[0]).toEqual(original);
    expect(decode(retraction).changes.events.map((event) => event.targetEventId)).toEqual([null, id(1), id(2)]);
    expect(Object.isFrozen(decode(retraction).changes.events)).toBe(true);
    expect(() => append(first, input(first, decode(first), 2, { kind: 'correction', targetEventId: id(1), observedOn: '2026-07-07' }))).toThrow();
    expect(() => append(first, input(first, decode(first), 2, { kind: 'retraction', targetEventId: id(99) }))).toThrow();
  });
  it('makes an identical retry idempotent and rejects changed duplicate ID or stale CAS', () => {
    const request = input(null, null); const first = append(null, request);
    expect(append(first, request)).toBe(first);
    expect(() => append(first, { ...request, text: 'Changed payload' })).toThrow();
    expect(() => append(first, input(null, null, 2))).toThrow();
    const secondRequest = input(first, decode(first), 2); const second = append(first, secondRequest);
    expect(append(second, secondRequest)).toBe(second);
    expect(() => append(second, request)).toThrow();
  });
  it('uses complete source bytes as well as hashes to reject substitution and changed source', () => {
    const request = input(null, null);
    const first = append(null, request); const parsed = decode(first);
    const changed = JSON.stringify({ ...parsed, completionBytes: '{}' });
    expect(() => append(changed, request)).toThrow();
    const next = input(first, parsed, 2);
    expect(() => append(first, { ...next, expectedSourceBytes: first + ' ', expectedSourceProof: hashOptionalChange41(first + ' ') })).toThrow();
    expect(() => append(first, { ...next, expectedRevision: 0 })).toThrow();
  });
  it('rejects foreign owners, duplicate IDs, wrong revision, changed content and extra/future fields', () => {
    const first = append(null); const parsed = JSON.parse(first);
    for (const changed of [
      { ...parsed, version: 5 }, { ...parsed, extra: true },
      { ...parsed, changes: { ...parsed.changes, ownerUserId: 'owner-b' } },
      { ...parsed, changes: { ...parsed.changes, revision: 2 } },
      { ...parsed, changes: { ...parsed.changes, events: [...parsed.changes.events, ...parsed.changes.events], revision: 2 } },
      { ...parsed, changes: { ...parsed.changes, events: [{ ...parsed.changes.events[0], text: 'substituted' }] } },
    ]) expect(() => decodeOptionalChangeEnvelope41(changed, OWNER)).toThrow();
  });
  it('enforces the finite event bound without dropping any history', () => {
    let raw: string | null = null;
    for (let n = 1; n <= OPTIONAL_CHANGE41_MAX_EVENTS; n += 1) {
      raw = append(raw, input(raw, raw ? decode(raw) : null, n));
    }
    expect(decode(raw!).changes.events).toHaveLength(OPTIONAL_CHANGE41_MAX_EVENTS);
    expect(() => append(raw, input(raw, decode(raw!), OPTIONAL_CHANGE41_MAX_EVENTS + 1))).toThrow(OPTIONAL_CHANGE41_BOUND);
  });
  it('rejects reversed recorded time without rewriting any existing event', () => {
    const first = append(null); const original = decode(first);
    const requested = input(first, original, 2);
    expect(() => appendOptionalChangeEnvelope41(first, original, requested, OWNER, '2026-07-08T15:59:00.000Z', DAY)).toThrow();
    expect(decode(first).changes.events).toHaveLength(1);
  });
  it('bounds the new envelope by real UTF-8 bytes rather than JavaScript character count', () => {
    const first = append(null); const parsed = JSON.parse(first);
    parsed.completionBytes = JSON.stringify({ [DAY]: ['AM:' + '界'.repeat(750_000)] });
    expect(parsed.completionBytes.length).toBeLessThan(2 * 1024 * 1024);
    expect(() => decodeOptionalChangeEnvelope41(parsed, OWNER)).toThrow();
  });
});

describe('Campaign41 actual encrypted privateKV, export and full-deletion contracts with synthetic native ports', () => {
  const KEY = 'layerwell.completions.v1';
  beforeEach(async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(NOW));
    native.raw.clear(); native.keys.clear(); native.id = 0;
    native.outcome = 'resolve'; native.afterWrite = undefined; native.readFailure = false; native.readsBeforeFailure = 0; native.keyFailure = false;
    native.setGate = null; native.setStarted = undefined;
    clearActiveHealthProcessingEpoch();
    const generation = await runAccountGenerationOperation((lease) => lease.generation);
    setActiveHealthProcessingEpoch(1, { ownerUserId: OWNER, accountGeneration: generation });
  });
  afterEach(async () => {
    clearActiveHealthProcessingEpoch(); vi.useRealTimers();
    native.raw.clear();
    await clearPrivateMutationAfterRemoval46([KEY]);
  });
  async function request() {
    const snapshot = await getOptionalChanges41(captureHealthDataWriteLease());
    return input(snapshot.sourceBytes, snapshot.events.length ? decode(snapshot.sourceBytes!) : null);
  }
  it('stores actual authenticated ciphertext under the existing key without note/network/diagnostic emission', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch');
    const logs = [vi.spyOn(console, 'log'), vi.spyOn(console, 'warn'), vi.spyOn(console, 'error')];
    try {
      const saved = await appendOptionalChange41(await request(), captureHealthDataWriteLease());
      expect(native.raw.size).toBe(1); expect([...native.raw.keys()]).toEqual([KEY]);
      expect(native.raw.get(KEY)).not.toContain('A personal factual note.');
      expect(JSON.parse(native.raw.get(KEY)!).version).toBe('xchacha20poly1305:v1');
      expect(JSON.parse((await getPrivateItem(KEY))!).changes.events).toEqual(saved.events);
      expect((await getOptionalChanges41(captureHealthDataWriteLease())).events).toEqual(saved.events);
      expect(fetch).not.toHaveBeenCalled();
      for (const log of logs) expect(JSON.stringify(log.mock.calls)).not.toContain('A personal factual note.');
    } finally { fetch.mockRestore(); logs.forEach((log) => log.mockRestore()); }
  });
  it.each(['reject-before', 'reject-after'] as const)('real privateKV restores exact ciphertext after %s and retry appends once', async (outcome) => {
    await toggleCompletion('AM:original', DAY);
    const prior = native.raw.get(KEY); const requested = await request();
    native.outcome = outcome;
    await expect(appendOptionalChange41(requested, captureHealthDataWriteLease())).rejects.toThrow();
    expect(native.raw.get(KEY)).toBe(prior);
    const saved = await appendOptionalChange41(requested, captureHealthDataWriteLease());
    expect(saved.events).toHaveLength(1);
  });
  it('real privateKV silent native no-commit is refused by canonical readback', async () => {
    await toggleCompletion('AM:original', DAY); const prior = native.raw.get(KEY);
    const requested = await request(); native.outcome = 'silent';
    await expect(appendOptionalChange41(requested, captureHealthDataWriteLease())).rejects.toThrow('PRIVATE_KV_WRITE_CONFLICT');
    expect(native.raw.get(KEY)).toBe(prior);
  });
  it('real encrypted readback failure retains committed bytes and exact retry cannot duplicate the event', async () => {
    const requested = await request();
    native.afterWrite = () => {
      // Confirm the real private writer first, then refuse the domain's fresh
      // encrypted readback. A failure inside the writer is a separate durable
      // recovery case covered by exportConfirmation46.
      native.readFailure = true; native.readsBeforeFailure = 1;
    };
    await expect(appendOptionalChange41(requested, captureHealthDataWriteLease())).rejects.toThrow('SYNTHETIC_READ_FAILURE');
    const committed = native.raw.get(KEY);
    native.afterWrite = undefined; native.readFailure = false;
    expect((await appendOptionalChange41(requested, captureHealthDataWriteLease())).events).toHaveLength(1);
    expect(native.raw.get(KEY)).toBe(committed);
  });
  it('real key unavailability preserves encrypted data and never creates default empty success', async () => {
    await appendOptionalChange41(await request(), captureHealthDataWriteLease());
    const prior = native.raw.get(KEY); native.keyFailure = true;
    await expect(getOptionalChanges41(captureHealthDataWriteLease())).rejects.toThrow();
    expect(native.raw.get(KEY)).toBe(prior);
  });
  it('actual purpose-limited export includes notes/lineage and strips owner identifiers', async () => {
    const first = await appendOptionalChange41(await request(), captureHealthDataWriteLease());
    const snapshot = await getOptionalChanges41(captureHealthDataWriteLease());
    await appendOptionalChange41(input(snapshot.sourceBytes, decode(snapshot.sourceBytes!), 2, {
      kind: 'correction', targetEventId: first.events[0]!.id, text: 'I correct my first statement.',
    }), captureHealthDataWriteLease());
    clearActiveHealthProcessingEpoch();
    const exported = await runAccountGenerationOperation((lease) => collectLocalDeviceExportData(lease, OWNER, NOW));
    const result = exported.sections.shelf_and_routine.completion_and_sync_state as { changes: { events: Record<string, unknown>[] } };
    expect(result.changes.events).toHaveLength(2);
    expect(result.changes.events[1]).toMatchObject({ targetEventId: first.events[0]!.id, text: 'I correct my first statement.' });
    expect(JSON.stringify(result)).not.toContain('ownerUserId');
    expect(native.raw.get(KEY)).toBeDefined();
  });
  it('actual full-local-data deletion removes ciphertext/key and closes an old callback before same-owner regrant', async () => {
    await appendOptionalChange41(await request(), captureHealthDataWriteLease());
    const stale = await request(); const oldLease = captureHealthDataWriteLease();
    beginAccountGenerationBoundary();
    try { await clearLocalPrivateData(); } finally { endAccountGenerationBoundary(); }
    expect(native.raw.has(KEY)).toBe(false); expect(native.keys.size).toBe(0);
    const generation = await runAccountGenerationOperation((lease) => lease.generation);
    setActiveHealthProcessingEpoch(1, { ownerUserId: OWNER, accountGeneration: generation });
    await expect(appendOptionalChange41(stale, oldLease)).rejects.toThrow();
    expect((await getOptionalChanges41(captureHealthDataWriteLease())).events).toEqual([]);
  });
  it('full deletion drains a pending native note write and its rollback before removing all history', async () => {
    await appendOptionalChange41(await request(), captureHealthDataWriteLease());
    const snapshot = await getOptionalChanges41(captureHealthDataWriteLease());
    const requested = input(snapshot.sourceBytes, decode(snapshot.sourceBytes!), 2);
    const oldLease = captureHealthDataWriteLease();
    let release!: () => void; let started!: () => void;
    native.setGate = new Promise<void>((resolve) => { release = resolve; });
    const dispatched = new Promise<void>((resolve) => { started = resolve; });
    native.setStarted = started;
    const pending = appendOptionalChange41(requested, oldLease);
    const refused = expect(pending).rejects.toThrow();
    await dispatched;
    beginAccountGenerationBoundary(); beginPrivateKVAccountBoundary();
    try {
      const deletion = (async () => {
        await waitForAccountGenerationOperationsToSettle();
        await waitForPrivateKVWritesToSettle();
        await clearLocalPrivateData();
      })();
      native.setGate = null; native.setStarted = undefined; release();
      await refused; await deletion;
    } finally { endPrivateKVAccountBoundary(); endAccountGenerationBoundary(); }
    expect(native.raw.has(KEY)).toBe(false); expect(native.keys.size).toBe(0);
    const generation = await runAccountGenerationOperation((lease) => lease.generation);
    setActiveHealthProcessingEpoch(1, { ownerUserId: OWNER, accountGeneration: generation });
    await expect(appendOptionalChange41(requested, oldLease)).rejects.toThrow();
    expect((await getOptionalChanges41(captureHealthDataWriteLease())).events).toEqual([]);
  });
  it('actual future completion ciphertext remains byte-identical on read and attempted note write', async () => {
    await setPrivateItem(KEY, '{"version":99,"days":{}}');
    const prior = native.raw.get(KEY);
    await expect(getOptionalChanges41(captureHealthDataWriteLease())).rejects.toThrow();
    await expect(appendOptionalChange41(input(null, null), captureHealthDataWriteLease())).rejects.toThrow();
    expect(native.raw.get(KEY)).toBe(prior);
  });
});
