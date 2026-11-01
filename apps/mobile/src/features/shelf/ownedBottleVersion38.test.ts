import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { beginAccountGenerationBoundary, endAccountGenerationBoundary, runAccountGenerationOperation } from '@/lib/auth/accountGeneration';
import { clearActiveHealthProcessingEpoch, setActiveHealthProcessingEpoch } from '@/lib/consent/healthProcessingEpoch';
import { captureHealthDataWriteLease } from '@/lib/consent/healthDataWriteAdmission';
import { getPrivateItem } from '@/lib/storage/privateKV';

import { FORMULA38_INVALID, FORMULA38_OWNER_MISMATCH, FORMULA38_STALE, type FormulaObservation38 } from './formulaVersion38';
import { createOwnedProductVersion38, historySnapshot38, sameObservation38, validateOwnedBottleHistory38, type OwnedBottleHistory38, type ProductIdentitySource38 } from './ownedBottleVersion38';
import { addProduct, clearShelf, confirmOwnedBottleVersion38, loadOwnedBottleHistory38, loadShelf, removeProduct, updateProduct, type ConfirmOwnedBottleVersionInput38 } from './store';

const ports = vi.hoisted(() => ({
  raw: new Map<string, string>(), keys: new Map<string, string>(), id: 0,
  writeOutcome: 'resolve' as 'resolve' | 'reject-before' | 'reject-after',
  setGate: null as Promise<void> | null, setStarted: null as (() => void) | null,
  readGate: null as Promise<void> | null, readStarted: null as (() => void) | null,
  rejectKeyRead: false,
}));

vi.mock('expo-crypto', () => ({ randomUUID: vi.fn(() => `38000000-0000-4000-8000-${String(++ports.id).padStart(12, '0')}`) }));
vi.mock('react-native-get-random-values', () => ({}));
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
vi.mock('expo-secure-store', () => ({
  isAvailableAsync: vi.fn(async () => true),
  getItemAsync: vi.fn(async (key: string) => {
    if (ports.rejectKeyRead) throw new Error('SYNTHETIC_KEY_UNAVAILABLE');
    return ports.keys.get(key) ?? null;
  }),
  setItemAsync: vi.fn(async (key: string, value: string) => { ports.keys.set(key, value); }),
  deleteItemAsync: vi.fn(async (key: string) => { ports.keys.delete(key); }),
}));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: {
  getItem: vi.fn(async (key: string) => {
    const snapshot = ports.raw.get(key) ?? null;
    ports.readStarted?.();
    if (ports.readGate) await ports.readGate;
    return snapshot;
  }),
  getAllKeys: vi.fn(async () => [...ports.raw.keys()]),
  multiGet: vi.fn(async (keys: string[]) => keys.map((key) => [key, ports.raw.get(key) ?? null])),
  setItem: vi.fn(async (key: string, value: string) => {
    ports.setStarted?.();
    if (ports.setGate) await ports.setGate;
    const outcome = ports.writeOutcome;
    ports.writeOutcome = 'resolve';
    if (outcome === 'reject-before') throw new Error('SYNTHETIC_STORAGE_REFUSED');
    ports.raw.set(key, value);
    if (outcome === 'reject-after') throw new Error('SYNTHETIC_STORAGE_AMBIGUOUS');
  }),
  removeItem: vi.fn(async (key: string) => { ports.raw.delete(key); }),
  multiRemove: vi.fn(async (keys: string[]) => { for (const key of keys) ports.raw.delete(key); }),
} }));

const KEY = 'layerwell.shelf.v1';
const product: ProductIdentitySource38 = {
  id: 'bottle-a', name: 'Owner cream', brand: null, barcode: null, category: 'moisturizer',
  addedVia: 'manual', catalogSource: 'user_local', catalogMatchQuality: 'manual', ingredientParseStatus: null,
  createdAt: '2026-10-01T12:00:00.000Z', updatedAt: '2026-10-01T12:00:00.000Z',
};
const observation: FormulaObservation38 = { confirmation: 'confirm_label', labelText: 'Aqua, Glycerin', market: 'Canada', variant: 'Plain', observedOn: '2026-10-01' };
const recordedAt = '2026-10-02T12:00:00.000Z';

function history(): OwnedBottleHistory38 {
  const one = createOwnedProductVersion38(product, 'owner-a', observation, null, recordedAt);
  const two = createOwnedProductVersion38(product, 'owner-a', { ...observation, variant: 'New variant' }, one, '2026-10-03T12:00:00.000Z');
  return { productId: product.id, ownerUserId: 'owner-a', revision: 2, currentVersionId: two.id, versions: [one, two] };
}

