import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { QueryClient } from '@tanstack/react-query';

import { close26, grant26, ports26, profile26, reset26 } from '@/features/shelf/firstValue26TestPorts';
import { addProduct, loadShelf, removeProduct, updateProduct } from '@/features/shelf/store';
import { setHealthDataCollectionConsentLocal } from '@/features/onboarding/healthConsentStore';
import { HEALTH_DATA_CONSENT } from '@/features/onboarding/consentCopy';
import { collectLocalDeviceExportData } from '@/features/settings/localDeviceExport';
import { appendOptionalChange41, getCompletedSteps, getOptionalChanges41, stepKey, toggleCompletion } from '@/features/today/completionsStore';
import { localDateString } from '@/features/today/useToday';
import { runAccountGenerationOperation } from '@/lib/auth/accountGeneration';
import { captureHealthDataWriteLease } from '@/lib/consent/healthDataWriteAdmission';
import { clearActiveHealthProcessingEpoch } from '@/lib/consent/healthProcessingEpoch';
import { clearPrivateKVContentKey, waitForPrivateKVWritesToSettle } from '@/lib/storage/privateKV';
import { capturePlanSource44, savePlanOrderWithSource44 } from './planSourceFence44';
import { loadPlanHistory45, savePlanHistory45 } from './planHistory45';

// Native file adapter only. All domain stores, crypto, owner/health leases,
// source reservations, export and correction journals execute unchanged.
vi.mock('expo-file-system/legacy', () => ({ documentDirectory: null, cacheDirectory: null }));

let client: QueryClient;
beforeEach(async () => {
  vi.stubGlobal('__DEV__', true);
  client = await reset26();
  await profile26();
  await (await import('@/lib/auth/sessionOwner')).claimLocalDataOwnership('synthetic-first-value-a');
});
afterEach(async () => {
  await waitForPrivateKVWritesToSettle();
  await clearPrivateKVContentKey();
  await close26(client);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('connects encrypted manual Shelf, explicit ordered history, offline Today facts/correction and owner export', async () => {
  // reset26 is an explicitly synthetic admitted-owner native port fixture,
  // never evidence of production onboarding, a paid entitlement or a device.
  const cleanser = await addProduct({ operationId: randomUUID(), name: 'Synthetic46 cleanser',
    category: 'cleanser', ingredients: ['Aqua', 'Glycerin'], addedVia: 'manual' });
  const balm = await addProduct({ operationId: randomUUID(), name: 'Synthetic46 moisturiser',
    category: 'moisturiser', addedVia: 'manual' });
  const lease = captureHealthDataWriteLease();
  const initial = await capturePlanSource44(lease);
  await savePlanOrderWithSource44(initial, { schemaVersion: 1,
    am: [balm.id, cleanser.id], pm: [cleanser.id, balm.id] });
  const ordered = await capturePlanSource44(lease);
  expect(ordered.am.map((row) => row.productId)).toEqual([balm.id, cleanser.id]);
  const intent = { id: randomUUID(), createdAt: new Date().toISOString() };
  const saved = await savePlanHistory45(ordered, lease, intent);
  expect(await savePlanHistory45(ordered, lease, intent)).toEqual(saved);
  const historyBytes = ports26.bytes.get('layerwell.routinePlanHistory.v1');
  const day = localDateString();
  const key = stepKey('AM', cleanser.id);
  expect((await toggleCompletion(key, day)).inserted).toBe(true);
  expect((await toggleCompletion(key, day)).inserted).toBe(false);
  const changeSource = await getOptionalChanges41(lease);
  const note = await appendOptionalChange41({ id: randomUUID(), expectedRevision: changeSource.revision,
    expectedSourceProof: changeSource.sourceProof, expectedSourceBytes: changeSource.sourceBytes,
    observedOn: day, category: 'personal_note', text: 'Used my cleanser.', kind: 'note',
    targetEventId: null, confirmation: true }, lease);
  const correction = await appendOptionalChange41({ id: randomUUID(), expectedRevision: note.revision,
    expectedSourceProof: note.sourceProof, expectedSourceBytes: note.sourceBytes,
    observedOn: day, category: 'personal_note', text: 'Used my cleanser in the morning.', kind: 'correction',
    targetEventId: note.events[0]!.id, confirmation: true }, lease);
  expect(correction.events[0]).toEqual(note.events[0]);
  expect(correction.events).toHaveLength(2);
  expect(await getCompletedSteps(day)).toEqual(new Set([key]));
  // Current source changes cannot rewrite dated plans or confirmed Today facts.
  await updateProduct(cleanser.id, { name: 'Synthetic46 renamed cleanser' });
  await updateProduct(balm.id, { status: 'finished' });
  await expect(savePlanHistory45(ordered, lease, { id: randomUUID(), createdAt: new Date().toISOString() })).rejects.toThrow();
  await removeProduct(balm.id);
  client.clear(); // navigation/query-cache loss, not a native process restart
  expect(await loadPlanHistory45(lease)).toEqual(saved);
  expect(ports26.bytes.get('layerwell.routinePlanHistory.v1')).toBe(historyBytes);
  expect(await getCompletedSteps(day)).toEqual(new Set([key]));
  expect((await getOptionalChanges41(lease)).events).toEqual(correction.events);
  expect((await loadShelf()).map((row) => row.id)).toEqual([cleanser.id]);
  const exported = await runAccountGenerationOperation((account) =>
    collectLocalDeviceExportData(account, lease.ownerUserId));
  expect(exported.sections.shelf_and_routine.routine_plan_history).toEqual({ schemaVersion: 1, versions: saved.versions });
  expect(JSON.stringify(exported)).not.toContain('file:///');
  expect(JSON.stringify(exported)).not.toContain(lease.ownerUserId);
  expect(ports26.track).not.toHaveBeenCalled();
  for (const raw of ports26.bytes.values()) expect(raw).not.toContain('Synthetic46');
});

it('denies missing/changed authority and retains confirmed bytes across consent pause without leaking to a successor', async () => {
  await addProduct({ operationId: randomUUID(), name: 'Synthetic46 private cleanser', category: 'cleanser', addedVia: 'manual' });
  const lease = captureHealthDataWriteLease();
  const snapshot = await capturePlanSource44(lease);
  const saved = await savePlanHistory45(snapshot, lease, { id: randomUUID(), createdAt: new Date().toISOString() });
  clearActiveHealthProcessingEpoch();
  const before = new Map(ports26.bytes);
  expect(() => captureHealthDataWriteLease()).toThrow();
  await expect(loadPlanHistory45(lease)).rejects.toThrow();
  await expect(addProduct({ operationId: randomUUID(), name: 'Retired write', category: 'cleanser', addedVia: 'manual' })).rejects.toThrow();
  expect(ports26.bytes).toEqual(before);
  // Existing purpose-limited export is independent of processing consent.
  await setHealthDataCollectionConsentLocal({ granted: false, version: HEALTH_DATA_CONSENT.version,
    consentText: HEALTH_DATA_CONSENT.declineText });
  const exported = await runAccountGenerationOperation((account) => collectLocalDeviceExportData(account, lease.ownerUserId));
  expect(exported.sections.shelf_and_routine.routine_plan_history).toEqual({ schemaVersion: 1, versions: saved.versions });
  await grant26('synthetic46-successor');
  await expect(loadPlanHistory45(captureHealthDataWriteLease())).rejects.toThrow();
  await expect(runAccountGenerationOperation((account) => collectLocalDeviceExportData(account, 'synthetic46-successor'))).rejects.toThrow();
});
