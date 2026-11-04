import { close26, ports26, profile26, reset26 } from '@/features/shelf/firstValue26TestPorts';
import { randomUUID } from 'node:crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { appendOptionalChange41, getOptionalChanges41 } from '@/features/today/completionsStore';
import { localDateString } from '@/features/today/useToday';
import { claimLocalDataOwnership } from '@/lib/auth/sessionOwner';
import { runAccountGenerationOperation } from '@/lib/auth/accountGeneration';
import { captureHealthDataWriteLease } from '@/lib/consent/healthDataWriteAdmission';
import { activeHealthProcessingLeaseSnapshot } from '@/lib/consent/healthProcessingEpoch';
import { getPrivateItem, removePrivateItem } from '@/lib/storage/privateKV';
import { collectLocalDeviceExportData } from './localDeviceExport';
import { addProduct } from '@/features/shelf/store';
import { capturePlanSource44 } from '@/features/routine/planSourceFence44';
import { loadPlanHistory45, PLAN_HISTORY45_KEY, savePlanHistory45 } from '@/features/routine/planHistory45';

// Only the absent native filesystem is supplied. Owner, consent, encryption,
// private mutation queue and the actual export collector are production modules.
vi.mock('expo-file-system/legacy', () => ({ documentDirectory: null, cacheDirectory: null }));
const KEY = 'layerwell.completions.v1';
const OWNER = 'synthetic-first-value-a';
let client: QueryClient;
let release: (() => void) | undefined;
beforeEach(async () => {
  client = await reset26();
  await claimLocalDataOwnership(OWNER);
});
afterEach(async () => {
  release?.();
  release = undefined;
  vi.restoreAllMocks();
  await removePrivateItem(KEY);
  await close26(client);
  vi.unstubAllGlobals();
});
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function request() {
  const lease = captureHealthDataWriteLease();
  const snapshot = await getOptionalChanges41(lease);
  return {
    lease,
    input: {
      id: randomUUID(),
      expectedRevision: snapshot.revision,
      expectedSourceProof: snapshot.sourceProof,
      expectedSourceBytes: snapshot.sourceBytes,
      observedOn: localDateString(),
      category: 'personal_note' as const,
      text: 'Synthetic note awaiting native confirmation.',
      kind: 'note' as const,
      targetEventId: null,
      confirmation: true as const,
    },
  };
}

it('does not export a tentative optional note while native commit can still reject and roll back', async () => {
  const confirmed = await request();
  await appendOptionalChange41(
    { ...confirmed.input, text: 'Confirmed prior synthetic note.' },
    confirmed.lease,
  );
  const { lease, input } = await request();
  const before = ports26.bytes.get(KEY);
  const nativeSet = AsyncStorage.setItem;
  const entered = deferred();
  const gate = deferred();
  release = gate.resolve;
  let first = true;
  vi.spyOn(AsyncStorage, 'setItem').mockImplementation(async (key, raw) => {
    await nativeSet(key, raw);
    if (key === KEY && first) {
      first = false;
      entered.resolve();
      await gate.promise;
      throw new Error('SYNTHETIC_NATIVE_COMMIT_THEN_REJECT');
    }
  });
  const saving = appendOptionalChange41(input, lease).then(
    () => ({ ok: true as const }),
    (error) => ({ ok: false as const, error }),
  );
  await Promise.race([
    entered.promise,
    saving.then((result) => {
      if (!result.ok) throw result.error;
      throw new Error('Native write was not observed');
    }),
  ]);
  expect(ports26.bytes.get(KEY)).toBeDefined();
  expect(ports26.bytes.get(KEY)).not.toContain(input.text);
  const exporting = runAccountGenerationOperation((accountLease) =>
    collectLocalDeviceExportData(accountLease, OWNER),
  ).then(
    (value) => ({ ok: true as const, value }),
    (error) => ({ ok: false as const, error }),
  );
  // The real writer is held after native bytes become readable. Export must
  // refuse or wait for exact compensation, never publish the tentative event.
  await new Promise<void>((done) => setTimeout(done, 30));
  gate.resolve();
  const saved = await saving;
  const result = await exporting;
  expect(saved.ok).toBe(false);
  expect(ports26.bytes.get(KEY)).toBe(before);
  if (result.ok) expect(JSON.stringify(result.value)).not.toContain(input.text);
  else expect(String(result.error)).toContain('LOCAL_DATA_PRIVATE_MUTATION_RECOVERY_REQUIRED');
  // A fresh explicit retry after exact rollback must retain the confirmed fact
  // and must not export the rejected event, regardless of the earlier refusal.
  const exported = await runAccountGenerationOperation((accountLease) =>
    collectLocalDeviceExportData(accountLease, OWNER),
  );
  expect(JSON.stringify(exported)).toContain('Confirmed prior synthetic note.');
  expect(JSON.stringify(exported)).not.toContain(input.text);
  const completion = exported.sections.shelf_and_routine.completion_and_sync_state as {
    changes: { events: unknown[] };
  };
  expect(completion.changes.events).toHaveLength(1);
});