describe('immutable owned bottle domain38', () => {
  it('keeps identity, formula and unit version distinct with valid predecessor references', () => {
    const value = history();
    expect(() => validateOwnedBottleHistory38(value)).not.toThrow();
    const current = value.versions[1]!;
    expect(current.previousVersionId).toBe(value.versions[0]!.id);
    expect(current.formulaVersion.previousFormulaVersionId).toBe(value.versions[0]!.formulaVersion.id);
    expect(new Set([current.id, current.productIdentity.id, current.formulaVersion.id]).size).toBe(3);
    expect(Object.isFrozen(value.versions)).toBe(true);
    expect(Object.isFrozen(current)).toBe(true);
    expect(Object.isFrozen(current.formulaVersion)).toBe(true);
    expect(historySnapshot38(product, value)).toMatchObject({ revision: 2, currentVersionId: current.id, ownedUnitId: product.id });
  });

  it('refuses another unit or owner as a previous version rather than inheriting confirmation', () => {
    const previous = history().versions[0]!;
    expect(() => createOwnedProductVersion38({ ...product, id: 'bottle-b' }, 'owner-a', observation, previous, recordedAt)).toThrow(FORMULA38_INVALID);
    expect(() => createOwnedProductVersion38(product, 'owner-b', observation, previous, recordedAt)).toThrow(FORMULA38_INVALID);
    const fresh = createOwnedProductVersion38({ ...product, id: 'bottle-b' }, 'owner-a', { ...observation, variant: 'Different market bottle' }, null, recordedAt);
    expect(fresh.previousVersionId).toBeNull();
    expect(fresh.id).not.toBe(previous.id);
  });

  it('matches exact observation idempotently while market, variant and identity changes differ', () => {
    const version = history().versions[0]!;
    expect(sameObservation38(version, product, observation)).toBe(true);
    expect(sameObservation38(version, product, { ...observation, variant: 'New' })).toBe(false);
    expect(sameObservation38(version, product, { ...observation, market: 'US' })).toBe(false);
    expect(sameObservation38(version, { ...product, name: 'Other cream' }, observation)).toBe(false);
  });

  it('rejects forged chains, duplicate versions, unknown pointers and altered identity hash', () => {
    const mutations = [
      (value: any) => { value.currentVersionId = 'unknown'; },
      (value: any) => { value.revision = 1; },
      (value: any) => { value.versions[1] = value.versions[0]; },
      (value: any) => { value.versions[0].previousVersionId = value.versions[1].id; },
      (value: any) => { value.versions[0].productIdentity.name = 'Other'; },
      (value: any) => { value.versions[0].formulaVersion.market = 'Source-reviewed market'; },
      (value: any) => { value.versions[0].ownerUserId = 'other'; },
      (value: any) => { value.actor = 'clinical_reviewer'; },
    ];
    for (const mutate of mutations) {
      const value = JSON.parse(JSON.stringify(history()));
      mutate(value);
      expect(() => validateOwnedBottleHistory38(value)).toThrow(FORMULA38_INVALID);
    }
  });

  it('rejects clock reversal, impossible/future observations and invalid recorded timestamps', () => {
    const previous = history().versions[0]!;
    expect(() => createOwnedProductVersion38(product, 'owner-a', observation, previous, '2026-10-01T12:00:00.000Z')).toThrow(FORMULA38_INVALID);
    expect(() => createOwnedProductVersion38(product, 'owner-a', { ...observation, observedOn: '2026-10-10' }, null, recordedAt)).toThrow(FORMULA38_INVALID);
    expect(() => createOwnedProductVersion38(product, 'owner-a', observation, null, 'not-a-date')).toThrow(FORMULA38_INVALID);
  });
});

