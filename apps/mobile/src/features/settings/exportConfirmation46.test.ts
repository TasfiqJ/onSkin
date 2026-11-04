import { close26, ports26, reset26 } from '@/features/shelf/firstValue26TestPorts';
import { randomUUID } from 'node:crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { appendOptionalChange41, getOptionalChanges41 } from '@/features/today/completionsStore';
import { localDateString } from '@/features/today/useToday';
import { claimLocalDataOwnership } from '@/lib/auth/sessionOwner';
import { runAccountGenerationOperation } from '@/lib/auth/accountGeneration';
import { captureHealthDataWriteLease } from '@/lib/consent/healthDataWriteAdmission';
import { collectLocalDeviceExportData } from './localDeviceExport';

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
  await close26(client);
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
  let settled = false;
  const exporting = runAccountGenerationOperation((accountLease) =>
    collectLocalDeviceExportData(accountLease, OWNER),
  ).finally(() => {
    settled = true;
  });
  // The real writer is held after native bytes become readable. Export must
  // wait for exact compensation, not publish an event that never committed.
  await new Promise<void>((done) => setTimeout(done, 30));
  const observedWhileNativePending = settled;
  gate.resolve();
  const saved = await saving;
  const exported = await exporting;
  expect(saved.ok).toBe(false);
  expect(ports26.bytes.get(KEY)).toBe(before);
  expect
    .soft(observedWhileNativePending, 'Export must wait for native mutation settlement')
    .toBe(false);
  expect(JSON.stringify(exported)).not.toContain(input.text);
  expect(exported.sections.shelf_and_routine.completion_and_sync_state).toBeUndefined();
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