it('refuses export after rejected optional-note persistence cannot restore the exact prior bytes', async () => {
  const { lease, input } = await request();
  const nativeSet = AsyncStorage.setItem;
  let first = true;
  vi.spyOn(AsyncStorage, 'setItem').mockImplementation(async (key, raw) => {
    await nativeSet(key, raw);
    if (key === KEY && first) {
      first = false;
      throw new Error('SYNTHETIC_NATIVE_COMMIT_THEN_REJECT');
    }
  });
  const nativeRemove = AsyncStorage.removeItem;
  vi.spyOn(AsyncStorage, 'removeItem').mockImplementation(async (key) => {
    if (key === KEY) throw new Error('SYNTHETIC_COMPENSATION_REFUSED');
    await nativeRemove(key);
  });
  await expect(appendOptionalChange41(input, lease)).rejects.toThrow(
    'PRIVATE_KV_WRITE_ROLLBACK_FAILED',
  );
  expect(activeHealthProcessingLeaseSnapshot()).toBeNull();
  expect(JSON.parse(ports26.bytes.get('layerwell.localDataCleanupRequired.v1')!).v).toBe(2);
  const unconfirmedCiphertext = ports26.bytes.get(KEY);
  expect(unconfirmedCiphertext).toBeDefined();
  expect(unconfirmedCiphertext).not.toContain(input.text);
  await expect(
    runAccountGenerationOperation((accountLease) =>
      collectLocalDeviceExportData(accountLease, OWNER),
    ),
  ).rejects.toThrow();
  expect(ports26.bytes.get(KEY)).toBe(unconfirmedCiphertext);
});

it('exports one confirmed note after a successful held native save and idempotent retry', async () => {
  const { lease, input } = await request();
  const nativeSet = AsyncStorage.setItem;
  const entered = deferred();
  const gate = deferred();
  release = gate.resolve;
  let first = true;
  vi.spyOn(AsyncStorage, 'setItem').mockImplementation(async (key, raw) => {
    await nativeSet(key, raw);
    if (key === KEY && first) {
      first = false;
      entered.resolve();
      await gate.promise;
    }
  });
  const saving = appendOptionalChange41(input, lease);
  await Promise.race([
    entered.promise,
    saving.then(() => {
      throw new Error('Native write was not observed');
    }),
  ]);
  const exporting = runAccountGenerationOperation((accountLease) =>
    collectLocalDeviceExportData(accountLease, OWNER),
  ).then(
    (value) => ({ ok: true as const, value }),
    (error) => ({ ok: false as const, error }),
  );
  await new Promise<void>((done) => setTimeout(done, 30));
  gate.resolve();
  const saved = await saving;
  expect(saved.events).toHaveLength(1);
  const firstExport = await exporting;
  if (!firstExport.ok)
    expect(String(firstExport.error)).toContain('LOCAL_DATA_PRIVATE_MUTATION_RECOVERY_REQUIRED');
  const ciphertext = ports26.bytes.get(KEY);
  expect((await appendOptionalChange41(input, lease)).events).toHaveLength(1);
  expect(ports26.bytes.get(KEY)).toBe(ciphertext);
  const exported = await runAccountGenerationOperation((accountLease) =>
    collectLocalDeviceExportData(accountLease, OWNER),
  );
  const completion = exported.sections.shelf_and_routine.completion_and_sync_state as {
    changes: { events: { text: string }[] };
  };
  expect(completion.changes.events).toHaveLength(1);
  expect(completion.changes.events[0]?.text).toBe(input.text);
});