describe('history38 through real encrypted privateKV and health/account leases', () => {
  beforeEach(async () => {
    ports.raw.clear(); ports.keys.clear(); ports.id = 0; ports.writeOutcome = 'resolve';
    ports.setGate = null; ports.setStarted = null; ports.readGate = null; ports.readStarted = null; ports.rejectKeyRead = false;
    clearActiveHealthProcessingEpoch();
    const generation = await runAccountGenerationOperation((lease) => lease.generation);
    setActiveHealthProcessingEpoch(1, { ownerUserId: 'owner-a', accountGeneration: generation });
  });
  afterEach(() => { vi.useRealTimers(); });

  async function inputFor(id: string): Promise<ConfirmOwnedBottleVersionInput38> {
    const snapshot = await loadOwnedBottleHistory38(id);
    if (!snapshot) throw new Error('TEST_PRODUCT_MISSING');
    return { productId: id, expectedUpdatedAt: snapshot.productUpdatedAt, expectedProductIdentityHash: snapshot.productIdentityHash, expectedRevision: snapshot.revision, expectedCurrentVersionId: snapshot.currentVersionId, ...observation };
  }

  it('cold-restores authenticated ciphertext, has one key, and emits no formula to diagnostics or network', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const logSpy = vi.spyOn(console, 'log');
    const warnSpy = vi.spyOn(console, 'warn');
    const errorSpy = vi.spyOn(console, 'error');
    try {
      const owned = await addProduct({ name: 'Synthetic encrypted cream', addedVia: 'manual' });
      const first = await confirmOwnedBottleVersion38(await inputFor(owned.id));
      expect(ports.raw.size).toBe(1);
      expect(ports.raw.get(KEY)).not.toContain('Aqua');
      expect(ports.raw.get(KEY)).not.toContain('Canada');
      expect(JSON.parse(ports.raw.get(KEY)!).version).toBe('xchacha20poly1305:v1');
      expect((await loadOwnedBottleHistory38(owned.id))?.currentVersionId).toBe(first.currentVersionId);
      const decrypted = JSON.parse((await getPrivateItem(KEY))!);
      expect(decrypted.ownedBottleHistories[0].versions).toHaveLength(1);
      expect(JSON.stringify(decrypted.mirrorOutbox)).not.toContain('Aqua');
      expect(JSON.stringify(decrypted.mirrorOutbox)).not.toContain('formula38');
      expect(fetchSpy).not.toHaveBeenCalled();
      for (const spy of [logSpy, warnSpy, errorSpy]) expect(JSON.stringify(spy.mock.calls)).not.toMatch(/Aqua|Canada|formula38|Synthetic encrypted cream/);
    } finally { fetchSpy.mockRestore(); logSpy.mockRestore(); warnSpy.mockRestore(); errorSpy.mockRestore(); }
  });

  it.each(['reject-before', 'reject-after'] as const)('retains exact original ciphertext after storage %s and retries once', async (outcome) => {
    const owned = await addProduct({ name: 'Synthetic encrypted cream', addedVia: 'manual' });
    const input = await inputFor(owned.id);
    const prior = ports.raw.get(KEY);
    ports.writeOutcome = outcome;
    await expect(confirmOwnedBottleVersion38(input)).rejects.toThrow(/SYNTHETIC_STORAGE/);
    expect(ports.raw.get(KEY)).toBe(prior);
    expect((await loadOwnedBottleHistory38(owned.id))?.revision).toBe(0);
    expect((await confirmOwnedBottleVersion38(input)).revision).toBe(1);
    expect((await confirmOwnedBottleVersion38(input)).revision).toBe(1);
  });

  it('rechecks outdated screen admission immediately before native write and leaves ciphertext unchanged', async () => {
    const owned = await addProduct({ name: 'Synthetic encrypted cream', addedVia: 'manual' });
    const input = await inputFor(owned.id);
    const prior = ports.raw.get(KEY);
    const guard = vi.fn(() => { throw new Error('SCREEN_RETIRED'); });
    await expect(confirmOwnedBottleVersion38(input, guard)).rejects.toThrow('SCREEN_RETIRED');
    expect(guard).toHaveBeenCalled();
    expect(ports.raw.get(KEY)).toBe(prior);
  });

  it('compensates exact ciphertext when withdrawal/regrant occurs after native invocation', async () => {
    const owned = await addProduct({ name: 'Synthetic encrypted cream', addedVia: 'manual' });
    const input = await inputFor(owned.id);
    const prior = ports.raw.get(KEY);
    let release!: () => void; let signal!: () => void;
    ports.setGate = new Promise<void>((resolve) => { release = resolve; });
    const started = new Promise<void>((resolve) => { signal = resolve; }); ports.setStarted = signal;
    const pending = confirmOwnedBottleVersion38(input);
    const refused = expect(pending).rejects.toThrow('HEALTH_DATA_WRITE_ADMISSION_CLOSED');
    await started;
    const generation = captureHealthDataWriteLease().accountGeneration;
    clearActiveHealthProcessingEpoch();
    setActiveHealthProcessingEpoch(1, { ownerUserId: 'owner-a', accountGeneration: generation });
    release(); await refused;
    expect(ports.raw.get(KEY)).toBe(prior);
    ports.setGate = null; ports.setStarted = null;
    expect((await loadOwnedBottleHistory38(owned.id))?.revision).toBe(0);
  });

  it('compensates account-generation retirement and never publishes a delayed foreign read', async () => {
    const owned = await addProduct({ name: 'Synthetic encrypted cream', addedVia: 'manual' });
    await confirmOwnedBottleVersion38(await inputFor(owned.id));
    let release!: () => void; let signal!: () => void;
    ports.readGate = new Promise<void>((resolve) => { release = resolve; });
    const started = new Promise<void>((resolve) => { signal = resolve; }); ports.readStarted = signal;
    const pending = loadOwnedBottleHistory38(owned.id);
    const refused = expect(pending).rejects.toThrow(/ACCOUNT_GENERATION_CHANGED|HEALTH_DATA_WRITE/);
    await started;
    beginAccountGenerationBoundary(); endAccountGenerationBoundary();
    const generation = await runAccountGenerationOperation((lease) => lease.generation);
    setActiveHealthProcessingEpoch(2, { ownerUserId: 'owner-b', accountGeneration: generation });
    release(); await refused;
    ports.readGate = null; ports.readStarted = null;
    await expect(loadOwnedBottleHistory38(owned.id)).rejects.toThrow(FORMULA38_OWNER_MISMATCH);
  });

  it('treats missing key/corrupt ciphertext as unavailable and never resets prior history', async () => {
    const owned = await addProduct({ name: 'Synthetic encrypted cream', addedVia: 'manual' });
    await confirmOwnedBottleVersion38(await inputFor(owned.id));
    const prior = ports.raw.get(KEY)!;
    ports.rejectKeyRead = true;
    await expect(loadOwnedBottleHistory38(owned.id)).rejects.toThrow('PRIVATE_KV_CONTENT_KEY_STORAGE_UNAVAILABLE');
    expect(ports.raw.get(KEY)).toBe(prior);
    ports.rejectKeyRead = false;
    const damaged = JSON.parse(prior); damaged.ciphertextHex = `00${damaged.ciphertextHex.slice(2)}`;
    const corrupt = JSON.stringify(damaged); ports.raw.set(KEY, corrupt);
    await expect(loadOwnedBottleHistory38(owned.id)).rejects.toThrow('PRIVATE_KV_DECRYPTION_FAILED');
    await expect(updateProduct(owned.id, { name: 'Must not reset' })).rejects.toThrow();
    expect(ports.raw.get(KEY)).toBe(corrupt);
  });

  it('refuses an old encrypted history read that settles after the unit was deleted', async () => {
    const owned = await addProduct({ name: 'Synthetic encrypted cream', addedVia: 'manual' });
    await confirmOwnedBottleVersion38(await inputFor(owned.id));
    let release!: () => void; let signal!: () => void;
    ports.readGate = new Promise<void>((resolve) => { release = resolve; });
    const started = new Promise<void>((resolve) => { signal = resolve; }); ports.readStarted = signal;
    const pending = loadOwnedBottleHistory38(owned.id);
    const refused = expect(pending).rejects.toThrow(FORMULA38_STALE);
    await started;
    ports.readGate = null; ports.readStarted = null;
    await removeProduct(owned.id);
    release(); await refused;
    expect(await loadOwnedBottleHistory38(owned.id)).toBeNull();
    expect(await getPrivateItem(KEY)).not.toContain('Aqua');
  });

  it('keeps exactly one winner for CAS and deletes local version bytes despite prior mirror operations', async () => {
    const owned = await addProduct({ name: 'Synthetic encrypted cream', addedVia: 'manual' });
    const input = await inputFor(owned.id);
    const results = await Promise.allSettled([confirmOwnedBottleVersion38(input), confirmOwnedBottleVersion38({ ...input, variant: 'Other variant' })]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toMatchObject([{ reason: { message: FORMULA38_STALE } }]);
    await removeProduct(owned.id);
    expect(await loadOwnedBottleHistory38(owned.id)).toBeNull();
    expect(await getPrivateItem(KEY)).not.toContain('Aqua');
    expect(await loadShelf()).toEqual([]);
    clearActiveHealthProcessingEpoch();
    await clearShelf();
    expect(ports.raw.has(KEY)).toBe(false);
  });
});