it('rejects an old direct-read snapshot across an entirely completed mutation and rollback ABA', async () => {
  const confirmed = await request();
  await appendOptionalChange41(
    { ...confirmed.input, text: 'Confirmed before read ABA.' },
    confirmed.lease,
  );
  const next = await request();
  const before = ports26.bytes.get(KEY);
  const nativeGet = AsyncStorage.getItem;
  const entered = deferred();
  const gate = deferred();
  release = gate.resolve;
  let held = false;
  vi.spyOn(AsyncStorage, 'getItem').mockImplementation(async (key) => {
    const raw = await nativeGet(key);
    if (key === KEY && !held) {
      held = true;
      entered.resolve();
      await gate.promise;
    }
    return raw;
  });
  const reading = getPrivateItem(KEY).then(
    (value) => ({ ok: true as const, value }),
    (error) => ({ ok: false as const, error }),
  );
  await entered.promise;
  const nativeSet = AsyncStorage.setItem;
  let rejected = false;
  vi.spyOn(AsyncStorage, 'setItem').mockImplementation(async (key, raw) => {
    await nativeSet(key, raw);
    if (key === KEY && !rejected) {
      rejected = true;
      throw new Error('SYNTHETIC_NATIVE_COMMIT_THEN_REJECT');
    }
  });
  await expect(appendOptionalChange41(next.input, next.lease)).rejects.toThrow();
  expect(ports26.bytes.get(KEY)).toBe(before);
  gate.resolve();
  const oldRead = await reading;
  expect(oldRead.ok).toBe(false);
  if (!oldRead.ok)
    expect(String(oldRead.error)).toContain('LOCAL_DATA_PRIVATE_MUTATION_RECOVERY_REQUIRED');
  expect((await getOptionalChanges41(captureHealthDataWriteLease())).events).toHaveLength(1);
});


it('retires a direct history read when a full marker lifecycle crosses its final native history fence', async () => {
  // Build genuine C45 encrypted history, then challenge the last existing
  // history-fence await after the C46 global check has already completed.
  vi.stubGlobal('__DEV__', true);
  await profile26();
  await addProduct({ operationId: randomUUID(), name: 'Final fence synthetic cleanser', category: 'cleanser', addedVia: 'manual' });
  const historyLease = captureHealthDataWriteLease();
  const snapshot = await capturePlanSource44(historyLease);
  const history = await savePlanHistory45(snapshot, historyLease, { id: randomUUID(), createdAt: new Date().toISOString() });
  const requested = await request();
  const nativeGet = AsyncStorage.getItem;
  const entered = deferred(); const gate = deferred(); release = gate.resolve;
  let reads = 0;
  vi.spyOn(AsyncStorage, 'getItem').mockImplementation(async key => {
    const raw = await nativeGet(key);
    if (key === 'layerwell.localDataCleanupRequired.v1' && ++reads === 7) {
      entered.resolve(); await gate.promise;
    }
    return raw;
  });
  const reading = getPrivateItem(PLAN_HISTORY45_KEY)
    .then(value => ({ ok: true as const, value }), error => ({ ok: false as const, error }));
  await Promise.race([entered.promise, reading.then(() => { throw new Error('Final native history fence was not observed'); })]);
  // This independent destination uses the real generic writer and completes
  // its prearm/native/readback/finish cycle while that last read is held.
  await appendOptionalChange41(requested.input, requested.lease);
  gate.resolve();
  const stale = await reading;
  expect(stale.ok).toBe(false);
  if (!stale.ok) expect(String(stale.error)).toContain('LOCAL_DATA_PRIVATE_MUTATION_RECOVERY_REQUIRED');
  expect(await loadPlanHistory45(captureHealthDataWriteLease())).toEqual(history);
});
